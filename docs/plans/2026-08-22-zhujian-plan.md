# 竹简观兵 实现计划

- 日期：2026-08-22 | 系列：「非遗手作坊」#13 展示型（3D 展卷 · 文博向）
- 规格：`docs/specs/2026-08-22-zhujian-guanbing-design.md`
- 产物：`dist/zhujian.zip`（165KB · 全程序化零素材 · 内嵌 three.js r128）

## 架构

- 纯原生 JS（IIFE + `window.Zhujian*` 全局）+ three.js（WebGL）。DOM 负责视图/HUD/图鉴/附片/手记，three 负责暗室展馆（展台/卷/十三束/篇签/读简三面）。
- 数据 `window.ZhujianData`：十三篇（篇名/原文剪句/金句/今译/点睛/知识附片）+ 出土本体 4 条目 + 印章 3 枚。
- 确定性：场景仅作装饰纹理随机；业务无 `Math.random()` 依赖（分享卡纸纹除外，非逻辑）。

## Global Constraints

- 容器规范（`.skill/references/`）：`index.html` 在 zip 根；脚本全部外置、禁内联/行内事件/eval；禁网络/剪贴板/下载/外链/传感器/Worker/iframe；资源相对路径 `./assets/...`；仅 html/css/js/json/图片/字体入 zip
- 端能力出口：`window.xhs?.miniTool` 判空降级（writeTempFile → saveImageToPhotosAlbum / postNote），按钮由用户主动点击触发
- 安全区：`var(--safe-area-inset-top/bottom, env(...))`，viewport 含 `viewport-fit=cover`
- 教学浮层：背景指针穿透（`pointer-events:none`），首次进入可即点按钮
- 系列视觉 tokens：夜青底 `#070a12`、藤金 `#e8b84b`、宣纸竹黄 `#cfaa6d`、楷题字体栈；三枚朱印「观兵/知兵/善战」

## 任务清单（t1→t13 一次成卷实现 + 验证）

- [x] t1 T0 视觉验证：3D 原型（卷轴/展开/文字简/光锥/微尘），headless 截图客观校验（展卷旋转方向 bug 已修复），截图 `.sdd/t0-zhujian/shots/`
- [x] t2 目录与包骨架：`tools/zhujian/{index.html,assets/{data.js,engine3d.js,audio.js,share.js,main.js,style.css,vendor/three.min.js}}`
- [x] t3 数据：13 篇全文案（篇题/金句/今译/点睛/知识附片）+ 出土本体条目，措辞保守（疑点不写死）
- [x] t4 引擎·暗室展馆：展台/木纹/暖金光锥/微尘/卷轴（竹纹+端轴+三道编绳）
- [x] t5 引擎·展卷动画：13 束依次躺平（时间驱动 + 点按跳卷），过渡到浏览态
- [x] t6 引擎·篇签拾取：13 篇签（序数+篇名竖排）悬浮，raycast 点选
- [x] t7 引擎·读简三面：选中束抬起对光，篇题简/金句简/点睛简三面循环（滑动/钩子切面）
- [x] t8 主控·视图状态机：home/stage/codex/note 四视图 + 全部按钮接线 + 教学浮层
- [x] t9 附片知识 + 图鉴：读篇亮点「附片」，十三篇图鉴收集（localStorage `zj-done`），13/13 全卷解锁「银雀山之谜」
- [x] t10 手记分享：900×1200 仿古册页（竖排篇名/金句/今译/朱印/落款），writeTempFile→存相册/发笔记，无端能力降级提示
- [x] t11 音效：WebAudio 程序化（氛围褐噪 + 展卷/点签/翻简/附片/成就 5 类 SFX），静音持久化
- [x] t12 验证：`tests/zhujian_smoke.py`（python 版断言，供上级环境）+ `.sdd/t0-zhujian/capture.js` 内置 node 验证（本机实际执行）——8/8 PASS
- [x] t13 打包：`dist/zhujian.zip`（165KB，index.html 在根），解压自检 + 合规扫描（three.min.js 命中仅为 W3C 命名空间字符串，非外部引用）

## 待办（发布前）

- [ ] 真机容器验收（导航栏/安全区/贴纸位）；试玩反馈后手j色迭代（竹纹/光场/读简视角）
- [ ] release 素材与文案：首页配图（zj 首页暗室一帧）、上架文案、演示 gif/视频（可选）
- [ ] 知识附片措辞终审（1949 事后年代、'约 4,900 余枚' 口径、山东博物馆藏语序）
- [x] t14 性能优化轮（2026-08-23）：defer + 首屏纯 CSS + 3D 懒初始化（进馆才 init）；13 束后台分片背填；读篇只渲染选中简束 + pr 1.5 + 阴影 1024；加盐（微尘漂浮/呼吸光/描金/首页竹影）；修复「展卷后 3D 黑屏」致命 bug；读篇 3 帧/2.5s→22-28 帧/2s；回归 8/8 PASS，重打 dist/zhujian.zip
- [ ] t15 真机容器验收（导航栏/安全区/贴纸位）；试玩反馈后手色迭代（竹纹/光场/读简视角）
