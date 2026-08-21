// 碎片切分与拼合逻辑 —— 种子随机抖动网格切线，不规则四边形
window.Puzzle = (function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 生成 (cols+1)*(rows+1) 个网格点，内部点抖动 → 相邻碎片严丝合缝
  function gridPoints(W, H, cols, rows, rng) {
    var jit = Math.min(W / cols, H / rows) * 0.18;
    var pts = [];
    for (var j = 0; j <= rows; j++) {
      var rowPts = [];
      for (var i = 0; i <= cols; i++) {
        var x = (W / cols) * i;
        var y = (H / rows) * j;
        if (i > 0 && i < cols) x += (rng() * 2 - 1) * jit;
        if (j > 0 && j < rows) y += (rng() * 2 - 1) * jit;
        rowPts.push({ x: x, y: y });
      }
      pts.push(rowPts);
    }
    return pts;
  }

  // 切出所有碎片：每片 = 独立 canvas（多边形裁切 + 描边）
  function slice(img, cols, rows, seed) {
    var W = img.width, H = img.height;
    var rng = mulberry32(seed);
    var pts = gridPoints(W, H, cols, rows, rng);
    var pieces = [];
    var pad = 6;
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var c = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
        var minX = Math.min(c[0].x, c[1].x, c[2].x, c[3].x) - pad;
        var minY = Math.min(c[0].y, c[1].y, c[2].y, c[3].y) - pad;
        var maxX = Math.max(c[0].x, c[1].x, c[2].x, c[3].x) + pad;
        var maxY = Math.max(c[0].y, c[1].y, c[2].y, c[3].y) + pad;
        var pw = Math.ceil(maxX - minX);
        var ph = Math.ceil(maxY - minY);
        var cv = document.createElement("canvas");
        cv.width = pw;
        cv.height = ph;
        var g = cv.getContext("2d");
        g.beginPath();
        g.moveTo(c[0].x - minX, c[0].y - minY);
        for (var k = 1; k < 4; k++) g.lineTo(c[k].x - minX, c[k].y - minY);
        g.closePath();
        g.save();
        g.clip();
        g.drawImage(img, -minX, -minY);
        g.restore();
        // 断面描边，让碎片可读
        g.strokeStyle = "rgba(251,246,236,0.28)";
        g.lineWidth = 1.2;
        g.stroke();
        pieces.push({
          cv: cv,
          ox: minX, oy: minY,
          cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
          w: pw, h: ph,
          x: 0, y: 0,
          locked: false
        });
      }
    }
    return pieces;
  }

  // 打散位置：抖动网格散布（少重叠），分配顺序洗牌
  function scatter(pieces, area, seed) {
    var rng = mulberry32(seed ^ 0x5f3759df);
    var n = pieces.length;
    var cols = Math.ceil(Math.sqrt(n * area.w / area.h));
    var rows = Math.ceil(n / cols);
    var cw = area.w / cols;
    var ch = area.h / rows;
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    for (var d = order.length - 1; d > 0; d--) {
      var j = Math.floor(rng() * (d + 1));
      var tmp = order[d]; order[d] = order[j]; order[j] = tmp;
    }
    for (var k = 0; k < n; k++) {
      var p = pieces[order[k]];
      p.x = area.x + ((k % cols) + 0.5) * cw + (rng() * 2 - 1) * cw * 0.2;
      p.y = area.y + (Math.floor(k / cols) + 0.5) * ch + (rng() * 2 - 1) * ch * 0.2;
      p.locked = false;
    }
  }

  // 命中检测（包围盒 + 中心距加权，宽松手感）
  function pick(pieces, x, y) {
    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i];
      if (p.locked) continue;
      if (Math.abs(x - p.x) <= p.w * 0.55 && Math.abs(y - p.y) <= p.h * 0.55) return p;
    }
    return null;
  }

  return { mulberry32: mulberry32, slice: slice, scatter: scatter, pick: pick };
})();
