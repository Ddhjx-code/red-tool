(function () {
  'use strict';
  window.YueYan = window.YueYan || {};
  var D = window.YueYan.Data;
  var E = window.YueYan.Engine;

  var FONT = '-apple-system, "PingFang SC", sans-serif';

  // §6.3.1 月亮呈现: E1 满月无云 → E5 薄云遮月, the cloud band growing per ending.
  var MOON_COVER = { E1: 0.00, E2: 0.18, E3: 0.35, E4: 0.55, E5: 0.75 };
  var GRADE_CHAR = ['铜', '银', '金'];                            // §9.3 品级不用数字

  function build(state) {
    var G = D.card;
    var canvas = document.createElement('canvas');
    canvas.width = G.width;
    canvas.height = G.height;
    var ctx = canvas.getContext('2d');
    var code = E.ending(state), meta = D.endings[code], m = E.meters(state);

    ctx.fillStyle = D.palette.paper;                             // O-5 米纸底
    ctx.fillRect(0, 0, G.width, G.height);

    drawMoonInto(ctx, code, G);                                  // 顶 · 月亮

    ctx.fillStyle = D.palette.ink;
    ctx.textAlign = 'center';
    ctx.font = '700 ' + G.nameSize + 'px ' + FONT;
    ctx.fillText(meta.name, G.moonCx, G.nameY);                  // 结局名 64/700

    ctx.font = '400 ' + G.textSize + 'px ' + FONT;
    wrapText(ctx, meta.text, G.moonCx, G.textY, G.textMaxW);     // 结局文案 30/400

    drawTable(ctx, state, G);                                    // 中 · 圆桌五座位
    drawCakeRows(ctx, state, G);                                 // 中 · 饼条五行
    drawMeterRows(ctx, m, G);                                    // 下 · meter 三行

    ctx.textAlign = 'center';                                    // 饼/meter 行是左对齐，标识要收回居中
    ctx.fillStyle = D.palette.ink;
    ctx.font = '700 ' + G.brandSize + 'px ' + FONT;
    ctx.fillText('月宴', G.moonCx, G.brandY);                    // 底 · 标识 34/700
    ctx.font = '400 ' + G.seriesSize + 'px ' + FONT;
    ctx.fillText('非遗手作坊', G.moonCx, G.brandY + 34);         // 系列标识 20/400

    return canvas.toDataURL('image/png');                        // §9.1 运行时生成，V-2 零图片资产
  }

  function drawMoonInto(ctx, code, G) {
    var r = G.moonR;
    ctx.beginPath();
    ctx.arc(G.moonCx, G.moonCy, r, 0, Math.PI * 2);
    ctx.fillStyle = D.palette.moon;
    ctx.fill();
    ctx.lineWidth = 1.5;                                         // §8.3 工笔描边
    ctx.strokeStyle = D.palette.ink;
    ctx.stroke();
    var band = MOON_COVER[code] || 0;
    if (band > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(G.moonCx, G.moonCy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = D.palette.paper;
      var y = G.moonCy + r - band * 2 * r;
      ctx.fillRect(G.moonCx - r, y, r * 2, band * 2 * r);
      ctx.restore();
    }
  }

  function drawTable(ctx, state, G) {
    var i, angle, x, y, key;
    ctx.strokeStyle = D.palette.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(G.moonCx, G.tableCy, G.tableR, 0, Math.PI * 2);
    ctx.stroke();
    for (i = 0; i < D.familyOrder.length; i++) {                 // 每 72°
      key = D.familyOrder[i];
      angle = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      x = G.moonCx + Math.cos(angle) * G.tableR;
      y = G.tableCy + Math.sin(angle) * G.tableR;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.strokeStyle = D.palette.ink;
      ctx.stroke();
      if (E.attends(state, key)) {                               // 空座位只画描边圆 (§9.3 / X-11)
        ctx.fillStyle = D.palette.moon;
        ctx.fill();
        ctx.fillStyle = D.palette.ink;
        ctx.font = '500 ' + G.familySize + 'px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(D.family[key].label, x, y + 8);
      }
    }
  }

  function drawCakeRows(ctx, state, G) {
    var i, c, y;
    ctx.textAlign = 'left';
    for (i = 0; i < state.cakes.length; i++) {                   // 五行，行高 60
      c = state.cakes[i];
      y = G.cakeY + i * G.cakeRow;
      ctx.fillStyle = D.palette.ink;
      ctx.font = '400 ' + G.fillingSize + 'px ' + FONT;
      ctx.fillText(D.fillings[c.filling].label, G.cakeX, y + 38);
      ctx.font = '700 ' + G.gradeSize + 'px ' + FONT;
      ctx.fillStyle = c.grade === 3 ? D.palette.lantern
                    : c.grade === 2 ? D.palette.paper
                    : D.palette.amber;                           // §9.3 金/银/铜 三色，不用朱砂
      ctx.fillText(GRADE_CHAR[c.grade - 1], G.cakeX + 120, y + 38);
    }
  }

  function drawMeterRows(ctx, m, G) {
    var rows = [['饼品', m.Q], ['宴备', m.B], ['心意', m.H]];
    var i, y;
    ctx.textAlign = 'left';
    for (i = 0; i < rows.length; i++) {                          // 三行，行高 40
      y = G.meterY + i * G.meterRow;
      ctx.fillStyle = D.palette.ink;
      ctx.font = '500 ' + G.meterSize + 'px ' + FONT;
      ctx.fillText(rows[i][0], G.meterX, y + 30);
      ctx.fillText(String(rows[i][1]), G.meterX + 120, y + 30);
    }
  }

  function wrapText(ctx, text, cx, y, maxW) {
    var chars = text.split(''), line = '', lines = [], i;
    for (i = 0; i < chars.length; i++) {
      if (ctx.measureText(line + chars[i]).width > maxW) {
        lines.push(line); line = chars[i];
      } else { line += chars[i]; }
    }
    if (line) { lines.push(line); }
    for (i = 0; i < lines.length; i++) { ctx.fillText(lines[i], cx, y + i * 42); }
  }

  function publish(dataUrl) {
    var tool = window.xhs && window.xhs.miniTool;
    if (tool && typeof tool.share === 'function') {
      try {
        tool.share({ image: dataUrl });
        return 'xhs';
      } catch (e) {                                              // §9.4 静默降级，不弹错误框
        return inline(dataUrl);
      }
    }
    return inline(dataUrl);
  }

  function inline(dataUrl) {
    var wrap = document.getElementById('card-wrap');             // fallback: inline preview
    wrap.innerHTML = '';
    var img = document.createElement('img');
    img.src = dataUrl;
    img.alt = '月宴分享卡';
    wrap.appendChild(img);
    return 'fallback';
  }

  window.YueYan.Share = { build: build, publish: publish };
})();
