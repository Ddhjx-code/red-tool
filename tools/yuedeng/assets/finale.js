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
  /* 屋舍（零随机固定表）：x%、宽 px、高 px、窗列、窗行、点亮延迟 s。
     灯火必须落在城的「体内」—— 窗格灯是窗纸由内透光，檐下灯挂在檐口，
     两者都附着于建筑；此前把灯撒在屋脊线以上的天空里，读作「飘在天上」，
     与「满城灯火」的文案直接矛盾。 */
  var HOUSES = [
    [2, 56, 84, 3, 2, 0.4], [13, 64, 96, 3, 2, 0.7], [24, 50, 74, 3, 2, 1.0],
    [33, 60, 90, 4, 3, 1.3], [44, 54, 80, 3, 2, 1.6], [53, 68, 102, 4, 3, 1.9],
    [65, 52, 84, 3, 2, 2.2], [74, 60, 92, 4, 2, 2.5], [85, 50, 78, 3, 2, 2.8],
    [93, 48, 72, 3, 2, 3.1]
  ];

  /* 升空孔明灯（少数，约占全部灯的 15%）：x%、起始 y%（自底算）、延迟 s、上升秒数。
     只留少数，且带 bloom 与拖尾 —— 它们才是「飘」的那一部分，用来反衬城的「定」。 */
  var SKY_LANTERNS = [
    [20, 46, 2.4, 11.0], [37, 40, 4.6, 9.5], [58, 52, 5.8, 12.5],
    [76, 44, 7.2, 10.5], [89, 50, 8.4, 12.0]
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
  var skyLanterns = [];
  var haloEl = null;
  var hungEl = null;
  var stageEl = null;
  var hangEl = null;
  var hangOn = null;

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
      var w = h[1], ht = h[2], cols = h[3], rows = h[4], delay = h[5];
      var house = document.createElement('div');
      house.className = 'fin-house';
      house.style.left = h[0] + '%';
      house.style.width = w + 'px';
      house.style.height = ht + 'px';

      /* 窗格灯：行列均匀，但逐格用确定性哈希决定明灭与先后 —— 于是「罗列」
         有秩序、「满城」不呆板；若全亮，一排同亮小方点会读成噪点阵。 */
      var k = 0;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var seed = hash(i * 97 + k * 13);
          k++;
          if ((seed & 7) === 0) { continue; }        /* 约 1/8 的窗不长明 */
          var win = document.createElement('div');
          win.className = 'fin-window';
          win.style.left = (((c + 0.5) / cols) * 100) + '%';
          win.style.top = (30 + r * 26) + '%';
          win.dataset.delay = (delay + ((seed >> 3) % 10) * 0.18).toFixed(2);
          house.appendChild(win);
          lamps.push(win);
        }
      }

      /* 檐下灯：挂在檐口正中，比窗格更亮（离观者更近），并带三档层次 */
      var lamp = document.createElement('div');
      lamp.className = 'fin-house-lamp';
      lamp.style.left = '50%';
      lamp.style.top = '6%';
      lamp.dataset.delay = (delay + 0.25).toFixed(2);
      lamp.style.setProperty('--t', String(hash(i * 31) % 3));
      house.appendChild(lamp);
      lamps.push(lamp);

      cityEl.appendChild(house);
    }
  }

  /* 升空孔明灯：画面里唯一「飘」的东西，用来反衬城的「定」 */
  function buildSkyLanterns() {
    var host = document.getElementById('fin-sky-lanterns');
    if (!host) { return; }
    host.innerHTML = '';
    skyLanterns = [];
    for (var i = 0; i < SKY_LANTERNS.length; i++) {
      var d = SKY_LANTERNS[i];
      var el = document.createElement('div');
      el.className = 'fin-sky-lantern';
      el.style.left = d[0] + '%';
      el.dataset.startY = String(d[1]);
      el.dataset.delay = String(d[2]);
      el.dataset.rise = String(d[3]);
      host.appendChild(el);
      skyLanterns.push(el);
    }
  }

  function initParticles() {
    particles = [];
    /* 28 枚、低透明、小半径：读作「空气中的余烬微尘」，而不是「天上的灯」。
       此前 60 枚暖金点铺在中空，视觉上与灯火混层，正是「灯飘在天上」的来源之一。 */
    var count = 28;
    for (var i = 0; i < count; i++) {
      var h1 = hash(i * 3);
      var h2 = hash(i * 3 + 1);
      var h3 = hash(i * 3 + 2);
      particles.push({
        x: (h1 % 1000) / 1000 * 390,
        y: 844 - (h2 % 1000) / 1000 * 400,
        vx: ((h3 % 100) - 50) / 900,
        vy: -((h2 % 100) + 40) / 1400,
        r: 0.8 + (h1 % 3) * 0.4,
        alpha: 0.10 + (h3 % 30) / 220
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

  /* 单一相机曲线：四拍是同一台相机的四个关键帧。
     所有图层都由这一条曲线派生（缩放同源、位移按视差系数缩放），没有任何图层
     独立运动 —— 这正是「镜头在动」与「素材在动」的分界，也是「像 PPT 不像 CG」
     的根因所在。此前灯笼独立缩放，观众读到的是「素材在动」。
     曲线本身刻意让灯笼先随镜头拉远而变小（0.55），末拍再随镜头回升而回长
     （0.88）—— 文案是递进链（点烛→树立→满城→争辉），画面必须是递进链；
     旧版末拍缩到最小，把「争辉」拍成了「熄灭」。 */
  /* 第 0 拍是「点烛」特写：起始 zoom 取 1.34 让灯占满画面 —— 特写里不需要
     竿、绳或提手来交代支撑，否则观众会看到一盏悬空的灯（评审判定那像穿模 bug）。 */
  var CAM_KEYS = [
    { t: 0.0,  zoom: 1.34, y: 0 },
    { t: 3.5,  zoom: 0.96, y: -70 },
    { t: 7.0,  zoom: 0.62, y: -110 },
    { t: 10.5, zoom: 0.74, y: -150 },
    { t: 12.5, zoom: 0.90, y: -168 }
  ];

  function cameraAt(elapsed) {
    var i;
    if (elapsed <= CAM_KEYS[0].t) { return CAM_KEYS[0]; }
    for (i = 1; i < CAM_KEYS.length; i++) {
      if (elapsed <= CAM_KEYS[i].t) {
        var a = CAM_KEYS[i - 1], b = CAM_KEYS[i];
        var u = easeInOutCubic((elapsed - a.t) / (b.t - a.t));
        return {
          zoom: a.zoom + (b.zoom - a.zoom) * u,
          y: a.y + (b.y - a.y) * u
        };
      }
    }
    return CAM_KEYS[CAM_KEYS.length - 1];
  }

  /* 视差系数：越近的层随镜头位移越大 */
  var PARA = { sky: 0.22, far: 0.42, city: 0.66, near: 1.00, lantern: 1.00 };

  function updateSkyLanterns(elapsed) {
    for (var i = 0; i < skyLanterns.length; i++) {
      var el = skyLanterns[i];
      var delay = parseFloat(el.dataset.delay);
      var rise = parseFloat(el.dataset.rise);
      var startY = parseFloat(el.dataset.startY);
      var u = (elapsed - delay) / rise;
      if (u < 0 || u > 1) {
        el.style.opacity = '0';
        continue;
      }
      /* 起点在城上方，终点升出画面顶；两端各淡入淡出 */
      var y = startY - (startY + 22) * u;
      var a = Math.min(u / 0.16, 1) * Math.min((1 - u) / 0.22, 1);
      el.style.transform = 'translateY(' + (-y) + '%)';
      el.style.opacity = String(Math.max(0, a));
    }
  }

  function updateCamera(elapsed) {
    if (!lanternEl) return;
    var cam = cameraAt(elapsed);
    var hung = elapsed >= 2.6;

    /* 第一拍灯在檐口上方一点（不压屋面），第二拍起才被升到 58% —— 「点烛」在低处、
       「高树于檐」才升起来。抬升量曾取 140px，结果灯底压进屋面剪影、读作穿模。 */
    var lift = hung ? 0 : 40;
    if (hangEl) {
      hangEl.style.transform = 'translateY(' + (cam.y * PARA.lantern + lift) +
        'px) scale(' + cam.zoom + ')';
      if (hung !== hangOn) {
        hangOn = hung;
        if (stageEl) { stageEl.classList.toggle('is-hung', hung); }
      }
    }

    /* 摆动是确定性正弦阻尼，非随机抖动。两张图共用同一旋转与同一原点
       （原点即绳的系点），故交叉淡入时不会错位。
       注意：这里绝不能设内联 opacity —— 内联样式会盖掉 CSS 的 .is-hung 交叉
       淡入规则，导致「只灯」那张一直不淡出、它的不透明灯体压住另一张的绳，
       表现为「绳时断时接」。淡入淡出全部交给 CSS 类。 */
    var swing = hung ? Math.sin((elapsed - 2.6) * 1.55) * 2.6 *
                       Math.exp(-(elapsed - 2.6) * 0.22) : 0;
    var rot = 'rotate(' + swing.toFixed(2) + 'deg)';
    lanternEl.style.transform = rot;
    if (hungEl) { hungEl.style.transform = rot; }
    /* 末拍提亮：争辉靠的是光，不是尺寸 */
    var crescendo = elapsed < 9.5 ? 1.0 :
      1.0 + 0.22 * easeInOutCubic(Math.min((elapsed - 9.5) / 3.0, 1));
    lanternEl.style.filter = 'brightness(' + crescendo.toFixed(3) +
      ') saturate(' + (1 + (crescendo - 1) * 0.6).toFixed(3) + ')';
    if (hungEl) { hungEl.style.filter = lanternEl.style.filter; }

    if (haloEl) {
      /* 扩光随末拍 crescendo 张开；原点与相机一致，否则光心会随缩放漂离灯笼 */
      haloEl.style.transform = 'scale(' + (0.92 + 0.46 * crescendo).toFixed(3) + ')';
      haloEl.style.opacity = String(Math.min(elapsed / 1.2, 1) *
        (0.30 + 0.32 * easeInOutCubic(Math.min(Math.max(elapsed - 5.5, 0) / 4.4, 1))));
    }

    if (haloEl) {
      haloEl.style.transform = 'translateY(' + (cam.y * PARA.lantern) +
        'px) scale(' + (cam.zoom * (0.9 + 0.5 * crescendo)).toFixed(3) + ')';
      haloEl.style.opacity = String(Math.min(elapsed / 1.2, 1) *
        (0.34 + 0.30 * easeInOutCubic(Math.min(Math.max(elapsed - 5.5, 0) / 4.4, 1))));
    }

    if (skyEl) skyEl.style.transform = 'translateY(' + (cam.y * PARA.sky) + 'px)';
    var farEl = document.getElementById('fin-far');
    if (farEl) farEl.style.transform = 'translateY(' + (cam.y * PARA.far) + 'px)';
    if (cityEl) cityEl.style.transform = 'translateY(' + (cam.y * PARA.city) + 'px)';
    /* 近景层与挂具同享位移 + 缩放（都锚画框底缘）：竿脚才始终踩在檐口上 */
    if (nearEl) {
      nearEl.style.transform = 'translateY(' + (cam.y * PARA.near) +
        'px) scale(' + cam.zoom + ')';
    }

    updateSkyLanterns(elapsed);
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

  function start(plainURL, hungURL, done) {
    onDone = done || null;
    skyEl = document.getElementById('fin-sky');
    cityEl = document.getElementById('fin-city');
    nearEl = document.getElementById('fin-near');
    lanternEl = document.getElementById('fin-lantern');
    hungEl = document.getElementById('fin-lantern-hung');
    haloEl = document.getElementById('fin-lantern-halo');
    hangEl = document.getElementById('fin-hang');
    stageEl = document.getElementById('fin-stage');
    canvasEl = document.getElementById('fin-particles');
    captionEl = document.getElementById('fin-caption');
    skipEl = document.getElementById('fin-skip');

    if (!lanternEl || !canvasEl) return;

    /* 两张合成图同尺寸同锚点：plain 只灯（第0拍点烛），hung 竿绳灯（第1拍起）。
       竿绳是渲染合成而非 CSS，故相对几何恒定，切换不跳。 */
    lanternEl.src = plainURL || '';
    if (hungEl) { hungEl.src = hungURL || ''; }
    canvasEl.width = 390;
    canvasEl.height = 844;
    ctx = canvasEl.getContext('2d');

    buildStars();
    buildHouses();
    buildSkyLanterns();
    initParticles();

    if (skipEl) {
      skipEl.onclick = function () { stop(); };
      skipEl.classList.remove('is-dim');
      /* 开播数秒后淡出：终点帧不该还挂着一枚调试按钮 */
      setTimeout(function () { if (running) { skipEl.classList.add('is-dim'); } }, 4200);
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
