# 敦煌拾色 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现「非遗手作坊」#10《敦煌拾色》——从 3 幅风格化敦煌壁画提取 18 种矿物色（点按/隐藏/蒙尘擦除），集色入图鉴，拼两版式×三底色的专属色卡分享，打包 dist/dunhuang.zip。

**Architecture:** 沿用系列架构：纯原生 JS（IIFE + `window.DH*` 全局），Canvas 2D 渲染壁画与色卡，DOM 负责视图/控件。壁画 = 形状集合（归一化多边形/圆 + colorId），渲染与命中共用一份数据。

**Tech Stack:** 原生 JS/CSS/HTML、Canvas 2D、WebAudio、localStorage、Playwright（无头验证）。

**Spec:** `docs/specs/2026-08-19-dunhuang-colorcard-design.md`；视觉稿 `.sdd/mockups/card-scroll.png`、`card-zaojing.png`（用户已确认，两版式都要）

## Global Constraints

- 容器规范（`.skill/references/`）：`index.html` 在 zip 根；脚本全部外置、禁内联/行内事件/eval；禁网络/剪贴板/下载/外链/传感器/Worker/iframe；资源相对路径；仅支持类型入 zip
- 端能力：`window.xhs?.miniTool` 判空降级（writeTempFile → saveImageToPhotosAlbum / postNote），用户手势触发
- 安全区：`var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`，viewport-fit=cover
- 确定性：禁 `Math.random()`，全部 mulberry32；`?test=1` 固定种子 20260819 + `window.__game`；`?demo=1` 自驾
- 视觉 tokens：朱红 #C3272B、黛青 #425066、藤黄 #FFB61E、月白 #D6ECF0、宣纸 #F5F0E6；楷体栈 `"Kaiti SC","STKaiti","KaiTi",serif`
- 代码风格：IIFE、`var`、`function(){}`、无注释、addEventListener
- 包体 <1MB
- 18 色 hex 与名称以 spec §2.2 为准（勿擅改）；色卡版式以两张已确认视觉稿为准
- 壁画风格纪律：flat 色块 + 黛青勾线（2-3px，alpha ~0.55），色块内无渐变，造型从简但求辨识度

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `tools/dunhuang/index.html` | 视图：home / select / extract / build / result / codex |
| `tools/dunhuang/assets/data.js` | `window.DHData`：18 色、3 壁画形状、题字、知识卡、常量 |
| `tools/dunhuang/assets/rng.js` | `window.DHRng`：mulberry32 |
| `tools/dunhuang/assets/save.js` | `window.DHSave`：localStorage dunhuang-save |
| `tools/dunhuang/assets/mural.js` | `window.DHMural`：壁画渲染 + 命中检测 + 蒙尘层管理 |
| `tools/dunhuang/assets/extract.js` | `window.DHExtract`：提色状态机 + 飞入动画 + toast |
| `tools/dunhuang/assets/card.js` | `window.DHCard`：两版式色卡绘制（900×1200） |
| `tools/dunhuang/assets/audio.js` | `window.DHSound`：WebAudio 音效 |
| `tools/dunhuang/assets/main.js` | 装配：视图机、手势、拼卡控件、demo |
| `tools/dunhuang/assets/style.css` | 样式 |
| `tests/dunhuang_smoke.py` | 无头断言（仓库根，不入 zip） |

加载顺序：`data → save → rng → audio → mural → extract → card → main`

核心接口契约：

```js
// mural.js
DHMural.init(canvas)            // 绑定+resize
DHMural.load(muralId)           // 加载壁画形状，重置蒙尘/已提状态
DHMural.draw(dt)                // 渲染（含已提标记/蒙尘层）
DHMural.hitTest(x, y)           // -> shape|null（顶层优先）
DHMural.dustAt(x, y)            // 擦尘笔刷（destination-out）
DHMural.dustProgress(shapeId)   // -> 0-1 擦净进度
DHMural.markExtracted(shapeId)
DHMural.metrics()               // {W,H,u}

// extract.js
DHExtract.start(muralId)
DHExtract.update(dt)
DHExtract.tap(x, y)
DHExtract.snapshot()
DHExtract.setCallback(name, fn) // 'extracted'(首次)|'collected'|'alldone'

// card.js
DHCard.paint(opts) -> dataURL   // opts={colors:[{name,hex}], layout:'scroll'|'zaojing', bg:'paper'|'silk'|'night', title, source}
```

