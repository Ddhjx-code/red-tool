/* 今天什么颜色 —— 每天点一格，月底成一张卡。
   纯本地，无网络无权限。Chrome 61 基线：无箭头函数 / 模板串 / let / const。 */

var U = function (n) { return n * state.u; };

var COLORS = [
  { n: '平静', c: '#9CC3E6', d: 1, e: '\uD83D\uDE0C' },
  { n: '开心', c: '#F8D27C', d: 1, e: '\uD83D\uDE04' },
  { n: '专注', c: '#86C9A8', d: 1, e: '\uD83E\uDD13' },
  { n: '兴奋', c: '#F9A26B', d: 1, e: '\uD83E\uDD29' },
  { n: '疲惫', c: '#C2B3DB', d: 1, e: '\uD83D\uDE2A' },
  { n: '烦躁', c: '#E77E86', d: 1, e: '\uD83D\uDE24' },
  { n: '委屈', c: '#8E9BD6', d: 1, e: '\uD83E\uDD7A' },
  { n: '空白', c: '#E8E2D8', d: 1, e: '\uD83D\uDE10' }
];

var WEEK = ['一', '二', '三', '四', '五', '六', '日'];
var MONTH_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

var state = { u: 3.9, tab: 0, pick: -1, mood: 0, data: {}, toastTimer: null };

/* ---------- 存储 ---------- */
function load() {
  try {
    var raw = localStorage.getItem('color.v1');
    if (raw) state.data = JSON.parse(raw) || {};
  } catch (e) { state.data = {}; }
  /* 数据自检：颜色下标越界或结构不对就丢掉，避免整页渲染中断 */
  if (!state.data || typeof state.data !== 'object') state.data = {};
  for (var k in state.data) {
    var r = state.data[k];
    if (!r || typeof r.c !== 'number' || !COLORS[r.c]) delete state.data[k];
  }
}
function save() {
  try { localStorage.setItem('color.v1', JSON.stringify(state.data)); } catch (e) {}
}

/* ---------- 日期 ---------- */
function key(d) {
  var m = d.getMonth() + 1;
  var dd = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dd < 10 ? '0' + dd : dd);
}
function today() { return new Date(); }
function daysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }
/* 周一为一周起点：返回 0..6 */
function firstOffset(y, m) {
  var w = new Date(y, m, 1).getDay();
  return (w + 6) % 7;
}

/* ---------- 今天 ---------- */
function renderToday() {
  var d = today();
  var el = document.getElementById('dayline');
  el.innerHTML = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 周' + WEEK[(d.getDay() + 6) % 7];

  var box = document.getElementById('palette');
  var html = '';
  for (var i = 0; i < COLORS.length; i++) {
    html += '<div class="sw" data-i="' + i + '">' +
      '<i style="background:' + COLORS[i].c + '"><b>' + COLORS[i].e + '</b></i>' +
      '<span>' + COLORS[i].n + '</span></div>';
  }
  box.innerHTML = html;

  var items = box.getElementsByClassName('sw');
  for (var j = 0; j < items.length; j++) {
    items[j].onclick = function () { pickColor(parseInt(this.getAttribute('data-i'), 10)); };
  }

  renderRecent(d);

  var t = state.data[key(d)];
  if (t) {
    pickColor(t.c, true);
    document.getElementById('note').value = t.t || '';
    document.getElementById('saveBtn').textContent = '改一下';
  } else {
    state.pick = -1;
    document.getElementById('note').value = '';
    document.getElementById('saveBtn').textContent = '记下来';
    syncSave();
  }
}

