### Task 4: 三幕互动 + 状态机

**Files:** Create `assets/divine.js`；Modify `assets/main.js`（手势接线）

**Interfaces:** Produces `QQDivine.*`（契约见上）、`window.__game`

- [ ] **Step 1: divine.js 状态机** — S={phase:"home"|"water"|"calm"|"drop"|"reveal"|"result", t, waterP(0-1), calmT, calmValue(0-100), needleY, moonlight, revealP, result:null, rng, lastShadowId}
  - `start()`：rng=QQRng(testMode?20260819:(Date.now()>>>0))；phase="water"；waterP=0
  - water 阶段：`holdWater(true)` 期间 waterP += dt/FILL_TIME；到 1 → phase="calm"，emit('filled')，ripple(1)
  - calm 阶段：calmT 累加；呼吸圈半径 = f(calmT mod CALM_CYCLE)（由 main 渲染）；`releaseCalm()` 在圈收束到最小时松手为满分：偏差 dev=|phasePos - 1|（phasePos=(calmT mod CYCLE)/CYCLE，收束点=1）；calmValue = round(max(0, 100 - dev*220))；phase="drop"，emit('calmed')
  - drop 阶段：`dropNeedle()` → 针下落动画 needleY 0→1（0.5s 缓动），触水 ripple(1.5)，emit('dropped')，0.4s 后 phase="reveal"
  - reveal 阶段：revealP += dt/REVEAL_TIME；moonlight = 0.5+0.5*revealP；到 1 → 抽取结果（见 Step 2）→ phase="result"，emit('revealed') 后 emit('result')
  - update(dt) 按 phase 推进；paused/边界处理
- [ ] **Step 2: 抽取与拼装**
  - `pickShadow()`：权重表——吉影各 JI_WEIGHT，槌/烛各 ZHUO_WEIGHT；图鉴未解锁 ×UNLOCK_BOOST（QQSave 判空守卫）；排除 lastShadowId（若抽中重抽一次）；加权抽取
  - `pickAspect()`：均权 5 选 1
  - `pickGrade(calmValue)`：基础权重 [10,22,34,24,10]（上上→未得）；calmValue 偏移：w_i *= 1 + (calmValue-50)/50 * skew_i，skew=[0.9,0.5,0,-0.4,-0.9]；归一化抽取
  - result = {shadow, aspect, grade, calmValue, knowIdx}；knowIdx = runs % FACTS.length
  - `lastShadowId` 更新；runs 计数存 QQSave
- [ ] **Step 3: save.js**（新增，index.html 在 data.js 后加载）：`window.QQSave`：load()->{codex:[],runs:0,lastShadow:""}、save、unlock(id)->bool、codexCount()；key "qiqiao-save"；game 侧调用全部判空守卫
- [ ] **Step 4: `window.__game` 钩子**：snapshot（S 标量拷贝+result 摘要）、start、holdWater(on)、releaseCalm、dropNeedle、setCalm(v)（测试注入心诚值）、forcePhase(p)、unlockAll、save
- [ ] **Step 5: main.js 手势**：ceremony 视图内——water 阶段：pointerdown→holdWater(true)，pointerup/leave→holdWater(false)；calm 阶段：渲染呼吸圈（canvas 上层，圆心盆中央，半径 90u→20u 按 phasePos 收缩，月白描边）+ pointerup→releaseCalm()；drop 阶段：pointerdown→dropNeedle()；阶段提示文字 #phase-hint 随 phase 切换（「长按舀水，注满此盆」/「圈收至心时松手，定心」/「点按，投针」）
- [ ] **Step 6: 无头验证**（?test=1）：start→phase water；holdWater(true) 2s→filled→calm；等待收束点附近 releaseCalm→calmValue>60；dropNeedle→dropped→reveal；等待 REVEAL_TIME→result 非空且 shadow/aspect/grade 合法；setCalm(90) 连跑 50 局统计：上上巧+上巧占比 > setCalm(10) 的占比；连续 20 局影形无相邻重复
- [ ] **Step 7: 记录进度**

---

