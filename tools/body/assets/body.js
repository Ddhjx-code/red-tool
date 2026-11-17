/* 体重围度 —— 记体重和腰围，看趋势不看单日。
   纯本地，无网络无权限。Chrome 61 基线：无箭头函数 / 模板串 / let / const。 */

var state = { u: 3.9, tab: 0, range: 7, recs: [], toastTimer: null };

/* ---------- 存储 ---------- */
function load() {
  try {
    var raw = localStorage.getItem('body.v1');
    var arr = raw ? JSON.parse(raw) : null;
    if (arr && arr.length) state.recs = arr;
  } catch (e) { state.recs = []; }
}
function save() {
  state.recs.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  try { localStorage.setItem('body.v1', JSON.stringify(state.recs)); } catch (e) {}
}

/* ---------- 日期 ---------- */
function ymd(d) {
  var m = d.getMonth() + 1, dd = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dd < 10 ? '0' + dd : dd);
}
function parse(s) {
  var p = String(s).split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}
function today() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function md(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }

/* ---------- 记录 ---------- */
function renderRec() {
  var t = today();
  document.getElementById('dayline').innerHTML = md(t) + ' · 周' +
    ['日', '一', '二', '三', '四', '五', '六'][t.getDay()];

  var n = state.recs.length;
  var last = n ? state.recs[n - 1] : null;
  var first = n ? state.recs[0] : null;

  document.getElementById('bigNum').innerHTML = last ? fmt(last.w) : '还没记';
  document.getElementById('bigUnit').innerHTML = last ? 'kg' : '';
  document.getElementById('big').className = last ? '' : 'na';

  var sub = '';
  if (!last) {
    sub = '还没有记录，先称一次';
  } else {
    var dv = last.w - first.w;
    sub = md(parse(last.d)) + ' 称的';
    if (n > 1) {
      var sign = dv > 0 ? '+' : '';
      sub += ' · 比第一天 ' + sign + fmt(dv) + ' kg';
    }
  }
  document.getElementById('bigSub').innerHTML = sub;

  var box = document.getElementById('recs');
  if (!n) { box.innerHTML = ''; return; }
  var html = '<div class="rtitle">最近记录</div>';
  var cnt = 0;
  for (var i = n - 1; i >= 0 && cnt < 4; i--) {
    var r = state.recs[i];
    var prev = i > 0 ? state.recs[i - 1] : null;
    var d2 = prev ? r.w - prev.w : 0;
    var cls = d2 > 0 ? 'up' : (d2 < 0 ? 'down' : '');
    var dtxt = '';
    if (prev) dtxt = (d2 > 0 ? '+' : '') + fmt(d2);
    html += '<div class="rr">' +
      '<span class="rd">' + md(parse(r.d)) + '</span>' +
      '<span class="rw">' + fmt(r.w) + ' kg' + (r.wa ? ' · 腰 ' + fmt(r.wa) : '') + '</span>' +
      '<span class="rv ' + cls + '">' + dtxt + '</span>' +
    '</div>';
    cnt++;
  }
  box.innerHTML = html;
}

function fmt(n) {
  var v = Math.round(n * 10) / 10;
  return (v === Math.floor(v) ? v.toFixed(1) : String(v));
}

function commit() {
  var w = parseFloat(document.getElementById('fw').value);
  var wa = parseFloat(document.getElementById('fwa').value);
  if (!(w > 0)) { toast('先填体重'); return; }
  if (w < 20 || w > 300) { toast('这个数看着不对'); return; }

  var t = today(), k = ymd(t);
  var hit = false;
  for (var i = 0; i < state.recs.length; i++) {
    if (state.recs[i].d === k) {
      state.recs[i].w = w;
      state.recs[i].wa = wa > 0 ? wa : state.recs[i].wa;
      hit = true;
    }
  }
  if (!hit) state.recs.push({ d: k, w: w, wa: wa > 0 ? wa : null });
  save();
  document.getElementById('fw').value = '';
  document.getElementById('fwa').value = '';
  toast(hit ? '今天改好了' : '记下了');
  haptic();
  renderRec();
}

