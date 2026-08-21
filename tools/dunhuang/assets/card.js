(function () {
  var W = 900, H = 1200;
  var BG = { paper: "#F5F0E6", silk: "#EFE6D2", night: "#2E3D52" };
  var RED = "#C3272B";
  var KAI = '"Kaiti SC", "STKaiti", "KaiTi", serif';

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
  }

  function spaced(g, text, cx, y, sp) {
    var ws = [], tot = 0, x, j;
    for (j = 0; j < text.length; j++) {
      ws.push(g.measureText(text[j]).width);
      tot += ws[j];
    }
    tot += sp * Math.max(0, text.length - 1);
    x = cx - tot / 2;
    for (j = 0; j < text.length; j++) {
      g.fillText(text[j], x + ws[j] / 2, y);
      x += ws[j] + sp;
    }
  }

  function grain(g, night) {
    var rnd = window.DHRng(11), j, x, y, r;
    if (night) {
      g.fillStyle = "#D6ECF0";
      for (j = 0; j < 150; j++) {
        x = rnd.range(0, W);
        y = rnd.range(0, H);
        r = rnd.range(0.4, 1.5);
        g.globalAlpha = rnd.range(0.05, 0.13);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.fillStyle = "#425066";
      for (j = 0; j < 1500; j++) {
        x = rnd.range(0, W);
        y = rnd.range(0, H);
        r = rnd.range(0.4, 1.1);
        g.globalAlpha = rnd.range(0.025, 0.045);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  function frame(g) {
    g.strokeStyle = RED;
    g.lineWidth = 6;
    g.strokeRect(27, 27, W - 54, H - 54);
    g.lineWidth = 2;
    g.strokeRect(41, 41, W - 82, H - 82);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(74, 40); g.lineTo(40, 40); g.lineTo(40, 74);
    g.moveTo(W - 74, 40); g.lineTo(W - 40, 40); g.lineTo(W - 40, 74);
    g.moveTo(74, H - 40); g.lineTo(40, H - 40); g.lineTo(40, H - 74);
    g.moveTo(W - 74, H - 40); g.lineTo(W - 40, H - 40); g.lineTo(W - 40, H - 74);
    g.stroke();
  }

  function header(g, title, subtitle, ink, accent) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = ink;
    g.font = "700 72px " + KAI;
    spaced(g, title, W / 2, 136, 20);
    g.fillStyle = accent;
    g.font = "26px " + KAI;
    spaced(g, subtitle, W / 2, 212, 8);
    g.save();
    g.globalAlpha = 0.7;
    g.strokeStyle = RED;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(W / 2 - 141, 254); g.lineTo(W / 2 - 21, 254);
    g.moveTo(W / 2 + 21, 254); g.lineTo(W / 2 + 141, 254);
    g.stroke();
    g.fillStyle = RED;
    g.translate(W / 2, 254);
    g.rotate(Math.PI / 4);
    g.fillRect(-5, -5, 10, 10);
    g.restore();
  }

  function seal(g, cx, cy, size) {
    var s2 = size / 2;
    g.save();
    g.translate(cx, cy);
    g.rotate(-6 * Math.PI / 180);
    g.shadowColor = "rgba(195,39,43,0.35)";
    g.shadowBlur = 14;
    g.shadowOffsetY = 4;
    g.fillStyle = RED;
    g.fillRect(-s2, -s2, size, size);
    g.shadowColor = "transparent";
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
    g.strokeStyle = "rgba(255,255,255,0.4)";
    g.lineWidth = 3;
    g.strokeRect(-s2 + 5, -s2 + 5, size - 10, size - 10);
    g.fillStyle = "#FFFFFF";
    g.font = "700 34px " + KAI;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("敦", 0, -19);
    g.fillText("煌", 0, 19);
    g.restore();
  }

  function bandShadow(g) {
    g.shadowColor = "rgba(66,80,102,0.18)";
    g.shadowBlur = 18;
    g.shadowOffsetY = 6;
  }

  function noShadow(g) {
    g.shadowColor = "transparent";
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
  }

  function scrollLayout(g, colors, ink, source) {
    var n = colors.length, bw = 112, bh = 470, top = 320;
    var gap, total, x0, i, j, x, nm, y0;
    while (n < 3) { colors.push(colors[n % colors.length]); n = colors.length; }
    if (n > 6) { colors = colors.slice(0, 6); n = 6; }
    gap = Math.min(38, (780 - n * bw) / Math.max(1, n - 1));
    total = n * bw + (n - 1) * gap;
    x0 = (W - total) / 2;
    for (i = 0; i < n; i++) {
      x = x0 + i * (bw + gap);
      bandShadow(g);
      g.fillStyle = colors[i].hex;
      rr(g, x, top, bw, bh, 6);
      g.fill();
      noShadow(g);
      g.strokeStyle = "rgba(255,255,255,0.14)";
      g.lineWidth = 2;
      rr(g, x + 1.5, top + 1.5, bw - 3, bh - 3, 5);
      g.stroke();
      nm = colors[i].name;
      g.fillStyle = ink;
      g.font = "27px " + KAI;
      g.textAlign = "center";
      g.textBaseline = "middle";
      y0 = top + bh + 22 + 16;
      for (j = 0; j < nm.length; j++) {
        g.fillText(nm[j], x + bw / 2, y0 + j * 36);
      }
    }
    g.fillStyle = ink;
    g.font = "23px " + KAI;
    spaced(g, source, W / 2, 990, 4);
    seal(g, W / 2, 1066, 96);
  }

  function zaojingLayout(g, colors, ink, source) {
    var list = colors.slice(0, 6), i;
    var sizes = [600, 424, 300, 212, 150];
    var cx = W / 2, cy = 600, layers, s, tw, total, startX, x0;
    while (list.length < 5) list.push(colors[list.length % colors.length]);
    layers = list.length >= 6 ? 6 : 5;
    for (i = 0; i < 5 && i < layers; i++) {
      s = sizes[i];
      g.save();
      g.translate(cx, cy);
      if (i % 2 === 1) g.rotate(Math.PI / 4);
      bandShadow(g);
      g.fillStyle = list[i].hex;
      g.fillRect(-s / 2, -s / 2, s, s);
      g.restore();
      noShadow(g);
    }
    if (layers === 6) {
      bandShadow(g);
      g.fillStyle = list[5].hex;
      g.beginPath();
      g.arc(cx, cy, 42, 0, Math.PI * 2);
      g.fill();
      noShadow(g);
    }
    x0 = (W - (layers * 52 + (layers - 1) * 34)) / 2;
    for (i = 0; i < layers; i++) {
      g.save();
      g.shadowColor = "rgba(66,80,102,0.18)";
      g.shadowBlur = 8;
      g.shadowOffsetY = 3;
      g.fillStyle = list[i].hex;
      g.beginPath();
      g.arc(x0 + i * 86 + 26, 960, 26, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.strokeStyle = "rgba(255,255,255,0.2)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x0 + i * 86 + 26, 960, 25, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = ink;
      g.font = "24px " + KAI;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(list[i].name, x0 + i * 86 + 26, 1010);
    }
    g.font = "23px " + KAI;
    tw = 0;
    for (i = 0; i < source.length; i++) tw += g.measureText(source[i]).width;
    tw += 4 * Math.max(0, source.length - 1);
    total = tw + 30 + 96;
    startX = (W - total) / 2;
    g.fillStyle = ink;
    spaced(g, source, startX + tw / 2, 1080, 4);
    seal(g, startX + tw + 30 + 48, 1080, 96);
  }

  function paint(opts) {
    var cv = document.createElement("canvas");
    var g, bg, night, ink, accent, colors;
    cv.width = W;
    cv.height = H;
    g = cv.getContext("2d");
    opts = opts || {};
    bg = BG[opts.bg] ? opts.bg : "paper";
    night = bg === "night";
    ink = night ? "#D6ECF0" : "#425066";
    accent = night ? "#FFB61E" : "#8A6A4A";
    colors = (opts.colors instanceof Array) ? opts.colors.slice(0) : [];
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = BG[bg];
    g.fillRect(0, 0, W, H);
    grain(g, night);
    frame(g);
    header(g, opts.title || "", opts.source || "", ink, accent);
    if (colors.length) {
      if (opts.layout === "zaojing") {
        zaojingLayout(g, colors, ink, opts.source || "");
      } else {
        scrollLayout(g, colors, ink, opts.source || "");
      }
    }
    return cv.toDataURL("image/png");
  }

  window.DHCard = { paint: paint };
})();
