'use strict';

  /* =========================== [MAIN] =============================
     DOM glue + window.__ready / window.__game test hooks.
     All interaction goes through addEventListener — zero inline handlers.
     ================================================================ */
  var collected = {};
  var uiPhase = "intro";
  var locked = false;

  function $(id) { return document.getElementById(id); }

  function setView(id) {
    var views = document.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) views[i].classList.toggle("is-active", views[i].id === id);
    var ui = $("ui");
    if (ui) ui.classList.toggle("sheet-light", id === "view-ending");
    uiPhase = id === "view-intro" ? "intro"
      : id === "view-node" ? "node"
        : id === "view-outcome" ? "outcome"
          : id === "view-ending" ? "ending" : "intro";
  }

  function fillDots(el, value, max, cls) {
    if (!el) return;
    el.innerHTML = "";
    for (var i = 0; i < max; i++) {
      var s = document.createElement("span");
      s.className = "dot" + (i < value ? " " + cls : "");
      el.appendChild(s);
    }
  }

  function renderResources(suffix) {
    var r = YGEngine.resources();
    var L = YGEngine.limits;
    fillDots($("dots-warmth" + suffix), r.warmth, L.warmth, "on-warm");
    fillDots($("dots-tune" + suffix), r.tune, L.harvest, "on-cool");
    fillDots($("dots-dance" + suffix), r.dance, L.harvest, "on-silver");
  }

  function deltaLine(choice) {
    var parts = [];
    if (typeof choice.warmth === "number" && choice.warmth !== 0) {
      parts.push("暖意 " + (choice.warmth > 0 ? "+" : "") + choice.warmth);
    }
    if (typeof choice.tune === "number" && choice.tune !== 0) {
      parts.push("记曲 " + (choice.tune > 0 ? "+" : "") + choice.tune);
    }
    if (typeof choice.dance === "number" && choice.dance !== 0) {
      parts.push("观舞 " + (choice.dance > 0 ? "+" : "") + choice.dance);
    }
    return parts.join(" · ");
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* single pass + longest-first: prevents re-scanning inside <rt>, and
     prevents 广寒 shadowing 广寒清虚之府 */
  function withRuby(text) {
    var D = YGEngine.data();
    var out = esc(text);
    if (!D || !D.ruby || !D.ruby.length) return out;
    var terms = D.ruby.slice().sort(function (a, b) { return b.term.length - a.term.length; });
    var alts = [], byTerm = {};
    for (var i = 0; i < terms.length; i++) {
      var k = esc(terms[i].term);
      byTerm[k] = terms[i];
      alts.push(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
    var pat = new RegExp("(" + alts.join("|") + ")", "g");
    return out.replace(pat, function (m) {
      var t = byTerm[m];
      return t ? "<ruby>" + m + "<rt>" + esc(t.rt) + "</rt></ruby>" : m;
    });
  }

  function glossText(kind, key) {
    var D = YGEngine.data();
    if (!D || !D.gloss) return "";
    if (kind === "intro") return D.gloss.intro || "";
    var bucket = D.gloss[kind];
    return (bucket && bucket[key]) || "";
  }

  function setGloss(btnId, panelId, text) {
    var btn = $(btnId), panel = $(panelId);
    if (!btn || !panel) return;
    btn.style.display = text ? "" : "none";
    panel.textContent = text || "";
    panel.classList.remove("is-open");
    btn.classList.remove("is-open");
  }

  function bindGloss(btnId, panelId) {
    var btn = $(btnId), panel = $(panelId);
    if (!btn || !panel) return;
    btn.addEventListener("click", function () {
      var open = panel.classList.toggle("is-open");
      btn.classList.toggle("is-open", open);
    });
  }

  function renderIntro() {
    var D = YGEngine.data();
    var meta = (D && D.meta) || {};
    $("intro-title").textContent = meta.title || "";
    $("intro-sub").textContent = meta.subtitle || "";
    $("intro-body").innerHTML = withRuby(meta.intro || "");
    setGloss("btn-gloss-intro", "intro-gloss", glossText("intro", ""));
    setView("view-intro");
  }

  /* Terminal fallback for an id that exists in NEITHER D.nodes nor D.endings
     (a dangling `next`, or data whose ending map was swapped under us).
     This MUST NOT delegate back to renderNode/renderEnding — each of those
     delegates here when its own source is missing, so a mutual delegation
     would recurse until the stack blows. */
  function renderOrphan() {
    var id = YGEngine.state().nodeId;
    $("node-title").textContent = id || "";
    $("node-text").textContent = "";
    $("node-step").textContent = "";
    setGloss("btn-gloss-node", "node-gloss", "");
    renderResources("");

    var box = $("choice-list");
    box.innerHTML = "";
    var b = document.createElement("button");
    b.type = "button";
    b.className = "choice";
    b.textContent = "重 新 开 始";
    b.addEventListener("click", start);
    box.appendChild(b);
    setView("view-node");
  }

  function renderNode() {
    var nd = YGEngine.currentNode();
    if (!nd) {
      /* only delegate when the ending actually exists, otherwise terminate */
      if (YGEngine.currentEnding()) { renderEnding(); return; }
      renderOrphan();
      return;
    }
    $("node-title").textContent = nd.title || "";
    $("node-text").innerHTML = withRuby(nd.text || "");
    $("node-step").textContent = "第 " + YGEngine.walked() + " 段";
    setGloss("btn-gloss-node", "node-gloss", glossText("nodes", YGEngine.state().nodeId));
    renderResources("");

    var box = $("choice-list");
    box.innerHTML = "";
    var list = nd.choices || [];
    for (var i = 0; i < list.length; i++) {
      (function (idx) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "choice";
        b.textContent = list[idx].text || "";
        b.style.animationDelay = (idx * 90) + "ms";
        b.addEventListener("click", function () { choose(idx); });
        box.appendChild(b);
      })(i);
    }
    if (window.YGAudio) window.YGAudio.startDrone();
    setView("view-node");
  }

  function renderOutcome(res, idx) {
    $("outcome-text").innerHTML = withRuby(YGEngine.outcomeText());
    $("outcome-delta").textContent = deltaLine(res.choice);
    var key = (typeof idx === "number") ? (res.from + ":" + idx) : "";
    setGloss("btn-gloss-outcome", "outcome-gloss", key ? glossText("outcomes", key) : "");
    renderResources("-o");
    var atEnd = YGEngine.isEnding(YGEngine.state().nodeId);
    $("btn-advance").textContent = atEnd ? "天 将 明" : "继 续";
    setView("view-outcome");
  }

  function renderEnding() {
    var e = YGEngine.currentEnding();
    if (!e) {
      /* only delegate when the node actually exists, otherwise terminate */
      if (YGEngine.currentNode()) { renderNode(); return; }
      renderOrphan();
      return;
    }
    var id = YGEngine.state().nodeId;
    collected[id] = true;
    if (window.YGAudio) window.YGAudio.ending(id);
    var r = YGEngine.resources();

    $("end-name").textContent = e.name || "";
    $("end-cond").textContent = e.cond || "";
    $("end-text").innerHTML = withRuby(e.text || "");
    setGloss("btn-gloss-end", "end-gloss", glossText("endings", id));
    $("end-stats").textContent =
      "记曲 " + r.tune + " / 2 · 观舞 " + r.dance + " / 2 · 暖意余 " + r.warmth + " 度 · 走过 " + YGEngine.walked() + " 段";

    /* knowledge — deterministic pick, no ambient randomness */
    var D = YGEngine.data();
    var know = (D && D.knowledge) || [];
    var kbox = $("end-know");
    if (know.length) {
      var idx = Object.keys(collected).length % know.length;
      var k = know[idx] || know[0];
      $("end-know-t").textContent = k.title || "";
      $("end-know-x").textContent = k.text || "";
      kbox.style.display = "";
    } else {
      kbox.style.display = "none";
    }

    /* collected endings */
    var list = $("endings-list");
    list.innerHTML = "";
    var ids = (D && D.endings) ? Object.keys(D.endings) : [];
    for (var i = 0; i < ids.length; i++) {
      var chip = document.createElement("span");
      var got = !!collected[ids[i]];
      chip.className = "ending-chip" + (got ? " got" : "");
      chip.textContent = got ? (D.endings[ids[i]].name || "") : "？？？";
      list.appendChild(chip);
    }

    /* share card */
    YGShare.lastStats = {
      endingName: e.name || "", endingText: e.text || "",
      tune: r.tune, dance: r.dance, warmth: r.warmth, walked: YGEngine.walked()
    };
    var wrapBox = $("card-wrap");
    wrapBox.innerHTML = "";
    var url = null;
    try { url = YGShare.paintCard(YGShare.lastStats); } catch (err) { url = null; }
    if (url) {
      var img = document.createElement("img");
      img.alt = "分享卡";
      img.src = url;
      wrapBox.appendChild(img);
      $("card-note").textContent = "长按或点「存图」保存这一夜";
    } else {
      $("card-note").textContent = "当前环境暂不支持生成分享卡，请截图保存";
    }

    setView("view-ending");
  }

  function render() {
    if (YGEngine.isEnding(YGEngine.state().nodeId)) renderEnding();
    else if (uiPhase === "outcome") { /* outcome stays until advanced */ }
    else if (uiPhase === "intro") renderIntro();
    else renderNode();
  }

  function choose(i) {
    if (locked || !YGEngine.data()) return;
    if (YGEngine.isEnding(YGEngine.state().nodeId)) return;
    locked = true;
    var res = YGEngine.choose(i);
    if (!res) { locked = false; return; }
    if (window.YGAudio) window.YGAudio.choose();
    renderOutcome(res, i);
    window.setTimeout(function () { locked = false; }, 320);
  }

  function advance() {
    if (locked) return;
    locked = true;
    if (window.YGAudio) window.YGAudio.advance();
    if (YGEngine.isEnding(YGEngine.state().nodeId)) renderEnding();
    else renderNode();
    window.setTimeout(function () { locked = false; }, 320);
  }

  function start() {
    YGEngine.reset();
    collected = {};
    renderResources("");
    renderNode();
  }

  function goHome() { renderIntro(); }

  /* ----------------------------- boot ----------------------------- */
  function resolveData() {
    if (typeof D !== "undefined" && D) return D;
    if (window.YGData) return window.YGData;
    return null;
  }

  function boot() {
    var cv = $("stage");
    YGScene.init(cv);

    var data = resolveData();
    YGEngine.init(data);

    $("btn-start").addEventListener("click", function () { if (window.YGAudio) window.YGAudio.unlock(); start(); });
    $("btn-advance").addEventListener("click", advance);
    $("btn-restart").addEventListener("click", function () { if (window.YGAudio) window.YGAudio.unlock(); start(); });
    $("btn-home").addEventListener("click", goHome);
    $("btn-save").addEventListener("click", function () { YGShare.saveAlbum(); });
    $("btn-note").addEventListener("click", function () { YGShare.postNote(); });
    bindGloss("btn-gloss-intro", "intro-gloss");
    bindGloss("btn-gloss-node", "node-gloss");
    bindGloss("btn-gloss-outcome", "outcome-gloss");
    bindGloss("btn-gloss-end", "end-gloss");
    window.addEventListener("resize", function () { YGScene.resize(); });

    if (data) renderIntro(); else setView("view-intro");

    var t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    function frame() {
      var elapsed = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0;
      YGScene.draw(elapsed);
      window.requestAnimationFrame(frame);
    }
    YGScene.draw(0);
    window.requestAnimationFrame(frame);

    /* ---- test / integration hooks ---- */
    window.__game = {
      state: function () { return YGEngine.state(); },
      resources: function () { return YGEngine.resources(); },
      goto: function (nodeId) {
        YGEngine.goto(nodeId);
        render();
        return YGEngine.state();
      },
      choose: function (i) {
        var res = YGEngine.choose(i);
        if (res) renderOutcome(res, i);
        return YGEngine.state();
      },
      reset: function () {
        YGEngine.reset();
        collected = {};
        renderIntro();
        return YGEngine.state();
      },
      advance: advance,
      start: start,
      /* §11.4 objective metrics: frost proportion vs warmth */
      particles: function () { return YGScene.particles(); },
      /* §7 reproducibility: freeze the clock for identical frames */
      setClock: function (ms) { YGScene.setClock(ms); },
      /* §8 share card */
      paintCard: function (st) { return YGShare.paintCard(st || YGShare.lastStats); },
      /* integration: swap in data produced by the prose module */
      loadData: function (obj) {
        YGEngine.init(obj || null);
        collected = {};
        renderIntro();
        return YGEngine.state();
      },
      subject: function () { return YGScene.subject(); },
      lift: function () { return YGScene.lift(); },
      seed: function () { return SEED; },
      walked: function () { return YGEngine.walked(); }
    };

    window.__ready = true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
