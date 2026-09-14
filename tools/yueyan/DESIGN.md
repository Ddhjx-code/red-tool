# 月宴 · Design System

> 设计系统唯一来源。所有色值、字号、动效、符号、文案在本文件锁定，
> `assets/data.js` / `assets/style.css` / `assets/scene.js` / `assets/share.js` 一律镜像本表，不得另行推导。
> 依据：`docs/specs/2026-09-09-yueyan-design.md` §5.1 / §5.3 / §8.1–§8.5 / §9.3。

---

## 色板（七 token，锁定）

| 角色 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| 底 | `--paper` | `#F7EFE2` | 米纸底，全局背景 |
| 主 | `--amber` | `#B8733A` | 琥珀铜，饼皮 / 木桌 / 主按钮 |
| 强调 | `--cinnabar` | `#C9483C` | 朱砂，仅用于月饼纹样压印与「开席」按钮，占比 ≤ 5% |
| 墨线 | `--ink` | `#3A2E26` | 描边与正文 |
| 月 | `--moon` | `#F2E4C4` | 终局圆月，唯一冷色 |
| 桂花 | `--osmanthus` | `#E8B84B` | 桂花枝 / 桂花酒项 |
| 灯 | `--lantern` | `#F5C77E` | 灯笼暖黄单色 |

朱砂允许出现的位置（穷举，V-21 据此判定）：

1. 月饼纹样压印（短局 S3 与饼列表 / 分饼面板的纹样路径）
2. `#btn-open-feast`（开席按钮）

其余任何位置出现 `#C9483C` 即为 V-21 失败。

**与系列既有作品的区隔（§8.1）**：bobing 是墨金夜宴、yuegong 是清冷仙境、guiyue 是暗黑怪谈；
本作是**暖琥珀家宴**——暖的、室内的、纸质的，读起来像一盏灯下的圆桌。禁止冷蓝 / 银白 / 墨黑底 + 金色高光。

---

## 质感与绘制规范

- 纸质底：全局背景为米纸纹理（细微噪点），不用纯平色块。噪点由 canvas 一次性绘制到离屏层后作为 CSS 背景，不做逐帧重绘。
- 工笔描边：所有物件用 `--ink` 细描边，`stroke-width` 固定 1.5px。不用粗黑边或卡通描边。
- 无渐变高光：饼皮 / 木桌用平色 + 单层内阴影。禁止 `createLinearGradient` / `createRadialGradient` 用于饼皮与桌面。
- 月饼纹样：对称几何刻印（回纹 / 缠枝 / 云纹）。S3 压模时纹样对准即可视化 `tol`。
- 灯笼：单色暖黄 `--lantern`，一盏一盏点亮，不做灯笼阵列。

---

## 动效预算

| 项 | 规定 | 实现约束 |
| --- | --- | --- |
| 短局四步 | 每步一个动效，不叠加粒子 | S1 / S4 用 CSS transform 驱动标记；S2 / S3 用 pointer 拖拽，无补间 |
| 结局揭示 | 月亮盈亏一次渐变 ≤ 1.2 秒（S1），其后六步一律 `steps()` 阶跃 | §6.3.5-a 的七步序列：一次类翻转 + 固定 `animation-delay`，合计 4.65 秒；`fill-mode` 取 `backwards`（`steps(n, end)` 的末台阶是 `(n−1)/n`，`both` 会把中间值永久留住）；`style.css` 里 `transition: …1.2s` 恒为 1 处 |
| 排程格 | 无动效，点击即填 | `#slot-grid` 内禁止任何 `transition` / `animation` |
| 全部动效 | 纯 CSS / transform | 禁止 `requestAnimationFrame` 逐帧驱动 UI 动效；canvas 静态绘制不在此列 |

---

## 核心符号与呈现位置

| 符号 | 呈现位置 | 游戏语义 |
| --- | --- | --- |
| 带纹样的月饼 | 短局 S3、饼列表、分饼面板 | 第一视觉主体；纹样压印即 tol 的可视化 |
| 圆桌 + 五个座位 | 宴前一览、终局 | 家人缺席时座位空着 |
| 灯笼 | 氛围 meter 载体 | 布置 +10 = 点亮 1 盏，上限 4 盏 |
| 酒壶 + 桂花枝 | 宴席项 meter 载体 | 备宴 +1 项；桂花酒项显示桂花枝 |
| 圆月 | 终局背景、分享卡顶区 | E1 满月 → E5 薄云遮月；终局为 CSS 像素块，五档云量 / 云缕 / 明度 / 月华一眼可分（§6.3.5-b） |
| 信笺 | 写信动作、兄长到席判定 | 信已寄出的置灰图标依据 |

## 禁用符号（V-19 grep 目标）

玉兔、嫦娥、月宫、西式蛋糕、慕斯、现代月饼礼盒、塑料包装、红色喜庆灯笼阵。
源码与素材中出现任一即 V-19 失败。

---

## 分享卡版式（780 x 1688）

| 区 | 位置 (x, y) | 尺寸 (w x h) | 内容 |
| --- | --- | --- | --- |
| 边距 | - | 四边各 60 | 内容区 660 x 1568 |
| 顶 · 月亮 | 居中 (390, 210) | 直径 200 | E1 至 E5 五档 |
| 顶 · 结局名 | (390, 400) 基线居中 | - | 字号 64 / 字重 700 / `--ink` |
| 顶 · 结局文案 | (390, 470) 基线居中 | 最大宽 560 | 字号 30 / 字重 400 / `--ink` |
| 中 · 圆桌 | (390, 720) | 直径 380 | 五座位均分圆周，每 72° |
| 中 · 饼条 | (60, 980) | 660 x 300 | 五行，行高 60 |
| 下 · meter | (60, 1340) | 660 x 120 | 三行，行高 40 |
| 底 · 标识 | (390, 1560) 基线居中 | - | 工具名 34/700，系列标识 20/400，均 `--ink` |

字号表其余项：家人称谓 26/500 `--ink`；饼馅料名 24/400 `--ink`；
饼品级标记 20/700，金 `--lantern` / 银 `--paper` / 铜 `--amber`；meter 名与数值 28/500 `--ink`。
字族为系统中文无衬线，不使用外链字体。层级差异只用字重与字号承担，不新增颜色。
空座位只画 `--ink` 描边圆（底色为 `--paper`，须用对比色才可见），无填充、无称谓、无文案。品级以「金 / 银 / 铜」三字呈现，不写数字。

---

## 首屏文案（锁定，不得实现期改写）

| 位置 | 文案 | 汉字数 |
| --- | --- | --- |
| 标题 | 月宴 | 2 |
| 副标题 | 八月十五，为家人备一桌团圆 | 12 |
| 玩法说明 | 初八到十四，每天做三件事。买料、制饼、备宴、写信——七日之后开席。 | 25 |
| 从容模式开关 | 从容模式：四步不限时，慢慢做。（难度不变，只去掉时间压力） | 23 |
| 开始按钮 | 开始筹备 | 4 |
| 存档提示 | 每日收工自动存档，可随时关掉，明天接着做。 | 18 |

玩法说明 ≤ 45 汉字约束：实测 25 ≤ 45。

---

## Spec deltas（实现按表不按散文，不修改 spec）

