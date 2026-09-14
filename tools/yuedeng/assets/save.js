/* ============================================================
   月下灯会 · 存档层 (window.YDSave)
   内容依据 docs/specs/2026-09-13-yuedeng-design.md §6（每盏灯纹样独一无二，
   成品晒图传播力强 → 存下来的作品要能在首页「我的彩灯」回看）
   ------------------------------------------------------------
   系列一致性：键名沿用系列的「<本作>-works / -save」命名
   （漆扇 qishan-works、月宴 yueyan-save / yueyan-progress），
   首页 #works-row 的渲染沿用漆扇「我的漆扇」的 .work-thumb + .wn 结构。

   确定性：零随机（id 由时间戳 + 计数器派生）、零网络引用、零动画。
   缩略图不在本层生成：thumb 是 data URL，由 share.js / 引擎产出后传入。
   容错：每一次存储访问都包 try/catch —— 存储被禁用或配额不足时降级为
   本次会话的内存态，游戏绝不因存档失败而崩。
   ============================================================ */
(function () {
  'use strict';

  var D = window.YDData;

  /* 键名按本作命名空间隔离，不与系列其他作 collide */
  var KEY = 'yuedeng-works';

  /* 上限 9 盏，与漆扇 MAX_WORKS 同值：9 张缩略图约数百 KB，远低于 localStorage
     配额；系列各作共用同一 origin 的配额，故必须设硬上限防止无限增长。
     超出上限丢最旧的一盏（列表恒为最新在前，故尾部即最旧）。 */
  var MAX = 9;

  var EMPTY_TEXT = '还没有彩灯 · 点亮你的第一盏';
  var NAME_MAX = 8;                 /* index.html #lamp-name maxlength=8 */

  var mem = [];                     /* 存储不可用时的会话内回退缓存 */
  var canPersist = true;            /* 任一访问抛错即永久降级为内存态 */
  var seqSeed = -1;                 /* 惰性播种：计数器起点取自现存记录，跨会话不撞号 */

  /* ---------- 存储访问：全部包 try/catch ----------
     window.localStorage 这个属性本身在禁用 Cookie 的浏览器里就会抛 SecurityError，
     所以取对象也要包。 */
  function store() {
    try { return window.localStorage; } catch (e) { canPersist = false; return null; }
  }

  /* 单条记录校验：缺字段的脏记录单独丢弃，而不是整表清空——
     画廊比续局存档宽容，坏一条不该连带清掉其余作品。 */
  function valid(rec) {
    return !!rec && typeof rec === 'object' &&
      typeof rec.id === 'string' && typeof rec.name === 'string' &&
      typeof rec.shape === 'string' && typeof rec.placement === 'string' &&
      typeof rec.phase === 'string' && typeof rec.thumb === 'string' &&
      typeof rec.ts === 'number' &&
      Object.prototype.toString.call(rec.colors) === '[object Array]';
  }

  function readRaw() {
    var s = store();
    if (!s) { return mem.slice(); }
    var raw;
    try { raw = s.getItem(KEY); } catch (e) { canPersist = false; return mem.slice(); }
    if (!raw) { return mem.slice(); }
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return mem.slice(); }   /* 损坏即视为无存档 */
    if (Object.prototype.toString.call(parsed) !== '[object Array]') { return mem.slice(); }
    var out = [];
    for (var i = 0; i < parsed.length; i++) { if (valid(parsed[i])) { out.push(parsed[i]); } }
    return out;
  }

  /* 配额不足时丢最旧一盏再试一次；仍失败才判定为不可持久化。
     丢的只是落盘载荷，mem 不动 —— 内存态是本次会话的真相，且已由 save() 限长。 */
  function write(list) {
    mem = list.slice();
    var s = store();
    if (!s) { return; }
    var json;
    try { json = JSON.stringify(list); } catch (e) { canPersist = false; return; }
    try { s.setItem(KEY, json); return; } catch (e) { /* 配额不足 */ }
    if (list.length <= 1) { canPersist = false; return; }
    try { s.setItem(KEY, JSON.stringify(list.slice(0, list.length - 1))); }
    catch (e) { canPersist = false; }
  }

  /* ---------- id：时间戳 + 计数器，零随机 ---------- */
  function maxSeq(list) {
    var m = 0;
    for (var i = 0; i < list.length; i++) {
      var parts = String(list[i].id).split('-');
      var n = parseInt(parts[parts.length - 1], 10);
      if (isFinite(n) && n > m) { m = n; }
    }
    return m;
  }

  function nextId(ts) {
    if (seqSeed < 0) { seqSeed = maxSeq(readRaw()); }
    seqSeed += 1;
    return 'yd-' + ts + '-' + seqSeed;
  }

  /* ---------- 记录：只落契约字段 ----------
     灯名 / 灯形 / 灯色 / 放灯手法 / 月相 / 时间戳 / 缩略图。
     小记不落盘：D.makeNote(主色, 灯形, 月相) 可由已存字段复算，存了只会冗余。 */
  function normalize(work, ts) {
    var src = Object.prototype.toString.call(work.colors) === '[object Array]' ? work.colors : [];
    var colors = [];
    for (var i = 0; i < src.length && colors.length < D.COLOR_RULES.maxColors; i++) {
      if (typeof src[i] === 'string' && src[i]) { colors.push(src[i]); }
    }
    var name = String(work.name == null ? '' : work.name).trim().slice(0, NAME_MAX);
    return {
      id: nextId(ts),
      name: name || D.nameAt(ts),                    /* 空名兜底走 D.nameAt，确定性 */
      shape: String(work.shape || D.SHAPES[0].id),
      colors: colors.length ? colors : [D.COLORS[0].id],
      placement: String(work.placement || D.PLACEMENTS[0].id),
      phase: String(work.phase || D.PHASES[0].code),
      ts: ts,
      thumb: typeof work.thumb === 'string' ? work.thumb : ''
    };
  }

  /* ---------- 公开接口 ---------- */

  /* 存一盏成品灯。work = { name, shape, colors, placement, phase, thumb }。
     返回落盘的完整记录（含派生 id），输入非法返回 null。 */
  function save(work) {
    if (!work || typeof work !== 'object') { return null; }
    var rec = normalize(work, Date.now());
    var list = readRaw();
    list.unshift(rec);                               /* 最新在前 */
    if (list.length > MAX) { list = list.slice(0, MAX); }
    write(list);
    return rec;
  }

  /* 全部作品，最新在前（按 ts 降序排序，不依赖落盘顺序）。 */
  function load() {
    var list = readRaw();
    list.sort(function (a, b) { return b.ts - a.ts; });
    return list;
  }

  function find(id) {
    var list = load();
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }

  /* 删除单盏。返回是否真的删掉了一条。 */
  function remove(id) {
    var list = load();
    var out = [];
    for (var i = 0; i < list.length; i++) { if (list[i].id !== id) { out.push(list[i]); } }
    if (out.length === list.length) { return false; }
    write(out);
    return true;
  }

  /* 改名：成品视图的 #lamp-name 可改、#btn-reroll 可另取一名，改完要同步回存档。
     返回最终名字，找不到该 id 返回空串。 */
  function rename(id, name) {
    var list = load();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) { continue; }
      var v = String(name == null ? '' : name).trim().slice(0, NAME_MAX);
      list[i].name = v || D.nameAt(list[i].ts);
      write(list);
      return list[i].name;
    }
    return '';
  }

  function clear() {
    mem = [];
    var s = store();
    if (!s) { return; }
    try { s.removeItem(KEY); } catch (e) { canPersist = false; }
  }

  function count() { return load().length; }

  /* 首页「我的彩灯」渲染：填满 #works-row。
     onOpen 可选——传入则点击缩略图时以 id 回调；不传也由 main.js 通过
     元素上的 data-id 自行委托。返回渲染出的张数（0 即空态）。 */
  function renderWorks(onOpen) {
    var row = document.getElementById('works-row');
    if (!row) { return 0; }
    row.innerHTML = '';
    var list = load();
    if (!list.length) {
      /* 空态给三个空灯槽：暗示「这里会挂你的灯」，比一行灰字有收集欲。 */
      for (var k = 0; k < 3; k++) {
        var slot = document.createElement('span');
        slot.className = 'work-slot';
        slot.setAttribute('aria-hidden', 'true');
        row.appendChild(slot);
      }
      var empty = document.createElement('p');
      empty.className = 'works-empty';
      empty.textContent = EMPTY_TEXT;
      row.appendChild(empty);
      return 0;
    }
    for (var i = 0; i < list.length; i++) { appendThumb(row, list[i], onOpen); }
    return list.length;
  }

  function appendThumb(row, rec, onOpen) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'work-thumb';
    b.dataset.id = rec.id;                           /* main.js 点击时读取 */
    b.setAttribute('aria-label',
      rec.name + ' · ' + D.makeNote(rec.colors[0], rec.shape, rec.phase));
    if (rec.thumb) {                                 /* 无缩略图则只留底色 + 灯名 */
      var img = document.createElement('img');
      img.src = rec.thumb;
      img.alt = rec.name;
      b.appendChild(img);
    }
    var nm = document.createElement('span');
    nm.className = 'wn';
    nm.textContent = rec.name;
    b.appendChild(nm);
    b.addEventListener('click', function () { if (onOpen) { onOpen(rec.id); } });
    row.appendChild(b);
  }

  window.YDSave = {
    KEY: KEY,
    MAX: MAX,
    save: save,
    load: load,
    find: find,
    remove: remove,
    rename: rename,
    clear: clear,
    count: count,
    renderWorks: renderWorks,
    persistent: function () { return canPersist; }
  };
})();
