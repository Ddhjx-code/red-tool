(function () {
  var ctx = null;
  var master = null;
  var on = true;

  function ac() {
    if (ctx) { return ctx; }
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) { return null; }
    try {
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function unlock() {
    var c = ac();
    if (!c) { return "no-audio"; }
    if (c.state === "suspended" && c.resume) { c.resume(); }
    return c.state;
  }

  function env(node, t0, dur, peak) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g);
    g.connect(master);
    return g;
  }

  function tone(f1, f2, dur, type, peak, delay) {
    var c = ac();
    if (!c || !on) { return; }
    var t0 = c.currentTime + (delay || 0);
    var o = c.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f1, t0);
    if (f2 && f2 !== f1) { o.frequency.exponentialRampToValueAtTime(f2, t0 + dur); }
    env(o, t0, dur, peak);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function noise(dur, freq, q, peak, delay) {
    var c = ac();
    if (!c || !on) { return; }
    var t0 = c.currentTime + (delay || 0);
    var n = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, n, c.sampleRate);
    var d = buf.getChannelData(0);
    var seed = 20260917;
    for (var i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      d[i] = (seed / 2147483648 - 1) * (1 - i / n);
    }
    var s = c.createBufferSource();
    s.buffer = buf;
    var f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(freq, t0);
    f.Q.setValueAtTime(q, t0);
    s.connect(f);
    env(f, t0, dur, peak);
    s.start(t0);
    s.stop(t0 + dur + 0.03);
  }

  var KIT = {
    swing: function () {
      noise(0.10, 900, 0.8, 0.13);
      tone(520, 260, 0.08, "triangle", 0.05);
    },
    hit: function () {
      tone(190, 70, 0.13, "sine", 0.50);
      noise(0.09, 2600, 1.4, 0.34);
      tone(880, 1320, 0.06, "square", 0.10);
    },
    kill: function () {
      tone(430, 170, 0.46, "triangle", 0.34);
      tone(287, 190, 0.42, "sine", 0.22, 0.01);
      noise(0.22, 1300, 0.9, 0.20);
    },
    pick: function () {
      tone(880, 880, 0.09, "sine", 0.30);
      tone(1320, 1320, 0.16, "sine", 0.26, 0.07);
    },
    hurt: function () {
      tone(160, 58, 0.26, "sawtooth", 0.30);
      noise(0.14, 380, 1.0, 0.22);
    },
    clear: function () {
      tone(220, 220, 0.85, "triangle", 0.30);
      tone(330, 330, 0.75, "sine", 0.18, 0.02);
      noise(0.45, 820, 0.6, 0.20, 0.01);
    },
    page: function () {
      noise(0.06, 1800, 1.0, 0.10);
    },
    gate: function () {
      tone(196, 294, 0.5, "triangle", 0.30);
      noise(0.25, 700, 0.7, 0.16, 0.02);
    },
    ach: function () {
      tone(784, 784, 0.10, "sine", 0.26);
      tone(1046, 1046, 0.18, "sine", 0.24, 0.08);
      tone(1568, 1568, 0.22, "sine", 0.18, 0.16);
    },
    win: function () {
      tone(261, 261, 1.1, "triangle", 0.30);
      tone(392, 392, 1.0, "sine", 0.20, 0.04);
      tone(523, 523, 0.9, "sine", 0.16, 0.08);
      noise(0.6, 900, 0.6, 0.18, 0.02);
    },
    down: function () {
      tone(300, 90, 0.55, "sawtooth", 0.28);
      noise(0.3, 300, 0.8, 0.20);
    },
    parry: function () {
      tone(720, 1180, 0.10, "triangle", 0.18);
      noise(0.05, 2400, 1.2, 0.10);
    },
    whiff: function () {
      noise(0.09, 520, 0.9, 0.14);
      tone(300, 180, 0.10, "sine", 0.10);
    },
    sweep: function () {
      noise(0.20, 700, 0.7, 0.20);
      tone(240, 120, 0.22, "triangle", 0.20);
    },
    launch: function () {
      tone(320, 900, 0.22, "triangle", 0.26);
      tone(480, 1320, 0.18, "sine", 0.16, 0.02);
    },
    ult: function () {
      tone(120, 520, 0.60, "sawtooth", 0.34);
      tone(300, 1200, 0.50, "triangle", 0.26, 0.03);
      noise(0.55, 900, 0.5, 0.26, 0.01);
      tone(1568, 2093, 0.30, "sine", 0.16, 0.18);
    },
    shoot: function () {
      tone(880, 320, 0.10, "square", 0.14);
      noise(0.05, 3000, 1.4, 0.10);
    },
    guard: function () {
      tone(1500, 900, 0.12, "square", 0.16);
      noise(0.06, 4200, 1.6, 0.12);
    },
    boss: function () {
      tone(146, 98, 0.90, "sawtooth", 0.30);
      noise(0.60, 500, 0.5, 0.22);
      tone(220, 220, 0.70, "triangle", 0.16, 0.05);
    },
    summon: function () {
      tone(196, 392, 0.34, "triangle", 0.22);
      noise(0.24, 640, 0.7, 0.16, 0.02);
    }
  };

  var mus = { on: false, bpm: 92, step: 0, next: 0, lvl: 0, timer: 0, ticks: 0 };

  function drum(f1, f2, dur, peak, at) {
    tone(f1, f2, dur, "sine", peak, Math.max(0, at - (ctx ? ctx.currentTime : 0)));
  }
  function tick() {
    if (!mus.on || !ctx || !on) { return; }
    mus.ticks += 1;
    var spb = 60 / mus.bpm / 4;
    while (mus.next < ctx.currentTime + 0.30) {
      var s = mus.step % 16;
      var bar = Math.floor(mus.step / 16);
      var off = Math.max(0, mus.next - ctx.currentTime);
      if (s % 4 === 0) { drum(118, 54, 0.17, 0.32, mus.next); }
      if (mus.lvl >= 1 && s % 4 === 2) { drum(186, 92, 0.11, 0.18, mus.next); }
      if (mus.lvl >= 2 && (s === 6 || s === 14)) { drum(240, 120, 0.08, 0.14, mus.next); }
      if (mus.lvl >= 1 && (s === 3 || s === 11)) { noise(0.05, 3200, 1.3, 0.10, off); }
      if (s === 0 && bar % 4 === 0) {
        tone(196, 196, 0.9, "triangle", mus.lvl >= 1 ? 0.16 : 0.10, off);
        noise(0.35, 760, 0.6, 0.09, off + 0.01);
      }
      mus.step += 1;
      mus.next += spb;
    }
  }
  function musicStart() {
    var c = ac();
    if (!c || mus.on) { return; }
    mus.on = true;
    mus.next = c.currentTime + 0.08;
    mus.timer = window.setInterval(tick, 60);
  }
  function musicStop() {
    mus.on = false;
    if (mus.timer) { window.clearInterval(mus.timer); mus.timer = 0; }
  }

  window.WHAudio2 = {
    unlock: unlock,
    sfx: function (name) {
      if (!on) { return false; }
      var f = KIT[name];
      if (!f || !ac()) { return false; }
      f();
      return true;
    },
    setMuted: function (m) { on = !m; if (master) { master.gain.value = m ? 0 : 0.22; } return on; },
    isOn: function () { return on; },
    state: function () { return ctx ? ctx.state : "none"; },
    kit: function () { return Object.keys(KIT); },
    musicStart: musicStart,
    musicStop: musicStop,
    musicSet: function (lv) { mus.lvl = lv; return lv; },
    musicLevel: function () { return mus.lvl; },
    musicOn: function () { return mus.on; },
    musicTicks: function () { return mus.ticks; }
  };
})();
