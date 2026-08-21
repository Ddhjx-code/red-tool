### Task 7: 图鉴 + 分享出口

**Files:** Modify `assets/main.js`（图鉴视图）、Create `assets/share.js`

**Interfaces:** Produces `QQShare.paintCard/saveAlbum/postNote`

- [ ] **Step 1: 图鉴视图**（类龙舟 codex 实现）：网格 12 格 `.codex-cell`；已解锁：canvas 画影形 + 名称；未解锁：`.is-locked` 灰底「?」；点已解锁→#codex-card 弹层（影形大图 + name + meaning + text + 吉凶标注）；#codex-count=n/12；返回回来源视图；每次打开刷新
- [ ] **Step 2: 解锁时机**：'result' 事件时 QQSave.unlock(shadow.id)；首次解锁 toast「影形入鉴 · {name}」（toast 组件同龙舟：#tutor 复用或新增 #toast）
- [ ] **Step 3: share.js**：paintCard(stats) 900×1200——宣纸底+朱红双线框；顶部小字「非遗手作坊 · 七夕」；影形剪影居中大图（QQShadow.draw 墨色，360px）；影形名+品级印章（朱红/黛青按吉凶）；「巧运在 {面向}」+ 三段断语折行（~16 字/行，避头尾从简）；知识卡白底片；底部「图鉴 n/12 · 乞巧占卜局」；stats={shadowId,shadowName,grade,gradeName,aspect,textLines,know,codexCount}
  - saveAlbum()/postNote()：writeTempFile→saveImageToPhotosAlbum/postNote，判空降级 alert「当前环境暂不支持直接保存，请截图保存哦」；postNote title「七夕占得{品级名}·{影形名}」（≤20 字校验）、tags "#国风vibecoding #七夕 #乞巧 #非遗 #国风 #中式美学"
- [ ] **Step 4: main.js**：result 渲染时 QQShare.lastStats=...；#btn-save-album/#btn-post-note click 绑定
- [ ] **Step 5: 无头验证**：paintCard 返回 dataURL 900×1200；无 xhs 点击→降级 dialog；mock xhs→writeTempFile→postNote 参数合法（title≤20、mediaInfo 结构）；图鉴 unlockAll 后 12/12 全亮、localStorage 持久
- [ ] **Step 6: 记录进度**

---

