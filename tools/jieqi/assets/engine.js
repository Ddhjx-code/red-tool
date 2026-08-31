(function () {
  var D = window.JQData;
  var S = null;

  function start(levelIdx) {
    var lv = D.levels[levelIdx];
    S = {
      levelIdx: levelIdx,
      level: lv,
      grain: D.startGrain,
      canglin: D.canglin,
      towers: [],
      enemies: [],
      shots: [],
      fx: [],
      waveIdx: 0,
      waveT: -3,
      spawned: 0,
      phase: "announce",
      trickleT: 0,
      time: 0,
      kills: 0,
      leaked: 0
    };
    return snapshot();
  }

  function tick(dt) {
    if (!S || S.phase === "win" || S.phase === "lose") return;
    S.time += dt;

    S.trickleT += dt;
    if (S.trickleT >= D.trickle.interval) {
      S.trickleT -= D.trickle.interval;
      S.grain += D.trickle.amount;
      S.fx.push({ kind: "grain", text: "+" + D.trickle.amount, x: 0.5, y: 0.06, t0: S.time });
    }

    var wave = S.level.waves[S.waveIdx];
    S.waveT += dt;

    if (S.phase === "announce" && S.waveT >= 0) {
      S.phase = "wave";
      S.spawned = 0;
    }

    if (S.phase === "wave" && wave) {
      while (S.spawned < wave.spawns.length && wave.spawns[S.spawned][0] <= S.waveT) {
        var sp = wave.spawns[S.spawned];
        var et = D.enemies[sp[1]];
        S.enemies.push({
          type: sp[1], lane: sp[2], y: -0.3,
          hp: et.hp, maxHp: et.hp, speed: et.speed,
          slowT: 0, freezeT: 0, burnT: 0, burnDps: 0
        });
        S.spawned++;
      }
      if (S.spawned >= wave.spawns.length && S.enemies.length === 0) {
        if (S.waveIdx >= S.level.waves.length - 1) {
          S.phase = "win";
          return;
        }
        S.waveIdx++;
        S.waveT = -3;
        S.phase = "announce";
      }
    }

    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var e = S.enemies[i];
      var et2 = D.enemies[e.type];
      if (e.slowT > 0) e.slowT -= dt;
      if (e.frozenT > 0) { e.frozenT -= dt; continue; }
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= (e.burnDps || 4) * dt;
        if (Math.random() < dt * 6) S.fx.push({ kind: "burnp", lane: e.lane, y: e.y, t0: S.time });
        if (e.hp <= 0) { killEnemy(i); continue; }
      }
      // 野猪冲撞：正前方近距离有塔则撞毁
      if (et2.charge) {
        var smashed = false;
        for (var ti2 = S.towers.length - 1; ti2 >= 0; ti2--) {
          var tw2 = S.towers[ti2];
          if (tw2.col === e.lane && tw2.row - e.y > -0.1 && tw2.row - e.y < 0.6) {
            S.towers.splice(ti2, 1);
            S.fx.push({ kind: "smash", col: tw2.col, row: tw2.row, t0: S.time });
            e.hp -= 20;
            smashed = true;
            if (e.hp <= 0) { killEnemy(i); smashed = false; }
            break;
          }
        }
        if (smashed) continue;
      }
      var sp2 = e.speed * (e.slowT > 0 ? 0.6 : 1);
      if (et2.water && S.level.waterLane === e.lane) sp2 = et2.waterSpeed || sp2 * 1.6;
      if (S.level.iceLane === e.lane) sp2 *= 1.35;
      e.y += sp2 * dt;
      if (et2.freeze) {
        e.freezeT -= dt;
        if (e.freezeT <= 0) {
          e.freezeT = 6;
          var nearest = null, nd = 1e9;
          for (var ti = 0; ti < S.towers.length; ti++) {
            var tw = S.towers[ti];
            var d2 = Math.abs(tw.col - e.lane) + Math.abs(tw.row - e.y);
            if (d2 < nd && d2 < 2.5) { nd = d2; nearest = tw; }
          }
          if (nearest) {
            nearest.frozen = 3;
            S.fx.push({ kind: "freeze", col: nearest.col, row: nearest.row, t0: S.time });
          }
        }
      }
      if (e.y > D.ROWS + 0.2) {
        S.enemies.splice(i, 1);
        S.canglin--;
        S.leaked++;
        S.fx.push({ kind: "leak", lane: e.lane, t0: S.time });
        if (S.canglin <= 0) { S.phase = "lose"; return; }
      }
    }

    for (var t2 = 0; t2 < S.towers.length; t2++) {
      var tower = S.towers[t2];
      var tt = D.towers[tower.type];
      if (tower.frozen > 0) { tower.frozen -= dt; continue; }
      tower.cd -= dt;
      if (tower.cd > 0) continue;
      if (tt.kind === "farm") {
        tower.cd = tt.rate;
        S.grain += 25;
        S.fx.push({ kind: "grain", text: "+25", x: (tower.col + 0.5) / D.COLS, y: (tower.row + 0.5) / D.ROWS, t0: S.time });
        continue;
      }
      if (tt.kind === "thunder") {
        var hitAny = false;
        var thunderKills = 0;
        for (var e2 = S.enemies.length - 1; e2 >= 0; e2--) {
          var en = S.enemies[e2];
          if (Math.abs(en.lane - tower.col) <= 1 && Math.abs(en.y - tower.row) <= tt.range) {
            en.hp -= tt.dmg;
            hitAny = true;
            S.fx.push({ kind: "zap", lane: en.lane, y: en.y, t0: S.time });
            if (en.hp <= 0) { thunderKills++; killEnemy(e2); }
          }
        }
        if (hitAny) {
          tower.cd = tt.rate;
          S.lastThunderKills = thunderKills;
          S.fx.push({ kind: "thunder", col: tower.col, row: tower.row, t0: S.time });
        } else {
          tower.cd = 0.5;
        }
        continue;
      }
      var target = null, bestY = -1e9;
      for (var e3 = 0; e3 < S.enemies.length; e3++) {
        var en2 = S.enemies[e3];
        if (en2.lane !== tower.col) continue;
        if (D.enemies[en2.type].flying && !tt.antiAir) continue;
        var dist = tower.row - en2.y;
        if (dist >= -0.2 && dist <= tt.range && en2.y > bestY) { bestY = en2.y; target = en2; }
      }
      if (target) {
        tower.cd = tt.rate;
        target.hp -= tt.dmg;
        if (tt.kind === "slow") target.slowT = 2;
        if (tt.kind === "burn") { target.burnT = 3; target.burnDps = tt.burnDps || 4; }
        if (tt.kind === "freeze") { target.frozenT = tt.freezeDur || 2.5; S.fx.push({ kind: "frozenE", lane: target.lane, y: target.y, t0: S.time }); }
        S.shots.push({
          lane: tower.col, fromY: tower.row, toY: target.y,
          t: 0, kind: tt.kind
        });
        if (target.hp <= 0) {
          var idx = S.enemies.indexOf(target);
          if (idx >= 0) killEnemy(idx);
        }
      }
    }

    for (var s2 = S.shots.length - 1; s2 >= 0; s2--) {
      S.shots[s2].t += dt / 0.18;
      if (S.shots[s2].t >= 1) S.shots.splice(s2, 1);
    }
    for (var f2 = S.fx.length - 1; f2 >= 0; f2--) {
      if (S.time - S.fx[f2].t0 > 1.2) S.fx.splice(f2, 1);
    }
  }

  function killEnemy(idx) {
    var e = S.enemies[idx];
    var et = D.enemies[e.type];
    S.grain += et.drop;
    S.kills++;
    S.fx.push({ kind: "kill", lane: e.lane, y: e.y, text: "+" + et.drop, t0: S.time });
    S.enemies.splice(idx, 1);
  }

  function place(type, col, row) {
    if (!S || S.phase === "win" || S.phase === "lose") return false;
    var tt = D.towers[type];
    if (!tt) return false;
    if (S.grain < tt.cost) return false;
    if (col < 0 || col >= D.COLS || row < 0 || row >= D.ROWS) return false;
    for (var i = 0; i < S.towers.length; i++) {
      if (S.towers[i].col === col && S.towers[i].row === row) return false;
    }
    S.grain -= tt.cost;
    S.towers.push({ type: type, col: col, row: row, cd: type === "jingzhe" ? 2 : 0.3, frozen: 0 });
    S.fx.push({ kind: "place", col: col, row: row, t0: S.time });
    return true;
  }

  function snapshot() {
    return {
      levelIdx: S.levelIdx,
      phase: S.phase,
      grain: Math.floor(S.grain),
      canglin: S.canglin,
      waveIdx: S.waveIdx,
      waveTotal: S.level.waves.length,
      banner: S.level.waves[S.waveIdx] ? S.level.waves[S.waveIdx].banner : "",
      towers: S.towers.length,
      enemies: S.enemies.length,
      kills: S.kills,
      leaked: S.leaked,
      time: Math.round(S.time * 10) / 10
    };
  }

  window.JQEngine = {
    start: start,
    tick: tick,
    place: place,
    snapshot: snapshot,
    state: function () { return S; }
  };
})();
