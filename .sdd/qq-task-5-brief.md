### Task 5: 显影动画 + 针渲染

**Files:** Modify `assets/main.js`（渲染循环）、`assets/scene.js`（如需月光联动）

**Interfaces:** Consumes QQDivine.snapshot()、QQShadow.draw

- [ ] **Step 1: 针渲染**：drop/reveal/result 阶段渲染银针——悬空期（drop 前段）：盆上方 60u 处水平细线 40u，sin 轻晃；落水后：浮于水面中心（盆中心偏上 10u），银白 #dfe6ee 线 + 微光
- [ ] **Step 2: 显影**：reveal 阶段在盆底（针下方 20u）渲染 QQShadow.draw(result.shadow.id)，alpha = revealP 的缓动（先模糊后清晰：用 3 层错位叠加模拟模糊，错位量 (1-revealP)*6u）；月光渐亮（scene.moonlight 联动）；涟漪在 reveal 前段自然平息（不再新增）
- [ ] **Step 3: result 阶段定格**：影形完全清晰 + 月光最亮，停留供阅读（等待用户点「看结果」或自动 1.2s 后切结果视图——用自动切换，保持流畅）
- [ ] **Step 4: 无头验证**：完整流程截图 4 张（water 注水中/calm 呼吸圈/drop 针落/reveal 显影中）存 `.sdd/shots/qq5-*.png`；断言 reveal 过程中影形 alpha 递增（像素采样）
- [ ] **Step 5: 记录进度**

---

