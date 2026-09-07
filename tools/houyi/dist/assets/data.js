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

  /* ---------- 箭种类 ---------- */
  var ARROW_TYPES = {
    plain:  { name: '素缯', density: 0.0050, frictionAir: 0,    maxSpeed: 17.2, dmgMul: 1.0, special: null,    color: '#F2F0EA' },
    fire:   { name: '火箭', density: 0.0050, frictionAir: 0,    maxSpeed: 17.2, dmgMul: 1.0, special: 'fire',  color: '#FF6B2C', burnDmg: 3, burnTime: 300 },
    heavy:  { name: '重箭', density: 0.0125, frictionAir: 0.01, maxSpeed: 12.0, dmgMul: 1.5, special: null,    color: '#8A6238' },
    split:  { name: '裂箭', density: 0.0040, frictionAir: 0,    maxSpeed: 17.2, dmgMul: 0.6, special: 'split', color: '#4FD1E0', splitFrame: 30, splitAngle: 0.26 },
    pierce: { name: '穿云', density: 0.0060, frictionAir: 0,    maxSpeed: 17.2, dmgMul: 1.0, special: 'pierce', color: '#FFD86B', pierceCount: 1 }
  };

  /* ---------- 敌人种类 ---------- */
  var ENEMY_TYPES = {
    jinwu:    { name: '金乌', hp: 14, radius: 20, scale: 1.7, behavior: 'perch',  color: '#E0512B', score: 120 },
    qingniao: { name: '青鸟', hp: 10, radius: 16, scale: 1.4, behavior: 'patrol', color: '#3A8FB7', score: 100, patrolSpeed: 1.5, patrolRange: 80 },
    zhuque:   { name: '朱雀', hp: 35, radius: 22, scale: 2.0, behavior: 'perch',  color: '#C03028', score: 200 },
    bifang:   { name: '毕方', hp: 22, radius: 20, scale: 1.6, behavior: 'perch',  color: '#4A6B3A', score: 150, deathExplosion: { r: 60, dmg: 40 } }
  };

  /* ---------- 墙/结构种类 ---------- */
  var WALL_TYPES = {
    fusan:   { name: '扶桑木', hp: 45,  density: 0.0018, friction: 0.85, frictionStatic: 1.0, restitution: 0.02, fireResist: false, shardOnBreak: false },
    bronze:  { name: '青铜柱', hp: 200, density: 0.0040, friction: 0.60, frictionStatic: 0.8, restitution: 0.01, fireResist: true,  shardOnBreak: false },
    glaze:   { name: '琉璃墙', hp: 30,  density: 0.0020, friction: 0.50, frictionStatic: 0.7, restitution: 0.01, fireResist: false, shardOnBreak: true,  shardCount: 5 },
    vine:    { name: '藤蔓',   hp: 20,  density: 0.0010, friction: 0.90, frictionStatic: 1.0, restitution: 0.40, fireResist: false, shardOnBreak: false, arrowSlow: 0.5 }
  };

  /* ---------- 成就 ---------- */
  var ACHIEVEMENTS = {
    first_shot:   { name: '初射日',     desc: '通关第一关',              myth: '尧乃使羿，上射十日' },
    nine_down:    { name: '九乌俱落',   desc: '射落九日',                myth: '中其九日，日中九乌皆死' },
    one_sun:      { name: '留一日',     desc: '通关留一日模式',          myth: '羿留一日，天下复有昼夜' },
    all_stars:    { name: '一弓定天',   desc: '全关三星',                myth: '帝俊赐羿彤弓素缝' },
    long_shot:    { name: '百步穿杨',   desc: '800px外射杀敌人',         myth: '养由基百步穿杨' },
    chain_kill:   { name: '连珠箭',     desc: '一箭击杀两只敌人',        myth: '连珠箭法，一矢双雕' },
    efficiency:   { name: '不射之射',   desc: '通关时剩余三支以上',      myth: '列子载：不射之射' },
    fire_master:  { name: '火神之怒',   desc: '火箭累计击杀五只敌人',    myth: '祝融降火，火神之怒' },
    destroyer:    { name: '扶桑倾颓',   desc: '累计摧毁五十个结构',      myth: '汤谷扶桑，倾颓九枝' },
    pierce_kill:  { name: '贯日长虹',   desc: '穿云箭一箭击杀两只敌人',  myth: '白虹贯日' },
    bifang_blast: { name: '雷殛',       desc: '毕方爆炸击杀另一敌人',    myth: '毕方现，则有雷电' },
    grandmaster:  { name: '射神',       desc: '获得全部其他成就',        myth: '后羿封神，万世传颂' }
  };

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
      goal: 'birds', arrows: 5, arrowLoad: ['plain','plain','plain','plain','plain'],
      brief: '扶桑一枝，一金乌栖于枝顶。拉杆瞄准，金线为箭的抛物线，松手放箭。',
      lore: '十日并出，焦禾稼，杀草木。尧乃使羿，上射十日。',
      blocks: [
        { shape: 'trunkH132', x: 760, y: 624 },
        { shape: 'beamW140', x: 760, y: 548 }
      ],
      suns: [],
      birds: [{ x: 760, perchY: 538, type: 'jinwu' }],
      knowledge: { tag: '后羿射日', text: '《淮南子·本经训》记「尧乃使羿……上射十日而下杀猰貐」。羿所射者是十日之中的九日，留一日以照人间。' }
    },
    {
      id: 'l2', order: '第二关', name: '再落二乌',
      goal: 'birds', arrows: 5, arrowLoad: ['plain','plain','plain','plain','plain'],
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
      birds: [{ x: 600, perchY: 554, type: 'jinwu' }, { x: 1080, perchY: 554, type: 'jinwu' }],
      knowledge: { tag: '金乌 · 三足乌', text: '《淮南子·精神训》「日中有踆乌」，郭璞注「中有三足乌」。古人把太阳里的黑子想象成一只神鸟，故称日中金乌。' }
    },
    {
      id: 'l3', order: '第三关', name: '扶桑初崩',
      goal: 'birds', arrows: 5, arrowLoad: ['plain','plain','plain','fire','fire'],
      brief: '火箭可点燃扶桑木——命中后灼烧五秒，火势蔓延。射断枝干让整座扶桑自己倾颓。',
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
      birds: [{ x: 820, perchY: 414, type: 'jinwu' }, { x: 1140, perchY: 554, type: 'jinwu' }],
      knowledge: { tag: '扶桑树 · 世界树', text: '《山海经·海外东经》「汤谷上有扶桑，十日所浴……九日居下枝，一日居上枝」。扶桑是十日栖息的世界树。' }
    },
    {
      id: 'l4', order: '第四关', name: '彤弓仰射',
      goal: 'birds', arrows: 5, arrowLoad: ['plain','plain','heavy','heavy','fire'],
      brief: '重箭沉重有力，可一举击碎扶桑枝干。金乌栖于高枝，需仰射。拉满弓，轨迹金线会告诉你箭会落在哪里。',
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
      birds: [{ x: 860, perchY: 306, type: 'jinwu' }, { x: 540, perchY: 554, type: 'jinwu' }],
      knowledge: { tag: '彤弓素缯', text: '《山海经·海内经》「帝俊赐羿彤弓素缯，以扶下国」。彤弓是红漆之弓，素缯是白羽之箭——上古射礼中的重器。' }
    },
    {
      id: 'l5', order: '第五关', name: '青鸟掠空',
      goal: 'birds', arrows: 5, arrowLoad: ['plain','plain','heavy','fire','fire'],
      brief: '青鸟会在栖点间水平移动，需预判。藤蔓柔韧，箭穿过会被减速。',
      lore: '青鸟者，西王母之使也。百鸟之群，莫敢与争。',
      blocks: [
        { shape: 'trunkH132', x: 700, y: 624 },
        { shape: 'beamW140', x: 700, y: 548 },
        { shape: 'trunkH132', x: 1000, y: 624 },
        { shape: 'beamW140', x: 1000, y: 548 },
        { shape: 'beamW290', x: 850, y: 660, wallType: 'vine' }
      ],
      suns: [],
      birds: [{ x: 700, perchY: 538, type: 'jinwu' }, { x: 1000, perchY: 538, type: 'qingniao', patrolCenter: 1000, patrolRange: 80 }],
      knowledge: { tag: '青鸟', text: '《山海经·西山经》「又西二百二十里，曰三危之山……有鸟焉，其状如鸮而青羽赤喙，名曰青鸟」。青鸟是西王母的信使。' }
    },
    {
      id: 'l6', order: '第六关', name: '青铜之坚',
      goal: 'birds', arrows: 5, arrowLoad: ['plain','plain','split','split','fire'],
      brief: '青铜柱极硬，普通箭矢难伤。裂箭飞行后分裂为三支——可以绕过青铜柱击中后方的金乌。',
      lore: '黄帝采首山之铜，铸鼎于荆山之下。青铜者，金石之坚。',
      blocks: [
        { shape: 'trunkH132', x: 560, y: 624 },
        { shape: 'beamW140', x: 560, y: 548 },
        { shape: 'trunkH132', x: 860, y: 624 },
        { shape: 'beamW140', x: 860, y: 548 },
        { shape: 'trunkH132', x: 1160, y: 624 },
        { shape: 'beamW140', x: 1160, y: 548 },
        { shape: 'beamW230', x: 860, y: 690, wallType: 'bronze' }
      ],
      suns: [{ x: 860, y: 664, r: 26 }],
      birds: [{ x: 560, perchY: 538, type: 'jinwu' }, { x: 1160, perchY: 538, type: 'jinwu' }],
      knowledge: { tag: '青铜时代', text: '中国青铜时代始于夏代。后羿所处的上古传说时代虽早于青铜冶炼，但青铜器作为礼器与兵器，承载了上古王权与神话的意象。' }
    },
    {
      id: 'l7', order: '第七关', name: '琉璃碎影',
      goal: 'birds', arrows: 5, arrowLoad: ['plain','split','split','pierce','heavy'],
      brief: '琉璃墙薄而易碎，碎裂后产生碎片可砸落金乌。朱雀体壮，需数箭。穿云箭可穿透一个结构后继续飞行。',
      lore: '琉璃者，销石为质，熔冶而成。佛家七宝之一。',
      blocks: [
        { shape: 'trunkH132', x: 600, y: 624 },
        { shape: 'beamW140', x: 600, y: 548 },
        { shape: 'trunkH132', x: 1100, y: 624 },
        { shape: 'beamW140', x: 1100, y: 548 },
        { shape: 'beamW140', x: 850, y: 660, wallType: 'glaze' },
        { shape: 'trunkH98', x: 850, y: 620, wallType: 'bronze' }
      ],
      suns: [],
      birds: [{ x: 600, perchY: 538, type: 'jinwu' }, { x: 1100, perchY: 538, type: 'zhuque' }],
      knowledge: { tag: '朱雀', text: '《淮南子·天文训》「南方火也，其帝炎帝，其佐朱明……其兽朱鸟」。朱雀为四象之一，南方火神之象。' }
    },
    {
      id: 'l8', order: '第八关', name: '朱雀涅槃',
      goal: 'birds', arrows: 5, arrowLoad: ['plain','split','pierce','fire','fire'],
      brief: '两只朱雀栖息于琉璃墙后。火箭点燃琉璃墙后的扶桑，穿云箭贯穿琉璃直击朱雀。',
      lore: '凤凰火精，生丹穴。自焚为灰，复活再生——是谓涅槃。',
      blocks: [
        { shape: 'trunkH132', x: 540, y: 624 },
        { shape: 'beamW140', x: 540, y: 548 },
        { shape: 'trunkH132', x: 1060, y: 624 },
        { shape: 'beamW140', x: 1060, y: 548 },
        { shape: 'beamW140', x: 800, y: 660, wallType: 'glaze' },
        { shape: 'beamW140', x: 800, y: 640, wallType: 'glaze' }
      ],
      suns: [],
      birds: [{ x: 540, perchY: 538, type: 'zhuque' }, { x: 1060, perchY: 538, type: 'zhuque' }],
      knowledge: { tag: '涅槃', text: '佛教传入后，朱雀与凤凰、涅槃之鸟相融合。郭璞注《尔雅》称凤凰「出于东方君子之国」，与火德相应。' }
    },
    {
      id: 'l9', order: '第九关', name: '九日俱落',
      goal: 'birds', arrows: 5, arrowLoad: ['plain','split','pierce','heavy','fire'],
      brief: '此关落下第九只金乌。毕方死亡时爆炸伤及周围。日轮、立枝、横枝交叠，一箭可引发连锁倾颓。',
      lore: '羿仰射十日，中其九日，日中九乌皆死，堕其羽翼。',
      blocks: [
        { shape: 'trunkH132', x: 760, y: 624 },
        { shape: 'trunkH132', x: 960, y: 624 },
        { shape: 'beamW290', x: 860, y: 546 },
        { shape: 'trunkH98', x: 818, y: 485 },
        { shape: 'trunkH98', x: 902, y: 485 },
        { shape: 'beamW230', x: 860, y: 425 },
        { shape: 'trunkH116', x: 560, y: 632 },
        { shape: 'beamW140', x: 560, y: 564 },
        { shape: 'beamW140', x: 860, y: 660, wallType: 'bronze' },
        { shape: 'beamW140', x: 860, y: 640, wallType: 'vine' }
      ],
      suns: [{ x: 860, y: 664, r: 26 }, { x: 470, y: 664, r: 26 }, { x: 860, y: 512, r: 22 }],
      birds: [
        { x: 860, perchY: 414, type: 'jinwu' },
        { x: 560, perchY: 554, type: 'qingniao', patrolCenter: 560, patrolRange: 60 },
        { x: 1120, perchY: 590, type: 'zhuque' },
        { x: 380, perchY: 590, type: 'bifang' }
      ],
      knowledge: { tag: '射九日 · 留一日', text: '王逸注《楚辞·天问》「羿仰射十日，中其九日，日中九乌皆死，堕其羽翼」。九日既落，一日独存，人间重见昼夜。' }
    },
    {
      id: 'l10', order: '终关', name: '留一日照人间',
      goal: 'spare', arrows: 5, arrowLoad: ['plain','plain','plain','pierce','plain'],
      brief: '最后一只金乌栖于上枝——它不能再射。射落地上两枚余烬日轮，留住这一日。误伤金乌，则十日俱灭。',
      lore: '九日居下枝，一日居上枝。羿留一日，天下复有昼夜。',
      blocks: [
        { shape: 'trunkH132', x: 880, y: 624 },
        { shape: 'beamW230', x: 880, y: 547 },
        { shape: 'trunkH98', x: 880, y: 487 },
        { shape: 'beamW140', x: 880, y: 428 }
      ],
      suns: [{ x: 520, y: 664, r: 24 }, { x: 1080, y: 664, r: 24 }],
      birds: [{ x: 880, perchY: 418, spare: true, type: 'jinwu' }],
      knowledge: { tag: '三星堆青铜神树', text: '四川广汉三星堆出土的一号青铜神树，三层九枝、枝上立鸟，被学界视为扶桑神话的实物佐证——「九日居下枝，一日居上枝」。' }
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
    ARROW_TYPES: ARROW_TYPES, ENEMY_TYPES: ENEMY_TYPES, WALL_TYPES: WALL_TYPES,
    ACHIEVEMENTS: ACHIEVEMENTS,
    SERIES: SERIES, SUBTITLE: SUBTITLE, INTRO: INTRO,
    LEVELS: LEVELS, NAME_POOL: NAME_POOL,
    SUNS_TOTAL: 10, SUNS_TO_SHOOT: 9
  };
})();
