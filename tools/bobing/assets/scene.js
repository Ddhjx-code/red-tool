'use strict';

/* ====================== view geometry ====================== */
const glc = document.getElementById('gl');
const cvc = document.getElementById('cv');
const ctx2 = cvc.getContext('2d');
const stage = document.getElementById('stage');

const V = {
  vw:0, vh:0, dpr:1,
  safe:{ x:0, y:0, w:0, h:0 },
  bowl:{ cx:0, cy:0, rx:0, ry:0, rxI:0, ryI:0, rw:0, depth:0, Rf:0 },
  cam:{ a:0, sinA:0, cosA:0 },
  moon:{ x:0, y:0, r:0 },
  bowlUV:[0,0,0,0], moonUV:[0,0], moonRUv:0,
};

function layout(){
  const vw = window.innerWidth, vh = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  V.vw = vw; V.vh = vh; V.dpr = dpr;

  /* largest 4:5 rect that fits the viewport — poster-safe composition */
  let w = vw, h = vw * 5 / 4;
  if (h > vh){ h = vh; w = vh * 4 / 5; }
  V.safe = { x:(vw - w)/2, y:(vh - h)/2, w, h };

  stage.style.left   = V.safe.x + 'px';
  stage.style.top    = V.safe.y + 'px';
  stage.style.width  = w + 'px';
  stage.style.height = h + 'px';

  const s = V.safe;
  /* bowl on the central axis */
  const rx = s.w * 0.268;
  const ry = rx * 0.56;
  V.cam.a = Math.asin(0.56); V.cam.sinA = 0.56; V.cam.cosA = Math.cos(V.cam.a);
  const thick = rx * 0.072;
  V.bowl = {
    cx: s.x + s.w * 0.5, cy: s.y + s.h * 0.625,
    rx, ry,
    rxI: rx - thick, ryI: ry - thick * 0.56,
    rw: (rx - thick) * 0.985,
    depth: rx * 0.66,
    Rf: (rx - thick) * 0.74,
  };
  /* moon on the axis, far distance (三远法: far = moon + haze) */
  V.moon = { x: s.x + s.w * 0.5, y: s.y + s.h * 0.135, r: s.w * 0.072 };

  V.bowlUV  = [ V.bowl.cx/vw, 1 - V.bowl.cy/vh, V.bowl.rw/vw, V.bowl.rw/vh ];
  V.moonUV  = [ V.moon.x/vw, 1 - V.moon.y/vh ];
  V.moonRUv = V.moon.r / vw;

  glc.width  = Math.max(1, Math.floor(vw * dpr));
  glc.height = Math.max(1, Math.floor(vh * dpr));
  cvc.width  = glc.width; cvc.height = glc.height;
  cvc.style.width = vw + 'px'; cvc.style.height = vh + 'px';
}
layout();

/* ===================== WebGL2 bootstrap ===================== */
const gl = glc.getContext('webgl2', {
  alpha:false, depth:false, stencil:false, antialias:false,
  preserveDrawingBuffer:true, powerPreference:'high-performance',
});
if (!gl){ document.getElementById('err').style.display = 'flex'; throw new Error('WebGL2 unavailable'); }
gl.getExtension('EXT_color_buffer_float');
gl.getExtension('OES_texture_float_linear');
gl.clearColor(0,0,0,1);

function supFmt(internal, format, type){
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, 4, 4, 0, format, type, null);
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(f); gl.deleteTexture(t);
  return ok;
}
function pickFmt(internal, format, type){
  if (supFmt(internal, format, type)) return { internalFormat:internal, format };
  if (internal === gl.R16F)  return pickFmt(gl.RG16F,  gl.RG,   type);
  if (internal === gl.RG16F) return pickFmt(gl.RGBA16F, gl.RGBA, type);
  return { internalFormat:gl.RGBA16F, format:gl.RGBA };
}
/* 能力底线: 流体管线硬性依赖半精度浮点 FBO; 全无支持时显式报错, 不渲染残缺流体 */
const floatOK = supFmt(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT)
  || supFmt(gl.RG16F, gl.RG, gl.HALF_FLOAT)
  || supFmt(gl.R16F, gl.RED, gl.HALF_FLOAT);
