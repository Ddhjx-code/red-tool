"""Visual gate for 舞火龙: render, screenshot, then have the vision model judge.

Why this exists as a separate gate instead of assertions inside the smoke suite:
the smoke suite is deterministic and offline, so it can only check things a
number can settle (geometry, palette presence, determinism, ground clearance).
"Does this read as a dragon" is not one of those -- and earlier attempts to
proxy it with pixel statistics produced a metric that passed while the render
was visibly wrong. docs/research/maas-image-api.md states the house rule:

    视觉验收 = vision 模型主观判断 + Pillow 客观指标，两路并行

This script is the subjective half.

The judgements it asks for are the design doc's own §9.4 acceptance surface:
  ① 行波是否形成 S 形（一条会扭的活龙）
  ② 香火是否有疏密层次与暖白过曝
  ③ 夜景剪影是否把龙衬出来（龙是画面唯一主角）
plus the question the user actually raised: can a first-time viewer tell the
controlled thing is a dragon at all.

Usage:
    python tests/wuhuolong_gate.py            # render + judge, print verdict
    python tests/wuhuolong_gate.py --frames   # also refresh the screenshots
"""

import argparse
import functools
import http.server
import os
import pathlib
import socketserver
import subprocess
import sys
import threading

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL_DIR = ROOT / "tools" / "wuhuolong"
SHOTS = TOOL_DIR / "screenshots"
WAVE_SERIES = [("wave-1", 60), ("wave-2", 67), ("wave-3", 74),
               ("wave-4", 81), ("wave-5", 88), ("wave-6", 95)]
CONTEXT_FRAMES = [("ctx-portrait", 390, 844, 200), ("ctx-landscape", 844, 390, 200)]

WAVE_QUESTION = (
    "这是同一段 2D 动画里连续 6 帧的画面，每帧间隔 0.12 秒，按顺序给出。"
    "请只回答一件事：\n"
    "① 这几帧之间，身体形状变化的主要方式是「波峰波谷沿身体从尾向头（或从头向尾）传播」"
    "还是「整条作为刚体平移/旋转」？\n"
    "② 如果是行波，说清波往哪个方向走、一帧内约几个弯；如果不是，指出你看到的是哪种刚体运动。\n"
    "③ 另外用一句话说：这几帧里尾巴参与扭动了吗？\n"
    "请直说，不要客气。"
)

CONTEXT_QUESTION = (
    "这是同一款 2D 横版游戏的两张画面：图1 竖屏，图2 横屏。"
    "设计意图：玩家操控一条中国火龙（舞火龙，国家级非遗题材）在夜间街巷推进。\n"
    "请客观回答：\n"
    "① 画面主体是什么？第一直觉读作什么？像龙吗？给 0-10 分（并说明分数主要由哪个部件支撑）。\n"
    "② 逐项核对中国龙特征是否存在且可辨：龙头（角/须/眼/口/齿）、蛇形长身、身体宽度与粗细过渡、"
    "整体 S 形波动、背鳍、爪、尾鳍。\n"
    "③ 香火（身上的火光）是否有疏密层次与暖白过曝，还是均匀撒点？\n"
    "④ 夜景剪影是否把龙衬出来、龙是不是画面唯一主角？构图有没有浪费（例如大片空黑）？\n"
    "⑤ 横屏那张，主体是否完整在框内？\n"
    "⑥ 缩到手机信息流小图（约 120px 高）还认得出是龙吗？\n"
    "⑦ 剩余最大缺陷只列最要紧 3 条。请直说，不要客气。"
)


GAME_STATES = [
    ("game-dooropen-portrait", 390, 844, "kaiguang", 45),
    ("game-room1-portrait", 390, 844, "guoqiao", 90),
    ("game-room1-landscape", 844, 390, "guoqiao", 90),
    ("game-boss-portrait", 390, 844, "tuanyuan", 150),
    ("game-room2-portrait", 390, 844, "chanshuang", 60),
]

GAME_QUESTION = (
    "这是同一款 2D 横版动作游戏的**实机画面**（不是宣传图）。玩法意图：玩家操控一个持竿的舞龙人，"
    "龙身从他手里的竹竿延出、跟在身后扫场；每一关是一个**有边界的房间／街段**，"
    "房里有疫气（地上绿雾）与瘟鬼（白影），**清完敌人右侧的门才会打开**，走到门口进下一间。\n"
    "请客观回答：\n"
    "① 你判断这是「在有边界的房间里清场推进」的横版动作游戏，还是「自动向右滚动的跑酷」？"
    "请给出你的判断依据（哪一处让你这么认为）。\n"
    "② 画面里你能分辨出这几样吗：持竿的玩家小人、龙身、房门、敌人？分别在什么位置？\n"
    "③ 房间的边界（左右墙／门）读得出来吗？还是看起来像一条无限延伸的街？\n"
    "④ 玩家小人是否太小、或被龙身完全盖住？\n"
    "⑤ 图3 是 Boss 房（瘟神本体：紫黑色巨大团块），图4 是同款的另一间房。这两张里该看的元素看得见吗？\n"
    "⑥ 最要紧的 3 条缺陷，请直说，不要客气。"
)


def serve():
    http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
    handler = functools.partial(http.server.SimpleHTTPRequestHandler,
                                directory=str(TOOL_DIR))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


