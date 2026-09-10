#!/usr/bin/env python3
"""Task 14 — the 780 x 1688 share card.

Covers §9.1 (运行时 canvas 生成, V-2 零图片资产), §9.2 (只呈现团圆结果, 不得出现
银钱余额/槽位/门控), §9.3 (锁定几何与字号表, 品级以金/银/铜三字呈现, 空座位只画
描边圆), plus V-21 (实际渲染色值 ⊆ §8.2 七个 token) and the publish paths.
"""
import pathlib
import re

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "tools/yueyan/assets"
INDEX = ROOT / "tools/yueyan/index.html"
SHARE = ASSETS / "share.js"

COVER = {"E1": 0.00, "E2": 0.18, "E3": 0.35, "E4": 0.55, "E5": 0.75}
GRADE_CHAR = {"1": "铜", "2": "银", "3": "金"}
# §9.3 字号表: 用途 -> (字号, 字重)
FONT_TABLE = {"name": (64, 700), "text": (30, 400), "family": (26, 500),
              "filling": (24, 400), "grade": (20, 700), "meter": (28, 500),
              "brand": (34, 700), "series": (20, 400)}

ROUTE = [["buy:haoliao", "buy:haoliao", "buy:putong"],
         ["buy:haoliao", "buy:haoliao", "buy:putong"],
         ["buy:putong", "shouzuo:dousha:premium", "shouzuo:wuren:premium"],
         ["shouzuo:lianrong:premium", "shouzuo:dousha:normal", "xiexin"],
         ["buy:guihua", "beiyan", "beiyan"],
         ["beiyan", "beiyan", "buzhi"],
         ["shouzuo:guihua:premium", "buzhi", "buzhi"]]
ASSIGN = {"grandma": 0, "father": 1, "mother": 2, "younger": 3, "brother": 4}
EMPTY_ASSIGN = {"grandma": None, "father": None, "mother": None,
                "younger": None, "brother": None}

PASS = []
FAIL = []


def check(name, ok, detail=""):
    (PASS if ok else FAIL).append(name if ok else f"{name} :: {detail}")


def run(fn, page):
    try:
        fn(page)
    except Exception as exc:                                    # noqa: BLE001
        check(f"{fn.__name__} aborted", False, str(exc))


RGB = """
  const rgb = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const norm = (v) => (v.charAt(0) === '#' ? `rgb(${rgb(v).join(', ')})` : v);
  const px = (f) => +f.match(/(\\d+)px/)[1];
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

# Patches the 2d-context prototype so every paint call is logged with the
# canvas state in force at that moment (font, fillStyle, textAlign, last arc).
SPY = """
      const P = CanvasRenderingContext2D.prototype;
      const orig = {};
      ['fillText','arc','fill','stroke','fillRect','clip'].forEach(k => { orig[k] = P[k]; });
      const log = { text: [], fills: [], strokes: [], rects: [], arcs: [] };
      let lastArc = null;
      P.fillText = function (t, x, y) {
        log.text.push({ t: String(t), x: x, y: y, font: this.font,
                        fill: String(this.fillStyle), align: this.textAlign });
        return orig.fillText.apply(this, arguments);
      };
      P.arc = function (cx, cy, r) {
        lastArc = { cx: cx, cy: cy, r: r };
        log.arcs.push(lastArc);
        return orig.arc.apply(this, arguments);
      };
      P.fill = function () {
        log.fills.push({ arc: lastArc, fill: String(this.fillStyle) });
        return orig.fill.apply(this, arguments);
      };
      P.stroke = function () {
        log.strokes.push({ arc: lastArc, stroke: String(this.strokeStyle) });
        return orig.stroke.apply(this, arguments);
      };
      P.fillRect = function (x, y, w, h) {
        log.rects.push({ x: x, y: y, w: w, h: h, fill: String(this.fillStyle) });
        return orig.fillRect.apply(this, arguments);
      };
      const restore = () => { ['fillText','arc','fill','stroke','fillRect','clip']
        .forEach(k => { P[k] = orig[k]; }); };
