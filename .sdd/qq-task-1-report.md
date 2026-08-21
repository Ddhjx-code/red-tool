# Task 1 报告：骨架 + 数据 + 随机数（乞巧占卜局）

- 日期：2026-08-19
- 状态：**PASS**（全部验证项通过）

## 交付文件

| 文件 | 内容 |
| --- | --- |
| `tools/qiqiao/index.html` | 四视图 DOM 骨架（home/ceremony/result/codex），viewport-fit=cover，外置脚本 9 个按依赖顺序，无内联脚本/事件 |
| `tools/qiqiao/assets/data.js` | `window.QQData`：SHADOWS×12 / ASPECTS×5 / GRADES×5 / FACTS×5 + 6 个常量 |
| `tools/qiqiao/assets/rng.js` | `window.QQRng`，mulberry32 与龙舟同实现（LZ→QQ 改名） |
| `tools/qiqiao/assets/style.css` | tokens（--red/--ink/--gold/--moon/--paper + 夜空 --night-1/--night-2/--dai）+ 四视图完整样式 |

## 实现要点

- **index.html**：`#view-home`（系列行「非遗手作坊 · 七夕」、竖排标题 乞巧占卜局 5 span、副题、`#home-progress`、`#btn-start` 起占 / `#btn-codex-home` 影形图鉴 / `#btn-mute-home` 声）；`#view-ceremony`（`canvas#stage` + `#phase-hint` 顶部提示 + `#tutor`）；`#view-result`（`canvas#result-shadow-icon` 240×240、`#result-shadow-name`、`#result-seal` span、`#result-aspect`、`#result-text`、`#result-know`、`#result-codex`、5 按钮）；`#view-codex`（头部三件套 + `#codex-grid` + `#codex-card` 弹层含 `canvas#codex-canvas` 120×120）。
- **脚本顺序**：data → save → rng → audio → scene → shadow → divine → share → main（save/audio/scene/shadow/divine/share/main 由 Task 2-6 创建，当前 404 属预期）。
- **data.js**：12 影形断语按 spec §1.1 寓意撰写（温和古雅白话，1-2 句）；槌影/烛烟两个 zhuo 措辞鼓励不刻薄（"拙中藏稳，勤能补拙"、"巧从不急在这一针"）。FACTS 5 条逐字取自 spec §5。GRADES 含 `weightBase`（brief Step 2 要求字段：8/18/36/24/14，合计 100，供 Task 4 心诚值加权作基线）。常量：ZHUO_WEIGHT 7 / JI_WEIGHT 9.5 / UNLOCK_BOOST 1.5 / CALM_CYCLE 2.4 / FILL_TIME 1.5 / REVEAL_TIME 2.8。
- **style.css**：完全沿用龙舟 `.view/.is-active` 切换、primary/ghost/chip 按钮、codex 3 列网格 `.codex-cell`/`.is-locked`/`.codex-cell-name`、结果印章朱红 rotate(-6deg) + `.is-zhuo` 黛青变体（--dai #2E3D52，供未得巧品级）、safe-area padding；ceremony 视图夜空深色主题，`#phase-hint` 顶部安全区月白楷体。
- **约束**：全部 IIFE / var / function(){}，无注释，无 Math.random()。

## 无头验证（playwright chromium，390×844，file:// 加载）

| 检查项 | 结果 |
| --- | --- |
| pageerror / 运行时异常 | 0（仅 7 条未创建脚本的 ERR_FILE_NOT_FOUND，预期） |
| `#view-home.is-active` | true；四视图节点齐全 |
| SHADOWS/ASPECTS/GRADES/FACTS 长度 | 12 / 5 / 5 / 5 |
| 影形 id 序列 | yun,mudan,xique,jinyu,fenghuang,limao,xiuxie,jiandao,yulong,lianhua,chui,zhuying |
| luck 字段合法，zhuo 恰为 chui,zhuying | true |
| 全部 SHADOW/ASPECT/GRADE id/name/text 非空、FACTS 非空 | true |
| 常量值 | 7 / 9.5 / 1.5 / 2.4 / 1.5 / 2.8 |
| QQRng(1).next() ∈ [0,1)、连续不同值、同种子确定性 | true（seed=1 首值 0.6270739405881613） |
| 23 个按钮/节点 id 齐全、stage/240×240/120×120 canvas 尺寸 | true |
| 截图 | `.sdd/shots/qq1-home.png`（80KB） |

## 遗留 / 交接说明

- `#result-seal` span 预置占位文案「中巧」，Task 4 结果系统会覆写；`.is-zhuo` 变体由 Task 4 按品级挂上。
- `#home-progress`、`#phase-hint`、`#tutor` 初始为空（`:empty` 隐藏），由 Task 2/5/6 填充。
- GRADES 的 `weightBase` 为本任务新增约定（brief 要求字段），Task 4 divine.js 若改用心诚值直接映射概率可忽略该字段。
- 无 git，未 commit。
