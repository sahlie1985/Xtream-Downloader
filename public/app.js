const qs = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);

const STORAGE_KEY = "xtream_viewer_state_v1";
const state = {
  baseUrl: "",
  username: "",
  password: "",
  output: "mpegts",
  tab: "live",
  currentCategory: null,
  selectedCatByTab: { live: null, vod: null, series: null },
  search: "",
  searchAll: false,
  currentItems: [],
  currentKind: "live", // live | movie | series (for render)
};

function saveState() {
  try {
    const minimal = {
      baseUrl: state.baseUrl,
      username: state.username,
      password: state.password,
      output: state.output,
      tab: state.tab,
      selectedCatByTab: state.selectedCatByTab,
      search: state.search,
      searchAll: state.searchAll,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
  } catch {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && typeof data === "object") {
      state.baseUrl = data.baseUrl || state.baseUrl;
      state.username = data.username || state.username;
      state.password = data.password || state.password;
      state.output = data.output || state.output;
      state.tab = data.tab || state.tab;
      state.selectedCatByTab = data.selectedCatByTab || state.selectedCatByTab;
      state.search = data.search || state.search;
      state.searchAll = !!data.searchAll;
    }
  } catch {}
}

function creds() {
  return {
    baseUrl: state.baseUrl,
    username: state.username,
    password: state.password,
  };
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function formatMaybeDate(key, value) {
  const k = String(key).toLowerCase();
  const raw = value;
  const n = Number(value);
  const looksNumeric = Number.isFinite(n);
  const isDateKey = /(^|_)(exp|created|updated|start|end|date|time|timestamp)(_at)?$/.test(k) || k.endsWith("_at") || k.includes("date") || k.includes("timestamp");
  if (isDateKey && looksNumeric) {
    // Detect seconds vs milliseconds
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      // Locale-aware date time
      return d.toLocaleString(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    }
  }
  return raw;
}

function renderKV(container, obj) {
  container.innerHTML = "";
  if (!obj) return;
  for (const [k, v] of Object.entries(obj)) {
    const d = document.createElement("div");
    const formatted = formatMaybeDate(k, v);
    d.textContent = `${k}: ${formatted}`;
    if (formatted !== v) d.title = String(v);
    container.appendChild(d);
  }
}

function setVisible(el, show) {
  el.classList.toggle("hidden", !show);
}

async function connect() {
  state.baseUrl = byId("baseUrl").value.trim();
  state.username = byId("username").value.trim();
  state.password = byId("password").value.trim();
  state.output = byId("output").value;
  saveState();
  if (!state.baseUrl || !state.username || !state.password) {
    alert("Veuillez remplir baseUrl, utilisateur, mot de passe");
    return;
  }
  try {
    const { user_info, server_info } = await api("/api/account", creds());
    renderKV(byId("userInfo"), user_info);
    renderKV(byId("serverInfo"), server_info);
    setVisible(byId("account"), true);
    setVisible(byId("tabs"), true);
    setVisible(byId("searchBar"), true);
    setVisible(byId("content"), true);
    // Load last tab if present
    loadTab(state.tab || "live");
  } catch (e) {
    alert(e.message);
  }
}

async function loadTab(tab) {
  state.tab = tab;
  saveState();
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  byId("catTitle").textContent = `Catégories (${tab})`;
  byId("itemsTitle").textContent = `Éléments (${tab})`;
  byId("categories").innerHTML = "Chargement...";
  byId("items").innerHTML = "";

  try {
    if (tab === "live") {
      const cats = await api("/api/live/categories", creds());
      renderCategories(cats);
    } else if (tab === "vod") {
      const cats = await api("/api/vod/categories", creds());
      renderCategories(cats);
    } else {
      const cats = await api("/api/series/categories", creds());
      renderCategories(cats);
    }
    // If we have a search active with "toutes catégories", trigger a global search load
    if (state.searchAll && state.search.trim()) {
      await loadSearchAll();
    }
  } catch (e) {
    byId("categories").textContent = e.message;
  }
}

async function loadItemsForCategory(catId) {
  state.currentCategory = catId;
  // Track last category per tab
  if (state.tab && catId != null) {
    state.selectedCatByTab[state.tab] = catId;
    saveState();
  }
  byId("items").innerHTML = "Chargement...";
  try {
    if (state.tab === "live") {
      const { streams } = await api("/api/live/streams", { ...creds(), category_id: catId });
      state.currentKind = "live";
      state.currentItems = streams || [];
      applyFilter();
    } else if (state.tab === "vod") {
      const { streams } = await api("/api/vod/streams", { ...creds(), category_id: catId });
      state.currentKind = "movie";
      state.currentItems = streams || [];
      applyFilter();
    } else {
      const { series } = await api("/api/series/list", { ...creds(), category_id: catId });
      state.currentKind = "series";
      state.currentItems = series || [];
      applyFilter();
    }
  } catch (e) {
    byId("items").textContent = e.message;
  }
}

function renderCategories(cats) {
  const wrap = byId("categories");
  wrap.innerHTML = "";
  for (const c of cats) {
    const btn = document.createElement("button");
    btn.className = "cat";
    btn.textContent = c.category_name || c.name || c.category_id;
    btn.dataset.id = c.category_id;
    btn.onclick = () => {
      document.querySelectorAll(".cat").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      loadItemsForCategory(c.category_id);
    };
    wrap.appendChild(btn);
  }
  // Auto-select last category for this tab if available
  const lastId = state.selectedCatByTab?.[state.tab];
  if (lastId != null) {
    const toClick = wrap.querySelector(`.cat[data-id="${lastId}"]`);
    if (toClick) {
      toClick.click();
    }
  }
}

function cardThumb(url, title) {
  const div = document.createElement("div");
  div.className = "thumb";
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.referrerPolicy = "no-referrer"; // some panels block hotlinking
    div.appendChild(img);
    div.classList.add("clickable");
    div.title = "Agrandir l'image";
    div.onclick = (e) => {
      e.stopPropagation();
      openImageModal(url, title || "");
    };
  } else {
    div.textContent = "📺";
  }
  return div;
}

