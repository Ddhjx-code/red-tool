/* ============================================================
   漆扇 · 漂漆 WebGL 流体引擎 (window.QSEngine)
   Classic stable-fluids (Navier-Stokes) GPU solver:
   velocity field + dye field, advection / divergence /
   pressure (Jacobi) / gradient-subtract / vorticity confinement.
   Architecture after PavelDoGreat WebGL-Fluid-Simulation (MIT),
   display shader customised for lacquer-on-water marbling.
   DYE RENDERING only — no DOM capture / drawElementImage.

   视觉参数由原型验证锁定（DENSITY_DISSIPATION 0.04 / chroma-aware
   brightness / saturation-preserving），不得回退。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- config（原型验证值，锁定） ---------- */
  var config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 760,
    DENSITY_DISSIPATION: 0.04,     // lacquer does NOT dissolve — film persists on water
    VELOCITY_DISSIPATION: 0.34,    // flow settles after stirring
    PRESSURE: 0.8,
    PRESSURE_ITERATIONS: 20,
    CURL: 30,                      // vorticity -> swirling filaments
    SPLAT_RADIUS: 0.24,
    SPLAT_FORCE: 5200,             // 拉纹 drag force
    TAP_FORCE: 1400,               // 滴漆 drop radial force (gentle bloom, not over-spread)
    COLOR_INTENSITY: 1.25,
    CAPTURE_WIDTH: 340             // dye capture resolution (width; height follows aspect)
  };

  /* ---------- seeded rng（确定性：demo / 录制可复现） ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var canvas = null, gl = null, ext = null;
  var dye = null, velocity = null, divergenceFBO = null, curlFBO = null, pressure = null;
  var captureFBO = null, captureW = 0, captureH = 0, captureBuf = null;
  var rng = mulberry32(20260902);
  var time = 0;
  var programs = {};
  var blitFn = null;
  var ready = false;

  /* ---------- GL context ---------- */
  function supportRenderTextureFormat(g, internalFormat, format, type) {
    var tex = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texImage2D(g.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
    var fbo = g.createFramebuffer();
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    var ok = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.deleteFramebuffer(fbo); g.deleteTexture(tex);
    return ok;
  }

  function getSupportedFormat(g, internalFormat, format, type) {
    if (!supportRenderTextureFormat(g, internalFormat, format, type)) {
      if (internalFormat === g.R16F) return getSupportedFormat(g, g.RG16F, g.RG, type);
      if (internalFormat === g.RG16F) return getSupportedFormat(g, g.RGBA16F, g.RGBA, type);
      return null;
    }
    return { internalFormat: internalFormat, format: format };
  }

  function getWebGLContext(c) {
    var params = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: true };
    var g = c.getContext('webgl2', params);
    var isWebGL2 = !!g;
    if (!isWebGL2) g = c.getContext('webgl', params) || c.getContext('experimental-webgl', params);
    if (!g) return null;

    var halfFloat, supportLinearFiltering;
    if (isWebGL2) {
      g.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = g.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = g.getExtension('OES_texture_half_float');
      supportLinearFiltering = g.getExtension('OES_texture_half_float_linear');
    }
    g.clearColor(0.0, 0.0, 0.0, 1.0);

    var halfFloatTexType = isWebGL2 ? g.HALF_FLOAT : (halfFloat ? halfFloat.HALF_FLOAT_OES : g.UNSIGNED_BYTE);
    var formatRGBA, formatRG, formatR;
    if (isWebGL2) {
      formatRGBA = getSupportedFormat(g, g.RGBA16F, g.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(g, g.RG16F, g.RG, halfFloatTexType);
      formatR = getSupportedFormat(g, g.R16F, g.RED, halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(g, g.RGBA, g.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(g, g.RGBA, g.RGBA, halfFloatTexType);
      formatR = getSupportedFormat(g, g.RGBA, g.RGBA, halfFloatTexType);
    }
    return {
      gl: g, isWebGL2: isWebGL2,
      ext: {
        formatRGBA: formatRGBA, formatRG: formatRG, formatR: formatR,
        halfFloatTexType: halfFloatTexType, supportLinearFiltering: !!supportLinearFiltering
      }
    };
  }

  /* ---------- shaders ---------- */
  function addKeywords(source, keywords) {
    if (!keywords) return source;
    var prefix = '';
    for (var i = 0; i < keywords.length; i++) prefix += '#define ' + keywords[i] + '\n';
    return prefix + source;
  }
  function compileShader(type, source, keywords) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, addKeywords(source, keywords));
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error('shader:', gl.getShaderInfoLog(shader), source);
    return shader;
  }
  function createProgram(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error('link:', gl.getProgramInfoLog(p));
    return p;
  }
  function getUniforms(p) {
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return u;
  }
  function Program(vs, fs, keywords) {
    this.program = createProgram(vs, compileShader(gl.FRAGMENT_SHADER, fs, keywords));
    this.uniforms = getUniforms(this.program);
  }
  Program.prototype.bind = function () { gl.useProgram(this.program); };

  var baseVertexSrc = [
    'precision highp float;',
    'attribute vec2 aPosition;',
    'varying vec2 vUv;',
    'varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform vec2 texelSize;',
    'void main () {',
    '  vUv = aPosition * 0.5 + 0.5;',
    '  vL = vUv - vec2(texelSize.x, 0.0);',
    '  vR = vUv + vec2(texelSize.x, 0.0);',
    '  vT = vUv + vec2(0.0, texelSize.y);',
    '  vB = vUv - vec2(0.0, texelSize.y);',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}'
  ].join('\n');

  var clearFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv;',
    'uniform sampler2D uTexture; uniform float value;',
    'void main () { gl_FragColor = value * texture2D(uTexture, vUv); }'
  ].join('\n');

  var splatFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv;',
    'uniform sampler2D uTarget;',
    'uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;',
    'void main () {',
    '  vec2 p = vUv - point.xy;',
    '  p.x *= aspectRatio;',
    '  vec3 splat = exp(-dot(p, p) / radius) * color;',
    '  vec3 base = texture2D(uTarget, vUv).xyz;',
    '  gl_FragColor = vec4(base + splat, 1.0);',
    '}'
  ].join('\n');

  var advectionFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv;',
    'uniform sampler2D uVelocity; uniform sampler2D uSource;',
    'uniform vec2 texelSize; uniform vec2 dyeTexelSize;',
    'uniform float dt; uniform float dissipation;',
    'vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {',
    '  vec2 st = uv / tsize - 0.5;',
    '  vec2 iuv = floor(st); vec2 fuv = fract(st);',
    '  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);',
    '  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);',
    '  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);',
    '  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);',
    '  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);',
    '}',
    'void main () {',
    '#ifdef MANUAL_FILTERING',
    '  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;',
    '  vec4 result = bilerp(uSource, coord, dyeTexelSize);',
    '#else',
    '  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;',
    '  vec4 result = texture2D(uSource, coord);',
    '#endif',
    '  float decay = 1.0 + dissipation * dt;',
    '  gl_FragColor = result / decay;',
    '}'
  ].join('\n');

  var divergenceFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;',
    'uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uVelocity, vL).x;',
    '  float R = texture2D(uVelocity, vR).x;',
    '  float T = texture2D(uVelocity, vT).y;',
    '  float B = texture2D(uVelocity, vB).y;',
    '  vec2 C = texture2D(uVelocity, vUv).xy;',
    '  if (vL.x < 0.0) { L = -C.x; }',
    '  if (vR.x > 1.0) { R = -C.x; }',
    '  if (vT.y > 1.0) { T = -C.y; }',
    '  if (vB.y < 0.0) { B = -C.y; }',
    '  float div = 0.5 * (R - L + T - B);',
    '  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var curlFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;',
    'uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uVelocity, vL).y;',
    '  float R = texture2D(uVelocity, vR).y;',
    '  float T = texture2D(uVelocity, vT).x;',
    '  float B = texture2D(uVelocity, vB).x;',
    '  float vorticity = R - L - T + B;',
    '  gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var vorticityFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform sampler2D uVelocity; uniform sampler2D uCurl;',
    'uniform float curl; uniform float dt;',
    'void main () {',
    '  float L = texture2D(uCurl, vL).x;',
    '  float R = texture2D(uCurl, vR).x;',
    '  float T = texture2D(uCurl, vT).x;',
    '  float B = texture2D(uCurl, vB).x;',
    '  float C = texture2D(uCurl, vUv).x;',
    '  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));',
    '  force /= length(force) + 0.0001;',
    '  force *= curl * C;',
    '  force.y *= -1.0;',
    '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
    '  velocity += force * dt;',
    '  velocity = min(max(velocity, -1000.0), 1000.0);',
    '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
    '}'
  ].join('\n');

  var pressureFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;',
    'uniform sampler2D uPressure; uniform sampler2D uDivergence;',
    'void main () {',
    '  float L = texture2D(uPressure, vL).x;',
    '  float R = texture2D(uPressure, vR).x;',
    '  float T = texture2D(uPressure, vT).x;',
    '  float B = texture2D(uPressure, vB).x;',
    '  float divergence = texture2D(uDivergence, vUv).x;',
    '  float pressure = (L + R + B + T - divergence) * 0.25;',
    '  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var gradientFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;',
    'uniform sampler2D uPressure; uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uPressure, vL).x;',
    '  float R = texture2D(uPressure, vR).x;',
    '  float T = texture2D(uPressure, vT).x;',
    '  float B = texture2D(uPressure, vB).x;',
    '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
    '  velocity.xy -= vec2(R - L, T - B);',
    '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* ---------- lacquer-on-water display shader（原型验证，原样保留） ---------- */
  var displayFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv;',
    'uniform sampler2D uDye;',
    'uniform vec2 texelSize;',
    'uniform float uTime;',
    '',
    'void main () {',
    '  vec3 dye = texture2D(uDye, vUv).rgb;',
    '',
    '  /* dark water basin: deep vignette + faint drifting caustic */',
    '  vec2 cc = vUv - 0.5;',
    '  float vig = smoothstep(0.98, 0.12, length(cc) * 1.25);',
    '  vec3 waterDeep = vec3(0.016, 0.036, 0.062);',
    '  vec3 waterMid  = vec3(0.048, 0.086, 0.132);',
    '  vec3 water = mix(waterDeep, waterMid, vig * 0.65);',
    '  float caustic = sin(vUv.x * 9.0 + uTime * 0.35) * sin(vUv.y * 8.0 - uTime * 0.28);',
    '  water += vec3(0.010) * (caustic * 0.5 + 0.5) * vig;',
    '',
    '  /* lacquer film: alpha = film thickness. Thin chromatic lacquer is',
    '     brightened toward its own saturated hue (real film is opaque vivid',
    '     colour even when spread thin); dense cores keep raw colour;',
    '     low-chroma ink black keeps its dark raw colour. */',
    '  float density = max(dye.r, max(dye.g, dye.b));',
    '  float mn = min(dye.r, min(dye.g, dye.b));',
    '  float chroma = density - mn;',
    '  float sat = chroma / max(density, 0.0001);',
    '  float alpha = smoothstep(0.0, 0.11, density);',
    '  vec3 tint = dye / max(density, 0.0001);',
    '  float boost = 1.0 + 2.0 * (1.0 - smoothstep(0.35, 1.0, density));',
    '  vec3 vividColor = tint * clamp(density * boost, 0.0, 1.0);',
    '  vec3 rawColor = clamp(dye, 0.0, 1.0);',
    '  vec3 lacquer = mix(rawColor, vividColor, smoothstep(0.18, 0.42, sat));',
    '',
    '  /* glossy sheen from surface gradient (fake specular, light upper-left) */',
    '  vec3 gx = texture2D(uDye, vUv + vec2(texelSize.x, 0.0)).rgb - texture2D(uDye, vUv - vec2(texelSize.x, 0.0)).rgb;',
    '  vec3 gy = texture2D(uDye, vUv + vec2(0.0, texelSize.y)).rgb - texture2D(uDye, vUv - vec2(0.0, texelSize.y)).rgb;',
    '  float grad = (gx.r + gx.g + gx.b) * 0.5 + (gy.r + gy.g + gy.b) * 0.5;',
    '  float sheen = clamp(grad * 1.6, -0.35, 1.0);',
    '  lacquer *= (0.90 + 0.50 * max(sheen, 0.0));',
    '  lacquer += vec3(0.05) * max(sheen, 0.0) * alpha;       /* wet rim gloss */',
    '',
    '  vec3 col = mix(water, lacquer, alpha);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---------- dye capture shader：同一套漆膜数学，输出 RGBA8（rgb=漆色, a=漆膜厚度） ---------- */
  var captureFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv;',
    'uniform sampler2D uDye;',
    'uniform vec2 texelSize;',
    '',
    'void main () {',
    '  vec3 dye = texture2D(uDye, vUv).rgb;',
    '  float density = max(dye.r, max(dye.g, dye.b));',
    '  float mn = min(dye.r, min(dye.g, dye.b));',
    '  float chroma = density - mn;',
    '  float sat = chroma / max(density, 0.0001);',
    '  float alpha = smoothstep(0.0, 0.11, density);',
    '  vec3 tint = dye / max(density, 0.0001);',
    '  float boost = 1.0 + 2.0 * (1.0 - smoothstep(0.35, 1.0, density));',
    '  vec3 vividColor = tint * clamp(density * boost, 0.0, 1.0);',
    '  vec3 rawColor = clamp(dye, 0.0, 1.0);',
    '  vec3 lacquer = mix(rawColor, vividColor, smoothstep(0.18, 0.42, sat));',
    '  vec3 gx = texture2D(uDye, vUv + vec2(texelSize.x, 0.0)).rgb - texture2D(uDye, vUv - vec2(texelSize.x, 0.0)).rgb;',
    '  vec3 gy = texture2D(uDye, vUv + vec2(0.0, texelSize.y)).rgb - texture2D(uDye, vUv - vec2(0.0, texelSize.y)).rgb;',
    '  float grad = (gx.r + gx.g + gx.b) * 0.5 + (gy.r + gy.g + gy.b) * 0.5;',
    '  float sheen = clamp(grad * 1.6, -0.35, 1.0);',
    '  lacquer *= (0.90 + 0.50 * max(sheen, 0.0));',
    '  lacquer += vec3(0.05) * max(sheen, 0.0) * alpha;',
    '  gl_FragColor = vec4(clamp(lacquer, 0.0, 1.0), alpha);',
    '}'
  ].join('\n');

  /* ---------- framebuffers ---------- */
  function createFBO(w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
      texture: texture, fbo: fbo, width: w, height: h,
      texelSizeX: 1.0 / w, texelSizeY: 1.0 / h,
      attach: function (id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; }
    };
  }

  function createDoubleFBO(w, h, internalFormat, format, type, param) {
    var fbo1 = createFBO(w, h, internalFormat, format, type, param);
    var fbo2 = createFBO(w, h, internalFormat, format, type, param);
    var obj = {
      width: w, height: h, texelSizeX: 1.0 / w, texelSizeY: 1.0 / h,
      swap: function () { var t = fbo1; fbo1 = fbo2; fbo2 = t; }
    };
    Object.defineProperty(obj, 'read', { get: function () { return fbo1; }, set: function (v) { fbo1 = v; } });
    Object.defineProperty(obj, 'write', { get: function () { return fbo2; }, set: function (v) { fbo2 = v; } });
    return obj;
  }

  function getResolution(res) {
    var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1.0 / aspect;
    var min = Math.round(res), max = Math.round(res * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight
      ? { width: max, height: min } : { width: min, height: max };
  }

  function initFramebuffers() {
    var simRes = getResolution(config.SIM_RESOLUTION);
    var dyeRes = getResolution(config.DYE_RESOLUTION);
    var texType = ext.halfFloatTexType;
    var RGBA = ext.formatRGBA, RG = ext.formatRG, R = ext.formatR;
    var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    dye = createDoubleFBO(dyeRes.width, dyeRes.height, RGBA.internalFormat, RGBA.format, texType, filtering);
    velocity = createDoubleFBO(simRes.width, simRes.height, RG.internalFormat, RG.format, texType, filtering);
    divergenceFBO = createFBO(simRes.width, simRes.height, R.internalFormat, R.format, texType, gl.NEAREST);
    curlFBO = createFBO(simRes.width, simRes.height, R.internalFormat, R.format, texType, gl.NEAREST);
    pressure = createDoubleFBO(simRes.width, simRes.height, R.internalFormat, R.format, texType, gl.NEAREST);
  }

  function ensureCaptureFBO(w, h) {
    if (captureFBO && captureW === w && captureH === h) return captureFBO;
    captureW = w; captureH = h;
    captureBuf = new Uint8Array(w * h * 4);
    var internal = ext.isWebGL2 ? gl.RGBA8 : gl.RGBA;
    captureFBO = createFBO(w, h, internal, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    return captureFBO;
  }

  function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.floor(canvas.clientWidth * dpr) || 1;
    var h = Math.floor(canvas.clientHeight * dpr) || 1;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
    return false;
  }

  /* ---------- simulation step ---------- */
  function step(dt) {
    gl.disable(gl.BLEND);

    programs.curl.bind();
    gl.uniform2f(programs.curl.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.curl.uniforms.uVelocity, velocity.read.attach(0));
    blitFn(curlFBO);

    programs.vorticity.bind();
    gl.uniform2f(programs.vorticity.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.vorticity.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(programs.vorticity.uniforms.uCurl, curlFBO.attach(1));
    gl.uniform1f(programs.vorticity.uniforms.curl, config.CURL);
    gl.uniform1f(programs.vorticity.uniforms.dt, dt);
    blitFn(velocity.write); velocity.swap();

    programs.divergence.bind();
    gl.uniform2f(programs.divergence.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.divergence.uniforms.uVelocity, velocity.read.attach(0));
    blitFn(divergenceFBO);

    programs.clear.bind();
    gl.uniform1i(programs.clear.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(programs.clear.uniforms.value, config.PRESSURE);
    blitFn(pressure.write); pressure.swap();

    programs.pressure.bind();
    gl.uniform2f(programs.pressure.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.pressure.uniforms.uDivergence, divergenceFBO.attach(0));
    for (var i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(programs.pressure.uniforms.uPressure, pressure.read.attach(1));
      blitFn(pressure.write); pressure.swap();
    }

    programs.gradient.bind();
    gl.uniform2f(programs.gradient.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.gradient.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(programs.gradient.uniforms.uVelocity, velocity.read.attach(1));
    blitFn(velocity.write); velocity.swap();

    // advect velocity
    programs.advection.bind();
    gl.uniform2f(programs.advection.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering) gl.uniform2f(programs.advection.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    var velId = velocity.read.attach(0);
    gl.uniform1i(programs.advection.uniforms.uVelocity, velId);
    gl.uniform1i(programs.advection.uniforms.uSource, velId);
    gl.uniform1f(programs.advection.uniforms.dt, dt);
    gl.uniform1f(programs.advection.uniforms.dissipation, config.VELOCITY_DISSIPATION);
    blitFn(velocity.write); velocity.swap();

    // advect dye
    if (!ext.supportLinearFiltering) gl.uniform2f(programs.advection.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(programs.advection.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(programs.advection.uniforms.dissipation, config.DENSITY_DISSIPATION);
    blitFn(dye.write); dye.swap();
  }

  function render() {
    programs.display.bind();
    gl.uniform2f(programs.display.uniforms.texelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(programs.display.uniforms.uDye, dye.read.attach(0));
    gl.uniform1f(programs.display.uniforms.uTime, time);
    blitFn(null);
  }

  /* ---------- splats ---------- */
  function correctRadius(radius) {
    var aspect = canvas.width / canvas.height;
    return aspect > 1 ? radius * aspect : radius;
  }
  function splatVelocity(x, y, dx, dy) {
    programs.splat.bind();
    gl.uniform1i(programs.splat.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(programs.splat.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(programs.splat.uniforms.point, x, y);
    gl.uniform3f(programs.splat.uniforms.color, dx, dy, 0.0);
    gl.uniform1f(programs.splat.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100.0));
    blitFn(velocity.write); velocity.swap();
  }
  function splatDye(x, y, color) {
    programs.splat.bind();
    gl.uniform1i(programs.splat.uniforms.uTarget, dye.read.attach(0));
    gl.uniform1f(programs.splat.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(programs.splat.uniforms.point, x, y);
    gl.uniform3f(programs.splat.uniforms.color, color.r, color.g, color.b);
    gl.uniform1f(programs.splat.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100.0));
    blitFn(dye.write); dye.swap();
  }

  /* ---------- public API ---------- */
  var Engine = {
    config: config,
    ok: false,

    /* 初始化：返回是否可用（WebGL 浮点渲染支持） */
    init: function (c) {
      canvas = c;
      resizeCanvas();
      var ctx = getWebGLContext(canvas);
      if (!ctx || !ctx.ext.formatRGBA) { Engine.ok = false; return false; }
      gl = ctx.gl; ext = ctx.ext; ext.isWebGL2 = ctx.isWebGL2;

      var baseVertex = compileShader(gl.VERTEX_SHADER, baseVertexSrc);
      programs.clear = new Program(baseVertex, clearFrag);
      programs.splat = new Program(baseVertex, splatFrag);
      programs.advection = new Program(baseVertex, advectionFrag, ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']);
      programs.divergence = new Program(baseVertex, divergenceFrag);
      programs.curl = new Program(baseVertex, curlFrag);
      programs.vorticity = new Program(baseVertex, vorticityFrag);
      programs.pressure = new Program(baseVertex, pressureFrag);
      programs.gradient = new Program(baseVertex, gradientFrag);
      programs.display = new Program(baseVertex, displayFrag);
      programs.capture = new Program(baseVertex, captureFrag);

      blitFn = (function () {
        var vb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vb);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        var eb = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        return function (target) {
          if (target == null) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          } else {
            gl.viewport(0, 0, target.width, target.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
          }
          gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        };
      })();

      initFramebuffers();
      Engine.ok = true;
      ready = true;
      return true;
    },

    /* 视口变化：canvas 尺寸 + FBO 重建 */
    resize: function () {
      if (!ready) return false;
      if (resizeCanvas()) { initFramebuffers(); return true; }
      return false;
    },

    /* 重置水面（清漆膜 + 清流速） */
    reset: function () {
      if (!ready) return;
      initFramebuffers();
      time = 0;
    },

    setSeed: function (seed) { rng = mulberry32(seed >>> 0); },

    /* 滴漆：注入染料 + 径向落水力（种子化角度，可复现） */
    drop: function (x, y, color) {
      if (!ready) return;
      var ang = rng() * Math.PI * 2;
      splatVelocity(x, y, Math.cos(ang) * config.TAP_FORCE, Math.sin(ang) * config.TAP_FORCE);
      splatDye(x, y, color);
    },

    /* 拉纹：单点速度 splat */
    drag: function (x, y, dx, dy) {
      if (!ready) return;
      if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) splatVelocity(x, y, dx, dy);
    },

    /* 拉纹：沿折线连续 splat（虚拟指针轨迹，demo / 录制用） */
    stroke: function (pts) {
      if (!ready || !pts || pts.length < 2) return;
      var prev = pts[0];
      for (var i = 1; i < pts.length; i++) {
        var p = pts[i];
        splatVelocity(p[0], p[1], (p[0] - prev[0]) * config.SPLAT_FORCE, (p[1] - prev[1]) * config.SPLAT_FORCE);
        prev = p;
      }
    },

    /* 主循环：step + render（仅在创作台可见时调用） */
    update: function (dt) {
      if (!ready) return;
      time += dt;
      step(dt);
      render();
    },

    /* 采样当前漆膜场：RGBA8 readPixels（rgb=漆色, a=漆膜厚度），
       行序 = GL 行序（row 0 对应 uv.y=0，即屏幕底部）。 */
    capture: function () {
      if (!ready) return null;
      var aspect = canvas.height / canvas.width;
      var w = config.CAPTURE_WIDTH;
      var h = Math.max(w, Math.min(900, Math.round(w * aspect)));
      var fbo = ensureCaptureFBO(w, h);

      gl.disable(gl.BLEND);
      programs.capture.bind();
      gl.uniform2f(programs.capture.uniforms.texelSize, dye.texelSizeX, dye.texelSizeY);
      gl.uniform1i(programs.capture.uniforms.uDye, dye.read.attach(0));
      blitFn(fbo);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, captureBuf);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // 复制一份，避免下一次 capture 覆盖同一 buffer
      var data = new Uint8Array(captureBuf);
      return { width: w, height: h, data: data };
    },

    /* 漆膜覆盖率（0..1）：用于「水面还没有漆」提示与成品小记 */
    coverage: function (cap) {
      if (!cap) return 0;
      var n = cap.width * cap.height, hit = 0;
      for (var i = 3; i < cap.data.length; i += 4) if (cap.data[i] > 26) hit++;
      return hit / n;
    },

    /* 调试：染料场是否有内容 */
    hasDye: function () {
      var cap = Engine.capture();
      return cap ? Engine.coverage(cap) > 0.005 : false;
    },

    canvasSize: function () {
      return canvas ? { width: canvas.width, height: canvas.height } : { width: 0, height: 0 };
    }
  };

  window.QSEngine = Engine;
})();
