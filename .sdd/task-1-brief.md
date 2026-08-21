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