/* ---------- 曲线 ---------- */
function sliceRange() {
  if (!state.range) return state.recs;
  var t = today();
  var from = new Date(t.getFullYear(), t.getMonth(), t.getDate() - state.range + 1);
  var out = [];
  for (var i = 0; i < state.recs.length; i++) {
    if (parse(state.recs[i].d) >= from) out.push(state.recs[i]);
  }
  return out;
}

function renderChart() {
  var cv = document.getElementById('chart');
  var wrap = document.getElementById('chartWrap');
  var list = sliceRange();
  var W = wrap.clientWidth || 320;
  var H = wrap.clientHeight || 320;
  var dpr = window.devicePixelRatio || 1;

  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';

  var g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);

  var showWa = hasWa(list);
  document.getElementById('legend').innerHTML =
    '<span><i class="lg-w"></i>体重 kg</span>' +
    (showWa ? '<span><i class="lg-a"></i>腰围 cm</span>' : '<span class="dim">还没记过腰围</span>');

  if (list.length < 2) {
    g.fillStyle = '#A79E92';
    g.font = '13px "PingFang SC", sans-serif';
    g.textAlign = 'center';
    g.fillText(list.length ? '再记一天就能连线' : '还没有记录', W / 2, H / 2);
    g.textAlign = 'left';
    return;
  }

  var padL = 38, padR = 16, padT = 34, padB = 24;
  var iw = W - padL - padR;
  var allH = H - padT - padB;
  var hW = showWa ? allH * 0.58 : allH * 0.94;
  var hA = allH * 0.24;
  var wTop = padT, wBot = padT + hW;
  var aTop = wBot + (showWa ? allH * 0.16 : 0), aBot = aTop + hA;

  function X(k) { return padL + iw * k / (list.length - 1); }
  function scale(vals, top, bot, extra) {
    var lo = 1e9, hi = -1e9, i;
    for (i = 0; i < vals.length; i++) {
      if (vals[i] === null) continue;
      if (vals[i] < lo) lo = vals[i];
      if (vals[i] > hi) hi = vals[i];
    }
    if (lo > hi) { lo = 0; hi = 1; }
    var pad = Math.max(extra, (hi - lo) * 0.32);
    lo -= pad; hi += pad;
    return { lo: lo, hi: hi, Y: function (v) { return bot - (v - lo) / (hi - lo) * (bot - top); } };
  }

  var wv = [], av = [], i;
  for (i = 0; i < list.length; i++) {
    wv.push(list[i].w);
    av.push(list[i].wa || null);
  }
  var sw = scale(wv, wTop, wBot, 0.4);
  var sa = scale(av, aTop, aBot, 0.8);

  g.font = '10px "PingFang SC", sans-serif';

  /* 体重面板：三条横线 + 刻度 */
  var k;
  for (k = 0; k <= 2; k++) {
    var vv = sw.lo + (sw.hi - sw.lo) * k / 2;
    var yy = sw.Y(vv);
    g.strokeStyle = 'rgba(35,32,28,0.08)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(padL, yy);
    g.lineTo(W - padR, yy);
    g.stroke();
    g.fillStyle = '#B0A79B';
    g.fillText(fmt1(vv), 2, yy + 3);
  }

  /* 面积 */
  g.beginPath();
  g.moveTo(X(0), sw.Y(list[0].w));
  for (k = 1; k < list.length; k++) g.lineTo(X(k), sw.Y(list[k].w));
  g.lineTo(X(list.length - 1), wBot);
  g.lineTo(X(0), wBot);
  g.closePath();
  var grad = g.createLinearGradient(0, wTop, 0, wBot);
  grad.addColorStop(0, 'rgba(35,32,28,0.10)');
  grad.addColorStop(1, 'rgba(35,32,28,0)');
  g.fillStyle = grad;
  g.fill();

  /* 体重折线 */
  g.beginPath();
  for (k = 0; k < list.length; k++) {
    var xk = X(k), yk = sw.Y(list[k].w);
    if (k === 0) g.moveTo(xk, yk); else g.lineTo(xk, yk);
  }
  g.strokeStyle = '#23201C';
  g.lineWidth = 2;
  g.lineJoin = 'round';
  g.stroke();

  /* 每个点：两天以上才点出来，否则太密 */
  if (list.length <= 14) {
    for (k = 0; k < list.length; k++) {
      g.beginPath();
      g.arc(X(k), sw.Y(list[k].w), 1.9, 0, Math.PI * 2);
      g.fillStyle = '#23201C';
      g.fill();
    }
  }

  /* 末值强调 */
  var lx = X(list.length - 1), ly = sw.Y(list[list.length - 1].w);
  g.beginPath();
  g.arc(lx, ly, 4, 0, Math.PI * 2);
  g.fillStyle = '#23201C';
  g.fill();
  g.beginPath();
  g.arc(lx, ly, 8.5, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(35,32,28,0.16)';
  g.lineWidth = 1.5;
  g.stroke();

  /* 腰围面板 */
  if (showWa) {
    g.strokeStyle = 'rgba(35,32,28,0.06)';
    g.beginPath();
    g.moveTo(padL, aBot);
    g.lineTo(W - padR, aBot);
    g.stroke();

    g.beginPath();
    var started = false;
    for (k = 0; k < list.length; k++) {
      if (!list[k].wa) continue;
      var xa = X(k), ya = sa.Y(list[k].wa);
      if (!started) { g.moveTo(xa, ya); started = true; } else g.lineTo(xa, ya);
    }
    g.strokeStyle = '#9CC3E6';
    g.lineWidth = 1.8;
    g.lineJoin = 'round';
    g.stroke();

    for (k = 0; k < list.length; k++) {
      if (!list[k].wa) continue;
      g.beginPath();
      g.arc(X(k), sa.Y(list[k].wa), 2.2, 0, Math.PI * 2);
      g.fillStyle = '#9CC3E6';
      g.fill();
    }
    g.fillStyle = '#B0A79B';
    g.fillText(fmt1(sa.hi), 2, aTop + 8);
    g.fillText(fmt1(sa.lo), 2, aBot - 1);
  }

  /* 面板标题 */
  g.fillStyle = '#8C8378';
  g.font = '10px "PingFang SC", sans-serif';
  g.fillText('体重 kg', 2, wTop - 12);
  if (showWa) g.fillText('腰围 cm', 2, aTop - 10);

  /* 横轴 */
  g.fillStyle = '#B0A79B';
  g.fillText(md(parse(list[0].d)), padL, H - 6);
  g.textAlign = 'right';
  g.fillText(md(parse(list[list.length - 1].d)), W - padR, H - 6);
  g.textAlign = 'left';
}

