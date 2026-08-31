(function () {
  var D = window.SZData, B = window.SZBoard;
  var DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  function players(units) {
    return units.filter(function (u) { return u.side === "P"; });
  }

  function nearestPlayer(S, u) {
    var best = null, bd = 1e9;
    var ps = players(S.units);
    ps.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    for (var i = 0; i < ps.length; i++) {
      var d = B.manhattan(u, ps[i]);
      if (d < bd) { bd = d; best = ps[i]; }
    }
    if (best && bd > (S.level.huntRange || 99)) return null;
    return best;
  }

  function pickTarget(units, fromC, fromR, range) {
    var best = null, bhp = 1e9;
    var ps = players(units);
    ps.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var d = Math.abs(fromC - p.col) + Math.abs(fromR - p.row);
      if (d <= range && p.hp < bhp) { bhp = p.hp; best = p; }
    }
    return best;
  }

  function plan(S) {
    var units = S.units;
    var intents = [];
    var claimed = {};
    var es = units.filter(function (u) { return u.side === "E"; });
    es.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    for (var i = 0; i < es.length; i++) {
      var u = es[i];
      var t = D.types[u.type];
      if (!t.atk && !t.move) continue;
      var intent = { unitId: u.id, moveTo: null, attack: null };
      if (t.guard && !(u.type === "earc" && S.level.earcHunt)) {
        var tgt0 = pickTarget(units, u.col, u.row, t.range);
        if (tgt0) intent.attack = { targetId: tgt0.id, cell: { col: tgt0.col, row: tgt0.row }, dmg: B.damage(S, u, tgt0) };
        intents.push(intent);
        continue;
      }
      var prey = nearestPlayer(S, u);
      if (!prey) {
        var tgtH = pickTarget(units, u.col, u.row, t.range);
        if (tgtH) intent.attack = { targetId: tgtH.id, cell: { col: tgtH.col, row: tgtH.row }, dmg: B.damage(S, u, tgtH) };
        intents.push(intent);
        continue;
      }
      var cands = [{ col: u.col, row: u.row }];
      for (var d = 0; d < 4; d++) {
        var nc = u.col + DIRS[d][0], nr = u.row + DIRS[d][1];
        if (!B.inBounds(nc, nr)) continue;
        if (t.avoidForest && B.isForest(S, nc, nr)) continue;
        if (B.isScorched(S, nc, nr)) continue;
        var occ = B.unitAt(units, nc, nr);
        if (occ && occ.id !== u.id) continue;
        if (claimed[B.key(nc, nr)]) continue;
        cands.push({ col: nc, row: nr });
      }
      cands.sort(function (a, b) {
        var da = Math.abs(a.col - prey.col) + Math.abs(a.row - prey.row);
        var db = Math.abs(b.col - prey.col) + Math.abs(b.row - prey.row);
        return da - db || a.row - b.row || a.col - b.col;
      });
      var dest = cands[0];
      if (dest.col !== u.col || dest.row !== u.row) {
        intent.moveTo = { col: dest.col, row: dest.row };
        claimed[B.key(dest.col, dest.row)] = true;
      } else {
        claimed[B.key(u.col, u.row)] = true;
      }
      var tgt = pickTarget(units, dest.col, dest.row, t.range);
      if (tgt) intent.attack = { targetId: tgt.id, cell: { col: tgt.col, row: tgt.row }, dmg: B.damage(S, u, tgt) };
      intents.push(intent);
    }
    return intents;
  }

  function execute(S, intents) {
    var events = [];
    for (var i = 0; i < intents.length; i++) {
      var it = intents[i];
      var u = null;
      for (var j = 0; j < S.units.length; j++) {
        if (S.units[j].id === it.unitId) { u = S.units[j]; break; }
      }
      if (!u) continue;
      var t = D.types[u.type];
      if (it.moveTo && !B.unitAt(S.units, it.moveTo.col, it.moveTo.row) && !B.isScorched(S, it.moveTo.col, it.moveTo.row)) {
        events.push({ type: "emove", unitId: u.id, from: { col: u.col, row: u.row }, to: it.moveTo });
        u.col = it.moveTo.col;
        u.row = it.moveTo.row;
      }
      if (it.attack) {
        var tgt = null;
        for (var k = 0; k < S.units.length; k++) {
          if (S.units[k].id === it.attack.targetId) { tgt = S.units[k]; break; }
        }
        var hit = tgt && tgt.col === it.attack.cell.col && tgt.row === it.attack.cell.row &&
          B.manhattan(u, tgt) <= t.range;
        if (hit) {
          var dmg = B.damage(S, u, tgt);
          tgt.hp -= dmg;
          events.push({ type: "ehit", unitId: u.id, targetId: tgt.id, cell: it.attack.cell, dmg: dmg });
          if (tgt.hp <= 0) {
            events.push({ type: "dead", unitId: tgt.id, cell: { col: tgt.col, row: tgt.row } });
            S.units.splice(S.units.indexOf(tgt), 1);
          }
        } else {
          events.push({ type: "miss", unitId: u.id, cell: it.attack.cell });
        }
      }
    }
    return events;
  }

  window.SZAI = { plan: plan, execute: execute };
})();
