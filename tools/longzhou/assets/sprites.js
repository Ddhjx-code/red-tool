(function () {
  function boat(ctx, x, y, s, o) {
    o = o || {};
    var m = window.LZScene.metrics();
    var u = m.u;
    var sc = u * s;
    var phase = o.paddlePhase || 0;
    var alpha = 1;
    if (o.blink) alpha = Math.sin(phase * 3) > 0 ? 1 : 0.35;
    ctx.save();
    ctx.translate(x, y);
    if (o.tilt) ctx.rotate(o.tilt);
    ctx.globalAlpha = alpha * ctx.globalAlpha;
    ctx.scale(sc * 0.72, sc * 0.72);

    ctx.strokeStyle = "#8E1B1F";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 62);
    ctx.lineTo(0, 86);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -68);
    ctx.bezierCurveTo(12, -46, 19, -20, 20, 8);
    ctx.bezierCurveTo(20, 36, 15, 58, 9, 63);
    ctx.quadraticCurveTo(0, 68, -9, 63);
    ctx.bezierCurveTo(-15, 58, -20, 36, -20, 8);
    ctx.bezierCurveTo(-19, -20, -12, -46, 0, -68);
    ctx.closePath();
    ctx.fillStyle = "#C3272B";
    ctx.fill();
    ctx.strokeStyle = "#8E1B1F";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.strokeStyle = "rgba(142,27,31,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -54);
    ctx.lineTo(0, 56);
    ctx.stroke();
    var by;
    for (by = -16; by <= 36; by += 26) {
      ctx.beginPath();
      ctx.moveTo(-15, by);
      ctx.lineTo(15, by);
      ctx.stroke();
    }

    if (o.dashing) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#FFB61E";
    }
    ctx.fillStyle = "#FFB61E";
    ctx.beginPath();
    ctx.arc(0, -73, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -84, 3.6, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFB61E";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-4, -71);
    ctx.quadraticCurveTo(-11, -65, -9, -56);
    ctx.moveTo(4, -71);
    ctx.quadraticCurveTo(11, -65, 9, -56);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#8E1B1F";
    ctx.beginPath();
    ctx.arc(0, -45, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFB61E";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = "#425066";
    ctx.beginPath();
    ctx.ellipse(0, -27, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -33, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#425066";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (o.drumHit) {
      ctx.moveTo(-5, -30);
      ctx.lineTo(-4, -42);
      ctx.moveTo(5, -30);
      ctx.lineTo(4, -42);
    } else {
      ctx.moveTo(-6, -28);
      ctx.lineTo(-11, -22);
      ctx.moveTo(6, -28);
      ctx.lineTo(11, -22);
    }
    ctx.stroke();

    var side, i, raw, a, px, py, tipx, tipy;
    for (side = -1; side <= 1; side += 2) {
      for (i = 0; i < 3; i++) {
        raw = Math.sin(phase + i * 0.9);
        a = raw * 0.5;
        px = side * 13;
        py = -6 + i * 20;
        ctx.fillStyle = "#425066";
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
        tipx = px + side * 16 * Math.cos(a);
        tipy = py + 4 + 8 * Math.sin(a);
        ctx.strokeStyle = "#425066";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(tipx, tipy);
        ctx.stroke();
        if (raw > 0.3) {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(tipx, tipy + 1, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function obstacle(ctx, type, x, y, s, t) {
    var m = window.LZScene.metrics();
    var u = m.u;
    var sc = u * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    if (type === "rock") {
      ctx.beginPath();
      ctx.moveTo(-32, 7);
      ctx.lineTo(-21, -19);
      ctx.lineTo(1, -28);
      ctx.lineTo(24, -13);
      ctx.lineTo(30, 7);
      ctx.closePath();
      ctx.fillStyle = "#3a424d";
      ctx.fill();
      ctx.strokeStyle = "#2b323c";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, -24);
      ctx.lineTo(-2, -6);
      ctx.strokeStyle = "rgba(43,50,60,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 8, 35, 6, 0, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else if (type === "whirl") {
      ctx.fillStyle = "rgba(28,42,58,0.85)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 34, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      var ph = t * 3, i, j, a0, aa, rr2, xx, yy, steps = 13;
      ctx.lineCap = "round";
      for (i = 0; i < 3; i++) {
        a0 = ph + i * (Math.PI * 2 / 3);
        ctx.strokeStyle = "rgba(214,232,238,0.85)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (j = 0; j <= steps; j++) {
          aa = a0 + j * 0.3;
          rr2 = 29 - j * 1.8;
          xx = Math.cos(aa) * rr2;
          yy = Math.sin(aa) * rr2 * 0.44;
          if (j === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "#141f2d";
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "log") {
      var w = 90, h = 16, rad = h / 2;
      ctx.fillStyle = "#7a5a3a";
      rr(ctx, -w / 2, -h / 2, w, h, rad);
      ctx.fill();
      ctx.strokeStyle = "#5c4126";
      ctx.lineWidth = 2;
      rr(ctx, -w / 2, -h / 2, w, h, rad);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 14, -3);
      ctx.lineTo(w / 2 - 16, -3);
      ctx.strokeStyle = "rgba(92,65,38,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#a8815a";
      ctx.beginPath();
      ctx.ellipse(-w / 2 + rad * 0.7, 0, rad * 0.5, rad * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w / 2 - rad * 0.7, 0, rad * 0.5, rad * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(92,65,38,0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(-w / 2 + rad * 0.7, 0, rad * 0.26, rad * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(w / 2 - rad * 0.7, 0, rad * 0.26, rad * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 4, h / 2);
      ctx.lineTo(w / 2 - 4, h / 2);
      ctx.stroke();
    } else if (type === "yuchuan") {
      ctx.beginPath();
      ctx.moveTo(0, -32);
      ctx.bezierCurveTo(11, -20, 13, -6, 13, 4);
      ctx.bezierCurveTo(13, 18, 8, 28, 0, 32);
      ctx.bezierCurveTo(-8, 28, -13, 18, -13, 4);
      ctx.bezierCurveTo(-13, -6, -11, -20, 0, -32);
      ctx.closePath();
      ctx.fillStyle = "#4a5460";
      ctx.fill();
      ctx.strokeStyle = "#39424d";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.strokeStyle = "rgba(214,224,231,0.5)";
      ctx.lineWidth = 1.2;
      var py;
      for (py = -18; py <= 22; py += 10) {
        ctx.beginPath();
        ctx.moveTo(-10, py);
        ctx.lineTo(10, py);
        ctx.stroke();
      }
      ctx.fillStyle = "#8a6a4a";
      ctx.beginPath();
      ctx.ellipse(0, 2, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#6d5238";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      var wd;
      for (wd = 0; wd < 3; wd++) {
        ctx.beginPath();
        ctx.arc((wd - 1) * 5, 35 + wd * 2, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === "fubiao") {
      ctx.translate(0, Math.sin(t * 2.5) * 2.5);
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 13);
      ctx.lineTo(0, 22);
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#C3272B";
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-7, -1.8, 14, 3.6);
      ctx.restore();
      ctx.strokeStyle = "#8E1B1F";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(20,31,45,0.8)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 5.8, 5.6, 1.9, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === "zhufa") {
      var rw = 86, rh = 30, np = 6, phh = rh / np, rp;
      for (rp = 0; rp < np; rp++) {
        ctx.fillStyle = rp % 2 === 0 ? "#b99b6b" : "#ad9060";
        rr(ctx, -rw / 2, -rh / 2 + rp * phh, rw, phh - 1, (phh - 1) / 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(92,65,38,0.7)";
      ctx.lineWidth = 1.2;
      var jx, jy;
      for (rp = 0; rp < np; rp++) {
        jy = -rh / 2 + rp * phh + (phh - 1) / 2;
        for (jx = -26 + rp * 9; jx <= 30; jx += 38) {
          ctx.beginPath();
          ctx.moveTo(jx, jy - 2);
          ctx.lineTo(jx, jy + 2);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = "#4a3520";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-30, -rh / 2 - 1);
      ctx.lineTo(-24, rh / 2 + 1);
      ctx.moveTo(-24, -rh / 2 - 1);
      ctx.lineTo(-30, rh / 2 + 1);
      ctx.moveTo(26, -rh / 2 - 1);
      ctx.lineTo(32, rh / 2 + 1);
      ctx.moveTo(32, -rh / 2 - 1);
      ctx.lineTo(26, rh / 2 + 1);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-rw / 2 + 5, rh / 2);
      ctx.lineTo(rw / 2 - 5, rh / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pickup(ctx, id, x, y, s, t) {
    var m = window.LZScene.metrics();
    var u = m.u;
    var rare = id !== "zongzi" && id !== "wine";
    var bob = Math.sin(t * 3) * 4 * u * s;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(u * s, u * s);
    if (rare) {
      ctx.fillStyle = id === "ling" ? "rgba(255,182,30,0.4)" : "rgba(255,182,30,0.22)";
      ctx.beginPath();
      ctx.ellipse(0, 26, 26, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    var i, a;
    if (id === "zongzi") {
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(24, 16);
      ctx.lineTo(-24, 16);
      ctx.closePath();
      ctx.fillStyle = "#4a7c59";
      ctx.fill();
      ctx.strokeStyle = "#35603f";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(7, -10);
      ctx.quadraticCurveTo(0, -5, -7, -10);
      ctx.closePath();
      ctx.fillStyle = "#f7f3e8";
      ctx.fill();
      ctx.strokeStyle = "#d9c48a";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-15, 3);
      ctx.lineTo(17, 9);
      ctx.moveTo(-17, 10);
      ctx.lineTo(13, -3);
      ctx.stroke();
    } else if (id === "wine") {
      ctx.fillStyle = "#a3682c";
      ctx.beginPath();
      ctx.ellipse(0, 10, 16, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -12, 9, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-5, -18, 10, 12);
      ctx.strokeStyle = "#7c4a1e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 10, 16, 15, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -12, 9, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#8a5a28";
      ctx.beginPath();
      ctx.ellipse(0, -21, 4.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c3272b";
      ctx.fillRect(-10, -4, 20, 9);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0.5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c3272b";
      ctx.beginPath();
      ctx.arc(0, 0.5, 0.9, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === "ai") {
      var cols = ["#4a7c59", "#5a8f4e", "#6b9e5a", "#5a8f4e", "#4a7c59"];
      var angs = [-0.55, -0.28, 0, 0.28, 0.55];
      for (i = 0; i < 5; i++) {
        a = angs[i];
        var tx = Math.sin(a) * 30;
        var ty = 14 - Math.cos(a) * 38;
        var px = Math.cos(a) * 4;
        var py = Math.sin(a) * 4;
        ctx.beginPath();
        ctx.moveTo(0, 16);
        ctx.quadraticCurveTo(tx * 0.5 - px * 1.7, ty * 0.5 + 9, tx, ty);
        ctx.quadraticCurveTo(tx * 0.5 + px * 1.7, ty * 0.5 + 9, 0, 16);
        ctx.closePath();
        ctx.fillStyle = cols[i];
        ctx.fill();
      }
      ctx.fillStyle = "#b08a5a";
      ctx.fillRect(-10, 9, 20, 7);
      ctx.strokeStyle = "#8a6a42";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-10, 12.5);
      ctx.lineTo(10, 12.5);
      ctx.stroke();
    } else if (id === "changpu") {
      ctx.fillStyle = "#3f7d4e";
      ctx.beginPath();
      ctx.moveTo(-3, 22);
      ctx.quadraticCurveTo(-4.5, -8, 0, -30);
      ctx.quadraticCurveTo(4.5, -8, 3, 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#4a7c59";
      ctx.beginPath();
      ctx.moveTo(-13, 22);
      ctx.quadraticCurveTo(-17, -2, -13, -23);
      ctx.quadraticCurveTo(-8, -2, -6, 22);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(13, 22);
      ctx.quadraticCurveTo(17, -2, 13, -23);
      ctx.quadraticCurveTo(8, -2, 6, 22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(0, -24);
      ctx.stroke();
    } else if (id === "wusai") {
      ctx.strokeStyle = "#d8d3c8";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();
      var wcols = ["#3aa6a0", "#f5f2ea", "#c3272b", "#2b2b2b", "#e8b64c"];
      for (i = 0; i < 5; i++) {
        ctx.strokeStyle = wcols[i];
        ctx.lineWidth = 6.5;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.arc(0, 0, 16, -Math.PI / 2 + i * Math.PI * 2 / 5, -Math.PI / 2 + (i + 1) * Math.PI * 2 / 5);
        ctx.stroke();
      }
      ctx.fillStyle = "#c3272b";
      ctx.beginPath();
      ctx.arc(0, -16, 3.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === "wudu") {
      ctx.fillStyle = "#f2d16b";
      ctx.fillRect(-16, -22, 32, 44);
      ctx.strokeStyle = "#d8b13e";
      ctx.lineWidth = 2;
      ctx.strokeRect(-16, -22, 32, 44);
      ctx.fillStyle = "#e0bd55";
      ctx.beginPath();
      ctx.moveTo(16, -22);
      ctx.lineTo(6, -22);
      ctx.lineTo(16, -12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#c3272b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-6, -15);
      ctx.bezierCurveTo(7, -11, -8, -3, 4, 1);
      ctx.bezierCurveTo(-6, 5, 5, 7, -1, 10);
      ctx.stroke();
      ctx.fillStyle = "rgba(195,39,43,0.85)";
      ctx.fillRect(-6, 13, 12, 7);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-4, 14.8, 8, 3.4);
    } else if (id === "xiangnang") {
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.bezierCurveTo(-21, -4, -20, 16, 0, 20);
      ctx.bezierCurveTo(20, 16, 21, -4, 4, -10);
      ctx.closePath();
      ctx.fillStyle = "#d95a6e";
      ctx.fill();
      ctx.strokeStyle = "#b03a52";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(0, -19);
      ctx.lineTo(4, -10);
      ctx.closePath();
      ctx.fillStyle = "#d95a6e";
      ctx.fill();
      ctx.fillStyle = "#e8b64c";
      ctx.beginPath();
      ctx.ellipse(0, -10, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c9922e";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = "#e8b64c";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-4, 2);
      ctx.quadraticCurveTo(0, 6, 4, 2);
      ctx.stroke();
      ctx.fillStyle = "#e8b64c";
      ctx.beginPath();
      ctx.arc(0, 23, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c3272b";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 25);
      ctx.lineTo(-4, 34);
      ctx.moveTo(0, 25);
      ctx.lineTo(0, 35);
      ctx.moveTo(0, 25);
      ctx.lineTo(4, 34);
      ctx.stroke();
    } else if (id === "ling") {
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#FFB61E";
      ctx.fillStyle = "#e8b64c";
      ctx.beginPath();
      ctx.arc(0, -2, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#c9922e";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(176,127,34,0.8)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -2, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#b07f22";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, -2, 10.5, -0.7, 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(2.5, -4, 5.5, 2.1, 4.7);
      ctx.stroke();
      ctx.fillStyle = "#b07f22";
      ctx.beginPath();
      ctx.arc(-4, -8, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c3272b";
      ctx.beginPath();
      ctx.arc(0, 20, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c3272b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(-5, 33);
      ctx.moveTo(0, 22);
      ctx.lineTo(0, 35);
      ctx.moveTo(0, 22);
      ctx.lineTo(5, 33);
      ctx.stroke();
    }
    ctx.restore();
  }

  window.LZSprites = { boat: boat, obstacle: obstacle, pickup: pickup };
})();
