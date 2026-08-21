# 端能力 JS API（window.xhs.miniTool）

> 容器**自动注入** JS API SDK，小工具可调用 App 原生能力：发布笔记、保存图片到相册、把 base64 写成临时文件。**无需在包内引入任何 SDK 脚本**。
> 这是小工具区别于纯 H5 的关键能力：成品可以**直接发成笔记 / 存进相册**，不再只能靠用户手动截图。

## 目录

- §1 调用约定
- §2 API 一览
- §3 postNote 发布笔记
- §4 saveImageToPhotosAlbum 存相册
- §5 writeTempFile 临时文件
- §6 典型组合：Canvas 成品 → 发笔记 / 存相册
- §7 降级与自检

---

## 1. 调用约定

| 项 | 规则 |
| --- | --- |
| 唯一入口 | `window.xhs.miniTool.<apiName>(options)`；不要自行向原生 bridge `postMessage`，也不要调用未列出的 API |
| Promise / 回调 | 传入 `success` / `fail` / `complete` 任一回调时返回 `undefined`；都不传则返回 `Promise` |
| 成功 | resolve / `success` 收到结果对象，含 `errMsg: "<api>:ok"` 及业务字段 |
| 失败 | reject / `fail` 收到 `{ errMsg: "<api>:fail ...", errCode? }`；参数不合法时本地直接失败，不上行 |
| 参数校验 | SDK 上行前按 JSON Schema 校验，Native 侧再校验一次：**表中未声明的字段不要传** |
| 可用性判断 | 调用前用 `window.xhs?.miniTool` 判空，为未注入环境准备降级路径 |

```js
const miniTool = window.xhs?.miniTool;
if (!miniTool) return; // 当前环境未注入端能力（如普通浏览器预览）

// Promise 形态
try {
  await miniTool.saveImageToPhotosAlbum({ filePath });
} catch (err) {
  console.log(err.errMsg); // "saveImageToPhotosAlbum:fail ..."
}

// 回调形态（返回 undefined）
miniTool.saveImageToPhotosAlbum({
  filePath,
  success: (res) => console.log(res.errMsg),
  fail: (err) => console.log(err.errMsg),
  complete: () => {},
});
```

---

## 2. API 一览

| API | 能力 | 形态 |
| --- | --- | --- |
| `postNote` | 唤起笔记发布页，带入标题 / 正文 / 图片 / 视频 | 异步 |
| `saveImageToPhotosAlbum` | 保存图片到系统相册 | 异步 |
| `writeTempFile` | 把 base64 数据写成容器内临时文件，换取 `filePath` | 异步 |

> 媒体类字段（图片 / 视频 / 封面）只接受 `data:` base64 或本地文件路径（容器不联网，**网络地址不可用**）。体积较大的 base64 建议先 `writeTempFile` 换成 `filePath` 再传。

---

## 3. postNote — 发布笔记

唤起 App 笔记发布页并带入内容，用户可继续编辑或取消。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 否 | 标题，最长 20 字 |
| `content` | string | 否 | 正文，最长 1000 字 |
| `tags` | string | 否 | 话题 / 标签 |
| `mediaInfo` | object | **是** | 媒体信息，下列两种资源**至少传一种，可同时传** |
| `mediaInfo.image_resources` | `{ url }[]` | 否 | 图片，1–18 张；`url` 为 base64 或本地路径 |
| `mediaInfo.video_resources` | `{ video_url, cover_url? }` | 否 | 单个视频，`cover_url` 可选封面 |

```js
// 图文笔记
await window.xhs.miniTool.postNote({
  title: "我的作品",
  content: "用小工具生成的",
  mediaInfo: {
    image_resources: [{ url: "data:image/png;base64,iVBORw0KGgo..." }],
  },
});

// 视频笔记
await window.xhs.miniTool.postNote({
  mediaInfo: {
    video_resources: { video_url: videoPath, cover_url: coverPath },
  },
});
```

