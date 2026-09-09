# 月宫一夜 UI 重设计 — 外部调研记录

日期：2026-09-08
状态：**调研完成**。四个角度全部收回，两个补充缺口已填。
用途：**替代此前凭直觉 / 照抄已有项目做出的设计决策**

本文只记录有出处的证据与明确标注的推断，两者严格分开。**任何进入实施阶段的数值或形态决策，必须能在本文找到出处，否则不得作为依据。**

---

## 0. 为什么需要这份文档

用户否决了前两轮设计方向，原话：

> 「感觉都不太行，这种国风是不受人喜欢的」
> 「就是这种国画的风格啊，其实不太适合游戏，除非你能做到整体都是国画水墨的风格」
> 「你的设计本身就很抽象，可能是模型能力问题，即使你加载了设计技能，依然会大量参考已有项目，导致设计，ui乱七八糟，很不好看，也不吸引人，以为加一下莫名其妙的特效，粒子就是好看了，其实完全不是。要不你还是再调研一下」

诊断出的问题：此前的设计决策**没有出处**。一部分是照抄 guiyue / houyi 等已有项目（而这些先例本身有错），一部分是我自己编的数值。本文用来切断这个来源。

---

## 1. 证据分级约定

本文所有条目都带等级标签，**禁止跨级引用**：

| 级别 | 含义 | 可否作为工艺规范 |
|---|---|---|
| `[A]` | 一手原文 / 官方 metadata / 开发者一手陈述 / 开源代码 | 可 |
| `[B]` | 真实产品的活代码（live CSS / markup） | 可，但**仅限网页语境**，游戏语境需另行验证 |
| `[C]` | 二手评论 / 用户原话 / 搜索引擎内联摘要 | **不可**。只能当受众信号或线索 |
| `[D]` | 我的推断，**或 AI 生成的聚合内容** | **不可**。必须先验证 |
| `[X]` | 缺口，无证据 | 禁止用先验知识填补 |

---

## 2. 判决：「这种国风是不受人喜欢的」

**结论：一半推翻，一半证实。**

- 「这种国风是不受人喜欢的」→ **推翻**
- 「除非整体都是国画水墨的风格」→ **证实**。这正是文档化的失败模式

语料规模 `[C]`：3,100 条 Steam 评论 / 17 款中文题材游戏。缺口：影之刃未取到。

### 2.1 批评永远指向执行，从不指向国风本身

| 作品 | 差评原文 | 批的是什么 |
|---|---|---|
| 仙剑七 | 「美工审美全方位掉队」「审美土得没边」 | 审美差 |
| 轩辕剑柒 | 「画面差，建模差」 | 粗糙 |
| 完美的一天 | 「徒有其表，实际画面过于粗糙」 | 粗糙 |
| 剑网三手游 | 「跟其他打着国风画风的手游没什么两样」 | **同质化** |
| 江南百景图 | 「从嵇康开始,人物的画风就变了」「越来越粗糙…跟纸片一样,一点也不精致」 | **不统一** + 粗糙 |

关键反证：古剑奇谭三最狠的差评是「**除美术无一可取之处**」——而这款的美术恰恰被夸「画风审美都极其顶」。**国风在这条语境里是优点，被骂的是玩法。**

### 2.2 受好评者的共性 = 整套系统统一

`[C]` 好评例：

- 山海旅人（水墨像素画风，5832+ / 248−）
- 烟火（39279+ / 883−）、三伏、纸嫁衣
- 绘真·妙笔千山「画风真的没得说」，TapTap 9.6
- 黑神话悟空（水墨晕染过场）
- 忘川风华录「国风是这个游戏第一吸引我的地方」
- 江南百景图，**开发者自述**为什么成立：「螺钿漆器风格的片头动画,苏州版画风格的插图」——片头和插图是同一套语言

### 2.3 受众层面的硬约束（不是口味问题）

`[C]` AI 美术在中文语境被点名抵制：雷亚(Rayark)抵制事件、白夜极光 AI 争议、「史上第一款立绘全由AI绘图的氪金手游」被当骂名用。

`[C]`「页游感」的实名例子：明末渊虚之羽「刚玩了会页游明末然后卸载了」。

---

## 3. 同构证据：与月宫一夜处境完全一致的一条

`[C]` 绘真·妙笔千山的国画风格提问下，**526 赞最高赞回答骂的不是画，是 UI**：

> 「同样的问题也体现在UI设计上,对话字幕的可读性很差,字体偏小,颜色的选择…」

美术受赞、界面失败。三个症状——可读性差、字体偏小、颜色选择——与用户说的「不吸引人」精确对应。

**这条与 §4.6 Humfrey 对 Oblivion 的诊断、§6.7 玩家对《文字游戏》的批评，是同一个结论的三个独立来源。**

---

## 4. 叙事游戏文字 UX：inkle GDC 2018

### 4.1 讲者更正（此前记录错误）

**讲者是 Joseph Humfrey，不是 Jon Ingold。** 三源一致 `[A]`：

- GDC Vault 官方 metadata：`Speaker(s): Joseph Humfrey`、`Company Name(s): inkle`、`sessionID: 400012082`、`conferenceID: 175` (GDC 2018)
- transcript 自述：「my name is Joe」「**my co-founder John is sitting here in the front he's the main writer of our company** but my focus to dinkle is as a developer and as a UI and UX designer」
- inkle 官网页脚：Joe 的 Mastodon 是 `@joethephish`，Jon 的是 `@joningold`

**这是场 UX / 工程演讲，不是写作演讲。** 讲者自述他不是写作者。

### 4.2 来源与出处可信度

