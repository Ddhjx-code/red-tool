"""Capture 月下灯会 release images: 2x screenshots cropped to the series' 3:4 spec.

release/README.md requires "images/ 发布配图（3:4 竖屏高清截取）", so this does NOT
reuse tools/yuedeng/screenshots/*.png (those are 390x844 at 1x, neither 3:4 nor hi-res).

Each shot is captured at deviceScaleFactor=2 (780x1688), cropped to 780x1040 (3:4) with a
per-shot Y offset chosen to keep the informative band, then LANCZOS-scaled to 1080x1440.

Usage:
    python tests/make_yuedeng_release_images.py
"""

import json
import shutil
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "yuedeng" / "index.html"
OUT = ROOT / "release" / "yuedeng" / "images"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]


def crop34(src, dst, y0):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    ch = int(w * 4 / 3)
    y0 = max(0, min(y0, h - ch))
    im = im.crop((0, y0, w, y0 + ch)).resize((1080, 1440), Image.LANCZOS)
    im.save(dst)
    print("  ->", dst.name, im.size)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = OUT / "_raw"
    tmp.mkdir(exist_ok=True)
    shots = []          # (raw 文件名, 输出名, 裁切起始 y)

    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.goto(TOOL.as_uri())
        pg.wait_for_function("window.__ready === true", timeout=20000)

        def take(stem, out_name, y0):
            pg.screenshot(path=str(tmp / stem))
            shots.append((stem, out_name, y0))

        pg.wait_for_timeout(300)
        take("home.png", "01-首页.png", 0)

        pg.click("#btn-start")
        pg.wait_for_selector("#view-create.is-active")
        pg.wait_for_timeout(500)
        take("create.png", "02-创作台未点亮.png", 96)

        # 绘纹：晕染打底 + 勾线 + 落纹样（兔），再换莲花灯
        pg.evaluate("window.__game.setBrush('wash')")
        pg.evaluate("window.__game.setColor(1)")
        pg.evaluate("window.__game.paintDrag(%s)" % json.dumps(
            [[0.40, 0.34], [0.45, 0.33], [0.50, 0.35], [0.55, 0.33], [0.60, 0.35]]))
        pg.wait_for_timeout(500)
        pg.evaluate("window.__game.setBrush('line')")
        pg.evaluate("window.__game.setColor(2)")
        pg.evaluate("window.__game.paintDrag(%s)" % json.dumps(
            [[0.40, 0.44], [0.46, 0.46], [0.52, 0.44], [0.58, 0.46]]))
        pg.wait_for_timeout(400)
        pg.evaluate("window.YDEngine.splatMotif('tu', {r:0.86, g:0.24, b:0.19})")
        pg.wait_for_timeout(700)
        pg.evaluate("window.__game.setShape(3)")
        pg.wait_for_timeout(1100)

        pg.evaluate("window.__game.setLit(true)")
        pg.wait_for_function("window.YDEngine.state().litLevel > 0.99", timeout=10000)
        pg.wait_for_timeout(1500)
        take("lit.png", "03-创作台已点亮.png", 96)

        # 五种纹样（各拍一张，最后拼成一张图）
        for mid in ("moon", "gui", "tu", "yun", "huaniao"):
            pg.evaluate("window.__game.resetCanvas()")
            pg.wait_for_timeout(700)
            pg.evaluate("window.YDEngine.splatMotif('%s', {r:0.86, g:0.24, b:0.19})" % mid)
            pg.wait_for_timeout(1100)
            pg.screenshot(path=str(tmp / ("motif_%s.png" % mid)))

        # 放灯 → 结局四拍（不跳过）
        pg.click("#btn-release")
        pg.wait_for_timeout(1200)
        take("fin_B1.png", "05-结局点烛.png", 210)
        pg.wait_for_timeout(3500)
        take("fin_B2.png", "06-结局高树于檐.png", 210)
        pg.wait_for_timeout(3500)
        take("fin_B3.png", "07-结局满城灯火.png", 210)
        pg.wait_for_timeout(3500)
        take("fin_B4.png", "08-结局与月争辉.png", 210)

        pg.wait_for_selector("#view-result.is-active", timeout=12000)
        pg.wait_for_timeout(900)
        take("result.png", "09-成品页.png", 260)

        b.close()

    print("裁切 3:4 → 1080x1440")
    for stem, name, y0 in shots:
        crop34(tmp / stem, OUT / name, y0)

    # 纹样拼图：五枚放进 3:4 画布（2 列 × 3 行，留一格空）。
    # 发布规格要求 3:4 —— 横条（首版做成了 1080x281）不符合。
    tiles = []
    for mid in ("moon", "gui", "tu", "yun", "huaniao"):
        im = Image.open(tmp / ("motif_%s.png" % mid)).convert("RGB")
        w, h = im.size
        s = int(w * 0.62)                       # 裁灯面附近的方区
        x0 = (w - s) // 2
        y0 = max(0, min(int(h * 0.16), h - s))
        tiles.append(im.crop((x0, y0, x0 + s, y0 + s)))
    cell = 460
    sheet = Image.new("RGB", (1080, 1440), (10, 16, 36))
    gap = 32
    x0 = (1080 - (cell * 2 + gap)) // 2
    y0 = (1440 - (cell * 3 + gap * 2)) // 2
    for i, t in enumerate(tiles):
        c, r = i % 2, i // 2
        sheet.paste(t.resize((cell, cell), Image.LANCZOS),
                    (x0 + c * (cell + gap), y0 + r * (cell + gap)))
    sheet.save(OUT / "04-五种纹样.png")
    print("  -> 04-五种纹样.png", sheet.size)

    shutil.rmtree(tmp)
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