---

### Task 1: 骨架 + 数据 + 藻井壁画（视觉检查点 1）

**Files:** Create `tools/dunhuang/index.html`、`assets/data.js`、`assets/rng.js`、`assets/save.js`、`assets/style.css`、`assets/mural.js`；临时 `assets/main.js`

- [ ] **Step 1: index.html**（模板同系列：viewport-fit=cover、外置脚本按加载顺序）。六视图与元素 id：
  - `#view-home`：系列行「非遗手作坊 · 敦煌」+ 竖排标题「敦煌拾色」+ 副题「拾取千年矿物色，拼一张敦煌色卡」+ `#home-progress` + `#btn-start`（拾色）+ `#btn-codex-home`（矿物色谱）+ `#btn-mute-home`（声）
  - `#view-select`：标题「选一幅壁画」+ `#mural-list`（3 卡片：缩略 canvas 120×120 + 名称 + 时代 + 进度）
  - `#view-extract`：`#mural-canvas` + `#extract-toast` + 底部 `#palette-bar`（已提色圆点行）+ `#btn-build`（拼色卡）/ `#btn-codex-extract`（图鉴）/ `#btn-back-select`（换壁画）
  - `#view-build`：`#build-preview` canvas + `#color-chips` + `#layout-opts` + `#bg-opts` + `#title-opts` + `#btn-make-card`（成卡）+ `#btn-back-extract`
  - `#view-result`：`#result-card` canvas + `#btn-save-album` / `#btn-post-note` / `#btn-again` / `#btn-home-result`
  - `#view-codex`：`#btn-codex-back` + 标题「矿物色谱」+ `#codex-count` + `#codex-grid` + `#codex-card`（canvas 120×120 + `#codex-card-name` + `#codex-card-text` + `#codex-card-close`）
- [ ] **Step 2: data.js** — `DHData`：
  - `COLORS`：spec §2.2 全 18 色 `{id,name,hex,text}`
  - `TITLES`：`["敦煌拾色","飞天遗色","鹿王本生","藻井五色","石色千年"]`
  - `FACTS`：spec §7 五条
  - `MURALS`：`[{id:"feitian",name:"飞天",era:"盛唐"},{id:"jiuse",name:"九色鹿",era:"北魏"},{id:"zaojing",name:"藻井",era:"唐"}]`
  - `SHAPES`：`{feitian:[], jiuse:[], zaojing:[...]}`。形状格式 `{id, color:色id, kind:"poly"|"circle", pts:[[x,y]...], cx/cy/r, hidden?:1, dusty?:1}`，坐标 0-100 设计空间。**藻井六层**（绘制顺序）：① poly 石青 qingshi 外框方 (2,2)(98,2)(98,98)(2,98)；② poly 朱砂 zhusha 菱形 (50,10)(90,50)(50,90)(10,50)；③ poly 石绿 shilv 正方 (32,32)(68,32)(68,68)(32,68) dusty:1；④ poly 雌黄 cihuang 菱形 (50,26)(74,50)(50,74)(26,50)；⑤ poly 赭石 zheshi 正方 (42,42)(58,42)(58,58)(42,58)；⑥ circle 金 jin (50,50) r=7 hidden:1
  - 常量：`DUST_DONE:0.85`、`BRUSH_R:18`
- [ ] **Step 3: rng.js / save.js**（mulberry32 同系列；save `{codex:[],cards:0,lastBuild:null}`，key "dunhuang-save"，load/save/unlock(id)->bool/codexCount，try/catch）
- [ ] **Step 4: mural.js**
  - 设计空间→canvas：内容区取居中正方形（边长 min(W, H*0.62)，顶部留 hint 区）；记 ox/oy/scale 供 hitTest 反算
  - 渲染：按数组顺序 flat 填充（COLORS.hex）+ 黛青勾线 2.5px alpha 0.55；已提形状：月白虚线描边 + 淡化（fill alpha 0.55）
  - 命中：逆序遍历，poly 射线法 / circle 距离判定
  - 蒙尘：离屏 canvas 同尺寸；load 时对 dusty 形状区域填 #B8A88A alpha 0.93 + DHRng(3) 斑点；dustAt 用 destination-out 圆笔刷 r=BRUSH_R（canvas px）；dustProgress 按形状 bbox 采样（限频参数，调用方控制）