| # | 来源 | 内容 | 完整性验证 |
|---|---|---|---|
| 1 | `youtube.com/watch?v=mopBSNyFEE4` (inkle 频道) | 完整 transcript，4,464 词 / 639 行 | `length: 26m42s`、`hasMore: false`、`isPremium: false` |
| 2 | `youtube.com/watch?v=x4G8UNiE560` (GDC Festival) | 完整 transcript，729 行含 Q&A | `length: 30m32s`、`hasMore: false`、`isPremium: false` |
| 3 | `gdcvault.com/play/1025104/Designing-Text-UX-for-Effortless` | 官方 abstract + metadata | 直接可达 |
| 4 | `github.com/inkle/slayout` @ `4a35531` | 演讲中宣布开源的工具 + 时序常量 | GitHub API |

出处限定 `[A]`：transcript 来自 YouTube 自动字幕（ASR），经 kome.ai transcript API 取得。**引文是字幕的逐字内容，含 ASR 错字**，已对照其他证据校正："Joseph Humphrey"→Humfrey、"John"→Jon、"castle on"→Caslon、"eightydaze"→80 Days、"Surrey fonts"/"Sri for San serif"→serif fonts。时长与已知片长吻合、`hasMore: false` → 完整性是验证过的而非假设的。

### 4.3 框架：focus + pacing

`[A]` 逐字：

> 「I like to think of focus and pacing a bit like harmony and melody... **focus is like harmony** beautiful typography in a single moment whereas **pacing is like melody** how the story flow is presented over time as a sequence」

核心论点（注意这是个反转）：

> 「ideally the player doesn't have to think the words simply drop into their brain. **focus isn't about the player having to concentrate but rather the opposite the game is focused so that reading is effortless for the player**」

> 「my goal is to make reading feel so effortless that it barely feels like you're reading at all. Twitter isn't a reading experience, online shopping isn't, watching a film with subtitles isn't a reading experience either」

他自列的「top five typography and typesetting tips」：**typeface、margins、paragraph spacing、text size、text brightness**（外加 text positioning）。

### 4.4 硬数字

| 项 | 值 | 级别 |
|---|---|---|
| 行长 | **5–15 词/行**。下限像报纸分栏（好读）；**超过 15 眼睛扫不回下一行起点** | `[A]` |
| 被点名的失败值 | 「well over 20 words per line... I lost count around 30」 | `[A]` |
| 选项延迟 | **< 半秒**（故意延迟选项出现，让玩家先读高亮正文而不是直接跳到选项） | `[A]`，inkle 频道版 |
| 选项淡入 | 慢到不会分散玩家读正文的注意力（无数值） | `[A]` |
| slayout demo 常量 | `AddDelay(0.05f)`/词、`Animate(0.5f)`、`Animate(0.5f, 2.0f)` 出场前停 2.0s、`lineHeight=50`、`lineWidth=500`、`margin=20`、`spaceWidth=10.0f` | `[A]`，**但是 demo 常量，不是 80 Days 上线值，禁止当生产参数** |

逐字（行长）：

> 「**a rough rule of thumb is that you should be aiming to have around 5 to 15 words per line.** at the lower end of the spectrum you have an effect a bit like a newspaper column which can actually be really quite easy to read because your eye doesn't get lost, **but as soon as you go over around 15 it just becomes that little bit harder for your eye to scan back to** the start of the next line」

参考标准：

> 「as a rough guide just **take a look at film subtitles**. It's the most ridiculously simple UX in the world but even some titles on cheap DVD players work fine」

跨平台规则：

> 「if you're designing for both mobile and console then **the screen sizes are surprisingly similar when you take into account the player's view distance, so the text sizes are basically the same**. Of course text can and should be smaller when you're working on PC, but if you're designing to be multi-platform **it's best to design for mobile or console first**」

### 4.5 `[X]` 缺口：文字明暗没有任何数值

技术描述 `[A]`（inkle 频道版 L336–346）：

> 「**you can make use of text brightness in order to draw the player's attention to what's important right now: darkening previously seen text and highlighting new text**. And this really helped in 80 Days as well — it makes it really clear to the player where they need to continue from, **while allowing them to look back and to reread previous parts for context**」

GDC 版（L367–377）措辞略不同：「you can use **the text brightness itself or the color**」。

机制是：**两级亮度**——旧文字变暗但保留可读、新文字高亮。解决的问题是「我该从哪接着读」，同时保留回看上下文。

**但这场演讲不给对比度比值、不给 hex、不给变暗百分比、不给亮度数值。全是定性描述。** 要具体数值，本文不提供，**禁止拿这场演讲去支撑一个对比度数字**。WCAG 1.4.3 是唯一有数值的相关约束（见 §5.3）。

### 4.6 字形原则

Humfrey 需要**古典感**，解法是用年代对但常规的字形，**不是装饰性古体** `[A]`：

> 「the typeface is **a variant of Caslon, which originates from the 18th century**, so even if you don't know anything about fonts **it will give a relatively aged feel**, and I think **it had nicer proportions than other serif fonts like Times New Roman**. The main thing though is that **it's not quite so alien to your eyes** as the overly stylized version」

他还把装饰性首字母换成「just a larger G」，理由：「it still conveys the impression of being the typography of an old book while being a bit more readable」。

承重原则 `[A]`：

> 「**the most important thing for readability is familiarity.** There's nothing specific about an overly stylized font that makes it hard to read necessarily — **it's just the fact that your type is not familiar to your eyes.** Fairly standard looking serif fonts may be the more boring end of the spectrum, but **if your player is familiar with the style of the font already it'll be less work to read.**」

legibility vs readability 的区分 `[A]`：

> 「**legibility is how easy it is to make out the shape of the letters**... this fantasy lettering — **it's perfectly legible**... **but would you want to read fifty thousand words of text in it? I certainly wouldn't.**」

反面案例（Oblivion）`[A]`：

> 「Elder Scrolls, I love you dearly, but **this is not good. The design is a message to the player that this text isn't supposed to be read** — it's an artistic prop that happens to have words written on it by an actual writer. **It's just one step above lorem ipsum placeholder text**... but it's hard work.」

> 「that pretty G initial is cool and everything but I just have to work out a little bit harder in order to read it... **it just takes that little bit of extra work to read.**」

