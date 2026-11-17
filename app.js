/* Catoosa County Public Schools — Interactive Calendar
 * Vanilla JS, no build step. Data lives in data.js.
 */
(() => {
  "use strict";

  const DATA = window.CALENDAR_DATA;
  const YEARS = Object.keys(DATA);
  const OFF_TYPES = new Set(["holiday", "break", "inservice"]);
  const PRIORITY = ["milestone", "inservice", "holiday", "break", "early"];
  const TYPE_LABEL = {
    milestone: "Milestone",
    break: "Break",
    holiday: "Holiday",
    inservice: "Student Holiday",
    early: "Early Release",
  };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Date helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dayDiff = (a, b) => Math.round((parse(iso(b)) - parse(iso(a))) / 86400000);
  const fmt = (d, opts = { weekday: "short", month: "short", day: "numeric" }) => d.toLocaleDateString("en-US", opts);
  const fmtLong = (d) => fmt(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const fmtRange = (a, b) => {
    if (!b || iso(a) === iso(b)) return fmt(a, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const sameYear = a.getFullYear() === b.getFullYear();
    return `${fmt(a, { weekday: "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })} – ${fmt(b, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`;
  };

  // "Today" (override with ?today=YYYY-MM-DD for previews/testing)
  const qsToday = new URLSearchParams(location.search).get("today");
  const realNow = () => {
    if (qsToday && /^\d{4}-\d{2}-\d{2}$/.test(qsToday)) {
      const t = new Date();
      const d = parse(qsToday);
      d.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds());
      return d;
    }
    return new Date();
  };
  const todayIso = () => iso(realNow());

  /* ---------- Build year model ---------- */
  const cache = {};
  function model(key) {
    if (cache[key]) return cache[key];
    const y = DATA[key];
    const first = parse(y.first);
    const last = parse(y.last);
    const byDay = new Map();
    const events = y.events.map((e, idx) => ({ ...e, idx, s: parse(e.start), e: parse(e.end || e.start) }));
    events.forEach((ev) => {
      for (let d = new Date(ev.s); d <= ev.e; d = addDays(d, 1)) {
        const k = iso(d);
        if (!byDay.has(k)) byDay.set(k, []);
        byDay.get(k).push(ev);
      }
    });

    const rangeStart = new Date(first.getFullYear(), 7, 1); // Aug 1
    const rangeEnd = new Date(last.getFullYear(), 4, 31); // May 31
    const days = new Map();
    let schoolCount = 0;
    let earlyCount = 0;
    let offWeekdays = 0;
    for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
      const k = iso(d);
      const evs = byDay.get(k) || [];
      const dow = d.getDay();
      const weekend = dow === 0 || dow === 6;
      const inYear = d >= first && d <= last;
      const off = evs.some((e) => OFF_TYPES.has(e.type));
      const early = evs.some((e) => e.type === "early" || e.early);
      let type = null;
      for (const p of PRIORITY) if (evs.some((e) => e.type === p)) { type = p; break; }
      const school = inYear && !weekend && !off;
      if (school) schoolCount++;
      if (school && early) earlyCount++;
      if (inYear && !weekend && off) offWeekdays++;
      days.set(k, { date: new Date(d), iso: k, evs, weekend, inYear, off, early, type, school, schoolIndex: school ? schoolCount : null });
    }
    return (cache[key] = { key, ...y, firstD: first, lastD: last, events, days, rangeStart, rangeEnd, schoolCount, earlyCount, offWeekdays });
  }

  function yearForDate(d) {
    for (const k of YEARS) {
      const m = model(k);
      const lo = new Date(m.firstD.getFullYear(), 6, 1);
      const hi = new Date(m.lastD.getFullYear(), 5, 30);
      if (d >= lo && d <= hi) return m;
    }
    return null;
  }

  /** Describe any date's status */
  function describe(d) {
    const m = yearForDate(d);
    const dow = d.getDay();
    if (!m) return { kind: "unknown", head: "Not on these calendars", sub: "Only 2026–2027 and 2027–2028 are included.", emoji: "🤷" };
    const info = m.days.get(iso(d));
    const weekend = dow === 0 || dow === 6;
    if (info && info.evs.length) {
      const top = info.evs.find((e) => e.type === info.type) || info.evs[0];
      if (info.off) return { kind: "no", head: weekend ? "No school — weekend" : "No school", sub: `${top.title}${weekend ? "" : " · " + top.note}`, emoji: top.emoji, m, info };
      if (top.type === "milestone") {
        const isFirst = iso(d) === m.first;
        return { kind: isFirst ? "first" : "half", head: isFirst ? "Yes — first day of school!" : "Last day of school! (½ day)", sub: top.note, emoji: top.emoji, m, info };
      }
      if (info.early) return { kind: "half", head: "Yes — early release", sub: "½ day for students", emoji: "⏰", m, info };
    }
    if (weekend) return { kind: "no", head: "No school — it's the weekend", sub: DOW_LONG[dow], emoji: "😎", m, info };
    if (d < m.firstD) return { kind: "no", head: "No school — summer break", sub: `School starts ${fmt(m.firstD, { weekday: "long", month: "long", day: "numeric" })}`, emoji: "☀️", m, info };
    if (d > m.lastD) return { kind: "no", head: "No school — summer break", sub: `School ended ${fmt(m.lastD, { weekday: "long", month: "long", day: "numeric" })}`, emoji: "🏖️", m, info };
    return { kind: "yes", head: "Yes — regular school day", sub: info ? `Student day ${info.schoolIndex} of ${m.schoolCount}` : "", emoji: "📚", m, info };
  }

  /* ---------- State ---------- */
  const state = {
    year: null,
    view: "grid",
    filters: new Set(),
    selected: null,
  };

  /* ---------- Segmented controls ---------- */
  function movePill(group) {
    const btn = $('button[aria-selected="true"]', group);
    const pill = $(".pill", group);
    if (!btn || !pill) return;
    pill.style.width = btn.offsetWidth + "px";
    pill.style.transform = `translateX(${btn.offsetLeft - 6}px)`;
  }
  function selectTab(group, attr, value) {
    $$("button", group).forEach((b) => b.setAttribute("aria-selected", String(b.dataset[attr] === value)));
    movePill(group);
  }

  /* ---------- Render: month grid ---------- */
  function renderGrid() {
    const m = model(state.year);
    const grid = $("#gridView");
    const tIso = todayIso();
    let html = "";
    let mi = 0;
    for (let cur = new Date(m.rangeStart); cur <= m.rangeEnd; cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1), mi++) {
      const y = cur.getFullYear();
      const mo = cur.getMonth();
      const daysIn = new Date(y, mo + 1, 0).getDate();
      const lead = new Date(y, mo, 1).getDay();
      let schoolDays = 0;
      let cells = "";
      let i = 0;
      for (let b = 0; b < lead; b++) cells += `<span class="day blank" style="--i:${i++}"></span>`;
      for (let dd = 1; dd <= daysIn; dd++) {
        const k = `${y}-${pad(mo + 1)}-${pad(dd)}`;
        const info = m.days.get(k);
        const cls = ["day"];
        const tags = [];
        if (info.school) { schoolDays++; }
        if (info.type) { cls.push("t-" + info.type); tags.push(info.type); }
        else if (info.weekend) cls.push("weekend");
        else if (!info.inYear) cls.push("summer");
        else cls.push("school");
        if (info.early && info.type !== "early") { cls.push("has-early"); tags.push("early"); }
        if (k === tIso) { cls.push("today"); tags.push("today"); }
        if (k === state.selected) cls.push("selected");
        const label = `${fmtLong(info.date)}${info.evs.length ? " — " + info.evs.map((e) => e.title).join(", ") : ""}`;
        cells += `<button class="${cls.join(" ")}" style="--i:${i++}" data-iso="${k}" data-tags="${tags.join(" ")}" aria-label="${label}">${dd}</button>`;
      }
      html += `
        <section class="month" style="--m:${mi}" aria-label="${MONTHS[mo]} ${y}">
          <div class="month-head"><h3>${MONTHS[mo]} <span style="font-size:inherit;color:var(--muted);font-weight:600">${y}</span></h3><span>${schoolDays} school day${schoolDays === 1 ? "" : "s"}</span></div>
          <div class="dow">${DOW.map((d) => `<span>${d[0]}</span>`).join("")}</div>
          <div class="days">${cells}</div>
        </section>`;
    }
    grid.innerHTML = html;
    applyFilters();
  }

  /* ---------- Render: timeline ---------- */
  function renderTimeline() {
    const m = model(state.year);
    const now = parse(todayIso());
    const nextIdx = m.events.findIndex((e) => e.e >= now);
    const tl = $("#timelineView");
    tl.innerHTML = m.events
      .map((e, i) => {
        const days = dayDiff(e.s, e.e) + 1;
        const past = e.e < now;
        const until = dayDiff(now, e.s);
        const rel = past ? "" : until === 0 ? " · today" : until > 0 ? ` · in ${until} day${until === 1 ? "" : "s"}` : " · happening now";
        const tags = [e.type, e.early ? "early" : ""].join(" ");
        return `<li class="tl-item t-c-${e.type}${past ? " past" : ""}${i === nextIdx ? " next" : ""}" style="--i:${i}" data-iso="${e.start}" data-tags="${tags}" tabindex="0">
          <div class="tl-emoji">${e.emoji}</div>
          <div><p class="tl-title">${e.title}</p><p class="tl-when">${fmtRange(e.s, e.end ? e.e : null)}${days > 1 ? ` · ${days} days` : ""}${rel}</p></div>
          <span class="tl-tag">${TYPE_LABEL[e.type]}</span>
        </li>`;
      })
      .join("");
    applyFilters();
  }

  /* ---------- Filters ---------- */
  function applyFilters() {
    const on = state.filters.size > 0;
    const grid = $("#gridView");
    const tl = $("#timelineView");
    grid.classList.toggle("filtering", on);
    tl.classList.toggle("filtering", on);
    $$("[data-tags]", grid).concat($$("[data-tags]", tl)).forEach((el) => {
      const tags = el.dataset.tags.split(" ").filter(Boolean);
      el.classList.toggle("match", on && tags.some((t) => state.filters.has(t)));
    });
    $$("#legend .chip").forEach((c) => c.classList.toggle("active", state.filters.has(c.dataset.type)));
  }

  /* ---------- Hero: countdown, progress, stats ---------- */
  let cdTimer = null;
  let cdTarget = null;
  function nextSchoolDayAfter(m, d) {
    for (let x = addDays(d, 1); x <= m.rangeEnd; x = addDays(x, 1)) {
      const info = m.days.get(iso(x));
      if (info && info.school) return x;
    }
    return null;
  }

  function setupCountdown() {
    const m = model(state.year);
    const now = realNow();
    const today = parse(iso(now));
    const current = m.events.find((e) => OFF_TYPES.has(e.type) && e.s <= today && e.e >= today && dayDiff(e.s, e.e) > 0);
    let label, title, emoji, dateText;
    if (current) {
      const back = nextSchoolDayAfter(m, current.e) || addDays(current.e, 1);
      label = `You're on ${current.title}! Back to school in`;
      title = "Back to school";
      emoji = "🏫";
      dateText = fmtLong(back);
      cdTarget = back;
    } else {
      const next = m.events.find((e) => e.s > today) || null;
      if (next) {
        label = next.s - today < 86400000 * 1.5 ? "Tomorrow" : "Next up";
        title = next.title;
        emoji = next.emoji;
        dateText = fmtRange(next.s, next.end ? next.e : null);
        cdTarget = next.s;
      } else {
        label = "That's a wrap";
        title = "School's out for summer!";
        emoji = "🏖️";
        dateText = `The ${m.label} school year ended ${fmtLong(m.lastD)}.`;
        cdTarget = null;
      }
    }
    $("#cdLabel").textContent = label;
    $("#cdTitle").textContent = title;
    $("#cdEmoji").textContent = emoji;
    $("#cdDate").textContent = dateText;
    clearInterval(cdTimer);
    tickCountdown(true);
    cdTimer = setInterval(tickCountdown, 1000);
  }

  const lastVals = {};
  function tickCountdown(force) {
    let diff = cdTarget ? Math.max(0, cdTarget - realNow()) : 0;
    const vals = {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff / 3600000) % 24),
      m: Math.floor((diff / 60000) % 60),
      s: Math.floor((diff / 1000) % 60),
    };
    $$("#cdGrid b").forEach((b) => {
      const u = b.dataset.unit;
      const v = u === "d" ? String(vals[u]) : pad(vals[u]);
      if (force === true || lastVals[u] !== v) {
        b.textContent = v;
        b.classList.remove("tick");
        void b.offsetWidth; // restart animation
        b.classList.add("tick");
        lastVals[u] = v;
      }
    });
  }

  function countUp(el, to, dur = 1100) {
    if (reduceMotion) { el.textContent = to; return; }
    const from = 0;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderHero() {
    const m = model(state.year);
    const today = parse(todayIso());
    $("#stFirst").textContent = fmt(m.firstD, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    $("#stLast").textContent = fmt(m.lastD, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    countUp($("#stDays"), m.schoolCount);
    countUp($("#stOff"), m.offWeekdays);
    countUp($("#stEarly"), m.earlyCount);

    let done = 0;
    m.days.forEach((info) => { if (info.school && info.date < today) done++; });
    const pct = Math.round((done / m.schoolCount) * 100);
    const C = 2 * Math.PI * 52;
    const ring = $("#ringFg");
    ring.style.strokeDashoffset = C;
    requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.strokeDashoffset = C * (1 - pct / 100); }));
    const pctEl = $("#ringPct");
    if (reduceMotion) pctEl.textContent = pct + "%";
    else {
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / 1600);
        pctEl.textContent = Math.round(pct * (1 - Math.pow(1 - p, 3))) + "%";
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    let note;
    if (today < m.firstD) {
      const n = dayDiff(today, m.firstD);
      note = `Starts in ${n} day${n === 1 ? "" : "s"}`;
      $("#ringSub").textContent = "not started";
    } else if (today > m.lastD) {
      note = `All ${m.schoolCount} student days complete 🎉`;
      $("#ringSub").textContent = "complete";
    } else {
      note = `${done} of ${m.schoolCount} student days done · ${m.schoolCount - done} to go`;
      $("#ringSub").textContent = "complete";
    }
    $("#ringNote").textContent = note;
    setupCountdown();
  }

  /* ---------- Breaks ---------- */
  function renderBreaks() {
    const m = model(state.year);
    const today = parse(todayIso());
    const isFree = (d) => {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) return true;
      const info = m.days.get(iso(d));
      return info ? info.off : false;
    };
    const items = m.events
      .filter((e) => e.type === "break" || (OFF_TYPES.has(e.type)))
      .map((e) => {
        let a = new Date(e.s);
        let b = new Date(e.e);
        while (isFree(addDays(a, -1))) a = addDays(a, -1);
        while (isFree(addDays(b, 1))) b = addDays(b, 1);
        return { ...e, a, b, len: dayDiff(a, b) + 1 };
      })
      // merge long weekends that share the same window (e.g. Presidents' Day + Student Holiday)
      .reduce((acc, it) => {
        const prev = acc[acc.length - 1];
        if (prev && iso(prev.a) === iso(it.a)) { prev.title = prev.type === "break" ? prev.title : `${prev.title} + ${it.title.replace(" / Teacher In-Service", "")}`; return acc; }
        acc.push({ ...it });
        return acc;
      }, [])
      .filter((it) => it.len >= 4);
    const max = Math.max(...items.map((i) => i.len));
    $("#breaks").innerHTML = items
      .map((it, i) => {
        const until = dayDiff(today, it.a);
        let status = "", sc = "";
        if (today >= it.a && today <= it.b) { status = "Happening now"; sc = "now"; }
        else if (today > it.b) { status = "Done ✓"; }
        else if (until <= 14) { status = `In ${until} day${until === 1 ? "" : "s"}!`; sc = "soon"; }
        else { status = `In ${until} days`; }
        return `<article class="card break-card reveal" data-iso="${it.start}" data-type="${it.type}" style="transition-delay:${i * 60}ms">
          <span class="status ${sc}">${status}</span>
          <span class="emoji">${it.emoji}</span>
          <h3>${it.title.replace("Student Holiday / Teacher In-Service", "Student Holiday")}</h3>
          <p>${fmt(it.a)} – ${fmt(it.b, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
          <div class="len"><b>${it.len}</b><span class="muted">days off in a row</span></div>
          <div class="bar"><i data-w="${(it.len / max) * 100}"></i></div>
        </article>`;
      })
      .join("");
    observeReveal($$("#breaks .reveal"));
  }

  /* ---------- Drawer ---------- */
  function openDrawer(k) {
    const d = parse(k);
    const desc = describe(d);
    const m = desc.m || model(state.year);
    state.selected = k;
    $$(".day.selected").forEach((el) => el.classList.remove("selected"));
    const cell = $(`.day[data-iso="${k}"]`);
    if (cell) cell.classList.add("selected");

    $("#dwBadge").textContent = desc.emoji;
    $("#dwDow").textContent = DOW_LONG[d.getDay()];
    $("#dwTitle").textContent = fmt(d, { month: "long", day: "numeric", year: "numeric" });
    const st = $("#dwStatus");
    st.textContent = desc.head;
    st.className = "dw-status " + desc.kind;

    const info = desc.info;
    $("#dwEvents").innerHTML = info && info.evs.length
      ? info.evs.map((e) => `<div class="dw-event t-c-${e.type}"><b>${e.emoji} ${e.title}</b><span>${fmtRange(e.s, e.end ? e.e : null)} · ${e.note}</span></div>`).join("")
      : `<div class="dw-event" style="--tc:var(--navy-2)"><b>${desc.sub || "Nothing special scheduled"}</b><span>No calendar events on this day.</span></div>`;

    const today = parse(todayIso());
    const rel = dayDiff(today, d);
    const relText = rel === 0 ? "Today" : rel > 0 ? `In ${rel} day${rel === 1 ? "" : "s"}` : `${-rel} day${rel === -1 ? "" : "s"} ago`;
    let left = 0;
    m.days.forEach((i) => { if (i.school && i.date > d) left++; });
    // next weekday off that comes after at least one school day (skips the rest of a current break)
    let nextOff = null;
    let seenSchool = !!(info && info.school);
    for (let x = addDays(d, 1); x <= m.rangeEnd; x = addDays(x, 1)) {
      const i = m.days.get(iso(x));
      if (!i || !i.inYear) continue;
      if (i.school) seenSchool = true;
      else if (!i.weekend && i.off && seenSchool) { nextOff = i; break; }
    }
    $("#dwMeta").innerHTML = `
      <div><small>Student day</small><b>${info && info.schoolIndex ? `${info.schoolIndex} / ${m.schoolCount}` : "—"}</b></div>
      <div><small>From today</small><b>${relText}</b></div>
      <div><small>Student days left</small><b>${d > m.lastD ? 0 : left}</b></div>
      <div><small>Next weekday off</small><b>${nextOff ? fmt(nextOff.date, { month: "short", day: "numeric" }) : "Summer!"}</b></div>`;

    const dr = $("#drawer");
    $("#scrim").hidden = false;
    dr.classList.remove("open");
    void dr.offsetWidth;
    dr.classList.add("open");
    dr.setAttribute("aria-hidden", "false");

    if (info && (info.type === "milestone" || (info.type === "break" && iso(info.evs[0].s) === k))) confetti();
  }
  function closeDrawer() {
    $("#drawer").classList.remove("open");
    $("#drawer").setAttribute("aria-hidden", "true");
    $("#scrim").hidden = true;
    $$(".day.selected").forEach((el) => el.classList.remove("selected"));
    state.selected = null;
  }
  function stepDrawer(n) {
    if (!state.selected) return;
    const d = addDays(parse(state.selected), n);
    const m = model(state.year);
    if (d < m.rangeStart || d > m.rangeEnd) return;
    openDrawer(iso(d));
  }

  /* ---------- Tooltip ---------- */
  const tip = $("#tooltip");
  function showTip(el) {
    const k = el.dataset.iso;
    const desc = describe(parse(k));
    const d = parse(k);
    tip.innerHTML = `${desc.emoji} ${desc.info && desc.info.evs.length ? desc.info.evs[0].title : desc.head}<small>${fmt(d, { weekday: "long", month: "short", day: "numeric" })}${desc.info && desc.info.schoolIndex ? ` · day ${desc.info.schoolIndex}` : ""}</small>`;
    const r = el.getBoundingClientRect();
    tip.style.left = r.left + r.width / 2 + "px";
    tip.style.top = r.top + "px";
    tip.classList.add("show");
  }
  const hideTip = () => tip.classList.remove("show");

  /* ---------- Checker ---------- */
  function check() {
    const v = $("#checkDate").value;
    if (!v) return;
    const desc = describe(parse(v));
    const cls = desc.kind === "yes" || desc.kind === "first" ? "yes" : desc.kind === "half" ? "half" : desc.kind === "no" ? "no" : "";
    $("#checkResult").innerHTML = `<div class="answer ${cls}"><span class="big">${desc.emoji}</span><div><h4>${desc.head}</h4><p>${fmtLong(parse(v))}${desc.sub ? " · " + desc.sub : ""}</p></div></div>`;
  }

  /* ---------- ICS export ---------- */
  function downloadIcs() {
    const m = model(state.year);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const esc = (s) => s.replace(/([,;\\])/g, "\\$1");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Catoosa County Schools Interactive Calendar//EN",
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:Catoosa County Schools ${m.label.replace(/\s/g, "")}`,
    ];
    m.events.forEach((e) => {
      lines.push(
        "BEGIN:VEVENT",
        `UID:catoosa-${e.start}-${e.idx}@ccps-interactive-calendar`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${e.start.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${iso(addDays(e.e, 1)).replace(/-/g, "")}`,
        `SUMMARY:${esc(`${e.emoji} ${e.title}`)}`,
        `DESCRIPTION:${esc(`${e.note} — Catoosa County Public Schools`)}`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `catoosa-county-schools-${m.key}.ics`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    confetti(60);
  }

  /* ---------- Confetti ---------- */
  const canvas = $("#confetti");
  const ctx = canvas.getContext("2d");
  let parts = [];
  let raf = null;
  function confetti(n = 120) {
    if (reduceMotion) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ["#f4b52e", "#10b981", "#6366f1", "#ef4444", "#06b6d4", "#163f82"];
    for (let i = 0; i < n; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 200,
        y: innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 14,
        vy: Math.random() * -14 - 4,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        c: colors[(Math.random() * colors.length) | 0],
        life: 0,
      });
    }
    if (!raf) raf = requestAnimationFrame(drawConfetti);
  }
  function drawConfetti() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.life < 180 && p.y < innerHeight + 40);
    parts.forEach((p) => {
      p.life++;
      p.vy += 0.38;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.life / 180);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life / 8)));
      ctx.restore();
    });
    raf = parts.length ? requestAnimationFrame(drawConfetti) : (ctx.clearRect(0, 0, innerWidth, innerHeight), null);
  }

  /* ---------- Reveal on scroll ---------- */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            $$(".bar i", en.target).forEach((b) => setTimeout(() => (b.style.width = b.dataset.w + "%"), 200));
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.12 })
    : null;
  function observeReveal(els) {
    els.forEach((el) => {
      if (io) io.observe(el);
      else { el.classList.add("in"); $$(".bar i", el).forEach((b) => (b.style.width = b.dataset.w + "%")); }
    });
  }

  /* ---------- Year / view switching ---------- */
  let switching = false;
  function setYear(key, animate = true) {
    if (!DATA[key] || (key === state.year && animate)) return;
    const grid = $("#gridView");
    const go = () => {
      state.year = key;
      selectTab($("#yearTabs"), "year", key);
      history.replaceState(null, "", `${location.search}#${key}`);
      grid.classList.remove("leaving");
      renderGrid();
      renderTimeline();
      renderHero();
      renderBreaks();
      $("#icsYear").textContent = DATA[key].label.replace(/\s/g, "");
      $("#pdfLink").href = DATA[key].pdf;
      switching = false;
    };
    if (animate && grid.children.length && !reduceMotion && state.view === "grid") {
      if (switching) return;
      switching = true;
      grid.classList.add("leaving");
      setTimeout(go, 380);
    } else go();
  }
  function setView(v) {
    state.view = v;
    selectTab($("#viewTabs"), "view", v);
    $("#gridView").hidden = v !== "grid";
    $("#timelineView").hidden = v !== "timeline";
    if (v === "grid") renderGrid(); else renderTimeline();
  }

  /* ---------- Theme ---------- */
  function initTheme() {
    const saved = localStorage.getItem("ccps-theme");
    const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    $("#themeBtn").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("ccps-theme", next);
    });
  }

  /* ---------- Events ---------- */
  function bind() {
    $("#yearTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setYear(b.dataset.year); });
    $("#viewTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setView(b.dataset.view); });
    $("#legend").addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (!c) return;
      const t = c.dataset.type;
      state.filters.has(t) ? state.filters.delete(t) : state.filters.add(t);
      applyFilters();
    });

    const views = $(".views");
    views.addEventListener("click", (e) => {
      const el = e.target.closest("[data-iso]");
      if (el) { hideTip(); openDrawer(el.dataset.iso); }
    });
    views.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.classList.contains("tl-item")) openDrawer(e.target.dataset.iso);
    });
    views.addEventListener("mouseover", (e) => { const el = e.target.closest(".day[data-iso]"); if (el) showTip(el); });
    views.addEventListener("mouseout", (e) => { if (e.target.closest(".day[data-iso]")) hideTip(); });
    views.addEventListener("focusin", (e) => { const el = e.target.closest(".day[data-iso]"); if (el) showTip(el); });
    views.addEventListener("focusout", hideTip);
    window.addEventListener("scroll", hideTip, { passive: true });

    $("#breaks").addEventListener("click", (e) => {
      const c = e.target.closest(".break-card");
      if (c) openDrawer(c.dataset.iso);
    });

    $("#dwClose").addEventListener("click", closeDrawer);
    $("#scrim").addEventListener("click", closeDrawer);
    $("#dwPrev").addEventListener("click", () => stepDrawer(-1));
    $("#dwNext").addEventListener("click", () => stepDrawer(1));
    document.addEventListener("keydown", (e) => {
      if (!state.selected) return;
      if (e.key === "Escape") closeDrawer();
      if (e.key === "ArrowLeft") stepDrawer(-1);
      if (e.key === "ArrowRight") stepDrawer(1);
    });

    $("#checkBtn").addEventListener("click", check);
    $("#checkDate").addEventListener("change", check);
    $("#icsBtn").addEventListener("click", downloadIcs);
    $("#printBtn").addEventListener("click", () => window.print());

    window.addEventListener("resize", () => { movePill($("#yearTabs")); movePill($("#viewTabs")); });
    window.addEventListener("hashchange", () => { const k = location.hash.slice(1); if (DATA[k]) setYear(k); });
    // Refresh "today"-dependent UI at midnight
    let lastDay = todayIso();
    setInterval(() => {
      if (todayIso() !== lastDay) { lastDay = todayIso(); setYear(state.year, false); }
    }, 60000);
  }

  /* ---------- Init ---------- */
  function init() {
    initTheme();
    bind();
    const fromHash = location.hash.slice(1);
    const cur = yearForDate(parse(todayIso()));
    const start = DATA[fromHash] ? fromHash : cur ? cur.key : parse(todayIso()) < parse(DATA[YEARS[0]].first) ? YEARS[0] : YEARS[YEARS.length - 1];
    selectTab($("#viewTabs"), "view", "grid");
    setYear(start, false);
    $("#checkDate").value = todayIso();
    check();
    observeReveal($$(".reveal"));
    // pills need layout after fonts settle
    requestAnimationFrame(() => { movePill($("#yearTabs")); movePill($("#viewTabs")); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
