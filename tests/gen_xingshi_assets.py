"""Generate 醒狮 (tools/xingshi) art: monsters, bosses, skill icons and hit effects.

Reuses the proven 舞火龙 pipeline rather than reimplementing it:
  * gen_wuhuolong_dragon.request_image  -> the MaaS image gateway (same key as 文生图)
  * gen_wuhuolong_dragon.key_pipeline   -> chroma-key + border flood fill + despill
Two globals are monkeypatched:
  * SHIP_DIR / RAW_DIR -> tools/xingshi/assets/img and docs/research/xingshi-drafts/raw
  * CROP_PAD_PX = 0    -> the game anchors a foe by its texture height and puts the
    sheet's bottom edge on GROUND, so any bottom padding lifts the feet off the floor.

Facing convention (matches the game's existing flip rule, do not "fix" the rule):
  the merge `(lion.x > f.x ? 1 : -1)` leaves a foe UNMIRRORED when the lion is to its
  right, i.e. when the foe is on the left and must face right. So every monster must be
  drawn facing RIGHT. Art drawn facing left walks backwards. --facing checks this.

Raw PNGs are cached under docs/research/xingshi-drafts/raw so a rerun never re-calls the
gateway (the model is not deterministic; the cache is what makes shipped bytes stable).

Usage:
    python3 tests/gen_xingshi_assets.py --dry-run
    python3 tests/gen_xingshi_assets.py --only X-FOE-WALK,X-ICON-PARRY
    python3 tests/gen_xingshi_assets.py --report
    python3 tests/gen_xingshi_assets.py --qc
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_wuhuolong_dragon as gwd  # noqa: E402
import vision_ask  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHIP_DIR = os.path.join(ROOT, "tools", "xingshi", "assets", "img")
RAW_DIR = os.path.join(ROOT, "docs", "research", "xingshi-drafts", "raw")
SHOTS = os.path.join(ROOT, "docs", "research", "xingshi-drafts", "shots")

gwd.SHIP_DIR = SHIP_DIR
gwd.RAW_DIR = RAW_DIR
gwd.CROP_PAD_PX = 0

# Shared look for every 醒狮 asset: 年画/剪纸 flat colour, heavy ink outline.
STYLE = (
    "中国年画与剪纸风格的2D横版动作游戏素材，平涂色块、粗墨黑描边、不透明剪影；"
    "无写实渲染、无光影渐变、无地面、无投影、无粒子、无背景景物；"
    "边缘干净锐利便于抠图，平面侧视，不用文字、不用水印、不用边框。"
)
NEG = (
    "文字，水印，签名，logo，text，watermark，数字，标签，边框，网格线，"
    "写实照片，3D渲染，三维立体，日式动漫，西方魔幻，可爱化，"
    "地面，投影，地面阴影，多个主体，多个头，残影，运动模糊，"
    "模糊，低分辨率，噪点，jpeg压缩伪影"
)
# Re-applied last on every keyed asset: the model sometimes paints a gradient or a dark
# vignette instead of flat magenta, and key_pipeline then has nothing to remove.
BG = (
    "**背景必须是同一种纯品红#FF00FF 纯色平涂**：从画面四角到四边完全一致，"
    "绝对不要渐变、不要暗角、不要光晕、不要纹理、不要投影、不要装饰性背景；"
    "主体之外的一切区域都必须是这个品红。"
)
# Applied to monsters/bosses only. The model defaults to a front-facing portrait, which
# is wrong for a side-scroller and cannot be fixed by mirroring, so the profile is spelled
# out with a checkable cue ("only one eye visible").
SIDE = (
    "**这是一张角色侧面立绘（side view / profile）**：画角色的正侧面轮廓，"
    "**脸上只露出一只眼睛、只看得见一侧脸颊**，鼻梁与口部朝向画面右侧，"
    "身体同样侧对观众、四肢分前后而不是左右对称。"
    "**绝对不要正面朝观众**：不要正脸、不要两只眼睛左右对称、不要左右对称的站姿。"
    "**只有一个完整主体**，不被画面四边切断；主体居中并留出至少八分之一空白余量。"
    "**最低点（脚底或下摆）位于画面最下缘附近，底下不要留大片空白**。"
)

ASSETS = [
    {
        "id": "X-FOE-WALK", "file": "foe-walk.webp", "long_edge": 448,
        "body": (
            "2D横版动作游戏的**小怪**：一只「晦气」小鬼——年关里聚成的霉运化身。"
            "**缩到实机约 48 像素高仍要一眼可辨**：只用大色块 + 极粗墨黑描边，细节越少越好。"
            "外形：矮胖圆滚的一团青灰烟气身体，**两条粗短的腿**站在地上，"
            "**两只又大又亮的幽绿眼睛**（缩略尺寸下仍是画面最亮的点），一张咧开的黑嘴，"
            "头顶一枚歪斜的破铜钱，双手短小前伸。"
            "配色只许四色：青灰#3E4A56 身体、纯黑#12161C 描边与嘴、"
            "幽绿#8CFF5A 眼、暗红#7A2A22 铜钱。"
        ),
    },
    {
        "id": "X-FOE-FLY", "file": "foe-fly.webp", "long_edge": 448,
        "body": (
            "2D横版动作游戏的**空中怪**：一只「纸鸢蝠」——用旧年画糊成的蝙蝠纸鸢。"
            "**缩到实机约 46 像素高仍要一眼可辨**。"
            "外形：**一对张开的方形纸翼**（纸面可见简单折痕与竹骨）、"
            "中间是一个小小的蝙蝠身子、**两只幽绿发亮的圆眼**、"
            "**没有腿**，身体下方只垂两条短飘带。"
            "纸翼面积要大、轮廓要方硬，让人一眼看出是「会飞的纸扎」。"
            "配色只许四色：米白#E8E2D2 纸、纯黑#12161C 描边与竹骨、"
            "朱红#B03A2A 翼边纹、幽绿#8CFF5A 眼。"
        ),
    },
    {
        "id": "X-FOE-ELITE", "file": "foe-elite.webp", "long_edge": 512,
        "body": (
            "2D横版动作游戏的**精英怪**：一尊「瘟将」——披甲的大鬼。"
            "**缩到实机约 76 像素高仍要一眼可辨**：大块面 + 极粗墨黑描边，不要碎细节。"
            "外形：**宽肩厚甲的武将身形**，肩甲做成两只张口的兽头，"
            "头戴一顶插着两支短雉尾的盔，**脸上是一张纯黑的鬼面具、只露两只幽绿眼睛**，"
            "一手扛一面**破洞的三角令旗**，双脚着厚底战靴。"
            "配色只许四色：暗青#1E2A33 甲、纯黑#12161C 描边与面具、"
            "朱红#8E2B22 令旗与甲缘、幽绿#8CFF5A 眼。"
        ),
    },
    {
        "id": "X-FOE-RANGED", "file": "foe-ranged.webp", "long_edge": 512,
        "body": (
            "2D横版动作游戏的**远程怪**：一只「灯妖」——提灯放晦气的妖。"
            "**必须一眼看出它是远程攻击的**：它**双手端着一盏点亮的中式纸灯笼**，"
            "灯笼用双臂**平举指向画面右前方**（像端着一门小炮），"
            "灯笼口正在喷出一小团幽绿光气。"
            "外形：瘦长的青灰身体、弓背、**两只幽绿大眼**、无口、"
            "腰间插着几支备用的未点亮小灯。"
            "**缩到实机约 60 像素高仍要可辨**：大色块 + 极粗墨黑描边，不要碎细节。"
            "配色只许四色：青灰#3E4A56 身体、纯黑#12161C 描边、"
            "暖黄#FFC24A 灯笼纸与光、幽绿#8CFF5A 眼与喷出的光气。"
        ),
    },
    {
        "id": "X-FOE-SHIELD", "file": "foe-shield.webp", "long_edge": 512,
        "body": (
            "2D横版动作游戏的**重甲怪**：一只「石狮卫」——石头雕的守门狮。"
            "**必须一眼看出它「下面扛打，只能从上面挑空破防」**："
            "它**双手把一面又大又厚的圆盾举在身前（朝向画面右侧）**，"
            "盾面占身体一半以上面积、盾中央是一只凸起的狮头浮雕，"
            "只露出上半个脑袋和两只幽绿眼睛。"
            "外形：蹲坐的石狮身形、方硬的石纹分块、粗短四肢。"
            "**缩到实机约 62 像素高仍要可辨**：大色块 + 极粗墨黑描边。"
            "配色只许四色：石青#4A5560 身体、纯黑#12161C 描边、"
            "暗金#8A6A2A 盾面与狮头浮雕、幽绿#8CFF5A 眼。"
        ),
    },
    {
        "id": "X-BOSS-0", "file": "boss-menshen.webp", "long_edge": 512,
        "body": (
            "2D横版动作游戏的**关底Boss**：一尊「门神」——贴在门上的驱邪武将成了妖。"
            "**缩到实机约 130 像素高仍要一眼可怖可辨**：大块面 + 极粗墨黑描边。"
            "外形：**极宽的肩膀与倒三角的魁梧身形**，披挂重甲，"
            "**满脸炸开的黑髯**，戴一顶双翅官帽，"
            "**双手斜持一柄长柄大斧（钺）**，斧刃朝画面右上，双脚八字站开。"
            "配色只许四色：朱红#8E2B22 甲与袍、纯黑#12161C 描边与髯、"
            "暖金#FFD98A 甲缘纹与斧面、亮白#F0E6D2 官帽与眼白。"
        ),
    },
    {
        "id": "X-BOSS-1", "file": "boss-lantern.webp", "long_edge": 512,
        "body": (
            "2D横版动作游戏的**关底Boss**：一只「灯妖」——由一整串灯笼堆成的妖。"
            "**缩到实机约 130 像素高仍要一眼可辨**：大块面 + 极粗墨黑描边。"
            "外形：**身体由五六个大小不一的中式纸灯笼串成**（自下而上由大变小），"
            "最上面一盏最大的灯笼是它的头、**灯笼纸上有两只幽绿发亮的眼**，"
            "身体两侧各伸出三条由灯笼穗变成的细长手臂，"
            "**没有腿**，最下一盏灯笼下方垂着长流苏。"
            "配色只许四色：暖金#FFC24A 灯纸、纯黑#12161C 描边与竹骨、"
            "朱红#B03A2A 灯穗与纹、幽绿#8CFF5A 眼。"
        ),
    },
    {
        "id": "X-BOSS-2", "file": "boss-lionking.webp", "long_edge": 512,
        "body": (
            "2D横版动作游戏的**关底Boss**：一只「狮王」——被晦气侵蚀的醒狮狮头。"
            "**缩到实机约 130 像素高仍要一眼可辨**：大块面 + 极粗墨黑描边。"
            "外形：**一个巨大的舞狮狮头**（正侧面朝右），"
            "**额上一只独角**，**血盆大口张开露出上下獠牙**，"
            "**一圈炸开的火焰状鬃毛**绕在头后，下颌垂着长须，"
            "**两只又大又亮的冰蓝眼睛**（与全身对比最强的点）；"
            "头下只露出一小截身体与两只前爪。"
            "配色只许四色：冰蓝#9FE0FF 眼与额纹、米白#EDE6D6 狮头面、"
            "纯黑#12161C 描边与口内、朱红#B03A2A 鬃毛与须。"
        ),
    },
    {
        "id": "X-BOSS-3", "file": "boss-waterghost.webp", "long_edge": 512,
        "body": (
            "2D横版动作游戏的**关底Boss**：一只「水鬼」——溺死在水巷里的长发鬼。"
            "**缩到实机约 130 像素高仍要一眼可辨**：大块面 + 极粗墨黑描边。"
            "外形：**瘦高下垂的身形**，一头**又长又直的湿发盖住整张脸**、"
            "发缝里只露**两只幽绿发亮的眼**；"
            "**两条极长的水袖**垂到脚边并向两侧张开如翅，"
            "**没有脚**、下摆化成三四条水舌悬着，肩头趴着一只小青蛙。"
            "配色只许四色：青碧#2E6B5E 衣与水袖、纯黑#12161C 描边与发、"
            "亮青#7FE0C0 水的反光与眼周、亮白#E8F5F0 眼。"
        ),
    },
    {
        "id": "X-BOSS-4", "file": "boss-lanternlord.webp", "long_edge": 512,
        "body": (
            "2D横版动作游戏的**最终Boss**：一尊「灯魔」——最大最凶的灯笼之主。"
            "**缩到实机约 145 像素高仍要一眼可怖可辨**：大块面 + 极粗墨黑描边。"
            "外形：**极其魁梧的紫黑身形**，**头顶一圈由八盏小灯笼组成的冠**，"
            "脸上**没有五官、只有横向裂开的四只幽绿眼睛**，"
            "**双臂粗壮、指甲尖长**，**颈上缠着一串锁链**、链条垂到膝下，"
            "肩上披一件破洞的长披风，双脚是两只燃烧的灯笼状足。"
            "配色只许四色：紫黑#3A2038 身与披风、纯黑#12161C 描边、"
            "幽绿#8CFF5A 四眼与灯火、暗金#8A6A2A 链与冠。"
        ),
    },
    {
        "id": "X-ICON-PARRY", "file": "icon-parry.webp", "long_edge": 256, "square": True,
        "body": (
            "2D横版动作游戏的**技能图标**，圆形徽章式构图，**缩到 30 像素仍要一眼可辨**。"
            "内容：一面**中式小圆盾**正面居中，盾面中央是一只**醒狮狮头的正面脸**（睁眼、有角），"
            "盾的左右各有一道**向内的弧形护盾光**，表示「格挡」。"
            "只用三色：亮青#9FE0FF 盾与光、纯黑#12161C 极粗描边、亮白#F0FAFF 高光。"
            "绝对不要文字、不要数字、不要边框、不要复杂纹样。"
            "**主体占满画面并居中**，背景为纯品红#FF00FF 纯色平涂。"
        ),
    },
    {
        "id": "X-ICON-SWEEP", "file": "icon-sweep.webp", "long_edge": 256, "square": True,
        "body": (
            "2D横版动作游戏的**技能图标**，**缩到 30 像素仍要一眼可辨**。"
            "**构图必须接近正方形、充满画面**（不要画成又扁又长的横条、不要长宽比超过 1.2:1）。"
            "内容：**一道粗壮的弧线绕成一圈**（像一圈贴着地面扫过去的尘浪），"
            "**弧线本身很粗、首尾不相接、留一个缺口**，弧上有**三道短促的切线速度线**，"
            "弧的内侧散着几块**被扫起的碎石**。"
            "**必须读作「横扫一圈」**。"
            "**绝对不要画成月牙、弯刀、镰刀，也不要画成又扁又长的横条**。"
            "只用三色：暖金#FFD06A 弧与尘、纯黑#12161C 极粗描边、亮白#FFF3D6 高光。"
            "绝对不要文字、不要数字、不要边框。"
            "主体居中并留出约十分之一空白，背景为纯品红#FF00FF 纯色平涂。"
        ),
    },
    {
        "id": "X-ICON-LAUNCH", "file": "icon-launch.webp", "long_edge": 256, "square": True,
        "body": (
            "2D横版动作游戏的**技能图标**，**缩到 30 像素仍要一眼可辨**。"
            "内容：**一柱自画面最底部向上冲起的粗壮气流柱**——柱体**下粗上尖**"
            "（底部宽、越往上越收细成一个尖），柱内有三道**朝上的长箭头状速度线**，"
            "柱底有一小圈被掀起的碎屑弧，**柱顶有一个被向上抛起的小小剪影**（简单剪影即可）。"
            "**第一个要读出来的信息是「向上冲」**。"
            "**绝对不要画成向下的锥形、不要砸地、不要下坠、不要地面冲击波**。"
            "只用三色：亮紫#C7A6FF 气流、纯黑#12161C 极粗描边、亮白#F0E6FF 高光。"
            "绝对不要文字、不要数字、不要边框。"
            "主体居中并留出约十分之一空白，背景为纯品红#FF00FF 纯色平涂。"
        ),
    },
    {
        "id": "X-ICON-ULT", "file": "icon-ult.webp", "long_edge": 256, "square": True,
        "body": (
            "2D横版动作游戏的**终极技能图标**，**缩到 32 像素仍要一眼可辨、最醒目**。"
            "内容：**一圈放射状的爆发光**（十二道长短交替的尖锐光芒），"
            "中心是一**棵绑着红绸的生菜／青**（采青用的青绿蔬菜，叶片要大方，不要碎叶），"
            "外圈再套一道**金色圆环**。"
            "只用四色：亮橙#FF8A3D 爆发光、暖金#FFD45E 圆环与绸、"
            "纯黑#12161C 极粗描边、青绿#7FD65A 菜叶。"
            "绝对不要文字、不要数字、不要边框。主体占满居中，背景为纯品红#FF00FF 纯色平涂。"
        ),
    },
    {
        "id": "X-FX-SLASH", "file": "fx-slash.webp", "long_edge": 448,
        "body": (
            "2D横版动作游戏的**挥击刀光特效**，**必须是单侧弧形、绝不允许左右对称**。"
            "内容：一道**从右上甩向左下的新月形刀光**，弧的外缘锋利明亮、内缘虚化收细，"
            "弧的凸面朝向画面右侧，弧尾收成一个尖；"
            "**只有弧的外侧**有两条细速度线，内侧什么都没有。"
            "颜色限暖金#FFC24A、亮白#FFF3D6，不得出现蓝紫青绿。"
            "绝对不要文字、不要边框、不要圆形徽章感。背景为纯品红#FF00FF 纯色平涂，"
            "特效居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "X-FX-HIT", "file": "fx-hit.webp", "long_edge": 448,
        "body": (
            "2D横版动作游戏的**打击命中特效**，**必须有强烈方向性、绝不允许左右对称**。"
            "内容：一次从左上向右下的猛烈撞击定格——"
            "中心是一小块**不规则亮白撞点**，沿撞击方向向右下**甩出数条长短不一的速度线与碎屑**，"
            "**只在撞击前方一侧**张开一道新月形冲击弧，反向一侧几乎没有。"
            "颜色限暖金#FFB347、橙红#FF8A3D、亮白#FFF3D6，不得出现蓝紫青绿。"
            "绝对不要文字、不要边框、不要圆形徽章感。背景为纯品红#FF00FF 纯色平涂，"
            "特效居中并留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "X-FX-PARRY", "file": "fx-parry.webp", "long_edge": 448,
        "body": (
            "2D横版动作游戏的**格挡成功特效**：一圈被撞击顶住的**护盾光环**。"
            "内容：**一枚亮青色的厚圆环**（环带自身有粗细变化），"
            "环的**正上方被顶出一个明亮的缺口与迸出的亮白火花**，"
            "环内有几道短促的向内收缩的弧线。"
            "**必须读作能量环，不要画成盾牌或徽章**。"
            "颜色限亮青#9FE0FF、亮白#F0FAFF，不得出现红黄橙绿。"
            "绝对不要文字、不要边框。背景为纯品红#FF00FF 纯色平涂，居中留出八分之一余量。"
        ),
    },
    {
        "id": "X-FX-SWEEP", "file": "fx-sweep.webp", "long_edge": 448,
        "body": (
            "2D横版动作游戏的**地面横扫特效**：一圈**贴地扩散的尘浪弧**。"
            "内容：**一道被极度压扁的宽弧**（宽高比约五比一），"
            "弧的上缘是**一排高低起伏的尖齿状尘头**（像被掀起的土浪），"
            "弧的下缘平直贴地，弧的两端各拖出一小截速度线。"
            "**必须读作贴地的冲击浪，不要画成彩虹或月牙**。"
            "颜色限暖金#FFD06A、土黄#C98A3D，不得出现蓝紫青绿。"
            "绝对不要文字、不要边框。背景为纯品红#FF00FF 纯色平涂，居中留出八分之一余量。"
        ),
    },
    {
        "id": "X-FX-LAUNCH", "file": "fx-launch.webp", "long_edge": 448,
        "body": (
            "2D横版动作游戏的**上挑特效**：**一柱自下而上冲起的粗气流柱**。"
            "内容：**下粗上尖的一柱弧形气流**（左右不对称、整体略向右倾），"
            "柱内有三道向上收束的亮白速度线，柱底有一小圈被掀起的碎屑弧。"
            "**必须读作向上的冲击柱，不要画成火焰或箭头图标**。"
            "颜色限亮紫#C7A6FF、亮白#F0E6FF，不得出现红黄橙绿。"
            "绝对不要文字、不要边框。背景为纯品红#FF00FF 纯色平涂，居中留出八分之一余量。"
        ),
    },
    {
        "id": "X-FX-BURST", "file": "fx-burst.webp", "long_edge": 512,
        "body": (
            "2D横版动作游戏的**必杀技爆发特效**：一圈**巨大的放射状爆裂光**。"
            "内容：**十六道长短交替的尖锐光芒**自中心向外炸开（不要等长、不要对称），"
            "中心是一小块**不规则的亮白核心**，光芒之间夹着几片飞散的金色碎屑。"
            "**必须读作一次大爆炸的定格，不要画成太阳、齿轮或法阵**。"
            "颜色限亮橙#FF8A3D、暖金#FFD45E、亮白#FFF3D6，不得出现蓝紫青绿。"
            "绝对不要文字、不要边框。背景为纯品红#FF00FF 纯色平涂，居中留出八分之一余量。"
        ),
    },
    {
        "id": "X-FX-SPARK", "file": "fx-spark.webp", "long_edge": 128,
        "body": (
            "2D游戏里的**小粒子闪光**：一枚极简的**四角星形闪光**（十字加一点旋转），"
            "中心一个亮白小圆点，四个角向外收细成尖，**形状要非常简洁**，"
            "缩到 8 像素仍然是个亮点。"
            "颜色限亮白#FFFFFF 与暖金#FFD98A，不得出现蓝紫青绿。"
            "绝对不要文字、不要边框。背景为纯品红#FF00FF 纯色平涂，居中留出八分之一余量。"
        ),
    },
    {
        "id": "X-GROUND-ROAD", "file": "ground-road.webp", "plate": True,
        "width": 900, "crop": [0.30, 0.92],
        "body": (
            "2D横版动作游戏的**地面带素材**（整幅画面，不要纯色背景、不要留空、"
            "不要文字、不要人物）。"
            "**这是横版游戏里角色脚踩的那条地面，必须是「从侧面看过去的地面剖面」"
            "（side view / cross-section），绝不是俯视的路面俯视图。**"
            "构图：**画面上缘约六分之一处是一条明确的水平地面线**——一条有厚度的"
            "路缘石压边，其上是极少一点暗色土坡远景；"
            "**顶线下方的绝大部画面是地面的侧面剖面**：夯土与碎石的层理、"
            "几道水平的暗色沉积线、零星嵌在土里的石块，越往下越暗。"
            "**绝对不要画成俯视的路面砖块拼接、不要透视、不要近大远小、"
            "不要地平线、不要天空、不要建筑。**"
            "色调沉稳偏冷（#2A3038 到 #4A5058 拉开明暗），明暗均匀，不要单一强光斑。"
            "**必须可以左右无缝平铺**：左右两端的纹理要能自然接上。"
        ),
    },
    {
        "id": "X-GROUND-WATER", "file": "ground-water.webp", "plate": True,
        "width": 900, "crop": [0.30, 0.92],
        "body": (
            "2D横版动作游戏的**水面带素材**（整幅画面，不要纯色背景、不要留空、"
            "不要文字、不要人物）。"
            "**这是横版游戏里角色脚踩的水面，必须是「从侧面看过去的水体剖面」"
            "（side view / cross-section），绝不是俯视的水面俯视图。**"
            "构图：**画面上缘约五分之一处是一条水平的水面线**——细碎的水平波纹与"
            "极微弱的月光反光，其上只有很窄的一条暗色远景；"
            "**顶线下方是水体的侧面剖面**：由上到下逐渐变暗的暗青黑水体"
            "（#1E3038 顶部 → #0E1A1E 底部），水中浮着几缕横向的暗色水纹。"
            "**绝对不要画成俯视的水面、不要透视、不要天空或建筑倒影、"
            "不要地平线、不要月亮。**"
            "**必须可以左右无缝平铺**：左右两端的波纹要能自然接上。"
        ),
    },
    {
        "id": "X-PICK", "file": "pick-green.webp", "long_edge": 192,
        "body": (
            "2D横版动作游戏里的**拾取物**：一份「采青」——"
            "**一棵绑着红绸与红绳的青绿生菜**（广东醒狮采青用的青），"
            "叶片要**大而简单、三五片即可，不要碎叶**，"
            "红绸在菜根处打一个结、两端向外飘起。"
            "**缩到 24 像素仍要一眼认出是一棵扎红绸的青菜**。"
            "颜色限青绿#7FD65A、深绿#2E6B3E 叶脉、朱红#B03A2A 绸、纯黑#12161C 描边。"
            "绝对不要文字、不要边框。背景为纯品红#FF00FF 纯色平涂，居中留出八分之一余量。"
        ),
    },
]


def shipped(asset):
    return os.path.join(SHIP_DIR, asset["file"])


def raw_path(asset):
    return os.path.join(RAW_DIR, "%s.png" % asset["id"])


def gen(asset, force, rekey=False):
    dest = shipped(asset)
    raw = raw_path(asset)
    if rekey:
        # Re-run only the pipeline on the cached raw: lets a post-process change (square
        # padding, crop) reach art that was already reviewed, without a new generation.
        if not os.path.exists(raw):
            print("  NO RAW to rekey")
            return ("FAIL", None, 0)
        print("  rekey from cached raw (no gateway call)")
    elif not force and os.path.exists(dest):
        im = Image.open(dest)
        return ("SKIP", im.size, os.path.getsize(dest) / 1024.0)
    if not rekey and not force and os.path.exists(raw):
        print("  reuse raw (no gateway call)")
    elif not rekey:
        env = gwd.load_env()
        # Plates are full-bleed art, so they must not get the "no ground/no background"
        # clause that keyed sprites need.
        prompt = asset["body"]
        if not asset.get("plate"):
            prompt += "\n" + STYLE
            if asset["id"].startswith(("X-FOE", "X-BOSS")):
                prompt += "\n" + SIDE
            prompt += "\n" + BG
        print("  prompt %d chars -> gateway" % len(prompt))
        r = gwd.request_image(env, prompt, True)
        if r is None:
            return ("FAIL", None, 0)
        url, api_size = r
        n = gwd.download(url, raw)
        print("  api %s  raw %.0f KB (cached)" % (api_size, n / 1024.0))
    if asset.get("plate"):
        gwd.plate_pipeline(raw, asset)
    else:
        gwd.key_pipeline(raw, asset)
        if asset.get("square"):
            # Pad to a square so every skill icon fits its round button at one scale;
            # a wide emblem would otherwise shrink to a sliver.
            sp = Image.open(dest).convert("RGBA")
            side = max(sp.size)
            pad = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            pad.paste(sp, ((side - sp.width) // 2, (side - sp.height) // 2), sp)
            pad.save(dest, "WEBP", quality=gwd.WEBP_QUALITY, method=6)
        # A key that removed almost nothing means the model ignored the magenta ground
        # (it is not deterministic), so the sprite would ship as an opaque rectangle.
        keep = float((np.asarray(Image.open(dest).convert("RGBA"))[..., 3] >= 128).mean())
        if keep >= 0.95:
            os.remove(dest)
            print("  KEY FAILED: %.0f%% still opaque -- background was not magenta" % (keep * 100))
            return ("FAIL", None, 0)
    im = Image.open(dest)
    return ("OK", im.size, os.path.getsize(dest) / 1024.0)


def report():
    print("%-14s %-24s %-11s %8s  %s" % ("id", "file", "size", "KiB", "state"))
    for a in ASSETS:
        p = shipped(a)
        if not os.path.exists(p):
            print("%-14s %-24s %-11s %8s  MISSING" % (a["id"], a["file"], "-", "-"))
            continue
        im = Image.open(p)
        arr = np.asarray(im.convert("RGBA"))
        alpha = arr[..., 3]
        op = alpha >= 128
        corners = [int(alpha[0, 0]), int(alpha[0, -1]), int(alpha[-1, 0]), int(alpha[-1, -1])]
        # bottom row must hold real pixels: the game stands a foe on the sheet's bottom edge.
        bottom_rows = int(op[-2:].sum())
        print("%-14s %-24s %-11s %8.1f  corners=%s bottompx=%d opaque=%.0f%%"
              % (a["id"], a["file"], "%dx%d" % im.size, os.path.getsize(p) / 1024.0,
                 corners, bottom_rows, 100.0 * op.sum() / alpha.size))


QUESTION = {
    "monster": ("这是一个2D游戏怪物素材。请逐条简答：(1)它画的是什么？"
                "(2)它是侧面朝右的吗（脸与正面朝向画面右侧）？"
                "(3)它是不是只有一个完整主体、没被画面边缘切断？"
                "(4)画面里有没有文字、水印、边框或网格线？"
                "(5)主体有没有缩得很小、留了大片空白？"),
    "icon": ("这是一个游戏技能图标。请逐条简答：(1)它表达什么动作或含义？"
             "(2)轮廓够简洁吗（缩到30像素还看得清吗）？"
             "(3)有没有文字或数字？(4)主体是否居中、有没有被切断？"),
    "fx": ("这是一个游戏打击特效素材。请逐条简答：(1)它像什么特效？"
           "(2)有没有明确的动势或方向感？(3)有没有文字或边框？"
           "(4)主体是否居中、有没有被切断？"),
}

FACING_Q = ("这张图是一个2D游戏怪物，游戏里它必须面朝画面右侧。"
            "请只回答一句，格式：朝向=左/右/无法判断。")


def facing(env, path):
    """Ask which way a sprite faces, but only trust the answer if the model also gets the
    horizontally mirrored copy right (mirrored answers must disagree). A model that cannot
    see orientation at all answers the same both ways, which is how this goes silent
    instead of fabricating a clean 'right'."""
    os.makedirs(SHOTS, exist_ok=True)
    base = os.path.splitext(os.path.basename(path))[0]
    flip_path = os.path.join(SHOTS, "_mirror-%s.png" % base)
    Image.open(path).convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT).save(flip_path)

    def one(p):
        txt, _ = vision_ask.ask(env, "qwen3.8-max", FACING_Q, [p])
        if "左" in txt:
            return "左"
        if "右" in txt:
            return "右"
        return "?"

    a = one(path)
    b = one(flip_path)
    if a in ("左", "右") and b in ("左", "右") and a != b:
        return a, "trusted"
    return (a if a != "?" else "?"), "UNTRUSTED (%s / mirrored %s)" % (a, b)


def qc(only=None):
    env = vision_ask.load_env()
    chosen = [a for a in ASSETS if not only or a["id"] in only]
    for a in chosen:
        p = shipped(a)
        if not os.path.exists(p):
            print("%-14s MISSING" % a["id"])
            continue
        kind = ("icon" if a["id"].startswith("X-ICON")
                else "fx" if a["id"].startswith("X-FX")
                else "monster")
        print("\n=== %s (%s) ===" % (a["id"], a["file"]))
        review = p
        if kind == "icon":
            # Review icons at their in-game size; at full size every icon "reads fine".
            os.makedirs(SHOTS, exist_ok=True)
            review = os.path.join(SHOTS, "_small-%s.png" % a["id"])
            thumb = Image.open(p).convert("RGBA")
            thumb.thumbnail((64, 64), Image.LANCZOS)
            thumb.save(review)
            print("  (reviewing downscaled to %dx%d)" % thumb.size)
        try:
            ans, _ = vision_ask.ask(env, "qwen3.8-max", QUESTION[kind], [review])
            print("  " + ans.strip().replace("\n", "\n  "))
        except Exception as exc:  # noqa: BLE001 - report and keep going
            print("  QC FAILED: %s" % exc)
            continue
        if kind == "monster":
            try:
                face, trust = facing(env, p)
                print("  facing: %s  %s" % (face, trust))
            except Exception as exc:  # noqa: BLE001
                print("  facing QC FAILED: %s" % exc)


def facing_report(only):
    """Gate for the side-view convention. Exits non-zero on anything not confidently
    facing right, so a front-facing or mirrored batch cannot pass unnoticed."""
    env = vision_ask.load_env()
    bad = []
    for a in ASSETS:
        if not a["id"].startswith(("X-FOE", "X-BOSS")):
            continue
        if only and a["id"] not in only:
            continue
        p = shipped(a)
        if not os.path.exists(p):
            print("%-14s MISSING" % a["id"])
            bad.append(a["id"])
            continue
        face, trust = facing(env, p)
        ok = face == "右" and trust == "trusted"
        print("%-14s facing=%s  %s%s" % (a["id"], face, trust, "" if ok else "   <<< REVIEW"))
        if not ok:
            bad.append(a["id"])
    print("\nfacing gate: %s" % ("PASS" if not bad else "FAIL -> " + ", ".join(bad)))
    return bad


def main():
    sys.stdout.reconfigure(line_buffering=True)
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--only", help="comma-separated asset ids")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--rekey", action="store_true",
                    help="re-run the pipeline on cached raws (no gateway call)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--qc", action="store_true")
    ap.add_argument("--facing", action="store_true",
                    help="side-view gate for monsters/bosses (exits 1 on failure)")
    args = ap.parse_args()

    want = [s.strip().upper() for s in args.only.split(",")] if args.only else None
    if want:
        bad = [w for w in want if w not in {a["id"] for a in ASSETS}]
        if bad:
            raise SystemExit("FATAL: unknown ids %s" % ", ".join(bad))

    if args.report:
        report()
        return
    if args.qc:
        qc(want)
        return
    if args.facing:
        if facing_report(want):
            sys.exit(1)
        return
    if args.dry_run:
        for a in ASSETS:
            if want and a["id"] not in want:
                continue
            print("  %-14s %-24s %s -> %s"
                  % (a["id"], a["file"], gwd.GEN_SIZE, os.path.relpath(shipped(a), ROOT)))
        print("  (%d assets)" % len([a for a in ASSETS if not want or a["id"] in want]))
        return

    os.makedirs(SHIP_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)
    done, failed = [], []
    for a in ASSETS:
        if want and a["id"] not in want:
            continue
        print("\n--- %s  %s ---" % (a["id"], a["file"]))
        state, size, kib = gen(a, args.force, args.rekey)
        print("  %s %s %.1f KiB" % (state, "%dx%d" % size if size else "-", kib))
        (failed if state == "FAIL" else done).append(a["id"])
    print("\nproduced/skipped %d / %d" % (len(done), len(done) + len(failed)))
    if failed:
        print("!! FAILED: %s" % ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
