# Task 9 报告：教学 + demo 自驾 + 打磨

## Status: DONE — 全部验证通过

## 改动文件
- `tools/qiqiao/assets/main.js`
- `tools/qiqiao/assets/style.css`

## 实现内容

### 1. 首占教学（#tutor）
- `start` 回调内从 `QQSave.load().runs === 0` 捕获 `firstRun` 标志。
- rAF loop 的 phase 切换分支中，`firstRun` 时按阶段设置 #tutor 文案并加 `.is-on`：
  - water: 「长按舀水，注满此盆」
  - calm: 「圈收至心时松手，定心」
  - drop/reveal: 「点按投针，静候针影」
- `result` 回调内 `hideTutor()`：清空文案、移除 `.is-on`、并把 `firstRun` 置 false（本 session 不再出现）。
- CSS：`.tutor` 已有底部居中墨底样式，补充 `display:none` 默认隐藏 + `.tutor.is-on { display:block }`。

### 2. Demo 自驾（?demo=1）
- `demoMode = /[?&]demo=1/.test(location.search)`，镜像 longzhou 的 demoMode 模式。
- boot 后 800ms 自动 `QQDivine.start()`。
- `demoAutopilot(s)` 每帧驱动：
  - water：未 holding 时 `holdWater(true)`，注满自动进 calm；
  - calm：`phasePos = (calmT % CALM_CYCLE)/CALM_CYCLE > 0.93` 时 `releaseCalm()`（收束点释放，calmValue 接近满分）；
  - drop/reveal：状态机自动推进，无需操作。
- result 视图展示后（result 回调的 1200ms 延迟 setView 之后）`demoRestart()`：3200ms 后自动再占，无限循环出素材。
- 重入安全：`start` 回调清除 pending `demoRestartTimer` 与 `resultTimer`；home 阶段 autopilot 无任何动作。
- 非 demo 路径零影响（所有逻辑均在 demoMode/firstRun 门控内）。

### 3. 打磨
- 结果视图入场：`#view-result.is-active .result-inner` 触发 `qq-result-in` 动画（opacity 0→1 + translateY 12px→0，0.45s ease）。印章盖落动画（qq-stamp，scale 1.35→1 + 旋转）原已存在，保留。
- 呼吸圈收束脉冲：`drawCalmCircle` 中 `phasePos > 0.93` 时描边由月白 `#D6ECF0` 切换为藤黄 `#FFB61E`，线宽 2→3，并加 `shadowBlur=14u` 的藤黄光晕，提示玩家松手时机。
- 阶段切换 canvas 转场：按任务说明，reveal 已有 moonlight 渐亮，未加额外处理。

## 验证（Playwright headless，390×844，localStorage 前后清空）

| 项 | 结果 |
|---|---|
| ?test=1 不点开始停留 home | PASS |
| 首占 water 阶段 #tutor 显示水文案 | PASS |
| calm 阶段 #tutor 切换为定心文案 | PASS |
| result 后 #tutor 隐藏且 runs=1 | PASS |
| 第二占（runs>=1）#tutor 全程隐藏 | PASS |
| ?demo=1 2s 内自动离开 home | PASS |
| demo 45s 完成 ≥2 次完整占卜 | PASS（results=4, runs=4，water→calm→drop→reveal→result 循环 4 次） |
| 全程无 pageerror（含 calm 期 drawCalmCircle） | PASS（0 errors） |

截图：`.sdd/shots/qq9-demo.png`（demo 进行中）、`.sdd/shots/qq9-tutor.png`（首占 water 教学提示）。

## Concerns
- 无功能性问题。demo 单循环约 12s（水 1.5s + 息心 ≤2.4s + 落针 0.9s + 显影 2.8s + 卡片 1.2s + 停留 3.2s），45s 内稳定产出 4 次完整素材。
- 收束脉冲阈值与 autopilot 释放阈值统一为 0.93（brief 写 0.94，任务需求写 0.93，取需求值并保持一致）。
