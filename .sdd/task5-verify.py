import asyncio, math
from playwright.async_api import async_playwright

URL = "file:///Users/duanchao.wzj/AI/workspace/red-tool/tools/longzhou/index.html?test=1"
results = []

def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS" if ok else "FAIL"), name, detail)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 390, "height": 844})
        errors, failed = [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("requestfailed", lambda r: failed.append(r.url))
        await page.goto(URL)
        await page.wait_for_timeout(1000)

        check("1 no pageerrors", len(errors) == 0, str(errors))
        ign = [u for u in failed if not ("audio.js" in u or "share.js" in u)]
        check("1 only audio/share 404", len(ign) == 0, str(ign))

        snap = await page.evaluate("window.__game.snapshot()")
        dist_txt = await page.text_content("#hud-dist")
        score_txt = await page.text_content("#hud-score")
        dots = await page.query_selector_all("#hud-steady .steady-dot")
        off = await page.query_selector_all("#hud-steady .steady-dot.is-off")
        hud_d = int(dist_txt[:-1])
        check("2 hud-dist", dist_txt.endswith("m") and abs(hud_d - math.floor(snap["dist"])) <= 1,
              f"{dist_txt} vs {snap['dist']}")
        check("2 hud-score", abs(int(score_txt) - math.floor(snap["scoreFrac"])) <= 1,
              f"{score_txt} vs {snap['scoreFrac']}")
        check("2 steady 3 dots none off", len(dots) == 3 and len(off) == 0, f"dots={len(dots)} off={len(off)}")

        await page.evaluate("window.__game.forceHit()")
        await page.wait_for_timeout(100)
        off = await page.query_selector_all("#hud-steady .steady-dot.is-off")
        combo_txt = await page.text_content("#hud-combo")
        snap = await page.evaluate("window.__game.snapshot()")
        check("3 one dot off after hit", len(off) == 1, f"off={len(off)} steady={snap['steady']}")
        check("3 combo empty when <3", combo_txt == "" and snap["combo"] < 3, f"'{combo_txt}' combo={snap['combo']}")

        reached100 = False
        for i in range(9):
            await page.evaluate("window.LZGame.drum()")
            await page.wait_for_timeout(250)
        for i in range(20):
            h = await page.evaluate("document.getElementById('gauge-fill').style.height")
            if h == "100%":
                reached100 = True
                break
            await page.wait_for_timeout(50)
        snap = await page.evaluate("window.__game.snapshot()")
        check("4 gauge hit 100%", reached100, f"gauge={snap['gauge']}")
        check("4 dashT>0", snap["dashT"] > 0, f"dashT={snap['dashT']}")
        await page.wait_for_timeout(3400)
        snap = await page.evaluate("window.__game.snapshot()")
        h = await page.evaluate("document.getElementById('gauge-fill').style.height")
        check("4 gauge back to 0 after dash", snap["dashT"] == 0 and snap["gauge"] == 0 and h == "0%",
              f"dashT={snap['dashT']} gauge={snap['gauge']} h={h}")

        await page.evaluate("window.__game.start()")
        await page.wait_for_timeout(200)
        for i in range(3):
            await page.click("#btn-drum")
            await page.wait_for_timeout(250)
        snap = await page.evaluate("window.__game.snapshot()")
        check("5 btn click gauge ~36", 24 <= snap["gauge"] <= 48, f"gauge={snap['gauge']}")

        g0 = await page.evaluate("window.__game.snapshot().gauge")
        await page.keyboard.press("Space")
        await page.wait_for_timeout(100)
        g1 = await page.evaluate("window.__game.snapshot().gauge")
        check("6 space drum +12", g1 == g0 + 12, f"{g0} -> {g1}")

        await page.screenshot(path="/Users/duanchao.wzj/AI/workspace/red-tool/.sdd/shots/task5-hud.png")
        check("7 screenshot saved", True, ".sdd/shots/task5-hud.png")

        await browser.close()
    fails = [r for r in results if not r[1]]
    print("TOTAL", len(results), "FAIL", len(fails))

asyncio.run(main())
