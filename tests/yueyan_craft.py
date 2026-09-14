#!/usr/bin/env python3
"""月宴 Micro 层 assertions: the order-driven kitchen, §4.3 / §4.8 / §6.4 / §14.2 M-1.

Headless only. Drives window.YueYan.Engine directly, never the DOM, because
§4.3.9 locks the Micro layer as pure functions that read no clock, no DOM and
no save IO. Numbers are transcribed from docs/specs/2026-09-09-yueyan-design.md.

Scope of this file, and what it deliberately does not test:

  in      §4.8 order loop, §4.3 three-tap preparation, §4.3.5 heat and burning,
          §4.3.6 firewood fuel, §4.3.8 zero-failure, §4.3.9 craftSim contract,
          §4.9.2 chefAt, §4.10.2 nextGuide, §7.3 preferBonus, §6.4 invariants,
          and the Macro functions the rework had to leave untouched.
  out     the retired swing-meter mechanic — its tolerance windows, the re-arm
          gate and the four-step `injectStep` hook (§4.3.2 / §4.3.3 / §14.2 M-1
          ②). Asserting them would pin a mechanic that no longer exists, so they
          appear here only as the subject of an absence assertion.

Per §14.2: if an assertion fails, fix the engine or record the spec correction.
Never edit this file to match a wrong engine.
"""
import pathlib
import re
import subprocess

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENGINE = ROOT / "tools/yueyan/assets/engine.js"
MAIN = ROOT / "tools/yueyan/assets/main.js"
INDEX = ROOT / "tools/yueyan/index.html"

PASS = []
FAIL = []

# §4.3.3 the retired mechanic's two roots, and §4.3.9 the retired four-step hook.
# Matched as substrings so every derived name is covered by one assertion.
RETIRED_ROOTS = ("swing", "stoke")
RETIRED_HOOK = "injectStep"
# scene.js keeps one swing-named helper, so the root scan covers the clean
# sources only; that residual is reported, not asserted.
CLEAN_SOURCES = (ENGINE, MAIN, INDEX)

# §4.3.5 the two stoves are deliberately unequal (§4.7.1 P-1).
T_BURN = {"A": 12.0, "B": 10.0}
HEAT_CENTRE = 0.70          # §4.3.2 c_h, fixed, never random
GOLDEN_AT = 0.60            # §4.3.5 「佳」 starts
BURNT_AT = 0.90             # §4.3.5 「焦」 starts, and 焦 never deletes a cake
FUEL_SECONDS = 15.0         # §4.3.6 one bundle = one stove 15.0 seconds of fire
WOOD_CAP = 8                # §4.3.6 pile stock
SESSION_CAP = {1: 60, 2: 72}          # §4.3.7 实测走位下界 + 余量
STEP_BUDGET = {"S1": 8, "S2": 10, "S3": 12}          # §4.3.7 per-step seconds
STEP_CUM = {"S1": 8, "S2": 18, "S3": 30}             # §4.3.7 cumulative moments
CHEF_SPEED = 104            # §4.9.2 CSS px/s
HALF_WIDTH = [0.10, 0.13, 0.16, 0.19]     # §4.3.12 0.10 + 0.03 × patterns, cap 0.19
DEADLINE = {3: 60.0, 4: 54.0, 5: 48.0, 6: 42.0, 7: 36.0}   # §4.8.2
FAMILY = ["grandma", "father", "mother", "younger", "brother"]     # §3.9

EPS = 1e-9


class EngineError(Exception):
    """Raised when an engine hook throws, so RED reads as assertion failure."""


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
    else:
        FAIL.append(f"{name} :: {detail}")


def near(got, want, eps=EPS):
    return got is not None and abs(got - want) <= eps


def call(page, fn, *args):
    res = page.evaluate(
        """([fn, args]) => {
             try {
               return { ok: true,
                        value: window.YueYan.Engine[fn].apply(null, args) };
             } catch (e) {
               return { ok: false,
                        message: String(e && e.message ? e.message : e) };
             }
           }""",
        [fn, list(args)],
    )
    if not res["ok"]:
        raise EngineError(res["message"])
    return res["value"]


def err(page, fn, *args):
    """The thrown message, or None when the hook accepted the input."""
    return page.evaluate(
        """([fn, args]) => {
             try { window.YueYan.Engine[fn].apply(null, args); return null; }
             catch (e) { return String(e && e.message ? e.message : e); }
           }""",
        [fn, list(args)],
    )


def raises(page, fn, *args):
    """True when the hook throws for a real domain reason, with the §10.3.2 tag."""
    msg = err(page, fn, *args)
    return msg is not None and msg.startswith("[yueyan] ")


# ------------------------------------------------------- timeline builders §4.3.9
def ev(t, op, cake=None, step=None, d=None):
    """One `timeline` item `{t, op, cake, step, d}` (§4.3.9 contract table)."""
    return {"t": t, "op": op, "cake": cake, "step": step, "d": d}


def tap(cake, step, d, t):
    return ev(t, "tap", cake, step, d)


def taps9(cake, t0=0.1, gap=0.1):
    """Nine taps, three per step, in the fixed order S1 → S2 → S3 (§4.3.2)."""
    out, t = [], t0
    for step in ("S1", "S2", "S3"):
        for d in (1, 2, 3):
            out.append(tap(cake, step, d, round(t, 3)))
            t = round(t + gap, 3)
    return out


def session(n=1, fillings=None, batch="normal", patterns=0, day=3, cong_rong=False):
    """`spec` per §4.3.9."""
    return {"batch": batch, "n": n, "fillings": fillings or ["dousha"] * n,
            "patterns": patterns, "day": day, "congRong": cong_rong}


def golden_session(n=1, batch="premium", patterns=0, day=3, cong_rong=False):
    """A one-cake session taken out at exactly h = 0.70, then served."""
    sp = session(n, ["dousha"] * n, batch, patterns, day, cong_rong)
    timeline = taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                           ev(1.2, "place", 1, "A"),
                           ev(1.2 + T_BURN["A"] * HEAT_CENTRE, "take", 1),
                           ev(1.2 + T_BURN["A"] * HEAT_CENTRE + 0.1, "serve", 1)]
    return sp, timeline


def burnt_session():
    """Placed on stove A and never taken, so `h` clamps at 1.0 and the cake turns 焦."""
    return (session(),
            taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                        ev(1.2, "place", 1, "A"), ev(30.0, "end")])


def fn_source(text, name):
    """The verbatim source block of one engine function."""
    m = re.search(r"^  function %s\(.*?^  \}$" % re.escape(name), text, re.S | re.M)
    return m.group(0) if m else ""


def head_engine():
    """engine.js as committed, the §14.2 M-1 ② baseline for the verbatim rule."""
    out = subprocess.run(["git", "show", "HEAD:tools/yueyan/assets/engine.js"],
                         cwd=ROOT, capture_output=True, text=True, check=False)
    return out.stdout if out.returncode == 0 else ""


# --------------------------------------------------------- §14.2 M-1 ② verbatim
def test_retired_symbols():
    blob = "".join(p.read_text(encoding="utf-8").lower() for p in CLEAN_SOURCES)
    found = [w for w in RETIRED_ROOTS + (RETIRED_HOOK,) if w.lower() in blob]
    check("§4.3.3 / §4.3.9 the retired swing meter, stoke gate and four-step hook"
          " appear in none of the clean runtime sources", found == [], str(found))

    engine = ENGINE.read_text(encoding="utf-8")
    tol_hits = sorted(set(re.findall(r"\btol\w*", engine)))
    check("§4.3.2 / §14.2 M-1 ② engine.js carries no tolerance symbol beyond"
          " precision's own parameter", tol_hits == ["tol"], str(tol_hits))

    clock = [w for w in ("Date.now", "performance.now", "setTimeout", "setInterval",
                         "requestAnimationFrame") if w in engine]
    check("§4.3.9 engine owns no clock", clock == [], str(clock))
    dom = [w for w in ("document.", "localStorage", "Audio.") if w in engine]
    check("§10.3.2 engine touches no DOM, no save IO, no audio", dom == [], str(dom))
    check("§10.1 / V-3 / X-7 engine holds no Math.random", "Math.random" not in engine)

    hooks = ["craftSim", "heatAt", "chefAt", "nextGuide", "fuelAt", "deadlineOf",
             "qtyOf", "spawnOrders", "sessionCapOf", "heatHalfWidth", "p4Of",
             "heatLabelOf", "preferBonus"]
    missing = [h for h in hooks if h + ":" not in engine]
    check("§4.3.9 the eleven Micro hooks are exported", missing == [], str(missing))


