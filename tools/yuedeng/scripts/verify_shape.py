#!/usr/bin/env python3
"""Silhouette + approved-effect verification for 月下灯会 (tools/yuedeng).

Run: python3 tools/yuedeng/scripts/verify_shape.py

Mobile Playwright run (390x844, isMobile, hasTouch, SwiftShader). Measures the
rendered lantern body per shape — opaque area, silhouette hash, half-width
profile, undulation, body bbox — and asserts the four shapes are four distinct
lanterns that taper from the girth to both 灯口. Also re-checks paint diffusion,
the morph settling, and zero console/page/network errors.

The approved 透光效应 is guarded by an A/B: a pristine clone of the tool with the
ORIGINAL sdfAt is built in a scratch dir, the identical stroke sequence is run in
both, and the lit/unlit luma+chroma ratios must agree. Screenshots land in
tools/yuedeng/screenshots/ (project dir, never a temp dir).

This harness has no vision: every claim it makes is a measured number.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import shutil
import sys
import tempfile

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[3]
TOOL = ROOT / "tools" / "yuedeng"
SHOTS = TOOL / "screenshots"

WEBGL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
VIEWPORT = {"width": 390, "height": 844}
SHAPES = [("round", 0), ("square", 1), ("hexagon", 2), ("lotus", 3)]
STROKES = [[[0.34, 0.46], [0.50, 0.52], [0.66, 0.44]], [[0.40, 0.40], [0.52, 0.46], [0.62, 0.52]]]

FAILURES: list[str] = []

NEW_SDF_MARK = "    'float lampBody (vec2 p, float halfW) {',"

# 旧轮廓（形变前）：椭球 / 圆角矩形 / 正六边形 / 极坐标八瓣——A/B 基线用它。
OLD_SDF = """    'float sdRoundBox (vec2 p, vec2 b, float r) {',
    '  vec2 q = abs(p) - b + r;',
    '  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;',
    '}',
    'float sdHexagon (vec2 p, float r) {',
    '  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);',
    '  p = abs(p);',
    '  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;',
    '  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);',
    '  return length(p) * sign(p.y);',
    '}',
    'float sdfAt (vec2 q) {',
    '  vec2 p = (q - uLampC) / uLampH;',
    '  float d0 = length(p * vec2(1.00, 1.05)) - 1.00;            /* 圆灯 */',
    '  float d1 = sdRoundBox(p, vec2(0.82, 0.86), 0.15);          /* 方灯 */',
    '  float d2 = sdHexagon(p, 0.98);                             /* 六角灯 */',
    '  float a  = atan(p.y, p.x);',
    '  float d3 = length(p) - (0.84 + 0.16 * cos(a * 8.0 + 0.3926994));  /* 莲花灯 */',
    '  return uShapeW.x * d0 + uShapeW.y * d1 + uShapeW.z * d2 + uShapeW.w * d3;',
    '}',