"""


def open_page(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.set_default_timeout(3000)
    page.goto(INDEX.as_uri())
    page.wait_for_timeout(250)
    check("the page boots without a page error", not errors, "; ".join(errors))
    return page


# ------------------------------------------------------------- source hygiene
def test_source_hygiene(page):
    src = SHARE.read_text(encoding="utf-8")
    check("V-21 share.js contains zero hex literals",
          not re.search(r"#[0-9A-Fa-f]{3,8}", src), str(re.findall(r"#[0-9A-Fa-f]{3,8}", src)))
    check("share.js reads its colours from Data.palette",
          "D.palette" in src, "no D.palette reference")
    check("§9.3 no cinnabar reaches the grade marks",
          "palette.cinnabar" not in src, "cinnabar referenced")
    check("no Math.random / rng anywhere in share.js",
          not re.search(r"Math\.random|\.rng|\brandom\(", src), "rng found")
    check("no network API in share.js",
          not re.search(r"fetch\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon", src),
          "network API found")
    check("V-21 no inline handler is emitted", "onclick" not in src, "onclick found")
    check("the card is exported as a PNG data URL", "toDataURL('image/png')" in src
          or 'toDataURL("image/png")' in src, "toDataURL missing")
    check("the fallback alt text is set", "月宴分享卡" in src, "alt missing")


# ------------------------------------------------------------- card geometry
def test_build_size(page):
    out = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine;
      """ + RUN_ROUTE + """
      const url = Sh.build(E.applyAssignment(E.runRoute(days, null), ASSIGN));
      return { prefix: url.slice(0, 22), len: url.length };
    }""", [ROUTE, ASSIGN])
    check("§9.1 build returns a PNG data URL", out["prefix"] == "data:image/png;base64,",
          out["prefix"])
    check("§9.1 the payload is non-empty", out["len"] > 1000, str(out["len"]))

    size = page.evaluate("""([ROUTE, ASSIGN]) => new Promise(res => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine;
      """ + RUN_ROUTE + """
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => res({ w: 0, h: 0 });
      img.src = Sh.build(E.applyAssignment(E.runRoute(days, null), ASSIGN));
    })""", [ROUTE, ASSIGN])
    check("§9.3 the card is exactly 780 x 1688", size == {"w": 780, "h": 1688}, str(size))


