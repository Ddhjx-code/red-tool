/* ============================================================
   月下灯会 · 夜空场景层 (window.YDScene)
   ------------------------------------------------------------
   职责：渲染活在 CSS/DOM 里的夜空元素（WebGL 那盏灯归 engine.js）。
   1. 星野     —— STARS 固定表 → #stars / #result-stars 的 .star
   2. 月相     —— PHASES + MOON_COVER → #moon / #result-moon 的
                  data-phase 与 --cover（§4.3 复用月宴 drawMoon 的做法）
   3. 灯会盛景 —— FESTIVAL_LAMPS 26 盏三层景深 → #far-lamps 的 .fl
                  与 #fest-lamps 的 .fest.mid / .fest.near（§9.2）
    4. 灯骨架   —— 舞台实测尺寸 → #stage / #result-stage 的
                   --cx/--cy/--hw/--hh（骨架与 WebGL 画布同源对齐）
    4b. 放灯语境 —— PLACEMENTS 三式（§3）各有一套可见的承托物：
                   挂架 = 枝架横杆 + 吊绳 + 成串成列的小灯；
                   水放 = 水面 + 水面亮边 + 倒影 + 灯光映在水里的光斑；
                   手提 = 灯体下移、提梁加重（无外加承托物，人在街上提着走）。
                   灯体本身的位移写进 --cy（骨架随之），画布位移写进 --lift。
   5. 月相关联 —— PHASES[].sky 调夜空环境光、PHASES[].lampGlow 调灯光增益，
                  并把 PHASES[].moon 交给引擎 setMoon（§9.3）
   6. 齐明     —— #stage 的 is-lit 类 + 每盏灯的大气透视（§9.2 联动）

   确定性：零随机、零网络、零外部依赖。位置全部取自固定表；摇摆只是
   时间的函数（用 CSS 动效 + 固定 animation-delay 表达，见下）。

   不新增 CSS：只写内联样式与 CSS 自定义属性。色值不写死，运行时从
   style.css 的 :root token 读出（--lamp-warm / --moon / --night-* /
   --horizon / --dur-3 / --ease），token 读不到时才退回镜像常量。

   ---------- 摇摆为何不自建 rAF ----------
   数据表的摇摆模型只有两个量：sway（相位偏移，秒）与 delay（齐明级联
   延迟，秒）。相位偏移正是 CSS animation-delay 能表达的东西，而唯一的
   rAF 循环归 main.js（engine.update(dt) 由它驱动）；再开一条 rAF 只为
   写 26 个 transform，既重复又更贵。故取 style.css 已有的 @keyframes sway
   （±3deg，6.4s）+ 每盏灯的固定负延迟 = 确定性相位偏移，逐帧零 JS。
   delay 则依 data.js 的原义用于齐明级联（transition-delay），不混进摇摆。

   ---------- main.js 的调用顺序 ----------
   YDScene.init()                       建星 / 建灯会 / 初始月相 P1 / 同步骨架
   YDScene.resize()                     window resize，以及「切到创作台或成品页之后」
                                        （视图 display:none 时实测尺寸为 0，故必须补调）
    YDScene.setPhase(code | index)       月相按钮循环
    YDScene.setPlacement(id)             放灯手法（创作台）
    YDScene.setResultPlacement(id)       放灯手法（成品台，取存档值）
    YDScene.setLit(on [, stagger])       点亮 / 熄灭（引擎的 setLit 由 main.js 另调）
   ============================================================ */
