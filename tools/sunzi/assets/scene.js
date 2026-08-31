(function () {
  var D = window.SZData, B = window.SZBoard;
  var KAITI = '"Kaiti SC", "STKaiti", "KaiTi", serif';
  var INK = "#425066", VERM = "#C3272B", GOLD = "#FFB61E", PAPER = "#F5F0E6";

  var IMGS = {};
  ["inf", "arch", "cav", "heavy", "earc", "flag"].forEach(function (n) {
    var im = new Image();
    im.src = "./assets/img/" + n + ".webp";
    IMGS[n] = im;
  });

  function draw(ctx, S, ui) {
    var cs = ui.cell, pad = ui.pad;
    var W = pad * 2 + cs * D.COLS, H = pad * 2 + cs * D.ROWS;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(66,80,102,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(pad - 6, pad - 6, cs * D.COLS + 12, cs * D.ROWS + 12);
    ctx.strokeStyle = "rgba(66,80,102,0.18)";
    ctx.lineWidth = 1;
    for (var c = 0; c <= D.COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(pad + c * cs, pad);
      ctx.lineTo(pad + c * cs, pad + D.ROWS * cs);
      ctx.stroke();
    }
    for (var r = 0; r <= D.ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(pad, pad + r * cs);
      ctx.lineTo(pad + D.COLS * cs, pad + r * cs);
      ctx.stroke();
    }

    S.forest.forEach(function (k) {
      var p = k.split(",");
      drawForest(ctx, pad + (+p[0]) * cs, pad + (+p[1]) * cs, cs);
    });
    S.reed.forEach(function (k) {
      var p = k.split(",");
      drawReed(ctx, pad + (+p[0]) * cs, pad + (+p[1]) * cs, cs);
    });
    Object.keys(S.scorched).forEach(function (k) {
      var p = k.split(",");
      drawScorched(ctx, pad + (+p[0]) * cs, pad + (+p[1]) * cs, cs);
    });
    Object.keys(S.fire).forEach(function (k) {
      var p = k.split(",");
      drawFire(ctx, pad + (+p[0]) * cs, pad + (+p[1]) * cs, cs);
    });

    if (ui.moveCells) {
      ctx.fillStyle = "rgba(214,236,240,0.55)";
      ui.moveCells.forEach(function (m) {
        ctx.fillRect(pad + m.col * cs + 2, pad + m.row * cs + 2, cs - 4, cs - 4);
      });
    }
    if (ui.igniteCells) {
      var fl = 0.5 + 0.3 * Math.sin(Date.now() / 220);
      ctx.fillStyle = "rgba(255,140,30," + (0.25 + 0.2 * fl) + ")";
      ui.igniteCells.forEach(function (m) {
        ctx.fillRect(pad + m.col * cs + 2, pad + m.row * cs + 2, cs - 4, cs - 4);
        ctx.strokeStyle = "rgba(220,90,20,0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(pad + m.col * cs + 3, pad + m.row * cs + 3, cs - 6, cs - 6);
      });
    }

    drawIntents(ctx, S, cs, pad);

    if (ui.attackMap) {
      for (var id in ui.attackMap) {
        var v = findUnit(S, id);
        if (!v) continue;
        var cx = pad + v.col * cs + cs / 2, cy = pad + v.row * cs + cs / 2;
        ctx.strokeStyle = VERM;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, cs * 0.42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        badge(ctx, cx + cs * 0.3, cy - cs * 0.34, "-" + ui.attackMap[id], VERM);
      }
    }

    S.units.forEach(function (u) { drawUnit(ctx, u, cs, pad, S.selected === u.id); });

    var nowT = Date.now();
    S.fx = S.fx.filter(function (f) { return nowT - f.t0 < 1100; });
    S.fx.forEach(function (f) {
      var age = (nowT - f.t0) / 1100;
      var x = pad + f.col * cs + cs / 2, y = pad + f.row * cs + cs / 2;
      if (f.kind === "dmg") {
        var charge = f.tier === "charge";
        ctx.globalAlpha = 1 - age;
        ctx.font = "bold " + Math.round(cs * (charge ? 0.46 : 0.34)) + "px " + KAITI;
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(245,240,230,0.9)";
        var dy = y - cs * 0.3 - age * cs * (charge ? 0.7 : 0.5);
        ctx.strokeText(f.text, x, dy);
        ctx.fillStyle = charge ? GOLD : (f.side === "P" ? VERM : "#7a2c22");
        ctx.fillText(f.text, x, dy);
        ctx.globalAlpha = 1;
      } else if (f.kind === "dead" || f.kind === "ignite") {
        ctx.globalAlpha = (1 - age) * 0.6;
        ctx.fillStyle = f.kind === "ignite" ? "#e06420" : INK;
        ctx.beginPath();
        ctx.arc(x, y, cs * (0.2 + age * 0.45), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.kind === "spawn") {
        ctx.globalAlpha = (1 - age) * 0.9;
        ctx.strokeStyle = VERM;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, cs * (0.55 - age * 0.25), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.kind === "surrender") {
        ctx.globalAlpha = 1 - age;
        ctx.font = "bold " + Math.round(cs * 0.4) + "px " + KAITI;
        ctx.textAlign = "center";
        ctx.fillStyle = GOLD;
        ctx.fillText("降", x, y - age * cs * 0.6);
        ctx.globalAlpha = 1;
      }
    });
  }

  function findUnit(S, id) {
    for (var i = 0; i < S.units.length; i++) if (S.units[i].id === id) return S.units[i];
    return null;
  }

  function drawForest(ctx, x, y, cs) {
    ctx.fillStyle = "rgba(90,120,90,0.28)";
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
    ctx.fillStyle = "rgba(60,95,70,0.75)";
    var cx = x + cs / 2, cy = y + cs / 2, rr = cs * 0.16;
    [[-0.18, -0.1], [0.16, -0.16], [0, 0.14]].forEach(function (o) {
      ctx.beginPath();
      ctx.moveTo(cx + o[0] * cs, cy + o[1] * cs - rr);
      ctx.lineTo(cx + o[0] * cs - rr * 0.9, cy + o[1] * cs + rr * 0.8);
      ctx.lineTo(cx + o[0] * cs + rr * 0.9, cy + o[1] * cs + rr * 0.8);
      ctx.closePath();
      ctx.fill();
    });
  }

  function drawReed(ctx, x, y, cs) {
    ctx.fillStyle = "rgba(214,190,120,0.4)";
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
    ctx.strokeStyle = "rgba(160,130,60,0.85)";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    var bx = x + cs / 2, by = y + cs * 0.78;
    [[-0.22, -0.3], [-0.08, -0.42], [0.06, -0.38], [0.2, -0.28]].forEach(function (o) {
      ctx.beginPath();
      ctx.moveTo(bx + o[0] * cs * 0.5, by);
      ctx.quadraticCurveTo(bx + o[0] * cs, by + o[1] * cs * 0.7, bx + o[0] * cs * 1.4, by + o[1] * cs);
      ctx.stroke();
    });
  }

  function drawScorched(ctx, x, y, cs) {
    ctx.fillStyle = "rgba(50,42,38,0.75)";
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
    ctx.strokeStyle = "rgba(20,16,14,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + cs * 0.25, y + cs * 0.7);
    ctx.lineTo(x + cs * 0.45, y + cs * 0.35);
    ctx.moveTo(x + cs * 0.6, y + cs * 0.72);
    ctx.lineTo(x + cs * 0.72, y + cs * 0.4);
    ctx.stroke();
  }

  function drawFire(ctx, x, y, cs) {
    var t = Date.now() / 160;
    var cx = x + cs / 2, cy = y + cs / 2;
    for (var i = 0; i < 3; i++) {
      var ph = Math.sin(t + i * 2.1) * 0.5 + 0.5;
      var fx = cx + Math.sin(t * 0.7 + i * 2.4) * cs * 0.16;
      var h = cs * (0.3 + 0.25 * ph);
      ctx.fillStyle = i === 1 ? "rgba(255,180,60,0.9)" : "rgba(230,80,30,0.75)";
      ctx.beginPath();
      ctx.moveTo(fx - cs * 0.13, cy + cs * 0.22);
      ctx.quadraticCurveTo(fx - cs * 0.16, cy - h * 0.3, fx, cy - h);
      ctx.quadraticCurveTo(fx + cs * 0.16, cy - h * 0.3, fx + cs * 0.13, cy + cs * 0.22);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawIntents(ctx, S, cs, pad) {
    var pulse = 0.7 + 0.3 * Math.sin(Date.now() / 280);
    S.intents.forEach(function (it) {
      var u = findUnit(S, it.unitId);
      if (!u) return;
      var ux = pad + u.col * cs + cs / 2, uy = pad + u.row * cs + cs / 2;
      if (it.moveTo) {
        var mx = pad + it.moveTo.col * cs + cs / 2, my = pad + it.moveTo.row * cs + cs / 2;
        ctx.strokeStyle = "rgba(195,39,43,0.5)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(pad + it.moveTo.col * cs + 4, pad + it.moveTo.row * cs + 4, cs - 8, cs - 8);
        arrow(ctx, ux, uy, mx, my, "rgba(195,39,43,0.5)", 1.5, true);
        ctx.setLineDash([]);
      }
      if (it.attack) {
        var ax = pad + it.attack.cell.col * cs + cs / 2, ay = pad + it.attack.cell.row * cs + cs / 2;
        var sx = it.moveTo ? pad + it.moveTo.col * cs + cs / 2 : ux;
        var sy = it.moveTo ? pad + it.moveTo.row * cs + cs / 2 : uy;
        arrow(ctx, sx, sy, ax, ay, "rgba(195,39,43," + (0.55 + 0.45 * pulse).toFixed(2) + ")", 2.5, false);
        badge(ctx, ax + cs * 0.3, ay - cs * 0.32, "-" + it.attack.dmg, VERM);
      }
    });
  }

  function arrow(ctx, x0, y0, x1, y1, color, w, dashed) {
    var dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ex = x1 - dx / len * 12, ey = y1 - dy / len * 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    if (dashed) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    var ang = Math.atan2(dy, dx);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 10 * Math.cos(ang - 0.4), y1 - 10 * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - 10 * Math.cos(ang + 0.4), y1 - 10 * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  function badge(ctx, x, y, text, color) {
    ctx.font = "bold 13px " + KAITI;
    var w = ctx.measureText(text).width + 10;
    ctx.fillStyle = color;
    roundRect(ctx, x - w / 2, y - 9, w, 18, 9);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + 1);
    ctx.textBaseline = "alphabetic";
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawUnit(ctx, u, cs, pad, selected) {
    var t = D.types[u.type];
    var cx = pad + u.col * cs + cs / 2, cy = pad + u.row * cs + cs / 2;
    ctx.globalAlpha = (u.side === "P" && u.done) ? 0.45 : 1;

    if (selected) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      roundRect(ctx, pad + u.col * cs + 2.5, pad + u.row * cs + 2.5, cs - 5, cs - 5, 8);
      ctx.stroke();
    }

    var img = IMGS[u.type];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.fillStyle = "rgba(66,80,102,0.22)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + cs * 0.34, cs * 0.3, cs * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      var h = cs * 0.98, w = h;
      ctx.drawImage(img, cx - w / 2, cy - h / 2 - cs * 0.08, w, h);
    } else {
      var rad = cs * 0.36;
      ctx.fillStyle = u.type === "flag" ? GOLD : (u.side === "P" ? INK : VERM);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      window.SZSprites.pictogram(ctx, u.type, cx, cy, rad, u.type === "flag" ? "#5a3a00" : "#fff");
    }

    var maxHp = t.hp, hp = u.hp;
    var pw = cs * 0.6, ph = 4;
    var px = cx - pw / 2, py = cy + cs * 0.38;
    ctx.fillStyle = "rgba(66,80,102,0.25)";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = hp / maxHp > 0.5 ? "#5c8a58" : (hp / maxHp > 0.25 ? GOLD : VERM);
    ctx.fillRect(px, py, pw * Math.max(0, hp / maxHp), ph);

    if (u.morale !== null && u.morale !== undefined && u.side === "E") {
      var mx0 = cx - (u.morale * 7 - 2) / 2;
      for (var m = 0; m < u.morale; m++) {
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(mx0 + m * 7, cy - cs * 0.46, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  window.SZScene = { draw: draw };
})();
