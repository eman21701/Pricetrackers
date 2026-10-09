const apiBase = "http://127.0.0.1:3000";
const SEARCH_CACHE_MS = 60 * 60 * 1000; // reuse a search for an hour so repeats don't spend SerpAPI credits
const SUGGESTIONS = [
  "Blender",
  "Noise-cancelling headphones",
  "Air fryer",
  "Mirrorless camera",
  "Robot vacuum",
  "Mechanical keyboard"
];
const SORTS = [
  { id: "rating", label: "Top rated" },
  { id: "price-asc", label: "Lowest price" },
  { id: "price-desc", label: "Highest price" },
  { id: "retailer", label: "Retailer" }
];
const TABS = ["home", "search", "profile"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const icons = {
  heart: svg(
    '<path d="M12 20.5s-7.6-4.6-9.6-9.4C.9 7.6 3.2 4 6.8 4c2.2 0 3.8 1.2 5.2 3 1.4-1.8 3-3 5.2-3 3.6 0 5.9 3.6 4.4 7.1-2 4.8-9.6 9.4-9.6 9.4z"/>'
  ),
  bag: svg(
    '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'
  ),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  external: svg(
    '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
  ),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  user: svg(
    '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.6 4.5-5 8-5s6.5 1.4 8 5"/>'
  ),
  home: svg(
    '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>'
  ),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5"/>'),
  alert: svg(
    '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4"/><path d="M12 17h.01"/>'
  ),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  tag: svg(
    '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>'
  )
};

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked */
    }
  }
};

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : "";
  } catch {
    return "";
  }
};
const money = (cents) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const keyOf = (item) => `${item.retailer}:${item.id}`;
const firstName = (user) =>
  String(user?.name || user?.email || "").split(/[\s@]/)[0];

// Older versions stored one basket row per click; fold those into quantities.
function normalizeBasket(rows) {
  const lines = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const item = { ...(row.item || row) };
    delete item.basketId;
    if (!item.retailer) continue;
    const line = lines.get(keyOf(item));
    if (line) line.qty += row.qty || 1;
    else lines.set(keyOf(item), { item, qty: row.qty || 1 });
  }
  return [...lines.values()];
}

const state = {
  tab: "home",
  user: null,
  mode: "login",
  sorts: store.get("pt-sorts", ["rating"]),
  retailer: "all",
  hideSponsored: false,
  maxPrice: null,
  query: "",
  notice: "",
  pendingQuery: null,
  results: [],
  wishlist: [],
  basket: normalizeBasket(store.get("pt-basket", [])),
  recent: store.get("pt-recent", [])
};
const itemIndex = new Map();
let searchToken = 0;

const view = $("#view");
const title = $("#title");
const who = $("#who");
const authWindow = $("#auth-window");
const authForm = $("#auth");
const authNotice = $("#auth-notice");
const nameInput = $("#name");
const basketWindow = $("#basket-window");

$$("[data-icon]").forEach((el) => {
  el.outerHTML = icons[el.dataset.icon] || "";
});
$("#google").href = `${apiBase}/api/auth/google`;

/* ---------- Data ---------- */

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

async function search(query) {
  const cacheKey = `pt-q:${query.toLowerCase()}`;
  try {
    const hit = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (hit && Date.now() - hit.at < SEARCH_CACHE_MS)
      return { ...hit.body, cached: true };
  } catch {
    /* ignore */
  }
  const body = await api(`/api/live-search?q=${encodeURIComponent(query)}`);
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), body }));
  } catch {
    /* ignore */
  }
  return body;
}

function flatten(body) {
  const tagged = (rows, retailer) =>
    (rows || []).map((item) => ({
      ...item,
      id: item.id ?? item.link ?? item.title,
      retailer
    }));
  return [...tagged(body.amazon, "Amazon"), ...tagged(body.walmart, "Walmart")];
}

const noticeText = (body) =>
  `${body.notice || ""}${body.cached ? " Showing a saved copy from the last hour." : ""}`;

/* ---------- Small UI helpers ---------- */

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  $("#toasts").append(el);
  setTimeout(() => el.classList.add("out"), 2300);
  setTimeout(() => el.remove(), 2700);
}

