#!/usr/bin/env python3
"""Headless smoke suite for 山海御空 (tools/shanhai). Run: python3 tests/shanhai_smoke.py"""
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL_TEST = (ROOT / "tools" / "shanhai" / "index.html").as_uri() + "?test=1"
URL_DEMO = (ROOT / "tools" / "shanhai" / "index.html").as_uri() + "?demo=1"

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
        check("hooks exposed", page.evaluate("!!window.__game"))

        # 启动关卡
        page.evaluate("window.__game.start(0)")
        page.wait_for_selector("#view-battle.is-active")
        snap = page.evaluate("window.__game.snapshot()")
        check("battle started: hp 5, bombs 2", snap["hp"] == 5 and snap["bombs"] == 2, str(snap))

        # 模拟运行 10 秒，确认引擎稳定
        for _ in range(200):
            page.evaluate("window.__game.step(0.05)")
        snap = page.evaluate("window.__game.snapshot()")
        check("engine runs 10s stable", snap["time"] >= 9, str(snap))

        # 玩家移动
        page.evaluate("window.__game.movePlayer(100, 600)")
        st = page.evaluate("window.__game.state()")
        check("player moves", abs(st["px"] - 100) < 2, str(st["px"]))

        # 雷符清屏
        page.evaluate("window.__game.state().enemies.push({type:'qiongqi',x:100,y:100,hp:3,fireCd:9})")
        before = page.evaluate("window.__game.state().enemies.length")
        page.evaluate("window.__game.useBomb()")
        after = page.evaluate("window.__game.state().enemies.length")
        bombs = page.evaluate("window.__game.state().bombs")
        check("bomb clears enemies", before > 0 and after == 0 and bombs >= 0, "%d->%d bombs=%d" % (before, after, bombs))

        # UI 流程
        page.reload()
        page.wait_for_function("window.__ready === true")
        page.click("#btn-start")
        page.wait_for_selector("#view-levels.is-active")
        n_levels = page.locator("#levels-list .level-card").count()
        check("levels view: 3 level cards", n_levels == 3, str(n_levels))
        page.locator("#levels-list .level-card").first.click()
        page.wait_for_selector("#view-intro.is-active")
        intro_name = (page.text_content("#intro-name") or "").strip()
        check("intro: 昆仑之丘 briefing", "昆仑" in intro_name, intro_name)
        page.click("#btn-deploy")
        page.wait_for_selector("#view-battle.is-active")
        check("battle UI: bomb button", page.locator("#btn-bomb").count() == 1)

        # demo 自驾
        page2 = browser.new_page(viewport={"width": 390, "height": 844})
        page2.on("pageerror", lambda e: errors.append("pageerror2: " + str(e)))
        page2.goto(URL_DEMO)
        page2.wait_for_function("window.__ready === true")
        time.sleep(8)
        snap = page2.evaluate("window.__game.snapshot()")
        check("demo auto-play runs", snap["time"] >= 6, str(snap))

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
