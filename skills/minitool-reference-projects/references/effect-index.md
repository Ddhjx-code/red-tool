# 效果索引（36 个）

来源：`awesome-kimi-k3-game/effects/`，CC0 1.0。全部为单文件 HTML，代码本体合计 0.7MB。

**依赖类型说明**（决定能不能用）：

- `零依赖` — 只有 Canvas 2D / CSS，无外部请求。**可直接改造**
- `ES module` — 用了 `type="module"` 或 `importmap`，从 jsDelivr 拉 `three@0.160.0`。**必须重新打包或放弃**
- 移植难度：`低`＝只拆文件 + 语法降级；`高`＝要换渲染方案或整包入 THREE

## 炫酷特效（12）

| slug | 名称 | 引擎 | 体积 | 依赖 | 移植 | 值得借的点 |
| --- | --- | --- | --- | --- | --- | --- |
| `chain-lightning` | 闪电链 | Canvas 2D | 9KB | 零依赖 | 低 | 分形中点位移画闪电 + 1/4 分辨率廉价辉光 |
| `sword-slash` | 剑气刀光轨迹 | Canvas 2D | 10KB | 零依赖 | 低 | 拖动采样点连成渐细多边形，斩断物带斜切面 |
| `holo-card` | 全息闪卡 | CSS 3D + Canvas | 9KB | 零依赖 | 低 | 四层镭射叠加 + 陀螺仪倾斜，卡牌类必备 |
| `ssr-pack-opening` | SSR 开包动画 | Canvas 2D + CSS 3D | 11KB | 零依赖 | 低 | 蓄力裂光→爆开→彩虹旋转→大字砸入的节奏 |
| `danmaku` | 东方风弹幕 | Canvas 2D | 11KB | 零依赖 | 低 | 符卡分阶段切换、擦弹判定、自机狙 |
| `black-hole-portal` | 黑洞/传送门 | Three + Bloom | 9KB | ES module | 高 | 引力透镜着色器思路（换 Canvas 2D 难还原） |
| `dissolve` | 溶解消散 | Three + Bloom | 10KB | ES module | 高 | 噪声阈值溶解 + 燃烧边缘 |
| `energy-shield` | 能量护盾 | Three + Shader | 12KB | ES module | 高 | 菲涅耳边缘 + 受击点球面涟漪 |
| `fire-smoke` | 火焰与烟雾 | Three + Bloom | 8KB | ES module | 高 | 域扭曲 fbm 湍流 + 黑体色温渐变 |
| `nuke-shockwave` | 核爆冲击波 | Three + Bloom | 13KB | ES module | 高 | 冲击波到达镜头时震屏的时机控制 |
| `ultimate-burst` | 大招全屏开大 | Three + Bloom | 13KB | ES module | 高 | 电影黑边 + 屏幕扭曲 + 色差的后期组合 |
| `volumetric-light` | 体积光 | Three + 后期 | 10KB | ES module | 高 | 遮挡缓冲 + 径向采样做「上帝之光」 |

## 玩法（5）

| slug | 名称 | 引擎 | 体积 | 依赖 | 移植 | 值得借的点 |
| --- | --- | --- | --- | --- | --- | --- |
| `platformer` | 平台跳跃 | Canvas 2D | 11KB | 零依赖 | 低 | 二段跳 + 郊狼时间 + 挤压回弹手感 |
| `pinball` | 弹球 | Canvas 2D | 10KB | 零依赖 | 低 | 子步物理防穿透，挡板蓄力 |
| `tower-defense` | 塔防 | Canvas 2D | 10KB | 零依赖 | 低 | 溅射/减速的数值分层，波次节奏 |
| `match-three` | 三消 | Canvas 2D | 10KB | 零依赖 | 低 | 拖拽与点选双操作、连锁下落补位 |
| `endless-runner` | 跑酷 | Canvas 2D | 10KB | 零依赖 | 低 | 合成波视差背景的配色模板 |

## 卡牌与抽卡（3）

| slug | 名称 | 引擎 | 体积 | 依赖 | 移植 | 值得借的点 |
| --- | --- | --- | --- | --- | --- | --- |
| `gacha-ten-pull` | 十连抽动画 | HTML + CSS 3D + Canvas | 13KB | 零依赖 | 低 | 卡背预兆→翻牌→金光环的完整链路 |
| `gacha-result-screen` | 抽卡结算界面 | Canvas + DOM | 10KB | 零依赖 | 低 | 保底进度、NEW 标记、分享图下载（canvas 导出） |
| `card-flip-rarity` | 卡牌稀有度展示 | CSS 3D + Canvas | 11KB | 零依赖 | 低 | N/R/SR/SSR/UR 五档光效的递进设计 |

## 粒子与光效（3）

