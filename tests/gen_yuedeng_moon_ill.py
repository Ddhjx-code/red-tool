"""Generate an ILLUSTRATION-style moon for 月下灯会 (alternate to the photo moon).

Why this exists: the shipping moon was generated photo-real (the original
STYLE_SUFFIX asks for 写实天文月面摄影质感 and NEG_MOON negatives 卡通/插画), but
visual review found the photo surface clashes with the game's flat vector
language -- "月面仍是写实环形山连续调，与扁平灯笼、纯剪影檐仍隔一档分辨率".

This driver reuses tests/gen_yuedeng_moon.py's whole pipeline (gateway call,
chroma-key, flood fill, despill, LANCZOS, lossless WEBP) and overrides ONLY the
style constants plus the manifest, writing to new filenames. It never overwrites
moon.webp -- the photo moon stays available so the user can choose.

SMOOTH_MIN_COLORS is lowered because a flat illustration legitimately carries far
fewer colours than a photographic surface; leaving the photo threshold in place
would flag every correct illustration.

Usage:
    python tests/gen_yuedeng_moon_ill.py --dry-run
    python tests/gen_yuedeng_moon_ill.py
    python tests/gen_yuedeng_moon_ill.py --report
"""

import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_spec = importlib.util.spec_from_file_location(
    "gen_yuedeng_moon", os.path.join(ROOT, "tests", "gen_yuedeng_moon.py"))
gym = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gym)

# --------------------------------------------------------------------------
# Style override: flat illustration, NOT photography.
# --------------------------------------------------------------------------
gym.GENRE_PIN = "扁平插画"

gym.STYLE_SUFFIX = (
    "扁平插画风格，工笔淡彩质感，色块简洁、边缘干净，月海以两到三个色阶"
    "概括而非写真纹理，明暗过渡柔和不留照片颗粒，无高频噪点无摄影景深，"
    "整体暖米白调，色板严格限定为月白#F2E4C4、月面暗部#C8B795、月缘墨褐#3A2E26，"
    "不得引入板外色，不偏冷蓝不偏银白不发青，画面绝无光晕光斑辉光星点云层，"
    "背景为纯品红#FF00FF纯色平涂，月轮边缘干净利落便于抠图，不用文字，不用水印，高清。"
)

gym.NEG_MOON = (
    "文字，水印，签名，logo，text，watermark，signature，冷色调，蓝色调，银白色，"
    "青色，blue tone，写实照片，摄影，天文望远镜实拍，照片质感，高频纹理，噪点，"
    "颗粒感，光晕，辉光，光斑，镜头光晕，星空，星星，云层，云朵，玉兔，嫦娥，月宫，"
    "广寒宫，桂树，建筑剪影，人物剪影，动物剪影，像素画，粗黑卡通描边，低分辨率，"
    "jpeg压缩伪影，多余物件，边框，月亮以外的任何物件"
)

gym.SMOOTH_MIN_COLORS = 60

gym.ASSETS = [
    {
        "id": "I-01", "file": "moon-ill-a.webp", "role": "primary",
        "body": (
            "一轮完整满月悬于画面正中，扁平插画笔法的暖米白#F2E4C4 圆盘，"
            "月面只用两三个简化色块概括暗色月海#C8B795，色块边缘干净略带手绘感，"
            "左上方受光略亮，月缘向墨褐#3A2E26 柔和暗化一圈，"
            "夜空辉光桂金#E8B84B 由画面外叠加本图绝不含任何辉光，"
            "不含任何建筑人物动物剪影与桂树月宫，背景为纯品红#FF00FF纯色平涂，"
            "月轮居中四周留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "I-02", "file": "moon-ill-b.webp", "role": "alternate",
        "body": (
            "一轮柔和发亮的满月，扁平插画笔法的暖米白#F2E4C4 圆盘，"
            "月面肌理极简，只有两三片淡淡的暗色月海#C8B795 色块，没有细节纹理，"
            "月面中心略亮向四周渐柔，月缘向墨褐#3A2E26 柔和过渡，"
            "夜空辉光桂金#E8B84B 由画面外叠加本图绝不含任何辉光，"
            "不含任何建筑人物动物剪影与桂树月宫，背景为纯品红#FF00FF纯色平涂，"
            "月轮居中四周留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "I-03", "file": "moon-ill-c.webp", "role": "alternate",
        "body": (
            "一轮扁平的满月，插画笔法的暖米白#F2E4C4 圆盘，月面只保留一大片"
            "不规则的暗色月海#C8B795 色块与一处小斑，形如简笔剪影，无任何写真纹理，"
            "月缘以墨褐#3A2E26 细描一圈略深于月面，"
            "夜空辉光桂金#E8B84B 由画面外叠加本图绝不含任何辉光，"
            "不含任何建筑人物动物剪影与桂树月宫，背景为纯品红#FF00FF纯色平涂，"
            "月轮居中四周留出至少八分之一空白余量。"
        ),
    },
]

if __name__ == "__main__":
    gym.main()
