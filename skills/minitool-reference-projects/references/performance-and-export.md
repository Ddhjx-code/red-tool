# 性能门禁与数据导出

两件事：**发布前怎么证明不卡**，**用户数据怎么导出才不会把用户的数据弄丢**。
两者都来自 `piclex-web`——一个不用登录、数据全在本地的 Web 应用，和小工具的形态最接近。

## 1. 性能门槛

`docs/web-performance-release-gate.md` 的判定表：

| 指标 | 每轮门槛 |
| --- | --- |
| Chrome trace 主线程单个任务 | < 33ms，超阈值次数为 0 |
| requestAnimationFrame 间隔 | < 50ms，超阈值次数为 0 |
| Long Tasks / Long Animation Frames | 0 |
| Event Timing（输入到绘制） | < 100ms，超阈值次数为 0 |

采样要求：

- 每轮至少 **8 秒真实操作 + 120 个动画帧**，要有真实页面绘制和主线程任务
- 桌面 1440×1000 与触屏 **390×844** 各跑一遍（这个尺寸和小工具的机型基准一致）
- 用全新的浏览器上下文、隔离存储
- 禁止 reduced motion、后台页面、空场景、只打日志没有操作的样本

两条态度：

> **功能测试通过不能替代性能测试。**
> **失败证据必须保留，不重试挑一版全绿的。**

后一条尤其重要：跑三次挑最好的一次，等于没有门禁。

## 2. 我们该用多少

它的 24 轮 × 8 分片 CI 是发布级工程，小工具没这个量级。取它的指标当人工自查线：

- 小工具通常没有重动画，真正会超的是**首屏渲染**和**列表重建**（比如日历重绘 42 个格子）
- 自查方法：DevTools Performance 录 8 秒真实操作，看最长那条主线程任务
- 超过 33ms 的任务在哪：一般是「一次性写 DOM」和「同步读存储」

月历目前**一次性能都没测过**，这是已知的空档。

## 3. 导出格式

`docs/photo-archive-format.md` 的设计，逐条看：

| 做法 | 理由 |
| --- | --- |
| 包外放一个同名 `.version.json`：`formatIdentifier` / `formatVersion` / `exporterVersion` / `appVersion` / 整包 `zipSHA256` / 条数 | 不打开包就知道是什么、能不能导 |
| 包内 `manifest.json` 也写格式号 | **版本文件丢了不影响恢复** |
| 格式号与 App 版本分开维护 | 应用升级不必动格式 |
| 时间统一存 Unix 毫秒，保留小数 | 独立工具能精确往返 |
| 可空字段不写就是 `null`，不留空字符串 | 少一类歧义 |

最要紧的一条在导入侧：

> 逐字段校验，**任何一处不过就 `throw`，现有数据一个字节都不动。**

它的 `packages/backup/src/progress.mjs` 就是这个写法：`fail()` 直接抛，
所有校验在写之前做完，不会出现「导了一半」的状态。

对我们的意思（月历待做的导出/导入）：

1. 导出：`{format, formatVersion, exportedAt, episodes, settings}` + 校验和
2. 导入：先全量校验（日期格式、区间合法性、条数上限），全部通过才替换
3. 任何一步失败 → 提示「格式不对，你的记录没有改动」，而不是「导入失败」
4. 不用 ZIP，纯 JSON 就够——普通用户要能直接打开看

## 4. 交互上的一个细节

它的存储层写失败时，提示是：

> 「本地空间不足，卡组未保存。请保留原文件。」

不是「操作失败」。**说清后果**：数据有没有保存、原来的还在不在。
小工具的存储失败提示也照这个写。

## 来源

- 仓库：`https://github.com/zhaoolee/piclex-web`（MIT，Copyright © 2026 zhaoolee）
- 文件：`docs/web-performance-release-gate.md`、`docs/photo-archive-format.md`、
  `packages/backup/src/progress.mjs`、`apps/public/src/storage.ts`
- 本文为摘要改写；第 3 节末尾「对我们的意思」是本仓库的落地建议，不是原文。