- [ ] **Step 5: style.css** — tokens + 六视图（home 竖排标题同系列；select 卡片竖排列表；extract 底栏安全区+半透明黛青底；build 控件：色 chip 圆 44px 选中朱红描边+勾、选项 pill 选中朱红底；result 居中；codex 3 列网格 `.codex-cell/.is-locked/.codex-cell-name`）
- [ ] **Step 6: 临时 main.js** — init mural canvas，load("zaojing")，rAF draw，供截图
- [ ] **Step 7: 无头验证 + 视觉检查点 1**（390×844，file://，?test=1）：无 pageerror；截图 `.sdd/shots/dh1-zaojing.png`；像素采样六层颜色在（±30 容差）；hitTest：中心→jin、(50,20) 设计坐标→zhusha、(6,6)→qingshi；dustAt 擦石绿区域 20 下 → dustProgress>0
- [ ] **Step 8: 记录进度**

---

### Task 2: 飞天 + 九色鹿壁画（视觉检查点 2 · 精致门禁）

**Files:** Modify `assets/data.js`（SHAPES.feitian / SHAPES.jiuse）；可选 `assets/mural.js` 加 band 辅助

- [ ] **Step 1: 飞天构图**（坐标自定，以下为元素清单与相对位置，flat+勾线）：
  - 底：石青满幅 poly；顶部花青波浪横带（y<16，上沿平、下沿波浪）
  - 流云×3：铅白圆簇（左上 (18,26)、右中 (80,44)、左下 (14,70) 附近，每朵 3-4 圆叠）+ 藤黄小月牙各 1
  - 飞天（斜倚飞姿，头右上）：头 铅白 circle r5 (62,36)；发髻 墨 circle r2.8 (65,32)；躯干 铅白 band（肩 (58,41) → 臀 (44,52)，宽 4.5）；长裙 胭脂 poly（臀 (44,52) 向左下飘散至 (24,70)，裙摆开叉两片）；飘带 A 朱砂 band（S 形：(68,44)→(52,26)→(30,30)→(16,22)，宽 3.5）dusty:1；飘带 B 胭脂 band（(56,50)→(38,60)→(20,56)，宽 3）；双臂 铅白 细 band（宽 2）
  - 隐藏色：金 jin —— 飞天手中横笛：微小 band (54,40)→(48,43) 宽 1.6，hidden:1
  - band 辅助函数（mural.js）：中心线点列+宽度 → 生成带状多边形（Catmull-Rom 或折线偏移均可），数据里用 `{kind:"band", pts:[...], w:3.5}` 表达，mural.js 展开为 poly
- [ ] **Step 2: 九色鹿构图**：
  - 底：赭石满幅；中部黄赭横带（y 38-58，北魏土红底风格）
  - 远山×2：石绿三角 (14,38)-(30,16)-(46,38)、(54,38)-(72,12)-(90,38)；山脚竹青圆簇×2
  - 河：石青横带 y 80-96，上沿波浪；河内铅白波纹短线×3
  - 九色鹿（居中偏右站立，头朝左）：躯干 蛤粉 geifen 椭圆带（中心 (52,60)，长轴 22 短轴 11，略倾斜）；颈+头 蛤粉 band+circle r4.5 (34,50)；耳 蛤粉 小三角；角 墨 细 band 分叉两支（宽 1.2）；四肢 蛤粉 band×4（宽 2.6，站立微分）；尾 蛤粉 小 band；眼 墨 circle r0.9；斑点 朱砂 zhusha circle×6 r1.6 散布躯干，dusty:1（整组一个 dusty 标记：为每个斑点单独 shape 但共享 dusty，或加一个覆盖躯干的 dusty 透明层——实现取简：斑点各自 shape，第一个斑点带 dusty:1 且蒙尘层覆盖整个躯干 bbox）
  - 隐藏色：铜绿 tonglv —— 鹿背上一只小鸟：circle r1.8 + 尾 band，(58,50)，hidden:1
