(function () {
  var D = window.WHData.BOSS;

  var st = {
    active: false,
    done: false,
    x: 0,
    y: 0,
    r: 1.6,
    t: 0,
    purify: 0,
    phaseIdx: 0,
    mode: "wake",
    mt: 0,
    gap: 0,
    atkN: 0,
    tx: 0,
    ty: 0,
    hitThisAttack: false,
    kind: "lunge",
    vanish: 0,
    vanishDur: 0,
    dist: 0,
    hurtDealt: 0,
    hitsLanded: 0,
    purified: false
  };

  function reset() {
    st.active = false;
    st.done = false;
    st.x = 0;
    st.y = 0;
    st.r = 1.6;
    st.t = 0;
    st.purify = 0;
    st.phaseIdx = 0;
    st.mode = "wake";
    st.mt = 0;
    st.gap = 0;
    st.atkN = 0;
    st.tx = 0;
    st.ty = 0;
    st.hitThisAttack = false;
    st.kind = "lunge";
    st.vanish = 0;
    st.vanishDur = 0;
    st.dist = 0;
    st.hurtDealt = 0;
    st.hitsLanded = 0;
    st.purified = false;
  }

  function spawn(x, y) {
    reset();
    st.active = true;
    st.x = x + 9;
    st.y = y + 2.2;
    st.mode = "wake";
    return snapshot();
  }

  function phaseOf(purify) {
    if (purify < D.PHASES[0]) { return 0; }
    if (purify < D.PHASES[1]) { return 1; }
    return 2;
  }

  function setMode(m) {
    st.mode = m;
    st.mt = 0;
    if (m === "idle") {
      st.gap = D.ATTACK_GAP[Math.min(st.phaseIdx, D.ATTACK_GAP.length - 1)];
      st.hitThisAttack = false;
    }
  }

  function addPurify(n) {
    if (st.done) { return 0; }
    st.purify = Math.min(D.HP_PURIFY, st.purify + n);
    st.phaseIdx = phaseOf(st.purify);
    if (st.purify >= D.HP_PURIFY) {
      st.done = true;
      st.purified = true;
      return 1;
    }
    return 0;
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

  function inReach(ax, ay, bx, by) {
    if (!st.active || st.done) { return false; }
    return segPointDist(ax, ay, bx, by, st.x, st.y) < st.r + 0.6;
  }

  function thrustHit(wrapped) {
    if (!st.active || st.done) { return false; }
    if (st.vanish > 0) { return false; }
    st.hitsLanded += 1;
    addPurify(wrapped ? D.ORB_DMG : D.THRUST_DMG);
    return true;
  }

  function chooseAttack() {
    var n = st.atkN % 4;
    st.atkN += 1;
    if (n === 1 && st.t > D.DIVE_START) { return "dive"; }
    if (n === 3 && st.t > D.VANISH_START && st.phaseIdx >= 1) { return "vanish"; }
    return "lunge";
  }

  function step(dt, head, wrappedSegs) {
    var out = { hits: 0, purifyGain: 0, purified: false, mode: st.mode, phaseIdx: st.phaseIdx };
    if (!st.active || st.done) { return out; }

    st.t += dt;
    st.mt += dt;

    if (st.vanish > 0) { st.vanish = Math.max(0, st.vanish - dt); }

    if (wrappedSegs > 0) {
      var before = st.purify;
      var fin = addPurify(D.WRAP_DPS * dt);
      out.purifyGain += st.purify - before;
      if (fin === 1) { out.purified = true; }
    }
    if (st.done) {
      out.mode = st.mode;
      out.phaseIdx = st.phaseIdx;
      out.purified = true;
      return out;
    }

    if (st.mode === "wake") {
      st.y += Math.sin(st.t * 3.0) * 0.18 * dt;
      if (st.mt >= D.WAKE) { setMode("idle"); }

    } else if (st.mode === "idle") {
      drift(dt, head);
      if (st.mt >= st.gap) {
        var a = chooseAttack();
        if (a === "vanish") {
          st.vanish = D.VANISH_MAX * 0.55;
          st.vanishDur = st.vanish;
          setMode("vanish");
        } else {
          st.tx = head.x;
          st.ty = head.y;
          setMode("telegraph");
          st.kind = a;
        }
      }

    } else if (st.mode === "vanish") {
      st.x += (head.x + 3.2 - st.x) * Math.min(1, dt * 1.4);
      st.y += (head.y + 1.8 - st.y) * Math.min(1, dt * 1.4);
      if (st.mt >= st.vanishDur + 0.15) {
        st.tx = head.x;
        st.ty = head.y;
        st.kind = "lunge";
        setMode("telegraph");
      }

    } else if (st.mode === "telegraph") {
      st.y += Math.sin(st.t * 26.0) * 0.32 * dt;
      if (st.mt >= D.TELEGRAPH) {
        st.tx = head.x;
        st.ty = head.y;
        setMode(st.kind === "dive" ? "dive" : "lunge");
      }

    } else if (st.mode === "lunge") {
      var h = charge(dt, head, D.LUNGE_SPEED);
      out.hits += h;
      if (st.dist < 1.2 || st.mt > 2.4) { setMode("recover"); }

    } else if (st.mode === "dive") {
      if (st.mt < 0.5) {
        st.y += 3.2 * dt;
      } else {
        out.hits += charge(dt, head, D.LUNGE_SPEED * 1.15);
        if (st.dist < 1.2 || st.mt > 2.8) { setMode("recover"); }
      }

    } else if (st.mode === "recover") {
      st.y -= 0.42 * dt;
      if (st.mt > 0.6) { setMode("idle"); }
    }

    st.r = 1.6 - 0.17 * st.phaseIdx;
    out.mode = st.mode;
    out.phaseIdx = st.phaseIdx;
    return out;
  }

  function drift(dt, head) {
    var dx = head.x + 7 - st.x;
    var dy = head.y + 1.1 - st.y;
    var m = Math.sqrt(dx * dx + dy * dy);
    if (m > 0.001) {
      st.x += (dx / m) * D.MOVE_SPEED * dt;
      st.y += (dy / m) * D.MOVE_SPEED * dt;
    }
    st.y += Math.sin(st.t * 1.7) * 0.25 * dt;
  }

  function charge(dt, head, speed) {
    var dx = st.tx - st.x;
    var dy = st.ty - st.y;
    var m = Math.sqrt(dx * dx + dy * dy);
    if (m > 0.001) {
      st.x += (dx / m) * speed * dt;
      st.y += (dy / m) * speed * dt;
    }
    var nx = st.tx - st.x;
    var ny = st.ty - st.y;
    st.dist = Math.sqrt(nx * nx + ny * ny);
    var hx = st.x - head.x;
    var hy = st.y - head.y;
    var hd = Math.sqrt(hx * hx + hy * hy);
    if (!st.hitThisAttack && hd < st.r + 0.7) {
      st.hitThisAttack = true;
      st.hurtDealt += 1;
      return 1;
    }
    return 0;
  }

  function snapshot() {
    return {
      active: st.active,
      done: st.done,
      purified: st.purified,
      x: st.x,
      y: st.y,
      r: st.r,
      purify: st.purify,
      phaseIdx: st.phaseIdx,
      mode: st.mode,
      vanish: st.vanish,
      telegraph: st.mode === "telegraph",
      hurtDealt: st.hurtDealt,
      hitsLanded: st.hitsLanded
    };
  }

  reset();

  window.WHBoss = {
    reset: reset,
    spawn: spawn,
    step: step,
    inReach: inReach,
    thrustHit: thrustHit,
    snapshot: snapshot,
    active: function () { return st.active && !st.done; },
    purify: function () { return st.purify; }
  };
})();
