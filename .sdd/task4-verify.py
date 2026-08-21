import json, sys
from playwright.sync_api import sync_playwright

URL = "file:///Users/duanchao.wzj/AI/workspace/red-tool/tools/longzhou/index.html?test=1"
SHOT = "/Users/duanchao.wzj/AI/workspace/red-tool/.sdd/shots/task4-play.png"

results = []
def check(name, cond, extra=""):
    results.append({"name": name, "pass": bool(cond), "extra": str(extra)})
    print(("PASS" if cond else "FAIL"), "-", name, ("" if not extra else ":: " + str(extra)))

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_function("window.__game && window.LZGame && window.LZScene && window.LZSprites")

    # T1 pageerrors (after settle)
    page.wait_for_timeout(400)

    # T2 auto-start + entities>0
    st = page.evaluate("window.__game.snapshot()")
    check("T2a state playing on load", st["state"] == "playing", st["state"])
    page.wait_for_timeout(1500)
    st = page.evaluate("window.__game.snapshot()")
    check("T2b entities>0 after ~1.5s", st["entities"] > 0, "entities=%d" % st["entities"])

    # T3 swipe
    page.evaluate("window.__game.swipe(1)")
    for _ in range(6):
        page.evaluate("window.LZGame.update(0.05)")
    page.wait_for_timeout(400)
    st = page.evaluate("window.__game.snapshot()")
    check("T3 swipe(1)->lane 1", st["lane"] == 1 and abs(st["boatX"] - 1) < 0.05,
          "lane=%s boatX=%.3f" % (st["lane"], st["boatX"]))

    # T4 whirl-capable mix at dist 300
    page.evaluate("window.__game.start()")
    page.evaluate("window.__game.setDist(300)")
    for _ in range(20):
        page.evaluate("window.LZGame.update(0.05)")
    page.wait_for_timeout(300)
    st = page.evaluate("window.__game.snapshot()")
    check("T4a dist>300 after wait", st["dist"] > 300, "dist=%.1f" % st["dist"])
    mix = page.evaluate("""
      (function(){
        window.__game.setDist(300);
        var ents = window.LZGame.snapshot().entities;
        var types = {};
        for (var i=0;i<150;i++){
          var b = ents.length; window.__game.spawnWave();
          var add = ents.slice(b);
          for (var j=0;j<add.length;j++) types[add[j].type]=(types[add[j].type]||0)+1;
        }
        return types;
      })()
    """)
    check("T4b whirl appears at dist300", mix.get("whirl", 0) > 0, json.dumps(mix))

    # T4c 200x spawnWave: obs lanes <=2
    lane = page.evaluate("""
      (function(){
        window.__game.start();
        window.__game.setDist(600);
        var ents = window.LZGame.snapshot().entities;
        var ok=true, maxL=0;
        for (var it=0; it<200; it++){
          var b = ents.length; window.__game.spawnWave();
          var add = ents.slice(b), lanes={};
          for (var j=0;j<add.length;j++) if (add[j].kind==="obs") lanes[add[j].lane]=true;
          var n = Object.keys(lanes).length;
          if (n>maxL) maxL=n;
          if (n>2) ok=false;
        }
        return {ok:ok, maxLanes:maxL};
      })()
    """)
    check("T4c every wave blocks <=2 lanes (200x)", lane["ok"], "maxLanes=%d" % lane["maxLanes"])

    # T5 forceHit x3 -> capsized -> result
    page.evaluate("window.__game.start()")
    page.evaluate("window.__game.forceHit()")
    page.evaluate("window.__game.forceHit()")
    page.evaluate("window.__game.forceHit()")
    st = page.evaluate("window.__game.snapshot()")
    check("T5a capsized after 3 hits", st["state"] == "capsized", st["state"])
    page.wait_for_timeout(1600)
    st = page.evaluate("window.__game.snapshot()")
    check("T5b result after ~1.6s", st["state"] == "result", st["state"])

    # T6 baseSpeed
    page.evaluate("window.__game.start()")
    page.evaluate("window.__game.setDist(0)")
    page.evaluate("window.LZGame.update(0.016)")
    page.wait_for_timeout(120)
    sp0 = page.evaluate("window.__game.snapshot().speed")
    page.evaluate("window.__game.setDist(2500)")
    page.evaluate("window.LZGame.update(0.016)")
    page.wait_for_timeout(120)
    sp1 = page.evaluate("window.__game.snapshot().speed")
    check("T6a speed~8 at dist0", abs(sp0 - 8) < 0.5, "speed=%.3f" % sp0)
    check("T6b speed~22 at dist2500", abs(sp1 - 22) < 0.5, "speed=%.3f" % sp1)

    # T7 drum x9 -> gauge 100 + dash
    page.evaluate("window.__game.start()")
    for i in range(9):
        page.evaluate("window.LZGame.update(0.13); window.__game.drum()")
    st = page.evaluate("window.__game.snapshot()")
    check("T7 gauge 100 & dashT>0 after 9 drums",
          st["gauge"] >= 100 and st["dashT"] > 0,
          "gauge=%s dashT=%.3f" % (st["gauge"], st["dashT"]))

    # T8 screenshot mid-play with obstacles
    page.evaluate("window.__game.start()")
    page.evaluate("window.__game.setDist(400)")
    page.wait_for_timeout(7000)
    st = page.evaluate("window.__game.snapshot()")
    obsN = page.evaluate("""
      window.LZGame.snapshot().entities.filter(function(e){return e.kind==="obs";}).length
    """)
    page.screenshot(path=SHOT)
    check("T8 screenshot saved (obstacles present)", obsN > 0,
          "state=%s entities=%d obs=%d" % (st["state"], st["entities"], obsN))

    # T1 finalize pageerrors
    check("T1 no pageerrors", len(errors) == 0, "; ".join(errors[:3]))

    browser.close()

failed = [r for r in results if not r["pass"]]
print("\n==== %d/%d passed ====" % (len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
