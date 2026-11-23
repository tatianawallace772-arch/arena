/* SpotAPIfy — single-page web player */
"use strict";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtDuration(ms) {
  if (!ms) return "0:00";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

function fmtCompact(n) {
  if (n == null) return "";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

async function api(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(msg, isError = false) {
  const wrap = $("#toast-wrap");
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

function icon(name) {
  return `<svg><use href="#i-${name}"/></svg>`;
}

function spotifyWebUrl(uri) {
  const parts = String(uri || "").split(":");
  return parts.length >= 3 ? `https://open.spotify.com/${parts[1]}/${parts[2]}` : "#";
}

// ---------------------------------------------------------------------------
// persistent state
// ---------------------------------------------------------------------------
function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
const store = {
  get likes() { return loadJSON("spafy_likes", {}); },
  set likes(v) { localStorage.setItem("spafy_likes", JSON.stringify(v)); },
  get recents() { return loadJSON("spafy_recents", []); },
  set recents(v) { localStorage.setItem("spafy_recents", JSON.stringify(v.slice(0, 12))); },
  get volume() { return loadJSON("spafy_volume", 0.8); },
  set volume(v) { localStorage.setItem("spafy_volume", JSON.stringify(v)); },
};

// ---------------------------------------------------------------------------
// player state
// ---------------------------------------------------------------------------
const audio = $("#audio");
const state = {
  mode: "demo",
  queue: [],
  index: -1,
  shuffle: false,
  repeat: 0, // 0 off, 1 all, 2 one
  current: null,
  seeking: false,
};

function isLiked(id) { return !!store.likes[id]; }
function toggleLike(track) {
  const likes = store.likes;
  if (likes[track.id]) {
    delete likes[track.id];
    toast(`Removed "${track.name}" from Liked Songs`);
  } else {
    likes[track.id] = track;
    toast(`Added "${track.name}" to Liked Songs`);
  }
  store.likes = likes;
  refreshLikeUI();
}
function refreshLikeUI() {
  const id = state.current?.id;
  const btn = $("#p-like");
  if (id) {
    btn.querySelector("use").setAttribute("href", isLiked(id) ? "#i-heart-fill" : "#i-heart");
    btn.classList.toggle("toggled", isLiked(id));
  }
  $$(".t-like").forEach((b) => {
    const liked = isLiked(b.dataset.trackId);
    b.classList.toggle("liked", liked);
    b.querySelector("use").setAttribute("href", liked ? "#i-heart-fill" : "#i-heart");
  });
  if (location.hash === "#/liked") renderLiked();
}

function setQueue(tracks, startIndex, contextName = "") {
  state.queue = tracks.filter(Boolean);
  state.index = Math.max(0, startIndex);
  playCurrent();
}

function playTrack(track, contextTracks, contextName = "") {
  const list = (contextTracks && contextTracks.length ? contextTracks : [track]).filter(Boolean);
  let idx = list.findIndex((t) => t.id === track.id);
  if (idx < 0) { list.unshift(track); idx = 0; }
  setQueue(list, idx, contextName);
}

function playCurrent() {
  const track = state.queue[state.index];
  if (!track) return;
  state.current = track;

  if (!track.preview_url) {
    updatePlayerUI();
    if (track.spotify_url) {
      toast(`No in-app preview in live mode — open "${track.name}" on Spotify`, true);
      window.open(track.spotify_url, "_blank", "noopener");
    } else {
      toast("No audio preview available for this track", true);
    }
    return;
  }

  audio.src = track.preview_url;
  audio.play().catch(() => toast("Playback blocked — click anywhere first", true));

  // remember recents
  const card = {
    id: track.album?.id || track.id,
    type: track.album ? "album" : "track",
    name: track.album?.name || track.name,
    subtitle: track.artists?.map((a) => a.name).join(", ") || "",
    cover: track.cover,
  };
  const recents = store.recents.filter((r) => !(r.id === card.id && r.type === card.type));
  recents.unshift(card);
  store.recents = recents;

  updatePlayerUI();
}

function togglePlay() {
  if (!state.current) return;
  if (!state.current.preview_url) { playCurrent(); return; }
  if (audio.paused) audio.play(); else audio.pause();
}

function nextTrack(auto = false) {
  if (!state.queue.length) return;
  if (auto && state.repeat === 2) { audio.currentTime = 0; audio.play(); return; }
  let next;
  if (state.shuffle && state.queue.length > 1) {
    do { next = Math.floor(Math.random() * state.queue.length); } while (next === state.index);
  } else {
    next = state.index + 1;
    if (next >= state.queue.length) {
      if (state.repeat === 1 || !auto) next = 0;
      else { updatePlayerUI(); return; } // end of queue
    }
  }
  state.index = next;
  playCurrent();
}

function prevTrack() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (state.index > 0) { state.index--; playCurrent(); }
  else audio.currentTime = 0;
}

function updatePlayerUI() {
  const t = state.current;
  $("#p-title").textContent = t?.name || "";
  $("#p-artist").textContent = t?.artists?.map((a) => a.name).join(", ") || "";
  const cover = $("#p-cover");
  if (t?.cover) { cover.src = t.cover; cover.classList.remove("hidden"); }
  else cover.classList.add("hidden");
  $("#p-like").classList.toggle("hidden", !t);
  $("#p-play").disabled = !t;
  refreshLikeUI();
  document.title = t ? `${t.name} • SpotAPIfy` : "SpotAPIfy — Web Player";
  renderQueue();
  highlightPlayingRow();
}

function highlightPlayingRow() {
  $$(".track-row[data-track-id]").forEach((row) => {
    row.classList.toggle("playing", row.dataset.trackId === state.current?.id);
  });
}

audio.addEventListener("play", () => {
  $("#p-play").querySelector("use").setAttribute("href", "#i-pause");
  $("#p-play").title = "Pause";
});
audio.addEventListener("pause", () => {
  $("#p-play").querySelector("use").setAttribute("href", "#i-play");
  $("#p-play").title = "Play";
});
audio.addEventListener("ended", () => nextTrack(true));
audio.addEventListener("timeupdate", () => {
  if (state.seeking) return;
  const d = audio.duration || 0;
  $("#p-elapsed").textContent = fmtTime(audio.currentTime);
  $("#p-duration").textContent = fmtTime(d);
  const seek = $("#p-seek");
  seek.value = d ? Math.round((audio.currentTime / d) * 1000) : 0;
  seek.style.setProperty("--fill", `${(seek.value / 10).toFixed(1)}%`);
});
audio.addEventListener("loadedmetadata", () => {
  $("#p-duration").textContent = fmtTime(audio.duration);
});

// player controls
$("#p-play").addEventListener("click", togglePlay);
$("#p-next").addEventListener("click", () => nextTrack(false));
$("#p-prev").addEventListener("click", prevTrack);
$("#p-shuffle").addEventListener("click", () => {
  state.shuffle = !state.shuffle;
  $("#p-shuffle").classList.toggle("toggled", state.shuffle);
  toast(state.shuffle ? "Shuffle on" : "Shuffle off");
});
$("#p-repeat").addEventListener("click", () => {
  state.repeat = (state.repeat + 1) % 3;
  $("#p-repeat").classList.toggle("toggled", state.repeat > 0);
  $("#p-repeat").style.opacity = state.repeat === 2 ? "1" : "";
  $("#p-repeat").title = ["Repeat off", "Repeat all", "Repeat one"][state.repeat];
  toast(["Repeat off", "Repeat all", "Repeat one"][state.repeat]);
});
$("#p-like").addEventListener("click", () => state.current && toggleLike(state.current));

const seek = $("#p-seek");
seek.addEventListener("input", () => {
  state.seeking = true;
  seek.style.setProperty("--fill", `${seek.value / 10}%`);
  $("#p-elapsed").textContent = fmtTime((seek.value / 1000) * (audio.duration || 0));
});
seek.addEventListener("change", () => {
  if (isFinite(audio.duration)) audio.currentTime = (seek.value / 1000) * audio.duration;
  state.seeking = false;
});

const volume = $("#p-volume");
audio.volume = store.volume;
volume.value = Math.round(store.volume * 100);
volume.style.setProperty("--fill", `${volume.value}%`);
volume.addEventListener("input", () => {
  audio.volume = volume.value / 100;
  store.volume = audio.volume;
  volume.style.setProperty("--fill", `${volume.value}%`);
});

$("#p-queue-btn").addEventListener("click", () => {
  $("#queue-panel").classList.toggle("hidden");
  renderQueue();
});
$("#queue-close").addEventListener("click", () => $("#queue-panel").classList.add("hidden"));

function renderQueue() {
  const list = $("#queue-list");
  if ($("#queue-panel").classList.contains("hidden")) return;
  if (!state.queue.length) {
    list.innerHTML = `<div class="empty-state" style="padding:30px 10px"><p>Play something to build your queue.</p></div>`;
    return;
  }
  list.innerHTML = state.queue.map((t, i) => `
    <div class="queue-item ${i === state.index ? "current" : ""}" data-qi="${i}">
      ${t.cover ? `<img src="${esc(t.cover)}" alt="">` : ""}
      <div class="q-meta">
        <div class="q-name">${esc(t.name)}</div>
        <div class="q-artist">${esc(t.artists?.map((a) => a.name).join(", ") || "")}</div>
      </div>
    </div>`).join("");
  list.querySelectorAll(".queue-item").forEach((el) =>
    el.addEventListener("click", () => { state.index = Number(el.dataset.qi); playCurrent(); }));
}

// keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  else if (e.code === "ArrowRight" && e.shiftKey) nextTrack(false);
  else if (e.code === "ArrowLeft" && e.shiftKey) prevTrack();
});

// ---------------------------------------------------------------------------
// cover color extraction for hero gradients
// ---------------------------------------------------------------------------
const colorCache = {};
function heroColor(imgEl, cb) {
  const src = imgEl.currentSrc || imgEl.src;
  if (colorCache[src]) return cb(colorCache[src]);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 8;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgEl, 0, 0, 8, 8);
    const px = ctx.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
    const n = px.length / 4;
    const color = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
    colorCache[src] = color;
    cb(color);
  } catch {
    cb("#535353");
  }
}
function applyHeroGradient(heroEl) {
  const img = heroEl.querySelector("img");
  if (!img) return;
  const apply = () => heroColor(img, (c) => heroEl.style.setProperty("--hero", c));
  if (img.complete && img.naturalWidth) apply();
  else img.addEventListener("load", apply, { once: true });
}

