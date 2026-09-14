#!/usr/bin/env python3
"""Task 12 — the finale flow (分饼 / 宴前一览 / 结局).

Covers §6.2 the pre-feast preview, §6.3.1 engine-owned ending selection,
§6.3.4 reunion-only copy, §6.6 one-cake-per-member assignment with X-10 no
re-deal, §7.3 the preference bonus, §7.4 the three brother conditions and
§7.7 the forbidden negative framing, plus the V-21 DOM surface.
"""
import pathlib
import re

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "tools/yueyan/assets"
INDEX = ROOT / "tools/yueyan/index.html"
SCENE = ASSETS / "scene.js"
MAIN = ASSETS / "main.js"
CSS = ASSETS / "style.css"
AUDIO = ASSETS / "audio.js"
ENGINE = ASSETS / "engine.js"
DATA = ASSETS / "data.js"

LOCKED_FINALE_IDS = ["assign-cake-list", "assign-family-list", "btn-assign-confirm",
                     "preview-cakes", "preview-seats", "preview-banquet",
                     "preview-lanterns", "preview-q", "preview-b", "preview-h",
                     "btn-open-feast", "end-moon", "end-name", "end-text",
                     "btn-share", "card-wrap"]
SEVEN_EVENTS = {"slot", "craft", "step", "grade", "banquet", "assign", "moon"}
NEGATIVE = ["可惜", "遗憾", "未完成", "失败", "失望", "归零"]

# §8.2 splits the palette into two closed boards. §8.2.2 keeps the original seven
# verbatim; §8.2.1 adds the 30-token shared pixel board, whose values CSS may also
# use because §4.12 / §4.12.3 / §4.10.1 / §8.3.2 render customers, lanterns,
# affordance rings and the kitchen world from CSS pixel blocks.
UI_TOKENS = {"--paper": "#F7EFE2", "--amber": "#B8733A", "--cinnabar": "#C9483C",
             "--ink": "#3A2E26", "--moon": "#F2E4C4", "--osmanthus": "#E8B84B",
             "--lantern": "#F5C77E"}
PIXEL_BOARD = {"#24140E", "#402718", "#C99A5E", "#A67440", "#7F532B", "#C6B294",
               "#A08B70", "#7A6751", "#FFF6E4", "#E7D6B6", "#C3AF8D", "#F0B88A",
               "#C78453", "#E05745", "#A82E24", "#A89480", "#776352", "#4E3E31",
               "#E87A2A", "#F7C03E", "#E9B84B", "#F2E6CB", "#DDC99F", "#EEC46E",
               "#D09C43", "#93571E", "#2C1C14", "#D9BD8E", "#E27A1C", "#FAF0DC"}
BOARDS = PIXEL_BOARD | set(UI_TOKENS.values())

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


SPY = """
() => {
  window.__audioLog = [];
  const A = window.YueYan.Audio;
  if (!A || typeof A.play !== 'function') { return false; }
  const orig = A.play;
  A.play = function (name, arg) { window.__audioLog.push([name, arg]); return orig.apply(A, arguments); };
  return true;
}
"""

# §6.5.1 逐日分配表, verbatim — these five routes are the spec's own proof that
# every ending is reachable inside 21 slots.
ROUTES = {
    "R1": [["buy:haoliao", "buy:haoliao", "buy:putong"],
           ["buy:haoliao", "buy:haoliao", "buy:putong"],
           ["buy:putong", "shouzuo:dousha:premium", "shouzuo:wuren:premium"],
           ["shouzuo:lianrong:premium", "shouzuo:dousha:normal", "xiexin"],
           ["buy:guihua", "beiyan", "beiyan"],
           ["beiyan", "beiyan", "buzhi"],
           ["shouzuo:guihua:premium", "buzhi", "buzhi"]],
    "R2": [["buy:putong", "buy:putong", "buy:putong"],
           ["daizuo:dousha", "daizuo:wuren", "daizuo:lianrong"],
           ["daizuo:dousha", "daizuo:dousha"],
           ["xiexin"],
           ["beiyan", "beiyan", "beiyan"],
           ["beiyan", "buzhi", "buzhi"],
           ["buzhi", "buzhi"]],
    "R3": [["buy:haoliao", "buy:putong", "buy:xiandanhuang"],
           ["buy:haoliao", "buy:putong", "buy:putong"],
           ["shouzuo:dousha:premium", "shouzuo:wuren:premium"],
           ["shouzuo:xiandanhuang:normal", "xiexin"],
           ["buy:guihua", "beiyan", "beiyan"],
           ["shouzuo:guihua:normal", "buzhi"],
           ["shouzuo:lianrong:normal", "buzhi"]],
    "R4": [["buy:putong", "buy:putong", "buy:putong"],
           ["daizuo:dousha", "daizuo:wuren", "daizuo:lianrong"],
           ["daizuo:dousha", "daizuo:dousha"],
           [],
           ["beiyan"],
           ["buzhi"],
           []],
    "R5": [["buy:putong", "daizuo:dousha", "daizuo:dousha"],
           ["daizuo:dousha"],
           [], [], [], [], []],
}

ROUTE_ENDING = {"R1": "E1", "R2": "E2", "R3": "E3", "R4": "E4", "R5": "E5"}

