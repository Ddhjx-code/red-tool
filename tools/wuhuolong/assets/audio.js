(function () {
  var ac = null;
  var master = null;
  var muted = false;
  var beatT = 0;
  var stepIdx = 0;
  var intensity = 0.5;
  var noise = null;

  function Ctor() {
    return window.AudioContext || window.webkitAudioContext;
  }

  function available() { return !!Ctor(); }

  function init() {
    var W = Ctor();
    if (ac || !W) { return ac; }
    try {
      ac = new W();
      master = ac.createGain();
      master.gain.value = 0.85;
      master.connect(ac.destination);
    } catch (e) {
      ac = null;
      master = null;
    }
    return ac;
  }

  function resume() {
    if (!ac || !ac.resume) { return; }
    if (ac.state === "suspended") { ac.resume(); }
  }

  function noiseBuf(dur) {
    var n = Math.floor(ac.sampleRate * dur);
    var buf = ac.createBuffer(1, Math.max(1, n), ac.sampleRate);
    var d = buf.getChannelData(0);
    var r = window.WHRng(0x9E37);
    var i;
    for (i = 0; i < d.length; i++) {
      d[i] = r.range(-1, 1) * (1 - i / d.length);
    }
    return buf;
  }

  function drum(t, amp) {
    var o = ac.createOscillator();
    var g = ac.createGain();
    var src;
    var ng;
    var bp;
    o.type = "sine";
    o.frequency.setValueAtTime(155, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.17);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.40);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.44);

    if (!noise) { noise = noiseBuf(0.14); }
    src = ac.createBufferSource();
    src.buffer = noise;
    bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 190;
    ng = ac.createGain();
    ng.gain.setValueAtTime(amp * 0.45, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(master);
    src.start(t);
  }

  function gong(t, amp, freq) {
    var parts = [1, 2.76, 5.40, 8.93];
    var i;
    var o;
    var g;
    for (i = 0; i < parts.length; i++) {
      o = ac.createOscillator();
      g = ac.createGain();
      o.type = "sine";
      o.frequency.value = freq * parts[i];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp / (i + 1.5), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7 / (1 + i * 0.45));
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 2.1);
    }
  }

  function playStep(i) {
    var t = ac.currentTime + 0.02;
    var a = 0.45 + 0.55 * intensity;
    if (i === 0 || i === 4) { drum(t, 0.55 * a); }
    else if (i === 2 || i === 6) { drum(t, 0.26 * a); }
    else if (i === 3 && intensity > 0.62) { drum(t, 0.20 * a); }
    if (i === 0) { gong(t, 0.07 + 0.11 * intensity, 330); }
  }

  function tick(s, dt) {
    var spb;
    if (!ac || muted) { return; }
    if (s.phase === "return") { intensity = 0.30; }
    else if (s.boss) { intensity = 1; }
    else { intensity = 0.45 + 0.5 * Math.min(1, (s.enemies || 0) / 6); }
    spb = 0.54 - 0.14 * intensity;
    beatT += dt;
    if (beatT >= spb) {
      beatT -= spb;
      if (beatT > spb) { beatT = 0; }
      stepIdx = (stepIdx + 1) % 8;
      playStep(stepIdx);
    }
  }

  function sfx(name) {
    var t;
    if (!ac || muted) { return; }
    t = ac.currentTime + 0.01;
    if (name === "purify") { gong(t, 0.26, 540); }
    else if (name === "thrust") { drum(t, 0.26); }
    else if (name === "tail") { drum(t, 0.34); gong(t, 0.15, 300); }
    else if (name === "hurt") { drum(t, 0.46); gong(t, 0.14, 170); }
    else if (name === "gate") { gong(t, 0.34, 660); }
    else if (name === "room") { gong(t, 0.16, 420); }
    else if (name === "boss") { gong(t, 0.40, 140); drum(t, 0.55); }
    else if (name === "return") { gong(t, 0.46, 210); }
    else if (name === "fail") { gong(t, 0.30, 120); drum(t, 0.40); }
  }

  function setMuted(v) {
    muted = !!v;
    if (master) { master.gain.value = muted ? 0 : 0.85; }
    return muted;
  }

  window.WHAudio = {
    available: available,
    init: init,
    resume: resume,
    tick: tick,
    sfx: sfx,
    setMuted: setMuted,
    isMuted: function () { return muted; },
    isOn: function () { return !!ac && !muted; }
  };
})();