/* 最近七天 + 本月统计 */
function renderRecent(d) {
  var strip = document.getElementById('strip');
  var html = '';
  var names = ['日', '一', '二', '三', '四', '五', '六'];
  for (var i = 6; i >= 0; i--) {
    var dd = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    var rec = state.data[key(dd)];
    var cls = 'rd' + (i === 0 ? ' today' : '');
    var bg = rec ? 'background:' + COLORS[rec.c].c + ';border-style:solid;border-color:transparent;' : '';
    var em = rec ? COLORS[rec.c].e : '';
    html += '<div class="' + cls + '"><i style="' + bg + '">' + em + '</i><span>' + names[dd.getDay()] + '</span></div>';
  }
  strip.innerHTML = html;

  var y = d.getFullYear(), m = d.getMonth();
  var n = daysIn(y, m), total = 0;
  for (var j = 1; j <= n; j++) {
    var k = y + '-' + (m + 1 < 10 ? '0' + (m + 1) : m + 1) + '-' + (j < 10 ? '0' + j : j);
    if (state.data[k]) total++;
  }
  /* 连续天数：从今天往回数，今天没记就从昨天算 */
  var streak = 0;
  var cur = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (!state.data[key(cur)]) cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1);
  while (state.data[key(cur)]) {
    streak++;
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1);
  }

  var line = '本月记了 ' + total + ' 天';
  if (streak > 0) line += ' · 连续 ' + streak + ' 天';
  document.getElementById('mLine').innerHTML = line;

  /* 本月颜色分布：按占比铺一条 */
  var counts = {};
  var sum = 0;
  for (var q = 1; q <= n; q++) {
    var kk = y + '-' + (m + 1 < 10 ? '0' + (m + 1) : m + 1) + '-' + (q < 10 ? '0' + q : q);
    var r = state.data[kk];
    if (r) { counts[r.c] = (counts[r.c] || 0) + 1; sum++; }
  }
  var bar = document.getElementById('distBar');
  var cap = document.getElementById('distCap');
  if (!sum) {
    bar.innerHTML = '<i class="seg empty"></i>';
    cap.innerHTML = '还没开始记';
    return;
  }
  var order = [];
  for (var c2 in counts) order.push(parseInt(c2, 10));
  order.sort(function (a, b) { return counts[b] - counts[a]; });
  var bh = '';
  var cp = [];
  for (var z = 0; z < order.length; z++) {
    bh += '<i class="seg" style="width:' + (counts[order[z]] / sum * 100) + '%;background:' +
      COLORS[order[z]].c + '"></i>';
    if (z < 3) cp.push(COLORS[order[z]].n + ' ' + counts[order[z]]);
  }
  bar.innerHTML = bh;
  cap.innerHTML = cp.join(' · ');
}

function pickColor(i, silent) {
  state.pick = i;
  var items = document.getElementById('palette').getElementsByClassName('sw');
  for (var j = 0; j < items.length; j++) {
    if (j === i) items[j].className = 'sw on';
    else items[j].className = 'sw';
  }
  syncSave();
  if (!silent) haptic();
}

function syncSave() {
  /* 按钮永远可点、永远是实心深色：不让审核或用户误以为是禁用态 */
  var b = document.getElementById('saveBtn');
  b.className = 'btn';
  var tip = document.getElementById('tip');
  if (tip) tip.style.display = state.pick < 0 ? 'block' : 'none';
  var txt = document.getElementById('note').value;
  document.getElementById('count').innerHTML = txt.length + '/14';
}

function nudge() {
  var pal = document.getElementById('palette');
  var page = document.getElementById('pToday');
  if (page.scrollTop > 0) page.scrollTop = 0;
  pal.className = 'shake';
  setTimeout(function () { pal.className = ''; }, 460);
}

function commit() {
  if (state.pick < 0) {
    toast('先点一个颜色');
    nudge();
    haptic();
    return;
  }
  var d = today();
  var txt = document.getElementById('note').value.replace(/^\s+|\s+$/g, '');
  state.data[key(d)] = { c: state.pick, t: txt };
  save();
  toast('记下了');
  haptic();
  setTimeout(function () { showTab(1); }, 320);
}

