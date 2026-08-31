(function () {
  var D = window.JQData;
  var canvas = null, ctx = null, W = 0, H = 0, dpr = 1;
  var PAD_X = 10, TOP = 92, BOTTOM = 150;
  var CELL = 0, FIELD_W = 0, FIELD_H = 0;
  var IMGS = {};
  ["tower-lichun", "tower-yushui", "tower-jingzhe", "tower-guyu", "tower-mangzhong", "tower-xiazhi", "tower-xiaoshu",
   "tower-liqiu", "tower-bailu", "tower-shuangjiang", "tower-lidong", "tower-daxue", "tower-dahan",
   "enemy-yachong", "enemy-ditouhu", "enemy-daochunhan", "enemy-huangchong", "enemy-hanba", "enemy-honglao",
   "enemy-yezhu", "enemy-qiuhuang", "enemy-zaoshuang", "enemy-hanxue", "enemy-daxueguai", "bg-field-v2"].forEach(function (n) {
    var im = new Image();
    im.src = "./assets/img/" + n + ".webp";
    IMGS[n] = im;
  });
  ["shot-lichun", "shot-yushui", "burst"].forEach(function (n) {
    var im = new Image();
    im.src = "./assets/img/" + n + ".png";
    IMGS[n] = im;
  });
  var TOWER_IMG = { lichun: "tower-lichun", yushui: "tower-yushui", jingzhe: "tower-jingzhe", guyu: "tower-guyu", mangzhong: "tower-mangzhong", xiazhi: "tower-xiazhi", xiaoshu: "tower-xiaoshu", liqiu: "tower-liqiu", bailu: "tower-bailu", shuangjiang: "tower-shuangjiang", lidong: "tower-lidong", daxue: "tower-daxue", dahan: "tower-dahan" };
  var ENEMY_IMG = { yachong: "enemy-yachong", ditouhu: "enemy-ditouhu", daochunhan: "enemy-daochunhan", huangchong: "enemy-huangchong", hanba: "enemy-hanba", honglao: "enemy-honglao", yezhu: "enemy-yezhu", qiuhuang: "enemy-qiuhuang", zaoshuang: "enemy-zaoshuang", hanxue: "enemy-hanxue", daxueguai: "enemy-daxueguai" };
  var FXI = {};
  ["spark1_green", "spark2_blue", "star1_gold", "star2_gold", "smoke1", "smoke2", "flame", "magic_gold", "circle", "slash"].forEach(function (n) {
    var im = new Image();
    im.src = "./assets/img/fx/" + n + ".png";
    FXI[n] = im;
  });
  var BG_GRASS = new Image(); BG_GRASS.src = "./assets/img/bg-grass.webp";
  var BG_DIRT = new Image(); BG_DIRT.src = "./assets/img/bg-dirt.webp";
  var particles = [];
  var lastPT = 0;

  function fxImg(n) {
    var im = FXI[n];
    return (im && im.complete && im.naturalWidth > 0) ? im : null;
  }

  function spawnP(img, x, y, vx, vy, life, size, rot, vr, fadePow) {
    particles.push({ img: img, x: x, y: y, vx: vx, vy: vy, t0: performance.now(), life: life, size: size, rot: rot || 0, vr: vr || 0, fadePow: fadePow || 1 });
  }

  function burstHit(x, y, kind) {
    var spark = kind === "slow" ? fxImg("spark2_blue") : fxImg("spark1_green");
    var star = fxImg("star1_gold");
    if (!spark && !star) return;
    for (var i = 0; i < 6; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 70;
      if (spark) spawnP(spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 380, 10 + Math.random() * 8, Math.random() * 6, 4, 1.4);
    }
    if (star) spawnP(star, x, y, 0, -20, 450, 16, 0, 2, 1);
  }

  function thunderFx(x, y) {
    var magic = fxImg("magic_gold");
    var spark = fxImg("star2_gold");
    if (magic) spawnP(magic, x, y, 0, 0, 320, 70, 0, 0, 2);
    if (spark) {
      for (var i = 0; i < 8; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 60 + Math.random() * 90;
        spawnP(spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 420, 12 + Math.random() * 8, Math.random() * 6, 6, 1.3);
      }
    }
  }

  function poofFx(x, y) {
    var s1 = fxImg("smoke1"), s2 = fxImg("smoke2");
    for (var i = 0; i < 5; i++) {
      var im = (i % 2 === 0 ? s1 : s2) || s1 || s2;
      if (!im) return;
      spawnP(im, x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 24, -22 - Math.random() * 20, 700 + Math.random() * 300,
        18 + Math.random() * 14, Math.random() * 6, 1.5, 1);
    }
  }

  function grainFx(x, y) {
    var star = fxImg("star1_gold") || fxImg("star2_gold");
    if (!star) return;
    for (var i = 0; i < 3; i++) {
      spawnP(star, x + (Math.random() - 0.5) * 14, y, (Math.random() - 0.5) * 12, -34 - Math.random() * 18, 650, 12 + Math.random() * 6, Math.random() * 6, 3, 1);
    }
  }

  function placeFx(x, y) {
    var c = fxImg("circle");
    if (!c) return;
    spawnP(c, x, y, 0, 0, 400, 40, 0, 0, 2);
  }

  function updateDrawParticles(t) {
    var dt = Math.min(0.05, (t - lastPT) / 1000 || 0.016);
    lastPT = t;
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      var age = (t - p.t0) / p.life;
      if (age >= 1) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      var alpha = Math.pow(1 - age, p.fadePow);
      var sz = p.size * (1 + age * 0.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.drawImage(p.img, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
  }

  function init(cv) {
    canvas = cv;
    ctx = cv.getContext("2d");
    resize();
  }

  function resize() {
    if (!canvas) return;
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    FIELD_W = W - PAD_X * 2;
    FIELD_H = H - TOP - BOTTOM;
    CELL = Math.min(FIELD_W / D.COLS, FIELD_H / D.ROWS);
    FIELD_W = CELL * D.COLS;
    FIELD_H = CELL * D.ROWS;
  }

  function cellXY(col, rowF) {
    return {
      x: PAD_X + (W - PAD_X * 2 - FIELD_W) / 2 + col * CELL,
      y: TOP + rowF * CELL
    };
  }

  function draw(S, t, ui) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    var ox = PAD_X + (W - PAD_X * 2 - FIELD_W) / 2;

    var bgImg = IMGS["bg-field-v2"];
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      // 全幅 cover 铺满，不留边框
      var iw = bgImg.naturalWidth, ih = bgImg.naturalHeight;
      var scale = Math.max(W / iw, H / ih);
      var dw = iw * scale, dh = ih * scale;
      ctx.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.fillStyle = "rgba(20,26,16,0.12)";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "#7ba05b";
      ctx.fillRect(0, 0, W, H);
    }

    // 水道车道（夏章）
    if (S.level.waterLane !== undefined) {
      var wl = S.level.waterLane;
      var wx0 = ox + wl * CELL;
      var wg = ctx.createLinearGradient(wx0, 0, wx0 + CELL, 0);
      wg.addColorStop(0, "rgba(90,160,200,0.55)");
      wg.addColorStop(0.5, "rgba(120,190,225,0.6)");
      wg.addColorStop(1, "rgba(90,160,200,0.55)");
      ctx.fillStyle = wg;
      ctx.fillRect(wx0 + 2, 0, CELL - 4, H);
      ctx.strokeStyle = "rgba(200,235,250,0.35)";
      ctx.lineWidth = 1.5;
      for (var wv = 0; wv < 6; wv++) {
        var wy = ((t / 30 + wv * H / 6) % H);
        ctx.beginPath();
        ctx.moveTo(wx0 + 8, wy);
        ctx.bezierCurveTo(wx0 + CELL * 0.35, wy - 4, wx0 + CELL * 0.65, wy + 4, wx0 + CELL - 8, wy);
        ctx.stroke();
      }
    }

    // 冰道车道（冬章）
    if (S.level.iceLane !== undefined) {
      var il = S.level.iceLane;
      var ix0 = ox + il * CELL;
      var ig = ctx.createLinearGradient(ix0, 0, ix0 + CELL, 0);
      ig.addColorStop(0, "rgba(190,220,240,0.5)");
      ig.addColorStop(0.5, "rgba(220,240,250,0.6)");
      ig.addColorStop(1, "rgba(190,220,240,0.5)");
      ctx.fillStyle = ig;
      ctx.fillRect(ix0 + 2, 0, CELL - 4, H);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      for (var iv = 0; iv < 5; iv++) {
        var iy = ((t / 40 + iv * H / 5) % H);
        ctx.beginPath();
        ctx.moveTo(ix0 + 8, iy);
        ctx.lineTo(ix0 + CELL * 0.4, iy - 6);
        ctx.moveTo(ix0 + CELL * 0.5, iy + 10);
        ctx.lineTo(ix0 + CELL - 8, iy + 4);
        ctx.stroke();
      }
    }

    drawGates(ox);
    drawGranary(ox, S);

    ctx.strokeStyle = "rgba(40,50,30,0.22)";
    ctx.lineWidth = 1.5;
    for (var c = 0; c <= D.COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * CELL, 0);
      ctx.lineTo(ox + c * CELL, H);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(40,50,30,0.1)";
    ctx.lineWidth = 1;
    for (var r = 0; r <= D.ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, TOP + r * CELL);
      ctx.lineTo(ox + FIELD_W, TOP + r * CELL);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(195,39,43,0.12)";
    ctx.fillRect(ox, TOP + FIELD_H - 4, FIELD_W, 4);

    if (ui.selected && ui.hoverCell) {
      ctx.fillStyle = "rgba(232,213,163,0.2)";
      ctx.fillRect(ox + ui.hoverCell.col * CELL, TOP + ui.hoverCell.row * CELL, CELL, CELL);
      ctx.strokeStyle = "rgba(232,213,163,0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + ui.hoverCell.col * CELL + 2, TOP + ui.hoverCell.row * CELL + 2, CELL - 4, CELL - 4);
    }

    for (var i = 0; i < S.towers.length; i++) {
      drawTower(S.towers[i], S, t);
    }
    for (var j = 0; j < S.enemies.length; j++) {
      drawEnemy(S.enemies[j], t);
    }
    for (var s = 0; s < S.shots.length; s++) {
      drawShot(S.shots[s]);
      if (S.shots[s].t > 0.88 && !S.shots[s].hitDone) {
        S.shots[s].hitDone = true;
        var hp1 = cellXY(S.shots[s].lane, S.shots[s].toY);
        burstHit(hp1.x + CELL / 2, hp1.y + CELL / 2, S.shots[s].kind);
      }
    }
    for (var fxI = 0; fxI < S.fx.length; fxI++) {
      var fxx = S.fx[fxI];
      if (fxx.pDone) continue;
      fxx.pDone = true;
      if (fxx.kind === "zap") {
        var zp2 = cellXY(fxx.lane, fxx.y);
        thunderFx(zp2.x + CELL / 2, zp2.y + CELL / 2);
      } else if (fxx.kind === "kill") {
        var kp = cellXY(fxx.lane, fxx.y);
        poofFx(kp.x + CELL / 2, kp.y + CELL / 2);
      } else if (fxx.kind === "grain") {
        var gx2 = fxx.lane !== undefined ? cellXY(fxx.lane, fxx.y || 0).x + CELL / 2 : fxx.x * W;
        var gy2 = fxx.lane !== undefined ? cellXY(fxx.lane, fxx.y || 0).y + CELL / 2 : fxx.y * H;
        grainFx(gx2, gy2);
      } else if (fxx.kind === "place") {
        var pp2 = cellXY(fxx.col, fxx.row);
        placeFx(pp2.x + CELL / 2, pp2.y + CELL / 2);
      } else if (fxx.kind === "burnp") {
        var bp = cellXY(fxx.lane, fxx.y);
        var fl = fxImg("flame");
        if (fl) spawnP(fl, bp.x + CELL / 2 + (Math.random() - 0.5) * 14, bp.y + CELL / 2, (Math.random() - 0.5) * 10, -30 - Math.random() * 16, 450, 10 + Math.random() * 7, Math.random() * 4, 3, 1.2);
      }
    }
    updateDrawParticles(t);
    drawFx(S, t);

    if (S.phase === "announce") {
      var wave = S.level.waves[S.waveIdx];
      if (wave) {
        var a = Math.min(1, (S.waveT + 3) / 0.8) * Math.min(1, (0 - S.waveT) / 0.5 + 1);
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.fillStyle = "rgba(10,14,8,0.55)";
        ctx.fillRect(0, H * 0.4, W, 64);
        ctx.fillStyle = "#e8d5a3";
        ctx.font = "20px 'Kaiti SC','STKaiti','KaiTi',serif";
        ctx.textAlign = "center";
        ctx.fillText(wave.banner, W / 2, H * 0.4 + 40);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawGates(ox) {
    for (var c = 0; c < D.COLS; c++) {
      var gx = ox + c * CELL + CELL / 2;
      var gy = TOP + 2;
      ctx.fillStyle = "rgba(30,26,18,0.85)";
      ctx.beginPath();
      ctx.ellipse(gx, gy + 4, CELL * 0.34, CELL * 0.22, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(10,8,6,0.9)";
      ctx.beginPath();
      ctx.ellipse(gx, gy + 5, CELL * 0.24, CELL * 0.14, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,70,40,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(gx, gy + 4, CELL * 0.34, CELL * 0.22, 0, Math.PI, 0);
      ctx.stroke();
    }
  }

  function drawGranary(ox, S) {
    var gy = TOP + FIELD_H;
    ctx.fillStyle = "rgba(90,66,38,0.95)";
    ctx.fillRect(ox, gy + 2, FIELD_W, 26);
    ctx.fillStyle = "#7a5a34";
    ctx.fillRect(ox, gy, FIELD_W, 5);
    for (var i = 0; i < D.canglin; i++) {
      var wx = ox + FIELD_W / 2 + (i - (D.canglin - 1) / 2) * 22;
      var alive = i < S.canglin;
      ctx.strokeStyle = alive ? "#e8c56a" : "rgba(120,110,90,0.4)";
      ctx.fillStyle = alive ? "#e8c56a" : "rgba(120,110,90,0.3)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(wx, gy + 22);
      ctx.lineTo(wx, gy + 10);
      ctx.stroke();
      for (var k2 = 0; k2 < 3; k2++) {
        ctx.beginPath();
        ctx.ellipse(wx - 3, gy + 12 + k2 * 3.4, 2.6, 1.5, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(wx + 3, gy + 12 + k2 * 3.4, 2.6, 1.5, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawTower(tw, S, t) {
    var tt = D.towers[tw.type];
    var p = cellXY(tw.col, tw.row);
    var cx = p.x + CELL / 2, cy = p.y + CELL / 2;
    var rad = CELL * 0.34;

    if (tw.frozen > 0) {
      ctx.fillStyle = "rgba(150,200,230,0.35)";
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 5, 0, Math.PI * 2);
      ctx.fill();
    }

    var img = IMGS[TOWER_IMG[tw.type]];
    if (img && img.complete && img.naturalWidth > 0) {
      var sz = CELL * 0.92;
      ctx.drawImage(img, cx - sz / 2, cy - sz / 2, sz, sz);
    } else {
      ctx.fillStyle = tt.color;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(245,240,230,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rad - 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = Math.round(CELL * 0.3) + "px 'Kaiti SC','STKaiti','KaiTi',serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tt.name, cx, cy + 1);
      ctx.textBaseline = "alphabetic";
    }

    if (tt.kind === "farm") {
      var pulse = (Math.sin(t / 300) + 1) / 2;
      ctx.strokeStyle = "rgba(232,213,163," + (0.2 + pulse * 0.3) + ")";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 4 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemy(e, t) {
    var et = D.enemies[e.type];
    var p = cellXY(e.lane, e.y);
    var cx = p.x + CELL / 2, cy = p.y + CELL / 2;
    var rad = CELL * et.r;

    if (et.flying) {
      cy += Math.sin(t / 220 + e.y * 3) * 4 - 6;
      ctx.fillStyle = "rgba(30,40,25,0.2)";
      ctx.beginPath();
      ctx.ellipse(cx, p.y + CELL / 2 + rad * 0.9, rad * 0.7, rad * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.burnT > 0) {
      ctx.fillStyle = "rgba(255,120,40," + (0.25 + 0.15 * Math.sin(t / 100)) + ")";
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 1.25, 0, Math.PI * 2);
      ctx.fill();
    }

    var img = IMGS[ENEMY_IMG[e.type]];
    if (img && img.complete && img.naturalWidth > 0) {
      var sz = CELL * 0.72;
      if (e.slowT > 0) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "rgba(120,180,216,0.3)";
        ctx.beginPath();
        ctx.arc(cx, cy, sz * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.drawImage(img, cx - sz / 2, cy - sz / 2, sz, sz);
      ctx.globalAlpha = 1;
    } else if (e.type === "yachong") {
      ctx.fillStyle = e.slowT > 0 ? "#6a8a5a" : "#8aa84a";
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad * 0.8, rad, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a4a2a";
      ctx.beginPath();
      ctx.arc(cx, cy - rad * 0.5, rad * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === "ditouhu") {
      ctx.fillStyle = e.slowT > 0 ? "#7a6a4a" : "#8a6a3a";
      for (var s = 0; s < 3; s++) {
        ctx.beginPath();
        ctx.arc(cx, cy - rad * 0.6 + s * rad * 0.6, rad * (0.75 - s * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#2a1a0a";
      ctx.beginPath();
      ctx.arc(cx - rad * 0.3, cy - rad * 0.7, 2, 0, Math.PI * 2);
      ctx.arc(cx + rad * 0.3, cy - rad * 0.7, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      var glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad * 2);
      glow.addColorStop(0, "rgba(180,220,240,0.5)");
      glow.addColorStop(1, "rgba(180,220,240,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c8e4f0";
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e8f4fa";
      ctx.lineWidth = 2;
      for (var k = 0; k < 6; k++) {
        var ang = k * Math.PI / 3 + t / 2000;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * rad * 1.4, cy + Math.sin(ang) * rad * 1.4);
        ctx.stroke();
      }
    }

    var bw = CELL * 0.6;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(cx - bw / 2, cy - rad - 8, bw, 4);
    ctx.fillStyle = e.hp / e.maxHp > 0.4 ? "#8ac060" : "#d06050";
    ctx.fillRect(cx - bw / 2, cy - rad - 8, bw * Math.max(0, e.hp / e.maxHp), 4);
  }

  function drawShot(sh) {
    var p1 = cellXY(sh.lane, sh.fromY);
    var p2 = cellXY(sh.lane, sh.toY);
    var x = p1.x + CELL / 2;
    var yFrom = p1.y + CELL / 2, yTo = p2.y + CELL / 2;
    var y = yFrom + (yTo - yFrom) * sh.t;
    var img = IMGS[sh.kind === "slow" ? "shot-yushui" : "shot-lichun"];
    if (img && img.complete && img.naturalWidth > 0) {
      for (var tr = 1; tr <= 3; tr++) {
        var ty = yFrom + (yTo - yFrom) * Math.max(0, sh.t - tr * 0.09);
        ctx.globalAlpha = 0.28 - tr * 0.08;
        var tsz = 16 - tr * 3;
        ctx.drawImage(img, x - tsz / 2, ty - tsz / 2, tsz, tsz);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(img, x - 11, y - 11, 22, 22);
    } else {
      ctx.fillStyle = sh.kind === "slow" ? "#7ab6d8" : "#b8d878";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (sh.t > 0.85) {
      var burst = IMGS["burst"];
      if (burst && burst.complete && burst.naturalWidth > 0) {
        ctx.globalAlpha = (sh.t - 0.85) / 0.15 * 0.8;
        ctx.drawImage(burst, x - 16, yTo - 16, 32, 32);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawFx(S, t) {
    for (var i = 0; i < S.fx.length; i++) {
      var f = S.fx[i];
      var age = (S.time - f.t0) / 1.2;
      if (age > 1) continue;
      if (f.kind === "grain" || f.kind === "kill") {
        var gx = f.lane !== undefined ? cellXY(f.lane, f.y || 0).x + CELL / 2 : f.x * W;
        var gy = f.lane !== undefined ? cellXY(f.lane, f.y || 0).y : f.y * H;
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = "#e8d5a3";
        ctx.font = "bold 14px 'Kaiti SC','STKaiti','KaiTi',serif";
        ctx.textAlign = "center";
        ctx.fillText(f.text, gx, gy - age * 24);
        ctx.globalAlpha = 1;
      } else if (f.kind === "thunder") {
        var tp = cellXY(f.col, f.row);
        var tcx = tp.x + CELL / 2, tcy = tp.y + CELL / 2;
        ctx.globalAlpha = (1 - age) * 0.8;
        ctx.strokeStyle = "#f0d060";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tcx, tcy - CELL * 1.5);
        ctx.lineTo(tcx - 8, tcy - CELL * 0.5);
        ctx.lineTo(tcx + 6, tcy - CELL * 0.3);
        ctx.lineTo(tcx - 4, tcy + CELL * 0.4);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.kind === "zap") {
        var zp = cellXY(f.lane, f.y);
        ctx.globalAlpha = (1 - age) * 0.9;
        ctx.fillStyle = "#f0d060";
        ctx.beginPath();
        ctx.arc(zp.x + CELL / 2, zp.y + CELL / 2, CELL * 0.3 * (1 + age), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.kind === "freeze") {
        var fp = cellXY(f.col, f.row);
        ctx.globalAlpha = (1 - age) * 0.6;
        ctx.fillStyle = "#a0d0e8";
        ctx.fillRect(fp.x, fp.y, CELL, CELL);
        ctx.globalAlpha = 1;
      } else if (f.kind === "leak") {
        var lp = cellXY(f.lane, D.ROWS);
        ctx.globalAlpha = (1 - age);
        ctx.fillStyle = "#c3272b";
        ctx.font = "bold 18px 'Kaiti SC','STKaiti','KaiTi',serif";
        ctx.textAlign = "center";
        ctx.fillText("仓廪 -1", lp.x + CELL / 2, lp.y - age * 20);
        ctx.globalAlpha = 1;
      } else if (f.kind === "place") {
        var pp = cellXY(f.col, f.row);
        ctx.globalAlpha = (1 - age) * 0.5;
        ctx.strokeStyle = "#e8d5a3";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pp.x + CELL / 2, pp.y + CELL / 2, CELL * (0.3 + age * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  window.JQScene = {
    init: init,
    resize: resize,
    draw: draw,
    cellFromPoint: function (x, y) {
      var ox = PAD_X + (W - PAD_X * 2 - FIELD_W) / 2;
      var col = Math.floor((x - ox) / CELL);
      var row = Math.floor((y - TOP) / CELL);
      if (col < 0 || col >= D.COLS || row < 0 || row >= D.ROWS) return null;
      return { col: col, row: row };
    },
    metrics: function () { return { TOP: TOP, CELL: CELL }; }
  };
})();
