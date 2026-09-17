# 舞火龙 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现「非遗手作坊」#19《舞火龙》——中秋主题横版推进 + 关底 1v1 Boss H5 小工具（32 节链式火龙 + 香火机制 + 净化 Boss + 龙归天仪式），打包 `dist/wuhuolong.zip`。

**Architecture:** 纯原生 JS（IIFE + `window.WH*` 全局，沿用龙舟/乞巧惯例）。Canvas 2D 分层渲染（夜空渐变 → 远景剪影 → 街巷剪影 → 火龙含发光 → 前景雾烟 → UI）。**玩家是一条 32 节链**：龙头由拖动直接驱动，龙身 31 节以「跟随 + 行波」推演，状态只存每节一个本地角度标量、每帧重建变换。零外部素材，全程序化。

**Tech Stack:** 原生 JS/CSS/HTML、Canvas 2D、WebAudio、localStorage、Playwright（无头验证，python 版已装，chromium + webkit 均可用）。

**Spec:** `docs/specs/2026-09-15-wuhuolong-design.md`（配套：`docs/specs/2026-09-15-action-anim-layer-spec.md` §适用范围、`docs/research/animation-pipeline-research.md`、`docs/research/touch-action-research.md`）

## Global Constraints

- **容器规范（`.skill/` 1.6.0，逐条硬性）**：`index.html` 必须在 zip 根；脚本全部外置 `./assets/*.js`、**禁内联 `<script>` / 行内事件 / `javascript:` / `eval` / `new Function`**；**禁 `type="module"`**（经典脚本 + `window` 命名空间）；禁网络（fetch/XHR/WebSocket）、剪贴板、下载、外链、传感器、Worker、WASM、`iframe`/`object`、`<base>`；资源全部相对路径；zip 内仅允许 html/css/js/json/图片/字体
- **JS 语法基线 ES2017**：**禁 `?.` / `??` / 对象展开 `{...}` / 逻辑赋值 `||=` `&&=` / `BigInt` 字面量**；写入 `var` / `function(){}`；用 `addEventListener` 绑事件
- **CSS 基线 Chrome 61**：**禁 `inset` 简写**（用 `top/right/bottom/left`）、**禁 `aspect-ratio` / `clamp()` / `dvh` / 逻辑属性**（无回退时）；flex `gap` 不得作为唯一间距手段（用子项 margin 基线）；关键操作不得只在 `:hover` 出现
- **端能力出口**：`window.xhs && window.xhs.miniTool` 判空降级；`writeTempFile({data})` 的 `data` **必须是完整 `data:image/png;base64,...`**（`canvas.toDataURL()` 原样传，**不得** `split(",")[1]`）；`saveImageToPhotosAlbum({filePath})` 只接受本地路径
- **安全区**：`var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`（四边同理）；viewport 含 `width=device-width, initial-scale=1.0, viewport-fit=cover`
- **确定性**：**禁 `Math.random()`**，一切伪随机走 `mulberry32`；`?test=1` 固定种子 `20260925` 并暴露 `window.__wh`；逻辑走**固定步长**累加器
- **数值锚点（spec 已定，勿擅改）**：龙身 **32 节**、节长 `L=2.0`；行波 `A=0.55 / freq=2.2 / k=0.55`；每节相对转角上限 `0.42 rad`；`TAP_MS=180`、`DOUBLE_MS=260`；缠缚判定 **≥8 节**；香火 初始 100、基础损耗 1.2/s、受击 −8、疫气附着 −3/s、击溃疫气 +4、击溃瘟鬼 +10、珠 −12、**发暗阈值 35**、0 即败；单局 **3–5 分钟**；**四拍 + 尾声**；包体 **< 100 KB**
- **视觉 tokens（从题材生长）**：夜色冷调（深青 `#0b1520` / 靛 `#16283c`）对撞香火暖调（橙 `#ff8a3d` / 金白 `#ffe9b0`）；**唯一强调色就是火光**；标题字体栈 `"Kaiti SC","STKaiti","KaiTi",serif`
- **代码风格沿用现有工具**：IIFE、`var`、无注释、事件用 `addEventListener`、`localStorage` 一律 try/catch
- **文化准确性**：所有知识文案必须与 spec §7 的 11 条一致，不得臆造

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `tools/wuhuolong/index.html` | 单页视图：boot / stage(canvas) / hud / result；脚本按序外链 |
| `tools/wuhuolong/assets/data.js` | `window.WHData`：调参常量、骨骼拓扑、四拍关卡脚本、知识卡 11 条、文案 |
| `tools/wuhuolong/assets/rng.js` | `window.WHRng`：mulberry32 |
| `tools/wuhuolong/assets/chain.js` | `window.WHChain`：链式骨骼 + 行波推演 + 链↔柱 / 链↔敌人碰撞 |
| `tools/wuhuolong/assets/fire.js` | `window.WHFire`：香火粒子（对象池）+ 发光 sprite 合成 |
| `tools/wuhuolong/assets/scene.js` | `window.WHScene`：夜空/远景/街巷剪影/雾烟分层 + 摄像机视差 |
| `tools/wuhuolong/assets/game.js` | `window.WHGame`：状态机 / 推进 / 香火 / 疫气·瘟鬼 / Boss 三阶段 / 净化 / 归天 / 测试钩子 |
| `tools/wuhuolong/assets/audio.js` | `window.WHSound`：锣鼓程序化合成 |
| `tools/wuhuolong/assets/share.js` | `window.WHShare`：龙归天分享卡绘制 + 端能力出口 |
| `tools/wuhuolong/assets/main.js` | DOM 装配、视图切换、触屏输入（拖动 + 舞龙式三手势）、rAF 主循环 |
| `tools/wuhuolong/assets/style.css` | 全部样式（tokens + 视图 + 触控 UI + 安全区） |
| `tests/wuhuolong_smoke.py` | Playwright 无头断言（仓库根，不入 zip） |

