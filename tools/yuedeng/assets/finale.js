/* ============================================================
   CG 结局 · 树中秋（§10）：四拍叙事序列，总长 12.5s。
   镜头运动靠 transform，视差层各层不同速，粒子在独立 canvas。
   零随机：星空／屋舍／粒子初始态全部取自固定表或确定性哈希。
   ============================================================ */
(function () {
  'use strict';

  /* 四拍时间轴（§10.2）。总长 12.5s。 */
  var BEATS = [
    { t: 0,   dur: 2.5, cap: '点烛' },
    { t: 2.5, dur: 3.0, cap: '高树于檐' },
    { t: 5.5, dur: 4.0, cap: '满城灯火，如明星罗列' },
    { t: 9.5, dur: 3.0, cap: '实与明月争辉' }
  ];
  var TOTAL = 12.5;

  /* 星空固定表（零随机）：[x%, y%, 直径 px, 亮度] */
  var STARS = [
    [6, 8, 2, 0.5], [12, 14, 1, 0.4], [18, 6, 1, 0.6], [24, 12, 2, 0.3],
    [30, 10, 1, 0.5], [36, 16, 1, 0.4], [42, 8, 2, 0.6], [48, 14, 1, 0.3],
    [54, 6, 1, 0.5], [60, 12, 2, 0.4], [66, 10, 1, 0.6], [72, 16, 1, 0.3],
    [78, 8, 2, 0.5], [84, 14, 1, 0.4], [90, 6, 1, 0.6], [94, 12, 2, 0.3],
    [8, 18, 1, 0.4], [16, 22, 2, 0.5], [24, 18, 1, 0.3], [32, 24, 1, 0.6],
    [40, 20, 2, 0.4], [48, 26, 1, 0.5], [56, 18, 1, 0.3], [64, 24, 2, 0.6],
    [72, 20, 1, 0.4], [80, 26, 1, 0.5], [88, 18, 2, 0.3], [92, 22, 1, 0.6]
  ];

  /* 屋舍与屋上灯（零随机）：[x%, 宽 px, 高 px, 灯 x%, 灯 y%, 点亮延迟 s] */
  var HOUSES = [
    [4, 50, 80, 25, 10, 0.3], [14, 60, 90, 30, 12, 0.6],
    [24, 45, 70, 28, 14, 0.9], [34, 55, 85, 32, 10, 1.2],
    [44, 50, 75, 26, 12, 1.5], [54, 65, 95, 34, 14, 1.8],
    [64, 48, 80, 29, 10, 2.1], [74, 58, 88, 31, 12, 2.4],
    [84, 52, 78, 27, 14, 2.7], [92, 46, 72, 33, 10, 3.0]
  ];

  /* 粒子（零随机）：确定性哈希生成初始态 */
  function hash(i) {
    var h = 2166136261;
    h = (h ^ i) * 16777619 >>> 0;
    h = (h ^ (i * 2654435761)) * 16777619 >>> 0;
    return h >>> 0;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  var running = false;
  var t0 = 0;
  var rafId = 0;
  var particles = [];
  var onDone = null;
  var skyEl = null;
  var cityEl = null;
  var nearEl = null;
  var lanternEl = null;
  var canvasEl = null;
  var captionEl = null;
  var skipEl = null;
  var ctx = null;
  var lamps = [];

  function buildStars() {
    if (!skyEl) return;
    var container = skyEl.querySelector('.fin-stars');
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      var el = document.createElement('div');
      el.className = 'fin-star';
      el.style.left = s[0] + '%';
      el.style.top = s[1] + '%';
      el.style.width = s[2] + 'px';
      el.style.height = s[2] + 'px';
      el.style.opacity = s[3];
      container.appendChild(el);
    }
  }

  function buildHouses() {
    if (!cityEl) return;
    cityEl.innerHTML = '';
    lamps = [];
    for (var i = 0; i < HOUSES.length; i++) {
      var h = HOUSES[i];
      var house = document.createElement('div');
      house.className = 'fin-house';
      house.style.left = h[0] + '%';
      house.style.width = h[1] + 'px';
      house.style.height = h[2] + 'px';
      var lamp = document.createElement('div');
      lamp.className = 'fin-house-lamp';
      lamp.style.left = h[3] + '%';
      lamp.style.top = h[4] + '%';
      lamp.dataset.delay = h[5];
      house.appendChild(lamp);
      cityEl.appendChild(house);
      lamps.push(lamp);
    }
  }

  function initParticles() {
    particles = [];
    var count = 60;
    for (var i = 0; i < count; i++) {
      var h1 = hash(i * 3);
      var h2 = hash(i * 3 + 1);
      var h3 = hash(i * 3 + 2);
      particles.push({
        x: (h1 % 1000) / 1000 * 390,
        y: 844 - (h2 % 1000) / 1000 * 400,
        vx: ((h3 % 100) - 50) / 500,
        vy: -((h2 % 100) + 50) / 1000,
        r: 1 + (h1 % 3),
        alpha: 0.3 + (h3 % 40) / 100
      });
    }
  }

  function drawParticles(elapsed) {
    if (!ctx || !canvasEl) return;
    var w = canvasEl.width;
    var h = canvasEl.height;
    ctx.clearRect(0, 0, w, h);
    var intensity = elapsed < 5.5 ? 0 : Math.min((elapsed - 5.5) / 4, 1);
    if (intensity <= 0) return;
    ctx.fillStyle = 'rgba(245, 199, 126, 1)';
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) p.y = h + 10;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      ctx.globalAlpha = p.alpha * intensity;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function updateCamera(elapsed) {
    if (!lanternEl) return;
    var beat = -1;
    for (var i = 0; i < BEATS.length; i++) {
      if (elapsed >= BEATS[i].t && elapsed < BEATS[i].t + BEATS[i].dur) {
        beat = i;
        break;
      }
    }
    if (beat === -1) beat = BEATS.length - 1;

    var b = BEATS[beat];
    var local = (elapsed - b.t) / b.dur;
    var eased = easeInOutCubic(Math.min(local, 1));

    var scale = 1.0;
    var translateY = 0;
    var opacity = 1.0;

    if (beat === 0) {
      scale = 1.0;
      translateY = 0;
      opacity = Math.min(elapsed / 0.5, 1);
    } else if (beat === 1) {
      scale = 1.0 - 0.2 * eased;
      translateY = -120 * eased;
      opacity = 1;
    } else if (beat === 2) {
      scale = 0.8 - 0.3 * eased;
      translateY = -120 - 80 * eased;
      opacity = 1;
    } else if (beat === 3) {
      scale = 0.5 - 0.1 * eased;
      translateY = -200;
      opacity = 1;
    }

    lanternEl.style.transform = 'translate(-50%, -50%) translateY(' + translateY + 'px) scale(' + scale + ')';
    lanternEl.style.opacity = opacity;

    var skyShift = beat >= 2 ? (elapsed - 5.5) * 8 : 0;
    var cityShift = beat >= 2 ? (elapsed - 5.5) * 12 : 0;
    var nearShift = beat >= 2 ? (elapsed - 5.5) * 16 : 0;

    if (skyEl) skyEl.style.transform = 'translateY(' + (-skyShift) + 'px)';
    if (cityEl) cityEl.style.transform = 'translateY(' + (-cityShift) + 'px)';
    if (nearEl) nearEl.style.transform = 'translateY(' + (-nearShift) + 'px)';
  }

  function updateCaption(elapsed) {
    if (!captionEl) return;
    var current = null;
    for (var i = 0; i < BEATS.length; i++) {
      if (elapsed >= BEATS[i].t && elapsed < BEATS[i].t + BEATS[i].dur) {
        current = BEATS[i];
        break;
      }
    }
    if (!current) current = BEATS[BEATS.length - 1];
    if (captionEl.dataset.cap !== current.cap) {
      captionEl.dataset.cap = current.cap;
      captionEl.textContent = current.cap;
      captionEl.classList.remove('is-on');
      setTimeout(function () { captionEl.classList.add('is-on'); }, 50);
    }
  }

  function updateLamps(elapsed) {
    if (elapsed < 5.5) return;
    var localElapsed = elapsed - 5.5;
    for (var i = 0; i < lamps.length; i++) {
      var delay = parseFloat(lamps[i].dataset.delay || 0);
      if (localElapsed >= delay && !lamps[i].classList.contains('is-on')) {
        lamps[i].classList.add('is-on');
      }
    }
  }

  function tick() {
    if (!running) return;
    var elapsed = (Date.now() - t0) / 1000;
    if (elapsed >= TOTAL) {
      elapsed = TOTAL;
      stop();
    }
    updateCamera(elapsed);
    updateCaption(elapsed);
    updateLamps(elapsed);
    drawParticles(elapsed);
    if (running) rafId = requestAnimationFrame(tick);
  }

  function start(lanternDataURL, done) {
    onDone = done || null;
    skyEl = document.getElementById('fin-sky');
    cityEl = document.getElementById('fin-city');
    nearEl = document.getElementById('fin-near');
    lanternEl = document.getElementById('fin-lantern');
    canvasEl = document.getElementById('fin-particles');
    captionEl = document.getElementById('fin-caption');
    skipEl = document.getElementById('fin-skip');

    if (!lanternEl || !canvasEl) return;

    lanternEl.src = lanternDataURL;
    canvasEl.width = 390;
    canvasEl.height = 844;
    ctx = canvasEl.getContext('2d');

    buildStars();
    buildHouses();
    initParticles();

    if (skipEl) {
      skipEl.onclick = function () { stop(); };
    }

    running = true;
    t0 = Date.now();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    /* 先置空再调用：跳过后序列恰好同时结束会二次触发，视图会被路由两次 */
    var cb = onDone;
    onDone = null;
    if (cb) { cb(); }
  }

  window.YDFinale = {
    start: start,
    stop: stop,
    isRunning: function () { return running; }
  };
})();
