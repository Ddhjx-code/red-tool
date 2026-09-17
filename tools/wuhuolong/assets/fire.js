(function () {
  var D = window.WHData.FIRE;
  var rng = window.WHRng(0x5A17 ^ 20260925);
  var glow = null;
  var pool = [];
  var cursor = 0;
  var power = 1;

  function buildPool() {
    var i;
    pool = [];
    for (i = 0; i < D.POOL; i++) {
      pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, r: 0, on: false });
    }
    cursor = 0;
  }

  function init(offscreen) {
    var size = 64;
    offscreen.width = size;
    offscreen.height = size;
    var g = offscreen.getContext("2d");
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,252,240,0.95)");
    grad.addColorStop(0.18, "rgba(255,233,176,0.60)");
    grad.addColorStop(0.35, "rgba(255,138,61,0.26)");
    grad.addColorStop(1, "rgba(255,138,61,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    glow = offscreen;
    rng = window.WHRng(0x5A17 ^ 20260925);
    buildPool();
  }

  function emit(segments, count) {
    var per = count || D.EMIT_PER_SEG;
    var n = segments.length;
    var i;
    var j;
    var s;
    var t;
    var p;
    if (!glow) { return 0; }
    for (i = 0; i < n; i++) {
      s = segments[i];
      t = n > 1 ? i / (n - 1) : 0;
      for (j = 0; j < per; j++) {
        p = pool[cursor];
        cursor = (cursor + 1) % D.POOL;
        p.x = s.x + rng.range(-0.7, 0.7);
        p.y = s.y + rng.range(-0.7, 0.7);
        p.vx = rng.range(-D.DRIFT, D.DRIFT);
        p.vy = rng.range(0.7, 1.3) * D.RISE;
        p.life = D.LIFE * rng.range(0.75, 1);
        p.r = D.R_NEAR + (D.R_FAR - D.R_NEAR) * t;
        p.on = true;
      }
    }
    return n * per;
  }

  function step(dt) {
    var i;
    var p;
    for (i = 0; i < D.POOL; i++) {
      p = pool[i];
      if (!p.on) { continue; }
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += D.GRAV * dt;
    }
  }

  function aliveCount() {
    var i;
    var n = 0;
    for (i = 0; i < D.POOL; i++) {
      if (pool[i].on) { n += 1; }
    }
    return n;
  }

  function draw(ctx) {
    var i;
    var p;
    var r;
    var a;
    if (!glow) { return; }
    ctx.globalCompositeOperation = "lighter";
    for (i = 0; i < D.POOL; i++) {
      p = pool[i];
      if (!p.on) { continue; }
      a = p.life / D.LIFE;
      r = p.r * (2.2 + 1.2 * a) * power;
      ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.drawImage(glow, p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function intensity(v) {
    var k = Math.max(0, Math.min(1, v));
    power = D.INTENSITY_MIN + (1 - D.INTENSITY_MIN) * k;
    return power;
  }

  window.WHFire = {
    init: init,
    emit: emit,
    step: step,
    draw: draw,
    intensity: intensity,
    power: function () { return power; },
    debug: function () {
      var i;
      var first = null;
      for (i = 0; i < pool.length; i++) {
        if (pool[i].on) { first = { x: pool[i].x, y: pool[i].y, r: pool[i].r }; break; }
      }
      return { alive: aliveCount(), pooled: pool.length, power: power, cursor: cursor, first: first };
    }
  };

  buildPool();
})();
