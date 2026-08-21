### Task 3: 龙舟与换线

**Files:**
- Create: `tools/longzhou/assets/sprites.js`（本任务只实现 `boat`，障碍/物品 Task 4/6 补）
- Modify: `main.js` 临时循环加画船；`game.js` 先建最小骨架（state/lane/boatX/swipe/update 的船体部分）

**Interfaces:**
- Produces: `LZSprites.boat(ctx,x,y,s,o)`；`LZGame.swipe(dir)`、`LZGame.snapshot().lane/boatX`

- [ ] **Step 1: sprites.js 龙舟绘制**

背后视角：船尾在近处（下），船首在远处（上）。`boat(ctx, x, y, s, o)`，s=1 时船长约 150u：
- 船身：朱红 `#C3272B`，细长 U 形（贝塞尔），上窄（龙头端 26u 宽）下宽（船尾 44u 宽），深朱红描边；船尾横线封板
- 龙首：船顶端金色 `#FFB61E` 小龙头剪影（上翘弧线+角），冲刺时 `o.dashing` 加金色光晕（shadowBlur 18u）
- 鼓手：船首 1/3 处居中圆形头+躯干剪影（黛青），`o.drumHit` 为真时双臂上举，否则下垂
- 划桨手：两侧各 3 个剪影小圆点+短桨线，桨角 = `sin(o.paddlePhase + i*0.9) * 0.6`，桨入水侧画白色小水花点
- `o.tilt`：整体绕中心旋转 tilt 弧度（翻船用）；`o.blink`：受击无敌时 alpha 0.35/1 闪烁

- [ ] **Step 2: game.js 最小骨架**

```js
(function () {
  var D = window.LZData;
  var S = { state: "home", lane: 0, boatX: 0, dist: 0, t: 0 };
  var cb = {};
  function update(dt) {
    if (S.state !== "playing") return;
    S.t += dt;
    var k = Math.min(1, dt / D.LANE_TIME);
    S.boatX += (S.lane - S.boatX) * Math.min(1, k * 3);
    if (Math.abs(S.lane - S.boatX) < 0.01) S.boatX = S.lane;
  }
  window.LZGame = {
    start: function () { S.state = "playing"; S.lane = 0; S.boatX = 0; S.dist = 0; S.t = 0; },
    update: update,
    swipe: function (dir) { if (S.state !== "playing") return; S.lane = Math.max(-1, Math.min(1, S.lane + dir)); },
    setCallback: function (n, fn) { cb[n] = fn; },
    emit: function (n, a) { if (cb[n]) cb[n](a); },
    snapshot: function () { return S; }
  };
})();
```

（Task 4/5 在此文件上继续扩展 S 字段与 update，保持已有签名。）

- [ ] **Step 3: main.js 临时循环**：`LZGame.update(dt)`；`var m=LZScene.metrics(); var p=LZScene.project(S.boatX, 0); LZSprites.boat(ctx, p.x, p.y, p.s*1, {paddlePhase: S.t*6})`；键盘 ←/→ 与 canvas 滑动（pointerdown/up，dx>30 且 |dx|>|dy| → swipe）接入。

- [ ] **Step 4: 无头验证**：playwright：`LZGame.start()` → `__swipe` 用 `page.mouse` 模拟拖动 → 300ms 后 `LZGame.snapshot().lane===1`；截图确认船在右航道、桨有动画相位。
Expected: 通过

- [ ] **Step 5: Commit**

---

