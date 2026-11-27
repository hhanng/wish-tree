'use strict';

const CFG = window.WISH_TREE_CONFIG;
const PER_TREE = 10;
const ORNAMENTS = ['bow', 'bauble-red', 'bauble-green', 'star', 'bell', 'wreath', 'candle', 'holly', 'candycane', 'snowflake', 'stocking', 'gift'];
// Ten hand-placed spots inside the branches, listed in the order they fill.
const SLOTS = [[405, 668], [322, 520], [540, 750], [255, 780], [486, 535], [398, 858], [582, 935], [225, 945], [402, 418], [405, 1015]];

const STR = {
  loading: 'Loading…', retry: 'Try again', close: 'Close',
  kicker: 'The tree of', title: '{name} — Wish Tree',
  explain_sealed: 'Wishes stay sealed until opening day.',
  explain_open: 'The tree is open.',
  explain_opening: 'Opening…',
  tabs_label: 'Choose a tree', tab: 'Tree {n}', tree_label: 'Christmas tree with wishes hanging on it',
  count_zero: 'No wishes yet', count_one: '1 wish', count_many: '{n} wishes',
  countdown_label: 'Time until the tree opens', days: 'days', hours: 'hours', minutes: 'minutes', seconds: 'seconds', opens_on: 'Opens {date}',
  send_wish: 'Send a wish', copy_link: 'Copy link', copied: 'Link copied', copy_manual: 'Copy this link:', make_own: 'My tree / Create one',
  cards_label: 'Wishes on this tree', from: 'From {name}', anonymous: 'Anonymous', orn_open: 'Read the wish from {name}',
  cards_error: 'The wishes did not load. Switch tabs or refresh to try again.',
  missing_title: 'No tree here yet', missing_body: 'This link does not match any tree. Check the address, or plant your own.',
  home_empty_title: 'Plant the first tree', home_empty_body: 'Get your own tree, share its link, and let friends hang sealed wishes on it.',
  error_title: 'The tree did not load', error_body: 'Check your connection and try again.',
  w_name: 'Your name', w_name_ph: 'Blank = anonymous', w_message: 'Your wish', w_message_ph: 'Write your wish',
  w_ornament: 'Pick an ornament', hang: 'Hang it on the tree', sending: 'Hanging…',
  wish_empty: 'Write your wish first.', wish_failed: 'Your wish was not saved. Check your connection and try again.',
  done_title: 'Your wish is on the tree', done_sealed: 'Sealed until {date}.', done_open: 'The tree is open, so it can be read now.', done_close: 'Back to the tree',
  signin_title: 'Plant your tree',
  email: 'Email', send_link: 'Email me a link', sending_link: 'Sending…',
  check_email: 'Check your inbox', link_sent: 'We sent a link to {email}.',
  google: 'Continue with Google', phone: 'Phone number', send_code: 'Text me a code', code: 'Code from the text', verify_code: 'Sign in',
  bad_email: 'Enter a valid email address.', bad_phone: 'Enter the number with its country code, like +84901234567.',
  signin_failed: 'Sign-in did not go through. Try again.', rate_limited: 'Too many sign-in emails. Wait a while and try again.',
  link_expired: 'That sign-in link has expired or was already used. Ask for a new one.', back: 'Back to the tree',
  me_title: 'My tree',
  f_name: 'Your name', f_slug: 'Link name', f_date: 'Opening day', create: 'Plant my tree', creating: 'Planting…',
  bad_name: 'Enter a name, up to 60 characters.', bad_slug: 'Use 3–40 characters: a–z, 0–9 and hyphens, not starting or ending with a hyphen.',
  bad_date: 'Choose a day after today.', slug_taken: 'That link name is taken. Try another one.', create_failed: 'The tree was not created. Try again.',
  your_link: 'Your link', open_tree: 'Open my tree',
  stat_wishes: 'Wishes', stat_date: 'Opens', me_failed: 'Your tree did not load. Refresh to try again.', sign_out: 'Sign out',
  o_bow: 'Red bow', 'o_bauble-red': 'Red bauble', 'o_bauble-green': 'Green bauble', o_star: 'Star', o_bell: 'Bell', o_wreath: 'Wreath',
  o_candle: 'Candle', o_holly: 'Holly', o_candycane: 'Candy cane', o_snowflake: 'Snowflake', o_stocking: 'Stocking', o_gift: 'Gift',
};