"""

# 读回灯面像素：把 WebGL 画布（preserveDrawingBuffer:true）画进 2D 画布再取 data。
# 只统计 alpha>=250 的像素 —— 灯身内 mask=1 → a=1.0；灯身外只有光晕（a<1），
# 所以这一阈值量到的是「灯身轮廓」本身，不含溢出的光晕。
PROBE_JS = """
() => {
  const src = document.getElementById('lamp');
  const w = src.width, h = src.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  const rowMin = new Int32Array(h).fill(-1);
  const rowMax = new Int32Array(h).fill(-1);
  let area = 0, glow = 0;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = d[i + 3];
      if (a > 128) glow++;
      if (a < 250) continue;
      area++;
      if (rowMin[y] < 0) rowMin[y] = x;
      rowMax[y] = x;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const rows = [];
  for (let y = 0; y < h; y++) {
    rows.push(rowMin[y] < 0 ? -1 : (rowMax[y] - rowMin[y] + 1));
  }
  return { w, h, area, glow, x0, x1, y0, y1, rows };
}
"""

HASH_JS = """
(b) => {
  const src = document.getElementById('lamp');
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const d = ctx.getImageData(b.x0, b.y0, bw, bh).data;
  const G = 40; let s = '';
  for (let gy = 0; gy < G; gy++) {
    const sy = Math.min(Math.floor((gy + 0.5) * bh / G), bh - 1);
    for (let gx = 0; gx < G; gx++) {
      const sx = Math.min(Math.floor((gx + 0.5) * bw / G), bw - 1);
      s += d[(sy * bw + sx) * 4 + 3] >= 250 ? '1' : '0';
    }
  }
  return s;
}
"""


def check(name: str, cond: bool, extra: str = "") -> None:
    print(("  ok   " if cond else "  FAIL ") + name + (f" | {extra}" if extra else ""))
    if not cond:
        FAILURES.append(name)


def measure(page) -> dict:
    raw = page.evaluate(PROBE_JS)
    rows = raw["rows"]
    y0, y1 = raw["y0"], raw["y1"]
    if y1 < y0:
        return {**raw, "bodyW": 0, "bodyH": 0, "profile": {}, "undulation": 0,
                "hash": "empty", "mask": ""}
    body_h = y1 - y0 + 1
    # 剖面取样：frac 是「离灯口多远」占灯身高的比例 —— 0 就是灯口那一行，
    # 0.485 就是腰腹中线。「中间最鼓、两头收口」由这四个行宽判定，不由眼睛判定。
    profile = {}
    for label, frac in (("pole", 0.0), ("t80", 0.10), ("t50", 0.25), ("girth", 0.485)):
        off = int(round(body_h * frac))
        profile[label] = max(rows[min(y0 + off, y1)], rows[max(y1 - off, y0)])
    # 起伏：从灯口到腰腹取 40 个行宽，数相邻差的符号翻转次数。
    # 圆 / 方 / 六角是单调收窄；莲花灯八瓣起伏，符号必须翻转多次。
    series = []
    for i in range(40):
        off = int(round(body_h * 0.485 * i / 39))
        series.append(max(rows[min(y0 + off, y1)], rows[max(y1 - off, y0)]))
    undulation = sum(1 for i in range(2, len(series))
                     if (series[i] - series[i - 1]) * (series[i - 1] - series[i - 2]) < 0)
    mask = page.evaluate(HASH_JS, {"x0": raw["x0"], "x1": raw["x1"], "y0": y0, "y1": y1})
    return {
        "area": raw["area"], "glow": raw["glow"],
        "bodyW": raw["x1"] - raw["x0"] + 1, "bodyH": body_h,
        "profile": profile, "undulation": undulation,
        "hash": hashlib.sha256(mask.encode()).hexdigest()[:16], "mask": mask,
    }


def glow_probe(page, label: str) -> dict:
    """同一套笔触 → 未点亮 / 点亮两次 lampPixels()，量透光效应的抬升。"""
    page.evaluate("window.__game.start()")
    page.wait_for_selector("#view-create.is-active")
    page.wait_for_timeout(400)
    page.evaluate("window.__game.setColor(1)")
    page.evaluate("window.__game.paintDrag(%s)" % json.dumps(STROKES[0]))
    page.evaluate("window.__game.setColor(2)")
    page.evaluate("window.__game.paintDrag(%s)" % json.dumps(STROKES[1]))
    page.wait_for_timeout(1400)
    unlit = page.evaluate("window.__game.lampPixels()")
    page.evaluate("window.__game.setLit(true)")
    page.wait_for_function("window.YDEngine.state().litLevel > 0.99", timeout=20000)
    page.wait_for_timeout(700)
    lit = page.evaluate("window.__game.lampPixels()")
    out = {
        "unlitLuma": unlit["luma"], "litLuma": lit["luma"],
        "lumaRatio": lit["luma"] / max(unlit["luma"], 1e-6),
        "unlitChroma": unlit["chromaPixels"], "litChroma": lit["chromaPixels"],
        "chromaRatio": lit["chromaPixels"] / max(unlit["chromaPixels"], 1),
    }
    print(f"       {label}: unlit luma={out['unlitLuma']:.1f} lit luma={out['litLuma']:.1f} "
          f"(x{out['lumaRatio']:.2f}) | chroma {out['unlitChroma']} -> {out['litChroma']} "
          f"(x{out['chromaRatio']:.2f})")
    return out


def baseline_clone() -> pathlib.Path:
    """把 tools/yuedeng 复制到 scratch，并把 sdfAt 换回形变前的旧轮廓。"""
    dst = pathlib.Path(tempfile.mkdtemp(prefix="yd-baseline-")) / "yuedeng"
    shutil.copytree(TOOL, dst)
    engine = dst / "assets" / "engine.js"
    src = engine.read_text(encoding="utf-8")
    head, _, tail = src.partition(NEW_SDF_MARK)
    if not tail:
        raise SystemExit("baseline clone failed: new sdfAt marker not found")
    _, _, rest = tail.partition("'void main () {',")
    engine.write_text(head + OLD_SDF + "    'void main () {'," + rest, encoding="utf-8")
    return dst


def main() -> int:
    errors: list[str] = []
    SHOTS.mkdir(parents=True, exist_ok=True)
    base = baseline_clone()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=WEBGL_ARGS)
            ctx = browser.new_context(viewport=VIEWPORT, is_mobile=True, has_touch=True)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
            page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
            page.on("requestfailed", lambda r: errors.append("requestfailed: " + r.url))

            page.goto((TOOL / "index.html").as_uri() + "?test=1")
            page.wait_for_function("window.__ready === true", timeout=20000)
            check("window.__ready === true", page.evaluate("window.__ready === true"))
            check("snapshot().engineOk", page.evaluate("window.__game.snapshot().engineOk") is True)

            # ---------- 透光效应：本版本 ----------
            now = glow_probe(page, "current")
            check("点亮: luma 显著抬升 (>= x1.4)", now["lumaRatio"] >= 1.4, f"x{now['lumaRatio']:.2f}")
            check("点亮: 彩色像素显著抬升 (>= x3)", now["chromaRatio"] >= 3.0, f"x{now['chromaRatio']:.2f}")

            # ---------- 透光效应：旧轮廓基线，同一套笔触 ----------
            page_b = ctx.new_page()
            page_b.on("pageerror", lambda e: errors.append("pageerror-baseline: " + str(e)))
            page_b.on("console", lambda m: errors.append("console-baseline: " + m.text)
                      if m.type == "error" else None)
            page_b.goto((base / "index.html").as_uri() + "?test=1")
            page_b.wait_for_function("window.__ready === true", timeout=20000)
            old = glow_probe(page_b, "baseline")
            page_b.close()

            # 流体按真实 dt 演化，绝对值逐次有抖动，故比的是「抬升倍率」而非绝对亮度。
            for key, tol in (("lumaRatio", 0.15), ("chromaRatio", 0.30)):
                delta = abs(now[key] - old[key]) / max(old[key], 1e-6)
                check(f"透光效应未被改动: {key} 与旧轮廓基线一致 (±{tol:.0%})", delta <= tol,
                      f"current={now[key]:.3f} baseline={old[key]:.3f} delta={delta:.1%}")

            # ---------- 四种灯形：逐个选、逐个量、逐个截图 ----------
            report = []
            for name, idx in SHAPES:
                page.evaluate(f"window.__game.setShape({idx})")
                page.wait_for_function(f"window.YDEngine.state().shapeW[{idx}] > 0.999", timeout=30000)
                page.wait_for_timeout(600)
                w = page.evaluate(f"window.YDEngine.state().shapeW[{idx}]")
                check(f"形变到位: {name} 权重 → 1", w > 0.999, f"shapeW[{idx}]={w:.4f}")
                m = measure(page)
                m["name"], m["weight"] = name, w
                report.append(m)
                prof = m["profile"]
                # 4px 容差吸收像素块量化（PIXEL_BLOCK=3）带来的行宽抖动。
                taper = (prof["pole"] > 0
                         and prof["t80"] <= prof["girth"] + 4
                         and prof["t50"] <= prof["t80"] + 4
                         and prof["pole"] <= prof["t50"] + 4
                         and prof["pole"] <= prof["girth"] * 0.70)
                check(f"{name}: 灯身自腰腹向灯口收窄 (灯口 <= 腰腹 ×0.70)", taper, json.dumps(prof))
                ratio = m["bodyH"] / max(m["bodyW"], 1)
                check(f"{name}: 灯身不比宽更矮 (bodyH/bodyW >= 0.99)", ratio >= 0.99,
                      f"{m['bodyW']}x{m['bodyH']} ratio={ratio:.3f}")
                if name == "lotus":
                    check("lotus: 八瓣起伏（行宽序列非单调）", m["undulation"] >= 3,
                          f"undulation={m['undulation']}")
                else:
                    check(f"{name}: 侧壁单调（非瓣形）", m["undulation"] <= 2,
                          f"undulation={m['undulation']}")
                page.screenshot(path=str(SHOTS / f"12-shape-{name}.png"))

            areas = [m["area"] for m in report]
            hashes = [m["hash"] for m in report]
            masks = [m["mask"] for m in report]
            widths = [m["bodyW"] for m in report]
            check("四盏灯形面积互不相同", len(set(areas)) == 4, str(areas))
            check("四盏灯形轮廓指纹互不相同", len(set(hashes)) == 4, str(hashes))
            check("四盏灯形掩膜位图互不相同", len(set(masks)) == 4)
            check("四盏灯形宽度互不相同", len(set(widths)) == 4, str(widths))
            pairs = [(a["name"], b["name"], abs(a["area"] - b["area"]))
                     for i, a in enumerate(report) for b in report[i + 1:]]
            check("四盏灯形面积两两相差 > 2%（不是同形微调）",
                  all(d > 0.02 * min(areas) for _, _, d in pairs), str(pairs))

            check("zero console/page/network errors", not errors, "; ".join(errors[:6]))

            print("\n# shape report")
            for m in report:
                print(f"  {m['name']:<8} weight={m['weight']:.4f} area={m['area']:>6}px "
                      f"body={m['bodyW']}x{m['bodyH']} h/w={m['bodyH'] / max(m['bodyW'],1):.3f} "
                      f"girth={m['profile']['girth']} pole={m['profile']['pole']} "
                      f"undulation={m['undulation']} hash={m['hash']}")
            print("\n# glow report")
            print(f"  current  luma x{now['lumaRatio']:.2f} chroma x{now['chromaRatio']:.2f}")
            print(f"  baseline luma x{old['lumaRatio']:.2f} chroma x{old['chromaRatio']:.2f}")
            browser.close()
    finally:
        shutil.rmtree(base.parent, ignore_errors=True)

    print("\nshots -> " + str(SHOTS))
    for name, _ in SHAPES:
        print("  " + str(SHOTS / f"12-shape-{name}.png"))
    if FAILURES:
        print(f"\nVERIFY FAIL: {len(FAILURES)}: {', '.join(FAILURES)}")
        return 1
    print("\nVERIFY PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