/* ---------- 这个月 ---------- */
function renderMonth() {
  var d = today();
  var y = d.getFullYear();
  var m = d.getMonth() + state.mood;
  var dt = new Date(y, m, 1);
  y = dt.getFullYear();
  m = dt.getMonth();

  var n = daysIn(y, m);
  var off = firstOffset(y, m);
  var counts = {};
  var total = 0;
  var cells = '';

  for (var p = 0; p < off; p++) cells += '<div class="mc pad"></div>';

  for (var i = 1; i <= n; i++) {
    var k = y + '-' + (m + 1 < 10 ? '0' + (m + 1) : m + 1) + '-' + (i < 10 ? '0' + i : i);
    var rec = state.data[k];
    if (rec) {
      total++;
      counts[rec.c] = (counts[rec.c] || 0) + 1;
      cells += '<div class="mc f" style="background:' + COLORS[rec.c].c + '">' +
        '<b>' + i + '</b><u>' + COLORS[rec.c].e + '</u></div>';
    } else {
      cells += '<div class="mc"><b>' + i + '</b></div>';
    }
  }

  var stat = '';
  var order = [];
  for (var c in counts) order.push(parseInt(c, 10));
  order.sort(function (a, b) { return counts[b] - counts[a]; });
  for (var q = 0; q < order.length && q < 3; q++) {
    if (q) stat += ' · ';
    stat += COLORS[order[q]].n + ' ' + counts[order[q]] + ' 天';
  }
  if (!stat) stat = '这个月还没开始记';

  document.getElementById('mTitle').innerHTML = y + ' 年 ' + (m + 1) + ' 月';
  document.getElementById('mStat').innerHTML = stat;
  document.getElementById('mGrid').innerHTML = cells;
  document.getElementById('mTotal').innerHTML = '已记录 ' + total + ' / ' + n + ' 天';

  /* 逐色统计 */
  var all = [];
  for (var w2 in counts) all.push(parseInt(w2, 10));
  all.sort(function (a, b) { return counts[b] - counts[a]; });
  var mx = all.length ? counts[all[0]] : 0;
  var dh = '';
  for (var e = 0; e < all.length; e++) {
    var pc = mx ? Math.round(counts[all[e]] / mx * 100) : 0;
    dh += '<div class="dl"><i style="background:' + COLORS[all[e]].c + '"></i>' +
      '<span class="dn">' + COLORS[all[e]].n + '</span>' +
      '<span class="db"><b style="width:' + pc + '%;background:' + COLORS[all[e]].c + '"></b></span>' +
      '<span class="dc">' + counts[all[e]] + '</span></div>';
  }
  document.getElementById('mDist').innerHTML = dh;
  document.getElementById('prevM').className = 'arrow';
  document.getElementById('nextM').className = state.mood < 0 ? 'arrow' : 'arrow dim';
}

