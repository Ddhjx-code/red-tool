#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""月宴 (YueYan) smoke suite: container compliance, DOM path, cultural readability."""
import pathlib
import re
import subprocess
import sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "yueyan"
IDX = TOOL / "index.html"

FAILS = []


def check(name, ok, detail=""):
    if ok:
        print("PASS  " + name)
    else:
        print("FAIL  " + name + "  " + detail)
        FAILS.append(name)


def read(p):
    return p.read_text(encoding="utf-8")


# --- V-1: single-file boot, external scripts, relative paths -----------------
html = read(IDX)
scripts = re.findall(r'<script[^>]*src="([^"]+)"[^>]*>', html)
links = re.findall(r'<link[^>]*href="([^"]+)"[^>]*>', html)
JS = ["data.js", "engine.js", "audio.js", "scene.js", "save.js", "share.js", "main.js"]
check("V-1 external scripts only", len(scripts) == 7 and "<script>" not in html)
check("V-1 all 7 modules loaded",
      sorted(pathlib.Path(s).name for s in scripts) == sorted(JS),
      str(sorted(pathlib.Path(s).name for s in scripts)))
check("V-1 stylesheet linked",
      [pathlib.Path(h).name for h in links] == ["style.css"], str(links))
check("V-1 relative ./assets paths",
      all(s.startswith("./assets/") for s in scripts)
      and all(h.startswith("./assets/") for h in links))
check("V-1 no inline handlers",
      not re.search(r'\son[a-z]+\s*=', html))
check("V-1 no ES modules", 'type="module"' not in html)
check("V-1 no CSP meta", "Content-Security-Policy" not in html)
check("V-1 viewport-fit=cover",
      "width=device-width" in html and "viewport-fit=cover" in html)

# --- V-2: package size -------------------------------------------------------
def tool_bytes():
    total = 0
    for p in TOOL.rglob("*"):
        if p.is_file() and p.name != ".DS_Store":
            total += p.stat().st_size
    return total


