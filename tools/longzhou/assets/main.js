(function () {
  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  window.LZScene.init(canvas);

  var viewEls = {
    home: document.getElementById("view-home"),
    game: document.getElementById("view-game"),
    codex: document.getElementById("view-codex"),
    result: document.getElementById("view-result")
  };
  var curView = "home";
  function showView(name) {
    for (var k in viewEls) if (viewEls[k]) viewEls[k].classList.toggle("is-active", k === name);
    curView = name;
  }

  var elHomeBest = document.getElementById("home-best");
  function renderHome() {
    var sv = window.LZSave ? window.LZSave.load() : { best: 0, bestDist: 0 };
    elHomeBest.textContent = sv.best > 0 ? "最佳 " + sv.best + " 分 · " + sv.bestDist + "m" : "";
  }

  var pauseMask = document.getElementById("pause-mask");
  var tutorEl = document.getElementById("tutor");
  var tutorTimer = null;

  var demoMode = /[?&]demo=1/.test(location.search);
  var demoDrumAcc = 0;
  var demoRestartTimer = null;

  function demoAutopilot(dt) {
    var S = window.LZGame.snapshot();
    if (S.state !== "playing") return;
    var blocked = {}, pickupLanes = {};
    var i, e, ln;
    for (i = 0; i < S.entities.length; i++) {
      e = S.entities[i];
      if (e.done || e.z >= 45) continue;
      ln = Math.round(e.laneF != null ? e.laneF : e.lane);
      if (e.kind === "obs") blocked[ln] = true;
      else if (e.kind === "pick") pickupLanes[ln] = true;
    }
    var cur = S.lane, target = null, a, b;
    for (ln = -1; ln <= 1; ln++) {
      if (blocked[ln]) continue;
      if (target === null) { target = ln; continue; }
      a = pickupLanes[ln] ? 1 : 0;
      b = pickupLanes[target] ? 1 : 0;
      if (a > b) target = ln;
      else if (a === b && Math.abs(ln - cur) < Math.abs(target - cur)) target = ln;
    }
    if (target === null) target = cur;
    if (target !== cur) window.LZGame.swipe(target > cur ? 1 : -1);
    if (S.gauge < 100) {
      demoDrumAcc += dt;
      if (demoDrumAcc >= 0.14) {
        demoDrumAcc = 0;
        window.LZGame.drum();
      }
    } else {
      demoDrumAcc = 0;
    }
  }

  function demoRestart() {
    if (demoRestartTimer) clearTimeout(demoRestartTimer);
    demoRestartTimer = setTimeout(function () {
      demoRestartTimer = null;
      if (demoMode) startRun();
    }, 1200);
  }

  function clearTutor() {
    if (tutorTimer) { clearTimeout(tutorTimer); tutorTimer = null; }
    tutorEl.textContent = "";
  }

  function startRun() {
    var runs = 0;
    if (window.LZSave) {
      var sv = window.LZSave.load();
      sv.runs += 1;
      runs = sv.runs;
      window.LZSave.save(sv);
    }
    clearTutor();
    pauseMask.classList.remove("is-on");
    showView("game");
    window.LZGame.start();
    if (runs === 1 && !demoMode) {
      tutorEl.textContent = "左右键或滑动 换线";
      tutorTimer = setTimeout(function () {
        tutorTimer = null;
        tutorEl.textContent = "按住左下鼓面 攒满冲刺";
      }, 3000);
    }
  }

  var shakeT = 0;
  var drumHitUntil = 0;
  var trail = [];
  var ghostAlpha = [0.25, 0.15, 0.08];
  window.LZGame.setCallback("drum", function () {
    drumHitUntil = performance.now() + 150;
    if (window.LZSound && window.LZSound.drum) window.LZSound.drum();
  });
  window.LZGame.setCallback("dash", function () {
    clearTutor();
    if (window.LZSound && window.LZSound.dash) window.LZSound.dash();
  });
  window.LZGame.setCallback("hit", function (a) {
    var S = window.LZGame.snapshot();
    var bp = window.LZScene.project(S.boatX, 0);
    if (a && a.smash) {
      window.LZScene.addSplash(bp.x, bp.y, 10);
      if (window.LZSound && window.LZSound.smash) window.LZSound.smash();
    } else {
      window.LZScene.addSplash(bp.x, bp.y, 18);
      shakeT = 0.2;
      if (window.LZSound && window.LZSound.hit) window.LZSound.hit();
    }
  });
  window.LZGame.setCallback("capsize", function () {
    var S = window.LZGame.snapshot();
    var cp = window.LZScene.project(S.boatX, 0);
      window.LZScene.addSplash(cp.x, cp.y, 26);
      if (window.LZSound && window.LZSound.capsize) window.LZSound.capsize();
      if (demoMode) demoRestart();
    });
  window.LZGame.setCallback("pause", function () {
    pauseMask.classList.add("is-on");
  });
  window.LZGame.setCallback("resume", function () {
    pauseMask.classList.remove("is-on");
  });

  var elDist = document.getElementById("hud-dist");
  var elScore = document.getElementById("hud-score");
  var elCombo = document.getElementById("hud-combo");
  var elGaugeWrap = document.getElementById("gauge-wrap");
  var elGauge = document.getElementById("gauge-fill");
  var elSteady = document.getElementById("hud-steady");
  var dots = [];
  (function () {
    var i, d;
    for (i = 0; i < 3; i++) {
      d = document.createElement("span");
      d.className = "steady-dot";
      elSteady.appendChild(d);
      dots.push(d);
    }
  })();
  var lastDistTxt = "", lastScoreTxt = "", lastComboTxt = "", lastSteady = -1;

  function syncHud(S) {
    var txt = Math.floor(S.dist) + "m";
    if (txt !== lastDistTxt) { lastDistTxt = txt; elDist.textContent = txt; }
    txt = String(Math.floor(S.scoreFrac));
    if (txt !== lastScoreTxt) { lastScoreTxt = txt; elScore.textContent = txt; }
    txt = S.combo >= 3 ? "连击 ×" + S.combo + "（" + Math.min(5, 1 + Math.floor(S.combo / 5)) + "倍）" : "";
    if (txt !== lastComboTxt) { lastComboTxt = txt; elCombo.textContent = txt; }
    if (S.steady !== lastSteady) {
      lastSteady = S.steady;
      for (var i = 0; i < 3; i++) dots[i].classList.toggle("is-off", i >= S.steady);
    }
    elGaugeWrap.classList.toggle("is-rest", S.restT > 0);
    elGauge.style.height = S.gauge + "%";
  }

  var start = -1, last = 0;
  function frame(t) {
    if (start < 0) { start = t; last = t; }
    var dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    window.LZGame.update(dt);
    if (demoMode) demoAutopilot(dt);
    var S = window.LZGame.snapshot();
    syncHud(S);
    if (shakeT > 0) shakeT -= dt;

    ctx.save();
    if (shakeT > 0) {
      var mag = (shakeT / 0.2) * 7;
      var ph = (0.2 - shakeT) * 70;
      ctx.translate(Math.sin(ph * 1.3) * mag, Math.cos(ph * 1.7) * mag * 0.6);
    }

    window.LZScene.draw({ dist: S.dist }, dt);

    var ents = S.entities.slice().sort(function (a, b) { return b.z - a.z; });
    var i, e, p;
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      if (e.done) continue;
      p = window.LZScene.project(e.laneF != null ? e.laneF : e.lane, e.z);
      if (e.kind === "obs") window.LZSprites.obstacle(ctx, e.type, p.x, p.y, p.s, S.t);
      else if (e.kind === "pick") window.LZSprites.pickup(ctx, e.type, p.x, p.y, p.s, S.t);
    }

    var bp = window.LZScene.project(S.boatX, 0);
    var tilt = 0, sink = 0;
    if (S.state === "capsized") {
      var prog = Math.min(1, Math.max(0, 1 - S.capT / 1.4));
      tilt = prog * 1.1;
      sink = prog * 30;
    }
    var m = window.LZScene.metrics();
    var sternY = bp.y + 66 * bp.s * m.u;
    if (S.state === "playing") {
      if (S.dashT > 0) {
        window.LZScene.addSplash(bp.x - 20 * bp.s * m.u, sternY, 2);
        window.LZScene.addSplash(bp.x + 20 * bp.s * m.u, sternY, 2);
      }
      window.LZScene.addSplash(bp.x, sternY, S.dashT > 0 ? 2 : 1);
    }
    if (S.dashT > 0) {
      trail.push({ x: bp.x, y: bp.y + sink });
      if (trail.length > 12) trail.shift();
    } else if (trail.length) {
      trail.length = 0;
    }
    var k, gi, gp;
    for (k = 0; k < 3; k++) {
      gi = trail.length - 1 - (k + 1) * 3;
      if (gi < 0) continue;
      gp = trail[gi];
      ctx.globalAlpha = ghostAlpha[k];
      window.LZSprites.boat(ctx, gp.x, gp.y, bp.s, { paddlePhase: S.dist * 0.5, dashing: true });
    }
    ctx.globalAlpha = 1;
    window.LZSprites.boat(ctx, bp.x, bp.y + sink, bp.s, {
      paddlePhase: S.dist * 0.5,
      dashing: S.dashT > 0,
      blink: S.invT > 0,
      tilt: tilt,
      drumHit: t < drumHitUntil
    });

    ctx.restore();
    if (S.dashT > 0) {
      var vg = ctx.createRadialGradient(m.cx, m.H * 0.5, Math.min(m.W, m.H) * 0.35, m.cx, m.H * 0.5, Math.max(m.W, m.H) * 0.72);
      vg.addColorStop(0, "rgba(255,182,30,0)");
      vg.addColorStop(1, "rgba(255,182,30,0.18)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, m.W, m.H);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  var btnDrum = document.getElementById("btn-drum");
  var drumHoldTimer = null;
  function drumBeat() {
    if (window.LZGame.snapshot().state !== "playing") { stopDrumHold(); return; }
    window.LZGame.drum();
    btnDrum.classList.add("is-hit");
    setTimeout(function () { btnDrum.classList.remove("is-hit"); }, 100);
  }
  function stopDrumHold() {
    if (drumHoldTimer) { clearInterval(drumHoldTimer); drumHoldTimer = null; }
  }
  btnDrum.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    stopDrumHold();
    drumBeat();
    drumHoldTimer = setInterval(drumBeat, 140);
  });
  btnDrum.addEventListener("pointerup", stopDrumHold);
  btnDrum.addEventListener("pointercancel", stopDrumHold);
  btnDrum.addEventListener("pointerleave", stopDrumHold);

  function bindLane(btn, dir) {
    if (!btn) return;
    btn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      window.LZGame.swipe(dir);
      btn.classList.add("is-hit");
      setTimeout(function () { btn.classList.remove("is-hit"); }, 100);
    });
  }
  bindLane(document.getElementById("btn-left"), -1);
  bindLane(document.getElementById("btn-right"), 1);

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") window.LZGame.swipe(-1);
    else if (e.key === "ArrowRight") window.LZGame.swipe(1);
    else if (e.key === " " || e.code === "Space") { e.preventDefault(); drumBeat(); }
  });

  var down = false, px0 = 0, py0 = 0;
  canvas.addEventListener("pointerdown", function (e) {
    down = true; px0 = e.clientX; py0 = e.clientY;
  });
  canvas.addEventListener("pointerup", function (e) {
    if (!down) return;
    down = false;
    var dx = e.clientX - px0, dy = e.clientY - py0;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      window.LZGame.swipe(dx > 0 ? 1 : -1);
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && window.LZGame.snapshot().state === "playing") {
      window.LZGame.pause();
    }
  });

  var seen = {};
  (function () {
    var sv = window.LZSave ? window.LZSave.load() : null;
    var c = sv && sv.codex ? sv.codex : [];
    for (var i = 0; i < c.length; i++) seen[c[i]] = true;
  })();

  var toastEl = document.getElementById("toast");
  var toastQ = [], toastBusy = false;
  function drainToast() {
    if (toastBusy || !toastQ.length) return;
    toastBusy = true;
    var msg = toastQ.shift();
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    setTimeout(function () {
      toastEl.classList.remove("is-on");
      setTimeout(function () { toastBusy = false; drainToast(); }, 260);
    }, 1800);
  }
  function showToast(msg) { toastQ.push(msg); drainToast(); }

  function codexById(id) {
    var list = window.LZData.CODEX;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  window.LZGame.setCallback("collect", function (info) {
    if (window.LZSound && window.LZSound.collect) window.LZSound.collect(window.LZGame.snapshot().combo);
    if (!info || seen[info.type]) return;
    var c = codexById(info.type);
    if (!c) return;
    seen[info.type] = true;
    showToast("图鉴解锁 · " + c.name);
  });

  var codexGrid = document.getElementById("codex-grid");
  var codexCount = document.getElementById("codex-count");
  var codexCard = document.getElementById("codex-card");
  var cardName = document.getElementById("codex-card-name");
  var cardText = document.getElementById("codex-card-text");
  var cardCanvas = document.getElementById("codex-canvas");
  var codexOrigin = "home";

  function hideCodexCard() { codexCard.classList.remove("is-on"); }

  function openCodexCard(item) {
    var cctx = cardCanvas.getContext("2d");
    cctx.clearRect(0, 0, 120, 120);
    window.LZSprites.pickup(cctx, item.id, 60, 66, 0.9, 0);
    cardName.textContent = item.name;
    cardText.textContent = item.text;
    codexCard.classList.add("is-on");
  }

  function buildCodex() {
    codexGrid.innerHTML = "";
    var sv = window.LZSave ? window.LZSave.load() : { codex: [] };
    var un = {};
    var i, id;
    for (i = 0; i < sv.codex.length; i++) un[sv.codex[i]] = true;
    var n = 0;
    var list = window.LZData.CODEX;
    for (i = 0; i < list.length; i++) {
      var item = list[i];
      var isOpen = !!un[item.id];
      if (isOpen) n++;
      var cell = document.createElement("div");
      cell.className = "codex-cell" + (isOpen ? "" : " is-locked");
      var cv = document.createElement("canvas");
      cv.width = 120; cv.height = 120;
      cell.appendChild(cv);
      var nm = document.createElement("div");
      nm.className = "codex-cell-name";
      nm.textContent = isOpen ? item.name : "?";
      cell.appendChild(nm);
      if (isOpen) {
        window.LZSprites.pickup(cv.getContext("2d"), item.id, 60, 66, 0.9, 0);
        (function (it) {
          cell.addEventListener("click", function () { openCodexCard(it); });
        })(item);
      }
      codexGrid.appendChild(cell);
    }
    codexCount.textContent = n + "/" + list.length;
  }

  function showCodex(origin) {
    codexOrigin = origin || curView;
    hideCodexCard();
    buildCodex();
    showView("codex");
  }

  function hideCodex() {
    hideCodexCard();
    showView(viewEls[codexOrigin] ? codexOrigin : "home");
  }

  var elResultTitle = document.getElementById("result-title");
  var elResultDist = document.getElementById("result-dist");
  var elResultScore = document.getElementById("result-score");
  var elResultZongzi = document.getElementById("result-zongzi");
  var elResultCombo = document.getElementById("result-combo");
  var elResultBest = document.getElementById("result-best");
  var elResultKnow = document.getElementById("result-know");
  var elResultCodex = document.getElementById("result-codex");

  function fillResult() {
    var S = window.LZGame.snapshot();
    var score = Math.floor(S.scoreFrac);
    var dist = Math.floor(S.dist);
    var titles = window.LZData.TITLES;
    var title = titles[titles.length - 1].name;
    var i;
    for (i = 0; i < titles.length; i++) {
      if (score >= titles[i].min) { title = titles[i].name; break; }
    }
    elResultTitle.textContent = title;
    elResultDist.textContent = dist + "m";
    elResultScore.textContent = String(score);
    elResultZongzi.textContent = String(S.zongzi);
    elResultCombo.textContent = String(S.maxCombo);

    var sv = window.LZSave ? window.LZSave.load() : { best: 0, bestDist: 0, codex: [], runs: 0 };
    if (score > sv.best) {
      sv.best = score;
      sv.bestDist = dist;
      if (window.LZSave) window.LZSave.save(sv);
      elResultBest.textContent = "新纪录！";
    } else {
      elResultBest.textContent = "最佳 " + sv.best + " 分 · " + sv.bestDist + "m";
    }

    var have = {};
    for (i = 0; i < sv.codex.length; i++) have[sv.codex[i]] = true;
    var unlocked = [];
    var list = window.LZData.CODEX;
    for (i = 0; i < list.length; i++) if (have[list[i].id]) unlocked.push(list[i]);

    var knowName = "";
    var knowText = "";
    if (unlocked.length > 0) {
      var rng = window.LZRng(Date.now() >>> 0);
      var c = rng.pick(unlocked);
      knowName = c.name;
      knowText = c.text;
      elResultKnow.textContent = "《" + c.name + "》" + c.text;
    } else {
      var facts = window.LZData.FACTS;
      knowText = facts[sv.runs % facts.length];
      elResultKnow.textContent = knowText;
    }
    elResultCodex.textContent = "图鉴 " + unlocked.length + "/" + list.length;
    if (window.LZShare) {
      window.LZShare.lastStats = {
        title: title,
        distText: dist + "m",
        score: score,
        zongzi: S.zongzi,
        maxCombo: S.maxCombo,
        knowName: knowName,
        knowText: knowText,
        codexCount: unlocked.length
      };
    }
    showView("result");
  }

  window.LZGame.setCallback("result", fillResult);

  var btnStart = document.getElementById("btn-start");
  if (btnStart) btnStart.addEventListener("click", startRun);
  var btnAgain = document.getElementById("btn-again");
  if (btnAgain) btnAgain.addEventListener("click", startRun);
  var btnHomeResult = document.getElementById("btn-home-result");
  if (btnHomeResult) btnHomeResult.addEventListener("click", function () {
    showView("home");
    renderHome();
  });
  var btnCodexResult = document.getElementById("btn-codex-result");
  if (btnCodexResult) btnCodexResult.addEventListener("click", function () { showCodex("result"); });
  var btnSaveAlbum = document.getElementById("btn-save-album");
  if (btnSaveAlbum) btnSaveAlbum.addEventListener("click", function () {
    if (window.LZShare) window.LZShare.saveAlbum();
  });
  var btnPostNote = document.getElementById("btn-post-note");
  if (btnPostNote) btnPostNote.addEventListener("click", function () {
    if (window.LZShare) window.LZShare.postNote();
  });

  var btnResume = document.getElementById("btn-resume");
  if (btnResume) btnResume.addEventListener("click", function () {
    pauseMask.classList.remove("is-on");
    window.LZGame.resume();
  });
  var btnQuit = document.getElementById("btn-quit");
  if (btnQuit) btnQuit.addEventListener("click", function () {
    pauseMask.classList.remove("is-on");
    showView("home");
    renderHome();
  });

  var btnCodexHome = document.getElementById("btn-codex-home");
  if (btnCodexHome) btnCodexHome.addEventListener("click", function () { showCodex("home"); });
  var btnCodexBack = document.getElementById("btn-codex-back");
  if (btnCodexBack) btnCodexBack.addEventListener("click", hideCodex);
  var btnCardClose = document.getElementById("codex-card-close");
  if (btnCardClose) btnCardClose.addEventListener("click", hideCodexCard);

  document.addEventListener("pointerdown", function () {
    if (window.LZSound && window.LZSound.unlock) window.LZSound.unlock();
  });

  var btnMuteHome = document.getElementById("btn-mute-home");
  function renderMute() {
    if (!btnMuteHome) return;
    var m = !!(window.LZSound && window.LZSound.isMuted());
    btnMuteHome.textContent = m ? "静" : "声";
    btnMuteHome.classList.toggle("is-muted", m);
  }
  if (btnMuteHome) btnMuteHome.addEventListener("click", function () {
    if (!window.LZSound) return;
    window.LZSound.setMuted(!window.LZSound.isMuted());
    renderMute();
  });

  showView("home");
  renderHome();
  renderMute();
  if (demoMode) startRun();

  window.__ui = { toast: showToast, showCodex: showCodex, showView: showView, seen: function () { return seen; } };
})();
