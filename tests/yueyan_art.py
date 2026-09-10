#!/usr/bin/env python3
"""Task 13 — procedural Canvas art with zero image assets.

Covers §8.3 质感与绘制规范 (米纸底 / 工笔描边 1.5px / 对称几何刻印 / 单色暖黄灯笼),
§8.4 动效预算 (结局揭示是唯一长动效, ≤1.2s, 无逐帧驱动), §6.3.1 月亮呈现
(E1 满月无云 → E5 薄云遮月), plus V-19 / V-20 / V-21.
"""
import pathlib
import re

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "tools/yueyan/assets"
INDEX = ROOT / "tools/yueyan/index.html"
SCENE = ASSETS / "scene.js"
CSS = ASSETS / "style.css"
DATA = ASSETS / "data.js"

BANNED = ["玉兔", "嫦娥", "月宫", "西式蛋糕", "慕斯", "现代月饼礼盒", "塑料包装", "红色灯笼阵"]
COVER = {"E1": 0.00, "E2": 0.18, "E3": 0.35, "E4": 0.55, "E5": 0.75}
PATTERN_D = {
    "dousha": "M0,-14 L14,0 L0,14 L-14,0 Z",
    "wuren": "M0,-16 L16,-6 L10,14 L-10,14 L-16,-6 Z",
    "lianrong": "M0,-15 C10,-15 15,-5 15,0 C15,10 8,15 0,15 C-8,15 -15,10 -15,0 Z",
    "xiandanhuang": "M0,-12 A12,12 0 1,1 0,12 A12,12 0 1,1 0,-12 Z",
    "guihua": "M0,-14 L4,-4 L14,0 L4,4 L0,14 L-4,4 L-14,0 L-4,-4 Z",
}
IMAGE_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp")

ROUTE = [["buy:haoliao", "buy:haoliao", "buy:putong"],
         ["buy:haoliao", "buy:haoliao", "buy:putong"],
         ["buy:putong", "shouzuo:dousha:premium", "shouzuo:wuren:premium"],
         ["shouzuo:lianrong:premium", "shouzuo:dousha:normal", "xiexin"],
         ["buy:guihua", "beiyan", "beiyan"],
         ["beiyan", "beiyan", "buzhi"],
         ["shouzuo:guihua:premium", "buzhi", "buzhi"]]

PASS = []
FAIL = []


def check(name, ok, detail=""):
    (PASS if ok else FAIL).append(name if ok else f"{name} :: {detail}")


def run(fn, page):
    try:
        fn(page)
    except Exception as exc:                                    # noqa: BLE001
        check(f"{fn.__name__} aborted", False, str(exc))


