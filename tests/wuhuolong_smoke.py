#!/usr/bin/env python3
"""Headless smoke suite for 舞火龙 (tools/wuhuolong).

Run: python3 tests/wuhuolong_smoke.py
     WH_ENGINE=webkit python3 tests/wuhuolong_smoke.py   # 双引擎（容器 iOS+Android 双端）
"""
import functools
import http.server
import os
import pathlib
import re
import socketserver
import subprocess
import sys
import threading

from playwright.sync_api import Error as PWError
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
INDEX = ROOT / "tools" / "wuhuolong" / "index.html"
TOOL_DIR = ROOT / "tools" / "wuhuolong"


def serve_tool():
    """Serve the tool over http.

    file:// taints the canvas the moment a bitmap is drawn into it, and every
    getImageData() below then throws SecurityError. http keeps it same-origin,
    which is also how the container actually loads the package.
    """
    handler = functools.partial(http.server.SimpleHTTPRequestHandler,
                                directory=str(TOOL_DIR))
    handler.log_message = lambda *a, **k: None
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d/index.html?test=1" % port


URL = INDEX.as_uri() + "?test=1"
PORTRAIT = {"width": 390, "height": 844}
LANDSCAPE = {"width": 844, "height": 390}
ENGINE = os.environ.get("WH_ENGINE", "chromium")

CHECKS = []


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok  " if cond else "  FAIL ") + name + ((" | " + str(extra)) if extra and not cond else ""))


def _wait(page, expr, timeout):
    try:
        page.wait_for_function(expr, timeout=timeout)
        return True
    except PWTimeout:
        return False


