(function () {
  var D = window.SZData;

  function key(c, r) { return c + "," + r; }
  function inBounds(c, r) { return c >= 0 && r >= 0 && c < D.COLS && r < D.ROWS; }
  function isForest(S, c, r) { return S.forest.indexOf(key(c, r)) >= 0; }
  function isReed(S, c, r) { return S.reed.indexOf(key(c, r)) >= 0; }
  function isScorched(S, c, r) { return !!S.scorched[key(c, r)]; }
  function manhattan(a, b) { return Math.abs(a.col - b.col) + Math.abs(a.row - b.row); }
  var DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  function unitAt(units, c, r) {
    for (var i = 0; i < units.length; i++) {
      if (units[i].col === c && units[i].row === r) return units[i];
    }
    return null;
  }

  function moveRange(S, u) {
    var t = D.types[u.type];
    if (!t.move) return [];
    var dist = {};
    dist[key(u.col, u.row)] = 0;
    var queue = [[u.col, u.row]];
    while (queue.length) {
      var cur = queue.shift();
      var ck = key(cur[0], cur[1]);
      if (dist[ck] >= t.move) continue;
      for (var d = 0; d < 4; d++) {
        var nc = cur[0] + DIRS[d][0], nr = cur[1] + DIRS[d][1];
        var nk = key(nc, nr);
        if (!inBounds(nc, nr) || dist[nk] !== undefined) continue;
        if (unitAt(S.units, nc, nr)) continue;
        if (isScorched(S, nc, nr)) continue;
        if (t.avoidForest && isForest(S, nc, nr)) continue;
        dist[nk] = dist[ck] + 1;
        queue.push([nc, nr]);
      }
    }
    var cells = [];
    for (var k in dist) {
      if (dist[k] > 0) {
        var p = k.split(",");
        cells.push({ col: +p[0], row: +p[1], steps: dist[k] });
      }
    }
    cells.sort(function (a, b) { return a.row - b.row || a.col - b.col; });
    return cells;
  }

  function pathSteps(S, u, c, r) {
    var cells = moveRange(S, u);
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].col === c && cells[i].row === r) return cells[i].steps;
    }
    return -1;
  }

  function attackables(S, u) {
    var t = D.types[u.type];
    if (!t.atk) return [];
    var out = [];
    for (var i = 0; i < S.units.length; i++) {
      var v = S.units[i];
      if (v.side === u.side) continue;
      if (manhattan(u, v) <= t.range) out.push(v);
    }
    out.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    return out;
  }

  function damage(S, att, def) {
    var ta = D.types[att.type];
    var dmg = ta.atk;
    if (ta.range === 1 && ta.charge && (att.movedSteps || 0) >= 2) dmg += ta.charge;
    if (ta.range > 1 && isForest(S, def.col, def.row)) dmg = Math.max(1, Math.floor(dmg / 2));
    return dmg;
  }

  window.SZBoard = {
    key: key,
    inBounds: inBounds,
    isForest: isForest,
    isReed: isReed,
    isScorched: isScorched,
    manhattan: manhattan,
    unitAt: unitAt,
    moveRange: moveRange,
    pathSteps: pathSteps,
    attackables: attackables,
    damage: damage
  };
})();
