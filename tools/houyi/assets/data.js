/* ============================================================
   后羿射日 · 数据层 (window.HYData)
   SHAPES = 手工轮廓顶点集（与 prototype.html 逐字一致，物理内核契约）
   每个凸块必须是凸多边形：Matter.js 0.19 未内建 poly-decomp，
   凹轮廓会被静默 hull 成包围多边形 —— 那正是「幽灵碰撞区」的成因。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 世界 / 弓 / 物理常量（与 prototype.html 完全一致） ---------- */
  var WORLD_W = 1280, WORLD_H = 720;
  var GROUND_Y = 690;
  var STEP = 1000 / 60;                 // 固定步长（轨迹预览确定性）
  var ANCHOR = { x: 152, y: 538 };      // 彤弓锚点
  var MAX_PULL = 140;                   // 最大拉距 px
  var POWER_SCALE = 0.122;              // 拉距 -> 速度
  var MAX_SPEED = 17.2;                 // 箭速封顶（防穿透，Matter 无 CCD）
  var DAMAGE_SCALE = 6;                 // 伤害 = 相对速度 * 系数
  var MIN_IMPACT = 2.0;                 // 低于此冲击不结算（静置接触）
  var ARROWS_PER_LEVEL = 5;
  var BIRD_SCALE = 1.7;

  var HP = { fusan: 45, rilun: 130, jinwu: 14 };   // 扶桑低 / 日轮高 / 金乌一击

  /* ---------- 手工轮廓顶点（每块必须是凸多边形） ---------- */
  var SHAPES = {
    // ---- 金乌（三足乌）朝左：鸟身 + 颈 + 头 + 喙 + 尾 + 翼 + 三足 ----
    jinwu: {
      body: [[-18, -10], [-10, -14], [8, -14], [17, -8], [18, 3], [13, 13], [0, 16], [-13, 13], [-18, 4]],
      neck: [[-14, -9], [-4, -14], [-20, -27], [-28, -19]],
      head: [[-33, -33], [-23, -35], [-19, -27], [-23, -20], [-31, -22]],
      beak: [[-41, -28], [-33, -31], [-33, -24]],
      tail: [[13, -13], [22, -22], [38, -34], [36, -16], [20, -6]],
      wing: [[-10, -11], [2, -15], [14, -10], [12, 2], [-6, 3]],
      leg1: [[-11, 12], [-5, 12], [-5, 28], [-11, 28]],
      leg2: [[-2, 13], [4, 13], [4, 28], [-2, 28]],
      leg3: [[7, 12], [13, 12], [13, 28], [7, 28]]
    },
    // ---- 扶桑树·立枝（收腰 -> 非矩形；上下端平整 -> 可堆叠）----
    trunkH132: {
      top: [[-13, -66], [13, -66], [13, -26], [-13, -26]],
      mid: [[-7, -26], [9, -26], [11, 26], [-5, 26]],
      bot: [[-13, 26], [13, 26], [13, 66], [-13, 66]]
    },
    trunkH116: {
      top: [[-13, -58], [13, -58], [13, -23], [-13, -23]],
      mid: [[-7, -23], [9, -23], [11, 23], [-5, 23]],
      bot: [[-13, 23], [13, 23], [13, 58], [-13, 58]]
    },
    trunkH98: {
      top: [[-13, -49], [13, -49], [13, -19], [-13, -19]],
      mid: [[-7, -19], [9, -19], [11, 19], [-5, 19]],
      bot: [[-13, 19], [13, 19], [13, 49], [-13, 49]]
    },
    // ---- 扶桑树·横枝（节瘤顶 -> 非矩形；两端平整 -> 可堆叠）----
    beamW290: {
      slab: [[-145, -12], [145, -12], [145, 12], [-145, 12]],
      knotA: [[52, -12], [96, -12], [89, -20], [59, -20]],
      knotB: [[-118, -12], [-78, -12], [-84, -18], [-112, -18]]
    },
    beamW230: {
      slab: [[-115, -11], [115, -11], [115, 11], [-115, 11]],
      knotA: [[38, -11], [80, -11], [74, -18], [44, -18]],
      knotB: [[-96, -11], [-58, -11], [-63, -17], [-90, -17]]
    },
    beamW140: {
      slab: [[-70, -10], [70, -10], [70, 10], [-70, 10]],
      knotA: [[22, -10], [58, -10], [53, -16], [27, -16]],
      knotB: [[-58, -10], [-26, -10], [-31, -15], [-53, -15]]
    },
    // ---- 箭（素缯）：细长，非宽矩形 ----
    arrow: {
      head:   [[27, 0], [18, -4.6], [18, 4.6]],
      shaft:  [[19, -1.7], [-17, -2.3], [-17, 2.3], [19, 1.7]],
      fletch: [[-17, -4.2], [-17, 4.2], [-25, 0]]
    }
  };

  var PART_ROLES = {
    jinwu: ['body', 'neck', 'head', 'beak', 'tail', 'wing', 'leg1', 'leg2', 'leg3']
  };

  /* ---------- 国风配色（金红 / 青黑 / 深褐古木） ---------- */
  var C = {
    skyTop: '#0B1524', skyMid: '#16293F', skyGlow: '#4A2A26', horizon: '#7A3A22',
    ground: '#241A13', groundTop: '#4A3524',
    jinwuBody: '#E0512B', jinwuWing: '#F0A034', jinwuHead: '#F5C542',
    jinwuBeak: '#FFDE7A', jinwuLeg: '#B93A22', jinwuEye: '#170D08', jinwuFlame: '#FF7A3C',
    jinwuNeck: '#D2451F', jinwuTail: '#EE7A2E',
    rilunRing: '#F5C542', rilunCore: '#E08A18', rilunRay: '#FFF0BC',
    bark: '#6B4A2F', barkDark: '#4E3520', barkLight: '#8A6238', moss: '#4E6B3A', knot: '#8A6238',
    arrowShaft: '#F2F0EA', arrowHead: '#C9CDD4', arrowFletch: '#DCD6C6',
    bow: '#C3272B', bowDark: '#8E1C20', string: '#F4E7C6',
    traj: '#FFD86B',
    dbgPoly: '#4FD1E0', dbgBox: '#FF4FD8', dbgGhost: 'rgba(255,79,216,0.30)'
  };

  /* ---------- 首页文案 ---------- */
  var SERIES = '非遗手作坊 · 上古神话';
  var SUBTITLE = '彤弓素缯 · 上射十日';
  var INTRO = [
    '《淮南子·本经训》：「尧之时，十日并出，焦禾稼，杀草木，而民无所食……尧乃使羿，上射十日而下杀猰貐。」',
    '十日是帝俊与羲和之子，化作三足金乌，栖于汤谷之上的扶桑神树——「九日居下枝，一日居上枝」。',
    '帝俊赐羿彤弓素缯，以扶下国。羿仰射十日，中其九日，日中九乌皆死，堕其羽翼——留一日照人间。'
  ];

  /* ---------- 关卡 ----------
     blocks: 扶桑枝干（shape + 位置）    suns: 日轮（圆碰撞体）
     birds : 金乌栖息点（perchY = 枝顶 y，引擎自动减去足尖偏移，零间隙接触）
     goal  : 'birds' = 射落全部金乌过关
             'spare' = 射落全部余烬日轮、且必须留住最后一只金乌
     坐标全部按 SHAPES 半高精确对齐（零间隙堆叠）：
       trunkH132 hh=66 / trunkH116 hh=58 / trunkH98 hh=49
       beamW290 slab hh=12 / beamW230 slab hh=11 / beamW140 slab hh=10
  ---------------------------------------------------------------- */
  var LEVELS = [
    {
      id: 'l1', order: '第一关', name: '初射一日',
      goal: 'birds', arrows: ARROWS_PER_LEVEL,
      brief: '扶桑一枝，一金乌栖于枝顶。拉杆瞄准，金线为箭的抛物线，松手放箭。',
      lore: '十日并出，焦禾稼，杀草木。尧乃使羿，上射十日。',
      blocks: [
        { shape: 'trunkH132', x: 760, y: 624 },
        { shape: 'beamW140', x: 760, y: 548 }
      ],
      suns: [],
      birds: [{ x: 760, perchY: 538 }],
      knowledge: {
        tag: '后羿射日',
        text: '《淮南子·本经训》记「尧乃使羿……上射十日而下杀猰貐」。羿所射者是十日之中的九日，留一日以照人间。'
      }
    },
    {
      id: 'l2', order: '第二关', name: '再落二乌',
      goal: 'birds', arrows: ARROWS_PER_LEVEL,
      brief: '左右两枝各栖一金乌。可以直射金乌，也可以射断枝干，让结构自己塌下来砸落它。',
      lore: '日中有踆乌。十日是帝俊与羲和之子，金乌化身，三足太阳神鸟。',
      blocks: [
        { shape: 'trunkH116', x: 600, y: 632 },
        { shape: 'beamW140', x: 600, y: 564 },
        { shape: 'trunkH116', x: 1080, y: 632 },
        { shape: 'beamW140', x: 1080, y: 564 },
        { shape: 'trunkH98', x: 840, y: 641 }
      ],
      suns: [{ x: 840, y: 566, r: 26 }],
      birds: [{ x: 600, perchY: 554 }, { x: 1080, perchY: 554 }],
      knowledge: {
        tag: '金乌 · 三足乌',
        text: '《淮南子·精神训》「日中有踆乌」，郭璞注「中有三足乌」。古人把太阳里的黑子想象成一只神鸟，故称日中金乌。'
      }
    },
    {
      id: 'l3', order: '第三关', name: '扶桑初崩',
      goal: 'birds', arrows: ARROWS_PER_LEVEL,
      brief: '日轮夹在两枝之间，日轮坚硬（高 HP）。射断下层立枝，整座扶桑会自己倾颓。',
      lore: '汤谷上有扶桑，十日所浴，在黑齿北。居水中，有大木。',
      blocks: [
        { shape: 'trunkH132', x: 700, y: 624 },
        { shape: 'trunkH132', x: 940, y: 624 },
        { shape: 'beamW290', x: 820, y: 546 },
        { shape: 'trunkH98', x: 778, y: 485 },
        { shape: 'trunkH98', x: 862, y: 485 },
        { shape: 'beamW230', x: 820, y: 425 },
        { shape: 'trunkH116', x: 1140, y: 632 },
        { shape: 'beamW140', x: 1140, y: 564 }
      ],
      suns: [{ x: 820, y: 664, r: 26 }, { x: 820, y: 512, r: 22 }],
      birds: [{ x: 820, perchY: 414 }, { x: 1140, perchY: 554 }],
      knowledge: {
        tag: '扶桑树 · 世界树',
        text: '《山海经·海外东经》「汤谷上有扶桑，十日所浴……九日居下枝，一日居上枝」。扶桑是十日栖息的世界树。'
      }
    },
    {
      id: 'l4', order: '第四关', name: '彤弓仰射',
      goal: 'birds', arrows: ARROWS_PER_LEVEL,
      brief: '金乌栖于扶桑高枝，需仰射。拉满弓，轨迹金线会告诉你箭会落在哪里。',
      lore: '帝俊赐羿彤弓素缯，以扶下国。彤弓者，赤弓；素缯者，白箭。',
      blocks: [
        { shape: 'trunkH132', x: 720, y: 624 },
        { shape: 'trunkH132', x: 1000, y: 624 },
        { shape: 'beamW290', x: 860, y: 546 },
        { shape: 'trunkH98', x: 818, y: 485 },
        { shape: 'trunkH98', x: 902, y: 485 },
        { shape: 'beamW230', x: 860, y: 425 },
        { shape: 'trunkH98', x: 860, y: 375 },
        { shape: 'beamW140', x: 860, y: 316 },
        { shape: 'trunkH116', x: 540, y: 632 },
        { shape: 'beamW140', x: 540, y: 564 }
      ],
      suns: [{ x: 860, y: 664, r: 26 }, { x: 860, y: 512, r: 22 }],
      birds: [{ x: 860, perchY: 306 }, { x: 540, perchY: 554 }],
      knowledge: {
        tag: '彤弓素缯',
        text: '《山海经·海内经》「帝俊赐羿彤弓素缯，以扶下国」。彤弓是红漆之弓，素缯是白羽之箭——上古射礼中的重器。'
      }
    },
    {
      id: 'l5', order: '第五关', name: '九日俱落',
      goal: 'birds', arrows: ARROWS_PER_LEVEL,
      brief: '此关落下第九只金乌。日轮、立枝、横枝交叠，一箭可引发连锁倾颓。',
      lore: '羿仰射十日，中其九日，日中九乌皆死，堕其羽翼。',
      blocks: [
        { shape: 'trunkH132', x: 760, y: 624 },
        { shape: 'trunkH132', x: 960, y: 624 },
        { shape: 'beamW290', x: 860, y: 546 },
        { shape: 'trunkH98', x: 818, y: 485 },
        { shape: 'trunkH98', x: 902, y: 485 },
        { shape: 'beamW230', x: 860, y: 425 },
        { shape: 'trunkH116', x: 560, y: 632 },
        { shape: 'beamW140', x: 560, y: 564 }
      ],
      suns: [{ x: 860, y: 664, r: 26 }, { x: 470, y: 664, r: 26 }, { x: 860, y: 512, r: 22 }],
      birds: [{ x: 860, perchY: 414 }, { x: 560, perchY: 554 }],
      knowledge: {
        tag: '射九日 · 留一日',
        text: '王逸注《楚辞·天问》「羿仰射十日，中其九日，日中九乌皆死，堕其羽翼」。九日既落，一日独存，人间重见昼夜。'
      }
    },
    {
      id: 'l6', order: '终关', name: '留一日照人间',
      goal: 'spare', arrows: ARROWS_PER_LEVEL,
      brief: '最后一只金乌栖于上枝——它不能再射。射落地上三枚余烬日轮，留住这一日。误伤金乌，则十日俱灭。',
      lore: '九日居下枝，一日居上枝。羿留一日，天下复有昼夜。',
      blocks: [
        { shape: 'trunkH132', x: 880, y: 624 },
        { shape: 'beamW230', x: 880, y: 547 },
        { shape: 'trunkH98', x: 880, y: 487 },
        { shape: 'beamW140', x: 880, y: 428 }
      ],
      suns: [{ x: 520, y: 664, r: 24 }, { x: 1080, y: 664, r: 24 }],
      birds: [{ x: 880, perchY: 418, spare: true }],
      knowledge: {
        tag: '三星堆青铜神树',
        text: '四川广汉三星堆出土的一号青铜神树，三层九枝、枝上立鸟，被学界视为扶桑神话的实物佐证——「九日居下枝，一日居上枝」。'
      }
    }
  ];

  /* ---------- 战绩起名备选 ---------- */
  var NAME_POOL = [
    '彤弓一号', '素缯破晓', '落乌九章', '汤谷长箭', '扶桑倾枝',
    '仰射十日', '一日独明', '金乌坠羽', '九乌既殒', '昼夜重开'
  ];

  window.HYData = {
    WORLD_W: WORLD_W, WORLD_H: WORLD_H, GROUND_Y: GROUND_Y, STEP: STEP,
    ANCHOR: ANCHOR, MAX_PULL: MAX_PULL, POWER_SCALE: POWER_SCALE, MAX_SPEED: MAX_SPEED,
    DAMAGE_SCALE: DAMAGE_SCALE, MIN_IMPACT: MIN_IMPACT,
    ARROWS_PER_LEVEL: ARROWS_PER_LEVEL, BIRD_SCALE: BIRD_SCALE,
    HP: HP, SHAPES: SHAPES, PART_ROLES: PART_ROLES, C: C,
    SERIES: SERIES, SUBTITLE: SUBTITLE, INTRO: INTRO,
    LEVELS: LEVELS, NAME_POOL: NAME_POOL,
    SUNS_TOTAL: 10, SUNS_TO_SHOOT: 9
  };
})();
