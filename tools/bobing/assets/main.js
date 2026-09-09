'use strict';

/* ==================== UI ==================== */
const ui = {
  reveal: document.getElementById('reveal'),
  tier:   document.getElementById('rv-tier'),
  sub:    document.getElementById('rv-sub'),
  prog:   document.getElementById('rv-prog'),
  cake:   document.getElementById('rv-cake'),
  poem:   document.getElementById('rv-poem'),
  note:   document.getElementById('rv-note'),
  seal:   document.getElementById('seal'),
  sealTx: document.getElementById('seal-txt'),
  cta:    document.getElementById('cta'),
  hint:   document.getElementById('hint'),
  list:   document.getElementById('board-list'),
  progress: document.getElementById('progress'),
  pgN:      document.getElementById('pg-n'),
  pgFill:   document.getElementById('pg-fill'),
  intro:    document.getElementById('intro'),
  introCta: document.getElementById('intro-cta'),
  tuanyuan: document.getElementById('tuanyuan'),
  tyCta:    document.getElementById('ty-cta'),
  introCols: document.getElementById('intro-cols'),
};

BOARD_KEYS.forEach(k => {
  const t = TIER_MAP[k];
  const li = document.createElement('li');
  li.dataset.key = k;
  li.innerHTML = '<span class="tn">' + t.name + '</span><span class="tc">' + t.cn + '饼</span>';
  ui.list.appendChild(li);
});

FACTS.introLines.forEach(txt => {
  const p = document.createElement('p');
  p.textContent = txt;
  ui.introCols.appendChild(p);
});

const uiRule = {
  btn:   document.getElementById('rule-btn'),
  panel: document.getElementById('rule-panel'),
  close: document.getElementById('rule-close'),
  veil:  document.getElementById('rule-veil'),
  head:  document.getElementById('rule-tier-head'),
  table: document.getElementById('rule-tier-table'),
};

function fillText(id, txt){
  document.getElementById(id).textContent = txt;
}

function fillParas(id, lines){
  const box = document.getElementById(id);
  lines.forEach(txt => {
    const p = document.createElement('p');
    p.textContent = txt;
    box.appendChild(p);
  });
}

fillText('rule-h-mechanic', RULE.mechanicTitle);
fillParas('rule-mechanic', RULE.mechanic);
fillText('rule-redone', RULE.redOne);
fillText('rule-order', RULE.order);
fillText('rule-h-tier', RULE.tierTitle);
fillText('rule-tier-foot', RULE.tierFoot);
fillText('rule-h-goal', RULE.goalTitle);
fillParas('rule-goal', RULE.goal);
fillText('rule-h-fun', RULE.funTitle);
fillParas('rule-fun', RULE.fun);
fillText('rule-h-prog', RULE.progTitle);
fillParas('rule-prog', [RULE.prog]);
fillText('intro-rule-1', RULE.intro[0]);
fillText('intro-rule-2', RULE.intro[1]);

RULE.tierHead.forEach((txt, i) => {
  const th = document.createElement('th');
  if (i === RULE.tierHead.length - 1) th.className = 'rt-cake-col';
  th.textContent = txt;
  uiRule.head.appendChild(th);
});

BOARD_KEYS.forEach(k => {
  const t = TIER_MAP[k];
  const tr = document.createElement('tr');
  tr.dataset.key = k;

  const tdName = document.createElement('td');
  tdName.className = 'rt-name';
  tdName.textContent = t.name;

  const tdCond = document.createElement('td');
  const cond = document.createElement('div');
  cond.className = 'rt-cond';
  const plain = document.createElement('span');
  plain.className = 'rt-plain';
  plain.textContent = PLAIN[k];
  const note = document.createElement('span');
  note.className = 'rt-note';
  note.textContent = t.note;
  cond.appendChild(plain);
  cond.appendChild(note);
  tdCond.appendChild(cond);

  const tdCake = document.createElement('td');
  tdCake.className = 'rt-cake';
  tdCake.textContent = t.cakes + ' 块';

  tr.appendChild(tdName);
  tr.appendChild(tdCond);
  tr.appendChild(tdCake);
  uiRule.table.appendChild(tr);
});

function openRule(){
  uiRule.panel.classList.add('on');
  uiRule.panel.setAttribute('aria-hidden', 'false');
}
function closeRule(){
  uiRule.panel.classList.remove('on');
  uiRule.panel.setAttribute('aria-hidden', 'true');
}
uiRule.btn.addEventListener('click', openRule);
uiRule.close.addEventListener('click', closeRule);
uiRule.veil.addEventListener('click', closeRule);

function awardCakes(tier){
  const gain = tier.key === 'liubeihong' ? (CAKE_TOTAL - S.collected) : tier.cakes;
  S.collected = Math.min(CAKE_TOTAL, S.collected + gain);
  ui.updateProgress();
  saveProgress();
  return gain;
}

ui.updateProgress = function(){
  ui.pgN.textContent = S.collected;
  ui.pgFill.style.transform = 'scaleX(' + (S.collected / CAKE_TOTAL).toFixed(4) + ')';
};

