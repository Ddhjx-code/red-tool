"""渲一帧实机画面，直接交给 Qwen 看。不跑断言套件、不跑门禁。

用法：
    python tests/shot.py "你的问题"
    python tests/shot.py "你的问题" chanshuang        # 指定房间
    python tests/shot.py "你的问题" tuanyuan 150      # 指定房间 + 额外推进帧数

房间 id：kaiguang / guoqiao / chanshuang / tuanyuan
截图落在 docs/research/wuhuolong-drafts/shots/（不进包）。
"""
import functools
import http.server
import pathlib
import socketserver
import subprocess
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "wuhuolong"
OUT = ROOT / "docs" / "research" / "wuhuolong-drafts" / "shots"
ROOMS = {"kaiguang", "guoqiao", "chanshuang", "tuanyuan"}


def main():
    q = sys.argv[1] if len(sys.argv) > 1 else "这张实机画面最该改的一处是什么？"
    room = sys.argv[2] if len(sys.argv) > 2 else "guoqiao"
    if room not in ROOMS:
        room = "guoqiao"
    extra = int(sys.argv[3]) if len(sys.argv) > 3 else 90

    OUT.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(TOOL))
    handler.log_message = lambda *a, **k: None
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    shot = OUT / ("shot-%s.png" % room)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={"width": 390, "height": 844})
            pg.goto("http://127.0.0.1:%d/index.html?test=1" % port, timeout=30000)
            pg.wait_for_function("!!window.__wh", timeout=10000)
            pg.wait_for_function(
                "window.__wh.assets().head && window.__wh.assets().man"
                " && window.__wh.assets().ghost && window.__wh.assets().miasma"
                " && window.WHScene.plates() && window.WHScene.plates().far"
                " && window.WHScene.plates().mid && window.WHScene.plates().near",
                timeout=25000)
            pg.evaluate("""(function(args){
              document.getElementById('v-boot').classList.remove('on');
              document.getElementById('v-stage').classList.add('on');
              window.WHScene.resize();
              window.WHGame.start();
              window.WHGame.setAuto(true);
              var want = args[0], extra = args[1], i, s;
              for (i = 0; i < 40000; i++) {
                window.__wh.game.step(1/60);
                window.WHGame.addFire(3);
                s = window.WHGame.snapshot();
                if (s.roomId === want) { break; }
              }
              for (i = 0; i < extra; i++) { window.__wh.game.step(1/60); window.WHGame.addFire(3); }
              window.WHGame.setAuto(false);
              window.__wh.game.releaseAll();
              window.__wh.game.press("right");
              for (i = 0; i < 26; i++) { window.__wh.game.step(1/60); window.WHGame.addFire(3); }
              window.__wh.game.render();
            })""", [room, extra])
            pg.screenshot(path=str(shot))
            b.close()
    finally:
        httpd.shutdown()

    print("shot -> %s (%d KiB)" % (shot.name, shot.stat().st_size / 1024))
    subprocess.run([sys.executable, str(ROOT / "tests" / "vision_ask.py"), str(shot), q])


if __name__ == "__main__":
    main()
