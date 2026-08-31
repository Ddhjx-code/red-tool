(function () {
  var D = window.SZData, B = window.SZBoard, G = window.SZGame, Scene = window.SZScene, Audio = window.SZAudio, Save = window.SZSave;
  var canvas, ctx, ui = { cell: 48, pad: 16 };
  var locked = false;
  var params = new URLSearchParams(location.search);
  var isTest = params.get("test") === "1";
  var isDemo = params.get("demo") === "1";
  var curLevel = 0, curFormation = 0;

  function $(id) { return document.getElementById(id); }
  function level() { return D.levels[curLevel]; }

  function show(id) {
    ["view-home", "view-case", "view-intro", "view-battle", "view-result"].forEach(function (v) {
      $(v).classList.toggle("is-active", v === id);
    });
  }

  function toastTimer() {}
  var _tt = 0;
  function toast(text) {
    var el = $("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(_tt);
    _tt = setTimeout(function () { el.classList.remove("show"); }, 1800);
  }

  function fit() {
    var wrap = document.querySelector(".board-wrap");
    var avail = Math.min(wrap.clientWidth, 480);
    ui.cell = Math.floor((avail - 24) / D.COLS);
    ui.pad = 12;
    var dpr = window.devicePixelRatio || 1;
    var W = ui.pad * 2 + ui.cell * D.COLS;
    var H = ui.pad * 2 + ui.cell * D.ROWS;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function currentUi() {
    var S = G.state();
    var out = { cell: ui.cell, pad: ui.pad, moveCells: null, attackMap: null, igniteCells: null };
    if (!S || !S.selected) return out;
    var u = G.unit(S.selected);
    if (!u) return out;
    if (S.igniteMode) {
      out.igniteCells = G.ignitableCells();
      return out;
    }
    if (u.movedSteps === 0) out.moveCells = B.moveRange(S, u);
    var map = {};
    B.attackables(S, u).forEach(function (v) { map[v.id] = B.damage(S, u, v); });
    out.attackMap = map;
    return out;
  }

  function frame() {
    var S = G.state();
    if (S && $("view-battle").classList.contains("is-active")) {
      Scene.draw(ctx, S, currentUi());
    }
    requestAnimationFrame(frame);
  }

  function showHome() {
    var box = $("museum-intro");
    box.innerHTML = "";
    D.museum.intro.forEach(function (t) {
      var p = document.createElement("p");
      p.textContent = t;
      box.appendChild(p);
    });
    var done = Save.load().stars;
    var n = D.levels.filter(function (lv) { return done[lv.id]; }).length;
    $("home-progress").textContent = "已释读 " + n + " / " + D.levels.length + " 卷";
    Audio.startAmbient();
    show("view-home");
  }

  function showCase() {
    var stars = Save.load().stars;
    var grid = $("case-grid");
    grid.innerHTML = "";
    D.levels.forEach(function (lv, i) {
      var st = stars[lv.id] || 0;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slip" + (st ? " decoded" : "");
      var nm = document.createElement("span");
      nm.className = "slip-name";
      nm.textContent = lv.name;
      var mt = document.createElement("span");
      mt.className = "slip-motto";
      mt.textContent = lv.motto;
      var tag = document.createElement("span");
      tag.className = "slip-status";
      tag.textContent = st ? "已释读 " + "★".repeat(st) : "未释读";
      btn.appendChild(nm);
      btn.appendChild(mt);
      btn.appendChild(tag);
      btn.addEventListener("click", function () { Audio.select(); showIntro(i); });
      grid.appendChild(btn);
    });
    var lost = $("case-lost");
    lost.innerHTML = "";
    D.lostSlips.forEach(function (nm) {
      var s = document.createElement("span");
      s.className = "lost-slip";
      s.textContent = nm;
      lost.appendChild(s);
    });
    var n = D.levels.filter(function (lv) { return stars[lv.id]; }).length;
    $("case-count").textContent = n + "/" + D.levels.length;
    show("view-case");
  }

  function showIntro(idx) {
    curLevel = idx;
    curFormation = 0;
    var lv = level();
    $("intro-order").textContent = "孙子兵法 · 篇" + lv.order + " · " + lv.mechanic;
    $("intro-name").textContent = lv.name;
    $("intro-quote").textContent = lv.quote.text;
    $("intro-src").textContent = lv.quote.src;
    $("intro-vernacular").textContent = "【释义】" + lv.quote.vernacular;
    var brief = $("intro-brief");
    brief.innerHTML = "";
    lv.brief.forEach(function (t, i) {
      var p = document.createElement("p");
      p.textContent = (i + 1) + ". " + t;
      brief.appendChild(p);
    });
    var fbox = $("formation-box");
    var flist = $("formation-list");
    flist.innerHTML = "";
    if (lv.formations) {
      fbox.style.display = "";
      lv.formations.forEach(function (f, fi) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "formation" + (fi === 0 ? " chosen" : "");
        var nm = document.createElement("b");
        nm.textContent = f.name;
        var ds = document.createElement("i");
        ds.textContent = f.desc;
        b.appendChild(nm);
        b.appendChild(ds);
        b.addEventListener("click", function () {
          curFormation = fi;
          Array.prototype.forEach.call(flist.children, function (c, ci) {
            c.classList.toggle("chosen", ci === fi);
          });
          Audio.select();
        });
        flist.appendChild(b);
      });
    } else {
      fbox.style.display = "none";
    }
    show("view-intro");
  }

  function startBattle(idx, formationIdx) {
    curLevel = idx;
    G.start(idx, formationIdx || 0);
    locked = false;
    Audio.stopAmbient();
    var lv = level();
    $("chapter").textContent = lv.name + " · " + lv.motto;
    var hint = "虚线框 = 敌军将移 · 红箭 = 敌军将攻（移开可躲）";
    if (lv.wind) hint = "今日东风：火向东、南北蔓延 · " + hint;
    $("hint").textContent = hint;
    show("view-battle");
    fit();
    updateHud();
  }

  function shakeBoard() {
    var w = document.querySelector(".board-wrap");
    if (!w) return;
    w.classList.remove("shake");
    void w.offsetWidth;
    w.classList.add("shake");
  }

  function updateMenu() {
    var S = G.state();
    var u = S && S.selected ? G.unit(S.selected) : null;
    var undo = $("btn-undo"), wait = $("btn-wait"), cancel = $("btn-cancel"), fire = $("btn-fire");
    var tip = "";
    undo.disabled = wait.disabled = cancel.disabled = true;
    fire.disabled = true;
    fire.classList.remove("armed");
    if (u) {
      if (S.igniteMode) {
        cancel.disabled = false;
        tip = "点选一处相邻茅草引火";
        fire.disabled = false;
        fire.classList.add("armed");
      } else if (u.movedSteps === 0) {
        wait.disabled = cancel.disabled = false;
        tip = "第一步：点浅蓝格移动，或直接点范围内敌军攻击";
      } else {
        undo.disabled = wait.disabled = cancel.disabled = false;
        tip = "第二步：点红圈敌军攻击（数字=伤害），或点「待命」";
      }
      if (!S.fireUsed && !S.igniteMode && G.ignitableCells().length) fire.disabled = false;
    }
    $("menu-tip").textContent = tip;
  }

  function updateHud() {
    var S = G.state();
    var lv = level();
    var left = lv.turnLimit - S.turn + 1;
    $("turninfo").textContent = "第 " + S.turn + "/" + lv.turnLimit + " 回合";
    $("turninfo").classList.toggle("urgent", left <= 2);
    var info = "点选一枚己方棋子开始行动";
    if (S.selected) {
      var u = G.unit(S.selected);
      var t = D.types[u.type];
      info = t.name + " · 血 " + u.hp + "/" + t.hp + " · 攻 " + t.atk + " · 移 " + t.move + " · 程 " + t.range;
      if (t.charge) info += " · 移动2格后攻击+" + t.charge;
    }
    $("unit-info").textContent = info;
    $("hint").style.visibility = S.turn <= 2 ? "visible" : "hidden";
    updateMenu();
  }

  function endTurnSequence() {
    if (locked) return;
    var S = G.state();
    if (!S || S.phase !== "player") return;
    locked = true;
    G.select(null);
    updateHud();
    var events = G.endTurn();
    var delay = 0;
    var anyHit = false;
    events.forEach(function (ev) {
      delay += 200;
      setTimeout(function () {
        if (ev.type === "ehit") { Audio.hit(); anyHit = true; shakeBoard(); }
        else if (ev.type === "burn") { Audio.fire(); shakeBoard(); }
        else if (ev.type === "miss") Audio.miss();
        else if (ev.type === "spawn") { Audio.drum(); toast("敌军重甲增援抵达！"); }
        else if (ev.type === "surrender") { Audio.surrender(); toast("敌军士气崩溃，卸甲归降！"); }
      }, delay);
    });
    Audio.drum();
    setTimeout(function () {
      var S2 = G.state();
      if (S2.phase === "win" || S2.phase === "lose") { showResult(); return; }
      locked = false;
      updateHud();
    }, Math.max(700, delay + 300));
  }

  function showResult() {
    var res = G.result();
    var lv = level();
    var win = res.phase === "win";
    if (win) Save.recordStars(lv.id, res.stars);
    $("result-kicker").textContent = "战棋演武 · " + lv.name;
    var title = win ? "克敌制胜" : (res.reason === "timeout" ? "战机已失" : "兵败如山");
    $("result-title").textContent = title;
    $("result-stars").textContent = win ? "★".repeat(res.stars) + "☆".repeat(3 - res.stars) : "";
    var sub;
    if (win) {
      sub = "用时 " + res.turn + " 回合 · 折损 " + res.lost.length + " 员";
      if (res.surrendered.length) sub += " · 受降 " + res.surrendered.length + " 员";
    } else if (res.reason === "timeout") {
      sub = lv.turnLimit + " 回合未破中军 · 敌主力已至，只得退兵";
    } else {
      sub = "全军覆没 · 再演一局";
    }
    $("result-turns").textContent = sub;
    $("result-quote").textContent = lv.quote.text;
    $("result-src").textContent = lv.quote.src;
    var know = $("result-know");
    know.innerHTML = "";
    lv.knowledge.forEach(function (k) {
      var p = document.createElement("p");
      p.textContent = k;
      know.appendChild(p);
    });
    $("btn-next-result").style.display = (win && curLevel < D.levels.length - 1) ? "" : "none";
    var stars = Save.load().stars;
    var decoded = D.levels.filter(function (l) { return stars[l.id]; }).length;
    window.SZShare.lastStats = {
      chapterName: lv.name,
      motto: lv.motto,
      title: title,
      win: win,
      stars: res.stars,
      statsLine: sub,
      quoteText: lv.quote.text,
      quoteSrc: lv.quote.src,
      decoded: decoded,
      total: D.levels.length
    };
    if (win) Audio.win(); else Audio.lose();
    show("view-result");
  }

  function onTap(e) {
    if (locked) return;
    var S = G.state();
    if (!S || S.phase !== "player") return;
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left - ui.pad;
    var y = e.clientY - rect.top - ui.pad;
    var c = Math.floor(x / ui.cell), r = Math.floor(y / ui.cell);
    if (!B.inBounds(c, r)) { S.igniteMode = false; G.select(null); updateHud(); return; }
    if (S.igniteMode) {
      if (G.ignite(c, r)) {
        Audio.hit();
        toast("火起！顺风蔓延");
        afterAction();
      } else {
        S.igniteMode = false;
        updateHud();
      }
      return;
    }
    var hit = B.unitAt(S.units, c, r);
    if (hit && hit.side === "P" && !hit.done) {
      G.select(hit.id);
      Audio.select();
      updateHud();
      return;
    }
    if (!S.selected) return;
    var u = G.unit(S.selected);
    if (hit && hit.side === "E") {
      var targets = B.attackables(S, u);
      var ok = targets.some(function (v) { return v.id === hit.id; });
      if (ok) {
        var ranged = D.types[u.type].range > 1;
        if (G.attack(hit.id)) {
          if (ranged) Audio.shoot(); else Audio.hit();
          afterAction();
        }
        return;
      }
      toast("距离不够：" + D.types[u.type].name + "攻击距离 " + D.types[u.type].range + " 格");
      return;
    }
    if (!hit && u.movedSteps === 0) {
      if (G.move(c, r)) {
        Audio.move();
        updateHud();
        return;
      }
      toast("走不到那里：" + D.types[u.type].name + "最多移动 " + D.types[u.type].move + " 格");
      return;
    }
    G.select(null);
    updateHud();
  }

  function afterAction() {
    updateHud();
    if (G.state().phase !== "player") { setTimeout(showResult, 600); return; }
    if (G.allDone()) setTimeout(endTurnSequence, 350);
  }

  var DEMO = [
    { act: "sel", id: "p1" }, { act: "move", c: 3, r: 4 }, { act: "wait" },
    { act: "sel", id: "p3" }, { act: "move", c: 1, r: 4 }, { act: "wait" },
    { act: "sel", id: "p2" }, { act: "wait" },
    { act: "pause" },
    { act: "sel", id: "p1" }, { act: "move", c: 3, r: 6 }, { act: "wait" },
    { act: "sel", id: "p3" }, { act: "move", c: 1, r: 1 }, { act: "wait" },
    { act: "sel", id: "p2" }, { act: "wait" },
    { act: "pause" },
    { act: "sel", id: "p3" }, { act: "move", c: 2, r: 0 },
    { act: "attack", id: "e5" }
  ];

  function runDemo(i) {
    if (i >= DEMO.length) return;
    var op = DEMO[i];
    var S = G.state();
    if (S.phase !== "player") { setTimeout(function () { runDemo(i); }, 500); return; }
    if (op.act === "pause") {
      if (locked) { setTimeout(function () { runDemo(i); }, 400); return; }
      if (G.allDone()) { endTurnSequence(); }
      setTimeout(function () { runDemo(i + 1); }, 1400);
      return;
    }
    if (locked) { setTimeout(function () { runDemo(i); }, 400); return; }
    if (op.act === "sel") { G.select(op.id); Audio.select(); }
    if (op.act === "move") { if (G.move(op.c, op.r)) Audio.move(); }
    if (op.act === "wait") G.waitUnit();
    if (op.act === "attack") { if (G.attack(op.id)) Audio.hit(); afterAction(); }
    updateHud();
    setTimeout(function () { runDemo(i + 1); }, op.act === "sel" ? 450 : 700);
  }

  function init() {
    canvas = $("stage");
    ctx = canvas.getContext("2d");
    window.addEventListener("resize", function () { if ($("view-battle").classList.contains("is-active")) fit(); });
    canvas.addEventListener("pointerdown", onTap);

    $("btn-to-case").addEventListener("click", function () { Audio.unlock(); showCase(); });
    $("btn-case-home").addEventListener("click", function () { showHome(); });
    $("btn-intro-back").addEventListener("click", function () { showCase(); });
    $("btn-deploy").addEventListener("click", function () { Audio.unlock(); startBattle(curLevel, curFormation); });
    $("btn-again-result").addEventListener("click", function () { startBattle(curLevel, curFormation); });
    $("btn-next-result").addEventListener("click", function () { showIntro(curLevel + 1); });
    $("btn-case-result").addEventListener("click", function () { showCase(); });
    $("btn-save-album").addEventListener("click", function () { window.SZShare.saveAlbum(); });
    $("btn-post-note").addEventListener("click", function () { window.SZShare.postNote(); });
    $("btn-restart").addEventListener("click", function () { startBattle(curLevel, curFormation); });
    $("btn-home-battle").addEventListener("click", function () { showCase(); });

    $("btn-wait").addEventListener("click", function () {
      if (locked) return;
      if (G.waitUnit()) { Audio.move(); afterAction(); }
    });
    $("btn-undo").addEventListener("click", function () {
      if (locked) return;
      if (G.undoMove()) { Audio.move(); updateHud(); }
    });
    $("btn-cancel").addEventListener("click", function () {
      if (locked) return;
      var S = G.state();
      if (S) S.igniteMode = false;
      G.select(null);
      updateHud();
    });
    $("btn-fire").addEventListener("click", function () {
      if (locked) return;
      var S = G.state();
      if (!S || !S.selected) return;
      if (S.igniteMode) { S.igniteMode = false; updateHud(); return; }
      if (!G.ignitableCells().length) { toast("需贴近茅草才能引火"); return; }
      S.igniteMode = true;
      Audio.select();
      updateHud();
    });
    $("btn-endturn").addEventListener("click", function () {
      if (locked) return;
      var S = G.state();
      if (S && S.phase === "player") endTurnSequence();
    });

    requestAnimationFrame(frame);

    if (isTest) {
      startBattle(3, 0);
    } else if (isDemo) {
      startBattle(3, 0);
      setTimeout(function () { runDemo(0); }, 800);
    } else {
      showHome();
    }

    window.__game = {
      start: G.start,
      snapshot: G.snapshot,
      select: G.select,
      move: G.move,
      attack: G.attack,
      wait: G.waitUnit,
      undo: G.undoMove,
      ignite: G.ignite,
      ignitableCells: G.ignitableCells,
      endTurn: G.endTurn,
      result: G.result,
      state: G.state,
      moveRange: function (id) { return B.moveRange(G.state(), G.unit(id)); },
      damage: function (a, d) { return B.damage(G.state(), a, d); },
      unit: G.unit
    };
    window.__ready = true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
