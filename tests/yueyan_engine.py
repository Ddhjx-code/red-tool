#!/usr/bin/env python3
"""月宴 engine assertions: V-4..V-12, V-14, V-22..V-29 (spec §11).

Headless only. Drives window.YueYan.Engine directly, never the DOM.
Numbers are transcribed from docs/specs/2026-09-09-yueyan-design.md §6.5.
Per §14.2: if an assertion fails, fix the engine or record the spec table
correction. Never edit this file to match a wrong engine.

Fixture corrections versus docs/superpowers/plans/2026-09-09-yueyan-implementation.md
are recorded in tools/yueyan/DESIGN.md under "Spec deltas" (delta 5), each with
the arithmetic that forced the change:

  HMAX         D5/D6 putong buy had to precede the D5 桂花 craft.
  TIER_FILLING 备宴 4 + 布置 4 + 桂花 1 + 手作 1 = 10 > 9 slots, so the
               "桂花 ×1 用于桂花馅" ceiling is 78, not the 88 of §6.4 I-3.
  TIER_BOTH    备宴 count corrected to 5 (was 6, above the wine cap).
  V-10         D4 shortened to 2 crafts; 3 + 3 would trip the cake cap.
  V-25 / V-26  idle-forwarded to D6 / D2 before 布置 / 试新方, which are
               gated by the §3.5 unlock windows.
  G2           rejection probed at D4, not D2 (好料 is legal D1-D3).
  silver       drained by the SILVER_DRAIN route so silver, not the slot
               budget, is the binding constraint.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

INDEX = pathlib.Path(__file__).resolve().parent.parent / "tools/yueyan/index.html"

PASS = []
FAIL = []


class EngineError(Exception):
    """Raised when an engine hook throws, so RED reads as assertion failure."""


def buy(item):
    return {"type": "buy", "item": item}


def shishi():
    return {"type": "shishi"}


def daizuo(filling):
    return {"type": "daizuo", "filling": filling}


def shouzuo(filling, batch="normal", P=3.00):
    return {"type": "shouzuo", "filling": filling, "batch": batch, "P": P}


def xiexin():
    return {"type": "xiexin"}


def beiyan():
    return {"type": "beiyan"}


def buzhi():
    return {"type": "buzhi"}


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
    else:
        FAIL.append(f"{name} :: {detail}")


def raises(page, fn, *args):
    """True when the hook throws for a real domain reason.

    A stub's 'not implemented' throw is not a domain rejection, so the red
    baseline stays red instead of passing for the wrong reason.
    """
    msg = page.evaluate(
        """([fn, args]) => {
             try { window.YueYan.Engine[fn].apply(null, args); return null; }
             catch (e) { return String(e && e.message ? e.message : e); }
           }""",
        [fn, list(args)],
    )
    if msg is None:
        return False
    return "not implemented" not in msg


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


# --- §6.5.2 R1 -> E1 ---
R1 = [
    [buy("haoliao"), buy("haoliao"), buy("putong")],
    [buy("haoliao"), buy("haoliao"), buy("putong")],
    [buy("putong"), shouzuo("dousha", "premium", 4.00), shouzuo("wuren", "premium", 4.00)],
    [shouzuo("lianrong", "premium", 4.00), shouzuo("dousha", "normal", 3.00), xiexin()],
    [buy("guihua"), beiyan(), beiyan()],
    [beiyan(), beiyan(), buzhi()],
    [shouzuo("guihua", "premium", 4.00), buzhi(), buzhi()],
]
R1_ASSIGN = {"grandma": 0, "father": 1, "mother": 2, "younger": 3, "brother": 4}

# --- §6.5.3 R2 -> E2 ---
R2 = [
    [buy("putong"), buy("putong"), buy("putong")],
    [daizuo("dousha"), daizuo("wuren"), daizuo("lianrong")],
    [daizuo("dousha"), daizuo("dousha")],
    [xiexin()],
    [beiyan(), beiyan(), beiyan()],
    [beiyan(), buzhi(), buzhi()],
    [buzhi(), buzhi()],
]
R2_ASSIGN = {"grandma": 0, "father": 1, "mother": 2, "younger": 3, "brother": 4}

# --- §6.5.4 R3 -> E3 ---
# 咸蛋黄 ordered D1, arrives at the D3 settlement (§3.7 step 2), used D4.
R3 = [
    [buy("haoliao"), buy("putong"), buy("xiandanhuang")],
    [buy("haoliao"), buy("putong"), buy("putong")],
    [shouzuo("dousha", "premium", 4.00), shouzuo("wuren", "premium", 4.00)],
    [shouzuo("xiandanhuang", "normal", 3.00), xiexin()],
    [buy("guihua"), beiyan(), beiyan()],
    [shouzuo("guihua", "normal", 3.00), buzhi()],
    [shouzuo("lianrong", "normal", 3.00), buzhi()],
]
R3_ASSIGN = {"grandma": 0, "father": 1, "mother": 4, "younger": 2, "brother": 3}

# --- §6.5.5 R4 -> E4 ---
R4 = [
    [buy("putong"), buy("putong"), buy("putong")],
    [daizuo("dousha"), daizuo("wuren"), daizuo("lianrong")],
    [daizuo("dousha"), daizuo("dousha")],
    [],
    [beiyan()],
    [buzhi()],
    [],
]
R4_ASSIGN = {"grandma": 0, "father": 1, "mother": 2, "younger": 3, "brother": 4}

# --- §6.5.6 R5 -> E5 ---
# Three 豆沙 cakes deliberately handed to the three family members who do not
# prefer 豆沙; grandma gets no cake, so zero preference hits.
R5 = [
    [buy("putong"), daizuo("dousha"), daizuo("dousha")],
    [daizuo("dousha")],
    [], [], [], [], [],
]
R5_ASSIGN = {"grandma": None, "father": 0, "mother": 1, "younger": 2, "brother": None}

# --- §6.4 I-4 lower bound: H = 59, produced by R5 itself ---

# --- §6.4 I-4 upper bound: H = 86 ---
# Five premium gold cakes, one per family, every preference hit, letter sent.
# Slot budget 16 <= 21; silver 26 <= 44; stock peak <= 24.
# The D5 putong buy precedes the D5 桂花 craft: D3/D4 each drain putong to 0,
# so a craft on D5 without a buy in the same day is impossible.
HMAX = [
    [buy("haoliao"), buy("haoliao"), buy("xiandanhuang")],
    [buy("haoliao"), buy("haoliao"), buy("haoliao")],
    [shouzuo("dousha", "premium", 4.00), shouzuo("wuren", "premium", 4.00), buy("putong")],
    [shouzuo("xiandanhuang", "premium", 4.00), xiexin(), buy("putong")],
    [buy("putong"), buy("guihua"), shouzuo("guihua", "premium", 4.00)],
    [shouzuo("lianrong", "premium", 4.00)],
    [],
]
HMAX_ASSIGN = {"grandma": 0, "father": 1, "mother": 4, "younger": 2, "brother": 3}

# --- §3.2.2 four banquet tiers (V-5) ---
# D5..D7 hold 9 slots total. Each 桂花 purchase takes one of them.
TIER_NO_GUIHUA = [
    [], [], [], [],
    [beiyan(), beiyan(), beiyan()],
    [beiyan(), buzhi(), buzhi()],
    [buzhi(), buzhi()],
]                                                    # 备宴 4 + 布置 4 = 8 slots -> B 88
TIER_WINE = [
    [], [], [], [],
    [buy("guihua"), beiyan(), beiyan()],
    [beiyan(), beiyan(), buzhi()],
    [beiyan(), buzhi(), buzhi()],
]                                                    # 桂花 1 + 备宴 5 + 布置 3 = 9 -> B 90
# 桂花 used for a 桂花 cake instead of wine: the buy and the craft each take a
# slot, so 备宴 4 + 布置 4 is unreachable inside 9 slots. The real ceiling is
# 备宴 4 + 布置 3 = 78 (DESIGN.md Spec delta 3).
TIER_FILLING = [
    [], [], [], [],
    [buy("guihua"), beiyan(), beiyan()],
    [beiyan(), beiyan(), buzhi()],
    [shouzuo("guihua", "normal", 3.00), buzhi(), buzhi()],
]                                                    # 桂花 1 + 备宴 4 + 布置 3 + 手作 1 = 9 -> B 78
TIER_BOTH = [
    [], [], [], [],
    [buy("guihua"), buy("guihua"), beiyan()],
    [beiyan(), beiyan(), beiyan()],
    [beiyan(), buzhi(), buzhi()],
]                                                    # 桂花 2 + 备宴 5 + 布置 2 = 9 -> B 80
TIER_ASSIGN = {"grandma": None, "father": None, "mother": None,
               "younger": None, "brother": None}

# --- silver exhaustion fixture ---
# Daily spend 6, 5, 9, 7, 6, 6, 5 = 44, so silver is 5 entering D7 and the
# route drains the purse to 0. On D7 two 普通料 buys cost 4 <= 5 and pass; three
# cost 6 > 5, so the third is refused by silver. Slots (<= 3) and the stock cap
# (2 + 6 <= 24) never bind, which the positive control below pins down.
SILVER_DRAIN = [
    [buy("putong"), buy("putong"), buy("putong")],
    [buy("putong"), buy("putong"), shishi()],
    [daizuo("dousha"), daizuo("dousha"), daizuo("dousha")],
    [daizuo("dousha"), daizuo("dousha"), shishi()],
    [beiyan(), beiyan(), beiyan()],
    [beiyan(), buzhi(), buzhi()],
    [buzhi(), buzhi(), shishi()],
]


ROUTES = [
    ("R1", R1, R1_ASSIGN, {"Q": 93, "B": 78, "H": 84, "A": 5}, "E1", 35),
    ("R2", R2, R2_ASSIGN, {"Q": 67, "B": 88, "H": 79, "A": 5}, "E2", 38),
    ("R3", R3, R3_ASSIGN, {"Q": 80, "B": 44, "H": 84, "A": 5}, "E3", 25),
    ("R4", R4, R4_ASSIGN, {"Q": 67, "B": 22, "H": 64, "A": 4}, "E4", 25),
    ("R5", R5, R5_ASSIGN, {"Q": 40, "B": 0, "H": 59, "A": 4}, "E5", 11),
]


def test_v29(page):
    for name, days, assign, want, ending, silver_used in ROUTES:
        st = call(page, "runRoute", days, assign)
        m = call(page, "meters", st)
        got = call(page, "ending", st)
        for k, v in want.items():
            check(f"V-29 {name} {k}", m[k] == v, f"want {v} got {m[k]}")
        check(f"V-29 {name} ending", got == ending, f"want {ending} got {got}")
        check(f"V-29 {name} silver", 44 - st["silver"] == silver_used,
              f"want spent {silver_used} got {44 - st['silver']}")
        check(f"V-29 {name} slots", st["slotsUsed"] == 0 and st["day"] == 8,
              f"day {st['day']} slotsUsed {st['slotsUsed']}")


def test_v4(page):
    for name in ("R2", "R4"):
        days, assign = (R2, R2_ASSIGN) if name == "R2" else (R4, R4_ASSIGN)
        m = call(page, "meters", call(page, "runRoute", days, assign))
        check(f"V-4 pure-daizuo {name} Q", m["Q"] == 67, f"got {m['Q']}")


def test_v5(page):
    tiers = [("guihua x0", TIER_NO_GUIHUA, 88),
             ("guihua x1 wine", TIER_WINE, 90),
             ("guihua x1 filling", TIER_FILLING, 78),
             ("guihua x2 both", TIER_BOTH, 80)]
    for label, days, want in tiers:
        st = call(page, "runRoute", days, TIER_ASSIGN)
        m = call(page, "meters", st)
        check(f"V-5 {label} B", m["B"] == want, f"want {want} got {m['B']}")


def test_v6(page):
    lo = call(page, "meters", call(page, "runRoute", R5, R5_ASSIGN))["H"]
    hi = call(page, "meters", call(page, "runRoute", HMAX, HMAX_ASSIGN))["H"]
    check("V-6 lower bound", lo == 59, f"got {lo}")
    check("V-6 upper bound", hi == 86, f"got {hi}")
    check("V-6 HMAX is legal", hi <= 86, f"got {hi}")


def battery(page):
    states = []
    for _, days, assign, _, _, _ in ROUTES:
        states.append(call(page, "runRoute", days, assign))
    states.append(call(page, "runRoute", HMAX, HMAX_ASSIGN))
    for days in (TIER_NO_GUIHUA, TIER_WINE, TIER_FILLING, TIER_BOTH):
        states.append(call(page, "runRoute", days, TIER_ASSIGN))
    states.append(call(page, "initialState"))                      # nothing done at all
    empty = call(page, "runRoute", [[], [], [], [], [], [], []], TIER_ASSIGN)
    states.append(empty)                                           # seven idle days
    return states


def test_v7_v8(page):
    for i, st in enumerate(battery(page)):
        flags = [call(page, f"isE{k}", st) for k in range(1, 6)]
        check(f"V-7 state{i} exactly one", sum(bool(f) for f in flags) == 1,
              f"flags {flags}")
        e = call(page, "ending", st)
        check(f"V-8 state{i} has ending", e in ("E1", "E2", "E3", "E4", "E5"),
              f"got {e!r}")
    # §10.3.2: no parallel meter hooks
    surface = page.evaluate("Object.keys(window.YueYan.Engine)")
    banned = {"attendance", "cakeQuality", "banquetScore", "heartScore"}
    check("V-7 no parallel hooks", not (banned & set(surface)),
          f"found {sorted(banned & set(surface))}")
    required = {"initialState", "applyDay", "runRoute", "meters", "ending",
                "isE1", "isE2", "isE3", "isE4", "isE5", "gradeOf"}
    check("V-7 hook surface complete", required <= set(surface),
          f"missing {sorted(required - set(surface))}")


def test_v9(page):
    st = call(page, "initialState")
    prev = call(page, "meters", st)
    for d in range(7):
        st = call(page, "applyDay", st, R1[d])
        cur = call(page, "meters", st)
        for k in ("Q", "B", "H"):
            check(f"V-9 D{d + 1} {k} non-decreasing", cur[k] >= prev[k],
                  f"{prev[k]} -> {cur[k]}")
        prev = cur


def test_v10(page):
    days = [[buy("putong")] * 3] * 2 + [
        [shouzuo("dousha", "normal", 3.00)] * 3,
        [shouzuo("dousha", "normal", 3.00)] * 2,   # 3 + 2 = 5, the hard cap
        [], [], [],
    ]
    st = call(page, "runRoute", days, TIER_ASSIGN)
    check("V-10 cakes <= 5", len(st["cakes"]) == 5, f"got {len(st['cakes'])}")
    over = [[buy("putong")] * 3] * 2 + [
        [shouzuo("dousha", "normal", 3.00)] * 3,
        [shouzuo("dousha", "normal", 3.00)] * 3,
        [shouzuo("dousha", "normal", 3.00)],
        [], [],
    ]
    check("V-10 sixth cake rejected", raises(page, "runRoute", over, TIER_ASSIGN))


def test_v11(page):
    st = call(page, "initialState")
    for d in range(3):
        st = call(page, "applyDay", st, [buy("putong")] * 3)
    total = sum(st["stock"].values())
    check("V-11 stock <= 24", total <= 24, f"got {total}")
    over = [[buy("putong")] * 3] * 4
    check("V-11 buy past cap rejected", raises(page, "applyDay", st, over[0]))


def test_v12(page):
    st = call(page, "initialState")
    check("V-12 fourth action rejected",
          raises(page, "applyDay", st, [buy("putong")] * 4))
    st = call(page, "applyDay", st, [buy("putong")] * 3)
    check("V-12 slotsUsed reset", st["slotsUsed"] == 0, f"got {st['slotsUsed']}")


def test_v14_v22(page):
    gate = [("premium", 4.00, 3), ("premium", 3.60, 3), ("premium", 3.59, 2),
            ("premium", 2.40, 2), ("premium", 2.39, 1),
            ("normal", 4.00, 2), ("normal", 3.60, 2), ("normal", 2.40, 2),
            ("normal", 2.39, 1), ("normal", 0.00, 1)]
    for batch, P, want in gate:
        got = call(page, "gradeOf", batch, P)
        check(f"V-22 gradeOf({batch}, {P})", got == want, f"got {got}")
    check("V-14 floor is grade 1", call(page, "gradeOf", "normal", 0.00) == 1)
    check("V-14 no scrap branch",
          all(call(page, "gradeOf", b, 0.00) == 1 for b in ("normal", "premium")))


def _haoliao_route(page, P):
    days = [
        [buy("haoliao"), buy("haoliao"), buy("putong")],
        [],
        [shouzuo("dousha", "premium", P)],
        [], [], [], [],
    ]
    return call(page, "runRoute", days, TIER_ASSIGN)


def test_v23(page):
    st = _haoliao_route(page, 4.00)
    gold = sum(1 for c in st["cakes"] if c["grade"] == 3)
    # I-8: _haoliao_route buys 好料 twice = 4 units acquired, so the gold ceiling
    # is min(5, floor(4 / 2)) = 2. The remaining 好料 is 4 - 2 consumed = 2.
    check("V-23 gold <= min(5, floor(haoliao/2))", gold <= min(5, 4 // 2),
          f"gold {gold}, bound {min(5, 4 // 2)}")
    check("V-23 premium consumed 2 haoliao", st["stock"]["haoliao"] == 2,
          f"got {st['stock']['haoliao']}")
    st4 = call(page, "initialState")
    for _ in range(3):                                    # idle to D4
        st4 = call(page, "applyDay", st4, [])
    check("V-23 D4 reached", st4["day"] == 4, f"got {st4['day']}")
    check("V-23 haoliao locked from D4", raises(page, "applyDay", st4, [buy("haoliao")]))


def test_v27(page):
    low = _haoliao_route(page, 3.00)                     # premium batch, P < 3.60
    check("V-27 sunk haoliao not refunded", low["stock"]["haoliao"] == 2,
          f"got {low['stock']['haoliao']}")
    check("V-27 cake still produced", len(low["cakes"]) == 1,
          f"got {len(low['cakes'])}")
    check("V-27 low premium is grade 2", low["cakes"][0]["grade"] == 2,
          f"got {low['cakes'][0]['grade']}")


def test_v28(page):
    st = call(page, "initialState")
    st = call(page, "applyDay", st, [buy("haoliao"), buy("putong")])   # -> D2
    st = call(page, "applyDay", st, [])                                # -> D3, shouzuo unlocked
    before = dict(st["stock"])
    started = call(page, "beginCraft", st, {"filling": "dousha", "batch": "premium"})
    check("V-28 beginCraft deducts",
          started["stock"]["putong"] == before["putong"] - 2
          and started["stock"]["haoliao"] == before["haoliao"] - 2,
          f"before {before} after {started['stock']}")
    done = call(page, "finishCraft", started, 1.00)
    check("V-28 low score does not refund", done["stock"] == started["stock"],
          f"started {started['stock']} done {done['stock']}")
    aborted = call(page, "abortCraft", started)
    check("V-28 abort refunds in full", aborted["stock"] == before,
          f"want {before} got {aborted['stock']}")
    check("V-28 abort leaves no half cake", len(aborted["cakes"]) == 0,
          f"got {len(aborted['cakes'])}")


def test_v24(page):
    st = call(page, "initialState")
    for d in range(5):                                    # idle D1-D4, then D5
        st = call(page, "applyDay", st, TIER_NO_GUIHUA[d])
    st = call(page, "applyDay", st, TIER_NO_GUIHUA[5])    # D6 -> banquet 4
    check("V-24 cap 4 without guihua", st["banquet"] == 4, f"got {st['banquet']}")
    check("V-24 guihuaWine false", st["flags"]["guihuaWine"] is False)
    check("V-24 fifth beiyan rejected without guihua",
          raises(page, "applyDay", st, [beiyan()]))
    wine = call(page, "runRoute", TIER_WINE, TIER_ASSIGN)
    check("V-24 cap 5 with wine", wine["banquet"] == 5, f"got {wine['banquet']}")
    check("V-24 guihuaWine true", wine["flags"]["guihuaWine"] is True)
    check("V-24 wine consumed guihua", wine["stock"]["guihua"] == 0,
          f"got {wine['stock']['guihua']}")


def test_v25(page):
    st = call(page, "initialState")
    for _ in range(5):                                    # idle to D6 (§3.5 unlock)
        st = call(page, "applyDay", st, [])
    st = call(page, "applyDay", st, [buzhi(), buzhi(), buzhi()])   # D6 -> ambience 30
    silver = st["silver"]
    check("V-25 fifth buzhi rejected at cap",
          raises(page, "applyDay", st, [buzhi(), buzhi()]))
    check("V-25 rejected day costs nothing", st["silver"] == silver,
          f"{silver} -> {st['silver']}")
    st = call(page, "applyDay", st, [buzhi()])            # D7 -> ambience 40
    check("V-25 ambience caps at 40", st["ambience"] == 40, f"got {st['ambience']}")
    check("V-25 buzhi before D6 rejected",
          raises(page, "applyDay", call(page, "initialState"), [buzhi()]))


def test_v26(page):
    st = call(page, "initialState")
    st = call(page, "applyDay", st, [])                   # idle to D2 (§3.5 unlock)
    st = call(page, "applyDay", st, [shishi(), shishi(), shishi()])
    check("V-26 patterns cap 3", st["patterns"] == 3, f"got {st['patterns']}")
    silver, putong = st["silver"], st["stock"]["putong"]
    check("V-26 fourth shishi rejected", raises(page, "applyDay", st, [shishi()]))
    check("V-26 fourth shishi costs nothing",
          st["silver"] == silver and st["stock"]["putong"] == putong,
          f"silver {silver} -> {st['silver']}, putong {putong} -> {st['stock']['putong']}")
    check("V-26 tol widens with patterns",
          abs(call(page, "tolOf", 3, "s3") - 0.19) < 1e-9,
          f"got {call(page, 'tolOf', 3, 's3')}")
    check("V-26 tol base 0.10", abs(call(page, "tolOf", 0, "s3") - 0.10) < 1e-9,
          f"got {call(page, 'tolOf', 0, 's3')}")


def test_windows(page):
    st = call(page, "initialState")
    d4 = st
    for _ in range(3):                                    # idle to D4
        d4 = call(page, "applyDay", d4, [])
    check("G2 D4 reached", d4["day"] == 4, f"got {d4['day']}")
    check("G2 haoliao outside D1-D3 rejected",
          raises(page, "applyDay", d4, [buy("haoliao")]))
    d5 = st
    for _ in range(4):
        d5 = call(page, "applyDay", d5, [])
    check("G1 xiandanhuang outside D1-D4 rejected",
          raises(page, "applyDay", d5, [buy("xiandanhuang")]))
    check("G3 guihua before D5 rejected", raises(page, "applyDay", st, [buy("guihua")]))
    check("shouzuo before D3 rejected", raises(page, "applyDay", st, [shouzuo("dousha")]))
    check("beiyan before D5 rejected", raises(page, "applyDay", st, [beiyan()]))
    check("buzhi before D6 rejected", raises(page, "applyDay", st, [buzhi()]))
    check("xiexin before D4 rejected", raises(page, "applyDay", st, [xiexin()]))
    d4b = call(page, "applyDay", st, [])
    d4b = call(page, "applyDay", d4b, [])
    d4b = call(page, "applyDay", d4b, [])
    d4b = call(page, "applyDay", d4b, [xiexin()])
    check("xiexin second time rejected", raises(page, "applyDay", d4b, [xiexin()]))
    drained = st
    for d in range(6):                                    # SILVER_DRAIN D1-D6
        drained = call(page, "applyDay", drained, SILVER_DRAIN[d])
    check("silver is 5 entering D7", drained["silver"] == 5,
          f"got {drained['silver']}")
    two = call(page, "applyDay", drained, [buy("putong")] * 2)
    check("two buys pass on D7", two["silver"] == 1, f"got {two['silver']}")
    check("insufficient silver rejected",
          raises(page, "applyDay", drained, [buy("putong")] * 3))


def seven_days(page, days):
    st = call(page, "initialState")
    for d in range(7):
        st = call(page, "applyDay", st, days[d])
    return st


def test_assignment_idempotent(page):
    for name, days, assign in (("R1", R1, R1_ASSIGN), ("R3", R3, R3_ASSIGN),
                               ("HMAX", HMAX, HMAX_ASSIGN)):
        raw = seven_days(page, days)
        once = call(page, "applyAssignment", raw, assign)
        twice = call(page, "applyAssignment", once, assign)
        check(f"§6.6 {name} family stable", twice["family"] == once["family"],
              f"once {once['family']} twice {twice['family']}")
        check(f"§6.6 {name} meters stable",
              call(page, "meters", twice) == call(page, "meters", once),
              f"once {call(page, 'meters', once)} twice {call(page, 'meters', twice)}")
        check(f"§6.6 {name} ending stable",
              call(page, "ending", twice) == call(page, "ending", once),
              f"once {call(page, 'ending', once)} twice {call(page, 'ending', twice)}")
    check("§10.2 fresh flags holds exactly the three spec fields",
          set(call(page, "initialState")["flags"]) == {"xieXin", "congRong", "guihuaWine"},
          f"got {sorted(call(page, 'initialState')['flags'])}")
    applied = call(page, "applyAssignment", seven_days(page, R1), R1_ASSIGN)
    check("§10.2 applied flags gains no extra field",
          set(applied["flags"]) == {"xieXin", "congRong", "guihuaWine"},
          f"got {sorted(applied['flags'])}")
    zero = seven_days(page, [[] for _ in range(7)])
    z_once = call(page, "applyAssignment", zero, TIER_ASSIGN)
    z_twice = call(page, "applyAssignment", z_once, TIER_ASSIGN)
    check("§6.6 zero-cake family stable", z_twice["family"] == z_once["family"],
          f"once {z_once['family']} twice {z_twice['family']}")
    check("§6.6 zero-cake meters stable",
          call(page, "meters", z_twice) == call(page, "meters", z_once),
          f"once {call(page, 'meters', z_once)} twice {call(page, 'meters', z_twice)}")
    check("§6.6 zero-cake ending stable",
          call(page, "ending", z_twice) == call(page, "ending", z_once),
          f"once {call(page, 'ending', z_once)} twice {call(page, 'ending', z_twice)}")


def test_arrival_day_craft(page):
    """§3.7 step 2: a delivery lands at that day's settlement, never before it."""
    act = shouzuo("xiandanhuang", "normal", 3.00)
    st = call(page, "initialState")
    st = call(page, "applyDay", st, R3[0])                    # D1 orders 咸蛋黄
    st = call(page, "applyDay", st, R3[1])                    # now D3, pre-settlement
    check("arrival day is D3", st["day"] == 3, f"got {st['day']}")
    check("arrival day: stock still empty before the D3 settlement",
          st["stock"]["xiandanhuang"] == 0, f"got {st['stock']['xiandanhuang']}")
    check("arrival day: crafting the undelivered filling is rejected",
          call(page, "actionOk", st, act) is False)
    check("arrival day: the settlement itself refuses it",
          raises(page, "applyDay", st, [act]))
    st4 = call(page, "applyDay", st, R3[2])                   # D3 settles -> egg lands
    check("D4: the delivered filling is in stock",
          st4["stock"]["xiandanhuang"] == 1, f"got {st4['stock']['xiandanhuang']}")
    check("D4: crafting it is allowed", call(page, "actionOk", st4, act) is True)


TESTS = (test_v29, test_v4, test_v5, test_v6, test_v7_v8, test_v9, test_v10,
          test_v11, test_v12, test_v14_v22, test_v23, test_v24, test_v25,
          test_v26, test_v27, test_v28, test_windows, test_assignment_idempotent,
          test_arrival_day_craft)


def main():
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
        for fn in TESTS:
            try:
                fn(page)
            except EngineError as exc:
                check(f"{fn.__name__} aborted", False, str(exc))
        check("no pageerror", not errors, "; ".join(errors))
        browser.close()
    for line in FAIL:
        print("FAIL " + line)
    print(f"yueyan engine: {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
