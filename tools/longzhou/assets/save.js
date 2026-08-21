(function () {
  var KEY = "longzhou-save";
  function load() {
    try { var o = JSON.parse(localStorage.getItem(KEY) || "{}"); return { best: o.best || 0, bestDist: o.bestDist || 0, codex: o.codex || [], runs: o.runs || 0, muted: !!o.muted }; }
    catch (e) { return { best: 0, bestDist: 0, codex: [], runs: 0, muted: false }; }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  window.LZSave = {
    load: load, save: save,
    unlock: function (id) { var o = load(); if (o.codex.indexOf(id) >= 0) return false; o.codex.push(id); save(o); return true; },
    unlockAll: function () { var o = load(); o.codex = window.LZData.CODEX.map(function (c) { return c.id; }); save(o); },
    codexCount: function () { return load().codex.length; }
  };
})();
