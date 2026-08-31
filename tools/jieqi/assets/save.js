(function () {
  var KEY = "jieqi-save";
  function defaults() {
    return { levels: {}, seen: [], achievements: [], kills: 0, wins: 0, perfect: 0 };
  }
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "{}");
      var d = defaults();
      return {
        levels: (o.levels && typeof o.levels === "object") ? o.levels : d.levels,
        seen: (o.seen instanceof Array) ? o.seen : d.seen,
        achievements: (o.achievements instanceof Array) ? o.achievements : d.achievements,
        kills: (typeof o.kills === "number") ? o.kills : d.kills,
        wins: (typeof o.wins === "number") ? o.wins : d.wins,
        perfect: (typeof o.perfect === "number") ? o.perfect : d.perfect
      };
    } catch (e) { return defaults(); }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  window.JQSave = {
    load: load,
    save: save,
    recordWin: function (levelId, stars, kills, leaked) {
      var o = load();
      var prev = o.levels[levelId] || 0;
      if (stars > prev) o.levels[levelId] = stars;
      o.wins += 1;
      o.kills += kills;
      if (leaked === 0) o.perfect += 1;
      save(o);
      return o;
    },
    seeEnemy: function (type) {
      var o = load();
      var isNew = o.seen.indexOf(type) < 0;
      if (isNew) { o.seen.push(type); save(o); }
      return isNew;
    },
    unlockAch: function (id) {
      var o = load();
      var isNew = o.achievements.indexOf(id) < 0;
      if (isNew) { o.achievements.push(id); save(o); }
      return isNew;
    }
  };
})();
