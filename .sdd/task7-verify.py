import asyncio, re
from playwright.async_api import async_playwright

URL = "file:///Users/duanchao.wzj/AI/workspace/red-tool/tools/longzhou/index.html?test=1"
SHOTS = "/Users/duanchao.wzj/AI/workspace/red-tool/.sdd/shots/"
TITLES = ["汨罗飞桨", "弄潮儿", "鼓手传人", "江上水手", "见习桨手"]
results = []

def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS" if ok else "FAIL"), name, detail)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 390, "height": 844})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL)
        await page.evaluate("localStorage.clear()")
        await page.reload()
        await page.wait_for_timeout(800)

        boot_home = await page.evaluate("document.getElementById('view-home').classList.contains('is-active')")
        boot_state = await page.evaluate("window.LZGame.snapshot().state")
        btn_vis = await page.evaluate("""() => {
          var b = document.getElementById('btn-start');
          return !!(b.offsetWidth && b.offsetHeight);
        }""")
        best_txt = await page.evaluate("document.getElementById('home-best').textContent")
        check("2 boot: home active, state home, btn visible, home-best empty",
              boot_home and boot_state == "home" and btn_vis and best_txt == "",
              f"home={boot_home} state={boot_state} btn={btn_vis} best='{best_txt}'")
        await page.screenshot(path=SHOTS + "task7-home.png")

        await page.click("#btn-start")
        await page.wait_for_timeout(150)
        game_on = await page.evaluate("document.getElementById('view-game').classList.contains('is-active')")
        st = await page.evaluate("window.LZGame.snapshot().state")
        runs = await page.evaluate("window.LZSave.load().runs")
        tutor1 = await page.evaluate("document.getElementById('tutor').textContent")
        check("3 start: view-game, playing, runs=1",
              game_on and st == "playing" and runs == 1, f"game={game_on} state={st} runs={runs}")
        check("4 tutor phase1", tutor1 == "左右滑动 换线", f"'{tutor1}'")

        await page.wait_for_timeout(3200)
        tutor2 = await page.evaluate("document.getElementById('tutor').textContent")
        check("4 tutor phase2 after 3.2s", tutor2 == "连点右下鼓面 攒满冲刺", f"'{tutor2}'")

        for i in range(9):
            await page.evaluate("window.LZGame.drum()")
            await page.wait_for_timeout(200)
        dashT = await page.evaluate("window.LZGame.snapshot().dashT")
        tutor3 = await page.evaluate("document.getElementById('tutor').textContent")
        check("4 drum->dash clears tutor", dashT > 0 and tutor3 == "", f"dashT={dashT} tutor='{tutor3}'")

        await page.wait_for_timeout(1500)
        for i in range(3):
            await page.evaluate("window.__game.forceHit()")
            await page.wait_for_timeout(150)
        await page.wait_for_timeout(1800)

        res_on = await page.evaluate("document.getElementById('view-result').classList.contains('is-active')")
        fields = await page.evaluate("""() => ({
          title: document.getElementById('result-title').textContent,
          dist: document.getElementById('result-dist').textContent,
          score: document.getElementById('result-score').textContent,
          zongzi: document.getElementById('result-zongzi').textContent,
          combo: document.getElementById('result-combo').textContent,
          best: document.getElementById('result-best').textContent,
          know: document.getElementById('result-know').textContent,
          codex: document.getElementById('result-codex').textContent
        })""")
        nonempty = all(fields[k] != "" for k in ("title", "dist", "score", "zongzi", "combo", "know", "codex"))
        check("5 result view active + fields non-empty", res_on and nonempty, str(fields))
        check("5 title in TITLES", fields["title"] in TITLES, fields["title"])
        check("5 result-codex format", re.match(r"^图鉴 \d+/8$", fields["codex"]) is not None, fields["codex"])

        best_saved = await page.evaluate("window.LZSave.load().best")
        check("6 best persisted >0 + 新纪录 on first run",
              best_saved > 0 and fields["best"] == "新纪录！",
              f"best={best_saved} result-best='{fields['best']}'")
        await page.screenshot(path=SHOTS + "task7-result.png")

        await page.click("#btn-again")
        await page.wait_for_timeout(150)
        st2 = await page.evaluate("window.LZGame.snapshot().state")
        runs2 = await page.evaluate("window.LZSave.load().runs")
        tutor4 = await page.evaluate("document.getElementById('tutor').textContent")
        check("7 btn-again: playing, runs=2, no tutor",
              st2 == "playing" and runs2 == 2 and tutor4 == "", f"state={st2} runs={runs2} tutor='{tutor4}'")

        await page.evaluate("window.LZGame.pause()")
        await page.wait_for_timeout(100)
        mask_on = await page.evaluate("document.getElementById('pause-mask').classList.contains('is-on')")
        st3 = await page.evaluate("window.LZGame.snapshot().state")
        check("7 pause: mask visible, state paused", mask_on and st3 == "paused", f"mask={mask_on} state={st3}")

        await page.click("#btn-resume")
        await page.wait_for_timeout(100)
        mask_off = await page.evaluate("!document.getElementById('pause-mask').classList.contains('is-on')")
        st4 = await page.evaluate("window.LZGame.snapshot().state")
        check("7 resume: mask hidden, playing", mask_off and st4 == "playing", f"maskOff={mask_off} state={st4}")

        await page.wait_for_timeout(500)
        for i in range(3):
            await page.evaluate("window.__game.forceHit()")
            await page.wait_for_timeout(150)
        await page.wait_for_timeout(1800)
        res_on2 = await page.evaluate("document.getElementById('view-result').classList.contains('is-active')")
        best2 = await page.evaluate("window.LZSave.load().best")

        await page.click("#btn-home-result")
        await page.wait_for_timeout(150)
        home_on = await page.evaluate("document.getElementById('view-home').classList.contains('is-active')")
        home_best = await page.evaluate("document.getElementById('home-best').textContent")
        expect = "最佳 " + str(best2) + " 分"
        check("8 btn-home-result: home active, home-best updated",
              res_on2 and home_on and home_best.startswith(expect),
              f"result={res_on2} home={home_on} home-best='{home_best}' best={best2}")

        check("1 no pageerrors", len(errors) == 0, str(errors))
        await page.evaluate("localStorage.clear()")
        n = await page.evaluate("localStorage.length")
        check("9 localStorage clean at end", n == 0, f"length={n}")

        await browser.close()
    fails = [r for r in results if not r[1]]
    print("TOTAL", len(results), "FAIL", len(fails))

asyncio.run(main())
