#!/usr/bin/env python3
"""糖球转转 · 素材后处理：去水印 → 抠底 → 裁边 → 缩放到游戏尺寸。

用法：
    python3 scripts/tangqiu-art.py           # 处理 docs/art/tangqiu/src 下全部 *-vN.png
    python3 scripts/tangqiu-art.py hero      # 只处理指定 code

规则（对应 docs/specs/2026-11-17-tangqiu-art-pack.md §8）：
- 源图 1024 原图留档在 docs/art/tangqiu/src/，入库
- 进包运行时素材输出 tools/tangqiu/assets/art/<code>.png，256×256（BOSS 320×320）
- 生成水印固定在右下角，先按背景色覆盖，再与背景一起被 floodfill 吃掉
"""
import sys
import pathlib

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/art/tangqiu/src"
OUT = ROOT / "tools/tangqiu/assets/art"

# 单个主体的进包尺寸
SIZES = {"b1": 288, "b2": 288, "b3": 288, "b4": 288,
         "cloudK": 288, "capK": 288, "starK": 288}
DEFAULT_SIZE = 200
# 贴纸风只有平涂与一层渐变，128 色调色板足够，体积能砍掉一半以上
QUANT_COLORS = 128

# 背景是模型给的奶油白，取四角均值会更准
WATERMARK_KEY = (255, 0, 255)  # floodfill 的标记色，正常素材不会出现这个色


def estimate_bg(im):
    """取四角 24×24 均值作为背景色，抵消轻微的暖色偏移。"""
    w, h = im.size
    pts = [(0, 0), (w - 24, 0), (0, h - 24), (w - 24, h - 24)]
    r = g = b = n = 0
    px = im.load()
    for ox, oy in pts:
        for x in range(ox, ox + 24, 2):
            for y in range(oy, oy + 24, 2):
                pr, pg, pb = px[x, y][:3]
                r += pr
                g += pg
                b += pb
                n += 1
    return (r // n, g // n, b // n)


def strip_white_ring(rgba):
    """去掉与透明区连通的近白色外圈（模型偶尔会加一圈贴纸白边）。

    做法：把「已透明」与「近白」都标成可删区，从图片角点泛洪，
    连通的那一大片（背景 + 白边）整体删掉；主体内部的白色高光被描边包围，
    不连通，因此保留。
    """
    r, g, b, a = rgba.split()
    white = ImageChops.multiply(
        ImageChops.multiply(r.point(lambda v: 255 if v > 238 else 0),
                            g.point(lambda v: 255 if v > 238 else 0)),
        b.point(lambda v: 255 if v > 238 else 0))
    clear = a.point(lambda v: 255 if v <= 8 else 0)
    combo = ImageChops.lighter(white, clear)
    ImageDraw.floodfill(combo, (0, 0), 128, thresh=0)
    keep = combo.point(lambda v: 0 if v == 128 else 255)
    rgba.putalpha(ImageChops.darker(a, keep))


def cutout(src_path, code):
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    bg = estimate_bg(im)

    # 1) 覆盖右下角生成水印（覆盖色与背景同色，随后一并被吃掉）
    d = ImageDraw.Draw(im)
    d.rectangle([int(w * 0.80), int(h * 0.88), w, h], fill=bg)

    # 2) 从四角灌水，把连续背景标成键色
    for seed in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)]:
        ImageDraw.floodfill(im, seed, WATERMARK_KEY, thresh=42)

    # 3) 键色 → 透明
    rgba = im.convert("RGBA")
    px = rgba.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[0] == WATERMARK_KEY[0] and p[1] == WATERMARK_KEY[1] and p[2] == WATERMARK_KEY[2]:
                px[x, y] = (0, 0, 0, 0)

    # 4) 边缘轻微羽化，避免缩图后出现硬台阶
    alpha = rgba.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    rgba.putalpha(alpha)

    # 4.5) 少数样本会自带一圈「贴纸白边」，和其余素材的深褐描边不一致。
    #      把与透明区连通的近白像素一并吃掉；主体内部的白高光不连通，保留。
    strip_white_ring(rgba)

    # 5) 按不透明区域裁边，四周留 4% 空隙
    box = rgba.getbbox()
    if box:
        rgba = rgba.crop(box)
        side = max(rgba.size)
        pad = int(side * 0.06)
        canvas = Image.new("RGBA", (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
        canvas.paste(rgba, ((canvas.size[0] - rgba.size[0]) // 2,
                            (canvas.size[1] - rgba.size[1]) // 2))
        rgba = canvas

    # 6) 缩放到进包尺寸
    size = SIZES.get(code, DEFAULT_SIZE)
    rgba = rgba.resize((size, size), Image.LANCZOS)

    # 7) 调色板量化：小工具包体敏感，128 色对平涂素材几乎无损
    rgba = rgba.quantize(colors=QUANT_COLORS, method=Image.FASTOCTREE).convert('RGBA')

    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / (code + ".png")
    rgba.save(dst, "PNG", optimize=True)
    return dst, bg


def main():
    want = sys.argv[1:] or None
    files = sorted(SRC.glob("*-v*.png"))
    if not files:
        print("没有找到素材源图")
        return
    for f in files:
        code = f.stem.split("-")[0]
        if want and code not in want:
            continue
        dst, bg = cutout(f, code)
        kb = dst.stat().st_size / 1024
        print(f"{code:8s} bg={bg} -> {dst.relative_to(ROOT)}  {kb:.1f}KB")


if __name__ == "__main__":
    main()
