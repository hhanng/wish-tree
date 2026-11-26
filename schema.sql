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
  constraint wishes_message_len check (char_length(btrim(message)) between 1 and 600),
  constraint wishes_name_len check (display_name is null or char_length(display_name) <= 60),
  constraint wishes_ornament_known check (ornament in (
    'bow', 'bauble-red', 'bauble-green', 'star', 'bell', 'wreath',
    'candle', 'holly', 'candycane', 'snowflake', 'stocking', 'gift'))
);

create index wishes_tree_idx on public.wishes (tree_id, created_at);

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

-- The seal: no row is readable before its tree's opening time.
create policy "wishes readable only after reveal" on public.wishes
  for select to anon, authenticated
  using (exists (
    select 1 from public.trees t
    where t.id = wishes.tree_id and now() >= t.reveal_at
  ));

-- Public facts about sealed wishes ------------------------------------------
-- Both are security definer on purpose: one returns a number, the other a list of
-- decoration ids. Neither returns a name or a message.

create or replace function public.wish_count(p_slug text)
returns integer
language sql stable security definer
set search_path to 'public'
as $$
  select count(*)::int
  from public.wishes w join public.trees t on t.id = w.tree_id
  where t.slug = p_slug
$$;

create or replace function public.wish_ornaments(p_slug text)
returns table (ornament text)
language sql stable security definer
set search_path to 'public'
as $$
  select w.ornament
  from public.wishes w
  join public.trees t on t.id = w.tree_id
  where t.slug = p_slug
  order by w.created_at asc
  limit 500
$$;

revoke all on function public.wish_count(text) from public;
revoke all on function public.wish_ornaments(text) from public;
grant execute on function public.wish_count(text) to anon, authenticated, service_role;
grant execute on function public.wish_ornaments(text) to anon, authenticated, service_role;
