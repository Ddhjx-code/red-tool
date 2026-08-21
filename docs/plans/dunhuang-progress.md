# 敦煌拾色 执行进度账本

- 计划：docs/plans/2026-08-19-dunhuang-plan.md
- 规格：docs/specs/2026-08-19-dunhuang-colorcard-design.md
- 视觉稿：.sdd/mockups/card-scroll.png / card-zaojing.png（用户已确认）
- 执行方式：子代理逐任务（无 git，不 commit）

| Task | 状态 | 备注 |
| --- | --- | --- |
| 1 | ✅ complete | 6 项检查×3 绿；review 通过（18 色/藻井六层/DPR 链路/射线法全核对）；交接 T3：①视图激活后补 resize ②tap 命中前按触点尘层 alpha 拦截（jin 在 shilv 尘区下） |
| 2 | ✅ complete | T2 CHECK PASS：飞天 25 形/九色鹿 34 形，hidden/dusty 标记正确，band 展开渲染+命中验证（蒙尘带显尘色、净带显本色）；截图 dh2-feitian/jiuse 待用户过目（精致门禁） |
| 3 | ✅ complete | 27/27 检查+review 独立复跑通过（尘门顺序/toast 文案/飞入/图鉴/持久化全核对）；minor：详情卡 canvas 未 2x、金粒子未做（非约束） |
| 4 | ✅ complete | 24/24 检查；review 逐像素对照视觉稿通过（边框/角饰/印章/两版式尺寸全核对）；minor：竖排字距略疏、night 副题用金色（判为合理偏离） |
| 5 | ✅ complete | 21/21 检查；review 逐条核对 jsapi 契约/降级文案/持久化/入场重触发通过 |
| 6 | ✅ complete | 17/17 检查；review 通过（8 音效参数/静音往返/教学条件/三项打磨全核对）；minor：tutorialTimers 死机制无害 |
| 7 | ✅ complete | SMOKE PASS×5（3.3s/次）；demo 20s 提完飞天 25/25→成卡→循环（修复残尘挡点按死锁）；dist/dunhuang.zip 24KB+zip 冒烟过；series-plan 更新 |
| 8 | ✅ complete | 6 张配图+文案+zip+README 行 10+图标提示词；发现并修复蒙尘进度虚高 bug（细长带 bbox 采样→改仅采落尘区域，初始进度 0.85→0，擦拭可达 1.0）；重打包 24.7KB+demo 视频 51s |
| 11b | ✅ complete | 科举合成 v1.1：过线结束修复（短宽限600ms+速度判定）+仕途累计（探花/榜眼/状元次数持久化+菜单/结算展示）+分享（金榜题名卡900×1200→存相册/发笔记，无端能力降级）；重打包 dist/keju.zip 34.6KB，release/keju 素材齐（5图+33s视频+文案+图标提示词），FINAL ZIP SMOKE PASS |
