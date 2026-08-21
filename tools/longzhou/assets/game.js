(function () {
  var D = window.LZData;
  var S = {
    state: "home", lane: 0, boatX: 0, dist: 0, t: 0,
    speed: 0, score: 0, scoreFrac: 0, zongzi: 0, combo: 0, maxCombo: 0,
    steady: 3, gauge: 0, dashT: 0, invT: 0, capT: 0, restT: 0,
    entities: [], sinceSpawn: 0, lastDrumAt: -1, rng: null
  };
  var cb = {};
  var testMode = /[?&]test=1/.test(location.search);

  function emit(n, a) { if (cb[n]) cb[n](a); }

  function baseSpeed(d) {
    return D.BASE_SPEED + (D.MAX_SPEED - D.BASE_SPEED) * Math.min(1, d / D.SPEED_RAMP_DIST);
  }

  function spawnGap(d) {
    return Math.max(D.GAP_MIN, D.GAP_MAX - d / D.GAP_RAMP * (D.GAP_MAX - D.GAP_MIN));
  }

  function mult() { return Math.min(5, 1 + Math.floor(S.combo / 5)); }

  function addScore(n) { S.scoreFrac += n; S.score = Math.floor(S.scoreFrac); }

  function push(kind, type, lane, z) {
    var dr = 0;
    if (type === "log") dr = (S.rng.next() < 0.5 ? -1 : 1) * 0.35;
    else if (type === "zhufa") dr = (S.rng.next() < 0.5 ? -1 : 1) * 0.25;
    S.entities.push({
      kind: kind, type: type, lane: lane, z: z, done: false, drift: dr
    });
  }

  function isUnlocked(id) {
    if (!window.LZSave) return false;
    var sv = null;
    try { sv = window.LZSave.load(); } catch (e) { sv = null; }
    if (!sv || !sv.codex) return false;
    return sv.codex.indexOf(id) >= 0;
  }

  function pickRare() {
    var ids = ["ai", "changpu", "wusai", "wudu", "xiangnang", "ling"];
    var weights = [], total = 0, i, id, w;
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      w = id === "ling" ? D.LING_WEIGHT : D.RARE_WEIGHT;
      if (window.LZSave && !isUnlocked(id)) w *= 2;
      weights.push(w);
      total += w;
    }
    var r = S.rng.next() * total;
    for (i = 0; i < ids.length; i++) {
      r -= weights[i];
      if (r <= 0) return ids[i];
    }
    return ids[ids.length - 1];
  }

  function allowedObs(d) {
    var a = ["rock"];
    if (d > 150) a.push("fubiao");
    if (d > 200) a.push("whirl");
    if (d > 300) a.push("yuchuan");
    if (d > 500) a.push("log");
    if (d > 600) a.push("zhufa");
    return a;
  }

  function spawnWave() {
    var z = D.Z_MAX;
    var roll = S.rng.next() * 100;
    var d = S.dist;
    var allowed = allowedObs(d);
    if (roll < 30) { push("obs", S.rng.pick(allowed), S.rng.int(-1, 1), z); }
    else if (roll < 50 && d > 150) {
      var free = S.rng.int(-1, 1);
      var blocked = [];
      for (var l = -1; l <= 1; l++) if (l !== free) blocked.push(l);
      push("obs", "rock", blocked[0], z);
      push("obs", S.rng.pick(allowed), blocked[1], z);
    }
    else if (roll < 72) { var ln = S.rng.int(-1, 1); for (var k = 0; k < 3; k++) push("pick", "zongzi", ln, z + k * 8); }
    else if (roll < 90) { var ob = S.rng.int(-1, 1); push("obs", "rock", ob, z); var pl = ob + (ob === 1 ? -1 : 1); push("pick", "zongzi", pl, z); push("pick", "zongzi", pl, z + 8); }
    else if (roll < 96) { push("pick", "wine", S.rng.int(-1, 1), z); }
    else { push("pick", pickRare(), S.rng.int(-1, 1), z); }
  }

  function startDash() { S.dashT = D.DASH_TIME; S.restT = 3; emit("dash"); }

  function drum() {
    if (S.state !== "playing") return;
    if (S.restT > 0) return;
    if (S.t - S.lastDrumAt < D.DRUM_INTERVAL) return;
    S.lastDrumAt = S.t;
    S.gauge = Math.min(100, S.gauge + D.GAUGE_DRUM);
    emit("drum");
    if (S.gauge >= 100 && S.dashT <= 0) startDash();
  }

  function capsize() { S.state = "capsized"; S.capT = 1.4; emit("capsize"); }

  function pause() { if (S.state === "playing") { S.state = "paused"; emit("pause"); } }

  function resume() { if (S.state === "paused") { S.state = "playing"; emit("resume"); } }

  function collect(e) {
    if (e.type === "zongzi") {
      S.zongzi++; S.combo++;
      if (S.combo > S.maxCombo) S.maxCombo = S.combo;
      addScore(10 * mult());
      emit("collect", { type: "zongzi" });
    } else if (e.type === "wine") {
      if (S.restT <= 0) S.gauge = Math.min(100, S.gauge + D.GAUGE_WINE);
      emit("collect", { type: "wine" });
      if (S.gauge >= 100 && S.dashT <= 0) startDash();
    } else {
      var pts = e.type === "ling" ? 200 : 80;
      addScore(pts);
      S.combo++;
      if (S.combo > S.maxCombo) S.maxCombo = S.combo;
      emit("collect", { type: e.type });
    }
    if (window.LZSave) window.LZSave.unlock(e.type);
  }

  function boatLane() { return Math.round(S.boatX); }

  function collide(e) {
    if (e.done) return;
    var box = D.HITBOX[e.type] || D.HITBOX.pick;
    var b = D.HITBOX.boat;
    if (e.z > b.hl + box.hl || e.z < -(b.hl + box.hl)) return;
    var el = e.laneF != null ? e.laneF : e.lane;
    if (Math.abs(S.boatX - el) >= b.hw + box.hw) return;
    if (e.kind === "obs") {
      if (S.dashT > 0) { e.done = true; addScore(50); emit("hit", { smash: true }); return; }
      if (S.invT > 0) return;
      e.done = true; S.steady--; S.invT = D.HIT_INV; S.combo = 0; emit("hit", {});
      if (S.steady <= 0) capsize();
    } else { e.done = true; collect(e); }
  }

  function start() {
    S.rng = window.LZRng(testMode ? 20260818 : (Date.now() >>> 0));
    S.state = "playing";
    S.lane = 0; S.boatX = 0; S.dist = 0; S.t = 0;
    S.speed = 0; S.score = 0; S.scoreFrac = 0; S.zongzi = 0;
    S.combo = 0; S.maxCombo = 0; S.steady = 3; S.gauge = 0;
    S.dashT = 0; S.invT = 0; S.capT = 0; S.restT = 0;
    S.entities = []; S.sinceSpawn = 0; S.lastDrumAt = -1;
    spawnWave();
  }

  function update(dt) {
    var i, e, sp, k;
    if (S.state === "playing") {
      S.t += dt;
      k = Math.min(1, dt / D.LANE_TIME);
      S.boatX += (S.lane - S.boatX) * Math.min(1, k * 3);
      if (Math.abs(S.lane - S.boatX) < 0.01) S.boatX = S.lane;

      sp = baseSpeed(S.dist) * (S.dashT > 0 ? D.DASH_MULT : 1);
      S.dist += sp * dt;
      S.scoreFrac += sp * dt;
      S.speed = sp;
      S.score = Math.floor(S.scoreFrac);

      if (S.dashT > 0) { S.dashT -= dt; if (S.dashT <= 0) { S.dashT = 0; S.gauge = 0; } }
      if (S.restT > 0 && S.dashT <= 0) { S.restT -= dt; if (S.restT < 0) S.restT = 0; }
      if (S.invT > 0) { S.invT -= dt; if (S.invT < 0) S.invT = 0; }

      S.sinceSpawn += sp * dt;
      if (S.sinceSpawn >= spawnGap(S.dist)) { S.sinceSpawn = 0; spawnWave(); }

      for (i = S.entities.length - 1; i >= 0; i--) {
        e = S.entities[i];
        e.z -= sp * dt;
        if (e.type === "log" || e.type === "zhufa") {
          e.laneF = (e.laneF == null ? e.lane : e.laneF) + e.drift * dt;
          if (e.laneF < -1) e.laneF = -1;
          if (e.laneF > 1) e.laneF = 1;
        }
        if (e.z < -12) { S.entities.splice(i, 1); continue; }
        collide(e);
      }
    } else if (S.state === "capsized") {
      S.t += dt;
      S.capT -= dt;
      if (S.capT <= 0) { S.state = "result"; emit("result"); }
    }
  }

  window.LZGame = {
    start: start,
    update: update,
    swipe: function (dir) { if (S.state !== "playing") return; S.lane = Math.max(-1, Math.min(1, S.lane + dir)); },
    drum: drum,
    pause: pause,
    resume: resume,
    setCallback: function (n, fn) { cb[n] = fn; },
    emit: emit,
    snapshot: function () { return S; }
  };

  window.__game = {
    snapshot: function () {
      var o = {};
      for (var k in S) if (k !== "entities" && k !== "rng") o[k] = S[k];
      o.entities = S.entities.length;
      return o;
    },
    start: function () { window.LZGame.start(); },
    swipe: function (d) { window.LZGame.swipe(d); },
    drum: function () { window.LZGame.drum(); },
    setDist: function (m) { S.dist = m; },
    pushEntity: function (kind, type, lane) { push(kind, type, lane, D.Z_MAX); },
    setBoatX: function (x) { S.boatX = x; S.lane = Math.round(x); },
    addScore: function (n) { addScore(n); },
    forceHit: function () { if (S.invT > 0) S.invT = 0; S.steady--; S.combo = 0; emit("hit", {}); if (S.steady <= 0) capsize(); },
    capsize: capsize,
    spawnWave: spawnWave,
    unlockAll: function () { if (window.LZSave) window.LZSave.unlockAll(); },
    save: function () { return window.LZSave ? window.LZSave.load() : null; }
  };
})();
