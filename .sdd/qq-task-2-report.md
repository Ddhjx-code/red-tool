# Task 2 报告：夜空水盆场景（视觉检查点）

## Status: DONE — 12/12 程序化断言通过

## 交付物
- `tools/qiqiao/assets/scene.js`（新建）：`window.QQScene.init/resize/draw/metrics/ripple`，IIFE + var + function(){}，无注释，无 Math.random（布局全部来自 QQRng(9) 星点池 / QQRng(21) 云 / QQRng(5) 月面坑）。
- `tools/qiqiao/assets/main.js`（新建，临时启动，Task 4+ 替换）：init → 切到 #view-ceremony → rAF 循环 `QQScene.draw({phase:"idle",moonlight:0.6}, dt)`，每 2s `ripple(1)`，启动时先打一发涟漪。
- 截图：`.sdd/shots/qq2-scene.png`（390×844，涟漪扩散至中段的一帧）。
- 验证脚本：`.sdd/qq-task2-verify.py`（playwright/chromium，viewport 390×844）。

## 实现要点（对照契约）
- metrics：`u=W/400=0.975, cx=195, basinY=523.28, basinRx=140.4, basinRy=58.97`（basinRx*0.42）。
- 天空：竖向渐变 #2e3d52→#1f2a3a 铺满。
- 月亮：(0.72W, 0.16H)，r=34u，#D6ECF0；径向光晕 alpha 0.25→0，半径 3.2r；3 个种子固定的淡坑。
- 星：QQRng(9) 生成 80 候选池，绘制时剔除落入盆区（1.25× margin）者，取前 40 颗（r 0.8–1.8u，alpha 0.3–0.9）；织女 (0.30W,0.10H)、牵牛 (0.52W,0.22H) r=2.4u + 十字微光；闪烁 `sin(t*sp+ph)` 每星种子相位 ±0.25（命星 ±0.12 更稳）；moonlight 轻微缩放星空亮度（0.78+0.37*moonlight）。
- 云：3 簇软椭圆（径向渐变羽化），#425066 alpha 0.10/0.12/0.14，速度 3u/s、5u/s、4u/s，x 方向 mod 环绕。
- 水盆：整椭圆瓷底 #e8e4d8 + 外沿 6u 描边；两道青花线 #425066 alpha 0.5（basinRx-7u / -9u）；水面椭圆（basinRx-10u）径向渐变 #3c5468→#2e3d52。
- 月光带：裁切到水面，指向月亮方位的拉长渐变椭圆（旋转角=atan2 月向），白 alpha=0.2*moonlight（默认 0.6 时 0.12）。
- 涟漪：`ripple(intensity)` 推入 `{r:0, max:basinRx*0.9*min(i,1.5), alpha:0.5*i, speed:basinRx*1.2}`；r+=speed*dt，alpha 随 r→max 线性衰减；白色同心椭圆描边 alpha*0.35、lineWidth 1.5u、同偏心率 0.42、裁切到水面，另加一道 0.72r 的淡内环增强层次；逆序 splice 清理。
- draw 顺序：sky → stars → moon+halo → clouds → rim → water → moonlight → ripples；内部 t+=dt 驱动云漂移与星闪烁；不绘制针/影。

## 验证结果（qq-task2-verify.py，12/12 PASS）
1. T1 无 pageerror；console error 仅缺失脚本 404（save/audio/shadow/divine/share 尚未创建，符合预期）。
2. T2 metrics：basinY=523.28（=0.62*844），basinRx=140.4（=0.36*390），u/cx/basinRy 全对。
3. T3 像素：顶中 [46,61,82]（=#2e3d52 深靛）；月心 [194,220,227] 亮度 214>180；盆心 [76,98,117]（#3c5468 + 月光带微增亮，±18 容差内）；盆沿外 [36,48,65] 为天色，与水面色差 142。
4. T4 运动：隔 400ms 两帧，水区变化像素 787（涟漪扩散），上空区变化像素 96（星闪+云移）。
5. T5 截图已保存 `.sdd/shots/qq2-scene.png`（85KB）。
6. T6 视觉自审（basinY 水平带采样，自外向内）：
   - sky_out [-14px]: [37,49,67]（夜空）
   - rim [+3u]: [232,228,216]（瓷白沿，亮度 225）
   - rim_inner [+8u]: [223,219,210]（瓷底+青花线之间）
   - water_edge [+14u]: [47,62,83]（水面边缘偏暗）
   - water_mid: [52,72,92] → center: [76,98,117]（径向渐变中心渐亮）
   - 亮度分层 rim(225) > water(72) > sky(51) 成立，盆沿/水面/夜空三层清晰。
   - 月光带定向验证：带上采样 [73-77,92-98,111-116] vs 反向对照点 [53-56,73-77,94-98]，朝月一侧亮约 20。

## 过程中修复
- 初版盆沿只用 6u 描边，盆沿与水面之间露出天色缝隙（T6 采样 rim_inner=[38,50,68] 发现）；改为整椭圆瓷底填充+外沿描边，青花线落在瓷底上。
- 运动检测初版用全区域平均色差，细环涟漪信号被稀释（1.57）；改为"变化像素计数"（通道差和>15），水区 787 px 明确通过。

## Concerns / 遗留
- 月光带较含蓄（alpha 0.12），截图里需放大细看；符合"清幽"基调，若视觉评审觉得弱可调 `drawMoonlight` 的 0.2 系数。
- main.js 为临时启动（直接进仪式页），Task 4 会替换为正式流程。
- 缺失脚本 404 属预期，后续任务补齐即消失。