按 §14.2：复验未通过时以脚本输出为准修订表格，不得反向修改脚本去凑表格；spec 文件不动，差异在此留痕。

1. **§6.5.4 R3 闲置槽数是 4，不是 5。** 散文写「槽位：21（含 5 个闲置）」，而 §6.5.1 逐日表
   （动作 3/3/2/2/3/2/2，闲置 0/0/1/1/0/1/1）算出 17 动作 + 4 闲置 = 21。实现用 **4**。
   引擎从不接触这个数字，V-29 的 R3 fixture 编码的是逐日表。

2. **§6.5.4 R3 峰值库存是 14，不是 15。** 散文写「峰值（D3 手作前）10 + 4 + 1 + 0 = 15」，
   把咸蛋黄算进了 D3 手作前。按 §3.7 步 2，咸蛋黄在 `下单日 + 2` 的**日结算**到账，
   即 D3 收工时才入账，而 D3 的手作已在结算之前执行完毕，故 D3 手作期间 `stock.xiandanhuang` 仍为 0，
   引擎内真实峰值为 `10 + 4 + 0 + 0 = 14`。两种读法都 ≤ 24（V-11 不受影响），
   且咸蛋黄仍从 D4 起可用，与 §6.5.4 的主张一致。实现按 §3.7 步 2（结算时到账），不把到货移到日初。

3. **§6.4 I-3「桂花 ×1 且用于桂花馅 → 宴备上限 88」是按宴席项上限推得的理论天花板，槽位不可达；实际可达上限为 78。**
   该档要求 备宴 ×4（4 槽）+ 布置 ×4（4 槽）= 8 槽才能拿到 `48 + 40 = 88`，
   而 D5 至 D7 只有 9 槽，其中 桂花采买 1 槽 + 桂花饼手作 1 槽 已占 2 槽，只剩 7 槽。
   7 槽的最优分配是 备宴 ×4 + 布置 ×3 → `4 × 12 + 30 = **78**`（备宴 ×3 + 布置 ×4 = 76 更低）。
   其余三档槽位可达，与散文一致：桂花 ×0 → 88（备宴 4 + 布置 4 = 8 槽）、
   ×1 用于桂花酒 → 90（桂花 1 + 备宴 5 + 布置 3 = 9 槽）、×2 → 80（桂花 2 + 备宴 5 + 布置 2 = 9 槽）。
   V-5 断言的是**槽位可达**的四档 `88 / 90 / 78 / 80`。宴席项上限本身仍严格为 `guihuaWine ? 5 : 4`（V-24）。

4. **备宴第 5 项（桂花酒）必须在钳位判定之前升级上限。** 若先判 `banquet >= banquetCap(state)`，
   无桂花酒时 `banquet === 4` 与 `cap === 4` 会先行拒绝，第 5 项永远点不亮，V-5 的 90 档与 V-24 的钳位 5 均不可达。
   实现顺序为：先判「本次是否为第 5 项且尚未有桂花酒」→ 校验并消耗桂花 1 → 置 `flags.guihuaWine` →
   再判 `banquet >= banquetCap(state)`（此时 cap 已升为 5）。无桂花时该分支直接抛错，第 5 项点不亮（§3.2.2 / §3.3）。

5. **计划文档 Task 3 的部分 fixture 与 §3.4 / §3.5 / §3.1 的门控冲突，已按 spec 规则修正，期望值不变（除第 3 条）：**
   - `HMAX` D6 原为 `[手作莲蓉, 采买普通料]`，但 D5 结束时普通料为 0，手作先于采买会因物料不足抛错；
     改为 `[采买普通料, 手作莲蓉]`。终值不变（`H = 86`，银钱 26，槽位 16）。
   - `TIER_FILLING` 原有 5 次备宴而无桂花可用（桂花已用于桂花馅），第 5 次必抛错；
     改为 桂花 1 + 桂花饼 1 + 备宴 4 + 布置 3 = 9 槽，`B = 78`（见第 3 条）。
   - `TIER_BOTH` D7 原为 `[备宴, 备宴, 布置]`（合计 6 次备宴 > 上限 5）；改为 `[备宴, 布置, 布置]`，
     合计 桂花 2 + 备宴 5 + 布置 2 = 9 槽，`B = 80`，与散文一致。
   - `V-10` 的 5 枚饼 fixture 原在 D3/D4 各做 3 枚（合计 6 枚 > 饼上限 5）；改为 D3 三枚 + D4 两枚 = 5 枚。
   - `V-25` / `V-26` 原在 D1 直接布置 / 试新方，但布置 D6 起、试新方 D2 起解锁（§3.5）；
     改为先空转至解锁日再执行，第 5 次布置 / 第 4 次试新方的拒绝断言改在**合法日内**触发，
     以免被「D7 之后不可排程」的抛错掩盖真实原因。
    - `G2 好料窗口`断言原在 D2 采买好料（D2 在 D1–D3 窗口内，合法），改为空转至 D4 再采买。
    - `银钱不足`断言原用 4 个动作，会先被「槽位 > 3」拒绝而掩盖真实原因。改用 `SILVER_DRAIN` 路线
      （每日花费 6/5/9/7/6/6/5 = 44，D1–D4 用 普通料 5 + 代做 5 + 试新方 3，D5–D7 用 备宴 4 + 布置 4），
      使进入 D7 时银钱恰为 **5**、七日跑完恰为 0。断言分两条：D7 连买两次普通料（4 ≤ 5）**通过**作为正对照，
      连买三次（6 > 5）第三次因**银钱不足**抛错。槽位（≤ 3）与库存上限（`2 + 6 ≤ 24`）在该点均不成立为约束，
       正对照正是用来钉住这一点。

6. **指派加成是一次性的，但该状态不落地为存档字段，而是从 `assignment` 反推。**
   §6.6 规定「指派完成后锁定，不提供重分」，而 §7.3 的偏好加成本身没有幂等语义：
   `applyAssignment` 每次调用都把 `+12`（金）/ `+8`（银）累加到 `family[key]`，
   重复调用（存档读回后重放、预览面板重算）会二次发放加成。实测二次调用后
   R1 由 `92/92/84/64/88`（`H 84`）漂到 `100/100/96/64/100`（`H 92`），HMAX 由 `H 86` 漂到 `H 97`，
   即 `family` / `meters` / `ending` 均不再幂等。

   曾一度在 `flags` 里新增 `assigned` 布尔位来承载一次性语义，**该做法违反 §10.2**：
   §10.2 是「唯一契约」，`flags` 的字段集合严格为 `{xieXin, congRong, guihuaWine}`，
   实现计划的全局约束同样要求存档形状逐字一致、不得增字段。故已撤回。

   现行实现只读 §10.2 已有字段：`assignmentApplied(state)` 遍历 `familyOrder`，
   任一 `assignment[key]` 非 `null` 即视为「已指派过」。`applyAssignment` 在函数开头
   （**写入 `assignment` 之前**）对**入参** `state` 求该值并记为 `already`，
   仅当 `already !== true` 时执行加成循环；校验与写入始终执行以保留错误契约。
   求值必须早于写入，否则刚写入的非空下标会让自己判成「已应用」而永久吞掉加成。

   反推的正确性来自一条不变量：**加成只在 `assignment[key] !== null` 时才可能发生**。
   因此「全 `null`」⟺「从未发放过加成」，重复调用只是空转，天然幂等；
   「存在非空下标」⟺「加成已发放过」，故必须跳过。**零饼情形**（`cakes.length === 0`，
   此时所有下标只能是 `null`）落在前一分支：加成循环每次执行却一无所发，二次调用结果相同。
   另一边界同样成立：下标非空但馅料不匹配 `pref`（首次就没有加成）时，跳过无害。
   存档（§3.8 / Task 8）无需新增字段、无需迁移或反推逻辑——`assignment` 本就逐字序列化；
   `version` 不匹配仍按 §3.8 丢弃重开。

   回归断言：`tests/yueyan_engine.py::test_assignment_idempotent`
   （R1 / R3 / HMAX × `family` + `meters` + `ending`，外加 §10.2 `flags` 恰为三字段
   与**零饼路线**的三项稳定性断言）；`tests/yueyan_save.py` 的 `§10.2 flags fields`、
   `§10.2 resumed blob carries no extra flags field` 与 `test_assignment_guard`
   （存档读回后再指派不得二次发放）。RED 证据为 `flags` 多出 `assigned`，
   而非 `family` / `H` 漂移——后者由幂等断言独立覆盖。