(function () {
  'use strict';

  var D = window.YDData;
  var E = window.YDEngine;

  /* ---------- 镜像常量（仅作为 style.css 的只读参照，不新增 CSS） ---------- */
  var SWAY_PERIOD = 6.4;      // style.css: .lamp-tassel 的 animation: sway 6.4s
  var LAMP_RATIO = 1.25;      // style.css: 灯体宽高比 8:10 / 12:15 / 16:20 / 24:30
  var GLOW_FAR = { blur: 10, spread: 3, alpha: 0.34 };   // .stage.is-lit .fl 的 box-shadow
  var GLOW_FEST = { mid: { blur: 6, alpha: 0.55 }, near: { blur: 10, alpha: 0.62 } };
  var SKY_TOKENS = ['--night-0', '--night-1', '--night-2', '--night-3', '--horizon'];
  var AMBIENT_VIEWS = ['view-create', 'view-result'];    // 夜空底色所在的两个视图

  /* token 读不到时的镜像值（取自 style.css :root，逐字抄录） */
  var TOKEN_MIRROR = {
    '--lamp-warm': '#F5C77E', '--moon': '#F2E4C4',
    '--night-0': '#05070F', '--night-1': '#0A1024', '--night-2': '#111B36',
    '--night-3': '#17233F', '--horizon': '#0C1220',
    '--dur-3': '0.5s', '--ease': 'cubic-bezier(0.22, 0.61, 0.36, 1)'
  };

  /* ---------- 模块状态 ---------- */
  var TOK = null;        // 解析后的 token（颜色为 0..1 的 rgb）
  var lamps = [];        // [{ node, data }] —— 26 盏背景灯
  var current = null;    // 当前月相 PHASES 条目
  var litOn = false;
  var geo = { create: null, result: null };

  /* ============================================================
     放灯语境（§3 三式）：全部为固定表，零随机。
     ------------------------------------------------------------
     LIFT = 灯体在该式下的垂直位移（px，正值向下）。
       挂架：灯挂得高一些，横杆与吊绳才在灯上方有位置；
       水放：灯体不动，灯底正好落在水面亮边上（浮于水面）；
       手提：灯体下移，提着走在街上，灯于是靠近街面天际线。
     位移只写进 --cy（骨架四件随之对齐）与 --lift（画布随之平移），
     灯面 uv 几何（LAMP_C / LAMP_HW / LAMP_HH）一字不改。 */
  var LIFT = { hang: 0, carry: 36, array: 0 };

  /* 高挂 · 树中秋：灯系竹竿高树于瓦檐／天台／树上，成串成列。
     x = 舞台宽度百分比；cord = 自横杆下垂的绳长 px；w/h = 灯体 px。
     绳长上限 26px：小灯底边因此始终落在主灯顶边之上，不与主灯重叠。 */
  var HANG_LAMPS = [
    { x:  9, cord: 18, w: 16, h: 20 },
    { x: 24, cord: 24, w: 14, h: 18 },
    { x: 37, cord: 14, w: 13, h: 16 },
    { x: 63, cord: 16, w: 13, h: 16 },
    { x: 76, cord: 26, w: 14, h: 18 },
    { x: 91, cord: 20, w: 16, h: 20 }
  ];

  /* 高挂 · 横杆上的两根枝杈。x = 舞台宽度百分比；rot = 固定倾角（度）。 */
  var HANG_BRANCHES = [{ x: 17, rot: -18 }, { x: 83, rot: 18 }];

  /* 手提 · 提灯之会：沿街同行的几盏伴灯。x = 舞台宽度百分比；
     bottom = 距舞台底边的 px，取 90..110 使其落在 64px 天际线之上、主灯之下。
     x 取 12/28/72/88 使其避开主灯横向占位（113..277px）。w/h = 灯体 px。 */
  var CARRY_LAMPS = [
    { x: 12, y: 96,  w: 15, h: 19 },
    { x: 28, y: 110, w: 13, h: 17 },
    { x: 72, y: 104, w: 14, h: 18 },
    { x: 88, y: 90,  w: 16, h: 20 }
  ];

  /* 砌成字 · 灯阵：多盏灯砌成字形高揭于家屋之高处。
     3×3 网格取「中」字形笔画位（中竖 + 上下横），x/y = 舞台百分比。 */
  var ARRAY_LAMPS = [
    { x: 34, y: 46 }, { x: 50, y: 46 }, { x: 66, y: 46 },
    { x: 50, y: 36 },
    { x: 34, y: 26 }, { x: 50, y: 26 }, { x: 66, y: 26 }
  ];

  var PLACEMENT_HOSTS = [
    { key: 'create', stage: 'stage', ctx: 'place-ctx' },
    { key: 'result', stage: 'result-stage', ctx: 'result-place-ctx' }
  ];

  /* 创作台与成品台各自一份：成品台取存档里的那一式 */
  var place = { create: null, result: null };

  function el(id) { return document.getElementById(id); }

  /* ============================================================
     design token：颜色与动效一律追溯到 style.css 的 :root
     ============================================================ */
  function rgbOf(value) {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) { return null; }
    var c = D.hexToRgb(value);           // 数据层的查表函数，返回 0..1
    if (!c || isNaN(c.r) || isNaN(c.g) || isNaN(c.b)) { return null; }
    return c;
  }

  function readTokens() {
    if (TOK) { return TOK; }
    var cs = window.getComputedStyle ? window.getComputedStyle(document.documentElement) : null;
    var raw = {}, keys = Object.keys(TOKEN_MIRROR), i, v;
    for (i = 0; i < keys.length; i++) {
      v = cs ? String(cs.getPropertyValue(keys[i]) || '').trim() : '';
      raw[keys[i]] = v || TOKEN_MIRROR[keys[i]];
    }
    TOK = {
      lampWarm: rgbOf(raw['--lamp-warm']) || rgbOf(TOKEN_MIRROR['--lamp-warm']),
      moon: rgbOf(raw['--moon']) || rgbOf(TOKEN_MIRROR['--moon']),
      sky: {},
      dur3: raw['--dur-3'],
      ease: raw['--ease']
    };
    for (i = 0; i < SKY_TOKENS.length; i++) {
      TOK.sky[SKY_TOKENS[i]] = rgbOf(raw[SKY_TOKENS[i]]) || rgbOf(TOKEN_MIRROR[SKY_TOKENS[i]]);
    }
    return TOK;
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function mix(a, b, t) {
    return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
  }
  function gain(c, k) { return { r: clamp01(c.r * k), g: clamp01(c.g * k), b: clamp01(c.b * k) }; }
  function px255(v) { return Math.round(clamp01(v) * 255); }
  function rgbCss(c) { return 'rgb(' + px255(c.r) + ',' + px255(c.g) + ',' + px255(c.b) + ')'; }
  function rgbaCss(c, a) {
    return 'rgba(' + px255(c.r) + ',' + px255(c.g) + ',' + px255(c.b) + ',' + clamp01(a).toFixed(3) + ')';
  }

  /* ============================================================
     1. 星野：STARS 固定表 [x%, y%, 边长 px, 闪烁延迟 秒]
        闪烁动效（@keyframes twinkle）已在 CSS 里，此处只放位置与尺寸。
     ============================================================ */
  function buildStars(host) {
    if (!host || host.childNodes.length) { return 0; }
    var i, s, node;
    for (i = 0; i < D.STARS.length; i++) {
      s = D.STARS[i];
      node = document.createElement('span');
      node.className = 'star';
      node.style.left = s[0] + '%';
      node.style.top = s[1] + '%';
      node.style.width = s[2] + 'px';
      node.style.height = s[2] + 'px';
      node.style.animationDelay = s[3].toFixed(1) + 's';
      host.appendChild(node);
    }
    return D.STARS.length;
  }

  /* ============================================================
     2. 月相：§4.3 复用月宴 drawMoon —— 同一枚月轮叠五档云量，
        云带高度由 MOON_COVER 写入 --cover，档位由 data-phase 锁定。
        （月宴的 paintMoonBody 在此保留为幂等补建：index.html 已带月轮结构，
          故正常路径下它是空操作。）
     ============================================================ */
  function paintMoonBody(host) {
    if (host.childNodes.length) { return; }
    host.innerHTML =
      '<div class="m-halo"></div>' +
      '<div class="m-rim"></div>' +
      '<div class="m-disc"></div>' +
      '<div class="m-clouds">' +
        '<span class="m-wisp m-w1"></span>' +
        '<span class="m-wisp m-w2"></span>' +
        '<span class="m-wisp m-w3"></span>' +
        '<div class="m-band"></div>' +
      '</div>';
  }

  function drawMoon(host, phase) {
    if (!host) { return; }
    paintMoonBody(host);
    host.setAttribute('data-phase', phase.code);
    var cover = D.MOON_COVER[phase.code];
    host.style.setProperty('--cover', String(cover === undefined ? phase.cover : cover));
  }

  /* ============================================================
     3. 灯会盛景（§9.2）：26 盏三层景深，全部取自 FESTIVAL_LAMPS。
        大气透视：越远越暗越冷（bright↓ warm↓ halo↓），越近越亮越暖。
        这些量只在点亮后写进 DOM —— 未点亮时群灯是 CSS 原样的剪影，
        与已验证原型一致。
     ============================================================ */
  function lampSize(l) {
    var w = Math.max(4, Math.round(l.scale * D.LAMP_BASE_PX));
    return { w: w, h: Math.round(w * LAMP_RATIO) };
  }

  /* 灯色：暖金向月色（冷）插值，插值量 = 1 - warm；再按月相灯光增益提亮 */
  function lampTint(warm, lampGlow) {
    return gain(mix(TOK.lampWarm, TOK.moon, clamp01(1 - warm)), lampGlow);
  }

  function transitionCss() {
    var d = TOK.dur3, e = TOK.ease;
    return 'background ' + d + ' ' + e + ', box-shadow ' + d + ' ' + e +
           ', filter ' + d + ' ' + e + ', opacity ' + d + ' ' + e;
  }

  /* 背景灯的发光 sprite。背景灯只有 8–24px，CSS 画不出结构 —— 视觉评审判
     「背景灯只有形没有光：光晕 0 层、无上下盖、无竹骨，等距如贴纸」。故按其
     形状预渲染为位图：三层光（外晕 → 中晕 → 近白亮核）+ 灯体 + 上下盖 + 竹骨。
     bright 取 0.8/1.0/1.2 三档，用来打散等距感（零随机：档位由灯的 id 定）。 */
  function makeLampSprite(bright) {
    var S = 96;
    var c = document.createElement('canvas');
    c.width = S; c.height = S;
    var g = c.getContext('2d');
    if (!g) { return ''; }
    var cx = S / 2, cy = S / 2, i, a, r;

    /* 三层光：外晕 → 中晕 → 近白亮核。
       外晕必须够强才「溢」得出来 —— 首版外晕 0.20、中晕 0.54，实测被判
       「光只亮在灯体内部，远景一排基本无晕、呈灰褐色像未点亮」。 */
    var halo = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.50);
    halo.addColorStop(0.00, 'rgba(255, 226, 168, ' + (0.34 * bright).toFixed(3) + ')');
    halo.addColorStop(0.42, 'rgba(245, 184, 65, ' + (0.17 * bright).toFixed(3) + ')');
    halo.addColorStop(1.00, 'rgba(226, 140, 70, 0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, S, S);
    var mid = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.27);
    mid.addColorStop(0.00, 'rgba(255, 242, 210, ' + (0.62 * bright).toFixed(3) + ')');
    mid.addColorStop(0.55, 'rgba(245, 199, 126, ' + (0.32 * bright).toFixed(3) + ')');
    mid.addColorStop(1.00, 'rgba(245, 199, 126, 0)');
    g.fillStyle = mid;
    g.fillRect(0, 0, S, S);

    /* 灯体：八边形，竖向渐变（腰腹最亮、上下口收暗） */
    var bw = S * 0.145, bh = S * 0.185;
    var oct = [[0, -1], [0.62, -0.78], [1, -0.34], [1, 0.34],
               [0.62, 0.78], [0, 1], [-0.62, 0.78], [-1, 0.34], [-1, -0.34], [-0.62, -0.78]];
    g.save();
    g.translate(cx, cy);
    var body = g.createLinearGradient(0, -bh, 0, bh);
    body.addColorStop(0.00, '#E8A64B');
    body.addColorStop(0.46, '#FFE6B4');
    body.addColorStop(0.62, '#F5C77E');
    body.addColorStop(1.00, '#C97F33');
    g.fillStyle = body;
    g.beginPath();
    for (i = 0; i < oct.length; i++) {
      var px = oct[i][0] * bw, py = oct[i][1] * bh;
      if (i === 0) { g.moveTo(px, py); } else { g.lineTo(px, py); }
    }
    g.closePath();
    g.fill();
    /* 竖向竹骨：透光纸上骨条读作暗筋 */
    g.strokeStyle = 'rgba(146, 92, 38, 0.55)';
    g.lineWidth = 1;
    for (i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(i * bw * 0.34, -bh * 0.86);
      g.lineTo(i * bw * 0.34, bh * 0.86);
      g.stroke();
    }
    /* 上下盖 */
    g.fillStyle = '#4A3A28';
    g.fillRect(-bw * 0.72, -bh - S * 0.035, bw * 1.44, S * 0.035);
    g.fillRect(-bw * 0.64, bh, bw * 1.28, S * 0.032);
    g.restore();

    /* 灯口一线近白高光，把「里面有火」点出来 */
    var core = g.createRadialGradient(cx, cy + bh * 0.18, 0, cx, cy + bh * 0.18, bw * 0.9);
    core.addColorStop(0.00, 'rgba(255, 250, 236, ' + (0.85 * bright).toFixed(3) + ')');
    core.addColorStop(1.00, 'rgba(255, 240, 205, 0)');
    g.fillStyle = core;
    g.fillRect(0, 0, S, S);

    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }

  function buildFestival() {
    var farHost = el('far-lamps'), festHost = el('fest-lamps');
    if (!farHost || !festHost) { return 0; }
    if (farHost.childNodes.length || festHost.childNodes.length) { return lamps.length; }

    readTokens();
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var i, l, node, size, far;
    lamps = [];
    /* 三档亮度的发光 sprite，按灯序轮换 —— 打散「等距同亮」的贴纸感。
       暗档取 0.94 而非 0.80：0.80 时灯发灰，与「已点亮」的画面自相矛盾。
       远排另用一组更暗的（0.85/0.92/1.00）：远排灯只有 8px，用同一档会把灯体
       自身的明暗对比抹平，晕与灯糊成一枚灰白亮块（「有晕，但读作亮斑而非灯火」）。 */
    var sprites = [makeLampSprite(0.94), makeLampSprite(1.04), makeLampSprite(1.14)];
    var spritesFar = [makeLampSprite(0.85), makeLampSprite(0.92), makeLampSprite(1.00)];

    for (i = 0; i < D.FESTIVAL_LAMPS.length; i++) {
      l = D.FESTIVAL_LAMPS[i];
      far = l.layer === 'far';
      node = document.createElement('span');
      node.className = far ? 'fl' : ('fest ' + (l.layer === 'near' ? 'near' : 'mid'));
      node.setAttribute('data-lamp', l.id);
      var set = far ? spritesFar : sprites;
      node.style.setProperty('--sprite', 'url(' + set[i % set.length] + ')');
      /* 确定性抖动：尺寸 ±10%、竖直 ±3px、横向 ±6px。灯会该是「有秩序的参差」，
         严格等距同尺寸会被读作贴纸（评审两轮都点到「横向间距仍近乎等距」）。
         零随机 —— 抖动只由序号决定。 */
      var jit = (i * 7) % 5 - 2;
      var xjit = ((i * 11) % 7 - 3) * 2;
      /* 每盏微差（明度 ±5%、冷暖微偏）＋ 远景大气透视（远排略降饱和与亮度、
         偏冷）。评审收尾两条：「远排晕色齐灰白，缺每盏微差」「远排与主灯之间
         缺一层大气透视」。零随机 —— 系数由序号定。 */
      var lum = 1 + jit * 0.025;
      if (far) {
        lum *= 0.96;
        node.style.filter = 'brightness(' + lum.toFixed(3) +
          ') saturate(0.88) hue-rotate(' + (jit * 3) + 'deg)';
      } else {
        node.style.filter = 'brightness(' + lum.toFixed(3) +
          ') hue-rotate(' + (jit * 2) + 'deg)';
      }
      (far ? farHost : festHost).appendChild(node);

      /* 尺寸：scale × LAMP_BASE_PX；居中用负 margin，把 transform 留给摇摆。
         抖动加在尺寸与竖直位置上（±10% / ±3px），破掉「严格等距同尺寸」。 */
      size = lampSize(l);
      var kk = 1 + jit * 0.05;
      var ww = size.w * kk, hh = size.h * kk;
      node.style.width = ww.toFixed(1) + 'px';
      node.style.height = hh.toFixed(1) + 'px';
      node.style.marginLeft = (-ww / 2 + xjit).toFixed(1) + 'px';
      node.style.left = l.x + '%';
      if (far) {
        node.style.marginBottom = (-hh / 2 + jit * 0.6).toFixed(1) + 'px';
      } else {
        node.style.marginTop = (-hh / 2 + jit * 0.8).toFixed(1) + 'px';
        node.style.top = l.y + '%';
      }

      /* 摇摆：复用 @keyframes sway；悬挂灯绕挂点摆，浮于水面的绕自身中心摆 */
      node.style.transformOrigin = l.floating ? '50% 50%' : '50% 0';
      if (!reduce) {
        node.style.animation = 'sway ' + SWAY_PERIOD + 's ease-in-out infinite';
        node.style.animationDelay = (-l.sway).toFixed(2) + 's';   // 负延迟 = 确定性相位偏移
      }

      node.style.transition = transitionCss();
      node.style.transitionDelay = l.delay.toFixed(2) + 's';      // 齐明的固定级联
      lamps.push({ node: node, data: l });
    }

    layoutFar();
    applyLampLight();
    return lamps.length;
  }

  /* 远景灯的 y 是「舞台高度的百分比」，而 .far-lamps 只是底部 64px 的带子，
     故 y% 必须换算成 px 的 bottom；舞台实测高为 0（视图未显示）时不写，
     等 main.js 切视图后调 resize() 再算。 */
  function layoutFar() {
    var stage = el('stage');
    if (!stage) { return false; }
    var h = stage.getBoundingClientRect().height;
    if (h < 1) { return false; }
    var i, rec;
    for (i = 0; i < lamps.length; i++) {
      rec = lamps[i];
      if (rec.data.layer !== 'far') { continue; }
      rec.node.style.bottom = (h * (1 - rec.data.y / 100)).toFixed(1) + 'px';
    }
    return true;
  }

  /* 大气透视 + §9.3 灯光增益：只在点亮态写入，未点亮时清空内联值，
     让 CSS 的剪影与「无光晕」原样生效。
     远景灯的光晕是 box-shadow，中/近景是 filter: drop-shadow —— 按 CSS 的
     基值乘以 halo × lampGlow，于是 halo=1、lampGlow=1 时与 style.css 逐字相同。 */
  function applyLampLight() {
    if (!lamps.length) { return; }
    readTokens();
    var lampGlow = current ? current.lampGlow : 1;
    var i, rec, l, tint, k, base;
    for (i = 0; i < lamps.length; i++) {
      rec = lamps[i];
      l = rec.data;
      tint = lampTint(l.warm, lampGlow);
      rec.node.style.setProperty('--lamp-warm', rgbCss(tint));   // 仅 is-lit 时被 CSS 取用
      if (!litOn) {
        rec.node.style.opacity = '';
        rec.node.style.boxShadow = '';
        rec.node.style.filter = '';
        continue;
      }
      k = l.halo * lampGlow;
      rec.node.style.opacity = String(l.bright);
      if (l.layer === 'far') {
        rec.node.style.boxShadow = '0 0 ' + (GLOW_FAR.blur * k).toFixed(1) + 'px ' +
          (GLOW_FAR.spread * k).toFixed(1) + 'px ' + rgbaCss(tint, GLOW_FAR.alpha * k);
      } else {
        base = l.layer === 'near' ? GLOW_FEST.near : GLOW_FEST.mid;
        rec.node.style.filter = 'drop-shadow(0 0 ' + (base.blur * k).toFixed(1) + 'px ' +
          rgbaCss(tint, base.alpha * k) + ')';
      }
    }
  }

  /* ============================================================
     4a. 放灯语境（§3）：挂架的枝架横杆 + 吊绳 + 成串成列的小灯，
         水放的水面 + 亮边 + 倒影 + 光斑。两套语境一次性建进容器，
         显隐交给 CSS 的 [data-placement] —— 切换时不重建 DOM，
         于是淡入动效与骨架几何都不会被打断。
         位置一律用 calc(var(--cy) ± …) 表达：--cy 已含该式的 LIFT，
         故语境元素与灯体永远同源对齐，舞台尺寸变了也不用重算。
      ============================================================ */
  function mk(cls) {
    var n = document.createElement('div');
    n.className = cls;
    return n;
  }

  function topFromLamp(px) {
    return 'calc(var(--cy) - var(--hh) - ' + px + 'px)';
  }

  function buildContext(host) {
    if (!host || host.childNodes.length) { return false; }

    var i, b, n;

    var hang = mk('ctx-hang');
    hang.appendChild(mk('hang-pole'));
    hang.appendChild(mk('hang-beam'));
    for (i = 0; i < HANG_BRANCHES.length; i++) {
      b = HANG_BRANCHES[i];
      n = mk('hang-branch');
      n.style.left = b.x + '%';
      n.style.transform = 'translateX(-50%) rotate(' + b.rot + 'deg)';
      hang.appendChild(n);
    }
    n = mk('hang-cord hang-cord-main');
    n.style.top = topFromLamp(48);
    hang.appendChild(n);
    for (i = 0; i < HANG_LAMPS.length; i++) {
      b = HANG_LAMPS[i];
      n = mk('hang-cord');
      n.style.left = b.x + '%';
      n.style.top = topFromLamp(48);
      n.style.height = b.cord + 'px';
      hang.appendChild(n);
      n = mk('hang-lamp');
      n.style.left = b.x + '%';
      n.style.top = 'calc(var(--cy) - var(--hh) - ' + (48 - b.cord) + 'px)';
      n.style.width = b.w + 'px';
      n.style.height = b.h + 'px';
      n.style.marginLeft = (-b.w / 2) + 'px';
      hang.appendChild(n);
    }
    host.appendChild(hang);

    var carry = mk('ctx-carry');
    for (i = 0; i < CARRY_LAMPS.length; i++) {
      b = CARRY_LAMPS[i];
      n = mk('carry-lamp');
      n.style.left = b.x + '%';
      n.style.bottom = b.y + 'px';
      n.style.width = b.w + 'px';
      n.style.height = b.h + 'px';
      n.style.marginLeft = (-b.w / 2) + 'px';
      carry.appendChild(n);
    }
    host.appendChild(carry);

    var array = mk('ctx-array');
    for (i = 0; i < ARRAY_LAMPS.length; i++) {
      b = ARRAY_LAMPS[i];
      n = mk('array-lamp');
      n.style.left = b.x + '%';
      n.style.top = b.y + '%';
      array.appendChild(n);
    }
    host.appendChild(array);
    return true;
  }

  /* 手法落到某个舞台：写 data-placement + --lift，补建语境容器，再同步骨架。
     --lift 只给画布（WebGL 灯面随灯体一起平移），骨架走含 LIFT 的 --cy。 */
  function applyPlacement(host) {
    var stage = el(host.stage);
    if (!stage) { return null; }
    var p = D.placementById(place[host.key]);
    place[host.key] = p.id;
    stage.setAttribute('data-placement', p.id);
    stage.style.setProperty('--lift', (LIFT[p.id] || 0) + 'px');
    buildContext(el(host.ctx));
    syncOne(host.stage, host.key);
    return p;
  }

  /* ============================================================
     4. 灯骨架几何：舞台实测尺寸 → --cx/--cy/--hw/--hh。
         换算走引擎的 geometryCss（与着色器的 LAMP_C/LAMP_HW/LAMP_HH 同源同值），
         两个容器尺寸不同，故各自独立计算。--cy 再叠上该式放灯的 LIFT，
         于是骨架四件与平移后的 WebGL 灯面仍然严丝合缝。
      ============================================================ */
  function syncOne(id, key) {
    var host = el(id);
    if (!host) { return null; }
    var r = host.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) { return null; }   // 视图 display:none → 留给 resize()
    var g = E.geometryCss(r.width, r.height);
    var lift = LIFT[place[key]] || 0;
    var cy = g.cy + lift;
    host.style.setProperty('--cx', g.cx.toFixed(1) + 'px');
    host.style.setProperty('--cy', cy.toFixed(1) + 'px');
    host.style.setProperty('--hw', g.hw.toFixed(1) + 'px');
    host.style.setProperty('--hh', g.hh.toFixed(1) + 'px');
    geo[key] = { cx: g.cx, cy: cy, hw: g.hw, hh: g.hh, lift: lift, w: r.width, h: r.height };
    return geo[key];
  }

  function syncRig() {
    syncOne('stage', 'create');
    syncOne('result-stage', 'result');
    return geo;
  }

  /* ============================================================
     5. §9.3 夜空环境光：把 PHASES[].sky 乘进夜空 token。
        写在视图节点上（自定义属性向下继承），于是只改夜空底色与天际线，
        不碰 WebGL 画布、不碰灯。sky=1.00（P1）时清空内联值，
        画面与已验证原型逐字一致。--horizon 一并缩放，天际线剪影才不会
        在暗档里反过来比夜空更亮。
     ============================================================ */
  function applySkyAmbient(phase) {
    var views = [], i, j, host, c;
    for (i = 0; i < AMBIENT_VIEWS.length; i++) {
      host = el(AMBIENT_VIEWS[i]);
      if (host) { views.push(host); }
    }
    for (i = 0; i < views.length; i++) {
      for (j = 0; j < SKY_TOKENS.length; j++) {
        if (phase.sky >= 1) { views[i].style.removeProperty(SKY_TOKENS[j]); continue; }
        c = gain(TOK.sky[SKY_TOKENS[j]], phase.sky);
        views[i].style.setProperty(SKY_TOKENS[j], rgbCss(c));
      }
    }
  }

  /* ============================================================
     6. 对外接口 (window.YDScene)
     ============================================================ */
  function setPhase(codeOrIndex) {
    readTokens();
    var phase = typeof codeOrIndex === 'number' ? D.phaseAt(codeOrIndex) : D.phaseByCode(codeOrIndex);
    current = phase;
    drawMoon(el('moon'), phase);
    drawMoon(el('result-moon'), phase);
    if (E && E.setMoon) { E.setMoon(phase.moon); }   // 引擎 uMoon = PHASES[].moon
    applySkyAmbient(phase);
    applyLampLight();                                // lampGlow 重写灯色与光晕
    return phase;
  }

  function setLit(on, stagger) {
    litOn = !!on;
    var i;
    for (i = 0; i < lamps.length; i++) {             // 级联延迟须在切类之前写
      lamps[i].node.style.transitionDelay =
        (stagger === false ? 0 : lamps[i].data.delay).toFixed(2) + 's';
    }
    var stage = el('stage');
    if (stage) { stage.classList.toggle('is-lit', litOn); }   // §9.2 背景灯随之齐明
    applyLampLight();
    return litOn;
  }

  function resize() {
    syncRig();
    layoutFar();
    return geo;
  }

  var Scene = {
    /* 建星野（#stars + #result-stars）、灯会盛景（26 盏）、初始月相 P1、同步骨架。
       幂等：重复调用不会重建已填充的容器。 */
    init: function () {
      readTokens();
      buildStars(el('stars'));
      buildStars(el('result-stars'));
      buildFestival();
      setPhase(D.PHASES[0].code);
      place.create = D.PLACEMENTS[0].id;
      place.result = D.PLACEMENTS[0].id;
      applyPlacement(PLACEMENT_HOSTS[0]);
      applyPlacement(PLACEMENT_HOSTS[1]);
      syncRig();
      return Scene;
    },

    /* 星野：单独重建（一般不用，init 已做）。返回星表条数。 */
    buildStars: function () {
      buildStars(el('stars'));
      buildStars(el('result-stars'));
      return D.STARS.length;
    },

    /* 灯会盛景：单独重建（一般不用，init 已做） */
    buildFestival: buildFestival,

    /* 月相：code 'P1'..'P5' 或 PHASES 下标；写 data-phase + --cover（两枚月），
       调引擎 setMoon(phase.moon)，并按 §9.3 改夜空环境光与灯光增益。
       返回该档 PHASES 条目（含 name / effect，供 main.js 更新按钮文案）。 */
    setPhase: setPhase,

    /* 月相循环：返回新档位 */
    nextPhase: function () {
      var i = 0, k;
      for (k = 0; k < D.PHASES.length; k++) { if (D.PHASES[k] === current) { i = k; break; } }
      return setPhase(D.phaseAt(i + 1).code);
    },

    /* 当前月相条目（只读） */
    phase: function () { return current; },

    /* 齐明：切 #stage 的 is-lit，并写入每盏灯的大气透视与灯光增益。
       stagger=false → 级联延迟一律取 0（严格同时齐明）。
       注意：引擎的 setLit(on) 由 main.js 另调，本函数只管 DOM。 */
    setLit: setLit,

    /* 是否齐明（只读） */
    lit: function () { return litOn; },

    /* 骨架几何同步：#stage 与 #result-stage 各算一次 */
    syncRig: syncRig,

    /* 放灯手法（§3）：'hang' | 'carry' | 'array'。
       写 data-placement + --lift，补建语境容器，再同步骨架几何。
       创作台与成品台各自一份 —— 成品台取存档里的那一式。 */
    setPlacement: function (id) {
      place.create = id;
      return applyPlacement(PLACEMENT_HOSTS[0]);
    },
    setResultPlacement: function (id) {
      place.result = id;
      return applyPlacement(PLACEMENT_HOSTS[1]);
    },

    /* 成品台的齐明态：只切 #result-stage 的 is-lit，
       水面倒影据此在「灯亮 → 倒影亮」之间呼应（§3 水放 desc）。 */
    setResultLit: function (on) {
      var host = el('result-stage');
      if (host) { host.classList.toggle('is-lit', !!on); }
      return !!on;
    },

    /* 当前放灯手法（只读）：'create' | 'result' */
    placement: function (key) { return place[key || 'create']; },

    /* 视口变化 / 切换视图后调用（视图隐藏时实测尺寸为 0，必须补调） */
    resize: resize,

    /* 骨架几何（只读）：'create' | 'result' */
    geometry: function (key) { return geo[key || 'create']; },

    /* 状态快照（只读；QA 用） */
    state: function () {
      var far = 0, mid = 0, near = 0, i;
      for (i = 0; i < lamps.length; i++) {
        if (lamps[i].data.layer === 'far') { far++; }
        else if (lamps[i].data.layer === 'mid') { mid++; }
        else { near++; }
      }
      return {
        phase: current ? current.code : null,
        phaseIndex: current ? D.PHASES.indexOf(current) : -1,
        cover: current ? (D.MOON_COVER[current.code] !== undefined
                          ? D.MOON_COVER[current.code] : current.cover) : null,
        moon: current ? current.moon : null,
        sky: current ? current.sky : null,
        lampGlow: current ? current.lampGlow : null,
        lit: litOn,
        stars: D.STARS.length,
        lamps: lamps.length, far: far, mid: mid, near: near,
        placement: place.create, resultPlacement: place.result,
        geometry: geo
      };
    }
  };

  window.YDScene = Scene;
})();