/* ---------- small helpers ---------- */

const $ = (id) => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';
const params = new URLSearchParams(location.search);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Derived from the current path so a GitHub Pages subpath (/wish-tree/) works.
const BASE = location.origin + location.pathname.replace(/index\.html$/, '');
const treeUrl = (slug) => `${BASE}?t=${encodeURIComponent(slug)}`;

function t(key, vars = {}) {
  // Single pass: braces inside a stranger's name are never expanded again.
  return (STR[key] ?? key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

const formatDate = (iso) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

// Every visible string goes through these two. vars.date and vars.nameKey are resolved at paint time.
function paint(el) {
  const { i18n, i18nPh, i18nLabel, date } = el.dataset;
  const vars = { ...el.i18nVars };
  if (vars.date) vars.date = formatDate(vars.date);
  if (vars.nameKey) vars.name = t(vars.nameKey);
  if (i18n) el.textContent = t(i18n, vars);
  if (i18nPh) el.placeholder = t(i18nPh);
  if (i18nLabel) el.setAttribute('aria-label', t(i18nLabel, vars));
  if (date) el.textContent = formatDate(date);
}
function setText(el, key, vars) {
  el.dataset.i18n = key;
  el.i18nVars = vars;
  paint(el);
  el.hidden = false;
}
function applyText() {
  document.querySelectorAll('[data-i18n],[data-i18n-ph],[data-i18n-label],[data-date]').forEach(paint);
  if (state.tree) document.title = t('title', { name: state.tree.owner_name });
}

function show(id) {
  for (const v of ['view-tree', 'view-signin', 'view-me', 'view-message']) $(v).hidden = v !== id;
  $('loading').hidden = true;
}

function showMessage(titleKey, bodyKey, retry) {
  setText($('message-title'), titleKey);
  setText($('message-body'), bodyKey);
  $('message-retry').hidden = !retry;
  show('view-message');
}

async function copyLink(url, button) {
  try {
    await navigator.clipboard.writeText(url);
    setText(button, 'copied');
    setTimeout(() => setText(button, 'copy_link'), 2000);
  } catch {
    window.prompt(t('copy_manual'), url);
  }
}

// Disables a submit button and swaps its label while a request is in flight.
async function busy(button, busyKey, task) {
  const idle = button.dataset.i18n;
  button.disabled = true;
  setText(button, busyKey);
  try { return await task(); } finally {
    button.disabled = false;
    setText(button, idle);
  }
}

function slugify(name) {
  return name.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 40).replace(/-+$/, '');
}
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// The next 25 December that is still in the future (on the 25th itself, next year's).
function nextChristmas(now = new Date()) {
  const thisYear = new Date(now.getFullYear(), 11, 25);
  return isoDay(thisYear > now ? thisYear : new Date(now.getFullYear() + 1, 11, 25));
}
function timeParts(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
}
const treeCount = (wishes) => Math.max(1, Math.ceil(wishes / PER_TREE));

/* ---------- the painted fir ---------- */

function seeded(seed) { // mulberry32: same tree on every load
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Silhouette traced as [y, x] points down each side, plus [x, y] along the hem.
const LEFT = [[240, 392], [305, 366], [355, 322], [405, 298], [480, 270], [532, 232], [575, 268], [655, 214], [705, 198], [760, 138], [800, 188], [875, 190], [940, 122], [1030, 88], [1065, 76], [1095, 150]];
const RIGHT = [[240, 404], [305, 452], [355, 496], [410, 496], [455, 548], [508, 602], [540, 560], [580, 608], [640, 606], [705, 650], [765, 668], [810, 640], [870, 676], [945, 678], [1005, 708], [1055, 736], [1095, 668]];
const HEM = [[85, 1058], [200, 1086], [330, 1074], [460, 1094], [620, 1112], [732, 1058]];

function lerp(points, v) {
  if (v <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = points[i];
    if (v <= a) {
      const [pa, pb] = points[i - 1];
      return pb + ((v - pa) / (a - pa)) * (b - pb);
    }
  }
  return points[points.length - 1][1];
}

// One tapered dry-brush mark from (x, y) along `angle`, with a soft ragged outline.
function brushPath(rand, x, y, angle, len, width) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const bend = (rand() - 0.5) * width * 0.7;
  const profile = [[0, 0.3], [0.07, 0.72], [0.2, 0.95], [0.38, 1], [0.55, 0.9], [0.72, 0.68], [0.87, 0.42], [1, 0.05]];
  const side = (sign) => profile.map(([at, w]) => {
    const half = (w * width) / 2 + (rand() - 0.5) * width * 0.24;
    const off = sign * half + Math.sin(at * Math.PI) * bend;
    const along = at * len + (rand() - 0.5) * 5;
    return [x + dx * along - dy * off, y + dy * along + dx * off];
  });
  const pts = side(1).concat(side(-1).reverse());
  const f = (n) => n.toFixed(1);
  const mid = (i) => {
    const [ax, ay] = pts[i % pts.length], [bx, by] = pts[(i + 1) % pts.length];
    return `${f((ax + bx) / 2)} ${f((ay + by) / 2)}`;
  };
  return `M${mid(0)}${pts.map((_, i) => { const [px, py] = pts[(i + 1) % pts.length]; return `Q${f(px)} ${f(py)} ${mid(i + 1)}`; }).join('')}Z`;
}

function paintTree(group) {
  const rand = seeded(2512);
  const between = (a, b) => a + rand() * (b - a);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const DEEP = ['#2f5a16', '#33601a', '#284d11', '#38641d'];
  const SAGE = ['#65863f', '#6d8e49', '#577935'];
  const add = (d, fill, opacity = 1) => {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', fill);
    if (opacity < 1) p.setAttribute('fill-opacity', opacity.toFixed(2));
    group.append(p);
  };
  // A stroke that droops down and away from the trunk and ends at (ex, ey).
  const droop = (ex, ey, side, len, width, fill, opacity, steep = between(0.55, 1)) => {
    const angle = side > 0 ? steep : Math.PI - steep;
    add(brushPath(rand, ex - Math.cos(angle) * len, ey - Math.sin(angle) * len, angle, len, width), fill, opacity);
  };
  // Calls paint(x, y, side) on a jittered, staggered grid inside the silhouette, top to bottom.
  const scatter = (top, rowGap, colGap, inset, paint) => {
    for (let y = top, row = 0; y <= 1065; y += rowGap, row++) {
      const lo = lerp(LEFT, y) + inset, hi = lerp(RIGHT, y) - inset;
      const n = Math.max(1, Math.round((hi - lo) / colGap));
      for (let i = 0; i < n; i++) {
        const x = lo + ((i + 0.5 + (row % 2 ? 0.28 : -0.28) + between(-0.22, 0.22)) / n) * (hi - lo);
        paint(x, y + between(-10, 10), x + between(-45, 45) < 400 ? -1 : 1);
      }
    }
  };

  // 1. Sage underpainting, kept inside the outline so the edges stay open.
  const under = [];
  for (let y = 300; y <= 1040; y += 22) under.push(`${(lerp(LEFT, y) + between(20, 48)).toFixed(0)} ${y}`);
  under.push('200 1048', '330 1028', '460 1055', '610 1062');
  for (let y = 1040; y >= 300; y -= 22) under.push(`${(lerp(RIGHT, y) - between(20, 48)).toFixed(0)} ${y}`);
  add(`M397 262L${under.join('L')}Z`, '#5d7e3a');

  // 2. Broad, quiet sage marks give the body its grain.
  scatter(320, 42, 78, 34, (x, y, side) => {
    const len = Math.min(between(80, 135), 24 + (y - 240) * 0.55);
    droop(x, y + 28, side, len, len * between(0.2, 0.3), pick(SAGE), between(0.65, 0.9), between(0.75, 1.15));
  });

  // 3. Deep branches along both sides, poking past the outline with gaps between them.
  for (let y = 268; y <= 1080; y += 15) {
    for (const [side, edge] of [[-1, LEFT], [1, RIGHT]]) {
      const x = lerp(edge, y);
      const len = Math.min(between(62, 125), 20 + (y - 240) * 0.6);
      droop(x + side * between(-8, 18), y + between(-6, 14), side, len, len * between(0.17, 0.25), pick(DEEP), between(0.92, 1));
      droop(x - side * between(18, 40), y + between(2, 22), side, len * 0.9, len * 0.2, pick(DEEP), 0.95);
    }
  }
  // The longest bough at the tip of each tier.
  for (const [side, x, y] of [[-1, 262, 548], [-1, 204, 716], [-1, 164, 884], [-1, 70, 1070], [1, 540, 365], [1, 636, 560], [1, 700, 772], [1, 750, 1050]]) {
    droop(x, y, side, 105, 23, pick(DEEP), 1, between(0.38, 0.6));
    droop(x - side * 14, y + 18, side, 80, 17, pick(DEEP), 0.95, between(0.45, 0.7));
  }

  // 4. Separate forest-green strokes laid over the sage.
  scatter(345, 62, 84, 48, (x, y, side) => {
    const len = between(82, 132);
    droop(x + side * 18, y + 44, side, len, len * between(0.17, 0.23), pick(DEEP), between(0.88, 1), between(0.78, 1.18));
    if (rand() < 0.55) droop(x - side * 22, y + 20, side, len * 0.6, len * 0.09, pick(DEEP), 0.8, between(0.8, 1.15));
  });

  // 5. The ragged hem.
  for (let x = 98; x <= 728; x += 15) {
    const side = x < 400 ? -1 : 1;
    const len = between(55, 108);
    droop(x + side * between(0, 18), lerp(HEM, x) + between(-26, 22), side, len, len * between(0.18, 0.26), pick(rand() < 0.2 ? SAGE : DEEP), between(0.9, 1), between(0.35, 0.85));
  }

  // 6. Dry-brush grain: loose flecks outside the edge, pale scratches inside.
  for (let i = 0; i < 130; i++) {
    const y = between(330, 1085);
    const side = rand() < 0.5 ? -1 : 1;
    droop(lerp(side < 0 ? LEFT : RIGHT, y) + side * between(-4, 24), y, side, between(10, 26), between(3, 6), pick(DEEP), between(0.55, 0.9));
  }
  scatter(400, 55, 70, 60, (x, y, side) => droop(x + between(-30, 30), y, side, between(18, 44), between(2.5, 5), '#8aa866', between(0.35, 0.65)));
}

/* ---------- tree view ---------- */

const state = { tree: null, count: 0, ornaments: [], page: 0, open: false, opening: false, retryAt: 0, rows: new Map() };
let db;

const ornamentId = (id) => (ORNAMENTS.includes(id) ? id : 'bow'); // database text never reaches href unchecked

function ornamentUse(id, size) {
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#o-${id}`);
  use.setAttribute('color', '#b52824');
  for (const [k, v] of Object.entries({ x: -size / 2, y: -size / 2, width: size, height: size })) use.setAttribute(k, v);
  return use;
}

async function loadSealed() {
  const slug = state.tree.slug;
  const [count, ornaments] = await Promise.all([
    db.rpc('wish_count', { p_slug: slug }),
    db.rpc('wish_ornaments', { p_slug: slug }),
  ]);
  if (count.error || ornaments.error) throw count.error || ornaments.error;
  // shortcut: wish_ornaments returns at most 500 rows; later wishes hang as bows until the tree opens.
  state.ornaments = (ornaments.data || []).map((o) => (typeof o === 'string' ? o : o.ornament));
  state.count = Math.max(count.data || 0, state.ornaments.length);
}

// Only ever called once the opening time has passed; Row Level Security is what actually enforces it.
async function fetchRows(page) {
  const from = page * PER_TREE;
  const { data, error } = await db.from('wishes').select('id,display_name,message,ornament')
    .eq('tree_id', state.tree.id).order('created_at').order('id').range(from, from + PER_TREE - 1);
  if (error) throw error;
  return data;
}

async function openTree() {
  state.opening = true;
  setText($('explain'), 'explain_opening');
  try {
    await loadSealed();
    state.page = Math.min(state.page, treeCount(state.count) - 1);
    const rows = await fetchRows(state.page);
    // A fast device clock: the server still says sealed, so wait and ask again.
    if (state.count > 0 && rows.length === 0) throw new Error('still sealed');
    state.rows.set(state.page, rows);
    state.open = true;
    renderTree({ pop: 'all', animateCards: true });
  } catch (err) {
    console.warn('Tree not open yet:', err.message);
    state.retryAt = Date.now() + 4000;
  } finally {
    state.opening = false;
  }
}

function tick() {
  if (!state.tree || state.open) return;
  const left = new Date(state.tree.reveal_at) - Date.now();
  const [d, h, m, s] = timeParts(left);
  $('cd-d').textContent = d;
  $('cd-h').textContent = pad(h);
  $('cd-m').textContent = pad(m);
  $('cd-s').textContent = pad(s);
  if (left <= 0 && !state.opening && Date.now() >= state.retryAt) openTree();
}

async function goToPage(page, options = { pop: 'all', animateCards: true }) {
  state.page = page;
  const missing = state.open && !state.rows.has(page);
  renderTree(missing ? {} : options); // animate once, when everything is there
  if (!missing) return;
  try {
    state.rows.set(page, await fetchRows(page));
    if (state.page === page) renderTree(options);
  } catch (err) {
    console.error(err);
    if (state.page === page) setText($('cards-status'), 'cards_error');
  }
}

// Buttons are only rebuilt when the number of trees changes, so keyboard focus survives.
function renderTabs() {
  const pages = treeCount(state.count);
  const tabs = $('tabs');
  tabs.hidden = pages < 2;
  if (tabs.children.length !== pages) {
    tabs.replaceChildren(...Array.from({ length: pages }, (_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      setText(b, 'tab', { n: i + 1 });
      b.addEventListener('click', () => goToPage(i));
      return b;
    }));
  }
  [...tabs.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.page)));
}

