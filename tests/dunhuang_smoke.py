#!/usr/bin/env python3
"""Headless smoke/regression suite for 敦煌拾色 (tools/dunhuang).

Run: python3 tests/dunhuang_smoke.py
Loads the tool hermetically (?test=1, localStorage cleared at start and end)
and asserts: boot data tables, the full zaojing extract ritual (tap + dust
wipe + hidden color), hitTest spot-checks on all 3 murals, DHCard.paint
2 layouts x 3 bgs at 900x1200 with bg corner colors, build->make-card chain
with save counting, share fallback dialog, mocked xhs JS-API param chains,
codex persistence across reload, DHSound callability + mute persistence, and
zero console/page errors. Prints SMOKE PASS on success.
"""
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = (ROOT / "tools" / "dunhuang" / "index.html").as_uri() + "?test=1"

ZAOJING_COLORS = {"qingshi", "zhusha", "shilv", "cihuang", "zheshi", "jin"}

VIEW_ACTIVE_JS = "document.getElementById('%s').classList.contains('is-active')"

TAP_POINT_JS = """
function (sh) {
  var M = window.DHMural, cands = [], cx = 0, cy = 0, pts, j, q, p, h;
  if (sh.kind === "circle") {
    cands.push([sh.cx, sh.cy]);
    cands.push([sh.cx + sh.r * 0.45, sh.cy]);
    cands.push([sh.cx - sh.r * 0.45, sh.cy]);
    cands.push([sh.cx, sh.cy + sh.r * 0.45]);
    cands.push([sh.cx, sh.cy - sh.r * 0.45]);
  } else {
    pts = sh.pts;
    for (j = 0; j < pts.length; j++) { cx += pts[j][0]; cy += pts[j][1]; }
    cx /= pts.length; cy /= pts.length;
    cands.push([cx, cy]);
    cands.push([(cx + pts[0][0]) / 2, (cy + pts[0][1]) / 2]);
    for (j = 0; j < pts.length; j++) {
      cands.push([cx * 0.25 + pts[j][0] * 0.75, cy * 0.25 + pts[j][1] * 0.75]);
    }
    for (j = 0; j < pts.length; j++) {
      q = pts[(j + 1) % pts.length];
      cands.push([(pts[j][0] + q[0]) / 2 * 0.9 + cx * 0.1, (pts[j][1] + q[1]) / 2 * 0.9 + cy * 0.1]);
    }
    for (j = 0; j < pts.length; j++) cands.push(pts[j]);
  }
  for (j = 0; j < cands.length; j++) {
    p = M.designToCanvas(cands[j][0], cands[j][1]);
    h = M.hitTest(p.x, p.y);
    if (h && h.id === sh.id) return p;
  }
  return M.designToCanvas(cands[0][0], cands[0][1]);
}
"""

FULL_EXTRACT_JS = """
(muralId) => {
  var D = window.DHData, M = window.DHMural, E = window.DHExtract;
  var tapPoint = %s;
  E.start(muralId);
  window.__game.setView("view-extract");
  M.resize();
  function bbox(s) {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, j, p, pad;
    if (s.dustBBox) return s.dustBBox;
    if (s.kind === "circle") {
      minX = s.cx - s.r; maxX = s.cx + s.r; minY = s.cy - s.r; maxY = s.cy + s.r;
    } else {
      for (j = 0; j < s.pts.length; j++) {
        p = s.pts[j];
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
      pad = (s.w || 0) / 2 + 1;
      minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }
  var shapes = D.SHAPES[muralId], j, s, bb, a, b, x, y, step = D.BRUSH_R / 2, p;
  for (j = 0; j < shapes.length; j++) {
    s = shapes[j];
    if (!s.dusty) continue;
    bb = bbox(s);
    a = M.designToCanvas(bb.minX, bb.minY);
    b = M.designToCanvas(bb.maxX, bb.maxY);
    for (y = a.y; y <= b.y + step; y += step) {
      for (x = a.x; x <= b.x + step; x += step) M.dustAt(x, y);
    }
  }
  E.checkDust();
  for (j = 0; j < shapes.length; j++) {
    s = shapes[j];
    p = tapPoint(s);
    if (M.dustAtPoint(p.x, p.y)) M.dustAt(p.x, p.y);
    E.tap(p.x, p.y);
  }
  E.checkDust();
  return E.snapshot();
}
""" % TAP_POINT_JS