模块依赖（加载顺序）：`data.js → rng.js → audio.js → chain.js → fire.js → scene.js → game.js → share.js → main.js`

核心接口契约（跨任务依赖，签名不得擅改）：

```js
// chain.js —— 全部角度单位 rad，坐标逻辑单位（非像素）
WHChain.build()                              // 依 WHData.CHAIN 建 32 节骨架，重置为直线
WHChain.head()                               // -> {x, y} 龙头逻辑坐标
WHChain.setHead(x, y)                        // 拖动直接设龙头目标位（内部限速）
WHChain.step(dt)                             // 固定步长推演一次：跟随 + 行波 + 限角
WHChain.segments()                           // -> [{x,y,angle,localAngle}] 长度 32，只读快照
WHChain.wrap(pillars)                        // pillars: [{x,y,r}]；返回缠缚节数
WHChain.hitTest(rect)                        // rect: {x,y,w,h}；-> 命中的节索引数组
WHChain.reset()
WHChain.debug()                              // -> {angles:[31], lengths:[31], world:[[..]]} 供断言
// 常量：N=32, L=2.0, A=0.55, FREQ=2.2, K=0.55, MAXTURN=0.42

// fire.js
WHFire.init(offscreen)                       // 预渲染发光 sprite 到离屏 canvas
WHFire.emit(segments, count)                 // 沿节采样发射香火粒子
WHFire.step(dt)                              // 对象池推进
WHFire.draw(ctx, cam)                        // globalCompositeOperation='lighter' 叠加
WHFire.intensity(v)                          // v∈[0,1] 香火强度 → 发光半径/亮度系数
WHFire.debug()                               // -> {alive, pooled}

// scene.js
WHScene.init(canvas)
WHScene.resize()
WHScene.camera(x)                            // 逻辑 x → 视差偏移
WHScene.drawBack(ctx, cam, t)                // 夜空 + 远景剪影 + 街巷剪影
WHScene.drawFront(ctx, cam, t)               // 前景雾烟
WHScene.metrics()                            // -> {W,H,u,camX,groundY}

// game.js
WHGame.init()
WHGame.start()                               // boot → beat 1
WHGame.step(dt)                              // 固定步长推进（内部累加器）
WHGame.action(kind)                          // 'sweep'|'wrap'|'orb'
WHGame.snapshot()                            // 只读状态
WHGame.setCallback(name, fn)                 // 'hit'|'wrap'|'purify'|'beat'|'return'|'toast'|'fail'
window.__wh                                  // ?test=1 测试钩子（见 Task 13）

// share.js
WHShare.paint(stats)                         // -> dataURL（1080×1440）
WHShare.saveAlbum() / WHShare.postNote()     // 内部判空降级
```

---

### Task 1: 骨架 + 数据 + 随机数

**Files:**
- Create: `tools/wuhuolong/index.html`、`assets/data.js`、`assets/rng.js`、`assets/style.css`

**Interfaces:**
- Produces: `window.WHData`（常量/拓扑/关卡/知识）、`window.WHRng(seed) -> {next(), range(a,b), int(a,b), pick(arr)}`、DOM 骨架（id：`stage` `hud` `hud-fire` `hud-beat` `pad` `btn-style` `result` `toast`）

- [ ] **Step 1: rng.js（mulberry32，逐字复用仓库既有实现）**

```js
(function () {
  function WHRng(seed) {
    var a = seed >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      range: function (lo, hi) { return lo + (hi - lo) * next(); },
      int: function (lo, hi) { return Math.floor(lo + (hi - lo + 1) * next()); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; }
    };
  }
  window.WHRng = WHRng;
})();
```

- [ ] **Step 2: data.js（常量与拓扑，数值逐条抄自 Global Constraints 与 spec）**

```js
(function () {
  window.WHData = {
    SEED: 20260925,
    CHAIN: { N: 32, L: 2.0, A: 0.55, FREQ: 2.2, K: 0.55, MAXTURN: 0.42, WRAP_SEGS: 8 },
    FIRE: {
      EMIT_PER_SEG: 2, LIFE: 0.55, RISE: 26, DRIFT: 9, GRAV: -6,
      R_NEAR: 5.5, R_FAR: 2.2, INTENSITY_MIN: 0.25
    },
    CAM: { Y: 0.62, SCALE: 26, PARALLAX: [0.18, 0.42, 1.0], AHEAD: 0.28 },
    TOUCH: { TAP_MS: 180, DOUBLE_MS: 260, DRAG_MIN: 6, HIT_PAD: 44 },
    FIRE_RES: { START: 100, DRAIN: 1.2, HURT: 8, CLING_DRAIN: 3, KILL_MIASMA: 4, KILL_GHOST: 10, ORB: 12, DIM: 35 },
    ACT: { SWEEP_CD: 0.45, SWEEP_W: 9, WRAP_CD: 0.8, ORB_CD: 1.6, ORB_SPEED: 46 },
    BEATS: [
      { id: 'kaiguang', name: '开光',   len: 34, pillars: [],           miasma: 0,  ghosts: 0, hint: '拖动引龙 · 点按甩尾' },
      { id: 'guoqiao',  name: '过桥',   len: 62, pillars: [],           miasma: 7,  ghosts: 2, hint: '香火即命 · 扫散疫气' },
      { id: 'chanshuang', name: '缠双柱', len: 62, pillars: [{ x: 30, r: 3.2 }, { x: 52, r: 3.2 }], miasma: 5, ghosts: 4, hint: '长按缠柱 · 借力转向' },
      { id: 'tuanyuan', name: '结团圆', len: 46, pillars: [],           miasma: 0,  ghosts: 0, boss: true, hint: '缠住瘟神 · 以香火净化' }
    ],
    BOSS: {
      HP_PURIFY: 100, PHASES: [32, 66, 100],
      TELEGRAPH: 0.7, LUNGE_SPEED: 30, MOVE_SPEED: 8,
      WAKE: 4.5, DIVE_START: 8.0, VANISH_START: 11.0, VANISH_MAX: 1.4,
      ATTACK_GAP: [1.5, 1.2, 0.9], ORB_DMG: 9, WRAP_DPS: 14
    },
    HUES: { night1: '#0b1520', night2: '#16283c', far: '#1d3448', ember: '#ff8a3d', glow: '#ffe9b0' },
    KNOW: [
      '大坑舞火龙为国家级非遗，编号 Ⅹ-5、序号 453，2011 年第三批',
      '农历八月十四·十五·十六 = 迎月·赏月·送月',
      '始于 1880 年大坑瘟疫，村民扎火龙巡游驱瘟',
      '龙身 32 节、全长 67 米、插逾万枝长寿香',
      '必须用珍珠草扎作——水草一干就缩、杂草会碎',
      '每节一人持竹竿，动员 300 余人',
      '表演程式三段：火龙过桥 / 缠双柱 / 结团圆',
      '终章「龙归天」：八月十六送入避风塘海中',
      '主持须客家人、禀神用客家话（大坑为客家村）',
      '薄扶林村另有舞火龙（香港非遗代表作名录 2017）',
      '大坑火龙文化馆原址为 1909 年孔圣义学'
    ]
  };
})();
```

