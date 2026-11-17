/* 小方块变形记 —— 拖两个圆环，改这只小方块的身材。
   Chrome 61 基线：var / function，无箭头函数、无模板串、无 let/const。 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var OX = 100, OY = 315, SC = 118;

  var svg = document.getElementById('paper');
  var grid = document.getElementById('grid');
  var bodyEl = document.getElementById('body');
  var faceEl = document.getElementById('face');
  var dotsEl = document.getElementById('dots');
  var h1 = document.getElementById('h1');
  var h2 = document.getElementById('h2');
  var shadowEl = document.getElementById('shadow');
  var eyeL = document.getElementById('eyeL');
  var eyeR = document.getElementById('eyeR');
  var unitSq = document.getElementById('unitSq');
  var badge = document.getElementById('badge');
  var badgeNum = document.getElementById('badgeNum');
  var stepEl = document.getElementById('step');
  var titleEl = document.getElementById('title');
  var hintEl = document.getElementById('hint');
  var doneEl = document.getElementById('done');
  var stickerEls = [
    document.getElementById('s1'),
    document.getElementById('s2'),
    document.getElementById('s3')
  ];

  var START = { a: 1.4, b: 0.2, c: 0.32, d: 1.3 };
  var m = { a: START.a, b: START.b, c: START.c, d: START.d };

  var TASKS = [
    { title: '把它撑到 2 倍大', hint: '拖住两个圆环，把它拉开', cls: '', done: false,
      test: function (det) { return det >= 2; } },
    { title: '让它翻个面', hint: '把一个圆环拉到对面去', cls: 's2', done: false,
      test: function (det) { return det < -0.5; } },
    { title: '把它彻底压扁', hint: '让两个圆环排成一条线', cls: 's3', done: false, hold: 340,
      test: function (det) { return Math.abs(det) < 0.14; } }
  ];

  var drag = null;
  var grabOff = { u: 0, v: 0 };
  var bounceAt = -9999;
  var nextBlink = 1800;
  var blinkUntil = 0;
  var flashTimer = null;
  var shownDone = false;

  function sx(u) { return OX + u * SC; }
  function sy(v) { return OY - v * SC; }

  function det() { return m.a * m.d - m.b * m.c; }

  /* 一格 = 1 个单位：面积倍数直接数格子 */
  function buildGrid() {
    var html = '';
    var k, x, y;
    var step = SC / 4;
    /* 细分线：只是纸的质感，不代表单位 */
    for (k = -14; k <= 14; k++) {
      x = OX + k * step;
      if (x < 1 || x > 389) continue;
      if (k % 4 === 0) continue;
      html += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="470" stroke="#F5F0E6" stroke-width="1" />';
    }
    for (k = -14; k <= 14; k++) {
      y = OY - k * step;
      if (y < 1 || y > 469) continue;
      if (k % 4 === 0) continue;
      html += '<line x1="0" y1="' + y + '" x2="390" y2="' + y + '" stroke="#F5F0E6" stroke-width="1" />';
    }
    /* 主线：一格 = 1 个单位 */
    for (k = -4; k <= 5; k++) {
      x = OX + k * SC;
      if (x < 1 || x > 389) continue;
      html += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="470" stroke="#E7DFCE" stroke-width="1" />';
    }
    for (k = -4; k <= 5; k++) {
      y = OY - k * SC;
      if (y < 1 || y > 469) continue;
      html += '<line x1="0" y1="' + y + '" x2="390" y2="' + y + '" stroke="#E7DFCE" stroke-width="1" />';
    }
    grid.innerHTML = html;
  }

  function unitSquarePath() {
    var p = [[0, 0], [1, 0], [1, 1], [0, 1]];
    var d = 'M' + sx(p[0][0]) + ' ' + sy(p[0][1]);
    for (var i = 1; i < p.length; i++) d += 'L' + sx(p[i][0]) + ' ' + sy(p[i][1]);
    return d + 'Z';
  }

  function bodyPath() {
    var p = [
      [0, 0], [m.a, m.b], [m.a + m.c, m.b + m.d], [m.c, m.d]
    ];
    var d = 'M' + sx(p[0][0]) + ' ' + sy(p[0][1]);
    for (var i = 1; i < p.length; i++) d += 'L' + sx(p[i][0]) + ' ' + sy(p[i][1]);
    return d + 'Z';
  }

  function currentTask() {
    for (var i = 0; i < TASKS.length; i++) {
      if (!TASKS[i].done) return { task: TASKS[i], index: i };
    }
    return null;
  }

  var flashing = false;

  function flash(msg) {
    if (flashTimer) clearTimeout(flashTimer);
    flashing = true;
    hintEl.textContent = msg;
    hintEl.style.color = '#23201C';
    flashTimer = setTimeout(function () {
      flashing = false;
      hintEl.style.color = '';
      syncHead();
    }, 1400);
  }

  function syncHead() {
    var cur = currentTask();
    var n = 0;
    for (var i = 0; i < TASKS.length; i++) { if (TASKS[i].done) n++; }
    if (!cur) {
      stepEl.textContent = '完成 3 / 3';
      stepEl.className = 's4';
      titleEl.textContent = '它认输了';
      hintEl.textContent = '三张贴纸都拿到了';
      return;
    }
    stepEl.textContent = '任务 ' + (n + 1) + ' / 3';
    stepEl.className = cur.task.cls;
    titleEl.textContent = cur.task.title;
    if (!flashing) hintEl.textContent = cur.task.hint;
  }

  function render() {
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var d = det();
    var thin = Math.abs(d) < 0.14;

    var body = bodyPath();
    bodyEl.setAttribute('d', body);
    shadowEl.setAttribute('d', body);
    unitSq.setAttribute('d', unitSquarePath());

    var p1x = sx(m.a), p1y = sy(m.b);
    var p2x = sx(m.c), p2y = sy(m.d);

    h1.setAttribute('cx', p1x);
    h1.setAttribute('cy', p1y);
    h2.setAttribute('cx', p2x);
    h2.setAttribute('cy', p2y);

    var cx = (sx(0) + p1x + sx(m.a + m.c) + p2x) / 4;
    var cy = (sy(0) + p1y + sy(m.b + m.d) + p2y) / 4;

    var u = (now - bounceAt) / 420;
    var hop = 0, pop = 0;
    if (u >= 0 && u < 1) {
      hop = -15 * Math.sin(Math.PI * u);
      pop = 0.3 * Math.sin(Math.PI * u);
    }

    var breath = 1 + 0.016 * Math.sin(now / 620);
    var flip = d < 0 ? -1 : 1;
    var fscaleY = flip * breath * (1 + pop) * (thin ? 0.14 : 1);
    var fscaleX = (1 + pop) * (thin ? 1.12 : 1);

    var FS = 1.3;
    faceEl.setAttribute('transform',
      'translate(' + cx.toFixed(2) + ' ' + (cy + hop).toFixed(2) + ') scale(' +
      (fscaleX * FS).toFixed(3) + ' ' + (fscaleY * FS).toFixed(3) + ')');

    /* 偶尔眨一下眼，是“活的”最关键的一笔 */
    if (now > nextBlink) { blinkUntil = now + 110; nextBlink = now + 2400 + Math.random() * 2600; }
    var blink = now < blinkUntil && !thin;
    var er = blink ? 1.4 : 6;
    if (eyeL.getAttribute('r') !== String(er)) {
      eyeL.setAttribute('r', er);
      eyeR.setAttribute('r', er);
    }

    dotsEl.setAttribute('x', cx.toFixed(2));
    dotsEl.setAttribute('y', (cy - 34 + hop).toFixed(2));
    dotsEl.setAttribute('opacity', thin ? '1' : '0');

    bodyEl.setAttribute('fill', thin ? '#D8D1C2' : (u >= 0 && u < 1 ? '#FAC775' : '#F8D27C'));
    h1.setAttribute('class', thin ? 'handle off' : 'handle' + (drag === 1 ? ' drag' : ''));
    h2.setAttribute('class', thin ? 'handle off' : 'handle' + (drag === 2 ? ' drag' : ''));

    var txt;
    if (Math.abs(d) < 0.09) txt = '×0';
    else txt = '×' + (d < 0 ? '−' : '') + Math.abs(d).toFixed(1);
    if (badgeNum.textContent !== txt) badgeNum.textContent = txt;
    badge.className = thin ? 'zero' : (d < 0 ? 'neg' : '');

    /* 只判定当前这一关：翻面时穿过 det≈0 不会顺手把「压扁」也做成 */
    var changed = false;
    var cur = currentTask();
    if (cur) {
      var tk = cur.task;
      if (tk.test(d)) {
        if (!tk.at) tk.at = now;
        if (now - tk.at >= (tk.hold || 0)) {
          tk.done = true;
          tk.at = 0;
          stickerEls[cur.index].className = 'stk on';
          bounceAt = now;
          changed = true;
        }
      } else {
        tk.at = 0;
      }
    }
    if (changed) {
      syncHead();
      if (!currentTask()) flash('三张都拿到了！');
      else flash(pickPraise(d));
    }

    if (!currentTask() && !shownDone) {
      shownDone = true;
      setTimeout(function () { doneEl.className = 'on'; }, 1500);
    }

    window.requestAnimationFrame(render);
  }

  function pickPraise(d) {
    var a = Math.abs(d);
    if (a < 0.14) return '扁成一张纸了，拉不回来了';
    if (d < 0) return '肚皮朝上了，所以是负的';
    if (a >= 3.5) return '太大了吧，快要撑破了';
    if (a >= 2) return '呼——撑起来了';
    return '有点样子了';
  }

  function toUnit(clientX, clientY) {
    var r = svg.getBoundingClientRect();
    var s = Math.min(r.width / 390, r.height / 470);
    var offX = r.left + (r.width - 390 * s) / 2;
    var offY = r.top + (r.height - 470 * s) / 2;
    var vx = (clientX - offX) / s;
    var vy = (clientY - offY) / s;
    return { u: (vx - OX) / SC, v: (OY - vy) / SC };
  }

  function clamp(x) {
    if (x < -0.6) return -0.6;
    if (x > 1.8) return 1.8;
    return x;
  }

  function startDrag(id, clientX, clientY) {
    var p = toUnit(clientX, clientY);
    drag = id;
    if (id === 1) { grabOff.u = m.a - p.u; grabOff.v = m.b - p.v; }
    else { grabOff.u = m.c - p.u; grabOff.v = m.d - p.v; }
  }

  function move(clientX, clientY) {
    if (!drag) return;
    var p = toUnit(clientX, clientY);
    var u = clamp(p.u + grabOff.u), v = clamp(p.v + grabOff.v);
    if (drag === 1) { m.a = u; m.b = v; }
    else { m.c = u; m.d = v; }
  }

  function bindDrag(el, id) {
    el.addEventListener('mousedown', function (e) {
      e.preventDefault();
      startDrag(id, e.clientX, e.clientY);
    });
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length) {
        e.preventDefault();
        startDrag(id, e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
  }

  document.addEventListener('mousemove', function (e) {
    if (drag) move(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', function () { drag = null; });
  document.addEventListener('touchmove', function (e) {
    if (drag && e.touches.length) {
      e.preventDefault();
      move(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  document.addEventListener('touchend', function () { drag = null; });

  document.getElementById('again').addEventListener('click', function () {
    m.a = START.a; m.b = START.b; m.c = START.c; m.d = START.d;
    for (var i = 0; i < TASKS.length; i++) {
      TASKS[i].done = false;
      TASKS[i].at = 0;
      stickerEls[i].className = 'stk';
    }
    shownDone = false;
    bounceAt = -9999;
    doneEl.className = '';
    syncHead();
  });

  bindDrag(h1, 1);
  bindDrag(h2, 2);
  buildGrid();
  syncHead();
  window.requestAnimationFrame(render);
})();