function replay(el, className) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
const currentTheme = () =>
  document.documentElement.dataset.theme ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function setWho() {
  if (state.user) {
    const name = firstName(state.user);
    who.innerHTML = `<span class="avatar avatar-sm">${esc(name.charAt(0).toUpperCase())}</span><span class="hide-sm">${esc(name)}</span>`;
    who.setAttribute("aria-label", `Your profile, ${name}`);
  } else {
    who.innerHTML = `${icons.user}<span class="hide-sm">Sign in</span>`;
    who.setAttribute("aria-label", "Sign in");
  }
}

/* ---------- Cards and states ---------- */

const isSaved = (item) =>
  state.wishlist.some((row) => keyOf(row) === keyOf(item));

function targetButtonHtml(item) {
  if (state.tab !== "profile" || !item.wishlistId) return "";
  const price =
    item.target_price_cents === null
      ? "Not set"
      : money(item.target_price_cents);
  return `<button class="ghost sm" type="button" data-target="${esc(item.wishlistId)}">Target: ${price} — Edit</button>`;
}

function card(item, lowestKey) {
  const key = keyOf(item);
  const saved = isSaved(item);
  const link = safeUrl(item.link);
  const thumb = safeUrl(item.thumbnail);
  const rating = Number(item.rating) || 0;
  return `<article class="card" data-key="${esc(key)}">
    <div class="media">
      ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" />` : `<span class="noimg">No image</span>`}
      <span class="retailer ${item.retailer.toLowerCase()}">${esc(item.retailer)}</span>
      ${lowestKey === key ? `<span class="best-tag">Lowest here</span>` : ""}
      <button class="heart ${saved ? "on" : ""}" type="button" data-save="${esc(key)}" aria-pressed="${saved}" aria-label="${saved ? "Remove from wishlist" : "Save to wishlist"}">${icons.heart}</button>
    </div>
    <div class="card-body">
      <h3 class="name" title="${esc(item.title)}">${esc(item.title)}</h3>
      <div class="row">
        <p class="price">${money(item.price_cents)}</p>
        ${rating ? `<span class="stars" title="Rated ${rating} out of 5"><span class="glyphs" style="--pct:${(rating / 5) * 100}%" aria-hidden="true">★★★★★</span>${rating.toFixed(1)}</span>` : ""}
      </div>
      ${item.sponsored ? `<span class="tag">Sponsored</span>` : ""}

      ${targetButtonHtml(item)}

      <div class="card-actions">
        <button class="solid sm" type="button" data-basket="${esc(key)}" aria-label="Add to basket">${icons.bag}Add<span class="hide-sm">&nbsp;to basket</span></button>
        ${link ? `<a class="ghost sm" href="${esc(link)}" target="_blank" rel="noopener noreferrer" aria-label="View on ${esc(item.retailer)}">${icons.external}</a>` : ""}
      </div>
    </div>
  </article>`;
}

const skeletons = (count) =>
  Array.from(
    { length: count },
    () =>
      `<div class="card skeleton" aria-hidden="true"><div class="media"></div><div class="card-body"><div class="sk"></div><div class="sk w60"></div><div class="sk w40"></div></div></div>`
  ).join("");

function emptyState({
  icon = icons.search,
  heading = "No results",
  text = "",
  action = ""
} = {}) {
  return `<div class="empty">${icon}<h3>${esc(heading)}</h3>${text ? `<p>${esc(text)}</p>` : ""}${action}</div>`;
}

function errorState(error, query = "") {
  return emptyState({
    icon: icons.alert,
    heading: "Prices didn't load",
    text: `${error.message}. Check that the backend is running at ${apiBase}, then try again.`,
    action: `<button class="solid" type="button" data-retry="${esc(query)}">Try again</button>`
  }).replace('class="empty"', 'class="empty error"');
}

const suggestionChips = () =>
  SUGGESTIONS.map(
    (q) =>
      `<button type="button" class="chip" data-query="${esc(q)}">${esc(q)}</button>`
  ).join("");

function recentHtml() {
  if (!state.recent.length) return "";
  return `<div class="recent"><span class="label">Recent</span>${state.recent
    .map(
      (q) =>
        `<button type="button" class="chip" data-query="${esc(q)}">${icons.clock}${esc(q)}</button>`
    )
    .join(
      ""
    )}<button type="button" class="link" data-action="clear-recent">Clear</button></div>`;
}

const searchFormHtml = (
  placeholder = "Search blenders, cameras, headphones"
) => `<form class="search" role="search">
  <span class="search-icon">${icons.search}</span>
  <input name="q" maxlength="80" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="Search products" />
  <button class="solid" type="submit">Search</button>