function focusCard(index) {
  const card = $(`wish-${index}`);
  if (!card) return;
  card.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
  card.focus({ preventScroll: true });
  card.classList.remove('flash');
  void card.offsetWidth; // restart the flash animation
  card.classList.add('flash');
}

// pop: 'all', a slot index, or null.
function renderTree({ pop = null, animateCards = false } = {}) {
  const rows = state.open ? state.rows.get(state.page) : null;
  const first = state.page * PER_TREE;
  const hanging = Math.min(PER_TREE, Math.max(0, state.count - first, rows?.length ?? 0));

  $('ornaments').replaceChildren(...Array.from({ length: hanging }, (_, i) => {
    const row = rows?.[i];
    const id = ornamentId(row ? row.ornament : state.ornaments[first + i]);
    const [x, y] = SLOTS[i];
    const slot = document.createElementNS(SVG_NS, 'g');
    slot.setAttribute('transform', `translate(${x} ${y}) rotate(${(i % 3 - 1) * 6})`);
    slot.setAttribute('class', 'slot');
    slot.dataset.ornament = id;
    const art = document.createElementNS(SVG_NS, 'g');
    art.setAttribute('class', pop === 'all' || pop === i ? 'orn pop' : 'orn');
    if (pop === 'all') art.style.animationDelay = `${i * 55}ms`;
    art.append(ornamentUse(id, 114));
    slot.append(art);
    if (row) {
      const hit = document.createElementNS(SVG_NS, 'circle');
      hit.setAttribute('r', '56');
      hit.setAttribute('class', 'hit');
      slot.append(hit);
      slot.setAttribute('role', 'button');
      slot.setAttribute('tabindex', '0');
      slot.dataset.i18nLabel = 'orn_open';
      slot.i18nVars = row.display_name ? { name: row.display_name } : { nameKey: 'anonymous' };
      paint(slot);
      slot.addEventListener('click', () => focusCard(i));
      slot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusCard(i); }
      });
    }
    return slot;
  }));

  renderTabs();
  setText($('count'), state.count === 0 ? 'count_zero' : state.count === 1 ? 'count_one' : 'count_many', { n: state.count });
  setText($('explain'), state.open ? 'explain_open' : 'explain_sealed');
  $('countdown').hidden = state.open;
  if (state.open) $('opens').hidden = true;
  else setText($('opens'), 'opens_on', { date: state.tree.reveal_at });
  $('cards-status').hidden = true;

  const cards = $('cards');
  cards.hidden = !rows?.length;
  cards.classList.toggle('animate', animateCards);
  cards.replaceChildren(...(rows || []).map((row, i) => {
    const li = document.createElement('li');
    li.id = `wish-${i}`;
    li.className = 'card';
    li.tabIndex = -1;
    li.style.animationDelay = `${Math.min(i, 8) * 70}ms`;
    const message = document.createElement('p');
    message.className = 'message';
    message.textContent = row.message;
    const from = document.createElement('p');
    from.className = 'from';
    setText(from, 'from', row.display_name ? { name: row.display_name } : { nameKey: 'anonymous' });
    li.append(message, from);
    return li;
  }));
}

