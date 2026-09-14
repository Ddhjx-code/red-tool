/* ============================================================
   月下灯会 · 主流程 (window.__game / window.__ready)
   home（中秋灯会文化 + 我的彩灯）→ create（备灯 / 选灯色 / 绘纹 + 灯形 /
   点亮 / 放灯）→ result（成品 + 起名 + 知识卡 + 分享）
   流程依据 docs/specs/2026-09-13-yuedeng-design.md §3 §6 §9。

   职责边界（任务约束）：
   - 本层是全场唯一的 requestAnimationFrame 循环持有者，驱动
     YDEngine.update(dt)（= simulate + render）。其余五模块零 rAF。
   - 缩略图与分享卡全部由 share.js 产出，本层不做任何截图。
   - #palette 与 #shapes 由本层构建（scene.js 只管夜空元素），
     结构与已验证原型 tools/yuedeng/prototype.html 逐字一致。
   - 全场只有一行上下文提示，写在 #current-label（用户已确认的单行版式）。

   确定性：零随机（灯名由创作选择的确定性哈希派生，reroll 只是序号递增）、
   零网络引用、零外部依赖。
   ============================================================ */
(function () {
  'use strict';
  // allow: SIZE_OK —— 系列的单一集成入口（视图路由 + 控件构建 + 指针交互 +
  // 成品/存档 + 测试钩子）。拆分会把「唯一 rAF 归属」这条锁定约束打散，
  // 与 tools/qishan/assets/main.js 的系列结构同源。

  var D = window.YDData;
  var E = window.YDEngine;
  var Scene = window.YDScene;
  var Save = window.YDSave;
  var Share = window.YDShare;

  var params = new URLSearchParams(location.search);
  /* ?test=1 沿用系列约定：只暴露钩子。与漆扇不同，本作冒烟用例要求
     「首页为初始视图」，故测试态同样从首页起步，由用例自行驱动导航。 */
  var isTest = params.get('test') === '1';
  /* CG 结局可由用例显式关掉：不带 ?test=1 的页面要断言「首页为初始视图」，
     却仍需走到成品页，故不能只靠 isTest 退出 12.5s 序列。 */
  var finaleSkipped = false;

  var NAME_MAX = 8;              /* index.html #lamp-name maxlength=8 */

  var state = {
    view: 'home',
    colorIdx: 0,
    shapeIdx: 0,
    lit: false,
    spin: true,
    placement: D.PLACEMENTS[0].id,
    colorUse: {},                /* 灯色 id → 使用次数（主色判定用） */
    splats: 0,                   /* 绘纹笔数 */
    nameSeq: 0,                  /* reroll 序号（零随机，只递增） */
    workId: null,                /* 当前成品在存档里的 id */
    lamp: null                   /* 当前成品 */
  };

  var canvas = null;             /* #lamp：引擎的 WebGL 画布 */
  var resultCanvas = null;       /* #lamp-result：成品台的 2D 画布 */
  var pointer = { down: false, id: -1, x: 0, y: 0, prevX: 0, prevY: 0 };
  var lastNow = 0;
  var toastTimer = 0;

  function $(id) { return document.getElementById(id); }

  /* ---------- toast ---------- */
  function toast(msg) {
    var el = $('toast');
    if (!el) { return; }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2000);
  }
  window.YDToast = toast;

  /* ============================================================
     视图路由：三视图由 is-active 切换。
     切换后必须补调 Scene.resize()（隐藏视图实测为 0，骨架几何会算错）。
     引擎 resize() 只在创作台可见时调——见 enterCreate 里的说明。
     ============================================================ */
  function setView(id) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle('is-active', views[i].id === id);
    }
    state.view = id.replace('view-', '');
    Scene.resize();
  }

  /* ============================================================
     灯色 / 灯形控件（scene.js 明确未建，此处补齐；结构取自原型）
     ============================================================ */
  function colorIds() {
    var out = [], id;
    for (id in state.colorUse) {
      if (Object.prototype.hasOwnProperty.call(state.colorUse, id)) { out.push(id); }
    }
    /* 按 COLORS 表序输出，于是文案与存档里的灯色顺序恒定 */
    out.sort(function (a, b) {
      var i, ai = -1, bi = -1;
      for (i = 0; i < D.COLORS.length; i++) {
        if (D.COLORS[i].id === a) { ai = i; }
        if (D.COLORS[i].id === b) { bi = i; }
      }
      return ai - bi;
    });
    return out;
  }

  function colorNames() {
    var ids = colorIds(), out = [], i;
    for (i = 0; i < ids.length; i++) { out.push(D.colorById(ids[i]).name); }
    return out;
  }

  function mainColorId() {
    var best = null, bestN = -1, id;
    for (id in state.colorUse) {
      if (Object.prototype.hasOwnProperty.call(state.colorUse, id) && state.colorUse[id] > bestN) {
        bestN = state.colorUse[id]; best = id;
      }
    }
    return best || D.COLORS[state.colorIdx].id;
  }

  /* 单行上下文提示（全场唯一一行）。优先级：点亮 > 未落笔 > 配色口诀。
     COLOR_RULES / checkPalette 在此驱动「2 浅 1 深 或 2 暖 1 冷」的语境化提示。 */
  function hintFor() {
    if (state.lit) { return '灯光透过纹样，色彩在光里流变'; }
    var ids = colorIds();
    if (state.splats === 0) { return '拖动灯面绘纹，彩漆自会扩散'; }
    if (ids.length < D.COLOR_RULES.minColors) { return D.COLOR_RULES.text; }
    var chk = D.checkPalette(ids);
    if (chk.passes) {
      return (chk.lightDark ? D.COLOR_RULES.lightDark : D.COLOR_RULES.warmCool) + ' · 已合口诀';
    }
    return D.COLOR_RULES.text;
  }

  function updateLabel() {
    var el = $('current-label');
    if (!el) { return; }
    el.innerHTML = '灯色 <b>' + D.COLORS[state.colorIdx].name + '</b> · ' +
                   D.placementById(state.placement).name + ' · ' + hintFor();
  }

  /* 选灯色：引擎 setColor 内部已施加 COLOR_INTENSITY，此处只传归一化色 */
  function selectColor(i) {
    state.colorIdx = Math.max(0, Math.min(D.COLORS.length - 1, i));
    var c = D.COLORS[state.colorIdx];
    E.setColor(D.hexToRgb(c.hex));
    var row = $('palette');
    for (var k = 0; k < row.children.length; k++) {
      row.children[k].setAttribute('aria-pressed', k === state.colorIdx ? 'true' : 'false');
    }
    updateLabel();
  }

  /* 选灯形：引擎内部做四个 SDF 权重的形变过渡（0.45s，形变而非跳变） */
  function setShape(i) {
    state.shapeIdx = Math.max(0, Math.min(D.SHAPES.length - 1, i));
    E.setShape(D.SHAPES[state.shapeIdx].sdfIndex);
    var row = $('shapes');
    for (var k = 0; k < row.children.length; k++) {
      row.children[k].setAttribute('aria-pressed', k === state.shapeIdx ? 'true' : 'false');
    }
    updateLabel();
  }

  function buildPalette() {
    var host = $('palette');
    if (!host || host.childNodes.length) { return; }
    D.COLORS.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.colorIndex = String(i);
      b.dataset.color = c.id;
      b.style.setProperty('--c', c.hex);
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.setAttribute('aria-label', '灯色 ' + c.name + ' ' + c.en);
      var nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = c.name;
      b.appendChild(nm);
      b.addEventListener('click', function () { selectColor(i); });
      host.appendChild(b);
    });
  }

  function buildShapes() {
    var host = $('shapes');
    if (!host || host.childNodes.length) { return; }
    D.SHAPES.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'shape-btn';
      b.dataset.shapeIndex = String(i);
      b.dataset.shape = s.id;
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.setAttribute('aria-label', '灯形 ' + s.name + ' ' + s.desc);
      b.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="' + s.glyph + '" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg><span>' + s.name + '</span>';
      b.addEventListener('click', function () { setShape(i); });
      host.appendChild(b);
    });
  }

  /* 彩绘·画纹：传统纹样（月／桂／兔／云／花鸟）落到灯面。
     走引擎的 splatMotif，与手绘同一颜料通路，故纹样随染料晕开、
     随筒面转动、点亮时一起透光。按钮是瞬时的（点一次落一次纹），
     aria-pressed 只标记最后一次落的是哪一格。 */
  function buildMotifs() {
    var host = $('motifs');
    if (!host || host.childNodes.length) { return; }
    D.MOTIFS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'motif-btn';
      b.dataset.motif = m.id;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', '纹样 ' + m.name + ' ' + m.desc);
      b.textContent = m.name;
      b.addEventListener('click', function () { applyMotif(m.id, b); });
      host.appendChild(b);
    });
  }

  function applyMotif(id, btn) {
    var n = E.splatMotif(id, D.hexToRgb(D.COLORS[state.colorIdx].hex));
    if (!n) { return; }
    var row = $('motifs');
    if (row) {
      for (var k = 0; k < row.children.length; k++) {
        row.children[k].setAttribute('aria-pressed', 'false');
      }
    }
    if (btn) { btn.setAttribute('aria-pressed', 'true'); }
    notePaint();
    updateLabel();
  }

  function buildPlacements() {
    var host = $('placements');
    if (!host || host.childNodes.length) { return; }
    D.PLACEMENTS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'place-btn';
      b.dataset.placement = p.id;
      b.setAttribute('aria-pressed', p.id === state.placement ? 'true' : 'false');
      b.setAttribute('aria-label', '放灯 ' + p.name + ' ' + p.desc);
      b.textContent = p.name;
      b.addEventListener('click', function () { setPlacement(p.id); });
      host.appendChild(b);
    });
  }

  function setPlacement(id) {
    var p = Scene.setPlacement(id);
    if (!p) { return null; }
    state.placement = p.id;
    var row = $('placements');
    if (row) {
      for (var k = 0; k < row.children.length; k++) {
        row.children[k].setAttribute('aria-pressed',
          row.children[k].dataset.placement === p.id ? 'true' : 'false');
      }
    }
    updateLabel();
    return p;
  }

  function setSpin(on) {
    state.spin = !!on;
    E.setAutoRotate(state.spin);
    var b = $('spin-btn');
    if (b) { b.setAttribute('aria-pressed', state.spin ? 'true' : 'false'); }
    return state.spin;
  }

  /* ============================================================
     点亮 / 熄灭：引擎的 WebGL 辉光与舞台的 DOM 齐明必须双双调用
     （scene.js 只管 is-lit 与每盏灯的大气透视，不碰引擎）
     ============================================================ */
  function setLit(on) {
    state.lit = !!on;
    E.setLit(state.lit);          /* WebGL 透光 + 烛火对流 */
    Scene.setLit(state.lit);      /* #stage.is-lit → 26 盏背景灯齐明 */
    var btn = $('light-btn');
    if (btn) {
      btn.classList.toggle('is-on', state.lit);
      btn.textContent = state.lit ? '熄 灯' : '点 亮';
    }
    updateLabel();
    return state.lit;
  }

  /* ============================================================
     月相：一枚按钮循环五档，.pname 取返回条目的 name
     ============================================================ */
  function cyclePhase() {
    var p = Scene.nextPhase();
    var btn = $('phase-btn');
    if (btn) {
      var nm = btn.querySelector('.pname');
      if (nm) { nm.textContent = p.name; }
    }
    return p;
  }

  function syncPhaseLabel() {
    var p = Scene.phase();
    var btn = $('phase-btn');
    if (!p || !btn) { return; }
    var nm = btn.querySelector('.pname');
    if (nm) { nm.textContent = p.name; }
  }

  /* ============================================================
     指针绘纹（与已验证原型逐字同源：命中判定 → 夹取 → 三段补笔）
     ============================================================ */
  function uvOf(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width, y: 1.0 - (clientY - r.top) / r.height };
  }

  function onPointerDown(e) {
    if (!E.ok || state.view !== 'create') { return; }
    e.preventDefault();
    var uv = uvOf(e.clientX, e.clientY);
    if (!E.onLamp(uv)) { return; }
    pointer.down = true;
    pointer.id = e.pointerId;
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* window 监听仍会跟踪 */ }
    }
    pointer.x = uv.x; pointer.y = uv.y; pointer.prevX = uv.x; pointer.prevY = uv.y;
    E.splat(uv.x, uv.y, 0, 0);
    notePaint();
  }

  function onPointerMove(e) {
    if (!pointer.down || e.pointerId !== pointer.id || !E.ok) { return; }
    e.preventDefault();
    var uv = uvOf(e.clientX, e.clientY);
    var c = E.clampToLamp(uv);                 /* 笔触不外溢灯面矩形 */
    pointer.prevX = pointer.x; pointer.prevY = pointer.y;
    pointer.x = c.x; pointer.y = c.y;
    E.stroke(pointer.prevX, pointer.prevY, c.x, c.y);   /* 沿折线补两笔，不断线 */
    notePaint();
  }

  function releasePointer(e) {
    if (!pointer.down || (e && e.pointerId !== pointer.id)) { return; }
    pointer.down = false; pointer.id = -1;
  }

  function notePaint() {
    state.splats++;
    var id = D.COLORS[state.colorIdx].id;
    state.colorUse[id] = (state.colorUse[id] || 0) + 1;
    updateLabel();
  }

  /* ============================================================
     首页：我的彩灯
     ============================================================ */
  function renderWorks() {
    return Save.renderWorks(openWork);
  }

  /* ============================================================
     创作台
     ============================================================ */
  function enterCreate(fresh) {
    setView('view-create');
    /* 引擎 resize 只在创作台可见时调：#lamp 隐藏时 clientWidth 为 0，
       E.resize() 会把画布缩到 1×1 并重建 FBO —— 那会抹掉已绘的纹样。
       故顺序是：先切视图（画布随即可见）→ 再同步骨架 → 最后 resize 引擎。 */
    Scene.resize();
    E.resize();
    if (fresh) {
      E.reset();
      state.colorUse = {};
      state.splats = 0;
      state.nameSeq = 0;
      setLit(false);
    }
    syncPhaseLabel();
    updateLabel();
  }

  /* ============================================================
     成品：灯名（零随机）/ 放灯手法 / 知识卡 / 存档
     ============================================================ */

  /* djb2 整数哈希：把创作选择映射成一个确定的序号（零随机） */
  function hashOf(s) {
    var h = 5381, i;
    for (i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; }
    return h >>> 0;
  }

  function nameSeedOf(lamp) {
    return hashOf(lamp.colors.join('|') + '#' + lamp.shape + '#' + lamp.phase + '#' + lamp.placement);
  }

  /* 灯名：YDData.nameAt(确定序号)。reroll 只是序号 +1，同一盏灯的
     名字序列完全可复现，绝不取随机数。 */
  function nameAt(lamp, seq) {
    return D.nameAt(nameSeedOf(lamp) + seq);
  }

  /* 放灯手法：index.html 与 style.css 都没有放灯选择控件（详见交付报告），
     故此处按创作选择确定性推定，并在成品页明示给用户：
     - 莲花灯 → 水放（SHAPES[3].desc 自陈「中秋放灯水里的一式」）
     - 冷色为主 → 挂架（成串成列，远看即是灯河）
     - 其余 → 手提（灯会里最常见的一式） */
  function makeLamp() {
    var ids = colorIds();
    var shape = D.SHAPES[state.shapeIdx];
    var phase = Scene.phase() || D.PHASES[0];
    var main = mainColorId();
    var lamp = {
      shape: shape.id,
      shapeName: shape.name,
      colors: ids.length ? ids : [D.COLORS[0].id],
      mainColorId: main,
      mainColorName: D.colorById(main).name,
      phase: phase.code,
      phaseName: phase.name,
      splats: state.splats,
      lit: state.lit,
      src: canvas                    /* share.js 由此同步取灯纹样 */
    };
    lamp.placement = state.placement;
    lamp.placementName = D.placementById(lamp.placement).name;
    lamp.note = D.makeNote(main, lamp.shape, lamp.phase);
    lamp.name = nameAt(lamp, state.nameSeq);
    lamp.knowledge = D.KNOWLEDGE[nameSeedOf(lamp) % D.KNOWLEDGE.length];
    return lamp;
  }

  function populateResult(lamp) {
    $('result-kicker').textContent = D.SERIES + ' · ' + D.TITLE;
    $('result-meta').textContent = lamp.note;
    $('lamp-name').value = lamp.name;

    var know = $('result-know');
    know.innerHTML = '';
    var tag = document.createElement('p');
    tag.className = 'card-title';
    tag.textContent = lamp.knowledge.tag;
    var body = document.createElement('p');
    body.textContent = lamp.knowledge.text;
    know.appendChild(tag);
    know.appendChild(body);

    $('result-extra').textContent =
      '绘纹 ' + lamp.splats + ' 笔 · 灯色 ' + colorNamesOf(lamp).join(' / ') +
      ' · ' + D.placementById(lamp.placement).desc;
  }

  function colorNamesOf(lamp) {
    var out = [], i;
    for (i = 0; i < lamp.colors.length; i++) { out.push(D.colorById(lamp.colors[i]).name); }
    return out;
  }

  /* 成品页入口：CG 结局结束与 ?test=1 直通两条路径共用，避免重复 */
  function enterResult(lamp) {
    setView('view-result');
    Scene.setResultPlacement(lamp.placement);
    Scene.setResultLit(true);
    Scene.resize();
    Share.show(resultCanvas, lamp);
    toast(lamp.placementName + '放灯 · 放入月下灯会');
  }

  /* 放灯 → CG 结局（§10）→ 成品。缩略图在切视图之前取（#lamp 此刻仍可见且已渲染），
     由 share.js 产出，main.js 不做任何截图。
     ?test=1 时直通成品页：冒烟用例断言 #view-result.is-active 且超时 6s，
     短于 12.5s 的 CG 序列，无条件拦截会让全部断言超时失败。 */
  function release() {
    if (state.view !== 'create') { return false; }
    var lamp = makeLamp();
    state.lamp = lamp;
    state.nameSeq = 0;
    Share.lastLamp = lamp;

    var thumbUrl = Share.thumb(lamp, 150);
    lamp.thumb = thumbUrl;
    var rec = Save.save({
      name: lamp.name,
      shape: lamp.shape,
      colors: lamp.colors,
      placement: lamp.placement,
      phase: lamp.phase,
      thumb: thumbUrl
    });
    state.workId = rec ? rec.id : null;

    populateResult(lamp);

    if (!isTest && !finaleSkipped && window.YDFinale) {
      setView('view-finale');
      window.YDFinale.start(Share.lampCut(lamp, 500), function () { enterResult(lamp); });
      return true;
    }

    enterResult(lamp);
    return true;
  }

  /* 存档回看：thumb 是 data URL，先解码再画进成品台（本地解码，无网络） */
  function lampFromRecord(rec) {
    return {
      name: rec.name,
      note: D.makeNote(rec.colors[0], rec.shape, rec.phase),
      shape: rec.shape,
      shapeName: D.shapeById(rec.shape).name,
      colors: rec.colors,
      mainColorId: rec.colors[0],
      mainColorName: D.colorById(rec.colors[0]).name,
      placement: rec.placement,
      placementName: D.placementById(rec.placement).name,
      phase: rec.phase,
      phaseName: D.phaseByCode(rec.phase).name,
      splats: 0,
      lit: false,
      thumb: rec.thumb,
      knowledge: D.KNOWLEDGE[hashOf(rec.id) % D.KNOWLEDGE.length],
      img: null,
      src: null
    };
  }

  function openWork(id) {
    var rec = Save.find(id);
    if (!rec) { toast('这盏灯已不在存档里'); return false; }
    var lamp = lampFromRecord(rec);
    state.lamp = lamp;
    state.workId = rec.id;
    Share.lastLamp = lamp;
    populateResult(lamp);
    setView('view-result');
    Scene.setResultPlacement(lamp.placement);
    Scene.setResultLit(true);
    Scene.resize();
    Share.decode(rec.thumb, function (img) {
      lamp.img = img;
      if (Share.lastLamp === lamp) { Share.show(resultCanvas, lamp); }
    });
    toast(rec.name + ' · ' + lamp.note);
    return true;
  }

  /* 改名：同步回存档（save.js 的 rename 会做空名兜底） */
  function rename(name) {
    var lamp = state.lamp;
    if (!lamp) { return ''; }
    var v = String(name == null ? $('lamp-name').value : name).trim().slice(0, NAME_MAX);
    lamp.name = v || nameAt(lamp, state.nameSeq);
    $('lamp-name').value = lamp.name;
    if (state.workId) { Save.rename(state.workId, lamp.name); }
    return lamp.name;
  }

  function rerollName() {
    var lamp = state.lamp;
    if (!lamp) { return ''; }
    state.nameSeq++;
    lamp.name = nameAt(lamp, state.nameSeq);
    $('lamp-name').value = lamp.name;
    if (state.workId) { Save.rename(state.workId, lamp.name); }
    toast('另取一名 · ' + lamp.name);
    return lamp.name;
  }

  function enterHome() {
    setView('view-home');
    renderWorks();
  }

  /* ============================================================
     主循环：全场唯一的 rAF，驱动引擎的模拟与渲染
     ============================================================ */
  function frame(now) {
    var dt = Math.min((now - lastNow) / 1000, 1 / 60);
    lastNow = now;
    if (state.view === 'create' && E.ok) { E.update(dt); }
    requestAnimationFrame(frame);
  }

  /* ============================================================
     init
     ============================================================ */
  function init() {
    canvas = $('lamp');
    resultCanvas = $('lamp-result');

    $('home-series').textContent = D.SERIES;
    $('home-sub').textContent = D.SUBTITLE;

    var intro = $('home-intro');
    if (intro) { intro.innerHTML = ''; }
    D.INTRO.forEach(function (t) {
      var p = document.createElement('p');
      p.textContent = t;
      intro.appendChild(p);
    });

    buildPalette();
    buildShapes();
    buildMotifs();
    buildPlacements();
    var spinBtn = $('spin-btn');
    if (spinBtn) {
      spinBtn.addEventListener('click', function () { setSpin(!state.spin); });
    }

    /* 夜空场景：星野 + 灯会盛景 + 初始月相 P1 + 骨架同步（scene.js 的入口） */
    Scene.init();
    syncPhaseLabel();

    /* 透光引擎：init 返回 false = 此设备不支持 WebGL 浮点渲染 */
    if (!E.init(canvas)) {
      $('err').classList.add('show');
      $('btn-release').disabled = true;
      $('light-btn').disabled = true;
    }
    E.setColor(D.hexToRgb(D.COLORS[state.colorIdx].hex));
    E.setShape(D.SHAPES[state.shapeIdx].sdfIndex);
    setSpin(state.spin);
    updateLabel();

    /* 指针（全部 addEventListener，无行内事件） */
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    window.addEventListener('resize', function () {
      Scene.resize();
      if (state.view === 'create') { E.resize(); }
      else if (state.view === 'result') { Share.show(resultCanvas, Share.lastLamp); }
    });

    /* 首页 */
    $('btn-start').addEventListener('click', function () { enterCreate(true); });

    /* 创作台 */
    $('btn-back').addEventListener('click', enterHome);
    $('phase-btn').addEventListener('click', cyclePhase);
    $('btn-release').addEventListener('click', function () { release(); });
    $('light-btn').addEventListener('click', function () { setLit(!state.lit); });
    $('reset-btn').addEventListener('click', function () {
      E.reset();
      state.colorUse = {};
      state.splats = 0;
      setLit(false);
      toast('灯面已重画 · 重新绘纹');
    });

    /* 成品 */
    $('btn-reroll').addEventListener('click', rerollName);
    $('lamp-name').addEventListener('input', function () { rename(); });
    $('btn-redo').addEventListener('click', function () {
      enterCreate(true);
      toast('新灯已备 · 灯面空白');
    });
    $('btn-result-home').addEventListener('click', enterHome);
    $('btn-save-album').addEventListener('click', function () { Share.saveAlbum(); });
    $('btn-post-note').addEventListener('click', function () { Share.postNote(); });

    renderWorks();
    enterHome();

    lastNow = performance.now();
    requestAnimationFrame(frame);

    /* ---------- test hooks（系列冒烟用例的契约） ---------- */
    window.__game = {
      isTest: isTest,
      start: function () { enterCreate(true); },
      home: enterHome,
      state: function () { return state; },

      snapshot: function () {
        var sc = Scene.state();
        var en = E.state ? E.state() : null;
        return {
          engineOk: !!E.ok,
          view: state.view,
          color: D.COLORS[state.colorIdx].id,
          colorName: D.COLORS[state.colorIdx].name,
          colorCount: colorIds().length,
          shape: D.SHAPES[state.shapeIdx].id,
          shapeIndex: state.shapeIdx,
          lit: state.lit,
          activePlacement: state.placement,
          engineLit: en ? en.lit : null,
          sceneLit: sc.lit,
          phase: sc.phase,
          phaseIndex: sc.phaseIndex,
          phaseName: sc.phase ? D.phaseByCode(sc.phase).name : '',
          splats: state.splats,
          stars: sc.stars,
          lamps: sc.lamps,
          hasLamp: !!state.lamp,
          name: state.lamp ? state.lamp.name : '',
          placement: state.lamp ? state.lamp.placement : '',
          works: Save.count(),
          persistent: Save.persistent(),
          glLost: en ? en.glLost : true
        };
      },

      setColor: selectColor,
      setShape: setShape,
      setLit: setLit,
      setPlacement: setPlacement,
      setSpin: setSpin,
      cyclePhase: cyclePhase,
      splat: function (x, y) {
        if (state.view !== 'create') { enterCreate(false); }
        E.splat(x, y, 0, 0);
        notePaint();
      },
      stroke: function (x0, y0, x1, y1) {
        if (state.view !== 'create') { enterCreate(false); }
        E.stroke(x0, y0, x1, y1);
        notePaint();
      },
      paintDrag: function (pts) {
        if (state.view !== 'create') { enterCreate(false); }
        var i;
        for (i = 0; i + 1 < pts.length; i++) {
          E.stroke(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        }
        notePaint();
      },
      resetCanvas: function () { E.reset(); },
      release: release,
      skipFinale: function () { finaleSkipped = true; },
      redo: function () { enterCreate(true); },
      openWork: openWork,
      rename: rename,
      rerollName: rerollName,
      result: function () {
        var l = state.lamp;
        if (!l) { return null; }
        return {
          name: l.name, shape: l.shape, placement: l.placement, phase: l.phase,
          colors: l.colors, mainColor: l.mainColorName, note: l.note,
          knowledge: l.knowledge.tag, splats: l.splats, hasThumb: !!l.thumb,
          workId: state.workId
        };
      },
      works: function () { return Save.load(); },
      lampPixels: function () { return E.lampPixels ? E.lampPixels() : null; },
      shareCard: function () {
        var url = Share.lastLamp ? Share.paintCard(Share.lastLamp) : '';
        Share.lastCard = url;
        return url ? url.length : 0;
      },
      thumbLength: function () {
        return Share.lastLamp && Share.lastLamp.thumb ? Share.lastLamp.thumb.length : 0;
      }
    };
    window.__ready = true;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