def test_determinism(page):
    out = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine;
      """ + RUN_ROUTE + """
      const s = E.applyAssignment(E.runRoute(days, null), ASSIGN);
      return { a: Sh.build(s), b: Sh.build(s) };
    }""", [ROUTE, ASSIGN])
    check("§9.3 two builds of the same state are byte-identical",
          out["a"] == out["b"] and len(out["a"]) > 1000, "cards differ")


# ------------------------------------------------------------- palette (V-21)
def test_palette_only(page):
    out = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine, D = window.YueYan.Data;
      """ + RGB + """
      """ + SPY + """
      """ + RUN_ROUTE + """
      const s = E.applyAssignment(E.runRoute(days, null), ASSIGN);
      const url = Sh.build(s);
      restore();
      const tokens = Object.values(D.palette).map(h => `rgb(${rgb(h).join(', ')})`);
      const used = Array.from(new Set(log.text.map(t => norm(t.fill))
        .concat(log.fills.map(f => norm(f.fill)))
        .concat(log.strokes.map(t => norm(t.stroke)))
        .concat(log.rects.map(r => norm(r.fill)))));
      return { url, tokens, used };
    }""", [ROUTE, ASSIGN])
    check("V-21 every colour the painter set is one of the seven tokens",
          all(u in out["tokens"] for u in out["used"]),
          str([u for u in out["used"] if u not in out["tokens"]]))
    check("V-21 the painter only ever used palette values", len(out["used"]) > 0, "no colours set")

    hist = page.evaluate("""([url]) => new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const counts = {};
        for (let i = 0; i < d.length; i += 4) {
          const k = `rgb(${d[i]}, ${d[i+1]}, ${d[i+2]})`;
          counts[k] = (counts[k] || 0) + 1;
        }
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([k, n]) => ({ k, n }));
        """ + RGB + """
        const tokens = Object.values(window.YueYan.Data.palette)
          .map(h => `rgb(${rgb(h).join(', ')})`);
        const vals = tokens.map(k => k.match(/\\d+/g).map(Number));
        const tokenOrBlend = (k) => {
          if (tokens.indexOf(k) >= 0) { return true; }
          const v = k.match(/\\d+/g).map(Number);
          return vals.some(a => vals.some(b =>
            v.every((ch, i) => ch >= Math.min(a[i], b[i]) && ch <= Math.max(a[i], b[i]))));
        };
        res({ top, tokens, corner: `rgb(${d[0]}, ${d[1]}, ${d[2]})`,
              offenders: top.filter(t => !tokenOrBlend(t.k)).map(t => t.k),
              exactTokens: top.filter(t => tokens.indexOf(t.k) >= 0).length });
      };
      img.onerror = () => res({ top: [], tokens: [], corner: '', offenders: [], exactTokens: 0 });
      img.src = url;
    })""", [out["url"]])
    check("V-21 every dominant pixel colour is a token or a token-to-token blend",
          hist["offenders"] == [], str(hist["offenders"]))
    check("V-21 at least four exact token colours dominate the card",
          hist["exactTokens"] >= 4, str(hist["top"]))
    check("O-5 the card底 is 米纸 paper", hist["corner"] == hist["tokens"][0], hist["corner"])


# ------------------------------------------------------------- card content
def test_text_content(page):
    out = page.evaluate("""([ROUTE, ASSIGN, GRADE]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine, D = window.YueYan.Data;
      """ + RGB + """
      """ + SPY + """
      """ + RUN_ROUTE + """
      const s = E.applyAssignment(E.runRoute(days, null), ASSIGN);
      const code = E.ending(s), m = E.meters(s);
      Sh.build(s);
      restore();
      return { texts: log.text.map(t => t.t),
               grades: log.text.filter(t => ['金','银','铜'].indexOf(t.t) >= 0
                 && px(t.font) === 20).map(t => t.t),
               textLines: (() => {
                 const want = D.endings[code].text;
                 for (let i = 0; i < log.text.length; i++) {
                   let acc = '';
                   for (let j = i; j < log.text.length; j++) {
                     acc += log.text[j].t;
                     if (acc === want) { return log.text.slice(i, j + 1).map(t => t.t); }
                     if (acc.length > want.length) { break; }
                   }
                 }
                 return [];
               })(),
               gradeFills: log.text.filter(t => ['金','银','铜'].indexOf(t.t) >= 0)
                 .map(t => ({ t: t.t, fill: t.fill })),
               wantGrades: s.cakes.map(c => GRADE[c.grade]),
               wantFills: s.cakes.map(c => D.fillings[c.filling].label),
               wantMeters: [['饼品', String(m.Q)], ['宴备', String(m.B)], ['心意', String(m.H)]],
               wantName: D.endings[code].name,
               wantText: D.endings[code].text,
               cakeCount: s.cakes.length };
    }""", [ROUTE, ASSIGN, GRADE_CHAR])

    check("§9.3 the ending name is drawn on the card", out["wantName"] in out["texts"],
          str(out["texts"]))
    check("§6.3.4 the ending text is drawn on the card, wrapped to the locked width",
          "".join(out["textLines"]) == out["wantText"] and len(out["textLines"]) <= 2,
          str(out["textLines"]))
    check("§9.3 the brand 月宴 is drawn", "月宴" in out["texts"], str(out["texts"]))
    check("§9.3 the series 非遗手作坊 is drawn", "非遗手作坊" in out["texts"], str(out["texts"]))
    check("§9.3 all five filling labels are drawn",
          all(l in out["texts"] for l in out["wantFills"]) and out["cakeCount"] == 5,
          str(out["wantFills"]))
    check("§9.3 all three meter rows are drawn",
          all(pair[0] in out["texts"] and pair[1] in out["texts"] for pair in out["wantMeters"]),
          str(out["wantMeters"]))
    check("§9.3 the grades are the 金/银/铜 characters, never numbers",
          sorted(out["grades"]) == sorted(out["wantGrades"])
          and not any(re.search(r"\d", g) for g in out["grades"]),
          str(out["grades"]))
    check("§9.2 no process info reaches the card",
          not any(re.search(r"银钱|槽位|门控|余额|银两", t) for t in out["texts"]),
          str(out["texts"]))


