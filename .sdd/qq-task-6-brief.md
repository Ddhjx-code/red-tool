### Task 6: 结果视图 + 组合拼装渲染

**Files:** Modify `assets/main.js`（结果视图渲染）

**Interfaces:** Consumes QQDivine result、QQData 断语

- [ ] **Step 1: 结果渲染**：'result' 事件 → 填充 #view-result：影形 canvas 240×240 画 QQShadow.draw（墨色剪影，宣纸底）；#result-shadow-name=影形名+寓意小字；#result-seal=品级名（印章样式）；#result-aspect=「巧运在 {面向名}」；#result-text = 影形断语 + 面向断语 + 品级断语 三段拼装（分三段 `<p>`）；#result-know=FACTS[knowIdx]；#result-codex=「图鉴 {n}/12」；showView("result")
  - 未得巧品级（weide）：印章用黛青色而非朱红（视觉区分，不刺眼）
- [ ] **Step 2: 按钮**：#btn-again→start()（runs++）；#btn-home-result→home+刷新进度行；#btn-codex-result→图鉴（origin=result）
- [ ] **Step 3: 首页进度**：#home-progress=「已集影形 {n}/12 · 历 {runs} 占」
- [ ] **Step 4: 无头验证**：forcePhase 到 result → 视图字段全非空；断语三段齐全；未得巧结果印章 class 正确；再占回到 water
- [ ] **Step 5: 记录进度**

---

