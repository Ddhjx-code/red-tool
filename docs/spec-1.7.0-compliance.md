# 小工具规范升级与合规报告（1.3.0 → 1.7.0）

> 生成日期：2026-11-10
> 基线：官方 skill 包 `minitool-zip-builder-1.7.0`（随包 API 快照 2026-09-23）
> 补充：官方在线文档 <https://miniapp-sandbox.xiaohongshu.com/minitool/doc>（最后更新 **2026-11-06**，比包内快照新）

## 一、本次更新内容

| 项 | 变更 |
| --- | --- |
| 规范版本 | `1.3.0` → `1.7.0`（`.skill/` 与官方包逐字节一致，另有 4 处标注式增补） |
| 新增 reference | `js-compatibility.md`（Chrome 61 / ES2017 基线）、`css-compatibility.md`（基线层 + 能力检测增强层）、`performance-budget.md`（体积门禁、WebGL 预算、降级） |
| 重命名 | `xhs-jsapi.md` → `js-api.md`（内容大幅扩充：Storage 9.46、文件系统 9.49、`interactionOpenApi` 9.49、`pageType`、实况照片） |
| 新增脚本 | `scripts/audit_artifact.mjs`（Node 18+）、`scripts/audit_artifact.py`（Python 3，可读 zip 内部结构）；均零第三方依赖 |
| 工作流变化 | 强制先取在线文档；新增 JS / CSS 兼容性与性能三道门禁；交付须附「创服平台模拟器 + Android 真机 + iOS 真机」验证提醒；明确「浏览器直运行不可信」 |
| 本地增补 | `references/online-doc-delta.md`，记录在线文档（2026-11-06）相对包内快照的增量与冲突 |

### 必须知道的三处规范变化

1. **classic script**：禁止 `type="module"`、`import` / `export`、top-level await。离线 zip 无目录服务，module 相对 import 解析不可靠，典型症状是「页面渲染出来但 JS 完全不执行」。
2. **Chrome 61 / ES2017 硬基线**：`?.`、`??`、对象展开、逻辑赋值属 ES2018+，**解析期失败、无法用运行时 `if` 兜底**。CSS 侧 Flex `gap`、`aspect-ratio`、`inset`、`clamp()`、`:has()`、`dvh` 等均不能作为唯一实现。
3. **体积门禁**：zip ≤ 10MiB（建议 ≤ 2MiB）；单个 `.html/.css/.js/.json` > 2MiB 触发风险提示；**单条 Base64 解码后 > 100KiB 应改独立文件，> 1MiB 禁止内联**。

### 与官方包快照的冲突（以在线文档为准）

| 项 | 包内快照（2026-09-23） | 在线文档（2026-11-06） |
| --- | --- | --- |
| 实况照片字段 | `mediaInfo.live_photo_sources` | **`mediaInfo.live_photo_resources`** |
| Worker | 一律移除 | **classic Dedicated Worker 9.53+ 可用**（每页 1 个，隐藏 30 秒回收） |
| `assets/` | 无 | **静态资源优化 9.53.3**：大体积非首屏资源放包根 `assets/`，主包体积优化 |

新增端能力（快照未收录）：`getWindowInfo` / `getLocation`（9.49）、`vibrateShort` / `vibrateLong` / 陀螺仪（9.50）、`followAuthor` / `getFollowStatus` / 云存储 / 排行榜（9.51）、`share`（9.53）、`window.xhs.AI` 文本生成（内测加白）。

## 二、8 个工具的扫描结果

扫描命令：

```bash
python3 tests/spec_compliance_scan.py       # 汇总
python3 tests/spec_compliance_scan.py --md  # 含计数明细
python3 .skill/scripts/audit_artifact.py dist/xxx.zip   # 官方体积门禁
```

### 通过项（全绿）

| 检查项 | 结果 |
| --- | --- |
| 可选链 `?.` / 空值合并 `??` / 逻辑赋值 / 对象展开 | ✅ 8 个工具业务代码均未使用 |
| `type="module"` / `import` / `export` / top-level await | ✅ 未使用，均为 classic script |
| 内联 `<script>` / 行内事件 `onclick=` | ✅ 未使用 |
| 外部 `http(s)` 资源引用 | ✅ 无，资源全部包内 |
| 多 HTML 入口 | ✅ 均为单 `index.html` |
| 端能力判空写法 | ✅ 全部为 `window.xhs && window.xhs.miniTool`，Chrome 61 可解析 |
| zip 体积（10MiB 硬上限） | ✅ 全部通过 |

### 需整改项

