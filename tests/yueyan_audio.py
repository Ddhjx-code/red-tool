#!/usr/bin/env python3
"""月宴 audio assertions: Task 9 / spec §10.3.3.

Headless only. Drives window.YueYan.Audio directly, never the DOM.
Nothing here listens for audible output: a counting fake AudioContext records
every node the module builds, so "muted means zero side effects", "one context
per gesture", the closed seven-event list and the per-variant pitch/length
differentiation are all measured structurally.

Audio is optional and not an acceptance item (§11 has no V item for it), so this
suite guards the contracts §10.3.3 does lock: exactly seven event points, no
eighth invention, muted by default with a genuinely side-effect-free mute, an
AudioContext that is only ever constructed after a user gesture, and a silent
no-op when the host offers no AudioContext at all.
"""
import pathlib
import re
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "tools/yueyan/index.html"
AUDIO = ROOT / "tools/yueyan/assets/audio.js"
ASSETS = ROOT / "tools/yueyan/assets"

SEVEN = ["slot", "craft", "step", "grade", "banquet", "assign", "moon"]

PASS = []
FAIL = []

# Counting fake AudioContext. It exposes exactly the surface audio.js touches,
# so a play that synthesises a tone leaves a structural trace and a play that
# does not leaves nothing at all.
PROBE = """
window.__probe = { contexts: 0, tones: [] };
function param(rec, key) {
  var p = {}, v = 0;
  Object.defineProperty(p, 'value',
    { get: function () { return v; }, set: function (x) { v = x; rec[key] = x; } });
  p.setValueAtTime = function (x) { v = x; rec[key] = x; return p; };
  p.linearRampToValueAtTime = function () { return p; };
  p.exponentialRampToValueAtTime = function () { return p; };
  return p;
}
window.AudioContext = function () {
  window.__probe.contexts++;
  this.currentTime = 0;
  this.state = 'running';
  this.destination = {};
  this.resume = function () {};
  this.createOscillator = function () {
    var rec = { freq: null, type: null, stop: null };
    window.__probe.tones.push(rec);
    var o = { frequency: param(rec, 'freq'), connect: function () {},
              start: function () {}, stop: function (t) { rec.stop = t; } };
    Object.defineProperty(o, 'type',
      { get: function () { return rec.type; },
        set: function (v) { rec.type = v; } });
    return o;
  };
  this.createGain = function () {
    return { gain: param({}, 'gain'), connect: function () {} };
  };
};
window.webkitAudioContext = window.AudioContext;
"""

NO_CONTEXT = """
Object.defineProperty(window, 'AudioContext',
  { value: undefined, configurable: true, writable: true });
Object.defineProperty(window, 'webkitAudioContext',
  { value: undefined, configurable: true, writable: true });
"""

THROWING_CONTEXT = """
window.AudioContext = function () { throw new Error('blocked by host'); };
window.webkitAudioContext = window.AudioContext;
"""


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


def open_page(browser, init=None):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    if init:
        page.add_init_script(init)
    page.goto(INDEX.as_uri())
    page.wait_for_timeout(200)
    return page, errors


def gesture(page):
    """One synthetic user gesture: the module's unlock path, not real audio."""
    page.evaluate("""() => {
      const ev = new PointerEvent('pointerdown', { bubbles: true });
      document.dispatchEvent(ev);
    }""")


def probe(page):
    return page.evaluate("() => window.__probe")


def play_all(page, names=SEVEN):
    page.evaluate(
        "(names) => { names.forEach(n => window.YueYan.Audio.play(n)); }", names)


def test_api_surface(page):
    api = page.evaluate("() => Object.keys(window.YueYan.Audio).sort()")
    check("Task 9 api is exactly play/setMuted/isMuted",
          api == ["isMuted", "play", "setMuted"], f"got {api}")
    kinds = page.evaluate("""() => {
      const A = window.YueYan.Audio;
      return ['play', 'setMuted', 'isMuted'].map(k => typeof A[k]);
    }""")
    check("Task 9 all three are functions", kinds == ["function"] * 3,
          f"got {kinds}")


def test_muted_default(page):
    check("§10.3.3 muted by default", page.evaluate(
        "() => window.YueYan.Audio.isMuted()") is True)