// ---------------------------------------------------------------------------
// shared templates
// ---------------------------------------------------------------------------
function cardHTML(item) {
  const href = item.type === "artist" ? `#/artist/${item.id}`
    : item.type === "playlist" ? `#/playlist/${item.id}`
    : `#/album/${item.id}`;
  const round = item.type === "artist" ? " round" : "";
  return `
    <button class="card" data-href="${esc(href)}">
      <div class="cover-wrap${round}">
        ${item.cover ? `<img loading="lazy" src="${esc(item.cover)}" alt="${esc(item.name)}">` : ""}
        <span class="card-play" data-play-card="${esc(item.type)}:${esc(item.id)}" title="Play">${icon("play")}</span>
      </div>
      <div class="card-title">${esc(item.name)}</div>
      <div class="card-sub">${esc(item.subtitle || item.description || "")}</div>
    </button>`;
}

function trackRowHTML(track, i, showAlbum = true) {
  const artists = (track.artists || []).map((a) =>
    a.id ? `<a href="#/artist/${esc(a.id)}" data-stop>${esc(a.name)}</a>` : esc(a.name)
  ).join(", ");
  return `
  <div class="track-row" data-track-id="${esc(track.id)}">
    <div class="t-index">
      <span class="idx">${i + 1}</span>
      <button class="idx-play" data-row-play="${i}" title="Play">${icon("play")}</button>
    </div>
    <div class="t-main">
      ${track.cover ? `<img loading="lazy" src="${esc(track.cover)}" alt="">` : `<svg class="t-cover-ph" style="width:42px;height:42px;color:#444">${icon("note")}</svg>`}
      <div class="t-titles">
        <div class="t-name">${esc(track.name)}</div>
        <div class="t-artist">${artists}</div>
      </div>
    </div>
    <div class="t-album">${track.album?.id ? `<a href="#/album/${esc(track.album.id)}" data-stop>${esc(track.album.name)}</a>` : esc(track.album?.name || "")}</div>
    <button class="t-like ${isLiked(track.id) ? "liked" : ""}" data-track-id="${esc(track.id)}" title="Like">
      <svg><use href="#i-heart${isLiked(track.id) ? "-fill" : ""}"/></svg>
    </button>
    <div class="t-dur">${fmtDuration(track.duration_ms)}</div>
  </div>`;
}

