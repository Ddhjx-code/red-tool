### Task 3: 提色交互 + 图鉴

**Files:** Create `assets/extract.js`；Modify `assets/main.js`（正式装配 extract 视图）

- [ ] **Step 1: extract.js** — 状态：当前壁画、已提 shapeId 集合、飞入动画队列、toast 队列
  - `tap(x,y)`：hitTest → 无命中 return；形状 dusty 且 dustProgress<DUST_DONE → 提示 toast「拂去浮尘，方见其色」return；否则提取：markExtracted、飞入动画（色点从触点抛物线飞入 #palette-bar，0.6s）、首次→DHSave.unlock + emit('extracted') + 知识 toast「{名} · {来历}」+ 隐藏色加「发现隐藏色」前缀+金粒子；非首次→仅 emit('collected')
  - 蒙尘擦除由 main 的 pointermove 驱动 dustAt；每帧检查该壁画所有 dusty 形状 progress，≥DUST_DONE 自动提取（同 tap 提取流程，toast「拂尘见色 · {名}」）
  - 全部形状提完 → emit('alldone') toast「此壁画颜色拾尽」
- [ ] **Step 2: main.js 装配**：视图机 setView；select 卡片构建（缩略 canvas 用 DHMural 离屏渲染 120×120 + 进度 n/m）；extract 视图手势——pointerdown 记起点，pointerup 位移<12px 判 tap→DHExtract.tap；pointermove 按下且命中 dusty 区域→dustAt（沿移动插值）；#palette-bar 渲染已提色圆点（按 COLORS 序）；按钮接线（build/codex/back-select）；rAF：DHExtract.update + DHMural.draw
- [ ] **Step 3: 图鉴视图**（同乞巧 codex 实现）：18 格 `.codex-cell`，解锁=canvas 色块（圆角方色块+勾线）+名，未解锁=.is-locked「?」；详情卡：色块大图+名+hex+text；来源回跳（origin home/extract）；#codex-count n/18
- [ ] **Step 4: 无头验证**（?test=1）：选 zaojing → tap 中心（金，隐藏色）→ codex 含 jin + toast 含「发现隐藏色」；tap 石青外框 → 解锁 qingshi；dusty 石绿：直接 tap → toast 提示擦尘；模拟 dustAt 擦至 ≥0.85 → 自动解锁 shilv；飞入动画存在（动画队列长度>0）；alldone：逐个提完全部形状 → emit；图鉴 0→n 持久化
- [ ] **Step 5: 记录进度**

---

