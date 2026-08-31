(function () {
  window.SHData = {
    W: 390, H: 720,
    player: { hp: 5, speed: 4.2, fireRate: 14, dmg: 1 },
    weapons: {
      sword:  { name: "飞剑", desc: "扇形散射飞剑", spread: 3 },
      thunder:{ name: "雷符", desc: "清屏雷符（限用）" },
      mirror: { name: "八卦镜", desc: "护身镜，挡一次伤害" }
    },
    enemies: {
      qiongqi: { name: "穷奇", hp: 3,  speed: 1.6, drop: 8,  r: 20, score: 10,
                 lore: "穷奇状如虎而翼，食人，是上古四凶之一。", tip: "俯冲快，血薄——正面火力即可。" },
      bifang:  { name: "毕方", hp: 4,  speed: 1.3, drop: 10, r: 22, score: 12,
                 lore: "毕方一足，见则其邑有讹火，是兆火之鸟。", tip: "会喷火，别被火球蹭到。" },
      goudiao: { name: "蛊雕", hp: 6,  speed: 1.1, drop: 14, r: 24, score: 16,
                 lore: "蛊雕状如雕而角，其音如婴儿，食人。", tip: "血厚，优先集火。" },
      taotie:  { name: "饕餮", hp: 40, speed: 0.5, drop: 60, r: 40, score: 100, boss: true,
                 lore: "饕餮贪食，有首无身，是上古四凶之一。", tip: "Boss：皮糙肉厚，贴脸放雷符。" }
    },
    levels: [
      {
        id: "kunlun", name: "昆仑之丘", waves: 4, boss: false,
        brief: "昆仑之丘，百神所在。云海之上，妖兽扑落——御应龙而上，扫清妖氛。",
        lore: "《山海经》：「昆仑之丘，是实惟帝之下都。」百神所在，云海茫茫。"
      },
      {
        id: "buzhou", name: "不周之山", waves: 5, boss: false,
        brief: "不周之山，天柱也。风烈如火，妖兽成群——火力升级，一路向上。",
        lore: "《山海经》：「西北海之外，大荒之隅，有山而不合，名曰不周。」"
      },
      {
        id: "taotie", name: "饕餮之祸", waves: 4, boss: true,
        brief: "饕餮现世，贪食无厌。集火轰其首，雷符贴脸放——斩了这上古凶兽。",
        lore: "《山海经·北山经》：「狍鸮，其状如羊身人面，其目在腋下，虎齿人爪，其音如婴儿，名曰狍鸮，是食人。」狍鸮即饕餮。"
      }
    ],
    knowledge: [
      "《山海经》是中国上古奇书，记山川、物产、神怪，存妖兽四百余种。",
      "穷奇、毕方、蛊雕、饕餮，皆为《山海经》所载凶兽，古人以之警世。",
      "应龙是上古神龙，有翼，曾助黄帝战蚩尤——御龙御空，是古人最浪漫的想象。"
    ]
  };
})();
