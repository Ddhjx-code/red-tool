# Task 6 报告：音效 + 教学 + 打磨（敦煌拾色）

## 状态：完成 ✅（无头验证 17/17 通过 + 隐藏色路径补测通过）

## 改动文件

### 新增 `tools/dunhuang/assets/audio.js` — window.DHSound
结构完全镜像 `tools/qiqiao/assets/audio.js`：IIFE、var、lazy AudioContext（`window.AudioContext || window.webkitAudioContext`）、全方法 try/catch、muted 早退、无 AudioContext 时全部安全 no-op。
- 初始 muted 从 `DHSave.load().muted` 读取（带 guard）
- helpers：`env(g,t0,a,peak,d)`、`tone(t0,f0,f1,dur,type,peak)`、`partial(t0,f,dur,peak)`（固定频率 sine）、`noise(t0,dur,filterType,freq,peak,freqEnd?)`（单一缓存白噪声 AudioBuffer，`DHRng(20260819)` 填充，loop=true，无 Math.random）
- `unlock()`：创建/resume ctx
- `isMuted()` / `setMuted(b)`：setMuted 回写 DHSave（load→set muted→save，DHSave 缺失时 guard）
- `chime(n)`：五声音阶 `[523,587,659,784,880][n%5]`，triangle 0.18s，peak 0.3（n=会话内累计提色数，音随连提上行）
- `hidden()`：双泛音铃 partial 880 + 1760Hz，0.6s 衰减（peak 0.2/0.09）
- `brush()`：lowpass 噪声 500Hz，0.09s，peak 0.12（调用方节流）
- `stamp()`：120→60Hz sine 0.2s peak 0.4 + 小段 lowpass 噪声
- `card()`：磬 partial 440 + 880，1.0s 衰减

### `tools/dunhuang/assets/save.js` — muted 往返
`defaults()` 与 `load()` 增加 `muted`（默认 false，`!!o.muted`）；`save()` 原样持久化传入对象，向后兼容 {codex,cards,lastBuild}。

### `tools/dunhuang/assets/main.js` — 触发接线 + 教学 + 打磨
音效接线：
- canvas `pointerdown` → `DHSound.unlock()`（幂等）
- `DHExtract.setCallback("collected")`：`extractCount++` → `chime(extractCount)`；payload.hidden 时追加 `hidden()`
- `pointermove` 擦尘时 `brush()`，`lastBrushSnd` 时间戳节流 ≥250ms
- `#btn-make-card`：进结果页时 `card()`，`setTimeout` 200ms 后 `stamp()`（配合钤印/落卡动画）
- `#btn-mute-home`：`renderMute()` 启动时按 `isMuted()` 初始化；点击 toggle，标签 声/静 + `.is-muted` class

教学（每会话一次 flag + 仅真正首次）：
- `maybeTutorial()` 于 `showExtract()` 内触发：`DHSave.load()` codex 为空且 cards===0 时，`#extract-toast` 依次显示「点按色块，拾取矿物色」3s →「有些色藏着、有些蒙着尘」3s
- 教学期间 `renderToast()` 早退，避免帧循环覆盖教学 toast

打磨：
- 选壁画卡片错峰淡入：`.mural-card` 加 `dh-card-fade 0.4s backwards` 动画，`animationDelay = j*0.06s`
- 拼色卡预览微动效：`renderPreview` 绘完后重触发 `#build-preview.preview-settle`（scale 0.98→1，0.2s）
- 首页藻井水印：`paintHomeZaojing()` 生成 210px canvas（5 层同心方，奇数层旋转 45°，中心朱红圆点），`canvas.home-zaojing` 绝对定位右下角，opacity 0.08，pointer-events:none

### `tools/dunhuang/assets/style.css`
新增 `@keyframes dh-card-fade`、`@keyframes dh-preview-settle`、`.home-zaojing` 定位；`.mural-card` 挂入场动画。

## 无头验证（Playwright Chromium，390×844，?test=1，首尾 localStorage.clear()）

| # | 检查 | 结果 |
|---|------|------|
| 1 | 启动无 pageerror；audio.js 无 404 | PASS |
| 2 | DHSound 存在且 8 个方法齐全 | PASS |
| 3 | 全部音效方法页内调用无异常（headless ctx suspended） | PASS |
| 4 | 静音持久化：setMuted(true)→reload→true；setMuted(false)→reload→false | PASS |
| 5 | 触发链路：点按提色→chime（spy 计数≥1）；成卡→card+stamp（spy≥1）；全程无 pageerror | PASS |
| 5+ | 隐藏色补测：构造命中 hidden shape 的 tap → hidden() 经 collected 回调触发 1 次，无错误 | PASS |
| 6 | #btn-mute-home：声→静→声，.is-muted 与 isMuted() 一致 | PASS |
| 7a/b | 全新存储首进 extract：toast 先出提示一，~3s 后出提示二（7s 内轮询命中） | PASS |
| 7c | codex>0 新会话再进 extract，7.6s 内教学不出现 | PASS |
| 8 | 首页藻井水印 canvas 存在；截图已产出 | PASS |
| 打磨 | 壁画卡片 delay 0s/0.06s…；预览 preview-settle class 已挂 | PASS |

合计 17/17 + 1 补测，全部通过；全程 0 pageerror。

## 截图
- `.sdd/shots/dh6-home.png`（首页 + 右下角藻井水印）
- `.sdd/shots/dh6-extract-tutorial.png`（extract 教学 toast 显示中）

## 备注/风险
- 教学提示期间帧循环 toast 被挂起（早退），教学结束后恢复；教学计时器为 setTimeout，若用户中途离开 extract 视图，提示仅在 extract 视图内可见，无副作用。
- brush 音效只在 pointermove 拖动时触发（节流 250ms），headless 未做真实拖动采样，方法本身已在检查 3 中验证无异常。
- 未改 index.html（audio.js script 标签此前已存在）。