def test_grade_colours(page):
    out = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine, D = window.YueYan.Data;
      """ + RGB + """
      """ + SPY + """
      """ + RUN_ROUTE + """
      const s = E.applyAssignment(E.runRoute(days, null), ASSIGN);
      Sh.build(s);
      restore();
      const want = { 3: `rgb(${rgb(D.palette.lantern).join(', ')})`,
                     2: `rgb(${rgb(D.palette.paper).join(', ')})`,
                     1: `rgb(${rgb(D.palette.amber).join(', ')})` };
      return { rows: log.text.filter(t => ['金','银','铜'].indexOf(t.t) >= 0)
                 .map(t => ({ t: t.t, fill: norm(t.fill) })),
               want: s.cakes.map(c => want[c.grade]) };
    }""", [ROUTE, ASSIGN])
    check("§9.3 金/银/铜 each carry its own token colour",
          len(out["rows"]) == 5
          and [r["fill"] for r in out["rows"]] == out["want"], str(out))


def font_ok(font, size, weight):
    # canvas normalises the shorthand: 700 -> "bold", 400 -> dropped entirely.
    if weight == 700:
        return font.startswith(f"bold {size}px")
    if weight == 400:
        return font.startswith(f"{size}px")
    return font.startswith(f"{weight} {size}px")


def test_font_table(page):
    out = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine, D = window.YueYan.Data;
      """ + SPY + """
      """ + RUN_ROUTE + """
      const s = E.applyAssignment(E.runRoute(days, null), ASSIGN);
      const code = E.ending(s);
      Sh.build(s);
      restore();
      const find = (needle) => log.text.find(t => t.t === needle);
      const grade = log.text.find(t => ['金','银','铜'].indexOf(t.t) >= 0);
      const meter = find('饼品');
      const filling = find(D.fillings[s.cakes[0].filling].label);
      const family = find(D.family[D.familyOrder[0]].label);
      const text = log.text.find(t => D.endings[code].text.startsWith(t.t));
      const series = find('非遗手作坊');
      return { name: find(D.endings[code].name).font, text: text.font,
               family: family.font, filling: filling.font, grade: grade.font,
               meter: meter.font, brand: find('月宴').font, series: series.font };
    }""", [ROUTE, ASSIGN])
    for key, (size, weight) in FONT_TABLE.items():
        check(f"§9.3 {key} is drawn at {size}px/{weight}",
              font_ok(out[key], size, weight), out[key])


