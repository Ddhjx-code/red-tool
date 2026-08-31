(function () {
  var D = window.SHData;
  var canvas = null, ctx = null, dpr = 1;
  var IMGS = {};
  ["yinglong", "enemy-qiongqi", "enemy-bifang", "enemy-goudiao", "enemy-taotie",
   "drop-sword", "drop-thunder", "drop-mirror", "bg-clouds"].forEach(function (n) {
    var im = new Image();
    im.src = "./assets/img/" + n + ".webp";
    IMGS[n] = im;
  });
  var FXI = {};
  ["spark1", "spark2", "star1", "star2", "flame", "smoke1", "smoke2", "magic", "circle"].forEach(function (n) {
    var im = new Image();
    im.src = "./assets/img/fx/" + n + ".png";
    FXI[n] = im;
  });
  var particles = [];

  function spawnParticles(kind, x, y, n) {
    var names = {
      boom: ["spark1", "spark2", "star1", "flame", "smoke1"],
      hit: ["spark1", "spark2"],
      thunder: ["magic", "star2", "spark2"],
      power: ["star1", "star2"],
      shieldbreak: ["circle", "spark2"]
    }[kind] || ["spark1"];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = kind === "boom" ? 60 + Math.random() * 140 : 40 + Math.random() * 80;
      particles.push({
        img: FXI[names[Math.floor(Math.random() * names.length)]],
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === "boom" ? 30 : 0),
        t0: performance.now(),
        life: kind === "boom" ? 500 + Math.random() * 300 : 300 + Math.random() * 200,
        size: kind === "boom" ? 14 + Math.random() * 16 : 8 + Math.random() * 10,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 8
      });
    }
  }
  var clouds = [];
  var cloudSeed = 0;

  function init(cv) {
    canvas = cv;
    ctx = cv.getContext("2d");
    resize();
    seedClouds(1);
  }

  function resize() {
    if (!canvas) return;
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = D.W + "px";
    canvas.style.height = D.H + "px";
    canvas.width = Math.round(D.W * dpr);
    canvas.height = Math.round(D.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedClouds(seed) {
    cloudSeed = seed;
    clouds = [];
    var s = seed;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = 0; i < 14; i++) {
      clouds.push({ x: rnd() * D.W, y: rnd() * D.H, r: 30 + rnd() * 60, sp: 0.3 + rnd() * 0.6, a: 0.06 + rnd() * 0.1 });
    }
  }

  function draw(S, t) {
    if (!ctx) return;
    ctx.clearRect(0, 0, D.W, D.H);

    var sky = ctx.createLinearGradient(0, 0, 0, D.H);
    sky.addColorStop(0, "#1a2540");
    sky.addColorStop(0.5, "#2a3a55");
    sky.addColorStop(1, "#3a4a60");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, D.W, D.H);

    var bgImg = IMGS["bg-clouds"];
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(bgImg, 0, 0, D.W, D.H);
      ctx.globalAlpha = 1;
    }
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.y += c.sp;
      if (c.y > D.H + c.r) { c.y = -c.r; c.x = Math.random() * D.W; }
      ctx.fillStyle = "rgba(220,230,240," + c.a + ")";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r, c.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!S) return;

    for (var d = 0; d < S.drops.length; d++) {
      var dr = S.drops[d];
      var dimg = IMGS["drop-" + dr.kind];
      if (dimg && dimg.complete && dimg.naturalWidth > 0) {
        ctx.drawImage(dimg, dr.x - 16, dr.y - 16, 32, 32);
      } else {
        ctx.fillStyle = dr.kind === "sword" ? "#7ab6d8" : (dr.kind === "thunder" ? "#e8c56a" : "#a0d8c0");
        ctx.beginPath();
        ctx.arc(dr.x, dr.y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (var e = 0; e < S.enemies.length; e++) {
      var en = S.enemies[e];
      var et = D.enemies[en.type];
      var eimg = IMGS["enemy-" + en.type];
      if (eimg && eimg.complete && eimg.naturalWidth > 0) {
        var sz = et.r * 2.2;
        ctx.drawImage(eimg, en.x - sz / 2, en.y - sz / 2, sz, sz);
      } else {
        ctx.fillStyle = et.boss ? "#8a3a3a" : "#a05a4a";
        ctx.beginPath();
        ctx.arc(en.x, en.y, et.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (et.boss) {
        var bw = 80;
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(en.x - bw / 2, en.y - et.r - 14, bw, 6);
        ctx.fillStyle = "#c3272b";
        ctx.fillRect(en.x - bw / 2, en.y - et.r - 14, bw * Math.max(0, en.hp / et.hp), 6);
      } else {
        var hw = et.r * 1.6;
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(en.x - hw / 2, en.y - et.r - 9, hw, 4);
        ctx.fillStyle = en.hp / et.hp > 0.4 ? "#8ac060" : "#e07a52";
        ctx.fillRect(en.x - hw / 2, en.y - et.r - 9, hw * Math.max(0, en.hp / et.hp), 4);
      }
    }

    ctx.fillStyle = "#e8e4d8";
    for (var b = 0; b < S.bullets.length; b++) {
      var bl = S.bullets[b];
      ctx.fillRect(bl.x - 2, bl.y - 8, 4, 12);
    }
    ctx.fillStyle = "#e07a52";
    for (var eb = 0; eb < S.ebullets.length; eb++) {
      var ebl = S.ebullets[eb];
      ctx.beginPath();
      ctx.arc(ebl.x, ebl.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    var pimg = IMGS["yinglong"];
    if (pimg && pimg.complete && pimg.naturalWidth > 0) {
      var psz = 64;
      ctx.drawImage(pimg, S.px - psz / 2, S.py - psz / 2, psz, psz);
    } else {
      ctx.fillStyle = "#5a8ab0";
      ctx.beginPath();
      ctx.moveTo(S.px, S.py - 20);
      ctx.lineTo(S.px - 16, S.py + 16);
      ctx.lineTo(S.px + 16, S.py + 16);
      ctx.closePath();
      ctx.fill();
    }
    if (S.shield > 0) {
      ctx.strokeStyle = "rgba(160,216,192," + (0.5 + 0.3 * Math.sin(t * 4)) + ")";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(S.px, S.py, 34, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawFx(S, t);
  }

  function drawFx(S, t) {
    for (var i = S.fx.length - 1; i >= 0; i--) {
      var f = S.fx[i];
      if (f.spawned === undefined) {
        f.spawned = true;
        if (f.kind === "boom") spawnParticles("boom", f.x, f.y, 14);
        else if (f.kind === "hit") spawnParticles("hit", f.x, f.y, 5);
        else if (f.kind === "thunder") spawnParticles("thunder", f.x, f.y, 20);
        else if (f.kind === "power") spawnParticles("power", f.x, f.y, 10);
        else if (f.kind === "shieldbreak") spawnParticles("shieldbreak", f.x, f.y, 8);
      }
      var age = (t - f.t0) / 0.6;
      if (age >= 1) { S.fx.splice(i, 1); continue; }
      if (f.kind === "boom") {
        ctx.globalAlpha = (1 - age) * 0.7;
        ctx.fillStyle = "#e8a56a";
        ctx.beginPath();
        ctx.arc(f.x, f.y, 8 + age * 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = (1 - age) * 0.4;
        ctx.strokeStyle = "#e8c56a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 12 + age * 44, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.kind === "hit") {
        ctx.globalAlpha = (1 - age);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(f.x, f.y, 4 + age * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.kind === "thunder") {
        if (age < 0.25) {
          ctx.globalAlpha = (0.25 - age) * 2;
          ctx.fillStyle = "#e8e4d8";
          ctx.fillRect(0, 0, D.W, D.H);
          ctx.globalAlpha = 1;
        }
        ctx.globalAlpha = (1 - age);
        ctx.strokeStyle = "#e8c56a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        var lx = f.x, ly = 0;
        ctx.moveTo(lx, ly);
        while (ly < f.y) {
          ly += 30 + Math.random() * 20;
          lx += (Math.random() - 0.5) * 30;
          ctx.lineTo(lx, Math.min(ly, f.y));
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.kind === "hurt") {
        ctx.globalAlpha = (1 - age) * 0.4;
        ctx.fillStyle = "#c3272b";
        ctx.fillRect(0, 0, D.W, D.H);
        ctx.globalAlpha = 1;
      } else if (f.kind === "shieldbreak") {
        ctx.globalAlpha = (1 - age);
        ctx.strokeStyle = "#a0d8c0";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 30 + age * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.kind === "power" && f.text) {
        ctx.globalAlpha = (1 - age);
        ctx.fillStyle = "#e8c56a";
        ctx.font = "bold 16px 'Kaiti SC','STKaiti','KaiTi',serif";
        ctx.textAlign = "center";
        ctx.fillText(f.text, f.x, f.y - 30 - age * 20);
        ctx.globalAlpha = 1;
      }
    }
    var nowMs = performance.now();
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      var page = (nowMs - pt.t0) / pt.life;
      if (page >= 1) { particles.splice(p, 1); continue; }
      var dt2 = 1 / 60;
      pt.x += pt.vx * dt2;
      pt.y += pt.vy * dt2;
      pt.vy += 60 * dt2;
      pt.rot += pt.vr * dt2;
      ctx.save();
      ctx.globalAlpha = (1 - page) * 0.9;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      var sz = pt.size * (1 - page * 0.4);
      if (pt.img && pt.img.complete && pt.img.naturalWidth > 0) {
        ctx.drawImage(pt.img, -sz / 2, -sz / 2, sz, sz);
      } else {
        ctx.fillStyle = "#e8c56a";
        ctx.beginPath();
        ctx.arc(0, 0, sz / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  window.SHScene = { init: init, resize: resize, draw: draw, seedClouds: seedClouds };
})();
