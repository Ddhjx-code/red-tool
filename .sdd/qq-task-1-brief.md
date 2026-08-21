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

