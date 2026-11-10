# 竹简观兵 开发进度

- 2026-08-22 T0 视觉验证：3D 原型（卷轴→24 简展开→竖排 5 句文字简）无头截图；发现并修复「展卷旋转方向反了」bug（文字面曾背对镜头）；光锥过强降 opacity 0.05→0.035；卷轴加大（0.26→0.30/3.0→3.4）。原型存 `.sdd/t0-zhujian/`（页面+引擎+截图+调试定位图）
- 2026-08-22 v1 一次成卷：十三篇束布局（束=宽 0.16 简体，13 束自卷端依次展开）+ 篇签 13（序数/篇名 竖排）+ 读简三面（篇题/金句/点睛，canvas 纹理预渲染）+ 附片知识卡 + 图鉴收集（13/13 全卷解锁「银雀山之谜」）+ 900×1200 手记册页（竖排金句/今译/朱印/落款）+ WebAudio 氛围与 5 类 SFX + 教学浮层（背景穿透）+ `?test=1`/`?demo=1` 钩子
- 2026-08-22 验证：引擎 8/8 断言 PASS（home 渲染/展卷 browse 13 束/读篇选中/三面切换/附片点亮/全卷解锁/手记卡 900×1200/零页面错误），Chrome headless（playwright-core）+ http 源；`tests/zhujian_smoke.py` 同断言（python 版，上级环境跑）
- 2026-08-22 打包：dist/zhujian.zip 165KB，index.html 在根，8 文件，解压合规扫描通过（three.min.js 命中仅 W3C `http://www.w3.org/1999/xhtml` 命名空间串）
- 待办：真机容器验收；release 配图/文案/演示；知识文案终审
- 2026-08-22 验证管线经验（重要）：该环境 Chrome headless（swiftshader）截图有两套互相矛盾的管线——`page.screenshot`（CDP 合成）对浏览态 WebGL 画布会出全黑坏帧，但读简态正常；`canvas.toDataURL`（preserveDrawingBuffer:true 帧缓冲）浏览态正常、读简态全黑。最终策略：浏览态用帧缓冲导出、读简态用 CDP；真实渲染本身正常（帧缓冲统计 warm 29%/mean 73.6 证明）（2026-08-23 复盘：本次优化轮同机重跑，浏览态 toDataURL 反而全黑、CDP 正常——两条管线稳定性随 run/状态波动，判定以真实渲染帧统计为准，勿再按单一管线下结论）
- 2026-08-22 排障记录：①束距 0.086<束宽 0.16 布局重叠 → 展台加深 3.4、束距 0.13、束宽 0.12；②tlog 诊断函数误定义在 init 局部作用域导致帧循环 ReferenceError 冻结（已重构并加帧熔断：异常只报一次、rAF 不中断）；③capture.js 正则清理误删 selectPian 段造成「读态回退」假象（脚本 bug，非产品 bug）
- 2026-08-23 性能优化轮（正式正品产物，非仅演示）：①首屏提速——首页保持纯 CSS，6 个 script 全 `defer`，进馆才懒初始化 3D（`ensureStage`，`?test=1` 下暴露 `window.__zj.initNow`）；headless 实测 dcl 4.5s→~0.3s，进馆 init 1.8-2.1s。②读简降压——阴影 map 2048→1024；读篇态 pixelRatio 上限 2→1.5；读篇只渲染选中简束（其余 `visible=false`）、关 spotlight 阴影回览恢复；13 束构建后台背填（每帧限时 90ms，rAF 分片，选篇竞态安全）。③加盐氛围——微尘 y 轴正弦漂浮、暖光/主光低频呼吸、选中简束描金（Additive 辉光 + 进入闪亮），首页前景竹影 SVG（z-index 3，CSS 微摆）。④修致命 bug——「展卷」按钮从不切视图导致 canvas 0×0 黑屏 3D 完全不显示，现点击即切沉浸视图（回归断言通过）。读篇帧率实测 3 帧/2.5s→22-28 帧/2s（A/B：pr1.5 收益最大，shadow off 为正贡献）。重打 `dist/zhujian.zip`（index.html 在根，10 文件）；`Zj3D.debugSet(k,v)` 压测钩子（shadow/pr）。
