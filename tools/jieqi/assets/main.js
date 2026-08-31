(function () {
  var D = window.JQData, E = window.JQEngine, Scene = window.JQScene, Audio = window.JQAudio, Save = window.JQSave;
  var canvas;
  var ui = { selected: null, hoverCell: null };
  var pendingLevel = 0;
  var lastT = 0, lastShotCount = 0;
  var seenThisRun = {};
  var bannerQueue = [], bannerBusy = false;
  var newAch = [];
  var PAR_TIME = { lichun: 90, jingzhe: 150, lixia: 120, xiaoshu: 160, dashu: 170 };
  var params = new URLSearchParams(location.search);
  var isTest = params.get("test") === "1";
  var isDemo = params.get("demo") === "1";
  var demoTimer = null;

  function $(id) { return document.getElementById(id); }

  function setView(id) {
    var views = document.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle("is-active", views[i].id === id);
    }
  }

  function tryAch(id) {
    if (Save.unlockAch(id)) {
      var a = null;
      for (var i = 0; i < D.achievements.length; i++) if (D.achievements[i].id === id) a = D.achievements[i];
      if (a) newAch.push(a);
    }
  }

  function renderHome() {
    var o = Save.load();
    var cleared = Object.keys(o.levels).length;
    $("home-progress").textContent = "通关 " + cleared + "/" + D.levels.length + " 关 · 除虫 " + o.kills + " 只";
  }

  function renderLevels() {
    var box = $("levels-list");
    box.innerHTML = "";
    var o = Save.load();
    D.levels.forEach(function (lv, i) {
      var stars = o.levels[lv.id] || 0;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "level-card";
      var nm = document.createElement("b");
      nm.textContent = lv.name;
      var br = document.createElement("i");
      br.textContent = lv.brief;
      var st = document.createElement("span");
      st.className = "stars";
      st.textContent = stars > 0 ? "★".repeat(stars) + "☆".repeat(3 - stars) : "未通关";
      b.appendChild(nm);
      b.appendChild(br);
      b.appendChild(st);
      b.addEventListener("click", function () { Audio.select(); showIntro(i); });
      box.appendChild(b);
    });
  }

  function renderCodex() {
    var box = $("codex-list");
    box.innerHTML = "";
    var o = Save.load();
    Object.keys(D.enemyCodex).forEach(function (key) {
      var seen = o.seen.indexOf(key) >= 0;
      var ec = D.enemyCodex[key];
      var d = document.createElement("div");
      d.className = "codex-card" + (seen ? "" : " locked");
      var nm = document.createElement("b");
      nm.textContent = seen ? ec.name : "？？？";
      var lore = document.createElement("p");
      lore.textContent = seen ? ec.lore : "尚未在田垄上见过这种灾害。";
      var tip = document.createElement("i");
      tip.textContent = seen ? "应对：" + ec.tip : "";
      d.appendChild(nm);
      d.appendChild(lore);
      d.appendChild(tip);
      box.appendChild(d);
    });
    $("codex-count").textContent = o.seen.length + "/" + Object.keys(D.enemyCodex).length;
  }

  function renderAch() {
    var box = $("ach-list");
    box.innerHTML = "";
    var o = Save.load();
    D.achievements.forEach(function (a) {
      var got = o.achievements.indexOf(a.id) >= 0;
      var d = document.createElement("div");
      d.className = "ach-card" + (got ? " got" : "");
      var nm = document.createElement("b");
      nm.textContent = (got ? "✦ " : "○ ") + a.name;
      var ds = document.createElement("i");
      ds.textContent = a.desc;
      d.appendChild(nm);
      d.appendChild(ds);
      box.appendChild(d);
    });
    $("ach-count").textContent = o.achievements.length + "/" + D.achievements.length;
  }

  function renderCards() {
    var box = $("tower-cards");
    box.innerHTML = "";
    Object.keys(D.towers).forEach(function (key) {
      var tt = D.towers[key];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tower-card" + (ui.selected === key ? " chosen" : "");
      b.dataset.type = key;
      var nm = document.createElement("b");
      nm.textContent = tt.name;
      var ds = document.createElement("i");
      ds.textContent = tt.desc;
      var cost = document.createElement("span");
      cost.className = "cost";
      cost.textContent = tt.cost + " 谷";
      b.appendChild(nm);
      b.appendChild(ds);
      b.appendChild(cost);
      b.addEventListener("click", function () {
        var S = E.state();
        if (!S || S.phase === "win" || S.phase === "lose") return;
        if (ui.selected === key) { ui.selected = null; }
        else { ui.selected = key; Audio.select(); }
        renderCards();
        renderTowerInfo();
      });
      box.appendChild(b);
    });
    renderTowerInfo();
  }

  function renderTowerInfo() {
    var el = $("tower-info");
    if (!ui.selected) { el.textContent = "点选节气塔查看介绍，再点田垄布防"; return; }
    var tt = D.towers[ui.selected];
    var stat = "";
    if (tt.kind === "farm") stat = "每 " + tt.rate + " 秒产 25 谷";
    else if (tt.kind === "thunder") stat = "伤害 " + tt.dmg + " · 每 " + tt.rate + " 秒 · 周围 3×3";
    else stat = "伤害 " + tt.dmg + " · 射程 " + tt.range + " 行 · 每 " + tt.rate + " 秒" + (tt.kind === "slow" ? " · 减速四成" : "");
    el.textContent = "【" + tt.name + "】" + tt.desc + " · " + stat + " · " + tt.cost + " 谷";
  }

  function updateHud() {
    var S = E.state();
    if (!S) return;
    $("hud-grain").textContent = Math.floor(S.grain);
    $("hud-canglin").textContent = "仓廪 " + S.canglin + "/" + D.canglin;
    $("hud-wave").textContent = (S.phase === "win" || S.phase === "lose") ? S.level.name :
      "第 " + (S.waveIdx + 1) + "/" + S.level.waves.length + " 波";
    $("hud-level").textContent = S.level.name;
    var cards = document.querySelectorAll(".tower-card");
    for (var i = 0; i < cards.length; i++) {
      var key = cards[i].dataset.type;
      cards[i].classList.toggle("poor", S.grain < D.towers[key].cost);
    }
    if (S.grain >= 500) tryAch("rich_500");
    if (S.lastThunderKills >= 3) { tryAch("thunder_kill"); S.lastThunderKills = 0; }
  }

  function queueBanner(type) {
    var ec = D.enemyCodex[type];
    if (!ec) return;
    bannerQueue.push(ec);
    if (!bannerBusy) nextBanner();
  }

  function nextBanner() {
    if (bannerQueue.length === 0) { bannerBusy = false; return; }
    bannerBusy = true;
    var ec = bannerQueue.shift();
    var el = $("enemy-banner");
    $("enemy-banner-name").textContent = ec.name + " 出现了";
    $("enemy-banner-tip").textContent = ec.tip;
    el.classList.add("show");
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(nextBanner, 400);
    }, 2600);
  }

  function checkFirstSight(S) {
    for (var i = 0; i < S.enemies.length; i++) {
      var type = S.enemies[i].type;
      if (!seenThisRun[type]) {
        seenThisRun[type] = true;
        var isNew = Save.seeEnemy(type);
        queueBanner(type);
        if (isNew) {
          var o = Save.load();
          if (o.seen.length >= Object.keys(D.enemyCodex).length) tryAch("all_codex");
        }
      }
    }
  }

  function showIntro(idx) {
    var lv = D.levels[idx];
    pendingLevel = idx;
    $("intro-name").textContent = lv.name;
    $("intro-lore").textContent = lv.intro.lore;
    $("intro-howto").textContent = lv.intro.howto;
    var ebox = $("intro-enemies");
    ebox.innerHTML = "";
    lv.intro.enemies.forEach(function (key) {
      var ec = D.enemyCodex[key];
      var d = document.createElement("div");
      d.className = "roster-item";
      var nm = document.createElement("b");
      nm.textContent = ec.name;
      var ds = document.createElement("i");
      ds.textContent = ec.tip;
      d.appendChild(nm);
      d.appendChild(ds);
      ebox.appendChild(d);
    });
    var tbox = $("intro-towers");
    tbox.innerHTML = "";
    lv.intro.towers.forEach(function (key) {
      var tt = D.towers[key];
      var d = document.createElement("div");
      d.className = "roster-item";
      var nm = document.createElement("b");
      nm.textContent = tt.name + " · " + tt.cost + "谷";
      var ds = document.createElement("i");
      ds.textContent = tt.desc;
      d.appendChild(nm);
      d.appendChild(ds);
      tbox.appendChild(d);
    });
    setView("view-intro");
  }

  function startLevel(idx) {
    E.start(idx);
    ui.selected = null;
    ui.hoverCell = null;
    seenThisRun = {};
    newAch = [];
    renderCards();
    setView("view-battle");
    Scene.resize();
    updateHud();
    renderTowerInfo();
  }

  function battleStep(dt) {
    var S = E.state();
    if (!S) return;
    var prevPhase = S.phase;
    E.tick(dt);
    if (S.phase === "wave" || S.phase === "announce") checkFirstSight(S);
    updateHud();
    if (prevPhase !== "win" && S.phase === "win") onWin();
  }

  function frame(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    var S = E.state();
    if (S && $("view-battle").classList.contains("is-active")) {
      var prevPhase = S.phase;
      E.tick(dt);
      if (S.shots.length > lastShotCount) Audio.shoot();
      lastShotCount = S.shots.length;
      if (S.phase === "wave" || S.phase === "announce") checkFirstSight(S);
      Scene.draw(S, t, ui);
      updateHud();
      if (prevPhase !== "win" && S.phase === "win") { Audio.win(); onWin(); setTimeout(showResult, 900); }
      if (prevPhase !== "lose" && S.phase === "lose") { Audio.lose(); setTimeout(showResult, 900); }
    }
    requestAnimationFrame(frame);
  }

  function onWin() {
    var S = E.state();
    var par = PAR_TIME[S.level.id] || 120;
    var stars = 1 + (S.leaked === 0 ? 1 : 0) + (S.leaked === 0 && S.time <= par ? 1 : 0);
    Save.recordWin(S.level.id, stars, S.kills, S.leaked);
    tryAch("first_win");
    if (S.leaked === 0) tryAch("perfect");
    if (S.level.id === "jingzhe") tryAch("jingzhe_win");
    if (Save.load().kills >= 50) tryAch("killer_50");
    var o = Save.load();
    if (o.seen.length >= Object.keys(D.enemyCodex).length) tryAch("all_codex");
  }

  function showResult() {
    var S = E.state();
    var win = S.phase === "win";
    $("result-title").textContent = win ? "守住了" : "仓廪失守";
    var stars = 0;
    if (win) {
      var par = PAR_TIME[S.level.id] || 120;
      stars = 1 + (S.leaked === 0 ? 1 : 0) + (S.leaked === 0 && S.time <= par ? 1 : 0);
    }
    $("result-stars").textContent = win ? "★".repeat(stars) + "☆".repeat(3 - stars) : "";
    $("result-stats").textContent = "击杀 " + S.kills + " · 漏防 " + S.leaked + " · 用时 " + Math.round(S.time) + " 秒";
    var know = $("result-know");
    know.innerHTML = "";
    var kn = D.knowledge[S.levelIdx % D.knowledge.length];
    var p = document.createElement("p");
    p.textContent = kn;
    know.appendChild(p);
    var achBox = $("result-ach");
    achBox.innerHTML = "";
    newAch.forEach(function (a) {
      var d = document.createElement("p");
      d.className = "result-ach-item";
      d.textContent = "✦ 达成成就 · " + a.name;
      achBox.appendChild(d);
    });
    $("btn-next").style.display = (win && S.levelIdx < D.levels.length - 1) ? "" : "none";
    setView("view-result");
  }

  function onTap(e) {
    var S = E.state();
    if (!S || S.phase === "win" || S.phase === "lose") return;
    var rect = canvas.getBoundingClientRect();
    var cell = Scene.cellFromPoint(e.clientX - rect.left, e.clientY - rect.top);
    if (!cell) return;
    if (!ui.selected) return;
    var ok = E.place(ui.selected, cell.col, cell.row);
    if (ok) {
      Audio.place();
    } else {
      Audio.deny();
    }
    updateHud();
  }

  function onMove(e) {
    var rect = canvas.getBoundingClientRect();
    ui.hoverCell = Scene.cellFromPoint(e.clientX - rect.left, e.clientY - rect.top);
  }

  function runDemo() {
    var plan = [
      { t: 500,  lv: 0 },
      { t: 1500, place: ["guyu", 1, 6] },
      { t: 2200, place: ["lichun", 1, 5] },
      { t: 6000, place: ["lichun", 2, 5] },
      { t: 14000, place: ["yushui", 0, 5] },
      { t: 22000, place: ["lichun", 3, 5] },
      { t: 30000, place: ["jingzhe", 2, 4] },
      { t: 38000, place: ["lichun", 0, 4] },
      { t: 46000, place: ["yushui", 3, 4] }
    ];
    var started = false;
    var t0 = Date.now();
    demoTimer = setInterval(function () {
      var el = Date.now() - t0;
      var S = E.state();
      if (S && (S.phase === "win" || S.phase === "lose")) { clearInterval(demoTimer); return; }
      for (var i = 0; i < plan.length; i++) {
        var step = plan[i];
        if (step.done) continue;
        if (el >= step.t) {
          step.done = true;
          if (step.lv !== undefined && !started) { started = true; startLevel(step.lv); }
          if (step.place) E.place(step.place[0], step.place[1], step.place[2]);
        }
      }
    }, 200);
  }

  function init() {
    canvas = $("stage");
    Scene.init(canvas);
    window.addEventListener("resize", function () { Scene.resize(); });
    canvas.addEventListener("pointerdown", onTap);
    canvas.addEventListener("pointermove", onMove);

    $("btn-start").addEventListener("click", function () { Audio.unlock(); renderLevels(); setView("view-levels"); });
    $("btn-codex-home").addEventListener("click", function () { renderCodex(); setView("view-codex"); });
    $("btn-ach-home").addEventListener("click", function () { renderAch(); setView("view-ach"); });
    $("btn-levels-back").addEventListener("click", function () { renderHome(); setView("view-home"); });
    $("btn-codex-back").addEventListener("click", function () { renderHome(); setView("view-home"); });
    $("btn-ach-back").addEventListener("click", function () { renderHome(); setView("view-home"); });
    $("btn-intro-back").addEventListener("click", function () { renderLevels(); setView("view-levels"); });
    $("btn-deploy").addEventListener("click", function () { Audio.unlock(); startLevel(pendingLevel); });
    $("btn-again").addEventListener("click", function () { var S = E.state(); showIntro(S ? S.levelIdx : 0); });
    $("btn-next").addEventListener("click", function () { var S = E.state(); showIntro(S ? S.levelIdx + 1 : 0); });
    $("btn-home").addEventListener("click", function () { renderHome(); setView("view-home"); });

    renderHome();
    requestAnimationFrame(frame);
    if (isDemo) runDemo();

    window.__game = {
      start: startLevel,
      snapshot: function () { return E.snapshot(); },
      place: function (t, c, r) { return E.place(t, c, r); },
      state: E.state,
      tick: E.tick,
      step: battleStep,
      save: function () { return Save.load(); }
    };
    window.__ready = true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
