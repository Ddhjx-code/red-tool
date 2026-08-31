#!/usr/bin/env python3
"""Headless smoke suite for 一盏河灯 (tools/hedeng). Run: python3 tests/hedeng_smoke.py"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL_TEST = (ROOT / "tools" / "hedeng" / "index.html").as_uri() + "?test=1"
URL_DEMO = (ROOT / "tools" / "hedeng" / "index.html").as_uri() + "?demo=1"

CHECKS = []


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok  " if cond else "  FAIL ") + name + ((" | " + extra) if extra and not cond else ""))


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

        page.click("#btn-start")
        page.wait_for_selector("#view-make.is-active")
        n_lan = page.locator("#lantern-list .lantern-card").count()
        n_rec = page.locator("#recipient-list .recipient-chip").count()
        check("make view: 3 lanterns + 4 recipients", n_lan == 3 and n_rec == 4, "%d/%d" % (n_lan, n_rec))

        page.evaluate("""(function(){
          var g = window.__game;
          g.setLantern('boat'); g.setRecipient('pet');
          g.setMessage('小黄，谢谢你来过我的生命。');
          g.toLight();
        })()""")
        page.wait_for_selector("#view-light.is-active")
        page.evaluate("window.__game.setFlame(92)")
        snap = page.evaluate("window.__game.snapshot()")
        check("light phase + flame set", snap["phase"] == "light" and snap["flame"] == 92, str(snap))

        page.evaluate("window.__game.release()")
        page.wait_for_selector("#view-release.is-active")
        snap = page.evaluate("window.__game.snapshot()")
        check("release phase with message", snap["phase"] == "release" and snap["message"].startswith("小黄"), str(snap))

        page.evaluate("window.__game.finish()")
        page.wait_for_selector("#view-result.is-active")
        snap = page.evaluate("window.__game.snapshot()")
        grade_el = (page.text_content("#result-grade") or "").strip()
        check("result: flame 92 -> 灯明", snap["grade"] == "bright" and grade_el == "灯明", grade_el)
        check("codex unlocked boat:pet", "boat:pet" in snap["codex"] and snap["runs"] == 1, str(snap["codex"]))

        card_ok = page.evaluate("""(function(){
          var d = window.__game.paintCard();
          return typeof d === 'string' && d.indexOf('data:image/png') === 0 && d.length > 10000;
        })()""")
        share_btns = page.locator("#btn-save-album").count() + page.locator("#btn-post-note").count()
        check("share card renders + buttons present", card_ok and share_btns == 2)

        # 第二盏：默认文案 + 新组合
        page.evaluate("""(function(){
          var g = window.__game;
          g.setLantern('peach'); g.setRecipient('self');
          g.setMessage('');
          g.toLight(); g.setFlame(30); g.release(); g.finish();
        })()""")
        page.wait_for_selector("#view-result.is-active")
        snap = page.evaluate("window.__game.snapshot()")
        msg_el = (page.text_content("#result-msg") or "").strip()
        check("second run: default line used + grade 灯微",
              snap["grade"] == "soft" and snap["message"] == "谢谢你撑到那一天，才有今天的我。", msg_el)
        check("codex has 2 combos", len(snap["codex"]) == 2 and snap["runs"] == 2, str(snap["codex"]))

        # 灯谱页
        page.click("#btn-codex-result")
        page.wait_for_selector("#view-codex.is-active")
        lit = page.locator("#codex-grid .codex-cell.lit").count()
        cnt = (page.text_content("#codex-count") or "").strip()
        check("codex view: 2 lit, count 2/12", lit == 2 and cnt == "2/12", "%d %s" % (lit, cnt))

        # demo 自驾
        page2 = browser.new_page(viewport={"width": 390, "height": 844})
        page2.on("pageerror", lambda e: errors.append("pageerror2: " + str(e)))
        page2.goto(URL_DEMO)
        try:
            page2.wait_for_selector("#view-result.is-active", timeout=30000)
            demo_ok = True
        except Exception:
            demo_ok = False
        check("demo auto-play reaches result", demo_ok)
        if demo_ok:
            demo_msg = (page2.text_content("#result-msg") or "").strip()
            check("demo message rendered", "奶奶" in demo_msg, demo_msg)

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
