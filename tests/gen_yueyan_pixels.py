"""Generate the 15 pixel-art top-down sprites for the yueyan-proto kitchen rebuild.

This is a NEW generator for the throwaway prototype tree. It is modelled on
tests/gen_yueyan_assets.py but the pipeline is fundamentally different: the
shipping tree needs smooth gongbi illustrations, this needs authentic crisp
pixel art for a top-down Overcooked-style kitchen game.

It never touches tools/yueyan/assets/img/ (the 22 frozen shipping assets) and
never touches tests/gen_yueyan_assets.py.

--------------------------------------------------------------------------
Gateway contract (docs/research/maas-image-api.md)
--------------------------------------------------------------------------
The ONLY working path is POST {MAAS_BASE_URL}/chat/completions with `content`
as a LIST of typed parts. /images/generations returns 400 "url error" on this
gateway and is never retried against -- this script has no code path to it.

`parameters.size` uses an ASTERISK ("1024*1024"); an 'x' silently falls back to
a square. Total pixels must sit in [589824, 16777216] or the gateway returns
HTTP 400 InvalidParameter, so a 32x32 sprite CANNOT be requested directly.
Everything is generated at 1024*1024 and post-processed down.

The image URL is at output.choices[0].message.content[i].image, an OSS URL that
expires in ~24h, so it is downloaded in the same breath it is returned.

The gateway has been returning quota errors (tpm_limit_exceeded,
"Allocated quota exceeded"). Those are retried with exponential backoff, and
sprites are generated in small batches with a pause between batches. A sprite
that still fails after the retry budget is reported loudly, never skipped
silently.

--------------------------------------------------------------------------
Pixel-art pipeline -- the load-bearing part
--------------------------------------------------------------------------
A diffusion model does not produce authentic pixel art. It produces a smooth
image that merely resembles pixel art. The grid is created HERE, locally:

    raw 1024*1024
      -> BOX   reduce to PRE_REDUCE * target      (area average, no interpolation)
      -> flood-fill background inward from the border (chroma-key + region grow)
      -> halo cleanup + 1-ring alpha erosion      (kills the bg fringe)
      -> NEAREST resize to the exact target dims   (the hard-edged pixel grid)
      -> alpha threshold to 0/255                  (no feathered edges)
      -> edge crossfade on the two tileable sprites (kills the wrap seam)
      -> nearest-of-30 quantize onto ONE shared palette, zero dithering
      -> lossless WEBP at the target dims

Why BOX then NEAREST rather than a single NEAREST step: a lone NEAREST at 32:1
samples exactly one pixel out of each 32x32 block, so every sprite pixel is an
arbitrary draw from whatever noise the diffusion pass left there. The result is
speckled mush, not flat pixel-art colour. The BOX stage is an area average -- it
interpolates nothing and blurs nothing across cell boundaries -- so the mandated
NEAREST snap lands on a representative colour instead of a random one. No
LANCZOS, no bicubic, no bilinear anywhere in this file.

Why lossless WEBP: lossy webp ringing would re-introduce exactly the fuzzy
anti-aliased edges this pipeline exists to remove. Lossless preserves every
pixel exactly, and at 24-48 px the files are a few hundred bytes anyway.

--------------------------------------------------------------------------
Style consistency -- the most important quality requirement
--------------------------------------------------------------------------
ONE shared PALETTE (30 warm Mid-Autumn tokens) and ONE byte-identical
STYLE_SUFFIX appended to all 15 prompts. The suffix locks pixel density, the
1-pixel #24140E outline treatment, the top-left light direction and the warm
palette; preflight asserts byte identity before any request is spent, the same
way gen_yueyan_assets.py does. Because every sprite is quantized onto the same
30 tokens with the same nearest-colour rule, palette consistency is structural
rather than hoped-for.

Deterministic by construction: zero randomness, no seeds, no shuffling. The only
non-determinism is the image model itself.

Usage:
    python tests/gen_yueyan_pixels.py                       # all 15, resumable
    python tests/gen_yueyan_pixels.py --only px-chef,P-04   # subset (stem or id)
    python tests/gen_yueyan_pixels.py --only px-cake-burnt --force
    python tests/gen_yueyan_pixels.py --dry-run             # plan only, no network
    python tests/gen_yueyan_pixels.py --report              # dims/palette/bytes
    python tests/gen_yueyan_pixels.py --contact-sheet       # style-consistency sheet
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import deque

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROTO_DIR = os.path.join(ROOT, "tools", "yueyan-proto")
SHIP_DIR = os.path.join(PROTO_DIR, "img")
RAW_DIR = os.path.join(SHIP_DIR, "raw")
CONTACT_SHEET = os.path.join(PROTO_DIR, "pixel-contact-sheet.png")

# --------------------------------------------------------------------------
# Gateway contract
# --------------------------------------------------------------------------
CHAT_PATH = "/chat/completions"      # the ONLY path; /images/generations 400s
GEN_SIZE = "1024*1024"               # asterisk, NOT 'x'
GEN_W, GEN_H = 1024, 1024
MIN_TOTAL_PIXELS = 589_824           # = 768**2, boundary inclusive
MAX_TOTAL_PIXELS = 16_777_216        # = 4096**2

# Quota retry budget. tpm_limit_exceeded needs real minutes, not seconds.
QUOTA_MARKERS = ("tpm_limit_exceeded", "allocated quota exceeded",
                 "quota exceeded", "throttling", "rate limit", "too many requests")
RETRY_MAX = 6
BACKOFF_BASE = 25.0
BACKOFF_FACTOR = 2.0
BACKOFF_CAP = 300.0

# --------------------------------------------------------------------------
# Pixel pipeline constants
# --------------------------------------------------------------------------
PRE_REDUCE = 2          # BOX stage lands at 2x target, then NEAREST snaps 2:1
SEAM_BAND = 3           # edge crossfade width, in target pixels, for the tiles
DESPECKLE_PASSES = 2    # isolated-pixel cleanup passes after quantization
DESPECKLE_VOTE = 3      # of 4 orthogonal neighbours must agree to flip a pixel
ALPHA_CUT = 128         # >= this is opaque, below is void
MAX_COLORS_PER_SPRITE = 24   # "limited palette" guidance band upper bound

# Flood-fill tolerances (squared distances).
BG_GLOBAL_TOL2 = 130 ** 2   # cap vs. the border seed colour
BG_LOCAL_TOL2 = 46 ** 2     # step vs. the already-accepted parent (handles gradients)
HALO_TOL2 = 96 ** 2         # fringe pixel still too close to the bg to keep

# --------------------------------------------------------------------------
# ONE shared palette: 30 warm Mid-Autumn tokens. Every sprite quantizes onto
# exactly these, so palette consistency is structural, not aspirational.
# --------------------------------------------------------------------------
PALETTE = [
    # Universal outline + deep shadow. Identical on every sprite -- this is what
    # makes the 1px outline treatment read as one game.
    ("ink",       0x24, 0x14, 0x0E),
    ("ink-soft",  0x40, 0x27, 0x18),
    # Warm wood: counter, kneading board, rack, firewood.
    ("wood-lt",   0xC9, 0x9A, 0x5E),
    ("wood-md",   0xA6, 0x74, 0x40),
    ("wood-dk",   0x7F, 0x53, 0x2B),
    # Stone tile: kitchen floor.
    ("tile-lt",   0xC6, 0xB2, 0x94),
    ("tile-md",   0xA0, 0x8B, 0x70),
    ("tile-dk",   0x7A, 0x67, 0x51),
    # Cream cloth + ceramic: chef hat/apron, bowls, plates.
    ("cream-lt",  0xFF, 0xF6, 0xE4),
    ("cream-md",  0xE7, 0xD6, 0xB6),
    ("cream-dk",  0xC3, 0xAF, 0x8D),
    # Skin.
    ("skin-lt",   0xF0, 0xB8, 0x8A),
    ("skin-dk",   0xC7, 0x84, 0x53),
    # Festive red accent.
    ("red-lt",    0xE0, 0x57, 0x45),
    ("red-dk",    0xA8, 0x2E, 0x24),
    # Iron: stove body. Warm grey, never cool.
    ("iron-lt",   0xA8, 0x94, 0x80),
    ("iron-md",   0x77, 0x63, 0x52),
    ("iron-dk",   0x4E, 0x3E, 0x31),
    # Fire: burner ring + flame.
    ("ember",     0xE8, 0x7A, 0x2A),
    ("flame",     0xF7, 0xC0, 0x3E),
    # Osmanthus gold, shared with the repo's established token.
    ("osmanthus", 0xE9, 0xB8, 0x4B),
    # Mooncake bake ladder. These five rungs are what make the four cake states
    # distinguishable at 24x24: pale -> light golden -> rich gold -> charred.
    ("dough-lt",  0xF2, 0xE6, 0xCB),
    ("dough-md",  0xDD, 0xC9, 0x9F),
    ("bake-lt",   0xEE, 0xC4, 0x6E),
    ("bake-md",   0xD0, 0x9C, 0x43),
    ("gold-dk",   0x93, 0x57, 0x1E),
    ("char",      0x2C, 0x1C, 0x14),
    # Fillings. yolk is deliberately pushed deep orange so the three bowls stay
    # separable at 24x24: against osmanthus it is ~78 apart, not ~38.
    ("lotus",     0xD9, 0xBD, 0x8E),
    ("yolk",      0xE2, 0x7A, 0x1C),
    # Cooling rack / plate highlight.
    ("plate-lt",  0xFA, 0xF0, 0xDC),
]

PALETTE_NAMES = [t[0] for t in PALETTE]
PALETTE_RGB = {(t[1], t[2], t[3]) for t in PALETTE}
INK_RGB = (PALETTE[0][1], PALETTE[0][2], PALETTE[0][3])
INK_GUARD2 = 72 ** 2      # never flood-grow through the outline: it is a barrier

# --------------------------------------------------------------------------
# Byte-identical style suffix. 15/15 prompts must end with exactly this.
# --------------------------------------------------------------------------
STYLE_SUFFIX = (
    "像素画风格，正交俯视视角top-down，画面无透视无倾斜无侧视无等距斜角，"
    "像素网格粗大且严格对齐，色块边缘硬朗锐利无抗锯齿，"
    "全图统一使用同一套暖色中秋色板：墨褐描边#24140E、暖木#C99A5E与#A67440与#7F532B、"
    "石砖#C6B294与#A08B70与#7A6751、奶油白#FFF6E4与#E7D6B6与#C3AF8D、"
    "桂花金#E9B84B、朱红#E05745、暖铁灰#A89480与#776352、"
    "火焰#E87A2A与#F7C03E、面团#F2E6CB、烘焙金#EEC46E与#D09C43与#93571E、焦黑#2C1C14，"
    "不得引入板外色，不得引入冷色，"
    "所有物件外缘统一一圈一个像素的墨褐#24140E描边，"
    "统一光源来自画面左上方，所有物件的暗面统一落在右下方，"
    "暖色节庆中秋氛围，食物看起来好吃诱人，"
    "不用渐变，不用柔光高光，不用抗锯齿，不用模糊，不用真实照片质感，"
    "不用文字，不用水印，高清像素画。"
)

NEG_COMMON = (
    "文字，水印，签名，logo，text，watermark，signature，"
    "真实照片，写实渲染，3D渲染，CG渲染，模糊，柔焦，景深虚化，抗锯齿，"
    "渐变，柔光，塑料光泽，镜面反射，高光过曝，"
    "冷色调，蓝色调，绿色调，银白色，黑白色，"
    "侧面视角，侧视图，斜45度视角，等距视角，isometric，透视变形，"
    "玉兔，嫦娥，月宫，广寒宫，春节，西式蛋糕，慕斯，奶油蛋糕，"
    "现代月饼礼盒，塑料包装，低分辨率，噪点，jpeg压缩伪影，多余物件，杂乱背景"
)

# --------------------------------------------------------------------------
# Authoritative manifest: exactly 15 rows.
#   transparent  -> chroma-key background removed, sprites composite over tiles
#   seamless     -> tileable, stays fully opaque, edges crossfaded for wrap
# --------------------------------------------------------------------------
SPRITES = [
    # --- tileable environment ---
    {
        "id": "P-01", "file": "px-floor.webp", "ship": (32, 32),
        "transparent": False, "seamless": True,
        "body": (
            "一块中式厨房地砖的俯视贴图，方形暖灰米色石砖铺地，砖缝为深一档的暖褐细线，"
            "砖面有极轻微的暖色斑驳与磨损，画面铺满整张图无任何留白，"
            "上下左右四边纹理连续相接可无缝平铺，无物件无道具无人物无边框无阴影。"
        ),
    },
    {
        "id": "P-02", "file": "px-counter.webp", "ship": (32, 32),
        "transparent": False, "seamless": True,
        "body": (
            "一块中式厨房木质台面的俯视贴图，暖褐木纹桌面，木纹横向平直走向均匀，"
            "板缝为深一档的暖褐细线，台面有极轻微的暖色磨痕，画面铺满整张图无任何留白，"
            "上下左右四边纹理连续相接可无缝平铺，无物件无道具无餐具无边框无阴影。"
        ),
    },
    # --- character ---
    {
        "id": "P-03", "file": "px-chef.webp", "ship": (32, 32),
        "transparent": True, "seamless": False,
        "body": (
            "2D俯视游戏的中式点心厨师角色精灵图，严格正交俯视，镜头在正上方垂直向下，"
            "角色的肩身轮廓是一个明显横向宽于纵向的暖褐#A67440色圆角矩形代表双肩与围裙背面"
            "而不是圆形，该矩形左右两端各伸出一小块肤色手臂且左右完全对称，"
            "矩形正中偏上压着一个明显更小的奶油白#FFF6E4正圆厨师帽顶并带一圈墨褐描边与朱红帽箍，"
            "帽顶小于肩身轮廓所以两侧露出暖褐肩面，绝对看不到人脸五官头发身体正面与腿部，"
            "角色居中四周留出至少八分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一个角色。"
        ),
    },
    # --- stations ---
    {
        "id": "P-04", "file": "px-stove.webp", "ship": (48, 48),
        "transparent": True, "seamless": False,
        "body": (
            "一座中式灶台的俯视形象，方形暖褐砖砌灶体铺满画面中部，"
            "灶面正中有一个正圆形深色灶口，灶口内是一圈清晰可见的圆形炉圈，"
            "炉圈内透出橙黄两色火焰，灶台居中四周留出至少八分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一座灶台。"
        ),
    },
    {
        "id": "P-05", "file": "px-board.webp", "ship": (48, 48),
        "transparent": True, "seamless": False,
        "body": (
            "一块中式揉面案板的俯视形象，长方形暖褐木质案板水平平放，"
            "板面有横向直木纹，板边有深一档木色包边，板上放一小团浅色面团与一根横放擀面杖，"
            "案板居中四周留出至少八分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一块案板。"
        ),
    },
    {
        "id": "P-06", "file": "px-plate-station.webp", "ship": (48, 48),
        "transparent": True, "seamless": False,
        "body": (
            "一座中式出餐晾饼台的严格正俯视形象，镜头位于正上方垂直向下拍摄，"
            "画面中心是一摞叠放的奶油白圆形瓷盘的顶视图，"
            "只能看到最上面一只盘子的正圆形空置盘面与下面几只盘子露出的一圈圈同心圆边缘，"
            "绝对看不到台子的立面腿脚侧面横档与任何斜角与对角投影，盘面完全空置无馅料，"
            "盘子外缘有一圈墨褐描边，盘子居中四周留出至少八分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一摞盘子。"
        ),
    },
    {
        "id": "P-07", "file": "px-rack.webp", "ship": (48, 48),
        "transparent": True, "seamless": False,
        "body": (
            "一座中式食材架的严格正俯视形象，镜头位于架子正上方垂直向下拍摄，"
            "只能看到水平的暖褐木质隔板板面与板上并排的三只奶油白圆形陶碗的圆形碗口，"
            "绝对看不到架子的立面腿脚侧面与横档与架空腔，"
            "三只碗内分别盛桂花金、浅米褐与深橙三色馅料且三色一眼可分，"
            "架体居中四周留出至少八分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一座食材架。"
        ),
    },
    {
        "id": "P-08", "file": "px-firewood.webp", "ship": (32, 32),
        "transparent": True, "seamless": False,
        "body": (
            "一小堆柴火的俯视形象，三到五根暖褐粗柴枝交叉堆叠成一小堆，"
            "柴枝两端切口为浅木色圆面清晰可辨，柴堆轮廓粗壮分明不细碎，"
            "柴堆居中四周留出至少八分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一堆柴火。"
        ),
    },
    # --- mooncake states: the four rungs must be unmistakable at 24x24 ---
    {
        "id": "P-09", "file": "px-cake-raw.webp", "ship": (24, 24),
        "transparent": True, "seamless": False,
        "body": (
            "一枚尚未烘烤的生月饼面团的俯视形象，正圆形浅色生面团，"
            "表面为极浅的奶白米色平整哑光，无任何纹样压印无任何焦色，边缘微微鼓起，"
            "面团居中四周留出至少四分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一枚生面团。"
        ),
    },
    {
        "id": "P-10", "file": "px-cake-baking.webp", "ship": (24, 24),
        "transparent": True, "seamless": False,
        "body": (
            "一枚正在烘烤中的月饼的严格正俯视形象，正圆形饼身平放在一个深一档暖褐色"
            "方形烤盘正中央，饼身整体呈明亮的浅金黄色比生面团的奶白明显更黄，"
            "饼面平滑尚无任何压花纹样，饼边比饼心略深，烤盘与饼身一起居中"
            "四周留出至少四分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一枚月饼与它的烤盘。"
        ),
    },
    {
        "id": "P-11", "file": "px-cake-golden.webp", "ship": (24, 24),
        "transparent": True, "seamless": False,
        "body": (
            "一枚刚烤好出炉的完美月饼的严格正俯视形象，已脱离烤盘单独摆放在台面上，"
            "正圆形饼身呈浓郁深沉的金棕色整体明度明显比浅金黄更暗更饱和，表面油润诱人，"
            "表面有清晰规整的月饼压花纹样：饼心一个圆形花印与四周一圈花瓣状压印凹槽，"
            "凹槽用深一档深棕色线条明确勾出一眼可读，饼边饱满鼓起且颜色最深，"
            "饼体居中四周留出至少四分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一枚月饼绝无烤盘。"
        ),
    },
    {
        "id": "P-12", "file": "px-cake-burnt.webp", "ship": (24, 24),
        "transparent": True, "seamless": False,
        "body": (
            "一枚彻底烤焦报废的月饼的俯视形象，正圆形饼身呈近黑色焦炭状，"
            "表面布满深黑龟裂纹与少量暗灰焦渣，毫无金色毫无食欲感，饼边干裂，"
            "饼体居中四周留出至少四分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一枚月饼。"
        ),
    },
    # --- fillings ---
    {
        "id": "P-13", "file": "px-bowl-gui.webp", "ship": (24, 24),
        "transparent": True, "seamless": False,
        "body": (
            "一只盛桂花馅的陶碗的严格正俯视形象，镜头位于碗口正上方垂直向下拍摄，"
            "画面只有一个完整的正圆形碗口，绝对看不到碗的外壁碗底与任何投影，"
            "奶油白正圆碗口内盛满明亮的桂花金#E9B84B色桂花馅料并可见细碎小花点，"
            "碗口外沿有一道浅米褐同心圆描边，碗居中四周留出至少四分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一只碗。"
        ),
    },
    {
        "id": "P-14", "file": "px-bowl-lian.webp", "ship": (24, 24),
        "transparent": True, "seamless": False,
        "body": (
            "一只盛莲蓉馅的陶碗的严格正俯视形象，镜头位于碗口正上方垂直向下拍摄，"
            "奶油白正圆陶碗只看到圆形碗口与碗内馅料，"
            "碗内盛满浅米褐色莲蓉馅料呈细腻平滑哑光质感，"
            "碗口外沿有一道暖褐木色描边，碗居中四周留出至少四分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一只碗。"
        ),
    },
    {
        "id": "P-15", "file": "px-bowl-dan.webp", "ship": (24, 24),
        "transparent": True, "seamless": False,
        "body": (
            "一只盛咸蛋黄馅的陶碗的严格正俯视形象，镜头位于碗口正上方垂直向下拍摄，"
            "奶油白正圆陶碗只看到圆形碗口与碗内馅料，"
            "碗内盛满深橙色#E27A1C咸蛋黄馅料并可见明显粉沙颗粒质感，"
            "馅料颜色明显比桂花金更深更橙一眼可分，碗口外沿有一道朱红细描边，"
            "碗居中四周留出至少四分之一空白余量，"
            "背景为纯品红#FF00FF纯色平涂，画面只有这一只碗。"
        ),
    },
]

CAKE_IDS = ["P-09", "P-10", "P-11", "P-12"]
CAKE_MIN_SEPARATION = 45.0   # min Euclidean distance between mean cake colours
BODY_MIN_CHARS, BODY_MAX_CHARS = 60, 240


# --------------------------------------------------------------------------
# Pre-flight: fail before spending a single request
# --------------------------------------------------------------------------
def full_prompt(sprite):
    """Body + shared suffix. The suffix MUST be the last line (preflight relies on it)."""
    return sprite["body"] + "\n" + STYLE_SUFFIX


def preflight(sprites):
    """Assert manifest invariants. Returns a list of fatal problem strings."""
    problems = []

    if len(sprites) != 15:
        problems.append("manifest has %d rows, the sprite set requires exactly 15"
                        % len(sprites))

    ids = [s["id"] for s in sprites]
    if len(set(ids)) != len(ids):
        problems.append("duplicate sprite ids")
    files = [s["file"] for s in sprites]
    if len(set(files)) != len(files):
        problems.append("duplicate file names")
    for f in files:
        if not f.startswith("px-") or not f.endswith(".webp"):
            problems.append("%s must be px-*.webp" % f)

    # --- the byte-identity assertion, same shape as gen_yueyan_assets.py
    suffixes = {full_prompt(s).splitlines()[-1] for s in sprites}
    if len(suffixes) != 1:
        problems.append("style suffix differs across sprites (%d distinct)" % len(suffixes))
    elif next(iter(suffixes)) != STYLE_SUFFIX:
        problems.append("style suffix is not byte-identical to STYLE_SUFFIX")
    for s in sprites:
        if not full_prompt(s).endswith(STYLE_SUFFIX):
            problems.append("%s prompt does not end with the shared suffix" % s["id"])

    if len(PALETTE) > 32 or len(set(PALETTE_NAMES)) != len(PALETTE):
        problems.append("shared palette has duplicate or oversized token list")

    total = GEN_W * GEN_H
    if not MIN_TOTAL_PIXELS <= total <= MAX_TOTAL_PIXELS:
        problems.append("generation size %d*%d = %d px is outside [%d, %d]"
                        % (GEN_W, GEN_H, total, MIN_TOTAL_PIXELS, MAX_TOTAL_PIXELS))
    if "*" not in GEN_SIZE:
        problems.append("GEN_SIZE must use an asterisk separator, not 'x'")

    for s in sprites:
        n = len(s["body"])
        if not BODY_MIN_CHARS <= n <= BODY_MAX_CHARS:
            problems.append("%s body is %d chars, must be %d-%d"
                            % (s["id"], n, BODY_MIN_CHARS, BODY_MAX_CHARS))

        w, h = s["ship"]
        if min(w, h) < 16:
            problems.append("%s target short edge %d is unreasonably small" % (s["id"], min(w, h)))
        if max(w, h) >= GEN_W:
            problems.append("%s target %d must be < the %d generation edge (downscale required)"
                            % (s["id"], max(w, h), GEN_W))

        # Transparent sprites are chroma-keyed, so the body must ask for the key
        # colour AND leave composition margin for the flood fill to reach.
        if s["transparent"]:
            if "#FF00FF" not in s["body"]:
                problems.append("%s is transparent but its body lacks the #FF00FF "
                                "chroma-key background clause" % s["id"])
            if "空白余量" not in s["body"]:
                problems.append("%s is transparent but its body lacks a composition-"
                                "margin clause, so the subject may touch the border" % s["id"])
        if s["seamless"]:
            if "无缝平铺" not in s["body"]:
                problems.append("%s is tileable but its body lacks the seamless clause"
                                % s["id"])
            if s["transparent"]:
                problems.append("%s cannot be both tileable and transparent" % s["id"])
            if "铺满整张图" not in s["body"]:
                problems.append("%s is tileable but its body does not demand a "
                                "full-bleed frame, which would break the wrap" % s["id"])

    # The four cake states must each name a distinct colour rung, or they will
    # come back looking alike and the whole order loop becomes unreadable.
    cake_words = {"P-09": "奶白", "P-10": "浅金黄", "P-11": "金棕", "P-12": "近黑"}
    cakes = [s for s in sprites if s["id"] in CAKE_IDS]
    if len(cakes) != 4:
        problems.append("expected exactly 4 cake states, found %d" % len(cakes))
    for s in cakes:
        if cake_words[s["id"]] not in s["body"]:
            problems.append("%s body lacks its distinguishing colour word '%s'"
                            % (s["id"], cake_words[s["id"]]))

    banned = ["玉兔", "嫦娥", "月宫", "广寒宫", "春节", "西式蛋糕",
              "现代月饼礼盒", "塑料包装", "文字", "水印"]
    missing = [b for b in banned if b not in NEG_COMMON]
    if missing:
        problems.append("NEG_COMMON is missing banned terms %s" % missing)

    return problems


# --------------------------------------------------------------------------
# .env handling -- robust, and never echoes the key
# --------------------------------------------------------------------------
def load_env():
    path = os.path.join(ROOT, ".env")
    env = {}
    if not os.path.exists(path):
        raise SystemExit("FATAL: repo-root .env not found at %s" % path)

    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip().lstrip("\ufeff")
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export "):].lstrip()
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key, value = key.strip(), value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            if key:
                env[key] = value

    missing = [k for k in ("MAAS_BASE_URL", "MAAS_API_KEY") if not env.get(k)]
    if missing:
        # Name the missing keys only -- never the value.
        raise SystemExit("FATAL: .env is missing or empty for %s" % ", ".join(missing))
    env.setdefault("MAAS_IMAGE_MODEL", "wan2.7-image-pro")
    return env


# --------------------------------------------------------------------------
# Gateway calls, with quota backoff
# --------------------------------------------------------------------------
def _post_once(env, prompt, negative):
    """One POST /chat/completions. Raises on any failure."""
    url = env["MAAS_BASE_URL"].rstrip("/") + CHAT_PATH
    payload = {
        "model": env["MAAS_IMAGE_MODEL"],
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        "parameters": {"size": GEN_SIZE},
        "negative_prompt": negative,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + env["MAAS_API_KEY"],
                 "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    choices = (body.get("output") or {}).get("choices") or body.get("choices") or []
    if not choices:
        raise RuntimeError("no choices: " + json.dumps(body, ensure_ascii=False)[:300])
    parts = choices[0].get("message", {}).get("content") or []
    if isinstance(parts, str):
        raise RuntimeError("content came back as a string, expected a list of parts")
    for part in parts:
        if isinstance(part, dict) and part.get("type") == "image" and part.get("image"):
            return part["image"], (body.get("usage") or {}).get("size")
    raise RuntimeError("no image in response: " + json.dumps(parts, ensure_ascii=False)[:300])


def _classify(exc):
    """Return 'quota', 'fatal' or 'transient'.

    Quota errors on this gateway surface as tpm_limit_exceeded / 'Allocated
    quota exceeded'. They are worth waiting minutes for. A plain HTTP 400
    without a quota marker is a parameter problem -- retrying it just burns
    more quota, so it is fatal.
    """
    text = ""
    if isinstance(exc, urllib.error.HTTPError):
        try:
            text = exc.read().decode("utf-8", "replace")
        except OSError:
            text = ""
        if any(m in text.lower() for m in QUOTA_MARKERS):
            return "quota", text
        if exc.code == 400:
            return "fatal", text
        if exc.code in (429, 500, 502, 503, 504):
            return "transient", text
        return "fatal", text
    return "transient", str(exc)


def request_image(env, prompt, negative, sid):
    """POST /chat/completions with exponential backoff on quota errors.

    Returns (image_url, api_size). Never touches /images/generations.
    """
    wait = BACKOFF_BASE
    for attempt in range(1, RETRY_MAX + 1):
        try:
            return _post_once(env, prompt, negative)
        except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError) as exc:
            kind, text = _classify(exc)
            snippet = " ".join(text.split())[:180]
            if kind == "fatal":
                print("  GENERATE FAILED (fatal, not retried): %s" % snippet)
                print("  (do NOT retry against /images/generations -- it 400s here)")
                return None
            if attempt == RETRY_MAX:
                print("  GENERATE FAILED after %d attempts (%s): %s"
                      % (attempt, kind, snippet))
                return None
            print("  attempt %d/%d %s -- backing off %.0fs: %s"
                  % (attempt, RETRY_MAX, kind, wait, snippet))
            time.sleep(wait)
            wait = min(wait * BACKOFF_FACTOR, BACKOFF_CAP)
    return None


def download(image_url, dest):
    """Download immediately -- the OSS URL expires in ~24h."""
    req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()
    with open(dest, "wb") as fh:
        fh.write(data)
    return len(data)


# --------------------------------------------------------------------------
# The pixel-art post-processing pipeline
# --------------------------------------------------------------------------
def _dist2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def flood_background(img):
    """Region-grow transparency inward from the image border.

    Local tolerance lets the fill follow a gradient or vignette background; the
    global cap stops it wandering; the ink guard stops it leaking through the
    subject, because every sprite carries a 1px #24140E outline that acts as a
    natural barrier. Returns (image, bg_reference_colour).
    """
    w, h = img.size
    px = img.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    ref = tuple(sorted(c[i] for c in corners)[1] for i in range(3))

    seen = bytearray(w * h)
    dq = deque()

    def offer(x, y):
        if seen[y * w + x]:
            return
        c = px[x, y][:3]
        if _dist2(c, ref) > BG_GLOBAL_TOL2:
            return
        seen[y * w + x] = 1
        dq.append((x, y))

    for x in range(w):
        offer(x, 0)
        offer(x, h - 1)
    for y in range(h):
        offer(0, y)
        offer(w - 1, y)

    while dq:
        x, y = dq.popleft()
        parent = px[x, y][:3]
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or seen[ny * w + nx]:
                continue
            c = px[nx, ny][:3]
            if _dist2(c, parent) > BG_LOCAL_TOL2:
                continue
            if _dist2(c, ref) > BG_GLOBAL_TOL2:
                continue
            if _dist2(c, INK_RGB) < INK_GUARD2:
                continue          # outline barrier -- do not leak into the subject
            seen[ny * w + nx] = 1
            dq.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if seen[y * w + x]:
                px[x, y] = (0, 0, 0, 0)
    return img, ref


def halo_cleanup(img, ref):
    """Drop opaque border pixels that are still basically background colour."""
    w, h = img.size
    px = img.load()
    doomed = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < ALPHA_CUT:
                continue
            touches_void = any(
                0 <= nx < w and 0 <= ny < h and px[nx, ny][3] < ALPHA_CUT
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
            if touches_void and _dist2(px[x, y][:3], ref) < HALO_TOL2:
                doomed.append((x, y))
    for x, y in doomed:
        px[x, y] = (0, 0, 0, 0)
    return img


def erode_alpha(img):
    """One-ring alpha erosion at pre-reduce resolution.

    At PRE_REDUCE x target this removes roughly half a target pixel of fringe,
    which reliably kills the chroma halo without visibly shrinking the sprite.
    """
    w, h = img.size
    px = img.load()
    doomed = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < ALPHA_CUT:
                continue
            if any(0 <= nx < w and 0 <= ny < h and px[nx, ny][3] < ALPHA_CUT
                   for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))):
                doomed.append((x, y))
    for x, y in doomed:
        px[x, y] = (0, 0, 0, 0)
    return img


def hard_alpha(img):
    """Threshold alpha to exactly 0 or 255. No feathered edges, ever."""
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= ALPHA_CUT else (0, 0, 0, 0)
    return img


def _blend(a, b, t):
    """t = weight of `a`. Integer round, deterministic."""
    return tuple(int(round(a[i] * t + b[i] * (1.0 - t))) for i in range(3))


def make_seamless(img, band):
    """Crossfade the wrap seam so the tile repeats with no visible join.

    The image is shifted by half so its original left/right (and top/bottom)
    edges meet in the middle, the seam there is averaged away over `band`
    pixels, then it is shifted back. Re-quantized afterwards so the result is
    still pure palette colour with a hard pixel grid.
    """
    w, h = img.size

    for axis in (0, 1):
        length = w if axis == 0 else h
        half = length // 2
        shifted = img.copy()
        if axis == 0:
            shifted.paste(img.crop((half, 0, w, h)), (0, 0))
            shifted.paste(img.crop((0, 0, half, h)), (half, 0))
        else:
            shifted.paste(img.crop((0, half, w, h)), (0, 0))
            shifted.paste(img.crop((0, 0, w, half)), (0, half))

        spx = shifted.load()
        for d in range(band):
            t = (d + 1) / float(band + 1)     # small at the seam, 1 at the band ends
            if axis == 0:
                xl, xr = half - 1 - d, half + d
                for y in range(h):
                    a, b = spx[xl, y][:3], spx[xr, y][:3]
                    mid = _blend(a, b, 0.5)
                    spx[xl, y] = _blend(a, mid, t) + (255,)
                    spx[xr, y] = _blend(b, mid, t) + (255,)
            else:
                yt, yb = half - 1 - d, half + d
                for x in range(w):
                    a, b = spx[x, yt][:3], spx[x, yb][:3]
                    mid = _blend(a, b, 0.5)
                    spx[x, yt] = _blend(a, mid, t) + (255,)
                    spx[x, yb] = _blend(b, mid, t) + (255,)

        out = img.copy()
        if axis == 0:
            out.paste(shifted.crop((w - half, 0, w, h)), (0, 0))
            out.paste(shifted.crop((0, 0, w - half, h)), (half, 0))
        else:
            out.paste(shifted.crop((0, h - half, w, h)), (0, 0))
            out.paste(shifted.crop((0, 0, w, h - half)), (0, half))
        img = out
    return img


def despeckle(img, passes=2):
    """Remove isolated single-pixel palette outliers.

    NEAREST at 2:1 picks one sub-block per sprite pixel, so a source region that
    straddles two palette tokens can leave a lone stray pixel inside an otherwise
    flat area -- visible as speckle, which is exactly what stops a sprite reading
    as pixel art. A pixel is flipped when at least DESPECKLE_VOTE of its four
    orthogonal neighbours already agree on one other palette colour, so genuine
    2px-wide detail (flame, pressed pattern, rim, grout line) survives: a pixel
    sitting on a continuous line always has line-coloured neighbours beside it and
    never reaches the vote. Pixels on a transparency silhouette are left alone, so
    this never erodes a sprite outline. Deterministic, and it runs after
    quantization so it only ever swaps one palette token for another.
    """
    w, h = img.size
    for _ in range(passes):
        px = img.load()
        flips = []
        for y in range(h):
            for x in range(w):
                here = px[x, y]
                if here[3] < ALPHA_CUT:
                    continue
                votes = {}
                on_edge = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= nx < w and 0 <= ny < h):
                        continue
                    c = px[nx, ny]
                    if c[3] < ALPHA_CUT:
                        on_edge = True       # silhouette edge: leave it alone
                        break
                    votes[c[:3]] = votes.get(c[:3], 0) + 1
                if on_edge or not votes:
                    continue
                winner, count = max(sorted(votes.items()), key=lambda kv: kv[1])
                if count >= DESPECKLE_VOTE and winner != here[:3]:
                    flips.append((x, y, winner))
        if not flips:
            break
        for x, y, winner in flips:
            px[x, y] = winner + (255,)
    return img


def enforce_color_budget(img, budget):
    """Merge the rarest palette tokens into their nearest common token until the
    sprite carries at most `budget` distinct colours.

    A diffusion pass can leave a sprite touching far more shared tokens than the
    limited-palette band allows, mostly as a handful of pixels each. Rather than
    regenerate and hope, this collapses the tail deterministically: repeatedly
    drop the least-used token onto the most colour-similar surviving token. Both
    picks are made over sorted sequences so ties resolve identically every run,
    and because it only ever merges tokens that are already in the shared palette
    the sprite stays on-palette throughout.
    """
    px = img.load()
    while True:
        counts = {}
        for y in range(img.height):
            for x in range(img.width):
                c = px[x, y]
                if c[3] >= ALPHA_CUT:
                    counts[c[:3]] = counts.get(c[:3], 0) + 1
        if len(counts) <= budget:
            return img
        rarest = min(sorted(counts.items()), key=lambda kv: kv[1])[0]
        target = min(sorted(c for c in counts if c != rarest),
                     key=lambda c: sum((rarest[i] - c[i]) ** 2 for i in range(3)))
        for y in range(img.height):
            for x in range(img.width):
                if px[x, y][3] >= ALPHA_CUT and px[x, y][:3] == rarest:
                    px[x, y] = target + (255,)


def tokens_in(img):
    """Sorted names of the shared-palette tokens actually present in `img`."""
    seen = {img.getpixel((x, y))[:3]
            for y in range(img.height) for x in range(img.width)
            if img.getpixel((x, y))[3] >= ALPHA_CUT}
    return sorted(t[0] for t in PALETTE if (t[1], t[2], t[3]) in seen)


def quantize_to_palette(img):
    """Map every opaque pixel onto its nearest shared-palette token, zero dither.

    Deterministic: ties resolve to the first token in PALETTE order. This is the
    step that makes all 15 sprites provably share one palette.
    """
    px = img.load()
    memo = {}
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < ALPHA_CUT:
                px[x, y] = (0, 0, 0, 0)
                continue
            key = (r, g, b)
            hit = memo.get(key)
            if hit is None:
                best = min(PALETTE, key=lambda t: (r - t[1]) ** 2
                           + (g - t[2]) ** 2 + (b - t[3]) ** 2)
                hit = (best[1], best[2], best[3])
                memo[key] = hit
            px[x, y] = hit + (255,)
    return img


def pixelate(raw_path, sprite):
    """raw 1024*1024 -> authentic crisp pixel art at the exact target dims."""
    img = Image.open(raw_path).convert("RGBA")
    target = sprite["ship"]
    pre = (target[0] * PRE_REDUCE, target[1] * PRE_REDUCE)

    # Stage 1: area average down to 2x target. Interpolates nothing; it only
    # collapses diffusion noise into representative per-cell colour.
    img = img.resize(pre, Image.Resampling.BOX)

    if sprite["transparent"]:
        img, ref = flood_background(img)
        img = halo_cleanup(img, ref)
        img = erode_alpha(img)

    # Stage 2: the mandated NEAREST snap to the exact target dims -> hard grid.
    img = img.resize(target, Image.Resampling.NEAREST)
    img = hard_alpha(img)

    if sprite["seamless"]:
        img = make_seamless(img, SEAM_BAND)

    img = quantize_to_palette(img)
    img = despeckle(img, DESPECKLE_PASSES)
    img = enforce_color_budget(img, MAX_COLORS_PER_SPRITE)
    # despeckle can retire a token entirely, so re-read the live token set.
    used = tokens_in(img)

    dest = os.path.join(SHIP_DIR, sprite["file"])
    # Lossless: lossy webp ringing would re-add the fuzzy edges we just removed.
    img.save(dest, "WEBP", lossless=True, quality=100, method=6)
    return dest, used


# --------------------------------------------------------------------------
# Inspection / validation
# --------------------------------------------------------------------------
def inspect_sprite(sprite):
    """Return a report row for one shipped sprite, or None if it is absent."""
    path = os.path.join(SHIP_DIR, sprite["file"])
    if not os.path.exists(path):
        return None

    img = Image.open(path).convert("RGBA")
    pixels = [img.getpixel((x, y)) for y in range(img.height) for x in range(img.width)]
    nbytes = os.path.getsize(path)

    opaque = [p for p in pixels if p[3] >= ALPHA_CUT]
    void = len(pixels) - len(opaque)

    colours = {p[:3] for p in opaque}
    names = sorted(t[0] for t in PALETTE if (t[1], t[2], t[3]) in colours)
    off_palette = sorted(c for c in colours if c not in PALETTE_RGB)

    w, h = img.size
    corners_opaque = sum(1 for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))
                         if img.getpixel((x, y))[3] >= ALPHA_CUT)

    mean = None
    if opaque:
        mean = tuple(round(sum(p[i] for p in opaque) / len(opaque), 1) for i in range(3))

    if sprite["transparent"]:
        alpha_ok = void > 0 and corners_opaque == 0
    else:
        alpha_ok = void == 0

    return {
        "id": sprite["id"], "file": sprite["file"], "path": path,
        "size": img.size, "bytes": nbytes, "kib": nbytes / 1024.0,
        "dims_ok": img.size == sprite["ship"],
        "palette_size": len(colours), "tokens": names,
        "palette_ok": len(colours) <= MAX_COLORS_PER_SPRITE,
        "off_palette": off_palette, "crisp_ok": not off_palette,
        "alpha_ok": alpha_ok, "void": void, "opaque": len(opaque),
        "mean": mean,
    }


def already_shipped(sprite):
    """True when the shipped file satisfies every hard constraint.

    Correct dims, zero off-palette colours (the objective proof that the pixel
    grid is hard and unblurred), the right alpha posture, and a palette inside
    the guidance band. Nothing advisory is in here, so a finished sprite is
    never churned on a later run.
    """
    row = inspect_sprite(sprite)
    if row is None:
        return False
    return row["dims_ok"] and row["crisp_ok"] and row["alpha_ok"] and row["palette_ok"]


def cake_separation(rows):
    """Pairwise Euclidean distance between the four cake states' mean colours."""
    by_id = {r["id"]: r for r in rows if r is not None}
    present = [i for i in CAKE_IDS if i in by_id and by_id[i]["mean"]]
    pairs = []
    for i in range(len(present)):
        for j in range(i + 1, len(present)):
            a, b = by_id[present[i]]["mean"], by_id[present[j]]["mean"]
            d = sum((a[k] - b[k]) ** 2 for k in range(3)) ** 0.5
            pairs.append((present[i], present[j], round(d, 1)))
    return present, pairs


