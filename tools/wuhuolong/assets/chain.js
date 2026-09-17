(function () {
  var D = window.WHData.CHAIN;
  var TAU = Math.PI * 2;

  function shortest(from, to) {
    var d = (to - from + Math.PI) % TAU;
    if (d < 0) { d += TAU; }
    return d - Math.PI;
  }

  function clampTurn(d) {
    if (d > D.MAXTURN) { return D.MAXTURN; }
    if (d < -D.MAXTURN) { return -D.MAXTURN; }
    return d;
  }

  var pts = [];
  var abs = [];
  var loc = [];
  var t = 0;
  var hx = 0;
  var hy = 0;

  function build() {
    var i;
    pts = [];
    abs = [];
    loc = [];
    t = 0;
    hx = 0;
    hy = 0;
    for (i = 0; i < D.N; i++) {
      pts.push({ x: -i * D.L, y: 0 });
      abs.push(0);
      loc.push(0);
    }
  }

  function setHead(x, y) {
    var dx = x - hx;
    var dy = y - hy;
    var m = Math.sqrt(dx * dx + dy * dy);
    var cap = D.L * 6;
    if (m > cap && m > 0) {
      x = hx + (dx / m) * cap;
      y = hy + (dy / m) * cap;
    }
    hx = x;
    hy = y;
  }

  function forward() {
    var i;
    var wave;
    var want;
    var d;

    pts[0].x = hx - D.L * Math.cos(abs[0]);
    pts[0].y = hy - D.L * Math.sin(abs[0]);

    for (i = 1; i < D.N; i++) {
      wave = D.A * Math.sin(TAU * (D.FREQ * t - D.K * i));
      want = abs[i - 1] + wave;
      d = clampTurn(shortest(abs[i], want));
      abs[i] += d;
      d = shortest(abs[i - 1], abs[i]);
      if (d > D.MAXTURN) { abs[i] = abs[i - 1] + D.MAXTURN; d = D.MAXTURN; }
      else if (d < -D.MAXTURN) { abs[i] = abs[i - 1] - D.MAXTURN; d = -D.MAXTURN; }
      loc[i] = d;
      pts[i].x = pts[i - 1].x - D.L * Math.cos(abs[i]);
      pts[i].y = pts[i - 1].y - D.L * Math.sin(abs[i]);
    }
  }

  function step(dt) {
    t += dt;
    abs[0] = shortest(abs[0], Math.atan2(hy - pts[0].y, hx - pts[0].x));
    forward();
  }

  function reForward() {
    var i;
    pts[0].x = hx - D.L * Math.cos(abs[0]);
    pts[0].y = hy - D.L * Math.sin(abs[0]);
    for (i = 1; i < D.N; i++) {
      pts[i].x = pts[i - 1].x - D.L * Math.cos(abs[i]);
      pts[i].y = pts[i - 1].y - D.L * Math.sin(abs[i]);
    }
  }

  function detect(pillars) {
    var c = [];
    var wrapped = 0;
    var i;
    var j;
    for (i = 0; i < D.N; i++) {
      c.push(-1);
      for (j = 0; j < pillars.length; j++) {
        var p = pillars[j];
        var dx = pts[i].x - p.x;
        var dy = pts[i].y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < p.r) { c[i] = j; break; }
      }
      if (c[i] >= 0) { wrapped++; }
    }
    return { c: c, wrapped: wrapped };
  }

  function wrap(pillars) {
    var it;
    var i;
    var det;
    if (!pillars || !pillars.length) { return 0; }
    det = detect(pillars);
    if (!det.wrapped) { return 0; }

    for (it = 0; it < 12; it++) {
      for (i = 1; i < D.N; i++) {
        var cj = det.c[i];
        if (cj < 0) { continue; }
        var p = pillars[cj];
        var ex = pts[i].x - p.x;
        var ey = pts[i].y - p.y;
        var em = Math.sqrt(ex * ex + ey * ey);
        if (em < 1e-9) { ex = p.r; ey = 0; em = p.r; }
        var away = Math.atan2(ey, ex);
        var t1 = away + Math.PI / 2;
        var d1 = shortest(abs[i], t1);
        var d2 = shortest(abs[i], t1 - Math.PI);
        var want = Math.abs(d1) <= Math.abs(d2) ? t1 : t1 - Math.PI;
        abs[i] += clampTurn(shortest(abs[i], want)) * 0.4;
        if (em < p.r * 0.92) {
          abs[i] += clampTurn(shortest(abs[i], away + Math.PI)) * 0.25;
        }
      }
      reForward();
      det = detect(pillars);
      if (!det.wrapped) { break; }
    }
    return det.wrapped;
  }

  function hitTest(rect) {
    var out = [];
    var i;
    for (i = 0; i < D.N; i++) {
      if (pts[i].x >= rect.x && pts[i].x <= rect.x + rect.w &&
          pts[i].y >= rect.y && pts[i].y <= rect.y + rect.h) {
        out.push(i);
      }
    }
    return out;
  }

  function halfWidth(i) {
    var t = (D.N > 1) ? (i / (D.N - 1)) : 0;
    return 0.78 + (0.44 - 0.78) * t;
  }

  function tension() {
    var s = 0;
    var i;
    for (i = 1; i < D.N; i++) { s += Math.abs(loc[i]); }
    return s / (D.N - 1);
  }

  window.WHChain = {
    build: build,
    reset: build,
    head: function () { return { x: hx, y: hy }; },
    setHead: setHead,
    step: step,
    wrap: wrap,
    hitTest: hitTest,
    halfWidth: halfWidth,
    tension: tension,
    time: function () { return t; },
    segments: function () {
      var o = [];
      var i;
      for (i = 0; i < D.N; i++) {
        o.push({ x: pts[i].x, y: pts[i].y, angle: abs[i], localAngle: loc[i] });
      }
      return o;
    },
    debug: function () {
      var w = [];
      var i;
      for (i = 0; i < D.N; i++) { w.push([pts[i].x, pts[i].y]); }
      return { angles: abs.slice(), lengths: loc.slice(), world: w, t: t };
    }
  };

  build();
})();
