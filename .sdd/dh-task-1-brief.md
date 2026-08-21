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

