# 龙舟破浪 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现「非遗手作坊」#8《龙舟破浪》——端午主题无尽换线跑酷 H5 小工具（伪 3D 背后视角 + 击鼓冲刺 + 图鉴收集），打包 dist/longzhou.zip。

**Architecture:** 纯原生 JS（IIFE 模块 + `window.LZ*` 全局，沿用剪纸/文物修复局惯例）。Canvas 2D 渲染伪 3D 江面，DOM 负责视图/HUD/图鉴/结算。OutRun 式投影 `p = F/(F+z)`，实体按 z 距离逼近，生成器保证任一断面三航道最多封两条。

**Tech Stack:** 原生 JS/CSS/HTML、Canvas 2D、WebAudio、localStorage、Playwright（无头验证，python 版已装）。

**Spec:** `docs/specs/2026-08-18-longzhou-design.md`

## Global Constraints

- 容器规范（`.skill/references/`）：`index.html` 在 zip 根；脚本全部外置、禁内联/行内事件/eval；禁网络/剪贴板/下载/外链/传感器/Worker/iframe；资源相对路径 `./assets/...`；仅 html/css/js/json/图片/字体类型入 zip
- 端能力出口：`window.xhs?.miniTool` 判空降级（writeTempFile → saveImageToPhotosAlbum / postNote），按钮必须用户主动点击
- 安全区：`var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`，viewport 含 `viewport-fit=cover`
- 确定性渲染：禁 `Math.random()`，全部 mulberry32 种子随机（design-knowledge.md 准则 10）；`?test=1` 固定种子 20260818 并暴露 `window.__game`
- 系列视觉 tokens：朱红 `#C3272B`、黛青 `#425066`、藤黄 `#FFB61E`、月白 `#D6ECF0`、宣纸 `#F5F0E6`；标题字体栈 `"Kaiti SC","STKaiti","KaiTi",serif`
- 代码风格沿用现有工具：IIFE、`var`、`function(){}`、无注释、`addEventListener` 绑事件、localStorage try/catch
- 包体目标 <1MB（纯代码，预期 <100KB）
- 数值锚点（spec 已定，勿擅改）：速度 8→22m/s（2500m 线性到顶）；冲刺=满槽 100 自动触发、3 秒、速度 ×1.8、无敌；鼓点 +12/次、最小间隔 120ms；雄黄酒 +50 槽；稳 3 点；受击无敌 1.5s；连击倍率 1+floor(combo/5) 上限 ×5；粽子 10×倍率、撞碎障碍 +50、稀有 +80、龙头令 +200、里程 1 分/m；称号阈值 500/1500/3000/5000

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `tools/longzhou/index.html` | 单页四视图：home / game(canvas+HUD) / codex / result |
| `tools/longzhou/assets/data.js` | `window.LZData`：图鉴 8 件+知识文案、称号、端午总述、调参常量 |
| `tools/longzhou/assets/rng.js` | `window.LZRng`：mulberry32 |
| `tools/longzhou/assets/scene.js` | `window.LZScene`：投影 + 天空/远山/江面/航道/两岸/浪花绘制 |
| `tools/longzhou/assets/sprites.js` | `window.LZSprites`：龙舟 + 3 种障碍 + 8 种物品绘制 |
| `tools/longzhou/assets/game.js` | `window.LZGame`：状态机/移动/生成器/碰撞/计分/冲刺/输入抽象/测试钩子 |
| `tools/longzhou/assets/audio.js` | `window.LZSound`：WebAudio 程序化音效 |
| `tools/longzhou/assets/share.js` | `window.LZShare`：900×1200 战绩卡绘制 + xhs jsapi 出口 |
| `tools/longzhou/assets/main.js` | DOM 装配、视图切换、HUD、输入事件、rAF 主循环、demo 自驾 |
| `tools/longzhou/assets/style.css` | 全部样式（tokens + 视图 + HUD） |
| `tests/longzhou_smoke.py` | Playwright 无头断言（仓库根，不入 zip） |

模块依赖（加载顺序）：`data.js → rng.js → audio.js → scene.js → sprites.js → game.js → share.js → main.js`

核心接口契约（跨任务依赖，签名不得擅改）：

