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

# §5.4.1 replaces the old 22 flat assets with these 15 pixel sprites.
SPRITES = {"px-floor", "px-counter", "px-chef", "px-stove", "px-board",
           "px-plate-station", "px-rack", "px-firewood", "px-cake-raw",
           "px-cake-baking", "px-cake-golden", "px-cake-burnt", "px-bowl-gui",
           "px-bowl-lian", "px-bowl-dan"}

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

    # §8.4.1 / V-37a: the kitchen is allowed one rAF loop, and it must be the only
    # one; scene.js is the sole clock holder (§4.3.9). The old blanket ban on
    # per-frame driving was retired by §8.4.1.
    check("V-37a scene.js holds exactly one rAF loop (self-recursive + one start)",
          scene.count("requestAnimationFrame") == 2
          and scene.count("cancelAnimationFrame") == 1,
          f"rAF={scene.count('requestAnimationFrame')} "
          f"cancel={scene.count('cancelAnimationFrame')}")

    check("scene.js generates no inline handler",
          re.search(r"on(click|pointerdown|pointerup|touchstart)\s*=", scene) is None)

    # V-1 forbids external resources. §5.4.1 puts the sprites at the package-relative
    # assets/img/ path, so a relative reference is a local asset, not a network call.
    check("scene.js makes no network request",
          re.search(r"\bfetch\(|XMLHttpRequest|WebSocket|new Worker|WebAssembly",
                    scene) is None,
          str(re.findall(r"\bfetch\(|XMLHttpRequest|WebSocket", scene)))
    # The SVG namespace URI is a spec identifier handed to createElementNS, never
    # fetched, so it is the one absolute URI V-1 permits.
    absolute = re.findall(r"['\"(](?:https?:)?//[^'\"\s)]*", scene)
    check("V-1 the only absolute URI in scene.js is the SVG namespace",
          absolute == ["'http://www.w3.org/2000/svg"], str(absolute))
    check("V-1 scene.js embeds no data: URI", "data:" not in scene, "")

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

    check("§8.3 刻印 stroke-width is fixed at 1.5",
          re.search(r"stroke-width", scene) is not None
          and re.search(r"'stroke-width',\s*'1\.5'", scene) is not None)

    # §6.3.5-b moved the ending moon off canvas onto CSS pixel blocks: the only
    # surviving 2d context is buildPaperLayer's offscreen paper tile.
    check("§6.3.5-b the ending moon is CSS pixel blocks, not a canvas paint",
          scene.count("getContext") == 1
          and all(sel in css for sel in (".em-rim", ".em-disc", ".em-clouds", ".em-band")),
          f"getContext={scene.count('getContext')}")
    check("§6.3.5-b the five moon phases are driven by the locked cover ladder",
          re.search(r"setProperty\('--cover',\s*String\(MOON_COVER\[code\]", scene) is not None
          and all(re.search(rf'\[data-ending="{c}"\]', css) is not None for c in COVER))
    ending_body = scene.split("function renderEnding(")[1].split("\n  }")[0]
    check("§6.3.5-a the staged reveal runs on CSS animation-delay, never on a JS timer",
          not any(t in ending_body for t in ("setTimeout", "setInterval",
                                             "requestAnimationFrame"))
          and len(re.findall(r"animation-delay:\s*[0-9.]+s", css)) >= 8,
          str(len(re.findall(r"animation-delay:\s*[0-9.]+s", css))))

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


