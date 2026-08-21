(function () {
  var KEY = "dunhuang-save";
  function defaults() { return { codex: [], cards: 0, lastBuild: null, muted: false }; }
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "{}");
      var d = defaults();
      return {
        codex: (o.codex instanceof Array) ? o.codex : d.codex,
        cards: (typeof o.cards === "number") ? o.cards : d.cards,
        lastBuild: (o.lastBuild && typeof o.lastBuild === "object") ? o.lastBuild : d.lastBuild,
        muted: !!o.muted
      };
    } catch (e) { return defaults(); }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  window.DHSave = {
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
