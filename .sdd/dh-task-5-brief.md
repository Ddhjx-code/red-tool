### Task 5: 成品卡 + 分享出口

**Files:** Modify `assets/main.js`（result 视图 + 分享接线）

- [ ] **Step 1: 成卡流程**：#btn-make-card → 全尺寸 paint(opts) 绘入 #result-card（显示宽 390 内 3:4）→ setView result；DHSave.cards+1、lastBuild 存当前 opts；钤印动效：结果视图入场时印章从 1.4 缩放盖落（CSS 动画，类 qiqiao stamp-in）
- [ ] **Step 2: 分享**：#btn-save-album / #btn-post-note → writeTempFile→saveImageToPhotosAlbum / postNote（title「我在敦煌拾了{N}色」≤20 字、content、tags "#国风vibecoding #敦煌 #敦煌色卡 #非遗 #国风 #中式美学"、mediaInfo）；判空降级 alert「当前环境暂不支持直接保存，请截图保存哦」
- [ ] **Step 3: 按钮**：#btn-again→build 视图（保留上次选择）；#btn-home-result→home+刷新进度行（「已集 {n}/18 色 · 成卡 {cards} 张」）
- [ ] **Step 4: 无头验证**：成卡→result 视图激活+canvas 非空；无 xhs 点击→降级 dialog；mock xhs→writeTempFile→save/postNote 参数合法（title≤20、filePath 传递）；cards 计数持久化
- [ ] **Step 5: 记录进度**

---

