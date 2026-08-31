(function () {
  var KEY = "sunzi-save";

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { stars: {} };
      var d = JSON.parse(raw);
      if (!d || typeof d.stars !== "object") return { stars: {} };
      return { stars: d.stars };
    } catch (e) { return { stars: {} }; }
  }

  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  function recordStars(levelId, stars) {
    var d = load();
    if (!d.stars[levelId] || stars > d.stars[levelId]) {
      d.stars[levelId] = stars;
      save(d);
      return true;
    }
    return false;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  window.SZSave = { load: load, save: save, recordStars: recordStars, clear: clear };
})();
