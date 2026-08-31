(function () {
  var KEY = "guiyue-save";
  function defaults() { return { endings: [], runs: 0, bestYang: -1, muted: false }; }
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "{}");
      var d = defaults();
      return {
        endings: (o.endings instanceof Array) ? o.endings : d.endings,
        runs: (typeof o.runs === "number") ? o.runs : d.runs,
        bestYang: (typeof o.bestYang === "number") ? o.bestYang : d.bestYang,
        muted: !!o.muted
      };
    } catch (e) { return defaults(); }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  window.GYSave = {
    load: load,
    save: save,
    record: function (endingId, yang) {
      var o = load();
      var isNew = o.endings.indexOf(endingId) < 0;
      if (isNew) o.endings.push(endingId);
      o.runs += 1;
      if (yang > o.bestYang) o.bestYang = yang;
      save(o);
      return isNew;
    }
  };
})();