def render_all(port):
    from playwright.sync_api import sync_playwright

    SHOTS.mkdir(parents=True, exist_ok=True)
    wave, ctxs = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.goto("http://127.0.0.1:%d/index.html?test=1" % port, timeout=30000)
        page.wait_for_function("!!window.__wh", timeout=10000)
        page.evaluate("""(function(){
          document.getElementById('v-boot').classList.remove('on');
          document.getElementById('v-stage').classList.add('on');
          window.WHScene.resize();
        })()""")
        page.wait_for_function(
            "window.__wh.assets().head && window.__wh.assets().tail && window.__wh.assets().claw"
            " && window.__wh.assets().man && window.__wh.assets().ghost"
            " && window.__wh.assets().miasma && window.__wh.assets().fxhit",
            timeout=15000)
        page.evaluate("window.__wh.test.reset()")
        prev = 0
        for name, at in WAVE_SERIES:
            page.evaluate("(function(n){ window.__wh.test.settle(n, 1/60); })", at - prev)
            prev = at
            page.evaluate("window.__wh.test.render()")
            path = SHOTS / (name + ".png")
            page.screenshot(path=str(path))
            wave.append(path)
        page.close()

        for name, w, h, at in CONTEXT_FRAMES:
            pg2 = browser.new_page(viewport={"width": w, "height": h})
            pg2.goto("http://127.0.0.1:%d/index.html?test=1" % port, timeout=30000)
            pg2.wait_for_function("!!window.__wh", timeout=10000)
            pg2.evaluate("""(function(){
              document.getElementById('v-boot').classList.remove('on');
              document.getElementById('v-stage').classList.add('on');
              window.WHScene.resize();
            })()""")
            pg2.wait_for_function(
                "window.__wh.assets().head && window.__wh.assets().tail && window.__wh.assets().claw",
                timeout=10000)
            pg2.evaluate("window.__wh.test.reset()")
            pg2.evaluate("(function(n){ window.__wh.test.settle(n, 1/60); })", at)
            pg2.evaluate("window.__wh.test.render()")
            path = SHOTS / (name + ".png")
            pg2.screenshot(path=str(path))
            ctxs.append(path)
            pg2.close()
        games = render_game_states(browser, port)
        browser.close()
    return wave, ctxs, games


def render_game_states(browser, port):
    """v2 实机帧：真的开局、走到目标房间、再渲染。

    探针帧只能评「一条链在真空里」；房间化之后，构图好不好、玩家认不认得出自己
    在操控什么、门和房间边界读不读得出来，都只有在游戏态里才评得到。
    """
    out = []
    for name, w, h, want_room, extra in GAME_STATES:
        pg = browser.new_page(viewport={"width": w, "height": h})
        pg.goto("http://127.0.0.1:%d/index.html?test=1" % port, timeout=30000)
        pg.wait_for_function("!!window.__wh", timeout=10000)
        pg.evaluate("""(function(){
          document.getElementById('v-boot').classList.remove('on');
          document.getElementById('v-stage').classList.add('on');
          window.WHScene.resize();
        })()""")
        pg.wait_for_function(
            "window.__wh.assets().head && window.__wh.assets().tail && window.__wh.assets().claw",
            timeout=10000)
        got = pg.evaluate("""(function(args){
          var want = args[0], extra = args[1];
          window.WHGame.start();
          window.WHGame.setAuto(true);
          var i, s;
          for (i = 0; i < 40000; i++) {
            window.__wh.game.step(1/60);
            window.WHGame.addFire(3);
            s = window.WHGame.snapshot();
            if (s.roomId === want) { break; }
          }
          for (i = 0; i < extra; i++) {
            window.__wh.game.step(1/60);
            window.WHGame.addFire(3);
          }
          // 定格在「运动中」而不是站桩帧：否则动势/拖影/弓步全被埋没
          window.WHGame.setAuto(false);
          window.__wh.game.releaseAll();
          window.__wh.game.press("right");
          for (i = 0; i < 26; i++) {
            window.__wh.game.step(1/60);
            window.WHGame.addFire(3);
          }
          window.__wh.game.render();
          return window.WHGame.snapshot().roomId;
        })""", [want_room, extra])
        path = SHOTS / (name + ".png")
        pg.screenshot(path=str(path))
        print("  %s -> room=%s" % (path.name, got))
        out.append(path)
        pg.close()
    return out


def ask_vision(paths, question):
    cmd = [sys.executable, str(ROOT / "tests" / "vision_ask.py")]
    cmd += [str(p) for p in paths]
    cmd += [question]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    if out.returncode != 0:
        return None, (out.stderr or out.stdout).strip()[:400]
    return out.stdout.strip(), None


def main():
    sys.stdout.reconfigure(line_buffering=True)
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--frames", action="store_true", help="refresh screenshots too")
    args = ap.parse_args()

    httpd, port = serve()
    try:
        print("rendering wave series (0.12s apart) + context frames + game frames...")
        wave, ctxs, games = render_all(port)
        for p in wave + ctxs + games:
            print("  %s  %.1f KiB" % (p.name, p.stat().st_size / 1024))

        print("\n===== A. 行波（6 帧 0.12s 序列）=====")
        a1, err1 = ask_vision(wave, WAVE_QUESTION)
        print(a1 if a1 else ("vision call failed: %s" % err1))

        print("\n===== B. 主体 / 构图 / 缩略辨识 =====")
        a2, err2 = ask_vision(ctxs, CONTEXT_QUESTION)
        print(a2 if a2 else ("vision call failed: %s" % err2))

        print("\n===== C. 实机：房间式横版 还是 跑酷 =====")
        a3, err3 = ask_vision(games, GAME_QUESTION)
        print(a3 if a3 else ("vision call failed: %s" % err3))
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
