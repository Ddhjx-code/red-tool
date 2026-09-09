'use strict';

  /* ============================ [RNG] ============================
     §7 determinism: global ban on ambient randomness. Every particle,
     frost mote, haze sample and share-card speck comes from a seeded
     stream so recording / screenshots / regression are reproducible.
     ================================================================ */
  var DEFAULT_SEED = 0x8A15C7;

  function readSeed() {
    try {
      var q = new URLSearchParams(location.search).get("seed");
      if (q !== null && q !== "") {
        var n = parseInt(q, 10);
        if (!isNaN(n)) return n >>> 0;
      }
    } catch (e) { /* file:// edge: fall through to the fixed default */ }
    return DEFAULT_SEED;
  }

  var SEED = readSeed();

  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFrom(tag) { return mulberry32((SEED ^ tag) >>> 0); }

  /* integer hash -> deterministic value noise (no ambient randomness) */
  function ihash(x, y, s) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function smoothstep(e0, e1, x) {
    var t = (x - e0) / (e1 - e0);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  }

  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = ihash(xi, yi, s), b = ihash(xi + 1, yi, s);
    var c = ihash(xi, yi + 1, s), d = ihash(xi + 1, yi + 1, s);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  /* 4-octave fbm — the variance source for haze and per-beam moonlight */
  function fbm(x, y, s) {
    var sum = 0, amp = 0.5, f = 1;
    for (var o = 0; o < 4; o++) { sum += amp * vnoise(x * f, y * f, s + o * 17); f *= 2; amp *= 0.5; }
    return sum;
  }

  /* 8x8 ordered Bayer matrix — the anti-banding threshold map (§10) */
  var BAYER8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
  ];
