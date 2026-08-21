# Task 2 报告：伪 3D 场景（视觉检查点）

## Status: DONE

## 实现内容

### `tools/longzhou/assets/scene.js`（新建，~190 行）
按 brief 骨架 + 接口契约完整实现 `window.LZScene`，IIFE / var / function(){} / 无注释 / 无 Math.random()：

- **resize()**: DPR capped 2，`u=W/400`，`horizonY=H*0.32`，`boatY=H*0.82`，`cx=W/2`，`laneW=W*0.27`，监听 window resize。
- **project(laneX, z)**: `p = F/(F+max(z,-F*0.8))`；`x = cx + laneX*laneW*p`；`y = horizonY + (boatY-horizonY)*p`；返回 `{x,y,s}`。与契约逐字一致。
- **drawSky**: 全屏竖向渐变 #D6ECF0（月白）→ #c2e2e6 → #aad4da（浅青）作底层。
- **drawMountains**: 两层黛青 #425066 剪影，远层 globalAlpha 0.4、视差因子 0.4，近层实色、因子 1.1；ridge 点表来自 `LZRng(7)`（25 点，brief 原样），ridgeY 索引 `% 24` 保证卷绕无缝；x 偏移 `-(dist*factor % W)` 双份拼接铺满，闭合到 horizonY 填充。
- **drawRiver**: 远端半宽 `laneW*0.9*p(Z_MAX)` 于 farY，近端半宽 `laneW*2.4` 外推到屏幕底边（`p_bottom=(H-horizonY)/(boatY-horizonY)`）；渐变 horizonY 处 #8fb8ba → 底部 #2e3d52。另在 farY 与 horizonY 之间加了一小段收窄的远水（半宽 farHW*0.3 起），否则地平线与 Z_MAX 投影线之间会出现 140px 纯天空断层，视觉破损。
  - **航道虚线**: laneX=±0.5，z 从 `6-(dist%6)` 步进 6m，每段长 2.5m，线宽 `2.6*u*s`，alpha `0.4+0.5*s`，随 dist 滚动。
  - **波光**: 12 条，`z=(i*7.3+90-dist%90)%90`，laneX 为 `LZRng(11)` 固定序列 [-0.9,0.9]，白色横线 alpha ≈0.12*s，长 26u*s。
- **drawBanks**: 世界间隔 14m，`z=((k*14-dist)%104+104)%104`，取 0.5<z<90；左右两岸 k 错开 7；`laneX=±(2.0+((k*37)%10)/18)`；类型 k%4：芦苇丛（曲线茎）/小树（干+圆冠）/屋舍（方体+坡屋顶）/艾草叶（扇形曲线），深黛青 #3a4658 剪影，尺寸 `40*u*s`。
- **drawSplashes(dt)**: 粒子 {x,y,vx,vy,life}，重力 600u，life 0.5s，白色圆点 alpha=life*2，过期 splice。
- **addSplash(x,y,n)** / **metrics()**: 与 brief 骨架逐字一致。

### `tools/longzhou/assets/main.js`（新建，临时最小启动，Task 10 将重写）
IIFE：把 `#view-home` 切到 `#view-game`（canvas 所在 view 默认 display:none，不切换则无法截图检查）→ `LZScene.init(stage)` → rAF 循环 `LZScene.draw({dist: elapsed*14}, dt)`，dt clamp 0.05。

## 验证（Playwright chromium，390×844，file:// 加载 index.html）

1. **pageerrors**: 无（缺失的 audio/sprites/game/share 脚本 404 按要求忽略，不产生 pageerror）。
2. **几何**:
   - metrics: horizonY=270.08（=0.32×844 ✓），boatY=692.08（=0.82×844 ✓），laneW=105.3，cx=195，u=0.975。
   - project(0,0).y=692.08=boatY ✓；project(0,90).y=410.75，介于 horizonY 与 boatY 之间且距地平线 140.7 vs 距 boatY 281.3（明显更贴近地平线）✓；project(1,0).x−project(0,0).x=105.3=laneW ✓。
3. **像素采样**:
   - 地平线上方天空 [208,233,237]（月白，亮）✓
   - horizonY+6 [142,183,185] ≈ #8fb8ba（远河水面，亮）✓
   - 底部中央 (cx, 0.78H) [78,101,116]：深蓝、b>r、亮度 98 ✓（#2e3d52 渐变端）
   - 左右两侧 (8/W−8, 0.45H) [197,227,231]：天空/岸色，非深色河水 ✓
4. **运动**: 河面条带（horizonY+180 起 80px 高）getImageData 哈希，相隔 300ms 两次采样 hash 不同（1588320074 → 2916628507）✓ 河面在滚动。
5. **截图**: `.sdd/shots/task2-scene-a.png`（t≈0.3s）、`task2-scene-b.png`（t≈1.5s）已保存，两图 MD5 不同。
6. **结构扫描**（补充程序化视觉检查，因环境不支持读图）:
   - 河宽随 y 扩张：horizonY+150 处 174px → 0.62H 处 226px → 0.95H 处 390px（满宽）——近宽远窄 ✓
   - 地平线上方山体剪影暗像素 2946 个 ✓
   - 河道内航道虚线/波光高亮像素检出（阈值 195）✓（初版 alpha 过低检不出，已调至 0.4+0.5*s）
   - 两岸剪影暗像素：左 779 / 右 761 ✓

## 文件
- 新建 `tools/longzhou/assets/scene.js`
- 新建 `tools/longzhou/assets/main.js`（临时）
- 截图 `.sdd/shots/task2-scene-a.png`、`.sdd/shots/task2-scene-b.png`

## Self-review
- 接口签名与契约逐字一致；常量取值与契约一致。
- 渲染全确定性：仅 LZRng(7)（山脊）与 LZRng(11)（波光 laneX），无 Math.random()。
- 代码风格：IIFE、var、function(){}、无注释。
- 绘制顺序 sky → mountains → river(含虚线/波光) → banks → splashes，遮挡关系正确。
- 山脊点表用 brief 的 25 点生成，但 ridgeY 取模 24 使首尾周期衔接，避免滚动时接缝跳变（对骨架的唯一算法性微调）。

## Concerns
1. **farY 与地平线之间的远水延伸段**是对 brief 的补充（brief 只给了 Z_MAX 处的梯形远端）：不加会出现地平线悬空断层。若 Task 10 装配时希望严格按 4 点梯形，删掉 drawRiver 中 horizonY 那两个顶点即可。
2. 临时 main.js 额外做了 home→game 的 view 切换（否则 canvas 不可见，无法完成视觉检查点）；Task 10 重写时由正式流程接管。
3. 本模型无法读图，视觉门禁以程序化像素/结构扫描替代；建议人眼过一遍 task2-scene-a/b.png 确认「伪 3D 速度感」。
4. 无 git，未 commit（按指示跳过）。
