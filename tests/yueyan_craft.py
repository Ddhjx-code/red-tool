#!/usr/bin/env python3
"""Task 11 — the four-step craft short game (手作短局).

Covers §4.1 three-choice entry, §4.2 从容模式, §4.3 four steps and precision,
§4.4 budgets and the double-gated grade, §4.6 abort refund, plus V-13 / V-15 /
V-16 and the DOM wiring the action drawer needs.
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

LOCKED_CRAFT_IDS = ["craft-filling-list", "craft-batch-normal", "craft-batch-premium",
                    "btn-craft-start", "step-index", "bar-s1", "pad-s2", "pad-s3",
                    "bar-s4", "btn-step-confirm", "btn-craft-abort", "craft-grade"]
SEVEN_EVENTS = {"slot", "craft", "step", "grade", "banquet", "assign", "moon"}

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


# Spies on Audio.play(name, arg) so the short game can only ever be caught
# using the seven locked event points, with the step index / grade tier args.
SPY = """
() => {
  window.__audioLog = [];
  const A = window.YueYan.Audio;
  if (!A || typeof A.play !== 'function') { return false; }
  const orig = A.play;
  A.play = function (n, a) { window.__audioLog.push([n, a === undefined ? null : a]);
                             return orig.call(this, n, a); };
  return true;
}
"""


def spy(page):
    return page.evaluate(SPY)


def start_run(page, cong_rong=False):
    if cong_rong:
        page.click("#toggle-congrong")
        page.wait_for_timeout(80)
    page.click("#btn-start")
    page.wait_for_timeout(150)


def open_sheet(page):
    page.click("#slot-grid .slot:not(.is-filled)", position={"x": 100, "y": 20})
    page.wait_for_timeout(150)


def forward_to_d3(page):
    for _ in range(2):                     # §3.5 手作 unlocks on D3
        page.evaluate("() => window.YueYan.Main.finishDay()")
        page.wait_for_timeout(80)


def enter_craft_now(page):
    open_sheet(page)
    page.click("[data-action='craft']")
    page.wait_for_timeout(120)
    page.click("#row-shouzuo")
    page.wait_for_timeout(200)


def enter_craft(page, cong_rong=False):
    if is_active(page, "view-intro"):
        start_run(page, cong_rong)
    forward_to_d3(page)
    enter_craft_now(page)


def is_active(page, view):
    return page.evaluate(
        "(v) => document.getElementById(v).classList.contains('is-active')", view)


def text(page, sel):
    return page.evaluate("(s) => document.querySelector(s).textContent", sel)


def visible(page, sel):
    return page.evaluate(
        "(s) => { const e = document.querySelector(s); if (!e) { return false; }"
        " return e.getBoundingClientRect().height > 0; }", sel)


def disabled(page, sel):
    return page.evaluate("(s) => document.querySelector(s).disabled", sel)


def height(page, sel):
    return page.evaluate("(s) => { const e = document.querySelector(s);"
                         " return e ? Math.round(e.getBoundingClientRect().height) : 0; }",
                         sel)


def inject(page, i, deviation):
    return page.evaluate("([i, d]) => { const r = window.YueYan.Scene.injectStep(i, d);"
                         " return r ? { cakes: r.cakes.length,"
                         " grade: r.cakes[r.cakes.length - 1].grade,"
                         " P: r.cakes[r.cakes.length - 1].P,"
                         " batch: r.cakes[r.cakes.length - 1].batch } : null; }",
                         [i, deviation])


def inject_and_finish(page, deviations):
    return page.evaluate("""(ds) => { const S = window.YueYan.Scene, M = window.YueYan.Main;
      let done = null;
      for (let i = 0; i < ds.length; i++) { const r = S.injectStep(i, ds[i]); if (r) { done = r; } }
      const last = done ? done.cakes[done.cakes.length - 1] : null;
      return { scheduled: M.finishCraft(done),
               grade: last ? last.grade : null, P: last ? last.P : null,
               batch: last ? last.batch : null, filling: last ? last.filling : null }; }""",
                         deviations)


# --------------------------------------------------------------- source hygiene
def test_source_hygiene():
    scene = SCENE.read_text(encoding="utf-8")
    main = MAIN.read_text(encoding="utf-8")
    css = re.sub(r"/\*.*?\*/", "", CSS.read_text(encoding="utf-8"), flags=re.S)
    html = INDEX.read_text(encoding="utf-8")
    audio = AUDIO.read_text(encoding="utf-8")
    blob = scene + main

    exports = ["renderCraft", "startStep", "confirmStep", "abortCraft", "injectStep"]
    missing = [name for name in exports if f"{name}:" not in scene]
    check("Task 11 Scene exports renderCraft/startStep/confirmStep/abortCraft/injectStep",
          missing == [], str(missing))

    absent = [i for i in LOCKED_CRAFT_IDS if f'id="{i}"' not in html]
    check("all twelve locked craft ids survive in index.html", absent == [], str(absent))

    check("§10.3 no inline handlers in index.html",
          not re.search(r'\son(click|pointerup|pointerdown|change)="', html))
    check("§7 no Math.random in scene.js/main.js", "Math.random" not in blob)
    check("§10.1 no network / eval / Worker / WASM",
          not re.search(r"\bfetch\(|XMLHttpRequest|WebSocket|eval\("
                        r"|new Function|new Worker|WebAssembly", blob))
    check("§8.4 no requestAnimationFrame-driven UI",
          "requestAnimationFrame" not in blob)

    tokens = set(re.findall(r"--[\w-]+:\s*(#[0-9A-Fa-f]{6})",
                            CSS.read_text(encoding="utf-8")))
    check("seven colour tokens declared", len(tokens) == 7, str(tokens))
    stray = sorted(set(re.findall(r"#[0-9A-Fa-f]{3,8}", css)) - tokens)
    check("V-21 style.css adds no token beyond the seven", stray == [], str(stray))
    check("V-21 scene.js hardcodes no hex",
          re.search(r"#[0-9A-Fa-f]{3,8}", scene) is None)

    outside = [f.name for f in (ENGINE, DATA, AUDIO, MAIN)
               if re.search(r"\bsetInterval\(|\bsetTimeout\(", f.read_text(encoding="utf-8"))]
    check("X-12 no JS timer outside scene.js", outside == [], str(outside))

    moving = [m.group(0) for m in re.finditer(
        r"[^{}]*\.slot[^{}]*\{[^}]*(transition|animation)[^}]*\}", css)]
    check("§8.4 no transition/animation on slot rules", moving == [], str(moving))

    check("§4.3.3 swing is a 2 s alternate cycle (2.0 s one-way)",
          "animation: swing 2s linear infinite alternate" in css
          and "@keyframes swing" in css)

    check("§4.4.1 rule 2 carries the exact spec-locked comfort line",
          "料是好料，火候差了些。" in scene)
    banned = [w for w in ("失败", "浪费", "可惜") if w in scene]
    check("§7.7 no 失败 / 浪费 / 可惜 wording in scene.js", banned == [], str(banned))

    used = set(re.findall(r"Audio\.play\('([a-z]+)'", blob))
    check("§10.3.3 the short game invents no eighth audio event",
          used <= SEVEN_EVENTS, str(sorted(used - SEVEN_EVENTS)))
    check("audio.js declares exactly the seven locked events",
          set(re.findall(r"^\s{4}(\w+):\s*\{ freq:", audio, flags=re.M)) == SEVEN_EVENTS)

    check("grade math lives in the engine, not in scene.js/main.js",
          not re.search(r"3\.60|2\.40|grade\.gold|grade\.silver", blob))


# ------------------------------------------------------- V-13 / V-15 / V-16
def test_engine_contract(page):
    out = page.evaluate("""() => {
      const S = window.YueYan.Scene, E = window.YueYan.Engine, D = window.YueYan.Data;
      const r = {};
      r.budgets = D.steps.map(s => s.budget);
      r.total = D.steps.reduce((a, s) => a + s.budget, 0);
      r.ids = D.steps.map(s => s.id);
      let st = E.applyDay(E.applyDay(E.initialState(),
        [{type:'buy',item:'haoliao'},{type:'buy',item:'putong'}]), []);
      const before = JSON.stringify(st.stock);
      S.startStep(st, 'dousha', 'premium');
      const back = S.abortCraft();
      r.abort_stock = JSON.stringify(back.stock) === before;
      r.abort_slots = back.slotsUsed === st.slotsUsed;
      r.abort_cakes = back.cakes.length;
      r.gold = E.gradeOf('premium', 3.60);
      r.silver_cap = E.gradeOf('normal', 4.00);
      r.silver_mid = E.gradeOf('normal', 3.60);
      r.bronze = E.gradeOf('premium', 0.40);
      return r;
    }""")
    check("V-13 budgets are 8 / 10 / 12 / 10", out["budgets"] == [8, 10, 12, 10],
          str(out["budgets"]))
    check("V-13 four-step budget totals 40", out["total"] == 40, str(out["total"]))
    check("§4.3.2 step ids are s1 / s2 / s3 / s4",
          out["ids"] == ["s1", "s2", "s3", "s4"], str(out["ids"]))
    check("V-15 abort refunds the materials in full", out["abort_stock"] is True)
    check("V-15 abort frees the slot", out["abort_slots"] is True)
    check("V-15 abort leaves no half cake", out["abort_cakes"] == 0,
          str(out["abort_cakes"]))
    check("V-16 gold = premium ∧ P ≥ 3.60", out["gold"] == 3, str(out["gold"]))
    check("V-16 normal batch is capped at 银 even at P = 4.00",
          out["silver_cap"] == 2, str(out["silver_cap"]))
    check("V-16 thresholds are not touched by 从容模式",
          out["silver_mid"] == 2 and out["bronze"] == 1)


# ------------------------------------------------------------- §4.1 entry panel
def test_craft_panel(page):
    enter_craft(page)
    check("制饼 · 手作 enters the craft view", is_active(page, "view-craft"))
    check("the sheet closes on entry",
          not page.evaluate("() => document.getElementById('drawer')"
                            ".classList.contains('is-open')"))
    names = page.evaluate("""() => Array.from(
      document.querySelectorAll('#craft-filling-list [data-filling]'))
      .map(b => b.textContent)""")
    check("§3.2.2 the five fillings are offered", len(names) == 5, str(names))
    check("§4.1 step ② reads 普通批次 / 好料批次",
          text(page, "#craft-batch-normal") == "普通批次"
          and text(page, "#craft-batch-premium") == "好料批次")
    check("§4.1 step ③ the start button reads 开始手作",
          text(page, "#btn-craft-start") == "开始手作")
    check("confirm and abort are labelled",
          text(page, "#btn-step-confirm") == "确认" and text(page, "#btn-craft-abort") == "放弃")
    check("D1 has no 好料, so 好料批次 is greyed out",
          disabled(page, "#craft-batch-premium"))
    check("D1 has 普通料 4, so 普通批次 stays live",
          not disabled(page, "#craft-batch-normal"))
    check("the short game starts on step 0 with no grade",
          text(page, "#step-index") == "" and text(page, "#craft-grade") == "")


def test_step_sequence(page):
    enter_craft(page)
    page.click("#craft-filling-list [data-filling='dousha']")
    page.wait_for_timeout(80)
    page.click("#craft-batch-normal")
    page.wait_for_timeout(80)
    page.click("#btn-craft-start")
    page.wait_for_timeout(200)
    check("§4.3 the step index reads 第 1 步 / 共 4 步",
          text(page, "#step-index") == "第 1 步 / 共 4 步", text(page, "#step-index"))
    check("only the current step control is visible",
          visible(page, "#bar-s1") and not visible(page, "#pad-s2")
          and not visible(page, "#pad-s3") and not visible(page, "#bar-s4"))
    check("§4.3.3 the bar swings outside 从容模式",
          page.evaluate("() => document.getElementById('bar-s1')"
                        ".classList.contains('is-swinging')"))
    check("the marker starts at the bar's left end (§4.3.3 fixed phase)",
          "@keyframes swing { from { left: 0; }" in CSS.read_text(encoding="utf-8"))


def test_soft_timer(page):
    enter_craft(page)
    page.click("#craft-filling-list [data-filling='dousha']")
    page.click("#craft-batch-normal")
    page.click("#btn-craft-start")
    page.wait_for_timeout(8800)                                # §4.4 S1 budget 8 s
    check("§4.4 the soft timer ends the step at its 8 s budget",
          text(page, "#step-index") == "第 2 步 / 共 4 步", text(page, "#step-index"))
    check("§4.4 timeout moves to S2 and produces no failure state",
          visible(page, "#pad-s2") and not visible(page, "#bar-s1"))
    check("§4.4 timeout is silent about grade (no grade yet)",
          text(page, "#craft-grade") == "")


def test_s4_timeout_still_bakes(page):
    enter_craft(page)
    page.click("#craft-filling-list [data-filling='dousha']")
    page.click("#craft-batch-normal")
    page.click("#btn-craft-start")
    page.wait_for_timeout(150)
    for i in (0, 1, 2):                                       # S1-S3 measured; S4 left to its timer
        page.evaluate("(i) => window.YueYan.Scene.injectStep(i, 0)", i)
        page.wait_for_timeout(120)
    check("§4.4 S4 is the live step", text(page, "#step-index") == "第 4 步 / 共 4 步",
          text(page, "#step-index"))
    page.wait_for_timeout(10600)                              # §4.4 S4 budget is 10 s
    cakes = page.evaluate("() => window.YueYan.Main.state().cakes")
    check("§4.4 the S4 timeout still produces a cake", len(cakes) == 1, str(cakes))
    check("§4.4 the S4 timeout consumes the day slot",
          page.evaluate("() => window.YueYan.Main.state().slotsUsed") == 1)


def test_confirm_and_audio(page):
    check("Audio.play spy installed", spy(page))
    enter_craft(page)
    page.click("#craft-filling-list [data-filling='dousha']")
    page.click("#craft-batch-normal")
    page.click("#btn-craft-start")
    page.wait_for_timeout(150)
    log = page.evaluate("() => window.__audioLog")
    check("§10.3.3 entering the short game plays 'craft'",
          [n for n, _ in log] == ["craft"], str(log))
    page.click("#btn-step-confirm")
    page.wait_for_timeout(150)
    check("确认 advances S1 → S2", text(page, "#step-index") == "第 2 步 / 共 4 步",
          text(page, "#step-index"))
    log = page.evaluate("() => window.__audioLog")
    steps = [(n, a) for n, a in log if n == "step"]
    check("§10.3.3 each confirm plays 'step' with its step index",
          steps == [("step", 0)], str(log))


def craft_case(page, filling, batch, deviations):
    """Drives one full short game through the real Scene path on a stock fixture.

    The fixture keeps the day plan untouched, so the four grade cases can run
    back to back without burning the three slots a day allows.
    """
    return page.evaluate("""([filling, batch, devs]) => {
      const S = window.YueYan.Scene, E = window.YueYan.Engine, D = window.YueYan.Data;
      const st = E.initialState();
      st.day = D.unlocks.shouzuo;
      st.stock.putong = 6; st.stock.haoliao = 4;
      st.stock.xiandanhuang = 1; st.stock.guihua = 1;
      S.renderCraft(st);
      S.startStep(st, filling, batch);
      let out = null;
      devs.forEach((d, i) => { out = S.injectStep(i, d); });
      const cake = out.cakes[out.cakes.length - 1];
      return { P: cake.P, grade: cake.grade, batch: cake.batch,
               text: document.getElementById('craft-grade').textContent };
    }""", [filling, batch, deviations])


def test_grade_double_gate(page):
    capped = craft_case(page, "dousha", "normal", [0, 0, 0, 0.04])   # p4 = 0.6 → P = 3.60
    check("§4.4.1 P sums to exactly 3.60", abs(capped["P"] - 3.60) < 1e-9, str(capped))
    check("§4.4.1 normal batch at P = 3.60 is capped at 银", capped["grade"] == 2,
          str(capped))
    check("the normal batch reads 银饼", capped["text"] == "银饼", capped["text"])

    low = craft_case(page, "dousha", "normal", [0.09, 0.09, 0.09, 0.09])   # P = 0.40
    check("§4.5 a low score still yields a cake, never a failure state",
          low["grade"] == 1 and low["text"] == "铜饼", str(low))

    gold = craft_case(page, "dousha", "premium", [0, 0, 0, 0.04])
    check("§4.4.1 金 = 好料批次 ∧ P ≥ 3.60", gold["grade"] == 3, str(gold))
    check("the premium batch reads 金饼", gold["text"] == "金饼", gold["text"])

    silver = craft_case(page, "dousha", "premium", [0.03, 0.03, 0.03, 0.03])  # P = 2.80
    check("§4.4.1 rule 2 好料 below the gold gate still makes a cake",
          silver["grade"] == 2 and silver["text"].startswith("银饼"), str(silver))
    check("§4.4.1 rule 2 states the fact without blaming the player",
          "料是好料，火候差了些。" in silver["text"], silver["text"])

    miss = craft_case(page, "dousha", "premium", [0.05, 0.05, 0.05, 0.05])   # P = 2.00
    check("§4.4.1 好料批次 below 2.40 falls to 铜, and the 好料 stays sunk",
          miss["grade"] == 1 and miss["text"].startswith("铜饼"), str(miss))
    check("§4.6 the finished short game never refunds",
          page.evaluate("() => window.YueYan.Main.state().stock.putong") == 4)


def test_cake_lands_in_plan(page):
    start_run(page)
    forward_to_d3(page)
    page.evaluate("() => window.YueYan.Main.schedule({ type: 'buy', item: 'haoliao' })")
    enter_craft_now(page)
    page.click("#craft-filling-list [data-filling='dousha']")
    page.click("#craft-batch-premium")
    page.click("#btn-craft-start")
    page.wait_for_timeout(120)
    finished = inject_and_finish(page, [0, 0, 0, 0])
    page.wait_for_timeout(150)
    check("the measured result is handed to Main.finishCraft", finished["scheduled"] is True,
          str(finished))
    check("§4.4.1 好料 with P ≥ 3.60 grades 金饼", finished["grade"] == 3, str(finished))
    plan = page.evaluate("() => window.YueYan.Main.plan()")
    check("the finished short game consumes exactly one schedule slot",
          len(plan) == 2 and plan[1]["type"] == "shouzuo", str(plan))
    check("§4.1 the plan action carries the batch and the measured P",
          plan[1]["batch"] == "premium" and abs(plan[1]["P"] - 4) < 1e-9, str(plan))
    check("§5.2 the day panel shows one cake", "饼 1/5" in text(page, "#cake-count"),
          text(page, "#cake-count"))
    check("the player is back on the scheduler", is_active(page, "view-schedule"))
    settled = page.evaluate("() => window.YueYan.Main.finishDay()")
    check("§3.7 the cake settles with the engine's own grade",
          len(settled["cakes"]) == 1 and settled["cakes"][0]["grade"] == 3,
          str(settled["cakes"]))
    check("§4.1 materials are deducted exactly once",
          settled["stock"]["putong"] == 2 and settled["stock"]["haoliao"] == 0,
          str(settled["stock"]))


def test_abort_refund(page):
    start_run(page)
    before = page.evaluate("() => JSON.stringify(window.YueYan.Main.state().stock)")
    enter_craft(page)
    page.click("#craft-filling-list [data-filling='dousha']")
    page.click("#craft-batch-normal")
    page.click("#btn-craft-start")
    page.wait_for_timeout(150)
    inject(page, 0, 0)
    page.click("#btn-craft-abort")
    page.wait_for_timeout(200)
    check("§4.6 abort returns to the scheduler", is_active(page, "view-schedule"))
    after = page.evaluate("() => JSON.stringify(window.YueYan.Main.state().stock)")
    check("§4.6 abort refunds every material", after == before, f"{before} → {after}")
    plan = page.evaluate("() => window.YueYan.Main.plan()")
    check("§4.6 abort consumes zero slot", plan == [], str(plan))
    check("§4.6 abort leaves the slot free again",
          page.evaluate("() => document.querySelectorAll('#slot-grid .slot:not(.is-filled)')"
                        ".length") == 3)
    check("§4.6 abort never writes a cake",
          page.evaluate("() => window.YueYan.Main.state().cakes.length") == 0)


def test_cong_rong(page):
    start_run(page, cong_rong=True)
    check("从容模式 is stored on the run flags",
          page.evaluate("() => window.YueYan.Main.state().flags.congRong") is True)
    enter_craft(page)
    page.click("#craft-filling-list [data-filling='dousha']")
    page.click("#craft-batch-normal")
    page.click("#btn-craft-start")
    page.wait_for_timeout(200)
    check("§4.3.3 从容模式 keeps the swing (rate unchanged; only the cap is removed)",
          page.evaluate("() => document.getElementById('bar-s1')"
                        ".classList.contains('is-swinging')"))
    page.wait_for_timeout(9500)                                # beyond the 8 s budget
    check("§4.2 从容模式 removes the timing cap",
          text(page, "#step-index") == "第 1 步 / 共 4 步", text(page, "#step-index"))
    check("§4.2 从容模式 leaves the grade thresholds untouched",
          page.evaluate("() => window.YueYan.Engine.gradeOf('premium', 3.60)") == 3)


def test_touch_targets(page):
    enter_craft(page)
    targets = {"#btn-craft-start": height(page, "#btn-craft-start"),
               "#btn-craft-abort": height(page, "#btn-craft-abort"),
               "#craft-batch-normal": height(page, "#craft-batch-normal"),
               "#craft-filling-list .btn": height(page, "#craft-filling-list .btn")}
    short = {k: v for k, v in targets.items() if v < 56}
    check("primary craft targets are at least 56 CSS px tall", short == {}, str(short))
    check("the craft view declares a visible focus ring",
          ":focus-visible" in CSS.read_text(encoding="utf-8"))


def main():
    test_source_hygiene()
    suite = (test_engine_contract, test_craft_panel, test_step_sequence,
             test_soft_timer, test_s4_timeout_still_bakes, test_confirm_and_audio,
             test_grade_double_gate, test_cake_lands_in_plan, test_abort_refund,
             test_cong_rong, test_touch_targets)
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
    print(f"yueyan craft: {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
