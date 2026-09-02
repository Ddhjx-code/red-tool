/* ============================================================
   漆扇 · 数据层 (window.QSData)
   内容依据 docs/specs/2026-09-02-qishan-design.md §2 §6
   文化准确性：漂漆技法 / 大漆 / 漆器髹饰技艺 / 配色文化 / 一半人为一半天成
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 漆色八种：天然矿物调色（hex 为原型验证值，锁定） ---------- */
  var COLORS = [
    { id: 'cinnabar', name: '朱砂红', en: 'Cinnabar', hex: '#E23D28', mineral: '朱砂', warm: true, light: false },
    { id: 'azurite', name: '石青', en: 'Azurite', hex: '#2A6FD6', mineral: '青金石', warm: false, light: false },
    { id: 'malachite', name: '石绿', en: 'Malachite', hex: '#15A67A', mineral: '孔雀石', warm: false, light: false },
    { id: 'gamboge', name: '藤黄', en: 'Gamboge', hex: '#EFA81C', mineral: '藤黄树脂', warm: true, light: true },
    { id: 'darkcyan', name: '黛青', en: 'DarkCyan', hex: '#2C6E86', mineral: '蓝铜矿', warm: false, light: false },
    { id: 'rouge', name: '胭脂粉', en: 'Rouge', hex: '#D2567E', mineral: '胭脂', warm: true, light: true },
    { id: 'ink', name: '墨黑', en: 'Ink', hex: '#16181D', mineral: '松烟墨', warm: false, light: false },
    { id: 'gold', name: '金', en: 'Gold', hex: '#D9A62E', mineral: '金箔', warm: true, light: true }
  ];

  /* ---------- 传统配色三套（取自漆色八种，附配色口诀） ---------- */
  var PRESETS = [
    {
      id: 'dunhuang',
      name: '敦煌',
      desc: '壁画矿物色 · 藤黄石绿黛青金',
      colors: ['gamboge', 'malachite', 'darkcyan', 'gold'],
      lore: '敦煌壁画以青金石、孔雀石、朱砂等矿物设色，历经千年不褪。'
    },
    {
      id: 'gugong',
      name: '故宫',
      desc: '红墙金瓦 · 朱砂金墨黑石青',
      colors: ['cinnabar', 'gold', 'ink', 'azurite'],
      lore: '故宫红墙金瓦，朱砂为墙、金箔为瓦、墨黑为影，是最正的一组国风色。'
    },
    {
      id: 'qianli',
      name: '千里江山',
      desc: '青绿山水 · 石青石绿藤黄墨黑',
      colors: ['azurite', 'malachite', 'gamboge', 'ink'],
      lore: '《千里江山图》以石青石绿层层罩染，青绿之间以藤黄过渡，墨黑勾骨。'
    }
  ];

  /* ---------- 扇形 ---------- */
  var FANS = [
    { id: 'round', name: '团扇', desc: '圆形扇面 · 汉制仪仗', short: '团' },
    { id: 'fold', name: '折扇', desc: '折叠扇面 · 宋明雅器', short: '折' }
  ];

  /* ---------- 入水手法（真实工艺：入水速度/角度/摇晃决定纹路） ---------- */
  var DIPS = [
    { id: 'vertical', name: '垂直', desc: '扇面平直入水，漆纹整体直拓，纹样最完整', short: '直' },
    { id: 'rotate', name: '旋转', desc: '入水时旋腕转扇，漆纹绕扇心涡卷成旋', short: '旋' },
    { id: 'zigzag', name: 'Z字', desc: '左右摆扇走 Z 字，漆纹分段成带状层叠', short: 'Z' }
  ];

  /* ---------- 知识点（文化准确，来源见设计文档 §2 §6） ---------- */
  var KNOWLEDGE = [
    {
      tag: '漂漆技法',
      text: '漂漆是大漆工艺的技法之一，也称竜纹涂。色漆调入松节油或橘子油后轻质浮于水面，以滴、点、弹、甩布漆，再用笔或木棒在水中轻划，漆膜便肆意流变成纹，最后将器物下水漂出、晾干成器。'
    },
    {
      tag: '大漆',
      text: '大漆即天然生漆，中国特有。漆树生长八年以上方可割漆，一棵一年约产漆 500 克，故有「百里千刀一斤漆」之说。色漆以青金石、孔雀石、朱砂等天然矿物调成，色泽千年不褪。'
    },
    {
      tag: '漆器髹饰技艺',
      text: '真正的非物质文化遗产是「漆器髹饰技艺」。漆扇由大漆工艺结合现代审美而来，脱胎于传统髹饰中的漂漆一脉，是古老漆艺在当代的新生。'
    },
    {
      tag: '配色文化',
      text: '漆扇配色多取敦煌壁画、故宫红墙金瓦、《千里江山图》青绿山水三套传统色。初学不易翻车的口诀：2 浅配 1 深，或 2 暖配 1 冷。'
    },
    {
      tag: '一半人为一半天成',
      text: '漆入水后自行流变，入水的速度、角度与摇晃方式决定纹路走向。同一盆漆也漂不出两把相同的扇子——一半人为，一半天成，每把漆扇都独一无二。'
    },
    {
      tag: '漆扇源流',
      text: '扇的形制可追溯至汉代，初为帝王仪仗所用的障扇。漆扇以大漆髹饰为面，是汉代扇制与千年漆艺的合流。'
    }
  ];

  /* ---------- 首页文化引言 ---------- */
  var INTRO = [
    '大漆不溶于水。色漆滴入盆中便浮在水面成膜，以木棒点、甩、弹、划，漆膜流变出云纹水纹。',
    '扇面入水一拓，漆纹便附上绢面——入水的角度与快慢决定纹路，同一盆漆漂不出两把相同的扇子。',
    '一半人为，一半天成。这一盆水，由你设计。'
  ];

  var TIPS = [
    '点水面＝滴漆，拖水面＝拉纹。可反复滴、反复划，满意了再入水。',
    '配色口诀：2 浅配 1 深，或 2 暖配 1 冷，不易翻车。',
    '漆浮于水不溶，越划越薄、越薄越亮——薄处的漆色反而更艳。',
    '入水手法会改变纹路：垂直整体直拓，旋转涡卷，Z 字成带状层叠。'
  ];

  /* ---------- 国风寓意名（程序化生成，非随机词库堆砌） ---------- */
  var NAME_A = [
    '流云', '叠嶂', '惊鸿', '落霞', '寒江', '烟波', '春水', '暮雪',
    '浮光', '碎金', '青崖', '赤霞', '墨雨', '金乌', '沧浪', '远山'
  ];
  var NAME_B = [
    '映水', '入梦', '生辉', '成纹', '拂风', '凝烟', '落扇', '含章',
    '浮翠', '流光', '醉月', '栖霞'
  ];
  /* 主色 → 意象偏置（让名字与所用漆色呼应） */
  var NAME_HINT = {
    cinnabar: ['赤霞', '落霞', '朱华'],
    azurite: ['青崖', '沧浪', '寒江'],
    malachite: ['浮翠', '叠嶂', '春水'],
    gamboge: ['浮光', '碎金', '栖霞'],
    darkcyan: ['烟波', '远山', '凝烟'],
    rouge: ['醉月', '惊鸿', '入梦'],
    ink: ['墨雨', '暮雪', '含章'],
    gold: ['金乌', '碎金', '流光']
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex) {
    var v = parseInt(hex.slice(1), 16);
    return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
  }

  function colorById(id) {
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].id === id) return COLORS[i];
    return COLORS[0];
  }

  function presetById(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return null;
  }

  function fanById(id) {
    for (var i = 0; i < FANS.length; i++) if (FANS[i].id === id) return FANS[i];
    return FANS[0];
  }

  function dipById(id) {
    for (var i = 0; i < DIPS.length; i++) if (DIPS[i].id === id) return DIPS[i];
    return DIPS[0];
  }

  /* 国风寓意名：种子决定，主色偏置意象 —— 可复现、与作品呼应 */
  function makeName(seed, mainColorId) {
    var rnd = mulberry32(seed >>> 0);
    var hints = NAME_HINT[mainColorId] || NAME_A;
    var a = rnd() < 0.62 ? hints[Math.floor(rnd() * hints.length)] : NAME_A[Math.floor(rnd() * NAME_A.length)];
    var b = NAME_B[Math.floor(rnd() * NAME_B.length)];
    return a + b;
  }

  /* 作品小记：一句话点评（由主色 + 手法生成） */
  function makeNote(mainColorId, dipId, coverage) {
    var c = colorById(mainColorId);
    var d = dipById(dipId);
    var pct = Math.round(coverage * 100);
    return c.name + '为主 · ' + d.name + '入水 · 漆膜覆扇 ' + pct + '%';
  }

  window.QSData = {
    SERIES: '非遗手作坊 · 第十七作',
    TITLE: '漆扇',
    SUBTITLE: '漂漆 · 一半人为一半天成',
    COLORS: COLORS,
    PRESETS: PRESETS,
    FANS: FANS,
    DIPS: DIPS,
    KNOWLEDGE: KNOWLEDGE,
    INTRO: INTRO,
    TIPS: TIPS,
    NAME_A: NAME_A,
    NAME_B: NAME_B,
    hexToRgb: hexToRgb,
    mulberry32: mulberry32,
    colorById: colorById,
    presetById: presetById,
    fanById: fanById,
    dipById: dipById,
    makeName: makeName,
    makeNote: makeNote
  };
})();