def test_grade_precision_verbatim():
    """§14.2 M-1 ②: gradeOf and precision survive byte-identical to HEAD."""
    head = head_engine()
    check("HEAD engine.js readable as the verbatim baseline", head != "")
    now = ENGINE.read_text(encoding="utf-8")
    for name in ("gradeOf", "precision"):
        before, after = fn_source(head, name), fn_source(now, name)
        check(f"§14.2 M-1 ② {name} located in both revisions",
              before != "" and after != "")
        check(f"§14.2 M-1 ② {name} is byte-identical to HEAD", before == after,
              f"HEAD {before!r} != working tree {after!r}")


# ------------------------------------------------------------------ §4.8 orders
def test_order_loop(page):
    check("§4.8.2 deadline ladder D3 → D7",
          [call(page, "deadlineOf", d) for d in range(3, 8)]
          == [DEADLINE[d] for d in range(3, 8)],
          str([call(page, "deadlineOf", d) for d in range(3, 8)]))
    check("§4.8.2 day 3 gives 60.0", near(call(page, "deadlineOf", 3), 60.0))
    check("§4.8.2 day 7 gives 36.0", near(call(page, "deadlineOf", 7), 36.0))
    check("§4.8.2 deadline = max(36.0, 60.0 − 6.0 × (day − 3)) holds for every day",
          all(near(call(page, "deadlineOf", d), max(36.0, 60.0 - 6.0 * (d - 3)))
              for d in range(3, 8)))
    check("§4.8.2 same day's sessions share one deadline",
          near(call(page, "deadlineOf", 5), call(page, "deadlineOf", 5)))
    check("§4.8.2 craft day outside D3–D7 is rejected",
          raises(page, "deadlineOf", 2) and raises(page, "deadlineOf", 8))

    ladder = [(0, 1), (1, 1), (2, 2), (3, 2), (4, 3), (5, 3), (6, 3), (7, 4), (9, 4)]
    check("§4.7.1 A-4b the qtyOf 1/2/3/4 ladder survives verbatim",
          [call(page, "qtyOf", m) for m, _ in ladder] == [q for _, q in ladder],
          str([call(page, "qtyOf", m) for m, _ in ladder]))

    spec_one = session(1, ["dousha"], day=3)
    orders = call(page, "spawnOrders", spec_one)
    check("§4.8.5 simultaneously open orders equal spec.n (n = 1)", len(orders) == 1,
          str(orders))
    two = call(page, "spawnOrders", session(2, ["guihua", "lianrong"], day=5))
    check("§4.8.5 simultaneously open orders equal spec.n (n = 2)", len(two) == 2,
          str(two))
    check("§4.8.5 every spawned order starts open",
          all(o["state"] == "open" for o in orders + two))
    check("§4.8.1 份数 clamped to 1, one cake per family member",
          all(o["qty"] == 1 for o in orders + two), str([o["qty"] for o in orders + two]))
    check("§4.8.1 orders are the five §3.9 family members",
          all(o["family"] in FAMILY for o in orders + two),
          str([o["family"] for o in orders + two]))
    check("§4.8.1 an order asks for that member's preference filling",
          all(call(page, "preferBonus", o["filling"], o["family"], 3) in (0, 8, 12)
              and call(page, "preferBonus", o["filling"], o["family"], 3) == 12
              for o in orders + two))
    check("§4.8.2 the order deadline comes from the craft day",
          all(near(o["deadline"], DEADLINE[3]) for o in orders)
          and all(near(o["deadline"], DEADLINE[5]) for o in two),
          str([o["deadline"] for o in orders + two]))
    check("§4.8 A-4c spawnOrders is deterministic for one spec",
          call(page, "spawnOrders", spec_one) == call(page, "spawnOrders", spec_one))
    check("§4.8 A-4c spawnOrders gives one identical list across two reads",
          two == call(page, "spawnOrders", session(2, ["guihua", "lianrong"], day=5)))
    check("§4.8.1 two orders never name the same family member",
          len({o["family"] for o in two}) == 2, str([o["family"] for o in two]))
    check("§4.8 spawnOrders rejects n outside {1, 2}",
          raises(page, "spawnOrders", session(0)) and raises(page, "spawnOrders",
                                                            session(3)))


def test_order_serving(page):
    sp, timeline = golden_session()
    hit = call(page, "craftSim", sp, timeline)["cakes"][0]
    check("§4.8.5 serving a matching filling lets the family take the cake",
          hit["orderServed"] is True, str(hit))
    check("§4.8.5 the served cake still carries its measured P and grade",
          near(hit["P"], 4.0) and hit["grade"] == 3, str(hit))

    # n = 2, both cakes 豆沙: only 祖母 prefers 豆沙, so the second order falls back
    # to 父亲 (五仁) and the second 豆沙 cake matches nobody (§4.8.5).
    mismatch = call(page, "craftSim",
                    session(2, ["dousha", "dousha"]),
                    taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                                ev(1.2, "place", 1, "A")]
                    + taps9(2, t0=1.3) + [ev(3.0, "wood"), ev(3.1, "light", step="B"),
                                          ev(3.2, "place", 2, "B"),
                                          ev(9.6, "take", 1), ev(9.7, "serve", 1),
                                          ev(10.2, "take", 2), ev(10.3, "serve", 2),
                                          ev(10.3, "end")])
    check("§4.8.5 a mismatched cake still ships: craftSim returns all n cakes",
          len(mismatch["cakes"]) == 2, str(len(mismatch["cakes"])))
    check("§4.8.5 the first 豆沙 cake matched 祖母",
          mismatch["cakes"][0]["orderServed"] is True, str(mismatch["cakes"][0]))
    check("§4.8.5 the mismatched cake wastes itself but nobody takes it",
          mismatch["cakes"][1]["orderServed"] is False, str(mismatch["cakes"][1]))
    check("§4.8.5 the wasted cake is still produced, never deleted",
          near(mismatch["cakes"][1]["P"], 4.0)
          and mismatch["cakes"][1]["grade"] == 2
          and mismatch["cakes"][1]["tServe"] is not None,
          str(mismatch["cakes"][1]))

    # D7 deadline 36.0; the cake comes out at 9.6 but is served at 40.0, after the
    # family has already left (§4.8.5 超时呈现: no score penalty, no loss judgement).
    expired = call(page, "craftSim", session(1, ["dousha"], day=7),
                   taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                               ev(1.2, "place", 1, "A"), ev(9.6, "take", 1),
                               ev(40.0, "serve", 1), ev(40.0, "end")])
    cake = expired["cakes"][0]
    check("§4.8.5 an expired order leaves nobody to take the cake",
          cake["orderServed"] is False, str(cake))
    check("§4.8.5 expiry carries no score penalty: P and grade are untouched",
          near(cake["P"], 4.0) and cake["grade"] == 2, str(cake))
    check("§4.8.5 expiry is no loss judgement: the cake is still produced",
          len(expired["cakes"]) == 1 and expired["n"] == 1, str(expired))
    check("§4.8.5 the same cake served before the deadline does score",
          near(call(page, "deadlineOf", 7), 36.0) and hit["orderServed"] is True)


