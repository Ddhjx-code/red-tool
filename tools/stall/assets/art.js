/* 小摊记 · 剪纸市集美术层 v2
   Canvas 2D：五层纸片预渲染（各自带厚度投影）+ 动态层
   风格见 docs/art-spec-stall.md：剪影 + 层间投影 + 纸纤维噪点 + 镂空
   Chrome 61 基线：var + function，无箭头函数 / 模板串 / let-const / 解构 */

(function () {
  'use strict';

  var INK = '#2A2420';
  var PAPER = '#FBF3E2';
  var TAU = Math.PI * 2;

  /* ---------- 四时段色板 ---------- */
  var PAL = {
    morning: {
      sky: ['#F9EED4', '#F5DFB6', '#E7C08D'],
      sun: '#F0AC3E', sunHalo: 'rgba(255,255,255,0.28)',
      mtn: ['#D8C9AE', '#C3B093', '#AB9679'],
      tower: '#8B6A56', towerD: '#6B4E3E',
      eave: '#9A4034', eaveD: '#712B21',
      wall: '#EBD7B2', wallD: '#D3B98F', wallL: '#F5E7C8',
      hole: 'rgba(120,80,60,0.55)',
      win: 'rgba(251,243,226,0.72)',
      ground: '#DDCAAB', groundD: '#C2A988', slab: 'rgba(126,100,72,0.20)',
      cloth: '#B4462F', cloth2: '#C9902F',
      lamp: 0, crowd: 'rgba(70,54,42,0.34)', leaf: '#B4462F'
    },
    noon: {
      sky: ['#E4EFE2', '#EDEBD2', '#DFD6B8'],
      sun: '#FFF3C4', sunHalo: 'rgba(255,255,255,0.24)',
      mtn: ['#BCC8B0', '#A0B096', '#83967B'],
      tower: '#7A6E5C', towerD: '#5C5244',
      eave: '#9E4634', eaveD: '#7A3023',
      wall: '#F0E1C2', wallD: '#D8C49E', wallL: '#FAF0D8',
      hole: 'rgba(110,86,64,0.50)',
      win: 'rgba(251,243,226,0.78)',
      ground: '#E3D4B8', groundD: '#C8B494', slab: 'rgba(126,100,72,0.17)',
      cloth: '#B4462F', cloth2: '#C9902F',
      lamp: 0, crowd: 'rgba(70,54,42,0.30)', leaf: '#B4462F'
    },
    dusk: {
      sky: ['#FBDCB4', '#EDA878', '#C4694A'],
      sun: '#E98B54', sunHalo: 'rgba(255,222,180,0.30)',
      mtn: ['#C99C82', '#AB7E64', '#8C644C'],
      tower: '#6B4A3C', towerD: '#4E352A',
      eave: '#7E3529', eaveD: '#5E2018',
      wall: '#E0C6A0', wallD: '#C4A57C', wallL: '#EFD9B3',
      hole: 'rgba(90,58,44,0.58)',
      win: 'rgba(255,232,190,0.80)',
      ground: '#C9AC86', groundD: '#AC8E6E', slab: 'rgba(96,68,48,0.22)',
      cloth: '#A6382A', cloth2: '#C08A2E',
      lamp: 0.7, crowd: 'rgba(54,38,32,0.40)', leaf: '#C9902F'
    },
    night: {
      sky: ['#22203A', '#2D2947', '#3E3858'],
      sun: '#F4E9C8', sunHalo: 'rgba(240,230,200,0.16)',
      mtn: ['#37334E', '#2D2940', '#242132'],
      tower: '#221E30', towerD: '#151220',
      eave: '#2E2735', eaveD: '#1A1622',
      wall: '#3C3550', wallD: '#2C2639', wallL: '#4A4260',
      hole: 'rgba(255,205,110,0.92)',
      win: 'rgba(255,205,110,0.88)',
      ground: '#3C3653', groundD: '#2E2941', slab: 'rgba(0,0,0,0.26)',
      cloth: '#8E3A2C', cloth2: '#B07C24',
      lamp: 1, crowd: 'rgba(14,12,22,0.46)', leaf: '#6B5B82'
    }
  };

  var S = {
    cv: null, g: null, W: 0, H: 0, dpr: 1,
    key: 'morning', pal: PAL.morning,
    L: [],
    mtx: 0, mty: 0, cmx: 0, cmy: 0,
    t: 0, guests: [], walkers: [], parts: [], coins: [],
    raf: null, last: 0, rszTimer: null,
    scene: 'intro', stock: {}, sign: 0, shakeT: 0, popT: 0,
    ready: false, groundY: 0
  };

  /* ---------- 工具 ---------- */

  function rnd(o) { o.s = (o.s * 16807) % 2147483647; return o.s / 2147483647; }

  function rr(g, x, y, w, h, r) {
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

  function grain(g, w, h, seed) {
    var o = { s: seed || 12345 };
    var n = Math.round(w * h / 210);
    var i;
    g.save();
    g.globalCompositeOperation = 'source-atop';
    for (i = 0; i < n; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.04 + rnd(o) * 0.10).toFixed(3) + ')';
      g.fillRect(rnd(o) * w, rnd(o) * h, 1 + rnd(o) * 1.5, 1 + rnd(o) * 1.5);
    }
    for (i = 0; i < n * 0.45; i++) {
      g.fillStyle = 'rgba(46,34,24,' + (0.04 + rnd(o) * 0.07).toFixed(3) + ')';
      g.fillRect(rnd(o) * w, rnd(o) * h, 1 + rnd(o) * 1.2, 1 + rnd(o) * 1.2);
    }
    g.restore();
  }

  /* 纸片厚度：整层右移下移一层深色垫在底下 */
  function thicken(cv, dx, dy) {
    var c = document.createElement('canvas');
    c.width = cv.width;
    c.height = cv.height;
    var g = c.getContext('2d');
    g.drawImage(cv, dx, dy);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = 'rgba(46,34,24,0.20)';
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(cv, 0, 0);
    return c;
  }

  /* ---------- 云 ---------- */

  function cloudShape(g, x, y, w, h) {
    g.beginPath();
    g.moveTo(x, y + h * 0.66);
    g.quadraticCurveTo(x + w * 0.02, y + h * 0.10, x + w * 0.20, y + h * 0.26);
    g.quadraticCurveTo(x + w * 0.28, y - h * 0.18, x + w * 0.44, y + h * 0.10);
    g.quadraticCurveTo(x + w * 0.58, y - h * 0.14, x + w * 0.70, y + h * 0.18);
    g.quadraticCurveTo(x + w * 0.84, y + h * 0.02, x + w * 0.98, y + h * 0.50);
    g.quadraticCurveTo(x + w * 0.72, y + h * 0.72, x + w * 0.30, y + h * 0.72);
    g.quadraticCurveTo(x + w * 0.06, y + h * 0.72, x, y + h * 0.66);
    g.closePath();
  }

  /* ---------- 天空 ---------- */

  function paintSky(g, w, h, p) {
    var grad = g.createLinearGradient(0, 0, 0, h * 0.56);
    grad.addColorStop(0, p.sky[0]);
    grad.addColorStop(0.55, p.sky[1]);
    grad.addColorStop(1, p.sky[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h * 0.60);

    var cx = w * 0.79, cy = h * 0.125, r = Math.min(w, h) * 0.040;
    g.beginPath();
    g.arc(cx, cy, r * 2.1, 0, TAU);
    g.fillStyle = p.sunHalo;
    g.fill();
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fillStyle = p.sun;
    g.fill();

    /* 斜光：一块半透明纸片，剪纸风的"丁达尔" */
    g.save();
    g.globalAlpha = 0.08;
    g.fillStyle = '#FFF8E2';
    g.beginPath();
    g.moveTo(w * 0.05, 0);
    g.lineTo(w * 0.34, 0);
    g.lineTo(w * 0.62, h * 0.45);
    g.lineTo(w * 0.31, h * 0.45);
    g.closePath();
    g.fill();
    g.restore();

    var cs = [
      { x: w * 0.02, y: h * 0.055, w: w * 0.46, h: h * 0.048 },
      { x: w * 0.54, y: h * 0.165, w: w * 0.54, h: h * 0.040 },
      { x: w * 0.18, y: h * 0.245, w: w * 0.38, h: h * 0.032 }
    ];
    var i;
    for (i = 0; i < cs.length; i++) {
      var c = cs[i];
      g.save();
      cloudShape(g, c.x, c.y, c.w, c.h);
      g.fillStyle = 'rgba(255,255,255,0.40)';
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      var k;
      for (k = 0; k < 4; k++) {
        g.beginPath();
        g.arc(c.x + c.w * (0.25 + k * 0.18), c.y + c.h * (0.48 + (k % 2) * 0.06),
          c.h * (0.30 + (k % 3) * 0.10), Math.PI * 1.05, Math.PI * 1.95);
        g.lineWidth = Math.max(1.2, c.h * 0.16);
        g.strokeStyle = '#000';
        g.stroke();
      }
      g.restore();
    }
  }

  /* ---------- 山 ---------- */

  function ridge(g, w, baseY, amp, seed, color) {
    var o = { s: seed };
    g.beginPath();
    g.moveTo(-50, baseY + 300);
    var x = -50;
    var y = baseY - rnd(o) * amp * 0.5;
    g.lineTo(-50, y);
    var step = w / 7;
    while (x < w + 50) {
      var nx = x + step;
      var ny = baseY - rnd(o) * amp;
      g.quadraticCurveTo(x + step * 0.40, ny - rnd(o) * amp * 0.60, nx, ny + rnd(o) * amp * 0.20);
      x = nx;
    }
    g.lineTo(w + 50, baseY + 300);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }

  function paintMountains(g, w, h, p) {
    ridge(g, w, h * 0.400, h * 0.105, 7717, p.mtn[2]);
    ridge(g, w, h * 0.432, h * 0.080, 20231, p.mtn[1]);
    ridge(g, w, h * 0.462, h * 0.055, 99133, p.mtn[0]);
  }

  /* ---------- 中式屋顶 ---------- */

  function roof(g, cx, botY, w, h, p, opt) {
    opt = opt || {};
    var halfB = w / 2;
    var halfT = w * 0.30;
    var topY = botY - h;
    var lift = h * 0.42;
    var seg = 5, i;

    g.beginPath();
    g.moveTo(cx - halfB - w * 0.035, botY - lift);
    g.quadraticCurveTo(cx - halfB * 0.92, botY + h * 0.10, cx - halfB * 0.80, botY);
    for (i = 0; i < seg; i++) {
      var x0 = cx - halfB * 0.80 + (halfB * 1.60) * (i / seg);
      var x1 = cx - halfB * 0.80 + (halfB * 1.60) * ((i + 1) / seg);
      g.quadraticCurveTo((x0 + x1) / 2, botY + h * 0.13, x1, botY);
    }
    g.quadraticCurveTo(cx + halfB * 0.92, botY + h * 0.10, cx + halfB + w * 0.035, botY - lift);
    g.quadraticCurveTo(cx + halfB * 0.72, topY + h * 0.05, cx + halfT, topY);
    g.lineTo(cx - halfT, topY);
    g.quadraticCurveTo(cx - halfB * 0.72, topY + h * 0.05, cx - halfB - w * 0.035, botY - lift);
    g.closePath();
    g.fillStyle = p.eave;
    g.fill();

    g.save();
    g.globalAlpha = 0.26;
    g.strokeStyle = p.eaveD;
    g.lineWidth = Math.max(1, h * 0.045);
    for (i = 1; i < 6; i++) {
      var t = i / 6;
      g.beginPath();
      g.moveTo(cx - halfT + halfT * 2 * t, topY);
      g.lineTo(cx - halfB * 0.74 + halfB * 1.48 * t, botY - h * 0.02);
      g.stroke();
    }
    g.restore();

    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = p.eaveD;
    g.lineWidth = Math.max(1.2, h * 0.075);
    g.beginPath();
    g.moveTo(cx - halfB * 0.80, botY);
    for (i = 1; i <= seg; i++) {
      var xa = cx - halfB * 0.80 + (halfB * 1.60) * ((i - 1) / seg);
      var xb = cx - halfB * 0.80 + (halfB * 1.60) * (i / seg);
      g.quadraticCurveTo((xa + xb) / 2, botY + h * 0.11, xb, botY);
    }
    g.stroke();
    g.restore();

    g.fillStyle = p.eaveD;
    g.fillRect(cx - halfT - w * 0.012, topY - h * 0.075, halfT * 2 + w * 0.024, h * 0.085);
    if (opt.finial) {
      g.beginPath();
      g.moveTo(cx - halfT - w * 0.010, topY - h * 0.060);
      g.lineTo(cx - halfT - w * 0.032, topY - h * 0.250);
      g.lineTo(cx - halfT + w * 0.030, topY - h * 0.060);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(cx + halfT + w * 0.010, topY - h * 0.060);
      g.lineTo(cx + halfT + w * 0.032, topY - h * 0.250);
      g.lineTo(cx + halfT - w * 0.030, topY - h * 0.060);
      g.closePath();
      g.fill();
    }
  }

  /* ---------- 塔 ---------- */

  function tower(g, cx, baseY, w, tiers, p) {
    var tierH = w * 0.30;
    var bodyW = w * 0.60;
    var i, k;

    g.fillStyle = p.towerD;
    g.fillRect(cx - w * 0.54, baseY - tierH * 0.22, w * 1.08, tierH * 0.26);
    g.fillStyle = p.tower;
    g.fillRect(cx - w * 0.46, baseY - tierH * 0.34, w * 0.92, tierH * 0.14);

    for (i = 0; i < tiers; i++) {
      var bw = bodyW * (1 - i * 0.15);
      var by = baseY - tierH * 0.34 - (i + 1) * tierH * 0.76;
      g.fillStyle = p.tower;
      g.fillRect(cx - bw / 2, by, bw, tierH * 0.76);

      g.save();
      g.globalAlpha = 0.35;
      g.fillStyle = p.towerD;
      for (k = 0; k <= 4; k++) {
        g.fillRect(cx - bw / 2 + bw * (k / 4) - w * 0.004, by, w * 0.008, tierH * 0.76);
      }
      g.restore();

      for (k = 0; k < 3; k++) {
        var ww = bw * 0.13, wh = tierH * 0.30;
        var wx = cx - bw * 0.31 + k * (bw * 0.31);
        g.fillStyle = p.win;
        rr(g, wx, by + tierH * 0.24, ww, wh, ww * 0.18);
        g.fill();
      }
      roof(g, cx, by, w * 0.94, tierH * 0.52, p, { finial: i === tiers - 1 });
    }
  }

  function paintTowers(g, w, h, p) {
    tower(g, w * 0.13, h * 0.545, w * 0.44, 3, p);
    tower(g, w * 0.88, h * 0.515, w * 0.38, 2, p);
  }

  /* ---------- 店铺 ---------- */

  function shopFront(g, x, baseY, w, h, p, opt) {
    var i;
    g.fillStyle = opt.wall || p.wall;
    g.fillRect(x, baseY - h, w, h);

    g.fillStyle = p.wallD;
    g.fillRect(x, baseY - h * 0.26, w, h * 0.26);

    var dw = w * 0.40, dh = h * 0.66;
    g.fillStyle = S.key === 'night' ? 'rgba(255,198,96,0.92)' : p.hole;
    rr(g, x + w * 0.30, baseY - dh, dw, dh, 2);
    g.fill();
    if (S.key !== 'night') {
      g.fillStyle = 'rgba(251,243,226,0.28)';
      g.fillRect(x + w * 0.30, baseY - dh, dw, dh * 0.10);
    }

    var wy = baseY - h * 0.90, wh = h * 0.24, ww = w * 0.16;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    for (i = 0; i < 2; i++) {
      rr(g, x + w * (i ? 0.72 : 0.12), wy, ww, wh, 2);
      g.fill();
    }
    g.restore();

    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = p.wallL;
    for (i = 0; i < 2; i++) {
      var bxp = x + w * (i ? 0.72 : 0.12);
      g.fillRect(bxp + ww * 0.46, wy, Math.max(1, ww * 0.08), wh);
      g.fillRect(bxp, wy + wh * 0.46, ww, Math.max(1, wh * 0.07));
    }
    g.restore();

    roof(g, x + w * 0.5, baseY - h, w * 1.14, h * 0.40, p, {});

    if (p.lamp > 0) {
      g.save();
      g.globalAlpha = 0.92;
      g.fillStyle = '#F2A93A';
      g.beginPath();
      g.ellipse(x + w * 0.22, baseY - h * 0.34, w * 0.055, w * 0.070, 0, 0, TAU);
      g.fill();
      g.restore();
    }

    if (opt.flag !== false) {
      var fx = x + w * (opt.flagLeft ? 0.03 : 0.84);
      var fy = baseY - h * 0.98;
      var fw = w * 0.15, fh = h * 0.38;
      g.beginPath();
      g.moveTo(fx, fy);
      g.lineTo(fx + fw, fy);
      g.lineTo(fx + fw, fy + fh * 0.86);
      g.lineTo(fx + fw * 0.5, fy + fh);
      g.lineTo(fx, fy + fh * 0.86);
      g.closePath();
      g.fillStyle = opt.flagColor || p.cloth;
      g.fill();
      g.save();
      g.globalAlpha = 0.32;
      g.fillStyle = PAPER;
      g.fillRect(fx + fw * 0.16, fy + fh * 0.30, fw * 0.68, Math.max(1, fh * 0.05));
      g.fillRect(fx + fw * 0.16, fy + fh * 0.52, fw * 0.68, Math.max(1, fh * 0.05));
      g.restore();
    }
  }

  function paintStreet(g, w, h, p) {
    var baseY = h * 0.645;
    var i;

    var back = [
      { x: w * 0.02, w: w * 0.20, h: h * 0.115 },
      { x: w * 0.24, w: w * 0.18, h: h * 0.130 },
      { x: w * 0.58, w: w * 0.20, h: h * 0.120 },
      { x: w * 0.80, w: w * 0.19, h: h * 0.135 }
    ];
    g.save();
    g.globalAlpha = 0.55;
    for (i = 0; i < back.length; i++) {
      shopFront(g, back[i].x, baseY - h * 0.012, back[i].w, back[i].h, p,
        { wall: p.wallD, flag: false });
    }
    g.restore();

    var front = [
      { x: -w * 0.06, w: w * 0.30, h: h * 0.200, flag: true,  left: true },
      { x: w * 0.76,  w: w * 0.32, h: h * 0.235, flag: true,  left: false },
      { x: w * 0.22,  w: w * 0.24, h: h * 0.155, flag: false, left: false },
      { x: w * 0.56,  w: w * 0.22, h: h * 0.170, flag: true,  left: true }
    ];
    for (i = 0; i < front.length; i++) {
      var f = front[i];
      shopFront(g, f.x, baseY, f.w, f.h, p, {
        wall: i % 2 ? p.wall : p.wallL,
        flag: f.flag,
        flagLeft: f.left,
        flagColor: i % 3 === 0 ? p.cloth2 : p.cloth
      });
      if (i % 2 === 0) {
        g.save();
        g.globalAlpha = 0.10;
        g.fillStyle = '#2A1C14';
        g.fillRect(f.x - f.w * 0.10, baseY - f.h - f.h * 0.45, f.w * 1.20, f.h * 1.55);
        g.restore();
      }
    }
  }

  /* ---------- 地面 ---------- */

  function paintGround(g, w, h, p) {
    var top = h * 0.645;
    g.fillStyle = p.ground;
    g.fillRect(-50, top, w + 100, h - top + 60);

    var y = top + h * 0.012;
    var gap = h * 0.024;
    var k = 0;
    while (y < h + 60) {
      g.fillStyle = p.slab;
      g.fillRect(-50, y, w + 100, Math.max(1.2, h * 0.0028));
      if (k % 2 === 0) {
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(-50, y + h * 0.0035, w + 100, Math.max(1, h * 0.0016));
      }
      y += gap;
      gap *= 1.20;
      k++;
    }

    g.save();
    g.globalAlpha = 0.12;
    g.fillStyle = p.groundD;
    g.fillRect(w * 0.16, top + h * 0.05, w * 0.010, h * 0.30);
    g.fillRect(w * 0.70, top + h * 0.05, w * 0.010, h * 0.30);
    g.restore();

    /* 远街小棚剪影 */
    g.save();
    g.globalAlpha = 0.34;
    g.fillStyle = p.crowd;
    var i;
    for (i = 0; i < 4; i++) {
      var sx = w * (0.03 + i * 0.27);
      var sy = top + h * 0.040;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + w * 0.14, sy);
      g.lineTo(sx + w * 0.12, sy + h * 0.030);
      g.lineTo(sx + w * 0.02, sy + h * 0.030);
      g.closePath();
      g.fill();
      g.fillRect(sx + w * 0.02, sy + h * 0.030, w * 0.10, h * 0.022);
    }
    g.restore();
  }

  /* ---------- 组装 ---------- */

  function mkLayer(w, h, seed, fn, thick) {
    var c = document.createElement('canvas');
    c.width = Math.round(w * S.dpr);
    c.height = Math.round(h * S.dpr);
    var g = c.getContext('2d');
    g.scale(S.dpr, S.dpr);
    fn(g, w, h);
    grain(g, w, h, seed);
    if (thick) return thicken(c, Math.round(2.5 * S.dpr), Math.round(3.5 * S.dpr));
    return c;
  }

  function build() {
    var w = Math.round(S.W + 120);
    var h = Math.round(S.H);
    if (w < 10 || h < 10) return;
    var p = S.pal;
    S.groundY = h * 0.645;
    S.L = [];

    S.L.push({ cv: mkLayer(w, h, 1001, function (g) { paintSky(g, w, h, p); }, false), depth: 0.000, w: w, h: h });
    S.L.push({ cv: mkLayer(w, h, 2003, function (g) { paintMountains(g, w, h, p); }, true), depth: 0.030, w: w, h: h });
    S.L.push({ cv: mkLayer(w, h, 3007, function (g) { paintTowers(g, w, h, p); }, true), depth: 0.055, w: w, h: h });
    S.L.push({ cv: mkLayer(w, h, 4011, function (g) { paintStreet(g, w, h, p); }, true), depth: 0.095, w: w, h: h });
    S.L.push({ cv: mkLayer(w, h, 5013, function (g) { paintGround(g, w, h, p); }, false), depth: 0.135, w: w, h: h });

    if (!S.walkers.length) {
      var i;
      for (i = 0; i < 3; i++) {
        S.walkers.push({
          x: Math.random() * S.W,
          y: S.groundY + S.H * (0.052 + i * 0.014),
          s: S.H * (0.062 + i * 0.006),
          dir: Math.random() < 0.5 ? -1 : 1,
          v: 0.026 + Math.random() * 0.018,
          kind: ['woman', 'elder', 'scholar'][i % 3]
        });
      }
    }
    S.ready = true;
  }

  /* ---------- 货物剪影 ---------- */

  var GOOD_ART = {
    fan: function (g, s) {
      g.beginPath();
      g.moveTo(0, s * 0.44);
      g.quadraticCurveTo(-s * 0.54, -s * 0.08, -s * 0.50, -s * 0.40);
      g.quadraticCurveTo(0, -s * 0.64, s * 0.50, -s * 0.40);
      g.quadraticCurveTo(s * 0.54, -s * 0.08, 0, s * 0.44);
      g.closePath();
      g.fill();
      g.save();
      g.globalAlpha = 0.6;
      g.strokeStyle = PAPER;
      g.lineWidth = Math.max(1, s * 0.065);
      g.beginPath();
      g.moveTo(0, s * 0.40); g.lineTo(0, -s * 0.52);
      g.moveTo(0, s * 0.40); g.lineTo(-s * 0.31, -s * 0.34);
      g.moveTo(0, s * 0.40); g.lineTo(s * 0.31, -s * 0.34);
      g.stroke();
      g.restore();
    },
    sachet: function (g, s) {
      g.beginPath();
      g.moveTo(-s * 0.36, -s * 0.16);
      g.quadraticCurveTo(0, -s * 0.46, s * 0.36, -s * 0.16);
      g.lineTo(s * 0.42, s * 0.30);
      g.quadraticCurveTo(0, s * 0.58, -s * 0.42, s * 0.30);
      g.closePath();
      g.fill();
      g.save();
      g.strokeStyle = PAPER;
      g.globalAlpha = 0.55;
      g.lineWidth = Math.max(1, s * 0.06);
      g.beginPath();
      g.moveTo(-s * 0.30, -s * 0.16);
      g.quadraticCurveTo(0, -s * 0.32, s * 0.30, -s * 0.16);
      g.stroke();
      g.restore();
      g.fillRect(-s * 0.04, s * 0.56, s * 0.08, s * 0.24);
    },
    candy: function (g, s) {
      g.save();
      g.lineWidth = Math.max(1.8, s * 0.15);
      g.strokeStyle = g.fillStyle;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0, -s * 0.04, s * 0.28, 0.5, 5.1);
      g.stroke();
      g.beginPath();
      g.moveTo(0, s * 0.22); g.lineTo(0, s * 0.62);
      g.stroke();
      g.restore();
    },
    lamp: function (g, s) {
      g.beginPath();
      g.ellipse(0, 0, s * 0.36, s * 0.42, 0, 0, TAU);
      g.fill();
      g.save();
      g.strokeStyle = PAPER;
      g.globalAlpha = 0.65;
      g.lineWidth = Math.max(1, s * 0.05);
      g.beginPath();
      g.moveTo(-s * 0.36, 0); g.lineTo(s * 0.36, 0);
      g.moveTo(0, -s * 0.42); g.lineTo(0, s * 0.42);
      g.stroke();
      g.restore();
      g.fillRect(-s * 0.26, -s * 0.46, s * 0.52, s * 0.08);
      g.fillRect(-s * 0.26, s * 0.40, s * 0.52, s * 0.08);
      g.fillRect(-s * 0.05, s * 0.48, s * 0.10, s * 0.18);
    },
    kite: function (g, s) {
      g.beginPath();
      g.moveTo(0, -s * 0.60);
      g.lineTo(s * 0.46, -s * 0.05);
      g.lineTo(0, s * 0.48);
      g.lineTo(-s * 0.46, -s * 0.05);
      g.closePath();
      g.fill();
      g.save();
      g.strokeStyle = PAPER;
      g.globalAlpha = 0.6;
      g.lineWidth = Math.max(1, s * 0.055);
      g.beginPath();
      g.moveTo(0, -s * 0.58); g.lineTo(0, s * 0.46);
      g.moveTo(-s * 0.44, -s * 0.05); g.lineTo(s * 0.44, -s * 0.05);
      g.stroke();
      g.restore();
    },
    doll: function (g, s) {
      g.beginPath(); g.arc(0, -s * 0.46, s * 0.20, 0, TAU); g.fill();
      g.beginPath();
      g.moveTo(-s * 0.26, -s * 0.22);
      g.lineTo(s * 0.26, -s * 0.22);
      g.lineTo(s * 0.36, s * 0.34);
      g.lineTo(-s * 0.36, s * 0.34);
      g.closePath();
      g.fill();
      g.fillRect(-s * 0.06, s * 0.32, s * 0.12, s * 0.24);
    },
    candied: function (g, s) {
      g.save();
      g.strokeStyle = g.fillStyle;
      g.lineWidth = Math.max(1.6, s * 0.09);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, s * 0.64); g.lineTo(0, -s * 0.52);
      g.stroke();
      g.restore();
      var i;
      for (i = 0; i < 3; i++) {
        g.beginPath(); g.arc(0, -s * 0.44 + i * s * 0.30, s * 0.21, 0, TAU); g.fill();
      }
    },
    bowl: function (g, s) {
      g.beginPath();
      g.moveTo(-s * 0.50, -s * 0.18);
      g.lineTo(s * 0.50, -s * 0.18);
      g.quadraticCurveTo(s * 0.44, s * 0.40, 0, s * 0.40);
      g.quadraticCurveTo(-s * 0.44, s * 0.40, -s * 0.50, -s * 0.18);
      g.closePath();
      g.fill();
      g.save();
      g.globalAlpha = 0.6;
      g.fillStyle = PAPER;
      g.fillRect(-s * 0.50, -s * 0.22, s, s * 0.06);
      g.restore();
    },
    tea: function (g, s) {
      g.beginPath(); g.arc(0, 0, s * 0.48, 0, TAU); g.fill();
      g.save();
      g.strokeStyle = PAPER;
      g.globalAlpha = 0.7;
      g.lineWidth = Math.max(1, s * 0.05);
      g.beginPath(); g.arc(0, 0, s * 0.28, 0, TAU); g.stroke();
      g.beginPath();
      g.moveTo(-s * 0.28, 0); g.lineTo(s * 0.28, 0);
      g.moveTo(0, -s * 0.28); g.lineTo(0, s * 0.28);
      g.stroke();
      g.restore();
      g.beginPath(); g.arc(0, 0, s * 0.10, 0, TAU); g.fillStyle = PAPER; g.fill();
    },
    jade: function (g, s) {
      g.beginPath(); g.arc(0, 0, s * 0.48, 0, TAU); g.fill();
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(0, 0, s * 0.20, 0, TAU); g.fill();
      g.restore();
      g.save();
      g.globalAlpha = 0.5;
      g.strokeStyle = PAPER;
      g.lineWidth = Math.max(1, s * 0.04);
      g.beginPath(); g.arc(0, 0, s * 0.36, 0.4, 2.4); g.stroke();
      g.restore();
    }
  };

  /* ---------- 我的摊 ---------- */

  function drawStall(g) {
    var w = S.W, h = S.H, p = S.pal;
    var cx = w * 0.5;
    var sway = Math.sin(S.t * 0.0010) * 0.010;
    var pop = S.popT > 0 ? Math.sin(S.popT * 0.030) * h * 0.004 : 0;

    var roofBotY = h * 0.548 + pop;
    var roofH = h * 0.056;
    var halfW = w * 0.320;
    var tableY = h * 0.630;
    var tableH = h * 0.018;
    var skirtH = h * 0.046;
    var i;

    g.save();
    g.globalAlpha = 0.16;
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(cx, tableY + tableH + skirtH + h * 0.008, halfW * 1.02, h * 0.016, 0, 0, TAU);
    g.fill();
    g.restore();

    g.fillStyle = p.eaveD;
    var px1 = cx - halfW * 0.94, px2 = cx + halfW * 0.94;
    var postTop = roofBotY - roofH * 0.24;
    g.fillRect(px1 - w * 0.006, postTop, w * 0.012, tableY - postTop + tableH);
    g.fillRect(px2 - w * 0.006, postTop, w * 0.012, tableY - postTop + tableH);

    /* 布棚 */
    g.save();
    g.translate(cx, roofBotY);
    g.rotate(sway);
    g.translate(-cx, -roofBotY);

    g.beginPath();
    g.moveTo(cx - halfW, roofBotY);
    g.quadraticCurveTo(cx, roofBotY - roofH * 1.9, cx + halfW, roofBotY);
    var seg = 8;
    for (i = seg; i > 0; i--) {
      var x0 = cx + halfW * (2 * (i / seg) - 1);
      var x1 = cx + halfW * (2 * ((i - 1) / seg) - 1);
      g.quadraticCurveTo((x0 + x1) / 2, roofBotY + roofH * 0.62, x1, roofBotY);
    }
    g.closePath();
    g.fillStyle = '#4A6B58';
    g.fill();

    g.save();
    g.globalAlpha = 0.80;
    g.fillStyle = PAPER;
    g.beginPath();
    g.moveTo(cx - halfW * 0.075, roofBotY);
    g.quadraticCurveTo(cx - halfW * 0.055, roofBotY - roofH * 1.5, cx, roofBotY - roofH * 1.86);
    g.quadraticCurveTo(cx - halfW * 0.035, roofBotY - roofH * 1.5, cx - halfW * 0.020, roofBotY);
    g.closePath();
    g.fill();
    g.restore();

    g.save();
    g.globalAlpha = 0.28;
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1, w * 0.0028);
    for (i = 1; i < 8; i++) {
      var t = i / 8;
      g.beginPath();
      g.moveTo(cx, roofBotY - roofH * 1.86);
      g.quadraticCurveTo(cx + halfW * (2 * t - 1) * 0.5, roofBotY - roofH * 0.9,
        cx + halfW * (2 * t - 1), roofBotY);
      g.stroke();
    }
    g.restore();

    g.save();
    g.globalAlpha = 0.20;
    g.fillStyle = INK;
    for (i = 0; i < seg; i++) {
      var bx = cx - halfW + halfW * 2 * (i / seg);
      g.beginPath();
      g.ellipse(bx + halfW / seg, roofBotY + roofH * 0.30, halfW / seg * 0.92, roofH * 0.16, 0, 0, TAU);
      g.fill();
    }
    g.restore();
    g.restore();

    /* 幌子 */
    var fx = cx + halfW * 0.62, fy = roofBotY + roofH * 0.10;
    var fl = Math.sin(S.t * 0.0024) * w * 0.008;
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(fx + w * 0.062, fy);
    g.lineTo(fx + w * 0.062 + fl, fy + h * 0.086);
    g.lineTo(fx + w * 0.031 + fl, fy + h * 0.100);
    g.lineTo(fx + fl, fy + h * 0.086);
    g.closePath();
    g.fillStyle = '#4A6B58';
    g.fill();

    /* 招牌 */
    if (S.sign === 1) {
      for (i = 0; i < 5; i++) {
        var tx = cx - halfW * 0.72 + halfW * 1.44 * (i / 4);
        g.beginPath();
        g.moveTo(tx - w * 0.016, roofBotY + roofH * 0.30);
        g.lineTo(tx + w * 0.016, roofBotY + roofH * 0.30);
        g.lineTo(tx, roofBotY + roofH * 0.62);
        g.closePath();
        g.fillStyle = i % 2 ? p.cloth2 : PAPER;
        g.fill();
      }
    } else if (S.sign === 2) {
      g.fillStyle = p.wallL;
      rr(g, cx - w * 0.105, roofBotY + roofH * 0.16, w * 0.21, h * 0.036, 1);
      g.fill();
      g.fillStyle = p.eaveD;
      g.fillRect(cx - w * 0.105, roofBotY + roofH * 0.16, w * 0.21, h * 0.004);
      g.fillRect(cx - w * 0.105, roofBotY + roofH * 0.16 + h * 0.032, w * 0.21, h * 0.004);
    }

    /* 案桌 */
    g.fillStyle = '#8A6B4A';
    g.fillRect(cx - halfW * 0.90, tableY, halfW * 1.80, tableH);
    g.fillStyle = '#6E5238';
    g.fillRect(cx - halfW * 0.90, tableY + tableH, halfW * 1.80, h * 0.004);

    /* 桌帷 */
    g.fillStyle = '#3C5A4A';
    g.fillRect(cx - halfW * 0.90, tableY + tableH + h * 0.004, halfW * 1.80, skirtH);
    g.save();
    g.globalAlpha = 0.30;
    g.fillStyle = 'rgba(40,20,14,0.9)';
    g.fillRect(cx - halfW * 0.90, tableY + tableH + h * 0.004 + skirtH - h * 0.006,
      halfW * 1.80, h * 0.006);
    g.restore();
    /* 桌帷上的小方章 */
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = PAPER;
    rr(g, cx - w * 0.016, tableY + tableH + h * 0.004 + skirtH * 0.30, w * 0.032, w * 0.032, 1);
    g.fill();
    g.restore();

    /* 桌上的货 */
    var ids = [];
    for (var id in S.stock) {
      if (S.stock.hasOwnProperty(id) && S.stock[id] > 0 && GOOD_ART[id]) ids.push(id);
    }
    ids.sort(function (a, b) { return S.stock[b] - S.stock[a]; });
    var n = Math.min(ids.length, 5);
    var cols = ['#B4462F', '#C9902F', '#3F6E63', '#8A6B4A', '#4A4458'];
    for (i = 0; i < n; i++) {
      var gx = cx - halfW * 0.66 + (halfW * 1.32) * (n === 1 ? 0.5 : i / (n - 1));
      var gs = w * 0.030;
      g.save();
      g.translate(gx, tableY - h * 0.004);
      g.fillStyle = 'rgba(42,26,18,0.18)';
      g.beginPath();
      g.ellipse(0, h * 0.005, gs * 0.72, gs * 0.20, 0, 0, TAU);
      g.fill();
      g.fillStyle = cols[i % 5];
      GOOD_ART[ids[i]](g, gs);
      g.restore();
    }

    /* 摊主 */
    var ownX = cx - halfW * 0.28;
    var ownY = tableY + h * 0.004;
    g.save();
    g.globalAlpha = 0.94;
    g.fillStyle = S.key === 'night' ? '#221C2A' : '#4A3A2E';
    g.beginPath();
    g.arc(ownX, ownY - h * 0.062, w * 0.026, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(ownX - w * 0.052, ownY);
    g.quadraticCurveTo(ownX - w * 0.030, ownY - h * 0.050, ownX, ownY - h * 0.050);
    g.quadraticCurveTo(ownX + w * 0.030, ownY - h * 0.050, ownX + w * 0.052, ownY);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(ownX - w * 0.042, ownY - h * 0.070);
    g.quadraticCurveTo(ownX, ownY - h * 0.100, ownX + w * 0.042, ownY - h * 0.070);
    g.closePath();
    g.fill();
    g.restore();
    /* 斗笠亮边 + 肩线，把剪影从背景里拉出来 */
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = PAPER;
    g.lineWidth = Math.max(1, w * 0.0035);
    g.beginPath();
    g.moveTo(ownX - w * 0.042, ownY - h * 0.070);
    g.quadraticCurveTo(ownX, ownY - h * 0.100, ownX + w * 0.042, ownY - h * 0.070);
    g.stroke();
    g.beginPath();
    g.moveTo(ownX - w * 0.030, ownY - h * 0.048);
    g.quadraticCurveTo(ownX, ownY - h * 0.056, ownX + w * 0.030, ownY - h * 0.048);
    g.stroke();
    g.restore();

    /* 前景道具：只在封面与结算出现，避免压住列表/按钮 */
    if (S.scene === 'intro' || S.scene === 'result') {
    g.save();
    g.globalAlpha = 0.92;
    g.fillStyle = '#8A6B4A';
    /* 左：半只竹筐出画 */
    g.beginPath();
    g.moveTo(-w * 0.02, h * 0.852);
    g.quadraticCurveTo(w * 0.115, h * 0.782, w * 0.245, h * 0.852);
    g.lineTo(w * 0.232, h * 0.948);
    g.lineTo(w * 0.004, h * 0.948);
    g.closePath();
    g.fill();
    g.save();
    g.globalAlpha = 0.28;
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1, w * 0.004);
    for (i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(-w * 0.02 + w * 0.265 * (i / 4), h * 0.832);
      g.lineTo(-w * 0.02 + w * 0.265 * (i / 4), h * 0.948);
      g.stroke();
    }
    g.restore();

    /* 右：酒坛 */
    g.fillStyle = '#4A3A32';
    g.beginPath();
    g.moveTo(w * 0.856, h * 0.836);
    g.lineTo(w * 0.912, h * 0.836);
    g.quadraticCurveTo(w * 0.956, h * 0.876, w * 0.940, h * 0.916);
    g.lineTo(w * 0.932, h * 0.950);
    g.lineTo(w * 0.846, h * 0.950);
    g.lineTo(w * 0.838, h * 0.916);
    g.quadraticCurveTo(w * 0.822, h * 0.876, w * 0.856, h * 0.836);
    g.closePath();
    g.fill();
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = '#C9902F';
    g.fillRect(w * 0.848, h * 0.876, w * 0.076, h * 0.009);
    g.restore();
    g.restore();
    }
  }

  /* ---------- 人物 ---------- */

  var GUEST_COLOR = {
    woman: '#3F6E63', scholar: '#7A5C3E', kid: '#B4462F',
    elder: '#4A4458', rich: '#C9902F'
  };

  function drawFigure(g, o) {
    var s = o.s;
    var col = o.col || GUEST_COLOR[o.kind] || '#3F6E63';
    var walk = o.walk || 0;
    var bob = Math.abs(walk) * s * 0.030;
    var lean = walk * 0.030;
    var headR = s * 0.105;

    g.save();
    g.translate(o.x, o.y - bob);
    g.rotate(lean);

    g.save();
    g.globalAlpha = 0.16;
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(0, bob + s * 0.010, s * 0.28, s * 0.062, 0, 0, TAU);
    g.fill();
    g.restore();

    g.fillStyle = col;

    g.save();
    g.strokeStyle = col;
    g.lineWidth = s * 0.062;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-s * 0.070, -s * 0.30);
    g.lineTo(-s * 0.080 + walk * s * 0.070, -s * 0.015);
    g.moveTo(s * 0.070, -s * 0.30);
    g.lineTo(s * 0.080 - walk * s * 0.070, -s * 0.015);
    g.stroke();
    g.restore();

    g.beginPath();
    g.moveTo(-s * 0.125, -s * 0.74);
    g.lineTo(s * 0.125, -s * 0.74);
    g.lineTo(s * 0.195, -s * 0.24);
    g.lineTo(-s * 0.195, -s * 0.24);
    g.closePath();
    g.fill();

    g.beginPath();
    g.ellipse(0, -s * 0.720, s * 0.165, s * 0.078, 0, 0, TAU);
    g.fill();

    g.beginPath();
    g.arc(0, -s * 0.855, headR, 0, TAU);
    g.fill();

    if (o.kind === 'woman') {
      g.beginPath();
      g.arc(-headR * 0.62, -s * 0.940, headR * 0.56, 0, TAU);
      g.fill();
      g.save();
      g.strokeStyle = col;
      g.lineWidth = s * 0.026;
      g.beginPath();
      g.arc(s * 0.225, -s * 0.500, s * 0.095, -0.35, 2.55);
      g.stroke();
      g.restore();
    } else if (o.kind === 'scholar') {
      g.fillRect(-headR * 1.22, -s * 0.985, headR * 2.44, s * 0.050);
      g.save();
      g.globalAlpha = 0.9;
      g.fillStyle = PAPER;
      g.fillRect(s * 0.150, -s * 0.600, s * 0.070, s * 0.190);
      g.restore();
    } else if (o.kind === 'kid') {
      g.beginPath();
      g.arc(-headR * 1.00, -s * 0.950, headR * 0.46, 0, TAU);
      g.arc(headR * 1.00, -s * 0.950, headR * 0.46, 0, TAU);
      g.fill();
    } else if (o.kind === 'elder') {
      g.save();
      g.strokeStyle = col;
      g.lineWidth = s * 0.030;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(s * 0.250, -s * 0.620);
      g.lineTo(s * 0.290, 0);
      g.stroke();
      g.restore();
      g.beginPath();
      g.arc(headR * 0.34, -s * 0.895, headR * 0.62, 0, TAU);
      g.fill();
    } else if (o.kind === 'rich') {
      g.beginPath();
      g.ellipse(-s * 0.195, -s * 0.560, s * 0.080, s * 0.130, 0.18, 0, TAU);
      g.ellipse(s * 0.195, -s * 0.560, s * 0.080, s * 0.130, -0.18, 0, TAU);
      g.fill();
      g.save();
      g.strokeStyle = col;
      g.lineWidth = s * 0.024;
      g.beginPath();
      g.moveTo(s * 0.255, -s * 0.500);
      g.lineTo(s * 0.285, -s * 0.365);
      g.stroke();
      g.fillStyle = '#F2A93A';
      g.beginPath();
      g.arc(s * 0.285, -s * 0.320, s * 0.058, 0, TAU);
      g.fill();
      g.restore();
    }

    if (o.held && GOOD_ART[o.held]) {
      g.save();
      g.translate(-s * 0.185, -s * 0.520);
      g.fillStyle = '#C9902F';
      GOOD_ART[o.held](g, s * 0.40);
      g.restore();
    }

    g.restore();
  }

  /* ---------- 粒子 ---------- */

  function spawnSmoke() {
    if (S.parts.length > 20) return;
    S.parts.push({
      x: S.W * (0.12 + Math.random() * 0.76),
      y: S.H * (0.60 + Math.random() * 0.03),
      r: 3 + Math.random() * 5,
      vy: -(0.10 + Math.random() * 0.18),
      vx: (Math.random() - 0.5) * 0.09,
      life: 1
    });
  }

  function spawnLeaf() {
    if (S.parts.length > 26) return;
    S.parts.push({
      leaf: true,
      x: Math.random() * S.W,
      y: -20,
      r: 2.5 + Math.random() * 3.5,
      vy: 0.20 + Math.random() * 0.24,
      vx: -0.20 + Math.random() * 0.40,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 0.05,
      life: 1
    });
  }

  function drawParts(g) {
    var i, pt;
    for (i = 0; i < S.parts.length; i++) {
      pt = S.parts[i];
      g.save();
      if (pt.leaf) {
        g.globalAlpha = 0.55;
        g.translate(pt.x, pt.y);
        g.rotate(pt.rot);
        g.fillStyle = S.pal.leaf;
        g.beginPath();
        g.moveTo(0, -pt.r);
        g.quadraticCurveTo(pt.r * 0.9, 0, 0, pt.r);
        g.quadraticCurveTo(-pt.r * 0.9, 0, 0, -pt.r);
        g.fill();
      } else {
        g.globalAlpha = S.key === 'night' ? 0.045 : 0.20;
        g.fillStyle = '#FFFFFF';
        g.beginPath();
        g.arc(pt.x, pt.y, pt.r, 0, TAU);
        g.fill();
      }
      g.restore();
    }
  }

  function drawCoins(g) {
    var i;
    for (i = 0; i < S.coins.length; i++) {
      var c = S.coins[i];
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, c.life));
      g.translate(c.x, c.y);
      g.rotate(c.rot);
      g.fillStyle = '#C9902F';
      g.beginPath();
      g.arc(0, 0, c.r, 0, TAU);
      g.fill();
      g.fillStyle = S.pal.ground;
      g.fillRect(-c.r * 0.32, -c.r * 0.32, c.r * 0.64, c.r * 0.64);
      g.restore();
    }
  }

  /* ---------- 主循环 ---------- */

  function frame(ts) {
    S.raf = requestAnimationFrame(frame);
    var dt = S.last ? Math.min(64, ts - S.last) : 16;
    S.last = ts;
    if (!S.ready) return;
    S.t += dt;

    var g = S.g;
    if (!g) return;

    S.cmx += (S.mtx - S.cmx) * 0.05;
    S.cmy += (S.mty - S.cmy) * 0.05;

    var shx = 0, shy = 0;
    if (S.shakeT > 0) {
      S.shakeT -= dt;
      var amp = Math.max(0, S.shakeT) / 260 * 5;
      shx = (Math.random() - 0.5) * amp;
      shy = (Math.random() - 0.5) * amp;
    }
    if (S.popT > 0) S.popT = Math.max(0, S.popT - dt);

    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    g.clearRect(0, 0, S.W, S.H);
    g.save();
    g.translate(shx, shy);

    var i;
    for (i = 0; i < S.L.length; i++) {
      var L = S.L[i];
      var ox = -60 + S.cmx * L.depth * 34;
      var oy = S.cmy * L.depth * 16;
      g.drawImage(L.cv, ox, oy, L.w, L.h);
    }

    if (S.pal.lamp > 0) {
      for (i = 0; i < 6; i++) {
        var lx = S.W * (0.08 + i * 0.17);
        var ly = S.H * 0.545 + Math.sin(S.t * 0.0012 + i) * 2;
        g.save();
        g.globalAlpha = 0.13 * S.pal.lamp;
        g.fillStyle = '#FFC85C';
        g.beginPath();
        g.arc(lx, ly + S.H * 0.008, S.W * 0.055, 0, TAU);
        g.fill();
        g.globalAlpha = 0.92 * S.pal.lamp;
        g.beginPath();
        g.ellipse(lx, ly, S.W * 0.012, S.W * 0.016, 0, 0, TAU);
        g.fill();
        g.restore();
      }
    }

    for (i = 0; i < S.walkers.length; i++) {
      var wk = S.walkers[i];
      g.save();
      g.globalAlpha = 0.34;
      drawFigure(g, {
        x: wk.x, y: wk.y, s: wk.s, kind: wk.kind,
        walk: Math.sin(S.t * 0.006 + i) * 0.9,
        col: S.pal.crowd
      });
      g.restore();
    }

    drawStall(g);

    S.guests.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < S.guests.length; i++) {
      var gu = S.guests[i];
      gu.walk = gu.mode === 'walk' ? Math.sin(S.t * 0.011 + gu.ph) : 0;
      drawFigure(g, gu);
    }

    drawParts(g);
    drawCoins(g);
    g.restore();

    if (S.key === 'night') {
      g.save();
      g.globalAlpha = 0.08;
      g.fillStyle = '#1B1830';
      g.fillRect(0, 0, S.W, S.H);
      g.restore();
    }
  }

  /* ---------- 推进 ---------- */

  function step(dt) {
    var i, gu;
    for (i = 0; i < S.walkers.length; i++) {
      var wk = S.walkers[i];
      wk.x += wk.v * wk.dir * dt;
      if (wk.x > S.W + 80) wk.dir = -1;
      if (wk.x < -80) wk.dir = 1;
    }

    for (i = S.guests.length - 1; i >= 0; i--) {
      gu = S.guests[i];
      if (gu.mode === 'walk') {
        gu.x += gu.vx * dt;
        if (gu.x <= gu.tx) { gu.x = gu.tx; gu.mode = 'wait'; gu.wait = 2600; }
        if (gu.x > S.W + 140) S.guests.splice(i, 1);
      } else if (gu.mode === 'wait') {
        gu.wait -= dt;
        if (gu.wait <= 0) { gu.mode = 'leave'; gu.vx = 0.30; gu.held = null; }
      } else {
        gu.x += gu.vx * dt;
        if (gu.x > S.W + 140) S.guests.splice(i, 1);
      }
    }

    for (i = S.parts.length - 1; i >= 0; i--) {
      var pt = S.parts[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      if (pt.leaf) { pt.rot += pt.vr; pt.vy += 0.0015; }
      else { pt.r += 0.14; pt.vx += (Math.random() - 0.5) * 0.005; }
      if (pt.y < -50 || pt.y > S.H + 50) S.parts.splice(i, 1);
    }

    for (i = S.coins.length - 1; i >= 0; i--) {
      var c = S.coins[i];
      c.vy += 0.050;
      c.x += c.vx;
      c.y += c.vy;
      c.rot += 0.10;
      c.life -= 0.007;
      if (c.life <= 0) S.coins.splice(i, 1);
    }
  }

  var stepTimer = null;
  function startStep() {
    if (stepTimer) return;
    stepTimer = setInterval(function () { step(16); }, 16);
  }

  /* ---------- 对外 ---------- */

  function init(cv) {
    S.cv = cv;
    S.g = cv.getContext('2d');
    resize();
    window.addEventListener('resize', function () {
      clearTimeout(S.rszTimer);
      S.rszTimer = setTimeout(resize, 220);
    });
    window.addEventListener('pointermove', function (e) {
      S.mtx = e.clientX / S.W - 0.5;
      S.mty = e.clientY / S.H - 0.5;
    });
    if (!S.raf) S.raf = requestAnimationFrame(frame);
    startStep();
    setInterval(function () { if (S.scene !== 'intro') spawnSmoke(); }, 700);
    setInterval(function () { spawnLeaf(); }, 1700);
  }

  function resize() {
    if (!S.cv) return;
    var w = S.cv.clientWidth || window.innerWidth;
    var h = S.cv.clientHeight || window.innerHeight;
    S.dpr = Math.min(2, window.devicePixelRatio || 1);
    S.W = w;
    S.H = h;
    S.cv.width = Math.round(w * S.dpr);
    S.cv.height = Math.round(h * S.dpr);
    build();
  }

  function setTime(key) {
    if (!PAL[key]) return;
    S.key = key;
    S.pal = PAL[key];
    build();
  }

  function setScene(name) {
    S.scene = name;
    S.guests = [];
  }

  function setStock(stock) { S.stock = stock || {}; }
  function setSign(n) { S.sign = n || 0; }

  function addGuest(kind) {
    if (S.guests.length >= 4) return;
    var base = S.H * 0.105;
    var s = kind === 'kid' ? base * 0.70 : (kind === 'elder' ? base * 0.95 : base);
    S.guests.push({
      kind: kind,
      x: S.W + 80,
      y: S.groundY + S.H * 0.104 + Math.random() * S.H * 0.008,
      tx: S.W * (0.80 + Math.random() * 0.06),
      s: s,
      vx: -0.26,
      mode: 'walk',
      ph: Math.random() * TAU,
      wait: 0,
      held: null,
      walk: 0
    });
  }

  function buyHeld(kind, goodId) {
    var i;
    for (i = 0; i < S.guests.length; i++) {
      if (S.guests[i].kind === kind && S.guests[i].mode === 'wait') {
        S.guests[i].held = goodId;
        S.guests[i].mode = 'leave';
        S.guests[i].vx = 0.30;
        break;
      }
    }
  }

  function flyCoins(n) {
    var k;
    for (k = 0; k < (n || 3); k++) {
      S.coins.push({
        x: S.W * 0.5 + (Math.random() - 0.5) * S.W * 0.18,
        y: S.H * 0.60,
        vx: (Math.random() - 0.5) * 2.2,
        vy: -4.0 - Math.random() * 1.6,
        r: 5 + Math.random() * 3,
        rot: Math.random() * TAU,
        life: 1
      });
    }
    S.popT = 260;
  }

  function shake(ms) { S.shakeT = ms || 220; }

  window.StallArt = {
    init: init,
    setTime: setTime,
    setScene: setScene,
    setStock: setStock,
    setSign: setSign,
    addGuest: addGuest,
    buyHeld: buyHeld,
    flyCoins: flyCoins,
    shake: shake
  };
})();
