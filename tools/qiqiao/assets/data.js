(function () {
  window.QQData = {
    SHADOWS: [
      { id: "yun", name: "祥云", luck: "ji", meaning: "运势舒展，贵人相助",
        text: "针影如祥云舒卷，运势正缓缓铺开。近来行事多有贵人照拂，所求之事自会水到渠成。" },
      { id: "mudan", name: "牡丹", luck: "ji", meaning: "花开富贵，所求渐成",
        text: "影作牡丹初绽，花开富贵，一步步逼近眼前。心中所求之事已渐成形，再耐心候上一候。" },
      { id: "xique", name: "喜鹊", luck: "ji", meaning: "喜上眉梢，佳音将至",
        text: "鹊影落盆，喜上眉梢。近日当有佳音登门，且静听檐下风声。" },
      { id: "jinyu", name: "金鱼", luck: "ji", meaning: "如鱼得水，年年有余",
        text: "影化金鱼摆尾，如鱼得水，年年有余。日子顺遂有余，处处皆是自在。" },
      { id: "fenghuang", name: "凤凰", luck: "ji", meaning: "凤鸣朝阳，才质出众",
        text: "凤影朝阳而鸣，才质出众，光华难掩。此时正当振翅，不妨放胆高飞。" },
      { id: "limao", name: "狸猫", luck: "ji", meaning: "安闲自在，小人退散",
        text: "影如狸猫卧月，安闲自在，诸事从容。小人自退，日子安稳清净。" },
      { id: "xiuxie", name: "绣鞋", luck: "ji", meaning: "步步高升，行路有伴",
        text: "影落如绣鞋一双，步步高升，行路有伴。前程有人同行，脚下自有坦途。" },
      { id: "jiandao", name: "剪刀", luck: "ji", meaning: "心灵手巧，裁出新局",
        text: "影作剪刀开张，心灵手巧，裁得出新局。旧事剪断，新篇即启。" },
      { id: "yulong", name: "玉龙", luck: "ji", meaning: "潜龙在渊，时机将至",
        text: "影沉如玉龙，潜龙在渊，时机将至。且安心积蓄，一朝腾起自有风雷。" },
      { id: "lianhua", name: "莲花", luck: "ji", meaning: "并蒂同心，清净如意",
        text: "影开如莲，并蒂同心，清净如意。尘嚣远去，所遇皆温柔。" },
      { id: "chui", name: "槌影", luck: "zhuo", meaning: "拙中藏稳，勤能补拙",
        text: "影钝如槌，拙中藏稳。勤能补拙，慢工出细活——你的巧，在一份踏实坚持里。" },
      { id: "zhuying", name: "烛烟", luck: "zhuo", meaning: "心浮气躁，静候再占",
        text: "影直如烛烟，心绪稍有些浮动。且静候片刻再占——巧从不急在这一针。" }
    ],
    ASPECTS: [
      { id: "zhenong", name: "针工",
        text: "指上功夫渐入佳境，手头活计一日比一日精巧。近来宜多试新手艺，必有惊喜。" },
      { id: "wencai", name: "文采",
        text: "文思清朗，笔下生风。无论写作、言谈还是提案，都能拿出漂亮的东西来。" },
      { id: "yinyuan", name: "姻缘",
        text: "情缘渐浓，缘分正悄悄靠近。无论心中有人还是仍在等候，都会有温柔的回响。" },
      { id: "jiazhai", name: "家宅",
        text: "家宅安宁，家中光景日渐和暖。宜整理居所、团聚旧友，平安即是福。" },
      { id: "caishi", name: "财市",
        text: "财路平顺，小利积多。用度之间自有分寸，稳扎稳打便是进益。" }
    ],
    GRADES: [
      { id: "shangshang", name: "上上巧", weightBase: 10,
        text: "巧自天上来，万事皆可期待，是七夕针占里最好的一筹。" },
      { id: "shang", name: "上巧", weightBase: 22,
        text: "巧已在手边，用心去做，自然水到渠成。" },
      { id: "zhong", name: "中巧", weightBase: 34,
        text: "巧运平平，稳步去做，功夫不负有心人。" },
      { id: "xiao", name: "小巧", weightBase: 24,
        text: "小巧初萌，莫急莫馁，一点一点便成气候。" },
      { id: "weide", name: "未得巧", weightBase: 10,
        text: "此番未得巧，然拙手亦是稳手，巧从来不负有心之人。" }
    ],
    FACTS: [
      "七夕节 2006 年列入首批国家级非物质文化遗产名录（民俗类）",
      "丢针试巧：明清七夕午时投针于水，视针影占巧拙——影如云霞花鸟鞋剪为得巧（《帝京景物略》载）",
      "穿针乞巧：七夕夜月下穿七孔针，「家家乞巧望秋月，穿尽红丝几万条」（林杰《乞巧》）",
      "织女星（Vega）与牵牛星（Altair）隔银河相望，天鹅座横卧银河——鹊桥的星图原型",
      "七夕古称乞巧节：女子向织女乞求巧艺，是七夕最古老的内涵"
    ],
    ZHUO_WEIGHT: 7,
    JI_WEIGHT: 9.5,
    UNLOCK_BOOST: 1.5,
    CALM_CYCLE: 2.4,
    FILL_TIME: 1.5,
    REVEAL_TIME: 2.8
  };
})();
