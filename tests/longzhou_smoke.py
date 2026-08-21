#!/usr/bin/env python3
"""Headless smoke/regression suite for 龙舟破浪 (tools/longzhou).

Run: python3 tests/longzhou_smoke.py
Loads the game hermetically (?test=1 -> deterministic seed + __game hooks,
localStorage cleared at start and end) and asserts the core game loop,
difficulty ramp, wave spawner, codex/save, capsize->result flow, share
fallback, and zero console/page errors. Prints SMOKE PASS on success.
"""
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = (ROOT / "tools" / "longzhou" / "index.html").as_uri() + "?test=1"

SPAWN_WAVES_JS = """
(function () {
  var bad = 0, maxObs = 0, i, j;
  for (i = 0; i < 200; i++) {
    var ents = window.LZGame.snapshot().entities;
    var prev = ents.length;
    window.__game.spawnWave();
    var lanes = {};
    for (j = prev; j < ents.length; j++) {
      if (ents[j].kind === "obs") lanes[Math.round(ents[j].lane)] = true;
    }
    var n = Object.keys(lanes).length;
    if (n > maxObs) maxObs = n;
    if (n > 2) bad++;
  }
  return { ok: true, bad: bad, maxObs: maxObs };
})()
"""


def main():
    errors = []
    dialogs = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        def on_dialog(d):
            dialogs.append(d.message)
            d.accept()

        page.on("dialog", on_dialog)
        page.add_init_script("localStorage.clear()")
        page.goto(URL)
        page.evaluate("localStorage.clear()")
        page.wait_for_function("!!window.__game && !!window.LZData && !!window.LZSave", timeout=10000)

        # 1. Boot: home view active, codex data has 8 entries
        assert page.eval_on_selector("#view-home", "el => el.classList.contains('is-active')"), "home view should be active"
        assert page.evaluate("window.LZData.CODEX.length") == 8, "CODEX should have 8 entries"
        assert page.evaluate("window.__game.snapshot().state") == "home"

        # 2. Start -> playing
        page.evaluate("window.__game.start()")
        assert page.evaluate("window.__game.snapshot().state") == "playing", "start() should enter playing"

        # 3. Entities spawn
        page.wait_for_function("window.__game.snapshot().entities > 0", timeout=5000)

        # 4. Swipe right -> lane 1
        page.evaluate("window.__game.swipe(1)")
        page.wait_for_function("window.__game.snapshot().lane === 1", timeout=2000)

        # 5. Drum x12 -> gauge fills / dash triggers
        for _ in range(12):
            page.evaluate("window.__game.drum()")
            page.wait_for_timeout(130)
        s = page.evaluate("window.__game.snapshot()")
        assert s["dashT"] > 0 or s["gauge"] >= 96, "drumming should fill gauge / trigger dash (got %r)" % s

        # 6. Difficulty ramp: at 600m base speed must exceed 9
        page.evaluate("window.__game.setDist(600)")
        page.wait_for_timeout(800)
        speed = page.evaluate("window.__game.snapshot().speed")
        assert speed > 9, "speed should ramp with distance, got %r" % speed

        # 7. spawnWave x200: no exception, never block all 3 lanes
        waves = page.evaluate(SPAWN_WAVES_JS)
        assert waves["ok"], "spawnWave loop should complete"
        assert waves["bad"] == 0, "waves blocking all lanes: %r" % waves
        assert waves["maxObs"] <= 2
        assert page.evaluate("window.__game.snapshot().entities") > 0

        # 8. unlockAll -> save codex complete
        page.evaluate("window.__game.unlockAll()")
        assert len(page.evaluate("window.__game.save().codex")) == 8, "unlockAll should fill codex"

        # 9. forceHit x3 -> capsize -> result view
        for _ in range(3):
            page.evaluate("window.__game.forceHit()")
        assert page.evaluate("window.__game.snapshot().state") in ("capsized", "result")
        page.wait_for_function("window.__game.snapshot().state === 'result'", timeout=6000)
        assert page.eval_on_selector("#view-result", "el => el.classList.contains('is-active')"), "result view should be active"
        assert page.evaluate("document.getElementById('result-title').textContent.trim().length > 0"), "result title non-empty"

        # 10. Share fallback: no window.xhs -> alert dialog
        page.click("#btn-save-album")
        deadline = time.time() + 5
        while time.time() < deadline and not dialogs:
            page.wait_for_timeout(100)
        assert dialogs, "save-album without xhs should fall back to alert"
        assert "截图保存" in dialogs[0], "unexpected fallback message: %r" % dialogs[0]

        # 11. Hermetic cleanup
        page.evaluate("localStorage.clear()")
        browser.close()

    assert not errors, "console/page errors: %r" % errors
    print("SMOKE PASS")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print("SMOKE FAIL: %s" % exc)
        sys.exit(1)