def test_alignment(page):
    out = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine, D = window.YueYan.Data;
      """ + SPY + """
      """ + RUN_ROUTE + """
      const s = E.applyAssignment(E.runRoute(days, null), ASSIGN);
      const code = E.ending(s);
      Sh.build(s);
      restore();
      const find = (n) => log.text.find(t => t.t === n);
      const firstLine = log.text.find(t => D.endings[code].text.startsWith(t.t));
      return { name: find(D.endings[code].name).align, text: firstLine.align,
               brand: find('月宴').align, series: find('非遗手作坊').align,
               filling: find(D.fillings[s.cakes[0].filling].label).align,
               meter: find('饼品').align };
    }""", [ROUTE, ASSIGN])
    check("§9.3 name / text / brand are centred",
          out["name"] == out["text"] == out["brand"] == out["series"] == "center", str(out))
    check("§9.3 cake and meter rows are left aligned",
          out["filling"] == out["meter"] == "left", str(out))


# ------------------------------------------------------------- table seats
def test_seats(page):
    out = page.evaluate("""([ROUTE, ASSIGN, EMPTY, FONT]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine, D = window.YueYan.Data;
      const G = D.card;
      """ + SPY + """
      const build = (assignment) => {
        const days = [[],[],[],[],[],[],[]];
        const s = E.runRoute(days, assignment);
        Sh.build(s);
        restore();
        return { log, s };
      };
      const seatAt = (i) => {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        return { x: G.moonCx + Math.cos(a) * G.tableR, y: G.tableCy + Math.sin(a) * G.tableR };
      };
      const empty = build(EMPTY);
      const near = (c, p) => c && Math.abs(c.cx - p.x) < 1 && Math.abs(c.cy - p.y) < 1;
      const emptySeats = D.familyOrder.map((k, i) => ({
        key: k, seat: seatAt(i),
        filled: empty.log.fills.some(f => near(f.arc, seatAt(i))),
        labelled: empty.log.text.some(t => t.t === D.family[k].label)
      }));
      const tableCircle = empty.log.strokes.some(s => s.arc
        && Math.abs(s.arc.cx - G.moonCx) < 1 && Math.abs(s.arc.cy - G.tableCy) < 1
        && Math.abs(s.arc.r - G.tableR) < 1);
      const seatStrokes = empty.log.strokes.filter(s => s.arc && s.arc.r === 26).length;
      return { emptySeats, tableCircle, seatStrokes };
    }""", [ROUTE, ASSIGN, EMPTY_ASSIGN, FONT_TABLE])

    check("§9.3 the round table outline is drawn at the locked geometry",
          out["tableCircle"] is True, str(out["tableCircle"]))
    check("§9.3 all five seats are outlined", out["seatStrokes"] == 5, str(out["seatStrokes"]))
    check("§3.9 the four same-city members always attend, so their seats are filled",
          all(s["filled"] and s["labelled"] for s in out["emptySeats"] if s["key"] != "brother"),
          str(out["emptySeats"]))
    check("§9.3 / X-11 the absent brother's seat is stroke-only: no fill, no label",
          all(not s["filled"] and not s["labelled"] for s in out["emptySeats"]
              if s["key"] == "brother"),
          str(out["emptySeats"]))

    filled = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine, D = window.YueYan.Data;
      const G = D.card;
      """ + SPY + """
      """ + RUN_ROUTE + """
      const s = E.applyAssignment(E.runRoute(days, null), ASSIGN);
      Sh.build(s);
      restore();
      const seatAt = (i) => {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        return { x: G.moonCx + Math.cos(a) * G.tableR, y: G.tableCy + Math.sin(a) * G.tableR };
      };
      const near = (c, p) => c && Math.abs(c.cx - p.x) < 1 && Math.abs(c.cy - p.y) < 1;
      return D.familyOrder.map((k, i) => ({
        key: k,
        filled: log.fills.some(f => near(f.arc, seatAt(i))),
        labelled: log.text.some(t => t.t === D.family[k].label)
      }));
    }""", [ROUTE, ASSIGN])
    check("§9.3 every seated family member is filled and labelled",
          all(s["filled"] and s["labelled"] for s in filled), str(filled))