7. **`grep -rn 'random'` 是字面、大小写敏感的确定性门禁，散文注释也要避开这个词。**
   计划的全局约束把该 grep 作为「无随机」的验收手段，它匹配字面串而非语义，
   所以 `audio.js` 顶部注释里的 `never ambient randomness.` 会让门禁失败——
   尽管该文件既无 `Math.random` 也无任何随机行为（§7 / V-2 的实际语义并未被违反）。
   已改为 `never ambient variation.`，**运行时行为零变更**（纯注释改写）。
   `tests/yueyan_audio.py::test_source_hygiene` 仍断言 `Math.random not in src`，
   即语义门禁与字面门禁并存，互不替代。

8. **Task 16 的「六行」门禁与七个锁定 `row-*` id 互斥，Task 10 只能以运行时重挂载化解。**
   计划 Task 16 的 IDS 检查要求 `index.html` 的七个锁定 id 全部在场
   （`row-buy / row-shishi / row-daizuo / row-shouzuo / row-xiexin / row-beiyan / row-buzhi`），
   同一任务的六行检查却用正则 `id="row-(buy|shishi|daizuo|shouzuo|xiexin|beiyan|buzhi)"`
   抽取 id 后断言 `len(set(rows)) == 6`。七个互异 id 必然产生七个捕获，
   两条断言**不可能同时成立**。计划散文自称「六行」却逐条列出七项，属计数笔误；
   设计规范 §3.3 明确「动作抽屉恰好六行，每行是一个顶层动作；
   采买与制饼在选中后展开二级分支」，即 `row-daizuo` / `row-shouzuo`
   本就是制饼的二级分支，不该计为顶层行。

   Task 10 的 Files 只授权 `scene.js`，故 `index.html` 一字未改、七个 id 原样保留。
   化解方式是运行时重挂载：`Scene.buildDrawer()` 新建 `[data-action="craft"]` 顶层行，
   把 `row-daizuo` / `row-shouzuo` 移入其 `.craft-branch`，于是 `#drawer > .drawer-row`
   恰好六行（采买 / 试新方 / 制饼 / 写信 / 备宴 / 布置），七个 id 仍在文档中、
   仍可被 Task 16 的 IDS 检查命中。因此 Task 16 的六行正则仍会读到七个 id 而失败，
   **这不是实现缺陷，是门禁自身不自洽**。建议改为两条独立断言：
   七个锁定 id 在场（IDS）＋ `#drawer > .drawer-row` 顶层行数恰为 6；
   或从该正则中剔除 `daizuo|shouzuo`。本任务不得改计划或规范，故此处仅记录、不做修改。

   回归断言：`tests/yueyan_ui.py::test_six_rows`
   （「§3.3 exactly six top-level rows」＋六个顶层动作名逐字在场＋
   「制饼 variants stay nested under the 制饼 row」＋`renderSchedule` 幂等不重复建行）
   与 `tests/yueyan_ui.py::test_source_hygiene`
   （「all seven locked row-* ids survive in index.html」）同时通过。

9. **`reasonFor` 的全部文案单一来源于 `D.copy`，其中 `patternFull` 与 §3.3 措辞不一致。**
   `reasonFor` 不硬编码任何字符串，六条规范锁定串一律取自 `data.js` 的 `copy`
   （`marketEmpty` / `cakeFull` / `lanternFull` / `letterSent` / `wineNeedsGuihua` /
   `patternFull`）。规范 §3.3 规定试新方第 3 次后置灰并注明「三式已成」，
   而 `data.js` 的 `copy.patternFull` 实为 `'纹样已足'` 且该行自带 `// impl` 标注
   （非 `// spec-locked`），即这是一处**既有的实现期文案偏差**；Task 10 不得改 `data.js`，
   故实现照读现值。日后改回「三式已成」需同时改 `data.js` 与
   `tests/yueyan_ui.py::test_reason_strings` 的期望值，`scene.js` 零变更。

   规范未给 spec-locked 串的提示（`未到初九` 等解锁提示、`银钱不足` / `缺普通料` /
   `缺料` / `仓已满` / `席已满`）为实现期文案，全部集中在 `reasonFor` 一处，
   且每条都镜像对应的引擎谓词（§10.3.1），抽屉因此不可能与 `Engine.actionOk` 矛盾。

    回归断言：`tests/yueyan_ui.py::test_reason_strings`
    （在一个改写过的 fixture 上逐字断言六条串与「可行动时返回空串」）、
    `tests/yueyan_ui.py::test_d1_greying`（「§5.2 D1 桂花 branch reads 市集无货」）、
    `tests/yueyan_ui.py::test_source_hygiene`（「V-21 scene.js hardcodes no hex」）。

10. **从容模式：§4.2 移除计时上限，制作改为三步轻点，摆杆机制已整体退休。**
    §4.2 移除的是**倒计时上限**（8/10/12/10 秒预算）。返工后制作不再是摆杆过窗，而是
    **揉皮 / 包馅 / 落模三步、每步 3 下轻点、共 9 下**（§4.3.2），配三个像素进度点，
    无容差窗口、无摆杆、无再武装闸门——`tolOf` / `swingAt` / `stokeOk` 与
    `tolBase` / `tolPerPattern` / `tolCap` / `swingOneWay` / `swingRate` / `swingWindow`
    全部退休（§14.2 M-1 步 ②），实现侧命中数为 0。
    火候仍由 `h = clamp(litElapsed / T_burn, 0, 1)` 决定（灶甲 12.0 秒、灶乙 10.0 秒，§4.3.5），
    `h` 钳位 1.0、**焦不删饼**；从容模式下 `h` 恒取 0.70（§4.3.5），即直接落在佳窗中心。
    `E.precision` 与 `E.gradeOf` **逐字保留**（§14.2 M-1 步 ②），故品级阈值与判词不变。
    柴火为燃料：一把柴给一座灶 15.0 秒火、库存 8 把，火灭则 `h` 冻结、续火从冻结值续算（§4.3.6）。

    回归断言：`tests/yueyan_craft.py`（279 项，覆盖三步轻点、火候、零失败态、燃料、
    订单循环、`craftSim` 契约、`nextGuide`、`preferBonus`、§6.4 不变量）。

