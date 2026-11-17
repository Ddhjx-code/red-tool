/* ============================================================
   糖球转转 —— 可爱风幸存者类小游戏
   竖屏单指：左下摇杆走位，武器自动开火（含绕身环绕），击杀掉糖升级三选一。
   Chrome 61 基线：只用 var / function / ES2017 以内 API，不用箭头、模板串、可选链。
   单位：设计 px（390 宽屏下的 1px），绘制时乘 S。
   ============================================================ */
(function () {
  'use strict';

  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');

  var W = 390, H = 780, S = 1, DPR = 1;
  var TAU = Math.PI * 2;
  var DURATION = 180;

  /* ---------- 随机（?test=1 时确定性） ---------- */
  var IS_TEST = /[?&]test=1/.test(window.location.search);
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rand = IS_TEST ? mulberry32(20261117) : Math.random;
  function R(a, b) { return a + rand() * (b - a); }
  function RI(a, b) { return Math.floor(a + rand() * (b - a + 1)); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function len(x, y) { return Math.sqrt(x * x + y * y); }

  /* ---------- 色板 ---------- */
  var INK = '#5B4B4B';
  var PINK = '#FFC2D1';
  var PINK_D = '#F2939F';
  var MINT = '#B8EBD9';
  var LILAC = '#D9CDF6';
  var BUTTER = '#FFE3A3';
  var CREAM = '#FFF6F2';

  /* ---------- 音频（程序化，不引资源） ---------- */
  var AC = null;
  var MUTE = IS_TEST;

  function ac() {
    if (MUTE) return null;
    if (!AC) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { AC = new C(); } catch (e) { return null; }
    }
    if (AC.state === 'suspended' && AC.resume) { try { AC.resume(); } catch (e2) {} }
    return AC;
  }

  function tone(freq, dur, type, gain, slideTo) {
    var a = ac();
    if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), a.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.06, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur + 0.02);
  }

  function blip() { tone(880, 0.07, 'triangle', 0.045, 1180); }
  function thud() { tone(150, 0.16, 'sine', 0.09, 70); }
  function levelSfx() {
    tone(660, 0.1, 'triangle', 0.05); tone(880, 0.12, 'triangle', 0.045);
    setTimeout(function () { tone(1180, 0.14, 'triangle', 0.04); }, 90);
  }
  function bossSfx() { tone(90, 0.5, 'sawtooth', 0.05, 60); }

  /* ---------- 画布尺寸 ---------- */
  var bgCv = document.createElement('canvas');

  function resize() {
    W = window.innerWidth || 390;
    H = window.innerHeight || 780;
    S = W / 390;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    document.documentElement.style.setProperty('--u', (W / 100) + 'px');
    buildBg();
  }

  function buildBg() {
    bgCv.width = Math.round(W * DPR);
    bgCv.height = Math.round(H * DPR);
    var g = bgCv.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    var th = G ? themeOf(G.levelIdx) : LEVELS[0].theme;
    g.fillStyle = th.bg;
    g.fillRect(0, 0, W, H);

    /* 极淡斜格纹 */
    g.strokeStyle = th.line;
    g.lineWidth = 1;
    var step = 30 * S, i;
    for (i = -H; i < W + H; i += step) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke();
    }

    /* 四角柔色块，撑开画面但不抢主体 */
    var blobs = [
      { x: W * 0.06, y: H * 0.16, r: 120 * S, c: th.t1 },
      { x: W * 0.94, y: H * 0.26, r: 140 * S, c: th.t2 },
      { x: W * 0.12, y: H * 0.86, r: 150 * S, c: th.t2 },
      { x: W * 0.9, y: H * 0.78, r: 130 * S, c: th.t1 }
    ];
    for (i = 0; i < blobs.length; i++) {
      var bgr = g.createRadialGradient(blobs[i].x, blobs[i].y, 0, blobs[i].x, blobs[i].y, blobs[i].r);
      bgr.addColorStop(0, blobs[i].c);
      bgr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = bgr;
      g.beginPath();
      g.arc(blobs[i].x, blobs[i].y, blobs[i].r, 0, TAU);
      g.fill();
    }

    /* 撒一层糖粒（固定位置，不随帧变化） */
    var gx, gy, sd = 7;
    for (gy = 46 * S; gy < H; gy += 62 * S) {
      for (gx = 26 * S; gx < W; gx += 62 * S) {
        sd = (sd * 9301 + 49297) % 233280;
        var ox = (sd / 233280 - 0.5) * 30 * S;
        sd = (sd * 9301 + 49297) % 233280;
        var oy = (sd / 233280 - 0.5) * 30 * S;
        g.beginPath();
        g.arc(gx + ox, gy + oy, 2.0 * S, 0, TAU);
        g.fillStyle = (sd % 3 === 0) ? th.t2 : th.t1;
        g.fill();
      }
    }

    /* 四周柔光，中心留白给战场 */
    var rg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.68);
    rg.addColorStop(0, 'rgba(255,255,255,0)');
    rg.addColorStop(1, th.edge);
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);

    /* 顶部与底部各一条柔边，暗示「场外」 */
    var tp = g.createLinearGradient(0, 0, 0, 90 * S);
    tp.addColorStop(0, 'rgba(255,255,255,0.85)');
    tp.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = tp;
    g.fillRect(0, 0, W, 90 * S);
    var bp = g.createLinearGradient(0, H - 110 * S, 0, H);
    bp.addColorStop(0, 'rgba(255,255,255,0)');
    bp.addColorStop(1, 'rgba(255,255,255,0.7)');
    g.fillStyle = bp;
    g.fillRect(0, H - 110 * S, W, 110 * S);
  }

  /* ---------- 敌人与武器定义 ---------- */
  var EDEF = {
    /* 杂兵 */
    pudding: { r: 19, hp: 4, sp: 26, color: '#FFC46B', dark: '#D98A2E', kb: 1 },
    jelly: { r: 19, hp: 7, sp: 34, color: '#8FE0C0', dark: '#3FA987', kb: 1.3 },
    bat: { r: 14, hp: 3, sp: 70, color: '#BFA8F2', dark: '#7E62C8', kb: 1.5 },
    cake: { r: 28, hp: 30, sp: 18, color: '#FFA7BC', dark: '#CE6C84', kb: 0.35 },
    gum: { r: 17, hp: 12, sp: 22, color: '#F7A8D8', dark: '#C0609F', kb: 0.8, split: 2 },
    cloud: { r: 20, hp: 5, sp: 18, color: '#E6EEFF', dark: '#9FB4D8', kb: 1.1, drift: true },
    choco: { r: 20, hp: 9, sp: 40, color: '#B07A4E', dark: '#6E4327', kb: 0.9, charge: true },
    cookie: { r: 22, hp: 26, sp: 20, color: '#E8C089', dark: '#B08145', kb: 0.3 },
    cap: { r: 15, hp: 6, sp: 46, color: '#8FC7F2', dark: '#4A8FC0', kb: 1.4, hop: true },
    berry: { r: 18, hp: 8, sp: 26, color: '#FF8FA8', dark: '#C04E6A', kb: 0.9, shoot: true },
    star: { r: 16, hp: 7, sp: 54, color: '#FFD36E', dark: '#C99A2E', kb: 1.2, orbit: true },
    /* 七关 BOSS */
    b1: { r: 54, hp: 380, sp: 14, color: '#FFC46B', dark: '#D98A2E', kb: 0.08, boss: true, minion: 'pudding', crown: '#FFD98A' },
    b2: { r: 52, hp: 420, sp: 16, color: '#8FE0C0', dark: '#3FA987', kb: 0.08, boss: true, minion: 'jelly', crown: '#8FE0C0' },
    b3: { r: 58, hp: 520, sp: 13, color: '#B07A4E', dark: '#6E4327', kb: 0.06, boss: true, minion: 'choco', crown: '#FFD98A' },
    b4: { r: 60, hp: 600, sp: 12, color: '#FFA7BC', dark: '#CE6C84', kb: 0.06, boss: true, minion: 'cake', crown: '#FFD98A' },
    cloudK: { r: 50, hp: 300, sp: 20, color: '#E6EEFF', dark: '#9FB4D8', kb: 0.12, boss: true, minion: 'cloud', crown: '#C0AAEE' },
    capK: { r: 52, hp: 460, sp: 15, color: '#8FC7F2', dark: '#4A8FC0', kb: 0.08, boss: true, minion: 'cap', crown: '#FFD98A' },
    starK: { r: 62, hp: 700, sp: 13, color: '#FFD36E', dark: '#C99A2E', kb: 0.05, boss: true, minion: 'star', crown: '#FFF3D6' }
  };

  /* ---------- 七关 ---------- */
  var LEVELS = [
    { name: '糖果工厂', sub: '布丁从这儿下线', dur: 90, pool: ['pudding', 'jelly'], boss: 'b1',
      theme: { bg: '#FFF6F2', line: 'rgba(255,179,198,0.20)', t1: 'rgba(255,194,209,0.32)', t2: 'rgba(255,227,163,0.30)', edge: 'rgba(255,205,218,0.50)' } },
    { name: '果冻海湾', sub: '一脚一个坑', dur: 90, pool: ['jelly', 'gum', 'pudding'], boss: 'b2',
      theme: { bg: '#F3FCF8', line: 'rgba(143,224,192,0.22)', t1: 'rgba(143,224,192,0.30)', t2: 'rgba(143,199,242,0.24)', edge: 'rgba(143,224,192,0.42)' } },
    { name: '棉花糖云', sub: '踩着云走', dur: 90, pool: ['bat', 'cloud', 'jelly'], boss: 'cloudK',
      theme: { bg: '#F8F5FF', line: 'rgba(192,170,238,0.20)', t1: 'rgba(192,170,238,0.28)', t2: 'rgba(143,199,242,0.22)', edge: 'rgba(192,170,238,0.40)' } },
    { name: '巧克力矿洞', sub: '越挖越黑', dur: 90, pool: ['choco', 'cookie', 'pudding'], boss: 'b3',
      theme: { bg: '#FBF4EC', line: 'rgba(176,122,78,0.16)', t1: 'rgba(176,122,78,0.22)', t2: 'rgba(255,227,163,0.30)', edge: 'rgba(176,122,78,0.30)' } },
    { name: '汽水河', sub: '别翻船', dur: 90, pool: ['cap', 'gum', 'bat'], boss: 'capK',
      theme: { bg: '#F1F9FF', line: 'rgba(143,199,242,0.22)', t1: 'rgba(143,199,242,0.28)', t2: 'rgba(143,224,192,0.24)', edge: 'rgba(143,199,242,0.42)' } },
    { name: '蛋糕城堡', sub: '守卫全醒了', dur: 90, pool: ['pudding', 'berry', 'cookie', 'cake'], boss: 'b4',
      theme: { bg: '#FFF3F7', line: 'rgba(255,167,188,0.22)', t1: 'rgba(255,167,188,0.30)', t2: 'rgba(255,227,163,0.28)', edge: 'rgba(255,167,188,0.46)' } },
    { name: '星空糖罐', sub: '最后一颗糖', dur: 120, pool: ['star', 'star', 'berry', 'gum', 'cake'], boss: 'starK',
      theme: { bg: '#F4F5FF', line: 'rgba(126,98,200,0.18)', t1: 'rgba(126,98,200,0.24)', t2: 'rgba(255,211,110,0.26)', edge: 'rgba(126,98,200,0.36)' } }
  ];

  /* ---------- 四个角色 ---------- */
  var HEROES = [
    { id: 'hero', name: '糖球', weapon: 'star', hp: 5, spd: 96, dmg: 1, rate: 1, xp: 1,
      unlock: 0, desc: '均衡，谁都能上手' },
    { id: 'mint', name: '薄荷糖', weapon: 'mint', hp: 4, spd: 108, dmg: 0.95, rate: 1, xp: 1,
      unlock: 2, desc: '跑得最快，血最薄' },
    { id: 'cocoa', name: '可可球', weapon: 'lolli', hp: 6, spd: 90, dmg: 1.15, rate: 0.95, xp: 1,
      unlock: 4, desc: '皮厚手重，走得慢' },
    { id: 'starry', name: '星星糖', weapon: 'jumpto', hp: 4, spd: 100, dmg: 1, rate: 1.05, xp: 1.2,
      unlock: 6, desc: '升级最快，滚雪球' }
  ];

  var WDEF = {
    star: {
      intro: '两颗糖针绕着主角转，贴身自动打',
      name: '星星糖针', tag: '环绕', kind: 'orbit',
      desc: function (l) { return l >= 5 ? '已经满级了' : '+1 根糖针，半径 +7'; }
    },
    paw: {
      intro: '第二圈反向转的猫爪，补漏刀',
      name: '猫爪环', tag: '环绕', kind: 'orbit2',
      desc: function (l) { return l >= 5 ? '已经满级了' : '多一圈猫爪，反向转'; }
    },
    bow: {
      intro: '自动射向最近的怪，你只管走位',
      name: '彩虹弹', tag: '远程', kind: 'shoot',
      desc: function (l) { return l >= 5 ? '已经满级了' : '多一发，自动找最近的怪'; }
    },
    bub: {
      intro: '贴身一圈泡泡，持续的近身伤害',
      name: '泡泡糖', tag: '近身', kind: 'aura',
      desc: function (l) { return l >= 5 ? '已经满级了' : '泡更大，伤害更高'; }
    },
    rain: {
      intro: '随机砸下糖霜，一片一片地清',
      name: '糖霜落雨', tag: '范围', kind: 'rain',
      desc: function (l) { return l >= 5 ? '已经满级了' : '多落一颗，砸得更疼'; }
    },
    lolli: {
      intro: '面前横扫一记重击，打得最疼',
      name: '棒棒糖锤', tag: '近战', kind: 'melee',
      desc: function (l) { return l >= 5 ? '已经满级了' : '伤害 +5，横扫范围 +8'; }
    },
    jumpto: {
      intro: '打中一只就弹到下一只身上',
      name: '跳跳糖', tag: '弹射', kind: 'bounce',
      desc: function (l) { return l >= 5 ? '已经满级了' : '多弹一次，伤害 +3'; }
    },
    mint: {
      intro: '放一圈减速波，怪踩上就变慢',
      name: '薄荷风', tag: '减速波', kind: 'wave',
      desc: function (l) { return l >= 5 ? '已经满级了' : '伤害 +3，波更宽'; }
    },
    honey: {
      intro: '脚下留一滩糖蜜，踩到一直掉血',
      name: '蜂蜜陷阱', tag: '地面', kind: 'trap',
      desc: function (l) { return l >= 5 ? '已经满级了' : '每秒伤害 +2，可多放一滩'; }
    },
    spark: {
      intro: '电流在怪之间连跳好几个',
      name: '闪电糖', tag: '链式', kind: 'chain',
      desc: function (l) { return l >= 5 ? '已经满级了' : '多连一个，伤害 +4'; }
    }
  };

  var PROPS = [
    { id: 'dmg', name: '糖针更甜', desc: '所有伤害 +10%' },
    { id: 'rate', name: '手速更快', desc: '所有攻速 +12%' },
    { id: 'spd', name: '脚底抹糖', desc: '移动速度 +8' },
    { id: 'pick', name: '糖纸更大', desc: '拾取范围 +20%' },
    { id: 'heal', name: '补一颗心', desc: '恢复 1 颗心（上限 8）' }
  ];

  /* ---------- 状态 ---------- */
  var G = null;
  var RUN = null;
  var SKIN = 'hero';
  var SAVE = { unlocked: 1, skins: ['hero'], best: { level: 0, kills: 0, time: 0 } };
  var NEXT_ACT = null;

  function loadSave() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem('tq2') : null;
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o.unlocked === 'number') {
          SAVE = { unlocked: clamp(o.unlocked, 1, LEVELS.length), skins: o.skins || ['hero'], best: o.best || { level: 0, kills: 0, time: 0 } };
        }
      }
    } catch (e) {}
    if (!SAVE.skins || !SAVE.skins.length) SAVE.skins = ['hero'];
    if (SAVE.skins.indexOf('hero') < 0) SAVE.skins.push('hero');
  }

  function saveSave() {
    try {
      if (window.localStorage) window.localStorage.setItem('tq2', JSON.stringify(SAVE));
    } catch (e) {}
  }

  function heroById(id) {
    var i;
    for (i = 0; i < HEROES.length; i++) {
      if (HEROES[i].id === id) return HEROES[i];
    }
    return HEROES[0];
  }

  function skinUnlocked(id) {
    return SAVE.skins.indexOf(id) >= 0;
  }

  function themeOf(idx) {
    return LEVELS[clamp(idx, 0, LEVELS.length - 1)].theme;
  }

  function newGame(levelIdx, carry) {
    var h = heroById(SKIN);
    var lv = LEVELS[levelIdx];
    G = {
      state: 'intro', introT: 1.5,
      levelIdx: levelIdx,
      dur: lv.dur,
      t: 0, spawnAcc: 0,
      p: {
        x: W / 2, y: H * 0.58, r: 26,
        hp: carry ? Math.min(carry.maxHp, carry.hp + 2) : h.hp,
        maxHp: carry ? carry.maxHp : h.hp,
        inv: 0, spd: carry ? carry.spd : h.spd, bob: 0, face: 1, skin: h.id
      },
      joy: { on: false, id: null, bx: 0, by: 0, dx: 0, dy: 0 },
      enemies: [], drops: [], bullets: [], ebullets: [], parts: [], strikes: [], zones: [], fx: [],
      weapons: [], level: carry ? carry.level : 1,
      xp: carry ? carry.xp : 0,
      xpNext: carry ? carry.xpNext : 11,
      kills: 0,
      stats: carry ? carry.stats : { dmg: h.dmg, rate: h.rate, pick: 60, xp: h.xp },
      shake: 0, flash: 0, boss: null, bossSpawned: false, pend: 0
    };
    if (carry) {
      var i, w;
      for (i = 0; i < carry.weapons.length; i++) {
        w = carry.weapons[i];
        addWeapon(w.id);
        G.weapons[G.weapons.length - 1].level = w.level;
      }
    } else {
      addWeapon(h.weapon);
    }
    buildBg();
    syncHud();
  }

  function carryOver() {
    return {
      level: G.level, xp: G.xp, xpNext: G.xpNext,
      hp: G.p.hp, maxHp: G.p.maxHp, spd: G.p.spd,
      stats: { dmg: G.stats.dmg, rate: G.stats.rate, pick: G.stats.pick, xp: G.stats.xp },
      weapons: G.weapons.map(function (w) { return { id: w.id, level: w.level }; })
    };
  }

  function startRun(skinId) {
    if (!skinUnlocked(skinId)) skinId = 'hero';
    SKIN = skinId;
    RUN = { skin: skinId, levelIdx: 0, time: 0, kills: 0 };
    startLevel(0, null);
  }

  function startLevel(idx, carry) {
    if (!RUN) RUN = { skin: SKIN, levelIdx: idx, time: 0, kills: 0 };
    RUN.levelIdx = idx;
    document.getElementById('app').className = '';
    document.getElementById('start').className = 'screen';
    document.getElementById('over').className = 'screen';
    document.getElementById('up').className = 'screen';
    hudCache = { hp: -1, max: -1, kills: -1, lv: -1, xp: -1 };
    newGame(idx, carry);
    showLevelCard(idx);
    syncClock();
    ac();
  }

  function showLevelCard(idx) {
    var lv = LEVELS[idx];
    var el = document.getElementById('levelCard');
    document.getElementById('lcNo').textContent = '第 ' + (idx + 1) + ' 关';
    document.getElementById('lcName').textContent = lv.name;
    document.getElementById('lcSub').textContent = lv.sub;
    el.className = 'screen on lvcard';
    document.getElementById('stageBadge').textContent = (idx + 1) + '/' + LEVELS.length;
  }

  function hideLevelCard() {
    document.getElementById('levelCard').className = 'screen';
  }

  /* ---------- 武器 ---------- */
  function addWeapon(id) {
    var d = WDEF[id];
    G.weapons.push({ id: id, kind: d.kind, level: 1, ang: R(0, TAU), cd: 0, nodes: [] });
  }

  function weaponOf(id) {
    var i;
    for (i = 0; i < G.weapons.length; i++) {
      if (G.weapons[i].id === id) return G.weapons[i];
    }
    return null;
  }

  function orbitSpec(w) {
    if (w.kind === 'orbit') {
      return {
        n: w.level + 1,
        rad: (52 + (w.level - 1) * 7) * S,
        spin: 2.2,
        dmg: (4 + (w.level - 1) * 2) * G.stats.dmg,
        size: 8
      };
    }
    return {
      n: w.level * 2,
      rad: (78 + (w.level - 1) * 6) * S,
      spin: -1.8,
      dmg: (6 + (w.level - 1) * 3) * G.stats.dmg,
      size: 10
    };
  }

  function updWeapons(dt) {
    var i;
    for (i = 0; i < G.weapons.length; i++) {
      var w = G.weapons[i];
      if (w.kind === 'orbit' || w.kind === 'orbit2') updOrbit(w, dt);
      else if (w.kind === 'shoot') updShoot(w, dt);
      else if (w.kind === 'aura') updAura(w, dt);
      else if (w.kind === 'rain') updRain(w, dt);
      else if (w.kind === 'melee') updMelee(w, dt);
      else if (w.kind === 'bounce') updBounce(w, dt);
      else if (w.kind === 'wave') updWave(w, dt);
      else if (w.kind === 'trap') updTrap(w, dt);
      else if (w.kind === 'chain') updChain(w, dt);
    }
  }

  function updOrbit(w, dt) {
    var spec = orbitSpec(w), i, k, a, nx, ny, e;
    w.ang += spec.spin * dt;
    w.nodes = [];
    for (i = 0; i < spec.n; i++) {
      a = w.ang + i * TAU / spec.n;
      nx = G.p.x + Math.cos(a) * spec.rad;
      ny = G.p.y + Math.sin(a) * spec.rad;
      w.nodes.push({ x: nx, y: ny, a: a });
      for (k = 0; k < G.enemies.length; k++) {
        e = G.enemies[k];
        if (e.dead) continue;
        if (G.t - (e.ih[w.id] || -9) < 0.32) continue;
        if (len(nx - e.x, ny - e.y) < e.r + spec.size * S) {
          e.ih[w.id] = G.t;
          hitEnemy(e, spec.dmg, nx, ny, 1);
        }
      }
    }
  }

  function nearestEnemy(x, y) {
    var i, e, bestD = 1e9, pick = null, d;
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead) continue;
      d = len(e.x - x, e.y - y);
      if (d < bestD) { bestD = d; pick = e; }
    }
    return pick;
  }

  function updShoot(w, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    var target = nearestEnemy(G.p.x, G.p.y);
    if (!target) return;
    w.cd = 0.9 / G.stats.rate;
    var n = w.level, i, base = Math.atan2(target.y - G.p.y, target.x - G.p.x);
    var dmg = 5 * G.stats.dmg;
    for (i = 0; i < n; i++) {
      var off = (i - (n - 1) / 2) * 0.22;
      G.bullets.push({
        x: G.p.x, y: G.p.y,
        vx: Math.cos(base + off) * 320 * S,
        vy: Math.sin(base + off) * 320 * S,
        r: 6 * S, dmg: dmg, life: 1.8, hue: RI(0, 5)
      });
    }
    tone(1240, 0.05, 'triangle', 0.03, 1500);
  }

  function updAura(w, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    w.cd = 0.55;
    var rad = (66 + (w.level - 1) * 12) * S;
    var dmg = (3 + (w.level - 1) * 2) * G.stats.dmg;
    var i, e;
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead) continue;
      if (len(e.x - G.p.x, e.y - G.p.y) < rad + e.r) hitEnemy(e, dmg, G.p.x, G.p.y, 0.7);
    }
    G.parts.push({ type: 'ring', x: G.p.x, y: G.p.y, r: rad, t: 0, max: 0.34, color: MINT });
    tone(520, 0.1, 'sine', 0.03, 700);
  }

  function updRain(w, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    w.cd = 1.6;
    var dmg = (8 + (w.level - 1) * 4) * G.stats.dmg;
    var n = w.level, i, e;
    for (i = 0; i < n; i++) {
      e = nearestEnemy(R(0, W), R(0, H));
      var tx = e ? e.x : R(W * 0.2, W * 0.8);
      var ty = e ? e.y : R(H * 0.2, H * 0.8);
      G.strikes.push({ x: tx, y: ty, t: 0.42, max: 0.42, r: 40 * S, dmg: dmg });
    }
    tone(760, 0.16, 'sine', 0.035, 420);
  }

  /* ---------- 五把新武器 ---------- */
  function updMelee(w, dt) {
    w.cd -= dt * G.stats.rate;
    if (w.cd > 0) return;
    w.cd = 1.1;
    var range = (84 + (w.level - 1) * 8) * S;
    var dmg = (10 + (w.level - 1) * 5) * G.stats.dmg;
    var tgt = nearestEnemy(G.p.x, G.p.y);
    var ang = tgt ? Math.atan2(tgt.y - G.p.y, tgt.x - G.p.x) : (G.p.face < 0 ? Math.PI : 0);
    var i, e, dx, dy, dd, da, hitAny = 0;
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead) continue;
      dx = e.x - G.p.x; dy = e.y - G.p.y;
      dd = len(dx, dy);
      if (dd > range + e.r) continue;
      da = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - ang), Math.cos(Math.atan2(dy, dx) - ang)));
      if (da > 1.05) continue;
      hitEnemy(e, dmg, e.x, e.y, 2.4);
      e.vx += Math.cos(ang) * 150 * S;
      e.vy += Math.sin(ang) * 150 * S;
      hitAny++;
    }
    G.fx.push({ kind: 'slash', x: G.p.x, y: G.p.y, a: ang, r: range, t: 0, life: 0.2 });
    tone(hitAny ? 520 : 380, 0.08, 'square', 0.03, hitAny ? 760 : 300);
  }

  function updBounce(w, dt) {
    w.cd -= dt * G.stats.rate;
    if (w.cd > 0) return;
    w.cd = 1.5;
    var tgt = nearestEnemy(G.p.x, G.p.y);
    if (!tgt) return;
    var dx = tgt.x - G.p.x, dy = tgt.y - G.p.y, dd = len(dx, dy) || 1;
    G.bullets.push({
      x: G.p.x, y: G.p.y,
      vx: dx / dd * 300 * S, vy: dy / dd * 300 * S,
      r: 7 * S, life: 2.4,
      dmg: (6 + (w.level - 1) * 3) * G.stats.dmg,
      bounce: 1 + w.level, hit: [], hue: 3, kind: 'jump'
    });
  }

  function updWave(w, dt) {
    w.cd -= dt * G.stats.rate;
    if (w.cd > 0) return;
    w.cd = 2.2;
    G.fx.push({
      kind: 'wave', x: G.p.x, y: G.p.y, r: 16 * S,
      max: (118 + (w.level - 1) * 16) * S,
      t: 0, life: 0.78, id: w.id, slow: 1.6,
      dmg: (6 + (w.level - 1) * 3) * G.stats.dmg
    });
    tone(720, 0.12, 'sine', 0.03, 520);
  }

  function updTrap(w, dt) {
    w.cd -= dt * G.stats.rate;
    if (w.cd > 0) return;
    w.cd = 2.6;
    var cap = 1 + Math.floor(w.level / 2);
    if (G.zones.length >= cap) G.zones.shift();
    var tgt = nearestEnemy(G.p.x, G.p.y);
    var zx = tgt ? tgt.x : G.p.x + R(-40, 40) * S;
    var zy = tgt ? tgt.y : G.p.y + R(-40, 40) * S;
    G.zones.push({
      x: zx, y: zy, r: (44 + (w.level - 1) * 5) * S,
      t: 0, life: 6, id: w.id,
      dps: (4 + (w.level - 1) * 2) * G.stats.dmg
    });
  }

  function updChain(w, dt) {
    w.cd -= dt * G.stats.rate;
    if (w.cd > 0) return;
    w.cd = 1.8;
    var hops = 3 + w.level, dmg = (7 + (w.level - 1) * 4) * G.stats.dmg;
    var fromX = G.p.x, fromY = G.p.y, used = [], pts = [{ x: fromX, y: fromY }], i, t;
    for (i = 0; i < hops; i++) {
      t = nearestEnemyEx(fromX, fromY, used);
      if (!t) break;
      used.push(t);
      pts.push({ x: t.x, y: t.y });
      hitEnemy(t, dmg, t.x, t.y, 0.35);
      fromX = t.x; fromY = t.y;
    }
    if (pts.length > 1) {
      G.fx.push({ kind: 'chain', pts: pts, t: 0, life: 0.24 });
      tone(1180, 0.07, 'square', 0.03, 700);
    }
  }

  function nearestEnemyEx(x, y, skip) {
    var i, e, bestD = 1e9, pick = null, d;
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead || skip.indexOf(e) >= 0) continue;
      d = len(e.x - x, e.y - y);
      if (d < bestD) { bestD = d; pick = e; }
    }
    return pick;
  }

  /* ---------- 地面区与特效 ---------- */
  function updZones(dt) {
    var i, k, z, e;
    for (i = G.zones.length - 1; i >= 0; i--) {
      z = G.zones[i];
      z.t += dt;
      if (z.t >= z.life) { G.zones.splice(i, 1); continue; }
      for (k = 0; k < G.enemies.length; k++) {
        e = G.enemies[k];
        if (e.dead) continue;
        if (len(e.x - z.x, e.y - z.y) < z.r + e.r * 0.45) {
          e.slowT = 0.45;
          if (G.t - (e.ih[z.id + 'z'] || -9) > 0.5) {
            e.ih[z.id + 'z'] = G.t;
            hitEnemy(e, z.dps * 0.5, e.x, e.y, 0.1);
          }
        }
      }
    }
  }

  function updFx(dt) {
    var i, k, f, e, dd;
    for (i = G.fx.length - 1; i >= 0; i--) {
      f = G.fx[i];
      f.t += dt;
      if (f.kind === 'wave') {
        f.r = f.max * Math.min(1, f.t / f.life);
        for (k = 0; k < G.enemies.length; k++) {
          e = G.enemies[k];
          if (e.dead) continue;
          dd = len(e.x - f.x, e.y - f.y);
          if (Math.abs(dd - f.r) < 17 * S && G.t - (e.ih[f.id + 'w'] || -9) > 0.7) {
            e.ih[f.id + 'w'] = G.t;
            e.slowT = f.slow;
            hitEnemy(e, f.dmg, e.x, e.y, 0.5);
          }
        }
      }
      if (f.t >= f.life) G.fx.splice(i, 1);
    }
  }

  function updBullets(dt) {
    var i, k, b, e, dead;
    for (i = 0; i < G.bullets.length; i++) {
      b = G.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) { b.dead = true; continue; }
      dead = false;
      for (k = 0; k < G.enemies.length; k++) {
        e = G.enemies[k];
        if (e.dead) continue;
        if (len(b.x - e.x, b.y - e.y) < b.r + e.r) {
          hitEnemy(e, b.dmg, b.x, b.y, 1.2);
          if (b.bounce > 0) {
            /* 跳跳糖：命中后拐向下一个目标 */
            b.bounce -= 1;
            b.hit.push(e);
            var nx = nearestEnemyEx(b.x, b.y, b.hit);
            if (nx) {
              var bdx = nx.x - b.x, bdy = nx.y - b.y, bdd = len(bdx, bdy) || 1;
              var bsp = len(b.vx, b.vy) || 300 * S;
              b.vx = bdx / bdd * bsp;
              b.vy = bdy / bdd * bsp;
              b.life = Math.max(b.life, 1.4);
              break;
            }
          }
          b.dead = true;
          dead = true;
          break;
        }
      }
      if (dead) continue;
    }
    G.bullets = G.bullets.filter(function (x) { return !x.dead; });
  }

  /* ---------- 伤害与死亡 ---------- */
  function hitEnemy(e, dmg, fx, fy, kb) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.1;
    var dx = e.x - fx, dy = e.y - fy, d = len(dx, dy) || 1;
    var push = 80 * (kb || 1) * (e.def.kb || 1) * S;
    e.vx += dx / d * push;
    e.vy += dy / d * push;
    if (e.hp <= 0) killEnemy(e);
    else if (rand() < 0.35) spark(e.x, e.y, 1);
  }

  function killEnemy(e) {
    e.dead = true;
    G.kills += 1;
    burst(e.x, e.y, e.def.boss ? 18 : 5);
    if (e.def.boss) {
      dropCandy(e.x, e.y, 6);
      G.boss = null;
      G.shake = 12 * S;
      thud();
    } else {
      dropCandy(e.x, e.y, 1);
      tone(980 + R(-120, 120), 0.05, 'square', 0.02, 1400);
      /* 泡泡糖死后炸成两只小泡 */
      if (e.def.split && !e.mini) {
        for (var j = 0; j < e.def.split; j++) {
          var m = spawnEnemy(e.kind, e.x + R(-16, 16) * S, e.y + R(-16, 16) * S);
          m.mini = true;
          m.r = m.r * 0.62;
          m.hp = m.maxHp = 3;
          m.sp = m.sp * 1.2;
        }
      }
    }
  }

  function hurt() {
    if (G.p.inv > 0 || G.god) return;
    G.p.hp -= 1;
    G.p.inv = 1.2;
    G.flash = 0.2;
    G.shake = 9 * S;
    thud();

    /* 受击弹开近身怪，避免贴脸连掉心 */
    var i, e, dx, dy, d, rad = 120 * S;
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead) continue;
      dx = e.x - G.p.x; dy = e.y - G.p.y; d = len(dx, dy) || 1;
      if (d < rad) {
        var k = (rad - d) / rad;
        e.vx += dx / d * (e.def.boss ? 60 : 300) * S * k;
        e.vy += dy / d * (e.def.boss ? 60 : 300) * S * k;
      }
    }
    G.parts.push({ type: 'ring', x: G.p.x, y: G.p.y, r: 104 * S, t: 0, max: 0.32, color: '#F2939F' });

    syncHud();
    if (G.p.hp <= 0) endGame(false);
  }

  /* ---------- 掉落 ---------- */
  function dropCandy(x, y, v) {
    G.drops.push({ x: x, y: y, vx: R(-40, 40), vy: R(-40, 40), v: v, t: 0, life: 13 });
    if (G.drops.length > 90) vacuumDrops();
  }

  /* 场上的糖太多会自动吸走，别让糖堆盖住怪 */
  function vacuumDrops() {
    var i;
    for (i = 0; i < G.drops.length; i++) G.xp += G.drops[i].v;
    G.drops = [];
  }

  function updDrops(dt) {
    var i, d, dx, dy, dd, pull = G.stats.pick * S;
    for (i = 0; i < G.drops.length; i++) {
      d = G.drops[i];
      d.t += dt;
      if (d.t > d.life) { d.dead = true; continue; }
      dx = G.p.x - d.x; dy = G.p.y - d.y;
      dd = len(dx, dy) || 1;
      if (dd < pull) {
        d.x += dx / dd * 300 * S * dt;
        d.y += dy / dd * 300 * S * dt;
      } else {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= 0.94;
        d.vy *= 0.94;
      }
      if (dd < 14 * S) {
        d.dead = true;
        G.xp += d.v;
        blip();
        checkLevel();
      }
    }
    G.drops = G.drops.filter(function (x) { return !x.dead; });
  }

  /* ---------- 粒子 ---------- */
  function burst(x, y, n) {
    var i;
    for (i = 0; i < n; i++) {
      if (G.parts.length > 240) break;
      G.parts.push({
        type: rand() < 0.3 ? 'heart' : 'star',
        x: x, y: y,
        vx: R(-120, 120) * S, vy: R(-140, 40) * S,
        r: R(3, 6) * S, rot: R(0, TAU), vr: R(-6, 6),
        t: 0, max: R(0.35, 0.7),
        color: rand() < 0.5 ? PINK : (rand() < 0.5 ? BUTTER : LILAC)
      });
    }
  }

  function spark(x, y, n) {
    var i;
    for (i = 0; i < n; i++) {
      if (G.parts.length > 240) break;
      G.parts.push({
        type: 'star', x: x, y: y,
        vx: R(-70, 70) * S, vy: R(-90, 20) * S,
        r: R(2, 4) * S, rot: 0, vr: R(-4, 4),
        t: 0, max: 0.3, color: '#FFFFFF'
      });
    }
  }

  function updParts(dt) {
    var i, p;
    for (i = G.parts.length - 1; i >= 0; i--) {
      p = G.parts[i];
      p.t += dt;
      if (p.type === 'ring') {
        if (p.t >= p.max) G.parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * S * dt;
      p.rot += p.vr * dt;
      if (p.t >= p.max) G.parts.splice(i, 1);
    }
  }

  /* ---------- 敌人 ---------- */
  function spawnEnemy(kind, x, y) {
    var def = EDEF[kind];
    var e = {
      kind: kind, def: def,
      x: x, y: y,
      r: def.r * S,
      hp: def.hp * (1 + G.levelIdx * 0.34 + G.t / 150),
      maxHp: 1,
      sp: def.sp * S,
      vx: 0, vy: 0,
      flash: 0, dead: false,
      ih: {}, wob: R(0, TAU), face: 1, sc: R(0.9, 1.1)
    };
    e.maxHp = e.hp;
    G.enemies.push(e);
    if (def.boss) G.boss = e;
    return e;
  }

  function spawnRandom() {
    if (G.enemies.length >= 90) return;
    /* 关卡池按「由易到难」排好，随本关时间逐步放开后几种 */
    var pool = LEVELS[G.levelIdx].pool, k = 1, kind;
    if (G.t > G.dur * 0.20) k = Math.min(pool.length, 2);
    if (G.t > G.dur * 0.50) k = pool.length;
    kind = pool[RI(0, k - 1)];
    var pad = 44 * S, x, y, edge = RI(0, 3);
    if (edge === 0) { x = R(0, W); y = -pad; }
    else if (edge === 1) { x = W + pad; y = R(0, H); }
    else if (edge === 2) { x = R(0, W); y = H + pad; }
    else { x = -pad; y = R(0, H); }
    spawnEnemy(kind, x, y);
  }

  function spawnLogic(dt) {
    G.spawnAcc += dt;
    var lvIdx = G.levelIdx;
    var interval = Math.max(0.24, 0.62 - lvIdx * 0.03 - G.t * 0.0022);
    if (G.spawnAcc >= interval) {
      G.spawnAcc = 0;
      var n = 1 + Math.floor(G.t / 22) + Math.floor(lvIdx / 2), i;
      for (i = 0; i < n; i++) spawnRandom();
    }
    if (!G.bossSpawned && G.t >= G.dur - 20) {
      G.bossSpawned = true;
      spawnEnemy(LEVELS[lvIdx].boss, W / 2, -110 * S);
      bossSfx();
      G.shake = 10 * S;
    }
    if (G.boss && !G.boss.dead) {
      G.boss.summon = (G.boss.summon || 0) - dt;
      if (G.boss.summon <= 0) {
        G.boss.summon = 2.5;
        var k, mk = G.boss.def.minion || 'pudding';
        for (k = 0; k < 3; k++) {
          spawnEnemy(mk, G.boss.x + R(-40, 40) * S, G.boss.y + R(-30, 30) * S);
        }
      }
    }
  }

  function updEnemies(dt) {
    var i, k, e, f, dx, dy, d, minD, push;
    var list = G.enemies;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.dead) continue;
      dx = G.p.x - e.x; dy = G.p.y - e.y;
      d = len(dx, dy) || 1;
      var mvx = dx / d, mvy = dy / d, sp = e.sp;

      /* 草莓炮是远程单位：正常逼近，但贴到 70 就停住并往回让一点。
         停太远纯近战流够不着，停太近又糊在脸上，70 是环绕武器刚好够到的距离。 */
      if (e.def.shoot && d < 70 * S) sp = -e.sp * 0.5;
      /* BOSS 从屏外落场：落地前加速，落定在 HUD 下方，别被顶部 UI 压住脑袋 */
      if (e.def.boss && e.y < 190 * S) sp *= 6;

      if (e.def.drift) {
        /* 棉花云：不追人，自己慢慢飘 */
        e.driftT = (e.driftT || 0) - dt;
        if (e.driftT <= 0) { e.driftT = R(0.8, 1.8); e.driftA = R(0, TAU); }
        mvx = Math.cos(e.driftA || 0);
        mvy = Math.sin(e.driftA || 0);
      } else if (e.def.charge) {
        /* 巧克力球：一顿一顿地冲 */
        e.chg = (e.chg === undefined ? R(0.6, 2) : e.chg) - dt;
        if (e.chg <= -0.55) e.chg = R(1.7, 2.4);
        if (e.chg <= 0) sp *= 3.2;
      } else if (e.def.hop) {
        /* 瓶盖：一跳一跳 */
        sp *= 0.3 + Math.abs(Math.sin(e.wob * 1.7)) * 1.15;
      } else if (e.def.orbit) {
        /* 星星糖：绕着玩家螺旋靠近 */
        mvx = dx / d * 0.55 - dy / d * 0.85;
        mvy = dy / d * 0.55 + dx / d * 0.85;
      }

      if (e.slowT > 0) { e.slowT -= dt; sp *= 0.5; }

      e.x += mvx * sp * dt + e.vx * dt;
      e.y += mvy * sp * dt + e.vy * dt;
      e.vx -= e.vx * 9 * dt;
      e.vy -= e.vy * 9 * dt;
      e.face = dx < 0 ? -1 : 1;

      /* 草莓炮：站定往玩家吐籽 */
      if (e.def.shoot) {
        e.sht = (e.sht === undefined ? R(1.2, 2.2) : e.sht) - dt;
        if (e.sht <= 0) {
          e.sht = 2.2;
          if (d < 340 * S) fireSeed(e, dx / d, dy / d);
        }
      }
      e.wob += dt * (e.kind === 'jelly' ? 8 : 4);
      if (e.flash > 0) e.flash -= dt;

      /* 互相挤开：怪不叠成一坨，包围圈才好看 */
      for (k = i + 1; k < list.length; k++) {
        f = list[k];
        if (f.dead) continue;
        dx = f.x - e.x; dy = f.y - e.y;
        minD = e.r + f.r;
        if (dx > minD || dx < -minD || dy > minD || dy < -minD) continue;
        d = len(dx, dy) || 0.01;
        if (d < minD) {
          push = (minD - d) / d * 0.42;
          e.x -= dx * push;
          e.y -= dy * push;
          f.x += dx * push;
          f.y += dy * push;
        }
      }

      if (len(G.p.x - e.x, G.p.y - e.y) < e.r + G.p.r * S * 0.8) hurt();
    }
    G.enemies = list.filter(function (x) { return !x.dead; });
  }

  function fireSeed(e, nx, ny) {
    G.ebullets.push({ x: e.x + nx * e.r, y: e.y + ny * e.r, vx: nx * 158 * S, vy: ny * 158 * S, r: 6 * S, t: 4 });
    tone(620, 0.05, 'sine', 0.02, 460);
  }

  function updEBullets(dt) {
    var i, b, n = 0, keep = [];
    for (i = 0; i < G.ebullets.length; i++) {
      b = G.ebullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.t -= dt;
      if (b.t <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) continue;
      if (len(b.x - G.p.x, b.y - G.p.y) < b.r + G.p.r * S * 0.72) { hurt(); continue; }
      keep.push(b);
    }
    G.ebullets = keep;
  }

  function updStrikes(dt) {
    var i, k, s, e;
    for (i = G.strikes.length - 1; i >= 0; i--) {
      s = G.strikes[i];
      s.t -= dt;
      if (s.t > 0) continue;
      for (k = 0; k < G.enemies.length; k++) {
        e = G.enemies[k];
        if (e.dead) continue;
        if (len(e.x - s.x, e.y - s.y) < s.r + e.r) hitEnemy(e, s.dmg, s.x, s.y, 1.4);
      }
      burst(s.x, s.y, 6);
      G.strikes.splice(i, 1);
      G.shake = Math.max(G.shake, 4 * S);
      tone(320, 0.12, 'sine', 0.045, 180);
    }
  }

  /* ---------- 玩家 ---------- */
  function updPlayer(dt) {
    var jx = G.joy.dx, jy = G.joy.dy, m = len(jx, jy);
    if (m > 1) { jx /= m; jy /= m; m = 1; }
    if (m > 0.06) {
      var sp = G.p.spd * S * m;
      G.p.x += jx * sp * dt;
      G.p.y += jy * sp * dt;
      if (Math.abs(jx) > 0.15) G.p.face = jx < 0 ? -1 : 1;
      G.p.bob += dt * 12;
    } else {
      G.p.bob += dt * 3;
    }
    var pr = G.p.r * S;
    G.p.x = clamp(G.p.x, pr + 4, W - pr - 4);
    G.p.y = clamp(G.p.y, pr + 76 * S, H - pr - 14 * S);
    if (G.p.inv > 0) G.p.inv -= dt;
  }

  /* ---------- 升级 ---------- */
  function checkLevel() {
    if (G.xp >= G.xpNext && G.drops.length) vacuumDrops();
    if (G.xp < G.xpNext) { syncHud(); return; }
    while (G.xp >= G.xpNext) {
      G.xp -= G.xpNext;
      G.level += 1;
      G.xpNext = 6 + G.level * 5;
      G.pend += 1;
    }
    levelSfx();
    if (G.state === 'play') openUpgrade();
    syncHud();
  }

  function buildChoices() {
    var owned = {}, i, id, ups = [], news = [], out = [];
    for (i = 0; i < G.weapons.length; i++) owned[G.weapons[i].id] = G.weapons[i];

    for (i = 0; i < G.weapons.length; i++) {
      if (G.weapons[i].level < 5) ups.push({ type: 'up', id: G.weapons[i].id });
    }
    if (G.weapons.length < 4) {
      for (id in WDEF) {
        if (Object.prototype.hasOwnProperty.call(WDEF, id) && !owned[id]) news.push({ type: 'new', id: id });
      }
    }

    shuffle(ups); shuffle(news);

    if (ups.length) out.push(ups.shift());
    if (news.length) out.push(news.shift());

    var pool = [];
    for (i = 0; i < ups.length; i++) pool.push(ups[i]);
    for (i = 0; i < news.length; i++) pool.push(news[i]);
    for (i = 0; i < PROPS.length; i++) pool.push({ type: 'prop', id: PROPS[i].id });

    shuffle(pool);
    while (out.length < 3 && pool.length) out.push(pool.shift());
    shuffle(out);
    return out;
  }

  function shuffle(a) {
    var i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(rand() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function cardText(c) {
    var w, p, lv;
    if (c.type === 'prop') {
      for (var i = 0; i < PROPS.length; i++) {
        if (PROPS[i].id === c.id) {
          return { tag: '加属性', tagCls: 'prop', name: PROPS[i].name, desc: PROPS[i].desc, lv: 0 };
        }
      }
      return { tag: '加属性', tagCls: 'prop', name: '?', desc: '', lv: 0 };
    }
    w = WDEF[c.id];
    if (c.type === 'new') {
      return { tag: '新武器 · ' + w.tag, tagCls: '', name: w.name, desc: w.intro || '拿到手就自动开打', lv: 0 };
    }
    lv = weaponOf(c.id) ? weaponOf(c.id).level : 1;
    return { tag: '升级 · ' + w.tag, tagCls: 'up', name: w.name + ' Lv.' + (lv + 1), desc: w.desc(lv), lv: lv };
  }

  function openUpgrade() {
    G.state = 'up';
    var box = document.getElementById('upCards');
    box.innerHTML = '';
    var choices = buildChoices(), i, c, t, el;
    for (i = 0; i < choices.length; i++) {
      c = choices[i];
      t = cardText(c);
      el = document.createElement('div');
      el.className = 'card';
      el.setAttribute('data-i', String(i));
      el.innerHTML = '<span class="card-tag ' + t.tagCls + '">' + t.tag + '</span>'
        + '<div class="card-name">' + t.name + '</div>'
        + '<div class="card-desc">' + t.desc + '</div>';
      (function (idx) {
        el.addEventListener('click', function () { pickUpgrade(idx); }, false);
      })(i);
      box.appendChild(el);
    }
    document.getElementById('upLv').textContent = String(G.level);
    document.getElementById('up').className = 'screen on';
    G.__choices = choices;
  }

  function pickUpgrade(idx) {
    var c = G.__choices[idx];
    if (!c) return;
    if (c.type === 'prop') applyProp(c.id);
    else if (c.type === 'new') addWeapon(c.id);
    else {
      var w = weaponOf(c.id);
      if (w) w.level += 1;
    }
    G.__choices = null;
    G.pend -= 1;
    document.getElementById('up').className = 'screen';
    if (G.pend > 0) openUpgrade();
    else G.state = 'play';
    syncHud();
    tone(1040, 0.08, 'triangle', 0.04, 1320);
  }

  function applyProp(id) {
    if (id === 'dmg') G.stats.dmg += 0.1;
    else if (id === 'rate') G.stats.rate += 0.12;
    else if (id === 'spd') G.p.spd += 8;
    else if (id === 'pick') G.stats.pick = Math.round(G.stats.pick * 1.2);
    else if (id === 'heal') {
      G.p.maxHp = Math.min(8, G.p.maxHp + 1);
      G.p.hp = Math.min(G.p.maxHp, G.p.hp + 1);
    }
  }

  /* ---------- HUD ---------- */
  var hudCache = { hp: -1, max: -1, kills: -1, lv: -1, xp: -1 };

  function syncHud() {
    if (G.p.hp !== hudCache.hp || G.p.maxHp !== hudCache.max) {
      var box = document.getElementById('hearts'), html = '', i;
      for (i = 0; i < G.p.maxHp; i++) {
        html += '<i class="' + (i < G.p.hp ? 'on' : 'off') + '">\u2665</i>';
      }
      box.innerHTML = html;
      hudCache.hp = G.p.hp;
      hudCache.max = G.p.maxHp;
    }
    if (G.kills !== hudCache.kills) {
      document.getElementById('kills').textContent = String(G.kills);
      hudCache.kills = G.kills;
    }
    if (G.level !== hudCache.lv) {
      document.getElementById('lvtxt').textContent = 'Lv.' + G.level;
      hudCache.lv = G.level;
    }
    if (G.xp !== hudCache.xp) {
      var pct = Math.min(100, Math.round(G.xp / G.xpNext * 100));
      document.getElementById('lvfill').style.width = pct + '%';
      hudCache.xp = G.xp;
    }
  }

  function syncClock() {
    var left = Math.max(0, (G ? G.dur : LEVELS[0].dur) - (G ? G.t : 0));
    var m = Math.floor(left / 60), s = Math.floor(left % 60);
    document.getElementById('clock').textContent = m + ':' + (s < 10 ? '0' + s : String(s));
  }

  /* ---------- 绘制小工具 ---------- */
  function star(g, x, y, r, rot, color, inner, stroke, sw) {
    var i, a, rad;
    g.beginPath();
    for (i = 0; i < 10; i++) {
      a = rot + i * Math.PI / 5 - Math.PI / 2;
      rad = (i % 2 === 0) ? r : r * (inner || 0.44);
      if (i === 0) g.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      else g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (stroke) {
      g.lineWidth = sw || 2;
      g.strokeStyle = stroke;
      g.stroke();
    }
  }

  function heart(g, x, y, r, color) {
    g.save();
    g.translate(x, y);
    g.beginPath();
    g.moveTo(0, r * 0.75);
    g.bezierCurveTo(-r * 1.3, -r * 0.15, -r * 0.55, -r * 1.05, 0, -r * 0.35);
    g.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.3, -r * 0.15, 0, r * 0.75);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.restore();
  }

  function rrect(g, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.lineTo(x + w - rr, y);
    g.quadraticCurveTo(x + w, y, x + w, y + rr);
    g.lineTo(x + w, y + h - rr);
    g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    g.lineTo(x + rr, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - rr);
    g.lineTo(x, y + rr);
    g.quadraticCurveTo(x, y, x + rr, y);
    g.closePath();
  }

  function eyes(g, x, y, r, face) {
    g.fillStyle = INK;
    g.beginPath(); g.arc(x - r * 0.34, y, r * 0.15, 0, TAU); g.fill();
    g.beginPath(); g.arc(x + r * 0.34, y, r * 0.15, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(x - r * 0.38, y - r * 0.06, r * 0.05, 0, TAU); g.fill();
    g.beginPath(); g.arc(x + r * 0.30, y - r * 0.06, r * 0.05, 0, TAU); g.fill();
    g.fillStyle = 'rgba(242,147,159,0.55)';
    g.beginPath(); g.arc(x - r * 0.62, y + r * 0.34, r * 0.16, 0, TAU); g.fill();
    g.beginPath(); g.arc(x + r * 0.62, y + r * 0.34, r * 0.16, 0, TAU); g.fill();
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bgCv, 0, 0, W, H);

    if (!G) return;

    ctx.save();
    if (G.shake > 0) {
      ctx.translate(Math.sin(G.t * 62) * G.shake * 0.6, Math.cos(G.t * 51) * G.shake * 0.5);
    }

    drawZones();
    drawDrops();
    drawStrikes();
    drawEnemies();
    drawEBullets();
    drawBullets();
    drawPlayer();
    drawWeapons();
    drawFx();
    drawParts();

    ctx.restore();

    if (G.flash > 0) {
      ctx.fillStyle = 'rgba(255,120,140,' + Math.min(0.45, G.flash * 1.1) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawDrops() {
    var i, d, r = 5 * S, bob;
    for (i = 0; i < G.drops.length; i++) {
      d = G.drops[i];
      bob = Math.sin(G.t * 6 + i) * 1.5 * S;
      ctx.globalAlpha = d.t > d.life - 2 ? Math.max(0.15, (d.life - d.t) / 2) : 1;
      ctx.beginPath();
      ctx.arc(d.x, d.y + bob, r, 0, TAU);
      ctx.fillStyle = PINK;
      ctx.fill();
      ctx.lineWidth = 2 * S;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(d.x - r * 0.28, d.y + bob - r * 0.3, r * 0.26, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawStrikes() {
    var i, s, k, a;
    for (i = 0; i < G.strikes.length; i++) {
      s = G.strikes[i];
      k = 1 - s.t / s.max;
      a = 0.25 + k * 0.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fillStyle = 'rgba(255,227,163,' + (a * 0.35) + ')';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.4 + k * 0.6), 0, TAU);
      ctx.strokeStyle = 'rgba(217,166,46,' + a + ')';
      ctx.lineWidth = 2.5 * S;
      ctx.stroke();
      star(ctx, s.x, s.y - (1 - k) * 90 * S, 11 * S, G.t * 4, BUTTER, 0.45);
    }
  }

  /* 素材索引：BOSS 里三只没有专属立绘，用同关杂兵放大 */
  var ART_KEY = {
    pudding: 'pudding', jelly: 'jelly', bat: 'bat', cake: 'cake',
    gum: 'gum', cloud: 'cloud', choco: 'choco', cookie: 'cookie',
    cap: 'cap', berry: 'berry', star: 'star',
    b1: 'b1', b2: 'b2', b3: 'b3', b4: 'b4',
    cloudK: 'cloudK', capK: 'capK', starK: 'starK'
  };

  function drawCrown(r, color) {
    var y = -r * 1.02, w = r * 0.82, h = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(-w / 2, y);
    ctx.lineTo(-w / 2, y - h * 0.7);
    ctx.lineTo(-w * 0.24, y - h * 0.2);
    ctx.lineTo(0, y - h);
    ctx.lineTo(w * 0.24, y - h * 0.2);
    ctx.lineTo(w / 2, y - h * 0.7);
    ctx.lineTo(w / 2, y);
    ctx.closePath();
    ctx.fillStyle = color || '#FFD98A';
    ctx.fill();
    ctx.lineWidth = 2.6 * S;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  /* 缺素材时的几何回退：每种怪一个可辨剪影 */
  function drawEnemyGeo(e) {
    var r = e.r, c = e.flash > 0 ? '#FFFFFF' : e.def.color, d = e.def.dark;
    if (e.kind === 'pudding') {
      rrect(ctx, -r, -r * 0.92, r * 2, r * 1.92, r * 0.55);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 3 * S; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.55, r * 0.62, r * 0.3, 0, 0, TAU);
      ctx.fillStyle = '#C98A47'; ctx.fill();
      eyes(ctx, 0, r * 0.1, r, e.face);
    } else if (e.kind === 'jelly') {
      rrect(ctx, -r, -r, r * 2, r * 2, r * 0.5);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = c; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3 * S; ctx.strokeStyle = d; ctx.stroke();
      eyes(ctx, 0, -r * 0.1, r, e.face);
    } else if (e.kind === 'bat') {
      var flap = Math.sin(e.wob * 2.2) * 0.5;
      ctx.beginPath();
      ctx.ellipse(-r * 1.2, -flap * r * 0.3, r * 0.72, r * 0.4, -0.4 - flap * 0.3, 0, TAU);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 2.4 * S; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(r * 1.2, -flap * r * 0.3, r * 0.72, r * 0.4, 0.4 + flap * 0.3, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 3 * S; ctx.strokeStyle = INK; ctx.stroke();
      eyes(ctx, 0, -r * 0.1, r * 0.9, e.face);
    } else if (e.kind === 'cake') {
      rrect(ctx, -r, -r * 0.25, r * 2, r * 1.25, r * 0.3);
      ctx.fillStyle = '#FFE9C9'; ctx.fill();
      ctx.lineWidth = 3 * S; ctx.strokeStyle = INK; ctx.stroke();
      rrect(ctx, -r * 0.82, -r * 0.95, r * 1.64, r * 0.8, r * 0.34);
      ctx.fillStyle = c; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -r * 1.02, r * 0.16, 0, TAU);
      ctx.fillStyle = '#E2557B'; ctx.fill();
      eyes(ctx, 0, r * 0.3, r * 0.85, e.face);
    } else if (e.kind === 'gum') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 3 * S; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.5, r * 0.2, 0, TAU);
      ctx.arc(r * 0.5, -r * 0.35, r * 0.14, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
      eyes(ctx, 0, r * 0.05, r * 0.9, e.face);
    } else if (e.kind === 'cloud') {
      ctx.beginPath();
      ctx.arc(-r * 0.45, r * 0.1, r * 0.62, 0, TAU);
      ctx.arc(r * 0.42, r * 0.12, r * 0.56, 0, TAU);
      ctx.arc(0, -r * 0.34, r * 0.66, 0, TAU);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 3 * S; ctx.strokeStyle = d; ctx.stroke();
      eyes(ctx, 0, 0, r * 0.8, e.face);
    } else if (e.kind === 'choco') {
      rrect(ctx, -r, -r, r * 2, r * 2, r * 0.34);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 3 * S; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.1); ctx.lineTo(r, -r * 0.1);
      ctx.moveTo(0, -r); ctx.lineTo(0, r);
      ctx.strokeStyle = 'rgba(110,67,39,0.45)'; ctx.lineWidth = 2.2 * S; ctx.stroke();
      eyes(ctx, 0, r * 0.34, r * 0.68, e.face);
    } else if (e.kind === 'cookie') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 3 * S; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.4, -r * 0.34, r * 0.14, 0, TAU);
      ctx.arc(r * 0.38, -r * 0.2, r * 0.12, 0, TAU);
      ctx.arc(r * 0.1, r * 0.52, r * 0.13, 0, TAU);
      ctx.fillStyle = '#6E4327'; ctx.fill();
      eyes(ctx, 0, r * 0.06, r * 0.82, e.face);
    } else if (e.kind === 'cap') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 3 * S; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath();
      for (var ci = 0; ci < 10; ci++) {
        var ca = ci * TAU / 10;
        ctx.moveTo(Math.cos(ca) * r * 0.98, Math.sin(ca) * r * 0.98);
        ctx.lineTo(Math.cos(ca) * r * 0.76, Math.sin(ca) * r * 0.76);
      }
      ctx.strokeStyle = d; ctx.lineWidth = 2.2 * S; ctx.stroke();
      eyes(ctx, 0, 0, r * 0.72, e.face);
    } else if (e.kind === 'berry') {
      ctx.beginPath(); ctx.arc(0, r * 0.1, r, 0, TAU);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 3 * S; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, -r * 0.86, r * 0.38, r * 0.2, -0.6, 0, TAU);
      ctx.ellipse(r * 0.3, -r * 0.86, r * 0.38, r * 0.2, 0.6, 0, TAU);
      ctx.fillStyle = '#6FC7AA'; ctx.fill();
      ctx.stroke();
      eyes(ctx, 0, r * 0.16, r * 0.8, e.face);
    } else if (e.kind === 'star') {
      star(ctx, 0, 0, r * 1.15, e.wob * 0.6, c, 0.46, INK, 3 * S);
      eyes(ctx, 0, r * 0.06, r * 0.72, e.face);
    } else {
      /* 几何回退的 BOSS：三层塔 + 王冠 */
      rrect(ctx, -r, r * 0.1, r * 2, r * 0.9, r * 0.26);
      ctx.fillStyle = '#FFE9C9'; ctx.fill();
      ctx.lineWidth = 3 * S; ctx.strokeStyle = INK; ctx.stroke();
      rrect(ctx, -r * 0.78, -r * 0.5, r * 1.56, r * 0.66, r * 0.24);
      ctx.fillStyle = c; ctx.fill(); ctx.stroke();
      rrect(ctx, -r * 0.5, -r * 1.05, r, r * 0.6, r * 0.2);
      ctx.fillStyle = '#FFF3D6'; ctx.fill(); ctx.stroke();
      eyes(ctx, 0, r * 0.42, r * 0.7, e.face);
      drawCrown(r, e.def.crown);
    }
  }

  function drawEnemies() {
    var i, e, code, size, ratio;
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead) continue;
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === 'jelly' || e.kind === 'pudding') {
        var sq = 1 + Math.sin(e.wob) * (e.kind === 'jelly' ? 0.08 : 0.05);
        ctx.scale(1 / sq, sq);
      }

      code = ART_KEY[e.kind];
      size = e.r * (e.def.boss ? 2.34 : 2.62) * e.sc;
      /* BOSS 立绘自带王冠，只有退回几何绘制时才需要代码补一顶 */
      if (code && blitCentered(code, size, e.face, 0)) {
        if (e.flash > 0) flashOverlay(e.r * 1.0);
      } else {
        drawEnemyGeo(e);
      }
      ctx.restore();

      /* 血条：只在受伤过、且个头够大的怪身上显示 */
      ratio = e.hp / e.maxHp;
      if (ratio < 0.999 && (e.def.boss || e.r > 21 * S)) {
        var w = e.r * 1.25, h = 2.6 * S;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 9 * S, w, h);
        ctx.fillStyle = 'rgba(242,147,159,0.85)';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 9 * S, w * Math.max(0, ratio), h);
      }
    }

    if (G.boss && !G.boss.dead) {
      /* 血条挂在 BOSS 头顶跟着走，别固定在顶上被它自己压住 */
      var bw = W * 0.5, bh = 6.5 * S, bx = (W - bw) / 2;
      var by = G.boss.y - G.boss.r * 1.17 - 18 * S;
      if (by < 96 * S) by = 96 * S;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      rrect(ctx, bx, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      rrect(ctx, bx, by, bw, bh, bh / 2);
      ctx.clip();
      ctx.fillStyle = '#E2557B';
      ctx.fillRect(bx, by, bw * Math.max(0, G.boss.hp / G.boss.maxHp), bh);
      ctx.restore();
      ctx.lineWidth = 1.8 * S;
      ctx.strokeStyle = 'rgba(91,75,75,0.5)';
      rrect(ctx, bx, by, bw, bh, bh / 2);
      ctx.stroke();
    }
  }

  function drawZones() {
    var i, z, k;
    for (i = 0; i < G.zones.length; i++) {
      z = G.zones[i];
      k = 1 - z.t / z.life;
      ctx.beginPath();
      ctx.ellipse(z.x, z.y, z.r, z.r * 0.82, 0, 0, TAU);
      ctx.fillStyle = 'rgba(255,214,120,' + (0.30 * (0.4 + k * 0.6)) + ')';
      ctx.fill();
      ctx.lineWidth = 2.4 * S;
      ctx.strokeStyle = 'rgba(217,166,46,' + (0.5 * k) + ')';
      ctx.stroke();
      /* 表面两滴高光，暗示黏 */
      ctx.beginPath();
      ctx.arc(z.x - z.r * 0.32, z.y - z.r * 0.2, z.r * 0.13, 0, TAU);
      ctx.arc(z.x + z.r * 0.28, z.y + z.r * 0.16, z.r * 0.09, 0, TAU);
      ctx.fillStyle = 'rgba(255,245,210,' + (0.55 * k) + ')';
      ctx.fill();
    }
  }

  function drawEBullets() {
    var i, b;
    for (i = 0; i < G.ebullets.length; i++) {
      b = G.ebullets[i];
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fillStyle = '#C04E6A';
      ctx.fill();
      ctx.lineWidth = 1.8 * S;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.3, b.r * 0.3, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();
    }
  }

  function drawFx() {
    var i, f, k, j;
    for (i = 0; i < G.fx.length; i++) {
      f = G.fx[i];
      k = 1 - f.t / f.life;
      if (f.kind === 'wave') {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, TAU);
        ctx.strokeStyle = 'rgba(143,224,192,' + (0.75 * k) + ')';
        ctx.lineWidth = (7 * k + 1.5) * S;
        ctx.stroke();
      } else if (f.kind === 'slash') {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.a);
        ctx.beginPath();
        ctx.arc(0, 0, f.r, -0.95, 0.95);
        ctx.strokeStyle = 'rgba(255,211,110,' + (0.85 * k) + ')';
        ctx.lineWidth = (13 * k + 2) * S;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, f.r * 0.72, -0.9, 0.9);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * k) + ')';
        ctx.lineWidth = (6 * k + 1) * S;
        ctx.stroke();
        ctx.restore();
        ctx.lineCap = 'butt';
      } else if (f.kind === 'chain') {
        ctx.beginPath();
        ctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (j = 1; j < f.pts.length; j++) ctx.lineTo(f.pts[j].x, f.pts[j].y);
        ctx.strokeStyle = 'rgba(255,211,110,' + (0.9 * k) + ')';
        ctx.lineWidth = 4.5 * S;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * k) + ')';
        ctx.lineWidth = 1.8 * S;
        ctx.stroke();
        for (j = 1; j < f.pts.length; j++) {
          star(ctx, f.pts[j].x, f.pts[j].y, 7 * S, f.t * 12 + j, '#FFF3D6', 0.45);
        }
      }
    }
  }

  function drawBullets() {
    var i, b, colors = ['#FF9FB4', '#FFD46E', '#8FDCC4', '#B9A8F2', '#8FC7F2'];
    for (i = 0; i < G.bullets.length; i++) {
      b = G.bullets[i];
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fillStyle = colors[b.hue % colors.length];
      ctx.fill();
      ctx.lineWidth = 2 * S; ctx.strokeStyle = INK; ctx.stroke();
    }
  }

  /* ---------- 美术素材层 ----------
     素材只承载「主体」，光影/受击/粒子全部由代码叠加（见 docs/specs/...-art-pack.md）。
     任何一张图缺失或加载失败，该主体自动回退到下面的几何绘制，不影响可玩性。 */
  var ART = {};
  var ART_DONE = 0;
  var ART_LIST = ['hero', 'mint', 'cocoa', 'starry', 'pudding', 'jelly', 'bat', 'cake',
    'gum', 'cloud', 'choco', 'cookie', 'cap', 'berry', 'star',
    'b1', 'b2', 'b3', 'b4', 'cloudK', 'capK', 'starK'];
  var HERO_COLOR = { hero: '#FFB3C6', mint: '#8FE0C0', cocoa: '#B07A4E', starry: '#FFD36E' };

  function loadArt() {
    var i;
    for (i = 0; i < ART_LIST.length; i++) {
      (function (code) {
        var im = new Image();
        im.onload = function () { ART[code] = im; ART_DONE++; };
        im.onerror = function () { ART_DONE++; };
        im.src = './assets/art/' + code + '.png';
      })(ART_LIST[i]);
    }
  }

  /* 在已 translate 的坐标系里贴图；返回 false 表示没图，调用方走几何分支 */
  function blitCentered(code, size, face, dy) {
    var im = ART[code];
    if (!im) return false;
    ctx.save();
    if (face < 0) ctx.scale(-1, 1);
    ctx.drawImage(im, -size / 2, -size / 2 + (dy || 0), size, size);
    ctx.restore();
    return true;
  }

  /* 受击闪白：图片没法改色，用一层半透明白圆代替 */
  function flashOverlay(r) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  }

  function drawPlayer() {
    var p = G.p;
    if (p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0) return;
    var pr = p.r * S;
    var sq = 1 + Math.sin(p.bob) * 0.06;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1 / sq, sq);

    /* 影子 */
    ctx.beginPath();
    ctx.ellipse(0, pr * 0.98, pr * 0.85, pr * 0.28, 0, 0, TAU);
    ctx.fillStyle = 'rgba(91,75,75,0.13)';
    ctx.fill();

    /* 贴纸白底：比素材略大一圈，让主角在怪堆里一眼可辨 */
    ctx.beginPath();
    ctx.arc(0, 0, pr * 1.52, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();

    /* 身体：优先用美术素材（含星芽），缺图时回退成同色圆球 */
    if (!blitCentered(p.skin || 'hero', pr * 3.16, p.face, pr * 0.02)) {
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, TAU);
      ctx.fillStyle = HERO_COLOR[p.skin] || PINK;
      ctx.fill();
      ctx.lineWidth = 3.4 * S;
      ctx.strokeStyle = INK;
      ctx.stroke();

      /* 高光 */
      ctx.beginPath();
      ctx.ellipse(-pr * 0.34, -pr * 0.42, pr * 0.24, pr * 0.16, -0.7, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fill();

      /* 头顶小星 */
      star(ctx, pr * 0.62, -pr * 0.92, pr * 0.34, G.t * 2, BUTTER, 0.45, INK, 2 * S);

      eyes(ctx, 0, -pr * 0.05, pr * 0.95, p.face);
    }

    /* 受击闪白：贴图与几何都叠一层，视觉一致 */
    if (p.inv > 0.86 && ART[p.skin || 'hero']) flashOverlay(pr * 1.2);

    ctx.restore();
  }

  function drawWeapons() {
    var i, j, w, n;
    for (i = 0; i < G.weapons.length; i++) {
      w = G.weapons[i];
      if (!w.nodes || (w.kind !== 'orbit' && w.kind !== 'orbit2')) continue;
      for (j = 0; j < w.nodes.length; j++) {
        n = w.nodes[j];
        if (w.kind === 'orbit') {
          star(ctx, n.x, n.y + 1.2 * S, 10 * S, n.a * 2, 'rgba(217,166,46,0.35)', 0.44);
          star(ctx, n.x, n.y, 10 * S, n.a * 2, '#FFD36E', 0.44, INK, 1.3 * S);
          ctx.beginPath();
          ctx.arc(n.x - 2.4 * S, n.y - 2.8 * S, 1.7 * S, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 8 * S, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fill();
          ctx.beginPath();
          for (var k = 0; k < 3; k++) {
            var a = n.a + k * TAU / 3;
            ctx.arc(n.x + Math.cos(a) * 4 * S, n.y + Math.sin(a) * 4 * S, 3.2 * S, 0, TAU);
          }
          ctx.fillStyle = PINK;
          ctx.fill();
          ctx.lineWidth = 1.6 * S; ctx.strokeStyle = INK; ctx.stroke();
        }
      }
    }
  }

  function drawParts() {
    var i, p, k;
    for (i = 0; i < G.parts.length; i++) {
      p = G.parts[i];
      k = 1 - p.t / p.max;
      if (p.type === 'ring') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.7 + p.t / p.max * 0.4), 0, TAU);
        ctx.strokeStyle = 'rgba(184,235,217,' + k * 0.9 + ')';
        ctx.lineWidth = 4 * S * k;
        ctx.stroke();
      } else if (p.type === 'heart') {
        ctx.globalAlpha = k;
        heart(ctx, p.x, p.y, p.r, p.color);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = k;
        star(ctx, p.x, p.y, p.r, p.rot, p.color, 0.45);
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ---------- 主循环 ---------- */
  function step(dt) {
    /* 关卡标题卡期间：只允许走位，不推进计时、不刷怪 */
    if (G.state === 'intro') {
      G.introT -= dt;
      updPlayer(dt);
      updParts(dt);
      if (G.introT <= 0) { G.state = 'play'; hideLevelCard(); }
      return;
    }
    G.t += dt;
    updPlayer(dt);
    updWeapons(dt);
    updEnemies(dt);
    updBullets(dt);
    updEBullets(dt);
    updZones(dt);
    updFx(dt);
    updDrops(dt);
    updStrikes(dt);
    updParts(dt);
    spawnLogic(dt);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30 * S);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt);
    syncClock();
    syncHud();
    if (G.t >= G.dur && G.state === 'play') endGame(true);
  }

  var lastTs = 0;

  function loop(ts) {
    var dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05;
    if (G && (G.state === 'play' || G.state === 'intro')) step(dt);
    else if (G && G.state === 'up') {
      updParts(dt);
      if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30 * S);
    }
    draw();
    window.requestAnimationFrame(loop);
  }

  /* ---------- 输入 ---------- */
  function bindInput() {
    var joy = document.getElementById('joy');
    var knob = document.getElementById('knob');
    var baseR = 34 * S;

    function setKnob(dx, dy) {
      knob.style.webkitTransform = 'translate(' + dx + 'px,' + dy + 'px)';
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }

    function moveTo(x, y) {
      var j = G ? G.joy : null;
      if (!j) return;
      var dx = x - j.bx, dy = y - j.by, d = len(dx, dy);
      if (d > baseR) { dx = dx / d * baseR; dy = dy / d * baseR; }
      j.dx = dx / baseR;
      j.dy = dy / baseR;
      setKnob(dx, dy);
    }

    function start(x, y, id) {
      if (!G || G.state !== 'play') return;
      if (y < H * 0.26) return;
      G.joy.on = true;
      G.joy.id = id;
      G.joy.bx = x;
      G.joy.by = y;
      G.joy.dx = 0;
      G.joy.dy = 0;
      joy.className = 'on';
      joy.style.left = (x - 10.5 * (W / 100)) + 'px';
      joy.style.top = (y - 10.5 * (W / 100)) + 'px';
      joy.style.bottom = 'auto';
      setKnob(0, 0);
    }

    function end() {
      if (!G) return;
      G.joy.on = false;
      G.joy.dx = 0;
      G.joy.dy = 0;
      joy.className = '';
      setKnob(0, 0);
    }

    function pick(e) {
      var t = e.changedTouches ? e.changedTouches[0] : e;
      return { x: t.clientX, y: t.clientY, id: t.identifier };
    }

    if (window.PointerEvent) {
      document.addEventListener('pointerdown', function (e) {
        if (e.target && e.target.tagName === 'BUTTON') return;
        start(e.clientX, e.clientY, e.pointerId);
      }, false);
      document.addEventListener('pointermove', function (e) {
        if (!G || !G.joy.on || e.pointerId !== G.joy.id) return;
        moveTo(e.clientX, e.clientY);
      }, false);
      document.addEventListener('pointerup', end, false);
      document.addEventListener('pointercancel', end, false);
    } else {
      document.addEventListener('touchstart', function (e) {
        var p = pick(e); start(p.x, p.y, p.id);
      }, false);
      document.addEventListener('touchmove', function (e) {
        if (!G || !G.joy.on) return;
        var p = pick(e);
        moveTo(p.x, p.y);
        e.preventDefault();
      }, { passive: false });
      document.addEventListener('touchend', end, false);
      document.addEventListener('touchcancel', end, false);
    }
    window.addEventListener('resize', function () {
      resize();
      baseR = 34 * S;
    }, false);
  }

  /* ---------- 结算与分享卡 ---------- */
  function weaponNames() {
    var names = [], i;
    for (i = 0; i < G.weapons.length; i++) {
      names.push(WDEF[G.weapons[i].id].name + ' Lv.' + G.weapons[i].level);
    }
    return names.join(' · ');
  }

  function showResult(o) {
    document.getElementById('overKick').textContent = o.kick;
    document.getElementById('overTitle').textContent = o.title;
    document.getElementById('overStats').innerHTML = o.stats;
    document.getElementById('overWeap').textContent = o.weap || '';
    document.getElementById('overHint').innerHTML = o.hint || '';
    document.getElementById('againBtn').textContent = o.btn;
    NEXT_ACT = o.act;
    document.getElementById('over').className = 'screen on';
  }

  function endGame(win) {
    if (!G || G.state === 'over' || G.state === 'clear') return;
    if (!win) return failRun();
    return levelClear();
  }

  function levelClear() {
    G.state = 'clear';
    G.joy.on = false; G.joy.dx = 0; G.joy.dy = 0;
    RUN.time += G.t;
    RUN.kills += G.kills;

    var passed = G.levelIdx + 1;
    var isLast = G.levelIdx >= LEVELS.length - 1;
    var i, newSkin = null;

    if (SAVE.unlocked < passed + 1) SAVE.unlocked = clamp(passed + 1, 1, LEVELS.length);
    for (i = 0; i < HEROES.length; i++) {
      if (HEROES[i].unlock === passed && !skinUnlocked(HEROES[i].id)) {
        SAVE.skins.push(HEROES[i].id);
        newSkin = HEROES[i];
      }
    }
    if (passed > SAVE.best.level || (passed === SAVE.best.level && RUN.kills > SAVE.best.kills)) {
      SAVE.best = { level: passed, kills: RUN.kills, time: Math.round(RUN.time) };
    }
    saveSave();

    var lv = LEVELS[G.levelIdx];
    var stats = '本关坚持 <b>' + G.t.toFixed(1) + '</b> 秒 ｜ 打掉 <b>' + G.kills + '</b> 只<br>'
      + '等级 <b>Lv.' + G.level + '</b> ｜ 心心 <b>' + Math.max(0, G.p.hp) + '/' + G.p.maxHp + '</b>'
      + (newSkin ? '<br><span class="unlock-line">解锁新角色 · ' + newSkin.name + '</span>' : '');

    if (isLast) {
      showResult({
        kick: '七关全通',
        title: '糖球大师',
        stats: stats + '<br><span class="best-line">全程 ' + Math.round(RUN.time) + ' 秒 · ' + RUN.kills + ' 只</span>',
        weap: weaponNames(),
        btn: '回首页',
        act: showTitle,
        hint: '七关都过了。换个角色再打一轮试试。'
      });
    } else {
      var nextIdx = G.levelIdx + 1;
      var carry = carryOver();
      showResult({
        kick: '第 ' + passed + ' 关通过',
        title: lv.name,
        stats: stats,
        weap: weaponNames(),
        btn: '进入第 ' + (nextIdx + 1) + ' 关',
        act: (function (ni, ca) { return function () { startLevel(ni, ca); }; })(nextIdx, carry),
        hint: '下一关 · ' + LEVELS[nextIdx].name + '（' + LEVELS[nextIdx].sub + '）'
      });
    }
    tone(1150, 0.35, 'triangle', 0.07, 1480);
  }

  function failRun() {
    G.state = 'over';
    G.joy.on = false; G.joy.dx = 0; G.joy.dy = 0;
    RUN.time += G.t;
    RUN.kills += G.kills;

    var reached = G.levelIdx + 1;
    if (reached > SAVE.best.level) {
      SAVE.best = { level: reached, kills: RUN.kills, time: Math.round(RUN.time) };
      saveSave();
    }
    var lv = LEVELS[G.levelIdx];
    showResult({
      kick: '倒在 第 ' + reached + ' 关',
      title: lv.name,
      stats: '本关坚持 <b>' + G.t.toFixed(1) + '</b> 秒 ｜ 打掉 <b>' + G.kills + '</b> 只<br>'
        + '等级 <b>Lv.' + G.level + '</b> ｜ 这一轮共 <b>' + RUN.kills + '</b> 只'
        + (SAVE.best.level > 0 ? '<br><span class="best-line">最远到过 第 ' + SAVE.best.level + ' 关</span>' : ''),
      weap: weaponNames(),
      btn: '回首页',
      act: showTitle,
      hint: '已解锁到 第 ' + SAVE.unlocked + ' 关，可以直接从那儿再试。'
    });
    tone(300, 0.3, 'triangle', 0.06, 180);
  }

  function paintCard() {
    var c = document.createElement('canvas');
    c.width = 900; c.height = 1200;
    var g = c.getContext('2d');
    var t = Math.min(G.dur, G.t);
    var lv = LEVELS[G.levelIdx];
    var cleared = G.state === 'clear';

    g.fillStyle = CREAM;
    g.fillRect(0, 0, 900, 1200);
    var rg = g.createRadialGradient(450, 380, 60, 450, 380, 780);
    rg.addColorStop(0, 'rgba(255,255,255,0.9)');
    rg.addColorStop(1, 'rgba(255,194,209,0.55)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 900, 1200);

    g.strokeStyle = INK;
    g.lineWidth = 5;
    rrect(g, 40, 40, 820, 1120, 40);
    g.stroke();

    g.textAlign = 'center';
    g.fillStyle = 'rgba(91,75,75,0.55)';
    g.font = '600 26px "PingFang SC", sans-serif';
    g.fillText('糖 球 转 转', 450, 132);

    g.fillStyle = INK;
    g.font = '800 84px "PingFang SC", sans-serif';
    g.fillText('第 ' + (G.levelIdx + 1) + ' 关', 450, 262);

    g.fillStyle = 'rgba(91,75,75,0.75)';
    g.font = '700 44px "PingFang SC", sans-serif';
    g.fillText(lv.name, 450, 320);

    g.fillStyle = 'rgba(91,75,75,0.6)';
    g.font = '600 28px "PingFang SC", sans-serif';
    g.fillText(cleared ? '这一关过了，下一关见' : '倒在这儿了，下次一定', 450, 362);

    /* 糖球本体 */
    g.save();
    g.translate(450, 540);
    g.beginPath(); g.arc(0, 0, 96, 0, TAU);
    g.fillStyle = HERO_COLOR[(G.p.skin || 'hero')] || PINK; g.fill();
    g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
    star(g, 52, -92, 40, 0.6, BUTTER, 0.45);
    g.fillStyle = INK;
    g.beginPath(); g.arc(-30, -8, 13, 0, TAU); g.fill();
    g.beginPath(); g.arc(30, -8, 13, 0, TAU); g.fill();
    g.fillStyle = 'rgba(242,147,159,0.6)';
    g.beginPath(); g.arc(-58, 26, 14, 0, TAU); g.fill();
    g.beginPath(); g.arc(58, 26, 14, 0, TAU); g.fill();
    g.restore();

    /* 数据 */
    g.font = '800 54px "PingFang SC", sans-serif';
    g.fillStyle = INK;
    g.fillText(t.toFixed(1) + ' 秒', 300, 720);
    g.fillText(String(G.kills), 450, 720);
    g.fillText('Lv.' + G.level, 600, 720);

    g.font = '600 24px "PingFang SC", sans-serif';
    g.fillStyle = 'rgba(91,75,75,0.6)';
    g.fillText('坚持', 300, 758);
    g.fillText('打掉', 450, 758);
    g.fillText('等级', 600, 758);

    /* 武器 */
    g.font = '600 28px "PingFang SC", sans-serif';
    g.fillStyle = 'rgba(91,75,75,0.85)';
    var i, names = [];
    for (i = 0; i < G.weapons.length; i++) names.push(WDEF[G.weapons[i].id].name + ' Lv.' + G.weapons[i].level);
    for (i = 0; i < names.length; i++) {
      g.fillText(names[i], 450, 828 + i * 44);
    }

    /* 底部 */
    g.fillStyle = 'rgba(91,75,75,0.45)';
    g.font = '600 26px "PingFang SC", sans-serif';
    g.fillText('七关闯关 · ' + (SAVE.best.level > 0 ? '最远到过 第 ' + SAVE.best.level + ' 关' : '拖摇杆躲怪，武器自己会打'), 450, 1080);

    return c.toDataURL('image/png');
  }

  function saveCard() {
    var hint = document.getElementById('overHint');
    var dataUrl;
    try { dataUrl = paintCard(); } catch (e) { hint.textContent = '出图失败，重开一局再试'; return; }
    var mt = window.xhs && window.xhs.miniTool;
    if (!mt || typeof mt.writeTempFile !== 'function') {
      hint.textContent = '当前环境不能存图，先截屏吧';
      return;
    }
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) {
        var path = res && res.filePath;
        if (!path) { hint.textContent = '出图失败，重开一局再试'; return; }
        if (typeof mt.saveImageToPhotosAlbum === 'function') {
          mt.saveImageToPhotosAlbum({
            filePath: path,
            success: function () { hint.textContent = '已存进相册'; },
            fail: function () { hint.textContent = '存图没成功，再点一次'; }
          });
        } else {
          hint.textContent = '当前版本不支持存图';
        }
      },
      fail: function () { hint.textContent = '出图失败，重开一局再试'; }
    });
  }

  /* ---------- 启动 ---------- */
  function startGame() {
    startRun(SKIN);
  }

  function showTitle() {
    G = null;
    RUN = null;
    document.getElementById('app').className = 'in-title';
    var bt = document.getElementById('bestTxt');
    if (bt) {
      bt.textContent = SAVE.best.level > 0
        ? '最远到过 第 ' + SAVE.best.level + ' 关 · 已解锁 ' + SAVE.unlocked + '/7'
        : '七关闯关 · 共 4 个角色';
    }
    document.getElementById('over').className = 'screen';
    document.getElementById('up').className = 'screen';
    document.getElementById('stageBadge').textContent = '';
    renderSkins();
    renderStages();
    document.getElementById('start').className = 'screen on';
  }

  function renderSkins() {
    var box = document.getElementById('skinRow'), i, h, el, on, locked;
    box.innerHTML = '';
    for (i = 0; i < HEROES.length; i++) {
      h = HEROES[i];
      locked = !skinUnlocked(h.id);
      on = (h.id === SKIN);
      el = document.createElement('div');
      el.className = 'skin' + (on ? ' on' : '') + (locked ? ' locked' : '');
      var doll = ART[h.id]
        ? '<img class="skin-doll" src="./assets/art/' + h.id + '.png" alt="">'
        : '<span class="skin-doll dot" style="background:' + HERO_COLOR[h.id] + '"></span>';
      el.innerHTML = doll + '<b>' + h.name + '</b>'
        + '<em>' + (locked ? '通过第 ' + h.unlock + ' 关' : h.desc) + '</em>';
      (function (id, isLocked) {
        el.addEventListener('click', function () {
          if (isLocked) { flashHint('通过第 ' + heroById(id).unlock + ' 关解锁'); return; }
          SKIN = id;
          renderSkins();
          tone(900, 0.06, 'triangle', 0.03, 1100);
        }, false);
      })(h.id, locked);
      box.appendChild(el);
    }
  }

  function renderStages() {
    var box = document.getElementById('stageRow'), i, el;
    box.innerHTML = '';
    for (i = 0; i < LEVELS.length; i++) {
      el = document.createElement('button');
      el.className = 'stage-dot' + (i < SAVE.unlocked ? ' on' : '');
      el.textContent = String(i + 1);
      el.title = LEVELS[i].name;
      (function (idx, open) {
        el.addEventListener('click', function () {
          if (!open) { flashHint('先通过第 ' + idx + ' 关'); return; }
          RUN = { skin: SKIN, levelIdx: idx, time: 0, kills: 0 };
          startLevel(idx, null);
        }, false);
      })(i, i < SAVE.unlocked);
      box.appendChild(el);
    }
  }

  function flashHint(msg) {
    var el = document.getElementById('startHint');
    el.textContent = msg;
    el.className = 'start-hint show';
    window.setTimeout(function () { el.className = 'start-hint'; }, 1600);
  }

  function init() {
    resize();
    loadArt();
    loadSave();
    bindInput();
    document.getElementById('startBtn').addEventListener('click', startGame, false);
    document.getElementById('againBtn').addEventListener('click', function () {
      if (NEXT_ACT) NEXT_ACT();
    }, false);
    document.getElementById('shareBtn').addEventListener('click', function (e) {
      e.preventDefault();
      saveCard();
    }, false);

    var b = document.getElementById('bestTxt');
    if (b) {
      b.textContent = SAVE.best.level > 0
        ? '最远到过 第 ' + SAVE.best.level + ' 关 · 已解锁 ' + SAVE.unlocked + '/7'
        : '七关闯关 · 共 4 个角色';
    }
    document.getElementById('app').className = 'in-title';
    renderSkins();
    renderStages();
    window.requestAnimationFrame(loop);
  }

  /* ---------- 测试钩子 ---------- */
  window.TQ = {
    snapshot: function () {
      if (!G) return null;
      return {
        state: G.state,
        levelIdx: G.levelIdx,
        skin: G.p.skin, t: G.t, hp: G.p.hp, level: G.level, xp: G.xp, xpNext: G.xpNext,
        kills: G.kills, enemies: G.enemies.length, weapons: G.weapons.length, drops: G.drops.length,
        px: G.p.x, py: G.p.y, boss: !!G.boss
      };
    },
    tick: function (dt) {
      if (G && (G.state === 'play' || G.state === 'intro')) step(dt);
    },
    spawn: function (kind, x, y) { return spawnEnemy(kind, x, y); },
    addWeapon: function (id) { addWeapon(id); },
    openUpgrade: function () { openUpgrade(); },
    choices: function () { return G.__choices; },
    pickUpgrade: function (i) { pickUpgrade(i); },
    joy: function (dx, dy) { if (G) { G.joy.dx = dx; G.joy.dy = dy; } },
    setTime: function (t) { if (G) G.t = t; },
    giveXp: function (n) { if (G) { G.xp += n; checkLevel(); } },
    dropList: function () {
      var out = [], i;
      if (!G) return out;
      for (i = 0; i < G.drops.length; i++) out.push({ x: G.drops[i].x, y: G.drops[i].y, v: G.drops[i].v });
      return out;
    },
    weaponList: function () {
      var out = [], i;
      if (!G) return out;
      for (i = 0; i < G.weapons.length; i++) out.push({ id: G.weapons[i].id, level: G.weapons[i].level });
      return out;
    },
    clearField: function () {
      if (!G) return;
      G.enemies = []; G.drops = []; G.parts = []; G.bullets = []; G.strikes = [];
    },
    enemyList: function () {
      var out = [], i, e;
      if (!G) return out;
      for (i = 0; i < G.enemies.length; i++) {
        e = G.enemies[i];
        out.push({ kind: e.kind, x: e.x, y: e.y, r: e.r, hp: e.hp, boss: !!e.def.boss });
      }
      return out;
    },
    end: function (win) { endGame(!!win); },
    next: function () { if (NEXT_ACT) NEXT_ACT(); },
    level: function () { return G ? { idx: G.levelIdx, name: LEVELS[G.levelIdx].name, dur: G.dur, boss: !!G.boss } : null; },
    goLevel: function (idx, carry) { startLevel(idx, carry || null); },
    setSkin: function (id) { SKIN = id; renderSkins(); },
    skin: function () { return SKIN; },
    save: function () { return SAVE; },
    resetSave: function () { SAVE = { unlocked: 1, skins: ['hero'], best: { level: 0, kills: 0, time: 0 } }; saveSave(); renderSkins(); renderStages(); },
    unlock: function () { SAVE.unlocked = LEVELS.length; SAVE.skins = ['hero', 'mint', 'cocoa', 'starry']; saveSave(); renderSkins(); renderStages(); },
    skipIntro: function () { if (G && G.state === 'intro') { G.introT = 0; } },
    god: function (on) { if (G) G.god = (on === undefined ? true : !!on); },
    setHp: function (n) { if (G) { G.p.hp = n; syncHud(); } },
    winNow: function () { if (G) { G.t = G.dur; } },
    card: function () { return paintCard(); }
  };

  init();
})();
