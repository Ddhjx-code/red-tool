/* ============================================================
   漆扇 · 分享出口 (window.QSShare)
   Canvas 成品 → writeTempFile → saveImageToPhotosAlbum / postNote
   端能力不可用时降级为提示（不报错）。遵循 .skill/references/xhs-jsapi.md
   ============================================================ */
(function () {
  'use strict';

  var Scene = window.QSScene;

  var KAITI = '"Kaiti SC","STKaiti","KaiTi",serif';
  var PAPER = '#f3e9d2';
  var GOLD = '#d9a62e';
  var CINNABAR = '#e23d28';
  var PAPER_DIM = 'rgba(243,233,210,0.62)';
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

  /* ---------- 900×1200 国风分享卡 ---------- */
  function paintCard(fan) {
    fan = fan || {};
    var c = document.createElement('canvas');
    c.width = 900; c.height = 1200;
    var g = c.getContext('2d');

    /* 夜色底 */
    var bg = g.createRadialGradient(450, 420, 60, 450, 420, 900);
    bg.addColorStop(0, '#123047');
    bg.addColorStop(0.48, '#0a1320');
    bg.addColorStop(1, '#060b12');
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);

    /* 金框 */
    g.strokeStyle = GOLD;
    g.lineWidth = 5;
    g.strokeRect(28, 28, 844, 1144);
    g.strokeStyle = 'rgba(217,166,46,0.45)';
    g.lineWidth = 1.5;
    g.strokeRect(46, 46, 808, 1108);

    /* 标题 */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PAPER_DIM;
    g.font = '28px ' + KAITI;
    g.fillText('非遗手作坊 · 漆扇 · 漂漆', 450, 104);

    /* 朱砂 seal 小印（标题右侧） */
    g.save();
    g.translate(450, 152);
    g.fillStyle = CINNABAR;
    g.fillRect(-34, -18, 68, 36);
    g.fillStyle = '#ffffff';
    g.font = '22px ' + KAITI;
    g.textBaseline = 'middle';
    g.fillText('第十七作', 0, 1);
    g.restore();

    /* 成品扇 */
    Scene.drawFan(g, {
      cx: 450, cy: 430, r: 200,
      shape: fan.shape || 'round',
      pattern: fan.pattern || null,
      tilt: -4
    });

    /* 作品名 */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PAPER;
    g.font = '76px ' + KAITI;
    g.fillText(str(fan.name), 450, 762);

    /* 作品小记 */
    g.fillStyle = GOLD;
    g.font = '27px ' + KAITI;
    g.fillText(str(fan.note), 450, 822);

    /* 知识卡 */
    var kn = fan.knowledge || {};
    g.fillStyle = GOLD;
    g.font = '25px ' + KAITI;
    g.textAlign = 'left';
    g.fillText('· ' + str(kn.tag), 96, 878);

    g.fillStyle = 'rgba(243,233,210,0.06)';
    g.fillRect(90, 894, 720, 168);
    g.strokeStyle = 'rgba(217,166,46,0.35)';
    g.lineWidth = 1.5;
    g.strokeRect(90, 894, 720, 168);

    var lines = wrapText(str(kn.text), 25);
    if (lines.length > 4) lines = lines.slice(0, 4);
    g.fillStyle = PAPER_DIM;
    g.font = '25px ' + KAITI;
    for (var i = 0; i < lines.length; i++) g.fillText(lines[i], 112, 934 + i * 38);

    /* 落款印章 */
    g.save();
    g.translate(788, 1104);
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
    g.fillText('天', 0, -19);
    g.fillText('成', 0, 20);
    g.restore();

    /* 页脚 */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PAPER_DIM;
    g.font = '24px ' + KAITI;
    g.fillText('一半人为 · 一半天成 · 每把漆扇独一无二', 430, 1150);

    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }

  /* ---------- 端能力 ---------- */
  function miniTool() { return window.xhs && window.xhs.miniTool; }

  function notify(msg) {
    if (typeof window.QSToast === 'function') window.QSToast(msg);
    else if (typeof window.alert === 'function') window.alert(msg);
  }

  function fallback() { notify('当前环境暂不支持直接保存，请截图留存这把漆扇'); }

  function withFile(fn) {
    var mt = miniTool();
    var fan = window.QSShare.lastFan;
    if (!mt || !fan) { fallback(); return; }
    var dataUrl = paintCard(fan);
    if (!dataUrl) { fallback(); return; }
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) { fn(mt, res && res.filePath); },
      fail: fallback
    });
  }

  window.QSShare = {
    lastFan: null,
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
      var fan = window.QSShare.lastFan || {};
      withFile(function (mt, p) {
        mt.postNote({
          title: '我漂了一把漆扇·' + str(fan.name),
          content: '大漆不溶于水。滴漆入盆、木棒拉纹，扇面入水一拓——' + str(fan.note) + '。一半人为，一半天成。',
          tags: '#国风vibecoding #漆扇 #漂漆 #非遗 #国风 #中式美学 #传统文化',
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
