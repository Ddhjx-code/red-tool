import json
from playwright.sync_api import sync_playwright

URL = "file:///Users/duanchao.wzj/AI/workspace/red-tool/tools/qiqiao/index.html"
SHOT = "/Users/duanchao.wzj/AI/workspace/red-tool/.sdd/shots/qq2-scene.png"

results = []
def check(name, cond, extra=""):
    results.append({"name": name, "pass": bool(cond), "extra": str(extra)})
    print(("PASS" if cond else "FAIL"), "-", name, ("" if not extra else ":: " + str(extra)))

def px(page, x, y):
    return page.evaluate("""(p) => {
        var c = document.getElementById('stage');
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var d = c.getContext('2d').getImageData(Math.round(p.x*dpr), Math.round(p.y*dpr), 1, 1).data;
        return [d[0], d[1], d[2]];
    }""", {"x": x, "y": y})

def region_diff(page, rect):
    return page.evaluate("""(r) => {
        var c = document.getElementById('stage');
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var d = c.getContext('2d').getImageData(Math.round(r.x*dpr), Math.round(r.y*dpr), Math.round(r.w*dpr), Math.round(r.h*dpr)).data;
        var out = new Array(d.length);
        for (var i=0;i<d.length;i++) out[i]=d[i];
        window.__cap = window.__cap || {};
        if (!window.__cap[r.key]) { window.__cap[r.key] = out; return -1; }
        var prev = window.__cap[r.key], changed = 0;
        for (var i=0;i<d.length;i+=4) {
            var e = Math.abs(d[i]-prev[i]) + Math.abs(d[i+1]-prev[i+1]) + Math.abs(d[i+2]-prev[i+2]);
            if (e > 15) changed++;
        }
        return changed;
    }""", rect)

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    perrors, console_errs = [], []
    page.on("pageerror", lambda e: perrors.append(str(e)))
    page.on("console", lambda m: console_errs.append(m.text) if m.type == "error" else None)
    page.goto(URL)
    page.wait_for_function("window.QQScene && document.getElementById('view-ceremony').classList.contains('is-active')")
    page.wait_for_timeout(600)

    check("T1 no pageerrors", len(perrors) == 0, json.dumps(perrors))
    non404 = [t for t in console_errs if "404" not in t and "Failed to load resource" not in t]
    check("T1b console errors only 404s", len(non404) == 0, json.dumps(non404[:3]))

    m = page.evaluate("QQScene.metrics()")
    check("T2a basinY~0.62*844", abs(m["basinY"] - 0.62 * 844) < 2, m["basinY"])
    check("T2b basinRx~0.36*390", abs(m["basinRx"] - 0.36 * 390) < 2, m["basinRx"])
    check("T2c u/cx/basinRy", abs(m["u"] - 390/400) < 0.01 and abs(m["cx"] - 195) < 1 and abs(m["basinRy"] - m["basinRx"]*0.42) < 0.5,
          "u=%.3f cx=%.1f ry=%.1f" % (m["u"], m["cx"], m["basinRy"]))

    sky = px(page, 195, 10)
    check("T3a top-center dark indigo", sky[2] > sky[0] and max(sky) < 120, sky)
    moon = px(page, 0.72 * 390, 0.16 * 844)
    check("T3b moon bright", sum(moon) / 3 > 180, moon)
    water = px(page, 195, m["basinY"])
    check("T3c basin center teal-ish", abs(water[0]-60) < 18 and abs(water[1]-84) < 18 and abs(water[2]-104) < 18, water)
    outside = px(page, 195, m["basinY"] + m["basinRy"] + 18)
    dist = sum(abs(a - b) for a, b in zip(outside, water))
    check("T3d outside rim is sky != water", dist > 30, "outside=%s water=%s dist=%d" % (outside, water, dist))

    page.evaluate("QQScene.ripple(1)")
    page.wait_for_timeout(120)
    region_diff(page, {"key": "w1", "x": 195 - 110, "y": m["basinY"] - 45, "w": 220, "h": 90})
    region_diff(page, {"key": "s1", "x": 0, "y": 0, "w": 390, "h": 300})
    page.wait_for_timeout(400)
    wd = region_diff(page, {"key": "w1", "x": 195 - 110, "y": m["basinY"] - 45, "w": 220, "h": 90})
    sd = region_diff(page, {"key": "s1", "x": 0, "y": 0, "w": 390, "h": 300})
    check("T4a water region differs (ripple)", wd > 100, "changed px=%d" % wd)
    check("T4b upper region differs (twinkle/clouds)", sd > 5, "changed px=%d" % sd)

    page.evaluate("QQScene.ripple(1)")
    page.wait_for_timeout(350)
    page.screenshot(path=SHOT)
    print("screenshot saved:", SHOT)

    band = page.evaluate("""() => {
        var m = QQScene.metrics();
        var c = document.getElementById('stage');
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var g = c.getContext('2d');
        var xs = {
            sky_out: m.cx - m.basinRx - 14,
            rim: m.cx - m.basinRx + 3,
            rim_inner: m.cx - m.basinRx + 8 * m.u,
            water_edge: m.cx - m.basinRx + 14 * m.u,
            water_mid: m.cx - m.basinRx * 0.5,
            center: m.cx
        };
        var out = {};
        for (var k in xs) {
            var d = g.getImageData(Math.round(xs[k]*dpr), Math.round(m.basinY*dpr), 1, 1).data;
            out[k] = [d[0], d[1], d[2]];
        }
        return out;
    }""")
    print("T6 horizontal band at basinY:", json.dumps(band))
    rim_b = sum(band["rim"]) / 3
    water_b = sum(band["water_mid"]) / 3
    sky_b = sum(band["sky_out"]) / 3
    check("T6 layering rim>water>sky brightness", rim_b > water_b > sky_b,
          "rim=%.0f water=%.0f sky=%.0f" % (rim_b, water_b, sky_b))

    browser.close()

fails = [r for r in results if not r["pass"]]
print("\n%d/%d passed" % (len(results) - len(fails), len(results)))