</form>`;

/* ---------- Sorting, filtering, painting ---------- */

const itemComparators = {
  "price-asc": (a, b) => a.price_cents - b.price_cents,
  "price-desc": (a, b) => b.price_cents - a.price_cents,
  rating: (a, b) => (b.rating || 0) - (a.rating || 0),
  retailer: (a, b) => a.retailer.localeCompare(b.retailer)
};

function compareItems(a, b) {
  for (const pick of state.sorts) {
    if (!Object.hasOwn(itemComparators, pick)) continue;
    const difference = itemComparators[pick](a, b);
    if (difference) return difference;
  }
  return 0;
}

function sortItems(items) {
  return [...items].sort(compareItems);
}

const filterItems = (items) =>
  items.filter(
    (item) =>
      (state.retailer === "all" || item.retailer === state.retailer) &&
      (!state.hideSponsored || !item.sponsored) &&
      (state.maxPrice === null ||
        state.maxPrice === undefined ||
        item.price_cents <= state.maxPrice)
  );

const cheapest = (items) =>
  items.reduce(
    (low, item) => (!low || item.price_cents < low.price_cents ? item : low),
    null
  );

function paint(
  items,
  { filtered = false, highlightLowest = false, empty } = {}
) {
  const grid = $("#grid");
  if (!grid) return [];
  items.forEach((item) => itemIndex.set(keyOf(item), item));
  const shown = sortItems(filtered ? filterItems(items) : items);
  const lowest =
    highlightLowest && shown.length > 1 ? keyOf(cheapest(shown)) : null;
  grid.innerHTML = shown.length
    ? shown.map((item) => card(item, lowest)).join("")
    : emptyState(empty);
  return shown;
}

function controlsHtml(items) {
  const count = (retailer) =>
    items.filter((item) => item.retailer === retailer).length;
  const prices = items.map((item) => item.price_cents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const value = state.maxPrice ?? max;
  const retailerChips = ["all", "Amazon", "Walmart"]
    .map(
      (r) =>
        `<button type="button" class="chip ${state.retailer === r ? "on" : ""}" data-retailer="${r}" aria-pressed="${state.retailer === r}">${r === "all" ? "Both stores" : r} <small>${r === "all" ? items.length : count(r)}</small></button>`
    )
    .join("");
  const sortChips = SORTS.map((sort) => {
    const index = state.sorts.indexOf(sort.id);
    const on = index >= 0;
    return `<button type="button" class="chip ${on ? "on" : ""}" data-sort="${sort.id}" aria-pressed="${on}">${sort.label}${on && state.sorts.length > 1 ? `<b>${index + 1}</b>` : ""}</button>`;
  }).join("");
  return `<div class="controls">
    <div class="seg-chips" role="group" aria-label="Store">${retailerChips}</div>
    <div class="sort-chips" role="group" aria-label="Sort by"><span class="label">Sort by</span>${sortChips}</div>
    <div class="filters">
      ${max > min ? `<label class="range"><span>Up to <strong id="max-label">${money(value)}</strong></span><input type="range" id="max-price" min="${min}" max="${max}" step="1" value="${value}" /></label>` : ""}
      <label class="switch"><input type="checkbox" id="hide-sponsored" ${state.hideSponsored ? "checked" : ""} /><span></span>Hide sponsored</label>
    </div>
  </div>`;
}

// The price ruler: every visible result placed on one shared price scale, one lane per store.
function rulerHeadline(count, min, max, lowA, lowW) {
  if (!lowA || !lowW)
    return `${count} listings from ${money(min)} to ${money(max)}`;
  if (lowA.price_cents === lowW.price_cents)
    return `Both stores start at ${money(lowA.price_cents)}`;
  const winner = lowA.price_cents < lowW.price_cents ? "Amazon" : "Walmart";
  return `${winner}'s lowest price is ${money(Math.abs(lowA.price_cents - lowW.price_cents))} less`;
}

