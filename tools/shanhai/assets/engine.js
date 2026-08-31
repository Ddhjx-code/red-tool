(function () {
  var D = window.SHData;
  var S = null;

  function start(levelIdx) {
    var lv = D.levels[levelIdx];
    S = {
      levelIdx: levelIdx,
      level: lv,
      phase: "play",
      time: 0,
      px: D.W / 2, py: D.H - 90,
      hp: D.player.hp,
      weaponLv: 1,
      bombs: 2,
      shield: 0,
      fireCd: 0,
      bullets: [],
      ebullets: [],
      enemies: [],
      drops: [],
      fx: [],
      waveIdx: 0,
      waveT: 0,
      spawnedInWave: 0,
      score: 0,
      kills: 0,
      seen: {},
      bossSpawned: false
    };
    return snapshot();
  }

  function step(dt) {
    if (!S || S.phase !== "play") return;
    S.time += dt;
    spawnWave(dt);
    moveEnemies(dt);
    moveBullets(dt);
    moveDrops(dt);
    autoFire(dt);
    collide();
    if (S.hp <= 0) S.phase = "lose";
    if (S.waveIdx >= S.level.waves && S.enemies.length === 0 &&
        (!S.level.boss || S.bossSpawned && !S.enemies.some(function (e) { return D.enemies[e.type].boss; }))) {
      S.phase = "win";
    }
  }

  function spawnWave(dt) {
    if (S.waveIdx >= S.level.waves) return;
    S.waveT += dt;
    var interval = Math.max(0.5, 1.6 - S.waveIdx * 0.2);
    var perWave = 4 + S.waveIdx;
    if (S.waveT >= interval && S.spawnedInWave < perWave) {
      S.waveT = 0;
      S.spawnedInWave++;
      var pool = ["qiongqi", "qiongqi", "bifang", "goudiao"];
      var type = pool[Math.floor(Math.random() * pool.length)];
      spawnEnemy(type, 40 + Math.random() * (D.W - 80), -30);
    }
    if (S.spawnedInWave >= perWave && S.enemies.length === 0) {
      S.waveIdx++;
      S.spawnedInWave = 0;
      if (S.waveIdx >= S.level.waves && S.level.boss && !S.bossSpawned) {
        spawnEnemy("taotie", D.W / 2, -60);
        S.bossSpawned = true;
      }
    }
  }

  function spawnEnemy(type, x, y) {
    var et = D.enemies[type];
    S.enemies.push({ type: type, x: x, y: y, hp: et.hp, fireCd: 1 + Math.random() });
    S.seen[type] = true;
  }

  function moveEnemies(dt) {
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var e = S.enemies[i];
      var et = D.enemies[e.type];
      e.y += et.speed * dt * 60;
      if (et.boss) {
        e.x += Math.sin(S.time * 1.2) * 1.2;
        if (e.y > 120) e.y = 120;
      }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.y > 0 && e.y < D.H - 150) {
        e.fireCd = et.boss ? 0.8 : 2.2 + Math.random();
        if (et.boss) {
          for (var a = -1; a <= 1; a++) S.ebullets.push({ x: e.x + a * 20, y: e.y + 20, vx: a * 1.2, vy: 3.2 });
        } else if (Math.random() < 0.5) {
          S.ebullets.push({ x: e.x, y: e.y + 15, vx: 0, vy: 3 });
        }
      }
      if (e.y > D.H + 40) S.enemies.splice(i, 1);
    }
  }

  function moveBullets(dt) {
    var f = dt * 60;
    for (var i = S.bullets.length - 1; i >= 0; i--) {
      var b = S.bullets[i];
      b.x += b.vx * f; b.y += b.vy * f;
      if (b.y < -20 || b.x < -20 || b.x > D.W + 20) S.bullets.splice(i, 1);
    }
    for (var j = S.ebullets.length - 1; j >= 0; j--) {
      var eb = S.ebullets[j];
      eb.x += eb.vx * f; eb.y += eb.vy * f;
      if (eb.y > D.H + 20 || eb.x < -20 || eb.x > D.W + 20) S.ebullets.splice(j, 1);
    }
  }

  function moveDrops(dt) {
    var f = dt * 60;
    for (var i = S.drops.length - 1; i >= 0; i--) {
      var d = S.drops[i];
      d.y += 1.6 * f;
      if (d.y > D.H + 20) S.drops.splice(i, 1);
    }
  }

  function autoFire(dt) {
    S.fireCd -= dt;
    if (S.fireCd <= 0) {
      S.fireCd = D.player.fireRate / 60;
      var lv = S.weaponLv;
      if (lv === 1) {
        S.bullets.push({ x: S.px, y: S.py - 20, vx: 0, vy: -8, dmg: D.player.dmg });
      } else if (lv === 2) {
        S.bullets.push({ x: S.px - 8, y: S.py - 18, vx: 0, vy: -8, dmg: D.player.dmg });
        S.bullets.push({ x: S.px + 8, y: S.py - 18, vx: 0, vy: -8, dmg: D.player.dmg });
      } else {
        S.bullets.push({ x: S.px, y: S.py - 20, vx: 0, vy: -8, dmg: D.player.dmg });
        S.bullets.push({ x: S.px - 10, y: S.py - 14, vx: -1.6, vy: -7.5, dmg: D.player.dmg });
        S.bullets.push({ x: S.px + 10, y: S.py - 14, vx: 1.6, vy: -7.5, dmg: D.player.dmg });
      }
    }
  }

  function collide() {
    var i, j, b, e;
    for (i = S.bullets.length - 1; i >= 0; i--) {
      b = S.bullets[i];
      for (j = S.enemies.length - 1; j >= 0; j--) {
        e = S.enemies[j];
        var et = D.enemies[e.type];
        if (Math.abs(b.x - e.x) < et.r && Math.abs(b.y - e.y) < et.r) {
          e.hp -= b.dmg;
          S.bullets.splice(i, 1);
          S.fx.push({ kind: "hit", x: e.x, y: e.y, t0: S.time });
          if (e.hp <= 0) {
            S.score += et.score;
            S.kills++;
            S.fx.push({ kind: "boom", x: e.x, y: e.y, t0: S.time });
            if (Math.random() < 0.18) {
              var kinds = ["sword", "thunder", "mirror"];
              S.drops.push({ kind: kinds[Math.floor(Math.random() * kinds.length)], x: e.x, y: e.y });
            }
            S.enemies.splice(j, 1);
          }
          break;
        }
      }
    }
    for (j = S.ebullets.length - 1; j >= 0; j--) {
      var eb = S.ebullets[j];
      if (Math.abs(eb.x - S.px) < 18 && Math.abs(eb.y - S.py) < 18) {
        S.ebullets.splice(j, 1);
        hurtPlayer();
      }
    }
    for (j = S.enemies.length - 1; j >= 0; j--) {
      e = S.enemies[j];
      var et2 = D.enemies[e.type];
      if (Math.abs(e.x - S.px) < et2.r + 12 && Math.abs(e.y - S.py) < et2.r + 12) {
        hurtPlayer();
        if (!et2.boss) { S.enemies.splice(j, 1); S.fx.push({ kind: "boom", x: e.x, y: e.y, t0: S.time }); }
      }
    }
    for (j = S.drops.length - 1; j >= 0; j--) {
      var d = S.drops[j];
      if (Math.abs(d.x - S.px) < 24 && Math.abs(d.y - S.py) < 24) {
        applyDrop(d.kind);
        S.drops.splice(j, 1);
      }
    }
  }

  function hurtPlayer() {
    if (S.shield > 0) { S.shield--; S.fx.push({ kind: "shieldbreak", x: S.px, y: S.py, t0: S.time }); return; }
    S.hp--;
    S.fx.push({ kind: "hurt", x: S.px, y: S.py, t0: S.time });
  }

  function applyDrop(kind) {
    if (kind === "sword") { S.weaponLv = Math.min(3, S.weaponLv + 1); S.fx.push({ kind: "power", x: S.px, y: S.py, t0: S.time, text: "飞剑升级" }); }
    else if (kind === "thunder") { S.bombs = Math.min(5, S.bombs + 1); S.fx.push({ kind: "power", x: S.px, y: S.py, t0: S.time, text: "雷符 +1" }); }
    else if (kind === "mirror") { S.shield = Math.min(2, S.shield + 1); S.fx.push({ kind: "power", x: S.px, y: S.py, t0: S.time, text: "八卦镜护身" }); }
  }

  function useBomb() {
    if (!S || S.phase !== "play" || S.bombs <= 0) return false;
    S.bombs--;
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var e = S.enemies[i];
      var et = D.enemies[e.type];
      if (et.boss) { e.hp -= 10; if (e.hp <= 0) { S.score += et.score; S.kills++; S.enemies.splice(i, 1); } }
      else { S.score += et.score; S.kills++; S.enemies.splice(i, 1); }
      S.fx.push({ kind: "boom", x: e.x, y: e.y, t0: S.time });
    }
    S.ebullets = [];
    S.fx.push({ kind: "thunder", x: S.px, y: S.py, t0: S.time });
    return true;
  }

  function movePlayer(x, y) {
    if (!S || S.phase !== "play") return;
    S.px = Math.max(20, Math.min(D.W - 20, x));
    S.py = Math.max(D.H / 2, Math.min(D.H - 40, y));
  }

  function snapshot() {
    return {
      phase: S.phase, time: Math.round(S.time * 10) / 10,
      hp: S.hp, weaponLv: S.weaponLv, bombs: S.bombs, shield: S.shield,
      score: S.score, kills: S.kills, waveIdx: S.waveIdx, waveTotal: S.level.waves,
      enemies: S.enemies.length, seen: Object.keys(S.seen)
    };
  }

  window.SHEngine = {
    start: start, step: step, movePlayer: movePlayer, useBomb: useBomb,
    snapshot: snapshot, state: function () { return S; }
  };
})();
