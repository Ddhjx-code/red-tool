#!/usr/bin/env python3
"""Task 15 — boot, test facade, resume, and the three scene.js gaps.

Covers V-17 (day-boundary resume), §10.3.1 (main owns flow, scene owns
presentation, single wiring source), X-8 (meta is the endings-seen list only),
§3.8 (the day boundary is the only save point), and the no-double-binding
regression guard for the architecture reconciliation.
"""
import pathlib

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "tools/yueyan/assets"
INDEX = ROOT / "tools/yueyan/index.html"
MAIN = ASSETS / "main.js"
SCENE = ASSETS / "scene.js"

FACADE_KEYS = "craftStep,data,engine,ready,save,share,state"

ROUTE = [["buy:haoliao", "buy:haoliao", "buy:putong"],
         ["buy:haoliao", "buy:haoliao", "buy:putong"],
         ["buy:putong", "shouzuo:dousha:premium", "shouzuo:wuren:premium"],
         ["shouzuo:lianrong:premium", "shouzuo:dousha:normal", "xiexin"],
         ["buy:guihua", "beiyan", "beiyan"],
         ["beiyan", "beiyan", "buzhi"],
         ["shouzuo:guihua:premium", "buzhi", "buzhi"]]
ASSIGN = {"grandma": 0, "father": 1, "mother": 2, "younger": 3, "brother": 4}
BUTTONS = ["btn-start", "btn-finish-day", "btn-share", "btn-open-feast",
           "btn-craft-abort"]

PASS = []
FAIL = []


def check(name, ok, detail=""):
    (PASS if ok else FAIL).append(name if ok else f"{name} :: {detail}")


def run(fn, page):
    try:
        fn(page)
    except Exception as exc:                                    # noqa: BLE001
        check(f"{fn.__name__} aborted", False, str(exc))


RUN_ROUTE = """
      const days = ROUTE.map(day => day.map(spec => {
        const p = spec.split(':');
        if (p[0] === 'buy')    { return { type: 'buy', item: p[1] }; }
        if (p[0] === 'daizuo') { return { type: 'daizuo', filling: p[1] }; }
        if (p[0] === 'shouzuo'){ return { type: 'shouzuo', filling: p[1], batch: p[2], P: 4 }; }
        return { type: p[0] };
      }));
"""


