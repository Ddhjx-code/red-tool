(function () {
  var D = window.GYData;
  var S = { phase: "home", sceneIdx: 0, yang: 3, kept: 0, broken: 0, history: [], outcome: null, ending: null };
  var params = new URLSearchParams(location.search);
  var isDemo = params.get("demo") === "1";
  var locked = false;

  function $(id) { return document.getElementById(id); }

  function setView(id) {
    var views = document.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle("is-active", views[i].id === id);
    }
  }

  function reset() {
    S = { phase: "rules", sceneIdx: 0, yang: 3, kept: 0, broken: 0, history: [], outcome: null, ending: null };
  }

  function renderRules() {
    var box = $("rules-list");
    box.innerHTML = "";
    D.rules.forEach(function (r, i) {
      var li = document.createElement("li");
      li.textContent = r.text;
      li.style.animationDelay = (i * 0.35) + "s";
      box.appendChild(li);
    });
  }

  var SCENE_BG = { s1: "bg-office", s2: "bg-cross", s3: "bg-lamp", s4: "bg-alley", s5: "bg-door" };

  function renderScene() {
    var sc = D.scenes[S.sceneIdx];
    S.phase = "scene";
    var sv = $("view-scene");
    sv.className = "view is-active " + (SCENE_BG[sc.id] || "");
    $("scene-title").textContent = sc.title;
    $("scene-text").textContent = sc.text;
    var box = $("choice-list");
    box.innerHTML = "";
    sc.choices.forEach(function (ch, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "choice-btn";
      b.textContent = ch.text;
      b.style.animationDelay = (0.3 + i * 0.25) + "s";
      b.addEventListener("click", function () { choose(i); });
      box.appendChild(b);
    });
    renderYang();
    setView("view-scene");
  }

  function renderYang() {
    var dots = $("yang-dots");
    dots.innerHTML = "";
    for (var i = 0; i < 3; i++) {
      var s = document.createElement("span");
      s.className = "yang-dot" + (i < S.yang ? " on" : "");
      dots.appendChild(s);
    }
    $("scene-step").textContent = "夜路 " + (S.sceneIdx + 1) + " / 5";
  }

  function choose(i) {
    if (locked || S.phase !== "scene") return;
    locked = true;
    var sc = D.scenes[S.sceneIdx];
    var ch = sc.choices[i];
    S.history.push({ scene: sc.id, choice: i, safe: ch.safe });
    window.GYAudio.choose();
    if (ch.safe) {
      S.kept++;
      S.outcome = { good: true, text: ch.good };
    } else {
      S.broken++;
      S.yang--;
      S.outcome = { good: false, text: ch.bad };
      window.GYAudio.bad();
      document.body.classList.add("fright");
      setTimeout(function () { document.body.classList.remove("fright"); }, 500);
    }
    $("outcome-text").textContent = S.outcome.text;
    $("outcome-text").className = "outcome-text " + (S.outcome.good ? "good" : "bad");
    $("btn-next").textContent = (S.yang <= 0) ? "……" : (S.sceneIdx >= D.scenes.length - 1 ? "天快亮了" : "继续走");
    setView("view-outcome");
    setTimeout(function () { locked = false; }, 400);
  }

  function next() {
    if (locked) return;
    if (S.yang <= 0) { finish("lost"); return; }
    if (S.sceneIdx >= D.scenes.length - 1) {
      finish(S.yang === 3 ? "safe" : "scar");
      return;
    }
    S.sceneIdx++;
    renderScene();
  }

  function finish(endingId) {
    S.phase = "result";
    var e = null;
    for (var i = 0; i < D.endings.length; i++) if (D.endings[i].id === endingId) e = D.endings[i];
    S.ending = e;
    var isNew = window.GYSave.record(endingId, S.yang);
    $("result-ending").textContent = e.name;
    $("result-ending").className = "result-ending " + (endingId === "lost" ? "lost" : "");
    $("result-cond").textContent = e.cond;
    $("result-text").textContent = e.text;
    $("result-stats").textContent = "守住规矩 " + S.kept + " / 5 · 破忌 " + S.broken + " · 阳气余 " + S.yang + " 盏";
    $("result-new").style.display = isNew ? "" : "none";
    var know = $("result-know");
    know.innerHTML = "";
    var kn = D.knowledge[window.GYSave.load().runs % D.knowledge.length];
    var p = document.createElement("p");
    p.textContent = kn;
    know.appendChild(p);
    renderEndings();
    window.GYShare.lastStats = {
      endingName: e.name,
      endingText: e.text,
      lost: endingId === "lost",
      kept: S.kept,
      yang: S.yang
    };
    window.GYAudio.stopDrone();
    window.GYAudio.ending(endingId === "lost");
    setView("view-result");
  }

  function renderEndings() {
    var o = window.GYSave.load();
    var box = $("endings-list");
    box.innerHTML = "";
    D.endings.forEach(function (e) {
      var got = o.endings.indexOf(e.id) >= 0;
      var d = document.createElement("div");
      d.className = "ending-item" + (got ? " got" : "");
      d.textContent = got ? e.name : "？？？";
      box.appendChild(d);
    });
  }

  function refreshHome() {
    var o = window.GYSave.load();
    $("home-progress").textContent = "结局 " + o.endings.length + "/3 · 夜行 " + o.runs + " 次";
  }

  function startWalk() {
    window.GYAudio.unlock();
    window.GYAudio.startDrone();
    reset();
    renderRules();
    setView("view-rules");
  }

  function runDemo() {
    setTimeout(startWalk, 800);
    var step = 0;
    (function autoChoose() {
      if (step >= 5) return;
      setTimeout(function () {
        var sc = D.scenes[step];
        var safeIdx = 0;
        for (var i = 0; i < sc.choices.length; i++) if (sc.choices[i].safe) safeIdx = i;
        if (S.phase === "rules") { $("btn-walk").click(); }
        setTimeout(function () { choose(safeIdx); }, 700);
        setTimeout(function () { next(); }, 2200);
        step++;
        autoChoose();
      }, step === 0 ? 2600 : 3600);
    })();
  }

  function init() {
    $("btn-start").addEventListener("click", startWalk);
    $("btn-walk").addEventListener("click", function () { renderScene(); window.GYAudio.step(); });
    $("btn-next").addEventListener("click", next);
    $("btn-again").addEventListener("click", function () { startWalk(); });
    $("btn-home-result").addEventListener("click", function () {
      refreshHome();
      setView("view-home");
    });
    $("btn-save-album").addEventListener("click", function () { window.GYShare.saveAlbum(); });
    $("btn-post-note").addEventListener("click", function () { window.GYShare.postNote(); });

    refreshHome();
    if (isDemo) runDemo();

    window.__game = {
      snapshot: function () {
        return {
          phase: S.phase, sceneIdx: S.sceneIdx, yang: S.yang, kept: S.kept, broken: S.broken,
          ending: S.ending ? S.ending.id : null,
          history: S.history.slice(),
          endings: window.GYSave.load().endings.slice()
        };
      },
      start: startWalk,
      walk: function () { renderScene(); },
      choose: choose,
      next: next,
      paintCard: function () { return window.GYShare.paintCard(window.GYShare.lastStats); }
    };
    window.__ready = true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
