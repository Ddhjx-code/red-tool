(function () {
  'use strict';
  window.YueYan = window.YueYan || {};

  var Data = {
    version: 1,

    // §3.1 盘面
    board: { days: 7, slotsPerDay: 3, totalSlots: 21, cakeCap: 5 },
    initial: { silver: 44, putong: 4 },
    stockCap: 24,
    dates: ['初八', '初九', '初十', '十一', '十二', '十三', '十四'],   // spec-locked §5.2

    // §3.2.1 四类物料
    items: {
      putong:       { label: '普通料',  silver: 2, gain: 2 },
      haoliao:      { label: '好料',    silver: 3, gain: 2 },
      xiandanhuang: { label: '咸蛋黄',  silver: 2, gain: 0, order: true, delayDays: 2 },
      guihua:       { label: '桂花',    silver: 2, gain: 1 }
    },

    // §3.2.2 五种馅料
    fillings: {
      dousha:       { label: '豆沙',   cost: { putong: 2 } },
      wuren:        { label: '五仁',   cost: { putong: 2 } },
      lianrong:     { label: '莲蓉',   cost: { putong: 2 } },
      xiandanhuang: { label: '咸蛋黄', cost: { putong: 2, xiandanhuang: 1 } },
      guihua:       { label: '桂花',   cost: { putong: 2, guihua: 1 } }
    },
    fillingOrder: ['dousha', 'wuren', 'lianrong', 'xiandanhuang', 'guihua'],
    premiumCost: { haoliao: 2 },          // §4.1 好料批次的额外消耗

    // §3.3 动作成本
    actions: {
      shishi:  { label: '试新方', silver: 1, putong: 1, cap: 3 },
      daizuo:  { label: '代做',   silver: 3, grade: 2 },
      shouzuo: { label: '手作',   silver: 0 },
      xiexin:  { label: '写信',   silver: 1, once: true },
      beiyan:  { label: '备宴',   silver: 2, guihuaOnFifth: 1 },
      buzhi:   { label: '布置',   silver: 2, ambienceGain: 10, ambienceCap: 40, cap: 4 }
    },

    // §3.4 门控窗口
    gates: {
      xiandanhuang: { from: 1, to: 4 },
      haoliao:      { from: 1, to: 3 },
      guihua:       { from: 5, to: 7 }
    },

    // §3.5 解锁窗口
    unlocks: { daizuo: 1, shishi: 2, shouzuo: 3, xiexin: 4, beiyan: 5, buzhi: 6 },

    // §4.3 四步
    steps: [
      { id: 's1', budget: 8,  kind: 'bar' },
      { id: 's2', budget: 10, kind: 'pad' },
      { id: 's3', budget: 12, kind: 'pad' },
      { id: 's4', budget: 10, kind: 'bar' }
    ],
    stepBudgetTotal: 40,                   // §4.4 / V-13
    tolBase: 0.10,
    tolPerPattern: 0.03,
    tolCap: 0.19,                          // 0.10 + 0.03 * 3
    patternStepId: 's3',                   // §4.3.2 纹样只增益 S3
    swingOneWay: 2.0,                      // §4.3.3
    swingRate: 0.5,
    swingWindow: [0.40, 0.60],

    // §4.4.1 品级双闸门
    grade: { gold: 3.60, silver: 2.40, floor: 1 },

    // §6.1 meter
    meters: { cakeDenominator: 15, banquetItemValue: 12, heartDenominator: 500 },
    banquetCapNoGuihua: 4,
    banquetCapWithWine: 5,
    banquetItems: ['茶点', '果盘', '汤羹', '主食', '桂花酒'],   // spec-locked §3.2.2

    // §3.9 / §7.3 家人
    family: {
      grandma: { label: '祖母',     heart: 80, pref: 'dousha' },
      father:  { label: '父亲',     heart: 80, pref: 'wuren' },
      mother:  { label: '母亲',     heart: 72, pref: 'lianrong' },
      younger: { label: '幼弟',     heart: 64, pref: 'xiandanhuang' },
      brother: { label: '远方兄长', heart: 64, pref: 'guihua', remote: true }
    },
    familyOrder: ['grandma', 'father', 'mother', 'younger', 'brother'],
    heartCap: 100,
    preferBonus: { grade2: 8, grade3: 12 },
    letterBonus: 12,

    // §6.3.1 / §6.3.4 结局
    endings: {
      E1: { name: '月满人圆', A: 5, Q: 90, B: 76, H: 84, moon: '满月无云',
            text: '五席齐坐，五饼齐香。月满中天，人月两圆。' },
      E2: { name: '饼香宴暖', B: 76, Q: 67, moon: '满月薄云',
            text: '饼香满桌，席面齐整。月轮薄云，团圆不减。' },
      E3: { name: '一席团圆', H: 80, A: 5, moon: '明月半云',
            text: '五味各得其好，五席皆有其人。明月半云，一席团圆。' },
      E4: { name: '家常滋味', threshold: 60, moon: '月出云中',
            text: '粗饼淡席，家常滋味。月出云中，人聚即圆。' },
      E5: { name: '清欢小聚', moon: '薄云遮月',
            text: '三饼两盏，清欢小聚。薄云遮月，家人在侧。' }
    },
    endingOrder: ['E1', 'E2', 'E3', 'E4', 'E5'],

    // §8.2 色板（七 token，V-21 的唯一合法来源）
    palette: {
      paper:     '#F7EFE2',
      amber:     '#B8733A',
      cinnabar:  '#C9483C',
      ink:       '#3A2E26',
      moon:      '#F2E4C4',
      osmanthus: '#E8B84B',
      lantern:   '#F5C77E'
    },

    // §5.2 / §3.3 UI 文案
    copy: {
      finishDay:        '今日收工',        // spec-locked §5.2
      marketEmpty:      '市集无货',        // spec-locked §5.2
      cakeFull:         '五份已足',        // spec-locked §3.3
      lanternFull:      '四盏已足',        // spec-locked §3.3
      letterSent:       '信已寄出',        // spec-locked §3.3
      wineNeedsGuihua:  '缺桂花，酒席不成', // spec-locked §3.3
      patternFull:      '三式已成',        // spec-locked §3.3
      openFeast:        '开席',            // spec-locked §6.2
      assignConfirm:    '就这样分',        // spec-locked §6.6
      noCake:           '未留饼'           // spec-locked §6.6
    },

    // §8.5 首屏文案
    intro: {
      title:    '月宴',
      sub:      '八月十五，为家人备一桌团圆',
      howto:    '初八到十四，每天做三件事。买料、制饼、备宴、写信——七日之后开席。',
      congrong: '从容模式：四步不限时，慢慢做。（难度不变，只去掉时间压力）',
      start:    '开始筹备',
      saveHint: '每日收工自动存档，可随时关掉，明天接着做。'
    },

    // §9.3 分享卡几何
    card: {
      width: 780, height: 1688, margin: 60,
      moonCx: 390, moonCy: 210, moonR: 100,
      nameY: 400, nameSize: 64,
      textY: 470, textSize: 30, textMaxW: 560,
      tableCy: 720, tableR: 190,
      cakeX: 60, cakeY: 980, cakeW: 660, cakeH: 300, cakeRow: 60,
      meterX: 60, meterY: 1340, meterW: 660, meterH: 120, meterRow: 40,
      brandY: 1560, brandSize: 34, seriesSize: 20,
      familySize: 26, fillingSize: 24, gradeSize: 20, meterSize: 28
    },

    // §10.2 存档
    saveKeys: { progress: 'yueyan-progress', meta: 'yueyan-save' }
  };

  window.YueYan.Data = Data;
})();
