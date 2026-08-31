(function () {
  var ctx = null, muted = false;
  var master = null, musicBus = null, sfxBus = null;
  var pluckCache = {}, ambientTimer = 0, ambientOn = false;
  var PENTA = [196.0, 220.0, 246.9, 293.7, 329.6, 392.0, 440.0, 493.9, 587.3];

  function ac() {
    if (!ctx) {
      try {
        var A = window.AudioContext || window.webkitAudioContext;
        if (!A) return null;
        ctx = new A();
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
        musicBus = ctx.createGain();
        musicBus.gain.value = 0.5;
        musicBus.connect(master);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.9;
        sfxBus.connect(master);
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  function now() { var c = ac(); return c ? c.currentTime : 0; }

  function tone(t0, f0, f1, dur, type, peak, bus) {
    var c = ac();
    if (!c || muted) return;
    var o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(bus || sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(t0, dur, freq, peak) {
    var c = ac();
    if (!c || muted) return;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    src.buffer = buf;
    var f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    var g = c.createGain();
    g.gain.value = peak;
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t0);
  }

  function pluckBuffer(freq) {
    var k = Math.round(freq);
    if (pluckCache[k]) return pluckCache[k];
    var c = ac();
    var sr = c.sampleRate;
    var N = Math.max(2, Math.floor(sr / freq));
    var len = Math.floor(sr * 2.2);
    var buf = c.createBuffer(1, len, sr);
    var d = buf.getChannelData(0);
    var ring = new Float32Array(N);
    for (var i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    var idx = 0;
    for (var j = 0; j < len; j++) {
      var cur = ring[idx];
      var nxt = ring[(idx + 1) % N];
      ring[idx] = 0.994 * 0.5 * (cur + nxt);
      d[j] = cur * 0.8;
      idx = (idx + 1) % N;
    }
    pluckCache[k] = buf;
    return buf;
  }

  function pluck(freq, when, gain) {
    var c = ac();
    if (!c || muted) return;
    var src = c.createBufferSource();
    src.buffer = pluckBuffer(freq);
    src.playbackRate.value = 0.985 + Math.random() * 0.03;
    var g = c.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(musicBus);
    src.start(when);
  }

  function ambientTick() {
    if (!ambientOn || muted) return;
    var c = ac();
    if (c) {
      var t = c.currentTime + 0.05;
      var n = PENTA[Math.floor(Math.random() * PENTA.length)];
      pluck(n, t, 0.16);
      if (Math.random() < 0.35) {
        var n2 = PENTA[Math.floor(Math.random() * PENTA.length)];
        pluck(n2, t + 0.28 + Math.random() * 0.2, 0.1);
      }
    }
    ambientTimer = setTimeout(ambientTick, 1500 + Math.random() * 2200);
  }

  function drum(t0, peak) {
    var c = ac();
    if (!c || muted) return;
    tone(t0, 110, 38, 0.32, "sine", peak, sfxBus);
    noiseBurst(t0, 0.05, 900, peak * 0.5);
  }

  function duckMusic(ms) {
    var c = ac();
    if (!c || !musicBus) return;
    var t0 = c.currentTime;
    musicBus.gain.cancelScheduledValues(t0);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t0);
    musicBus.gain.linearRampToValueAtTime(0.12, t0 + 0.08);
    musicBus.gain.linearRampToValueAtTime(0.5, t0 + 0.08 + ms / 1000);
  }

  window.SZAudio = {
    unlock: function () { ac(); },
    setMuted: function (m) { muted = !!m; },
    startAmbient: function () {
      if (!ac()) return;
      if (ambientOn) return;
      ambientOn = true;
      ambientTick();
    },
    stopAmbient: function () {
      ambientOn = false;
      clearTimeout(ambientTimer);
    },
    select: function () { tone(now(), 660, 880, 0.08, "triangle", 0.1); },
    move: function () {
      var c = ac(); if (!c) return;
      tone(now(), 300 + Math.random() * 24, 220, 0.1, "sine", 0.13);
    },
    hit: function () {
      var c = ac(); if (!c) return;
      var v = 0.94 + Math.random() * 0.12;
      tone(now(), 180 * v, 60, 0.18, "square", 0.15);
      noiseBurst(now(), 0.06, 1600, 0.1);
    },
    shoot: function () {
      var v = 0.94 + Math.random() * 0.12;
      tone(now(), 1200 * v, 400, 0.12, "sawtooth", 0.07);
    },
    fire: function () {
      var t = now();
      noiseBurst(t, 0.5, 500, 0.16);
      tone(t, 90, 40, 0.5, "sine", 0.12);
    },
    surrender: function () {
      var t = now();
      pluck(PENTA[5], t, 0.2);
      pluck(PENTA[7], t + 0.18, 0.16);
    },
    drum: function () { drum(now(), 0.2); },
    miss: function () { tone(now(), 240, 200, 0.12, "sine", 0.07); },
    win: function () {
      var c = ac(); if (!c) return;
      duckMusic(1600);
      var t = now();
      pluck(PENTA[4], t, 0.22);
      pluck(PENTA[6], t + 0.16, 0.2);
      pluck(PENTA[8], t + 0.32, 0.24);
      tone(t + 0.32, 1568, 1568, 0.5, "sine", 0.05);
    },
    lose: function () {
      var c = ac(); if (!c) return;
      duckMusic(1400);
      var t = now();
      tone(t, 220, 110, 0.5, "sine", 0.15);
      tone(t + 0.2, 165, 82, 0.6, "sine", 0.11);
    }
  };
})();
