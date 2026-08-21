# Task 8 报告：发布素材（敦煌拾色）

## Status: DONE

## 产出清单

### 1. 截图 release/dunhuang/images/（6 张，全部达标）

| 文件 | 尺寸 | 大小 | 内容 |
| --- | --- | --- | --- |
| 01-home.png | 1260×1680 | 338KB | 首页：竖排「敦煌拾色」题字 + 藻井水印 + 拾色/矿物色谱按钮 |
| 02-extract.png | 1260×1680 | 131KB | 飞天提色中：toast「蛤粉｜贝壳研磨之白」可见，色盘 4 色（石青/朱砂/石绿 + 新提蛤粉飞入） |
| 03-codex.png | 1260×1680 | 79KB | 矿物色谱图鉴 18/18 全解锁（DHData.COLORS 逐个 DHSave.unlock 后点 #btn-codex-home） |
| 04-build.png | 1260×1680 | 194KB | 拼卡视图：18 色 chips（选中 5 色）+ 版式/底色/题字 pills + 立轴色谱实时预览 |
| 05-card-scroll.png | 900×1200 | 75KB | DHCard.paint 原图：立轴色谱，石青/花青/朱砂/胭脂/藤黄/铅白，宣纸底，题字「飞天遗色」，落款「莫高窟 · 盛唐」 |
| 06-card-zaojing.png | 900×1200 | 81KB | DHCard.paint 原图：藻井版式，石青/石绿/朱砂/雌黄/赭石/金，夜空底，题字「藻井五色」，落款「莫高窟 · 唐」 |

- 截图参数：630×840 viewport @ device_scale_factor=2（01-04）；05/06 为 canvas dataURL 转 `<img>`（450×600 CSS px @2x）后 locator.screenshot，恰为色卡原始 900×1200。
- 02 经程序化断言复核：toast `is-on` 且文案为「蛤粉｜贝壳研磨之白」、palette-dot=4；03 断言 codex-count=18/18；04 断言 is-on chips=5、预览 canvas 非空、活动视图为 view-build。
- 本模型不支持读图，视觉内容以 DOM/canvas 断言 + 尺寸/文件大小佐证。

### 2. release/dunhuang/发布文案.md
镜像 qiqiao 结构：标题备选 3 → 正文（hook/三步玩法/藏在颜色里的细节/关于敦煌/CTA）→ hashtag 行（#国风vibecoding … @科技薯）→ 发布提醒 checklist（挂载 dunhuang.zip）→ 配图表（封面建议 05-card-scroll）。知识事实全部取自 spec §7（铅白遇硫发黑/铅丹氧化褐变/丹青由来/1987 世界遗产/壁画约 4.5 万平方米），无杜撰；全文无七夕字样（grep 验证 0 处）。

### 3. zip + README + 图标提示词
- `release/dunhuang/dunhuang.zip` ← dist/dunhuang.zip，SHA1 一致（a2dcbf10…）。
- `release/README.md` 发布进度表新增行 10：敦煌拾色 | 自由创作（色彩美学） | ✅ 素材就绪，待发布 | `dunhuang/` | 首个「色彩美学」形式，色卡成品自带传播。
- `release/dunhuang/图标提示词.md`：主推（宣纸底藻井五色方井）+ 备选 1（黛青底）+ 备选 2（色卡+方井），中英双版，含 negative prompt 与出图建议（同款矿物色 hex、4-6 层方井、主体占比等）。

## Concerns

1. **【发现一个真实玩法 bug，未改动代码】飞天壁画蒙尘飘带 `ft-ribbon-a` 进视图即自动提取。**
   `dustProgress` 对 band 类 dusty 形状用 bbox 上 10×10 网格采样，细飘带面积远小于 bbox，初始 progress 即 85/100 = 0.85 = `DUST_DONE`，`checkDust`（每 0.15s）立刻 viaWipe 自动提取并弹「拂尘见色 · 朱砂」——用户无需擦尘，飞天的蒙尘体验实际失效（九色鹿 js-spot1 有 dustBBox、藻井 shilv 是方块，均不受影响）。T7 demo 冒烟也因此"绕过"了擦尘步骤而未暴露。
   建议修复（单独小任务，改后需重新打包+冒烟）：给 `ft-ribbon-a/b` 加紧凑 `dustBBox`（同 js-spot1 做法），或 `dustProgress` 仅统计形状区域内采样点，或将判定改 `>` 并留裕量。本任务为发布素材、且 zip 已打包冒烟通过，故未动源码，仅截图流程规避（等 ribbon 自动提取完再触发目标 toast）。
2. 05/06 为 900×1200（色卡原生尺寸，非 3:4 截图），配图表已注明；小红书 3:4 裁切时两侧略裁，主体（方井/色谱条）居中不受影响。
3. 02 截图中 ribbon-a 呈已提取态（因上述 bug），画面无异常但严格说非"擦尘前"状态。

## 验证结果

- [x] 6 图齐全，均 >20KB，尺寸正确（01-04: 1260×1680；05/06: 900×1200）
- [x] 发布文案.md 各节与 qiqiao 对齐；无七夕提及
- [x] release/dunhuang/dunhuang.zip 与 dist SHA1 一致
- [x] release/README.md 行 10 已加
- [x] 图标提示词.md 含 主推/备选1/2/negative/出图建议
- [x] 未做 git 提交
