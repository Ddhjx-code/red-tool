# 乞巧占卜局 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现「非遗手作坊」#9《乞巧占卜局》——七夕「丢针试巧」占卜小工具：舀水→定心→投针→显影仪式，12 影形×5 面向×5 品级 = 300 组合解读，打包 dist/qiqiao.zip。

**Architecture:** 沿用龙舟架构：纯原生 JS（IIFE + `window.QQ*` 全局），Canvas 2D 渲染夜空/水盆/针/影，DOM 负责视图/结果卡/图鉴。占卜结果 = 影形×面向×品级三层组合现场拼装。

**Tech Stack:** 原生 JS/CSS/HTML、Canvas 2D、WebAudio、localStorage、Playwright（无头验证，python 版已装）。

**Spec:** `docs/specs/2026-08-19-qiqiao-design.md`（文化依据见 `docs/research/qixi-research.md`）

## Global Constraints

- 容器规范（`.skill/references/`）：`index.html` 在 zip 根；脚本全部外置、禁内联/行内事件/eval；禁网络/剪贴板/下载/外链/传感器/Worker/iframe；资源相对路径 `./assets/...`；仅 html/css/js/json/图片/字体入 zip
- 端能力出口：`window.xhs?.miniTool` 判空降级（writeTempFile → saveImageToPhotosAlbum / postNote），按钮用户主动点击
- 安全区：`var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`，viewport 含 `viewport-fit=cover`
- 确定性渲染：禁 `Math.random()`，全部 mulberry32 种子随机；`?test=1` 固定种子 20260819 并暴露 `window.__game`
- 系列视觉 tokens：朱红 `#C3272B`、黛青 `#425066`、藤黄 `#FFB61E`、月白 `#D6ECF0`、宣纸 `#F5F0E6`；夜空 `#2e3d52→#1f2a3a`；标题字体栈 `"Kaiti SC","STKaiti","KaiTi",serif`
- 代码风格沿用现有工具：IIFE、`var`、`function(){}`、无注释、`addEventListener`、localStorage try/catch
- 包体目标 <1MB（纯代码）
- 结果数值锚点（spec 已定，勿擅改）：12 影形（10 吉 + 槌/烛 2 未得巧，各 ~7%）；5 面向（针工/文采/姻缘/家宅/财市）；5 品级（上上巧/上巧/中巧/小巧/未得巧）；未解锁影形权重 ×1.5；连续两次影形不重复；心诚值 0-100 偏移品级概率（不决定）
- 文案纪律：断语/知识卡措辞温和（未得巧带鼓励）；古籍引文按调研文档标注「转述」处理，不写项目编号

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `tools/qiqiao/index.html` | 单页视图：home / ceremony(canvas+引导浮层) / result / codex |
| `tools/qiqiao/assets/data.js` | `window.QQData`：12 影形{id,name,luck,meaning,text}、5 面向断语、5 品级断语、5 知识卡、调参常量 |
| `tools/qiqiao/assets/rng.js` | `window.QQRng`：mulberry32（同龙舟实现） |
| `tools/qiqiao/assets/scene.js` | `window.QQScene`：夜空/月/云/星/水盆/水面/涟漪/月光渲染 |
| `tools/qiqiao/assets/shadow.js` | `window.QQShadow`：12 影形矢量剪影绘制 + 结果卡内绘制 |
| `tools/qiqiao/assets/divine.js` | `window.QQDivine`：状态机(water/calm/drop/reveal/result)、心诚值、抽取、结果拼装、测试钩子 |
| `tools/qiqiao/assets/audio.js` | `window.QQSound`：WebAudio（注水/心跳/针落/显影磬/结果钟） |
| `tools/qiqiao/assets/share.js` | `window.QQShare`：900×1200 结果卡 + xhs jsapi 出口 |
| `tools/qiqiao/assets/main.js` | DOM 装配、视图切换、三幕手势、rAF 主循环、图鉴、demo 自驾 |
| `tools/qiqiao/assets/style.css` | 全部样式 |
| `tests/qiqiao_smoke.py` | Playwright 无头断言（仓库根，不入 zip） |

