#!/usr/bin/env python3
"""Headless smoke suite for 后羿射日 (tools/houyi).

两条主线：
  ① 物理内核不回退（轮廓碰撞体 / 轨迹诚实 / 相对速度伤害 / 堆叠休眠 / 靶场双测）
  ② 产品流程完整（home → levels → intro → battle → result + 存档 + 分享 + demo 自驾）

Run: python3 tests/houyi_smoke.py
"""
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = pathlib.Path(os.environ.get("HOUYI_TARGET") or (ROOT / "tools" / "houyi" / "index.html"))
URL_TEST = TOOL.as_uri() + "?test=1"
URL_HOME = TOOL.as_uri()
URL_DEMO = TOOL.as_uri() + "?demo=1"
SHOTS = pathlib.Path("/tmp/houyi_shots")

CHECKS = []


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok  " if cond else "  FAIL ") + name + ((" | " + extra) if extra and not cond else ""))


def shot(page, name):
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.wait_for_timeout(700)          # .view 有 0.55s viewIn 动画，起于 opacity:0
    page.screenshot(path=str(SHOTS / (name + ".png")))


def world_to_page(page, wx, wy):
    """世界坐标 -> 页面坐标（用 __game.view2d() 的真实 scale/offset）"""
    v = page.evaluate("window.__game.view2d()")
    box = page.locator("#stage").bounding_box()
    return {
        "x": box["x"] + wx * v["scale"] + v["offX"],
        "y": box["y"] + wy * v["scale"] + v["offY"],
    }


def drag_release(page, wx, wy):
    """真实指针拖动 -> 松手放箭（走 canvas 事件，不走 __game 直调）"""
    p = world_to_page(page, wx, wy)
    page.mouse.move(p["x"], p["y"])
    page.mouse.down()
    page.mouse.move(p["x"] - 6, p["y"] + 4, steps=6)
    return p


