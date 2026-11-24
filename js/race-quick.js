/* Quick race on the home page: "Can you beat my 24.59?" A start duel; the model is in race-model.js.
   Every lost race widens the pool of Nikola's starts the ghost draws from; a win resets it. */
(function () {
  "use strict";
  var pool = document.getElementById("pool");
  if (!pool) return;

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function tok(n) { return getComputedStyle(root).getPropertyValue(n).trim(); }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ---------- model (shared, see race-model.js) ---------- */
  var M = window.RaceModel;
  var SPEED = M.SPEED;
  function st(d) { return d.react - (d.lead || 0); } // effective start, after any phone head start
  function end(d) { return st(d) + d.swim; }

  /* ---------- elements and state ---------- */
  var btn = document.getElementById("mainBtn"), card = document.getElementById("race");
  var result = document.getElementById("result"), keys = document.getElementById("keys"), counter = document.getElementById("counter");
  var tally = load("np-quick-tally", { races: 0, wins: 0, streak: 0 });
  if (tally.streak == null) tally.streak = 0; // older saves had a speed bonus instead
  var S = { phase: "idle", nik: null, you: null, goAt: 0, diveAt: null, t1: 0, t2: 0, raf: 0 };
  var audio = null;

  function renderCounter() { counter.innerHTML = "Your races <b>" + tally.races + "</b> · wins <b>" + tally.wins + "</b>"; }

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
    return sw + Math.max(0, el - sw) * SPEED;
  }

  function start() {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.resume) audio.resume(); } catch (e) {}
    S.nik = M.ghost(tally.streak);
    S.you = M.visitor();
    S.phase = "marks"; S.diveAt = null;
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
      clearTimeout(S.t1); S.phase = "idle"; S.nik = S.you = null;
      result.innerHTML = "<strong>False start.</strong> That's a DQ in a real race. Try again.";
      btn.textContent = "Race me"; keys.innerHTML = "Wait for the beep, then dive with <kbd>Space</kbd>."; keys.classList.remove("pool-note");
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
    var mine = end(S.you), his = end(S.nik), d = mine - his, won = d < 0;
    tally.races++;
    if (won) { tally.wins++; tally.streak = 0; } else { tally.streak++; }
    store("np-quick-tally", tally); renderCounter();
    // one headline plus one hint; both finish times are already shown in the pool
    var re = "<br><span class=\"re\">Your start " + S.you.react.toFixed(2) + " s, mine " + S.nik.react.toFixed(2) + " s." + (S.you.lead ? " Phone head start 0.05 s." : "") + "</span>";
    result.innerHTML = (Math.abs(d) < 0.0005 ? "<span class=\"hl\">Dead heat. Ties go to me.</span>"
      : won ? "<span class=\"hl\">You won by " + (-d).toFixed(2) + " s.</span>"
      : "<span class=\"hl\">" + (d < 0.05 ? "So close! " : "") + "You lost by " + d.toFixed(2) + " s.</span>") + re;
    btn.disabled = false; btn.textContent = "Race again";
    keys.innerHTML = "Wait for the beep, then dive with <kbd>Space</kbd>."; // the result sits next to the button, the hint stays below
    draw();
  }

  function loop() {
    S.raf = requestAnimationFrame(function frame(now) {
      draw(now);
      var t = simT(now);
      var done = S.diveAt != null && t >= end(S.you) && t >= end(S.nik);
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
    if (document.activeElement === btn) return;
    if (S.phase === "marks" || S.phase === "go") { e.preventDefault(); dive(false); }
  });

  /* ---------- drawing ---------- */
  function setup(cv) {
    var dpr = window.devicePixelRatio || 1;
    if (!cv.dataset.h) cv.dataset.h = cv.getAttribute("height");
    var w = cv.clientWidth, h = parseInt(cv.dataset.h, 10);
    if (w < 420) h = 154; // a bit taller on phones (same as before the desktop canvas got shorter)
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
      for (var b = 0; b < 3; b++) { c.beginPath(); c.arc(x - 3 - Math.random() * 10, y + (Math.random() - .5) * 9, 1.2 + Math.random() * 1.5, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1;
    }
  }

  function draw(now) {
    var s = setup(pool), c = s.c, W = s.w, H = s.h;
    // phones: names and times sit above the swimmers, so the lane runs almost wall to wall
    var narrow = W < 420;
    var padL = narrow ? 10 : 74, padR = narrow ? 8 : 64, len = W - padL - padR - (narrow ? 34 : 40), laneH = H / 2;
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
      { label: "NIKOLA", sub: "PB 24.59", cap: tok("--blue-soft"), d: S.nik, me: false }, // PK Novi Sad blue
      { label: "YOU", sub: "", cap: "#E5484D", d: S.you, me: true }
    ];
    lanes.forEach(function (L, i) {
      var top = i * laneH, cy = narrow ? top + laneH / 2 + 6 : top + laneH / 2, ly = top + 13;
      c.textAlign = "left"; c.textBaseline = "middle";
      c.fillStyle = L.me ? tok("--ink") : tok("--red");
      if (narrow) {
        c.font = "600 10.5px " + tok("--f-mono"); c.fillText(L.label, 12, ly);
        if (L.sub) { var lw = c.measureText(L.label).width; c.fillStyle = tok("--muted"); c.font = "400 10px " + tok("--f-mono"); c.fillText(L.sub, 12 + lw + 8, ly); }
      } else {
        c.font = "600 11px " + tok("--f-mono"); c.fillText(L.label, 10, L.sub ? cy - 7 : cy);
        if (L.sub) { c.fillStyle = tok("--muted"); c.font = "400 10px " + tok("--f-mono"); c.fillText(L.sub, 10, cy + 8); }
      }
      var started = L.d && L.d.react != null && t >= st(L.d);
      var p = started ? clamp((t - st(L.d)) / L.d.swim, 0, 1) : 0;
      var active = started && p < 1 && S.phase === "swim";
      swimmer(c, padL + p * len, cy, L.cap, active ? t * 2.1 + i * 0.4 : 0.25, active);
      if (L.d && L.d.react != null && t >= end(L.d)) {
        c.textAlign = "right"; c.fillStyle = L.me ? tok("--ink") : tok("--red");
        c.font = "600 12px " + tok("--f-mono"); c.fillText(end(L.d).toFixed(2), narrow ? W - 12 : W - 8, narrow ? ly : cy);
      }
    });
    if (S.phase === "marks" || (S.phase === "go" && S.diveAt == null)) {
      c.textAlign = "center"; c.textBaseline = "middle";
      var go = S.phase === "go";
      c.font = "800 " + (go ? 38 : 20) + "px " + tok("--f-head");
      c.fillStyle = go ? tok("--red") : tok("--ink"); c.globalAlpha = .93;
      c.fillText(go ? "GO!" : "Take your marks…", mid, H / 2);
      c.globalAlpha = 1;
    }
  }

  /* ---------- boot ---------- */
  var lastW = -1;
  if (window.ResizeObserver) {
    new ResizeObserver(function (en) { var w = Math.round(en[0].contentRect.width); if (w !== lastW) { lastW = w; draw(); } }).observe(pool.parentElement);
  } else {
    window.addEventListener("resize", function () { draw(); });
  }

  document.addEventListener("themechange", function () { draw(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw(); });
  renderCounter();
  draw();
})();
