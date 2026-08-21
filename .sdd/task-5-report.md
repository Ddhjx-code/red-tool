# Task 5 报告：计分、连击、击鼓冲刺、HUD

## 状态：完成（13/13 验证通过，连续 3 次稳定）

## 背景

Task 4 已提前完成 game.js 侧逻辑（`mult()/addScore/drum()/startDash()/collect()`、gauge、dash 门控 `dashT<=0`、combo、scoreFrac、`snapshot()`），本任务仅补齐 HUD/DOM 侧。game.js 未改动。

## 改动文件

### `assets/main.js`（扩展，未重写已有逻辑）

1. **HUD 同步**（每帧 `syncHud(S)`，仅值变化时写 DOM，gauge 每帧写）：
   - `#hud-dist` = `floor(dist)+"m"`
   - `#hud-score` = `floor(scoreFrac)`
   - `#hud-combo` = combo≥3 时 `连击 ×{combo}（{mult}倍）`（mult = `min(5, 1+floor(combo/5))`），否则空
   - `#hud-steady`：启动时创建 3 个 `span.steady-dot`；`i >= steady` 的点加 `.is-off`（仅 steady 变化时刷新）
   - `#gauge-fill.style.height = gauge+"%"`
2. **鼓按钮**：`#btn-drum` `pointerdown` → `fireDrum()`（`LZGame.drum()` + `.is-hit` class，100ms 后 `setTimeout` 移除）；键盘 Space → `fireDrum()`（`preventDefault` 防滚动）。
3. **鼓手挥臂反馈**：`LZGame.setCallback("drum", ...)`（game.js 已 emit `"drum"`）记录 `drumHitUntil = performance.now()+150`，boat opts 传 `drumHit: t < drumHitUntil`（rAF 时间戳与 performance.now 同时基）。同一回调里容错调用 `LZSound.drum()`（audio.js 属 Task 9，当前判空）。
4. 原有 swipe/键盘 ←→、hit 震屏/水花回调保持不变。

### `assets/style.css`

- 新增 `.drum-btn.is-hit { transform: scale(0.9); }` 与 `.drum-btn.is-hit .drum-face { transform: scale(1.08); }`（按压视觉反馈）。

## 验证（Playwright headless，390×844，`?test=1`，脚本 `.sdd/task5-verify.py`）

| # | 项 | 结果 |
|---|----|------|
| 1 | 无 pageerror；仅 audio.js/share.js 404（预期） | PASS |
| 2 | 加载 1s 后 hud-dist/hud-score 与 snapshot 一致（±1 容差，见关注点）；3 个 steady 点、无 is-off | PASS |
| 3 | `forceHit()` 一次 → 恰好 1 点 is-off；combo<3 时 `#hud-combo` 为空 | PASS |
| 4 | 击鼓 ×9 → gauge-fill 达 100%、dashT>0；冲刺结束（~3.4s 后）dashT=0、gauge=0、height 0% | PASS |
| 5 | `page.click("#btn-drum")` ×3 → gauge=36（36±12 内） | PASS |
| 6 | Space 键 → gauge +12（36→48） | PASS |
| 7 | 截图 `.sdd/shots/task5-hud.png`（HUD 可见） | PASS |

连续 3 次运行 13/13 全通过。

## 关注点 / 说明

- **测试时序**：无头环境下 rAF 帧率不稳定，game-time（`S.t`，dt 钳制 0.05）可能慢于真实时间，击鼓间隔用 250ms（> DRUM_INTERVAL 0.12s 游戏时间）保证每次击鼓生效；验证步骤 4/5 相应放宽间隔，逻辑本身未变。
- **HUD 读数竞态**：游戏持续运行，snapshot 与 DOM 读取之间 dist/score 会推进，验证采用 ±1 容差（应用侧无 bug，每帧同步）。
- 验证步骤 5 前调用 `__game.start()` 重置局面，避免冲刺后随机障碍碰撞导致翻船干扰 gauge 断言。
- `LZSound` 尚未存在（Task 9），已判空容错；audio.js/share.js 404 为预期。
- 未提交 git（按任务要求跳过）。

## 报告路径

`.sdd/task-5-report.md`