- [ ] **Step 3: index.html + style.css 骨架**

`index.html`：`<!DOCTYPE html>` + `lang="zh-CN"` + `charset=UTF-8` + viewport（含 `viewport-fit=cover`）；`<style>` 内只放 Global Constraints 允许的基线声明；四个视图容器 + `<script src>` 按加载顺序依次外链。

`style.css`：tokens 定义在 `:root`（夜色冷调 / 香火暖调 / 安全区变量回退）；`.view{position:fixed;top:0;right:0;bottom:0;left:0;display:none}`（**注意：不得用 `inset`**）；`.view.on{display:block}`；HUD 与 `#btn-style`（≥44px 热区，用 `top/right` 定位，不依赖 `:hover`）。

- [ ] **Step 4: 冒烟起点**

Run: `python3 -c "from playwright.sync_api import sync_playwright" `（确认环境）后，用 playwright 打开 `index.html`，断言 `window.WHData && window.WHRng`、无 console/pageerror、`document.querySelectorAll('.view').length === 4`。
Expected: 全通过；`WHRng(1).int(1,6)` 连续 6 次结果在 1..6 且同种子可复现。

- [ ] **Step 5: Commit**

```bash
git add tools/wuhuolong/
git commit -m "舞火龙：骨架 + 数据 + 随机数"
```

---

### Task 2: 链式骨骼 + 行波（核心）

**Files:**
- Create: `tools/wuhuolong/assets/chain.js`
- Test: `tests/wuhuolong_smoke.py`（本任务起建立）

**Interfaces:**
- Consumes: `WHData.CHAIN`
- Produces: `WHChain.build/head/setHead/step/segments/wrap/hitTest/reset/debug`（签名见全局契约）

- [ ] **Step 1: 先写失败断言（链的三个不变量）**

在 `tests/wuhuolong_smoke.py` 中写入（本步骤只写这三个，后续任务继续追加）：

```python
def chain_invariants(page):
    # 不变量 I3：状态只存标量，连续求值不得漂移
    drift = page.evaluate("""(function(){
      window.__wh.test.reset();
      for (var i = 0; i < 10000; i++) window.__wh.test.stepOnce(1/60);
      var d = window.__wh.test.debug();
      var max = 0;
      for (var j = 0; j < d.world.length; j++)
        for (var k = 0; k < d.world[j].length; k++)
          max = Math.max(max, Math.abs(d.world[j][k]));
      return max;
    })()""")
    check("I3 万帧无漂移（世界坐标有界）", drift < 1e6, drift)

    # 链长守恒：相邻节间距恒定
    err = page.evaluate("""(function(){
      var d = window.__wh.test.debug(), L = window.WHData.CHAIN.L, m = 0;
      for (var i = 1; i < 32; i++) {
        var dx = d.world[i][0]-d.world[i-1][0], dy = d.world[i][1]-d.world[i-1][1];
        m = Math.max(m, Math.abs(Math.sqrt(dx*dx+dy*dy) - L));
      }
      return m;
    })()""")
    check("链长守恒（相邻节间距偏差 < 1e-6）", err < 1e-6, err)

    # 行波：沿节索引的转角序列应正负交替
    flips = page.evaluate("""(function(){
      var a = window.__wh.test.debug().angles, s = [], i;
      for (i = 1; i < a.length - 1; i++) s.push(a[i+1] - a[i] > 0 ? 1 : -1);
      var f = 0;
      for (i = 0; i < s.length - 1; i++) if (s[i] !== s[i+1]) f++;
      return f;
    })()""")
    check("行波成立（沿身转角符号翻转 > 4）", flips > 4, flips)
```

- [ ] **Step 2: 运行，确认失败**

Run: `python3 tests/wuhuolong_smoke.py`
Expected: FAIL —— `window.__wh` 未定义。

- [ ] **Step 3: 实现 chain.js**