```js
// scene.js
LZScene.init(canvas)                      // 绑定 ctx，resize
LZScene.resize()                          // 按窗口重算 W/H/u/horizonY/boatY/laneW
LZScene.project(laneX, z)                 // -> {x, y, s}；laneX∈[-1,1] 可小数，z 米
LZScene.draw(gameState, dt)               // 画天空/远山/江面/两岸/浪花（不含实体与船）
LZScene.addSplash(x, y, n)                // 白色浪花粒子
// 常量：F=45, Z_MAX=90, horizonY=H*0.32, boatY=H*0.82, laneW=W*0.27, u=W/400

// sprites.js（全部在投影后的屏幕坐标绘制，s 为投影缩放）
LZSprites.boat(ctx, x, y, s, o)           // o={paddlePhase, drumHit, dashing, tilt, blink}
LZSprites.obstacle(ctx, type, x, y, s, t) // type: 'rock'|'whirl'|'log'
LZSprites.pickup(ctx, id, x, y, s, t)     // id: 图鉴 id

// game.js
LZGame.start()                            // home→playing，重置当局
LZGame.update(dt)                         // 状态机推进
LZGame.swipe(dir)                         // dir=-1|1
LZGame.drum()                             // 点鼓
LZGame.snapshot()                         // 只读状态对象（见 Task 4）
LZGame.setCallback(name, fn)              // 'hit'|'collect'|'unlock'|'capsize'|'dash'|'toast'
window.__game                             // ?test=1 测试钩子（见 Task 4）

// share.js
LZShare.paintCard(stats)                  // -> dataURL（900×1200，stats 含 dist/score/zongzi/maxCombo/title/codexCount/know）
LZShare.saveAlbum() / LZShare.postNote()  // 内部判空降级 alert
```

---

### Task 1: 骨架 + 数据 + 随机数

**Files:**
- Create: `tools/longzhou/index.html`、`assets/data.js`、`assets/rng.js`、`assets/style.css`（tokens 与视图布局）

**Interfaces:**
- Produces: `window.LZData`（结构见下代码）、`window.LZRng(seed) -> {next(), range(a,b), int(a,b), pick(arr)}`、四视图 DOM 骨架（id 见 index.html）

- [ ] **Step 1: index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>龙舟破浪</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                   "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      -webkit-font-smoothing: antialiased;
      -webkit-tap-highlight-color: transparent;
      -webkit-user-select: none;
      user-select: none;
    }
  </style>
  <link rel="stylesheet" href="./assets/style.css" />
</head>
<body>
  <div id="app">

    <section id="view-home" class="view is-active">
      <div class="home-inner">
        <p class="home-series">非遗手作坊 · 端午</p>
        <h1 class="home-title"><span>龙</span><span>舟</span><span>破</span><span>浪</span></h1>
        <p class="home-sub">击鼓奋楫，破浪夺标</p>
        <p id="home-best" class="home-best"></p>
        <button id="btn-start" class="primary-btn" type="button">起航</button>
        <button id="btn-codex-home" class="ghost-btn" type="button">端午图鉴</button>
        <button id="btn-mute-home" class="mute-btn" type="button">声</button>
      </div>
      <p class="home-foot">端午 · 联合国教科文组织人类非物质文化遗产</p>
    </section>

    <section id="view-game" class="view">
      <canvas id="stage"></canvas>
      <div id="hud" class="hud">
        <div class="hud-left">
          <div id="hud-steady" class="steady"></div>
          <p id="hud-dist" class="hud-dist">0m</p>
        </div>
        <div class="hud-right">
          <p id="hud-score" class="hud-score">0</p>
          <p id="hud-combo" class="hud-combo"></p>
        </div>
      </div>
      <div id="gauge-wrap" class="gauge-wrap"><div id="gauge-fill" class="gauge-fill"></div></div>
      <button id="btn-drum" class="drum-btn" type="button"><span class="drum-face">鼓</span></button>
      <div id="toast" class="toast"></div>
      <div id="tutor" class="tutor"></div>
      <div id="pause-mask" class="pause-mask">
        <p>暂停中</p>
        <button id="btn-resume" class="primary-btn" type="button">继续</button>
        <button id="btn-quit" class="ghost-btn" type="button">回首页</button>
      </div>
    </section>

    <section id="view-codex" class="view">
      <div class="codex-head">
        <button id="btn-codex-back" class="chip-btn" type="button">返回</button>
        <h2>端午图鉴</h2>
        <span id="codex-count" class="codex-count"></span>
      </div>
      <div id="codex-grid" class="codex-grid"></div>
      <div id="codex-card" class="codex-card">
        <div id="codex-card-icon" class="codex-card-icon"><canvas id="codex-canvas" width="120" height="120"></canvas></div>
        <h3 id="codex-card-name"></h3>
        <p id="codex-card-text"></p>
        <button id="codex-card-close" class="ghost-btn" type="button">合上</button>
      </div>
    </section>

    <section id="view-result" class="view">
      <div class="result-inner">
        <p class="result-kicker">翻船了 · 战绩</p>
        <div class="result-seal"><span id="result-title">见习桨手</span></div>
        <div class="result-stats">
          <div class="stat"><b id="result-dist">0m</b><i>航程</i></div>
          <div class="stat"><b id="result-score">0</b><i>总分</i></div>
          <div class="stat"><b id="result-zongzi">0</b><i>粽子</i></div>
          <div class="stat"><b id="result-combo">0</b><i>最高连击</i></div>
        </div>
        <p id="result-best" class="result-best"></p>
        <div id="result-know" class="result-know"></div>
        <p id="result-codex" class="result-codex"></p>
        <div class="result-actions">
          <button id="btn-again" class="primary-btn" type="button">再战一局</button>
          <button id="btn-codex-result" class="ghost-btn" type="button">图鉴</button>
        </div>
        <div class="result-share">
          <button id="btn-save-album" class="ghost-btn" type="button">存到相册</button>
          <button id="btn-post-note" class="ghost-btn" type="button">发笔记</button>
          <button id="btn-home-result" class="ghost-btn" type="button">回首页</button>
        </div>
      </div>
    </section>

  </div>

  <script src="./assets/data.js"></script>
  <script src="./assets/rng.js"></script>
  <script src="./assets/audio.js"></script>
  <script src="./assets/scene.js"></script>
  <script src="./assets/sprites.js"></script>
  <script src="./assets/game.js"></script>
  <script src="./assets/share.js"></script>
  <script src="./assets/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: assets/data.js**

