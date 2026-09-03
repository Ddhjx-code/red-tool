"""后羿射日 素材后处理：rembg 抠图 -> 按碰撞轮廓 bbox 宽高比中心裁切 -> WebP 压缩。

宽高比取自 prototype.html SHAPES 顶点包围盒，保证 drawImage(box.w, box.h) 零拉伸。
trunk/beam 多变体共用一张图，取常用变体的宽高比（木纹纵向拉伸视觉可接受）。
"""
import os
import sys

from PIL import Image
from rembg import remove

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ROOT, "assets", "img", "raw")
OUT = os.path.join(ROOT, "assets", "img")

# name -> (目标宽, 目标高)，宽高比严格对齐碰撞轮廓包围盒
TARGETS = {
    "jinwu": (158, 126),   # bbox 79x63   比 1.254
    "trunk": (52, 232),    # bbox 26x116  比 0.224（取中间变体）
    "beam": (476, 60),     # bbox 230x29  比 7.93（取中间变体）
    "arrow": (208, 37),    # bbox 52x9.2  比 5.65
    "rilun": (104, 104),   # 圆 r=26      比 1.0
    "houyi": (300, 352),   # 绘制固定 150x176 比 0.852
}


def center_crop_aspect(im, tw, th):
    """中心裁切到目标宽高比（不缩放，只裁），避免后续 drawImage 拉伸变形"""
    w, h = im.size
    target = tw / th
    cur = w / h
    if cur > target:
        nw = int(h * target)
        left = (w - nw) // 2
        return im.crop((left, 0, left + nw, h))
    nh = int(w / target)
    top = (h - nh) // 2
    return im.crop((0, top, w, top + nh))


def process(name):
    src = os.path.join(RAW, name + ".png")
    if not os.path.exists(src):
        print("  !! 缺原图 %s" % src)
        return False

    with open(src, "rb") as fh:
        cut = remove(fh.read())
    im = Image.open(__import__("io").BytesIO(cut)).convert("RGBA")

    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    tw, th = TARGETS[name]
    im = center_crop_aspect(im, tw, th)
    im = im.resize((tw, th), Image.LANCZOS)

    dest = os.path.join(OUT, name + ".webp")
    im.save(dest, "WEBP", quality=90, method=6)
    print("  -> %s  %dx%d  %d bytes" % (dest, tw, th, os.path.getsize(dest)))
    return True


def main():
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:] or list(TARGETS)
    ok = 0
    for name in only:
        print("处理 %s ..." % name)
        if process(name):
            ok += 1
    total = sum(os.path.getsize(os.path.join(OUT, n + ".webp"))
                for n in TARGETS if os.path.exists(os.path.join(OUT, n + ".webp")))
    print("\n完成 %d/%d，素材合计 %d bytes" % (ok, len(only), total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