- [ ] **Step 3: 无头验证**：三壁画 load/render 无 pageerror；各壁画 hidden/dusty 形状存在性断言（遍历 SHAPES）；hitTest 抽查：飞天头部→geifen、九色鹿躯干→geifen、河带→qingshi；三壁画截图 `.sdd/shots/dh2-feitian.png / dh2-jiuse.png / dh2-zaojing.png`
- [ ] **Step 4: 记录进度**（视觉检查点 2：截图给用户过目，不达标则迭代造型）

---

### Task 3: 提色交互 + 图鉴

**Files:** Create `assets/extract.js`；Modify `assets/main.js`（正式装配 extract 视图）

- [ ] **Step 1: extract.js** — 状态：当前壁画、已提 shapeId 集合、飞入动画队列、toast 队列
  - `tap(x,y)`：hitTest → 无命中 return；形状 dusty 且 dustProgress<DUST_DONE → 提示 toast「拂去浮尘，方见其色」return；否则提取：markExtracted、飞入动画（色点从触点抛物线飞入 #palette-bar，0.6s）、首次→DHSave.unlock + emit('extracted') + 知识 toast「{名} · {来历}」+ 隐藏色加「发现隐藏色」前缀+金粒子；非首次→仅 emit('collected')
  - 蒙尘擦除由 main 的 pointermove 驱动 dustAt；每帧检查该壁画所有 dusty 形状 progress，≥DUST_DONE 自动提取（同 tap 提取流程，toast「拂尘见色 · {名}」）
  - 全部形状提完 → emit('alldone') toast「此壁画颜色拾尽」
- [ ] **Step 2: main.js 装配**：视图机 setView；select 卡片构建（缩略 canvas 用 DHMural 离屏渲染 120×120 + 进度 n/m）；extract 视图手势——pointerdown 记起点，pointerup 位移<12px 判 tap→DHExtract.tap；pointermove 按下且命中 dusty 区域→dustAt（沿移动插值）；#palette-bar 渲染已提色圆点（按 COLORS 序）；按钮接线（build/codex/back-select）；rAF：DHExtract.update + DHMural.draw
- [ ] **Step 3: 图鉴视图**（同乞巧 codex 实现）：18 格 `.codex-cell`，解锁=canvas 色块（圆角方色块+勾线）+名，未解锁=.is-locked「?」；详情卡：色块大图+名+hex+text；来源回跳（origin home/extract）；#codex-count n/18
- [ ] **Step 4: 无头验证**（?test=1）：选 zaojing → tap 中心（金，隐藏色）→ codex 含 jin + toast 含「发现隐藏色」；tap 石青外框 → 解锁 qingshi；dusty 石绿：直接 tap → toast 提示擦尘；模拟 dustAt 擦至 ≥0.85 → 自动解锁 shilv；飞入动画存在（动画队列长度>0）；alldone：逐个提完全部形状 → emit；图鉴 0→n 持久化
- [ ] **Step 5: 记录进度**

---

### Task 4: 拼色卡（两版式 × 三底 × 题字）

**Files:** Create `assets/card.js`；Modify `assets/main.js`（build 视图）

- [ ] **Step 1: card.js** — `paint(opts)` 900×1200：
  - 公共：三底背景（paper #F5F0E6 / silk #EFE6D2 / night #2E3D52；night 时文字转月白 #D6ECF0、边框仍朱红）+ 宣纸噪点纹理（DHRng 种子）+ 朱红双线框（外 6px inset24 / 内 2px inset40）+ 四角饰
  - scroll 版式（照视觉稿 A）：顶题字（opts.title，楷体 72px 黛青/月白）+ 副题「{source}」26px + 分隔饰线；N 色竖条（宽 112 高 470，圆角 6，内白描边，均分排布）+ 色名竖排 27px 于条下；底部来源行 + 朱印「敦煌」（旋转 -6°，白字竖排）
  - zaojing 版式（照视觉稿 B）：顶题字 + 副题；同心方井 620×620 居中：按色数 5-6 层交替正方/45°菱形递缩（边长 600→424→300→212→150→中心圆 84），层色取 opts.colors 顺序；下方圆形色点图例（52px 圆+名 24px）；底部来源+朱印
  - 色数约束：scroll 3-6；zaojing 5-6（不足 5 循环补色，超出截断）