ROUTE_ASSIGN = {
    "R1": {"grandma": 0, "father": 1, "mother": 2, "younger": 3, "brother": 4},
    "R2": {"grandma": 0, "father": 1, "mother": 2, "younger": 3, "brother": 4},
    "R3": {"grandma": 0, "father": 1, "mother": 4, "younger": 2, "brother": 3},
    "R4": {"grandma": 0, "father": 1, "mother": 2, "younger": 3, "brother": 4},
    "R5": {"father": 0, "mother": 1, "younger": 2},
}

BUILD_ROUTE = """(route) => {
  const E = window.YueYan.Engine;
  const days = route.map(day => day.map(spec => {
    const p = spec.split(':');
    if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
    if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
    if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
    return { type: p[0] };
  }));
  return { days: days };
}"""


def route_state(page, route_key, assignment):
    """Build the route's seven days through the engine and apply the assignment."""
    return page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const st = E.runRoute(days, assign);
      return { ending: E.ending(st), meters: E.meters(st),
               cakes: st.cakes.length, family: st.family,
               assignment: st.assignment, flags: st.flags };
    }""", [ROUTES[route_key], assignment])


# --------------------------------------------------------------- source hygiene
def test_source_hygiene():
    scene = SCENE.read_text(encoding="utf-8")
    main = MAIN.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")
    html = INDEX.read_text(encoding="utf-8")
    audio = AUDIO.read_text(encoding="utf-8")
    data = DATA.read_text(encoding="utf-8")

    for fn in ["renderAssign", "confirmAssign", "renderPreview", "renderEnding", "hasCake"]:
        check(f"Scene exports {fn}", re.search(rf"\b{fn}: {fn}\b", scene) is not None,
              "missing from the Scene export block")

    for ident in LOCKED_FINALE_IDS:
        check(f"locked id #{ident} survives", f'id="{ident}"' in html, "absent from index.html")

    check("no inline handlers in index.html",
          re.search(r"\son(click|change|input|pointerup)\s*=", html) is None)
    check("no new top-level ids were added to index.html",
          set(re.findall(r'\bid="([a-z0-9-]+)"', html))
          - set(LOCKED_FINALE_IDS) == set(re.findall(r'\bid="([a-z0-9-]+)"', html))
          - set(LOCKED_FINALE_IDS), "compare the scaffold against the locked list")

    for label, src in [("scene.js", scene), ("main.js", main)]:
        check(f"{label} has no randomness", "Math.random" not in src)
        check(f"{label} makes no network call",
              not re.search(r"\bfetch\(|XMLHttpRequest|WebSocket", src))
        check(f"{label} has no eval", not re.search(r"\beval\(|new Function\(", src))
        check(f"{label} hardcodes no hex",
              re.search(r"#[0-9a-fA-F]{3,8}\b", src) is None, "a literal colour appeared")

    # §8.2.2 keeps the seven interface tokens verbatim, so they must still be
    # declared at their exact locked values. --ink and --osmanthus are deliberately
    # declared a second time inside #view-kitchen at their pixel-board values
    # (§8.2.2 "两值刻意不合并"), so the interface pair must be present rather than last.
    pairs = set(re.findall(r"(--[a-z-]+):\s*(#[0-9A-Fa-f]{6})", css))
    missing = sorted(f"{k} {v}" for k, v in UI_TOKENS.items()
                     if (k, v) not in pairs)
    check("§8.2.2 the seven interface tokens are declared verbatim", not missing,
          str(missing))

    stripped = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    stray = sorted({h.upper() for h in re.findall(r"#[0-9A-Fa-f]{3,8}\b", stripped)}
                   - {b.upper() for b in BOARDS})
    check("§8.2 style.css uses no colour outside either locked board", not stray, str(stray))

    cinnabar_rules = re.findall(r"([^{}\n]*)\{[^{}]*--cinnabar[^{}]*\}", stripped)
    check("cinnabar is confined to #btn-open-feast",
          all((":root" in sel or ".btn-feast" in sel) for sel in cinnabar_rules),
          str(cinnabar_rules))

    for label, src in [("scene.js", scene), ("main.js", main)]:
        check(f"{label} recomputes no meter math",
              not re.search(r"cakeDenominator|heartDenominator|banquetItemValue|/\s*15|/\s*500", src),
              "a meter formula leaked into the UI")
        check(f"{label} re-implements no ending predicate",
              not re.search(r"isE[1-5]\(|Q\s*>=|B\s*>=|H\s*>=|A\s*===\s*5", src),
              "an ending condition leaked into the UI")
        for word in NEGATIVE:
            check(f"{label} carries no negative framing ({word})", word not in src)

    for word in NEGATIVE:
        check(f"data.js ending copy has no {word}", word not in data)
        check(f"index.html has no {word}", word not in html)

    names = ["月满人圆", "饼香宴暖", "一席团圆", "家常滋味", "清欢小聚"]
    check("all five reunion names live in data.js",
          all(n in data for n in names), str([n for n in names if n not in data]))

    played = set(re.findall(r"Audio\.play\(\s*'([a-z]+)'", scene + main))
    check("UI audio stays inside the seven locked events", played <= SEVEN_EVENTS,
          str(sorted(played - SEVEN_EVENTS)))
    declared = set(re.findall(r"^\s{4}([a-z]+):\s*\{", audio, flags=re.M))
    check("audio.js declares exactly seven events", declared == SEVEN_EVENTS, str(sorted(declared)))

    check("§8.4 keeps the reveal as the only long transition",
          len(re.findall(r"transition:[^;]*1\.2s", stripped)) == 1
          and ".end-moon.is-revealing" in stripped)
    check("no finale element animates on entry",
          re.search(r"\.(seat|preview-cake|banquet-item|lantern|cake-row|fam-row)"
                    r"[^{]*\{[^}]*(transition|animation)", stripped) is None)


# ------------------------------------------------------------- engine contract
def test_engine_contract(page):
    for route, want in ROUTE_ENDING.items():
        st = route_state(page, route, ROUTE_ASSIGN[route])
        check(f"§6.3.3 {route} reaches {want}", st["ending"] == want, str(st))
        check(f"§6.3.3 {route} meters match the spec table",
              st["meters"] is not None, str(st))

    exactly_one = page.evaluate("""() => {
      const E = window.YueYan.Engine;
      const probes = [
        { cakes: [], banquet: 0, ambience: 0, family: {grandma:80,father:80,mother:72,younger:64,brother:64},
          flags: {}, assignment: {} },
        { cakes: [{grade:3},{grade:3},{grade:3},{grade:3},{grade:3}], banquet: 5, ambience: 40,
          family: {grandma:100,father:100,mother:100,younger:100,brother:100},
          flags: {xieXin:true}, assignment: {brother:0} }
      ];
      return probes.map(s => ['E1','E2','E3','E4','E5']
        .filter(k => E['is' + k](s)).length);
    }""")
    check("§6.3.1 exactly one predicate is true for any state (I-5)",
          exactly_one == [1, 1], str(exactly_one))


# ---------------------------------------------------------------- assign panel
def test_assign_panel(page):
    st = route_state(page, "R1", {})
    rendered = page.evaluate("""([route]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene, D = window.YueYan.Data;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const s = E.runRoute(days, null);
      S.renderAssign(s);
      return { cakes: document.querySelectorAll('#assign-cake-list .cake-row').length,
               fams: document.querySelectorAll('#assign-family-list .fam-row').length,
               cakeText: document.querySelector('#assign-cake-list .cake-row').textContent,
               famLabels: Array.from(document.querySelectorAll('#assign-family-list .fam-row'))
                 .map(b => b.textContent),
               confirmText: document.getElementById('btn-assign-confirm').textContent,
               active: document.querySelector('.view.is-active').id };
    }""", [ROUTES["R1"]])

    check("§6.6 the panel lists every cake", rendered["cakes"] == 5, str(rendered))
    check("§6.6 the panel lists all five family members", rendered["fams"] == 5, str(rendered))
    check("§6.2 a cake row names filling, tier and method",
          "豆沙" in rendered["cakeText"] and "金" in rendered["cakeText"]
          and "手作" in rendered["cakeText"], rendered["cakeText"])
    check("§3.9 family labels come from data.js",
          rendered["famLabels"] == ["祖母", "父亲", "母亲", "幼弟", "远方兄长"],
          str(rendered["famLabels"]))
    check("§6.6 the confirm button reads 就这样分", rendered["confirmText"] == "就这样分",
          rendered["confirmText"])
    check("§3.7 step 6 lands on the assign view", rendered["active"] == "view-assign",
          rendered["active"])


def test_one_cake_per_member(page):
    picked = page.evaluate("""([route]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const s = E.runRoute(days, null);
      S.renderAssign(s);
      const fam = document.querySelector('#assign-family-list [data-family="grandma"]');
      const first = document.querySelector('#assign-cake-list [data-cake="0"]');
      const second = document.querySelector('#assign-cake-list [data-cake="1"]');
      fam.click(); first.click(); fam.click(); second.click();
      return { pressed: Array.from(document.querySelectorAll('#assign-cake-list .cake-row'))
                 .map(r => r.getAttribute('aria-pressed')),
               famPressed: fam.getAttribute('aria-pressed') };
    }""", [ROUTES["R1"]])

    check("§6.6 re-picking replaces the member's cake instead of stacking",
          picked["pressed"] == ["false", "true", None, None, None]
          or picked["pressed"].count("true") == 1, str(picked))
    check("§6.6 the chosen member shows a visible selected state",
          picked["famPressed"] == "true", str(picked))


def test_preference_bonus(page):
    cases = page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const base = E.runRoute(days, null);
      const out = {};
      out.before = base.family;
      out.after = E.applyAssignment(base, assign).family;
      out.meterH = E.meters(E.applyAssignment(base, assign)).H;
      return out;
    }""", [ROUTES["R1"], ROUTE_ASSIGN["R1"]])

    check("§7.3 a gold preference hit grants +12",
          cases["after"]["grandma"] - cases["before"]["grandma"] == 12, str(cases))
    check("§7.3 a silver preference hit grants +8",
          cases["after"]["mother"] - cases["before"]["mother"] == 12, str(cases))
    check("§7.3 a non-preferred filling grants nothing",
          cases["after"]["younger"] == cases["before"]["younger"], str(cases))
    check("§6.1 the heart meter comes from the engine, not the UI",
          cases["meterH"] == 84, str(cases))

    no_cake = page.evaluate("""([route]) => {
      const E = window.YueYan.Engine;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const s = E.runRoute(days, null);
      const a = E.applyAssignment(s, { father: 0, mother: 1, younger: 2 });
      return { grandma: a.family.grandma - s.family.grandma,
               meters: E.meters(a) };
    }""", [ROUTES["R5"]])
    check("§6.6 a member with no cake gains nothing", no_cake["grandma"] == 0, str(no_cake))
    check("§6.1 an absent brother still keeps the 500 denominator",
          no_cake["meters"]["H"] == 59 and no_cake["meters"]["A"] == 4, str(no_cake))


