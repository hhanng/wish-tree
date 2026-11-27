-- Wish Tree database schema.
-- Reference copy of what is already live in Supabase, for reading and for reproducing
-- the project from scratch. Do not run it against the live project.

create table public.trees (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null unique references auth.users (id) on delete cascade, -- one tree per account
  slug       text not null unique,
  owner_name text not null,
  reveal_at  timestamptz not null,
  created_at timestamptz not null default now(),
  constraint trees_slug_fmt check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  constraint trees_owner_len check (char_length(btrim(owner_name)) between 1 and 60)
);

create table public.wishes (
  id           uuid primary key default gen_random_uuid(),
  tree_id      uuid not null references public.trees (id) on delete cascade,
  display_name text, -- null means anonymous
  message      text not null,
  created_at   timestamptz not null default now(),
  ornament     text not null default 'bow',
  circle       text not null default 'friends', -- 'friends' via a shared link, 'strangers' via the forest
  constraint wishes_message_len check (char_length(btrim(message)) between 1 and 600),
  constraint wishes_name_len check (display_name is null or char_length(display_name) <= 60),
  constraint wishes_ornament_known check (ornament in (
    'bow', 'bauble-red', 'bauble-green', 'star', 'bell', 'wreath',
    'candle', 'holly', 'candycane', 'snowflake', 'stocking', 'gift')),
  constraint wishes_circle_known check (circle in ('friends', 'strangers')),
  constraint wishes_strangers_anonymous check (circle = 'friends' or display_name is null),
  media_path   text, -- optional photo/video in the wish-media bucket, under <tree_id>/
  media_type   text,
  constraint wishes_media_kind check (
    (media_path is null and media_type is null)
    or (media_type in ('image', 'video')
        and media_path ~ ('^' || tree_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif|mp4|mov|webm|m4v)$')))
);

create index wishes_tree_idx on public.wishes (tree_id, circle, created_at);

-- Row Level Security --------------------------------------------------------

alter table public.trees enable row level security;
alter table public.wishes enable row level security;

-- A shared link must resolve to a name and an opening day.
create policy "trees are public" on public.trees
  for select to anon, authenticated
  using (true);

create policy "owner creates own tree" on public.trees
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "owner edits own tree" on public.trees
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Anyone can hang a wish, signed in or not.
create policy "anyone can add a wish" on public.wishes
  for insert to anon, authenticated
  with check (exists (select 1 from public.trees t where t.id = wishes.tree_id));

-- The seal: no row is readable before its tree's opening time, and afterwards only
-- the tree's owner can read it.
create policy "owner reads own wishes after reveal" on public.wishes
  for select to authenticated
  using (exists (
    select 1 from public.trees t
    where t.id = wishes.tree_id
      and t.owner_id = auth.uid()
      and now() >= t.reveal_at
  ));

-- Public facts about sealed wishes ------------------------------------------
-- Both are security definer on purpose: one returns a number, the other a list of
-- decoration ids. Neither returns a name or a message.

create or replace function public.wish_count(p_slug text, p_circle text default 'friends')
returns integer
language sql stable security definer
set search_path to 'public'
as $$
  select count(*)::int
  from public.wishes w join public.trees t on t.id = w.tree_id
  where t.slug = p_slug and w.circle = p_circle
$$;

create or replace function public.wish_ornaments(p_slug text, p_circle text default 'friends')
returns table (ornament text)
language sql stable security definer
set search_path to 'public'
as $$
  select w.ornament
  from public.wishes w join public.trees t on t.id = w.tree_id
  where t.slug = p_slug and w.circle = p_circle
  order by w.created_at asc
  limit 500
$$;

-- The forest: every tree's public name and link, with its total wish count.
create or replace function public.forest()
returns table (slug text, owner_name text, wishes integer, planted_at timestamptz)
language sql stable security definer
set search_path to 'public'
as $$
  select t.slug, t.owner_name, count(w.id)::int, t.created_at
  from public.trees t left join public.wishes w on w.tree_id = t.id
  group by t.id
  order by t.created_at asc
  limit 2000
$$;

revoke all on function public.wish_count(text, text) from public;
revoke all on function public.wish_ornaments(text, text) from public;
revoke all on function public.forest() from public;
grant execute on function public.wish_count(text, text) to anon, authenticated, service_role;
grant execute on function public.wish_ornaments(text, text) to anon, authenticated, service_role;
grant execute on function public.forest() to anon, authenticated, service_role;

-- Photos and videos on wishes -------------------------------------------------
-- Private bucket, 50 MB per file. Uploads land in an existing tree's folder; the
-- same seal as the words decides who may read them back.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wish-media', 'wish-media', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']);

create policy "anyone uploads wish media" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'wish-media'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif|mp4|mov|webm|m4v)$'
    and exists (select 1 from public.trees t where t.id::text = (storage.foldername(name))[1])
  );

create policy "owner reads wish media after reveal" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'wish-media'
    and exists (
      select 1 from public.trees t
      where t.id::text = (storage.foldername(name))[1]
        and t.owner_id = auth.uid()
        and now() >= t.reveal_at
    )
  );