# =========================================================================
# A. 物理内核不回退
# =========================================================================
def physics_suite(page, errors):
    page.goto(URL_TEST)
    page.wait_for_function("window.__ready === true", timeout=15000)

    check("hooks exposed", page.evaluate("!!window.__game"))
    check("Matter.js 0.19.0", page.evaluate("window.__game.snapshot().matterVersion") == "0.19.0",
          str(page.evaluate("window.__game.snapshot().matterVersion")))
    check("凸块全部校验通过（无凹多边形被 hull）",
          len(page.evaluate("window.__game.snapshot().warnings")) == 0,
          str(page.evaluate("window.__game.snapshot().warnings")))

    page.evaluate("window.__game.start(0)")
    page.wait_for_selector("#view-battle.is-active")
    page.evaluate("window.__game.pause(true)")

    # ---- 常量逐字一致 ----
    cfg = page.evaluate("window.__game.config()")
    check("常量: MAX_SPEED 17.2", cfg["maxSpeed"] == 17.2, str(cfg["maxSpeed"]))
    check("常量: DAMAGE_SCALE 6 / MIN_IMPACT 2.0",
          cfg["damageScale"] == 6 and cfg["minImpact"] == 2.0, str(cfg))
    check("常量: MAX_PULL 140 / POWER_SCALE 0.122",
          cfg["maxPull"] == 140 and cfg["powerScale"] == 0.122, str(cfg))
    check("常量: HP {fusan:45, rilun:130, jinwu:14}",
          cfg["hp"] == {"fusan": 45, "rilun": 130, "jinwu": 14}, str(cfg["hp"]))
    check("常量: BIRD_SCALE 1.7", cfg["birdScale"] == 1.7, str(cfg["birdScale"]))
    check("常量: ANCHOR (152,538)", cfg["anchor"] == {"x": 152, "y": 538}, str(cfg["anchor"]))
    check("常量: 固定步长 1000/60", abs(cfg["step"] - 1000 / 60) < 1e-9, str(cfg["step"]))
    check("常量: gravStepY 0.277778", abs(cfg["gravStepY"] - 0.277778) < 1e-6, str(cfg["gravStepY"]))
    check("常量: GROUND_Y 690 / WORLD 1280x720",
          cfg["groundY"] == 690 and cfg["worldW"] == 1280 and cfg["worldH"] == 720, str(cfg))

    # ---- 轮廓碰撞体（非矩形）----
    audit = page.evaluate("window.__game.shapeAudit()")
    kinds = {a["kind"]: a for a in audit}
    check("金乌 = 9 凸块复合体", kinds["jinwu"]["parts"] == 9, str(kinds["jinwu"]))
    check("金乌 fillRatio ≈ 0.441（非矩形）", abs(kinds["jinwu"]["fillRatio"] - 0.441) < 0.02,
          str(kinds["jinwu"]["fillRatio"]))
    check("扶桑 fillRatio 0.70-0.86（收腰/节瘤 -> 非矩形）",
          all(0.70 < a["fillRatio"] < 0.86 for a in audit if a["kind"] == "fusan"),
          str([a["fillRatio"] for a in audit if a["kind"] == "fusan"]))
    check("无任何实体是矩形", not any(a["isRectangleLike"] for a in audit),
          str([a for a in audit if a["isRectangleLike"]]))

    arrow = page.evaluate("window.__game.arrowInfo()")
    check("箭 = 3 凸块（head/shaft/fletch）", arrow["parts"] == 3, str(arrow))
    check("箭 frictionAir = 0（纯抛物线）", arrow["frictionAir"] == 0, str(arrow["frictionAir"]))
    check("箭细长非宽矩形 fillRatio < 0.5", arrow["fillRatio"] < 0.5, str(arrow["fillRatio"]))
    check("箭 indestructible", arrow["indestructible"] is True, str(arrow))

    # ---- 幽灵碰撞区确实存在（证明轮廓 != 矩形）----
    ghosts = page.evaluate("window.__game.ghostStats('jinwu')")
    check("金乌幽灵区占比 > 0.5（矩形会误判）",
          ghosts and ghosts[0]["ghostRatio"] > 0.5, str(ghosts[:1]))

    # ---- 堆叠稳定（enableSleeping）----
    page.evaluate("window.__game.step(120)")
    bodies = page.evaluate("window.__game.bodies()")
    asleep = sum(1 for b in bodies if b["sleeping"])
    check("静置结构进入休眠 (>=80%)", asleep >= len(bodies) * 0.8,
          "%d/%d" % (asleep, len(bodies)))
    drift = max(abs(b["angle"]) for b in bodies)
    check("静置角度漂移 < 0.02rad", drift < 0.02, str(drift))

    # ---- 轨迹预览诚实（解析积分 == 实测飞行）----
    page.evaluate("window.__game.start(0)")
    page.evaluate("window.__game.pause(true)")
    honesty = page.evaluate("""(function(){
      var g = window.__game;
      var pv = g.preview(110, 590);
      g.release();
      g.step(14);
      var tr = g.arrowTrack();
      var maxErr = 0, n = Math.min(pv.points.length, tr.length, 14);
      for (var i=0;i<n;i++) maxErr = Math.max(maxErr,
        Math.hypot(pv.points[i].x - tr[i].x, pv.points[i].y - tr[i].y));
      return {maxErr: maxErr, n: n, pts: pv.points.length};
    })()""")
    check("轨迹预览误差 < 0.05px（14 帧）", honesty["maxErr"] < 0.05, str(honesty))

    # ---- 碰撞伤害走 parentA/parentB（相对速度结算）----
    page.evaluate("window.__game.clearLog()")
    page.evaluate("window.__game.start(0)")
    page.evaluate("window.__game.pause(true)")
    killed = page.evaluate("""(function(){
      var g = window.__game;
      var bodies = g.bodies();
      var bird = bodies.filter(function(b){ return b.kind === 'jinwu'; })[0];
      var sol = g.solveAim(bird.x, bird.y, false);
      if (!sol) return {ok:false, why:'no aim'};
      g.launch(sol.vx, sol.vy);
      for (var i=0;i<160;i++) { g.step(1); if (g.snapshot().phase !== 'flying') break; }
      var log = g.hitLog();
      var hits = log.filter(function(h){ return h.kind === 'jinwu'; });
      return {ok:true, hits:hits.length, killed:hits.some(function(h){return h.killed;}),
              impact:hits.length?hits[0].impact:0, dmg:hits.length?hits[0].dmg:0,
              phase:g.snapshot().phase, birds:g.snapshot().birdsAlive};
    })()""")
    check("直射金乌：伤害已结算（parentA/parentB 生效）", killed["hits"] > 0, str(killed))
    check("金乌一击必杀", killed["killed"] is True, str(killed))
    check("伤害 = 相对速度 × 6（非 penetration.depth）",
          killed["hits"] > 0 and abs(killed["dmg"] - killed["impact"] * 6) < 0.2, str(killed))
    check("金乌尽殒 -> 过关", killed["phase"] == "won" and killed["birds"] == 0, str(killed))

    # ---- 靶场双测：射空白角应 MISS，射鸟身应 HIT ----
    r1 = page.evaluate("""(function(){
      var g = window.__game;
      g.range(); g.pause(true);
      g.rangeShot('ghost');
      for (var i=0;i<200;i++) { g.step(1); if (!g.state().arrowInFlight) break; }
      return g.reportRange();
    })()""")
    check("靶场①：箭穿过矩形包围盒", r1 and r1["passesThroughBBox"] is True, str(r1))
    check("靶场①：射空白角 = MISS（轮廓碰撞体不误判）",
          r1 and r1["actual"] == "MISS" and r1["pass"] is True, str(r1))

    r2 = page.evaluate("""(function(){
      var g = window.__game;
      g.range(); g.pause(true);
      g.rangeShot('body');
      for (var i=0;i<200;i++) { g.step(1); if (!g.state().arrowInFlight) break; }
      return g.reportRange();
    })()""")
    check("靶场②：射鸟身 = HIT", r2 and r2["actual"] == "HIT" and r2["pass"] is True, str(r2))

    # ---- 箭速封顶（防穿透）----
    capped = page.evaluate("""(function(){
      var g = window.__game;
      g.start(0); g.pause(true);
      g.launch(30, -30);
      var maxSp = 0;
      for (var i=0;i<40;i++){ g.step(1);
        var a = g.state().arrow; if (a) maxSp = Math.max(maxSp, Math.hypot(a.velocity.x, a.velocity.y)); }
      return maxSp;
    })()""")
    check("箭速封顶 17.2（超速发射被夹住）", capped <= 17.25, str(capped))

    shot(page, "01-physics-debug")


