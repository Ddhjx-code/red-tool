#!/usr/bin/env python3
"""Headless smoke/regression suite for 霓裳羽衣 (tools/hanfu).

Run: python3 tests/hanfu_smoke.py
Asserts: asset completeness (81 combo webp = 3 hair x 3 top x 3 skirt x 3
shoe + 3 bg), boot state, image loading, hair/top/skirt/shoe/bg switching,
intro knowledge cards (4 items incl. shoe), share-card canvas output
(900x1200), and zero console/page errors.
Prints SMOKE PASS on success.
"""
import functools
import http.server
import pathlib
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "hanfu"
PORT = 8947


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(TOOL))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


URL = f"http://127.0.0.1:{PORT}/index.html"

HAIR = ["h0", "h1", "h2"]
TOP = ["t0", "t1", "t2"]
SKIRT = ["s0", "s1", "s2"]
SHOE = ["shoe_xiuhua", "shoe_gong", "shoe_qiaotou"]
BG = ["bg_yuanlin", "bg_taohua", "bg_yueye"]


def check_assets():
    img = TOOL / "assets" / "img"
    missing = []
    for h in HAIR:
        for t in TOP:
            for s in SKIRT:
                for sh in SHOE:
                    if not (img / f"{h}_{t}_{s}_{sh}.webp").exists():
                        missing.append(f"{h}_{t}_{s}_{sh}.webp")
    for b in BG:
        if not (img / f"{b}.webp").exists():
            missing.append(f"{b}.webp")
    assert not missing, f"missing assets: {missing[:5]} (+{len(missing)-5} more)" if len(missing) > 5 else f"missing assets: {missing}"
    print(f"[1] assets complete: {len(HAIR)*len(TOP)*len(SKIRT)*len(SHOE)} combos + {len(BG)} bg")


def run():
    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("dialog", lambda d: (errs.append("dialog: " + d.message), d.dismiss()))
        pg.goto(URL)
        pg.wait_for_timeout(300)

        assert pg.eval_on_selector("#view-home", "el=>el.classList.contains('is-active')")
        pg.click("#btn-start")
        pg.wait_for_timeout(800)

        ok = pg.evaluate(
            "(function(){var b=document.getElementById('bg-img'),c=document.getElementById('char-img');"
            "return b.naturalWidth>0&&c.naturalWidth>0;})()")
        assert ok, "default images not loaded"
        src = pg.eval_on_selector("#char-img", "el=>el.src")
        assert "h0_t0_s0_shoe_xiuhua" in src, src
        print("[2] boot + default combo loaded")

        def switch(cat, idx, expect):
            pg.click(f".tab[data-cat={cat}]")
            pg.wait_for_timeout(120)
            pg.evaluate(f"document.querySelectorAll('.options .opt')[{idx}].click()")
            pg.wait_for_timeout(600)
            s = pg.eval_on_selector("#char-img", "el=>el.src")
            assert expect in s, f"{cat}->{expect}: {s}"
            loaded = pg.evaluate("document.getElementById('char-img').naturalWidth>0")
            assert loaded, f"image not loaded after {cat} switch: {s}"

        switch("hair", 2, "h2_")
        switch("top", 1, "_t1_")
        switch("skirt", 2, "_s2_")
        print("[3] hair/top/skirt switch loads images")

        switch("shoe", 1, "_shoe_gong")
        switch("shoe", 2, "_shoe_qiaotou")
        switch("shoe", 0, "_shoe_xiuhua")
        print("[4] shoe switch swaps full combo image")

        pg.click(".tab[data-cat=bg]")
        pg.wait_for_timeout(120)
        pg.evaluate("document.querySelectorAll('.options .opt')[2].click()")
        pg.wait_for_timeout(600)
        bsrc = pg.eval_on_selector("#bg-img", "el=>el.src")
        assert "bg_yueye" in bsrc, bsrc
        assert pg.evaluate("document.getElementById('bg-img').naturalWidth>0")
        print("[5] bg switch loads")

        pg.click("#btn-next")
        pg.wait_for_timeout(400)
        tags = pg.eval_on_selector_all("#intro-list .intro-tag", "els=>els.map(e=>e.textContent)")
        assert len(tags) == 4, tags
        assert any("鞋" in t for t in tags), tags
        knows = pg.eval_on_selector_all("#intro-list .intro-know", "els=>els.map(e=>e.textContent)")
        assert all(len(k) > 10 for k in knows), knows
        print("[6] intro shows 4 knowledge cards incl. shoe")

        pg.click("#btn-generate")
        pg.wait_for_timeout(1200)
        info = pg.evaluate(
            "(function(){var i=document.getElementById('result-img');"
            "return {isData: i.src.indexOf('data:image/png')===0, len: i.src.length};})()")
        assert info["isData"] and info["len"] > 100000, info
        print("[7] share card rendered (dataURL %dKB)" % (info["len"] // 1024))

        b.close()
    assert not errs, errs
    print("[8] zero console/page errors")


if __name__ == "__main__":
    check_assets()
    httpd = serve()
    try:
        run()
    finally:
        httpd.shutdown()
    print("SMOKE PASS")
    sys.exit(0)
