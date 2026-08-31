(function () {
  var D = window.HDData;
  var canvas, ctx;
  var S = {
    phase: "home",
    lanternId: "lotus",
    recipientId: "elder",
    message: "",
    flame: 0,
    releaseT0: 0,
    seed: 20260827,
    endNotified: false
  };
  var pressing = false, pressRaf = 0, lastGrowT = 0;
  var params = new URLSearchParams(location.search);
  var isTest = params.get("test") === "1";
  var isDemo = params.get("demo") === "1";

  function $(id) { return document.getElementById(id); }
  function lantern() {
    for (var i = 0; i < D.lanterns.length; i++) if (D.lanterns[i].id === S.lanternId) return D.lanterns[i];
    return D.lanterns[0];
  }
  function recipient() {
    for (var i = 0; i < D.recipients.length; i++) if (D.recipients[i].id === S.recipientId) return D.recipients[i];
    return D.recipients[0];
  }
  function grade() {
    for (var i = 0; i < D.grades.length; i++) if (S.flame >= D.grades[i].min) return D.grades[i];
    return D.grades[D.grades.length - 1];
  }

  function setView(id) {
    var views = document.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle("is-active", views[i].id === id);
    }
  }

  function renderMake() {
    var lbox = $("lantern-list");
    lbox.innerHTML = "";
    D.lanterns.forEach(function (l) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "lantern-card" + (l.id === S.lanternId ? " chosen" : "");
      var cv = document.createElement("canvas");
      cv.width = 120; cv.height = 100;
      var g = cv.getContext("2d");
      g.fillStyle = "#16202c";
      g.fillRect(0, 0, 120, 100);
      window.HDScene.drawLantern(g, l.shape, 60, 58, 1.15, 0.8, 1);
      var nm = document.createElement("b");
      nm.textContent = l.name;
      var ds = document.createElement("i");
      ds.textContent = l.meaning;
      b.appendChild(cv);
      b.appendChild(nm);
      b.appendChild(ds);
      b.addEventListener("click", function () {
        S.lanternId = l.id;
        window.HDAudio.select();
        renderMake();
      });
      lbox.appendChild(b);
    });
    var rbox = $("recipient-list");
    rbox.innerHTML = "";
    D.recipients.forEach(function (r) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "recipient-chip" + (r.id === S.recipientId ? " chosen" : "");
      b.textContent = r.name;
      b.addEventListener("click", function () {
        S.recipientId = r.id;
        window.HDAudio.select();
        renderMake();
      });
      rbox.appendChild(b);
    });
  }

  function startLight() {
    S.phase = "light";
    S.flame = 0;
    S.lit = false;
    S.endNotified = false;
    S.lantern = lantern();
    window.HDAudio.startWater();
    setView("view-light");
    window.HDScene.init($("stage"));
  }

  function startRelease() {
    if (S.flame <= 0) return;
    S.phase = "release";
    S.releaseT0 = performance.now();
    S.endNotified = false;
    S.lantern = lantern();
    S.message = ($("msg-input").value || "").trim() || recipient().line;
    setView("view-release");
    window.HDScene.init($("stage-release"));
    window.HDScene.buildOthers(S.seed + window.HDSave.load().runs, 30);
    window.HDAudio.splash();
  }

  function showResult() {
    S.phase = "result";
    var g = grade();
    var isNew = window.HDSave.unlock(S.lanternId + ":" + S.recipientId);
    $("result-grade").textContent = g.name;
    $("result-grade-text").textContent = g.text;
    $("result-msg").textContent = "「" + S.message + "」";
    $("result-recipient").textContent = "—— 寄给" + recipient().name;
    $("result-new").style.display = isNew ? "" : "none";
    var know = $("result-know");
    know.innerHTML = "";
    var kn = D.knowledge[window.HDSave.load().runs % D.knowledge.length];
    var p = document.createElement("p");
    p.textContent = kn;
    know.appendChild(p);
    window.HDShare.lastStats = {
      shape: lantern().shape,
      recipientName: recipient().name,
      message: S.message,
      gradeName: g.name,
      gradeText: g.text,
      codexCount: window.HDSave.codexCount()
    };
    window.HDAudio.chime();
    setView("view-result");
  }

  function renderCodex() {
    var o = window.HDSave.load();
    var grid = $("codex-grid");
    grid.innerHTML = "";
    D.lanterns.forEach(function (l) {
      D.recipients.forEach(function (r) {
        var key = l.id + ":" + r.id;
        var lit = o.codex.indexOf(key) >= 0;
        var cell = document.createElement("div");
        cell.className = "codex-cell" + (lit ? " lit" : "");
        var cv = document.createElement("canvas");
        cv.width = 84; cv.height = 70;
        var g = cv.getContext("2d");
        g.fillStyle = "#16202c";
        g.fillRect(0, 0, 84, 70);
        if (lit) window.HDScene.drawLantern(g, l.shape, 42, 40, 0.8, 0.8, 1);
        else {
          g.fillStyle = "rgba(214,236,240,0.12)";
          g.beginPath();
          g.arc(42, 38, 18, 0, Math.PI * 2);
          g.fill();
        }
        var t = document.createElement("span");
        t.textContent = lit ? l.name + "·" + r.name : "未点";
        cell.appendChild(cv);
        cell.appendChild(t);
        grid.appendChild(cell);
      });
    });
    $("codex-count").textContent = o.codex.length + "/12";
  }

  function refreshHome() {
    var o = window.HDSave.load();
    $("home-progress").textContent = "灯谱 " + o.codex.length + "/12 · 已放 " + o.runs + " 盏";
  }

  function frame(t) {
    if (S.phase === "light" && S.lit && S.flame < 100) {
      if (!lastGrowT) lastGrowT = t;
      var dt = t - lastGrowT;
      lastGrowT = t;
      S.flame = Math.min(100, S.flame + dt / 90);
    }
    if (S.phase === "light" || S.phase === "release") {
      window.HDScene.draw(S, t);
    }
    requestAnimationFrame(frame);
  }

  function pressStart() {
    if (S.phase !== "light") return;
    if (!S.lit) {
      S.lit = true;
      lastGrowT = 0;
      window.HDAudio.ignite();
    }
  }
  function pressEnd() {
    pressing = false;
    cancelAnimationFrame(pressRaf);
  }

  function runDemo() {
    setTimeout(function () { $("btn-start").click(); }, 800);
    setTimeout(function () {
      S.lanternId = "lotus";
      S.recipientId = "elder";
      $("msg-input").value = "奶奶，家里一切都好。";
      renderMake();
    }, 2000);
    setTimeout(function () { $("btn-to-light").click(); }, 3200);
    setTimeout(function () { S.flame = 92; }, 4200);
    setTimeout(function () { $("btn-release").click(); }, 5600);
  }

  function init() {
    canvas = $("stage");
    window.HDScene.init(canvas);
    window.addEventListener("resize", function () { window.HDScene.resize(); });

    $("btn-start").addEventListener("click", function () {
      window.HDAudio.unlock();
      renderMake();
      setView("view-make");
    });
    $("btn-to-light").addEventListener("click", function () { startLight(); });
    $("btn-back-make").addEventListener("click", function () { setView("view-make"); });
    $("btn-release").addEventListener("click", function () { startRelease(); });
    $("btn-skip-release").addEventListener("click", function () {
      S.endNotified = true;
      showResult();
    });
    $("btn-again").addEventListener("click", function () {
      S.flame = 0;
      renderMake();
      setView("view-make");
    });
    $("btn-codex-result").addEventListener("click", function () {
      renderCodex();
      setView("view-codex");
    });
    $("btn-codex-home").addEventListener("click", function () {
      renderCodex();
      setView("view-codex");
    });
    $("btn-codex-back").addEventListener("click", function () {
      refreshHome();
      setView("view-home");
    });
    $("btn-home-result").addEventListener("click", function () {
      window.HDAudio.stopWater();
      refreshHome();
      setView("view-home");
    });
    $("btn-save-album").addEventListener("click", function () { window.HDShare.saveAlbum(); });
    $("btn-post-note").addEventListener("click", function () { window.HDShare.postNote(); });

    var lightZone = $("light-zone");
    lightZone.addEventListener("pointerdown", function (e) { e.preventDefault(); pressStart(); });
    lightZone.addEventListener("pointerup", pressEnd);
    lightZone.addEventListener("pointercancel", pressEnd);
    lightZone.addEventListener("pointerleave", pressEnd);

    $("msg-input").addEventListener("input", function () { window.HDAudio.write(); });

    refreshHome();
    requestAnimationFrame(frame);

    if (isDemo) runDemo();

    window.__game = {
      snapshot: function () {
        return {
          phase: S.phase, lanternId: S.lanternId, recipientId: S.recipientId,
          message: S.message, flame: Math.round(S.flame),
          grade: grade().id, codex: window.HDSave.load().codex.slice(),
          runs: window.HDSave.load().runs
        };
      },
      setLantern: function (id) { S.lanternId = id; },
      setRecipient: function (id) { S.recipientId = id; },
      setMessage: function (m) { var el = $("msg-input"); if (el) el.value = m; },
      toMake: function () { renderMake(); setView("view-make"); S.phase = "make"; },
      toLight: function () { startLight(); },
      setFlame: function (v) { S.flame = Math.max(0, Math.min(100, v)); if (v > 0) S.lit = true; },
      release: function () { startRelease(); },
      finish: function () { S.endNotified = true; showResult(); },
      paintCard: function () { return window.HDShare.paintCard(window.HDShare.lastStats); }
    };
    window.__ready = true;
  }

  window.HDMain = {
    onReleaseDone: function () { showResult(); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