function fmt1(v) { return String(Math.round(v * 10) / 10); }
function hasWa(list) {
  for (var i = 0; i < list.length; i++) if (list[i].wa) return true;
  return false;
}

/* ---------- 小结 ---------- */
function renderSum() {
  var box = document.getElementById('sumList');
  var n = state.recs.length;
  if (!n) {
    box.innerHTML = '<div class="empty">还没有数据<br/>回去记两天，这里就有东西看</div>';
    document.getElementById('sumNote').style.display = 'none';
    return;
  }
  var first = state.recs[0], last = state.recs[n - 1];
  var lo = 1e9, hi = -1e9, sum = 0;
  for (var i = 0; i < n; i++) {
    if (state.recs[i].w < lo) lo = state.recs[i].w;
    if (state.recs[i].w > hi) hi = state.recs[i].w;
    sum += state.recs[i].w;
  }
  var dv = last.w - first.w;
  var days = Math.round((parse(last.d) - parse(first.d)) / 86400000) + 1;

  var rows = [
    ['起始', first.w, 'kg · ' + md(parse(first.d))],
    ['现在', last.w, 'kg · ' + md(parse(last.d))],
    ['变化', dv, 'kg'],
    ['最低', lo, 'kg'],
    ['平均', sum / n, 'kg'],
    ['记录', n, '天 / 跨度 ' + days + ' 天']
  ];
  var html = '';
  for (var j = 0; j < rows.length; j++) {
    var k = rows[j][0], v = rows[j][1], u = rows[j][2];
    var cls = '';
    var vs = (k === '记录') ? String(v) : fmt(v);
    if (k === '变化') {
      cls = v > 0 ? 'up' : (v < 0 ? 'down' : '');
      vs = (v > 0 ? '+' : '') + fmt(v);
    }
    html += '<div class="sr">' +
      '<span class="sk">' + k + '</span>' +
      '<span class="sv ' + cls + '">' + vs + '<em>' + u + '</em></span>' +
    '</div>';
  }
  box.innerHTML = html;
  document.getElementById('sumNote').style.display = 'block';

  var note = '一天的体重说明不了什么，看一周的平均。';
  if (n >= 3) {
    var week = state.recs.slice(-7);
    var s2 = 0;
    for (var q = 0; q < week.length; q++) s2 += week[q].w;
    var avg = s2 / week.length;
    note = '最近 ' + week.length + ' 天平均 ' + fmt(avg) + ' kg。' +
      (Math.abs(dv) < 0.3 ? '整体还算稳。' : (dv < 0 ? '比开头轻了 ' + fmt(-dv) + ' kg。' : '比开头重了 ' + fmt(dv) + ' kg。'));
  }
  document.getElementById('sumNote').innerHTML = note;
}