/* ---------- wish form ---------- */

let chosen = 'bow';

function chooseOrnament(id, focus) {
  chosen = id;
  for (const b of $('picker').children) {
    const on = b.dataset.id === id;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  }
}

function setupWishForm() {
  const dialog = $('wish-dialog'), form = $('wish-form'), message = $('w-message');
  $('picker').append(...ORNAMENTS.map((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.id = id;
    b.dataset.i18nLabel = `o_${id}`;
    b.setAttribute('role', 'radio');
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '-50 -50 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.append(ornamentUse(id, 100));
    b.append(svg);
    b.addEventListener('click', () => chooseOrnament(id));
    return b;
  }));
  $('picker').addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const n = ORNAMENTS.length;
    chooseOrnament(ORNAMENTS[(ORNAMENTS.indexOf(chosen) + step + n) % n], true);
  });
  chooseOrnament('bow');

  const counter = () => { $('w-count').textContent = `${message.value.length} / 600`; };
  message.addEventListener('input', counter);

  $('wish-btn').addEventListener('click', () => {
    if (!$('wish-done').hidden) { // previous wish was sent: start a fresh one
      form.reset();
      counter();
      chooseOrnament('bow');
      $('wish-done').hidden = true;
      form.hidden = false;
    }
    $('wish-error').hidden = true;
    dialog.showModal();
  });
  $('wish-close').addEventListener('click', () => dialog.close());
  $('done-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // backdrop

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = $('wish-submit');
    if (button.disabled) return;
    const wish = {
      tree_id: state.tree.id,
      display_name: $('w-name').value.trim() || null,
      message: message.value.trim(),
      ornament: chosen,
    };
    if (!wish.message) { setText($('wish-error'), 'wish_empty'); message.focus(); return; }
    $('wish-error').hidden = true;
    const ok = await busy(button, 'sending', async () => {
      try {
        // No .select(): the row is unreadable until the tree opens.
        const { error } = await db.from('wishes').insert(wish);
        if (error) console.error(error);
        return !error;
      } catch (err) {
        console.error(err);
        return false;
      }
    });
    if (!ok) { setText($('wish-error'), 'wish_failed'); return; }

    const index = state.count;
    state.ornaments[index] = wish.ornament;
    state.count += 1;
    const page = Math.floor(index / PER_TREE), slot = index % PER_TREE;
    if (state.open) {
      const rows = state.rows.get(page);
      if (rows) { if (rows.length < PER_TREE) rows.push(wish); } else if (slot === 0) state.rows.set(page, [wish]);
    }
    goToPage(page, { pop: slot });

    form.hidden = true;
    $('done-use').setAttribute('href', `#o-${wish.ornament}`);
    setText($('done-body'), state.open ? 'done_open' : 'done_sealed', { date: state.tree.reveal_at });
    $('wish-done').hidden = false;
    $('done-title').focus();
  });
}

