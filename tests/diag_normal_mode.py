"""诊断：正式模式（不带 ?test=1）下，按屏幕按钮玩家到底动没动。

用户反馈「完全玩不了」。这个脚本复现真实流程：
  打开 index.html -> 点 #btn-start -> 按住 #btn-right -> 对比玩家 x
不跑断言套件，只看事实。
"""
import functools
import http.server
import pathlib
import socketserver
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "wuhuolong"
OUT = ROOT / "docs" / "research" / "wuhuolong-drafts" / "shots"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(TOOL))
    handler.log_message = lambda *a, **k: None
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.on("console", lambda m: errs.append("console." + m.type + ": " + m.text)
              if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))

        # 关键：不带 ?test=1 —— 和用户拿到的包同一条路径
        pg.goto("http://127.0.0.1:%d/index.html" % port, timeout=30000)
        pg.wait_for_timeout(1500)

        print("① 有没有 window.WHGame        :", pg.evaluate("typeof window.WHGame"))
        print("   初始 phase                  :", pg.evaluate("window.WHGame.snapshot().phase"))
        print("   起龙按钮可见吗              :",
              pg.evaluate("!!document.getElementById('btn-start') && "
                          "getComputedStyle(document.getElementById('btn-start')).display"))
        print("   舞台视图当前 display        :",
              pg.evaluate("getComputedStyle(document.getElementById('v-stage')).display"))
        print("   方向键 pointerEvents        :",
              pg.evaluate("getComputedStyle(document.getElementById('btn-right')).pointerEvents"))
        print("   方向键位置/尺寸             :",
              pg.evaluate("(function(){var r=document.getElementById('btn-right').getBoundingClientRect();"
                          "return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];})()"))

        pg.click("#btn-start")
        pg.wait_for_timeout(600)
        s0 = pg.evaluate("window.WHGame.snapshot()")
        print("② 点起龙后 phase              :", s0["phase"])
        print("   舞台视图 display            :",
              pg.evaluate("getComputedStyle(document.getElementById('v-stage')).display"))
        print("   玩家 x / 房 / 相位          : %.2f / %s / %s"
              % (s0["player"]["x"], s0["roomId"], s0["phase"]))

        pg.mouse.move(60, 786)
        pg.mouse.down()
        pg.wait_for_timeout(900)
        s1 = pg.evaluate("window.WHGame.snapshot()")
        pg.mouse.up()
        pg.wait_for_timeout(200)
        s2 = pg.evaluate("window.WHGame.snapshot()")
        print("③ 按住右侧按钮 0.9s 后        : x=%.2f  vx=%.2f  onGround=%s"
              % (s1["player"]["x"], s1["player"]["vx"], s1["player"]["onGround"]))
        print("   松开后                       : x=%.2f  vx=%.2f"
              % (s2["player"]["x"], s2["player"]["vx"]))
        print("   位移 = %.2f （>0.5 才算按钮真的生效）" % (s1["player"]["x"] - s0["player"]["x"]))

        pg.screenshot(path=str(OUT / "diag-normal-mode.png"))
        print("④ 截图 -> diag-normal-mode.png")
        b.close()
    httpd.shutdown()
    print("⑤ 页内报错 :", errs[:6] if errs else "（无）")


if __name__ == "__main__":
    main()
