---
name: minitool-reference-projects
description: >-
  做小红书小工具时找参考素材与提示词。当需要新玩法/新视觉风格的灵感、
  想复用别人的单文件 HTML demo、或要给 AI 写生成提示词时使用。
  指向本地两个参考仓库（awesome-kimi-k3-game 的 36 个单文件效果、
  EVEngine 的 AI 驱动引擎与提示词范式），并给出「demo → 小工具 zip」
  的强制改造清单。
metadata:
  version: "1.0.0"
  baseSpec: "minitool-zip-builder 1.7.0（../.skill/SKILL.md）"
---

# 参考项目借用手册

做新小工具时不要从零想。本地有两个参考仓库，包含**可直接看效果**的成品和**可直接复用的提示词**。
但它们的产出形态和小工具容器要求冲突，**照抄会打包失败**——本文后半部分是强制改造清单。

## 1. 什么时候读本文

- 要做一个新小工具，但不确定玩法/视觉怎么定 → 查 [`references/effect-index.md`](references/effect-index.md) 挑参考
- 要让 AI 生成新效果，缺一套靠谱的提示词 → 抄 `prompt.md` 的写法，再追加小工具约束
- 已有一份单文件 HTML demo，想改成小工具 → 直接跳到第 4 节「强制改造清单」
- 想评估自己做出来的东西好不好 → 用第 5 节的评分表

## 2. 两个参考仓库

都在 `/Users/wang/AI/workspace/` 下，**不属于本仓库，不要 copy 进来**（26MB，且与本项目许可证无关）。

### 2.1 `awesome-kimi-k3-game` — 36 个单文件游戏效果

| 项 | 值 |
| --- | --- |
| 来源 | `https://github.com/gdfsdjj145/awesome-kimi-k3-game`（CC0 1.0） |
| 本地 | `/Users/wang/AI/workspace/awesome-kimi-k3-game` |
| 体量 | 26MB（含 `.git`），`effects/` 代码本体仅 0.7MB |
| 结构 | 每个效果 = `index.html` + `prompt.md` + `meta.json` + `preview.png` |
| 浏览 | 打开仓库根的 `index.html`（画廊页，按分类排） |

**最有用的一点：这些效果不是「Kimi 生成的」，是 Grok Bot 写的对照实现。**
所以每个 `prompt.md` 都是一份「能被 AI 复现出这个效果」的提示词样本，价值在提示词，不在代码。

`meta.json` 的字段设计值得抄到我们的工具目录里：

```json
{
  "slug": "style-papercut", "name": "剪纸风格", "category": "美术风格",
  "engine": "Canvas 2D", "single_file": true, "mobile_ready": true,
  "rounds": 1, "author": "...", "created": "2026-10-25",
  "tags": ["参考实现", "美术风格", "剪纸"]
}
```

> ⚠️ `external_services` 字段**不可信**：`style-toon-3d` 和 `blender-scene-script` 标为「无」，
> 实际用 `importmap` 从 jsDelivr 加载 THREE。判断依赖一律看 HTML 里的 `<script>` / `importmap`。

### 2.2 `EVEngine` — AI 驱动的原生游戏引擎（只借方法论）

| 项 | 值 |
| --- | --- |
| 来源 | 官网 `https://evengine.github.io/`，仓库 `EVEngine/EVEngine.github.io` |
| 本地 | `/Users/wang/AI/workspace/EVEngine.github.io` |
| 内容 | 官网首页（中英）+ `skills/evengine/SKILL.md`（169 行）+ 安装脚本 |

**技术上用不上**：C++20 / Vulkan / Squirrel 脚本，产出是桌面原生程序，塞不进 H5 容器。不要试图移植。

**可以借的三点**：

1. **SKILL.md 的写法**——`name` + `description` 只写「何时使用」，正文按编号步骤走，每步都有可验证的判定（`eve -v` 验版本、`eve run` 验能跑）。本仓库 `.skill/SKILL.md` 是同一路数。
2. **AI 自检回路**——它提供 `eve mcp`，让 AI 能截帧、执行脚本片段、读报错，形成「改—看—再改」。小工具没有这种通道，等价做法是 `puppeteer` 截图 + 控制台报错收集，写进自己的验证步骤。
3. **「最小可运行」优先**——它的第一步是先跑内置 demo 确认 SDK 可用，再写业务。我们对应的是先跑通 `python3 .skill/scripts/audit_artifact.py <zip>` 再堆玩法。

## 3. 怎么挑参考

先看 [`references/effect-index.md`](references/effect-index.md)，里面是 36 个效果的全表（含引擎、体积、依赖类型、移植难度）。挑的时候按这个顺序：

1. **先按题材/玩法筛**——文化类小工具优先看「美术风格」栏（剪纸 / 水墨 / GameBoy / 三渲二）和「粒子与光效」栏
2. **再按依赖筛**——只要标了 `ES module` 或 `CDN` 的一律排除（25 个零依赖的够用）
3. **最后看体积**——零依赖那批全在 6–13KB，改造后基本不占包体预算

看效果的正确方式是打开 `effects/<slug>/index.html`（或先看 `preview.png`），**不要只读代码**：
这类效果的手感全在参数里，读代码看不出节奏。

## 4. demo → 小工具：强制改造清单

这是最容易翻车的地方。两个项目的产出是「单文件 HTML + 内联 script」，而小工具容器：

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

## 5. 验收：借它的评分体系

参考仓库 `benchmarks/` 用一套 10 分制跨模型对比，可以直接拿来给自己验收：

| 维度 | 分值 | 判据 |
| --- | --- | --- |
| 能运行 | 2 | 打开无白屏、控制台零报错 |
| 玩法完整 | 3 | 核心循环闭合，有开始与结算/重开 |
| 手感表现 | 3 | 输入延迟、动画缓动、反馈（顿帧/震屏/音效）到位 |
| 视觉 | 2 | 一眼能看出主题，不依赖文字解释 |

它还有一条规则值得照抄：**只允许一条「修复报错」的追加消息**，超过就算非一次通过。
用这条卡自己，能有效防止「越改越乱」。

## 6. 边界

- `effects/` 是 CC0，代码和提示词都可以自由取用，无需署名（署名更好）。
- `games/` 下引用的第三方游戏**没有许可证**，只能链接、不能复制代码。
- 两个仓库都**不进本仓库**。需要时按第 2 节的路径读，换机器就重新 clone：
  ```sh
  git clone --depth 50 https://github.com/gdfsdjj145/awesome-kimi-k3-game.git
  git clone https://github.com/EVEngine/EVEngine.github.io.git
  ```

## 参考

- 打包规范：[../.skill/SKILL.md](../../.skill/SKILL.md)
- 兼容性基线：[../.skill/references/js-compatibility.md](../../.skill/references/js-compatibility.md)、[../.skill/references/css-compatibility.md](../../.skill/references/css-compatibility.md)
- 体积门禁：[../.skill/references/performance-budget.md](../../.skill/references/performance-budget.md)
- 效果全表：[references/effect-index.md](references/effect-index.md)