模块依赖（加载顺序）：`data.js → rng.js → audio.js → scene.js → shadow.js → divine.js → share.js → main.js`

核心接口契约（跨任务依赖，签名不得擅改）：

```js
// scene.js
QQScene.init(canvas)
QQScene.resize()
QQScene.draw(st, dt)        // st=divine snapshot：渲染夜空/水盆/涟漪/月光/针（按阶段）
QQScene.metrics()           // {W,H,u,cx,basinY,basinRx,basinRy}
QQScene.ripple(intensity)   // 触发一圈涟漪（投针/注水）

// shadow.js
QQShadow.draw(ctx, id, x, y, size, alpha)   // 12 影形剪影，size 为包围盒边长

// divine.js
QQDivine.start()                            // home→water
QQDivine.update(dt)
QQDivine.holdWater(on)                      // 舀水长按 true/false
QQDivine.releaseCalm()                      // 定心松手 -> 心诚值
QQDivine.dropNeedle()                       // 投针
QQDivine.snapshot()                         // 只读状态
QQDivine.setCallback(name, fn)              // 'filled'|'calmed'|'dropped'|'revealed'|'result'
window.__game                               // ?test=1 钩子（见 Task 4）

// share.js
QQShare.lastStats / QQShare.paintCard(stats) -> dataURL / QQShare.saveAlbum() / QQShare.postNote()
```

---

### Task 1: 骨架 + 数据 + 随机数

**Files:** Create `tools/qiqiao/index.html`、`assets/data.js`、`assets/rng.js`、`assets/style.css`

**Interfaces:** Produces `window.QQData`、`window.QQRng(seed)->{next,range,int,pick}`、四视图 DOM 骨架

- [ ] **Step 1: index.html**（模板同龙舟：viewport-fit=cover、外置脚本 8 个按依赖顺序、无内联）。视图：
  - `#view-home`：系列小字「非遗手作坊 · 七夕」+ 竖排标题「乞巧占卜局」+ 副题「丢针试巧，占一缕巧运」+ 最佳/图鉴进度行 `#home-progress` + `#btn-start`（起占）+ `#btn-codex-home`（影形图鉴）
  - `#view-ceremony`：`#stage` canvas 全屏 + `#tutor` 引导浮层 + `#phase-hint` 当前阶段提示文字（顶部）
  - `#view-result`：`#result-shadow-icon`(canvas 240×240) + `#result-shadow-name` + `#result-seal`(品级印章 span) + `#result-aspect` + `#result-text`（组合断语）+ `#result-know`（知识卡）+ `#result-codex`（图鉴 n/12）+ 按钮组 `#btn-again`/`#btn-codex-result`/`#btn-save-album`/`#btn-post-note`/`#btn-home-result`
  - `#view-codex`：头部（返回 `#btn-codex-back` + 标题 + `#codex-count`）+ `#codex-grid` + 详情弹层 `#codex-card`（canvas 120×120 + `#codex-card-name` + `#codex-card-text` + 关闭）
- [ ] **Step 2: data.js** — `QQData`：
  - `SHADOWS`：12 条 `{id,name,luck:"ji"|"zhuo",meaning,text}`，id：yun/mudan/xique/jinyu/fenghuang/limao/xiuxie/jiandao/yulong/lianhua/chui/zhuying；text 为影形断语（每条 1-2 句，温和古雅白话）
  - `ASPECTS`：5 条 `{id,name,text}`：zhenong 针工「指上生花…」/ wencai 文采 / yinyuan 姻缘 / jiazhai 家宅 / caishi 财市
  - `GRADES`：5 条 `{id,name,text,weightBase}`：shangshang 上上巧 / shang 上巧 / zhong 中巧 / xiao 小巧 / weide 未得巧，text 为品级断语
  - `FACTS`：5 条知识卡（spec §5 原文）
  - 常量：`ZHUO_WEIGHT: 7`（单个未得巧影形权重）、`JI_WEIGHT: 9.5`（吉影权重，合计 10×9.5+2×7=109，未得巧合计 ~12.8%）、`UNLOCK_BOOST: 1.5`、`CALM_CYCLE: 2.4`（呼吸圈一轮秒数）、`FILL_TIME: 1.5`（注满秒数）、`REVEAL_TIME: 2.8`（显影秒数）
