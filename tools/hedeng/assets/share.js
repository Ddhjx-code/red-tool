(function () {
  var INK = "#1c2733";
  var GOLD = "#e8d5a3";
  var RED = "#C3272B";
  var KAITI = '"Kaiti SC","STKaiti","KaiTi",serif';
  var CARD_IMGS = {};
  var cardTainted = false;
  ["lotus", "boat", "peach"].forEach(function (n) {
    var im = new Image();
    im.src = "./assets/img/" + n + ".webp";
    CARD_IMGS[n] = im;
  });

  function drawCardLantern(g, shape, x, y, s) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    var glow = g.createRadialGradient(0, -8, 4, 0, -8, 90);
    glow.addColorStop(0, "rgba(255,190,90,0.4)");
    glow.addColorStop(1, "rgba(255,190,90,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, -8, 90, 0, Math.PI * 2);
    g.fill();
    var img = cardTainted ? null : CARD_IMGS[shape];
    if (img && img.complete && img.naturalWidth > 0) {
      var sz = 150;
      g.drawImage(img, -sz / 2, -sz / 2 - 6, sz, sz);
      g.fillStyle = "rgba(255,230,150,0.9)";
      g.beginPath();
      g.moveTo(-6, -34);
      g.quadraticCurveTo(0, -70, 6, -34);
      g.closePath();
      g.fill();
      g.restore();
      return;
    }
    if (shape === "lotus") {
      g.fillStyle = "#d98d96";
      for (var i = -2; i <= 2; i++) {
        g.beginPath();
        g.ellipse(i * 16, 8, 14, 26, i * 0.35, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#e8b4b8";
      g.beginPath();
      g.ellipse(0, 0, 18, 27, 0, 0, Math.PI * 2);
      g.fill();
    } else if (shape === "boat") {
      g.fillStyle = "#c9a86a";
      g.beginPath();
      g.moveTo(-44, 4);
      g.quadraticCurveTo(0, 30, 44, 4);
      g.lineTo(33, -8);
      g.quadraticCurveTo(0, 8, -33, -8);
      g.closePath();
      g.fill();
      g.fillStyle = "#e8d5a3";
      g.fillRect(-4, -30, 8, 26);
    } else {
      g.fillStyle = "#e8a868";
      g.beginPath();
      g.arc(-11, 0, 22, 0, Math.PI * 2);
      g.arc(11, 0, 22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#7a9a6a";
      g.beginPath();
      g.ellipse(0, -24, 13, 7, -0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "rgba(255,220,130,0.95)";
    g.beginPath();
    g.moveTo(-7, -14);
    g.quadraticCurveTo(0, -52, 7, -14);
    g.closePath();
    g.fill();
    g.restore();
  }

  function wrapVertical(text, per) {
    var lines = [], line = "";
    for (var i = 0; i < text.length; i++) {
      line += text.charAt(i);
      if (line.length >= per) { lines.push(line); line = ""; }
    }
    if (line) lines.push(line);
    return lines;
  }

  function paintCard(st) {
    st = st || {};
    var c = document.createElement("canvas");
    c.width = 900; c.height = 1200;
    var g = c.getContext("2d");

    var bg = g.createLinearGradient(0, 0, 0, 1200);
    bg.addColorStop(0, "#0d1420");
    bg.addColorStop(0.45, "#1c2733");
    bg.addColorStop(1, "#0f1620");
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);

    g.fillStyle = "#d6ecf0";
    g.beginPath();
    g.arc(700, 150, 34, 0, Math.PI * 2);
    g.fill();
    var halo = g.createRadialGradient(700, 150, 10, 700, 150, 130);
    halo.addColorStop(0, "rgba(214,236,240,0.35)");
    halo.addColorStop(1, "rgba(214,236,240,0)");
    g.fillStyle = halo;
    g.beginPath();
    g.arc(700, 150, 130, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(214,236,240,0.14)";
    g.lineWidth = 2;
    for (var i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(60, 560 + i * 46);
      g.bezierCurveTo(300, 566 + i * 46, 600, 554 + i * 46, 840, 560 + i * 46);
      g.stroke();
    }

    drawCardLantern(g, st.shape || "lotus", 450, 430, 2.4);

    g.textAlign = "center";
    g.fillStyle = GOLD;
    g.font = "44px " + KAITI;
    g.fillText("一盏河灯", 450, 120);
    g.font = "26px " + KAITI;
    g.fillStyle = "rgba(232,213,163,0.7)";
    g.fillText("中元 · " + (st.recipientName || ""), 450, 168);

    var msg = st.message || "";
    if (msg) {
      var lines = wrapVertical(msg, 14);
      if (lines.length > 3) lines = lines.slice(0, 3);
      g.font = "34px " + KAITI;
      g.fillStyle = "#f5f0e6";
      var startX = 450 + (lines.length - 1) * 30;
      for (var l = 0; l < lines.length; l++) {
        var chars = lines[l].split("");
        for (var ch = 0; ch < chars.length; ch++) {
          g.fillText(chars[ch], startX - l * 60, 660 + ch * 46);
        }
      }
    }

    g.save();
    g.translate(770, 950);
    g.rotate(-6 * Math.PI / 180);
    g.fillStyle = RED;
    g.fillRect(-58, -58, 116, 116);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 3;
    g.strokeRect(-48, -48, 96, 96);
    g.fillStyle = "#fff";
    g.font = "40px " + KAITI;
    g.textAlign = "center";
    g.textBaseline = "middle";
    var gn = st.gradeName || "灯暖";
    g.fillText(gn.charAt(0), 0, -20);
    g.fillText(gn.charAt(1), 0, 24);
    g.restore();
    g.textBaseline = "alphabetic";

    g.textAlign = "center";
    g.fillStyle = "rgba(214,236,240,0.75)";
    g.font = "24px " + KAITI;
    var gradeText = st.gradeText || "";
    if (gradeText.length > 26) gradeText = gradeText.slice(0, 26) + "…";
    g.fillText(gradeText, 450, 950);

    g.fillStyle = "rgba(214,236,240,0.5)";
    g.font = "22px " + KAITI;
    g.fillText("这个中元节，灯替我说完了想说的话", 450, 1050);
    g.font = "20px " + KAITI;
    g.fillStyle = "rgba(214,236,240,0.35)";
    g.fillText("非遗手作坊 · 一盏河灯 · 灯谱 " + (st.codexCount || 0) + "/12", 450, 1150);

    try {
      return c.toDataURL("image/png");
    } catch (e) {
      if (!cardTainted) {
        cardTainted = true;
        return paintCard(st);
      }
      return null;
    }
  }

  function miniTool() { return window.xhs && window.xhs.miniTool; }
  function fallback() { alert("当前环境暂不支持直接保存，请截图保存哦"); }

  function withFile(fn) {
    var mt = miniTool();
    var st = window.HDShare.lastStats;
    if (!mt || !st) { fallback(); return; }
    var dataUrl = paintCard(st);
    if (!dataUrl) { fallback(); return; }
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) { fn(mt, res && res.filePath); },
      fail: fallback
    });
  }

  window.HDShare = {
    lastStats: null,
    paintCard: paintCard,
    saveAlbum: function () {
      withFile(function (mt, p) {
        mt.saveImageToPhotosAlbum({
          filePath: p,
          success: function () { alert("已保存到相册"); },
          fail: fallback
        });
      });
    },
    postNote: function () {
      withFile(function (mt, p) {
        mt.postNote({
          title: "这个中元节，我放了一盏河灯",
          content: "中元不是鬼节，是思念的节日。灯一入水，皆是人间未说完的话。",
          tags: "#国风vibecoding #中元节 #河灯 #国风 #中式美学 #传统文化",
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