```js
(function () {
  window.LZData = {
    F: 45,
    Z_MAX: 90,
    BASE_SPEED: 8,
    MAX_SPEED: 22,
    SPEED_RAMP_DIST: 2500,
    DASH_TIME: 3,
    DASH_MULT: 1.8,
    GAUGE_DRUM: 12,
    GAUGE_WINE: 50,
    DRUM_INTERVAL: 0.12,
    STEADY_MAX: 3,
    HIT_INV: 1.5,
    LANE_TIME: 0.15,
    GAP_MAX: 26,
    GAP_MIN: 16,
    GAP_RAMP: 250,
    TITLES: [
      { min: 5000, name: "汨罗飞桨" },
      { min: 3000, name: "弄潮儿" },
      { min: 1500, name: "鼓手传人" },
      { min: 500, name: "江上水手" },
      { min: 0, name: "见习桨手" }
    ],
    CODEX: [
      { id: "zongzi", name: "粽子", role: "score",
        text: "古称角黍，菰叶或箬叶裹糯米而成。北方多甜粽（枣、豆沙），南方多咸粽（鲜肉、蛋黄）。端午食粽，魏晋以来已成风俗。" },
      { id: "wine", name: "雄黄酒", role: "gauge",
        text: "端午饮雄黄酒是旧俗，取雄黄粉末入酒，意在驱邪解毒。雄黄含砷，今日只作节令象征，切勿饮用。" },
      { id: "ai", name: "艾草", role: "rare",
        text: "端午采艾，悬于门楣。艾草芳香辟秽，古人以为可禳毒驱邪，也是针灸里的常用药材。" },
      { id: "changpu", name: "菖蒲", role: "rare",
        text: "菖蒲叶形如剑，称「蒲剑」，与艾草同悬门上，取「斩千邪」之意。" },
      { id: "wusai", name: "五彩绳", role: "rare",
        text: "以青、白、红、黑、黄五色丝线编绳系于手腕，祈求长命安康。节后待第一场夏雨，抛入流水随雨去。" },
      { id: "wudu", name: "五毒符", role: "rare",
        text: "五毒指蛇、蜈蚣、蝎子、壁虎、蟾蜍。端午贴五毒符、穿五毒肚兜，以毒攻毒，祈愿避瘟祛病。" },
      { id: "xiangnang", name: "香囊", role: "rare",
        text: "彩布缝作小囊，内装丁香、藿香等芳香药末，佩于襟前，清香避邪，也是端午馈赠小物。" },
      { id: "ling", name: "龙头令", role: "rare",
        text: "龙舟竞渡源起南方水乡，《荆楚岁时记》载「五月五日……是日竞渡」。舟作龙形，鼓手居首，鼓声定桨频。2006 年端午列入首批国家级非遗，2009 年入选联合国教科文组织人类非遗名录。" }
    ],
    RARE_WEIGHT: 4,
    LING_WEIGHT: 0.5,
    FACTS: [
      "端午于 2006 年列入首批国家级非物质文化遗产名录，2009 年入选联合国教科文组织人类非物质文化遗产代表作名录。",
      "「端午」之「端」为初始之意，古称端五、重午，仲夏午日采药沐兰汤是其源头之一。",
      "纪念屈原是端午最广为人知的传说，但竞渡与食粽的习俗记载早于屈原故事的附会。"
    ]
  };
})();
```

- [ ] **Step 3: assets/rng.js**

```js
(function () {
  window.LZRng = function (seed) {
    var s = seed >>> 0;
    function next() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      range: function (a, b) { return a + (b - a) * next(); },
      int: function (a, b) { return a + Math.floor((b - a + 1) * next()); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; }
    };
  };
})();
```

- [ ] **Step 4: assets/style.css（tokens + 布局，完整实现）**