- [ ] **Step 3: rng.js**（mulberry32，与龙舟 rng.js 相同实现，改名 QQRng）
- [ ] **Step 4: style.css** — tokens + 四视图样式（home 竖排标题同龙舟做法；result 印章朱红旋转 -6deg；codex 网格 3 列 `.codex-cell`/`.is-locked`/`.codex-cell-name`；ceremony 提示文字顶部安全区）
- [ ] **Step 5: 无头验证**：页面加载无运行时错误（未创建的脚本 404 可忽略）、`#view-home.is-active`、`QQData.SHADOWS.length===12`、断语字段齐全（每条 text 非空）
- [ ] **Step 6: 记录进度**（无 git，不 commit）

---

### Task 2: 夜空水盆场景（视觉检查点）

**Files:** Create `assets/scene.js`；Modify `assets/main.js`（临时启动）

**Interfaces:** Produces `QQScene.init/resize/draw/metrics/ripple`（契约见上）

- [ ] **Step 1: scene.js**
  - metrics：`u=W/400`；`cx=W/2`；`basinY=H*0.62`；`basinRx=W*0.36`；`basinRy=basinRx*0.42`（俯视椭圆）
  - 夜空：竖向渐变 #2e3d52→#1f2a3a 铺满；明月于 (W*0.72, H*0.16)，半径 34u，月白 #D6ECF0 + 外光晕（径向渐变 alpha 0.25）；星点 ~40 颗种子固定（LZRng(9)），其中 2 颗稍亮（织女/牵牛，位置固定：织女星 W*0.30,H*0.10；牵牛星 W*0.52,H*0.22）；薄云 2 条：椭圆叠合剪影 alpha 0.06，x 随 t 缓移（速度 3u/s、5u/s）
  - 水盆：盆沿椭圆环（瓷白 #e8e4d8 描边 6u + 青花线 #425066 细线两道）；盆内水面椭圆填充：径向渐变 中心 #3c5468 → 边缘 #2e3d52；月光高光：水面上一条斜向光带（椭圆裁切内，alpha 0.12 白色渐变，方向指向月亮方位）
  - 涟漪：`ripple(intensity)` 推入 {r:0, max:basinRx*0.9, alpha}；每帧 r+=dt*basinRx*1.2，alpha 线性衰减；渲染为水面椭圆内的同心椭圆描边（白色 alpha*0.35，线宽 1.5u）；列表裁剪
  - draw(st, dt)：按 st.phase 决定针/影是否渲染（针与影由 main 用 QQShadow/自定义绘制叠加，scene 只负责背景+水面+涟漪+月光强度）；月光强度 st.moonlight（0-1）影响高光带与星空亮度
- [ ] **Step 2: main.js 临时启动**：init + rAF `QQScene.draw({phase:"idle",moonlight:0.6}, dt)` + 每 2s 一次 ripple(1)，供截图
- [ ] **Step 3: 无头截图视觉检查**：390×844 截图 `.sdd/shots/qq2-scene.png`；程序化断言：basinY≈0.62H、盆沿像素与夜空像素色差明显、涟漪帧差存在。**视觉门禁：人眼确认夜色氛围成立**
- [ ] **Step 4: 记录进度**

---

### Task 3: 十二影形矢量

**Files:** Create `assets/shadow.js`

**Interfaces:** Produces `QQShadow.draw(ctx, id, x, y, size, alpha)`

- [ ] **Step 1: shadow.js** — 12 个影形剪影，统一在 size×size 包围盒内绘制（中心 x,y），墨色 `rgba(20,26,38,alpha)` 填充，风格=盆底投影（形状轮廓为主，细节 1-2 笔）：
  - yun 祥云：三团卷云连缀（圆弧叠合）
  - mudan 牡丹：层叠花瓣圆（3 层 8 瓣简化）
  - xique 喜鹊：鸟侧影（头/身/长尾一笔弧线）+ 一枝
  - jinyu 金鱼：椭圆身 + 扇尾 + 眼点
  - fenghuang 凤凰：长尾鸟影（冠+飘带尾 3 条弧线）
  - limao 狸猫：蜷卧猫影（圆身+耳+卷尾）
  - xiuxie 绣鞋：翘头弓鞋侧影 + 鞋口弧线
  - jiandao 剪刀：X 形双刃 + 环柄
  - yulong 玉龙：C 形龙身 + 角 + 须
  - lianhua 莲花：仰莲 7 瓣 + 莲蓬点
  - chui 槌影：粗短槌形（上粗下细圆头矩形）
  - zhuying 烛烟：竖直烛身 + 顶部一缕弯烟
  - 每个形状绘制后复位 transform/alpha；提供 `QQShadow.ids()` 返回 12 id 列表