function trackTableHTML(tracks, { header = true } = {}) {
  return `
  <div class="track-table">
    ${header ? `<div class="track-row head">
      <div class="t-index">#</div><div>Title</div><div class="t-album">Album</div>
      <div></div><div class="t-dur" title="Duration">${icon("clock")}</div>
    </div>` : ""}
    ${tracks.map((t, i) => trackRowHTML(t, i)).join("")}
  </div>`;
}

function bindTrackTable(container, tracks, contextName) {
  container.querySelectorAll(".track-row[data-track-id]").forEach((row, i) => {
    row.addEventListener("dblclick", () => playTrack(tracks[i], tracks, contextName));
    const playBtn = row.querySelector("[data-row-play]");
    if (playBtn) playBtn.addEventListener("click", (e) => { e.stopPropagation(); playTrack(tracks[i], tracks, contextName); });
    const likeBtn = row.querySelector(".t-like");
    if (likeBtn) likeBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(tracks[i]); });
    row.querySelectorAll("a[data-stop]").forEach((a) => a.addEventListener("click", (e) => e.stopPropagation()));
  });
}

function bindCards(container) {
  container.querySelectorAll("[data-href]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-play-card]")) return;
      location.hash = el.dataset.href;
    });
  });
  container.querySelectorAll("[data-play-card]").forEach((el) => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      const [type, id] = el.dataset.playCard.split(":");
      await playContext(type, id);
    });
  });
}