CSS 变量：`--red:#C3272B; --ink:#425066; --gold:#FFB61E; --moon:#D6ECF0; --paper:#F5F0E6; --font-kai:"Kaiti SC","STKaiti","KaiTi",serif;`
要点（全部写出，不省略）：
- `.view{position:fixed;inset:0;display:none} .view.is-active{display:block}`
- home：宣纸底 + 竖排标题（`writing-mode:vertical-rl`，字号 13vw，楷体，字间距留白），`home-series` 小字横排，主按钮朱红圆角 999px，`home-foot` 底部小字
- game：canvas 全屏；`.hud` 顶部 `padding-top:calc(12px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))`，左右分布；`.steady` 三个 12px 圆点（`.is-off` 变灰）；`.drum-btn` 右下 88px 圆形（径向渐变鼓面+金边），`:active` 缩放 0.92，`padding-bottom` 含安全区；`.gauge-wrap` 鼓按钮上方竖条 6×72px，`gauge-fill` 从下往上金色填充（`height:%`）；`.toast` 顶部居中淡入淡出；`.tutor` 底部居中白字半透明底；`.pause-mask` 全屏遮罩默认 `display:none`，`.is-on` 显示
- codex：宣纸底，3 列网格，未解锁格子灰底问号，已解锁白底 + canvas 图标（图标由 sprites 画到 120×120 离屏）；`.codex-card` 底部弹层默认隐藏
- result：宣纸底，`.result-seal` 朱红方章（楷体白字，旋转 -6deg），stats 四宫格，`.result-know` 白卡片，按钮组
- 按钮通用：`.primary-btn`（朱红底白字）/`.ghost-btn`（描边）/`.chip-btn`（小圆角）

- [ ] **Step 5: 验证**

Run: `python3 - <<'EOF'` 起一个最小 playwright 脚本打开 `file://$PWD/tools/longzhou/index.html`，断言：无 console error、`#view-home.is-active` 存在、`window.LZData.CODEX.length===8`、`LZRng(1).next()` 两次调用值不同且 ∈[0,1)。
Expected: 全过

- [ ] **Step 6: Commit**

```bash
git init 2>/dev/null; git add tools/longzhou && git commit -m "feat(longzhou): 骨架+数据+随机数"
```

（仓库当前非 git 仓库；若保持非 git 则跳过 commit，仅记录进度。下同。）

---

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

### Task 4: 游戏核心——移动、生成器、碰撞、翻船

**Files:**
- Modify: `assets/game.js`（主体）、`assets/sprites.js`（障碍绘制）

**Interfaces:**
- Produces: 完整 `LZGame`（start/update/swipe/drum/snapshot/setCallback）、`window.__game` 测试钩子、实体结构 `{kind:'obs'|'pick', type, lane, z, done, drift?}`

- [ ] **Step 1: game.js 扩展状态与速度**

S 增加字段：`speed, score, scoreFrac, zongzi, combo, maxCombo, steady, gauge, dashT, invT, capT, entities, sinceSpawn, lastDrumAt, rng`。
- `start()`：`rng = LZRng(testMode ? 20260818 : (Date.now() >>> 0))`（testMode = `[?&]test=1/.test(location.search)`），重置全部字段，`steady=3`
- `baseSpeed(d) = D.BASE_SPEED + (D.MAX_SPEED - D.BASE_SPEED) * Math.min(1, d / D.SPEED_RAMP_DIST)`
- update 推进：`sp = baseSpeed(S.dist) * (S.dashT > 0 ? D.DASH_MULT : 1)`；`S.dist += sp*dt`；`S.scoreFrac += sp*dt`（里程分）；`S.speed = sp`

- [ ] **Step 2: 生成器**

```js
function spawnGap(d) { return Math.max(D.GAP_MIN, D.GAP_MAX - d / D.GAP_RAMP * (D.GAP_MAX - D.GAP_MIN)); }

function spawnWave() {
  var z = D.Z_MAX;
  var roll = S.rng.next() * 100;
  var d = S.dist;
  if (roll < 30) { push("obs", S.rng.pick(["rock", d > 200 ? "whirl" : "rock", d > 500 ? "log" : "rock"]), S.rng.int(-1, 1), z); }
  else if (roll < 50 && d > 150) { var free = S.rng.int(-1, 1); for (var l = -1; l <= 1; l++) if (l !== free) push("obs", "rock", l, z); }
  else if (roll < 72) { var ln = S.rng.int(-1, 1); for (var k = 0; k < 3; k++) push("pick", "zongzi", ln, z + k * 6); }
  else if (roll < 90) { var ob = S.rng.int(-1, 1); push("obs", "rock", ob, z); var pl = ob + (ob === 1 ? -1 : 1); push("pick", "zongzi", pl, z); push("pick", "zongzi", pl, z + 6); }
  else if (roll < 96) { push("pick", "wine", S.rng.int(-1, 1), z); }
  else { push("pick", pickRare(), S.rng.int(-1, 1), z); }
}
```

