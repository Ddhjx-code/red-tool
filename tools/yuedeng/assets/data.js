/* ============================================================
   月下灯会 · 数据层 (window.YDData)
   内容依据 docs/specs/2026-09-13-yuedeng-design.md §2 §3 §5 §9
   ------------------------------------------------------------
   确定性：全部为固定表，零随机、零网络引用、零外部依赖。
   色值与星表取自已验证原型 tools/yuedeng/prototype.html（锁定）。
   月相云带 MOON_COVER 与月宴同源（§4.3 要求复用月宴的月相渲染）。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 传统五色灯色（设计文档 §5；hex 为原型验证值，锁定） ----------
     warm / light 两个布尔位供 UI 渲染「2 浅 1 深 或 2 暖 1 冷」配色口诀：
     light=true → 浅色，warm=true → 暖色。 */
  var COLORS = [
    { id: 'yuebai',    name: '月白', en: 'MoonWhite', hex: '#DCE9E4', label: '月',
      warm: false, light: true,  desc: '月色微青之白，灯面留白处即此色，透出来是暖白的光' },
    { id: 'guijin',    name: '桂金', en: 'Osmanthus', hex: '#E8B84B', label: '桂',
      warm: true,  light: true,  desc: '八月桂花开时的金色，中秋灯会最常用的一色' },
    { id: 'zhusha',    name: '朱砂', en: 'Cinnabar',  hex: '#C9483C', label: '朱',
      warm: true,  light: false, desc: '朱砂红，灯笼喜庆纹样的正色，厚处透深红' },
    { id: 'qingjin',   name: '青金', en: 'Lapis',     hex: '#35619E', label: '青',
      warm: false, light: false, desc: '青金石之蓝，冷色，与桂金相对成「一暖一冷」' },
    { id: 'dailan',    name: '黛蓝', en: 'Indigo',    hex: '#2B3A55', label: '黛',
      warm: false, light: false, desc: '夜空最深的蓝，最深的一色，压住整盏灯的分量' }
  ];

  /* 配色口诀（§5）：初学不易翻车的两条规则 */
  var COLOR_RULES = {
    text: '配色口诀：2 浅 1 深，或 2 暖 1 冷，不易翻车。',
    lightDark: '2 浅 1 深',
    warmCool: '2 暖 1 冷',
    maxColors: 4,
    minColors: 2
  };

  /* ---------- 四种灯形（§3）：id 即引擎 SDF 权重混合所用的位序 ----------
     sdfIndex 对应 display 着色器 uShapeW 的 x/y/z/w 分量（0 圆 / 1 方 / 2 六角 / 3 莲花），
     glyph 为按钮上的轮廓图标（24×24 viewBox 路径，原型同值）。 */
  var SHAPES = [
    { id: 'round', name: '圆灯',   short: '圆', sdfIndex: 0,
      glyph: 'M12 3 A9 9 0 1 1 11.99 3 Z',
      desc: '最常见的一式，灯面鼓圆，受光均匀' },
    { id: 'square', name: '方灯',   short: '方', sdfIndex: 1,
      glyph: 'M5 5 H19 V19 H5 Z',
      desc: '骨架方正，四角圆润，纹样宜作几何' },
    { id: 'hexagon', name: '六角灯', short: '角', sdfIndex: 2,
      glyph: 'M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z',
      desc: '六片灯面拼成，竹篾骨条最显' },
    { id: 'lotus', name: '莲花灯', short: '莲', sdfIndex: 3,
      glyph: 'M12 3 C16 6 20 8 20 12 C20 17 16 21 12 21 C8 21 4 17 4 12 C4 8 8 6 12 3 Z',
      desc: '八瓣起伏如莲，中秋放灯水里的一式' }
  ];

  /* ---------- 三种放灯手法（§3） ---------- */
  var PLACEMENTS = [
    { id: 'hang',  name: '高挂',   short: '挂', desc: '树中秋 · 灯系竹竿，高树于瓦檐／天台／树上' },
    { id: 'carry', name: '手提',   short: '提', desc: '提灯之会 · 提灯沿街踏歌' },
    { id: 'array', name: '砌成字', short: '字', desc: '多盏灯砌成字形，高揭于家屋之高处' }
  ];

  /* ---------- 传统纹样（§2.5 / §3 彩绘·画纹） ----------
     中秋灯笼常见纹样为月、桂、兔、云、花鸟。纹样以 dye splat 形式落到灯面，
     于是天然融入流体系统：随染料轻微晕开、随灯体转动绕过去、点亮时一起透光。
     这是灯笼区别于漆扇的关键——漆扇只有抽象染料扩散，灯笼有可辨认的中秋纹样。 */
  var MOTIFS = [
    { id: 'moon',    name: '月',   desc: '月轮纹 · 中秋核心意象' },
    { id: 'gui',     name: '桂',   desc: '桂花纹 · 蟾宫折桂' },
    { id: 'tu',      name: '兔',   desc: '玉兔纹 · 民谣「八月十五玉兔灯」' },
    { id: 'yun',     name: '云',   desc: '流云纹 · 祥云缭绕' },
    { id: 'huaniao', name: '花鸟', desc: '花鸟纹 · 灯面常见题材' }
  ];

  /* ---------- 笔法（§3 彩绘） ----------
     勾线先定形，晕染后积韵 —— 与真实灯彩彩绘同序：细笔勾出纹样，
     湿笔罩染让色在纸里化开。两支笔写进同一层染料，区别只在笔锋粗细
     与带入的流速（见 engine.js 的 BRUSH 表）。 */
  var BRUSHES = [
    { id: 'line', name: '勾线', desc: '细笔定形 · 笔迹停得住，用来勾纹样' },
    { id: 'wash', name: '晕染', desc: '湿笔积韵 · 色随水走，用来做流动的色韵' }
  ];

  /* ---------- 五档月相（§4.3 / §9.3） ----------
     cover   = 云带高度 MOON_COVER，与月宴同源（月宴 scene.js / share.js 的
               MOON_COVER = {E1 0.00, E2 0.18, E3 0.35, E4 0.55, E5 0.75}），
               由 main.js 写入 CSS 自定义属性 --cover。
               （原型内曾微调为 0.00/0.16/0.34/0.54/0.74；此处依 §4.3「复用月宴
                 的月相渲染」取月宴的正典值，二者视觉差异 < 2%。）
     moon    = 月轮明度 0..1，喂给引擎的 uMoon（原型锁定值，不得改动）。
     lampGlow= §9.3 灯光增益：月越暗，灯的相对对比越强。
     sky     = §9.3 夜空环境光系数：P1 最亮 → P5 最暗。 */
  var PHASES = [
    { code: 'P1', name: '满月无云', cover: 0.00, moon: 1.00, lampGlow: 1.00, sky: 1.00,
      effect: '月主导，灯柔和' },
    { code: 'P2', name: '满月薄云', cover: 0.18, moon: 0.96, lampGlow: 1.08, sky: 0.85,
      effect: '月灯均衡' },
    { code: 'P3', name: '明月半云', cover: 0.35, moon: 0.88, lampGlow: 1.16, sky: 0.70,
      effect: '灯渐显' },
    { code: 'P4', name: '月出云中', cover: 0.55, moon: 0.76, lampGlow: 1.26, sky: 0.52,
      effect: '灯突出' },
    { code: 'P5', name: '薄云遮月', cover: 0.75, moon: 0.58, lampGlow: 1.35, sky: 0.34,
      effect: '灯主导，最戏剧' }
  ];

  /* 云带高度速查表（与月宴 MOON_COVER 同形，share.js 可直接取用） */
  var MOON_COVER = { P1: 0.00, P2: 0.18, P3: 0.35, P4: 0.55, P5: 0.75 };

  /* ---------- 文化知识（内容依据 §2 调研结论，真实文字，非占位） ---------- */
  var KNOWLEDGE = [
    {
      tag: '中秋灯会',
      text: '中秋赏月、观灯、放灯，是传统节令的核心活动之一。灯会起源可追溯至汉代，中秋灯会则盛于唐宋——其时街市悬灯成列，夜市通宵，月下观灯与赏月并行。'
    },
    {
      tag: '灯笼工艺',
      text: '传统灯笼以竹篾为骨、纸或绢为面，面上彩绘纹样，内置蜡烛。竹篾决定灯形（圆、方、六角、莲花），纸绢面即是画布，蜡烛在灯内——点亮之后光由内向外透出。'
    },
    {
      tag: '中秋纹样',
      text: '中秋灯笼常见纹样为月、桂、兔、云、花鸟。月与桂、兔取自月宫之说（嫦娥、玉兔、吴刚伐桂），云纹与花鸟则是吉祥纹样，绘在灯面上便随灯走街。'
    },
    {
      tag: '月与团圆',
      text: '月是中秋的核心意象，赏月是中秋的核心活动。月满象征团圆——「月圆人圆」，故中秋灯会始终以月为背景与焦点，灯是月下的色彩。'
    },
    {
      tag: '透光效应',
      text: '灯点亮后，烛火在灯内，彩绘灯面成了滤光片：颜料厚处吸收多，透出深而饱和的色光；颜料薄处让暖白烛光透过。纹样于是在光中显现，色彩在光中流变。'
    },
    {
      tag: '灯会盛景',
      text: '灯会之美在群灯齐明。远近三层，越远越暗越冷、越近越亮越暖，月下群灯与月色相映。月相越暗，灯的相对对比越强——薄云遮月之夜，灯会最见戏剧。'
    }
  ];

  /* ---------- 首页引言（首页视图用，三段） ---------- */
  var INTRO = [
    '中秋之夜，赏月、观灯、放灯。灯会起源可追溯汉代，盛于唐宋。',
    '灯笼以竹篾为骨、纸绢为面，彩绘纹样，内置蜡烛——灯面就是画布。',
    '灯点亮后光透过纹样：厚处透出深色，薄处透出暖白。这一盏灯，由你设计。'
  ];

  var TIPS = [
    '拖动灯面绘纹，彩漆自会扩散交织，可反复调整到满意。',
    '配色口诀：2 浅 1 深，或 2 暖 1 冷，不易翻车。',
    '点亮后光透过纹样——厚颜料色深，薄颜料光白。',
    '灯形可反复切换，换形是一次形变，不是一次跳变。',
    '月相越暗，灯越突出：薄云遮月时灯会最戏剧。'
  ];

  /* ---------- 灯名建议池（成品视图命名步骤；固定表，零随机） ----------
     取月、桂、灯三类中秋意象的古典称谓，全部为真实的传统词。 */
  var LAMP_NAMES = [
    '桂影', '月华', '流光', '团圆', '玉兔', '蟾光', '桂魄', '冰轮',
    '素娥', '广寒', '澄辉', '金波', '玉盘', '皓月', '清辉', '桂香',
    '灯影', '暖光', '流霞', '夜明', '星河', '云破', '半轮', '初盈',
    '望舒', '飞镜', '悬镜', '秋水'
  ];

  /* ---------- 灯会盛景固定表（§9.2）：26 盏背景灯，零随机 ----------
     三层景深：远景 14 盏（小，沿天际线屋檐悬挂）、中景 8 盏（中，挂于枝架）、
     近景 4 盏（大，部分浮于水面）。
     坐标约定：x = 舞台宽度的百分比（0..100）；y = 舞台高度自上而下的百分比（0..100）。
     scale    = 灯体尺寸倍率（× ENGINE.LAMP_BASE_PX）。
     bright   = 亮度 0..1；warm = 暖度 0..1 —— 大气透视：越远越暗越冷，越近越亮越暖。
     halo     = 柔和光晕强度 0..1（§9.2 每盏带柔和光晕）。
     sway     = 摇摆相位偏移（秒），喂给「时间是其唯一变量」的摇摆函数，零随机。
     delay    = 齐明的固定级联延迟（秒，≤0.55）；若要求严格同时齐明，main.js 可一律取 0。
     floating = 是否浮于水面（近景部分）。 */
  var LAMP_BASE_PX = 16;

  var FESTIVAL_LAMPS = [
    /* --- 远景 14 盏：沿屋檐成串，x 等距 7%，y 锁在 86..88 一行 --- */
    { id: 'f01', layer: 'far', x:  4, y: 87, scale: 0.50, bright: 0.42, warm: 0.28, halo: 0.30, sway: 0.0, delay: 0.00 },
    { id: 'f02', layer: 'far', x: 11, y: 86, scale: 0.54, bright: 0.46, warm: 0.32, halo: 0.34, sway: 0.4, delay: 0.02 },
    { id: 'f03', layer: 'far', x: 18, y: 87, scale: 0.50, bright: 0.40, warm: 0.26, halo: 0.30, sway: 0.9, delay: 0.04 },
    { id: 'f04', layer: 'far', x: 25, y: 88, scale: 0.56, bright: 0.48, warm: 0.34, halo: 0.36, sway: 1.3, delay: 0.06 },
    { id: 'f05', layer: 'far', x: 32, y: 87, scale: 0.52, bright: 0.44, warm: 0.30, halo: 0.32, sway: 1.8, delay: 0.08 },
    { id: 'f06', layer: 'far', x: 39, y: 86, scale: 0.58, bright: 0.50, warm: 0.36, halo: 0.38, sway: 2.2, delay: 0.10 },
    { id: 'f07', layer: 'far', x: 46, y: 87, scale: 0.50, bright: 0.42, warm: 0.28, halo: 0.30, sway: 2.7, delay: 0.12 },
    { id: 'f08', layer: 'far', x: 53, y: 88, scale: 0.56, bright: 0.48, warm: 0.34, halo: 0.36, sway: 3.1, delay: 0.14 },
    { id: 'f09', layer: 'far', x: 60, y: 87, scale: 0.54, bright: 0.46, warm: 0.32, halo: 0.34, sway: 3.6, delay: 0.16 },
    { id: 'f10', layer: 'far', x: 67, y: 86, scale: 0.60, bright: 0.52, warm: 0.38, halo: 0.40, sway: 4.0, delay: 0.18 },
    { id: 'f11', layer: 'far', x: 74, y: 87, scale: 0.50, bright: 0.40, warm: 0.26, halo: 0.30, sway: 4.5, delay: 0.20 },
    { id: 'f12', layer: 'far', x: 81, y: 88, scale: 0.52, bright: 0.44, warm: 0.30, halo: 0.32, sway: 4.9, delay: 0.22 },
    { id: 'f13', layer: 'far', x: 88, y: 87, scale: 0.62, bright: 0.54, warm: 0.40, halo: 0.42, sway: 5.4, delay: 0.24 },
    { id: 'f14', layer: 'far', x: 95, y: 86, scale: 0.54, bright: 0.46, warm: 0.32, halo: 0.34, sway: 5.8, delay: 0.26 },

    /* --- 中景 8 盏：分挂主灯两侧。主灯横向占 29%..71%，故中段必须留空，
       否则群灯会压在主灯上（这是原先「看不出是灯会」的原因之一）。 --- */
    { id: 'm01', layer: 'mid', x:  6, y: 60, scale: 1.00, bright: 0.70, warm: 0.56, halo: 0.54, sway: 0.6, delay: 0.28 },
    { id: 'm02', layer: 'mid', x: 13, y: 59, scale: 1.10, bright: 0.76, warm: 0.62, halo: 0.58, sway: 1.1, delay: 0.30 },
    { id: 'm03', layer: 'mid', x: 20, y: 60, scale: 0.96, bright: 0.68, warm: 0.54, halo: 0.52, sway: 1.6, delay: 0.32 },
    { id: 'm04', layer: 'mid', x: 26, y: 61, scale: 1.04, bright: 0.72, warm: 0.58, halo: 0.56, sway: 2.1, delay: 0.34 },
    { id: 'm05', layer: 'mid', x: 78, y: 60, scale: 1.14, bright: 0.78, warm: 0.64, halo: 0.60, sway: 2.6, delay: 0.36 },
    { id: 'm06', layer: 'mid', x: 85, y: 59, scale: 1.00, bright: 0.70, warm: 0.56, halo: 0.54, sway: 3.1, delay: 0.38 },
    { id: 'm07', layer: 'mid', x: 91, y: 60, scale: 1.08, bright: 0.74, warm: 0.60, halo: 0.58, sway: 3.6, delay: 0.40 },
    { id: 'm08', layer: 'mid', x: 97, y: 61, scale: 0.98, bright: 0.69, warm: 0.55, halo: 0.52, sway: 4.1, delay: 0.42 },

    /* --- 近景 4 盏：成排，y 锁在 93 一行，部分浮于水面 --- */
    { id: 'n01', layer: 'near', x: 15, y: 93, scale: 1.90, bright: 0.96, warm: 0.90, halo: 0.82, sway: 0.3, delay: 0.46, floating: true },
    { id: 'n02', layer: 'near', x: 38, y: 93, scale: 1.78, bright: 0.94, warm: 0.86, halo: 0.78, sway: 1.9, delay: 0.48, floating: false },
    { id: 'n03', layer: 'near', x: 62, y: 93, scale: 2.08, bright: 1.00, warm: 1.00, halo: 0.90, sway: 3.4, delay: 0.50, floating: true },
    { id: 'n04', layer: 'near', x: 85, y: 93, scale: 1.84, bright: 0.98, warm: 0.94, halo: 0.86, sway: 5.0, delay: 0.52, floating: false }
  ];

  /* ---------- 星：固定表，零随机（原型同值，30 条） ----------
     字段序：[x 百分比, y 百分比, 边长 px, 闪烁动画延迟 秒] */
  var STARS = [
    [ 7,  6, 2, 0.0], [16, 12, 1, 1.1], [25,  4, 2, 2.3], [33, 15, 1, 0.6],
    [43,  8, 2, 1.7], [54,  3, 1, 2.9], [62, 13, 2, 0.3], [71,  6, 1, 1.4],
    [80, 11, 2, 2.1], [89,  5, 1, 0.9], [11, 22, 1, 2.6], [21, 27, 2, 1.2],
    [30, 21, 1, 0.4], [39, 26, 2, 2.0], [49, 20, 1, 1.5], [58, 25, 2, 0.7],
    [67, 22, 1, 2.4], [76, 27, 2, 1.0], [85, 20, 1, 1.8], [93, 24, 2, 0.2],
    [ 4, 33, 1, 1.3], [14, 37, 2, 2.7], [24, 32, 1, 0.5], [69, 34, 2, 1.9],
    [79, 38, 1, 2.2], [90, 33, 2, 0.8], [36, 35, 1, 2.5], [55, 31, 2, 1.6],
    [46, 41, 1, 0.1], [63, 42, 1, 2.8]
  ];

  /* ---------- 工具函数（纯查表，零随机） ---------- */
  function hexToRgb(hex) {
    var v = parseInt(hex.slice(1), 16);
    return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
  }

  function colorById(id) {
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].id === id) return COLORS[i];
    return COLORS[0];
  }

  function shapeById(id) {
    for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i].id === id) return SHAPES[i];
    return SHAPES[0];
  }

  function placementById(id) {
    for (var i = 0; i < PLACEMENTS.length; i++) if (PLACEMENTS[i].id === id) return PLACEMENTS[i];
    return PLACEMENTS[0];
  }

  function phaseByCode(code) {
    for (var i = 0; i < PHASES.length; i++) if (PHASES[i].code === code) return PHASES[i];
    return PHASES[0];
  }

  function phaseAt(index) {
    return PHASES[index % PHASES.length];
  }

  function lampById(id) {
    for (var i = 0; i < FESTIVAL_LAMPS.length; i++) if (FESTIVAL_LAMPS[i].id === id) return FESTIVAL_LAMPS[i];
    return null;
  }

  /* 灯名：由 index 决定（main.js 传入创作选择的序号即可复现，零随机） */
  function nameAt(index) {
    var n = LAMP_NAMES.length;
    var i = ((index % n) + n) % n;
    return LAMP_NAMES[i];
  }

  /* 配色检查：返回所选色是否满足口诀（供 UI 提示，不做强制） */
  function checkPalette(ids) {
    var lightCount = 0, darkCount = 0, warmCount = 0, coolCount = 0;
    for (var i = 0; i < ids.length; i++) {
      var c = colorById(ids[i]);
      if (c.light) lightCount++; else darkCount++;
      if (c.warm) warmCount++; else coolCount++;
    }
    return {
      light: lightCount, dark: darkCount, warm: warmCount, cool: coolCount,
      lightDark: lightCount >= 2 && darkCount >= 1,
      warmCool: warmCount >= 2 && coolCount >= 1,
      passes: (lightCount >= 2 && darkCount >= 1) || (warmCount >= 2 && coolCount >= 1)
    };
  }

  /* 作品小记：一句话点评（由主色 + 灯形 + 月相生成，零随机） */
  function makeNote(mainColorId, shapeId, phaseCode) {
    var c = colorById(mainColorId);
    var s = shapeById(shapeId);
    var p = phaseByCode(phaseCode);
    return c.name + '为主 · ' + s.name + ' · ' + p.name + '之夜';
  }

  window.YDData = {
    SERIES: '非遗手作坊 · 第十八作',
    TITLE: '月下灯会',
    SUBTITLE: '彩绘灯纹 · 灯下透光',

    COLORS: COLORS,
    COLOR_RULES: COLOR_RULES,
    SHAPES: SHAPES,
    PLACEMENTS: PLACEMENTS,
    MOTIFS: MOTIFS,
    BRUSHES: BRUSHES,
    PHASES: PHASES,
    MOON_COVER: MOON_COVER,

    KNOWLEDGE: KNOWLEDGE,
    INTRO: INTRO,
    TIPS: TIPS,
    LAMP_NAMES: LAMP_NAMES,

    LAMP_BASE_PX: LAMP_BASE_PX,
    FESTIVAL_LAMPS: FESTIVAL_LAMPS,
    STARS: STARS,

    hexToRgb: hexToRgb,
    colorById: colorById,
    shapeById: shapeById,
    placementById: placementById,
    phaseByCode: phaseByCode,
    phaseAt: phaseAt,
    lampById: lampById,
    nameAt: nameAt,
    checkPalette: checkPalette,
    makeNote: makeNote
  };
})();
