#!/usr/bin/env python3
"""月宴 UI assertions: Task 10 intro + the seven-day scheduler DOM path.

Headless Playwright at the locked 390x844 portrait viewport. This suite drives
the real DOM the way a thumb does: tap start, tap an empty slot, read the
bottom-sheet rows, tap a variant, undo, end the day. It never calls engine
hooks to fake a result, so a greying that disagrees with Engine.actionOk shows
up here rather than in the engine suite.

Contracts locked by the spec and DESIGN.md, asserted below:
  §5.2  lunar dates 初八..十四 in the day label, never "Day N"; filled slots
        carry a mark, not a counter; the day-end button reads 今日收工; a
        gated purchase branch reads 市集无货.
  §3.3  six top-level action rows; 制饼 expands into 代做 / 手作; every greyed
        row carries the reason the engine predicate produced.
  §8.4  no transition / animation inside the slot grid, no rAF-driven UI.
  §8.2  seven palette tokens only; scene.js hardcodes no hex.
  V-18  day label + no numeric day anywhere in the rendered text.
"""
import json
import pathlib
import re
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOOL = ROOT / "tools/yueyan"
INDEX = TOOL / "index.html"
SCENE = TOOL / "assets/scene.js"
MAIN = TOOL / "assets/main.js"
CSS = TOOL / "assets/style.css"

SEVEN_AUDIO = ["slot", "craft", "step", "grade", "banquet", "assign", "moon"]
# §8.2 splits the palette into two closed boards: §8.2.2 keeps the original seven
# verbatim for CSS / SVG and the share card, §8.2.1 adds the 30-token shared pixel
# board. §4.12 / §4.12.3 / §4.10.1 / §8.3.2 render customers, lanterns, affordance
# rings and the kitchen world from CSS pixel blocks, so CSS legitimately draws on
# both boards; neither may introduce an off-board colour.
UI_TOKENS = {"#F7EFE2", "#B8733A", "#C9483C", "#3A2E26",
             "#F2E4C4", "#E8B84B", "#F5C77E"}
PIXEL_BOARD = {"#24140E", "#402718", "#C99A5E", "#A67440", "#7F532B", "#C6B294",
               "#A08B70", "#7A6751", "#FFF6E4", "#E7D6B6", "#C3AF8D", "#F0B88A",
               "#C78453", "#E05745", "#A82E24", "#A89480", "#776352", "#4E3E31",
               "#E87A2A", "#F7C03E", "#E9B84B", "#F2E6CB", "#DDC99F", "#EEC46E",
               "#D09C43", "#93571E", "#2C1C14", "#D9BD8E", "#E27A1C", "#FAF0DC"}
BOARDS = {c.upper() for c in UI_TOKENS | PIXEL_BOARD}
BANNED = ["玉兔", "嫦娥", "月宫", "慕斯", "西式蛋糕"]

TOP_LEVEL = ["采买", "试新方", "制饼", "写信", "备宴", "布置"]

PASS = []
FAIL = []

# Spies on Audio.play so the scheduler can only ever be caught using the seven
# locked event points, and so one scheduled action proves exactly one 'slot'.
AUDIO_SPY = """
() => {
  window.__audioLog = [];
  const A = window.YueYan.Audio;
  if (!A || typeof A.play !== 'function') { return false; }
  const orig = A.play;
  A.play = function (n) { window.__audioLog.push(n); return orig.call(this, n); };
  return true;
}
"""


def install_spy(page):
    return page.evaluate(AUDIO_SPY)


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
    else:
        FAIL.append(f"{name} :: {detail}")


def run(fn, arg):
    """A missing hook reads as a failed assertion, never as a traceback."""
    try:
        fn(arg)
    except Exception as exc:
        check(f"{fn.__name__} aborted", False, f"{type(exc).__name__}: {exc}")


