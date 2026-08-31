(function () {
  window.JQData = {
    COLS: 4,
    ROWS: 8,
    startGrain: 175,
    trickle: { amount: 25, interval: 7 },
    canglin: 8,
    towers: {
      lichun:  { name: "立春", cost: 50,  dmg: 22, range: 2.6, rate: 1.2, kind: "shoot",  desc: "融水弹·单体" },
      yushui:  { name: "雨水", cost: 100, dmg: 10, range: 2.6, rate: 1.5, kind: "slow",   desc: "泥泞·减速四成" },
      jingzhe: { name: "惊蛰", cost: 175, dmg: 60, range: 1.5, rate: 8,   kind: "thunder", desc: "春雷·范围轰击" },
      guyu:    { name: "谷雨", cost: 75,  dmg: 0,  range: 0,   rate: 7,   kind: "farm",   desc: "生发·每7秒产25谷" },
      mangzhong: { name: "芒种", cost: 60,  dmg: 12, range: 2.6, rate: 0.7, kind: "shoot", desc: "抢种·速射连发" },
      xiazhi:    { name: "夏至", cost: 125, dmg: 18, range: 3.5, rate: 1.1, kind: "shoot", antiAir: true, desc: "长日·远射打飞蝗" },
      xiaoshu:   { name: "小暑", cost: 130, dmg: 8,  range: 2.6, rate: 1.6, kind: "burn", burnDps: 5, desc: "灼热·点燃持续灼烧" },
      liqiu:     { name: "立秋", cost: 50,  dmg: 22, range: 2.6, rate: 1.2, kind: "shoot", desc: "肃杀·单体" },
      bailu:     { name: "白露", cost: 100, dmg: 10, range: 2.6, rate: 1.5, kind: "slow", desc: "凝露·减速四成" },
      shuangjiang: { name: "霜降", cost: 160, dmg: 6, range: 2.6, rate: 2.2, kind: "freeze", freezeDur: 2.5, desc: "霜冻·冻住敌人2.5秒" },
      lidong:    { name: "立冬", cost: 50,  dmg: 22, range: 2.6, rate: 1.2, kind: "shoot", desc: "闭藏·单体" },
      daxue:     { name: "大雪", cost: 110, dmg: 10, range: 2.6, rate: 1.5, kind: "slow", desc: "积雪·减速五成" },
      dahan:     { name: "大寒", cost: 175, dmg: 6, range: 2.6, rate: 2.4, kind: "freeze", freezeDur: 4, desc: "严寒·冻住敌人4秒" }
    },
    enemies: {
      yachong:    { name: "蚜虫",   hp: 35,  speed: 0.5,  drop: 5,  r: 0.22 },
      ditouhu:    { name: "地老虎", hp: 130, speed: 0.34, drop: 15, r: 0.3 },
      daochunhan: { name: "倒春寒", hp: 340, speed: 0.22, drop: 40, r: 0.38, freeze: true },
      huangchong: { name: "蝗虫",   hp: 30,  speed: 0.72, drop: 6,  r: 0.24, flying: true },
      hanba:      { name: "旱魃",   hp: 120, speed: 0.2,  drop: 30, r: 0.4 },
      honglao:    { name: "洪涝",   hp: 70,  speed: 0.5,  drop: 12, r: 0.32, water: true, waterSpeed: 0.5 },
      yezhu:      { name: "野猪",   hp: 90,  speed: 0.55, drop: 18, r: 0.34, charge: true },
      qiuhuang:   { name: "秋蝗",   hp: 35,  speed: 0.68, drop: 7,  r: 0.24, flying: true },
      zaoshuang:  { name: "早霜",   hp: 200, speed: 0.24, drop: 30, r: 0.36, freeze: true },
      hanxue:     { name: "寒潮",   hp: 260, speed: 0.22, drop: 35, r: 0.38, freeze: true },
      daxueguai:  { name: "大雪",   hp: 180, speed: 0.2,  drop: 30, r: 0.42 }
    },
    levels: [
      {
        id: "lichun",
        name: "立春 · 解冻",
        brief: "东风解冻，蛰虫始振。第一波虫害试探田垄——布下你的节气塔。",
        intro: {
          lore: "立春，正月节。东风解冻，蛰虫始振——田里的虫也醒了。第一波虫害正顺着田垄压过来。",
          howto: "点击下方节气塔卡片，再点田垄布塔。害虫漏过底线会偷走仓廪，仓廪空则失守。",
          enemies: ["yachong", "ditouhu"],
          towers: ["lichun", "yushui", "jingzhe", "guyu"]
        },
        waves: [
          { banner: "一波 · 蚜虫试探", spawns: [
            [0, "yachong", 1], [2.5, "yachong", 2], [5, "yachong", 0]
          ]},
          { banner: "二波 · 双线虫潮", spawns: [
            [0, "yachong", 0], [1.5, "yachong", 3], [3, "yachong", 1], [4.5, "yachong", 2],
            [6.5, "yachong", 3]
          ]},
          { banner: "三波 · 地老虎出洞", spawns: [
            [0, "ditouhu", 1], [2, "ditouhu", 2], [4, "yachong", 0], [5, "yachong", 3],
            [6.5, "yachong", 1], [7.5, "yachong", 2]
          ]}
        ]
      },
      {
        id: "jingzhe",
        name: "惊蛰 · 春雷",
        brief: "春雷惊百虫——真正的虫潮醒了。守住仓廪，等一声惊蛰雷。",
        intro: {
          lore: "惊蛰，二月节。春雷响，蛰虫惊而出走——这一关，虫潮成倍涌来，还有倒春寒南下冻住你的塔。",
          howto: "倒春寒会周期性冻结附近的塔（蓝罩失效 3 秒）。惊蛰塔的春雷能轰击周围 3×3 范围，是应对虫潮的关键。",
          enemies: ["yachong", "ditouhu", "daochunhan"],
          towers: ["lichun", "yushui", "jingzhe", "guyu"]
        },
        waves: [
          { banner: "一波 · 虫醒", spawns: [
            [0, "yachong", 0], [1.2, "yachong", 1], [2.4, "yachong", 2], [3.8, "yachong", 3]
          ]},
          { banner: "二波 · 地老虎结队", spawns: [
            [0, "ditouhu", 0], [1.5, "ditouhu", 3], [3, "ditouhu", 1],
            [4.5, "yachong", 2], [5.5, "yachong", 2], [6.5, "yachong", 0]
          ]},
          { banner: "三波 · 倒春寒南下", spawns: [
            [0, "daochunhan", 1], [2, "yachong", 0], [3, "yachong", 3], [4.5, "yachong", 2], [6, "yachong", 0]
          ]},
          { banner: "灾潮 · 百虫齐出", spawns: [
            [0, "yachong", 0], [0.4, "yachong", 1], [0.8, "yachong", 2], [1.2, "yachong", 3],
            [2.5, "ditouhu", 1], [3.5, "ditouhu", 2],
            [5, "yachong", 0], [5.4, "yachong", 1], [5.8, "yachong", 2], [6.2, "yachong", 3]
          ]}
        ]
      },
      {
        id: "lixia",
        name: "立夏 · 蝗起",
        season: "summer",
        waterLane: 2,
        brief: "立夏蝼蝈鸣，蚯蚓出——蝗虫也振翅了。飞蝗过境，只啃高处，地面打不着。",
        intro: {
          lore: "立夏，四月节。蝼蝈鸣，蚯蚓出。天热了，蝗虫振翅——飞蝗从头顶过，地面的塔打不着它。",
          howto: "蝗虫会飞：只有夏至塔（远射）和惊蛰雷能打到它。水道里的洪涝游得飞快，盯紧第 3 列。",
          enemies: ["huangchong", "yachong", "honglao"],
          towers: ["lichun", "yushui", "jingzhe", "guyu", "mangzhong", "xiazhi", "xiaoshu"]
        },
        waves: [
          { banner: "一波 · 飞蝗试探", spawns: [
            [0, "huangchong", 0], [2.5, "huangchong", 3]
          ]},
          { banner: "二波 · 水陆并进", spawns: [
            [0, "honglao", 2], [2, "yachong", 0], [4, "huangchong", 1]
          ]},
          { banner: "三波 · 蝗群压境", spawns: [
            [0, "huangchong", 0], [1.5, "huangchong", 1],
            [3, "honglao", 2], [5, "yachong", 0]
          ]}
        ]
      },
      {
        id: "xiaoshu",
        name: "小暑 · 旱魃",
        season: "summer",
        waterLane: 2,
        brief: "小暑大暑，上蒸下煮。旱魃南下，赤地千里——它皮糙肉厚，烧它、拖它、磨它。",
        intro: {
          lore: "小暑，六月节。暑，热也。旱魃一出，赤地千里——这怪物皮糙肉厚，寻常火力啃不动。",
          howto: "旱魃血量极厚：用小暑点燃持续灼烧，配合雨水减速慢慢磨。飞蝗也会来凑热闹，留好夏至塔。",
          enemies: ["hanba", "huangchong", "honglao"],
          towers: ["lichun", "yushui", "jingzhe", "guyu", "mangzhong", "xiazhi", "xiaoshu"]
        },
        waves: [
          { banner: "一波 · 旱魃现身", spawns: [
            [0, "hanba", 1], [2, "yachong", 0]
          ]},
          { banner: "二波 · 蝗旱交加", spawns: [
            [0, "huangchong", 0], [2, "hanba", 3], [4, "honglao", 2]
          ]},
          { banner: "三波 · 赤地千里", spawns: [
            [0, "hanba", 1], [2, "hanba", 3], [3.5, "huangchong", 3], [5, "honglao", 2]
          ]}
        ]
      },
      {
        id: "dashu",
        name: "大暑 · 涝灾",
        season: "summer",
        waterLane: 2,
        brief: "大暑，六月中。湿热交蒸，暴雨成涝——水道暴涨，洪涝顺流直下，守住仓廪。",
        intro: {
          lore: "大暑，六月中。湿热交蒸，暴雨成涝——水道暴涨，洪涝顺流直下，一泻千里。",
          howto: "洪涝在水道里游得飞快，是全年最快的灾。把火力堆在第 3 列两侧，旱魃和飞蝗也会一起来。",
          enemies: ["honglao", "hanba", "huangchong"],
          towers: ["lichun", "yushui", "jingzhe", "guyu", "mangzhong", "xiazhi", "xiaoshu"]
        },
        waves: [
          { banner: "一波 · 水道暴涨", spawns: [
            [0, "honglao", 2], [3, "yachong", 0]
          ]},
          { banner: "二波 · 涝旱并至", spawns: [
            [0, "honglao", 2], [3, "hanba", 1]
          ]},
          { banner: "灾潮 · 洪流决堤", spawns: [
            [0, "honglao", 2], [3, "hanba", 3], [5, "huangchong", 1]
          ]}
        ]
      },
      {
        id: "liqiu",
        name: "立秋 · 抢收",
        season: "autumn",
        brief: "立秋，七月节。秋收开始——野猪下山抢粮，撞毁你的塔，护住仓廪。",
        intro: {
          lore: "立秋，七月节。秋收开始，仓廪渐实——山里的野猪也闻着谷香下山了。",
          howto: "野猪会冲撞：撞上你的塔就同归于尽。别把塔放在它必经的路上，用远程塔远远磨死它。",
          enemies: ["yezhu", "yachong", "qiuhuang"],
          towers: ["lichun", "yushui", "jingzhe", "guyu", "mangzhong", "xiazhi", "xiaoshu", "liqiu", "bailu", "shuangjiang"]
        },
        waves: [
          { banner: "一波 · 野猪下山", spawns: [
            [0, "yezhu", 1], [3, "yachong", 0]
          ]},
          { banner: "二波 · 秋蝗蔽日", spawns: [
            [0, "qiuhuang", 0], [2, "qiuhuang", 3], [4, "yezhu", 3]
          ]},
          { banner: "三波 · 抢收保卫战", spawns: [
            [0, "yezhu", 0], [2, "yezhu", 1], [4, "qiuhuang", 3]
          ]}
        ]
      },
      {
        id: "bailu",
        name: "白露 · 凝露",
        season: "autumn",
        brief: "白露，八月节。露凝而白——秋蝗成灾，早霜将至，抢在霜前收完粮。",
        intro: {
          lore: "白露，八月节。露凝而白，秋意渐深——秋蝗成群掠过田垄，早霜随时会落。",
          howto: "秋蝗会飞，只有夏至塔和惊蛰雷能打。早霜会冻住你的塔——塔别堆在一处。",
          enemies: ["qiuhuang", "zaoshuang", "yachong"],
          towers: ["lichun", "yushui", "jingzhe", "guyu", "mangzhong", "xiazhi", "xiaoshu", "liqiu", "bailu", "shuangjiang"]
        },
        waves: [
          { banner: "一波 · 秋蝗过境", spawns: [
            [0, "qiuhuang", 0], [2, "qiuhuang", 1], [4, "qiuhuang", 3]
          ]},
          { banner: "二波 · 早霜初降", spawns: [
            [0, "zaoshuang", 1], [3, "qiuhuang", 0]
          ]},
          { banner: "三波 · 霜蝗并至", spawns: [
            [0, "zaoshuang", 3], [2, "qiuhuang", 1], [4, "qiuhuang", 0]
          ]}
        ]
      },
      {
        id: "shuangjiang",
        name: "霜降 · 肃杀",
        season: "autumn",
        brief: "霜降，九月节。气肃而霜——最后一收，野猪、秋蝗、早霜一起来了。",
        intro: {
          lore: "霜降，九月节。气肃而霜，草木黄落——这是秋收最后一战，所有的灾都来了。",
          howto: "野猪撞塔、秋蝗会飞、早霜冻塔——三种灾一起来。用霜降塔冻住它们，逐个击破。",
          enemies: ["yezhu", "qiuhuang", "zaoshuang"],
          towers: ["lichun", "yushui", "jingzhe", "guyu", "mangzhong", "xiazhi", "xiaoshu", "liqiu", "bailu", "shuangjiang"]
        },
        waves: [
          { banner: "一波 · 肃杀将至", spawns: [
            [0, "yezhu", 0], [3, "qiuhuang", 3]
          ]},
          { banner: "二波 · 霜压田垄", spawns: [
            [0, "zaoshuang", 1], [3, "yezhu", 3]
          ]},
          { banner: "灾潮 · 霜降总攻", spawns: [
            [0, "zaoshuang", 0], [3, "yezhu", 1], [5, "qiuhuang", 3], [7, "qiuhuang", 0]
          ]}
        ]
      },
      {
        id: "lidong",
        name: "立冬 · 冰始",
        season: "winter",
        iceLane: 2,
        brief: "立冬，十月节。水始冰——田垄结冰，灾在冰上滑行，快得拦不住。",
        intro: {
          lore: "立冬，十月节。水始冰，地始冻——田垄结了冰，灾在冰上滑行，比平时快得多。",
          howto: "第 3 列是冰道，敌人在上面滑行加速。把火力堆在冰道两侧，用减速塔拖住它们。",
          enemies: ["daxueguai", "yachong", "hanxue"],
          towers: ["lichun", "yushui", "jingzhe", "guyu", "mangzhong", "xiazhi", "xiaoshu", "liqiu", "bailu", "shuangjiang", "lidong", "daxue", "dahan"]
        },
        waves: [
          { banner: "一波 · 冰始凝", spawns: [
            [0, "daxueguai", 2], [3, "yachong", 0]
          ]},
          { banner: "二波 · 寒潮南下", spawns: [
            [0, "hanxue", 1], [3, "daxueguai", 2]
          ]},
          { banner: "三波 · 冰原压境", spawns: [
            [0, "daxueguai", 2], [3, "hanxue", 3], [5, "yachong", 0]
          ]}
        ]
      },
      {
        id: "daxue",
        name: "大雪 · 封路",
        season: "winter",
        iceLane: 2,
        brief: "大雪，十一月节。雪封田垄——大雪怪皮糙肉厚，寒潮冻塔，硬仗来了。",
        intro: {
          lore: "大雪，十一月节。雪封田垄，天寒地冻——大雪怪皮糙肉厚，寒潮所过之处塔都被冻住。",
          howto: "大雪怪血量极厚，用灼烧和重击慢慢磨。寒潮会冻塔——塔分散放，别被一锅端。",
          enemies: ["daxueguai", "hanxue", "yachong"],
          towers: ["lichun", "yushui", "jingzhe", "guyu", "mangzhong", "xiazhi", "xiaoshu", "liqiu", "bailu", "shuangjiang", "lidong", "daxue", "dahan"]
        },
        waves: [
          { banner: "一波 · 雪怪现身", spawns: [
            [0, "daxueguai", 1], [3, "yachong", 0]
          ]},
          { banner: "二波 · 风雪交加", spawns: [
            [0, "hanxue", 3], [3, "daxueguai", 2]
          ]},
          { banner: "三波 · 大雪封路", spawns: [
            [0, "daxueguai", 0], [3, "daxueguai", 3], [5, "hanxue", 1]
          ]}
        ]
      },
      {
        id: "dahan",
        name: "大寒 · 岁末",
        season: "winter",
        iceLane: 2,
        brief: "大寒，十二月中。寒气之逆极——一年最后一战，所有冬灾倾巢而出。",
        intro: {
          lore: "大寒，十二月中。寒气之逆极，故谓大寒——一年最后一战，守过这一关，就是来年。",
          howto: "大雪怪、寒潮、蚜虫一起来。用大寒塔冻住它们，惊蛰雷轰，守住仓廪过岁末。",
          enemies: ["daxueguai", "hanxue", "yachong"],
          towers: ["lichun", "yushui", "jingzhe", "guyu", "mangzhong", "xiazhi", "xiaoshu", "liqiu", "bailu", "shuangjiang", "lidong", "daxue", "dahan"]
        },
        waves: [
          { banner: "一波 · 岁末寒潮", spawns: [
            [0, "hanxue", 1], [3, "yachong", 0]
          ]},
          { banner: "二波 · 雪怪成群", spawns: [
            [0, "daxueguai", 2], [3, "daxueguai", 3]
          ]},
          { banner: "灾潮 · 大寒总攻", spawns: [
            [0, "hanxue", 0], [3, "daxueguai", 2], [5, "daxueguai", 1], [7, "yachong", 3]
          ]}
        ]
      }
    ],
    knowledge: [
      "立春为二十四节气之首，《月令七十二候集解》：「立春，正月节。立，建始也。」东风解冻，蛰虫始振。",
      "惊蛰，二月节。《月令七十二候集解》：「万物出乎震，震为雷，故曰惊蛰，是蛰虫惊而出走矣。」春雷响，虫潮生——塔防的敌潮，正是从惊蛰开始的。",
      "二十四节气是上古农耕文明的历法智慧：何时播种、何时防虫、何时抢收，全在节气里。守田，就是守节气。",
      "立夏，四月节。《月令七十二候集解》：「蝼蝈鸣，蚯蚓出。」天热虫动，飞蝗始生——古人防蝗，是全村的头等大事。",
      "小暑大暑，上蒸下煮。旱魃是神话中的旱神，《诗经》：「旱魃为虐，如惔如焚。」赤地千里，是农人最怕的灾。",
      "大暑，六月中。湿热交蒸，暴雨成涝。古人修渠筑堤，就是为了在涝灾里保住田与粮。",
      "立秋，七月节。《月令七十二候集解》：「秋，揫也，物于此而揫聚也。」秋收开始，仓廪渐实。",
      "白露，八月节。露凝而白，秋意渐深。《诗经》：「蒹葭苍苍，白露为霜。」",
      "霜降，九月节。气肃而霜，草木黄落。这是秋收最后一战，收完这一茬，田就歇了。",
      "立冬，十月节。水始冰，地始冻。田垄结冰，冬藏开始。",
      "大雪，十一月节。雪封田垄，天寒地冻。瑞雪兆丰年——雪是庄稼的被子。",
      "大寒，十二月中。寒气之逆极，故谓大寒。守过这一年最后一关，就是来年。"
    ],
    enemyCodex: {
      yachong: { name: "蚜虫", lore: "春气一动，蚜虫先醒。它们成群结队吸食嫩芽，是田里最早也最多的害虫。", tip: "速度快，血量低——成群而来，适合范围轰击。" },
      ditouhu: { name: "地老虎", lore: "昼伏夜出，藏身土中，专咬幼苗根茎。老农说：苗一歪，地老虎就来过。", tip: "皮糙肉厚，移动慢——需要持续火力。" },
      daochunhan: { name: "倒春寒", lore: "春暖忽寒，谓之倒春寒。一场冷空气南下，冻伤秧苗，也冻住守田的人。", tip: "寒气会周期性冻结附近的节气塔（3 秒）——别把塔都堆在一处。" },
      huangchong: { name: "蝗虫", lore: "蝗虫过境，蔽日而来，所过之处禾稼皆空。古人视蝗为头等大灾，设官专治。", tip: "会飞：地面塔打不着，只有夏至塔和惊蛰雷能命中。" },
      hanba: { name: "旱魃", lore: "旱魃为虐，如惔如焚。它是神话里的旱神，一出则赤地千里。", tip: "血量极厚——用灼烧持续烧，配合减速慢慢磨。" },
      honglao: { name: "洪涝", lore: "大暑暴雨，水道暴涨。洪涝顺流直下，冲田毁渠，一泻千里。", tip: "在水道里游得飞快——把火力堆在水道两侧。" },
      yezhu: { name: "野猪", lore: "秋收时节，谷香满山，野猪闻香下山，拱田毁稼，是秋收大敌。", tip: "会冲撞：撞上你的塔同归于尽——别把塔放它必经之路。" },
      qiuhuang: { name: "秋蝗", lore: "秋蝗是蝗虫的秋世代，秋收前最后一波蝗灾，专啃将熟的谷穗。", tip: "会飞：只有夏至塔和惊蛰雷能打。" },
      zaoshuang: { name: "早霜", lore: "白露之后，早霜不期而至，一夜之间冻伤未收的庄稼。", tip: "会周期性冻结附近的节气塔——塔别堆在一处。" },
      hanxue: { name: "寒潮", lore: "立冬之后，寒潮南下，一夜之间天寒地冻，万物萧瑟。", tip: "会冻结附近的节气塔——塔分散放。" },
      daxueguai: { name: "大雪", lore: "大雪封山，雪怪成形，皮糙肉厚，踏雪而来。", tip: "血量极厚——用灼烧和重击慢慢磨。" }
    },
    achievements: [
      { id: "first_win", name: "首守有成", desc: "第一次守住田垄" },
      { id: "perfect", name: "仓廪无损", desc: "一局之中未漏一虫" },
      { id: "jingzhe_win", name: "惊蛰惊雷", desc: "守住惊蛰关" },
      { id: "killer_50", name: "除虫五十", desc: "累计击杀 50 只害虫" },
      { id: "rich_500", name: "仓廪充实", desc: "单局持有 500 谷" },
      { id: "all_codex", name: "格物致知", desc: "集齐全部害虫图鉴" }
    ]
  };
})();