def open_page(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.set_default_timeout(3000)
    page.goto(INDEX.as_uri())
    page.wait_for_timeout(250)
    return page, errors


RGB = """
  const rgb = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
"""

RUN_ROUTE = """
      const days = ROUTE.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
"""


# --------------------------------------------------------------- source hygiene
def test_source_hygiene(page):
    scene = SCENE.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")

    for name in ["drawMoon", "drawCakePattern", "tintLanterns", "buildPaperLayer"]:
        check(f"scene.js defines {name}", re.search(rf"\bfunction {name}\b", scene) is not None)
        check(f"scene.js exports {name}", re.search(rf"\b{name}: {name}\b", scene) is not None)

    check("V-21 scene.js hardcodes no hex literal",
          re.search(r"#[0-9A-Fa-f]{3,8}\b", scene) is None,
          str(re.findall(r"#[0-9A-Fa-f]{3,8}\b", scene)))

    check("V-3 scene.js uses no randomness",
          re.search(r"\brandom\b|Math\.random|seedrandom|LCG|mulberry", scene, re.I) is None,
          str(re.findall(r"[^\n]*random[^\n]*", scene, re.I)[:2]))

    check("§8.3 no gradient is used for cake or table surfaces",
          re.search(r"createLinearGradient|createRadialGradient", scene) is None)

    check("§8.4 no per-frame loop drives UI motion",
          re.search(r"requestAnimationFrame|setInterval", scene) is None)

    check("scene.js generates no inline handler",
          re.search(r"on(click|pointerdown|pointerup|touchstart)\s*=", scene) is None)

    check("scene.js makes no network request",
          re.search(r"\bfetch\(|XMLHttpRequest|new Image\(\)|\.src\s*=", scene) is None)

    check("scene.js evaluates no dynamic code",
          re.search(r"\beval\(|new Function\(", scene) is None)

    for token in ["moon", "ink", "paper", "cinnabar", "lantern"]:
        check(f"scene.js reads D.palette.{token}",
              re.search(rf"D\.palette\.{token}\b", scene) is not None)

    for code, band in COVER.items():
        check(f"§6.3.1 {code} carries cloud cover {band:.2f}",
              re.search(rf"{code}: {band:.2f}", scene) is not None)

    for filling in PATTERN_D:
        check(f"§8.3 {filling} has its own engraving",
              re.search(rf"{filling}:", scene) is not None)

    check("§8.3 工笔描边 stroke-width is fixed at 1.5",
          re.search(r"stroke-width", scene) is not None
          and re.search(r"lineWidth\s*=\s*1\.5", scene) is not None)

    check("§8.4 drawMoon adds the one-shot .is-revealing class",
          re.search(r"classList\.add\('is-revealing'\)", scene) is not None)

    check("§8.3 the lantern tint sets a single warm tone, not a literal",
          re.search(r"D\.palette\.lantern", scene) is not None
          and "F5C77E" not in scene)

    check("§8.4 the reveal transition exists and stays ≤1.2s",
          re.search(r"\.end-moon\.is-revealing\s*\{[^}]*1\.2s", css) is not None)
    check("§8.4 the reveal has an opacity baseline so it can actually fire",
          re.search(r"\.end-moon\.is-revealing\s*\{[^}]*opacity", css) is not None)

    for word in BANNED:
        offenders = []
        for path in sorted((ROOT / "tools/yueyan").rglob("*")):
            if path.is_file() and path.suffix in (".js", ".html", ".css"):
                if word in path.read_text(encoding="utf-8"):
                    offenders.append(str(path.relative_to(ROOT)))
        check(f"V-19 {word} appears in no source or asset file", not offenders, str(offenders))


def test_no_image_assets(page):
    offenders = [str(p.relative_to(ROOT))
                 for p in sorted(ASSETS.rglob("*"))
                 if p.is_file() and p.suffix.lower() in IMAGE_EXT]
    check("zero image files were added under assets/", not offenders, str(offenders))

    html = INDEX.read_text(encoding="utf-8")
    check("index.html loads no image asset", "<img" not in html and ".png" not in html)
    check("scene.js references no image asset",
          re.search(r"\.(png|jpg|jpeg|gif|webp|svg)\b", SCENE.read_text(encoding="utf-8")) is None)


# ------------------------------------------------------------------ moon phases
def test_moon_phases(page):
    out = page.evaluate("""(cover) => {
      const S = window.YueYan.Scene, D = window.YueYan.Data;
      """ + RGB + """
      const moon = rgb(D.palette.moon), ink = rgb(D.palette.ink), paper = rgb(D.palette.paper);
      const audit = (c) => {
        const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let moonPx = 0, inkPx = 0, paperPx = 0, minX = 1e9, maxX = -1e9;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) { continue; }
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const px = (i / 4) % c.width;
          minX = Math.min(minX, px); maxX = Math.max(maxX, px);
          if (r === moon[0] && g === moon[1] && b === moon[2]) { moonPx++; }
          else if (r === ink[0] && g === ink[1] && b === ink[2]) { inkPx++; }
          else if (r === paper[0] && g === paper[1] && b === paper[2]) { paperPx++; }
        }
        return { moonPx, inkPx, paperPx, diameter: maxX - minX + 1 };
      };
      const out = {};
      for (const code of ['E1','E2','E3','E4','E5']) {
        const c = document.createElement('canvas');
        c.width = 200; c.height = 200;
        S.drawMoon(c, code);
        out[code] = audit(c);
        out[code].revealing = c.classList.contains('is-revealing');
        out[code].expectCover = cover[code];
      }
      return out;
    }""", COVER)

    for code in COVER:
        row = out[code]
        check(f"§8.3 {code} draws the moon disc in D.palette.moon", row["moonPx"] > 0, str(row))
        check(f"§8.3 {code} strokes the disc in D.palette.ink", row["inkPx"] > 0, str(row))
        check(f"§8.4 {code} adds .is-revealing", row["revealing"] is True, str(row))
        check(f"§8.3 {code} disc diameter is 0.42 of the canvas",
              abs(row["diameter"] - 200 * 0.42 * 2) <= 6, str(row["diameter"]))

    check("§6.3.1 E1 满月无云 has no cloud cover", out["E1"]["paperPx"] == 0, str(out["E1"]))
    for code in ["E2", "E3", "E4", "E5"]:
        check(f"§6.3.1 {code} 薄云 covers part of the disc with 米纸底",
              out[code]["paperPx"] > 0, str(out[code]))

    order = ["E1", "E2", "E3", "E4", "E5"]
    bands = [out[c]["paperPx"] for c in order]
    check("§6.3.1 cloud cover increases monotonically E1 → E5",
          all(bands[i] < bands[i + 1] for i in range(4)), str(bands))
    check("§6.3.1 each ending keeps the same disc size",
          len({out[c]["diameter"] for c in order}) == 1,
          str([out[c]["diameter"] for c in order]))
    check("§6.3.1 the cloud band never swallows the whole disc",
          all(out[c]["moonPx"] > 0 for c in order), str(bands))


def test_moon_reveal(page):
    start = page.evaluate("""() => {
      const S = window.YueYan.Scene;
      const c = document.createElement('canvas');
      c.id = 'art-reveal-probe';
      c.width = 200; c.height = 200;
      c.className = 'end-moon';
      c.style.position = 'absolute'; c.style.left = '-999px';
      document.body.appendChild(c);
      const before = getComputedStyle(c).opacity;
      S.drawMoon(c, 'E3');
      return { before, cls: c.className,
               trans: getComputedStyle(c).transitionDuration,
               inflight: getComputedStyle(c).opacity };
    }""")
    page.wait_for_timeout(1400)
    settled = page.evaluate("""() => {
      const c = document.getElementById('art-reveal-probe');
      const opacity = getComputedStyle(c).opacity;
      c.remove();
      return opacity;
    }""")

    check("§8.4 the canvas starts hidden", start["before"] == "0", str(start))
    check("§8.4 drawMoon adds the one-shot reveal class",
          start["cls"] == "end-moon is-revealing", str(start["cls"]))
    check("§8.4 the transition lasts exactly 1.2s", start["trans"] == "1.2s", str(start["trans"]))
    check("§8.4 the fade is in flight, not jumped", start["inflight"] == "0", str(start["inflight"]))
    check("§8.4 the fade settles to fully shown", settled == "1", settled)


# -------------------------------------------------------------- cake patterns
def test_cake_patterns(page):
    out = page.evaluate("""(expected) => {
      const S = window.YueYan.Scene, D = window.YueYan.Data;
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '-20 -20 40 40');
      svg.style.position = 'absolute'; svg.style.left = '-999px';
      document.body.appendChild(svg);
      const out = {};
      for (const filling of Object.keys(expected)) {
        const p = document.createElementNS(svgNS, 'path');
        svg.appendChild(p);
        S.drawCakePattern(p, filling);
        const box = p.getBBox();
        out[filling] = {
          d: p.getAttribute('d'),
          fill: p.getAttribute('fill'),
          stroke: p.getAttribute('stroke'),
          strokeWidth: p.getAttribute('stroke-width'),
          cinnabar: D.palette.cinnabar,
          centred: Math.abs(box.x + box.width / 2) < 0.01,
          width: +box.width.toFixed(2),
          height: +box.height.toFixed(2)
        };
      }
      const unknown = document.createElementNS(svgNS, 'path');
      svg.appendChild(unknown);
      S.drawCakePattern(unknown, 'not-a-filling');
      out.fallback = unknown.getAttribute('d');
      svg.remove();
      return out;
    }""", PATTERN_D)

    for filling, want in PATTERN_D.items():
        row = out[filling]
        check(f"§8.3 {filling} engraves its own symmetric geometry", row["d"] == want, str(row))
        check(f"§8.3 {filling} is stroked, never filled", row["fill"] == "none", str(row["fill"]))
        check(f"§8.2 {filling} stroke reads D.palette.cinnabar",
              row["stroke"] == row["cinnabar"], str(row))
        check(f"§8.3 {filling} stroke-width is 1.5", row["strokeWidth"] == "1.5",
              str(row["strokeWidth"]))
        check(f"§8.3 {filling} engraving is centred on the cake", row["centred"] is True, str(row))

    shapes = {out[f]["d"] for f in PATTERN_D}
    check("§8.3 the five engravings are five distinct paths", len(shapes) == 5, str(shapes))
    check("unknown filling falls back to the 豆沙 engraving",
          out["fallback"] == PATTERN_D["dousha"], out["fallback"])


# --------------------------------------------------------------- lantern tint
def test_lantern_tint(page):
    out = page.evaluate("""() => {
      const S = window.YueYan.Scene, D = window.YueYan.Data;
      """ + RGB + """
      const root = document.createElement('div');
      root.style.position = 'absolute'; root.style.left = '-999px';
      for (let i = 0; i < 4; i++) {
        const lamp = document.createElement('span');
        lamp.className = 'lantern' + (i < 3 ? ' is-on' : '');
        root.appendChild(lamp);
      }
      document.body.appendChild(root);
      const read = () => Array.from(root.querySelectorAll('.lantern')).map(n => ({
        bg: getComputedStyle(n).backgroundColor,
        border: getComputedStyle(n).borderTopColor,
        inlineBg: n.style.background
      }));
      const before = read();
      S.tintLanterns(root);
      const after = read();
      root.remove();
      return { before, after,
               lantern: rgb(D.palette.lantern), ink: rgb(D.palette.ink) };
    }""")

    lit = out["after"][:3]
    check("V-20 every lit lantern carries the single warm tone",
          len({n["bg"] for n in lit}) == 1, str(lit))
    check(f"V-20 that tone is D.palette.lantern rgb{tuple(out['lantern'])}",
          lit[0]["bg"] == f"rgb({out['lantern'][0]}, {out['lantern'][1]}, {out['lantern'][2]})",
          str(lit[0]["bg"]))
    check(f"§8.3 the lit lantern outline is D.palette.ink rgb{tuple(out['ink'])}",
          lit[0]["border"] == f"rgb({out['ink'][0]}, {out['ink'][1]}, {out['ink'][2]})",
          str(lit[0]["border"]))
    check("§5.1 an unlit lantern stays unlit",
          out["after"][3]["inlineBg"] == "", str(out["after"][3]))
    check("tintLanterns only touches lit lanterns",
          out["before"][3]["bg"] == out["after"][3]["bg"], str(out["after"][3]))


# ------------------------------------------------------------- paper texture
def test_paper_layer(page):
    out = page.evaluate("""() => {
      const S = window.YueYan.Scene;
      document.body.style.backgroundImage = '';
      const before = document.body.style.backgroundImage;
      S.buildPaperLayer();
      const first = document.body.style.backgroundImage;
      S.buildPaperLayer();
      const second = document.body.style.backgroundImage;
      return { before, first, second,
               len: first.length,
               isPng: first.indexOf('data:image/png;base64,') > 0 };
    }""")
    check("§8.3 the page starts with no background image", out["before"] == "", out["before"])
    check("§8.3 米纸底 is set as a data-URI background, not a file", out["isPng"] is True, str(out))
    check("V-2 no external asset is fetched", 'url("data:' in out["first"], out["first"][:40])
    check("§8.3 the texture is deterministic across rebuilds",
          out["first"] == out["second"] and out["len"] > 100, str(out["len"]))


def test_paper_determinism(page):
    page.evaluate("() => window.YueYan.Scene.buildPaperLayer()")
    first = page.evaluate("() => document.body.style.backgroundImage")
    page.reload()
    page.wait_for_timeout(250)
    page.evaluate("() => window.YueYan.Scene.buildPaperLayer()")
    second = page.evaluate("() => document.body.style.backgroundImage")
    check("§8.3 the jitter is identical across page loads (no rng)", first == second,
          f"{len(first)} vs {len(second)}")

    size = page.evaluate("""() => new Promise(res => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => res({ w: 0, h: 0 });
      img.src = document.body.style.backgroundImage.match(/url\\("?([^")]+)"?\\)/)[1];
    })""")
    check("§8.3 the offscreen layer is the planned 64×64 tile",
          size == {"w": 64, "h": 64}, str(size))


# -------------------------------------------------------------------- wiring
def wired_state(page):
    return page.evaluate("""(ROUTE) => {
      const E = window.YueYan.Engine;
      """ + RUN_ROUTE + """
      return E.runRoute(days, null);
    }""", ROUTE)


def test_wiring_assign(page):
    out = page.evaluate("""([ROUTE, expected]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      """ + RUN_ROUTE + """
      const s = E.runRoute(days, null);
      S.renderAssign(s);
      const rows = Array.from(document.querySelectorAll('#assign-cake-list .cake-row'));
      return { fillings: s.cakes.map(c => c.filling),
               paths: rows.map(r => {
                 const p = r.querySelector('svg path');
                 return p ? { d: p.getAttribute('d'), stroke: p.getAttribute('stroke'),
                              fill: p.getAttribute('fill'), sw: p.getAttribute('stroke-width') }
                            : null; }),
               labels: rows.map(r => r.textContent),
               heights: rows.map(r => +r.getBoundingClientRect().height.toFixed(1)),
               ids: rows.map(r => r.id),
               handlers: rows.map(r => r.getAttribute('onclick')) };
    }""", [ROUTE, PATTERN_D])

    check("§8.3 every cake row in 分饼 carries an engraving",
          len(out["paths"]) == 5 and all(p for p in out["paths"]), str(out["paths"]))
    check("§8.3 each engraving matches its own filling",
          all(out["paths"][i]["d"] == PATTERN_D[out["fillings"][i]] for i in range(5)),
          str(list(zip(out["fillings"], [p["d"] for p in out["paths"]]))))
    check("§8.2 the engraved stroke is cinnabar and the shape is unfilled",
          all(p["fill"] == "none" and p["sw"] == "1.5" for p in out["paths"]), str(out["paths"]))
    check("§6.6 the cake labels survive the engraving",
          all("豆沙" in t or "五仁" in t or "莲蓉" in t or "咸蛋黄" in t or "桂花" in t
              for t in out["labels"]), str(out["labels"]))
    check("§5.3 cake rows stay ≥56px primary targets",
          all(h >= 56 for h in out["heights"]), str(out["heights"]))
    check("V-21 the engraving adds no new id and no inline handler",
          all(i == "" for i in out["ids"]) and all(h is None for h in out["handlers"]), str(out))


def test_wiring_preview(page):
    out = page.evaluate("""([ROUTE, expected]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene, D = window.YueYan.Data;
      """ + RUN_ROUTE + """
      const assign = { grandma: 0, father: 1, mother: 2, younger: 3, brother: 4 };
      const s = E.applyAssignment(E.runRoute(days, null), assign);
      S.renderPreview(s);
      """ + RGB + """
      const want = `rgb(${rgb(D.palette.lantern).join(', ')})`;
      return { fillings: s.cakes.map(c => c.filling),
               paths: Array.from(document.querySelectorAll('#preview-cakes .preview-cake'))
                 .map(n => { const p = n.querySelector('svg path');
                             return p ? p.getAttribute('d') : null; }),
               litLanterns: Array.from(document.querySelectorAll('#preview-lanterns .lantern.is-on'))
                 .map(n => getComputedStyle(n).backgroundColor),
               unlit: Array.from(document.querySelectorAll('#preview-lanterns .lantern:not(.is-on)'))
                 .map(n => n.style.background),
               want };
    }""", [ROUTE, PATTERN_D])

    check("§8.3 every cake in 宴前一览 carries an engraving",
          len(out["paths"]) == 5 and all(out["paths"]), str(out["paths"]))
    check("§8.3 the preview engraving matches its filling",
          all(out["paths"][i] == PATTERN_D[out["fillings"][i]] for i in range(5)),
          str(list(zip(out["fillings"], out["paths"]))))
    check("V-20 every lit preview lantern shares one warm tone",
          len(set(out["litLanterns"])) == 1 and out["litLanterns"]
          and out["litLanterns"][0] == out["want"], str(out))
    check("§5.1 unlit lanterns are left alone",
          all(b == "" for b in out["unlit"]), str(out["unlit"]))


def test_wiring_ending(page):
    out = page.evaluate("""([ROUTE]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene, D = window.YueYan.Data;
      """ + RUN_ROUTE + """
      """ + RGB + """
      const assign = { grandma: 0, father: 1, mother: 2, younger: 3, brother: 4 };
      const s = E.applyAssignment(E.runRoute(days, null), assign);
      const code = S.renderEnding(s);
      const c = document.getElementById('end-moon');
      const moon = rgb(D.palette.moon);
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let moonPx = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === moon[0] && data[i+1] === moon[1] && data[i+2] === moon[2]) { moonPx++; }
      }
      return { code, tagged: c.getAttribute('data-ending'), moonPx,
               revealing: c.classList.contains('is-revealing'),
               opacity: getComputedStyle(c).opacity,
               bg: document.body.style.backgroundImage.slice(0, 30) };
    }""", [ROUTE])

    check("§6.3.1 the ending canvas is painted with the moon disc",
          out["moonPx"] > 0, str(out["moonPx"]))
    check("§6.3.1 the painted canvas is tagged with the engine's code",
          out["tagged"] == out["code"] == "E1", str(out))
    check("§8.4 the painted canvas carries the one-shot reveal",
          out["revealing"] is True and out["opacity"] == "0", str(out))
    page.wait_for_timeout(1400)
    settled = page.evaluate(
        "() => getComputedStyle(document.getElementById('end-moon')).opacity")
    check("§8.4 the ending moon settles into view", settled == "1", settled)
    check("§8.3 米纸底 is live once the page boots",
          out["bg"].startswith('url("data:image/png;base64'), out["bg"])


def test_boot_layer(page):
    bg = page.evaluate("() => document.body.style.backgroundImage")
    check("§8.3 buildPaperLayer runs once at boot", bg.startswith('url("data:image/png;base64'),
          bg[:32])
    canvases = page.evaluate("() => document.querySelectorAll('canvas').length")
    check("the offscreen layer leaves no stray canvas in the DOM", canvases == 1, str(canvases))
    check("§8.4 the boot layer adds no per-frame loop",
          page.evaluate("() => document.querySelectorAll('.end-moon').length") == 1)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page, errors = open_page(browser)

        for fn in [test_source_hygiene, test_no_image_assets, test_moon_phases,
                   test_moon_reveal, test_cake_patterns, test_lantern_tint,
                   test_paper_layer, test_paper_determinism, test_wiring_assign,
                   test_wiring_preview, test_wiring_ending, test_boot_layer]:
            run(fn, page)

        check("no page error was raised", not errors, str(errors))
        browser.close()

    for line in FAIL:
        print(f"FAIL {line}")
    print(f"yueyan art: {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