| 工具 | 文本体积 | Flex gap | Grid gap | `inset` | `aspect-ratio` | `backdrop-filter` | 体积风险 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dunhuang | 78K | **17** | 1 | 5 | 2 | 2 | — |
| hanfu | 19K | **5** | — | 1 | 2 | — | zip 4.50MiB（超建议值） |
| jianzhi | 49K | **9** | 3 | 4 | — | — | — |
| keju | 106K | 1（疑似，见备注） | — | 2 | — | 1 | — |
| longzhou | 81K | **9** | 2 | 5 | — | 1 | — |
| qiqiao | 69K | **5** | 1 | 4 | — | — | — |
| wenwu | 3599K | 6 | — | 3 | 1 | — | **`models-data.js` 2.80MiB + 7 段大 Base64（最大 526KiB）** |
| zhujian | 650K | 6 | 1 | 4 | — | — | — |

> 备注：`keju` 的 `.ov-share` 规则为 `display:none` + `gap:12px`，由 `.ov-share.is-on { display:flex }` 激活，实为 Flex 容器，需一并整改。

## 三、整改清单（按优先级）

### P0 — 会导致功能或产物受限

1. **`wenwu/assets/models-data.js`（2.80MiB）**
   - 违反「静态资源不得转成长 Base64 塞进源码」：7 段单条 Base64 解码后 153–526KiB，均超 100KiB，其中 3 段逼近或超过建议上限。
   - 单文件 > 2MiB 直接触发 `performance-budget.md` 风险提示，并增加读取 / 解析 / 编译峰值内存。
   - 整改方向：拆成多个 ≤ 512KB 的分片 `.js`（如 `assets/models/zun_frag_0.js`），首屏只加载必需分片，其余按需用同源 `<script src>` 动态注入；或改用客户端 9.49+ 的 `readFile` 读取包内二进制分片。拆分后还可让这些资源进入 `assets/` 参与 9.53.3 主包体积优化。

### P1 — Chrome 61 上布局明显错乱

2. **Flex `gap` 全面整改（8 个工具，共 58 处 flex gap）**
   - Chrome 61 直接忽略 Flex `gap`，间距塌成 0，按钮 / 卡片会贴在一起。
   - 按 `css-compatibility.md` §4：**子项 `margin` 作基线**，用「创建真实 Flex 容器测量 `scrollHeight`」的行为检测加 `.supports-flex-gap` class 启用 `gap` 并清零 margin。不要用 `@supports (gap: 1px)` 或 `CSS.supports('gap','1px')` 作为 Flex gap 判定。
3. **Grid `gap` 改 `grid-gap`（jianzhi 3 / longzhou 2 / qiqiao 1 / dunhuang 1 / zhujian 1）** — Chrome 61 不认 `gap` 简写的 grid 语义，`grid-gap` 可直接用。
4. **`inset` 改物理属性（8 个工具，共 28 处）** — `inset: 0` 改 `top:0; right:0; bottom:0; left:0`。zhujian 的 `#stage-canvas` 因同时写了 `width/height:100%` 影响有限，但其余绝对定位元素会偏移失效。
5. **`aspect-ratio` 提供比例盒回退（dunhuang 2 / hanfu 2 / wenwu 1）** — 用百分比 `padding-top` 比例盒 + 内容绝对定位，或固定尺寸。

### P2 — 视觉增强，可延后

6. **`backdrop-filter`（dunhuang 2 / keju 1 / longzhou 1）** — 先给实色 / 半透明背景基线，毛玻璃仅 `@supports` 增强，并同时写 `-webkit-backdrop-filter`。
7. **vendor 残留清理** — `wenwu` 与 `zhujian` 的 `three.min.js` 内含 `fetch` / `XMLHttpRequest` 引用。`wenwu` 数据注释已声明「不经 GLTFLoader」，但 `wenwu/assets/vendor/GLTFLoader.js`（94K）仍随包发布，属于无调用路径的死代码，建议删除。
8. **`hanfu` zip 4.50MiB** 超 2MiB 建议值，来源是 80+ 张 webp 服装图。可考虑把非首屏图放入 `assets/`（9.53.3）并在真机确认首屏取回表现，或进一步压缩尺寸。

## 四、交付前验证要求

按 1.7.0 工作流第 11 步，以下三项为**必须由用户在真机完成**的验证，本次未执行，不阻塞 zip 交付：

- [ ] 创服平台模拟器跑通完整功能
- [ ] Android 真机扫码验证（Chrome 61 兼容性只能在此暴露）
- [ ] iOS 真机扫码验证

**未实测声明**：本次仅做静态扫描与体积审计，未在任何真机或模拟器上运行；`gap` / `inset` 等整改后的实际布局效果、WebGL 帧率、首屏耗时均**未实测**。浏览器本地打开通过不代表真机通过。
