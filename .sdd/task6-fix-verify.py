import asyncio, json
from playwright.async_api import async_playwright

URL = "file:///Users/duanchao.wzj/AI/workspace/red-tool/tools/longzhou/index.html?test=1"
results = []

def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS" if ok else "FAIL"), name, detail)

COUNT_JS = """(n) => {
  window.__game.start();
  window.__game.setDist(600);
  var R = {ai:1,changpu:1,wusai:1,wudu:1,xiangnang:1,ling:1};
  for (var i = 0; i < n; i++) window.__game.spawnWave();
  var ents = window.LZGame.snapshot().entities;
  var counts = {}, total = 0;
  for (var j = 0; j < ents.length; j++) {
    var e = ents[j];
    if (e.kind === 'pick' && R[e.type]) { counts[e.type] = (counts[e.type] || 0) + 1; total++; }
  }
  return {counts: counts, total: total};
}"""

STEER_JS = """() => {
  var S = window.LZGame.snapshot();
  if (S.zongzi > 0) return {done: true, state: S.state};
  var best = null;
  for (var i = 0; i < S.entities.length; i++) {
    var e = S.entities[i];
    if (e.kind === 'pick' && e.type === 'zongzi' && !e.done && e.z > -2) {
      if (!best || e.z < best.z) best = e;
    }
  }
  return {done: false, state: S.state, lane: best ? best.lane : null, boat: S.boatX};
}"""

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

        check("1 no pageerrors (load)", len(errors) == 0, str(errors))

        await page.evaluate("""() => {
          window.__toasts = [];
          var t = document.getElementById('toast');
          new MutationObserver(function () {
            if (t.classList.contains('is-on')) window.__toasts.push(t.textContent);
          }).observe(t, {characterData: true, childList: true, subtree: true, attributes: true});
        }""")

        collected = False
        for attempt in range(6):
            await page.evaluate("window.__game.start()")
            for step in range(200):
                await page.wait_for_timeout(100)
                info = await page.evaluate(STEER_JS)
                if info["done"]:
                    collected = True
                    break
                if info["state"] != "playing":
                    break
                if info["lane"] is not None:
                    if info["lane"] > info["boat"] + 0.5:
                        await page.evaluate("window.__game.swipe(1)")
                    elif info["lane"] < info["boat"] - 0.5:
                        await page.evaluate("window.__game.swipe(-1)")
            if collected:
                break
        await page.wait_for_timeout(2200)
        codex = await page.evaluate("window.LZSave.load().codex")
        check("2 fresh zongzi collected -> codex has zongzi",
              collected and "zongzi" in codex, f"collected={collected} codex={codex}")
        toasts = await page.evaluate("window.__toasts")
        check("2 toast 图鉴解锁 · 粽子 seen", any("图鉴解锁" in t for t in toasts), f"toasts={toasts}")

        await page.evaluate("localStorage.setItem('longzhou-save', JSON.stringify({codex: ['zongzi']}))")
        await page.reload()
        await page.wait_for_timeout(500)
        a = await page.evaluate(COUNT_JS, 800)
        distinct = [k for k, v in a["counts"].items() if v > 0]
        check("3A codex=[zongzi], 2x400 waves: >=5 distinct rare ids AND total>0",
              len(distinct) >= 5 and a["total"] > 0,
              f"distinct={sorted(distinct)} total={a['total']} counts={a['counts']}")

        await page.evaluate("window.__game.unlockAll()")
        await page.reload()
        await page.wait_for_timeout(500)
        ctrl = await page.evaluate(COUNT_JS, 2000)
        await page.evaluate(
            "localStorage.setItem('longzhou-save', JSON.stringify({codex: ['zongzi','wine','ai','changpu','wudu','xiangnang','ling']}))")
        await page.reload()
        await page.wait_for_timeout(500)
        locked_test = await page.evaluate(COUNT_JS, 2000)
        c_share = ctrl["counts"].get("wusai", 0) / max(1, ctrl["total"])
        t_share = locked_test["counts"].get("wusai", 0) / max(1, locked_test["total"])
        check("3B locked wusai share > 1.25x unlocked control share",
              t_share > c_share * 1.25,
              f"control wusai {ctrl['counts'].get('wusai',0)}/{ctrl['total']}={c_share:.3f} vs "
              f"locked {locked_test['counts'].get('wusai',0)}/{locked_test['total']}={t_share:.3f}")

        await page.evaluate("localStorage.clear()")
        await page.reload()
        await page.wait_for_timeout(500)
        await page.evaluate("window.__game.start()")
        await page.wait_for_timeout(200)
        for i in range(3):
            await page.evaluate("window.__game.forceHit()")
            await page.wait_for_timeout(100)
        st1 = await page.evaluate("window.LZGame.snapshot().state")
        await page.wait_for_timeout(1800)
        st2 = await page.evaluate("window.LZGame.snapshot().state")
        check("4 forceHit x3 -> capsized -> result (state machine)",
              st1 == "capsized" and st2 == "result", f"st1={st1} st2={st2}")

        await page.evaluate("window.__game.start()")
        await page.wait_for_timeout(100)
        lane0 = await page.evaluate("window.LZGame.snapshot().lane")
        await page.evaluate("window.__game.swipe(1)")
        lane1 = await page.evaluate("window.LZGame.snapshot().lane")
        check("4 swipe changes lane", lane0 == 0 and lane1 == 1, f"{lane0} -> {lane1}")

        for i in range(9):
            await page.evaluate("window.LZGame.drum()")
            await page.wait_for_timeout(200)
        snap = await page.evaluate("window.LZGame.snapshot()")
        check("4 drum x9 -> dash", snap["dashT"] > 0, f"dashT={snap['dashT']} gauge={snap['gauge']}")

        check("1 no pageerrors (overall)", len(errors) == 0, str(errors))
        await page.evaluate("localStorage.clear()")
        n = await page.evaluate("localStorage.length")
        check("5 localStorage clean at end", n == 0, f"length={n}")

        await page.screenshot(path="/Users/duanchao.wzj/AI/workspace/red-tool/.sdd/shots/task6-fix.png")
        await browser.close()
    fails = [r for r in results if not r[1]]
    print("TOTAL", len(results), "FAIL", len(fails))

asyncio.run(main())
