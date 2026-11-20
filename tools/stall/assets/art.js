/* 小摊记 · 市集美术层 v3（位图版）
   文生图场景（晨/暮/夜 三张同构图）+ 抠像货物与客人 + 程序化动效
   素材由 art-src/build_art.py 生成，见 docs/art-spec-stall.md
   Chrome 61 基线：var + function，无箭头函数 / 模板串 / let-const / 解构 */

(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var PAPER = '#F7EBD5';

  /* 资源表：相对 index.html */
  var FILES = {
    day: 'assets/img/scene-day.webp',
    dusk: 'assets/img/scene-dusk.webp',
    night: 'assets/img/scene-night.webp',
    'g-fan': 'assets/img/g-fan.webp',
    'g-sachet': 'assets/img/g-sachet.webp',
    'g-sugar': 'assets/img/g-sugar.webp',
    'g-lantern': 'assets/img/g-lantern.webp',
    'g-kite': 'assets/img/g-kite.webp',
    'g-haw': 'assets/img/g-haw.webp',
    'g-clay': 'assets/img/g-clay.webp',
    'g-bowl': 'assets/img/g-bowl.webp',
    'g-tea': 'assets/img/g-tea.webp',
    'g-jade': 'assets/img/g-jade.webp',
    'p-woman': 'assets/img/p-woman.webp',
    'p-scholar': 'assets/img/p-scholar.webp',
    'p-child': 'assets/img/p-child.webp',
    'p-elder': 'assets/img/p-elder.webp',
    'p-rich': 'assets/img/p-rich.webp'
  };

  var GOOD_IMG = {
    fan: 'g-fan', sachet: 'g-sachet', candy: 'g-sugar', lamp: 'g-lantern',
    kite: 'g-kite', doll: 'g-clay', candied: 'g-haw', bowl: 'g-bowl',
    tea: 'g-tea', jade: 'g-jade'
  };

  var GUEST_IMG = {
    woman: 'p-woman', scholar: 'p-scholar', kid: 'p-child',
    elder: 'p-elder', rich: 'p-rich'
  };

  /* 时段 -> 底图 */
  var TIME_IMG = { morning: 'day', noon: 'day', dusk: 'dusk', night: 'night' };

  var S = {
    cv: null, g: null, W: 0, H: 0, dpr: 1,
    key: 'morning', scene: 'intro',
    t: 0, raf: null, mtx: 0, mty: 0,
    guests: [], parts: [], coins: [],
    stock: {}, sign: 0,
    popT: 0, shakeT: 0,
    prevKey: null, fade: 1,
    rszTimer: null
  };

  var IMGS = {};
  var LOCK = false;

  /* ---------- 载入 ---------- */

  function preload() {
    var k, n = 0, total = 0, started = false;
    for (k in FILES) {
      if (FILES.hasOwnProperty(k)) total++;
    }
    function done() {
      n++;
      if (n >= total && !started) { started = true; }
    }
    for (k in FILES) {
      if (!FILES.hasOwnProperty(k)) continue;
      var im = new Image();
      im.onload = done;
      im.onerror = done;
      im.src = FILES[k];
      IMGS[k] = im;
    }
  }

  function ready(k) {
    var im = IMGS[k];
    return im && im.complete && im.naturalWidth > 0;
  }

  /* ---------- 布局参数 ---------- */

  function groundY() { return S.H * 0.735; }      /* 客人脚底基线 */
  function guestScale() { return S.H * 0.205; }   /* 成人立绘高度 */

  /* ---------- 绘制：场景 ---------- */

  function drawBg(g, key, alpha, zoom) {
    if (!ready(key)) return false;
    var im = IMGS[key];
    var z = zoom || 1.10;
    var sc = Math.max(S.W / im.naturalWidth, S.H / im.naturalHeight) * z;
    var w = im.naturalWidth * sc;
    var h = im.naturalHeight * sc;
    var ox = (S.W - w) / 2 - S.mtx * S.W * 0.012;
    var oy = (S.H - h) / 2 - S.mty * S.H * 0.006;
    g.globalAlpha = alpha;
    g.drawImage(im, ox, oy, w, h);
    g.globalAlpha = 1;
    return true;
  }

  /* 时段色罩：把同一张日景区分成辰时与午时 */
  function drawTint(g) {
    var col = null, a = 0;
    if (S.key === 'noon') { col = 'rgba(255,244,206,1)'; a = 0.10; }
    else if (S.key === 'morning') { col = 'rgba(255,226,178,1)'; a = 0.06; }
    else if (S.key === 'night') { col = 'rgba(24,22,58,1)'; a = 0.10; }
    if (!col) return;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = col;
    g.fillRect(0, 0, S.W, S.H);
    g.restore();
  }

  /* 顶部纸纹暗角，让 HUD 文字浮起来 */
  function drawVignette(g) {
    var grad = g.createLinearGradient(0, 0, 0, S.H * 0.34);
    grad.addColorStop(0, 'rgba(58,42,30,0.34)');
    grad.addColorStop(1, 'rgba(58,42,30,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S.W, S.H * 0.34);
  }

  /* ---------- 绘制：客人 ---------- */

  function drawGuest(g, gu) {
    var key = GUEST_IMG[gu.kind] || 'p-woman';
    if (!ready(key)) return;
    var im = IMGS[key];
    var h = gu.s;
    var w = h * im.naturalWidth / im.naturalHeight;
    var bob = gu.mode === 'walk' ? Math.sin(S.t * 0.014 + gu.ph) * h * 0.012 : 0;
    var x = gu.x - w / 2;
    var y = gu.y - h + bob;

    /* 脚下投影 */
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = '#2A1A10';
    g.beginPath();
    g.ellipse(gu.x, gu.y - h * 0.012, w * 0.30, h * 0.030, 0, 0, TAU);
    g.fill();
    g.restore();

    g.save();
    if (gu.dir < 0) {
      g.translate(gu.x, 0);
      g.scale(-1, 1);
      g.drawImage(im, -w / 2, y, w, h);
    } else {
      g.drawImage(im, x, y, w, h);
    }
    g.restore();

    /* 手上的货：落在手侧偏下，别糊在脸上 */
    if (gu.held && GOOD_IMG[gu.held] && ready(GOOD_IMG[gu.held])) {
      var gi = IMGS[GOOD_IMG[gu.held]];
      var gh = h * 0.20;
      var gw = gh * gi.naturalWidth / gi.naturalHeight;
      var hx = gu.dir < 0 ? gu.x - w * 0.46 : gu.x + w * 0.46;
      var hy = y + h * 0.66;
      g.save();
      g.globalAlpha = 0.22;
      g.fillStyle = '#2A1A10';
      g.beginPath();
      g.ellipse(hx, hy + gh * 0.92, gw * 0.34, gh * 0.10, 0, 0, TAU);
      g.fill();
      g.restore();
      g.drawImage(gi, hx - gw / 2, hy, gw, gh);
    }
  }

  /* ---------- 绘制：动效 ---------- */

  function drawParts(g) {
    var i, p;
    for (i = 0; i < S.parts.length; i++) {
      p = S.parts[i];
      g.save();
      g.globalAlpha = p.a;
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.c;
      if (p.leaf) {
        g.beginPath();
        g.moveTo(0, -p.r);
        g.quadraticCurveTo(p.r * 0.8, 0, 0, p.r);
        g.quadraticCurveTo(-p.r * 0.8, 0, 0, -p.r);
        g.fill();
      } else {
        g.beginPath();
        g.arc(0, 0, p.r, 0, TAU);
        g.fill();
      }
      g.restore();
    }
  }

  function drawCoins(g) {
    var i, c;
    for (i = 0; i < S.coins.length; i++) {
      c = S.coins[i];
      g.save();
      g.globalAlpha = Math.max(0, c.life);
      g.translate(c.x, c.y);
      g.rotate(c.rot);
      g.fillStyle = '#D9A441';
      g.beginPath();
      g.arc(0, 0, c.r, 0, TAU);
      g.fill();
      g.fillStyle = '#8A6A2A';
      g.fillRect(-c.r * 0.28, -c.r * 0.28, c.r * 0.56, c.r * 0.56);
      g.restore();
    }
  }

  /* ---------- 主循环 ---------- */

  function frame() {
    if (!S.g) return;
    var g = S.g;
    var sx = 0, sy = 0;
    if (S.shakeT > 0) {
      sx = (Math.random() - 0.5) * 7 * (S.shakeT / 260);
      sy = (Math.random() - 0.5) * 7 * (S.shakeT / 260);
      S.shakeT -= 16;
    }

    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    g.fillStyle = PAPER;
    g.fillRect(0, 0, S.W, S.H);
    g.translate(sx, sy);

    var key = TIME_IMG[S.key] || 'day';

    if (S.fade < 1 && S.prevKey) {
      drawBg(g, S.prevKey, 1, 1.10);
      drawBg(g, key, S.fade, 1.10);
      S.fade = Math.min(1, S.fade + 0.045);
      if (S.fade >= 1) S.prevKey = null;
    } else {
      drawBg(g, key, 1, 1.10);
    }

    drawTint(g);

    /* 客人（按脚底线排序） */
    S.guests.sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < S.guests.length; i++) drawGuest(g, S.guests[i]);

    drawParts(g);
    drawCoins(g);
    drawVignette(g);

    S.t += 16;
    S.raf = requestAnimationFrame(frame);
  }

  /* ---------- 推进 ---------- */

  var stepTimer = null;
  function step() {
    var i, gu;
    for (i = S.guests.length - 1; i >= 0; i--) {
      gu = S.guests[i];
      if (gu.mode === 'walk') {
        gu.dir = -1;
        gu.x += gu.vx;
        if (gu.x <= gu.tx) { gu.x = gu.tx; gu.mode = 'wait'; gu.wait = 2400; }
      } else if (gu.mode === 'wait') {
        gu.wait -= 16;
        if (gu.wait <= 0) { gu.mode = 'leave'; gu.dir = 1; gu.vx = 0.55; gu.held = null; }
      } else {
        gu.dir = 1;
        gu.x += gu.vx;
        if (gu.x > S.W + 160) S.guests.splice(i, 1);
      }
    }

    for (i = S.parts.length - 1; i >= 0; i--) {
      var pt = S.parts[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      if (pt.leaf) { pt.rot += pt.vr; pt.vy += 0.0022; pt.vx += (Math.random() - 0.5) * 0.02; }
      else { pt.r += 0.10; pt.a -= 0.004; }
      if (pt.y > S.H + 60 || pt.a <= 0 || pt.x < -60 || pt.x > S.W + 60) S.parts.splice(i, 1);
    }

    for (i = S.coins.length - 1; i >= 0; i--) {
      var c = S.coins[i];
      c.vy += 0.075;
      c.x += c.vx;
      c.y += c.vy;
      c.rot += 0.11;
      c.life -= 0.010;
      if (c.life <= 0) S.coins.splice(i, 1);
    }
  }

  function startStep() {
    if (stepTimer) return;
    stepTimer = setInterval(step, 16);
  }

  /* ---------- 对外 ---------- */

  function init(cv) {
    S.cv = cv;
    S.g = cv.getContext('2d');
    preload();
    resize();
    window.addEventListener('resize', function () {
      clearTimeout(S.rszTimer);
      S.rszTimer = setTimeout(resize, 200);
    });
    window.addEventListener('pointermove', function (e) {
      S.mtx = e.clientX / Math.max(1, S.W) - 0.5;
      S.mty = e.clientY / Math.max(1, S.H) - 0.5;
    });
    if (!S.raf) S.raf = requestAnimationFrame(frame);
    startStep();
    setInterval(spawnLeaf, 1500);
    setInterval(function () {
      if (S.key === 'night') spawnSpark();
    }, 900);
  }

  function resize() {
    if (!S.cv) return;
    var w = S.cv.clientWidth || window.innerWidth;
    var h = S.cv.clientHeight || window.innerHeight;
    S.dpr = Math.min(2, window.devicePixelRatio || 1);
    S.W = w;
    S.H = h;
    S.cv.width = Math.round(w * S.dpr);
    S.cv.height = Math.round(h * S.dpr);
  }

  function setTime(key) {
    var img = TIME_IMG[key] || 'day';
    if (img === (TIME_IMG[S.key] || 'day')) {
      S.key = key;
      return;
    }
    S.prevKey = TIME_IMG[S.key] || 'day';
    S.fade = 0;
    S.key = key;
  }

  function setScene(name) {
    S.scene = name;
    S.guests = [];
  }

  function setStock(stock) { S.stock = stock || {}; }
  function setSign(n) { S.sign = n || 0; }

  function addGuest(kind) {
    if (S.guests.length >= 4) return;
    var isKid = kind === 'kid';
    var h = guestScale() * (isKid ? 0.72 : 1);
    S.guests.push({
      kind: kind,
      x: S.W + 120,
      y: groundY() + (Math.random() - 0.5) * S.H * 0.012,
      tx: S.W * (0.56 + Math.random() * 0.10),
      s: h,
      vx: -1.05,
      dir: -1,
      mode: 'walk',
      ph: Math.random() * TAU,
      wait: 0,
      held: null
    });
  }

  function buyHeld(kind, goodId) {
    var i;
    for (i = 0; i < S.guests.length; i++) {
      if (S.guests[i].kind === kind && S.guests[i].mode === 'wait') {
        S.guests[i].held = goodId;
        S.guests[i].mode = 'leave';
        S.guests[i].dir = 1;
        S.guests[i].vx = 0.55;
        break;
      }
    }
  }

  function flyCoins(n) {
    var k;
    for (k = 0; k < (n || 3); k++) {
      S.coins.push({
        x: S.W * 0.46 + (Math.random() - 0.5) * S.W * 0.14,
        y: S.H * 0.66,
        vx: (Math.random() - 0.5) * 2.4,
        vy: -5.2 - Math.random() * 1.8,
        r: 6 + Math.random() * 3,
        rot: Math.random() * TAU,
        life: 1
      });
    }
  }

  function shake(ms) { S.shakeT = ms || 220; }

  function spawnLeaf() {
    if (S.scene === 'intro' || S.scene === 'result') return;
    S.parts.push({
      x: Math.random() * S.W,
      y: -30,
      vx: 0.35 + Math.random() * 0.5,
      vy: 0.55 + Math.random() * 0.6,
      r: 3 + Math.random() * 3.5,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 0.10,
      a: 0.55 + Math.random() * 0.3,
      c: Math.random() > 0.5 ? '#B4462F' : '#C9902F',
      leaf: true
    });
  }

  function spawnSpark() {
    if (S.scene !== 'market') return;
    S.parts.push({
      x: Math.random() * S.W,
      y: S.H * (0.42 + Math.random() * 0.34),
      vx: (Math.random() - 0.5) * 0.25,
      vy: -0.18 - Math.random() * 0.25,
      r: 1.2 + Math.random() * 1.6,
      rot: 0,
      a: 0.55,
      c: '#FFD98A',
      leaf: false
    });
  }

  window.StallArt = {
    init: init,
    setTime: setTime,
    setScene: setScene,
    setStock: setStock,
    setSign: setSign,
    addGuest: addGuest,
    buyHeld: buyHeld,
    flyCoins: flyCoins,
    shake: shake
  };
})();