async function treeView() {
  const slug = (params.get('t') || CFG.FEATURED_SLUG || '').toLowerCase();
  const { data, error } = await db.from('trees').select('id,slug,owner_name,reveal_at').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) {
    if (params.get('t')) showMessage('missing_title', 'missing_body');
    else showMessage('home_empty_title', 'home_empty_body');
    return;
  }
  state.tree = data;
  await loadSealed();

  document.title = t('title', { name: data.owner_name });
  $('owner-name').textContent = data.owner_name;
  $('make-link').href = `?view=me&t=${encodeURIComponent(data.slug)}`;
  $('copy-btn').addEventListener('click', () => copyLink(treeUrl(data.slug), $('copy-btn')));
  paintTree($('foliage'));
  setupWishForm();

  const due = new Date(data.reveal_at) <= Date.now();
  renderTree({ pop: due ? null : 'all' });
  applyText();
  show('view-tree');
  tick();
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', tick);
}

/* ---------- sign in + my tree ---------- */

function signInView(linkFailed) {
  const redirect = `${BASE}?view=me`;
  const errorBox = $('signin-error');
  const fail = (error) => {
    console.error(error);
    setText(errorBox, error?.status === 429 ? 'rate_limited' : 'signin_failed');
  };
  if (linkFailed) setText(errorBox, 'link_expired');
  if (params.get('t')) $('back-link').href = treeUrl(params.get('t'));

  if (CFG.ENABLE_EMAIL) $('email-form').hidden = false;

  $('email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('email'), email = input.value.trim();
    if (!email || !input.checkValidity()) { setText(errorBox, 'bad_email'); return; }
    errorBox.hidden = true;
    const { error } = await busy(e.submitter, 'sending_link', () =>
      db.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } }));
    if (error) return fail(error);
    $('email-form').hidden = true;
    setText($('email-sent-body'), 'link_sent', { email });
    $('email-sent').hidden = false;
  });

  if (CFG.ENABLE_GOOGLE) {
    $('google-btn').hidden = false;
    // With no email form above it, Google is the main action, not an alternative.
    if (!CFG.ENABLE_EMAIL) $('google-btn').classList.replace('btn-glass', 'btn-primary');
    $('google-btn').addEventListener('click', async () => {
      const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } });
      if (error) fail(error);
    });
  }

  if (CFG.ENABLE_PHONE) {
    $('phone-block').hidden = false;
    let phone = '';
    $('phone-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      phone = $('phone').value.replace(/[\s().-]/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) { setText(errorBox, 'bad_phone'); return; }
      errorBox.hidden = true;
      const { error } = await busy(e.submitter, 'sending_link', () => db.auth.signInWithOtp({ phone }));
      if (error) return fail(error);
      $('otp-form').hidden = false;
      $('otp').focus();
    });
    $('otp-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await busy(e.submitter, 'sending_link', () =>
        db.auth.verifyOtp({ phone, token: $('otp').value.trim(), type: 'sms' }));
      if (error) return fail(error);
      location.assign(redirect);
    });
  }
  show('view-signin');
}