- [ ] **Step 2: build 视图**：#color-chips 已解锁色 chips（多选，上限按版式）；#layout-opts 两 pill（立轴色谱/藻井）；#bg-opts 三 swatch（宣纸/绢本/夜空）；#title-opts 五题字 pill；#build-preview 实时渲染（390 宽内 3:4，每次选择变更重绘，debounce）；默认选择：前 5 个已解锁色 + scroll + paper + 首个题字；未解锁任何色时进 build → toast 提示先去拾色并弹回
- [ ] **Step 3: 无头验证**：paint 各版式×三底返回 dataURL 900×1200；像素：paper 角点 ≈#F5F0E6、night 角点 ≈#2E3D52；scroll 版式竖条区域采样到所选色 hex（±30）；zaojing 中心圆采样到第 6 色；build 预览交互：选色/切版式/切底 → preview canvas 帧差变化
- [ ] **Step 4: 记录进度**

---

### Task 5: 成品卡 + 分享出口

**Files:** Modify `assets/main.js`（result 视图 + 分享接线）

- [ ] **Step 1: 成卡流程**：#btn-make-card → 全尺寸 paint(opts) 绘入 #result-card（显示宽 390 内 3:4）→ setView result；DHSave.cards+1、lastBuild 存当前 opts；钤印动效：结果视图入场时印章从 1.4 缩放盖落（CSS 动画，类 qiqiao stamp-in）
- [ ] **Step 2: 分享**：#btn-save-album / #btn-post-note → writeTempFile→saveImageToPhotosAlbum / postNote（title「我在敦煌拾了{N}色」≤20 字、content、tags "#国风vibecoding #敦煌 #敦煌色卡 #非遗 #国风 #中式美学"、mediaInfo）；判空降级 alert「当前环境暂不支持直接保存，请截图保存哦」
- [ ] **Step 3: 按钮**：#btn-again→build 视图（保留上次选择）；#btn-home-result→home+刷新进度行（「已集 {n}/18 色 · 成卡 {cards} 张」）
- [ ] **Step 4: 无头验证**：成卡→result 视图激活+canvas 非空；无 xhs 点击→降级 dialog；mock xhs→writeTempFile→save/postNote 参数合法（title≤20、filePath 传递）；cards 计数持久化
- [ ] **Step 5: 记录进度**

---

### Task 6: 音效 + 教学 + 打磨

**Files:** Create `assets/audio.js`；Modify `assets/main.js`

- [ ] **Step 1: audio.js**（结构同系列）：unlock/isMuted/setMuted（持久化）+ chime（提色：五声音阶随连提序号 [523,587,659,784,880][n%5] 三角波 0.18s）+ hidden（发现隐藏色：双泛音铃 880+1760 0.6s）+ brush（擦尘：低通噪声短段，擦动时节流触发）+ stamp（钤印：低频墩 120→60 0.2s）+ card（成卡：磬 440+880 1s）；全 try/catch + muted 早退
- [ ] **Step 2: 触发接线**：首次 pointerdown unlock；提色/隐藏/擦尘(节流 0.25s)/钤印/成卡各触发；#btn-mute-home 声/静切换
- [ ] **Step 3: 教学**：cards===0 且 codex 空时首进 extract：#extract-toast 依次提示「点按色块，拾取矿物色」（3s）→「有些色藏着、有些蒙着尘」（3s）；之后不再出现
- [ ] **Step 4: 打磨**：select 卡片入场错峰淡入；build 选择变更时预览微动效（scale 0.98→1）；home 背景加一幅藻井小图点缀（canvas 或 CSS）
- [ ] **Step 5: 无头验证**：全音效方法调用无异常；静音持久化；教学 toast 首现条件断言
- [ ] **Step 6: 记录进度**