function rulerHtml(items) {
  if (items.length < 2) return "";
  const prices = items.map((item) => item.price_cents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const best = cheapest(items);
  const lowA = cheapest(items.filter((item) => item.retailer === "Amazon"));
  const lowW = cheapest(items.filter((item) => item.retailer === "Walmart"));

  const headline = rulerHeadline(items.length, min, max, lowA, lowW);

  const lane = (retailer) => {
    const rows = items.filter((item) => item.retailer === retailer);
    const ticks = rows
      .map((item, i) => {
        const x = ((item.price_cents - min) / span) * 100;
        return `<button type="button" class="tick ${retailer.toLowerCase()} ${item === best ? "best" : ""}" style="--x:${x.toFixed(2)}%;--i:${i}" data-jump="${esc(keyOf(item))}" data-label="${esc(money(item.price_cents))}" aria-label="${esc(item.title)}, ${esc(money(item.price_cents))}"></button>`;
      })
      .join("");
    return `<div class="lane"><span>${retailer}</span><div class="track">${ticks}</div></div>`;
  };

  return `<section class="ruler">
    <div class="ruler-head">
      <div><h2>${esc(headline)}</h2><p>Each mark is one listing. Select a mark to jump to it.</p></div>
      <div class="legend"><span><i class="rdot amazon"></i>Amazon</span><span><i class="rdot walmart"></i>Walmart</span></div>
    </div>
    <div class="lanes">${lane("Amazon")}${lane("Walmart")}</div>
    <div class="ends"><span>${money(min)}</span><span>${money(max)}</span></div>
    ${lowA && lowW ? `<p class="verdict">${icons.tag}<span>Lowest on Amazon <strong>${money(lowA.price_cents)}</strong>, on Walmart <strong>${money(lowW.price_cents)}</strong>. Listings aren't matched yet, so check they're the same product.</span></p>` : ""}
  </section>`;
}

function paintResults({ drawRuler = false } = {}) {
  const shown = paint(state.results, {
    filtered: true,
    highlightLowest: true,
    empty: state.results.length
      ? {
          icon: icons.tag,
          heading: "Nothing matches these filters",
          text: "Widen the price range or include both stores.",
          action: `<button class="solid" type="button" data-action="reset-filters">Reset filters</button>`
        }
      : {
          heading: `No results for "${state.query}"`,
          text: "Try a broader term, like a product type instead of a model number.",
          action: `<div class="chips">${suggestionChips()}</div>`
        }
  });
  const ruler = $("#ruler");
  if (ruler) {
    ruler.innerHTML = rulerHtml(shown);
    if (drawRuler) $(".ruler", ruler)?.classList.add("drawn");
  }
  return shown;
}

function refreshControls() {
  const controls = $("#controls");
  if (controls)
    controls.innerHTML = state.results.length
      ? controlsHtml(state.results)
      : "";
}

function toggleSort(id) {
  let sorts = state.sorts.filter((sort) => sort !== id);
  if (sorts.length === state.sorts.length) {
    if (id === "price-asc")
      sorts = sorts.filter((sort) => sort !== "price-desc");
    if (id === "price-desc")
      sorts = sorts.filter((sort) => sort !== "price-asc");
    sorts.push(id);
  }
  state.sorts = sorts.length ? sorts : ["rating"];
  store.set("pt-sorts", state.sorts);
}

function jumpTo(key) {
  const el = $$(".card", view).find((cardEl) => cardEl.dataset.key === key);
  if (!el) return;
  el.scrollIntoView({
    behavior: reduceMotion.matches ? "auto" : "smooth",
    block: "center"
  });
  replay(el, "flash");
}

/* ---------- Views ---------- */

async function loadHome() {
  title.textContent = "Home";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  view.innerHTML = `<section class="hero">
      <img class="hero-mark" src="./logo-mark.png" alt="" />
      <p class="greet">${greeting}${state.user ? `, ${esc(firstName(state.user))}` : ""}.</p>
      <h2>Search once. See both prices.</h2>
      <p class="lede">PriceTrackers checks Amazon and Walmart at the same time, so you can see where something costs less before you buy.</p>
      ${searchFormHtml()}
      <div class="chips" aria-label="Popular searches">${suggestionChips()}</div>
      ${recentHtml()}
    </section>
    <div class="section-head"><h2>Popular electronics</h2><p class="notice" id="notice">Loading live prices</p></div>
    <div class="grid" id="grid">${skeletons(8)}</div>`;
  try {
    const body = await search("popular electronics");
    if (state.tab !== "home") return;
    $("#notice").textContent = noticeText(body);
    paint(flatten(body), {
      empty: {
        heading: "No sample results right now",
        text: "Search for a product above instead."
      }
    });
  } catch (error) {
    if (state.tab !== "home") return;
    $("#notice").textContent = "";
    $("#grid").innerHTML = errorState(error);
  }
}

function loadSearch() {
  title.textContent = "Search";
  view.innerHTML = `${searchFormHtml()}
    <div id="controls"></div>
    <div id="ruler"></div>
    <p class="notice" id="notice"></p>
    <div class="grid" id="grid"></div>`;
  const input = $("form.search input", view);
  if (state.pendingQuery) {
    const query = state.pendingQuery;
    state.pendingQuery = null;
    runSearch(query);
  } else if (state.results.length) {
    input.value = state.query;
    showResults(false);
  } else {
    $("#grid").innerHTML = emptyState({
      icon: icons.tag,
      heading: "What are you shopping for?",
      text: "Search once and see Amazon and Walmart listings on one price scale. Press / to jump to the search box.",
      action: `<div class="chips">${suggestionChips()}</div>${recentHtml()}`
    });
    input.focus();
  }
}

function showResults(drawRuler = true) {
  refreshControls();
  $("#notice").textContent = state.notice;
  paintResults({ drawRuler });
}

function rememberQuery(query) {
  state.recent = [
    query,
    ...state.recent.filter((q) => q.toLowerCase() !== query.toLowerCase())
  ].slice(0, 6);
  store.set("pt-recent", state.recent);
}

async function runSearch(query) {
  const token = ++searchToken;
  state.query = query;
  rememberQuery(query);
  const input = $("form.search input", view);
  if (input) input.value = query;
  $("#controls").innerHTML = "";
  $("#ruler").innerHTML = "";
  $("#notice").textContent = `Checking Amazon and Walmart for "${query}"`;
  $("#grid").innerHTML = skeletons(8);
  try {
    const body = await search(query);
    if (token !== searchToken) return;
    state.results = flatten(body);
    state.retailer = "all";
    state.maxPrice = null;
    state.notice = noticeText(body);
    if (state.tab === "search") showResults(true);
  } catch (error) {
    if (token !== searchToken || state.tab !== "search") return;
    $("#notice").textContent = "";
    $("#grid").innerHTML = errorState(error, query);
  }
}

function goSearch(query) {
  if (state.tab === "search" && $("#grid")) return runSearch(query);
  state.tab = "search";
  state.pendingQuery = query;
  render();
}

async function loadProfile() {
  title.textContent = "Profile";
  if (!state.user) {
    view.innerHTML = `<div class="grid">${emptyState({
      icon: icons.user,
      heading: "Sign in to see your wishlist",
      text: "Save items from any search and come back to them here.",
      action: `<button class="solid" type="button" data-action="signin">Sign in</button>`
    })}</div>`;
    return;
  }
  await refreshWishlist();
  if (!state.user || state.tab !== "profile") return;
  const total = state.wishlist.reduce((sum, item) => sum + item.price_cents, 0);
  view.innerHTML = `<section class="profile">
      <div class="avatar">${esc(firstName(state.user).charAt(0).toUpperCase())}</div>
      <div><h2>${esc(state.user.name || firstName(state.user))}</h2><p class="notice">${esc(state.user.email || "")}</p></div>
      <button class="ghost" type="button" data-action="logout">Log out</button>
    </section>
    <div class="stats">
      <div class="stat"><span>Saved items</span><strong>${state.wishlist.length}</strong></div>
      <div class="stat"><span>Wishlist total</span><strong>${money(total)}</strong></div>
    </div>
    <div class="section-head"><h2>Wishlist</h2><p class="notice">Saved to your account in the database.</p></div>
    <div class="grid" id="grid"></div>`;
  paint(state.wishlist, {
    empty: {
      icon: icons.heart,
      heading: "Nothing saved yet",
      text: "Select the heart on any listing to save it here.",
      action: `<button class="solid" type="button" data-go="search">Find something</button>`
    }
  });
}

async function render() {
  $$(".nav button").forEach((button) => {
    const on = button.dataset.view === state.tab;
    button.classList.toggle("on", on);
    if (on) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $(".nav").style.setProperty("--idx", TABS.indexOf(state.tab));
  replay(view, "enter");
  try {
    if (state.tab === "search") return loadSearch();
    if (state.tab === "profile") return await loadProfile();
    await loadHome();
  } catch (error) {
    view.innerHTML = `<div class="grid">${errorState(error)}</div>`;
  }
}

/* ---------- Wishlist and basket ---------- */

async function refreshWishlist() {
  const userId = state.user?.id;

  if (!userId) {
    state.wishlist = [];
    return;
  }

  const body = await api("/api/wishlist");

  if (state.user?.id !== userId) return;

  state.wishlist = body.items.map((row) => ({
    ...row,
    wishlistId: row.id,
    id: row.external_id
  }));
}

async function toggleWish(button) {
  const item = itemIndex.get(button.dataset.save);
  if (!item) return;

  if (!state.user) {
    return openAuth("Sign in to save items to your wishlist.");
  }

  button.disabled = true;

  try {
    const saved = state.wishlist.find((row) => keyOf(row) === keyOf(item));

    if (saved) {
      await api(`/api/wishlist/${saved.wishlistId}`, {
        method: "DELETE"
      });
    } else {
      await api("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailer: item.retailer,
          external_id: String(item.id),
          title: item.title,
          price_cents: item.price_cents,
          currency: "USD",
          link: item.link,
          thumbnail: item.thumbnail || null
        })
      });
    }

    await refreshWishlist();
    toast(saved ? "Removed from wishlist" : "Saved to your account");

    if (state.tab === "profile") {
      await loadProfile();
      return;
    }

    const on = isSaved(item);
    button.classList.toggle("on", on);
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute(
      "aria-label",
      on ? "Remove from wishlist" : "Save to wishlist"
    );
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

function parseTargetPrice(input) {
  const value = input.trim();
  if (!value) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Enter a price such as 39.99.");
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents > 2147483647)
    throw new Error("That price is too large.");
  return cents;
}

async function editTarget(button) {
  const item = state.wishlist.find(
    (row) => row.wishlistId === Number(button.dataset.target)
  );
  if (!item) return;

  const initial =
    item.target_price_cents === null
      ? ""
      : (item.target_price_cents / 100).toFixed(2);

  const input = window.prompt(
    "Target price in dollars (example: 39.99). Leave blank to clear.",
    initial
  );
  if (input === null) return;

  button.disabled = true;

  try {
    const cents = parseTargetPrice(input);
    await api(`/api/wishlist/${item.wishlistId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_price_cents: cents })
    });

    await loadProfile();
    toast("Target price saved. Automatic alerts are not enabled.");
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

const basketCount = () => state.basket.reduce((sum, line) => sum + line.qty, 0);

function saveBasket(animate = true) {
  store.set("pt-basket", state.basket);
  const count = basketCount();
  $("#basket-count").textContent = count;
  $("#basket-button").setAttribute(
    "aria-label",
    `Open basket, ${count} ${count === 1 ? "item" : "items"}`
  );
  if (animate) replay($("#basket-button"), "bump");
}

function flyToBasket(img) {
  if (!img || !img.complete || reduceMotion.matches || !img.animate) return;
  const from = img.getBoundingClientRect();
  const to = $("#basket-button").getBoundingClientRect();
  const ghost = img.cloneNode();
  ghost.removeAttribute("loading");
  ghost.className = "fly";
  Object.assign(ghost.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`
  });
  document.body.append(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0.5 }
    ],
    { duration: 620, easing: "cubic-bezier(.55, -0.15, .7, 1)" }
  ).onfinish = () => ghost.remove();
}

