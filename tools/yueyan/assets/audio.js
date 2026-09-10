(function () {
  /* =========================== [AUDIO] ============================
     §10.3.3 — exactly seven event points, closed list, no eighth.
     Web Audio synthesis only: the zip carries zero audio files (V-2).
      §7 determinism: fixed frequencies, fixed envelopes, never ambient
      variation.
     §10.3.3 静音默认开启: muted is the shipped default, and a muted play
     is a genuine no-op — no context, no node, nothing scheduled.
     The AudioContext is constructed only after a real user gesture, so
     autoplay policy is never fought and a headless host stays silent.
     ================================================================ */
  'use strict';
  window.YueYan = window.YueYan || {};

  var ctx = null;
  var unlocked = false;                                   // set by the first gesture
  var tried = false;                                      // one construction attempt only
  var muted = true;                                       // §10.3.3 静音默认开启

  /* §10.3.3 — these seven names and no others */
  var EVENTS = {
    slot:    { freq: 520, dur: 0.05, type: 'triangle' },   /* 轻木鱼，极短 */
    craft:   { freq: 392, dur: 0.25, type: 'sine' },       /* 商调式单音 */
    step:    { freq: 440, dur: 0.12, type: 'sine' },       /* 递增音高，四步为一组 */
    grade:   { freq: 587, dur: 0.30, type: 'sine' },       /* 金/银/铜三档，无失败音色 */
    banquet: { freq: 659, dur: 0.35, type: 'sine' },       /* 钟磬 */
    assign:  { freq: 330, dur: 0.20, type: 'sine' },       /* 柔和单音 */
    moon:    { freq: 294, dur: 1.20, type: 'sine' }        /* 长音，按 E1..E5 五档长度 */
  };

  var STEP_SCALE = [440, 494, 587, 659];                  /* S1..S4 ascending (§4.3.2) */
  var GRADE_SCALE = { 1: 392, 2: 494, 3: 587 };           /* 铜 / 银 / 金 (§4.4.1) */
  var MOON_DUR = { E1: 1.20, E2: 1.05, E3: 0.90, E4: 0.75, E5: 0.60 };

  /* Context only exists past a gesture. Unsupported host => silent no-op. */
  function ensure() {
    if (!unlocked || tried) { return ctx; }
    tried = true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return null; }
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  var GESTURES = ['pointerdown', 'keydown', 'touchstart'];

  function on(node, names, fn) {
    for (var i = 0; i < names.length; i++) { node.addEventListener(names[i], fn); }
  }
  function off(node, names, fn) {
    for (var i = 0; i < names.length; i++) { node.removeEventListener(names[i], fn); }
  }

  function unlock() {
    unlocked = true;
    off(document, GESTURES, unlock);
    var c = ensure();
    if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} }
  }

  /* fixed attack / decay envelope — deterministic, no jitter */
  function tone(freq, dur, type) {
    var c = ensure();
    if (!c) { return; }
    var t = c.currentTime;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /* per-variant detail: step index, grade tier, ending length */
  function variant(name, arg) {
    if (name === 'step' && typeof arg === 'number') {
      return { freq: STEP_SCALE[Math.min(3, Math.max(0, Math.floor(arg)))],
               dur: EVENTS.step.dur, type: EVENTS.step.type };
    }
    if (name === 'grade' && typeof arg === 'number' && GRADE_SCALE[arg]) {
      return { freq: GRADE_SCALE[arg], dur: EVENTS.grade.dur, type: EVENTS.grade.type };
    }
    if (name === 'moon' && typeof arg === 'string' && MOON_DUR[arg]) {
      return { freq: EVENTS.moon.freq, dur: MOON_DUR[arg], type: EVENTS.moon.type };
    }
    return EVENTS[name] || null;                          /* unknown name: silent */
  }

  function play(name, arg) {
    if (muted) { return; }                                /* 静音时零副作用 */
    var v = variant(name, arg);
    if (v) { tone(v.freq, v.dur, v.type); }
  }

  function setMuted(v) { muted = !!v; }
  function isMuted() { return muted; }

  on(document, GESTURES, unlock);

  window.YueYan.Audio = { play: play, setMuted: setMuted, isMuted: isMuted };
})();
