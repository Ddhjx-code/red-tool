#!/usr/bin/env python3
"""Headless smoke suite for 鬼月·夜归路 (tools/guiyue). Run: python3 tests/guiyue_smoke.py"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL_TEST = (ROOT / "tools" / "guiyue" / "index.html").as_uri() + "?test=1"
URL_DEMO = (ROOT / "tools" / "guiyue" / "index.html").as_uri() + "?demo=1"

CHECKS = []


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok  " if cond else "  FAIL ") + name + ((" | " + extra) if extra and not cond else ""))


SAFE_LINE = [1, 1, 2, 1, 1]  # 每幕安全选项下标（s1:1, s2:1, s3:2, s4:1, s5:1）


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        page.goto(URL_TEST)
        page.wait_for_function("window.__ready === true", timeout=10000)
        page.evaluate("localStorage.clear()")
        check("hooks exposed", page.evaluate("!!window.__game"))

        # 全守规矩线 -> safe 结局
        page.evaluate("window.__game.start()")
        page.wait_for_selector("#view-rules.is-active")
        n_rules = page.locator("#rules-list li").count()
        check("rules view: 5 rules", n_rules == 5, str(n_rules))
        page.evaluate("window.__game.walk()")
        page.wait_for_selector("#view-scene.is-active")
        for i in range(5):
            n_ch = page.locator("#choice-list .choice-btn").count()
            if i == 0:
                check("scene has 3 choices", n_ch == 3, str(n_ch))
            page.evaluate("window.__game.choose(%d)" % SAFE_LINE[i])
            page.wait_for_selector("#view-outcome.is-active")
            if i < 4:
                page.wait_for_timeout(500)
                page.evaluate("window.__game.next()")
                page.wait_for_selector("#view-scene.is-active")
        page.wait_for_timeout(500)
        page.evaluate("window.__game.next()")
        page.wait_for_selector("#view-result.is-active")
        snap = page.evaluate("window.__game.snapshot()")
        ending_el = (page.text_content("#result-ending") or "").strip()
        check("safe line: 安然无恙 ending", snap["ending"] == "safe" and ending_el == "安然无恙",
              "%s %s" % (snap["ending"], ending_el))
        check("safe line: yang 3 kept 5", snap["yang"] == 3 and snap["kept"] == 5, str(snap))

        card_ok = page.evaluate("""(function(){
          var d = window.__game.paintCard();
          return typeof d === 'string' && d.indexOf('data:image/png') === 0 && d.length > 10000;
        })()""")
        share_btns = page.locator("#btn-save-album").count() + page.locator("#btn-post-note").count()
        check("share card + buttons", card_ok and share_btns == 2)

        # 破忌线 -> lost 结局（连错三次阳气散尽）
        page.evaluate("window.__game.start(); window.__game.walk();")
        page.wait_for_selector("#view-scene.is-active")
        for i in range(3):
            wrong = 0 if SAFE_LINE[i] != 0 else 2
            page.evaluate("window.__game.choose(%d)" % wrong)
            page.wait_for_selector("#view-outcome.is-active")
            if i < 2:
                page.wait_for_timeout(500)
                page.evaluate("window.__game.next()")
                page.wait_for_selector("#view-scene.is-active")
        page.wait_for_timeout(500)
        page.evaluate("window.__game.next()")
        page.wait_for_selector("#view-result.is-active")
        snap = page.evaluate("window.__game.snapshot()")
        check("lost line: 夜路未尽 ending + yang 0", snap["ending"] == "lost" and snap["yang"] == 0, str(snap))
        check("endings collected: safe+lost", set(snap["endings"]) >= {"safe", "lost"}, str(snap["endings"]))

        # demo 自驾
        page2 = browser.new_page(viewport={"width": 390, "height": 844})
        page2.on("pageerror", lambda e: errors.append("pageerror2: " + str(e)))
        page2.goto(URL_DEMO)
        try:
            page2.wait_for_selector("#view-result.is-active", timeout=40000)
            demo_ok = True
        except Exception:
            demo_ok = False
        check("demo auto-play reaches result", demo_ok)
        if demo_ok:
            demo_ending = (page2.text_content("#result-ending") or "").strip()
            check("demo safe ending", demo_ending == "安然无恙", demo_ending)

        check("zero console/page errors", not errors, "; ".join(errors[:5]))
        browser.close()

    failed = [n for n, ok in CHECKS if not ok]
    print()
    if failed:
        print("SMOKE FAIL: %d/%d failed: %s" % (len(failed), len(CHECKS), ", ".join(failed)))
        sys.exit(1)
    print("SMOKE PASS (%d assertions)" % len(CHECKS))


if __name__ == "__main__":
    main()
