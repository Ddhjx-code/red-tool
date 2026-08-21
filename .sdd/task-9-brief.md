### Task 9: 音效

**Files:**
- Create: `assets/audio.js`
- Modify: `assets/main.js`（各回调处触发 + 静音按钮）

**Interfaces:**
- Produces: `window.LZSound`：`unlock()`、`isMuted()`、`setMuted(b)`、`drum()`、`dash()`、`collect(combo)`、`hit()`、`smash()`、`capsize()`

- [ ] **Step 1: audio.js**（WebAudio，ctx 懒创建；全部程序化）

```js
(function () {
  var ctx = null, muted = window.LZSave.load().muted;
  function ac() { if (!ctx) { var A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); } return ctx; }
  function env(g, t0, a, peak, d) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
  function noise(t0, d, filterType, freq, peak) { /* 白噪声 buffer 0.5s 缓存复用 + BiquadFilter + gain env */ }
  function tone(t0, f0, f1, d, type, peak) { /* OscillatorNode 频率 f0→f1 指数滑 + gain env */ }
  window.LZSound = {
    unlock: function () { var c = ac(); if (c && c.state === "suspended") c.resume(); },
    isMuted: function () { return muted; },
    setMuted: function (b) { muted = b; var o = window.LZSave.load(); o.muted = b; window.LZSave.save(o); },
    drum: function () { if (muted) return; var c = ac(); if (!c) return; var t0 = c.currentTime; tone(t0, 150, 55, 0.18, "sine", 0.5); noise(t0, 0.06, "lowpass", 900, 0.18); },
    dash: function () { /* 三连鼓点(间隔0.07) + noise 带通 400→2400Hz 扫频 0.6s */ },
    collect: function (combo) { /* 五声音阶 [523,587,659,784,880][combo%5] 三角波 0.15s */ },
    hit: function () { /* tone 90→40 0.25s + noise lowpass 500 */ },
    smash: function () { /* noise highpass 1200 短促 + tone 200→80 */ },
    capsize: function () { /* tone 300→60 0.7s + noise lowpass 800 0.8s 水声 */ }
  };
})();
```

注释处写出完整实现。

- [ ] **Step 2: main.js 触发点**：drum/dash/collect(combo)/hit/smash/capsize 回调 + 首页静音按钮（「声/静」切换，样式同文物修复局 `btn-mute`）。首次 pointerdown 调 `unlock()`。
- [ ] **Step 3: 无头验证**：mock `AudioContext` 计数或断言无异常；静音持久化到 localStorage。
- [ ] **Step 4: Commit**

---

