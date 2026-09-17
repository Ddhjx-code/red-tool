(function () {
  var D = window.WHData;
  var HUE = D.HUES;
  var C = window.WHChain;

  var BODY = { outer: "#a8342a", core: "#FFD98A", ink: "#12100E", ember: "#FF8A3D" };
  var CLIP_FILE = { head: "dragon-head-whisker.webp", tail: "dragon-tail2.webp",
                    claw: "dragon-claw2.webp", man: "man-dancer.webp",
                    manWalk: "man-walk.webp", manJump: "man-jump.webp",
                    manThrust: "man-thrust.webp",
                    ghost: "foe-ghost.webp", miasma: "foe-miasma.webp",
                    fxhit: "fx-hit.webp", boss: "foe-boss.webp",
                    altar: "prop-altar.webp", drum: "prop-drum.webp",
                    banner: "prop-banner.webp", kid: "prop-lantern-kid.webp" };
  var MAN = { ink: "#1c1219", robe: "#ece3d0", skin: "#e8c9a0",
              pole: "#b8863c", steel: "#cfd4dc" };

  var canvas = null;
  var ctx = null;
  var offscreen = null;
  var IMG = { head: null, tail: null, claw: null };
  var raf = 0;
  var last = 0;
  var acc = 0;
  var time = 0;
  var steps = 0;
  var probeT = 0;
  var tipTrail = [];
  var fxList = [];
  var zoomNow = 1;
  var frameErr = false;
  var teachHint = null;
  var hurtFlash = 0;
  var bossLastHits = -1;
  var bossReactT = 0;
  var bossTelegraphT = 0;
  var shakeT = 0;
  var lashT = 0;
  var lashPts = [];
  var pops = [];
  var test = location.search.indexOf("test=1") >= 0;
  var clipName = "";
  var clipT = 0;
  var clipLast = -1;

  function animPose(s, thrust, moving, fallback) {
    var name = thrust ? "thrust"
             : (s.player.onGround ? (moving ? "walk" : "idle") : "jump");
    var f;
    if (name !== clipName || s.t < clipLast) { clipT = 0; clipName = name; }
    else { clipT += s.t - clipLast; }
    clipLast = s.t;
    if (name === "thrust") { clipT = D.ACT.THRUST_CD - s.thrustCd; }
    if (!window.WHAnim || !window.WHAnim.ready(name)) { return fallback; }
    f = window.WHAnim.frameAt(name, clipT);
    return f || fallback;
  }

  function loadAssets() {
    var keys = ["head", "tail", "claw", "man", "manWalk", "manJump", "manThrust",
                "ghost", "miasma", "fxhit", "boss", "altar", "drum", "banner", "kid"];
    var i;
    for (i = 0; i < keys.length; i++) {
      (function (k) {
        var im = new Image();
        im.onload = function () { IMG[k] = im; };
        im.src = "./assets/img/" + CLIP_FILE[k];
      })(keys[i]);
    }
    if (window.WHAnim) { window.WHAnim.load(); }
  }

  function normalAt(segs, i) {
    var a = segs[i].angle;
    var nx = -Math.sin(a);
    var ny = Math.cos(a);
    if (ny < 0) { nx = -nx; ny = -ny; }
    return { x: nx, y: ny };
  }

  function widthAt(i) { return C.halfWidth(i); }

  function outline(segs) {
    var n = segs.length;
    var i;
    var w;
    var nm;
    var Lp = [];
    var Rp = [];
    for (i = 0; i < n; i++) {
      w = widthAt(i);
      nm = normalAt(segs, i);
      Lp.push({ x: segs[i].x + nm.x * w, y: segs[i].y + nm.y * w });
      Rp.push({ x: segs[i].x - nm.x * w, y: segs[i].y - nm.y * w });
    }
    return { L: Lp, R: Rp };
  }

  function finWave(i) {
    return 0.13 + 0.22 * (0.5 + 0.5 * Math.sin(i * 0.60));
  }

  function pushTrail() {
    var s = window.WHGame.snapshot();
    var b = window.WHGame.bounds(s.room);
    var tip = window.WHPlayer.poleTip(s.thrustCd > D.ACT.THRUST_CD * 0.5);
    tipTrail.push({ x: b.x0 + tip.x, y: tip.y });
    if (tipTrail.length > 30) { tipTrail.shift(); }
  }

  function drawTrail() {
    var n = tipTrail.length;
    var i;
    var t;
    var w;
    var a;
    var b;
    var dx;
    var dy;
    var m;
    var nx;
    var ny;
    var g;
    var p0;
    var p1;
    var plen = 0;
    if (n < 5) { return; }
    p0 = tipTrail[0];
    p1 = tipTrail[n - 1];
    for (i = 1; i < n; i++) {
      dx = tipTrail[i].x - tipTrail[i - 1].x;
      dy = tipTrail[i].y - tipTrail[i - 1].y;
      plen += Math.sqrt(dx * dx + dy * dy);
    }
    if (plen < 0.5) { return; }

    g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    g.addColorStop(0, "rgba(255,116,26,0)");
    g.addColorStop(0.6, "rgba(255,138,48,0.16)");
    g.addColorStop(1, "rgba(255,176,74,0.46)");

    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      t = i / (n - 1);
      w = 0.09 + 0.27 * t;
      a = tipTrail[i > 0 ? i - 1 : 0];
      b = tipTrail[i < n - 1 ? i + 1 : n - 1];
      dx = b.x - a.x;
      dy = b.y - a.y;
      m = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / m;
      ny = dx / m;
      if (i === 0) { ctx.moveTo(tipTrail[i].x + nx * w, tipTrail[i].y + ny * w); }
      else { ctx.lineTo(tipTrail[i].x + nx * w, tipTrail[i].y + ny * w); }
    }
    for (i = n - 1; i >= 0; i--) {
      t = i / (n - 1);
      w = 0.09 + 0.27 * t;
      a = tipTrail[i > 0 ? i - 1 : 0];
      b = tipTrail[i < n - 1 ? i + 1 : n - 1];
      dx = b.x - a.x;
      dy = b.y - a.y;
      m = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / m;
      ny = dx / m;
      ctx.lineTo(tipTrail[i].x - nx * w, tipTrail[i].y - ny * w);
    }
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  function pushFx(x, y, sc) {
    fxList.push({ x: x, y: y, t: 0, sc: sc || 1 });
    if (fxList.length > 12) { fxList.shift(); }
  }

  function tickFx(dt) {
    var i;
    for (i = fxList.length - 1; i >= 0; i--) {
      fxList[i].t += dt;
      if (fxList[i].t > 0.30) { fxList.splice(i, 1); }
    }
  }

  function drawLash() {
    var n = lashPts.length;
    var i;
    var t;
    var a;
    var b;
    var dx;
    var dy;
    var m;
    if (lashT <= 0 || n < 4) { return; }
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.globalAlpha = 0.24 * lashT;
    ctx.strokeStyle = "#ff8a3d";
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(lashPts[0].x, lashPts[0].y);
    for (i = 1; i < n; i++) { ctx.lineTo(lashPts[i].x, lashPts[i].y); }
    ctx.stroke();

    for (i = 1; i < n; i++) {
      t = i / (n - 1);
      ctx.globalAlpha = 0.85 * lashT * (0.28 + 0.72 * t);
      ctx.strokeStyle = "#fff2cf";
      ctx.lineWidth = 0.18 + 0.36 * t;
      ctx.beginPath();
      ctx.moveTo(lashPts[i - 1].x, lashPts[i - 1].y);
      ctx.lineTo(lashPts[i].x, lashPts[i].y);
      ctx.stroke();
    }

    for (i = 3; i < n - 1; i += 4) {
      t = i / (n - 1);
      a = lashPts[i - 1];
      b = lashPts[i + 1];
      dx = b.x - a.x;
      dy = b.y - a.y;
      m = Math.sqrt(dx * dx + dy * dy) || 1;
      ctx.globalAlpha = 0.50 * lashT * (1 - t * 0.5);
      ctx.strokeStyle = "#ffd98a";
      ctx.lineWidth = 0.10;
      ctx.beginPath();
      ctx.moveTo(lashPts[i].x, lashPts[i].y);
      ctx.lineTo(lashPts[i].x - (dy / m) * 1.5, lashPts[i].y + (dx / m) * 1.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function drawFx() {
    var i;
    var f;
    var k;
    var w;
    var h;
    var im = IMG.fxhit;
    if (!im) { return; }
    for (i = 0; i < fxList.length; i++) {
      f = fxList[i];
      k = Math.min(1, f.t / 0.28);
      w = 3.4 * f.sc * (1 + 0.65 * k);
      h = w * (im.height / im.width);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.95 * (1 - k);
      drawSprite(im, f.x, f.y - h * 0.5, w, h, 1);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawGroundGlow(segs) {
    var i;
    var n = segs.length;
    var t;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = BODY.ember;
    for (i = 0; i < n; i += 2) {
      t = i / (n - 1);
      ctx.globalAlpha = 0.085 * (1 - t * 0.7);
      ctx.beginPath();
      ctx.ellipse(segs[i].x, -0.45 - t * 2.6, 2.1 - t * 0.9, 0.46 - t * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  function drawPearls() {
    var h = C.head();
    var i;
    var k;
    var ph;
    var px2;
    var py2;
    var r = 0.60;
    var g;
    var a;
    var rr;
    var holder;
    for (i = 0; i < 2; i++) {
      ph = time * 1.7 + i * 2.2;
      px2 = h.x + 4.9 + i * 2.2 + 0.45 * Math.sin(ph * 0.7);
      py2 = h.y + 1.0 - i * 1.5 + 0.55 * Math.sin(ph);
      holder = Math.max(0, py2 - 2.2);

      ctx.lineCap = "round";
      ctx.strokeStyle = MAN.pole;
      ctx.lineWidth = 0.15;
      ctx.beginPath();
      ctx.moveTo(px2, holder + 0.45);
      ctx.lineTo(px2, py2 - r * 0.65);
      ctx.stroke();

      ctx.fillStyle = MAN.ink;
      ctx.beginPath();
      ctx.moveTo(px2 - 0.32, 0);
      ctx.lineTo(px2 + 0.32, 0);
      ctx.lineTo(px2 + 0.24, holder + 0.62);
      ctx.lineTo(px2 - 0.24, holder + 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8a4a26";
      ctx.beginPath();
      ctx.moveTo(px2 - 0.27, 0.28);
      ctx.lineTo(px2 + 0.27, 0.28);
      ctx.lineTo(px2 + 0.21, holder + 0.46);
      ctx.lineTo(px2 - 0.21, holder + 0.46);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = MAN.skin;
      ctx.beginPath();
      ctx.arc(px2, holder + 0.86, 0.21, 0, Math.PI * 2);
      ctx.fill();

      g = ctx.createRadialGradient(px2, py2, 0, px2, py2, r * 4.4);
      g.addColorStop(0, "rgba(255,128,38,0.50)");
      g.addColorStop(0.42, "rgba(255,120,40,0.16)");
      g.addColorStop(1, "rgba(255,110,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px2, py2, r * 4.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#6a4420";
      ctx.beginPath();
      ctx.arc(px2, py2, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff0c4";
      for (k = 0; k < 14; k++) {
        a = k * 0.4488 + time * 1.5;
        rr = r * (0.30 + 0.66 * ((k % 4) / 4));
        ctx.beginPath();
        ctx.arc(px2 + Math.cos(a) * rr, py2 + Math.sin(a) * rr * 0.92, 0.095, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawTroupe() {
    var segs = C.segments();
    var at = [8, 14, 20, 26];
    var k;
    var i;
    var nm;
    var w;
    var bx;
    var by;
    var hgt;
    for (k = 0; k < at.length; k++) {
      i = at[k];
      nm = normalAt(segs, i);
      w = widthAt(i);
      bx = segs[i].x - nm.x * w * 0.85;
      by = segs[i].y - nm.y * w * 0.85;
      if (by < 2.2) { continue; }
      hgt = by - 1.7;

      ctx.lineCap = "round";
      ctx.strokeStyle = MAN.pole;
      ctx.lineWidth = 0.13;
      ctx.beginPath();
      ctx.moveTo(bx, hgt + 0.30);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.fillStyle = MAN.ink;
      ctx.beginPath();
      ctx.moveTo(bx - 0.34, 0);
      ctx.lineTo(bx + 0.34, 0);
      ctx.lineTo(bx + 0.26, hgt + 0.55);
      ctx.lineTo(bx - 0.26, hgt + 0.55);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#8a4a26";
      ctx.beginPath();
      ctx.moveTo(bx - 0.29, 0.30);
      ctx.lineTo(bx + 0.29, 0.30);
      ctx.lineTo(bx + 0.23, hgt + 0.38);
      ctx.lineTo(bx - 0.23, hgt + 0.38);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = MAN.skin;
      ctx.beginPath();
      ctx.arc(bx, hgt + 0.78, 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, hgt + 0.18, 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBody(segs) {
    var n = segs.length;
    var o = outline(segs);
    var Lp = o.L;
    var Rp = o.R;
    var i;
    var nm;
    var fw;
    var w1;
    var mx;
    var my;

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(Lp[0].x, Lp[0].y);
    for (i = 1; i < n; i++) {
      nm = normalAt(segs, i);
      fw = finWave(i);
      mx = (Lp[i - 1].x + Lp[i].x) / 2;
      my = (Lp[i - 1].y + Lp[i].y) / 2;
      ctx.lineTo(mx + nm.x * fw, my + nm.y * fw);
      ctx.lineTo(Lp[i].x, Lp[i].y);
    }
    for (i = n - 1; i >= 0; i--) { ctx.lineTo(Rp[i].x, Rp[i].y); }
    ctx.closePath();
    ctx.fillStyle = BODY.outer;
    ctx.fill();
    ctx.strokeStyle = BODY.ink;
    ctx.lineWidth = 0.062;
    ctx.lineJoin = "round";
    ctx.stroke();

    for (i = 2; i < n - 2; i++) {
      nm = normalAt(segs, i);
      w1 = widthAt(i);
      var ta = segs[i].angle;
      var dxu = Math.cos(ta);
      var dyu = Math.sin(ta);
      var k2;
      var f2;

      for (k2 = 0; k2 < 3; k2++) {
        f2 = -0.72 + k2 * 0.72;
        ctx.strokeStyle = (k2 === 1) ? "#f2dba4" : "#c19a5c";
        ctx.globalAlpha = 0.32;
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.moveTo(segs[i].x + nm.x * w1 * 0.92 + dxu * f2 * w1,
                   segs[i].y + nm.y * w1 * 0.92 + dyu * f2 * w1);
        ctx.lineTo(segs[i].x - nm.x * w1 * 0.92 + dxu * (f2 + 0.52) * w1,
                   segs[i].y - nm.y * w1 * 0.92 + dyu * (f2 + 0.52) * w1);
        ctx.stroke();
      }

      if (i % 2 === 0) {
        ctx.strokeStyle = BODY.ink;
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 0.095;
        ctx.beginPath();
        ctx.moveTo(segs[i].x + nm.x * w1 * 0.98, segs[i].y + nm.y * w1 * 0.98);
        ctx.lineTo(segs[i].x - nm.x * w1 * 0.98, segs[i].y - nm.y * w1 * 0.98);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    ctx.lineCap = "round";
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = BODY.ember;
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    ctx.moveTo(segs[0].x, segs[0].y);
    for (i = 1; i < n; i++) { ctx.lineTo(segs[i].x, segs[i].y); }
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = BODY.core;
    ctx.lineWidth = 0.17;
    ctx.beginPath();
    ctx.moveTo(segs[0].x, segs[0].y);
    for (i = 1; i < n; i++) { ctx.lineTo(segs[i].x, segs[i].y); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawIncenseHeads(segs) {
    var n = segs.length;
    var i;
    var w;
    var nm;
    var stick;
    var bx;
    var by;
    var tx;
    var ty;
    var r;
    for (i = 3; i < n - 3; i += 3) {
      w = widthAt(i);
      nm = normalAt(segs, i);
      stick = 0.38 + 0.16 * Math.abs(Math.sin(i * 0.93));
      bx = segs[i].x + nm.x * w * 0.88;
      by = segs[i].y + nm.y * w * 0.88;
      tx = bx + nm.x * stick;
      ty = by + nm.y * stick;

      ctx.strokeStyle = BODY.ink;
      ctx.lineWidth = 0.055;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      r = 0.072 + 0.034 * Math.abs(Math.cos(i * 0.71));
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = BODY.ember;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.arc(tx, ty, r * 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.34;
      ctx.beginPath();
      ctx.arc(tx, ty, r * 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFF3D6";
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.arc(tx, ty, r * 0.78, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
  }

  function emitPoints(segs) {
    var o = outline(segs);
    var out = [];
    var i;
    for (i = 2; i < segs.length - 1; i += 2) {
      out.push(o.L[i]);
      if (i % 4 === 0) { out.push(o.R[i]); }
    }
    return out;
  }

  function screenOf(m, wx, wy) {
    return { x: (wx - m.camX) * m.px, y: m.groundY - wy * m.px };
  }

  var bloomCv = null;
  var bloomCtx = null;
  var bloomOk = true;

  function drawBloom(W, H) {
    var bw;
    var bh;
    var d;
    var v;
    var i;
    if (!bloomOk) { return; }
    bw = Math.max(8, Math.round(W / 6));
    bh = Math.max(8, Math.round(H / 6));
    if (!bloomCv) {
      bloomCv = document.createElement("canvas");
      bloomCtx = bloomCv.getContext("2d");
    }
    if (bloomCv.width !== bw || bloomCv.height !== bh) {
      bloomCv.width = bw;
      bloomCv.height = bh;
    }
    bloomCtx.clearRect(0, 0, bw, bh);
    bloomCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, bw, bh);
    try {
      d = bloomCtx.getImageData(0, 0, bw, bh);
    } catch (e) {
      bloomOk = false;
      return;
    }
    v = d.data;
    for (i = 0; i < v.length; i += 4) {
      if (v[i] + v[i + 1] + v[i + 2] < 310) {
        v[i] = 0;
        v[i + 1] = 0;
        v[i + 2] = 0;
        v[i + 3] = 0;
      }
    }
    bloomCtx.putImageData(d, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.40;
    ctx.drawImage(bloomCv, 0, 0, bw, bh, 0, 0, W, H);
    ctx.restore();
  }

  function drawPlayer(m, s) {
    var b = window.WHGame.bounds(s.room);
    var x = b.x0 + s.player.x;
    var y = s.player.y;
    var f = s.player.facing;
    var P = D.POLE;
    var thrust = s.thrustCd > D.ACT.THRUST_CD * 0.5 && !(s.windup > 0);
    var tip = window.WHPlayer.poleTip(thrust);
    var tipLX = tip.x - s.player.x;
    var tipLY = tip.y - y;
    var hipY = 1.9;
    var moving = Math.abs(s.player.vx) > 0.1;
    var bob = moving ? 0.32 * Math.abs(Math.sin(time * 9.0)) : 0;
    var lean = moving ? 0.24 : 0.11;
    var mh = 4.5;
    var mw = 4.5;
    var aw;
    var ah;
    var pose;

    ctx.save();
    ctx.translate(x, y);

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#02060a";
    ctx.beginPath();
    ctx.ellipse(0, 0.05, 1.45, 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = BODY.ember;
    ctx.beginPath();
    ctx.ellipse(0, 0.10, 1.15, 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.ellipse(0, 0.10, 2.05, 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(0, bob);
    ctx.rotate(-f * lean);
    pose = IMG.man;
    if (!s.player.onGround && IMG.manJump) { pose = IMG.manJump; }
    else if (thrust && IMG.manThrust) { pose = IMG.manThrust; }
    else if (moving && IMG.manWalk) { pose = IMG.manWalk; }
    pose = animPose(s, thrust, moving, pose);
    if (pose) {
      mh = 5.4;
      aw = pose.img ? (pose.sw || pose.img.width) : pose.width;
      ah = pose.img ? (pose.sh || pose.img.height) : pose.height;
      mw = mh * (aw / ah);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = BODY.ember;
      ctx.beginPath();
      ctx.ellipse(0, mh * 0.52, mw * 0.62, mh * 0.60, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (pose.sw) { drawFrame(pose, 0, 0, mw, mh, f); }
      else if (pose.img) { drawSprite(pose.img, 0, 0, mw, mh, f); }
      else { drawSprite(pose, 0, 0, mw, mh, f); }
    }
    ctx.restore();

    ctx.save();
    ctx.lineCap = "round";

    var pdx = tipLX - f * 0.35;
    var pdy = tipLY - hipY;
    var plen = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
    var ux = pdx / plen;
    var uy = pdy / plen;
    var nx = -uy;
    var ny = ux;
    var k;
    var t;
    var bx2;
    var by2;
    var gg;
    var shX = f * 0.40;
    var shY = 2.94;
    var hand1X = f * 0.35 + ux * 0.11 * plen;
    var hand1Y = hipY + uy * 0.11 * plen;
    var hand2X = f * 0.35 + ux * 0.30 * plen;
    var hand2Y = hipY + uy * 0.30 * plen;

    ctx.strokeStyle = MAN.ink;
    ctx.lineWidth = 0.48;
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(hand1X, hand1Y);
    ctx.moveTo(shX, shY);
    ctx.lineTo(hand2X, hand2Y);
    ctx.stroke();
    ctx.strokeStyle = MAN.robe;
    ctx.lineWidth = 0.32;
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(hand1X, hand1Y);
    ctx.moveTo(shX, shY);
    ctx.lineTo(hand2X, hand2Y);
    ctx.stroke();

    ctx.lineCap = "butt";
    ctx.strokeStyle = MAN.ink;
    ctx.lineWidth = 0.50;
    ctx.beginPath();
    ctx.moveTo(f * 0.35, hipY);
    ctx.lineTo(tipLX, tipLY);
    ctx.stroke();
    ctx.strokeStyle = MAN.pole;
    ctx.lineWidth = 0.30;
    ctx.beginPath();
    ctx.moveTo(f * 0.35, hipY);
    ctx.lineTo(tipLX, tipLY);
    ctx.stroke();

    ctx.strokeStyle = "#9a5a24";
    ctx.lineWidth = 0.085;
    for (k = 0; k < 4; k++) {
      t = 0.08 + k * 0.070;
      bx2 = f * 0.35 + ux * t * plen;
      by2 = hipY + uy * t * plen;
      ctx.beginPath();
      ctx.moveTo(bx2 - nx * 0.20, by2 - ny * 0.20);
      ctx.lineTo(bx2 + nx * 0.20, by2 + ny * 0.20);
      ctx.stroke();
    }

    ctx.fillStyle = MAN.skin;
    for (k = 0; k < 2; k++) {
      t = (k === 0) ? 0.11 : 0.30;
      bx2 = f * 0.35 + ux * t * plen;
      by2 = hipY + uy * t * plen;
      ctx.beginPath();
      ctx.arc(bx2, by2, 0.19, 0, Math.PI * 2);
      ctx.fill();
    }

    for (gg = 0; gg < 3; gg++) {
      t = 0.36 + gg * 0.20;
      bx2 = f * 0.35 + ux * t * plen;
      by2 = hipY + uy * t * plen;
      ctx.strokeStyle = "#3a2a14";
      ctx.lineWidth = 0.055;
      ctx.beginPath();
      ctx.moveTo(bx2 - nx * 0.16, by2 - ny * 0.16);
      ctx.lineTo(bx2 + nx * 0.16, by2 + ny * 0.16);
      ctx.stroke();
    }

    ctx.strokeStyle = MAN.steel;
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.moveTo(tipLX - ux * 0.30 - nx * 0.24, tipLY - uy * 0.30 - ny * 0.24);
    ctx.lineTo(tipLX - ux * 0.30 + nx * 0.24, tipLY - uy * 0.30 + ny * 0.24);
    ctx.stroke();
    ctx.strokeStyle = "#6a4a1e";
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.moveTo(tipLX - nx * 0.26, tipLY - ny * 0.26);
    ctx.lineTo(tipLX + nx * 0.26, tipLY + ny * 0.26);
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = BODY.core;
    ctx.beginPath();
    ctx.arc(tipLX - ux * 0.16, tipLY - uy * 0.16, 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.restore();
  }

  function drawFrame(fr, wx, wy, w, h, facing) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.scale(facing || 1, -1);
    ctx.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, -w * 0.5, -h, w, h);
    ctx.restore();
  }

  function drawSprite(im, wx, wy, w, h, facing) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.scale(facing || 1, -1);
    ctx.drawImage(im, -w * 0.5, -h, w, h);
    ctx.restore();
  }

  function pushPop(text, x, y, color) {
    pops.push({ text: text, x: x, y: y, t: 0, c: color });
    if (pops.length > 16) { pops.shift(); }
  }

  function tickPops(dt) {
    var i;
    for (i = pops.length - 1; i >= 0; i--) {
      pops[i].t += dt;
      if (pops[i].t > 0.9) { pops.splice(i, 1); }
    }
  }

  function drawPops(m) {
    var i;
    var p;
    var s;
    var a;
    if (!pops.length) { return; }
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 19px -apple-system,'PingFang SC',sans-serif";
    for (i = 0; i < pops.length; i++) {
      p = pops[i];
      s = screenOf(m, p.x, p.y + p.t * 2.4);
      a = Math.max(0, 1 - p.t / 0.9);
      ctx.globalAlpha = a;
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.lineWidth = 4.5;
      ctx.strokeText(p.text, s.x, s.y);
      ctx.fillStyle = p.c;
      ctx.fillText(p.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawTeach(m) {
    var h = teachHint;
    var p;
    var a;
    var w;
    var tw;
    if (!h) { return; }
    a = h.t < 0.3 ? h.t / 0.3 : (h.t > 2.9 ? Math.max(0, (3.4 - h.t) / 0.5) : 1);
    if (a <= 0) { return; }
    p = screenOf(m, h.x, h.y);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = "600 15px 'Kaiti SC','STKaiti','KaiTi',serif";
    tw = ctx.measureText(h.text).width;
    w = tw + 28;
    ctx.fillStyle = "rgba(8,14,22,0.86)";
    ctx.fillRect(p.x - w * 0.5, p.y - 32, w, 27);
    ctx.strokeStyle = "#ff8a3d";
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - w * 0.5, p.y - 32, w, 27);
    ctx.fillStyle = "#ffe9b0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(h.text, p.x, p.y - 18.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  function drawProps(s) {
    var list = s.props || [];
    var b = window.WHGame.bounds(s.room);
    var i;
    var pr;
    var im;
    var w;
    var h;
    var x;
    for (i = 0; i < list.length; i++) {
      pr = list[i];
      im = IMG[pr.kind];
      if (!im) { continue; }
      h = pr.h || 2.6;
      w = h * (im.width / im.height);
      x = b.x0 + pr.lx;
      if (pr.kind === "altar") { drawAltarGlow(s, x, pr.lx); }
      drawSprite(im, x, 0, w, h, 1);
    }
  }

  function drawAltarGlow(s, x, lx) {
    var near = Math.abs(s.player.x - lx) <= D.ALTAR.R;
    var pulse = 0.5 + 0.5 * Math.sin(s.t * 2.2);
    var r = D.ALTAR.R;
    var k;
    var a;
    var g;
    var yy;
    g = ctx.createRadialGradient(x, 0.2, r * 0.15, x, 0.2, r);
    a = near ? 0.34 + pulse * 0.16 : 0.14 + pulse * 0.05;
    g.addColorStop(0, "rgba(255, 190, 110, " + a.toFixed(3) + ")");
    g.addColorStop(0.55, "rgba(224, 120, 50, " + (a * 0.45).toFixed(3) + ")");
    g.addColorStop(1, "rgba(180, 80, 30, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, 0.2, r, r * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    if (s.incense > 0) {
      ctx.strokeStyle = "rgba(255, 214, 150, " + (0.35 + pulse * 0.35).toFixed(3) + ")";
      ctx.lineWidth = 0.09;
      ctx.beginPath();
      ctx.ellipse(x, 0.2, r * 0.86, r * 0.26, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (k = 0; k < 4; k++) {
      yy = ((s.t * 0.55 + k * 0.25) % 1);
      ctx.globalAlpha = (1 - yy) * (near ? 0.75 : 0.32);
      ctx.fillStyle = k % 2 === 0 ? "#ffd08a" : "#e07a3c";
      ctx.beginPath();
      ctx.arc(x + Math.sin(s.t * 1.3 + k * 1.7) * 0.28, 1.0 + yy * 2.4,
              (0.08 + yy * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEnemies() {
    var list = window.WHGame.enemiesRaw();
    var s0 = window.WHGame.snapshot();
    var i;
    var e;
    var im;
    var w;
    var h;
    var bob;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e.alive) { continue; }
      im = (e.kind === "miasma") ? IMG.miasma : IMG.ghost;
      if (!im) { continue; }
      bob = 0.10 * Math.sin(time * 2.5 + e.ph);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.30 + 0.18 * Math.sin(time * 3.4 + e.ph);
      ctx.strokeStyle = "#ffb347";
      ctx.lineWidth = 0.11;
      ctx.beginPath();
      ctx.ellipse(e.x, 0.18, e.r * 2.4, e.r * 0.66, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.13 + 0.08 * Math.sin(time * 3.4 + e.ph);
      ctx.fillStyle = "#ffb347";
      ctx.beginPath();
      ctx.ellipse(e.x, 0.18, e.r * 2.4, e.r * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      if (e.kind === "miasma") {
        h = 2.6;
        w = h * (im.width / im.height);
        ctx.globalAlpha = 0.95;
        drawSprite(im, e.x, e.y - h * 0.42 + bob * 0.5, w, h, 1);
      } else {
        h = 4.2;
        w = h * (im.width / im.height);
        ctx.globalAlpha = 0.97;
        drawSprite(im, e.x, e.y - h * 0.62 + bob, w, h, e.x < s0.player.x ? -1 : 1);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  function drawBoss(s) {
    var bs = s.bossState;
    var i;
    var pulse;
    var rx;
    var ry;
    var bw;
    var bh;
    var k;
    var recoil;
    var tp;
    if (!bs || !bs.active) { return; }
    if (bossLastHits >= 0 && bs.hitsLanded > bossLastHits) { bossReactT = 0.34; }
    bossLastHits = bs.hitsLanded;
    if (bs.telegraph) { bossTelegraphT = Math.min(0.30, bossTelegraphT + 0.05); }
    else { bossTelegraphT = Math.max(0, bossTelegraphT - 0.08); }
    bossReactT = Math.max(0, bossReactT - 0.016);
    k = bossReactT / 0.34;
    recoil = (bs.x > s.player.x ? 1 : -1) * k * 0.55;
    rx = bs.r * 1.9;
    ry = bs.r * 2.4;
    bw = bs.r * 5.2;
    bh = bw * (IMG.boss ? (IMG.boss.height / IMG.boss.width) : 1.08);

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.10 + 0.07 * Math.sin(time * 2.2);
    ctx.fillStyle = bs.phaseIdx >= 1 ? "#c04a7a" : "#7a4a8a";
    ctx.beginPath();
    ctx.ellipse(bs.x, bs.y, bw * 0.78, bh * 0.60, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    if (bossTelegraphT > 0.01) {
      tp = 0.5 + 0.5 * Math.sin(time * 22);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.26 + 0.40 * tp;
      ctx.strokeStyle = "#ff5a3c";
      ctx.lineWidth = 0.24;
      ctx.beginPath();
      ctx.ellipse(bs.x, bs.y, rx * (2.0 - 0.42 * tp), ry * (2.0 - 0.42 * tp), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.16 + 0.20 * tp;
      ctx.fillStyle = "#ff2a1c";
      ctx.beginPath();
      ctx.ellipse(bs.x, bs.y, bw * 0.80, bh * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    if (IMG.boss) {
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = "#02060a";
      ctx.beginPath();
      ctx.ellipse(bs.x, 0.16, bh * 0.34, bh * 0.085, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#c04a7a";
      ctx.beginPath();
      ctx.ellipse(bs.x, 0.30, bh * 0.52, bh * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      drawSprite(IMG.boss, bs.x + recoil, bs.y - bh * 0.72,
                 bw * (1 + 0.22 * k), bh * (1 - 0.20 * k), 1);
      if (k > 0.01) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = k * 0.85;
        drawSprite(IMG.boss, bs.x + recoil, bs.y - bh * 0.72,
                   bw * (1 + 0.22 * k), bh * (1 - 0.20 * k), 1);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = bs.telegraph ? 0.96 : 0.9;
      ctx.fillStyle = bs.phaseIdx >= 2 ? "#8e1f52" : (bs.phaseIdx >= 1 ? "#75244e" : "#5e2a52");
      ctx.beginPath();
      ctx.ellipse(bs.x, bs.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = bs.telegraph ? "#ffd27a" : "#ff8a6a";
      ctx.lineWidth = 0.20;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (i = 0; i < 3; i++) {
      pulse = 1.25 + i * 0.45 + 0.10 * Math.sin(time * 3 + i);
      ctx.globalAlpha = 0.30 - i * 0.08;
      ctx.strokeStyle = "#ff8a3d";
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.ellipse(bs.x, bs.y, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawAppendages(m) {
    var segs = C.segments();
    var n = segs.length;
    var p;
    var L;
    var W;
    var ta;
    var at;
    var k;
    var i2;
    var nm;
    var w2;
    var bx;
    var by;
    var ex;
    var ey;
    var pb;
    var pe;

    if (IMG.head) {
      var hs = window.WHGame.snapshot();
      var hb = window.WHGame.bounds(hs.room);
      var hps = window.WHPlayer.snapshot();
      var htip = window.WHPlayer.poleTip(hs.thrustCd > D.ACT.THRUST_CD * 0.5);
      var tipS = screenOf(m, hb.x0 + htip.x, htip.y);
      var hipS = screenOf(m, hb.x0 + hps.x + hps.facing * 0.35, hps.y + 1.9);
      var pAng = Math.atan2(tipS.y - hipS.y, tipS.x - hipS.x);
      L = 3.1 * m.px;
      W = L * (IMG.head.width / IMG.head.height);

      ctx.save();
      ctx.globalAlpha = 0.40;
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.ellipse(tipS.x, tipS.y + L * 0.10, L * 0.32, L * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      var headAng = (hps.facing > 0) ? -0.34 : (Math.PI + 0.34);

      ctx.save();
      ctx.translate(tipS.x, tipS.y);
      ctx.rotate(headAng);
      ctx.drawImage(IMG.head, -L * 0.34, -W * 0.20, L, W);

      var ebx = -L * 0.34 + L * 0.62;
      var eby = -W * 0.20 + W * 0.46;
      var beam = ctx.createLinearGradient(ebx, eby, ebx + L * 1.7, eby + L * 0.30);
      beam.addColorStop(0, "rgba(255,206,132,0.58)");
      beam.addColorStop(0.4, "rgba(255,176,84,0.20)");
      beam.addColorStop(1, "rgba(255,158,64,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(ebx, eby - L * 0.045);
      ctx.lineTo(ebx + L * 1.7, eby + L * 0.30 - L * 0.34);
      ctx.lineTo(ebx + L * 1.7, eby + L * 0.30 + L * 0.34);
      ctx.lineTo(ebx, eby + L * 0.045);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = "#fffdf0";
      ctx.beginPath();
      ctx.arc(ebx, eby, L * 0.052, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();

      ctx.save();
      ctx.translate(tipS.x, tipS.y);
      ctx.rotate(pAng);
      ctx.strokeStyle = "#6a4a1e";
      ctx.lineWidth = Math.max(2, 0.052 * m.px);
      ctx.beginPath();
      ctx.moveTo(-L * 0.02, -W * 0.17);
      ctx.lineTo(-L * 0.02, W * 0.17);
      ctx.stroke();
      ctx.strokeStyle = MAN.steel;
      ctx.lineWidth = Math.max(1, 0.026 * m.px);
      ctx.beginPath();
      ctx.moveTo(-L * 0.11, -W * 0.14);
      ctx.lineTo(-L * 0.11, W * 0.14);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (IMG.tail) {
      ta = Math.atan2(segs[n - 1].y - segs[n - 2].y, segs[n - 1].x - segs[n - 2].x);
      p = screenOf(m, segs[n - 1].x, segs[n - 1].y);
      L = 1.6 * m.px;
      W = L * (IMG.tail.width / IMG.tail.height);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-ta);
      ctx.drawImage(IMG.tail, -L * 0.10, -W * 0.5, L, W);
      ctx.restore();
    }

    if (IMG.claw) {
      at = [6, 13, 20, 27];
      for (k = 0; k < at.length; k++) {
        i2 = at[k];
        nm = normalAt(segs, i2);
        w2 = widthAt(i2);
        bx = segs[i2].x - nm.x * w2 * 0.75;
        by = segs[i2].y - nm.y * w2 * 0.75;
        ex = bx - nm.x * 0.45;
        ey = by - nm.y * 0.45;
        pb = screenOf(m, bx, by);
        pe = screenOf(m, ex, ey);
        ctx.lineCap = "round";
        ctx.strokeStyle = BODY.ink;
        ctx.lineWidth = 0.18 * m.px;
        ctx.beginPath();
        ctx.moveTo(pb.x, pb.y);
        ctx.lineTo(pe.x, pe.y);
        ctx.stroke();
        ctx.strokeStyle = BODY.outer;
        ctx.lineWidth = 0.10 * m.px;
        ctx.beginPath();
        ctx.moveTo(pb.x, pb.y);
        ctx.lineTo(pe.x, pe.y);
        ctx.stroke();
        L = 0.88 * m.px;
        W = L * (IMG.claw.width / IMG.claw.height);
        ctx.save();
        ctx.translate(pe.x, pe.y);
        ctx.rotate(Math.PI * 0.5 - 0.75 + 0.5 * (k % 2) + 0.25 * Math.sin(k * 1.7));
        ctx.drawImage(IMG.claw, -L * 0.14, -W * 0.5, L, W);
        ctx.restore();
      }
    }
  }

  function probeHeadY(m) {
    var base = (m.px > 0 && m.groundY > 0) ? (m.groundY - 0.30 * m.H) / m.px : 31;
    return base + 1.3 * Math.sin(probeT * 1.1);
  }

  function stepProbe(dt) {
    var m = window.WHScene.metrics();
    time += dt;
    steps += 1;
    probeT += dt;
    C.setHead(probeT * 2.2, probeHeadY(m));
    C.step(dt);
    window.WHFire.emit(emitPoints(C.segments()), 1);
    window.WHFire.step(dt);
  }

  function stepGame(dt) {
    var s;
    time += dt;
    steps += 1;
    window.WHGame.step(dt);
    s = window.WHGame.snapshot();
    window.WHAudio.tick(s, dt);
    pushTrail();
    tickFx(dt);
    zoomNow += ((s.duel ? 0.72 : 1) - zoomNow) * Math.min(1, dt * 4);
    window.WHScene.setZoom(zoomNow);
    if (teachHint) {
      teachHint.t += dt;
      if (teachHint.t > 3.4) { teachHint = null; }
    }
    if (hurtFlash > 0) { hurtFlash = Math.max(0, hurtFlash - dt * 3.0); }
    if (shakeT > 0) { shakeT = Math.max(0, shakeT - dt * 5.0); }
    if (lashT > 0) { lashT = Math.max(0, lashT - dt * 3.2); }
    tickPops(dt);
    window.WHFire.emit(emitPoints(C.segments()), 1);
    window.WHFire.step(dt);
  }

  function gameOn() {
    if (!window.WHGame) { return false; }
    return window.WHGame.snapshot().phase !== "boot";
  }

  function render() {
    var on = gameOn();
    var s = window.WHGame.snapshot();
    var b = window.WHGame.bounds(s.room);
    var m;
    var segs;
    if (on) {
      window.WHScene.setRoom(b.x0, b.x1, s.gateOpen, s.enemies, s.plats, s.gaps);
    } else {
      window.WHScene.clearRoom();
    }
    window.WHScene.camera(s.head.x);
    m = window.WHScene.metrics();
    if (!m.W) { return; }
    segs = C.segments();

    ctx.save();
    if (shakeT > 0) {
      ctx.translate(Math.sin(time * 62) * shakeT * 5, Math.cos(time * 71) * shakeT * 4);
    }

    window.WHScene.drawBack(ctx, null, time);

    ctx.save();
    ctx.translate(0, m.groundY);
    ctx.scale(m.px, -m.px);
    ctx.translate(-m.camX, 0);
    if (s.phase === "return") {
      var rise = Math.min(1, s.returnT / 3.4);
      ctx.translate(0, rise * 30);
      ctx.globalAlpha = 1 - rise * 0.88;
    }
    if (on) {
      drawProps(s);
      drawGroundGlow(segs);
      drawPearls();
      drawEnemies();
      drawBoss(s);
      drawTroupe();
    }
    drawBody(segs);
    drawIncenseHeads(segs);
    drawLash();
    drawTrail();
    window.WHFire.draw(ctx);
    drawPlayer(m, s);
    drawFx();
    ctx.restore();

    drawAppendages(m);
    drawTeach(m);
    drawPops(m);

    window.WHScene.drawFront(ctx, null, time);

    if (hurtFlash > 0) {
      var vg = ctx.createRadialGradient(m.W * 0.5, m.H * 0.5, Math.min(m.W, m.H) * 0.26,
                                        m.W * 0.5, m.H * 0.5, Math.max(m.W, m.H) * 0.72);
      vg.addColorStop(0, "rgba(190,24,24,0)");
      vg.addColorStop(1, "rgba(190,24,24," + (0.52 * hurtFlash).toFixed(3) + ")");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, m.W, m.H);
    }

    drawBloom(m.W, m.H);
    ctx.restore();
    syncHud();
  }

  function frame(now) {
    var dt = (now - last) / 1000;
    var guard = 0;
    if (!isFinite(dt) || dt <= 0) { dt = 0.016; }
    if (dt > 0.05) { dt = 0.05; }
    last = now;
    try {
      acc += dt;
      while (acc >= D.STEP && guard < 6) {
        if (gameOn()) { stepGame(D.STEP); } else { stepProbe(D.STEP); }
        acc -= D.STEP;
        guard += 1;
      }
      render();
    } catch (e) {
      frameErr = true;
    }
    raf = window.requestAnimationFrame(frame);
  }

  function startLoop() {
    if (raf) { return; }
    last = window.performance ? window.performance.now() : Date.now();
    raf = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
  }

  function showView(id) {
    var vs = document.querySelectorAll(".view");
    var i;
    var el;
    for (i = 0; i < vs.length; i++) { vs[i].className = "view"; }
    el = document.getElementById(id);
    if (el) { el.className = "view on"; }
  }

  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) { return; }
    el.textContent = msg;
    el.className = "on";
    window.setTimeout(function () { el.className = ""; }, 1400);
  }

  function syncHud() {
    var bar;
    var bt;
    var pad;
    var pct;
    var s;
    if (!window.WHGame) { return; }
    s = window.WHGame.snapshot();
    bar = document.getElementById("hud-fire");
    bt = document.getElementById("hud-beat");
    pad = document.getElementById("pad");
    if (bar) {
      pct = Math.max(0, Math.min(100, s.fire)) / 100;
      bar.className = s.dim ? "dim" : "";
      bar.setAttribute("data-fire", pct.toFixed(3));
      if (bar.firstChild) { bar.firstChild.style.transform = "scaleX(" + pct.toFixed(3) + ")"; }
    }
    paintSkill(document.getElementById("sk-thrust"), s.thrustCd, s.cd.thrust,
               s.cost.thrust, s.fire);
    paintSkill(document.getElementById("sk-tail"), s.tailCd, s.cd.tail,
               s.cost.tail, s.fire);
    paintBoss(s);
    paintCombo(s);
    paintIncense(s.incense > 0);
    if (bt) {
      bt.textContent = s.roomName + (s.boss ? "" : (s.gateOpen ? " · 门开" : " · 剩 " + s.enemies));
      bt.className = "on";
    }
    if (pad) { pad.className = s.wrapSegs > 0 ? "wrap-on" : ""; }
  }

  function paintSkill(el, cd, total, cost, fire) {
    var mask;
    var lbl;
    var k;
    var low;
    if (!el) { return; }
    k = total > 0 ? Math.max(0, Math.min(1, cd / total)) : 0;
    low = fire <= cost;
    el.className = low ? "sk low" : (k > 0 ? "sk" : "sk hot");
    mask = el.querySelector(".mask");
    if (mask) { mask.style.transform = "scaleY(" + k.toFixed(3) + ")"; }
    lbl = el.querySelector(".cost");
    if (lbl && lbl.textContent !== String(cost)) { lbl.textContent = String(cost); }
  }

  function paintBoss(s) {
    var el = document.getElementById("hud-boss");
    var bar;
    var note;
    var b = s.bossState;
    var pct;
    var txt;
    if (!el) { return; }
    if (!b || !b.active || b.done) { el.className = ""; return; }
    el.className = "on";
    bar = el.querySelector("i");
    note = el.querySelector("em");
    pct = Math.max(0, Math.min(100, b.purify)) / 100;
    if (bar) { bar.style.transform = "scaleX(" + pct.toFixed(3) + ")"; }
    txt = Math.round(b.purify) + " / " + D.BOSS.HP_PURIFY;
    if (b.vanish > 0) { txt = "隐身 · 此刻打不到"; }
    else if (b.mode === "telegraph") { txt = "起手 · 躲开"; }
    if (note && note.textContent !== txt) { note.textContent = txt; }
  }

  function paintCombo(s) {
    var el = document.getElementById("hud-combo");
    var b;
    var i;
    var txt;
    var frac;
    if (!el) { return; }
    b = el.querySelector("b");
    i = el.querySelector("i");
    if (s.comboShowT > 0 && s.comboShow > 1) {
      txt = "连 ×" + s.comboShow + (s.comboShow >= 3 ? " 重击" : "");
      frac = s.comboShowT / 1.2;
      el.className = "on";
    } else if (s.tailT > 0) {
      txt = "甩中 · 追刺";
      frac = s.tailT / 0.9;
      el.className = "on chase";
    } else {
      el.className = "";
      return;
    }
    if (b && b.textContent !== txt) { b.textContent = txt; }
    if (i) { i.style.transform = "scaleX(" + Math.max(0, Math.min(1, frac)).toFixed(3) + ")"; }
  }

  function paintIncense(on) {
    var el = document.getElementById("hud-incense");
    var cls = on ? "on" : "";
    if (el && el.className !== cls) { el.className = cls; }
  }

  function showResult() {
    var s = window.WHGame.snapshot();
    var el = document.getElementById("result");
    var img = document.getElementById("result-card");
    if (el) {
      el.textContent = "四室皆清 · 瘟神已净。疫气 " + s.kills.miasma + " 团 · 瘟鬼 "
        + s.kills.ghost + " 只 · 用时 " + Math.round(s.t) + " 秒";
    }
    if (img && window.WHShare) {
      img.src = window.WHShare.dataUrl(s);
      img.style.display = "block";
    }
    showView("v-result");
    stopLoop();
  }

  function wireUi() {
    var b;
    var pads;
    var i;
    if (!window.WHGame) { return; }
    window.WHGame.setCallback("toast", toast);
    window.WHGame.setCallback("room", function (r) {
      window.WHAudio.sfx("room");
      if (r && r.hint) { toast(r.hint); }
    });
    window.WHGame.setCallback("gate", function () { window.WHAudio.sfx("gate"); toast("门开了"); });
    window.WHGame.setCallback("purify", function (p) {
      window.WHAudio.sfx("purify");
      if (p && p.x !== undefined) {
        pushFx(p.x, p.y, 1.25);
        pushPop("+" + p.gain, p.x, p.y + 1.6, "#ffd98a");
      }
      shakeT = Math.max(shakeT, 0.6);
    });
    window.WHGame.setCallback("teach", function (h) {
      if (h && h.text) { teachHint = { text: h.text, x: h.x, y: h.y, t: 0 }; }
    });
    window.WHGame.setCallback("hurt", function () {
      window.WHAudio.sfx("hurt");
      var s = window.WHGame.snapshot();
      var b = window.WHGame.bounds(s.room);
      pushFx(b.x0 + s.player.x, s.player.y + 2.0, 1.25);
      hurtFlash = 1;
      shakeT = 1;
      var lh = s.lastHurt || {};
      var col = lh.kind === "ghost" ? "#9fd8ff"
              : (lh.kind === "boss" ? "#ff6a4a"
              : (lh.kind === "pit" ? "#ffc06a" : "#b9e07a"));
      var lx = b.x0 + s.player.x;
      if (typeof lh.sx === "number" && lh.sx !== null) {
        lx = b.x0 + s.player.x + (lh.sx > (b.x0 + s.player.x) ? 1.4 : -1.4);
      }
      pushPop("-" + D.FIRE_RES.HURT, lx, s.player.y + 3.6, col);
    });
    window.WHGame.setCallback("thrust", function (h) {
      window.WHAudio.sfx("thrust");
      if (h && h.finisher) {
        var s = window.WHGame.snapshot();
        var bb = window.WHGame.bounds(s.room);
        pushPop("三连", bb.x0 + s.player.x, s.player.y + 5.4, "#ff8a3d");
        shakeT = Math.max(shakeT, 0.85);
      }
    });
    window.WHGame.setCallback("tail", function (h) {
      window.WHAudio.sfx("tail");
      var segs = C.segments();
      var n = segs.length;
      var ta = segs[0].angle;
      var i;
      lashPts = [];
      for (i = n - 1; i >= 0; i--) {
        lashPts.push({ x: segs[i].x, y: segs[i].y });
      }
      for (i = 1; i <= 7; i++) {
        lashPts.push({ x: segs[0].x + Math.cos(ta) * i * 0.9,
                       y: segs[0].y + Math.sin(ta) * i * 0.9 });
      }
      lashT = 1;
      shakeT = Math.max(shakeT, 1.0);
      pushFx(segs[n - 1].x, segs[n - 1].y, 0.55);
    });
    window.WHGame.setCallback("boss", function () { window.WHAudio.sfx("boss"); });
    window.WHGame.setCallback("return", function () {
      window.WHAudio.sfx("return");
      var n = document.getElementById("return-note");
      if (n) { n.textContent = "八月十六 · 送龙归天"; }
      toast("龙归天");
    });
    window.WHGame.setCallback("done", showResult);
    window.WHGame.setCallback("fail", function () {
      window.WHAudio.sfx("fail");
      var r = document.getElementById("result");
      var s2 = window.WHGame.snapshot();
      var lh2 = s2.lastHurt;
      var why = "香火一路烧尽了。";
      if (lh2 && (s2.t - lh2.t) < 1.5) {
        if (lh2.kind === "miasma") { why = "疫气钻进香火里，火被蚀空了。"; }
        else if (lh2.kind === "ghost") { why = "瘟鬼扑上来，一掌压灭了香火。"; }
        else if (lh2.kind === "boss") { why = "瘟神一掌打散，香火落地就灭。"; }
        else if (lh2.kind === "pit") { why = "一脚踏空掉下沟壑，香火散在风里。"; }
      }
      if (r) {
        r.textContent = why + "这条龙没能送到海边。\n"
          + "倒在「" + s2.roomName + "」· 疫气 " + s2.kills.miasma + " 团 · 瘟鬼 "
          + s2.kills.ghost + " 只 · 用时 " + Math.round(s2.t) + " 秒";
      }
      showView("v-result");
      stopLoop();
    });

    var album = document.getElementById("btn-album");
    if (album) {
      album.addEventListener("click", function () {
        window.WHShare.save(window.WHGame.snapshot()).then(function () {
          toast("已存到相册");
        }, function (e) {
          toast((e && e.message === "no-bridge") ? "预览环境：长按图中分享卡保存" : "保存失败");
        });
      });
    }
    var noteBtn = document.getElementById("btn-note");
    if (noteBtn) {
      noteBtn.addEventListener("click", function () {
        window.WHShare.note(window.WHGame.snapshot()).then(function () {
          toast("已打开笔记");
        }, function (e) {
          toast((e && e.message === "no-bridge") ? "预览环境不支持发笔记" : "发布失败");
        });
      });
    }

    b = document.getElementById("btn-start");
    if (b) {
      b.addEventListener("click", function () {
        window.WHAudio.init();
        window.WHAudio.resume();
        tipTrail.length = 0;
        var s = window.WHGame.start();
        showView("v-stage");
        if (s.hint) { toast(s.hint); }
        startLoop();
      });
    }

    var mb = document.getElementById("btn-mute");
    if (mb) {
      mb.addEventListener("click", function () {
        window.WHAudio.init();
        window.WHAudio.resume();
        var m = window.WHAudio.setMuted(!window.WHAudio.isMuted());
        mb.textContent = m ? "静" : "声";
      });
    }

    pads = [["btn-left", "left"], ["btn-right", "right"], ["btn-jump", "jump"],
            ["btn-thrust", "thrust"], ["btn-tail", "tail"]];
    for (i = 0; i < pads.length; i++) {
      (function (id, key) {
        var el = document.getElementById(id);
        var viaPointer = false;
        if (!el) { return; }
        el.addEventListener("pointerdown", function (ev) {
          if (ev && ev.preventDefault) { ev.preventDefault(); }
          viaPointer = true;
          window.WHGame.press(key);
        });
        el.addEventListener("pointerup", function () { window.WHGame.release(key); });
        el.addEventListener("pointercancel", function () { window.WHGame.release(key); });
        el.addEventListener("pointerleave", function () { window.WHGame.release(key); });
        el.addEventListener("touchstart", function (ev) {
          if (ev && ev.preventDefault) { ev.preventDefault(); }
          if (viaPointer) { return; }
          window.WHGame.press(key);
        }, { passive: false });
        el.addEventListener("touchend", function (ev) {
          if (ev && ev.preventDefault) { ev.preventDefault(); }
          window.WHGame.release(key);
        }, { passive: false });
        el.addEventListener("touchcancel", function () { window.WHGame.release(key); });
      })(pads[i][0], pads[i][1]);
    }

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowLeft" || ev.key === "a") { window.WHGame.press("left"); }
      else if (ev.key === "ArrowRight" || ev.key === "d") { window.WHGame.press("right"); }
      else if (ev.key === " " || ev.key === "ArrowUp" || ev.key === "w") { window.WHGame.press("jump"); }
      else if (ev.key === "j" || ev.key === "k" || ev.key === "Enter") { window.WHGame.press("thrust"); }
    });
    document.addEventListener("keyup", function (ev) {
      if (ev.key === "ArrowLeft" || ev.key === "a") { window.WHGame.release("left"); }
      else if (ev.key === "ArrowRight" || ev.key === "d") { window.WHGame.release("right"); }
      else if (ev.key === " " || ev.key === "ArrowUp" || ev.key === "w") { window.WHGame.release("jump"); }
    });
  }

  function showBootError(e) {
    var w = document.getElementById("warn");
    if (!w) { return; }
    w.textContent = "启动失败：" + (e && e.message ? e.message : e) + " —— 请把这句话发给开发者";
    w.style.display = "block";
  }

  function boot() {
    try {
      canvas = document.getElementById("stage");
      ctx = canvas.getContext("2d");
      offscreen = document.createElement("canvas");
      window.WHScene.init(canvas);
      window.WHFire.init(offscreen);
      C.build();
      loadAssets();
      wireUi();
      if (!test) { startLoop(); }
    } catch (e) {
      showBootError(e);
    }
  }

  if (test) {
    window.__wh = {
      seed: D.SEED,
      faulted: function () { return frameErr; },
      fxState: function () { return { hurt: hurtFlash, shake: shakeT }; },
      snapshot: function () {
        var h = C.head();
        return {
          t: time,
          steps: steps,
          head: { x: h.x, y: h.y },
          tension: C.tension(),
          segments: C.segments().length,
          fire: window.WHFire.debug(),
          metrics: window.WHScene.metrics()
        };
      },
      anim: function () { return window.WHAnim ? window.WHAnim.report() : null; },
      assets: function () {
        var out = {};
        var k;
        for (k in CLIP_FILE) {
          if (Object.prototype.hasOwnProperty.call(CLIP_FILE, k)) { out[k] = !!IMG[k]; }
        }
        out.headSize = IMG.head ? [IMG.head.width, IMG.head.height] : null;
        return out;
      },
      test: {
        reset: function () { C.reset(); time = 0; steps = 0; acc = 0; probeT = 0; },
        stepOnce: function (dt) { stepProbe(dt); },
        settle: function (n, dt) { var i; for (i = 0; i < n; i++) { stepProbe(dt); } },
        debug: function () { return C.debug(); },
        setHead: function (x, y) { C.setHead(x, y); },
        step: function (dt) { C.step(dt); },
        wrap: function (pillars) { return C.wrap(pillars); },
        hitTest: function (rect) { return C.hitTest(rect); },
        halfWidth: function (i) { return C.halfWidth(i); },
        render: function () { render(); },
        pause: stopLoop,
        resume: startLoop
      },
      player: {
        reset: function (x) { window.WHPlayer.reset(x); },
        press: function (k) { window.WHPlayer.press(k); },
        release: function (k) { window.WHPlayer.release(k); },
        releaseAll: function () { window.WHPlayer.releaseAll(); },
        step: function (dt, roomW) { window.WHPlayer.step(dt, roomW); },
        poleTip: function (thrust) { return window.WHPlayer.poleTip(thrust); },
        snapshot: function () { return window.WHPlayer.snapshot(); }
      },
      game: {
        start: function () { window.WHGame.start(); return window.WHGame.snapshot(); },
        reset: function () { window.WHGame.boot(); return window.WHGame.snapshot(); },
        on: gameOn,
        snapshot: function () { return window.WHGame.snapshot(); },
        bounds: function (i) { return window.WHGame.bounds(i); },
        enemies: function () { return window.WHGame.enemiesRaw(); },
        fire: function () { return window.WHGame.fire(); },
        action: function (k) { return window.WHGame.action(k); },
        press: function (k) { window.WHGame.press(k); },
        release: function (k) { window.WHGame.release(k); },
        releaseAll: function () { window.WHGame.releaseAll(); },
        addFire: function (n) { return window.WHGame.addFire(n); },
        setAuto: function (on) { window.WHGame.setAuto(on); },
        step: function (dt) { stepGame(dt); },
        settle: function (n, dt) { var i; for (i = 0; i < n; i++) { stepGame(dt); } },
        render: function () { render(); },
        trail: function () {
          var i;
          var dx;
          var dy;
          var m = 0;
          for (i = 1; i < tipTrail.length; i++) {
            dx = tipTrail[i].x - tipTrail[i - 1].x;
            dy = tipTrail[i].y - tipTrail[i - 1].y;
            m += Math.sqrt(dx * dx + dy * dy);
          }
          return m;
        },
        scene: function () { return { room: window.WHScene.room(), m: window.WHScene.metrics() }; },
        hud: function () {
          var bar = document.getElementById("hud-fire");
          var bt = document.getElementById("hud-beat");
          var i = bar ? bar.firstChild : null;
          return {
            scale: i ? (i.style.transform || null) : null,
            fire: bar ? bar.getAttribute("data-fire") : null,
            mode: bar ? bar.className : null,
            beat: bt ? bt.textContent : null,
            beatOn: bt ? bt.className : null
          };
        },
        views: function () {
          var on = document.querySelectorAll(".view.on");
          var i;
          var out = [];
          for (i = 0; i < on.length; i++) { out.push(on[i].id); }
          return out;
        }
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