function renderItems(items, kindOverride) {
  const wrap = byId("items");
  wrap.innerHTML = "";
  for (const it of items) {
    const card = document.createElement("div");
    card.className = "card";

    const logo = it.stream_icon || it.cover || "";
    card.appendChild(cardThumb(logo, getItemName(it)));

    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = it.name || it.title || it.stream_display_name || it.series_name || `#${it.stream_id || it.series_id}`;
    meta.appendChild(name);

    const actions = document.createElement("div");
    actions.className = "actions";

    const playBtn = document.createElement("button");
    playBtn.textContent = "M3U";
    playBtn.title = "Télécharger un M3U pour ce flux";
    playBtn.onclick = () => downloadOneM3U({
      id: it.stream_id || it.series_id || it.id,
      kind: kindOverride || "live",
      name: name.textContent,
    });

    const urlBtn = document.createElement("button");
    urlBtn.textContent = "Copier URL";
    urlBtn.onclick = async () => {
      const { url } = await api("/api/stream/url", { ...creds(), id: it.stream_id || it.series_id || it.id, kind: kindOverride || "live", format: byId("output").value });
      await navigator.clipboard.writeText(url);
      urlBtn.textContent = "Copié!"; setTimeout(() => urlBtn.textContent = "Copier URL", 1200);
    };

    const openBtn = document.createElement("a");
    openBtn.textContent = "Ouvrir";
    openBtn.href = "#";
    openBtn.onclick = async (e) => {
      e.preventDefault();
      const { url, vlc } = await api("/api/stream/url", { ...creds(), id: it.stream_id || it.series_id || it.id, kind: kindOverride || "live", format: byId("output").value });
      // Try vlc:// first, else fall back to direct url (browser may not play .ts)
      try { window.location.href = vlc; } catch {}
      setTimeout(() => { window.open(url, "_blank"); }, 200);
    };

    actions.appendChild(playBtn);
    actions.appendChild(urlBtn);
    actions.appendChild(openBtn);
    meta.appendChild(actions);
    card.appendChild(meta);
    wrap.appendChild(card);
  }
  if (!items || items.length === 0) {
    wrap.innerHTML = '<div style="opacity:.7">Aucun résultat.</div>';
  }
}

function downloadBlob(filename, blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadM3U(scope) {
  const res = await fetch("/api/m3u", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...creds(), scope, output: byId("output").value }),
  });
  const blob = await res.blob();
  downloadBlob(`xtream_${scope}.m3u`, blob);
}

async function downloadEPG() {
  const res = await fetch("/api/xmltv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...creds() }),
  });
  const blob = await res.blob();
  downloadBlob("guide.xml", blob);
}

async function downloadOneM3U({ id, kind, name }) {
  const res = await fetch("/api/one.m3u", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...creds(), id, kind, name, output: byId("output").value }),
  });
  const blob = await res.blob();
  downloadBlob(`${(name || "stream").replace(/[^a-z0-9]+/gi, "_")}.m3u`, blob);
}

// Wire UI
byId("connectBtn").onclick = connect;
byId("dlAll").onclick = () => downloadM3U("all");
byId("dlLive").onclick = () => downloadM3U("live");
byId("dlVod").onclick = () => downloadM3U("vod");
byId("dlEpg").onclick = () => downloadEPG();
byId("clearBtn").onclick = () => clearStored();

document.querySelectorAll("nav button").forEach(btn => {
  btn.onclick = () => loadTab(btn.dataset.tab);
});

// lecteur intégré supprimé