if (!floatOK){
  const err = document.getElementById('err');
  err.textContent = '此设备不支持半精度浮点帧缓冲，无法渲染墨金夜宴流体效果。';
  err.style.display = 'flex';
  throw new Error('half-float framebuffer unavailable');
}
const F_RGBA = pickFmt(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
const F_RG   = pickFmt(gl.RG16F,   gl.RG,   gl.HALF_FLOAT);
const F_R    = pickFmt(gl.R16F,    gl.RED,  gl.HALF_FLOAT);

/* ====================== shader helpers ====================== */
function sh(type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('shader:', gl.getShaderInfoLog(s), src);
  return s;
}
function prog(vsSrc, fsSrc, tfVaryings, attribs){
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
  if (attribs) attribs.forEach((n,i) => gl.bindAttribLocation(p, i, n));
  if (tfVaryings) gl.transformFeedbackVaryings(p, tfVaryings, gl.INTERLEAVED_BUFFER);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error('link:', gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++){ const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
  return { p, u, bind(){ gl.useProgram(p); } };
}

/* ---------- shared GLSL chunks ---------- */
const NOISE = `
float h11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i), b = h21(i + vec2(1.0,0.0)), c = h21(i + vec2(0.0,1.0)), d = h21(i + vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.07; a *= 0.5; }
  return s;
}
/* divergence-free curl of a scalar noise potential */
vec2 curlN(vec2 p, float t){
  float e = 0.11;
  vec2 q = p + vec2(t);
  float n1 = vn(q + vec2(0.0, e)), n2 = vn(q - vec2(0.0, e));
  float n3 = vn(q + vec2(e, 0.0)), n4 = vn(q - vec2(e, 0.0));
  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
}
`;

const SKY = `
uniform vec2  uMoon;
uniform float uMoonR;
uniform float uAspect;
uniform vec3  uNightOuter;
uniform vec3  uNightInner;
uniform float uLift;          /* 结尾即峰值: the reveal LIFTS the night, it never lowers it */
vec3 nightSky(vec2 uv){
  vec2 p = uv - 0.5; p.x *= uAspect;
  float g = smoothstep(0.98, 0.06, length(p));
  vec3 n = mix(uNightOuter, uNightInner, g);
  n += vec3(0.011,0.013,0.022) * smoothstep(0.85,0.28,abs(uv.y - 0.44));
  vec2 mp = uv - uMoon; mp.x *= uAspect;
  float md = length(mp);
  float mr2 = uMoonR * uMoonR;
  n += vec3(0.082,0.102,0.112) * exp(-md*md/(mr2*8.0)) * 0.60;
  n += vec3(0.135,0.170,0.180) * exp(-md*md/(mr2*1.8)) * 0.52;
  /* reveal: raise the 玄青 gradient toward #1F2233 and swell the moon halo */
  n *= 1.0 + uLift * 1.55;
  n += vec3(0.058,0.072,0.096) * uLift * exp(-md*md/(mr2*9.0));
  return n;
}
float moonDisc(vec2 uv){
  vec2 mp = uv - uMoon; mp.x *= uAspect;
  return smoothstep(uMoonR, uMoonR * 0.90, length(mp));
}
vec3 moonColor(vec2 uv){
  vec2 mp = (uv - uMoon) / uMoonR; mp.x *= uAspect;
  float maria = 0.50 * smoothstep(0.30,0.0,length(mp - vec2(-0.22, 0.18)))
              + 0.40 * smoothstep(0.24,0.0,length(mp - vec2( 0.28,-0.10)))
              + 0.35 * smoothstep(0.18,0.0,length(mp - vec2( 0.05,-0.35)));
  return vec3(0.86,0.93,0.95) * (1.0 - 0.17 * maria);
}
vec3 nightFull(vec2 uv){ return mix(nightSky(uv), moonColor(uv), moonDisc(uv)); }
`;

const QUAD_VS = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv;
varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform vec2 texelSize;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/* ======================= programs ======================= */

/* --- L1 base: night gradient + Beer-Lambert ink + moon --- */
const baseProg = prog(QUAD_VS, `
precision highp float;
varying vec2 vUv;
${NOISE}
${SKY}
uniform sampler2D uInk;
uniform vec2 uInkTexel;
uniform vec3 uAbsorb;
void main(){
  vec3 sky = nightSky(vUv);

  /* Beer-Lambert ink compositing: pigment stored as OPTICAL DENSITY,
     transmittance T = exp(-density). Overlapping strokes add density
     (multiply transmittance) so the night never clips to dead black. */
  vec3 den = texture2D(uInk, vUv).rgb;
  vec3 gx = texture2D(uInk, vUv + vec2(uInkTexel.x,0.0)).rgb - texture2D(uInk, vUv - vec2(uInkTexel.x,0.0)).rgb;
  vec3 gy = texture2D(uInk, vUv + vec2(0.0,uInkTexel.y)).rgb - texture2D(uInk, vUv - vec2(0.0,uInkTexel.y)).rgb;
  float grad = length(vec2(length(gx), length(gy))) * 9.0;
  /* ink edge darkening — fake drying rim, the watercolor signature */
  vec3 absorb = uAbsorb * (1.0 + 1.35 * grad);
  vec3 T = exp(-den * absorb);
  sky = sky * T + vec3(0.030,0.040,0.068) * (1.0 - T) * 0.60;

  vec3 col = mix(sky, moonColor(vUv), moonDisc(vUv));
  gl_FragColor = vec4(col, 1.0);
}
`, null, ['aPosition']);

/* --- god-ray pass 1: occlusion texture (small) --- */
const occProg = prog(QUAD_VS, `
precision highp float;
varying vec2 vUv;
${NOISE}
uniform vec2 uMoon; uniform float uMoonR; uniform float uAspect; uniform float uTime;
void main(){
  vec2 mp = vUv - uMoon; mp.x *= uAspect;
  float md = length(mp);
  float disc = smoothstep(uMoonR * 1.06, uMoonR * 0.88, md);
  float halo = exp(-md*md/(uMoonR*uMoonR*5.5)) * 0.62;
  /* cloud haze bands act as the occluders that carve the shafts */
  float cloud = fbm(vUv * vec2(3.4,2.1) + vec2(uTime * 0.013, uTime * 0.007));
  float open  = 1.0 - smoothstep(0.34, 0.76, cloud);
  /* per-ray variance: angular noise gives every shaft its own length and opacity,
     so this reads as scattering rather than a stamped radial texture */
  float ang = atan(mp.y, mp.x);
  float rayVar = 0.42 + 1.45 * fbm(vec2(ang * 2.7, uTime * 0.020) * 3.2);
  /* true radial falloff: shafts die off away from the moon */
  float falloff = exp(-md * 1.35);
  float occ = open * rayVar * falloff * (disc * 1.7 + halo + 0.05);
  gl_FragColor = vec4(vec3(occ), 1.0);
}
`, null, ['aPosition']);

/* --- god-ray pass 2: radial blur toward the light centre --- */
const rayProg = prog(QUAD_VS, `
precision highp float;
varying vec2 vUv;
${NOISE}
uniform sampler2D uTex;
uniform vec2 uLight;
uniform float uDecay;
uniform float uGain;
uniform float uAspect;
void main(){
  vec2 d = vUv - uLight; d.x *= uAspect;
  float dist = length(d);
  vec2 st = (vUv - uLight) / 64.0;   /* numSamples = 64 (<= 100) */
  vec2 uv = vUv;
  float acc = 0.0, w = 1.0;
  for (int i = 0; i < 64; i++){
    acc += texture2D(uTex, uv).r * w;
    uv -= st;
    w *= uDecay;
  }
  float v = acc * uGain / 64.0;
  /* seeded per-ray opacity variance + scattering falloff along the shaft */
  v *= 0.50 + 1.00 * h11(atan(d.y, d.x) * 57.0);
  v *= exp(-dist * 1.15);
  gl_FragColor = vec4(vec3(v), 1.0);
}
`, null, ['aPosition']);

/* --- god-ray pass 3: additive blend --- */
const rayAddProg = prog(QUAD_VS, `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uDensity;   /* 0.010 idle -> 0.018 on throw, then decay */
uniform float uGain;
uniform vec3  uTint;
void main(){
  float v = texture2D(uTex, vUv).r;
  vec3 c = v * uTint * uDensity * uGain;
  gl_FragColor = vec4(c, 1.0);
}
`, null, ['aPosition']);

/* --- fluid: ambient divergence-free curl-noise forcing --- */
const forceProg = prog(QUAD_VS, `
precision highp float;
varying vec2 vUv;
${NOISE}
uniform sampler2D uVelocity;
uniform float uTime; uniform float uDt; uniform float uAmp;
void main(){
  vec2 c = curlN(vUv * 2.8, uTime * 0.045);
  vec2 v = texture2D(uVelocity, vUv).xy;
  gl_FragColor = vec4(v + c * uAmp * uDt, 0.0, 1.0);
}
`, null, ['aPosition']);

/* --- fluid: velocity splat (dice impact) --- */
const splatProg = prog(QUAD_VS, `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;
void main(){
  vec2 p = vUv - point.xy; p.x *= aspectRatio;
  vec3 splat = exp(-dot(p,p) / radius) * color;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
}
`, null, ['aPosition']);

/* --- fluid: divergence / curl / vorticity / pressure / gradient --- */
const divProg = prog(QUAD_VS, `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
uniform sampler2D uVelocity;
void main(){
  float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
  vec2 Cm = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -Cm.x;
  if (vR.x > 1.0) R = -Cm.x;
  if (vT.y > 1.0) T = -Cm.y;
  if (vB.y < 0.0) B = -Cm.y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}
`, null, ['aPosition']);

const curlProg = prog(QUAD_VS, `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
uniform sampler2D uVelocity;
void main(){
  float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}
`, null, ['aPosition']);

const vortProg = prog(QUAD_VS, `
precision highp float; precision highp sampler2D;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform sampler2D uVelocity; uniform sampler2D uCurl;
uniform float curl; uniform float dt;
void main(){
  float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x;
  float Cm = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * Cm;
  force.y *= -1.0;
  vec2 v = texture2D(uVelocity, vUv).xy + force * dt;
  gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}
`, null, ['aPosition']);

const pressProg = prog(QUAD_VS, `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main(){
  float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
  float d = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
}
`, null, ['aPosition']);

const gradProg = prog(QUAD_VS, `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main(){
  float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
  vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`, null, ['aPosition']);

const advectVelProg = prog(QUAD_VS, `
precision highp float; precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 texelSize; uniform float dt; uniform float dissipation;
void main(){
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  gl_FragColor = texture2D(uVelocity, coord) / (1.0 + dissipation * dt);
}
`, null, ['aPosition']);

const clearProg = prog(QUAD_VS, `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv;
uniform sampler2D uTexture; uniform float value;
void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }
`, null, ['aPosition']);

/* --- ink injection. INK IS ADDITIVE: blend ONE,ONE (see draw calls) --- */
const inkSplatProg = prog(QUAD_VS, `
precision highp float;
varying vec2 vUv;
uniform vec2 point; uniform float radius; uniform float aspectRatio;
uniform vec3 density; uniform float wet;
void main(){
  vec2 p = vUv - point.xy; p.x *= aspectRatio;
  float f = exp(-dot(p,p) / radius);
  gl_FragColor = vec4(density * f, wet * f);
}
`, null, ['aPosition']);

/* --- ink advection gated by WETNESS (a permission system) --- */
const inkAdvectProg = prog(QUAD_VS, `
precision highp float; precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uInk; uniform sampler2D uVelocity;
uniform vec2 texelSize; uniform vec2 inkTexelSize;
uniform float dt; uniform float dryTau; uniform float dissipation;
void main(){
  vec4 c = texture2D(uInk, vUv);
  float wet = c.a;

  /* wetness is a permission system: dry pigment does not move */
  vec2 vel = texture2D(uVelocity, vUv).xy;
  vel *= smoothstep(0.005, 0.2, wet);
  float mob = smoothstep(0.02, 0.45, wet);          /* scales advection + bleed */

  vec2 coord = vUv - dt * vel * texelSize * (0.6 * mob);   /* wet field advects at 0.6x flow */
  vec4 src = texture2D(uInk, coord);

  /* capillary blur to neighbours (paper wicking) */
  vec4 n = ( texture2D(uInk, vUv + vec2(inkTexelSize.x,0.0))
           + texture2D(uInk, vUv - vec2(inkTexelSize.x,0.0))
           + texture2D(uInk, vUv + vec2(0.0,inkTexelSize.y))
           + texture2D(uInk, vUv - vec2(0.0,inkTexelSize.y)) ) * 0.25;
  src.rgb = mix(src.rgb, n.rgb, 0.055 * mob);
  src.a   = mix(src.a,   n.a,   0.095 * mob);

  /* exponential drying */
  src.a *= exp(-dt / dryTau);
  src.rgb /= (1.0 + dissipation * dt);
  gl_FragColor = vec4(src.rgb, clamp(src.a, 0.0, 1.0));
}
`, null, ['aPosition']);

/* --- bowl water: explicit finite-difference wave equation ---
   h(t+1) = 2h(t) - h(t-1) + c^2 * lap(h), per-step damping.
   FIXED 256 grid (decoupled from quality tier -> wave speed is
   consistent). Previous height lives in the GREEN channel.
   3 substeps per frame. Never static: curl-noise ambient term. */
const waveProg = prog(QUAD_VS, `
precision highp float; precision highp sampler2D;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
${NOISE}
uniform sampler2D uState;
uniform vec2 texelSize;
uniform float uC2; uniform float uDamp; uniform float uTime; uniform float uAmbient;
void main(){
  float h  = texture2D(uState, vUv).x;
  float hp = texture2D(uState, vUv).y;
  float l = texture2D(uState, vL).x, r = texture2D(uState, vR).x;
  float t = texture2D(uState, vT).x, b = texture2D(uState, vB).x;
  float lap = (l + r + t + b) - 4.0 * h;
  float hn = (2.0 * h - hp + uC2 * lap) * uDamp;
  /* divergence-free curl-noise keeps the surface breathing when idle */
  vec2 cn = curlN(vUv * 2.6, uTime * 0.042);
  hn += uAmbient * (cn.x + cn.y) * 0.035;
  /* circular bowl boundary */
  hn *= smoothstep(1.02, 0.93, length((vUv - 0.5) * 2.0));
  gl_FragColor = vec4(hn, h, 0.0, 1.0);
}
`, null, ['aPosition']);

/* --- water impact injection. WATER USES MAX BLENDING (see draw call):
   overlapping crests take the max instead of summing into swamp. --- */
const waveInjectProg = prog(QUAD_VS, `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 point; uniform float radius; uniform float amp;
void main(){
  vec2 s = texture2D(uState, vUv).xy;
  vec2 p = vUv - point;
  float bump = amp * exp(-dot(p,p) / radius);
  gl_FragColor = vec4(s.x + bump, s.y, 0.0, 1.0);
}
`, null, ['aPosition']);

/* --- bowl water display: refract + specular + Fresnel + tone --- */
const waterProg = prog(QUAD_VS, `
precision highp float; precision highp sampler2D;
varying vec2 vUv;
${NOISE}
${SKY}
uniform sampler2D uState;
uniform sampler2D uInk;
uniform vec4 uBowl;        /* cx, cy, rx, ry in uv */
uniform float uTime;
uniform float uRefract;
void main(){
  vec2 p = (vUv - uBowl.xy) / uBowl.zw;
  float rr = length(p);
  if (rr > 1.0) discard;
  vec2 wuv = p * 0.5 + 0.5;

  float e = 1.0 / 256.0;
  float hl = texture2D(uState, wuv - vec2(e,0.0)).x;
  float hr = texture2D(uState, wuv + vec2(e,0.0)).x;
  float hb = texture2D(uState, wuv - vec2(0.0,e)).x;
  float ht = texture2D(uState, wuv + vec2(0.0,e)).x;
  vec3 n = normalize(vec3(-(hr - hl) * uRefract, -(ht - hb) * uRefract, 1.0));

  /* refract the night sky through the height-field gradient */
  vec3 bg = nightFull(vUv + n.xy * 0.030);

  /* porcelain cavity: deep celadon-ink water, lifted so it never reads as a flat fill */
  float fade = smoothstep(1.0, 0.05, rr);
  vec3 waterBase = mix(vec3(0.046,0.072,0.098), vec3(0.088,0.136,0.172), fade);
  vec3 col = mix(bg, waterBase, 0.66);

  /* moon reflection pooling on the water — 碗内水面会呼吸: visibly alive */
  vec2 mdir = normalize(uMoon - uBowl.xy + vec2(0.0001));
  float mprox = exp(-dot(p - mdir * 0.34, p - mdir * 0.34) * 3.4);
  float breath = 0.62 + 0.30 * sin(uTime * 1.15 + p.x * 4.0) + 0.75 * abs(ht - hb) * 40.0;
  col += vec3(0.30,0.38,0.40) * mprox * breath * (1.0 + uLift * 0.9);

  /* slow caustic shimmer so the surface never reads as a still photo */
  float ca = vn(wuv * 7.0 + vec2(uTime * 0.07, uTime * 0.05));
  col += vec3(0.046,0.062,0.078) * ca * fade;

  /* Fresnel from the derived normal */
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
  col += vec3(0.095,0.125,0.135) * fres * 0.60;

  /* 描金 rim catch */
  float rim = smoothstep(0.66, 1.0, rr);
  col += vec3(0.40,0.33,0.16) * rim * (0.22 + 0.40 * fres);

  /* 墨晕 reflected in the water, Beer-Lambert */
  vec3 den = texture2D(uInk, vUv).rgb;
  col *= exp(-den * vec3(1.5,1.8,2.3));

  gl_FragColor = vec4(col, smoothstep(1.0, 0.93, rr));
}
`, null, ['aPosition']);

/* --- water specular highlights, MAX blended over the scene --- */
const waterSpecProg = prog(QUAD_VS, `
precision highp float; precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec4 uBowl;
uniform vec2 uMoon;
uniform float uRefract; uniform float uBoost;
void main(){
  vec2 p = (vUv - uBowl.xy) / uBowl.zw;
  float rr = length(p);
  if (rr > 1.0) discard;
  vec2 wuv = p * 0.5 + 0.5;
  float e = 1.0 / 256.0;
  float hl = texture2D(uState, wuv - vec2(e,0.0)).x;
  float hr = texture2D(uState, wuv + vec2(e,0.0)).x;
  float hb = texture2D(uState, wuv - vec2(0.0,e)).x;
  float ht = texture2D(uState, wuv + vec2(0.0,e)).x;
  float h  = texture2D(uState, wuv).x;
  vec3 n = normalize(vec3(-(hr - hl) * uRefract, -(ht - hb) * uRefract, 1.0));

  /* moonlight direction (light is above and behind the moon) */
  vec2 sd = normalize(uMoon - uBowl.xy + vec2(0.0001));
  vec3 L = normalize(vec3(sd.x * 0.42, sd.y * 0.42, 0.90));
  vec3 H = normalize(L + vec3(0.0,0.0,1.0));
  float ndh = max(dot(n, H), 0.0);

  float crest = smoothstep(0.00025, 0.0055, abs(h));
  float spec  = pow(ndh, 260.0) * 1.85 + pow(ndh, 54.0) * 0.30;
  spec *= (0.28 + 0.95 * crest);
  float rimSpec = pow(ndh, 110.0) * 0.55 * smoothstep(0.58, 1.0, rr);

  vec3 c = vec3(0.84,0.93,0.95) * spec + vec3(0.77,0.64,0.33) * rimSpec;
  float a = smoothstep(1.0, 0.93, rr);
  gl_FragColor = vec4(c * a * uBoost, a);
}
`, null, ['aPosition']);

/* --- 桂花金粉 particles: transform feedback (GPU only, no CPU update) --- */
const PART_COUNT = REDUCED ? 5000 : 12000;
const PART_STRIDE = 8;   /* pos.xy, vel.xy, age, life, sizeSeed, idSeed */

const partUpdateProg = prog(`#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aVel;
layout(location=2) in float aAge;
layout(location=3) in float aLife;
layout(location=4) in float aSizeSeed;
layout(location=5) in float aIdSeed;
out vec2 vPos; out vec2 vVel; out float vAge; out float vLife; out float vSizeSeed; out float vIdSeed;
${NOISE}
uniform float uDt; uniform float uTime; uniform float uBurstReset; uniform float uReduced;
uniform vec2 uBurst;
uniform sampler2D uFlow;
void main(){
  float age = aAge + uDt;
  vec2 pos = aPos;
  vec2 vel = aVel;
  bool foil = aIdSeed > 0.855;

  if (uBurstReset > 0.5 && foil){
    /* gold-foil burst (状元): radial ejection from the bowl */
    age = 0.0;
    float ang = h11(aIdSeed * 91.7) * 6.2831853;
    float sp  = 0.34 + 1.05 * h11(aIdSeed * 37.3);
    pos = uBurst + vec2(cos(ang), sin(ang)) * 0.014;
    vel = vec2(cos(ang), sin(ang)) * sp;
  } else if (age >= aLife){
    /* deterministic respawn: position derives only from the fixed idSeed */
    age = 0.0;
    float s1 = h11(aIdSeed * 13.11), s2 = h11(aIdSeed * 57.77);
    pos = vec2(s1 * 2.0 - 1.0, 1.03 - s2 * 0.18);
    vel = vec2((h11(aIdSeed * 23.3) - 0.5) * 0.05, -0.018 - 0.030 * s2);
  }

  /* integrate against the coarse velocity texture + curl-noise drift */
  vec2 flow = texture(uFlow, pos * 0.5 + 0.5).xy * 0.0011;
  vec2 cn = curlN(pos * 1.9 + vec2(0.0, uTime * 0.02), uTime * 0.05);
  vel += (cn * 0.055 + flow) * uDt * (1.0 - 0.70 * uReduced);
  vel.y -= (foil ? 0.115 : 0.016) * uDt;
  vel *= exp(-(foil ? 1.25 : 0.55) * uDt);
  pos += vel * uDt;

  if (pos.y < -1.09 || abs(pos.x) > 1.4) age = aLife;

  vPos = pos; vVel = vel; vAge = age; vLife = aLife;
  vSizeSeed = aSizeSeed; vIdSeed = aIdSeed;
  gl_Position = vec4(0.0);
}
`, `#version 300 es
precision mediump float;
void main(){}
`, ['vPos','vVel','vAge','vLife','vSizeSeed','vIdSeed'],
   ['aPos','aVel','aAge','aLife','aSizeSeed','aIdSeed']);

const partRenderProg = prog(`#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aVel;
layout(location=2) in float aAge;
layout(location=3) in float aLife;
layout(location=4) in float aSizeSeed;
layout(location=5) in float aIdSeed;
uniform float uTime; uniform float uPixelRatio; uniform float uScale;
uniform sampler2D uGlow;
out float vAlpha; out float vGlow; out float vFoil; out float vFacet;
void main(){
  float t = aAge / max(aLife, 0.0001);
  vAlpha = smoothstep(0.0, 0.09, t) * (1.0 - smoothstep(0.60, 1.0, t));
  vFoil  = step(0.855, aIdSeed);
  vFacet = aIdSeed;
  /* sample the moonlight texture to inherit local colour: osmanthus
     drifting through the beam glows brighter. free depth layering. */
  vGlow = texture(uGlow, aPos * 0.5 + 0.5).r;
  float sz = 0.85 + 2.3 * aSizeSeed;
  sz *= mix(1.0, 2.9, vFoil);
  sz *= 0.78 + 0.22 * sin(uTime * 1.6 + aIdSeed * 41.0);
  gl_PointSize = sz * uPixelRatio * uScale;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`, `#version 300 es
precision highp float;
in float vAlpha; in float vGlow; in float vFoil; in float vFacet;
uniform vec3 uGoldMatte; uniform vec3 uGoldBright; uniform vec3 uMoonWhite;
uniform float uTime; uniform float uFoilAlive;
out vec4 frag;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(q, q);
  if (d2 > 1.0) discard;
  float a = exp(-d2 * 3.1);

  vec3 col = mix(uGoldMatte, uGoldBright, 0.32 + 0.68 * vGlow);
  float lum = 0.26 + 1.45 * vGlow;

  if (vFoil > 0.5){
    /* gold foil, three stacked quality layers: micro-relief facet +
       matte metal (GGX, roughness .5, metalness .9) + clearcoat glint.
       envMapIntensity 2.5; ACES + exposure applied in the composite pass. */
    float ang = vFacet * 62.83 + uTime * 2.4;
    vec3 n = normalize(vec3(cos(ang) * 0.74, sin(ang) * 0.74, 1.0));
    vec3 H = normalize(vec3(-0.34, 0.56, 1.0));
    float ndh = max(dot(n, H), 0.0);
    float r = 0.5; float a2 = r * r; a2 *= a2;
    float D = a2 / (3.14159265 * pow(ndh * ndh * (a2 - 1.0) + 1.0, 2.0));
    float coat = pow(ndh, 96.0);
    col = uGoldBright * (0.15 + 2.5 * (0.9 * D * 0.052 + coat * 0.88));
    lum = 1.0;
    a *= smoothstep(1.0, 0.12, d2);
    a *= uFoilAlive;
  }

  col = mix(col, uMoonWhite, 0.20 * vGlow);
  frag = vec4(col * lum * a, a * vAlpha);
}
`, null, ['aPos','aVel','aAge','aLife','aSizeSeed','aIdSeed']);

/* --- composite: ACES filmic + exposure 1.25 + vignette + 1/255 dither --- */
const compProg = prog(QUAD_VS, `
precision highp float;
varying vec2 vUv;
${NOISE}
uniform sampler2D uScene;
uniform float uExposure;
uniform float uLift;
vec3 aces(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main(){
  vec3 c = texture2D(uScene, vUv).rgb * uExposure;
  c = aces(c);
  vec2 p = vUv - 0.5;
  float v = pow(length(p) * 1.24, 2.4);
  /* vignette darkens toward INK-BLUE, never toward dead black, and the reveal
     inverts it — the frame opens up instead of closing in */
  float k = 0.30 - 0.36 * uLift;
  if (k >= 0.0) c = mix(c, c * vec3(0.70,0.79,0.95), k * v);
  else          c += c * (-k) * v;
  /* ordered dither, widened: THE anti-banding measure on dark 玄青 gradients */
  c += (h21(gl_FragCoord.xy) - 0.5) * (1.8 / 255.0);
  gl_FragColor = vec4(c, 1.0);
}
`, null, ['aPosition']);

/* ======================== blit ======================== */
const blit = (() => {
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, -1,1, 1,1, 1,-1]), gl.STATIC_DRAW);
  const eb = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  return (target) => {
    if (target == null){
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };
})();