- `push(kind, type, lane, z)`：`S.entities.push({kind, type, lane, z, done:false, drift: type==="log" ? (S.rng.next()<0.5?-1:1)*0.35 : 0})`
- `pickRare()`：按权重抽——未解锁稀有物（含 ling）权重 ×2；权重表：每个 rare 4，ling 0.5；已解锁的 rare 权重 4 保持（可重复收集得分）
- update 内：`S.sinceSpawn += sp*dt; if (S.sinceSpawn >= spawnGap(S.dist)) { S.sinceSpawn = 0; spawnWave(); }`
- 实体推进：`e.z -= sp*dt`；log 漂移：`e.laneF = (e.laneF==null? e.lane : e.laneF) + e.drift*dt`，clamp [-1,1]（碰撞用 `Math.round(e.laneF)`）；`e.z < -12` 移除
- **硬约束自检**：任一 wave 内 obs 最多占 2 航道（上面代码已保证），无头遍历断言

- [ ] **Step 3: 碰撞与受击/翻船**

```js
function boatLane() { return Math.round(S.boatX); }
function collide(e) {
  if (e.done) return;
  var inZ = e.z < 6 && e.z > -2;
  if (!inZ) return;
  if (e.kind === "obs") {
    var el = Math.round(e.laneF != null ? e.laneF : e.lane);
    if (el !== boatLane()) return;
    if (S.dashT > 0) { e.done = true; addScore(50); emit("hit", {smash:true}); return; }
    if (S.invT > 0) return;
    e.done = true; S.steady--; S.invT = D.HIT_INV; S.combo = 0; emit("hit", {});
    if (S.steady <= 0) capsize();
  } else {
    if (Math.abs(S.boatX - e.lane) > 0.6) return;
    e.done = true; collect(e);
  }
}
function capsize() { S.state = "capsized"; S.capT = 1.4; emit("capsize"); }
```

- capsized 状态 update：`S.capT -= dt`，船 tilt 从 0→1.1 弧度、下沉（main 用 snapshot 渲染）；`capT<=0` → `S.state="result"; emit("result")`

- [ ] **Step 4: sprites.js 障碍绘制**

`obstacle(ctx, type, x, y, s, t)`：
- rock：深灰 `#3a424d` 不规则五边形（固定形状参数）+ 底部白色泡沫椭圆弧
- whirl：黛青深底椭圆 + 3 条旋转螺旋弧（相位 = t*3），中心深点
- log：棕色 `#7a5a3a` 圆角矩形横置（宽 90u*s 高 16u*s）+ 两端年轮圆 + 水线白边

- [ ] **Step 5: `window.__game` 测试钩子**（testMode 或始终暴露，文档注明）

```js
window.__game = {
  snapshot: function () { var o = {}; for (var k in S) if (k !== "entities" && k !== "rng") o[k] = S[k]; o.entities = S.entities.length; return o; },
  start: function () { window.LZGame.start(); },
  swipe: function (d) { window.LZGame.swipe(d); },
  drum: function () { window.LZGame.drum(); },
  setDist: function (m) { S.dist = m; },
  addScore: function (n) { addScore(n); },
  forceHit: function () { if (S.invT > 0) S.invT = 0; S.steady--; S.combo = 0; emit("hit", {}); if (S.steady <= 0) capsize(); },
  capsize: capsize,
  spawnWave: spawnWave,
  unlockAll: function () { window.LZSave.unlockAll(); },
  save: function () { return window.LZSave.load(); }
};
```

（`LZSave` 在 Task 6 定义；本任务先引用，Task 6 落地。）

- [ ] **Step 6: main.js 临时循环接实体渲染**：遍历 `S.entities` 投影绘制（obs 用 sprites.obstacle）；受击时 `LZScene.addSplash` + 画面抖动（canvas translate 随机种子偏移 0.2s）。
- [ ] **Step 7: 无头验证**：start → 2s 后 entities>0；`setDist(300)` 后 spawn 含 whirl；`forceHit()`×3 → state 经 capsized → result；遍历 200 个 spawnWave 断言每 wave obs 航道数 ≤2。
- [ ] **Step 8: Commit**

---

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

### Task 6: 图鉴 + 存档 + 物品绘制

**Files:**
- Create: `assets/save.js`（新增，index.html 在 data.js 后加载）
- Modify: `assets/sprites.js`（8 种物品）、`assets/main.js`（图鉴视图）、`assets/style.css`

**Interfaces:**
- Produces: `window.LZSave`：`load() -> {best,bestDist,codex:[],runs,muted}`、`save(o)`、`unlock(id) -> bool(是否首次)`、`unlockAll()`、`codexCount()`

