import json
import os
from playwright.sync_api import sync_playwright

ROOT = "/Users/duanchao.wzj/AI/workspace/red-tool"
SHOT_DIR = os.path.join(ROOT, ".sdd", "shots")
os.makedirs(SHOT_DIR, exist_ok=True)
URL = "file://" + ROOT + "/tools/qiqiao/index.html?test=1"

results = {}
dialogs = []
pageerrors = []


def active_view(page):
    return page.evaluate("document.querySelector('.view.is-active').id")


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: pageerrors.append(str(e)))
    page.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))

    page.goto(URL, wait_until="load")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="load")
    page.wait_for_timeout(200)

    results["boot_view"] = active_view(page)

    # 2. fresh codex from home
    page.click("#btn-codex-home")
    page.wait_for_timeout(100)
    fresh = page.evaluate("""() => {
      const cells = Array.from(document.querySelectorAll('#codex-grid .codex-cell'));
      return {
        view: document.querySelector('.view.is-active').id,
        count: document.getElementById('codex-count').textContent,
        n: cells.length,
        locked: cells.filter(c => c.classList.contains('is-locked')).length
      };
    }""")
    results["fresh_codex"] = fresh
    page.click("#btn-codex-back")
    page.wait_for_timeout(100)
    results["back_from_codex_home"] = {
        "view": active_view(page),
        "progress": page.evaluate("document.getElementById('home-progress').textContent")
    }

    # 3. full divination run
    page.click("#btn-start")
    page.wait_for_function("__game.snapshot().phase==='water'")
    box = page.locator("#stage").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(cx, cy)
    page.mouse.down()
    page.wait_for_function("__game.snapshot().phase==='calm'")
    page.evaluate("""() => new Promise(res => {
      (function chk() {
        const s = __game.snapshot();
        if (s.phase !== 'calm') return res();
        if ((s.calmT % 2.4) / 2.4 > 0.93) return res();
        requestAnimationFrame(chk);
      })();
    })""")
    page.mouse.up()
    page.wait_for_function("__game.snapshot().phase==='result'", timeout=15000)
    shadow_id = page.evaluate("__game.snapshot().result.shadowId")
    toast_ok = True
    try:
        page.wait_for_function(
            "document.getElementById('toast').textContent.indexOf('影形入鉴') >= 0", timeout=4000)
    except Exception:
        toast_ok = False
    results["toast_text"] = page.evaluate("document.getElementById('toast').textContent")
    results["toast_ok"] = toast_ok
    page.wait_for_function(
        "document.getElementById('view-result').classList.contains('is-active')", timeout=8000)
    results["run_shadow"] = shadow_id

    last_stats = page.evaluate("window.QQShare.lastStats")
    results["last_stats"] = {
        "keys": sorted(last_stats.keys()) if last_stats else None,
        "shadowId": last_stats and last_stats.get("shadowId"),
        "textLines_n": last_stats and len(last_stats.get("textLines") or []),
        "codexCount": last_stats and last_stats.get("codexCount"),
    }

    page.click("#btn-codex-result")
    page.wait_for_timeout(100)
    one = page.evaluate("""(shadowId) => {
      const cells = Array.from(document.querySelectorAll('#codex-grid .codex-cell'));
      const idx = window.QQData.SHADOWS.findIndex(s => s.id === shadowId);
      const cell = cells[idx];
      const cv = cell.querySelector('canvas');
      const d = cv.getContext('2d').getImageData(0, 0, 120, 120).data;
      let ink = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 40 && d[i] < 110 && d[i + 1] < 110 && d[i + 2] < 110) ink++;
      }
      return {
        view: document.querySelector('.view.is-active').id,
        count: document.getElementById('codex-count').textContent,
        idx: idx,
        cellLocked: cell.classList.contains('is-locked'),
        cellName: (cell.querySelector('.codex-cell-name') || {}).textContent,
        inkpx: ink,
        lockedOthers: cells.filter((c, i) => i !== idx && c.classList.contains('is-locked')).length
      };
    }""", shadow_id)
    results["codex_after_run"] = one
    page.click("#btn-codex-back")
    page.wait_for_timeout(100)
    results["back_from_codex_result"] = active_view(page)

    # 4. detail card
    page.click("#btn-codex-result")
    page.wait_for_timeout(100)
    idx = page.evaluate("(id) => window.QQData.SHADOWS.findIndex(s => s.id === id)", shadow_id)
    page.locator("#codex-grid .codex-cell").nth(idx).click()
    page.wait_for_timeout(100)
    card = page.evaluate("""() => {
      const cv = document.getElementById('codex-canvas');
      const d = cv.getContext('2d').getImageData(0, 0, 120, 120).data;
      let ink = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 40 && d[i] < 110 && d[i + 1] < 110 && d[i + 2] < 110) ink++;
      }
      return {
        on: document.getElementById('codex-card').classList.contains('is-on'),
        name: document.getElementById('codex-card-name').textContent,
        text: document.getElementById('codex-card-text').textContent,
        inkpx: ink
      };
    }""")
    results["detail_card"] = card
    page.click("#codex-card-close")
    page.wait_for_timeout(100)
    results["card_closed"] = not page.evaluate(
        "document.getElementById('codex-card').classList.contains('is-on')")
    page.click("#btn-codex-back")
    page.wait_for_timeout(100)
    page.click("#btn-home-result")
    page.wait_for_timeout(100)

    # 5. unlockAll + persistence
    page.evaluate("__game.unlockAll()")
    page.click("#btn-codex-home")
    page.wait_for_timeout(100)
    full = page.evaluate("""() => {
      const cells = Array.from(document.querySelectorAll('#codex-grid .codex-cell'));
      return {
        count: document.getElementById('codex-count').textContent,
        locked: cells.filter(c => c.classList.contains('is-locked')).length,
        n: cells.length
      };
    }""")
    results["codex_full"] = full
    page.screenshot(path=os.path.join(SHOT_DIR, "qq7-codex-full.png"))
    page.reload(wait_until="load")
    page.wait_for_timeout(200)
    page.click("#btn-codex-home")
    page.wait_for_timeout(100)
    results["codex_persist"] = page.evaluate(
        "document.getElementById('codex-count').textContent")
    page.click("#btn-codex-back")

    # 6. paintCard output
    paint = page.evaluate("""() => {
      const D = window.QQData;
      const sh = D.SHADOWS[1];
      const gr = D.GRADES[0];
      const ap = D.ASPECTS[2];
      window.QQShare.lastStats = {
        shadowId: sh.id, shadowName: sh.name,
        gradeId: gr.id, gradeName: gr.name,
        aspectName: ap.name,
        textLines: [sh.text, ap.text, gr.text],
        codexCount: 12
      };
      const url = window.QQShare.paintCard(window.QQShare.lastStats);
      return new Promise(res => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = 900; c.height = 1200;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(img, 0, 0);
          const corner = g.getImageData(10, 10, 1, 1).data;
          let ink = 0;
          const d = g.getImageData(250, 200, 400, 380).data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] > 40 && d[i] < 110 && d[i + 1] < 110 && d[i + 2] < 110) ink++;
          }
          res({
            prefix: url.slice(0, 22), w: img.width, h: img.height,
            corner: [corner[0], corner[1], corner[2]], inkpx: ink
          });
        };
        img.onerror = () => res({ error: 'img-decode-fail' });
        img.src = url;
      });
    }""")
    results["paint_card"] = paint

    # 9b. share card screenshot via <img>
    page.evaluate("""() => {
      const url = window.QQShare.paintCard(window.QQShare.lastStats);
      const img = document.createElement('img');
      img.id = 'qq7-card-img';
      img.src = url;
      img.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:400px;z-index:99999;background:#fff';
      document.body.appendChild(img);
    }""")
    page.wait_for_function(
        "document.getElementById('qq7-card-img').complete && document.getElementById('qq7-card-img').naturalWidth===900")
    page.locator("#qq7-card-img").screenshot(path=os.path.join(SHOT_DIR, "qq7-card.png"))
    page.evaluate("document.getElementById('qq7-card-img').remove()")

    # 7. fallback dialogs without xhs
    page.evaluate("document.getElementById('btn-save-album').click()")
    page.wait_for_timeout(150)
    page.evaluate("document.getElementById('btn-post-note').click()")
    page.wait_for_timeout(150)
    results["fallback_dialogs"] = list(dialogs)

    # 8. mock xhs
    page.evaluate("""() => {
      window.__calls = [];
      window.xhs = { miniTool: {
        writeTempFile: function (o) {
          window.__calls.push(['writeTempFile', o && typeof o.data === 'string' ? o.data.slice(0, 21) : null]);
          if (o && o.success) o.success({ filePath: '/tmp/qq7-card.png' });
        },
        saveImageToPhotosAlbum: function (o) {
          window.__calls.push(['saveImageToPhotosAlbum', o && o.filePath]);
          if (o && o.success) o.success({});
        },
        postNote: function (o) {
          window.__calls.push(['postNote', o]);
          if (o && o.success) o.success({});
        }
      } };
    }""")
    page.evaluate("document.getElementById('btn-save-album').click()")
    page.wait_for_timeout(150)
    page.evaluate("document.getElementById('btn-post-note').click()")
    page.wait_for_timeout(150)
    calls = page.evaluate("""() => window.__calls.map(c => {
      if (c[0] === 'postNote') {
        const o = c[1];
        return ['postNote', {
          title: o.title, titleLen: o.title.length,
          content: o.content, tags: o.tags,
          url: o.mediaInfo && o.mediaInfo.image_resources && o.mediaInfo.image_resources[0].url
        }];
      }
      return c;
    })""")
    results["xhs_calls"] = calls
    results["all_dialogs"] = list(dialogs)

    page.evaluate("localStorage.clear()")
    browser.close()

