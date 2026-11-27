"""Browser check of the whole UI against an in-memory stand-in for Supabase.

Run:  python3 tests/e2e.py [screenshot_dir]
Needs Playwright for Python. No server and no real database: both are intercepted.
"""
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://hhanng.github.io/wish-tree/"
API = "https://tcrtkzqqcpzksjzbtiew.supabase.co"
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else None
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css"}
XSS = "<img src=x onerror=alert(1)>"
ORNS = ["bow", "bauble-red", "bauble-green", "star", "bell", "wreath",
        "candle", "holly", "candycane", "snowflake", "stocking", "gift"]


class Fake:
    def __init__(self, wishes=0, opens_in=86400 * 30):
        self.reveal = datetime.now(timezone.utc) + timedelta(seconds=opens_in)
        self.tree = {"id": "t1", "slug": "demo", "owner_name": "Hàn Hân", "owner_id": "u1"}
        self.wishes = [{"id": f"w{i:03}", "display_name": None if i % 3 == 0 else f"Friend {i}",
                        "message": XSS if i == 0 else f"Wish number {i + 1}. Chúc bạn một mùa Giáng sinh ấm áp.",
                        "ornament": ORNS[i % 12]} for i in range(wishes)]
        self.has_tree = True
        self.fail_insert = False
        self.inserts = []
        self.wish_reads = []

    def row(self):
        return {**self.tree, "reveal_at": self.reveal.isoformat()}

    def handle(self, route):
        req = route.request
        url = urlparse(req.url)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        headers = {"access-control-allow-origin": "*", "access-control-allow-headers": "*",
                   "access-control-allow-methods": "*"}

        def reply(body, status=200):
            route.fulfill(status=status, headers=headers, content_type="application/json",
                          body="" if body is None else json.dumps(body))

        if req.method == "OPTIONS":
            return reply(None)
        path = url.path
        if path == "/rest/v1/rpc/wish_count":
            return reply(len(self.wishes))
        if path == "/rest/v1/rpc/wish_ornaments":
            return reply([{"ornament": w["ornament"]} for w in self.wishes])
        if path == "/rest/v1/trees" and req.method == "GET":
            ok = self.has_tree and (q.get("slug") == "eq.demo" or q.get("owner_id") == "eq.u1")
            return reply([self.row()] if ok else [])
        if path == "/rest/v1/trees" and req.method == "POST":
            body = req.post_data_json
            if body["slug"] == "taken":
                return reply({"code": "23505", "message": 'duplicate key violates "trees_slug_key"'}, 409)
            self.has_tree = True
            self.tree.update(slug=body["slug"], owner_name=body["owner_name"])
            return reply(self.row(), 201)
        if path == "/rest/v1/wishes" and req.method == "GET":
            self.wish_reads.append(q)
            if datetime.now(timezone.utc) < self.reveal:
                return reply([])
            start, size = int(q.get("offset", 0)), int(q.get("limit", 1000))
            return reply(self.wishes[start:start + size])
        if path == "/rest/v1/wishes" and req.method == "POST":
            if self.fail_insert:
                return reply({"message": "boom"}, 500)
            body = req.post_data_json
            self.inserts.append(body)
            self.wishes.append({"id": f"w{len(self.wishes):03}", **body})
            return reply(None, 201)
        if path == "/auth/v1/otp":
            return reply({})
        return reply({"message": "unexpected " + path}, 404)


def local_file(route):
    rel = urlparse(route.request.url).path.removeprefix("/wish-tree/") or "index.html"
    file = ROOT / rel
    if not file.is_file():
        return route.fulfill(status=404, body="")
    route.fulfill(content_type=TYPES.get(file.suffix, "application/octet-stream") + "; charset=utf-8",
                  body=file.read_bytes())


def open_page(browser, fake, query="?t=demo", width=390, height=844, signed_in=False, **ctx):
    context = browser.new_context(viewport={"width": width, "height": height}, **ctx)
    context.route(SITE + "**", local_file)
    context.route(API + "/**", fake.handle)
    if signed_in:
        token = {"access_token": "x.y.z", "refresh_token": "r", "token_type": "bearer", "expires_in": 3600,
                 "expires_at": int(time.time()) + 3600, "user": {"id": "u1", "aud": "authenticated"}}
        context.add_init_script(
            f"localStorage.setItem('sb-tcrtkzqqcpzksjzbtiew-auth-token', {json.dumps(json.dumps(token))});")
    page = context.new_page()
    page.errors = []
    page.dialogs = []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and page.errors.append(m.text))
    page.on("dialog", lambda d: (page.dialogs.append(d.message), d.dismiss()))
    page.goto(SITE + query)
    return page


