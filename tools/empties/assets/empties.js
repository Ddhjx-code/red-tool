/* 空瓶记 —— 护肤品开封台账。按到期日排序，快到期先跳出来。
   纯本地，无网络无权限。Chrome 61 基线：无箭头函数 / 模板串 / let / const。 */

var CATS = [
  { k: 'sk', n: '护肤', c: '#86C9A8' },
  { k: 'mk', n: '彩妆', c: '#F9A26B' },
  { k: 'sun', n: '防晒', c: '#F8D27C' },
  { k: 'hair', n: '洗护', c: '#9CC3E6' },
  { k: 'body', n: '身体', c: '#C2B3DB' }
];
var PAOS = [3, 6, 12, 24];

var state = {
  u: 3.9, tab: 0, items: [], cat: 'sk', pao: 12, sel: null, toastTimer: null
};

/* ---------- 存储 ---------- */
function load() {
  try {
    var raw = localStorage.getItem('empties.v1');
    var arr = raw ? JSON.parse(raw) : null;
    if (arr && arr.length) state.items = arr;
  } catch (e) { state.items = []; }
}
function save() {
  try { localStorage.setItem('empties.v1', JSON.stringify(state.items)); } catch (e) {}
}

/* ---------- 日期 ---------- */
function ymd(d) {
  var m = d.getMonth() + 1, dd = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dd < 10 ? '0' + dd : dd);
}
function parse(s) {
  var p = String(s || '').split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}
function today() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function days(a, b) {
  return Math.round((b - a) / 86400000);
}
/* 开封日 + N 个月 */
function expireOf(it) {
  var d = parse(it.open);
  var m = d.getMonth() + it.pao;
  var e = new Date(d.getFullYear(), m, d.getDate());
  /* 月末回退：1 月 31 日 + 1 个月 = 2 月 28/29 日 */
  if (e.getDate() !== d.getDate()) e = new Date(d.getFullYear(), m + 1, 0);
  return e;
}
function mdOf(d) {
  return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
}

/* ---------- 列表 ---------- */
function renderList() {
  var t = today();
  var arr = [];
  for (var i = 0; i < state.items.length; i++) {
    var it = state.items[i];
    if (!it.done) arr.push(it);
  }
  arr.sort(function (a, b) { return expireOf(a) - expireOf(b); });

  var soon = 0, expired = 0;
  for (var j = 0; j < arr.length; j++) {
    var lf = days(t, expireOf(arr[j]));
    if (lf < 0) expired++;
    else if (lf <= 30) soon++;
  }
  var top = '';
  if (!arr.length) top = '还没有在用的';
  else if (expired) top = expired + ' 瓶已经过期 · 共 ' + arr.length + ' 瓶';
  else if (soon) top = soon + ' 瓶一个月内到期 · 共 ' + arr.length + ' 瓶';
  else top = '共 ' + arr.length + ' 瓶 · 都还宽裕';
  document.getElementById('cnt').innerHTML = top;
  document.getElementById('sortTag').style.display = arr.length ? 'block' : 'none';
  document.getElementById('sortTag').style.display = arr.length ? 'block' : 'none';
  var dn = 0;
  for (var z2 = 0; z2 < state.items.length; z2++) if (state.items[z2].done) dn++;
  document.getElementById('foot').innerHTML = dn
    ? ('「开封后 12 个月」从开封那天算，不是保质期。已空瓶 ' + dn + ' 件。')
    : '「开封后 12 个月」从开封那天算，不是保质期。';

  var box = document.getElementById('list');
  if (!arr.length) {
    box.innerHTML = '<div class="empty">点下面「记一瓶」，把开封日填上<br/>到期前会先红给你看</div>';
    return;
  }

  var html = '';
  for (var k = 0; k < arr.length; k++) {
    var it2 = arr[k];
    var cat = catOf(it2.cat);
    var exp = expireOf(it2);
    var left = days(t, exp);
    var total = days(parse(it2.open), exp);
    var used = total - left;
    var pct = Math.max(0, Math.min(100, Math.round(used / total * 100)));
    var hot = left < 0 ? 'bad' : (left <= 30 ? 'warn' : '');
    var lfTxt = left < 0 ? ('已过期 ' + (-left) + ' 天') : ('剩 ' + left + ' 天');

    html += '<div class="it" data-id="' + it2.id + '">' +
      '<i class="dot" style="background:' + cat.c + '"></i>' +
      '<div class="mid">' +
        '<div class="nm">' + esc(it2.name) + '</div>' +
        '<div class="meta">' + cat.n + ' · 开封 ' + mdOf(parse(it2.open)) + ' · 开封后 ' + it2.pao + ' 个月</div>' +
        '<div class="track"><b class="' + hot + '" style="width:' + pct + '%"></b></div>' +
      '</div>' +
      '<div class="lf ' + hot + '">' + lfTxt + '<span>' + mdOf(exp) + ' 到期</span></div>' +
    '</div>';
  }
  box.innerHTML = html;

  var rows = box.getElementsByClassName('it');
  for (var q = 0; q < rows.length; q++) {
    rows[q].onclick = function () { openSheet(this.getAttribute('data-id')); };
  }
}

