(function () {
  var D = window.WHData.CAM;
  var HUE = window.WHData.HUES;

  var ctx = null;
  var W = 0;
  var H = 0;
  var u = 1;
  var px = 8;
  var basePx = 8;
  var zoom = 1;
  var groundY = 0;
  var camX = 0;
  var stars = [];
  var hills = [];
  var blocks = [];
  var fog = [];
  var props = [];
  var clouds = [];
  var pagodas = [];
  var IMG = { far: null, mid: null, near: null };

  function loadPlates() {
    var files = { far: "bg-far.webp", mid: "bg-mid.webp", near: "bg-near.webp" };
    var keys = ["far", "mid", "near"];
    var i;
    for (i = 0; i < keys.length; i++) {
      (function (k) {
        var im = new Image();
        im.onload = function () { IMG[k] = im; };
        im.src = "./assets/img/" + files[k];
      })(keys[i]);
    }
  }

  function buildScenery() {
    var rng = window.WHRng(0x5C3E ^ 20260925);
    var i;
    var k;
    var n;
    var b;

    stars = [];
    for (i = 0; i < 72; i++) {
      stars.push({ x: rng.next(), y: rng.range(0.02, 0.5), r: rng.range(0.4, 1.3), a: rng.range(0.22, 0.7) });
    }

    hills = [];
    for (i = 0; i < 28; i++) {
      hills.push(rng.range(0.4, 1));
    }

    n = Math.round(D.SPAN / D.GAP);
    blocks = [];
    for (k = 0; k < n; k++) {
      b = {
        gap: D.GAP,
        w: rng.range(0.55, 0.95) * D.GAP,
        h: rng.range(5.5, 13.5),
        roof: rng.int(0, 2),
        sign: rng.next() < 0.34,
        wcols: rng.int(1, 3),
        wrows: rng.int(2, 4)
      };
      blocks.push(b);
    }

    props = [];
    n = Math.round(D.SPAN / D.GAP);
    for (k = 0; k < n; k++) {
      props.push({
        kind: rng.int(0, 3),
        x: k * D.GAP + rng.range(-2.2, 2.2),
        w: rng.range(0.55, 1.15),
        h: rng.range(3.4, 7.6),
        lanterns: rng.int(1, 3)
      });
    }

    fog = [];
    for (i = 0; i < 9; i++) {
      fog.push({ x: rng.range(0, D.SPAN), y: rng.range(0.22, 0.5), rx: rng.range(6, 15), ry: rng.range(1.4, 3.2), a: rng.range(0.05, 0.13) });
    }

    clouds = [];
    for (i = 0; i < 8; i++) {
      clouds.push({ x: rng.range(0, D.SPAN * 2), y: rng.range(0.14, 0.46),
                    rx: rng.range(10, 22), ry: rng.range(1.5, 3.2), a: rng.range(0.016, 0.038) });
    }

    pagodas = [];
    for (i = 0; i < 7; i++) {
      pagodas.push({ tiers: rng.int(3, 5), w: rng.range(4.2, 7.0), h: rng.range(3.0, 5.2) });
    }
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    ctx.canvas.width = Math.round(W * dpr);
    ctx.canvas.height = Math.round(H * dpr);
    ctx.canvas.style.width = W + "px";
    ctx.canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    u = W / 400;
    basePx = D.SCALE * (Math.min(W, H) / 390);
    px = basePx * zoom;
    groundY = H * (W > H ? 0.80 : D.Y);
  }

  function setZoom(z) {
    if (z === zoom) { return; }
    zoom = z;
    px = basePx * zoom;
  }

  var roomState = null;

  function setRoom(x0, x1, gateOpen, left, plats, gaps) {
    roomState = { x0: x0, x1: x1, gateOpen: !!gateOpen, left: left || 0,
                  plats: plats || [], gaps: gaps || [] };
  }

  function drawGaps() {
    var gs;
    var k;
    var x;
    var w;
    var g;
    if (!roomState || !roomState.gaps || !roomState.gaps.length) { return; }
    gs = roomState.gaps;
    for (k = 0; k < gs.length; k++) {
      x = (roomState.x0 + gs[k].lx - camX) * px;
      w = gs[k].w * px;
      g = ctx.createLinearGradient(0, groundY, 0, groundY + 6 * px);
      g.addColorStop(0, "#000000");
      g.addColorStop(0.55, "#03060a");
      g.addColorStop(1, "#0a121c");
      ctx.fillStyle = g;
      ctx.fillRect(x, groundY, w, 9 * px);

      ctx.globalAlpha = 0.62;
      ctx.strokeStyle = HUE.ember;
      ctx.lineWidth = Math.max(1, 0.055 * px);
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x + w, groundY);
      ctx.stroke();
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = "#1d3448";
      ctx.lineWidth = Math.max(1, 0.05 * px);
      ctx.beginPath();
      ctx.moveTo(x + 0.4 * px, groundY + 1.4 * px);
      ctx.lineTo(x + w - 0.4 * px, groundY + 1.4 * px);
      ctx.moveTo(x + 0.9 * px, groundY + 3.0 * px);
      ctx.lineTo(x + w - 0.9 * px, groundY + 3.0 * px);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function clearRoom() {
    roomState = null;
  }

  function camera(x) {
    var viewW = W / px;
    var want = x - (W * D.AHEAD) / px;
    var lo;
    var hi;
    if (roomState) {
      lo = roomState.x0;
      hi = roomState.x1 - viewW;
      if (hi < lo) {
        want = lo + (roomState.x1 - roomState.x0 - viewW) * 0.5;
      } else {
        if (want < lo) { want = lo; }
        if (want > hi) { want = hi; }
      }
    }
    camX = want;
    return camX;
  }

  function inRoom(wx) {
    if (!roomState) { return true; }
    return wx >= roomState.x0 - 2.5 && wx <= roomState.x1 + 2.5;
  }

  function drawPlats() {
    var ps;
    var k;
    var x;
    var w;
    var top;
    var g;
    if (!roomState || !roomState.plats || !roomState.plats.length) { return; }
    ps = roomState.plats;
    for (k = 0; k < ps.length; k++) {
      x = (roomState.x0 + ps[k].lx - camX) * px;
      w = ps[k].w * px;
      top = groundY - ps[k].y * px;

      ctx.fillStyle = "#0a1119";
      ctx.fillRect(x, top, w, groundY - top);

      ctx.fillStyle = "#24384e";
      ctx.fillRect(x, top, w, 0.75 * px);

      g = ctx.createLinearGradient(0, top, 0, top + 0.75 * px);
      g.addColorStop(0, "rgba(255,224,164,0.90)");
      g.addColorStop(0.5, "rgba(255,178,96,0.62)");
      g.addColorStop(1, "rgba(255,138,61,0.34)");
      ctx.fillStyle = g;
      ctx.fillRect(x, top, w, 0.75 * px);

      ctx.fillStyle = "rgba(0,0,0,0.70)";
      ctx.fillRect(x, top + 0.75 * px, w, 0.42 * px);

      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#fff2cf";
      ctx.lineWidth = Math.max(2, 0.10 * px);
      ctx.beginPath();
      ctx.moveTo(x, top + 0.03 * px);
      ctx.lineTo(x + w, top + 0.03 * px);
      ctx.stroke();

      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = "#2a3f56";
      ctx.lineWidth = Math.max(1, 0.05 * px);
      ctx.beginPath();
      ctx.moveTo(x, top + 2.0 * px);
      ctx.lineTo(x + w, top + 2.0 * px);
      ctx.moveTo(x, top + 3.3 * px);
      ctx.lineTo(x + w, top + 3.3 * px);
      ctx.stroke();

      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = HUE.ember;
      ctx.lineWidth = Math.max(1, 0.055 * px);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, top + 1.2 * px);
      ctx.lineTo(x + 0.5, groundY);
      ctx.moveTo(x + w - 0.5, top + 1.2 * px);
      ctx.lineTo(x + w - 0.5, groundY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawHaze() {
    var h9 = 8.5 * px;
    var g = ctx.createLinearGradient(0, groundY - h9, 0, groundY + 0.6 * px);
    g.addColorStop(0, "rgba(255,168,96,0)");
    g.addColorStop(0.42, "rgba(255,158,88,0.055)");
    g.addColorStop(0.74, "rgba(255,150,80,0.105)");
    g.addColorStop(1, "rgba(126,96,74,0.045)");
    ctx.fillStyle = g;
    ctx.fillRect(0, groundY - h9, W, h9 + 0.6 * px);
  }

  function drawGroundPools() {
    tileLoop(9 * px, 1.0, function (k, sx) {
      var g = ctx.createRadialGradient(sx + 4.5 * px, groundY + 1.4 * px, 0,
                                       sx + 4.5 * px, groundY + 1.4 * px, 7.5 * px);
      g.addColorStop(0, "rgba(255,148,68,0.105)");
      g.addColorStop(0.55, "rgba(255,138,60,0.045)");
      g.addColorStop(1, "rgba(255,130,56,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - 4 * px, groundY, 17 * px, 11 * px);
    });
  }

  function drawGate() {
    var gx;
    var gx0;
    var top;
    var bot;
    var i;
    var ay;
    var open;
    var postW;
    var halfW;
    var leafW;
    var h;
    if (!roomState) { return; }
    open = roomState.gateOpen;
    gx = (roomState.x1 - camX - 1.3) * px;
    gx0 = (roomState.x0 - camX) * px;
    halfW = 1.5 * px;
    postW = Math.max(2, 0.30 * px);
    bot = groundY - 0.10 * px;
    h = 5.0 * px;
    top = bot - h;
    leafW = (halfW * 2 - postW * 2) * 0.5;

    if (roomState.x0 > 0) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#2a1d12";
      ctx.fillRect(gx0 - 0.7 * px, bot - 7.2 * px, 0.7 * px, 7.2 * px);
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = HUE.dim;
      ctx.lineWidth = Math.max(1, 0.10 * px);
      ctx.beginPath();
      ctx.moveTo(gx0 - 0.7 * px, bot - 7.2 * px);
      ctx.lineTo(gx0 - 0.7 * px, bot);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = open ? "#241609" : "#3a1f18";
    ctx.fillRect(gx - halfW, top, halfW * 2, h);

    if (open) {
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = HUE.ember;
      ctx.fillRect(gx - halfW + postW, top + 0.5 * px, (halfW - postW) * 2, h - 0.5 * px);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = HUE.glow;
      for (i = 0; i < 3; i++) {
        ay = top + 1.3 * px + i * 1.15 * px;
        ctx.beginPath();
        ctx.moveTo(gx - 0.42 * px, ay);
        ctx.lineTo(gx + 0.42 * px, ay);
        ctx.lineTo(gx, ay - 0.56 * px);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#3a2716";
      ctx.fillRect(gx - halfW + postW * 0.5, top, postW * 0.9, h);
      ctx.fillRect(gx + halfW - postW * 1.4, top, postW * 0.9, h);
    } else {
      ctx.fillStyle = "#4a2a1c";
      ctx.fillRect(gx - halfW + postW, top + 0.5 * px, leafW, h - 0.5 * px);
      ctx.fillRect(gx + postW * 0.1, top + 0.5 * px, leafW, h - 0.5 * px);

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#2a170e";
      ctx.lineWidth = Math.max(1, 0.085 * px);
      for (i = 0; i < 3; i++) {
        ay = top + (1.3 + i * 1.35) * px;
        ctx.beginPath();
        ctx.moveTo(gx - halfW + postW, ay);
        ctx.lineTo(gx - postW * 0.1, ay);
        ctx.moveTo(gx + postW * 0.1, ay);
        ctx.lineTo(gx + halfW - postW, ay);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(gx - halfW + postW, bot - 0.6 * px);
      ctx.lineTo(gx - postW * 0.1, top + 0.7 * px);
      ctx.moveTo(gx + postW * 0.1, top + 0.7 * px);
      ctx.lineTo(gx + halfW - postW, bot - 0.6 * px);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#8a2a1e";
      ctx.fillRect(gx - halfW + postW, top + h * 0.42, (halfW - postW) * 2, 0.24 * px);

      ctx.strokeStyle = "#d8b24a";
      ctx.lineWidth = Math.max(1.5, 0.10 * px);
      ctx.beginPath();
      ctx.arc(gx, top + h * 0.56, 0.20 * px, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = "#d8b24a";
      ctx.fillRect(gx - 0.34 * px, top + h * 0.56, 0.68 * px, 0.50 * px);
      ctx.fillStyle = "#5a3a12";
      ctx.beginPath();
      ctx.arc(gx, top + h * 0.56 + 0.22 * px, 0.095 * px, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#3a2716";
    ctx.fillRect(gx - halfW, top, postW, h);
    ctx.fillRect(gx + halfW - postW, top, postW, h);
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = HUE.dim;
    ctx.lineWidth = Math.max(1, 0.085 * px);
    ctx.strokeRect(gx - halfW, top, postW, h);
    ctx.strokeRect(gx + halfW - postW, top, postW, h);
    ctx.globalAlpha = 1;

    ctx.fillStyle = open ? "#4a3520" : "#3d2a18";
    ctx.fillRect(gx - halfW - 0.42 * px, top - 0.72 * px, (halfW + 0.42 * px) * 2, 0.72 * px);
    ctx.globalAlpha = open ? 0.95 : 0.8;
    ctx.fillStyle = open ? HUE.glow : HUE.ember;
    ctx.fillRect(gx - halfW - 0.42 * px, top - 0.20 * px, (halfW + 0.42 * px) * 2, 0.20 * px);
    ctx.globalAlpha = 1;

    if (!open && roomState.left > 0) {
      ctx.textAlign = "center";
      ctx.font = Math.max(11, Math.round(0.60 * px)) + "px 'Kaiti SC','STKaiti','KaiTi',serif";
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "#060a10";
      ctx.fillRect(gx - 1.05 * px, top - 2.15 * px, 2.1 * px, 1.30 * px);
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = HUE.glow;
      ctx.fillText("剩 " + roomState.left, gx, top - 1.18 * px);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    }
  }

  function screenX(wx, parallax) {
    return (wx - camX * parallax) * px;
  }

  function tileLoop(tileW, parallax, fn) {
    var off = camX * parallax * px;
    var first = Math.floor(off / tileW) - 1;
    var count = Math.ceil(W / tileW) + 3;
    var k;
    for (k = 0; k < count; k++) {
      fn(first + k, (first + k) * tileW - off);
    }
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, HUE.night1);
    g.addColorStop(1, HUE.night2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, groundY);

    var i;
    var s;
    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      ctx.globalAlpha = s.a;
      ctx.fillStyle = HUE.paper;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * groundY, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHills() {
    var span = 26;
    var baseY = groundY - H * 0.14;
    ctx.fillStyle = HUE.far;
    ctx.globalAlpha = 0.55;
    tileLoop(span * px, D.PARALLAX[0], function (k, sx) {
      var idx = ((k % hills.length) + hills.length) % hills.length;
      var hh = hills[idx] * H * 0.13;
      ctx.beginPath();
      ctx.moveTo(sx, groundY);
      ctx.lineTo(sx + span * px * 0.5, baseY - hh);
      ctx.lineTo(sx + span * px, groundY);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawBlocks(t) {
    ctx.fillStyle = HUE.near;
    tileLoop(D.GAP * px, D.PARALLAX[1], function (k, sx) {
      var idx = ((k % blocks.length) + blocks.length) % blocks.length;
      var b = blocks[idx];
      var bw = b.w * px;
      var bh = b.h * px;
      var top = groundY - bh;
      var r;
      var c;

      ctx.fillRect(sx, top, bw, bh);

      if (b.roof === 1) {
        ctx.beginPath();
        ctx.moveTo(sx - 0.35 * px, top);
        ctx.lineTo(sx + bw + 0.35 * px, top);
        ctx.lineTo(sx + bw * 0.5, top - 0.8 * px);
        ctx.closePath();
        ctx.fill();
      } else if (b.roof === 2) {
        ctx.fillRect(sx + bw * 0.2, top - 0.5 * px, bw * 0.6, 0.5 * px);
      }

      if (b.sign) {
        ctx.fillRect(sx + bw * 0.12, top + bh * 0.16, bw * 0.24, 0.42 * px);
      }

      ctx.fillStyle = HUE.ember;
      for (r = 0; r < b.wrows; r++) {
        for (c = 0; c < b.wcols; c++) {
          if ((r + c + k) % 3 === 0) { continue; }
          ctx.globalAlpha = 0.34;
          ctx.fillRect(
            sx + bw * (0.18 + c * 0.28),
            top + bh * (0.24 + r * 0.19),
            bw * 0.14,
            bh * 0.075
          );
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = HUE.near;
    });
  }

  function drawGround(t) {
    var g = ctx.createLinearGradient(0, groundY, 0, H);
    g.addColorStop(0, HUE.mid);
    g.addColorStop(1, HUE.near);
    ctx.fillStyle = g;
    ctx.fillRect(0, groundY, W, H - groundY);

    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = HUE.ember;
    ctx.lineWidth = Math.max(1, 0.07 * px);
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = HUE.ember;
    ctx.lineWidth = 1;
    tileLoop(4.5 * px, D.PARALLAX[2], function (k, sx) {
      if (!inRoom(k * 4.5)) { return; }
      ctx.beginPath();
      ctx.moveTo(sx, groundY + 0.6 * px);
      ctx.lineTo(sx + 1.6 * px, groundY + 0.6 * px);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function drawStreet(t) {
    var i;
    var pr;
    var sx;
    var base = groundY + 0.5 * px;
    var lx;
    var ly;

    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = HUE.mid;
    ctx.lineWidth = Math.max(1, 0.14 * px);
    for (i = 0; i < 7; i++) {
      var yy = base + (i + 1) * (H - base) / 8;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(W, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    tileLoop(D.GAP * px, D.PARALLAX[2], function (k, sx0) {
      var idx;
      var p;
      if (IMG.near) { return; }
      if (!inRoom(k * D.GAP)) { return; }
      idx = ((k % props.length) + props.length) % props.length;
      p = props[idx];
      sx = sx0 + p.x * px * 0.12;
      var pw = p.w * px;
      var ph = p.h * px;
      var top = groundY - ph;
      ctx.fillStyle = "#1b2a3a";
      ctx.strokeStyle = "#33506b";
      if (p.kind === 0) {
        ctx.fillRect(sx, top, pw, ph);
        ctx.fillRect(sx - pw * 0.5, top, pw * 2, ph * 0.12);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(sx, top, pw, ph * 0.06);
        ctx.globalAlpha = 1;
      } else if (p.kind === 1) {
        ctx.fillRect(sx, top, pw * 0.5, ph);
        for (i = 0; i < p.lanterns; i++) {
          lx = sx + pw * 0.25;
          ly = top + ph * (0.22 + i * 0.26);
          ctx.fillStyle = HUE.ember;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(lx, ly, pw * 0.30, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.arc(lx, ly, pw * 0.72, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#1b2a3a";
        }
      } else if (p.kind === 2) {
        ctx.fillRect(sx, top + ph * 0.35, pw * 1.8, ph * 0.65);
        ctx.fillRect(sx - pw * 0.3, top + ph * 0.15, pw * 2.4, ph * 0.2);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(sx - pw * 0.3, top + ph * 0.15, pw * 2.4, ph * 0.05);
        ctx.globalAlpha = 1;
      } else {
        ctx.beginPath();
        ctx.moveTo(sx, groundY);
        ctx.lineTo(sx + pw * 0.5, top);
        ctx.lineTo(sx + pw, groundY);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  function drawMoon() {
    var mx = W * 0.70;
    var my = H * 0.355;
    var r = Math.min(W, H) * 0.042;
    var i;
    var g;
    for (i = 0; i < 2; i++) {
      g = ctx.createRadialGradient(mx, my, r * 0.7, mx, my, r * (2.4 + i * 1.4));
      g.addColorStop(0, "rgba(226,214,180," + (i === 0 ? 0.16 : 0.08) + ")");
      g.addColorStop(1, "rgba(226,214,180,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my, r * (2.4 + i * 1.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = "#bdb29a";
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#5a5346";
    ctx.beginPath();
    ctx.arc(mx - r * 0.26, my - r * 0.20, r * 0.20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx + r * 0.22, my + r * 0.16, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawClouds() {
    var span = D.SPAN * 2;
    var i;
    var k;
    var c;
    var drift;
    var cx;
    var cy;
    var r;
    var g;
    for (i = 0; i < clouds.length; i++) {
      c = clouds[i];
      drift = (c.x - camX * 0.10) % span;
      if (drift < 0) { drift += span; }
      cx = drift * px;
      cy = c.y * groundY;
      r = Math.max(c.rx, c.ry) * px;
      for (k = -1; k <= 1; k++) {
        g = ctx.createRadialGradient(cx + k * r * 0.42, cy + k * r * 0.10, 0,
                                     cx + k * r * 0.42, cy + k * r * 0.10, r * 0.72);
        g.addColorStop(0, "rgba(64,84,110," + (c.a * (k === 0 ? 1 : 0.7)) + ")");
        g.addColorStop(0.6, "rgba(64,84,110," + (c.a * (k === 0 ? 0.45 : 0.3)) + ")");
        g.addColorStop(1, "rgba(64,84,110,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx + k * r * 0.42, cy + k * r * 0.10, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPagodas() {
    var span = 15;
    ctx.fillStyle = "#0c141d";
    ctx.globalAlpha = 0.9;
    tileLoop(span * px, 0.28, function (k, sx) {
      var idx = ((k % pagodas.length) + pagodas.length) % pagodas.length;
      var p = pagodas[idx];
      var pw = p.w * px;
      var base = groundY - 3.2 * px;
      var i;
      var th;
      var tw;
      var ty;
      for (i = 0; i < p.tiers; i++) {
        th = (p.h * px) / p.tiers;
        tw = pw * (1 - i * 0.15);
        ty = base - (i + 1) * th;
        ctx.fillRect(sx + (pw - tw) * 0.5, ty, tw, th * 0.60);
        ctx.beginPath();
        ctx.moveTo(sx + (pw - tw) * 0.5 - 0.55 * px, ty);
        ctx.lineTo(sx + (pw + tw) * 0.5 + 0.55 * px, ty);
        ctx.lineTo(sx + pw * 0.5, ty - th * 0.44);
        ctx.closePath();
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  function drawCrowd() {
    var span = 5.4;
    ctx.fillStyle = "#0a1018";
    tileLoop(span * px, 0.86, function (k, sx) {
      var h = ((k * 37) % 11) / 11;
      var hh = (1.85 + h * 0.95) * px;
      var bw = (0.72 + h * 0.34) * px;
      var base = groundY - 1.15 * px;
      ctx.fillRect(sx, base - hh, bw, hh);
      ctx.beginPath();
      ctx.arc(sx + bw * 0.5, base - hh - 0.40 * px, 0.42 * px, 0, Math.PI * 2);
      ctx.fill();
      if (h > 0.5) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#ffe9b0";
        ctx.fillRect(sx - bw * 0.55, base - hh * 0.78, 0.34 * px, 0.46 * px);
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#ffd98a";
        ctx.beginPath();
        ctx.arc(sx - bw * 0.38, base - hh * 0.55, 0.62 * px, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#0a1018";
      }
    });
  }

  function drawPlate(im, parallax, hWorld, fadeTop, fadeBot) {
    var hpx;
    var wpx;
    var off;
    var first;
    var count;
    var k;
    var idx;
    var sx;
    var top;
    var g;
    if (!im) { return; }
    hpx = hWorld * px;
    wpx = hpx * (im.width / im.height);
    if (wpx < 8) { return; }
    off = camX * parallax * px;
    first = Math.floor(off / wpx) - 1;
    count = Math.ceil(W / wpx) + 3;
    top = groundY - hpx;

    for (k = 0; k < count; k++) {
      idx = first + k;
      sx = idx * wpx - off;
      ctx.save();
      if (idx % 2 === 0) {
        ctx.drawImage(im, sx, top, wpx, hpx);
      } else {
        ctx.translate(sx + wpx, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(im, 0, top, wpx, hpx);
      }
      ctx.restore();
      if (fadeTop) {
        g = ctx.createLinearGradient(0, top, 0, top + hpx * 0.42);
        g.addColorStop(0, HUE.night1);
        g.addColorStop(1, "rgba(8,15,24,0)");
        ctx.fillStyle = g;
        ctx.fillRect(sx - 1, top, wpx + 2, hpx * 0.42);
      }
      if (fadeBot) {
        g = ctx.createLinearGradient(0, groundY - hpx * 0.34, 0, groundY + 0.4 * px);
        g.addColorStop(0, "rgba(8,14,22,0)");
        g.addColorStop(0.42, "rgba(26,24,26,0.28)");
        g.addColorStop(0.74, "rgba(122,86,58,0.32)");
        g.addColorStop(1, "rgba(255,152,82,0.30)");
        ctx.fillStyle = g;
        ctx.fillRect(sx - 1, groundY - hpx * 0.34, wpx + 2, hpx * 0.34 + 0.4 * px);
      }
    }
  }

  function drawBackdrops() {
    drawPlate(IMG.far, D.PARALLAX[0], 9.5, true, false);
    drawPlate(IMG.mid, D.PARALLAX[1], 11.5, true, true);
    drawPlate(IMG.near, 1.0, 5.2, true, true);
  }

  function drawBack(ctx2, cam, t) {
    drawSky();
    drawMoon();
    drawClouds();
    drawBackdrops();
    if (!IMG.far) { drawHills(); }
    drawHaze();
    if (!IMG.mid) { drawPagodas(); drawBlocks(t); }
    drawGround(t);
    drawGroundPools();
    drawGaps();
    drawPlats();
    drawStreet(t);
    drawCrowd();
    drawGate();
  }

  function drawFront(ctx2, cam, t) {
    var vg = ctx.createLinearGradient(0, H * 0.72, 0, H);
    vg.addColorStop(0, "rgba(7,12,18,0)");
    vg.addColorStop(1, "rgba(3,6,10,0.75)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    var i;
    var f;
    var drift;
    ctx.globalAlpha = 1;
    ctx.fillStyle = HUE.night1;
    for (i = 0; i < fog.length; i++) {
      f = fog[i];
      drift = f.x - camX * 1.06;
      ctx.globalAlpha = f.a;
      ctx.beginPath();
      ctx.ellipse(drift * px, f.y * H, f.rx * px, f.ry * px, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  window.WHScene = {
    init: function (canvas) {
      ctx = canvas.getContext("2d");
      buildScenery();
      loadPlates();
      resize();
      window.addEventListener("resize", resize);
    },
    resize: resize,
    camera: camera,
    setZoom: setZoom,
    setRoom: setRoom,
    clearRoom: clearRoom,
    room: function () { return roomState; },
    drawBack: drawBack,
    drawFront: drawFront,
    metrics: function () {
      return { W: W, H: H, u: u, px: px, camX: camX, groundY: groundY };
    },
    scenery: function () {
      return { stars: stars.length, hills: hills.length, blocks: blocks.length, fog: fog.length };
    },
    plates: function () {
      return { far: !!IMG.far, mid: !!IMG.mid, near: !!IMG.near };
    }
  };

  buildScenery();
})();
