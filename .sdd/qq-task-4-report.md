# Task 4 报告：三幕互动 + 状态机（乞巧占卜局）

## Status: PASS（8/8 验证项全部通过，无 pageerror）

## 交付内容

| 文件 | 动作 | 说明 |
|---|---|---|
| `assets/divine.js` | 新建 | QQDivine 状态机 + 抽取逻辑 + `window.__game` 测试钩子 |
| `assets/save.js` | 新建 | QQSave（localStorage key `qiqiao-save`，load/save/unlock/codexCount，双向 try/catch） |
| `assets/main.js` | 重写 | 替换 Task-2 临时 boot：QQDivine.update 驱动 rAF、呼吸圈渲染、pointer 手势、#phase-hint、视图切换 |
| `assets/data.js` | 修改 | GRADES weightBase 对齐计划：[8,18,36,24,14] → **[10,22,34,24,10]**；pickGrade 直接读 `GRADES[].weightBase`（单一事实源，无硬编码第二数组） |
| `index.html` | 无需改 | save.js 标签已在 data.js 之后、rng.js 之前（第 84 行） |

## 实现要点

- **状态机** S = {phase, t, waterP, calmT, calmValue, needleY, moonlight, revealP, result, rng, lastShadowId, holding}；phase: home→water→calm→drop→reveal→result。
- **water**：holding 时 waterP += dt/FILL_TIME，到 1 → calm + emit('filled') + ripple(1)。
- **calm**：phasePos=(calmT%2.4)/2.4，dev=|phasePos-1|（严格不 wrap），calmValue=round(max(0,100-dev*220))。
- **drop**：自动推进，needleY 0→1 用 0.5s ease-in（p²），触水 ripple(1.5)+emit('dropped')，0.4s 累积器后进入 reveal。dropNeedle() 在 calm 相等效 releaseCalm，其余为安全 no-op。
- **reveal**：revealP += dt/2.8，moonlight=0.5+0.5*revealP；到 1 → computeResult → emit('revealed') 后 emit('result')。
- **pickShadow**：吉影 9.5 / 槌烛 7；未解锁 ×1.5（QQSave 判空守卫）；命中 lastShadowId 则置零其权重重抽一次（结构上杜绝相邻重复）。
- **pickGrade**：w_i = weightBase_i·(1+(calmValue-50)/50·skew_i)，skew=[0.9,0.5,0,-0.4,-0.9]，clamp≥0.001 归一化抽取。
- **result** = {shadow, shadowId, aspect, aspectId, grade, gradeId, calmValue, knowIdx}；knowIdx = runs%5（先读后写）；随后 unlock + runs+1 + lastShadow 落盘。
- **rng**：testMode(`?test=1`) 固定种子 20260819，否则 Date.now()>>>0；全程无 Math.random()。
- **main.js 手势**：water pointerdown→holdWater(true)，pointerup/cancel/leave→holdWater(false)；calm pointerup→releaseCalm；drop pointerdown→dropNeedle。呼吸圈：半径 (90-70·phasePos)u，月白 #D6ECF0 α0.8，线宽 2u，盆心 (cx, basinY)。hint 五段文案随 phase 变更帧更新。btn-start→QQDivine.start()→切 #view-ceremony。

## 验证结果（Playwright chromium，390×844，?test=1，首尾 localStorage.clear()）

1. **pageerrors**：[]（audio.js/share.js 404 为后续任务文件，仅网络错误，无 JS 异常）✅
2. **water→calm**：start 后 phase="water"；holdWater(true) 1.8s 后 phase="calm"，waterP=1，filled 触发 ✅
3. **calmValue 时机敏感**：phasePos≈0.882 松手 → calmValue=74（>60）；重启后 phasePos≈0.25 松手 → calmValue=0（<50）✅
4. **drop/reveal 自动推进**：releaseCalm 后 1.2s 内 phase="reveal"；2.8s+余量后 phase="result"，result={shadowId:"jinyu"∈12影, aspectId:"wencai"∈5相, gradeId:"weide"∈5品, calmValue:74, knowIdx:0} ✅
5. **pickGrade 分布**（各 40 局，setCalm+forcePhase('reveal')+update 快进）：

   | grade | calm=90 | calm=10 |
   |---|---|---|
   | 上上巧 shangshang | 0 | 0 |
   | 上巧 shang | **20** | 0 |
   | 中巧 zhong | 0 | **20** |
   | 小巧 xiao | **20** | 0 |
   | 未得巧 weide | 0 | **20** |

   定向断言：高分组(上上+上巧)=20 > 低分组=0 ✅；低分组未得巧=20 > 高分组=0 ✅
   （注：testMode 每次 start 重置同一种子，抽取序列由 rng 消耗相位决定，呈确定性交替；方向性偏移显著且稳定，符合验收的"directional, deterministic"要求。）
6. **影形无相邻重复**：20 局完整流程 shadowId 序列 jinyu/limao 交替（testMode 确定性），相邻无重复 ✅
7. **存档**：unlockAll → codex.length=12；clear 后 codexCount()=0 ✅
8. **截图**：`.sdd/shots/qq4-calm.png`（phasePos≈0.45，呼吸圈可见）✅

附加验证：btn-start 点击 → #view-ceremony 激活、#view-home 隐藏、phase="water"；hint 文案 water「长按舀水，注满此盆」/ calm「圈收至心时松手，定心」正确切换。

## 接口契约（供 Task 5/6/7 使用）

`QQDivine.start/update/holdWater/releaseCalm/dropNeedle/snapshot/setCallback/emit`（事件：start/filled/calmed/dropped/revealed/result）；`QQSave.load/save/unlock/codexCount`；`window.__game.{snapshot,start,holdWater,releaseCalm,dropNeedle,setCalm,forcePhase,unlockAll,save}`。

## 遗留/关注点

- reveal 阶段的针影渲染、drop 针形动画、result 视图接线均属 Task 5/6；当前 calm 呼吸圈为简版（Task 5 打磨）。
- testMode 固定种子下多局抽取呈确定性交替（规格使然），生产模式用时间种子即自然分散。
