---
name: minitool-reference-projects
description: >-
  做小红书小工具时的外部参考总册，按阶段取用。找玩法/视觉参考和提示词时查
  effect-index（awesome-kimi-k3-game 的 36 个单文件效果、EVEngine 的提示词范式）；
  写发布文案时用博主人格预设（dsh-media-desk）；设计存储与发布前自检时看状态规则
  与 draft/publish 双档（ohmygame）；验收动图/宣传视频时用解码逐帧流程（gif-factory）；
  出发布物料前查性能门禁与数据导出格式（piclex-web）。含「demo → 小工具 zip」的
  强制改造清单。
metadata:
  version: "2.0.0"
  baseSpec: "minitool-zip-builder 1.7.0（../.skill/SKILL.md）"
---

# 参考项目手册

做小工具时不要从零想。本地有六个参考仓库，覆盖「找效果 → 写文案 → 设计状态 →
验收动图 → 发布前门禁」整条链路。

前半部分是**目录和用法**，后半部分是**强制改造清单**——参考项目几乎都是单文件内联
写法，照抄会打包失败。

## 1. 按阶段查

| 你现在要做的事 | 读哪节 | 看哪个仓库 |
| --- | --- | --- |
| 定玩法、定视觉、找提示词 | 第 3 节 + [`references/effect-index.md`](references/effect-index.md) | awesome-kimi-k3-game、EVEngine |
| 写笔记标题、正文、标签 | 第 4 节 + [`references/publishing-copy.md`](references/publishing-copy.md) | dsh-media-desk |
| 设计存储结构、加字段、做发布前自检 | 第 5 节 + [`references/state-and-release-gate.md`](references/state-and-release-gate.md) | ohmygame |
| 验收宣传 GIF / 视频 | 第 6 节 + [`references/motion-review.md`](references/motion-review.md) | gif-factory |
| 测性能、做导出/导入备份 | 第 7 节 + [`references/performance-and-export.md`](references/performance-and-export.md) | piclex-web |
| 已有一份 demo，要改成小工具 | 第 8 节「强制改造清单」 | 全部 |

## 2. 六个仓库

都在 `/Users/wang/AI/workspace/` 下，**不属于本仓库，不要 copy 进来**。换机器重新取，
见第 10 节。

| 仓库 | 拿它干什么 | 许可 | 本地体量 |
| --- | --- | --- | --- |
| `awesome-kimi-k3-game` | 36 个单文件效果 + 可复用的生成提示词 | CC0 1.0 | 26MB |
| `EVEngine.github.io` | AI 驱动引擎的方法论：SKILL 写法、AI 自检回路 | 见仓库 | 小 |
| `dsh-media-desk` | 15 个博主人格预设、封面与分镜的硬约束 | MIT | 7MB |
| `ohmygame` | 界面与状态的分工、draft/publish 双档校验 | Apache-2.0 | 17MB（仅文本） |
| `gif-factory` | 动图的验收流程（不是生成流程） | MIT | 800KB（仅文本） |
| `piclex-web` | 性能门禁四指标、用户数据导出格式 | MIT | 284MB |

> `ohmygame`、`gif-factory` 是文本快照（源码 + 文档 + 脚本），仓库里的示例视频/GIF 没下，
> 那些对阅读没有价值。两者的 `.git` 都没带，不能 `git pull`。

## 3. 找效果和提示词

先看 [`references/effect-index.md`](references/effect-index.md)，36 个效果的全表，
含引擎、体积、依赖类型、移植难度。

**这些效果不是「Kimi 生成的」，是 Grok Bot 写的对照实现**，所以每个 `prompt.md` 都是
一份「能被 AI 复现出这个效果」的提示词样本——价值在提示词，不在代码。

挑的顺序：

1. 按题材/玩法筛（文化类优先看「美术风格」栏和「粒子与光效」栏）
2. 按依赖筛——标了 `ES module` 或 `CDN` 的一律排除（25 个零依赖的够用）
3. 按体积筛——零依赖那批全在 6–13KB

看效果要打开 `effects/<slug>/index.html`，**不要只读代码**：手感全在参数里。

EVEngine 技术上用不上（C++/Vulkan/Squirrel，产出桌面原生程序），只借三点：SKILL.md
的写法、AI 自检回路、最小可运行优先。

> ⚠️ `meta.json` 的 `external_services` 字段不可信，两个效果把它标成「无」却用 importmap
> 从 jsDelivr 拉 THREE。判断依赖一律看 HTML 里的 `<script>` / `importmap`。

## 4. 写发布文案

`dsh-media-desk` 的 `src/style-presets.js` 有 15 个博主人格，字段是
`tone / sentences / opening / structure / words / avoid / samples`。