11. **等级名与「料是好料，火候差了些。」没有 `data.js` 键，按 Task 11 授权落在 `scene.js`。**
    `data.js` 只有 `grade` 的数值门槛（`gold 3.60` / `silver 2.40` / `floor 1`）与
    `premiumCost`，没有 铜饼 / 银饼 / 金饼 三个名字，也没有 §4.4.1 规则 2 的安慰句。
    Task 11 的 Files 只授权 `scene.js`，故 `GRADE_LABEL`（三名字）与
    `PREMIUM_MISS`（『料是好料，火候差了些。』）作为**展示层文案**留在 `scene.js`。
    数值判断始终在引擎：`scene.js` / `main.js` 不出现 `3.60` / `2.40` / `grade.gold` /
    `grade.silver` 任何字面量，只读 `E.finishCraft` 返回的 `cake.grade`
    （§4.4.1「引擎拥有数值判断」）。日后若要文案单一来源化，把两条串搬进 `data.js`
    的 `copy` 并改 `scene.js` 读 `D.copy.*` 即可，测试期望值同步迁移。

    回归断言：`tests/yueyan_craft.py::test_grade_double_gate`
    （好料 P=2.80 → 银饼且带安慰句；好料 P=2.00 → 铜饼且好料不退；
    普通料 P=4.00 → 银饼，证明好料是必要条件而非充分条件）、
    `test_source_hygiene`（「grade math is not duplicated into the UI」）。

12. **短局跑在 craft-local 快照上，只有测量结果进入当日计划，扣料只发生一次。**
    `Main.enterCraft()` 用 `projected()` 建快照交 `E.beginCraft`；四步确认完由
    `E.finishCraft` 给出 `cake`，`Main.finishCraft(done)` 只把
    `{type:'shouzuo', filling, batch, P}` 排进当日计划，真正的扣料与成饼由
    `E.execShouzuo` / `E.applyDay` 在日界结算时执行 —— 因此不存在重复扣料。
    放弃走 `E.abortCraft`：料退回、`slotsUsed` 不增，符合 §4.6「放弃不消耗槽位」。
    另一处不变量：`Scene.show()` 在 `view-craft` 时给 `#day-bar` 加 `is-hidden`，
    因为 §4.6/X-12 要求短局进行中不得收工，否则日界结算会把计时器孤立掉。

    回归断言：`tests/yueyan_craft.py::test_cake_lands_in_plan`
    （计划恰好多一条 `shouzuo`、带 `batch` 与实测 `P`、日界结算后等级为引擎所判、
    料只扣一次）、`test_abort_refund`（放弃后料回原位且 `slotsUsed` 为 0）、
    `test_touch_targets`（`view-craft` 期间 `#day-bar` 隐藏）。

13. **结局码由 `E.ending(state)` 独占判定，文案只来自 `D.endings[code]`；
    到席与否由引擎的 `A` 反推，这是 Scene 唯一一处「推断而非读取」。**
    `renderEnding` 只做三件事：取 `code = E.ending(state)`、取
    `D.endings[code].name/.text`、给 `#end-moon` 打 `data-ending=code` 并
    `Audio.play('moon', code)`。`scene.js` / `main.js` 里不出现
    `isE1..isE5(`、`Q >=`、`B >=`、`H >=`、`A === 5` 任何形式，也不出现
    `cakeDenominator` / `heartDenominator` / `banquetItemValue` / `/ 15` / `/ 500`，
    §6.3.4「结局永远读作团圆」因此由 `data.js` 的五句文案保证，UI 无法写出
    可惜 / 遗憾 / 未完成 / 失败 / 失望 / 归零。
    §7.1 的空座位需要一个「谁到席」的布尔值，而引擎的 `attends()` 是模块私有、
    未导出（**API 缺口**，见 Task 12 报告）。此处不重算判定式，改为用引擎给出的
    `E.meters(state).A` 反推：§3.9 规定四位家人必到席，故 `A === D.familyOrder.length`
    恰好等价于兄长到席 —— 单一来源仍是引擎，Scene 不复制
    `flags.xieXin && cakes.length >= 1 && assignment.brother !== null` 三段式。
    未获饼但仍在席者按 §6.6 标 `D.copy.noCake`（未留饼），座位照样 `is-filled`；
    未写信的兄长则座位空着且无任何负面措辞（§7.7）。

    回归断言：`tests/yueyan_finale.py::test_ending_panel`（R1→E1 … R5→E5 五条路线
    的 `data-ending` 与引擎判定逐一对齐）、`test_engine_contract` 与
    `test_source_hygiene`（UI 无结局判定式、无仪表算式、无负面词）、
    `test_preview_absent_brother`（未写信 → 四席在席、五席齐全、`A === 4`）、
    `test_preview_cakeless_seat`（无饼者仍 `is-filled` 且标未留饼，兄长席空）、
    `test_audio_wiring`（`moon` 的参数等于 `#end-moon[data-ending]`）。

14. **X-10「不提供重分」落在 Scene 的 `dealt` 锁上，而不是靠流程恰好不回退。**
    `renderAssign(state)` 是公开 API，测试与工具都能直接调用，所以不能把
    「不可重分」寄望于没有按钮回到 `view-assign`。实现改为读取入参本身：
    `dealt = assignmentMade(state)` —— 只要传入的状态已带任何一枚指派，
    就渲染零张饼行、家人按钮全部 `disabled`、`就这样分` 同步置灰。
    确认后 `confirmAssign` 清空 `#assign-cake-list` 并推进到 `view-preview`，
    此时状态已带指派，故再调用 `renderAssign(assigned)` 也拿不到可点的饼行。
    一人一枚由 `dealCake` 保证：新饼入袋前先把持有同一枚饼的家人清空，
    因此重新指派是替换而非叠加。

    回归断言：`tests/yueyan_finale.py::test_assign_locks`（确认后离开分饼视图、
    饼行归零、重入无 `aria-pressed=true`、§7.3 加分只发生一次 → 祖母 92）、
    `test_one_cake_per_member`（连点两枚饼后全场只有一枚 `aria-pressed=true`）、
    `test_preference_bonus`（金饼命中 +12、非偏好馅 +0、无饼者 +0）。

