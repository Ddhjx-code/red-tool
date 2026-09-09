/* ============================================================
   中秋博饼 · 分享出口 (window.BobingShare)
   合成 #gl(墨金夜宴氛围) + #cv(碗/骰/会饼前景) 的 4:5 安全框 ->
   900×1200 国风战绩卡 -> writeTempFile -> saveImageToPhotosAlbum / postNote
   端能力不可用时降级为提示（不报错）。遵循 .skill/references/xhs-jsapi.md
   ============================================================ */
(function () {
  'use strict';

  /* palette tokens — 与 style.css :root 逐字一致，无新增颜色 */
  var NIGHT1 = '#1F2233';
  var NIGHT2 = '#0E1018';
  var INK = '#16181D';
  var GOLD_B = '#ECD06F';
  var GOLD_M = '#C5A253';
  var CIN = '#A82020';
  var MOON_W = '#D6ECF0';
  var IVORY = '#FFFBF0';
  var KAITI = '"Kaiti SC","STKaiti","KaiTi","Songti SC","Source Han Serif SC",serif';
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

  function paintMooncake(g, cx, cy, R) {
    g.save();
    g.translate(cx, cy);
    /* 饼身 */
    var body = g.createRadialGradient(-R * 0.3, -R * 0.34, R * 0.08, 0, 0, R);
    body.addColorStop(0, GOLD_B);
    body.addColorStop(0.55, GOLD_M);
    body.addColorStop(1, '#5C4A22');
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.fill();
    /* 外圈齿纹 */
    g.strokeStyle = 'rgba(236,208,111,0.62)';
    g.lineWidth = Math.max(1, R * 0.06);
    g.beginPath(); g.arc(0, 0, R * 0.86, 0, 6.283); g.stroke();
    /* 中心团花 */
    g.strokeStyle = 'rgba(236,208,111,0.72)';
    g.lineWidth = Math.max(1, R * 0.055);
    g.beginPath(); g.arc(0, 0, R * 0.46, 0, 6.283); g.stroke();
    var k;
    for (k = 0; k < 6; k++) {
      var a = k * Math.PI / 3;
      g.fillStyle = 'rgba(236,208,111,0.62)';
      g.beginPath();
      g.arc(Math.cos(a) * R * 0.24, Math.sin(a) * R * 0.24, R * 0.11, 0, 6.283);
      g.fill();
    }
    g.fillStyle = 'rgba(236,208,111,0.85)';
    g.beginPath(); g.arc(0, 0, R * 0.08, 0, 6.283); g.fill();
    /* 月白高光 */
    g.fillStyle = 'rgba(214,236,240,0.24)';
    g.beginPath();
    g.ellipse(-R * 0.34, -R * 0.38, R * 0.30, R * 0.20, -0.5, 0, 6.283);
    g.fill();
    g.restore();
  }

  /* ---------- 900×1200 国风战绩卡 ---------- */
  function paintCard() {
    var c = document.createElement('canvas');
    c.width = 900; c.height = 1200;
    var g = c.getContext('2d');

    var Eng = window.Bobing && window.Bobing.Engine;
    var Data = window.Bobing && window.Bobing.Data;
    var Scene = window.Bobing && window.Bobing.Scene;
    var S = Eng && Eng.S;
    var tier = (S && S.result) || null;
    var collected = (S && S.collected) || 0;
    var total = (Data && Data.CAKE_TOTAL) || 63;

    /* 夜色底（与场景同源，合成失败时也是诚实的墨金夜宴底） */
    var bg = g.createRadialGradient(450, 420, 60, 450, 420, 940);
    bg.addColorStop(0, NIGHT1);
    bg.addColorStop(0.5, NIGHT2);
    bg.addColorStop(1, INK);
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);

    /* 合成已渲染场景：#gl 氛围(月/流体/金光/桂瓣) + #cv 前景(碗/骰/会饼)，
       按屏幕 z 序叠加。优先取 4:5 安全框；V 不可用时退回整幅画布 cover 铺满
       （整幅 cover 到 3:4 卡片，纵向裁切自然落在安全框区域，碗/骰居中保留） */
    var V = Scene && Scene.V;
    var glc = document.getElementById('gl');
    var cvc = document.getElementById('cv');
    if (glc && cvc && glc.width > 0 && cvc.width > 0) {
      var dpr = (V && V.dpr) || 1;
      var sx, sy, sw, sh;
      if (V && V.safe && V.safe.w > 0 && V.safe.h > 0) {
        sx = V.safe.x * dpr; sy = V.safe.y * dpr;
        sw = V.safe.w * dpr; sh = V.safe.h * dpr;
      } else {
        sx = 0; sy = 0; sw = glc.width; sh = glc.height;
      }
      var scale = Math.max(900 / sw, 1200 / sh);
      var dw = sw * scale, dh = sh * scale;
      var dx = (900 - dw) / 2, dy = (1200 - dh) / 2;
      try {
        g.drawImage(glc, sx, sy, sw, sh, dx, dy, dw, dh);
        g.drawImage(cvc, sx, sy, sw, sh, dx, dy, dw, dh);
      } catch (e) { /* 合成失败则保留夜色底 */ }
    }

    /* 压暗底部，保证文字可读（不改变上方画面） */
    var veil = g.createLinearGradient(0, 760, 0, 1200);
    veil.addColorStop(0, 'rgba(14,16,24,0)');
    veil.addColorStop(1, 'rgba(14,16,24,0.82)');
    g.fillStyle = veil;
    g.fillRect(0, 760, 900, 440);

    /* 金框（外粗内细，与系列同款） */
    g.strokeStyle = GOLD_M;
    g.lineWidth = 5;
    g.strokeRect(28, 28, 844, 1144);
    g.strokeStyle = 'rgba(197,162,83,0.45)';
    g.lineWidth = 1.5;
    g.strokeRect(46, 46, 808, 1108);

    /* 标题 */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(214,236,240,0.62)';
    g.font = '28px ' + KAITI;
    g.fillText('非遗手作坊 · 中秋博饼', 450, 104);

    /* 朱砂小印 */
    g.save();
    g.translate(450, 152);
    g.fillStyle = CIN;
    g.fillRect(-36, -18, 72, 36);
    g.fillStyle = IVORY;
    g.font = '22px ' + KAITI;
    g.textBaseline = 'middle';
    g.fillText('厦门非遗', 0, 1);
    g.restore();

    /* 功名（状元级用朱砂，其余月白） */
    var cin = tier && tier.cinnabar;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = cin ? CIN : MOON_W;
    g.font = '76px ' + KAITI;
    g.fillText(tier ? str(tier.name) : '中秋博饼', 450, 880);

    /* 功名小记 / 蟾宫折桂 */
    g.fillStyle = GOLD_B;
    g.font = '30px ' + KAITI;
    g.fillText(tier ? str(tier.sub) : '厦门非遗 · 会饼六十三', 450, 934);

    /* 会饼进度 */
    g.fillStyle = 'rgba(214,236,240,0.62)';
    g.font = '27px ' + KAITI;
    g.fillText('累计会饼 ' + collected + ' / ' + total + ' 块', 450, 990);

    /* 诗句 */
    if (tier && tier.poem) {
      g.fillStyle = GOLD_M;
      g.font = '25px ' + KAITI;
      g.fillText(str(tier.poem), 450, 1036);
    }

    /* 月饼意象 */
    paintMooncake(g, 450, 300, 96);

    /* 落款印章 */
    g.save();
    g.translate(788, 1090);
    g.rotate(-6 * Math.PI / 180);
    g.fillStyle = CIN;
    g.fillRect(-48, -48, 96, 96);
    g.strokeStyle = 'rgba(255,251,240,0.9)';
    g.lineWidth = 3;
    g.strokeRect(-40, -40, 80, 80);
    g.fillStyle = IVORY;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '36px ' + KAITI;
    g.fillText('团', 0, -19);
    g.fillText('圆', 0, 20);
    g.restore();

    /* 页脚 */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(214,236,240,0.62)';
    g.font = '24px ' + KAITI;
    g.fillText('会饼六十三 · 满盘团圆 · 月满中秋', 430, 1150);

    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }

  /* ---------- 端能力 ---------- */
  function miniTool() { return window.xhs && window.xhs.miniTool; }

  /* 轻量瞬时 toast：仅点击后出现，不常驻 DOM，不干扰任何画面 */
  function notify(msg) {
    var el = document.getElementById('bobing-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bobing-toast';
      el.style.cssText =
        'position:fixed;left:50%;bottom:18%;transform:translateX(-50%);' +
        'max-width:82%;padding:8px 16px;text-align:center;z-index:9;' +
        'font-family:var(--font-body);font-size:13px;letter-spacing:.08em;' +
        'color:var(--mw-92);background:var(--night-2);' +
        'border:1px solid var(--gm-42);border-radius:var(--r-pill);' +
        'opacity:0;pointer-events:none;' +
        'transition:opacity var(--dur-2) var(--ease);';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    void el.offsetWidth;
    el.style.opacity = '1';
    clearTimeout(el._bt);
    el._bt = setTimeout(function () { el.style.opacity = '0'; }, 2000);
  }

  function fallback() { notify('当前环境暂不支持直接保存，请截图留存这张团圆卡'); }

  function withFile(fn) {
    var mt = miniTool();
    if (!mt) { fallback(); return; }
    var dataUrl = paintCard();
    if (!dataUrl) { fallback(); return; }
    /* 大图先 writeTempFile 换 filePath，再传给其他端能力（不直接上行超长 base64） */
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) { fn(mt, res && res.filePath); },
      fail: fallback
    });
  }

  window.BobingShare = {
    /* 导出已渲染场景为 PNG data: URL（QA / 端能力共用） */
    shareCard: paintCard,
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
      var Eng = window.Bobing && window.Bobing.Engine;
      var S = Eng && Eng.S;
      var tier = (S && S.result) || null;
      var collected = (S && S.collected) || 0;
      withFile(function (mt, p) {
        mt.postNote({
          title: '中秋博饼·' + (tier ? str(tier.name) : '厦门非遗'),
          content: '六骰入碗，数四点红定功名。博到「' +
            (tier ? str(tier.name) : '功名') + '」，累计会饼 ' + collected +
            ' 块。会饼六十三，博满即团圆——月满中秋，人亦团圆。',
          tags: '#国风vibecoding #中秋博饼 #厦门非遗 #国风 #中式美学 #传统文化',
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
