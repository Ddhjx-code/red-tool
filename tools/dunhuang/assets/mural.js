(function () {
  var INK = "#425066";
  var MOON = "#D6ECF0";
  var DUST = "#B8A88A";
  var canvas = null, ctx = null;
  var dustCanvas = null, dustCtx = null;
  var dpr = 1, W = 0, H = 0, ox = 0, oy = 0, scale = 1;
  var shapes = [], extracted = {}, loaded = false;
  var colorMap = {};

  function buildColorMap() {
    var i, c, list = window.DHData.COLORS;
    colorMap = {};
    for (i = 0; i < list.length; i++) { c = list[i]; colorMap[c.id] = c; }
  }

  function hexOf(colorId) {
    var c = colorMap[colorId];
    return c ? c.hex : "#888888";
  }

  function resize() {
    var side;
    if (!canvas) return;
    W = canvas.clientWidth || canvas.parentNode.clientWidth || 390;
    H = canvas.clientHeight || canvas.parentNode.clientHeight || 844;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    side = Math.min(W, H * 0.62);
    ox = (W - side) / 2;
    oy = (H - side) * 0.42;
    scale = side / 100;
    if (!dustCanvas) dustCanvas = document.createElement("canvas");
    dustCanvas.width = canvas.width;
    dustCanvas.height = canvas.height;
    dustCtx = dustCanvas.getContext("2d");
    dustCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (loaded) buildDust();
  }

  function designToCanvas(x, y) {
    return { x: ox + x * scale, y: oy + y * scale };
  }

  function canvasToDesign(x, y) {
    return { x: (x - ox) / scale, y: (y - oy) / scale };
  }

  function expandBand(pts, w) {
    var n = pts.length, h = w / 2, i, ax, ay, len, nx = [], ny = [], out = [];
    for (i = 0; i < n; i++) {
      if (i === 0) { ax = pts[1][0] - pts[0][0]; ay = pts[1][1] - pts[0][1]; }
      else if (i === n - 1) { ax = pts[n - 1][0] - pts[n - 2][0]; ay = pts[n - 1][1] - pts[n - 2][1]; }
      else { ax = pts[i + 1][0] - pts[i - 1][0]; ay = pts[i + 1][1] - pts[i - 1][1]; }
      len = Math.sqrt(ax * ax + ay * ay) || 1;
      nx[i] = -ay / len; ny[i] = ax / len;
    }
    for (i = 0; i < n; i++) out.push([pts[i][0] + nx[i] * h, pts[i][1] + ny[i] * h]);
    for (i = n - 1; i >= 0; i--) out.push([pts[i][0] - nx[i] * h, pts[i][1] - ny[i] * h]);
    return out;
  }

  function polyPts(shape) {
    if (shape.kind === "band") {
      if (!shape._pts) shape._pts = expandBand(shape.pts, shape.w);
      return shape._pts;
    }
    return shape.pts;
  }

  function tracePath(g, shape) {
    var i, p, pts;
    g.beginPath();
    if (shape.kind === "circle") {
      p = designToCanvas(shape.cx, shape.cy);
      g.arc(p.x, p.y, shape.r * scale, 0, Math.PI * 2);
    } else {
      pts = polyPts(shape);
      for (i = 0; i < pts.length; i++) {
        p = designToCanvas(pts[i][0], pts[i][1]);
        if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      }
      g.closePath();
    }
  }

  function dustRegion(g, s) {
    var bb = s.dustBBox, c;
    if (!bb) { tracePath(g, s); return; }
    c = designToCanvas((bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2);
    g.beginPath();
    g.ellipse(c.x, c.y, (bb.maxX - bb.minX) / 2 * scale, (bb.maxY - bb.minY) / 2 * scale, 0, 0, Math.PI * 2);
  }

  function shapeBBox(shape) {
    var i, p, pts, minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    if (shape.kind === "circle") {
      minX = shape.cx - shape.r; maxX = shape.cx + shape.r;
      minY = shape.cy - shape.r; maxY = shape.cy + shape.r;
    } else {
      pts = polyPts(shape);
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function pointInShape(shape, dx, dy) {
    var i, j, inside = false, pts, xi, yi, xj, yj;
    if (shape.kind === "circle") {
      var ddx = dx - shape.cx, ddy = dy - shape.cy;
      return ddx * ddx + ddy * ddy <= shape.r * shape.r;
    }
    pts = shape.kind === "circle" ? null : polyPts(shape);
    if (pts) {
      for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        xi = pts[i][0]; yi = pts[i][1];
        xj = pts[j][0]; yj = pts[j][1];
        if (((yi > dy) !== (yj > dy)) && (dx < (xj - xi) * (dy - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    }
    return inside;
  }

  function buildDust() {
    var i, j, s, rng, p, n, bb, px, colors;
    if (!dustCtx) return;
    dustCtx.clearRect(0, 0, W, H);
    rng = window.DHRng(3);
    colors = ["#A99873", "#C7B896", "#8F805F"];
    for (i = 0; i < shapes.length; i++) {
      s = shapes[i];
      if (!s.dusty) continue;
      dustCtx.save();
      dustRegion(dustCtx, s);
      dustCtx.globalAlpha = 0.93;
      dustCtx.fillStyle = DUST;
      dustCtx.fill();
      dustCtx.clip();
      bb = s.dustBBox || shapeBBox(s);
      n = 420;
      for (j = 0; j < n; j++) {
        px = designToCanvas(
          bb.minX + (bb.maxX - bb.minX) * rng.next(),
          bb.minY + (bb.maxY - bb.minY) * rng.next()
        );
        dustCtx.globalAlpha = rng.range(0.18, 0.55);
        dustCtx.fillStyle = rng.pick(colors);
        dustCtx.beginPath();
        dustCtx.arc(px.x, px.y, rng.range(0.5, 1.8), 0, Math.PI * 2);
        dustCtx.fill();
      }
      dustCtx.restore();
    }
  }

  function draw(dt) {
    var i, s;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#F5F0E6";
    ctx.fillRect(0, 0, W, H);
    ctx.lineJoin = "round";
    for (i = 0; i < shapes.length; i++) {
      s = shapes[i];
      tracePath(ctx, s);
      ctx.globalAlpha = extracted[s.id] ? 0.55 : 1;
      ctx.fillStyle = hexOf(s.color);
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.stroke();
      if (extracted[s.id]) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = MOON;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        tracePath(ctx, s);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }
    if (dustCanvas) ctx.drawImage(dustCanvas, 0, 0, W, H);
  }

  function hitTest(x, y) {
    var d = canvasToDesign(x, y), i;
    for (i = shapes.length - 1; i >= 0; i--) {
      if (pointInShape(shapes[i], d.x, d.y)) return shapes[i];
    }
    return null;
  }

  function dustAt(x, y) {
    var r = window.DHData.BRUSH_R;
    if (!dustCtx) return;
    dustCtx.save();
    dustCtx.globalCompositeOperation = "destination-out";
    dustCtx.globalAlpha = 1;
    dustCtx.fillStyle = "#000";
    dustCtx.beginPath();
    dustCtx.arc(x, y, r, 0, Math.PI * 2);
    dustCtx.fill();
    dustCtx.restore();
  }

  function dustAtPoint(x, y) {
    var px, py, d;
    if (!dustCtx) return false;
    px = Math.round(x * dpr);
    py = Math.round(y * dpr);
    if (px < 0 || py < 0 || px >= dustCanvas.width || py >= dustCanvas.height) return false;
    try { d = dustCtx.getImageData(px, py, 1, 1).data; } catch (e) { return false; }
    return d[3] > 32;
  }

  function pointInDustRegion(s, dx, dy) {
    var bb = s.dustBBox, cx, cy, rx, ry, ddx, ddy;
    if (!bb) return pointInShape(s, dx, dy);
    cx = (bb.minX + bb.maxX) / 2; cy = (bb.minY + bb.maxY) / 2;
    rx = (bb.maxX - bb.minX) / 2; ry = (bb.maxY - bb.minY) / 2;
    if (rx <= 0 || ry <= 0) return false;
    ddx = (dx - cx) / rx; ddy = (dy - cy) / ry;
    return ddx * ddx + ddy * ddy <= 1;
  }

  function dustProgress(shapeId) {
    var i, j, s = null, bb, a, b, c, d, gw, gh, img, N = 14, total = 0, cleared = 0, dx, dy, cp, sx, sy, alpha;
    for (i = 0; i < shapes.length; i++) {
      if (shapes[i].id === shapeId) { s = shapes[i]; break; }
    }
    if (!s) return 1;
    if (!s.dusty) return 1;
    if (!dustCtx) return 0;
    bb = s.dustBBox || shapeBBox(s);
    a = designToCanvas(bb.minX, bb.minY);
    b = designToCanvas(bb.maxX, bb.maxY);
    c = Math.max(1, Math.round(a.x * dpr));
    d = Math.max(1, Math.round(a.y * dpr));
    gw = Math.max(2, Math.round((b.x - a.x) * dpr));
    gh = Math.max(2, Math.round((b.y - a.y) * dpr));
    try { img = dustCtx.getImageData(c, d, gw, gh).data; } catch (e) { return 0; }
    for (i = 0; i < N; i++) {
      for (j = 0; j < N; j++) {
        dx = bb.minX + (i + 0.5) * (bb.maxX - bb.minX) / N;
        dy = bb.minY + (j + 0.5) * (bb.maxY - bb.minY) / N;
        if (!pointInDustRegion(s, dx, dy)) continue;
        cp = designToCanvas(dx, dy);
        sx = Math.min(gw - 1, Math.max(0, Math.round(cp.x * dpr) - c));
        sy = Math.min(gh - 1, Math.max(0, Math.round(cp.y * dpr) - d));
        alpha = img[(sy * gw + sx) * 4 + 3];
        total++;
        if (alpha < 32) cleared++;
      }
    }
    return total ? cleared / total : 0;
  }

  function load(muralId) {
    var src = (window.DHData.SHAPES[muralId] || []), i;
    shapes = [];
    for (i = 0; i < src.length; i++) {
      shapes.push(JSON.parse(JSON.stringify(src[i])));
    }
    extracted = {};
    loaded = true;
    if (dustCtx) buildDust();
  }

  function markExtracted(shapeId) { extracted[shapeId] = true; }

  function metrics() { return { W: W, H: H, u: W / 400 }; }

  function init(el) {
    canvas = el;
    buildColorMap();
    resize();
    window.addEventListener("resize", resize);
  }

  window.DHMural = {
    init: init,
    resize: resize,
    load: load,
    draw: draw,
    hitTest: hitTest,
    dustAt: dustAt,
    dustAtPoint: dustAtPoint,
    dustProgress: dustProgress,
    markExtracted: markExtracted,
    metrics: metrics,
    designToCanvas: designToCanvas,
    canvasToDesign: canvasToDesign
  };
})();
