# 后羿射日 · 游戏性扩展设计文档

> 基于 MDA 框架 (Mechanics → Dynamics → Aesthetics) 设计
> 目标：从 6 关单一玩法 → 10 关多元组合，引入箭种/敌种/墙种/成就/评分

---

## 一、箭种类 (Arrow Types)

| ID | 名称 | 机制 (Mechanics) | 动态 (Dynamics) | 美学 (Aesthetics) | 解锁关卡 |
|----|------|-----------------|-----------------|-------------------|---------|
| `plain` | 素缯 | 标准抛物线，HP伤害=impact×6 | 精确瞄准，基础弹道 | 专注、掌控感 | L1 默认 |
| `fire` | 火箭 | 命中后点燃附近扶桑（持续灼烧5秒，每秒3HP） | 射枝干→火势蔓延→连锁塌毁 | 毁灭快感、连锁惊喜 | L3 |
| `heavy` | 重箭 | density×2.5，frictionAir=0.01，MAX_SPEED×0.7 | 碰撞破坏力强，射程短 | 沉重力量感 | L4 |
| `split` | 裂箭 | 飞行30帧后分裂为3支（扇形±15°），子箭伤害×0.6 | 一射三，覆盖面大 | 灵动、多变 | L6 |
| `pierce` | 穿云箭 | 穿透第一个结构后继续飞行（不减速），穿透后伤害×0.5 | 一箭双雕，贯穿结构 | 锐利、穿透感 | L7 |

### 数据结构 (data.js)
```js
var ARROW_TYPES = {
  plain:  { name:'素缯', density:0.005, frictionAir:0, maxSpeed:17.2, dmgMul:1.0, special:null },
  fire:   { name:'火箭', density:0.005, frictionAir:0, maxSpeed:17.2, dmgMul:1.0, special:'fire', burnDmg:3, burnTime:300 },
  heavy:  { name:'重箭', density:0.0125, frictionAir:0.01, maxSpeed:12.0, dmgMul:1.5, special:null },
  split:  { name:'裂箭', density:0.004, frictionAir:0, maxSpeed:17.2, dmgMul:0.6, special:'split', splitFrame:30 },
  pierce: { name:'穿云', density:0.006, frictionAir:0, maxSpeed:17.2, dmgMul:1.0, special:'pierce', pierceCount:1 }
};
```

### 关卡箭种配置
每关给 5 支箭，但箭种配比不同：
- L1: 5×plain
- L2: 5×plain
- L3: 3×plain + 2×fire
- L4: 2×plain + 2×heavy + 1×fire
- L5: 2×plain + 1×heavy + 2×fire
- L6: 2×plain + 2×split + 1×fire
- L7: 1×plain + 2×split + 1×pierce + 1×heavy
- L8: 1×plain + 1×split + 1×pierce + 2×fire
- L9: 1×plain + 1×split + 1×pierce + 1×heavy + 1×fire
- L10: 2×plain + 1×pierce + 1×heavy + 1×fire (留一日模式)

---

## 二、敌人种类 (Enemy Types)

| ID | 名称 | HP | 行为 | 外观 | 出现关卡 |
|----|------|----|------|------|---------|
| `jinwu` | 金乌 | 14 | 栖息不动，一击即杀 | 红橙火鸟，三足 | L1-L10 |
| `qingniao` | 青鸟 | 10 | 每120帧在栖点间水平移动 | 青蓝色小鸟 | L5-L9 |
| `zhuque` | 朱雀 | 35 | 栖息不动，需2-3箭 | 深红大鸟，有火焰光晕 | L7-L10 |
| `bifang` | 毕方 | 22 | 死亡时爆炸（半径60px，伤害=40） | 独足青鸟，有雷光 | L9-L10 |

