# -*- coding: utf-8 -*-
"""把文生图素材处理成小工具可用的位图资源。

- 场景：裁 9:16、去水印、统一尺寸、压 WebP
- 货物 / 人物：洋红底 chroma key -> 去粉边 -> 投影找空白分割 -> 单体输出
- 结算卡：patch 覆盖水印、压 WebP
"""
import os
from PIL import Image, ImageFilter

SRC = '/Users/wang/AI/workspace/red-tool/tools/stall/art-src'
OUT = '/Users/wang/AI/workspace/red-tool/tools/stall/assets/img'
os.makedirs(OUT, exist_ok=True)


def load(name):
    cands = [f for f in os.listdir(SRC) if f.startswith(name) and f.endswith('.png')]
    if not cands:
        raise SystemExit('missing source: ' + name)
    cands.sort(key=lambda f: os.path.getmtime(os.path.join(SRC, f)))
    return Image.open(os.path.join(SRC, cands[-1])).convert('RGB')


def chroma_key(im, tol=58):
    """从四边 BFS：洋红底 + 紧贴背景的白边一起吃掉，遇到描边就停。"""
    from collections import deque
    im = im.convert('RGB')
    w, h = im.size
    px = im.load()
    bg = im.getpixel((3, 3))
    isbg = bytearray(w * h)

    def ok(x, y):
        r, g, b = px[x, y]
        d = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
        return d < tol * 1.7

    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if ok(x, y) and not isbg[y * w + x]:
                isbg[y * w + x] = 1
                dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if ok(x, y) and not isbg[y * w + x]:
                isbg[y * w + x] = 1
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            xx, yy = x + dx, y + dy
            if 0 <= xx < w and 0 <= yy < h:
                i = yy * w + xx
                if not isbg[i] and ok(xx, yy):
                    isbg[i] = 1
                    dq.append((xx, yy))

    alpha = Image.new('L', (w, h), 255)
    ap = alpha.load()
    for y in range(h):
        row = y * w
        for x in range(w):
            if isbg[row + x]:
                ap[x, y] = 0
    rgba = im.convert('RGBA')
    rgba.putalpha(alpha.filter(ImageFilter.GaussianBlur(0.5)))
    return rgba


def trim(im, min_count=3):
    """按像素计数裁到主体，滤掉孤立碎点和细线。"""
    a = im.split()[3]
    w, h = a.size
    ap = a.load()
    cols = [sum(1 for y in range(h) if ap[x, y] > 60) for x in range(w)]
    rows = [sum(1 for x in range(w) if ap[x, y] > 60) for y in range(h)]
    xs = [i for i, c in enumerate(cols) if c >= min_count]
    ys = [i for i, c in enumerate(rows) if c >= min_count]
    if not xs or not ys:
        return im
    x0, x1 = max(0, xs[0] - 1), min(w, xs[-1] + 2)
    y0, y1 = max(0, ys[0] - 1), min(h, ys[-1] + 2)
    # 再按 alpha 精修一次边缘
    sub = im.crop((x0, y0, x1, y1))
    bb = sub.split()[3].getbbox()
    return sub.crop(bb) if bb else sub


def profile(im, axis, min_count=4):
    """逐列/逐行的不透明像素计数，超过阈值才算有内容（滤掉零星噪点）。"""
    a = im.split()[3].filter(ImageFilter.MinFilter(3))
    w, h = a.size
    ap = a.load()
    if axis == 'col':
        out = []
        for x in range(w):
            c = 0
            for y in range(h):
                if ap[x, y] > 40:
                    c += 1
                    if c > min_count:
                        break
            out.append(c > min_count)
        return out
    out = []
    for y in range(h):
        c = 0
        for x in range(w):
            if ap[x, y] > 40:
                c += 1
                if c > min_count:
                    break
        out.append(c > min_count)
    return out


def blocks(prof, min_gap=14):
    res, start, cur = [], None, 0
    for i, v in enumerate(prof):
        if not v:
            if start is None:
                start = i
        else:
            if start is not None:
                if i - start >= min_gap and start - cur > 2:
                    res.append((cur, start))
                    cur = i
                start = None
    res.append((cur, len(prof)))
    return res


def density(im, axis):
    """每列/行的不透明像素数量。"""
    a = im.split()[3].filter(ImageFilter.MinFilter(3))
    w, h = a.size
    ap = a.load()
    if axis == 'col':
        return [sum(1 for y in range(h) if ap[x, y] > 40) for x in range(w)]
    return [sum(1 for x in range(w) if ap[x, y] > 40) for y in range(h)]