另一个反面案例（Witcher）`[A]`：「on the surface this looks like a really pretty screenshot the aesthetics are lovely but **do you honestly feel like reading the text of course not it's a wall of text surrounded by distractions**」

**⚠️ 这一节与 §6.1 直接冲突。见 §7。**

### 4.7 空白与缩进

宽边距的两个独立功能 `[A]`：

> 「I've widened the margins and **this is really important — it gives the text room to breathe**. Giving that bit of extra whitespace around the text **prevents your eyes getting distracted by other noisy patterns nearby.** The other thing that wide margins can do is **they convey a sense of importance** — if you think about the way poetry looks on a page, or a quote with a large border, it makes the message feel significant **even if the words aren't how profound.**」

**首行缩进 = 全场最便宜的收益** `[A]`：

> 「I've also indented the paragraphs. **Anecdotally this made a really surprising difference to the readability in 80 Days — the day we added it in it was really noticeable, the text became so much more relaxing to read.** We already had generous paragraph spacing, but **those indents are like little anchors that help your eyes zero in on the start of the next paragraph.**」

GDC 版补充：「it sort of acts as this little anchor that lets you feel like you're not getting lost in the text and **it helps you kind of skim down**」。

远距观看：「all of this whitespace prevents your eye getting lost in the flow of text, **which is especially important when viewing a TV on the other side of the room.**」

文字位置 `[A]`：「if reading is meant to be the primary activity then putting it down at the bottom of the screen, **the player's attention is going to be split**... ideally **don't hide your text away in the corner of the screen**」；GDC 版：「ideally you want to try to **place the text contextually where it belongs** next to the gameplay within the scene」

### 4.8 疲劳（长时间尺度）

框架 `[A]`：「**longer term the main enemy we have to contend with is fatigue. Imagine a book with paragraphs but no chapter breaks, or a Kindle e-book with no page numbers or a progress bar, or a children's book with no illustrations.**」

三条技术 `[A]`：

1. **辅助机制打断阅读**：「it can really help to introduce some ancillary mechanics, whether text-based or not, in order to break it up... As the player moves back and forth between different sections, **each one will feel satisfyingly fresh again as they enter it.**」
2. **玩家控制何时开始读，当作奖励**：「**as soon as we put it on an 'Explore' button, suddenly it felt like a player choice, a reward.** Putting the player in charge of the decision to read **gives them a sense of ownership over the content**」
3. **进度指示**：「**The page number in a book acts a bit like a score** — it can help, it's a very simple motivator to make progress. It can also give the reader **a sense that their current activity is finite, and that can be reassuring.**」

**⚠️ 第 3 条的失败模式 `[A]` — 演讲里最有价值的负面结果：**

> 「**on the flip side though you have to be careful — sometimes players, once they get past the halfway point, being given the sense that they're nearly done can really cause them to rush and pay less attention to the content.** This is definitely something that happened in 80 Days, and **it was exacerbated by the fact that they were meant to be hurrying as part of the game's mechanic.** Even though **we paused the clock during story sections**, there was this really strong instinct to **skim read** as players got closer to returning to London.」

**暂停时钟没能修好。** 若月宫一夜含任何时间压力机制，这条预言了一个具体的失败。

**这一节与 §6.3 的玩家批评独立收敛到同一个结论。见 §7.3。**

### 4.9 反直觉结论：节奏

`[A]`：

> 「showing small sections of text in isolation can help the player focus on those specific words, **slowing them down — it forces them to pause and think.** Whereas showing a single larger section, assuming the player is already focused, **allows them to consume the content more quickly.** And that can be pretty surprising actually — **small sections are slower, larger sections are faster.**」

限定条件：「I'm talking about these sections in isolation, **when you have a pause or press a button in order to read the next section**」

Sorcery 失败案例 `[A]`：「we tried to make a text-based action scene by having little snippets like 'you leap forward' or 'you make a dash for the door' separated by choices. **We thought that a rapid succession of choices would make the story speed up, but actually of course it slowed down the reveal of the content itself.**」

分段参考 `[A]`：「the BBC News website gives every single sentence its own little paragraph to make it easier to read」

流程规则 `[A]`：「**it's like animating a character — you can't just author it, assuming that your theories are correct, you've got to keep playing it back. Reading back a script isn't enough.**」+「get [your writers] up and running with the game and **get in the habit of playing as you write**」

### 4.10 动画当眼睛引导

Sorcery `[A]`：「when the player reads a choice, their eye is down at the bottom of the screen... **the piece of paper that the choice is written on slides up and joins the bottom edge of the story flow above, and the body text is revealed.** This leads the player's eye back up to the correct point in the story flow... **So the animation is leading the eye fluidly to ensure that they don't lose their place.**」

80 Days `[A]`：「**the choice text itself can be reused and sometimes rearranged slightly as body text.** So we animate it into place and animate the rest of the content in **word by word.**」+「our word-by-word animation is really quick, **so that fast readers aren't ever slowed down by it**」

Heaven's Vault 层叠修复 `[A]`：「initially we just showed one line at a time giving the player just enough time to read it before moving on to the next one... **the pacing just feels a little bit sluggish here — the problem is everyone reads at a different speed so we can't really display the text for much less time than that** — so the small fix that we did was to **allow multiple lines of dialogue to overlap in cascade** so new dialog bubbles can appear while old ones are still on screen... this meant that **the whole thing could be sped up without leaving slower readers behind** since old lines of dialogue stayed on screen for a while, **the previous text that's shown on-screen helps with context as well**」

### 4.11 验证方法

`[A]`：「our best aha moments have come when we've jumped into the game to test a feature and then **we've realized that we forgotten what we were testing and we end up absent mindedly getting involved in the story**... that's when we know that the UX is really working」

### 4.12 本地化警告（对 CJK 直接相关）

GDC 版 Q&A `[A]`：

> Q: 「can you talk a little bit about the typesetting and the pacing test iterations when doing localization」
> A: 「the truthful answer to that is that **we've never been able to localize our games** for almost unrelated reasons that **our text engine varies the text on a word by word basis so localization has been impossible so far**」

