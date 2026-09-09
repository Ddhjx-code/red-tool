'use strict';

/* ============================ RNG ============================ */
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const SEED = (() => {
  const q = new URLSearchParams(location.search).get('seed');
  const n = q ? parseInt(q, 10) : NaN;
  return Number.isFinite(n) ? n : 20260925;
})();
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (REDUCED) document.body.classList.add('reduced');


function judge(dice){
  const fours = dice.reduce((n,v) => n + (v === 4 ? 1 : 0), 0);
  const ones  = dice.reduce((n,v) => n + (v === 1 ? 1 : 0), 0);
  const counts = {};
  dice.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  let maxCount = 0, kindValue = 0;
  for (const k in counts) if (counts[k] > maxCount){ maxCount = counts[k]; kindValue = +k; }
  const straight = [...dice].sort((a,b) => a-b).join('') === '123456';
  /* specials first, then base tiers, highest prestige wins */
  if (fours === 6)                        return TIER_MAP.liubeihong;
  if (fours >= 4 && ones === 2)           return TIER_MAP.jinhua;
  if (fours >= 4)                         return TIER_MAP.zhuangyuan;
  if (straight)                           return TIER_MAP.duitang;
  if (fours === 3)                        return TIER_MAP.sanhong;
  if (maxCount >= 4 && kindValue !== 4)   return TIER_MAP.sijin;
  if (fours === 2)                        return TIER_MAP.erju;
  if (fours === 1)                        return TIER_MAP.yixiu;
  return TIER_MAP.none;
}

/* ==================== choreography state ==================== */
const PHASE = { IDLE:'idle', THROW:'throw', SETTLE:'settle', HOLD:'hold', REVEAL:'reveal' };

let tyTimer = 0;
const S = {
  phase: PHASE.IDLE,
  t: 0,               /* seconds since throw start */
  simT: 0,            /* global sim clock */
  beam: 0.016,        /* god-ray density: 0.016 idle -> 0.030 on throw */
  revealLift: 0,      /* eased scene lift */
  liftTarget: 0,      /* 结尾即峰值: reveal ALWAYS raises luminance, never lowers it */
  foilAlive: 0,
  burstReset: 0,
  result: null,
  thrown: 0,
  collected: 0,       /* cumulative 会饼 across throws */
  intro: true,        /* intro screen still up */
  done: false,        /* 团圆 reached */
};
const TIMING = {
  rise: 0.30,      /* toss up, decelerating */
  fall: 0.46,      /* fall, accelerating */
  springDur: 0.62, /* settle spring */
  holdBreath: 1.05,/* 落定必呼吸: hold before reveal */
};

function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
function easeInQuad(t){ return t * t; }

/* spring F = -kx - cv, high stiffness + low damping -> sharp overshoot */
function spring(t, amp){
  if (t <= 0) return 0;
  return amp * Math.exp(-6.2 * t) * Math.cos(21.5 * t);
}

function rollDice(){
  const rng = mulberry32((SEED ^ 0xB0B1) + S.thrown * 7919);
  const out = [];
  for (let i = 0; i < 6; i++) out.push(1 + Math.floor(rng() * 6));
  return out;
}

const STORE_KEY = 'bobing.progress.v1';

function loadProgress(){
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const n = Number(JSON.parse(raw).collected);
    if (!isFinite(n)) return null;
    return Math.max(0, Math.min(CAKE_TOTAL, Math.round(n)));
  } catch (e) { return null; }
}

function saveProgress(){
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ collected: S.collected }));
  } catch (e) {}
}

function clearProgress(){
  try { window.localStorage.removeItem(STORE_KEY); } catch (e) {}
}

const storedCakes = loadProgress();
if (storedCakes !== null) S.collected = storedCakes;

window.Bobing = window.Bobing || {};
window.Bobing.Engine = {
  mulberry32, SEED, REDUCED, PHASE, TIMING, S,
  judge, rollDice, easeOutCubic, easeInQuad, spring,
  loadProgress, saveProgress, clearProgress,
};