def cut_by_valley(im, n, axis='col', window=0.10):
    """在理论等分线附近找密度最低的一列/一行作为分割线。"""
    d = density(im, axis)
    L = len(d)
    cuts = [0]
    for k in range(1, n):
        t = L * k / float(n)
        lo = max(1, int(t - L * window))
        hi = min(L - 2, int(t + L * window))
        best = min(range(lo, hi + 1), key=lambda x: d[x])
        cuts.append(best)
    cuts.append(L)
    return [(cuts[i], cuts[i + 1]) for i in range(n)]


def save_one(img, name, cell, height=None, pivot='bottom', quality=92):
    t = img
    if height:
        k = float(height) / t.size[1]
        t = t.resize((max(1, int(t.size[0] * k)), height), Image.LANCZOS)
    k = min(float(cell[0]) / t.size[0], float(cell[1]) / t.size[1], 1.0)
    if k < 1:
        t = t.resize((max(1, int(t.size[0] * k)), max(1, int(t.size[1] * k))), Image.LANCZOS)
    canvas = Image.new('RGBA', cell, (0, 0, 0, 0))
    x = (cell[0] - t.size[0]) // 2
    y = cell[1] - t.size[1] - 2 if pivot == 'bottom' else (cell[1] - t.size[1]) // 2
    canvas.paste(t, (x, y), t)
    p = os.path.join(OUT, name + '.webp')
    canvas.save(p, 'WEBP', quality=quality, method=6)
    return os.path.getsize(p) // 1024


def scene(name, out, box, size, quality=84):
    im = load(name).crop(box).resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, out), 'WEBP', quality=quality, method=6)
    print('scene', out, os.path.getsize(os.path.join(OUT, out)) // 1024, 'KB')


GOODS = ['fan', 'haw', 'sachet', 'clay', 'sugar',
         'bowl', 'lantern', 'tea', 'kite', 'jade']
GUESTS = ['woman', 'scholar', 'child', 'elder', 'rich']

# ---------------- 场景 ----------------
SCENE_BOX = (80, 0, 944, 1494)
SCENE_SIZE = (828, 1472)
scene('Chinese_folk', 'scene-day.webp', SCENE_BOX, SCENE_SIZE)
scene('Same_exact_composition_and_sam', 'scene-dusk.webp', SCENE_BOX, SCENE_SIZE)
scene('Same_exact_composition__same_p', 'scene-night.webp', SCENE_BOX, SCENE_SIZE)

# ---------------- 货物 ----------------
g = load('A_neat_2_row_by_5_column_grid')
g.putalpha(255)
gk = chroma_key(g)
gk.paste((0, 0, 0, 0), (1230, 860, 1536, 1024))   # 抹掉右下水印
items = []
for (x0, x1) in cut_by_valley(gk, 5, 'col'):
    col = gk.crop((x0, 0, x1, gk.size[1]))
    sub = [b for b in blocks(profile(col, 'row'), 8) if b[1] - b[0] > 60]
    for (y0, y1) in sub:
        items.append(trim(col.crop((0, y0, col.size[0], y1))))
print('goods count', len(items), [i.size for i in items])
kb = [save_one(it, 'g-' + GOODS[i], (168, 168), pivot='center')
      for i, it in enumerate(items[:10])]
print('goods KB', sum(kb))

# ---------------- 人物 ----------------
h = load('Five_separate_full_body_ancien')
h.putalpha(255)
hk = chroma_key(h)
hk.paste((0, 0, 0, 0), (1180, 860, 1536, 1024))
cols = cut_by_valley(hk, 5, 'col')
print('guest cols', cols)
people = [trim(hk.crop((x0, 0, x1, hk.size[1]))) for (x0, x1) in cols]
print('guest count', len(people), [p.size for p in people])
HEIGHTS = [318, 350, 224, 292, 330]
hs = [save_one(p, 'p-' + GUESTS[i], (230, 370), height=HEIGHTS[i])
      for i, p in enumerate(people[:5])]
print('guests KB', sum(hs))

# ---------------- 结算卡 ----------------
card = load('An_aged_Chinese_rice_paper_car')
card.paste(card.crop((600, 935, 784, 1010)), (840, 935, 1024, 1010))
card.resize((720, 1080), Image.LANCZOS).save(os.path.join(OUT, 'card.webp'), 'WEBP', quality=86, method=6)
print('card', os.path.getsize(os.path.join(OUT, 'card.webp')) // 1024, 'KB')

for f in ('goods.webp', 'guests.webp'):
    p = os.path.join(OUT, f)
    if os.path.exists(p):
        os.remove(p)

total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print('TOTAL', total // 1024, 'KB', len(os.listdir(OUT)), 'files')
