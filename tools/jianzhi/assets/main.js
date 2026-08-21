(function () {
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");
  var ctx = stage.getContext("2d");
  var mini = $("preview-mini");
  var miniCtx = mini.getContext("2d");

  var FOLDS = window.FOLDS;
  var TEMPLATES = window.TEMPLATES;
  var FACTS = window.FACTS;
  var PaperModel = window.Paper.PaperModel;
  var R_OFF = window.Paper.R_OFF;
  var HALF = window.Paper.HALF;

  var BRUSH_DISPLAY = [7, 12, 20];

  var state = {
    view: "home",
    foldKey: "eight",
    mode: "free",
    template: null,
    phase: "cut",
    brush: 1,
    peek: false,
    bg: "window"
  };

  var paper = null;
  var engine = null;
  var W = 0, H = 0, dpr = 1;
  var layout = null;
  var stars = [];
  var lastNow = performance.now();
  var pointer = { down: false, x: -999, y: -999, lastOff: null, over: false };

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    stage.width = Math.round(W * dpr);
    stage.height = Math.round(H * dpr);
    computeLayout();
    makeStars();
  }

  function computeLayout() {
    var fold = FOLDS[state.foldKey];
    var half = ((fold.wedge / 2) * Math.PI) / 180;
    var apexY = H - 175;
    var topLimit = apexY - 92;
    var widthLimit = (Math.min(W, 480) / 2 - 20) / Math.tan(half);
    var rDisp = Math.max(110, Math.min(topLimit, widthLimit, H * 0.62));
    layout = {
      apexX: W / 2,
      apexY: apexY,
      rDisp: rDisp,
      cx: W / 2,
      cy: H * 0.42,
      r: Math.min(W * 0.42, H * 0.3)
    };
  }

  function makeStars() {
    stars = [];
    var n = 64;
    for (var i = 0; i < n; i++) {
      var u = Math.sin(i * 127.1) * 43758.5453;
      var v = Math.sin(i * 311.7) * 12543.21;
      stars.push({
        x: (u - Math.floor(u)) * W,
        y: (v - Math.floor(v)) * H * 0.6,
        r: 0.6 + Math.abs((u * 7) % 1) * 1.1
      });
    }
  }

  /* ---------- backgrounds ---------- */

  function drawDesk(c) {
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2c404b");
    g.addColorStop(0.55, "#22333d");
    g.addColorStop(1, "#1a272e");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    var rg = c.createRadialGradient(W / 2, H * 0.18, 0, W / 2, H * 0.18, Math.max(W, H) * 0.8);
    rg.addColorStop(0, "rgba(216,162,74,0.10)");
    rg.addColorStop(1, "rgba(216,162,74,0)");
    c.fillStyle = rg;
    c.fillRect(0, 0, W, H);
  }

  function drawResultBg(c) {
    var i, g;
    if (state.bg === "window") {
      g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#f7ead0");
      g.addColorStop(1, "#ecd8ae");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      c.strokeStyle = "rgba(122,74,44,0.4)";
      c.lineWidth = 7;
      var step = 64;
      for (i = step / 2; i < W; i += step) {
        c.beginPath(); c.moveTo(i, 0); c.lineTo(i, H); c.stroke();
      }
      for (i = step / 2; i < H; i += step) {
        c.beginPath(); c.moveTo(0, i); c.lineTo(W, i); c.stroke();
      }
      var warm = c.createRadialGradient(layout.cx, layout.cy, 0, layout.cx, layout.cy, layout.r * 2.2);
      warm.addColorStop(0, "rgba(255,244,214,0.85)");
      warm.addColorStop(1, "rgba(255,244,214,0)");
      c.fillStyle = warm;
      c.fillRect(0, 0, W, H);
    } else if (state.bg === "paper") {
      g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#a3242a");
      g.addColorStop(1, "#79181d");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      var vg = c.createRadialGradient(W / 2, H * 0.42, H * 0.1, W / 2, H * 0.42, H * 0.85);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.28)");
      c.fillStyle = vg;
      c.fillRect(0, 0, W, H);
    } else {
      g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#101a3e");
      g.addColorStop(0.6, "#1a2650");
      g.addColorStop(1, "#0c1128");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      c.fillStyle = "rgba(255,255,255,0.75)";
      for (i = 0; i < stars.length; i++) {
        c.globalAlpha = 0.3 + ((i * 37) % 10) / 14;
        c.beginPath();
        c.arc(stars[i].x, stars[i].y, stars[i].r, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      c.fillStyle = "#f4ecd8";
      c.beginPath();
      c.arc(W * 0.82, H * 0.13, 24, 0, Math.PI * 2);
      c.fill();
      var moonGlow = c.createRadialGradient(W * 0.82, H * 0.13, 10, W * 0.82, H * 0.13, 90);
      moonGlow.addColorStop(0, "rgba(244,236,216,0.35)");
      moonGlow.addColorStop(1, "rgba(244,236,216,0)");
      c.fillStyle = moonGlow;
      c.fillRect(0, 0, W, H);
      var glow = c.createRadialGradient(layout.cx, layout.cy, layout.r * 0.3, layout.cx, layout.cy, layout.r * 1.9);
      glow.addColorStop(0, "rgba(255,120,80,0.30)");
      glow.addColorStop(1, "rgba(255,120,80,0)");
      c.fillStyle = glow;
      c.fillRect(0, 0, W, H);
    }
  }

  /* ---------- cut scene ---------- */

  function wedgeHalfRad() {
    return ((FOLDS[state.foldKey].wedge / 2) * Math.PI) / 180;
  }

  function inWedge(sx, sy) {
    var lx = sx - layout.apexX;
    var ly = sy - layout.apexY;
    var dist = Math.hypot(lx, ly);
    if (dist > layout.rDisp * 1.04) return false;
    var ang = Math.atan2(lx, -ly);
    return Math.abs(ang) <= wedgeHalfRad() + 0.03;
  }

  function screenToOff(sx, sy) {
    var k = layout.rDisp / R_OFF;
    return [HALF + (sx - layout.apexX) / k, HALF + (sy - layout.apexY) / k];
  }

  function brushRadiusOff() {
    return BRUSH_DISPLAY[state.brush] * (R_OFF / layout.rDisp);
  }

  function drawFoldDecor(c) {
    var half = wedgeHalfRad();
    var ax = layout.apexX, ay = layout.apexY, L = layout.rDisp;
    var fdx = -Math.sin(half), fdy = -Math.cos(half);
    var ox = -Math.cos(half), oy = Math.sin(half);

    c.save();
    c.strokeStyle = "rgba(216,162,74,0.85)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(ax + fdx * (L + 8), ay + fdy * (L + 8));
    c.stroke();

    var offs = [5, 10, 15];
    for (var i = 0; i < offs.length; i++) {
      c.strokeStyle = "rgba(251,246,236," + (0.4 - i * 0.12) + ")";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(ax + fdx * L * 0.28 + ox * offs[i], ay + fdy * L * 0.28 + oy * offs[i]);
      c.lineTo(ax + fdx * L * 0.8 + ox * offs[i], ay + fdy * L * 0.8 + oy * offs[i]);
      c.stroke();
    }

    c.fillStyle = "rgba(216,162,74,0.9)";
    c.font = "12px -apple-system, 'PingFang SC', sans-serif";
    c.textAlign = "center";
    var mx = ax + fdx * L * 0.55 + ox * 30;
    var my = ay + fdy * L * 0.55 + oy * 30;
    c.fillText("×" + FOLDS[state.foldKey].copies + " 层", mx, my);

    c.strokeStyle = "rgba(251,246,236,0.4)";
    c.lineWidth = 1.2;
    c.setLineDash([6, 7]);
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(ax + Math.sin(half) * (L + 8), ay - Math.cos(half) * (L + 8));
    c.stroke();
    c.beginPath();
    c.arc(ax, ay, L, -Math.PI / 2 - half, -Math.PI / 2 + half);
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }

  function drawGuides(c) {
    if (!state.template) return;
    var k = layout.rDisp / R_OFF;
    c.save();
    c.strokeStyle = "rgba(90,74,58,0.4)";
    c.lineWidth = 1.6;
    c.setLineDash([5, 5]);
    state.template.shapes.forEach(function (s) {
      c.beginPath();
      s.pts.forEach(function (p, i) {
        var o = paper.normToOff(p);
        var sx = layout.apexX + (o[0] - HALF) * k;
        var sy = layout.apexY + (o[1] - HALF) * k;
        if (i) c.lineTo(sx, sy); else c.moveTo(sx, sy);
      });
      c.closePath();
      c.stroke();
    });
    c.setLineDash([]);
    c.restore();
  }

  function drawBrushCursor(c) {
    if (state.auto || !pointer.over) return;
    c.save();
    c.strokeStyle = "rgba(216,162,74,0.9)";
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(pointer.x, pointer.y, BRUSH_DISPLAY[state.brush], 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function updateMini() {
    if (!paper.dirty) return;
    paper.dirty = false;
    miniCtx.clearRect(0, 0, mini.width, mini.height);
    paper.renderCopies(miniCtx, mini.width / 2, mini.height / 2, mini.width / 2 - 12, {});
  }

  function drawCutScene(now, dt) {
    drawDesk(ctx);
    updateAuto(now, dt);
    paper.renderCopies(ctx, layout.apexX, layout.apexY, layout.rDisp, { to: 1 });
    drawFoldDecor(ctx);
    if (state.mode === "trace") drawGuides(ctx);
    drawAutoScissors(ctx);
    drawBrushCursor(ctx);
    if (state.peek) updateMini();
  }

  /* ---------- auto cut ---------- */

  function beginAutoCut() {
    var shapes = state.template.shapes.map(function (s) {
      var pts = s.pts.map(function (p) { return paper.normToOff(p); });
      var total = 0;
      var segs = [];
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i];
        var b = pts[(i + 1) % pts.length];
        var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        segs.push({ a: a, b: b, len: len, start: total });
        total += len;
      }
      return { pts: pts, segs: segs, total: total };
    });
    state.auto = { shapes: shapes, si: 0, s: 0, phase: "trace", until: 0, pos: null, speed: 950 };
  }

  function pointAt(sh, s) {
    s = Math.max(0, Math.min(s, sh.total));
    for (var i = 0; i < sh.segs.length; i++) {
      var seg = sh.segs[i];
      if (s <= seg.start + seg.len || i === sh.segs.length - 1) {
        var t = seg.len ? (s - seg.start) / seg.len : 0;
        t = Math.max(0, Math.min(1, t));
        return [seg.a[0] + (seg.b[0] - seg.a[0]) * t, seg.a[1] + (seg.b[1] - seg.a[1]) * t];
      }
    }
    return sh.segs[0].a;
  }

  function updateAuto(now, dt) {
    var a = state.auto;
    if (!a) return;
    if (a.phase === "pause") {
      if (now >= a.until) {
        a.si++;
        a.s = 0;
        if (a.si < a.shapes.length) {
          a.phase = "trace";
        } else {
          a.phase = "end";
          a.until = now + 420;
        }
      }
      return;
    }
    if (a.phase === "end") {
      if (now >= a.until) {
        state.auto = null;
        startUnfold();
      }
      return;
    }
    var sh = a.shapes[a.si];
    var target = Math.min(a.s + a.speed * dt, sh.total);
    var prev = pointAt(sh, a.s);
    var steps = Math.max(1, Math.ceil((target - a.s) / 4));
    for (var i = 1; i <= steps; i++) {
      var ss = a.s + ((target - a.s) * i) / steps;
      var p = pointAt(sh, ss);
      paper.cutLine(prev[0], prev[1], p[0], p[1], 3.5);
      prev = p;
    }
    a.s = target;
    a.pos = pointAt(sh, a.s);
    if (a.s >= sh.total - 0.5) {
      paper.cutPoly(sh.pts);
      a.phase = "pause";
      a.until = now + 210;
      a.pos = null;
    }
  }

  function drawAutoScissors(c) {
    var a = state.auto;
    if (!a || !a.pos) return;
    var k = layout.rDisp / R_OFF;
    var sx = layout.apexX + (a.pos[0] - HALF) * k;
    var sy = layout.apexY + (a.pos[1] - HALF) * k;
    c.save();
    c.fillStyle = "#d8a24a";
    c.beginPath();
    c.arc(sx, sy, 4.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(216,162,74,0.5)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(sx, sy, 11, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  /* ---------- unfold & result ---------- */

  function startUnfold() {
    state.phase = "unfold";
    syncStudioPhase();
    engine = new window.UnfoldEngine.Engine(paper);
    engine.start({
      fromCx: layout.apexX,
      fromCy: layout.apexY,
      fromR: layout.rDisp,
      cx: layout.cx,
      cy: layout.cy,
      r: layout.r
    }, function () {
      state.phase = "result";
      syncStudioPhase();
      $("fact-card").textContent = FACTS[Math.floor(Math.random() * FACTS.length)];
    });
  }

  function resultTint() {
    if (state.bg === "paper") return "#fdfaf2";
    if (state.bg === "night") return "#e8483f";
    return "#cf3438";
  }

  function drawResultScene() {
    drawResultBg(ctx);
    var r = layout.r * 1.06;
    var sg = ctx.createRadialGradient(layout.cx, layout.cy + r * 0.12, r * 0.2, layout.cx, layout.cy + r * 0.12, r * 1.15);
    sg.addColorStop(0, "rgba(0,0,0,0.22)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);
    var src = paper.tinted(resultTint());
    paper.renderCopies(ctx, layout.cx, layout.cy, r, { source: src });
  }

  /* ---------- main loop ---------- */

  var frameErrLogged = false;

  function frame(now) {
    var dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;
    try {
      if (state.view === "studio") {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (state.phase === "cut") {
          drawCutScene(now, dt);
        } else if (state.phase === "unfold") {
          drawDesk(ctx);
          engine.render(ctx, W, H, now);
        } else {
          drawResultScene();
        }
      }
    } catch (err) {
      if (!frameErrLogged) {
        frameErrLogged = true;
        console.error("frame error:", err && err.message);
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- home & template panel ---------- */

  function drawFoldIcon(canvas, fold) {
    var c = canvas.getContext("2d");
    var cx = 34, cy = 60, r = 48;
    var wedge = (fold.wedge * Math.PI) / 180;
    for (var i = 0; i < fold.copies; i++) {
      c.save();
      c.translate(cx, cy);
      c.rotate((i - (fold.copies - 1) / 2) * wedge);
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, r, -Math.PI / 2 - wedge / 2, -Math.PI / 2 + wedge / 2);
      c.closePath();
      c.fillStyle = i % 2 ? "rgba(195,39,43,0.5)" : "rgba(195,39,43,0.88)";
      c.fill();
      c.restore();
    }
  }

  function buildHome() {
    var list = $("fold-list");
    Object.keys(FOLDS).forEach(function (key) {
      var f = FOLDS[key];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fold-btn" + (key === state.foldKey ? " is-on" : "");
      btn.dataset.fold = key;

      var icon = document.createElement("canvas");
      icon.className = "fold-icon";
      icon.width = 68;
      icon.height = 68;
      drawFoldIcon(icon, f);

      var name = document.createElement("span");
      name.className = "fold-name";
      name.textContent = f.name;

      var petal = document.createElement("span");
      petal.className = "fold-petal";
      petal.textContent = f.petals;

      btn.appendChild(icon);
      btn.appendChild(name);
      btn.appendChild(petal);
      btn.addEventListener("click", function () {
        state.foldKey = key;
        var all = list.querySelectorAll(".fold-btn");
        for (var i = 0; i < all.length; i++) {
          all[i].classList.toggle("is-on", all[i].dataset.fold === key);
        }
      });
      list.appendChild(btn);
    });
  }

  function renderTplThumb(canvas, tpl) {
    var model = new PaperModel(FOLDS[tpl.fold]);
    tpl.shapes.forEach(function (s) {
      model.cutPoly(s.pts.map(function (p) { return model.normToOff(p); }));
    });
    var c = canvas.getContext("2d");
    var src = model.tinted("#c3272b");
    model.renderCopies(c, canvas.width / 2, canvas.height / 2, canvas.width / 2 - 14, { source: src });
  }

  function buildTplPanel() {
    var list = $("tpl-list");
    TEMPLATES.forEach(function (tpl) {
      var card = document.createElement("div");
      card.className = "tpl-card";

      var thumb = document.createElement("canvas");
      thumb.className = "tpl-thumb";
      thumb.width = 236;
      thumb.height = 236;
      renderTplThumb(thumb, tpl);

      var name = document.createElement("span");
      name.className = "tpl-name";
      name.textContent = tpl.name;

      var meta = document.createElement("span");
      meta.className = "tpl-meta";
      meta.textContent = tpl.desc;

      var actions = document.createElement("div");
      actions.className = "tpl-actions";
      var traceBtn = document.createElement("button");
      traceBtn.type = "button";
      traceBtn.textContent = "描剪";
      traceBtn.addEventListener("click", function () { startSession("trace", tpl); });
      var autoBtn = document.createElement("button");
      autoBtn.type = "button";
      autoBtn.className = "tpl-auto";
      autoBtn.textContent = "一键成剪";
      autoBtn.addEventListener("click", function () { startSession("auto", tpl); });
      actions.appendChild(traceBtn);
      actions.appendChild(autoBtn);

      card.appendChild(thumb);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  /* ---------- flow ---------- */

  function showView(name) {
    state.view = name;
    $("view-home").classList.toggle("is-active", name === "home");
    $("view-studio").classList.toggle("is-active", name === "studio");
  }

  function titleText() {
    var fold = FOLDS[state.foldKey];
    if (state.mode === "free") return fold.name + " · 自由剪裁";
    if (state.mode === "trace") return state.template.name + " · 描剪";
    return state.template.name + " · 一键成剪";
  }

  function syncStudioPhase() {
    var studio = $("view-studio");
    studio.classList.toggle("phase-cut", state.phase === "cut");
    studio.classList.toggle("phase-unfold", state.phase === "unfold");
    studio.classList.toggle("phase-result", state.phase === "result");
    mini.classList.toggle("is-on", state.peek && state.phase === "cut");
  }

  function startSession(mode, tpl) {
    state.mode = mode;
    state.template = tpl || null;
    if (tpl && tpl.fold !== state.foldKey) state.foldKey = tpl.fold;
    computeLayout();
    paper = new PaperModel(FOLDS[state.foldKey]);
    state.phase = "cut";
    state.auto = null;
    engine = null;
    pointer.down = false;
    $("studio-title").textContent = titleText();
    $("tpl-panel").classList.remove("is-open");
    showView("studio");
    syncStudioPhase();
    if (mode === "auto") beginAutoCut();
  }

  function bindUI() {
    $("btn-free").addEventListener("click", function () { startSession("free", null); });
    $("btn-tpl").addEventListener("click", function () { $("tpl-panel").classList.add("is-open"); });
    $("tpl-close").addEventListener("click", function () { $("tpl-panel").classList.remove("is-open"); });

    $("btn-back").addEventListener("click", function () {
      state.auto = null;
      engine = null;
      showView("home");
    });

    var brushBtns = $("brush-group").querySelectorAll(".brush-btn");
    for (var i = 0; i < brushBtns.length; i++) {
      brushBtns[i].addEventListener("click", function (e) {
        state.brush = parseInt(e.currentTarget.dataset.brush, 10);
        for (var j = 0; j < brushBtns.length; j++) {
          brushBtns[j].classList.toggle("is-on", brushBtns[j] === e.currentTarget);
        }
      });
    }

    $("btn-reset").addEventListener("click", function () {
      if (paper && state.phase === "cut" && !state.auto) paper.reset();
    });

    $("btn-peek").addEventListener("click", function () {
      state.peek = !state.peek;
      $("btn-peek").classList.toggle("is-on", state.peek);
      if (paper) paper.dirty = true;
      syncStudioPhase();
    });

    $("btn-unfold").addEventListener("click", function () {
      if (state.phase === "cut" && !state.auto) startUnfold();
    });

    var swatches = $("bg-swatches").querySelectorAll(".swatch");
    for (var s = 0; s < swatches.length; s++) {
      swatches[s].addEventListener("click", function (e) {
        state.bg = e.currentTarget.dataset.bg;
        for (var j = 0; j < swatches.length; j++) {
          swatches[j].classList.toggle("is-on", swatches[j] === e.currentTarget);
        }
      });
    }

    $("btn-again").addEventListener("click", function () {
      startSession(state.mode, state.template);
    });
    $("btn-home").addEventListener("click", function () { showView("home"); });

    stage.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      if (state.view !== "studio") return;
      if (state.phase === "unfold") {
        if (engine) engine.skip();
        return;
      }
      if (state.phase !== "cut" || state.auto) return;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pointer.down = true;
      var off = screenToOff(e.clientX, e.clientY);
      pointer.lastOff = off;
      paper.cutAt(off[0], off[1], brushRadiusOff());
    });

    stage.addEventListener("pointermove", function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.over = state.phase === "cut" && inWedge(e.clientX, e.clientY);
      if (!pointer.down || state.phase !== "cut" || state.auto) return;
      var off = screenToOff(e.clientX, e.clientY);
      if (pointer.lastOff) {
        paper.cutLine(pointer.lastOff[0], pointer.lastOff[1], off[0], off[1], brushRadiusOff());
      }
      pointer.lastOff = off;
    });

    var endPointer = function () {
      pointer.down = false;
      pointer.lastOff = null;
    };
    stage.addEventListener("pointerup", endPointer);
    stage.addEventListener("pointercancel", endPointer);
    stage.addEventListener("pointerleave", function () { pointer.over = false; });

    window.addEventListener("resize", resize);
  }

  function init() {
    resize();
    buildHome();
    buildTplPanel();
    bindUI();
    requestAnimationFrame(frame);
  }

  init();
})();