### 数据结构 (data.js)
```js
var ENEMY_TYPES = {
  jinwu:   { name:'金乌', hp:14, radius:34, scale:1.7, behavior:'perch', color:'#E0512B' },
  qingniao:{ name:'青鸟', hp:10, radius:28, scale:1.4, behavior:'patrol', speed:1.5, color:'#3A8FB7' },
  zhuque:  { name:'朱雀', hp:35, radius:40, scale:2.0, behavior:'perch', color:'#C03028' },
  bifang:  { name:'毕方', hp:22, radius:32, scale:1.6, behavior:'perch', deathExplosion:{ r:60, dmg:40 }, color:'#4A6B3A' }
};
```

---

## 三、墙/结构种类 (Wall Types)

| ID | 名称 | HP | 特性 | 外观 | 出现关卡 |
|----|------|----|------|------|---------|
| `fusan` | 扶桑木 | 45 | 标准，碎块可连锁 | 棕色木质纹理 | L1-L10 |
| `bronze` | 青铜柱 | 200 | 极硬，重箭×1.5伤害，火箭无效 | 青绿色金属 | L6-L10 |
| `glaze` | 琉璃墙 | 30 | 碎裂时产生5个碎片（动态刚体，可砸鸟） | 半透明蓝白 | L7-L10 |
| `vine` | 藤蔓 | 20 | 柔韧（restitution=0.4），吸收冲击，被箭穿过减速 | 绿色藤条 | L5-L9 |

### 数据结构 (data.js)
```js
var WALL_TYPES = {
  fusan:   { name:'扶桑木', hp:45, density:0.0018, friction:0.85, restitution:0.02, fireResist:false, shardOnBreak:false },
  bronze:  { name:'青铜柱', hp:200, density:0.004, friction:0.6, restitution:0.01, fireResist:true, shardOnBreak:false },
  glaze:   { name:'琉璃墙', hp:30, density:0.002, friction:0.5, restitution:0.01, fireResist:false, shardOnBreak:true, shardCount:5 },
  vine:    { name:'藤蔓', hp:20, density:0.001, friction:0.9, restitution:0.4, fireResist:false, shardOnBreak:false, arrowSlow:0.5 }
};
```

---

## 四、难度梯度设计 (Level Progression)

> 每关只引入1个新元素（MDA: 避免认知过载）

