import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = "/Users/duanchao.wzj/AI/workspace/red-tool"
URL = "file://" + ROOT + "/tools/dunhuang/index.html?test=1"
SHOT = ROOT + "/.sdd/shots/dh1-zaojing.png"
os.makedirs(os.path.dirname(SHOT), exist_ok=True)

errors = []
pageerrors = []
console_msgs = []

def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: pageerrors.append(str(e)))
    page.on("console", lambda m: console_msgs.append((m.type, m.text)))
    page.goto(URL)
    page.wait_for_timeout(600)

    # 6. DHData integrity
    data = page.evaluate("""() => {
        var D = window.DHData;
        return {
            colors: D.COLORS.length, titles: D.TITLES.length, facts: D.FACTS.length,
            murals: D.MURALS.length,
            bad: D.COLORS.filter(function(c){return !c.id||!c.name||!c.hex||!c.text;}).length,
            dustDone: D.DUST_DONE, brushR: D.BRUSH_R,
            zaojing: D.SHAPES.zaojing.length, feitian: D.SHAPES.feitian.length, jiuse: D.SHAPES.jiuse.length
        };
    }""")
    assert data["colors"] == 18, data
    assert data["titles"] == 5 and data["facts"] == 5 and data["murals"] == 3, data
    assert data["bad"] == 0, data
    assert data["dustDone"] == 0.85 and data["brushR"] == 18, data
    assert data["zaojing"] == 6 and data["feitian"] == 0 and data["jiuse"] == 0, data
    print("DATA OK", json.dumps(data, ensure_ascii=False))

    # 2. screenshot
    page.screenshot(path=SHOT)
    print("SHOT OK", SHOT)

    # 4. hitTest
    hits = page.evaluate("""() => {
        function h(x, y) {
            var p = DHMural.designToCanvas(x, y);
            var s = DHMural.hitTest(p.x, p.y);
            return s ? { id: s.id, color: s.color } : null;
        }
        return { c: h(50,50), d: h(50,20), o: h(6,6) };
    }""")
    assert hits["c"] and hits["c"]["color"] == "jin", hits
    assert hits["d"] and hits["d"]["color"] == "zhusha", hits
    assert hits["o"] and hits["o"]["color"] == "qingshi", hits
    print("HIT OK", json.dumps(hits))

    # 5. dustAt 20 strokes across shilv -> dustProgress > 0
    dust = page.evaluate("""() => {
        var a = DHMural.designToCanvas(32, 32), b = DHMural.designToCanvas(68, 68);
        var before = DHMural.dustProgress('shilv');
        for (var i = 0; i < 20; i++) {
            var t = i / 19;
            DHMural.dustAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * ((i % 5) / 4));
        }
        return { before: before, after: DHMural.dustProgress('shilv') };
    }""")
    assert dust["before"] < 0.05, dust
    assert dust["after"] > 0, dust
    print("DUST OK", json.dumps(dust))

    page.evaluate("""() => { DHMural.load('zaojing'); DHMural.draw(0.016); }""")

    # 3. pixel sampling at visible region of each layer
    # brush dust off each sample point first (dust layer covers the shilv bbox)
    page.evaluate("""() => {
        var pts = [[35,35],[44,44],[50,50]];
        for (var k = 0; k < pts.length; k++) {
            var p = DHMural.designToCanvas(pts[k][0], pts[k][1]);
            for (var i = 0; i < 6; i++) DHMural.dustAt(p.x + (i % 3) * 3 - 3, p.y + Math.floor(i / 3) * 3 - 1);
        }
        DHMural.draw(0.016);
    }""")
    samples = page.evaluate("""() => {
        var canvas = document.getElementById('mural-canvas');
        var rect = canvas.getBoundingClientRect();
        var kx = canvas.width / rect.width, ky = canvas.height / rect.height;
        var gl = canvas.getContext('2d');
        var pts = { qingshi:[50,4], zhusha:[50,20], shilv:[35,35], cihuang:[50,30], zheshi:[44,44], jin:[50,50] };
        var out = {};
        for (var k in pts) {
            var p = DHMural.designToCanvas(pts[k][0], pts[k][1]);
            var d = gl.getImageData(Math.round(p.x * kx), Math.round(p.y * ky), 1, 1).data;
            out[k] = [d[0], d[1], d[2]];
        }
        return out;
    }""")
    expected = {"qingshi": "#2F5D9E", "zhusha": "#B83A2E", "shilv": "#45897A",
                "cihuang": "#D9A441", "zheshi": "#9C5B3C", "jin": "#C9A227"}
    for k, hx in expected.items():
        er, eg, eb = hex2rgb(hx)
        r, g, b = samples[k]
        assert abs(r-er) <= 30 and abs(g-eg) <= 30 and abs(b-eb) <= 30, (k, samples[k], hx)
    print("PIXEL OK", json.dumps(samples))

    page.wait_for_timeout(200)
    page.screenshot(path=SHOT.replace(".png", "-dusted.png"))
    browser.close()

real_errors = [e for e in pageerrors]
assert not real_errors, real_errors
console_errors = [m for m in console_msgs if m[0] == "error" and "Failed to load resource" not in m[1]]
missing = [m for m in console_msgs if m[0] == "error" and "Failed to load resource" in m[1]]
assert len(missing) == 3, missing
assert not console_errors, console_errors
print("NO PAGEERRORS OK")
print("DH1 VERIFY PASS")