def shot(page, name, **kw):
    if SHOTS:
        page.wait_for_timeout(1500)
        page.screenshot(path=str(SHOTS / f"{name}.png"), **kw)


def done(page, label):
    assert not page.errors, f"{label}: {page.errors}"
    assert not page.dialogs, f"{label}: unexpected dialog {page.dialogs}"
    page.context.close()
    print("ok  ", label)


def send(page, message, name="", ornament=None):
    page.click("#wish-btn")
    page.fill("#w-name", name)
    page.fill("#w-message", message)
    if ornament:
        page.click(f".pick[data-id='{ornament}']")
    page.click("#wish-submit")


def snapshot(page):
    return page.evaluate("""() => [...document.querySelectorAll('#ornaments .slot')].map(s => s.getAttribute('transform'))
        .concat([...document.querySelectorAll('#foliage path')].map(p => p.getAttribute('d')))""")


with sync_playwright() as p:
    browser = p.chromium.launch()

    # Sealed tree, desktop
    fake = Fake(wishes=7)
    page = open_page(browser, fake, width=1100, height=1300)
    expect(page.locator("#owner-name")).to_have_text("Hàn Hân")
    expect(page).to_have_title("Hàn Hân — Wish Tree")
    expect(page.locator("#count")).to_have_text("7 wishes")
    expect(page.locator("#countdown")).to_be_visible()
    expect(page.locator("#ornaments .slot")).to_have_count(7)
    assert page.eval_on_selector_all("#ornaments .slot", "e => e.map(x => x.dataset.ornament)") == ORNS[:7]
    expect(page.locator("#ornaments [role=button]")).to_have_count(0)
    expect(page.locator("#tabs")).to_be_hidden()
    expect(page.locator("#cards")).to_be_hidden()
    assert "Wish number" not in page.content() and "Friend 1" not in page.content()
    assert fake.wish_reads == [], "sealed page must not even ask for wishes"
    before = snapshot(page)
    assert len(before) > 200
    shot(page, "sealed-desktop", full_page=True)
    page.reload()
    expect(page.locator("#ornaments .slot")).to_have_count(7)
    assert snapshot(page) == before, "positions changed across reload"
    done(page, "sealed view, picked ornaments visible, stable positions")

    # Wish form: default bow, anonymous, named, failure, eleventh wish
    fake = Fake(wishes=8)
    page = open_page(browser, fake)
    page.click("#wish-btn")
    expect(page.locator("#picker [role=radio]")).to_have_count(12)
    expect(page.locator(".pick[data-id=bow]")).to_have_attribute("aria-checked", "true")
    page.locator(".pick[data-id=bow]").focus()
    page.keyboard.press("ArrowRight")
    expect(page.locator(".pick[data-id=bauble-red]")).to_have_attribute("aria-checked", "true")
    page.keyboard.press("ArrowLeft")
    page.click("#wish-submit")
    expect(page.locator("#wish-error")).to_have_text("Write your wish first.")
    page.fill("#w-message", "hello")
    expect(page.locator("#w-count")).to_have_text("5 / 600")
    shot(page, "form-mobile")
    page.keyboard.press("Escape")
    expect(page.locator("#wish-dialog")).to_be_hidden()
    page.click("#wish-btn")
    page.mouse.click(10, 10)
    expect(page.locator("#wish-dialog")).to_be_hidden()

    fake.fail_insert = True
    send(page, "this will fail")
    expect(page.locator("#wish-error")).to_contain_text("not saved")
    expect(page.locator("#wish-done")).to_be_hidden()
    expect(page.locator("#wish-submit")).to_be_enabled()
    expect(page.locator("#ornaments .slot")).to_have_count(8)
    page.errors.clear()  # the app logs the 500 on purpose
    page.click("#wish-close")
    fake.fail_insert = False

    send(page, "  nine  ")
    expect(page.locator("#wish-done")).to_be_visible()
    expect(page.locator("#done-body")).to_contain_text("Sealed")
    assert fake.inserts[-1] == {"tree_id": "t1", "display_name": None, "message": "nine", "ornament": "bow"}
    shot(page, "done-mobile")
    page.click("#done-close")
    send(page, "ten", name="  Mai ", ornament="star")
    expect(page.locator("#wish-done")).to_be_visible()  # the insert is recorded only once this shows
    assert fake.inserts[-1]["display_name"] == "Mai" and fake.inserts[-1]["ornament"] == "star"
    page.click("#done-close")
    expect(page.locator("#tabs")).to_be_hidden()
    send(page, "eleven", ornament="gift")
    expect(page.locator("#tabs .tab")).to_have_count(2)
    expect(page.locator(".tab").nth(1)).to_have_attribute("aria-pressed", "true")
    expect(page.locator("#ornaments .slot")).to_have_count(1)
    expect(page.locator("#ornaments .slot")).to_have_attribute("data-ornament", "gift")
    expect(page.locator("#count")).to_have_text("11 wishes")
    page.click("#done-close")
    page.locator(".tab").first.click()
    expect(page.locator("#ornaments .slot")).to_have_count(10)
    assert fake.wish_reads == []
    done(page, "wish form, failure path, eleventh wish opens tree 2")

    # Revealed tree
    fake = Fake(wishes=23, opens_in=-60)
    page = open_page(browser, fake)
    expect(page.locator(".card")).to_have_count(10)
    expect(page.locator("#countdown")).to_be_hidden()
    expect(page.locator("#explain")).to_contain_text("The tree is open")
    expect(page.locator(".card .message").first).to_have_text(XSS)
    expect(page.locator("#cards img")).to_have_count(0)
    expect(page.locator(".card .from").first).to_have_text("From Anonymous")
    expect(page.locator(".card .from").nth(1)).to_have_text("From Friend 1")
    expect(page.locator("#ornaments [role=button][tabindex='0']")).to_have_count(10)
    shot(page, "open-mobile", full_page=True)
    page.locator("#ornaments .slot").nth(4).focus()
    page.keyboard.press("Enter")
    expect(page.locator("#wish-4")).to_be_focused()
    expect(page.locator("#wish-4")).to_have_class("card flash")
    page.locator("#ornaments .slot").nth(6).click()
    expect(page.locator("#wish-6")).to_be_focused()
    expect(page.locator(".tab")).to_have_count(3)
    page.locator(".tab").nth(2).click()
    expect(page.locator(".card")).to_have_count(3)
    expect(page.locator("#ornaments .slot")).to_have_count(3)
    expect(page.locator(".card .message").first).to_contain_text("Wish number 21.")
    send(page, "late one", ornament="bell")
    expect(page.locator(".card")).to_have_count(4)
    expect(page.locator("#done-body")).to_contain_text("is open")
    done(page, "revealed view, XSS literal, per-tree cards, clickable ornaments")

    # Countdown reaching zero while open
    fake = Fake(wishes=3, opens_in=3)
    page = open_page(browser, fake)
    expect(page.locator("#countdown")).to_be_visible()
    expect(page.locator(".card")).to_have_count(3, timeout=15000)
    expect(page.locator("#countdown")).to_be_hidden()
    done(page, "reveals itself without a refresh")

    # Device clock ahead of the server: stays sealed, retries
    fake = Fake(wishes=3, opens_in=7)
    fake.tree["slug"] = "demo"
    page = open_page(browser, fake, query="?t=nope")
    page.clock.set_fixed_time(datetime.now(timezone.utc) + timedelta(days=60))
    page.goto(SITE + "?t=demo")
    expect(page.locator("#explain")).to_contain_text("Opening")
    expect(page.locator("#cards")).to_be_hidden()
    page.clock.set_system_time(datetime.now(timezone.utc) + timedelta(days=60))
    expect(page.locator(".card")).to_have_count(3, timeout=25000)
    done(page, "fast device clock waits for the server")

    # 360px, reduced motion
    fake = Fake(wishes=12)
    page = open_page(browser, fake, width=360, height=740, reduced_motion="reduce")
    expect(page.locator("#snow")).to_be_hidden()
    assert page.evaluate("document.documentElement.scrollWidth") <= 360
    expect(page.locator("#wish-btn")).to_have_text("Send a wish")
    empty = page.evaluate("""() => [...document.querySelectorAll('#view-tree [data-i18n]')]
        .filter(e => !e.hidden && !e.textContent.trim()).map(e => e.dataset.i18n)""")
    assert empty == [], empty
    shot(page, "sealed-360", full_page=True)
    page.click("#wish-btn")
    assert page.evaluate("document.querySelector('dialog').scrollWidth <= 360")
    shot(page, "form-360")
    done(page, "360px, reduced motion")

    # Unknown slug and featured tree missing
    page = open_page(browser, Fake(), query="?t=nope")
    expect(page.locator("#message-title")).to_have_text("No tree here yet")
    done(page, "unknown slug")
    fake = Fake()
    fake.has_tree = False
    page = open_page(browser, fake, query="")
    expect(page.locator("#message-title")).to_have_text("Plant the first tree")
    done(page, "no featured tree yet")

    # Sign in
    page = open_page(browser, Fake(), query="?view=me&t=demo")
    expect(page.locator("#google-btn")).to_be_visible()
    expect(page.locator("#phone-block")).to_be_hidden()
    expect(page.locator("#back-link")).to_have_attribute("href", SITE + "?t=demo")
    shot(page, "signin-mobile")
    page.fill("#email", "nope")
    page.click("#email-form button")
    expect(page.locator("#signin-error")).to_have_text("Enter a valid email address.")
    page.fill("#email", "owner@example.com")
    with page.expect_request("**/auth/v1/otp**") as sent:
        page.click("#email-form button")
    assert "redirect_to=https%3A%2F%2Fhhanng.github.io%2Fwish-tree%2F%3Fview%3Dme" in sent.value.url, sent.value.url
    expect(page.locator("#email-sent-body")).to_contain_text("owner@example.com")
    done(page, "magic link request and check-your-email state")
    page = open_page(browser, Fake(), query="#error=access_denied&error_code=otp_expired")
    expect(page.locator("#signin-error")).to_contain_text("expired")
    page.errors.clear()
    done(page, "expired link message")

    # Owner: create, duplicate slug, share
    fake = Fake()
    fake.has_tree = False
    page = open_page(browser, fake, query="?view=me", signed_in=True)
    expect(page.locator("#create-form")).to_be_visible()
    page.fill("#f-name", "Hàn Hân")
    expect(page.locator("#f-slug")).to_have_value("han-han")
    assert page.evaluate("[slugify('Đặng  Thị  Ơn!'), slugify('a'.repeat(39) + ' b')]") == ["dang-thi-on", "a" * 39]
    assert page.evaluate("[nextChristmas(new Date(2026,10,25)), nextChristmas(new Date(2026,11,25,9)), nextChristmas(new Date(2026,11,31))]") \
        == ["2026-12-25", "2027-12-25", "2027-12-25"]
    shot(page, "create-mobile", full_page=True)
    page.fill("#f-date", "2020-01-01")
    page.click("#create-btn")
    expect(page.locator("#create-error")).to_have_text("Choose a day after today.")
    page.fill("#f-date", page.evaluate("nextChristmas()"))
    page.fill("#f-slug", "taken")
    page.fill("#f-name", "Someone Else")
    expect(page.locator("#f-slug")).to_have_value("taken")
    page.click("#create-btn")
    expect(page.locator("#create-error")).to_have_text("That link name is taken. Try another one.")
    page.errors.clear()  # the app logs the 409 on purpose
    page.fill("#f-slug", "mine-ok")
    page.click("#create-btn")
    expect(page.locator("#share-url")).to_have_value(SITE + "?t=mine-ok")
    expect(page.locator("#stat-count")).to_have_text("0")
    expect(page.locator("#signout-btn")).to_be_visible()
    shot(page, "mytree-mobile", full_page=True)
    done(page, "owner creates tree, duplicate slug is friendly")

    # Artwork sheet, for comparing with the reference
    if SHOTS:
        page = open_page(browser, Fake(), width=820, height=640)
        expect(page.locator("#view-tree")).to_be_visible()
        page.evaluate("""ids => { for (const s of ['main', '.topbar', '#snow']) document.querySelector(s).remove();
          document.body.style.background = '#fde0c7';
          const d = document.createElement('div'); d.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:24px';
          for (const id of ids) { const s = document.createElementNS(SVG_NS,'svg'); s.setAttribute('viewBox','-50 -50 100 100');
            s.style.width = '100%'; s.style.height = '180px'; s.append(ornamentUse(id,100)); d.append(s); }
          document.body.append(d); }""", ORNS)
        shot(page, "ornaments")
        page.context.close()

    browser.close()

for f in [ROOT / "index.html", *sorted((ROOT / "assets").iterdir())]:
    text = f.read_text()
    for banned in ("reference/", "innerHTML", "sb_secret_"):
        assert banned not in text, f"{banned} found in {f}"
print("ok   shipped files: no reference/ artwork, no innerHTML, no secret key")
print("ALL PASSED")
