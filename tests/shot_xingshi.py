"""Render one 醒狮 (tools/xingshi) frame and hand the PNG to Qwen.

Same shape as tests/shot.py: serve the tool over http (file:// taints the canvas),
drive it through the window.__wh2 hooks the game already exposes, clip the shot to
the letterboxed canvas, then optionally ask the vision model about it.

Usage:
    python3 tests/shot_xingshi.py --out boss0 --gate 0 --boss --wait 1500
    python3 tests/shot_xingshi.py --out ult --gate 1 --charge --js "window.__wh2.ult()"
    python3 tests/shot_xingshi.py --out parry --js "window.__wh2.parry()" --wait 90
    python3 tests/shot_xingshi.py --out early --ask "怪物是面朝舞狮还是背对舞狮？"
"""
import argparse
import functools
import http.server
import os
import pathlib
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "xingshi"
OUT = ROOT / "docs" / "research" / "xingshi-drafts" / "shots"

SPAWN = {"walk": "window.__wh2.spawnElite()", "fly": "window.__wh2.spawnFly()",
         "ranged": "window.__wh2.spawnRanged()", "shield": "window.__wh2.spawnShield()",
         "elite": "window.__wh2.spawnElite()"}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default="shot")
    ap.add_argument("--gate", type=int, default=0)
    ap.add_argument("--boss", action="store_true", help="spawn this gate's boss")
    ap.add_argument("--foes", default="", help="comma list: walk,fly,ranged,shield,elite")
    ap.add_argument("--charge", action="store_true", help="fill the ult meter")
    ap.add_argument("--js", default="", help="extra JS run right before the shot")
    ap.add_argument("--wait", type=int, default=1200, help="ms to advance after setup")
    ap.add_argument("--ask", default="", help="question for qwen3.8-max about the shot")
    ap.add_argument("--no-shot", action="store_true", help="do not write the PNG")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / ("%s.png" % args.out)

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    handler = functools.partial(Quiet, directory=str(TOOL))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    errors = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_context(viewport={"width": 390, "height": 844},
                                       device_scale_factor=2).new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto("http://127.0.0.1:%d/index.html" % port, wait_until="load")
            page.wait_for_function("() => window.__ready === true", timeout=20000)
            page.wait_for_timeout(400)

            # Clear the story, then jump to the requested deck.
            page.evaluate("""() => {
                for (var i = 0; i < 12 && window.__wh2.phase() !== 'play'; i++) {
                    window.__wh2.tap();
                }
            }""")
            page.wait_for_timeout(200)
            page.evaluate("(g) => window.__wh2.gotoGate(g)", args.gate)
            page.wait_for_timeout(300)

            if args.boss:
                page.evaluate("() => window.__wh2.spawnBoss()")
            for name in [s.strip() for s in args.foes.split(",") if s.strip()]:
                if name in SPAWN:
                    page.evaluate("() => " + SPAWN[name])
            if args.charge:
                page.evaluate("() => window.__wh2.setCharge(100)")
            if args.js:
                page.evaluate("() => " + args.js)

            page.wait_for_timeout(args.wait)

            rect = page.evaluate("""() => {
                const r = document.querySelector('canvas').getBoundingClientRect();
                return {x: r.left, y: r.top, width: r.width, height: r.height};
            }""")
            state = page.evaluate("() => window.__wh2.state()")
            if not args.no_shot:
                page.screenshot(path=str(dest), clip=rect)
            browser.close()
    finally:
        httpd.shutdown()

    print("state:", state)
    if errors:
        print("PAGE ERRORS:", errors[:3])
    if not args.no_shot:
        print("shot:", dest)
    if args.ask:
        sys.path.insert(0, str(ROOT / "tests"))
        import vision_ask
        env = vision_ask.load_env()
        ans, _ = vision_ask.ask(env, "qwen3.8-max", args.ask, [str(dest)])
        print("\nQWEN:", ans.strip())
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
