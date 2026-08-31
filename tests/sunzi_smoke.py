#!/usr/bin/env python3
"""Headless smoke/regression suite for 孙子兵法·战棋 五篇 (tools/sunzi).

Run: python3 tests/sunzi_smoke.py
Covers: multi-level framework, per-level mechanics (formations / reinforce /
morale-surrender / fire), scripted WINNING line per level (solvability proof),
dodge/undo/rules, bamboo-case & intro UI flow, demo auto-play, zero errors.
Prints SMOKE PASS on success.
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL_TEST = (ROOT / "tools" / "sunzi" / "index.html").as_uri() + "?test=1"
URL_DEMO = (ROOT / "tools" / "sunzi" / "index.html").as_uri() + "?demo=1"
URL_PLAIN = (ROOT / "tools" / "sunzi" / "index.html").as_uri()

CHECKS = []

WIN_LINES = {
    0: [  # 始计篇（雁行阵）
        [["sel", "p1"], ["move", 3, 4], ["wait"], ["sel", "p3"], ["move", 1, 4], ["wait"], ["sel", "p2"], ["wait"]],
        [["sel", "p1"], ["move", 3, 6], ["wait"], ["sel", "p3"], ["move", 1, 1], ["wait"], ["sel", "p2"], ["wait"]],
        [["sel", "p3"], ["move", 2, 0], ["attack", "e5"]],
    ],
    1: [  # 作战篇（速战，第3回合敌增援抵达前斩旗）
        [["sel", "p1"], ["move", 3, 4], ["wait"], ["sel", "p3"], ["move", 1, 4], ["wait"], ["sel", "p2"], ["wait"]],
        [["sel", "p1"], ["move", 3, 6], ["wait"], ["sel", "p3"], ["move", 1, 1], ["wait"], ["sel", "p2"], ["wait"]],
        [["sel", "p3"], ["move", 2, 0], ["attack", "e5"]],
    ],
    2: [  # 谋攻篇（不战而屈人之兵：诱敌孤立→全员受降）
        [["sel", "p1"], ["move", 1, 4], ["wait"], ["sel", "p3"], ["move", 3, 5], ["wait"], ["sel", "p2"], ["wait"]],
        [["sel", "p1"], ["move", 0, 5], ["wait"], ["sel", "p2"], ["move", 5, 4], ["wait"], ["sel", "p3"], ["move", 5, 5], ["wait"]],
        [["sel", "p3"], ["move", 6, 4], ["wait"], ["sel", "p2"], ["move", 5, 5], ["wait"], ["sel", "p1"], ["wait"]],
        [["sel", "p2"], ["move", 6, 6], ["wait"], ["sel", "p1"], ["wait"], ["sel", "p3"], ["wait"]],
        [["sel", "p1"], ["wait"], ["sel", "p2"], ["wait"], ["sel", "p3"], ["wait"]],
        [["sel", "p1"], ["wait"], ["sel", "p2"], ["wait"], ["sel", "p3"], ["wait"]],
    ],
    3: [  # 虚实篇（避实击虚）
        [["sel", "p1"], ["move", 3, 4], ["wait"], ["sel", "p3"], ["move", 1, 4], ["wait"], ["sel", "p2"], ["wait"]],
        [["sel", "p1"], ["move", 3, 6], ["wait"], ["sel", "p3"], ["move", 1, 1], ["wait"], ["sel", "p2"], ["wait"]],
        [["sel", "p3"], ["move", 2, 0], ["attack", "e5"]],
    ],
    4: [  # 火攻篇（引火→轻骑上路斩旗）
        [["sel", "p2"], ["move", 2, 5], ["ignite", 2, 4], ["sel", "p3"], ["move", 0, 3], ["wait"], ["sel", "p1"], ["wait"]],
        [["sel", "p3"], ["move", 0, 0], ["wait"], ["sel", "p2"], ["move", 1, 5], ["wait"], ["sel", "p1"], ["wait"]],
        [["sel", "p3"], ["move", 3, 0], ["wait"], ["sel", "p2"], ["move", 0, 5], ["wait"], ["sel", "p1"], ["wait"]],
        [["sel", "p3"], ["move", 5, 0], ["attack", "e5"]],
    ],
}

RUN_LINE_JS = """
(function (spec) {
  var g = window.__game;
  g.start(spec.level, spec.formation || 0);
  var failed = [];
  spec.turns.forEach(function (turn, ti) {
    if (g.snapshot().phase !== "player") return;
    turn.forEach(function (op) {
      var r = true;
      if (op[0] === "sel") r = g.select(op[1]);
      else if (op[0] === "move") r = g.move(op[1], op[2]);
      else if (op[0] === "attack") r = g.attack(op[1]);
      else if (op[0] === "wait") r = g.wait();
      else if (op[0] === "ignite") r = g.ignite(op[1], op[2]);
      if (r === false) failed.push("T" + (ti + 1) + ":" + op.join(","));
    });
    if (g.snapshot().phase === "player") g.endTurn();
  });
  return { failed: failed, result: g.result(), snap: g.snapshot() };
})
"""


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok  " if cond else "  FAIL ") + name + ((" | " + extra) if extra and not cond else ""))


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        # --- UI flow: home -> case -> intro (bamboo linkage) ---
        page.goto(URL_PLAIN)
        page.wait_for_function("window.__ready === true")
        page.click("#btn-to-case")
        slips = page.locator("#case-grid .slip").count()
        lost = page.locator("#case-lost .lost-slip").count()
        check("case view: 5 slips + 8 lost slips", slips == 5 and lost == 8, "%d/%d" % (slips, lost))
        page.locator("#case-grid .slip").nth(2).click()
        page.wait_for_selector("#view-intro.is-active")
        intro_name = (page.text_content("#intro-name") or "").strip()
        has_quote = "不战而屈人之兵" in (page.text_content("#intro-quote") or "")
        has_brief = page.locator("#intro-brief p").count() >= 2
        check("intro view: 谋攻篇 quote + brief", intro_name == "谋攻篇" and has_quote and has_brief, intro_name)
        page.click("#btn-intro-back")
        page.wait_for_selector("#view-case.is-active")

        # --- battle logic under ?test=1 ---
        page.goto(URL_TEST)
        page.wait_for_function("window.__ready === true")
        check("hooks exposed", page.evaluate("!!window.__game"))

        snap = page.evaluate("window.__game.snapshot()")
        check("xushi default load: 8 units, 4 intents",
              len(snap["units"]) == 8 and len(snap["intents"]) == 4,
              "%d units %d intents" % (len(snap["units"]), len(snap["intents"])))

        rules = page.evaluate("""
        (function () {
          var g = window.__game;
          g.start(3, 0);
          var heavyRange = g.moveRange("e1");
          var heavyInForest = heavyRange.some(function (c) { return c.col === 0 && c.row === 2; });
          var cav = g.unit("p3");
          cav.movedSteps = 2;
          var chargeDmg = g.damage(cav, g.unit("e5"));
          cav.movedSteps = 0;
          var noChargeDmg = g.damage(cav, g.unit("e5"));
          var arch = g.unit("p2");
          var e4 = g.unit("e4");
          e4.col = 6; e4.row = 2;
          var rfDmg = g.damage(arch, e4);
          e4.col = 5; e4.row = 1;
          var openDmg = g.damage(arch, e4);
          return { heavyInForest: heavyInForest, chargeDmg: chargeDmg,
                   noChargeDmg: noChargeDmg, rfDmg: rfDmg, openDmg: openDmg };
        })()
        """)
        check("heavy avoids forest", rules["heavyInForest"] is False)
        check("cavalry charge 4->6", rules["noChargeDmg"] == 4 and rules["chargeDmg"] == 6, str(rules))
        check("ranged vs forest halved 3->1", rules["openDmg"] == 3 and rules["rfDmg"] == 1, str(rules))

        dodge = page.evaluate("""
        (function () {
          var g = window.__game;
          g.start(3, 0);
          g.select("p1"); g.move(3, 4);
          g.endTurn();
          var atkP1 = g.snapshot().intents.filter(function (it) {
            return it.attack && it.attack.targetId === "p1";
          });
          if (!atkP1.length) return { step1: false };
          var hpBefore = g.unit("p1").hp;
          g.select("p1"); g.move(3, 6);
          var events = g.endTurn();
          var missed = events.some(function (e) { return e.type === "miss"; });
          return { step1: true, hpBefore: hpBefore, hpAfter: g.unit("p1").hp, missed: missed };
        })()
        """)
        check("telegraphed attack + dodge avoids damage",
              dodge.get("step1") and dodge.get("missed") and
              dodge.get("hpBefore") == dodge.get("hpAfter") == 8, str(dodge))

        undo = page.evaluate("""
        (function () {
          var g = window.__game;
          g.start(3, 0);
          g.select("p1"); g.move(3, 4);
          var ok = g.undo();
          return { ok: ok, c: g.unit("p1").col, r: g.unit("p1").row, steps: g.unit("p1").movedSteps };
        })()
        """)
        check("undo restores pre-move position",
              undo["ok"] and undo["c"] == 3 and undo["r"] == 6 and undo["steps"] == 0, str(undo))

        reinforce = page.evaluate("""
        (function () {
          var g = window.__game;
          g.start(3, 0);
          var before = g.snapshot().units.length;
          g.endTurn(); g.endTurn(); g.endTurn();
          var snap = g.snapshot();
          var r1 = snap.units.filter(function (u) { return u.id === "r1"; });
          return { before: before, after: snap.units.length, turn: snap.turn, has: !!r1.length };
        })()
        """)
        check("xushi reinforcement spawns at turn 4",
              reinforce["turn"] == 4 and reinforce["after"] == reinforce["before"] + 1 and reinforce["has"],
              str(reinforce))

        timeout = page.evaluate("""
        (function () {
          var g = window.__game;
          g.start(3, 0);
          g.state().turn = 10;
          g.endTurn();
          return g.result();
        })()
        """)
        check("turn limit loses with timeout",
              timeout["phase"] == "lose" and timeout["reason"] == "timeout", str(timeout))

        formation = page.evaluate("""
        (function () {
          var g = window.__game;
          g.start(0, 2);
          var p3 = g.unit("p3");
          return { c: p3.col, r: p3.row };
        })()
        """)
        check("始计篇 formation 3 places cavalry at (4,6)",
              formation["c"] == 4 and formation["r"] == 6, str(formation))

        fire = page.evaluate("""
        (function () {
          var g = window.__game;
          g.start(4, 0);
          g.select("p2"); g.move(2, 5);
          var cells = g.ignitableCells();
          var ok = g.ignite(2, 4);
          g.wait();
          g.select("p3"); g.wait();
          g.select("p1"); g.wait();
          var events = g.endTurn();
          var snap = g.snapshot();
          return {
            cells: cells.length, ok: ok,
            fireCount: Object.keys(snap.fire).length,
            fireUsed: snap.fireUsed,
            burned: events.some(function (e) { return e.type === "burn"; })
          };
        })()
        """)
        check("fire: ignite adjacent reed + spreads",
              fire["cells"] >= 1 and fire["ok"] and fire["fireCount"] >= 2 and fire["fireUsed"], str(fire))

        fireblock = page.evaluate("""
        (function () {
          var g = window.__game;
          g.start(4, 0);
          g.select("p2"); g.move(2, 5);
          g.ignite(2, 4);
          g.wait(); g.select("p3"); g.wait(); g.select("p1"); g.wait();
          g.endTurn(); g.endTurn(); g.endTurn();
          var snap = g.snapshot();
          var scorched = snap.scorched.indexOf("2,4") >= 0;
          var p3 = g.unit("p3");
          p3.col = 2; p3.row = 6;
          g.select("p3");
          var range = g.moveRange("p3");
          var ontoScorched = range.some(function (c) { return c.col === 2 && c.row === 4; });
          var ontoNormal = range.some(function (c) { return c.col === 3 && c.row === 6; });
          return { scorched: scorched, ontoScorched: ontoScorched, ontoNormal: ontoNormal };
        })()
        """)
        check("fire: burnt-out reed becomes impassable scorched earth",
              fireblock["scorched"] and not fireblock["ontoScorched"] and fireblock["ontoNormal"],
              str(fireblock))

        # --- winning lines: solvability proof for all five chapters ---
        for lv, turns in sorted(WIN_LINES.items()):
            res = page.evaluate(RUN_LINE_JS, {"level": lv, "formation": 0, "turns": turns})
            ok = (not res["failed"]) and res["result"] and res["result"]["phase"] == "win"
            check("winning line: level %d" % lv, ok,
                  "failed=%s result=%s" % (res["failed"], res["result"]))
            if lv == 2:
                check("谋攻篇: 不战而胜 kills=0 surrendered=4",
                      res["result"]["kills"] == 0 and len(res["result"]["surrendered"]) == 4,
                      str(res["result"]))
                check("谋攻篇: 3 stars", res["result"]["stars"] == 3, str(res["result"]))
            if lv == 4:
                check("火攻篇: 3 stars", res["result"]["stars"] == 3, str(res["result"]))

        lose = page.evaluate("""
        (function () {
          var g = window.__game;
          g.start(3, 0);
          var i = 0;
          while (i < 60 && g.snapshot().phase === "player") { g.endTurn(); i++; }
          return { phase: g.snapshot().phase };
        })()
        """)
        check("passive play loses", lose["phase"] == "lose", str(lose))

        # --- demo auto-play (xushi) ---
        page.goto(URL_DEMO)
        try:
            page.wait_for_selector("#view-result.is-active", timeout=45000)
            demo_ok = True
        except Exception:
            demo_ok = False
        check("demo auto-play reaches result view", demo_ok)
        if demo_ok:
            title = (page.text_content("#result-title") or "").strip()
            quote = page.text_content("#result-quote") or ""
            check("demo wins: 克敌制胜 + 虚实篇 quote",
                  title == "克敌制胜" and "避实而击虚" in quote, title)
            share_btns = page.locator("#btn-save-album").count() + page.locator("#btn-post-note").count()
            card_ok = page.evaluate(
                "(function () {"
                "  if (!window.SZShare || !window.SZShare.lastStats) return false;"
                "  var d = window.SZShare.paintCard(window.SZShare.lastStats);"
                "  return typeof d === 'string' && d.indexOf('data:image/png') === 0 && d.length > 10000;"
                "})()")
            check("share: buttons present + battle card renders",
                  share_btns == 2 and card_ok, "btns=%d card=%s" % (share_btns, card_ok))

        check("zero console/page errors", not errors, "; ".join(errors[:5]))
        browser.close()

    failed = [n for n, ok in CHECKS if not ok]
    print()
    if failed:
        print("SMOKE FAIL: %d/%d failed: %s" % (len(failed), len(CHECKS), ", ".join(failed)))
        sys.exit(1)
    print("SMOKE PASS (%d assertions)" % len(CHECKS))


if __name__ == "__main__":
    main()