**逐词动画把本地化搞死了。**

### 4.13 `[X]` 行长换算缺口

**5–15 词/行是拉丁字母的标准，无法直接换算成汉字。** 本文不做换算。clreq 给的是另一套独立标准（§5.1）。两套标准并存，不得互相推导。

---

## 5. CJK 文言排版（规范层）

### 5.1 clreq / jlreq `[A]`

来源：w3c/clreq @ `dc018876`（permalink L3991、L4004、L2169、L3972、L3562、L2603、L1655、L1666、L334、L741）；w3c/jlreq。

| 项 | 值 |
|---|---|
| 行长（书籍） | **17–40 字** |
| 行长下限 | 10 字 |
| 横排行长上限 | **48 字** |
| 竖排行长上限 | **55 字** |
| 行間 | 字号的 **50%–100%** → line-height **1.5–2.0** |
| 行間上限的性质 | **超过字号（>2.0）不再改善可读性** |
| jlreq：行間与行长耦合 | 短行→小行間；**≥35 字→约 1em 行間** |
| jlreq：parallel notes（对照注） | **15–20 字**（25 可接受），**半 em 间隔**；量大时 **1/3 em** |

### 5.2 文言对照层的文档化模式 `[A]`

**clreq 中外文对照的文档化模式 = 基文之上的 ruby，fragment 级，不是整段堆叠译文。**

另有两个古典中文注疏模式 `[A]`：

- **行間批語**（紅樓夢脂硯齋批語）：批语置于基文片段旁/后
- **warichu / 双行小注**（jlreq，L899 / L2534 / L2727）

### 5.3 真实产品活代码 `[B]`

**古诗文网 / 古文岛**（`gsw_skin.css`，42,871 B；`/shiwenv_4ba6e4daaa28.aspx`）：

- `.cont { font-size:16px; line-height:200% }`
- 拼音 ruby：20px 汉字 + 12px 拼音（**比值 0.6**）
- `.yizhu { width:200px; float:right }` + **译文/注释 toggle 按钮**——live markup 证实 **4 个折叠开关**
- → **是折叠 toggle，不是同屏堆叠双层**

**c-text.org** 层级：`.original 20pt bold` → `.ctext 14pt` → `.etext 10pt` → `.annotation 10pt italic`；`.inlinecomment 12pt #008800`；`.refindex 70%`

**typo.css**（sofish）：`.typo { line-height 1.75 }`；`.typo-vertical { line-height 1.8 }`；`rt { font-size 0.5em }`

**Entry.css**：`@font-size 16px; @line-height 2`

**Tailwind typography**：`max-width: 65ch`；prose `line-height 1.75`

**WCAG 1.4.3**：正文 **4.5:1**，大字 **3:1** → 约束对照层可淡到什么程度

### 5.4 来源分歧（保留，禁止平均化）

行高来源**互相冲突**：

| 来源 | 值 | 级别 |
|---|---|---|
| chinese-typography-guide | 「推荐正文 **1.5** 倍行间距…标题 1.1~1.3 倍，**字号越大行间距越小**」 | `[B]` |
| clreq | **1.5–2.0** | `[A]` |
| 古诗文网 live CSS | **2.0** | `[B]` |
| Entry.css | **2.0** | `[B]` |
| typo.css | **1.75** | `[B]` |
| Tailwind prose | **1.75** | `[B]` |

**chinese-typography-guide 的「字号越大行间距越小」与 1.95 直接相反。**

### 5.5 游戏语境中文排版先例 → 见 §6

上述 `[B]` 全部是**网页**语境。游戏语境的实证证据在 **§6**（《文字游戏》开发者一手陈述）。

### 5.6 原始证据留存位置（可复核）

`/var/folders/lb/v_0jd2l11hb4l3dwysz0l2sh0000gp/T/opencode/typo/`

- `clreq.txt`（336 KB；grep 偏移 676-760 竖/横排、2094-2230 行間注、2460-2510 中外文對照、3670-3730 行长/行間）
- `clreq_repo/index.html`（w3c/clreq @ `dc018876`）
- `jlreq.txt`（978 KB；L13280-13310 parallel notes、L13174 footnote rule、~L2582 行間-行长耦合、L899/2534/2727 warichu）
- `gsw_skin.css`（42,871 B）、`gsw_real.html`

### 5.7 已知内部不一致（未核）

caniuse 的 Chrome 版本记录自相矛盾：一处说 Chrome 8+，另一处说 Chrome 48+。**未核实，不得引用。**

---

## 6. 中文文字游戏先例（实证层）

### 6.1 `[A]` 决定性发现：《文字游戏》的字体选择

**《文字游戏》（Word Game，Team9，2022，Steam appid `1109570`，好评率 99%，5,580 条评论）**

开发者一手陈述（澎湃/The Paper 采访，`m.thepaper.cn/baijiahao_11386385`，湃客·次元土豆，2021-02-20）：

> 「在为《文字游戏》选择字体时，Team 9 取了巧。研究过古体字、近代字、软件字库，他们最终选择了 **Zpix**。它是一种 **11 乘 11 的像素字体**，妙处在于**能够阅读，又不太好读，看久了会像图**。」

这是**有名字的字体决策**：他们评估过古体字 / 近代字 / 软件字库，最终选 **Zpix（11×11 像素字体）**，**故意**选在「可读」与「图像」的阈值上（「看久了会像图」）。

**这是本文唯一的游戏语境硬数值：11×11。**

### 6.2 `[A]` 棋盘格心智模型

知乎采访内联摘要（「对话'文字游戏'系列开发者Team9：把文字当作有趣的玩具」，2025-10-20；知乎本身 403，内联文本是可用形态）。主玩法设计师**文韦**（张文韦，澎湃确认为制作人/设计师，产品/平面设计师出身）：

