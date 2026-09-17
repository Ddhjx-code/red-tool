(function () {
  window.WHData = {
    SEED: 20260925,
    STEP: 1 / 60,
    PLAYER: { W: 1.6, H: 3.6, SPEED: 8.0, JUMP_V: 10.6, GRAV: -26.0, HURT_CD: 0.9, JUMP_BUF: 0.14 },
    POLE: { LEN: 2.6, ANG: 1.30, THRUST: 1.1, THRUST_ANG: 0.35, THRUST_CD: 0.5 },
    CHAIN: { N: 32, L: 0.30, A: 0.20, FREQ: 2.2, K: 0.07, MAXTURN: 0.20, WRAP_SEGS: 8 },
    FIRE: {
      EMIT_PER_SEG: 1, LIFE: 0.42, RISE: 3.0, DRIFT: 1.1, GRAV: -0.4,
      R_NEAR: 0.10, R_FAR: 0.045, INTENSITY_MIN: 0.25, POOL: 180
    },
    CAM: { Y: 0.66, SCALE: 17.0, PARALLAX: [0.18, 0.42, 1.0], AHEAD: 0.66, GAP: 5, SPAN: 40 },
    FIRE_RES: { START: 100, DRAIN: 1.05, HURT: 8, CLING_DRAIN: 3, KILL_MIASMA: 5, KILL_GHOST: 12, DIM: 35 },
    ACT: { THRUST_CD: 0.40, THRUST_W: 1.6, THRUST_COST: 4, ORB_COST: 12,
           TAIL_CD: 0.85, TAIL_R: 5.2, TAIL_COST: 9,
           HITSTOP: 0.032, HITSTOP_HEAVY: 0.052,
           CHASE_WIN: 0.9, CHASE_FIRE: 6, COMBO_WIN: 1.05,
           WINDUP: 0.07, RECOVER: 0.11, COMMIT: 0.35 },
    ALTAR: { R: 2.4, RATE: 18, CAP: 100, LIT_T: 0.6 },
    ANIM: {
      idle: { base: 'man-dancer', fps: 6, loop: true },
      walk: { base: 'man-walk', fps: 12, loop: true },
      jump: { base: 'man-jump', fps: 8, loop: false },
      thrust: { base: 'man-thrust', fps: 16, loop: false },
      tail: { base: 'man-tail', fps: 16, loop: false }
    },
    ANIM_FRAMES: { idle: 0, jump: 0, tail: 0, thrust: 0, walk: 0 },
    ANIM_ATLAS: {},
    ANIM_ATLAS_HINT: { file: 'sheet-man-walk.webp', fw: 128, fh: 128, cols: 6, rows: 1, pad: 0 },
    ENEMY: { MIASMA_R: 1.00, GHOST_R: 0.75, GHOST_SPEED: 2.0, TOUCH_PAD: 0.5 },
    ROOMS: [
      { id: 'kaiguang', name: '开光', w: 20, gate: true, miasma: 0, ghosts: 0,
        pillars: [{ lx: 13.4, y: 2.4, r: 1.05 }, { lx: 15.5, y: 2.4, r: 1.05 }],
        plats: [{ lx: 3.0, w: 3.0, y: 1.5 }, { lx: 6.0, w: 3.0, y: 2.9 }],
        props: [{ kind: 'altar', lx: 10.6, h: 2.7 }],
        hint: '左右引龙 · 龙身穿柱即缠 · 缠住可得龙珠' },
      { id: 'guoqiao', name: '过桥', w: 24.5, gate: true, pillars: [], miasma: 5, ghosts: 2,
        plats: [{ lx: 7.4, w: 2.6, y: 1.3 }, { lx: 10.0, w: 2.8, y: 2.2 },
                { lx: 12.8, w: 2.6, y: 1.3 }],
        gaps: [{ lx: 18.0, w: 4.5 }],
        props: [{ kind: 'banner', lx: 2.4, h: 4.6 }, { kind: 'drum', lx: 4.6, h: 2.3 },
                { kind: 'altar', lx: 16.7, h: 2.7 }],
        hint: '龙身扫过疫气 · 跳过沟壑' },
      { id: 'chanshuang', name: '缠双柱', w: 24, gate: true,
        pillars: [{ lx: 8, y: 2.4, r: 1.05 }, { lx: 16, y: 2.4, r: 1.05 }],
        plats: [{ lx: 3.4, w: 3.2, y: 1.8 }, { lx: 17.4, w: 3.2, y: 1.8 }],
        props: [{ kind: 'banner', lx: 2.0, h: 4.6 }, { kind: 'altar', lx: 12.0, h: 2.7 },
                { kind: 'kid', lx: 22.4, h: 3.0 }],
        miasma: 4, ghosts: 3,
        hint: '竿刺缠柱 · 甩尾清群' },
      { id: 'tuanyuan', name: '结团圆', w: 23, gate: false, pillars: [], miasma: 0, ghosts: 0,
        plats: [{ lx: 7.5, w: 8.0, y: 1.3 }],
        props: [{ kind: 'kid', lx: 2.6, h: 3.0 }, { kind: 'altar', lx: 20.6, h: 2.7 }],
        boss: true, hint: '缠住瘟神 · 以香火净化' }
    ],
    BOSS: {
      HP_PURIFY: 100, PHASES: [32, 66, 100],
      TELEGRAPH: 0.7, LUNGE_SPEED: 7.0, MOVE_SPEED: 0.55,
      WAKE: 4.5, DIVE_START: 8.0, VANISH_START: 11.0, VANISH_MAX: 1.4,
      ATTACK_GAP: [1.5, 1.2, 0.9], THRUST_DMG: 6, ORB_DMG: 14, WRAP_DPS: 14
    },
    HUES: {
      night1: '#080f18', night2: '#12202f', far: '#1a2c3c',
      mid: '#0b1420', near: '#03060a',
      ember: '#ff8a3d', glow: '#ffe9b0', dim: '#7a3a20',
      paper: '#e8e2d4'
    },
    KNOW: [
      '大坑舞火龙为国家级非遗，编号 Ⅹ-5、序号 453，2011 年第三批',
      '农历八月十四·十五·十六 = 迎月·赏月·送月',
      '始于 1880 年大坑瘟疫，村民扎火龙巡游驱瘟',
      '龙身 32 节、全长 67 米、插逾万枝长寿香',
      '必须用珍珠草扎作——水草一干就缩、杂草会碎',
      '每节一人持竹竿，动员 300 余人',
      '表演程式三段：火龙过桥 / 缠双柱 / 结团圆',
      '终章「龙归天」：八月十六送入避风塘海中',
      '主持须客家人、禀神用客家话（大坑为客家村）',
      '薄扶林村另有舞火龙（香港非遗代表作名录 2017）',
      '大坑火龙文化馆原址为 1909 年孔圣义学'
    ]
  };
})();
