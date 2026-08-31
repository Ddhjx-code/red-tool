(function () {
  var KEY = "hedeng-save";
  function defaults() { return { codex: [], runs: 0, muted: false }; }
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "{}");
      var d = defaults();
      return {
        codex: (o.codex instanceof Array) ? o.codex : d.codex,
        runs: (typeof o.runs === "number") ? o.runs : d.runs,
        muted: !!o.muted
      };
    } catch (e) { return defaults(); }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  window.HDSave = {
    load: load,
    save: save,
    unlock: function (combo) {
      var o = load();
      var isNew = o.codex.indexOf(combo) < 0;
      if (isNew) o.codex.push(combo);
      o.runs += 1;
      save(o);
      return isNew;
    },
    codexCount: function () { return load().codex.length; }
  };
})();