# --------------------------------------------------------------- §4.3 three taps
def test_three_tap_prep(page):
    sp, timeline = golden_session()
    cake = call(page, "craftSim", sp, timeline)["cakes"][0]
    check("§4.3.2 three taps per step, nine per cake, all within budget give p = 1",
          cake["p"][:3] == [1, 1, 1], str(cake["p"]))
    check("§4.3.2 P = p1 + p2 + p3 + p4",
          near(cake["P"], sum(cake["p"])), str(cake))

    check("§4.3.2 the pip count must climb 1 → 2 → 3, so 2 first is rejected",
          raises(page, "craftSim", sp, [tap(1, "S1", 2, 0.1)]))
    check("§4.3.2 a fourth tap on a finished step is rejected",
          raises(page, "craftSim", sp, taps9(1) + [tap(1, "S1", 4, 1.0)]))
    check("§4.3.2 S2 before S1 is done is rejected (no skipping)",
          raises(page, "craftSim", sp, [tap(1, "S2", 1, 0.1)]))
    check("§4.3.2 S3 before S2 is done is rejected (no skipping)",
          raises(page, "craftSim", sp,
                 [tap(1, "S1", 1, 0.1), tap(1, "S1", 2, 0.2), tap(1, "S1", 3, 0.3),
                  tap(1, "S3", 1, 0.4)]))
    check("§4.3.2 there is no fourth board step",
          raises(page, "craftSim", sp, [tap(1, "S4", 1, 0.1)]))
    check("§4.3.2 落模 must be tapped full before the cake may go on a stove",
          raises(page, "craftSim", sp, [tap(1, "S1", 1, 0.1), ev(1.0, "wood"),
                                        ev(1.1, "light", step="A"),
                                        ev(1.2, "place", 1, "A")]))

    # §4.3.7 the 30-second cumulative budget, anchored at the session start.
    late = call(page, "craftSim", sp,
                [tap(1, "S1", 1, 9.0), tap(1, "S1", 2, 9.1), tap(1, "S1", 3, 9.2),
                 tap(1, "S2", 1, 19.0), tap(1, "S2", 2, 19.1), tap(1, "S2", 3, 19.2),
                 tap(1, "S3", 1, 31.0), tap(1, "S3", 2, 31.1), tap(1, "S3", 3, 31.2),
                 ev(32.0, "end")])["cakes"][0]
    check("§4.3.7 S1 past 8, S2 past 18, S3 past 30 all score p = 0",
          late["p"][:3] == [0, 0, 0], str(late["p"]))
    check("§4.3.7 p ∈ {0, 1}: the board steps are binary, never continuous",
          all(v in (0, 1) for v in late["p"][:3] + cake["p"][:3]))

    on_time = call(page, "craftSim", sp,
                   [tap(1, "S1", 1, 7.9), tap(1, "S1", 2, 7.95), tap(1, "S1", 3, 8.0),
                    tap(1, "S2", 1, 17.9), tap(1, "S2", 2, 17.95), tap(1, "S2", 3, 18.0),
                    tap(1, "S3", 1, 29.9), tap(1, "S3", 2, 29.95), tap(1, "S3", 3, 30.0),
                    ev(30.0, "end")])["cakes"][0]
    check("§4.3.7 exactly at 8 / 18 / 30 is still inside the budget",
          on_time["p"][:3] == [1, 1, 1], str(on_time["p"]))
    check("§4.3.7 the three board budgets 8 / 10 / 12 sum to 30 seconds",
          sum(STEP_BUDGET.values()) == 30 and list(STEP_BUDGET.values()) == [8, 10, 12])
    check("§4.3.7 the cumulative moments are 8 / 18 / 30",
          STEP_CUM == {"S1": 8, "S2": 18, "S3": 30})

    # §4.3.7 the second cake is anchored at cake 1's t_on, not at the session start.
    anchor = session(2, ["dousha", "wuren"])
    paired = call(page, "craftSim", anchor,
                  taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                              ev(2.0, "place", 1, "A")] + taps9(2, t0=9.0)
                  + [ev(10.0, "wood"), ev(10.1, "light", step="B"),
                     ev(10.2, "place", 2, "B"), ev(48.0, "end")])
    inside = paired["cakes"][1]
    check("§4.3.7 cake 2 inside t_on甲 + 8 / 18 / 30 scores p = 1",
          inside["p"][:3] == [1, 1, 1], str(inside["p"]))
    outside = call(page, "craftSim", anchor,
                   taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                               ev(2.0, "place", 1, "A")]
                   + [tap(2, "S1", 1, 10.5), tap(2, "S1", 2, 10.6), tap(2, "S1", 3, 10.7),
                      tap(2, "S2", 1, 20.5), tap(2, "S2", 2, 20.6), tap(2, "S2", 3, 20.7),
                      tap(2, "S3", 1, 32.5), tap(2, "S3", 2, 32.6), tap(2, "S3", 3, 32.7),
                      ev(48.0, "end")])["cakes"][1]
    check("§4.3.7 cake 2 just past t_on甲 + 8 / 18 / 30 scores p = 0",
          outside["p"][:3] == [0, 0, 0], str(outside["p"]))
    check("§4.3.7 cake 2's anchor is cake 1's t_on 2.0, not the session start",
          near(paired["cakes"][0]["tOn"], 2.0) and inside["p"][0] == 1
          and 9.2 > STEP_BUDGET["S1"],
          f"t_on甲 {paired['cakes'][0]['tOn']}, p1 {inside['p'][0]}")


# ------------------------------------------------------------- §4.3.5 heat scale
def test_heat_and_burning(page):
    for stove, T in T_BURN.items():
        for lit, want in ((0.0, 0.0), (T * 0.5, 0.5), (T * GOLDEN_AT, GOLDEN_AT),
                          (T * HEAT_CENTRE, HEAT_CENTRE), (T * 0.8, 0.8),
                          (T * BURNT_AT, BURNT_AT), (T, 1.0), (T * 2, 1.0)):
            got = call(page, "heatAt", lit, stove)
            check(f"§4.3.5 heatAt({lit}, {stove}) = clamp({lit}/{T}, 0, 1)",
                  near(got, want), f"got {got}, want {want}")
    check("§4.7.1 P-1 the two T_burn values are deliberately unequal",
          near(T_BURN["A"], 12.0) and near(T_BURN["B"], 10.0)
          and not near(T_BURN["A"], T_BURN["B"]))
    check("§4.3.5 从容模式 freezes h at 0.70 regardless of both arguments",
          all(near(call(page, "heatAt", lit, stove, True), HEAT_CENTRE)
              for lit in (0.0, 1.0, 999.0) for stove in ("A", "B")))
    check("§4.3.5 heatAt rejects an unknown stove and a negative litElapsed",
          raises(page, "heatAt", 1.0, "C") and raises(page, "heatAt", -1.0, "A"))

    labels = [(0.0, False, "生"), (0.0, True, "在烘"), (0.59, True, "在烘"),
              (GOLDEN_AT, True, "佳"), (HEAT_CENTRE, True, "佳"), (0.89, True, "佳"),
              (BURNT_AT, True, "焦"), (1.0, False, "焦")]
    for h, lit, want in labels:
        got = call(page, "heatLabelOf", h, lit)
        check(f"§4.3.5 heatLabelOf({h}, lit={lit}) = {want}", got == want, f"got {got}")
    check("§4.3.5 the four states are exactly 生 / 在烘 / 佳 / 焦",
          {call(page, "heatLabelOf", h, lit) for h, lit, _ in labels}
          == {"生", "在烘", "佳", "焦"})

    # precision(d, tol) = clamp(1 − d / tol, 0, 1) — unchanged (§4.3.2).
    for d, tol, want in ((0.0, 0.10, 1.0), (0.05, 0.10, 0.5), (0.10, 0.10, 0.0),
                         (0.20, 0.10, 0.0), (0.0, 0.0, 0.0), (-0.05, 0.10, 1.0)):
        got = call(page, "precision", d, tol)
        check(f"§4.3.2 precision({d}, {tol}) unchanged", near(got, want), f"got {got}")

    check("§4.3.12 the佳 window half-width ladder is 0.10 / 0.13 / 0.16 / 0.19",
          [call(page, "heatHalfWidth", p) for p in range(4)] == HALF_WIDTH,
          str([call(page, "heatHalfWidth", p) for p in range(4)]))
    check("§4.3.12 patterns outside 0..3 are rejected",
          raises(page, "heatHalfWidth", -1) and raises(page, "heatHalfWidth", 4))

    for patterns, half in enumerate(HALF_WIDTH):
        for h, want in ((HEAT_CENTRE, 1.0), (HEAT_CENTRE - half, 0.0),
                        (HEAT_CENTRE + half, 0.0), (HEAT_CENTRE - half / 2, 0.5)):
            got = call(page, "p4Of", h, patterns)
            check(f"§4.3.2 p4Of({h}, {patterns}) = precision(|h − 0.70|, {half})",
                  near(got, want), f"got {got}, want {want}")
    check("§4.3.2 p4 at the window edge is 0, and at the centre is 1",
          near(call(page, "p4Of", HEAT_CENTRE, 0), 1.0)
          and abs(call(page, "p4Of", GOLDEN_AT, 0)) < 1e-6)
    check("§4.3.12 纹样 widens the window: h = 0.55 scores 0 at 0 and > 0 at 3",
          abs(call(page, "p4Of", 0.55, 0)) < 1e-6
          and call(page, "p4Of", 0.55, 3) > 0.2)
    check("§4.3.5 焦 (h ≥ 0.90) always scores p4 = 0",
          all(abs(call(page, "p4Of", h, p)) < 1e-6
              for h in (BURNT_AT, 0.95, 1.0) for p in range(4)))


