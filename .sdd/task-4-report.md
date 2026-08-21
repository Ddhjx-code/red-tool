# Task 4 报告：游戏核心——移动、生成器、碰撞、翻船

## Status: DONE

## 实现内容

### `tools/longzhou/assets/game.js`（重写扩展，~210 行）
保留既有 `start/update/swipe/setCallback/emit/snapshot` 接口名不变，IIFE / var / function(){} / 无注释 / 无 Math.random()（全部走 `S.rng = LZRng`）。

- **状态扩展**：`speed, score, scoreFrac, zongzi, combo, maxCombo, steady, gauge, dashT, invT, capT, entities, sinceSpawn, lastDrumAt, rng`。
- **start()**：`rng = LZRng(testMode ? 20260818 : (Date.now()>>>0))`（testMode = `/[?&]test=1/.test(location.search)`），重置全部字段、`steady=3`、`state="playing"`、`entities=[]`。**额外在 start 末调用一次 `spawnWave()` 作为首发波**（原因见 Concerns 1）。
- **baseSpeed(d)** = `BASE_SPEED + (MAX_SPEED-BASE_SPEED)*min(1, d/SPEED_RAMP_DIST)`。
- **spawnGap(d)** = `max(GAP_MIN, GAP_MAX - d/GAP_RAMP*(GAP_MAX-GAP_MIN))`（brief 逐字）。
- **spawnWave()**：brief 代码逐字照抄（roll<30 单障碍 rock/whirl(>200)/log(>500)；<50&&d>150 双 rock 留一道；<72 三连粽；<90 rock+邻道双粽；<96 wine；else pickRare）。
- **push(kind,type,lane,z)**：实体结构 `{kind,type,lane,z,done:false,drift}`，log 的 drift = `(rng.next()<0.5?-1:1)*0.35`。
- **pickRare()**：rare 权重 4、ling 0.5；若 `window.LZSave` 存在且该 id 未解锁则权重 ×2（解锁状态经 `LZSave.load()` 防御性读取，兼容 `unlocked`/`codex`/平铺三种结构）；`rng.next()` 加权抽取。
- **update(dt)**：playing——t 累加、boatX 缓动（原逻辑保留）、`sp=baseSpeed(dist)*(dashT>0?DASH_MULT:1)`、`dist/scoreFrac += sp*dt`、`speed=sp`、dashT 归零时 `gauge=0`、invT 递减、`sinceSpawn>=spawnGap` 触发 spawnWave、实体 `e.z-=sp*dt`、log 漂移 `laneF` clamp[-1,1]、`z<-12` 移除、逐个 collide。capsized——`capT-=dt`，`<=0` 时 `state="result"; emit("result")`。
- **collide(e)**：brief 逐字（obs：同道时冲刺 smashing +50 分 / 否则扣 steady、invT=HIT_INV、combo 清零、steady<=0 capsize；pick：`|boatX-lane|<=0.6` 收集）。
- **collect(e)**：zongzi +10×mult、wine +50 gauge（满 100 触发 startDash）、稀有 `ling?200:80` 分并 `if(window.LZSave) LZSave.unlock(type)`。
- **mult()** = `min(5, 1+floor(combo/5))`；**addScore(n)** 累加 scoreFrac 并同步 score。
- **drum()**：playing 且距上次 ≥DRUM_INTERVAL 才生效，`gauge=min(100,gauge+GAUGE_DRUM)`、emit("drum")、满 100 startDash。**startDash()**：`dashT=DASH_TIME`、emit("dash")。
- **capsize()**：`state="capsized"; capT=1.4; emit("capsize")`。
- **window.__game** 测试钩子：brief 逐字（snapshot 拷贝标量+entities 计数、start/swipe/drum/setDist/addScore/forceHit/capsize/spawnWave），`unlockAll`/`save` 已按要求 `if(window.LZSave)` 守卫，本任务无 LZSave 也可独立运行。

### `tools/longzhou/assets/sprites.js`（新增 obstacle，boat 不动）
`LZSprites.obstacle(ctx,type,x,y,s,t)`，`save/translate/scale(u*s)` 后绘制、`restore` 收尾：
- **rock**：`#3a424d` 固定顶点不规则五边形 + 描边裂纹 + 水线白色泡沫椭圆弧。
- **whirl**：黛青深底椭圆 + 3 条旋转螺旋弧（相位 `t*3`，13 段折线逼近，纵横比 0.44 压扁）+ `#141f2d` 中心深点。
- **log**：`#7a5a3a` 圆角横木 90×16（arcTo 自绘圆角）+ 两端年轮椭圆 + 底部白色水线。

### `tools/longzhou/assets/main.js`(临时版扩展)
- 实体渲染：`entities` 按 z 降序（远→近）投影绘制，obs 走 `LZSprites.obstacle(ctx,type,p.x,p.y,p.s,S.t)`；pick 本任务不渲染（Task 6）。
- `setCallback("hit")`：非 smash 时 `LZScene.addSplash(船位,18)` + 0.2s 画面抖动（canvas translate，幅度随 shakeT 线性衰减、sin/cos 确定性偏移，无随机源）；smash 仅水花。
- 翻船渲染：capsized 时按 `1-capT/1.4` 进度给船 tilt→1.1rad + 下沉 30px。
- 保留自动起航、键盘/触摸输入；冲刺发光（dashing）与受击闪烁（blink）已接入 boat sprite 既有参数。

## 验证（Playwright chromium 390×844，index.html?test=1，脚本 `.sdd/task4-verify.py`）

