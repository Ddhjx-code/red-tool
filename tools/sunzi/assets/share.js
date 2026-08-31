(function () {
  var RED = "#C3272B";
  var INK = "#425066";
  var PAPER = "#F5F0E6";
  var GOLD = "#FFB61E";
  var BAMBOO = "#ECE5D5";
  var KAITI = '"Kaiti SC","STKaiti","KaiTi",serif';
  var CLOSE_P = "，。！？；：、）》」』…～·,.!?;:)]}";
  var OPEN_P = "（《「『([{";

  function str(v) { return v == null ? "" : String(v); }

  function wrapText(text, per) {
    var lines = [], line = "", i, nx;
    for (i = 0; i < text.length; i++) {
      line += text.charAt(i);
      if (line.length >= per) {
        if (OPEN_P.indexOf(text.charAt(i)) >= 0) continue;
        nx = i + 1 < text.length ? text.charAt(i + 1) : "";
        if (nx && CLOSE_P.indexOf(nx) >= 0) { line += nx; i++; }
        lines.push(line);
        line = "";
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function paintCard(st) {
    st = st || {};
    var c = document.createElement("canvas");
    c.width = 900;
    c.height = 1200;
    var g = c.getContext("2d");
    var i;

    g.fillStyle = PAPER;
    g.fillRect(0, 0, 900, 1200);
    g.strokeStyle = RED;
    g.lineWidth = 6;
    g.strokeRect(24, 24, 852, 1152);
    g.lineWidth = 2;
    g.strokeRect(40, 40, 820, 1120);

    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = INK;
    g.font = "30px " + KAITI;
    g.fillText("非遗手作坊 · 孙子兵法战棋", 450, 104);

    g.fillStyle = INK;
    g.font = "76px " + KAITI;
    g.fillText(str(st.chapterName), 450, 230);
    g.fillStyle = RED;
    g.font = "34px " + KAITI;
    g.fillText(str(st.motto), 450, 290);

    g.fillStyle = st.win ? RED : INK;
    g.font = "64px " + KAITI;
    g.fillText(str(st.title), 450, 420);

    if (st.win) {
      g.fillStyle = GOLD;
      g.font = "44px " + KAITI;
      var stars = "★".repeat(st.stars || 0) + "☆".repeat(3 - (st.stars || 0));
      g.fillText(stars, 450, 486);
    }

    g.fillStyle = INK;
    g.font = "28px " + KAITI;
    g.fillText(str(st.statsLine), 450, st.win ? 546 : 500);

    var qy = st.win ? 600 : 556;
    g.fillStyle = BAMBOO;
    g.fillRect(120, qy, 660, 250);
    g.strokeStyle = "rgba(120,96,60,0.5)";
    g.lineWidth = 2;
    g.strokeRect(120, qy, 660, 250);
    g.fillStyle = "#B08D57";
    g.fillRect(120, qy, 14, 250);
    var lines = wrapText(str(st.quoteText), 17);
    if (lines.length > 4) lines = lines.slice(0, 4);
    g.fillStyle = INK;
    g.font = "30px " + KAITI;
    for (i = 0; i < lines.length; i++) g.fillText(lines[i], 450, qy + 62 + i * 46);
    g.fillStyle = RED;
    g.font = "24px " + KAITI;
    g.fillText(str(st.quoteSrc), 450, qy + 62 + lines.length * 46 + 8);

    g.save();
    g.translate(450, 960);
    g.rotate(-6 * Math.PI / 180);
    g.fillStyle = st.win ? RED : INK;
    g.fillRect(-60, -60, 120, 120);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 3;
    g.strokeRect(-50, -50, 100, 100);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "44px " + KAITI;
    var seal = st.win ? "释读" : "再演";
    g.fillText(seal.charAt(0), 0, -22);
    g.fillText(seal.charAt(1), 0, 26);
    g.restore();

    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = INK;
    g.font = "24px " + KAITI;
    g.fillText("释读 " + str(st.decoded) + "/" + str(st.total) + " · 银雀山汉墓竹简 · 山东省博物馆藏", 450, 1150);

    return c.toDataURL("image/png");
  }

  function miniTool() { return window.xhs && window.xhs.miniTool; }

  function fallback() { alert("当前环境暂不支持直接保存，请截图保存哦"); }

  function withFile(fn) {
    var mt = miniTool();
    var st = window.SZShare.lastStats;
    if (!mt || !st) { fallback(); return; }
    var dataUrl = paintCard(st);
    if (!dataUrl) { fallback(); return; }
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) { fn(mt, res && res.filePath); },
      fail: fallback
    });
  }

  window.SZShare = {
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
          title: "我在银雀山竹简里打了一场战棋",
          content: "以战棋演武，释读孙子兵法。" + str(window.SZShare.lastStats && window.SZShare.lastStats.chapterName) + "，" + str(window.SZShare.lastStats && window.SZShare.lastStats.title) + "。",
          tags: "#国风vibecoding #孙子兵法 #国风 #中式美学 #传统文化 #战棋",
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