# ------------------------------------------------------- §4.3.5 / §4.3.8 no fail
def test_zero_failure(page):
    sp, timeline = burnt_session()
    burnt = call(page, "craftSim", sp, timeline)["cakes"][0]
    check("§4.3.5 h clamps at 1.0 and never exceeds it",
          near(burnt["heatAtTake"], 1.0), str(burnt["heatAtTake"]))
    check("§4.3.5 the burnt cake reads 焦", burnt["heatLabel"] == "焦", str(burnt))
    check("§4.3.5 h ≥ 0.90 only makes p4 = 0", near(burnt["p"][3], 0.0), str(burnt["p"]))
    check("§4.3.8 焦 lowers P from 4 to 3, it does not delete the cake",
          near(burnt["P"], 3.0), str(burnt))
    check("§4.3.8 焦 may lower the grade: 3 on a normal batch is 银",
          burnt["grade"] == 2, str(burnt["grade"]))
    check("§4.3.8 the burnt cake still lands on the plate and is auto taken out",
          burnt["tTake"] is not None and burnt["auto"] is True, str(burnt))

    served = call(page, "craftSim", sp,
                  taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                              ev(1.2, "place", 1, "A"), ev(12.0, "take", 1),
                              ev(12.1, "serve", 1), ev(12.1, "end")])["cakes"][0]
    check("§4.3.8 the burnt cake can still be served",
          served["heatLabel"] == "焦" and served["orderServed"] is True, str(served))

    scenarios = {
        "golden": golden_session()[1],
        "burnt": burnt_session()[1],
        "cold stove": taps9(1) + [ev(1.2, "place", 1, "A"), ev(30.0, "end")],
        "no taps at all": [ev(40.0, "end")],
        "steps only": taps9(1) + [ev(40.0, "end")],
    }
    for label, timeline in scenarios.items():
        out = call(page, "craftSim", session(), timeline)
        check(f"§4.3.8 craftSim returns exactly n cakes ({label})",
              len(out["cakes"]) == out["n"] == 1, str(len(out["cakes"])))
        grade = out["cakes"][0]["grade"]
        check(f"§4.3.8 every grade is ≥ 1, no scrap branch ({label})",
              grade in (1, 2, 3), str(grade))
    two = call(page, "craftSim", session(2, ["dousha", "wuren"]),
               taps9(1) + taps9(2, t0=1.3) + [ev(48.0, "end")])
    check("§4.3.8 craftSim returns exactly n cakes for n = 2",
          len(two["cakes"]) == two["n"] == 2, str(len(two["cakes"])))
    check("§4.3.8 the zero-failure theorem has no delete branch in engine.js",
          "delete cakes" not in ENGINE.read_text(encoding="utf-8")
          and "cakes.splice" not in ENGINE.read_text(encoding="utf-8"))


# ---------------------------------------------------------------- §4.3.6 firewood
def test_fuel(page):
    for elapsed, want in ((0.0, FUEL_SECONDS), (7.5, 7.5), (FUEL_SECONDS, 0.0),
                          (20.0, 0.0)):
        got = call(page, "fuelAt", elapsed)
        check(f"§4.3.6 fuelAt({elapsed}) = max(0, 15 − elapsed)",
              near(got, want), f"got {got}, want {want}")
    check("§4.3.6 one bundle gives one stove exactly 15.0 seconds of fire",
          near(call(page, "fuelAt", 0.0), 15.0))
    check("§4.3.6 fuelAt rejects a negative elapsed", raises(page, "fuelAt", -1.0))

    sp = session()
    cold = call(page, "craftSim", sp,
                taps9(1) + [ev(1.2, "place", 1, "A"), ev(30.0, "end")])["cakes"][0]
    check("§4.3.6 a stove with no fire does not bake",
          near(cold["heatAtTake"], 0.0) and cold["heatLabel"] == "生", str(cold))
    check("§4.3.6 the cold-stove cake still ships, fire-out never deletes",
          cold["tTake"] is not None and cold["grade"] >= 1, str(cold))

    # Light at 1.1 (fire out at 16.1), place at 11.0, so only 5.1 seconds of fire
    # reach the cake; taking it at 30.0 must read the frozen h, not 1.0.
    frozen = call(page, "craftSim", sp,
                  taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                              ev(11.0, "place", 1, "A"), ev(30.0, "take", 1),
                              ev(30.1, "end")])["cakes"][0]
    check("§4.3.6 fire-out FREEZES h at the partial value 5.1 / 12",
          near(frozen["heatAtTake"], 5.1 / 12.0), str(frozen["heatAtTake"]))
    check("§4.3.6 the frozen cake is 生 and never burnt",
          frozen["heatLabel"] == "生" and frozen["heatAtTake"] < BURNT_AT, str(frozen))
    check("§4.3.6 fire-out never deletes a cake", frozen["tTake"] is not None)

    relit = call(page, "craftSim", sp,
                 taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                             ev(11.0, "place", 1, "A"), ev(20.0, "wood"),
                             ev(20.5, "light", step="A"), ev(25.0, "take", 1),
                             ev(25.1, "end")])["cakes"][0]
    check("§4.3.6 relighting resumes litElapsed from the frozen 5.1 to 9.6",
          near(relit["heatAtTake"], 9.6 / 12.0), str(relit["heatAtTake"]))
    check("§4.3.6 relighting does not reset h to 0",
          relit["heatAtTake"] > 4.5 / 12.0, str(relit["heatAtTake"]))
    check("§4.3.6 relighting costs a second bundle",
          call(page, "craftSim", sp,
               taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                           ev(11.0, "place", 1, "A"), ev(20.0, "wood"),
                           ev(20.5, "light", step="A"), ev(25.0, "take", 1),
                           ev(25.1, "end")])["woodUsed"] == 2)

    one = call(page, "craftSim", sp, golden_session()[1])
    check("§4.3.6 each lighting consumes exactly one bundle", one["woodUsed"] == 1,
          str(one["woodUsed"]))
    both = call(page, "craftSim", session(2, ["dousha", "wuren"]),
                taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                            ev(1.2, "place", 1, "A")] + taps9(2, t0=1.3)
                + [ev(3.0, "wood"), ev(3.1, "light", step="B"),
                   ev(3.2, "place", 2, "B"), ev(9.6, "take", 1), ev(9.7, "serve", 1),
                   ev(10.2, "take", 2), ev(10.3, "serve", 2), ev(10.3, "end")])
    check("§4.3.6 lighting both stoves consumes two bundles", both["woodUsed"] == 2,
          str(both["woodUsed"]))
    check("§4.3.6 lighting without a bundle taken from the pile is rejected",
          raises(page, "craftSim", sp, taps9(1) + [ev(1.0, "light", step="A")]))
    check("§4.3.6 the pile holds 8 bundles and the ninth取柴 is rejected",
          raises(page, "craftSim", sp,
                 taps9(1) + [ev(1.0 + i * 0.1, "wood") for i in range(9)]
                 + [ev(30.0, "end")]))
    eight = call(page, "craftSim", sp,
                 taps9(1) + [ev(1.0 + i * 0.1, "wood") for i in range(WOOD_CAP)]
                 + [ev(30.0, "end")])
    check("§4.3.6 eight bundles may all be taken", eight["woodUsed"] == WOOD_CAP,
          str(eight["woodUsed"]))
    check("§4.3.6 从容模式 never consumes the pile",
          call(page, "craftSim", session(cong_rong=True),
               taps9(1) + [ev(200.0, "light", step="A"), ev(201.0, "place", 1, "A"),
                           ev(500.0, "take", 1), ev(500.1, "end")])["woodUsed"] == 0)


