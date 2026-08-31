(function () {
  var RED = "#C3272B";
  var GOLD = "#e8d5a3";
  var KAITI = '"Kaiti SC","STKaiti","KaiTi",serif';

  function paintCard(st) {
    st = st || {};
    var c = document.createElement("canvas");
    c.width = 900; c.height = 1200;
    var g = c.getContext("2d");

    var bg = g.createLinearGradient(0, 0, 0, 1200);
    bg.addColorStop(0, "#0a0d14");
    bg.addColorStop(0.6, "#131824");
    bg.addColorStop(1, "#0a0d14");
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);

    g.fillStyle = "rgba(214,236,240,0.9)";
    g.beginPath();
    g.arc(720, 130, 26, 0, Math.PI * 2);
    g.fill();
    var halo = g.createRadialGradient(720, 130, 8, 720, 130, 110);
    halo.addColorStop(0, "rgba(214,236,240,0.25)");
    halo.addColorStop(1, "rgba(214,236,240,0)");
    g.fillStyle = halo;
    g.beginPath();
    g.arc(720, 130, 110, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(214,236,240,0.1)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 760);
    g.bezierCurveTo(300, 740, 600, 780, 900, 750);
    g.stroke();

    for (var i = 0; i < 5; i++) {
      var lx = 120 + i * 165;
      var on = i < (st.yang || 0);
      g.fillStyle = on ? "rgba(232,213,163,0.9)" : "rgba(214,236,240,0.12)";
      g.beginPath();
      g.arc(lx, 700, 10, 0, Math.PI * 2);
      g.fill();
      if (on) {
        var lg = g.createRadialGradient(lx, 700, 2, lx, 700, 40);
        lg.addColorStop(0, "rgba(232,213,163,0.35)");
        lg.addColorStop(1, "rgba(232,213,163,0)");
        g.fillStyle = lg;
        g.beginPath();
        g.arc(lx, 700, 40, 0, Math.PI * 2);
        g.fill();
      }
    }

    g.textAlign = "center";
    g.fillStyle = GOLD;
    g.font = "42px " + KAITI;
    g.fillText("鬼月 · 夜归路", 450, 150);
    g.font = "24px " + KAITI;
    g.fillStyle = "rgba(214,236,240,0.6)";
    g.fillText("中元夜 · 生还报告", 450, 196);

    g.font = "64px " + KAITI;
    g.fillStyle = st.lost ? RED : GOLD;
    g.fillText(st.endingName || "", 450, 420);

    g.font = "26px " + KAITI;
    g.fillStyle = "rgba(214,236,240,0.75)";
    g.fillText("守住规矩 " + (st.kept || 0) + " / 5 · 阳气余 " + (st.yang || 0) + " 盏", 450, 500);

    var txt = st.endingText || "";
    var lines = [], line = "";
    for (var j = 0; j < txt.length; j++) {
      line += txt.charAt(j);
      if (line.length >= 22) { lines.push(line); line = ""; }
    }
    if (line) lines.push(line);
    if (lines.length > 4) lines = lines.slice(0, 4);
    g.font = "26px " + KAITI;
    g.fillStyle = "#c5d2dc";
    for (var l = 0; l < lines.length; l++) {
      g.fillText(lines[l], 450, 830 + l * 46);
    }

    g.save();
    g.translate(780, 1020);
    g.rotate(-6 * Math.PI / 180);
    g.fillStyle = st.lost ? "#3a4556" : RED;
    g.fillRect(-56, -56, 112, 112);
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 3;
    g.strokeRect(-46, -46, 92, 92);
    g.fillStyle = "#fff";
    g.font = "34px " + KAITI;
    g.textBaseline = "middle";
    var seal = st.lost ? "夜未尽" : "生还";
    if (seal.length === 2) {
      g.fillText(seal.charAt(0), 0, -18);
      g.fillText(seal.charAt(1), 0, 20);
    } else {
      g.font = "28px " + KAITI;
      g.fillText(seal.charAt(0), 0, -24);
      g.fillText(seal.charAt(1), 0, 4);
      g.fillText(seal.charAt(2), 0, 32);
    }
    g.restore();
    g.textBaseline = "alphabetic";

    g.fillStyle = "rgba(214,236,240,0.4)";
    g.font = "20px " + KAITI;
    g.fillText("禁忌是民俗传说，敬畏是真的 · 非遗手作坊", 450, 1150);

    return c.toDataURL("image/png");
  }

  function miniTool() { return window.xhs && window.xhs.miniTool; }
  function fallback() { alert("当前环境暂不支持直接保存，请截图保存哦"); }

  function withFile(fn) {
    var mt = miniTool();
    var st = window.GYShare.lastStats;
    if (!mt || !st) { fallback(); return; }
    var dataUrl = paintCard(st);
    if (!dataUrl) { fallback(); return; }
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) { fn(mt, res && res.filePath); },
      fail: fallback
    });
  }

  window.GYShare = {
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
          title: "中元夜下班回家，我守住了五条老规矩",
          content: "规则怪谈版中元节：夜归路上五个选择，你敢走几条？禁忌是传说，敬畏是真的。",
          tags: "#国风vibecoding #中元节 #规则怪谈 #国风 #中式美学 #传统文化",
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