# ------------------------------------------------------------- moon per code
def test_moon_phases(page):
    urls = page.evaluate("""([COVER]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine;
      const days = [[],[],[],[],[],[],[]];
      const s = E.runRoute(days, { grandma: null, father: null, mother: null,
                                   younger: null, brother: null });
      const orig = E.ending;
      const urls = Object.keys(COVER).map(code => {
        E.ending = () => code;
        const url = Sh.build(s);
        return { code, url };
      });
      E.ending = orig;
      return urls;
    }""", [COVER])
    covers = []
    for row in urls:
        ratio = page.evaluate("""([url, code]) => new Promise(res => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            """ + RGB + """
            const moon = rgb(window.YueYan.Data.palette.moon);
            const G = window.YueYan.Data.card;
            let moonPx = 0, total = 0;
            for (let y = Math.floor(G.moonCy - G.moonR); y <= G.moonCy + G.moonR; y++) {
              for (let x = Math.floor(G.moonCx - G.moonR); x <= G.moonCx + G.moonR; x++) {
                const dx = x - G.moonCx, dy = y - G.moonCy;
                if (dx * dx + dy * dy > G.moonR * G.moonR) { continue; }
                total++;
                const i = (y * c.width + x) * 4;
                if (d[i] === moon[0] && d[i+1] === moon[1] && d[i+2] === moon[2]) { moonPx++; }
              }
            }
            res({ code, visible: moonPx / total });
          };
          img.onerror = () => res({ code, visible: -1 });
          img.src = url;
        })""", [row["url"], row["code"]])
        covers.append(ratio)
    check("§6.3.1 the moon is drawn on every ending", all(c["visible"] > 0 for c in covers),
          str(covers))
    check("§6.3.1 the cloud cover grows monotonically E1 to E5",
          [round(c["visible"], 2) for c in covers]
          == sorted([round(c["visible"], 2) for c in covers], reverse=True),
          str([round(c["visible"], 2) for c in covers]))
    check("§6.3.1 E1 shows the full disc and E5 is the thinnest",
          round(covers[0]["visible"], 2) > 0.95 and round(covers[4]["visible"], 2) < 0.3,
          str([round(c["visible"], 2) for c in covers]))


# ------------------------------------------------------------- publish paths
def test_publish_fallback(page):
    out = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine;
      """ + RUN_ROUTE + """
      const url = Sh.build(E.applyAssignment(E.runRoute(days, null), ASSIGN));
      const wrap = document.getElementById('card-wrap');
      const mode = Sh.publish(url);
      const img = wrap.querySelector('img');
      return { mode, hasTool: !!(window.xhs && window.xhs.miniTool), count: wrap.children.length,
               alt: img ? img.alt : null, src: img ? img.src.slice(0, 22) : null,
               sameSrc: img ? img.src === url : false,
               handler: img ? img.getAttribute('onclick') : null };
    }""", [ROUTE, ASSIGN])
    check("offline there is no xhs tool", out["hasTool"] is False, str(out["hasTool"]))
    check("§9.1 publish falls back to the inline preview", out["mode"] == "fallback",
          str(out["mode"]))
    check("§9.1 exactly one card image is appended", out["count"] == 1, str(out["count"]))
    check("§9.1 the card image carries its alt text", out["alt"] == "月宴分享卡", str(out["alt"]))
    check("§9.1 the appended image is the built card",
          out["src"] == "data:image/png;base64," and out["sameSrc"] is True, str(out))
    check("V-21 the appended image carries no inline handler", out["handler"] is None,
          str(out["handler"]))

    repeat = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine;
      """ + RUN_ROUTE + """
      const url = Sh.build(E.applyAssignment(E.runRoute(days, null), ASSIGN));
      Sh.publish(url);
      return document.getElementById('card-wrap').children.length;
    }""", [ROUTE, ASSIGN])
    check("§9.1 republishing replaces the card rather than stacking", repeat == 1, str(repeat))


