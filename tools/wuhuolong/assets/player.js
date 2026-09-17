(function () {
  var D = window.WHData.PLAYER;
  var P = window.WHData.POLE;

  var st = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    hurtCd: 0,
    steps: 0,
    air: 0,
    input: { left: false, right: false, jump: false },
    jumpLatch: false,
    jumpBuf: 0,
    speedScale: 1
  };

  function reset(x) {
    st.x = (x === undefined) ? 8 : x;
    st.y = 0;
    st.vx = 0;
    st.vy = 0;
    st.facing = 1;
    st.onGround = true;
    st.hurtCd = 0;
    st.steps = 0;
    st.air = 0;
    st.input.left = false;
    st.input.right = false;
    st.input.jump = false;
    st.jumpLatch = false;
    st.jumpBuf = 0;
  }

  function setSpeedScale(v) { st.speedScale = v; }

  function press(k) {
    if (k === "jump") { st.jumpBuf = D.JUMP_BUF; }
    if (k in st.input) { st.input[k] = true; }
  }

  function release(k) { if (k in st.input) { st.input[k] = false; } }

  function releaseAll() {
    st.input.left = false;
    st.input.right = false;
    st.input.jump = false;
  }

  function step(dt, roomW, floorAt) {
    var dir = (st.input.right ? 1 : 0) - (st.input.left ? 1 : 0);
    var maxX = Math.max(0, roomW - 0.45);
    var floor = floorAt ? floorAt(st.x) : 0;
    var prevY;

    st.vx = dir * D.SPEED * st.speedScale;
    if (dir !== 0) { st.facing = dir; }

    if (st.jumpBuf > 0) { st.jumpBuf = Math.max(0, st.jumpBuf - dt); }
    if (st.onGround && ((st.input.jump && !st.jumpLatch) || st.jumpBuf > 0)) {
      st.vy = D.JUMP_V;
      st.onGround = false;
      st.jumpLatch = true;
      st.jumpBuf = 0;
    }
    if (!st.input.jump) { st.jumpLatch = false; }

    st.vy += D.GRAV * dt;
    if (st.vy < -34) { st.vy = -34; }

    st.x += st.vx * dt;
    prevY = st.y;
    st.y += st.vy * dt;

    if (st.vy <= 0 && prevY >= floor - 0.03 && st.y <= floor) {
      st.y = floor;
      st.vy = 0;
      st.onGround = true;
    } else if (st.y <= 0 && floor >= 0) {
      st.y = 0;
      st.vy = 0;
      st.onGround = true;
    } else {
      st.onGround = false;
      st.air += dt;
    }
    if (st.onGround) { st.air = 0; }

    if (st.x < 0.35) { st.x = 0.35; }
    if (st.x > maxX) { st.x = maxX; }

    if (st.hurtCd > 0) { st.hurtCd = Math.max(0, st.hurtCd - dt); }
    st.steps += 1;
  }

  function hurt() {
    if (st.hurtCd > 0) { return false; }
    st.hurtCd = D.HURT_CD;
    return true;
  }

  function poleAng() {
    var a = P.ANG - st.vx * 0.048;
    if (a < 0.62) { a = 0.62; }
    if (a > 1.48) { a = 1.48; }
    return a;
  }

  function poleTip(thrust) {
    var ang = thrust ? P.THRUST_ANG : poleAng();
    var len = P.LEN + (thrust ? P.THRUST : 0);
    return {
      x: st.x + st.facing * len * Math.cos(ang),
      y: st.y + 1.9 + len * Math.sin(ang)
    };
  }

  function body() {
    return { x: st.x - D.W * 0.5, y: st.y, w: D.W, h: D.H };
  }

  function snapshot() {
    return {
      x: st.x,
      y: st.y,
      vx: st.vx,
      vy: st.vy,
      facing: st.facing,
      onGround: st.onGround,
      air: st.air,
      hurtCd: st.hurtCd,
      steps: st.steps
    };
  }

  reset();

  window.WHPlayer = {
    reset: reset,
    setSpeedScale: setSpeedScale,
    press: press,
    release: release,
    releaseAll: releaseAll,
    step: step,
    hurt: hurt,
    invuln: function () { return st.hurtCd > 0; },
    poleTip: poleTip,
    body: body,
    snapshot: snapshot,
    data: D
  };
})();