# =========================================================================
# A2. 所见即所撞：渲染轮廓 == 碰撞轮廓（1:1 视口，逐实体核对）
# =========================================================================
EDGE_JS = """(function(pts){
  var S = window.__game.state();
  var all = S.birds.concat(S.blocks, S.suns);
  function seg(px,py,ax,ay,bx,by){
    var dx=bx-ax, dy=by-ay, t=((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1);
    t=Math.max(0,Math.min(1,t));
    return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
  }
  return pts.map(function(q){
    var best=1e9;
    all.forEach(function(b){
      if (b.circleRadius){
        best=Math.min(best, Math.abs(Math.hypot(q.x-b.position.x,q.y-b.position.y)-b.circleRadius));
        return;
      }
      for (var i=1;i<b.parts.length;i++){
        var v=b.parts[i].vertices;
        for (var k=0;k<v.length;k++){
          var a=v[k], c=v[(k+1)%v.length];
          best=Math.min(best, seg(q.x,q.y,a.x,a.y,c.x,c.y));
        }
      }
    });
    return +best.toFixed(2);
  });
})"""


def silhouette_suite(browser):
    import json as _json
    page = browser.new_page(viewport={"width": 1280, "height": 800})   # scale=1.0
    page.goto(URL_TEST)
    page.wait_for_function("window.__ready === true", timeout=15000)
    scale = page.evaluate("window.__game.view2d().scale")
    check("1:1 视口（1 device px = 1 world px）", abs(scale - 1.0) < 0.01, str(scale))

    page.evaluate("window.__game.start(2); window.__game.pause(true); window.__game.step(90)")
    page.wait_for_timeout(350)
    pts = page.evaluate("window.__game.silhouetteGrid(4)")
    rgb = page.evaluate("window.__game.samplePixels(%s)" % _json.dumps([[q["x"], q["y"]] for q in pts]))
    sky = page.evaluate("window.__game.samplePixels(%s)" % _json.dumps([[300, q["y"]] for q in pts]))
    suns = page.evaluate(
        "window.__game.bodies().filter(function(b){return b.kind==='rilun';})"
        ".map(function(b){return {x:b.x,y:b.y,r:b.w/2};})")

    def dist(a, c):
        return (sum((a[i] - c[i]) ** 2 for i in range(3))) ** 0.5

    def in_halo(x, y):
        return any((x - s["x"]) ** 2 + (y - s["y"]) ** 2 <= (s["r"] * 2.1) ** 2 for s in suns)

    # 必须先在完整数组上配对再过滤：rgb/sky 与 pts 同长，先筛 inside 会错位
    rows = [(q, c, s) for q, c, s in zip(pts, rgb, sky) if c and s]
    inside = [(q, c, s) for q, c, s in rows if q["inside"]]
    # 树皮与地平线附近的暖色天空本就接近，故阈值取 5 而非 20
    painted = sum(1 for q, c, s in inside if dist(c, s) > 5)
    check("轮廓内全部画上实体墨色 (>98%)", painted > len(inside) * 0.98,
          "%d/%d" % (painted, len(inside)))

    bad = [q for q, c, s in rows
           if not q["inside"] and not q["other"] and dist(c, s) > 60]
    edge = page.evaluate(EDGE_JS + "(%s)" % _json.dumps([{"x": q["x"], "y": q["y"]} for q in bad])) if bad else []
    real = [(q, e) for q, e in zip(bad, edge) if e > 1.6 and not in_halo(q["x"], q["y"])]
    check("轮廓外无实心墨色溢出（仅允许 1px 抗锯齿 / 日轮外晕）", len(real) == 0,
          str(real[:6]))
    page.close()


