# Task 11 报告：Demo 自驾模式（发布素材用）

## 状态：PASS

## 改动
仅修改 `tools/longzhou/assets/main.js`（IIFE/var/function 风格，无注释，无 Math.random()）：

1. `demoMode = /[?&]demo=1/.test(location.search)`（main.js:28），与 game.js 的 `test=1` 检测同款模式。
2. 开机自动开局：IIFE 末尾 `if (demoMode) startRun()`（main.js:517），复用 #btn-start 的 startRun 路径，runs/view/state 完全一致。demo 模式下跳过首局教程文字（避免录制素材出现教程浮层；不影响 runs/view/state）。
3. 自驾 `demoAutopilot(dt)`（main.js:32），在 rAF 循环中 `LZGame.update(dt)` 之后调用（main.js:175），仅 demoMode 生效：
   - blocked：所有 `!done` 且 `z<45` 的 obs 占据航道（laneF 优先，Math.round）；pickupLanes：同窗口内 pick 航道。
   - 目标航道：优先「非 blocked 且有 pickup」；同级取离当前航道最近者（当前道距离 0 自然胜出）；全被挡则留在原道。
   - `target !== current` 时每帧 `LZGame.swipe(±1)` 一步逼近（swipe 内部已 clamp）。
   - gauge<88 时累计 dt，每 0.14s（≈7 次/s）调 `LZGame.drum()`（game 内部另有 DRUM_INTERVAL=0.12s 节流），自然攒满触发 dash。
4. 翻船自动重开：capsize 回调中 `if (demoMode) demoRestart()`（main.js:129），setTimeout 1.2s 后 startRun；timer 变量防重入，触发前先 clearTimeout。重开发生在 capT=1.4s 倒计时内，不会闪到 result 视图，素材可循环。
5. 非 demoMode 时所有新增分支均为 no-op，不触碰 window.__game / ?test=1 逻辑。

## 验证（.sdd/task11-verify.py，python3 + playwright，390×844，fresh localStorage）
结果：`OVERALL: PASS`
- pageerrors：[]（demo、bare、?test=1 三个页面均无）
- 自动开局：1.5s 内 state==="playing"，无需点击 → PASS
- 实时自驾 ~62s：dist=646.7（>400），dash_fired=True（轮询 dashT>0 命中），全程未出现 capsized/result → 存活
- 避让提前量最终值：**45m**（未翻船，无需上调到 60）
- 正常模式：bare 与 ?test=1 加载 1.5s 后 state 均为 "home"；点击 #btn-start 后进入 "playing"
- 截图：.sdd/shots/task11-demo.png（dist>120m 行驶中）

## 关注点
- demo 模式使用 Date.now() 随机种子（非 test 固定种子），每次录制航线不同；如需可复现素材可另行加种子参数。
- 自动重开在翻船动画 1.2s 时触发（动画全长 1.4s），翻船尾帧会被新开局切断，属预期循环行为。
- demo 开局会计入 save.runs 并正常累计图鉴/最佳成绩（与"走同一 start 路径"要求一致）；录制用的 localStorage 会留下记录。

## 未做
- 按指示跳过 git commit。

## 修正：demo 击鼓门槛 88 → 100（main.js:55）
- 原 `gauge<88` 配合 GAUGE_DRUM=12 会在 gauge=96 停鼓，永远到不了 100，dash 只能靠雄黄酒(+50)触发，违背"demo 击鼓自然触发冲刺"意图；改为 `gauge<100`，持续击鼓直至攒满自动触发 dash（仅此一处，无注释）。
- 验证（python3 + playwright，file:// index.html?demo=1，fresh localStorage，实时 ~20s）：dashCount=1、dashAtGauge=100、maxGauge=100、drumCount=9（9×12=108→截 100）、wineCollects=0/wineBeforeDash=0、pageerrors=[]。
- 证据链：全程 0 次雄黄酒收集，gauge 纯靠 9 次击鼓攒满 100 并触发 dash，证明冲刺由击鼓驱动而非酒拾取。
- 结论：PASS。
