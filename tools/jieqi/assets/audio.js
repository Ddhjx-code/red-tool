(function () {
  var ctx = null, muted = false;

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

  function tone(t0, f0, f1, dur, type, peak) {
    var c = ac();
    if (!c || muted) return;
    var o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  window.JQAudio = {
    unlock: function () { ac(); },
    setMuted: function (m) { muted = !!m; },
    select: function () { tone(now(), 620, 830, 0.08, "triangle", 0.09); },
    place: function () { tone(now(), 300, 180, 0.14, "sine", 0.13); },
    deny: function () { tone(now(), 220, 160, 0.12, "square", 0.06); },
    shoot: function () { tone(now(), 900 + Math.random() * 150, 500, 0.06, "triangle", 0.04); },
    thunder: function () {
      var t = now();
      tone(t, 120, 40, 0.5, "sawtooth", 0.14);
      tone(t + 0.03, 1600, 200, 0.25, "square", 0.05);
    },
    leak: function () { tone(now(), 200, 80, 0.4, "sine", 0.14); },
    wave: function () { tone(now(), 150, 220, 0.3, "sine", 0.1); },
    win: function () {
      var t = now();
      tone(t, 392, 392, 0.3, "sine", 0.1);
      tone(t + 0.2, 523, 523, 0.35, "sine", 0.1);
      tone(t + 0.4, 659, 659, 0.5, "sine", 0.1);
    },
    lose: function () {
      var t = now();
      tone(t, 220, 110, 0.6, "sine", 0.13);
      tone(t + 0.25, 165, 82, 0.8, "sine", 0.1);
    }
  };
})();
