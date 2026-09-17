"""Generate 舞火龙's dragon parts with the MaaS image gateway.

Why parts and not one picture: the dragon is a 32-node chain that must bend,
wave and wrap pillars, so a single flat sprite cannot be animated. The head,
tail fin and claws are rigid attachments on that chain (route B: 2.5D cutout
puppet), while the body itself stays a procedurally drawn silhouette ribbon.

The vision model (tests/vision_ask.py) rejected the all-procedural dragon with
a precise verdict: "a burning projectile, not a dragon -- Chinese dragon
identity is 90% in the head, and there is no head". These assets exist to fix
exactly that.

Gateway contract: docs/research/maas-image-api.md. The only working path is
POST {MAAS_BASE_URL}/chat/completions with `content` as a LIST of typed parts;
/images/generations 400s on this gateway and is never referenced. `size` uses an
ASTERISK and total pixels must sit in [589824, 16777216], so 1024*1024 is used
and everything is downscaled locally -- downscaling is a pipeline step.

Pipeline (same proven one as tests/gen_yuedeng_moon.py):
    raw 1024*1024 on #FF00FF
      -> chroma-key + border-connected flood fill
      -> despill -> halo cleanup -> 1-ring erode
      -> crop to the opaque bbox (aspect kept: a head is not square)
      -> LANCZOS downscale to the target long edge
      -> lossless WEBP

Raw PNGs are cached so a re-run never re-calls the gateway (the model is not
deterministic; the cache is what makes the shipped bytes stable).

Usage:
    python tests/gen_wuhuolong_dragon.py --dry-run
    python tests/gen_wuhuolong_dragon.py --only D-HEAD
    python tests/gen_wuhuolong_dragon.py --report
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHIP_DIR = os.path.join(ROOT, "tools", "wuhuolong", "assets", "img")
DRAFT_DIR = os.path.join(ROOT, "docs", "research", "wuhuolong-drafts")
RAW_DIR = os.path.join(DRAFT_DIR, "raw")

CHAT_PATH = "/chat/completions"
GEN_SIZE = "1024*1024"
MIN_TOTAL_PIXELS = 589_824
MAX_TOTAL_PIXELS = 16_777_216

QUOTA_MARKERS = ("tpm_limit_exceeded", "allocated quota exceeded", "quota exceeded",
                 "throttling", "rate limit", "too many requests")
RETRY_MAX = 6
BACKOFF_BASE = 25.0
BACKOFF_CAP = 300.0

KEY_RGB = (255, 0, 255)
BG_GLOBAL_TOL = 130.0
HALO_TOL = 96.0
ALPHA_CUT = 128
CROP_PAD_PX = 10
WEBP_LOSSLESS = False
WEBP_QUALITY = 88

STYLE = (
    "中国皮影戏影人镂刻质感，不透明剪影，主体为朱红#8E2B22 与墨黑#12100E 描边，"
    "镂空处透出暖金#FFD98A 光，刀刻镂空纹样清晰利落，边缘干净锐利便于抠图，"
    "侧视平面剪影，不用文字不用水印。"
)
NEG = (
    "文字，水印，签名，logo，text，watermark，写实照片，3D渲染，三维立体，"
    "卡通，日式动漫，西方龙，蝙蝠翼，火焰喷射，背景景物，建筑，云，"
    "人物，多个头，多只眼，模糊，低分辨率，噪点，jpeg压缩伪影，投影，地面阴影"
)

ASSETS = [
    {
        "id": "BG-FAR", "file": "bg-far.webp", "plate": True, "width": 1400, "crop": [0.45, 1.00],
        "body": (
            "**横版游戏的远景背景板**（整幅画面，不要纯色背景、不要留空、不要文字）。"
            "香港大坑的深夜远景：一道起伏的山脊剪影横贯画面，"
            "山脊后方极远处立着几栋高楼的方直轮廓。"
            "全部用近黑深蓝#0a1420 的剪影表现，层次靠明度差拉开；"
            "上方是干净的夜空渐变（顶部近墨蓝#060c14，向下过渡到#12202f），"
            "夜空里散布**稀疏且大小不均**的冷白星点，不要月亮。"
            "**构图**：山脊底线大致水平、位于画面下三分之一；"
            "左右两端的山脊高度与夜空明度要接近，便于横向循环拼接；"
            "信息量低、层次分明，这是远景不是主体。"
        ),
    },
    {
        "id": "BG-MID", "file": "bg-mid.webp", "plate": True, "width": 1600, "crop": [0.34, 0.90],
        "body": (
            "**横版游戏的建筑层背景板**（整幅画面，不要纯色背景、不要文字）。"
            "夜间香港大坑的老村屋／旧唐楼一条街：两三层的砖楼与铁皮屋并排，"
            "有骑楼柱、外挂铁皮檐、竹晾衣杆、防盗窗、卷闸门、小店招牌与红灯笼。"
            "主体用深色剪影（#0c1620 到 #16283c 拉开层次），"
            "**只在窗户与灯笼处**点缀暖黄#ffb347 的光点，"
            "光点要**疏密不均、明暗不一**（不要等距排布成灯串）。"
            "**构图**：所有建筑底部落在同一条水平基准线上（画面最下缘）；"
            "建筑高低错落、不要整齐划一；左右两端的建筑高度与天际线要接近，便于横向循环拼接。"
            "**不要画地面、不要画街道、不要画人物**（地面与人物由游戏另外绘制）。"
        ),
    },
    {
        "id": "BG-NEAR", "file": "bg-near.webp", "plate": True, "width": 1600, "crop": [0.28, 0.70],
        "body": (
            "**横版游戏的前景道具横条**（整幅画面，不要纯色背景、不要文字）。"
            "夜间香港街边的排档与祭品摊近景：竹棚摊架、叠放的木箱、"
            "香烛摊上成把的红香与蜡烛、挂在铁架上的纸灯笼串、"
            "路边石制香炉（炉内透出暖红火光）、纸扎供品与折凳。"
            "深色剪影为主（#050a10 到 #1d3448），"
            "**只在香烛火头与灯笼内**透出暖橙#ff8a3d 的光。"
            "**构图**：所有物件底部落在同一条水平基准线上（画面最下缘）；"
            "整体高度不超过画面宽度的一半（这是贴地的道具带，不是高建筑）；"
            "左右两端各留一点空白，便于横向循环拼接；不要人物。"
        ),
    },
    {
        "id": "P-MAN", "file": "man-dancer.webp", "long_edge": 560,
        "body": (
            "2D横版动作游戏的**主角角色立绘**，侧面朝右：一位年轻的中国舞龙人，"
            "短打劲装、头缠红巾、束腰、绑腿红靴，**单手在前单手在后双手持一根长竹竿**，"
            "竿身斜向前上方45度举起，双腿呈**弓步**（前腿屈膝承重、后腿蹬直），上身微前倾。"
            "**题眼必须落在「舞龙」上**：左肩甲做成**一只张口的小龙头**形状（有角有须），"
            "腰带下垂出**龙尾状飘带**，背后斜挂一面绣龙小旗；"
            "让人一眼看出他是舞龙队的人，而不是少林棍僧。"
            "**纹样必须极简**（缩到 84 像素时细密纹样会碎成噪点）："
            "躯干是**一整块金胸甲 + 最多两条暗色分带**，严禁细密龙鳞纹与小碎花；"
            "旗面纹样同样只用几个大块面。"
            "**手中竹竿要够粗**：直径至少占画面高度的四十分之一（保证缩到 84 像素时仍有约 2 像素宽），"
            "竿身加一圈深色描边，避免细线在缩放时断裂闪烁。"
            "**必须是有设计感的手绘游戏美术**：国风剪纸/皮影质感，厚重墨黑描边，"
            "主体色米白#ECE3D0 上衣、朱红#C9482C 腰带与头巾、暖金#B8863C 竹竿与鳞纹；"
            "剪影清晰、四肢结构分明、不得糊成一团、不得写实照片风。"
            "背景为纯品红#FF00FF纯色平涂，角色居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "E-GHOST", "file": "foe-ghost.webp", "long_edge": 448,
        "body": (
            "2D横版动作游戏的**怪物角色立绘**，侧面朝左：一只中式瘟疫小鬼（瘟鬼）。"
            "**最关键：这个素材在游戏里缩到约 48 像素高，必须仍然一眼可辨**——"
            "所以要用**大面积纯色块 + 极粗的墨黑描边**，内部细节尽量少，靠外形轮廓说话。"
            "外形：惨白布幔裹成的瘦长身体、**没有腿**、下摆散成两条飘带悬空；"
            "两个**又大又黑**的眼窝（在缩略尺寸下也看得见）、咧到耳根的尖牙嘴；"
            "头顶一只歪破斗笠；双手枯瘦前伸。"
            "瘟疫标记（要够大够醒目）：肩背大片**青黑疫斑**、腰间一只**鼓胀的幽绿毒囊**、"
            "口鼻喷出的**浓绿毒气**在头侧形成一大团绿雾。"
            "**白袍不要通体纯白**：用三档明度的灰白分层（最亮只留在肩头与斗笠），"
            "袖、胸、下摆之间用**深灰内阴影或粗黑描边分开**，"
            "让'双手前伸'这个动作在缩略尺寸下也读得出来。"
            "配色只许四色、对比拉满：亮白#EEF2F8 布、纯黑#12161C 描边与眼窝、"
            "病绿#6FA82A 毒气毒囊、暗青#1E2A20 疫斑。"
            "背景为纯品红#FF00FF纯色平涂，怪物居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "E-MIASMA", "file": "foe-miasma.webp", "long_edge": 448,
        "body": (
            "2D横版动作游戏的**怪物**：一团会飘的瘟疫瘴气，**必须读作活物而不是地形或灌木**。"
            "**最关键：这个素材在游戏里缩到约 48 像素高，必须仍然一眼可辨**——"
            "整体外形要**圆润、完整、像一颗有壳的瘴气球**，轮廓干净，**绝对不要细碎羽状边缘**"
            "（碎边一缩小就糊成噪点，会被误读成灌木）。"
            "结构：外层一圈厚厚的病绿云壳（纯色、粗黑描边），"
            "**中央一颗明显更暗的核**，核上有**两只又大又亮的幽绿眼睛**（缩略尺寸下仍是画面最亮的点之一）。"
            "**底部必须干净收口**：只允许向下延伸**两条又粗又短的云脚**"
            "（每条宽度不小于整体宽度的四分之一，长度不超过整体高度的四分之一）。"
            "**画面中不得出现任何比眼睛更小的点状物**——不要孢子、不要颗粒、不要滴落物、"
            "不要米黄小点、不要短棒状碎屑（这些缩到 36 像素全都会闪成贴图噪点）。"
            "配色只许四色、对比拉满：亮黄绿#B8E24A 云壳、暗绿#24360F 描边与核、"
            "幽绿荧光#8CFF5A 眼与孢子、亮白#F0FFD0 眼心。"
            "背景为纯品红#FF00FF纯色平涂，主体居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "FX-HIT", "file": "fx-hit.webp", "long_edge": 448,
        "body": (
            "2D横版动作游戏的**打击命中特效**，**必须有强烈的方向性与速度感、绝不允许左右对称**："
            "一次从左上向右下的猛烈撞击瞬间——"
            "中心是**短促不规则的亮白撞点**（不是圆形），"
            "沿撞击方向（右下）**甩出数条长短不一的速度线与拖尾片**，"
            "**只有撞击前方一侧**有张开的新月形冲击波弧，反向一侧几乎没有；"
            "外围飞散**尖锐碎片与火星**，整体呈被撞开的不对称爆裂，"
            "像动作漫画里的一记重击定格，而不是一枚圆形徽章、法阵或图腾。"
            "颜色限暖金#FFB347、橙红#FF8A3D、亮白#FFF3D6，不得出现蓝紫青绿。"
            "背景为纯品红#FF00FF纯色平涂，特效居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "P-WALK", "file": "man-walk.webp", "long_edge": 560,
        "body": (
            "2D横版动作游戏主角的**行走动作立绘**，侧面朝右：同一位中国舞龙人，"
            "**正处在跨步前行的瞬间**——前腿迈出屈膝承重、后腿蹬直且脚掌离地，"
            "上身略前倾，双手把长竹竿斜举在身侧，衣摆与头巾向后飞扬。"
            "**造型与配色必须与站姿版完全一致**（同一角色）：米白#ECE3D0 短打劲装、"
            "朱红#C9482C 头巾与腰带、龙鳞护肩与张口小龙头肩甲、暖金#B8863C 长竹竿、"
            "粗墨黑描边；缩到实机约 90 像素高仍要认出是同一个人。"
            "背景为纯品红#FF00FF纯色平涂，角色居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "P-JUMP", "file": "man-jump.webp", "long_edge": 560,
        "body": (
            "2D横版动作游戏主角的**跳跃动作立绘**，侧面朝右：同一位中国舞龙人，"
            "**正处在腾空跃起的瞬间**——双膝向上收紧、脚尖下压，"
            "上身略后仰，双手把长竹竿高举过头顶，衣摆与头巾向上翻飞。"
            "**造型与配色必须与站姿版完全一致**（同一角色）：米白#ECE3D0 短打劲装、"
            "朱红#C9482C 头巾与腰带、龙鳞护肩与龙头肩甲、暖金#B8863C 长竹竿、"
            "粗墨黑描边；缩到实机约 90 像素高仍要认出是同一个人。"
            "背景为纯品红#FF00FF纯色平涂，角色居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "PROP-ALTAR", "file": "prop-altar.webp", "long_edge": 384,
        "body": (
            "2D横版动作游戏的**场景道具**：中式庙宇前的供桌（神坛）。"
            "红漆木桌、桌围绣云龙纹、桌上一只铜香炉正腾起三缕香烟、"
            "两侧各一支点燃的红烛（暖黄火苗）、一盘供果与一块牌位。"
            "**必须是可放进横版场景的独立剪影道具**：底部平整、正侧面视角、无透视。"
            "主体色严格为朱红#8E2B22、墨黑#12100E 描边、镂空处透暖金#FFD98A，"
            "不得出现品红洋红。"
            "背景为纯品红#FF00FF纯色平涂，道具居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "PROP-DRUM", "file": "prop-drum.webp", "long_edge": 384,
        "body": (
            "2D横版动作游戏的**场景道具**：中式大鼓（舞火龙锣鼓队的那面鼓）。"
            "红漆木桶形鼓身、米白牛皮鼓面、鼓身一圈黄铜鼓钉、"
            "竹木鼓架上斜插两根鼓槌。"
            "**必须是可放进横版场景的独立剪影道具**：底部平整、正侧面视角、无透视。"
            "主体色严格为朱红#8E2B22、墨黑#12100E 描边、镂空处透暖金#FFD98A，"
            "不得出现品红洋红。"
            "背景为纯品红#FF00FF纯色平涂，道具居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "PROP-BANNER", "file": "prop-banner.webp", "long_edge": 384,
        "body": (
            "2D横版动作游戏的**场景道具**：巡游队前导的「头牌」。"
            "一根高高的竹竿，竿顶横挑一块**竖长红绸幡**，幡面绣金色云龙纹（**不要任何文字**），"
            "幡下坠两条流苏，竿身缠红绳。"
            "**必须是可放进横版场景的独立剪影道具**：底部平整、正侧面视角、无透视。"
            "主体色严格为朱红#8E2B22、墨黑#12100E 描边、镂空处透暖金#FFD98A，"
            "不得出现品红洋红、不得出现文字。"
            "背景为纯品红#FF00FF纯色平涂，道具居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "PROP-LANTERN-KID", "file": "prop-lantern-kid.webp", "long_edge": 384,
        "no_neg": True,
        "body": (
            "2D横版动作游戏的**场景角色**：跟随火龙巡游的「纱灯队」孩童。"
            "一位穿中式唐装的小孩（约七岁），双手举着一根短竿、"
            "竿上挂一盏**粉红莲花灯**（花瓣分层、灯内透出暖黄烛火），"
            "另一只手提一盏小云灯，正迈步前行、面带喜色。"
            "**必须是可放进横版场景的独立剪影角色**：脚底平整、正侧面视角。"
            "主体色严格为朱红#8E2B22 唐装、米白#ECE3D0 内衬、墨黑#12100E 粗描边、"
            "暖金#FFD98A 灯火；**不要写实照片风、不要日式动漫风**。"
            "背景为纯品红#FF00FF纯色平涂，角色居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "FOE-BOSS", "file": "foe-boss.webp", "long_edge": 512,
        "body": (
            "2D横版动作游戏的**关底Boss立绘**：瘟神——一尊巨大臃肿的瘟疫邪神。"
            "紫黑长袍裹着庞大身躯、腹部鼓胀；脸上是一张**开裂的青铜面具**，"
            "面具后透出**两只又大又亮的幽绿眼睛**；头戴残破的官帽；"
            "肩上披着写满符咒的破布条；周身缠着**数条粗壮的黑色疫虫触须**；"
            "一手倒提一只喷出浓绿毒雾的葫芦。"
            "**缩到实机约 140 像素高仍要一眼可怖且可辨**：用**大块面 + 极粗墨黑描边**，"
            "细节不要碎，靠轮廓与体块说话。"
            "四色高对比：紫黑#3A2038 袍身、暗青#1E2A20 阴影与触须、"
            "病绿#6FA82A 毒雾毒囊、亮黄绿#C8E86A 眼与毒光，朱红#8E2B22 点缀。"
            "**不要可爱化、不要写实照片风、不要日式动漫风。**"
            "背景为纯品红#FF00FF纯色平涂，Boss 居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "D-HEAD", "file": "dragon-head.webp", "long_edge": 320,
        "body": (
            "中国龙头的侧面剪影特写，龙头朝右：张开的大口露出上下利齿，下颌有须，"
            "鼻子隆起，眼睛镂空透光，两只分叉的鹿角向后上方扬起，"
            "长长的龙须向前方飘出，鬃毛分缕向后飘散，腮部有鳍状张开。"
            "背景为纯品红#FF00FF纯色平涂，龙头居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "D-HEAD2", "file": "dragon-head-whisker.webp", "long_edge": 640,
        "body": (
            "中国龙头的侧面剪影特写，龙头朝右：两只分叉鹿角向后上方扬起，眼睛镂空透光带金色眉焰，"
            "**两根粗壮的龙须自鼻翼两侧生出（不是从鼻梁或额头长出）**，须的粗细与眉焰纹同一量级，"
            "长度超过半个头，向前下方呈 S 形飘卷，左右各一，须端分叉；"
            "张嘴露齿，下颌有髯，鬃毛分缕向后飘散。"
            "背景为纯品红#FF00FF纯色平涂，龙头居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "D-TAIL", "file": "dragon-tail.webp", "long_edge": 256,
        "body": (
            "中国龙的尾巴侧面剪影：尾端是分叉的火焰状尾鳍，向上翻卷如燃烧的火苗，"
            "尾根较粗逐渐收细到尾端，尾鳍分三到四片尖端。"
            "背景为纯品红#FF00FF纯色平涂，居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "D-TAIL2", "file": "dragon-tail2.webp", "long_edge": 512,
        "body": (
            "中国龙的尾巴侧面剪影：尾根较粗并自然收束成完整形态（不得被画面边缘切断、不得出现半截鳞片），"
            "尾身向右逐渐收细，尾端是向上翻卷的分叉火焰状尾鳍，尾背有一排锯齿状脊刺，尾身覆整齐鳞纹。"
            "主体色必须严格为朱红#8E2B22 暗红与墨黑#12100E 描边，镂空透暖金#FFD98A，"
            "绝对不得出现品红、洋红、粉色或电光红。"
            "背景为纯品红#FF00FF纯色平涂，居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "D-CLAW2", "file": "dragon-claw2.webp", "long_edge": 320,
        "body": (
            "中国龙前爪的纯侧面剪影：腕部是一段横向的、略微弯曲的臂（绝对不要正对观者的圆形鳞盘或同心圆接口），"
            "臂端向前伸出四根弯曲的黑色利爪，爪尖锐利微钩，臂上有金色环状节段纹样。"
            "主体色严格为朱红#8E2B22 与墨黑#12100E 描边，镂空透暖金#FFD98A，不得出现品红洋红。"
            "背景为纯品红#FF00FF纯色平涂，居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "D-CLAW", "file": "dragon-claw.webp", "long_edge": 160,
        "body": (
            "中国龙的一只前爪侧面剪影：粗壮的腕部，向前伸出四根弯曲的利爪，"
            "爪尖锐利，腕部有环状镂空纹样。"
            "背景为纯品红#FF00FF纯色平涂，居中并留出至少八分之一空白余量。"
        ),
    },
]


def load_env():
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        raise SystemExit("FATAL: repo-root .env not found")
    env = {}
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip().lstrip("\ufeff")
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export "):].lstrip()
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
                v = v[1:-1]
            if k:
                env[k] = v
    missing = [k for k in ("MAAS_BASE_URL", "MAAS_API_KEY") if not env.get(k)]
    if missing:
        raise SystemExit("FATAL: .env missing %s" % ", ".join(missing))
    env.setdefault("MAAS_IMAGE_MODEL", "wan2.7-image-pro")
    return env


def post_once(env, prompt, neg=True):
    url = env["MAAS_BASE_URL"].rstrip("/") + CHAT_PATH
    payload = {
        "model": env["MAAS_IMAGE_MODEL"],
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        "parameters": {"size": GEN_SIZE},
        "negative_prompt": NEG if neg else "",
    }
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + env["MAAS_API_KEY"],
                 "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=300) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    choices = (body.get("output") or {}).get("choices") or body.get("choices") or []
    if not choices:
        raise RuntimeError("no choices: " + json.dumps(body, ensure_ascii=False)[:300])
    parts = choices[0].get("message", {}).get("content") or []
    if isinstance(parts, str):
        raise RuntimeError("content was a string, expected parts list")
    for part in parts:
        if isinstance(part, dict) and part.get("type") == "image" and part.get("image"):
            return part["image"], (body.get("usage") or {}).get("size")
    raise RuntimeError("no image part: " + json.dumps(parts, ensure_ascii=False)[:300])


def classify(exc):
    text = ""
    if isinstance(exc, urllib.error.HTTPError):
        try:
            text = exc.read().decode("utf-8", "replace")
        except OSError:
            text = ""
        if any(m in text.lower() for m in QUOTA_MARKERS):
            return "quota", text
        return ("transient", text) if exc.code in (429, 500, 502, 503, 504) else ("fatal", text)
    return "transient", str(exc)


def request_image(env, prompt, neg=True):
    wait = BACKOFF_BASE
    for attempt in range(1, RETRY_MAX + 1):
        try:
            return post_once(env, prompt, neg)
        except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError) as exc:
            kind, text = classify(exc)
            snippet = " ".join(text.split())[:200]
            if kind == "fatal":
                print("  GENERATE FAILED (fatal, not retried): %s" % snippet)
                return None
            if attempt == RETRY_MAX:
                print("  GENERATE FAILED after %d (%s): %s" % (attempt, kind, snippet))
                return None
            print("  attempt %d/%d %s backoff %.0fs: %s" % (attempt, RETRY_MAX, kind, wait, snippet))
            time.sleep(wait)
            wait = min(wait * 2, BACKOFF_CAP)
    return None


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()
    with open(dest, "wb") as fh:
        fh.write(data)
    return len(data)


def border_connected(cand):
    conn = np.zeros_like(cand)
    conn[0, :], conn[-1, :], conn[:, 0], conn[:, -1] = (
        cand[0, :], cand[-1, :], cand[:, 0], cand[:, -1])
    while True:
        grown = conn.copy()
        grown[1:, :] |= conn[:-1, :]
        grown[:-1, :] |= conn[1:, :]
        grown[:, 1:] |= conn[:, :-1]
        grown[:, :-1] |= conn[:, 1:]
        grown &= cand
        if np.array_equal(grown, conn):
            return conn
        conn = grown


def key_pipeline(raw_path, asset):
    rgb = np.asarray(Image.open(raw_path).convert("RGB"), dtype=np.float64)
    h, w = rgb.shape[:2]
    key = np.median(np.concatenate([
        rgb[0, :, :].reshape(-1, 3), rgb[-1, :, :].reshape(-1, 3),
        rgb[:, 0, :].reshape(-1, 3), rgb[:, -1, :].reshape(-1, 3)]), axis=0)
    dist = np.sqrt(np.sum((rgb - key) ** 2, axis=2))
    bg = border_connected(dist <= BG_GLOBAL_TOL)
    alpha = np.where(bg, 0, 255).astype(np.uint8)

    weight = np.clip((HALO_TOL - dist) / HALO_TOL, 0.0, 1.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = np.maximum(0.0, np.minimum(r, b) - g)
    rgb[..., 0] = np.clip(r - spill * weight, 0, 255)
    rgb[..., 2] = np.clip(b - spill * weight, 0, 255)

    opaque = alpha >= ALPHA_CUT
    touches_void = (~opaque).copy()
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        touches_void |= np.roll(np.roll(~opaque, dy, axis=0), dx, axis=1)
    alpha[opaque & touches_void & (dist < HALO_TOL)] = 0

    opaque = alpha >= ALPHA_CUT
    touches_void = (~opaque).copy()
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        touches_void |= np.roll(np.roll(~opaque, dy, axis=0), dx, axis=1)
    alpha[opaque & touches_void] = 0

    ys, xs = np.where(alpha >= ALPHA_CUT)
    if ys.size == 0:
        raise RuntimeError("keying removed every pixel -- ground was not magenta")
    top = max(0, ys.min() - CROP_PAD_PX)
    bottom = min(h, ys.max() + 1 + CROP_PAD_PX)
    left = max(0, xs.min() - CROP_PAD_PX)
    right = min(w, xs.max() + 1 + CROP_PAD_PX)
    rgb = rgb[top:bottom, left:right]
    alpha = alpha[top:bottom, left:right]

    opaque = alpha >= ALPHA_CUT
    mean_rgb = np.round(rgb[opaque].mean(axis=0)) if opaque.any() else np.array(KEY_RGB)
    rgb[~opaque] = mean_rgb

    img = Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), "RGBA")
    scale = asset["long_edge"] / float(max(img.size))
    size = (max(1, int(round(img.size[0] * scale))), max(1, int(round(img.size[1] * scale))))
    img = img.resize(size, Image.LANCZOS)

    dest = os.path.join(SHIP_DIR, asset["file"])
    img.save(dest, "WEBP", lossless=WEBP_LOSSLESS, quality=WEBP_QUALITY, method=6)
    return dest, tuple(np.round(key).astype(int)), img.size


def inspect_ship(asset):
    path = os.path.join(SHIP_DIR, asset["file"])
    if not os.path.exists(path):
        return None
    img = Image.open(path)
    arr = np.asarray(img.convert("RGBA"))
    alpha = arr[..., 3]
    rgb = arr[..., :3].astype(np.float64)
    opaque = alpha >= ALPHA_CUT
    corners = [int(alpha[0, 0]), int(alpha[0, -1]), int(alpha[-1, 0]), int(alpha[-1, -1])]
    colours = len({tuple(int(c) for c in px) for px in rgb[opaque].astype(int)}) if opaque.any() else 0
    return {
        "id": asset["id"], "file": asset["file"], "path": path, "size": img.size,
        "kib": os.path.getsize(path) / 1024.0, "corners": corners,
        "opaque_pct": 100.0 * opaque.sum() / alpha.size,
        "colours": colours,
        "warm": bool(opaque.any() and rgb[opaque].mean(axis=0)[0] >= rgb[opaque].mean(axis=0)[2]),
    }


def processed(asset):
    row = inspect_ship(asset)
    return bool(row and max(row["corners"]) == 0 and row["opaque_pct"] > 3 and row["colours"] > 200)


def plate_pipeline(raw_path, asset):
    """整幅背景板：不抠绿，按 crop 比例裁掉多余天空/空区，再等比缩放到目标宽度。"""
    im = Image.open(raw_path).convert("RGB")
    crop = asset.get("crop")
    if crop:
        w0, h0 = im.size
        y0 = max(0, min(h0 - 2, int(round(h0 * crop[0]))))
        y1 = max(y0 + 2, min(h0, int(round(h0 * crop[1]))))
        im = im.crop((0, y0, w0, y1))
    w = int(asset.get("width", 900))
    h = max(1, round(im.height * w / im.width))
    im = im.resize((w, h), Image.LANCZOS)
    dest = os.path.join(SHIP_DIR, asset["file"])
    im.save(dest, "WEBP", quality=86, method=6)
    return dest


def process(env, asset, force):
    stem = os.path.splitext(asset["file"])[0]
    raw_path = os.path.join(RAW_DIR, "%s_%s.png" % (asset["id"], stem))
    print("\n--- %s  %s ---" % (asset["id"], asset["file"]))
    if not force and processed(asset):
        row = inspect_ship(asset)
        print("  SKIP  = already generated (%dx%d, %.1f KiB, %d colours)"
              % (row["size"][0], row["size"][1], row["kib"], row["colours"]))
        return row
    if not force and os.path.exists(raw_path):
        print("  reuse raw = %s (no gateway call)" % os.path.basename(raw_path))
    else:
        is_plate = bool(asset.get("plate"))
        prompt = asset["body"] if is_plate else asset["body"] + "\n" + STYLE
        use_neg = not is_plate and not asset.get("no_neg")
        print("  prompt = %d chars" % len(prompt))
        r = request_image(env, prompt, use_neg)
        if r is None:
            print("  !! NOT PRODUCED: %s" % asset["id"])
            return None
        url, api_size = r
        try:
            n = download(url, raw_path)
        except (urllib.error.HTTPError, urllib.error.URLError) as exc:
            print("  DOWNLOAD FAILED: %s -- the OSS URL expires in ~24h" % exc)
            return None
        print("  api size = %s   raw %.0f KB (cached)" % (api_size, n / 1024))
    if asset.get("plate"):
        try:
            dest = plate_pipeline(raw_path, asset)
        except (OSError, RuntimeError, ValueError) as exc:
            print("  PLATE FAILED: %s" % exc)
            return None
        row = inspect_ship(asset)
        print("  shipped = %s  %dx%d  %.1f KiB" % (asset["file"], row["size"][0],
                                                   row["size"][1], row["kib"]))
        return row
    try:
        dest, key, size = key_pipeline(raw_path, asset)
    except (OSError, RuntimeError, ValueError) as exc:
        print("  KEY FAILED: %s" % exc)
        return None
    row = inspect_ship(asset)
    print("  shipped = %s  %dx%d  %.1f KiB  key=%s  opaque %.1f%%  %d colours  warm=%s"
          % (os.path.basename(dest), row["size"][0], row["size"][1], row["kib"],
             list(key), row["opaque_pct"], row["colours"], row["warm"]))
    return row


def main():
    sys.stdout.reconfigure(line_buffering=True)
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--only", help="comma-separated asset ids")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    if not MIN_TOTAL_PIXELS <= 1024 * 1024 <= MAX_TOTAL_PIXELS:
        raise SystemExit("FATAL: generation size outside the gateway pixel range")

    rows = [inspect_ship(a) for a in ASSETS]
    if args.report:
        for r in rows:
            print("  %-8s %s" % (a_id(r), "MISSING" if r is None else
                  "%dx%d  %.1f KiB  %d colours  opaque %.1f%%"
                  % (r["size"][0], r["size"][1], r["kib"], r["colours"], r["opaque_pct"])))
        return

    selected = ASSETS
    if args.only:
        want = [s.strip().upper() for s in args.only.split(",") if s.strip()]
        bad = [w for w in want if w not in {a["id"] for a in ASSETS}]
        if bad:
            raise SystemExit("FATAL: unknown ids %s" % ", ".join(bad))
        selected = [a for a in ASSETS if a["id"] in want]

    if args.dry_run:
        for a in selected:
            if a.get("plate"):
                shape = "plate width %d px" % a.get("width", 900)
            else:
                shape = "long edge %d px" % a["long_edge"]
            print("  %-8s %-20s gen %s -> %-22s -> %s"
                  % (a["id"], a["file"], GEN_SIZE, shape,
                     os.path.join("tools/wuhuolong/assets/img", a["file"])))
        return

    env = load_env()
    os.makedirs(SHIP_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)
    produced, failed = [], []
    for a in selected:
        row = process(env, a, args.force)
        (produced if row is not None else failed).append(a["id"])
    print("\nprocessed %d / %d" % (len(produced), len(selected)))
    if failed:
        print("!! FAILED (loudly): %s" % ", ".join(failed))
        sys.exit(1)


def a_id(row):
    if row is None:
        return "?"
    return row["id"]


if __name__ == "__main__":
    main()