/* ==================== framebuffers ==================== */
function createFBO(w, h, fmt, filter){
  gl.activeTexture(gl.TEXTURE0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internalFormat, w, h, 0, fmt.format, gl.HALF_FLOAT, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture:tex, fbo, width:w, height:h, tx:1/w, ty:1/h,
           attach(id){ gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
}
function createDoubleFBO(w, h, fmt, filter){
  let a = createFBO(w, h, fmt, filter), b = createFBO(w, h, fmt, filter);
  return { width:w, height:h, tx:1/w, ty:1/h,
    get read(){ return a; }, get write(){ return b; },
    swap(){ const t = a; a = b; b = t; } };
}
function resOf(base){
  const ar = gl.drawingBufferWidth / gl.drawingBufferHeight;
  return gl.drawingBufferWidth > gl.drawingBufferHeight
    ? { width:Math.round(base * ar), height:base }
    : { width:base, height:Math.round(base / ar) };
}

/* DUAL RESOLUTION: velocity on a coarse ~256-cell grid (the pressure
   solve is the expensive part and scales with cell count); pigment and
   wetness at near-screen resolution where edges and detail live. */
const SIM_RES = 256;
const INK_RES = 720;
const WATER_GRID = 256;     /* fixed, decoupled from quality tier */
const RAY_RES = 256;        /* occlusion texture may be smaller than screen */

let scene, ink, velocity, divergence, curl, pressure, water, occ, rayA, rayB;
function initFBOs(){
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const sim = resOf(SIM_RES), inkR = resOf(INK_RES);
  const LIN = gl.LINEAR;

  scene      = createFBO(W, H, F_RGBA, LIN);
  ink        = createDoubleFBO(inkR.width, inkR.height, F_RGBA, LIN);
  velocity   = createDoubleFBO(sim.width, sim.height, F_RG, LIN);
  divergence = createFBO(sim.width, sim.height, F_R, gl.NEAREST);
  curl       = createFBO(sim.width, sim.height, F_R, gl.NEAREST);
  pressure   = createDoubleFBO(sim.width, sim.height, F_R, gl.NEAREST);
  water      = createDoubleFBO(WATER_GRID, WATER_GRID, F_RG, LIN);
  occ        = createFBO(RAY_RES, RAY_RES, F_R, LIN);
  rayA       = createFBO(RAY_RES, RAY_RES, F_R, LIN);
  rayB       = createFBO(RAY_RES, RAY_RES, F_R, LIN);
}
initFBOs();

/* ==================== particle buffers ==================== */
const partBuf = [gl.createBuffer(), gl.createBuffer()];
const partVAO = [gl.createVertexArray(), gl.createVertexArray()];
const partTF  = gl.createTransformFeedback();
let partRead = 0;

(function initParticles(){
  const rng = mulberry32(SEED ^ 0x5EED);
  const data = new Float32Array(PART_COUNT * PART_STRIDE);
  for (let i = 0; i < PART_COUNT; i++){
    const o = i * PART_STRIDE;
    const isFoil = (i / PART_COUNT) > 0.855;
    data[o+0] = rng() * 2 - 1;                          /* pos.x */
    data[o+1] = isFoil ? -1.2 : rng() * 2 - 1;          /* pos.y */
    data[o+2] = (rng() - 0.5) * 0.05;                   /* vel.x */
    data[o+3] = -0.018 - rng() * 0.030;                 /* vel.y */
    data[o+4] = rng() * 9.0;                            /* age */
    data[o+5] = 7.0 + rng() * 9.0;                      /* lifespan */
    data[o+6] = rng();                                  /* sizeSeed */
    data[o+7] = rng();                                  /* idSeed */
  }
  const S = PART_STRIDE * 4;
  for (let k = 0; k < 2; k++){
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf[k]);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(partVAO[k]);
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf[k]);
    for (let a = 0; a < 6; a++){
      const comps = (a === 0 || a === 1) ? 2 : 1;
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, comps, gl.FLOAT, false, S, (a === 0 || a === 1) ? a * 8 : 16 + (a - 2) * 4);
    }
    gl.bindVertexArray(null);
  }
})();

