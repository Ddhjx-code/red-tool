/* ============================================================
   漆扇 · 主流程 (自由创作型：用户主导设计漆纹)
   home（文化）→ create（水盆创作台：滴漆/拉纹/选色/选扇/选手法）
   → dip（入水拓印）→ result（成品 + 知识卡 + 起名 + 分享）
   ============================================================ */
(function () {
  'use strict';

  var D = window.QSData;
  var E = window.QSEngine;
  var Scene = window.QSScene;
  var Share = window.QSShare;
  var mulberry32 = D.mulberry32;

  var params = new URLSearchParams(location.search);
  var isTest = params.get('test') === '1';
  var isDemo = params.get('demo') === '1';
  var BASE_SEED = parseInt(params.get('seed') || '20260902', 10) >>> 0;

  var SAVE_KEY = 'qishan-works';
  var MAX_WORKS = 9;

  var state = {
    view: 'home',
    colorIdx: 0,
    preset: null,
    shape: 'round',
    dip: 'vertical',
    drops: 0,
    drags: 0,
    colorCount: {},
    fan: null,
    seedSeq: 0
  };

  var water, dipFx, fanCanvas;
  var pointer = { down: false, x: 0, y: 0, prevX: 0, prevY: 0 };
  var busy = false;
  var dipAnim = null;
  var revealAnim = null;
  var lastNow = 0;
  var toastTimer = 0;
  var demoTimer = 0;

  function $(id) { return document.getElementById(id); }

  /* ---------- toast ---------- */
  function toast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2000);
  }
  window.QSToast = toast;

  /* ---------- view ---------- */
  function setView(id) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.toggle('is-active', views[i].id === id);
    state.view = id.replace('view-', '');
  }

  /* ---------- 漆色 ---------- */
  function currentColor() {
    var c = D.COLORS[state.colorIdx];
    var rgb = D.hexToRgb(c.hex);
    var k = E.config.COLOR_INTENSITY;
    return { r: rgb.r * k, g: rgb.g * k, b: rgb.b * k };
  }

  function mainColorId() {
    var best = null, bestN = -1, id;
    for (id in state.colorCount) {
      if (Object.prototype.hasOwnProperty.call(state.colorCount, id) && state.colorCount[id] > bestN) {
        bestN = state.colorCount[id]; best = id;
      }
    }
    return best || D.COLORS[state.colorIdx].id;
  }

  function setColorIdx(i, silent) {
    state.colorIdx = Math.max(0, Math.min(D.COLORS.length - 1, i));
    var c = D.COLORS[state.colorIdx];
    $('current-name').textContent = c.name;
    $('current-mineral').textContent = c.mineral;
    var row = $('swatch-row');
    for (var k = 0; k < row.children.length; k++) {
      row.children[k].setAttribute('aria-pressed', k === state.colorIdx ? 'true' : 'false');
    }
    if (!silent) {
      var p = D.presetById(state.preset);
      if (p && p.colors.indexOf(c.id) < 0) state.preset = null;
      syncPresetUI();
    }
  }

  function setPreset(id) {
    var p = D.presetById(id);
    state.preset = p ? p.id : null;
    if (p) {
      var idx = 0;
      for (var i = 0; i < D.COLORS.length; i++) if (D.COLORS[i].id === p.colors[0]) idx = i;
      setColorIdx(idx, true);
      toast(p.name + '配色 · ' + p.desc);
    }
    syncPresetUI();
  }

  function syncPresetUI() {
    var row = $('preset-row');
    for (var i = 0; i < row.children.length; i++) {
      var b = row.children[i];
      b.setAttribute('aria-pressed', b.dataset.preset === (state.preset || 'free') ? 'true' : 'false');
    }
    /* 预设内色卡高亮，预设外淡化（仍可点，点了即回到自由配色） */
    var p = D.presetById(state.preset);
    var sw = $('swatch-row');
    for (var k = 0; k < sw.children.length; k++) {
      var inSet = !p || p.colors.indexOf(sw.children[k].dataset.color) >= 0;
      sw.children[k].classList.toggle('dim', !inSet);
    }
    $('preset-desc').textContent = p ? p.lore : '自由配色 · ' + D.TIPS[1];
  }

  /* ---------- UI 构建 ---------- */
  function buildPaletteUI() {
    var prow = $('preset-row');
    D.PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.dataset.preset = p.id;
      b.textContent = p.name;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', p.name + '配色 ' + p.desc);
      b.addEventListener('click', function () { setPreset(p.id); });
      prow.appendChild(b);
    });
    var free = document.createElement('button');
    free.type = 'button';
    free.className = 'preset';
    free.dataset.preset = 'free';
    free.textContent = '自由';
    free.setAttribute('aria-pressed', 'true');
    free.addEventListener('click', function () { setPreset(null); });
    prow.appendChild(free);

    var srow = $('swatch-row');
    D.COLORS.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.color = c.id;
      b.style.setProperty('--c', c.hex);
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.setAttribute('aria-label', c.name + ' ' + c.en);
      var nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = c.name;
      b.appendChild(nm);
      b.addEventListener('click', function () { setColorIdx(i); });
      srow.appendChild(b);
    });
  }

  function buildOptUI() {
    var shapeRow = $('shape-group');
    D.FANS.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.dataset.shape = f.id;
      b.textContent = f.name;
      b.setAttribute('aria-pressed', f.id === state.shape ? 'true' : 'false');
      b.setAttribute('aria-label', f.name + ' ' + f.desc);
      b.addEventListener('click', function () { setShape(f.id); });
      shapeRow.appendChild(b);
    });

    var dipRow = $('dip-group');
    D.DIPS.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.dataset.dip = d.id;
      b.textContent = d.name;
      b.setAttribute('aria-pressed', d.id === state.dip ? 'true' : 'false');
      b.setAttribute('aria-label', d.name + '入水 ' + d.desc);
      b.addEventListener('click', function () { setDip(d.id); });
      dipRow.appendChild(b);
    });
    syncDipDesc();
  }

  function setShape(id) {
    state.shape = id;
    var row = $('shape-group');
    for (var i = 0; i < row.children.length; i++) {
      row.children[i].setAttribute('aria-pressed', row.children[i].dataset.shape === id ? 'true' : 'false');
    }
  }

  function setDip(id) {
    state.dip = id;
    var row = $('dip-group');
    for (var i = 0; i < row.children.length; i++) {
      row.children[i].setAttribute('aria-pressed', row.children[i].dataset.dip === id ? 'true' : 'false');
    }
    syncDipDesc();
  }

  function syncDipDesc() {
    $('dip-desc').textContent = D.dipById(state.dip).desc;
  }

  /* ---------- 首页 ---------- */
  function syntheticCapture(w, h, seed) {
    /* 无 WebGL 也能出漆纹意象：CPU 版 splat 叠加 + 同一套 chroma-aware 提亮 */
    var rnd = mulberry32(seed);
    var preset = D.PRESETS[Math.floor(rnd() * D.PRESETS.length)];
    var blobs = [];
    for (var i = 0; i < 11; i++) {
      var cid = preset.colors[i % preset.colors.length];
      var rgb = D.hexToRgb(D.colorById(cid).hex);
      blobs.push({
        x: 0.12 + rnd() * 0.76, y: 0.12 + rnd() * 0.76,
        r: 0.012 + rnd() * 0.05,
        c: [rgb.r, rgb.g, rgb.b]
      });
    }
    var data = new Uint8Array(w * h * 4);
    for (var py = 0; py < h; py++) {
      var vy = py / (h - 1);
      for (var px = 0; px < w; px++) {
        var ux = px / (w - 1);
        var dr = 0, dg = 0, db = 0;
        for (var b = 0; b < blobs.length; b++) {
          var bl = blobs[b];
          var dx = ux - bl.x, dy = vy - bl.y;
          var f = Math.exp(-(dx * dx + dy * dy) / bl.r);
          dr += f * bl.c[0]; dg += f * bl.c[1]; db += f * bl.c[2];
        }
        var density = Math.max(dr, Math.max(dg, db));
        var mn = Math.min(dr, Math.min(dg, db));
        var sat = (density - mn) / Math.max(density, 0.0001);
        var alpha = density <= 0 ? 0 : density >= 0.11 ? 1 : density / 0.11;
        var tintR = dr / Math.max(density, 0.0001), tintG = dg / Math.max(density, 0.0001), tintB = db / Math.max(density, 0.0001);
        var boost = 1 + 2 * (1 - Math.min(1, Math.max(0, (density - 0.35) / 0.65)));
        var kk = Math.min(1, density * boost);
        var mix = sat <= 0.18 ? 0 : (sat >= 0.42 ? 1 : (sat - 0.18) / 0.24);
        var r = (Math.min(1, dr) * (1 - mix) + tintR * kk * mix) * 255;
        var g2 = (Math.min(1, dg) * (1 - mix) + tintG * kk * mix) * 255;
        var b2 = (Math.min(1, db) * (1 - mix) + tintB * kk * mix) * 255;
        var idx = (py * w + px) * 4;
        data[idx] = r; data[idx + 1] = g2; data[idx + 2] = b2; data[idx + 3] = alpha * 255;
      }
    }
    return { width: w, height: h, data: data };
  }

  function paintHomeBasin() {
    var cv = $('home-fan');
    if (!cv) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth || 260, h = cv.clientHeight || 150;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);

    /* 水盆夜色 */
    var bg = g.createRadialGradient(cv.width / 2, cv.height * 0.5, 8, cv.width / 2, cv.height * 0.5, cv.width * 0.8);
    bg.addColorStop(0, '#123047');
    bg.addColorStop(0.55, '#0a1320');
    bg.addColorStop(1, '#060b12');
    g.fillStyle = bg;
    g.fillRect(0, 0, cv.width, cv.height);

    var cap = syntheticCapture(180, 220, BASE_SEED + 7);
    var pattern = Scene.buildPattern(cap, 'rotate', BASE_SEED + 7);
    Scene.drawFan(g, {
      cx: cv.width / 2, cy: cv.height * 0.52,
      r: Math.min(cv.width, cv.height) * 0.38,
      shape: 'round', pattern: pattern, tilt: -6
    });
  }

  function renderWorks() {
    var row = $('works-row');
    row.innerHTML = '';
    var list = loadWorks();
    if (!list.length) {
      var empty = document.createElement('p');
      empty.className = 'works-empty';
      empty.textContent = '还没有作品 · 漂第一把漆扇';
      row.appendChild(empty);
      $('home-progress').textContent = '已作 0 把漆扇';
      return;
    }
    list.forEach(function (wk) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'work-thumb';
      var img = document.createElement('img');
      img.src = wk.thumb;
      img.alt = wk.name;
      var nm = document.createElement('span');
      nm.className = 'wn';
      nm.textContent = wk.name;
      b.appendChild(img);
      b.appendChild(nm);
      b.addEventListener('click', function () { toast(wk.name + ' · ' + wk.note); });
      row.appendChild(b);
    });
    $('home-progress').textContent = '已作 ' + list.length + ' 把漆扇 · 每把独一无二';
  }

  function enterHome() {
    busy = false; dipAnim = null;
    renderWorks();
    paintHomeBasin();
    setView('view-home');
  }

  /* ---------- 创作台 ---------- */
  function sizeCanvases() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    dipFx.width = Math.max(1, Math.round(water.clientWidth * dpr));
    dipFx.height = Math.max(1, Math.round(water.clientHeight * dpr));
  }

  function enterCreate(fresh) {
    setView('view-create');
    sizeCanvases();
    E.resize();
    if (fresh) E.reset();
    busy = false; dipAnim = null;
    var ctx = dipFx.getContext('2d');
    ctx.clearRect(0, 0, dipFx.width, dipFx.height);
    syncDipDesc();
  }

  function getUV(e) {
    var rect = water.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: 1.0 - (e.clientY - rect.top) / rect.height   /* flip Y for GL space */
    };
  }

  function onPointerDown(e) {
    if (!E.ok || busy || state.view !== 'create') return;
    e.preventDefault();
    var uv = getUV(e);
    pointer.down = true;
    pointer.x = uv.x; pointer.y = uv.y; pointer.prevX = uv.x; pointer.prevY = uv.y;
    dropLacquer(uv.x, uv.y);
  }

  function onPointerMove(e) {
    if (!pointer.down || !E.ok || busy) return;
    e.preventDefault();
    var uv = getUV(e);
    var dx = (uv.x - pointer.prevX) * E.config.SPLAT_FORCE;
    var dy = (uv.y - pointer.prevY) * E.config.SPLAT_FORCE;
    pointer.prevX = pointer.x; pointer.prevY = pointer.y;
    pointer.x = uv.x; pointer.y = uv.y;
    E.drag(uv.x, uv.y, dx, dy);
    state.drags++;
  }

  function onPointerUp() { pointer.down = false; }

  function dropLacquer(x, y) {
    E.drop(x, y, currentColor());
    state.drops++;
    var id = D.COLORS[state.colorIdx].id;
    state.colorCount[id] = (state.colorCount[id] || 0) + 1;
  }

  /* ---------- 入水拓印 ---------- */
  function nextSeed() {
    state.seedSeq++;
    return (BASE_SEED + state.seedSeq * 7919) >>> 0;
  }

  function doDip() {
    if (!E.ok || busy || state.view !== 'create') return false;
    var cap = E.capture();
    var coverage = E.coverage(cap);
    if (coverage < 0.02) {
      toast('水面还没有漆 · 先点几处水面滴漆');
      return false;
    }
    busy = true;
    var seed = nextSeed();
    var pattern = Scene.buildPattern(cap, state.dip, seed);
    var mc = mainColorId();
    var fan = {
      seed: seed,
      shape: state.shape,
      dip: state.dip,
      dipName: D.dipById(state.dip).name,
      fanName: D.fanById(state.shape).name,
      pattern: pattern,
      coverage: coverage,
      mainColor: mc,
      mainColorName: D.colorById(mc).name,
      palette: state.preset ? D.presetById(state.preset).name : '自由配色',
      colors: colorList(),
      note: D.makeNote(mc, state.dip, coverage),
      name: D.makeName(seed, mc),
      knowledge: pickKnowledge(seed),
      drops: state.drops,
      drags: state.drags
    };
    state.fan = fan;
    dipAnim = { start: performance.now(), dur: 1750, fan: fan };
    toast(D.dipById(state.dip).name + '入水 · 拓印漆纹');
    return true;
  }

  function colorList() {
    var out = [], id;
    for (id in state.colorCount) {
      if (Object.prototype.hasOwnProperty.call(state.colorCount, id)) out.push(D.colorById(id).name);
    }
    return out.length ? out : [D.COLORS[state.colorIdx].name];
  }

  function pickKnowledge(seed) {
    var i = seed % D.KNOWLEDGE.length;
    return D.KNOWLEDGE[i];
  }

  function drawDipAnim(now) {
    var t = (now - dipAnim.start) / dipAnim.dur;
    var g = dipFx.getContext('2d');
    if (t >= 1) {
      g.clearRect(0, 0, dipFx.width, dipFx.height);
      var fan = dipAnim.fan;
      dipAnim = null;
      busy = false;
      showResult(fan);
      return;
    }
    Scene.drawDipFx(g, dipFx.width, dipFx.height, t, { shape: dipAnim.fan.shape, pattern: dipAnim.fan.pattern });
  }

  /* ---------- 成品 ---------- */
  function sizeFanCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = fanCanvas.clientWidth || 320;
    fanCanvas.width = Math.round(w * dpr);
    fanCanvas.height = Math.round(w * dpr);
  }

  function showResult(fan) {
    $('result-kicker').textContent = fan.fanName + ' · ' + fan.dipName + '入水';
    $('result-meta').textContent = fan.note + ' · ' + fan.palette;
    $('fan-name').value = fan.name;
    state.name = fan.name;

    var know = $('result-know');
    know.innerHTML = '';
    var tag = document.createElement('p');
    tag.className = 'card-title';
    tag.textContent = fan.knowledge.tag;
    var body = document.createElement('p');
    body.textContent = fan.knowledge.text;
    know.appendChild(tag);
    know.appendChild(body);

    $('result-extra').textContent = '滴漆 ' + fan.drops + ' 次 · 拉纹 ' + fan.drags + ' 次 · 漆色 ' + fan.colors.join(' / ');

    Share.lastFan = fan;
    saveWork(fan);
    setView('view-result');
    sizeFanCanvas();
    revealAnim = { start: performance.now(), dur: 760, fan: fan };
  }

  function drawReveal(now) {
    var t = Math.min(1, (now - revealAnim.start) / revealAnim.dur);
    var k = 1 - Math.pow(1 - t, 3);
    Scene.paintFanCard(fanCanvas, { shape: revealAnim.fan.shape, pattern: revealAnim.fan.pattern, reveal: k });
    if (t >= 1) revealAnim = null;
  }

  function rename(name) {
    var fan = state.fan;
    if (!fan) return;
    var v = (name == null ? $('fan-name').value : String(name)).trim().slice(0, 8);
    fan.name = v || D.makeName(fan.seed, fan.mainColor);
    $('fan-name').value = fan.name;
    if (Share.lastFan === fan) Share.lastFan.name = fan.name;
    updateWorkName(fan);
    if (revealAnim) return;
    Scene.paintFanCard(fanCanvas, { shape: fan.shape, pattern: fan.pattern, reveal: 1 });
  }

  function rerollName() {
    var fan = state.fan;
    if (!fan) return;
    fan.seed = (fan.seed + 104729) >>> 0;
    rename(D.makeName(fan.seed, fan.mainColor));
    toast('另取一名 · ' + fan.name);
  }

  function redo() {
    state.drops = 0; state.drags = 0; state.colorCount = {};
    enterCreate(true);
    toast('水面已重置 · 重新滴漆拉纹');
  }

  /* ---------- localStorage ---------- */
  function loadWorks() {
    try {
      var o = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
      return Object.prototype.toString.call(o) === '[object Array]' ? o : [];
    } catch (e) { return []; }
  }

  function saveWork(fan) {
    var list = loadWorks();
    var rec = {
      id: String(fan.seed),
      name: fan.name,
      note: fan.note,
      shape: fan.shape,
      dip: fan.dip,
      colors: fan.colors,
      coverage: Math.round(fan.coverage * 100) / 100,
      seed: fan.seed,
      ts: Date.now(),
      thumb: Scene.makeThumb(fan, 150)
    };
    list.unshift(rec);
    if (list.length > MAX_WORKS) list = list.slice(0, MAX_WORKS);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); } catch (e) { /* 容量不足则忽略 */ }
  }

  function updateWorkName(fan) {
    var list = loadWorks();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === String(fan.seed)) { list[i].name = fan.name; break; }
    }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  /* ---------- 主循环 ---------- */
  function frame(now) {
    var dt = Math.min((now - lastNow) / 1000, 0.016666);
    lastNow = now;
    if (state.view === 'create' && E.ok) {
      E.update(dt);
      if (dipAnim) drawDipAnim(now);
    } else if (state.view === 'result' && revealAnim) {
      drawReveal(now);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- demo 自驾（录制用：滴漆 → 拉纹 → 入水 → 起名） ---------- */
  var DEMO = [
    { a: 'preset', id: 'qianli' },
    { a: 'drop', x: 0.34, y: 0.60 },
    { a: 'drop', x: 0.63, y: 0.56 },
    { a: 'color', i: 1 },
    { a: 'drop', x: 0.48, y: 0.71 },
    { a: 'stroke', pts: [[0.18, 0.48], [0.30, 0.55], [0.42, 0.47], [0.55, 0.56], [0.68, 0.47], [0.80, 0.55]] },
    { a: 'color', i: 2 },
    { a: 'drop', x: 0.28, y: 0.42 },
    { a: 'drop', x: 0.70, y: 0.40 },
    { a: 'stroke', pts: [[0.50, 0.72], [0.44, 0.60], [0.52, 0.50], [0.46, 0.38], [0.54, 0.28]] },
    { a: 'preset', id: 'dunhuang' },
    { a: 'color', i: 7 },
    { a: 'drop', x: 0.52, y: 0.52 },
    { a: 'stroke', pts: [[0.22, 0.62], [0.36, 0.66], [0.52, 0.62], [0.68, 0.66], [0.82, 0.60]] },
    { a: 'shape', id: 'round' },
    { a: 'dip', id: 'rotate' },
    { a: 'doDip' }
  ];

  function strokePath(pts) {
    E.stroke(pts);
    state.drags += pts.length;
  }

  function runDemo(i) {
    if (i >= DEMO.length) return;
    var op = DEMO[i];
    if (op.a === 'preset') setPreset(op.id);
    else if (op.a === 'color') setColorIdx(op.i);
    else if (op.a === 'drop') dropLacquer(op.x, op.y);
    else if (op.a === 'stroke') strokePath(op.pts);
    else if (op.a === 'shape') setShape(op.id);
    else if (op.a === 'dip') setDip(op.id);
    else if (op.a === 'doDip') { doDip(); return; }
    demoTimer = setTimeout(function () { runDemo(i + 1); }, op.a === 'stroke' ? 900 : 520);
  }

  /* ---------- init ---------- */
  function init() {
    water = $('water');
    dipFx = $('dip-fx');
    fanCanvas = $('fan-result');

    var intro = $('home-intro');
    D.INTRO.forEach(function (t) {
      var p = document.createElement('p');
      p.textContent = t;
      intro.appendChild(p);
    });
    $('home-series').textContent = D.SERIES;
    $('home-sub').textContent = D.SUBTITLE;

    buildPaletteUI();
    buildOptUI();
    setColorIdx(0, true);
    syncPresetUI();

    /* 流体引擎 */
    E.setSeed(BASE_SEED);
    if (!E.init(water)) {
      $('err').classList.add('show');
      $('btn-dip').disabled = true;
    }

    /* 事件（全部 addEventListener，无行内事件） */
    water.addEventListener('pointerdown', onPointerDown);
    water.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('resize', function () {
      if (state.view === 'create') { sizeCanvases(); E.resize(); }
      else if (state.view === 'home') paintHomeBasin();
      else if (state.view === 'result' && state.fan) {
        sizeFanCanvas();
        Scene.paintFanCard(fanCanvas, { shape: state.fan.shape, pattern: state.fan.pattern, reveal: 1 });
      }
    });

    $('btn-start').addEventListener('click', function () { enterCreate(true); });
    $('btn-back').addEventListener('click', function () { enterHome(); });
    $('btn-reset').addEventListener('click', function () {
      E.reset();
      state.drops = 0; state.drags = 0; state.colorCount = {};
      toast('水面已重置');
    });
    $('btn-dip').addEventListener('click', function () { doDip(); });

    $('btn-reroll').addEventListener('click', rerollName);
    $('fan-name').addEventListener('input', function () { rename(); });
    $('btn-redo').addEventListener('click', redo);
    $('btn-result-home').addEventListener('click', function () { enterHome(); });
    $('btn-save-album').addEventListener('click', function () { Share.saveAlbum(); });
    $('btn-post-note').addEventListener('click', function () { Share.postNote(); });

    lastNow = performance.now();
    requestAnimationFrame(frame);

    if (isTest) {
      enterCreate(false);
    } else if (isDemo) {
      enterCreate(true);
      demoTimer = setTimeout(function () { runDemo(0); }, 900);
    } else {
      enterHome();
    }

    /* ---------- test hooks ---------- */
    window.__game = {
      start: function () { enterCreate(true); },
      home: enterHome,
      state: function () { return state; },
      snapshot: function () {
        var cap = E.ok ? E.capture() : null;
        return {
          view: state.view,
          color: D.COLORS[state.colorIdx].name,
          preset: state.preset,
          shape: state.shape,
          dip: state.dip,
          drops: state.drops,
          drags: state.drags,
          coverage: cap ? Math.round(E.coverage(cap) * 1000) / 1000 : 0,
          hasFan: !!state.fan,
          name: state.fan ? state.fan.name : '',
          works: loadWorks().length,
          engineOk: E.ok
        };
      },
      drop: function (x, y) { if (state.view !== 'create') enterCreate(false); dropLacquer(x, y); },
      stroke: strokePath,
      setColor: function (i) { setColorIdx(i); },
      setPreset: setPreset,
      setShape: setShape,
      setDip: setDip,
      dip: doDip,
      result: function () {
        var f = state.fan;
        if (!f) return null;
        return {
          name: f.name, shape: f.shape, dip: f.dip, coverage: f.coverage,
          mainColor: f.mainColorName, palette: f.palette, colors: f.colors,
          knowledge: f.knowledge.tag, hasPattern: !!f.pattern
        };
      },
      setName: function (n) { rename(n); return state.fan ? state.fan.name : ''; },
      works: loadWorks,
      resetWater: function () { E.reset(); },
      shareCard: function () {
        var url = Share.lastFan ? Share.paintCard(Share.lastFan) : '';
        return url ? url.length : 0;
      }
    };
    window.__ready = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
