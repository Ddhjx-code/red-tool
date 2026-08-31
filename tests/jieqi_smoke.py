#!/usr/bin/env python3
"""Headless smoke suite for 节气塔防 demo (tools/jieqi). Run: python3 tests/jieqi_smoke.py
Core: fast-forward simulation asserts both levels are winnable with a scripted
strategy, and lose without strategy (balance sanity)."""
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL_TEST = (ROOT / "tools" / "jieqi" / "index.html").as_uri() + "?test=1"

CHECKS = []


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok  " if cond else "  FAIL ") + name + ((" | " + extra) if extra and not cond else ""))


SIM_JS = """
(function (plan) {
  var g = window.__game;
  g.start(plan.level);
  var dt = 0.05, t = 0, pi = 0;
  var steps = plan.steps.slice().sort(function(a,b){ return a.t - b.t; });
  while (pi < steps.length || true) {
    var snap = g.snapshot();
    if (snap.phase === "win" || snap.phase === "lose") break;
    while (pi < steps.length && steps[pi].t <= t) {
      var s = steps[pi++];
      if (s.place) g.place(s.place[0], s.place[1], s.place[2]);
    }
    g.tick(dt);
    t += dt;
    if (t > 400) break;
  }
  var final = g.snapshot();
  return { phase: final.phase, time: Math.round(t), grain: final.grain,
           canglin: final.canglin, kills: final.kills, leaked: final.leaked };
})
"""

