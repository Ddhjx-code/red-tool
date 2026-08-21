import json, os, sys, time
from playwright.sync_api import sync_playwright

URL = "file:///Users/duanchao.wzj/AI/workspace/red-tool/tools/longzhou/index.html?test=1"
SHOTS = "/Users/duanchao.wzj/AI/workspace/red-tool/.sdd/shots"
os.makedirs(SHOTS, exist_ok=True)

errors, results = [], []
def ok(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS" if cond else "FAIL"), name, extra)

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    dialogs = []
    page.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)

    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(400)

    ok("boot home view", page.evaluate("document.getElementById('view-home').classList.contains('is-active')"))
    page.click("#btn-start")
    page.wait_for_timeout(300)
    ok("start -> playing", page.evaluate("window.__game.snapshot().state") == "playing")

    d0 = page.evaluate("window.__game.snapshot().dist")
    saw_dash = False
    dash_frames_differ = False
    dash_shot = False
    t_end = time.time() + 10
    last_swipe = last_drum = 0
    while time.time() < t_end:
        now = time.time()
        if now - last_swipe > 0.7:
            last_swipe = now
            page.evaluate("window.__game.swipe(Math.random() < 0.5 ? -1 : 1)")
        if now - last_drum > 0.25:
            last_drum = now
            page.evaluate("window.__game.drum()")
        if not saw_dash and page.evaluate("window.__game.snapshot().dashT > 0"):
            saw_dash = True
            f1 = page.evaluate("document.getElementById('stage').toDataURL()")
            page.wait_for_timeout(120)
            f2 = page.evaluate("document.getElementById('stage').toDataURL()")
            dash_frames_differ = f1 != f2
            if page.evaluate("window.__game.snapshot().dashT > 0"):
                page.screenshot(path=os.path.join(SHOTS, "task10-dash.png"))
                dash_shot = True
        if page.evaluate("window.__game.snapshot().state") != "playing":
            break
        page.wait_for_timeout(50)
    d1 = page.evaluate("window.__game.snapshot().dist")
    ok("dist grows", d1 > d0 + 20, "d0=%.0f d1=%.0f" % (d0, d1))
    ok("dash fired", saw_dash)
    ok("dash frames differ", dash_frames_differ)
    ok("dash screenshot", dash_shot)

    if page.evaluate("window.__game.snapshot().state") == "playing":
        page.screenshot(path=os.path.join(SHOTS, "task10-play.png"))
        ok("play screenshot", True)
        page.evaluate("window.__game.forceHit(); window.__game.forceHit(); window.__game.forceHit()")
    else:
        page.evaluate("window.__game.start()")
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(SHOTS, "task10-play.png"))
        ok("play screenshot", True)
        page.evaluate("window.__game.forceHit(); window.__game.forceHit(); window.__game.forceHit()")
    page.wait_for_timeout(250)
    st = page.evaluate("window.__game.snapshot().state")
    ok("capsized state", st == "capsized", st)
    page.screenshot(path=os.path.join(SHOTS, "task10-capsize.png"))
    page.wait_for_timeout(1800)
    ok("result view active", page.evaluate("document.getElementById('view-result').classList.contains('is-active')"))
    page.screenshot(path=os.path.join(SHOTS, "task10-result.png"))

    page.click("#btn-again")
    page.wait_for_timeout(300)
    s = page.evaluate("window.__game.snapshot()")
    ok("again -> playing fresh", s["state"] == "playing" and s["dist"] < 5 and s["steady"] == 3 and s["gauge"] == 0,
       json.dumps({k: s[k] for k in ("state", "dist", "steady", "gauge")}))

    page.evaluate("window.LZGame.pause()")
    page.wait_for_timeout(150)
    paused_mask = page.evaluate("document.getElementById('pause-mask').classList.contains('is-on')")
    paused_state = page.evaluate("window.__game.snapshot().state") == "paused"
    page.evaluate("window.LZGame.resume()")
    page.wait_for_timeout(150)
    resumed = page.evaluate("window.__game.snapshot().state") == "playing"
    ok("pause/resume", paused_mask and paused_state and resumed)

    page.evaluate("window.__ui.showCodex('home')")
    page.wait_for_timeout(150)
    codex_open = page.evaluate("document.getElementById('view-codex').classList.contains('is-active')")
    page.click("#btn-codex-back")
    page.wait_for_timeout(150)
    codex_closed = page.evaluate("document.getElementById('view-home').classList.contains('is-active')")
    ok("codex open/close", codex_open and codex_closed)

    page.evaluate("window.__game.forceHit(); window.__game.forceHit(); window.__game.forceHit()")
    page.wait_for_timeout(2000)
    n_dialog_before = len(dialogs)
    page.click("#btn-post-note")
    page.wait_for_timeout(300)
    ok("share fallback dialog fires once", len(dialogs) == n_dialog_before + 1, str(dialogs))

    ok("no console errors/pageerrors", len(errors) == 0, "; ".join(errors[:5]))

    page.evaluate("localStorage.clear()")
    browser.close()

fails = [r for r in results if not r[1]]
print("\n%d/%d passed" % (len(results) - len(fails), len(results)))
sys.exit(1 if fails else 0)
