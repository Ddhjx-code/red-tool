(function () {
  var KEY = "qiqiao-save";
  function defaults() { return { codex: [], runs: 0, lastShadow: "", muted: false }; }
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "{}");
      var d = defaults();
      return {
        codex: (o.codex instanceof Array) ? o.codex : d.codex,
        runs: (typeof o.runs === "number") ? o.runs : d.runs,
        lastShadow: (typeof o.lastShadow === "string") ? o.lastShadow : d.lastShadow,
        muted: !!o.muted
      };
    } catch (e) { return defaults(); }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  window.QQSave = {
    load: load,
    save: save,
    unlock: function (id) {
      var o = load();
      if (o.codex.indexOf(id) >= 0) return false;
      o.codex.push(id);
      save(o);
      return true;
    },
    codexCount: function () { return load().codex.length; }
  };
})();
