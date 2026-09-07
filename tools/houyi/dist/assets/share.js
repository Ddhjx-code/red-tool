/* ============================================================
   后羿射日 · 分享出口 (window.HYShare)
   900×1200 国风战绩卡 -> writeTempFile -> saveImageToPhotosAlbum / postNote
   端能力不可用时降级为提示（不报错）。遵循 .skill/references/xhs-jsapi.md
   ============================================================ */
(function () {
  'use strict';

  var KAITI = '"Kaiti SC","STKaiti","KaiTi",serif';
  var GOLD = '#d9a62e';
  var PAPER = '#f3e9d2';
  var PAPER_DIM = 'rgba(243,233,210,0.66)';
  var CINNABAR = '#c3272b';
  var CLOSE_P = '，。！？；：、）》」』…～·,.!?;:)]}';
  var OPEN_P = '（《「『([{';

  function str(v) { return v == null ? '' : String(v); }

  function wrapText(text, per) {
    var lines = [], line = '', i, nx;
    for (i = 0; i < text.length; i++) {
      line += text.charAt(i);
      if (line.length >= per) {
        if (OPEN_P.indexOf(text.charAt(i)) >= 0) continue;
        nx = i + 1 < text.length ? text.charAt(i + 1) : '';
        if (nx && CLOSE_P.indexOf(nx) >= 0) { line += nx; i++; }
        lines.push(line);
        line = '';
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ---------- 装饰：三足金乌剪影（与 SHAPES 同构的鸟形） ---------- */
  function paintJinwu(g, cx, cy, k) {
    g.save();
    g.translate(cx, cy);
    g.scale(k, k);
    g.fillStyle = '#e0512b';
    g.beginPath();                                   // 鸟身
    g.moveTo(-18, -10); g.lineTo(-10, -14); g.lineTo(8, -14); g.lineTo(17, -8);
    g.lineTo(18, 3); g.lineTo(13, 13); g.lineTo(0, 16); g.lineTo(-13, 13); g.lineTo(-18, 4);
    g.closePath(); g.fill();
    g.fillStyle = '#d2451f';
    g.beginPath();                                   // 颈
    g.moveTo(-14, -9); g.lineTo(-4, -14); g.lineTo(-20, -27); g.lineTo(-28, -19);
    g.closePath(); g.fill();
    g.fillStyle = '#f5c542';
    g.beginPath();                                   // 头
    g.moveTo(-33, -33); g.lineTo(-23, -35); g.lineTo(-19, -27); g.lineTo(-23, -20); g.lineTo(-31, -22);
    g.closePath(); g.fill();
    g.fillStyle = '#ffde7a';
    g.beginPath();                                   // 喙
    g.moveTo(-41, -28); g.lineTo(-33, -31); g.lineTo(-33, -24);
    g.closePath(); g.fill();
    g.fillStyle = '#ee7a2e';
    g.beginPath();                                   // 尾
    g.moveTo(13, -13); g.lineTo(22, -22); g.lineTo(38, -34); g.lineTo(36, -16); g.lineTo(20, -6);
    g.closePath(); g.fill();
    g.fillStyle = '#f0a034';
    g.beginPath();                                   // 翼
    g.moveTo(-10, -11); g.lineTo(2, -15); g.lineTo(14, -10); g.lineTo(12, 2); g.lineTo(-6, 3);
    g.closePath(); g.fill();
    g.fillStyle = '#b93a22';                         // 三足
    [[-11, -5], [-2, 4], [7, 13]].forEach(function (lx) {
      g.fillRect(lx, 12, 6, 16);
    });
    g.restore();
  }

  /* ---------- 900×1200 国风战绩卡 ---------- */
  function paintCard(st) {
    st = st || {};
    var c = document.createElement('canvas');
    c.width = 900; c.height = 1200;
    var g = c.getContext('2d');
    var i;

    /* 夜色底 */
    var bg = g.createRadialGradient(450, 400, 60, 450, 400, 900);
    bg.addColorStop(0, '#2a1a18');
    bg.addColorStop(0.46, '#12203a');
    bg.addColorStop(1, '#060b12');
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);

    /* 天上余日 */
    var sunPos = [[150, 150], [760, 130], [620, 96]];
    for (i = 0; i < sunPos.length; i++) {
      var rg = g.createRadialGradient(sunPos[i][0], sunPos[i][1], 2, sunPos[i][0], sunPos[i][1], 60);
      rg.addColorStop(0, 'rgba(255,214,120,0.5)');
      rg.addColorStop(1, 'rgba(240,140,50,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(sunPos[i][0], sunPos[i][1], 60, 0, 6.283); g.fill();
    }

    /* 金框 */
    g.strokeStyle = GOLD;
    g.lineWidth = 5;
    g.strokeRect(28, 28, 844, 1144);
    g.strokeStyle = 'rgba(217,166,46,0.42)';
    g.lineWidth = 1.5;
    g.strokeRect(46, 46, 808, 1108);

    /* 标题 */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PAPER_DIM;
    g.font = '28px ' + KAITI;
    g.fillText('非遗手作坊 · 后羿射日', 450, 104);

    /* 朱砂小印 */
    g.save();
    g.translate(450, 152);
    g.fillStyle = CINNABAR;
    g.fillRect(-36, -18, 72, 36);
    g.fillStyle = '#ffffff';
    g.font = '22px ' + KAITI;
    g.textBaseline = 'middle';
    g.fillText('第十八作', 0, 1);
    g.restore();

    /* 金乌 */
    paintJinwu(g, 470, 288, 3.4);

    /* 关卡名 */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PAPER;
    g.font = '58px ' + KAITI;
    g.fillText(str(st.levelName), 450, 420);

    /* 战绩 */
    g.fillStyle = st.win ? GOLD : PAPER_DIM;
    g.font = '72px ' + KAITI;
    g.fillText(str(st.title), 450, 512);

    if (st.win) {
      g.fillStyle = GOLD;
      g.font = '42px ' + KAITI;
      var stars = '★'.repeat(st.stars || 0) + '☆'.repeat(3 - (st.stars || 0));
      g.fillText(stars, 450, 574);
    }

    /* 战绩起名 */
    g.fillStyle = CINNABAR;
    g.font = '30px ' + KAITI;
    g.fillText('— ' + str(st.name) + ' —', 450, 630);

    /* 数据 */
    g.fillStyle = PAPER_DIM;
    g.font = '27px ' + KAITI;
    g.fillText(str(st.statsLine), 450, 686);

    /* 知识卡 */
    var kn = st.knowledge || {};
    g.fillStyle = GOLD;
    g.font = '25px ' + KAITI;
    g.textAlign = 'left';
    g.fillText('· ' + str(kn.tag), 96, 742);

    g.fillStyle = 'rgba(243,233,210,0.06)';
    g.fillRect(90, 758, 720, 196);
    g.strokeStyle = 'rgba(217,166,46,0.35)';
    g.lineWidth = 1.5;
    g.strokeRect(90, 758, 720, 196);

    var lines = wrapText(str(kn.text), 24);
    if (lines.length > 5) lines = lines.slice(0, 5);
    g.fillStyle = PAPER_DIM;
    g.font = '24px ' + KAITI;
    for (i = 0; i < lines.length; i++) g.fillText(lines[i], 112, 798 + i * 36);

    /* 落款印章 */
    g.save();
    g.translate(788, 1090);
    g.rotate(-6 * Math.PI / 180);
    g.fillStyle = CINNABAR;
    g.fillRect(-48, -48, 96, 96);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    g.strokeRect(-40, -40, 80, 80);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '36px ' + KAITI;
    var sealTxt = st.win ? '射日' : '再射';
    g.fillText(sealTxt.charAt(0), 0, -19);
    g.fillText(sealTxt.charAt(1), 0, 20);
    g.restore();

    /* 页脚 */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PAPER_DIM;
    g.font = '24px ' + KAITI;
    g.fillText('彤弓素缯 · 射九日 · 留一日照人间', 430, 1150);

    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }

  /* ---------- 端能力 ---------- */
  function miniTool() { return window.xhs && window.xhs.miniTool; }

  function notify(msg) {
    if (typeof window.HYToast === 'function') window.HYToast(msg);
    else if (typeof window.alert === 'function') window.alert(msg);
  }

  function fallback() { notify('当前环境暂不支持直接保存，请截图留存这张战绩卡'); }

  function withFile(fn) {
    var mt = miniTool();
    var st = window.HYShare.lastStats;
    if (!mt || !st) { fallback(); return; }
    var dataUrl = paintCard(st);
    if (!dataUrl) { fallback(); return; }
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) { fn(mt, res && res.filePath); },
      fail: fallback
    });
  }

  window.HYShare = {
    lastStats: null,
    paintCard: paintCard,

    /* 存相册（用户主动点击触发） */
    saveAlbum: function () {
      withFile(function (mt, p) {
        mt.saveImageToPhotosAlbum({
          filePath: p,
          success: function () { notify('已保存到相册'); },
          fail: fallback
        });
      });
    },

    /* 发笔记（用户主动点击触发） */
    postNote: function () {
      var st = window.HYShare.lastStats || {};
      withFile(function (mt, p) {
        mt.postNote({
          title: '我用彤弓素缯射落了九个太阳·' + str(st.name),
          content: '《淮南子》记「尧乃使羿，上射十日」。羿射九日、留一日照人间——' +
            str(st.levelName) + '，' + str(st.title) + '。' + str(st.statsLine),
          tags: '#国风vibecoding #后羿射日 #山海经 #国风 #中式美学 #传统文化',
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