```js
(function () {
  var D = window.WHData.CHAIN, TAU = Math.PI * 2;

  function shortest(a, b) { var d = (b - a + Math.PI) % TAU; if (d < 0) d += TAU; return d - Math.PI; }

  var pts = [], abs = [], loc = [], t = 0, hx = 0, hy = 0;

  function build() {
    var i;
    pts = []; abs = []; loc = []; t = 0; hx = 0; hy = 0;
    for (i = 0; i < D.N; i++) { pts.push({ x: -i * D.L, y: 0 }); abs.push(0); loc.push(0); }
  }

  function setHead(x, y) {
    var dx = x - hx, dy = y - hy, m = Math.sqrt(dx * dx + dy * dy), cap = D.L * 6;
    if (m > cap) { x = hx + dx / m * cap; y = hy + dy / m * cap; }
    hx = x; hy = y;
  }

  function forward() {
    pts[0].x = hx - D.L * Math.cos(abs[0]);
    pts[0].y = hy - D.L * Math.sin(abs[0]);
    var i, base, wave, want, d;
    for (i = 1; i < D.N; i++) {
      base = Math.atan2(pts[i - 1].y - pts[i].y, pts[i - 1].x - pts[i].x);
      wave = D.A * Math.sin(TAU * (D.FREQ * t - D.K * i));
      want = base + wave;
      d = shortest(abs[i], want);
      if (d > D.MAXTURN) d = D.MAXTURN; else if (d < -D.MAXTURN) d = -D.MAXTURN;
      abs[i] += d; loc[i] = d;
      pts[i].x = pts[i - 1].x - D.L * Math.cos(abs[i]);
      pts[i].y = pts[i - 1].y - D.L * Math.sin(abs[i]);
    }
  }

  function step(dt) {
    t += dt;
    abs[0] = shortest(abs[0], Math.atan2(hy - pts[0].y, hx - pts[0].x));
    forward();
  }

  function wrap(pillars) {
    var n = 0, i, j;
    if (!pillars) return 0;
    for (i = 0; i < D.N; i++)
      for (j = 0; j < pillars.length; j++) {
        var p = pillars[j], dx = pts[i].x - p.x, dy = pts[i].y - p.y, m = Math.sqrt(dx * dx + dy * dy);
        if (m < p.r) { pts[i].x = p.x + dx / (m || 1) * p.r; pts[i].y = p.y + dy / (m || 1) * p.r; n++; break; }
      }
    return n;
  }

  function hitTest(rect) {
    var out = [], i;
    for (i = 0; i < D.N; i++)
      if (pts[i].x >= rect.x && pts[i].x <= rect.x + rect.w && pts[i].y >= rect.y && pts[i].y <= rect.y + rect.h) out.push(i);
    return out;
  }

  window.WHChain = {
    build: build,
    head: function () { return { x: hx, y: hy }; },
    setHead: setHead,
    step: step,
    wrap: wrap,
    hitTest: hitTest,
    reset: build,
    segments: function () {
      var o = [], i;
      for (i = 0; i < D.N; i++) o.push({ x: pts[i].x, y: pts[i].y, angle: abs[i], localAngle: loc[i] });
      return o;
    },
    debug: function () {
      var w = [], i;
      for (i = 0; i < D.N; i++) w.push([pts[i].x, pts[i].y]);
      return { angles: abs.slice(), lengths: loc.slice(), world: w };
    }
  };

  build();
})();
```

- [ ] **Step 4: 运行，确认通过**

Run: `python3 tests/wuhuolong_smoke.py`
Expected: PASS —— 链长守恒偏差 < 1e-6、行波符号翻转 > 4、万帧无漂移。

- [ ] **Step 5: Commit**

```bash
git add tools/wuhuolong/assets/chain.js tests/wuhuolong_smoke.py
git commit -m "舞火龙：32 节链式骨骼 + 行波驱动（含链长守恒/无漂移/行波断言）"
```

---

### Task 3: 香火粒子 + 发光合成

**Files:**
- Create: `tools/wuhuolong/assets/fire.js`

**Interfaces:**
- Consumes: `WHData.FIRE`、`WHChain.segments()`、`WHRng`
- Produces: `WHFire.init/emit/step/draw/intensity/debug`

- [ ] **Step 1: 实现 fire.js（对象池 + 离屏发光 sprite，运行期零分配）**

要点（实现须完整，不得留空函数）：
- `init(offscreen)`：在离屏 canvas 上预渲染一张径向渐变发光点（中心 `#ffe9b0` → 外圈 `rgba(255,138,61,0)`），存为 `glowSprite`
- `emit(segments, count)`：沿 32 节每节发射 `EMIT_PER_SEG` 个粒子；初速上浮 `RISE` + `DRIFT` 横向扰动；从**预分配池**取，池满则复用最旧
- `step(dt)`：`y -= (RISE - GRAV*t*...)` 形式的上浮 + 生命递减；**不创建任何对象/数组**
- `draw(ctx, cam)`：`ctx.globalCompositeOperation = 'lighter'`，按节索引决定粒子半径（近节大 `R_NEAR`、远节小 `R_FAR`），画 `glowSprite`；画完恢复 `'source-over'`
- `intensity(v)`：`v` 映射到发光半径/亮度系数，`INTENSITY_MIN` 为下限（香火发暗时龙身真的暗下去）
- 伪随机一律走 `WHRng` 固定种子实例，**禁 `Math.random()`**

- [ ] **Step 2: 断言**

Run: `python3 tests/wuhuolong_smoke.py`（追加断言）
Expected: PASS —— 发射 N 次后 `WHFire.debug().alive <= pooled`（池上界不被突破）；`alive > 0`；连续 `step` 1000 次后 `alive` 不增长超过池容量。

- [ ] **Step 3: Commit**

```bash
git add tools/wuhuolong/assets/fire.js
git commit -m "舞火龙：香火粒子（对象池）+ 发光叠加合成"
```

---

### Task 4: 夜景街巷剪影 + 摄像机

**Files:**
- Create: `tools/wuhuolong/assets/scene.js`

**Interfaces:**
- Produces: `WHScene.init/resize/camera/drawBack/drawFront/metrics`