- [ ] **Step 2: 无头验证**：离屏 canvas 逐个绘制 12 形，断言每个非空白（中心区域 alpha 覆盖率 >5%）；12 形两两像素差异 > 阈值（互不相同）；截图 `.sdd/shots/qq3-shadows.png`（12 宫格）
- [ ] **Step 3: 记录进度**

---

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

### Task 5: 显影动画 + 针渲染

**Files:** Modify `assets/main.js`（渲染循环）、`assets/scene.js`（如需月光联动）

**Interfaces:** Consumes QQDivine.snapshot()、QQShadow.draw

- [ ] **Step 1: 针渲染**：drop/reveal/result 阶段渲染银针——悬空期（drop 前段）：盆上方 60u 处水平细线 40u，sin 轻晃；落水后：浮于水面中心（盆中心偏上 10u），银白 #dfe6ee 线 + 微光
- [ ] **Step 2: 显影**：reveal 阶段在盆底（针下方 20u）渲染 QQShadow.draw(result.shadow.id)，alpha = revealP 的缓动（先模糊后清晰：用 3 层错位叠加模拟模糊，错位量 (1-revealP)*6u）；月光渐亮（scene.moonlight 联动）；涟漪在 reveal 前段自然平息（不再新增）
- [ ] **Step 3: result 阶段定格**：影形完全清晰 + 月光最亮，停留供阅读（等待用户点「看结果」或自动 1.2s 后切结果视图——用自动切换，保持流畅）
- [ ] **Step 4: 无头验证**：完整流程截图 4 张（water 注水中/calm 呼吸圈/drop 针落/reveal 显影中）存 `.sdd/shots/qq5-*.png`；断言 reveal 过程中影形 alpha 递增（像素采样）
- [ ] **Step 5: 记录进度**

---

### Task 6: 结果视图 + 组合拼装渲染

**Files:** Modify `assets/main.js`（结果视图渲染）

**Interfaces:** Consumes QQDivine result、QQData 断语

- [ ] **Step 1: 结果渲染**：'result' 事件 → 填充 #view-result：影形 canvas 240×240 画 QQShadow.draw（墨色剪影，宣纸底）；#result-shadow-name=影形名+寓意小字；#result-seal=品级名（印章样式）；#result-aspect=「巧运在 {面向名}」；#result-text = 影形断语 + 面向断语 + 品级断语 三段拼装（分三段 `<p>`）；#result-know=FACTS[knowIdx]；#result-codex=「图鉴 {n}/12」；showView("result")
  - 未得巧品级（weide）：印章用黛青色而非朱红（视觉区分，不刺眼）
- [ ] **Step 2: 按钮**：#btn-again→start()（runs++）；#btn-home-result→home+刷新进度行；#btn-codex-result→图鉴（origin=result）
- [ ] **Step 3: 首页进度**：#home-progress=「已集影形 {n}/12 · 历 {runs} 占」
- [ ] **Step 4: 无头验证**：forcePhase 到 result → 视图字段全非空；断语三段齐全；未得巧结果印章 class 正确；再占回到 water
- [ ] **Step 5: 记录进度**

---

### Task 7: 图鉴 + 分享出口

**Files:** Modify `assets/main.js`（图鉴视图）、Create `assets/share.js`

**Interfaces:** Produces `QQShare.paintCard/saveAlbum/postNote`

