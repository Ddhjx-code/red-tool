(function () {
  var SPEC = window.WHData.ANIM;
  var FRAMES = window.WHData.ANIM_FRAMES || {};
  var ATLAS = window.WHData.ANIM_ATLAS || {};
  var clips = {};
  var sheets = {};

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function spec(name) { return SPEC[name] || { base: name, fps: 10, loop: true }; }

  function probe(name, n, done) {
    var s = spec(name);
    var list = [];
    var i = 0;
    if (!(n > 0)) { done(name, list); return; }
    function step() {
      var idx = i;
      if (idx >= n) { done(name, list); return; }
      var im = new Image();
      im.onload = function () {
        list[idx] = im;
        i = idx + 1;
        step();
      };
      im.onerror = function () { done(name, list); };
      im.src = "./assets/img/" + s.base + "-" + pad(idx) + ".webp";
    }
    step();
  }

  function load(cb) {
    var names = [];
    var k;
    var left;
    var j;
    for (k in SPEC) {
      if (Object.prototype.hasOwnProperty.call(SPEC, k)) { names.push(k); }
    }
    left = names.length;
    if (!left) {
      if (cb) { cb(); }
      return;
    }
    for (j = 0; j < names.length; j++) {
      (function (name) {
        var a = ATLAS[name];
        var sheet;
        if (a && a.file) {
          sheet = new Image();
          sheet.onload = function () {
            sheets[name] = { img: sheet, fw: a.fw, fh: a.fh, cols: a.cols,
                             rows: a.rows || 1, pad: a.pad || 0,
                             n: a.cols * (a.rows || 1) };
            left -= 1;
            if (left === 0 && cb) { cb(); }
          };
          sheet.onerror = function () {
            left -= 1;
            if (left === 0 && cb) { cb(); }
          };
          sheet.src = "./assets/img/" + a.file;
          return;
        }
        probe(name, FRAMES[name] || 0, function (n, list) {
          clips[n] = list;
          left -= 1;
          if (left === 0 && cb) { cb(); }
        });
      })(names[j]);
    }
  }

  function count(name) {
    if (sheets[name]) { return sheets[name].n; }
    return clips[name] ? clips[name].length : 0;
  }

  function ready(name) { return count(name) >= 2; }

  function frameIndex(name, t, n) {
    var s = spec(name);
    var i = Math.floor(t * (s.fps || 10));
    if (i < 0) { i = 0; }
    if (s.loop) { return i % n; }
    return i < n ? i : n - 1;
  }

  function indexAt(name, t) {
    var n = count(name);
    if (n <= 0) { return -1; }
    return frameIndex(name, t, n);
  }

  function frameAt(name, t) {
    var n = count(name);
    var a = sheets[name];
    var i;
    if (n <= 0) { return null; }
    i = frameIndex(name, t, n);
    if (a) {
      return { img: a.img,
               sx: (i % a.cols) * (a.fw + (a.pad || 0)),
               sy: Math.floor(i / a.cols) * (a.fh + (a.pad || 0)),
               sw: a.fw, sh: a.fh };
    }
    return { img: clips[name][i] };
  }

  function report() {
    var out = {};
    var k;
    for (k in SPEC) {
      if (Object.prototype.hasOwnProperty.call(SPEC, k)) {
        out[k] = count(k);
        if (sheets[k]) { out[k + "_atlas"] = true; }
      }
    }
    return out;
  }

  window.WHAnim = {
    load: load,
    count: count,
    ready: ready,
    indexAt: indexAt,
    frameAt: frameAt,
    report: report
  };
})();
