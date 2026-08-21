(function () {
  var D = window.QQData;
  var canvas = document.getElementById("stage");
  var hint = document.getElementById("phase-hint");
  var ctx = canvas.getContext("2d");
  var HINTS = {
    home: "",
    water: "长按舀水，注满此盆",
    calm: "圈收至心时松手，定心",
    drop: "针已入水…",
    reveal: "月光下，针影渐显…",
    result: ""
  };
  var last = 0, lastPhase = null;
  var resultTimer = null;
  var lastPourSnd = 0, lastHeartSnd = 0;
  var resultCanvas = document.getElementById("result-shadow-icon");
  var resultCtx = resultCanvas.getContext("2d");
  var sealWrap = document.querySelector(".result-seal");
  var sealText = document.getElementById("result-seal");
  var tutorEl = document.getElementById("tutor");
  var firstRun = false;
  var TUTOR_TEXT = {
    water: "长按舀水，注满此盆",
    calm: "圈收至心时松手，定心",
    drop: "点按投针，静候针影",
    reveal: "点按投针，静候针影"
  };
  var demoMode = /[?&]demo=1/.test(location.search);
  var demoRestartTimer = null;

  QQScene.init(canvas);

  function setView(id) {
    var views = document.querySelectorAll(".view"), i;
    for (i = 0; i < views.length; i++) {
      views[i].classList.toggle("is-active", views[i].id === id);
    }
  }

  function clearResultTimer() {
    if (resultTimer) { clearTimeout(resultTimer); resultTimer = null; }
  }

  function loadSave() {
    if (!window.QQSave) return null;
    try { return window.QQSave.load(); } catch (e) { return null; }
  }

  function refreshHomeProgress() {
    var el = document.getElementById("home-progress");
    var o = loadSave(), n = 0, runs = 0;
    if (o) { n = o.codex.length; runs = o.runs; }
    el.textContent = "已集影形 " + n + "/12 · 历 " + runs + " 占";
  }

  function stampSeal() {
    sealWrap.classList.remove("stamp-in");
    void sealWrap.offsetWidth;
    sealWrap.classList.add("stamp-in");
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function fillResult(r) {
    var i, p, n;
    if (!r) return;
    resultCtx.clearRect(0, 0, 240, 240);
    resultCtx.fillStyle = "#F5F0E6";
    resultCtx.fillRect(0, 0, 240, 240);
    QQShadow.draw(resultCtx, r.shadowId, 120, 120, 200, 0.9);
    var nameEl = document.getElementById("result-shadow-name");
    clearChildren(nameEl);
    var b = document.createElement("b");
    b.textContent = r.shadow.name;
    var em = document.createElement("i");
    em.textContent = r.shadow.meaning;
    nameEl.appendChild(b);
    nameEl.appendChild(em);
    sealText.textContent = r.grade.name;
    sealWrap.classList.toggle("is-zhuo", r.gradeId === "weide");
    document.getElementById("result-aspect").textContent = "巧运在 " + r.aspect.name;
    var textEl = document.getElementById("result-text");
    clearChildren(textEl);
    var parts = [r.shadow.text, r.aspect.text, r.grade.text];
    for (i = 0; i < parts.length; i++) {
      p = document.createElement("p");
      p.textContent = parts[i];
      textEl.appendChild(p);
    }
    document.getElementById("result-know").textContent =
      D.FACTS[r.knowIdx % D.FACTS.length];
    n = 0;
    if (window.QQSave) { try { n = window.QQSave.codexCount(); } catch (e) { n = 0; } }
    document.getElementById("result-codex").textContent = "图鉴 " + n + "/12";
  }

  var seen = {};
  (function () {
    var sv = loadSave();
    var c = sv ? sv.codex : [], i;
    for (i = 0; i < c.length; i++) seen[c[i]] = true;
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

  var codexGrid = document.getElementById("codex-grid");
  var codexCountEl = document.getElementById("codex-count");
  var codexCard = document.getElementById("codex-card");
  var cardName = document.getElementById("codex-card-name");
  var cardText = document.getElementById("codex-card-text");
  var cardCanvas = document.getElementById("codex-canvas");
  var codexOrigin = "home";

  function hideCodexCard() { codexCard.classList.remove("is-on"); }

  function openCodexCard(item) {
    var cctx = cardCanvas.getContext("2d");
    cctx.clearRect(0, 0, 120, 120);
    cctx.fillStyle = "#F5F0E6";
    cctx.fillRect(0, 0, 120, 120);
    QQShadow.draw(cctx, item.id, 60, 60, 104, 0.9);
    clearChildren(cardName);
    var tag = document.createElement("small");
    tag.className = "codex-luck";
    tag.textContent = item.luck === "zhuo" ? "拙" : "吉";
    cardName.appendChild(document.createTextNode(item.name));
    cardName.appendChild(tag);
    clearChildren(cardText);
    cardText.appendChild(document.createTextNode(item.meaning));
    cardText.appendChild(document.createElement("br"));
    cardText.appendChild(document.createTextNode(item.text));
    codexCard.classList.add("is-on");
  }

  function buildCodex() {
    clearChildren(codexGrid);
    var sv = loadSave() || { codex: [] };
    var un = {}, i, n = 0;
    for (i = 0; i < sv.codex.length; i++) un[sv.codex[i]] = true;
    for (i = 0; i < D.SHADOWS.length; i++) {
      (function (item) {
        var isOpen = !!un[item.id];
        if (isOpen) n++;
        var cell = document.createElement("div");
        cell.className = "codex-cell" + (isOpen ? "" : " is-locked");
        var cv = document.createElement("canvas");
        cv.width = 120;
        cv.height = 120;
        cell.appendChild(cv);
        var nm = document.createElement("div");
        nm.className = "codex-cell-name";
        cell.appendChild(nm);
        if (isOpen) {
          var cctx = cv.getContext("2d");
          cctx.fillStyle = "#F5F0E6";
          cctx.fillRect(0, 0, 120, 120);
          QQShadow.draw(cctx, item.id, 60, 60, 100, 0.9);
          nm.textContent = item.name;
          cell.addEventListener("click", function () { openCodexCard(item); });
        }
        codexGrid.appendChild(cell);
      })(D.SHADOWS[i]);
    }
    codexCountEl.textContent = n + "/" + D.SHADOWS.length;
  }

  function showCodex(origin) {
    codexOrigin = (origin === "result") ? "result" : "home";
    hideCodexCard();
    buildCodex();
    setView("view-codex");
  }

  function hideCodex() {
    hideCodexCard();
    if (codexOrigin === "result") {
      setView("view-result");
    } else {
      setView("view-home");
      refreshHomeProgress();
    }
  }

  function hideTutor() {
    firstRun = false;
    tutorEl.textContent = "";
    tutorEl.classList.remove("is-on");
  }

  function demoRestart() {
    if (demoRestartTimer) clearTimeout(demoRestartTimer);
    demoRestartTimer = setTimeout(function () {
      demoRestartTimer = null;
      if (demoMode) QQDivine.start();
    }, 3200);
  }

  function demoAutopilot(s) {
    var phasePos;
    if (s.phase === "water") {
      if (!s.holding) QQDivine.holdWater(true);
    } else if (s.phase === "calm") {
      phasePos = (s.calmT % D.CALM_CYCLE) / D.CALM_CYCLE;
      if (phasePos > 0.93) QQDivine.releaseCalm();
    }
  }

  QQDivine.setCallback("start", function () {
    clearResultTimer();
    if (demoRestartTimer) { clearTimeout(demoRestartTimer); demoRestartTimer = null; }
    var sv = loadSave();
    firstRun = !!(sv && sv.runs === 0);
    if (!firstRun) hideTutor();
    setView("view-ceremony");
  });
  QQDivine.setCallback("filled", function () {
    if (window.QQSound) window.QQSound.water();
  });
  QQDivine.setCallback("dropped", function () {
    if (window.QQSound) window.QQSound.drop();
  });
  QQDivine.setCallback("revealed", function () {
    if (window.QQSound) window.QQSound.reveal();
  });
  QQDivine.setCallback("result", function (r) {
    clearResultTimer();
    hideTutor();
    if (window.QQSound) window.QQSound.result();
    fillResult(r);
    if (r && r.shadow && !seen[r.shadowId]) {
      seen[r.shadowId] = true;
      showToast("影形入鉴 · " + r.shadow.name);
    }
    if (r && window.QQShare) {
      var cn = 0;
      if (window.QQSave) { try { cn = window.QQSave.codexCount(); } catch (e) { cn = 0; } }
      window.QQShare.lastStats = {
        shadowId: r.shadowId,
        shadowName: r.shadow.name,
        gradeId: r.gradeId,
        gradeName: r.grade.name,
        aspectName: r.aspect.name,
        textLines: [r.shadow.text, r.aspect.text, r.grade.text],
        codexCount: cn
      };
    }
    resultTimer = setTimeout(function () {
      resultTimer = null;
      setView("view-result");
      stampSeal();
      if (demoMode) demoRestart();
    }, 1200);
  });

  function drawCalmCircle(s) {
    var m = QQScene.metrics();
    var phasePos = (s.calmT % D.CALM_CYCLE) / D.CALM_CYCLE;
    var r = (90 - 70 * phasePos) * m.u;
    var hot = phasePos > 0.93;
    ctx.save();
    ctx.strokeStyle = hot ? "#FFB61E" : "#D6ECF0";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = (hot ? 3 : 2) * m.u;
    if (hot) {
      ctx.shadowColor = "#FFB61E";
      ctx.shadowBlur = 14 * m.u;
    }
    ctx.beginPath();
    ctx.arc(m.cx, m.basinY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawNeedle(s) {
    var m = QQScene.metrics();
    var u = m.u, len = 20 * u;
    var floatY = m.basinY - m.basinRy * 0.15;
    var y, rot;
    ctx.save();
    ctx.lineCap = "round";
    if (s.needleY < 1) {
      y = floatY - (1 - s.needleY) * (80 * u + m.basinRy * 0.85);
      rot = -0.3 * (1 - s.needleY);
      ctx.translate(m.cx, y);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "#dfe6ee";
      ctx.lineWidth = 1.1 * u;
      ctx.beginPath();
      ctx.moveTo(-len * 0.85, -7 * u);
      ctx.lineTo(len * 0.85, -7 * u);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#dfe6ee";
      ctx.lineWidth = 2.2 * u;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.3 * u;
      ctx.beginPath();
      ctx.moveTo(len - 4 * u, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
    } else {
      ctx.translate(m.cx, floatY);
      ctx.strokeStyle = "#dfe6ee";
      ctx.lineWidth = 2.2 * u;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.3 * u;
      ctx.beginPath();
      ctx.moveTo(len - 4 * u, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.globalAlpha = 0.16 + 0.08 * Math.sin(s.t * 3);
      ctx.strokeStyle = "#eef4fa";
      ctx.lineWidth = 1.1 * u;
      ctx.beginPath();
      ctx.moveTo(-len * 0.8, 4 * u);
      ctx.lineTo(len * 0.8, 4 * u);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawReveal(s) {
    if (!s.result) return;
    var m = QQScene.metrics();
    var p = s.phase === "result" ? 1 : s.revealP;
    var alpha = 0.85 * Math.pow(p, 1.4);
    var size = Math.min(m.basinRy * 1.15 * (0.85 + 0.15 * p), m.waterRy * 1.9);
    var sx = m.cx, sy = m.basinY + m.basinRy * 0.25;
    var o = (1 - p) * 6 * m.u;
    var angs = [1.571, 3.665, 5.76], ga, i;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(m.cx, m.basinY, m.waterRx, m.waterRy, 0, 0, Math.PI * 2);
    ctx.clip();
    if (o > 0.01) {
      ga = alpha * (1 - p);
      for (i = 0; i < 3; i++) {
        QQShadow.draw(ctx, s.result.shadowId, sx + Math.cos(angs[i]) * o, sy + Math.sin(angs[i]) * o, size, ga);
      }
    }
    QQShadow.draw(ctx, s.result.shadowId, sx, sy, size, alpha);
    ctx.restore();
  }

  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    QQDivine.update(dt);
    var s = QQDivine.snapshot();
    if (demoMode) demoAutopilot(s);
    if (window.QQSound) {
      if (s.phase === "water" && s.holding && s.t - lastPourSnd > 0.35) {
        lastPourSnd = s.t;
        window.QQSound.water();
      }
      if (s.phase === "calm" && s.t - lastHeartSnd > 0.8) {
        lastHeartSnd = s.t;
        window.QQSound.heartbeat();
      }
    }
    QQScene.draw({ phase: s.phase, moonlight: s.moonlight }, dt);
    if (s.phase === "reveal" || s.phase === "result") drawReveal(s);
    if (s.phase === "drop" || s.phase === "reveal" || s.phase === "result") drawNeedle(s);
    if (s.phase === "calm") drawCalmCircle(s);
    if (s.phase !== lastPhase) {
      hint.textContent = HINTS[s.phase] || "";
      if (firstRun && TUTOR_TEXT[s.phase]) {
        tutorEl.textContent = TUTOR_TEXT[s.phase];
        tutorEl.classList.add("is-on");
      } else {
        tutorEl.textContent = "";
        tutorEl.classList.remove("is-on");
      }
      lastPhase = s.phase;
    }
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", function () {
    if (window.QQSound) window.QQSound.unlock();
    var p = QQDivine.snapshot().phase;
    if (p === "water") QQDivine.holdWater(true);
    else if (p === "drop") QQDivine.dropNeedle();
  });
  canvas.addEventListener("pointerup", function () {
    var p = QQDivine.snapshot().phase;
    if (p === "water") QQDivine.holdWater(false);
    else if (p === "calm") QQDivine.releaseCalm();
  });
  canvas.addEventListener("pointercancel", function () { QQDivine.holdWater(false); });
  canvas.addEventListener("pointerleave", function () { QQDivine.holdWater(false); });

  document.getElementById("btn-start").addEventListener("click", function () {
    QQDivine.start();
  });
  document.getElementById("btn-again").addEventListener("click", function () {
    QQDivine.start();
  });
  document.getElementById("btn-home-result").addEventListener("click", function () {
    setView("view-home");
    refreshHomeProgress();
  });
  document.getElementById("btn-codex-result").addEventListener("click", function () {
    showCodex("result");
  });
  document.getElementById("btn-codex-home").addEventListener("click", function () {
    showCodex("home");
  });
  document.getElementById("btn-codex-back").addEventListener("click", function () {
    hideCodex();
  });
  document.getElementById("codex-card-close").addEventListener("click", function () {
    hideCodexCard();
  });
  document.getElementById("btn-save-album").addEventListener("click", function () {
    if (window.QQShare) window.QQShare.saveAlbum();
  });
  document.getElementById("btn-post-note").addEventListener("click", function () {
    if (window.QQShare) window.QQShare.postNote();
  });

  var muteBtn = document.getElementById("btn-mute-home");
  function renderMute() {
    if (!muteBtn) return;
    var m = window.QQSound && window.QQSound.isMuted();
    muteBtn.textContent = m ? "静" : "声";
    muteBtn.classList.toggle("is-muted", !!m);
  }
  if (muteBtn) {
    muteBtn.addEventListener("click", function () {
      if (!window.QQSound) return;
      window.QQSound.unlock();
      window.QQSound.setMuted(!window.QQSound.isMuted());
      renderMute();
    });
  }

  refreshHomeProgress();
  renderMute();
  requestAnimationFrame(loop);
  if (demoMode) {
    setTimeout(function () { QQDivine.start(); }, 800);
  }
})();
