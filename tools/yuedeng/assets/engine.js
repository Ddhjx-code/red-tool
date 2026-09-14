/* ============================================================
   月下灯会 · 透光效应 WebGL 引擎 (window.YDEngine)
   ------------------------------------------------------------
   自 tools/yuedeng/prototype.html 逐行抽取（原型已由用户验证通过，
   渲染行为不得改动）。设计文档 §9.1 已锁定的三层结构：

   1. 流体层：漆扇同款 stable-fluids (Navier-Stokes) GPU 求解器
      —— velocity + dye，advection / divergence / pressure(Jacobi)
         / gradient-subtract / vorticity confinement。
   2. 泛光层：四分之一分辨率 bright-pass + 两次 ping-pong 高斯模糊。
   3. 显示层：着色器把灯内烛火的光场乘进颜料——厚颜料吸收多 → 饱和
      色光，薄颜料让暖白烛光透过；灯轮廓外溢出的光晕带颜料色相。

   灯形切换 = 四个 SDF 权重混合（形变而非跳变）。
   画布 alpha:true，灯形外全透明，CSS 的月与星透出。
   确定性：零随机。烛火闪烁、摇摆、对流全部只是 elapsed time 的函数。
   ============================================================ */
(function () {
  'use strict';
  // allow: SIZE_OK —— 忠实抽取自已验证原型 + 内嵌 GLSL 源码文本；
  // 拆分模块会破坏「渲染行为与原型完全一致」的锁定约束。

  /* ---------- config（原型验证值，锁定） ---------- */
  var config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 640,
    DENSITY_DISSIPATION: 0.020,   // 灯面上的彩漆不消失
    VELOCITY_DISSIPATION: 0.40,   // 笔势收住后流会停下
    PRESSURE: 0.8,
    PRESSURE_ITERATIONS: 20,
    CURL: 26,
    SPLAT_RADIUS: 0.014,          // 兼容旧路径（纹样/对流）；笔法走自己的半径
    SPLAT_FORCE: 3600,
    COLOR_INTENSITY: 1.30,
    CONVECT_FORCE: 300,           // 点亮后的烛火对流（确定性）
    BLOOM_PASSES: 2
  };

  /* 笔法：勾线（细、几乎不搅动 → 纹样定得住）/ 晕染（粗、强搅动 → 色韵流开）。
     force 是 SPLAT_FORCE 的倍率，radius 与 SPLAT_RADIUS 同单位（百分之一 uv）。
     勾线的 force 不取 0：留一点极弱的搅动，笔迹才不至于像贴纸；但它小到
     一笔画下去几乎不位移，故细线、转折、纹样都立得住。 */
  var BRUSH = {
    line: { force: 0.06, radius: 0.008 },
    wash: { force: 1.00, radius: 0.020 }
  };
  var brush = 'line';

  /* ---------- 灯几何（画布 uv 空间；GL y 向上） ----------
     尺寸与位置按 390×844 视口下的实测舞台（390×554px）算定，不是拍脑袋：
     · 灯宽 = 2 × 0.21 × 390 = 163.8px = 屏宽的 42.0%
       （用户「灯有点太大了」；旧值 2×0.315×390 = 245.7px = 63.0%）
     · 宽高比 = 163.8 / (2 × 0.174 × 554) = 163.8 / 192.8 = 0.850
       （经典灯笼高于宽；旧值 245.7/249.3 = 0.986 近乎正方，读不出灯笼）
     · 灯心 v = 0.40 → 骨架 --cy = (1-0.40)×554 + 36（手提 LIFT）= 368.4px，
       灯面上口（|p.y|=1 的平口）= 368.4 - 96.4 = 272.0px。
       月下缘 238px（.moon 228px 盒，top 124px）→ 留出 34.0px 净空；
       旧值上口 210.5px，与月重叠 27.5px，灯盖更是压在月面上
       （用户「看不出哪个是月亮」）。 */
  var LAMP_C = { u: 0.5, v: 0.40 };
  var LAMP_HW = 0.21;    // 半宽 = 画布宽的比例
  var LAMP_HH = 0.174;   // 半高 = 画布高的比例
  var PIXEL_BLOCK = 3;   // 像素块边长（CSS px）
  var SHAPE_DUR = 0.45;  // 灯形形变时长（秒）
  var LIT_DUR_ON = 1.15; // 点亮时长
  var LIT_DUR_OFF = 0.70; // 熄灭时长
  var ROT_SPEED = 0.34;  // 灯体自转速度（弧度/秒，固定常量，零随机）≈ 18.5s 一周
  var PAINT_HOLD = 0.60; // 落笔期间与收笔之后的「筒面静止」宽限（秒）
  var TAU = 6.283185307179586;

  /* ---------- 模块状态 ---------- */
  var canvas = null, gl = null, ext = null;
  var dye = null, velocity = null, divergenceFBO = null, curlFBO = null, pressureFBO = null;
  var bloomA = null, bloomB = null;
  var dyeFixed = null;
  var programs = {};
  var blitFn = null;
  var ready = false;

  var time = 0;
  var pixU = 1 / 130, pixV = 1 / 187;
  var moonBright = 1.00;

  /* 点亮过渡（固定排程：时长 + 缓动，零随机） */
  var litLevel = 0, litTarget = 0, litFrom = 0, litT = 0, litFlash = 0;

  /* 灯形过渡：四个 SDF 按权重混合 */
  var shapeW = [1, 0, 0, 0];
  var shapeFrom = [1, 0, 0, 0];
  var shapeTo = [1, 0, 0, 0];
  var shapeT = 1;
  var shapeIndex = 0;

  /* 灯体自转（绕竖轴）：角度只是累计 dt × 固定速度的函数，零随机。
     autoRotate 默认关——用户要的是「可选择的 3D 模型旋转」，由 main.js
     接一个开关；painting / paintHold 让筒面在落笔时静止（见 setPainting）。 */
  var rotAngle = 0;
  var autoRotate = false;
  var painting = false;
  var paintHold = 0;

  var currentColor = { r: 0.8627 * config.COLOR_INTENSITY,
                       g: 0.9137 * config.COLOR_INTENSITY,
                       b: 0.8941 * config.COLOR_INTENSITY };   // 月白 #DCE9E4 × intensity

  /* ============================================================
     WebGL 上下文
     ============================================================ */
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
    // alpha:true —— 灯形之外输出 alpha=0，让 CSS 的月与星透出来
    var params = { alpha: true, depth: false, stencil: false, antialias: false,
                   premultipliedAlpha: true, preserveDrawingBuffer: true };
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
    g.clearColor(0, 0, 0, 0);

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

  /* ============================================================
     shader 工具
     ============================================================ */
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
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('shader:', gl.getShaderInfoLog(shader), source);
    }
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
    var u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return u;
  }
  function Program(vs, fs, keywords) {
    this.program = createProgram(vs, compileShader(gl.FRAGMENT_SHADER, fs, keywords));
    this.uniforms = getUniforms(this.program);
  }
  Program.prototype.bind = function () { gl.useProgram(this.program); };

  /* ============================================================
     shader 源码（原型逐字保留）
     ============================================================ */

  /* 模拟用顶点着色器（带四邻 uv） */
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

  /* 后处理用顶点着色器（只要 vUv） */
  var postVertexSrc = [
    'precision highp float;',
    'attribute vec2 aPosition;',
    'varying vec2 vUv;',
    'void main () {',
    '  vUv = aPosition * 0.5 + 0.5;',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* ---------- 固色：固定层 + 活层逐像素相加（= 已定的层压在活层之下） ---------- */
  var addFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv;',
    'uniform sampler2D uBase; uniform sampler2D uAdd;',
    'void main () { gl_FragColor = texture2D(uBase, vUv) + texture2D(uAdd, vUv); }'
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

  /* ---------- bloom：bright-pass + 双向高斯（1/4 分辨率） ---------- */
  var brightFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv;',
    'uniform sampler2D uDye; uniform sampler2D uDyeFixed;',
    'void main () {',
    '  vec3 dye = texture2D(uDye, vUv).rgb + texture2D(uDyeFixed, vUv).rgb;',
    '  float density = max(dye.r, max(dye.g, dye.b));',
    '  float mn = min(dye.r, min(dye.g, dye.b));',
    '  float chroma = density - mn;',
    '  float sat = chroma / max(density, 0.0001);',
    '  vec3 tint = dye / max(density, 0.0001);',
    '  float boost = 1.0 + 2.0 * (1.0 - smoothstep(0.35, 1.0, density));',
    '  vec3 vivid = tint * clamp(density * boost, 0.0, 1.0);',
    '  vec3 col = mix(clamp(dye, 0.0, 1.0), vivid, smoothstep(0.18, 0.42, sat));',
    '  float a = smoothstep(0.015, 0.22, density);',
    '  gl_FragColor = vec4(col * a, 1.0);',
    '}'
  ].join('\n');

  var blurFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv;',
    'uniform sampler2D uTexture;',
    'uniform vec2 uDir;',
    'void main () {',
    '  vec3 s = texture2D(uTexture, vUv).rgb * 0.2270270270;',
    '  s += (texture2D(uTexture, vUv + uDir * 1.3846153846).rgb',
    '      + texture2D(uTexture, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;',
    '  s += (texture2D(uTexture, vUv + uDir * 3.2307692308).rgb',
    '      + texture2D(uTexture, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;',
    '  gl_FragColor = vec4(s, 1.0);',
    '}'
  ].join('\n');

  /* ---------- display：透光效应 ---------- */
  var displayFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv;',
    '',
    'uniform sampler2D uDye;',
    'uniform sampler2D uDyeFixed;',
    'uniform sampler2D uBloom;',
    'uniform float uTime;',
    'uniform float uLit;      /* 0..1 点亮进度 */',
    'uniform float uFlash;    /* 火苗刚着的那一下 */',
    'uniform vec4  uShapeW;   /* 四盏灯形的混合权重，和为 1 */',
    'uniform vec2  uLampC;    /* 灯心（画布 uv） */',
    'uniform vec2  uLampH;    /* 灯半宽 / 半高（画布 uv） */',
    'uniform vec2  uPix;      /* 像素块尺寸（uv），用于把轮廓量化成像素边 */',
    'uniform float uMoon;     /* 月相明度 0..1 */',
    'uniform float uRot;      /* 灯体绕竖轴的转角（弧度）；0 = 正面朝观者 */',
    '',
    'const float PI      = 3.141592653589793;',
    'const float INV_TAU = 0.15915494309189535;   /* 1/2π：方位角 → 纹理横轴 */',
    'const vec3 LAMP   = vec3(1.00, 0.84, 0.55);   /* 烛火暖光 */',
    'const vec3 PAPER  = vec3(0.97, 0.91, 0.79);   /* 灯纸 */',
    'const vec3 MOONLT = vec3(0.42, 0.50, 0.72);   /* 月光冷调 */',
    '',
    '/* ---- 灯形：四种灯笼轮廓（竹篾为骨，纸绢为面） ----',
    '   骨条把灯面撑成鼓形：腰腹最宽，向上下两头收窄，最后收成两个',
    '   平的「灯口」——CSS 的 .lamp-cap（宽 --hw*0.62）/ .lamp-base',
    '   （宽 --hw*0.54）正扣在这两口上，提梁与流苏挂在两口之外。',
    '   这一「中间鼓、两头收」是读作灯笼的唯一关键：椭球读作球，',
    '   圆角矩形读作盒子，正六边形读作多边形——三者都没有收口。',
    '   四式的灯口一律落在 |p.y| = 1，也就是 CSS 的 cy±hh，所以骨架',
    '   不随灯形改动；形变时两口不动、只有侧壁在变，故形变平滑。',
    '   t = |p.y|（0 腰腹 / 1 灯口）；侧壁与上下两口取交（max），',
    '   两口因此是平的。四式共用同一构造、同一长度单位，故四路权重',
    '   混合插值的是同类量——形变而非跳变。 */',
    'float lampBody (vec2 p, float halfW) {',
    '  return max(abs(p.x) - halfW, abs(p.y) - 1.0);',
    '}',
    '/* 四式各自的侧壁半宽（灯半宽的比例）。轮廓与体积着色必须同源同值，',
    '   故半宽单独成一个函数：sdfAt 用它取交（max）拼轮廓，圆柱着色用它',
    '   把灯面横坐标归一到 -1..1。表达式与轮廓逐字相同，故四式轮廓不变。 */',
    'vec4 shapeHalfW (vec2 p) {',
    '  float t = clamp(abs(p.y), 0.0, 1.0);',
    '  float belly = sqrt(max(0.0, 1.0 - t * t));',
    '',
    '  /* 圆灯：椭圆鼓腹，饱满而上下收口——经典中式灯笼，不是球 */',
    '  float w0 = 0.30 + 0.54 * belly;',
    '',
    '  /* 方灯：骨架方正、四角圆润——中段两壁近乎竖直，近灯口才收成口 */',
    '  float u1 = t * t;',
    '  float w1 = 0.31 + 0.59 * (1.0 - u1 * u1 * u1);',
    '',
    '  /* 六角灯：六片灯面拼成，壁直折硬，竹篾骨条最显——宫灯式，瘦长 */',
    '  float w2 = 0.27 + 0.51 * clamp((1.0 - t) / 0.40, 0.0, 1.0);',
    '',
    '  /* 莲花灯：八瓣起伏如莲，中秋放灯水里的一式。瓣尖沿轮廓一周',
    '     八道（象限折叠角 × 8 = 八瓣，上下左右对称），腰腹最显，',
    '     向灯口收平——莲瓣灯的口是圆的，扣得住灯盖。 */',
    '  float a3 = atan(abs(p.y), abs(p.x));',
    '  float w3 = (0.31 + 0.49 * belly)',
    '           * (1.0 + 0.11 * belly * cos(a3 * 8.0 + 0.3926994));',
    '',
    '  return vec4(w0, w1, w2, w3);',
    '}',
    'float sdfAt (vec2 q) {',
    '  vec2 p = (q - uLampC) / uLampH;',
    '  vec4 hw = shapeHalfW(p);',
    '  float d0 = lampBody(p, hw.x);',
    '  float d1 = lampBody(p, hw.y);',
    '  float d2 = lampBody(p, hw.z);',
    '  float d3 = lampBody(p, hw.w);',
    '',
    '  return uShapeW.x * d0 + uShapeW.y * d1 + uShapeW.z * d2 + uShapeW.w * d3;',
    '}',
    '',
    'void main () {',
    '  /* ---- 灯轮廓：像素量化边缘 + 连续边缘（供光晕用） ---- */',
    '  vec2 q = (floor(vUv / uPix) + 0.5) * uPix;',
    '  float sdq = sdfAt(q);',
    '  float sdc = sdfAt(vUv);',
    '  float mask = smoothstep(0.010, -0.010, sdq);',
    '',
    '  /* ---- 圆柱体积：灯面是绕竖轴的一只纸筒（竹篾为骨，纸绢为面） ----',
    '     nx   = 灯面本地横坐标 -1..1，按该高度的鼓腹半宽归一（不是按灯半宽，',
    '            于是上下收口处也算得对）；',
    '     facing = sqrt(1-nx²) = 纸面法线与视线的夹角余弦。正对观者与烛火处',
    '            透光最多，越往两侧纸面越「转过去」，透光越少——这是读得出',
    '            体积的第一关键，静态时也成立（旧版只有平片式的径向渐变）。',
    '     注意：圆柱绕竖轴自转，投影宽度恒定，故轮廓绝不随转角收窄；',
    '            变的只是「哪一块筒面正对观者」。 */',
    '  vec2 pc = (vUv - uLampC) / uLampH;',
    '  float halfW = max(dot(shapeHalfW(pc), uShapeW), 0.0001);',
    '  float nx = clamp(pc.x / halfW, -1.0, 1.0);',
    '  float facing = sqrt(max(0.0, 1.0 - nx * nx));',
    '  float ty = clamp(abs(pc.y), 0.0, 1.0);',
    '',
    '  /* ---- 灯体转角：颜料贴在筒面上，随灯绕过圆周 ----',
    '     theta = 该点在筒面上的方位角（正对观者 = 0）。筒面按方位角整周展开，',
    '     故纹样横坐标 = (theta + uRot) 线性映射到纹理横轴 [0,1]：整周 2π 对应',
    '     整张纹理，正对观者的半周占纹理中段一半；超过 ±π 时绕回（筒面是闭合的）。',
    '     关键：这里必须是角度的线性映射，不能用 sin(theta + uRot)。sin 在',
    '     |theta + uRot| > π/2 时非单调，会把筒面折叠成镜像 —— 同一块纹样在屏幕上',
    '     出现两次，表现为「旋转后笔触被横向撕裂、落点偏出半盏灯」，且转得越多越坏；',
    '     uRot = 0 时恰好不折叠，所以这个错只在旋转时才暴露。 */',
    '  float theta = asin(nx);',
    '  float psi = mod(theta + uRot + PI, 2.0 * PI) - PI;',
    '  vec2 dyeUv = vec2(0.5 + psi * INV_TAU, vUv.y);',
    '',
    '  /* ---- 颜料：来自流体染料场（按转角绕筒面取） ---- */',
    '  vec3 dye = texture2D(uDye, dyeUv).rgb + texture2D(uDyeFixed, dyeUv).rgb;',
    '  float density = max(dye.r, max(dye.g, dye.b));',
    '  float mn = min(dye.r, min(dye.g, dye.b));',
    '  float chroma = density - mn;',
    '  float sat = chroma / max(density, 0.0001);',
    '  vec3 tint = dye / max(density, 0.0001);',
    '  float boost = 1.0 + 2.0 * (1.0 - smoothstep(0.35, 1.0, density));',
    '  vec3 vivid = tint * clamp(density * boost, 0.0, 1.0);',
    '  vec3 pigment = mix(clamp(dye, 0.0, 1.0), vivid, smoothstep(0.18, 0.42, sat));',
    '  float cover = smoothstep(0.00, 0.10, density);',
    '',
    '  /* ---- 竹篾骨条：钉在骨架上，故随灯体一起转 ----',
    '     等角间距的骨条投影到筒面上越靠两侧越密（nx = sin(角)），于是骨条',
    '     「贴在曲面上」而不是平条纹；再乘 facing，转到侧面的骨条自然淡出。',
    '     六角灯六片拼成、骨条最显（SHAPES 表自陈），故按权重加条数与亮度。',
    '     坐标走像素量化的 q，保留像素风的阶跃边。克制：骨条是结构线索，',
    '     不是装饰，绝不盖住用户画的纹样。 */',
    '  float ribN = 10.0 + 4.0 * (uShapeW.z + uShapeW.w);',
    '  float ribA = 0.30 + 0.10 * uShapeW.z;',
    '  float nxq = clamp((q.x - uLampC.x) / (uLampH.x * halfW), -1.0, 1.0);',
    '  float rib = smoothstep(0.80, 0.97, abs(sin((asin(nxq) + uRot) * ribN))) * facing;',
    '',
    '  /* ---- 曲面高光：筒面正对光源（左上）的那一带起一道柔光 ----',
    '     facing^4 把高光压在正对观者的窄带里，nx 的偏移把它推向左上，',
    '     于是灯面像纸筒一样「捕光」，而不是一张平片的径向渐变。 */',
    '  float hl = pow(facing, 4.0) * (1.0 - smoothstep(0.05, 0.85, abs(nx + 0.30)));',
    '',
    '  /* ---- 烛火光场（确定性闪烁：只由 uTime 驱动） ---- */',
    '  vec2 fp = uLampC + vec2(0.0, -uLampH.y * 0.30);',
    '  vec2 fd = (vUv - fp) / uLampH;',
    '  float fr = length(fd);',
    '  float flick = 0.900',
    '              + 0.062 * sin(uTime * 6.70)',
    '              + 0.040 * sin(uTime * 10.90 + 1.30)',
    '              + 0.026 * sin(uTime * 2.90 + 0.60);',
    '  /* 光场：一层铺满整盏灯的暖底光 + 烛火正上方的一团热芯。',
    '     旧版只有高斯衰减，灯面边缘 lamp 掉到 0.14，整盏灯于是发灰——',
    '     点亮的灯笼必须是亮的，这是这个原型的全部意义。 */',
    '  float lamp = (0.10 + 0.90 * exp(-fr * fr * 2.20)) * flick;',
    '  lamp *= 0.72 + 0.40 * (1.0 - smoothstep(-1.25, 1.05, fd.y));   /* 靠烛火处更热，上口明显转暗 */',
    '  lamp += uFlash;',
    '  lamp = clamp(lamp, 0.0, 1.25);',
    '',
    '  /* 泛光取两份：灯面内的那一份随筒面转（纹样转到哪，光就跟到哪），',
    '     溢出轮廓外的那一份留在 vUv——光晕是屏幕空间的外溢，不随筒面转。 */',
    '  vec3 bloom = texture2D(uBloom, vUv).rgb;',
    '  vec3 bloomBody = texture2D(uBloom, dyeUv).rgb;',
    '',
    '  /* ---- 未点亮：月光下的干颜料 ---- */',
    '  vec3 dryPaper = PAPER * (0.20 + 0.22 * uMoon);',
    '  vec3 dryPig   = pigment * (0.50 + 0.38 * uMoon);',
    '  vec3 unlit = mix(dryPaper, dryPig, cover);',
    '  /* 圆柱着色：正对观者处受光多，两侧纸面转过去 → 转暗。facing=0 处收到',
    '     0.66，与旧版径向渐变在轮廓边缘同值，故边缘暗度不回退；上下灯口再',
    '     压一档（纸面在那里收进灯盖与灯底）；骨条在纸上投一道极淡的影。 */',
    '  unlit *= mix(0.66, 1.0, facing);',
    '  unlit *= 1.0 - 0.22 * ty * ty;',
    '  unlit *= 1.0 - rib * 0.22;',
    '  unlit += MOONLT * (1.0 - cover) * hl * 0.16 * uMoon;',
    '',
    '  /* ---- 点亮：透光效应 ----',
    '     烛火在灯内，颜料是滤光片：厚颜料吸收多 → 深而饱和的色光，',
    '     薄颜料让暖白烛光透过来 → 发烫的浅色。透射色相比颜料自身的',
    '     反射色更饱和（真实透光就是如此），故先把色相饱和度推一把。',
    '     全程把结果压在 1.0 附近留余量——只有烛火正上方那一小点烧到白，',
    '     整盏灯不能冲成一片白（那会把纹样抹平，正是这个原型要避免的）。 */',
    '  float tmax = max(tint.r, max(tint.g, tint.b));',
    '  vec3 hue = tint / max(tmax, 0.0001);',
    '  hue = mix(hue, hue * hue, 0.45);',
    '  float absorb  = clamp(density, 0.0, 1.0);',
    '  float through = 1.0 - 0.62 * absorb;                   /* 透过颜料的总光量 */',
    '  vec3 transmit = hue * through * (0.55 + 0.75 * absorb) * 1.35;',
    '  vec3 litPig   = mix(LAMP * 1.05, transmit, smoothstep(0.02, 0.35, absorb));',
    '  vec3 litPaper = vec3(1.00, 0.88, 0.66);                /* 空白灯纸：暖白，不是纯白 */',
    '  vec3 lit = mix(litPaper, litPig, cover);',
    '  /* 0.40 + 0.78*lamp 的峰值正好落在 1.00：空白灯纸烧到 (255,224,168)',
    '     的暖白而不是纯白——纸的蓝通道只有 0.66，怎么乘都到不了 252，',
    '     所以「整盏灯冲成一片白」这个失败模式在数学上被封死了。 */',
    '  lit *= 0.40 + 0.78 * lamp;',
    '  /* 加性辉光：颜料自己的光向外溢出、流变（克制，不把画面冲白） */',
    '  lit += bloomBody * 0.30 * lamp;',
    '',
    '  /* 竹篾挡光：纸面透光时，挡光的骨条在亮底上读作竖向暗筋。旧版把它',
    '     加亮（+= LAMP * rib * ...），方向反了 —— 亮底上再加亮条，骨就消失，',
    '     灯面于是塌成一张平板，这正是「像贴图变亮而不像里面点了火」的来源之一。',
    '     只在透光态成立；未点亮时骨条由 unlit 分支的浅影负责。 */',
    '  lit *= 1.0 - rib * ribA * 1.7 * lamp;',
    '',
    '  /* 圆柱着色：透光同样按纸面朝向衰减——正对观者的一面亮，转到侧面的',
    '     一面暗，体积才立得住。facing=1（正中央）时因子恰为 1.00，故上面',
    '     「0.40 + 0.78*lamp 峰值落在 1.00」的锁定不被改动。',
    '     曲面高光只落在灯纸上，厚颜料处压掉大半，免得把用户画的纹样洗白。 */',
    '  lit *= mix(0.70, 1.0, facing);',
    '  lit *= 1.0 - 0.18 * ty * ty;',
    '  lit += vec3(1.00, 0.92, 0.74) * hl * 0.09 * lamp * (1.0 - 0.65 * cover);',
    '',
    '  vec3 body = mix(unlit, lit, uLit);',
    '',
    '  /* 像素描边：未点亮时压深轮廓，点亮时让位给热边 */',
    '  float edgeQ = 1.0 - smoothstep(0.00, 0.085, abs(sdq));',
    '  body = mix(body, vec3(0.075, 0.060, 0.055), edgeQ * (0.50 - 0.34 * uLit));',
    '',
    '  /* 热边：光从灯纸边缘逃出来 */',
    '  float rim = (1.0 - smoothstep(0.0, 0.075, abs(sdc))) * uLit;',
    '  body += vec3(1.00, 0.78, 0.46) * rim * (0.30 + 0.40 * lamp);',
    '',
    '  /* ---- 溢进夜空的光晕：灯会的光就是靠这一圈读出来的 ----',
    '     SDF 的单位是「灯半宽」，所以指数必须小（3.0），否则光晕在',
    '     8px 内就死掉了；旧值 15.0 让夜空一点变化都没有。 */',
    '  float spill = exp(-max(sdc, 0.0) * 3.0) * uLit;',
    '  float bl = max(bloom.r, max(bloom.g, bloom.b));',
    '  vec3 glowHue = bloom / max(bl, 0.0001);',
    '  vec3 spillTint = mix(LAMP, glowHue, 0.55 * smoothstep(0.0, 0.20, bl));',
    '  vec3 spillCol = spillTint * spill * (0.55 + 0.55 * lamp);',
    '  float spillA = clamp(spill * 0.95, 0.0, 1.0);',
    '',
    '  vec3 straight = mix(spillCol, body, mask);',
    '  float a = mix(spillA, 1.0, mask);',
    '  gl_FragColor = vec4(straight * a, a);   /* premultiplied */',
    '}'
  ].join('\n');

  /* ============================================================
     framebuffers
     ============================================================ */
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
      attach: function (id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      }
    };
  }

  function createDoubleFBO(w, h, internalFormat, format, type, param) {
    var fbo1 = createFBO(w, h, internalFormat, format, type, param);
    var fbo2 = createFBO(w, h, internalFormat, format, type, param);
    return {
      width: w, height: h, texelSizeX: 1.0 / w, texelSizeY: 1.0 / h,
      get read() { return fbo1; }, set read(v) { fbo1 = v; },
      get write() { return fbo2; }, set write(v) { fbo2 = v; },
      swap: function () { var t = fbo1; fbo1 = fbo2; fbo2 = t; }
    };
  }

  function getResolution(res) {
    var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1.0 / aspect;
    var min = Math.round(res), max = Math.round(res * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight
      ? { width: max, height: min } : { width: min, height: max };
  }

  function initFramebuffers(preserve) {
    var simRes = getResolution(config.SIM_RESOLUTION);
    var dyeRes = getResolution(config.DYE_RESOLUTION);
    var bloomRes = { width: Math.max(2, Math.round(dyeRes.width / 4)),
                     height: Math.max(2, Math.round(dyeRes.height / 4)) };
    var texType = ext.halfFloatTexType;
    var RGBA = ext.formatRGBA, RG = ext.formatRG, R = ext.formatR;
    var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    var oldDye = preserve ? dye : null;
    var oldFixed = preserve ? dyeFixed : null;
    var oldVel = preserve ? velocity : null;

    dye = createDoubleFBO(dyeRes.width, dyeRes.height, RGBA.internalFormat, RGBA.format, texType, filtering);
    dyeFixed = createDoubleFBO(dyeRes.width, dyeRes.height, RGBA.internalFormat, RGBA.format, texType, filtering);
    velocity = createDoubleFBO(simRes.width, simRes.height, RG.internalFormat, RG.format, texType, filtering);
    divergenceFBO = createFBO(simRes.width, simRes.height, R.internalFormat, R.format, texType, gl.NEAREST);
    curlFBO = createFBO(simRes.width, simRes.height, R.internalFormat, R.format, texType, gl.NEAREST);
    pressureFBO = createDoubleFBO(simRes.width, simRes.height, R.internalFormat, R.format, texType, gl.NEAREST);
    bloomA = createFBO(bloomRes.width, bloomRes.height, RGBA.internalFormat, RGBA.format, texType, filtering);
    bloomB = createFBO(bloomRes.width, bloomRes.height, RGBA.internalFormat, RGBA.format, texType, filtering);

    copyTexture(oldDye, dye);
    copyTexture(oldFixed, dyeFixed);
    copyTexture(oldVel, velocity);
  }

  /* 把旧纹理整幅拷进新纹理。resize 会重建全部 FBO，若不搬内容，用户画到一半
     只要视口尺寸一变（触摸设备地址栏显隐、横竖屏切换、软键盘弹出）整幅灯面就
     被清空 —— 这正是「画着画着回到开头」的来源。reset 则故意不搬。
     clearFrag 是 value * texture2D，取 value = 1 即纯拷贝，无需再加着色器。 */
  function copyTexture(src, dst) {
    if (!src || !dst || !programs.clear || !blitFn) { return; }
    programs.clear.bind();
    gl.uniform1i(programs.clear.uniforms.uTexture, src.read.attach(0));
    gl.uniform1f(programs.clear.uniforms.value, 1.0);
    blitFn(dst.write);
    dst.swap();
  }

  /* canvas 尺寸同步 + 像素块 uv（骨架与着色器同源同值） */
  function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = canvas.clientWidth || 0;
    var cssH = canvas.clientHeight || 0;
    var w = Math.floor(cssW * dpr) || 1;
    var h = Math.floor(cssH * dpr) || 1;
    pixU = PIXEL_BLOCK / Math.max(1, cssW);
    pixV = PIXEL_BLOCK / Math.max(1, cssH);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
    return false;
  }

  /* ============================================================
     simulation step（stable-fluids：vorticity → divergence →
     pressure(Jacobi) → gradient-subtract → advect velocity → advect dye）
     ============================================================ */
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
    gl.uniform1i(programs.clear.uniforms.uTexture, pressureFBO.read.attach(0));
    gl.uniform1f(programs.clear.uniforms.value, config.PRESSURE);
    blitFn(pressureFBO.write); pressureFBO.swap();

    programs.pressure.bind();
    gl.uniform2f(programs.pressure.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.pressure.uniforms.uDivergence, divergenceFBO.attach(0));
    for (var i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(programs.pressure.uniforms.uPressure, pressureFBO.read.attach(1));
      blitFn(pressureFBO.write); pressureFBO.swap();
    }

    programs.gradient.bind();
    gl.uniform2f(programs.gradient.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.gradient.uniforms.uPressure, pressureFBO.read.attach(0));
    gl.uniform1i(programs.gradient.uniforms.uVelocity, velocity.read.attach(1));
    blitFn(velocity.write); velocity.swap();

    // advect velocity
    programs.advection.bind();
    gl.uniform2f(programs.advection.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering) {
      gl.uniform2f(programs.advection.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    }
    var velId = velocity.read.attach(0);
    gl.uniform1i(programs.advection.uniforms.uVelocity, velId);
    gl.uniform1i(programs.advection.uniforms.uSource, velId);
    gl.uniform1f(programs.advection.uniforms.dt, dt);
    gl.uniform1f(programs.advection.uniforms.dissipation, config.VELOCITY_DISSIPATION);
    blitFn(velocity.write); velocity.swap();

    // advect dye
    if (!ext.supportLinearFiltering) {
      gl.uniform2f(programs.advection.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    }
    gl.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(programs.advection.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(programs.advection.uniforms.dissipation, config.DENSITY_DISSIPATION);
    blitFn(dye.write); dye.swap();
  }

  /* ============================================================
     bloom passes：1/4 分辨率 bright-pass + 两次 ping-pong 高斯
     ============================================================ */
  function renderBloom() {
    gl.disable(gl.BLEND);

    programs.bright.bind();
    gl.uniform1i(programs.bright.uniforms.uDye, dye.read.attach(0));
    gl.uniform1i(programs.bright.uniforms.uDyeFixed, dyeFixed.read.attach(1));
    blitFn(bloomA);

    programs.blur.bind();
    gl.uniform1i(programs.blur.uniforms.uTexture, 0);
    for (var i = 0; i < config.BLOOM_PASSES; i++) {
      var spread = i === 0 ? 1.0 : 2.6;
      gl.uniform2f(programs.blur.uniforms.uDir, bloomA.texelSizeX * spread, 0.0);
      gl.uniform1i(programs.blur.uniforms.uTexture, bloomA.attach(0));
      blitFn(bloomB);

      gl.uniform2f(programs.blur.uniforms.uDir, 0.0, bloomB.texelSizeY * spread);
      gl.uniform1i(programs.blur.uniforms.uTexture, bloomB.attach(0));
      blitFn(bloomA);
    }
  }

  /* ============================================================
     display pass：透光效应
     ============================================================ */
  function renderDisplay() {
    if (!ready) return;
    programs.display.bind();
    gl.uniform1i(programs.display.uniforms.uDye, dye.read.attach(0));
    gl.uniform1i(programs.display.uniforms.uDyeFixed, dyeFixed.read.attach(2));
    gl.uniform1i(programs.display.uniforms.uBloom, bloomA.attach(1));
    gl.uniform1f(programs.display.uniforms.uTime, time);
    gl.uniform1f(programs.display.uniforms.uLit, litLevel);
    gl.uniform1f(programs.display.uniforms.uFlash, litFlash);
    gl.uniform4f(programs.display.uniforms.uShapeW, shapeW[0], shapeW[1], shapeW[2], shapeW[3]);
    gl.uniform2f(programs.display.uniforms.uLampC, LAMP_C.u, LAMP_C.v);
    gl.uniform2f(programs.display.uniforms.uLampH, LAMP_HW, LAMP_HH);
    gl.uniform2f(programs.display.uniforms.uPix, pixU, pixV);
    gl.uniform1f(programs.display.uniforms.uMoon, moonBright);
    gl.uniform1f(programs.display.uniforms.uRot, rotAngle);
    blitFn(null);
  }

  /* ============================================================
     splats
     ============================================================ */
  function correctRadius(radius) {
    var aspect = canvas.width / canvas.height;
    return aspect > 1 ? radius * aspect : radius;
  }
  function splatVelocity(x, y, dx, dy, radius) {
    programs.splat.bind();
    gl.uniform1i(programs.splat.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(programs.splat.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(programs.splat.uniforms.point, x, y);
    gl.uniform3f(programs.splat.uniforms.color, dx, dy, 0.0);
    gl.uniform1f(programs.splat.uniforms.radius,
                 correctRadius(radius === undefined ? config.SPLAT_RADIUS / 100.0 : radius));
    blitFn(velocity.write); velocity.swap();
  }
  function splatDye(x, y, color, radius) {
    programs.splat.bind();
    gl.uniform1i(programs.splat.uniforms.uTarget, dye.read.attach(0));
    gl.uniform1f(programs.splat.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(programs.splat.uniforms.point, x, y);
    gl.uniform3f(programs.splat.uniforms.color, color.r, color.g, color.b);
    gl.uniform1f(programs.splat.uniforms.radius,
                 correctRadius(radius === undefined ? config.SPLAT_RADIUS / 100.0 : radius));
    blitFn(dye.write); dye.swap();
  }

  /* 灯形半宽（JS 侧镜像）。与 display 着色器的 shapeHalfW 逐行同式：
     着色器用它算轮廓与筒面横坐标，这里用它算落笔的逆映射。两边一旦不同步，
     笔触就会在灯形边缘错位 —— 改动时必须两处同时改。 */
  function shapeHalfW(px, py) {
    var t = Math.min(Math.abs(py), 1.0);
    var belly = Math.sqrt(Math.max(0, 1 - t * t));
    var w0 = 0.30 + 0.54 * belly;
    var u1 = t * t;
    var w1 = 0.31 + 0.59 * (1 - u1 * u1 * u1);
    var w2 = 0.27 + 0.51 * Math.min(Math.max((1 - t) / 0.40, 0), 1);
    var a3 = Math.atan2(Math.abs(py), Math.abs(px));
    var w3 = (0.31 + 0.49 * belly) * (1 + 0.11 * belly * Math.cos(a3 * 8.0 + 0.3926994));
    return w0 * shapeW[0] + w1 * shapeW[1] + w2 * shapeW[2] + w3 * shapeW[3];
  }

  /* 落笔坐标 → 染料纹理 x 的逆映射（含灯体转角）。
     与 display 着色器同式：筒面按方位角整周展开，故纹理横轴 = (rot + asin(nx))/2π，
     超过 ±π 绕回。必须与着色器一起改，否则笔触会随转角漂移。 */
  function dyeX(px, py) {
    var hw = Math.max(shapeHalfW(px, py), 0.0001);
    var nx = Math.max(-1, Math.min(1, px / hw));
    var psi = rotAngle + Math.asin(nx);
    psi = ((psi + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return 0.5 + psi / TAU;
  }

  /* 一笔：速度 splat（有位移时）+ 颜料 splat。
     同时挂起自转：筒面在落笔时若还在转，一笔会被抹开成一条横扫。 */
  function paint(x, y, dx, dy) {
    paintHold = PAINT_HOLD;
    var b = BRUSH[brush] || BRUSH.line;
    var r = b.radius / 100.0;
    var f = config.SPLAT_FORCE * b.force;
    var tx = dyeX((x - LAMP_C.u) / LAMP_HW, (y - LAMP_C.v) / LAMP_HH);
    if (f > 0 && (Math.abs(dx) > 0.00005 || Math.abs(dy) > 0.00005)) {
      splatVelocity(tx, y, dx * f, dy * f, r);
    }
    splatDye(tx, y, currentColor, r);
  }

  /* 纹样点集：以灯心为原点、LAMP_HW/LAMP_HH 为单位的归一化坐标，y 正方向为屏幕上方。
     生成式参数曲线采样而非静态点表——比手列数百点紧凑，且纹样更平滑。
     半径一律控制在 ±0.60 内：四种灯形轮廓都在此范围，故纹样不会落到灯外。 */
  function motifPoints(id) {
    var pts = [], i, t, a, r, k;
    if (id === 'moon') {
      for (i = 0; i < 56; i++) {
        a = i / 56 * TAU;
        pts.push([Math.cos(a) * 0.60, Math.sin(a) * 0.60]);
      }
    } else if (id === 'gui') {
      for (k = 0; k < 5; k++) {
        a = k / 5 * TAU;
        for (t = 0; t <= 1.0001; t += 0.1) {
          r = 0.16 + 0.44 * Math.sin(t * Math.PI);
          pts.push([Math.cos(a + (t - 0.5) * 0.62) * r,
                    Math.sin(a + (t - 0.5) * 0.62) * r]);
        }
      }
    } else if (id === 'tu') {
      for (k = 0; k < 2; k++) {
        for (t = 0; t <= 1.0001; t += 0.08) {
          pts.push([(k ? 0.20 : -0.20) + Math.sin(t * Math.PI) * 0.05 * (k ? 1 : -1),
                    0.18 + t * 0.42]);
        }
      }
      for (i = 0; i < 32; i++) {
        a = i / 32 * TAU;
        pts.push([Math.cos(a) * 0.20, -0.02 + Math.sin(a) * 0.18]);
      }
      for (i = 0; i < 40; i++) {
        a = i / 40 * TAU;
        pts.push([Math.cos(a) * 0.30, -0.34 + Math.sin(a) * 0.24]);
      }
    } else if (id === 'yun') {
      for (k = 0; k < 2; k++) {
        for (t = 0; t <= 1.0001; t += 0.04) {
          a = t * Math.PI * 2.4 + k * Math.PI;
          r = 0.08 + t * 0.26;
          pts.push([(k ? 0.24 : -0.24) + Math.cos(a) * r,
                    Math.sin(a) * r * 0.72]);
        }
      }
    } else if (id === 'huaniao') {
      for (k = 0; k < 6; k++) {
        a = k / 6 * TAU;
        for (t = 0; t <= 1.0001; t += 0.12) {
          r = 0.08 + 0.22 * Math.sin(t * Math.PI);
          pts.push([-0.26 + Math.cos(a + (t - 0.5) * 0.5) * r,
                    -0.12 + Math.sin(a + (t - 0.5) * 0.5) * r]);
        }
      }
      for (t = 0; t <= 1.0001; t += 0.05) {
        pts.push([0.10 + t * 0.30, 0.14 - Math.sin(t * Math.PI) * 0.14]);
      }
      for (t = 0; t <= 1.0001; t += 0.08) {
        pts.push([0.20 + t * 0.14, 0.08 - t * 0.26]);
      }
      for (t = 0; t <= 1.0001; t += 0.1) {
        pts.push([0.40 + t * 0.14, 0.14 + t * 0.16]);
      }
    }
    return pts;
  }

  /* 纹样落灯面：沿点集逐点 splatDye，走与手绘完全相同的颜料通路，
     所以纹样天然融入流体——随染料晕开、随筒面转动、点亮时一起透光。 */
  function splatMotif(id, color) {
    if (!ready) { return 0; }
    var pts = motifPoints(id);
    if (!pts.length) { return 0; }
    paintHold = PAINT_HOLD;
    var c = color || currentColor;
    for (var i = 0; i < pts.length; i++) {
      splatDye(dyeX(pts[i][0], pts[i][1]),
               LAMP_C.v + pts[i][1] * LAMP_HH, c, BRUSH.line.radius / 100.0);
    }
    return pts.length;
  }

  /* 固色：把当前活层烙进固定层，再清空活层。
     固定层不参与流体求解，所以它在点亮后被烛火对流搅动时也绝不再动 ——
     用户按下「固色」，那一层就一定能保住（工艺上等于「这层干透了」）。
     之后继续落笔就是新的一层，于是可以分层积染。 */
  function fixDye() {
    if (!ready || !dyeFixed) { return false; }
    programs.add.bind();
    gl.uniform1i(programs.add.uniforms.uBase, dyeFixed.read.attach(0));
    gl.uniform1i(programs.add.uniforms.uAdd, dye.read.attach(1));
    blitFn(dyeFixed.write); dyeFixed.swap();

    programs.clear.bind();
    gl.uniform1i(programs.clear.uniforms.uTexture, dye.read.attach(0));
    gl.uniform1f(programs.clear.uniforms.value, 0.0);
    blitFn(dye.write); dye.swap();
    return true;
  }

  /* ============================================================
     确定性运动（全部只是 elapsed time 的函数，零随机）
     ============================================================ */
  function updateLit(dt) {
    if (litLevel === litTarget) { litFlash = 0; return; }
    litT += dt;
    var dur = litTarget === 1 ? LIT_DUR_ON : LIT_DUR_OFF;
    var p = Math.min(1, litT / dur);
    var e = litTarget === 1 ? 1 - Math.pow(1 - p, 3) : 1 - Math.pow(1 - p, 2);
    litLevel = litFrom + (litTarget - litFrom) * e;
    litFlash = litTarget === 1 ? Math.exp(-litT * 5.0) * 0.55 * (1 - p) : 0;
    if (p >= 1) { litLevel = litTarget; litFlash = 0; }
  }

  function updateShape(dt) {
    if (shapeT >= 1) return;
    shapeT = Math.min(1, shapeT + dt / SHAPE_DUR);
    var e = 1 - Math.pow(1 - shapeT, 3);
    for (var i = 0; i < 4; i++) shapeW[i] = shapeFrom[i] + (shapeTo[i] - shapeFrom[i]) * e;
  }

  /* 灯体自转：角度 = 累计 dt × ROT_SPEED，取模到 [0, 2π) 使浮点不发散。
     落笔中（painting）或刚收笔（paintHold）时筒面静止——否则一笔会被
     抹开成一条横扫。零随机：同一 dt 序列必然得到同一角度序列。 */
  function updateRot(dt) {
    if (paintHold > 0) paintHold = Math.max(0, paintHold - dt);
    if (painting || paintHold > 0) return;
    if (!autoRotate) return;
    rotAngle += ROT_SPEED * dt;
    if (rotAngle >= TAU) rotAngle -= TAU;
  }

  /* 烛火对流：点亮后灯内热气上升，颜料在光里持续流变。
     三个相位固定的正弦单元，零随机、连续无跳变。 */
  function convection(t) {
    for (var i = 0; i < 3; i++) {
      var ph = t * 0.52 + i * 2.0943951;
      var x = LAMP_C.u + Math.sin(ph) * LAMP_HW * 0.55;
      var y = LAMP_C.v + Math.sin(ph * 0.77 + 1.0471975) * LAMP_HH * 0.62;
      splatVelocity(x, y,
                    Math.cos(ph * 1.7) * config.CONVECT_FORCE * 0.6,
                    config.CONVECT_FORCE);
    }
  }

  /* ============================================================
     public API (window.YDEngine)
     ============================================================ */
  var Engine = {
    config: config,
    ok: false,

    /* 灯几何常量（scene.js 摆放骨架 / 命中判定用；与着色器同源同值） */
    LAMP_C: LAMP_C,
    LAMP_HW: LAMP_HW,
    LAMP_HH: LAMP_HH,
    PIXEL_BLOCK: PIXEL_BLOCK,
    ROT_SPEED: ROT_SPEED,   // 自转速度（弧度/秒）：UI 文案「约 18 秒一周」可直接引用

    /* 初始化 GL 上下文 + programs + framebuffers。
       返回 false = 此设备不支持 WebGL 浮点渲染 → main.js 显示兜底文案。 */
    init: function (c) {
      canvas = c;
      resizeCanvas();
      var ctx = getWebGLContext(canvas);
      if (!ctx || !ctx.ext.formatRGBA) { Engine.ok = false; ready = false; return false; }
      gl = ctx.gl; ext = ctx.ext; ext.isWebGL2 = ctx.isWebGL2;

      var baseVertex = compileShader(gl.VERTEX_SHADER, baseVertexSrc);
      var postVertex = compileShader(gl.VERTEX_SHADER, postVertexSrc);
      programs.clear = new Program(baseVertex, clearFrag);
      programs.add = new Program(baseVertex, addFrag);
      programs.splat = new Program(baseVertex, splatFrag);
      programs.advection = new Program(baseVertex, advectionFrag, ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']);
      programs.divergence = new Program(baseVertex, divergenceFrag);
      programs.curl = new Program(baseVertex, curlFrag);
      programs.vorticity = new Program(baseVertex, vorticityFrag);
      programs.pressure = new Program(baseVertex, pressureFrag);
      programs.gradient = new Program(baseVertex, gradientFrag);
      programs.bright = new Program(postVertex, brightFrag);
      programs.blur = new Program(postVertex, blurFrag);
      programs.display = new Program(baseVertex, displayFrag);

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

    /* 视口变化：canvas 尺寸 + 像素块 uv + FBO 重建（resize 事件里调用）。
       重建时必须 preserve=true 把已画的灯面搬过去，否则画到一半视口一变就清空。 */
    resize: function () {
      if (!ready) return false;
      if (resizeCanvas()) { initFramebuffers(true); return true; }
      return false;
    },

    /* 重画：清空颜料场与流速场（原型「重画」按钮的行为；
       熄灭请另行调用 setLit(false)） */
    reset: function () {
      if (!ready) return;
      initFramebuffers();
    },

    /* 选灯色：rgb 为 0..1 归一化色（YDData.hexToRgb(hex) 的返回值）。
       COLOR_INTENSITY 由引擎内部施加，与原型 selectColor 等价。 */
    setColor: function (rgb) {
      currentColor = { r: rgb.r * config.COLOR_INTENSITY,
                       g: rgb.g * config.COLOR_INTENSITY,
                       b: rgb.b * config.COLOR_INTENSITY };
    },

    /* 命中判定：uv 是否落在灯面矩形内（原型 onLamp，pointerdown 前置判定） */
    onLamp: function (uv) {
      return Math.abs(uv.x - LAMP_C.u) <= LAMP_HW * 1.02 &&
             Math.abs(uv.y - LAMP_C.v) <= LAMP_HH * 1.02;
    },

    /* 把 uv 夹到灯面矩形内（原型 pointermove 的 clamp，笔触不外溢） */
    clampToLamp: function (uv) {
      return {
        x: Math.max(LAMP_C.u - LAMP_HW, Math.min(LAMP_C.u + LAMP_HW, uv.x)),
        y: Math.max(LAMP_C.v - LAMP_HH, Math.min(LAMP_C.v + LAMP_HH, uv.y))
      };
    },

    /* 单点绘纹：注入颜料 + （有位移时）流速 */
    splat: function (x, y, dx, dy) {
      if (!ready) return;
      paint(x, y, dx || 0, dy || 0);
    },

    splatMotif: splatMotif,
    fixDye: fixDye,
    motifIds: function () { return ['moon', 'gui', 'tu', 'yun', 'huaniao']; },

    /* 一笔绘纹：沿折线补两笔，笔触不断线（原型 pointermove 的三段 splat） */
    stroke: function (x0, y0, x1, y1) {
      if (!ready) return;
      var dx = x1 - x0, dy = y1 - y0;
      paint(x0 + dx * 0.33, y0 + dy * 0.33, dx * 0.33, dy * 0.33);
      paint(x0 + dx * 0.66, y0 + dy * 0.66, dx * 0.33, dy * 0.33);
      paint(x1, y1, dx * 0.34, dy * 0.34);
    },

    /* 灯形：index 0 圆 / 1 方 / 2 六角 / 3 莲花（对应 YDData.SHAPES[].sdfIndex）。
       启动四个 SDF 权重的形变过渡（0.45s，三次缓出）。 */
    setShape: function (index) {
      shapeIndex = index;
      shapeFrom = shapeW.slice();
      shapeTo = [0, 0, 0, 0];
      shapeTo[index] = 1;
      shapeT = 0;
    },

    /* 笔法：'line' 勾线（细、几乎不搅动）/ 'wash' 晕染（粗、强搅动）。
       未知值退回勾线——宁可让纹样定住，也不要误用强搅动把形冲掉。 */
    setBrush: function (mode) {
      brush = BRUSH[mode] ? mode : 'line';
      return brush;
    },

    /* 点亮 / 熄灭：启动固定排程的点亮过渡（1.15s 点亮 / 0.70s 熄灭 + 火苗一闪）。
       注意：舞台的 is-lit 类（§9.2 背景灯齐明）由 main.js 自行切换，引擎不碰 DOM。 */
    setLit: function (on) {
      litTarget = on ? 1 : 0;
      litFrom = litLevel;
      litT = 0;
    },

    /* 月相明度 0..1 → uMoon（取 YDData.PHASES[].moon，原型锁定值） */
    setMoon: function (bright) {
      moonBright = bright;
    },

    /* ---------- 灯体自转（3D 模型展示式的旋转，非拖动驱动） ----------
       供 main.js 接「开关」用，三个方法即可，无需知道着色器细节：

       setAutoRotate(on)   → boolean  开/关连续自转（固定 ROT_SPEED 弧度/秒）。
                                      默认 false：用户要的是「可选择的」旋转。
       setRotation(rad)    → number   直接把转角设到某个弧度（取模到 [0,2π)），
                                      用于摆拍/复位；返回归一后的角度。
       getRotation()       → number   只读取当前转角（弧度，[0,2π)）。
       setPainting(active) → boolean  落笔期间挂起自转（可选：main.js 在
                                      pointerdown/up 各调一次即可让整笔期间
                                      筒面完全静止）。不调也安全——paint()
                                      自带 PAINT_HOLD 秒的静止宽限。

       旋转只由 update(dt) 推进（main.js 的唯一 rAF），引擎不自建循环；
       角度只是累计 dt × ROT_SPEED 的函数，零随机。 */
    setAutoRotate: function (on) {
      autoRotate = !!on;
      return autoRotate;
    },

    setRotation: function (rad) {
      rotAngle = ((rad % TAU) + TAU) % TAU;
      return rotAngle;
    },

    getRotation: function () {
      return rotAngle;
    },

    setPainting: function (active) {
      painting = !!active;
      if (!painting) paintHold = PAINT_HOLD;
      return painting;
    },

    /* 推进模拟：点亮/灯形过渡 + 烛火对流 + 流体一步 + 泛光两趟（不含显示层） */
    simulate: function (dt) {
      if (!ready) return;
      dt = Math.min(dt, 1 / 60);
      time += dt;
      updateLit(dt);
      updateShape(dt);
      updateRot(dt);
      if (litLevel > 0.001) convection(time);
      step(dt);
      renderBloom();
    },

    /* 显示层：把透光结果画到画布（灯形外 alpha=0） */
    render: function () {
      renderDisplay();
    },

    /* 每帧的唯一调用：simulate(dt) + render()（对应原型 frame() 的主体） */
    update: function (dt) {
      if (!ready) return;
      Engine.simulate(dt);
      renderDisplay();
    },

    /* 灯几何（uv）与 CSS 像素换算（骨架 --cx/--cy/--hw/--hh 由 main.js 写入） */
    geometry: function () {
      return { cx: LAMP_C.u, cy: LAMP_C.v, hw: LAMP_HW, hh: LAMP_HH, pixelBlock: PIXEL_BLOCK };
    },
    geometryCss: function (stageWidth, stageHeight) {
      var w = Math.max(1, stageWidth), h = Math.max(1, stageHeight);
      return {
        cx: LAMP_C.u * w,
        cy: (1 - LAMP_C.v) * h,
        hw: LAMP_HW * w,
        hh: LAMP_HH * h,
        pixU: PIXEL_BLOCK / w,
        pixV: PIXEL_BLOCK / h
      };
    },

    /* 状态快照（UI 同步 / QA 用；只读） */
    state: function () {
      return {
        lit: litTarget, litLevel: litLevel, shape: shapeIndex,
        shapeW: shapeW.slice(), moon: moonBright, time: time, brush: brush,
        rotation: rotAngle, autoRotate: autoRotate, painting: painting,
        glLost: gl ? gl.isContextLost() : true
      };
    },

    /* 灯面矩形内的像素统计（只读探针；用于核对 §9.1 锁定的点亮指标） */
    lampPixels: function () {
      if (!ready) return null;
      var w = canvas.width, h = canvas.height;
      var x0 = Math.max(0, Math.floor((LAMP_C.u - LAMP_HW * 0.62) * w));
      var x1 = Math.min(w, Math.ceil((LAMP_C.u + LAMP_HW * 0.62) * w));
      var y0 = Math.max(0, Math.floor((LAMP_C.v - LAMP_HH * 0.62) * h));
      var y1 = Math.min(h, Math.ceil((LAMP_C.v + LAMP_HH * 0.62) * h));
      var rw = x1 - x0, rh = y1 - y0;
      if (rw <= 0 || rh <= 0) return null;
      var buf = new Uint8Array(rw * rh * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(x0, y0, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      var sum = 0, chromaHits = 0, brightHits = 0, aSum = 0;
      var n = rw * rh;
      for (var i = 0; i < buf.length; i += 4) {
        var r = buf[i], g = buf[i + 1], b = buf[i + 2], a = buf[i + 3];
        var mx = Math.max(r, g, b), mn2 = Math.min(r, g, b);
        sum += (r + g + b) / 3;
        aSum += a;
        if (a > 40 && mx - mn2 > 18) chromaHits++;
        if ((r + g + b) / 3 > 150) brightHits++;
      }
      return { luma: sum / n, alpha: aSum / n,
               chromaPixels: chromaHits, brightPixels: brightHits, total: n };
    },

    canvasSize: function () {
      return canvas ? { width: canvas.width, height: canvas.height } : { width: 0, height: 0 };
    }
  };

  window.YDEngine = Engine;
})();
