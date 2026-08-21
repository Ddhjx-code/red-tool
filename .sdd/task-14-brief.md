### Task 14: 发布素材

**Files:**
- Create: `release/longzhou/images/*.png`、`release/longzhou/发布文案.md`

- [ ] **Step 1: 截图**：`?demo=1` 无头跑局，在 home / 游戏中 / 冲刺 / 结算 四个时刻截图存入 `release/longzhou/images/`（01-home.png … 04-result.png）；另用 `LZShare.paintCard` 导出卡片图 05-card.png
- [ ] **Step 2: 文案**：参照 `release/jianzhi/发布文案.md` 结构写 `release/longzhou/发布文案.md`（标题/正文/标签/配图说明）
- [ ] **Step 3: Commit**

---

## Self-Review 结论

- Spec 覆盖：核心循环（Task 4/5）、击鼓冲刺（Task 5）、难度曲线（Task 4 spawnGap/baseSpeed）、图鉴 8 件（Task 6）、称号/知识卡/结算（Task 7）、分享出口（Task 8）、音效（Task 9）、教学/暂停（Task 7/10）、视觉门禁（Task 2 Step 3）、验收清单（Task 12/13）——全覆盖
- 数值与 spec 一致（Global Constraints 逐项抄自 spec §1/§2）
- 接口签名在各任务间一致（LZScene.project / LZSprites.boat / LZGame.* / LZSave.* / LZShare.*）
- 已知风险：Task 2 视觉检查点可能需要多轮调参（计划内已留门禁）；demo 自驾可能需调避让参数（Task 11 Step 2 已注明）
