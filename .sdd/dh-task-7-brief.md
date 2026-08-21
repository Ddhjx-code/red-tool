### Task 7: demo 自驾 + 无头套件 + 打包

**Files:** Modify `assets/main.js`（demo）；Create `tests/dunhuang_smoke.py`；Create `dist/dunhuang.zip`；Modify `docs/series-plan.md`

- [ ] **Step 1: demo 模式**（?demo=1）：boot 0.8s 后自动 start→select→feitian；autopilot 依次 tap 普通色 4 个（坐标从 SHAPES 计算形状中心）→ 擦尘（沿 dusty 形状 bbox 往返移动模拟擦拭）→ 提隐藏色 → 停 1.5s → build（默认选择）→ 成卡 → result 停 3s → 下一壁画循环；非 demo 零影响；定时器防重入
- [ ] **Step 2: 套件** `tests/dunhuang_smoke.py`（参照 tests/qiqiao_smoke.py 结构，?test=1 hermetic）：① boot 数据（18 色/3 壁画/5 题字/5 FACTS）② zaojing 全提流程（含擦尘模拟+隐藏色）→ codex 增量正确 ③ 三壁画 hitTest 抽查 ④ paint 两版式×三底 900×1200 ⑤ build→result 全链路 + cards 计数 ⑥ 分享降级 dialog ⑦ mock xhs 参数合法 ⑧ 图鉴持久化（unlockAll→reload 保持）⑨ 全程零 console error ⑩ SMOKE PASS；跑 3 遍稳定
- [ ] **Step 3: 打包**：禁用 API grep 扫描零命中 → `cd tools/dunhuang && zip -r ../../dist/dunhuang.zip . -x '*.DS_Store'` → unzip -l 根 index.html/仅支持类型/<1MB → 解压 http 源冒烟（提色一次+成卡一次零报错）
- [ ] **Step 4: series-plan.md**：§3 加行 10；§8 变更记录
- [ ] **Step 5: 记录进度**

---