# =========================================================================
# B. 产品流程
# =========================================================================
def flow_suite(page, errors):
    page.goto(URL_HOME)
    page.wait_for_function("window.__ready === true", timeout=15000)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_function("window.__ready === true", timeout=15000)

    # ---- home ----
    check("home 视图激活", page.locator("#view-home.is-active").count() == 1)
    check("home: 后羿射日神话 3 段", page.locator("#home-intro p").count() == 3,
          str(page.locator("#home-intro p").count()))
    check("home: 射日进度文案", "已射落" in page.locator("#home-progress").inner_text())
    shot(page, "02-home")

    # ---- level select ----
    page.click("#btn-start")
    page.wait_for_selector("#view-levels.is-active")
    cards = page.locator("#levels-list .level-card").count()
    check("levels: 6 关", cards == 6, str(cards))
    check("levels: 第 1 关已解锁", page.locator("#levels-list .level-card").nth(0).get_attribute("class").find("locked") < 0)
    check("levels: 第 2 关锁定", "locked" in page.locator("#levels-list .level-card").nth(1).get_attribute("class"))
    check("levels: 终关标注留一日",
          "留一日" in page.locator("#levels-list .level-card").nth(5).inner_text())
    shot(page, "03-levels")

    # ---- intro ----
    page.locator("#levels-list .level-card").nth(0).click()
    page.wait_for_selector("#view-intro.is-active")
    check("intro: 关名", "初射一日" in page.locator("#intro-name").inner_text())
    check("intro: 过关条件", "过关条件" in page.locator("#intro-goal").inner_text())
    shot(page, "04-intro")

    # ---- battle：真实指针拉弓 -> 轨迹预览 -> 放箭 ----
    page.click("#btn-deploy")
    page.wait_for_selector("#view-battle.is-active")
    snap = page.evaluate("window.__game.snapshot()")
    check("battle: 素缯 5 支", snap["arrowsLeft"] == 5, str(snap))
    check("battle: 金乌 1 只", snap["birdsAlive"] == 1, str(snap))
    check("battle: HUD 关名", "初射一日" in page.locator("#hud-level").inner_text())

    p = drag_release(page, 110, 590)
    prev = page.evaluate("window.__game.state().previewPts.length")
    check("拖动产生轨迹预览点", prev > 10, str(prev))
    shot(page, "05-battle-aim")
    page.mouse.up()
    page.wait_for_function("window.__game.snapshot().arrowInFlight === true", timeout=4000)
    check("松手放箭 -> 箭在飞行", True)
    shot(page, "06-battle-flight")

    # 打完剩余箭直到过关（等上一箭落地再自动瞄准补射）
    page.evaluate("""(function(){
      var g = window.__game, tries = 0;
      function shot(){
        var s = g.snapshot();
        if (s.phase === 'won' || s.phase === 'lost') return;
        if (s.phase !== 'ready' || s.arrowInFlight) { setTimeout(shot, 200); return; }
        var bird = g.bodies().filter(function(b){ return b.kind === 'jinwu'; })[0];
        if (!bird) return;
        var sol = g.solveAim(bird.x, bird.y, false);
        if (!sol) return;
        g.launch(sol.vx, sol.vy);
        if (++tries < 5) setTimeout(shot, 1800);
      }
      shot();
    })()""")
    page.wait_for_function("window.__game.snapshot().phase === 'won'", timeout=20000)
    check("金乌尽殒 -> won", True)
    shot(page, "07-battle-won")

    # ---- result ----
    page.wait_for_selector("#view-result.is-active", timeout=8000)
    check("result 视图激活", True)
    check("result: 战绩标题", "金乌尽殒" in page.locator("#result-title").inner_text())
    check("result: 星级", "★" in page.locator("#result-stars").inner_text())
    check("result: 知识点标签", page.locator("#know-tag").inner_text().strip() != "")
    check("result: 知识点正文（后羿射日出处）",
          len(page.locator("#know-text").inner_text()) > 20)
    check("result: 战绩可起名", page.locator("#work-name").input_value() != "")
    check("result: 分享按钮在位", page.locator("#btn-save-album").count() == 1
          and page.locator("#btn-post-note").count() == 1)
    check("result: 下一关按钮（通关解锁）",
          page.locator("#btn-next").is_visible())
    shot(page, "08-result")

    # ---- 起名 + 存档 + 分享卡 ----
    page.fill("#work-name", "彤弓破晓")
    page.evaluate("window.__game.setName('彤弓破晓')")
    check("起名生效", page.evaluate("window.__game.result().name") == "彤弓破晓")
    works = page.evaluate("window.__game.works()")
    check("战绩写入 localStorage", len(works) == 1 and works[0]["name"] == "彤弓破晓", str(works))
    save = page.evaluate("window.__game.save()")
    check("存档: 通关记录", "l1" in save["cleared"], str(save))
    check("存档: 最佳成绩", save["best"].get("l1", {}).get("score", 0) > 0, str(save["best"]))
    check("存档: 已射落 1 日", save["sunsDown"] == 1, str(save["sunsDown"]))
    card_len = page.evaluate("window.__game.shareCard()")
    check("分享卡可绘制（900x1200 PNG dataURL）", card_len > 20000, str(card_len))

    # ---- 端能力降级：无 xhs.miniTool 时不报错（须在结算页仍激活时点） ----
    errs_before = len(errors)
    page.click("#btn-save-album")
    page.wait_for_timeout(400)
    check("端能力缺失时优雅降级（无 JS 报错）", len(errors) == errs_before, str(errors[errs_before:]))

    # ---- 解锁推进 ----
    page.click("#btn-next")
    page.wait_for_selector("#view-intro.is-active")
    page.click("#btn-intro-back")
    page.wait_for_selector("#view-levels.is-active")
    check("通关后第 2 关解锁",
          "locked" not in page.locator("#levels-list .level-card").nth(1).get_attribute("class"))


