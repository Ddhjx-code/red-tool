# AI 当函数用，不当对话用

> 小工具接入 `window.xhs.AI` 的唯一姿势。适用于所有「需要一点智能判断」的工具：挑素材、判难度、写一句短文案、生成标签、做分类。
> 反面形态：聊天框、多轮追问、agent loop、把模型原文直接铺在界面里、开发期预生成内容库。

## 一、四条硬规则

1. **触发权在用户的功能动作上**
   用户点某个按钮 → 程序组织请求。不是"打开即对话"，不是进页面自动请求，更不是后台轮询。

2. **提示词写死在代码里，用户输入只作为参数**
   用户不能改 prompt。他能决定的是受约束的参数（水平、主题、数量、风格 id），这些参数由程序拼进模板。

3. **返回必须是结构化字段，AI 的自然语言对用户不可见**
   `choices[0].message.content` 只用来 `JSON.parse`，解析出的字段由程序消费。用户看到的是程序渲染出来的成品（图、格线、列表），不是模型说的话。

4. **一次请求，不循环、不多轮**
   没有 messages 历史累积（平台也不保存上下文），不根据失败重试到成功，不把上一轮结果喂回下一轮。失败即降级。

## 二、标准调用骨架

```js
// 用户点「帮我挑字」才触发，一次一请求
async function pickChars(level, theme) {
  const ai = window.xhs && window.xhs.AI;
  if (!ai) return localPick(level, theme);            // L2 本地规则

  try {
    const model = ai.createModel('deepseek-v4-flash');
    const res = await model.generateText({
      messages: [
        { role: 'system', content: SYS_PICK },        // 固定提示词，只输出 JSON
        { role: 'user',   content: `水平:${level};主题:${theme};数量:8` }
      ],
      max_output_tokens: 120,                         // 只够装字段，逼它别啰嗦
      temperature: 0.2                                // 要稳定，不要发挥
    });

    const raw = (res.choices && res.choices[0] && res.choices[0].message
      && res.choices[0].message.content) || '';
    const data = JSON.parse(raw);                     // 解析失败 → catch
    const chars = sanitize(data.chars);               // 白名单 + 去重 + 截断
    return chars.length === 8 ? chars : localPick(level, theme);   // L3 校验不过
  } catch (e) {
    return localPick(level, theme);                   // L4 任何异常静默降级
  }
}
```

### 提示词模板（固定字符串常量）

```
你是汉字选字器。只输出 JSON，形如 {"chars":["永","和","九","成","宫","水","火","山"]}。
不要解释，不要标点，不要代码块标记，不要换行。
```

要点：

- 明确"只输出 JSON" + 给出示例骨架，能显著降低解析失败率
- 字段名用程序侧定义好的，不要让模型自创
- `max_output_tokens` 压到刚好够字段，越长越容易跑偏
- `temperature` 取 0.1–0.3；要多样性（比如生成几条备选文案）才提到 0.8 以上

## 三、校验层（必须有，不能省）

模型输出当作**不可信输入**处理，逐项过：

| 检查 | 做法 |
| --- | --- |
| JSON 可解析 | `JSON.parse` 包 try/catch |
| 字段存在且类型正确 | 逐字段判类型，不做隐式转换 |
| 值域合法 | 字符集白名单 / 枚举校验 / 长度截断 |
| 数量符合预期 | 少一个都不接受，直接降级，不要"凑合渲染" |
| 内容可用 | 与本地数据交叉校验（比如字必须在本机字库内） |

校验不过 → 降级，不要把半成品渲染给用户。

## 四、降级阶梯（四级）

| 级别 | 条件 | 行为 |
| --- | --- | --- |
| L1 | `window.xhs.AI` 存在且调用成功、校验通过 | 用 AI 结果 |
| L2 | 容器不支持该能力（`ai` 不存在） | 本地规则/静态表，功能完整可用 |
| L3 | 返回为空、解析失败、校验不过 | 静默退回 L2，不报错、不弹窗 |
| L4 | 抛错：`AI_NOT_ALLOWED` / `AI_QUOTA_EXCEEDED` / `AI_CONTENT_BLOCKED` / 网络类异常 | 静默退回 L2，功能表现不变 |

原则：**AI 只影响"更好"，不影响"能用"**。任何一条降级链路走完，用户都不该看到报错、空白或"AI 失败了"的提示。

## 五、次数与内容安全

- 每个用户每天 **100 次**，按 appId 加白；用完返回 `AI_QUOTA_EXCEEDED`
- 免费，不需要 API key，不要在小工具包里放任何密钥
- system prompt、用户输入、模型输出**三方都过审**，命中返回 `AI_CONTENT_BLOCKED`
- 因此：用户的自由文本尽量少传；确实要传就先做本地长度/敏感词预筛
- 高频功能建议**结果缓存**到 `window.xhs.miniTool.setStorage`（`data` 须为 JSON 字符串），同一参数一天内只请求一次

## 六、接口事实（核对自在线文档 §3.10）

| 项 | 规定 |
| --- | --- |
| 入口 | `window.xhs.AI`（容器注入，包内不引 SDK） |
| 模型 | `deepseek-v4-flash`（默认）、`dots-3-note-prev`（点点人格） |
| 形态 | 仅非流式，整段返回；平台不保存上下文 |
| messages | ≤40 条、累计 ≤12000 字符；role = system / user / assistant |
| 输出 | `max_output_tokens` ≤2048 |
| 温度 | 0 – 1.5 |
| 返回 | `result.choices[0].message.content`；`choices` 可能为空 |
| 渲染 | 输出只能当纯文本用，禁止当 HTML 插入 |
| 排查 | 成功响应带 `request_id`，出问题一并提供 |
| 错误码 | `AI_NOT_ALLOWED` / `AI_QUOTA_EXCEEDED` / `AI_CONTENT_BLOCKED` |

## 七、发布路径限制（会卡住流程）

在线文档 §1.1 明确：**使用正在内测的 AI 接口的小工具，无法通过第三方 Agent 上传。**

也就是说，只要包里调了 `window.xhs.AI`，`redapp upload/submit` 这条链走不通，必须改走官方上传页（创作服务平台 → Builder Hub → 小工具 → 用 agent 创作）。

实践建议：**把 AI 分支做成可开关的**（一个常量 + 能力判空）。先用不带 AI 的版本走通上传与审核，AI 那一层等加白、改走官方流程后再打开，避免为了一个接口把整个发布链路换掉。

## 八、反面清单

- ❌ 聊天界面、气泡对话、多轮记忆
- ❌ 让用户自己写 prompt
- ❌ 把模型输出直接 `innerHTML` 或直接展示给用户
- ❌ 失败后循环重试、把上一轮结果拼回下一轮
- ❌ 在开发期用 AI 批量预生成内容塞进包体（应该运行时按需调用或不调用）
- ❌ 一个功能里堆四五处 AI 调用，次数与审核风险都翻倍
- ❌ 依赖 AI 才能完成核心流程
