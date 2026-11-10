# 验收动图和视频

小工具的宣传物料里，动图（GIF）和短视频最容易出问题，因为**静帧好看不代表动起来好看**。
下面这套流程来自 `gif-factory` 的 `references/stability.md`，它做的是表情包动图，
但验收逻辑一样。

## 1. 三条原则

**看解码后的成品，不看源图。**
导出的是 GIF 就解 GIF 的帧，是 MP4 就抽 MP4 的帧。源工程里的图层、合成前的图、
截图工具里看到的样子，都不算数。

**一叠漂亮的静帧，动起来照样会闪会跳。**
原文：`A collection of attractive stills can still flash or jump when animated.`
所以必须看两样：正常速度播放一遍，以及首帧 → 尾帧 → 首帧的接缝。

**分数只用来提名，不用来通过。**
它的工具会算帧间差异分数并给出转场候选，但原文写得很清楚：分数高的可能只是眨了个眼，
分数低的可能是脸烂了。**自动指标只负责告诉你该看哪几帧，通过与否必须人看。**

## 2. 三种状态分开记

它要求把三件事分开写，不许混：

| 状态 | 谁给 | 含义 |
| --- | --- | --- |
| 技术检查 | 脚本 | 帧数、时长、尺寸、能否解码、文件完整 |
| 视觉检查 | 助手 | 逐帧看过，没有脏帧、没有跳变、接缝干净 |
| 用户接受 | 人 | 这一版可以发 |

三者都过才算完。常见错误是「脚本说 426 帧齐了」就当作可以发。

## 3. 具体怎么查

### GIF / 短动图

```sh
# 逐帧导出 + 编号总览（一屏看完所有帧）
ffmpeg -v error -y -i in.gif -vsync 0 frames/g%03d.png
ffmpeg -v error -y -i in.gif -vf "scale=200:-1,tile=8x4" -frames:v 1 sheet.png

# 首尾接缝：把末帧和首帧并排放
ffmpeg -v error -y -i in.gif -vf "select='eq(n\,0)+eq(n\,LAST)',scale=300:-1,tile=2x1" -frames:v 1 seam.png
```

`gif-factory` 自带一个更完整的 `scripts/review_gif.py`（只依赖 Pillow），能出逐帧图、
编号总览、细节放大图、浏览器播放器和 `audit.json`，并把签收绑在文件哈希上——
**文件一改，之前的签收自动失效**。这个「哈希绑定」的做法值得抄，它防的是
「改了东西还用旧结论」。

### 视频

```sh
# 每 0.5 秒一帧的总览，看节奏
ffmpeg -v error -y -i in.mp4 -vf "fps=2,scale=200:-1,tile=9x4" -frames:v 1 all.png

# 定点检查转场：只抽受影响的那十几帧
ffmpeg -v error -y -i in.mp4 -vf "select='between(n\,265\,310)*not(mod(n\,5))',scale=230:-1,tile=10x1" -frames:v 1 mid.png
```

## 4. 我们踩过的坑（都会在抽帧里露出来）

| 症状 | 原因 | 修法 |
| --- | --- | --- |
| 画面闪白 0.1 秒 | 旧元素已消失，新图层还没出现 | 让新图层先进、旧元素后走，留重叠 |
| 半透明手机叠半透明文字 | 遮罩和内容共用一个 opacity | 拆成 `.pv-bg`（遮罩）和 `.inner`（内容）各自独立时序 |
| 开头 3 秒发糊 | 大字淡出和手机淡入同时进行 | 先把大字撤干净，再让手机进 |
| 手机忽然放大一下 | 不同段落给了不同的 scale | 全程只用一个 scale 曲线，别分段跳 |

前两个尤其隐蔽：单看任何一帧都没问题，只有抽帧连起来才看得见。

## 5. 生成端：不要录屏

我们做月历视频的路子是**逐帧渲染**，不是交互录制：

```sh
# 用负的动画延迟把 CSS 动画冻结在任意时刻，页面读 #t=秒数
promo/yueli/src/video/render_frames.py      # 426 帧，5 并发约 8 分钟
promo/yueli/src/video/render_range.py 265 319   # 改了转场只重渲这一段
promo/yueli/src/video/compose.sh            # ffmpeg 合成
```

录屏会掉帧、会有编码抖动，逐帧不会；代价是渲染慢，但慢可以并行。

一个坑：`render_frames.py` 遇到已存在的帧会跳过（允许中断续跑）。改了时间轴却没删旧帧，
会得到「看起来渲完了其实没变」的结果——重渲区间要用 `render_range.py`，它是覆盖写。

## 6. 宣传物料的完整流程

实例在 [`../../../promo/yueli/`](../../../promo/yueli/)，README 里有全部命令和坑。
顺序是：

1. `src/shoot.sh` 出界面截图（iframe 固定 390×844 + 2x 采样，绕开无头 Chrome 的 500px 钳制）
2. `src/render.sh` 出 1080×1440 图文
3. `src/video/render_frames.py` + `compose.sh` 出竖版视频
4. 按本文第 3 节抽帧检查
5. 合格后才替换 `images/` 与 `video/` 里的成品

## 来源

- 仓库：`https://github.com/WoYun520/gif-factory`（MIT）
- 文件：`references/stability.md`（验收规则）、`references/keyframes.md`（关键帧工作流）、
  `scripts/review_gif.py`（哈希绑定签收）
- 本文为摘要改写，未照搬代码；表格里的坑是本仓库实际遇到的。