def test_mute_persistence(page):
    page.evaluate("() => window.YueYan.Audio.setMuted(false)")
    check("setMuted(false) unmutes",
          page.evaluate("() => window.YueYan.Audio.isMuted()") is False)
    play_all(page)
    check("mute choice survives plays",
          page.evaluate("() => window.YueYan.Audio.isMuted()") is False)
    page.evaluate("() => window.YueYan.Audio.setMuted(true)")
    check("setMuted(true) re-mutes",
          page.evaluate("() => window.YueYan.Audio.isMuted()") is True)
    page.evaluate("() => window.YueYan.Audio.setMuted(false)")
    page.evaluate("() => window.YueYan.Audio.setMuted(false)")
    check("repeat unmute is idempotent",
          page.evaluate("() => window.YueYan.Audio.isMuted()") is False)
    coerced = page.evaluate("""() => {
      const A = window.YueYan.Audio;
      A.setMuted(0);       const zero = A.isMuted();   // falsy => unmuted
      A.setMuted('');      const empty = A.isMuted();  // falsy => unmuted
      A.setMuted(1);       const one = A.isMuted();    // truthy => muted
      return [typeof one, zero, empty, one];
    }""")
    check("setMuted coerces its argument to a strict boolean",
          coerced == ["boolean", False, False, True], f"got {coerced}")
    page.evaluate("() => window.YueYan.Audio.setMuted(true)")


def test_no_context_before_gesture(page):
    play_all(page)
    p = probe(page)
    check("muted plays build no context and no tone",
          p["contexts"] == 0 and not p["tones"], f"probe {p}")
    page.evaluate("() => window.YueYan.Audio.setMuted(false)")
    play_all(page)
    p = probe(page)
    check("unmuted plays before any gesture build no context",
          p["contexts"] == 0 and not p["tones"], f"probe {p}")
    page.evaluate("() => window.YueYan.Audio.setMuted(true)")


def test_context_created_once_after_gesture(page):
    gesture(page)
    p = probe(page)
    check("user gesture unlocks exactly one context", p["contexts"] == 1,
          f"got {p['contexts']}")
    page.evaluate("() => window.YueYan.Audio.setMuted(false)")
    play_all(page)
    play_all(page)
    gesture(page)
    p = probe(page)
    check("context is reused, never re-created", p["contexts"] == 1,
          f"got {p['contexts']}")
    check("seven events synthesise seven tones", len(p["tones"]) == 14,
          f"got {len(p['tones'])}")
    page.evaluate("() => window.YueYan.Audio.setMuted(true)")
    before = len(probe(page)["tones"])
    play_all(page)
    check("muted play is a zero-side-effect no-op after unlock",
          len(probe(page)["tones"]) == before,
          f"{before} -> {len(probe(page)['tones'])}")


def test_closed_event_list(page):
    gesture(page)
    page.evaluate("() => window.YueYan.Audio.setMuted(false)")
    for name in SEVEN:
        before = len(probe(page)["tones"])
        page.evaluate("(n) => window.YueYan.Audio.play(n)", name)
        check(f"§10.3.3 {name} is a real event point",
              len(probe(page)["tones"]) == before + 1,
              f"{before} -> {len(probe(page)['tones'])}")
    for name in ("explode", "fail", "error", "levelup", "win", "lose"):
        before = len(probe(page)["tones"])
        page.evaluate("(n) => window.YueYan.Audio.play(n)", name)
        check(f"§10.3.3 invented event {name} is silent",
              len(probe(page)["tones"]) == before, f"tone added for {name}")
    silent = page.evaluate("""() => {
      const A = window.YueYan.Audio;
      try { A.play(); A.play(null); A.play(''); return true; }
      catch (e) { return false; }
    }""")
    check("missing/empty name is a silent no-op", silent is True)
    page.evaluate("() => window.YueYan.Audio.setMuted(true)")