# =========================================================================
# C. 终关「留一日」机制
# =========================================================================
def spare_suite(page):
    page.goto(URL_TEST)
    page.wait_for_function("window.__ready === true", timeout=15000)

    # 误伤最后一只金乌 -> 十日俱灭
    lose = page.evaluate("""(function(){
      var g = window.__game;
      g.start(5); g.pause(true);
      var bird = g.bodies().filter(function(b){ return b.kind === 'jinwu'; })[0];
      var sol = g.solveAim(bird.x, bird.y, false);
      if (!sol) return {ok:false};
      g.launch(sol.vx, sol.vy);
      for (var i=0;i<200;i++) { g.step(1); if (g.snapshot().phase !== 'flying') break; }
      var s = g.snapshot();
      return {ok:true, phase:s.phase, reason:s.result && s.result.reason, goal:s.goal};
    })()""")
    check("终关: goal = spare", lose["goal"] == "spare", str(lose))
    check("终关: 射落留日金乌 -> 失败", lose["phase"] == "lost", str(lose))
    check("终关: 失败原因 = spare-killed（十日俱灭）",
          lose["reason"] == "spare-killed", str(lose))

    # 射落余烬日轮、留住金乌 -> 过关
    win = page.evaluate("""(function(){
      var g = window.__game;
      g.start(5); g.pause(true);
      var shots = 0, guard = 0;
      while (shots < 5 && guard++ < 24) {
        var s = g.snapshot();
        if (s.phase === 'won' || s.phase === 'lost') break;
        if (s.phase !== 'ready' || s.arrowInFlight) { g.step(60); continue; }
        var suns = g.bodies().filter(function(b){ return b.kind === 'rilun'; });
        if (!suns.length) break;
        var sol = g.solveAim(suns[0].x, suns[0].y, false);
        if (!sol) break;
        g.launch(sol.vx, sol.vy); shots++;
        for (var i=0;i<400;i++){ g.step(1); if (!g.state().arrowInFlight) break; }
        g.step(60);
      }
      var s2 = g.snapshot();
      return {shots:shots, phase:s2.phase, birds:s2.birdsAlive, suns:s2.sunsAlive,
              sunsKilled:s2.sunsKilled, arrowsLeft:s2.arrowsLeft,
              reason:s2.result && s2.result.reason};
    })()""")
    check("终关: 5 箭内熄灭全部余烬日轮", win["suns"] == 0, str(win))
    check("终关: 最后一只金乌仍在", win["birds"] == 1, str(win))
    check("终关: 留一日 -> 过关", win["phase"] == "won", str(win))