- [ ] **Step 1: save.js**

```js
(function () {
  var KEY = "longzhou-save";
  function load() {
    try { var o = JSON.parse(localStorage.getItem(KEY) || "{}"); return { best: o.best || 0, bestDist: o.bestDist || 0, codex: o.codex || [], runs: o.runs || 0, muted: !!o.muted }; }
    catch (e) { return { best: 0, bestDist: 0, codex: [], runs: 0, muted: false }; }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  window.LZSave = {
    load: load, save: save,
    unlock: function (id) { var o = load(); if (o.codex.indexOf(id) >= 0) return false; o.codex.push(id); save(o); return true; },
    unlockAll: function () { var o = load(); o.codex = window.LZData.CODEX.map(function (c) { return c.id; }); save(o); },
    codexCount: function () { return load().codex.length; }
  };
})();
```

- [ ] **Step 2: sprites.js 物品绘制**（`pickup(ctx, id, x, y, s, t)`，上下浮动 `y + sin(t*3)*4u*s`，稀有物底部淡金光圈）：
- zongzi：箬叶绿 `#4a7c59` 三角粽 + 白米尖 + 缠线
- wine：褐黄葫芦瓶 + 红封纸 + 「雄」字点
- ai：一束青绿艾叶（3-5 片裂叶）+ 麻绳扎口
- changpu：3 片直立剑形绿叶
- wusai：五色（青白红黑黄）编绳圆环
- wudu：黄符纸 + 朱红印纹 + 折角
- xiangnang：红粉荷包 + 金边 + 下垂流苏
- ling：金色圆牌 + 龙纹弧线 + 红穗，光晕最强

- [ ] **Step 3: main.js 图鉴视图**：网格渲染 8 格（已解锁：canvas 120×120 画 `LZSprites.pickup` + 名称；未解锁：灰底「?」）；点已解锁 → `codex-card` 弹层显示全文；`codex-count` = `x/8`；返回按钮回来源视图（home 或 result，记录来源）。
- [ ] **Step 4: 解锁 toast**：`LZGame.setCallback("collect")` 内若 `LZSave.unlock` 返回 true → toast「图鉴解锁 · {name}」（toast 组件：显示 1.8s，队列）。
- [ ] **Step 5: 无头验证**：`__game.unlockAll()` → 图鉴 8/8 全亮、点开展开文案；清 localStorage 后回到 0/8；收集稀有（注入）触发 toast。
- [ ] **Step 6: Commit**

---

### Task 7: 首页 + 结算屏 + 称号 + 知识卡

**Files:**
- Modify: `assets/main.js`（视图切换正式化、结算渲染）、`assets/game.js`（result 事件带战绩）

**Interfaces:**
- Consumes: `LZSave`、`LZData.TITLES/FACTS`
- Produces: `showView(name)`、`fillResult(stats)`

- [ ] **Step 1: 视图机**：`showView("home"|"game"|"codex"|"result")` 切换 `.is-active`（沿用剪纸惯例）。首页：`home-best` 显示「最佳 {best} 分 · {bestDist}m」；runs++ 在 start 时。
- [ ] **Step 2: 结算渲染**：capsize→result 事件后：称号 = TITLES 按 score 取；stats 填充；`result-best` 更新 best/bestDist（LZSave）并标「新纪录」；`result-know` = 从**已解锁**图鉴随机抽一条（rng）显示 name+text，若图鉴空则用 FACTS 轮换；`result-codex` = 「图鉴 {n}/8」。
- [ ] **Step 3: 教学提示**：runs===1 的首局：开局 tutor 显示「左右滑动 换线」3s → 「连点右下鼓面 攒满冲刺」直到首次 dash 后消失。
- [ ] **Step 4: 暂停**：`visibilitychange` hidden 且 playing → state="paused" + pause-mask；继续恢复；「回首页」回 home。
- [ ] **Step 5: 无头验证**：完整一局（脚本自动 drum+swipe 或 forceHit×3）→ result 视图四数据非空、称号 ∈ 列表、best 持久化。
- [ ] **Step 6: Commit**

---

### Task 8: 分享出口

**Files:**
- Create: `assets/share.js`
- Modify: `assets/main.js`（按钮绑定）

**Interfaces:**
- Consumes: `LZData`、`LZSprites.pickup`（卡片上画粽子点缀）、结算 stats
- Produces: `LZShare.paintCard(stats) -> dataURL`、`LZShare.saveAlbum()`、`LZShare.postNote()`

- [ ] **Step 1: share.js**