function addToBasket(button) {
  const item = itemIndex.get(button.dataset.basket);
  if (!item) return;
  const line = state.basket.find((row) => keyOf(row.item) === keyOf(item));
  if (line) line.qty += 1;
  else state.basket.push({ item, qty: 1 });
  flyToBasket(button.closest(".card")?.querySelector(".media img"));
  setTimeout(() => saveBasket(), reduceMotion.matches ? 0 : 520);
  button.classList.add("done");
  button.innerHTML = `${icons.check}Added`;
  clearTimeout(button._reset);
  button._reset = setTimeout(() => {
    button.classList.remove("done");
    button.innerHTML = `${icons.bag}Add<span class="hide-sm">&nbsp;to basket</span>`;
  }, 1500);
}

function renderBasket() {
  const list = $("#basket-list");
  const summary = $("#basket-summary");
  const count = basketCount();
  $("#basket-sub").textContent = count
    ? `${count} ${count === 1 ? "item" : "items"}`
    : "";
  if (!state.basket.length) {
    list.innerHTML = emptyState({
      icon: icons.bag,
      heading: "Your basket is empty",
      text: "Add listings from a search to total them up here."
    });
    summary.innerHTML = "";
    return;
  }
  list.innerHTML = state.basket
    .map(({ item, qty }) => {
      const thumb = safeUrl(item.thumbnail);
      return `<div class="line" data-key="${esc(keyOf(item))}">
      ${thumb ? `<img src="${esc(thumb)}" alt="" />` : `<div class="ph"></div>`}
      <div>
        <p class="line-title">${esc(item.title)}</p>
        <p class="meta"><i class="rdot ${item.retailer.toLowerCase()}"></i>${esc(item.retailer)}, ${money(item.price_cents)} each</p>
        <div class="stepper"><button type="button" data-step="-1" aria-label="${qty === 1 ? "Remove" : "Decrease quantity"}">−</button><span>${qty}</span><button type="button" data-step="1" aria-label="Increase quantity">+</button></div>
      </div>
      <strong class="line-price">${money(item.price_cents * qty)}</strong>
    </div>`;
    })
    .join("");
  const subtotal = (retailer) =>
    state.basket
      .filter((line) => line.item.retailer === retailer)
      .reduce((sum, line) => sum + line.item.price_cents * line.qty, 0);
  const total = state.basket.reduce(
    (sum, line) => sum + line.item.price_cents * line.qty,
    0
  );
  const rows = ["Amazon", "Walmart"]
    .filter((r) => subtotal(r) > 0)
    .map(
      (r) =>
        `<div class="sum-row"><span class="meta"><i class="rdot ${r.toLowerCase()}"></i>${r}</span><span>${money(subtotal(r))}</span></div>`
    )
    .join("");
  summary.innerHTML = `${rows}
    <div class="sum-row total"><span>Total</span><strong>${money(total)}</strong></div>
    <div class="sum-row"><p class="notice">Before tax and shipping.</p><button type="button" class="link" id="clear-basket">Empty basket</button></div>`;
}

