# 在线文档增量（相对 1.7.0 包内快照）

> **性质：本地增补，非官方文件。**
> 官方 skill 包 `minitool-zip-builder-1.7.0` 随包下发的 API 快照为 **2026-09-23**；官方在线文档
> <https://miniapp-sandbox.xiaohongshu.com/minitool/doc> 已更新至 **2026-11-06**。
> 按官方 SKILL.md 的规则「远程文档成功获取后始终以远程内容为准」，本文记录快照之后的变化**和指出的冲突**，
> 供 1.7.0 正式跟进前使用。抓取日期：2026-11-10。
>
> **冲突时以在线文档为准**；官方包升级到覆盖下列内容后，可整篇删除本文件。

## 目录

- §1 必须注意的两处冲突
- §2 快照缺失的新增端能力
- §3 静态资源优化策略（9.53.3）
- §4 能力限制数值
- §5 与本仓库工具的关联

---

## 1. 必须注意的两处冲突

### 1.1 postNote 实况照片字段名

| 来源 | 字段名 |
| --- | --- |
| `js-api.md`（1.7.0 快照） | `mediaInfo.live_photo_sources` |
| 在线文档 §3.3（2026-11-06） | `mediaInfo.live_photo_resources` |

在线文档的字段表与示例代码**一致写作 `live_photo_resources`**，并以 `url` 为封面、`video_url` 为视频。
传错字段名会因「表中未声明的字段不要传」被本地校验直接拒绝或静默失效。**按 `live_photo_resources` 写。**

```js
// 实况笔记（客户端 9.43+）
await window.xhs.miniTool.postNote({
  pageType: "slides_edit",
  mediaInfo: {
    live_photo_resources: [{ url: coverPath, video_url: videoPath }],
  },
});
```

### 1.2 Worker 不再是「一律移除」

`device-capabilities.md`（1.7.0 快照）在「后台运行」与能力扫描清单里把 Worker 列为**必须移除**，`new Worker(` 属于命中即删的模式。
在线文档（2026-11-06）已开放 **classic Dedicated Worker**：

| 项 | 规则 |
| --- | --- |
| 最低客户端 | **9.53**（判断值 `9530`） |
| 支持范围 | 仅 `new Worker()` + **上传包内的 classic `.js`** 入口 |
| 仍禁止 | SharedWorker、Service Worker、**module Worker**、外部 URL、`blob:` / `data:` 脚本、运行时生成脚本、子 Worker |
| 实例配额 | 每页同时最多 **1 个**，超出抛 `QuotaExceededError` |
| 回收 | 页面连续隐藏 **30 秒**后回收；提前返回取消计时；到期仍隐藏再创建抛 `SecurityError` |
| 释放 | `terminate()` 或平台回收后释放名额；`error` 与 `self.close()` **之后仍需页面调用 `terminate()`** |
| 终止通知 | `worker.onTerminate(cb)` / `offTerminate(cb)`，参数 `"主动"` / `"system"`，同一实例只通知一次，可能延后或不保证收到 |
| CSP | 与容器一致；依赖须预打包进入口脚本，禁止追加脚本 |

落地要求：Worker 只能作为**增强路径**，必须先做能力检测并保留主线程兜底；页面隐藏超过 30 秒回来要**重建实例并恢复任务数据**。
低版本（<9.53）用户仍走主线程逻辑。

---

## 2. 快照缺失的新增端能力

`js-api.md` 只覆盖到文件系统（9.49）。在线文档另有以下 API（`device-capabilities.md` 的「移除」结论对其中部分已不成立）：

| API | 能力 | 最低客户端 | 备注 |
| --- | --- | --- | --- |
| `saveImageToPhotosAlbum` | 存相册 | **9.42+**（`9420`） | 快照标「—」，实际有版本门槛 |
| `getWindowInfo` | 窗口尺寸、安全区、顶部按钮位置 | **9.49+**（`9490`） | 布局避让原生按钮时优先用它，不要猜安全区 |
| `getLocation` | 单次定位 | **9.49+**（`9490`） | 替代被禁的 `navigator.geolocation`；`type` 传 `wgs84` / `gcj02`，地图场景显式传 `gcj02` |
| `vibrateShort` / `vibrateLong` | 触感反馈 | **9.50+**（`9500`） | `vibrateShort({ type })` 必填强度；成功仅表示已触发 |
| `startGyroscope` / `stopGyroscope` / `onGyroscopeChange` / `offGyroscopeChange` | 陀螺仪角速度 | **9.50+**（`9500`） | 替代被禁的 `DeviceOrientationEvent`；**先注册监听再开始采集**，结束时停采集并解绑 |
| `followAuthor` / `getFollowStatus` | 关注作者 / 查关注状态 | **9.51+**（`9510`） | 同一账号对同一工具每天最多展示 **10 次**确认框 |
| `share` | 拉起分享面板 | **9.53+**（`9530`） | `type: "card" \| "image"`；`image` 需 `image_resource`；**仅全屏容器可用**；每天每用户每工具最多 10 次 |
| `addCloudStorage` / `updateCloudStorage` / `queryCloudStorage` / `removeCloudStorage` | 云存储（跨设备存档） | **9.51+**（`9510`） | **内测**；单批最多 100 条，单条 JSON 序列化后 ≤ 64KB |
| `submitScore` / `getRankList` / `getMyRank` | 排行榜 | **9.51+**（`9510`） | **内测** |
| `window.xhs.AI.createModel(...).generateText(...)` | 平台对话模型 | 内测加白 | 非流式；`messages` ≤ 40 条且 ≤ 12000 字符，`max_output_tokens` ≤ 2048，`temperature` 0–1.5；未加白返回 `AI_NOT_ALLOWED`；内测期每用户每天 100 次 |