def open_page(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.set_default_timeout(3000)
    page.goto(INDEX.as_uri())
    page.wait_for_timeout(300)
    check("the page boots without a page error", not errors, "; ".join(errors))
    return page


# --------------------------------------------------------------- test facade
def test_facade(page):
    out = page.evaluate("""() => ({
      ready: window.__ready === true,
      keys: Object.keys(window.__yueyan || {}).sort().join(','),
      shareIsModule: !!(window.__yueyan && window.__yueyan.share
        && typeof window.__yueyan.share.build === 'function'
        && typeof window.__yueyan.share.publish === 'function'),
      engineIsLive: !!(window.__yueyan && window.__yueyan.engine === window.YueYan.Engine),
      dataIsLive: !!(window.__yueyan && window.__yueyan.data === window.YueYan.Data),
      saveIsLive: !!(window.__yueyan && window.__yueyan.save === window.YueYan.Save),
      stateIsFn: typeof (window.__yueyan || {}).state === 'function',
      readyKey: (window.__yueyan || {}).ready === true,
      day: window.__yueyan ? window.__yueyan.state().day : -1,
      active: (document.querySelector('.view.is-active') || {}).id,
      inlineHandlers: document.querySelectorAll('[onclick]').length
    })""")
    check("§10.3.1 window.__ready is true once booted", out["ready"] is True, str(out["ready"]))
    check("§10.3.1 the facade exposes exactly the seven smoke keys",
          out["keys"] == FACADE_KEYS, out["keys"])
    check("§10.3.1 the facade resolves the live engine/data/save modules",
          out["engineIsLive"] and out["dataIsLive"] and out["saveIsLive"], str(out))
    check("V-2 the facade resolves share lazily, after its own load order",
          out["shareIsModule"] is True, str(out["shareIsModule"]))
    check("§10.3.1 facade.state() reports the current day",
          out["stateIsFn"] and out["day"] == 1, str(out))
    check("§10.3.1 the facade reports ready", out["readyKey"] is True, str(out["readyKey"]))
    check("§5.4 the boot lands on the intro view", out["active"] == "view-intro",
          str(out["active"]))
    check("V-21 no inline handler exists anywhere in the DOM",
          out["inlineHandlers"] == 0, str(out["inlineHandlers"]))


def test_inject_step_forward(page):
    out = page.evaluate("""() => {
      const S = window.YueYan.Scene, M = window.YueYan.Main, F = window.__yueyan;
      const probe = (fn) => {
        if (typeof fn !== 'function') { return 'not-a-function'; }
        try { fn(0, 0); return 'no-throw'; } catch (e) { return String(e.message); }
      };
      return { scene: probe(S.injectStep), main: probe(M.injectStep),
               facade: probe(F.craftStep),
               mainKey: typeof M.injectStep === 'function' };
    }""")
    check("§10.3.1 Main exports injectStep", out["mainKey"] is True, str(out["mainKey"]))
    check("V-15 Main.injectStep forwards to Scene.injectStep",
          out["main"] == out["scene"] == "step index mismatch", str(out))
    check("V-15 __yueyan.craftStep forwards to Scene.injectStep",
          out["facade"] == out["scene"] == "step index mismatch", str(out))


# --------------------------------------------------------------- currentPick
def test_current_pick(page):
    before = page.evaluate("""([ROUTE]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      """ + RUN_ROUTE + """
      const exposed = typeof S.currentPick === 'function';
      S.renderAssign(E.runRoute(days, null));
      return { exposed, pick: exposed ? S.currentPick() : null };
    }""", [ROUTE])
    check("§10.3.1 Scene exposes currentPick", before["exposed"] is True,
          str(before["exposed"]))
    check("§6.6 the pick starts empty before any deal",
          before["pick"] == {}, str(before["pick"]))

    after = page.evaluate("""([ROUTE]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene;
      """ + RUN_ROUTE + """
      S.renderAssign(E.runRoute(days, null));
      document.querySelector('[data-family="grandma"]').click();
      document.querySelector('[data-cake="0"]').click();
      return { pick: S.currentPick(),
               pressed: document.querySelectorAll('#assign-cake-list [aria-pressed="true"]').length };
    }""", [ROUTE])
    check("§6.6 currentPick reflects the family-to-cake deal",
          after["pick"] == {"grandma": 0}, str(after["pick"]))
    check("§6.6 the deal is also painted on the cake row", after["pressed"] == 1,
          str(after["pressed"]))


# --------------------------------------------------------------- V-17 resume
def test_resume(page):
    seed = page.evaluate("""() => {
      const E = window.YueYan.Engine, Save = window.YueYan.Save, D = window.YueYan.Data;
      let s = E.initialState();
      s = E.applyDay(s, [{ type: 'buy', item: 'putong' }]);
      s = E.applyDay(s, [{ type: 'buy', item: 'putong' }]);
      Save.writeProgress(s);
      return { day: s.day, silver: s.silver, putong: s.stock.putong,
               cakes: s.cakes.length, hint: D.dates[s.day - 1],
               saved: Save.readProgress() !== null };
    }""")
    check("§3.8 the seed snapshot survives the write", seed["saved"] is True, str(seed))
    check("§3.8 the seed snapshot sits on day 3", seed["day"] == 3, str(seed["day"]))

    page.reload()
    page.wait_for_timeout(300)
    out = page.evaluate("""() => {
      const M = window.YueYan.Main;
      const s = M.state();
      const hint = document.getElementById('intro-save-hint');
      return { day: s.day, silver: s.silver, putong: s.stock.putong,
               cakes: s.cakes.length,
               hint: hint ? hint.textContent : null,
               active: (document.querySelector('.view.is-active') || {}).id };
    }""")
    check("V-17 reload resumes at the saved day boundary", out["day"] == 3, str(out["day"]))
    check("V-17 the resume hint names the saved date",
          out["hint"] is not None and seed["hint"] in out["hint"], str(out["hint"]))
    check("V-17 resources are intact across the resume",
          out["silver"] == seed["silver"] and out["putong"] == seed["putong"]
          and out["cakes"] == seed["cakes"], str(out))
    check("V-17 the resume still lands on the intro view", out["active"] == "view-intro",
          str(out["active"]))

    started = page.evaluate("""() => {
      window.YueYan.Main.start();
      return { day: window.YueYan.Main.state().day,
               active: (document.querySelector('.view.is-active') || {}).id };
    }""")
    check("V-17 开始筹备 enters the schedule on the resumed day, not a fresh one",
          started["day"] == 3 and started["active"] == "view-schedule", str(started))


def test_fresh_boot(page):
    out = page.evaluate("""() => {
      const D = window.YueYan.Data;
      const hint = document.getElementById('intro-save-hint');
      return { day: window.YueYan.Main.state().day,
               hint: hint ? hint.textContent : null,
               generic: D.intro.saveHint,
               active: (document.querySelector('.view.is-active') || {}).id };
    }""")
    check("§3.8 with no save the run starts on day 1", out["day"] == 1, str(out["day"]))
    check("§3.8 with no save the hint carries no resumed date",
          out["hint"] == out["generic"] and "上次进行到第" not in (out["hint"] or ""),
          str(out["hint"]))
    check("§5.4 a fresh boot lands on the intro view", out["active"] == "view-intro",
          str(out["active"]))


# --------------------------------------------------------------- meta (X-8)
def test_meta_write(page):
    first = page.evaluate("""([ROUTE, ASSIGN]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene, Save = window.YueYan.Save;
      """ + RUN_ROUTE + """
      const s = E.applyAssignment(E.runRoute(days, null), ASSIGN);
      const code = E.ending(s);
      S.renderEnding(s);
      document.getElementById('btn-share').click();
      const meta = Save.readMeta();
      return { code, seen: meta.endingsSeen, version: meta.version };
    }""", [ROUTE, ASSIGN])
    check("X-8 生成分享卡 records the ending seen",
          first["code"] in first["seen"], str(first))
    check("X-8 meta is the endings-seen list only",
          first["seen"] == [first["code"]], str(first["seen"]))

    second = page.evaluate("""([ROUTE, ASSIGN]) => {
      const Save = window.YueYan.Save;
      document.getElementById('btn-share').click();
      document.getElementById('btn-share').click();
      return { seen: Save.readMeta().endingsSeen };
    }""", [ROUTE, ASSIGN])
    check("X-8 repeated sharing never duplicates the ending",
          second["seen"] == [first["code"]], str(second["seen"]))


def test_meta_not_run_state(page):
    out = page.evaluate("""([ROUTE, ASSIGN]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene, Save = window.YueYan.Save;
      """ + RUN_ROUTE + """
      S.renderEnding(E.applyAssignment(E.runRoute(days, null), ASSIGN));
      document.getElementById('btn-share').click();
      const raw = JSON.parse(window.localStorage.getItem(
        window.YueYan.Data.saveKeys.meta));
      return { keys: Object.keys(raw).sort().join(','), seen: raw.endingsSeen };
    }""", [ROUTE, ASSIGN])
    check("X-8 the meta blob carries only version and endingsSeen",
          out["keys"] == "endingsSeen,version", out["keys"])


# --------------------------------------------------------------- moon audio
def test_moon_audio(page):
    out = page.evaluate("""([ROUTE]) => {
      const E = window.YueYan.Engine, S = window.YueYan.Scene, A = window.YueYan.Audio,
            D = window.YueYan.Data;
      """ + RUN_ROUTE + """
      S.renderAssign(E.runRoute(days, null));
      D.familyOrder.forEach((k, i) => {
        document.querySelector('[data-family="' + k + '"]').click();
        document.querySelector('[data-cake="' + i + '"]').click();
      });
      document.getElementById('btn-assign-confirm').click();
      const previewActive = document.getElementById('view-preview')
        .classList.contains('is-active');
      const orig = A.play;
      const calls = [];
      A.play = function (name, arg) { calls.push([name, arg]); return orig.apply(A, arguments); };
      document.getElementById('btn-open-feast').click();
      A.play = orig;
      return { want: document.getElementById('end-moon').getAttribute('data-ending'),
               previewActive, moon: calls.filter(c => c[0] === 'moon'), all: calls.length };
    }""", [ROUTE])
    check("§6.6 the real flow reaches 宴前一览 before 开席", out["previewActive"] is True,
          str(out["previewActive"]))
    check("§10.3.3 开席 plays the moon cue exactly once with the ending code",
          out["moon"] == [["moon", out["want"]]], str(out))


# --------------------------------------------------------------- double binding
def test_no_double_bind(page):
    page.evaluate("() => window.YueYan.Main.start()")
    page.wait_for_timeout(200)
    out = page.evaluate("""() => {
      const M = window.YueYan.Main;
      const orig = M.finishDay;
      let calls = 0;
      M.finishDay = function () { calls++; return orig.apply(M, arguments); };
      document.getElementById('btn-finish-day').click();
      M.finishDay = orig;
      return { calls, day: M.state().day };
    }""")
    check("§10.3.1 btn-finish-day fires finishDay exactly once (no double bind)",
          out["calls"] == 1, str(out["calls"]))
    check("§3.7 the single call still settles the day", out["day"] == 2, str(out["day"]))

    start = page.evaluate("""() => {
      const M = window.YueYan.Main;
      const orig = M.start;
      let calls = 0;
      M.start = function () { calls++; return orig.apply(M, arguments); };
      document.getElementById('btn-start').click();
      M.start = orig;
      return { calls };
    }""")
    check("§10.3.1 btn-start fires start exactly once (no double bind)",
          start["calls"] == 1, str(start["calls"]))


def test_single_wiring_source(page):
    for button in BUTTONS:
        owners = []
        for path, name in [(MAIN, "main.js"), (SCENE, "scene.js")]:
            src = path.read_text(encoding="utf-8")
            if f"'{button}'" in src:
                owners.append(name)
        check(f"§10.3.1 {button} is bound in exactly one module",
              owners == ["scene.js"], str(owners))


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for fn in [test_facade, test_inject_step_forward, test_current_pick,
                   test_resume, test_fresh_boot, test_meta_write,
                   test_meta_not_run_state, test_moon_audio, test_no_double_bind]:
            page = open_page(browser)
            run(fn, page)
            page.close()
        browser.close()
    run(test_single_wiring_source, None)

    for name in FAIL:
        print(f"FAIL {name}")
    print(f"yueyan main: {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
