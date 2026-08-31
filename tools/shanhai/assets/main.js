(function () {
  var D = window.SHData, E = window.SHEngine, Scene = window.SHScene, Audio = window.SHAudio;
  var canvas;
  var lastT = 0, shootSndT = 0;
  var params = new URLSearchParams(location.search);
  var isTest = params.get("test") === "1";
  var isDemo = params.get("demo") === "1";
  var demoTimer = null;
  var dragging = false;

  function $(id) { return document.getElementById(id); }

  function setView(id) {
    var views = document.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle("is-active", views[i].id === id);
    }
  }

  function renderLevels() {
    var box = $("levels-list");
    box.innerHTML = "";
    var save = loadSave();
    D.levels.forEach(function (lv, i) {
      var cleared = save.cleared.indexOf(lv.id) >= 0;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "level-card" + (cleared ? " cleared" : "");
      var nm = document.createElement("b");
      nm.textContent = lv.name;
      var br = document.createElement("i");
      br.textContent = lv.brief;
      var st = document.createElement("span");
      st.className = "lv-status";
      st.textContent = cleared ? "已通关 ✦" : "未通关";
      b.appendChild(nm); b.appendChild(br); b.appendChild(st);
      b.addEventListener("click", function () { Audio.unlock(); showIntro(i); });
      box.appendChild(b);
    });
  }

  function showIntro(idx) {
    var lv = D.levels[idx];
    window.__pendingLevel = idx;
    $("intro-name").textContent = lv.name;
    $("intro-lore").textContent = lv.lore;
    $("intro-brief").textContent = lv.brief;
    setView("view-intro");
  }

  function startLevel(idx) {
    E.start(idx);
    Scene.seedClouds(idx + 1);
    setView("view-battle");
    Scene.resize();
    updateHud();
  }

  function loadSave() {
    try {
      var o = JSON.parse(localStorage.getItem("shanhai-save") || "{}");
      return { cleared: o.cleared instanceof Array ? o.cleared : [], best: o.best || {} };
    } catch (e) { return { cleared: [], best: {} }; }
  }
  function saveWin(levelId, score) {
    var o = loadSave();
    if (o.cleared.indexOf(levelId) < 0) o.cleared.push(levelId);
    if (!o.best[levelId] || score > o.best[levelId]) o.best[levelId] = score;
    try { localStorage.setItem("shanhai-save", JSON.stringify(o)); } catch (e) {}
  }

  function updateHud() {
    var S = E.state();
    if (!S) return;
    $("hud-weapon").textContent = "飞剑 Lv" + S.weaponLv;
    $("hud-bombs").textContent = "雷符 ×" + S.bombs;
    $("hud-shield").textContent = S.shield > 0 ? "镜 ×" + S.shield : "";
    $("hud-score").textContent = "分 " + S.score;
    $("hud-wave").textContent = "第 " + Math.min(S.waveIdx + 1, S.level.waves) + "/" + S.level.waves + " 波";
    drawHearts(S.hp);
  }

  function drawHearts(hp) {
    var hc = $("hud-hearts");
    if (!hc) return;
    var hctx = hc.getContext("2d");
    var dpr2 = window.devicePixelRatio || 1;
    var max = D.player.hp;
    var hw = 22, gap = 4;
    var w = max * hw + (max - 1) * gap, h = 20;
    if (hc.width !== w * dpr2) { hc.width = w * dpr2; hc.height = h * dpr2; hc.style.width = w + "px"; hc.style.height = h + "px"; }
    hctx.setTransform(dpr2, 0, 0, dpr2, 0, 0);
    hctx.clearRect(0, 0, w, h);
    for (var i = 0; i < max; i++) {
      var cx = i * (hw + gap) + hw / 2, cy = h / 2;
      var filled = i < hp;
      drawHeart(hctx, cx, cy, hw * 0.42, filled ? "#e04a4a" : "rgba(232,228,216,0.25)");
    }
  }

  function drawHeart(c, x, y, r, color) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y + r * 0.7);
    c.bezierCurveTo(x - r * 1.4, y - r * 0.3, x - r * 0.6, y - r * 1.1, x, y - r * 0.2);
    c.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.3, x, y + r * 0.7);
    c.fill();
  }

  function frame(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    var S = E.state();
    if (S && $("view-battle").classList.contains("is-active")) {
      var prevPhase = S.phase;
      var prevBullets = S.bullets.length;
      E.step(dt);
      if (S.bullets.length > prevBullets && t - shootSndT > 90) { Audio.shoot(); shootSndT = t; }
      Scene.draw(S, t);
      updateHud();
      if (prevPhase !== "win" && S.phase === "win") { Audio.win(); saveWin(S.level.id, S.score); setTimeout(showResult, 800); }
      if (prevPhase !== "lose" && S.phase === "lose") { Audio.lose(); setTimeout(showResult, 800); }
    }
    requestAnimationFrame(frame);
  }

  function showResult() {
    var S = E.state();
    var win = S.phase === "win";
    $("result-title").textContent = win ? "扫清妖氛" : "应龙坠落";
    $("result-stats").textContent = "得分 " + S.score + " · 斩妖 " + S.kills + " · 用时 " + Math.round(S.time) + " 秒";
    var know = $("result-know");
    know.innerHTML = "";
    var kn = D.knowledge[S.levelIdx % D.knowledge.length];
    var p = document.createElement("p");
    p.textContent = kn;
    know.appendChild(p);
    $("btn-next").style.display = (win && S.levelIdx < D.levels.length - 1) ? "" : "none";
    setView("view-result");
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function runDemo() {
    var t0 = Date.now();
    demoTimer = setInterval(function () {
      var el = (Date.now() - t0) / 1000;
      var S = E.state();
      if (!S || S.phase !== "play") { clearInterval(demoTimer); return; }
      var x = D.W / 2 + Math.sin(el * 1.4) * 120;
      E.movePlayer(x, D.H - 90);
      if (S.bombs > 0 && S.enemies.length > 6) E.useBomb();
    }, 100);
  }

  function init() {
    canvas = $("stage");
    Scene.init(canvas);
    window.addEventListener("resize", function () { Scene.resize(); });

    canvas.addEventListener("pointerdown", function (e) {
      dragging = true;
      var p = pointerPos(e);
      E.movePlayer(p.x, p.y);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var p = pointerPos(e);
      E.movePlayer(p.x, p.y);
    });
    window.addEventListener("pointerup", function () { dragging = false; });

    $("btn-bomb").addEventListener("click", function () {
      if (E.useBomb()) Audio.thunder();
    });

    $("btn-start").addEventListener("click", function () { Audio.unlock(); renderLevels(); setView("view-levels"); });
    $("btn-levels-back").addEventListener("click", function () { setView("view-home"); });
    $("btn-intro-back").addEventListener("click", function () { renderLevels(); setView("view-levels"); });
    $("btn-deploy").addEventListener("click", function () { Audio.unlock(); startLevel(window.__pendingLevel || 0); });
    $("btn-again").addEventListener("click", function () { var S = E.state(); showIntro(S ? S.levelIdx : 0); });
    $("btn-next").addEventListener("click", function () { var S = E.state(); showIntro(S ? S.levelIdx + 1 : 0); });
    $("btn-home").addEventListener("click", function () { setView("view-home"); });

    renderLevels();
    requestAnimationFrame(frame);
    if (isDemo) { startLevel(0); runDemo(); }

    window.__game = {
      start: startLevel,
      step: E.step,
      movePlayer: E.movePlayer,
      useBomb: E.useBomb,
      snapshot: E.snapshot,
      state: E.state
    };
    window.__ready = true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