/* ---------- 月卡 ---------- */
function renderCard() {
  var d = today();
  var y = d.getFullYear();
  var m = d.getMonth();
  var n = daysIn(y, m);
  var off = firstOffset(y, m);
  var counts = {};
  var best = -1;

  var W = 900, H = 1200;
  var cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  var g = cv.getContext('2d');

  g.fillStyle = '#FFFDF9';
  g.fillRect(0, 0, W, H);

  /* 顶部标题 */
  g.fillStyle = '#8C8378';
  g.font = '24px "PingFang SC", sans-serif';
  g.fillText(y + ' 年 ' + (m + 1) + ' 月', 72, 108);

  for (var i = 0; i < n; i++) {
    var k = y + '-' + (m + 1 < 10 ? '0' + (m + 1) : m + 1) + '-' + (i + 1 < 10 ? '0' + (i + 1) : i + 1);
    var rec = state.data[k];
    if (rec) counts[rec.c] = (counts[rec.c] || 0) + 1;
  }
  var maxn = 0;
  for (var c in counts) if (counts[c] > maxn) { maxn = counts[c]; best = parseInt(c, 10); }

  var line1 = (m + 1) + ' 月，';
  var line2 = best >= 0 ? ('大部分时间是' + COLORS[best].n) : '这个月还没开始';
  g.fillStyle = '#23201C';
  g.font = '600 62px "PingFang SC", sans-serif';
  g.fillText(line1, 72, 200);
  g.fillText(line2, 72, 282);

  /* 月历格阵 */
  var gx = 72, gy = 372, cw = 96, gap = 12;
  g.font = '22px "PingFang SC", sans-serif';
  g.fillStyle = '#8C8378';
  for (var w = 0; w < 7; w++) g.fillText(WEEK[w], gx + w * (cw + gap) + 34, gy - 18);

  for (var day = 1; day <= n; day++) {
    var idx = off + day - 1;
    var col = idx % 7;
    var row = Math.floor(idx / 7);
    var x = gx + col * (cw + gap);
    var yy = gy + row * (cw + gap);
    var kk = y + '-' + (m + 1 < 10 ? '0' + (m + 1) : m + 1) + '-' + (day < 10 ? '0' + day : day);
    var r2 = state.data[kk];
    if (r2) {
      g.fillStyle = COLORS[r2.c].c;
      rr(g, x, yy, cw, cw, 18); g.fill();
      g.save();
      g.shadowColor = 'rgba(255,253,249,0.55)';
      g.shadowBlur = 6;
      g.font = '34px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      g.textAlign = 'center';
      g.fillStyle = '#23201C';
      g.fillText(COLORS[r2.c].e, x + cw / 2, yy + cw / 2 + 12);
      g.restore();
      g.fillStyle = 'rgba(59,52,44,0.72)';
      g.font = '22px "PingFang SC", sans-serif';
      g.fillText(String(day), x + 10, yy + 26);
    } else {
      g.strokeStyle = 'rgba(35,32,28,0.14)';
      g.lineWidth = 1.5;
      rr(g, x + 0.75, yy + 0.75, cw - 1.5, cw - 1.5, 18); g.stroke();
    }
  }

  /* 图例 */
  var ly = 1012;
  g.font = '24px "PingFang SC", sans-serif';
  var used = [];
  for (var cc in counts) used.push(parseInt(cc, 10));
  used.sort(function (a, b) { return counts[b] - counts[a]; });
  for (var u2 = 0; u2 < used.length && u2 < 8; u2++) {
    var cx = 72 + (u2 % 4) * 200;
    var cy = ly + Math.floor(u2 / 4) * 56;
    g.fillStyle = COLORS[used[u2]].c;
    rr(g, cx, cy - 18, 26, 26, 8); g.fill();
    g.fillStyle = '#6B635A';
    g.fillText(COLORS[used[u2]].e + ' ' + COLORS[used[u2]].n + ' ' + counts[used[u2]], cx + 36, cy + 2);
  }

  g.fillStyle = '#8C8378';
  g.font = '22px "PingFang SC", sans-serif';
  g.fillText('今天什么颜色 · 每天一格', 72, 1128);

  var img = document.getElementById('cardImg');
  img.src = cv.toDataURL('image/png');
  img.style.display = 'block';
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
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
  var pages = ['pToday', 'pMonth', 'pCard'];
  for (var j = 0; j < 3; j++) {
    document.getElementById(pages[j]).className = j === i ? 'page on' : 'page';
    document.getElementById('t' + j).className = j === i ? 'tab on' : 'tab';
  }
  if (i === 0) renderToday();
  if (i === 1) renderMonth();
  if (i === 2) renderCard();
}

/* ---------- 调试参数（出货无副作用） ----------
   ?seed=1 造本月示例数据，?tab=0/1/2 直达某屏 */
function param(name) {
  var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
  return m ? decodeURIComponent(m[1]) : '';
}
function seed() {
  var d = today(), y = d.getFullYear(), m = d.getMonth();
  var plan = [0, 1, 0, 2, 4, 1, 0, 5, 0, 1, 3, 0, 0, 2, 1, 6, 0, 4, 1, 0, 0, 2, 1, 0];
  for (var i = 0; i < plan.length && i < d.getDate(); i++) {
    var k = y + '-' + (m + 1 < 10 ? '0' + (m + 1) : m + 1) + '-' + (i + 1 < 10 ? '0' + (i + 1) : i + 1);
    state.data[k] = { c: plan[i], t: '' };
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
  document.getElementById('note').oninput = syncSave;
  document.getElementById('prevM').onclick = function () { state.mood--; renderMonth(); };
  document.getElementById('nextM').onclick = function () {
    if (state.mood >= 0) return;
    state.mood++; renderMonth();
  };
  for (var i = 0; i < 3; i++) {
    document.getElementById('t' + i).onclick = (function (k) {
      return function () { showTab(k); };
    })(i);
  }
  document.getElementById('cardRefresh').onclick = renderCard;

  showTab(parseInt(param('tab') || '0', 10) || 0);
}

window.onresize = function () {
  state.u = document.documentElement.clientWidth / 100;
  document.documentElement.style.setProperty('--u', state.u + 'px');
};

if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
else document.addEventListener('DOMContentLoaded', boot);