- [ ] **Step 1: 实现 scene.js**

分层（从后到前，全部程序化、零素材）：
1. **夜空**：竖向渐变 `night1 → night2` + 少量星点（`WHRng` 固定种子，位置固定不闪）
2. **远景剪影**（视差 0.18）：远山/屋脊折线，实色 `#1d3448`
3. **街巷剪影**（视差 0.42）：唐楼轮廓 + 骑楼 + 招牌，纯黑剪影 + 少量暖黄窗光点
4. **地面**：`groundY = H * CAM.Y`，其下为暗色街面
5. **前景雾烟**（`drawFront`，视差 1.0 反向）：半透明剪影层缓慢平移

`camera(x)`：`camX = x - W*CAM.AHEAD`；`drawBack/drawFront` 内部按 `PARALLAX` 与 `camX` 反算偏移；剪影元素按**世界坐标间隔**循环生成（`k*GAP - camX % (GAP*count)`），保证无限延伸且确定性。

- [ ] **Step 2: 无头截图**

Run: playwright 打开 `?test=1`，`WHScene.init` + 手动 `WHChain.build()` + 用 `WHFire` 发光点在球上画一条模拟火龙，1s 后截图 `/tmp/wh-scene.png`。
Expected: 无 console/pageerror；截图非纯黑（用 Pillow 断言 `mean(lum) > 6` 且 `distinct levels > 120`）；地平线在 `H*0.62`。

- [ ] **Step 3: Commit**

```bash
git add tools/wuhuolong/assets/scene.js
git commit -m "舞火龙：夜景街巷剪影分层 + 摄像机视差"
```

---

### Task 5: 视觉门（D4 —— 过门/降级决策点）

**Files:**
- Modify: `tools/wuhuolong/assets/main.js`（本任务只需临时最小装配：init canvas + 火龙 + 香火 + 场景 + rAF，供截图；正式装配在 Task 12）
- Test: `tests/wuhuolong_smoke.py`

**Interfaces:**
- Consumes: `WHChain`、`WHFire`、`WHScene`
- Produces: 无新接口（只做装配与判定）

**这一关不过，后面全部不做。** 直接把 `dist/wuhuolong.zip` 推到「降级路径」，而不是继续做玩法。

- [ ] **Step 1: 临时装配 + 让火龙动起来**

`main.js` 里：`WHScene.init(stage)`、`WHChain.build()`、`WHFire.init()`，rAF 固定步长循环里：`WHChain.setHead` 画一条正弦巡航轨迹 → `WHChain.step(dt)` → `WHFire.emit/step` → 绘制 `scene.drawBack` → 火龙发光折线（`WHFire.draw`）→ `scene.drawFront`。

- [ ] **Step 2: 客观像素指标断言**

Run: `python3 tests/wuhuolong_smoke.py`
Expected: PASS ——
- 画面非纯黑：`black% < 40`
- 有暖色火光：橙色像素（`r>120 && r>g+30 && g>b`）占比在 **0.4%–12%**
- 亮度层级 `> 180`（渐变不 banding）
- 火龙可辨：沿龙身采样点处亮度显著高于同列背景（`> +18`）

- [ ] **Step 3: 视觉判定（人眼必须过）**

Run: playwright 截图 `/tmp/wh-gate-dragon.png`（390×844）+ 一张横屏版（844×390）。
Expected: **人工确认「火龙像一条活龙，而不是一串圆点」**——具体看三件事：
1. 行波沿身形成 S 形（不是整条硬邦邦地转）
2. 香火有疏密层次与暖白过曝，不是均匀撒点
3. 夜景剪影把龙衬出来（龙是画面唯一主角）

**判定规则（不可商量）**：
| 判定 | 动作 |
|---|---|
| 三件事都过 | 继续 Task 6 |
| 有一条不过 | 调 `A/FREQ/K/R_NEAR/发光强度/背景对比` 重出截图，最多调 3 轮 |
| 3 轮仍不过 | **停**，走降级路径：纯剪影（去香火粒子，改描边发光）/ 或缩到「龙归天」单场景仪式。**不得带着不过门的视觉继续做玩法**（打铁花教训：它是做到 v6 才发现） |

- [ ] **Step 4: 记录视觉门结论**

在 `docs/plans/wuhuolong-progress.md` 写入：日期、判定结果、调整过的参数、截图路径。这份进度文件在 Task 14 交付。

- [ ] **Step 5: Commit**

```bash
git add tools/wuhuolong/assets/main.js tests/wuhuolong_smoke.py docs/plans/wuhuolong-progress.md
git commit -m "舞火龙：视觉门 D4（过门/降级判定 + 像素断言 + 进度记录）"
```

---

### Task 6: 香火机制 + 推进 + 状态机

**Files:**
- Create: `tools/wuhuolong/assets/game.js`

**Interfaces:**
- Consumes: `WHData.BEATS/FIRE_RES/ACT`、`WHChain`、`WHFire`、`WHRng`
- Produces: `WHGame.init/start/step/action/snapshot/setCallback`

- [ ] **Step 1: 固定步长累加器 + 四拍推进**

沿用仓库既有写法：`while (acc >= STEP && guard < 6) { stepOnce(STEP); acc -= STEP; guard++; }`，`STEP = 1/60`。`wh.beat` 按 `WHData.BEATS` 顺序推进，`wh.beatDist` 累计位移，达 `len` 切下一拍；切拍触发 `beat` 回调（用于显示 `hint`）。

- [ ] **Step 2: 香火（机制与视觉同源）**