def print_report(rows):
    print("\n=== sprite report (%s) ===" % SHIP_DIR)
    header = ("%-6s %-22s %-9s %7s %8s %6s %-6s %-6s %s"
              % ("id", "file", "dims", "bytes", "colors", "off", "alpha",
                 "crisp", "palette tokens used"))
    print(header)
    print("-" * len(header))

    total_bytes = 0
    for r in rows:
        if r is None:
            continue
        total_bytes += r["bytes"]
        print("%-6s %-22s %-9s %7d %8d %6d %-6s %-6s %s"
              % (r["id"], r["file"], "%dx%d" % r["size"], r["bytes"],
                 r["palette_size"], len(r["off_palette"]),
                 "ok" if r["alpha_ok"] else "BAD",
                 "ok" if r["crisp_ok"] else "BAD",
                 ",".join(r["tokens"])))

    present = [r for r in rows if r is not None]
    missing = [s["id"] for s, r in zip(SPRITES, rows) if r is None]

    print("-" * len(header))
    print("present        = %d / 15" % len(present))
    if missing:
        print("missing        = %s" % ", ".join(missing))
    print("total bytes    = %d  (%.2f KiB)" % (total_bytes, total_bytes / 1024.0))
    if present:
        print("per-sprite     = " + ", ".join("%s %d B" % (r["file"], r["bytes"])
                                              for r in present))
        print("largest single = %d B (%s)"
              % (max(r["bytes"] for r in present),
                 max(present, key=lambda r: r["bytes"])["file"]))
    print("shared palette = %d tokens; per-sprite used %d-%d (band <= %d)"
          % (len(PALETTE),
             min((r["palette_size"] for r in present), default=0),
             max((r["palette_size"] for r in present), default=0),
             MAX_COLORS_PER_SPRITE))

    bad_dims = [r["id"] for r in present if not r["dims_ok"]]
    if bad_dims:
        print("\n!! dims differ from the manifest: %s" % ", ".join(bad_dims))
    bad_crisp = [r["id"] for r in present if not r["crisp_ok"]]
    if bad_crisp:
        print("!! off-palette colours present (blurred / not quantized): %s"
              % ", ".join(bad_crisp))
    bad_alpha = [r["id"] for r in present if not r["alpha_ok"]]
    if bad_alpha:
        print("!! alpha posture wrong: %s" % ", ".join(bad_alpha))
    bad_pal = [r["id"] for r in present if not r["palette_ok"]]
    if bad_pal:
        print("!! palette over %d colours: %s" % (MAX_COLORS_PER_SPRITE, ", ".join(bad_pal)))

    # --- the four cake states must be unmistakable from each other
    cake_ids, pairs = cake_separation(rows)
    print("\ncake-state separation (mean opaque colour, Euclidean):")
    if len(cake_ids) < 4:
        print("  only %d/4 cake states present -- cannot judge" % len(cake_ids))
    for a, b, d in pairs:
        flag = "ok" if d >= CAKE_MIN_SEPARATION else "<-- TOO CLOSE"
        print("  %s vs %s = %6.1f  %s" % (a, b, d, flag))
    close = [p for p in pairs if p[2] < CAKE_MIN_SEPARATION]
    if close:
        print("!! %d cake pair(s) under %.1f separation -- regenerate those states"
              % (len(close), CAKE_MIN_SEPARATION))
    elif len(cake_ids) == 4:
        print("  all 6 pairs >= %.1f  -> four states unmistakable at 24x24"
              % CAKE_MIN_SEPARATION)

    return present, missing


