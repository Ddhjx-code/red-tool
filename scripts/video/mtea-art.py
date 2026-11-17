"""奶茶店老板 —— 图标与封面（纯 Pillow 绘制，不开浏览器）"""
import math
from PIL import Image, ImageDraw, ImageFont

BG = (246, 243, 238)
GRID = (237, 231, 220)
INK = (35, 32, 28)
GREY = (140, 131, 120)
LINE = (230, 223, 210)

FONT = "/System/Library/Fonts/Hiragino Sans GB.ttc"
def f(size, idx=0):
    return ImageFont.truetype(FONT, size, index=idx)

def fb(size):
    return ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size)

def rounded(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

def paper(img, step=36, color=GRID):
    d = ImageDraw.Draw(img)
    w, h = img.size
    for x in range(0, w, step):
        d.line([(x, 0), (x, h)], fill=color, width=1)
    for y in range(0, h, step):
        d.line([(0, y), (w, y)], fill=color, width=1)

def cup_mask(size, box):
    """杯子形状遮罩：梯形杯身 + 圆底。"""
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    x0, y0, x1, y1 = box
    d.polygon([(x0, y0), (x1, y0), (x1 - (x1 - x0) * 0.14, y1), (x0 + (x1 - x0) * 0.14, y1)], fill=255)
    d.ellipse([x0 + (x1 - x0) * 0.14 - 2, y1 - 18, x1 - (x1 - x0) * 0.14 + 2, y1 + 14], fill=255)
    return m


def draw_cup(img, box, bars=True, scale=1.0):
    """在 img 上画一只杯子，杯内是四行配料条。"""
    x0, y0, x1, y1 = box
    w = x1 - x0
    mask = cup_mask(img.size, box)
    body = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    bd.rectangle([0, 0, img.size[0], img.size[1]], fill=(255, 253, 249, 255))

    if bars:
        colors = [(200, 159, 110), (127, 168, 201), (217, 162, 74), (124, 106, 88)]
        n = 4
        top = y0 + (y1 - y0) * 0.18
        gap = (y1 - y0) * 0.16
        for i in range(n):
            by = top + i * gap
            bw = w * (0.62 - i * 0.07)
            bd.rounded_rectangle([x0 + w * 0.19, by, x0 + w * 0.19 + bw, by + gap * 0.42],
                                 radius=gap * 0.21, fill=colors[i] + (255,))

    filled = Image.composite(body, Image.new("RGBA", img.size, (0, 0, 0, 0)), mask)
    img.alpha_composite(filled)

    d = ImageDraw.Draw(img)
    # 杯身描边
    d.line([(x0, y0), (x1, y0)], fill=INK, width=int(7 * scale))
    d.line([(x0, y0), (x0 + w * 0.14, y1)], fill=INK, width=int(7 * scale))
    d.line([(x1, y0), (x1 - w * 0.14, y1)], fill=INK, width=int(7 * scale))
    d.arc([x0 + w * 0.14 - 3, y1 - 20, x1 - w * 0.14 + 3, y1 + 12], 0, 180,
          fill=INK, width=int(7 * scale))
    # 杯盖与吸管
    d.rounded_rectangle([x0 - w * 0.04, y0 - 12 * scale, x1 + w * 0.04, y0 + 6 * scale],
                        radius=9 * scale, fill=INK)
    d.line([(x0 + w * 0.62, y0 - 10 * scale), (x0 + w * 0.52, y0 - 60 * scale)],
           fill=INK, width=int(9 * scale))


def icon(path, size=512):
    img = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    rounded(d, [0, 0, size - 1, size - 1], int(size * 0.22), fill=BG)

    inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    paper(inner, step=int(size * 0.09))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.alpha_composite(Image.composite(inner, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask))

    draw_cup(img, (size * 0.30, size * 0.34, size * 0.70, size * 0.80), bars=True, scale=1.6)
    img.convert("RGB").save(path, quality=95)


def cover(path):
    W, H = 1080, 1440
    img = Image.new("RGBA", (W, H), BG + (255,))
    paper(img, step=54)
    d = ImageDraw.Draw(img)

    d.text((86, 96), "M A T R I X   ·   小 工 具", font=f(26), fill=GREY)
    d.text((84, 158), "奶茶店老板", font=f(96), fill=INK)
    d.text((86, 300), "一单改一行，不用改八条公式", font=f(38), fill=(90, 84, 76))
    d.line([(86, 386), (W - 86, 386)], fill=LINE, width=2)

    # 左：表格
    lx, ly, lw, lh = 86, 440, 400, 360
    rounded(d, [lx, ly, lx + lw, ly + lh], 28, fill=(255, 253, 249), outline=LINE, width=2)
    d.text((lx + 28, ly + 24), "表格", font=f(30), fill=GREY)
    rows = [("茶", 200), ("奶", 100), ("糖", 20), ("珍珠", 50)]
    for i, (k, v) in enumerate(rows):
        ry = ly + 92 + i * 64
        d.text((lx + 28, ry), k, font=f(26), fill=(162, 152, 137))
        d.rounded_rectangle([lx + 96, ry + 12, lx + 250, ry + 24], radius=6, fill=(237, 231, 218))
        d.text((lx + 272, ry - 6), str(v), font=f(30), fill=INK)

    # 右：矩阵
    rx, ry0, rw, rh = 594, 440, 400, 360
    rounded(d, [rx, ry0, rx + rw, ry0 + rh], 28, fill=(244, 250, 246), outline=(206, 229, 216), width=2)
    d.text((rx + 28, ry0 + 24), "矩阵", font=f(30), fill=(78, 158, 117))
    d.text((rx + 28, ry0 + 92), "b = X · w", font=f(44), fill=INK)
    d.text((rx + 28, ry0 + 176), "改一行，四种料一起算", font=f(26), fill=(120, 140, 128))
    for i in range(4):
        d.rounded_rectangle([rx + 28, ry0 + 246 + i * 24, rx + 28 + (300 - i * 46), ry0 + 262 + i * 24],
                            radius=8, fill=[(200, 159, 110), (127, 168, 201), (217, 162, 74), (124, 106, 88)][i])

    d.line([(86, 872), (W - 86, 872)], fill=LINE, width=2)

    d.text((86, 916), "同一堆数字，", font=f(72), fill=INK)
    d.text((86, 1016), "表格只能翻，", font=f(72), fill=INK)
    d.text((86, 1116), "矩阵能算", font=f(72), fill=(78, 158, 117))

    # 底部：三关说明
    d.text((88, 1266), "备货 · 揪假新品 · 反推配方", font=f(32), fill=GREY)
    d.text((88, 1318), "三关小游戏，自己拖一遍就懂了", font=f(30), fill=(170, 160, 145))

    badge = "数学 · 小游戏"
    bw = d.textlength(badge, font=f(30)) + 56
    rounded(d, [W - 86 - bw, H - 140, W - 86, H - 74], 33, fill=INK)
    d.text((W - 86 - bw + 28, H - 124), badge, font=f(30), fill=(255, 253, 249))

    img.convert("RGB").save(path, quality=95)


if __name__ == "__main__":
    icon("/Users/wang/WorkBuddy/2026-11-10-12-43-25/docs/xhs-record/mtea-icon.png")
    cover("/Users/wang/WorkBuddy/2026-11-10-12-43-25/docs/xhs-record/mtea-cover.png")
    print("ok")
