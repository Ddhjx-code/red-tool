#!/usr/bin/env python3
"""Verify the lion's motion curves actually drive the sprite in 醒狮 (tools/xingshi).

Run: python3 tests/xingshi_motion_smoke.py

The curves in assets/lion-motion.js were lifted from a generated video by pose
estimation. What can silently break here is not the maths but the wiring:

  * if lion-motion.js fails to load, sampleMotion() returns a constant 0 and the
    sprite goes stiff -- so the load-bearing assertion is that mBob VARIES,
    not that it is within some range.
  * if the bob is folded into lion.y instead of physY, the physics step
    (`if (physY >= GROUND)`) stops seeing it and it accumulates into the jump.
    That is checked by jumping and confirming the lion still lands.
"""
import functools
import http.server
import os
import pathlib
import socketserver
import sys
import threading

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL_DIR = pathlib.Path(os.environ["XS_DIR"]).resolve() if os.environ.get("XS_DIR") else ROOT / "tools" / "xingshi"
ENGINE = os.environ.get("XS_ENGINE", "chromium")
PORTRAIT = {"width": 390, "height": 844}
CHECKS = []


def serve_tool():
    """file:// taints the canvas on the first bitmap draw, which kills getImageData
    and the share card; the container loads the package over http, so tests do too."""
    handler = functools.partial(http.server.SimpleHTTPRequestHandler,
                                directory=str(TOOL_DIR))
    handler.log_message = lambda *a, **k: None
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d/index.html" % port


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok   " if cond else "  FAIL ") + name + ((" | " + str(extra)) if extra else ""))


def probe(page):
    return page.evaluate("() => window.__probe")


def sample(page, n, gap=90):
    out = []
    for _ in range(n):
        out.append(probe(page))
        page.wait_for_timeout(gap)
    return out


def spread(rows, key):
    vals = [r.get(key) for r in rows if isinstance(r.get(key), (int, float))]
    return (max(vals) - min(vals)) if len(vals) >= 2 else 0.0


def main():
    httpd, url = serve_tool()
    errors = []
    try:
        with sync_playwright() as pw:
            browser = getattr(pw, ENGINE).launch()

            for vw, vh in ((390, 844), (844, 390), (768, 1024)):
                probe_ctx = browser.new_context(viewport={"width": vw, "height": vh},
                                                device_scale_factor=1)
                probe_pg = probe_ctx.new_page()
                probe_pg.goto(url, wait_until="load")
                probe_pg.wait_for_function("() => window.__ready === true", timeout=15000)
                probe_pg.wait_for_timeout(300)
                r = probe_pg.evaluate(
                    "() => { const b=document.querySelector('canvas').getBoundingClientRect();"
                    " return [Math.round(b.left),Math.round(b.top),"
                    "         Math.round(b.width),Math.round(b.height)]; }")
                fits = (r[0] >= -1 and r[1] >= -1 and
                        r[0] + r[2] <= vw + 1 and r[1] + r[3] <= vh + 1)
                check("responsive: canvas fits %dx%d without clipping" % (vw, vh), fits, r)
                probe_pg.close()
                probe_ctx.close()

            page = browser.new_context(viewport=PORTRAIT, device_scale_factor=3).new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))

            page.goto(url, wait_until="load")
            page.wait_for_function("() => window.__ready === true", timeout=15000)
            # __ready is set in create(); the probe only fills in on the first update().
            page.wait_for_function(
                "() => window.__probe && window.__probe.storyText !== undefined",
                timeout=8000)

            intro = probe(page)
            check("intro: story text visible on load, before any tap",
                  intro.get("storyVisible") is True, intro.get("storyVisible"))
            check("intro: shows STORY[0] and does not skip line 1",
                  "年关将至" in (intro.get("storyText") or ""), repr(intro.get("storyText")))

            check("engine is canvas (file-path textures need it)",
                  probe(page).get("renderer") == "canvas", probe(page).get("renderer"))
            check("motion data loaded from lion-motion.js",
                  page.evaluate("() => !!(window.LION_MOTION && window.LION_MOTION.segments)"))

            for _ in range(10):
                if page.evaluate("() => window.__wh2.phase()") == "play":
                    break
                page.evaluate("() => window.__wh2.tap()")
                page.wait_for_timeout(120)
            check("reached play phase", page.evaluate("() => window.__wh2.phase()") == "play")

            idle = sample(page, 16)
            check("idle: segment is 'idle'", all(r.get("mseg") == "idle" for r in idle),
                  sorted({r.get("mseg") for r in idle}))
            check("idle: bob curve VARIES (proves data loaded)", spread(idle, "mBob") > 1e-4,
                  "spread=%.6f" % spread(idle, "mBob"))
            check("idle: lean curve VARIES", spread(idle, "mLean") > 1e-3,
                  "spread=%.5f" % spread(idle, "mLean"))

            page.keyboard.down("ArrowRight")
            walk = sample(page, 16)
            page.keyboard.up("ArrowRight")
            check("walk: segment is 'walk'", any(r.get("mseg") == "walk" for r in walk),
                  sorted({r.get("mseg") for r in walk}))
            walk_rows = [r for r in walk if r.get("mseg") == "walk"]
            check("walk: bob curve VARIES", spread(walk_rows, "mBob") > 1e-4,
                  "spread=%.6f" % spread(walk_rows, "mBob"))
            ys = []
            for _ in range(14):
                ys.append(probe(page).get("lion", [0, 0])[1])
                page.wait_for_timeout(80)
            check("walk: lion.y moves over time", (max(ys) - min(ys)) >= 2,
                  "y range=%d" % (max(ys) - min(ys)))
            page.screenshot(path="/tmp/pose/lion_walk_shot.png")

            page.keyboard.press("Space")
            atk = sample(page, 8, 60)
            check("attack: segment becomes 'pounce'",
                  any(r.get("mseg") == "pounce" for r in atk),
                  sorted({r.get("mseg") for r in atk}))

            before = probe(page).get("frames", 0)
            page.wait_for_timeout(400)
            check("render loop still running", probe(page).get("frames", 0) > before)

            page.keyboard.up("ArrowRight")
            page.wait_for_timeout(500)
            rest_y = probe(page)["lion"][1]
            page.keyboard.press("ArrowUp")
            air = []
            for _ in range(14):
                air.append(probe(page)["lion"][1])
                page.wait_for_timeout(60)
            page.wait_for_timeout(700)
            landed_y = probe(page)["lion"][1]
            check("jump: lion leaves the ground", min(air) < rest_y - 20,
                  "rest=%d min=%d" % (rest_y, min(air)))
            check("jump: lion lands back on physY (bob did not accumulate)",
                  abs(landed_y - rest_y) <= 8, "rest=%d landed=%d" % (rest_y, landed_y))
            check("no pageerror after jump", not errors, errors[:2])

            check("no pageerror", not errors, errors[:2])
            page.screenshot(path="/tmp/pose/lion_idle_shot.png")

            touch = check_touch(page, errors)
            check("touch: hold [◀] moves the lion left", touch["left"], touch)
            check("touch: hold [▶] moves the lion right", touch["right"], touch)
            check("touch: hold [▲] makes the lion jump", touch["jump"], touch)
            check("touch: tapping empty space still attacks", touch["attack"], touch)

            grounded = check_grounded(page)
            check("hit knockback must not launch the player (ground line)",
                  grounded["settled"], grounded)
            check("a single fast tap on [▲] produces a full jump",
                  grounded["singleTapJump"], grounded)
            browser.close()
    finally:
        httpd.shutdown()

    failed = [n for n, ok in CHECKS if not ok]
    print("\n%s: %d/%d passed" % ("FAILED" if failed else "PASSED",
                                  len(CHECKS) - len(failed), len(CHECKS)))
    return 1 if failed else 0