function openBasket() {
  renderBasket();
  basketWindow.showModal();
}

/* ---------- Auth ---------- */

function openAuth(message = "") {
  authNotice.textContent = message;
  if (!authWindow.open) authWindow.showModal();
}

function setMode(mode) {
  state.mode = mode;
  const signup = mode === "signup";
  nameInput.hidden = !signup;
  nameInput.required = signup;
  $(".seg").dataset.mode = mode;
  $("#tab-in").classList.toggle("on", !signup);
  $("#tab-up").classList.toggle("on", signup);
  $("#tab-in").setAttribute("aria-selected", !signup);
  $("#tab-up").setAttribute("aria-selected", signup);
  $("#auth-title").textContent = signup
    ? "Create your account"
    : "Welcome back";
  $("#password").autocomplete = signup ? "new-password" : "current-password";
  $("#submit").textContent = signup ? "Create account" : "Sign in";
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });

    state.user = null;
    state.wishlist = [];

    setWho();
    toast("Logged out");

    state.tab = "home";
    render();
  } catch (error) {
    toast(error.message);
  }
}

/* ---------- Events ---------- */

function handleViewNavigation(data) {
  if (data.retailer) {
    state.retailer = data.retailer;
    refreshControls();
    paintResults();
    return true;
  }
  if (data.sort) {
    toggleSort(data.sort);
    refreshControls();
    paintResults();
    return true;
  }
  if (data.go) {
    state.tab = data.go;
    render();
    return true;
  }
  if (data.retry !== undefined) {
    if (data.retry) runSearch(data.retry);
    else render();
    return true;
  }
  return false;
}

