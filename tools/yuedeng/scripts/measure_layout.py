#!/usr/bin/env python3
"""Measure the create-view layout box (dock / stage / top bar) for 月下灯会.

Reports the numbers the placement-selector task requires: dock height, stage
height, and the free width in each candidate row. Read-only, no edits.
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[3]
URL = (ROOT / "tools" / "yuedeng" / "index.html").as_uri() + "?test=1"
WEBGL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

MEASURE = """() => {
  const box = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return {w: Math.round(r.width), h: Math.round(r.height),
            x: Math.round(r.left), y: Math.round(r.top)};
  };
  const inner = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const cs = getComputedStyle(n);
    return {w: Math.round(n.clientWidth - parseFloat(cs.paddingLeft)
                          - parseFloat(cs.paddingRight)),
            scrollW: n.scrollWidth};
  };
  const out = {
    viewport: {w: innerWidth, h: innerHeight},
    scrollHeight: document.documentElement.scrollHeight,
    top: box('.top'),
    stage: box('#stage'),
    dock: box('.dock'),
    panelBar: box('.panel-bar'),
    panelInner: inner('.panel-bar'),
    palRow: inner('.pal-row'),
    shapeRow: inner('.shape-row'),
    actRow: inner('.act-row'),
    labelRow: box('.current-label'),
    brand: box('.brand'),
    topActions: box('.top-actions'),
    topScrollW: document.querySelector('.top') ? document.querySelector('.top').scrollWidth : null,
    children: {}
  };
  ['.brand', '.top-actions', '#btn-back', '#phase-btn', '#btn-release',
   '#light-btn', '#reset-btn'].forEach(sel => { out.children[sel] = box(sel); });
  out.shapeBtn = box('#shapes .shape-btn');
  out.swatch = box('#palette .swatch');
  return out;
}"""


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=WEBGL_ARGS)
        page = b.new_page(viewport={"width": 390, "height": 844},
                          is_mobile=True, has_touch=True)
        page.goto(URL)
        page.wait_for_function("window.__ready === true", timeout=15000)
        page.evaluate("window.__game.start()")
        page.wait_for_selector("#view-create.is-active")
        page.wait_for_timeout(500)
        print(json.dumps(page.evaluate(MEASURE), ensure_ascii=False, indent=2))
        b.close()


if __name__ == "__main__":
    sys.exit(main())
