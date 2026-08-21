### Task 5: 计分、连击、击鼓冲刺、HUD

**Files:**
- Modify: `assets/game.js`（drum/collect/倍率/HUD 数据）、`assets/main.js`（HUD DOM 同步 + 鼓按钮 + 滑动手势正式化）

**Interfaces:**
- Produces: `LZGame.drum()`、`snapshot().gauge/dashT/combo/score`、回调 `'collect'|'dash'`

- [ ] **Step 1: game.js**

```js
function mult() { return Math.min(5, 1 + Math.floor(S.combo / 5)); }
function addScore(n) { S.scoreFrac += n; }
function drum() {
  if (S.state !== "playing") return;
  var now = S.t;
  if (now - S.lastDrumAt < D.DRUM_INTERVAL) return;
  S.lastDrumAt = now;
  S.gauge = Math.min(100, S.gauge + D.GAUGE_DRUM);
  emit("drum");
  if (S.gauge >= 100) startDash();
}
function startDash() { S.dashT = D.DASH_TIME; emit("dash"); }
function collect(e) {
  if (e.type === "zongzi") { S.zongzi++; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); addScore(10 * mult()); emit("collect", {type:"zongzi"}); }
  else if (e.type === "wine") { S.gauge = Math.min(100, S.gauge + D.GAUGE_WINE); emit("collect", {type:"wine"}); if (S.gauge >= 100) startDash(); }
  else { var pts = e.type === "ling" ? 200 : 80; addScore(pts); S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); emit("collect", {type:e.type}); window.LZSave.unlock(e.type); }
}
```

- update 内补：`if (S.dashT > 0) { S.dashT -= dt; if (S.dashT <= 0) S.gauge = 0; }`、`if (S.invT > 0) S.invT -= dt`
- 显示分 `score() { return Math.floor(S.scoreFrac); }` 加入 snapshot

- [ ] **Step 2: main.js HUD 同步**

每帧：`hud-dist` = `Math.floor(dist)+"m"`；`hud-score`；`hud-combo` = combo≥3 时 `连击 ×{combo}（{mult}倍）` 否则空；`hud-steady` 三点 `is-off`；`gauge-fill.style.height = gauge+"%"`；鼓按钮 `pointerdown` → `LZGame.drum()` + `LZSound.drum()`（Task 9 前容错判空）+ 按压 class。
滑动手势正式化：pointerdown 记录起点，pointerup 判定（阈值 30px 横向主导）；键盘 ←/→/Space（Space=drum）。

- [ ] **Step 3: 无头验证**：drum×9 → gauge≥100 → dashT>0 → 3s 后 gauge===0；吃粽子（spawnWave 后 setDist 逼近法或 `__game` 注入 collect）→ combo/score 按倍率增长。
- [ ] **Step 4: Commit**

---