PAINT_MATRIX_JS = """
async () => {
  var layouts = ["scroll", "zaojing"], bgs = ["paper", "silk", "night"];
  var colors = window.DHData.COLORS.slice(0, 5).map(function (c) {
    return { name: c.name, hex: c.hex };
  });
  var out = [], i, j, url, img, cv, g, px;
  for (i = 0; i < layouts.length; i++) {
    for (j = 0; j < bgs.length; j++) {
      url = window.DHCard.paint({
        colors: colors.slice(0), layout: layouts[i], bg: bgs[j],
        title: window.DHData.TITLES[0], source: "莫高窟 · 测试"
      });
      if (typeof url !== "string" || url.indexOf("data:image/png") !== 0) {
        out.push({ layout: layouts[i], bg: bgs[j], ok: false });
        continue;
      }
      img = new Image();
      await new Promise(function (res, rej) { img.onload = res; img.onerror = rej; img.src = url; });
      cv = document.createElement("canvas");
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      g = cv.getContext("2d");
      g.drawImage(img, 0, 0);
      px = g.getImageData(10, 10, 1, 1).data;
      out.push({ layout: layouts[i], bg: bgs[j], ok: true,
                 w: img.naturalWidth, h: img.naturalHeight,
                 corner: [px[0], px[1], px[2]] });
    }
  }
  return out;
}
"""

MOCK_XHS_JS = """
() => {
  window.__calls = [];
  window.xhs = {
    miniTool: {
      writeTempFile: function (o) {
        window.__calls.push(["writeTempFile", typeof o.data === "string" ? o.data.slice(0, 22) : null]);
        o.success({ filePath: "tmp-dh-card.png" });
      },
      saveImageToPhotosAlbum: function (o) {
        window.__calls.push(["saveImageToPhotosAlbum", o.filePath]);
        if (o.success) o.success();
      },
      postNote: function (o) {
        window.__calls.push(["postNote", o.title, o.tags,
          o.mediaInfo && o.mediaInfo.image_resources && o.mediaInfo.image_resources[0]
            ? o.mediaInfo.image_resources[0].url : null]);
      }
    }
  };
}
"""


def view_active(view_id):
    return VIEW_ACTIVE_JS % view_id


