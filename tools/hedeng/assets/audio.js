(function () {
  var ctx = null, muted = false;
  try { muted = !!(window.HDSave && window.HDSave.load().muted); } catch (e) { muted = false; }
  var waterNode = null, waterGain = null;

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

  function startWater() {
    var c = ac();
    if (!c || muted || waterNode) return;
    var len = Math.floor(c.sampleRate * 2);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    waterNode = c.createBufferSource();
    waterNode.buffer = buf;
    waterNode.loop = true;
    var f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    waterGain = c.createGain();
    waterGain.gain.value = 0.05;
    waterNode.connect(f); f.connect(waterGain); waterGain.connect(c.destination);
    waterNode.start();
  }
  function stopWater() {
    if (waterNode) { try { waterNode.stop(); } catch (e) {} waterNode = null; waterGain = null; }
  }

  window.HDAudio = {
    unlock: function () { ac(); },
    setMuted: function (m) { muted = !!m; if (m) stopWater(); },
    startWater: startWater,
    stopWater: stopWater,
    select: function () { tone(now(), 620, 830, 0.09, "triangle", 0.1); },
    write: function () { tone(now(), 880 + Math.random() * 120, 700, 0.05, "sine", 0.05); },
    ignite: function () {
      var t = now();
      tone(t, 180, 320, 0.25, "sine", 0.12);
      tone(t + 0.05, 1200, 2400, 0.15, "triangle", 0.03);
    },
    splash: function () {
      var c = ac();
      if (!c || muted) return;
      var t = now();
      var len = Math.floor(c.sampleRate * 0.35);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      var src = c.createBufferSource();
      src.buffer = buf;
      var f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(300, t + 0.3);
      var g = c.createGain();
      g.gain.value = 0.16;
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(t);
    },
    chime: function () {
      var t = now();
      tone(t, 523, 523, 0.7, "sine", 0.09);
      tone(t + 0.18, 784, 784, 0.9, "sine", 0.07);
      tone(t + 0.36, 1046, 1046, 1.2, "sine", 0.05);
    }
  };
})();