function renderDone() {
  var arr = [];
  for (var i = 0; i < state.items.length; i++) if (state.items[i].done) arr.push(state.items[i]);
  arr.sort(function (a, b) { return parse(b.done) - parse(a.done); });

  document.getElementById('doneTop').innerHTML = arr.length
    ? '空瓶墙'
    : '用完之后进来点一下，这里会攒成你的空瓶墙';

  /* 三个数：件数 / 平均用了多少天 / 最长那瓶 */
  var sum = 0, mx = 0, mxName = '';
  for (var z = 0; z < arr.length; z++) {
    var sp = days(parse(arr[z].open), parse(arr[z].done));
    sum += sp;
    if (sp > mx) { mx = sp; mxName = arr[z].name; }
  }
  var st = '';
  st += '<div class="st"><b>' + arr.length + '</b><span>件空瓶</span></div>';
  st += '<div class="st"><b>' + (arr.length ? Math.round(sum / arr.length) : 0) + '</b><span>平均用了几天</span></div>';
  st += '<div class="st"><b>' + (arr.length ? mx : 0) + '</b><span>' + (mxName ? '最久的一瓶' : '天') + '</span></div>';
  document.getElementById('doneStats').innerHTML = st;

  var box = document.getElementById('doneList');
  if (!arr.length) {
    box.innerHTML = '<div class="empty">还没有空瓶<br/>在用那一页点一瓶，选「用完了」</div>';
    return;
  }
  var html = '';
  for (var j = 0; j < arr.length; j++) {
    var it = arr[j];
    var cat = catOf(it.cat);
    var span = days(parse(it.open), parse(it.done));
    html += '<div class="it done" data-id="' + it.id + '">' +
      '<i class="dot" style="background:' + cat.c + '"></i>' +
      '<div class="mid">' +
        '<div class="nm">' + esc(it.name) + '</div>' +
        '<div class="meta">' + cat.n + ' · 用了 ' + span + ' 天 · ' + mdOf(parse(it.done)) + ' 空瓶</div>' +
      '</div>' +
    '</div>';
  }
  box.innerHTML = html;
}