`wh.fire` 按 `FIRE_RES`：基础损耗 `DRAIN/s`；受击 `−HURT`；被疫气附着 `−CLING_DRAIN/s`；击溃疫气 `+KILL_MIASMA`；击溃瘟鬼 `+KILL_GHOST`；「珠」消耗 `ORB`。低于 `DIM` 时把 `wh.fire/START` 传给 `WHFire.intensity()`，**龙身同步变暗**；归零触发 `fail`。

- [ ] **Step 3: `action(kind)` 三式**

- `sweep`：在龙头前方生成一次命中窗 `ACT.SWEEP_W`，对 `WHChain.hitTest` 命中的敌人结算；每次攻击带唯一 `id` 去重（**每次攻击只结算一次**）；冷却 `SWEEP_CD`
- `wrap`：进入缠缚态（持续到冷却结束），由 Task 7 的柱与 Boss 消费
- `orb`：发射一枚龙珠沿龙头朝向匀速前飞（`ORB_SPEED`），命中首敌即消失；冷却 `ORB_CD`，消耗香火

- [ ] **Step 4: 断言**

Run: `python3 tests/wuhuolong_smoke.py`
Expected: PASS —— 状态机可从 `kaiguang` 走到 `guoqiao`；香火从 100 按 `DRAIN` 递减到 `DIM` 时 `snapshot().dim === true`；归零触发 `fail`；`action('sweep')` 在冷却内二次调用不产生第二次命中。

- [ ] **Step 5: Commit**

```bash
git add tools/wuhuolong/assets/game.js
git commit -m "舞火龙：固定步长状态机 + 四拍推进 + 香火机制 + 舞龙三式"
```

---

### Task 7: 疫气 / 瘟鬼 + 缠柱

**Files:**
- Modify: `tools/wuhuolong/assets/game.js`

**Interfaces:**
- Consumes: `WHChain.wrap/hitTest`、`WHData.BEATS[].pillars/miasma/ghosts`
- Produces: `snapshot().enemies`、`snapshot().wrapSegs`

- [ ] **Step 1: 两类敌人（差异靠行为，不靠贴图）**

- **疫气**：无实体，向龙头缓慢漂移，附着后持续扣香火（`CLING_DRAIN`）；只能被 `sweep` 驱散
- **瘟鬼**：有实体，按波次扑咬龙身，可被 `sweep` / `orb` 击退（给 `KILL_GHOST` 回香）
- **同屏攻击调度**（鬼泣制作人那条）：当龙身 6 单位内敌人 > 2 时，其余敌人的攻击欲望系数降至 0.35，避免围殴致乱

- [ ] **Step 2: 缠柱**

每拍按 `BEATS[].pillars` 生成柱；每帧 `WHChain.wrap(pillars)`，返回缠缚节数；`>= WRAP_SEGS(8)` 时 `wh.wrapSegs` 达标 → 进入缠缚态，可用于（a）借力急转（b）Task 8 的净化。**柱必须可脱离**，脱离后 `WHChain.debug()` 的链长守恒断言仍须成立。

- [ ] **Step 3: 断言**

Run: `python3 tests/wuhuolong_smoke.py`
Expected: PASS —— 生成敌人数量与 `BEATS` 声明一致；缠柱后 `wrapSegs >= 8`；脱离柱后链长守恒断言仍过；同屏攻击调度生效（>2 敌人时其余攻击间隔变长）。

- [ ] **Step 4: Commit**

```bash
git add tools/wuhuolong/assets/game.js
git commit -m "舞火龙：疫气/瘟鬼 + 同屏攻击调度 + 缠柱"
```

---

### Task 8: Boss 瘟神三阶段 + 净化

**Files:**
- Modify: `tools/wuhuolong/assets/game.js`

**Interfaces:**
- Consumes: `WHData.BOSS`、`WHChain.wrap`、`snapshot().fire`
- Produces: `snapshot().boss`、`snapshot().purify`（0..100）

- [ ] **Step 1: 三阶段（对应仪式三段）**

| 阶段 | 净化进度 | 行为 |
|---|---|---|
| 一 · 缠缚 | 0 → 32 | 瘟神游走、周期性突进；玩家须用「缠」缚住它 |
| 二 · 灼烧 | 32 → 66 | 缠缚期间香火持续灼烧（`WRAP_DPS`）；瘟神挣脱后进入下一次缠缚 |
| 三 · 净化 | 66 → 100 | 攻击更密（`ATTACK_GAP` 收紧）；「珠」可加速（`ORB_DMG`） |

**关键设计：不是打血条，是缠住它、以香火净化。** `purify` 达到 100 触发 `purify` 回调 → 进入尾声。

- [ ] **Step 2: 断言**

Run: `python3 tests/wuhuolong_smoke.py`
Expected: PASS —— 三阶段阈值可达（用测试钩子直接驱动 `purify` 到 32/66/100）；`purify >= 100` 触发 `purify` 回调；未缠缚时 `purify` 不增长（防止绕过机制）。

- [ ] **Step 3: Commit**

```bash
git add tools/wuhuolong/assets/game.js
git commit -m "舞火龙：瘟神三阶段（缠缚→灼烧→净化）"
```

---

### Task 9: 龙归天 + 分享卡

**Files:**
- Create: `tools/wuhuolong/assets/share.js`
- Modify: `tools/wuhuolong/assets/game.js`（尾声状态）

**Interfaces:**
- Produces: `WHShare.paint/saveAlbum/postNote`

- [ ] **Step 1: 尾声「龙归天」**

净化后进入不可操作的仪式段：火龙沿一带逆时针绕行一周，舞向海边，**送入海中**（`return` 回调）；命中 1 次 `WHData.KNOW` 随机知识卡展示；留 ≥1s 静止呼吸。

- [ ] **Step 2: 分享卡（1080×1440）**

