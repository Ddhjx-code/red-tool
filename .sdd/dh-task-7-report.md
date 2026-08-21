# Task 7 报告：demo 自驾 + 无头套件 + 打包（敦煌拾色）

**状态：✅ 完成**　日期：2026-08-20

## 1. demo 自驾（?demo=1）— `tools/dunhuang/assets/main.js`

- `demoMode = /[?&]demo=1/.test(location.search)`；非 demo 零影响（所有 demo 函数仅定义不被调用，启动钩子包在 `if (demoMode)` 内）。
- 启动：boot 后 0.8s `demoStart` → 选壁画页（feitian）→ 0.7s 后开始提色。
- 单一 `demoTick` setTimeout 链（`demoSchedule` 每次 clearTimeout 旧定时器，防重入），无 setInterval。
- 每幅壁画 autopilot 流程：
  1. **擦尘优先**：对每个 dusty 形状沿 bbox 蛇形往返路径调 `DHMural.dustAt`（8 点/批 × 55ms，最多 3 遍、奇偶遍行错位加密），`dustProgress >= DUST_DONE(0.85)` 后由帧循环 `checkDust` 自动提取；继续擦到 ≥0.985 或 3 遍上限保证画面干净。
  2. **点按**：对每个非 dusty 未提取形状计算安全点 —— 候选序列（圆心/质心/质心-首顶点中点/近顶点/内缩边中点/顶点）逐一用 `DHMural.hitTest` 验证命中自身 id 才采用（解决藻井 zheshi 被 jin 覆盖、九色鹿背景被山形覆盖等层叠问题）；点按前若该点仍有残尘先补一刷（修复 ft-head 被飘带残尘挡住导致的 24/25 卡死）；间隔 0.7s。隐藏色照常点按。
  3. **alldone** → 停 1.5s → `showBuild()`（默认前 5 色 + 立轴色谱 + 宣纸 + 首题字）→ 1.2s 后点 `#btn-make-card` → result 停 3s → 下一壁画（feitian→jiuse→zaojing 循环），无限循环供录屏。

## 2. 无头套件 — `tests/dunhuang_smoke.py`

镜像 qiqiao_smoke.py：sync_playwright、?test=1、localStorage 首尾清空、console error/pageerror 全程收集末尾断言零、成功打印 SMOKE PASS、异常 exit 1。覆盖：

1. boot：#view-home active；COLORS 18 / MURALS 3 / TITLES 5 / FACTS 5；codex 空
2. zaojing 全提仪式：中心小擦→tap 隐藏金→tap 外层石青→全擦 shilv 自动提取（wait_for_function 轮询）→tap 余下 3 形 → 6/6，`alldone` 恰 1 次，codex 恰为 6 色集合
3. hitTest 抽查：飞天头→蛤粉、九色鹿身→蛤粉、藻井心→金
4. DHCard.paint 2 版式×3 底 = 6 张全为 data:image/png，解码 900×1200；宣纸角 ≈#F5F0E6、夜空角 ≈#2E3D52（容差 12）
5. build→make-card 全链路（先复用 helper 全提飞天 25/25、codex 6→11）：默认 5 色/scroll/paper，result active，#result-card 非空，cards=1，lastBuild 落库，DHShare.lastStats 就绪
6. 分享降级：无 window.xhs → 点存相册 → dialog 含「截图保存」
7. mock xhs：writeTempFile(data 为 png dataUrl)→saveImageToPhotosAlbum(filePath)；writeTempFile→postNote（title ≤20、tags 含 #敦煌、mediaInfo url = filePath）
8. 图鉴持久化：11 色 + 1 卡 → reload 保持 → localStorage.clear 归零
9. DHSound 全方法可调用不抛 + 静音持久化往返
10. 全程零 console/page error；SMOKE PASS

**运行结果（共 5 次，全部通过）：**

```
SMOKE PASS   （3.32s / 3.25s / 3.31s / 3.3s / 3.3s，均 <5s，远低于 120s 目标）
```

## 3. demo 自驾验证（?demo=1，playwright 45s 窗口）

```
 2s  feitian 0/25 → 20s 25/25 → 22s build → 23s cards=1 result → 26s 切 jiuse 0/34
murals seen: ['feitian', 'jiuse']  cards: 1   → DEMO PASS（零 console error）
```

调试记录：首版在 24/25 卡死 —— 擦尘到 85% 即停，飘带残尘正好挡住 ft-head 点按点（dustAtPoint 拦截）。修复：点按前对残尘补刷 + 擦尘加密至 ≥0.985/3 遍。

## 4. 打包

- 禁用 API 扫描（fetch/XHR/eval/new Function/Worker/传感器/clipboard/geolocation/window.open/iframe/http(s) 外链/行内事件/Math.random）：**0 命中**；index.html 9 个 `<script>` 全部外链 src，无内联脚本。
- `cd tools/dunhuang && zip -r ../../dist/dunhuang.zip . -x '*.DS_Store'`
- `unzip -l`：index.html 在根，12 条目仅 .html/.js/.css，**24,569 字节（24KB）< 1MB**
- zip 独立冒烟：解压临时目录 → `python3 -m http.server` → playwright 走 http（非 file://）→ zaojing 全提 6/6 + build→成卡 cards=1 + 结果卡非空 → **ZIP SMOKE PASS**（零 console error）

## 5. 文档

`docs/series-plan.md`：§3 表新增行 10（敦煌拾色 | 自由创作(色彩美学) | 从敦煌壁画提取18种矿物色拼专属色卡 | ✅ 已完成（dist/dunhuang.zip，<1MB） | 无（纯程序化） | 低）；§8 变更记录新增 2026-08-20 一行。

## 交付物

| 文件 | 变更 |
| --- | --- |
| tools/dunhuang/assets/main.js | 新增 demo autopilot（约 190 行，IIFE/var/无注释/无 Math.random） |
| tests/dunhuang_smoke.py | 新建，10 组断言 |
| dist/dunhuang.zip | 新建，24KB |
| docs/series-plan.md | §3 行 10 + §8 变更记录 |