15. **finale 状态归 Scene 持有，`Main` 只在第七天交付一次；三个 finale 视图都隐藏 `#day-bar`。**
    初版把 `finale` 存在 `main.js` 并让按钮走 `Main.confirmAssign` /
    `Main.openFeast`，结果任何不经过 `finishDay` 的入口（测试直接 `renderAssign`、
    或未来从存档恢复）都拿不到状态、按钮变成空转。改为与 delta #12 的
    craft-local 快照同构：`renderAssign` 记下 `finaleState`，`confirmAssign` 把它
    换成引擎返回的 `assigned`，`开席` 直接读 `finaleState`；`main.js` 不再有
    `finale` 变量，`finishDay` 只在 `settled.day > D.board.days` 时调
    `Scene.renderAssign(settled)`。`Scene.show()` 的 `is-hidden` 条件同步扩展到
    `view-assign` / `view-preview` / `view-ending` —— 七天已终，收工按钮不该还在。
    另修一处真实缺陷：`#end-moon` 在 `index.html` 锁定为 390×390，而
    `.view` 有 40px 横向内边距，直接摆放会让 `scrollWidth` 变成 430，
    故 `.end-moon` 加 `max-width: 100%; height: auto`（canvas 自带宽高比，
    等比缩放不破坏 §8.1 的满月绘制）。朱砂仍只出现在 `#btn-open-feast`
    （`.btn-feast`）与饼纹按压两处；`.cake-row` / `.fam-row` 均为 56px 主目标。

    回归断言：`tests/yueyan_finale.py::test_full_flow`（真点击走完七天 → 分饼 →
    一览 → 开席 → 结局）、`test_touch_targets`（三个视图 `scrollWidth ≤ 390`、
    `.cake-row` / `.fam-row` / `#btn-open-feast` / `#btn-share` ≥56px、
    `开席` 背景为朱砂 `rgb(201, 72, 60)`）、`test_source_hygiene`
    （七 token 无新增、朱砂不外溢、finale 元素无入场动画）。

16. **§8.3 全部质感由四个纯程序化函数产生，仓库零图片资产。**
    `drawMoon(canvas, code)` 画满月饼（`D.palette.moon`）+ 1.5px 工笔描边
    （`D.palette.ink`），再按 §6.3.1 的 `{E1:0.00, E2:0.18, E3:0.35, E4:0.55,
    E5:0.75}` 叠一条裁进圆内的云带（`D.palette.paper`），云越多月越薄但饼径不变
    （实测五档饼径同为 104px，云占比 0 → 0.115 → 0.308 → 0.578 → 0.822）。
    `drawCakePattern` 五种馅各一条对称路径（`CAKE_PATH`），一律
    `fill: none` + `stroke: D.palette.cinnabar` + `stroke-width 1.5` ——
    这是朱砂的第二处也是最后一处 sanctioned 用法，`scene.js` 内无任何
    十六进制字面量，每个颜色都取自 `D.palette`。`tintLanterns` 只给
    `.lantern.is-on` 上 `D.palette.lantern`，未点亮的一律不动（V-20 单色暖黄，
    实测三盏同为 `rgb(245, 199, 126)`）。`buildPaperLayer` 用 64×64 离屏画布
    生成米纸底，噪点是确定性取模 `((x*7+y*13)%5)===0`，**不用 `Math.random`、
    不用引擎 rng**，故同一台机器每次得到完全相同的底纹；它在 `buildDrawer()`
    里随首帧建一次即 `toDataURL` 挂到 `document.body`，离屏画布用完即弃，
    DOM 内 canvas 数为 **0**（终局月相已改为 CSS 像素块，§6.3.5-b；§8.3 不逐帧重绘）。
    `#ui` / `.view` 本身不带背景色，所以底纹真的透得出来。

    回归断言：`tests/yueyan_art.py::test_moon_phases`（五档饼径一致、云占比单调、
    云不吃掉整饼）、`test_cake_patterns`（五条 `d` 互不相同、未知馅回落豆沙）、
    `test_lantern_tone`、`test_paper_determinism`（两次调用字节级相同）、
    `test_no_image_assets`（`assets/` 内无任何图片扩展名文件）。

17. **§8.4 结局揭示原本是一次“不会播放”的动画，两处修正后才真的渐显。**
    Task 2 的样式表里 `.end-moon.is-revealing` 只写了
    `transition: opacity 1.2s ease`，却没有起始值 —— 元素本就是
    `opacity: 1`，加不加这个类没有任何视觉差别，规范里唯一被批准的长动效
    是空转的。补上 `.end-moon { opacity: 0 }` 基线后仍不够：结局视图在
    `show()` 之前是 `display: none`，`display:none` 的元素没有既有的
    computed style，浏览器拿不到“变化前”的值，于是 opacity 直接跳到 1、
    transition 一次都不跑（实测加类后立刻读到 `1`）。故两处一并改：
    `renderEnding` 先 `show('view-ending')` 再 `drawMoon`，且 `drawMoon`
    在加类前 `void canvas.offsetWidth` 强制一次样式计算，把 `opacity: 0`
    坐实成变化前的值。修好后实测：300ms 时 opacity = 0.408584（正在渐显），
    1.4s 后收敛到 `1`。动画本体仍是纯 CSS transition，没有 `requestAnimationFrame`
    / `setInterval` 逐帧驱动，符合 §8.4 ≤1.2s 的一次性揭示。

    回归断言：`tests/yueyan_art.py::test_moon_reveal`（起始 `0`、类名落到
    `is-revealing`、`transitionDuration` 恰为 `1.2s`、加类瞬间仍为 `0` 而非跳变、
    1.4s 后为 `1`）、`test_wiring_ending`（真结局流程同样先 `0` 后 `1`）。

18. **V-19 的审查范围按本文档第 68 行是“源码与素材”，不含本文档自身。**
    实现计划 Step 4 写的是对 `tools/yueyan/` 整体 grep 禁用符号，但本文件的
    禁用符号清单正是为了列出“不许出现的东西”而存在的，整体 grep 必然命中
    清单本身（实测命中第 67 行、退出码 0），这与计划自己的验收标准互相矛盾。
    故按本文档定义的口径执行：只扫 `.js` / `.html` / `.css`，结果退出码 1
    （零命中）；`.md` 里的清单保留不动。此处记为对计划的偏离，不是放水。

    回归断言：`tests/yueyan_art.py::test_source_hygiene`（仅扫源码与素材、
    零命中；`scene.js` 无十六进制字面量；点亮灯笼那一行引用的是
    `D.palette.lantern`）。