async function playContext(type, id) {
  try {
    let tracks = [], name = "";
    if (type === "album") { const d = await api(`/api/album/${id}`); tracks = d.tracks || []; name = d.name; }
    else if (type === "playlist") { const d = await api(`/api/playlist/${id}`); tracks = d.tracks || []; name = d.name; }
    else if (type === "artist") { const d = await api(`/api/artist/${id}`); tracks = d.top_tracks || []; name = d.name; }
    if (!tracks.length) return toast("Nothing to play here", true);
    setQueue(tracks, 0, name);
  } catch (err) {
    toast(err.message, true);
  }
}

function loadingHTML() {
  return `<div class="loading"><span></span><span></span><span></span></div>`;
}

function errorHTML(err) {
  return `<div class="empty-state">
    ${icon("note")}
    <h2>Something went wrong</h2>
    <p>${esc(err.message || err)}</p>
    ${state.mode === "live" ? "<p style='margin-top:8px'>Tip: restart the server with <code>SPOTAPI_MODE=demo</code> to use the offline catalog.</p>" : ""}
  </div>`;
}

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------
const view = $("#view");

async function renderHome() {
  view.innerHTML = `<div class="view-inner">${loadingHTML()}</div>`;
  try {
    const data = await api("/api/home");
    const hour = new Date().getHours();
    const greeting = hour < 6 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const recents = store.recents;
    view.innerHTML = `<div class="view-inner">
      <h1 class="greeting">${greeting}</h1>
      <div class="quick-grid">
        ${(data.quick_picks || []).map((c) => `
          <button class="quick-card" data-href="${c.type === "playlist" ? `#/playlist/${c.id}` : c.type === "artist" ? `#/artist/${c.id}` : `#/album/${c.id}`}">
            ${c.cover ? `<img src="${esc(c.cover)}" alt="">` : ""}
            <span>${esc(c.name)}</span>
            <span class="card-play" data-play-card="${esc(c.type)}:${esc(c.id)}">${icon("play")}</span>
          </button>`).join("")}
      </div>
      ${recents.length ? `<section class="section">
        <div class="section-head"><h2>Recently played</h2></div>
        <div class="card-row">${recents.slice(0, 8).map(cardHTML).join("")}</div>
      </section>` : ""}
      ${(data.sections || []).filter((s) => s.items?.length).map((s) => `
        <section class="section">
          <div class="section-head"><h2>${esc(s.title)}</h2></div>
          <div class="card-row">${s.items.map(cardHTML).join("")}</div>
        </section>`).join("")}
    </div>`;
    bindCards(view);
  } catch (err) {
    view.innerHTML = `<div class="view-inner">${errorHTML(err)}</div>`;
  }
}

