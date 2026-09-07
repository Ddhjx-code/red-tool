/* ============================================================
   后羿射日 · 渲染层 (window.HYScene)

   headless Matter 引擎 + 自写 Canvas 2D 渲染（不用 Matter.Render）。
   两条绘制模式，共用同一 SHAPES 包围盒基准：
     ① 程序化轮廓（默认）：逐凸块填色 -> 并集即碰撞轮廓，
        所有装饰细节 clip 到并集路径内 -> 「所见即所撞」零溢出。
     ② 素材图模式：assets/img/{jinwu,trunk,beam,arrow,rilun,houyi}.webp
        存在时按 plugin.box（建体时 angle=0 实测的 bbox 偏移）居中贴齐，
        图片尺寸 == 轮廓包围盒 -> 美术零改动替换，物理不受影响。
   ============================================================ */
(function () {
  'use strict';

  var D = window.HYData;
  var E = window.HYEngine;
  var C = D.C;
  var WORLD_W = D.WORLD_W, WORLD_H = D.WORLD_H, GROUND_Y = D.GROUND_Y;
  var ANCHOR = D.ANCHOR;

  var canvas = null, ctx = null;
  var ghostCanvas = null, ghostCtx = null;
  var dpr = 1, scale = 1, offX = 0, offY = 0;
  var stars = [];
  var skySuns = 10;                 // 天上余日（装饰，随战绩递减）
  var skySunPos = [[250, 92], [430, 150], [640, 78], [860, 132], [1080, 96], [1190, 190],
                   [160, 200], [540, 60], [980, 70], [720, 190]];

  /* ---------- 素材图接缝：有图用图，无图回落程序化轮廓 ---------- */
  var ART = {};
  ['jinwu', 'trunk', 'beam', 'arrow', 'rilun', 'houyi'].forEach(function (n) {
    var im = new Image();
    im.src = './assets/img/' + n + '.webp';
    ART[n] = im;
  });

  function art(name) {
    var im = ART[name];
    return (im && im.complete && im.naturalWidth > 0) ? im : null;
  }

  function artNameFor(b) {
    var p = b.plugin;
    if (p.kind === 'jinwu') return 'jinwu';
    if (p.kind === 'rilun') return 'rilun';
    if (p.kind === 'arrow') return 'arrow';
    if (p.shapeName && p.shapeName.indexOf('trunk') === 0) return 'trunk';
    if (p.shapeName && p.shapeName.indexOf('beam') === 0) return 'beam';
    return null;
  }

  /* 素材底色：填贴图透明空隙，避免轮廓内露出天空（碰撞仍生效） */
  function artBase(b) {
    var p = b.plugin;
    if (p.kind === 'rilun') return C.rilunCore;
    if (p.kind === 'jinwu') return C.jinwuBody;
    if (p.kind === 'arrow') return C.arrowShaft;
    if (p.wallType === 'bronze') return '#5A7A6E';
    if (p.wallType === 'glaze') return '#8BB8D0';
    if (p.wallType === 'vine') return '#4E6B3A';
    return C.bark;
  }

  /* 素材贴齐：先 clip 到碰撞轮廓并集 -> 垫底色 -> 贴图上叠。
     可见像素严格等于碰撞区域：贴图不会溢出到包围盒空白角（所见即所撞）。 */
  function drawArt(b) {
    var img = art(artNameFor(b));
    if (!img) return false;
    var box = b.plugin.box;
    if (!box) return false;
    ctx.save();
    unionPath(b);
    ctx.clip();
    ctx.fillStyle = artBase(b);
    var ps = b.parts, i;
    var start = ps.length > 1 ? 1 : 0;
    for (i = start; i < ps.length; i++) { partPath(ps[i]); ctx.fill(); }
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    ctx.drawImage(img, box.dx - box.w / 2, box.dy - box.h / 2, box.w, box.h);
    ctx.restore();
    return true;
  }

  function artMode() {
    return ['jinwu', 'trunk', 'beam', 'arrow', 'rilun'].filter(function (n) { return !!art(n); });
  }

  /* ==========================================================================
     初始化 / 视口
     ========================================================================== */
  function init(cv) {
    canvas = cv;
    ctx = cv.getContext('2d');
    ghostCanvas = document.createElement('canvas');
    ghostCtx = ghostCanvas.getContext('2d');
    resize();
  }

  function resize() {
    if (!canvas) return;
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    scale = Math.min(w / WORLD_W, h / WORLD_H);
    offX = (w - WORLD_W * scale) / 2;
    offY = (h - WORLD_H * scale) / 2;
    if (ghostCanvas) { ghostCanvas.width = WORLD_W; ghostCanvas.height = WORLD_H; }
    if (!stars.length) {
      for (var i = 0; i < 90; i++) {
        stars.push({ x: Math.random() * WORLD_W, y: Math.random() * 430, r: Math.random() * 1.5 + 0.3, a: 0.25 + Math.random() * 0.6 });
      }
    }
  }

  function view() {
    return {
      scale: scale, offX: offX, offY: offY, dpr: dpr,
      cssW: canvas ? canvas.width / dpr : 0, cssH: canvas ? canvas.height / dpr : 0,
      devW: canvas ? canvas.width : 0, devH: canvas ? canvas.height : 0,
      worldW: WORLD_W, worldH: WORLD_H
    };
  }

  function beginWorld() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.fillStyle = '#070D18';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.translate(offX, offY);
    ctx.scale(scale, scale);
  }

  /* ==========================================================================
     背景：汤谷夜色 · 十日并出 · 远山 · 焦土
     ========================================================================== */
  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, C.skyTop);
    g.addColorStop(0.52, C.skyMid);
    g.addColorStop(0.82, C.skyGlow);
    g.addColorStop(1, C.horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, GROUND_Y);

    ctx.save();
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = s.a * 0.85;
      ctx.fillStyle = '#DCE8FF';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    ctx.restore();

    // 天上余日（装饰，非碰撞）：随射日战绩递减
    var n = Math.max(1, Math.min(skySunPos.length, skySuns));
    for (var k = 0; k < n; k++) {
      var sx = skySunPos[k][0], sy = skySunPos[k][1];
      var rg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 46);
      rg.addColorStop(0, 'rgba(255,214,120,0.85)');
      rg.addColorStop(0.35, 'rgba(240,140,50,0.30)');
      rg.addColorStop(1, 'rgba(240,140,50,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(sx, sy, 46, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,226,150,0.72)';
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, 6.283); ctx.fill();
    }

    // 远山
    ctx.fillStyle = 'rgba(20,14,12,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    var pts = [[0, 600], [120, 540], [260, 588], [390, 512], [520, 574], [660, 528],
               [800, 586], [940, 536], [1080, 590], [1200, 548], [1280, 596]];
    for (var m = 0; m < pts.length; m++) ctx.lineTo(pts[m][0], pts[m][1]);
    ctx.lineTo(WORLD_W, GROUND_Y); ctx.closePath(); ctx.fill();

    // 地面
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
    ctx.fillStyle = C.groundTop;
    ctx.fillRect(0, GROUND_Y, WORLD_W, 3);
    ctx.fillStyle = 'rgba(122,58,34,0.22)';
    ctx.fillRect(0, GROUND_Y + 3, WORLD_W, 9);
  }

  /* ==========================================================================
     轮廓路径工具（所见即所撞的核心）
     ========================================================================== */
  function partPath(part) {
    var v = part.vertices;
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    for (var i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
  }

  /* 把全部凸块并进一条路径（用于 clip / 内描边）
     复合体 parts[0] 是聚合父体需跳过；单体（如 Bodies.circle）parts[0] 即自身，须从 0 起 */
  function unionPath(b) {
    var ps = b.parts, v, i, k;
    var start = ps.length > 1 ? 1 : 0;
    ctx.beginPath();
    for (i = start; i < ps.length; i++) {
      v = ps[i].vertices;
      ctx.moveTo(v[0].x, v[0].y);
      for (k = 1; k < v.length; k++) ctx.lineTo(v[k].x, v[k].y);
      ctx.closePath();
    }
  }

  function hurtRatio(b) {
    return 1 - Math.max(0, b.plugin.hp) / b.plugin.maxHp;
  }

  /* ==========================================================================
     实体绘制
     ========================================================================== */
  function drawBody(b) {
    var p = b.plugin;
    if (p.kind === 'jinwu' && b.circleRadius) { drawJinwu(b); return; }
    if (drawArt(b)) return;                       // 素材模式优先
    if (p.kind === 'rilun') { drawRilun(b); return; }
    if (p.kind === 'jinwu') { drawJinwu(b); return; }
    if (p.kind === 'arrow') { drawArrow(b); return; }
    if (p.kind === 'fusan') { drawFusan(b); return; }
  }

  /* ---- 扶桑枝干：逐凸块填色 + 细节全部 clip 在轮廓内 ---- */
  function drawFusan(b) {
    var parts = b.parts, i;
    var hurt = hurtRatio(b);
    var wt = b.plugin.wallType || 'fusan';
    var barkCol = { fusan: C.bark, bronze: '#5A7A6E', glaze: '#8BB8D0', vine: '#4E6B3A' }[wt] || C.bark;
    var edgeCol = { fusan: 'rgba(26,15,8,0.85)', bronze: 'rgba(20,40,36,0.85)', glaze: 'rgba(180,210,225,0.7)', vine: 'rgba(20,35,12,0.85)' }[wt] || 'rgba(26,15,8,0.85)';
    var barkStroke = { fusan: 'rgba(78,53,32,0.9)', bronze: 'rgba(30,50,44,0.7)', glaze: 'rgba(220,240,255,0.5)', vine: 'rgba(40,60,30,0.8)' }[wt] || 'rgba(78,53,32,0.9)';
    ctx.lineJoin = 'round';

    for (i = 1; i < parts.length; i++) {
      partPath(parts[i]);
      ctx.fillStyle = barkCol; ctx.fill();
    }

    ctx.save();
    unionPath(b);
    ctx.clip();

    // 受光面
    var bb = E.unionBounds(b);
    var horiz = (bb.max.x - bb.min.x) > (bb.max.y - bb.min.y);
    var lg = horiz
      ? ctx.createLinearGradient(0, bb.min.y, 0, bb.max.y)
      : ctx.createLinearGradient(bb.min.x, 0, bb.max.x, 0);
    if (wt === 'glaze') {
      lg.addColorStop(0, 'rgba(255,255,255,0.30)');
      lg.addColorStop(0.45, 'rgba(255,255,255,0.10)');
      lg.addColorStop(1, 'rgba(40,60,80,0.20)');
    } else if (wt === 'bronze') {
      lg.addColorStop(0, 'rgba(180,200,185,0.25)');
      lg.addColorStop(0.45, 'rgba(120,140,125,0.05)');
      lg.addColorStop(1, 'rgba(10,20,16,0.35)');
    } else if (wt === 'vine') {
      lg.addColorStop(0, 'rgba(120,180,80,0.20)');
      lg.addColorStop(0.45, 'rgba(80,120,50,0.05)');
      lg.addColorStop(1, 'rgba(10,20,8,0.30)');
    } else {
      lg.addColorStop(0, 'rgba(255,205,140,0.20)');
      lg.addColorStop(0.45, 'rgba(255,205,140,0.05)');
      lg.addColorStop(1, 'rgba(20,10,4,0.30)');
    }
    ctx.fillStyle = lg;
    ctx.fillRect(bb.min.x, bb.min.y, bb.max.x - bb.min.x, bb.max.y - bb.min.y);

    // 纹理
    ctx.strokeStyle = barkStroke;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (horiz) {
      for (var k = -1; k <= 1; k++) {
        ctx.moveTo(bb.min.x, b.position.y + k * 4.5);
        ctx.lineTo(bb.max.x, b.position.y + k * 4.5);
      }
    } else {
      for (var j = -1; j <= 1; j++) {
        ctx.moveTo(b.position.x + j * 4.5, bb.min.y);
        ctx.lineTo(b.position.x + j * 4.5, bb.max.y);
      }
    }
    ctx.stroke();

    if (b.plugin.burning) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = 'rgba(255,107,44,0.5)';
      ctx.fillRect(bb.min.x, bb.min.y, bb.max.x - bb.min.x, bb.max.y - bb.min.y);
      ctx.globalAlpha = 1;
    }

    // 苔痕（仅木墙和藤墙）
    if (wt === 'fusan' || wt === 'vine') {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = C.moss;
      for (i = 1; i < parts.length; i++) {
        var c = parts[i].position;
        ctx.beginPath(); ctx.arc(c.x, c.y, 3.2, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 裂纹随 HP
    if (hurt > 0.25) {
      ctx.globalAlpha = Math.min(0.75, hurt);
      ctx.strokeStyle = '#1B1109'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(b.position.x - 7, b.position.y - 6);
      ctx.lineTo(b.position.x + 2, b.position.y + 1);
      ctx.lineTo(b.position.x - 3, b.position.y + 8);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 内描边
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = edgeCol;
    unionPath(b);
    ctx.stroke();
    ctx.restore();
  }

  /* ---- 日轮：碰撞体是圆，视觉严格同半径 ---- */
  function drawRilun(b) {
    var r = b.circleRadius, x = b.position.x, y = b.position.y;
    var hurt = hurtRatio(b);

    // 外晕（装饰，不参与碰撞；碰撞判定只看圆本体）
    ctx.save();
    var halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.1);
    halo.addColorStop(0, 'rgba(245,197,66,0.28)');
    halo.addColorStop(1, 'rgba(245,197,66,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, 6.283); ctx.fill();
    ctx.restore();

    var g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
    g.addColorStop(0, '#FFE9A8');
    g.addColorStop(0.55, C.rilunRing);
    g.addColorStop(1, C.rilunCore);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283);
    ctx.fillStyle = g; ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.clip();   // 轮辐严格在圆内
    ctx.translate(x, y); ctx.rotate(b.angle);
    ctx.strokeStyle = 'rgba(255,240,188,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = i / 10 * 6.283;
      ctx.moveTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
      ctx.lineTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,80,10,0.5)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, 6.283); ctx.stroke();
    if (hurt > 0.2) {
      ctx.globalAlpha = Math.min(0.7, hurt);
      ctx.strokeStyle = '#5A2E06'; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(r * 0.1, r * 0.05);
      ctx.lineTo(-r * 0.15, r * 0.55);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(120,60,8,0.7)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, r - 0.8, 0, 6.283); ctx.stroke();
  }

  /* ---- 金乌（三足乌）：碰撞体=圆形，绘制=图片精灵（溢出碰撞体） ---- */
  function drawJinwu(b) {
    var img = art('jinwu');
    var box = b.plugin.visBox;
    var et = b.plugin.enemyType || 'jinwu';
    var tint = { jinwu: null, qingniao: 'rgba(58,143,183,0.35)', zhuque: 'rgba(192,48,40,0.3)', bifang: 'rgba(74,107,58,0.3)' }[et];
    if (img && box) {
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);
      ctx.drawImage(img, box.dx - box.w / 2, box.dy - box.h / 2, box.w, box.h);
      if (tint) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = tint;
        ctx.fillRect(box.dx - box.w / 2, box.dy - box.h / 2, box.w, box.h);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (b.plugin.burning) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,107,44,0.25)';
        ctx.fillRect(box.dx - box.w / 2, box.dy - box.h / 2, box.w, box.h);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (b.plugin.spare) {
        ctx.strokeStyle = 'rgba(255,231,150,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(box.dx, box.dy - 12, 7, 0, 6.283);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    var fb = { jinwu: C.jinwuBody, qingniao: '#3A8FB7', zhuque: '#C03028', bifang: '#4A6B3A' }[et] || C.jinwuBody;
    ctx.save();
    ctx.fillStyle = fb;
    ctx.beginPath();
    ctx.arc(b.position.x, b.position.y, b.circleRadius || 20, 0, 6.283);
    ctx.fill();
    ctx.restore();
  }

  /* ---- 素缯白箭：head / shaft / fletch 三凸块 ---- */
  function drawArrow(b) {
    var parts = b.parts, i;
    var at = b.plugin.arrowType || 'plain';
    var palettes = {
      plain:  [C.arrowHead, C.arrowShaft, C.arrowFletch],
      fire:   ['#FF8A4C', '#FFD86B', '#FF6B2C'],
      heavy:  ['#6B5A3A', '#8A6238', '#5A4A30'],
      split:  ['#4FD1E0', '#7FE8F0', '#3AAAB5'],
      pierce: ['#FFD86B', '#F2E0A0', '#D4A84B']
    };
    var cols = palettes[at] || palettes.plain;
    ctx.lineJoin = 'round';
    for (i = 1; i < parts.length; i++) {
      partPath(parts[i]);
      ctx.fillStyle = cols[i - 1] || cols[1]; ctx.fill();
    }
    ctx.save();
    unionPath(b);
    ctx.clip();
    ctx.strokeStyle = 'rgba(120,128,140,0.75)'; ctx.lineWidth = 1;
    var hp = parts[1].position;
    ctx.beginPath(); ctx.moveTo(hp.x - 3, hp.y); ctx.lineTo(hp.x + 3, hp.y); ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(90,96,108,0.6)';
    unionPath(b); ctx.stroke();
    ctx.restore();
    if (at === 'fire') {
      ctx.save();
      ctx.fillStyle = 'rgba(255,107,44,0.15)';
      unionPath(b); ctx.fill();
      ctx.restore();
    } else if (at === 'pierce' && b.plugin.pierceCount > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,216,107,0.6)'; ctx.lineWidth = 2;
      unionPath(b); ctx.stroke();
      ctx.restore();
    }
  }

  /* ==========================================================================
     彤弓 + 后羿 + 弓弦 + 轨迹
     ========================================================================== */
  function drawHouyi() {
    var img = art('houyi');
    if (img) {
      ctx.save();
      ctx.drawImage(img, ANCHOR.x - 133, ANCHOR.y - 44, 150, 176);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.fillStyle = 'rgba(12,10,14,0.78)';
    ctx.beginPath();
    ctx.ellipse(ANCHOR.x - 34, ANCHOR.y + 52, 15, 42, -0.06, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(ANCHOR.x - 38, ANCHOR.y - 2, 12, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(12,10,14,0.78)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ANCHOR.x - 30, ANCHOR.y + 12); ctx.lineTo(ANCHOR.x - 6, ANCHOR.y - 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(195,39,43,0.55)'; ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(ANCHOR.x - 44, ANCHOR.y + 18);
    ctx.quadraticCurveTo(ANCHOR.x - 74, ANCHOR.y + 30, ANCHOR.x - 86, ANCHOR.y + 62);
    ctx.stroke();
    ctx.restore();
  }

  function drawBow(S) {
    var hasImg = !!art('houyi');
    var R = 48, a0 = -Math.PI * 0.60, a1 = Math.PI * 0.60;
    var t0, t1;

    drawHouyi();

    var nockDist = Math.hypot(S.nock.x - ANCHOR.x, S.nock.y - ANCHOR.y);
    var showString = !hasImg || nockDist > 2;

    if (hasImg) {
      t0 = { x: ANCHOR.x + 16, y: ANCHOR.y - 42 };
      t1 = { x: ANCHOR.x - 17, y: ANCHOR.y + 41 };
    } else {
      t0 = { x: ANCHOR.x + Math.cos(a0) * R, y: ANCHOR.y + Math.sin(a0) * R };
      t1 = { x: ANCHOR.x + Math.cos(a1) * R, y: ANCHOR.y + Math.sin(a1) * R };
      ctx.save();
      ctx.strokeStyle = C.bowDark; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(ANCHOR.x, ANCHOR.y, R, a0, a1); ctx.stroke();
      ctx.strokeStyle = C.bow; ctx.lineWidth = 5.5;
      ctx.beginPath(); ctx.arc(ANCHOR.x, ANCHOR.y, R, a0, a1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,190,120,0.45)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(ANCHOR.x, ANCHOR.y, R - 2.6, a0 + 0.1, a1 - 0.1); ctx.stroke();
      ctx.restore();
    }

    if (showString) {
      ctx.save();
      ctx.strokeStyle = C.string; ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y); ctx.lineTo(S.nock.x, S.nock.y); ctx.lineTo(t1.x, t1.y);
      ctx.stroke();
      ctx.restore();
    }

    if (S.dragActive) {
      var v = E.launchVector();
      var k = Math.min(1, v.power / (D.MAX_PULL * D.POWER_SCALE));
      ctx.save();
      ctx.globalAlpha = 0.25 + k * 0.5;
      ctx.strokeStyle = C.traj; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(ANCHOR.x, ANCHOR.y, R + 8, a0, a1); ctx.stroke();
      ctx.restore();
    }
  }

  function drawTrajectory(S) {
    if (!S.previewPts.length) return;
    ctx.save();
    var n = S.previewPts.length;
    for (var i = 0; i < n; i++) {
      if (i % 3 !== 0) continue;
      var t = i / Math.max(1, n - 1);
      var r = 3.8 * (1 - t * 0.72) + 0.9;
      var a = 0.95 * (1 - t * 0.82) + 0.05;
      ctx.globalAlpha = a * 0.4;
      ctx.fillStyle = C.traj;
      ctx.beginPath(); ctx.arc(S.previewPts[i].x, S.previewPts[i].y, r * 2.1, 0, 6.283); ctx.fill();
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(S.previewPts[i].x, S.previewPts[i].y, r, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  /* 待发之箭：画在 nock，朝向 = 拖动矢量方向 */
  function drawNockedArrow(S) {
    if (!S.arrow || S.arrowInFlight) return;
    var v = E.launchVector();
    var ang = S.dragActive ? v.angle : 0;
    var img = art('arrow');
    var box = S.arrow.plugin.box;

    ctx.save();
    ctx.translate(ANCHOR.x, ANCHOR.y);
    ctx.rotate(ang);
    if (img && box) {
      ctx.drawImage(img, -box.w / 2, -box.h / 2, box.w, box.h);
      ctx.restore();
      return;
    }
    var ps = S.arrow.parts;
    ctx.lineJoin = 'round';
    var cols = [C.arrowHead, C.arrowShaft, C.arrowFletch];
    for (var i = 1; i < ps.length; i++) {
      var vts = ps[i].vertices;
      var cx = S.arrow.position.x, cy = S.arrow.position.y;
      ctx.beginPath();
      ctx.moveTo(vts[0].x - cx, vts[0].y - cy);
      for (var k = 1; k < vts.length; k++) ctx.lineTo(vts[k].x - cx, vts[k].y - cy);
      ctx.closePath();
      ctx.fillStyle = cols[i - 1] || C.arrowShaft; ctx.fill();
    }
    ctx.restore();
  }

  /* ==========================================================================
     粒子 / 冲击环
     ========================================================================== */
  function drawParticles(S) {
    var i, p;
    ctx.save();
    for (i = 0; i < S.particles.length; i++) {
      p = S.particles[i];
      var a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.c;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.feather) {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.7, p.r * 0.5, 0, 0, 6.283);
        ctx.fill();
      } else if (p.sq) {
        ctx.fillRect(-p.r, -p.r * 0.7, p.r * 2, p.r * 1.4);
      } else {
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.283); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.save();
    for (i = 0; i < S.rings.length; i++) {
      var rg = S.rings[i], t = rg.t / 26;
      ctx.globalAlpha = (1 - t) * (rg.big ? 0.8 : 0.5);
      ctx.strokeStyle = rg.big ? '#FFB054' : '#FFE9A8';
      ctx.lineWidth = rg.big ? 3.4 : 2;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r + t * (rg.big ? 62 : 26), 0, 6.283); ctx.stroke();
    }
    ctx.restore();
  }

  /* ==========================================================================
     调试层：碰撞多边形 + 矩形包围盒 + 幽灵碰撞区
     ========================================================================== */
  function drawDebug(S) {
    var bodies = S.birds.concat(S.blocks, S.suns);
    if (S.arrow) bodies.push(S.arrow);
    var i, b, j;

    ghostCtx.setTransform(1, 0, 0, 1, 0, 0);
    ghostCtx.clearRect(0, 0, WORLD_W, WORLD_H);
    ghostCtx.fillStyle = C.dbgGhost;
    for (i = 0; i < bodies.length; i++) {
      b = bodies[i];
      if (b.plugin.kind === 'rilun') continue;          // 圆本身无幽灵区
      var bb = E.unionBounds(b);
      ghostCtx.fillRect(bb.min.x, bb.min.y, bb.max.x - bb.min.x, bb.max.y - bb.min.y);
    }
    ghostCtx.globalCompositeOperation = 'destination-out';
    ghostCtx.fillStyle = '#000';
    for (i = 0; i < bodies.length; i++) {
      b = bodies[i];
      if (b.plugin.kind === 'rilun') continue;
      var ps = b.parts;
      for (j = 1; j < ps.length; j++) {
        var v = ps[j].vertices;
        ghostCtx.beginPath();
        ghostCtx.moveTo(v[0].x, v[0].y);
        for (var k = 1; k < v.length; k++) ghostCtx.lineTo(v[k].x, v[k].y);
        ghostCtx.closePath(); ghostCtx.fill();
      }
    }
    ghostCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(ghostCanvas, 0, 0);

    // 矩形包围盒（紫虚线）
    ctx.save();
    ctx.strokeStyle = C.dbgBox; ctx.lineWidth = 1.4; ctx.setLineDash([6, 5]);
    for (i = 0; i < bodies.length; i++) {
      var bx = E.unionBounds(bodies[i]);
      ctx.strokeRect(bx.min.x, bx.min.y, bx.max.x - bx.min.x, bx.max.y - bx.min.y);
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 真实碰撞多边形（青线）
    ctx.save();
    ctx.strokeStyle = C.dbgPoly; ctx.lineWidth = 1.6;
    for (i = 0; i < bodies.length; i++) {
      var pp = bodies[i].parts;
      for (j = 1; j < pp.length; j++) { partPath(pp[j]); ctx.stroke(); }
      if (bodies[i].circleRadius) {
        ctx.beginPath();
        ctx.arc(bodies[i].position.x, bodies[i].position.y, bodies[i].circleRadius, 0, 6.283);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawRangeOverlay(S) {
    if (S.mode !== 'range' || !S.rangeBird) return;
    ctx.save();
    ctx.fillStyle = 'rgba(240,194,74,0.9)';
    ctx.font = '700 22px "Kaiti SC","STKaiti",serif';
    ctx.textAlign = 'center';
    ctx.fillText('碰撞精度靶场 · 金乌悬空', 640, 96);
    ctx.font = '15px "Kaiti SC","STKaiti",serif';
    ctx.fillStyle = 'rgba(180,200,224,0.85)';
    ctx.fillText('紫雾 = 矩形包围盒会误判的「幽灵碰撞区」，轮廓碰撞体不会', 640, 122);
    ctx.restore();
  }

  /* ==========================================================================
     主渲染
     ========================================================================== */
  function render(S) {
    if (!ctx || !S) return;
    beginWorld();
    drawSky();
    var i, bodies = S.blocks.concat(S.suns, S.birds);
    for (i = 0; i < bodies.length; i++) drawBody(bodies[i]);
    if (S.arrow && S.arrowInFlight) drawBody(S.arrow);
    drawParticles(S);
    if (S.debugOn) drawDebug(S);
    drawRangeOverlay(S);
    if (S.mode === 'level') { drawBow(S); drawTrajectory(S); drawNockedArrow(S); }
    else if (S.arrow && !S.arrowInFlight) drawNockedArrow(S);
  }

  /* 采样渲染后的真实像素（一次 getImageData，避免逐点开销）。
     用来量化证明「画出来的轮廓 == 碰撞轮廓」（所见即所撞）。
     放入 file:// 素材图后画布会被跨源污染，getImageData 抛错 -> 全返回 null，
     不连带打断调用方（分享卡画在自己的画布上，不受污染影响）。 */
  function samplePixels(pts) {
    var img;
    try {
      img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch (e) {
      return pts.map(function () { return null; });
    }
    var out = [], i, dx, dy, o;
    for (i = 0; i < pts.length; i++) {
      dx = Math.round((pts[i][0] * scale + offX) * dpr);
      dy = Math.round((pts[i][1] * scale + offY) * dpr);
      if (dx < 0 || dy < 0 || dx >= canvas.width || dy >= canvas.height) { out.push(null); continue; }
      o = (dy * canvas.width + dx) * 4;
      out.push([img[o], img[o + 1], img[o + 2]]);
    }
    return out;
  }

  window.HYScene = {
    init: init,
    resize: resize,
    render: render,
    view: view,
    artMode: artMode,
    setSkySuns: function (n) { skySuns = Math.max(1, Math.min(D.SUNS_TOTAL, n | 0)); },
    skySuns: function () { return skySuns; },
    samplePixels: samplePixels,
    samplePixel: function (wx, wy) {
      var d = samplePixels([[wx, wy]])[0];
      return d ? { r: d[0], g: d[1], b: d[2] } : null;
    }
  };
})();
