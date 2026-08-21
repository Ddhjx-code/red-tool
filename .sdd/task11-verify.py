import time
from playwright.sync_api import sync_playwright

BASE = "file:///Users/duanchao.wzj/AI/workspace/red-tool/tools/longzhou/index.html"
SHOT = "/Users/duanchao.wzj/AI/workspace/red-tool/.sdd/shots/task11-demo.png"
SNAP = "({state:window.LZGame.snapshot().state,dist:window.LZGame.snapshot().dist,dashT:window.LZGame.snapshot().dashT,gauge:window.LZGame.snapshot().gauge,t:window.LZGame.snapshot().t})"

results = {}
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()

    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script("localStorage.clear()")
    page.goto(BASE + "?demo=1")
    page.wait_for_function("!!window.LZGame", timeout=5000)

    try:
        page.wait_for_function("window.LZGame.snapshot().state==='playing'", timeout=1500)
        results["auto_start"] = "PASS"
    except Exception:
        results["auto_start"] = "FAIL"

    dash_fired = False
    survived = True
    death = None
    shot_taken = False
    deadline = time.time() + 62
    while time.time() < deadline:
        s = page.evaluate(SNAP)
        if s["dashT"] > 0:
            dash_fired = True
        if s["state"] in ("capsized", "result"):
            survived = False
            death = s
            break
        if not shot_taken and s["dist"] > 120:
            page.screenshot(path=SHOT)
            shot_taken = True
        time.sleep(0.2)
    final = page.evaluate(SNAP)
    results["dist"] = final["dist"]
    results["dash_fired"] = dash_fired
    results["survived_60s"] = survived
    results["death"] = death
    ctx.close()

    ctx2 = browser.new_context(viewport={"width": 390, "height": 844})
    pg2 = ctx2.new_page()
    pg2.on("pageerror", lambda e: errors.append(str(e)))
    pg2.add_init_script("localStorage.clear()")
    pg2.goto(BASE)
    pg2.wait_for_function("!!window.LZGame", timeout=5000)
    pg2.wait_for_timeout(1500)
    st_home = pg2.evaluate("window.LZGame.snapshot().state")
    pg2.click("#btn-start")
    pg2.wait_for_timeout(300)
    st_click = pg2.evaluate("window.LZGame.snapshot().state")
    results["normal_home"] = st_home
    results["normal_after_click"] = st_click
    ctx2.close()

    ctx3 = browser.new_context(viewport={"width": 390, "height": 844})
    pg3 = ctx3.new_page()
    pg3.on("pageerror", lambda e: errors.append(str(e)))
    pg3.add_init_script("localStorage.clear()")
    pg3.goto(BASE + "?test=1")
    pg3.wait_for_function("!!window.LZGame", timeout=5000)
    pg3.wait_for_timeout(1500)
    results["test1_home"] = pg3.evaluate("window.LZGame.snapshot().state")
    ctx3.close()

    browser.close()

results["pageerrors"] = errors
print(results)
ok = (
    not errors
    and results.get("auto_start") == "PASS"
    and results.get("dist", 0) > 400
    and results.get("dash_fired")
    and results.get("survived_60s")
    and results.get("normal_home") == "home"
    and results.get("normal_after_click") == "playing"
    and results.get("test1_home") == "home"
)
print("OVERALL:", "PASS" if ok else "FAIL")
