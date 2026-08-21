#!/usr/bin/env python3
"""Task 14: capture release images for 龙舟破浪 into release/longzhou/images/.

- 01-home.png   home screen (clean save)
- 02-play.png   mid-run normal play via ?demo=1 (obstacle ahead, no dash)
- 03-dash.png   mid-dash via ?demo=1 (dashT in mid window -> trail + vignette)
- 04-codex.png  codex fully unlocked (unlockAll via __game hooks)
- 05-result.png result screen with real stats (demo run, then forceHit x3)
- 06-card.png   LZShare.paintCard(lastStats) dataURL rendered at 900x1200

Viewport 630x840 (3:4) with device_scale_factor=2 for 01-05.
Run: python3 .sdd/task14-capture.py
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
GAME = (ROOT / "tools" / "longzhou" / "index.html").as_uri()
OUT = ROOT / "release" / "longzhou" / "images"

PLAY_OK = """
(function () {
  var S = window.LZGame.snapshot();
  if (S.state !== "playing" || S.dashT > 0 || S.invT > 0) return false;
  if (S.dist < 80 || S.scoreFrac < 100) return false;
  for (var i = 0; i < S.entities.length; i++) {
    var e = S.entities[i];
    if (!e.done && e.kind === "obs" && e.z > 8 && e.z < 42) return true;
  }
  return false;
})()
"""

DASH_OK = """
(function () {
  var S = window.LZGame.snapshot();
  return S.state === "playing" && S.dashT > 0.8 && S.dashT < 2.2;
})()
"""

GOOD_STATS = """
(function () {
  var S = window.LZGame.snapshot();
  return S.state === "playing" && S.scoreFrac >= 1500 && S.zongzi >= 6;
})()
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    errors = []
    report = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 630, "height": 840}, device_scale_factor=2)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        # clean save + fully unlocked codex BEFORE the demo run boots (seen[] built at load)
        page.goto(GAME)
        page.wait_for_function("!!window.__game && !!window.__ui && !!window.LZSave", timeout=10000)
        page.evaluate("localStorage.clear()")
        page.evaluate("window.__game.unlockAll()")
        page.reload()
        page.wait_for_function("!!window.__game && !!window.__ui", timeout=10000)

        # --- 01 home ---
        assert page.eval_on_selector("#view-home", "el => el.classList.contains('is-active')")
        assert page.evaluate("window.__game.save().codex.length") == 8
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT / "01-home.png"))

        # --- demo run: 02 play, 03 dash, 05 result ---
        page.goto(GAME + "?demo=1")
        page.wait_for_function("window.LZGame && window.LZGame.snapshot().state === 'playing'", timeout=10000)

        page.wait_for_function(PLAY_OK, timeout=45000)
        page.screenshot(path=str(OUT / "02-play.png"))
        s = page.evaluate("window.__game.snapshot()")
        report["play"] = {"dist": round(s["dist"]), "score": int(s["scoreFrac"]), "entities": s["entities"]}

        page.wait_for_function(DASH_OK, timeout=30000)
        page.screenshot(path=str(OUT / "03-dash.png"))
        s = page.evaluate("window.__game.snapshot()")
        report["dash"] = {"dashT": round(s["dashT"], 2), "score": int(s["scoreFrac"])}

        # let the autopilot build lively stats before ending the run
        try:
            page.wait_for_function(GOOD_STATS, timeout=60000)
        except Exception:
            pass  # keep whatever stats we have

        # block the demo auto-restart, then force capsize -> result
        page.evaluate("window.LZGame.start = function () {};")
        for _ in range(3):
            page.evaluate("window.__game.forceHit()")
        page.wait_for_function("window.__game.snapshot().state === 'result'", timeout=8000)
        page.wait_for_timeout(400)
        assert page.eval_on_selector("#view-result", "el => el.classList.contains('is-active')")
        rs = page.evaluate("""({
          score: Math.floor(window.__game.snapshot().scoreFrac),
          zongzi: window.__game.snapshot().zongzi,
          dist: Math.floor(window.__game.snapshot().dist),
          maxCombo: window.__game.snapshot().maxCombo,
          title: document.getElementById('result-title').textContent,
          know: document.getElementById('result-know').textContent.slice(0, 24),
          codex: document.getElementById('result-codex').textContent
        })""")
        assert rs["score"] > 200 and rs["zongzi"] > 0 and rs["dist"] > 50, rs
        page.screenshot(path=str(OUT / "05-result.png"))
        report["result"] = rs

        # --- 06 share card from the real lastStats ---
        data_url = page.evaluate("window.LZShare.paintCard(window.LZShare.lastStats)")
        assert data_url.startswith("data:image/png")
        card_ctx = browser.new_context(viewport={"width": 900, "height": 1200}, device_scale_factor=1)
        card = card_ctx.new_page()
        card.goto("about:blank")
        card.evaluate(
            """u => {
              document.body.style.margin = '0';
              var img = document.createElement('img');
              img.id = 'card'; img.style.display = 'block'; img.src = u;
              document.body.appendChild(img);
            }""",
            data_url,
        )
        card.wait_for_function("document.getElementById('card').complete", timeout=10000)
        card.locator("#card").screenshot(path=str(OUT / "06-card.png"))
        card_ctx.close()

        # --- 04 codex (fully unlocked) ---
        p2 = ctx.new_page()
        p2.goto(GAME)
        p2.wait_for_function("!!window.__ui", timeout=10000)
        p2.evaluate("window.__ui.showCodex('home')")
        p2.wait_for_function("document.getElementById('view-codex').classList.contains('is-active')")
        p2.wait_for_function("document.getElementById('codex-count').textContent === '8/8'")
        assert len(p2.query_selector_all(".codex-cell:not(.is-locked)")) == 8
        p2.wait_for_timeout(400)
        p2.screenshot(path=str(OUT / "04-codex.png"))

        page.evaluate("localStorage.clear()")
        browser.close()

    assert not errors, "console/page errors: %r" % errors
    for name in ["01-home.png", "02-play.png", "03-dash.png", "04-codex.png", "05-result.png", "06-card.png"]:
        size = (OUT / name).stat().st_size
        assert size > 20 * 1024, "%s too small: %d" % (name, size)
        report[name] = size
    print("CAPTURE PASS")
    for k, v in report.items():
        print(k, v)


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print("CAPTURE FAIL: %s" % exc)
        sys.exit(1)