def test_variants(page):
    gesture(page)
    page.evaluate("() => window.YueYan.Audio.setMuted(false)")
    page.evaluate("() => window.__probe.tones.length = 0")
    steps = page.evaluate("""() => {
      const out = [];
      for (let i = 0; i < 4; i++) {
        window.YueYan.Audio.play('step', i);
        out.push(window.__probe.tones[window.__probe.tones.length - 1].freq);
      }
      return out;
    }""")
    check("§10.3.3 step is four ascending pitches",
          all(isinstance(f, (int, float)) for f in steps)
          and steps == sorted(steps) and len(set(steps)) == 4,
          f"got {steps}")
    grades = page.evaluate("""() => {
      const out = [];
      for (const g of [1, 2, 3]) {
        window.YueYan.Audio.play('grade', g);
        out.push(window.__probe.tones[window.__probe.tones.length - 1].freq);
      }
      return out;
    }""")
    check("§10.3.3 grade has three distinct tiers", len(set(grades)) == 3,
          f"got {grades}")
    moons = page.evaluate("""() => {
      const out = [];
      for (const c of ['E1', 'E2', 'E3', 'E4', 'E5']) {
        window.YueYan.Audio.play('moon', c);
        out.push(window.__probe.tones[window.__probe.tones.length - 1].stop);
      }
      return out;
    }""")
    check("§10.3.3 moon length differs per ending, longest first",
          all(isinstance(m, (int, float)) for m in moons)
          and moons == sorted(moons, reverse=True) and len(set(moons)) == 5,
          f"got {moons}")
    page.evaluate("() => window.YueYan.Audio.setMuted(true)")


def test_no_audio_context_host(browser):
    page, errors = open_page(browser, NO_CONTEXT)
    gesture(page)
    result = page.evaluate("""() => {
      const A = window.YueYan.Audio;
      A.setMuted(false);
      try {
        ['slot','craft','step','grade','banquet','assign','moon']
          .forEach(n => A.play(n));
        A.play('step', 2); A.play('grade', 3); A.play('moon', 'E1');
        return { ok: true, muted: A.isMuted() };
      } catch (e) { return { ok: false, message: String(e) }; }
    }""")
    check("no AudioContext: play never throws", result["ok"] is True,
          result.get("message", ""))
    check("no AudioContext: mute switch still works",
          result["muted"] is False)
    check("no AudioContext: no pageerror", not errors, "; ".join(errors))
    page.close()


def test_throwing_audio_context(browser):
    page, errors = open_page(browser, THROWING_CONTEXT)
    gesture(page)
    result = page.evaluate("""() => {
      const A = window.YueYan.Audio;
      A.setMuted(false);
      try {
        ['slot','craft','step','grade','banquet','assign','moon']
          .forEach(n => A.play(n));
        return true;
      } catch (e) { return false; }
    }""")
    check("throwing AudioContext constructor is swallowed", result is True)
    check("throwing AudioContext: no pageerror", not errors, "; ".join(errors))
    page.close()


def test_source_hygiene():
    src = AUDIO.read_text(encoding="utf-8")
    check("no Math.random in audio.js", "Math.random" not in src,
          "ambient randomness is banned (§7 determinism)")
    check("audio.js ships no audio asset reference",
          not re.search(r"\.(mp3|wav|ogg|m4a|aac|flac)\b", src, re.I), src[:80])
    check("audio.js declares all seven event names",
          all(re.search(rf"\b{name}\b", src) for name in SEVEN))
    check("audio.js is an IIFE on window.YueYan",
          "window.YueYan.Audio" in src and "'use strict'" in src)
    call_sites = set()
    for js in sorted(ASSETS.glob("*.js")):
        call_sites.update(re.findall(r"Audio\.play\(\s*'([a-zA-Z]+)'",
                                     js.read_text(encoding="utf-8")))
    check("§10.3.3 no eighth event at any call site",
          call_sites <= set(SEVEN), f"invented {sorted(call_sites - set(SEVEN))}")
    check("V-2 no audio file in the asset tree",
          not list(ASSETS.glob("**/*.mp3")) and not list(ASSETS.glob("**/*.wav")))


def main():
    test_source_hygiene()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page, errors = open_page(browser, PROBE)
        if not page.evaluate("() => !!(window.YueYan && window.YueYan.Audio)"):
            print("FAIL: window.YueYan.Audio missing")
            browser.close()
            return 1
        for fn in (test_api_surface, test_muted_default, test_mute_persistence,
                   test_no_context_before_gesture,
                   test_context_created_once_after_gesture,
                   test_closed_event_list, test_variants):
            run(fn, page)
        check("no pageerror", not errors, "; ".join(errors))
        page.close()
        run(test_no_audio_context_host, browser)
        run(test_throwing_audio_context, browser)
        browser.close()
    for line in FAIL:
        print("FAIL " + line)
    print(f"yueyan audio: {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
