#!/usr/bin/env python3
"""把 docs/preview-tangqiu/ 里的竖屏截图排成 900×1200 的小红书配图。

用法：python3 scripts/tangqiu-covers.py
产物：release/tangqiu/images/01..05.png
"""
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "preview-tangqiu"
OUT = ROOT / "release" / "tangqiu" / "images"
FONT = "/System/Library/Fonts/Hiragino Sans GB.ttc"
W, H = 900, 1200

SHOTS = [
    ("01.png", "03-中期.png", "糖球转转", "三分钟，怪从四面涌上来"),
    ("02.png", "02-战斗.png", "糖针绕着转", "近身自动打，不用瞄准"),
    ("03.png", "04-升级三选一.png", "升级三选一", "新武器 / 升武器 / 加属性"),
    ("04.png", "05-BOSS.png", "大蛋糕来了", "160 秒后的 BOSS 关"),
    ("05.png", "06-结算.png", "活到天亮", "结算卡能存成图"),
]


def font(size, bold=True):
    return ImageFont.truetype(FONT, size, index=1 if bold else 0)


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def backdrop():
    """奶油底 + 粉色径向柔光（程序化，不用外部素材）。"""
    base = Image.new("RGB", (W, H), (255, 246, 242))
    px = base.load()
    cx, cy = W * 0.5, H * 0.42
    for y in range(H):
        for x in range(W):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / 1500.0
            k = min(1.0, d) ** 2
            px[x, y] = (
                255,
                int(246 + (219 - 246) * k),
                int(242 + (228 - 242) * k),
            )
    return base


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bg = backdrop()
    for name, shot, title, sub in SHOTS:
        src = Image.open(SRC / shot).convert("RGB")
        canvas = bg.copy()
        d = ImageDraw.Draw(canvas)

        d.text((W // 2, 92), title, font=font(78), fill=(91, 75, 75), anchor="mm", stroke_width=1)
        d.text((W // 2, 168), sub, font=font(30, False), fill=(160, 140, 138), anchor="mm")

        target_h = 900
        scale = target_h / src.size[1]
        w2 = int(src.size[0] * scale)
        pic = rounded(src.resize((w2, target_h), Image.LANCZOS), 28)
        canvas.paste(pic, ((W - w2) // 2, 220), pic)

        d = ImageDraw.Draw(canvas)
        d.rectangle([(W - w2) // 2, 220, (W + w2) // 2, 220 + target_h], outline=(91, 75, 75), width=3)

        d.text((W // 2, 1160), "小红书小工具 · 搜索「糖球转转」", font=font(26, False), fill=(176, 160, 156), anchor="mm")
        canvas.save(OUT / name, quality=92)
        print("wrote", OUT / name)


if __name__ == "__main__":
    main()
