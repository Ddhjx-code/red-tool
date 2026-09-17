(function () {
  var D = window.WHData;

  var cbs = {};
  var rng = window.WHRng(D.SEED ^ 0x71D3);

  var S = {
    phase: "boot",
    room: 0,
    fire: 0,
    dim: false,
    enemies: [],
    kills: { miasma: 0, ghost: 0 },
    taught: {},
    floorAt: null,
    hitStop: 0,
    combo: 0,
    comboT: 0,
    wrapSegs: 0,
    thrustCd: 0,
    tailCd: 0,
    tailT: 0,
    lastHurt: null,
    bossHit: false,
    windup: 0,
    attackLock: 0,
    pendFinisher: false,
    pendChase: false,
    comboShow: 0,
    comboShowT: 0,
    incenseT: 0,
    chaseN: 0,
    thrustT: 0,
    lastHits: 0,
    attacks: 0,
    duel: false,
    gateOpen: false,
    segPrev: null,
    auto: false,
    returnT: 0,
    doneEmitted: false,
    t: 0,
    steps: 0,
    roomsCleared: 0
  };

  function emit(n, a) { if (cbs[n]) { cbs[n](a); } }

  function room(i) { return D.ROOMS[Math.min(i, D.ROOMS.length - 1)]; }

  function roomX0(i) {
    var s = 0;
    var k;
    for (k = 0; k < i; k++) { s += D.ROOMS[k].w; }
    return s;
  }

  function bounds(i) {
    var r = room(i);
    var x0 = roomX0(i);
    return { x0: x0, x1: x0 + r.w, w: r.w };
  }

  function floorAtFor(i) {
    var ps = room(i).plats || [];
    var gs = room(i).gaps || [];
    return function (lx) {
      var y = 0;
      var k;
      for (k = 0; k < gs.length; k++) {
        if (lx >= gs[k].lx && lx <= gs[k].lx + gs[k].w) { return -999; }
      }
      for (k = 0; k < ps.length; k++) {
        if (lx >= ps[k].lx && lx <= ps[k].lx + ps[k].w && ps[k].y > y) { y = ps[k].y; }
      }
      return y;
    };
  }

  function gapLeftOf(i, x) {
    var gs = room(i).gaps || [];
    var k;
    for (k = 0; k < gs.length; k++) {
      if (x >= gs[k].lx - 0.6 && x <= gs[k].lx + gs[k].w + 0.6) { return gs[k].lx; }
    }
    return 1.2;
  }

  function pillarsWorld(i) {
    var ps = room(i).pillars || [];
    var x0 = roomX0(i);
    var out = [];
    var k;
    for (k = 0; k < ps.length; k++) {
      out.push({ x: x0 + ps[k].lx, y: ps[k].y, r: ps[k].r });
    }
    return out;
  }

  function liveEnemies() {
    var n = 0;
    var i;
    for (i = 0; i < S.enemies.length; i++) { if (S.enemies[i].alive) { n += 1; } }
    return n;
  }

  function reset() {
    S.phase = "play";
    S.room = 0;
    S.fire = D.FIRE_RES.START;
    S.dim = false;
    S.enemies = [];
    S.kills = { miasma: 0, ghost: 0 };
    S.taught = {};
    S.hitStop = 0;
    S.combo = 0;
    S.comboT = 0;
    S.wrapSegs = 0;
    S.thrustCd = 0;
    S.tailCd = 0;
    S.tailT = 0;
    S.lastHurt = null;
    S.bossHit = false;
    S.windup = 0;
    S.attackLock = 0;
    window.WHPlayer.setSpeedScale(1);
    S.comboShow = 0;
    S.comboShowT = 0;
    S.incenseT = 0;
    S.chaseN = 0;
    S.thrustT = 0;
    S.lastHits = 0;
    S.attacks = 0;
    S.duel = false;
    S.gateOpen = true;
    S.segPrev = null;
    S.auto = false;
    S.returnT = 0;
    S.doneEmitted = false;
    S.t = 0;
    S.steps = 0;
    S.roomsCleared = 0;
    S.floorAt = floorAtFor(0);
    window.WHPlayer.reset(1.2);
    window.WHChain.reset();
    if (window.WHBoss) { window.WHBoss.reset(); }
    spawnRoom(0);
  }

  function boot() {
    reset();
    S.phase = "boot";
  }

  function start() {
    reset();
    emit("room", room(0));
    return snapshot();
  }

  function safeEnemyX(wx, gaps) {
    var k;
    if (!gaps || !gaps.length) { return wx; }
    for (k = 0; k < gaps.length; k++) {
      if (wx >= gaps[k].lx - 1.0 && wx <= gaps[k].lx + gaps[k].w + 1.0) {
        return Math.max(1.2, gaps[k].lx - 1.8);
      }
    }
    return wx;
  }

  function teachCheck() {
    var i;
    var e;
    var gs;
    var k;
    var wx = bounds(S.room).x0 + window.WHPlayer.snapshot().x;
    if (!S.taught.miasma) {
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i];
        if (e.alive && e.kind === "miasma" && Math.abs(e.x - wx) < 10) {
          S.taught.miasma = 1;
          emit("teach", { text: "龙身扫过疫气即净化", x: e.x, y: e.y + 2.4 });
          return;
        }
      }
    }
    if (!S.taught.ghost) {
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i];
        if (e.alive && e.kind === "ghost" && Math.abs(e.x - wx) < 10) {
          S.taught.ghost = 1;
          emit("teach", { text: "撞不死的瘟鬼 · 竿刺或甩尾", x: e.x, y: e.y + 3.0 });
          return;
        }
      }
    }
    if (!S.taught.gap) {
      gs = room(S.room).gaps || [];
      for (k = 0; k < gs.length; k++) {
        if (gs[k].lx - wx < 9 && wx < gs[k].lx + gs[k].w) {
          S.taught.gap = 1;
          emit("teach", { text: "跳过沟壑", x: gs[k].lx + gs[k].w * 0.5, y: 3.2 });
          return;
        }
      }
    }
  }

  function spawnRoom(i) {
    var r = room(i);
    var b = bounds(i);
    var k;
    var n;
    var lx;
    var ex;
    S.enemies = [];
    S.gateOpen = !r.gate;
    n = r.miasma || 0;
    for (k = 0; k < n; k++) {
      lx = 0.30 + 0.58 * ((k + 0.5) / n) + rng.range(-0.03, 0.03);
      ex = safeEnemyX(lx * b.w, r.gaps);
      S.enemies.push({
        kind: "miasma", x: b.x0 + ex, y: S.floorAt(ex) + rng.range(1.0, 2.0),
        r: D.ENEMY.MIASMA_R, cd: 0, by: -1, ph: rng.range(0, 6.28), alive: true
      });
    }
    n = r.ghosts || 0;
    for (k = 0; k < n; k++) {
      lx = 0.34 + 0.56 * ((k + 0.5) / n) + rng.range(-0.03, 0.03);
      ex = safeEnemyX(lx * b.w, r.gaps);
      S.enemies.push({
        kind: "ghost", x: b.x0 + ex, y: S.floorAt(ex) + rng.range(1.2, 2.4),
        r: D.ENEMY.GHOST_R, cd: 0, by: -1, ph: rng.range(0, 6.28), alive: true
      });
    }
    if (r.boss) {
      S.duel = true;
      window.WHBoss.spawn(b.x0 + b.w * 0.62, 2);
      emit("boss", window.WHBoss.snapshot());
    } else {
      S.duel = false;
    }
    return S.enemies.length;
  }

  function killEnemy(e) {
    var gain;
    if (!e.alive) { return false; }
    e.alive = false;
    if (e.kind === "miasma") {
      S.kills.miasma += 1;
      gain = D.FIRE_RES.KILL_MIASMA;
    } else {
      S.kills.ghost += 1;
      gain = D.FIRE_RES.KILL_GHOST;
    }
    addFire(gain);
    S.hitStop = Math.max(S.hitStop, D.ACT.HITSTOP);
    emit("purify", { kind: e.kind, x: e.x, y: e.y, fire: S.fire, gain: gain });
    return true;
  }

  function spend(n) { S.fire = Math.max(0, S.fire - n); }

  function addFire(n) {
    if (!(n > 0)) { return S.fire; }
    S.fire = Math.min(D.FIRE_RES.START, S.fire + n);
    if (S.fire > D.FIRE_RES.DIM) { S.dim = false; }
    return S.fire;
  }

  function settleThresholds() {
    if (!S.dim && S.fire <= D.FIRE_RES.DIM) {
      S.dim = true;
      emit("toast", "香火将尽");
    }
    if (S.fire <= 0 && S.phase === "play") {
      S.phase = "fail";
      emit("fail", null);
    }
  }

  function segPointDist(ax, ay, bx, by, px, py) {
    var dx = bx - ax;
    var dy = by - ay;
    var l2 = dx * dx + dy * dy;
    var t = l2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    var cx;
    var cy;
    var ex;
    var ey;
    if (t < 0) { t = 0; } else if (t > 1) { t = 1; }
    cx = ax + t * dx;
    cy = ay + t * dy;
    ex = px - cx;
    ey = py - cy;
    return Math.sqrt(ex * ex + ey * ey);
  }

  function sweepPurify() {
    var segs = window.WHChain.segments();
    var prev = S.segPrev;
    var n = segs.length;
    var i;
    var j;
    var e;
    var r;
    var hit = 0;
    if (!prev || prev.length !== n) { S.segPrev = segs; return 0; }
    for (j = 0; j < S.enemies.length; j++) {
      e = S.enemies[j];
      if (!e.alive || e.kind !== "miasma") { continue; }
      for (i = 0; i < n; i++) {
        r = e.r + window.WHChain.halfWidth(i);
        if (segPointDist(prev[i].x, prev[i].y, segs[i].x, segs[i].y, e.x, e.y) < r) {
          killEnemy(e);
          hit += 1;
          break;
        }
      }
    }
    S.segPrev = segs;
    return hit;
  }

  function stepEnemies(dt, ps) {
    var i;
    var e;
    var dx;
    var dy;
    var m;
    for (i = 0; i < S.enemies.length; i++) {
      e = S.enemies[i];
      if (!e.alive) { continue; }
      if (e.kind === "ghost") {
        dx = ps.x - e.x;
        dy = (ps.y + 1.6) - e.y;
        m = Math.sqrt(dx * dx + dy * dy);
        if (m > 0.001) {
          e.x += (dx / m) * D.ENEMY.GHOST_SPEED * dt;
          e.y += (dy / m) * D.ENEMY.GHOST_SPEED * dt;
        }
        e.y += Math.sin(S.t * 2.4 + e.ph) * 0.25 * dt;
        if (e.y < 0.4) { e.y = 0.4; }
      }
      dx = ps.x - e.x;
      dy = (ps.y + 1.7) - e.y;
      m = Math.sqrt(dx * dx + dy * dy);
      if (e.kind === "miasma" && m < e.r + 0.45) {
        spend(D.FIRE_RES.CLING_DRAIN * dt);
      }
      if (m < e.r + 0.55) {
        if (window.WHPlayer.hurt()) {
          spend(D.FIRE_RES.HURT);
          S.lastHurt = { kind: e.kind, t: S.t, sx: e.x, sy: e.y };
          emit("hurt", { kind: e.kind, fire: S.fire });
        }
      }
    }
  }

  function tailHit() {
    var head = window.WHChain.head();
    var i;
    var e;
    var dx;
    var dy;
    var n = 0;
    for (i = 0; i < S.enemies.length; i++) {
      e = S.enemies[i];
      if (!e.alive || e.by === S.attacks) { continue; }
      dx = e.x - head.x;
      dy = e.y - head.y;
      if (Math.sqrt(dx * dx + dy * dy) < D.ACT.TAIL_R) {
        e.by = S.attacks;
        if (killEnemy(e)) { n += 1; }
      }
    }
    return n;
  }

  function thrustHit(ps, b, finisher, chase) {
    var tip = window.WHPlayer.poleTip(true);
    var ax = b.x0 + ps.x;
    var ay = ps.y + 1.7;
    var bx = b.x0 + tip.x;
    var by = tip.y;
    var i;
    var e;
    var n = 0;
    var dxF;
    var dyA;
    var reach = finisher ? 7.0 : 4.4;
    var vspan = finisher ? 5.6 : 4.4;
    if (chase) { reach += 1.8; vspan += 1.4; }
    for (i = 0; i < S.enemies.length; i++) {
      e = S.enemies[i];
      if (!e.alive || e.by === S.attacks) { continue; }
      dxF = (e.x - ps.x) * ps.facing;
      dyA = Math.abs(e.y - (ps.y + 1.7));
      if ((dxF > -1.3 && dxF < reach && dyA < vspan) ||
          segPointDist(ax, ay, bx, by, e.x, e.y) < e.r + 0.6) {
        e.by = S.attacks;
        if (killEnemy(e)) { n += 1; }
      }
    }
    if (S.duel && window.WHBoss.active() && window.WHBoss.inReach(ax, ay, bx, by)) {
      if (window.WHBoss.thrustHit(S.wrapSegs > 0)) {
        S.bossHit = true;
        emit("purify", { kind: "boss" });
      }
    }
    return n;
  }

  function resolveThrust() {
    var ps = window.WHPlayer.snapshot();
    var b = bounds(S.room);
    var finisher = S.pendFinisher;
    var chase = S.pendChase;
    S.windup = 0;
    S.lastHits = thrustHit(ps, b, finisher, chase);
    if (S.lastHits > 0) {
      S.hitStop = Math.max(S.hitStop, (finisher || chase) ? D.ACT.HITSTOP_HEAVY : D.ACT.HITSTOP);
      if (chase) { addFire(D.ACT.CHASE_FIRE * S.lastHits); }
    }
    if (S.bossHit) {
      S.hitStop = Math.max(S.hitStop, D.ACT.HITSTOP_HEAVY);
      S.bossHit = false;
    }
    if (chase) { S.chaseN = S.lastHits; }
    emit("thrust", { hits: S.lastHits, wrapped: S.wrapSegs > 0, chase: chase,
                     combo: finisher ? 3 : S.combo, finisher: finisher });
  }

  function action(kind) {
    var ps;
    var b;
    var finisher;
    var chase;
    if (S.phase !== "play") { return false; }
    if (kind === "tail") {
      if (S.tailCd > 0) { return false; }
      if (S.fire <= D.ACT.TAIL_COST) { return false; }
      S.tailCd = D.ACT.TAIL_CD;
      S.attacks += 1;
      spend(D.ACT.TAIL_COST);
      S.lastHits = tailHit();
      if (S.lastHits > 0) {
        S.hitStop = Math.max(S.hitStop, D.ACT.HITSTOP_HEAVY);
        S.tailT = 0.9;
      }
      emit("tail", { hits: S.lastHits });
      return true;
    }
    if (kind !== "thrust") { return false; }
    if (S.thrustCd > 0) { return false; }
    if (S.fire <= D.ACT.THRUST_COST) { return false; }
    S.thrustCd = D.ACT.THRUST_CD;
    S.thrustT = D.ACT.THRUST_CD * 0.6;
    S.attacks += 1;
    chase = (S.tailT > 0);
    if (chase) { S.tailT = 0; }
    S.combo = (S.comboT > 0 && S.combo < 3) ? S.combo + 1 : 1;
    S.comboT = D.ACT.COMBO_WIN;
    S.comboShow = chase ? 0 : S.combo;
    S.comboShowT = 1.2;
    finisher = (S.combo >= 3);
    if (finisher) { S.combo = 0; S.comboT = 0; }
    spend(D.ACT.THRUST_COST);
    if (S.wrapSegs > 0) { spend(D.ACT.ORB_COST); }
    S.attackLock = D.ACT.WINDUP + D.ACT.RECOVER;
    S.pendFinisher = finisher;
    S.pendChase = chase;
    S.lastHits = 0;
    S.windup = D.ACT.WINDUP;
    if (S.windup <= 0) { resolveThrust(); }
    return true;
  }

  function press(k) {
    if (k === "thrust" || k === "tail") { action(k); return; }
    window.WHPlayer.press(k);
  }

  function release(k) { window.WHPlayer.release(k); }

  function releaseAll() { window.WHPlayer.releaseAll(); }

  function nearest() {
    var ps = window.WHPlayer.snapshot();
    var best = null;
    var bd = 1e9;
    var i;
    var e;
    var d;
    for (i = 0; i < S.enemies.length; i++) {
      e = S.enemies[i];
      if (!e.alive) { continue; }
      d = Math.abs(e.x - ps.x);
      if (d < bd) { bd = d; best = e; }
    }
    return { e: best, d: bd };
  }

  function autoInput() {
    var pl = window.WHPlayer;
    var ps = pl.snapshot();
    var b = bounds(S.room);
    var nr = nearest();
    var boss = S.duel ? window.WHBoss.snapshot() : null;
    var ar;
    pl.releaseAll();
    if (boss && boss.active) {
      if (ps.onGround && S.fire < 30) {
        ar = nearestAltar(ps.x);
        if (ar !== null) {
          if (Math.abs(ar - ps.x) > D.ALTAR.R * 0.6) {
            pl.press(ar > ps.x ? "right" : "left");
            return;
          }
          if (S.fire < 55) { return; }
        }
      }
      var tip = pl.poleTip(false);
      var tdx = (b.x0 + tip.x) - boss.x;
      var tdy = tip.y - boss.y;
      if (boss.x > ps.x + 0.6) { pl.press("right"); } else { pl.press("left"); }
      if (Math.sqrt(tdx * tdx + tdy * tdy) < 1.1) { action("thrust"); }
      return;
    }
    if (ps.onGround && window.WHGame.floorAt(ps.x + ps.facing * 0.7) < -100) {
      pl.press(ps.facing > 0 ? "right" : "left");
      pl.press("jump");
      return;
    }
    if (ps.onGround && S.fire < 30 && !(nr.e && nr.d < 2.6)) {
      ar = nearestAltar(ps.x);
      if (ar !== null) {
        if (Math.abs(ar - ps.x) > D.ALTAR.R * 0.6) {
          pl.press(ar > ps.x ? "right" : "left");
          return;
        }
        if (S.fire < 55) { return; }
      }
    }
    if (nr.e) {
      if (nr.e.x > ps.x + 0.15) { pl.press("right"); } else if (nr.e.x < ps.x - 0.15) { pl.press("left"); }
      if (nr.d < D.ACT.THRUST_W * 0.8) { action("thrust"); }
      else if (nr.d < D.ACT.TAIL_R * 0.85) { action("tail"); }
      if (nr.e.kind === "ghost" && nr.d < 1.0 && ps.onGround) { pl.press("jump"); }
      return;
    }
    if (ps.x < b.w - 0.5) { pl.press("right"); }
  }

  function nearestAltar(x) {
    var list = room(S.room).props || [];
    var i;
    var d;
    var best = null;
    var bd = 1e9;
    for (i = 0; i < list.length; i++) {
      if (list[i].kind !== "altar") { continue; }
      d = Math.abs(list[i].lx - x);
      if (d < bd) { bd = d; best = list[i].lx; }
    }
    return best;
  }

  function stepDuel(dt) {
    var head = window.WHChain.head();
    var w = S.wrapSegs >= D.CHAIN.WRAP_SEGS ? S.wrapSegs : 0;
    var out = window.WHBoss.step(dt, head, w);
    var i;
    if (out.hits > 0) {
      for (i = 0; i < out.hits; i++) {
        if (window.WHPlayer.hurt()) {
          spend(D.FIRE_RES.HURT);
          S.lastHurt = { kind: "boss", t: S.t, sx: null, sy: null };
          emit("hurt", { kind: "boss", fire: S.fire });
        }
      }
    }
    if (out.purified || window.WHBoss.snapshot().purified) {
      S.duel = false;
      S.phase = "return";
      emit("return", { purified: true });
    }
  }

  function stepOnce(dt) {
    var b = bounds(S.room);
    var pl = window.WHPlayer;
    var ps;
    var tip;
    var r = room(S.room);
    var bs;
    var i;
    var pr;

    S.t += dt;
    S.steps += 1;

    if (S.hitStop > 0) {
      S.hitStop = Math.max(0, S.hitStop - dt);
      return;
    }

    if (S.windup > 0) {
      S.windup = Math.max(0, S.windup - dt);
      if (S.windup <= 0) { resolveThrust(); }
    }
    if (S.attackLock > 0) { S.attackLock = Math.max(0, S.attackLock - dt); }
    window.WHPlayer.setSpeedScale(S.attackLock > 0 ? D.ACT.COMMIT : 1);
    if (S.auto) { autoInput(); }
    if (S.thrustCd > 0) { S.thrustCd = Math.max(0, S.thrustCd - dt); }
    if (S.tailCd > 0) { S.tailCd = Math.max(0, S.tailCd - dt); }
    if (S.comboT > 0) {
      S.comboT = Math.max(0, S.comboT - dt);
      if (S.comboT <= 0) { S.combo = 0; }
    }
    if (S.thrustT > 0) { S.thrustT = Math.max(0, S.thrustT - dt); }
    if (S.tailT > 0) { S.tailT = Math.max(0, S.tailT - dt); }
    if (S.comboShowT > 0) { S.comboShowT = Math.max(0, S.comboShowT - dt); }

    pl.step(dt, S.gateOpen ? b.w : (b.w - 0.5), S.floorAt);
    ps = pl.snapshot();

    if (ps.y < -3) {
      spend(D.FIRE_RES.HURT);
      S.lastHurt = { kind: "pit", t: S.t, sx: null, sy: null };
      emit("hurt", { kind: "pit", fire: S.fire });
      pl.reset(Math.max(0.6, gapLeftOf(S.room, ps.x) - 1.6));
      ps = pl.snapshot();
      S.segPrev = null;
    }

    tip = pl.poleTip(S.thrustT > 0);
    window.WHChain.setHead(b.x0 + tip.x, tip.y);
    window.WHChain.step(dt);

    spend(D.FIRE_RES.DRAIN * dt);

    S.incenseT = 0;
    if (ps.onGround && S.fire < D.ALTAR.CAP) {
      for (i = 0; i < ((r.props || []).length); i++) {
        pr = r.props[i];
        if (pr.kind !== "altar") { continue; }
        if (Math.abs(ps.x - pr.lx) > D.ALTAR.R) { continue; }
        S.incenseT = 1;
        addFire(D.ALTAR.RATE * dt);
        break;
      }
    }

    stepEnemies(dt, ps);
    teachCheck();
    sweepPurify();

    if (S.duel) {
      bs = window.WHBoss.snapshot();
      if (bs.active) {
        S.wrapSegs = window.WHChain.wrap([{ x: bs.x, y: bs.y, r: bs.r + 0.35 }]);
      } else {
        S.wrapSegs = 0;
      }
      stepDuel(dt);
    } else {
      S.wrapSegs = window.WHChain.wrap(pillarsWorld(S.room));
    }

    if (!r.boss) {
      if (!S.gateOpen && liveEnemies() === 0) {
        S.gateOpen = true;
        emit("gate", { room: S.room });
        emit("toast", "门开了");
      }
      if (S.gateOpen && ps.x >= b.w - 0.6) {
        S.roomsCleared += 1;
        S.room += 1;
        S.floorAt = floorAtFor(S.room);
        pl.reset(0.9);
        spawnRoom(S.room);
        S.segPrev = null;
        emit("room", room(S.room));
      }
    }

    settleThresholds();
  }

  function step(dt) {
    if (S.phase === "return") {
      S.t += dt;
      S.returnT += dt;
      if (!S.doneEmitted && S.returnT > 3.4) {
        S.doneEmitted = true;
        emit("done", snapshot());
      }
      return;
    }
    if (S.phase !== "play") { return; }
    stepOnce(dt);
  }

  function snapshot() {
    var ps = window.WHPlayer.snapshot();
    var head = window.WHChain.head();
    var b = bounds(S.room);
    var r = room(S.room);
    return {
      phase: S.phase,
      room: S.room,
      roomId: r.id,
      roomName: r.name,
      roomW: b.w,
      plats: r.plats || [],
      gaps: r.gaps || [],
      props: r.props || [],
      hint: r.hint,
      boss: !!r.boss,
      fire: S.fire,
      dim: S.dim,
      enemies: liveEnemies(),
      kills: { miasma: S.kills.miasma, ghost: S.kills.ghost },
      gateOpen: S.gateOpen,
      wrapSegs: S.wrapSegs,
      lastHits: S.lastHits,
      thrustCd: S.thrustCd,
      lastHurt: S.lastHurt,
      windup: S.windup,
      attackLock: S.attackLock,
      tailCd: S.tailCd,
      tailT: S.tailT,
      combo: S.combo,
      comboShow: S.comboShow,
      comboT: S.comboT,
      comboShowT: S.comboShowT,
      incense: S.incenseT,
      chaseN: S.chaseN,
      cost: { thrust: D.ACT.THRUST_COST, tail: D.ACT.TAIL_COST, orb: D.ACT.ORB_COST },
      cd: { thrust: D.ACT.THRUST_CD, tail: D.ACT.TAIL_CD },
      duel: S.duel,
      roomsCleared: S.roomsCleared,
      player: { x: ps.x, y: ps.y, vx: ps.vx, vy: ps.vy, facing: ps.facing,
                onGround: ps.onGround, air: ps.air },
      head: { x: head.x, y: head.y },
      worldX: b.x0 + ps.x,
      bossState: window.WHBoss ? window.WHBoss.snapshot() : null,
      returnT: S.returnT,
      t: S.t,
      steps: S.steps
    };
  }

  boot();

  window.WHGame = {
    init: function () { return true; },
    boot: boot,
    start: start,
    reset: reset,
    step: step,
    stepOnce: stepOnce,
    action: action,
    press: press,
    release: release,
    releaseAll: releaseAll,
    addFire: addFire,
    setAuto: function (on) { S.auto = !!on; },
    snapshot: snapshot,
    setCallback: function (n, fn) { cbs[n] = fn; },
    fire: function () { return S.fire; },
    enemiesRaw: function () { return S.enemies; },
    floorAt: function (x) { return S.floorAt ? S.floorAt(x) : 0; },
    bounds: bounds
  };
})();
