'use strict';

  /* ========================== [SHARE] =============================
     §8 — Canvas 2D 900x1200 PNG share card, guiyue's approach.
     Degrades instead of throwing when the canvas is tainted (hedeng).
     ================================================================ */
  var YGShare = (function () {
    var CW = 900, CH = 1200;
    var KAITI = '"Songti SC","STSong","KaiTi","SimSun",serif';
    var MOON_WHITE = "#EEF7F2", SILVER = "#F1F0ED", INDIGO = "#2A475F";
    var INDIGO_DEEP = "#1A3A5F", MINERAL = "#2E5D8C", OSMANTHUS = "#F8C471";
    var CINNABAR = "#ED5126";
    var tainted = false;

    function wrap(text, per, max) {
      var lines = [], line = "";
      var s = String(text || "");
      for (var i = 0; i < s.length; i++) {
        line += s.charAt(i);
        if (line.length >= per) { lines.push(line); line = ""; }
      }
      if (line) lines.push(line);
      return lines.length > max ? lines.slice(0, max) : lines;
    }

    function rrect(g, x, y, w, h, r) {
      var k = Math.min(r, w / 2, h / 2);
      g.beginPath();
      g.moveTo(x + k, y);
      g.lineTo(x + w - k, y); g.quadraticCurveTo(x + w, y, x + w, y + k);
      g.lineTo(x + w, y + h - k); g.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
      g.lineTo(x + k, y + h); g.quadraticCurveTo(x, y + h, x, y + h - k);
      g.lineTo(x, y + k); g.quadraticCurveTo(x, y, x + k, y);
      g.closePath();
    }

    function paintCard(st) {
      st = st || {};
      var c = document.createElement("canvas");
      c.width = CW; c.height = CH;
      var g = c.getContext("2d");
      if (!g) return null;

      /* dithered night ground — same anti-banding discipline as the stage */
      var bg = g.createLinearGradient(0, 0, 0, CH);
      bg.addColorStop(0, INDIGO);
      bg.addColorStop(0.52, INDIGO_DEEP);
      bg.addColorStop(1, INDIGO);
      g.fillStyle = bg;
      g.fillRect(0, 0, CW, CH);

      var rng = rngFrom(0xCA2D17);
      for (var i = 0; i < 2600; i++) {
        var px = rng() * CW, py = rng() * CH;
        var a = 0.012 + rng() * 0.05;
        g.fillStyle = "rgba(238,247,242," + a.toFixed(3) + ")";
        g.fillRect(px, py, 1 + rng() * 1.6, 1 + rng() * 1.6);
      }

      /* moon + halo */
      var mx = 690, my = 168, mr = 52;
      var halo = g.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4.4);
      halo.addColorStop(0, "rgba(238,247,242,0.30)");
      halo.addColorStop(0.4, "rgba(238,247,242,0.10)");
      halo.addColorStop(1, "rgba(238,247,242,0)");
      g.fillStyle = halo;
      g.beginPath(); g.arc(mx, my, mr * 4.4, 0, Math.PI * 2); g.fill();
      var body = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.28, mr * 0.1, mx, my, mr);
      body.addColorStop(0, "#FFFFFF");
      body.addColorStop(0.7, MOON_WHITE);
      body.addColorStop(1, MINERAL);
      g.fillStyle = body;
      g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(238,247,242,0.9)";
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(mx, my, mr * 0.98, 0, Math.PI * 2); g.stroke();

      /* silver bridge arcs — volumetric-ish bands */
      g.save();
      g.globalCompositeOperation = "lighter";
      for (var b = 0; b < 7; b++) {
        var by = 620 + b * 34;
        var lg = g.createLinearGradient(0, by - 22, 0, by + 22);
        lg.addColorStop(0, "rgba(238,247,242,0)");
        lg.addColorStop(0.5, "rgba(238,247,242," + (0.055 - b * 0.005).toFixed(3) + ")");
        lg.addColorStop(1, "rgba(238,247,242,0)");
        g.fillStyle = lg;
        g.fillRect(0, by - 22, CW, 44);
      }
      g.restore();
      g.strokeStyle = "rgba(241,240,237,0.34)";
      g.lineWidth = 3;
      for (var s2 = 0; s2 < 5; s2++) {
        g.beginPath();
        g.moveTo(40, 700 + s2 * 40);
        g.bezierCurveTo(300, 686 + s2 * 40, 600, 714 + s2 * 40, 860, 698 + s2 * 40);
        g.stroke();
      }

      /* header */
      g.textAlign = "center";
      g.fillStyle = OSMANTHUS;
      g.font = "46px " + KAITI;
      g.fillText("月宫一夜", 450, 128);
      g.font = "26px " + KAITI;
      g.fillStyle = "rgba(238,247,242,0.60)";
      g.fillText("唐明皇游月宫 · 唐人传奇", 450, 176);

      /* ending name — cinnabar accent */
      g.font = "76px " + KAITI;
      g.fillStyle = CINNABAR;
      g.fillText(st.endingName || "", 450, 400);

      /* stats line */
      g.font = "28px " + KAITI;
      g.fillStyle = "rgba(238,247,242,0.78)";
      g.fillText(
        "记曲 " + (st.tune || 0) + " / 2 · 暖意余 " + (st.warmth || 0) + " 度 · 走过 " + (st.walked || 0) + " 段",
        450, 470
      );

      /* harvest bars */
      var barY = 520;
      g.font = "24px " + KAITI;
      g.textAlign = "left";
      g.fillStyle = "rgba(238,247,242,0.55)";
      g.fillText("记曲", 150, barY + 8);
      g.fillText("观舞", 520, barY + 8);
      for (var d1 = 0; d1 < 2; d1++) {
        g.fillStyle = d1 < (st.tune || 0) ? MOON_WHITE : "rgba(238,247,242,0.16)";
        g.beginPath(); g.arc(248 + d1 * 34, barY, 11, 0, Math.PI * 2); g.fill();
        g.fillStyle = d1 < (st.dance || 0) ? SILVER : "rgba(238,247,242,0.16)";
        g.beginPath(); g.arc(618 + d1 * 34, barY, 11, 0, Math.PI * 2); g.fill();
      }
      /* warmth — the single warm anchor */
      g.textAlign = "center";
      g.fillStyle = "rgba(238,247,242,0.55)";
      g.font = "24px " + KAITI;
      g.fillText("暖意", 450, barY + 78);
      for (var d2 = 0; d2 < 3; d2++) {
        var on = d2 < (st.warmth || 0);
        g.fillStyle = on ? OSMANTHUS : "rgba(238,247,242,0.16)";
        g.beginPath(); g.arc(396 + d2 * 54, barY + 118, 13, 0, Math.PI * 2); g.fill();
        if (on) {
          var wg = g.createRadialGradient(396 + d2 * 54, barY + 118, 2, 396 + d2 * 54, barY + 118, 44);
          wg.addColorStop(0, "rgba(248,196,113,0.30)");
          wg.addColorStop(1, "rgba(248,196,113,0)");
          g.fillStyle = wg;
          g.beginPath(); g.arc(396 + d2 * 54, barY + 118, 44, 0, Math.PI * 2); g.fill();
        }
      }

      /* ending text excerpt */
      var lines = wrap(st.endingText, 22, 4);
      g.font = "27px " + KAITI;
      g.fillStyle = "rgba(238,247,242,0.72)";
      g.textAlign = "center";
      for (var l = 0; l < lines.length; l++) g.fillText(lines[l], 450, 800 + l * 48);

      /* 「月宫一夜」 seal — cinnabar */
      g.save();
      g.translate(770, 1010);
      g.rotate(-6 * Math.PI / 180);
      rrect(g, -62, -62, 124, 124, 12);
      g.fillStyle = CINNABAR; g.fill();
      g.strokeStyle = "rgba(238,247,242,0.92)";
      g.lineWidth = 3.5;
      rrect(g, -50, -50, 100, 100, 7);
      g.stroke();
      g.fillStyle = MOON_WHITE;
      g.font = "30px " + KAITI;
      g.textAlign = "center";
      g.textBaseline = "middle";
      var sealChars = "月宫一夜".split("");
      for (var sc = 0; sc < 4; sc++) g.fillText(sealChars[sc], 0, -36 + sc * 24);
      g.restore();
      g.textBaseline = "alphabetic";

      g.textAlign = "center";
      g.fillStyle = "rgba(238,247,242,0.42)";
      g.font = "21px " + KAITI;
      g.fillText("三源两说不同 · 备录于此 · 非遗手作坊", 450, 1150);

      try {
        return c.toDataURL("image/png");
      } catch (e) {
        if (!tainted) { tainted = true; return paintCard(st); }
        return null;
      }
    }

    function miniTool() { return window.xhs && window.xhs.miniTool; }
    function fallback() {
      var note = document.getElementById("card-note");
      if (note) note.textContent = "当前环境暂不支持直接保存，请截图保存";
    }

    function withFile(fn) {
      var mt = miniTool();
      var st = YGShare.lastStats;
      if (!mt || !st) { fallback(); return; }
      var url = null;
      try { url = paintCard(st); } catch (e) { url = null; }
      if (!url) { fallback(); return; }
      try {
        mt.writeTempFile({
          data: url,
          success: function (res) { fn(mt, res && res.filePath); },
          fail: fallback
        });
      } catch (e) { fallback(); }
    }

    return {
      lastStats: null,
      paintCard: paintCard,
      saveAlbum: function () {
        withFile(function (mt, p) {
          try {
            mt.saveImageToPhotosAlbum({ filePath: p, success: function () { }, fail: fallback });
          } catch (e) { fallback(); }
        });
      },
      postNote: function () {
        withFile(function (mt, p) {
          try {
            mt.postNote({
              title: "中秋望夜，我随罗公远登了银桥",
              content: "游月宫一夜：五个选择，两种所得。记曲得声调，观舞得神韵——不可兼得。唐人传奇，非史实。",
              tags: "#国风vibecoding #中秋节 #游月宫 #国风 #中式美学 #传统文化",
              mediaInfo: { image_resources: [{ url: p }] },
              fail: fallback
            });
          } catch (e) { fallback(); }
        });
      },
      fallback: fallback
    };
  })();
