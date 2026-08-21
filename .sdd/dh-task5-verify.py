import os, sys
from playwright.sync_api import sync_playwright

ROOT = "/Users/duanchao.wzj/AI/workspace/red-tool"
URL = "file://" + ROOT + "/tools/dunhuang/index.html?test=1"
SHOTS = os.path.join(ROOT, ".sdd", "shots")
os.makedirs(SHOTS, exist_ok=True)

errors = []
dialogs = []
results = []

def check(name, ok, extra=""):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + ((" | " + str(extra)) if extra != "" else ""))

UNLOCK = ["qingshi", "shilv", "zhusha", "cihuang", "zheshi"]
FALLBACK = "当前环境暂不支持直接保存，请截图保存哦"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(300)

    page.evaluate("(ids) => { ids.forEach(function (id) { DHSave.unlock(id); }); }", UNLOCK)

    page.evaluate("document.getElementById('btn-build').click()")
    page.wait_for_timeout(250)
    check("2a. build view active", page.evaluate("document.getElementById('view-build').classList.contains('is-active')"))

    page.evaluate("document.getElementById('btn-make-card').click()")
    stamp_cls = page.evaluate("document.getElementById('result-card').classList.contains('stamp-in')")
    check("6. entrance class applied right after make-card", stamp_cls)
    page.wait_for_timeout(600)

    check("2b. result view active", page.evaluate("document.getElementById('view-result').classList.contains('is-active')"))
    nz, w, h = page.evaluate("""(() => {
        const cv = document.getElementById('result-card');
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let n = 0;
        for (let k = 3; k < d.length; k += 4) if (d[k] > 0) n++;
        return [n, cv.width, cv.height];
    })()""")
    check("2c. result-card non-blank", nz > 10000, nz)
    check("2d. canvas 3:4", w * 4 == h * 3, "%dx%d" % (w, h))
    box = page.evaluate("""(() => {
        const r = document.getElementById('result-card').getBoundingClientRect();
        return [r.width, r.height];
    })()""")
    check("2e. displayed 3:4 fit", abs(box[0] / box[1] - 0.75) < 0.01, box)

    stats_ok = page.evaluate("""(() => {
        const st = window.DHShare && window.DHShare.lastStats;
        if (!st) return null;
        return {
            png: st.dataUrl.indexOf('data:image/png') === 0,
            title: st.title, content: st.content, tags: st.tags, n: st.colorCount
        };
    })()""")
    check("2f. DHShare.lastStats dataURL png", bool(stats_ok) and stats_ok["png"], stats_ok)
    check("2g. title/content/tags/count", bool(stats_ok) and stats_ok["title"] == "我在敦煌拾了5色"
          and stats_ok["content"] == "拾取千年矿物色，拼一张敦煌色卡。"
          and stats_ok["tags"] == "#国风vibecoding #敦煌 #敦煌色卡 #非遗 #国风 #中式美学"
          and stats_ok["n"] == 5, stats_ok)

    save_ok = page.evaluate("""(() => {
        const o = DHSave.load();
        return { cards: o.cards, lb: !!o.lastBuild && o.lastBuild.colors.length === 5 };
    })()""")
    check("2h. cards===1 and lastBuild stored", save_ok["cards"] == 1 and save_ok["lb"], save_ok)

    page.screenshot(path=os.path.join(SHOTS, "dh5-result.png"))
    check("7. screenshot saved", os.path.exists(os.path.join(SHOTS, "dh5-result.png")))

    dialogs[:] = []
    page.click("#btn-save-album")
    page.wait_for_timeout(200)
    check("3a. save-album fallback alert", dialogs == [FALLBACK], dialogs)
    dialogs[:] = []
    page.click("#btn-post-note")
    page.wait_for_timeout(200)
    check("3b. post-note fallback alert", dialogs == [FALLBACK], dialogs)

    page.evaluate("""() => {
        window.__calls = [];
        window.xhs = { miniTool: {
            writeTempFile: function (o) {
                window.__calls.push(['writeTempFile', (o.data || '').slice(0, 22)]);
                if (o.success) o.success({ filePath: 'tmp://dh-card.png' });
            },
            saveImageToPhotosAlbum: function (o) {
                window.__calls.push(['saveImageToPhotosAlbum', o.filePath]);
                if (o.success) o.success({});
            },
            postNote: function (o) {
                window.__calls.push(['postNote', { title: o.title, content: o.content, tags: o.tags, url: o.mediaInfo && o.mediaInfo.image_resources && o.mediaInfo.image_resources[0] && o.mediaInfo.image_resources[0].url }]);
                if (o.success) o.success({});
            }
        } };
    }""")

    dialogs[:] = []
    page.click("#btn-save-album")
    page.wait_for_timeout(200)
    calls = page.evaluate("window.__calls")
    check("4a. writeTempFile data: prefix -> saveImageToPhotosAlbum filePath",
          len(calls) == 2 and calls[0][0] == "writeTempFile" and calls[0][1].startswith("data:image/png")
          and calls[1] == ["saveImageToPhotosAlbum", "tmp://dh-card.png"], calls)
    check("4b. saved-to-album alert", dialogs == ["已保存到相册"], dialogs)

    page.evaluate("window.__calls = []")
    dialogs[:] = []
    page.click("#btn-post-note")
    page.wait_for_timeout(200)
    calls = page.evaluate("window.__calls")
    ok4c = (len(calls) == 2 and calls[0][0] == "writeTempFile" and calls[1][0] == "postNote"
            and calls[1][1]["title"] == "我在敦煌拾了5色" and len(calls[1][1]["title"]) <= 20
            and calls[1][1]["content"] == "拾取千年矿物色，拼一张敦煌色卡。"
            and calls[1][1]["tags"] == "#国风vibecoding #敦煌 #敦煌色卡 #非遗 #国风 #中式美学"
            and calls[1][1]["url"] == "tmp://dh-card.png")
    check("4c. postNote title<=20/tags/mediaInfo filePath", ok4c, calls)

    sel_before = page.evaluate("window.__game.buildSel.colors.slice()")
    page.click("#btn-again")
    page.wait_for_timeout(250)
    check("5a. back to build view", page.evaluate("document.getElementById('view-build').classList.contains('is-active')"))
    sel_after = page.evaluate("window.__game.buildSel.colors.slice()")
    on_count = page.evaluate("document.querySelectorAll('#color-chips .color-chip.is-on').length")
    check("5b. buildSel preserved + chips same selection",
          sel_before == sel_after and on_count == len(sel_before), (sel_after, on_count))

    page.evaluate("document.getElementById('btn-make-card').click()")
    page.wait_for_timeout(600)
    check("5c. second card made (cards===2)", page.evaluate("DHSave.load().cards") == 2)
    stamp_again = page.evaluate("document.getElementById('result-card').classList.contains('stamp-in')")
    check("6b. entrance class re-triggered on second entry", stamp_again)

    page.click("#btn-home-result")
    page.wait_for_timeout(250)
    prog = page.evaluate("document.getElementById('home-progress').textContent")
    check("5d. home active + progress line",
          page.evaluate("document.getElementById('view-home').classList.contains('is-active')")
          and "成卡 2 张" in prog and "已集 5/18 色" in prog, prog)

    real_errors = [e for e in errors if "audio" not in e.lower() and "404" not in e]
    check("1. no pageerrors", len(real_errors) == 0, "; ".join(real_errors[:3]))

    page.evaluate("localStorage.clear()")
    browser.close()

passed = sum(results)
print("\n%d/%d checks passed" % (passed, len(results)))
sys.exit(0 if passed == len(results) else 1)