size = tool_bytes()
images = [p.name for p in TOOL.rglob("*") if p.suffix.lower()
          in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")]
check("V-2 <=2MB target", size <= 2 * 1024 * 1024, "%d bytes" % size)
check("V-2 <=10MB hard", size <= 10 * 1024 * 1024, "%d bytes" % size)
check("V-2 zero image assets", images == [], str(images))

# --- V-3: no randomness, no banned runtime APIs ------------------------------
js = "".join(read(p) for p in TOOL.glob("assets/*.js"))
check("V-3 no Math.random", "Math.random" not in js)
check("V-3 no seeded random", not re.search(r'\brng\b|\brandom\b|\bseedRandom\b', js))
check("V-3 no eval / new Function",
      "eval(" not in js and "new Function" not in js)
check("V-3 no network",
      not re.search(r'\bfetch\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon', js))
check("V-3 no Worker", "new Worker" not in js)
check("V-3 no WASM", "WebAssembly" not in js)

# --- V-18: lunar dates, never numeric days ----------------------------------
data = read(TOOL / "assets" / "data.js")
dates = re.findall(r'初[八九十]|十[一二三四]', data)
check("V-18 dates 初八..十四 present", len(set(dates)) == 7, str(sorted(set(dates))))
check("V-18 no 'Day N' literal",
      not re.search(r'\bDay\s*\d', html + js))

# --- V-19: no banned symbols -------------------------------------------------
BANNED = ["玉兔", "嫦娥", "月宫", "西式蛋糕", "慕斯",
          "现代月饼礼盒", "塑料包装", "红色灯笼阵"]
blob = html + js
found = [w for w in BANNED if w in blob]
check("V-19 no banned symbols", found == [], str(found))

# --- V-20: lantern uses the single warm token --------------------------------
check("V-20 lantern single tone",
      data.count("F5C77E") == 1 and "lantern:" in data)

# --- V-21: exactly seven palette tokens -------------------------------------
hexes = sorted(set(re.findall(r'#[0-9A-Fa-f]{6}', data)))
ALLOWED = {"#F7EFE2", "#B8733A", "#C9483C", "#3A2E26",
           "#F2E4C4", "#E8B84B", "#F5C77E"}
check("V-21 seven tokens in data.js", len(hexes) == 7 and set(hexes) == ALLOWED,
      str(hexes))

css = read(TOOL / "assets" / "style.css")
css_hexes = sorted(set(re.findall(r'#[0-9A-Fa-f]{6}', css)))
check("V-21 no extra hex in style.css", set(css_hexes) <= ALLOWED, str(css_hexes))
scene = read(TOOL / "assets" / "scene.js")
check("V-21 scene.js hardcodes no hex",
      not re.search(r'#[0-9A-Fa-f]{6}', scene))

# --- DOM path: the six views and every locked id ----------------------------
VIEWS = ["view-intro", "view-schedule", "view-craft",
         "view-assign", "view-preview", "view-ending"]
missing_views = [v for v in VIEWS if 'id="%s"' % v not in html]
check("DOM six views present", missing_views == [], str(missing_views))

IDS = [
    "intro-title", "intro-sub", "intro-howto", "toggle-congrong",
    "btn-start", "intro-save-hint",
    "day-label", "slot-grid", "meter-q", "meter-b", "meter-h",
    "silver-count", "stock-putong", "stock-haoliao", "stock-xiandanhuang",
    "stock-guihua", "cake-count",
    "row-buy", "row-shishi", "row-daizuo", "row-shouzuo",
    "row-xiexin", "row-beiyan", "row-buzhi",
    "buy-putong", "buy-haoliao", "buy-xiandanhuang", "buy-guihua",
    "btn-finish-day",
    "craft-filling-list", "craft-batch-normal", "craft-batch-premium",
    "btn-craft-start", "step-index", "bar-s1", "pad-s2", "pad-s3", "bar-s4",
    "btn-step-confirm", "btn-craft-abort", "craft-grade",
    "assign-cake-list", "assign-family-list", "btn-assign-confirm",
    "preview-cakes", "preview-seats", "preview-banquet", "preview-lanterns",
    "preview-q", "preview-b", "preview-h", "btn-open-feast",
    "end-moon", "end-name", "end-text", "btn-share", "card-wrap",
]
missing_ids = [i for i in IDS if 'id="%s"' % i not in html]
check("DOM all locked ids present", missing_ids == [], str(missing_ids))

# §3.3: all seven locked row-* ids must exist in the static HTML. The
# "exactly six top-level rows" invariant is a RUNTIME property (daizuo/shouzuo
# are sub-branches of 制饼 sharing the row- prefix, so the static id count is 7);
# it is asserted at runtime below by counting #drawer > .drawer-row.
rows = re.findall(r'id="row-(buy|shishi|daizuo|shouzuo|xiexin|beiyan|buzhi)"', html)
check("DOM seven locked row ids present", len(set(rows)) == 7, str(rows))


def runtime():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(IDX.as_uri())
        pg.wait_for_timeout(600)

        out = pg.evaluate("""() => ({
          ready: window.__ready === true,
          keys: Object.keys(window.__yueyan).sort().join(','),
          ns: Object.keys(window.YueYan).sort().join(','),
          day: window.__yueyan.state().day,
          silver: window.__yueyan.state().silver,
          active: document.querySelector('.view.is-active').id,
          slots: document.querySelectorAll('.slot').length,
          drawerRows: document.querySelectorAll('#drawer > .drawer-row').length,
          endText: document.getElementById('end-text').textContent
        })""")

        check("V-1 window.__ready true", out["ready"] is True)
        check("V-1 facade keys exact",
              out["keys"] == "craftStep,data,engine,ready,save,share,state", out["keys"])
        check("V-1 namespace seven modules",
              out["ns"] == "Audio,Data,Engine,Main,Save,Scene,Share", out["ns"])
        check("DOM boots on D1", out["day"] == 1 and out["silver"] == 44)
        check("DOM intro active", out["active"] == "view-intro")
        check("DOM three slots render", out["slots"] == 3, str(out["slots"]))
        check("§3.3 drawer six top-level rows", out["drawerRows"] == 6, str(out["drawerRows"]))
        check("V-1 no page errors", errs == [], str(errs))

        # §6.3.4: every ending line reads as reunion, never as loss
        codes = pg.evaluate("""() => {
          const E = window.YueYan.Engine, D = window.YueYan.Data;
          return Object.keys(D.endings).map(k =>
            ({ code: k, name: D.endings[k].name, text: D.endings[k].text,
               len: D.endings[k].text.length }));
        }""")
        check("DOM five endings", len(codes) == 5, str(len(codes)))
        NEG = ["可惜", "遗憾", "未完成", "失败", "失望", "归零"]
        bad = [c["code"] for c in codes if any(w in c["text"] for w in NEG)]
        check("V-19 endings have no negative framing", bad == [], str(bad))

        # share card builds without a network call
        card = pg.evaluate("""() => {
          const Sh = window.YueYan.Share, E = window.YueYan.Engine;
          const st = E.runRoute([[],[],[],[],[],[],[]],
            {grandma:null,father:null,mother:null,younger:null,brother:null});
          return Sh.build(st).slice(0, 22);
        }""")
        check("DOM share card is png", card == "data:image/png;base64,", card)

        b.close()


runtime()

print("")
if FAILS:
    print("SMOKE FAILED: %d" % len(FAILS))
    for f in FAILS:
        print("  - " + f)
    sys.exit(1)
print("SMOKE PASSED")