```js
(function () {
  var D = window.LZData;
  function paintCard(st) {
    var c = document.createElement("canvas"); c.width = 900; c.height = 1200;
    var g = c.getContext("2d");
    // 宣纸底 #F5F0E6；朱红双线边框（内缩 36px）
    // 顶部竖排小字「非遗手作坊 · 端午」；主标题「龙舟破浪」楷体 96px 黛青居中
    // 朱红方章（150×150，旋转 -6°）内白字称号（st.title）
    // 战绩区：航程/总分/粽子/最高连击 四行大字（数字 72px 黛青 + 标签 28px）
    // 知识卡：白底圆角片，题目 + 换行正文（手动按 14 字/行折行，行高 44）
    // 底部：图鉴 {n}/8 + 「龙舟破浪 · 端午竞渡」小字
    return c.toDataURL("image/png");
  }
  function miniTool() { return window.xhs && window.xhs.miniTool; }
  function fallback() { alert("当前环境暂不支持直接保存，请截图保存哦"); }
  function withFile(fn) {
    var mt = miniTool(); var dataUrl = paintCard(window.LZShare.lastStats);
    if (!mt || !dataUrl) { fallback(); return; }
    mt.writeTempFile({ data: dataUrl, success: function (res) { fn(mt, res.filePath); }, fail: fallback });
  }
  window.LZShare = {
    lastStats: null,
    paintCard: paintCard,
    saveAlbum: function () { withFile(function (mt, p) { mt.saveImageToPhotosAlbum({ filePath: p, success: function () { alert("已保存到相册"); }, fail: fallback }); }); },
    postNote: function () {
      withFile(function (mt, p) {
        mt.postNote({
          title: "我在端午划了 " + window.LZShare.lastStats.distText,
          content: "击鼓奋楫，破浪夺标。来《龙舟破浪》划一局，攒端午图鉴。",
          tags: "#国风vibecoding #端午 #龙舟 #非遗 #国风 #中式美学",
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
```

折行函数需完整实现（按字符宽度逐字测量或固定 14 字换行 + 标点避头尾从简）。

- [ ] **Step 2: main.js**：结算时 `LZShare.lastStats = {...}`；`btn-save-album`/`btn-post-note` click 绑定（用户手势触发）。
- [ ] **Step 3: 无头验证**：无 `window.xhs` 时点击 → dialog 出现且文案为降级提示；注入 mock `window.xhs.miniTool`（记录调用）→ 断言 writeTempFile→postNote 顺序与参数（title ≤20 字、mediaInfo 结构合法）；`paintCard` 返回 `data:image/png` 且尺寸 900×1200（解码检查）。
- [ ] **Step 4: Commit**

---

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

### Task 10: 主装配收尾（覆盖临时 main.js）

**Files:**
- Modify: `assets/main.js`（正式完整版）、清理临时启动代码

- [ ] **Step 1: main.js 正式版**：整合 Task 2-9 所有接线：rAF 主循环（`LZGame.update(dt)` → `LZScene.draw(snapshot, dt)` → 实体投影渲染（按 z 从远到近排序绘制）→ 船渲染（paddlePhase=dist*0.5，dash 拖尾：船后金色渐隐残影 3 帧 + `addSplash` 两侧浪花）→ HUD 同步）；所有按钮/手势/键盘；视图机；toast 队列；教学；暂停。
- [ ] **Step 2: 冲刺视觉**：dashT>0 时画面边缘淡金 vignette + 浪花强度加倍。
- [ ] **Step 3: 无头全流程**：home→start→玩 10s（脚本随机 swipe/drum）→forceHit×3→result→再战→状态全部正确，无 console error；截图 3 张（游戏中/冲刺中/结算）人眼检查。
- [ ] **Step 4: Commit**

---

### Task 11: Demo 自驾模式（发布素材用）

**Files:**
- Modify: `assets/main.js`（`?demo=1`）

- [ ] **Step 1: autopilot**：每帧扫描 entities：找 z<45 的 obs，其航道集合为 blocked；目标航道 = 优先「无阻挡且有 pickup 的航道」，否则任一非 blocked 航道（偏好当前道）；`swipe` 逼近；gauge<88 时以 ~7 次/s 节奏 `drum()`；开局自动 start。
- [ ] **Step 2: 验证**：`?demo=1` 无头跑 60s，断言 dist>400 且期间至少触发 1 次 dash、未翻船（若过早翻船则调避让提前量 45→60m）。
- [ ] **Step 3: Commit**

---

### Task 12: 无头断言套件定稿

**Files:**
- Create: `tests/longzhou_smoke.py`

- [ ] **Step 1: 完整脚本**（playwright sync_api，viewport 390×844，`file://` 加载 `?test=1`，收集 console error 最后断言为空）：