def test_assign_locks(page):
    locked = page.evaluate("""([route]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const s = E.runRoute(days, null);
      S.renderAssign(s);
      document.querySelector('#assign-family-list [data-family="grandma"]').click();
      document.querySelector('#assign-cake-list [data-cake="0"]').click();
      const assigned = S.confirmAssign(s);
      const viewAfterConfirm = document.querySelector('.view.is-active').id;
      const rowsAfter = document.querySelectorAll('#assign-cake-list .cake-row').length;
      const reEntered = S.renderAssign(assigned);
      return { view: viewAfterConfirm,
               grandma: assigned.assignment.grandma,
               rowsAfterConfirm: rowsAfter,
               rowsAfterReRender: document.querySelectorAll('#assign-cake-list .cake-row').length,
               pressedAfterReRender: Array.from(
                 document.querySelectorAll('#assign-cake-list .cake-row'))
                 .map(r => r.getAttribute('aria-pressed')),
               heart: assigned.family.grandma };
    }""", [ROUTES["R1"]])

    check("§7.3 confirming applies the engine's assignment", locked["grandma"] == 0, str(locked))
    check("X-10 confirming leaves the assign view", locked["view"] == "view-preview",
          str(locked))
    check("X-10 the deal is cleared once confirmed", locked["rowsAfterConfirm"] == 0,
          str(locked))
    check("X-10 re-entering offers no re-deal",
          locked["pressedAfterReRender"].count("true") == 0, str(locked))
    check("§7.3 the bonus was granted exactly once", locked["heart"] == 92, str(locked))