> ⚠️ 成功回调只代表**发布页已被唤起并由用户点击发布**，不代表笔记最终审核通过。勿依赖它做强一致的业务状态。

---

## 4. saveImageToPhotosAlbum — 保存图片到相册

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `filePath` | string | **是** | 本地图片：`data:` base64 或 `writeTempFile` 返回的路径；**不支持** `http(s)://` 网络地址 |

```js
// Canvas 导出直接保存
const dataUrl = canvas.toDataURL("image/png");
await window.xhs.miniTool.saveImageToPhotosAlbum({ filePath: dataUrl });
```

- 需由**用户主动操作**（点击等）触发；首次调用可能弹出系统相册权限弹窗，用户拒绝授权走失败回调。
- 大图建议先 `writeTempFile` 落成文件再保存，避免超长 base64 上行。

---

## 5. writeTempFile — base64 转临时文件

把内存里的 base64（Canvas 导出、选图预览结果等）写成容器内临时文件，换取可传给其他 JS API 的 `filePath`。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `data` | string | **是** | base64 数据（支持带 `data:` 前缀的 data URI） |
| `filePath`（返回） | string | — | 写入后的临时文件路径 |

```js
const { filePath } = await window.xhs.miniTool.writeTempFile({
  data: canvas.toDataURL("image/png"),
});
await window.xhs.miniTool.saveImageToPhotosAlbum({ filePath });
// 或带入发布页
await window.xhs.miniTool.postNote({
  mediaInfo: { image_resources: [{ url: filePath }] },
});
```

- 返回的是**临时文件**，不保证长期有效，即用即弃，不要持久化保存该路径。
- 仅支持常见图片 / 视频类型（png、jpeg、webp、gif、mp4），其他类型会失败。

---

## 6. 典型组合：Canvas 成品 → 发笔记 / 存相册

小工具的成品时刻（如剪纸展开、文物修复完成）导出 Canvas，给用户两个出口：**存相册** 与 **发笔记**。

```js
function exportCanvas(canvas) {
  return canvas.toDataURL("image/png");
}

async function saveToAlbum(canvas) {
  const miniTool = window.xhs?.miniTool;
  if (!miniTool) { fallbackHint(); return; }        // 普通浏览器降级：提示长按截图
  try {
    const { filePath } = await miniTool.writeTempFile({ data: exportCanvas(canvas) });
    await miniTool.saveImageToPhotosAlbum({ filePath });
    toast("已保存到相册");
  } catch (err) { fallbackHint(); }
}

async function publishNote(canvas, { title, content, tags }) {
  const miniTool = window.xhs?.miniTool;
  if (!miniTool) { fallbackHint(); return; }
  try {
    const { filePath } = await miniTool.writeTempFile({ data: exportCanvas(canvas) });
    await miniTool.postNote({ title, content, tags, mediaInfo: { image_resources: [{ url: filePath }] } });
  } catch (err) { fallbackHint(); }
}
```

要点：
- **大图先 `writeTempFile` 再传**，不要直接传超长 base64。
- **降级路径**：`window.xhs?.miniTool` 为空（普通浏览器预览）时，提示用户长按 / 截图保存，不要报错。
- 两个出口按钮都要由**用户主动点击**触发（相册权限弹窗要求）。

---

## 7. 降级与自检

- [ ] 所有 `window.xhs.miniTool` 调用前先 `window.xhs?.miniTool` 判空，有降级路径
- [ ] 媒体字段只传 `data:` base64 或 `writeTempFile` 的 `filePath`，无 `http(s)://`
- [ ] 大图先 `writeTempFile` 再传 `saveImageToPhotosAlbum` / `postNote`
- [ ] `saveImageToPhotosAlbum` / `postNote` 由用户主动点击触发
- [ ] 未传 API 表中未声明的字段
- [ ] `writeTempFile` 返回的 `filePath` 即用即弃，未持久化
- [ ] 未自行向原生 bridge `postMessage`，未调用未列出的 API