/* ==================== dice model ==================== */
/* Orthographic cube projection: a rotated cube's face projects to a
   PARALLELOGRAM, so an affine transform maps the unit face square onto
   it exactly. Pips drawn in face-local space get correct foreshortening. */
const CUBE = [
  { n:[0, 1, 0], c:[[-1,1,-1],[ 1,1,-1],[ 1,1, 1],[-1,1, 1]], val:1 },
  { n:[0,-1, 0], c:[[-1,-1,1],[ 1,-1, 1],[ 1,-1,-1],[-1,-1,-1]], val:6 },
  { n:[1, 0, 0], c:[[ 1,-1,-1],[ 1,1,-1],[ 1,1, 1],[ 1,-1, 1]], val:3 },
  { n:[-1,0, 0], c:[[-1,-1,1],[-1,1, 1],[-1,1,-1],[-1,-1,-1]], val:4 },
  { n:[0, 0, 1], c:[[-1,-1,1],[ 1,-1, 1],[ 1,1, 1],[-1,1, 1]], val:2 },
  { n:[0, 0,-1], c:[[ 1,-1,-1],[-1,-1,-1],[-1,1,-1],[ 1,1,-1]], val:5 },
];
/* rotation (deg, [rx, ry, rz]) that puts each value on the up face */
const SETTLE = { 1:[0,0,0], 6:[180,0,0], 3:[0,0,-90], 4:[0,0,90], 2:[90,0,0], 5:[-90,0,0] };
const PIPS = {
  1:[[.5,.5]],
  2:[[.28,.28],[.72,.72]],
  3:[[.28,.28],[.5,.5],[.72,.72]],
  4:[[.28,.28],[.72,.28],[.28,.72],[.72,.72]],
  5:[[.28,.28],[.72,.28],[.5,.5],[.28,.72],[.72,.72]],
  6:[[.28,.24],[.72,.24],[.28,.5],[.72,.5],[.28,.76],[.72,.76]],
};
const RED_FACES = { 1:true, 4:true };       /* 红一 / 红四 */

/* scatter positions as fractions of the bowl floor ellipse */
const DICE_HOME = [
  [-0.40,-0.30], [ 0.02,-0.42], [ 0.42,-0.26],
  [-0.33, 0.22], [ 0.10, 0.34], [ 0.44, 0.16],
];

function rotMat(rx, ry, rz){
  const x = rx * Math.PI/180, y = ry * Math.PI/180, z = rz * Math.PI/180;
  const cx = Math.cos(x), sx = Math.sin(x);
  const cy = Math.cos(y), sy = Math.sin(y);
  const cz = Math.cos(z), sz = Math.sin(z);
  /* R = Rz * Ry * Rx */
  return [
    cz*cy,                cz*sy*sx - sz*cx,      cz*sy*cx + sz*sx,
    sz*cy,                sz*sy*sx + cz*cx,      sz*sy*cx - cz*sx,
    -sy,                  cy*sx,                 cy*cx,
  ];
}
function applyR(m, v){
  return [ m[0]*v[0] + m[1]*v[1] + m[2]*v[2],
           m[3]*v[0] + m[4]*v[1] + m[5]*v[2],
           m[6]*v[0] + m[7]*v[1] + m[8]*v[2] ];
}

const dice = [];
function buildDice(){
  const rng = mulberry32(SEED ^ 0xD1CE);
  dice.length = 0;
  for (let i = 0; i < 6; i++){
    const base = SETTLE[1];
    dice.push({
      home: DICE_HOME[i],
      yaw:  (rng() - 0.5) * 58,        /* persistent yaw so 3 faces show */
      tilt: (rng() - 0.5) * 13,
      roll: (rng() - 0.5) * 16,
      spin: [ 540 + rng() * 460, 320 + rng() * 420, 260 + rng() * 380 ],
      landDelay: i * 0.058,            /* 错峰 landing */
      val: 1,
      /* runtime */
      rx:0, ry:0, rz:0, wx:0, wy:0, wz:0, landed:false, landT:0,
    });
  }
}
buildDice();


function startThrow(forced){
  if (S.intro || S.done) return;
  if (S.phase !== PHASE.IDLE && S.phase !== PHASE.REVEAL) return;
  const values = forced || rollDice();
  S.thrown++;
  S.t = 0;
  S.phase = PHASE.THROW;
  S.result = judge(values);
  S.beam = 0.030;                       /* heavenly-light feedback */
  S.liftTarget = 0;                     /* a new throw drops the night back to idle */
  S.burstReset = 0;
  S.foilAlive = 0;

  /* CAP INK ACCUMULATION: soft-decay the ink buffer at every throw so the night
     can never progressively blacken across repeated throws */
  gl.disable(gl.BLEND);
  clearProg.bind();
  gl.uniform2f(clearProg.u.texelSize, ink.tx, ink.ty);
  gl.uniform1i(clearProg.u.uTexture, ink.read.attach(0));
  gl.uniform1f(clearProg.u.value, 0.30);
  blit(ink.write); ink.swap();

  for (let i = 0; i < 6; i++){
    const d = dice[i];
    d.val = values[i];
    const st = SETTLE[d.val];
    d.rx = st[0] + d.tilt;
    d.ry = st[1] + d.yaw;
    d.rz = st[2] + d.roll;
    d.wx = d.home[0] * V.bowl.Rf;
    d.wz = d.home[1] * V.bowl.Rf / V.cam.sinA;
    d.wy = 0;
    d.landed = false;
    d.landT = 0;
    d._spin = [ d.spin[0], d.spin[1], d.spin[2] ];
  }

  ui.hideReveal();
  ui.cta.disabled = true;
}

