(function () {
  var canvas = null, ctx = null, W = 0, H = 0, dpr = 1;
  var others = [];
  var wishes = [];
  var LANTERN_IMGS = {};
  ["lotus", "boat", "peach"].forEach(function (n) {
    var im = new Image();
    im.src = "./assets/img/" + n + ".webp";
    LANTERN_IMGS[n] = im;
  });

  function init(cv) {
    canvas = cv;
    ctx = cv.getContext("2d");
    resize();
  }

  function resize() {
    if (!canvas) return;
    var wrap = canvas.parentElement;
    dpr = window.devicePixelRatio || 1;
    W = wrap.clientWidth;
    H = wrap.clientHeight;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildOthers(seed, count) {
    var rng = window.HDRng(seed);
    others = [];
    for (var i = 0; i < count; i++) {
      others.push({
        delay: rng.range(0, 7000),
        x: rng.range(0.08, 0.92),
        depth: rng.range(0, 1),
        sway: rng.range(4, 14),
        ph: rng.next() * Math.PI * 2,
        shape: ["lotus", "boat", "peach"][rng.int(0, 2)]
      });
    }
    var pool = (window.HDData && window.HDData.wishes) || [];
    wishes = [];
    var n = Math.min(pool.length, 6);
    var used = {};
    for (var w = 0; w < n; w++) {
      var idx;
      do { idx = rng.int(0, pool.length - 1); } while (used[idx] && Object.keys(used).length < pool.length);
      used[idx] = true;
      wishes.push({
        text: pool[idx],
        side: w % 2 === 0 ? -1 : 1,
        t0: 2800 + w * 1700 + rng.range(0, 500),
        y: 0.14 + w * 0.055 + rng.range(0, 0.02)
      });
    }
  }

  function drawLantern(g, shape, x, y, s, flame, alpha) {
    var ctx = g;
    flame = Math.max(0, Math.min(1, flame));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;

    var glow = ctx.createRadialGradient(0, -6, 2, 0, -6, 46);
    glow.addColorStop(0, "rgba(255,190,90," + (0.1 + 0.3 * flame).toFixed(3) + ")");
    glow.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -6, 46, 0, Math.PI * 2);
    ctx.fill();

    var img = LANTERN_IMGS[shape];
    if (img && img.complete && img.naturalWidth > 0) {
      var sz = 64;
      ctx.drawImage(img, -sz / 2, -sz / 2 - 4, sz, sz);
      if (flame > 0.02) {
        var fh = 9 + Math.sin(Date.now() / 130) * 1.4 + Math.sin(Date.now() / 47) * 0.6;
        var flick = Math.sin(Date.now() / 110) * 1.1;
        ctx.globalAlpha = alpha * (0.5 + flame * 0.5);
        ctx.fillStyle = "rgba(255,230,150,0.9)";
        ctx.beginPath();
        ctx.moveTo(-2.5, -12);
        ctx.quadraticCurveTo(flick, -12 - fh, 2.5, -12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    if (shape === "lotus") {
      ctx.fillStyle = "#d98d96";
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(i * 9, 4, 8, 14, i * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#e8b4b8";
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === "boat") {
      ctx.fillStyle = "#c9a86a";
      ctx.beginPath();
      ctx.moveTo(-24, 2);
      ctx.quadraticCurveTo(0, 16, 24, 2);
      ctx.lineTo(18, -4);
      ctx.quadraticCurveTo(0, 4, -18, -4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e8d5a3";
      ctx.fillRect(-2, -16, 4, 14);
    } else {
      ctx.fillStyle = "#e8a868";
      ctx.beginPath();
      ctx.arc(-6, 0, 12, 0, Math.PI * 2);
      ctx.arc(6, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7a9a6a";
      ctx.beginPath();
      ctx.ellipse(0, -13, 7, 4, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (flame > 0.02) {
      var fh2 = 11 + Math.sin(Date.now() / 130) * 1.6 + Math.sin(Date.now() / 47) * 0.7;
      var flick2 = Math.sin(Date.now() / 110) * 1.3;
      ctx.globalAlpha = alpha * (0.5 + flame * 0.5);
      ctx.fillStyle = "rgba(255,220,130,0.95)";
      ctx.beginPath();
      ctx.moveTo(-4, -8);
      ctx.quadraticCurveTo(flick2, -8 - fh2, 4, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,250,220,0.9)";
      ctx.beginPath();
      ctx.moveTo(-2, -8);
      ctx.quadraticCurveTo(flick2 * 0.6, -8 - fh2 * 0.6, 2, -8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function draw(st, t) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    var horizon = H * 0.4;
    var sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#0d1420");
    sky.addColorStop(1, "#1c2733");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);

    var water = ctx.createLinearGradient(0, horizon, 0, H);
    water.addColorStop(0, "#243342");
    water.addColorStop(1, "#0f1620");
    ctx.fillStyle = water;
    ctx.fillRect(0, horizon, W, H - horizon);

    ctx.fillStyle = "#111a26";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.quadraticCurveTo(W * 0.2, horizon - 34, W * 0.42, horizon);
    ctx.quadraticCurveTo(W * 0.66, horizon - 50, W, horizon);
    ctx.lineTo(W, horizon);
    ctx.closePath();
    ctx.fill();

    var mx = W * 0.76, my = H * 0.14;
    var halo = ctx.createRadialGradient(mx, my, 4, mx, my, 70);
    halo.addColorStop(0, "rgba(214,236,240,0.5)");
    halo.addColorStop(1, "rgba(214,236,240,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d6ecf0";
    ctx.beginPath();
    ctx.arc(mx, my, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(214,236,240,0.12)";
    ctx.lineWidth = 2;
    for (var i = 0; i < 5; i++) {
      var ry = horizon + 14 + i * 10 + Math.sin(t / 900 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(mx - 40 + i * 6, ry);
      ctx.lineTo(mx + 40 - i * 6, ry);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(214,236,240,0.05)";
    ctx.lineWidth = 1;
    for (var r = 0; r < 8; r++) {
      var wy = horizon + 20 + r * (H - horizon) / 9 + Math.sin(t / 700 + r * 1.7) * 3;
      ctx.beginPath();
      ctx.moveTo(0, wy);
      ctx.bezierCurveTo(W * 0.3, wy + 4, W * 0.6, wy - 4, W, wy);
      ctx.stroke();
    }

    if (st.phase === "light") {
      var cx = W / 2, cy = H * 0.6;
      ctx.save();
      var refl = ctx.createLinearGradient(0, cy + 40, 0, cy + 130);
      refl.addColorStop(0, "rgba(255,190,90," + (0.16 * st.flame + 0.03) + ")");
      refl.addColorStop(1, "rgba(255,190,90,0)");
      ctx.fillStyle = refl;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 80, 70, 46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      var bob = Math.sin(t / 1100) * 4;
      drawLantern(ctx, st.lantern.shape, cx, cy + bob, 1.9, st.flame / 100, 1);
      ctx.fillStyle = "rgba(232,213,163," + (0.4 + st.flame * 0.35) + ")";
      ctx.font = "13px 'Kaiti SC','STKaiti','KaiTi',serif";
      ctx.textAlign = "center";
      var hintTxt = st.flame <= 0 ? "轻点一下，为 ta 点亮烛火" : "多陪灯火一会儿，它会更亮";
      ctx.fillText(hintTxt, cx, H * 0.9);
    }

    if (st.phase === "release") {
      var elapsed = t - st.releaseT0;
      var p = Math.min(1, elapsed / 13000);
      var vpx = W / 2, vpy = horizon + 12;

      for (var o = 0; o < others.length; o++) {
        var ol = others[o];
        var q = Math.max(0, Math.min(1, (elapsed - ol.delay) / 9500));
        if (q <= 0) continue;
        var easeO = q * q * (3 - 2 * q);
        var sx = ol.x * W, sy = H * (0.62 + ol.depth * 0.3);
        var ex = vpx + (ol.x - 0.5) * W * 0.14, ey = vpy + 8 + ol.depth * 14;
        var ox = sx + (ex - sx) * easeO + Math.sin(elapsed / 1500 + ol.ph) * ol.sway * (1 - easeO);
        var oy = sy + (ey - sy) * easeO + Math.sin(elapsed / 900 + ol.ph) * 2 * (1 - easeO);
        var os = (0.45 + ol.depth * 0.75) * (1 - easeO * 0.93);
        var oa = Math.min(1, q * 5) * (1 - Math.max(0, (easeO - 0.86) / 0.14));
        if (oa <= 0 || os < 0.04) continue;
        if (os < 0.16) {
          ctx.fillStyle = "rgba(255,200,110," + (0.55 * oa).toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(ox, oy, 1.4 + os * 14, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawLantern(ctx, ol.shape, ox, oy, os, 0.7, oa * 0.92);
        }
      }

      var ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      var lx = W / 2 + Math.sin(p * 4.6) * 14 * (1 - ease);
      var ly = H * 0.62 + (vpy + 6 - H * 0.62) * ease;
      var ls = 1.9 * (1 - ease * 0.92);
      drawLantern(ctx, st.lantern.shape, lx, ly, ls, 0.55 + st.flame / 100 * 0.45, 1);

      for (var wI = 0; wI < wishes.length; wI++) {
        var ws = wishes[wI];
        var ageW = (elapsed - ws.t0) / 1000;
        if (ageW <= 0 || ageW >= 6) continue;
        var wAlpha = Math.min(1, ageW / 1.1) * Math.min(1, (6 - ageW) / 1.4) * 0.5;
        var wx = ws.side < 0 ? W * 0.13 : W * 0.87;
        var wy = H * ws.y - ageW * 5;
        ctx.font = "14px 'Kaiti SC','STKaiti','KaiTi',serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(214,236,240," + wAlpha.toFixed(3) + ")";
        var wChars = ws.text.split("");
        for (var wc = 0; wc < wChars.length; wc++) {
          ctx.fillText(wChars[wc], wx, wy + wc * 17);
        }
      }

      if (st.message && elapsed > 2600) {
        var chars = st.message.split("");
        var shown = Math.min(chars.length, Math.floor((elapsed - 2600) / 340));
        if (shown > 0) {
          ctx.font = "19px 'Kaiti SC','STKaiti','KaiTi',serif";
          ctx.textAlign = "center";
          var per = 13;
          var lines = [];
          for (var li = 0; li < chars.length; li += per) lines.push(chars.slice(li, li + per));
          var drawn = 0;
          for (var ln = 0; ln < Math.min(lines.length, 2); ln++) {
            for (var ci = 0; ci < lines[ln].length; ci++) {
              if (drawn >= shown) break;
              var age = Math.min(1, (elapsed - 2600 - drawn * 340) / 900);
              var alpha = age * (0.55 + 0.45 * Math.min(1, p * 3));
              ctx.fillStyle = "rgba(232,213,163," + alpha.toFixed(3) + ")";
              ctx.shadowColor = "rgba(255,190,90,0.6)";
              ctx.shadowBlur = 12 * age;
              var lineW = lines[ln].length * 21;
              ctx.fillText(lines[ln][ci], W / 2 - lineW / 2 + ci * 21 + 10, H * 0.2 + ln * 32 - (1 - age) * 8);
              ctx.shadowBlur = 0;
              drawn++;
            }
          }
        }
      }
      if (p >= 1 && !st.endNotified) {
        st.endNotified = true;
        if (window.HDMain && window.HDMain.onReleaseDone) window.HDMain.onReleaseDone();
      }
    }
  }

  window.HDScene = { init: init, resize: resize, draw: draw, buildOthers: buildOthers, drawLantern: drawLantern };
})();