- [ ] **Step 1: 图鉴视图**（类龙舟 codex 实现）：网格 12 格 `.codex-cell`；已解锁：canvas 画影形 + 名称；未解锁：`.is-locked` 灰底「?」；点已解锁→#codex-card 弹层（影形大图 + name + meaning + text + 吉凶标注）；#codex-count=n/12；返回回来源视图；每次打开刷新
- [ ] **Step 2: 解锁时机**：'result' 事件时 QQSave.unlock(shadow.id)；首次解锁 toast「影形入鉴 · {name}」（toast 组件同龙舟：#tutor 复用或新增 #toast）
- [ ] **Step 3: share.js**：paintCard(stats) 900×1200——宣纸底+朱红双线框；顶部小字「非遗手作坊 · 七夕」；影形剪影居中大图（QQShadow.draw 墨色，360px）；影形名+品级印章（朱红/黛青按吉凶）；「巧运在 {面向}」+ 三段断语折行（~16 字/行，避头尾从简）；知识卡白底片；底部「图鉴 n/12 · 乞巧占卜局」；stats={shadowId,shadowName,grade,gradeName,aspect,textLines,know,codexCount}
  - saveAlbum()/postNote()：writeTempFile→saveImageToPhotosAlbum/postNote，判空降级 alert「当前环境暂不支持直接保存，请截图保存哦」；postNote title「七夕占得{品级名}·{影形名}」（≤20 字校验）、tags "#国风vibecoding #七夕 #乞巧 #非遗 #国风 #中式美学"
- [ ] **Step 4: main.js**：result 渲染时 QQShare.lastStats=...；#btn-save-album/#btn-post-note click 绑定
- [ ] **Step 5: 无头验证**：paintCard 返回 dataURL 900×1200；无 xhs 点击→降级 dialog；mock xhs→writeTempFile→postNote 参数合法（title≤20、mediaInfo 结构）；图鉴 unlockAll 后 12/12 全亮、localStorage 持久
- [ ] **Step 6: 记录进度**

---

### Task 8: 音效

**Files:** Create `assets/audio.js`；Modify `assets/main.js`（触发点）

**Interfaces:** Produces `window.QQSound`

- [ ] **Step 1: audio.js**（结构同龙舟 LZSound）：unlock/isMuted/setMuted（持久化到 QQSave）+ 音效：
  - water：注水声（带通噪声 800→1400Hz 扫频，holdWater 期间循环短段）
  - heartbeat：calm 阶段每 0.8s 一次低频搏动（sine 60Hz 短促）
  - drop：针落「叮」（三角波 1200→800Hz 0.3s + 微噪声）
  - reveal：磬声（sine 660+1320 双泛音 1.2s 衰减）
  - result：钟声（sine 220+440+660，2s 衰减）
  - 全部 try/catch + muted 早退 + ctx 懒创建
- [ ] **Step 2: main.js 触发**：首次 pointerdown unlock；filled→water 停；calm 进入启 heartbeat 循环、离开停；dropped→drop；revealed→reveal；result→result；首页静音按钮（home 视图加 `#btn-mute-home`，index.html 补元素+样式）
- [ ] **Step 3: 无头验证**：全部方法调用无异常（headless ctx suspended 状态）；静音持久化
- [ ] **Step 4: 记录进度**

---

### Task 9: 教学 + demo 自驾 + 打磨

**Files:** Modify `assets/main.js`

- [ ] **Step 1: 教学**：runs===0 首占：#tutor 依次提示三幕操作（随 phase 切换文案，water「长按舀水」/calm「圈收至心松手」/drop「点按投针」），进入 result 后不再出现
- [ ] **Step 2: demo 模式**（?demo=1）：boot 自动 start()；autopilot 按阶段自动操作——water：holdWater(true) 直到 filled；calm：在收束点（phasePos>0.94）releaseCalm；drop：0.5s 后 dropNeedle；result：停留 3s 展示卡片 → 自动再占（循环出素材）；非 demo 路径零影响
- [ ] **Step 3: 打磨**：阶段切换转场（canvas 层淡入淡出 0.3s）；呼吸圈收束瞬间微光反馈；结果视图入场动画（印章盖落 scale 1.3→1 + 微旋）
- [ ] **Step 4: 无头验证**：?demo=1 跑 60s：至少完成 2 次完整占卜、无 pageerror、无卡死（phase 持续推进）；普通模式 boot 停在 home
- [ ] **Step 5: 记录进度**

