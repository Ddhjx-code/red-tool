(function () {
  var ctx = null, noiseBuf = null, muted = false;
  try { muted = !!(window.QQSave && window.QQSave.load().muted); } catch (e) { muted = false; }

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
    var rng = window.QQRng ? window.QQRng(20260819) : null;
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

  window.QQSound = {
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
        var o = window.QQSave.load();
        o.muted = muted;
        window.QQSave.save(o);
      } catch (e) {}
    },
    water: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        noise(c.currentTime, 0.4, "bandpass", 800, 0.16, 1400);
      } catch (e) {}
    },
    heartbeat: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        tone(c.currentTime, 62, 48, 0.12, "sine", 0.32);
      } catch (e) {}
    },
    drop: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var t0 = c.currentTime;
        tone(t0, 1200, 800, 0.3, "triangle", 0.3);
        noise(t0, 0.08, "highpass", 1800, 0.12);
      } catch (e) {}
    },
    reveal: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var t0 = c.currentTime;
        partial(t0, 660, 1.2, 0.22);
        partial(t0, 1320, 1.0, 0.08);
      } catch (e) {}
    },
    result: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var t0 = c.currentTime;
        partial(t0, 220, 2.0, 0.26);
        partial(t0, 440, 1.8, 0.12);
        partial(t0, 660, 1.5, 0.06);
      } catch (e) {}
    }
  };
})();