对做小工具最有用的三类是：**工具教程博主**（先给结果 → 准备什么 → 分步 → 容易错的地方）、
**数码测评博主**（一句话结论 → 最好的一点 → 最烦的一点 → 谁该买）、**读书笔记博主**
（困惑 → 一个观点 → 一个例子 → 今天能做的一件事）。

真正该抄的是 **`avoid` 禁用词表**，它是按品类列的反面清单，比正面范文管用。
写文案时挑一个人格，然后用它的 avoid 表自查一遍。详见
[`references/publishing-copy.md`](references/publishing-copy.md)，里面有 15 个预定的
结构骨架和完整禁用词表。

## 5. 状态与发布前自检

`ohmygame` 的核心边界一句话：**界面拥有表现和输入，运行时拥有状态和流程。**

对小工具直接可用的两条：

1. **状态只改已有的键。** 要用新字段，必须先在初始状态里给默认值；运行时不许「没有就补一个」。
   版本迁移照这个做，而不是靠读的时候兜底。
2. **校验分两档。** draft 只查语法和引用，publish **额外要求每个可点元素都有去处、
   每个引用的文件都存在**——「点了没反应」在 publish 档是硬错误。

验证方式也不是「扫描通过」就完事：打开 → 重置 → 走到改动处 → 真交互 → 在状态里确认
结果 → 截图。详见 [`references/state-and-release-gate.md`](references/state-and-release-gate.md)。

## 6. 验收动图和视频

`gif-factory` 的 `references/stability.md` 是这个仓库最该读的一篇，核心三句：

- **看解码后的成品帧，不看源图。** 逐帧看身份、手、遮挡、有没有把隔壁格子的碎片带进来。
- **一叠漂亮的静帧，动起来照样会闪会跳。** 必须看首→尾→首的接缝。
- **转场分数只能用来提名要看的帧，不能当通过依据。** 分数高的可能只是眨了个眼。

它还要求把三种状态分开写：技术检查通过 / 助手看过 / 用户接受，不能混为一谈。

本仓库已有一个跑通的实例：[`../../promo/yueli/`](../../promo/yueli/)（月历的图文 + 视频），
含预览壳生成、逐帧渲染、合成脚本和踩过的坑。详见
[`references/motion-review.md`](references/motion-review.md)。

## 7. 性能和导出

`piclex-web` 是唯一给出硬指标的项目（`docs/web-performance-release-gate.md`）：

| 指标 | 门槛 |
| --- | --- |
| 主线程单个任务 | < 33ms，超阈值次数为 0 |
| requestAnimationFrame 间隔 | < 50ms，超阈值次数为 0 |
| Long Tasks / Long Animation Frames | 0 |
| Event Timing（输入到绘制） | < 100ms，超阈值次数为 0 |

每轮至少 8 秒真实操作 + 120 个动画帧，桌面 1440×1000 和触屏 390×844 各跑一遍。
两条态度：**功能测试通过不能替代性能测试**；失败证据必须保留，不许重试挑一版全绿的。

导出格式照 `docs/photo-archive-format.md`：包外放 `.version.json` 记格式号、导出器版本、
整包 SHA256（丢了不影响恢复）；**导入逐字段校验，任何一处不过就 throw，现有数据一个
字节都不动**。详见 [`references/performance-and-export.md`](references/performance-and-export.md)。

## 8. demo → 小工具：强制改造清单

这是最容易翻车的地方。参考项目几乎都是「单文件 HTML + 内联 script」，而小工具容器：

| 冲突点 | 参考项目的做法 | 小工具的要求 | 处置 |
| --- | --- | --- | --- |
| 脚本内联 | 全部内联 `<script>…</script>` | **CSP 无 `unsafe-inline`，内联脚本根本不执行** | 拆成 `app.js`，用 `<script src="./app.js">` |
| 行内事件 | `onclick="..."` | 同样被 CSP 拦 | 改 `addEventListener` |
| ES module | 11 个用 `type="module"` + `importmap` | **禁止 `type="module"` / `import` / `export`** | 打包成 IIFE 经典脚本 |
| 外部 CDN | 11 个从 jsDelivr 拉 `three@0.160.0` | **外部 CDN 一律加载不到** | 下载库文件进包内，或改 Canvas 2D |
| 现代语法 | 可选链、`??`、class 字段 | 交付产物限 **ES2017 / Chrome 61** | 降级写法，判空用 `&&` |
| 现代 CSS | `gap`、`aspect-ratio`、`dvh` | Chrome 61 不支持，需基线 + 能力检测 | 见 `.skill/references/css-compatibility.md` |

具体动作（按顺序做，别跳）：

