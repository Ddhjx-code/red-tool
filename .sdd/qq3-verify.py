import json
import os
from playwright.sync_api import sync_playwright

ROOT = "/Users/duanchao.wzj/AI/workspace/red-tool"
SHOT_DIR = os.path.join(ROOT, ".sdd", "shots")
os.makedirs(SHOT_DIR, exist_ok=True)
URL = "file://" + ROOT + "/tools/qiqiao/index.html"

HARNESS = r"""
() => {
  const out = { errors: [], cover: {}, pairs: { min: 1, worst: null }, checks: {} };
  if (!window.QQShadow) { out.errors.push('no-QQShadow'); return out; }
  const ids = window.QQShadow.ids();
  const expected = window.QQData.SHADOWS.map(s => s.id);
  out.checks.ids = JSON.stringify(ids) === JSON.stringify(expected) && ids.length === 12;
  const masks = {};
  for (const id of ids) {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    window.QQShadow.draw(ctx, id, 100, 100, 160, 1);
    const m = ctx.getTransform();
    if (!(m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0) || ctx.globalAlpha !== 1) {
      out.errors.push('state-reset:' + id);
    }
    const d = ctx.getImageData(0, 0, 200, 200).data;
    let inkpx = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 40 && d[i] < 110 && d[i + 1] < 110 && d[i + 2] < 110) inkpx++;
    }
    out.cover[id] = inkpx / 40000;
    const mask = new Uint8Array(1024);
    for (let gy = 0; gy < 32; gy++) {
      for (let gx = 0; gx < 32; gx++) {
        const px = Math.min(199, Math.floor((gx + 0.5) * 200 / 32));
        const py = Math.min(199, Math.floor((gy + 0.5) * 200 / 32));
        const i = (py * 200 + px) * 4;
        mask[gy * 32 + gx] = d[i + 3] > 40 ? 1 : 0;
      }
    }
    masks[id] = mask;
  }
  for (const id of ids) {
    if (!(out.cover[id] >= 0.04 && out.cover[id] <= 0.60)) {
      out.errors.push('coverage:' + id + ':' + out.cover[id].toFixed(3));
    }
  }
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      let diff = 0;
      const A = masks[ids[i]], B = masks[ids[j]];
      for (let k = 0; k < 1024; k++) { if (A[k] !== B[k]) diff++; }
      const nd = diff / 1024;
      if (nd < out.pairs.min) { out.pairs.min = nd; out.pairs.worst = ids[i] + '/' + ids[j]; }
      if (nd <= 0.08) { out.errors.push('distinct:' + ids[i] + '/' + ids[j] + ':' + nd.toFixed(3)); }
    }
  }
  return out;
}
"""

GRID = r"""
() => {
  const ids = window.QQShadow.ids();
  const cell = 150, cols = 3;
  const c = document.createElement('canvas');
  c.id = 'qq3-grid';
  c.width = cols * cell; c.height = 4 * cell;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f3efe4';
  ctx.fillRect(0, 0, c.width, c.height);
  ids.forEach((id, i) => {
    const gx = i % cols, gy = Math.floor(i / cols);
    window.QQShadow.draw(ctx, id, gx * cell + cell / 2, gy * cell + cell / 2 - 8, 104, 0.92);
    ctx.fillStyle = 'rgba(20,26,38,0.55)';
    ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(id, gx * cell + cell / 2, gy * cell + cell - 10);
  });
  c.style.position = 'fixed';
  c.style.left = '0';
  c.style.top = '0';
  c.style.zIndex = '99999';
  document.body.appendChild(c);
  return true;
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    pageerrors = []
    page.on("pageerror", lambda e: pageerrors.append(str(e)))
    page.goto(URL, wait_until="load")
    page.wait_for_timeout(200)
    result = page.evaluate(HARNESS)
    page.evaluate(GRID)
    page.locator("#qq3-grid").screenshot(path=os.path.join(SHOT_DIR, "qq3-shadows.png"))
    browser.close()

result["pageerrors"] = pageerrors
print(json.dumps(result, indent=2, ensure_ascii=False))
ok = (
    not pageerrors
    and result.get("checks", {}).get("ids")
    and not result.get("errors")
    and result.get("pairs", {}).get("min", 0) > 0.08
)
print("RESULT:", "PASS" if ok else "FAIL")