# ------------------------------------------------------------- §4.3.9 craftSim
def test_craftsim_contract(page):
    sp, timeline = golden_session()
    out = call(page, "craftSim", sp, timeline)
    check("§4.3.9 the session result carries n / endedAt / woodUsed / cakes",
          set(out) == {"n", "endedAt", "woodUsed", "cakes"}, str(sorted(out)))
    cake_keys = {"index", "filling", "stove", "tOn", "tTake", "tServe", "auto",
                 "p", "P", "grade", "heatAtTake", "heatLabel", "orderServed"}
    check("§4.3.9 each cake carries the thirteen locked keys",
          set(out["cakes"][0]) == cake_keys, str(sorted(out["cakes"][0])))
    check("§4.3.9 p is the four-part vector [p1, p2, p3, p4]",
          len(out["cakes"][0]["p"]) == 4, str(out["cakes"][0]["p"]))
    check("§4.3.9 endedAt is the session's T_end",
          near(out["endedAt"], timeline[-1]["t"]), str(out["endedAt"]))
    check("§4.3.9 T_end takes the all-served moment when it is earliest",
          out["endedAt"] < SESSION_CAP[1], str(out["endedAt"]))
    explicit_end = call(page, "craftSim", sp,
                        taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                                    ev(1.2, "place", 1, "A"), ev(20.0, "end")])
    check("§4.3.9 T_end takes the explicit end when it precedes the cap",
          near(explicit_end["endedAt"], 20.0), str(explicit_end["endedAt"]))
    no_end = call(page, "craftSim", sp,
                  taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                              ev(1.2, "place", 1, "A")])
    check("§4.3.9 T_end falls back to the session cap when nothing ends earlier",
          near(no_end["endedAt"], SESSION_CAP[1]), str(no_end["endedAt"]))

    violations = {
        "rule 1 t must be non-decreasing": [ev(5.0, "wood"), ev(4.0, "wood")],
        "rule 2 op must be one of the seven": taps9(1) + [ev(1.0, "swing")],
        "rule 3 cake must be inside 1..n": [tap(0, "S1", 1, 0.1)],
        "rule 3 cake above n is rejected": [tap(2, "S1", 1, 0.1)],
        "rule 4 tap order is S1 → S2 → S3": [tap(1, "S2", 1, 0.1)],
        "rule 4 d climbs 1 → 2 → 3": [tap(1, "S1", 2, 0.1)],
        "rule 4 each step takes exactly 3 taps": taps9(1) + [tap(1, "S1", 4, 1.0)],
        "rule 6 light needs a stove in {A, B}": taps9(1)
        + [ev(1.0, "wood"), ev(1.1, "light", step="C")],
        "rule 7 place needs S3 tapped full": [tap(1, "S1", 1, 0.1), ev(1.0, "wood"),
                                             ev(1.1, "light", step="A"),
                                             ev(1.2, "place", 1, "A")],
        "rule 8 take needs a placed untaken cake": taps9(1) + [ev(9.6, "take", 1)],
        "rule 9 serve needs a taken cake": taps9(1) + [ev(1.0, "wood"),
                                                      ev(1.1, "light", step="A"),
                                                      ev(1.2, "place", 1, "A"),
                                                      ev(9.6, "serve", 1)],
        "rule 10 end must be last": taps9(1) + [ev(30.0, "end"), ev(31.0, "wood")],
        "§4.3.7 op past the session cap": taps9(1) + [ev(1.0, "wood"),
                                                      ev(1.1, "light", step="A"),
                                                      ev(1.2, "place", 1, "A"),
                                                      ev(61.0, "end")],
    }
    for label, bad in violations.items():
        check(f"§4.3.9 craftSim throws on {label}", raises(page, "craftSim", sp, bad),
              str(err(page, "craftSim", sp, bad)))

    clash = taps9(1) + [ev(1.0, "wood"), ev(1.1, "light", step="A"),
                        ev(1.2, "place", 1, "A")] + taps9(2, t0=1.3) \
        + [ev(3.0, "place", 2, "A")]
    check("§4.3.1 one stove holds at most one cake",
          raises(page, "craftSim", session(2, ["dousha", "wuren"]), clash),
          str(err(page, "craftSim", session(2, ["dousha", "wuren"]), clash)))
    check("§4.3.7 the n = 2 session cap is 72 seconds",
          raises(page, "craftSim", session(2, ["dousha", "wuren"]),
                 taps9(1) + [ev(73.0, "end")]))
    check("§4.3.7 sessionCapOf reads 60 for n = 1 and 72 for n = 2",
          call(page, "sessionCapOf", 1) == SESSION_CAP[1]
          and call(page, "sessionCapOf", 2) == SESSION_CAP[2])
    check("§4.3.7 sessionCapOf rejects n outside {1, 2}",
          raises(page, "sessionCapOf", 3))

    bad_specs = {"n = 0": session(0), "n = 3": session(3, ["dousha"] * 3),
                 "batch gold": session(1, ["dousha"], "gold"),
                 "fillings ≠ n": session(1, ["dousha", "wuren"]),
                 "unknown filling": session(1, ["pizza"]),
                 "patterns 4": session(1, ["dousha"], patterns=4),
                 "day 2": session(1, ["dousha"], day=2),
                 "day 8": session(1, ["dousha"], day=8)}
    for label, bad in bad_specs.items():
        check(f"§4.3.9 craftSim throws on spec {label}",
              raises(page, "craftSim", bad, timeline), str(err(page, "craftSim", bad,
                                                               timeline)))
    check("§4.3.9 craftSim throws when the spec is missing",
          raises(page, "craftSim", None, timeline))
    check("§10.3.2 craftSim throws when the timeline is not an array",
          raises(page, "craftSim", sp, None) and raises(page, "craftSim", sp, {}))

    purity = page.evaluate("""([sp, tl]) => {
      const E = window.YueYan.Engine;
      const specCopy = JSON.stringify(sp), tlCopy = JSON.stringify(tl);
      const ls = JSON.stringify(Object.keys(localStorage).sort());
      const a = E.craftSim(sp, tl), b = E.craftSim(sp, tl);
      return { specSame: JSON.stringify(sp) === specCopy,
               timelineSame: JSON.stringify(tl) === tlCopy,
               saveSame: JSON.stringify(Object.keys(localStorage).sort()) === ls,
               deterministic: JSON.stringify(a) === JSON.stringify(b),
               grade: a.cakes[0].grade };
    }""", [sp, timeline])
    check("§4.3.9 craftSim does not mutate its input spec", purity["specSame"] is True)
    check("§4.3.9 craftSim does not mutate its input timeline",
          purity["timelineSame"] is True)
    check("§4.3.9 craftSim writes no save state", purity["saveSame"] is True)
    check("§4.3.9 craftSim is deterministic: two runs, one identical result",
          purity["deterministic"] is True)
    check("§4.3.9 craftSim grades through gradeOf(batch, P)",
          purity["grade"] == 3
          and purity["grade"] == call(page, "gradeOf", sp["batch"], 4.0),
          str(purity["grade"]))

    cong = call(page, "craftSim", session(cong_rong=True),
                taps9(1, t0=100.0, gap=1.0) + [ev(200.0, "light", step="A"),
                                               ev(201.0, "place", 1, "A"),
                                               ev(500.0, "take", 1), ev(500.1, "end")])
    check("§4.3.10 从容模式 removes the session cap",
          cong["endedAt"] > SESSION_CAP[1], str(cong["endedAt"]))
    check("§4.3.10 从容模式 gives p4 = 1 at any take moment",
          near(cong["cakes"][0]["p"][3], 1.0), str(cong["cakes"][0]["p"]))
    check("§4.3.10 从容模式 keeps the double gate: 普通批次 at P = 4 still cannot go 金",
          cong["cakes"][0]["P"] == 4.0 and cong["cakes"][0]["grade"] == 2,
          str(cong["cakes"][0]))
    cong_gold = call(page, "craftSim", session(batch="premium", cong_rong=True),
                     taps9(1, t0=100.0, gap=1.0) + [ev(200.0, "light", step="A"),
                                                    ev(201.0, "place", 1, "A"),
                                                    ev(500.0, "take", 1),
                                                    ev(500.1, "end")])["cakes"][0]
    check("§4.3.10 从容模式 keeps the thresholds: 好料批次 at P ≥ 3.60 still goes 金",
          cong_gold["grade"] == 3 and cong_gold["P"] == 4.0, str(cong_gold))
    check("§4.3.10 从容模式 never burns the cake",
          cong["cakes"][0]["heatLabel"] == "佳", str(cong["cakes"][0]))