/* ==================== impacts ==================== */
function impact(d){
  const scrX = V.bowl.cx + d.wx;
  const scrY = V.bowl.cy + d.wz * V.cam.sinA;
  /* bowl-local water uv */
  const px = (scrX - (V.bowl.cx - V.bowl.rw)) / (2 * V.bowl.rw);
  const py = 1 - (scrY - (V.bowl.cy - V.bowl.rw * (V.bowl.rw / V.bowl.rx) / (V.bowl.rw / V.bowl.rx))) / (2 * V.bowl.rw);
  /* simpler: derive from uv space directly */
  const uvx = scrX / V.vw;
  const uvy = 1 - scrY / V.vh;
  const wu  = [ (uvx - V.bowlUV[0]) / V.bowlUV[2] * 0.5 + 0.5,
                (uvy - V.bowlUV[1]) / V.bowlUV[3] * 0.5 + 0.5 ];

  /* --- water crest injection (MAX blend) --- */
  gl.disable(gl.BLEND);
  waveInjectProg.bind();
  gl.uniform1i(waveInjectProg.u.uState, water.read.attach(0));
  gl.uniform2f(waveInjectProg.u.point, wu[0], wu[1]);
  gl.uniform1f(waveInjectProg.u.radius, 0.012);
  gl.uniform1f(waveInjectProg.u.amp, 0.055);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.blendEquation(gl.MAX);              /* WATER USES MAX BLENDING */
  blit(water.write); water.swap();
  gl.blendEquation(gl.FUNC_ADD);
  gl.disable(gl.BLEND);

  /* --- velocity splat (radial push) --- */
  const rng = mulberry32((SEED ^ 0xB0BC) + Math.round(d.landT * 1000));
  const ang = rng() * Math.PI * 2;
  splatProg.bind();
  gl.uniform1i(splatProg.u.uTarget, velocity.read.attach(0));
  gl.uniform2f(splatProg.u.texelSize, velocity.tx, velocity.ty);
  gl.uniform1f(splatProg.u.aspectRatio, V.vw / V.vh);
  gl.uniform2f(splatProg.u.point, uvx, uvy);
  gl.uniform3f(splatProg.u.color, Math.cos(ang) * 420, Math.sin(ang) * 420, 0);
  gl.uniform1f(splatProg.u.radius, 0.006);
  blit(velocity.write); velocity.swap();

  /* --- 墨晕 ink bleed. INK IS ADDITIVE. --- */
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  inkSplatProg.bind();
  gl.uniform2f(inkSplatProg.u.texelSize, ink.tx, ink.ty);
  gl.uniform1f(inkSplatProg.u.aspectRatio, V.vw / V.vh);
  gl.uniform2f(inkSplatProg.u.point, uvx, uvy);
  gl.uniform3f(inkSplatProg.u.density, 0.09, 0.11, 0.16);
  gl.uniform1f(inkSplatProg.u.wet, 0.72);
  gl.uniform1f(inkSplatProg.u.radius, 0.010);
  blit(ink.write); ink.swap();
  gl.disable(gl.BLEND);
}

/* ==================== simulation ==================== */
function stepFluid(dt){
  gl.disable(gl.BLEND);

  /* ambient divergence-free curl-noise forcing: never static */
  forceProg.bind();
  gl.uniform2f(forceProg.u.texelSize, velocity.tx, velocity.ty);
  gl.uniform1i(forceProg.u.uVelocity, velocity.read.attach(0));
  gl.uniform1f(forceProg.u.uTime, S.simT);
  gl.uniform1f(forceProg.u.uDt, dt);
  gl.uniform1f(forceProg.u.uAmp, REDUCED ? 40 : 130);
  blit(velocity.write); velocity.swap();

  curlProg.bind();
  gl.uniform2f(curlProg.u.texelSize, velocity.tx, velocity.ty);
  gl.uniform1i(curlProg.u.uVelocity, velocity.read.attach(0));
  blit(curl);

  vortProg.bind();
  gl.uniform2f(vortProg.u.texelSize, velocity.tx, velocity.ty);
  gl.uniform1i(vortProg.u.uVelocity, velocity.read.attach(0));
  gl.uniform1i(vortProg.u.uCurl, curl.attach(1));
  gl.uniform1f(vortProg.u.curl, 22);
  gl.uniform1f(vortProg.u.dt, dt);
  blit(velocity.write); velocity.swap();

  divProg.bind();
  gl.uniform2f(divProg.u.texelSize, velocity.tx, velocity.ty);
  gl.uniform1i(divProg.u.uVelocity, velocity.read.attach(0));
  blit(divergence);

  clearProg.bind();
  gl.uniform2f(clearProg.u.texelSize, pressure.tx, pressure.ty);
  gl.uniform1i(clearProg.u.uTexture, pressure.read.attach(0));
  gl.uniform1f(clearProg.u.value, 0.8);
  blit(pressure.write); pressure.swap();

  pressProg.bind();
  gl.uniform2f(pressProg.u.texelSize, velocity.tx, velocity.ty);
  gl.uniform1i(pressProg.u.uDivergence, divergence.attach(0));
  for (let i = 0; i < 18; i++){
    gl.uniform1i(pressProg.u.uPressure, pressure.read.attach(1));
    blit(pressure.write); pressure.swap();
  }

  gradProg.bind();
  gl.uniform2f(gradProg.u.texelSize, velocity.tx, velocity.ty);
  gl.uniform1i(gradProg.u.uPressure, pressure.read.attach(0));
  gl.uniform1i(gradProg.u.uVelocity, velocity.read.attach(1));
  blit(velocity.write); velocity.swap();

  advectVelProg.bind();
  gl.uniform2f(advectVelProg.u.texelSize, velocity.tx, velocity.ty);
  const vid = velocity.read.attach(0);
  gl.uniform1i(advectVelProg.u.uVelocity, vid);
  gl.uniform1f(advectVelProg.u.dt, dt);
  gl.uniform1f(advectVelProg.u.dissipation, 0.42);
  blit(velocity.write); velocity.swap();

  /* ink advection, gated by wetness */
  inkAdvectProg.bind();
  gl.uniform2f(inkAdvectProg.u.texelSize, velocity.tx, velocity.ty);
  gl.uniform2f(inkAdvectProg.u.inkTexelSize, ink.tx, ink.ty);
  gl.uniform1i(inkAdvectProg.u.uVelocity, velocity.read.attach(0));
  gl.uniform1i(inkAdvectProg.u.uInk, ink.read.attach(1));
  gl.uniform1f(inkAdvectProg.u.dt, dt);
  gl.uniform1f(inkAdvectProg.u.dryTau, 9.0);       /* dry time constant */
  gl.uniform1f(inkAdvectProg.u.dissipation, 0.34);  /* raised: bounds steady-state ink density */
  blit(ink.write); ink.swap();
}

/* ambient 墨晕 blooms, re-seeded so the night sky keeps breathing */
let inkSeedT = 0;
function ambientInk(dt){
  inkSeedT -= dt;
  if (inkSeedT > 0) return;
  inkSeedT = 6.5;
  const rng = mulberry32((SEED ^ 0x11111) + Math.round(S.simT * 10));
  const x = 0.12 + rng() * 0.76;
  const y = 0.16 + rng() * 0.62;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);                  /* ink is additive */
  inkSplatProg.bind();
  gl.uniform2f(inkSplatProg.u.texelSize, ink.tx, ink.ty);
  gl.uniform1f(inkSplatProg.u.aspectRatio, V.vw / V.vh);
  gl.uniform2f(inkSplatProg.u.point, x, y);
  gl.uniform3f(inkSplatProg.u.density, 0.14, 0.17, 0.24);
  gl.uniform1f(inkSplatProg.u.wet, 0.85);
  gl.uniform1f(inkSplatProg.u.radius, 0.028 + rng() * 0.034);
  blit(ink.write); ink.swap();
  gl.disable(gl.BLEND);
}

function stepWater(dt){
  /* 3 substeps per frame; c^2 <= 0.5 for stability */
  waveProg.bind();
  gl.uniform2f(waveProg.u.texelSize, water.tx, water.ty);
  gl.uniform1f(waveProg.u.uC2, 0.47);
  gl.uniform1f(waveProg.u.uDamp, 0.9955);
  gl.uniform1f(waveProg.u.uAmbient, REDUCED ? 0.25 : 1.0);
  for (let i = 0; i < 3; i++){
    gl.uniform1i(waveProg.u.uState, water.read.attach(0));
    gl.uniform1f(waveProg.u.uTime, S.simT + i * 0.011);
    blit(water.write); water.swap();
  }
}

/* ==================== render ==================== */
function setSkyUniforms(p){
  gl.uniform2f(p.u.uMoon, V.moonUV[0], V.moonUV[1]);
  gl.uniform1f(p.u.uMoonR, V.moonRUv);
  gl.uniform1f(p.u.uAspect, V.vw / V.vh);
  gl.uniform3f(p.u.uNightOuter, C.night1[0], C.night1[1], C.night1[2]);
  gl.uniform3f(p.u.uNightInner, C.night2[0], C.night2[1], C.night2[2]);
  gl.uniform1f(p.u.uLift, S.revealLift);
}