`paint(stats)` 绘制：龙归天画面 + 一行可命名成绩（剩余香火 / 净化耗时 → 如「满香归天」「八息净化」）+ 非遗信息「中秋节（大坑舞火龙）· 国家级非遗 Ⅹ-5」。`saveAlbum()`：`paint()` → `toDataURL('image/png')` → `writeTempFile({data})` **原样传完整 data:uri** → `saveImageToPhotosAlbum({filePath})`；`postNote()` 同理带 `mediaInfo.image_resources`。**必须判空降级**：无 `window.xhs.miniTool` 时给提示而非报错。

- [ ] **Step 3: 断言**

Run: `python3 tests/wuhuolong_smoke.py`
Expected: PASS —— `paint()` 返回 `data:image/png;base64,` 开头的串且解码后 < 1 MiB；mock 端能力下 `writeTempFile` 收到的 `data` **以完整 data:uri 开头**（非裸 base64）、`saveImageToPhotosAlbum` 收到 `writeTempFile` 返回的 `filePath`；无端能力时降级不报错。

- [ ] **Step 4: Commit**

```bash
git add tools/wuhuolong/assets/share.js tools/wuhuolong/assets/game.js
git commit -m "舞火龙：龙归天尾声 + 分享卡（端能力链路 + 降级）"
```

---

### Task 10: 锣鼓音频（Web Audio 程序化，零文件）

**Files:**
- Create: `tools/wuhuolong/assets/audio.js`

**Interfaces:**
- Produces: `window.WHSound`：`unlock / setMuted / drum / gong / riser / emberWarn`

- [ ] **Step 1: 实现合成**

| 音 | 合成 |
|---|---|
| `drum` | 低频正弦 120→60 Hz 快速下滑 + 短噪声包络，衰减 <150 ms |
| `gong` | **多个失谐振荡器**叠加（非谐和音，如 1.0 / 1.51 / 2.13 / 2.71 倍频），长衰减 |
| `riser` | 起龙/净化前的上扫音 |
| `emberWarn` | 香火低于 `DIM` 时的高频细碎噪声，频率随香火下降而变密 |

沿用仓库既有 `assets/audio.js` 形态（`createOscillator` + `createGain` + 指数包络），提供 `unlock()`（首次用户手势）与 `setMuted()`。

- [ ] **Step 2: 断言**

Run: `python3 tests/wuhuolong_smoke.py`
Expected: PASS —— 无 `AudioContext` 时全部调用安全降级（不抛）；有 `AudioContext` 时 `drum()/gong()` 各自创建 oscillator 并 `start/stop`。

- [ ] **Step 3: Commit**

```bash
git add tools/wuhuolong/assets/audio.js
git commit -m "舞火龙：锣鼓程序化音频（Web Audio，零文件）"
```

---

### Task 11: 触屏输入（拖动 + 舞龙式三手势）

**Files:**
- Modify: `tools/wuhuolong/assets/main.js`

**Interfaces:**
- Consumes: `WHData.TOUCH`、`WHGame.action/step`、`WHChain.setHead`
- Produces: 无新全局（内部绑定）

- [ ] **Step 1: 两个独立手势空间（不同 `pointerId`）**

- **拖动区**（全屏）：`pointerdown` 记 `id`，`pointermove` 按 `id` 门控后 `WHChain.setHead(逻辑坐标)`；`pointerup`/`pointercancel` 释放
- **舞龙式按钮**（`#btn-style`，≥44px）：独立 `pointerId`，**不得与拖动区互相干扰**

**必须沿用 `tools/yueyan/assets/scene.js` 的两条教训**：`setPointerCapture` 要 `try/catch` 容错（对 inactive pointer 会抛 `NotFoundError`，部分手机不兑现）；`pointermove` 绑在 `window` 并按 `pointerId` 门控（否则手指滑出元素后事件停发、拖动静默失效）。

- [ ] **Step 2: 按钮内三手势消歧（含双击延迟结算）**

```
pointerdown: 记 t0
pointerup:   dt = now - t0
   dt < TAP_MS(180)  → 入待定队列；若 DOUBLE_MS(260) 内有第二次 → orb，否则超时结算为 sweep
   TAP_MS ≤ dt       → wrap（进入缠缚态）
```

**双击的第一击不得立即触发 `sweep`**，否则每次双击都先扫一下。`TAP_MS`/`DOUBLE_MS` 从 `WHData.TOUCH` 读，便于实机调参。

- [ ] **Step 3: 断言**

Run: `python3 tests/wuhuolong_smoke.py`
Expected: PASS —— 模拟「两次 100ms 内点击」只触发 1 次 `orb`（`sweep` 不被触发）；「单次 100ms 点击后等 300ms」触发 1 次 `sweep`；「按住 400ms」触发 `wrap`；拖动时 `WHChain.head()` 跟随；同时按住拖动 + 按钮时两路互不干扰。

- [ ] **Step 4: Commit**

```bash
git add tools/wuhuolong/assets/main.js
git commit -m "舞火龙：拖动 + 舞龙式按钮（双击消歧 + pointerId 隔离）"
```

---

### Task 12: 主装配 + HUD

**Files:**
- Modify: `tools/wuhuolong/assets/main.js`、`assets/style.css`、`index.html`

**Interfaces:**
- Consumes: 全部 `WH*` 模块
- Produces: 完整可玩单页

- [ ] **Step 1: 视图切换 + HUD**

`boot → stage → result` 三视图（**单页内切 DOM，不跳转**）。HUD：香火条（`hud-fire`，低于 `DIM` 变暗红并触发 `emberWarn`）、拍名（`hud-beat`，切拍时显示 `hint` 并 1s 后淡出）、`toast`。分享按钮「存到相册 / 发笔记」在 `result` 视图，**必须是用户主动点击**。

- [ ] **Step 2: 主循环**

