### Task 2: 夜空水盆场景（视觉检查点）

**Files:** Create `assets/scene.js`；Modify `assets/main.js`（临时启动）

**Interfaces:** Produces `QQScene.init/resize/draw/metrics/ripple`（契约见上）

- [ ] **Step 1: scene.js**
  - metrics：`u=W/400`；`cx=W/2`；`basinY=H*0.62`；`basinRx=W*0.36`；`basinRy=basinRx*0.42`（俯视椭圆）
  - 夜空：竖向渐变 #2e3d52→#1f2a3a 铺满；明月于 (W*0.72, H*0.16)，半径 34u，月白 #D6ECF0 + 外光晕（径向渐变 alpha 0.25）；星点 ~40 颗种子固定（LZRng(9)），其中 2 颗稍亮（织女/牵牛，位置固定：织女星 W*0.30,H*0.10；牵牛星 W*0.52,H*0.22）；薄云 2 条：椭圆叠合剪影 alpha 0.06，x 随 t 缓移（速度 3u/s、5u/s）
  - 水盆：盆沿椭圆环（瓷白 #e8e4d8 描边 6u + 青花线 #425066 细线两道）；盆内水面椭圆填充：径向渐变 中心 #3c5468 → 边缘 #2e3d52；月光高光：水面上一条斜向光带（椭圆裁切内，alpha 0.12 白色渐变，方向指向月亮方位）
  - 涟漪：`ripple(intensity)` 推入 {r:0, max:basinRx*0.9, alpha}；每帧 r+=dt*basinRx*1.2，alpha 线性衰减；渲染为水面椭圆内的同心椭圆描边（白色 alpha*0.35，线宽 1.5u）；列表裁剪
  - draw(st, dt)：按 st.phase 决定针/影是否渲染（针与影由 main 用 QQShadow/自定义绘制叠加，scene 只负责背景+水面+涟漪+月光强度）；月光强度 st.moonlight（0-1）影响高光带与星空亮度
- [ ] **Step 2: main.js 临时启动**：init + rAF `QQScene.draw({phase:"idle",moonlight:0.6}, dt)` + 每 2s 一次 ripple(1)，供截图
- [ ] **Step 3: 无头截图视觉检查**：390×844 截图 `.sdd/shots/qq2-scene.png`；程序化断言：basinY≈0.62H、盆沿像素与夜空像素色差明显、涟漪帧差存在。**视觉门禁：人眼确认夜色氛围成立**
- [ ] **Step 4: 记录进度**

---

