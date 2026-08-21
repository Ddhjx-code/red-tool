### Task 7: 首页 + 结算屏 + 称号 + 知识卡

**Files:**
- Modify: `assets/main.js`（视图切换正式化、结算渲染）、`assets/game.js`（result 事件带战绩）

**Interfaces:**
- Consumes: `LZSave`、`LZData.TITLES/FACTS`
- Produces: `showView(name)`、`fillResult(stats)`

- [ ] **Step 1: 视图机**：`showView("home"|"game"|"codex"|"result")` 切换 `.is-active`（沿用剪纸惯例）。首页：`home-best` 显示「最佳 {best} 分 · {bestDist}m」；runs++ 在 start 时。
- [ ] **Step 2: 结算渲染**：capsize→result 事件后：称号 = TITLES 按 score 取；stats 填充；`result-best` 更新 best/bestDist（LZSave）并标「新纪录」；`result-know` = 从**已解锁**图鉴随机抽一条（rng）显示 name+text，若图鉴空则用 FACTS 轮换；`result-codex` = 「图鉴 {n}/8」。
- [ ] **Step 3: 教学提示**：runs===1 的首局：开局 tutor 显示「左右滑动 换线」3s → 「连点右下鼓面 攒满冲刺」直到首次 dash 后消失。
- [ ] **Step 4: 暂停**：`visibilitychange` hidden 且 playing → state="paused" + pause-mask；继续恢复；「回首页」回 home。
- [ ] **Step 5: 无头验证**：完整一局（脚本自动 drum+swipe 或 forceHit×3）→ result 视图四数据非空、称号 ∈ 列表、best 持久化。
- [ ] **Step 6: Commit**

---

