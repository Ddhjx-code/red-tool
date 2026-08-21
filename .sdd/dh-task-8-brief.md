### Task 8: 发布素材

**Files:** Create `release/dunhuang/images/*`、`release/dunhuang/发布文案.md`、`release/dunhuang/dunhuang.zip`；Modify `release/README.md`

- [ ] **Step 1: 截图**（630×840@2x）：01-home / 02-extract（飞天提色中，含 toast）/ 03-codex（18 色全解锁，先 unlockAll）/ 04-build（拼卡控件+预览）/ 05-card-scroll（paint 导出 scroll 版式 900×1200）/ 06-card-zaojing（zaojing 版式）
- [ ] **Step 2: 文案**（镜像 release/qiqiao/发布文案.md 结构）：标题备选 3（测试/美学向钩子，如「我从敦煌壁画里，拾出了 18 种千年矿物色」）；正文=玩法三步+两版式色卡+矿物色知识（铅白发黑/丹青由来）+七夕无关、敦煌 1987 世界遗产事实；tags "#国风vibecoding #敦煌 #敦煌色卡 #非遗 #国风 #中式美学 #传统文化 @科技薯"；配图表（封面建议 05-card-scroll）
- [ ] **Step 3: zip 拷贝 + README 行 10 + 图标提示词存档**（release/dunhuang/图标提示词.md：藻井五色方井为主意象的 app icon 提示词中英双版）
- [ ] **Step 4: 记录进度**

---

## Self-Review 结论

- Spec 覆盖：三壁画（T1/T2）、提色三类（T3）、图鉴（T3）、拼卡两版式三底（T4）、成品分享（T5）、音效教学（T6）、demo/套件/打包（T7）、发布（T8）——全覆盖
- 视觉门禁：T1 藻井（几何稳）→ T2 造型插画（精致门禁，截图给用户过目）
- 接口契约在各任务间一致（DHMural/DHExtract/DHCard 签名）；band 形状类型在 T2 引入、mural.js 同步支持
- 已知风险：飞天/九色鹿造型质量需视觉迭代（计划内检查点）；dusty 多斑点共享蒙尘层的实现取简方案已在 T2 注明
