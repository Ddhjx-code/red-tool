(function () {
  var ctx = null, muted = false;
  function ac() {
    if (!ctx) {
      try { var A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function now() { var c = ac(); return c ? c.currentTime : 0; }
  function tone(t0, f0, f1, dur, type, peak) {
    var c = ac(); if (!c || muted) return;
    var o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  window.SHAudio = {
    unlock: function () { ac(); },
    setMuted: function (m) { muted = !!m; },
    shoot: function () { tone(now(), 900 + Math.random() * 200, 500, 0.05, "square", 0.03); },
    hit: function () { tone(now(), 300, 120, 0.08, "square", 0.05); },
    boom: function () { tone(now(), 160, 40, 0.25, "sawtooth", 0.12); },
    thunder: function () { var t = now(); tone(t, 120, 30, 0.5, "sawtooth", 0.18); tone(t + 0.05, 1400, 200, 0.3, "square", 0.06); },
    power: function () { var t = now(); tone(t, 523, 523, 0.1, "sine", 0.1); tone(t + 0.1, 784, 784, 0.15, "sine", 0.1); },
    hurt: function () { tone(now(), 200, 80, 0.2, "sawtooth", 0.12); },
    win: function () { var t = now(); tone(t, 392, 392, 0.2, "sine", 0.12); tone(t + 0.15, 523, 523, 0.2, "sine", 0.12); tone(t + 0.3, 659, 659, 0.3, "sine", 0.12); },
    lose: function () { var t = now(); tone(t, 220, 110, 0.4, "sine", 0.14); tone(t + 0.2, 165, 82, 0.5, "sine", 0.1); }
  };
})();