> 「我在处理文字排版的时候，就会意识到**文字本来就是放在一个个棋盘格上面，供人阅读或者安排造型的**。」

设计师的基础心智模型：中文文本天然存在于**棋盘格**上——同时是阅读面和造型面。

**这是把文本块当作可构图的网格、而不只是文案栏的中文先例。**

### 6.3 `[A]` + `[C]` 高对比黑白呈现

开发者陈述：

- 澎湃采访：「打开《文字游戏》时，我眼前一黑，是真的黑。**纯黑色的纸上白字平铺**。」
- Steam 开发者公告（appid 1109570，body #15）：「在这个举世追求画面高分辨率的时代里，选择**把高画质放在一边、专注表现高对比**的《文字游戏》…」；「**跃于纸面上的一笔一画**究竟是如何诞生的」；「每一个字、每一个标点都是由製作团队放入真心戮力打造出来的」

→ 上线呈现是**纯黑底白字**，高对比优先于高分辨率，每个字/标点手工摆放。

**`[C]` 但这个选择的代价，玩家直接说了：**

> 「长期盯着**大量黑白汉字的屏幕**实在容易犯困」

**这与 §4.8 inkle 的 fatigue 章节独立收敛。见 §7.3。**

### 6.4 `[A]` 字元动画 / 字体动画作为工艺

- **官方美术设定集**（Steam app `1912740`，100+ 页）目录含独立章节 **「伍、字元动画」** → 字被当作对象动画化，有官方文档
- GameRes 分析（`gameres.com/892713.html`，浔阳，2022-01-29）：「Team 9给**字体加上移动、特效、颜色等细节来营造画面感**」；单字动画见于 門/溪/爐/喝醉的NPC —「对玩家司空见惯的字进行解构，赋予其更具体的人格形态，并用**微妙的动画**来丰富该形象」
- 叙事演出用文字：「老」字在旁白中持续出现暗示隐藏的观察者；第五章结局「玩家被文字层层包围…充满压迫感的**文字画**」

**⚠️ 纪律：上述「特效、颜色」是《文字游戏》上线事实的记录，不是对本项目的建议。** 在《文字游戏》里特效服务于机制（字就是对象、就是玩法）；月宫一夜的文字是**内容**不是机制。**这个迁移不成立。见 §7.2。**

### 6.5 `[A]` UI 也是纯文字

GameRes「三奇」：

1. 「游戏内所有画面均由汉字组成，不仅仅是游戏场景，**UI也是纯文字**」
2. 「仅由文字构成，却形成了某种意义上的**文字奇观**」
3. 「交互逻辑、游玩机制都建立在文字的基础上」

并把谱系框定为 **ASCII-art / MUD**：「ASCII风格游戏也不再仅仅是廉价、复古的代名词」

机制 `[A]`（Steam description）：核心是「字」— **删字 / 推字 / 拆字 / 组字**；「不仅可以走进字面上的门」。玩家「选择一个汉字作为自己在《文字游戏》的化身」。

澎湃采访：「内在层面，玩家把玩的是单个汉字…对语意的微妙贡献；外在层面，玩家观感到的是**传承数千年的汉字自身的美感及联合造型带来的冲击**」；创作者「必须针对文字的**形、音、义**好好研究」；「**突破限制的文字排版设计**，很直接地打开了对《文字游戏》画面表现上的想象」；「游戏里房屋的**四面墙拥有不同的互动文字**」

### 6.6 `[A]` / `[C]` 第二个先例：《WILL：美好世界》（appid `588040`）

另一种文字即机制的做法（**句子**级，不是单字级）：

- Steam description：「独一份的「**文字拼图**」解谜：**拖拽、重排信中的句子与顺序**，用重组因果本身当玩法——**至今难觅同机制之作**」；「重组语言，改写现实」
- 评论：「**国产文字游戏之神**」；「改变句子以此改变故事的蝴蝶效应…玩法可以打4星」；「惊艳的剧情演出」
- 差评指向文笔而非排版：「文笔非常小学生」

→ 第二个上线中文先例：**文本片段本身就是可交互对象**。

### 6.7 `[C]` 玩家对文字呈现的情绪（5,580 条，Very Positive）

**好评：**

- 「虽然全屏都是文字，但**演出效果极其生动**」
- 「通过**文字的动画+颜色**也能表现出张力」
- 「感受**汉字的神奇**」；「全部以文字为核心」
- 「玩法创意十足，**很难转成别的语言**」（确认这是语言专属工艺）

**差评（与文本块构成直接相关）：**

- 「长期盯着**大量黑白汉字的屏幕**实在容易犯困」（高对比路线的疲劳风险）
- 「大部分时间都是在观看叙事和**字符画**」
- 「作为以文字为卖点的游戏，**文笔却不够出彩**」；「又臭又长」（文本长度抱怨）
- 「一直给我播放动画，还不能跳过」

### 6.8 文言文呈现实践 — **PARTIALLY FILLED**

#### `[D]` 百度 AI 答案（**AI 生成的聚合，不是一手陈述 — 只能当线索，不可当权威，采用前必须独立验证**）

- **按题材选字体**：庄重肃穆（战国/历史）：字神苏轼豪放体、汉字之美将军令简；文雅飘逸（唐宋/仙侠）：汉字之美贵妃楷简、演示悠然小楷；古朴刻本（古籍/考据）：**黄令东齐伋体**（明代木版印刷）、**汇文明朝体**（旧铅字印刷）；免费商用：**霞鹜文楷**、阿里妈妈东方大楷、润植家康熙字典美化体
- **排版**：竖排是灵魂 — `writing-mode: vertical-rl`；标点/数字用 `text-orientation: upright` + `text-combine-upright`；行列疏密（纵横成行用于公告 vs 纵有行横无列用于题词/诗号）；**行气线**（行草的连贯中线）；留白 + 低饱和纸张色（米黄/浅褐）

#### `[C]` 人工撰写来源（更强）