| slug | 名称 | 引擎 | 体积 | 依赖 | 移植 | 值得借的点 |
| --- | --- | --- | --- | --- | --- | --- |
| `fireworks` | 烟花 | Canvas 2D | 10KB | 零依赖 | 低 | 7 种烟花形态的粒子参数表 + 文字烟花 |
| `magic-circle` | 魔法阵 | Canvas 2D | 9KB | 零依赖 | 低 | 展开→蓄力→释放三阶段，符文旋转层次 |
| `particle-trail` | 粒子拖尾 | Canvas 2D | 9KB | 零依赖 | 低 | 6 种拖尾（彗星/丝带/墨迹）的衰减曲线 |

## 美术风格（5）— 文化类小工具优先看这里

| slug | 名称 | 引擎 | 体积 | 依赖 | 移植 | 值得借的点 |
| --- | --- | --- | --- | --- | --- | --- |
| `style-papercut` | **剪纸风格** | Canvas 2D | 6KB | 零依赖 | 低 | 5 层纸片视差 + 层间投影 + `destination-out` 镂空窗花 |
| `style-ink-wash` | 水墨山水 | Canvas 2D | 6KB | 零依赖 | 低 | 宣纸噪点、层叠晕染、竖排题诗与印章 |
| `style-gameboy` | GameBoy 四色 | Canvas 2D | 8KB | 零依赖 | 低 | 160×144 分辨率 + 4 色调色板 + 掌机外壳 |
| `art-style-switch` | 三种风格实时切换 | Canvas 2D | 10KB | 零依赖 | 低 | 同一套逻辑抽成渲染层，主题只换绘制函数 |
| `style-toon-3d` | 三渲二卡通 3D | Three（CDN） | 7KB | ES module | 高 | 色阶贴图 + 反向外壳描边的做法 |

`style-papercut` 与 `style-ink-wash` 都是 6KB，是**性价比最高的两个参考**：体积极小、纯 Canvas 2D、文化题材贴合。

## 3D 场景（3）

| slug | 名称 | 引擎 | 体积 | 依赖 | 移植 | 值得借的点 |
| --- | --- | --- | --- | --- | --- | --- |
| `weather-system` | 天气系统 | Canvas 2D | 11KB | 零依赖 | 低 | 7 种天气的 2.5D 分层叠加，强度/风力参数化 |
| `voxel-island` | 体素小岛 | Three r160 | 11KB | ES module | 高 | 程序生成 + 昼夜光照循环 |
| `lowpoly-town` | 低多边形小镇 | Three r160 | 12KB | ES module | 高 | 程序化房屋排布 + 昼夜切换 |

## UI（2）

| slug | 名称 | 引擎 | 体积 | 依赖 | 移植 | 值得借的点 |
| --- | --- | --- | --- | --- | --- | --- |
| `game-ui-kit` | 游戏 UI 套件 | HTML + CSS | 13KB | 零依赖 | 低 | 血条/法力条/技能栏/可拖拽背包/打字机对话框 |
| `screen-transitions` | 转场动画合集 | Canvas 2D | 6KB | 零依赖 | 低 | 10 种场景转场（圆形收缩/百叶窗/像素溶解…） |

## Blender（1）

| slug | 名称 | 引擎 | 体积 | 依赖 | 移植 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `blender-scene-script` | 篝火营地场景脚本 | Blender Python | 346KB | ES module | 不适用 | 产出是 `.blend` 资产，只对离线出图有用 |

## 按题材的推荐组合

做文化/非遗类小工具时，这几个可以拼起来用（都是零依赖，体积加起来不到 40KB）：

| 需求 | 取哪个 |
| --- | --- |
| 主视觉（层叠山水/剪纸/水墨底） | `style-papercut` 或 `style-ink-wash` |
| 点亮/庆祝反馈 | `fireworks`（粒子）+ `magic-circle`（符文展开） |
| 章节切换 | `screen-transitions`（挑 1–2 种） |
| 抽卡/揭晓类结果页 | `gacha-ten-pull` + `card-flip-rarity` 的稀有度光效 |
| 操作手感参考 | `platformer` 的郊狼时间与挤压回弹 |
| 界面框架 | `game-ui-kit`（血条/对话框/背包） |

**不要贪多**：小工具是单次体验，2–3 个效果足够。堆到 5 个以上会互相抢注意力，也会把包体推向 2MiB 建议线。

## 读取方式

```sh
# 看效果（推荐先看截图）
open /Users/wang/AI/workspace/awesome-kimi-k3-game/effects/style-papercut/preview.png
open /Users/wang/AI/workspace/awesome-kimi-k3-game/effects/style-papercut/index.html

# 看提示词
cat /Users/wang/AI/workspace/awesome-kimi-k3-game/effects/style-papercut/prompt.md

# 看元数据
cat /Users/wang/AI/workspace/awesome-kimi-k3-game/effects/style-papercut/meta.json
```
