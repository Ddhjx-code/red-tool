(function () {
  var canvas = document.getElementById("mural-canvas");
  var fxCtx = canvas.getContext("2d");
  var toastEl = document.getElementById("extract-toast");
  var paletteBar = document.getElementById("palette-bar");
  var muralList = document.getElementById("mural-list");
  var homeProgress = document.getElementById("home-progress");
  var codexGrid = document.getElementById("codex-grid");
  var codexCountEl = document.getElementById("codex-count");
  var codexCard = document.getElementById("codex-card");
  var cardName = document.getElementById("codex-card-name");
  var cardText = document.getElementById("codex-card-text");
  var cardCanvas = document.getElementById("codex-canvas");
  var curView = "view-home";
  var codexOrigin = "home";
  var last = 0, dustAcc = 0;
  var lastPaletteKey = null;
  var down = null;
  var colorMap = {};
  var i;
  var buildSel = { colors: [], layout: "scroll", bg: "paper", title: DHData.TITLES[0] };
  var buildPreviewEl = document.getElementById("build-preview");
  var colorChipsEl = document.getElementById("color-chips");
  var layoutOptsEl = document.getElementById("layout-opts");
  var bgOptsEl = document.getElementById("bg-opts");
  var titleOptsEl = document.getElementById("title-opts");
  var resultCardEl = document.getElementById("result-card");
  var chipEls = [];
  var previewToken = 0;
  var muteBtn = document.getElementById("btn-mute-home");
  var extractCount = 0;
  var lastBrushSnd = 0;
  var tutorialDone = false, tutorialOn = false, tutorialTimers = [];

  for (i = 0; i < DHData.COLORS.length; i++) colorMap[DHData.COLORS[i].id] = DHData.COLORS[i];

  DHMural.init(canvas);

  function setView(id) {
    var views = document.querySelectorAll(".view"), j;
    for (j = 0; j < views.length; j++) {
      views[j].classList.toggle("is-active", views[j].id === id);
    }
    curView = id;
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function refreshHomeProgress() {
    var o = DHSave.load();
    homeProgress.textContent = "已集 " + o.codex.length + "/18 色 · 成卡 " + o.cards + " 张";
  }

  function showTutorialHint(text, dur, next) {
    toastEl.textContent = text;
    toastEl.classList.add("is-on");
    tutorialTimers.push(setTimeout(function () {
      if (next) { next(); } else { toastEl.classList.remove("is-on"); tutorialOn = false; }
    }, dur));
  }

  function maybeTutorial() {
    if (tutorialDone || tutorialOn) return;
    var o = DHSave.load();
    if (o.codex.length > 0 || o.cards > 0) return;
    tutorialDone = true;
    tutorialOn = true;
    showTutorialHint("点按色块，拾取矿物色", 3000, function () {
      showTutorialHint("有些色藏着、有些蒙着尘", 3000, null);
    });
  }

  function showExtract() {
    setView("view-extract");
    requestAnimationFrame(function () { DHMural.resize(); });
    maybeTutorial();
  }

  function roundRectPath(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
  }

  function drawSwatch(g, hex, size, r) {
    var m = 10;
    g.clearRect(0, 0, size, size);
    roundRectPath(g, m, m, size - m * 2, size - m * 2, r);
    g.fillStyle = hex;
    g.fill();
    g.strokeStyle = "#425066";
    g.lineWidth = 3;
    g.stroke();
  }

  function makeThumb(id) {
    var cv = document.createElement("canvas");
    var a, b, met, dpr, tctx;
    cv.width = 120;
    cv.height = 120;
    cv.className = "mural-thumb";
    DHMural.load(id);
    DHMural.draw(0);
    a = DHMural.designToCanvas(0, 0);
    b = DHMural.designToCanvas(100, 100);
    met = DHMural.metrics();
    dpr = met.W > 0 ? canvas.width / met.W : 1;
    tctx = cv.getContext("2d");
    tctx.drawImage(canvas,
      a.x * dpr, a.y * dpr, (b.x - a.x) * dpr, (b.y - a.y) * dpr,
      0, 0, 120, 120);
    return cv;
  }

  function buildMuralList() {
    clearChildren(muralList);
    var sv = DHSave.load(), un = {}, j, k;
    for (j = 0; j < sv.codex.length; j++) un[sv.codex[j]] = true;
    for (j = 0; j < DHData.MURALS.length; j++) {
      (function (m) {
        var shapes = DHData.SHAPES[m.id] || [];
        var got = 0;
        for (k = 0; k < shapes.length; k++) {
          if (un[shapes[k].color]) got++;
        }
        var card = document.createElement("button");
        card.className = "mural-card";
        card.type = "button";
        card.appendChild(makeThumb(m.id));
        var info = document.createElement("div");
        info.className = "mural-card-info";
        var nm = document.createElement("div");
        nm.className = "mural-card-name";
        nm.textContent = m.name;
        var era = document.createElement("div");
        era.className = "mural-card-era";
        era.textContent = m.era;
        var prog = document.createElement("div");
        prog.className = "mural-card-progress";
        prog.textContent = got + "/" + shapes.length;
        info.appendChild(nm);
        info.appendChild(era);
        info.appendChild(prog);
        card.appendChild(info);
        card.style.animationDelay = (j * 0.06) + "s";
        card.addEventListener("click", function () {
          DHExtract.start(m.id);
          showExtract();
        });
        muralList.appendChild(card);
      })(DHData.MURALS[j]);
    }
  }

  function renderPalette() {
    var ids = DHExtract.palette(), key = ids.join(","), j, d, col;
    if (key === lastPaletteKey) return;
    lastPaletteKey = key;
    clearChildren(paletteBar);
    for (j = 0; j < ids.length; j++) {
      col = colorMap[ids[j]];
      d = document.createElement("span");
      d.className = "palette-dot";
      d.style.background = col ? col.hex : "#888888";
      paletteBar.appendChild(d);
    }
  }

  function renderToast() {
    var ts;
    if (tutorialOn) return;
    ts = DHExtract.toastState();
    if (ts.on) {
      if (toastEl.textContent !== ts.text) toastEl.textContent = ts.text;
      toastEl.classList.add("is-on");
    } else {
      toastEl.classList.remove("is-on");
    }
  }

  function buildCodex() {
    clearChildren(codexGrid);
    var sv = DHSave.load(), un = {}, j, n = 0;
    for (j = 0; j < sv.codex.length; j++) un[sv.codex[j]] = true;
    for (j = 0; j < DHData.COLORS.length; j++) {
      (function (col) {
        var isOpen = !!un[col.id];
        if (isOpen) n++;
        var cell = document.createElement("div");
        cell.className = "codex-cell" + (isOpen ? "" : " is-locked");
        var cv = document.createElement("canvas");
        cv.width = 120;
        cv.height = 120;
        cell.appendChild(cv);
        var nm = document.createElement("div");
        nm.className = "codex-cell-name";
        if (isOpen) {
          drawSwatch(cv.getContext("2d"), col.hex, 120, 16);
          nm.textContent = col.name;
          cell.addEventListener("click", function () { openCodexCard(col); });
        }
        cell.appendChild(nm);
        codexGrid.appendChild(cell);
      })(DHData.COLORS[j]);
    }
    codexCountEl.textContent = n + "/" + DHData.COLORS.length;
  }

  function openCodexCard(col) {
    var hx;
    drawSwatch(cardCanvas.getContext("2d"), col.hex, 120, 18);
    clearChildren(cardName);
    cardName.appendChild(document.createTextNode(col.name));
    hx = document.createElement("small");
    hx.className = "codex-hex";
    hx.textContent = col.hex;
    cardName.appendChild(hx);
    cardText.textContent = col.text;
    codexCard.classList.add("is-on");
  }

  function showCodex(origin) {
    codexOrigin = (origin === "extract") ? "extract" : "home";
    codexCard.classList.remove("is-on");
    buildCodex();
    setView("view-codex");
  }

  function hideCodex() {
    codexCard.classList.remove("is-on");
    if (codexOrigin === "extract") {
      showExtract();
    } else {
      setView("view-home");
      refreshHomeProgress();
    }
  }

  function buildSource() {
    var mid = DHExtract.snapshot().muralId, j, m = null;
    for (j = 0; j < DHData.MURALS.length; j++) {
      if (DHData.MURALS[j].id === mid) { m = DHData.MURALS[j]; break; }
    }
    return m ? ("莫高窟 · " + m.name + " · " + m.era) : "敦煌 · 矿物五色";
  }

  function buildOpts() {
    var cols = [], j, c;
    for (j = 0; j < buildSel.colors.length; j++) {
      c = colorMap[buildSel.colors[j]];
      if (c) cols.push({ name: c.name, hex: c.hex });
    }
    return { colors: cols, layout: buildSel.layout, bg: buildSel.bg, title: buildSel.title, source: buildSource() };
  }

  function paintInto(cv, url) {
    var img = new Image();
    img.onload = function () {
      var g = cv.getContext("2d");
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
    };
    img.src = url;
  }

  function renderPreview() {
    var url = DHCard.paint(buildOpts());
    var tk = ++previewToken;
    var img = new Image();
    img.onload = function () {
      var g;
      if (tk !== previewToken) return;
      g = buildPreviewEl.getContext("2d");
      g.clearRect(0, 0, buildPreviewEl.width, buildPreviewEl.height);
      g.drawImage(img, 0, 0, buildPreviewEl.width, buildPreviewEl.height);
      buildPreviewEl.classList.remove("preview-settle");
      void buildPreviewEl.offsetWidth;
      buildPreviewEl.classList.add("preview-settle");
    };
    img.src = url;
  }

  function syncChips() {
    var j;
    for (j = 0; j < chipEls.length; j++) {
      chipEls[j].classList.toggle("is-on", buildSel.colors.indexOf(chipEls[j].dataset.id) >= 0);
    }
  }

  function toggleBuildColor(id) {
    var ix = buildSel.colors.indexOf(id);
    if (ix >= 0) {
      if (buildSel.colors.length <= 3) return;
      buildSel.colors.splice(ix, 1);
    } else {
      if (buildSel.colors.length >= 6) return;
      buildSel.colors.push(id);
    }
    syncChips();
    renderPreview();
  }

  function buildChips() {
    var ids = DHExtract.palette(), j, col, b;
    clearChildren(colorChipsEl);
    chipEls = [];
    buildSel.colors = ids.slice(0, 5);
    for (j = 0; j < ids.length; j++) {
      col = colorMap[ids[j]];
      if (!col) continue;
      b = document.createElement("button");
      b.type = "button";
      b.className = "color-chip";
      b.dataset.id = col.id;
      b.title = col.name;
      b.style.background = col.hex;
      b.addEventListener("click", function (cid) {
        return function () { toggleBuildColor(cid); };
      }(col.id));
      colorChipsEl.appendChild(b);
      chipEls.push(b);
    }
    syncChips();
  }

  function syncPills() {
    var rows = [[layoutOptsEl, buildSel.layout], [bgOptsEl, buildSel.bg], [titleOptsEl, buildSel.title]];
    var j, k, kids;
    for (j = 0; j < rows.length; j++) {
      kids = rows[j][0].children;
      for (k = 0; k < kids.length; k++) {
        kids[k].classList.toggle("is-on", kids[k].dataset.v === rows[j][1]);
      }
    }
  }

  function makePill(container, value, label, swHex, onPick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "opt-pill";
    b.dataset.v = value;
    if (swHex) {
      var s = document.createElement("span");
      s.className = "bg-sw";
      s.style.background = swHex;
      b.appendChild(s);
    }
    b.appendChild(document.createTextNode(label));
    b.addEventListener("click", function () {
      onPick(value);
      syncPills();
      renderPreview();
    });
    container.appendChild(b);
  }

  function buildPills() {
    var j;
    makePill(layoutOptsEl, "scroll", "立轴色谱", null, function (v) { buildSel.layout = v; });
    makePill(layoutOptsEl, "zaojing", "藻井", null, function (v) { buildSel.layout = v; });
    makePill(bgOptsEl, "paper", "宣纸", "#F5F0E6", function (v) { buildSel.bg = v; });
    makePill(bgOptsEl, "silk", "绢本", "#EFE6D2", function (v) { buildSel.bg = v; });
    makePill(bgOptsEl, "night", "夜空", "#2E3D52", function (v) { buildSel.bg = v; });
    for (j = 0; j < DHData.TITLES.length; j++) {
      makePill(titleOptsEl, DHData.TITLES[j], DHData.TITLES[j], null, function (v) { buildSel.title = v; });
    }
  }

  function showBuild() {
    buildChips();
    syncPills();
    setView("view-build");
    renderPreview();
  }

  function evPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener("pointerdown", function (e) {
    var p = evPos(e);
    if (window.DHSound) window.DHSound.unlock();
    down = { x: p.x, y: p.y, lx: p.x, ly: p.y, moved: 0 };
  });

  canvas.addEventListener("pointermove", function (e) {
    var p, dx, dy, dist, steps, j, now;
    if (!down) return;
    p = evPos(e);
    dx = p.x - down.lx;
    dy = p.y - down.ly;
    dist = Math.sqrt(dx * dx + dy * dy);
    down.moved += dist;
    steps = Math.max(1, Math.floor(dist / 6));
    for (j = 1; j <= steps; j++) {
      DHMural.dustAt(down.lx + dx * j / steps, down.ly + dy * j / steps);
    }
    now = Date.now();
    if (window.DHSound && now - lastBrushSnd >= 250) {
      lastBrushSnd = now;
      window.DHSound.brush();
    }
    down.lx = p.x;
    down.ly = p.y;
  });

  canvas.addEventListener("pointerup", function (e) {
    var p;
    if (!down) return;
    p = evPos(e);
    if (down.moved < 12) DHExtract.tap(p.x, p.y);
    down = null;
  });

  canvas.addEventListener("pointercancel", function () { down = null; });

  document.getElementById("btn-start").addEventListener("click", function () {
    buildMuralList();
    setView("view-select");
  });

  document.getElementById("btn-codex-home").addEventListener("click", function () {
    showCodex("home");
  });

  document.getElementById("btn-back-select").addEventListener("click", function () {
    buildMuralList();
    setView("view-select");
  });

  document.getElementById("btn-build").addEventListener("click", function () {
    if (!DHSave.codexCount()) {
      DHExtract.toast("先去拾色");
      return;
    }
    showBuild();
  });

  document.getElementById("btn-codex-extract").addEventListener("click", function () {
    showCodex("extract");
  });

  document.getElementById("btn-codex-back").addEventListener("click", function () {
    hideCodex();
  });

  document.getElementById("codex-card-close").addEventListener("click", function () {
    codexCard.classList.remove("is-on");
  });

  document.getElementById("btn-back-extract").addEventListener("click", function () {
    showExtract();
  });

  document.getElementById("btn-make-card").addEventListener("click", function () {
    var opts = buildOpts();
    var dataUrl = DHCard.paint(opts);
    var o = DHSave.load();
    window.DHLastBuild = opts;
    o.cards += 1;
    o.lastBuild = opts;
    DHSave.save(o);
    if (window.DHShare) {
      window.DHShare.lastStats = {
        dataUrl: dataUrl,
        title: window.DHShare.makeTitle(opts.colors.length),
        content: "拾取千年矿物色，拼一张敦煌色卡。",
        tags: "#国风vibecoding #敦煌 #敦煌色卡 #非遗 #国风 #中式美学",
        colorCount: opts.colors.length
      };
    }
    setView("view-result");
    paintInto(resultCardEl, dataUrl);
    resultCardEl.classList.remove("stamp-in");
    void resultCardEl.offsetWidth;
    resultCardEl.classList.add("stamp-in");
    if (window.DHSound) {
      window.DHSound.card();
      setTimeout(function () { if (window.DHSound) window.DHSound.stamp(); }, 200);
    }
  });

  document.getElementById("btn-save-album").addEventListener("click", function () {
    if (window.DHShare) window.DHShare.saveAlbum();
  });

  document.getElementById("btn-post-note").addEventListener("click", function () {
    if (window.DHShare) window.DHShare.postNote();
  });

  document.getElementById("btn-again").addEventListener("click", function () {
    setView("view-build");
    syncChips();
    renderPreview();
  });

  document.getElementById("btn-home-result").addEventListener("click", function () {
    setView("view-home");
    refreshHomeProgress();
  });

  function renderMute() {
    if (!muteBtn) return;
    var m = window.DHSound && window.DHSound.isMuted();
    muteBtn.textContent = m ? "静" : "声";
    muteBtn.classList.toggle("is-muted", !!m);
  }

  muteBtn.addEventListener("click", function () {
    if (!window.DHSound) return;
    window.DHSound.unlock();
    window.DHSound.setMuted(!window.DHSound.isMuted());
    renderMute();
  });

  DHExtract.setCallback("collected", function (p) {
    extractCount++;
    if (!window.DHSound) return;
    window.DHSound.chime(extractCount);
    if (p && p.hidden) window.DHSound.hidden();
  });

  function paintHomeZaojing() {
    var home = document.getElementById("view-home");
    var cv = document.createElement("canvas");
    var S = 210, sizes = [190, 142, 100, 68, 44], g, j;
    cv.width = S;
    cv.height = S;
    cv.className = "home-zaojing";
    g = cv.getContext("2d");
    g.strokeStyle = "#425066";
    g.lineWidth = 4;
    for (j = 0; j < sizes.length; j++) {
      g.save();
      g.translate(S / 2, S / 2);
      if (j % 2 === 1) g.rotate(Math.PI / 4);
      g.strokeRect(-sizes[j] / 2, -sizes[j] / 2, sizes[j], sizes[j]);
      g.restore();
    }
    g.fillStyle = "#C3272B";
    g.beginPath();
    g.arc(S / 2, S / 2, 14, 0, Math.PI * 2);
    g.fill();
    home.appendChild(cv);
  }

  function frame(t) {
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    if (curView === "view-extract") {
      DHExtract.update(dt);
      DHMural.draw(dt);
      DHExtract.drawFx(fxCtx);
      dustAcc += dt;
      if (dustAcc >= 0.15) {
        dustAcc = 0;
        DHExtract.checkDust();
      }
      renderPalette();
      renderToast();
    }
    requestAnimationFrame(frame);
  }

  var demoMode = /[?&]demo=1/.test(location.search);
  var demoTimer = null;
  var demoMuralIx = 0;
  var demoWipe = null;

  function demoSchedule(fn, delay) {
    if (demoTimer) clearTimeout(demoTimer);
    demoTimer = setTimeout(function () {
      demoTimer = null;
      if (demoMode) fn();
    }, delay);
  }

  function demoBBox(s) {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, j, p, pad;
    if (s.dustBBox) {
      return { minX: s.dustBBox.minX, minY: s.dustBBox.minY, maxX: s.dustBBox.maxX, maxY: s.dustBBox.maxY };
    }
    if (s.kind === "circle") {
      minX = s.cx - s.r; maxX = s.cx + s.r;
      minY = s.cy - s.r; maxY = s.cy + s.r;
    } else {
      for (j = 0; j < s.pts.length; j++) {
        p = s.pts[j];
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
      pad = (s.w || 0) / 2 + 1;
      minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function demoWipePath(s, pass) {
    var bb = demoBBox(s), pts = [], rowN = 8, colN = 8, r, c, y, x0, x1, t, off;
    off = (pass % 2) * 0.5;
    for (r = 0; r < rowN; r++) {
      y = bb.minY + (bb.maxY - bb.minY) * (r + 0.5 + off) / rowN;
      x0 = bb.minX; x1 = bb.maxX;
      if (r % 2 === 1) { t = x0; x0 = x1; x1 = t; }
      for (c = 0; c < colN; c++) {
        pts.push([x0 + (x1 - x0) * c / (colN - 1), y]);
      }
    }
    return pts;
  }

  function demoWipeTick(s) {
    var k, q, p, prog, wrapped = false;
    if (!demoWipe || demoWipe.id !== s.id) {
      demoWipe = { id: s.id, pass: 0, pts: demoWipePath(s, 0), i: 0 };
    }
    for (k = 0; k < 8; k++) {
      if (demoWipe.i >= demoWipe.pts.length) { demoWipe.i = 0; wrapped = true; }
      q = demoWipe.pts[demoWipe.i];
      p = DHMural.designToCanvas(q[0], q[1]);
      DHMural.dustAt(p.x, p.y);
      demoWipe.i++;
    }
    prog = DHMural.dustProgress(s.id);
    if (prog >= DHData.DUST_DONE && (prog >= 0.985 || demoWipe.pass >= 2)) {
      demoWipe = null;
      demoSchedule(demoExtractTick, 400);
      return;
    }
    if (wrapped) {
      demoWipe.pass++;
      if (demoWipe.pass >= 3) {
        demoWipe = null;
        demoSchedule(demoExtractTick, 400);
        return;
      }
      demoWipe.pts = demoWipePath(s, demoWipe.pass);
      demoWipe.i = 0;
    }
    demoSchedule(function () { demoWipeTick(s); }, 55);
  }

  function demoTapPoint(s) {
    var cands = [], cx = 0, cy = 0, pts, j, q, h, p;
    if (s.kind === "circle") {
      cands.push([s.cx, s.cy]);
      cands.push([s.cx + s.r * 0.45, s.cy]);
      cands.push([s.cx - s.r * 0.45, s.cy]);
      cands.push([s.cx, s.cy + s.r * 0.45]);
      cands.push([s.cx, s.cy - s.r * 0.45]);
    } else {
      pts = s.pts;
      for (j = 0; j < pts.length; j++) { cx += pts[j][0]; cy += pts[j][1]; }
      cx /= pts.length; cy /= pts.length;
      cands.push([cx, cy]);
      cands.push([(cx + pts[0][0]) / 2, (cy + pts[0][1]) / 2]);
      for (j = 0; j < pts.length; j++) {
        cands.push([cx * 0.25 + pts[j][0] * 0.75, cy * 0.25 + pts[j][1] * 0.75]);
      }
      for (j = 0; j < pts.length; j++) {
        q = pts[(j + 1) % pts.length];
        cands.push([(pts[j][0] + q[0]) / 2 * 0.9 + cx * 0.1, (pts[j][1] + q[1]) / 2 * 0.9 + cy * 0.1]);
      }
      for (j = 0; j < pts.length; j++) cands.push(pts[j]);
    }
    for (j = 0; j < cands.length; j++) {
      p = DHMural.designToCanvas(cands[j][0], cands[j][1]);
      h = DHMural.hitTest(p.x, p.y);
      if (h && h.id === s.id) return p;
    }
    return DHMural.designToCanvas(cands[0][0], cands[0][1]);
  }

  function demoTapLoop(ix) {
    var snap = DHExtract.snapshot(), shapes, s, p;
    if (!snap.muralId) return;
    if (snap.extractedCount >= snap.totalCount) {
      demoSchedule(demoFinishMural, 1500);
      return;
    }
    shapes = DHData.SHAPES[snap.muralId] || [];
    while (ix < shapes.length && shapes[ix].dusty) ix++;
    if (ix >= shapes.length) {
      demoSchedule(function () { demoTapLoop(0); }, 400);
      return;
    }
    s = shapes[ix];
    p = demoTapPoint(s);
    if (DHMural.dustAtPoint(p.x, p.y)) DHMural.dustAt(p.x, p.y);
    DHExtract.tap(p.x, p.y);
    demoSchedule(function () { demoTapLoop(ix + 1); }, 700);
  }

  function demoExtractTick() {
    var snap = DHExtract.snapshot(), shapes, j, s;
    if (!snap.muralId) return;
    if (snap.extractedCount >= snap.totalCount) {
      demoSchedule(demoFinishMural, 1500);
      return;
    }
    shapes = DHData.SHAPES[snap.muralId] || [];
    for (j = 0; j < shapes.length; j++) {
      s = shapes[j];
      if (s.dusty && DHMural.dustProgress(s.id) < DHData.DUST_DONE) {
        demoWipeTick(s);
        return;
      }
    }
    demoTapLoop(0);
  }

  function demoFinishMural() {
    showBuild();
    demoSchedule(function () {
      document.getElementById("btn-make-card").click();
      demoSchedule(demoNextMural, 3000);
    }, 1200);
  }

  function demoNextMural() {
    demoMuralIx = (demoMuralIx + 1) % DHData.MURALS.length;
    demoWipe = null;
    DHExtract.start(DHData.MURALS[demoMuralIx].id);
    showExtract();
    demoSchedule(demoExtractTick, 1000);
  }

  function demoStart() {
    demoWipe = null;
    buildMuralList();
    setView("view-select");
    demoSchedule(function () {
      DHExtract.start(DHData.MURALS[demoMuralIx].id);
      showExtract();
      demoSchedule(demoExtractTick, 900);
    }, 700);
  }

  refreshHomeProgress();
  buildPills();
  paintHomeZaojing();
  renderMute();
  requestAnimationFrame(frame);

  window.__game = {
    test: /[?&]test=1/.test(location.search),
    setView: setView,
    buildSel: buildSel,
    renderPreview: renderPreview
  };

  if (demoMode) demoSchedule(demoStart, 800);
})();
