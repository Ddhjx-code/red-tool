# Task 9: 音效 — 实施报告

## 状态: 完成 (PASS)

## 交付物

### assets/audio.js — window.LZSound
文件已存在且实现完整（本次任务核验并全量验证，无需修改）。实现符合规范：

- IIFE + var + function(){}，无注释，无 Math.random()（噪声 buffer 用 `LZRng(20260505)` 固定种子生成，兜底用确定性 LCG 序列）
- AudioContext 懒创建（`window.AudioContext || window.webkitAudioContext`），不可用时所有方法安全 no-op
- 全部声音程序化合成，无音频文件；白噪声 AudioBuffer（0.5s）缓存复用
- 每个 play 方法开头 `if (muted) return`，整体 try/catch 包裹，音频永不崩溃游戏
- 助手函数：`env(g,t0,a,peak,d)`（指数包络）、`tone(t0,f0,f1,dur,type,peak)`（频率指数滑动 + 包络）、`noise(t0,dur,filterType,freq,peak,freqEnd)`（BiquadFilter，支持扫频）

方法清单（全部实现）：

| 方法 | 实现 |
|---|---|
| unlock() | 创建/resume ctx |
| isMuted() / setMuted(b) | 内存标记 + LZSave load→set muted→save 持久化 |
| drum() | sine 150→55Hz 0.18s + lowpass(900) 噪声 0.06s |
| dash() | 三连鼓点（间隔 0.07s，vol 0.8）+ bandpass 400→2400Hz 扫频 0.6s |
| collect(combo) | 五声音阶 [523,587,659,784,880][combo%5]，triangle 0.15s |
| hit() | sine 90→40Hz 0.25s + lowpass(500) 噪声 |
| smash() | highpass(1200) 噪声 0.12s + sine 200→80Hz |
| capsize() | sine 300→60Hz 0.7s + lowpass(800) 噪声 0.8s 水声 |

### main.js 触发点
全部已接线（核验确认，无需新增）：

- 首次 pointerdown（document 级）→ `LZSound.unlock()`（main.js:413-415）
- drum 回调 → `LZSound.drum()`（main.js:56-59，按钮与 Space 均经 `fireDrum()`→`LZGame.drum()`→emit("drum")）
- dash 回调 → `LZSound.dash()`（main.js:60-63）
- collect 回调 → `LZSound.collect(snapshot().combo)`（main.js:230-231）
- hit 回调 → `a.smash ? smash() : hit()`（main.js:64-75）
- capsize 回调 → `LZSound.capsize()`（main.js:76-78）
- #btn-mute-home：click 切换 setMuted(!isMuted())，标签「声/静」+ `.is-muted` class（style.css:127-139），boot 时 renderMute() 初始化（main.js:417-428, 432）

所有调用均以 `if (window.LZSound && window.LZSound.xxx)` 保护。

## 无头验证（Playwright Chromium，390×844，?test=1，localStorage.clear() 首尾各一次）

| # | 检查项 | 结果 |
|---|---|---|
| 1 | pageerrors / 脚本 404 | PASS — 0 pageerror，0 failed request（audio.js 正常加载） |
| 2 | LZSound 9 个方法存在 | PASS — unlock/isMuted/setMuted/drum/dash/collect/hit/smash/capsize 均为 function |
| 3 | 逐个调用全部声音方法 | PASS — 7 个发声方法 + unlock 全部 "ok"，无抛出（headless 下 ctx 可能 suspended，仍不抛） |
| 4 | 静音持久化 | PASS — setMuted(true)→reload→isMuted()===true，LZSave.load().muted===true；随后 setMuted(false) 恢复 |
| 5 | 触发路径 | PASS — 开局后 LZGame.drum()、__game.forceHit()×3（触发 hit+capsize 链）、__game.capsize() 均无异常，终态 "result" |
| 5b | emit 路径 | PASS — emit("dash")/emit("collect")/emit("hit",{smash:true})/emit("hit",{}) 均无异常 |
| 6 | unlock() 后 AudioContext | PASS — unlock() 无抛出；ctx 为闭包内部变量未暴露，无法直接断言实例，按任务说明以"无异常"为断言口径 |
| 附 | 静音按钮 | PASS — 点击切换 声↔静、is-muted class 与 isMuted() 状态一致 |

## 备注 / 关注点

- audio.js 在本次会话开始前已存在且完整（任务简报称 404，实际已就绪），本次工作以核验 + 全量无头验证为主，未改动任何代码。
- headless Chromium 无声卡输出，验证口径为"图谱可构建、调用无异常"，实际听感需真机抽验。
- 静音按钮标签仅在 click/boot 时刷新；若未来有其他路径程序化调用 setMuted，需手动调 renderMute（当前无此路径）。