async function showMyTree(tree) {
  const url = treeUrl(tree.slug);
  $('create-form').hidden = true;
  $('my-tree').hidden = false;
  $('share-url').value = url;
  $('share-open').href = url;
  $('stat-date').dataset.date = tree.reveal_at;
  paint($('stat-date'));
  $('share-url').addEventListener('focus', (e) => e.target.select());
  $('share-copy').addEventListener('click', () => copyLink(url, $('share-copy')));
  const { data, error } = await db.rpc('wish_count', { p_slug: tree.slug });
  if (!error) $('stat-count').textContent = data;
}

function setupCreateForm(user) {
  const name = $('f-name'), slug = $('f-slug'), date = $('f-date'), errorBox = $('create-error');
  let slugTouched = false;
  const preview = () => { $('slug-preview').textContent = treeUrl(slug.value || '…'); };
  name.addEventListener('input', () => {
    if (slugTouched) return;
    const s = slugify(name.value);
    slug.value = s.length > 0 && s.length < 3 ? `${s}-tree` : s;
    preview();
  });
  slug.addEventListener('input', () => {
    slugTouched = true;
    slug.value = slug.value.toLowerCase();
    preview();
  });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  date.min = isoDay(tomorrow);
  date.value = nextChristmas();
  preview();
  $('create-form').hidden = false;

  $('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = $('create-btn');
    if (button.disabled) return;
    const ownerName = name.value.trim();
    const revealAt = new Date(`${date.value}T00:00:00`); // midnight, owner's local time
    const problem = !ownerName ? 'bad_name' : !SLUG_RE.test(slug.value) ? 'bad_slug' : !(revealAt > new Date()) ? 'bad_date' : null;
    if (problem) { setText(errorBox, problem); return; }
    errorBox.hidden = true;
    const { data, error } = await busy(button, 'creating', () => db.from('trees')
      .insert({ owner_id: user.id, slug: slug.value, owner_name: ownerName, reveal_at: revealAt.toISOString() })
      .select().single());
    if (!error) return showMyTree(data);
    console.error(error);
    if (error.code === '23505' && /owner_id/.test(error.message)) location.reload(); // planted in another tab
    else setText(errorBox, error.code === '23505' ? 'slug_taken' : 'create_failed');
  });
}

