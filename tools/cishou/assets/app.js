/* 词兽守夜
   拼词肉鸽。拼对即攻击，填字母时战场降到 0.25 倍速。
   Chrome 61 基线：ES2017、无 Worker / WASM / 离屏画布、不用 flex gap。 */
(function () {
  'use strict';

  var SAVE_KEY = 'cishou.save.v1';
  var MAX_WAVE = 12;
  var CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
            '十一', '十二'];

  var $ = function (id) { return document.getElementById(id); };

  /* ────────────────────────── 词库分档 ────────────────────────── */

  function bucketOf(n) {
    if (n <= 4) return 0;
    if (n <= 6) return 1;
    if (n <= 8) return 2;
    if (n <= 10) return 3;
    return 4;
  }

  var BANK = [[], [], [], [], []];
  (function buildBank() {
    var seen = Object.create(null);
    var src = window.WORDS || [];
    for (var i = 0; i < src.length; i++) {
      var en = String(src[i][0] || '').toLowerCase();
      var zh = String(src[i][1] || '');
      if (!en || !zh || seen[en]) continue;
      if (en.length < 3 || en.length > 12) continue;
      if (!/^[a-z]+$/.test(en)) continue;
      seen[en] = 1;
      BANK[bucketOf(en.length)].push([en, zh]);
    }
  })();

  /* 按字长定档：越短爬得越快、撞得越轻；越长越慢、撞得越重 */
  var KIND = [
    { r: 20, spd: 1.35, dmg: 1 },
    { r: 24, spd: 1.00, dmg: 1 },
    { r: 29, spd: 0.80, dmg: 2 },
    { r: 33, spd: 0.62, dmg: 3 },
    { r: 39, spd: 0.46, dmg: 4 }
  ];

  /* ────────────────────────── DOM ────────────────────────── */

  var app = $('app');
  var stage = $('stage');
  var cv = $('cv');
  var ctx = null;
  var sheet = $('sheet');
  var slotsEl = $('slots');
  var bankEl = $('bank');
  var askWord = $('ask-word');
  var askHint = $('ask-hint');
  var askEyebrow = $('ask-eyebrow');
  var footCoins = $('foot-coins');
  var footCombo = $('foot-combo');
  var btnHint = $('btn-hint');
  var oilWrap = $('oil-wrap');
  var hudLabel = $('hud-label');
  var hudWave = $('hud-wave');
  var shopList = $('shop-list');
  var shopCoins = $('shop-coins');
  var vHome = $('v-home');
  var vBattle = $('v-battle');
  var vShop = $('v-shop');
  var vResult = $('v-result');

  /* ────────────────────────── 画布 ────────────────────────── */

  var W = 0, H = 0, DPR = 1, LAMPX = 0, LAMPY = 0, bgGrad = null;
  var TAU = Math.PI * 2;

  function syncUnit() {
    var w = app.clientWidth || window.innerWidth || 390;
    document.documentElement.style.setProperty('--u', (w / 100) + 'px');
  }

  function resize() {
    syncUnit();
    var rect = stage.getBoundingClientRect();
    var w = Math.round(rect.width), h = Math.round(rect.height);
    if (w < 20 || h < 20) return;
    if (w === W && h === H && ctx) return;
    W = w; H = h;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx = cv.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    LAMPX = W / 2;
    LAMPY = H * 0.86;
    bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.72, 20,
                                      W * 0.5, H * 0.55, W * 0.95);
    bgGrad.addColorStop(0, '#131315');
    bgGrad.addColorStop(0.45, '#0E0E10');
    bgGrad.addColorStop(1, '#08080A');
  }

  function halo(x, y, r, color, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function blobPath(x, y, r, t, seed) {
    ctx.beginPath();
    var N = 24;
    for (var i = 0; i <= N; i++) {
      var a = i / N * TAU;
      var rr = r * (1 + 0.075 * Math.sin(a * 3 + t * 0.7 + seed)
                      + 0.042 * Math.sin(a * 5 - t * 0.9 + seed * 2)
                      + 0.02 * Math.sin(a * 8 + seed * 3));
      var px = x + Math.cos(a) * rr;
      var py = y + Math.sin(a) * rr * 0.94;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function rimStyle(x, y, r, dx, dy, alpha) {
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var lg = ctx.createLinearGradient(x, y,
      x + dx / len * r * 1.15, y + dy / len * r * 1.15);
    lg.addColorStop(0, 'rgba(232,183,122,0)');
    lg.addColorStop(0.55, 'rgba(232,183,122,' + (0.12 * alpha) + ')');
    lg.addColorStop(1, 'rgba(255,214,164,' + (0.85 * alpha) + ')');
    return lg;
  }

  function tendrils(x, y, r, seed, alpha) {
    for (var i = 0; i < 5; i++) {
      var a = Math.PI * 0.30 + (i / 4) * Math.PI * 0.40;
      var sx = x + Math.cos(a) * r * 0.86;
      var sy = y + Math.sin(a) * r * 0.74;
      var len = r * (0.78 + 0.40 * Math.abs(Math.sin(seed * 3 + i * 1.7)));
      var mx = sx + Math.sin(seed + i) * r * 0.14;
      var my = sy + len * 0.52;
      var tx = sx + Math.sin(seed + i) * r * 0.26;
      var ty = sy + len;
      var lg = ctx.createLinearGradient(sx, sy, tx, ty);
      lg.addColorStop(0, 'rgba(232,183,122,' + (0.34 * alpha) + ')');
      lg.addColorStop(0.55, 'rgba(232,183,122,' + (0.12 * alpha) + ')');
      lg.addColorStop(1, 'rgba(232,183,122,0)');
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, tx, ty);
      ctx.strokeStyle = lg;
      ctx.lineWidth = Math.max(0.85, r * 0.04);
      ctx.stroke();
    }
  }

  function drawBeast(b) {
    var t = R.t;
    var grow = b.dead > 0 ? b.dead / 0.35 : 0;
    var alpha = b.alpha * (1 - grow * 0.85);
    if (alpha <= 0.02) return;
    var r = b.r * (1 + grow * 0.25);
    var x = b.x, y = b.y;
    var dx = LAMPX - x, dy = LAMPY - y;

    blobPath(x, y, r, t, b.seed);
    ctx.fillStyle = '#07070A';
    ctx.fill();

    ctx.save();
    blobPath(x, y, r, t, b.seed);
    ctx.clip();
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var inner = ctx.createRadialGradient(
      x + dx / d * r * 0.9, y + dy / d * r * 0.9, r * 0.1,
      x, y, r * 1.15);
    inner.addColorStop(0, 'rgba(240,190,132,' + (0.30 * alpha) + ')');
    inner.addColorStop(0.5, 'rgba(232,183,122,' + (0.10 * alpha) + ')');
    inner.addColorStop(1, 'rgba(232,183,122,0)');
    ctx.fillStyle = inner;
    ctx.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
    ctx.restore();

    tendrils(x, y, r, b.seed, alpha);

    blobPath(x, y, r, t, b.seed);
    ctx.strokeStyle = rimStyle(x, y, r, dx, dy, alpha);
    ctx.lineWidth = 1.3;
    ctx.stroke();

    if (b.isTarget) {
      ctx.save();
      ctx.translate(x, y + r * 0.16);
      ctx.rotate(-0.06);
      var gw = r * 0.86, gh = r * 0.075;
      var gash = ctx.createLinearGradient(-gw / 2, 0, gw / 2, 0);
      gash.addColorStop(0, 'rgba(232,183,122,0)');
      gash.addColorStop(0.28, 'rgba(255,206,150,' + (0.75 * alpha) + ')');
      gash.addColorStop(0.5, 'rgba(255,240,215,' + (0.95 * alpha) + ')');
      gash.addColorStop(0.72, 'rgba(255,206,150,' + (0.75 * alpha) + ')');
      gash.addColorStop(1, 'rgba(232,183,122,0)');
      ctx.fillStyle = gash;
      ctx.beginPath();
      ctx.ellipse(0, 0, gw / 2, gh, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      /* 目标括标 */
      ctx.strokeStyle = 'rgba(224,72,59,' + (0.8 * alpha) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.42, y - r - 7);
      ctx.lineTo(x - r * 0.42, y - r - 14);
      ctx.moveTo(x + r * 0.42, y - r - 7);
      ctx.lineTo(x + r * 0.42, y - r - 14);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,231,198,' + (0.62 * alpha) + ')';
      ctx.beginPath();
      ctx.arc(x + dx / d * r * 0.26, y + dy / d * r * 0.26,
              Math.max(1, r * 0.045), 0, TAU);
      ctx.fill();
    }
  }

  function drawLamp() {
    var pulse = 0.5 + 0.5 * Math.sin(R.t * 1.4);

    /* 环境光：灯光向上晕开，越靠近灯越暖，给空战场一点深度 */
    var amb = ctx.createRadialGradient(LAMPX, LAMPY, 6, LAMPX, LAMPY, H * 1.05);
    amb.addColorStop(0, 'rgba(232,183,122,0.22)');
    amb.addColorStop(0.32, 'rgba(232,183,122,0.075)');
    amb.addColorStop(1, 'rgba(232,183,122,0)');
    ctx.fillStyle = amb;
    ctx.fillRect(0, 0, W, H);

    /* 三层光：外晕 / 中间色 / 亮芯 */
    halo(LAMPX, LAMPY, 168, 'rgba(232,183,122,0.70)', 0.46 + pulse * 0.05);
    halo(LAMPX, LAMPY, 66, 'rgba(248,208,150,0.95)', 0.72);
    halo(LAMPX, LAMPY, 24, 'rgba(255,244,224,1)', 0.95);

    /* 地面光池 */
    var pool = ctx.createRadialGradient(LAMPX, LAMPY + 22, 2,
                                        LAMPX, LAMPY + 22, 132);
    pool.addColorStop(0, 'rgba(232,183,122,.30)');
    pool.addColorStop(0.55, 'rgba(232,183,122,.10)');
    pool.addColorStop(1, 'rgba(232,183,122,0)');
    ctx.save();
    ctx.translate(LAMPX, LAMPY + 22);
    ctx.scale(1, 0.30);
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(0, 0, 132, 0, TAU);
    ctx.fill();
    ctx.restore();

    /* 灯芯 */
    var core = ctx.createRadialGradient(LAMPX - 2, LAMPY - 4, 0.5,
                                        LAMPX, LAMPY, 15);
    core.addColorStop(0, '#FFFBEF');
    core.addColorStop(0.38, '#F9D49B');
    core.addColorStop(1, 'rgba(150,104,40,.20)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(LAMPX, LAMPY, 13, 0, TAU);
    ctx.fill();

    /* 灯钩：一根细线往上，说明它是吊着的 */
    ctx.strokeStyle = 'rgba(232,183,122,.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LAMPX, LAMPY - 13);
    ctx.lineTo(LAMPX, LAMPY - 42);
    ctx.stroke();
  }

  function drawDust() {
    for (var i = 0; i < 14; i++) {
      var a = i * 2.399;
      var rr = 22 + (i * 41) % 92;
      var dx = LAMPX + Math.cos(a) * rr;
      var dy = LAMPY - 14 + Math.sin(a) * rr * 0.64
             + Math.sin(R.t * 0.8 + i) * 3;
      ctx.fillStyle = 'rgba(232,183,122,' + (0.10 + (i % 5) * 0.035) + ')';
      ctx.beginPath();
      ctx.arc(dx, dy, 0.8 + (i % 3) * 0.35, 0, TAU);
      ctx.fill();
    }
  }

  function draw() {
    if (!ctx || !W) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var sx = 0, sy = 0;
    if (R && R.shake > 0) {
      sx = (Math.random() - 0.5) * R.shake * 9;
      sy = (Math.random() - 0.5) * R.shake * 5;
    }
    ctx.translate(sx, sy);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-sx, -sy, W, H);

    if (!R) return;
    drawLamp();
    for (var i = 0; i < R.beasts.length; i++) drawBeast(R.beasts[i]);
    drawDust();
  }

  /* ────────────────────────── 存档 ────────────────────────── */

  var save = { best: 0, mastered: {} };

  function loadSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && typeof o.best === 'number') save.best = o.best;
      if (o && o.mastered && typeof o.mastered === 'object') save.mastered = o.mastered;
    } catch (e) { /* 存储不可用时静默降级 */ }
  }

  function writeSave() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) { /* 同上 */ }
  }

  /* ────────────────────────── 局状态 ────────────────────────── */

  var R = null;
  var recent = [];

  function newRun() {
    return {
      phase: 'battle',
      mode: 'battle',
      wave: 1,
      oil: 10,
      oilMax: 10,
      /* 开局给一点灯花：第一夜只能赚 5，货架最低 7，
         不给本钱的话第一次进商店只能空手离开。 */
      coins: 6,
      combo: 0,
      maxCombo: 0,
      kills: 0,
      right: 0,
      wrong: 0,
      beasts: [],
      target: null,
      needTarget: true,
      word: null,
      bank: [],
      slots: [],
      miss: [],
      item: {
        coinBonus: 0,
        hintLeft: 2,
        noHaste: 0,
        firstNoHaste: 0,
        autoFill: 0,
        extra: 0,
        repel: 0,
        comboKill: 0,
        regen: 0
      },
      owned: {},
      t: 0,
      shake: 0,
      spawnLeft: 0,
      spawnTimer: 0,
      masteredNew: 0
    };
  }

  function countFilled() {
    var n = 0;
    for (var i = 0; i < R.slots.length; i++) if (R.slots[i]) n++;
    return n;
  }

  /* ────────────────────────── 出题 ────────────────────────── */

  function pickWord(bucket) {
    var pool = BANK[bucket] && BANK[bucket].length ? BANK[bucket] : BANK[1];
    var i, guard = 0;
    if (R && R.miss.length && Math.random() < 0.4) {
      var pick = R.miss[Math.floor(Math.random() * R.miss.length)];
      if (bucketOf(pick[0].length) === bucket) return pick;
    }
    do {
      i = Math.floor(Math.random() * pool.length);
      guard++;
    } while (guard < 20 && recent.indexOf(pool[i][0]) >= 0);
    recent.push(pool[i][0]);
    if (recent.length > 8) recent.shift();
    return pool[i];
  }

  function buildBank(word) {
    var arr = [];
    var i;
    for (i = 0; i < word.length; i++) {
      arr.push({ ch: word.charAt(i), used: false });
    }
    var alpha = 'abcdefghijklmnopqrstuvwxyz';
    var guard = 0;
    while (arr.length < 12 && guard < 200) {
      guard++;
      arr.push({ ch: alpha.charAt(Math.floor(Math.random() * 26)), used: false });
    }
    for (i = arr.length - 1; i > 0; i--) {
      var k = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[k];
      arr[k] = tmp;
    }
    return arr;
  }

  function setWord(pair) {
    R.word = { en: pair[0], zh: pair[1] };
    R.slots = new Array(pair[0].length);
    for (var i = 0; i < R.slots.length; i++) R.slots[i] = null;
    R.bank = buildBank(pair[0]);
    renderBoard();
  }

  /* ────────────────────────── 面板渲染 ────────────────────────── */

  function renderBoard() {
    if (!R) return;
    var len = R.word ? R.word.en.length : 0;

    while (slotsEl.firstChild) slotsEl.removeChild(slotsEl.firstChild);
    while (bankEl.firstChild) bankEl.removeChild(bankEl.firstChild);

    if (!R.word) {
      askWord.textContent = '·';
      askHint.textContent = '';
      slotsEl.className = 'slots';
      footCoins.textContent = '◈ ' + R.coins;
      footCombo.className = 'combo';
      btnHint.textContent = '提示 ' + R.item.hintLeft;
      btnHint.disabled = true;
      btnHint.style.display = R.mode === 'shop' ? 'none' : '';
      resize();
      return;
    }

    askWord.textContent = R.word.zh;
    askHint.textContent = len + ' 个字母' +
      (countFilled() ? '　已填 ' + countFilled() : '');
    footCoins.textContent = '◈ ' + R.coins;
    if (R.combo >= 2) {
      footCombo.textContent = '连击 ×' + R.combo;
      footCombo.className = 'combo is-on';
    } else {
      footCombo.className = 'combo';
    }
    btnHint.textContent = '提示 ' + R.item.hintLeft;
    btnHint.disabled = R.item.hintLeft <= 0;
    btnHint.style.display = R.mode === 'shop' ? 'none' : '';

    slotsEl.className = 'slots' + (len >= 10 ? ' is-longer' : (len >= 8 ? ' is-long' : ''));
    var firstEmpty = -1;
    var i;
    for (i = 0; i < len; i++) {
      if (!R.slots[i] && firstEmpty < 0) firstEmpty = i;
    }
    for (i = 0; i < len; i++) {
      var s = document.createElement('div');
      s.className = 'slot';
      var cell = R.slots[i];
      if (cell) {
        s.textContent = cell.ch.toUpperCase();
        s.setAttribute('data-slot', String(i));
      } else if (i === firstEmpty) {
        s.className = 'slot is-on';
        s.appendChild(document.createElement('i'));
      }
      slotsEl.appendChild(s);
    }

    for (i = 0; i < R.bank.length; i++) {
      var t = document.createElement('div');
      t.className = 'tile' + (R.bank[i].used ? ' is-used' : '');
      t.textContent = R.bank[i].ch.toUpperCase();
      t.setAttribute('data-tile', String(i));
      bankEl.appendChild(t);
    }

    /* 面板高度会随字数变化，战场高度也跟着变。
       必须在渲染完之后重新量一次，否则画布会按上一屏的高度绘制。 */
    resize();
  }

  /* ────────────────────────── 交互 ────────────────────────── */

  function tapTile(index) {
    if (!R || !R.word) return;
    var tile = R.bank[index];
    if (!tile || tile.used) return;
    var slot = -1;
    for (var i = 0; i < R.slots.length; i++) {
      if (!R.slots[i]) { slot = i; break; }
    }
    if (slot < 0) return;
    R.slots[slot] = { ch: tile.ch, tile: index };
    tile.used = true;
    renderBoard();
    if (countFilled() === R.slots.length) {
      window.setTimeout(judge, 90);
    }
  }

  function tapSlot(index) {
    if (!R || !R.slots[index]) return;
    var cell = R.slots[index];
    if (R.bank[cell.tile]) R.bank[cell.tile].used = false;
    R.slots[index] = null;
    renderBoard();
  }

  function clearSlots() {
    for (var i = 0; i < R.slots.length; i++) {
      if (R.slots[i] && R.bank[R.slots[i].tile]) R.bank[R.slots[i].tile].used = false;
      R.slots[i] = null;
    }
  }

  function shakeSheet() {
    sheet.className = 'shake';
    window.setTimeout(function () { sheet.className = ''; }, 300);
  }

  function judge() {
    if (!R || !R.word) return;
    if (countFilled() !== R.slots.length) return;
    var ans = '';
    for (var i = 0; i < R.slots.length; i++) {
      ans += R.slots[i] ? R.slots[i].ch : '';
    }
    if (ans === R.word.en) onCorrect(); else onWrong();
  }

  function onCorrect() {
    var en = R.word.en;

    if (R.mode === 'shop') {
      finishChallenge(true);
      return;
    }

    R.right++;
    R.combo++;
    if (R.combo > R.maxCombo) R.maxCombo = R.combo;
    R.coins += 1 + Math.floor(R.wave / 6) + R.item.coinBonus;

    if (!save.mastered[en]) save.mastered[en] = 0;
    save.mastered[en]++;
    if (save.mastered[en] === 2) R.masteredNew++;
    writeSave();

    var victim = R.target;
    killBeast(victim);

    if (R.item.extra > 0 || (R.item.comboKill > 0 && R.combo >= 5)) {
      killBeast(nearestOther(victim));
    }

    R.needTarget = true;
    clearSlots();
    R.bank = [];
    R.word = null;
    renderBoard();
    updateHud();
  }

  function onWrong() {
    if (R.mode === 'shop') {
      shakeSheet();
      window.setTimeout(function () { finishChallenge(false); }, 260);
      return;
    }
    R.wrong++;
    R.combo = 0;
    /* 错词池存 [词, 释义] 对，和词库同构；存对象会让 pickWord 读 pick[0] 时崩 */
    var pair = [R.word.en, R.word.zh];
    var dup = false;
    for (var mi = 0; mi < R.miss.length; mi++) {
      if (R.miss[mi][0] === pair[0]) { dup = true; break; }
    }
    if (!dup) R.miss.push(pair);
    var protectedThis = R.item.noHaste ||
      (R.item.firstNoHaste && R.firstWrongThisWave === 0);
    if (!protectedThis && R.target) R.target.haste = 1.2;
    R.firstWrongThisWave++;
    shakeSheet();
    clearSlots();
    renderBoard();
    updateHud();
  }

  function killBeast(b) {
    if (!b || b.dead > 0) return;
    b.dead = 0.35;
    R.kills++;
    if (b === R.target) R.target = null;
  }

  /* 最靠前 = 离灯最近 = y 最大 */
  function nearestOther(exclude) {
    var best = null, bd = -1e9;
    for (var i = 0; i < R.beasts.length; i++) {
      var b = R.beasts[i];
      if (b === exclude || b.dead > 0) continue;
      if (b.y > bd) { bd = b.y; best = b; }
    }
    return best;
  }

  function useHint() {
    if (!R || !R.word) return;
    fillOne(true);
  }

  /* ────────────────────────── 战斗推进 ────────────────────────── */

  function startWave(n) {
    R.wave = n;
    R.phase = 'battle';
    R.mode = 'battle';
    R.firstWrongThisWave = 0;
    R.playerTouched = false;
    R.beasts = [];
    R.target = null;
    R.needTarget = true;
    R.word = null;
    R.bank = [];
    R.slots = [];
    if (R.item.regen > 0) {
      R.oil = Math.min(R.oilMax, R.oil + R.item.regen);
    }
    askEyebrow.textContent = '拼出它';
    R.spawnLeft = 4 + n;
    R.spawnTimer = 1.5;
    showView('battle');
    updateHud();
    renderBoard();
    /* 必须先渲染面板再放第一只：面板高度决定战场高度，词兽速度按战场高度算 */
    spawnBeast((n === 4 || n === 8 || n === 12) ? 4 : null);
    R.spawnLeft--;
  }

  function baseSpeed(k) {
    var span = 14 - R.wave * 0.42;
    if (span < 7) span = 7;
    return (H * 0.86 / span) * k.spd;
  }

  function spawnBeast(forceBucket) {
    var bucket = forceBucket;
    if (bucket == null) {
      var r = Math.random();
      if (R.wave >= 10 && r < 0.28) bucket = 4;
      else if (R.wave >= 7 && r < 0.50) bucket = 3;
      else if (R.wave >= 4 && r < 0.75) bucket = 2;
      else if (r < 0.9) bucket = 1;
      else bucket = 0;
    }
    var k = KIND[bucket];
    var pad = Math.max(k.r + 10, 34);
    var x = pad + Math.random() * Math.max(1, W - pad * 2);
    var pair = pickWord(bucket);
    R.beasts.push({
      x: x, baseX: x, y: -k.r * 2,
      r: k.r, seed: Math.random() * 9,
      bucket: bucket,
      word: pair,
      spd: baseSpeed(k),
      dmg: k.dmg,
      haste: 0,
      dead: 0,
      alpha: 0,
      isTarget: false
    });
  }

  function nearestAlive() {
    var best = null, bd = 1e9;
    for (var i = 0; i < R.beasts.length; i++) {
      var b = R.beasts[i];
      if (b.dead > 0) continue;
      var d = (LAMPY - b.y) + Math.abs(b.x - LAMPX) * 0.35;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function assignTarget() {
    var b = nearestAlive();
    if (!b) { R.needTarget = true; return; }
    for (var i = 0; i < R.beasts.length; i++) R.beasts[i].isTarget = false;
    b.isTarget = true;
    R.target = b;
    R.needTarget = false;
    R.word = null;
    R.slots = [];
    R.bank = [];
    setWord(b.word);
    if (R.item.autoFill > 0) {
      fillOne(false);
    }
  }

  /* 自动填一个字母。cost=true 时扣一次提示。 */
  function fillOne(cost) {
    if (!R || !R.word) return false;
    if (cost && R.item.hintLeft <= 0) return false;
    var slot = -1, i;
    for (i = 0; i < R.slots.length; i++) {
      if (!R.slots[i]) { slot = i; break; }
    }
    if (slot < 0) return false;
    var need = R.word.en.charAt(slot);
    for (i = 0; i < R.bank.length; i++) {
      if (!R.bank[i].used && R.bank[i].ch === need) {
        R.slots[slot] = { ch: need, tile: i };
        R.bank[i].used = true;
        if (cost) R.item.hintLeft--;
        renderBoard();
        if (countFilled() === R.slots.length) window.setTimeout(judge, 90);
        return true;
      }
    }
    return false;
  }

  function crash(b) {
    if (R.item.repel > 0) {
      R.item.repel--;
      b.y = Math.max(-b.r * 2, b.y - H * 0.5);
      b.haste = 0;
      R.shake = 1;
      return;
    }
    R.oil -= b.dmg;
    b.dead = 0.35;
    R.shake = 1;
    if (b === R.target) {
      R.target = null;
      R.needTarget = true;
      R.word = null;
      R.slots = [];
      R.bank = [];
      renderBoard();
    }
    updateHud();
    if (R.oil <= 0) {
      R.oil = 0;
      updateHud();
      endRun(false);
    }
  }

  function updateHud() {
    hudLabel.textContent = '第' + CN[R.wave] + '夜';
    hudWave.textContent = (R.wave < 10 ? '0' : '') + R.wave + ' / ' + MAX_WAVE;

    /* 灯油格子数 = 上限，滴数 = 当前值 */
    var max = R.oilMax;
    while (oilWrap.childNodes.length > max) {
      oilWrap.removeChild(oilWrap.lastChild);
    }
    while (oilWrap.childNodes.length < max) {
      oilWrap.appendChild(document.createElement('i'));
    }
    var segs = oilWrap.childNodes;
    var lit = Math.max(0, Math.min(max, R.oil));
    for (var i = 0; i < segs.length; i++) {
      segs[i].className = i < lit ? 'is-lit' : '';
    }
    oilWrap.className = 'oil' + (R.oil <= 3 ? ' is-low' : '');
  }

  function update(dt) {
    if (!R) return;
    R.t += dt;
    if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 4);
    if (R.phase !== 'battle') return;

    var scale = countFilled() > 0 ? 0.25 : 1;

    if (R.spawnLeft > 0) {
      R.spawnTimer -= dt * scale;
      var alive = 0, i;
      for (i = 0; i < R.beasts.length; i++) if (R.beasts[i].dead <= 0) alive++;
      if (R.spawnTimer <= 0 && alive < 5) {
        spawnBeast(null);
        R.spawnLeft--;
        R.spawnTimer = 1.5;
      }
    }

    for (var j = R.beasts.length - 1; j >= 0; j--) {
      var b = R.beasts[j];
      if (b.dead > 0) {
        b.dead -= dt;
        if (b.dead <= 0) R.beasts.splice(j, 1);
        continue;
      }
      var sp = b.spd * (b.haste > 0 ? 1.6 : 1) * scale;
      b.y += sp * dt;
      if (b.haste > 0) b.haste -= dt;
      b.x = b.baseX + Math.sin(R.t * 0.7 + b.seed) * Math.min(9, b.y * 0.06);
      b.alpha = Math.min(1, b.y / 70 + 0.25);
      if (b.y >= LAMPY - 16) crash(b);
      if (!R || R.phase !== 'battle') return;
    }

    if (R.needTarget && R.beasts.length) assignTarget();

    var anyAlive = false;
    for (var m = 0; m < R.beasts.length; m++) {
      if (R.beasts[m].dead <= 0) { anyAlive = true; break; }
    }
    if (!anyAlive && R.spawnLeft === 0) {
      /* 先改状态再排定时器，所以回调里要认 'clear' 而不是 'battle'。
         认错状态会导致第一夜打完就再也不进商店。 */
      R.phase = 'clear';
      window.setTimeout(function () {
        if (R && R.phase === 'clear') waveClear();
      }, 420);
    }
  }

  function waveClear() {
    if (R.wave >= MAX_WAVE) { endRun(true); return; }
    openShop();
  }

  /* ────────────────────────── 商店 ────────────────────────── */

  var ITEMS = [
    { id: 'wick', nm: '长明灯芯', ds: '灯油上限 +2，并立刻回满', price: 12, rare: 1,
      apply: function () { R.oilMax += 2; R.oil = R.oilMax; } },
    { id: 'stove', nm: '暖手炉', ds: '每夜开始回 1 点灯油', price: 10, rare: 1,
      apply: function () { R.item.regen += 1; } },
    { id: 'dict', nm: '旧词典', ds: '提示 +3 次，不扣灯花', price: 8, rare: 1,
      apply: function () { R.item.hintLeft += 3; } },
    { id: 'scrap', nm: '词典残页', ds: '每夜第一次拼错不加速', price: 9, rare: 1,
      apply: function () { R.item.firstNoHaste = 1; } },
    { id: 'bell', nm: '铜铃', ds: '拼错时战场不再加速', price: 14, rare: 2, unique: 1,
      apply: function () { R.item.noHaste = 1; } },
    { id: 'ink', nm: '空墨瓶', ds: '每夜开始随机填 1 个字母', price: 16, rare: 2, unique: 1,
      apply: function () { R.item.autoFill = 1; } },
    { id: 'blaze', nm: '灯火大', ds: '拼对时多杀一只最靠前的', price: 15, rare: 2, unique: 1,
      apply: function () { R.item.extra = 1; } },
    { id: 'wax', nm: '蜂蜡', ds: '拼对灯花 +1', price: 13, rare: 2,
      apply: function () { R.item.coinBonus += 1; } },
    { id: 'thorn', nm: '荆棘', ds: '词兽撞灯前被弹开一次', price: 20, rare: 3,
      apply: function () { R.item.repel += 1; } },
    { id: 'twin', nm: '双芯灯', ds: '连击 ≥5 时拼对多杀一只', price: 22, rare: 3, unique: 1,
      apply: function () { R.item.comboKill = 1; } }
  ];

  var shopOffers = [];
  var activeOffer = null;

  function openShop() {
    R.phase = 'shop';
    R.mode = 'shop';
    R.combo = 0;
    R.target = null;
    R.needTarget = true;
    R.word = null;
    R.slots = [];
    R.bank = [];
    activeOffer = null;

    var maxRare = R.wave >= 7 ? 3 : (R.wave >= 3 ? 2 : 1);
    var pool = [];
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      if (it.rare > maxRare) continue;
      if (it.unique && R.owned[it.id]) continue;
      pool.push(it);
    }
    /* 第一夜可选池只有 4 件，给 3 件；之后给 4 件，让货架排满 */
    var want = R.wave === 1 ? 3 : 4;
    shopOffers = [];
    while (shopOffers.length < want && pool.length) {
      var k = Math.floor(Math.random() * pool.length);
      shopOffers.push(pool[k]);
      pool.splice(k, 1);
    }
    shopOffers.forEach(function (o) { o.sold = false; o.struck = false; });
    renderShop();
    showView('shop');
  }

  function renderShop() {
    shopCoins.textContent = '◈ ' + R.coins;
    while (shopList.firstChild) shopList.removeChild(shopList.firstChild);

    shopOffers.forEach(function (o, idx) {
      var row = document.createElement('div');
      row.className = 'row' + (idx === 0 ? ' is-sel' : '') +
        ((o.sold || o.struck) ? ' is-off' : '');

      var left = document.createElement('div');
      var no = document.createElement('span');
      no.className = 'row-no';
      no.textContent = '0' + (idx + 1);
      var nm = document.createElement('span');
      nm.className = 'row-nm';
      nm.textContent = o.nm;
      var ds = document.createElement('p');
      ds.className = 'row-ds';
      ds.textContent = o.ds;
      left.appendChild(no);
      left.appendChild(nm);
      left.appendChild(ds);

      var buy = document.createElement('div');
      buy.className = 'row-buy';
      var price = document.createElement('span');
      price.className = 'row-price';
      price.textContent = String(o.price);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'action';
      if (o.sold) btn.textContent = '已取';
      else if (o.struck) btn.textContent = '错过';
      else if (R.coins < o.price) btn.textContent = '不足';
      else btn.textContent = '拿走';
      if (o.sold || o.struck || R.coins < o.price) btn.disabled = true;
      btn.setAttribute('data-offer', String(idx));
      buy.appendChild(price);
      buy.appendChild(btn);

      row.appendChild(left);
      row.appendChild(buy);
      shopList.appendChild(row);
    });
  }

  function beginChallenge(offer) {
    activeOffer = offer;
    R.mode = 'shop';
    var bucket = R.wave >= 6 ? 2 : 1;
    var pair = pickWord(bucket);
    R.word = { en: pair[0], zh: pair[1] };
    R.slots = new Array(pair[0].length);
    for (var i = 0; i < R.slots.length; i++) R.slots[i] = null;
    R.bank = buildBank(pair[0]);
    askEyebrow.textContent = '拼对，拿走「' + offer.nm + '」';
    renderBoard();
    showSheet(true);
  }

  function finishChallenge(ok) {
    var offer = activeOffer;
    activeOffer = null;
    if (offer) {
      if (ok) {
        R.coins -= offer.price;
        offer.sold = true;
        if (offer.unique) R.owned[offer.id] = 1;
        offer.apply();
      } else {
        offer.struck = true;
      }
    }
    R.word = null;
    R.slots = [];
    R.bank = [];
    showSheet(false);
    if (R.phase !== 'shop') return;
    renderShop();
    updateHud();
  }

  /* ────────────────────────── 视图 ────────────────────────── */

  function showView(name) {
    vHome.hidden = name !== 'home';
    vBattle.hidden = name !== 'battle';
    vShop.hidden = name !== 'shop';
    vResult.hidden = name !== 'result';
    showSheet(name === 'battle');
    if (name === 'battle') resize();
  }

  function showSheet(on) {
    sheet.hidden = !on;
    if (on) resize();
  }

  /* ────────────────────────── 开局 / 结算 ────────────────────────── */

  function startRun() {
    recent = [];
    R = newRun();
    R.item.hintLeft = 2;
    R.phase = 'battle';
    startWave(1);
  }

  function endRun(win) {
    if (!R) return;
    R.phase = 'over';
    if (R.wave > save.best) { save.best = R.wave; writeSave(); }

    $('res-eyebrow').textContent = win ? '天亮了' : '灯灭了';
    $('res-title').textContent = win ? '守到天亮' : '第' + CN[R.wave] + '夜';
    $('res-kills').textContent = String(R.kills);
    $('res-right').textContent = String(R.right);
    $('res-combo').textContent = '×' + R.maxCombo;
    $('res-mastered').textContent = String(R.masteredNew);
    showView('result');
    R = null;
  }

  function refreshHome() {
    if (save.best > 0) {
      $('home-best').textContent = '最好纪录　第' + CN[save.best] + '夜';
    } else {
      $('home-best').textContent = '';
    }
  }

  /* ────────────────────────── 事件 ────────────────────────── */

  bankEl.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== bankEl) {
      if (t.getAttribute && t.getAttribute('data-tile') !== null) {
        tapTile(parseInt(t.getAttribute('data-tile'), 10));
        return;
      }
      t = t.parentNode;
    }
  }, false);

  slotsEl.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== slotsEl) {
      if (t.getAttribute && t.getAttribute('data-slot') !== null) {
        tapSlot(parseInt(t.getAttribute('data-slot'), 10));
        return;
      }
      t = t.parentNode;
    }
  }, false);

  shopList.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== shopList) {
      if (t.getAttribute && t.getAttribute('data-offer') !== null) {
        if (t.disabled) return;
        var idx = parseInt(t.getAttribute('data-offer'), 10);
        var offer = shopOffers[idx];
        if (offer && !offer.sold && !offer.struck && R.coins >= offer.price) {
          beginChallenge(offer);
        }
        return;
      }
      t = t.parentNode;
    }
  }, false);

  btnHint.addEventListener('click', useHint, false);

  $('btn-start').addEventListener('click', startRun, false);
  $('btn-again').addEventListener('click', startRun, false);
  $('btn-home').addEventListener('click', function () {
    R = null;
    refreshHome();
    showView('home');
  }, false);
  $('btn-leave').addEventListener('click', function () {
    showSheet(false);
    startWave(R.wave + 1);
  }, false);

  window.addEventListener('resize', function () {
    resize();
  }, false);

  /* ────────────────────────── 主循环 ────────────────────────── */

  var last = 0;
  function frame(ts) {
    if (!last) last = ts;
    var dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    if (R && R.phase === 'battle') draw();
    window.requestAnimationFrame(frame);
  }

  /* ────────────────────────── 启动 ────────────────────────── */

  loadSave();
  refreshHome();
  showView('home');
  syncUnit();
  window.requestAnimationFrame(frame);
})();