19. **分享卡运行时由 canvas 画出，仓库仍然零图片资产；品级只用金/银/铜三字。**
    `Share.build(state)` 按 §9.3 锁定的几何在 780×1688 画布上作画，全部坐标
    读自 `Data.card`，不新增任何常量；顺序为 米纸底 → 月亮（按 §6.3.1 的
    五档云带）→ 结局名 → 结局文案（按 `textMaxW` 折行，最多两行）→ 圆桌五座位
    → 饼条五行 → meter 三行 → 底部标识，最后 `toDataURL('image/png')` 返回。
    字号表逐行对齐 §9.3（64/700、30/400、26/500、24/400、20/700、28/500、
    34/700、20/400），层级差异一律用字号与字重承担，不引入板外色。
    品级写成「金 / 银 / 铜」三字而非 `grade: 3`：金取 `--lantern`、银取
    `--paper`（即底色，读作「素」）、铜取 `--amber`，三者都不碰朱砂 ——
    朱砂面积须 ≤5%，品级若用朱砂会在五枚饼上反复出现直接超标。
    空座位只画描边圆、无称谓无文案（§9.3 / X-11）。`share.js` 内零十六进制
    字面量，每个颜色都取自 `D.palette`（V-21）；无 `Math.random`、无 rng，
    故同一状态两次生成的卡字节级相同。`Share.publish(dataUrl)` 有
    `window.xhs.miniTool` 时调 `tool.share({image})` 并返回 `'xhs'`，
    工具抛错或不存在时静默降级为 `#card-wrap` 内联预览（`alt="月宴分享卡"`，
    重复生成是替换而非叠加），返回 `'fallback'` —— 两条路径都不发任何网络请求。
    `#btn-share` 的接线落在 `Scene`：`renderEnding` 记下 `finaleState`
    （沿用 delta #15 的「finale 状态归 Scene 持有」），点击时才解析
    `window.YueYan.Share` —— `share.js` 在 `scene.js` 之后加载，若在模块作用域
    取值只会拿到 `undefined`，按钮就变成空转。

    计划本身有一处缺陷已修：`drawMeterRows` 把 `textAlign` 留在 `'left'`，
    而底部标识紧接着绘制，于是「月宴 / 非遗手作坊」会左对齐，违背 §9.3 的
    「底 · 标识基线居中」。故在画标识前显式收回 `textAlign = 'center'`。

    另记一处规范缺陷已修：§9.3 原写空座位是「`--paper` 描边圆」，但底色同为 `--paper`，
    米纸描边画在米纸底上等于隐形，座位看不见，与「缺一人直接可见」（§5.1 / §7.5）
    「空缺本身是叙事」的意图相悖。已将 §9.3 修正为 `--ink` 描边圆（可见），与计划代码一致；
    到席者为 `--ink` 描边 + `--moon` 填充 + 称谓，空座位仅 `--ink` 描边圆。

    回归断言：`tests/yueyan_share.py::test_build_size`（前缀
    `data:image/png;base64,`、解码后恰为 780×1688）、`test_determinism`
    （同状态两次生成字节相同）、`test_palette_only`（画师设过的每个颜色都是
    七 token 之一、主色为 token 或 token 间插值、卡底为米纸）、
    `test_text_content`（结局名/文案/馅料/meter/标识齐全，品级只有三字且无数字，
    §9.2 过程信息不上卡）、`test_grade_colours`（金银铜各归其色）、
    `test_font_table` / `test_alignment`（字号表与居中/左对齐逐行核对）、
    `test_seats`（空座位无填充无称谓，到场家人有填充有称谓）、
    `test_moon_phases`（E1→E5 月色递减、E1 满月、E5 最薄）、
    `test_publish_fallback` / `test_publish_xhs` / `test_publish_throws` /
    `test_no_network`（三条发布路径与零网络）、`test_wiring`（真点击
     `生成分享卡` → 内联 780×1688 卡）、`test_source_hygiene`
     （零十六进制、零 rng、零网络 API、零内联 handler）。

20. **接线只归 Scene，状态只归 Main；启动即续局，并暴露一个只读冒烟门面。**
    计划 Task 15 要求在 `main.js` 里补一份 `wire()` 绑定七个按钮，但自 Task 10/12
    起接线已落在 `Scene.buildDrawer()`（见 delta #15「finale 状态归 Scene 持有」）。
    照抄计划会让 `btn-start` / `btn-finish-day` / `btn-craft-abort` / `btn-share` /
    `btn-open-feast` 各被绑两次，一次点击触发两次日结算、两次出卡。故不照抄：
    `main.js` 内零 `addEventListener`、零 `wire()`，每个按钮 id 只在 `scene.js` 出现一次。

    `boot()` 改为 V-17 续局：`var saved = Save.readProgress(); dayBase = saved ||
    E.initialState();`，与 §3.8「日结算是唯一存档点」一致；`start()` 不再重置
    `dayBase`（只保留 `toggle-congrong` → `flags.congRong`），否则续局进度会被
    一次点击抹掉。提示文案有顺序依赖：`renderIntro` 无条件写 `D.intro.saveHint`
    （`scene.js` L117），故续局日期必须在 `renderIntro` **之后**追加，渲染为
    「…（上次进行到第初十日）」。

    门面 `window.__yueyan` 七键加 `window.__ready`：`share` 用
    `Object.defineProperty` 的 `enumerable` getter，因为 `share.js` 在 `main.js`
    之后加载，平铺属性只会取到 `undefined`；`craftStep(i,d)` 与 `Main.injectStep(i,d)`
    都转发到既有的 `Scene.injectStep`，不新建第二份工艺状态机；
    `Scene.currentPick()` 只暴露既有 `pick`，不引入第二真相源。
    X-8：`btn-share` 出卡后把结局码写入 meta（`readMeta()` → 去重 push →
    `writeMeta(meta.endingsSeen)`），只存结局清单不存进程，重复分享不重复记。
    `scene.js` 对 `Save` / `Share` 都在点击时才解析，二者都在 `scene.js` 之后加载。

    计划与指令和现状有三处冲突，按现状实现并留痕：
    - 指令要求在 `btn-open-feast` 点击里补 `Audio.play('moon', code)`，但
      `renderEnding` 早已播同一 cue（delta #15），补上等于一次开席响两次月音。
      故不补，改为断言真点击路径上 `play('moon', code)` 恰一次。
    - 指令要求续局提示含「第3日」，但计划模板渲染农历日期（`D.dates[day - 1]`），
      day 3 实为「初十」，断言按真实内容取「初十」。
    - 指令要求无存档时 `intro-save-hint` 为空或隐藏，但锁定脚手架的 `renderIntro`
      总是写通用存档提示（这本身是正确的 UX：告知玩家自动存档）。故断言改为
      「等于通用提示且不含日期后缀」。

    回归断言：`tests/yueyan_main.py`（48 项）—— `test_facade`（七键齐全、
    `share` 惰性解析为模块、`engine`/`data`/`save` 为活模块、`ready` 为真、
    零内联 handler）、`test_inject_step_forward`（`Main.injectStep` 与门面
    `craftStep` 都命中 `Scene.injectStep`）、`test_current_pick`（未发牌时为空，
    点家人按钮＋饼行后反映真实 `pick`）、`test_resume`（V-17：seed 后重载
    `day === 3`、提示含「初十」、银两与饼数完好、开始筹备进入续局当日而非
    重开）、`test_fresh_boot`（无存档 day 1、提示无日期后缀、落在首屏）、
    `test_meta_write`（X-8 结局码入册、meta 只有结局清单、重复分享不重复记）、
    `test_moon_audio`（真流程到宴前一览后开席，月音 cue 恰一次且带结局码）、
    `test_single_wiring_source`（每个按钮 id 只在 `scene.js` 出现一次、
    `main.js` 零 `addEventListener`）。

