(function () {
  window.SZData = {
    COLS: 7,
    ROWS: 7,
    types: {
      inf:   { name: "步卒", ch: "步", hp: 8, atk: 3, move: 2, range: 1 },
      arch:  { name: "弓手", ch: "弓", hp: 5, atk: 3, move: 2, range: 2 },
      cav:   { name: "轻骑", ch: "骑", hp: 6, atk: 4, move: 3, range: 1, charge: 2 },
      heavy: { name: "重甲", ch: "甲", hp: 8, atk: 4, move: 1, range: 1, avoidForest: true },
      earc:  { name: "敌弓", ch: "弓", hp: 4, atk: 2, move: 1, range: 2, guard: true },
      flag:  { name: "中军旗", ch: "旗", hp: 3, atk: 0, move: 0, range: 0 }
    },
    museum: {
      title: "银雀山汉墓竹简",
      intro: [
        "1972 年，山东临沂银雀山汉墓出土一批西汉竹简，《孙子兵法》与失传千余年的《孙膑兵法》同见天日，千年作者之争就此尘埃落定。",
        "竹简现藏山东省博物馆。今以战棋演武，释读兵法十三篇——破一关，即释读一卷简。"
      ]
    },
    levels: [
      {
        id: "shiji",
        name: "始计篇",
        order: "第一",
        motto: "多算胜，少算不胜",
        mechanic: "庙算布阵",
        quote: {
          text: "夫未战而庙算胜者，得算多也；未战而庙算不胜者，得算少也。多算胜，少算不胜，而况于无算乎！",
          src: "《孙子兵法·始计篇》",
          vernacular: "开战之前庙堂之上谋划周密、胜算多的才能取胜。谋定而后动，是兵法第一课。"
        },
        brief: [
          "战前「庙算」：为我军选定出击阵形，不同阵形利于不同打法。",
          "敌军行动全程预告：虚线框是敌将移之位，红箭是敌将攻之的（移开即可躲开）。",
          "破敌之法：夺其「中军旗」。正面重甲难撼，多想一步再动子。"
        ],
        knowledge: [
          "银雀山汉简《孙子兵法》存十三篇主体，为现存最早的《孙子》抄本，比传世宋本早约一千三百年。",
          "「庙算」指战前在宗庙中举行的军事会议，以「算筹」推演胜负——可谓古代的兵棋推演。"
        ],
        forest: ["0,2", "0,3", "1,3", "0,4", "1,5", "6,2", "6,3", "5,3"],
        reed: [],
        wind: null,
        turnLimit: 10,
        reinforce: null,
        morale: false,
        huntRange: 99,
        stars3Turns: 4,
        formations: [
          { name: "雁行阵", desc: "轻骑居左翼，利于绕后击虚", pos: { p1: [3, 6], p2: [4, 6], p3: [1, 6] } },
          { name: "锥形阵", desc: "轻骑居右翼，右路绕后稍远", pos: { p1: [3, 6], p2: [2, 6], p3: [5, 6] } },
          { name: "方阵", desc: "三子居中互为犄角，稳而难迂", pos: { p1: [3, 6], p2: [3, 5], p3: [4, 6] } }
        ],
        units: [
          { id: "e1", side: "E", type: "heavy", col: 2, row: 2 },
          { id: "e2", side: "E", type: "heavy", col: 3, row: 2 },
          { id: "e3", side: "E", type: "heavy", col: 4, row: 2 },
          { id: "e5", side: "E", type: "flag", col: 3, row: 0 }
        ],
        playerDefault: { p1: [3, 6], p2: [4, 6], p3: [1, 6] }
      },
      {
        id: "zuozhan",
        name: "作战篇",
        order: "第二",
        motto: "兵贵胜，不贵久",
        mechanic: "速战速决",
        quote: {
          text: "故兵贵胜，不贵久。",
          src: "《孙子兵法·作战篇》",
          vernacular: "用兵贵在速胜，最忌旷日持久——久则粮尽兵疲，变生不测。"
        },
        brief: [
          "敌军重甲增援将接连开抵战场（第 3、5、7 回合各一股）。",
          "拖得越久，敌势越众。不要恋战，直取中军旗，速战速决！"
        ],
        knowledge: [
          "《作战篇》专论战争成本：「日费千金，然后十万之师举矣」——孙子是最早算战争经济账的人。",
          "银雀山汉简本与传世本篇次略有出入，证明汉代《孙子》文本仍在流动定型之中。"
        ],
        forest: ["0,2", "0,3", "1,3", "0,4", "1,5", "6,2", "6,3", "5,3"],
        reed: [],
        wind: null,
        turnLimit: 8,
        reinforce: { turns: [3, 5, 7], type: "heavy", spots: [[1, 0], [5, 0], [0, 0], [6, 0]] },
        morale: false,
        huntRange: 99,
        stars3Turns: 4,
        formations: null,
        units: [
          { id: "e1", side: "E", type: "heavy", col: 2, row: 2 },
          { id: "e2", side: "E", type: "heavy", col: 4, row: 2 },
          { id: "e4", side: "E", type: "earc", col: 5, row: 1 },
          { id: "e5", side: "E", type: "flag", col: 3, row: 0 }
        ],
        playerDefault: { p1: [3, 6], p2: [4, 6], p3: [1, 6] }
      },
      {
        id: "mougong",
        name: "谋攻篇",
        order: "第三",
        motto: "不战而屈人之兵",
        mechanic: "合围受降",
        quote: {
          text: "是故百战百胜，非善之善者也；不战而屈人之兵，善之善者也。",
          src: "《孙子兵法·谋攻篇》",
          vernacular: "百战百胜不算最高明，不经交战就使敌军屈服，才是高明中的最高明。"
        },
        brief: [
          "孤军无援则士气自溃：敌军若与友军不相邻，每回合士气 -1（金点），士气耗尽即卸甲归降。",
          "以三子为饵，把重甲与敌弓逐一引出军阵，使中军旗孤立——可望不战而胜。",
          "当然，也可刀兵取胜，只是少了「全胜」的成色。"
        ],
        knowledge: [
          "「不战而屈人之兵」是孙子「全胜」思想的核心：上兵伐谋，其次伐交，其次伐兵，其下攻城。",
          "银雀山汉墓墓主为武将，随葬兵书甚多，可见《孙子》在西汉初年已是将领必读之书。"
        ],
        forest: ["0,3", "1,4", "6,3", "5,4"],
        reed: [],
        wind: null,
        turnLimit: 10,
        reinforce: null,
        morale: true,
        earcHunt: true,
        huntRange: 4,
        stars3Turns: 6,
        formations: null,
        units: [
          { id: "e1", side: "E", type: "heavy", col: 2, row: 2 },
          { id: "e2", side: "E", type: "heavy", col: 3, row: 2 },
          { id: "e4", side: "E", type: "earc", col: 3, row: 1 },
          { id: "e5", side: "E", type: "flag", col: 3, row: 0 }
        ],
        playerDefault: { p1: [1, 6], p2: [5, 6], p3: [3, 6] }
      },
      {
        id: "xushi",
        name: "虚实篇",
        order: "第六",
        motto: "避实而击虚",
        mechanic: "避实击虚",
        quote: {
          text: "夫兵形象水，水之形，避高而趋下；兵之形，避实而击虚。",
          src: "《孙子兵法·虚实篇》",
          vernacular: "用兵如流水：水避高趋下，兵避实击虚。敌之强处为「实」，弱处为「虚」。"
        },
        brief: [
          "敌重甲结阵压来，是谓「实」——正面硬撼，步卒有死而已。",
          "中军旗远在敌后、护卫单薄，是谓「虚」。以步卒正面牵制，轻骑借树林迂回，直取中军。",
          "敌军重甲增援将在第 4、7 回合抵达，十回合内必须破敌。"
        ],
        knowledge: [
          "《虚实篇》为银雀山汉简十三篇之一。「实而备之，强而避之」与本篇互为表里。",
          "1972 年银雀山汉墓同时出土《孙子兵法》与《孙膑兵法》，证实《史记》孙武、孙膑各有兵书的记载。"
        ],
        forest: ["0,2", "0,3", "1,3", "0,4", "1,5", "6,2", "6,3", "5,3"],
        reed: [],
        wind: null,
        turnLimit: 10,
        reinforce: { turns: [4, 7], type: "heavy", spots: [[1, 0], [5, 0], [0, 0], [6, 0]] },
        morale: false,
        huntRange: 99,
        stars3Turns: 4,
        formations: null,
        units: [
          { id: "e1", side: "E", type: "heavy", col: 2, row: 2 },
          { id: "e2", side: "E", type: "heavy", col: 3, row: 2 },
          { id: "e3", side: "E", type: "heavy", col: 4, row: 2 },
          { id: "e4", side: "E", type: "earc", col: 5, row: 1 },
          { id: "e5", side: "E", type: "flag", col: 3, row: 0 }
        ],
        playerDefault: { p1: [3, 6], p2: [4, 6], p3: [1, 6] }
      },
      {
        id: "huogong",
        name: "火攻篇",
        order: "第十二",
        motto: "行火必有因",
        mechanic: "火借风势",
        quote: {
          text: "行火必有因，烟火必素具。发火有时，起火有日。",
          src: "《孙子兵法·火攻篇》",
          vernacular: "实施火攻必须具备一定的条件，火器必须平时就有准备；放火要看准时机与风向。"
        },
        brief: [
          "战场中部茅草连片，今日刮东风（火向东、南北蔓延）。",
          "我军任一子贴近茅草即可「引火」（每战一次）：烈焰每回合吞噬草上敌军，并顺风蔓延三回合后烧成焦土（焦土不可通行）。",
          "以火破阵、趁乱取旗。注意：莫让自己人立在火里。"
        ],
        knowledge: [
          "孙子论火攻而归于慎战：「主不可以怒而兴师，将不可以愠而致战」——火攻篇的结尾恰是反战之论。",
          "银雀山汉简另有《孙膑兵法》论「火战」，与《孙子》火攻篇可相参证。"
        ],
        forest: ["0,5", "6,5"],
        reed: ["1,3", "2,3", "3,3", "4,3", "5,3", "2,4", "3,4", "4,4"],
        wind: "E",
        turnLimit: 10,
        reinforce: null,
        morale: false,
        huntRange: 99,
        stars3Turns: 5,
        formations: null,
        units: [
          { id: "e1", side: "E", type: "heavy", col: 3, row: 2 },
          { id: "e2", side: "E", type: "heavy", col: 4, row: 2 },
          { id: "e4", side: "E", type: "earc", col: 6, row: 1 },
          { id: "e5", side: "E", type: "flag", col: 5, row: 1 }
        ],
        playerDefault: { p1: [1, 6], p2: [2, 6], p3: [0, 6] }
      }
    ],
    lostSlips: ["军形篇", "兵势篇", "军争篇", "九变篇", "行军篇", "地形篇", "九地篇", "用间篇"],
    playerUnits: [
      { id: "p1", side: "P", type: "inf" },
      { id: "p2", side: "P", type: "arch" },
      { id: "p3", side: "P", type: "cav" }
    ]
  };
})();