/* ---------- 通用 ---------- */
function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast on';
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(function () { t.className = 'toast'; }, 1400);
}
function haptic() {
  try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
}
function showTab(i) {
  state.tab = i;
  var pages = ['pRec', 'pChart', 'pSum'];
  for (var j = 0; j < 3; j++) {
    document.getElementById(pages[j]).className = j === i ? 'page on' : 'page';
    document.getElementById('t' + j).className = j === i ? 'tab on' : 'tab';
  }
  if (i === 0) renderRec();
  if (i === 1) { renderChart(); setTimeout(renderChart, 60); }
  if (i === 2) renderSum();
}

/* ---------- 调试参数（出货无副作用） ---------- */
function param(name) {
  var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
  return m ? decodeURIComponent(m[1]) : '';
}
function seed() {
  var t = today();
  var plan = [62.8, 62.6, 62.9, 62.4, 62.2, 62.5, 62.1, 61.9, 62.0, 61.6,
              61.8, 61.5, 61.3, 61.6, 61.2, 61.0, 61.3, 60.9, 60.8, 61.0,
              60.6, 60.7, 60.4, 60.5, 60.2, 60.4, 60.1, 60.0, 60.2, 59.9];
  var wa = [76, 0, 75.5, 0, 75.5, 0, 75, 0, 75, 74.5,
            0, 74.5, 0, 74, 0, 74, 74, 0, 73.5, 0,
            73.5, 0, 73, 0, 73, 0, 72.5, 0, 72.5, 72];
  state.recs = [];
  for (var i = 0; i < plan.length; i++) {
    var d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (plan.length - 1 - i));
    state.recs.push({ d: ymd(d), w: plan[i], wa: wa[i] || null });
  }
  save();
}

/* ---------- 启动 ---------- */
function boot() {
  state.u = document.documentElement.clientWidth / 100;
  document.documentElement.style.setProperty('--u', state.u + 'px');
  load();
  if (param('still')) document.documentElement.className = 'still';
  if (param('seed')) seed();

  document.getElementById('saveBtn').onclick = commit;

  var rgs = document.getElementById('range').getElementsByClassName('rg');
  for (var i = 0; i < rgs.length; i++) {
    rgs[i].onclick = function () {
      for (var j = 0; j < rgs.length; j++) rgs[j].className = 'rg';
      this.className = 'rg on';
      state.range = parseInt(this.getAttribute('data-r'), 10);
      renderChart();
    };
  }

  for (var k = 0; k < 3; k++) {
    document.getElementById('t' + k).onclick = (function (n) {
      return function () { showTab(n); };
    })(k);
  }
  showTab(parseInt(param('tab') || '0', 10) || 0);
}

window.onresize = function () {
  state.u = document.documentElement.clientWidth / 100;
  document.documentElement.style.setProperty('--u', state.u + 'px');
  if (state.tab === 1) renderChart();
};

if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
else document.addEventListener('DOMContentLoaded', boot);
