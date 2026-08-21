(function () {
  window.LZData = {
    F: 45,
    Z_MAX: 90,
    BASE_SPEED: 8,
    MAX_SPEED: 22,
    SPEED_RAMP_DIST: 1200,
    DASH_TIME: 3,
    DASH_MULT: 1.8,
    GAUGE_DRUM: 12,
    GAUGE_WINE: 50,
    DRUM_INTERVAL: 0.12,
    STEADY_MAX: 3,
    HIT_INV: 1.5,
    LANE_TIME: 0.15,
    GAP_MAX: 34,
    GAP_MIN: 22,
    GAP_RAMP: 250,
    HITBOX: {
      boat: { hw: 0.22, hl: 3.2 },
      rock: { hw: 0.30, hl: 1.6 },
      whirl: { hw: 0.32, hl: 1.8 },
      log: { hw: 0.40, hl: 0.9 },
      yuchuan: { hw: 0.26, hl: 2.6 },
      fubiao: { hw: 0.16, hl: 0.7 },
      zhufa: { hw: 0.46, hl: 1.1 },
      pick: { hw: 0.34, hl: 1.4 }
    },
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