13/13 全部通过：
1. **T1 无 pageerror**（audio.js/share.js 缺失 404 按要求不产生 pageerror）。
2. **T2** 加载即 `state==="playing"`；1.5s 后 `entities>0`（首发波保证）。
3. **T3** `swipe(1)` → `lane===1 && boatX≈1`（400ms 内缓动到位）。
4. **T4** `setDist(300)` 后 dist 推进到 312.8；dist=300 连续 150 次 spawnWave 的类型分布含 `whirl:19`（另 rock/zongzi/wine/wusai/wudu 均出现）；**200 次 spawnWave 断言每 wave obs 航道数 ≤2，实测 maxLanes=2**。
5. **T5** `forceHit()×3` → `state==="capsized"`，1.6s 后 → `"result"`。
6. **T6** `setDist(0)` 一帧后 speed=8.006≈8；`setDist(2500)` 后 speed=22.000。
7. **T7** 9 次 drum（每次先推进 0.13s 游戏时间，>DRUM_INTERVAL）→ `gauge=100 && dashT=3.0`。
8. **T8** 中途截图 `.sdd/shots/task4-play.png`（60KB，state=playing，obs=3）。
- **像素级渲染核验**（本模型不能读图，改用 getImageData 采样）：rock 投影中心像素 `[58,66,77]`=#3a424d；whirl 中心 `[20,31,45]`=#141f2d 深点；log 中心 `[122,90,58]`=#7a5a3a——三种障碍均在正确投影位置按预期配色绘出。
- **风格扫描**：game/sprites/main 三文件无 `Math.random`、无注释、无 let/const/箭头函数。

## 文件
- 修改 `tools/longzhou/assets/game.js`（骨架→完整核心）
- 修改 `tools/longzhou/assets/sprites.js`（+obstacle）
- 修改 `tools/longzhou/assets/main.js`（实体渲染/受击反馈/翻船姿态）
- 截图 `.sdd/shots/task4-play.png`；验证脚本 `.sdd/task4-verify.py`

## Self-review
- brief 的 spawnWave/collide/__game 代码块逐字落地；常量全部取自 LZData，无硬编码魔数（sprite 造型参数除外）。
- 确定性：游戏逻辑唯一随机源为 `S.rng`（test 模式种子 20260818）；画面抖动用 sin/cos 衰减，无随机。
- LZSave 三处引用（pickRare 权重、collect 解锁、__game.unlockAll/save）全部 `if(window.LZSave)` 守卫，Task 6 前可独立运行。
- 接口稳定：`start/update/swipe/setCallback/emit/snapshot` 名称未变，`LZGame.snapshot()` 仍返回活 S（main 需要 entities），`__game.snapshot()` 按 brief 返回拷贝。

## Concerns
1. **start() 里追加了一次首发 spawnWave()**：按 brief 公式 GAP_MAX=26、BASE_SPEED=8，自然首波要 ~3.1s（dist≈25）才出现，无法满足任务书「~1.5s entities>0」与 brief Step7「2s 后 entities>0」。若希望严格自然生成，可删除 start 末的 `spawnWave()` 并把验证等待放宽到 ~3.5s。
2. pickRare 的「已解锁」判定依赖 Task 6 的 `LZSave.load()` 返回结构，当前按 `unlocked`/`codex`/平铺三种 key 防御性兼容；Task 6 落地后如结构不同需回来对齐（无 LZSave 时权重不翻倍，行为退化安全）。
3. 翻船 tilt/下沉进度由 main 用 `1-capT/1.4` 推算（brief 只给了 0→1.1rad 的目标，未给渲染公式）；Task 10 装配正式流程时可直接复用。
4. 无 git，未 commit（按指示跳过）。

## Review 修复（Findings 1 & 2）

### 改动
1. `tools/longzhou/assets/main.js:47`：渲染循环跳过已终结障碍 `if (e.kind !== "obs" || e.done) continue;`（原为 `if (e.kind !== "obs") continue;`），done 障碍不再绘制/穿过船体。
2. `tools/longzhou/assets/game.js:81`（drum）与 `game.js:95`（wine 收集）：冲刺触发条件改为 `if (S.gauge >= 100 && S.dashT <= 0) startDash();`，冲刺中击鼓/拾酒不再重置 dashT 无限延长。

### 验证命令
`python3 /var/folders/lb/v_0jd2l11hb4l3dwysz0l2sh0000gp/T/opencode/lz_verify.py`（playwright chromium，file:// index.html?test=1，390×844）+ 补充脚本 `lz_verify3.py`（修正 smash 触发时序：dash 触发后再注入 z=18 障碍）。

### 输出
1. **无 pageerror / 自动起航**：`state="playing"`，pageerrors=[]。
2. **dash 不延长**：9 次 drum（130ms 间隔）→ `dashT=3`；冲刺中再 drum 5 次后，`dashT` 于 **3.0s** 归 0（<4.5s 阈值，未因额外击鼓延长）。
3. **渲染跳过 done 障碍**：注入障碍并击鼓触发冲刺，`hit{smash:true}` 探针计数 >0；hook `LZSprites.obstacle` + `requestAnimationFrame` 逐帧比对，139 帧中绘制调用数均等于 `kind==="obs" && !done` 实体数，**mismatches=0**；其中 25 帧存在 done===true 的 obs（确认跳过逻辑实际生效）。冲刺中相隔 200ms 双截图（lz_dash_a/b.png），无 pageerror。
4. **回归**：`swipe(1)` → lane=1；`forceHit()×3` → `capsized` → 1.8s 后 `result`。全程 pageerrors=[]。

### 文件
- 修改 `tools/longzhou/assets/main.js`（1 行）
- 修改 `tools/longzhou/assets/game.js`（2 行）