def main():
    errors = []
    dialogs = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        def on_dialog(d):
            dialogs.append(d.message)
            d.accept()

        page.on("dialog", on_dialog)
        page.goto(URL)
        page.evaluate("localStorage.clear()")
        page.wait_for_function(
            "!!window.__game && !!window.DHData && !!window.DHSave && !!window.DHShare"
            " && !!window.DHMural && !!window.DHExtract && !!window.DHCard && !!window.DHSound",
            timeout=10000)
        page.evaluate("window.DHSound.setMuted(true)")
        page.evaluate("window.DHExtract.setCallback('alldone',"
                      " function () { window.__alldone = (window.__alldone || 0) + 1; })")

        # 1. boot: home view active, data tables 18/3/5/5
        assert page.eval_on_selector("#view-home", "el => el.classList.contains('is-active')"), \
            "home view should be active"
        assert page.evaluate("window.DHData.COLORS.length") == 18, "COLORS should have 18 entries"
        assert page.evaluate("window.DHData.MURALS.length") == 3, "MURALS should have 3 entries"
        assert page.evaluate("window.DHData.TITLES.length") == 5, "TITLES should have 5 entries"
        assert page.evaluate("window.DHData.FACTS.length") == 5, "FACTS should have 5 entries"
        assert page.evaluate("window.DHSave.load().codex.length") == 0, "codex should start empty"

        # 2. zaojing full-extract ritual: center wipe -> tap gold -> tap qingshi
        #    -> wipe shilv to auto-extract -> tap the rest -> alldone
        page.evaluate("window.DHExtract.start('zaojing')")
        page.evaluate("window.__game.setView('view-extract')")
        page.evaluate("window.DHMural.resize()")
        assert page.evaluate("window.DHExtract.snapshot().totalCount") == 6
        center = page.evaluate("window.DHMural.designToCanvas(50, 50)")
        assert page.evaluate("window.DHMural.dustAtPoint(%f, %f)" % (center["x"], center["y"])), \
            "gold center should start under dust"
        for _ in range(6):
            page.evaluate("(p) => window.DHMural.dustAt(p.x, p.y)", center)
        assert not page.evaluate("window.DHMural.dustAtPoint(%f, %f)" % (center["x"], center["y"])), \
            "small center wipe should clear dust at the gold center"
        page.evaluate("(p) => window.DHExtract.tap(p.x, p.y)", center)
        assert page.evaluate("window.DHSave.load().codex.indexOf('jin') >= 0"), \
            "tapping the wiped center should extract hidden gold"
        outer = page.evaluate("window.DHMural.designToCanvas(5, 5)")
        page.evaluate("(p) => window.DHExtract.tap(p.x, p.y)", outer)
        assert page.evaluate("window.DHSave.load().codex.indexOf('qingshi') >= 0"), \
            "tapping the outer corner should extract qingshi"
        wipe = page.evaluate("""() => {
          var M = window.DHMural, a = M.designToCanvas(32, 32), b = M.designToCanvas(68, 68);
          var st = window.DHData.BRUSH_R / 2, x, y;
          for (y = a.y; y <= b.y + st; y += st)
            for (x = a.x; x <= b.x + st; x += st) M.dustAt(x, y);
        }""")
        assert wipe is None
        page.wait_for_function("window.DHExtract.snapshot().extractedCount >= 3", timeout=3000)
        assert page.evaluate("window.DHSave.load().codex.indexOf('shilv') >= 0"), \
            "wiping shilv should auto-extract it via dust progress"
        page.evaluate("""() => {
          var tapPoint = %s;
          var shapes = window.DHData.SHAPES.zaojing, j, p;
          for (j = 0; j < shapes.length; j++) {
            p = tapPoint(shapes[j]);
            window.DHExtract.tap(p.x, p.y);
          }
        }""" % TAP_POINT_JS)
        page.evaluate("window.DHExtract.checkDust()")
        assert page.evaluate("window.DHExtract.snapshot().extractedCount") == 6, \
            "all 6 zaojing shapes should be extracted"
        assert page.evaluate("window.__alldone") == 1, "alldone should fire exactly once"
        codex = page.evaluate("window.DHSave.load().codex")
        assert set(codex) == ZAOJING_COLORS, "codex should gain all 6 zaojing colors, got %r" % codex

        # 3. hitTest spot-checks across all 3 murals
        page.evaluate("window.DHExtract.start('feitian')")
        page.evaluate("window.DHMural.resize()")
        head = page.evaluate("window.DHMural.designToCanvas(62, 36)")
        assert page.evaluate("(p) => { var s = window.DHMural.hitTest(p.x, p.y); return s && s.color; }",
                             head) == "geifen", "feitian head should hitTest to geifen"
        page.evaluate("window.DHExtract.start('jiuse')")
        page.evaluate("window.DHMural.resize()")
        body = page.evaluate("""() => {
          var pts = window.DHData.SHAPES.jiuse.filter(function (s) { return s.id === 'js-deer-body'; })[0].pts;
          var cx = 0, cy = 0, j;
          for (j = 0; j < pts.length; j++) { cx += pts[j][0]; cy += pts[j][1]; }
          return window.DHMural.designToCanvas(cx / pts.length, cy / pts.length);
        }""")
        assert page.evaluate("(p) => { var s = window.DHMural.hitTest(p.x, p.y); return s && s.color; }",
                             body) == "geifen", "jiuse deer body should hitTest to geifen"
        page.evaluate("window.DHExtract.start('zaojing')")
        page.evaluate("window.DHMural.resize()")
        zc = page.evaluate("window.DHMural.designToCanvas(50, 50)")
        assert page.evaluate("(p) => { var s = window.DHMural.hitTest(p.x, p.y); return s && s.color; }",
                             zc) == "jin", "zaojing center should hitTest to jin"

        # 4. DHCard.paint: 2 layouts x 3 bgs -> 900x1200 PNG, corner bg colors
        matrix = page.evaluate(PAINT_MATRIX_JS)
        assert len(matrix) == 6 and all(m["ok"] for m in matrix), "paint matrix incomplete: %r" % matrix
        for m in matrix:
            assert [m["w"], m["h"]] == [900, 1200], \
                "%s/%s should decode at 900x1200, got %r" % (m["layout"], m["bg"], (m["w"], m["h"]))

        def near(rgb, target, tol=12):
            return all(abs(a - b) <= tol for a, b in zip(rgb, target))

        paper = [m for m in matrix if m["bg"] == "paper"]
        night = [m for m in matrix if m["bg"] == "night"]
        assert all(near(m["corner"], (245, 240, 230)) for m in paper), \
            "paper corner should be ~#F5F0E6, got %r" % [m["corner"] for m in paper]
        assert all(near(m["corner"], (46, 61, 82)) for m in night), \
            "night corner should be ~#2E3D52, got %r" % [m["corner"] for m in night]

        # 5. build -> make-card full chain (full feitian extract first)
        snap = page.evaluate(FULL_EXTRACT_JS, "feitian")
        assert snap["extractedCount"] == snap["totalCount"] == 25, \
            "feitian full extract should finish, got %r" % snap
        codex = page.evaluate("window.DHSave.load().codex")
        assert len(codex) == 11, "feitian should add 5 new colors (11 total), got %r" % codex
        page.click("#btn-build")
        page.wait_for_function(view_active("view-build"), timeout=3000)
        assert page.evaluate("window.__game.buildSel.colors.length") == 5, "default picks first 5 colors"
        assert page.evaluate("window.__game.buildSel.layout") == "scroll"
        assert page.evaluate("window.__game.buildSel.bg") == "paper"
        page.click("#btn-make-card")
        page.wait_for_function(view_active("view-result"), timeout=3000)
        page.wait_for_function("""() => {
          var d = document.getElementById('result-card').getContext('2d').getImageData(430, 590, 40, 40).data;
          for (var i = 0; i < d.length; i += 4) { if (d[i + 3] > 0) return true; }
          return false;
        }""", timeout=3000)
        assert page.evaluate("window.DHSave.load().cards") == 1, "cards should increment to 1"
        lb = page.evaluate("window.DHSave.load().lastBuild")
        assert lb and len(lb["colors"]) == 5 and lb["layout"] == "scroll" and lb["bg"] == "paper", \
            "lastBuild should be stored, got %r" % lb
        assert page.evaluate("!!window.DHShare.lastStats && !!window.DHShare.lastStats.dataUrl"), \
            "share stats should be set for the result card"

        # 6. share fallback: no xhs bridge -> alert with fallback text
        assert not page.evaluate("!!window.xhs"), "xhs bridge should be absent under file://"
        before = len(dialogs)
        page.click("#btn-save-album")
        deadline = time.time() + 5
        while time.time() < deadline and len(dialogs) == before:
            page.wait_for_timeout(100)
        assert len(dialogs) > before, "save-album without xhs should fall back to alert"
        assert "截图保存" in dialogs[before], "unexpected fallback message: %r" % dialogs[before]

        # 7. mocked xhs: writeTempFile -> saveImageToPhotosAlbum / postNote chains
        page.evaluate(MOCK_XHS_JS)
        page.click("#btn-save-album")
        page.wait_for_function("window.__calls.length >= 2", timeout=3000)
        page.click("#btn-post-note")
        page.wait_for_function("window.__calls.length >= 4", timeout=3000)
        calls = page.evaluate("window.__calls")
        assert calls[0][0] == "writeTempFile" and calls[0][1] == "data:image/png;base64,", \
            "saveAlbum should writeTempFile with the png dataUrl, got %r" % calls[0]
        assert calls[1] == ["saveImageToPhotosAlbum", "tmp-dh-card.png"], \
            "saveAlbum should pass the temp filePath, got %r" % calls[1]
        assert calls[2][0] == "writeTempFile" and calls[2][1] == "data:image/png;base64,", \
            "postNote should writeTempFile first, got %r" % calls[2]
        assert calls[3][0] == "postNote", "postNote should be called, got %r" % calls[3]
        title, tags, media_url = calls[3][1], calls[3][2], calls[3][3]
        assert isinstance(title, str) and 0 < len(title) <= 20, "postNote title invalid: %r" % title
        assert isinstance(tags, str) and "#敦煌" in tags, "postNote tags invalid: %r" % tags
        assert media_url == "tmp-dh-card.png", "postNote should pass the temp filePath"
        page.evaluate("delete window.xhs")

        # 8. codex persistence: reload keeps codex/cards; clear resets to 0
        codex_before = page.evaluate("window.DHSave.load().codex.length")
        assert codex_before == 11
        page.reload()
        page.wait_for_function("!!window.DHData && !!window.DHSave", timeout=10000)
        assert page.evaluate("window.DHSave.load().codex.length") == 11, \
            "codex should persist across reload"
        assert page.evaluate("window.DHSave.load().cards") == 1, "cards should persist across reload"
        page.evaluate("localStorage.clear()")
        assert page.evaluate("window.DHSave.load().codex.length") == 0, \
            "clearing storage should reset the codex to 0"

        # 9. DHSound: all methods callable without throw; mute persistence round-trip
        assert page.evaluate("""() => {
          var S = window.DHSound;
          S.unlock(); S.chime(3); S.hidden(); S.brush(); S.stamp(); S.card();
          S.setMuted(true);
          if (!S.isMuted() || !window.DHSave.load().muted) return false;
          S.setMuted(false);
          if (S.isMuted() || window.DHSave.load().muted) return false;
          S.setMuted(true);
          return true;
        }"""), "DHSound methods should be callable and mute should persist"

        # 10. hermetic cleanup
        page.evaluate("localStorage.clear()")
        browser.close()

    assert not errors, "console/page errors: %r" % errors
    print("SMOKE PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("SMOKE FAIL: %s" % exc)
        sys.exit(1)
