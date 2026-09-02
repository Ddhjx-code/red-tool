#!/usr/bin/env python3
"""Headless smoke suite for 漆扇 (tools/qishan). Run: python3 tests/qishan_smoke.py"""
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "qishan" / "index.html"
URL_TEST = TOOL.as_uri() + "?test=1&seed=20260902"
URL_HOME = TOOL.as_uri() + "?seed=20260902"
URL_DEMO = TOOL.as_uri() + "?demo=1&seed=20260902"
SHOTS = pathlib.Path("/tmp/qishan_shots")

WEBGL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

CHECKS = []


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok  " if cond else "  FAIL ") + name + ((" | " + extra) if extra and not cond else ""))


def shot(page, name):
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOTS / (name + ".png")))


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=WEBGL_ARGS)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        # ---------- UI 流程：home ----------
        page.goto(URL_HOME)
        page.wait_for_function("window.__ready === true", timeout=15000)
        check("hooks exposed", page.evaluate("!!window.__game"))
        check("engine ok (WebGL float)", page.evaluate("window.__game.snapshot().engineOk"))
        check("home view active", page.locator("#view-home.is-active").count() == 1)
        intro_len = page.locator("#home-intro p").count()
        check("home: 漆扇文化 intro 3 段", intro_len == 3, str(intro_len))
        check("home: hero fan painted", page.evaluate(
            "(function(){var c=document.getElementById('home-fan');"
            "var g=c.getContext('2d');var d=g.getImageData(0,0,c.width,c.height).data;"
            "var n=0;for(var i=3;i<d.length;i+=4)if(d[i]>20)n++;return n>2000;})()"))
        shot(page, "01-home")

        # ---------- create ----------
        page.click("#btn-start")
        page.wait_for_selector("#view-create.is-active")
        page.wait_for_timeout(400)
        swatches = page.locator("#swatch-row .swatch").count()
        check("create: 8 漆色色卡", swatches == 8, str(swatches))
        presets = page.locator("#preset-row .preset").count()
        check("create: 3 配色预设 + 自由", presets == 4, str(presets))
        check("create: 团扇/折扇 扇形", page.locator("#shape-group .opt").count() == 2)
        check("create: 垂直/旋转/Z字 手法", page.locator("#dip-group .opt").count() == 3)
        shot(page, "02-create-empty")

        # ---------- 滴漆 + 拉纹 ----------
        page.evaluate("window.__game.drop(0.35, 0.6)")
        page.evaluate("window.__game.drop(0.62, 0.55)")
        page.evaluate("window.__game.setColor(1)")
        page.evaluate("window.__game.drop(0.48, 0.7)")
        page.wait_for_timeout(900)
        page.evaluate("window.__game.stroke([[0.2,0.5],[0.34,0.57],[0.48,0.49],[0.62,0.57],[0.78,0.49]])")
        page.wait_for_timeout(900)
        snap = page.evaluate("window.__game.snapshot()")
        check("滴漆 counted (3 drops)", snap["drops"] == 3, str(snap))
        check("漆膜覆盖率 > 0", snap["coverage"] > 0.005, str(snap))
        check("拉纹 counted", snap["drags"] > 0, str(snap))
        shot(page, "03-create-dyed")

        # ---------- 空水面入水应被拦下 ----------
        page.evaluate("window.__game.resetWater()")
        page.wait_for_timeout(300)
        blocked = page.evaluate("window.__game.dip()")
        check("空水面入水被拦下", blocked is False, str(blocked))

        # ---------- 入水拓印（三种手法纹路应不同） ----------
        patterns = {}
        for dip_id in ["vertical", "rotate", "zigzag"]:
            page.evaluate("window.__game.resetWater()")
            page.wait_for_timeout(200)
            page.evaluate("window.__game.setPreset('qianli')")
            page.evaluate("window.__game.drop(0.35, 0.6)")
            page.evaluate("window.__game.setColor(2)")
            page.evaluate("window.__game.drop(0.6, 0.55)")
            page.evaluate("window.__game.stroke([[0.2,0.5],[0.4,0.58],[0.6,0.5],[0.8,0.58]])")
            page.wait_for_timeout(1100)
            page.evaluate("window.__game.setDip('%s')" % dip_id)
            sig = page.evaluate(
                "(function(){var E=window.QSEngine,S=window.QSScene;"
                "var cap=E.capture();var st=window.__game.state();"
                "var cv=S.buildPattern(cap,st.dip,12345);"
                "var g=cv.getContext('2d');var d=g.getImageData(0,0,cv.width,cv.height).data;"
                "var h=0,n=0;for(var i=0;i<d.length;i+=4){"
                "h=(h*31+d[i]+d[i+1]*3+d[i+2]*7+d[i+3])>>>0;if(d[i+3]>0)n++;}"
                "return {cov:E.coverage(cap),hash:h,inked:n};})()")
            patterns[dip_id] = sig["hash"]
            check("拓印 %s: dye captured" % dip_id, sig["cov"] > 0.02, str(sig["cov"]))
            check("拓印 %s: 扇面有漆纹像素" % dip_id, sig["inked"] > 8000, str(sig["inked"]))

        check("三种入水手法纹路不同",
              len(set(patterns.values())) == 3,
              str(patterns))

        # ---------- 完整入水 → 成品 ----------
        page.evaluate("window.__game.setShape('round')")
        page.evaluate("window.__game.setDip('rotate')")
        ok = page.evaluate("window.__game.dip()")
        check("入水拓印 accepted", ok is True, str(ok))
        page.wait_for_selector("#view-result.is-active", timeout=6000)
        page.wait_for_timeout(1200)
        res = page.evaluate("window.__game.result()")
        check("成品: 扇面有漆纹图层", res["hasPattern"] is True, str(res))
        check("成品: 自动起名", len(res["name"]) >= 2, str(res))
        check("成品: 知识卡", bool(res["knowledge"]), str(res))
        fan_pixels = page.evaluate(
            "(function(){var c=document.getElementById('fan-result');"
            "var g=c.getContext('2d');var d=g.getImageData(0,0,c.width,c.height).data;"
            "var fan=0,total=d.length/4;"
            "for(var i=0;i<d.length;i+=4){var r=d[i],gg=d[i+1],bb=d[i+2];"
            "if(!(r<40&&gg<40&&bb<50))fan++;}"
            "return {fan:fan,total:total,ratio:fan/total};})()")
        check("成品 canvas 扇面已绘制", fan_pixels["ratio"] > 0.12, str(fan_pixels))
        shot(page, "04-result-round")

        # ---------- 起名 + localStorage ----------
        page.fill("#fan-name", "流云映水")
        page.wait_for_timeout(200)
        renamed = page.evaluate("window.__game.result().name")
        check("用户起名生效", renamed == "流云映水", renamed)
        works = page.evaluate("window.__game.works()")
        check("localStorage 存作品", len(works) >= 1 and works[0]["name"] == "流云映水", str(works[:1]))
        check("作品缩略图存在", bool(works and works[0]["thumb"].startswith("data:image")), "")

        # ---------- 分享卡 ----------
        card_len = page.evaluate("window.__game.shareCard()")
        check("分享卡生成 dataURL", card_len > 20000, str(card_len))

        # 端能力 mock：验证 writeTempFile → saveImageToPhotosAlbum 链路
        page.evaluate(
            "window.__calls=[];window.xhs={miniTool:{"
            "writeTempFile:function(o){window.__calls.push(['writeTempFile',o.data.length]);"
            "o.success({filePath:'/tmp/f.png',errMsg:'writeTempFile:ok'});},"
            "saveImageToPhotosAlbum:function(o){window.__calls.push(['save',o.filePath]);"
            "if(o.success)o.success({errMsg:'saveImageToPhotosAlbum:ok'});},"
            "postNote:function(o){window.__calls.push(['postNote',o.title,o.mediaInfo.image_resources[0].url]);"
            "if(o.success)o.success({errMsg:'postNote:ok'});}}};")
        page.click("#btn-save-album")
        page.wait_for_timeout(300)
        page.click("#btn-post-note")
        page.wait_for_timeout(300)
        calls = page.evaluate("window.__calls")
        kinds = [c[0] for c in calls]
        check("存相册链路 writeTempFile→save", kinds[:2] == ["writeTempFile", "save"], str(calls))
        check("发笔记链路 writeTempFile→postNote", kinds[2:] == ["writeTempFile", "postNote"], str(calls))
        check("postNote 传 filePath 非网络地址",
              calls[3][2] == "/tmp/f.png" and not calls[3][2].startswith("http"), str(calls[3]))

        # ---------- 折扇 ----------
        page.click("#btn-redo")
        page.wait_for_selector("#view-create.is-active")
        page.evaluate("window.__game.setShape('fold')")
        page.evaluate("window.__game.setPreset('gugong')")
        page.evaluate("window.__game.drop(0.4, 0.6)")
        page.evaluate("window.__game.drop(0.58, 0.52)")
        page.wait_for_timeout(900)
        page.evaluate("window.__game.setDip('zigzag')")
        page.evaluate("window.__game.dip()")
        page.wait_for_selector("#view-result.is-active", timeout=6000)
        page.wait_for_timeout(1100)
        res2 = page.evaluate("window.__game.result()")
        check("折扇成品", res2["shape"] == "fold" and res2["dip"] == "zigzag", str(res2))
        shot(page, "05-result-fold")

        # ---------- demo 自驾 ----------
        page2 = browser.new_page(viewport={"width": 390, "height": 844})
        page2.on("pageerror", lambda e: errors.append("pageerror2: " + str(e)))
        page2.on("console", lambda m: errors.append("console2: " + m.text) if m.type == "error" else None)
        page2.goto(URL_DEMO)
        page2.wait_for_function("window.__ready === true", timeout=15000)
        time.sleep(14)
        snap2 = page2.evaluate("window.__game.snapshot()")
        check("demo 自驾滴漆/拉纹", snap2["drops"] >= 5 and snap2["drags"] > 0, str(snap2))
        check("demo 自驾完成入水出成品", snap2["view"] == "result" and snap2["hasFan"], str(snap2))
        shot(page2, "06-demo-result")

        check("zero console/page errors", not errors, "; ".join(errors[:6]))
        browser.close()

    failed = [n for n, ok in CHECKS if not ok]
    print()
    if failed:
        print("SMOKE FAIL: %d/%d failed: %s" % (len(failed), len(CHECKS), ", ".join(failed)))
        sys.exit(1)
    print("SMOKE PASS (%d assertions) · screenshots -> %s" % (len(CHECKS), SHOTS))


if __name__ == "__main__":
    main()
