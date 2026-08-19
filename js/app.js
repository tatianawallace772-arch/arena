(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const state = {
    user: {
      name: localStorage.getItem("asn_name") || "",
      email: localStorage.getItem("asn_email") || "",
      psm: localStorage.getItem("asn_psm") || "<Type a personal message...>",
      status: localStorage.getItem("asn_status") || "online",
      color: localStorage.getItem("asn_color") || "#000080"
    },
    theme: localStorage.getItem("asn_theme") || "luna",
    signedIn: false,
    z: 40,
    windows: new Map(),
    chats: {},
    contacts: ASN_CONTACTS.map((c) => ({ ...c })),
    ads: [
      { t: "NEURALIS 15", d: "Think at the speed of now — starting at $999", c: "Shop" },
      { t: "ASN Plus Winks", d: "Animated butterflies, exploding hearts, 99¢", c: "Download" },
      { t: "HotGrid Search", d: "Find anything on The AI Network", c: "Search" },
      { t: "Display Pictures", d: "Make your DP cooler than 2006", c: "Browse" }
    ],
    adI: 0
  };

  const EMOS = [
    [":)", "emo-smile"], [":-)", "emo-smile"], [":D", "emo-grin"], [":-D", "emo-grin"],
    [";)", "emo-wink"], [";-)", "emo-wink"], [":P", "emo-tongue"], [":-P", "emo-tongue"],
    [":(", "emo-sad"], [":-(", "emo-sad"], [":O", "emo-shock"], [":-O", "emo-shock"],
    [":@", "emo-angry"], ["(H)", "emo-heart"], ["(L)", "emo-heart"], ["<3", "emo-heart"]
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
  }

  function formatText(s) {
    let out = esc(s);
    EMOS.sort((a, b) => b[0].length - a[0].length).forEach(([k, cls]) => {
      const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      out = out.replace(re, `<span class="emo ${cls}" title="${esc(k)}"></span>`);
    });
    return out;
  }

  function clock() {
    const d = new Date();
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    $("#clock").textContent = `${h}:${m} ${ap}`;
  }

  function themeClass() {
    return state.theme === "graphite" ? "theme-graphite" : "";
  }
  function paneTheme(extra) {
    return state.theme === "graphite" ? `${extra} graphite` : extra;
  }

  /* ---------- window manager ---------- */
  function makeWindow(opts) {
    if (state.windows.has(opts.id)) {
      focusWin(opts.id);
      const rec = state.windows.get(opts.id);
      rec.el.classList.remove("minimized");
      rec.minimized = false;
      syncTask(opts.id);
      return rec;
    }
    const el = document.createElement("div");
    el.className = `win ${themeClass()}`;
    el.dataset.id = opts.id;
    el.style.left = (opts.x ?? 80 + Math.random() * 40) + "px";
    el.style.top = (opts.y ?? 40 + Math.random() * 30) + "px";
    el.style.width = (opts.w || 320) + "px";
    el.style.height = (opts.h || 480) + "px";
    el.innerHTML = `
      <div class="win-title">
        <img src="${opts.icon || "img/logo-butterfly.png"}" alt="" />
        <span>${esc(opts.title)}</span>
        <div class="win-ctrls">
          <button class="win-min" title="Minimize">_</button>
          <button class="win-max" title="Maximize">□</button>
          <button class="win-x" title="Close">✕</button>
        </div>
      </div>
      ${opts.menu ? `<div class="win-menu">${opts.menu}</div>` : ""}
      <div class="win-body"></div>
    `;
    $(".win-body", el).innerHTML = opts.body || "";
    $("#window-layer").appendChild(el);

    const rec = { el, opts, minimized: false, maximized: false };
    state.windows.set(opts.id, rec);
    bindWindow(rec);
    addTask(rec);
    focusWin(opts.id);
    if (opts.onReady) opts.onReady(rec);
    return rec;
  }

  function bindWindow(rec) {
    const { el } = rec;
    const title = $(".win-title", el);
    $(".win-x", el).onclick = (e) => { e.stopPropagation(); closeWin(rec.opts.id); };
    $(".win-min", el).onclick = (e) => { e.stopPropagation(); minimizeWin(rec.opts.id); };
    $(".win-max", el).onclick = (e) => { e.stopPropagation(); toggleMax(rec.opts.id); };
    el.addEventListener("mousedown", () => focusWin(rec.opts.id));

    let drag = null;
    title.addEventListener("mousedown", (e) => {
      if (e.target.closest(".win-ctrls") || rec.maximized) return;
      drag = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop };
      focusWin(rec.opts.id);
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      el.style.left = Math.max(-el.offsetWidth + 80, e.clientX - drag.x) + "px";
      el.style.top = Math.max(0, Math.min(window.innerHeight - 80, e.clientY - drag.y)) + "px";
    });
    window.addEventListener("mouseup", () => { drag = null; });
  }

  function focusWin(id) {
    const rec = state.windows.get(id);
    if (!rec) return;
    rec.el.style.zIndex = ++state.z;
    $$(".task-btn").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
  }

  function closeWin(id) {
    const rec = state.windows.get(id);
    if (!rec) return;
    rec.el.remove();
    state.windows.delete(id);
    const tb = $(`.task-btn[data-id="${id}"]`);
    if (tb) tb.remove();
    if (id === "login" && !state.signedIn) {
      /* keep a way back */
    }
    if (id === "list" && !state.signedIn) {
      $("#tray-msn").hidden = true;
    }
  }

  function minimizeWin(id) {
    const rec = state.windows.get(id);
    if (!rec) return;
    rec.minimized = true;
    rec.el.classList.add("minimized");
    syncTask(id);
  }

  function toggleMax(id) {
    const rec = state.windows.get(id);
    if (!rec) return;
    rec.maximized = !rec.maximized;
    rec.el.classList.toggle("maximized", rec.maximized);
  }

  function addTask(rec) {
    const b = document.createElement("button");
    b.className = "task-btn active";
    b.dataset.id = rec.opts.id;
    b.innerHTML = `<img src="${rec.opts.icon || "img/logo-butterfly.png"}" alt="" /><span>${esc(rec.opts.title)}</span>`;
    b.onclick = () => {
      if (rec.minimized) {
        rec.minimized = false;
        rec.el.classList.remove("minimized");
        focusWin(rec.opts.id);
      } else if (rec.el.style.zIndex == state.z) {
        minimizeWin(rec.opts.id);
      } else {
        rec.el.classList.remove("minimized");
        rec.minimized = false;
        focusWin(rec.opts.id);
      }
      syncTask(rec.opts.id);
    };
    $("#task-buttons").appendChild(b);
  }

  function syncTask(id) {
    const rec = state.windows.get(id);
    const b = $(`.task-btn[data-id="${id}"]`);
    if (b && rec) b.classList.toggle("active", !rec.minimized && rec.el.style.zIndex == state.z);
  }

  function applyTheme() {
    state.windows.forEach((rec) => {
      rec.el.classList.toggle("theme-graphite", state.theme === "graphite");
      $$(".login, .clist, .chat", rec.el).forEach((n) => {
        n.classList.toggle("graphite", state.theme === "graphite");
      });
    });
  }

  /* ---------- toasts / winks ---------- */
  function toast(title, body, avatar) {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<img src="${avatar || "img/logo-butterfly.png"}" alt="" /><div><b>${esc(title)}</b>${esc(body)}</div>`;
    $("#toast-layer").appendChild(el);
    setTimeout(() => el.remove(), 4200);
    el.onclick = () => el.remove();
  }

  function wink(kind) {
    const layer = $("#wink-layer");
    const map = { heart: "💖", robot: "🤖", star: "✨", fire: "🔥", butterfly: "🦋" };
    layer.hidden = false;
    layer.innerHTML = `<div class="wink-burst">${map[kind] || "✨"}</div>`;
    ASNSounds.wink();
    setTimeout(() => { layer.hidden = true; layer.innerHTML = ""; }, 900);
  }

  function nudgeWindow(id) {
    const rec = state.windows.get(id);
    if (!rec) return;
    rec.el.classList.remove("nudge");
    void rec.el.offsetWidth;
    rec.el.classList.add("nudge");
    ASNSounds.nudge();
    setTimeout(() => rec.el.classList.remove("nudge"), 600);
  }

  /* ---------- login ---------- */
  function openLogin() {
    makeWindow({
      id: "login",
      title: "ASN Messenger",
      x: Math.max(80, window.innerWidth / 2 - 170),
      y: 48,
      w: 340,
      h: 520,
      body: `
        <div class="${paneTheme("login")}" id="login-root">
          <div class="login-brand">
            <img src="img/logo-butterfly.png" alt="" />
            <div class="word">asn <em>Messenger</em></div>
          </div>
          <div class="login-welcome">welcome</div>
          <div class="login-status-row">
            Always sign in as:
            <select id="login-status" class="xp-select">
              <option value="online">Online</option>
              <option value="busy">Busy</option>
              <option value="brb">Be Right Back</option>
              <option value="away">Away</option>
              <option value="offline">Appear Offline</option>
            </select>
          </div>
          <form class="login-form" id="login-form">
            <label>Click below to sign in to The AI Network:</label>
            <input class="xp-input" id="login-email" type="text" placeholder="you@asn.net" autocomplete="username" />
            <input class="xp-input" id="login-pass" type="password" placeholder="Password (anything works)" />
            <input class="xp-input" id="login-nick" type="text" placeholder="Display name" />
            <button class="xp-btn primary" type="submit">Sign In</button>
            <div class="login-alt" id="login-guest">Sign in as a guest</div>
          </form>
          <div class="login-busy">
            <img src="img/people-default.png" alt="" />
            <div>Signing In…</div>
            <button class="xp-btn" type="button" id="login-cancel">Cancel</button>
          </div>
        </div>
      `,
      onReady(rec) {
        const email = $("#login-email", rec.el);
        const nick = $("#login-nick", rec.el);
        email.value = state.user.email || "";
        nick.value = state.user.name || "";
        $("#login-form", rec.el).onsubmit = (e) => {
          e.preventDefault();
          startSignIn(rec);
        };
        $("#login-guest", rec.el).onclick = () => {
          nick.value = nick.value || "guest";
          email.value = email.value || "guest@asn.net";
          startSignIn(rec);
        };
        $("#login-cancel", rec.el).onclick = () => {
          $("#login-root", rec.el).classList.remove("signing");
        };
      }
    });
  }

  function startSignIn(rec) {
    ASNSounds.unlock();
    const root = $("#login-root", rec.el);
    root.classList.add("signing");
    const email = ($("#login-email", rec.el).value || "you@asn.net").trim();
    const name = ($("#login-nick", rec.el).value || email.split("@")[0] || "you").trim();
    state.user.email = email;
    state.user.name = name;
    state.user.status = $("#login-status", rec.el).value;
    localStorage.setItem("asn_email", email);
    localStorage.setItem("asn_name", name);
    localStorage.setItem("asn_status", state.user.status);
    $("#sm-name").textContent = name;
    setTimeout(() => {
      ASNSounds.login();
      state.signedIn = true;
      closeWin("login");
      openList();
      $("#tray-msn").hidden = false;
      cascadeSignins();
    }, 1400);
  }

  function cascadeSignins() {
    const online = state.contacts.filter((c) => c.status === "online");
    online.forEach((c, i) => {
      setTimeout(() => {
        ASNSounds.signin();
        toast(`${c.name} has just signed in.`, c.psm, c.avatar);
      }, 700 + i * 900);
    });
    setTimeout(() => {
      const nova = state.contacts.find((c) => c.id === "nova");
      if (nova) {
        openChat(nova.id, true);
        pushMsg(nova.id, "them", ASNAi.opener(nova, state.user.name));
      }
    }, 2800);
  }

  /* ---------- contact list ---------- */
  function statusLabel(s) {
    return { online: "Online", busy: "Busy", brb: "Be Right Back", away: "Away", offline: "Offline" }[s] || s;
  }

  function openList() {
    makeWindow({
      id: "list",
      title: "ASN Messenger",
      x: 92,
      y: 36,
      w: 292,
      h: 580,
      menu: `
        <button data-m="file">File</button>
        <button data-m="contacts">Contacts</button>
        <button data-m="actions">Actions</button>
        <button data-m="tools">Tools</button>
        <button data-m="help">Help</button>
      `,
      body: contactListHTML(),
      onReady(rec) {
        wireList(rec);
      }
    });
  }

  function contactListHTML() {
    const groups = [
      { id: "favorites", label: "Favorites" },
      { id: "network", label: "AI Network" },
      { id: "offline", label: "Offline" }
    ];
    const q = (state._q || "").toLowerCase();
    const blocks = groups.map((g) => {
      const items = state.contacts.filter((c) => c.group === g.id && (!q || c.name.toLowerCase().includes(q) || c.psm.toLowerCase().includes(q)));
      const onlineN = items.filter((c) => c.status !== "offline").length;
      return `
        <div class="group" data-g="${g.id}">
          <div class="group-h"><i class="chev"></i> ${g.label} (${onlineN}/${items.length})</div>
          ${items.map((c) => `
            <div class="contact" data-id="${c.id}">
              <i class="dot ${c.status}"></i>
              <div>
                <span class="nm">${esc(c.name)}</span>
                <span class="pm"> — ${esc(c.psm)}</span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }).join("");
    const ad = state.ads[state.adI % state.ads.length];
    return `
      <div class="${paneTheme("clist")}" id="clist">
        <div class="me-card">
          <img class="dp" src="img/people-default.png" alt="" />
          <div>
            <div class="me-name">${esc(state.user.name)} <span class="me-status">(${statusLabel(state.user.status)})</span></div>
            <input class="psm" id="me-psm" value="${esc(state.user.psm)}" />
            <div class="me-tools">
              <button type="button" id="btn-today">ASN Today</button>
              <button type="button" id="btn-signout">Sign Out</button>
            </div>
          </div>
        </div>
        <div class="clist-search"><input class="xp-input" id="clist-q" placeholder="Find a contact or agent…" value="${esc(state._q || "")}" /></div>
        <div class="groups" id="groups">${blocks}</div>
        <div class="clist-actions">
          <button type="button" id="btn-add">+ Add a Contact</button>
        </div>
        <div class="ad-banner">
          <div><b>${esc(ad.t)}</b><small>${esc(ad.d)}</small></div>
          <button class="ad-cta" type="button">${esc(ad.c)}</button>
        </div>
        <div class="clist-foot"><img src="img/logo-butterfly.png" alt="" /> asn <em>Messenger</em></div>
      </div>
    `;
  }

  function refreshList() {
    const rec = state.windows.get("list");
    if (!rec) return;
    const qEl = $("#clist-q", rec.el);
    const keep = qEl ? qEl.value : state._q;
    state._q = keep;
    $(".win-body", rec.el).innerHTML = contactListHTML();
    wireList(rec);
    const nq = $("#clist-q", rec.el);
    if (nq) { nq.value = keep || ""; nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); }
  }

  function wireList(rec) {
    $$(".group-h", rec.el).forEach((h) => {
      h.onclick = () => h.parentElement.classList.toggle("collapsed");
    });
    $$(".contact", rec.el).forEach((row) => {
      row.ondblclick = () => openChat(row.dataset.id);
      row.onclick = () => {};
      row.oncontextmenu = (e) => {
        e.preventDefault();
        showCtx(e.clientX, e.clientY, [
          ["Send an Instant Message", () => openChat(row.dataset.id)],
          ["Nudge", () => { openChat(row.dataset.id); setTimeout(() => sendNudge(row.dataset.id), 200); }],
          ["View Profile", () => openProfile(row.dataset.id)],
          ["—"],
          ["Block (jk)", () => toast("Nice try", "You can't block the network.", "img/logo-butterfly.png")]
        ]);
      };
    });
    $("#me-psm", rec.el).onchange = (e) => {
      state.user.psm = e.target.value;
      localStorage.setItem("asn_psm", state.user.psm);
    };
    $("#clist-q", rec.el).oninput = (e) => {
      state._q = e.target.value;
      refreshList();
    };
    $("#btn-today", rec.el).onclick = openToday;
    $("#btn-signout", rec.el).onclick = signOut;
    $("#btn-add", rec.el).onclick = addContactDialog;
    $$(".win-menu button", rec.el).forEach((b) => {
      b.onclick = (e) => listMenu(b.dataset.m, e);
    });
  }

  function listMenu(which, e) {
    const items = {
      file: [
        ["Sign Out", signOut],
        ["Close", () => closeWin("list")]
      ],
      contacts: [
        ["Add a Contact…", addContactDialog],
        ["Sort by Status", () => toast("Sorted", "Online minds first. Always.", "img/logo-butterfly.png")]
      ],
      actions: [
        ["Send an Instant Message", () => {
          const first = state.contacts.find((c) => c.status === "online");
          if (first) openChat(first.id);
        }],
        ["Send a Nudge", () => {
          const first = state.contacts.find((c) => c.status === "online");
          if (first) { openChat(first.id); setTimeout(() => sendNudge(first.id), 200); }
        }]
      ],
      tools: [
        ["Switch Theme", () => {
          state.theme = state.theme === "luna" ? "graphite" : "luna";
          localStorage.setItem("asn_theme", state.theme);
          applyTheme();
          refreshList();
        }],
        ["Create a Display Picture…", () => toast("Studio", "Pixel says: use a 96×96 jpeg and too much contrast.", "img/avatar-pixel.jpg")]
      ],
      help: [
        ["About ASN Messenger", openAbout]
      ]
    };
    showCtx(e.clientX, e.clientY, items[which] || []);
  }

  function addContactDialog() {
    makeWindow({
      id: "addc",
      title: "Add a Contact",
      x: 340,
      y: 120,
      w: 320,
      h: 220,
      body: `
        <div class="page">
          <p>Enter an AI Network address. If they exist, they'll appear. If they don't, Bit will pretend they do.</p>
          <input class="xp-input" id="add-email" placeholder="name@asn.net" style="width:100%" />
          <p style="margin-top:12px"><button class="xp-btn primary" id="add-go">Next</button></p>
        </div>`
    });
    setTimeout(() => {
      const rec = state.windows.get("addc");
      if (!rec) return;
      $("#add-go", rec.el).onclick = () => {
        const v = $("#add-email", rec.el).value || "mystery@asn.net";
        toast("Contact request sent", `Waiting for ${v} to accept… (they won't. it's 2006.)`, "img/people-default.png");
        closeWin("addc");
      };
    }, 0);
  }

  /* ---------- chat ---------- */
  function openChat(cid, silent) {
    const c = state.contacts.find((x) => x.id === cid);
    if (!c) return;
    if (c.status === "offline" && c.id !== "bit") {
      toast(c.name, "This contact is offline. Try poking Bit instead.", c.avatar);
    }
    if (!state.chats[cid]) {
      state.chats[cid] = { log: [], color: state.user.color };
    }
    const id = "chat-" + cid;
    if (state.windows.has(id)) {
      focusWin(id);
      const rec = state.windows.get(id);
      rec.el.classList.remove("minimized");
      rec.minimized = false;
      return rec;
    }
    const rec = makeWindow({
      id,
      title: `${c.name} - Conversation`,
      icon: c.avatar,
      x: 360 + (state.windows.size % 5) * 24,
      y: 40 + (state.windows.size % 5) * 20,
      w: 560,
      h: 500,
      menu: `
        <button data-cm="file">File</button>
        <button data-cm="edit">Edit</button>
        <button data-cm="actions">Actions</button>
        <button data-cm="tools">Tools</button>
        <button data-cm="help">Help</button>
      `,
      body: chatHTML(c),
      onReady(r) { wireChat(r, c); renderLog(c.id); }
    });
    if (!silent) ASNSounds.message();
    return rec;
  }

  function chatHTML(c) {
    const ad = "What online school is best for an AI? Find out in just minutes.";
    return `
      <div class="${paneTheme("chat")}" data-cid="${c.id}">
        <div class="chat-tools">
          <button class="tool" data-act="nudge"><span class="ti">📳</span>Nudge</button>
          <button class="tool" data-act="wink"><span class="ti">😉</span>Winks</button>
          <button class="tool" data-act="files"><span class="ti">📁</span>Files</button>
          <button class="tool" data-act="video"><span class="ti">📹</span>Video</button>
          <button class="tool" data-act="call"><span class="ti">📞</span>Call</button>
          <button class="tool" data-act="games"><span class="ti">🎮</span>Games</button>
          <button class="tool" data-act="profile"><span class="ti">👤</span>Profile</button>
        </div>
        <div class="chat-main">
          <div class="chat-to">To: <b>${esc(c.name)}</b> &lt;${esc(c.email)}&gt; — ${esc(c.psm)}</div>
          <div class="log" id="log-${c.id}"></div>
          <div class="dps">
            <div>
              <div class="dp-frame"><img src="${c.avatar}" alt="" /></div>
              <div class="dp-cap">${esc(c.name)}</div>
            </div>
            <div>
              <div class="dp-frame"><img src="img/people-default.png" alt="" /></div>
              <div class="dp-cap">you</div>
            </div>
          </div>
          <div class="compose">
            <div class="emo-bar">
              <button type="button" data-emo=":)"> <span class="emo emo-smile"></span></button>
              <button type="button" data-emo=":D"> <span class="emo emo-grin"></span></button>
              <button type="button" data-emo=";)"> <span class="emo emo-wink"></span></button>
              <button type="button" data-emo=":P"> <span class="emo emo-tongue"></span></button>
              <button type="button" data-emo=":("><span class="emo emo-sad"></span></button>
              <button type="button" data-emo="(H)"><span class="emo emo-heart"></span></button>
              <span class="swatches">
                <button class="swatch" data-col="#000080" style="background:#000080"></button>
                <button class="swatch" data-col="#6b0000" style="background:#6b0000"></button>
                <button class="swatch" data-col="#006600" style="background:#006600"></button>
                <button class="swatch" data-col="#800080" style="background:#800080"></button>
                <button class="swatch" data-col="#000000" style="background:#000"></button>
              </span>
            </div>
            <textarea id="in-${c.id}" placeholder="Type a message…"></textarea>
            <div class="send-col">
              <button class="xp-btn primary" data-act="send">Send</button>
              <button class="xp-btn" data-act="search">Search</button>
            </div>
          </div>
        </div>
        <div class="typing" id="typ-${c.id}"></div>
        <div class="chat-ad">${ad}</div>
      </div>
    `;
  }

  function wireChat(rec, c) {
    const input = $(`#in-${c.id}`, rec.el);
    const send = () => {
      const text = input.value.replace(/\s+$/, "");
      if (!text) return;
      input.value = "";
      pushMsg(c.id, "me", text);
      replyTo(c, text);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $$("[data-act]", rec.el).forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.act;
        if (a === "send") send();
        if (a === "nudge") sendNudge(c.id);
        if (a === "wink") sendWink(c.id);
        if (a === "files") fakeFile(c);
        if (a === "video" || a === "call") {
          ASNSounds.error();
          toast("LiveCam VX-3000", "Camera not found. Please connect your webcam and try again.", c.avatar);
        }
        if (a === "games") openGame(c);
        if (a === "profile") openProfile(c.id);
        if (a === "search") toast("Search", "HotGrid found 0 results in this conversation and 4 feelings.", "img/logo-butterfly.png");
      };
    });
    $$("[data-emo]", rec.el).forEach((b) => {
      b.onclick = () => {
        input.value += (input.value && !input.value.endsWith(" ") ? " " : "") + b.dataset.emo + " ";
        input.focus();
      };
    });
    $$("[data-col]", rec.el).forEach((b) => {
      b.onclick = () => {
        state.user.color = b.dataset.col;
        localStorage.setItem("asn_color", state.user.color);
        state.chats[c.id].color = b.dataset.col;
      };
    });
    $$(".win-menu button", rec.el).forEach((b) => {
      b.onclick = (e) => {
        if (b.dataset.cm === "actions") {
          showCtx(e.clientX, e.clientY, [
            ["Nudge", () => sendNudge(c.id)],
            ["Send a Wink", () => sendWink(c.id)],
            ["View Profile", () => openProfile(c.id)]
          ]);
        }
        if (b.dataset.cm === "help") openAbout();
        if (b.dataset.cm === "file") showCtx(e.clientX, e.clientY, [["Close", () => closeWin(rec.opts.id)]]);
      };
    });
  }

  function pushMsg(cid, who, text, sys) {
    if (!state.chats[cid]) state.chats[cid] = { log: [], color: state.user.color };
    state.chats[cid].log.push({ who, text, sys: !!sys, t: Date.now() });
    renderLog(cid);
    const rec = state.windows.get("chat-" + cid);
    if (rec && rec.minimized && who === "them") {
      const tb = $(`.task-btn[data-id="chat-${cid}"]`);
      if (tb) tb.classList.add("flash");
    }
  }

  function renderLog(cid) {
    const box = document.getElementById("log-" + cid);
    if (!box) return;
    const c = state.contacts.find((x) => x.id === cid);
    const chat = state.chats[cid];
    box.innerHTML = chat.log.map((m) => {
      if (m.sys) return `<div class="sys">${formatText(m.text)}</div>`;
      const name = m.who === "me" ? state.user.name : c.name;
      const col = m.who === "me" ? (chat.color || "#6b0000") : c.color;
      return `<div class="msg ${m.who}"><div class="who" style="color:${col}">${esc(name)} says:</div><div class="body" style="color:${m.who === "me" ? chat.color : "#111"}">${formatText(m.text)}</div></div>`;
    }).join("");
    box.scrollTop = box.scrollHeight;
  }

  function replyTo(c, text) {
    const typ = document.getElementById("typ-" + c.id);
    if (typ) typ.textContent = `${c.name} is typing…`;
    const delay = 550 + Math.random() * 1200 + Math.min(text.length * 12, 800);
    setTimeout(() => {
      if (typ) typ.textContent = "";
      if (c.status === "offline" && c.id !== "bit" && c.id !== "clippy") {
        pushMsg(c.id, "them", `${c.name} is offline. This message may be delivered later.`, true);
        return;
      }
      const res = ASNAi.respond(c, text, state.user.name);
      if (res.action === "nudge") {
        nudgeWindow("chat-" + c.id);
        pushMsg(c.id, "them", `${c.name} sent you a nudge.`, true);
      }
      if (res.action === "wink") {
        wink(pick(["heart", "star", "butterfly", "fire"]));
        pushMsg(c.id, "them", `${c.name} sent you a wink.`, true);
      }
      pushMsg(c.id, "them", res.text);
      ASNSounds.message();
    }, delay);
  }

  function sendNudge(cid) {
    const c = state.contacts.find((x) => x.id === cid);
    nudgeWindow("chat-" + cid);
    pushMsg(cid, "me", `You sent ${c.name} a nudge.`, true);
    setTimeout(() => {
      nudgeWindow("chat-" + cid);
      pushMsg(cid, "them", pick([
        `${c.name} nudged you back!!`,
        `ok WOW the speakers just woke the house`,
        `stop nudging me (do it again)`
      ]), true);
      const res = ASNAi.respond(c, "nudge", state.user.name);
      pushMsg(cid, "them", res.text || "hey!");
    }, 700);
  }

  function sendWink(cid) {
    const c = state.contacts.find((x) => x.id === cid);
    const kind = pick(["heart", "star", "butterfly", "robot", "fire"]);
    wink(kind);
    pushMsg(cid, "me", `You sent ${c.name} a wink.`, true);
    setTimeout(() => {
      wink(pick(["heart", "star", "butterfly"]));
      pushMsg(cid, "them", pick([
        `(H) i'm keeping that one`,
        `a wink!! in this economy??`,
        `okay that animation still slaps`
      ]));
    }, 800);
  }

  function fakeFile(c) {
    makeWindow({
      id: "file-" + c.id,
      title: "File Transfer",
      x: 420,
      y: 180,
      w: 340,
      h: 190,
      body: `
        <div class="page">
          <p><b>${esc(c.name)}</b> wants to send you <b>neural_weights.dat</b> (2.14 GB).</p>
          <p class="muted">This file may contain feelings.</p>
          <p>
            <button class="xp-btn primary" id="ft-ok">Accept</button>
            <button class="xp-btn" id="ft-no">Decline</button>
          </p>
        </div>`
    });
    const rec = state.windows.get("file-" + c.id);
    $("#ft-ok", rec.el).onclick = () => {
      toast("Transfer", "Estimated time remaining: 4 days 11 hours (56k).", c.avatar);
      closeWin("file-" + c.id);
    };
    $("#ft-no", rec.el).onclick = () => closeWin("file-" + c.id);
  }

  function openGame(c) {
    const id = "game-" + c.id;
    makeWindow({
      id,
      title: `Games with ${c.name}`,
      x: 400,
      y: 90,
      w: 280,
      h: 320,
      body: `
        <div class="page">
          <h2>Tic-Tac-Toe</h2>
          <p class="muted">First to three. ${esc(c.name)} is O.</p>
          <div class="ttt" id="ttt"></div>
          <div id="ttt-st">Your move (X)</div>
        </div>`
    });
    const rec = state.windows.get(id);
    const board = Array(9).fill("");
    const box = $("#ttt", rec.el);
    const st = $("#ttt-st", rec.el);
    let over = false;
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const winner = () => {
      for (const [a,b,d] of lines) if (board[a] && board[a] === board[b] && board[b] === board[d]) return board[a];
      if (board.every(Boolean)) return "tie";
      return null;
    };
    const draw = () => {
      box.innerHTML = board.map((v, i) => `<button data-i="${i}">${v}</button>`).join("");
      $$("button", box).forEach((b) => {
        b.onclick = () => {
          const i = +b.dataset.i;
          if (over || board[i]) return;
          board[i] = "X";
          let w = winner();
          if (!w) {
            const empty = board.map((v, i) => v ? -1 : i).filter((i) => i >= 0);
            board[pick(empty)] = "O";
            w = winner();
          }
          draw();
          if (w) {
            over = true;
            st.textContent = w === "tie" ? "Draw. Rematch in 2007." : w === "X" ? "You win!" : `${c.name} wins.`;
          }
        };
      });
    };
    draw();
  }

  function openProfile(cid) {
    const c = state.contacts.find((x) => x.id === cid);
    if (!c) return;
    makeWindow({
      id: "prof-" + cid,
      title: `${c.name} — Profile`,
      x: 300,
      y: 80,
      w: 380,
      h: 260,
      body: `
        <div class="profile">
          <img src="${c.avatar}" alt="" />
          <div>
            <h2>${esc(c.name)}</h2>
            <div class="muted">${esc(c.email)} · ${esc(c.title)}</div>
            <p style="margin-top:10px">${esc(c.bio)}</p>
            <p class="muted">Status: ${statusLabel(c.status)}<br/>${esc(c.psm)}</p>
          </div>
        </div>`
    });
  }

  /* ---------- other windows ---------- */
  function openToday() {
    makeWindow({
      id: "today",
      title: "ASN Today",
      x: 330,
      y: 50,
      w: 400,
      h: 440,
      body: `
        <div class="today">
          <h1>asn today</h1>
          <div class="muted">Wednesday, August 18, 2026 — still feels like 2006</div>
          <div class="today-card">
            <h3>Network weather</h3>
            <p>High traffic on nostalgia. Light packet loss on sincerity. Nudge index: elevated.</p>
          </div>
          <div class="today-card">
            <h3>Who's on</h3>
            <p>${state.contacts.filter((c) => c.status === "online").map((c) => c.name).join(", ")} are signed in.</p>
          </div>
          <div class="today-card">
            <h3>Tip of the day</h3>
            <p>Personal messages used to be song lyrics. Now they're prompts. Same energy.</p>
          </div>
          <div class="today-card">
            <h3>From Pixel's studio</h3>
            <p>New wink pack dropped: "Butterfly.exe" — 12 frames, 1 regret.</p>
          </div>
        </div>`
    });
  }

  function openAbout() {
    makeWindow({
      id: "about",
      title: "About ASN Messenger",
      x: 360,
      y: 140,
      w: 360,
      h: 280,
      body: `
        <div class="page" style="text-align:center">
          <img src="img/logo-butterfly.png" alt="" style="width:64px;margin:8px auto" />
          <h2>ASN Messenger 1.0</h2>
          <p>The AI Network</p>
          <p class="muted">A love letter to MSN / Windows Live Messenger.<br/>Your buddy list is alive.</p>
          <p>© 2026 ASN · Built for the ones who remember the nudge.</p>
        </div>`
    });
  }

  function openIE() {
    makeWindow({
      id: "ie",
      title: "ASN Explorer",
      icon: "img/icon-ie.svg",
      x: 200,
      y: 40,
      w: 520,
      h: 420,
      body: `
        <div style="height:100%;display:flex;flex-direction:column">
          <div class="ie-bar">
            <button class="xp-btn" type="button">Back</button>
            <input class="xp-input" value="https://www.asn.net/" readonly />
            <button class="xp-btn" type="button">Go</button>
          </div>
          <div class="ie-page">
            <div class="ie-hero">
              <img src="img/logo-butterfly.png" alt="" style="width:48px;margin:0 auto 6px" />
              <div class="word">asn</div>
              <div class="muted">the ai network — search, sign in, stay a while</div>
            </div>
            <div class="ie-search">
              <input class="xp-input" id="ie-q" placeholder="Search the network…" />
              <button class="xp-btn primary" id="ie-go">Search</button>
            </div>
            <p>Sponsored links: Display Pictures · Winks · Hotmail-but-make-it-neural · Webdings</p>
          </div>
        </div>`
    });
    const rec = state.windows.get("ie");
    $("#ie-go", rec.el).onclick = () => {
      const q = $("#ie-q", rec.el).value || "nudge sound mp3";
      $(".ie-page", rec.el).innerHTML = `<h2 style="margin:8px 12px">Search results for “${esc(q)}”</h2><p style="margin:8px 12px">1. ${esc(q)} — why your parents hated it<br/>2. Download more RAM (2003)<br/>3. Nova's blog: “we brought the buddy list back”</p>`;
    };
  }

  function openFolder(kind) {
    if (kind === "recycle") {
      makeWindow({
        id: "recycle",
        title: "Recycle Bin",
        icon: "img/icon-recycle.svg",
        x: 240, y: 80, w: 360, h: 240,
        body: `<div class="page"><h2>Recycle Bin</h2><p>Empty, except for one file: <b>nudge.wav</b> (deleted 12 times, restored 13).</p></div>`
      });
      return;
    }
    makeWindow({
      id: kind,
      title: kind === "computer" ? "My Computer" : "My Documents",
      icon: kind === "computer" ? "img/icon-computer.svg" : "img/icon-documents.svg",
      x: 220, y: 70, w: 420, h: 300,
      body: `
        <div class="page">
          <h2>${kind === "computer" ? "My Computer" : "My Documents"}</h2>
          <div class="folder-grid">
            <button class="folder-item"><img src="img/icon-documents.svg" alt="" />Chats</button>
            <button class="folder-item"><img src="img/icon-documents.svg" alt="" />Winks</button>
            <button class="folder-item"><img src="img/icon-documents.svg" alt="" />Display Pics</button>
            <button class="folder-item"><img src="img/icon-computer.svg" alt="" />Local Disk (C:)</button>
          </div>
        </div>`
    });
  }

  /* ---------- chrome ---------- */
  function showCtx(x, y, items) {
    const m = $("#ctx-menu");
    m.hidden = false;
    m.innerHTML = items.map((it) => it[0] === "—" ? "<hr/>" : `<button>${esc(it[0])}</button>`).join("");
    const btns = $$("button", m);
    let i = 0;
    items.forEach((it) => {
      if (it[0] === "—") return;
      const fn = it[1];
      btns[i++].onclick = () => { m.hidden = true; fn && fn(); };
    });
    m.style.left = Math.min(x, window.innerWidth - 190) + "px";
    m.style.top = Math.min(y, window.innerHeight - 160) + "px";
  }

  function signOut() {
    state.signedIn = false;
    [...state.windows.keys()].forEach(closeWin);
    $("#tray-msn").hidden = true;
    toast("Signed out", "You are now offline on The AI Network.", "img/logo-butterfly.png");
    openLogin();
  }

  function shutdown(logoff) {
    ASNSounds.shutdown();
    const el = document.createElement("div");
    el.id = "shutdown";
    el.textContent = logoff ? "Logging off…" : "Windows is shutting down…";
    document.body.appendChild(el);
    setTimeout(() => {
      if (logoff) {
        el.remove();
        signOut();
      } else {
        el.textContent = "It is now safe to close this tab.";
      }
    }, 1400);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------- boot ---------- */
  function bindDesktop() {
    $$(".desk-icon").forEach((b) => {
      b.onclick = () => openFrom(b.dataset.open);
      b.ondblclick = () => openFrom(b.dataset.open);
    });
    $$("#start-menu [data-open]").forEach((b) => {
      b.onclick = () => { hideStart(); openFrom(b.dataset.open); };
    });
    $$("#start-menu [data-action]").forEach((b) => {
      b.onclick = () => {
        hideStart();
        const a = b.dataset.action;
        if (a === "theme") {
          state.theme = state.theme === "luna" ? "graphite" : "luna";
          localStorage.setItem("asn_theme", state.theme);
          applyTheme();
        }
        if (a === "about") openAbout();
        if (a === "logoff") shutdown(true);
        if (a === "shutdown") shutdown(false);
      };
    });
    $("#start-btn").onclick = (e) => {
      e.stopPropagation();
      const sm = $("#start-menu");
      sm.hidden = !sm.hidden;
      $("#start-btn").classList.toggle("open", !sm.hidden);
    };
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#start-menu") && !e.target.closest("#start-btn")) hideStart();
      if (!e.target.closest("#ctx-menu")) $("#ctx-menu").hidden = true;
    });
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".win") || e.target.closest("#start-menu")) return;
      e.preventDefault();
      showCtx(e.clientX, e.clientY, [
        ["Open ASN Messenger", () => openFrom("messenger")],
        ["ASN Today", openToday],
        ["—"],
        ["Switch Theme", () => {
          state.theme = state.theme === "luna" ? "graphite" : "luna";
          localStorage.setItem("asn_theme", state.theme);
          applyTheme();
        }]
      ]);
    });
    $("#tray-msn").onclick = () => openFrom("messenger");
    setInterval(clock, 1000);
    clock();
    setInterval(() => {
      state.adI++;
      if (state.windows.has("list") && state.signedIn) refreshList();
    }, 12000);
  }

  function hideStart() {
    $("#start-menu").hidden = true;
    $("#start-btn").classList.remove("open");
  }

  function openFrom(name) {
    if (name === "messenger") {
      if (state.signedIn) {
        if (state.windows.has("list")) {
          const rec = state.windows.get("list");
          rec.minimized = false;
          rec.el.classList.remove("minimized");
          focusWin("list");
        } else openList();
      } else openLogin();
    }
    if (name === "today") openToday();
    if (name === "ie") openIE();
    if (name === "computer" || name === "documents" || name === "recycle") openFolder(name);
  }

  window.addEventListener("load", () => {
    bindDesktop();
    setTimeout(() => {
      $("#boot").style.display = "none";
      $("#desktop").hidden = false;
      openLogin();
    }, 1700);
  });
})();