# ---------------------------------------------------------- §4.9.2 / §4.10.2 chef
def test_chef_and_guide(page):
    path = [{"x": 0, "y": 0}, {"x": 208, "y": 0}]
    check("§4.9.2 the chef starts at path[0] when elapsed = 0",
          call(page, "chefAt", 0.0, path) == {"x": 0, "y": 0},
          str(call(page, "chefAt", 0.0, path)))
    check("§4.9.2 the chef walks at 104 CSS px/s",
          call(page, "chefAt", 0.5, path) == {"x": 52, "y": 0}
          and call(page, "chefAt", 1.0, path) == {"x": 104, "y": 0}
          and call(page, "chefAt", 2.0, path) == {"x": 208, "y": 0},
          str([call(page, "chefAt", t, path) for t in (0.5, 1.0, 2.0)]))
    check("§4.9.2 / §8.4.8 M-1 chefAt returns integer coordinates",
          all(call(page, "chefAt", t, path)["x"] % 1 == 0
              and call(page, "chefAt", t, path)["y"] % 1 == 0
              for t in (0.13, 0.27, 0.61, 1.37)),
          str([call(page, "chefAt", t, path) for t in (0.13, 0.27, 0.61, 1.37)]))
    check("§4.9.2 the chef stops at the last waypoint, never past it",
          call(page, "chefAt", 99.0, path) == {"x": 208, "y": 0},
          str(call(page, "chefAt", 99.0, path)))
    legs = [{"x": 0, "y": 0}, {"x": 104, "y": 0}, {"x": 104, "y": 104}]
    check("§4.9.2 the remaining budget carries into the next leg",
          call(page, "chefAt", 1.5, legs) == {"x": 104, "y": 52},
          str(call(page, "chefAt", 1.5, legs)))
    check("§4.9.2 chefAt rejects a negative elapsed and an empty path",
          raises(page, "chefAt", -1.0, path) and raises(page, "chefAt", 0.0, []))

    cold_stove = {"cake": None, "lit": False}
    lit_stove = {"cake": None, "lit": True}
    baking = {"cake": {"state": "baking"}, "lit": True}
    cold_cake = {"cake": {"state": "raw"}, "lit": False}
    pile = {"wood": 8, "rackWork": True}

    def kitchen_of(stoves, carrying, board=None, **over):
        state = {"stoves": stoves, "carrying": carrying, "board": board}
        state.update(pile)
        state.update(over)
        return state

    kitchen = kitchen_of({"A": dict(cold_stove), "B": dict(cold_stove)}, None)
    check("§4.10.2 session start with empty hands and no cake on a stove resolves to 食材架",
          call(page, "nextGuide", kitchen) == "rack", str(call(page, "nextGuide",
                                                               kitchen)))
    check("§4.10.2 the same kitchen with a cake waiting on a cold stove resolves to 柴堆",
          call(page, "nextGuide",
               kitchen_of({"A": dict(cold_cake), "B": dict(cold_stove)}, None)) == "wood",
          str(call(page, "nextGuide",
                   kitchen_of({"A": dict(cold_cake), "B": dict(cold_stove)}, None))))
    rules = [
        ("rule 1 a golden cake on stove A beats everything",
         kitchen_of({"A": {"cake": {"state": "golden"}, "lit": True}, "B": lit_stove},
                    {"kind": "wood"}), "stoveA"),
        ("rule 2 a burnt cake on stove B beats everything",
         kitchen_of({"A": lit_stove, "B": {"cake": {"state": "burnt"}, "lit": True}},
                    {"kind": "golden"}), "stoveB"),
        ("rule 3 carrying a golden cake goes to the plate",
         kitchen_of({"A": lit_stove, "B": lit_stove}, {"kind": "golden"}), "plate"),
        ("rule 3 carrying a burnt cake goes to the plate",
         kitchen_of({"A": lit_stove, "B": lit_stove}, {"kind": "burnt"}), "plate"),
        ("rule 4 carrying raw dough goes to a lit empty stove",
         kitchen_of({"A": cold_stove, "B": lit_stove}, {"kind": "raw"}), "stoveB"),
        ("rule 4 with both stoves cold it goes to an empty stove, 冷灶放饼 (§4.3.6)",
         kitchen_of({"A": cold_stove, "B": cold_stove}, {"kind": "raw"}), "stoveA"),
        ("rule 4 with an empty wood pile it still goes to an empty stove",
         kitchen_of({"A": cold_stove, "B": cold_stove}, {"kind": "raw"}, wood=0),
         "stoveA"),
        ("rule 4 with stove A taken it goes to stove B even when B is cold",
         kitchen_of({"A": baking, "B": cold_stove}, {"kind": "raw"}), "stoveB"),
        ("rule 4 with both stoves busy it falls back to the wood pile",
         kitchen_of({"A": baking, "B": baking}, {"kind": "raw"}), "wood"),
        ("rule 5 a board already working a cake goes to the board",
         kitchen_of({"A": lit_stove, "B": lit_stove}, None, {"active": True}), "board"),
        ("rule 6 carrying a filling bowl goes to the board",
         kitchen_of({"A": lit_stove, "B": lit_stove}, {"kind": "bowl"}), "board"),
        ("rule 7 carrying wood goes to an unlit stove",
         kitchen_of({"A": cold_stove, "B": lit_stove}, {"kind": "wood"}), "stoveA"),
        ("rule 7 with both stoves lit it goes to the ingredient rack",
         kitchen_of({"A": lit_stove, "B": lit_stove}, {"kind": "wood"}), "rack"),
        ("rule 8 both stoves unlit with no cake on a stove starts shaping at the rack",
         kitchen_of({"A": cold_stove, "B": cold_stove}, None), "rack"),
        ("rule 8 both stoves unlit with a cake waiting on stove A goes to the wood pile",
         kitchen_of({"A": cold_cake, "B": cold_stove}, None), "wood"),
        ("rule 8 both stoves unlit with a cake waiting on stove B goes to the wood pile",
         kitchen_of({"A": cold_stove, "B": cold_cake}, None), "wood"),
        ("rule 8 both stoves unlit with an empty pile goes to the rack",
         kitchen_of({"A": cold_stove, "B": cold_stove}, None, wood=0), "rack"),
        ("rule 8 a cake waiting on a cold stove with an empty pile goes to the rack",
         kitchen_of({"A": cold_cake, "B": cold_stove}, None, wood=0), "rack"),
        ("rule 9 the order still needing a cake goes to the rack",
         kitchen_of({"A": lit_stove, "B": lit_stove}, None), "rack"),
        ("rule 10 with nothing left to take it waits on the baking stove",
         kitchen_of({"A": baking, "B": lit_stove}, None, rackWork=False), "stoveA"),
        ("rule 10 with nothing left to take it waits on stove B",
         kitchen_of({"A": lit_stove, "B": baking}, None, rackWork=False), "stoveB"),
        ("rule 11 the fallback is the ingredient rack",
         kitchen_of({"A": lit_stove, "B": lit_stove}, None, rackWork=False), "rack"),
    ]
    for label, state, want in rules:
        got = call(page, "nextGuide", state)
        check(f"§4.10.2 {label} → {want}", got == want, f"got {got}")
    check("§4.10.2 the resolver is deterministic for one kitchen state",
          call(page, "nextGuide", kitchen) == call(page, "nextGuide", kitchen))
    check("§4.10.2 nextGuide rejects a state without stove readings",
          raises(page, "nextGuide", None) and raises(page, "nextGuide", {"stoves": {}}))
    check("§4.10.2 nextGuide rejects a state without the wood pile and rack work",
          raises(page, "nextGuide", {"stoves": {"A": cold_stove, "B": cold_stove}}))