function handleViewAction(action, target) {
  switch (action) {
    case "signin":
      return openAuth();
    case "logout":
      return logout();
    case "reset-filters":
      state.retailer = "all";
      state.hideSponsored = false;
      state.maxPrice = null;
      refreshControls();
      paintResults();
      return;
    case "clear-recent":
      state.recent = [];
      store.set("pt-recent", []);
      target.closest(".recent")?.remove();
  }
}

view.addEventListener("click", (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;
  const data = target.dataset;
  if (data.target) return editTarget(target);
  if (data.save) return toggleWish(target);
  if (data.basket) return addToBasket(target);
  if (data.query) return goSearch(data.query);
  if (data.jump) return jumpTo(data.jump);
  if (handleViewNavigation(data)) return;
  return handleViewAction(data.action, target);
});

view.addEventListener("submit", (event) => {
  const form = event.target.closest("form.search");
  if (!form) return;
  event.preventDefault();
  const query = form.q.value.trim();
  if (!query) return form.q.focus();
  goSearch(query);
});

view.addEventListener("input", (event) => {
  if (event.target.id !== "max-price") return;
  const value = Number(event.target.value);
  state.maxPrice = value >= Number(event.target.max) ? null : value;
  $("#max-label").textContent = money(value);
  paintResults();
});