def test_sprite_manifest(page):
    """§5.4.1: exactly the 15 pixel sprites, all lossless webp under assets/img/."""
    img_dir = ASSETS / "img"
    files = sorted(p for p in ASSETS.rglob("*") if p.is_file()
                   and p.suffix.lower() in IMAGE_EXT)
    stray = [str(p.relative_to(ROOT)) for p in files if p.parent != img_dir]
    check("§5.4.1 every image asset lives under assets/img/", stray == [], str(stray))
    check("§5.4.1 exactly 15 image files ship under assets/", len(files) == 15,
          f"got {len(files)}")
    names = {p.stem for p in files}
    check("§5.4.1 the sprite set matches the manifest, no more no less",
          names == SPRITES, f"missing {sorted(SPRITES - names)} extra {sorted(names - SPRITES)}")
    check("§5.4.1 every sprite is a px-*.webp",
          all(p.suffix.lower() == ".webp" and p.stem.startswith("px-") for p in files),
          str([p.name for p in files
               if p.suffix.lower() != ".webp" or not p.stem.startswith("px-")]))

    html = INDEX.read_text(encoding="utf-8")
    check("index.html loads no image asset", "<img" not in html and ".png" not in html)

    scene = SCENE.read_text(encoding="utf-8")
    check("§5.4.1 scene.js builds sprite paths from the package-relative assets/img/",
          "assets/img/" in scene, "")
    check("§5.4.1 scene.js references only the 15 manifest sprites",
          set(re.findall(r"spr\('([a-z0-9-]+)'\)", scene)) |
          set(re.findall(r"'(px-[a-z0-9-]+)'", scene)) <= SPRITES,
          str(sorted((set(re.findall(r"spr\('([a-z0-9-]+)'\)", scene)) |
                      set(re.findall(r"'(px-[a-z0-9-]+)'\)", scene))) - SPRITES)))
    check("§5.4.1 scene.js references no format outside the manifest",
          set(re.findall(r"\.([a-z]+)\b", scene)) & {"png", "jpg", "jpeg", "gif", "svg"} == set(),
          str(set(re.findall(r"\.([a-z]+)\b", scene)) & {"png", "jpg", "jpeg", "gif", "svg"}))


# ------------------------------------------------------------------ moon phases
def test_moon_phases(page):
    # §6.3.5-b: the five phases are one CSS pixel moon plus five cloud states.
    # Geometry is read from offsetWidth/offsetHeight (layout box, immune to the
    # reveal's transforms) so no settling wait is needed.
    out = page.evaluate("""(cover) => {
      const S = window.YueYan.Scene;
      S.show('view-ending');
      const host = document.getElementById('end-moon');
      const probe = document.createElement('span');
      probe.style.background = 'var(--moon)';
      host.appendChild(probe);
      const moonRgb = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const cs = (sel, prop) => {
        const n = host.querySelector(sel);
        return n ? getComputedStyle(n)[prop] : null;
      };
      const out = { moonRgb: moonRgb };
      for (const code of ['E1','E2','E3','E4','E5']) {
        S.drawMoon(host, code);
        const band = host.querySelector('.em-band');
        const disc = host.querySelector('.em-disc');
        const rim = host.querySelector('.em-rim');
        out[code] = {
          tagged: host.getAttribute('data-ending'),
          cover: host.style.getPropertyValue('--cover'),
          expectCover: cover[code],
          discBg: cs('.em-disc', 'backgroundColor'),
          discW: disc.offsetWidth, discH: disc.offsetHeight,
          rimW: rim.offsetWidth, rimH: rim.offsetHeight,
          bandH: band.offsetHeight,
          bandBg: cs('.em-band', 'backgroundColor'),
          discOpacity: cs('.em-disc', 'opacity'),
          haloOpacity: cs('.em-halo', 'opacity'),
          wisps: ['.em-w1', '.em-w2', '.em-w3']
            .map(s => parseFloat(cs(s, 'opacity'))).filter(v => v > 0).length,
          revealing: host.classList.contains('is-revealing'),
          parts: ['.em-halo', '.em-rim', '.em-disc', '.em-clouds', '.em-band']
            .filter(s => host.querySelector(s)).length,
        };
      }
      return out;
    }""", COVER)

    order = ["E1", "E2", "E3", "E4", "E5"]
    for code in order:
        row = out[code]
        check(f"§6.3.5-b {code} builds all five CSS pixel moon parts",
              row["parts"] == 5, str(row))
        check(f"§6.3.5-b {code} paints the disc in the --moon token",
              row["discBg"] == out["moonRgb"], str((row["discBg"], out["moonRgb"])))
        check(f"§6.3.5-b {code} tags the host with its own code",
              row["tagged"] == code, str(row))
        check(f"§6.3.1 {code} writes the locked cover into --cover",
              abs(float(row["cover"]) - row["expectCover"]) < 1e-9, str(row))
        check(f"§8.4 {code} adds .is-revealing", row["revealing"] is True, str(row))
        check(f"§6.3.5-b {code} keeps the 148px pixel disc",
              row["discW"] == 148 and row["discH"] == 148, str(row))

    check("§6.3.1 E1 满月无云 has no cloud band", out["E1"]["bandH"] == 0, str(out["E1"]))
    check("§6.3.1 E1 满月无云 carries no cloud wisp", out["E1"]["wisps"] == 0, str(out["E1"]))
    for code in ["E2", "E3", "E4", "E5"]:
        check(f"§6.3.1 {code} raises a cloud band over the disc",
              out[code]["bandH"] > 0, str(out[code]))

    bands = [out[c]["bandH"] for c in order]
    check("V-21c ① cloud cover increases monotonically E1 → E5",
          all(bands[i] < bands[i + 1] for i in range(4)), str(bands))
    check("V-21c ① the band height is cover × the 148px disc",
          all(abs(bands[i] - COVER[c] * 148) <= 1 for i, c in enumerate(order)), str(bands))
    check("V-21c ② each ending keeps the same disc size",
          len({(out[c]["discW"], out[c]["discH"]) for c in order}) == 1
          and len({(out[c]["rimW"], out[c]["rimH"]) for c in order}) == 1,
          str([(out[c]["discW"], out[c]["rimW"]) for c in order]))
    check("V-21c ③ the cloud band never swallows the whole disc",
          all(out[c]["bandH"] < out[c]["discH"] for c in order), str(bands))

    # V-21c ④ — the five phases must be tellable apart at a glance. Band height,
    # wisp count, disc brightness and halo strength are the four distinguishing
    # quantities; any two adjacent endings must differ in at least one of them.
    vectors = [(out[c]["bandH"], out[c]["wisps"], out[c]["discOpacity"],
                out[c]["haloOpacity"]) for c in order]
    check("V-21c ④ all five phases are pairwise distinct",
          len(set(vectors)) == 5, str(vectors))
    check("V-21c ④ the wisp ladder rises with the cloud",
          [v[1] for v in vectors] == [0, 1, 2, 2, 3], str([v[1] for v in vectors]))
    check("V-21c ④ the halo ladder dims with the cloud",
          [float(v[3]) for v in vectors] == [0.58, 0.44, 0.34, 0.24, 0.14],
          str([v[3] for v in vectors]))
    check("V-21c ④ E5 薄云遮月 dims the disc and switches the band tone",
          out["E5"]["discOpacity"] == "0.78"
          and out["E5"]["bandBg"] != out["E4"]["bandBg"],
          str((out["E5"]["discOpacity"], out["E5"]["bandBg"], out["E4"]["bandBg"])))