SIM_AFFORD_JS = """
(function (cfg) {
  var D = window.JQData, g = window.__game;
  g.start(cfg.level);
  var dt = 0.05, t = 0;
  var queue = cfg.queue.slice();
  while (true) {
    var s = g.snapshot();
    if (s.phase === "win" || s.phase === "lose") break;
    if (queue.length) {
      var st = g.state();
      var nxt = queue[0];
      var pp = nxt.p || nxt;
      var cost = D.towers[pp[0]].cost;
      if (st.grain >= cost && !st.towers.some(function(tw){return tw.col===pp[1]&&tw.row===pp[2];})) {
        g.place(pp[0], pp[1], pp[2]);
        queue.shift();
      }
    }
    g.step(dt); t += dt;
    if (t > 400) break;
  }
  var f = g.snapshot();
  return { phase: f.phase, t: Math.round(t), canglin: f.canglin, kills: f.kills, left: queue.length };
})
"""


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        page.goto(URL_TEST)
        page.wait_for_function("window.__ready === true", timeout=10000)
        check("hooks exposed", page.evaluate("!!window.__game"))

        # 立春关：有策略必须守住
        r = page.evaluate(SIM_JS, {"level": 0, "steps": [
            {"t": 0.5, "place": ["guyu", 1, 6]},
            {"t": 1.0, "place": ["lichun", 1, 5]},
            {"t": 3.0, "place": ["lichun", 2, 5]},
            {"t": 8.0, "place": ["lichun", 0, 5]},
            {"t": 12.0, "place": ["yushui", 3, 5]},
            {"t": 18.0, "place": ["lichun", 3, 4]},
            {"t": 26.0, "place": ["jingzhe", 2, 4]},
        ]})
        check("立春关: 策略可解 (win)", r["phase"] == "win", str(r))
        check("立春关: 仓廪未破", r["canglin"] >= 1, str(r))

        # 立春关：无策略必败（数值张力验证）
        r2 = page.evaluate(SIM_JS, {"level": 0, "steps": []})
        check("立春关: 无策略必败 (lose)", r2["phase"] == "lose", str(r2))

        # 立春关：第二种解法（纯铺防流，不种谷雨经济塔）也必须能赢——多解验证
        r1b = page.evaluate(SIM_JS, {"level": 0, "steps": [
            {"t": 0.5, "place": ["lichun", 1, 5]},
            {"t": 1.0, "place": ["lichun", 2, 5]},
            {"t": 4.0, "place": ["lichun", 0, 5]},
            {"t": 7.0, "place": ["lichun", 3, 5]},
            {"t": 12.0, "place": ["yushui", 1, 4]},
            {"t": 16.0, "place": ["yushui", 2, 4]},
            {"t": 22.0, "place": ["jingzhe", 1, 6]},
        ]})
        check("立春关: 铺防流也可解 (多解验证)", r1b["phase"] == "win", str(r1b))

        # 惊蛰关：有策略必须守住（含灾潮波）
        r3 = page.evaluate(SIM_JS, {"level": 1, "steps": [
            {"t": 0.5, "place": ["guyu", 0, 6]},
            {"t": 1.0, "place": ["lichun", 1, 5]},
            {"t": 2.0, "place": ["lichun", 2, 5]},
            {"t": 6.0, "place": ["guyu", 3, 6]},
            {"t": 8.0, "place": ["lichun", 0, 5]},
            {"t": 10.0, "place": ["lichun", 3, 5]},
            {"t": 14.0, "place": ["jingzhe", 1, 4]},
            {"t": 16.0, "place": ["jingzhe", 2, 4]},
            {"t": 20.0, "place": ["yushui", 0, 4]},
            {"t": 22.0, "place": ["yushui", 3, 4]},
            {"t": 28.0, "place": ["lichun", 1, 3]},
            {"t": 30.0, "place": ["lichun", 2, 3]},
            {"t": 36.0, "place": ["jingzhe", 1, 6]},
            {"t": 40.0, "place": ["jingzhe", 2, 6]},
        ]})
        check("惊蛰关: 策略可解 (win, 含灾潮)", r3["phase"] == "win", str(r3))

        # 夏章三关：买得起就放的贪心策略必须守住
        r4 = page.evaluate(SIM_AFFORD_JS, {"level": 2, "queue": [
            ["guyu", 1, 6], ["guyu", 3, 6],
            ["xiazhi", 0, 5], ["xiazhi", 1, 5], ["xiazhi", 3, 5],
            ["mangzhong", 2, 5], ["mangzhong", 2, 4], ["xiaoshu", 2, 3],
            ["xiazhi", 2, 5], ["mangzhong", 0, 4], ["mangzhong", 3, 4],
        ]})
        check("立夏关: 策略可解 (win)", r4["phase"] == "win" and r4["canglin"] >= 4, str(r4))

        r5 = page.evaluate(SIM_AFFORD_JS, {"level": 3, "queue": [
            ["guyu", 0, 6], ["guyu", 2, 6],
            ["xiaoshu", 1, 5], ["xiaoshu", 3, 5],
            ["mangzhong", 2, 5], ["mangzhong", 2, 4],
            ["xiaoshu", 1, 4], ["xiaoshu", 3, 4],
            ["xiazhi", 0, 5], ["xiazhi", 3, 3],
            ["yushui", 1, 3], ["yushui", 3, 3],
        ]})
        check("小暑关: 策略可解 (win)", r5["phase"] == "win" and r5["canglin"] >= 4, str(r5))

        r6 = page.evaluate(SIM_AFFORD_JS, {"level": 4, "queue": [
            ["mangzhong", 2, 5], ["mangzhong", 2, 4],
            ["guyu", 1, 6], ["guyu", 3, 6],
            ["mangzhong", 2, 3],
            ["xiaoshu", 1, 5], ["xiaoshu", 3, 5],
            ["xiazhi", 0, 5], ["xiazhi", 3, 4],
            ["xiaoshu", 3, 4], ["yushui", 2, 2],
        ]})
        check("大暑关: 策略可解 (win)", r6["phase"] == "win" and r6["canglin"] >= 4, str(r6))

        # 夏章三关：可负担策略可解（含飞行/水道/灼烧新机制）
        summer = page.evaluate("""
        (function () {
          var D = window.JQData, g = window.__game;
          function runLevel(level, queue) {
            g.start(level);
            var dt=0.05,t=0,q=queue.slice();
            while(true){
              var s=g.snapshot();
              if(s.phase==='win'||s.phase==='lose')break;
              if(q.length){
                var st=g.state(),nxt=q[0],cost=D.towers[nxt[0]].cost;
                if(st.grain>=cost && !st.towers.some(function(tw){return tw.col===nxt[1]&&tw.row===nxt[2];})){
                  g.place(nxt[0],nxt[1],nxt[2]); q.shift();
                }
              }
              g.step(dt);t+=dt;
              if(t>400)break;
            }
            return g.snapshot().phase;
          }
          var lixia = runLevel(2, [
            ["guyu",1,6],["guyu",3,6],["xiazhi",0,5],["xiazhi",1,5],["xiazhi",3,5],
            ["mangzhong",2,5],["mangzhong",2,4],["xiaoshu",2,3],["xiazhi",2,5],
            ["mangzhong",0,4],["mangzhong",3,4]
          ]);
          var xiaoshu = runLevel(3, [
            ["guyu",0,6],["guyu",2,6],["xiaoshu",1,5],["xiaoshu",3,5],
            ["mangzhong",2,5],["mangzhong",2,4],["xiaoshu",1,4],["xiaoshu",3,4],
            ["xiazhi",0,5],["xiazhi",3,3],["yushui",1,3],["yushui",3,3]
          ]);
          var dashu = runLevel(4, [
            ["mangzhong",2,5],["mangzhong",2,4],["guyu",1,6],["guyu",3,6],
            ["mangzhong",2,3],["xiaoshu",1,5],["xiaoshu",3,5],
            ["xiazhi",0,5],["xiazhi",3,4],["xiaoshu",3,4],["yushui",2,2]
          ]);
          return {lixia:lixia, xiaoshu:xiaoshu, dashu:dashu};
        })()
        """)
        check("夏章·立夏 可解 (飞行机制)", summer["lixia"] == "win", str(summer))
        check("夏章·小暑 可解 (灼烧机制)", summer["xiaoshu"] == "win", str(summer))
        check("夏章·大暑 可解 (水道机制)", summer["dashu"] == "win", str(summer))

        # 秋冬六关：可负担策略可解（含野猪冲撞/冻塔/冰道新机制）
        autumn = page.evaluate("""
        (function () {
          var D = window.JQData, g = window.__game;
          function runLevel(level, queue) {
            g.start(level);
            var dt=0.05,t=0,q=queue.slice();
            while(true){
              var s=g.snapshot();
              if(s.phase==='win'||s.phase==='lose')break;
              if(q.length){
                var st=g.state(),nxt=q[0],cost=D.towers[nxt[0]].cost;
                if(st.grain>=cost && !st.towers.some(function(tw){return tw.col===nxt[1]&&tw.row===nxt[2];})){
                  g.place(nxt[0],nxt[1],nxt[2]); q.shift();
                }
              }
              g.step(dt);t+=dt;
              if(t>400)break;
            }
            return g.snapshot().phase;
          }
          var liqiu = runLevel(5, [
            ["guyu",1,6],["guyu",3,6],["xiazhi",0,5],["xiazhi",3,5],
            ["liqiu",1,5],["liqiu",3,4],["mangzhong",0,4],["mangzhong",2,5],
            ["xiazhi",1,4],["bailu",2,4]
          ]);
          var bailu = runLevel(6, [
            ["guyu",0,6],["guyu",2,6],["xiazhi",1,5],["xiazhi",3,5],
            ["xiazhi",0,5],["jingzhe",2,4],["liqiu",3,4],["bailu",1,4],
            ["mangzhong",2,5],["shuangjiang",3,3]
          ]);
          var shuangjiang = runLevel(7, [
            ["guyu",1,6],["guyu",3,6],["xiazhi",0,5],["xiazhi",3,5],
            ["shuangjiang",1,5],["shuangjiang",3,4],["jingzhe",2,4],["liqiu",0,4],
            ["mangzhong",2,5],["bailu",1,4]
          ]);
          return {liqiu:liqiu, bailu:bailu, shuangjiang:shuangjiang};
        })()
        """)
        check("秋章·立秋 可解 (野猪冲撞)", autumn["liqiu"] == "win", str(autumn))
        check("秋章·白露 可解 (早霜冻塔)", autumn["bailu"] == "win", str(autumn))
        check("秋章·霜降 可解 (三灾齐至)", autumn["shuangjiang"] == "win", str(autumn))

        winter = page.evaluate("""
        (function () {
          var D = window.JQData, g = window.__game;
          function runLevel(level, queue) {
            g.start(level);
            var dt=0.05,t=0,q=queue.slice();
            while(true){
              var s=g.snapshot();
              if(s.phase==='win'||s.phase==='lose')break;
              if(q.length){
                var st=g.state(),nxt=q[0],cost=D.towers[nxt[0]].cost;
                if(st.grain>=cost && !st.towers.some(function(tw){return tw.col===nxt[1]&&tw.row===nxt[2];})){
                  g.place(nxt[0],nxt[1],nxt[2]); q.shift();
                }
              }
              g.step(dt);t+=dt;
              if(t>400)break;
            }
            return g.snapshot().phase;
          }
          var lidong = runLevel(8, [
            ["guyu",1,6],["guyu",3,6],["mangzhong",2,5],["mangzhong",2,4],
            ["lidong",1,5],["lidong",3,5],["daxue",0,5],["daxue",3,4],
            ["bailu",2,3],["dahan",1,4]
          ]);
          var daxue = runLevel(9, [
            ["guyu",0,6],["guyu",2,6],["daxue",1,5],["daxue",3,5],
            ["xiaoshu",0,5],["xiaoshu",3,4],["lidong",1,4],["lidong",3,4],
            ["dahan",2,4],["mangzhong",2,5]
          ]);
          var dahan = runLevel(10, [
            ["guyu",1,6],["guyu",3,6],["dahan",1,5],["dahan",3,5],
            ["jingzhe",2,4],["daxue",0,5],["daxue",3,4],["lidong",1,4],
            ["mangzhong",2,5],["xiaoshu",3,3]
          ]);
          return {lidong:lidong, daxue:daxue, dahan:dahan};
        })()
        """)
        check("冬章·立冬 可解 (冰道机制)", winter["lidong"] == "win", str(winter))
        check("冬章·大雪 可解 (雪怪肉盾)", winter["daxue"] == "win", str(winter))
        check("冬章·大寒 可解 (岁末总攻)", winter["dahan"] == "win", str(winter))

        # UI 流程：首页→关卡图鉴→简报→战斗→卡片渲染
        page.reload()
        page.wait_for_function("window.__ready === true")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_function("window.__ready === true")
        page.click("#btn-start")
        page.wait_for_selector("#view-levels.is-active")
        n_levels = page.locator("#levels-list .level-card").count()
        check("levels view: 11 level cards", n_levels == 11, str(n_levels))
        page.locator("#levels-list .level-card").first.click()
        page.wait_for_selector("#view-intro.is-active")
        intro_name = (page.text_content("#intro-name") or "").strip()
        n_enemies = page.locator("#intro-enemies .roster-item").count()
        n_towers = page.locator("#intro-towers .roster-item").count()
        check("intro: 立春 briefing rendered", "立春" in intro_name and n_enemies == 2 and n_towers == 4,
              "%s e=%d t=%d" % (intro_name, n_enemies, n_towers))
        page.click("#btn-deploy")
        page.wait_for_selector("#view-battle.is-active")
        n_cards = page.locator("#tower-cards .tower-card").count()
        check("battle UI: 13 tower cards", n_cards == 13, str(n_cards))
        hud_grain = page.text_content("#hud-grain")
        check("battle UI: HUD grain shown", hud_grain and hud_grain.strip() == "175", str(hud_grain))
        # 塔介绍条：点选塔后显示详情
        page.locator("#tower-cards .tower-card").first.click()
        info = (page.text_content("#tower-info") or "").strip()
        check("tower info strip shown", "【" in info and "谷" in info, info[:40])

        # 图鉴与成就页面
        page.reload()
        page.wait_for_function("window.__ready === true")
        page.click("#btn-codex-home")
        page.wait_for_selector("#view-codex.is-active")
        n_codex = page.locator("#codex-list .codex-card").count()
        check("codex view: 11 enemy entries", n_codex == 11, str(n_codex))
        page.click("#btn-codex-back")
        page.click("#btn-ach-home")
        page.wait_for_selector("#view-ach.is-active")
        n_ach = page.locator("#ach-list .ach-card").count()
        check("achievements view: 6 achievements", n_ach == 6, str(n_ach))

        # 进度保存：模拟通关后存档有记录
        page.evaluate("""(function(){
          window.__game.start(0);
          var g = window.__game, t = 0;
          var steps = [[0.5,'guyu',1,6],[1,'lichun',1,5],[3,'lichun',2,5],[8,'lichun',0,5],
                       [12,'yushui',3,5],[18,'lichun',3,4],[26,'jingzhe',2,4]];
          var pi = 0;
          while (true) {
            var s = g.snapshot();
            if (s.phase === 'win' || s.phase === 'lose' || t > 400) break;
            while (pi < steps.length && steps[pi][0] <= t) { g.place(steps[pi][1], steps[pi][2], steps[pi][3]); pi++; }
            g.step(0.05); t += 0.05;
          }
        })()""")
        time.sleep(1.5)
        save_state = page.evaluate("window.__game.save()")
        check("save: level win recorded", save_state["levels"].get("lichun", 0) >= 1, str(save_state))
        check("save: enemies seen recorded", len(save_state["seen"]) >= 2, str(save_state["seen"]))
        check("save: first_win achievement", "first_win" in save_state["achievements"], str(save_state["achievements"]))

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