`rAF` + 固定步长累加器；`visibilitychange` 时暂停（`document.hidden` 不推进逻辑、不重算大量帧）；`resize` 只重算取景参数（**逻辑坐标与屏幕比例解耦**，见 spec §4.4）。

- [ ] **Step 3: 全流程断言**

Run: `python3 tests/wuhuolong_smoke.py`
Expected: PASS —— 从 `boot` 点开始可走到 `result`；`?test=1` 下可用测试钩子直接推进到尾声；**零 console/pageerror**。

- [ ] **Step 4: Commit**

```bash
git add tools/wuhuolong/
git commit -m "舞火龙：主装配 + HUD + 视图切换"
```

---

### Task 13: 无头断言套件定稿

**Files:**
- Modify: `tests/wuhuolong_smoke.py`

**Interfaces:**
- Consumes: `window.__wh`（`?test=1` 暴露：`{ state, snapshot, test: { reset, stepOnce, debug, setPurify, spawn } }`）

- [ ] **Step 1: 补齐全套断言**

覆盖（每条都必须真实断言，不得只打印）：
1. 链的三个不变量（Task 2 已有）
2. 确定性：同种子双跑逐帧一致；**`assets/*.js` 零 `Math.random()`**（grep）
3. 香火：递减 / 受击 / 归零即败 / `DIM` 变暗
4. 状态机可达：`kaiguang → guoqiao → chanshuang → tuanyuan → return`
5. Boss：三阶段阈值可达；未缠缚时 `purify` 不涨
6. 触屏三手势消歧（Task 11 已有）
7. 分享卡：完整 data:uri + `filePath` 回传 + 降级
8. 性能：`?test=1` 下 300 帧平均步进耗时 < 4 ms（保守，非真机指标）

- [ ] **Step 2: 双引擎跑通**

Run: `python3 tests/wuhuolong_smoke.py`（chromium）与 `ORIENTPROBE_ENGINE=webkit python3 tests/wuhuolong_smoke.py`（若沿用探针的引擎开关；否则用 `p.webkit`）
Expected: 两个引擎全通过；如某引擎失败，修到都通过（容器双端都要跑）。

- [ ] **Step 3: Commit**

```bash
git add tests/wuhuolong_smoke.py
git commit -m "舞火龙：无头断言套件定稿（双引擎）"
```

---

### Task 14: 打包 + zip 冒烟 + 文档

**Files:**
- Create: `dist/wuhuolong.zip`
- Modify: `docs/plans/wuhuolong-progress.md`、`release/README.md`、`docs/series-plan.md`

- [ ] **Step 1: 规范门禁自查**

Run:
```bash
node .skill/scripts/audit_artifact.mjs tools/wuhuolong
python3 .skill/scripts/audit_artifact.py tools/wuhuolong
```
Expected: 无 ERROR；包体 **< 100 KB**。

- [ ] **Step 2: 打包（压缩目录内容，不是目录本身）**

```bash
cd tools/wuhuolong && rm -f ../../dist/wuhuolong.zip && zip -r ../../dist/wuhuolong.zip . -x '*.DS_Store' -x '__MACOSX/*' > /dev/null
```
Expected: `unzip -Z1 dist/wuhuolong.zip` 顶层直接是 `index.html`（**不得多套一层**）。

- [ ] **Step 3: zip 独立冒烟**

Run: 解压到临时目录，用 playwright 直接加载，跑同一套断言。
Expected: 全通过 —— `index.html` 在根、无外部引用、零报错、全流程可达。

- [ ] **Step 4: 更新文档**

`docs/plans/wuhuolong-progress.md` 补实施记录与视觉门最终结论；`release/README.md` 加 #19 行（含发布文案与配图规划）；`docs/series-plan.md` 登记。

- [ ] **Step 5: Commit**

```bash
git add dist/wuhuolong.zip docs/ release/
git commit -m "舞火龙：打包 dist/wuhuolong.zip + 文档入库"
```

---

## Self-Review 结论

- **Spec 覆盖**：链式骨骼+行波（Task 2）、香火粒子与发光（Task 3）、夜景剪影+摄像机（Task 4）、**视觉门 D4（Task 5）**、香火机制/四拍推进/三式（Task 6）、疫气·瘟鬼+同屏调度+缠柱（Task 7）、Boss 三阶段净化（Task 8）、龙归天+分享卡（Task 9）、锣鼓（Task 10）、触屏载荷+双击消歧（Task 11）、装配与 HUD（Task 12）、无头断言（Task 13）、打包与文档（Task 14）——spec §3/§4/§5/§6/§9 全覆盖
- **`action-anim-layer-spec.md` §适用范围已遵守**：本计划不建 IK、不做朝向翻转、不做关键帧剪辑；只实现 I1/I2/I3/I5 相关的不变量断言
- **数值与 spec 一致**：Global Constraints 的数值锚点逐项抄自 spec §3.2/§3.3/§4.1/§5/§9.3
- **接口签名跨任务一致**：`WHChain.*` / `WHFire.*` / `WHScene.*` / `WHGame.*` / `WHShare.*` / `WHSound.*` 在全局契约中一次性定义，各任务引用同一签名
- **工期风险（spec §10.1）已落到计划里**：Task 5 是**工期门兼视觉门**；D1–D3 若超期，按 spec §10.1 立即砍内容（Boss 降两阶段 / 推进段减半 / 分享卡简化），不挤压 D5–D7
- **已知待填**：`WHData.HUES.far` 的色值（Task 1 Step 2 注明了实现时须定为合法值）；战斗空间几何与 UI 坐标（等 `dist/orientprobe.zip` 实测读数，**只改 `WHData.CAM` 与按钮坐标，不动逻辑**）
- **未验收项（须如实标注）**：真机帧率、真机手感、触感反馈——`navigator.vibrate` 在 iOS 引擎下已确认不可用，本计划**不把它作为反馈通道**