1. **拆文件**：`index.html` 只留结构 + `<link rel="stylesheet" href="./style.css">` + `<script src="./app.js">`（样式可内联，脚本不可内联）
2. **抄 JS**：把内联 script 原文搬进 `app.js`；顶部加 `'use strict'` 包裹 IIFE 避免全局污染
3. **清语法**：`?.` → `a && a.b`；`??` → `||` 或显式判空；class 私有字段 → 闭包变量；顶层 `await` → 包进 `async function init()` 后调用
4. **清依赖**：有 CDN 的一律改本地。THREE 建议用 r13x 的 UMD 版（`three.min.js`，约 600KB），r160 的 module 版在 Chrome 61 上跑不起来
5. **清 CSS**：Flex `gap` 改 `margin`（`> * + *` 写法）并加能力检测；`inset` 拆成 `top/right/bottom/left`
6. **加容器适配**：`<meta name="viewport" content="width=device-width,initial-scale=1">`、`<link rel="icon" href="data:,">`、禁掉右键菜单与长按选中的默认行为
7. **接端能力**（需要分享/存图时）：判空一律写 `window.xhs && window.xhs.miniTool`，**不要写 `window.xhs?.miniTool`**
8. **自检**：
   ```sh
   python3 tests/spec_compliance_scan.py            # 语法/CSS/外链/体积
   python3 .skill/scripts/audit_artifact.py <zip>   # 产物审计
   ```

### 复用提示词时追加的约束段

把 `prompt.md` 里的主提示词喂给 AI 时，**必须追加**下面这段，否则生成的一定是单文件内联版：

```
追加约束（小红书小工具容器）：
- 输出 index.html、style.css、app.js 三个文件，不要单文件；JS 用 <script src="./app.js"> 引入，事件全部用 addEventListener 绑定。
- 禁止 type="module"、import/export、可选链 ?.、空值合并 ??、class 私有字段、顶层 await；语法限 ES2017。
- 禁止任何外链、CDN、内联 <script>、行内 onclick、iframe、Service Worker；所有资源放包内。
- 不使用 Flex gap / inset / aspect-ratio / clamp() / dvh / :has() 作为唯一实现（目标 Chrome 61），需要时用 margin 基线 + 能力检测。
- 单条 base64 解码后不超过 100KiB，超出改独立文件。
- <head> 加 <link rel="icon" href="data:,">，控制台不得有任何报错。
```

## 9. 验收：借它的评分体系

参考仓库 `benchmarks/` 用一套 10 分制跨模型对比，可以直接拿来给自己验收：

| 维度 | 分值 | 判据 |
| --- | --- | --- |
| 能运行 | 2 | 打开无白屏、控制台零报错 |
| 玩法完整 | 3 | 核心循环闭合，有开始与结算/重开 |
| 手感表现 | 3 | 输入延迟、动画缓动、反馈（顿帧/震屏/音效）到位 |
| 视觉 | 2 | 一眼能看出主题，不依赖文字解释 |

它还有一条规则值得照抄：**只允许一条「修复报错」的追加消息**，超过就算非一次通过。
用这条卡自己，能有效防止「越改越乱」。

## 10. 边界与许可

- `awesome-kimi-k3-game` 的 `effects/` 是 CC0，代码和提示词可自由取用，无需署名（署名更好）。
  它引用的第三方游戏**没有许可证**，只能链接、不能复制代码。
- `dsh-media-desk`、`gif-factory`、`piclex-web` 是 MIT：可复制，需保留版权与许可声明。
  `ohmygame` 是 Apache-2.0：可复制，需保留声明并标注修改。
- 六个仓库都**不进本仓库**。换机器重新取：

  ```sh
  cd ~/AI/workspace
  git clone --depth 50 https://github.com/gdfsdjj145/awesome-kimi-k3-game.git
  git clone https://github.com/EVEngine/EVEngine.github.io.git
  git clone https://github.com/woniuniuniu/dsh-media-desk.git
  git clone https://github.com/zhaoolee/piclex-web.git
  git clone --depth 1 https://github.com/WhiteTowerAI/ohmygame.git          # 142MB
  git clone --depth 1 https://github.com/WoYun520/gif-factory.git          # 445MB，绝大部分是示例 GIF
  ```

  本机 git 协议不通时，用 `https://ghfast.top/https://github.com/<user>/<repo>/archive/refs/heads/main.tar.gz`
  取包；大仓库可以只取文本，见 `~/AI/workspace` 上的 `fetch_text.py` 思路。

### 引用外部文本时

把别人的预设、词表、规则抄进本仓库时，在文件末尾写清来源仓库、文件路径、许可证，
别让人以为是我们自己定的。

## 参考

- 打包规范：[../.skill/SKILL.md](../../.skill/SKILL.md)
- 兼容性基线：[../.skill/references/js-compatibility.md](../../.skill/references/js-compatibility.md)、[../.skill/references/css-compatibility.md](../../.skill/references/css-compatibility.md)
- 体积门禁：[../.skill/references/performance-budget.md](../../.skill/references/performance-budget.md)
- 效果全表：[references/effect-index.md](references/effect-index.md)
- 宣传素材实例：[../../promo/yueli/](../../promo/yueli/)
