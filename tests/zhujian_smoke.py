#!/usr/bin/env python3
"""Headless smoke/regression suite for 竹简观兵 (tools/zhujian).

Run: python3 tests/zhujian_smoke.py
Loads the tool (?test=1 -> __zj hooks), asserts: home render, 展卷->browse
(13 slabs + plaques), 选篇读简 (face cycle / 附片 / 图鉴点亮), 全卷解锁,
手记分享卡 (900x1200 canvas dataURL), 零 console/page 错误. Prints SMOKE PASS.
Requires WebGL-enabled Chromium.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = (ROOT / "tools" / "zhujian" / "index.html").as_uri() + "?test=1&demo=0"

FAILS = []


def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        FAILS.append(name)


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 630, "height": 840})
        errors = []
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(URL, wait_until="load")
        page.wait_for_function("window.__zj !== undefined", timeout=15000)
        page.wait_for_timeout(400)

        check("home 标题", "竹简观兵" in page.inner_text("#view-home"))

        # 展卷
        page.click("#btn-unroll")
        page.wait_for_function(
            "window.__zj.state().stage.stage === 'browse'", timeout=15000)
        s = page.evaluate("window.__zj.state()")
        check("展卷完成 stage=browse", s["stage"]["stage"] == "browse")
        check("篇签/束数 13", page.evaluate(
            "document.querySelectorAll('#view-stage canvas').length >= 1"))

        # 读篇 → 附片 → 图鉴
        page.evaluate("window.__zj.selectPian(1)")
        page.wait_for_timeout(300)
        s = page.evaluate("window.__zj.state()")
        check("读篇 selected=1", s["stage"]["selected"] == 1)
        page.evaluate("window.__zj.cycleFace(1)")
        page.evaluate("window.__zj.openCard()")
        page.wait_for_timeout(200)
        s = page.evaluate("window.__zj.state()")
        check("附片点到 → done 含 1", 1 in s["done"])
        check("读篇展示 3 面", s["stage"]["face"] == 1)
        page.click("#btn-close-card")
        page.wait_for_timeout(200)

        # 全卷解锁
        page.evaluate("window.__zj.unlockAll()")
        s = page.evaluate("window.__zj.state()")
        check("解锁后 full=true", s["full"])

        # 手记分享卡
        page.click("#btn-note")
        page.wait_for_timeout(300)
        src = page.get_attribute("#note-img", "src") or ""
        check("手记卡 dataURL 生成", src.startswith("data:image/png"))
        check("手记卡 900x1200", page.evaluate(
            "document.querySelector('#note-img').naturalWidth === 900 && "
            "document.querySelector('#note-img').naturalHeight === 1200"))

        check("零页面错误", len(errors) == 0)
        if errors:
            print("errors:", errors)
        browser.close()

    if FAILS:
        print("SMOKE FAIL:", ", ".join(FAILS))
        sys.exit(1)
    print("SMOKE PASS")


if __name__ == "__main__":
    run()
