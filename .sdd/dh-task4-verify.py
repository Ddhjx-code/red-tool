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

UNLOCK = ["qingshi", "shilv", "zhusha", "cihuang", "zheshi", "qianbai"]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(300)

    page.evaluate("(ids) => { ids.forEach(function (id) { DHSave.unlock(id); }); }", UNLOCK)

    page.evaluate("""() => {
        window.__loadImg = function (url) {
            return new Promise(function (res, rej) {
                var img = new Image();
                img.onload = function () { res(img); };
                img.onerror = rej;
                img.src = url;
            });
        };
        window.__cardCanvas = function (url) {
            return window.__loadImg(url).then(function (img) {
                var cv = document.createElement('canvas');
                cv.width = img.width; cv.height = img.height;
                cv.getContext('2d').drawImage(img, 0, 0);
                return cv;
            });
        };
        window.__px = function (url, x, y) {
            return window.__cardCanvas(url).then(function (cv) {
                var d = cv.getContext('2d').getImageData(x, y, 1, 1).data;
                return [d[0], d[1], d[2], cv.width, cv.height];
            });
        };
        window.__near = function (px, hex, tol) {
            var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
            return Math.abs(px[0] - r) <= tol && Math.abs(px[1] - g) <= tol && Math.abs(px[2] - b) <= tol;
        };
        window.__hasNear = function (url, x0, y0, x1, y1, hex, tol, step) {
            return window.__cardCanvas(url).then(function (cv) {
                var g = cv.getContext('2d');
                var r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
                for (var y = y0; y <= y1; y += step) {
                    var d = g.getImageData(x0, y, x1 - x0 + 1, 1).data;
                    for (var x = 0; x < d.length; x += 4) {
                        if (Math.abs(d[x] - r) <= tol && Math.abs(d[x + 1] - gg) <= tol && Math.abs(d[x + 2] - b) <= tol) return true;
                    }
                }
                return false;
            });
        };
        window.__paintTest = function (layout, bg) {
            var colors = DHExtract.palette().map(function (id) {
                var c = DHData.COLORS.find(function (x) { return x.id === id; });
                return { name: c.name, hex: c.hex };
            });
            return DHCard.paint({ colors: colors, layout: layout, bg: bg, title: DHData.TITLES[0], source: "莫高窟 · 飞天 · 盛唐" });
        };
    }""")

    combos = page.evaluate("""async () => {
        var out = [], layouts = ['scroll', 'zaojing'], bgs = ['paper', 'silk', 'night'];
        for (var i = 0; i < layouts.length; i++) {
            for (var j = 0; j < bgs.length; j++) {
                var url = window.__paintTest(layouts[i], bgs[j]);
                var img = await window.__loadImg(url);
                out.push({ png: url.indexOf('data:image/png') === 0, w: img.width, h: img.height });
            }
        }
        return out;
    }""")
    ok2 = len(combos) == 6 and all(c["png"] and c["w"] == 900 and c["h"] == 1200 for c in combos)
    check("2. all 6 layout*bg combos -> png dataURL 900x1200", ok2, combos)

    url_scroll_paper = page.evaluate("window.__paintTest('scroll', 'paper')")
    url_zaojing_paper = page.evaluate("window.__paintTest('zaojing', 'paper')")
    url_silk = page.evaluate("window.__paintTest('scroll', 'silk')")
    url_night = page.evaluate("window.__paintTest('scroll', 'night')")

    px = page.evaluate("(u) => window.__px(u, 3, 3)", url_scroll_paper)
    check("3. paper corner ~= #F5F0E6", page.evaluate("(px) => window.__near(px, '#F5F0E6', 20)", px), px[:3])
    px = page.evaluate("(u) => window.__px(u, 3, 3)", url_silk)
    check("3. silk corner ~= #EFE6D2", page.evaluate("(px) => window.__near(px, '#EFE6D2', 20)", px), px[:3])
    px = page.evaluate("(u) => window.__px(u, 3, 3)", url_night)
    check("3. night corner ~= #2E3D52", page.evaluate("(px) => window.__near(px, '#2E3D52', 20)", px), px[:3])

    px = page.evaluate("(u) => window.__px(u, 116, 550)", url_scroll_paper)
    check("3. scroll band sample ~= 石青 #2F5D9E", page.evaluate("(px) => window.__near(px, '#2F5D9E', 30)", px), px[:3])
    px = page.evaluate("(u) => window.__px(u, 450, 600)", url_zaojing_paper)
    check("3. zaojing center circle ~= 6th color #E5DCC8", page.evaluate("(px) => window.__near(px, '#E5DCC8', 30)", px), px[:3])
    px = page.evaluate("(u) => window.__px(u, 200, 350)", url_zaojing_paper)
    check("3. zaojing outer square ~= 1st color #2F5D9E", page.evaluate("(px) => window.__near(px, '#2F5D9E', 30)", px), px[:3])

    seal1 = page.evaluate("(u) => window.__hasNear(u, 370, 980, 530, 1150, '#C3272B', 35, 3)", url_scroll_paper)
    seal2 = page.evaluate("(u) => window.__hasNear(u, 150, 1010, 750, 1150, '#C3272B', 35, 3)", url_zaojing_paper)
    check("4. seal red present (scroll)", seal1)
    check("4. seal red present (zaojing)", seal2)

    page.evaluate("document.getElementById('btn-build').click()")
    page.wait_for_timeout(300)
    check("5. build view active", page.evaluate("document.getElementById('view-build').classList.contains('is-active')"))
    nchips = page.evaluate("document.querySelectorAll('#color-chips .color-chip').length")
    check("5. chip count == unlocked (6)", nchips == 6, nchips)
    check("5. default selection = first 5", page.evaluate("document.querySelectorAll('#color-chips .color-chip.is-on').length") == 5)
    page.click("#color-chips .color-chip:nth-child(6)")
    page.wait_for_timeout(200)
    sel = page.evaluate("window.__game.buildSel.colors")
    check("5. toggling chip adds to buildSel.colors", len(sel) == 6 and "qianbai" in sel, sel)
    page.click("#color-chips .color-chip:nth-child(6)")
    page.wait_for_timeout(200)
    check("5. toggling again removes", page.evaluate("window.__game.buildSel.colors.length") == 5)

    def preview_frame():
        return page.evaluate("document.getElementById('build-preview').toDataURL()")

    f0 = preview_frame()
    page.click("#layout-opts .opt-pill:nth-child(2)")
    page.wait_for_timeout(300)
    f1 = preview_frame()
    check("5. layout switch re-renders preview", f0 != f1 and page.evaluate("window.__game.buildSel.layout") == "zaojing")
    page.click("#bg-opts .opt-pill:nth-child(3)")
    page.wait_for_timeout(300)
    f2 = preview_frame()
    check("5. bg switch re-renders preview", f1 != f2 and page.evaluate("window.__game.buildSel.bg") == "night")
    page.click("#title-opts .opt-pill:nth-child(2)")
    page.wait_for_timeout(300)
    f3 = preview_frame()
    check("5. title switch re-renders preview", f2 != f3 and page.evaluate("window.__game.buildSel.title") == "飞天遗色")

    page.click("#layout-opts .opt-pill:nth-child(1)")
    page.click("#bg-opts .opt-pill:nth-child(1)")
    page.wait_for_timeout(300)
    page.screenshot(path=os.path.join(SHOTS, "dh4-build.png"))

    page.click("#color-chips .color-chip:nth-child(5)")
    page.click("#color-chips .color-chip:nth-child(4)")
    page.wait_for_timeout(150)
    check("6. deselected down to 3", page.evaluate("window.__game.buildSel.colors.length") == 3)
    page.click("#color-chips .color-chip:nth-child(1)")
    page.wait_for_timeout(150)
    check("6. min-3 enforced", page.evaluate("window.__game.buildSel.colors.length") == 3)

    page.evaluate("document.getElementById('btn-make-card').click()")
    page.wait_for_timeout(350)
    check("7. result view active", page.evaluate("document.getElementById('view-result').classList.contains('is-active')"))
    check("7. DHLastBuild set", page.evaluate("!!window.DHLastBuild && window.DHLastBuild.colors.length === 3 && !!window.DHLastBuild.layout"))
    nz = page.evaluate("""(() => {
        const cv = document.getElementById('result-card');
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let n = 0;
        for (let k = 3; k < d.length; k += 4) if (d[k] > 0) n++;
        return n;
    })()""")
    check("7. result-card non-blank", nz > 10000, nz)

    card_page = browser.new_page(viewport={"width": 900, "height": 1200})
    card_page.on("pageerror", lambda e: errors.append(str(e)))
    card_page.goto("about:blank")
    for layout, fname in [("scroll", "dh4-card-scroll.png"), ("zaojing", "dh4-card-zaojing.png")]:
        url = page.evaluate("(l) => window.__paintTest(l, 'paper')", layout)
        card_page.evaluate("""(url) => {
            document.body.style.margin = '0';
            document.body.innerHTML = '';
            var img = document.createElement('img');
            img.id = 'shot';
            img.style.display = 'block';
            document.body.appendChild(img);
            img.src = url;
            return new Promise(function (res) { img.onload = res; });
        }""", url)
        card_page.wait_for_timeout(100)
        card_page.locator("#shot").screenshot(path=os.path.join(SHOTS, fname))
    check("8. card screenshots saved",
          os.path.exists(os.path.join(SHOTS, "dh4-card-scroll.png")) and os.path.exists(os.path.join(SHOTS, "dh4-card-zaojing.png")))
    card_page.close()

    real_errors = [e for e in errors if "audio" not in e.lower() and "404" not in e]
    check("1. no pageerrors", len(real_errors) == 0, "; ".join(real_errors[:3]))

    page.evaluate("localStorage.clear()")
    browser.close()

passed = sum(results)
print("\n%d/%d checks passed" % (passed, len(results)))
sys.exit(0 if passed == len(results) else 1)
