(function () {
  var D = window.SZData, B = window.SZBoard, AI = window.SZAI;
  var S = null;

  function start(levelIdx, formationIdx) {
    var lv = D.levels[levelIdx];
    var pos = lv.playerDefault;
    if (lv.formations && formationIdx >= 0 && lv.formations[formationIdx]) {
      pos = lv.formations[formationIdx].pos;
    }
    var units = D.playerUnits.map(function (p) {
      return {
        id: p.id, side: "P", type: p.type,
        col: pos[p.id][0], row: pos[p.id][1],
        hp: D.types[p.type].hp, done: false, movedSteps: 0, preMove: null,
        morale: null
      };
    });
    lv.units.forEach(function (e) {
      units.push({
        id: e.id, side: e.side, type: e.type, col: e.col, row: e.row,
        hp: D.types[e.type].hp, done: false, movedSteps: 0, preMove: null,
        morale: lv.morale ? (e.type === "flag" ? 5 : 3) : null
      });
    });
    S = {
      levelIdx: levelIdx,
      level: lv,
      formationIdx: formationIdx || 0,
      turn: 1,
      phase: "player",
      units: units,
      intents: [],
      fx: [],
      selected: null,
      lost: [],
      kills: 0,
      surrendered: [],
      reason: null,
      spawned: 0,
      forest: lv.forest.slice(),
      reed: lv.reed.slice(),
      wind: lv.wind,
      fire: {},
      scorched: {},
      fireUsed: false,
      igniteMode: false
    };
    S.intents = AI.plan(S);
    return snapshot();
  }

  function unit(id) {
    for (var i = 0; i < S.units.length; i++) if (S.units[i].id === id) return S.units[i];
    return null;
  }

  function snapshot() {
    return {
      levelIdx: S.levelIdx,
      turn: S.turn,
      phase: S.phase,
      units: S.units.map(function (u) {
        return { id: u.id, side: u.side, type: u.type, col: u.col, row: u.row, hp: u.hp, done: u.done, movedSteps: u.movedSteps, morale: u.morale };
      }),
      intents: S.intents.map(function (it) {
        return {
          unitId: it.unitId,
          moveTo: it.moveTo ? { col: it.moveTo.col, row: it.moveTo.row } : null,
          attack: it.attack ? { targetId: it.attack.targetId, cell: { col: it.attack.cell.col, row: it.attack.cell.row }, dmg: it.attack.dmg } : null
        };
      }),
      lost: S.lost.slice(),
      kills: S.kills,
      surrendered: S.surrendered.slice(),
      fireUsed: S.fireUsed,
      fire: JSON.parse(JSON.stringify(S.fire)),
      scorched: Object.keys(S.scorched),
      selected: S.selected
    };
  }

  function select(id) {
    if (S.phase !== "player") return false;
    var u = id ? unit(id) : null;
    if (u && (u.side !== "P" || u.done)) return false;
    S.selected = u ? u.id : null;
    S.igniteMode = false;
    return true;
  }

  function move(c, r) {
    if (S.phase !== "player" || !S.selected) return false;
    var u = unit(S.selected);
    if (u.movedSteps > 0) return false;
    var steps = B.pathSteps(S, u, c, r);
    if (steps < 0) return false;
    u.preMove = { col: u.col, row: u.row };
    u.col = c;
    u.row = r;
    u.movedSteps += steps;
    return true;
  }

  function undoMove() {
    if (S.phase !== "player" || !S.selected) return false;
    var u = unit(S.selected);
    if (!u.preMove) return false;
    u.col = u.preMove.col;
    u.row = u.preMove.row;
    u.preMove = null;
    u.movedSteps = 0;
    return true;
  }

  function attack(targetId) {
    if (S.phase !== "player" || !S.selected) return false;
    var u = unit(S.selected);
    var tgt = unit(targetId);
    if (!tgt || tgt.side === u.side) return false;
    if (B.manhattan(u, tgt) > D.types[u.type].range) return false;
    var dmg = B.damage(S, u, tgt);
    tgt.hp -= dmg;
    u.done = true;
    u.preMove = null;
    var ta = D.types[u.type];
    var charge = ta.range === 1 && ta.charge && (u.movedSteps || 0) >= 2;
    S.fx.push({ kind: "dmg", col: tgt.col, row: tgt.row, text: "-" + dmg, side: "P", tier: charge ? "charge" : "normal", t0: Date.now() });
    if (tgt.hp <= 0) {
      S.units.splice(S.units.indexOf(tgt), 1);
      S.kills++;
      S.fx.push({ kind: "dead", col: tgt.col, row: tgt.row, t0: Date.now() });
    }
    S.selected = null;
    checkEnd();
    return true;
  }

  function waitUnit() {
    if (S.phase !== "player" || !S.selected) return false;
    var u = unit(S.selected);
    u.done = true;
    u.preMove = null;
    S.selected = null;
    return true;
  }

  function ignitableCells() {
    if (!S || S.fireUsed || !S.selected) return [];
    var u = unit(S.selected);
    var out = [];
    var seen = {};
    for (var i = 0; i < S.reed.length; i++) {
      var p = S.reed[i].split(",");
      var c = +p[0], r = +p[1];
      if (S.fire[B.key(c, r)] || S.scorched[B.key(c, r)]) continue;
      if (Math.abs(c - u.col) + Math.abs(r - u.row) === 1 && !seen[B.key(c, r)]) {
        seen[B.key(c, r)] = true;
        out.push({ col: c, row: r });
      }
    }
    return out;
  }

  function ignite(c, r) {
    if (S.phase !== "player" || !S.selected || S.fireUsed) return false;
    var ok = ignitableCells().some(function (m) { return m.col === c && m.row === r; });
    if (!ok) return false;
    var u = unit(S.selected);
    S.fire[B.key(c, r)] = { left: 3 };
    S.fireUsed = true;
    u.done = true;
    u.preMove = null;
    S.selected = null;
    S.igniteMode = false;
    S.fx.push({ kind: "ignite", col: c, row: r, t0: Date.now() });
    return true;
  }

  function firePhase() {
    var events = [];
    if (!S.reed.length) return events;
    var burning = Object.keys(S.fire);
    if (!burning.length) return events;
    burning.forEach(function (k) {
      var p = k.split(",");
      var c = +p[0], r = +p[1];
      var victim = B.unitAt(S.units, c, r);
      if (victim) {
        victim.hp -= 3;
        events.push({ type: "burn", unitId: victim.id, cell: { col: c, row: r }, dmg: 3 });
        S.fx.push({ kind: "dmg", col: c, row: r, text: "-3", side: "E", t0: Date.now() });
        if (victim.hp <= 0) {
          events.push({ type: "dead", unitId: victim.id, cell: { col: victim.col, row: victim.row } });
          if (victim.side === "P") S.lost.push(victim.id);
          else S.kills++;
          S.units.splice(S.units.indexOf(victim), 1);
        }
      }
    });
    var spread = [];
    burning.forEach(function (k) {
      var p = k.split(",");
      var c = +p[0], r = +p[1];
      var targets = [];
      if (S.wind === "E") targets = [[c + 1, r], [c, r - 1], [c, r + 1]];
      else if (S.wind === "W") targets = [[c - 1, r], [c, r - 1], [c, r + 1]];
      else targets = [[c + 1, r], [c - 1, r], [c, r - 1], [c, r + 1]];
      targets.forEach(function (t) {
        var nk = B.key(t[0], t[1]);
        if (S.reed.indexOf(nk) >= 0 && !S.fire[nk] && !S.scorched[nk]) {
          spread.push(nk);
        }
      });
    });
    spread.forEach(function (nk) { S.fire[nk] = { left: 3 }; });
    burning.forEach(function (k) {
      S.fire[k].left--;
      if (S.fire[k].left <= 0) {
        delete S.fire[k];
        S.scorched[k] = true;
      }
    });
    return events;
  }

  function moralePhase() {
    var events = [];
    if (!S.level.morale) return events;
    var es = S.units.filter(function (u) { return u.side === "E"; });
    es.forEach(function (u) {
      if (u.morale === null) return;
      var hasAlly = es.some(function (v) {
        return v.id !== u.id && B.manhattan(u, v) <= 1;
      });
      if (!hasAlly) {
        u.morale--;
        if (u.morale <= 0) {
          events.push({ type: "surrender", unitId: u.id, cell: { col: u.col, row: u.row } });
          S.surrendered.push(u.id);
          S.fx.push({ kind: "surrender", col: u.col, row: u.row, t0: Date.now() });
          S.units.splice(S.units.indexOf(u), 1);
        }
      }
    });
    return events;
  }

  function allDone() {
    for (var i = 0; i < S.units.length; i++) {
      var u = S.units[i];
      if (u.side === "P" && !u.done) return false;
    }
    return true;
  }

  function checkEnd() {
    var flag = false, anyP = false;
    for (var i = 0; i < S.units.length; i++) {
      if (S.units[i].type === "flag") flag = true;
      if (S.units[i].side === "P") anyP = true;
    }
    if (!flag) { S.phase = "win"; }
    else if (!anyP) { S.phase = "lose"; S.reason = "wiped"; }
  }

  function spawnReinforcement() {
    var spots = S.level.reinforce.spots;
    for (var i = 0; i < spots.length; i++) {
      var c = spots[i][0], r = spots[i][1];
      if (!B.unitAt(S.units, c, r)) {
        S.spawned++;
        var id = "r" + S.spawned;
        var t = D.types[S.level.reinforce.type];
        S.units.push({
          id: id, side: "E", type: S.level.reinforce.type, col: c, row: r,
          hp: t.hp, done: false, movedSteps: 0, preMove: null,
          morale: S.level.morale ? 3 : null
        });
        S.fx.push({ kind: "spawn", col: c, row: r, t0: Date.now() });
        return id;
      }
    }
    return null;
  }

  function endTurn() {
    if (S.phase !== "player") return [];
    var events = [];
    var fe = firePhase();
    events = events.concat(fe);
    checkEnd();
    if (S.phase !== "player") return events;
    var ae = AI.execute(S, S.intents);
    events = events.concat(ae);
    var me = moralePhase();
    events = events.concat(me);
    checkEnd();
    ae.forEach(function (ev) {
      if (ev.type === "ehit") {
        S.fx.push({ kind: "dmg", col: ev.cell.col, row: ev.cell.row, text: "-" + ev.dmg, side: "E", t0: Date.now() });
      }
      if (ev.type === "dead" && ev.cell) {
        if (ev.unitId.charAt(0) === "p" && S.lost.indexOf(ev.unitId) < 0) S.lost.push(ev.unitId);
        S.fx.push({ kind: "dead", col: ev.cell.col, row: ev.cell.row, t0: Date.now() });
      }
    });
    if (S.phase === "player") {
      S.turn++;
      if (S.level.reinforce && S.level.reinforce.turns.indexOf(S.turn) >= 0) {
        var rid = spawnReinforcement();
        if (rid) events.push({ type: "spawn", unitId: rid });
      }
      if (S.turn > S.level.turnLimit) {
        S.phase = "lose";
        S.reason = "timeout";
        return events;
      }
      S.units.forEach(function (u) { if (u.side === "P") { u.done = false; u.movedSteps = 0; u.preMove = null; } });
      S.intents = AI.plan(S);
      S.selected = null;
    }
    return events;
  }

  function result() {
    if (S.phase !== "win" && S.phase !== "lose") return null;
    var stars = 0;
    if (S.phase === "win") {
      stars = 1;
      if (S.turn <= S.level.stars3Turns + 2) stars = 2;
      if (S.turn <= S.level.stars3Turns && S.lost.length === 0) stars = 3;
    }
    return {
      phase: S.phase, turn: S.turn, stars: stars,
      lost: S.lost.slice(), reason: S.reason,
      kills: S.kills, surrendered: S.surrendered.slice()
    };
  }

  function state() { return S; }

  window.SZGame = {
    start: start,
    snapshot: snapshot,
    select: select,
    move: move,
    undoMove: undoMove,
    attack: attack,
    waitUnit: waitUnit,
    ignitableCells: ignitableCells,
    ignite: ignite,
    allDone: allDone,
    endTurn: endTurn,
    result: result,
    unit: unit,
    state: state
  };
})();
