(function () {
  var ctx = null, noiseBuf = null, muted = false;
  try { muted = !!(window.DHSave && window.DHSave.load().muted); } catch (e) { muted = false; }

  function ac() {
    if (!ctx) {
      try {
        var A = window.AudioContext || window.webkitAudioContext;
        if (A) ctx = new A();
      } catch (e) { ctx = null; }
    }
    return ctx;
  }

  function env(g, t0, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  function getNoise(c) {
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(c.sampleRate * 0.5);
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    var d = noiseBuf.getChannelData(0);
    var rng = window.DHRng ? window.DHRng(20260819) : null;
    for (var i = 0; i < len; i++) {
      d[i] = rng ? rng.next() * 2 - 1 : (((i * 1664525 + 1013904223) >>> 0) / 2147483648) - 1;
    }
    return noiseBuf;
  }

  function tone(t0, f0, f1, dur, type, peak) {
    var c = ac();
    if (!c) return;
    var o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    var g = c.createGain();
    env(g, t0, 0.008, peak, dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function partial(t0, f, dur, peak) {
    var c = ac();
    if (!c) return;
    var o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(Math.max(1, f), t0);
    var g = c.createGain();
    env(g, t0, 0.01, peak, dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(t0, dur, filterType, freq, peak, freqEnd) {
    var c = ac();
    if (!c) return;
    var src = c.createBufferSource();
    src.buffer = getNoise(c);
    src.loop = true;
    var f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    var g = c.createGain();
    env(g, t0, 0.012, peak, dur);
    src.connect(f);
    f.connect(g);
    g.connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  window.DHSound = {
    unlock: function () {
      try {
        var c = ac();
        if (c && c.state === "suspended" && c.resume) c.resume();
      } catch (e) {}
    },
    isMuted: function () { return muted; },
    setMuted: function (b) {
      muted = !!b;
      try {
        var o = window.DHSave.load();
        o.muted = muted;
        window.DHSave.save(o);
      } catch (e) {}
    },
    chime: function (n) {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var f = [523, 587, 659, 784, 880][(n || 0) % 5];
        tone(c.currentTime, f, f, 0.18, "triangle", 0.3);
      } catch (e) {}
    },
    hidden: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var t0 = c.currentTime;
        partial(t0, 880, 0.6, 0.2);
        partial(t0, 1760, 0.6, 0.09);
      } catch (e) {}
    },
    brush: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        noise(c.currentTime, 0.09, "lowpass", 500, 0.12);
      } catch (e) {}
    },
    stamp: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var t0 = c.currentTime;
        tone(t0, 120, 60, 0.2, "sine", 0.4);
        noise(t0, 0.05, "lowpass", 320, 0.08);
      } catch (e) {}
    },
    card: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var t0 = c.currentTime;
        partial(t0, 440, 1.0, 0.24);
        partial(t0, 880, 1.0, 0.1);
      } catch (e) {}
    }
  };
})();
