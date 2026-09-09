'use strict';

  /* ========================== [SCENE] =============================
     Three layers on one canvas:
       L1 background  — ordered-dithered night gradient + full moon
                        + three-channel volumetric moonlight
       L2 subject     — per-node scene body
       L3 particles   — 桂花金粉 / 极寒霜气 / 曲调音纹
     ================================================================ */
  var YGScene = (function () {
    /* §6.1 palette as numeric triples — exact, not re-tuned */
    var C = {
      moonWhite: [238, 247, 242], robeWhite: [242, 240, 230], silver: [241, 240, 237],
      indigoDeep: [26, 58, 95], indigo: [42, 71, 95], mineralBlue: [46, 93, 140],
      osmanthus: [248, 196, 113], cinnabar: [237, 81, 38]
    };

    function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
    function mixc(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }

    var TAU = Math.PI * 2;

    /* moon anchor — deliberately off-centre (§6.6: no default centred symmetry) */
    var MU = 0.715, MV = 0.185, MR = 0.088;
    var GRAD_R = 1.18;
    var FIELD_DIV = 3;                 /* L1 field resolution divisor */

    /* §11.4 dynamic-range extension.
       The night palette's darkest colour 青黛 #1A3A5F has luminance 53.9, so
       without these two passes the frame never renders below ~52 or above
       ~242 and the used luminance span tops out near 190 levels.
       EXP raises the scene mean (so the vignette cannot reduce it, §10),
       and the vignette pushes the periphery down into the 0-54 band.
       Both are deterministic — no RNG anywhere in this path. */
    var EXP = 1.16;                    /* exposure, baked into L1 */
    var VIG_MID = 198;                 /* vignette mid ramp (grey = hue-neutral) */
    var VIG_EDGE = 92;                 /* vignette edge floor; non-zero => no pure black */

    var cv = null, ctx = null, W = 0, H = 0, dpr = 1;
    var field = null, fctx = null, fimg = null, FW = 0, FH = 0;
    var grain = null, grainPattern = null;
    var grainFill = null, grainFillPattern = null;

    var gold = [], frost = [], rings = [];
    var treeSeed = [];
    var clockOverride = null;

    /* visual state mirror — driven by the engine, never by logic of its own */
    var V = { warmth: 3, tune: 0, dance: 0, subject: "terrace", accent: "", progress: 0, lift: 0, target: 0 };

    /* presentation-layer subject map (NOT engine logic) */
    var SUBJECT = {
      start: "terrace", stay: "terrace",
      bridge: "bridge", lookback: "bridge",
      gate: "gate", force: "gate",
      court: "court", listen: "court", watch: "court", askname: "court",
      return: "descent", second: "second"
    };
    var SUBJECT_DEFAULT = "bridge";

    function subjectFor(nodeId) { return SUBJECT[nodeId] || SUBJECT_DEFAULT; }

    /* ======================= 工笔 assets =======================
       Elements are composed by the scene, never swapped for one
       generated backdrop, so each node carries its own subject.
       ================================================================ */
    var ASSET_DIR = "assets/img/";
    var ASSETS = {
      guizhi: null, guishu: null, yuelun: null, yinqiao: null, gongmen: null,
      bairen: null, suequn: null, bailuan: null, yunwen: null, denghuo: null
    };

    /* placement per presentation subject. u/v are centre anchors in viewport
       fractions; s is drawn edge length as a fraction of the shorter edge.
       The lower half belongs to the UI, so subjects sit in the upper frame. */
    var PLACEMENT = {
      terrace: [{ a: "guizhi", u: 0.26, v: 0.30, s: 0.68 }],
      bridge: [{ a: "yinqiao", u: 0.46, v: 0.34, s: 0.84 }],
      gate: [
        { a: "gongmen", u: 0.44, v: 0.30, s: 0.76 },
        { a: "bairen", u: 0.80, v: 0.46, s: 0.34 }
      ],
      court: [
        { a: "guishu", u: 0.32, v: 0.30, s: 0.74 },
        { a: "suequn", u: 0.66, v: 0.44, s: 0.38 },
        { a: "bailuan", u: 0.86, v: 0.26, s: 0.26 }
      ],
      descent: [{ a: "denghuo", u: 0.50, v: 0.42, s: 0.62 }],
      second: [{ a: "gongmen", u: 0.60, v: 0.44, s: 0.46 }],
      ending: [{ a: "yunwen", u: 0.46, v: 0.30, s: 0.76 }]
    };

    function loadAssets() {
      var names = Object.keys(ASSETS);
      for (var i = 0; i < names.length; i++) {
        var img = new Image();
        img.src = ASSET_DIR + names[i] + ".webp";
        ASSETS[names[i]] = img;
      }
    }

    function drawAsset(spec, tt) {
      var img = ASSETS[spec.a];
      if (!img || !img.complete || !img.naturalWidth) return false;
      var edge = Math.min(W, H);
      var size = edge * spec.s;
      /* a slow breath keeps the frame from reading as a static pasted image,
         driven by the same clock as the rest of the scene so a frozen clock
         still yields an identical frame */
      var breath = 1 + Math.sin(tt * 0.45) * 0.006;
      var w = size * breath, h = size * breath;
      var x = W * spec.u - w / 2, y = H * spec.v - h / 2;
      ctx.drawImage(img, x, y, w, h);
      return true;
    }

    function drawAssets(tt) {
      var list = PLACEMENT[V.subject] || PLACEMENT[SUBJECT_DEFAULT];
      for (var i = 0; i < list.length; i++) drawAsset(list[i], tt);
    }

    function assetsReady() {
      var names = Object.keys(ASSETS);
      for (var i = 0; i < names.length; i++) {
        var img = ASSETS[names[i]];
        if (img && img.complete && img.naturalWidth) return true;
      }
      return false;
    }

    /* ---------------- particle pools (seeded, built once) ---------------- */
    function buildParticles() {
      var g = rngFrom(0x9E37A1);
      gold = [];
      for (var i = 0; i < 90; i++) {
        gold.push({
          x: g(), y: g(), r: 0.7 + g() * 2.1, ph: g() * TAU,
          spd: 0.55 + g() * 1.5, drift: 0.5 + g() * 1.4, a: 0.28 + g() * 0.5
        });
      }
      var f = rngFrom(0xF2057C);
      frost = [];
      for (var j = 0; j < 130; j++) {
        frost.push({
          x: f(), y: f(), r: 0.6 + f() * 2.4, ph: f() * TAU,
          spd: 0.4 + f() * 1.3, drift: 0.4 + f() * 1.2, a: 0.22 + f() * 0.5,
          spoke: f() > 0.72
        });
      }
      var r = rngFrom(0x7A11E9);
      rings = [];
      for (var k = 0; k < 8; k++) {
        rings.push({ ph: r(), spd: 0.6 + r() * 0.9, w: 0.8 + r() * 1.1 });
      }
      var t = rngFrom(0x6B0BA6);
      treeSeed = [];
      for (var m = 0; m < 26; m++) treeSeed.push({ a: t(), l: 0.4 + t() * 0.7, w: t() });
    }

    /* §11.4 — frost proportion must RISE as warmth FALLS.
       Counts are lift-independent so the invariant holds at any warmth/lift/tune
       combination; lift instead modulates gold *alpha* in renderL3. */
    function goldCount() { return 46; }
    function frostCount() { return 14 + Math.round((YGEngine.limits.warmth - V.warmth) * 26); }
    function ringCount() { return V.tune * 3; }

    function particleStats() {
      var gn = goldCount(), fn = frostCount(), rn = ringCount();
      var tot = gn + fn + rn;
      return { gold: gn, frost: fn, tune: rn, total: tot, frostRatio: tot ? fn / tot : 0 };
    }

    /* ---------------- canvas plumbing ---------------- */
    function init(canvas) {
      cv = canvas;
      ctx = cv.getContext("2d");
      field = document.createElement("canvas");
      fctx = field.getContext("2d", { willReadFrequently: true });
      loadAssets();
      buildParticles();
      resize();
    }

    function resize() {
      if (!cv || !ctx) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(240, window.innerWidth);
      H = Math.max(320, window.innerHeight);
      cv.style.width = W + "px";
      cv.style.height = H + "px";
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;

      FW = Math.max(72, Math.min(232, Math.round(cv.width / FIELD_DIV)));
      FH = Math.max(72, Math.round(FW * H / W));
      field.width = FW;
      field.height = FH;
      fimg = fctx.createImageData(FW, FH);

      buildGrain();
    }

    /* full-resolution grain tile: breaks quantisation ties after upscale */
    function buildGrain() {
      var gs = 192;
      grain = document.createElement("canvas");
      grain.width = gs; grain.height = gs;
      var g = grain.getContext("2d");
      var im = g.createImageData(gs, gs);
      var d = im.data;
      var r = rngFrom(0x5EEDB0);
      for (var i = 0; i < gs * gs; i++) {
        var n = 128 + Math.round((r() - 0.5) * 26);
        var o = i * 4;
        d[o] = n; d[o + 1] = n; d[o + 2] = n; d[o + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      grainPattern = ctx.createPattern(grain, "repeat");

      /* unbiased wide-spread tile for the additive gap-filling pass */
      grainFill = document.createElement("canvas");
      grainFill.width = gs; grainFill.height = gs;
      var gf = grainFill.getContext("2d");
      var im2 = gf.createImageData(gs, gs);
      var d2 = im2.data;
      var r2 = rngFrom(0x3A71D4);
      for (var k = 0; k < gs * gs; k++) {
        var n2 = 128 + Math.round((r2() - 0.5) * 68);
        var o2 = k * 4;
        d2[o2] = n2; d2[o2 + 1] = n2; d2[o2 + 2] = n2; d2[o2 + 3] = 255;
      }
      gf.putImageData(im2, 0, 0);
      grainFillPattern = ctx.createPattern(grainFill, "repeat");
    }

    /* ---------------- scene silhouette occluder (channel 3) ---------------- */
    function occluderTransmit(u, v) {
      var s = V.subject;
      if (s === "gate") {
        var roof = 0.50;
        return v > roof ? 0.34 + 0.66 * Math.exp(-(v - roof) * 6.5) : 1;
      }
      if (s === "court") {
        var ddx = (u - 0.47) / 0.31, ddy = (v - 0.40) / 0.21;
        var dd = ddx * ddx + ddy * ddy;
        return dd < 1 ? 0.30 + 0.70 * dd : 1;
      }
      if (s === "bridge" || s === "descent") {
        var by = 0.62 - V.progress * 0.10;
        return v > by ? 0.46 + 0.54 * Math.exp(-(v - by) * 5.2) : 1;
      }
      if (s === "terrace") {
        return v > 0.78 ? 0.52 + 0.48 * Math.exp(-(v - 0.78) * 7.0) : 1;
      }
      return 1;
    }

    /* ======================= L1 — background =======================
       Ordered-dithered radial night gradient (黛青 -> 青黛) + full moon
       + three-channel volumetric moonlight. Computed per-pixel in a
       reduced field buffer, then bilinear-upscaled and grain-passed.
       ================================================================ */
    function renderL1(tt) {
      var d = fimg.data;
      var aspect = FW / FH;
      var liftGain = 0.90 + V.lift * 0.58;         /* 结尾即峰值: brighten, never darken */
      var cool = (YGEngine.limits.warmth - V.warmth) / YGEngine.limits.warmth;  /* 0..1 */
      var warm = V.warmth / YGEngine.limits.warmth;
      var cloudSeed = (SEED ^ 0xC10D) >>> 0;
      var beamSeed = (SEED ^ 0xBEA4) >>> 0;
      var tonalSeed = (SEED ^ 0x709A) >>> 0;

      for (var y = 0; y < FH; y++) {
        var v = (y + 0.5) / FH;
        var brow = BAYER8[y & 7];
        for (var x = 0; x < FW; x++) {
          var u = (x + 0.5) / FW;
          var dx = (u - MU) * aspect, dy = v - MV;
          var md = Math.sqrt(dx * dx + dy * dy);

          /* --- base night gradient: 青黛 at the far edge -> 黛青 near the moon --- */
          var gt = 1 - (md / GRAD_R); if (gt < 0) gt = 0; if (gt > 1) gt = 1;
          gt = gt * gt * (3 - 2 * gt);
          /* floor 0.72 keeps the darkest band a visible deep indigo (~20% lum,
             never black-key) while leaving headroom for the additive warmth
             shift + tonal/haze fields, so the used luminance span stays
             >= 200 contiguous levels at every warmth/lift combination */
          var depth = 0.72 + 0.28 * (1 - v);
          var r = (C.indigoDeep[0] + (C.indigo[0] - C.indigoDeep[0]) * gt) * depth;
          var g = (C.indigoDeep[1] + (C.indigo[1] - C.indigoDeep[1]) * gt) * depth;
          var b = (C.indigoDeep[2] + (C.indigo[2] - C.indigoDeep[2]) * gt) * depth;

          /* --- low-frequency tonal field: gives the base gradient continuous
             sub-step variation instead of a handful of quantised bands (§10) --- */
          var tonal = fbm(u * 1.9 - tt * 0.006, v * 1.4 + tt * 0.004, tonalSeed);
          var tshift = (tonal - 0.5) * 30 * depth;
          r += tshift * 0.42; g += tshift * 0.62; b += tshift * 0.92;

          /* --- 石青 mid-tone bloom around the moon --- */
          var mb = 1 - md / 1.00; if (mb < 0) mb = 0; mb = mb * mb;
          r += (C.mineralBlue[0] - r) * mb * 0.52;
          g += (C.mineralBlue[1] - g) * mb * 0.52;
          b += (C.mineralBlue[2] - b) * mb * 0.52;

          /* --- atmospheric haze: continuous field, kills residual banding --- */
          var cloud = fbm(u * 3.4 + tt * 0.013, v * 2.1 + tt * 0.007, cloudSeed);
          var haze = (cloud - 0.46) * 44 * (0.60 + V.lift * 0.34);
          r += haze * 0.50; g += haze * 0.78; b += haze * 1.00;

          /* --- three-channel volumetric moonlight ---
             CH1 occlusion: cloud haze carves the shafts
             CH2 per-beam variance: every shaft gets its own length/opacity
             CH3 attenuation: radial falloff x scene-silhouette transmit   */
          var open = 1 - smoothstep(0.34, 0.76, cloud);
          var ang = Math.atan2(dy, dx);
          var rayVar = 0.58 + 0.72 * fbm(ang * 4.2, tt * 0.020 * 3.2, beamSeed);
          var falloff = Math.exp(-md * 1.45);
          var disc = smoothstep(MR * 1.06, MR * 0.88, md);
          var halo = Math.exp(-(md * md) / (MR * MR * 5.5)) * 0.62;
          var occ = open * rayVar * falloff * (disc * 1.15 + halo + 0.075);
          occ *= occluderTransmit(u, v);
          occ *= liftGain;
          var la = occ > 1.1 ? 1.1 : occ;
          if (la > 0) {
            r += la * (C.moonWhite[0] - r) * 0.78;
            g += la * (C.moonWhite[1] - g) * 0.78;
            b += la * (C.moonWhite[2] - b) * 0.78;
          }

          /* --- warmth hue shift: ADDITIVE only, so luminance never drops --- */
          r += cool * 4 + warm * 7;
          g += cool * 9 + warm * 4;
          b += cool * 15 + warm * 1;

          /* --- exposure: raises the scene mean so the vignette cannot net
             reduce brightness (§10 结尾即峰值) --- */
          r *= EXP; g *= EXP; b *= EXP;

          /* --- ordered dither, widened: THE anti-banding measure (§10) --- */
          var dth = (brow[x & 7] / 64 - 0.5) * 4.8;
          r += dth; g += dth; b += dth;

          var o = (y * FW + x) * 4;
          d[o] = r < 0 ? 0 : (r > 255 ? 255 : r);
          d[o + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
          d[o + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
          d[o + 3] = 255;
        }
      }
      fctx.putImageData(fimg, 0, 0);
      ctx.drawImage(field, 0, 0, W, H);
    }

    /* crisp full-resolution moon: 月轮 with limb rim light, not a flat disc */
    function renderMoon(tt) {
      var mx = W * MU, my = H * MV, mr = H * MR;

      var halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * (5.2 + V.lift * 2.2));
      halo.addColorStop(0, rgba(C.moonWhite, 0.30 + V.lift * 0.14));
      halo.addColorStop(0.32, rgba(C.moonWhite, 0.11 + V.lift * 0.06));
      halo.addColorStop(1, rgba(C.moonWhite, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(mx, my, mr * (5.2 + V.lift * 2.2), 0, TAU); ctx.fill();

      var body = ctx.createRadialGradient(mx - mr * 0.26, my - mr * 0.24, mr * 0.08, mx, my, mr);
      body.addColorStop(0, "#FFFFFF");
      body.addColorStop(0.55, rgba(C.moonWhite, 1));
      body.addColorStop(0.92, rgba(C.silver, 1));
      body.addColorStop(1, rgba(C.mineralBlue, 0.55));
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();

      /* mare texture — seeded fbm, deterministic */
      ctx.save();
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.clip();
      var seedM = (SEED ^ 0xA001) >>> 0;
      for (var i = 0; i < 9; i++) {
        var nx = ihash(i, 3, seedM), ny = ihash(i, 11, seedM), nr = ihash(i, 29, seedM);
        var px = mx + (nx - 0.5) * mr * 1.5, py = my + (ny - 0.5) * mr * 1.5;
        var pr = mr * (0.10 + nr * 0.26);
        var mg = ctx.createRadialGradient(px, py, 0, px, py, pr);
        mg.addColorStop(0, rgba(C.mineralBlue, 0.16));
        mg.addColorStop(1, rgba(C.mineralBlue, 0));
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
      }
      ctx.restore();

      /* 月轮轮廓光 — rim light on the disc limb */
      ctx.strokeStyle = rgba(C.moonWhite, 0.85);
      ctx.lineWidth = Math.max(1, mr * 0.045);
      ctx.beginPath(); ctx.arc(mx, my, mr * 0.985, 0, TAU); ctx.stroke();
    }

    /* additive bloom — 结尾即峰值 express only via brightening (§10) */
    function renderBloom() {
      if (V.lift <= 0.01) return;
      var mx = W * MU, my = H * MV;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var bg = ctx.createRadialGradient(mx, my, 0, mx, my, H * 0.95);
      bg.addColorStop(0, rgba(C.moonWhite, 0.20 * V.lift));
      bg.addColorStop(0.42, rgba(C.moonWhite, 0.07 * V.lift));
      bg.addColorStop(1, rgba(C.moonWhite, 0));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      /* warm anchor wash at high warmth — additive, never a darkening pass */
      if (V.warmth >= 2) {
        var wg = ctx.createRadialGradient(W * 0.5, H * 0.62, 0, W * 0.5, H * 0.62, H * 0.7);
        wg.addColorStop(0, rgba(C.osmanthus, 0.045 * (V.warmth / 3) * (0.5 + V.lift)));
        wg.addColorStop(1, rgba(C.osmanthus, 0));
        ctx.fillStyle = wg;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }

    /* ======================= L2 — scene subject ======================= */

    function rr(g, x, y, w, h, r) {
      var k = Math.min(r, w / 2, h / 2);
      g.beginPath();
      g.moveTo(x + k, y);
      g.lineTo(x + w - k, y); g.quadraticCurveTo(x + w, y, x + w, y + k);
      g.lineTo(x + w, y + h - k); g.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
      g.lineTo(x + k, y + h); g.quadraticCurveTo(x, y + h, x, y + h - k);
      g.lineTo(x, y + k); g.quadraticCurveTo(x, y, x + k, y);
      g.closePath();
    }

    /* 银桥 — volumetric body + god rays + mist, vanishing segment by segment (§6.3) */
    var SEG_N = 14;

    function bridgePoint(t) {
      var x = W * (0.05 + 0.92 * t);
      var y = H * (0.735 - 0.425 * t) + Math.sin(t * Math.PI) * H * 0.022;
      var w = H * 0.046 * (1 - t * 0.56);
      return { x: x, y: y, w: w };
    }

    function drawBridge(tt) {
      var gone = V.progress * SEG_N;
      var mx = W * MU, my = H * MV;

      /* mist bands under the bridge — the 雾气光线 layer */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var m = 0; m < 5; m++) {
        var my2 = H * (0.70 + m * 0.035);
        var mg = ctx.createLinearGradient(0, my2 - H * 0.03, 0, my2 + H * 0.03);
        mg.addColorStop(0, rgba(C.moonWhite, 0));
        mg.addColorStop(0.5, rgba(C.moonWhite, 0.045 + 0.02 * Math.sin(tt * 0.35 + m)));
        mg.addColorStop(1, rgba(C.moonWhite, 0));
        ctx.fillStyle = mg;
        ctx.fillRect(0, my2 - H * 0.03, W, H * 0.06);
      }
      ctx.restore();

      /* god rays crossing the bridge — per-beam fbm variance, not a stamped radial */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var b = 0; b < 7; b++) {
        var a0 = -0.42 + b * 0.24;
        var rv = 0.30 + 1.25 * fbm(b * 1.9, tt * 0.06, (SEED ^ 0x50DA) >>> 0);
        var len = H * (0.55 + rv * 0.45);
        var ex = mx + Math.cos(a0 + 1.15) * len, ey = my + Math.sin(a0 + 1.15) * len;
        var wg = ctx.createLinearGradient(mx, my, ex, ey);
        wg.addColorStop(0, rgba(C.moonWhite, 0.13 * rv * (0.8 + V.lift * 0.5)));
        wg.addColorStop(0.55, rgba(C.moonWhite, 0.045 * rv));
        wg.addColorStop(1, rgba(C.moonWhite, 0));
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        var spread = 0.055 + rv * 0.035;
        ctx.lineTo(ex + Math.cos(a0 + 1.15 + Math.PI / 2) * len * spread,
          ey + Math.sin(a0 + 1.15 + Math.PI / 2) * len * spread);
        ctx.lineTo(ex - Math.cos(a0 + 1.15 + Math.PI / 2) * len * spread,
          ey - Math.sin(a0 + 1.15 + Math.PI / 2) * len * spread);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      /* bridge deck — segment by segment, 随步而灭 */
      for (var i = 0; i < SEG_N; i++) {
        var t0 = i / SEG_N, t1 = (i + 1) / SEG_N;
        var vanish = gone - i;                     /* >0 => this segment is behind us */
        var alpha;
        if (vanish >= 1) alpha = 0;
        else if (vanish > 0) alpha = (1 - vanish) * 0.92;
        else alpha = 0.92;
        if (alpha <= 0.004) {
          /* residual shimmer where the bridge already went — the memory of the path */
          var rp = bridgePoint((t0 + t1) / 2);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = rgba(C.silver, 0.05 * Math.max(0, 1 + vanish * 0.6));
          ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rp.w * 1.4, rp.w * 0.4, 0, 0, TAU); ctx.fill();
          ctx.restore();
          continue;
        }

        var p0 = bridgePoint(t0), p1 = bridgePoint(t1);
        var tilt = Math.atan2(p1.y - p0.y, p1.x - p0.x);

        /* volumetric under-glow so the deck reads as a light body, not a grey band */
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        var ug = ctx.createLinearGradient(p0.x, p0.y, p0.x, p0.y + H * 0.10);
        ug.addColorStop(0, rgba(C.moonWhite, 0.20 * alpha));
        ug.addColorStop(1, rgba(C.moonWhite, 0));
        ctx.fillStyle = ug;
        ctx.beginPath();
        ctx.ellipse((p0.x + p1.x) / 2, p0.y + H * 0.02, (p1.x - p0.x) * 0.9, H * 0.075, tilt, 0, TAU);
        ctx.fill();
        ctx.restore();

        /* deck plate */
        ctx.save();
        ctx.translate(p0.x, p0.y); ctx.rotate(tilt);
        var segLen = Math.sqrt((p1.x - p0.x) * (p1.x - p0.x) + (p1.y - p0.y) * (p1.y - p0.y));
        var pg = ctx.createLinearGradient(0, -p0.w * 0.5, 0, p0.w * 0.5);
        pg.addColorStop(0, rgba(C.moonWhite, alpha));
        pg.addColorStop(0.45, rgba(C.silver, alpha * 0.94));
        pg.addColorStop(1, rgba(C.mineralBlue, alpha * 0.42));
        ctx.fillStyle = pg;
        ctx.fillRect(0, -p0.w * 0.32, segLen + 1, p0.w * 0.64);
        /* top edge highlight — the rim that separates it from the dark */
        ctx.fillStyle = rgba(C.moonWhite, alpha * 0.95);
        ctx.fillRect(0, -p0.w * 0.32, segLen + 1, Math.max(1, p0.w * 0.10));
        ctx.restore();

        /* balustrade posts */
        ctx.strokeStyle = rgba(C.silver, alpha * 0.55);
        ctx.lineWidth = Math.max(1, p0.w * 0.055);
        var px = p0.x + (p1.x - p0.x) * 0.5, py = p0.y + (p1.y - p0.y) * 0.5;
        ctx.beginPath();
        ctx.moveTo(px, py - p0.w * 0.32);
        ctx.lineTo(px, py - p0.w * 0.32 - p0.w * 0.55);
        ctx.stroke();
      }
    }

    /* 广寒清虚之府 — 仰视 grandeur + 兵卫白刃粲然，望之如凝雪 */
    function drawGate(tt) {
      var cx = W * 0.5, baseY = H * 0.80, topY = H * 0.30;
      var hw = W * 0.30;

      /* backlight column behind the gate — separation from the dark */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var bg = ctx.createLinearGradient(cx, topY, cx, baseY);
      bg.addColorStop(0, rgba(C.moonWhite, 0.16 + V.lift * 0.08));
      bg.addColorStop(1, rgba(C.moonWhite, 0.02));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(cx - hw * 1.5, baseY);
      ctx.lineTo(cx - hw * 0.55, topY);
      ctx.lineTo(cx + hw * 0.55, topY);
      ctx.lineTo(cx + hw * 1.5, baseY);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      /* towers — converging upward for the 仰视 read */
      [-1, 1].forEach(function (s) {
        var tx = cx + s * hw;
        ctx.fillStyle = rgba(C.indigo, 0.94);
        ctx.beginPath();
        ctx.moveTo(tx - s * hw * 0.30, baseY);
        ctx.lineTo(tx - s * hw * 0.20, topY + H * 0.05);
        ctx.lineTo(tx + s * hw * 0.22, topY + H * 0.05);
        ctx.lineTo(tx + s * hw * 0.34, baseY);
        ctx.closePath(); ctx.fill();
        /* moon-facing rim light — the anti-mud lever on architecture */
        ctx.strokeStyle = rgba(C.moonWhite, 0.72);
        ctx.lineWidth = Math.max(1.2, W * 0.004);
        ctx.beginPath();
        ctx.moveTo(tx - s * hw * 0.20, topY + H * 0.05);
        ctx.lineTo(tx - s * hw * 0.30, baseY);
        ctx.stroke();
      });

      /* roof with upturned eaves */
      ctx.fillStyle = rgba(C.indigoDeep, 0.96);
      ctx.beginPath();
      ctx.moveTo(cx - hw * 1.28, topY + H * 0.055);
      ctx.quadraticCurveTo(cx, topY - H * 0.045, cx + hw * 1.28, topY + H * 0.055);
      ctx.quadraticCurveTo(cx, topY + H * 0.012, cx - hw * 1.28, topY + H * 0.055);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(C.silver, 0.60);
      ctx.lineWidth = Math.max(1, W * 0.003);
      ctx.beginPath();
      ctx.moveTo(cx - hw * 1.28, topY + H * 0.055);
      ctx.quadraticCurveTo(cx, topY - H * 0.045, cx + hw * 1.28, topY + H * 0.055);
      ctx.stroke();

      /* portal — low-key interior that still keeps detail */
      var pw = hw * 0.62, ph = H * 0.26, px = cx - pw / 2, py = baseY - ph;
      var ig = ctx.createLinearGradient(px, py, px, py + ph);
      ig.addColorStop(0, rgba(C.mineralBlue, 0.52));
      ig.addColorStop(1, rgba(C.indigoDeep, 0.86));
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.moveTo(px, py + ph);
      ctx.lineTo(px, py + pw * 0.32);
      ctx.quadraticCurveTo(cx, py - pw * 0.16, px + pw, py + pw * 0.32);
      ctx.lineTo(px + pw, py + ph);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(C.moonWhite, 0.55);
      ctx.lineWidth = Math.max(1, W * 0.003);
      ctx.stroke();

      /* blank plaque — rim-lit frame, no text drawn on canvas */
      rr(ctx, cx - hw * 0.34, topY + H * 0.075, hw * 0.68, H * 0.055, W * 0.006);
      ctx.fillStyle = rgba(C.indigoDeep, 0.92); ctx.fill();
      ctx.strokeStyle = rgba(C.silver, 0.58);
      ctx.lineWidth = Math.max(1, W * 0.0028); ctx.stroke();

      /* 兵卫白刃 — guards as silhouettes, blades catching moonlight */
      for (var i = 0; i < 3; i++) {
        var gx = cx + (i - 1) * hw * 0.34, gy = baseY;
        var gh = H * 0.115;
        ctx.fillStyle = rgba(C.indigoDeep, 0.92);
        ctx.beginPath();
        ctx.moveTo(gx - W * 0.018, gy);
        ctx.lineTo(gx - W * 0.011, gy - gh * 0.62);
        ctx.quadraticCurveTo(gx, gy - gh * 0.80, gx + W * 0.011, gy - gh * 0.62);
        ctx.lineTo(gx + W * 0.018, gy);
        ctx.closePath(); ctx.fill();
        /* rim light on the guard silhouette */
        ctx.strokeStyle = rgba(C.moonWhite, 0.66);
        ctx.lineWidth = Math.max(1, W * 0.0026);
        ctx.beginPath();
        ctx.moveTo(gx - W * 0.011, gy - gh * 0.62);
        ctx.quadraticCurveTo(gx, gy - gh * 0.80, gx + W * 0.011, gy - gh * 0.62);
        ctx.stroke();
        /* 白刃 — 望之如凝雪 */
        var sway = Math.sin(tt * 0.5 + i * 1.7) * W * 0.004;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        var bl = ctx.createLinearGradient(gx, gy - gh * 0.55, gx + sway, gy - gh * 1.35);
        bl.addColorStop(0, rgba(C.silver, 0.55));
        bl.addColorStop(0.7, rgba(C.moonWhite, 0.95));
        bl.addColorStop(1, rgba(C.moonWhite, 0.15));
        ctx.fillStyle = bl;
        ctx.beginPath();
        ctx.moveTo(gx - W * 0.004, gy - gh * 0.55);
        ctx.lineTo(gx + sway, gy - gh * 1.38);
        ctx.lineTo(gx + W * 0.004, gy - gh * 0.55);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    /* 广陵大桂树 — only branches sway (§6.5: never shake the whole tree) */
    function drawTree(tt) {
      var bx = W * 0.47, by = H * 0.63;
      var th = H * 0.30;

      ctx.strokeStyle = rgba(C.indigoDeep, 0.95);
      ctx.lineWidth = Math.max(2, W * 0.016);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx - W * 0.02, by - th * 0.55, bx + W * 0.012, by - th);
      ctx.stroke();
      /* trunk rim light */
      ctx.strokeStyle = rgba(C.moonWhite, 0.42);
      ctx.lineWidth = Math.max(1, W * 0.0035);
      ctx.beginPath();
      ctx.moveTo(bx - W * 0.006, by);
      ctx.quadraticCurveTo(bx - W * 0.026, by - th * 0.55, bx + W * 0.006, by - th);
      ctx.stroke();

      for (var i = 0; i < treeSeed.length; i++) {
        var sd = treeSeed[i];
        var startY = by - th * (0.32 + sd.a * 0.66);
        var dir = i % 2 === 0 ? -1 : 1;
        var len = th * 0.30 * sd.l;
        var sway = Math.sin(tt * 0.6 + i * 0.9) * W * 0.006 * sd.w;   /* branch tips only */
        var ex = bx + dir * len * 0.9 + sway, ey = startY - len * 0.42;
        ctx.strokeStyle = rgba(C.indigoDeep, 0.82);
        ctx.lineWidth = Math.max(1, W * 0.005 * sd.l);
        ctx.beginPath();
        ctx.moveTo(bx + W * 0.008, startY);
        ctx.quadraticCurveTo(bx + dir * len * 0.5, startY - len * 0.1, ex, ey);
        ctx.stroke();
        /* canopy leaf cluster — rim-lit against the dark */
        var cg = ctx.createRadialGradient(ex, ey, 0, ex, ey, len * 0.52);
        cg.addColorStop(0, rgba(C.moonWhite, 0.20));
        cg.addColorStop(0.55, rgba(C.mineralBlue, 0.22));
        cg.addColorStop(1, rgba(C.mineralBlue, 0));
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(ex, ey, len * 0.52, 0, TAU); ctx.fill();
      }
    }

    /* 素娥皓衣乘白鸾 — rim light + backlight is the #1 anti-mud lever (§6.5) */
    function drawSuE(g, x, y, s, ph, tt) {
      var bob = Math.sin(tt * 0.7 + ph) * s * 0.05;   /* stays near its anchor (§6.5) */
      y += bob;

      /* 1. backlight halo — separates the white robe from the dark ground */
      var halo = g.createRadialGradient(x, y - s * 0.15, s * 0.06, x, y - s * 0.15, s * 1.65);
      halo.addColorStop(0, rgba(C.moonWhite, 0.34 + V.lift * 0.12));
      halo.addColorStop(0.48, rgba(C.moonWhite, 0.11));
      halo.addColorStop(1, rgba(C.moonWhite, 0));
      g.fillStyle = halo;
      g.beginPath(); g.arc(x, y - s * 0.15, s * 1.65, 0, TAU); g.fill();

      /* 2. 白鸾 mount — silhouette then rim */
      g.fillStyle = rgba(C.indigoDeep, 0.90);
      g.beginPath();
      g.moveTo(x - s * 0.62, y + s * 0.30);
      g.quadraticCurveTo(x, y + s * 0.62, x + s * 0.66, y + s * 0.24);
      g.quadraticCurveTo(x + s * 0.30, y + s * 0.16, x - s * 0.62, y + s * 0.30);
      g.closePath(); g.fill();
      g.strokeStyle = rgba(C.moonWhite, 0.78);
      g.lineWidth = Math.max(1, s * 0.045);
      g.beginPath();
      g.moveTo(x - s * 0.62, y + s * 0.30);
      g.quadraticCurveTo(x, y + s * 0.62, x + s * 0.66, y + s * 0.24);
      g.stroke();
      /* wing — tapered, rim-lit */
      g.fillStyle = rgba(C.silver, 0.55);
      g.beginPath();
      g.moveTo(x + s * 0.10, y + s * 0.22);
      g.quadraticCurveTo(x + s * 0.85, y - s * 0.10 + Math.sin(tt * 1.1 + ph) * s * 0.08, x + s * 0.95, y + s * 0.34);
      g.quadraticCurveTo(x + s * 0.55, y + s * 0.30, x + s * 0.10, y + s * 0.22);
      g.closePath(); g.fill();

      /* 3. robe body — 素衣 */
      var robe = g.createLinearGradient(x, y - s * 0.9, x, y + s * 0.35);
      robe.addColorStop(0, rgba(C.robeWhite, 0.96));
      robe.addColorStop(0.62, rgba(C.robeWhite, 0.80));
      robe.addColorStop(1, rgba(C.mineralBlue, 0.55));
      g.fillStyle = robe;
      g.beginPath();
      g.moveTo(x, y - s * 0.92);
      g.quadraticCurveTo(x + s * 0.34, y - s * 0.52, x + s * 0.40, y + s * 0.26);
      g.quadraticCurveTo(x, y + s * 0.44, x - s * 0.40, y + s * 0.26);
      g.quadraticCurveTo(x - s * 0.34, y - s * 0.52, x, y - s * 0.92);
      g.closePath(); g.fill();

      /* 4. RIM LIGHT — moon-facing contour, the decisive separation stroke */
      g.strokeStyle = rgba(C.moonWhite, 0.97);
      g.lineWidth = Math.max(1.2, s * 0.058);
      g.beginPath();
      g.moveTo(x, y - s * 0.92);
      g.quadraticCurveTo(x - s * 0.34, y - s * 0.52, x - s * 0.40, y + s * 0.26);
      g.stroke();
      g.strokeStyle = rgba(C.moonWhite, 0.62);
      g.lineWidth = Math.max(1, s * 0.036);
      g.beginPath();
      g.moveTo(x, y - s * 0.92);
      g.quadraticCurveTo(x + s * 0.34, y - s * 0.52, x + s * 0.40, y + s * 0.26);
      g.stroke();

      /* 5. head + sleeve ribbons, both rim-lit */
      g.fillStyle = rgba(C.robeWhite, 0.95);
      g.beginPath(); g.arc(x, y - s * 0.98, s * 0.16, 0, TAU); g.fill();
      g.strokeStyle = rgba(C.moonWhite, 0.9);
      g.lineWidth = Math.max(1, s * 0.032);
      g.beginPath(); g.arc(x, y - s * 0.98, s * 0.16, Math.PI * 0.9, Math.PI * 1.9); g.stroke();

      g.strokeStyle = rgba(C.robeWhite, 0.42);
      g.lineWidth = Math.max(1, s * 0.05);
      var rib = Math.sin(tt * 0.9 + ph) * s * 0.16;
      g.beginPath();
      g.moveTo(x - s * 0.30, y - s * 0.44);
      g.quadraticCurveTo(x - s * 0.80, y - s * 0.30 + rib, x - s * 1.05, y - s * 0.02 + rib);
      g.stroke();
    }

    /* 广庭 · 素娥十余人舞于广陵大桂树之下 (远景, 平视) */
    function drawCourt(tt) {
      /* terrace floor — atmospheric depth, low-key not black-key */
      var fg = ctx.createLinearGradient(0, H * 0.63, 0, H);
      fg.addColorStop(0, rgba(C.mineralBlue, 0.34));
      fg.addColorStop(0.55, rgba(C.indigo, 0.55));
      fg.addColorStop(1, rgba(C.indigoDeep, 0.72));
      ctx.fillStyle = fg;
      ctx.fillRect(0, H * 0.63, W, H * 0.37);
      ctx.strokeStyle = rgba(C.moonWhite, 0.26);
      ctx.lineWidth = Math.max(1, W * 0.0025);
      for (var i = 0; i < 6; i++) {
        var ly = H * (0.66 + i * 0.055);
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.bezierCurveTo(W * 0.3, ly + 3, W * 0.7, ly - 3, W, ly);
        ctx.stroke();
      }

      drawTree(tt);

      /* 素娥 — kept near the anchor centre (§6.5: no long-distance travel) */
      var anchors = [
        { x: 0.30, y: 0.55, s: 0.062 }, { x: 0.47, y: 0.50, s: 0.078 },
        { x: 0.64, y: 0.55, s: 0.064 }, { x: 0.38, y: 0.62, s: 0.052 },
        { x: 0.58, y: 0.62, s: 0.054 }
      ];
      for (var k = 0; k < anchors.length; k++) {
        var a = anchors[k];
        drawSuE(ctx, W * a.x, H * a.y, H * a.s, k * 1.3, tt);
      }
    }

    /* 人间 · 宫中玩月 terrace */
    function drawTerrace(tt) {
      var hy = H * 0.74;
      var fg = ctx.createLinearGradient(0, hy, 0, H);
      fg.addColorStop(0, rgba(C.indigo, 0.60));
      fg.addColorStop(1, rgba(C.indigoDeep, 0.80));
      ctx.fillStyle = fg;
      ctx.fillRect(0, hy, W, H - hy);

      /* distant palace roofline */
      ctx.fillStyle = rgba(C.indigoDeep, 0.92);
      ctx.beginPath();
      ctx.moveTo(0, hy);
      ctx.lineTo(W * 0.10, hy - H * 0.055);
      ctx.quadraticCurveTo(W * 0.24, hy - H * 0.10, W * 0.38, hy - H * 0.045);
      ctx.lineTo(W * 0.38, hy);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(C.moonWhite, 0.55);
      ctx.lineWidth = Math.max(1, W * 0.003);
      ctx.beginPath();
      ctx.moveTo(W * 0.10, hy - H * 0.055);
      ctx.quadraticCurveTo(W * 0.24, hy - H * 0.10, W * 0.38, hy - H * 0.045);
      ctx.stroke();

      /* balustrade — moon-caught rail */
      ctx.strokeStyle = rgba(C.silver, 0.44);
      ctx.lineWidth = Math.max(1, W * 0.0035);
      ctx.beginPath(); ctx.moveTo(0, hy + H * 0.035); ctx.lineTo(W, hy + H * 0.035); ctx.stroke();
      for (var i = 0; i < 9; i++) {
        var px = W * (0.06 + i * 0.11);
        ctx.beginPath();
        ctx.moveTo(px, hy + H * 0.035);
        ctx.lineTo(px, hy + H * 0.115);
        ctx.stroke();
      }

      /* moon reflection on the terrace stone — the single warm-ish anchor stays gold */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var rx = W * MU, ry = hy + H * 0.10;
      var rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, W * 0.30);
      rg.addColorStop(0, rgba(C.moonWhite, 0.16));
      rg.addColorStop(1, rgba(C.moonWhite, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.ellipse(rx, ry, W * 0.30, H * 0.055, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }

    /* 归途 · 三人下若旋风 */
    function drawDescent(tt) {
      drawBridge(tt);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var cx = W * 0.5, cy = H * 0.52;
      for (var i = 0; i < 9; i++) {
        var p = ((tt * 0.22 + i * 0.111) % 1);
        var rad = H * (0.06 + p * 0.40);
        var a = (1 - p) * 0.24;
        ctx.strokeStyle = rgba(C.moonWhite, a);
        ctx.lineWidth = Math.max(1, W * 0.0028 * (1 - p));
        ctx.beginPath();
        ctx.arc(cx, cy, rad, tt * 0.5 + i, tt * 0.5 + i + Math.PI * 1.15);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 次夜 · 天师笑谢不允 — a second, withheld moon */
    function drawSecond(tt) {
      var sx = W * 0.24, sy = H * 0.30, sr = H * 0.045;
      var halo = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 4.2);
      halo.addColorStop(0, rgba(C.moonWhite, 0.18));
      halo.addColorStop(1, rgba(C.moonWhite, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(sx, sy, sr * 4.2, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(C.silver, 0.72);
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(C.moonWhite, 0.8);
      ctx.lineWidth = Math.max(1, sr * 0.06);
      ctx.beginPath(); ctx.arc(sx, sy, sr * 0.98, 0, TAU); ctx.stroke();

      /* distant shut gate */
      ctx.save();
      ctx.globalAlpha = 0.55;
      var cx = W * 0.66, baseY = H * 0.70, hw = W * 0.16;
      ctx.fillStyle = rgba(C.indigoDeep, 0.95);
      ctx.beginPath();
      ctx.moveTo(cx - hw, baseY);
      ctx.lineTo(cx - hw * 0.8, baseY - H * 0.20);
      ctx.lineTo(cx + hw * 0.8, baseY - H * 0.20);
      ctx.lineTo(cx + hw, baseY);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(C.moonWhite, 0.5);
      ctx.lineWidth = Math.max(1, W * 0.003);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - hw * 1.15, baseY - H * 0.20);
      ctx.quadraticCurveTo(cx, baseY - H * 0.27, cx + hw * 1.15, baseY - H * 0.20);
      ctx.stroke();
      ctx.restore();

      /* cold floor */
      var fg = ctx.createLinearGradient(0, H * 0.70, 0, H);
      fg.addColorStop(0, rgba(C.indigo, 0.45));
      fg.addColorStop(1, rgba(C.indigoDeep, 0.68));
      ctx.fillStyle = fg;
      ctx.fillRect(0, H * 0.70, W, H * 0.30);
    }

    /* ending subject — peak frame: motifs present, scene brightened */
    function drawEnding(tt) {
      var s = V.subjectEnding || "court";
      if (s === "court") drawCourt(tt);
      else if (s === "gate") drawGate(tt);
      else if (s === "bridge" || s === "descent") drawDescent(tt);
      else drawTerrace(tt);
      /* full-bridge memory: every segment gone, only shimmer left */
      if (s === "bridge" || s === "descent") {
        var keep = V.progress; V.progress = 1; drawBridge(tt); V.progress = keep;
      }
    }

    function drawFloor() {
      var fg = ctx.createLinearGradient(0, H * 0.68, 0, H);
      fg.addColorStop(0, rgba(C.indigo, 0.34));
      fg.addColorStop(0.6, rgba(C.indigo, 0.52));
      fg.addColorStop(1, rgba(C.indigoDeep, 0.70));
      ctx.fillStyle = fg;
      ctx.fillRect(0, H * 0.68, W, H * 0.32);
    }

    function renderL2(tt) {
      var s = V.subject;
      if (assetsReady()) {
        drawFloor();
        drawAssets(tt);
        return;
      }
      if (s === "bridge") drawBridge(tt);
      else if (s === "gate") drawGate(tt);
      else if (s === "court") drawCourt(tt);
      else if (s === "terrace") drawTerrace(tt);
      else if (s === "descent") drawDescent(tt);
      else if (s === "second") drawSecond(tt);
      else if (s === "ending") drawEnding(tt);
      else drawBridge(tt);
    }

    /* ======================= L3 — particles =======================
       桂花金粉 (缃绮) / 极寒霜气 / 曲调音纹. Frost density is the
       warmth signal — the scene is never globally darkened instead.
       ================================================================ */
    function renderL3(tt) {
      var cool = (YGEngine.limits.warmth - V.warmth) / YGEngine.limits.warmth;
      var frostCol = mixc(C.moonWhite, C.mineralBlue, 0.18 + cool * 0.42);
      var goldCol = mixc(C.osmanthus, C.silver, cool * 0.34);

      /* 曲调音纹 — expanding rings, count driven by 记曲 */
      var rn = ringCount();
      if (rn > 0) {
        var rcx = W * 0.47, rcy = H * 0.52;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (var q = 0; q < rn; q++) {
          var rp = rings[q % rings.length];
          var p = ((tt * 0.16 * rp.spd + rp.ph) % 1);
          var rad = H * (0.04 + p * 0.44);
          ctx.strokeStyle = rgba(C.moonWhite, (1 - p) * 0.30);
          ctx.lineWidth = rp.w;
          ctx.beginPath(); ctx.arc(rcx, rcy, rad, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }

      /* 桂花金粉 */
      var gn = goldCount();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < gn && i < gold.length; i++) {
        var gp = gold[i];
        var gy = (((gp.y - tt * 0.016 * gp.spd) % 1) + 1) % 1;
        var gx = (gp.x + Math.sin(tt * 0.30 * gp.drift + gp.ph) * 0.028) * W;
        var yy = gy * H;
        var al = gp.a * (0.55 + 0.45 * Math.sin(tt * 0.85 + gp.ph)) * (0.8 + V.lift * 0.4);
        if (al <= 0.01) continue;
        var gr = gp.r * (1 + V.lift * 0.3);
        var gg = ctx.createRadialGradient(gx, yy, 0, gx, yy, gr * 4);
        gg.addColorStop(0, rgba(goldCol, al));
        gg.addColorStop(0.4, rgba(goldCol, al * 0.35));
        gg.addColorStop(1, rgba(goldCol, 0));
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(gx, yy, gr * 4, 0, TAU); ctx.fill();
      }
      ctx.restore();

      /* 极寒霜气 — density rises as warmth falls */
      var fn = frostCount();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var j = 0; j < fn && j < frost.length; j++) {
        var fp = frost[j];
        var fy = (((fp.y + tt * 0.021 * fp.spd) % 1) + 1) % 1;
        var fx = (fp.x + Math.sin(tt * 0.22 * fp.drift + fp.ph) * 0.035) * W;
        var yy2 = fy * H;
        var al2 = fp.a * (0.6 + 0.4 * Math.sin(tt * 0.6 + fp.ph));
        if (al2 <= 0.01) continue;
        var fr = fp.r * (1 + V.lift * 0.25);
        ctx.fillStyle = rgba(frostCol, al2 * 0.85);
        ctx.beginPath(); ctx.arc(fx, yy2, fr, 0, TAU); ctx.fill();
        if (fp.spoke) {
          ctx.strokeStyle = rgba(frostCol, al2 * 0.5);
          ctx.lineWidth = 0.8;
          var sl = fr * 3.4;
          for (var sp = 0; sp < 4; sp++) {
            var ang = sp * Math.PI / 4 + fp.ph;
            ctx.beginPath();
            ctx.moveTo(fx - Math.cos(ang) * sl, yy2 - Math.sin(ang) * sl);
            ctx.lineTo(fx + Math.cos(ang) * sl, yy2 + Math.sin(ang) * sl);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    /* ===================== vignette (spatial depth) =====================
       §11.4 dynamic-range extension. The night palette bottoms out at
       青黛 #1A3A5F (luminance 53.9), so nothing ever lands in the 0-54 band
       and the used luminance span stalls near 190 levels. This peripheral
       darkening fills that band.
       - Deterministic by construction: no RNG, pure geometry (§7).
       - Hue-neutral: a neutral grey multiply only SCALES the indigo, it never
         shifts it, so §6.1 palette compliance is preserved.
       - Luminance-neutral in the scene centre (factor exactly 1 there).
       - Floor is deliberately non-zero (VIG_EDGE), so pure-black pixels stay
         at 0 and the "< 1% pure black" guard holds.
       - This is a DEPTH cue, not a warmth expression, so §10 is not implicated.
       Applied before drawSeal so the 朱砂 seal keeps full cinnabar strength. */
    function renderVignette() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var cx = cv.width * 0.50, cy = cv.height * 0.45;
      var rOuter = Math.sqrt(cv.width * cv.width + cv.height * cv.height) * 0.52;
      var g = ctx.createRadialGradient(cx, cy, rOuter * 0.30, cx, cy, rOuter);
      var mid = "rgb(" + VIG_MID + "," + VIG_MID + "," + VIG_MID + ")";
      var edge = "rgb(" + VIG_EDGE + "," + VIG_EDGE + "," + VIG_EDGE + ")";
      g.addColorStop(0, "rgb(255,255,255)");
      g.addColorStop(0.50, "rgb(255,255,255)");
      g.addColorStop(0.76, mid);
      g.addColorStop(1, edge);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.restore();
    }

    /* ===================== 朱砂印章 (always visible) ===================== */
    function drawSeal(label) {
      var s = Math.min(W, H) * 0.132;
      var cx = W - s * 0.72, cy = H - s * 0.72;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-5 * Math.PI / 180);

      /* cinnabar plate — the only 朱红 surface in the whole frame */
      rr(ctx, -s / 2, -s / 2, s, s, s * 0.10);
      ctx.fillStyle = "#ED5126";
      ctx.fill();
      /* inner frame */
      ctx.strokeStyle = rgba(C.moonWhite, 0.94);
      ctx.lineWidth = Math.max(1.2, s * 0.045);
      rr(ctx, -s * 0.40, -s * 0.40, s * 0.80, s * 0.80, s * 0.05);
      ctx.stroke();

      /* seal text — vertical, ending name on ending frames */
      ctx.fillStyle = rgba(C.moonWhite, 0.98);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var chars = String(label || "").slice(0, 4).split("");
      var fs = chars.length <= 2 ? s * 0.34 : (chars.length === 3 ? s * 0.27 : s * 0.235);
      ctx.font = "600 " + fs.toFixed(1) + "px " + '"Songti SC","STSong","SimSun",serif';
      var n = chars.length;
      var startY = -(n - 1) * fs * 0.62;
      for (var i = 0; i < n; i++) ctx.fillText(chars[i], 0, startY + i * fs * 1.24);

      ctx.restore();
      ctx.textBaseline = "alphabetic";
    }

    /* ========================= frame composite ========================= */
    function syncFromEngine() {
      var st = YGEngine.state();
      V.warmth = st.warmth; V.tune = st.tune; V.dance = st.dance;
      V.progress = YGEngine.progress();
      if (YGEngine.isEnding(st.nodeId)) {
        /* peak frame keeps the last walked motif, so the ending is a summit not a blackout */
        V.subjectEnding = V.lastWalkedSubject || "court";
        V.subject = "ending";
        V.target = 1;
      } else {
        V.subject = subjectFor(st.nodeId);
        V.lastWalkedSubject = V.subject;
        V.target = 0;
      }
    }

    function draw(nowMs) {
      if (!ctx) return;
      var tt = (clockOverride !== null ? clockOverride : nowMs) / 1000;
      /* §7 — a frozen clock must yield a byte-identical frame, so the lift
         easing snaps instead of creeping while the clock is held */
      if (clockOverride !== null) V.lift = V.target;
      else V.lift += (V.target - V.lift) * Math.min(1, (1 / 60) * 2.4);

      syncFromEngine();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      renderL1(tt);           /* L1 background */
      renderMoon(tt);
      renderL2(tt);           /* L2 scene subject */
      renderBloom();
      renderL3(tt);           /* L3 particles */
      renderVignette();       /* peripheral depth darkening (§11.4 range) */

      /* full-resolution grain pass — device pixels, symmetric modulation.
         `overlay` alone is multiplicative, so it re-quantises the very bands it
         is meant to break; the second source-over pass adds an unbiased ±spread
         on top of every base value, which is what actually fills the gaps.
         The 月轮 disc is punched out with an evenodd path: §6.2 requires the
         moon to stay CRISP at full resolution, and grain over it would both
         muddy the disc and cap its peak below true white. */
      if (grainPattern) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        ctx.rect(0, 0, cv.width, cv.height);
        ctx.arc(cv.width * MU, cv.height * MV, cv.height * MR * 1.04, 0, TAU);
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = grainPattern;
        ctx.fill("evenodd");
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = grainFillPattern;
        ctx.fill("evenodd");
        ctx.restore();
      }

      /* seal sits above every layer and is always visible (§10) */
      var ending = YGEngine.currentEnding();
      drawSeal(ending && ending.name ? ending.name : "月宫一夜");
    }

    function setClock(ms) { clockOverride = (typeof ms === "number") ? ms : null; }

    return {
      init: init, resize: resize, draw: draw, setClock: setClock,
      particles: particleStats,
      subject: function () { return V.subject; },
      lift: function () { return V.lift; }
    };
  })();