```python
import pathlib, sys, zipfile, tempfile, subprocess
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = (ROOT / "tools/longzhou/index.html").as_uri() + "?test=1"
errors = []

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(URL)
        assert pg.eval_on_selector("#view-home", "el.classList.contains('is-active')")
        assert pg.evaluate("window.LZData.CODEX.length") == 8
        g = lambda: pg.evaluate("window.__game.snapshot()")
        pg.evaluate("window.__game.start()")
        assert g()["state"] == "playing"
        pg.wait_for_timeout(1500)
        assert g()["entities"] > 0, "应有实体生成"
        pg.evaluate("window.__game.swipe(1)")
        pg.wait_for_timeout(400)
        assert g()["lane"] == 1
        for _ in range(12):
            pg.evaluate("window.__game.drum()")
            pg.wait_for_timeout(130)
        s = g()
        assert s["dashT"] > 0 or s["gauge"] >= 96, "击鼓应攒槽/触发冲刺"
        pg.evaluate("window.__game.setDist(600)")
        pg.wait_for_timeout(800)
        assert g()["speed"] > 9, "难度应随里程上升"
        waves_ok = pg.evaluate("(function(){ for(var i=0;i<200;i++){ window.__game.spawnWave(); } return true; })()")
        assert waves_ok
        pg.evaluate("window.__game.unlockAll()")
        assert len(pg.evaluate("window.__game.save().codex")) == 8
        pg.evaluate("window.__game.forceHit()")
        pg.evaluate("window.__game.forceHit()")
        pg.evaluate("window.__game.forceHit()")
        assert g()["state"] in ("capsized", "result")
        pg.wait_for_timeout(1800)
        assert g()["state"] == "result"
        assert pg.eval_on_selector("#view-result", "el.classList.contains('is-active')")
        assert pg.evaluate("!!document.getElementById('result-title').textContent")
        pg.click("#btn-save-album")
        pg.wait_for_timeout(200)
        # 无 xhs 环境应走降级 alert
        b.close()
    assert not errors, errors
    print("SMOKE PASS")

run()
```

（alert 处理：`pg.on("dialog", lambda d: d.accept())` 加到 new_page 后。）

- [ ] **Step 2: Run** `python3 tests/longzhou_smoke.py`
Expected: `SMOKE PASS`
- [ ] **Step 3: Commit**

---

### Task 13: 打包 + zip 冒烟 + 系列文档更新

**Files:**
- Create: `dist/longzhou.zip`
- Modify: `docs/series-plan.md`（#8 条目 + 变更记录）

- [ ] **Step 1: 打包前自检**（`.skill/references/zip-artifact-spec.md` §6 + device-capabilities §6 扫描清单逐条 grep：`fetch(|XMLHttpRequest|eval(|new Function|Worker|devicemotion|clipboard|geolocation|window.open|https://`，应零命中；无内联 script/onclick）
- [ ] **Step 2: 打包**

```bash
cd tools/longzhou && zip -r ../../dist/longzhou.zip . -x '*.DS_Store' && cd ../.. && ls -la dist/longzhou.zip
```

Expected: zip 存在，体积 <1MB；`unzip -l` 确认 `index.html` 在根、仅支持类型

- [ ] **Step 3: zip 独立冒烟**：解压到临时目录 → playwright 加载解压后的 index.html（`?test=1`）→ `__game.start()` 正常、无 console error、截图一张
- [ ] **Step 4: 更新 series-plan.md**：§3 表格加「8 | 龙舟破浪 | 经典换皮（无尽跑酷） | … | ✅ 已完成（dist/longzhou.zip）」；§8 变更记录加一行
- [ ] **Step 5: Commit**

---

### Task 14: 发布素材

**Files:**
- Create: `release/longzhou/images/*.png`、`release/longzhou/发布文案.md`

- [ ] **Step 1: 截图**：`?demo=1` 无头跑局，在 home / 游戏中 / 冲刺 / 结算 四个时刻截图存入 `release/longzhou/images/`（01-home.png … 04-result.png）；另用 `LZShare.paintCard` 导出卡片图 05-card.png
- [ ] **Step 2: 文案**：参照 `release/jianzhi/发布文案.md` 结构写 `release/longzhou/发布文案.md`（标题/正文/标签/配图说明）
- [ ] **Step 3: Commit**

---

## Self-Review 结论

- Spec 覆盖：核心循环（Task 4/5）、击鼓冲刺（Task 5）、难度曲线（Task 4 spawnGap/baseSpeed）、图鉴 8 件（Task 6）、称号/知识卡/结算（Task 7）、分享出口（Task 8）、音效（Task 9）、教学/暂停（Task 7/10）、视觉门禁（Task 2 Step 3）、验收清单（Task 12/13）——全覆盖
- 数值与 spec 一致（Global Constraints 逐项抄自 spec §1/§2）
- 接口签名在各任务间一致（LZScene.project / LZSprites.boat / LZGame.* / LZSave.* / LZShare.*）
- 已知风险：Task 2 视觉检查点可能需要多轮调参（计划内已留门禁）；demo 自驾可能需调避让参数（Task 11 Step 2 已注明）
