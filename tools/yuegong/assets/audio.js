(function () {
  /* =========================== [AUDIO] ============================
     霓裳羽衣曲 — Web-Audio synthesis, no external files.
     商调式 (shang-mode) pentatonic: re–mi–sol–la–do, tonic = 商(re).
     Structure mirrors the narrative arc:
       散序 (free, no beat)  -> intro / early nodes
       中序 (拍板 pulse)     -> gate / court
       曲破 (faster, denser) -> listen / watch / return / second
       曲终「长引一声」      -> ending, one long slow sustained tone
     Density tracks 记曲(tune), the same resource that scales the
     visual 曲调音纹 rings (scene.js ringCount = tune*3).
     §7 determinism: pitch jitter comes from rngFrom(tag), the seeded
     stream from rng.js — no ambient randomness anywhere in this path.
     Headless-safe: every public cue no-ops when ac() returns null.
     ================================================================ */
  var ctx = null, muted = false, droneNodes = null;

  /* 商调式 pentatonic — 商(re) tonic = D4 */
  var SHANG = 293.66, JUE = 329.63, ZHI = 392.00, YU = 440.00, GONG = 523.25;
  /* drone register — 商 D3 plus a detuned partner for slow beating,
     optionally layered with the 徵 A3 fifth and a 商 D4 octave */
  var SHANG_LO = 146.83, SHANG_LO2 = 147.40, ZHI_LO = 220.00, SHANG_MID = 293.66;

  /* narrative phase map: 散序(san) / 中序(zhong) / 曲破(qu) */
  var PHASE = {
    start: "san", stay: "san", bridge: "san", lookback: "san",
    gate: "zhong", force: "zhong", court: "zhong", askname: "zhong",
    listen: "qu", watch: "qu", "return": "qu", second: "qu"
  };

  function ac() {
    if (!ctx) {
      try {
        var A = window.AudioContext || window.webkitAudioContext;
        if (A) ctx = new A();
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function now() { var c = ac(); return c ? c.currentTime : 0; }

  /* deterministic pitch-jitter multiplier (~0.98..1.02) from the seeded
     stream — reproducible per tag, never ambient randomness */
  function jit(tag) {
    var g = (typeof rngFrom === "function") ? rngFrom(tag) : null;
    return g ? (0.98 + g() * 0.04) : 1.0;
  }

  /* 弹拨 / 拍板 primitive — fast exponential attack + decay (house shape) */
  function tone(t0, f0, f1, dur, type, peak) {
    var c = ac();
    if (!c || muted) return;
    var o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  /* 吹管 / 方響 primitive — slow attack, optional hold plateau, long decay */
  function voice(t0, f0, f1, dur, type, peak, atk, hold) {
    var c = ac();
    if (!c || muted) return;
    atk = atk || 0.02; hold = hold || 0;
    var o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    if (hold > 0) g.gain.setValueAtTime(peak, t0 + atk + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  /* 方響 metal bell — fundamental + 2x/3x partials, long decay */
  function bell(t0, f, dur, peak) {
    voice(t0, f, f, dur, "sine", peak, 0.008, 0);
    voice(t0, f * 2, f * 2, dur * 0.7, "sine", peak * 0.4, 0.006, 0);
    voice(t0, f * 3, f * 3, dur * 0.5, "sine", peak * 0.18, 0.006, 0);
  }

  /* 拍板 beat marker — very short low-sine thud */
  function beat(t0, peak) { tone(t0, 92, 58, 0.08, "sine", peak || 0.05); }

  function readTune() {
    try { return (window.YGEngine && YGEngine.resources) ? YGEngine.resources().tune : 0; }
    catch (e) { return 0; }
  }
  function readNode() {
    try { return (window.YGEngine && YGEngine.state) ? YGEngine.state().nodeId : ""; }
    catch (e) { return ""; }
  }
  function phaseOf(id) { return PHASE[id] || "san"; }

  function rampGain(g, target, t) {
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(target, t + 0.6);
    } catch (e) {}
  }

  /* ambient drone — a sustained bed tied to game state. The detuned 商 D3
     pair is the sparse floor; the 徵 fifth enters at tune>=1 and the 商
     octave at full tune / 曲破 climax, mirroring ringCount(tune). */
  function setDroneDensity(tune, phase) {
    if (!droneNodes) return;
    var c = ac(); if (!c) return;
    var t = c.currentTime;
    rampGain(droneNodes.gB, tune >= 1 ? 0.022 : 0.0, t);
    rampGain(droneNodes.gC, (tune >= 2 || phase === "qu") ? 0.016 : 0.0, t);
  }

  function startDrone() {
    var c = ac();
    if (!c || muted) return;
    var tune = readTune(), phase = phaseOf(readNode());
    if (!droneNodes) {
      var master = c.createGain();
      master.gain.setValueAtTime(0.0001, c.currentTime);
      master.gain.exponentialRampToValueAtTime(1.0, c.currentTime + 1.2);
      master.connect(c.destination);

      var o1 = c.createOscillator(); o1.type = "sine"; o1.frequency.value = SHANG_LO;
      var o2 = c.createOscillator(); o2.type = "sine"; o2.frequency.value = SHANG_LO2;
      var gA = c.createGain(); gA.gain.value = 0.034;
      o1.connect(gA); o2.connect(gA); gA.connect(master);

      var o5 = c.createOscillator(); o5.type = "sine"; o5.frequency.value = ZHI_LO;
      var gB = c.createGain(); gB.gain.value = 0.0;
      o5.connect(gB); gB.connect(master);

      var o8 = c.createOscillator(); o8.type = "triangle"; o8.frequency.value = SHANG_MID;
      var gC = c.createGain(); gC.gain.value = 0.0;
      o8.connect(gC); gC.connect(master);

      o1.start(); o2.start(); o5.start(); o8.start();
      droneNodes = { master: master, o1: o1, o2: o2, o5: o5, o8: o8, gA: gA, gB: gB, gC: gC };
    }
    setDroneDensity(tune, phase);
  }

  function stopDrone() {
    if (droneNodes) {
      try { droneNodes.o1.stop(); droneNodes.o2.stop(); droneNodes.o5.stop(); droneNodes.o8.stop(); } catch (e) {}
      try { droneNodes.master.disconnect(); } catch (e) {}
      droneNodes = null;
    }
  }

  /* ---- 曲终 cadences — five distinct, keyed by ending id ---- */

  /* end_nichang — THE 霓裳 cadence: ascending 商调式 phrase, bright, resolved */
  function cadNichang(t) {
    var seq = [SHANG, JUE, ZHI, YU, GONG];
    for (var i = 0; i < seq.length; i++) {
      tone(t + i * 0.16, seq[i] * jit(0xC0DE + i), seq[i], 0.30, "triangle", 0.07);
    }
    bell(t + 0.5, GONG, 1.4, 0.05);                              /* 方響 shimmer on the ascent */
    voice(t + 0.9, SHANG, SHANG, 2.6, "sine", 0.08, 0.35, 1.2);  /* 长引一声, 引声益缓 */
    voice(t + 0.9, ZHI, ZHI, 2.6, "sine", 0.04, 0.40, 1.2);      /* fifth beneath */
  }

  /* end_banyue — dance-like, 羽/la-focused */
  function cadBanyue(t) {
    var seq = [YU, ZHI, YU, GONG, YU];
    for (var i = 0; i < seq.length; i++) {
      tone(t + i * 0.13, seq[i] * jit(0xD4CE + i), seq[i], 0.24, "triangle", 0.065);
    }
    beat(t, 0.05); beat(t + 0.26, 0.045);                        /* light 拍板 dance pulse */
    voice(t + 0.75, YU, YU, 1.8, "sine", 0.06, 0.30, 0.8);       /* settle on 羽 */
  }

  /* end_weiru — cold, sparse, descending; the drone thins (warmth depleted) */
  function cadWeiru(t) {
    var seq = [ZHI, JUE, SHANG];
    for (var i = 0; i < seq.length; i++) {
      tone(t + i * 0.42, seq[i] * jit(0xE1CE + i), seq[i] * 0.99, 0.5, "sine", 0.05 - i * 0.01);
    }
    if (droneNodes) rampGain(droneNodes.master, 0.4, t);         /* drone thins out */
    voice(t + 1.3, SHANG_LO, SHANG_LO * 0.98, 2.4, "sine", 0.05, 0.5, 1.0);
  }

  /* end_buyun — unresolved / suspended (天师笑谢不允): hangs, never resolves */
  function cadBuyun(t) {
    tone(t, SHANG * jit(0xF00D), SHANG, 0.30, "triangle", 0.06);
    tone(t + 0.2, JUE * jit(0xF00E), JUE, 0.30, "triangle", 0.055);
    tone(t + 0.4, YU * jit(0xF00F), YU, 0.40, "triangle", 0.05);
    voice(t + 0.7, JUE, JUE, 2.2, "sine", 0.055, 0.30, 1.0);     /* hang on 角 — no resolution */
    bell(t + 0.9, ZHI, 1.6, 0.035);                              /* withheld bell, fades */
  }

  /* end_renjian — warm, grounded, returns to 宫/do tonic */
  function cadRenjian(t) {
    var seq = [ZHI, YU, GONG];
    for (var i = 0; i < seq.length; i++) {
      tone(t + i * 0.18, seq[i] * jit(0xA5A5 + i), seq[i], 0.32, "triangle", 0.065);
    }
    voice(t + 0.6, GONG, GONG, 2.4, "sine", 0.07, 0.35, 1.2);    /* resolve on 宫 */
    voice(t + 0.6, SHANG, SHANG, 2.4, "sine", 0.04, 0.40, 1.2);  /* 商 beneath 宫 */
  }

  /* safe default — neutral resolved 商 cadence */
  function cadDefault(t) {
    tone(t, SHANG * jit(0x9EED), SHANG, 0.40, "triangle", 0.06);
    voice(t + 0.3, SHANG, SHANG, 1.6, "sine", 0.06, 0.30, 0.7);
  }

  window.YGAudio = {
    unlock: function () { ac(); },
    setMuted: function (m) { muted = !!m; if (m) stopDrone(); },
    isMuted: function () { return muted; },
    startDrone: startDrone,
    stopDrone: stopDrone,

    /* UI cue — plucked 弹拨 confirmation, density tracks 记曲(tune) */
    choose: function () {
      var c = ac(); if (!c || muted) return;
      var t = now(), tune = readTune();
      tone(t, SHANG * jit(0xA11E), SHANG, 0.18, "triangle", 0.07);
      if (tune >= 1) tone(t + 0.07, ZHI * jit(0xA11F), ZHI, 0.16, "triangle", 0.055);
      if (tune >= 2) tone(t + 0.14, YU * jit(0xA120), YU, 0.20, "triangle", 0.05);
    },

    /* UI cue — 吹管 transition; the 拍板 pulse enters at 中序, doubles at 曲破 */
    advance: function () {
      var c = ac(); if (!c || muted) return;
      var t = now(), phase = phaseOf(readNode());
      voice(t, SHANG * jit(0xB0BA), ZHI, 0.5, "sine", 0.06, 0.12, 0.1);
      if (phase !== "san") beat(t, 0.05);
      if (phase === "qu") beat(t + 0.18, 0.045);
    },

    /* 曲终 — branch on the five ending ids, safe default otherwise */
    ending: function (id) {
      var c = ac(); if (!c || muted) return;
      var t = now();
      if (id === "end_nichang") cadNichang(t);
      else if (id === "end_banyue") cadBanyue(t);
      else if (id === "end_weiru") cadWeiru(t);
      else if (id === "end_buyun") cadBuyun(t);
      else if (id === "end_renjian") cadRenjian(t);
      else cadDefault(t);
    }
  };
})();