function renderGL(){
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;

  /* ---------- into the HDR scene buffer ---------- */
  gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
  gl.viewport(0, 0, W, H);
  gl.disable(gl.BLEND);

  /* L1 base */
  baseProg.bind();
  gl.uniform2f(baseProg.u.texelSize, ink.tx, ink.ty);
  setSkyUniforms(baseProg);
  gl.uniform1i(baseProg.u.uInk, ink.read.attach(0));
  gl.uniform2f(baseProg.u.uInkTexel, ink.tx, ink.ty);
  gl.uniform3f(baseProg.u.uAbsorb, 2.1, 2.5, 3.3);
  blit(scene);

  /* L1 volumetric moonlight: pass 1 occlusion */
  occProg.bind();
  gl.uniform2f(occProg.u.texelSize, occ.tx, occ.ty);
  gl.uniform2f(occProg.u.uMoon, V.moonUV[0], V.moonUV[1]);
  gl.uniform1f(occProg.u.uMoonR, V.moonRUv);
  gl.uniform1f(occProg.u.uAspect, V.vw / V.vh);
  gl.uniform1f(occProg.u.uTime, S.simT);
  blit(occ);

  /* pass 2 radial blur (two iterations for a smoother shaft) */
  rayProg.bind();
  gl.uniform2f(rayProg.u.texelSize, rayA.tx, rayA.ty);
  gl.uniform2f(rayProg.u.uLight, V.moonUV[0], V.moonUV[1]);
  gl.uniform1f(rayProg.u.uDecay, 0.968);
  gl.uniform1f(rayProg.u.uGain, 3.0);
  gl.uniform1f(rayProg.u.uAspect, V.vw / V.vh);
  gl.uniform1i(rayProg.u.uTex, occ.attach(0));
  blit(rayA);
  gl.uniform1i(rayProg.u.uTex, rayA.attach(0));
  gl.uniform1f(rayProg.u.uDecay, 0.974);
  blit(rayB);

  /* pass 3 additive blend */
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  rayAddProg.bind();
  gl.uniform2f(rayAddProg.u.texelSize, rayB.tx, rayB.ty);
  gl.uniform1i(rayAddProg.u.uTex, rayB.attach(0));
  gl.uniform1f(rayAddProg.u.uDensity, S.beam);
  gl.uniform1f(rayAddProg.u.uGain, 15.0);
  gl.uniform3f(rayAddProg.u.uTint, 0.62, 0.74, 0.80);
  blit(scene);
  gl.disable(gl.BLEND);

  /* ---------- L2 bowl water ---------- */
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  waterProg.bind();
  gl.uniform2f(waterProg.u.texelSize, scene.tx || 1/W, scene.ty || 1/H);
  setSkyUniforms(waterProg);
  gl.uniform1i(waterProg.u.uState, water.read.attach(0));
  gl.uniform1i(waterProg.u.uInk, ink.read.attach(1));
  gl.uniform4f(waterProg.u.uBowl, V.bowlUV[0], V.bowlUV[1], V.bowlUV[2], V.bowlUV[3]);
  gl.uniform1f(waterProg.u.uTime, S.simT);
  gl.uniform1f(waterProg.u.uRefract, 26.0);
  blit(scene);
  gl.disable(gl.BLEND);

  /* water specular — MAX blended over the scene */
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.blendEquation(gl.MAX);
  waterSpecProg.bind();
  gl.uniform2f(waterSpecProg.u.texelSize, 1/W, 1/H);
  gl.uniform1i(waterSpecProg.u.uState, water.read.attach(0));
  gl.uniform4f(waterSpecProg.u.uBowl, V.bowlUV[0], V.bowlUV[1], V.bowlUV[2], V.bowlUV[3]);
  gl.uniform2f(waterSpecProg.u.uMoon, V.moonUV[0], V.moonUV[1]);
  gl.uniform1f(waterSpecProg.u.uRefract, 26.0);
  gl.uniform1f(waterSpecProg.u.uBoost, 1.0 + S.revealLift * 0.85);
  blit(scene);
  gl.blendEquation(gl.FUNC_ADD);
  gl.disable(gl.BLEND);

  /* ---------- L3 particles ---------- */
  updateParticles();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  partRenderProg.bind();
  gl.bindVertexArray(partVAO[partRead]);
  gl.uniform1f(partRenderProg.u.uTime, S.simT);
  gl.uniform1f(partRenderProg.u.uPixelRatio, V.dpr);
  gl.uniform1f(partRenderProg.u.uScale, 1.0);
  gl.uniform1f(partRenderProg.u.uFoilAlive, S.foilAlive);
  gl.uniform3f(partRenderProg.u.uGoldMatte, C.goldM[0], C.goldM[1], C.goldM[2]);
  gl.uniform3f(partRenderProg.u.uGoldBright, C.goldB[0], C.goldB[1], C.goldB[2]);
  gl.uniform3f(partRenderProg.u.uMoonWhite, C.moonW[0], C.moonW[1], C.moonW[2]);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rayB.texture);
  gl.uniform1i(partRenderProg.u.uGlow, 0);
  gl.drawArrays(gl.POINTS, 0, PART_COUNT);
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);

  /* ---------- composite to screen ---------- */
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  gl.disable(gl.BLEND);
  compProg.bind();
  gl.uniform2f(compProg.u.texelSize, 1/W, 1/H);
  gl.uniform1i(compProg.u.uScene, scene.attach(0));
  gl.uniform1f(compProg.u.uExposure, 1.25);       /* ACESFilmic + exposure */
  gl.uniform1f(compProg.u.uLift, S.revealLift);
  blit(null);
}

function updateParticles(){
  const dt = Math.min(LAST_DT, 0.033);
  const write = 1 - partRead;
  partUpdateProg.bind();
  gl.uniform1f(partUpdateProg.u.uDt, dt);
  gl.uniform1f(partUpdateProg.u.uTime, S.simT);
  gl.uniform1f(partUpdateProg.u.uBurstReset, S.burstReset);
  gl.uniform1f(partUpdateProg.u.uReduced, REDUCED ? 1 : 0);
  const bx = (V.bowl.cx / V.vw) * 2 - 1;
  const by = 1 - (V.bowl.cy / V.vh) * 2;
  gl.uniform2f(partUpdateProg.u.uBurst, bx, by - 0.06);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.texture);
  gl.uniform1i(partUpdateProg.u.uFlow, 0);

  gl.bindVertexArray(partVAO[partRead]);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, partTF);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, partBuf[write]);
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, PART_COUNT);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  gl.bindVertexArray(null);
  partRead = write;
  S.burstReset = 0;
}

/* ==================== Canvas2D: 大瓷碗 ==================== */
function drawMooncake(x, y, R, k, glow){
  /* Gilt gold family only — NOT pastry beige. Beige is banned by the locked
     Ink-Gold Nocturne palette, so mooncakes read as 月饼 by SHAPE (round body +
     scalloped 花边 + center 花纹), rendered in gold-matte/gold-bright/ink. */
  const ry = R * k;

  ctx2.beginPath();
  ctx2.ellipse(x, y, R, ry, 0, 0, Math.PI * 2);
  const wg = ctx2.createLinearGradient(x - R, y - ry, x + R, y + ry);
  wg.addColorStop(0, '#5C4A22');
  wg.addColorStop(0.55, '#3A3220');
  wg.addColorStop(1, '#1B1812');
  ctx2.fillStyle = wg;
  ctx2.fill();

  const ty = y - ry * 0.30;
  ctx2.beginPath();
  ctx2.ellipse(x, ty, R * 0.96, ry * 0.96, 0, 0, Math.PI * 2);
  const tg = ctx2.createRadialGradient(x - R * 0.30, ty - ry * 0.34, R * 0.06, x, ty, R);
  tg.addColorStop(0, '#ECD06F');
  tg.addColorStop(0.46, '#C5A253');
  tg.addColorStop(1, '#8A7038');
  ctx2.fillStyle = tg;
  ctx2.fill();

  const N = 18;
  ctx2.fillStyle = 'rgba(138,112,56,.85)';
  for (let i = 0; i < N; i++){
    const a = i / N * Math.PI * 2;
    ctx2.beginPath();
    ctx2.arc(x + Math.cos(a) * R * 0.96, ty + Math.sin(a) * ry * 0.96, R * 0.13, 0, Math.PI * 2);
    ctx2.fill();
  }

  ctx2.strokeStyle = 'rgba(236,208,111,.72)';
  ctx2.lineWidth = Math.max(1, R * 0.055);
  ctx2.beginPath();
  ctx2.ellipse(x, ty, R * 0.46, ry * 0.46, 0, 0, Math.PI * 2);
  ctx2.stroke();

  ctx2.fillStyle = 'rgba(236,208,111,.62)';
  for (let i = 0; i < 4; i++){
    const a = i / 4 * Math.PI * 2 + Math.PI / 4;
    ctx2.beginPath();
    ctx2.ellipse(x + Math.cos(a) * R * 0.24, ty + Math.sin(a) * ry * 0.24,
                 R * 0.15, ry * 0.15, a, 0, Math.PI * 2);
    ctx2.fill();
  }
  ctx2.beginPath();
  ctx2.arc(x, ty, R * 0.07, 0, Math.PI * 2);
  ctx2.fillStyle = 'rgba(236,208,111,.85)';
  ctx2.fill();

  ctx2.beginPath();
  ctx2.ellipse(x - R * 0.34, ty - ry * 0.38, R * 0.30, ry * 0.20, -0.5, 0, Math.PI * 2);
  ctx2.fillStyle = 'rgba(214,236,240,' + (0.22 + 0.30 * glow).toFixed(3) + ')';
  ctx2.fill();

  if (glow > 0){
    ctx2.beginPath();
    ctx2.ellipse(x, ty, R * 0.98, ry * 0.98, 0, 0, Math.PI * 2);
    ctx2.strokeStyle = 'rgba(236,208,111,' + (0.10 + 0.42 * glow).toFixed(3) + ')';
    ctx2.lineWidth = Math.max(1, R * 0.07);
    ctx2.stroke();
  }
}

