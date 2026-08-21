# Task 10 报告：主装配收尾

## 状态：完成（14/14 自动化断言通过，0 console error / pageerror）

## 改动

### assets/main.js（增量演进，未重写）
1. **实体深度排序**：现有循环已是 `S.entities.slice().sort(b.z - a.z)`（远→近），保留不动。
2. **桨相位**：`paddlePhase` 由 `S.t * 6` 改为 `S.dist * 0.5`（随航速联动）。
3. **冲刺拖尾**：新增 `trail` 环形缓冲（上限 12 帧）。`dashT>0` 时每帧 push 船屏幕坐标，取尾部间隔 3 帧的 3 个历史位置，以 `globalAlpha 0.25/0.15/0.08` 调 `LZSprites.boat(..., {dashing:true})` 绘制金色残影（先于实体船绘制）；冲刺结束清空缓冲。
4. **冲刺 vignette**：`dashT>0` 时在 `ctx.restore()` 之后叠加径向渐变（中心透明 → 边缘 `rgba(255,182,30,0.18)`），覆盖全画布。
5. **浪花强度**：`state==="playing"` 时每帧在船尾加 1 颗浪花（常态活尾流）；冲刺时两侧各 `addSplash(x±20u·s, sternY, 2)` 且船尾加倍为 2。
6. **翻船渲染**：已有 tilt/sink 逻辑（tilt 0→1.1 rad、下沉 30u，随 capT 1.4→0）保留；`capsize` 回调中新增一次性大浪花 `addSplash(boatPos, 26)`。
7. **临时代码清理**：无开机自动 start / 强制切视图残留；`?test=1` 与 `window.__game` 未受影响。

### assets/sprites.js（1 行）
- `boat()` 内 `ctx.globalAlpha = alpha` 改为 `alpha * ctx.globalAlpha`，使外部 globalAlpha 包装（残影）生效；默认调用（alpha=1）行为不变。

## 验证（.sdd/task10-verify.py，Playwright chromium 390×844，?test=1，首尾 localStorage.clear()）

| 断言 | 结果 |
|---|---|
| 全程无 console error / pageerror | PASS |
| boot home → #btn-start → playing | PASS |
| 10s 脚本（700ms 随机 swipe + 250ms drum）dist 增长 3→123 | PASS |
| 冲刺触发（dashT>0）| PASS |
| 冲刺中两帧 canvas toDataURL 不同 | PASS |
| 翻船渲染（forceHit×3 → capsized，0.25s 内截图）| PASS |
| 1.8s 后 result 视图激活 | PASS |
| #btn-again 重开（dist≈0、steady 3、gauge 0）| PASS |
| pause()/resume()（含 pause-mask 显隐）| PASS |
| 图鉴开/关 | PASS |
| 分享按钮（无 xhs → fallback alert 恰好 1 次）| PASS |

截图：`.sdd/shots/task10-dash.png`、`task10-capsize.png`、`task10-result.png`、`task10-play.png`。
另做像素级验证：冲刺时画布角落像素由 (213,235,239) → (218,228,213)，确认金色 vignette 生效。

## 关注点
- 残影透明度依赖 sprites.js 的 globalAlpha 乘法改动（单行、向后兼容）。
- 翻船截图取在 capsize 后 ~0.25s（tilt≈0.2rad），倾斜较轻微；越接近沉没倾角越大，逻辑正确。
- 未提交 git（按指示跳过）。