const BROWSE = [
  ["Chill", "#0d73ec"], ["Pop", "#e8115b"], ["Electronic", "#477d95"],
  ["Indie", "#ba5d07"], ["Ambient", "#8d67ab"], ["Jazz", "#d9a466"],
  ["Workout", "#e91429"], ["Focus", "#509bf5"], ["Rock", "#a56752"],
  ["Sleep", "#148a08"], ["Drive", "#af2896"], ["Jazz-Fusion", "#7c4dbb"],
];

function browseHTML() {
  return `
    <section class="section">
      <div class="section-head"><h2>Browse all</h2></div>
      <div class="browse-grid">
        ${BROWSE.map(([label, color]) => `
          <button class="browse-card" style="background:${color}" data-genre="${esc(label)}">${esc(label)}</button>`).join("")}
      </div>
    </section>`;
}

function bindBrowse(container, input) {
  container.querySelectorAll("[data-genre]").forEach((el) =>
    el.addEventListener("click", () => {
      input.value = el.dataset.genre;
      runSearch(el.dataset.genre);
    }));
}

function renderSearchShell() {
  view.innerHTML = `<div class="view-inner">
    <div class="search-bar">
      ${icon("search")}
      <input id="search-input" type="text" placeholder="What do you want to listen to?" autocomplete="off" spellcheck="false">
    </div>
    <div id="search-results">${browseHTML()}</div>
  </div>`;

  const input = $("#search-input");
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    timer = setTimeout(() => runSearch(q), 300);
  });
  bindBrowse(view, input);
  input.focus();
}