function drawMooncakes(){
  const b = V.bowl;
  const k = V.cam.sinA;
  const R = b.rx * 0.155;
  const mx = b.cx - b.rx * 1.42;
  const my = b.cy + b.rx * 0.56;
  const glow = S.collected / CAKE_TOTAL;

  const sg = ctx2.createRadialGradient(mx, my + R * k * 0.55, R * 0.05,
                                       mx, my + R * k * 0.55, R * 2.6);
  sg.addColorStop(0, 'rgba(22,24,29,.55)');
  sg.addColorStop(1, 'rgba(22,24,29,0)');
  ctx2.fillStyle = sg;
  ctx2.beginPath();
  ctx2.ellipse(mx, my + R * k * 0.55, R * 2.6, R * 0.95, 0, 0, Math.PI * 2);
  ctx2.fill();

  /* The pool is drawn in FULL at all times so 月饼 is legible in every frame —
     progress is carried by the rim bloom + the numeric X/63, not by cake count. */
  const rows = [
    { y: my,            xs: [-1.85, 0, 1.85] },
    { y: my - R*k*1.22, xs: [-0.92, 0.92] },
    { y: my - R*k*2.44, xs: [0] },
  ];
  for (const row of rows){
    for (const f of row.xs) drawMooncake(mx + f * R, row.y, R, k, glow);
  }
}

