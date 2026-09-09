'use strict';

/* ==================== palette (linear-ish) ==================== */
function hx(h){ const v = parseInt(h.slice(1),16); return [((v>>16)&255)/255, ((v>>8)&255)/255, (v&255)/255]; }
const C = {
  night1: hx('#1F2233'), night2: hx('#0E1018'), ink: hx('#16181D'),
  goldB:  hx('#ECD06F'), goldM: hx('#C5A253'),  cin: hx('#A82020'),
  moonW:  hx('#D6ECF0'), ivory: hx('#FFFBF0'),
};


const TIERS = [
  { key:'liubeihong', name:'六抔红',   sub:'六抔红', cakes:63, cn:'通吃', note:'六红全现，通吃会饼', poem:'六红通吃 · 满盘团圆', cinnabar:true  },
  { key:'jinhua',     name:'插金花',   sub:'状元插金花', cakes:1, cn:'一',  note:'四红双一，金花插冠', poem:'蟾宫折桂 · 金花插冠', cinnabar:true  },
  { key:'zhuangyuan', name:'状元',     sub:'状元',   cakes:1,  cn:'一',  note:'四点红齐，独占鳌头', poem:'蟾宫折桂 · 月中攀桂，折桂者魁', cinnabar:true  },
  { key:'duitang',    name:'对堂',     sub:'榜眼',   cakes:2,  cn:'二',  note:'顺子成堂，榜眼及第', cinnabar:false },
  { key:'sanhong',    name:'三红',     sub:'探花',   cakes:4,  cn:'四',  note:'三点四红，探花及第', cinnabar:false },
  { key:'sijin',      name:'四进',     sub:'进士',   cakes:8,  cn:'八',  note:'四子同点，进士出身', cinnabar:false },
  { key:'erju',       name:'二举',     sub:'举人',   cakes:16, cn:'十六', note:'双点四红，乡试中举', cinnabar:false },
  { key:'yixiu',      name:'一秀',     sub:'秀才',   cakes:32, cn:'三十二', note:'一点四红，县试入泮', cinnabar:false },
  { key:'none',       name:'无彩',     sub:'无彩',   cakes:0,  cn:'无',  note:'六点无红，来年再掷', cinnabar:false },
];
const TIER_MAP = {}; TIERS.forEach(t => TIER_MAP[t.key] = t);
/* 榜单 column shows the six base tiers, top = highest prestige */
const BOARD_KEYS = ['zhuangyuan','duitang','sanhong','sijin','erju','yixiu'];

const CAKE_TOTAL = 63;

/* Plain-language conditions; each line mirrors judge() in engine.js (authoritative). */
const PLAIN = {
  zhuangyuan: '红四点 4 个以上',
  duitang:    '六颗正好是 1 2 3 4 5 6 各一个（顺子）',
  sanhong:    '红四点正好 3 个',
  sijin:      '有 4 颗点数相同，而且不是四点',
  erju:       '红四点正好 2 个',
  yixiu:      '红四点正好 1 个',
};

const RULE = {
  mechanicTitle: '怎么定功名',
  mechanic: [
    '骰子的「四点」那一面涂成朱砂红，所以博饼比的就是数「四点红」。',
    '六颗骰子掷进大瓷碗，停下后数一数朝上的面里有几个红色的四点：红四点越多，功名越大。',
  ],
  redOne: '骰子上还有一面也涂红，就是「一点」。它不计功名，只在「状元插金花」时用来加彩。',
  order: '一掷若同时满足好几条，按下面的表从上往下取最高的一条。',
  tierTitle: '功名对照表',
  tierHead: ['功名', '掷出什么算中', '得会饼'],
  tierFoot: '另有两彩：六颗全是红四点＝六抔红，通吃场上剩下的会饼；红四点 4 个以上再加两颗红一点＝状元插金花。',
  goalTitle: '为什么是中秋',
  goal: [
    '博到的奖品叫「会饼」，就是一套月饼，一共六十三块。',
    '中秋拜月之后要把月饼分给全家，六十三块正好一轮。把六十三块会饼全部博完，就是中秋团圆。',
  ],
  funTitle: '乐趣在哪',
  fun: [
    '每一掷的点数都是随机的，谁也算不到下一掷会中什么。',
    '功名越大越难得，得的饼反而越少（状元一块）；功名越小越常见，得的饼越多（一秀三十二块）。',
    '靠小功名一块一块攒，偶尔中一次大功名，把六十三块攒满就团圆。',
  ],
  progTitle: '左下角那条进度',
  prog: '上面的数字是你已经博到的会饼块数，进度条满到六十三块，这一席就团圆了。',
  intro: [
    '骰子的「四点」涂红：数朝上的红四点，定功名。',
    '博「会饼」也就是月饼，共六十三块，博满即团圆。',
  ],
};

const FACTS = {
  heritage:   '国家级非物质文化遗产 · 2008 · 厦门 · 序号453',
  origin:     '郑成功部将洪旭所创 · 约三百年',
  play:       '六骰入碗 · 四点红定功名 · 博取会饼',
  pool:       '会饼六十三 · 七九六十三',
  introLines: [
    '国家级非物质文化遗产 · 2008 · 厦门 · 序号453',
    '郑成功部将洪旭所创 · 约三百年',
    '六骰入碗 · 四点红定功名 · 博取会饼',
    '会饼六十三 · 七九六十三',
  ],
};

/* Explicit public surface for the other classic scripts. */
window.Bobing = window.Bobing || {};
window.Bobing.Data = { hx, C, TIERS, TIER_MAP, BOARD_KEYS, CAKE_TOTAL, FACTS, PLAIN, RULE };
