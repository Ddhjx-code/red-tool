#!/usr/bin/env python3
"""月宴 save/resume assertions: §3.8 boundary contract + §10.2 schema (V-17).

Headless only. Drives window.YueYan.Save against window.YueYan.Engine states,
never the DOM. Per §14.2: if an assertion fails, fix save.js or record the spec
table correction. Never edit this file to match a wrong implementation.

Covered:
  API surface            Save owns storage IO alone (§10.3.1)
  defaults               empty storage -> progress null, meta {version, []}
  round trip             day-boundary canonical state survives byte-for-byte
  schema                 §10.2 field set, incl. batch / P / guihuaWine
  version discard        §3.8 no migration: stale blob is dropped, not converted
  corrupt fallback       unreadable / non-object blobs never throw
  blocked storage        localStorage access throwing never propagates
  craft stripping        `crafting` is transient (Task 6) and never persisted
  day-boundary           saved day is the advanced day with slotsUsed reset
  clone                  read returns independent data, write does not mutate
  assignment guard       idempotency derives from canonical `assignment`; no extra field
  meta                   endingsSeen only, no unlock tree (§7.2 / X-8)
  clear                  drops progress, keeps cross-run meta
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

INDEX = pathlib.Path(__file__).resolve().parent.parent / "tools/yueyan/index.html"

PROGRESS_KEY = "yueyan-progress"
META_KEY = "yueyan-save"

PASS = []
FAIL = []


class SaveError(Exception):
    """Raised when a Save hook throws, so RED reads as assertion failure."""


def buy(item):
    return {"type": "buy", "item": item}


def daizuo(filling):
    return {"type": "daizuo", "filling": filling}


def xiexin():
    return {"type": "xiexin"}


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
    else:
        FAIL.append(f"{name} :: {detail}")


def call(page, ns, fn, *args):
    res = page.evaluate(
        """([ns, fn, args]) => {
             try {
               var mod = window.YueYan[ns];
               if (!mod || typeof mod[fn] !== 'function') {
                 return { ok: false, message: 'hook missing: ' + ns + '.' + fn };
               }
               return { ok: true, value: mod[fn].apply(null, args) };
             } catch (e) {
               return { ok: false,
                        message: String(e && e.message ? e.message : e) };
             }
           }""",
        [ns, fn, list(args)],
    )
    if not res["ok"]:
        raise SaveError(res["message"])
    return res["value"]


def save(page, fn, *args):
    return call(page, "Save", fn, *args)


def engine(page, fn, *args):
    return call(page, "Engine", fn, *args)


def raw_get(page, key):
    return page.evaluate("(k) => localStorage.getItem(k)", key)


def raw_set(page, key, value):
    page.evaluate("([k, v]) => localStorage.setItem(k, v)", [key, value])


def reset(page):
    page.evaluate("() => localStorage.clear()")


def js(page, expr, arg=None):
    return page.evaluate(expr, arg)


# A five-cake route with three preference hits and a letter, so the §7.3 bonus
# is nonzero and the one-shot guard has something to protect.
ROUTE = [
    [buy("putong"), buy("putong"), buy("putong")],
    [daizuo("dousha"), daizuo("wuren"), daizuo("lianrong")],
    [buy("putong"), daizuo("dousha")],
    [daizuo("wuren"), xiexin()],
    [], [], [],
]
ASSIGN = {"grandma": 0, "father": 1, "mother": 2, "younger": 3, "brother": 4}


def seven_days(page, days):
    st = engine(page, "initialState")
    for d in range(7):
        st = engine(page, "applyDay", st, days[d])
    return st


def test_surface(page):
    surface = page.evaluate(
        "() => window.YueYan && window.YueYan.Save ? Object.keys(window.YueYan.Save) : []"
    )
    want = {"writeProgress", "readProgress", "writeMeta", "readMeta", "clear"}
    check("Save hook surface", set(surface) == want,
          f"want {sorted(want)} got {sorted(surface)}")


def test_defaults(page):
    reset(page)
    check("defaults progress is null", save(page, "readProgress") is None,
          f"got {save(page, 'readProgress')!r}")
    meta = save(page, "readMeta")
    check("defaults meta shape", meta == {"version": 1, "endingsSeen": []},
          f"got {meta!r}")
    check("defaults write nothing", raw_get(page, PROGRESS_KEY) is None)


def test_day_boundary(page):
    reset(page)
    st = engine(page, "applyDay", engine(page, "initialState"), [buy("putong")])
    save(page, "writeProgress", st)
    got = save(page, "readProgress")
    check("V-17 boundary day", got["day"] == 2, f"got {got['day']}")
    check("V-17 slotsUsed reset", got["slotsUsed"] == 0, f"got {got['slotsUsed']}")
    check("V-17 silver persisted", got["silver"] == 42, f"got {got['silver']}")
    check("V-17 stock persisted", got["stock"]["putong"] == 6,
          f"got {got['stock']['putong']}")
    check("V-17 version stamped", got["version"] == 1, f"got {got['version']}")
    check("V-17 round trip equals engine state", got == st, f"got {got!r}")
    later = engine(page, "applyDay", st, [])
    save(page, "writeProgress", later)
    check("V-17 rewrite overwrites", save(page, "readProgress")["day"] == 3,
          f"got {save(page, 'readProgress')['day']}")


def test_schema(page):
    reset(page)
    st = engine(page, "applyAssignment", seven_days(page, ROUTE), ASSIGN)
    save(page, "writeProgress", st)
    got = save(page, "readProgress")
    check("§10.2 top-level fields",
          set(got) == {"version", "day", "slotsUsed", "silver", "stock",
                       "cakes", "patterns", "banquet", "ambience",
                       "family", "flags", "assignment"},
          f"got {sorted(got)}")
    check("§10.2 stock fields",
          set(got["stock"]) == {"putong", "haoliao", "xiandanhuang", "guihua"},
          f"got {sorted(got['stock'])}")
    check("§10.2 family fields",
          set(got["family"]) == {"grandma", "father", "mother", "younger", "brother"},
          f"got {sorted(got['family'])}")
    check("§10.2 flags fields",
          set(got["flags"]) == {"xieXin", "congRong", "guihuaWine"},
          f"got {sorted(got['flags'])}")
    check("§10.2 assignment fields",
          set(got["assignment"]) == {"grandma", "father", "mother", "younger", "brother"},
          f"got {sorted(got['assignment'])}")
    check("§10.2 cake fields",
          all({"filling", "grade", "method", "batch", "P"} <= set(c) for c in got["cakes"]),
          f"got {[sorted(c) for c in got['cakes']]}")
    check("§10.2 cakes persisted", len(got["cakes"]) == 5, f"got {len(got['cakes'])}")
    check("§10.2 xieXin persisted", got["flags"]["xieXin"] is True)


def test_craft_stripped(page):
    reset(page)
    base = engine(page, "initialState")
    base["day"] = 3                                          # §3.5 手作 unlocks on D3
    st = engine(page, "beginCraft", base,
                {"filling": "dousha", "batch": "normal"})
    check("fixture has transient marker", "crafting" in st)
    save(page, "writeProgress", st)
    got = save(page, "readProgress")
    check("§3.8 crafting not persisted", "crafting" not in got, f"got {sorted(got)}")
    check("§3.8 blob holds no crafting",
          "crafting" not in (raw_get(page, PROGRESS_KEY) or ""),
          f"got {raw_get(page, PROGRESS_KEY)}")
    check("§3.8 canonical fields survive stripping",
          got["stock"]["putong"] == 2 and got["slotsUsed"] == 1,
          f"putong {got['stock']['putong']} slotsUsed {got['slotsUsed']}")
    check("§3.8 write does not mutate caller state",
          "crafting" in st and st["slotsUsed"] == 1,
          f"caller {sorted(st)}")


def test_version_discard(page):
    reset(page)
    raw_set(page, PROGRESS_KEY, '{"version": 999, "day": 4, "silver": 9}')
    check("§3.8 version mismatch discarded", save(page, "readProgress") is None,
          f"got {save(page, 'readProgress')!r}")
    check("§3.8 stale blob removed", raw_get(page, PROGRESS_KEY) is None,
          f"got {raw_get(page, PROGRESS_KEY)!r}")
    raw_set(page, META_KEY, '{"version": 999, "endingsSeen": ["E1"]}')
    meta = save(page, "readMeta")
    check("§3.8 stale meta falls back to defaults",
          meta == {"version": 1, "endingsSeen": []}, f"got {meta!r}")


def test_corrupt(page):
    reset(page)
    for label, blob in (("truncated", '{"version": 1, "day":'),
                        ("not json", "yueyan"),
                        ("json null", "null"),
                        ("json scalar", "42")):
        raw_set(page, PROGRESS_KEY, blob)
        try:
            got = save(page, "readProgress")
            check(f"corrupt progress {label} -> null", got is None, f"got {got!r}")
        except SaveError as exc:
            check(f"corrupt progress {label} -> null", False, f"threw {exc}")
        raw_set(page, META_KEY, blob)
        try:
            meta = save(page, "readMeta")
            check(f"corrupt meta {label} -> defaults",
                  meta == {"version": 1, "endingsSeen": []}, f"got {meta!r}")
        except SaveError as exc:
            check(f"corrupt meta {label} -> defaults", False, f"threw {exc}")


def test_blocked_storage(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto(INDEX.as_uri())
    page.wait_for_timeout(300)
    page.evaluate(
        """() => {
             Object.defineProperty(window, 'localStorage', {
               configurable: true,
               get() { throw new Error('storage blocked'); }
             });
           }"""
    )
    for fn, args in (("writeProgress", [engine(page, "initialState")]),
                     ("writeMeta", [["E2"]])):
        try:
            save(page, fn, *args)
            check(f"blocked storage {fn} silent", True)
        except SaveError as exc:
            check(f"blocked storage {fn} silent", False, f"threw {exc}")
    for fn in ("readProgress", "readMeta", "clear"):
        try:
            save(page, fn)
            check(f"blocked storage {fn} silent", True)
        except SaveError as exc:
            check(f"blocked storage {fn} silent", False, f"threw {exc}")
    check("blocked storage progress null", save(page, "readProgress") is None)
    check("blocked storage meta defaults",
          save(page, "readMeta") == {"version": 1, "endingsSeen": []},
          f"got {save(page, 'readMeta')!r}")
    page.close()


def test_clone(page):
    reset(page)
    st = engine(page, "applyDay", engine(page, "initialState"), [buy("putong")])
    save(page, "writeProgress", st)
    after = js(
        page,
        """() => {
             const S = window.YueYan.Save;
             const a = S.readProgress();
             a.day = 99;
             a.stock.putong = 999;
             a.flags.xieXin = true;
             const b = S.readProgress();
             return { day: b.day, putong: b.stock.putong, xieXin: b.flags.xieXin };
           }""",
    )
    check("read returns independent data",
          after == {"day": 2, "putong": 6, "xieXin": False}, f"got {after!r}")
    check("mutation does not reach storage",
          save(page, "readProgress")["day"] == 2,
          f"got {save(page, 'readProgress')['day']}")


def test_assignment_guard(page):
    reset(page)
    raw = seven_days(page, ROUTE)
    once = engine(page, "applyAssignment", raw, ASSIGN)
    check("fixture grants the §7.3 bonus", once["family"] != raw["family"],
          f"raw {raw['family']} once {once['family']}")
    save(page, "writeProgress", once)
    restored = save(page, "readProgress")
    check("§10.2 resumed blob carries no extra flags field",
          set(restored["flags"]) == {"xieXin", "congRong", "guihuaWine"},
          f"got {sorted(restored['flags'])}")
    check("§6.6 canonical assignment persisted", restored["assignment"] == once["assignment"],
          f"got {restored['assignment']!r}")
    check("§6.6 resumed blob holds a derivable non-null assignment",
          any(v is not None for v in restored["assignment"].values()),
          f"got {restored['assignment']!r}")
    twice = engine(page, "applyAssignment", restored, ASSIGN)
    check("§6.6 resumed state grants no second bonus",
          twice["family"] == once["family"],
          f"once {once['family']} twice {twice['family']}")
    check("§6.6 resumed meters stable",
          engine(page, "meters", twice) == engine(page, "meters", once),
          f"once {engine(page, 'meters', once)} twice {engine(page, 'meters', twice)}")
    check("§6.6 resumed ending stable",
          engine(page, "ending", twice) == engine(page, "ending", once),
          f"once {engine(page, 'ending', once)} twice {engine(page, 'ending', twice)}")


def test_meta(page):
    reset(page)
    save(page, "writeMeta", ["E2", "E4"])
    meta = save(page, "readMeta")
    check("meta round trip", meta == {"version": 1, "endingsSeen": ["E2", "E4"]},
          f"got {meta!r}")
    check("meta holds no unlock tree", set(meta) == {"version", "endingsSeen"},
          f"got {sorted(meta)}")
    save(page, "writeMeta")
    check("meta default arg", save(page, "readMeta")["endingsSeen"] == [],
          f"got {save(page, 'readMeta')!r}")


def test_clear(page):
    reset(page)
    st = engine(page, "applyDay", engine(page, "initialState"), [buy("putong")])
    save(page, "writeProgress", st)
    save(page, "writeMeta", ["E3"])
    save(page, "clear")
    check("clear drops progress", save(page, "readProgress") is None,
          f"got {save(page, 'readProgress')!r}")
    check("clear removes the key", raw_get(page, PROGRESS_KEY) is None)
    check("clear keeps cross-run meta",
          save(page, "readMeta")["endingsSeen"] == ["E3"],
          f"got {save(page, 'readMeta')!r}")


TESTS = (test_surface, test_defaults, test_day_boundary, test_schema,
         test_craft_stripped, test_version_discard, test_corrupt, test_clone,
         test_assignment_guard, test_meta, test_clear)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(INDEX.as_uri())
        page.wait_for_timeout(400)
        if not page.evaluate("!!(window.YueYan && window.YueYan.Engine)"):
            print("FAIL: window.YueYan.Engine missing")
            browser.close()
            return 1
        for fn in TESTS:
            try:
                fn(page)
            except SaveError as exc:
                check(f"{fn.__name__} aborted", False, str(exc))
        try:
            test_blocked_storage(browser)
        except SaveError as exc:
            check("test_blocked_storage aborted", False, str(exc))
        check("no pageerror", not errors, "; ".join(errors))
        reset(page)
        browser.close()
    for line in FAIL:
        print("FAIL " + line)
    print(f"yueyan save: {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