function catOf(k) {
  for (var i = 0; i < CATS.length; i++) if (CATS[i].k === k) return CATS[i];
  return CATS[0];
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- 表单 ---------- */
function buildChips() {
  var c1 = '', i;
  for (i = 0; i < CATS.length; i++) {
    c1 += '<span class="chip' + (CATS[i].k === state.cat ? ' on' : '') +
      '" data-k="' + CATS[i].k + '">' + CATS[i].n + '</span>';
  }
  document.getElementById('fCat').innerHTML = c1;

  var c2 = '';
  for (i = 0; i < PAOS.length; i++) {
    c2 += '<span class="chip' + (PAOS[i] === state.pao ? ' on' : '') +
      '" data-p="' + PAOS[i] + '">' + PAOS[i] + ' 个月</span>';
  }
  document.getElementById('fPao').innerHTML = c2;

  bindChips('fCat', 'data-k', function (v) { state.cat = v; buildChips(); });
  bindChips('fPao', 'data-p', function (v) { state.pao = parseInt(v, 10); buildChips(); });
}
function bindChips(id, attr, cb) {
  var box = document.getElementById(id);
  var list = box.getElementsByClassName('chip');
  for (var i = 0; i < list.length; i++) {
    list[i].onclick = function () { cb(this.getAttribute(attr)); };
  }
}

function addItem() {
  var nm = document.getElementById('fName').value.replace(/^\s+|\s+$/g, '');
  if (!nm) { toast('先写个名字'); return; }
  var op = document.getElementById('fOpen').value;
  if (!op) { toast('选一下开封日'); return; }

  var it = {
    id: 'e' + (new Date().getTime()),
    name: nm,
    cat: state.cat,
    open: op,
    pao: state.pao,
    done: null
  };
  state.items.push(it);
  save();
  document.getElementById('fName').value = '';
  toast('记好了');
  haptic();
  setTimeout(function () { showTab(0); }, 320);
}

/* ---------- 弹层 ---------- */
function openSheet(id) {
  var it = null;
  for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) it = state.items[i];
  if (!it) return;
  state.sel = id;
  var exp = expireOf(it);
  document.getElementById('shName').innerHTML = esc(it.name);
  document.getElementById('shMeta').innerHTML = it.done
    ? ('已经空瓶 · ' + mdOf(parse(it.done)))
    : ('开封 ' + mdOf(parse(it.open)) + ' · ' + mdOf(exp) + ' 到期');
  document.getElementById('shDone').style.display = it.done ? 'none' : 'block';
  document.getElementById('mask').className = 'on';
  document.getElementById('sheet').className = 'on';
}
function closeSheet() {
  document.getElementById('mask').className = '';
  document.getElementById('sheet').className = '';
  state.sel = null;
}
function markDone() {
  for (var i = 0; i < state.items.length; i++) {
    if (state.items[i].id === state.sel) state.items[i].done = ymd(today());
  }
  save();
  closeSheet();
  toast('收进空瓶了');
  haptic();
  renderList();
}
function delItem() {
  var out = [];
  for (var i = 0; i < state.items.length; i++) {
    if (state.items[i].id !== state.sel) out.push(state.items[i]);
  }
  state.items = out;
  save();
  closeSheet();
  toast('删掉了');
  renderList();
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
  var pages = ['pList', 'pDone', 'pAdd'];
  for (var j = 0; j < 3; j++) {
    document.getElementById(pages[j]).className = j === i ? 'page on' : 'page';
    document.getElementById('t' + j).className = j === i ? 'tab on' : 'tab';
  }
  if (i === 0) renderList();
  if (i === 1) renderDone();
  if (i === 2) buildChips();
}

/* ---------- 调试参数（出货无副作用） ---------- */
function param(name) {
  var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
  return m ? decodeURIComponent(m[1]) : '';
}
function seed() {
  var t = today();
  function back(n) { return ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() - n)); }
  state.items = [
    { id: 's1', name: '小黑瓶精华 30ml', cat: 'sk', open: back(340), pao: 12, done: null },
    { id: 's2', name: '身体乳 400ml', cat: 'body', open: back(150), pao: 12, done: null },
    { id: 's3', name: '防晒霜 SPF50', cat: 'sun', open: back(300), pao: 12, done: null },
    { id: 's4', name: '卸妆油 200ml', cat: 'sk', open: back(64), pao: 6, done: null },
    { id: 's5', name: '护发精油', cat: 'hair', open: back(32), pao: 24, done: null },
    { id: 's6', name: '粉底液 30ml', cat: 'mk', open: back(200), pao: 12, done: back(12) },
    { id: 's7', name: '面霜 50g', cat: 'sk', open: back(430), pao: 12, done: back(96) }
  ];
  save();
}

/* ---------- 启动 ---------- */
function boot() {
  state.u = document.documentElement.clientWidth / 100;
  document.documentElement.style.setProperty('--u', state.u + 'px');
  load();
  if (param('still')) document.documentElement.className = 'still';
  if (param('seed')) seed();

  document.getElementById('fOpen').value = ymd(today());
  document.getElementById('addBtn').onclick = addItem;
  document.getElementById('shDone').onclick = markDone;
  document.getElementById('shDel').onclick = delItem;
  document.getElementById('shCancel').onclick = closeSheet;
  document.getElementById('mask').onclick = closeSheet;

  for (var i = 0; i < 3; i++) {
    document.getElementById('t' + i).onclick = (function (k) {
      return function () { showTab(k); };
    })(i);
  }
  showTab(parseInt(param('tab') || '0', 10) || 0);
}

window.onresize = function () {
  state.u = document.documentElement.clientWidth / 100;
  document.documentElement.style.setProperty('--u', state.u + 'px');
};

if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
else document.addEventListener('DOMContentLoaded', boot);
