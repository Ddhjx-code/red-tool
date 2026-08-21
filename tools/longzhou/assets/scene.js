(function () {
  var ctx = null, W = 0, H = 0, u = 1;
  var cx = 0, laneW = 0, boatY = 0, ppm = 0, riverHW = 0;
  var AHEAD_M = 55;
  var shimR = window.LZRng(11);
  var shims = [];
  (function () {
    var i;
    for (i = 0; i < 14; i++) {
      shims.push({
        lx: shimR.range(-1.55, 1.55),
        z: shimR.range(0, AHEAD_M + 10),
        a: shimR.range(0.10, 0.16),
        j: shimR.range(-6, 6),
        len: shimR.range(16, 30)
      });
    }
  })();
  var splashes = [];

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    ctx.canvas.width = W * dpr; ctx.canvas.height = H * dpr;
    ctx.canvas.style.width = W + "px"; ctx.canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    u = W / 400;
    cx = W / 2; laneW = W * 0.27; boatY = H * 0.78;
    riverHW = Math.min(laneW * 1.9, cx - 56 * u);
    ppm = boatY / AHEAD_M;
  }

  function project(laneX, z) {
    return { x: cx + laneX * laneW, y: boatY - z * ppm, s: 1 };
  }

  function mod(a, b) { return ((a % b) + b) % b; }

  function drawBanks() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#6b7a5e");
    g.addColorStop(1, "#5c6b52");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    var hw = riverHW;
    var wg = ctx.createLinearGradient(0, 0, 0, H);
    wg.addColorStop(0, "#3c5468");
    wg.addColorStop(1, "#2e3d52");
    ctx.fillStyle = wg;
    ctx.fillRect(cx - hw, 0, hw * 2, H);
    ctx.fillStyle = "#c9b98a";
    ctx.fillRect(cx - hw - 3, 0, 3, H);
    ctx.fillRect(cx + hw, 0, 3, H);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(cx - hw, 0, 1.5, H);
    ctx.fillRect(cx + hw - 1.5, 0, 1.5, H);
  }

  function drawLaneDashes(dist) {
    var off = mod(dist * ppm, 36 * u);
    var side, x;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 3 * u;
    ctx.setLineDash([18 * u, 18 * u]);
    ctx.lineDashOffset = -off;
    for (side = -1; side <= 1; side += 2) {
      x = cx + side * 0.5 * laneW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  function drawShimmer(dist) {
    var i, sm, zw, y, x, maxL = riverHW / laneW - 0.12;
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";
    ctx.lineWidth = 2 * u;
    for (i = 0; i < shims.length; i++) {
      sm = shims[i];
      zw = mod(sm.z - dist, AHEAD_M + 10);
      y = boatY - zw * ppm;
      if (y < -10 || y > H + 10) continue;
      x = cx + Math.max(-maxL, Math.min(maxL, sm.lx)) * laneW + sm.j * u;
      ctx.globalAlpha = sm.a;
      ctx.beginPath();
      ctx.moveTo(x - sm.len * u / 2, y);
      ctx.lineTo(x + sm.len * u / 2, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSceneryShape(type, x, y, s0) {
    var i;
    ctx.fillStyle = "#39462f";
    ctx.strokeStyle = "#39462f";
    if (type === 0) {
      ctx.lineWidth = Math.max(1, s0 * 0.06);
      ctx.lineCap = "round";
      for (i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * s0 * 0.1, y + s0 * 0.1);
        ctx.quadraticCurveTo(x + i * s0 * 0.2, y - s0 * 0.3, x + i * s0 * 0.34, y - s0 * 0.52);
        ctx.stroke();
      }
    } else if (type === 1) {
      ctx.beginPath();
      ctx.arc(x, y, s0 * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2f3a27";
      ctx.beginPath();
      ctx.arc(x - s0 * 0.08, y - s0 * 0.08, s0 * 0.18, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 2) {
      ctx.fillRect(x - s0 * 0.38, y - s0 * 0.3, s0 * 0.76, s0 * 0.6);
      ctx.strokeStyle = "#2f3a27";
      ctx.lineWidth = Math.max(1, s0 * 0.07);
      ctx.beginPath();
      ctx.moveTo(x - s0 * 0.38, y);
      ctx.lineTo(x + s0 * 0.38, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(x, y, s0 * 0.34, s0 * 0.24, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2f3a27";
      ctx.beginPath();
      ctx.ellipse(x + s0 * 0.2, y + s0 * 0.14, s0 * 0.16, s0 * 0.11, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawScenery(dist) {
    var SPAN = AHEAD_M + 20, k, zw, y, side, margin, x;
    var bankW = cx - riverHW;
    for (k = 0; k < 14; k++) {
      zw = mod(k * 12 - dist, SPAN);
      y = boatY - zw * ppm;
      if (y < -50 * u || y > H + 50 * u) continue;
      side = k % 2 === 0 ? -1 : 1;
      margin = (20 + ((k * 53) % 27)) * u;
      if (margin > bankW - 10 * u) margin = Math.max(0, bankW * 0.5);
      x = cx + side * (riverHW + margin);
      drawSceneryShape(k % 4, x, y, 36 * u);
    }
  }

  function drawSplashes(dt) {
    var i, sp;
    ctx.fillStyle = "#ffffff";
    for (i = splashes.length - 1; i >= 0; i--) {
      sp = splashes[i];
      sp.vy += 600 * u * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt;
      if (sp.life <= 0) { splashes.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, Math.min(1, sp.life * 2));
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  window.LZScene = {
    init: function (canvas) { ctx = canvas.getContext("2d"); resize(); window.addEventListener("resize", resize); },
    resize: resize,
    project: project,
    addSplash: function (x, y, n) { for (var i = 0; i < n; i++) splashes.push({ x: x, y: y, vx: (i / n - 0.5) * 260 * u, vy: -(60 + (i % 5) * 55) * u, life: 0.5 }); },
    draw: function (st, dt) { drawBanks(); drawLaneDashes(st.dist); drawShimmer(st.dist); drawScenery(st.dist); drawSplashes(dt); },
    metrics: function () { return { W: W, H: H, u: u, boatY: boatY, cx: cx, laneW: laneW, AHEAD_M: AHEAD_M, ppm: ppm }; }
  };
})();