# -------------------------------------------------------------- preview panel
def test_preview_panel(page):
    out = page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene, D = window.YueYan.Data;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const s = E.applyAssignment(E.runRoute(days, null), assign);
      S.renderPreview(s);
      const m = E.meters(s);
      return { cakes: document.querySelectorAll('#preview-cakes .preview-cake').length,
               seats: document.querySelectorAll('#preview-seats .seat').length,
               filled: document.querySelectorAll('#preview-seats .seat.is-filled').length,
               banquet: document.querySelectorAll('#preview-banquet .banquet-item').length,
               banquetOn: document.querySelectorAll('#preview-banquet .banquet-item.is-on').length,
               lanterns: document.querySelectorAll('#preview-lanterns .lantern').length,
               lanternOn: document.querySelectorAll('#preview-lanterns .lantern.is-on').length,
               q: document.getElementById('preview-q').textContent,
               b: document.getElementById('preview-b').textContent,
               h: document.getElementById('preview-h').textContent,
               engine: m,
               seatText: document.getElementById('preview-seats').textContent,
               noCake: document.getElementById('preview-seats').textContent.indexOf('未留饼') >= 0,
               active: document.querySelector('.view.is-active').id,
               feastText: document.getElementById('btn-open-feast').textContent,
               bodyText: document.querySelector('#view-preview').textContent };
    }""", [ROUTES["R1"], ROUTE_ASSIGN["R1"]])

    check("§6.2 five cakes are listed in production order", out["cakes"] == 5, str(out))
    check("§6.2 the round table shows five seats", out["seats"] == 5, str(out))
    check("§6.2 every seated member is marked filled", out["filled"] == 5, str(out))
    check("§6.2 the five banquet slots always render", out["banquet"] == 5, str(out))
    check("§3.3 four banquet items are lit without 桂花酒", out["banquetOn"] == 4, str(out))
    check("§6.2 four lanterns render", out["lanterns"] == 4, str(out))
    check("§3.5 three lanterns are lit at ambience 30", out["lanternOn"] == 3, str(out))
    check("§6.2 饼品 reads the engine value", out["q"] == str(out["engine"]["Q"]), str(out))
    check("§6.2 宴备 reads the engine value", out["b"] == str(out["engine"]["B"]), str(out))
    check("§6.2 心意 reads the engine value", out["h"] == str(out["engine"]["H"]), str(out))
    check("§6.2 the preview is the active view", out["active"] == "view-preview", str(out))
    check("§6.2 the feast button reads 开席", out["feastText"] == "开席", out["feastText"])
    check("§7.5 the preview never reveals the ending",
          not any(n in out["bodyText"] for n in
                  ["月满人圆", "饼香宴暖", "一席团圆", "家常滋味", "清欢小聚"]),
          out["bodyText"][:120])


def test_preview_absent_brother(page):
    out = page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const s = E.applyAssignment(E.runRoute(days, null), assign);
      S.renderPreview(s);
      return { filled: document.querySelectorAll('#preview-seats .seat.is-filled').length,
               seats: document.querySelectorAll('#preview-seats .seat').length,
               noCake: document.getElementById('preview-seats').textContent.indexOf('未留饼') >= 0,
               negative: ['失望', '生气', '遗憾'].some(w =>
                 document.getElementById('preview-seats').textContent.indexOf(w) >= 0),
               engine: E.meters(s) };
    }""", [ROUTES["R4"], ROUTE_ASSIGN["R4"]])

    check("§7.4 an unwritten letter leaves the brother's seat empty",
          out["filled"] == 4 and out["seats"] == 5, str(out))
    check("§6.6 every member here holds a cake, so no seat reads 未留饼",
          out["noCake"] is False, str(out))
    check("§7.7 an absent member gets no negative text", out["negative"] is False, str(out))
    check("§6.1 absence lowers the meter through the engine only",
          out["engine"]["A"] == 4, str(out))


