(function () {
  var IDS = (function () {
    var out = [], i, d = window.QQData && window.QQData.SHADOWS;
    if (d && d.length) {
      for (i = 0; i < d.length; i++) { out.push(d[i].id); }
    } else {
      out = ["yun", "mudan", "xique", "jinyu", "fenghuang", "limao",
             "xiuxie", "jiandao", "yulong", "lianhua", "chui", "zhuying"];
    }
    return out;
  })();

  function ink(a) { return "rgba(20,26,38," + a + ")"; }
  function lite(a) { return "rgba(228,234,240," + a + ")"; }

  function dot(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function stick(ctx, x1, y1, x2, y2, w) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function petal(ctx, bx, by, ang, len, w) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-w, -len * 0.45, 0, -len);
    ctx.quadraticCurveTo(w, -len * 0.45, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawYun(ctx, a) {
    ctx.fillStyle = ink(a);
    ctx.beginPath();
    ctx.arc(-30, -2, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-6, -14, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(18, -5, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink(a);
    stick(ctx, -38, 14, 30, 14, 15);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(39, -2, 8, -Math.PI * 0.55, Math.PI * 0.95);
    ctx.stroke();
    ctx.fillStyle = ink(a);
    dot(ctx, 39.5, -1.5, 2.6);
  }

  function drawMudan(ctx, a) {
    var i, ang;
    ctx.fillStyle = ink(a);
    for (i = 0; i < 8; i++) {
      ang = i * Math.PI / 4 + 0.25;
      petal(ctx, Math.cos(ang) * 3, Math.sin(ang) * 3, ang + Math.PI / 2, 40, 8.5);
    }
    for (i = 0; i < 6; i++) {
      ang = i * Math.PI / 3 + 0.55;
      petal(ctx, 1.5 + Math.cos(ang) * 2, -1.5 + Math.sin(ang) * 2, ang + Math.PI / 2, 24, 7);
    }
    dot(ctx, 1, -1, 7.5);
  }

  function drawXique(ctx, a) {
    ctx.fillStyle = ink(a);
    ctx.beginPath();
    ctx.moveTo(-26, -19);
    ctx.lineTo(-36, -15.5);
    ctx.lineTo(-25, -12.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-17, -16, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(-2, 0);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(8, -7);
    ctx.quadraticCurveTo(30, -17, 48, -28);
    ctx.quadraticCurveTo(29, -3, 10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink(a);
    stick(ctx, -6, 10, -7, 20, 2.6);
    stick(ctx, 2, 10, 3, 20, 2.6);
    stick(ctx, -38, 21, 36, 17, 4.5);
    ctx.fillStyle = ink(a);
    ctx.save();
    ctx.translate(24, 19.5);
    ctx.rotate(0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(-18, 22);
    ctx.rotate(-0.45);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = lite(a * 0.5);
    dot(ctx, -19, -18, 1.7);
  }

  function drawJinyu(ctx, a) {
    ctx.fillStyle = ink(a);
    ctx.beginPath();
    ctx.moveTo(-29, -7);
    ctx.quadraticCurveTo(-19, -24, -6, -8);
    ctx.closePath();
    ctx.fill();
    petal(ctx, 0, -2, 1.07, 46, 13);
    petal(ctx, 0, 2, 2.07, 44, 12);
    ctx.save();
    ctx.translate(-19, 0);
    ctx.beginPath();
    ctx.ellipse(0, 0, 13.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = lite(a * 0.5);
    dot(ctx, -27, -3, 1.9);
  }

  function drawFenghuang(ctx, a) {
    ctx.fillStyle = ink(a);
    ctx.beginPath();
    ctx.moveTo(-29, -21);
    ctx.lineTo(-37, -18.5);
    ctx.lineTo(-28.5, -16.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-24, -20, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink(a);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-26, -26);
    ctx.quadraticCurveTo(-30, -33, -35, -36);
    ctx.moveTo(-22, -26.5);
    ctx.quadraticCurveTo(-23, -34, -27, -38);
    ctx.moveTo(-19, -25);
    ctx.quadraticCurveTo(-16, -32, -18, -37);
    ctx.stroke();
    ctx.fillStyle = ink(a);
    ctx.beginPath();
    ctx.moveTo(-28, -16);
    ctx.quadraticCurveTo(-16, -10, -10, 0);
    ctx.lineTo(-19, 6);
    ctx.quadraticCurveTo(-24, -6, -29, -12);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(-8, 6);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = ink(a);
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(3, 0);
    ctx.bezierCurveTo(20, -8, 30, -18, 46, -28);
    ctx.moveTo(5, 4);
    ctx.bezierCurveTo(24, -2, 36, -8, 48, -12);
    ctx.moveTo(4, 8);
    ctx.bezierCurveTo(22, 6, 36, 2, 47, -2);
    ctx.stroke();
    ctx.strokeStyle = lite(a * 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-9, 5, 6, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }

  function drawLimao(ctx, a) {
    ctx.fillStyle = ink(a);
    ctx.beginPath();
    ctx.moveTo(-22, -20);
    ctx.lineTo(-24, -35);
    ctx.lineTo(-13, -23);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9, -23);
    ctx.lineTo(-2, -36);
    ctx.lineTo(-2, -19);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-13, -14, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(2, 8);
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = ink(a);
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    ctx.moveTo(20, 16);
    ctx.bezierCurveTo(32, 26, 10, 34, -18, 26);
    ctx.stroke();
    ctx.strokeStyle = lite(a * 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-18, -14, 2.5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.moveTo(-5.5, -14);
    ctx.arc(-8, -14, 2.5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }

  function drawXiuxie(ctx, a) {
    ctx.fillStyle = ink(a);
    ctx.beginPath();
    ctx.moveTo(30, 24);
    ctx.quadraticCurveTo(2, 30, -22, 24);
    ctx.quadraticCurveTo(-35, 16, -39, 0);
    ctx.quadraticCurveTo(-36, -11, -22, -8);
    ctx.quadraticCurveTo(-8, -2, 3, -6);
    ctx.quadraticCurveTo(7, -8, 10, -9);
    ctx.quadraticCurveTo(15, 1, 19, 2);
    ctx.quadraticCurveTo(24, 0, 27, -7);
    ctx.quadraticCurveTo(33, 2, 30, 24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = lite(a * 0.5);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(10.5, -8);
    ctx.quadraticCurveTo(18.5, -0.5, 26.5, -6.5);
    ctx.stroke();
    ctx.fillStyle = lite(a * 0.5);
    dot(ctx, -12, 12, 2.2);
    ctx.strokeStyle = lite(a * 0.5);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(-12, 12, 4.6, Math.PI * 0.3, Math.PI * 1.1);
    ctx.stroke();
  }

  function drawJiandao(ctx, a) {
    ctx.fillStyle = ink(a);
    ctx.beginPath();
    ctx.moveTo(-30.4, -41.7);
    ctx.lineTo(-4.4, 1.3);
    ctx.lineTo(4.4, -3.3);
    ctx.lineTo(-29.6, -42.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(30.4, -41.7);
    ctx.lineTo(4.4, 1.3);
    ctx.lineTo(-4.4, -3.3);
    ctx.lineTo(29.6, -42.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink(a);
    stick(ctx, 0, -2, 13, 17, 5);
    stick(ctx, 0, -2, -13, 17, 5);
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.arc(19, 27, 8.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-19, 27, 8.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink(a);
    dot(ctx, 0, -2, 3.6);
  }

  function drawYulong(ctx, a) {
    ctx.strokeStyle = ink(a);
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(0, 4, 25, -Math.PI * 0.35, Math.PI * 0.62, true);
    ctx.stroke();
    ctx.fillStyle = ink(a);
    ctx.save();
    ctx.translate(19, -20);
    ctx.rotate(-0.25);
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = ink(a);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, -27);
    ctx.quadraticCurveTo(4, -36, -4, -38);
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(27, -22);
    ctx.quadraticCurveTo(36, -27, 41, -23);
    ctx.moveTo(27, -17);
    ctx.quadraticCurveTo(36, -14, 39, -8);
    ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-9, 12);
    ctx.lineTo(-6, 17);
    ctx.moveTo(-3, 13);
    ctx.lineTo(0, 18);
    ctx.stroke();
    ctx.fillStyle = lite(a * 0.5);
    dot(ctx, 15, -21, 1.6);
  }

  function drawLianhua(ctx, a) {
    var i;
    var angs = [-68, -45, -22.5, 0, 22.5, 45, 68];
    var lens = [34, 43, 49, 51, 49, 43, 34];
    ctx.fillStyle = ink(a);
    for (i = 0; i < 7; i++) {
      petal(ctx, 0, 14, angs[i] * Math.PI / 180, lens[i], 7.5);
    }
    dot(ctx, 0, 6, 7);
    ctx.fillStyle = lite(a * 0.5);
    dot(ctx, 0, 3.5, 1.4);
    dot(ctx, -3, 7.5, 1.4);
    dot(ctx, 3, 7.5, 1.4);
  }

  function drawChui(ctx, a) {
    ctx.fillStyle = ink(a);
    ctx.beginPath();
    ctx.moveTo(-11, -40);
    ctx.lineTo(11, -40);
    ctx.quadraticCurveTo(24, -40, 24, -27);
    ctx.lineTo(24, -21);
    ctx.quadraticCurveTo(24, -8, 11, -8);
    ctx.lineTo(-11, -8);
    ctx.quadraticCurveTo(-24, -8, -24, -21);
    ctx.lineTo(-24, -27);
    ctx.quadraticCurveTo(-24, -40, -11, -40);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.lineTo(-4.5, 30);
    ctx.arc(0, 30, 4.5, Math.PI, 0, true);
    ctx.lineTo(7, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = lite(a * 0.5);
    stick(ctx, -18, -24, 18, -24, 1.6);
  }

  function drawZhuying(ctx, a) {
    ctx.fillStyle = ink(a);
    ctx.beginPath();
    ctx.moveTo(-7, -16);
    ctx.lineTo(-10.5, 30);
    ctx.quadraticCurveTo(-10.5, 36, -4, 36);
    ctx.lineTo(4, 36);
    ctx.quadraticCurveTo(10.5, 36, 10.5, 30);
    ctx.lineTo(7, -16);
    ctx.quadraticCurveTo(0, -13, -7, -16);
    ctx.closePath();
    ctx.fill();
    dot(ctx, 8.5, -11, 2.6);
    ctx.strokeStyle = ink(a);
    stick(ctx, 0, -14, 0, -21, 2.6);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.bezierCurveTo(10, -29, -10, -36, 2, -47);
    ctx.stroke();
  }

  var SHAPES = {
    yun: drawYun,
    mudan: drawMudan,
    xique: drawXique,
    jinyu: drawJinyu,
    fenghuang: drawFenghuang,
    limao: drawLimao,
    xiuxie: drawXiuxie,
    jiandao: drawJiandao,
    yulong: drawYulong,
    lianhua: drawLianhua,
    chui: drawChui,
    zhuying: drawZhuying
  };

  window.QQShadow = {
    draw: function (ctx, id, x, y, size, alpha) {
      var fn = SHAPES[id];
      if (!fn) { return; }
      var a = alpha == null ? 1 : Math.max(0, Math.min(1, alpha));
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 100, size / 100);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      fn(ctx, a);
      ctx.restore();
    },
    ids: function () { return IDS.slice(); }
  };
})();