调用约定（同步 / 异步形态）见在线文档 §3.1；版本判断仍用 `miniToolEnv.buildVersion` 除以 1000 取整。

> 注意：`onGyroscopeChange` / `offGyroscopeChange` 是**同步注册**、返回 `undefined`、**不接受** `success` / `fail` / `complete`；
> 传入非法回调会同步抛 `TypeError`。其余 API 遵循 §3.1 的 Promise / 回调约定。

---

## 3. 静态资源优化策略（9.53.3）

在线文档 §2.7 新增：把**体积较大、非首屏**的图片、字体等作为独立文件放进包根 `assets/` 目录，按本地路径引用并完整打包，
平台即可对这批资源做**主包体积优化**（首屏只随主包下发必要内容）。

要点：

- **不是把所有资源都塞进 `assets/`。** 首屏强依赖、体积小的资源应放在 `assets/` 之外随主包下发，避免首屏取回延迟。
- **入口 HTML / JS / CSS 必须留在 `assets/` 之外。**
- 参与优化的资源**必须是独立文件，不能 base64 内联**；内联资源不参与优化。
- 引用仍用本地路径（`./assets/detail.webp`、`/assets/detail.webp`，CSS 按样式表位置写相对路径）；动态拼路径可以，但要确保文件真的进了包。
- 上传 zip 必须包含全部资源，**不能删掉 `assets/`**。
- 仅对**新发布**生效，存量作品需重新发布。
- ⚠️ **参与优化的资源不保证全部离线可用**：必须为加载失败准备占位提示或重试入口，不能假设用户打开过一次就永远能离线加载。

这条与 `performance-budget.md` 的 Base64 门禁同向：大图本来就要求独立文件，现在独立文件放进 `assets/` 还能顺带减小主包。

---

## 4. 能力限制数值

| 项 | 限制 |
| --- | --- |
| 客户端基线 | Android 8.1 / Chrome / WebView **61**；JS 目标 **ES2017**；iOS 最低 **18.4** |
| 本地缓存 | 单 key ≤ 1MB；单工具总缓存 ≤ 10MB；`data` 仅支持 JSON 字符串；`encrypt` 默认 `false` |
| 云存储 | 单批 ≤ 100 条；单条 content JSON 序列化后 ≤ 64KB |
| postNote | 标题 ≤ 20 字；正文 ≤ 1000 字；图片 1–18 张 |
| AI | `messages` ≤ 40 条 / ≤ 12000 字符；`max_output_tokens` ≤ 2048；`temperature` 0–1.5 |
| 关注引导 | 同账号同工具每天最多 10 次确认框 |
| 分享 | 每天每用户每工具最多 10 次 |
| Worker | 每页 1 个；隐藏 30 秒回收 |

> 云存储 / 排行榜的接口限频（默认每工具每接口 150 QPS）见在线文档，属内测期参数，可能调整。

---

## 5. 与本仓库工具的关联

本仓库 `tools/` 下的 8 个工具均按 **1.3.0** 规范产出，升级到 1.7.0 + 本文基线后需关注：

1. **Chrome 61 / ES2017**：1.3.0 的示例代码本身用了 `window.xhs?.miniTool`（可选链属 ES2020），
   沿此写法在 Chrome 61 上会**解析阶段直接失败、整脚本不执行**。
   实测本仓库 8 个工具均已改用 `window.xhs && window.xhs.miniTool`，**未踩此坑**，后续新增代码不要退回可选链。
2. **classic script**：不能用 `type="module"`、`import` / `export`、top-level await。实测 8 个工具均未使用。
3. **Flex `gap`**：Chrome 61 不支持 Flex gap，需 margin 基线 + 行为检测增强。**8 个工具全部中招**，是本次最普遍的整改项。
4. **`aspect-ratio` / `inset` / `clamp()` / `:has()` / `dvh`** 等现代 CSS 需基线回退。`inset` 在 8 个工具中均有使用。
5. **Base64**：单条解码后 >100KiB 改独立文件，>1MiB 禁止内联。`wenwu` 的 `models-data.js`（2.80MiB，7 段大 Base64）超标。

逐工具的检查结论见 `docs/spec-1.7.0-compliance.md`。
