/* ============================================================
   后羿射日 · 主流程
   home（神话）→ levels（关卡）→ intro（战前）→ battle（射日）
   → result（战绩 + 知识卡 + 起名 + 分享）
   物理固定步长累加器驱动 HYEngine；渲染交给 HYScene。
   ============================================================ */
(function () {
  'use strict';

  var D = window.HYData;
  var E = window.HYEngine;
  var Scene = window.HYScene;
  var Share = window.HYShare;

  var params = new URLSearchParams(location.search);
  var isTest = params.get('test') === '1';
  var isDemo = params.get('demo') === '1';

  var SAVE_KEY = 'houyi-save';
  var WORKS_KEY = 'houyi-works';
  var MAX_WORKS = 9;

  var canvas = null;
  var view = 'home';
  var curLevel = 0;
  var dragActive = false;
  var lastT = 0, acc = 0;
  var toastTimer = 0;
  var demoTimer = 0;
  var bannerTimer = 0;
  var currentWork = null;
  var paused = false;                 // 测试钩子：冻结累加器，物理可被单步精确驱动

  function $(id) { return document.getElementById(id); }

  /* ---------- toast ---------- */
  function toast(msg, cls) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('show', 'bad', 'ok');
    if (cls) el.classList.add(cls);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }
  window.HYToast = toast;

  /* ---------- 视图 ---------- */
  function setView(id) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.toggle('is-active', views[i].id === id);
    view = id.replace('view-', '');
  }

  /* ---------- 存档 ---------- */
  function loadSave() {
    try {
      var o = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return {
        cleared: o.cleared instanceof Array ? o.cleared : [],
        best: (o.best && typeof o.best === 'object') ? o.best : {},
        sunsDown: typeof o.sunsDown === 'number' ? o.sunsDown : 0
      };
    } catch (e) { return { cleared: [], best: {}, sunsDown: 0 }; }
  }

  function writeSave(o) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) { /* 容量不足则忽略 */ }
  }

  function isUnlocked(idx) {
    var o = loadSave();
    if (idx === 0) return true;
    return o.cleared.indexOf(D.LEVELS[idx - 1].id) >= 0;
  }

  function recordWin(res) {
    var o = loadSave();
    if (o.cleared.indexOf(res.levelId) < 0) o.cleared.push(res.levelId);
    var prev = o.best[res.levelId];
    if (!prev || res.score > prev.score) {
      o.best[res.levelId] = { score: res.score, stars: res.stars };
    } else if (res.stars > prev.stars) {
      prev.stars = res.stars;
    }
    o.sunsDown = Math.min(D.SUNS_TO_SHOOT, o.sunsDown + (res.goal === 'spare' ? 0 : res.birdsKilled));
    writeSave(o);
  }

  function loadWorks() {
    try {
      var l = JSON.parse(localStorage.getItem(WORKS_KEY) || '[]');
      return l instanceof Array ? l : [];
    } catch (e) { return []; }
  }

  function pushWork(w) {
    var list = loadWorks();
    list.unshift(w);
    if (list.length > MAX_WORKS) list = list.slice(0, MAX_WORKS);
    try { localStorage.setItem(WORKS_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  function updateWorkName(id, name) {
    var list = loadWorks();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { list[i].name = name; break; }
    }
    try { localStorage.setItem(WORKS_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  /* ---------- 首页 ---------- */
  function showHome() {
    $('home-series').textContent = D.SERIES;
    $('home-sub').textContent = D.SUBTITLE;
    var box = $('home-intro');
    box.innerHTML = '';
    D.INTRO.forEach(function (t) {
      var p = document.createElement('p');
      p.textContent = t;
      box.appendChild(p);
    });
    var o = loadSave();
    $('home-progress').textContent = '已射落 ' + o.sunsDown + ' / ' + D.SUNS_TO_SHOOT + ' 日';
    Scene.setSkySuns(D.SUNS_TOTAL - o.sunsDown);
    setView('view-home');
  }

  /* ---------- 关卡列表 ---------- */
  function renderLevels() {
    var box = $('levels-list');
    box.innerHTML = '';
    var o = loadSave();
    D.LEVELS.forEach(function (lv, i) {
      var unlocked = isUnlocked(i);
      var cleared = o.cleared.indexOf(lv.id) >= 0;
      var best = o.best[lv.id];

      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'level-card' + (cleared ? ' cleared' : '') + (unlocked ? '' : ' locked');

      var nm = document.createElement('b');
      nm.textContent = lv.order + ' · ' + lv.name;

      var br = document.createElement('i');
      br.textContent = lv.goal === 'spare'
        ? '留住最后一日 · 射落余烬日轮'
        : '射落 ' + lv.birds.length + ' 只金乌 · 素缯 ' + lv.arrows + ' 支';

      var row = document.createElement('div');
      row.className = 'lv-row';
      var st = document.createElement('span');
      st.className = 'lv-status';
      st.textContent = !unlocked ? '未解锁' : cleared ? '已通关 ✦' : '未通关';
      var stars = document.createElement('span');
      stars.className = 'lv-stars';
      stars.textContent = best && best.stars ? '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars) : '';
      row.appendChild(st); row.appendChild(stars);

      b.appendChild(nm); b.appendChild(br); b.appendChild(row);
      if (unlocked) b.addEventListener('click', function () { showIntro(i); });
      box.appendChild(b);
    });
    var n = D.LEVELS.filter(function (lv) { return o.cleared.indexOf(lv.id) >= 0; }).length;
    $('levels-count').textContent = '已落 ' + o.sunsDown + '/' + D.SUNS_TO_SHOOT + ' 日 · 通关 ' + n + '/' + D.LEVELS.length;
    Scene.setSkySuns(D.SUNS_TOTAL - o.sunsDown);
    setView('view-levels');
  }

  /* ---------- 战前简报 ---------- */
  function showIntro(idx) {
    curLevel = idx;
    var lv = D.LEVELS[idx];
    $('intro-order').textContent = lv.order;
    $('intro-name').textContent = lv.name;
    $('intro-lore').textContent = lv.lore;
    $('intro-brief').textContent = lv.brief;

    var goal = $('intro-goal');
    goal.innerHTML = '';
    var gp = document.createElement('p');
    gp.textContent = lv.goal === 'spare'
      ? '【此关不留箭】射落 ' + lv.suns.length + ' 枚余烬日轮，且上枝的最后一只金乌绝不能伤——射落它，十日俱灭。'
      : '【过关条件】以 ' + lv.arrows + ' 支素缯射落全部 ' + lv.birds.length + ' 只金乌。';
    goal.appendChild(gp);
    goal.style.display = '';

    setView('view-intro');
  }

  /* ---------- 开战 ---------- */
  function startLevel(idx) {
    curLevel = idx;
    E.buildLevel(idx);
    dragActive = false;
    acc = 0;
    lastT = performance.now();
    var lv = D.LEVELS[idx];
    $('hud-level').textContent = lv.order + ' · ' + lv.name;
    $('hud-goal').textContent = lv.goal === 'spare' ? '留住最后一只金乌' : '射落全部金乌';
    $('banner').classList.remove('show');
    setView('view-battle');
    Scene.resize();
    updateHud();
  }

  /* 容器规范禁 emoji 图标 -> 素缯余量用 CSS 形状画，不可改成字形 */
  function renderArrowRow(S) {
    var row = $('hud-arrows');
    var n = S.arrowsTotal;
    if (row.childElementCount !== n) {
      row.innerHTML = '';
      for (var i = 0; i < n; i++) {
        var s = document.createElement('span');
        s.className = 'arrow-pip';
        row.appendChild(s);
      }
    }
    for (var k = 0; k < n; k++) {
      row.children[k].classList.toggle('used', k >= S.arrowsLeft);
    }
    row.classList.toggle('low', S.arrowsLeft <= 1);
  }

  function updateHud() {
    var S = E.state();
    if (!S) return;
    renderArrowRow(S);
    $('hud-target').textContent = S.goal === 'spare'
      ? '余烬日轮 ' + S.suns.length + ' · 留日金乌 ' + S.birds.length
      : '金乌 ' + S.birds.length + (S.suns.length ? ' · 日轮 ' + S.suns.length : '');
  }

  /* ---------- 横幅 + 结算 ---------- */
  function showBanner(title, sub) {
    $('banner-title').textContent = title;
    $('banner-sub').textContent = sub;
    $('banner').classList.add('show');
  }

  function onEnd(res) {
    if (res.win) {
      if (res.goal === 'spare') showBanner('留一日照人间', '余烬已熄 · 最后一日仍在 · 天下复有昼夜');
      else showBanner('金乌尽殒', '此关落乌 ' + res.birdsKilled + ' 只 · 扶桑倾颓');
    } else if (res.reason === 'spare-killed') {
      showBanner('十日俱灭', '最后一日也被射落 · 天下永夜');
    } else {
      showBanner('素缯已尽', '金乌尚在 · 再试一次');
    }
    if (res.win) {
      recordWin(res);
      Scene.setSkySuns(D.SUNS_TOTAL - loadSave().sunsDown);
    }
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(showResult, 1500);
  }

  function showResult() {
    var S = E.state();
    var res = S.result;
    if (!res) return;
    var win = res.win;

    $('result-kicker').textContent = res.order + ' · ' + res.levelName;
    var t = $('result-title');
    t.className = 'result-title' + (win ? '' : ' fail');
    t.textContent = win
      ? (res.goal === 'spare' ? '留一日' : '金乌尽殒')
      : (res.reason === 'spare-killed' ? '十日俱灭' : '素缯已尽');

    $('result-stars').textContent = win ? '★'.repeat(res.stars) + '☆'.repeat(3 - res.stars) : '';

    var stats = '用箭 ' + res.arrowsUsed + '/' + res.arrowsTotal;
    if (res.goal === 'spare') stats += ' · 熄余烬 ' + res.sunsKilled + ' · 留日 1';
    else stats += ' · 落乌 ' + res.birdsKilled;
    stats += ' · 倾枝 ' + res.blocksKilled + ' · 得分 ' + res.score;
    $('result-stats').textContent = stats;

    var save = loadSave();
    $('result-narrative').textContent = res.goal === 'spare'
      ? '九日既落，一日独存。天上余日 ' + (D.SUNS_TOTAL - save.sunsDown) + ' 枚——羿留此一日，天下复有昼夜。'
      : '已射落 ' + save.sunsDown + ' / ' + D.SUNS_TO_SHOOT + ' 日。';

    $('know-tag').textContent = res.knowledge.tag;
    $('know-text').textContent = res.knowledge.text;

    $('btn-next').style.display = (win && curLevel < D.LEVELS.length - 1) ? '' : 'none';

    var work = {
      id: String(Date.now()),
      levelId: res.levelId,
      levelName: res.levelName,
      title: win ? (res.goal === 'spare' ? '留一日' : '金乌尽殒') : (res.reason === 'spare-killed' ? '十日俱灭' : '素缯已尽'),
      win: win, stars: res.stars, score: res.score,
      statsLine: stats,
      knowledge: res.knowledge,
      name: D.NAME_POOL[Math.floor(Math.random() * D.NAME_POOL.length)]
    };
    $('work-name').value = work.name;
    if (win) pushWork(work);
    $('works-count').textContent = win
      ? '已存战绩 ' + Math.min(loadWorks().length, MAX_WORKS) + '/' + MAX_WORKS
      : '未过关 · 此战绩不入库';
    currentWork = work;

    Share.lastStats = {
      levelName: res.levelName,
      title: work.title,
      win: win,
      stars: res.stars,
      statsLine: stats,
      name: work.name,
      knowledge: res.knowledge
    };

    setView('view-result');
  }

  function rename(v) {
    var w = currentWork;
    if (!w) return '';
    var name = (v === undefined ? $('work-name').value : v);
    name = String(name || '').trim().slice(0, 8);
    if (!name) name = D.NAME_POOL[0];
    w.name = name;
    $('work-name').value = name;
    if (Share.lastStats) Share.lastStats.name = name;
    if (w.win) updateWorkName(w.id, name);
    return name;
  }

  function rerollName() {
    var w = currentWork;
    if (!w) return;
    var pool = D.NAME_POOL.filter(function (n) { return n !== w.name; });
    rename(pool[Math.floor(Math.random() * pool.length)]);
  }

  /* ---------- 主循环：固定步长累加器（轨迹预览确定性） ---------- */
  function frame(now) {
    var dt = now - lastT;
    lastT = now;
    if (view === 'battle') {
      var S = E.state();
      if (S) {
        var prevPhase = S.phase;
        if (!paused) {
          acc += Math.min(dt, 120);
          var guard = 0;
          while (acc >= D.STEP && guard < 6) { E.stepOnce(); acc -= D.STEP; guard++; }
          if (acc > D.STEP * 6) acc = 0;
        }
        Scene.render(S);
        updateHud();
        if ((prevPhase === 'flying' || prevPhase === 'ready') && (S.phase === 'won' || S.phase === 'lost')) {
          onEnd(S.result);
        }
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 指针输入 ---------- */
  function toWorld(cx, cy) {
    var r = canvas.getBoundingClientRect();
    var v = Scene.view();
    return { x: (cx - r.left - v.offX) / v.scale, y: (cy - r.top - v.offY) / v.scale };
  }

  function onDown(e) {
    if (view !== 'battle') return;
    var S = E.state();
    if (!S || S.phase !== 'ready' || S.arrowInFlight || !S.arrow) return;
    dragActive = true;
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    var p = toWorld(e.clientX, e.clientY);
    E.drag(p.x, p.y);
  }

  function onMove(e) {
    if (!dragActive) return;
    var p = toWorld(e.clientX, e.clientY);
    E.drag(p.x, p.y);
  }

  function onUp() {
    if (!dragActive) return;
    dragActive = false;
    if (!E.release()) E.cancelDrag();
  }

  /* ---------- demo 自驾（录制用：自动瞄准 → 展示轨迹 → 放箭） ---------- */
  function demoTarget() {
    var S = E.state();
    if (!S) return null;
    if (S.goal === 'spare') {
      return S.suns.length ? { x: S.suns[0].position.x, y: S.suns[0].position.y } : null;
    }
    if (!S.birds.length) return null;
    var bp = S.birds[0].parts[1].position;     // 鸟身凸块中心
    return { x: bp.x, y: bp.y };
  }

  function demoShoot() {
    var S = E.state();
    if (!S || S.phase === 'won' || S.phase === 'lost') return;
    if (S.phase !== 'ready' || S.arrowInFlight) { demoTimer = setTimeout(demoShoot, 240); return; }
    var t = demoTarget();
    if (!t) return;
    var sol = E.solveAim(t.x, t.y, false);
    var vx, vy;
    if (sol) { vx = sol.vx; vy = sol.vy; }
    else { vx = 12; vy = -11; }                 // 兜底：斜上抛
    var nock = E.nockForVector(vx, vy);
    E.drag(nock.x, nock.y);                    // 轨迹金线先亮一会儿
    demoTimer = setTimeout(function () {
      E.release();
      demoTimer = setTimeout(demoShoot, 1500);
    }, 780);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    canvas = $('stage');
    Scene.init(canvas);
    window.addEventListener('resize', function () { if (view === 'battle') Scene.resize(); });

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    /* 全部 addEventListener，无行内事件 */
    $('btn-start').addEventListener('click', function () { renderLevels(); });
    $('btn-levels-home').addEventListener('click', function () { showHome(); });
    $('btn-intro-back').addEventListener('click', function () { renderLevels(); });
    $('btn-deploy').addEventListener('click', function () { startLevel(curLevel); });
    $('btn-home').addEventListener('click', function () { $('banner').classList.remove('show'); renderLevels(); });
    $('btn-reset').addEventListener('click', function () {
      $('banner').classList.remove('show');
      clearTimeout(bannerTimer);
      startLevel(curLevel);
      toast('扶桑重立 · 素缯 ' + D.LEVELS[curLevel].arrows + ' 支');
    });
    $('btn-again').addEventListener('click', function () { startLevel(curLevel); });
    $('btn-next').addEventListener('click', function () { showIntro(curLevel + 1); });
    $('btn-result-levels').addEventListener('click', function () { renderLevels(); });
    $('btn-result-home').addEventListener('click', function () { showHome(); });
    $('btn-reroll').addEventListener('click', rerollName);
    $('work-name').addEventListener('input', function () { rename(); });
    $('btn-save-album').addEventListener('click', function () { rename(); Share.saveAlbum(); });
    $('btn-post-note').addEventListener('click', function () { rename(); Share.postNote(); });

    lastT = performance.now();
    requestAnimationFrame(frame);

    if (isTest) {
      showHome();
    } else if (isDemo) {
      startLevel(0);
      demoTimer = setTimeout(demoShoot, 1000);
    } else {
      showHome();
    }

    /* ---------- 测试钩子 ---------- */
    window.__game = {
      /* 流程 */
      start: startLevel,
      home: showHome,
      levels: renderLevels,
      intro: showIntro,
      view: function () { return view; },
      curLevel: function () { return curLevel; },

      /* 物理 / 状态 */
      state: E.state,
      snapshot: function () {
        var s = E.snapshot() || {};
        s.view = view;
        s.artMode = Scene.artMode();
        s.skySuns = Scene.skySuns();
        s.matterVersion = E.matterVersion;
        s.warnings = E.warnings();
        return s;
      },
      step: E.step,
      pause: function (v) { paused = !!v; acc = 0; return paused; },
      config: E.config,
      bodies: E.bodies,
      shapeAudit: E.shapeAudit,
      arrowInfo: E.arrowInfo,
      hitLog: E.hitLog,
      clearLog: E.clearLog,
      arrowTrack: E.arrowTrack,
      ghostStats: E.ghostStats,
      silhouetteGrid: E.silhouetteGrid,
      silhouetteTest: E.silhouetteTest,
      findGhostPoint: E.findGhostPoint,
      solveAim: E.solveAim,
      setDebug: E.setDebug,
      range: E.buildRange,
      rangeShot: E.rangeShot,
      reportRange: E.reportRange,

      /* 交互 */
      drag: E.drag,
      release: E.release,
      cancelDrag: E.cancelDrag,
      launch: E.launch,
      preview: E.preview,
      anchor: function () { return { x: D.ANCHOR.x, y: D.ANCHOR.y }; },
      view2d: Scene.view,
      samplePixels: Scene.samplePixels,
      samplePixel: Scene.samplePixel,

      /* 存档 / 分享 */
      save: loadSave,
      works: loadWorks,
      setName: function (n) { return rename(n); },
      result: function () { return currentWork; },
      shareCard: function () {
        var url = Share.lastStats ? Share.paintCard(Share.lastStats) : '';
        return url ? url.length : 0;
      }
    };
    window.__ready = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
