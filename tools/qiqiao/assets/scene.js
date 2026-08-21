(function () {
  var ctx = null, W = 0, H = 0, u = 1;
  var cx = 0, basinY = 0, basinRx = 0, basinRy = 0;
  var waterRx = 0, waterRy = 0;
  var t = 0;
  var ripples = [];

  var starPool = [];
  (function () {
    var r = window.QQRng(9), i;
    for (i = 0; i < 80; i++) {
      starPool.push({
        fx: r.next(),
        fy: r.range(0, 0.92),
        rad: r.range(0.8, 1.8),
        a: r.range(0.3, 0.9),
        ph: r.range(0, Math.PI * 2),
        sp: r.range(0.6, 2.2)
      });
    }
  })();

  var NAMED = [
    { fx: 0.30, fy: 0.10, rad: 2.4, a: 1, ph: 0.7, sp: 1.1 },
    { fx: 0.52, fy: 0.22, rad: 2.4, a: 1, ph: 2.3, sp: 0.9 }
  ];

  var clouds = [];
  (function () {
    var r = window.QQRng(21), i, j, c;
    var defs = [
      { fy: 0.14, speed: 3, a: 0.14, w: 150, off: 0.1 },
      { fy: 0.30, speed: 5, a: 0.10, w: 190, off: 0.55 },
      { fy: 0.44, speed: 4, a: 0.12, w: 130, off: 0.8 }
    ];
    for (i = 0; i < defs.length; i++) {
      c = { fy: defs[i].fy, speed: defs[i].speed, a: defs[i].a, w: defs[i].w, off: defs[i].off, blobs: [] };
      for (j = 0; j < 5; j++) {
        c.blobs.push({
          dx: r.range(-0.42, 0.42),
          dy: r.range(-0.3, 0.3),
          rx: r.range(0.32, 0.55),
          ry: r.range(0.16, 0.28)
        });
      }
      clouds.push(c);
    }
  })();

  var craters = [];
  (function () {
    var r = window.QQRng(5), i;
    for (i = 0; i < 3; i++) {
      craters.push({
        dx: r.range(-0.45, 0.45),
        dy: r.range(-0.45, 0.45),
        rr: r.range(0.12, 0.24)
      });
    }
  })();

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    ctx.canvas.width = W * dpr; ctx.canvas.height = H * dpr;
    ctx.canvas.style.width = W + "px"; ctx.canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    u = W / 400;
    cx = W / 2;
    basinY = H * 0.62;
    basinRx = W * 0.36;
    basinRy = basinRx * 0.42;
    waterRx = basinRx - 10 * u;
    waterRy = waterRx * 0.42;
  }

  function mod(a, b) { return ((a % b) + b) % b; }

  function ellipsePath(x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
  }

  function inBasin(x, y, m) {
    var dx = (x - cx) / (basinRx * m);
    var dy = (y - basinY) / (basinRy * m);
    return dx * dx + dy * dy < 1;
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2e3d52");
    g.addColorStop(1, "#1f2a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStar(x, y, rad, alpha) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, rad * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawGlint(x, y, alpha) {
    var L = 5 * u;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(0.8, 0.9 * u);
    ctx.lineCap = "round";
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha * 0.85));
    ctx.beginPath();
    ctx.moveTo(x - L, y); ctx.lineTo(x + L, y);
    ctx.moveTo(x, y - L); ctx.lineTo(x, y + L);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawStars(moonlight) {
    var i, s, x, y, tw, drawn = 0;
    var bright = 0.78 + 0.37 * moonlight;
    for (i = 0; i < starPool.length && drawn < 40; i++) {
      s = starPool[i];
      x = s.fx * W; y = s.fy * H;
      if (inBasin(x, y, 1.25)) continue;
      tw = Math.sin(t * s.sp + s.ph) * 0.25;
      drawStar(x, y, s.rad, (s.a + tw) * bright);
      drawn++;
    }
    for (i = 0; i < NAMED.length; i++) {
      s = NAMED[i];
      x = s.fx * W; y = s.fy * H;
      tw = Math.sin(t * s.sp + s.ph) * 0.12;
      drawStar(x, y, s.rad, s.a + tw);
      drawGlint(x, y, 0.7 + tw);
    }
  }

  function drawMoon() {
    var mx = W * 0.72, my = H * 0.16, mr = 34 * u;
    var halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.2);
    halo.addColorStop(0, "rgba(214,236,240,0.25)");
    halo.addColorStop(1, "rgba(214,236,240,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#D6ECF0";
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(174,203,214,0.5)";
    var i, c;
    for (i = 0; i < craters.length; i++) {
      c = craters[i];
      ctx.beginPath();
      ctx.arc(mx + c.dx * mr, my + c.dy * mr, c.rr * mr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawClouds() {
    var i, j, c, bw, x, y, b;
    for (i = 0; i < clouds.length; i++) {
      c = clouds[i];
      bw = c.w * u;
      x = mod(c.off * (W + bw) + t * c.speed * u, W + bw) - bw * 0.5;
      y = c.fy * H;
      for (j = 0; j < c.blobs.length; j++) {
        b = c.blobs[j];
        ctx.save();
        ctx.translate(x + b.dx * bw, y + b.dy * bw * 0.3);
        ctx.scale(1, b.ry / b.rx);
        var g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx * bw);
        g.addColorStop(0, "rgba(66,80,102," + c.a + ")");
        g.addColorStop(1, "rgba(66,80,102,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, b.rx * bw, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawBasinRim() {
    ctx.fillStyle = "#e8e4d8";
    ellipsePath(cx, basinY, basinRx, basinRy);
    ctx.fill();
    ctx.strokeStyle = "#e8e4d8";
    ctx.lineWidth = 6 * u;
    ellipsePath(cx, basinY, basinRx - 3 * u, (basinRx - 3 * u) * 0.42);
    ctx.stroke();
    ctx.strokeStyle = "rgba(66,80,102,0.5)";
    ctx.lineWidth = Math.max(1, 0.9 * u);
    ellipsePath(cx, basinY, basinRx - 7 * u, (basinRx - 7 * u) * 0.42);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, 0.7 * u);
    ellipsePath(cx, basinY, basinRx - 9 * u, (basinRx - 9 * u) * 0.42);
    ctx.stroke();
  }

  function drawWater() {
    var g = ctx.createRadialGradient(cx, basinY, 0, cx, basinY, waterRx);
    g.addColorStop(0, "#3c5468");
    g.addColorStop(1, "#2e3d52");
    ctx.fillStyle = g;
    ellipsePath(cx, basinY, waterRx, waterRy);
    ctx.fill();
  }

  function drawMoonlight(moonlight) {
    var mx = W * 0.72, my = H * 0.16;
    var dx = mx - cx, dy = my - basinY;
    var len = Math.sqrt(dx * dx + dy * dy);
    var nx = dx / len, ny = dy / len;
    var ox = cx + nx * waterRx * 0.3;
    var oy = basinY + ny * waterRy * 0.5;
    var ang = Math.atan2(dy, dx);
    var a = 0.2 * moonlight;
    ctx.save();
    ellipsePath(cx, basinY, waterRx, waterRy);
    ctx.clip();
    ctx.translate(ox, oy);
    ctx.rotate(ang);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, waterRx * 0.72);
    g.addColorStop(0, "rgba(255,255,255," + a + ")");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, 0.34);
    ctx.beginPath();
    ctx.arc(0, 0, waterRx * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawRipples(dt) {
    var i, rp, k;
    for (i = ripples.length - 1; i >= 0; i--) {
      rp = ripples[i];
      rp.r += rp.speed * dt;
      if (rp.r >= rp.max) ripples.splice(i, 1);
    }
    if (!ripples.length) return;
    ctx.save();
    ellipsePath(cx, basinY, waterRx, waterRy);
    ctx.clip();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5 * u;
    for (i = 0; i < ripples.length; i++) {
      rp = ripples[i];
      k = 1 - rp.r / rp.max;
      ctx.globalAlpha = Math.max(0, rp.alpha * k * 0.35);
      ellipsePath(cx, basinY, rp.r, rp.r * 0.42);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0, rp.alpha * k * 0.16);
      ellipsePath(cx, basinY, rp.r * 0.72, rp.r * 0.72 * 0.42);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  window.QQScene = {
    init: function (canvas) {
      ctx = canvas.getContext("2d");
      resize();
      window.addEventListener("resize", resize);
    },
    resize: resize,
    ripple: function (intensity) {
      var k = Math.min(intensity, 1.5);
      ripples.push({
        r: 0,
        max: basinRx * 0.9 * k,
        alpha: 0.5 * intensity,
        speed: basinRx * 1.2
      });
    },
    draw: function (st, dt) {
      var moonlight = (st && typeof st.moonlight === "number") ? st.moonlight : 0.6;
      t += dt;
      drawSky();
      drawStars(moonlight);
      drawMoon();
      drawClouds();
      drawBasinRim();
      drawWater();
      drawMoonlight(moonlight);
      drawRipples(dt);
    },
    metrics: function () {
      return { W: W, H: H, u: u, cx: cx, basinY: basinY, basinRx: basinRx, basinRy: basinRy, waterRx: waterRx, waterRy: waterRy };
    }
  };
})();
