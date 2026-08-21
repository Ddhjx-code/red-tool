(function () {
  var D = window.KJData;
  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1;
  var containerL = 0, containerR = 0, containerB = 0, dangerY = 0, dropY = 0;
  var engine = null, world = null;
  var state = "menu";
  var score = 0, best = 0;
  var currentTier = 0, nextTier = 1, aimX = 0;
  var pendingMerges = [], mergeFlags = {};
  var effects = [];
  var overTimer = 0;
  var lastTs = 0;
  var factShown = {};
  var testMode = /[?&]test=1/.test(location.search);
  var rng = mulberry32(1);
  var career = loadCareer();

  function loadCareer() {
    try { return JSON.parse(localStorage.getItem("keju-career") || "{}"); } catch (e) { return {}; }
  }
  function saveCareer() {
    try { localStorage.setItem("keju-career", JSON.stringify(career)); } catch (e) {}
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var toastEl = document.getElementById("toast");
  var toastTimer = null;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cw = Math.min(360, W - 24);
    containerL = (W - cw) / 2; containerR = containerL + cw;
    containerB = H - 26; dangerY = 150; dropY = 96;
    aimX = W / 2;
    if (engine) buildWalls();
  }

  var walls = [];
  function buildWalls() {
    walls.forEach(function (w) { Matter.World.remove(world, w); });
    walls = [];
    var t = 60;
    walls.push(Matter.Bodies.rectangle(containerL - t / 2, H / 2, t, H * 2, { isStatic: true }));
    walls.push(Matter.Bodies.rectangle(containerR + t / 2, H / 2, t, H * 2, { isStatic: true }));
    walls.push(Matter.Bodies.rectangle(W / 2, containerB + t / 2, (containerR - containerL) + t * 2, t, { isStatic: true }));
    Matter.World.add(world, walls);
  }

  function makeBody(tier, x, y) {
    var r = D.RANKS[tier].size;
    var b = Matter.Bodies.circle(x, y, r, {
      restitution: 0.08, friction: 0.4, frictionAir: 0.012, density: 0.0018,
      slop: 0.02
    });
    b.plugin.tier = tier;
    b.plugin.born = performance.now();
    return b;
  }

  function randDropTier() {
    var max = Math.min(D.DROP_MAX_TIER, D.RANKS.length - 2);
    var r = rng();
    if (r < 0.34) return 0;
    if (r < 0.62) return 1;
    if (r < 0.82) return 2;
    if (r < 0.94) return 3;
    return max;
  }

  function startGame() {
    Matter.World.clear(world, false);
    Matter.Engine.clear(engine);
    engine.gravity.y = 1;
    buildWalls();
    pendingMerges = []; mergeFlags = {}; effects = [];
    factShown = {};
    rng = mulberry32(testMode ? 20260820 : ((Date.now() & 0x7fffffff) | 1));
    score = 0; overTimer = 0;
    currentTier = randDropTier(); nextTier = randDropTier();
    aimX = W / 2;
    state = "play";
    hideOverlay();
    settleBtn.classList.add("is-on");
  }

  function onCollision(ev) {
    var pairs = ev.pairs, i, a, b, t;
    for (i = 0; i < pairs.length; i++) {
      a = pairs[i].bodyA; b = pairs[i].bodyB;
      if (a.plugin.tier == null || b.plugin.tier == null) continue;
      if (a.plugin.tier !== b.plugin.tier) continue;
      t = a.plugin.tier;
      if (t >= D.RANKS.length - 1) continue;
      if (mergeFlags[a.id] || mergeFlags[b.id]) continue;
      mergeFlags[a.id] = true; mergeFlags[b.id] = true;
      pendingMerges.push({ a: a, b: b, tier: t });
    }
  }

  function processMerges() {
    if (!pendingMerges.length) return;
    var i, m, mx, my, nb;
    for (i = 0; i < pendingMerges.length; i++) {
      m = pendingMerges[i];
      if (!m.a.plugin || m.a.plugin.merged || !m.b.plugin || m.b.plugin.merged) continue;
      m.a.plugin.merged = true; m.b.plugin.merged = true;
      mx = (m.a.position.x + m.b.position.x) / 2;
      my = (m.a.position.y + m.b.position.y) / 2;
      Matter.World.remove(world, m.a);
      Matter.World.remove(world, m.b);
      nb = makeBody(m.tier + 1, mx, my);
      Matter.Body.setVelocity(nb, { x: 0, y: -1.5 });
      Matter.World.add(world, nb);
      score += (m.tier + 1) * (m.tier + 1) * 5;
      career[m.tier + 1] = (career[m.tier + 1] || 0) + 1;
      saveCareer();
      effects.push({ x: mx, y: my, r: D.RANKS[m.tier + 1].size, t: 0 });
      if (!factShown[m.tier + 1]) {
        factShown[m.tier + 1] = true;
        showFact(m.tier + 1);
      }
      if (m.tier + 1 === D.RANKS.length - 1) {
        setTimeout(function () { endGame("win"); }, 600);
      }
    }
    pendingMerges = []; mergeFlags = {};
  }

  function drop() {
    if (state !== "play") return;
    var r = D.RANKS[currentTier].size;
    var x = Math.max(containerL + r + 2, Math.min(containerR - r - 2, aimX));
    var b = makeBody(currentTier, x, dropY);
    Matter.World.add(world, b);
    currentTier = nextTier;
    nextTier = randDropTier();
  }

  function checkOver(dt) {
    var bodies = Matter.Composite.allBodies(world);
    var i, b, top;
    var above = false;
    var now = performance.now();
    for (i = 0; i < bodies.length; i++) {
      b = bodies[i];
      if (b.plugin.tier == null) continue;
      if (now - b.plugin.born < 600) continue;
      top = b.position.y - b.circleRadius;
      if (top < dangerY && Math.abs(b.velocity.y) < 4) { above = true; break; }
    }
    if (above) { overTimer += dt; if (overTimer > 0.7) endGame("over"); }
    else overTimer = 0;
  }

  function endGame(reason) {
    if (state !== "play") return;
    state = reason === "win" ? "win" : "over";
    best = Math.max(best, score);
    try { localStorage.setItem("keju-best", String(best)); } catch (e) {}
    showOverlay(reason);
  }

  function showFact(tier) {
    var rk = D.RANKS[tier];
    toastEl.innerHTML = "<b>" + rk.name + "</b>" + rk.fact;
    toastEl.classList.add("is-on");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 3400);
  }

  var overlay = document.getElementById("overlay");
  var ovShare = document.getElementById("ov-share");
  var ovCareer = document.getElementById("ov-career");
  var settleBtn = document.getElementById("btn-settle");

  function careerText() {
    var z = career[7] || 0, b = career[6] || 0, t = career[5] || 0;
    return "仕途累计 · 状元×" + z + " 榜眼×" + b + " 探花×" + t;
  }

  function showOverlay(reason) {
    var t = document.getElementById("ov-title");
    var s = document.getElementById("ov-sub");
    var btn = document.getElementById("ov-btn");
    if (reason === "win") {
      t.textContent = "金榜题名 · 状元及第";
      s.textContent = "连中三元，独占鳌头！得分 " + score;
      btn.textContent = "再考一次";
    } else if (reason === "settle") {
      t.textContent = "收卷结算";
      s.textContent = "本场得分 " + score + " · 最佳 " + best;
      btn.textContent = "再考一次";
    } else {
      t.textContent = "名落孙山";
      s.textContent = "卷面堆叠溢出，得分 " + score + " · 最佳 " + best;
      btn.textContent = "重新赶考";
    }
    ovCareer.textContent = careerText();
    ovShare.classList.add("is-on");
    overlay.classList.add("is-on");
    settleBtn.classList.remove("is-on");
  }
  function hideOverlay() { overlay.classList.remove("is-on"); }

  function initMenu() {
    ovCareer.textContent = careerText();
    ovShare.classList.remove("is-on");
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawIcon(tier, s) {
    ctx.save();
    var k = s / 30;
    ctx.scale(k, k);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    var INK = "#23262c", GOLD = "#E6B422", RED = "#C3272B", i, a;
    if (tier === 0) {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(0, -4, 10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -17, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-11, -8); ctx.lineTo(-16, -2); ctx.stroke();
    } else if (tier === 1) {
      ctx.fillStyle = INK;
      roundRect(-16, -22, 32, 18, 5); ctx.fill();
      ctx.fillRect(-19, -6, 38, 6);
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-16, -13); ctx.lineTo(16, -13); ctx.stroke();
    } else if (tier === 2) {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(0, -8, 18, 14, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -8, 19, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -24, 4.5, 0, Math.PI * 2); ctx.fill();
    } else if (tier === 3) {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(0, -9, 18, 15, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -9, 19, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-4, -32, 8, 14);
      ctx.fillStyle = GOLD;
      ctx.beginPath(); ctx.arc(0, -33, 4.5, 0, Math.PI * 2); ctx.fill();
    } else {
      var wing = tier === 4 ? 11 : tier === 5 ? 11 : tier === 6 ? 17 : 24;
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(0, -11, 17, 14, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -7, 23, 7, 0, 0, Math.PI * 2); ctx.fill();
      roundRect(-23 - wing, -14, wing + 2, 8, 4); ctx.fill();
      roundRect(21, -14, wing + 2, 8, 4); ctx.fill();
      if (tier === 5) {
        ctx.fillStyle = RED;
        for (i = 0; i < 5; i++) {
          a = i / 5 * Math.PI * 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 5.5, -29 + Math.sin(a) * 5.5, 3.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = GOLD;
        ctx.beginPath(); ctx.arc(0, -29, 2.8, 0, Math.PI * 2); ctx.fill();
      } else if (tier === 7) {
        ctx.fillStyle = GOLD;
        for (i = 0; i < 6; i++) {
          a = i / 6 * Math.PI * 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 6, -30 + Math.sin(a) * 6, 3.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = RED;
        ctx.beginPath(); ctx.arc(0, -30, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = RED; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-23, -4); ctx.quadraticCurveTo(-30, 6, -26, 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(23, -4); ctx.quadraticCurveTo(30, 6, 26, 14); ctx.stroke();
      } else {
        ctx.fillStyle = GOLD;
        ctx.beginPath(); ctx.arc(0, -27, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawToken(x, y, tier, angle, alpha, rOverride) {
    var rk = D.RANKS[tier], r = rOverride != null ? rOverride : rk.size;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = rk.color;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(0, 0, r - ctx.lineWidth, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, -r * 0.30);
    drawIcon(tier, r * 0.52);
    ctx.restore();
    ctx.fillStyle = rk.text;
    var fs = Math.max(9, r * 0.46);
    ctx.font = "700 " + fs + 'px "Kaiti SC","STKaiti","KaiTi",serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rk.name, 0, r * 0.55);
    ctx.restore();
  }

  function render(dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#F5F0E6";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#EFE8D8";
    ctx.fillRect(containerL, dangerY, containerR - containerL, containerB - dangerY);
    ctx.strokeStyle = "#C3272B";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(containerL, dangerY - 40);
    ctx.lineTo(containerL, containerB);
    ctx.lineTo(containerR, containerB);
    ctx.lineTo(containerR, dangerY - 40);
    ctx.stroke();

    ctx.strokeStyle = "rgba(195,39,43,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(containerL, dangerY);
    ctx.lineTo(containerR, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);

    var bodies = Matter.Composite.allBodies(world), i, b;
    for (i = 0; i < bodies.length; i++) {
      b = bodies[i];
      if (b.plugin.tier == null) continue;
      drawToken(b.position.x, b.position.y, b.plugin.tier, b.angle, 1);
    }

    for (i = 0; i < effects.length; i++) {
      var e = effects[i];
      e.t += dt;
      var p = e.t / 0.4;
      if (p >= 1) { effects.splice(i, 1); i--; continue; }
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.strokeStyle = "#E6B422";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + p * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (state === "play") {
      var r = D.RANKS[currentTier].size;
      var hx = Math.max(containerL + r + 2, Math.min(containerR - r - 2, aimX));
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = "#425066";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(hx, dropY + r);
      ctx.lineTo(hx, containerB - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      drawToken(hx, dropY, currentTier, 0, 0.95);

      drawToken(containerR - 30, 46, nextTier, 0, 0.9, 20);
      ctx.fillStyle = "#8a6a4a";
      ctx.font = '12px "Kaiti SC","STKaiti","KaiTi",serif';
      ctx.textAlign = "center";
      ctx.fillText("下一个", containerR - 30, 78);
    }

    ctx.fillStyle = "#425066";
    ctx.font = '700 26px "Kaiti SC","STKaiti","KaiTi",serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("分 " + score, containerL, 52);
    ctx.font = '13px "Kaiti SC","STKaiti","KaiTi",serif';
    ctx.fillStyle = "#8a6a4a";
    ctx.fillText("最佳 " + best, containerL, 74);
  }

  function rightBodies() {
    var bodies = Matter.Composite.allBodies(world), i, b;
    for (i = 0; i < bodies.length; i++) {
      b = bodies[i];
      if (b.plugin.tier == null) continue;
      b.angularVelocity *= 0.92;
      b.torque = -0.00006 * Math.sin(b.angle) * b.inertia;
    }
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 0.033);
    lastTs = ts;
    if (state === "play") {
      rightBodies();
      Matter.Engine.update(engine, dt * 1000);
      processMerges();
      checkOver(dt);
    }
    render(dt);
    requestAnimationFrame(loop);
  }

  function paintShareCard(win) {
    var c = document.createElement("canvas");
    c.width = 900; c.height = 1200;
    var g = c.getContext("2d");
    var savedCtx = ctx;
    ctx = g;
    g.fillStyle = "#F5F0E6";
    g.fillRect(0, 0, 900, 1200);
    g.strokeStyle = "#C3272B";
    g.lineWidth = 6;
    g.strokeRect(24, 24, 852, 1152);
    g.lineWidth = 2;
    g.strokeRect(40, 40, 820, 1120);
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#425066";
    g.font = '700 66px "Kaiti SC","STKaiti","KaiTi",serif';
    g.fillText(win ? "金榜题名" : "科举合成", 450, 160);
    g.font = '30px "Kaiti SC","STKaiti","KaiTi",serif';
    g.fillStyle = "#8a6a4a";
    g.fillText(win ? "状元及第 · 独占鳌头" : "名落孙山 · 重整旗鼓", 450, 215);
    drawToken(450, 430, 7, 0, 1, 150);
    g.fillStyle = "#425066";
    g.font = '700 56px "Kaiti SC","STKaiti","KaiTi",serif';
    g.fillText("得分 " + score, 450, 680);
    g.font = '30px "Kaiti SC","STKaiti","KaiTi",serif';
    g.fillStyle = "#8a6a4a";
    g.fillText("最佳 " + best, 450, 735);
    g.font = '34px "Kaiti SC","STKaiti","KaiTi",serif';
    g.fillStyle = "#C3272B";
    g.fillText(careerText(), 450, 820);
    g.font = '26px "Kaiti SC","STKaiti","KaiTi",serif';
    g.fillStyle = "#8a6a4a";
    g.fillText("非遗手作坊 · 科举合成", 450, 1120);
    ctx = savedCtx;
    return c.toDataURL("image/png");
  }

  function shareFallback() { alert("当前环境暂不支持直接保存，请截图保存哦"); }
  function shareTitle() {
    var z = career[7] || 0;
    var t = "我在科举合成合出了" + z + "个状元";
    if (t.length > 20) t = t.substring(0, 20);
    return t;
  }
  function doShare(kind) {
    var mt = window.xhs && window.xhs.miniTool;
    var win = (state === "win");
    var dataUrl = paintShareCard(win);
    if (!mt) { shareFallback(); return; }
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) {
        if (kind === "album") {
          mt.saveImageToPhotosAlbum({
            filePath: res.filePath,
            success: function () { alert("已保存到相册"); },
            fail: shareFallback
          });
        } else {
          mt.postNote({
            title: shareTitle(),
            content: "两个相同功名相合即晋升，从童生一路合到状元。我在「科举合成」考了个" + (win ? "状元及第" : "名落孙山") + "！",
            tags: "#国风vibecoding #科举 #合成大西瓜 #非遗 #国风 #中式美学",
            mediaInfo: { image_resources: [{ url: res.filePath }] },
            fail: shareFallback
          });
        }
      },
      fail: shareFallback
    });
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (state === "play") aimX = e.clientX;
  });
  canvas.addEventListener("pointermove", function (e) {
    if (state === "play") aimX = e.clientX;
  });
  canvas.addEventListener("pointerup", function () { drop(); });
  document.getElementById("ov-btn").addEventListener("click", function () { startGame(); });
  document.getElementById("btn-settle").addEventListener("click", function () { endGame("settle"); });
  document.getElementById("btn-save-album").addEventListener("click", function () { doShare("album"); });
  document.getElementById("btn-post-note").addEventListener("click", function () { doShare("note"); });
  window.addEventListener("resize", resize);

  try { best = parseInt(localStorage.getItem("keju-best") || "0", 10) || 0; } catch (e) { best = 0; }

  engine = Matter.Engine.create();
  world = engine.world;
  engine.gravity.y = 1;
  Matter.Events.on(engine, "collisionStart", onCollision);
  resize();
  initMenu();
  requestAnimationFrame(loop);

  window.__game = {
    state: function () { return state; },
    score: function () { return score; },
    tiers: function () {
      var c = {}, bodies = Matter.Composite.allBodies(world), i, b;
      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        if (b.plugin.tier != null) c[b.plugin.tier] = (c[b.plugin.tier] || 0) + 1;
      }
      return c;
    },
    bodies: function () {
      var out = [], bodies = Matter.Composite.allBodies(world), i, b;
      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        if (b.plugin.tier != null) out.push({ t: b.plugin.tier, x: Math.round(b.position.x), y: Math.round(b.position.y) });
      }
      return out;
    },
    dropAt: function (x, tier) {
      if (state !== "play") startGame();
      if (tier != null) currentTier = tier;
      aimX = x;
      drop();
    },
    start: function () { startGame(); },
    end: function (win) { endGame(win ? "win" : "over"); },
    settle: function () { endGame("settle"); },
    career: function () { return career; },
    shareCard: function (win) { return paintShareCard(!!win); },
    topInfo: function () {
      var bs = Matter.Composite.allBodies(world).filter(function (x) { return x.plugin.tier != null; });
      bs.sort(function (a, b) { return a.position.y - b.position.y; });
      var now = performance.now();
      return bs.slice(0, 4).map(function (b) {
        return { tier: b.plugin.tier, top: Math.round(b.position.y - b.circleRadius), vy: +b.velocity.y.toFixed(2), age: Math.round(now - b.plugin.born) };
      });
    },
    dangerY: function () { return dangerY; }
  };
})();