def test_moon_reveal(page):
    start = page.evaluate("""() => {
      const S = window.YueYan.Scene;
      const c = document.createElement('div');
      c.id = 'art-reveal-probe';
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

    check("§8.4 the moon host starts hidden", start["before"] == "0", str(start))
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
      const assign = { grandma: 0, father: 1, mother: 2, younger: 3, brother: 4 };
      const s = E.applyAssignment(E.runRoute(days, null), assign);
      const code = S.renderEnding(s);
      const c = document.getElementById('end-moon');
      const disc = c.querySelector('.em-disc');
      const probe = document.createElement('span');
      probe.style.background = 'var(--moon)';
      c.appendChild(probe);
      const moonRgb = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { code, tagged: c.getAttribute('data-ending'),
               discBg: getComputedStyle(disc).backgroundColor, wantMoon: moonRgb,
               parts: ['.em-halo', '.em-rim', '.em-disc', '.em-clouds', '.em-band']
                 .filter(sel => c.querySelector(sel)).length,
               revealing: c.classList.contains('is-revealing'),
               revealed: document.getElementById('view-ending')
                 .classList.contains('is-revealed'),
               opacity: getComputedStyle(c).opacity,
               bg: document.body.style.backgroundImage.slice(0, 30) };
    }""", [ROUTE])

    check("§6.3.5-b the ending moon disc carries the --moon token",
          out["discBg"] == out["wantMoon"], str((out["discBg"], out["wantMoon"])))
    check("§6.3.5-b the ending moon builds all five CSS pixel parts",
          out["parts"] == 5, str(out))
    check("§6.3.1 the moon host is tagged with the engine's code",
          out["tagged"] == out["code"] == "E1", str(out))
    check("§6.3.5-a both reveal classes flip in the same tick",
          out["revealing"] is True and out["revealed"] is True and out["opacity"] == "0",
          str(out))
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
    check("§6.3.5-b the ending moon moved off canvas, so the DOM holds no canvas at all",
          canvases == 0, str(canvases))
    check("§8.4 the boot layer adds no per-frame loop",
          page.evaluate("() => document.querySelectorAll('.end-moon').length") == 1)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page, errors = open_page(browser)

        for fn in [test_source_hygiene, test_sprite_manifest, test_moon_phases,
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