---

### Task 7: demo 自驾 + 无头套件 + 打包

**Files:** Modify `assets/main.js`（demo）；Create `tests/dunhuang_smoke.py`；Create `dist/dunhuang.zip`；Modify `docs/series-plan.md`

- [ ] **Step 1: demo 模式**（?demo=1）：boot 0.8s 后自动 start→select→feitian；autopilot 依次 tap 普通色 4 个（坐标从 SHAPES 计算形状中心）→ 擦尘（沿 dusty 形状 bbox 往返移动模拟擦拭）→ 提隐藏色 → 停 1.5s → build（默认选择）→ 成卡 → result 停 3s → 下一壁画循环；非 demo 零影响；定时器防重入
- [ ] **Step 2: 套件** `tests/dunhuang_smoke.py`（参照 tests/qiqiao_smoke.py 结构，?test=1 hermetic）：① boot 数据（18 色/3 壁画/5 题字/5 FACTS）② zaojing 全提流程（含擦尘模拟+隐藏色）→ codex 增量正确 ③ 三壁画 hitTest 抽查 ④ paint 两版式×三底 900×1200 ⑤ build→result 全链路 + cards 计数 ⑥ 分享降级 dialog ⑦ mock xhs 参数合法 ⑧ 图鉴持久化（unlockAll→reload 保持）⑨ 全程零 console error ⑩ SMOKE PASS；跑 3 遍稳定
- [ ] **Step 3: 打包**：禁用 API grep 扫描零命中 → `cd tools/dunhuang && zip -r ../../dist/dunhuang.zip . -x '*.DS_Store'` → unzip -l 根 index.html/仅支持类型/<1MB → 解压 http 源冒烟（提色一次+成卡一次零报错）
- [ ] **Step 4: series-plan.md**：§3 加行 10；§8 变更记录
- [ ] **Step 5: 记录进度**

---

### Task 8: 发布素材

**Files:** Create `release/dunhuang/images/*`、`release/dunhuang/发布文案.md`、`release/dunhuang/dunhuang.zip`；Modify `release/README.md`

- [ ] **Step 1: 截图**（630×840@2x）：01-home / 02-extract（飞天提色中，含 toast）/ 03-codex（18 色全解锁，先 unlockAll）/ 04-build（拼卡控件+预览）/ 05-card-scroll（paint 导出 scroll 版式 900×1200）/ 06-card-zaojing（zaojing 版式）
- [ ] **Step 2: 文案**（镜像 release/qiqiao/发布文案.md 结构）：标题备选 3（测试/美学向钩子，如「我从敦煌壁画里，拾出了 18 种千年矿物色」）；正文=玩法三步+两版式色卡+矿物色知识（铅白发黑/丹青由来）+七夕无关、敦煌 1987 世界遗产事实；tags "#国风vibecoding #敦煌 #敦煌色卡 #非遗 #国风 #中式美学 #传统文化 @科技薯"；配图表（封面建议 05-card-scroll）
- [ ] **Step 3: zip 拷贝 + README 行 10 + 图标提示词存档**（release/dunhuang/图标提示词.md：藻井五色方井为主意象的 app icon 提示词中英双版）
- [ ] **Step 4: 记录进度**

---

## Self-Review 结论

- Spec 覆盖：三壁画（T1/T2）、提色三类（T3）、图鉴（T3）、拼卡两版式三底（T4）、成品分享（T5）、音效教学（T6）、demo/套件/打包（T7）、发布（T8）——全覆盖
- 视觉门禁：T1 藻井（几何稳）→ T2 造型插画（精致门禁，截图给用户过目）
- 接口契约在各任务间一致（DHMural/DHExtract/DHCard 签名）；band 形状类型在 T2 引入、mural.js 同步支持
- 已知风险：飞天/九色鹿造型质量需视觉迭代（计划内检查点）；dusty 多斑点共享蒙尘层的实现取简方案已在 T2 注明