ui.showReveal = function(tier, gain){
  ui.tier.textContent = tier.name;
  ui.sub.textContent = tier.sub;
  ui.prog.innerHTML = '累计 <b>' + S.collected + '</b>/63';
  ui.cake.innerHTML = '得会饼 <b>' + tier.cn + '</b>块' + (gain === 0 ? '（已集满）' : '');
  ui.poem.textContent = tier.poem || '';
  ui.poem.classList.toggle('on', !!tier.poem);
  ui.note.textContent = tier.note;
  ui.reveal.classList.toggle('t-cinnabar', !!tier.cinnabar);
  ui.reveal.classList.add('on');
  ui.sealTx.textContent = tier.name;
  ui.seal.classList.add('on');
  [...ui.list.children].forEach(li => li.classList.toggle('on', li.dataset.key === tier.key));
};
ui.hideReveal = function(){
  ui.reveal.classList.remove('on');
  ui.seal.classList.remove('on');
  [...ui.list.children].forEach(li => li.classList.remove('on'));
};

function beginSeat(){
  S.intro = false;
  ui.intro.classList.add('off');
  ui.progress.classList.add('on');
  ui.updateProgress();
}
ui.introCta.addEventListener('click', beginSeat);

function resetSeat(){
  S.collected = 0;
  S.done = false;
  S.thrown = 0;
  S.phase = PHASE.IDLE;
  S.liftTarget = 0;
  S.result = null;
  clearProgress();
  ui.tuanyuan.classList.remove('on');
  ui.hideReveal();
  closeRule();
  ui.progress.classList.remove('on');
  ui.intro.classList.remove('off');
  ui.cta.disabled = false;
  ui.hint.classList.remove('off');
  S.intro = true;
  updateDiceIdle();
}
ui.tyCta.addEventListener('click', resetSeat);

const Share = window.BobingShare;
document.getElementById('btn-save-album').addEventListener('click', () => Share.saveAlbum());
document.getElementById('btn-post-note').addEventListener('click', () => Share.postNote());

function showTuanyuan(){
  S.done = true;
  ui.hideReveal();
  ui.progress.classList.remove('on');
  ui.tuanyuan.classList.add('on');
  S.liftTarget = 1.0;
  S.beam = 0.044;
  S.burstReset = 1;
  S.foilAlive = REDUCED ? 0 : 1;
}

ui.cta.addEventListener('click', () => startThrow(null));
glc.addEventListener('pointerdown', (e) => { e.preventDefault(); startThrow(null); });

/* QA / determinism API */
window.__bobing = {
  seed: SEED,
  get phase(){ return S.phase; },
  get result(){ return S.result ? S.result.key : null; },
  get resultName(){ return S.result ? S.result.name : null; },
  get time(){ return S.t; },
  get collected(){ return S.collected; },
  get cakeTotal(){ return CAKE_TOTAL; },
  get intro(){ return S.intro; },
  get done(){ return S.done; },
  forceThrow(values){ startThrow(values); },
  beginSeat,
  showTuanyuan,
  resetSeat,
  setCollected(n){
    S.collected = Math.max(0, Math.min(CAKE_TOTAL, n));
    ui.updateProgress();
    return S.collected;
  },
  judge,
  TIERS,
  shareCard(){ return window.BobingShare ? window.BobingShare.shareCard() : ''; },
};


function revealPeak(){
  /* 结尾即峰值: the reveal is the single most intense beat on screen.
     Intensity is expressed through SCENE LIFT and BURST RICHNESS only —
     never through global darkening, which previously killed the peak. */
  const tier = S.result;
  const gain = awardCakes(tier);
  ui.showReveal(tier, gain);
  ui.cta.disabled = false;
  ui.hint.classList.add('off');
  const key = tier.key;
  const peak = key === 'zhuangyuan' || key === 'jinhua' || key === 'liubeihong';
  /* tier intensity as burst/lift richness, with every value above the idle night */
  const LIFT = {
    liubeihong:1.00, jinhua:1.00, zhuangyuan:1.00,
    duitang:0.66, sanhong:0.60, sijin:0.54, erju:0.46, yixiu:0.40, none:0.34,
  };
  S.liftTarget = LIFT[key] !== undefined ? LIFT[key] : 0.40;
  S.beam = 0.030 + 0.014 * S.liftTarget;
  /* burst richness carries the tier delta: peak tiers get the full gold-foil bloom */
  S.burstReset = 1;
  S.foilAlive = REDUCED ? 0 : (peak ? 1 : 0.45);

  if (S.collected >= CAKE_TOTAL){
    clearTimeout(tyTimer);
    tyTimer = setTimeout(showTuanyuan, 1150);
  }
}

window.Bobing = window.Bobing || {};
window.Bobing.Main = {
  ui, awardCakes, beginSeat, resetSeat, showTuanyuan, revealPeak,
  openRule, closeRule,
};
