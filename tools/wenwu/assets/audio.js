// WebAudio 程序化音效 —— 真实物件质感（木击/金声），零素材
window.Sound = (function () {
  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var muted = false;
  var unlocked = false;

  function ensure() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    var seed = 987654321;
    for (var i = 0; i < d.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (seed / 4294967296) * 2 - 1;
    }
  }

  function unlock() {
    ensure();
    if (ctx && ctx.state === "suspended") ctx.resume();
    unlocked = true;
  }

  function ready() { return ctx && unlocked && !muted; }

  function noiseSrc() {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  }

  function tone(f0, f1, dur, vol, type, delay) {
    if (!ready()) return;
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function burst(vol, dur, fType, fFreq, delay) {
    if (!ready()) return;
    var t = ctx.currentTime + (delay || 0);
    var s = noiseSrc();
    var f = ctx.createBiquadFilter();
    f.type = fType;
    f.frequency.value = fFreq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.05);
  }

  return {
    unlock: unlock,
    setMuted: function (m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.85;
    },
    isMuted: function () { return muted; },
    // 拾起碎片：轻拿
    pickup: function () { burst(0.1, 0.06, "bandpass", 900); },
    // 碎片落位：木击咔哒
    lock: function () {
      burst(0.28, 0.05, "highpass", 1400);
      tone(190, 120, 0.1, 0.22, "sine");
    },
    // 拂拭完成 / 答对：暖金钟声
    chime: function () {
      tone(523, 523, 0.7, 0.16, "sine");
      tone(784, 784, 0.9, 0.12, "sine", 0.09);
      burst(0.05, 0.3, "highpass", 3200, 0.05);
    },
    // 答错：闷响
    wrong: function () {
      tone(120, 70, 0.2, 0.25, "sine");
      burst(0.1, 0.1, "lowpass", 300);
    },
    // 显色仪式：逐片上行音
    revealTick: function (i, n) {
      var f = 320 * Math.pow(2, (i / Math.max(1, n)) * 0.8);
      tone(f, f * 1.02, 0.35, 0.12, "sine");
      burst(0.04, 0.15, "highpass", 2400, 0.02);
    },
    // 修复完成：低沉钟声 + 金粉
    gong: function () {
      tone(196, 98, 1.4, 0.3, "sine");
      tone(392, 196, 1.0, 0.1, "sine", 0.05);
      burst(0.06, 0.6, "highpass", 2600, 0.1);
    }
  };
})();
