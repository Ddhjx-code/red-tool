# Task 14: 发布素材 — Report

**Status: DONE**

## 摘要

为「龙舟破浪」生成小红书发布素材：6 张发布配图（Playwright 无头截图 + 游戏内钩子驱动）+ 发布文案 + README 进度表更新。

## 产出

### 1. release/longzhou/images/（6 张，全部 >20KB）

| 文件 | 尺寸 | 大小 | 截取方式 |
| --- | --- | --- | --- |
| 01-home.png | 1260×1680 (3:4) | 332KB | 干净存档首页（竖排书名 + 起航/图鉴按钮），viewport 630×840 @2x |
| 02-play.png | 1260×1680 (3:4) | 234KB | `?demo=1` 自驾，断言 dist≥80 / score≥100 / 非冲刺 / 前方 8<z<42 有障碍（截图时 dist=172m, score=302, entities=10） |
| 03-dash.png | 1260×1680 (3:4) | 740KB | `?demo=1` 轮询 `0.8 < dashT < 2.2`（冲刺中段，残影尾迹+金色光晕已生成；截图时 dashT=2.0） |
| 04-codex.png | 1260×1680 (3:4) | 73KB | `__game.unlockAll()` 后 `__ui.showCodex()`，断言 8/8 全解锁、0 个 locked cell |
| 05-result.png | 1260×1680 (3:4) | 209KB | demo 自驾攒到 score≥1500 后 patch 掉 `LZGame.start`（阻止 demo 自动重开）再 `forceHit×3` → 翻船结算。实绩：**1500 分 / 640m / 21 粽 / 最高连击 22 / 称号「鼓手传人」/ 图鉴 8/8 / 新纪录！/ 知识卡《五毒符》** |
| 06-card.png | 900×1200 | 101KB | 用 05 结算真实 `LZShare.lastStats` 调 `paintCard`，dataURL 渲染到 `<img>` 后按元素截图（1x，精确 900×1200） |

- 01–05 均为 3:4（630×840 viewport，device_scale_factor=2 → 1260×1680）；06 为原生 900×1200。
- 截图前已 `unlockAll` 且在 demo 启动前完成（seen[] 在 boot 时构建），跑局中无「图鉴解锁」toast 干扰 HUD。
- 全程零 console/page error（沿用 smoke test 的监听断言）。
- 截图脚本：`.sdd/task14-capture.py`（可重跑，含状态断言：score>200、zongzi>0、dist>50、dashT 窗口等）。

### 2. release/longzhou/发布文案.md

完全镜像 `release/jianzhi/发布文案.md` 结构：
- 标题（备选）×3（小红书口语，各 ≤1 emoji）
- 正文：hook（鼓点冲刺的热血瞬间）→ 怎么玩（①换线躲避 ②击鼓冲刺 ③吃粽集图鉴）→ 藏在玩法里的细节（击鼓冲刺/端午图鉴 8 件/伪 3D 江面）→ 关于端午（2006 首批国家级非遗、2009 UNESCO 人类非遗、《荆楚岁时记》「是日竞渡」、竞渡食粽——全部复用 data.js FACTS/CODEX 原文，无杜撰）→ CTA（晒称号战绩）
- 话题行：`#国风vibecoding #端午 #龙舟 #非遗 #国风 #中式美学 #传统文化 @科技薯`
- 发布提醒 checklist（带话题 / @科技薯 / 挂载 longzhou.zip / 创作方向归类）
- 配图表 6 行带用途建议；封面推荐 **03-dash.png**（全游戏最动感一帧，直接传达「击鼓冲刺」差异化卖点），备选 06-card.png，并附 15s 录屏动图建议（对齐 jianzhi 的 blockquote 备注格式）

### 3. release/README.md

发布进度表追加第 8 行：`| 8 | 龙舟破浪 | 经典换皮（无尽跑酷） | ✅ 素材就绪，待发布 | longzhou/ | 首个「经典玩法换皮」形式，端午节点向 |`。既有行（含打铁花 待开发）未动；「下一个：打铁花」小节已存在，无需新增。

## 验证

- [x] 6 图齐全，均 >20KB（最小 73KB）
- [x] 尺寸：01–05 = 1260×1680（3:4），06 = 900×1200（sips 实测）
- [x] 跑局画面有分数/连击/障碍，冲刺帧 dashT 在窗口内，结算非零且带称号印章+知识卡
- [x] 文案含 jianzhi 版的全部章节
- [x] README 表有第 8 行
- [x] 未做 git 提交

## 遗留/说明

- `longzhou.zip` 挂载包不在本任务范围（发布时按容器规范打包）。
- 图片无法肉眼复核，构图依赖状态断言（dashT 窗口、障碍 z 区间、score/zongzi 阈值）；02-play 若想要更近的障碍特写，可把 z 区间收窄到 8–25 重跑脚本。