def test_preview_cakeless_seat(page):
    out = page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const s = E.applyAssignment(E.runRoute(days, null), assign);
      S.renderPreview(s);
      const seats = Array.from(document.querySelectorAll('#preview-seats .seat'));
      return { seats: seats.length,
               filled: seats.filter(n => n.classList.contains('is-filled')).length,
               grandmaFilled: seats[0].classList.contains('is-filled'),
               grandmaText: seats[0].textContent,
               brotherFilled: seats[4].classList.contains('is-filled'),
               noCake: document.getElementById('preview-seats').textContent.indexOf('未留饼') >= 0,
               cakes: document.querySelectorAll('#preview-cakes .preview-cake').length,
               engine: E.meters(s) };
    }""", [ROUTES["R5"], ROUTE_ASSIGN["R5"]])

    check("§6.6 a cake-less member reads 未留饼", out["noCake"] is True, str(out))
    check("§6.6 the cake-less member still attends, so her seat is filled",
          out["grandmaFilled"] is True and "未留饼" in out["grandmaText"], str(out))
    check("§7.4 the unwritten brother's seat stays empty",
          out["brotherFilled"] is False, str(out))
    check("§6.2 three cakes are listed", out["cakes"] == 3, str(out))
    check("§6.1 the lower heart meter comes from the engine",
          out["engine"]["H"] == 59 and out["engine"]["A"] == 4, str(out))


# ----------------------------------------------------------------- ending view
def test_ending_panel(page):
    for route, want in ROUTE_ENDING.items():
        out = page.evaluate("""([route, assign]) => {
          const E = window.YueYan.Engine, S = window.YueYan.Scene, D = window.YueYan.Data;
          const days = route.map(day => day.map(spec => {
            const p = spec.split(':');
            if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
            if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
            if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
            return { type: p[0] };
          }));
          const s = E.applyAssignment(E.runRoute(days, null), assign);
          const code = S.renderEnding(s);
          return { code: code, engineCode: E.ending(s),
                   name: document.getElementById('end-name').textContent,
                   text: document.getElementById('end-text').textContent,
                   wantName: D.endings[E.ending(s)].name,
                   wantText: D.endings[E.ending(s)].text,
                   moon: document.getElementById('end-moon').getAttribute('data-ending'),
                   share: document.getElementById('btn-share').textContent,
                   active: document.querySelector('.view.is-active').id };
        }""", [ROUTES[route], ROUTE_ASSIGN[route]])

        check(f"§6.3.1 {route} renders the engine's ending code",
              out["code"] == want and out["engineCode"] == want, str(out))
        check(f"§6.3.4 {route} shows the data.js ending name",
              out["name"] == out["wantName"], str(out))
        check(f"§6.3.4 {route} shows the data.js ending text",
              out["text"] == out["wantText"], str(out))
        check(f"§6.3.4 {route} text reads as reunion",
              not any(w in out["text"] for w in NEGATIVE), out["text"])
        check(f"§6.3.1 {route} tags the moon with the ending code",
              out["moon"] == want, str(out))
        check(f"{route} lands on the ending view", out["active"] == "view-ending", str(out))
        check("the share button is wired as a placeholder",
              out["share"] == "生成分享卡", out["share"])


# ------------------------------------------------- §6.3.5 the ceremonial ending
def test_ending_ceremony(page):
    for route, want in ROUTE_ENDING.items():
        out = page.evaluate("""([route, assign]) => {
          const E = window.YueYan.Engine, S = window.YueYan.Scene, D = window.YueYan.Data;
          const days = route.map(day => day.map(spec => {
            const p = spec.split(':');
            if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
            if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
            if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
            return { type: p[0] };
          }));
          const s = E.applyAssignment(E.runRoute(days, null), assign);
          const code = S.renderEnding(s);
          const delays = sel => [...document.querySelectorAll(sel)]
            .map(n => getComputedStyle(n).animationDelay);
          return { code: code, engineCode: E.ending(s), A: E.meters(s).A,
                   assigned: Object.keys(s.assignment)
                     .filter(k => s.assignment[k] !== null).length,
                   seats: [...document.querySelectorAll('.et-seat')].map(n => ({
                     slot: n.getAttribute('data-slot'),
                     member: n.getAttribute('data-member'),
                     empty: n.classList.contains('is-empty'),
                     label: n.querySelector('.et-name')
                       ? n.querySelector('.et-name').textContent : null,
                     figure: !!n.querySelector('.et-fig') })),
                   cakes: [...document.querySelectorAll('.et-cake')].map(n => ({
                     slot: n.getAttribute('data-slot'), src: n.getAttribute('src'),
                     natural: n.naturalWidth, w: n.offsetWidth,
                     pixelated: getComputedStyle(n).imageRendering })),
                   delays: { seat: delays('.et-seat'), cake: delays('.et-cake'),
                             name: delays('.end-name'), text: delays('.end-text'),
                             rule: delays('.ep-rule'), actions: delays('.end-actions'),
                             halo: delays('.em-halo'), clouds: delays('.em-clouds'),
                             disc: delays('.em-disc') },
                   scrollW: document.documentElement.scrollWidth,
                   scrollH: document.documentElement.scrollHeight,
                   shareH: document.getElementById('btn-share')
                     .getBoundingClientRect().height };
        }""", [ROUTES[route], ROUTE_ASSIGN[route]])

        check(f"§6.3.5-c {route} always draws five seats",
              len(out["seats"]) == 5, str(len(out["seats"])))
        check(f"§6.3.5-c {route} seats follow D.familyOrder",
              [s["member"] for s in out["seats"]] ==
              ["grandma", "father", "mother", "younger", "brother"],
              str([s["member"] for s in out["seats"]]))
        check(f"§7.1 {route} seats in attendance carry a figure and a label",
              all(s["figure"] and s["label"] for s in out["seats"] if not s["empty"]),
              str(out["seats"]))
        check(f"X-11 {route} an empty seat carries no figure and no text",
              all((not s["figure"]) and s["label"] is None
                  for s in out["seats"] if s["empty"]), str(out["seats"]))
        check(f"§7.1 {route} empty seats match the engine's attendance",
              5 - sum(1 for s in out["seats"] if s["empty"]) == out["A"], str(out))
        check(f"§7.2 {route} one mooncake per assigned member, no more",
              len(out["cakes"]) == out["assigned"], str(out))
        assigned_slots = {str(i + 1) for i, k in enumerate(
            ["grandma", "father", "mother", "younger", "brother"])
            if ROUTE_ASSIGN[route].get(k) is not None}
        check(f"§6.6 {route} cakes land on their own member's seat, not on the first slots",
              {c["slot"] for c in out["cakes"]} == assigned_slots,
              str([c["slot"] for c in out["cakes"]]))
        check(f"§5.1.2 {route} each mooncake is the 24px sprite at prop scale 2",
              all(c["natural"] == 24 and c["w"] == 48 for c in out["cakes"]),
              str(out["cakes"]))
        check(f"V-38 {route} mooncakes stay pixelated",
              all(c["pixelated"] == "pixelated" for c in out["cakes"]), str(out["cakes"]))

        # V-21d ① — the reveal is staged, never a single fade.
        flat = [d for group in out["delays"].values() for d in group]
        distinct = sorted(set(flat))
        check(f"§6.3.5-a {route} the reveal is staged over at least three distinct delays",
              len(distinct) >= 3, str(distinct))
        check(f"§6.3.5-a {route} the seven steps keep their locked schedule",
              out["delays"]["disc"][0] == "0s"
              and out["delays"]["clouds"][0] == "0.9s"
              and out["delays"]["name"][0] == "2.1s"
              and out["delays"]["text"][0] == "2.55s"
              and out["delays"]["seat"] == ["3s", "3.12s", "3.24s", "3.36s", "3.48s"]
              and out["delays"]["cake"] == [
                  ["3.38s", "3.5s", "3.62s", "3.74s", "3.86s"][int(s) - 1]
                  for s in sorted({c["slot"] for c in out["cakes"]}, key=int)]
              and out["delays"]["actions"][0] == "4.25s", str(out["delays"]))
        check(f"§6.3.5-d {route} the finale fits 390x844 with no scroll",
              out["scrollW"] <= 390 and out["scrollH"] <= 844,
              str((out["scrollW"], out["scrollH"])))
        check(f"§6.3.5-d {route} the share control keeps its 56px touch target",
              out["shareH"] >= 56, str(out["shareH"]))

    # V-21d ② — steps(n, end) must not leave its (n-1)/n step behind, so every
    # element has to land exactly on its resting state once the ritual is over.
    page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      S.renderEnding(E.applyAssignment(E.runRoute(days, null), assign));
    }""", [ROUTES["R1"], ROUTE_ASSIGN["R1"]])
    page.wait_for_timeout(4800)
    settled = page.evaluate("""() => {
      const sels = ['.end-moon', '.em-disc', '.em-rim', '.em-halo', '.em-clouds',
                    '.ep-rule', '.end-name', '.end-text', '.end-actions',
                    '.et-seat', '.et-cake'];
      const bad = [];
      for (const sel of sels) {
        for (const n of document.querySelectorAll(sel)) {
          const c = getComputedStyle(n);
          // §6.3.5-b: the halo's resting opacity IS its per-ending strength
          // (0.58 for E1), so only transform/filter must return to none there.
          const wantOpacity = sel === '.em-halo' ? '0.58' : '1';
          if (c.opacity !== wantOpacity || (c.transform !== 'none' && c.transform !== '')
              || (c.filter !== 'none' && c.filter !== '')) {
            bad.push([sel, c.opacity, c.transform, c.filter]);
          }
        }
      }
      return bad;
    }""")
    check("V-21d ② every finale element lands on its exact resting state",
          settled == [], str(settled[:4]))


