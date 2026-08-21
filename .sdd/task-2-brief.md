### Task 2: 伪 3D 场景（视觉检查点）

**Files:**
- Create: `tools/longzhou/assets/scene.js`
- Modify: `assets/main.js`（临时最小启动：init canvas + rAF 只画场景，供截图检查；正式装配在 Task 10）

**Interfaces:**
- Consumes: `LZData.F/Z_MAX`、`LZRng`
- Produces: `LZScene.init/resize/project/draw/addSplash`（签名见全局契约）

- [ ] **Step 1: scene.js 投影与场景**

```js
(function () {
  var D = window.LZData;
  var ctx = null, W = 0, H = 0, u = 1;
  var horizonY = 0, boatY = 0, cx = 0, laneW = 0;
  var ridge = window.LZRng(7);
  var ridgePts = [];
  (function () { for (var i = 0; i <= 24; i++) ridgePts.push(ridge.range(0.35, 1)); })();
  var splashes = [];

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    ctx.canvas.width = W * dpr; ctx.canvas.height = H * dpr;
    ctx.canvas.style.width = W + "px"; ctx.canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    u = W / 400;
    horizonY = H * 0.32; boatY = H * 0.82; cx = W / 2; laneW = W * 0.27;
  }

  function project(laneX, z) {
    var p = D.F / (D.F + Math.max(z, -D.F * 0.8));
    return { x: cx + laneX * laneW * p, y: horizonY + (boatY - horizonY) * p, s: p };
  }

  function ridgeY(i, layer) {
    return horizonY - ridgePts[(i + layer * 8) % ridgePts.length] * (26 - layer * 7) * u;
  }

  function drawSky() { /* 月白→浅青竖向渐变铺满 horizonY 以上（实际铺满全屏作底） */ }
  function drawMountains(dist) { /* 两层黛青剪影：x 偏移 = -(dist * (layer===0?0.4:1.1)) % W，折线 ridgeY 闭合到 horizonY 填充；远层色浅（黛青 40% alpha），近层实色 */ }
  function drawRiver(st) { /* 梯形：远端半宽 laneW*0.9*proj(Z_MAX)，近端半宽 laneW*2.4；渐变 horizonY 处 #8fb8ba → 底部 #2e3d52；航道虚线 laneX=±0.5：z 从 0..Z_MAX 步长 6，取 (z - dist%6) 画短段，宽度随 s；波光：12 条横线，z_i = (i*7.3 + 90 - dist % 90) % 90，laneX=rng 固定序列 [-0.9..0.9]，白色 alpha 0.12*s */ }
  function drawBanks(dist) { /* 两岸剪影：世界坐标间隔 14m 一个景物，z = 90 - ((dist + k*14) % 90)... 实际 z = (k*14 - dist % (90+14))，取 0<z<Z_MAX；laneX=±(2.0 + ((k*37)%10)/18)；类型按 k%4：芦苇丛/小树/屋舍/艾草叶，黛青深剪影，尺寸 40u*s */ }
  function drawSplashes(dt) { /* 粒子：{x,y,vx,vy,life}，重力 600u，life 0.5s，白色圆点 alpha=life*2 */ }

  window.LZScene = {
    init: function (canvas) { ctx = canvas.getContext("2d"); resize(); window.addEventListener("resize", resize); },
    resize: resize,
    project: project,
    addSplash: function (x, y, n) { for (var i = 0; i < n; i++) splashes.push({ x: x, y: y, vx: (i / n - 0.5) * 260 * u, vy: -(60 + (i % 5) * 55) * u, life: 0.5 }); },
    draw: function (st, dt) { drawSky(); drawMountains(st.dist); drawRiver(st); drawBanks(st.dist); drawSplashes(dt); },
    metrics: function () { return { W: W, H: H, u: u, horizonY: horizonY, boatY: boatY, cx: cx, laneW: laneW }; }
  };
})();
```

注释中的绘制说明是实现要求：按描述写完整 canvas 代码（渐变、路径、填充），不得留空函数。

- [ ] **Step 2: main.js 临时启动**（仅本任务用，Task 10 覆盖重写）：`LZScene.init(document.getElementById("stage"))` + rAF 循环 `LZScene.draw({dist: t*12}, dt)`，让河面滚动起来供截图。

- [ ] **Step 3: 无头截图视觉检查**

Run: playwright 打开 `index.html`（390×844），1s 后截图 `/tmp/lz-scene.png`；检查：地平线在约 32% 高度、河面近宽远窄、有航道虚线、无 JS 报错。
Expected: 人眼确认「伪 3D 速度感成立」——**不过关则调参（horizonY/laneW/渐变对比）直到过关**，这是打铁花教训的视觉门禁。

- [ ] **Step 4: Commit**

---

