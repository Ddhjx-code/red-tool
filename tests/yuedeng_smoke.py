#!/usr/bin/env python3
"""Headless smoke suite for 月下灯会 (tools/yuedeng). Run: python3 tests/yuedeng_smoke.py"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "yuedeng" / "index.html"
URL_TEST = TOOL.as_uri() + "?test=1"
URL_HOME = TOOL.as_uri()
SHOTS = ROOT / "tools" / "yuedeng" / "screenshots"

WEBGL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

CHECKS = []

# 灯面矩形 uv 内的两道固定笔触（LAMP_C .5/.46，LAMP_HW .315，LAMP_HH .225）。
# 两遍跑同一套输入 → 确定性对比用，故写在模块级而不是散在主流程里。
STROKES = [
    [[0.34, 0.46], [0.50, 0.52], [0.66, 0.44]],
    [[0.40, 0.40], [0.52, 0.46], [0.62, 0.52]],
]

MODULES = ["data.js", "engine.js", "scene.js", "save.js", "share.js", "main.js", "finale.js"]


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok  " if cond else "  FAIL ") + name + ((" | " + str(extra)) if extra and not cond else ""))


def shot(page, name):
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOTS / (name + ".png")))


def build_lamp(page):
    """同一套输入造一盏灯（桂金+朱砂两道纹 / 六角灯 / P3 / 点亮 → 放灯）。"""
    page.evaluate("window.__game.start()")
    page.wait_for_selector("#view-create.is-active")
    page.evaluate("window.__game.setColor(1)")
    page.evaluate("window.__game.paintDrag(%s)" % json.dumps(STROKES[0]))
    page.evaluate("window.__game.setColor(2)")
    page.evaluate("window.__game.paintDrag(%s)" % json.dumps(STROKES[1]))
    page.wait_for_timeout(1200)
    page.evaluate("window.__game.setShape(2)")
    # 月相是循环量：先把档位归到同一基线再循环两次，两遍跑的输入才真的相同。
    page.evaluate("window.YDScene.setPhase('P1')")
    page.evaluate("window.__game.cyclePhase(); window.__game.cyclePhase()")
    page.evaluate("window.__game.setLit(true)")
    page.evaluate("window.__game.release()")
    page.wait_for_selector("#view-result.is-active", timeout=6000)
    return page.evaluate("window.__game.result()")


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=WEBGL_ARGS)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        # ---------- UI 流程：home ----------
        page.goto(URL_TEST)
        page.wait_for_function("window.__ready === true", timeout=15000)
        check("hooks exposed", page.evaluate("!!window.__game"))
        check("engine ok (WebGL float)", page.evaluate("window.__game.snapshot().engineOk"))
        check("home view active", page.locator("#view-home.is-active").count() == 1)
        intro_len = page.locator("#home-intro p").count()
        intro_table = page.evaluate("window.YDData.INTRO.length")
        check("home: 中秋灯会 intro 与 INTRO 表同数", intro_len == intro_table == 3, str(intro_len))
        craft_len = page.locator("#home-craft p").count()
        check("home: 灯笼工艺 2 段且有正文",
              craft_len == 2 and page.locator("#home-craft p").first.inner_text() != "", str(craft_len))
        shot(page, "smoke-01-home")

        # ---------- create ----------
        page.click("#btn-start")
        page.wait_for_selector("#view-create.is-active")
        page.wait_for_timeout(400)
        colors_n = page.evaluate("window.YDData.COLORS.length")
        swatches = page.locator("#palette .swatch").count()
        check("create: 灯色色卡 = COLORS 表条数", swatches == colors_n, str(swatches))
        shapes_n = page.evaluate("window.YDData.SHAPES.length")
        shape_btns = page.locator("#shapes .shape-btn").count()
        check("create: 灯形按钮 = SHAPES 表条数", shape_btns == shapes_n, str(shape_btns))

        # ---------- 选灯色 → 单行上下文提示随之更新 ----------
        label0 = page.locator("#current-label").inner_text()
        page.evaluate("window.__game.setColor(2)")
        label1 = page.locator("#current-label").inner_text()
        check("选灯色: snapshot.color 生效",
              page.evaluate("window.__game.snapshot().color") == "zhusha")
        check("选灯色: #current-label 文案随之更新", label1 != label0 and "朱砂" in label1, label1)

        # ---------- 绘纹 → 流体扩散 ----------
        # 空白灯面本身不透明且暖白带微色差，故基线 chromaPixels 不为 0；
        # 绘纹是否落地要看相对基线的增量。
        blank = page.evaluate("window.__game.lampPixels()")
        page.evaluate("window.__game.paintDrag(%s)" % json.dumps(STROKES[0]))
        page.evaluate("window.__game.paintDrag(%s)" % json.dumps(STROKES[1]))
        page.wait_for_timeout(1200)
        painted = page.evaluate("window.__game.lampPixels()")
        check("绘纹产生扩散 (chromaPixels 高于空白基线)",
              painted["chromaPixels"] > 0 and painted["chromaPixels"] > blank["chromaPixels"] * 4,
              str((blank["chromaPixels"], painted["chromaPixels"])))
        check("绘纹 counted (2 笔)", page.evaluate("window.__game.snapshot().splats") == 2)

        # ---------- 视口变化不得清空灯面 ----------
        # resize 会重建全部 FBO；若重建时不搬旧内容，用户画到一半只要视口尺寸一变
        # （触摸设备地址栏显隐、横竖屏切换、软键盘弹出）整幅画就被清空 —— 用户
        # 看到的是「画着画着回到开头」。冒烟用例从不改视口，所以此前一直没抓到。
        chroma_before = page.evaluate("window.__game.lampPixels()")["chromaPixels"]
        page.evaluate("document.getElementById('lamp').style.height = '440px'")
        page.wait_for_timeout(300)
        page.evaluate("window.YDEngine.resize()")
        page.wait_for_timeout(600)
        chroma_after = page.evaluate("window.__game.lampPixels()")["chromaPixels"]
        check("视口变化: 灯面颜料未被清空",
              chroma_after > chroma_before * 0.75,
              "before=%d after=%d" % (chroma_before, chroma_after))
        page.evaluate("document.getElementById('lamp').style.height = ''")
        page.wait_for_timeout(300)
        page.evaluate("window.YDEngine.resize()")
        page.wait_for_timeout(600)

        shot(page, "smoke-02-create")

        # ---------- 换灯形 → 轮廓形变 ----------
        page.evaluate("window.__game.setShape(3)")
        check("换灯形: snapshot.shape 变成 lotus",
              page.evaluate("window.__game.snapshot().shape") == "lotus")
        page.wait_for_function("window.YDEngine.state().shapeW[3] > 0.9", timeout=30000)
        check("换灯形: 轮廓权重形变到位 (uShapeW.w > 0.9)",
              page.evaluate("window.YDEngine.state().shapeW[3]") > 0.9)

        # ---------- 点亮：引擎与舞台双双报亮 ----------
        page.evaluate("window.__game.setLit(true)")
        snap = page.evaluate("window.__game.snapshot()")
        check("点亮: 引擎报亮 (engineLit=1)", snap["engineLit"] == 1, str(snap))
        check("点亮: 舞台报亮 (sceneLit/lit)", snap["sceneLit"] is True and snap["lit"] is True, str(snap))
        check("点亮: #light-btn 加 is-on", page.locator("#light-btn.is-on").count() == 1)
        check("点亮: #stage.is-lit 群灯齐明", page.locator("#stage.is-lit").count() == 1)
        # litLevel 是 1.15s 的缓动量（LIT_DUR_ON）。不等它到位就截图，拍到的是
        # uLit≈0 的未点亮灯 —— 而 engineLit 报的是 litTarget，断言照样通过，
        # 于是「点亮＝无光」这个假象能一路骗过测试。故此处必须等真实渲染量。
        page.wait_for_function("window.YDEngine.state().litLevel > 0.98", timeout=5000)
        check("点亮: 渲染亮到位 (litLevel>0.98)",
              page.evaluate("window.YDEngine.state().litLevel") > 0.98)
        shot(page, "smoke-03-lit")

        # ---------- 月相：一枚按钮循环五档 ----------
        codes = [page.evaluate("window.__game.snapshot().phase")]
        names = [page.locator("#phase-btn .pname").inner_text()]
        for _ in range(5):
            page.click("#phase-btn")
            codes.append(page.evaluate("window.__game.snapshot().phase"))
            names.append(page.locator("#phase-btn .pname").inner_text())
        check("月相: 五档全部出现", sorted(set(codes)) == ["P1", "P2", "P3", "P4", "P5"], str(codes))
        check("月相: 按钮文案每次都在变",
              len(set(names)) == 5 and all(names[i] != names[i - 1] for i in range(1, 6)), str(names))

        # ---------- 灯会盛景：三层景深灯数 ----------
        layers = page.evaluate(
            "(function(){var t={far:0,mid:0,near:0};"
            "window.YDData.FESTIVAL_LAMPS.forEach(function(l){t[l.layer]++;});return t;})()")
        sc = page.evaluate("window.YDScene.state()")
        check("灯会: FESTIVAL_LAMPS 14 远 / 8 中 / 4 近",
              layers == {"far": 14, "mid": 8, "near": 4}, str(layers))
        check("灯会: 场景实建灯数与数据表逐层相符",
              sc["far"] == layers["far"] and sc["mid"] == layers["mid"] and
              sc["near"] == layers["near"] and sc["lamps"] == sum(layers.values()), str(sc))
        check("灯会: DOM 灯节点逐层相符",
              page.locator("#far-lamps .fl").count() == layers["far"] and
              page.locator("#fest-lamps .fest.mid").count() == layers["mid"] and
              page.locator("#fest-lamps .fest.near").count() == layers["near"])

        # ---------- 放灯 → 成品 ----------
        works_before = page.evaluate("window.YDSave.count()")
        page.click("#btn-release")
        page.wait_for_selector("#view-result.is-active", timeout=6000)
        page.wait_for_timeout(600)
        check("放灯: 到成品视图", page.locator("#view-result.is-active").count() == 1)
        check("成品: 灯名非空", page.input_value("#lamp-name") != "")
        check("成品: #result-meta 有小记", page.locator("#result-meta").inner_text() != "")
        check("成品: #result-know 有知识卡",
              page.locator("#result-know .card-title").count() == 1 and
              page.locator("#result-know").inner_text() != "")
        res_a = page.evaluate("window.__game.result()")
        check("成品: 记录字段齐全", all(res_a[k] for k in ("shape", "placement", "phase", "colors")), str(res_a))
        works_after = page.evaluate("window.YDSave.count()")
        check("存档: YDSave.count() +1", works_after == works_before + 1, str((works_before, works_after)))
        works = page.evaluate("window.__game.works()")
        check("存档: 缩略图是 data:image", len(works) >= 1 and works[0]["thumb"].startswith("data:image"))
        shot(page, "smoke-04-result")

        # ---------- 起名 ----------
        page.fill("#lamp-name", "桂影流光")
        page.wait_for_timeout(200)
        check("起名: result() 生效", page.evaluate("window.__game.result().name") == "桂影流光")
        check("起名: 同步回存档", page.evaluate(
            "window.YDSave.find(window.__game.result().workId).name") == "桂影流光")

        # ---------- 分享卡 ----------
        card_len = page.evaluate("window.__game.shareCard()")
        check("分享卡生成 dataURL",
              card_len > 20000 and page.evaluate("window.YDShare.lastCard.indexOf('data:image/png') === 0"),
              str(card_len))

        # 端能力 mock：验证 writeTempFile → saveImageToPhotosAlbum / postNote 链路
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

        # ---------- 视口：无文档滚动 ----------
        scroll_h = page.evaluate("document.documentElement.scrollHeight")
        check("scrollHeight == 844 (无文档滚动)", scroll_h == 844, str(scroll_h))

        # ---------- 确定性：同一套输入两遍跑，成品元数据完全一致 ----------
        page2 = browser.new_page(viewport={"width": 390, "height": 844})
        page2.on("pageerror", lambda e: errors.append("pageerror2: " + str(e)))
        page2.on("console", lambda m: errors.append("console2: " + m.text) if m.type == "error" else None)
        page2.goto(URL_HOME)
        page2.wait_for_function("window.__ready === true", timeout=15000)
        check("无 ?test=1 时首页也是初始视图", page2.locator("#view-home.is-active").count() == 1)
        # page2 刻意不带 ?test=1（上一项断言真实用户从首页起步），
        # 但 build_lamp 要等成品视图，故显式关掉 12.5s 的 CG 结局
        page2.evaluate("window.__game.skipFinale()")
        run1 = build_lamp(page2)
        run2 = build_lamp(page2)
        keys = ("name", "note", "knowledge", "shape", "phase", "placement", "colors", "splats")
        check("确定性: 两遍同输入的成品元数据逐项相同",
              all(run1[k] == run2[k] for k in keys),
              str({k: (run1[k], run2[k]) for k in keys if run1[k] != run2[k]}))
        check("确定性: 七模块零 Math.random",
              not any("Math.random" in (ROOT / "tools" / "yuedeng" / "assets" / m).read_text(encoding="utf-8")
                      for m in MODULES))

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
