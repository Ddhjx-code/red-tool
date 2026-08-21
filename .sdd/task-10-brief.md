### Task 10: 主装配收尾（覆盖临时 main.js）

**Files:**
- Modify: `assets/main.js`（正式完整版）、清理临时启动代码

- [ ] **Step 1: main.js 正式版**：整合 Task 2-9 所有接线：rAF 主循环（`LZGame.update(dt)` → `LZScene.draw(snapshot, dt)` → 实体投影渲染（按 z 从远到近排序绘制）→ 船渲染（paddlePhase=dist*0.5，dash 拖尾：船后金色渐隐残影 3 帧 + `addSplash` 两侧浪花）→ HUD 同步）；所有按钮/手势/键盘；视图机；toast 队列；教学；暂停。
- [ ] **Step 2: 冲刺视觉**：dashT>0 时画面边缘淡金 vignette + 浪花强度加倍。
- [ ] **Step 3: 无头全流程**：home→start→玩 10s（脚本随机 swipe/drum）→forceHit×3→result→再战→状态全部正确，无 console error；截图 3 张（游戏中/冲刺中/结算）人眼检查。
- [ ] **Step 4: Commit**

---