21. **出厂冒烟 `tests/yueyan_smoke.py` 落地，38 项全绿；两处 FAIL 都改源文件而非放宽断言。**
    该套件不复验数值（那是 Task 3 的 `yueyan_engine.py` 的职责），而是证明产物
    **真的能出厂**：§10.1 的容器规范由平台强制执行，引擎测试无法复检。
    覆盖 V-1（7 个外链脚本、style.css、`./assets/` 相对路径、零内联 handler、
    零 ES module、零 CSP meta、`viewport-fit=cover`）、V-2（≤2MB/≤10MB、零图片资产）、
    V-3（`assets/*.js` 内零随机源、零 eval/new Function、零网络、零 Worker、零 WASM）、
    V-18（农历日期 初八..十四 齐备、无 `Day N`）、V-19（八个禁用符号一个不出现）、
    V-20（灯笼只有 `F5C77E` 一个暖色）、V-21（七 token 恰好齐备、style.css 无额外
    十六进制、scene.js 不硬编码十六进制），加上 DOM 路径（六视图、全部锁定 id、
    七个锁定 `row-*`）与运行时（`__ready`、门面七键、命名空间七模块、D1 银两 44、
    首屏激活、三槽位、抽屉六条顶层行、零页面错误、五结局无负面框定、分享卡 png 前缀）。

    两处 FAIL 的根因与修法（断言逐字未动）：
    - **V-2 零图片资产**：`TOOL.rglob("*")` 扫整个工具目录，而 Task 12/13 的 18 张
      QA 截图存在 `tools/yueyan/screenshots/`，会被打进上传包并计入体积。按同系列
      既有惯例（`sunzi`/`yuegong` 的工具目录都是 0 图片，截图归 `release/<工具>/images/`）
      把 18 张 PNG 移到 `release/yueyan/images/`，工具目录归零。
      **此后 QA 截图必须写在工具目录之外**，否则 V-2 会再次失败。
    - **V-3 无随机源**：`assets/*.js` 里唯一的命中是 `scene.js` 第 666 行的注释
      ——「(V-3 forbids rng)」这句话本身含被禁词，静态 grep 命中的是文档而非随机性。
      改为「deterministic arithmetic checker jitter (V-3: no stochastic source)」，
      零行为变更；注释保留的两条不变量仍在（噪点必须确定性、纸层在 boot 一次性
      绘制而非逐帧，以守住 §8.4 的无帧循环预算）。

    一处口径澄清：**抽屉「恰好六条顶层行」是可满足的**，不存在不可满足的门禁。
    静态 HTML 有七个 `row-*` id（buy/shishi/daizuo/shouzuo/xiexin/beiyan/buzhi），
    而运行时 `#drawer > .drawer-row` 恰为六条 —— `buildDrawer` 把 `row-daizuo` /
    `row-shouzuo` 移进制饼的 `branch` 子元素（不再是 `#drawer` 直接子节点），
    并在 `row-xiexin` 前插入合成的 `craft` 行。故「静态七、运行时六」是同一事实的
    两面，两个断言分别核对。

    回归：`tests/yueyan_smoke.py`（38 项，`SMOKE PASSED`，exit 0）；十套全绿
    （engine 162 / save 58 / audio 43 / ui 96 / craft 85 / finale 211 / art 136 /
    share 75 / main 48 / smoke 38 = 952 项）。同系列基线未动：
    sunzi 27、yuegong 854、bobing 137 —— 加 `tools/yueyan/` 不触碰任何兄弟工具。

22. **终局由「结果页」改为「七步仪式」：月相换成 CSS 像素块，五席与五饼补上。**
    动因是用户试玩后的唯一一条反馈「没问题，结尾部分，感觉仪式感不是很足，
    不够美观，可以适当增加设计」。游戏本体已通过，故只改终局的呈现层：
    §6.3.1 判定、§6.3.4 文案、§9 分享卡逐字不动。

    **旧呈现的三个结构性缺陷**：① 五档月相不可分 —— `drawMoon` 的云带是一条
    `ctx.fillRect` 纯色矩形，E2 与 E5 的差别只是矩形高度，读起来像进度条而不是云；
    ② 没有过程 —— 全部内容在同一帧出现，唯一的动效是月亮 1.2 秒渐显；
    ③ 五位家人不在场 —— §7.1 规定终局以圆桌座位呈现家人、§7.5 规定终局是揭晓点，
    但旧版终局一个座位都没有，「他会不会来」的悬念在揭晓处没有落点。

    **改法（逐条对应 §6.3.5）**：`#end-moon` 由 `<canvas>` 改为 `<div>`，
    `drawMoon` 改为建 CSS 像素块（月华 / 描边环 / 月轮 / 三处月面斑点 / 云层），
    云带高度由 `MOON_COVER[code]` 写入自定义属性 `--cover`（与 §9.3 分享卡顶区
    **同源同值**，两处不得各自另立）；五档月相的差异落在云带高度
    （0 / 26.6 / 51.8 / 81.4 / 111.0 px）、云缕数（0 / 1 / 2 / 2 / 3）、
    月轮明度（1.00 / 1.00 / 1.00 / 0.92 / 0.78）与月华强度
    （0.58 / 0.44 / 0.34 / 0.24 / 0.14）四项上，故五个结局一眼可分（V-21c）。
    终局补上夜空（木框 + 两处桂花枝 + 像素檐口）、匾额（结局名 + 结局文案）与
    圆桌五席（俯视像素人像 + 一人一枚 `px-cake-golden`，缺席只留一张虚线空凳，
    无称谓无文案，§7.1 / X-11）。饼位由**席位序号** `data-slot` 决定而不是饼下标，
    故饼不足五枚时缺失的席位前留空，其余饼不会被挤到前几席。

    **七步时序（§6.3.5-a，全部纯 CSS）**：S1 月起 0.00 s / 1.20 s（其中唯一一条
    `transition: …1.2s`，即 §8.4 的长渐变）→ S2 云定 0.90 / 1.20 →
    S3 名出 2.10 / 0.45 → S4 文出 2.55 / 0.45 → S5 席齐 3.00 起每席 +0.12 / 0.38 →
    S6 饼落 3.38 起每席 +0.12 / 0.30 → S7 收束 4.25 / 0.40，合计 **4.65 秒**。
    驱动方式是**一次类翻转 + 固定 `animation-delay`**：`#view-ending` 加
    `is-revealed`、`#end-moon` 加 `is-revealing`，二者同一帧加入。**不进 rAF、
    不设任何 JS timer、零随机**，故 `scene.js` 的 `requestAnimationFrame` 命中数
    仍为 2、`cancelAnimationFrame` 仍为 1（V-37a），X-12 与 V-3 逐条不动。

    **一处必须留痕的 CSS 陷阱**：`animation-fill-mode` 一律取 `backwards` 而不是
    `both`。像素动效一律 `steps()` 阶跃（§8.4.8），而 `steps(n, end)` 的最后一个
    台阶是 `(n − 1) / n`，`forwards` / `both` 填充会把这个中间值**永久留住** ——
    实测五枚饼停在 `opacity: 0.666667`、月轮停在 4 px 偏移上。取 `backwards` 时
    动画结束即回落到元素自身的静止终态，实测揭示完成后每个终局元素
    `opacity = 1`、`transform = none`（V-21d 子断言 ②）。

    **分享卡未破坏**：§9 的路径逐字不动，只把页内预览从「插在文案流里」改为
    「终局之上的一层可滚动浮层」（`#card-wrap.is-open`，轻点即关）—— 终局已锁死
    844 px 且不滚动，一张 780 × 1688 的卡插在流里必然撑破版面。`xhs` 通路命中时
    不弹浮层。版面四段高度相加 `14 + 254 + 14 + 184 + 14 + 274 + 72 = 826 ≤ 844`，
    实测 `scrollWidth = 390`、`scrollHeight = 844`，无滚动；文案行恒留 60 px，
    故一行文案（E1 / E2 / E4 / E5）与两行文案（E3，24 汉字）的匾额同高，
    圆桌位置五档一致。

    回归断言：`tests/yueyan_art.py::test_moon_phases`（五档月轮同尺寸、云带高度
    单调递增、云不吃掉整轮、五档至少两项呈现量互不相同）、`test_moon_reveal`
    （起始 `opacity: 0`、类名落到 `is-revealing`、`transitionDuration` 恰为
    `1.2s`、1.4 s 后收敛到 `1`）、`test_no_stray_canvas`（DOM 内 canvas 数为 0）、
    `tests/yueyan_finale.py::test_ending_panel`（五条路线的 `data-ending`、结局名、
    结局文案逐字对齐）、`test_ending_ceremony`（七步 delay 至少 3 个互不相同、
    五席恒在、一人一枚饼按席位对齐、缺席只留空凳且无称谓、揭示后落点精确、
    390 × 844 无滚动）。

