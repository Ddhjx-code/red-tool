/* 奶茶店老板 —— 三关：备货 / 揪假新品 / 反推配方
   Chrome 61 基线：var + function，无箭头函数、无模板串、无 let/const、无对象展开。 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ============ 尺寸 ============ */
  var U = 3.9;
  function fitU() {
    var w = document.documentElement.clientWidth || 390;
    U = w / 100;
    document.documentElement.style.setProperty('--u', U + 'px');
  }

  /* ============ 数据 ============ */
  var ING = ['茶', '奶', '糖', '珍珠'];

  var DRINK = [
    { n: '经典', full: '经典奶茶', c: '#C89F6E', g: [200, 100, 20, 50] },
    { n: '牛乳', full: '纯牛乳', c: '#EFE2C9', g: [0, 250, 25, 0] },
    { n: '奶绿', full: '珍珠奶绿', c: '#9FCBA9', g: [180, 60, 30, 0] },
    { n: '超大杯', full: '经典·超大杯', c: '#D9A24A', g: [300, 150, 30, 75] }
  ];

  /* ============ 杯子 ============ */
  var cupSeq = 0;
  function cupSVG(color) {
    var id = 'cp' + (cupSeq++);
    var body = 'M17 34 L83 34 L75 108 Q74.4 114 68 114 L32 114 Q25.6 114 25 108 Z';
    return '<svg class="cup" viewBox="0 0 100 124">' +
      '<defs><clipPath id="' + id + '"><path d="' + body + '"/></clipPath></defs>' +
      '<g clip-path="url(#' + id + ')">' +
        '<rect class="liq" x="6" y="114" width="88" height="0" fill="' + color + '" opacity="0.6"/>' +
      '</g>' +
      '<path d="' + body + '" fill="none" stroke="#23201C" stroke-width="2.8" stroke-linejoin="round"/>' +
      '<path d="M54 34 L47 14" stroke="#23201C" stroke-width="3.2" stroke-linecap="round"/>' +
      '<rect x="14" y="29" width="72" height="6.4" rx="3.2" fill="#23201C"/>' +
      '<ellipse cx="50" cy="119" rx="27" ry="3.6" fill="#23201C" opacity="0.07"/>' +
      '<circle cx="41" cy="63" r="2.7" fill="#23201C"/>' +
      '<circle cx="59" cy="63" r="2.7" fill="#23201C"/>' +
      '<path d="M45 71 q5 4.6 10 0" fill="none" stroke="#23201C" stroke-width="2.2" stroke-linecap="round"/>' +
      '<ellipse cx="33" cy="71" rx="3.4" ry="2.1" fill="#E77E86" opacity="0.42"/>' +
      '<ellipse cx="67" cy="71" rx="3.4" ry="2.1" fill="#E77E86" opacity="0.42"/>' +
      '</svg>';
  }

  /* ============ 滑杆 ============ */
  function makeSlider(el, opt) {
    var min = opt.min, max = opt.max;
    var v = opt.value || 0;
    var thumb = el.querySelector('.sl-thumb');
    var fill = el.querySelector('.sl-fill');
    var mark = el.querySelector('.sl-mark');
    var dragging = false;
    var onChange = opt.onChange;
    var guard = false;

    function pct(n) { return (n - min) / (max - min); }

    function draw() {
      var p = pct(v) * 100;
      thumb.style.left = p + '%';
      if (fill) fill.style.width = p + '%';
    }

    function set(nv, silent) {
      if (nv < min) nv = min;
      if (nv > max) nv = max;
      nv = Math.round(nv);
      if (nv === v && !opt.force) { return; }
      v = nv;
      draw();
      if (!silent && onChange && !guard) onChange(v);
    }

    function fromX(x) {
      var r = el.getBoundingClientRect();
      var p = (x - r.left) / r.width;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      set(min + p * (max - min));
    }

    function px(e) {
      var t = e.touches && e.touches.length ? e.touches[0] : (e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : e);
      return t.clientX;
    }

    function down(e) {
      if (opt.locked && opt.locked()) { return; }
      dragging = true;
      fromX(px(e));
      if (e.cancelable) { e.preventDefault(); }
    }
    function move(e) {
      if (!dragging) { return; }
      if (opt.locked && opt.locked()) { return; }
      fromX(px(e));
      if (e.cancelable) { e.preventDefault(); }
    }
    function up() { dragging = false; }

    el.addEventListener('mousedown', down);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
    document.addEventListener('touchcancel', up);

    if (mark && typeof opt.mark === 'number') {
      mark.style.left = (pct(opt.mark) * 100) + '%';
      mark.style.display = 'block';
    } else if (mark) {
      mark.style.display = 'none';
    }

    draw();

    return {
      el: el,
      get: function () { return v; },
      set: set,
      setMark: function (m) {
        if (!mark) { return; }
        if (typeof m === 'number') {
          mark.style.display = 'block';
          mark.style.left = (pct(m) * 100) + '%';
        } else {
          mark.style.display = 'none';
        }
      },
      redraw: draw
    };
  }

  /* ============ 公共 UI ============ */
  var pips = $('pips').getElementsByTagName('i');
  var hudName = $('hudName');
  var footTxt = $('footTxt');
  var mainBtn = $('mainBtn');
  var NAMES = ['备货', '揪假新品', '反推配方'];

  function goScene(n) {
    var i;
    for (i = 0; i < pips.length; i++) {
      pips[i].className = i < n ? 'pip on' : 'pip';
    }
    hudName.textContent = NAMES[n - 1];
    for (i = 1; i <= 3; i++) {
      $('s' + i).className = (i === n) ? 'scene on' : 'scene';
    }
  }

  function say(t) { footTxt.textContent = t; }
  function btn(label, fn) {
    mainBtn.textContent = label;
    mainBtn.className = 'btn on';
    mainBtn.onclick = fn;
  }
  function hideBtn() {
    mainBtn.className = 'btn';
    mainBtn.onclick = null;
  }

  /* =========================================================
     第 1 关：备货
     X（4 种原料 × 3 款饮品）乘 w（每款卖多少杯）= b（要备多少料）
     ========================================================= */
  var L1 = {
    orders: [[120, 90, 150], [70, 160, 110]],
    cur: 0,
    vals: [0, 0, 0],
    hit: [false, false, false],
    locked: true,
    cols: [],
    sliders: [],
    busy: false
  };

  function buildCups1() {
    var html = '', i;
    for (i = 0; i < 3; i++) {
      html += '<div class="col" data-i="' + i + '">' +
        '<div class="cupwrap">' + cupSVG(DRINK[i].c) + '</div>' +
        '<div class="cnum"><span>0</span><em>杯</em></div>' +
        '<div class="sl"><div class="sl-track"><i class="sl-fill"></i><b class="sl-mark"></b></div>' +
        '<div class="sl-thumb"></div></div>' +
        '<div class="cname">' + DRINK[i].n + '</div>' +
        '</div>';
    }
    $('cups').innerHTML = html;

    var cols = $('cups').getElementsByClassName('col');
    for (i = 0; i < cols.length; i++) {
      L1.cols.push(cols[i]);
    }
    var sls = $('cups').getElementsByClassName('sl');
    for (i = 0; i < sls.length; i++) {
      (function (k, el) {
        L1.sliders.push(makeSlider(el, {
          min: 0, max: 240, value: 0,
          locked: function () { return L1.locked; },
          onChange: function (v) { onCup1(k, v); }
        }));
      })(i, sls[i]);
    }
  }

  /* 配方表：行是原料，列是饮品，右上角并列 w 与 b */
  function buildGrid() {
    var html = '<div class="ghead"><b class="gk">每杯 g</b>', i, j, v;
    for (j = 0; j < 3; j++) {
      html += '<span class="gcol"><em>' + DRINK[j].n + '</em>' +
        '<i id="w' + j + '">0</i></span>';
    }
    html += '<span class="gsum">备料<em>kg</em></span></div>';

    for (i = 0; i < 4; i++) {
      html += '<div class="grow" id="gr' + i + '"><b class="gk">' + ING[i] + '</b>';
      for (j = 0; j < 3; j++) {
        v = DRINK[j].g[i];
        html += '<i class="gv' + (v ? '' : ' z') + '">' + v + '</i>';
      }
      html += '<span class="gt" id="gt' + i + '">–</span></div>';
    }
    $('grid').innerHTML = html;
  }

  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+$)/g, ',');
  }

  /* w 跟着滑杆实时变：它就是这一单 */
  function setW(hit) {
    for (var j = 0; j < 3; j++) {
      var el = $('w' + j);
      el.textContent = L1.vals[j];
      if (j === hit) {
        el.className = 'flip';
        (function (e) { setTimeout(function () { e.className = ''; }, 380); })(el);
      }
    }
  }

  function liquid(k, v) {
    var rect = L1.cols[k].getElementsByTagName('rect')[0];
    var h = 7 + (v / 240) * 62;
    rect.setAttribute('height', h);
    rect.setAttribute('y', 114 - h);
  }

  function onCup1(k, v) {
    if (L1.locked) { return; }
    var t = L1.orders[L1.cur][k];
    if (Math.abs(v - t) <= 8) {
      v = t;
      L1.sliders[k].set(t, true);
    }
    L1.vals[k] = v;

    liquid(k, v);
    L1.cols[k].getElementsByTagName('span')[0].textContent = v;
    setW(k);

    var isHit = (v === t);
    if (isHit && !L1.hit[k]) {
      L1.hit[k] = true;
      L1.cols[k].className = 'col hit jump';
      setTimeout(function () { L1.cols[k].className = 'col hit'; }, 220);
    } else if (!isHit) {
      L1.hit[k] = false;
      L1.cols[k].className = 'col';
    }

    if (L1.hit[0] && L1.hit[1] && L1.hit[2]) {
      startCalc();
    }
  }

  function setOrder(idx) {
    L1.cur = idx;
    var o = L1.orders[idx], i;
    $('ordNo').textContent = (idx + 1);
    $('ordTxt').innerHTML =
      '<i>经典<b>' + o[0] + '</b></i>' +
      '<i>牛乳<b>' + o[1] + '</b></i>' +
      '<i>奶绿<b>' + o[2] + '</b></i>';
    for (i = 0; i < 3; i++) {
      L1.hit[i] = false;
      L1.vals[i] = L1.sliders[i].get();
      L1.cols[i].className = 'col';
      L1.sliders[i].setMark(o[i]);
    }
    setW();
  }

  function resetCalc() {
    var i;
    for (i = 0; i < 4; i++) {
      $('gt' + i).className = 'gt';
      $('gt' + i).innerHTML = '–';
      $('gr' + i).className = 'grow';
    }
    $('cline').innerHTML = '';
    $('calcNote').className = 'calc-note';
    $('calcNote').innerHTML = '';
  }

  /* 一行：三个「每杯用量 × 杯数」加起来，就是这种原料要备多少 */
  function calcRow(i, done) {
    $('gr' + i).className = 'grow on';
    var terms = [], tot = 0, j, g, w;
    for (j = 0; j < 3; j++) {
      g = DRINK[j].g[i];
      w = L1.vals[j];
      tot += g * w;
      terms.push('<i' + (g ? '' : ' class="z"') + '>' + g + '×' + w + '</i>');
    }
    $('cline').innerHTML = '<b>' + ING[i] + '</b>' + terms.join(' + ') +
      ' = <em>' + fmt(tot) + ' g</em>';

    setTimeout(function () {
      var t = $('gt' + i);
      t.innerHTML = '<b>' + (tot / 1000).toFixed(1) + '</b><em>kg</em>';
      t.className = 'gt on';
      done();
    }, 480);
  }

  function runCalc(done) {
    var i = 0;
    function next() {
      if (i > 0) { $('gr' + (i - 1)).className = 'grow'; }
      if (i >= 4) { done(); return; }
      calcRow(i, function () {
        i++;
        setTimeout(next, 170);
      });
    }
    next();
  }

  function startCalc() {
    if (L1.busy) { return; }
    L1.busy = true;
    L1.locked = true;
    say('一行一行算：每列乘杯数，再加起来');

    setTimeout(function () {
      runCalc(function () {
        if (L1.cur === 0) {
          $('calcNote').innerHTML = '4 行 × 3 列，一次算出 <b>4 个总量</b>';
          $('calcNote').className = 'calc-note on';
          setTimeout(function () { nextOrder(); }, 2400);
        } else {
          $('calcNote').innerHTML = '换单只换 w，<b>X 一个数都没动</b>';
          $('calcNote').className = 'calc-note on';
          setTimeout(function () {
            say('表格得重写 4 条式子，矩阵只换 1 行');
            btn('去揪假新品', function () { goScene(2); startL2(); });
          }, 1600);
        }
      });
    }, 420);
  }

  function nextOrder() {
    resetCalc();
    L1.busy = false;
    setOrder(1);
    say('又来一单：只改上面这行杯数');
    setTimeout(function () {
      L1.locked = false;
    }, 900);
  }

  function startL1() {
    L1.locked = false;
    L1.busy = false;
    setOrder(0);
    resetCalc();
    $('cline').innerHTML = '<b>拖滑杆</b>上面那行杯数，就是 w';
    say('把三个杯子拖到单子上的数');
    hideBtn();
  }

  /* =========================================================
     第 2 关：揪假新品
     ========================================================= */
  var L2 = {
    sel: [],
    ratio: 1,
    locked: false,
    sl: null,
    solved: false,
    lastMove: 0
  };

  function buildCards() {
    var html = '', i, j;
    for (i = 0; i < 4; i++) {
      html += '<div class="card" data-i="' + i + '">' +
        '<div class="card-name">' + DRINK[i].full + '</div>';
      for (j = 0; j < 4; j++) {
        var p = DRINK[i].g[j] / 300 * 100;
        html += '<div class="crowse"><span class="cn">' + ING[j] + '</span>' +
          '<i class="cb"><b style="width:' + p + '%"></b></i>' +
          '<span class="cv">' + DRINK[i].g[j] + '</span></div>';
      }
      html += '</div>';
    }
    $('cards').innerHTML = html;

    var cards = $('cards').getElementsByClassName('card');
    for (i = 0; i < cards.length; i++) {
      (function (k, el) {
        el.addEventListener('click', function () { pick(k); });
      })(i, cards[i]);
    }
  }

  function cardEl(k) {
    return $('cards').getElementsByClassName('card')[k];
  }

  function pick(k) {
    if (L2.locked || L2.solved) { return; }
    var i;
    for (i = 0; i < L2.sel.length; i++) {
      if (L2.sel[i] === k) {
        L2.sel.splice(i, 1);
        paintCards();
        return;
      }
    }
    L2.sel.push(k);
    if (L2.sel.length > 2) { L2.sel.shift(); }
    paintCards();
  }

  function paintCards() {
    var i;
    for (i = 0; i < 4; i++) {
      cardEl(i).className = L2.sel.indexOf(i) >= 0 ? 'card sel' : 'card';
    }
    $('ruler').className = L2.sel.length === 2 ? 'ruler on' : 'ruler';
    if (L2.sel.length === 2) {
      $('rulerHint').textContent = '四项差值同时归零才算重合';
      $('chips').className = 'chips';
      applyRatio(L2.ratio);
    } else {
      $('rulerHint').textContent = '点两张卡，再拖倍率';
      $('chips').className = 'chips empty';
      L2.lastMove = 0;
    }
  }

  function sumOf(g) { return g[0] + g[1] + g[2] + g[3]; }

  /* 选定两张里，用量大的那张当「被缩放的重复款」，小的当基准；
     这样不管先点哪张，倍率都落在 1 以上。 */
  function pair() {
    var a = L2.sel[0], b = L2.sel[1];
    return sumOf(DRINK[a].g) >= sumOf(DRINK[b].g) ? { big: a, small: b } : { big: b, small: a };
  }

  function applyRatio(k) {
    L2.ratio = k;
    $('ratioTxt').textContent = '×' + k.toFixed(2);
    if (L2.sel.length < 2) { return; }

    var P = pair();
    var S = DRINK[P.small].g;   /* 基准：小杯 */
    var T = DRINK[P.big].g;     /* 被缩放：大杯 */
    var el = cardEl(P.big);
    var vals = el.getElementsByClassName('cv');
    var bars = el.getElementsByClassName('cb');
    var chips = $('chips').getElementsByTagName('i');
    var i, ok = true;

    for (i = 0; i < 4; i++) {
      var nv = Math.round(S[i] * k);
      var d = Math.abs(T[i] - S[i] * k);
      var tol = Math.max(1.2, T[i] * 0.015);
      var hit = d <= tol;

      vals[i].textContent = nv;
      bars[i].getElementsByTagName('b')[0].style.width = (nv / 300 * 100) + '%';
      vals[i].className = hit ? 'cv hot' : 'cv';

      chips[i].innerHTML = ING[i] + '<b>' + Math.round(d) + '</b>';
      chips[i].className = hit ? 'ok' : '';
      if (!hit) { ok = false; }
    }

    if (ok) { winL2(k); }
  }

  function winL2() {
    if (L2.solved) { return; }
    L2.solved = true;
    L2.locked = true;

    var P = pair();
    var S = DRINK[P.small].g;
    var T = DRINK[P.big].g;
    var i, num = 0, den = 0;
    for (i = 0; i < 4; i++) {
      num += S[i] * T[i];
      den += S[i] * S[i];
    }
    var ke = den ? num / den : 1;
    var factor = sumOf(T) / sumOf(S);

    /* 吸附到精确倍数，数字精确对上 */
    L2.ratio = ke;
    $('ratioTxt').textContent = '×' + ke.toFixed(2);
    L2.sl.set(Math.round(ke * 100), true);

    var el = cardEl(P.big);
    var vals = el.getElementsByClassName('cv');
    var bars = el.getElementsByClassName('cb');
    var chips = $('chips').getElementsByTagName('i');
    for (i = 0; i < 4; i++) {
      vals[i].textContent = T[i];
      bars[i].getElementsByTagName('b')[0].style.width = (T[i] / 300 * 100) + '%';
      vals[i].className = 'cv hot';
      chips[i].innerHTML = ING[i] + '<b>0</b>';
      chips[i].className = 'ok';
    }

    cardEl(P.small).className = 'card mate';
    cardEl(P.big).className = 'card mate';

    if (!cardEl(P.big).getElementsByClassName('card-badge').length) {
      var badge = document.createElement('div');
      badge.className = 'card-badge';
      badge.textContent = '×' + factor.toFixed(2);
      cardEl(P.big).appendChild(badge);
    }

    say('这两款的用料完全成比例，就是同一款');
    setTimeout(function () {
      cardEl(P.big).className = 'card mate gone';
      $('ruler').className = 'ruler';
      say('菜单上 4 款，其实只有 3 款配方');
      btn('看看隔壁的进货单', function () { goScene(3); startL3(); });
    }, 1900);
  }

  function startL2() {
    var i;
    L2.sel = [];
    L2.ratio = 1;
    L2.locked = false;
    L2.solved = false;
    buildCards();
    $('ruler').className = 'ruler';
    $('rulerHint').textContent = '点两张卡，再拖倍率';
    $('chips').className = 'chips empty';
    var ch = '';
    for (i = 0; i < 4; i++) { ch += '<i>' + ING[i] + '<b>0</b></i>'; }
    $('chips').innerHTML = ch;
    $('ratioTxt').textContent = '×1.00';
    if (L2.sl) { L2.sl.set(100, true); }
    else {
      L2.sl = makeSlider($('ratioSl'), {
        min: 55, max: 185, value: 100,
        locked: function () { return L2.solved; },
        onChange: function (v) {
          if (L2.sel.length < 2) { L2.sl.set(100, true); return; }
          applyRatio(v / 100);
        }
      });
    }
    say('有一款是另一款换个杯子装的');
    hideBtn();
  }

  /* =========================================================
     第 3 关：反推配方
     ========================================================= */
  var L3 = {
    phase: 'A',
    cups: [0, 0],
    sliders: [],
    spots: [],
    found: 0,
    drinks: [0, 1],
    bill: [40, 45],
    locked: false
  };

  /* 每种饮品的两种原料用量（克），换算 kg */
  function coef(k) {
    var g = DRINK[k].g;
    return [g[0] / 1000, g[1] / 1000];
  }

  function need(i) {
    var a = coef(L3.drinks[0]), b = coef(L3.drinks[1]);
    return a[i] * L3.cups[0] + b[i] * L3.cups[1];
  }

  var MX0 = 36, MW = 248, MY0 = 176, MH = 146;

  function px(x) { return MX0 + (x / 300) * MW; }
  function py(y) { return MY0 - (y / 300) * MH; }

  function buildMap() {
    var svg = $('map');
    var html = '', i;
    var x1 = MX0, x2 = MX0 + MW, y1 = MY0 - MH, y2 = MY0;

    for (i = 0; i <= 4; i++) {
      var gx = MX0 + i * (MW / 4);
      var gy = MY0 - i * (MH / 4);
      html += '<line x1="' + gx + '" y1="' + y1 + '" x2="' + gx + '" y2="' + y2 +
        '" stroke="#EDE6D8" stroke-width="1"/>';
      html += '<line x1="' + x1 + '" y1="' + gy + '" x2="' + x2 + '" y2="' + gy +
        '" stroke="#EDE6D8" stroke-width="1"/>';
    }

    html += '<line x1="' + x1 + '" y1="' + y2 + '" x2="' + (x2 + 8) + '" y2="' + y2 +
      '" stroke="#D8CFBD" stroke-width="1.4"/>';
    html += '<line x1="' + x1 + '" y1="' + y2 + '" x2="' + x1 + '" y2="' + (y1 - 8) +
      '" stroke="#D8CFBD" stroke-width="1.4"/>';

    html += '<text x="' + (x2 + 6) + '" y="' + (y2 + 4) + '" font-size="8" fill="#B3A794">杯</text>';
    html += '<text x="' + (x1 - 6) + '" y="' + (y1 - 2) + '" text-anchor="end" font-size="8" fill="#B3A794">杯</text>';

    var a = coef(L3.drinks[0]), b = coef(L3.drinks[1]);
    html += '<g id="lines">';
    html += lineOf(a[0], b[0], L3.bill[0], '#7FA8C9', 2.6);
    html += lineOf(a[1], b[1], L3.bill[1], '#C89F6E', 4.4);
    html += '</g>';

    html += '<g id="spots"></g>';
    html += '<circle id="dot" cx="' + px(0) + '" cy="' + py(0) + '" r="7" fill="#FFFDF9" ' +
      'stroke="#23201C" stroke-width="2.6"/>';
    svg.innerHTML = html;

    var st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.textContent = '#dot{cursor:pointer}';
    svg.appendChild(st);

    bindMapDrag(svg);
  }

  function lineOf(a, b, c, color, width) {
    var xa, ya, xb, yb;
    if (Math.abs(b) < 1e-9) {
      xa = xb = c / a;
      ya = 0; yb = 300;
    } else if (Math.abs(a) < 1e-9) {
      ya = yb = c / b;
      xa = 0; xb = 300;
    } else {
      xa = 0; ya = c / b;
      xb = 300; yb = (c - a * 300) / b;
    }
    var pts = clip(xa, ya, xb, yb);
    if (!pts) { return ''; }
    return '<line x1="' + px(pts[0]) + '" y1="' + py(pts[1]) + '" x2="' +
      px(pts[2]) + '" y2="' + py(pts[3]) + '" stroke="' + color +
      '" stroke-width="' + width + '" stroke-linecap="round" opacity="0.92"/>';
  }

  function clip(x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy];
    var q = [x1, 300 - x1, y1, 300 - y1];
    var i;
    for (i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-9) {
        if (q[i] < 0) { return null; }
      } else {
        var r = q[i] / p[i];
        if (p[i] < 0) {
          if (r > t1) { return null; }
          if (r > t0) { t0 = r; }
        } else {
          if (r < t0) { return null; }
          if (r < t1) { t1 = r; }
        }
      }
    }
    return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
  }

  function clip(x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy];
    var q = [x1, 300 - x1, y1, 300 - y1];
    var i;
    for (i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-9) {
        if (q[i] < 0) { return null; }
      } else {
        var r = q[i] / p[i];
        if (p[i] < 0) {
          if (r > t1) { return null; }
          if (r > t0) { t0 = r; }
        } else {
          if (r < t0) { return null; }
          if (r < t1) { t1 = r; }
        }
      }
    }
    return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
  }

  function bindMapDrag(svg) {
    var dragging = false;
    function set(x, y) {
      setCups(x, y, true);
    }
    function down(e) {
      if (L3.locked) { return; }
      dragging = true;
      mpos(e);
      if (e.cancelable) { e.preventDefault(); }
    }
    function mpos(e) {
      var t = e.touches && e.touches.length ? e.touches[0] : e;
      var r = svg.getBoundingClientRect();
      /* preserveAspectRatio=meet：先还原等比缩放与居中留白 */
      var k = Math.min(r.width / 320, r.height / 200);
      var ox = r.left + (r.width - 320 * k) / 2;
      var oy = r.top + (r.height - 200 * k) / 2;
      var sx = (t.clientX - ox) / k;
      var sy = (t.clientY - oy) / k;
      var cx = (sx - MX0) / MW * 300;
      var cy = (MY0 - sy) / MH * 300;
      set(cx, cy);
    }
    function move(e) {
      if (!dragging) { return; }
      mpos(e);
      if (e.cancelable) { e.preventDefault(); }
    }
    function up() { dragging = false; }

    svg.addEventListener('mousedown', down);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    svg.addEventListener('touchstart', down, { passive: false });
    svg.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  }

  function setCups(x, y, fromMap) {
    if (x < 0) { x = 0; }
    if (x > 300) { x = 300; }
    if (y < 0) { y = 0; }
    if (y > 300) { y = 300; }
    L3.cups[0] = Math.round(x);
    L3.cups[1] = Math.round(y);
    solveSnap();
    paintL3(fromMap);
  }

  function solveSnap() {
    var a = coef(L3.drinks[0]), b = coef(L3.drinks[1]);
    var a1 = a[0], a2 = b[0], b1 = a[1], b2 = b[1];
    var c1 = L3.bill[0], c2 = L3.bill[1];
    var det = a1 * b2 - a2 * b1;
    var x = L3.cups[0], y = L3.cups[1];

    if (Math.abs(det) > 1e-6) {
      var d1 = Math.abs(a1 * x + a2 * y - c1);
      var d2 = Math.abs(b1 * x + b2 * y - c2);
      if (d1 < 1.6 && d2 < 1.6) {
        L3.cups[0] = Math.round((c1 * b2 - c2 * a2) / det);
        L3.cups[1] = Math.round((a1 * c2 - b1 * c1) / det);
        L3.matched = true;
      } else {
        L3.matched = false;
      }
    } else {
      /* 两行约束其实是同一条：任意解都在线上 */
      var t = (a1 * x + a2 * y - c1) / (a1 * a1 + a2 * a2);
      var nn = Math.sqrt(a1 * a1 + a2 * a2);
      if (Math.abs(t) * nn < 2.2) {
        L3.cups[0] = Math.round(x - a1 * t);
        L3.cups[1] = Math.round(y - a2 * t);
        L3.matched = true;
      } else {
        L3.matched = false;
      }
    }
  }

  function paintL3(fromMap) {
    var i;
    for (i = 0; i < 2; i++) {
      var col = $('s3cups').getElementsByClassName('col')[i];
      col.getElementsByTagName('span')[0].textContent = L3.cups[i];
      var rect = col.getElementsByTagName('rect')[0];
      var h = 7 + (L3.cups[i] / 300) * 62;
      rect.setAttribute('height', h);
      rect.setAttribute('y', 114 - h);
      if (L3.sliders[i] && L3.sliders[i].get() !== L3.cups[i]) {
        L3.sliders[i].set(L3.cups[i], true);
      }
    }

    var dot = $('dot');
    if (dot) {
      dot.setAttribute('cx', px(L3.cups[0]));
      dot.setAttribute('cy', py(L3.cups[1]));
      dot.setAttribute('fill', L3.matched ? '#EAF6EE' : '#FFFDF9');
    }

    /* 差额 */
    var rows = $('diff').getElementsByClassName('drow');
    var okAll = true;
    for (i = 0; i < 2; i++) {
      var d = L3.bill[i] - need(i);
      var ad = Math.abs(d);
      if (ad > 0.06) { okAll = false; }
      rows[i].className = ad <= 0.06 ? 'drow ok' : 'drow';
      rows[i].getElementsByTagName('i')[0].style.width = Math.min(100, ad / 12 * 100) + '%';
      rows[i].getElementsByClassName('dv')[0].textContent =
        ad <= 0.06 ? '正好' : (d > 0 ? '差 ' + d.toFixed(1) : '多 ' + (-d).toFixed(1));
    }

    if (okAll && !L3.locked) { onMatch(); }
  }

  function onMatch() {
    if (L3.phase === 'A') {
      if (L3.done) { return; }
      L3.done = true;
      L3.locked = true;
      say('两行进货单同时对上，配方就解出来了');
      setTimeout(function () {
        $('footTxt').textContent = '原来他卖 ' + L3.cups[0] + ' 杯经典、' + L3.cups[1] + ' 杯牛乳';
        btn('看看他上的新品', function () { phaseB(); });
      }, 800);
    } else {
      var last = L3.spots[L3.spots.length - 1];
      if (last && Math.abs(last[0] - L3.cups[0]) + Math.abs(last[1] - L3.cups[1]) < 14) { return; }
      L3.spots.push([L3.cups[0], L3.cups[1]]);
      L3.found++;
      var g = $('spots');
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', px(L3.cups[0]));
      c.setAttribute('cy', py(L3.cups[1]));
      c.setAttribute('r', 3.4);
      c.setAttribute('fill', '#4E9E75');
      g.appendChild(c);
      paintFound();
    }
  }

  function paintFound() {
    var el = $('found');
    if (L3.found >= 4) {
      el.innerHTML = '找到 <b>' + L3.found + '</b> 个答案了 —— 还能继续找，<b>无穷多个</b>';
      L3.locked = true;
      say('两行约束其实只有一行，怎么拖都对得上');
      btn('听我说一句', function () { showEnd(); });
    } else {
      el.innerHTML = '已经找到 <b>' + L3.found + '</b> 个答案';
    }
  }

  function buildCups3(names) {
    var html = '', i;
    for (i = 0; i < 2; i++) {
      html += '<div class="col" data-i="' + i + '">' +
        '<div class="cupwrap">' + cupSVG(DRINK[L3.drinks[i]].c) + '</div>' +
        '<div class="cnum"><span>0</span><em>杯</em></div>' +
        '<div class="sl"><div class="sl-track"><i class="sl-fill"></i><b class="sl-mark"></b></div>' +
        '<div class="sl-thumb"></div></div>' +
        '<div class="cname">' + names[i] + '</div></div>';
    }
    $('s3cups').innerHTML = html;

    L3.sliders = [];
    var sls = $('s3cups').getElementsByClassName('sl');
    for (i = 0; i < sls.length; i++) {
      (function (k, el) {
        L3.sliders.push(makeSlider(el, {
          min: 0, max: 300, value: 0,
          locked: function () { return L3.locked; },
          onChange: function (v) {
            L3.cups[k] = v;
            solveSnap();
            paintL3(false);
          }
        }));
      })(i, sls[i]);
    }
  }

  function paintBill() {
    $('bill').innerHTML =
      '<i>茶<b>' + L3.bill[0].toFixed(1) + '</b><em>kg</em></i>' +
      '<i>奶<b>' + L3.bill[1].toFixed(1) + '</b><em>kg</em></i>';

    $('diff').innerHTML =
      '<div class="drow"><span class="dk">茶</span><span class="dbar"><i></i></span>' +
      '<span class="dv"></span></div>' +
      '<div class="drow"><span class="dk">奶</span><span class="dbar"><i></i></span>' +
      '<span class="dv"></span></div>';
  }

  function startL3() {
    L3.phase = 'A';
    L3.done = false;
    L3.locked = false;
    L3.found = 0;
    L3.spots = [];
    L3.drinks = [0, 1];
    L3.bill = [40, 45];
    L3.cups = [0, 0];

    $('s3title').textContent = '隔壁的进货单';
    $('s3sub').textContent = '只卖经典和牛乳两款';
    $('found').textContent = '';
    paintBill();
    buildCups3(['经典', '牛乳']);
    buildMap();
    paintL3(false);
    say('拖圆点，让两行都“正好”');
    hideBtn();
  }

  function phaseB() {
    L3.phase = 'B';
    L3.done = false;
    L3.locked = false;
    L3.found = 0;
    L3.spots = [];
    L3.drinks = [0, 3];
    L3.bill = [60, 30];
    L3.cups = [0, 0];

    $('s3title').textContent = '他也上了超大杯';
    $('s3sub').textContent = '现在只卖经典和超大杯';
    paintBill();
    buildCups3(['经典', '超大杯']);
    buildMap();
    paintL3(false);
    say('再试着把两行对上');
    hideBtn();
  }

  /* =========================================================
     结算
     ========================================================= */
  function showEnd() {
    $('foot').style.visibility = 'hidden';
    $('endBody').innerHTML =
      '第一关：4 种原料 × 3 款饮品，一行一个「乘了再加」，一次算出 4 个总量 <b>b = X·w</b>。换单只换 w，X 一个数不动。<br><br>' +
      '第二关：超大杯就是经典 ×1.5，第 4 款没有带来新配方 —— 这叫<b>秩不够</b>。<br><br>' +
      '第三关：两行约束重复，答案就有无穷多个 —— 你分不开它，也就是<b>不可逆</b>。<br><br>' +
      '表格记的是数据，矩阵记的是数据和算法之间的关系。';
    $('end').className = 'end on';
  }

  /* =========================================================
     启动
     ========================================================= */
  function boot() {
    fitU();
    window.addEventListener('resize', fitU);
    window.addEventListener('orientationchange', function () {
      setTimeout(fitU, 120);
    });

    buildCups1();
    buildGrid();
    startL1();
    goScene(1);

    $('againBtn').onclick = function () {
      $('end').className = 'end';
      $('foot').style.visibility = '';
      L1.vals = [0, 0, 0];
      L1.hit = [false, false, false];
      for (var i = 0; i < 3; i++) {
        L1.sliders[i].set(0, true);
        L1.cols[i].getElementsByTagName('span')[0].textContent = '0';
        liquid(i, 0);
      }
      startL1();
      goScene(1);
      startL2();
      startL3();
    };
  }

  window.__m = {
    set1: function (i, v) { L1.sliders[i].set(v); return L1.vals; },
    get1: function () { return L1.vals; },
    pick: function (k) { pick(k); },
    ratio: function (v) { L2.sl.set(v * 100); },
    set3: function (x, y) { setCups(x, y, false); },
    go: function (n) {
      goScene(n);
      if (n === 2) { startL2(); }
      if (n === 3) { startL3(); }
    },
    phaseB: function () { phaseB(); },
    end: function () { showEnd(); },
    L1: L1, L2: L2, L3: L3
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
