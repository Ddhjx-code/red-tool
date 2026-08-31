(function () {
  var ctx = null, muted = false;
  try { muted = !!(window.GYSave && window.GYSave.load().muted); } catch (e) { muted = false; }
  var droneNodes = null;

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
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function startDrone() {
    var c = ac();
    if (!c || muted || droneNodes) return;
    var o1 = c.createOscillator();
    o1.type = "sine";
    o1.frequency.value = 55;
    var o2 = c.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 55.7;
    var g = c.createGain();
    g.gain.value = 0.035;
    o1.connect(g); o2.connect(g); g.connect(c.destination);
    o1.start(); o2.start();
    droneNodes = { o1: o1, o2: o2, g: g };
  }
  function stopDrone() {
    if (droneNodes) {
      try { droneNodes.o1.stop(); droneNodes.o2.stop(); } catch (e) {}
      droneNodes = null;
    }
  }

  window.GYAudio = {
    unlock: function () { ac(); },
    setMuted: function (m) { muted = !!m; if (m) stopDrone(); },
    startDrone: startDrone,
    stopDrone: stopDrone,
    step: function () { tone(now(), 140 + Math.random() * 30, 90, 0.08, "sine", 0.06); },
    choose: function () { tone(now(), 320, 240, 0.1, "triangle", 0.08); },
    bad: function () {
      var t = now();
      tone(t, 180, 60, 0.7, "sawtooth", 0.09);
      tone(t + 0.08, 1200, 200, 0.4, "sine", 0.05);
    },
    good: function () {
      var t = now();
      tone(t, 392, 392, 0.25, "sine", 0.06);
      tone(t + 0.15, 523, 523, 0.35, "sine", 0.05);
    },
    heartbeat: function () {
      var t = now();
      tone(t, 60, 40, 0.12, "sine", 0.14);
      tone(t + 0.22, 55, 38, 0.1, "sine", 0.1);
    },
    ending: function (lost) {
      var t = now();
      if (lost) {
        tone(t, 220, 55, 1.6, "sine", 0.12);
        tone(t + 0.4, 165, 41, 1.8, "sine", 0.08);
      } else {
        tone(t, 262, 262, 0.5, "sine", 0.07);
        tone(t + 0.3, 392, 392, 0.6, "sine", 0.06);
        tone(t + 0.6, 523, 523, 0.9, "sine", 0.05);
      }
    }
  };
})();
