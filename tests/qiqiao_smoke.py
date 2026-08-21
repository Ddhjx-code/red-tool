#!/usr/bin/env python3
"""Headless smoke/regression suite for 乞巧占卜局 (tools/qiqiao).

Run: python3 tests/qiqiao_smoke.py
Loads the tool hermetically (?test=1 -> deterministic seed + __game hooks,
localStorage cleared at start and end) and asserts: boot state, the
water->calm->drop->reveal->result ritual, calm-timing scoring, result
composition/view, calm-value influence on grade, shadow no-adjacent-repeat,
codex/save, share fallback, paintCard output, and zero console/page errors.
Prints SMOKE PASS on success.
"""
import pathlib
import re
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = (ROOT / "tools" / "qiqiao" / "index.html").as_uri() + "?test=1"

CALM_CYCLE = 2.4
FILL_TIME = 1.5
REVEAL_TIME = 2.8

SAMPLE_STATS = {
    "shadowId": "jinyu",
    "shadowName": "金鱼",
    "gradeId": "shang",
    "gradeName": "上巧",
    "aspectName": "姻缘",
    "textLines": ["影化金鱼摆尾，如鱼得水，年年有余。", "情缘渐浓，缘分正悄悄靠近。", "巧已在手边，用心去做，自然水到渠成。"],
    "codexCount": 3,
}

RELEASE_CONTRACTION_JS = """
(function () {
  var s = window.__game.snapshot();
  if (s.phase !== "calm") return false;
  var p = (s.calmT % 2.4) / 2.4;
  if (p > 0.9) { window.__game.releaseCalm(); return true; }
  return false;
})()
"""

RELEASE_LARGE_CHECK_JS = """
(function () {
  var s = window.__game.snapshot();
  if (s.phase !== "calm") return false;
  var p = (s.calmT % 2.4) / 2.4;
  return p >= 0.2 && p <= 0.35;
})()
"""

FAST_FORWARD_JS = """
(function () {
  for (var i = 0; i < 60 && window.__game.snapshot().phase !== "result"; i++) {
    window.QQDivine.update(0.5);
  }
  return window.__game.snapshot().phase;
})()
"""

FAST_DIVINATION_JS = """
(function () {
  var g = window.__game, i, s, p;
  g.start();
  g.holdWater(true);
  for (i = 0; i < 400; i++) {
    s = g.snapshot();
    if (s.phase === "result") break;
    if (s.phase === "calm") {
      p = (s.calmT % 2.4) / 2.4;
      if (p > 0.9) g.releaseCalm();
    }
    window.QQDivine.update(0.1);
  }
  g.holdWater(false);
  return g.snapshot();
})()
"""

GRADE_GROUP_JS = """
(function (v) {
  var g = window.__game, out = [], i, j;
  for (i = 0; i < 30; i++) {
    g.start();
    g.setCalm(v);
    g.forcePhase("reveal");
    for (j = 0; j < 60 && g.snapshot().phase !== "result"; j++) {
      window.QQDivine.update(0.5);
    }
    var s = g.snapshot();
    out.push(s.result ? s.result.gradeId : null);
  }
  return out;
})
"""

VIEW_ACTIVE_JS = "document.getElementById('%s').classList.contains('is-active')"