# --------------------------------------------------------------------------
# Contact sheet -- judge style consistency by eye
# --------------------------------------------------------------------------
PAD = 20
COLS = 5
CELL_W, CELL_H = 232, 236
ZOOM_BOX = 184
SHEET_BG = (38, 30, 24)
LABEL_RGB = (0xFF, 0xF6, 0xE4)
MUTED_RGB = (0xC3, 0xAF, 0x8D)
BAD_RGB = (0xE0, 0x57, 0x45)
GRID_RGB = (0xA6, 0x74, 0x40)
SCENE_W, SCENE_H = 1230, 400


def sheet_font(size):
    for path in ("/System/Library/Fonts/PingFang.ttc",
                 "/System/Library/Fonts/STHeiti Light.ttc",
                 "/System/Library/Fonts/Helvetica.ttc"):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def load_sprite(sprite):
    path = os.path.join(SHIP_DIR, sprite["file"])
    if not os.path.exists(path):
        return None
    return Image.open(path).convert("RGBA")


def scale_for(box, size):
    return max(1, box // max(size))


def paste_alpha(sheet, img, x, y):
    sheet.paste(img, (x, y), img)


def floor_backdrop(w, h, scale):
    """Tile px-floor at `scale` so every cell shows the real in-game composite."""
    bg = Image.new("RGBA", (w, h), (60, 48, 38, 255))
    tile = load_sprite(SPRITES[0])
    if tile is None:
        return bg
    t = tile.resize((tile.width * scale, tile.height * scale), Image.Resampling.NEAREST)
    for y in range(0, h, t.height):
        for x in range(0, w, t.width):
            paste_alpha(bg, t, x, y)
    return bg


def build_contact_sheet():
    rows = [inspect_sprite(s) for s in SPRITES]
    present = [r for r in rows if r is not None]
    if not present:
        print("nothing to sheet: no sprites under %s" % SHIP_DIR)
        print("run `python tests/gen_yueyan_pixels.py` first")
        return None

    n_rows = (len(SPRITES) + COLS - 1) // COLS
    header_h, strip_h, footer_h = 86, 120, 116
    sheet_w = PAD * 2 + COLS * CELL_W + (COLS - 1) * PAD
    sheet_h = (header_h + n_rows * (CELL_H + PAD) + strip_h
               + SCENE_H + footer_h + PAD * 3)

    sheet = Image.new("RGB", (sheet_w, sheet_h), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    f_title, f_sub, f_cell = sheet_font(26), sheet_font(15), sheet_font(13)

    draw.text((PAD, PAD), "月宴原型 · 像素风俯视 · 15 张 sprite · 风格一致性目视",
              font=f_title, fill=LABEL_RGB)
    draw.text((PAD, PAD + 36),
              "大格 = 整数倍 NEAREST 放大并合成在 px-floor 上（判风格是否同一套游戏）   "
              "小格 = 1x 真实像素（判 24-48 px 下是否仍可辨）",
              font=f_sub, fill=MUTED_RGB)

    y0 = header_h
    for idx, (sprite, row) in enumerate(zip(SPRITES, rows)):
        col, rw = idx % COLS, idx // COLS
        x = PAD + col * (CELL_W + PAD)
        y = y0 + rw * (CELL_H + PAD)

        draw.rectangle([x, y, x + CELL_W, y + CELL_H], outline=GRID_RGB, width=1)
        draw.text((x + 8, y + 6), "%s · %s" % (sprite["id"], sprite["file"]),
                  font=f_cell, fill=LABEL_RGB)
        draw.text((x + 8, y + 24), "target %dx%d · %s"
                  % (sprite["ship"][0], sprite["ship"][1],
                     "tileable" if sprite["seamless"]
                     else ("transparent" if sprite["transparent"] else "opaque")),
                  font=f_cell, fill=MUTED_RGB)

        img_y = y + 44
        img = load_sprite(sprite)
        if row is None or img is None:
            draw.text((x + 10, img_y + 70), "missing", font=f_cell, fill=BAD_RGB)
            continue

        k = scale_for(ZOOM_BOX, img.size)
        zoom = img.resize((img.width * k, img.height * k), Image.Resampling.NEAREST)
        back = floor_backdrop(ZOOM_BOX, ZOOM_BOX, 3)
        sheet.paste(back, (x + 8, img_y))
        paste_alpha(sheet, zoom,
                    x + 8 + (ZOOM_BOX - zoom.width) // 2,
                    img_y + (ZOOM_BOX - zoom.height) // 2)
        draw.text((x + 8 + ZOOM_BOX - 44, img_y + ZOOM_BOX - 16), "%dx" % k,
                  font=f_cell, fill=MUTED_RGB)

        # 1x actual pixels, unzoomed, on a dark plate.
        ax = x + 8 + ZOOM_BOX + 8
        draw.rectangle([ax - 2, img_y - 2, ax + 40, img_y + 40],
                       outline=MUTED_RGB, width=1)
        paste_alpha(sheet, img, ax, img_y)
        draw.text((ax - 2, img_y + 44), "1x", font=f_cell, fill=MUTED_RGB)

        meta = "%d B · %d colors%s" % (
            row["bytes"], row["palette_size"],
            "" if row["crisp_ok"] else " · OFF-PALETTE")
        draw.text((x + 8, y + CELL_H - 22), meta,
                  font=f_cell, fill=MUTED_RGB if row["crisp_ok"] else BAD_RGB)

    # --- 1x strip: the honest small-size readability check
    sy = y0 + n_rows * (CELL_H + PAD) + PAD
    draw.text((PAD, sy), "1x 真实像素条 · 游戏里就是这个大小", font=f_sub, fill=LABEL_RGB)
    cx = PAD
    for sprite in SPRITES:
        img = load_sprite(sprite)
        if img is None:
            continue
        paste_alpha(sheet, img, cx, sy + 26)
        draw.text((cx, sy + 26 + img.height + 4), sprite["file"][3:-5],
                  font=f_cell, fill=MUTED_RGB)
        cx += max(img.width, 56) + 12

    # --- in-context kitchen mock: the real "does it look like one game" test
    my = sy + strip_h + PAD
    draw.text((PAD, my - 22), "实机合成 · 4x · 地砖平铺 + 台面 + 工位 + 厨师 + 四态月饼 + 三馅料",
              font=f_sub, fill=LABEL_RGB)
    scene = Image.new("RGBA", (SCENE_W, SCENE_H), (60, 48, 38, 255))

    floor = load_sprite(SPRITES[0])
    if floor is not None:
        ft = floor.resize((128, 128), Image.Resampling.NEAREST)
        for yy in range(0, SCENE_H, 128):
            for xx in range(0, SCENE_W, 128):
                paste_alpha(scene, ft, xx, yy)

    counter = load_sprite(SPRITES[1])
    if counter is not None:
        ct = counter.resize((128, 128), Image.Resampling.NEAREST)
        for xx in range(60, 1170, 128):
            paste_alpha(scene, ct, xx, 30)

    def place(sprite, x, y, scale):
        img = load_sprite(sprite)
        if img is None:
            return
        z = img.resize((img.width * scale, img.height * scale),
                       Image.Resampling.NEAREST)
        paste_alpha(scene, z, x, y)

    place(SPRITES[3], 80, 10, 4)      # stove
    place(SPRITES[4], 320, 10, 4)     # kneading board
    place(SPRITES[5], 560, 10, 4)     # plate station
    place(SPRITES[6], 800, 10, 4)     # ingredient rack
    place(SPRITES[7], 1030, 50, 4)    # firewood
    place(SPRITES[2], 560, 240, 4)    # chef, standing on the floor
    for i, cake in enumerate(SPRITES[8:12]):
        place(cake, 120 + i * 110, 280, 4)
    for i, bowl in enumerate(SPRITES[12:15]):
        place(bowl, 760 + i * 110, 280, 4)

    sheet.paste(scene.convert("RGB"), (PAD, my))
    draw.rectangle([PAD, my, PAD + SCENE_W, my + SCENE_H], outline=GRID_RGB, width=1)

    fy = my + SCENE_H + 14
    draw.text((PAD, fy),
              "目视判据：① 15 张同属一套游戏（同一色板 / 同一像素密度 / 同一 1px 描边 / 同一左上光源）",
              font=f_sub, fill=LABEL_RGB)
    draw.text((PAD, fy + 22),
              "② 四态月饼一眼可分（生→浅金→金棕→焦黑）  ③ 厨师俯视可读，帽子与围裙清晰  "
              "④ 工位俯视无侧视无透视",
              font=f_sub, fill=LABEL_RGB)
    draw.text((PAD, fy + 44),
              "⑤ 1x 下边缘硬朗无抗锯齿无模糊  ⑥ 地砖与台面三×三平铺无可见接缝",
              font=f_sub, fill=LABEL_RGB)

    sheet.save(CONTACT_SHEET, quality=92)
    print("saved = %s" % CONTACT_SHEET)
    print("size  = %dx%d  (%.0f KB)"
          % (sheet.width, sheet.height, os.path.getsize(CONTACT_SHEET) / 1024))
    print("tiles = %d present / %d missing" % (len(present), len(SPRITES) - len(present)))
    return CONTACT_SHEET


# --------------------------------------------------------------------------
# Generation loop (resumable / idempotent)
# --------------------------------------------------------------------------
def raw_path_for(sprite):
    stem = os.path.splitext(sprite["file"])[0]
    return os.path.join(RAW_DIR, "%s_%s.png" % (sprite["id"], stem))


def process(env, sprite, force, reprocess=False):
    raw_path = raw_path_for(sprite)

    print("\n--- %s  %s ---" % (sprite["id"], sprite["file"]))
    print("  target     = %dx%d   %s"
          % (sprite["ship"][0], sprite["ship"][1],
             "tileable/opaque" if sprite["seamless"]
             else ("transparent" if sprite["transparent"] else "opaque")))
    print("  pipeline   = generate %s -> BOX %dx%d -> NEAREST %dx%d -> quantize %d "
          "-> lossless webp"
          % (GEN_SIZE, sprite["ship"][0] * PRE_REDUCE, sprite["ship"][1] * PRE_REDUCE,
             sprite["ship"][0], sprite["ship"][1], len(PALETTE)))

    if not force and not reprocess and already_shipped(sprite):
        row = inspect_sprite(sprite)
        print("  SKIP       = already generated (%d B, %dx%d, %d colors)"
              % (row["bytes"], row["size"][0], row["size"][1], row["palette_size"]))
        return row

    if reprocess:
        if not os.path.exists(raw_path):
            print("  !! FAILED  = no cached raw to reprocess, use --force instead")
            return None
        print("  reprocess  = re-pixelate %s (no gateway call)" % os.path.basename(raw_path))
    elif not force and os.path.exists(raw_path):
        print("  reuse raw  = %s (no gateway call)" % os.path.basename(raw_path))
    else:
        prompt = full_prompt(sprite)
        print("  prompt     = %d chars body + %d chars shared suffix"
              % (len(sprite["body"]), len(STYLE_SUFFIX)))
        result = request_image(env, prompt, NEG_COMMON, sprite["id"])
        if result is None:
            print("  !! FAILED  = %s NOT produced. Re-run with --only %s to retry."
                  % (sprite["file"], sprite["id"]))
            return None
        image_url, api_size = result
        try:
            nbytes = download(image_url, raw_path)
        except (urllib.error.HTTPError, urllib.error.URLError) as exc:
            print("  DOWNLOAD FAILED: %s" % exc)
            print("  !! FAILED  = %s NOT produced." % sprite["file"])
            return None
        print("  api size   = %s   raw = %s (%.0f KB, cached, not shipped)"
              % (api_size, os.path.basename(raw_path), nbytes / 1024))

    try:
        dest, used = pixelate(raw_path, sprite)
    except OSError as exc:
        print("  PIXELATE FAILED: %s" % exc)
        return None

    row = inspect_sprite(sprite)
    print("  shipped    = %s  %dx%d  %d B  %d colors"
          % (os.path.basename(dest), row["size"][0], row["size"][1],
             row["bytes"], row["palette_size"]))
    if not row["crisp_ok"]:
        print("  !! off-palette colours: %s" % row["off_palette"][:5])
    if not row["alpha_ok"]:
        print("  !! alpha posture wrong (void=%d, corners opaque=%d)"
              % (row["void"], row["opaque"]))
    print("  tokens     = %s" % ",".join(row["tokens"]))
    return row


def parse_only(spec):
    wanted = [s.strip() for s in spec.split(",") if s.strip()]
    known = {s["id"] for s in SPRITES} | {os.path.splitext(s["file"])[0] for s in SPRITES}
    unknown = [w for w in wanted if w not in known]
    if unknown:
        raise SystemExit("FATAL: unknown sprite selectors %s" % ", ".join(unknown))
    ids = set()
    for w in wanted:
        for s in SPRITES:
            if w == s["id"] or w == os.path.splitext(s["file"])[0]:
                ids.add(s["id"])
    return ids


def main():
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", help="comma-separated ids or file stems, e.g. px-chef,P-04")
    parser.add_argument("--force", action="store_true",
                        help="regenerate even if already shipped")
    parser.add_argument("--reprocess", action="store_true",
                        help="re-pixelate from the cached raw with no gateway call "
                             "(use after changing the palette or pipeline)")
    parser.add_argument("--dry-run", action="store_true",
                        help="print the 15-row plan, make no network call")
    parser.add_argument("--report", action="store_true",
                        help="print dims/palette/bytes/cake separation for shipped sprites")
    parser.add_argument("--contact-sheet", action="store_true",
                        help="build the style-consistency contact sheet")
    parser.add_argument("--batch-size", type=int, default=3,
                        help="sprites per batch before pausing (default 3)")
    parser.add_argument("--batch-pause", type=float, default=30.0,
                        help="seconds to pause between batches (default 30)")
    parser.add_argument("--gap", type=float, default=8.0,
                        help="seconds between requests inside a batch (default 8)")
    args = parser.parse_args()

    problems = preflight(SPRITES)
    if problems:
        print("FATAL: manifest pre-flight failed, no request will be sent")
        for p in problems:
            print("  - %s" % p)
        sys.exit(1)
    print("preflight OK: 15 sprites, style suffix byte-identical across all 15, "
          "shared palette %d tokens" % len(PALETTE))

    if args.contact_sheet:
        build_contact_sheet()
        return

    rows = [inspect_sprite(s) for s in SPRITES]
    if args.report:
        print_report(rows)
        return

    selected = SPRITES
    if args.only:
        ids = parse_only(args.only)
        selected = [s for s in SPRITES if s["id"] in ids]

    if args.dry_run:
        print("\n=== dry run: %d row(s), no network call ===" % len(selected))
        print("%-6s %-22s %-9s %-11s %-18s %-13s %6s"
              % ("id", "file", "target", "gen", "pixelate", "bg", "body"))
        for s in selected:
            print("%-6s %-22s %-9s %-11s %-18s %-13s %6d"
                  % (s["id"], s["file"], "%dx%d" % s["ship"],
                     "%d*%d" % (GEN_W, GEN_H),
                     "BOX %dx -> NEAREST" % PRE_REDUCE,
                     "seamless" if s["seamless"]
                     else ("chroma-key" if s["transparent"] else "opaque"),
                     len(s["body"])))
        print("\nshared palette = %d tokens, one STYLE_SUFFIX, one NEG_COMMON"
              % len(PALETTE))
        print("quota plan     = batches of %d, %.0fs between batches, %.0fs between requests"
              % (args.batch_size, args.batch_pause, args.gap))
        return

    env = load_env()
    os.makedirs(SHIP_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)

    produced, failed = [], []
    for i, sprite in enumerate(selected):
        row = process(env, sprite, args.force, args.reprocess)
        (produced if row is not None else failed).append(sprite["id"])

        if i + 1 < len(selected) and not args.reprocess:
            if (i + 1) % args.batch_size == 0:
                print("\n[batch boundary] pausing %.0fs to stay under the tpm quota"
                      % args.batch_pause)
                time.sleep(args.batch_pause)
            else:
                time.sleep(args.gap)

    print("\nprocessed %d / %d selected" % (len(produced), len(selected)))
    if failed:
        print("!! NOT produced (%d): %s" % (len(failed), ", ".join(failed)))
        print("   these are quota or gateway failures, not skips -- re-run:")
        print("   python tests/gen_yueyan_pixels.py --only %s" % ",".join(failed))

    print_report([inspect_sprite(s) for s in SPRITES])
    print("\nnext: python tests/gen_yueyan_pixels.py --contact-sheet")
    print("      then do the ONE manual visual pass over %s" % CONTACT_SHEET)


if __name__ == "__main__":
    main()