async function runSearch(q) {
  const box = $("#search-results");
  if (!box) return;
  if (!q) {
    box.innerHTML = browseHTML();
    const input = $("#search-input");
    if (input) bindBrowse(box, input);
    return;
  }
  box.innerHTML = loadingHTML();
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(q)}&limit=10`);
    const tracks = data.tracks || [];
    const top = data.top_result;

    const topHTML = top ? (() => {
      const item = top.item;
      const cover = item.cover || item.image || "";
      const sub = top.type === "track"
        ? `${item.artists?.map((a) => a.name).join(", ")}`
        : (item.subtitle || "");
      return `
      <div class="top-result" data-href="${top.type === "artist" ? `#/artist/${item.id}` : top.type === "playlist" ? `#/playlist/${item.id}` : top.type === "album" ? `#/album/${item.id}` : ""}">
        ${cover ? `<img src="${esc(cover)}" alt="">` : ""}
        <h3>${esc(item.name)}</h3>
        <div style="color:var(--text-dim);font-size:14px">${esc(sub)}</div>
        <span class="tr-type">${esc(top.type)}</span>
        ${top.type !== "track" ? `<span class="card-play" data-play-card="${esc(top.type)}:${esc(item.id)}">${icon("play")}</span>`
          : `<span class="card-play" data-top-track="${esc(item.id)}">${icon("play")}</span>`}
      </div>`;
    })() : `<div class="empty-state"><h2>No results for "${esc(q)}"</h2><p>Check the spelling, or try a different search.</p></div>`;

    box.innerHTML = `
      ${top ? `<div class="search-layout">
        <section class="results-block"><h2>Top result</h2>${topHTML}</section>
        ${tracks.length ? `<section class="results-block"><h2>Songs</h2>${trackTableHTML(tracks.slice(0, 6), { header: false })}</section>` : ""}
      </div>` : topHTML}
      ${data.albums?.length ? `<section class="results-block"><h2>Albums</h2><div class="card-row">${data.albums.map(cardHTML).join("")}</div></section>` : ""}
      ${data.artists?.length ? `<section class="results-block"><h2>Artists</h2><div class="card-row">${data.artists.map(cardHTML).join("")}</div></section>` : ""}
      ${data.playlists?.length ? `<section class="results-block"><h2>Playlists</h2><div class="card-row">${data.playlists.map(cardHTML).join("")}</div></section>` : ""}
    `;

    bindCards(box);
    bindTrackTable(box, tracks.slice(0, 6), `Search: ${q}`);
    const topTrackBtn = box.querySelector("[data-top-track]");
    if (topTrackBtn && top) topTrackBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playTrack(top.item, tracks.length ? tracks : [top.item], `Search: ${q}`);
    });
    highlightPlayingRow();
  } catch (err) {
    box.innerHTML = errorHTML(err);
  }
}

async function renderDetail(kind, id) {
  view.innerHTML = loadingHTML();
  try {
    const data = await api(`/api/${kind}/${id}`);
    const isArtist = kind === "artist";
    const tracks = isArtist ? (data.top_tracks || []) : (data.tracks || []);
    const cover = isArtist ? data.image : data.cover;
    const meta = isArtist
      ? `${data.listeners ? fmtCompact(data.listeners) + " monthly listeners • " : ""}${(data.genres || []).slice(0, 3).join(", ")}`
      : kind === "album"
        ? `${data.artists?.map((a) => a.name).join(", ") || ""} • ${data.year || ""} • ${tracks.length} songs`
        : `${esc(data.description || "")} • ${tracks.length} songs`;

    view.innerHTML = `
      <div class="detail-hero ${isArtist ? "artist-hero" : ""}" id="hero">
        ${cover ? `<img id="hero-img" crossorigin="anonymous" src="${esc(cover)}" alt="">` : ""}
        <div>
          <div class="hero-type">${esc(kind)}</div>
          <h1>${esc(data.name)}</h1>
          <div class="hero-meta">${meta}</div>
        </div>
      </div>
      <div class="detail-body">
        <div class="hero-actions">
          <button class="hero-play" id="hero-play" title="Play">${icon("play")}</button>
          ${data.uri && data.uri.startsWith("spotify:") ? `<a class="hero-link" href="${esc(spotifyWebUrl(data.uri))}" target="_blank" rel="noopener">${icon("external")} Open in Spotify</a>` : ""}
        </div>
        ${isArtist && data.blurb ? `<p style="color:var(--text-dim);margin-bottom:22px">${esc(data.blurb)}</p>` : ""}
        ${tracks.length ? `<section class="results-block">${isArtist ? "<h2>Popular</h2>" : ""}${trackTableHTML(tracks, { header: !isArtist })}</section>` : ""}
        ${isArtist && data.albums?.length ? `<section class="results-block"><h2>Discography</h2><div class="card-row">${data.albums.map(cardHTML).join("")}</div></section>` : ""}
        ${!isArtist && data.more_by?.length ? `<section class="results-block"><h2>More by ${esc(data.artists?.[0]?.name || "this artist")}</h2><div class="card-row">${data.more_by.map(cardHTML).join("")}</div></section>` : ""}
      </div>`;

    applyHeroGradient($("#hero"));
    $("#hero-play").addEventListener("click", () => {
      if (!tracks.length) return toast("Nothing to play here", true);
      setQueue(tracks, 0, data.name);
    });
    bindCards(view);
    bindTrackTable(view, tracks, data.name);
    highlightPlayingRow();
  } catch (err) {
    view.innerHTML = `<div class="view-inner">${errorHTML(err)}</div>`;
  }
}

function renderLiked() {
  const tracks = Object.values(store.likes);
  if (!tracks.length) {
    view.innerHTML = `<div class="view-inner"><div class="empty-state">
      ${icon("heart-fill")}
      <h2>Songs you like will appear here</h2>
      <p>Save songs by clicking the heart icon.</p>
    </div></div>`;
    return;
  }
  view.innerHTML = `
    <div class="detail-hero" id="hero" style="--hero:#5037a3">
      <div style="width:216px;height:216px;border-radius:6px;background:linear-gradient(135deg,#7c4dbb,#1db954);display:grid;place-items:center;box-shadow:0 16px 48px rgba(0,0,0,.55);flex-shrink:0">
        <svg style="width:80px;height:80px;color:#fff"><use href="#i-heart-fill"/></svg>
      </div>
      <div>
        <div class="hero-type">Playlist</div>
        <h1>Liked Songs</h1>
        <div class="hero-meta">${tracks.length} liked songs</div>
      </div>
    </div>
    <div class="detail-body">
      <div class="hero-actions">
        <button class="hero-play" id="hero-play" title="Play">${icon("play")}</button>
      </div>
      ${trackTableHTML(tracks)}
    </div>`;
  $("#hero-play").addEventListener("click", () => setQueue(tracks, 0, "Liked Songs"));
  bindCards(view);
  bindTrackTable(view, tracks, "Liked Songs");
  highlightPlayingRow();
}

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------
function setActiveNav(route) {
  $$(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.nav === route));
}

function route() {
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\//, "").split("/").filter(Boolean);
  $("#queue-panel").classList.add("hidden");
  view.scrollTop = 0;

  if (parts.length === 0) { setActiveNav("home"); renderHome(); }
  else if (parts[0] === "search") { setActiveNav("search"); renderSearchShell(); }
  else if (parts[0] === "liked") { setActiveNav("liked"); renderLiked(); }
  else if (parts[0] === "album" && parts[1]) { setActiveNav(""); renderDetail("album", parts[1]); }
  else if (parts[0] === "artist" && parts[1]) { setActiveNav(""); renderDetail("artist", parts[1]); }
  else if (parts[0] === "playlist" && parts[1]) { setActiveNav(""); renderDetail("playlist", parts[1]); }
  else { setActiveNav("home"); renderHome(); }
}

window.addEventListener("hashchange", route);

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
async function boot() {
  try {
    const status = await api("/api/status");
    state.mode = status.mode;
    const badge = $("#mode-badge");
    badge.classList.add(status.mode);
    badge.textContent = status.mode === "live" ? "LIVE · SPOTIFY" : "DEMO MODE";
    badge.title = status.mode === "live"
      ? "Serving live Spotify metadata via spotapi"
      : `Offline demo catalog${status.live_error ? ` (live unavailable: ${status.live_error})` : ""}`;
  } catch { /* keep default */ }

  api("/api/library/playlists").then((data) => {
    $("#sidebar-playlists").innerHTML = (data.items || []).map((p) =>
      `<a href="#/playlist/${esc(p.id)}">${esc(p.name)}</a>`).join("");
  }).catch(() => {});

  route();
}

boot();
