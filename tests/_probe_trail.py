"""一次性探针：竿梢拖影在真实帧路径下是否真的有数据、且真的画得出来。

不并入 smoke（是诊断不是断言）。用完可删。
"""
import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "wuhuolong"


def main():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(TOOL))
    handler.log_message = lambda *a, **k: None
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.goto("http://127.0.0.1:%d/index.html?test=1" % port)
        pg.wait_for_function("!!window.__wh", timeout=10000)
        pg.wait_for_function("window.__wh.assets().head", timeout=15000)

        out = pg.evaluate("""(function(){
          document.getElementById('v-boot').classList.remove('on');
          document.getElementById('v-stage').classList.add('on');
          window.WHScene.resize();
          window.__wh.game.start();
          window.__wh.game.setAuto(false);
          var i, s;

          window.__wh.game.press("right");
          for (i = 0; i < 60; i++) { window.__wh.game.step(1/60); }
          var moving = window.__wh.game.trail();

          window.__wh.game.release("right");
          window.__wh.game.press("left");
          for (i = 0; i < 30; i++) { window.__wh.game.step(1/60); }
          var whip = window.__wh.game.trail();

          window.__wh.game.releaseAll();
          for (i = 0; i < 90; i++) { window.__wh.game.step(1/60); }
          var idle = window.__wh.game.trail();

          window.__wh.game.press("right");
          for (i = 0; i < 40; i++) { window.__wh.game.step(1/60); }
          window.__wh.game.render();

          var cv = document.getElementById('stage');
          var c = cv.getContext('2d');
          var d = c.getImageData(0, 0, cv.width, cv.height).data;
          var warm = 0, tot = 0, k;
          for (k = 0; k < d.length; k += 4 * 53) {
            tot += 1;
            if (d[k] > 150 && d[k] > d[k + 2] + 25 && d[k + 1] > d[k + 2]) { warm += 1; }
          }
          s = window.WHGame.snapshot();
          return { moving: +moving.toFixed(2), whip: +whip.toFixed(2),
                   idle: +idle.toFixed(2), vx: s.player.vx,
                   warmPct: +(100 * warm / tot).toFixed(2) };
        })()""")
        print("probe:", out)
        b.close()
    httpd.shutdown()


if __name__ == "__main__":
    main()