// Initialize from persisted state
loadState();
// Prefill inputs
const baseUrlEl = byId("baseUrl"); if (baseUrlEl) baseUrlEl.value = state.baseUrl || "";
const usernameEl = byId("username"); if (usernameEl) usernameEl.value = state.username || "";
const passwordEl = byId("password"); if (passwordEl) passwordEl.value = state.password || "";
const outputEl = byId("output"); if (outputEl) outputEl.value = state.output || "mpegts";
const searchInputEl = byId("searchInput"); if (searchInputEl) searchInputEl.value = state.search || "";
const searchAllEl = byId("searchAll"); if (searchAllEl) searchAllEl.checked = !!state.searchAll;

// Save changes on input updates
baseUrlEl?.addEventListener("change", () => { state.baseUrl = baseUrlEl.value.trim(); saveState(); });
usernameEl?.addEventListener("change", () => { state.username = usernameEl.value.trim(); saveState(); });
passwordEl?.addEventListener("change", () => { state.password = passwordEl.value.trim(); saveState(); });
outputEl?.addEventListener("change", () => { state.output = outputEl.value; saveState(); });

// Search handlers
let searchTimer = null;
searchInputEl?.addEventListener("input", () => {
  state.search = searchInputEl.value;
  saveState();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (state.searchAll && state.search.trim()) {
      loadSearchAll();
    } else {
      applyFilter();
    }
  }, 250);
});
searchAllEl?.addEventListener("change", () => {
  state.searchAll = !!searchAllEl.checked;
  saveState();
  if (state.searchAll && state.search.trim()) {
    loadSearchAll();
  } else {
    applyFilter();
  }
});

function getItemName(it) {
  return (
    it.name || it.title || it.stream_display_name || it.series_name || String(it.stream_id || it.series_id || it.id || "")
  );
}

function applyFilter() {
  const q = (state.search || "").toLowerCase().trim();
  let list = state.currentItems || [];
  if (q) {
    list = list.filter((it) => (getItemName(it) || "").toLowerCase().includes(q));
  }
  renderItems(list, state.currentKind === "live" ? undefined : state.currentKind);
}

async function loadSearchAll() {
  byId("items").innerHTML = "Recherche...";
  try {
    if (state.tab === "live") {
      const { streams } = await api("/api/live/streams", { ...creds() });
      state.currentKind = "live";
      state.currentItems = streams || [];
    } else if (state.tab === "vod") {
      const { streams } = await api("/api/vod/streams", { ...creds() });
      state.currentKind = "movie";
      state.currentItems = streams || [];
    } else {
      const { series } = await api("/api/series/list", { ...creds() });
      state.currentKind = "series";
      state.currentItems = series || [];
    }
    applyFilter();
  } catch (e) {
    byId("items").textContent = e.message;
  }
}

function clearStored() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  // Reset state
  state.baseUrl = "";
  state.username = "";
  state.password = "";
  state.output = "mpegts";
  state.tab = "live";
  state.currentCategory = null;
  state.selectedCatByTab = { live: null, vod: null, series: null };
  state.search = "";
  state.searchAll = false;
  state.currentItems = [];
  state.currentKind = "live";
  // Reset UI fields
  const baseUrlEl2 = byId("baseUrl"); if (baseUrlEl2) baseUrlEl2.value = "";
  const usernameEl2 = byId("username"); if (usernameEl2) usernameEl2.value = "";
  const passwordEl2 = byId("password"); if (passwordEl2) passwordEl2.value = "";
  const outputEl2 = byId("output"); if (outputEl2) outputEl2.value = "mpegts";
  const searchInputEl2 = byId("searchInput"); if (searchInputEl2) searchInputEl2.value = "";
  const searchAllEl2 = byId("searchAll"); if (searchAllEl2) searchAllEl2.checked = false;
  // Clear content and hide panels
  byId("userInfo").innerHTML = "";
  byId("serverInfo").innerHTML = "";
  byId("categories").innerHTML = "";
  byId("items").innerHTML = "";
  setVisible(byId("account"), false);
  setVisible(byId("tabs"), false);
  setVisible(byId("searchBar"), false);
  setVisible(byId("content"), false);
  alert("Données locales supprimées.");
}

// Auto-connect if we already have creds
if (state.baseUrl && state.username && state.password) {
  connect();
}

// Image modal logic
const imgModal = byId("imgModal");
const imgBackdrop = byId("imgBackdrop");
const imgPreview = byId("imgPreview");
const imgCaption = byId("imgCaption");
const imgClose = byId("imgClose");
const imgOpen = byId("imgOpen");

function openImageModal(url, title) {
  if (!url) return;
  imgPreview.src = url;
  imgPreview.alt = title || "Image";
  imgCaption.textContent = title || "";
  imgOpen.href = url;
  setVisible(imgModal, true);
  imgModal.setAttribute("aria-hidden", "false");
}
function closeImageModal() {
  imgPreview.src = "";
  setVisible(imgModal, false);
  imgModal.setAttribute("aria-hidden", "true");
}
imgBackdrop?.addEventListener("click", closeImageModal);
imgClose?.addEventListener("click", closeImageModal);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !imgModal.classList.contains("hidden")) closeImageModal();
});
