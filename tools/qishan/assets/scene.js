/* ============================================================
   漆扇 · 扇面拓印与渲染 (window.QSScene)
   - 扇形：团扇（圆面 + 木柄）/ 折扇（扇形 + 扇骨 + 轴铆），程序化绘制
   - 拓印：采样 dye 场捕获 → 按入水手法做 UV warp → 双线性采样 → 贴扇面
   - 入水手法影响纹路走向：垂直＝整体直拓 / 旋转＝绕心涡卷 / Z 字＝带状层叠
   ============================================================ */
(function () {
  'use strict';

  var D = window.QSData;
  var mulberry32 = D.mulberry32;

  var PATTERN_SIZE = 460;

  /* ---------- 入水手法参数（种子化：同一手法每把扇子仍有微差，"一半天成"） ---------- */
  function dipParams(dipId, seed) {
    var rnd = mulberry32(seed >>> 0);
    if (dipId === 'rotate') {
      return { id: 'rotate', base: rnd() * Math.PI * 2, twist: 1.9 + rnd() * 1.5, scale: 1.02 + rnd() * 0.08 };
    }
    if (dipId === 'zigzag') {
      var bands = 5 + Math.floor(rnd() * 3);
      var offs = [];
      for (var i = 0; i < bands; i++) offs.push((rnd() - 0.5) * 0.26);
      return { id: 'zigzag', bands: bands, offs: offs };
    }
    return { id: 'vertical', uShift: (rnd() - 0.5) * 0.03, vShift: (rnd() - 0.5) * 0.06, squeeze: 0.9 + rnd() * 0.06 };
  }

  /* pattern space (u,v: v=0 为扇面顶) → dye UV (GL: v=0 为水面底) */
  function warp(p, u, v) {
    if (p.id === 'rotate') {
      var dx = u - 0.5, dy = v - 0.5, rr = Math.sqrt(dx * dx + dy * dy);
      var th = p.base + rr * p.twist;
      var c = Math.cos(th), s = Math.sin(th);
      return [0.5 + (dx * c - dy * s) * p.scale, 0.5 + (dx * s + dy * c) * p.scale];
    }
    if (p.id === 'zigzag') {
      var b = v * p.bands, idx = Math.floor(b), t = b - idx;
      if (idx < 0) idx = 0;
      if (idx >= p.bands) { idx = p.bands - 1; t = 1; }
      var dir = (idx % 2 === 0) ? 1 : -1;
      return [u + p.offs[idx] + dir * 0.17 * (t - 0.5) * 2, v + dir * 0.02];
    }
    return [0.5 + (u - 0.5) * 0.97 + p.uShift, 0.5 + (v - 0.5) * p.squeeze + p.vShift];
  }

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  function sampleBilinear(cd, cw, ch, su, sv) {
    var fx = su * (cw - 1), fy = sv * (ch - 1);
    var x0 = Math.floor(fx), y0 = Math.floor(fy);
    var x1 = x0 + 1 < cw ? x0 + 1 : x0, y1 = y0 + 1 < ch ? y0 + 1 : y0;
    var tx = fx - x0, ty = fy - y0;
    var i00 = (y0 * cw + x0) * 4, i10 = (y0 * cw + x1) * 4;
    var i01 = (y1 * cw + x0) * 4, i11 = (y1 * cw + x1) * 4;
    var out = [0, 0, 0, 0];
    for (var k = 0; k < 4; k++) {
      var top = cd[i00 + k] + (cd[i10 + k] - cd[i00 + k]) * tx;
      var bot = cd[i01 + k] + (cd[i11 + k] - cd[i01 + k]) * tx;
      out[k] = top + (bot - top) * ty;
    }
    return out;
  }

  /* ---------- 拓印：dye 捕获 → 扇面漆纹图层 ---------- */
  function buildPattern(cap, dipId, seed) {
    var S = PATTERN_SIZE;
    var cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var g = cv.getContext('2d');
    var img = g.createImageData(S, S);
    var d = img.data;
    var p = dipParams(dipId, seed);
    var cw = cap.width, ch = cap.height, cd = cap.data;

    for (var py = 0; py < S; py++) {
      var v = py / (S - 1);
      for (var px = 0; px < S; px++) {
        var u = px / (S - 1);
        var w = warp(p, u, v);
        var s = sampleBilinear(cd, cw, ch, clamp01(w[0]), clamp01(1 - w[1]));
        var i = (py * S + px) * 4;
        d[i] = s[0]; d[i + 1] = s[1]; d[i + 2] = s[2];
        // 漆附扇面后不透明：薄漆膜也读作实漆（提 alpha）
        var a = s[3];
        d[i + 3] = a > 0 ? Math.min(255, Math.round(a * 1.25 + 20)) : 0;
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  /* ---------- 扇面几何 ---------- */
  function geometry(shape, r) {
    if (shape === 'fold') {
      var apexY = r * 0.66, R = r * 1.28, half = 50 * Math.PI / 180;
      var hw = R * Math.sin(half);
      return { shape: 'fold', apexX: 0, apexY: apexY, R: R, half: half, hw: hw, left: -hw, top: apexY - R, w: hw * 2, h: R };
    }
    var faceR = r * 0.78, faceCy = -r * 0.16;
    return {
      shape: 'round', cx: 0, cy: faceCy, faceR: faceR,
      left: -faceR, top: faceCy - faceR, w: faceR * 2, h: faceR * 2,
      handleTop: faceCy + faceR * 0.62, handleBottom: r * 0.94, handleW: r * 0.11
    };
  }

  function fanPath(g, geo) {
    g.beginPath();
    if (geo.shape === 'fold') {
      g.moveTo(geo.apexX, geo.apexY);
      g.arc(geo.apexX, geo.apexY, geo.R, -Math.PI / 2 - geo.half, -Math.PI / 2 + geo.half);
      g.closePath();
    } else {
      g.arc(geo.cx, geo.cy, geo.faceR, 0, Math.PI * 2);
    }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  function drawHandle(g, geo, r) {
    var w = geo.handleW, x = -w / 2, y = geo.handleTop, h = geo.handleBottom - geo.handleTop;
    var lg = g.createLinearGradient(x, 0, x + w, 0);
    lg.addColorStop(0, '#5a3d24');
    lg.addColorStop(0.4, '#8a6238');
    lg.addColorStop(1, '#4a3019');
    roundRect(g, x, y, w, h, w * 0.45);
    g.fillStyle = lg;
    g.fill();
    g.strokeStyle = 'rgba(217,166,46,0.5)';
    g.lineWidth = Math.max(1, r * 0.012);
    var bandY = [geo.handleTop + h * 0.16, geo.handleTop + h * 0.82];
    for (var i = 0; i < bandY.length; i++) {
      g.beginPath();
      g.moveTo(x + w * 0.1, bandY[i]);
      g.lineTo(x + w * 0.9, bandY[i]);
      g.stroke();
    }
  }

  function drawRibs(g, geo, r) {
    var n = 13;
    g.save();
    g.lineWidth = Math.max(1, r * 0.011);
    for (var i = 0; i <= n; i++) {
      var a = -Math.PI / 2 - geo.half + (geo.half * 2 * i) / n;
      var edge = (i === 0 || i === n);
      g.strokeStyle = edge ? 'rgba(107,74,47,0.55)' : 'rgba(107,74,47,0.22)';
      g.beginPath();
      g.moveTo(geo.apexX, geo.apexY);
      g.lineTo(geo.apexX + Math.cos(a) * geo.R, geo.apexY + Math.sin(a) * geo.R);
      g.stroke();
    }
    g.restore();
  }

  function drawPivot(g, geo, r) {
    g.save();
    g.beginPath();
    g.arc(geo.apexX, geo.apexY, r * 0.045, 0, Math.PI * 2);
    g.fillStyle = '#d9a62e';
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = Math.max(1, r * 0.01);
    g.stroke();
    g.restore();
  }

  /* ---------- 画一把漆扇（任意尺度复用：创作台预览 / 成品 / 分享卡 / 缩略图） ---------- */
  function drawFan(g, opt) {
    var shape = opt.shape || 'round';
    var r = opt.r;
    var geo = geometry(shape, r);
    var pattern = opt.pattern || null;
    var reveal = opt.reveal == null ? 1 : opt.reveal;

    g.save();
    g.translate(opt.cx, opt.cy);
    if (opt.tilt) g.rotate(opt.tilt * Math.PI / 180);
    if (reveal < 1) {
      g.globalAlpha = Math.max(0, Math.min(1, reveal * 1.2));
      var k = 0.86 + 0.14 * reveal;
      g.scale(k, k);
    }

    /* 木柄在扇面之下 */
    if (shape === 'round') drawHandle(g, geo, r);

    /* 投影 + 绢底 */
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = r * 0.2;
    g.shadowOffsetY = r * 0.07;
    fanPath(g, geo);
    g.fillStyle = '#f6efdd';
    g.fill();
    g.restore();

    /* 扇面：绢底 → 漆纹 → 扇骨 → 光泽（裁剪在扇形内） */
    g.save();
    fanPath(g, geo);
    g.clip();

    var silk = g.createLinearGradient(0, geo.top, 0, geo.top + geo.h);
    silk.addColorStop(0, '#faf5e6');
    silk.addColorStop(0.55, '#f2e8d0');
    silk.addColorStop(1, '#e7dabd');
    g.fillStyle = silk;
    g.fillRect(geo.left, geo.top, geo.w, geo.h);

    if (pattern) g.drawImage(pattern, geo.left, geo.top, geo.w, geo.h);

    if (shape === 'fold') drawRibs(g, geo, r);

    var sheen = g.createLinearGradient(geo.left, geo.top, geo.left + geo.w * 0.72, geo.top + geo.h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
    sheen.addColorStop(0.42, 'rgba(255,255,255,0.03)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(geo.left, geo.top, geo.w, geo.h);

    /* 内圈细金线 */
    g.strokeStyle = 'rgba(217,166,46,0.28)';
    g.lineWidth = Math.max(1, r * 0.012);
    if (shape === 'fold') {
      g.beginPath();
      g.arc(geo.apexX, geo.apexY, geo.R * 0.94, -Math.PI / 2 - geo.half, -Math.PI / 2 + geo.half);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(geo.cx, geo.cy, geo.faceR * 0.95, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();

    /* 扇框（木色） */
    fanPath(g, geo);
    var frame = g.createLinearGradient(geo.left, geo.top, geo.left + geo.w, geo.top + geo.h);
    frame.addColorStop(0, '#7a5533');
    frame.addColorStop(0.5, '#5d3f24');
    frame.addColorStop(1, '#3f2a16');
    g.strokeStyle = frame;
    g.lineWidth = r * (shape === 'round' ? 0.05 : 0.034);
    g.stroke();

    if (shape === 'fold') drawPivot(g, geo, r);

    g.restore();
  }

  /* ---------- 入水拓印动画（覆盖在水面之上） ---------- */
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

  function drawDipFx(g, w, h, t, opt) {
    g.clearRect(0, 0, w, h);
    var cx = w / 2;
    var surfY = h * 0.52;                       // 水面线
    var r = Math.min(w * 0.36, h * 0.24);
    var cy0 = surfY - r * 0.1;
    var startY = -r * 1.5;

    if (t < 0.58) {
      /* 落扇入水 */
      var k = easeOut(t / 0.58);
      var y = startY + (cy0 - startY) * k;
      drawFan(g, { cx: cx, cy: y, r: r, shape: opt.shape, pattern: null, tilt: opt.shape === 'fold' ? 0 : 0 });

      /* 触水后的涟漪 */
      if (k > 0.72) {
        var rp = (k - 0.72) / 0.28;
        for (var i = 0; i < 3; i++) {
          var rr = r * (0.5 + rp * (1.1 + i * 0.5));
          var al = Math.max(0, 0.34 * (1 - rp) * (1 - i * 0.26));
          g.save();
          g.strokeStyle = 'rgba(243,233,210,' + al.toFixed(3) + ')';
          g.lineWidth = 1.6;
          g.beginPath();
          g.ellipse(cx, surfY, rr, rr * 0.24, 0, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
        /* 水面薄膜：扇面下半没入水中 */
        g.save();
        g.fillStyle = 'rgba(10,19,32,' + (0.42 * rp).toFixed(3) + ')';
        g.fillRect(0, surfY, w, h - surfY);
        g.restore();
      }
    } else {
      /* 提扇出水：漆纹已拓上扇面 */
      var k2 = easeInOut((t - 0.58) / 0.42);
      var y2 = cy0 - k2 * r * 0.62;
      drawFan(g, { cx: cx, cy: y2, r: r * (1 + k2 * 0.1), shape: opt.shape, pattern: opt.pattern });

      /* 滴水 */
      g.save();
      for (var j = 0; j < 5; j++) {
        var dx = (j - 2) * r * 0.3;
        var dy = surfY + k2 * (30 + j * 16) * (1 - k2 * 0.4);
        var al2 = Math.max(0, 0.5 * (1 - k2));
        g.fillStyle = 'rgba(243,233,210,' + al2.toFixed(3) + ')';
        g.beginPath();
        g.ellipse(cx + dx, dy, 2.4, 5.2, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  }

  /* ---------- 成品台渲染（结果视图 canvas） ---------- */
  function paintFanCard(canvas, opt) {
    var g = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var reveal = opt.reveal == null ? 1 : opt.reveal;

    /* 夜色底 + 金光 */
    var bg = g.createRadialGradient(W / 2, H * 0.42, W * 0.06, W / 2, H * 0.42, W * 0.86);
    bg.addColorStop(0, '#123047');
    bg.addColorStop(0.5, '#0a1320');
    bg.addColorStop(1, '#060b12');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    /* 水面余韵：同心细金环 */
    g.save();
    g.strokeStyle = 'rgba(217,166,46,0.14)';
    g.lineWidth = 1;
    for (var i = 1; i <= 4; i++) {
      g.beginPath();
      g.ellipse(W / 2, H * 0.82, W * 0.16 * i, W * 0.045 * i, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();

    /* 扇下光影 */
    g.save();
    var sh = g.createRadialGradient(W / 2, H * 0.78, 4, W / 2, H * 0.78, W * 0.34);
    sh.addColorStop(0, 'rgba(0,0,0,0.4)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.fillRect(0, 0, W, H);
    g.restore();

    drawFan(g, {
      cx: W / 2, cy: H * 0.46,
      r: Math.min(W, H) * 0.34,
      shape: opt.shape, pattern: opt.pattern,
      tilt: -4, reveal: reveal
    });

    /* 朱砂印章「天成」 */
    if (reveal > 0.7) {
      g.save();
      g.globalAlpha = Math.min(1, (reveal - 0.7) / 0.3);
      g.translate(W * 0.82, H * 0.84);
      g.rotate(-6 * Math.PI / 180);
      var s = Math.min(W, H) * 0.085;
      g.fillStyle = '#e23d28';
      g.fillRect(-s / 2, -s / 2, s, s);
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = Math.max(1, s * 0.05);
      g.strokeRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8);
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = Math.round(s * 0.36) + 'px "Kaiti SC","STKaiti","KaiTi",serif';
      g.fillText('天', 0, -s * 0.19);
      g.fillText('成', 0, s * 0.2);
      g.restore();
    }
  }

  /* ---------- 缩略图（localStorage 作品） ---------- */
  function makeThumb(fan, size) {
    var cv = document.createElement('canvas');
    cv.width = size; cv.height = Math.round(size * 1.2);
    var g = cv.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 0, cv.height);
    bg.addColorStop(0, '#0f1c2b');
    bg.addColorStop(1, '#060b12');
    g.fillStyle = bg;
    g.fillRect(0, 0, cv.width, cv.height);
    drawFan(g, {
      cx: cv.width / 2, cy: cv.height * 0.48,
      r: Math.min(cv.width, cv.height) * 0.34,
      shape: fan.shape, pattern: fan.pattern
    });
    try { return cv.toDataURL('image/jpeg', 0.62); } catch (e) { return ''; }
  }

  window.QSScene = {
    PATTERN_SIZE: PATTERN_SIZE,
    buildPattern: buildPattern,
    drawFan: drawFan,
    drawDipFx: drawDipFx,
    paintFanCard: paintFanCard,
    makeThumb: makeThumb,
    geometry: geometry,
    dipParams: dipParams
  };
})();