async function meView(linkFailed) {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return signInView(linkFailed);
  $('signout-btn').addEventListener('click', async () => {
    await db.auth.signOut({ scope: 'local' });
    location.assign(`${BASE}?view=me`);
  });
  show('view-me');
  const { data, error } = await db.from('trees').select('*').eq('owner_id', session.user.id).maybeSingle();
  if (error) { console.error(error); setText($('me-error'), 'me_failed'); return; }
  if (data) await showMyTree(data);
  else setupCreateForm(session.user);
}

/* ---------- snow ---------- */

function startSnow() {
  const canvas = $('snow'), ctx = canvas.getContext('2d');
  let flakes = [], w = 0, h = 0, frame = 0, last = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function draw(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    for (const f of flakes) {
      f.y += f.speed * dt;
      f.phase += dt * 0.8;
      f.x += Math.sin(f.phase) * f.sway * dt;
      if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
      f.x = (f.x + w) % w;
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, 7);
      ctx.fill();
    }
    frame = requestAnimationFrame(draw);
  }
  function sync() {
    cancelAnimationFrame(frame);
    ctx.clearRect(0, 0, w, h);
    canvas.hidden = reducedMotion.matches;
    if (reducedMotion.matches) return;
    flakes = Array.from({ length: w < 600 ? 100 : 140 }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.9,
      speed: 14 + Math.random() * 30, sway: 6 + Math.random() * 16, phase: Math.random() * 7, alpha: 0.25 + Math.random() * 0.55,
    }));
    last = performance.now();
    frame = requestAnimationFrame(draw);
  }
  addEventListener('resize', resize);
  reducedMotion.addEventListener('change', sync);
  resize();
  sync();
}

/* ---------- boot ---------- */

async function main() {
  startSnow();
  $('home-link').href = BASE;
  $('message-retry').addEventListener('click', () => location.reload());
  applyText();
  // Read before createClient(), which consumes the URL fragment. A magic link that falls back
  // to the site root (no ?view=me) must still land on the owner's page.
  const linkFailed = /[#&]error(_code|_description)?=/.test(location.hash);
  const fromLink = linkFailed || /[#&]access_token=/.test(location.hash);
  try {
    db = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, { auth: { flowType: 'implicit' } });
    if (params.get('view') === 'me' || fromLink) await meView(linkFailed);
    else await treeView();
  } catch (err) {
    console.error(err);
    showMessage('error_title', 'error_body', true);
  }
}

main();
