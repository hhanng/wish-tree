# Wish Tree

A Christmas tree of sealed wishes. You sign in once and get your own tree at your own
link. Friends open it and hang a wish, with their name or anonymously, without making an
account. They pick an ornament and watch it appear on the tree. Nobody can read the wishes
until the opening day you chose (Christmas Day by default), when the tree opens and shows
them all.

**Live:** https://hhanng.github.io/wish-tree/

## How the secret holds

The page does not hide wishes. The database refuses to return them. This is the Row Level
Security policy that does it:

```sql
create policy "wishes readable only after reveal" on public.wishes
  for select to anon, authenticated
  using (exists (
    select 1 from public.trees t
    where t.id = wishes.tree_id and now() >= t.reveal_at
  ));
```

Before the opening time, `select * from wishes` returns zero rows to every visitor, to the
signed-in owner, and to anyone calling the REST API by hand with the public key. The check
uses the database clock, so changing the clock on a phone does nothing. Try it:

```bash
curl "https://tcrtkzqqcpzksjzbtiew.supabase.co/rest/v1/wishes?select=*" -H "apikey: sb_publishable_3r4X8t2uCC0Aw6tFJsEoig_2LsCQ6QR"
```

Rows come back only for trees whose opening time has passed.

The key above is meant to be public. It only identifies the project; the policies decide
what it may do.

What is public while a tree is sealed, through two `security definer` functions:

| Function | Returns |
|---|---|
| `wish_count(slug)` | how many wishes hang on the tree |
| `wish_ornaments(slug)` | which ornament each wish picked, in order |

Neither returns a name or a message.

### Known limits

- The seal depends on `reveal_at`, and the policy "owner edits own tree" lets an owner
  update their own row. The app offers no control for this, but an owner who calls the API
  with their own session could move the date earlier and read early. Visitors cannot.
- Anyone with a link can add wishes, and there is no rate limit.
- The project administrator can read the database directly.

The full schema is in [schema.sql](schema.sql).

## Run it locally

Static files, no build step.

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. `?t=<slug>` shows a tree, `?view=me` is the owner's page.
Without `?t=`, the page shows `FEATURED_SLUG` from [assets/config.js](assets/config.js).
For magic links to return to localhost, add `http://localhost:8000/**` to the Supabase
redirect URLs.

## Configuration

`assets/config.js` holds the project URL, the publishable key and the sign-in flags.

| Sign-in | To enable |
|---|---|
| Email magic link | on by default. Supabase's built-in mail sender is for testing only; set up custom SMTP so other people can sign in |
| Google | create OAuth credentials, enable Google under Supabase → Authentication → Providers, set `ENABLE_GOOGLE: true` |
| Phone SMS code | configure a paid SMS provider in Supabase, set `ENABLE_PHONE: true` |

In Supabase → Authentication → URL Configuration, set the site URL to the deployed address
and add `https://hhanng.github.io/wish-tree/**` to the redirect URLs.

## Files

| Path | What it is |
|---|---|
| `index.html` | markup and the twelve ornament drawings (SVG symbols) |
| `assets/app.js` | strings in Vietnamese and English, the painted tree, all screens |
| `assets/style.css` | styling |
| `schema.sql` | reference copy of the database |
| `docs/USER_STORIES.md` | who uses the app and what each of them must be able to do |
| `tests/e2e.py` | browser test against a fake backend: `python3 tests/e2e.py` (needs Playwright for Python) |
| `reference/` | notes on the style references |

All artwork on the site is drawn in code for this project.
