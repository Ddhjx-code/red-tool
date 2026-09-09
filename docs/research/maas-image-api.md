# MaaS 出图网关 · 已验证调用契约

> 网关：`token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`（凭据在仓库根 `.env`，已 gitignore）
> 本文档记录**实测跑通**的调用形状。`/images/generations` 在此网关不存在，不要再试。

## 关键结论（踩坑记录）

| 试过 | 结果 |
| --- | --- |
| `POST /images/generations` | **400 `url error`** — 该路径在本网关不存在，任何 payload 形状都无效 |
| `POST /chat/completions` + `content` 为字符串 | **400** `Input should be a valid list: input.messages.0.content` |
| `POST /chat/completions` + `content` 为**列表** | **200 ✅** 返回图片 URL |
| 顶层 `size` | **被静默忽略**，回落成 `2048*2048` 正方形 |
| `parameters.size` | **生效 ✅** 返回 `720*1280` |

## 正确调用形状

```python
POST {MAAS_BASE_URL}/chat/completions
Headers: Authorization: Bearer {MAAS_API_KEY}

{
  "model": "wan2.7-image-pro",
  "messages": [
    {"role": "user", "content": [{"type": "text", "text": PROMPT}]}
  ],
  "parameters": {"size": "720*1280"},
  "negative_prompt": "文字，水印，text，watermark"
}
```

响应取图路径：

```
output.choices[0].message.content[0].image  ->  OSS URL（带 Expires，约 24h 过期，需立即下载）
usage.size                                  ->  实际尺寸，用于校验
```

## 网关可用模型（`GET /models` 实测 12 个）

出图：`wan2.7-image`、`wan2.7-image-pro`
文本：`qwen3.7-max`、`qwen3.7-plus`、`qwen3.6-flash`、`qwen3.8-max`、`qwen3.8-flash`、
`glm-5.2`、`deepseek-v4-pro`、`deepseek-v4-flash-0731`
语音：`qwen-audio-3.0-tts-plus`、`qwen-audio-3.0-realtime-plus`

## 图片识别（vision）— 实测 2026-09-08

**网关的文本模型里有一部分支持图片输入。** 这推翻了 spec §13.3「本 harness 无视觉能力」的
记录。同一个 `/chat/completions` 路径，`content` 列表里加 `image_url` 块即可。

```python
{
  "model": "qwen3.8-max",
  "messages": [
    {"role": "user", "content": [
      {"type": "image_url", "image_url": {"url": "data:image/webp;base64,..."}},
      {"type": "text", "text": "..."}
    ]}
  ]
}
```

响应走**普通文本路径** `choices[0].message.content`（字符串），不是出图那条
`output.choices[0].message.content[0].image`。

### 实测 8 个文本模型

| 模型 | 结果 |
| --- | --- |
| **`qwen3.8-max`** | ✅ **首选**。描述最细，风格/配色判断准 |
| `qwen3.8-flash` | ✅ 准确，更省 |
| `qwen3.7-plus` | ✅ 准确 |
| `qwen3.6-flash` | ✅ 能识别内容，但**会误判风格**（把工笔/插画说成 "pixel art"） |
| `qwen3.7-max` | ❌ **HTTP 400** `Unexpected item type in content` — 直接拒收 |
| `glm-5.2` | ❌ **静默丢图**，回「I cannot see an image attached」 |
| `deepseek-v4-pro` | ❌ **静默丢图** |
| `deepseek-v4-flash-0731` | ❌ **静默丢图** |

### ⚠️ 两种失败模式的区别（选型不是口味问题）

- `qwen3.7-max` **报错**（400）→ 安全，能立刻发现
- `glm-5.2` / `deepseek-v4-*` **静默丢图后编造「没收到图片」** → 危险。若用它们做验收，
  会得到「我看不到图」这种看似合理、实则完全无效的输出，且不会报错

**纪律：图片验收一律用 `qwen3.8-max`。不得用 deepseek / glm 系列做图片判断。**

### 辅助手段（客观指标，不依赖模型判断）

`Pillow 12.3.0` + `numpy 2.4.6` 本机可用 → 色板提取、alpha 通道检查、边缘密度、
尺寸校验都能程序化算。视觉验收 = vision 模型主观判断 + Pillow 客观指标，两路并行。

### 复用脚本

`/var/folders/lb/.../opencode/vision_probe.py` — 探测某模型是否支持图片输入
（临时脚本，未入仓库；契约已记录于本文）

## 复用脚本

- `tests/gen_yuegong_scenes.py` — 按 `yuegong-prompts.md` 出 3 张试稿（可加 `bridge`/`gate`/`court` 参数单出）
- `tests/make_yuegong_contact_sheet.py` — 试稿 vs 实机截图对位拼图，供眼验

## 竖版尺寸注意

`parameters.size` 用**星号** `720*1280`，不是 `720x1280`。写错会静默回落成正方形。
