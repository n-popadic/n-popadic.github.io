/* Full race page: name, cap colour, a start duel against Nikola's 24.59, a live chart of his starts in play,
   leaderboard and a histogram of your times. Results live in this browser for now;
   a shared board comes with the launch. Model: see race-model.js. */
(function () {
  "use strict";
  var M = window.RaceModel;
  var pool = document.getElementById("pool");
  if (!M || !pool) return;

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function tok(n) { return getComputedStyle(root).getPropertyValue(n).trim(); }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- elements ---------- */
  var btn = document.getElementById("mainBtn"), card = document.getElementById("race");
  var result = document.getElementById("result"), keys = document.getElementById("keys");
  var nameIn = document.getElementById("nameIn");

  /* ---------- saved state ---------- */
  var prefs = load("np-race-prefs", { name: "", cap: "#F2C230" });
  if (prefs.cap === "#13A3C4") prefs.cap = "#F2C230"; // blue is now Nikola's club cap
  var tally = load("np-race-tally", { races: 0, wins: 0, streak: 0 });
  if (tally.streak == null) tally.streak = 0; // older saves had a speed bonus instead
  function st(d) { return d.react - (d.lead || 0); } // effective start, after any phone head start
  function end(d) { return st(d) + d.swim; }
  var results = load("np-race-results", []); if (!Array.isArray(results)) results = [];
  results = results.filter(function (r) { return r.mode !== "pb"; }); // drop results from the removed own-PB mode

  nameIn.value = prefs.name || "";
  var capRadio = document.querySelector('input[name=cap][value="' + prefs.cap + '"]'); if (capRadio) capRadio.checked = true;

  function capColor() { var r = document.querySelector("input[name=cap]:checked"); return r ? r.value : "#F2C230"; }
  var NAME_MAX = 12; // the same limit for the input, the lane label and the leaderboard
  function cleanName(s) {
    // placeholder until launch: the shared board will add a bad-word filter and a notification for new names
    s = String(s || "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
    return s || "Swimmer";
  }
  function savePrefs() { store("np-race-prefs", { name: nameIn.value.trim(), cap: capColor() }); }

  nameIn.addEventListener("input", function () { savePrefs(); if (S.phase === "idle" || S.phase === "done") draw(); });
  document.querySelectorAll("input[name=cap]").forEach(function (r) { r.addEventListener("change", function () { savePrefs(); draw(); }); });

  /* ---------- race state ---------- */
  var S = { phase: "idle", ghost: null, you: null, target: M.NIKOLA_PB, goAt: 0, diveAt: null, t1: 0, t2: 0, raf: 0 };
  var audio = null;

  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.type = "square"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.28);
    } catch (e) {}
  }

  function simT(now) {
    var el = (now - S.goAt) / 1000;
    if (S.diveAt == null) return el;
    var sw = (S.diveAt - S.goAt) / 1000;
    return sw + Math.max(0, el - sw) * M.SPEED;
  }

  function lockSettings(locked) {
    nameIn.disabled = locked;
    document.querySelectorAll("input[name=cap]").forEach(function (r) { r.disabled = locked; });
  }

  function start() {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.resume) audio.resume(); } catch (e) {}
    S.target = M.NIKOLA_PB;
    S.ghost = M.ghost(tally.streak);
    S.you = M.visitor();
    S.phase = "marks"; S.diveAt = null;
    lockSettings(true);
    btn.textContent = "Dive"; keys.innerHTML = "Dive right after the beep: <kbd>Space</kbd> or the button."; keys.classList.remove("pool-note");
    result.textContent = "Take your marks…";
    draw();
    S.t1 = setTimeout(function () {
      S.phase = "go"; S.goAt = performance.now(); beep();
      card.classList.add("go"); btn.textContent = "DIVE!";
      result.innerHTML = "<strong>GO!</strong>";
      S.t2 = setTimeout(function () { if (S.phase === "go") dive(true); }, 2500);
      loop();
    }, 1300 + Math.random() * 1700);
  }

  function dive(late, touch) {
    if (S.phase === "marks") {
      clearTimeout(S.t1); S.phase = "idle"; S.ghost = S.you = null; lockSettings(false);
      result.innerHTML = "<strong>False start.</strong> That's a DQ in a real race. Try again.";
      btn.textContent = "Start race"; keys.innerHTML = "Wait for the beep, then dive with <kbd>Space</kbd>."; keys.classList.remove("pool-note");
      draw(); return;
    }
    if (S.phase !== "go") return;
    clearTimeout(S.t2); card.classList.remove("go");
    S.diveAt = performance.now();
    S.you.react = (S.diveAt - S.goAt) / 1000;
    S.you.lead = touch ? M.HEAD_START : 0;
    S.phase = "swim"; btn.disabled = true;
    result.innerHTML = late ? "Still on the block. You dived after <strong>" + S.you.react.toFixed(2) + " s</strong>." : "Reaction <strong>" + S.you.react.toFixed(2) + " s</strong>. Swim!";
  }

  function finish() {
    S.phase = "done"; cancelAnimationFrame(S.raf);
    var mine = end(S.you), ghost = end(S.ghost), d = mine - ghost, won = d < 0;
    tally.races++;
    if (won) { tally.wins++; tally.streak = 0; } else { tally.streak++; }
    store("np-race-tally", tally);
    var entry = { name: cleanName(nameIn.value), cap: capColor(), t: +mine.toFixed(2), react: +S.you.react.toFixed(2), touch: !!S.you.lead, mode: "nikola", target: S.target, won: won, at: Date.now() };
    results.push(entry); results = results.slice(-500); store("np-race-results", results);

    // one headline plus one hint; both finish times are already shown in the pool
    var re = "<br><span class=\"re\">Your start " + S.you.react.toFixed(2) + " s, mine " + S.ghost.react.toFixed(2) + " s." + (S.you.lead ? " Phone head start 0.05 s." : "") + "</span>";
    result.innerHTML = (Math.abs(d) < 0.0005 ? "<span class=\"hl\">Dead heat. Ties go to me.</span>"
      : won ? "<span class=\"hl\">You won by " + (-d).toFixed(2) + " s.</span>"
      : "<span class=\"hl\">" + (d < 0.05 ? "So close! " : "") + "You lost by " + d.toFixed(2) + " s.</span>") + re;
    btn.disabled = false; btn.textContent = "Race again"; lockSettings(false);
    keys.textContent = "";
    draw(); renderAll(entry);
  }

  function loop() {
    S.raf = requestAnimationFrame(function frame(now) {
      draw(now);
      var t = simT(now);
      var done = S.diveAt != null && t >= end(S.you) && t >= end(S.ghost);
      if (done) finish(); else S.raf = requestAnimationFrame(frame);
    });
  }

  function act(touch) { if (S.phase === "idle" || S.phase === "done") start(); else dive(false, touch); }
  var skipClick = false;
  // react on press, not release, so the measured reaction is fair; a tap on a touchscreen earns the phone head start
  btn.addEventListener("pointerdown", function (e) { if (e.button !== 0 || btn.disabled) return; e.preventDefault(); skipClick = true; act(e.pointerType === "touch"); });
  btn.addEventListener("click", function () { if (skipClick) { skipClick = false; return; } act(); });
  document.addEventListener("keydown", function (e) {
    if (e.code !== "Space" && e.key !== " ") return;
    var el = document.activeElement, tag = el && el.tagName;
    if (el === btn || tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    if (S.phase === "marks" || S.phase === "go") { e.preventDefault(); dive(false); }
  });

  /* ---------- drawing ---------- */
  function setup(cv) {
    var dpr = window.devicePixelRatio || 1;
    if (!cv.dataset.h) cv.dataset.h = cv.getAttribute("height");
    var w = cv.clientWidth, h = parseInt(cv.dataset.h, 10);
    if (cv.id === "pool" && w < 420) h = Math.round(h * 1.1); // a bit taller on phones
    cv.style.height = h + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, w: w, h: h };
  }

  function swimmer(c, x, y, cap, phase, active) {
    c.fillStyle = tok("--ink");
    c.beginPath(); c.ellipse(x + 15, y, 12, 3.2, 0, 0, Math.PI * 2); c.fill();
    var a = Math.cos(phase * Math.PI * 2) * 11;
    c.strokeStyle = tok("--ink"); c.lineWidth = 2; c.lineCap = "round";
    c.beginPath(); c.moveTo(x + 24, y - 2.6); c.lineTo(x + 24 + a, y - 5.5); c.stroke();
    c.beginPath(); c.moveTo(x + 24, y + 2.6); c.lineTo(x + 24 - a, y + 5.5); c.stroke();
    c.fillStyle = cap; c.beginPath(); c.arc(x + 30, y, 4.3, 0, Math.PI * 2); c.fill();
    if (active && !reduceMotion) {
      c.fillStyle = tok("--surface"); c.globalAlpha = .75;
      for (var b = 0; b < 3; b++) { c.beginPath(); c.arc(x - 3 - Math.random() * 10, y + (Math.random() - .5) * 8, 1.1 + Math.random() * 1.4, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1;
    }
  }

  function draw(now) {
    var s = setup(pool), c = s.c, W = s.w, H = s.h;
    // phones: names and times sit above the swimmers, so the lane runs almost wall to wall
    var narrow = W < 420;
    var padL = narrow ? 10 : 98, padR = narrow ? 8 : 64, len = W - padL - padR - (narrow ? 34 : 40), laneH = H / 2;
    var mid = narrow ? W / 2 : padL + len / 2 + 20;
    c.fillStyle = tok("--water"); c.fillRect(0, 0, W, H);
    c.fillStyle = tok("--water-deep");
    if (narrow) { c.fillRect(0, 0, 6, H); c.fillRect(W - 6, 0, 6, H); }
    else { c.fillRect(0, 0, padL - 10, H); c.fillRect(W - padR + 10, 0, padR - 10, H); }
    c.fillRect(mid - 1, 0, 2, H);
    for (var x = narrow ? 6 : padL - 8, k = 0; x < (narrow ? W - 10 : W - padR + 8); x += 9, k++) {
      c.fillStyle = k % 2 ? tok("--red") : tok("--blue-soft"); c.globalAlpha = .6;
      c.beginPath(); c.arc(x + 4, laneH, 2.7, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;

    var t = S.phase === "done" ? 1e9 : (S.phase === "go" || S.phase === "swim") && now ? simT(now) : -1;
    var lanes = [
      { label: "NIKOLA", sub: "PB 24.59", cap: tok("--blue-soft"), labelColor: tok("--red"), d: S.ghost, me: false },
      { label: cleanName(nameIn.value).toUpperCase(), sub: "you", cap: capColor(), labelColor: tok("--ink"), d: S.you, me: true }
    ];
    lanes.forEach(function (L, i) {
      var top = i * laneH, cy = narrow ? top + laneH / 2 + 6 : top + laneH / 2, ly = top + 13;
      c.textAlign = "left"; c.textBaseline = "middle";
      if (narrow) {
        c.fillStyle = L.labelColor; c.font = "600 10.5px " + tok("--f-mono"); c.fillText(L.label, 12, ly);
        var lw = c.measureText(L.label).width;
        c.fillStyle = tok("--muted"); c.font = "400 10px " + tok("--f-mono"); c.fillText(L.sub, 12 + lw + (lw ? 8 : 0), ly);
      } else {
        c.fillStyle = L.labelColor; c.font = "600 11px " + tok("--f-mono"); c.fillText(L.label, 10, cy - 7);
        c.fillStyle = tok("--muted"); c.font = "400 10px " + tok("--f-mono"); c.fillText(L.sub, 10, cy + 8);
      }
      var started = L.d && L.d.react != null && t >= st(L.d);
      var p = started ? clamp((t - st(L.d)) / L.d.swim, 0, 1) : 0;
      var active = started && p < 1 && S.phase === "swim";
      swimmer(c, padL + p * len, cy, L.cap, active ? t * 2.1 + i * 0.4 : 0.25, active);
      if (L.d && L.d.react != null && t >= end(L.d)) {
        c.textAlign = "right"; c.fillStyle = L.me ? tok("--ink") : L.labelColor;
        c.font = "600 12px " + tok("--f-mono"); c.fillText(end(L.d).toFixed(2), narrow ? W - 12 : W - 8, narrow ? ly : cy);
      }
    });
    if (S.phase === "marks" || (S.phase === "go" && S.diveAt == null)) {
      c.textAlign = "center"; c.textBaseline = "middle";
      var go = S.phase === "go";
      c.font = "800 " + (go ? 42 : 22) + "px " + tok("--f-head");
      c.fillStyle = go ? tok("--red") : tok("--ink"); c.globalAlpha = .93;
      c.fillText(go ? "GO!" : "Take your marks…", mid, H / 2);
      c.globalAlpha = 1;
    }
  }

  /* ---------- stats, leaderboard, histogram ---------- */
  function renderStats() {
    document.getElementById("sRaces").textContent = tally.races;
    document.getElementById("sWins").textContent = tally.wins;
    var best = results.length ? Math.min.apply(null, results.map(function (r) { return r.t; })) : null;
    var bestR = results.length ? Math.min.apply(null, results.map(function (r) { return r.react; })) : null;
    document.getElementById("sBest").textContent = best == null ? "–" : best.toFixed(2);
    document.getElementById("sReact").textContent = bestR == null ? "–" : bestR.toFixed(2);
  }

  // the board: this visitor's five best races (kept in their browser) plus Nikola's 24.59, ranked together
  function renderBoard(latest) {
    var body = document.getElementById("board");
    var rows = results.slice().sort(function (a, b) { return a.t - b.t; }).slice(0, 5);
    rows.push({ nikola: true, name: "Nikola", t: M.NIKOLA_PB });
    rows.sort(function (a, b) { return a.t - b.t || (a.nikola ? -1 : 1); }); // a tie goes to me
    var html = rows.map(function (r, i) {
      var cls = r.nikola ? "nikola" : (latest && r.at === latest.at ? "latest" : "");
      var cap = r.nikola ? tok("--blue-soft") : r.cap;
      return '<tr class="' + cls + '">' +
        '<td class="rank">' + (i + 1) + "</td>" +
        '<td class="who"><span class="capdot" style="background:' + esc(cap) + '"></span><span class="nm">' + esc(r.nikola ? r.name : cleanName(r.name)) + "</span>" +
        (r.nikola ? '<span class="vs">PB</span>' : r.won ? '<span class="vs won">won</span>' : "") + "</td>" +
        '<td class="t">' + r.t.toFixed(2) + "</td></tr>";
    });
    if (!results.length) html.push('<tr class="open"><td></td><td colspan="2">Race me to get on the board.</td></tr>');
    body.innerHTML = html.join("");
  }

  var hist = document.getElementById("hist");
  function drawHist() {
    var s = setup(hist), c = s.c, W = s.w, H = s.h;
    var data = results.map(function (r) { return r.t; });
    var n = data.length;
    var mn = n ? Math.min.apply(null, data) : 24, mx = n ? Math.max.apply(null, data) : 27;
    var lo = Math.floor(mn - 0.25), hi = Math.ceil(mx + 0.25);
    if (hi - lo < 3) { var mid = (lo + hi) / 2; lo = Math.floor(mid - 1.5); hi = lo + 3; }
    var bw = (hi - lo) <= 5 ? 0.25 : 0.5, nb = Math.round((hi - lo) / bw);
    var m = { l: 30, r: 8, t: 10, b: 24 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var counts = new Array(nb).fill(0);
    data.forEach(function (v) { counts[Math.floor((clamp(v, lo, hi - 1e-9) - lo) / bw)]++; });
    var mean = n ? data.reduce(function (a, b) { return a + b; }, 0) / n : 0;
    var sd = n > 1 ? Math.sqrt(data.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (n - 1)) : 0;
    var peak = n >= 3 && sd > 0 ? n * bw / (sd * Math.sqrt(2 * Math.PI)) : 0;
    var ymax = Math.max(3, Math.max.apply(null, counts), Math.ceil(peak));
    function X(v) { return m.l + (v - lo) / (hi - lo) * pw; }
    function Y(v) { return m.t + ph - v / ymax * ph; }
    c.strokeStyle = tok("--line"); c.lineWidth = 1;
    c.beginPath(); c.moveTo(m.l, Y(0) + .5); c.lineTo(W - m.r, Y(0) + .5); c.stroke();
    c.fillStyle = tok("--muted"); c.font = "11px " + tok("--f-mono"); c.textAlign = "center"; c.textBaseline = "top";
    var step = (hi - lo) > 8 ? 2 : 1;
    for (var v = lo; v <= hi; v += step) c.fillText(v + "s", X(v), Y(0) + 6);
    c.textAlign = "right"; c.textBaseline = "middle"; c.fillText("0", m.l - 6, Y(0)); c.fillText(String(ymax), m.l - 6, Y(ymax));
    var last = n ? data[n - 1] : null, lastK = last == null ? -1 : Math.floor((clamp(last, lo, hi - 1e-9) - lo) / bw);
    for (var k = 0; k < nb; k++) {
      if (!counts[k]) continue;
      c.fillStyle = k === lastK ? tok("--red") : tok("--blue-soft"); c.globalAlpha = k === lastK ? .95 : .75;
      c.fillRect(X(lo + k * bw) + 1, Y(counts[k]), pw / nb - 2, Y(0) - Y(counts[k])); c.globalAlpha = 1;
    }
    if (peak) {
      c.strokeStyle = tok("--ink"); c.lineWidth = 1.6; c.beginPath();
      for (var i = 0; i <= 120; i++) {
        var xv = lo + (hi - lo) * i / 120, yv = n * bw * Math.exp(-0.5 * Math.pow((xv - mean) / sd, 2)) / (sd * Math.sqrt(2 * Math.PI));
        if (i) c.lineTo(X(xv), Y(yv)); else c.moveTo(X(xv), Y(yv));
      }
      c.stroke();
    }
    if (!n) { c.fillStyle = tok("--muted"); c.font = "13px " + tok("--f-body"); c.textAlign = "center"; c.fillText("Your times will stack up here", m.l + pw / 2, m.t + ph / 2); }
    document.getElementById("histNote").textContent = n ? n + " races · mean " + mean.toFixed(2) + " s" + (n > 1 ? " · sd " + sd.toFixed(2) : "") : "no races yet";
  }

  function renderAll(latest) { renderStats(); renderBoard(latest); drawHist(); drawPoolChart(); }

  /* ---------- method charts (static) ---------- */
  var reactChart = document.getElementById("reactChart"), oddsChart = document.getElementById("oddsChart");

  function drawReactChart() {
    if (!reactChart) return;
    var s = setup(reactChart), c = s.c, W = s.w, H = s.h;
    var data = M.reactionsMs, n = data.length;
    var lo = 140, hi = 420, bw = 20, nb = (hi - lo) / bw;
    var m = { l: 30, r: 10, t: 22, b: 24 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var counts = new Array(nb).fill(0);
    data.forEach(function (v) { counts[Math.floor((clamp(v, lo, hi - 1e-9) - lo) / bw)]++; });
    var ymax = Math.max.apply(null, counts) + 2;
    var mean = M.MEAN_REACTION * 1000;
    function X(v) { return m.l + (v - lo) / (hi - lo) * pw; }
    function Y(v) { return m.t + ph - v / ymax * ph; }
    c.strokeStyle = tok("--line"); c.lineWidth = 1;
    c.beginPath(); c.moveTo(m.l, Y(0) + .5); c.lineTo(W - m.r, Y(0) + .5); c.stroke();
    c.fillStyle = tok("--muted"); c.font = "11px " + tok("--f-mono"); c.textAlign = "center"; c.textBaseline = "top";
    for (var v = 150; v <= 400; v += 50) c.fillText(String(v), X(v), Y(0) + 6);
    c.textAlign = "right"; c.textBaseline = "middle"; c.fillText("0", m.l - 6, Y(0)); c.fillText(String(ymax), m.l - 6, Y(ymax));
    for (var k = 0; k < nb; k++) {
      if (!counts[k]) continue;
      c.fillStyle = tok("--blue-soft"); c.globalAlpha = .8;
      c.fillRect(X(lo + k * bw) + 1, Y(counts[k]), pw / nb - 2, Y(0) - Y(counts[k])); c.globalAlpha = 1;
    }
    // mean marker
    c.strokeStyle = tok("--red"); c.lineWidth = 1.5; c.setLineDash([4, 3]);
    c.beginPath(); c.moveTo(X(mean), m.t - 4); c.lineTo(X(mean), Y(0)); c.stroke(); c.setLineDash([]);
    c.fillStyle = tok("--red"); c.font = "600 11px " + tok("--f-mono"); c.textAlign = "left"; c.textBaseline = "bottom";
    c.fillText("mean " + Math.round(mean) + " ms", X(mean) + 5, m.t + 6);
  }

  // win chance by your start, one line per race of a losing streak; exact: the share of my pool slower than your start
  var STREAK_STYLE = [
    { label: "race 1", alpha: 1, color: "--red" },
    { label: "race 2", alpha: .4, color: "--blue-soft" },
    { label: "race 3", alpha: .6, color: "--blue-soft" },
    { label: "race 4", alpha: .8, color: "--blue-soft" },
    { label: "race 5+", alpha: 1, color: "--blue-soft" }
  ];
  function drawOddsChart() {
    if (!oddsChart) return;
    var s = setup(oddsChart), c = s.c, W = s.w, H = s.h;
    var lo = 200, hi = 400;
    var m = { l: 38, r: 58, t: 12, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    function X(v) { return m.l + (v - lo) / (hi - lo) * pw; }
    function Y(v) { return m.t + ph - v * ph; }
    c.strokeStyle = tok("--line"); c.lineWidth = 1; c.fillStyle = tok("--muted"); c.font = "11px " + tok("--f-mono");
    c.textAlign = "right"; c.textBaseline = "middle";
    [0, .5, 1].forEach(function (g) {
      c.globalAlpha = g ? .5 : 1; c.beginPath(); c.moveTo(m.l, Y(g) + .5); c.lineTo(W - m.r, Y(g) + .5); c.stroke(); c.globalAlpha = 1;
      c.fillText(Math.round(g * 100) + "%", m.l - 6, Y(g));
    });
    c.textAlign = "center"; c.textBaseline = "top";
    for (var v = lo; v <= hi; v += 50) c.fillText(v + " ms", X(v), Y(0) + 7);
    STREAK_STYLE.forEach(function (L, k) {
      c.strokeStyle = tok(L.color); c.globalAlpha = L.alpha; c.lineWidth = 2; c.beginPath();
      for (var ms = lo; ms <= hi; ms++) {
        var y = Y(M.winChance(ms / 1000, k));
        if (ms === lo) c.moveTo(X(ms), y); else c.lineTo(X(ms), y);
      }
      c.stroke(); c.globalAlpha = 1;
    });
    // labels where each line leaves the 50% mark, stacked so they never overlap
    c.font = "600 11px " + tok("--f-mono"); c.textAlign = "left"; c.textBaseline = "middle";
    STREAK_STYLE.forEach(function (L, k) {
      c.fillStyle = tok(L.color); c.globalAlpha = Math.max(L.alpha, .7);
      c.fillText(L.label, W - m.r + 6, m.t + 8 + k * 15); c.globalAlpha = 1;
    });
  }

  // chance you have beaten me after n races, from a 300 ms start on a computer (exact, losing streak included)
  var comebackChart = document.getElementById("comebackChart");
  function comeback(reactS, races) {
    var out = [], notYet = 1;
    for (var k = 0; k < races; k++) { notYet *= 1 - M.winChance(reactS, k); out.push(Math.round((1 - notYet) * 100)); }
    return out;
  }
  function drawComebackChart() {
    if (!comebackChart) return;
    var COMEBACK = comeback(0.30, 10);
    var s = setup(comebackChart), c = s.c, W = s.w, H = s.h;
    var m = { l: 38, r: 14, t: 16, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    function X(k) { return m.l + (k - 1) / 9 * pw; }
    function Y(v) { return m.t + ph - v / 100 * ph; }
    c.strokeStyle = tok("--line"); c.lineWidth = 1; c.fillStyle = tok("--muted"); c.font = "11px " + tok("--f-mono");
    c.textAlign = "right"; c.textBaseline = "middle";
    [0, 50, 100].forEach(function (g) {
      c.globalAlpha = g ? .5 : 1; c.beginPath(); c.moveTo(m.l, Y(g) + .5); c.lineTo(W - m.r, Y(g) + .5); c.stroke(); c.globalAlpha = 1;
      c.fillText(g + "%", m.l - 6, Y(g));
    });
    c.textAlign = "center"; c.textBaseline = "top";
    for (var k = 1; k <= 10; k++) c.fillText(String(k), X(k), Y(0) + 7);
    c.beginPath(); c.moveTo(X(1), Y(0));
    COMEBACK.forEach(function (v, i) { c.lineTo(X(i + 1), Y(v)); });
    c.lineTo(X(10), Y(0)); c.closePath();
    c.fillStyle = tok("--blue-soft"); c.globalAlpha = .18; c.fill(); c.globalAlpha = 1;
    c.beginPath();
    COMEBACK.forEach(function (v, i) { if (i) c.lineTo(X(i + 1), Y(v)); else c.moveTo(X(1), Y(v)); });
    c.strokeStyle = tok("--blue-soft"); c.lineWidth = 2.2; c.stroke();
    COMEBACK.forEach(function (v, i) {
      var last = i === 9;
      c.fillStyle = last ? tok("--red") : tok("--blue-soft");
      c.beginPath(); c.arc(X(i + 1), Y(v), last ? 4.5 : 3, 0, Math.PI * 2); c.fill();
    });
    c.fillStyle = tok("--red"); c.font = "600 11px " + tok("--f-mono"); c.textAlign = "right"; c.textBaseline = "bottom";
    c.fillText(COMEBACK[9] + "% by race 10", X(10) - 4, Y(COMEBACK[9]) - 8);
  }

  // live: my 86 starts, with the ones in play for your next race highlighted
  var poolChart = document.getElementById("poolChart");
  function drawPoolChart() {
    if (!poolChart) return;
    var s = setup(poolChart), c = s.c, W = s.w, H = s.h;
    var data = M.sortedMs, n = M.poolSize(tally.streak), cut = data[n - 1];
    var lo = 140, hi = 420, bw = 10, nb = (hi - lo) / bw;
    var m = { l: 22, r: 8, t: 10, b: 24 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var all = new Array(nb).fill(0), inPool = new Array(nb).fill(0);
    data.forEach(function (v, i) { var b = Math.floor((clamp(v, lo, hi - 1e-9) - lo) / bw); all[b]++; if (i < n) inPool[b]++; });
    var ymax = Math.max.apply(null, all) + 1;
    function X(v) { return m.l + (v - lo) / (hi - lo) * pw; }
    function Y(v) { return m.t + ph - v / ymax * ph; }
    c.strokeStyle = tok("--line"); c.lineWidth = 1;
    c.beginPath(); c.moveTo(m.l, Y(0) + .5); c.lineTo(W - m.r, Y(0) + .5); c.stroke();
    c.fillStyle = tok("--muted"); c.font = "11px " + tok("--f-mono"); c.textAlign = "center"; c.textBaseline = "top";
    for (var v = 150; v <= 400; v += 50) c.fillText(String(v), X(v), Y(0) + 6);
    for (var k = 0; k < nb; k++) {
      if (!all[k]) continue;
      var x = X(lo + k * bw) + .5, w = pw / nb - 1;
      c.fillStyle = tok("--muted"); c.globalAlpha = .28; c.fillRect(x, Y(all[k]), w, Y(0) - Y(all[k]));
      if (inPool[k]) { c.fillStyle = tok("--blue-soft"); c.globalAlpha = .95; c.fillRect(x, Y(inPool[k]), w, Y(0) - Y(inPool[k])); }
      c.globalAlpha = 1;
    }
    // your last start, after any phone head start
    var last = results.length ? results[results.length - 1] : null;
    if (last) {
      var you = last.react * 1000 - (last.touch ? M.HEAD_START * 1000 : 0);
      c.strokeStyle = tok("--red"); c.lineWidth = 1.5; c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(X(you), m.t); c.lineTo(X(you), Y(0)); c.stroke(); c.setLineDash([]);
      c.fillStyle = tok("--red"); c.font = "600 11px " + tok("--f-mono"); c.textBaseline = "top";
      c.textAlign = X(you) > W - 60 ? "right" : "left";
      c.fillText("you", X(you) + (c.textAlign === "left" ? 4 : -4), m.t);
    }
    var pct = M.poolPct(tally.streak);
    document.getElementById("poolNote").textContent = pct >= 100 ? "all 86 starts" : "fastest " + pct + "% · up to " + cut + " ms";
  }

  function drawStatic() { drawReactChart(); drawOddsChart(); drawComebackChart(); }

  /* ---------- clear results (with in-page confirmation) ---------- */
  var clearBtn = document.getElementById("clearBtn"), clearConfirm = document.getElementById("clearConfirm");
  clearBtn.addEventListener("click", function () { clearConfirm.hidden = false; clearBtn.hidden = true; });
  document.getElementById("clearNo").addEventListener("click", function () { clearConfirm.hidden = true; clearBtn.hidden = false; });
  document.getElementById("clearYes").addEventListener("click", function () {
    results = []; tally = { races: 0, wins: 0, streak: 0 };
    store("np-race-results", results); store("np-race-tally", tally);
    clearConfirm.hidden = true; clearBtn.hidden = false;
    renderAll(null); result.textContent = "Results cleared.";
  });

  /* ---------- boot ---------- */
  function redrawAll() { draw(); drawHist(); drawPoolChart(); drawStatic(); }
  var lastW = -1;
  if (window.ResizeObserver) {
    new ResizeObserver(function (en) { var w = Math.round(en[0].contentRect.width); if (w !== lastW) { lastW = w; redrawAll(); } }).observe(document.querySelector(".game .container"));
  } else {
    window.addEventListener("resize", redrawAll);
  }
  document.addEventListener("themechange", redrawAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAll);
  drawStatic();
  draw();
  renderAll(null);
})();