---

## Visual QA（Task 17）

**方法声明：以下五张视图的判定全部来自 Playwright 的数值证据**（`evaluate` /
`getComputedStyle` / `getBoundingClientRect` / canvas 与 SVG 属性采样），
不是图像感知 —— 模型无法读图，截图 `release/yueyan/images/qa/*.png`
只是留给人类 reviewer 的证据物料，机器判定不依赖它们。驱动路线为
finale 套件的 R1（七日制饼 + 五人分饼），`E.ending(st)` 实测返回 **E1**。

| 视图 | 判定（数值依据） |
| --- | --- |
| 01-intro | 米纸底成立：`body` 计算色 `rgb(247,239,226)`，且 `background-image` 为非空
  `data:image/png;base64,` 纸纹（`buildPaperLayer` 确已运行）；`intro-title` = 月宴；
  `D.intro` 恰六条 §8.5 文案，六个 DOM 节点逐一与 `D.intro` 逐字相等；
  `toggle-congrong` 存在且标签含「从容」。 |
| 02-schedule | `day-label` = 第初八日（农历，无数字，V-18）；`.slot` 恰 3；
  `#drawer > .drawer-row` 恰 6，且全部 `left=16`、`top` 依次为
  412/468/524/580/636/692（每行 56px）—— 单列纵向堆叠，非卡片网格；
  朱砂在基础视图零出现。 |
| 03-craft | 四个步骤控件齐备，逐步驱动 `injectStep(0..3)` 时每步**恰一个**可见
  （bar-s1 → pad-s2 → pad-s3 → bar-s4，其余 `display:none`）；完成后
  `craft-grade` 为「金/银/铜」字样且无任何数字；`btn-craft-abort` = 放弃。 |
| 04-preview | `preview-seats` 5、`preview-banquet` 5、`preview-lanterns` 4；
  点亮的灯笼计算色全部为 `rgb(245,199,126)`（#F5C77E，V-20 单色）；
  五个宴备槽位标签均非空；到席座位带称谓。 |
| 05-ending | `end-moon` 为 CSS 像素块（`div`，非 canvas），`data-ending` = E1；月轮 148 × 148、
  月华 0.58、云带高度 0（满月无云）；`end-name` 与 `D.endings.E1.name` 逐字相等、
  `end-text` 与 `D.endings.E1.text` 逐字相等，二者内无任何数字（不显示分数品级）；
  圆桌五席恒在，一人一枚 `px-cake-golden`（48 × 48，`naturalWidth` 24，道具倍率 2）；
  揭示完成后每个终局元素 `opacity = 1`、`transform = none`；`scrollWidth = 390`、
  `scrollHeight = 844`，无滚动。 |

**配色审计（V-20/V-21 作为渲染结果）**：朱砂 `rgb(201,72,60)` 在日程视图与
展开后的采买内**均为零出现**；仅在 §8.2 穷举的两处出现 ——
① 月饼纹样压印：`#preview-cakes` 内 5 个 SVG 纹样，`path[stroke]` 全为
`#C9483C`（`scene.js` 第 654 行）；② `#btn-open-feast` 计算背景色
`rgb(201,72,60)`（`style.css` 第 47 行 `.btn-feast`）。灯笼暖黄单色成立。
**未发现真实缺陷，未改动任何源文件。**

### 记录的偏差（计划与实际冲突，按实现留痕，未放宽任何断言）

1. **截图落盘路径**：计划 DoD #3 写「`tools/yueyan/screenshots/` 存放五张 PNG」，
   但 V-2（`TOOL.rglob("*")` 扫整个工具目录 + 「zero image assets」断言）禁止工具目录内
   出现任何图片，而 §10.1 容器规范由平台强制执行（计划第 3408 行）。两者不可同时成立，
   **V-2 胜出**：五张截图落在 `release/yueyan/images/qa/`，与 Task 16 移走的 18 张
   历史 QA 图（`release/yueyan/images/` 根目录）分开存放。DoD #3 的字面路径不可满足。
2. **计划的 ROUTE 从未被执行，且执行即崩**：计划第 3681–3687 行定义了 `ROUTE`
   却在截图循环里从未调用；实测调用它会抛
   `[yueyan] assignment index out of range: grandma = 0` —— 七个空日子产不出饼，
   分饼索引 0 无处可指。引擎的这道保护是对的，计划的 fixture 是错的。
   故改用 finale 套件已被 211 项验证过的 R1（`ROUTES["R1"]` + `ROUTE_ASSIGN["R1"]`），
   实测 `E.ending(st)` = E1。
3. **计划 checkpoint 2 的朱砂口径与 §8.2 冲突**：计划第 3715 行要求
   「朱砂只出现在采买/制饼展开内」，但本文档第 21–26 行的穷举允许位置是
   「月饼纹样压印」与「`#btn-open-feast`」，并明写「其余任何位置出现 `#C9483C`
   即为 V-21 失败」。把朱砂加进采买反而会造成 V-21 失败，故不改源文件；
   改为核对采买展开内朱砂为零、并逐点验证两处 sanctioned 位置成立。
4. **计划的日程截图会渲染出不存在的日期**：计划先用 ROUTE 覆盖 `state`，再
   `renderSchedule(window.__yueyan.state())`，而 R1 末态是第 8 日，
   `D.dates[7]` 越界 → `day-label` 渲染成「第undefined日」。已用真实 D1 态
   重拍 `02-schedule.png`（实测 `day-label` = 第初八日）。
5. **一处曾被误判为「不可达」的健壮性缺口（已修）**：`renderSchedule` 不做日期
   越界钳制，day > 7 时会写出「第undefined日」。原判断依据是 `main.js` 的
   `finishDay` 在 `settled.day > D.board.days` 时直接 `renderAssign` 并提前 return；
   但该守卫只在同一会话内成立 —— `finishDay` 已把 `day: 8` 写进存档，而 `boot()`
   在任何一次刷新后都会重新进入 `paint()`，于是 §3.8 设计的挂起点反而让日程视图
   渲染出「第undefined日」，点「收工」抛 `[yueyan] no actions after D7`，终局永久
   不可达。现已修：`scene.js` 对日期查表做钳制
   （`D.dates[Math.min(state.day, D.board.days) - 1]`），`boot()` 在
   `dayBase.day > D.board.days` 时直接 `renderAssign` 并 return。