def main():
    errors = []
    if not INDEX.exists():
        print("ERROR: %s 不存在" % INDEX)
        return 2

    httpd, url = serve_tool()

    with sync_playwright() as p:
        browser = getattr(p, ENGINE).launch()
        page = browser.new_page(viewport=PORTRAIT)
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        page.goto(url, timeout=30000)

        print("\n[A] 骨架装载")
        check("window.WHData 就位", _wait(page, "!!window.WHData", 10000))
        check("window.WHRng 就位", page.evaluate("typeof window.WHRng === 'function'"))
        check("四个视图容器", page.evaluate("document.querySelectorAll('.view').length") == 4,
              page.evaluate("document.querySelectorAll('.view').length"))
        check("初始只有 boot 视图可见",
              page.evaluate("document.querySelectorAll('.view.on').length") == 1)
        for sel in ["#stage", "#hud-fire", "#hud-beat", "#btn-left", "#btn-right",
                    "#btn-jump", "#btn-thrust", "#btn-mute", "#result",
                    "#result-card", "#toast"]:
            check("关键节点存在 %s" % sel, page.evaluate("!!document.querySelector('%s')" % sel))

        print("\n[B] 随机数确定性与值域")
        seq = page.evaluate("(function(){var r=window.WHRng(1),o=[],i;for(i=0;i<6;i++)o.push(r.int(1,6));return o;})()")
        seq2 = page.evaluate("(function(){var r=window.WHRng(1),o=[],i;for(i=0;i<6;i++)o.push(r.int(1,6));return o;})()")
        check("同种子双跑一致", seq == seq2, "%s vs %s" % (seq, seq2))
        check("值域 1..6", all(1 <= v <= 6 for v in seq), seq)
        diff = page.evaluate("""(function(){
          var a = window.WHRng(1), b = window.WHRng(2), i, same = 0;
          for (i = 0; i < 6; i++) if (a.int(1,6) === b.int(1,6)) same++;
          return same;
        })()""")
        check("异种子产生差异（非恒定输出）", diff < 6, diff)

        print("\n[C] 数据表结构")
        d = page.evaluate("""(function(){
          var D = window.WHData;
          return { N: D.CHAIN.N, rooms: D.ROOMS.length, know: D.KNOW.length,
                   hasBoss: !!D.ROOMS[3].boss, pillars: D.ROOMS[2].pillars.length,
                   gates: [D.ROOMS[0].gate, D.ROOMS[1].gate, D.ROOMS[2].gate, D.ROOMS[3].gate],
                   widths: [D.ROOMS[0].w, D.ROOMS[1].w, D.ROOMS[2].w, D.ROOMS[3].w],
                   lx: [D.ROOMS[2].pillars[0].lx, D.ROOMS[2].pillars[1].lx],
                   seed: D.SEED,
                   pspd: D.PLAYER.SPEED, jump: D.PLAYER.JUMP_V, grav: D.PLAYER.GRAV,
                   pole: D.POLE.LEN, thrustW: D.ACT.THRUST_W, thrustCost: D.ACT.THRUST_COST,
                   mR: D.ENEMY.MIASMA_R, gR: D.ENEMY.GHOST_R, gS: D.ENEMY.GHOST_SPEED };
        })()""")
        check("龙身 32 节", d["N"] == 32, d["N"])
        check("四室", d["rooms"] == 4, d["rooms"])
        check("知识卡 11 条", d["know"] == 11, d["know"])
        check("末室为 Boss 室（无门，不能逃）",
              d["hasBoss"] is True and d["gates"][3] is False, d["gates"])
        check("前三室有门（清场才开）", d["gates"][:3] == [True, True, True], d["gates"])
        check("缠双柱室有 2 根柱", d["pillars"] == 2, d["pillars"])
        check("柱子用房间本地坐标 lx，且落在本室宽度内",
              all(0 < v < w for v, w in zip(d["lx"], [d["widths"][2]] * 2)),
              (d["lx"], d["widths"][2]))
        check("房间宽度为正", all(w > 0 for w in d["widths"]), d["widths"])
        check("测试种子 = 20260925", d["seed"] == 20260925, d["seed"])
        check("玩家物理参数就位（速度/跳速为正、重力为负）",
              d["pspd"] > 0 and d["jump"] > 0 and d["grav"] < 0,
              (d["pspd"], d["jump"], d["grav"]))
        check("竿长 / 竿刺宽 / 竿刺耗火 就位",
              d["pole"] > 0 and d["thrustW"] > 0 and d["thrustCost"] > 0,
              (d["pole"], d["thrustW"], d["thrustCost"]))
        check("敌人半径与移动速度就位",
              d["mR"] > 0 and d["gR"] > 0 and d["gS"] > 0, (d["mR"], d["gR"], d["gS"]))

        print("\n[D] 规范基线（静态自查）")
        html = INDEX.read_text(encoding="utf-8")
        css = (INDEX.parent / "assets" / "style.css").read_text(encoding="utf-8")
        check("无内联 <script>（全部外链）",
              not re.search(r"<script(?![^>]*\bsrc=)[^>]*>", html, re.I))
        check("无行内事件处理器", not re.search(r"\son[a-z]+\s*=", html, re.I))
        check("无 type=module", "type=\"module\"" not in html and "type='module'" not in html)
        check("无外部引用", not re.search(r"(?:src|href)\s*=\s*[\"']https?:", html, re.I))
        check("CSS 无 inset 简写", not re.search(r"(?m)^\s*inset\s*:", css))
        check("CSS 无 clamp()/dvh/aspect-ratio",
              not re.search(r"clamp\s*\(|\ddvh|aspect-ratio\s*:", css))
        check("CSS 无逻辑属性", not re.search(r"(margin|padding|inset)-(inline|block)", css))

        print("\n[E] 链式骨骼不变量（动画层规格 §6：I1/I2/I3/I5）")
        check("chain 模块就位", page.evaluate("typeof window.WHChain === 'object'"))
        check("节数 = 32", page.evaluate("window.WHChain.segments().length") == 32)

        drift = page.evaluate("""(function(){
          window.__wh.test.reset();
          window.__wh.test.settle(10000, 1/60);
          var d = window.__wh.test.debug(), max = 0, nan = 0, i, j;
          for (i = 0; i < d.world.length; i++)
            for (j = 0; j < 2; j++) {
              var v = d.world[i][j];
              if (!isFinite(v)) nan++;
              max = Math.max(max, Math.abs(v));
            }
          return { max: max, nan: nan, t: d.t };
        })()""")
        check("I3 万帧后坐标有界且无 NaN/Inf（无漂移）",
              drift["nan"] == 0 and drift["max"] < 500, drift)
        check("万帧后时间已累计（测试确实推进了）", drift["t"] > 160, drift["t"])

        err = page.evaluate("""(function(){
          var d = window.__wh.test.debug(), L = window.WHData.CHAIN.L, m = 0, i;
          for (i = 1; i < d.world.length; i++) {
            var dx = d.world[i][0]-d.world[i-1][0], dy = d.world[i][1]-d.world[i-1][1];
            m = Math.max(m, Math.abs(Math.sqrt(dx*dx+dy*dy) - L));
          }
          return m;
        })()""")
        check("链长守恒（相邻节间距偏差 < 1e-6）", err < 1e-6, err)

        flips = page.evaluate("""(function(){
          var w = window.__wh.test.debug().world, s = [], i, cr, f = 0;
          for (i = 1; i < w.length - 1; i++) {
            var ax = w[i][0]-w[i-1][0], ay = w[i][1]-w[i-1][1];
            var bx = w[i+1][0]-w[i][0], by = w[i+1][1]-w[i][1];
            cr = ax*by - ay*bx;
            s.push(cr > 1e-9 ? 1 : (cr < -1e-9 ? -1 : 0));
          }
          for (i = 0; i < s.length - 1; i++) if (s[i] && s[i+1] && s[i] !== s[i+1]) f++;
          return f;
        })()""")
        check("行波成立（沿身几何转角符号翻转 > 4）", flips > 4, flips)

        tens = page.evaluate("window.WHChain.tension()")
        check("龙身确有弯曲（张力 > 0）", tens > 0.001, tens)

        maxjump = page.evaluate("""(function(){
          var m = 0, i, prev = null;
          for (i = 1; i < 200; i++) {
            window.__wh.test.stepOnce(1/60);
            var a = window.__wh.test.debug().angles;
            if (prev) { var d = Math.abs(a[5] - prev[5]); if (d > m) m = d; }
            prev = a;
          }
          return m;
        })()""")
        mt = page.evaluate("window.WHData.CHAIN.MAXTURN")
        check("每节单帧转角不超过 MAXTURN(%.2f)" % mt, maxjump <= mt + 1e-9, maxjump)
        kink = page.evaluate("""(function(){
          var mx = 0, i, s, d;
          for (var k = 0; k < 300; k++) {
            window.__wh.test.stepOnce(1/60);
            s = window.WHChain.segments();
            for (i = 1; i < s.length; i++) {
              d = Math.abs(s[i].angle - s[i-1].angle);
              if (d > mx) { mx = d; }
            }
          }
          return mx;
        })()""")
        check("相邻节几何转角硬性 <= MAXTURN(%.2f)（结构上不可能出现锐角硬折，蛇形必平滑）" % mt,
              kink <= mt + 1e-9, (kink, mt))

        wrapn = page.evaluate("""(function(){
          window.__wh.test.reset();
          window.__wh.test.settle(60, 1/60);
          var segs = window.WHChain.segments();
          var mid = segs[16];
          var n = window.__wh.test.wrap([{ x: mid.x, y: mid.y, r: 3.2 }]);
          return { n: n, at: [Math.round(mid.x * 10) / 10, Math.round(mid.y * 10) / 10] };
        })()""")
        check("缠柱返回缠缚节数（>=1）", wrapn["n"] >= 1, wrapn)

        after = page.evaluate("""(function(){
          var d = window.__wh.test.debug(), L = window.WHData.CHAIN.L, m = 0, i;
          for (i = 1; i < d.world.length; i++) {
            var dx = d.world[i][0]-d.world[i-1][0], dy = d.world[i][1]-d.world[i-1][1];
            m = Math.max(m, Math.abs(Math.sqrt(dx*dx+dy*dy) - L));
          }
          return m;
        })()""")
        check("缠柱后链长仍守恒（脱离不留残形）", after < 1e-6, after)

        print("\n[F] 香火粒子（对象池 + 发光，运行期零分配）")
        check("WHFire 模块就位", page.evaluate("typeof window.WHFire === 'object'"))
        pooled = page.evaluate("""(function(){
          window.WHFire.init(document.createElement('canvas'));
          return window.WHFire.debug().pooled;
        })()""")
        expect_pool = page.evaluate("window.WHData.FIRE.POOL")
        check("对象池按 WHData.FIRE.POOL 预分配 (%d)" % expect_pool, pooled == expect_pool, pooled)

        alive_after = page.evaluate("""(function(){
          window.WHFire.emit(window.WHChain.segments(), 2);
          return window.WHFire.debug().alive;
        })()""")
        check("发射后 alive > 0", alive_after > 0, alive_after)

        det = page.evaluate("""(function(){
          window.WHFire.init(document.createElement('canvas'));
          window.WHFire.emit(window.WHChain.segments(), 2);
          var a = window.WHFire.debug().first;
          window.WHFire.init(document.createElement('canvas'));
          window.WHFire.emit(window.WHChain.segments(), 2);
          var b = window.WHFire.debug().first;
          return { a: a, b: b, same: !!a && !!b && a.x === b.x && a.y === b.y && a.r === b.r };
        })()""")
        check("同种子重新 init 后粒子状态一致（确定性）", det["same"], det)

        storm = page.evaluate("""(function(){
          var segs = window.WHChain.segments(), i;
          for (i = 0; i < 500; i++) { window.WHFire.emit(segs, 2); window.WHFire.step(1 / 60); }
          var d = window.WHFire.debug();
          return { pooled: d.pooled, alive: d.alive };
        })()""")
        check("狂发 500 轮后对象池不增长", storm["pooled"] == expect_pool, storm)
        check("alive 不超过池容量", storm["alive"] <= expect_pool, storm)

        expire = page.evaluate("""(function(){
          var i;
          for (i = 0; i < 200; i++) { window.WHFire.step(1 / 60); }
          return window.WHFire.debug().alive;
        })()""")
        check("停止发射后粒子全部过期（alive = 0）", expire == 0, expire)

        pw = page.evaluate("""(function(){
          var lo = window.WHFire.intensity(0);
          var zero = window.WHFire.debug().power;
          var hi = window.WHFire.intensity(1);
          var one = window.WHFire.debug().power;
          return { lo: lo, zero: zero, hi: hi, one: one };
        })()""")
        check("intensity(0) = INTENSITY_MIN(0.25)", abs(pw["lo"] - 0.25) < 1e-9 and abs(pw["zero"] - 0.25) < 1e-9, pw)
        check("intensity(1) = 1", abs(pw["hi"] - 1) < 1e-9 and abs(pw["one"] - 1) < 1e-9, pw)

        print("\n[G] 夜景剪影 + 摄像机")
        check("WHScene 模块就位", page.evaluate("typeof window.WHScene === 'object'"))
        scen = page.evaluate("""(function(){
          window.WHScene.init(document.getElementById('stage'));
          return window.WHScene.scenery();
        })()""")
        check("场景元素已生成（星/远山/街巷/雾烟）",
              scen["stars"] > 0 and scen["hills"] > 0 and scen["blocks"] > 0 and scen["fog"] > 0, scen)

        met = page.evaluate("window.WHScene.metrics()")
        camY = page.evaluate("window.WHData.CAM.Y")
        check("groundY = H × CAM.Y(%.2f)" % camY,
              abs(met["groundY"] - met["H"] * camY) < 1e-6, met)
        expect_px = page.evaluate("window.WHData.CAM.SCALE")
        check("px = CAM.SCALE × (W/390)（W=390 时 = %.1f）" % expect_px,
              abs(met["px"] - expect_px) < 1e-6, met["px"])

        cam = page.evaluate("""(function(){
          var a = window.WHScene.camera(0);
          var b = window.WHScene.camera(100);
          return { a: a, b: b, d: b - a };
        })()""")
        check("camera 单调：位移 100 单位 → camX +100", abs(cam["d"] - 100) < 1e-6, cam)

        shot = page.evaluate("""(function(){
          var cv = document.getElementById('stage');
          var c = cv.getContext('2d');
          window.WHScene.camera(0);
          window.WHScene.drawBack(c, null, 0);
          var d = c.getImageData(0, 0, cv.width, cv.height).data;
          var sum = 0, n = 0, levels = {}, i, lum;
          for (i = 0; i < d.length; i += 4 * 37) {
            lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
            sum += lum; n += 1;
            levels[Math.round(lum / 8)] = 1;
          }
          return { mean: sum / n, levels: Object.keys(levels).length };
        })()""")
        check("drawBack 画面非纯黑（mean lum > 3）", shot["mean"] > 3, shot)
        check("drawBack 有层次（亮度层级 > 8）", shot["levels"] > 8, shot)

        check("metrics 报出的 px 与 CAM.SCALE 一致",
              abs(met["px"] - expect_px) < 1e-6, (met["px"], expect_px))

        det2 = page.evaluate("""(function(){
          window.WHScene.init(document.getElementById('stage'));
          var a = window.WHScene.scenery();
          window.WHScene.init(document.getElementById('stage'));
          var b = window.WHScene.scenery();
          return { a: a, b: b, same: a.stars === b.stars && a.hills === b.hills && a.blocks === b.blocks && a.fog === b.fog };
        })()""")
        check("重复 init 场景确定（无 Math.random 漂移）", det2["same"], det2)

        print("\n[H] 视觉门 D4 · 客观像素指标")
        main_src = (INDEX.parent / "assets" / "main.js").read_text(encoding="utf-8")
        offenders = []
        for blk in re.split(r"\n(?=  function )", main_src):
            m = re.match(r"  function (\w+)", blk)
            if not m or "ctx.drawImage(" not in blk:
                continue
            if m.group(1) not in ("drawSprite", "drawFrame", "drawAppendages", "drawBloom"):
                offenders.append(m.group(1))
        check("图片只画在 drawSprite／drawFrame（同为反翻世界空间）／drawAppendages／drawBloom 里",
              not offenders, offenders)
        check("七件素材已加载（龙头/尾/爪 + 主角/瘟鬼/疫气/打击特效）",
              _wait(page, "(function(){var a=window.__wh.assets();return a.head&&a.tail&&a.claw&&a.man&&a.ghost&&a.miasma&&a.fxhit;})()", 15000),
              page.evaluate("window.__wh.assets()"))
        pix = page.evaluate("""(function(){
          var cv = document.getElementById('stage');
          window.__wh.test.reset();
          window.__wh.test.settle(150, 1/60);
          window.__wh.test.render();
          var c = cv.getContext('2d');
          var d = c.getImageData(0, 0, cv.width, cv.height).data;
          var w = cv.width, h = cv.height;
          var n = 0, black = 0, orange = 0, sum = 0, raw = {}, i, r, g, b, lum;
          for (i = 0; i < d.length; i += 44) {
            r = d[i]; g = d[i+1]; b = d[i+2];
            lum = (r*299 + g*587 + b*114) / 1000;
            sum += lum; n += 1;
            raw[Math.round(lum)] = 1;
            if (r < 8 && g < 8 && b < 8) { black += 1; }
            if (r > 120 && r > g + 30 && g > b) { orange += 1; }
          }
          function colLum(x, y) {
            var o = (y * w + x) * 4;
            return (d[o]*299 + d[o+1]*587 + d[o+2]*114) / 1000;
          }
          var skyH = Math.round(h * 0.3), meds = [], y, x, vals, j;
          var maxJump = 0;
          for (y = 1; y < skyH; y++) {
            vals = [];
            for (x = 4; x < w; x += 23) { vals.push(colLum(x, y)); }
            vals.sort(function (p, q) { return p - q; });
            meds.push(vals[Math.floor(vals.length / 2)]);
          }
          for (y = 1; y < meds.length; y++) {
            j = Math.abs(meds[y] - meds[y - 1]);
            if (j > maxJump) { maxJump = j; }
          }
          return { mean: sum/n, blackPct: 100*black/n, orangePct: 100*orange/n,
                   rawLevels: Object.keys(raw).length, maxJump: maxJump, w: w, h: h };
        })()""")
        check("画面非纯黑（black% < 40）", pix["blackPct"] < 40, pix)
        check("有暖色火光（橙色像素 0.4%–12%）", 0.4 <= pix["orangePct"] <= 12, pix)
        check("无 banding：纯天空区行中位数相邻跳变 <= 3", pix["maxJump"] <= 3, pix)
        check("暗夜调色板仍有足够层次（原始亮度层级 > 100）", pix["rawLevels"] > 100, pix)

        geo = page.evaluate("""(function(){
          var cv = document.getElementById('stage');
          var c = cv.getContext('2d');
          var d = c.getImageData(0, 0, cv.width, cv.height).data;
          var w = cv.width, h = cv.height;
          function lumAt(x, y) {
            var xi = Math.round(x), yi = Math.round(y);
            if (xi < 0 || yi < 0 || xi >= w || yi >= h) { return -1; }
            var o = (yi * w + xi) * 4;
            return (d[o]*299 + d[o+1]*587 + d[o+2]*114) / 1000;
          }
          var m = window.WHScene.metrics();
          var segs = window.WHChain.segments();
          var xs = [], ys = [], arcPx = 0, i, sx, sy, dx, dy;
          for (i = 0; i < segs.length; i++) {
            sx = (segs[i].x - m.camX) * m.px;
            sy = m.groundY - segs[i].y * m.px;
            xs.push(sx); ys.push(sy);
          }
          for (i = 1; i < xs.length; i++) {
            dx = xs[i] - xs[i-1]; dy = ys[i] - ys[i-1];
            arcPx += Math.sqrt(dx*dx + dy*dy);
          }
          var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs);
          var miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
          var pad = 52;
          var x0 = Math.max(0, Math.round(minx - pad)), x1 = Math.min(w - 1, Math.round(maxx + pad));
          var y0 = Math.max(0, Math.round(miny - pad)), y1 = Math.min(h - 1, Math.round(maxy + pad));
          var vals = [], blown = 0, x, y, l;
          for (y = y0; y <= y1; y++) {
            for (x = x0; x <= x1; x++) {
              l = lumAt(x, y); vals.push(l); if (l > 210) { blown++; }
            }
          }
          var mean = 0, sd = 0;
          for (i = 0; i < vals.length; i++) { mean += vals[i]; }
          mean /= vals.length;
          for (i = 0; i < vals.length; i++) { sd += (vals[i] - mean) * (vals[i] - mean); }
          sd = Math.sqrt(sd / vals.length);
          var pls = window.WHPlayer.snapshot();
          var plrx = window.WHGame.bounds(window.WHGame.snapshot().room).x0 + pls.x;
          var plpx = (plrx - m.camX) * m.px;
          var plpy = m.groundY - (pls.y + 1.8) * m.px;
          var pPad = 64;
          var fb = 0, fOn = 0, x2, y2, l2, onD, onP;
          var outside = [];
          var ox0 = 1e9, oy0 = 1e9, ox1 = -1e9, oy1 = -1e9;
          for (y2 = 0; y2 < h; y2 += 2) {
            for (x2 = 0; x2 < w; x2 += 2) {
              l2 = lumAt(x2, y2);
              if (l2 > 210) {
                fb++;
                onD = (x2 >= x0 && x2 <= x1 && y2 >= y0 && y2 <= y1);
                onP = (Math.abs(x2 - plpx) <= pPad && Math.abs(y2 - plpy) <= pPad * 1.7);
                if (onD || onP) { fOn++; }
                else {
                  if (x2 < ox0) { ox0 = x2; }
                  if (x2 > ox1) { ox1 = x2; }
                  if (y2 < oy0) { oy0 = y2; }
                  if (y2 > oy1) { oy1 = y2; }
                  if (outside.length < 10) { outside.push([x2, y2, Math.round(l2)]); }
                }
              }
            }
          }
          var spanMax = (maxx - minx) / w * 100;
          for (var ph = 0; ph < 3; ph++) {
            window.__wh.test.settle(60, 1/60);
            var s2 = window.WHChain.segments(), sxs = [], ii;
            for (ii = 0; ii < s2.length; ii++) { sxs.push((s2[ii].x - m.camX) * m.px); }
            var sp = (Math.max.apply(null, sxs) - Math.min.apply(null, sxs)) / w * 100;
            if (sp > spanMax) { spanMax = sp; }
          }
          var diag = Math.sqrt((maxx-minx)*(maxx-minx) + (maxy-miny)*(maxy-miny));
          return { spanPct: spanMax, minx: minx, maxx: maxx,
                   miny: miny, maxy: maxy, groundY: m.groundY, W: w, H: h,
                   vSpanPct: (maxy - miny) / h * 100, elong: arcPx / Math.max(diag, 1),
                   blowPct: 100 * blown / vals.length, cv: sd / mean,
                   outBox: (ox1 < 0) ? null : [ox0, oy0, ox1, oy1],
                   outSample: outside,
                   dragonBox: [x0, y0, x1, y1],
                   plBox: [Math.round(plpx), Math.round(plpy)],
                   blownOnDragon: fb ? 100 * fOn / fb : 0 };
        })()""")
        check("龙身横向铺开（多相位最大跨度 >= 35% 屏宽，不是缩成一团）", geo["spanPct"] >= 35, geo)
        check("曲率在 sanity 区间（1.03-1.45；~1.0=直线，远大于 1.45=盘成一团；\n              平滑度由几何 MAXTURN 断言保证，审美由 vision 门禁判）",
              1.03 <= geo["elong"] <= 1.45, geo)
        check("龙尾在屏内（minx > -10）", geo["minx"] > -10, geo)
        check("龙头在屏内（maxx < W + 10）", geo["maxx"] < geo["W"] + 10, geo)
        check("龙身不沉入街面（最低点 <= 地面 + 8px）", geo["maxy"] <= geo["groundY"] + 8, geo)
        check("龙身纵向摆幅受控（< 30% 屏高）", geo["vSpanPct"] < 30, geo)
        check("龙身不飞出屏幕顶部（miny > 0）", geo["miny"] > 0, geo)
        check("龙身有暖色高光但不过曝成白砖（框内过曝 0.5%-60%）",
              0.5 <= geo["blowPct"] <= 60, geo)
        check("香火有疏密层次（框内亮度 CV > 0.6）", geo["cv"] > 0.6, geo)
        check("最亮部分以主角群为主（过曝 >= 70% 落在龙身/玩家框内；其余为龙珠与围观灯火）",
              geo["blownOnDragon"] >= 70, geo)

        print("\n[I] 房间式横版：玩家主权 / 清场开门 / 相机夹取")
        page.evaluate("window.__wh.test.pause()")
        check("game 模块就位", page.evaluate("typeof window.WHGame === 'object'"))
        check("player 模块就位", page.evaluate("typeof window.WHPlayer === 'object'"))
        pspd = page.evaluate("window.WHData.PLAYER.SPEED")
        pjump = page.evaluate("window.WHData.PLAYER.JUMP_V")
        pgrav = page.evaluate("window.WHData.PLAYER.GRAV")

        boot = page.evaluate("(function(){ window.__wh.game.reset(); return window.__wh.game.snapshot(); })()")
        check("复位后相位 = boot（未起龙）", boot["phase"] == "boot", boot["phase"])
        check("复位后香火上膛 100", abs(boot["fire"] - 100) < 1e-9, boot["fire"])

        st = page.evaluate("window.__wh.game.start()")
        check("起龙后相位 = play", st["phase"] == "play", st["phase"])
        check("起龙即第一室「开光」", st["roomId"] == "kaiguang", st["roomId"])
        check("起龙即满香火 100", abs(st["fire"] - 100) < 1e-9, st["fire"])

        idle = page.evaluate("""(function(){
          window.__wh.game.start();
          var x0 = window.__wh.game.snapshot().player.x;
          window.__wh.game.settle(900, 1/60);
          var s = window.__wh.game.snapshot();
          return { x0: x0, x1: s.player.x, room: s.roomId, t: s.t };
        })()""")
        check("★ 无输入时原地不动（用户否决 v1 跑酷的那一条）",
              abs(idle["x1"] - idle["x0"]) < 1e-6, idle)
        check("★ 无输入 15s 仍停第一室（不会自己推进）",
              idle["room"] == "kaiguang" and idle["t"] > 14.9, idle)

        move = page.evaluate("""(function(){
          window.__wh.game.start();
          var x0 = window.__wh.game.snapshot().player.x;
          window.__wh.game.press("right");
          window.__wh.game.settle(60, 1/60);
          var xr = window.__wh.game.snapshot().player.x;
          window.__wh.game.releaseAll();
          window.__wh.game.press("left");
          window.__wh.game.settle(30, 1/60);
          var s = window.__wh.game.snapshot();
          window.__wh.game.releaseAll();
          return { x0: x0, xr: xr, xl: s.player.x, facing: s.player.facing };
        })()""")
        check("按右 1s 前进约 PLAYER.SPEED", abs((move["xr"] - move["x0"]) - pspd) < 0.6, move)
        check("按左后退且朝向翻转为 -1", move["xl"] < move["xr"] and move["facing"] == -1, move)

        jump = page.evaluate("""(function(){
          window.__wh.game.start();
          var peak = 0, i, s, landed = -1;
          window.__wh.game.press("jump");
          for (i = 0; i < 300; i++) {
            window.__wh.game.step(1/60);
            s = window.__wh.game.snapshot();
            if (s.player.y > peak) { peak = s.player.y; }
            if (i === 2) { window.__wh.game.release("jump"); }
            if (i > 4 && s.player.onGround && landed < 0) { landed = i; }
          }
          return { peak: peak, landed: landed, y: s.player.y, onGround: s.player.onGround };
        })()""")
        check("跳跃离地（峰值 > 1 单位）", jump["peak"] > 1.0, jump)
        check("跳跃落回地面（y 回 0 且 onGround）",
              abs(jump["y"]) < 1e-6 and jump["onGround"] is True, jump)
        expect_peak = pjump * pjump / (2 * abs(pgrav))
        check("峰值符合 JUMP_V^2/(2|GRAV|) = %.2f" % expect_peak,
              abs(jump["peak"] - expect_peak) < 0.3, (jump["peak"], expect_peak))

        dbl = page.evaluate("""(function(){
          window.__wh.game.start();
          window.__wh.game.press("jump");
          window.__wh.game.settle(8, 1/60);
          window.__wh.game.release("jump");
          var vyMid = window.__wh.game.snapshot().player.vy;
          window.__wh.game.press("jump");
          window.__wh.game.settle(1, 1/60);
          var s = window.__wh.game.snapshot();
          return { vyMid: vyMid, vy: s.player.vy, y: s.player.y };
        })()""")
        expect_vy = pjump - abs(pgrav) * 9 / 60.0
        check("空中按跳不重置 vy：续弹道到 %.2f（二段跳会跳回 %.1f）" % (expect_vy, pjump),
              abs(dbl["vy"] - expect_vy) < 0.25 and dbl["vy"] < pjump - 1.0, dbl)

        wall = page.evaluate("""(function(){
          window.__wh.game.start();
          window.__wh.game.press("left");
          window.__wh.game.settle(600, 1/60);
          var a = window.__wh.game.snapshot();
          window.__wh.game.releaseAll();
          return { xmin: a.player.x, room: a.roomId };
        })()""")
        check("左边界夹住（走不出房间左侧）", wall["xmin"] >= 0.34, wall)

        pl = page.evaluate("""(function(){
          window.__wh.game.start();
          return { a: window.WHGame.floorAt(4.2), b: window.WHGame.floorAt(1.0),
                   c: window.WHGame.floorAt(7.0),
                   n: window.__wh.game.snapshot().plats.length };
        })()""")
        check("房间带平台数据（结构与房名对应）", pl["n"] >= 1, pl)
        check("★ 平台抬高该处地面：开光台阶 lx4.2→1.5、lx7.0→2.9、空地 lx1.0→0",
              abs(pl["a"] - 1.5) < 1e-6 and abs(pl["b"]) < 1e-6 and abs(pl["c"] - 2.9) < 1e-6, pl)

        camroom = page.evaluate("""(function(){
          window.__wh.game.start();
          var bad = 0, i, s, sc, b, m, lo, hi, viewW, cx = 0;
          for (i = 0; i < 1200; i++) {
            window.__wh.game.press("right");
            window.__wh.game.step(1/60);
            if (i % 25 === 0) {
              window.__wh.game.render();
              s = window.__wh.game.snapshot();
              sc = window.__wh.game.scene();
              b = window.__wh.game.bounds(s.room);
              m = sc.m;
              viewW = m.W / m.px;
              lo = b.x0;
              hi = b.x1 - viewW;
              if (hi >= lo && (m.camX < lo - 1e-6 || m.camX > hi + 1e-6)) { bad++; }
              cx = m.camX;
            }
          }
          return { bad: bad, camX: cx, lo: lo, hi: hi, viewW: viewW, room: s.roomId };
        })()""")
        check("★ 相机被夹在房间内（不再无限滚动）", camroom["bad"] == 0, camroom)

        gate = page.evaluate("""(function(){
          window.__wh.game.start();
          var i, s, bad = 0, samples = 0, opened = 0, entered = [], last = "";
          for (i = 0; i < 9000; i++) {
            window.__wh.game.press("right");
            window.__wh.game.step(1/60); window.__wh.game.addFire(1);
            s = window.__wh.game.snapshot();
            if (s.roomId !== last) { entered.push(s.roomId); last = s.roomId; }
            if (s.boss) { break; }
            if (s.gateOpen) { opened++; }
            else {
              samples++;
              if (s.player.x >= s.roomW - 0.4) { bad++; }
            }
          }
          window.__wh.game.releaseAll();
          return { bad: bad, samples: samples, opened: opened,
                   entered: entered, room: s.roomId };
        })()""")
        check("★ 门关着时玩家绝不越过右边界（采样不变量，非单点）",
              gate["bad"] == 0 and gate["samples"] > 0, gate)
        check("清场后门确实开过（gateOpen 采样 > 0）", gate["opened"] > 0, gate)

        swept = page.evaluate("""(function(){
          window.__wh.game.start();
          var i, s, idleKills;
          window.__wh.game.settle(180, 1/60);
          s = window.__wh.game.snapshot();
          idleKills = s.kills.miasma + s.kills.ghost;
          window.__wh.game.setAuto(true);
          for (i = 0; i < 900; i++) { window.__wh.game.step(1/60); window.__wh.game.addFire(1); }
          s = window.__wh.game.snapshot();
          return { idleKills: idleKills, movedX: s.player.x, room: s.roomId };
        })()""")
        check("站立不动不刷击杀（龙身不是常驻伤害区）", swept["idleKills"] == 0, swept)

        thrust = page.evaluate("""(function(){
          window.__wh.game.start();
          var a = window.__wh.game.action("thrust");
          var b = window.__wh.game.action("thrust");
          var f0 = window.__wh.game.fire();
          window.__wh.game.settle(30, 1/60);
          var c = window.__wh.game.action("thrust");
          var f1 = window.__wh.game.fire();
          return { a: a, b: b, c: c, cost: f0 - f1 };
        })()""")
        check("竿刺首下成功、冷却内被拒", thrust["a"] is True and thrust["b"] is False, thrust)
        check("冷却后竿刺再次可用", thrust["c"] is True, thrust)
        check("竿刺消耗香火（THRUST_COST）", thrust["cost"] > 0, thrust)

        tail = page.evaluate("""(function(){
          window.__wh.game.start();
          var a = window.__wh.game.action("tail");
          var b = window.__wh.game.action("tail");
          var f0 = window.__wh.game.fire();
          window.__wh.game.settle(60, 1/60);
          var c = window.__wh.game.action("tail");
          var f1 = window.__wh.game.fire();
          return { a: a, b: b, c: c, cost: f0 - f1 };
        })()""")
        check("甩尾首下成功、冷却内被拒", tail["a"] is True and tail["b"] is False, tail)
        check("甩尾冷却后再次可用", tail["c"] is True, tail)
        check("甩尾耗香火（TAIL_COST）", tail["cost"] > 0, tail)

        two = page.evaluate("""(function(){
          window.__wh.game.start();
          window.__wh.game.setAuto(true);
          var i, s, swept = 0, jabbed = 0;
          window.WHGame.setCallback("tail", function (h) { if (h && h.hits > 0) { swept += h.hits; } });
          window.WHGame.setCallback("thrust", function (h) { if (h && h.hits > 0) { jabbed += h.hits; } });
          for (i = 0; i < 30000; i++) {
            window.__wh.game.step(1/60); window.WHGame.addFire(3);
            if (i % 30 === 0) { window.__wh.game.action("thrust"); }
            if (i % 90 === 0) { window.__wh.game.action("tail"); }
            s = window.WHGame.snapshot();
            if (s.roomId === "chanshuang" && s.enemies === 0) break;
          }
          return { swept: swept, jabbed: jabbed, room: s.roomId };
        })()""")
        check("★ 两种攻击都能命中（不是只有一种出招）",
              two["swept"] > 0 and two["jabbed"] > 0, two)

        hurtfx = page.evaluate("""(function(){
          window.__wh.game.start();
          window.__wh.game.setAuto(true);
          var i, s, saw = 0, peak = 0, f;
          for (i = 0; i < 12000; i++) {
            window.__wh.game.step(1/60); window.WHGame.addFire(3);
            f = window.__wh.fxState();
            if (f.hurt > 0) { saw += 1; }
            if (f.hurt > peak) { peak = f.hurt; }
            s = window.WHGame.snapshot();
            if (saw > 0) break;
          }
          return { saw: saw, peak: +peak.toFixed(2), room: s.roomId };
        })()""")
        check("被怪撞到时有受击反馈（红闪 + 震动的量被触发）",
              hurtfx["saw"] > 0 and hurtfx["peak"] > 0.4, hurtfx)

        combo = page.evaluate("""(function(){
          window.__wh.game.start();
          var i, seen = [];
          var cb = function (h) { seen.push(h.finisher ? 3 : h.combo); };
          window.WHGame.setCallback("thrust", cb);
          for (i = 0; i < 40; i++) {
            window.__wh.game.action("thrust");
            window.__wh.game.settle(26, 1/60);
          }
          return { seen: seen };
        })()""")
        check("★ 竿刺三连成立（第 3 下被判为重击 finisher）",
              3 in combo["seen"], combo["seen"][:9])
        check("连招按下数递增（1→2→3 循环，不是恒为 1）",
              combo["seen"][:3] == [1, 2, 3], combo["seen"][:6])

        playt = page.evaluate("""(function(){
          window.__wh.game.start();
          window.__wh.game.setAuto(true);
          var i, s, seen = [], last = "";
          for (i = 0; i < 60000; i++) {
            window.__wh.game.step(1/60);
            window.__wh.game.addFire(2);
            s = window.__wh.game.snapshot();
            if (s.roomId !== last) { seen.push(s.roomId); last = s.roomId; }
            if (s.phase !== "play") { break; }
          }
          return { seen: seen, phase: s.phase, roomsCleared: s.roomsCleared, t: s.t,
                   kills: s.kills, purify: s.bossState ? s.bossState.purify : null,
                   purified: s.bossState ? s.bossState.purified : null,
                   steps: i };
        })()""")
        check("四室按序推进（开光→过桥→缠双柱→结团圆）",
              playt["seen"] == ["kaiguang", "guoqiao", "chanshuang", "tuanyuan"], playt["seen"])
        check("清场推进计数 = 3（前三室各清一次）", playt["roomsCleared"] == 3, playt)
        check("末室决斗净化到满 → 相位转 return（龙归天）",
              playt["phase"] == "return" and playt["purified"] is True, playt)

        nokill = page.evaluate("""(function(){
          window.__wh.game.start();
          var i;
          for (i = 0; i < 20000; i++) {
            window.__wh.game.step(1/60);
            if (window.__wh.game.snapshot().phase !== "play") { break; }
          }
          return window.__wh.game.snapshot();
        })()""")
        check("不杀敌（无回火）香火耗尽 -> fail（香火即命）",
              nokill["phase"] == "fail", (nokill["phase"], nokill["t"]))

        hud = page.evaluate("""(function(){
          window.__wh.game.start();
          window.__wh.game.render();
          return { h: window.__wh.game.hud(), room: window.__wh.game.snapshot().roomName };
        })()""")
        check("HUD 显示房名且带 .on（否则 opacity:0 永远看不见）",
              hud["h"]["beatOn"] == "on" and hud["room"] in hud["h"]["beat"], hud)
        m_scale = re.search(r"scaleX\(([0-9.]+)\)", hud["h"]["scale"] or "")
        check("HUD 香火条与资源一致（scaleX 数值 == data-fire）",
              bool(m_scale) and abs(float(m_scale.group(1)) - float(hud["h"]["fire"])) < 1e-3,
              hud["h"])

        print("\n[J] 瘟神 Boss：三阶段 / 竿刺+缠缚净化 / 决斗转归天")
        check("boss 模块就位", page.evaluate("typeof window.WHBoss === 'object'"))
        tdmg = page.evaluate("window.WHData.BOSS.THRUST_DMG")
        odmg = page.evaluate("window.WHData.BOSS.ORB_DMG")

        bmod = page.evaluate("""(function(){
          window.WHBoss.reset();
          window.WHBoss.spawn(0, 2);
          var s0 = window.WHBoss.snapshot();
          var g = [], i;
          for (i = 0; i < 20; i++) {
            window.WHBoss.thrustHit(false);
            var s = window.WHBoss.snapshot();
            g.push([s.purify, s.phaseIdx]);
          }
          return { s0: s0, g: g, fin: window.WHBoss.snapshot() };
        })()""")
        check("瘟神起手 wake 且未净化",
              bmod["s0"]["mode"] == "wake" and bmod["s0"]["purify"] == 0, bmod["s0"])
        check("竿刺每次净化 THRUST_DMG(%d)" % tdmg, bmod["g"][0][0] == tdmg, bmod["g"][:3])
        check("净化 32 / 66 处阶段跃迁 0 -> 1 -> 2",
              bmod["g"][5][1] == 1 and bmod["g"][10][1] == 2,
              [bmod["g"][5], bmod["g"][10]])
        check("净化满即 purified", bmod["fin"]["purified"] is True, bmod["fin"])

        wr = page.evaluate("""(function(){
          window.WHBoss.reset();
          window.WHBoss.spawn(0, 2);
          var p0 = window.WHBoss.snapshot().purify;
          window.WHBoss.thrustHit(true);
          var p1 = window.WHBoss.snapshot().purify;
          return { gain: p1 - p0, tdmg: window.WHData.BOSS.THRUST_DMG };
        })()""")
        check("缠缚中竿刺释放龙珠，净化 ORB_DMG(%d) > THRUST_DMG(%d)" % (odmg, tdmg),
              wr["gain"] == odmg and odmg > tdmg, wr)

        duel = page.evaluate("""(function(){
          window.__wh.game.start();
          window.__wh.game.setAuto(true);
          var i, s, modes = [], last = "", bad = 0, minD = 1e9, wrapFrames = 0;
          var hurtSeen = 0, woke = false;
          for (i = 0; i < 60000; i++) {
            window.__wh.game.step(1/60);
            window.__wh.game.addFire(2);
            s = window.__wh.game.snapshot();
            if (s.roomId !== "tuanyuan") { continue; }
            if (s.wrapSegs > 0) { wrapFrames++; }
            if (s.bossState && s.bossState.hurtDealt > 0) { hurtSeen = s.bossState.hurtDealt; }
            if (s.bossState && s.bossState.active) {
              woke = true;
              var dx = s.bossState.x - s.head.x, dy = s.bossState.y - s.head.y;
              var dd = Math.sqrt(dx * dx + dy * dy);
              if (dd < minD) { minD = dd; }
              if (s.bossState.mode !== last) {
                if ((s.bossState.mode === "lunge" || s.bossState.mode === "dive")
                    && last !== "telegraph") { bad++; }
                modes.push(s.bossState.mode);
                last = s.bossState.mode;
              }
            }
            if (s.phase !== "play") { break; }
          }
          return { modes: modes, bad: bad, minD: minD, wrapFrames: wrapFrames,
                   hurtSeen: hurtSeen, phase: s.phase, woke: woke,
                   purified: s.bossState ? s.bossState.purified : null,
                   hits: s.bossState ? s.bossState.hitsLanded : null };
        })()""")
        check("进入「结团圆」自动开决斗（Boss 激活）", duel["woke"] is True, duel)
        check("无预警不突进：lunge/dive 前必先 telegraph",
              duel["bad"] == 0 and "telegraph" in duel["modes"], duel["modes"])
        check("瘟神真能冲到龙身边（minD 小于缠缚半径量级）", duel["minD"] < 6.0, duel)
        check("缠缚能缠上瘟神（wrapSegs > 0 的帧数 > 0）", duel["wrapFrames"] > 0, duel)
        check("竿刺能净化瘟神（hitsLanded > 0）", (duel["hits"] or 0) > 0, duel)
        check("瘟神突进能打中玩家（hurtDealt > 0，不是纯沙包）",
              duel["hurtSeen"] > 0, duel)
        check("净化满 -> purified 且相位转 return（龙归天）",
              duel["purified"] is True and duel["phase"] == "return", duel)

        print("\n[K] 归天终章 + 分享卡")
        check("share 模块就位", page.evaluate("typeof window.WHShare === 'object'"))
        check("分享卡容器存在", page.evaluate("!!document.getElementById('result-card')"))

        end = page.evaluate("""(function(){
          window.__wh.game.start();
          window.__wh.game.setAuto(true);
          var i, s, sawReturn = false, done = false;
          window.WHGame.setCallback("done", function () { done = true; });
          for (i = 0; i < 60000; i++) {
            window.__wh.game.step(1/60);
            window.__wh.game.addFire(2);
            s = window.__wh.game.snapshot();
            if (s.phase === "return") { sawReturn = true; }
            if (done) { break; }
          }
          var list = window.WHGame.enemiesRaw();
          var alive = [];
          for (i = 0; i < list.length; i++) {
            if (list[i].alive) { alive.push([list[i].kind, +list[i].x.toFixed(2), +list[i].y.toFixed(2)]); }
          }
          return { sawReturn: sawReturn, done: done, phase: s.phase,
                   returnT: s.returnT, steps: i, room: s.roomId,
                   enemies: s.enemies, playerX: +s.player.x.toFixed(2), roomW: s.roomW,
                   playerVx: s.player.vx, alive: alive };
        })()""")
        check("净化后进入归天相位（return）", end["sawReturn"] is True, end)
        check("归天播完才触发 done（不是净化完立刻切页）", end["done"] is True, end)
        check("归天有时长（returnT >= 3.4 才 done）", end["returnT"] >= 3.4, end)

        card = page.evaluate("""(function(){
          var uri = window.WHShare.dataUrl(window.WHGame.snapshot());
          return { len: uri.length,
                   png: uri.indexOf("data:image/png;base64,") === 0,
                   bridge: window.WHShare.hasBridge() };
        })()""")
        check("分享卡可生成 PNG data:uri", card["png"] is True and card["len"] > 2000, card)
        check("无容器环境 hasBridge() = false（不假装存成功）", card["bridge"] is False, card)

        print("\n[L] 锣鼓（Web Audio 程序化合成，零音频文件）")
        check("audio 模块就位", page.evaluate("typeof window.WHAudio === 'object'"))
        check("Web Audio 可用", page.evaluate("window.WHAudio.available()") is True)
        check("init 幂等（复用同一 Context）",
              page.evaluate("(function(){var a=window.WHAudio.init();var b=window.WHAudio.init();return a===b;})()") is True)
        check("静音开关生效（setMuted 与 isMuted/isOn 同步）",
              page.evaluate("""(function(){
                var m = window.WHAudio.setMuted(true);
                var r = window.WHAudio.isMuted() && !window.WHAudio.isOn();
                window.WHAudio.setMuted(false);
                return r && m === true && window.WHAudio.isOn();
              })()""") is True)
        audio_files = [p.name for p in (INDEX.parent / "assets").rglob("*")
                       if p.suffix.lower() in (".mp3", ".wav", ".ogg", ".m4a", ".aac")]
        check("包内无任何音频文件（锣鼓为合成，符合 §2 类型限制）", not audio_files, audio_files)

        for js in sorted((INDEX.parent / "assets").glob("*.js")):
            src = js.read_text(encoding="utf-8")
            check("%s 无 Math.random" % js.name, "Math.random" not in src)

        try:
            page.wait_for_function(
                "(function(){var a=window.__wh.assets();for(var k in a){"
                "if(k!=='headSize'&&!a[k]){return false;}}return true;})()",
                timeout=9000)
        except Exception:
            pass
        loaded_assets = page.evaluate("window.__wh.assets()")
        not_loaded = sorted(k for k, v in loaded_assets.items() if k != "headSize" and not v)
        check("CLIP_FILE 每一个立绘都真正加载完成（含新增 manThrust）",
              not not_loaded and loaded_assets.get("manThrust") is True, not_loaded)

        man_imgs = sorted(p.name for p in (INDEX.parent / "assets" / "img").glob("man-*.webp"))
        check("四个动作素材齐备（同一次生成切分而来）",
              man_imgs == ["man-dancer.webp", "man-jump.webp", "man-thrust.webp", "man-walk.webp"],
              man_imgs)
        main_src = (INDEX.parent / "assets" / "main.js").read_text(encoding="utf-8")
        check("突刺动作已接进姿态选择（不是只加载不画）",
              "else if (thrust && IMG.manThrust) { pose = IMG.manThrust; }" in main_src)
        pose_draw = page.evaluate("""(function(){
          var proto = CanvasRenderingContext2D.prototype;
          if (!proto.__origDraw) { proto.__origDraw = proto.drawImage; }
          var seen = [];
          proto.drawImage = function () {
            var im = arguments[0];
            if (im && im.src) { seen.push(im.src); }
            return proto.__origDraw.apply(this, arguments);
          };
          var g = window.__wh.game;
          g.reset(); g.start();
          g.settle(30, 1/60);
          seen.length = 0;
          g.press('thrust');
          g.settle(7, 1/60);
          g.render();
          var thrust = seen.some(function (u) { return u.indexOf('man-thrust.webp') >= 0; });
          seen.length = 0;
          g.render();
          var idle = seen.slice();
          proto.drawImage = proto.__origDraw;
          return { thrustDrawn: thrust, idleDrawn: idle.map(function (u) {
            return u.split('/').pop(); }) };
        })()""")
        check("★ 按「刺」时真的画出 man-thrust.webp（钩住 drawImage 实测）",
              pose_draw["thrustDrawn"] is True, pose_draw)

        anim_spec = page.evaluate("""(function(){
          var a = window.WHAnim;
          if (!a || typeof a.report !== 'function') { return null; }
          return { report: a.report(), spec: Object.keys(window.WHData.ANIM) };
        })()""")
        check("序列帧播放器就位（5 个动作片段规格齐全，当前无序列帧 → 走静态回退）",
              anim_spec is not None
              and sorted(anim_spec["spec"]) == ["idle", "jump", "tail", "thrust", "walk"]
              and all(v == 0 for v in anim_spec["report"].values()),
              anim_spec)

        anim_wire = page.evaluate("""(function(){
          var A = window.WHAnim;
          var proto = CanvasRenderingContext2D.prototype;
          var origDraw = proto.__origDraw || proto.drawImage;
          if (!proto.__origDraw) { proto.__origDraw = proto.drawImage; }
          var origCount = A.count;
          var origReady = A.ready;
          var origFrame = A.frameAt;
          var sentinel = new Image();
          sentinel.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          A.count = function () { return 4; };
          A.ready = function () { return true; };
          A.frameAt = function () { return sentinel; };
          var seen = [];
          proto.drawImage = function () {
            var im = arguments[0];
            if (im && im.src) { seen.push(im.src); }
            return proto.__origDraw.apply(this, arguments);
          };
          var g = window.__wh.game;
          g.reset(); g.start();
          g.settle(30, 1/60);
          seen.length = 0;
          g.render();
          proto.drawImage = proto.__origDraw;
          A.count = origCount;
          A.ready = origReady;
          A.frameAt = origFrame;
          return { usedSentinel: seen.some(function (u) {
                     return u.indexOf('data:image/gif') === 0; }),
                   drawn: seen.length };
        })()""")
        check("★ 序列帧接通：注入哨兵帧后 drawPlayer 真的画动画帧（不是只写不接）",
              anim_wire["usedSentinel"] is True, anim_wire)

        atlas_wire = page.evaluate("""(function(){
          var A = window.WHAnim;
          var proto = CanvasRenderingContext2D.prototype;
          if (!proto.__origDraw) { proto.__origDraw = proto.drawImage; }
          var origReady = A.ready;
          var origFrame = A.frameAt;
          var sentinel = new Image();
          sentinel.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          A.ready = function () { return true; };
          A.frameAt = function () {
            return { img: sentinel, sx: 32, sy: 0, sw: 32, sh: 48 };
          };
          var argc = [];
          proto.drawImage = function () {
            argc.push(arguments.length);
            return proto.__origDraw.apply(this, arguments);
          };
          var g = window.__wh.game;
          g.reset(); g.start();
          g.settle(30, 1/60);
          argc.length = 0;
          g.render();
          proto.drawImage = proto.__origDraw;
          A.ready = origReady;
          A.frameAt = origFrame;
          return { usedSubRect: argc.indexOf(9) >= 0, argc: argc };
        })()""")
        check("★ 图集切片接通：注入图集帧后按 9 参 drawImage 画子矩形（Gamelabs/GodMode 导出格式）",
              atlas_wire["usedSubRect"] is True, atlas_wire)

        gaps_real = page.evaluate("""(function(){
          var g = window.__wh.game, s, i, out = {};
          function toRoom1() {
            g.reset(); g.start(); g.setAuto(true);
            for (i = 0; i < 1200; i++) { g.step(1/60); s = g.snapshot();
              if (s.roomId !== 'kaiguang') { break; } }
            g.setAuto(false); g.releaseAll();
            return g.snapshot();
          }
          s = toRoom1();
          var gp = s.gaps[0];
          out.gapEnd = gp.lx + gp.w;
          window.WHPlayer.reset(Math.max(0.8, gp.lx - 2.0));
          g.settle(6, 1/60);
          s = g.snapshot();
          var f0 = s.fire, pit = -1, minY = 0;
          var preT = (s.lastHurt && s.lastHurt.kind === 'pit') ? s.lastHurt.t : -1;
          g.press('right');
          for (i = 0; i < 140; i++) {
            g.step(1/60); s = g.snapshot();
            if (s.player.y < minY) { minY = s.player.y; }
            if (s.lastHurt && s.lastHurt.kind === 'pit' && s.lastHurt.t > preT) { pit = i; break; }
          }
          g.releaseAll();
          s = g.snapshot();
          out.walk_pitFrame = pit; out.walk_minY = +minY.toFixed(2);
          out.walk_fireLost = +(f0 - s.fire).toFixed(1);
          out.walk_respawnX = +s.player.x.toFixed(2);

          s = toRoom1();
          gp = s.gaps[0];
          window.WHPlayer.reset(Math.max(0.8, gp.lx - 3.2));
          g.settle(6, 1/60);
          s = g.snapshot();
          var f1 = s.fire;
          var preT2 = (s.lastHurt && s.lastHurt.kind === 'pit') ? s.lastHurt.t : -1;
          var pit2 = 0;
          g.press('right');
          for (i = 0; i < 200; i++) {
            g.step(1/60); s = g.snapshot();
            if (s.player.onGround && s.player.x > gp.lx - 1.2) { g.press('jump'); break; }
          }
          for (i = 0; i < 200; i++) {
            g.step(1/60); s = g.snapshot();
            if (s.lastHurt && s.lastHurt.kind === 'pit' && s.lastHurt.t > preT2) { pit2++; preT2 = s.lastHurt.t; }
            if (s.player.onGround && s.player.x > gp.lx + gp.w) { break; }
          }
          g.releaseAll();
          s = g.snapshot();
          out.jumpX = +s.player.x.toFixed(2);
          out.jumpCleared = s.player.x > gp.lx + gp.w && s.player.onGround && pit2 === 0;
          out.jumpFireLost = +(f1 - s.fire).toFixed(1);
          return out;
        })()""")
        check("★ 沟壑是真洞：走过去会掉下去、按 -8 扣香火并弹回沟左（此前 y=0 直接走过去）",
              gaps_real["walk_pitFrame"] >= 0 and gaps_real["walk_fireLost"] > 5
              and gaps_real["walk_respawnX"] < gaps_real["gapEnd"], gaps_real)
        check("★ 沟壑能用跳越过：过沟且全程不掉沟扣血",
              gaps_real["jumpCleared"] is True and gaps_real["jumpFireLost"] < 3, gaps_real)

        death = page.evaluate("""(function(){
          var g = window.__wh.game, i, s, list, e = null, x0;
          g.reset(); g.start(); g.setAuto(true);
          for (i = 0; i < 1200; i++) { g.step(1/60); s = g.snapshot();
            if (s.roomId !== 'kaiguang') { break; } }
          g.setAuto(false); g.releaseAll();
          s = g.snapshot();
          list = window.WHGame.enemiesRaw();
          for (i = 0; i < list.length; i++) { if (list[i].alive) { e = list[i]; break; } }
          if (!e) { return { err: 'no enemy', room: s.roomId }; }
          x0 = s.worldX - s.player.x;
          for (i = 0; i < 4000; i++) {
            window.WHPlayer.reset(e.x - x0);
            g.step(1/60);
            s = g.snapshot();
            if (s.phase === 'fail') { break; }
          }
          return { lastKind: (s.lastHurt && s.lastHurt.kind) || null,
                   phase: s.phase, room: s.roomName, t: +s.t.toFixed(1),
                   msg: ((document.getElementById('result') || {}).textContent || '') };
        })()""")
        known = ("miasma", "ghost", "boss", "pit")
        word = {"miasma": "疫气", "ghost": "瘟鬼", "boss": "瘟神", "pit": "沟壑"}
        gsrc = (INDEX.parent / "assets" / "game.js").read_text(encoding="utf-8")
        assigns = gsrc.count("S.lastHurt = {")
        check("★ 每一个扣血点都有归因（三处 damage 全部写 lastHurt：敌人/Boss/掉沟）",
              assigns == 3
              and 'S.lastHurt = { kind: e.kind' in gsrc
              and 'S.lastHurt = { kind: "boss"' in gsrc
              and 'S.lastHurt = { kind: "pit"' in gsrc,
              {"assignments": assigns})

        check("★ 受伤有归因：扣血会记录来源（疫气/瘟鬼/Boss/掉沟）",
              death.get("lastKind") in known, death)
        check("★ 死亡页死因与记录的来源一致，并写明倒在哪个房间",
              death.get("phase") == "fail"
              and word.get(death.get("lastKind"), "@@") in death.get("msg", "")
              and "倒在" in death.get("msg", ""), death)

        windup = page.evaluate("""(function(){
          var g = window.__wh.game, D = window.WHData, i, s;
          g.reset(); g.start(); g.settle(30, 1/60);
          var evAt = -1, n = 0;
          window.WHGame.setCallback('thrust', function () { evAt = n; });
          g.press('thrust');
          var trace = [];
          for (n = 1; n <= 14; n++) {
            g.step(1/60); s = g.snapshot();
            trace.push(+s.windup.toFixed(3));
          }
          return { evAt: evAt, firstWindup: trace[0], zeroAt: trace.indexOf(0) + 1,
                   win: D.ACT.WINDUP, lock: D.ACT.RECOVER, trace: trace.slice(0, 9) };
        })()""")
        check("★ 竿刺有前摇：命中结算被推迟到前摇之后（不是按下即结算）",
              windup["evAt"] > 1 and windup["firstWindup"] < windup["win"]
              and windup["zeroAt"] > 1, windup)
        commit = page.evaluate("""(function(){
          var g = window.__wh.game, D = window.WHData;
          g.reset(); g.start(); g.settle(30, 1/60);
          g.press('right'); g.settle(20, 1/60);
          var free = +g.snapshot().player.vx.toFixed(2);
          g.press('thrust'); g.settle(1, 1/60);
          var atk = +g.snapshot().player.vx.toFixed(2);
          g.settle(Math.ceil((D.ACT.WINDUP + D.ACT.RECOVER) * 60) + 3, 1/60);
          var back = +g.snapshot().player.vx.toFixed(2);
          return { free: free, attack: atk, back: back, commit: D.ACT.COMMIT };
        })()""")
        check("★ 攻击有位移承诺：出招期间移速降到 0.35 倍，后摇结束恢复",
              commit["free"] > 0 and commit["attack"] < commit["free"] * 0.6
              and commit["back"] > commit["free"] * 0.9, commit)

        check("Boss 血条元素存在（原先完全没有，导致误判「打不动」）",
              page.evaluate("!!document.getElementById('hud-boss')") is True)

        boss_fight = page.evaluate("""(function(){
          var g = window.__wh.game;
          g.reset(); g.start(); g.setAuto(true);
          var i, s, maxPurify = 0, sawDuel = false, hits = 0, killed = false;
          for (i = 0; i < 120000; i++) {
            g.step(1/60);
            g.addFire(6);
            s = g.snapshot();
            if (s.bossState && s.bossState.active) {
              sawDuel = true;
              if (s.bossState.purify > maxPurify) { maxPurify = s.bossState.purify; }
              hits = s.bossState.hitsLanded;
              if (s.bossState.done) { killed = true; break; }
            }
            if (s.fire <= 0) { break; }
          }
          g.setAuto(false);
          return { sawDuel: sawDuel, maxPurify: +maxPurify.toFixed(1),
                   hits: hits, killed: killed, t: +s.t.toFixed(1) };
        })()""")
        check("★ Boss 真的会掉血/能被击杀（此前只测过通关，从没验过 Boss 掉血）",
              boss_fight["sawDuel"] is True and boss_fight["maxPurify"] > 0
              and boss_fight["hits"] > 0, boss_fight)
        check("Boss 血条读数与内部 purify 一致（HUD 不是装饰）",
              page.evaluate("""(function(){
                var el = document.getElementById('hud-boss');
                var s = window.__wh.game.snapshot();
                if (!el) { return false; }
                if (!s.bossState || !s.bossState.active || s.bossState.done) {
                  return el.className === '';
                }
                var note = el.querySelector('em');
                var bar = el.querySelector('i');
                return el.className === 'on' && !!note && !!bar
                  && note.textContent.indexOf(String(Math.round(s.bossState.purify))) === 0;
              })()""") is True, page.evaluate("window.__wh.game.snapshot().bossState"))

        sync = subprocess.run(
            [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                          "sync_anim_frames.py"), "--check"],
            capture_output=True, text=True)
        check("ANIM_FRAMES 与磁盘上的序列帧一致（放了帧就必须跑 sync_anim_frames.py）",
              sync.returncode == 0,
              (sync.stdout or sync.stderr).strip().splitlines()[-1:])
        check("技能图标：HUD 两个技能槽 + 图标 + 冷却遮罩",
              page.evaluate("""(function(){
                var sks = document.querySelectorAll('#hud-skills .sk');
                var th = document.getElementById('sk-thrust');
                var tl = document.getElementById('sk-tail');
                return sks.length === 2 && !!th && !!tl
                  && !!th.querySelector('svg') && !!tl.querySelector('svg')
                  && !!th.querySelector('.mask') && !!tl.querySelector('.mask')
                  && !!document.getElementById('hud-combo')
                  && !!document.getElementById('hud-incense');
              })()""") is True)
        hud_contract = page.evaluate("""(function(){
          var g = window.__wh.game;
          g.reset(); g.start();
          var s = g.snapshot();
          return {
            cd: !!(s.cd && s.cd.thrust > 0 && s.cd.tail > 0),
            cost: !!(s.cost && s.cost.thrust > 0 && s.cost.tail > 0),
            num: typeof s.thrustCd === 'number' && typeof s.tailCd === 'number'
                 && typeof s.comboShow === 'number' && typeof s.comboShowT === 'number'
                 && typeof s.tailT === 'number' && typeof s.incense === 'number'
          };
        })()""")
        check("HUD 数据契约：冷却、耗火、连招窗口、添香全部可读",
              isinstance(hud_contract, dict) and all(hud_contract.values()), hud_contract)

        incense = page.evaluate("""(function(){
          var g = window.__wh.game;
          var i, s, altar = null, f0, base, near;
          g.reset(); g.start();
          s = g.snapshot();
          for (i = 0; i < s.props.length; i++) {
            if (s.props[i].kind === 'altar') { altar = s.props[i]; break; }
          }
          if (!altar) { return { err: 'no altar' }; }
          g.settle(600, 1/60);
          window.WHPlayer.reset(altar.lx - 8);
          f0 = g.snapshot().fire;
          g.settle(60, 1/60);
          base = g.snapshot().fire - f0;
          window.WHPlayer.reset(altar.lx);
          f0 = g.snapshot().fire;
          g.settle(60, 1/60);
          s = g.snapshot();
          near = s.fire - f0;
          return { altar: altar.lx, base: base, near: near, incense: s.incense };
        })()""")
        check("香火不是纯计时器：站到香炉旁添香可净回火",
              isinstance(incense, dict) and incense.get("near", -9) > 0
              and incense.get("base", 0) < 0, incense)

        page.evaluate("""(function(){
          var vs = document.querySelectorAll('.view'), i;
          for (i = 0; i < vs.length; i++) { vs[i].classList.remove('on'); }
          document.getElementById('v-stage').classList.add('on');
        })()""")
        dom_btns = page.evaluate("""(function(){
          var ids = ['btn-left','btn-right','btn-jump','btn-thrust','btn-tail'], o = {}, i, e, rc, top;
          for (i = 0; i < ids.length; i++) {
            e = document.getElementById(ids[i]);
            if (!e) { o[ids[i]] = 'missing'; continue; }
            rc = e.getBoundingClientRect();
            top = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
            o[ids[i]] = (top === e || e.contains(top)) ? true : (top ? (top.id || top.tagName) : 'null');
          }
          return o;
        })()""")
        check("五个操作键都露在最上层（没有被别的元素挡住触摸）",
              all(v is True for v in dom_btns.values()), dom_btns)

        def _pst():
            return page.evaluate("""(function(){
              var s = window.__wh.game.snapshot();
              return { x: +s.player.x.toFixed(3), g: s.player.onGround,
                       vy: +s.player.vy.toFixed(2), f: s.player.facing,
                       thrustCd: +s.thrustCd.toFixed(3), tailCd: +s.tailCd.toFixed(3) };
            })()""")

        page.evaluate("window.__wh.game.reset(); window.__wh.game.start();")
        page.evaluate("window.__wh.game.settle(2, 1/60)")
        jb = _pst()
        page.click("#btn-jump")
        page.evaluate("window.__wh.game.settle(6, 1/60)")
        ja = _pst()
        check("真实按钮『跳』：单击即成跳（输入缓冲，不被吞帧）",
              (not ja["g"]) or ja["vy"] > 0.1, {"before": jb, "after": ja})

        page.click("#btn-thrust")
        page.evaluate("window.__wh.game.settle(2, 1/60)")
        th = _pst()
        check("真实按钮『刺』：单击即进冷却", th["thrustCd"] > 0, th)
        page.click("#btn-tail")
        page.evaluate("window.__wh.game.settle(2, 1/60)")
        tl = _pst()
        check("真实按钮『甩』：单击即进冷却", tl["tailCd"] > 0, tl)

        rb = page.locator("#btn-right").bounding_box()
        rx0 = _pst()["x"]
        page.mouse.move(rb["x"] + rb["width"] / 2, rb["y"] + rb["height"] / 2)
        page.mouse.down()
        page.evaluate("window.__wh.game.settle(45, 1/60)")
        rx1 = _pst()["x"]
        page.mouse.up()
        check("真实按钮『右』：按住会前进", rx1 - rx0 > 0.5, {"x0": rx0, "x1": rx1})

        lb = page.locator("#btn-left").bounding_box()
        lx0 = _pst()["x"]
        page.mouse.move(lb["x"] + lb["width"] / 2, lb["y"] + lb["height"] / 2)
        page.mouse.down()
        page.evaluate("window.__wh.game.settle(45, 1/60)")
        la = _pst()
        page.mouse.up()
        check("真实按钮『左』：按住会后退并转身", la["x"] - lx0 < -0.5 and la["f"] == -1,
              {"x0": lx0, "x1": la["x"], "facing": la["f"]})

        vp_bad = []
        for vw, vh in [(320, 568), (360, 640), (375, 667), (414, 896), (812, 375)]:
            page.set_viewport_size({"width": vw, "height": vh})
            page.wait_for_timeout(140)
            vr = page.evaluate("""(function(){
              var ids = ['btn-left','btn-right','btn-jump','btn-tail','btn-thrust',
                         'hud-skills','hud-combo','hud-incense','hud-fire','btn-mute'];
              var i, e, rc, oob = [], untappable = [];
              for (i = 0; i < ids.length; i++) {
                e = document.getElementById(ids[i]);
                if (!e) { oob.push(ids[i] + ':missing'); continue; }
                rc = e.getBoundingClientRect();
                if (rc.right > innerWidth + 0.5 || rc.left < -0.5 ||
                    rc.bottom > innerHeight + 0.5 || rc.top < -0.5) {
                  oob.push(ids[i] + '[' + Math.round(rc.left) + '..' + Math.round(rc.right) + ']');
                }
              }
              var taps = ['btn-jump', 'btn-thrust', 'btn-tail'], top, el;
              for (i = 0; i < taps.length; i++) {
                el = document.getElementById(taps[i]);
                rc = el.getBoundingClientRect();
                top = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
                if (!(top === el || el.contains(top))) { untappable.push(taps[i]); }
              }
              return { oob: oob, untappable: untappable,
                       ovf: document.documentElement.scrollWidth - innerWidth };
            })()""")
            if vr["oob"] or vr["untappable"] or vr["ovf"] > 0:
                vp_bad.append({"vp": "%dx%d" % (vw, vh), "oob": vr["oob"],
                               "untappable": vr["untappable"], "ovf": vr["ovf"]})
        check("五种屏幕都不溢出、操作键全在屏内且可点（含 320 极小屏）",
              not vp_bad, vp_bad)
        page.set_viewport_size({"width": PORTRAIT["width"], "height": PORTRAIT["height"]})

        page.goto(url, timeout=30000)
        page.wait_for_function("!!window.__wh", timeout=15000)
        page.evaluate("""(function(){
          var g = window.__wh.game;
          g.reset(); g.start(); g.setAuto(true);
          var i, s;
          for (i = 0; i < 120000; i++) {
            g.step(1/60);
            s = g.snapshot();
            if (document.getElementById('v-result').classList.contains('on')) { break; }
            if (s.fire <= 0 && s.phase !== 'return') { break; }
          }
          g.setAuto(false);
        })()""")
        page.wait_for_timeout(800)
        check("通关真实流程：结算页自动出现（showResult 未被测试回调顶掉）",
              page.evaluate("document.getElementById('v-result').classList.contains('on')") is True)
        ac_wrap = """
        (function () {
          var Orig = window.AudioContext || window.webkitAudioContext;
          if (!Orig) { return; }
          function Wrapped() {
            var c = new Orig();
            window.__acs = window.__acs || [];
            window.__acs.push(c);
            return c;
          }
          Wrapped.prototype = Orig.prototype;
          window.AudioContext = Wrapped;
          window.webkitAudioContext = Wrapped;
        })();
        """
        ap = browser.new_page(viewport=PORTRAIT)
        ap.add_init_script(ac_wrap)
        ap.goto(url, timeout=30000)
        ap.wait_for_function("!!window.__wh", timeout=15000)
        ap.click("#btn-start")
        ap.wait_for_timeout(1000)
        ac = ap.evaluate("""(function(){
          try { window.WHAudio.init(); window.WHAudio.sfx('gate'); } catch (e) {}
          var l = window.__acs || [];
          return { n: l.length, states: l.map(function (c) { return c.state; }),
                   isOn: window.WHAudio.isOn(),
                   warnDisplay: getComputedStyle(document.getElementById('warn')).display };
        })()""")
        check("音频在真实手势后真正解锁（AudioContext=running，而非静默 suspended）",
              ac["n"] > 0 and all(st == "running" for st in ac["states"]), ac)
        check("自诊断条 #warn 未误报（说明资源确实加载成功）",
              ac["warnDisplay"] == "none", ac)
        ap.close()

        mt_ctx = browser.new_context(viewport=PORTRAIT, has_touch=True, is_mobile=True)
        mp = mt_ctx.new_page()
        mp.goto(url, timeout=30000)
        mp.wait_for_function("!!window.__wh", timeout=15000)
        mp.tap("#btn-start")
        mp.wait_for_function("document.getElementById('v-stage').classList.contains('on')", timeout=15000)
        mp.wait_for_timeout(400)
        mcdp = mt_ctx.new_cdp_session(mp)
        rb = mp.locator("#btn-right").bounding_box()
        jb = mp.locator("#btn-jump").bounding_box()
        tb = mp.locator("#btn-thrust").bounding_box()
        mpr = {"x": rb["x"] + rb["width"] / 2, "y": rb["y"] + rb["height"] / 2, "id": 1}
        mpj = {"x": jb["x"] + jb["width"] / 2, "y": jb["y"] + jb["height"] / 2, "id": 2}
        mpt = {"x": tb["x"] + tb["width"] / 2, "y": tb["y"] + tb["height"] / 2, "id": 3}

        def mt_snap():
            return mp.evaluate("""(function(){
              var s = window.__wh.game.snapshot();
              return { x: +s.player.x.toFixed(2), vx: +s.player.vx.toFixed(2),
                       air: !s.player.onGround, vy: +s.player.vy.toFixed(2),
                       thrustCd: +s.thrustCd.toFixed(3) };
            })()""")

        def mt_send(t, pts):
            mcdp.send("Input.dispatchTouchEvent", {"type": t, "touchPoints": pts})

        mt_send("touchStart", [mpr])
        mp.wait_for_timeout(430)
        mt_a = mt_snap()
        mt_send("touchStart", [mpr, mpj])
        mp.wait_for_timeout(140)
        mt_b = mt_snap()
        mt_send("touchStart", [mpr])
        mp.wait_for_timeout(200)
        mt_c = mt_snap()
        mt_send("touchStart", [mpr, mpt])
        mp.wait_for_timeout(140)
        mt_d = mt_snap()
        mt_send("touchEnd", [])
        mp.wait_for_timeout(280)
        mt_e = mt_snap()
        check("多点触控：按住「右」时跳/刺都生效且移动不中断（真机核心交互）",
              mt_a["vx"] > 1 and mt_b["vx"] > 1 and (mt_b["air"] or mt_b["vy"] > 0.1)
              and mt_c["vx"] > 1 and mt_d["vx"] > 1 and mt_d["thrustCd"] > 0
              and abs(mt_e["vx"]) < 0.5,
              {"a": mt_a, "b": mt_b, "c": mt_c, "d": mt_d, "e": mt_e})
        mt_ctx.close()

        res_bad = []
        for vw, vh in [(320, 568), (375, 667), (414, 736), (414, 896)]:
            page.set_viewport_size({"width": vw, "height": vh})
            page.wait_for_timeout(170)
            rr = page.evaluate("""(function(){
              var ids = ['btn-album', 'btn-note'], i, e, rc, top, bad = [];
              for (i = 0; i < ids.length; i++) {
                e = document.getElementById(ids[i]);
                rc = e.getBoundingClientRect();
                if (!(rc.top >= -0.5 && rc.bottom <= innerHeight + 0.5)) {
                  bad.push(ids[i] + ':not-in-view');
                }
                top = document.elementFromPoint(rc.left + rc.width / 2,
                                                Math.min(innerHeight - 2, rc.top + rc.height / 2));
                if (!(top === e || e.contains(top))) { bad.push(ids[i] + ':not-hittable'); }
              }
              return bad;
            })()""")
            if rr:
                res_bad.append({"vp": "%dx%d" % (vw, vh), "issues": rr})
        check("结算页两个 CTA 在 320/375/414 屏上都一屏可见且可点（含极小屏）",
              not res_bad, res_bad)
        page.set_viewport_size({"width": PORTRAIT["width"], "height": PORTRAIT["height"]})

        honest = page.evaluate("""(function(){
          var g = window.__wh.game;
          g.reset(); g.start(); g.setAuto(true);
          var done = false, i, s, minFire = 100, incense = 0;
          window.WHGame.setCallback('done', function () { done = true; });
          for (i = 0; i < 120000; i++) {
            g.step(1/60);
            s = g.snapshot();
            if (s.fire < minFire) { minFire = s.fire; }
            if (s.incense > 0) { incense += 1; }
            if (done || s.fire <= 0) { break; }
          }
          g.setAuto(false);
          s = g.snapshot();
          return { done: done, t: +s.t.toFixed(1), cleared: s.roomsCleared,
                   fire: +s.fire.toFixed(1), minFire: +minFire.toFixed(1),
                   incenseS: +(incense / 60).toFixed(1) };
        })()""")
        check("★ 不加火也能通关（经济可自持：击杀回火 + 香炉添香）",
              honest["done"] is True and honest["cleared"] == 3, honest)

        finisher = page.evaluate("""(function(){
          var g = window.__wh.game;
          g.reset(); g.start();
          var i, s, n = 0;
          for (i = 0; i < 3; i++) {
            g.press('thrust');
            g.settle(30, 1/60);
          }
          s = g.snapshot();
          return { comboShow: s.comboShow, showT: s.comboShowT,
                   comboT: s.comboT, win: window.WHData.ACT.COMBO_WIN };
        })()""")
        check("三连后 HUD 有『重击』读数（comboShow=3 且显示窗口未过期）",
              isinstance(finisher, dict) and finisher.get("comboShow") == 3
              and finisher.get("showT", 0) > 0 and finisher.get("win", 0) >= 1.0
              and finisher.get("comboT") == 0, finisher)

        chase = page.evaluate("""(function(){
          var g = window.__wh.game;
          var i, s, e = null, x0, tailT, hits, after, bonus, list;
          g.reset(); g.start();
          g.press("right");
          for (i = 0; i < 1200; i++) {
            g.step(1/60);
            s = g.snapshot();
            if (s.roomId !== 'kaiguang') { break; }
          }
          g.releaseAll();
          s = g.snapshot();
          list = window.WHGame.enemiesRaw();
          for (i = 0; i < list.length; i++) {
            if (list[i].alive) { e = list[i]; break; }
          }
          if (!e) { return { err: 'no enemy', room: s.roomId, n: list.length }; }
          x0 = s.worldX - s.player.x;
          window.WHPlayer.reset(e.x - x0 - 2);
          g.settle(3, 1/60);
          g.press('tail');
          g.settle(1, 1/60);
          s = g.snapshot();
          tailT = s.tailT;
          hits = s.lastHits;
          g.press('thrust');
          g.settle(1, 1/60);
          s = g.snapshot();
          after = s.tailT;
          bonus = s.chaseN;
          return { tailT: tailT, tailHits: hits, consumed: after, chaseN: bonus };
        })()""")
        check("连招可读：甩中后开追刺窗口，刺出即消耗",
              isinstance(chase, dict) and chase.get("tailT", 0) > 0
              and chase.get("consumed", -1) == 0 and chase.get("tailHits", 0) > 0
              and chase.get("chaseN", -1) >= 0, chase)

        check("无 console / pageerror", len(errors) == 0, errors[:6])
        browser.close()
    httpd.shutdown()

    failed = [n for n, ok in CHECKS if not ok]
    print("\n%d/%d checks passed" % (len(CHECKS) - len(failed), len(CHECKS)))
    if failed:
        print("FAILED:")
        for n in failed:
            print("  - " + n)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
