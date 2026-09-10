"""Generate the 22 yueyan bitmap assets listed in 0d-bitmap-split.md 0d-§4.1.

Prompts are copied verbatim from docs/research/yueyan-prompts.md.
The style suffix must stay byte-identical across all 22 assets; it is asserted
before any request is made, the same way gen_yuegong_scenes.py:136-140 does it.

Mandatory pipeline (0d-§4.4), no exceptions:
    generate 768*768  ->  Pillow LANCZOS downscale (+ center-crop)  ->  webp q80

The gateway enforces a total-pixel range of [589824, 16777216] and rejects
violations with HTTP 400 InvalidParameter (not a silent fallback). 512*512 is
262144 and is REJECTED, so every shipping size in the manifest (all < 768) must
be produced by downscaling. Downscaling is a pipeline step, not a fallback.

Deterministic by construction: zero randomness, no seeds, no shuffling.

Usage:
    python tests/gen_yueyan_assets.py                    # generate all 22 (resumable)
    python tests/gen_yueyan_assets.py --only A-01,A-07   # subset
    python tests/gen_yueyan_assets.py --only A-10 --force
    python tests/gen_yueyan_assets.py --contact-sheet    # one manual spot-check pass
    python tests/gen_yueyan_assets.py --dry-run          # plan only, no network
    python tests/gen_yueyan_assets.py --report           # sizes + palette shares only
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHIP_DIR = os.path.join(ROOT, "tools", "yueyan", "assets", "img")
DRAFT_DIR = os.path.join(ROOT, "docs", "research", "yueyan-drafts")
RAW_DIR = os.path.join(DRAFT_DIR, "raw")
CONTACT_SHEET = os.path.join(DRAFT_DIR, "contact_sheet.png")

# --------------------------------------------------------------------------
# Gateway contract (docs/research/maas-image-api.md)
# --------------------------------------------------------------------------
# /images/generations returns 400 "url error" on this gateway and must never be
# retried against. The only working path is /chat/completions with `content` as
# a LIST of typed parts.
CHAT_PATH = "/chat/completions"

# Total-pixel range is a hard limit. 589824 = 768**2, boundary inclusive.
GEN_SIZE = "768*768"          # asterisk, NOT 'x' -- 'x' silently falls back to square
GEN_W, GEN_H = 768, 768
MIN_TOTAL_PIXELS = 589_824
MAX_TOTAL_PIXELS = 16_777_216

WEBP_QUALITY = 80             # locked BOTH ways by V-30 / 0d-V-D2
SHIP_SHORT_EDGE_FLOOR = 128   # V-30 (2)
PER_IMAGE_CEILING_KB = 160    # V-30 outer ceiling (a ceiling, not a target)

# --------------------------------------------------------------------------
# Palette: exactly seven tokens, nothing else (0d-§4.3-a)
# --------------------------------------------------------------------------
PALETTE = [
    ("paper", 0xF7, 0xEF, 0xE2),
    ("amber", 0xB8, 0x73, 0x3A),
    ("cinnabar", 0xC9, 0x48, 0x3C),
    ("ink", 0x3A, 0x2E, 0x26),
    ("moon", 0xF2, 0xE4, 0xC4),
    ("osmanthus", 0xE8, 0xB8, 0x4B),
    ("lantern", 0xF5, 0xC7, 0x7E),
]
CINNABAR_MAX_PCT = 5.0        # §8.2 hard cap, measured by nearest-colour assignment

# --------------------------------------------------------------------------
# Byte-identical style suffix. 22/22 prompts must end with exactly this line.
# --------------------------------------------------------------------------
STYLE_SUFFIX = (
    "工笔线描，平涂设色加单层内阴影，宋代笺纸小品画基调，室内灯下暖调，"
    "色板严格限定为米纸#F7EFE2、赭石#B8733A、墨褐#3A2E26、月白#F2E4C4、"
    "桂花金#E8B84B、灯笼黄#F5C77E，不得引入板外色，米纸纤维细噪点质感，"
    "不用纯平色块，不用渐变高光，不用塑料厚涂，不用粗黑卡通描边，高清。"
)

# 11 banned symbols (0d-§4.3-d) are not pixel-measurable, so prompt-level
# exclusion is the primary defence.
NEG_COMMON = (
    "玉兔，嫦娥，月宫，广寒宫，现代月饼礼盒，塑料包装，西式蛋糕，慕斯，奶油，"
    "红色喜庆灯笼阵，春节，文字，水印，签名，logo，渐变高光，塑料厚涂，"
    "粗黑卡通描边，冷色调，蓝色调，银白色，text，watermark，signature，"
    "gradient，blue tone"
)

# A-10 IS a lantern, so NEG_COMMON's "红色喜庆灯笼阵" would suppress its own
# subject. Same ban, re-worded so it does not hurt the subject.
NEG_LANTERN = (
    "玉兔，嫦娥，月宫，广寒宫，现代月饼礼盒，塑料包装，西式蛋糕，慕斯，奶油，"
    "春节，红色，大红色，成排阵列，多盏，喜庆装饰，文字，水印，签名，logo，"
    "渐变高光，塑料厚涂，粗黑卡通描边，冷色调，蓝色调，银白色，text，watermark，"
    "signature，gradient，blue tone"
)

# --------------------------------------------------------------------------
# Authoritative manifest: 22 rows, verbatim from 0d-bitmap-split.md 0d-§4.1
# --------------------------------------------------------------------------
TIER_CAPS = {"T1": 60.0, "T2": 25.0, "T3": 10.0}   # KiB, 0d-§5.3.2 internal targets

ASSETS = [
    {
        "id": "A-01", "file": "mizhi.webp", "tier": "T1",
        "ship": (512, 512), "crop": None, "est": 30.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一张米黄色手工米纸的近距离平铺纹理特写，纸面布满细小植物纤维与轻微凹凸，"
            "纤维走向随机无规律，明度在基准色上下百分之三内浮动，画面四边纹理连续相接"
            "可无缝拼接，无任何物件、无边框、无图案、无接缝线。"
        ),
    },
    {
        "id": "A-02", "file": "yuebing.webp", "tier": "T1",
        "ship": (512, 512), "crop": None, "est": 42.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一枚手作广式月饼的裸饼特写，圆形饼皮呈赭石色，饼边微鼓，表面光滑无任何"
            "纹样压印，四周留出大量空白，饼体居中不接触画面边缘，单层内阴影表现厚度，"
            "无礼盒无包装。"
        ),
    },
    {
        "id": "A-03", "file": "wen-hui.webp", "tier": "T1",
        "ship": (512, 512), "crop": None, "est": 26.0, "cinnabar": True,
        "negative": NEG_COMMON,
        "body": (
            "一枚中式回纹刻印纹样，左右上下完全对称的几何方折细线，单一朱砂#C9483C "
            "颜色，线宽均匀连续不断裂，线条粗细足以在小尺寸下辨认，透明背景无任何底色，"
            "纹样居中四周留白。"
        ),
    },
    {
        "id": "A-04", "file": "wen-chan.webp", "tier": "T1",
        "ship": (512, 512), "crop": None, "est": 30.0, "cinnabar": True,
        "negative": NEG_COMMON,
        "body": (
            "一枚中式缠枝纹刻印纹样，对称卷曲的藤蔓细线互相缠绕回旋，单一朱砂#C9483C "
            "颜色，线宽均匀连续不断裂，枝蔓转折圆润，线条粗细足以在小尺寸下辨认，"
            "透明背景无底色，纹样居中四周留白。"
        ),
    },
    {
        "id": "A-05", "file": "wen-yun.webp", "tier": "T1",
        "ship": (512, 512), "crop": None, "est": 28.0, "cinnabar": True,
        "negative": NEG_COMMON,
        "body": (
            "一枚中式云纹刻印纹样，对称卷曲的如意云头细线，单一朱砂#C9483C 颜色，"
            "线宽均匀连续不断裂，云尾回旋收束，线条纤细克制、朱砂所占画面面积很小，"
            "透明背景无底色，纹样居中四周留白。"
        ),
    },
    {
        "id": "A-06", "file": "yuanzhuo.webp", "tier": "T1",
        "ship": (512, 512), "crop": None, "est": 48.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一张中式圆桌俯视图，桌面为赭石色木纹，桌沿以细线勾勒，圆周上均匀分布五个"
            "空座位轮廓，每两个座位间隔七十二度，座位只有描边没有填充，画面居中四周留白，"
            "桌上无餐具无食物。"
        ),
    },
    {
        "id": "A-07", "file": "yuanyue.webp", "tier": "T1",
        "ship": (512, 512), "crop": None, "est": 24.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一轮完整满月悬于画面正中，月轮为暖米白#F2E4C4 色圆盘，月面只有极淡的环形"
            "肌理与轻微明暗起伏，不含任何建筑人物动物剪影，不偏冷蓝不偏银白，"
            "圆月居中四周留出大面积空白。"
        ),
    },
    {
        "id": "A-08", "file": "anban.webp", "tier": "T1",
        "ship": (512, 384), "crop": (768, 576), "est": 36.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一块中式木质案板横向平放，台面为赭石色木纹，板边以细线勾勒并有单层内阴影，"
            "板上完全空置不放任何模具与面团，案板居中且四周留出至少八分之一的空白余量"
            "以备裁切，横向构图。"
        ),
    },
    {
        "id": "A-09", "file": "zao.webp", "tier": "T1",
        "ship": (512, 512), "crop": None, "est": 42.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一座中式土灶正面视图，灶体为赭石色泥砖质感，灶口为一个暗色方形开口，"
            "灶口内不含任何火焰与火光，灶体以细线勾勒加单层内阴影，灶体居中四周留出"
            "大量空白，单一暖色锚点在灶体。"
        ),
    },
    {
        "id": "A-10", "file": "denglong.webp", "tier": "T2",
        "ship": (288, 384), "crop": (576, 768), "est": 21.0, "cinnabar": False,
        "negative": NEG_LANTERN,
        "body": (
            "一盏中式圆灯笼单独悬挂，灯笼面为暖黄#F5C77E 单色，骨架与上下箍以细线勾勒，"
            "灯笼内透出一点暖光，整张画面只有这一盏灯笼绝无第二盏绝无阵列，灯笼竖直居中"
            "且四周留出至少八分之一的空白余量，竖向构图，灯笼不是红色。"
        ),
    },
    {
        "id": "A-11", "file": "jiuhu.webp", "tier": "T2",
        "ship": (288, 384), "crop": (576, 768), "est": 21.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一只中式酒壶侧立，壶身为赭石色，壶嘴与壶柄以细线勾勒，壶身有单层内阴影"
            "表现圆润体积，壶身居中且四周留出至少八分之一的空白余量以备裁切，竖向构图，"
            "桌上无酒杯无其他物件。"
        ),
    },
    {
        "id": "A-12", "file": "guizhi.webp", "tier": "T2",
        "ship": (256, 256), "crop": None, "est": 13.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一枝桂花枝斜出，簇生的细小桂花为桂花金#E8B84B 色，枝线与叶片以细线勾勒，"
            "花朵密集成团但轮廓分明，花枝居中四周留出大量空白，整枝只有一种暖色花朵。"
        ),
    },
    {
        "id": "A-13", "file": "xinjian.webp", "tier": "T2",
        "ship": (256, 384), "crop": (512, 768), "est": 19.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一封中式折封信笺竖立，笺面为米纸#F7EFE2 色，纸上有竖向墨线与一道折封线，"
            "笺面不含任何现代信封邮票与塑料包装，信笺竖直居中且四周留出至少八分之一的"
            "空白余量以备裁切，竖向构图。"
        ),
    },
    {
        "id": "A-14", "file": "bingpan.webp", "tier": "T2",
        "ship": (384, 256), "crop": (768, 512), "est": 18.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一只中式竹木晾饼盘横向平放，盘体为赭石色编织质感，盘沿以细线勾勒，"
            "盘内完全空置不放任何饼，盘子居中且四周留出至少八分之一的空白余量以备裁切，"
            "横向构图。"
        ),
    },
    {
        "id": "A-15", "file": "muju.webp", "tier": "T2",
        "ship": (256, 256), "crop": None, "est": 13.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一个中式月饼木模正面视图，模体为赭石色木质，模腔为光滑圆形凹面且腔内完全"
            "无任何纹样刻痕，模体以细线勾勒加单层内阴影，木模居中四周留出大量空白。"
        ),
    },
    {
        "id": "A-16", "file": "chaihuo.webp", "tier": "T3",
        "ship": (128, 128), "crop": None, "est": 7.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一小捆柴火横放，柴枝为赭石色，柴枝轮廓粗壮分明且以较粗的细线勾勒，"
            "捆扎处清晰可辨，柴枝数量三到五根不细碎，柴捆居中四周留出大量空白，"
            "粗壮的轮廓保证缩小后仍可辨认。"
        ),
    },
    {
        "id": "A-17", "file": "icon-caimai.webp", "tier": "T3",
        "ship": (128, 128), "crop": None, "est": 7.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一只中式竹编菜篮正面视图，篮身编织纹路粗壮清晰可辨，篮身以较粗的细线勾勒，"
            "提梁完整，篮内空无一物，竹篮居中四周留出大量空白，轮廓粗壮保证缩小后仍可辨认。"
        ),
    },
    {
        "id": "A-18", "file": "icon-zhibing.webp", "tier": "T3",
        "ship": (128, 128), "crop": None, "est": 7.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一根中式擀面杖横置于一张圆形饼皮之上，擀面杖与饼皮均为赭石色，饼皮边缘"
            "完整圆润，两者以较粗的细线勾勒且轮廓分明，构图居中四周留出大量空白，"
            "轮廓粗壮保证缩小后仍可辨认。"
        ),
    },
    {
        "id": "A-19", "file": "icon-shixin.webp", "tier": "T3",
        "ship": (128, 128), "crop": None, "est": 7.0, "cinnabar": True,
        "negative": NEG_COMMON,
        "body": (
            "一枚中式方形印章与一张方笺并置，印章外框为方形且以细线勾勒，印面刻有对称"
            "几何细线纹样并填单一朱砂#C9483C 色，印面线条纤细清晰不断裂、朱砂所占"
            "画面面积很小，构图居中四周留出大量空白，缩小后印面细线仍可辨认。"
        ),
    },
    {
        "id": "A-20", "file": "liao-putong.webp", "tier": "T3",
        "ship": (128, 128), "crop": None, "est": 7.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一只中式米纸#F7EFE2 色布袋鼓胀装满基底粉料，袋口系紧，袋旁斜插一支麦穗，"
            "麦穗与袋身以较粗的细线勾勒，轮廓粗壮分明，构图居中四周留出大量空白，"
            "缩小后布袋与麦穗仍可辨认。"
        ),
    },
    {
        "id": "A-21", "file": "liao-haoliao.webp", "tier": "T3",
        "ship": (128, 128), "crop": None, "est": 7.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一只中式赭石色锦囊袋身收紧成囊状，囊口以桂花金#E8B84B 色系带束起并垂下流苏，"
            "锦囊与布袋形态明显不同一眼可分，轮廓以较粗的细线勾勒且粗壮分明，"
            "构图居中四周留出大量空白。"
        ),
    },
    {
        "id": "A-22", "file": "liao-danhuang.webp", "tier": "T3",
        "ship": (128, 128), "crop": None, "est": 7.0, "cinnabar": False,
        "negative": NEG_COMMON,
        "body": (
            "一枚剖开的中式咸蛋，蛋白用米纸白#F7EFE2 平涂，蛋黄用桂花金#E8B84B "
            "与琥珀#B8733A 两色平涂出粉沙颗粒；全图无任何高光、镜面反光或光滑渐变，"
            "外圈以墨#3A2E26 细线勾边，构图饱满居中，缩小后蛋白与蛋黄分界仍可辨。"
        ),
    },
]

BODY_MIN_CHARS, BODY_MAX_CHARS = 50, 200


# --------------------------------------------------------------------------
# Pre-flight: fail before spending a single request
# --------------------------------------------------------------------------
def preflight(assets):
    """Assert manifest invariants. Returns a list of fatal problem strings."""
    problems = []

    if len(assets) != 22:
        problems.append("manifest has %d rows, 0d-§4.1 requires exactly 22" % len(assets))

    ids = [a["id"] for a in assets]
    if len(set(ids)) != len(ids):
        problems.append("duplicate asset ids")

    files = [a["file"] for a in assets]
    if len(set(files)) != len(files):
        problems.append("duplicate file names")
    for f in files:
        if not f.endswith(".webp"):
            problems.append("%s is not .webp (PNG must not ship)" % f)

    # --- the byte-identity assertion, same shape as gen_yuegong_scenes.py:136-140
    prompts = [full_prompt(a) for a in assets]
    suffixes = {p.splitlines()[-1] for p in prompts}
    if len(suffixes) != 1:
        problems.append("style suffix differs across assets (%d distinct)" % len(suffixes))
    elif next(iter(suffixes)) != STYLE_SUFFIX:
        problems.append("style suffix is not byte-identical to STYLE_SUFFIX")

    for a in assets:
        prompt = full_prompt(a)
        if not prompt.endswith(STYLE_SUFFIX):
            problems.append("%s prompt does not end with the shared suffix" % a["id"])

        n = len(a["body"])
        if not BODY_MIN_CHARS <= n <= BODY_MAX_CHARS:
            problems.append("%s body is %d chars, must be %d-%d"
                            % (a["id"], n, BODY_MIN_CHARS, BODY_MAX_CHARS))

        # V-30 (1): the gateway's total-pixel floor. Never request below 768*768.
        total = GEN_W * GEN_H
        if not MIN_TOTAL_PIXELS <= total <= MAX_TOTAL_PIXELS:
            problems.append("%s generation size %d*%d = %d px is outside [%d, %d]"
                            % (a["id"], GEN_W, GEN_H, total,
                               MIN_TOTAL_PIXELS, MAX_TOTAL_PIXELS))

        # V-30 (2): shipping short edge >= 128 px.
        w, h = a["ship"]
        if min(w, h) < SHIP_SHORT_EDGE_FLOOR:
            problems.append("%s shipping short edge %d < %d"
                            % (a["id"], min(w, h), SHIP_SHORT_EDGE_FLOOR))
        if max(w, h) >= GEN_W:
            problems.append("%s shipping long edge %d must be < %d (downscale required)"
                            % (a["id"], max(w, h), GEN_W))

        # Non-square targets are center-cropped, so the prompt must ask for margin.
        if w != h and a["crop"] is None:
            problems.append("%s ships %dx%d but has no crop box" % (a["id"], w, h))
        if w != h and "八分之一" not in a["body"]:
            problems.append("%s is center-cropped but its body lacks the >=12.5%% "
                            "composition-margin clause" % a["id"])

        if a["crop"] is not None:
            cw, ch = a["crop"]
            if cw > GEN_W or ch > GEN_H:
                problems.append("%s crop box %dx%d exceeds the %dx%d canvas"
                                % (a["id"], cw, ch, GEN_W, GEN_H))
            if abs(cw / ch - w / h) > 0.01:
                problems.append("%s crop aspect %.4f != shipping aspect %.4f"
                                % (a["id"], cw / ch, w / h))

        if a["tier"] not in TIER_CAPS:
            problems.append("%s has unknown tier %s" % (a["id"], a["tier"]))

    # Cinnabar is only allowed on 4 assets, and its hex must not leak into the
    # shared suffix (that would authorise it on all 22).
    cinnabar_ids = sorted(a["id"] for a in assets if a["cinnabar"])
    if cinnabar_ids != ["A-03", "A-04", "A-05", "A-19"]:
        problems.append("cinnabar assets are %s, 0d-§4.3-b requires "
                        "['A-03', 'A-04', 'A-05', 'A-19']" % cinnabar_ids)
    if "#C9483C" in STYLE_SUFFIX:
        problems.append("cinnabar hex is in the shared suffix, which would authorise "
                        "it on the 18 assets that must not contain it")
    for a in assets:
        has_hex = "#C9483C" in a["body"]
        if has_hex != a["cinnabar"]:
            problems.append("%s cinnabar flag=%s but body hex present=%s"
                            % (a["id"], a["cinnabar"], has_hex))

    # The 11 banned symbols must reach negative_prompt.
    banned = ["玉兔", "嫦娥", "月宫", "广寒宫", "现代月饼礼盒", "塑料包装",
              "西式蛋糕", "慕斯", "奶油", "春节"]
    for neg_name, neg in (("NEG_COMMON", NEG_COMMON), ("NEG_LANTERN", NEG_LANTERN)):
        missing = [b for b in banned if b not in neg]
        if missing:
            problems.append("%s is missing banned symbols %s" % (neg_name, missing))
    if "红色" not in NEG_LANTERN or "阵列" not in NEG_LANTERN:
        problems.append("NEG_LANTERN must still ban red + array (the lantern-array "
                        "ban re-worded so it does not suppress A-10's own subject)")

    return problems


def full_prompt(asset):
    """Body + shared suffix. The suffix MUST be the last line (preflight relies on it)."""
    return asset["body"] + "\n" + STYLE_SUFFIX


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
            key = key.strip()
            value = value.strip()
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
# Gateway calls
# --------------------------------------------------------------------------
def request_image(env, prompt, negative):
    """POST /chat/completions. `content` must be a LIST of typed parts.

    Returns (image_url, api_size). The URL expires in ~24h, so callers must
    download immediately and never store the URL alone.
    """
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


def download(image_url, dest):
    """Download immediately -- the OSS URL expires in ~24h."""
    req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()
    with open(dest, "wb") as fh:
        fh.write(data)
    return len(data)


# --------------------------------------------------------------------------
# The mandatory downscale step (0d-§4.4 step 2 + 3)
# --------------------------------------------------------------------------
def center_crop(img, box):
    """Crop to `box` from the center of the 768*768 canvas."""
    bw, bh = box
    w, h = img.size
    if (w, h) == (bw, bh):
        return img
    left = (w - bw) // 2
    top = (h - bh) // 2
    return img.crop((left, top, left + bw, top + bh))


def downscale_to_ship(raw_path, asset):
    """768*768 raw -> center-crop (if non-square) -> LANCZOS -> webp q80."""
    img = Image.open(raw_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    if asset["crop"] is not None:
        img = center_crop(img, asset["crop"])

    ship = asset["ship"]
    if img.size != ship:
        img = img.resize(ship, Image.LANCZOS)

    dest = os.path.join(SHIP_DIR, asset["file"])
    img.save(dest, "WEBP", quality=WEBP_QUALITY)
    return dest, img.size


# --------------------------------------------------------------------------
# Colour measurement: nearest-of-7 assignment, NOT tolerance balls
# --------------------------------------------------------------------------
# Tolerance balls overlap (paper and moon are adjacent colours) and double-count,
# which produces wildly wrong shares -- a prior naive ball measurement reported
# cinnabar 14.29% where the true nearest-colour figure was 0.67%.
def palette_shares(path):
    """Nearest-of-7 assignment over opaque pixels. Shares sum to exactly 100.00."""
    img = Image.open(path).convert("RGBA")
    pixels = list(img.getdata())
    opaque = [p for p in pixels if p[3] >= 128]
    total = len(opaque)
    if total == 0:
        return None, 0

    counts = [0] * len(PALETTE)
    for r, g, b, _ in opaque:
        best, best_d = 0, None
        for i, (_, pr, pg, pb) in enumerate(PALETTE):
            d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
            if best_d is None or d < best_d:
                best, best_d = i, d
        counts[best] += 1

    shares = [round(100.0 * c / total, 2) for c in counts]
    # Force the sum to exactly 100.00: give the rounding residual to the largest
    # share, which is the least distorted by it.
    residual = round(100.0 - sum(shares), 2)
    if residual:
        shares[max(range(len(shares)), key=lambda i: shares[i])] = round(
            shares[max(range(len(shares)), key=lambda i: shares[i])] + residual, 2)

    out = {PALETTE[i][0]: shares[i] for i in range(len(PALETTE))}
    return out, total


# --------------------------------------------------------------------------
# Per-asset reporting
# --------------------------------------------------------------------------
def inspect_ship(asset):
    """Return a report row for one shipped asset, or None if it is absent."""
    path = os.path.join(SHIP_DIR, asset["file"])
    if not os.path.exists(path):
        return None
    img = Image.open(path)
    nbytes = os.path.getsize(path)
    kib = nbytes / 1024.0
    cap = TIER_CAPS[asset["tier"]]
    shares, counted = palette_shares(path)
    cin = shares["cinnabar"] if shares else 0.0
    return {
        "id": asset["id"], "file": asset["file"], "tier": asset["tier"],
        "path": path, "size": img.size, "mode": img.mode,
        "bytes": nbytes, "kib": kib, "cap": cap, "est": asset["est"],
        "over_tier": kib > cap,
        "over_v30": nbytes > PER_IMAGE_CEILING_KB * 1000,
        "short_edge_ok": min(img.size) >= SHIP_SHORT_EDGE_FLOOR,
        "dims_ok": img.size == asset["ship"],
        "shares": shares, "counted": counted, "cinnabar": cin,
        "cinnabar_ok": cin <= CINNABAR_MAX_PCT,
    }


def print_report(rows):
    print("\n=== shipped-asset report (%s) ===" % SHIP_DIR)
    header = ("%-6s %-20s %-3s %-10s %9s %8s %8s %-6s %-8s %s"
              % ("id", "file", "tier", "dims", "KiB", "cap", "est",
                 "tier", "cinnabar", "palette shares (nearest-of-7, sums to 100.00)"))
    print(header)
    print("-" * len(header))

    total_kib = 0.0
    worst = []
    for r in rows:
        if r is None:
            continue
        total_kib += r["kib"]
        flag = "OVER" if r["over_tier"] else "ok"
        if r["over_tier"]:
            worst.append(r)
        cin_flag = "" if r["cinnabar_ok"] else " <-- OVER 5%"
        shares_txt = " ".join("%s %.2f%%" % (k, v) for k, v in r["shares"].items()) \
            if r["shares"] else "n/a"
        print("%-6s %-20s %-3s %-10s %9.2f %8.1f %8.1f %-6s %7.2f%%%s  %s"
              % (r["id"], r["file"], r["tier"],
                 "%dx%d" % r["size"], r["kib"], r["cap"], r["est"],
                 flag, r["cinnabar"], cin_flag, shares_txt))

    present = [r for r in rows if r is not None]
    missing = [a["id"] for a, r in zip(ASSETS, rows) if r is None]

    print("-" * len(header))
    print("present        = %d / 22" % len(present))
    if missing:
        print("missing        = %s" % ", ".join(missing))
    print("total          = %.2f KiB  (design target 460 KiB, budget 900 KiB, "
          "worst-case caps 760 KiB)" % total_kib)
    print("largest single = %.2f KiB  (V-30 outer ceiling %d KB)"
          % (max((r["kib"] for r in present), default=0.0), PER_IMAGE_CEILING_KB))
    est_total = sum(a["est"] for a in ASSETS)
    print("manifest est   = %.0f KiB across 22 rows" % est_total)

    if worst:
        print("\n!! %d asset(s) OVER their tier target:" % len(worst))
        for r in worst:
            print("   %s %s = %.2f KiB > %s cap %.1f KiB"
                  % (r["id"], r["file"], r["kib"], r["tier"], r["cap"]))
        print("   Legal remedies ONLY (quality is locked at q80 both ways):")
        print("     1) shrink the shipping dims (never below the %d px short-edge floor)"
              % SHIP_SHORT_EDGE_FLOOR)
        print("     2) regenerate with a lower-entropy composition")
        print("   Lowering quality below q80 is NOT a remedy -- it breaches the q80 lock.")

    bad_dims = [r["id"] for r in present if not r["dims_ok"]]
    if bad_dims:
        print("\n!! dims differ from 0d-§4.1: %s" % ", ".join(bad_dims))
    bad_edge = [r["id"] for r in present if not r["short_edge_ok"]]
    if bad_edge:
        print("!! short edge < %d px: %s" % (SHIP_SHORT_EDGE_FLOOR, ", ".join(bad_edge)))
    bad_cin = [r["id"] for r in present if not r["cinnabar_ok"]]
    if bad_cin:
        print("!! cinnabar share > %.1f%%: %s" % (CINNABAR_MAX_PCT, ", ".join(bad_cin)))


# --------------------------------------------------------------------------
# Contact sheet -- the ONE manual visual spot-check pass
# --------------------------------------------------------------------------
CELL_W, CELL_H = 288, 250
ZOOM_BOX = 168
ACTUAL_BOX = 100
PAD = 16
COLS = 6
SHEET_BG = (214, 208, 198)      # warm grey: keeps --paper assets visible
INK_RGB = (0x3A, 0x2E, 0x26)
AMBER_RGB = (0xB8, 0x73, 0x3A)
CINNABAR_RGB = (0xC9, 0x48, 0x3C)
MUTED_RGB = (110, 104, 96)


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


def fit_rgba(img, box):
    """Fit into `box`, preserving aspect. Returns RGBA so alpha stays visible."""
    out = img.copy()
    out.thumbnail((box, box), Image.LANCZOS)
    return out


def paste_alpha(sheet, img, x, y):
    sheet.paste(img, (x, y), img)


def build_contact_sheet():
    rows = [inspect_ship(a) for a in ASSETS]
    present = [r for r in rows if r is not None]
    if not present:
        print("nothing to sheet: no shipped assets under %s" % SHIP_DIR)
        print("run `python tests/gen_yueyan_assets.py` first")
        return None

    os.makedirs(DRAFT_DIR, exist_ok=True)

    n_rows = (len(ASSETS) + COLS - 1) // COLS
    header_h = 76
    footer_h = 96
    tiling_h = 200
    sheet_w = PAD * 2 + COLS * CELL_W + (COLS - 1) * PAD
    sheet_h = header_h + n_rows * (CELL_H + PAD) + tiling_h + footer_h + PAD * 2

    sheet = Image.new("RGB", (sheet_w, sheet_h), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    f_title = sheet_font(26)
    f_sub = sheet_font(15)
    f_cell = sheet_font(14)

    draw.text((PAD, PAD), "月宴 · 22 张素材 · 唯一一次人工目视",
              font=f_title, fill=INK_RGB)
    draw.text((PAD, PAD + 34),
              "左格 = 放大到统一格子（判构图 / 禁用符号）   右格 = 入库尺寸真实像素"
              "（判 128 px 下是否仍可辨）   底部 = A-01 三×三平铺（判接缝）",
              font=f_sub, fill=MUTED_RGB)

    y0 = header_h
    for idx, (asset, row) in enumerate(zip(ASSETS, rows)):
        col, rw = idx % COLS, idx // COLS
        x = PAD + col * (CELL_W + PAD)
        y = y0 + rw * (CELL_H + PAD)

        draw.rectangle([x, y, x + CELL_W, y + CELL_H], outline=AMBER_RGB, width=1)
        draw.text((x + 8, y + 6), "%s · %s" % (asset["id"], asset["file"]),
                  font=f_cell, fill=INK_RGB)
        draw.text((x + 8, y + 24), "%s · %dx%d · cap %.0f KiB"
                  % (asset["tier"], asset["ship"][0], asset["ship"][1],
                     TIER_CAPS[asset["tier"]]), font=f_cell, fill=MUTED_RGB)

        img_y = y + 44
        if row is None:
            draw.text((x + 10, img_y + 60), "missing", font=f_cell, fill=CINNABAR_RGB)
            continue

        img = Image.open(row["path"]).convert("RGBA")

        zoom = fit_rgba(img, ZOOM_BOX)
        paste_alpha(sheet, zoom, x + 8, img_y)

        actual = img if max(img.size) <= ACTUAL_BOX else fit_rgba(img, ACTUAL_BOX)
        ax = x + 8 + ZOOM_BOX + 10
        paste_alpha(sheet, actual, ax, img_y)
        draw.text((ax, img_y + ACTUAL_BOX + 4), "%dx%d real"
                  % (img.size[0], img.size[1]), font=f_cell, fill=MUTED_RGB)

        status = "OVER %.0f KiB" % row["cap"] if row["over_tier"] else "ok"
        status_colour = CINNABAR_RGB if row["over_tier"] else MUTED_RGB
        draw.text((x + 8, y + CELL_H - 22), "%.2f KiB · %s" % (row["kib"], status),
                  font=f_cell, fill=status_colour)

    # A-01 tiling proof: seamlessness can only be judged by eye (0d-V-H).
    ty = y0 + n_rows * (CELL_H + PAD) + PAD
    draw.text((PAD, ty), "A-01 mizhi.webp · 三×三平铺接缝检查（§8.3 第 844 行 / 0d-V-H）",
              font=f_sub, fill=INK_RGB)
    mizhi = inspect_ship(ASSETS[0])
    if mizhi is not None:
        tile = Image.open(mizhi["path"]).convert("RGBA").resize((160, 160), Image.LANCZOS)
        for i in range(3):
            for j in range(3):
                paste_alpha(sheet, tile, PAD + i * 160, ty + 24 + j * 160)
        draw.text((PAD + 3 * 160 + 16, ty + 40),
                  "目视判据：九块之间无可见接缝、无方向性条纹。",
                  font=f_sub, fill=MUTED_RGB)
        draw.text((PAD + 3 * 160 + 16, ty + 66),
                  "若可见接缝 → 重出 A-01（不建自动化平铺门禁）。",
                  font=f_sub, fill=MUTED_RGB)
    else:
        draw.text((PAD, ty + 40), "A-01 missing", font=f_sub, fill=CINNABAR_RGB)

    fy = sheet_h - PAD - 70
    draw.text((PAD, fy),
              "人工目视 8 条：① 一眼可读为中秋手作  ② 暖/室内/纸质，无冷蓝银白墨黑底  "
              "③ A-01 无接缝  ④ A-03/04/05 朱砂线连续",
              font=f_sub, fill=INK_RGB)
    draw.text((PAD, fy + 22),
              "⑤ T3 七项在 128 px 下仍可辨  ⑥ A-20 与 A-21 一眼可分  "
              "⑦ 11 项禁用符号不出现  ⑧ 无 AI slop（塑料光泽/渐变高光/粗黑卡通边）",
              font=f_sub, fill=INK_RGB)
    draw.text((PAD, fy + 46),
              "第 ① 条是硬门槛（bobing 首版即因「看不出和中秋的关系」被否）。"
              "本 sheet 不入包、不计入 V-2。",
              font=f_sub, fill=CINNABAR_RGB)

    sheet.save(CONTACT_SHEET, quality=92)
    print("saved = %s" % CONTACT_SHEET)
    print("size  = %dx%d  (%.0f KB)"
          % (sheet.width, sheet.height, os.path.getsize(CONTACT_SHEET) / 1024))
    print("tiles = %d present / %d missing"
          % (len(present), len(ASSETS) - len(present)))
    return CONTACT_SHEET


# --------------------------------------------------------------------------
# Generation loop (resumable / idempotent)
# --------------------------------------------------------------------------
def already_shipped(asset):
    """True when the shipped file satisfies every HARD constraint.

    Only hard constraints belong in this predicate: correct dims, the 128 px
    short-edge floor, the V-30 per-image ceiling, and the locked section-8.2
    cinnabar cap of <=5%.

    The internal per-tier KiB target is deliberately EXCLUDED -- it is advisory.
    An asset over it is still shippable (it sits far under the V-30 ceiling), and
    because q80 is locked both ways the only remedies are smaller shipping dims or
    a lower-entropy regeneration. Neither converges by retrying, so treating the
    target as a hard gate would churn the same asset on every run, burning a
    gateway call and risking a worse result each time.

    The cinnabar clause is the load-bearing addition: without it, an asset that
    breaches the section-8.2 cap but still fits its byte target is treated as
    finished and silently skipped on every later run, so `--only <id>` re-measures
    the stale file instead of regenerating it. The skip predicate must cover the
    same hard constraints the report flags, or it hides the failures it should
    surface.
    """
    row = inspect_ship(asset)
    if row is None:
        return False
    return (row["dims_ok"] and row["short_edge_ok"]
            and not row["over_v30"] and row["cinnabar_ok"])


def process(env, asset, force):
    raw_path = os.path.join(RAW_DIR, "%s_%s.png" % (asset["id"], os.path.splitext(asset["file"])[0]))

    print("\n--- %s  %s ---" % (asset["id"], asset["file"]))
    print("  tier       = %s   cap %.0f KiB   est %.0f KiB"
          % (asset["tier"], TIER_CAPS[asset["tier"]], asset["est"]))
    print("  pipeline   = generate %s -> %s -> webp q%d"
          % (GEN_SIZE,
             ("center-crop %dx%d + LANCZOS" % asset["crop"]) if asset["crop"]
             else "LANCZOS",
             WEBP_QUALITY))
    print("  ship dims  = %dx%d" % asset["ship"])

    if not force and already_shipped(asset):
        row = inspect_ship(asset)
        print("  SKIP       = already generated and downscaled (%.2f KiB, dims %dx%d)"
              % (row["kib"], row["size"][0], row["size"][1]))
        return inspect_ship(asset)

    if not force and os.path.exists(raw_path):
        print("  reuse raw  = %s (no gateway call)" % os.path.basename(raw_path))
    else:
        prompt = full_prompt(asset)
        print("  prompt     = %d chars body + %d chars shared suffix"
              % (len(asset["body"]), len(STYLE_SUFFIX)))
        try:
            image_url, api_size = request_image(env, prompt, asset["negative"])
        except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError) as exc:
            print("  GENERATE FAILED: %s" % exc)
            print("  (do NOT retry against /images/generations -- it 400s on this gateway)")
            return None
        # Download immediately: the OSS URL expires in ~24h.
        try:
            nbytes = download(image_url, raw_path)
        except (urllib.error.HTTPError, urllib.error.URLError) as exc:
            print("  DOWNLOAD FAILED: %s" % exc)
            return None
        print("  api size   = %s   raw = %s (%.0f KB, not shipped, not in V-2)"
              % (api_size, os.path.basename(raw_path), nbytes / 1024))

    try:
        dest, size = downscale_to_ship(raw_path, asset)
    except OSError as exc:
        print("  DOWNSCALE FAILED: %s" % exc)
        return None

    row = inspect_ship(asset)
    print("  shipped    = %s  %dx%d  %.2f KiB"
          % (os.path.basename(dest), size[0], size[1], row["kib"]))
    if row["over_tier"]:
        print("  !! OVER    = %.2f KiB > %s cap %.1f KiB  -- regenerate lower-entropy "
              "or shrink dims; do NOT lower quality below q%d"
              % (row["kib"], row["tier"], row["cap"], WEBP_QUALITY))
    else:
        print("  tier check = ok (%.2f / %.1f KiB)" % (row["kib"], row["cap"]))
    if not row["cinnabar_ok"]:
        print("  !! cinnabar %.2f%% > %.1f%%" % (row["cinnabar"], CINNABAR_MAX_PCT))
    print("  palette    = %s" % " ".join("%s %.2f%%" % (k, v)
                                         for k, v in row["shares"].items()))
    return row


def ratio_label(src, dst):
    """Human-readable downscale ratio, e.g. '1.5:1' or '6:1'."""
    factor = src[0] / dst[0]
    if abs(factor - round(factor)) < 0.01:
        return "%d:1" % round(factor)
    return ("%f" % factor).rstrip("0").rstrip(".") + ":1"


def parse_only(spec):
    wanted = [s.strip().upper() for s in spec.split(",") if s.strip()]
    unknown = [w for w in wanted if w not in {a["id"] for a in ASSETS}]
    if unknown:
        raise SystemExit("FATAL: unknown asset ids %s" % ", ".join(unknown))
    return wanted


def main():
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", help="comma-separated asset ids, e.g. A-01,A-07")
    parser.add_argument("--force", action="store_true",
                        help="regenerate even if already shipped")
    parser.add_argument("--dry-run", action="store_true",
                        help="print the 22-row plan, make no network call")
    parser.add_argument("--report", action="store_true",
                        help="print sizes + palette shares for shipped assets only")
    parser.add_argument("--contact-sheet", action="store_true",
                        help="build the single manual spot-check contact sheet")
    args = parser.parse_args()

    problems = preflight(ASSETS)
    if problems:
        print("FATAL: manifest pre-flight failed, no request will be sent")
        for p in problems:
            print("  - %s" % p)
        sys.exit(1)
    print("preflight OK: 22 assets, style suffix byte-identical across all 22")

    if args.contact_sheet:
        build_contact_sheet()
        return

    rows = [inspect_ship(a) for a in ASSETS]
    if args.report:
        print_report(rows)
        return

    selected = ASSETS
    if args.only:
        wanted = parse_only(args.only)
        selected = [a for a in ASSETS if a["id"] in wanted]

    if args.dry_run:
        print("\n=== dry run: %d row(s), no network call ===" % len(selected))
        print("%-6s %-20s %-3s %-9s %-9s %-16s %7s %6s %6s %s"
              % ("id", "file", "tier", "gen", "ship", "downscale", "cap",
                 "est", "body", "negative"))
        for a in selected:
            step = ("crop %dx%d + %s" % (a["crop"][0], a["crop"][1],
                                         ratio_label(a["crop"], a["ship"]))) \
                if a["crop"] else ratio_label((GEN_W, GEN_H), a["ship"])
            print("%-6s %-20s %-3s %-9s %-9s %-16s %7.0f %6.0f %6d %s"
                  % (a["id"], a["file"], a["tier"], "%d*%d" % (GEN_W, GEN_H),
                     "%dx%d" % a["ship"], step, TIER_CAPS[a["tier"]], a["est"],
                     len(a["body"]),
                     "NEG_LANTERN" if a["negative"] is NEG_LANTERN else "NEG_COMMON"))
        total_est = sum(a["est"] for a in selected)
        print("\nselected est total = %.0f KiB   (full manifest = %.0f KiB, budget 900 KiB)"
              % (total_est, sum(a["est"] for a in ASSETS)))
        print("worst-case caps    = %.0f KiB"
              % sum(TIER_CAPS[a["tier"]] for a in selected))
        return

    env = load_env()
    os.makedirs(SHIP_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)

    produced = []
    for asset in selected:
        row = process(env, asset, args.force)
        if row is not None:
            produced.append(row)

    print("\nprocessed %d / %d selected" % (len(produced), len(selected)))
    print_report([inspect_ship(a) for a in ASSETS])
    print("\nnext: python tests/gen_yueyan_assets.py --contact-sheet")
    print("      then do the ONE manual visual pass over %s" % CONTACT_SHEET)


if __name__ == "__main__":
    main()