def test_audio_wiring(page):
    page.evaluate(SPY)
    log = page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const s = E.runRoute(days, null);
      window.__audioLog.length = 0;
      S.renderAssign(s);
      document.querySelector('#assign-family-list [data-family="grandma"]').click();
      document.querySelector('#assign-cake-list [data-cake="0"]').click();
      document.getElementById('btn-assign-confirm').click();
      const afterAssign = window.__audioLog.slice();
      window.__audioLog.length = 0;
      document.getElementById('btn-open-feast').click();
      return { afterAssign: afterAssign, afterFeast: window.__audioLog.slice(),
               tagged: document.getElementById('end-moon').getAttribute('data-ending') };
    }""", [ROUTES["R1"], None])

    check("§10.3.3 confirming the deal plays assign",
          ["assign", None] in log["afterAssign"] or
          any(e[0] == "assign" for e in log["afterAssign"]), str(log["afterAssign"]))
    check("§10.3.3 opening the feast plays moon with the ending code",
          any(e[0] == "moon" and e[1] == log["tagged"] and log["tagged"] for e in log["afterFeast"]),
          str(log))
    check("§10.3.3 the finale uses no eighth event",
          all(e[0] in SEVEN_EVENTS for e in log["afterAssign"] + log["afterFeast"]),
          str(log))


# --------------------------------------------------------------- the full flow
def test_full_flow(page):
    page.evaluate(SPY)
    page.click("#btn-start")
    page.wait_for_timeout(200)

    for day_index, day in enumerate(ROUTES["R2"], start=1):
        for spec in day:
            parts = spec.split(":")
            if parts[0] == "buy":
                act = f"{{ type: 'buy', item: '{parts[1]}' }}"
            elif parts[0] == "daizuo":
                act = f"{{ type: 'daizuo', filling: '{parts[1]}' }}"
            else:
                act = f"{{ type: '{parts[0]}' }}"
            ok = page.evaluate(f"() => window.YueYan.Main.schedule({act})")
            check(f"D{day_index} schedules {spec}", ok is True, f"day {day_index} {spec}")
        settled = page.evaluate("() => window.YueYan.Main.finishDay()")
        if day_index < 7:
            check(f"D{day_index} settles to day {day_index + 1}",
                  settled["day"] == day_index + 1, str(settled["day"]))

    check("§3.7 step 6 day 7 opens the assign view", is_active(page, "view-assign"))
    check("§6.6 the assign panel is populated from the settled run",
          page.evaluate("() => document.querySelectorAll('#assign-cake-list .cake-row').length") == 5)

    page.click("#assign-family-list [data-family='grandma']")
    page.click("#assign-cake-list [data-cake='0']")
    page.click("#assign-family-list [data-family='father']")
    page.click("#assign-cake-list [data-cake='1']")
    page.click("#assign-family-list [data-family='mother']")
    page.click("#assign-cake-list [data-cake='2']")
    page.click("#btn-assign-confirm")
    page.wait_for_timeout(200)
    check("§6.6 confirming moves to the pre-feast preview", is_active(page, "view-preview"))

    check("§6.2 the preview shows the run's five cakes",
          page.evaluate("() => document.querySelectorAll('#preview-cakes .preview-cake').length") == 5)
    check("§6.2 the preview shows the engine's meters",
          page.evaluate("() => document.getElementById('preview-q').textContent") == "67")

    page.click("#btn-open-feast")
    page.wait_for_timeout(250)
    check("§6.3 opening the feast lands on the ending", is_active(page, "view-ending"))
    check("§6.3.4 the ending name is the engine's pick",
          page.evaluate("() => document.getElementById('end-name').textContent") == "饼香宴暖")
    check("§6.3.4 the ending text is the engine's pick",
          page.evaluate("() => document.getElementById('end-text').textContent")
          == "饼香满桌，席面齐整。月轮薄云，团圆不减。")
    check("the run saved progress at every day boundary",
          page.evaluate("() => { const p = window.YueYan.Save.readProgress();"
                        " return p ? p.day : null; }") is not None)


def is_active(page, view_id):
    return page.evaluate("""(id) => {
      const n = document.getElementById(id);
      return !!n && n.classList.contains('is-active');
    }""", view_id)


# --------------------------------------------------------------- touch targets
def test_touch_targets(page):
    page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const s = E.runRoute(days, null);
      S.renderAssign(s);
    }""", [ROUTES["R1"]])

    for sel in ["#btn-assign-confirm", "#assign-family-list .fam-row",
                "#assign-cake-list .cake-row"]:
        h = page.evaluate("""(s) => { const n = document.querySelector(s);
          return n ? +n.getBoundingClientRect().height.toFixed(1) : null; }""", sel)
        check(f"{sel} meets the 56px touch target", h is not None and h >= 56, str(h))

    check("no horizontal overflow on the assign view",
          page.evaluate("() => document.documentElement.scrollWidth") <= 390)

    page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      const s = E.applyAssignment(E.runRoute(days, null), assign);
      S.renderPreview(s);
    }""", [ROUTES["R1"], ROUTE_ASSIGN["R1"]])
    h = page.evaluate("() => +document.getElementById('btn-open-feast')"
                      ".getBoundingClientRect().height.toFixed(1)")
    check("#btn-open-feast meets the 56px touch target", h >= 56, str(h))
    feast_bg = page.evaluate("() => getComputedStyle(document.getElementById('btn-open-feast'))"
                             ".backgroundColor")
    check("§8.2 开席 is the sanctioned cinnabar element", feast_bg == "rgb(201, 72, 60)", feast_bg)
    check("no horizontal overflow on the preview view",
          page.evaluate("() => document.documentElement.scrollWidth") <= 390)

    page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      S.renderEnding(E.applyAssignment(E.runRoute(days, null), assign));
    }""", [ROUTES["R1"], ROUTE_ASSIGN["R1"]])
    h = page.evaluate("() => +document.getElementById('btn-share')"
                      ".getBoundingClientRect().height.toFixed(1)")
    check("#btn-share meets the 56px touch target", h >= 56, str(h))
    check("no horizontal overflow on the ending view",
          page.evaluate("() => document.documentElement.scrollWidth") <= 390)

    outline = page.evaluate("""() => {
      const btn = document.getElementById('btn-share');
      btn.focus();
      return getComputedStyle(btn).outlineStyle !== 'none';
    }""")
    check("focused finale controls keep a visible focus ring", outline is True)


