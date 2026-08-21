(function () {
  var ctx = null, noiseBuf = null, muted = false;
  try { muted = !!(window.LZSave && window.LZSave.load().muted); } catch (e) { muted = false; }

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
    var rng = window.LZRng ? window.LZRng(20260505) : null;
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

  function drumAt(t0, vol) {
    tone(t0, 150, 55, 0.18, "sine", 0.5 * vol);
    noise(t0, 0.06, "lowpass", 900, 0.18 * vol);
  }

  var SCALE = [523, 587, 659, 784, 880];

  window.LZSound = {
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
        var o = window.LZSave.load();
        o.muted = muted;
        window.LZSave.save(o);
      } catch (e) {}
    },
    drum: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        drumAt(c.currentTime, 1);
      } catch (e) {}
    },
    dash: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var t0 = c.currentTime, i;
        for (i = 0; i < 3; i++) drumAt(t0 + i * 0.07, 0.8);
        noise(t0, 0.6, "bandpass", 400, 0.22, 2400);
      } catch (e) {}
    },
    collect: function (combo) {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var n = Math.floor(Math.abs(combo || 0)) % 5;
        var f = SCALE[n];
        tone(c.currentTime, f, f, 0.15, "triangle", 0.3);
      } catch (e) {}
    },
    hit: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var t0 = c.currentTime;
        tone(t0, 90, 40, 0.25, "sine", 0.5);
        noise(t0, 0.18, "lowpass", 500, 0.3);
      } catch (e) {}
    },
    smash: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var t0 = c.currentTime;
        noise(t0, 0.12, "highpass", 1200, 0.35);
        tone(t0, 200, 80, 0.15, "sine", 0.35);
      } catch (e) {}
    },
    capsize: function () {
      if (muted) return;
      try {
        var c = ac();
        if (!c) return;
        var t0 = c.currentTime;
        tone(t0, 300, 60, 0.7, "sine", 0.45);
        noise(t0, 0.8, "lowpass", 800, 0.35);
      } catch (e) {}
    }
  };
})();
