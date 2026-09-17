"""把怪物素材缩到「游戏内实际显示尺寸」并贴在夜景底色上，交视觉模型复测可读性。

为什么必须这么做：视觉模型上一轮的判语是
    「能进测试包跑流程，但图2图3缩到实际显示尺寸复测通过之前，别锁终版」
——在 1024px 白底预览里打分，和不缩到 48~70px、贴在近黑夜色上打分，是两件事。

游戏内换算：px = 17（竖屏 390x844），疫气绘制高 2.6 世界单位、瘟鬼 4.2 → 44px / 71px。
"""
import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
IMGDIR = ROOT / "tools" / "wuhuolong" / "assets" / "img"
OUT = ROOT / "docs" / "research" / "wuhuolong-drafts" / "ingame"
PX = 17.0
BG = (10, 20, 32, 255)

ITEMS = [
    ("foe-miasma.webp", 2.6 * PX),
    ("foe-ghost.webp", 4.2 * PX),
    ("man-dancer.webp", 5.4 * PX),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, h in ITEMS:
        src = IMGDIR / name
        if not src.exists():
            print("  skip (missing):", name)
            continue
        im = Image.open(src).convert("RGBA")
        h = max(12, round(h))
        w = max(6, round(im.width * h / im.height))
        small = im.resize((w, h), Image.LANCZOS)
        pad = 26
        canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), BG)
        canvas.alpha_composite(small, (pad, pad))
        dest = OUT / (name.replace(".webp", "-ingame.png"))
        canvas.convert("RGB").save(dest, quality=95)
        print("  %-26s %3dx%-3d -> %s" % (name, w, h, dest.name))


if __name__ == "__main__":
    main()