view.addEventListener("change", (event) => {
  if (event.target.id !== "hide-sponsored") return;
  state.hideSponsored = event.target.checked;
  paintResults();
});

basketWindow.addEventListener("click", (event) => {
  if (event.target === basketWindow) return basketWindow.close();
  const button = event.target.closest("button");
  if (!button) return;
  if (button.id === "close-basket") return basketWindow.close();
  if (button.id === "clear-basket") {
    state.basket = [];
    saveBasket();
    renderBasket();
    toast("Basket emptied");
    return;
  }
  if (button.dataset.step) {
    const key = button.closest(".line").dataset.key;
    const line = state.basket.find((row) => keyOf(row.item) === key);
    if (!line) return;
    line.qty += Number(button.dataset.step);
    if (line.qty <= 0)
      state.basket = state.basket.filter((row) => row !== line);
    saveBasket();
    renderBasket();
  }
});

authWindow.addEventListener("click", (event) => {
  if (event.target === authWindow) authWindow.close();
});
$("#close-auth").onclick = () => authWindow.close();
$("#tab-in").onclick = () => setMode("login");
$("#tab-up").onclick = () => setMode("signup");

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("#submit");
  const label = submit.textContent;
  submit.disabled = true;
  submit.textContent =
    state.mode === "signup" ? "Creating account…" : "Signing in…";
  authNotice.textContent = "";
  try {
    const payload = {
      email: $("#email").value,
      password: $("#password").value
    };
    if (state.mode === "signup") payload.name = nameInput.value;
    const body = await api(
      state.mode === "signup" ? "/api/auth/signup" : "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
    state.user = body.user;
    state.wishlist = [];
    await refreshWishlist().catch((error) => toast(error.message));
    setWho();
    authWindow.close();
    authForm.reset();
    toast(
      `${state.mode === "signup" ? "Welcome" : "Welcome back"}, ${firstName(body.user)}`
    );
    render();
  } catch (error) {
    authNotice.textContent = error.message;
    replay(authForm, "shake");
  } finally {
    submit.disabled = false;
    submit.textContent = label;
  }
});

$$(".nav button").forEach((button) => {
  button.onclick = () => {
    if (state.tab === button.dataset.view)
      return window.scrollTo({
        top: 0,
        behavior: reduceMotion.matches ? "auto" : "smooth"
      });
    state.tab = button.dataset.view;
    render();
  };
});
$("#brand").onclick = (event) => {
  event.preventDefault();
  state.tab = "home";
  render();
};
who.onclick = () =>
  state.user ? ((state.tab = "profile"), render()) : openAuth();
$("#basket-button").onclick = openBasket;
$("#theme-toggle").onclick = () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  store.set("pt-theme", next);
};

document.addEventListener("keydown", (event) => {
  if (
    event.key !== "/" ||
    event.target.closest("input, textarea") ||
    $("dialog[open]")
  )
    return;
  event.preventDefault();
  const input = $("form.search input", view);
  if (input) input.focus();
  else {
    state.tab = "search";
    render();
  }
});

/* ---------- Start ---------- */

applyTheme(store.get("pt-theme", null));
setMode("login");
setWho();
saveBasket(false);
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
api("/api/auth/me")
  .then(async (body) => {
    state.user = body.user || null;
    await refreshWishlist().catch((error) => toast(error.message));
  })
  .catch(() => {
    state.user = null;
  })
  .finally(() => {
    setWho();
    render();
  });