def view_active(view_id):
    return VIEW_ACTIVE_JS % view_id


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
        page.wait_for_function(
            "!!window.__game && !!window.QQData && !!window.QQSave && !!window.QQShare && !!window.QQRng",
            timeout=10000)
        page.evaluate("window.QQSound && window.QQSound.setMuted(true)")

        shadow_ids = page.evaluate("window.QQData.SHADOWS.map(function (s) { return s.id; })")
        aspect_ids = page.evaluate("window.QQData.ASPECTS.map(function (a) { return a.id; })")
        grade_ids = page.evaluate("window.QQData.GRADES.map(function (g) { return g.id; })")
        grade_names = page.evaluate("window.QQData.GRADES.map(function (g) { return g.name; })")

        # 1. Boot: home view active, data tables sized 12/5/5/5
        assert page.eval_on_selector("#view-home", "el => el.classList.contains('is-active')"), \
            "home view should be active"
        assert page.evaluate("window.QQData.SHADOWS.length") == 12, "SHADOWS should have 12 entries"
        assert page.evaluate("window.QQData.ASPECTS.length") == 5, "ASPECTS should have 5 entries"
        assert page.evaluate("window.QQData.GRADES.length") == 5, "GRADES should have 5 entries"
        assert page.evaluate("window.QQData.FACTS.length") == 5, "FACTS should have 5 entries"
        assert page.evaluate("window.__game.snapshot().phase") == "home"

        # 2. start -> water; holdWater fills the basin -> calm
        page.evaluate("window.__game.start()")
        assert page.evaluate("window.__game.snapshot().phase") == "water", "start() should enter water"
        page.evaluate("window.__game.holdWater(true)")
        page.wait_for_function("window.__game.snapshot().phase === 'calm'",
                               timeout=int((FILL_TIME + 2.5) * 1000))

        # 3a. Release near contraction (phasePos > 0.9) -> high calm value
        page.wait_for_function(RELEASE_CONTRACTION_JS, timeout=10000)
        calm_high = page.evaluate("window.__game.snapshot().calmValue")
        assert calm_high > 60, "contraction release should score > 60, got %r" % calm_high

        # 4. drop auto-animates -> reveal within ~1.5s -> result after REVEAL_TIME
        t0 = time.time()
        page.wait_for_function("window.__game.snapshot().phase === 'reveal'", timeout=2500)
        assert time.time() - t0 < 1.5, "drop should reach reveal within ~1.5s"
        page.wait_for_function("window.__game.snapshot().phase === 'result'",
                               timeout=int((REVEAL_TIME + 1.8) * 1000))
        res = page.evaluate("window.__game.snapshot().result")
        assert res, "result should exist after reveal"
        assert res["shadowId"] in shadow_ids, "invalid shadowId %r" % res["shadowId"]
        assert res["aspectId"] in aspect_ids, "invalid aspectId %r" % res["aspectId"]
        assert res["gradeId"] in grade_ids, "invalid gradeId %r" % res["gradeId"]

        # 5. result view: 3 non-empty text lines, seal is a grade name, codex counter
        page.wait_for_function(view_active("view-result"), timeout=3000)
        lines = page.eval_on_selector_all("#result-text p", "els => els.map(e => e.textContent.trim())")
        assert len(lines) == 3 and all(lines), "result-text should have 3 non-empty <p>, got %r" % lines
        seal = page.eval_on_selector("#result-seal", "el => el.textContent.trim()")
        assert seal in grade_names, "result-seal %r should be a grade name" % seal
        codex_txt = page.eval_on_selector("#result-codex", "el => el.textContent.trim()")
        assert re.fullmatch(r"图鉴 \d+/12", codex_txt), "unexpected result-codex %r" % codex_txt

        # 3b. Restart, release while the circle is still large (phasePos ~0.3) -> low calm value.
        # Driven through the canvas pointer handlers (pointerdown=hold, pointerup=release).
        page.evaluate("window.__game.start()")
        pos = page.eval_on_selector(
            "#stage",
            "el => { var r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }")
        page.mouse.move(pos["x"], pos["y"])
        page.mouse.down()
        page.wait_for_function("window.__game.snapshot().phase === 'calm'",
                               timeout=int((FILL_TIME + 2.5) * 1000))
        page.wait_for_function(RELEASE_LARGE_CHECK_JS, timeout=10000)
        page.mouse.up()
        page.wait_for_function("window.__game.snapshot().phase === 'drop'", timeout=2000)
        calm_low = page.evaluate("window.__game.snapshot().calmValue")
        assert calm_low < 50, "large-circle release should score < 50, got %r" % calm_low
        assert page.evaluate(FAST_FORWARD_JS) == "result", "round B should finish at result"

        # 6. calmValue influences grade: setCalm(90) x30 vs setCalm(10) x30 forced reveals.
        # ?test=1 reseeds per start(), so outcomes alternate deterministically;
        # assertions are directional (pattern validated in Task 4).
        page.evaluate("localStorage.clear()")
        grades_high = page.evaluate(GRADE_GROUP_JS, 90)
        grades_low = page.evaluate(GRADE_GROUP_JS, 10)
        assert len(grades_high) == 30 and all(grades_high), "bad high-calm group %r" % grades_high
        assert len(grades_low) == 30 and all(grades_low), "bad low-calm group %r" % grades_low
        good_high = sum(g in ("shangshang", "shang") for g in grades_high)
        good_low = sum(g in ("shangshang", "shang") for g in grades_low)
        weide_high = sum(g == "weide" for g in grades_high)
        weide_low = sum(g == "weide" for g in grades_low)
        assert good_high > good_low, \
            "calm=90 good grades (%d) should exceed calm=10 (%d)" % (good_high, good_low)
        assert weide_low > weide_high, \
            "calm=10 weide (%d) should exceed calm=90 (%d)" % (weide_low, weide_high)

        # 7. shadow no-adjacent-repeat across 20 full divinations
        seq = []
        for _ in range(20):
            snap = page.evaluate(FAST_DIVINATION_JS)
            assert snap["phase"] == "result" and snap["result"], "fast divination should finish: %r" % snap
            assert snap["result"]["shadowId"] in shadow_ids
            seq.append(snap["result"]["shadowId"])
        assert all(a != b for a, b in zip(seq, seq[1:])), "adjacent shadow repeat in %r" % seq

        # 8. codex: unlockAll -> 12/12; clear storage -> 0/12
        page.wait_for_function(view_active("view-result"), timeout=3000)
        page.evaluate("window.__game.unlockAll()")
        assert len(page.evaluate("window.__game.save().codex")) == 12, "unlockAll should fill save codex"
        page.click("#btn-codex-result")
        page.wait_for_function(view_active("view-codex"), timeout=3000)
        count = page.eval_on_selector("#codex-count", "el => el.textContent.trim()")
        assert count == "12/12", "codex count should be 12/12, got %r" % count
        page.click("#btn-codex-back")
        page.wait_for_function(view_active("view-result"), timeout=3000)
        page.evaluate("localStorage.clear()")
        page.click("#btn-codex-result")
        page.wait_for_function(view_active("view-codex"), timeout=3000)
        count = page.eval_on_selector("#codex-count", "el => el.textContent.trim()")
        assert count == "0/12", "codex count should reset to 0/12, got %r" % count
        page.click("#btn-codex-back")
        page.wait_for_function(view_active("view-result"), timeout=3000)

        # 9. share fallback: no window.xhs -> alert dialog
        assert not page.evaluate("!!window.xhs"), "xhs bridge should be absent under file://"
        page.evaluate("(stats) => { window.QQShare.lastStats = stats; }", SAMPLE_STATS)
        before = len(dialogs)
        page.click("#btn-save-album")
        deadline = time.time() + 5
        while time.time() < deadline and len(dialogs) == before:
            page.wait_for_timeout(100)
        assert len(dialogs) > before, "save-album without xhs should fall back to alert"
        assert "截图保存" in dialogs[before], "unexpected fallback message: %r" % dialogs[before]

        # 10. paintCard returns a 900x1200 PNG data URL
        data_url = page.evaluate("(stats) => window.QQShare.paintCard(stats)", SAMPLE_STATS)
        assert isinstance(data_url, str) and data_url.startswith("data:image/png"), \
            "paintCard should return a png data URL"
        dims = page.evaluate(
            """async (u) => {
              var img = new Image();
              await new Promise(function (resolve, reject) {
                img.onload = resolve; img.onerror = reject; img.src = u;
              });
              return [img.naturalWidth, img.naturalHeight];
            }""",
            data_url)
        assert dims == [900, 1200], "card should decode at 900x1200, got %r" % dims

        # 11. hermetic cleanup
        page.evaluate("localStorage.clear()")
        browser.close()

    assert not errors, "console/page errors: %r" % errors
    print("SMOKE PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("SMOKE FAIL: %s" % exc)
        sys.exit(1)