# --------------------------------------------------------------------- §7.3 bonus
def test_prefer_bonus(page):
    prefs = {"grandma": "dousha", "father": "wuren", "mother": "lianrong",
             "younger": "xiandanhuang", "brother": "guihua"}
    for member, filling in prefs.items():
        check(f"§7.3 {member} hit ∧ grade 3 → +12",
              call(page, "preferBonus", filling, member, 3) == 12,
              str(call(page, "preferBonus", filling, member, 3)))
        check(f"§7.3 {member} hit ∧ grade 2 → +8",
              call(page, "preferBonus", filling, member, 2) == 8,
              str(call(page, "preferBonus", filling, member, 2)))
        check(f"§7.3 {member} hit ∧ grade 1 (铜) → +0",
              call(page, "preferBonus", filling, member, 1) == 0,
              str(call(page, "preferBonus", filling, member, 1)))
        miss = "lianrong" if filling != "lianrong" else "dousha"
        check(f"§7.3 {member} miss ∧ grade 3 → +0",
              call(page, "preferBonus", miss, member, 3) == 0,
              str(call(page, "preferBonus", miss, member, 3)))
    check("§7.3 grade 3 overrides grade 2, it does not stack to 20",
          call(page, "preferBonus", "dousha", "grandma", 3) == 12)
    check("§7.3 preferBonus rejects an unknown family member",
          raises(page, "preferBonus", "dousha", "nobody", 3))


# ---------------------------------------------------------------- §6.4 invariants
def buy(item):
    return {"type": "buy", "item": item}


def daizuo(filling):
    return {"type": "daizuo", "filling": filling}


def shishi():
    return {"type": "shishi"}


def beiyan():
    return {"type": "beiyan"}


def buzhi():
    return {"type": "buzhi"}


def xiexin():
    return {"type": "xiexin"}


def shouzuo(filling, batch="normal", P=3.00):
    return {"type": "shouzuo", "filling": filling, "batch": batch, "P": P}


NO_ASSIGN = {"grandma": None, "father": None, "mother": None,
             "younger": None, "brother": None}

# §6.4 I-2: five 代做 cakes, grade fixed 2, so Q = round(10 / 15 × 100) = 67.
PURE_DAIZUO = [
    [buy("putong"), buy("putong"), daizuo("dousha")],
    [buy("putong"), daizuo("dousha"), daizuo("wuren")],
    [buy("putong"), daizuo("dousha"), daizuo("wuren")],
    [], [], [], [],
]

# §6.4 I-4 lower bound: three 豆沙 cakes handed to three members who do not prefer
# 豆沙, 祖母 gets none and no letter is sent, so zero preference hits → H = 59.
H_MIN = [
    [buy("putong"), daizuo("dousha"), daizuo("dousha")],
    [daizuo("dousha")],
    [], [], [], [], [],
]
H_MIN_ASSIGN = {"grandma": None, "father": 0, "mother": 1, "younger": 2,
                "brother": None}

# §6.4 I-4 upper bound: five premium gold cakes, every preference hit, letter sent.
H_MAX = [
    [buy("haoliao"), buy("haoliao"), buy("xiandanhuang")],
    [buy("haoliao"), buy("haoliao"), buy("haoliao")],
    [shouzuo("dousha", "premium", 4.00), shouzuo("wuren", "premium", 4.00),
     buy("putong")],
    [shouzuo("xiandanhuang", "premium", 4.00), xiexin(), buy("putong")],
    [buy("putong"), buy("guihua"), shouzuo("guihua", "premium", 4.00)],
    [shouzuo("lianrong", "premium", 4.00)],
    [],
]
H_MAX_ASSIGN = {"grandma": 0, "father": 1, "mother": 4, "younger": 2, "brother": 3}

# §6.4 I-6: a route that raises Q, then B, then H across the seven days, so a
# decaying meter would show up as a drop between two consecutive days.
DECAY_ROUTE = [
    [buy("putong"), buy("putong"), daizuo("dousha")],
    [buy("putong"), daizuo("dousha"), daizuo("wuren")],
    [buy("putong"), daizuo("dousha"), daizuo("wuren")],
    [xiexin()],
    [beiyan(), beiyan(), beiyan()],
    [beiyan(), buzhi(), buzhi()],
    [buzhi(), buzhi()],
]

# §6.4 I-3: D5–D7 hold 9 slots, and each 桂花 purchase takes one of them.
TIER_NO_GUIHUA = [
    [], [], [], [],
    [beiyan(), beiyan(), beiyan()],
    [beiyan(), buzhi(), buzhi()],
    [buzhi(), buzhi()],
]                                        # 备宴 4 + 布置 4 = 8 slots → B 88
TIER_WINE = [
    [], [], [], [],
    [buy("guihua"), beiyan(), beiyan()],
    [beiyan(), beiyan(), buzhi()],
    [beiyan(), buzhi(), buzhi()],
]                                        # 桂花 1 + 备宴 5 + 布置 3 = 9 → B 90
TIER_FILLING = [
    [], [], [], [],
    [buy("guihua"), beiyan(), beiyan()],
    [beiyan(), beiyan(), buzhi()],
    [shouzuo("guihua", "normal", 3.00), buzhi(), buzhi()],
]                                        # 桂花 1 + 备宴 4 + 布置 3 + 手作 1 = 9 → B 78
TIER_BOTH = [
    [], [], [], [],
    [buy("guihua"), buy("guihua"), beiyan()],
    [beiyan(), beiyan(), beiyan()],
    [beiyan(), buzhi(), buzhi()],
]                                        # 桂花 2 + 备宴 5 + 布置 2 = 9 → B 80


