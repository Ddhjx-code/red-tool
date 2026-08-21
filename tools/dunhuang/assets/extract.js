(function () {
  var muralId = null;
  var extracted = {};
  var anims = [];
  var toastQ = [], toastCur = null, toastT = 0, toastGap = 0;
  var cbs = { collected: null, alldone: null };
  var colorMap = {};
  var COLORS = window.DHData.COLORS;
  var i, c;
  for (i = 0; i < COLORS.length; i++) { c = COLORS[i]; colorMap[c.id] = c; }

  function emit(name, payload) {
    if (cbs[name]) cbs[name](payload);
  }

  function showToast(msg) { toastQ.push(msg); }

  function paletteAnchor() {
    var el = document.getElementById("palette-bar"), r;
    if (el) {
      r = el.getBoundingClientRect();
      if (r.width > 0) return { x: r.left + r.width / 2, y: r.top + 8 };
    }
    return { x: 195, y: 780 };
  }

  function pushAnim(hex, x, y) {
    var to = paletteAnchor();
    anims.push({ hex: hex, x0: x, y0: y, x1: to.x, y1: to.y, t: 0, dur: 0.6 });
  }

  function shapeCenter(s) {
    var pts, sx = 0, sy = 0, j;
    if (s.kind === "circle") return { x: s.cx, y: s.cy };
    pts = s.pts;
    for (j = 0; j < pts.length; j++) { sx += pts[j][0]; sy += pts[j][1]; }
    return { x: sx / pts.length, y: sy / pts.length };
  }

  function extract(shape, x, y, viaWipe) {
    var col, first, lst, j;
    if (!muralId || extracted[shape.id]) return;
    extracted[shape.id] = true;
    window.DHMural.markExtracted(shape.id);
    col = colorMap[shape.color];
    pushAnim(col ? col.hex : "#888888", x, y);
    first = window.DHSave.unlock(shape.color);
    emit("collected", { color: shape.color, first: first, hidden: !!shape.hidden });
    if (viaWipe) {
      showToast("拂尘见色 · " + (col ? col.name : ""));
    } else if (first && col) {
      showToast((shape.hidden ? "发现隐藏色 · " : "") + col.name + "｜" + col.text);
    }
    lst = window.DHData.SHAPES[muralId] || [];
    for (j = 0; j < lst.length; j++) {
      if (!extracted[lst[j].id]) return;
    }
    emit("alldone", { muralId: muralId });
    showToast("此壁画颜色拾尽");
  }

  function tap(x, y) {
    var shape = window.DHMural.hitTest(x, y);
    if (!shape || extracted[shape.id]) return;
    if (window.DHMural.dustAtPoint(x, y)) {
      showToast("拂去浮尘，方见其色");
      return;
    }
    extract(shape, x, y, false);
  }

  function checkDust() {
    var lst, j, s, p, ctr, cv;
    if (!muralId) return;
    lst = window.DHData.SHAPES[muralId] || [];
    for (j = 0; j < lst.length; j++) {
      s = lst[j];
      if (!s.dusty || extracted[s.id]) continue;
      p = window.DHMural.dustProgress(s.id);
      if (p >= window.DHData.DUST_DONE) {
        ctr = shapeCenter(s);
        cv = window.DHMural.designToCanvas(ctr.x, ctr.y);
        extract(s, cv.x, cv.y, true);
      }
    }
  }

  function update(dt) {
    var j, a;
    for (j = anims.length - 1; j >= 0; j--) {
      a = anims[j];
      a.t += dt;
      if (a.t >= a.dur) anims.splice(j, 1);
    }
    if (toastCur) {
      toastT -= dt;
      if (toastT <= 0) { toastCur = null; toastGap = 0.26; }
    } else if (toastGap > 0) {
      toastGap -= dt;
    } else if (toastQ.length) {
      toastCur = toastQ.shift();
      toastT = 1.8;
    }
  }

  function drawFx(g) {
    var j, a, p, e, x, y, r;
    if (!g || !anims.length) return;
    for (j = 0; j < anims.length; j++) {
      a = anims[j];
      p = a.t / a.dur;
      if (p > 1) p = 1;
      e = p * p * (3 - 2 * p);
      x = a.x0 + (a.x1 - a.x0) * e;
      y = a.y0 + (a.y1 - a.y0) * e - Math.sin(Math.PI * p) * 70;
      r = 9 - 4 * p;
      g.globalAlpha = 1 - 0.35 * p;
      g.fillStyle = a.hex;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.8;
      g.strokeStyle = "#425066";
      g.lineWidth = 1.5;
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  function start(id) {
    muralId = id;
    extracted = {};
    anims = [];
    toastQ = [];
    toastCur = null;
    toastT = 0;
    toastGap = 0;
    window.DHMural.load(id);
  }

  function palette() {
    var o = window.DHSave.load(), un = {}, out = [], j;
    for (j = 0; j < o.codex.length; j++) un[o.codex[j]] = true;
    for (j = 0; j < COLORS.length; j++) {
      if (un[COLORS[j].id]) out.push(COLORS[j].id);
    }
    return out;
  }

  function snapshot() {
    var lst = muralId ? (window.DHData.SHAPES[muralId] || []) : [];
    return {
      muralId: muralId,
      extractedCount: Object.keys(extracted).length,
      totalCount: lst.length,
      anims: anims.length
    };
  }

  function setCallback(name, fn) {
    if (name === "collected" || name === "alldone") cbs[name] = fn;
  }

  window.DHExtract = {
    start: start,
    update: update,
    tap: tap,
    checkDust: checkDust,
    drawFx: drawFx,
    toast: showToast,
    toastState: function () { return { on: !!toastCur, text: toastCur || "" }; },
    palette: palette,
    snapshot: snapshot,
    setCallback: setCallback
  };
})();
