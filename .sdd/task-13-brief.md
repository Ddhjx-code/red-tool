### Task 13: 打包 + zip 冒烟 + 系列文档更新

**Files:**
- Create: `dist/longzhou.zip`
- Modify: `docs/series-plan.md`（#8 条目 + 变更记录）

- [ ] **Step 1: 打包前自检**（`.skill/references/zip-artifact-spec.md` §6 + device-capabilities §6 扫描清单逐条 grep：`fetch(|XMLHttpRequest|eval(|new Function|Worker|devicemotion|clipboard|geolocation|window.open|https://`，应零命中；无内联 script/onclick）
- [ ] **Step 2: 打包**

```bash
cd tools/longzhou && zip -r ../../dist/longzhou.zip . -x '*.DS_Store' && cd ../.. && ls -la dist/longzhou.zip
```

Expected: zip 存在，体积 <1MB；`unzip -l` 确认 `index.html` 在根、仅支持类型

- [ ] **Step 3: zip 独立冒烟**：解压到临时目录 → playwright 加载解压后的 index.html（`?test=1`）→ `__game.start()` 正常、无 console error、截图一张
- [ ] **Step 4: 更新 series-plan.md**：§3 表格加「8 | 龙舟破浪 | 经典换皮（无尽跑酷） | … | ✅ 已完成（dist/longzhou.zip）」；§8 变更记录加一行
- [ ] **Step 5: Commit**

---

