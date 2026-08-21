(function () {
  var $ = function (id) { return document.getElementById(id); };
  var DATA = window.WenwuData;
  var view = "select";
  var artifact = null;
  var stageName = "";
  var done = loadDone();
  var lastNow = performance.now();

  function loadDone() {
    try { return JSON.parse(localStorage.getItem("wenwu-done") || "[]"); }
    catch (e) { return []; }
  }
  function saveDone() {
    try { localStorage.setItem("wenwu-done", JSON.stringify(done)); }
    catch (e) { /* ignore */ }
  }

  function showView(name) {
    view = name;
    ["select", "work", "quiz", "report"].forEach(function (v) {
      $("view-" + v).classList.toggle("is-active", v === name);
    });
    $("c3d").classList.toggle("is-on", name === "work" || name === "report");
    if (name === "work" || name === "report") {
      setTimeout(function () { window.Engine3D.resize(); }, 50);
    }
  }

  function setStage(key, stepIdx, label, hint) {
    stageName = key;
    $("work-stage").textContent = label;
    $("work-hint").textContent = hint || "";
    var steps = $("work-step");
    steps.textContent = "";
    for (var i = 0; i < 4; i++) {
      var dot = document.createElement("i");
      if (i <= stepIdx) dot.className = "is-on";
      steps.appendChild(dot);
    }
  }

  // ---------- 选件 ----------

  function buildSelect() {
    var list = $("artifact-list");
    list.textContent = "";
    DATA.forEach(function (a) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "artifact-card" + (done.indexOf(a.id) >= 0 ? " is-done" : "");
      var img = document.createElement("img");
      img.className = "card-thumb";
      img.src = a.thumb;
      img.alt = a.name;
      var info = document.createElement("div");
      info.className = "card-info";
      var nm = document.createElement("p");
      nm.className = "card-name";
      nm.textContent = a.name;
      var era = document.createElement("p");
      era.className = "card-era";
      era.textContent = a.era;
      info.appendChild(nm);
      info.appendChild(era);
      var badge = document.createElement("span");
      badge.className = "card-badge";
      badge.textContent = done.indexOf(a.id) >= 0 ? "已修复" : "";
      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(badge);
      card.addEventListener("click", function () { startWork(a); });
      list.appendChild(card);
    });
  }

  // ---------- 修复流程 ----------

  var engineReady = false;

  function startWork(a) {
    artifact = a;
    $("work-name").textContent = a.name;
    showView("work");
    setStage("assemble", 0, "形 · 拼合", "拖动碎片归位 · 点按旋转朝向");
    if (engineReady) {
      window.Engine3D.resetForReplay();
      return;
    }
    var mats = {};
    Object.keys(a.mats).forEach(function (k) {
      mats[k] = {
        pbr: window.Engine3D.makePBR(a.mats[k]),
        buried: window.Engine3D.makeBuried(a.mats[k])
      };
    });
    window.Engine3D.load(a.pieces, mats, function () {
      engineReady = true;
      window.Engine3D.rememberBuried();
      window.__ready3d = true;
    });
  }

  function onAllAssembled() {
    setStage("polish", 1, "色 · 擦亮", "按住摩擦 · 擦亮千年浮土");
    window.Engine3D.startPolish(function () {
      beginQuiz();
    });
  }

  function beginQuiz() {
    var q = artifact.quiz;
    $("quiz-motif").src = artifact.thumb;
    $("quiz-q").textContent = q.question;
    var opts = $("quiz-opts");
    opts.textContent = "";
    q.options.forEach(function (text, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "opt-btn";
      b.textContent = text;
      b.addEventListener("click", function () { answer(i, b); });
      opts.appendChild(b);
    });
    $("quiz-explain").classList.remove("is-on");
    showView("quiz");
  }

  function answer(i, btn) {
    var q = artifact.quiz;
    if (i === q.answer) {
      btn.classList.add("is-right");
      Array.prototype.forEach.call($("quiz-opts").children, function (b) {
        b.classList.add("is-disabled");
      });
      $("quiz-explain-text").textContent = q.explain;
      $("quiz-explain").classList.add("is-on");
      window.Sound.chime();
    } else {
      btn.classList.add("is-wrong", "is-disabled");
      window.Sound.wrong();
    }
  }

  function beginReport() {
    $("report-name").textContent = artifact.name;
    $("report-meta").textContent = artifact.era + "｜" + artifact.collection;
    $("report-know").textContent = artifact.know;
    if (done.indexOf(artifact.id) < 0) {
      done.push(artifact.id);
      saveDone();
    }
    window.Engine3D.setTurntable();
    showView("report");
    window.Sound.gong();
  }

  // ---------- 事件 ----------

  var c3d = $("c3d");
  c3d.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    window.Sound.unlock();
    c3d.setPointerCapture && c3d.setPointerCapture(e.pointerId);
    window.Engine3D.pointerDown(e.clientX, e.clientY);
  });
  c3d.addEventListener("pointermove", function (e) {
    window.Engine3D.pointerMove(e.clientX, e.clientY);
  });
  c3d.addEventListener("pointerup", function () {
    window.Engine3D.pointerUp();
  });
  c3d.addEventListener("pointercancel", function () {
    window.Engine3D.pointerUp();
  });

  $("btn-back").addEventListener("click", function () {
    buildSelect();
    showView("select");
  });
  $("btn-mute").addEventListener("click", function () {
    window.Sound.unlock();
    var m = !window.Sound.isMuted();
    window.Sound.setMuted(m);
    $("btn-mute").textContent = m ? "静" : "声";
    $("btn-mute").classList.toggle("is-muted", m);
  });
  $("btn-quiz-next").addEventListener("click", beginReport);
  $("btn-report-back").addEventListener("click", function () {
    buildSelect();
    showView("select");
  });

  // ---------- 端能力（window.xhs.miniTool）：存相册 / 发笔记 ----------

  function miniTool() { return window.xhs && window.xhs.miniTool; }

  function fallbackShare() {
    alert("当前环境暂不支持直接保存，请截图保存哦");
  }

  function captureShareImage() {
    return window.Engine3D.captureRestored();
  }

  function sharePayload() {
    return {
      title: "我「修」好了一件三千年前的青铜鸮尊",
      content: "一片片拼回碎片，拂去浮土，青铜鸮尊重新显现。亲手体验非遗之美。",
      tags: "#国风vibecoding #文物 #非遗 #国风 #中式美学 #传统文化"
    };
  }

  $("btn-save-album").addEventListener("click", function () {
    var mt = miniTool();
    var dataUrl = captureShareImage();
    if (!dataUrl || !mt) { fallbackShare(); return; }
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) {
        mt.saveImageToPhotosAlbum({
          filePath: res.filePath,
          success: function () { alert("已保存到相册"); },
          fail: function () { fallbackShare(); }
        });
      },
      fail: function () { fallbackShare(); }
    });
  });

  $("btn-post-note").addEventListener("click", function () {
    var mt = miniTool();
    var dataUrl = captureShareImage();
    if (!dataUrl || !mt) { fallbackShare(); return; }
    var payload = sharePayload();
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) {
        mt.postNote({
          title: payload.title,
          content: payload.content,
          tags: payload.tags,
          mediaInfo: { image_resources: [{ url: res.filePath }] },
          fail: function () { fallbackShare(); }
        });
      },
      fail: function () { fallbackShare(); }
    });
  });

  // ---------- 主循环 ----------

  function frame(now) {
    var dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;
    if (view === "work" || view === "report") {
      window.Engine3D.update(dt);
    }
    requestAnimationFrame(frame);
  }

  // ---------- 演示模式（?demo=1 自动播放：拼合→擦亮→成品） ----------

  function startDemoMode() {
    var a = DATA[0];
    artifact = a;
    $("work-name").textContent = a.name;
    setStage("demo", 0, "形 · 拼合", "");
    showView("work");
    var mats = {};
    Object.keys(a.mats).forEach(function (k) {
      mats[k] = {
        pbr: window.Engine3D.makePBR(a.mats[k]),
        buried: window.Engine3D.makeBuried(a.mats[k])
      };
    });
    window.Engine3D.load(a.pieces, mats, function () {
      window.Engine3D.rememberBuried();
      window.__ready3d = true;
      window.Engine3D.startDemo(function () {
        beginReport();
      });
    });
  }

  // ---------- 启动 ----------

  window.Engine3D.init(c3d);
  window.Engine3D.setCallbacks(
    function () { window.Sound.lock(); },
    onAllAssembled
  );
  if (/[?&]demo=1/.test(location.search)) {
    startDemoMode();
  } else {
    buildSelect();
  }
  requestAnimationFrame(frame);
})();