results["pageerrors"] = pageerrors

ok = True
def chk(name, cond):
    global ok
    results.setdefault("checks", {})[name] = bool(cond)
    if not cond:
        ok = False

fx = results["fresh_codex"]
chk("no_pageerrors", not pageerrors)
chk("fresh_0_of_12", fx["count"] == "0/12" and fx["n"] == 12 and fx["locked"] == 12 and fx["view"] == "view-codex")
chk("back_home_refresh", results["back_from_codex_home"]["view"] == "view-home" and "0/12" in results["back_from_codex_home"]["progress"])
chk("toast_first_unlock", results["toast_ok"] and "影形入鉴" in results["toast_text"])
ls = results["last_stats"]
chk("last_stats_shape", ls["keys"] == ["aspectName", "codexCount", "gradeId", "gradeName", "shadowId", "shadowName", "textLines"] and ls["shadowId"] == results["run_shadow"] and ls["textLines_n"] == 3 and ls["codexCount"] == 1)
cr = results["codex_after_run"]
chk("codex_1_of_12", cr["count"] == "1/12" and not cr["cellLocked"] and cr["inkpx"] > 200 and cr["lockedOthers"] == 11 and cr["view"] == "view-codex")
chk("back_to_result", results["back_from_codex_result"] == "view-result")
dc = results["detail_card"]
chk("detail_card", dc["on"] and dc["name"] and dc["text"] and len(dc["text"]) > 10 and dc["inkpx"] > 200 and results["card_closed"])
chk("codex_full", results["codex_full"]["count"] == "12/12" and results["codex_full"]["locked"] == 0)
chk("codex_persist", results["codex_persist"] == "12/12")
pc = results["paint_card"]
chk("paint_card", pc.get("prefix", "").startswith("data:image/png") and pc.get("w") == 900 and pc.get("h") == 1200
    and abs(pc["corner"][0] - 245) <= 10 and abs(pc["corner"][1] - 240) <= 10 and abs(pc["corner"][2] - 230) <= 10
    and pc["inkpx"] > 3000)
fb = results["fallback_dialogs"]
chk("fallback_dialogs", len(fb) == 2 and all("当前环境暂不支持直接保存，请截图保存哦" in m for m in fb))
calls = results["xhs_calls"]
names = [c[0] for c in calls]
wf = [c for c in calls if c[0] == "writeTempFile"]
sa = [c for c in calls if c[0] == "saveImageToPhotosAlbum"]
pn = [c for c in calls if c[0] == "postNote"]
chk("xhs_flow", names == ["writeTempFile", "saveImageToPhotosAlbum", "writeTempFile", "postNote"]
    and all(w[1] == "data:image/png;base64" for w in wf)
    and len(sa) == 1 and sa[0][1] == "/tmp/qq7-card.png"
    and len(pn) == 1 and pn[0][1]["titleLen"] <= 20
    and pn[0][1]["url"] == "/tmp/qq7-card.png"
    and "#国风vibecoding" in pn[0][1]["tags"] and "#七夕" in pn[0][1]["tags"]
    and "丢针试巧" in pn[0][1]["content"])

print(json.dumps(results, indent=2, ensure_ascii=False))
print("RESULT:", "PASS" if ok else "FAIL")
