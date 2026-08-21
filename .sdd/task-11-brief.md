### Task 11: Demo 自驾模式（发布素材用）

**Files:**
- Modify: `assets/main.js`（`?demo=1`）

- [ ] **Step 1: autopilot**：每帧扫描 entities：找 z<45 的 obs，其航道集合为 blocked；目标航道 = 优先「无阻挡且有 pickup 的航道」，否则任一非 blocked 航道（偏好当前道）；`swipe` 逼近；gauge<88 时以 ~7 次/s 节奏 `drum()`；开局自动 start。
- [ ] **Step 2: 验证**：`?demo=1` 无头跑 60s，断言 dist>400 且期间至少触发 1 次 dash、未翻船（若过早翻船则调避让提前量 45→60m）。
- [ ] **Step 3: Commit**

---

