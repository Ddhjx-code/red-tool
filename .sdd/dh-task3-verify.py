import os, sys
from playwright.sync_api import sync_playwright

ROOT = "/Users/duanchao.wzj/AI/workspace/red-tool"
URL = "file://" + ROOT + "/tools/dunhuang/index.html?test=1"
SHOTS = os.path.join(ROOT, ".sdd", "shots")
os.makedirs(SHOTS, exist_ok=True)

errors = []
results = []

def check(name, ok, extra=""):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + ((" | " + str(extra)) if extra != "" else ""))

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(300)

    def d2c(x, y):
        return page.evaluate("([x, y]) => DHMural.designToCanvas(x, y)", [x, y])

    def tap_pt(x, y):
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.up()

    def wipe(x0, y0, x1, y1, steps=14):
        page.mouse.move(x0, y0)
        page.mouse.down()
        page.mouse.move(x1, y1, steps=steps)
        page.mouse.up()

    def toast_text():
        return page.evaluate("document.getElementById('extract-toast').textContent")

    page.click("#btn-start")
    page.wait_for_timeout(150)
    cards = page.query_selector_all(".mural-card")
    check("2. select view shows 3 mural cards", len(cards) == 3, len(cards))
    blanks = 0
    for idx in range(len(cards)):
        nz = page.evaluate("""(i) => {
            const cv = document.querySelectorAll('.mural-thumb')[i];
            const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
            let n = 0;
            for (let k = 3; k < d.length; k += 4) if (d[k] > 0) n++;
            return n;
        }""", idx)
        if nz < 100:
            blanks += 1
    check("2. thumbnails non-blank", blanks == 0)

    page.evaluate("window.__alldone = 0; DHExtract.setCallback('alldone', function () { window.__alldone++; });")

    page.click(".mural-card:nth-child(3)")
    page.wait_for_timeout(250)
    check("3. extract view active", page.evaluate("document.getElementById('view-extract').classList.contains('is-active')"))
    cw = page.evaluate("document.getElementById('mural-canvas').width")
    check("3. mural canvas backing sized (390*dpr=780)", cw == 780, cw)

    g = d2c(50, 50)
    wipe(g["x"] - 26, g["y"], g["x"] + 26, g["y"], 12)
    page.wait_for_timeout(200)
    tap_pt(g["x"], g["y"])
    page.wait_for_timeout(120)
    check("4. jin unlocked", page.evaluate("DHSave.load().codex.indexOf('jin') >= 0"))
    check("4. toast contains 发现隐藏色", "发现隐藏色" in toast_text(), toast_text())
    check("4. flying anim queued", page.evaluate("DHExtract.snapshot().anims") >= 1)
    gold = page.evaluate("""(() => {
        const dots = document.querySelectorAll('#palette-bar .palette-dot');
        for (const d of dots) if (getComputedStyle(d).backgroundColor === 'rgb(201, 162, 39)') return true;
        return false;
    })()""")
    check("4. palette bar shows gold dot", gold)
    page.wait_for_timeout(2200)

    q = d2c(6, 6)
    tap_pt(q["x"], q["y"])
    page.wait_for_timeout(120)
    check("5. qingshi unlocked", page.evaluate("DHSave.load().codex.indexOf('qingshi') >= 0"))
    check("5. toast contains 石青", "石青" in toast_text(), toast_text())
    page.wait_for_timeout(2200)

    s = d2c(35, 35)
    tap_pt(s["x"], s["y"])
    page.wait_for_timeout(120)
    check("6. dust gate toast", "拂去浮尘" in toast_text(), toast_text())
    check("6. shilv NOT unlocked", page.evaluate("DHSave.load().codex.indexOf('shilv') < 0"))
    page.wait_for_timeout(2200)

    prog = 0
    for row in range(9):
        dy = 34 + row * 4
        a = d2c(30, dy)
        b = d2c(70, dy)
        wipe(a["x"], a["y"], b["x"], b["y"], 12)
        prog = page.evaluate("DHMural.dustProgress('shilv')")
        if prog >= 0.97:
            break
    check("7. dustProgress >= 0.85", prog >= 0.85, round(prog, 3))
    page.wait_for_timeout(500)
    check("7. shilv auto-unlocked", page.evaluate("DHSave.load().codex.indexOf('shilv') >= 0"))
    check("7. toast contains 拂尘见色", "拂尘见色" in toast_text(), toast_text())
    page.wait_for_timeout(2200)

    t1 = d2c(50, 15)
    tap_pt(t1["x"], t1["y"])
    page.wait_for_timeout(150)
    t2 = d2c(50, 30)
    tap_pt(t2["x"], t2["y"])
    page.wait_for_timeout(150)
    page.screenshot(path=os.path.join(SHOTS, "dh3-extract.png"))
    t3 = d2c(45, 45)
    tap_pt(t3["x"], t3["y"])
    page.wait_for_timeout(400)
    check("8. alldone callback fired", page.evaluate("window.__alldone") == 1)
    check("8. codex count == 6", page.evaluate("DHSave.load().codex.length") == 6)
    seen_done = False
    for _ in range(40):
        if "此壁画颜色拾尽" in toast_text():
            seen_done = True
            break
        page.wait_for_timeout(300)
    check("8. alldone toast", seen_done)

    page.click("#btn-codex-extract")
    page.wait_for_timeout(150)
    cnt = page.evaluate("document.getElementById('codex-count').textContent")
    check("9. codex count 6/18", cnt == "6/18", cnt)
    unlocked = page.evaluate("document.querySelectorAll('#codex-grid .codex-cell:not(.is-locked)').length")
    locked = page.evaluate("document.querySelectorAll('#codex-grid .codex-cell.is-locked').length")
    check("9. 6 unlocked / 12 locked", unlocked == 6 and locked == 12, "%s/%s" % (unlocked, locked))
    sw = page.evaluate("""(() => {
        const cv = document.querySelector('#codex-grid .codex-cell:not(.is-locked) canvas');
        const d = cv.getContext('2d').getImageData(0, 0, 120, 120).data;
        let n = 0;
        for (let k = 3; k < d.length; k += 4) if (d[k] > 0) n++;
        return n;
    })()""")
    check("9. unlocked cell swatch painted", sw > 500, sw)
    page.screenshot(path=os.path.join(SHOTS, "dh3-codex.png"))
    page.click("#codex-grid .codex-cell:not(.is-locked)")
    page.wait_for_timeout(100)
    card_on = page.evaluate("document.getElementById('codex-card').classList.contains('is-on')")
    name = page.evaluate("document.getElementById('codex-card-name').textContent")
    text = page.evaluate("document.getElementById('codex-card-text').textContent")
    check("9. detail card shows name+hex+text", card_on and len(name) > 0 and len(text) > 0 and "#" in name, name)
    page.click("#codex-card-close")
    page.wait_for_timeout(80)
    page.click("#btn-codex-back")
    page.wait_for_timeout(250)
    check("9. back returns to extract", page.evaluate("document.getElementById('view-extract').classList.contains('is-active')"))

    page.reload()
    page.wait_for_timeout(300)
    hp = page.evaluate("document.getElementById('home-progress').textContent")
    check("10. home progress after reload", "已集 6/18 色" in hp, hp)
    page.click("#btn-codex-home")
    page.wait_for_timeout(120)
    cnt2 = page.evaluate("document.getElementById('codex-count').textContent")
    check("10. codex persists 6/18", cnt2 == "6/18", cnt2)
    page.click("#btn-codex-back")
    page.wait_for_timeout(80)

    page2 = browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=2)
    page2.on("pageerror", lambda e: errors.append(str(e)))
    page2.goto(URL)
    page2.wait_for_timeout(200)
    page2.click("#btn-start")
    page2.wait_for_timeout(150)
    page2.click(".mural-card:nth-child(1)")
    page2.wait_for_timeout(300)
    mw = page2.evaluate("DHMural.metrics().W")
    check("carryover: resize after view activation (430 viewport)", mw == 430, mw)
    page2.close()

    check("1. no pageerrors", len(errors) == 0, "; ".join(errors[:3]))

    page.evaluate("localStorage.clear()")
    browser.close()

passed = sum(results)
print("\n%d/%d checks passed" % (passed, len(results)))
sys.exit(0 if passed == len(results) else 1)
