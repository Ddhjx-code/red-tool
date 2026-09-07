var Audio = (function () {
  var ctx = null;
  var muted = false;
  var drawOsc = null;
  var drawGain = null;

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { ctx = null; }
  }

  function isMuted() {
    try { muted = localStorage.getItem('houyi_mute') === '1'; } catch (e) {}
    return muted;
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('houyi_mute', muted ? '1' : '0'); } catch (e) {}
    return muted;
  }

  function playDraw() {
    if (isMuted()) return;
    ensure();
    if (!ctx) return;
    drawOsc = ctx.createOscillator();
    drawGain = ctx.createGain();
    drawOsc.type = 'sine';
    drawOsc.frequency.setValueAtTime(80, ctx.currentTime);
    drawOsc.frequency.linearRampToValueAtTime(160, ctx.currentTime + 0.8);
    drawGain.gain.setValueAtTime(0.08, ctx.currentTime);
    drawOsc.connect(drawGain);
    drawGain.connect(ctx.destination);
    drawOsc.start();
  }

  function stopDraw() {
    if (drawOsc) {
      try { drawOsc.stop(); } catch (e) {}
      drawOsc = null;
    }
  }

  function playRelease() {
    if (isMuted()) return;
    stopDraw();
    ensure();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  function playHit() {
    if (isMuted()) return;
    ensure();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  function playBirdKill() {
    if (isMuted()) return;
    ensure();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  function playCollapse() {
    if (isMuted()) return;
    ensure();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  }

  isMuted();

  return {
    playDraw: playDraw,
    stopDraw: stopDraw,
    playRelease: playRelease,
    playHit: playHit,
    playBirdKill: playBirdKill,
    playCollapse: playCollapse,
    isMuted: isMuted,
    toggleMute: toggleMute
  };
})();
