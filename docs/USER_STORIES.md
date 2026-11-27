# Wish Tree — user stories

Three people use Wish Tree:

- **Owner**: has a tree, signs in, shares the link, reads the wishes on opening day.
- **Visitor**: opens a shared link, usually on a phone, and hangs a wish. Never signs in.
- **Anyone else**: someone who tries to read wishes early, by hand or through the API.

Each story ends with acceptance criteria. "Sealed" means before the tree's `reveal_at`.

---

## Owner

### O1. Sign in without a password
As an owner, I want to sign in with a link sent to my email, so I don't need another password.

- Entering an email sends a magic link; the page then says "Check your inbox" and names the address.
- An invalid email shows "Enter a valid email address." and sends nothing.
- An expired or used link brings me back to sign in with a message saying so.
- Google and phone code buttons appear only when `ENABLE_GOOGLE` / `ENABLE_PHONE` are on.

### O2. Plant my tree
As an owner, I want to create my tree with my name, a link name and an opening day, so I have something to share.

- The link name fills in from my name, without Vietnamese accents (`Hàn Hân` → `han-han`), until I edit it myself.
- The opening day defaults to the next 25 December. A day that is not in the future is refused.
- A link name that is taken shows "That link name is taken. Try another one."
- One account has one tree.

### O3. Share my tree
As an owner, I want my link in one tap, so I can paste it into a group chat.

- My page shows the full link, a Copy link button, an Open my tree link, the wish count and the opening date.
- Copy link confirms with "Link copied".

### O4. Watch the tree fill without reading it
As an owner, I want to see how many wishes and which ornaments arrived, without reading them, so the opening stays a surprise.

- The count and the ornaments show before the opening day; names and messages do not.
- Signed in as the owner, I still cannot read any wish while it is sealed.

### O5. Open the tree on the day
As an owner, I want every wish to appear on opening day, so I can read them all at once.

- After `reveal_at`, every wish shows as a card: the message, and "From <name>" or "From Anonymous".
- If the page is open when the countdown reaches zero, the tree opens without a refresh.
- Tapping or pressing Enter on an ornament scrolls to its card and highlights it.

---

## Visitor

### V1. Open a friend's tree
As a visitor, I want to open a link and see my friend's tree right away, so I know what this is.

- No sign-in, no pop-up. The page shows "The tree of <name>", the tree, the wish count and a countdown.
- A link to a tree that does not exist says so and offers to make one.

### V2. Hang a wish
As a visitor, I want to write a wish, choose an ornament and hang it, so my friend reads it on the day.

- Name is optional; blank means anonymous.
- The message is required, up to 600 characters, with a live counter.
- The red bow is chosen unless I pick one of the other eleven ornaments.
- While sending, the button is disabled and says "Hanging…".
- On success my ornament pops onto the tree and I'm told the wish is sealed until the opening date.
- On failure I see "Your wish was not saved…" and nothing is added to the tree.

### V3. See my ornament land
As a visitor, I want to see where my ornament went, even when the first tree is full.

- One tree holds ten ornaments. The eleventh wish starts Tree 2, and so on.
- Tabs (Tree 1, Tree 2, …) appear once there is more than one tree.
- After sending, the page switches to the tree that holds my wish.

### V4. Use it my way
As a visitor, I want the page usable on my phone.

- The page is in English.
- Everything works at 360px wide, by keyboard, and with reduced motion (no snow, no animation).

---

## Anyone else

### S1. The seal holds
As a tree owner's friend, I want my wish to stay private until the opening day, even from people who know how the site works.

- Before `reveal_at`, `GET /rest/v1/wishes` with the public key returns `[]`.
- The only public facts about sealed wishes are the count and the list of ornaments.
- The check runs on the database clock; changing a phone's clock reveals nothing.

### S2. A wish can't attack the page
As an owner, I want a hostile wish to show as plain text.

- A wish containing `<img src=x onerror=alert(1)>` shows those characters and runs nothing.

### S3. Trees stay separate
As an owner, I want only my tree's wishes on my tree.

- Two accounts get two trees at two links; neither shows the other's wishes or counts.

---

## Known gaps

- An owner who calls the API with their own session can move `reveal_at` earlier and read early.
- No rate limit on wishes.
- Supabase's default email sender is for testing; a custom SMTP is needed before real use.
