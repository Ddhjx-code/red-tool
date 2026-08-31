(function () {
  function pictogram(ctx, type, cx, cy, r, color) {
    var s = r * 0.66;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.6, s * 0.16);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (type === "inf") drawInf(ctx, s);
    else if (type === "arch" || type === "earc") drawArch(ctx, s);
    else if (type === "cav") drawCav(ctx, s);
    else if (type === "heavy") drawHeavy(ctx, s);
    else if (type === "flag") drawFlag(ctx, s);
    ctx.restore();
  }

  function drawInf(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-0.75 * s, -0.55 * s);
    ctx.lineTo(-0.15 * s, -0.55 * s);
    ctx.lineTo(-0.15 * s, 0.75 * s);
    ctx.lineTo(-0.75 * s, 0.75 * s);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.45 * s, -0.55 * s);
    ctx.lineTo(-0.45 * s, 0.75 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.1 * s, 0.85 * s);
    ctx.lineTo(0.7 * s, -0.6 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.7 * s, -0.95 * s);
    ctx.lineTo(0.5 * s, -0.55 * s);
    ctx.lineTo(0.9 * s, -0.5 * s);
    ctx.closePath();
    ctx.fill();
  }

  function drawArch(ctx, s) {
    ctx.beginPath();
    ctx.arc(0.42 * s, 0, 0.8 * s, Math.PI * 0.68, Math.PI * 1.32);
    ctx.stroke();
    var ex = 0.42 * s + 0.8 * s * Math.cos(Math.PI * 0.68);
    var ey = 0.8 * s * Math.sin(Math.PI * 0.68);
    ctx.beginPath();
    ctx.moveTo(ex, -ey);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.35 * s, 0);
    ctx.lineTo(-0.75 * s, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.95 * s, 0);
    ctx.lineTo(-0.55 * s, -0.22 * s);
    ctx.lineTo(-0.55 * s, 0.22 * s);
    ctx.closePath();
    ctx.fill();
  }

  function drawCav(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-0.55 * s, 0.9 * s);
    ctx.quadraticCurveTo(-0.75 * s, 0.1 * s, -0.5 * s, -0.25 * s);
    ctx.lineTo(-0.15 * s, -0.5 * s);
    ctx.lineTo(0.05 * s, -0.6 * s);
    ctx.lineTo(0.2 * s, -0.95 * s);
    ctx.lineTo(0.38 * s, -0.58 * s);
    ctx.lineTo(0.85 * s, -0.32 * s);
    ctx.lineTo(0.8 * s, -0.08 * s);
    ctx.lineTo(0.35 * s, -0.05 * s);
    ctx.quadraticCurveTo(0.55 * s, 0.45 * s, 0.42 * s, 0.9 * s);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.arc(0.28 * s, -0.38 * s, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHeavy(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, -0.3 * s, 0.5 * s, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.62 * s, -0.3 * s);
    ctx.lineTo(0.62 * s, -0.3 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -0.3 * s);
    ctx.lineTo(0, 0.05 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.7 * s, 0.2 * s);
    ctx.lineTo(0.7 * s, 0.2 * s);
    ctx.lineTo(0.52 * s, 0.9 * s);
    ctx.lineTo(-0.52 * s, 0.9 * s);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0.2 * s);
    ctx.lineTo(0, 0.9 * s);
    ctx.stroke();
  }

  function drawFlag(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-0.35 * s, 0.95 * s);
    ctx.lineTo(-0.35 * s, -0.9 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-0.35 * s, -0.95 * s, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-0.35 * s, -0.85 * s);
    ctx.lineTo(0.85 * s, -0.55 * s);
    ctx.lineTo(0.5 * s, -0.3 * s);
    ctx.lineTo(0.9 * s, -0.05 * s);
    ctx.lineTo(-0.35 * s, -0.3 * s);
    ctx.closePath();
    ctx.fill();
  }

  window.SZSprites = { pictogram: pictogram };
})();