def test_invariants(page):
    meters = call(page, "meters", call(page, "runRoute", PURE_DAIZUO, NO_ASSIGN))
    check("I-2 / V-4 a pure 代做 route's cake meter is exactly 67",
          meters["Q"] == 67, str(meters))

    # I-3, with the slot arithmetic spelled out per tier. §6.4 I-3 lists 88 for the
    # 桂花 ×1-用于桂花馅 tier, but that tier also needs a 手作 slot for the 桂花馅
    # cake, so 备宴 4 + 布置 4 + 桂花 1 + 手作 1 = 10 > the 9 slots D5–D7 hold; the
    # reachable ceiling is 备宴 4 + 布置 3 = 78. Recorded as a fixture correction.
    for label, days, want in (("桂花 ×0", TIER_NO_GUIHUA, 88),
                              ("桂花 ×1 用于桂花酒", TIER_WINE, 90),
                              ("桂花 ×1 用于桂花馅", TIER_FILLING, 78),
                              ("桂花 ×2 馅 + 酒", TIER_BOTH, 80)):
        got = call(page, "meters", call(page, "runRoute", days, NO_ASSIGN))["B"]
        check(f"I-3 / V-24 banquet ceiling {label} = {want}", got == want, f"got {got}")

    h_min = call(page, "meters", call(page, "applyAssignment",
                                      call(page, "runRoute", H_MIN, NO_ASSIGN),
                                      H_MIN_ASSIGN))["H"]
    h_max = call(page, "meters", call(page, "applyAssignment",
                                      call(page, "runRoute", H_MAX, NO_ASSIGN),
                                      H_MAX_ASSIGN))["H"]
    check("I-4 / V-6 the lower heart bound is 59", h_min == 59, str(h_min))
    check("I-4 / V-6 the upper heart bound is 86", h_max == 86, str(h_max))
    check("I-4 the heart range is exactly [59, 86]", 59 <= h_min <= h_max <= 86)

    for label, state in (("empty seven days", call(page, "runRoute", [[]] * 7, None)),
                         ("upper bound route", call(page, "applyAssignment",
                                                    call(page, "runRoute", H_MAX,
                                                         NO_ASSIGN), H_MAX_ASSIGN)),
                         ("pure 代做 route", call(page, "runRoute", PURE_DAIZUO,
                                                  NO_ASSIGN))):
        preds = [call(page, p, state) for p in
                 ("isE1", "isE2", "isE3", "isE4", "isE5")]
        check(f"I-5 / V-7 exactly one ending predicate is true ({label})",
              sum(bool(x) for x in preds) == 1, str(preds))
        check(f"I-5 ending() agrees with the one true predicate ({label})",
              call(page, "ending", state) == "E" + str(preds.index(True) + 1),
              str(call(page, "ending", state)))

    # I-6: no meter may decay day over day.
    decay = []
    state = call(page, "initialState")
    previous = call(page, "meters", state)
    for day in DECAY_ROUTE:
        state = call(page, "applyDay", state, day)
        current = call(page, "meters", state)
        decay += [k for k in ("Q", "B", "H") if current[k] < previous[k]]
        previous = current
    check("I-6 / V-9 no meter decays day over day", decay == [], str(decay))

    # I-1: the three meters stay readable and nothing zeroes into a loss.
    empty = call(page, "meters", call(page, "runRoute", [[]] * 7, None))
    check("I-1 / V-8 the three meters stay defined on a route that does nothing",
          set(empty) == {"Q", "B", "H", "A"}, str(empty))
    check("I-1 / V-8 doing nothing still lands on an ending, never a loss state",
          call(page, "ending", call(page, "runRoute", [[]] * 7, None)) == "E5",
          str(call(page, "ending", call(page, "runRoute", [[]] * 7, None))))

    gate = [("premium", 4.00, 3), ("premium", 3.60, 3), ("premium", 3.59, 2),
            ("premium", 2.40, 2), ("premium", 2.39, 1),
            ("normal", 4.00, 2), ("normal", 3.60, 2), ("normal", 2.40, 2),
            ("normal", 2.39, 1), ("normal", 0.00, 1)]
    check("I-7 / V-22 金 = 好料批次 ∧ P ≥ 3.60, and 普通 never reaches 金",
          [call(page, "gradeOf", b, p) for b, p, _ in gate] == [g for _, _, g in gate],
          str([call(page, "gradeOf", b, p) for b, p, _ in gate]))

    haoliao_route = [
        [buy("haoliao"), buy("haoliao"), buy("putong")],
        [],
        [shouzuo("dousha", "premium", 4.00), shouzuo("wuren", "premium", 4.00)],
        [], [], [], [],
    ]
    gold = call(page, "runRoute", haoliao_route, NO_ASSIGN)
    golds = sum(1 for c in gold["cakes"] if c["grade"] == 3)
    check("I-8 / V-23 金饼数 ≤ min(5, ⌊好料 / 2⌋) with 好料 4",
          golds <= min(5, 4 // 2) and golds == 2, f"golds {golds}")
    check("I-8 好料 4 funds exactly two 金饼, the third is refused",
          raises(page, "runRoute",
                 [[buy("haoliao"), buy("haoliao"), buy("putong")], [],
                  [shouzuo("dousha", "premium", 4.00),
                   shouzuo("wuren", "premium", 4.00),
                   shouzuo("lianrong", "premium", 4.00)], [], [], [], []],
                 NO_ASSIGN))
    check("I-8 好料 is only available D1–D3 (G2)",
          raises(page, "applyDay", call(page, "applyDay",
                                        call(page, "applyDay",
                                             call(page, "applyDay",
                                                  call(page, "initialState"), []),
                                             []), []), [buy("haoliao")]))

    ambience = call(page, "initialState")
    for _ in range(5):
        ambience = call(page, "applyDay", ambience, [])          # idle to D6
    ambience = call(page, "applyDay", ambience, [buzhi(), buzhi(), buzhi()])
    check("I-9 / V-25 布置 caps at 4 effective uses, ambience clamps at 40",
          call(page, "applyDay", ambience, [buzhi()])["ambience"] == 40,
          str(ambience["ambience"]))
    check("I-9 the fifth 布置 is rejected",
          raises(page, "applyDay", call(page, "applyDay", ambience, [buzhi()]),
                 [buzhi()]))

    patterns = call(page, "applyDay", call(page, "applyDay",
                                           call(page, "initialState"), []),
                    [shishi(), shishi(), shishi()])
    check("I-10 / V-26 试新方 caps at 3 patterns", patterns["patterns"] == 3,
          str(patterns["patterns"]))
    check("I-10 the fourth 试新方 is rejected", raises(page, "applyDay", patterns,
                                                     [shishi()]))
    check("I-10 / §4.3.12 the pattern cap is the half-width cap's only input",
          near(call(page, "heatHalfWidth", patterns["patterns"]), HALF_WIDTH[3]))


# ------------------------------------------------------------- Macro preserved
def test_macro_preserved(page):
    check("§4.4.1 gradeOf keeps the double gate verbatim",
          call(page, "gradeOf", "premium", 3.60) == 3
          and call(page, "gradeOf", "normal", 4.00) == 2
          and call(page, "gradeOf", "premium", 0.40) == 1)
    check("§4.3.2 precision keeps clamp(1 − d / tol, 0, 1) verbatim",
          near(call(page, "precision", 0.04, 0.10), 0.6)
          and near(call(page, "precision", 0.09, 0.10), 0.1)
          and near(call(page, "precision", 0.12, 0.10), 0.0))

    state = call(page, "runRoute", PURE_DAIZUO, NO_ASSIGN)
    meters = call(page, "meters", state)
    check("§6.1 meters reads Q / B / H / A", set(meters) == {"Q", "B", "H", "A"},
          str(meters))
    check("§6.1 Q = round(Σ品级 / 15 × 100)",
          meters["Q"] == round(sum(c["grade"] for c in state["cakes"]) / 15 * 100),
          str(meters["Q"]))
    check("§6.1 B = 宴席项 × 12 + 氛围", meters["B"] == state["banquet"] * 12
          + state["ambience"], str(meters["B"]))
    check("§6.1 A counts only attending family", meters["A"] == 4, str(meters["A"]))

    check("§6.3.1 ending() returns one of E1..E5",
          call(page, "ending", call(page, "runRoute", H_MAX, NO_ASSIGN))
          in {"E1", "E2", "E3", "E4", "E5"})
    check("§6.3.1 the upper bound route lands on E3",
          call(page, "ending", call(page, "applyAssignment",
                                    call(page, "runRoute", H_MAX, NO_ASSIGN),
                                    H_MAX_ASSIGN)) == "E3",
          str(call(page, "ending", call(page, "applyAssignment",
                                        call(page, "runRoute", H_MAX, NO_ASSIGN),
                                        H_MAX_ASSIGN))))

    day = call(page, "applyDay", call(page, "initialState"),
               [buy("putong"), buy("putong"), daizuo("dousha")])
    check("§3.7 applyDay advances the day and resets the slot counter",
          day["day"] == 2 and day["slotsUsed"] == 0, str(day["day"]))
    check("§3.7 applyDay commits this day's cakes",
          len(day["cakes"]) == 1 and day["cakes"][0]["grade"] == 2, str(day["cakes"]))
    check("§3.7 applyDay deducts materials once",
          day["stock"]["putong"] == 4 + 4 - 2, str(day["stock"]))
    check("§3.1 the fourth action of a day is rejected",
          raises(page, "applyDay", call(page, "initialState"), [buy("putong")] * 4))
    check("§3.1 applyDay rejects a fifth cake",
          raises(page, "runRoute",
                 [[buy("putong")] * 2] * 3
                 + [[shouzuo("dousha")] * 3, [shouzuo("dousha")] * 3, [], []],
                 NO_ASSIGN))
    check("§6.5 runRoute needs exactly seven day arrays",
          raises(page, "runRoute", [[]] * 6, NO_ASSIGN))
    check("§6.5 runRoute reaches D8 after the seven days",
          call(page, "runRoute", [[]] * 7, NO_ASSIGN)["day"] == 8)
    check("§7.3 applyAssignment grants the preference bonus once",
          call(page, "applyAssignment",
               call(page, "applyAssignment",
                    call(page, "runRoute", H_MIN, NO_ASSIGN), H_MIN_ASSIGN),
               H_MIN_ASSIGN)["family"]
          == call(page, "applyAssignment",
                  call(page, "runRoute", H_MIN, NO_ASSIGN), H_MIN_ASSIGN)["family"])


SOURCE_TESTS = (test_retired_symbols, test_grade_precision_verbatim)
PAGE_TESTS = (test_order_loop, test_order_serving, test_three_tap_prep,
              test_heat_and_burning, test_zero_failure, test_fuel,
              test_craftsim_contract, test_chef_and_guide, test_prefer_bonus,
              test_invariants, test_macro_preserved)


def main():
    for fn in SOURCE_TESTS:
        fn()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(INDEX.as_uri())
        page.wait_for_timeout(500)
        if not page.evaluate("!!(window.YueYan && window.YueYan.Engine)"):
            print("FAIL: window.YueYan.Engine missing")
            browser.close()
            return 1
        for fn in PAGE_TESTS:
            try:
                fn(page)
            except EngineError as exc:
                check(f"{fn.__name__} aborted", False, str(exc))
        check("no pageerror", not errors, "; ".join(errors))
        browser.close()
    for line in FAIL:
        print("FAIL " + line)
    print(f"yueyan craft: {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