function drawBowl(){
  const b = V.bowl, dpr = V.dpr;
  ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2.clearRect(0, 0, V.vw, V.vh);

  /* --- cast shadow under the bowl (ink, deepest token) --- */
  const sg = ctx2.createRadialGradient(b.cx, b.cy + b.depth * 0.86, b.rx * 0.10,
                                       b.cx, b.cy + b.depth * 0.86, b.rx * 1.32);
  sg.addColorStop(0, 'rgba(22,24,29,0.82)');
  sg.addColorStop(0.55, 'rgba(22,24,29,0.34)');
  sg.addColorStop(1, 'rgba(22,24,29,0)');
  ctx2.fillStyle = sg;
  ctx2.beginPath();
  ctx2.ellipse(b.cx, b.cy + b.depth * 0.86, b.rx * 1.32, b.rx * 0.42, 0, 0, Math.PI * 2);
  ctx2.fill();

  /* --- exterior body --- */
  ctx2.beginPath();
  ctx2.ellipse(b.cx, b.cy, b.rx, b.ry, 0, 0, Math.PI, false);
  ctx2.bezierCurveTo(b.cx + b.rx, b.cy + b.depth * 0.70,
                     b.cx + b.rx * 0.46, b.cy + b.depth,
                     b.cx, b.cy + b.depth);
  ctx2.bezierCurveTo(b.cx - b.rx * 0.46, b.cy + b.depth,
                     b.cx - b.rx, b.cy + b.depth * 0.70,
                     b.cx - b.rx, b.cy);
  ctx2.closePath();
  const bg = ctx2.createLinearGradient(b.cx - b.rx, b.cy, b.cx + b.rx, b.cy + b.depth);
  bg.addColorStop(0.00, '#9FB2C0');
  bg.addColorStop(0.18, '#6B7C8F');
  bg.addColorStop(0.42, '#3E4859');
  bg.addColorStop(0.70, '#242B39');
  bg.addColorStop(1.00, '#151A24');
  ctx2.fillStyle = bg;
  ctx2.fill();

  /* moonlight catch on the left flank of the body */
  ctx2.save();
  ctx2.clip();
  const mg = ctx2.createLinearGradient(b.cx - b.rx, b.cy, b.cx - b.rx * 0.15, b.cy + b.depth);
  mg.addColorStop(0, 'rgba(214,236,240,0.58)');
  mg.addColorStop(0.45, 'rgba(214,236,240,0.16)');
  mg.addColorStop(1, 'rgba(214,236,240,0)');
  ctx2.fillStyle = mg;
  ctx2.fillRect(b.cx - b.rx, b.cy, b.rx * 1.1, b.depth + b.ry);
  /* glaze sheen: a soft glossy band across the belly reads as fired porcelain */
  const gz = ctx2.createLinearGradient(b.cx - b.rx * 0.2, b.cy + b.depth * 0.18,
                                       b.cx + b.rx * 0.5, b.cy + b.depth * 0.62);
  gz.addColorStop(0, 'rgba(214,236,240,0)');
  gz.addColorStop(0.5, 'rgba(214,236,240,0.14)');
  gz.addColorStop(1, 'rgba(214,236,240,0)');
  ctx2.fillStyle = gz;
  ctx2.fillRect(b.cx - b.rx, b.cy, b.rx * 2, b.depth + b.ry);
  /* 描金 band around the lower body */
  ctx2.strokeStyle = 'rgba(197,162,83,0.34)';
  ctx2.lineWidth = 1.1;
  ctx2.beginPath();
  ctx2.ellipse(b.cx, b.cy + b.depth * 0.72, b.rx * 0.62, b.rx * 0.20, 0, 0, Math.PI, false);
  ctx2.stroke();
  ctx2.restore();

  /* --- rim annulus (porcelain wall thickness) --- */
  ctx2.beginPath();
  ctx2.ellipse(b.cx, b.cy, b.rx, b.ry, 0, 0, Math.PI * 2);
  ctx2.ellipse(b.cx, b.cy, b.rxI, b.ryI, 0, 0, Math.PI * 2, true);
  const rg = ctx2.createLinearGradient(b.cx - b.rx, b.cy - b.ry, b.cx + b.rx, b.cy + b.ry);
  rg.addColorStop(0.00, '#D6E8EE');
  rg.addColorStop(0.18, '#9DB2BC');
  rg.addColorStop(0.42, '#5A6676');
  rg.addColorStop(0.68, '#333B4A');
  rg.addColorStop(1.00, '#7C8D9C');
  ctx2.fillStyle = rg;
  ctx2.fill('evenodd');

  /* rim specular arc: moonlight catches the upper-left lip */
  ctx2.save();
  ctx2.beginPath();
  ctx2.ellipse(b.cx, b.cy, b.rx, b.ry, 0, 0, Math.PI * 2);
  ctx2.ellipse(b.cx, b.cy, b.rxI, b.ryI, 0, 0, Math.PI * 2, true);
  ctx2.clip('evenodd');
  const rg2 = ctx2.createLinearGradient(b.cx - b.rx * 0.9, b.cy - b.ry * 1.2, b.cx + b.rx * 0.4, b.cy + b.ry * 0.6);
  rg2.addColorStop(0, 'rgba(214,236,240,0.90)');
  rg2.addColorStop(0.34, 'rgba(214,236,240,0.26)');
  rg2.addColorStop(0.62, 'rgba(214,236,240,0)');
  ctx2.fillStyle = rg2;
  ctx2.fillRect(b.cx - b.rx, b.cy - b.ry, b.rx * 2, b.ry * 2);
  ctx2.restore();

  /* 描金 hairline on the outer lip */
  ctx2.strokeStyle = 'rgba(197,162,83,0.62)';
  ctx2.lineWidth = 1.2;
  ctx2.beginPath();
  ctx2.ellipse(b.cx, b.cy, b.rx - 0.6, b.ry - 0.6, 0, 0, Math.PI * 2);
  ctx2.stroke();
  ctx2.strokeStyle = 'rgba(236,208,111,0.30)';
  ctx2.lineWidth = 0.8;
  ctx2.beginPath();
  ctx2.ellipse(b.cx, b.cy, b.rxI + 0.5, b.ryI + 0.5, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx2.stroke();

  /* inner-wall shadow just inside the lip (gives the cavity depth) */
  ctx2.save();
  ctx2.beginPath();
  ctx2.ellipse(b.cx, b.cy, b.rxI, b.ryI, 0, 0, Math.PI * 2);
  ctx2.clip();
  const ig = ctx2.createRadialGradient(b.cx, b.cy, b.rxI * 0.55, b.cx, b.cy, b.rxI);
  ig.addColorStop(0, 'rgba(22,24,29,0)');
  ig.addColorStop(1, 'rgba(22,24,29,0.72)');
  ctx2.fillStyle = ig;
  ctx2.fillRect(b.cx - b.rxI, b.cy - b.ryI, b.rxI * 2, b.ryI * 2);
  ctx2.restore();
}

/* ==================== Canvas2D: dice ==================== */
function project(wx, wy, wz){
  return {
    x: V.bowl.cx + wx,
    y: V.bowl.cy + wz * V.cam.sinA - wy * V.cam.cosA,
    d: -wz * V.cam.cosA - wy * V.cam.sinA,
  };
}

function drawDie(d){
  const h = V.bowl.rxI * 0.148;
  const m = rotMat(d.rx, d.ry, d.rz);
  const faces = [];
  for (const f of CUBE){
    const n = applyR(m, f.n);
    /* f = (0,-sinA,-cosA); visible when n.f < 0 */
    const nf = -n[1] * V.cam.sinA - n[2] * V.cam.cosA;
    if (nf >= 0) continue;
    const pts = f.c.map(c => {
      const r = applyR(m, [c[0] * h, c[1] * h, c[2] * h]);
      return project(d.wx + r[0], d.wy + r[1], d.wz + r[2]);
    });
    faces.push({ pts, n, nf, val: f.val });
  }
  faces.sort((a, b) => b.nf - a.nf);        /* painter's algorithm, far first */

  /* contact shadow on the bowl floor */
  const cs = project(d.wx, 0, d.wz);
  const lift = Math.max(0, d.wy);
  const shr = Math.max(0.35, 1 - lift / (h * 5));
  ctx2.save();
  ctx2.globalAlpha = 0.42 * shr;
  const csg = ctx2.createRadialGradient(cs.x, cs.y, 0, cs.x, cs.y, h * 1.5 * shr);
  csg.addColorStop(0, 'rgba(11,13,18,0.9)');
  csg.addColorStop(1, 'rgba(11,13,18,0)');
  ctx2.fillStyle = csg;
  ctx2.beginPath();
  ctx2.ellipse(cs.x, cs.y, h * 1.5 * shr, h * 1.5 * shr * V.cam.sinA, 0, 0, Math.PI * 2);
  ctx2.fill();
  ctx2.restore();

  const LIGHT = [ -0.42, 0.74, 0.52 ];     /* moonlight from upper-left-front */
  for (const f of faces){
    const P = f.pts;
    const ax = P[1].x - P[0].x, ay = P[1].y - P[0].y;
    const bx = P[3].x - P[0].x, by = P[3].y - P[0].y;

    ctx2.save();
    ctx2.transform(ax, ay, bx, by, P[0].x, P[0].y);

    /* body (dark rounded edge reads as the die's chamfer) */
    ctx2.fillStyle = '#14171E';
    ctx2.fillRect(-0.03, -0.03, 1.06, 1.06);

    ctx2.beginPath();
    const rr = 0.13;
    ctx2.moveTo(rr, 0);
    ctx2.lineTo(1 - rr, 0); ctx2.quadraticCurveTo(1, 0, 1, rr);
    ctx2.lineTo(1, 1 - rr); ctx2.quadraticCurveTo(1, 1, 1 - rr, 1);
    ctx2.lineTo(rr, 1); ctx2.quadraticCurveTo(0, 1, 0, 1 - rr);
    ctx2.lineTo(0, rr); ctx2.quadraticCurveTo(0, 0, rr, 0);
    ctx2.closePath();

    /* lambert shading on ivory — real light and dark sides, not flat tiles */
    const lam = Math.max(0, f.n[0] * LIGHT[0] + f.n[1] * LIGHT[1] + f.n[2] * LIGHT[2]);
    const k = 0.20 + 0.80 * lam;
    const fg = ctx2.createLinearGradient(0, 0, 0.85, 1);
    fg.addColorStop(0, shade(C.ivory, k * 1.06));
    fg.addColorStop(0.62, shade(C.ivory, k * 0.92));
    fg.addColorStop(1, shade(C.ivory, k * 0.70));
    ctx2.fillStyle = fg;
    ctx2.fill();
    ctx2.clip();

    /* moonlight specular sweep across the face */
    const sp = ctx2.createLinearGradient(0.05, 0.0, 0.72, 0.85);
    sp.addColorStop(0, 'rgba(214,236,240,' + (0.30 * lam).toFixed(3) + ')');
    sp.addColorStop(0.30, 'rgba(214,236,240,' + (0.06 * lam).toFixed(3) + ')');
    sp.addColorStop(1, 'rgba(214,236,240,0)');
    ctx2.fillStyle = sp;
    ctx2.fillRect(0, 0, 1, 1);

    /* pips — large and high-contrast so they can be counted at screenshot scale */
    const red = !!RED_FACES[f.val];
    const pr = f.val === 1 ? 0.215 : (f.val === 4 ? 0.155 : 0.135);
    for (const p of PIPS[f.val]){
      if (red){
        /* 朱砂四点红: the single highest-saturation anchor on the dark ground.
           Emissive, so it self-lits. NOTE: shadowBlur ignores the CTM and is in
           DEVICE px, so scale by dpr — the old 0.30 value gave no glow at all. */
        ctx2.shadowColor = 'rgba(206,42,34,0.95)';
        ctx2.shadowBlur = h * V.dpr * 0.85;
        const pg = ctx2.createRadialGradient(p[0], p[1], 0, p[0], p[1], pr);
        pg.addColorStop(0, '#FF7056');
        pg.addColorStop(0.36, '#D03A2C');
        pg.addColorStop(0.70, '#A82020');
        pg.addColorStop(1, '#7E1818');
        ctx2.fillStyle = pg;
      } else {
        ctx2.shadowColor = 'transparent';
        ctx2.shadowBlur = 0;
        const pg = ctx2.createRadialGradient(p[0], p[1], 0, p[0], p[1], pr);
        pg.addColorStop(0, '#232833');
        pg.addColorStop(0.6, '#12151C');
        pg.addColorStop(1, '#080A0E');
        ctx2.fillStyle = pg;
      }
      ctx2.beginPath();
      ctx2.arc(p[0], p[1], pr, 0, Math.PI * 2);
      ctx2.fill();
      if (red){
        ctx2.shadowBlur = 0;
        ctx2.fillStyle = 'rgba(255,251,240,0.55)';
        ctx2.beginPath();
        ctx2.arc(p[0] - pr * 0.30, p[1] - pr * 0.32, pr * 0.34, 0, Math.PI * 2);
        ctx2.fill();
      }
    }
    ctx2.shadowBlur = 0;

    /* chamfer edge */
    ctx2.strokeStyle = 'rgba(22,24,29,0.30)';
    ctx2.lineWidth = 0.028;
    ctx2.stroke();
    ctx2.restore();
  }
}

function shade(c, k){
  const r = Math.round(Math.min(255, c[0] * 255 * k));
  const g = Math.round(Math.min(255, c[1] * 255 * k));
  const b = Math.round(Math.min(255, c[2] * 255 * k));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function drawDice(){
  ctx2.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  const order = dice.map((d, i) => ({ d, i }))
    .sort((a, b) => project(b.d.wx, b.d.wy, b.d.wz).d - project(a.d.wx, a.d.wy, a.d.wz).d);
  for (const o of order) drawDie(o.d);
}

/* ==================== dice choreography ==================== */
function updateDice(){
  const T = TIMING;
  for (const d of dice){
    const tl = T.rise + T.fall + d.landDelay;
    if (S.t < tl){
      /* airborne: rise decelerates, fall accelerates */
      const peak = V.bowl.rxI * (0.86 + (d.landDelay / 0.058) * 0.10);
      if (S.t < T.rise){
        d.wy = peak * easeOutCubic(S.t / T.rise);
      } else {
        const k = (S.t - T.rise) / (T.fall + d.landDelay);
        d.wy = peak * (1 - easeInQuad(Math.min(1, k)));
      }
      /* tumble: accelerate-then-ease rotation */
      const k = Math.min(1, S.t / tl);
      const e = 1 - Math.pow(1 - k, 2.4);
      const st = SETTLE[d.val];
      d.rx = st[0] + d.tilt + d._spin[0] * (1 - e);
      d.ry = st[1] + d.yaw  + d._spin[1] * (1 - e);
      d.rz = st[2] + d.roll + d._spin[2] * (1 - e);
      d.landed = false;
    } else {
      if (!d.landed){
        d.landed = true;
        d.landT = S.t;
        if (!REDUCED) impact(d);
      }
      const tau = S.t - tl;
      /* spring settle: high stiffness + low damping -> emphatic overshoot */
      d.wy = REDUCED ? 0 : Math.max(0, spring(tau, V.bowl.rxI * 0.30));
      const st = SETTLE[d.val];
      const w = REDUCED ? 1 : 1 - Math.exp(-5.4 * tau);
      d.rx = st[0] + d.tilt + (REDUCED ? 0 : 26 * Math.exp(-6.0 * tau) * Math.cos(19 * tau));
      d.ry = st[1] + d.yaw  * w;
      d.rz = st[2] + d.roll * w;
    }
  }
}

/* ==================== main loop ==================== */
let LAST_DT = 0.016;
let lastNow = performance.now();
let raf = 0;

function tick(now){
  raf = requestAnimationFrame(tick);
  let dt = (now - lastNow) / 1000;
  lastNow = now;
  if (!Number.isFinite(dt) || dt <= 0) dt = 0.016;
  dt = Math.min(dt, 0.033);
  LAST_DT = dt;
  S.simT += dt;

  /* beam density decays back to the idle 0.016 */
  S.beam += (0.016 - S.beam) * Math.min(1, dt * 1.6);

  /* ease the reveal lift so the peak blooms rather than snapping */
  S.revealLift += (S.liftTarget - S.revealLift) * Math.min(1, dt * 3.4);

  /* gold-foil burst lifecycle */
  if (S.foilAlive > 0) S.foilAlive = Math.max(0, S.foilAlive - dt / 2.4);

  /* phase machine */
  if (S.phase === PHASE.THROW || S.phase === PHASE.SETTLE){
    S.t += dt;
    updateDice();
    const allLanded = dice.every(d => d.landed);
    const lastLand = TIMING.rise + TIMING.fall + 0.058 * 5 + TIMING.springDur;
    if (allLanded && S.t >= lastLand) S.phase = PHASE.HOLD;
  } else if (S.phase === PHASE.HOLD){
    S.t += dt;
    updateDice();
    /* 落定必呼吸: hold >= 1s before the reveal blooms */
    if (S.t >= TIMING.rise + TIMING.fall + 0.058 * 5 + TIMING.springDur + TIMING.holdBreath){
      S.phase = PHASE.REVEAL;
      revealPeak();
    }
  } else {
    /* idle: dice rest in the bowl, surface keeps breathing */
    updateDiceIdle();
  }

  ambientInk(dt);
  stepFluid(dt);
  stepWater(dt);
  renderGL();
  drawBowl();
  drawMooncakes();
  drawDice();
}

function updateDiceIdle(){
  for (const d of dice){
    const st = SETTLE[d.val];
    d.rx = st[0] + d.tilt;
    d.ry = st[1] + d.yaw;
    d.rz = st[2] + d.roll;
    d.wx = d.home[0] * V.bowl.Rf;
    d.wz = d.home[1] * V.bowl.Rf / V.cam.sinA;
    d.wy = 0;
    d.landed = true;
  }
}
/* idle: dice sit empty-handed (no result yet) */
updateDiceIdle();

/* ==================== lifecycle ==================== */
function onResize(){
  layout();
  initFBOs();
  updateDiceIdle();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
/* pause on hide (container onHide) */
document.addEventListener('visibilitychange', () => {
  if (document.hidden){
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  } else if (!raf){
    lastNow = performance.now();
    raf = requestAnimationFrame(tick);
  }
});

window.Bobing = window.Bobing || {};
window.Bobing.Scene = {
  gl, V, layout, dice, CUBE, SETTLE, PIPS, RED_FACES,
  buildDice, initFBOs, startThrow, updateDice, updateDiceIdle,
  impact, stepFluid, ambientInk, stepWater,
  renderGL, updateParticles, drawBowl, drawMooncakes, drawDice,
  tick, onResize,
};

raf = requestAnimationFrame(tick);