| 关 | 名称 | 新元素 | 箭种 | 敌人 | 墙 | 目标 | 难度要点 |
|----|------|--------|------|------|-----|------|---------|
| L1 | 初射一日 | — | 5×素缯 | 1金乌 | 扶桑 | birds | 教学：拉弓→瞄准→放箭 |
| L2 | 再落二乌 | 日轮 | 5×素缯 | 2金乌 | 扶桑 | birds | 双目标+日轮阻挡 |
| L3 | 扶桑初崩 | **火箭** | 3素+2火 | 2金乌 | 扶桑 | birds | 火烧结构→连锁 |
| L4 | 彤弓仰射 | **重箭** | 2素+2重+1火 | 2金乌 | 扶桑 | birds | 高位目标+重箭破结构 |
| L5 | 青鸟掠空 | **青鸟**/**藤蔓** | 2素+1重+2火 | 1金乌+1青鸟 | 扶桑+藤蔓 | birds | 移动目标+藤蔓减速 |
| L6 | 青铜之坚 | **裂箭**/**青铜** | 2素+2裂+1火 | 2金乌 | 扶桑+青铜 | birds | 青铜挡路→裂箭绕过 |
| L7 | 琉璃碎影 | **穿云箭**/**琉璃** | 1素+2裂+1穿+1重 | 2金乌+1朱雀 | 扶桑+琉璃+青铜 | birds | 穿透琉璃→击杀朱雀 |
| L8 | 朱雀涅槃 | 朱雀 | 1素+1裂+1穿+2火 | 1金乌+2朱雀 | 扶桑+琉璃 | birds | 多血量目标+火烧连锁 |
| L9 | 九日俱落 | **毕方** | 1素+1裂+1穿+1重+1火 | 1金乌+1青鸟+1朱雀+1毕方 | 扶桑+青铜+琉璃+藤蔓 | birds | 全要素综合 |
| L10 | 留一日 | 终关 | 2素+1穿+1重+1火 | 1金乌(spare)+日轮 | 扶桑+青铜 | spare | 留一日，射余烬 |

---

## 五、评分系统 (Scoring System)

### 基础分
| 项目 | 分值 |
|------|------|
| 击杀金乌 | 120/只 |
| 击杀青鸟 | 100/只 |
| 击杀朱雀 | 200/只 |
| 击杀毕方 | 150/只 |
| 击碎日轮 | 25/枚 |
| 击碎扶桑 | 15/块 |
| 击碎青铜 | 30/块 |
| 击碎琉璃 | 20/块 |
| 击碎藤蔓 | 10/块 |

### 奖励分
| 项目 | 条件 | 分值 |
|------|------|------|
| 效率奖励 | 每支剩余箭 | +40/支 |
| 连锁奖励 | 一箭杀2+敌 | +50×(n-1) |
| 远程奖励 | 射程>600px击杀 | +30 |
| 结构坍塌 | 碎块砸死鸟 | +60/只 |
| 完美通关 | 零箭浪费 | +100 |
| 穿透奖励 | 穿云箭一箭双杀 | +80 |

### 星级评定
| 星级 | 条件 |
|------|------|
| ★★★ | 剩余箭≥2 且 分数≥通关线×1.3 |
| ★★ | 剩余箭≥1 或 分数≥通关线×1.1 |
| ★ | 通关 |

---

## 六、成就系统 (Achievement System)

### 成就列表 (12枚)

| ID | 名称 | 条件 | 类型 | 神话出处 |
|----|------|------|------|---------|
| `first_shot` | 初射日 | 通关L1 | 里程碑 | 尧乃使羿，上射十日 |
| `nine_down` | 九乌俱落 | 通关L1-L9（射落九日） | 里程碑 | 中其九日，日中九乌皆死 |
| `one_sun` | 留一日 | 通关L10（留一日模式） | 里程碑 | 羿留一日，天下复有昼夜 |
| `all_stars` | 一弓定天 | 全关三星 | 大师 | 帝俊赐羿彤弓素缯 |
| `long_shot` | 百步穿杨 | 射程>800px击杀 | 技巧 | 养由基百步穿杨 |
| `chain_kill` | 连珠箭 | 一箭杀2+敌 | 技巧 | 连珠箭法 |
| `efficiency` | 不射之射 | 通关时剩3+箭 | 技巧 | 列子·不射之射 |
| `fire_master` | 火神之怒 | 火箭累计杀5敌 | 累计 | 火神祝融 |
| `destroyer` | 扶桑倾颓 | 累计毁50结构 | 累计 | 扶桑倾颓 |
| `pierce_kill` | 贯日长虹 | 穿云箭一箭双杀 | 技巧 | 白虹贯日 |
| `bifang_blast` | 雷殛 | 毕方爆炸杀敌 | 技巧 | 毕方之雷 |
| `grandmaster` | 射神 | 获得全部其他11枚成就 | 大师 | 后羿封神 |

### 数据结构 (data.js)
```js
var ACHIEVEMENTS = [
  { id:'first_shot',  name:'初射日',     desc:'通关第一关',                    myth:'尧乃使羿，上射十日' },
  { id:'nine_down',   name:'九乌俱落',   desc:'射落九日',                      myth:'中其九日，日中九乌皆死' },
  { id:'one_sun',     name:'留一日',     desc:'通关留一日模式',                myth:'羿留一日，天下复有昼夜' },
  { id:'all_stars',   name:'一弓定天',   desc:'全关三星',                      myth:'帝俊赐羿彤弓素缯' },
  { id:'long_shot',   name:'百步穿杨',   desc:'800px外射杀金乌',               myth:'养由基百步穿杨' },
  { id:'chain_kill',  name:'连珠箭',     desc:'一箭击杀两只敌人',              myth:'连珠箭法，一矢双雕' },
  { id:'efficiency',  name:'不射之射',   desc:'通关时剩余三支以上素缯',        myth:'列子载：不射之射' },
  { id:'fire_master', name:'火神之怒',   desc:'火箭累计击杀五只敌人',          myth:'祝融降火，火神之怒' },
  { id:'destroyer',   name:'扶桑倾颓',   desc:'累计摧毁五十个结构',            myth:'汤谷扶桑，倾颓九枝' },
  { id:'pierce_kill', name:'贯日长虹',   desc:'穿云箭一箭击杀两只敌人',        myth:'白虹贯日' },
  { id:'bifang_blast',name:'雷殛',       desc:'毕方爆炸击杀另一敌人',          myth:'毕方现，则有雷电' },
  { id:'grandmaster', name:'射神',       desc:'获得全部其他成就',              myth:'后羿封神，万世传颂' }
];
```

### 存档扩展
```js
// localStorage 'houyi-save' 新增字段：
{
  cleared: ['l1','l2',...],
  best: { l1:{score:800,stars:3}, ... },
  sunsDown: 9,
  achievements: ['first_shot','long_shot',...],  // 已解锁成就ID
  stats: {
    totalFireKills: 0,    // 火箭累计击杀
    totalBlocksBroken: 0, // 累计结构破坏
    maxChainKills: 0,     // 最大连杀
    maxDistance: 0         // 最远击杀距离
  }
}
```

---

## 七、实现分层

### Phase 1: 数据层 (data.js)
- 添加 ARROW_TYPES, ENEMY_TYPES, WALL_TYPES, ACHIEVEMENTS
- 重构 LEVELS 为10关，每关含 arrowLoad, enemyTypes, wallTypes

### Phase 2: 引擎层 (engine.js)
- makeArrow(arrowType) → 按 ARROW_TYPES 配置物理参数
- makeJinwu(enemyType) → 按 ENEMY_TYPES 配置HP/半径/行为
- makeFusan(wallType) → 按 WALL_TYPES 配置HP/材质
- 火箭特殊逻辑：命中后给目标加 burning 状态
- 裂箭特殊逻辑：飞行N帧后分裂
- 穿云箭特殊逻辑：碰撞时不销毁，穿透后继续
- 青鸟巡逻逻辑：每N帧水平移动
- 毕方死亡爆炸：destroy时AOE伤害
- 琉璃墙碎裂：destroy时生成碎片刚体
- buildResult 增强：combo/distance/perfect 奖励

### Phase 3: UI层 (main.js, scene.js, index.html)
- 战前简报：显示本关箭种配比（图标列表）
- 战斗HUD：当前箭种指示器（剩余箭种切换）
- 结算页：分数明细（基础+奖励+总计）+ 成就解锁弹窗
- 首页：成就墙入口
- 成就页：12枚成就列表（已解锁/未解锁）

### Phase 4: 存档系统 (main.js)
- loadSave/writeSave 扩展 achievements + stats
- 每关结算时检查成就解锁条件
- 成就解锁时 toast 提示 + 弹窗

---

## 八、难度曲线 (Flow Channel)

```
难度
 ↑
高│                    L9  L10
  │              L7  L8
中│        L5  L6
  │    L3  L4
低│  L1  L2
  └──────────────────→ 关卡
    教学  引入  组合  综合  终关
```

- L1-L2: **教学期** — 单一箭种+单一敌人，学习基础操作
- L3-L4: **引入期** — 每关引入1个新箭种，结构变复杂
- L5-L6: **组合期** — 新敌人+新墙种，需要策略选择
- L7-L8: **高级期** — 穿云箭+琉璃+朱雀，多血量目标
- L9-L10: **综合期** — 全要素组合，终关留一日
