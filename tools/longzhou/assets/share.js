(function () {
  var RED = "#C3272B";
  var INK = "#425066";
  var PAPER = "#F5F0E6";
  var GOLD = "#FFB61E";
  var MOON = "#D6ECF0";
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

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function sealRows(s) {
    if (!s) return [""];
    var r = [], i;
    for (i = 0; i < s.length; i += 2) r.push(s.substr(i, 2));
    return r;
  }

  function paintCard(st) {
    st = st || {};
    var c = document.createElement("canvas");
    c.width = 900;
    c.height = 1200;
    var g = c.getContext("2d");
    var i, y;

    g.fillStyle = PAPER;
    g.fillRect(0, 0, 900, 1200);
    g.strokeStyle = RED;
    g.lineWidth = 6;
    g.strokeRect(27, 27, 846, 1146);
    g.lineWidth = 2;
    g.strokeRect(41, 41, 818, 1118);

    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = INK;
    g.font = "30px " + KAITI;
    g.fillText("非遗手作坊 · 端午", 450, 118);

    if (window.LZSprites && window.LZSprites.pickup) {
      window.LZSprites.pickup(g, "zongzi", 200, 108, 0.55, 0);
      window.LZSprites.pickup(g, "zongzi", 700, 108, 0.55, 0);
    }

    g.fillStyle = INK;
    g.font = "bold 96px " + KAITI;
    g.fillText("龙舟破浪", 450, 250);

    var rows = sealRows(str(st.title));
    g.save();
    g.translate(450, 388);
    g.rotate(-6 * Math.PI / 180);
    g.fillStyle = RED;
    g.fillRect(-75, -75, 150, 150);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 3;
    g.strokeRect(-64, -64, 128, 128);
    g.fillStyle = "#ffffff";
    g.font = "bold 50px " + KAITI;
    var sy0 = -((rows.length - 1) * 56) / 2 + 17;
    for (i = 0; i < rows.length; i++) g.fillText(rows[i], 0, sy0 + i * 56);
    g.restore();

    var stats = [
      ["航程", str(st.distText)],
      ["总分", str(st.score)],
      ["粽子", str(st.zongzi)],
      ["最高连击", str(st.maxCombo)]
    ];
    g.fillStyle = INK;
    for (i = 0; i < stats.length; i++) {
      y = 532 + i * 76;
      g.textAlign = "left";
      g.font = "28px " + KAITI;
      g.fillText(stats[i][0], 170, y);
      g.textAlign = "right";
      g.font = "bold 64px " + SANS;
      g.fillText(stats[i][1], 730, y);
    }

    var knowName = str(st.knowName);
    var knowText = str(st.knowText);
    g.fillStyle = "#ffffff";
    roundRect(g, 90, 792, 720, 288, 22);
    g.fill();
    g.strokeStyle = "rgba(66,80,102,0.18)";
    g.lineWidth = 2;
    roundRect(g, 90, 792, 720, 288, 22);
    g.stroke();
    g.textAlign = "left";
    g.fillStyle = INK;
    var by;
    if (knowName) {
      g.font = "bold 34px " + KAITI;
      g.fillText("《" + knowName + "》", 128, 846);
      by = 894;
    } else {
      by = 850;
    }
    var maxLines = knowName ? 5 : 6;
    var lines = wrapText(knowText, 14);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var lastL = lines[maxLines - 1];
      lines[maxLines - 1] = lastL.substring(0, lastL.length - 1) + "…";
    }
    g.font = "28px " + SANS;
    for (i = 0; i < lines.length; i++) g.fillText(lines[i], 128, by + i * 44);

    g.textAlign = "center";
    g.fillStyle = INK;
    g.font = "bold 32px " + KAITI;
    g.fillText("图鉴 " + str(st.codexCount) + "/8", 450, 1124);
    g.fillStyle = RED;
    g.font = "22px " + KAITI;
    g.fillText("龙舟破浪 · 端午竞渡", 450, 1150);
    g.fillStyle = GOLD;
    g.fillRect(268, 1142, 14, 4);
    g.fillRect(618, 1142, 14, 4);
    g.fillStyle = MOON;
    g.fillRect(288, 1144, 8, 2);
    g.fillRect(604, 1144, 8, 2);

    return c.toDataURL("image/png");
  }

  function miniTool() { return window.xhs && window.xhs.miniTool; }

  function fallback() { alert("当前环境暂不支持直接保存，请截图保存哦"); }

  function withFile(fn) {
    var mt = miniTool();
    var st = window.LZShare.lastStats;
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
    var st = window.LZShare.lastStats || {};
    var t = "我在端午划了 " + str(st.distText);
    if (t.length > 20) t = t.substring(0, 20);
    return t;
  }

  window.LZShare = {
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
          content: "击鼓奋楫，破浪夺标。来《龙舟破浪》划一局，攒端午图鉴。",
          tags: "#国风vibecoding #端午 #龙舟 #非遗 #国风 #中式美学",
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