---

### Task 10: 无头断言套件定稿

**Files:** Create `tests/qiqiao_smoke.py`

- [ ] **Step 1: 套件**（参照 tests/longzhou_smoke.py 结构，?test=1，hermetic）：
  1. boot：#view-home.is-active；QQData.SHADOWS.length===12
  2. start→phase water；holdWater 注满→calm
  3. 收束点 releaseCalm→calmValue>60；乱点 releaseCalm（圈很大时）→calmValue<50
  4. drop→reveal→result 全流程；result 三要素合法（shadow∈12、aspect∈5、grade∈5）
  5. 组合拼装：result 视图三段断语非空
  6. 心诚值影响：setCalm(90)×30 局上品级占比 > setCalm(10)×30 局（统计断言，容差内）
  7. 影形不连续重复：20 局序列无相邻同影
  8. unlockAll→图鉴 12/12；清 storage 回 0/12
  9. 分享降级：无 xhs 点击→dialog
  10. console error 零收集；打印 SMOKE PASS
- [ ] **Step 2: Run** `python3 tests/qiqiao_smoke.py` ×3 稳定通过
- [ ] **Step 3: 记录进度**

---

### Task 11: 打包 + zip 冒烟 + 系列文档更新

**Files:** Create `dist/qiqiao.zip`；Modify `docs/series-plan.md`

- [ ] **Step 1: 打包前自检**（.skill 两份清单 grep 扫描禁用 API，零命中；无内联脚本）
- [ ] **Step 2: 打包** `cd tools/qiqiao && zip -r ../../dist/qiqiao.zip . -x '*.DS_Store'`；unzip -l 确认 index.html 在根、仅支持类型、<1MB
- [ ] **Step 3: zip 独立冒烟**：解压临时目录 → http.server 加载（纹理/无 file:// CORS 问题）→ 完整占卜一次、零报错、截图
- [ ] **Step 4: series-plan.md**：§3 表格加「9 | 乞巧占卜局 | 占卜测试型 | 丢针试巧仪式+300 组合解读 | ✅ 已完成（dist/qiqiao.zip）」；形式分类表补「占卜测试型」一行；§8 变更记录加一行
- [ ] **Step 5: 记录进度**

---

### Task 12: 发布素材

**Files:** Create `release/qiqiao/images/*.png`、`release/qiqiao/发布文案.md`；Modify `release/README.md`

- [ ] **Step 1: 截图**（?demo=1 + ?test=1 强制状态）：01-home / 02-calm（呼吸圈）/ 03-reveal（显影中）/ 04-result（吉影结果卡）/ 05-card（paintCard 导出 900×1200）/ 06-codex（图鉴 12/12）；3:4 竖屏（630×840@2x）
- [ ] **Step 2: 文案**（镜像 release/jianzhi/发布文案.md 结构）：标题备选 3 条（占卜测试向钩子，如「七夕我把针丢进水里，占出了……」）；正文=玩法三步+300 组合+丢针试巧史料（转述，标《帝京景物略》载）+七夕非遗事实（2006 首批）+CTA「评论区晒你的影形」；tags 行带 #国风vibecoding #七夕 #乞巧 @科技薯；配图表（封面建议 05-card 或 04-result）
- [ ] **Step 3: release/README.md**：发布进度表加行 9
- [ ] **Step 4: 记录进度**

---

## Self-Review 结论

- Spec 覆盖：结果系统三层组合（Task 4 Step 2 + Task 6）、三幕互动（Task 4）、显影动画（Task 5）、图鉴收集（Task 7）、分享出口（Task 7）、知识卡（Task 1 data + Task 6 渲染）、音效（Task 8）、教学/demo（Task 9）、视觉门禁（Task 2 Step 3）、验收（Task 10/11）——全覆盖
- 数值与 spec 一致（Global Constraints 逐项抄自 spec §1/§2）
- 接口签名在各任务间一致（QQScene/QQShadow/QQDivine/QQSave/QQShare）
- 已知风险：Task 2 视觉检查点需人眼确认（夜色氛围）；12 影形矢量质量需截图检查（Task 3 Step 2 有像素断言兜底）