def open_page(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # RED baseline clicks controls that do not exist yet; 3 s beats the 30 s default.
    page.set_default_timeout(3000)
    page.add_init_script(
        "try { localStorage.clear(); } catch (e) {}")
    page.goto(INDEX.as_uri())
    page.wait_for_timeout(200)
    return page, errors


def text(page, sel):
    return page.evaluate("(s) => document.querySelector(s).textContent", sel)


def res_chip(page, sel):
    """§3.3 the resource readout is a two-line chip, so label and value are read apart."""
    return page.evaluate("""(s) => {
      const e = document.querySelector(s);
      return [e.querySelector('.res-k').textContent, e.querySelector('.res-v').textContent];
    }""", sel)


def visible(page, sel):
    return page.evaluate("""(s) => {
      const el = document.querySelector(s);
      if (!el) { return false; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
    }""", sel)


def height(page, sel):
    return page.evaluate("""(s) => {
      const el = document.querySelector(s);
      return el ? el.getBoundingClientRect().height : 0;
    }""", sel)


def disabled(page, sel):
    return page.evaluate("(s) => document.querySelector(s).hasAttribute('disabled')",
                         sel)


def is_active(page, view):
    return page.evaluate("(v) => document.getElementById(v).classList.contains('is-active')",
                         view)


def start_run(page):
    """§8.6: 开始筹备 opens the one-shot narrative panel, 着手备宴 closes it into D1."""
    page.click("#btn-start")
    page.wait_for_selector("#view-prologue.is-active", timeout=10000)
    page.click("#btn-prologue-close")
    page.wait_for_selector("#view-schedule.is-active", timeout=10000)


def open_sheet(page):
    page.click("#slot-grid .slot:not(.is-filled)")
    page.wait_for_selector("#drawer.is-open", timeout=10000)


# ----------------------------------------------------------- source hygiene
def test_source_hygiene():
    scene = SCENE.read_text(encoding="utf-8")
    main = MAIN.read_text(encoding="utf-8")
    css = re.sub(r"/\*.*?\*/", "", CSS.read_text(encoding="utf-8"), flags=re.S)
    html = INDEX.read_text(encoding="utf-8")
    blob = scene + main

    check("scene.js is an IIFE on window.YueYan",
          "window.YueYan.Scene" in scene and "'use strict'" in scene)
    check("§7 no Math.random in scene.js/main.js", "Math.random" not in blob)
    check("§10.1 no network / eval / Worker / WASM",
          not re.search(r"\bfetch\(|XMLHttpRequest|WebSocket|eval\("
                        r"|new Function|new Worker|WebAssembly", blob), blob[:120])
    # §8.4.1 / V-37a: the kitchen may hold exactly one rAF loop and scene.js is the
    # sole clock holder (§4.3.9). The blanket ban on rAF-driven UI was retired by
    # §8.4.1, which conflicts with it outright.
    check("V-37a scene.js holds exactly one rAF loop",
          scene.count("requestAnimationFrame") == 2
          and scene.count("cancelAnimationFrame") == 1,
          f"rAF={scene.count('requestAnimationFrame')} "
          f"cancel={scene.count('cancelAnimationFrame')}")
    check("V-37a main.js holds no rAF",
          "requestAnimationFrame" not in main, str(main.count("requestAnimationFrame")))
    check("V-21 scene.js hardcodes no hex",
          not re.search(r"#[0-9A-Fa-f]{6}", scene),
          str(re.findall(r"#[0-9A-Fa-f]{6}", scene)))
    stray = sorted({h.upper() for h in re.findall(r"#[0-9A-Fa-f]{6}", css)} - BOARDS)
    check("§8.2 style.css uses no colour outside either locked board", not stray, str(stray))
    pairs = set(re.findall(r"(--[a-z-]+):\s*(#[0-9A-Fa-f]{6})", css))
    locked = [("--paper", "#F7EFE2"), ("--amber", "#B8733A"), ("--cinnabar", "#C9483C"),
              ("--ink", "#3A2E26"), ("--moon", "#F2E4C4"), ("--osmanthus", "#E8B84B"),
              ("--lantern", "#F5C77E")]
    missing = [f"{k} {v}" for k, v in locked if (k, v) not in pairs]
    check("§8.2.2 the seven interface tokens are declared verbatim", not missing,
          str(missing))
    check("V-19 scene.js/main.js carry no banned symbol",
          [w for w in BANNED if w in blob] == [],
          str([w for w in BANNED if w in blob]))
    check("V-18 no 'Day N' literal in scene.js/main.js",
          not re.search(r"\bDay\s*\d", blob))

    # §8.4: the slot grid is the one block where motion is forbidden outright.
    slot_rules = re.findall(r"[^{}]*\.slot[^{}]*\{[^}]*\}", css)
    moving = [r.strip().split("{")[0].strip() for r in slot_rules
              if re.search(r"transition|animation", r)]
    check("§8.4 no transition/animation on slot rules", moving == [], str(moving))

    check("visible focus ring declared",
          ":focus-visible" in css and "outline" in css)

    # The scaffold ids are locked by Task 16; a UI rewrite must not drop them.
    row_ids = re.findall(r'id="(row-[a-z]+)"', html)
    check("all seven locked row-* ids survive in index.html",
          sorted(row_ids) == sorted(["row-buy", "row-shishi", "row-daizuo",
                                     "row-shouzuo", "row-xiexin", "row-beiyan",
                                     "row-buzhi"]), str(row_ids))


# ------------------------------------------------------------------- intro
def test_scene_api(page):
    kinds = page.evaluate("""() => {
      const S = window.YueYan.Scene || {};
      return ['renderIntro', 'renderSchedule', 'reasonFor'].map(k => typeof S[k]);
    }""")
    check("Task 10 Scene exports renderIntro/renderSchedule/reasonFor",
          kinds == ["function"] * 3, f"got {kinds}")


def test_intro(page):
    check("intro view is active on boot", is_active(page, "view-intro"))
    intro = page.evaluate("""() => {
      const D = window.YueYan.Data, t = id => document.getElementById(id).textContent;
      return { title: t('intro-title'), sub: t('intro-sub'), howto: t('intro-howto'),
               congrong: t('toggle-congrong-text'), hint: t('intro-save-hint'),
               start: t('btn-start'),
               want: { title: D.intro.title, sub: D.intro.sub, howto: D.intro.howto,
                       congrong: D.intro.congrong, hint: D.intro.saveHint,
                       start: D.intro.start } };
    }""")
    got = {k: intro[k] for k in ("title", "sub", "howto", "congrong", "hint", "start")}
    check("§8.5 intro strings come from Data.intro, never inlined",
          got == intro["want"], f"got {got}")
    check("start button reads 开始筹备", intro["start"] == "开始筹备", intro["start"])


def test_boot_renders_slots(page):
    # Task 16 reads .slot while the intro is still active, so boot paints both.
    check("three slots render on boot", page.locator("#slot-grid .slot").count() == 3,
          str(page.locator("#slot-grid .slot").count()))


# ---------------------------------------------------------------- schedule
def test_start_and_header(page):
    start_run(page)
    check("start switches to view-schedule", is_active(page, "view-schedule"))
    check("V-18 day label reads 第初八日", text(page, "#day-label") == "第初八日",
          text(page, "#day-label"))
    body = page.evaluate("() => document.body.textContent")
    check("V-18 no numeric day in rendered text",
          not re.search(r"\bDay\s*\d", body), body[:80])
    check("silver renders 银钱 44", res_chip(page, "#silver-count") == ["银钱", "44"],
          str(res_chip(page, "#silver-count")))
    check("stock renders 普通料 4", res_chip(page, "#stock-putong") == ["普通料", "4"],
          str(res_chip(page, "#stock-putong")))
    check("§5.2 day-end button reads 今日收工",
          text(page, "#btn-finish-day") == "今日收工", text(page, "#btn-finish-day"))


def test_sheet_opens_from_slot(page):
    start_run(page)
    check("sheet is closed before a slot is tapped",
          not page.evaluate("() => document.getElementById('drawer').classList.contains('is-open')"))
    open_sheet(page)
    check("tapping an empty slot opens the action sheet",
          page.evaluate("() => document.getElementById('drawer').classList.contains('is-open')"))
    check("sheet carries a backdrop overlay", visible(page, "#sheet-backdrop"))
    page.click("#sheet-backdrop", position={"x": 24, "y": 40})
    page.wait_for_timeout(120)
    check("tapping the backdrop closes the sheet",
          not page.evaluate("() => document.getElementById('drawer').classList.contains('is-open')"))


def test_six_rows(page):
    start_run(page)
    open_sheet(page)
    rows = page.evaluate("""() => Array.from(
      document.querySelectorAll('#drawer > .drawer-row')
    ).map(r => r.textContent)""")
    check("§3.3 exactly six top-level rows", len(rows) == 6, f"got {len(rows)}: {rows}")
    missing = [name for name in TOP_LEVEL
               if not any(name in r for r in rows)]
    check("§3.3 the six actions are 采买/试新方/制饼/写信/备宴/布置",
          missing == [], f"missing {missing} in {rows}")
    nested = page.evaluate("""() => {
      const d = document.getElementById('drawer');
      return ['row-daizuo', 'row-shouzuo'].map(id => {
        const el = document.getElementById(id);
        return !!el && el.parentElement !== d;
      });
    }""")
    check("制饼 variants stay nested under the 制饼 row", nested == [True, True],
          str(nested))
    page.evaluate("() => window.YueYan.Scene.renderSchedule(window.YueYan.Main.state())")
    rows2 = page.evaluate(
        "() => document.querySelectorAll('#drawer > .drawer-row').length")
    check("renderSchedule is idempotent (no row duplication)", rows2 == 6, str(rows2))


def test_d1_greying(page):
    start_run(page)
    open_sheet(page)
    page.click("[data-action='craft']")
    page.wait_for_timeout(120)
    cases = [("row-shishi", "未到初九"), ("row-shouzuo", "未到初十"),
             ("row-xiexin", "未到十一"), ("row-beiyan", "未到十二"),
             ("row-buzhi", "未到十三")]
    for sel, want in cases:
        check(f"D1 {sel} is greyed", disabled(page, "#" + sel))
        got = text(page, "#" + sel)
        check(f"D1 {sel} shows {want}", want in got, got)
    check("D1 代做 is available", not disabled(page, "#row-daizuo"))
    check("§5.2 D1 桂花 branch reads 市集无货",
          "市集无货" in text(page, "#buy-guihua") and disabled(page, "#buy-guihua"),
          text(page, "#buy-guihua"))
    check("D1 好料 branch is inside its gate", not disabled(page, "#buy-haoliao"))


def test_expansion(page):
    start_run(page)
    open_sheet(page)
    check("采买 branches hidden until the row expands",
          not visible(page, "#buy-putong"))
    page.click("#row-buy")
    page.wait_for_timeout(120)
    check("采买 expands to four buy branches", visible(page, "#buy-putong"))
    check("制饼 branches hidden until the row expands",
          not visible(page, "#row-daizuo"))
    page.click("[data-action='craft']")
    page.wait_for_timeout(120)
    check("制饼 expands to 代做 / 手作",
          visible(page, "#row-daizuo") and visible(page, "#row-shouzuo"))


def test_variant_selection_and_undo(page):
    check("Audio.play spy installed", install_spy(page))
    start_run(page)
    open_sheet(page)
    page.click("[data-action='craft']")
    page.wait_for_timeout(80)
    page.click("#row-daizuo")
    page.wait_for_timeout(80)
    check("代做 asks for a filling before it can be scheduled",
          visible(page, "[data-filling='dousha']"))
    check("D1 豆沙 is affordable", not disabled(page, "[data-filling='dousha']"))
    page.click("[data-filling='dousha']")
    page.wait_for_timeout(120)

    slot0 = text(page, "#slot-grid .slot:nth-child(1)")
    filled = page.evaluate(
        "() => document.querySelector('#slot-grid .slot').classList.contains('is-filled')")
    check("the chosen variant fills the tapped slot", filled)
    check("§5.2 the filled slot names the action and the material",
          "代做" in slot0 and "豆沙" in slot0, slot0)
    check("§5.2 the filled slot carries no counter",
          not re.search(r"\d", slot0), slot0)
    log = page.evaluate("() => window.__audioLog")
    check("§10.3.3 one scheduled action plays exactly one 'slot'",
          log == ["slot"], str(log))
    check("§10.3.3 the scheduler invents no eighth audio event",
          set(log) <= set(SEVEN_AUDIO), str(sorted(set(log) - set(SEVEN_AUDIO))))

    undo = "#btn-undo-slot"
    check("undo control exists in the thumb zone",
          page.locator(undo).count() == 1)
    check("undo is live once a slot is planned", not disabled(page, undo))
    page.click(undo)
    page.wait_for_timeout(120)
    check("undo empties the slot again",
          not page.evaluate(
              "() => document.querySelector('#slot-grid .slot').classList.contains('is-filled')"))
    check("undo goes inert when the day is empty", disabled(page, undo))
    state = page.evaluate("() => window.YueYan.Main.state()")
    check("undo restores the engine numbers exactly",
          state["day"] == 1 and state["silver"] == 44 and state["slotsUsed"] == 0,
          json.dumps(state)[:160])


def test_end_day(page):
    start_run(page)
    open_sheet(page)
    page.click("#row-buy")
    page.wait_for_timeout(80)
    page.click("#buy-putong")
    page.wait_for_timeout(80)
    open_sheet(page)
    page.click("[data-action='craft']")
    page.wait_for_timeout(80)
    page.click("#row-daizuo")
    page.wait_for_timeout(80)
    page.click("[data-filling='dousha']")
    page.wait_for_timeout(80)
    open_sheet(page)
    page.click("#row-buy")
    page.wait_for_timeout(80)
    page.click("#buy-haoliao")
    page.wait_for_timeout(80)

    planned = page.evaluate("() => window.YueYan.Main.state().slotsUsed")
    check("three taps plan three slots", planned == 3, str(planned))
    check("§5.2 no number leaks into any filled slot",
          not re.search(r"\d", page.evaluate(
              "() => Array.from(document.querySelectorAll('#slot-grid .slot'))"
              ".map(s => s.textContent).join('|')")))

    page.click("#btn-finish-day")
    page.wait_for_timeout(200)
    check("今日收工 advances to 第初九日", text(page, "#day-label") == "第初九日",
          text(page, "#day-label"))
    # 44 - 普通料 2 - 代做 3 - 好料 3 = 36
    check("the settled silver matches the engine",
          res_chip(page, "#silver-count") == ["银钱", "36"],
          str(res_chip(page, "#silver-count")))
    check("the new day starts with three empty slots",
          page.evaluate("() => Array.from(document.querySelectorAll('#slot-grid .slot'))"
                        ".every(s => !s.classList.contains('is-filled'))"))
    save = page.evaluate("""() => {
      const raw = localStorage.getItem('yueyan-progress');
      return raw ? JSON.parse(raw) : null;
    }""")
    check("§3.8 the day boundary is the save point",
          save is not None and save.get("day") == 2, json.dumps(save)[:160])
    check("§10.2 crafting never reaches storage",
          save is not None and "crafting" not in save,
          json.dumps(sorted(save.keys()))[:200] if save else "no save")


def test_shouzuo_placeholder(page):
    start_run(page)
    for _ in range(2):                       # idle-forward to D3, where 手作 unlocks
        page.evaluate("() => window.YueYan.Main.finishDay()")
        page.wait_for_timeout(80)
    check("idle days forward to 第初十日", text(page, "#day-label") == "第初十日",
          text(page, "#day-label"))
    open_sheet(page)
    page.click("[data-action='craft']")
    page.wait_for_timeout(80)
    check("D3 手作 is available", not disabled(page, "#row-shouzuo"))
    page.click("#row-shouzuo")
    page.wait_for_timeout(150)
    check("手作 hands off to the craft view", is_active(page, "view-craft"))
    page.click("#btn-craft-abort")
    page.wait_for_timeout(150)
    check("放弃 returns to the scheduler", is_active(page, "view-schedule"))
    state = page.evaluate("() => window.YueYan.Main.state()")
    check("the placeholder consumes no slot and no material",
          state["slotsUsed"] == 0 and state["stock"]["putong"] == 4,
          json.dumps(state)[:160])


def test_last_day_handoff(page):
    start_run(page)
    for _ in range(6):                       # D1..D6 idle -> D7
        page.evaluate("() => window.YueYan.Main.finishDay()")
        page.wait_for_timeout(60)
    check("D7 reads 第十四日", text(page, "#day-label") == "第十四日",
          text(page, "#day-label"))
    page.evaluate("() => window.YueYan.Main.finishDay()")
    page.wait_for_timeout(120)
    check("ending D7 hands off to the assignment view",
          is_active(page, "view-assign"))


def test_reason_strings(page):
    out = page.evaluate("""() => {
      const S = window.YueYan.Scene, E = window.YueYan.Engine;
      const late = E.initialState();
      late.day = 7; late.silver = 44; late.patterns = 3; late.ambience = 40;
      late.flags.xieXin = true; late.banquet = 4; late.stock.guihua = 0;
      late.cakes = [1, 2, 3, 4, 5];
      const d1 = E.initialState();
      return {
        marketEmpty: S.reasonFor(d1, { type: 'buy', item: 'guihua' }),
        cakeFull:    S.reasonFor(late, { type: 'daizuo', filling: 'dousha' }),
        lanternFull: S.reasonFor(late, { type: 'buzhi' }),
        letterSent:  S.reasonFor(late, { type: 'xiexin' }),
        patternFull: S.reasonFor(late, { type: 'shishi' }),
        wine:        S.reasonFor(late, { type: 'beiyan' }),
        okEmpty:     S.reasonFor(d1, { type: 'buy', item: 'putong' })
      };
    }""")
    expect = {"marketEmpty": "市集无货", "cakeFull": "五份已足",
              "lanternFull": "四盏已足", "letterSent": "信已寄出",
              "patternFull": "三式已成", "wine": "缺桂花，酒席不成", "okEmpty": ""}
    for key, want in expect.items():
        check(f"reasonFor {key} reads {want or '(empty)'}",
              out[key] == want, f"got {out[key]!r}")


def test_touch_targets(page):
    start_height = height(page, "#btn-start")
    start_run(page)
    open_sheet(page)
    targets = {"#btn-start": start_height,
               "#btn-finish-day": height(page, "#btn-finish-day"),
               "#slot-grid .slot": height(page, "#slot-grid .slot"),
               "#row-buy": height(page, "#row-buy"),
               "#btn-undo-slot": height(page, "#btn-undo-slot")}
    short = {k: v for k, v in targets.items() if v < 56}
    check("primary targets are at least 56 CSS px tall", short == {}, str(short))


def main():
    test_source_hygiene()
    suite = (test_scene_api, test_intro, test_boot_renders_slots,
             test_start_and_header, test_sheet_opens_from_slot, test_six_rows,
             test_d1_greying, test_expansion, test_reason_strings,
             test_variant_selection_and_undo, test_end_day,
             test_shouzuo_placeholder, test_last_day_handoff,
             test_touch_targets)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for fn in suite:
            page, errors = open_page(browser)
            run(fn, page)
            check(f"{fn.__name__} raised no pageerror", not errors, "; ".join(errors))
            page.close()
        browser.close()

    for line in FAIL:
        print("FAIL " + line)
    print(f"yueyan ui: {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