def check_grounded(page):
    page.wait_for_timeout(1600)
    st = page.evaluate("() => ({onG: window.__probe.onGround, physY: window.__probe.physY,"
                       " G: window.__probe.ground, y: window.__probe.lion[1]})")
    settled = bool(st["onG"]) and abs(st["physY"] - st["G"]) <= 1
    rect = page.evaluate("() => { const r=document.querySelector('canvas').getBoundingClientRect();"
                         " return {l:r.left, t:r.top, w:r.width}; }")
    sc = rect["w"] / 414.0
    jx, jy = rect["l"] + 352 * sc, rect["t"] + 676 * sc
    y0 = st["y"]
    page.mouse.click(jx, jy)
    air = []
    for _ in range(10):
        air.append(page.evaluate("() => window.__probe.lion[1]"))
        page.wait_for_timeout(45)
    return {"settled": settled, "singleTapJump": min(air) < y0 - 40,
            "state": st, "y": [y0, min(air)]}


def check_touch(page, errors):
    page.wait_for_timeout(900)
    rect = page.evaluate("() => { const c=document.querySelector('canvas');"
                         " const r=c.getBoundingClientRect();"
                         " return {l:r.left, t:r.top, w:r.width}; }")
    sc = rect["w"] / 414.0

    def pt(gx, gy):
        return rect["l"] + gx * sc, rect["t"] + gy * sc

    def lion():
        return page.evaluate("() => window.__probe.lion")

    lx, ly = pt(60, 676)
    rx, ry = pt(150, 676)
    jx, jy = pt(352, 676)

    x0 = lion()[0]
    page.mouse.move(lx, ly)
    page.mouse.down()
    page.wait_for_timeout(600)
    page.mouse.up()
    x1 = lion()[0]

    page.mouse.move(rx, ry)
    page.mouse.down()
    page.wait_for_timeout(600)
    page.mouse.up()
    x2 = lion()[0]

    y0 = lion()[1]
    page.mouse.move(jx, jy)
    page.mouse.down()
    page.wait_for_timeout(120)
    airborne = []
    for _ in range(6):
        airborne.append(lion()[1])
        page.wait_for_timeout(40)
    page.mouse.up()

    a0 = page.evaluate("() => window.__probe.attacks || 0")
    cx, cy = pt(207, 400)
    page.mouse.click(cx, cy)
    page.wait_for_timeout(200)
    a1 = page.evaluate("() => window.__probe.attacks || 0")

    return {"left": x1 < x0, "right": x2 > x1, "jump": min(airborne) < y0 - 15,
            "attack": a1 > a0, "rect": rect, "x": [x0, x1, x2], "y": [y0, min(airborne)]}


if __name__ == "__main__":
    sys.exit(main())