def test_publish_xhs(page):
    out = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine;
      """ + RUN_ROUTE + """
      const url = Sh.build(E.applyAssignment(E.runRoute(days, null), ASSIGN));
      const calls = [];
      window.xhs = { miniTool: { share: (payload) => calls.push(payload) } };
      const mode = Sh.publish(url);
      const count = document.getElementById('card-wrap').children.length;
      delete window.xhs;
      return { mode, calls: calls.length, image: calls[0] ? calls[0].image === url : null,
               keys: calls[0] ? Object.keys(calls[0]) : [], count };
    }""", [ROUTE, ASSIGN])
    check("§9.1 publish hands the card to xhs.miniTool when present", out["mode"] == "xhs",
          str(out["mode"]))
    check("§9.1 the tool is called exactly once with the card",
          out["calls"] == 1 and out["image"] is True and out["keys"] == ["image"], str(out))
    check("§9.1 the tool path does not also append an inline image", out["count"] == 0,
          str(out["count"]))


def test_publish_throws(page):
    out = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine;
      """ + RUN_ROUTE + """
      const url = Sh.build(E.applyAssignment(E.runRoute(days, null), ASSIGN));
      window.xhs = { miniTool: { share: () => { throw new Error('tool down'); } } };
      const mode = Sh.publish(url);
      const img = document.getElementById('card-wrap').querySelector('img');
      delete window.xhs;
      return { mode, hasImg: !!img };
    }""", [ROUTE, ASSIGN])
    check("§9.4 a throwing tool degrades silently to the inline card",
          out["mode"] == "fallback" and out["hasImg"] is True, str(out))


def test_no_network(page):
    seen = []
    page.on("request", lambda req: seen.append(req.url))
    before = len(seen)
    page.evaluate("""([ROUTE, ASSIGN]) => {
      const Sh = window.YueYan.Share, E = window.YueYan.Engine;
      """ + RUN_ROUTE + """
      const url = Sh.build(E.applyAssignment(E.runRoute(days, null), ASSIGN));
      Sh.publish(url);
      window.xhs = { miniTool: { share: () => {} } };
      Sh.publish(url);
      delete window.xhs;
    }""", [ROUTE, ASSIGN])
    page.wait_for_timeout(300)
    check("V-2 neither publish path makes a network request", len(seen) == before,
          str(seen[before:]))


# ------------------------------------------------------------- button wiring
def test_wiring(page):
    seen = []
    page.on("request", lambda req: seen.append(req.url))
    before = len(seen)
    page.evaluate("""([ROUTE, ASSIGN]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      """ + RUN_ROUTE + """
      S.renderEnding(E.applyAssignment(E.runRoute(days, null), ASSIGN));
    }""", [ROUTE, ASSIGN])
    page.wait_for_timeout(200)
    check("the ending view is live before the tap",
          page.evaluate("() => document.getElementById('view-ending')"
                        ".classList.contains('is-active')") is True, "ending view hidden")
    page.click("#btn-share")
    page.wait_for_timeout(400)

    out = page.evaluate("""() => new Promise(res => {
      const wrap = document.getElementById('card-wrap');
      const img = wrap.querySelector('img');
      if (!img) { res({ count: 0 }); return; }
      img.onload = () => res({ count: wrap.children.length, alt: img.alt,
                               w: img.naturalWidth, h: img.naturalHeight });
      if (img.complete) { img.onload(); }
    })""")
    check("§9.1 tapping 生成分享卡 renders the card inline", out["count"] == 1, str(out))
    check("§9.1 the tapped card is the locked 780 x 1688 size",
          out["w"] == 780 and out["h"] == 1688, str(out))
    check("§9.1 the tapped card carries its alt text", out["alt"] == "月宴分享卡", str(out))
    page.wait_for_timeout(300)
    check("V-2 the tap makes no network request", len(seen) == before, str(seen[before:]))


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for fn in [test_source_hygiene, test_build_size, test_determinism,
                   test_palette_only, test_text_content, test_grade_colours,
                   test_font_table, test_alignment, test_seats, test_moon_phases,
                   test_publish_fallback, test_publish_xhs, test_publish_throws,
                   test_no_network, test_wiring]:
            page = open_page(browser)
            run(fn, page)
            page.close()
        browser.close()

    for name in FAIL:
        print(f"FAIL {name}")
    print(f"yueyan share: {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