# =========================================================================
# D. demo 自驾（录制用）
# =========================================================================
def demo_suite(page):
    page.goto(URL_DEMO)
    page.wait_for_function("window.__ready === true", timeout=15000)
    page.wait_for_selector("#view-battle.is-active", timeout=8000)
    check("demo: 自动进入战场", True)
    shot(page, "09-demo-aim")
    page.wait_for_function(
        "['won','lost'].indexOf(window.__game.snapshot().phase) >= 0", timeout=40000)
    check("demo: 自驾打完第 1 关", True)
    page.wait_for_selector("#view-result.is-active", timeout=10000)
    check("demo: 自驾走到结算页", True)
    shot(page, "10-demo-result")


def main():
    errors = []
    art_probes = []

    def on_console(m):
        if m.type != "error":
            return
        url = (m.location or {}).get("url", "")
        # 素材接缝探测：art 尚未生成，assets/img/*.webp 缺失 -> 回落程序化轮廓（预期行为）
        if "ERR_FILE_NOT_FOUND" in m.text:
            art_probes.append(url)
            return
        errors.append("console: " + m.text + " @ " + url)

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", on_console)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        print("\n[A] 物理内核不回退")
        physics_suite(page, errors)
        print("\n[A2] 所见即所撞（渲染轮廓 == 碰撞轮廓）")
        silhouette_suite(browser)
        print("\n[B] 产品流程")
        flow_suite(page, errors)
        print("\n[C] 终关「留一日」")
        spare_suite(page)
        print("\n[D] demo 自驾")
        demo_suite(page)

        check("无 console / pageerror", len(errors) == 0, str(errors[:6]))
        browser.close()

    failed = [n for n, ok in CHECKS if not ok]
    print("\n%d/%d checks passed" % (len(CHECKS) - len(failed), len(CHECKS)))
    if failed:
        print("FAILED:")
        for n in failed:
            print("  - " + n)
        return 1
    print("screenshots -> " + str(SHOTS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
