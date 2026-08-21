# Task 5 报告：成品卡 + 分享出口

**状态：完成，21/21 无头验证全部通过。**

## 改动文件

### 1. 新增 `tools/dunhuang/assets/share.js` — window.DHShare
- 结构镜像 `tools/qiqiao/assets/share.js`：IIFE、var、function(){}，无注释。
- `DHShare.lastStats = null`，由 main.js 在成卡时写入 `{dataUrl, title, content, tags, colorCount}`。
- `miniTool()` 取 `window.xhs && window.xhs.miniTool`；`fallback()` alert「当前环境暂不支持直接保存，请截图保存哦」。
- `withFile(fn)`：判空（无 mt / 无 lastStats / 无 dataUrl）→ fallback；否则 `mt.writeTempFile({data: dataUrl, success -> fn(mt, res.filePath), fail -> fallback})`。
- `saveAlbum()`：writeTempFile 成功后 `mt.saveImageToPhotosAlbum({filePath, success -> alert("已保存到相册"), fail -> fallback})`。
- `postNote()`：`mt.postNote({title, content, tags, mediaInfo:{image_resources:[{url: filePath}]}, fail -> fallback})`，字段优先取 lastStats，缺省回退内置常量。
- `makeTitle(n)`：「我在敦煌拾了{N}色」，超 20 字截断。
- 文案常量：content「拾取千年矿物色，拼一张敦煌色卡。」；tags「#国风vibecoding #敦煌 #敦煌色卡 #非遗 #国风 #中式美学」。

### 2. `tools/dunhuang/index.html`
- 在 card.js 之后、main.js 之前加入 `<script src="./assets/share.js">`。

### 3. `tools/dunhuang/assets/main.js`
- **#btn-make-card**（细化 Task 4 占位）：buildOpts → `DHCard.paint(opts)` 一次生成 dataURL 复用（渲染 + lastStats.dataUrl 同一份）；`window.DHLastBuild = opts`；`DHSave.load()` → `cards+1`、`lastBuild=opts` → `DHSave.save()`；写入 `DHShare.lastStats`（title 经 `DHShare.makeTitle(opts.colors.length)`，colorCount=opts.colors.length）；`setView("view-result")` + `paintInto(resultCardEl, dataUrl)`；入场动效：先移除 `.stamp-in`、强制 reflow（`void offsetWidth`）再加回，保证每次进入都重触发。
- **#btn-save-album / #btn-post-note**：分别调 `DHShare.saveAlbum()` / `DHShare.postNote()`。
- **#btn-again**：不再走 `showBuild()`（其 buildChips 会把选择重置为前 5 色），改为 `setView("view-build") + syncChips() + renderPreview()`，完整保留 buildSel 供用户微调。
- **#btn-home-result**：保持 Task 4 逻辑（home + refreshHomeProgress，进度行「已集 {n}/18 色 · 成卡 {cards} 张」）。
- 未加额外 caption：结果视图已有卡面自含色数/题头，避免杂乱（任务标注 optional）。

### 4. `tools/dunhuang/assets/style.css`
- 新增 `@keyframes dh-card-in`：0% opacity 0 / scale(1.04) / rotate(-1.2deg) → 60% scale(0.995)/rotate(0.4deg) → 100% 归位，`#result-card.stamp-in` 应用 0.45s ease-out——「卡落定」入场（缩放+淡入+微旋回稳）。
- `#result-card` 的 3:4、居中、阴影沿用 Task 4 既有样式，未重复添加。

## 验证（`.sdd/dh-task5-verify.py`，python3 + playwright，390×844，file://…?test=1，首尾 localStorage.clear()）

预置：`DHSave.unlock` 解锁 5 色（qingshi/shilv/zhusha/cihuang/zheshi）。

| # | 检查 | 结果 |
|---|------|------|
| 1 | 无 pageerror（忽略 audio 404） | PASS |
| 2a–2e | build→make-card→result 激活；canvas 非空（1,080,000 非透明像素）、900×1200（3:4）、显示框 320×426.7 比例 0.75 | PASS |
| 2f–2g | `DHShare.lastStats.dataUrl` 为 data:image/png；title=「我在敦煌拾了5色」、content/tags 精确匹配、colorCount=5 | PASS |
| 2h | `DHSave.load().cards===1`、lastBuild.colors.length===5 持久化 | PASS |
| 3a–3b | 无 window.xhs：点存相册/发笔记均触发降级 alert（文案精确匹配） | PASS |
| 4a–4b | mock xhs：writeTempFile 收到 `data:image/png;base64,` 前缀 → saveImageToPhotosAlbum 收到返回的 filePath；成功 alert「已保存到相册」 | PASS |
| 4c | postNote：title「我在敦煌拾了5色」（8 字 ≤20）、content/tags 齐全、`mediaInfo.image_resources[0].url === filePath` | PASS |
| 5a–5b | #btn-again 回 build 视图，buildSel.colors 前后一致、5 个 chip 选中态不变 | PASS |
| 5c | 二次成卡 cards===2（计数累加） | PASS |
| 5d | #btn-home-result：home 激活，进度行「已集 5/18 色 · 成卡 2 张」 | PASS |
| 6 | 入场类 `.stamp-in`：make-card 后立即出现在 #result-card；二次进入重新触发 | PASS |
| 7 | 截图 `.sdd/shots/dh5-result.png` 已产出 | PASS |

**21/21 通过。**

## 备注 / 关注点
- 入场动效作用于 `#result-card` 本身（任务允许 seal overlay 或卡片动画二选一）；印章在 canvas 内绘制，无独立 DOM 层，故选卡片方案。
- `paintInto` 经 Image onload 异步上屏，点击后约 1 帧内 canvas 可能尚未绘制；验证中已等待 600ms，真机无影响。
- `DHShare.postNote` 对 title/content/tags 做了 lastStats 缺省回退，防御 lastStats 被外部清空时仍可出正确文案。
- 未使用 Math.random()；card.js 的颗粒纹理走既有 `DHRng(11)` 种子随机，成卡结果确定可复现。
- 无 git 操作。
