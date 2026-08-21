(function () {
  var RED = "#C3272B";
  var INK = "#425066";
  var PAPER = "#F5F0E6";
  var KAITI = '"Kaiti SC","STKaiti","KaiTi",serif';
  var SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
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

  function shadowById(id) {
    var list = (window.QQData && window.QQData.SHADOWS) || [], i;
    for (i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
    return null;
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
    g.fillText("非遗手作坊 · 七夕", 450, 104);

    if (window.QQShadow && window.QQShadow.draw) {
      window.QQShadow.draw(g, str(st.shadowId), 450, 360, 400, 0.9);
    }

    var sh = shadowById(st.shadowId);
    g.fillStyle = INK;
    g.font = "64px " + KAITI;
    g.fillText(str(st.shadowName), 450, 620);
    g.font = "28px " + KAITI;
    g.fillText(sh ? str(sh.meaning) : "", 450, 664);

    var gradeName = str(st.gradeName);
    g.save();
    g.translate(450, 800);
    g.rotate(-6 * Math.PI / 180);
    g.fillStyle = (st.gradeId === "weide") ? INK : RED;
    g.fillRect(-75, -75, 150, 150);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 3;
    g.strokeRect(-64, -64, 128, 128);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (gradeName.length === 3) {
      g.font = "42px " + KAITI;
      for (i = 0; i < 3; i++) g.fillText(gradeName.charAt(i), 0, -46 + i * 46);
    } else {
      g.font = "52px " + KAITI;
      g.fillText(gradeName, 0, 0);
    }
    g.restore();

    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = RED;
    g.font = "30px " + KAITI;
    g.fillText("巧运在 " + str(st.aspectName), 450, 900);

    var raw = "";
    if (st.textLines && st.textLines.join) raw = st.textLines.join("");
    else raw = str(st.textLines);
    var lines = wrapText(raw, 16);
    if (lines.length > 5) {
      lines = lines.slice(0, 5);
      var lastL = lines[4];
      lines[4] = lastL.substring(0, lastL.length - 1) + "…";
    }
    g.fillStyle = INK;
    g.font = "26px " + SANS;
    for (i = 0; i < lines.length; i++) g.fillText(lines[i], 450, 950 + i * 40);

    var cc = (st.codexCount == null) ? "" : str(st.codexCount);
    g.fillStyle = INK;
    g.font = "24px " + KAITI;
    g.fillText("图鉴 " + cc + "/12 · 乞巧占卜局", 450, 1150);

    return c.toDataURL("image/png");
  }

  function miniTool() { return window.xhs && window.xhs.miniTool; }

  function fallback() { alert("当前环境暂不支持直接保存，请截图保存哦"); }

  function withFile(fn) {
    var mt = miniTool();
    var st = window.QQShare.lastStats;
    if (!mt || !st) { fallback(); return; }
    var dataUrl = paintCard(st);
    if (!dataUrl) { fallback(); return; }
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) { fn(mt, res && res.filePath); },
      fail: fallback
    });
  }

  function noteTitle() {
    var st = window.QQShare.lastStats || {};
    var t = "七夕占得" + str(st.gradeName) + "·" + str(st.shadowName);
    if (t.length > 20) t = t.substring(0, 20);
    return t;
  }

  window.QQShare = {
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
          title: noteTitle(),
          content: "丢针试巧，针影成谶。我在「乞巧占卜局」占得一缕巧运。",
          tags: "#国风vibecoding #七夕 #乞巧 #非遗 #国风 #中式美学",
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