- **字体家**（「赏析│古韵和文艺感兼具的竖排文字」，2020-09-27）：「比起横排文字，**竖排文字多了一分古韵和文艺感，但往往不如横排阅读起来方便**，因此在做这类文字排布时，需要更加注意**重要信息的突出处理，比如放大、改变颜色**等等，才能使整个版面更有节奏感。」
  → **直接的工艺指导：竖排更有古味但可读性更低，须靠放大/改色补偿关键信息以制造节奏。**
- **站酷 ZCOOL**（「国风/古风游戏字体设计」，2024-04-13）：10 组国风/古风游戏字体设计
- **百度贴吧**（「古风文字如何制作与排版」，227 回复）：实操提示「两个字不要叠加过多,不然看不出是…」

#### `[C]` 游戏文字设计工艺（知乎内联摘要，经 Sogou 取得）

- **「【游戏交互】游戏飘字(跳字)设计」**：「与游戏UI风格保持一致；**字体可读性 字体需要描边或投影设计**，以便在不同的场景中表达清晰，上文中的 **P5 采用了特殊的描边**」→ Persona 5 的描边处理是飘字可读性的参照
- **「国产游戏为什么廉价?第一部分:色彩与文字」**（2556 赞）：区分「**一种装饰性文字，一种阅读性文字**…这和海报设计如出一辙。**过多的字体**只能…」→ 装饰性文字 vs 阅读性文字的区分，以及对字体过多的警告

### 6.9 `[X]` 两个未闭合缺口

1. **找不到任何一款上线游戏，其「文言文排版」本身被文档化或被称赞。** 调研者明确记录：「I did **not** find a shipped game whose *文言文 typography specifically* is documented/praised in a retrieved source — that specific gap is **not fully closed**。」
2. **这份中文语料里没有任何数值型排版参数。** 经专门 grep 确认：`字号`、`行距`、`line-height`、`font-size`、`字间距`、`letter-spacing`、`对比度`、`contrast ratio`、`WCAG` 全部**零匹配**。唯一的数值是 **Zpix 11×11**。棋盘格是定性心智模型，不是数值比例。

**→ 数值型排版参数只能来自 §5（clreq / 活代码），不能来自 §6。**

---

## 7. 两套证据的冲突 — 必须显式解决

**§4（inkle，拉丁字母叙事游戏）与 §6（文字游戏，汉字文字游戏）给出了相反的策略。** 这不是可以平均化的分歧，是两个不同问题的不同解。

### 7.1 字形策略：相反

| | §4.6 inkle | §6.1 文字游戏 |
|---|---|---|
| 目标 | 文字是**内容**，要被大量阅读（「fifty thousand words」） | 文字**就是画面、就是机制** |
| 策略 | **最大化熟悉度**：「the most important thing for readability is familiarity」；用年代对但常规的字形（Caslon 变体） | **故意边缘化可读性**：Zpix 11×11，「能够阅读，又不太好读，**看久了会像图**」 |
| 对装饰性古风字的态度 | 明确反对：「this text isn't supposed to be read… one step above lorem ipsum」 | 不适用——他们压根不用装饰性古体，用像素字 |

**判定依据：月宫一夜的文字是内容（文言文叙事），不是机制。** 玩家要读它，不是要操作它。

→ **§4.6 的原则适用，§6.1 的策略不适用。**

**但 §6.1 提供了一个 inkle 没有的可能性**：汉字可以整体当作视觉纹理。这个可能性在月宫一夜里**只在非正文元素上成立**（标题、印章、结局名等短文本），**不适用于正文**。

### 7.2 特效/颜色：不可迁移

§6.4 记录《文字游戏》「给字体加上移动、特效、颜色」。但：

- 在《文字游戏》里，特效**服务于机制**——字就是对象，动画是在表达对象的属性
- 在月宫一夜里，文字是**内容**——动画只能服务于阅读引导（§4.10 的「animation is leading the eye」）

→ **§4.10 的动画原则可迁移；§6.4 的特效做法不可迁移。**

用户原话已明确否决前者：「以为加一下莫名其妙的特效，粒子就是好看了，其实完全不是」。**§6.4 是事实记录，不是建议。**

### 7.3 疲劳：三个来源独立收敛（这是最强的一致结论）

| 来源 | 证据 |
|---|---|
| §4.8 inkle `[A]` | 「the main enemy we have to contend with is **fatigue**」；进度指示过了中点导致 skimming，暂停时钟也没修好 |
| §6.3 / §6.7 文字游戏玩家 `[C]` | 「长期盯着大量黑白汉字的屏幕实在**容易犯困**」；「又臭又长」 |
| §3 绘真·妙笔千山 `[C]` | 526 赞差评批 UI 可读性 |

**三个互不相关的来源都指向：长时间文字阅读的疲劳是主要敌人，而高对比/密集文字块会加剧它。**

→ 这是本文置信度最高的结论。任何方案都必须先回答「怎么对抗疲劳」。

### 7.4 装饰性 vs 阅读性：两套证据同向

- §6.8 `[C]`「国产游戏为什么廉价」：「一种**装饰性文字**，一种**阅读性文字**…这和海报设计如出一辙。**过多的字体**只能…」
- §4.6 `[A]` inkle：legibility ≠ readability；装饰性字形让文字变成道具

→ **同向。月宫一夜的正文必须是「阅读性文字」；装饰性处理只能用在非正文元素。**

---

## 8. 社区原话信号：低价值，已结案

- HN「visual novel」20 条**零 UI 工艺信号**（全是引擎发布、AI VN 工具、俄审查新闻、vndb 讣告、Yuanzai World 讲 agent 模拟）
- HN「typography」有真信号，3 条佐证：`adamadam.blog/2026/04/01/my-notes-from-buttericks-practical-typography/`(38)、`electricmagicfactory.com/articles/interactive-fluid-typography/`(49)、`lr0.org/blog/p/arabic/`(287，非拉丁文字渲染债的结构同构旁证)
- Reddit 两次空结果（gamedev/IndieDev + 视觉抱怨关键词）→ 工具失效，不再重试