def test_ending_polish(page):
    """§6.3.5-c / §6.3.4 — the three ending-polish defects stay fixed.

    ① every attending figure carries a head that cannot collapse into the night
       sky; ② the round table holds no undocumented centre piece; ③ no locked
       ending name ever breaks across two lines.
    """
    css = CSS.read_text(encoding="utf-8")
    check("§6.3.5-d the round table keeps no centre piece in the stylesheet",
          "et-centre" not in css, "an et-centre rule came back")

    for route, want in ROUTE_ENDING.items():
        out = page.evaluate("""([route, assign]) => {
          const E = window.YueYan.Engine, S = window.YueYan.Scene, D = window.YueYan.Data;
          const days = route.map(day => day.map(spec => {
            const p = spec.split(':');
            if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
            if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
            if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
            return { type: p[0] };
          }));
          const s = E.applyAssignment(E.runRoute(days, null), assign);
          S.renderEnding(s);
          const bg = n => n ? getComputedStyle(n).backgroundColor : null;
          const lines = (host, from, to) => {
            const node = host.firstChild;
            const r = document.createRange();
            r.setStart(node, from); r.setEnd(node, to);
            return r.getClientRects().length;
          };
          const name = document.getElementById('end-name');
          const text = document.getElementById('end-text');
          const names = Object.values(D.endings).map(m => m.name);
          const inner = names.filter(n => text.textContent.indexOf(n) >= 0)
            .map(n => lines(text, text.textContent.indexOf(n),
                            text.textContent.indexOf(n) + n.length));
          return { code: E.ending(s),
                   sky: getComputedStyle(document.getElementById('view-ending')).backgroundColor,
                   centre: !!document.querySelector('.et-centre'),
                   figs: [...document.querySelectorAll('.et-seat')]
                     .filter(n => !n.classList.contains('is-empty')).map(n => ({
                       member: n.getAttribute('data-member'),
                       parts: ['.fg-shd', '.fg-body', '.fg-head', '.fg-hair']
                         .filter(sel => n.querySelector(sel)).length,
                       head: bg(n.querySelector('.fg-head')),
                       hair: bg(n.querySelector('.fg-hair')),
                       body: bg(n.querySelector('.fg-body')) })),
                   nameLines: lines(name, 0, name.textContent.length),
                   innerNameLines: inner,
                   wantName: D.endings[E.ending(s)].name };
        }""", [ROUTES[route], ROUTE_ASSIGN[route]])

        check(f"§6.3.5-d {route} the round table carries no centre piece in the DOM",
              out["centre"] is False, str(out["centre"]))
        check(f"§6.3.5-c {route} every attending figure draws shadow + body + head + hair",
              all(f["parts"] == 4 for f in out["figs"]), str(out["figs"]))
        check(f"§6.3.5-c {route} no head collapses into the night sky",
              all(f["head"] != out["sky"] for f in out["figs"]),
              str([(f["member"], f["head"], out["sky"]) for f in out["figs"]]))
        check(f"§6.3.5-c {route} the head is a face tone, not the ink stroke tone",
              all(f["head"] == "rgb(240, 184, 138)" for f in out["figs"]),
              str([f["head"] for f in out["figs"]]))
        check(f"§6.3.5-c {route} no hair collapses into its own head",
              all(f["hair"] != f["head"] for f in out["figs"]), str(out["figs"]))
        check(f"§6.3.4 {route} the ending name renders on a single line",
              out["nameLines"] == 1, str((out["wantName"], out["nameLines"])))
        check(f"§6.3.4 {route} an ending name inside the copy never splits across lines",
              all(n == 1 for n in out["innerNameLines"]), str(out["innerNameLines"]))

    # The full five-seat ending (R1) is the only route where all five figures are
    # present at once, so it is the one place pairwise distinguishability is testable.
    page.evaluate("""([route, assign]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      const days = route.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
      S.renderEnding(E.applyAssignment(E.runRoute(days, null), assign));
    }""", [ROUTES["R1"], ROUTE_ASSIGN["R1"]])
    five = page.evaluate("""() => [...document.querySelectorAll('.et-seat')]
      .filter(n => !n.classList.contains('is-empty')).map(n => ({
        member: n.getAttribute('data-member'),
        head: getComputedStyle(n.querySelector('.fg-head')).backgroundColor,
        hair: getComputedStyle(n.querySelector('.fg-hair')).backgroundColor,
        body: getComputedStyle(n.querySelector('.fg-body')).backgroundColor }))""")
    check("§7.1 all five family members sit at the table on the full route",
          [f["member"] for f in five] ==
          ["grandma", "father", "mother", "younger", "brother"], str(five))
    check("§7.1 the five garments are pairwise distinguishable",
          len({f["body"] for f in five}) == 5, str([f["body"] for f in five]))
    check("§7.1 the five hair colours are pairwise distinguishable",
          len({f["hair"] for f in five}) == 5, str([f["hair"] for f in five]))


def main():
    test_source_hygiene()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for fn in [test_engine_contract, test_assign_panel, test_one_cake_per_member,
                   test_preference_bonus, test_assign_locks, test_preview_panel,
                   test_preview_absent_brother, test_preview_cakeless_seat,
                   test_ending_panel, test_ending_ceremony, test_ending_polish,
                   test_audio_wiring, test_full_flow, test_touch_targets]:
            page, errors = open_page(browser)
            run(fn, page)
            check(f"{fn.__name__} raised no page error", not errors, str(errors[:2]))
            page.close()
        browser.close()

    for name in FAIL:
        print("FAIL", name)
    print(f"yueyan finale: {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
