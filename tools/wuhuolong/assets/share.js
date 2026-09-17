(function () {
  var D = window.WHData;
  var HUE = D.HUES;

  var CARD_W = 750;
  var CARD_H = 1000;

  function bridge() {
    var x = window.xhs;
    if (x && x.miniTool) { return x.miniTool; }
    return null;
  }

  function hasBridge() { return !!bridge(); }

  function dragonPath(c, segs, ox, oy, scale) {
    var i;
    var p;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    for (i = 0; i < segs.length; i++) {
      p = segs[i];
      if (i === 0) { c.moveTo(ox + p.x * scale, oy - p.y * scale); }
      else { c.lineTo(ox + p.x * scale, oy - p.y * scale); }
    }
    c.strokeStyle = "#8e2b22";
    c.lineWidth = 26;
    c.stroke();
    c.strokeStyle = "#c9482c";
    c.lineWidth = 16;
    c.stroke();
    c.strokeStyle = "#ffd98a";
    c.globalAlpha = 0.85;
    c.lineWidth = 5;
    c.stroke();
    c.globalAlpha = 1;
  }

  function incenseDots(c, segs, ox, oy, scale) {
    var i;
    var p;
    c.fillStyle = "#fff3d6";
    for (i = 2; i < segs.length; i += 3) {
      p = segs[i];
      c.beginPath();
      c.arc(ox + p.x * scale, oy - p.y * scale - 13, 4.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  function draw(c, stats) {
    var segs = window.WHChain ? window.WHChain.segments() : [];
    var i;
    var g;
    var kn;
    var minX = 0;
    var maxX = 0;
    var span = 1;
    var scale;
    var ox;
    var ex;
    var ey;
    var oy = 470;

    g = c.createLinearGradient(0, 0, 0, CARD_H);
    g.addColorStop(0, "#0b1520");
    g.addColorStop(0.55, "#16283c");
    g.addColorStop(1, "#05080d");
    c.fillStyle = g;
    c.fillRect(0, 0, CARD_W, CARD_H);

    c.fillStyle = "#0a121c";
    c.beginPath();
    c.moveTo(0, 300);
    for (i = 0; i <= 10; i++) {
      c.lineTo(i * 75, 300 - (i % 3 === 0 ? 52 : 30));
    }
    c.lineTo(CARD_W, 300);
    c.lineTo(CARD_W, 0);
    c.lineTo(0, 0);
    c.closePath();
    c.fill();

    c.fillStyle = "#ffe9b0";
    for (i = 0; i < 46; i++) {
      c.globalAlpha = 0.25 + 0.45 * ((i * 37) % 10) / 10;
      c.beginPath();
      c.arc(((i * 137) % CARD_W), 30 + ((i * 53) % 230), 1.6, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    if (segs.length) {
      minX = segs[0].x;
      maxX = segs[0].x;
      for (i = 1; i < segs.length; i++) {
        if (segs[i].x < minX) { minX = segs[i].x; }
        if (segs[i].x > maxX) { maxX = segs[i].x; }
      }
      span = Math.max(1e-6, maxX - minX);
      scale = 560 / span;
      ox = 95 - minX * scale;

      g = c.createRadialGradient(CARD_W * 0.5, oy - 30, 16, CARD_W * 0.5, oy - 30, 300);
      g.addColorStop(0, "rgba(255, 168, 82, 0.34)");
      g.addColorStop(0.42, "rgba(224, 99, 44, 0.15)");
      g.addColorStop(1, "rgba(160, 70, 26, 0)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(CARD_W * 0.5, oy - 30, 300, 90, 0, 0, Math.PI * 2);
      c.fill();
      for (i = 0; i < 16; i++) {
        ex = CARD_W * 0.5 + ((i * 137) % 560) - 280;
        ey = oy - 30 + (((i * 53) % 150) - 75) * 0.55;
        c.globalAlpha = 0.16 + ((i * 37) % 5) * 0.07;
        c.fillStyle = i % 3 === 0 ? "#ffd08a" : "#e0632c";
        c.beginPath();
        c.arc(ex, ey, 2 + ((i * 29) % 3), 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      dragonPath(c, segs, ox, oy, scale);
      incenseDots(c, segs, ox, oy, scale);
    }

    c.fillStyle = "#ffe9b0";
    c.font = "600 66px 'Kaiti SC','STKaiti','KaiTi',serif";
    c.textAlign = "center";
    c.fillText("舞 火 龙", CARD_W * 0.5, 150);

    c.fillStyle = "#ff8a3d";
    c.font = "30px 'Kaiti SC','STKaiti','KaiTi',serif";
    c.fillText("大坑 · 国家级非遗 Ⅹ-5 · 序号 453", CARD_W * 0.5, 200);

    c.strokeStyle = "#7a3a20";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(120, 560);
    c.lineTo(CARD_W - 120, 560);
    c.stroke();

    c.textAlign = "left";
    c.fillStyle = "#e8e2d4";
    c.font = "30px -apple-system,'PingFang SC',sans-serif";
    c.fillText("四室皆清 · 瘟神已净", 90, 620);
    c.fillText("疫气 " + stats.miasma + " 团 · 瘟鬼 " + stats.ghost + " 只", 90, 664);
    c.fillText("用时 " + stats.secs + " 秒 · 余香 " + Math.round(stats.fire), 90, 708);

    c.fillStyle = "#97a6b8";
    c.font = "27px -apple-system,'PingFang SC',sans-serif";
    kn = D.KNOW[stats.knowIdx % D.KNOW.length];
    c.fillText("· " + kn, 90, 786);

    c.fillStyle = "#ffe9b0";
    c.font = "30px 'Kaiti SC','STKaiti','KaiTi',serif";
    c.textAlign = "center";
    c.fillText("八月十六 · 送龙归天", CARD_W * 0.5, 900);

    c.strokeStyle = "#7a3a20";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(90, 940);
    c.lineTo(CARD_W - 90, 940);
    c.stroke();
    c.fillStyle = "#6d7c8c";
    c.font = "24px -apple-system,'PingFang SC',sans-serif";
    c.fillText("在小红书搜索「舞火龙」看完整非遗", CARD_W * 0.5, 975);
  }

  function card(stats) {
    var cv = document.createElement("canvas");
    cv.width = CARD_W;
    cv.height = CARD_H;
    draw(cv.getContext("2d"), stats);
    return cv;
  }

  function statsOf(s) {
    var mins = Math.floor(s.t / 60);
    return {
      miasma: s.kills.miasma,
      ghost: s.kills.ghost,
      secs: Math.round(s.t),
      fire: s.fire,
      knowIdx: (s.kills.miasma * 7 + s.kills.ghost * 13 + mins) % 11
    };
  }

  function dataUrl(s) { return card(statsOf(s)).toDataURL("image/png"); }

  function save(s) {
    var b = bridge();
    var uri = dataUrl(s);
    if (!b || !b.writeTempFile) { return Promise.reject(new Error("no-bridge")); }
    return b.writeTempFile({ data: uri }).then(function (r) {
      return b.saveImageToPhotosAlbum({ filePath: r.filePath });
    });
  }

  function note(s) {
    var b = bridge();
    var uri = dataUrl(s);
    if (!b || !b.postNote) { return Promise.reject(new Error("no-bridge")); }
    return b.postNote({
      title: "中秋夜，我舞完了这条火龙",
      content: "大坑舞火龙，国家级非遗 Ⅹ-5。四室皆清，送龙归天。",
      pageType: "photo_publish",
      mediaInfo: { image_resources: [{ url: uri }] }
    });
  }

  window.WHShare = {
    card: card,
    dataUrl: dataUrl,
    save: save,
    note: note,
    hasBridge: hasBridge
  };
})();