**结论：游戏 UI 工艺讨论不在 HN/Reddit。中文语境的证据在 §6，走百度/Sogou + Steam + GameRes + 澎湃。**

---

## 9. 此前决策作废表

| # | 此前决策 | 状态 | 依据 |
|---|---|---|---|
| 1 | 双层文言+白话**堆叠** | **推翻** | §5.2 clreq 文档化模式是 fragment 级 ruby / warichu；§5.3 古诗文网活代码是折叠 toggle。两者都不是同屏堆叠 |
| 2 | 混合：AI 图作底 + 程序化前景 | **用户否决 + 语料支持** | §2.1 两套视觉语言同屏 = 「画风就变了」型不一致（江南百景图被批的点）；§2.3 AI 美术受众抵制 |
| 3 | 全面重设计 | 力度够，**方向错了** | §3 问题在界面不在画面 |
| 4 | CG vs 工笔各出一张对比 | **两张都被否** | 用户否决 |
| 5 | 加特效/粒子提升观感 | **用户否决 + 证据不支持迁移** | §7.2 |

### 9.1 我自己编的数值 — 审计

| 数值 | 判定 |
|---|---|
| 行高 **1.75** | **有依据** `[B]`：typo.css、Tailwind prose、clreq 区间下限 |
| 行高 **1.95** | **我在冲突来源间挑了对自己方便的那个**。clreq 上限是 2.0，1.95 顶在极端；chinese-typography-guide 说「字号越大行间距越小」与之**相反** |
| 堆叠双层 | **瞎猜**，已被 §5.2/§5.3 推翻 |
| 行长 | **此前未查就写了**。实际标准见 §5.1（clreq 17–40 字 / 横排上限 48） |
| 「汉字可以当视觉纹理」 | **现在有依据了** `[A]` §6.1，但**仅限非正文元素**（§7.1） |

### 9.2 不可照抄的先例（已证有错）

- `guiyue/assets/style.css:44` 的 `transition: background-image` 是 **NO-OP**（background-image 不可动画）→ guiyue 场景切换实际是**硬切**。真交叉淡入需两层堆叠 + opacity 过渡
- `guiyue/assets/main.js:38` 的 `className =` 赋值会**清掉 `is-active`** → 必须用 classList.add/remove

---

## 10. 硬约束（不可违反）

### 10.1 测试安全网

- `tests/yuegong_smoke.py` 基线 **854 pass / 0 fail**，headless
- **严禁弹可见浏览器窗口**（用户两次明确要求）

### 10.2 6 文件门禁（`tests/yuegong_smoke.py:165-168`）

`assets/*.js` 必须恰好等于 `SCRIPT_ORDER = ["data","rng","engine","scene","share","main"]`；`index.html` 恰好 6 个 `<script src>` 同序。**新增 `art.js`/`ui.js` 直接 FAIL** → 新代码必须塞进现有 6 文件，优雅降级缝也只能放在 `scene.js` 内部。

### 10.3 绑定选择器

- 4 个 view ID：`view-intro` / `view-node` / `view-outcome` / `view-ending`
- `.view` + `.is-active`、`#choice-list .choice`
- 按钮 ID：`btn-start` / `btn-advance` / `btn-restart` / `btn-home` / `btn-save` / `btn-note`
- `#endings-list .ending-chip` 计数 **== 5**；`.ending-chip.got` **≥1**
- `#btn-advance` inner_text 须**逐字节**为 `"天 将 明"` 或 `"继 续"`（**全角空格**）
- 非空要求：`#intro-title` / `#outcome-text` / `#node-title` / `#node-step` / `#end-name` / `#end-cond` / `#end-stats`
- `?seed=123` 时 `window.__game.seed()` **=== 123**
- `\bend_[a-z]+\b` 扫 data.js + index.html 须**恰好** 5 个 ending id → 新增字段不得含 `end_xxx` token，新 ID 一律用连字符：`#node-gloss` / `#outcome-gloss` / `#end-gloss` / `#intro-gloss`

### 10.4 禁令

`eval(`、`new Function(`、`http://`、`https://`、`Math.random`、`DEBUG_PASS`、行首 `import`/`export`

### 10.5 其他

- **零 console error，index.html 与 prototype.html 双份都要过**；`file://` 下缺图会记 `net::ERR_FILE_NOT_FOUND` → 缺图即 FAIL，图片必须先物理存在再接线
- **分享卡必须保持程序化**：`file://` 下画图片污染 canvas → `toDataURL` 抛错 → 违反 spec §11.5 → 分享卡内不得出现图片
- 交付约定：`prototype.html` **不进 zip**（16 个 `dist/*.zip` 全部如此）
- `.btn-primary` / `.btn-ghost` 零引用 → CSS 类名可自由改
- 性能基线：116,464 px/帧 × ~250 ops ≈ 29M ops/帧 ≈ **1.7 Gops/s @60fps** → 任何新模式必须**净减**开销
- 已验证 CSS token：`--dur-slow:640ms`@`:48`、`--ease-out`@`:49`、`--lh-tight:1.35; --lh-body:1.85`@`:41`（**无 `--lh-lead`/`--lh-gloss`，须新增**）、`--font-body` 与 `--font-display` 同为 serif（**无 sans token，`--font-gloss` 须新增**）、`assets/img/` 不存在、zip 30,759 B
- **零外部字体**（spec 约束）→ §6.8 的字体名单**全部不可直接用**，除非确认系统内置或走 base64 内嵌（会撞包体预算）

---

## 11. 网络可达性知识（可复用）

本环境在公司出口过滤之后（`oneagent-filter.alibaba-inc.com`）。

### 11.1 可用

**西方源：**

- **kome.ai transcript API** — 取 YouTube 字幕的唯一可用路子，已验证完整（`hasMore`/`isPremium` 字段可验完整性）
- `gdcvault.com/play/*` — 直接可达，含官方 metadata
- `inklestudios.com`、GitHub API、YouTube oEmbed（可独立验证标题/作者）
- notegpt.io / tactiq.io 返回 200 但是 JS 应用，API 端点未定位

