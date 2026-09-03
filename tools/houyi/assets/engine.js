/* ============================================================
   后羿射日 · 物理内核 (window.HYEngine)

   逐字承接 prototype.html 已验证的物理内核（40/40 检查通过）：
     · SHAPES 轮廓顶点 -> convexPart（重心归位 + Vertices.isConvex 校验）
     · 凹轮廓手工拆凸块 -> Body.create({parts}) 复合体（非矩形碰撞体）
     · Pattern B 发射：拖动矢量 -> Body.setVelocity（解锁轨迹预览）
     · 轨迹预览：解析积分严格复刻 Body.update 递推（maxErr 0.0057px）
     · 碰撞伤害：collision.parentA/parentB + 相对速度（非 penetration.depth）
       —— pair.bodyA/bodyB 是「凸块 part」，part.plugin 是空对象，读不到 hp
     · 固定步长 Engine.update(engine, 1000/60) + enableSleeping + 箭速封顶
     · 箭 frictionAir = 0（父体不继承子块值，显式归零 -> 纯抛物线）
   headless 引擎，不使用 Matter.Render。渲染在 scene.js。
   ============================================================ */
(function () {
  'use strict';

  var M = window.Matter;
  var D = window.HYData;

  var WORLD_W = D.WORLD_W, WORLD_H = D.WORLD_H, GROUND_Y = D.GROUND_Y;
  var STEP = D.STEP;
  var ANCHOR = D.ANCHOR;
  var MAX_PULL = D.MAX_PULL, POWER_SCALE = D.POWER_SCALE, MAX_SPEED = D.MAX_SPEED;
  var DAMAGE_SCALE = D.DAMAGE_SCALE, MIN_IMPACT = D.MIN_IMPACT;
  var BIRD_SCALE = D.BIRD_SCALE;
  var HP = D.HP;
  var SHAPES = D.SHAPES;
  var PART_ROLES = D.PART_ROLES;
  var C = D.C;

  /* ==========================================================================
     1. Matter 引擎（headless）
     ========================================================================== */
  var engine = M.Engine.create({ enableSleeping: true });
  var world = engine.world;
  engine.gravity.x = 0;
  engine.gravity.y = 1;
  engine.gravity.scale = 0.001;

  var GRAV_SCALE = (engine.gravity.scale !== undefined) ? engine.gravity.scale : 0.001;
  var GRAV_STEP_X = engine.gravity.x * GRAV_SCALE * STEP * STEP;
  var GRAV_STEP_Y = engine.gravity.y * GRAV_SCALE * STEP * STEP;

  var warnings = [];

  /* ==========================================================================
     2. 手工轮廓顶点 -> 凸块复合体
        Matter.js 0.19 未内建 poly-decomp -> 凹多边形会被静默 hull 成包围多边形，
        正是「幽灵碰撞区」的成因。因此凹轮廓一律手工拆成凸块 + Body.create({parts})。
     ========================================================================== */
  function vertsOf(arr) { return arr.map(function (p) { return { x: p[0], y: p[1] }; }); }

  /* Bodies.fromVertices(x,y) 把顶点集的「重心」放到 (x,y)，
     所以必须传入该凸块自身的重心，才能保住我们设计的局部坐标。 */
  function convexPart(arr, opts) {
    var v = vertsOf(arr);
    if (!M.Vertices.isConvex(v)) {
      warnings.push('凹多边形未拆分（会被 hull 成包围多边形）: ' + JSON.stringify(arr));
    }
    var c = M.Vertices.centre(v);
    var b = M.Bodies.fromVertices(c.x, c.y, v, opts);
    if (b.vertices.length !== v.length) {
      warnings.push('凸块被 Matter 改写（顶点数 ' + v.length + ' -> ' + b.vertices.length + '）');
    }
    return b;
  }

  function compoundFrom(shapeName, opts, scaleK) {
    var shape = SHAPES[shapeName];
    var names = Object.keys(shape);
    var parts = names.map(function (n) { return convexPart(shape[n], opts); });
    var body = M.Body.create({ parts: parts });
    if (scaleK && scaleK !== 1) M.Body.scale(body, scaleK, scaleK);
    body.plugin.kind = shapeName.indexOf('jinwu') === 0 ? 'jinwu'
      : shapeName.indexOf('trunk') === 0 || shapeName.indexOf('beam') === 0 ? 'fusan'
      : shapeName.indexOf('arrow') === 0 ? 'arrow' : shapeName;
    body.plugin.roles = PART_ROLES[shapeName] || names;
    body.plugin.shapeName = shapeName;
    return body;
  }

  /* ==========================================================================
     3. 实体工厂（参数与 prototype.html 完全一致）
     ========================================================================== */
  function makeJinwu(x, y, opt) {
    opt = opt || {};
    var b = compoundFrom('jinwu', {
      friction: 0.75, frictionStatic: 0.9, restitution: 0.04,
      density: 0.0010, slop: 0.02
    }, BIRD_SCALE);
    b.plugin.hp = HP.jinwu;
    b.plugin.maxHp = HP.jinwu;
    b.plugin.label = '金乌';
    M.Body.setPosition(b, { x: x, y: y });
    M.Body.setAngle(b, 0);
    M.Body.setVelocity(b, { x: 0, y: 0 });
    if (opt.isStatic) M.Body.setStatic(b, true);
    if (opt.spare) b.plugin.spare = true;
    return b;
  }

  function makeFusan(shapeName, x, y) {
    var b = compoundFrom(shapeName, {
      friction: 0.85, frictionStatic: 1.0, restitution: 0.02,
      density: 0.0018, slop: 0.02
    }, 1);
    b.plugin.hp = HP.fusan;
    b.plugin.maxHp = HP.fusan;
    b.plugin.label = '扶桑';
    M.Body.setPosition(b, { x: x, y: y });
    M.Body.setAngle(b, 0);
    return b;
  }

  function makeRilun(x, y, r) {
    var b = M.Bodies.circle(x, y, r, {
      friction: 0.95, frictionStatic: 1.0, restitution: 0.02,
      density: 0.0050, slop: 0.02
    });
    b.plugin.kind = 'rilun';
    b.plugin.hp = HP.rilun;
    b.plugin.maxHp = HP.rilun;
    b.plugin.label = '日轮';
    return b;
  }

  function makeArrow() {
    var b = compoundFrom('arrow', {
      friction: 0.3, restitution: 0.22, density: 0.0050,
      frictionAir: 0, slop: 0.01
    }, 1);
    /* Body.create({parts}) 的父体不继承子块的 frictionAir（默认 0.01），
       这里显式归零 -> 箭做纯抛物线运动，轨迹预览可解析精确复现。 */
    b.frictionAir = 0;
    for (var i = 0; i < b.parts.length; i++) b.parts[i].frictionAir = 0;
    b.plugin.kind = 'arrow';
    b.plugin.hp = Infinity;          // 箭不销毁，只回收
    b.plugin.label = '素缯';
    b.plugin.indestructible = true;
    return b;
  }

  /* 金乌足尖相对 body.position 的偏移（Body.create 会把 position 移到并集重心，
     所以不能直接用设计坐标）。用探针实测，保证栖息时零间隙接触。 */
  var _birdFootOffset = null;
  function birdFootOffset() {
    if (_birdFootOffset !== null) return _birdFootOffset;
    var probe = makeJinwu(0, 0);
    var bb = unionBounds(probe);
    _birdFootOffset = bb.max.y - probe.position.y;
    return _birdFootOffset;
  }

  /* 凸块并集包围盒（父体 parts[0] 是父体自身，跳过） */
  function unionBounds(b) {
    var ps = b.parts, mn = { x: Infinity, y: Infinity }, mx = { x: -Infinity, y: -Infinity };
    for (var i = (ps.length > 1 ? 1 : 0); i < ps.length; i++) {
      var bd = ps[i].bounds;
      if (bd.min.x < mn.x) mn.x = bd.min.x;
      if (bd.min.y < mn.y) mn.y = bd.min.y;
      if (bd.max.x > mx.x) mx.x = bd.max.x;
      if (bd.max.y > mx.y) mx.y = bd.max.y;
    }
    return { min: mn, max: mx };
  }

  /* 记下「包围盒中心相对 body.position 的局部偏移」。
     刚建体时 angle=0，所以这就是素材图的贴齐基准：
     图片模式与程序化轮廓模式共用同一 SHAPES bbox（美术可零改动替换）。 */
  function stampBox(b) {
    var bb = unionBounds(b);
    b.plugin.box = {
      dx: (bb.min.x + bb.max.x) / 2 - b.position.x,
      dy: (bb.min.y + bb.max.y) / 2 - b.position.y,
      w: bb.max.x - bb.min.x,
      h: bb.max.y - bb.min.y
    };
    return b.plugin.box;
  }

  /* ==========================================================================
     4. 世界边界（矩形仅用于静态地面 / 墙）
     ========================================================================== */
  var statics = [];
  function buildStatics() {
    statics.forEach(function (s) { M.Composite.remove(world, s); });
    statics = [];
    var t = 80;
    var g = M.Bodies.rectangle(WORLD_W / 2, GROUND_Y + t / 2, WORLD_W * 2, t, {
      isStatic: true, friction: 0.95, label: 'ground'
    });
    var lw = M.Bodies.rectangle(-t / 2, WORLD_H / 2, t, WORLD_H * 3, { isStatic: true, friction: 0.4 });
    var rw = M.Bodies.rectangle(WORLD_W + t / 2, WORLD_H / 2, t, WORLD_H * 3, { isStatic: true, friction: 0.4 });
    g.plugin.kind = 'ground'; g.plugin.label = '地面';
    lw.plugin.kind = 'wall'; rw.plugin.kind = 'wall';
    statics = [g, lw, rw];
    M.Composite.add(world, statics);
  }

  /* ==========================================================================
     5. 运行状态 + 关卡
     ========================================================================== */
  var S = null;
  var endTimer = 0;

  function newState(levelIdx) {
    var lv = D.LEVELS[levelIdx] || D.LEVELS[0];
    return {
      levelIdx: levelIdx,
      level: lv,
      goal: lv.goal || 'birds',
      mode: 'level',                 // 'level' | 'range'
      birds: [], blocks: [], suns: [],
      arrow: null, arrowInFlight: false, flightFrames: 0, slowFrames: 0, restFrames: 0,
      arrowsLeft: lv.arrows || D.ARROWS_PER_LEVEL,
      arrowsTotal: lv.arrows || D.ARROWS_PER_LEVEL,
      birdsTotal: lv.birds.length,
      sunsTotal: lv.suns.length,
      birdsKilled: 0, sunsKilled: 0, blocksKilled: 0,
      phase: 'ready',                // ready | dragging | flying | won | lost
      nock: { x: ANCHOR.x, y: ANCHOR.y },
      dragActive: false,
      previewPts: [],
      hitLog: [], particles: [], rings: [], arrowTrack: [],
      debugOn: false,
      pendingRetire: 0,
      frameCount: 0,
      rangeBird: null, rangeVerdict: null,
      result: null
    };
  }

  function clearWorld() {
    M.Composite.allBodies(world).slice().forEach(function (b) {
      if (statics.indexOf(b) < 0) M.Composite.remove(world, b);
    });
  }

  function addBlock(b) { stampBox(b); S.blocks.push(b); M.Composite.add(world, b); }
  function addSun(b) { stampBox(b); S.suns.push(b); M.Composite.add(world, b); }
  function addBird(b) { stampBox(b); S.birds.push(b); M.Composite.add(world, b); }

  /* 零间隙精确堆叠（接触面全部平整）：关卡坐标已按 SHAPES 半高对齐；
     金乌 perchY = 枝顶 y，减去实测足尖偏移即为零间隙栖息。 */
  function buildLevel(levelIdx) {
    S = newState(levelIdx);
    endTimer = 0;
    clearWorld();
    buildStatics();

    var lv = S.level, i;
    var FOOT = birdFootOffset();

    for (i = 0; i < lv.blocks.length; i++) {
      addBlock(makeFusan(lv.blocks[i].shape, lv.blocks[i].x, lv.blocks[i].y));
    }
    for (i = 0; i < lv.suns.length; i++) {
      addSun(makeRilun(lv.suns[i].x, lv.suns[i].y, lv.suns[i].r));
    }
    for (i = 0; i < lv.birds.length; i++) {
      var bd = lv.birds[i];
      var bird = makeJinwu(bd.x, bd.perchY - FOOT, { spare: !!bd.spare });
      if (bd.spare) bird.plugin.label = '留一日';
      addBird(bird);
    }

    loadArrow();
    settle(200);
    return S;
  }

  /* 靶场（仅测试面：单只悬空静态金乌，四周无物 -> 命中判定只能来自轮廓） */
  function buildRange() {
    S = newState(0);
    S.mode = 'range';
    S.debugOn = true;
    endTimer = 0;
    clearWorld();
    buildStatics();
    S.rangeBird = makeJinwu(900, 392, { isStatic: true });
    addBird(S.rangeBird);
    S.arrowsLeft = 99;
    S.arrowsTotal = 99;
    S.phase = 'ready';
    loadArrow();
    return S;
  }

  function loadArrow() {
    if (S.phase === 'won' || S.phase === 'lost') { S.arrowInFlight = false; return; }
    if (S.arrow) M.Composite.remove(world, S.arrow);
    S.arrow = makeArrow();
    stampBox(S.arrow);
    M.Body.setPosition(S.arrow, { x: ANCHOR.x, y: ANCHOR.y });
    M.Body.setStatic(S.arrow, true);          // 待发射：静止挂在弓上
    M.Composite.add(world, S.arrow);
    S.arrowInFlight = false; S.flightFrames = 0; S.slowFrames = 0; S.restFrames = 0;
    // 不清 arrowTrack：上一箭的实测轨迹要留给验证比对
    S.phase = 'ready';
    S.nock.x = ANCHOR.x; S.nock.y = ANCHOR.y;
  }

  function settle(n) { for (var i = 0; i < n; i++) M.Engine.update(engine, STEP); }

  /* ==========================================================================
     6. 轨迹预览 —— 解析积分，严格复刻 Matter.Body.update 的递推
     ========================================================================== */
  function simulate(sx, sy, vx, vy, maxSteps) {
    var fr = 1 - (S && S.arrow ? S.arrow.frictionAir : 0);
    var x = sx, y = sy, cvx = vx, cvy = vy, pts = [];
    for (var i = 0; i < maxSteps; i++) {
      cvx = cvx * fr + GRAV_STEP_X;
      cvy = cvy * fr + GRAV_STEP_Y;
      x += cvx; y += cvy;
      pts.push({ x: x, y: y, i: i, vx: cvx, vy: cvy });
      if (y > GROUND_Y - 2 || x > WORLD_W + 40 || x < -40) break;
    }
    return pts;
  }

  function launchVector() {
    var dx = ANCHOR.x - S.nock.x, dy = ANCHOR.y - S.nock.y;
    var dist = Math.hypot(dx, dy);
    var power = Math.min(dist, MAX_PULL) * POWER_SCALE;
    var angle = Math.atan2(dy, dx);
    return { vx: Math.cos(angle) * power, vy: Math.sin(angle) * power, angle: angle, power: power };
  }

  /* ==========================================================================
     7. 发射（Pattern B：拖动矢量 -> Body.setVelocity）
     ========================================================================== */
  function launch(vx, vy, fromX, fromY) {
    if (!S || !S.arrow || S.arrowInFlight) return false;
    if (S.phase === 'won' || S.phase === 'lost') return false;
    if (S.mode === 'level' && S.arrowsLeft <= 0) return false;   // 限箭数
    var fx = (fromX === undefined) ? S.nock.x : fromX;
    var fy = (fromY === undefined) ? S.nock.y : fromY;
    M.Body.setStatic(S.arrow, false);
    M.Body.setPosition(S.arrow, { x: fx, y: fy });
    M.Body.setAngle(S.arrow, Math.atan2(vy, vx));
    M.Body.setAngularVelocity(S.arrow, 0);
    M.Body.setVelocity(S.arrow, { x: vx, y: vy });
    M.Body.setSpeed(S.arrow, Math.min(M.Body.getSpeed(S.arrow), MAX_SPEED));   // 封顶防穿透
    M.Body.set(S.arrow, 'isSleeping', false);
    M.Sleeping.set(S.arrow, false);
    S.arrowInFlight = true; S.flightFrames = 0; S.slowFrames = 0; S.restFrames = 0;
    S.arrowsLeft = Math.max(0, S.arrowsLeft - 1);
    S.phase = 'flying';
    S.previewPts = [];
    S.dragActive = false;
    S.arrowTrack = [];
    return true;
  }

  function retireArrow() {
    if (!S.arrow) return;
    spawnPuff(S.arrow.position.x, S.arrow.position.y, 6, C.arrowShaft);
    S.arrowInFlight = false;
    if (S.arrowsLeft <= 0) {
      S.pendingRetire = 90;            // 让坍塌演完再判负
    } else {
      loadArrow();
    }
  }

  /* ==========================================================================
     8. 碰撞伤害（相对速度，非 penetration.depth）
     ========================================================================== */
  M.Events.on(engine, 'collisionStart', function (ev) {
    if (!S) return;
    for (var i = 0; i < ev.pairs.length; i++) {
      var pair = ev.pairs[i];
      /* 关键：pair.bodyA/bodyB 是「凸块 part」，不是父体。
         part.plugin 是空对象 -> 读不到 hp，伤害永远不结算。
         必须用 collision.parentA/parentB 拿到真正的父体（复合轮廓体的宿主）。 */
      var col = pair.collision;
      var a = (col && col.parentA) || pair.bodyA.parent || pair.bodyA;
      var b = (col && col.parentB) || pair.bodyB.parent || pair.bodyB;
      if (a === b) continue;
      var rel = M.Vector.sub(a.velocity, b.velocity);
      var impact = M.Vector.magnitude(rel);          // 相对速度，非 penetration.depth
      var cp = col && col.supports && col.supports[0];
      var px = cp ? cp.x : (a.position.x + b.position.x) / 2;
      var py = cp ? cp.y : (a.position.y + b.position.y) / 2;
      damage(a, b, impact, px, py);
      damage(b, a, impact, px, py);
      if (impact >= MIN_IMPACT && !isGroundOrWall(a) && !isGroundOrWall(b)) {
        S.rings.push({ x: px, y: py, t: 0, r: 6 + impact * 1.6 });
      }
    }
  });

  function isGroundOrWall(b) { return b.plugin && (b.plugin.kind === 'ground' || b.plugin.kind === 'wall'); }

  function damage(victim, attacker, impact, px, py) {
    var p = victim.plugin;
    // 地面/墙体没有 hp 字段，自动被第一行挡掉
    if (!p || p.hp === undefined || p.indestructible || p.dead) return;
    if (isGroundOrWall(victim)) return;
    if (impact < MIN_IMPACT) return;                 // 静置接触不结算
    var dmg = impact * DAMAGE_SCALE;
    p.hp -= dmg;
    S.hitLog.push({
      kind: p.kind, label: p.label, impact: +impact.toFixed(2),
      dmg: +dmg.toFixed(1), hpAfter: +Math.max(0, p.hp).toFixed(1),
      killed: p.hp <= 0, by: attacker.plugin ? attacker.plugin.label : '?',
      at: { x: Math.round(px), y: Math.round(py) }, mode: S.mode,
      frame: S.frameCount, arrowFrame: S.arrowInFlight ? S.flightFrames : -1
    });
    spawnPuff(px, py, Math.min(10, 3 + impact), p.kind === 'jinwu' ? C.jinwuFlame
      : p.kind === 'rilun' ? C.rilunRing : C.knot);
    if (p.hp <= 0) destroy(victim, px, py);
  }

  function destroy(body, px, py) {
    var p = body.plugin;
    p.dead = true;
    spawnDebris(body);
    M.Composite.remove(world, body);
    var i;
    if ((i = S.birds.indexOf(body)) >= 0) { S.birds.splice(i, 1); S.birdsKilled++; }
    if ((i = S.blocks.indexOf(body)) >= 0) { S.blocks.splice(i, 1); S.blocksKilled++; }
    if ((i = S.suns.indexOf(body)) >= 0) { S.suns.splice(i, 1); S.sunsKilled++; }
    S.rings.push({ x: px || body.position.x, y: py || body.position.y, t: 0, r: 30, big: true });
    checkEnd();
  }

  /* ==========================================================================
     9. 碎屑粒子
     ========================================================================== */
  function spawnDebris(body) {
    var p = body.plugin, col;
    if (p.kind === 'jinwu') col = [C.jinwuBody, C.jinwuWing, C.jinwuFlame, C.jinwuHead];
    else if (p.kind === 'rilun') col = [C.rilunRing, C.rilunCore, C.rilunRay];
    else if (p.kind === 'arrow') col = [C.arrowShaft];
    else col = [C.bark, C.barkDark, C.moss, C.knot];
    var n = p.kind === 'jinwu' ? 26 : p.kind === 'rilun' ? 18 : 14;
    var bx = body.bounds, cx = body.position.x, cy = body.position.y;
    var sz = Math.max(12, (bx.max.x - bx.min.x) * 0.22);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 4.2;
      S.particles.push({
        x: cx + (Math.random() - 0.5) * sz, y: cy + (Math.random() - 0.5) * sz,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.6,
        r: 1.6 + Math.random() * (p.kind === 'jinwu' ? 4.2 : 3.2),
        c: col[(Math.random() * col.length) | 0],
        life: 0, max: 46 + Math.random() * 46,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.28,
        sq: Math.random() < 0.55
      });
    }
    if (p.kind === 'jinwu') {
      // 金乌陨落：坠其羽翼（王逸注「日中九乌皆死，堕其羽翼」）
      for (var j = 0; j < 8; j++) {
        S.particles.push({
          x: cx + (Math.random() - 0.5) * 40, y: cy,
          vx: (Math.random() - 0.5) * 2.2, vy: -0.4 - Math.random() * 1.2,
          r: 5 + Math.random() * 5, c: C.jinwuWing, life: 0, max: 130,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.06, feather: true
        });
      }
    }
  }

  function spawnPuff(x, y, n, col) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 2.4;
      S.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.8,
        r: 1.2 + Math.random() * 2.2, c: col, life: 0, max: 22 + Math.random() * 20,
        rot: 0, vr: 0, sq: false
      });
    }
  }

  function stepParticles() {
    for (var i = S.particles.length - 1; i >= 0; i--) {
      var p = S.particles[i];
      p.life++;
      if (p.life >= p.max) { S.particles.splice(i, 1); continue; }
      p.vy += p.feather ? 0.035 : 0.16;
      p.vx *= p.feather ? 0.995 : 0.985;
      p.vy *= p.feather ? 0.995 : 0.985;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > GROUND_Y) { p.y = GROUND_Y; p.vy *= -0.28; p.vx *= 0.7; }
    }
    for (var j = S.rings.length - 1; j >= 0; j--) {
      S.rings[j].t++;
      if (S.rings[j].t > 26) S.rings.splice(j, 1);
    }
  }

  /* ==========================================================================
     10. 胜负（射九日留一日）
     ========================================================================== */
  function buildResult(win, reason) {
    var lv = S.level;
    var used = S.arrowsTotal - S.arrowsLeft;
    var kills = S.goal === 'spare' ? S.sunsKilled : S.birdsKilled;
    var score = kills * 120 + S.sunsKilled * 25 + S.blocksKilled * 15
              + Math.max(0, S.arrowsLeft) * 40;
    var stars = win ? (S.arrowsLeft >= 2 ? 3 : S.arrowsLeft >= 1 ? 2 : 1) : 0;
    return {
      win: !!win, reason: reason,
      levelIdx: S.levelIdx, levelId: lv.id, levelName: lv.name, order: lv.order,
      goal: S.goal, arrowsUsed: used, arrowsLeft: S.arrowsLeft, arrowsTotal: S.arrowsTotal,
      birdsKilled: S.birdsKilled, sunsKilled: S.sunsKilled, blocksKilled: S.blocksKilled,
      score: score, stars: stars, knowledge: lv.knowledge
    };
  }

  function checkEnd() {
    if (!S || S.phase === 'won' || S.phase === 'lost') return;
    if (S.goal === 'spare') {
      // 留一日：最后一只金乌被杀 = 十日俱灭，立刻失败
      if (S.birds.length === 0) { S.phase = 'lost'; S.result = buildResult(false, 'spare-killed'); return; }
      if (S.suns.length === 0) { S.phase = 'won'; S.result = buildResult(true, 'clear'); }
      return;
    }
    if (S.birds.length === 0) { S.phase = 'won'; S.result = buildResult(true, 'clear'); }
  }

  function checkLose() {
    if (S.phase !== 'flying' && S.phase !== 'ready') return;
    var remaining = S.goal === 'spare' ? S.suns.length : S.birds.length;
    if (remaining > 0 && S.arrowsLeft <= 0 && !S.arrowInFlight) {
      if (S.pendingRetire > 0) return;
      endTimer++;
      if (endTimer > 90) { S.phase = 'lost'; S.result = buildResult(false, 'arrows'); }
    } else endTimer = 0;
  }

  /* ==========================================================================
     11. 拖动（供指针输入与 demo 自驾共用）
     ========================================================================== */
  function setNock(p) {
    var dx = p.x - ANCHOR.x, dy = p.y - ANCHOR.y;
    var d = Math.hypot(dx, dy);
    var k = d > MAX_PULL ? MAX_PULL / d : 1;
    S.nock.x = ANCHOR.x + dx * k;
    S.nock.y = ANCHOR.y + dy * k;
    var v = launchVector();
    S.previewPts = v.power < 1.2 ? [] : simulate(S.nock.x, S.nock.y, v.vx, v.vy, 110);
    S.phase = 'dragging';
    return S.previewPts.length;
  }

  /* 由发射矢量反解拉弓点（demo 自驾用：把轨迹预览画在镜头上再松手） */
  function nockForVector(vx, vy) {
    var power = Math.hypot(vx, vy);
    if (power < 0.0001) return { x: ANCHOR.x, y: ANCHOR.y };
    var dist = Math.min(power / POWER_SCALE, MAX_PULL);
    return {
      x: ANCHOR.x - (vx / power) * dist,
      y: ANCHOR.y - (vy / power) * dist
    };
  }

  /* ==========================================================================
     12. 轮廓 / 包围盒判定（碰撞精度自检）
     ========================================================================== */
  function pip(vs, x, y) {
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      var xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inSilhouette(b, x, y) {
    var ps = b.parts;
    if (b.circleRadius) return Math.hypot(x - b.position.x, y - b.position.y) <= b.circleRadius;
    for (var i = 1; i < ps.length; i++) if (pip(ps[i].vertices, x, y)) return true;
    return false;
  }
  function inBBox(b, x, y) {
    var bb = unionBounds(b);
    return x >= bb.min.x && x <= bb.max.x && y >= bb.min.y && y <= bb.max.y;
  }

  /* 在 bbox 内找出所有「以 clearance 为半径完全落在幽灵区」的候选靶点。
     幽灵区 = 矩形包围盒会误判为碰撞、而轮廓碰撞体不会的区域。 */
  function findGhostPoints(b, clearance) {
    var bb = unionBounds(b), out = [], x, y, a, clear, th;
    for (x = bb.min.x + 2; x <= bb.max.x - 2; x += 4) {
      for (y = bb.min.y + 2; y <= bb.max.y - 2; y += 4) {
        if (inSilhouette(b, x, y)) continue;
        clear = true;
        for (a = 0; a < 16; a++) {
          th = a / 16 * 6.283;
          if (inSilhouette(b, x + Math.cos(th) * clearance, y + Math.sin(th) * clearance)) { clear = false; break; }
        }
        if (!clear) continue;
        out.push({ x: x, y: y });
      }
    }
    var w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;
    out.sort(function (p, q) {
      var sp = (p.x - bb.min.x) / w * 1.2 + (p.y - bb.min.y) / h;
      var sq = (q.x - bb.min.x) / w * 1.2 + (q.y - bb.min.y) / h;
      return sq - sp;          // 靠右下的角优先（箭自左飞来最自然）
    });
    return out;
  }

  /* 求解：遍历 (角度, 力度)，用与预览完全相同的积分器模拟。 */
  function solveAim(tx, ty, requireMiss, targetBody) {
    var cands = [], ai, pw, ang, vx, vy, pts, i, err;
    var nx = S.nock.x, ny = S.nock.y;
    for (ai = 0; ai <= 176; ai++) {
      ang = (-88 + ai * 1.0) * Math.PI / 180;
      for (pw = 6; pw <= MAX_PULL * POWER_SCALE + 0.001; pw += 0.5) {
        vx = Math.cos(ang) * pw; vy = Math.sin(ang) * pw;
        pts = simulate(nx, ny, vx, vy, 170);
        for (i = 0; i < pts.length; i++) {
          err = Math.hypot(pts[i].x - tx, pts[i].y - ty);
          if (err <= 4) { cands.push({ vx: vx, vy: vy, ang: ang, pw: pw, err: err, pts: pts }); break; }
        }
      }
    }
    cands.sort(function (a, b) { return a.err - b.err; });
    if (!cands.length) return null;
    if (!requireMiss) {
      var c0 = cands[0];
      return { vx: c0.vx, vy: c0.vy, ang: c0.ang, pw: c0.pw, err: c0.err, passesThroughBBox: false };
    }
    for (i = 0; i < cands.length && i < 60; i++) {
      var chk = checkArrowMisses(cands[i].pts, targetBody);
      if (chk.ok && chk.inBox) {
        cands[i].passesThroughBBox = true;
        return { vx: cands[i].vx, vy: cands[i].vy, ang: cands[i].ang, pw: cands[i].pw, err: cands[i].err, passesThroughBBox: true };
      }
    }
    return null;
  }

  /* 沿弹道逐步摆放箭体（52 长，9 个采样点），全程不得进入轮廓；
     同时确认箭心确实进入过矩形包围盒（否则对照无意义）。 */
  function checkArrowMisses(pts, b) {
    var inBox = false, s, q, seg, off, sx, sy;
    var offsets = [-25, -19, -13, -7, 0, 7, 13, 20, 27];
    for (s = 0; s < pts.length; s++) {
      if (inBBox(b, pts[s].x, pts[s].y)) inBox = true;
      seg = Math.atan2(pts[s].vy, pts[s].vx);
      for (q = 0; q < offsets.length; q++) {
        off = offsets[q];
        sx = pts[s].x + Math.cos(seg) * off;
        sy = pts[s].y + Math.sin(seg) * off;
        if (inSilhouette(b, sx, sy)) return { ok: false, inBox: inBox };
      }
    }
    return { ok: true, inBox: inBox };
  }

  function rangeShot(kind) {
    if (!S || S.mode !== 'range' || !S.rangeBird) return null;
    if (S.arrowInFlight) return null;
    var sol, gp;
    if (kind === 'ghost') {
      var cands = findGhostPoints(S.rangeBird, 30);
      if (!cands.length) return null;
      for (var ci = 0; ci < cands.length && ci < 40; ci++) {
        sol = solveAim(cands[ci].x, cands[ci].y, true, S.rangeBird);
        if (sol) { gp = cands[ci]; break; }
      }
      if (!sol || !gp) return null;
      S.rangeVerdict = { kind: 'ghost', expect: 'MISS', target: gp, sol: sol, hitsBefore: S.hitLog.length };
    } else {
      var bp = S.rangeBird.parts[1].position;      // 鸟身凸块中心
      sol = solveAim(bp.x, bp.y, false, null);
      if (!sol) return null;
      S.rangeVerdict = { kind: 'body', expect: 'HIT', target: { x: bp.x, y: bp.y }, sol: sol, hitsBefore: S.hitLog.length };
    }
    S.debugOn = true;
    S.nock.x = ANCHOR.x; S.nock.y = ANCHOR.y;
    launch(sol.vx, sol.vy, ANCHOR.x, ANCHOR.y);
    return sol;
  }

  function reportRange() {
    if (!S || !S.rangeVerdict) return null;
    var rv = S.rangeVerdict;
    var newHits = S.hitLog.slice(rv.hitsBefore).filter(function (h) { return h.kind === 'jinwu'; });
    var hit = newHits.length > 0;
    var pass = (rv.expect === 'HIT') === hit;
    rv.done = true;
    return {
      kind: rv.kind, expect: rv.expect, actual: hit ? 'HIT' : 'MISS',
      pass: pass, passesThroughBBox: rv.sol.passesThroughBBox, hits: newHits.length
    };
  }

  /* ==========================================================================
     13. 单步（固定步长；由 main.js 的累加器驱动）
     ========================================================================== */
  function stepOnce() {
    if (!S) return;
    S.frameCount++;
    M.Engine.update(engine, STEP);
    stepParticles();
    if (S.arrowInFlight && S.arrow) {
      S.flightFrames++;
      var sp = M.Body.getSpeed(S.arrow);
      if (sp > MAX_SPEED) M.Body.setSpeed(S.arrow, MAX_SPEED);
      if (sp > 1) {
        M.Body.setAngle(S.arrow, Math.atan2(S.arrow.velocity.y, S.arrow.velocity.x));   // 箭头始终指前
        M.Sleeping.set(S.arrow, false);
      }
      S.arrowTrack.push({ x: +S.arrow.position.x.toFixed(2), y: +S.arrow.position.y.toFixed(2), f: S.flightFrames });
      S.slowFrames = sp < 0.6 ? S.slowFrames + 1 : 0;
      /* 箭扎进高 HP 日轮后会在 0.6~1.2 之间抖动，slowFrames 永不累计 ->
         只能等 620 帧上限，玩家白等十秒。加一道「卡滞」判定提前回收。 */
      S.restFrames = sp < 1.2 ? S.restFrames + 1 : 0;
      var p = S.arrow.position;
      if (p.x < -120 || p.x > WORLD_W + 120 || p.y > WORLD_H + 240
          || S.slowFrames > 45 || S.restFrames > 40 || S.flightFrames > 620) {
        retireArrow();
      }
    }
    if (S.pendingRetire > 0) { S.pendingRetire--; if (S.pendingRetire === 0) checkEnd(); }
    checkLose();
  }

  function step(n) { n = n || 1; for (var i = 0; i < n; i++) stepOnce(); return true; }

  /* ==========================================================================
     14. 自检 / 快照 API
     ========================================================================== */
  function bodyList() {
    if (!S) return [];
    var out = [];
    S.birds.concat(S.blocks, S.suns).forEach(function (b) {
      var bb = unionBounds(b);
      out.push({
        kind: b.plugin.kind, label: b.plugin.label, hp: +Math.max(0, b.plugin.hp).toFixed(1),
        maxHp: b.plugin.maxHp, x: +b.position.x.toFixed(1), y: +b.position.y.toFixed(1),
        angle: +b.angle.toFixed(3), sleeping: !!b.isSleeping, isStatic: !!b.isStatic,
        parts: b.parts.length - 1, circle: b.circleRadius || null,
        w: +(bb.max.x - bb.min.x).toFixed(1), h: +(bb.max.y - bb.min.y).toFixed(1)
      });
    });
    return out;
  }

  function shapeAudit() {
    // 逐实体核对：碰撞体是否「非矩形」——把凸块并集面积与 bbox 面积对比
    if (!S) return [];
    var out = [];
    S.birds.concat(S.blocks, S.suns).forEach(function (b) {
      var bb = unionBounds(b);
      var boxArea = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y);
      var polyArea = 0;
      if (b.circleRadius) polyArea = Math.PI * b.circleRadius * b.circleRadius;
      else {
        for (var i = 1; i < b.parts.length; i++) polyArea += Math.abs(M.Vertices.area(b.parts[i].vertices));
      }
      out.push({
        kind: b.plugin.kind, shape: b.plugin.shapeName || 'circle',
        parts: b.parts.length - 1, isCircle: !!b.circleRadius,
        fillRatio: +(polyArea / boxArea).toFixed(3),   // 1.0 = 矩形；<1 = 异形
        isRectangleLike: polyArea / boxArea > 0.985
      });
    });
    return out;
  }

  function arrowInfo() {
    if (!S || !S.arrow) return null;
    var bb = unionBounds(S.arrow), polyArea = 0, i;
    for (i = 1; i < S.arrow.parts.length; i++) polyArea += Math.abs(M.Vertices.area(S.arrow.parts[i].vertices));
    var w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;
    return {
      parts: S.arrow.parts.length - 1, isCircle: false,
      w: +w.toFixed(1), h: +h.toFixed(1), aspect: +(w / h).toFixed(2),
      fillRatio: +(polyArea / (w * h)).toFixed(3),
      frictionAir: S.arrow.frictionAir, indestructible: !!S.arrow.plugin.indestructible
    };
  }

  function ghostStats(kindFilter) {
    if (!S) return [];
    var out = [];
    S.birds.concat(S.blocks, S.suns).forEach(function (b) {
      if (kindFilter && b.plugin.kind !== kindFilter) return;
      var bb = unionBounds(b), ghost = 0, total = 0;
      for (var x = bb.min.x; x <= bb.max.x; x += 2) {
        for (var y = bb.min.y; y <= bb.max.y; y += 2) {
          total++; if (!inSilhouette(b, x, y)) ghost++;
        }
      }
      out.push({
        kind: b.plugin.kind, shape: b.plugin.shapeName || 'circle',
        x: +b.position.x.toFixed(1), y: +b.position.y.toFixed(1),
        bbox: { x0: +bb.min.x.toFixed(1), y0: +bb.min.y.toFixed(1), x1: +bb.max.x.toFixed(1), y1: +bb.max.y.toFixed(1) },
        ghostRatio: +(ghost / total).toFixed(3)
      });
    });
    return out;
  }

  /* 逐实体采样网格：每个点标注「在轮廓内」还是「幽灵区」。
     供「所见即所撞」像素级核对使用——按实体逐个判定，不像 silhouetteTest
     那样只取同类第一个。other=true 表示该点落在别的实体轮廓内（那里本来
     就该画别的实体），核对时需排除。 */
  function silhouetteGrid(step, kindFilter) {
    if (!S) return [];
    var out = [];
    var all = S.birds.concat(S.blocks, S.suns);
    all.forEach(function (b) {
      if (kindFilter && b.plugin.kind !== kindFilter) return;
      var bb = unionBounds(b);
      /* 整数网格 + 在像素中心 (x+0.5) 判定：samplePixels 会 Math.round 取整，
         若这里用浮点坐标判定，判定点与采样像素会错开半个像素，
         边界处就会误报「轮廓内却没画」。 */
      for (var x = Math.ceil(bb.min.x); x <= Math.floor(bb.max.x); x += step) {
        for (var y = Math.ceil(bb.min.y); y <= Math.floor(bb.max.y); y += step) {
          var cx = x + 0.5, cy = y + 0.5;
          var inside = inSilhouette(b, cx, cy);
          var other = false;
          if (!inside) {
            for (var k = 0; k < all.length; k++) {
              if (all[k] === b) continue;
              if (inSilhouette(all[k], cx, cy)) { other = true; break; }
            }
          }
          out.push({
            kind: b.plugin.kind, shape: b.plugin.shapeName || 'circle',
            x: x, y: y, inside: inside, ghost: !inside, other: other
          });
        }
      }
    });
    return out;
  }

  function snapshot() {
    if (!S) return null;
    return {
      mode: S.mode, phase: S.phase, levelIdx: S.levelIdx, levelId: S.level.id,
      goal: S.goal, arrowsLeft: S.arrowsLeft, arrowsTotal: S.arrowsTotal,
      birdsAlive: S.birds.length, birdsTotal: S.birdsTotal,
      blocksAlive: S.blocks.length, sunsAlive: S.suns.length, sunsTotal: S.sunsTotal,
      birdsKilled: S.birdsKilled, sunsKilled: S.sunsKilled, blocksKilled: S.blocksKilled,
      arrowInFlight: S.arrowInFlight, flightFrames: S.flightFrames,
      debug: S.debugOn, frame: S.frameCount, particles: S.particles.length,
      result: S.result
    };
  }

  window.HYEngine = {
    /* --- 生命周期 --- */
    buildLevel: buildLevel,
    buildRange: buildRange,
    step: step,
    stepOnce: stepOnce,
    settle: settle,
    state: function () { return S; },
    snapshot: snapshot,

    /* --- 交互 --- */
    drag: function (px, py) {
      if (!S || S.mode !== 'level') return 0;
      if (S.phase !== 'ready' || S.arrowInFlight || !S.arrow) return 0;
      S.dragActive = true;
      return setNock({ x: px, y: py });
    },
    release: function () {
      if (!S || S.mode !== 'level' || !S.dragActive) return false;
      var v = launchVector();
      S.dragActive = false;
      if (v.power < 1.2) { S.nock.x = ANCHOR.x; S.nock.y = ANCHOR.y; S.previewPts = []; S.phase = 'ready'; return false; }
      return launch(v.vx, v.vy);
    },
    cancelDrag: function () {
      if (!S) return;
      S.dragActive = false; S.previewPts = [];
      S.nock.x = ANCHOR.x; S.nock.y = ANCHOR.y;
      if (S.phase === 'dragging') S.phase = 'ready';
    },
    launch: function (vx, vy, x, y) {
      return launch(vx, vy, x === undefined ? ANCHOR.x : x, y === undefined ? ANCHOR.y : y);
    },
    preview: function (px, py) {
      if (!S || S.mode !== 'level') return null;
      setNock({ x: px, y: py });
      var v = launchVector();
      return {
        nock: { x: +S.nock.x.toFixed(2), y: +S.nock.y.toFixed(2) },
        vx: +v.vx.toFixed(4), vy: +v.vy.toFixed(4), power: +v.power.toFixed(4),
        angleDeg: +(v.angle * 180 / Math.PI).toFixed(2),
        points: S.previewPts.map(function (p) { return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), i: p.i }; })
      };
    },
    nockForVector: nockForVector,
    launchVector: launchVector,

    /* --- 自检 --- */
    config: function () {
      return {
        step: STEP, gravStepY: +GRAV_STEP_Y.toFixed(6), gravStepX: GRAV_STEP_X,
        maxPull: MAX_PULL, powerScale: POWER_SCALE, maxSpeed: MAX_SPEED,
        damageScale: DAMAGE_SCALE, minImpact: MIN_IMPACT, hp: HP, birdScale: BIRD_SCALE,
        worldW: WORLD_W, worldH: WORLD_H, groundY: GROUND_Y, anchor: ANCHOR
      };
    },
    matterVersion: M.version,
    warnings: function () { return warnings.slice(); },
    bodies: bodyList,
    shapeAudit: shapeAudit,
    arrowInfo: arrowInfo,
    hitLog: function () { return S ? S.hitLog.slice() : []; },
    clearLog: function () { if (S) S.hitLog.length = 0; },
    arrowTrack: function () { return S ? S.arrowTrack.slice() : []; },
    ghostStats: ghostStats,
    silhouetteGrid: silhouetteGrid,
    silhouetteTest: function (kindFilter, x, y) {
      if (!S) return null;
      var b = S.birds.concat(S.blocks, S.suns).filter(function (t) { return !kindFilter || t.plugin.kind === kindFilter; })[0];
      if (!b) return null;
      return {
        kind: b.plugin.kind, x: x, y: y,
        inSilhouette: inSilhouette(b, x, y), inBBox: inBBox(b, x, y),
        ghost: inBBox(b, x, y) && !inSilhouette(b, x, y)
      };
    },
    findGhostPoint: function (clearance) {
      if (!S || !S.birds.length) return null;
      var b = S.birds[0];
      var l = findGhostPoints(b, clearance || 30);
      var gp = l.length ? l[0] : null;
      if (!gp) return null;
      return { x: gp.x, y: gp.y, inBBox: inBBox(b, gp.x, gp.y), inSilhouette: inSilhouette(b, gp.x, gp.y), bird: { x: b.position.x, y: b.position.y } };
    },
    solveAim: function (tx, ty, requireMiss) {
      var s = solveAim(tx, ty, !!requireMiss, requireMiss && S ? S.birds[0] : null);
      return s ? { vx: +s.vx.toFixed(4), vy: +s.vy.toFixed(4), power: +s.pw.toFixed(3), angleDeg: +(s.ang * 180 / Math.PI).toFixed(2), err: +s.err.toFixed(3), passesThroughBBox: s.passesThroughBBox } : null;
    },
    rangeShot: rangeShot,
    reportRange: reportRange,
    setDebug: function (v) { if (S) S.debugOn = !!v; return S ? S.debugOn : false; },
    birdFootOffset: birdFootOffset,
    unionBounds: unionBounds,
    simulate: function (sx, sy, vx, vy, n) { return simulate(sx, sy, vx, vy, n || 110); }
  };
})();
