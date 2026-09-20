"""Capture 醒狮 release images: 2x screenshots cropped to the series' 3:4 spec.

release/README.md requires "images/ 发布配图（3:4 竖屏高清截取）", so this does not reuse
the QC shots under docs/research/xingshi-drafts/shots/ (those are full-page, not 3:4).

Shot at deviceScaleFactor=2 (780x1688), cropped to a 780x1040 band with a per-shot Y offset
chosen to keep the informative band, then LANCZOS-scaled to 1080x1440. The offset matters:
the boss's HP bar sits near the top while the fight sits on the ground line, so the two
boss shots crop high and everything else crops to the action.

Usage:
    python tests/make_xingshi_release_images.py
"""

import shutil
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "xingshi" / "index.html"
OUT = ROOT / "release" / "xingshi" / "images"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

ACTION = 648      # band that holds the ground line, the fighters and the touch buttons
HIGH = 270        # band that also holds the boss HP bar + stage readout
PANEL = 300       # result panel
CARD = 380        # share card


def crop34(src, dst, y0):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    ch = int(w * 4 / 3)
    y0 = max(0, min(y0, h - ch))
    im.crop((0, y0, w, y0 + ch)).resize((1080, 1440), Image.LANCZOS).save(dst)
    print("  ->", dst.name, "1080x1440")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = OUT / "_raw"
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    shots = []

    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(TOOL.as_uri())
        pg.wait_for_function("window.__ready === true", timeout=20000)
        pg.wait_for_timeout(700)

        def take(stem, out_name, y0):
            pg.screenshot(path=str(tmp / stem))
            shots.append((stem, out_name, y0))

        def play():
            pg.evaluate("() => { for (let i = 0; i < 12 && window.__wh2.phase() !== 'play'; i++) window.__wh2.tap(); }")
            pg.wait_for_timeout(250)

        take("story.png", "01-剧情开场.png", ACTION)

        play()
        # The onboarding strip fades at 1.5s + 0.7s; wait it out so no release shot has
        # it sitting over the fight.
        pg.wait_for_timeout(2500)
        take("gate0.png", "02-村口开打.png", ACTION)

        pg.evaluate("() => window.__wh2.parry()")
        pg.wait_for_timeout(90)                       # inside the 0.20s window
        take("parry.png", "03-弹反窗口.png", ACTION)

        pg.wait_for_timeout(700)
        pg.evaluate("() => window.__wh2.skill1()")    # 扫堂 AoE
        pg.wait_for_timeout(130)
        take("sweep.png", "04-扫堂横扫.png", ACTION)

        pg.wait_for_timeout(900)
        pg.evaluate("() => window.__wh2.spawnFly()")
        pg.wait_for_timeout(600)
        pg.evaluate("() => window.__wh2.skill2()")    # 冲天挑空
        pg.wait_for_timeout(150)
        take("launch.png", "05-冲天挑空.png", ACTION)

        pg.wait_for_timeout(1100)
        pg.evaluate("() => window.__wh2.setCharge(100)")
        pg.evaluate("() => window.__wh2.ult()")       # 采青必杀
        pg.wait_for_timeout(170)
        take("ult.png", "06-采青必杀.png", ACTION)

        pg.wait_for_timeout(1200)
        pg.evaluate("() => window.__wh2.gotoGate(0)")
        pg.evaluate("() => window.__wh2.spawnBoss()")
        pg.wait_for_timeout(2300)
        take("boss0.png", "07-门神Boss.png", HIGH)

        pg.evaluate("() => window.__wh2.gotoGate(2)")
        pg.evaluate("() => window.__wh2.spawnBoss()")
        pg.wait_for_timeout(2300)
        take("boss2.png", "08-狮王Boss.png", HIGH)

        # Play a real run before ending. Finishing straight away yields a
        # "采青1 / 击倒2 / 34分" panel, and `five gates cleared` next to "门神 0" is
        # self-contradictory -- both read as a broken build on a release asset.
        for gate in range(5):
            pg.evaluate("(g) => window.__wh2.gotoGate(g)", gate)
            pg.evaluate("() => window.__wh2.spawnBoss()")
            pg.evaluate("() => { window.__wh2.spawnFly(); window.__wh2.spawnRanged(); }")
            pg.wait_for_timeout(700)
            for _ in range(9):
                pg.evaluate("() => { window.__wh2.setCharge(100); window.__wh2.ult(); }")
                pg.wait_for_timeout(820)
            # A parry is real work: it needs a foe touching during the 0.20s window.
            for _ in range(6):
                pg.evaluate("() => window.__wh2.parry()")
                pg.wait_for_timeout(420)
            for _ in range(4):
                pg.evaluate("() => window.__wh2.tap()")
                pg.wait_for_timeout(260)
        pg.wait_for_timeout(600)

        pg.evaluate("() => window.__wh2.finish()")
        pg.wait_for_timeout(1400)
        take("result.png", "09-通关结算.png", PANEL)

        pg.evaluate("() => window.__wh2.tap()")       # end phase -> build the share card
        pg.wait_for_timeout(2200)
        take("card.png", "10-分享卡.png", CARD)

        b.close()

    for stem, name, y0 in shots:
        crop34(tmp / stem, OUT / name, y0)
    shutil.rmtree(tmp)
    if errors:
        print("PAGE ERRORS:", errors[:3])
        return 1
    print("done ->", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