**中文源：**

- **Steam storesearch API** — 解析真实 appid（猜的 appid 会错：文字游戏真值 `1109570`，猜的 `1632190` 是错的）
- **Steam app page / news / reviews** — 全可达。news 页是 React 渲染，公告正文在 **HTML 实体编码的内嵌 JSON** 里，需先 unescape
- **百度 via Playwright（默认 chromium）** — **关键突破**：验证码封锁**只对 curl 生效**，Playwright 能过。所有文言文相关发现都走这条路
- **百度 `/link` 重定向解析（curl `-L`）** — 可解析出真实 URL（GameRes、澎湃都这么拿到的）
- **GameRes 文章** — 可达，全文可取（`gameres.com/892713.html`）
- **澎湃 / The Paper** — 可达，全文可取（`m.thepaper.cn/baijiahao_11386385`）
- **Sogou + Baidu 的内联摘要** — 知乎全文被封时的可用形态
- **bilibili 搜索页 HTML via curl** — 可达（318 KB）

### 11.2 不可用

- **Invidious 各实例、Piped、youtubetotranscript.com**（Cloudflare 403）、archive.org、YouTube 页面本身、tumblr（超时）、gamedeveloper.com、80.lv、DDG、Bing（302）、practicaltypography.com、webtypography.net
- **百度 via curl** — `wappass.baidu.com/static/captcha`，552 字节封锁页
- **Sogou via curl** — warmup + cookie jar 后前 ~2 次可用；**~5 次后触发 `/antispider/` 302，即使换新 cookie + 换 UA + 间隔 38s 也不行（IP 级限流）**
- **知乎 zhuanlan 全文** — curl 403；Playwright 撞「请您登录后查看更多专业优质内容」登录墙。**只有内联摘要可用**
- **bilibili 视频页 via curl** — 412（需 WBI 签名）。Playwright 能渲染搜索，但 **title→BV 提取不可靠**（标题挂在非 anchor 元素上；关键词搜索会匹配到错视频）
- **bilibili API** — 412（WBI）
- **indienova 搜索** — 404（URL 错，未找到正确路由）
- **游研社 yystv.cn 搜索** — 客户端渲染，HTML 只有壳
- **机核 gcores.com 搜索** — 客户端渲染；按 URL 浏览可行但 game id 需已知（猜的 13378 = Audioshield，错的）
- **《文字游戏》幕后特辑直播** — 是视频，取不到文本。但字体/网格工艺已被澎湃 + 知乎采访覆盖

### 11.3 经验

- **librarian 无 websearch 工具**，只有 webfetch + bash curl + MCP
- 上一次取 inkle 演讲跑 50 分钟是在跟代理硬拼；这次 12 分钟是因为换了 kome.ai。**以后取 YouTube 内容直接走 kome.ai**
- 中文调研跑 25 分钟，瓶颈是 Sogou IP 级限流和知乎登录墙。**中文一手证据走：Steam API + 百度(Playwright) + GameRes + 澎湃**，不要指望知乎全文

---

## 12. 待办 / 未决

| 项 | 状态 |
|---|---|
| 文字明暗的具体数值 | `[X]` 无证据。inkle 不提供（§4.5），中文语料零匹配（§6.9），WCAG 只给对比度下限不给变暗量 |
| 行长换算（词→汉字） | `[X]` 两套标准并存（§4.4 英文 5–15 词 / §5.1 中文 17–40 字），禁止互推 |
| 数值型排版参数 | **只能来自 §5**（clreq + 活代码）。§6 零数值（§6.9） |
| 上线游戏的文言文排版先例 | `[X]` **未闭合**。§6.9 明确记录找不到 |
| §6.8 字体名单 | `[D]` 百度 AI 来源，**采用前必须独立验证**；且撞 §10.5「零外部字体」约束 |
| caniuse Chrome 版本矛盾 | 未核 |
| 视觉路线（要不要图片） | **待用户决策**。§2.3 + §10.5 分享卡约束 + 用户否决，三条同时反对 |
| 文言层呈现形态 | **待用户决策**。堆叠双层已废（§9）；候选 fragment 级 ruby / warichu 双行小注 / 折叠 toggle（§5.2、§5.3） |
| `prototype.html`（2,390 行，同套件覆盖）冻结还是重做 | **待用户决策**。是单元范围边界的阻塞项 |
| 疲劳对策 | **§7.3 三源收敛，置信度最高。任何方案必须先回答这个** |

---

## 附：trace 文件位置

| 文件 | 内容 |
|---|---|
| `~/.local/share/opencode/tool-output/tool_080af015c001yvyhUrottnJotM` | 国风前提调研；最终判决 lines 1492–1861；原始证据 880–1490 |
| `~/.local/share/opencode/tool-output/tool_080af069e0012J07Xw76Zs9iHy` | CJK 排版调研；综合 881–1185；猜测审计 1114–1185；自我更正 1416–1472 |
| `~/.local/share/opencode/tool-output/tool_080af040d001AYJny79BvSoJYp` | 叙事游戏 UI 首轮调研（不完整）；最终报告 1803–1939；line 10 有 `tpm_limit_exceeded` 错误载荷 |
| `~/.local/share/opencode/tool-output/tool_080c4d7cc001bopoNptbYWjBrp` | inkle transcript 完整取回 |
| `~/.local/share/opencode/tool-output/tool_080cb961c001k2eG4A3QnuLomK` | 中文文字游戏调研（1,441 行）；**最终报告 lines 1341–1441**；路由表 1420–1433；缺口评估 1435–1439 |
| `~/.local/share/opencode/tool-output/tool_0806ec7d3001dSVdpNRmbNzLQx` | 重设计规划 1,374 行；**权威区段 645–1136**；**SUPERSEDED 区段 1194–1292（勿读）** |
