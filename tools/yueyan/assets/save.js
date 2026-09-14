(function () {
  'use strict';
  window.YueYan = window.YueYan || {};
  var D = window.YueYan.Data;

  // §10.2 is the exact schema. `crafting` is the transient short-game marker
  // (Task 6) and must never reach storage: §3.8 makes the day boundary the only
  // save point, so a half-finished craft is not a resumable state.
  function strip(state) {
    var out = {}, k;
    for (k in state) {
      if (state.hasOwnProperty(k) && k !== 'crafting') { out[k] = state[k]; }
    }
    return out;
  }

  // Every failure mode of storage (blocked, full, unreadable, corrupt) degrades
  // to "no save", never to a thrown error: losing progress must not break the
  // run (§3.8).
  function read(key) {
    var raw = null;
    try { raw = window.localStorage.getItem(key); } catch (e) { return null; }
    if (!raw) { return null; }
    try {
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : null;
    } catch (e) { return null; }
  }

  // JSON.stringify snapshots the value at write time, so later engine steps
  // cannot alter what was stored, even though strip() shares nested objects.
  function write(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* storage blocked */ }
  }

  // §10.2 是完整 schema：存档缺任一字段就整体视为无存档，而不是带着残缺状态续局。
  var PROGRESS_FIELDS = ['day', 'silver', 'stock', 'cakes', 'family', 'assignment',
                         'flags', 'patterns', 'banquet', 'ambience',
                         'slotsUsed'];

  function shapeOk(p) {
    var i;
    for (i = 0; i < PROGRESS_FIELDS.length; i++) {
      if (p[PROGRESS_FIELDS[i]] === undefined || p[PROGRESS_FIELDS[i]] === null) {
        return false;
      }
    }
    return true;
  }

  function readProgress() {
    var p = read(D.saveKeys.progress);
    if (!p) { return null; }
    if (p.version !== D.version || !shapeOk(p)) {   // §3.8: discard, never migrate
      clear();
      return null;
    }
    return p;                               // JSON.parse yields fresh data per read
  }

  function writeProgress(state) { write(D.saveKeys.progress, strip(state)); }

  // §7.2 / X-8: meta is the endings-seen list only, no unlock tree or gallery.
  function readMeta() {
    var m = read(D.saveKeys.meta);
    if (!m || m.version !== D.version) { return { version: D.version, endingsSeen: [] }; }
    return m;
  }

  function writeMeta(endingsSeen) {
    write(D.saveKeys.meta, { version: D.version, endingsSeen: endingsSeen || [] });
  }

  // Cross-run meta survives a progress discard: §7.2 keeps endingsSeen across runs.
  function clear() {
    try { window.localStorage.removeItem(D.saveKeys.progress); }
    catch (e) { /* storage blocked */ }
  }

  window.YueYan.Save = {
    writeProgress: writeProgress,
    readProgress: readProgress,
    writeMeta: writeMeta,
    readMeta: readMeta,
    clear: clear
  };
})();
