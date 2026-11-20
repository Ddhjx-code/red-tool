/* 小摊记 · 游戏逻辑
   一局：早市进货 → 开价定招牌 → 开市（可还价） → 收摊题词
   AI 按 .skill/references/ai-as-function.md 接入：固定提示词 / 结构化返回 / 四级降级 / 不展示原文
   Chrome 61 基线：var + function，无箭头函数 / 模板串 / let-const */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ============ 常量 ============ */

  var SAVE_KEY = 'stall_save_v2';
  var CAPITAL = 100;
  var AI_ENABLED = true;          /* 关掉即纯本地；容器无 window.xhs.AI 时自动走本地 */

  var TIMES = [
    { key: 'morning', n: '辰时', label: '早市', crowd: 1.14, hot: ['candy', 'candied', 'bowl'] },
    { key: 'noon', n: '午时', label: '午市', crowd: 1.02, hot: ['fan', 'kite', 'sachet'] },
    { key: 'dusk', n: '酉时', label: '晚市', crowd: 0.96, hot: ['sachet', 'doll', 'tea'] },
    { key: 'night', n: '戌时', label: '夜市', crowd: 0.90, hot: ['lamp', 'jade', 'candied'] }
  ];

  var SIGNS = [
    { n: '静坐等客', crowd: 0, pay: 1.00 },
    { n: '高声吆喝', crowd: 2, pay: 0.93 },
    { n: '挂出招牌', crowd: -2, pay: 1.10 }
  ];

  var ALL_GOODS = [
    { id: 'fan',     n: '折扇',   cost: 24, base: 40, unlock: 0,  note: '书生爱买' },
    { id: 'sachet',  n: '香囊',   cost: 10, base: 18, unlock: 0,  note: '妇人常问' },
    { id: 'candy',   n: '糖画',   cost: 5,  base: 10, unlock: 0,  note: '小儿缠着要' },
    { id: 'lamp',    n: '花灯',   cost: 40, base: 70, unlock: 0,  note: '富户才买得起' },
    { id: 'kite',    n: '纸鸢',   cost: 18, base: 32, unlock: 3,  note: '晴天好卖' },
    { id: 'doll',    n: '泥人',   cost: 12, base: 22, unlock: 5,  note: '捏得拙才有人要' },
    { id: 'candied', n: '糖葫芦', cost: 4,  base: 9,  unlock: 5,  note: '一竿子卖完' },
    { id: 'bowl',    n: '粗瓷碗', cost: 8,  base: 15, unlock: 8,  note: '持家货，走得慢' },
    { id: 'tea',     n: '茶饼',   cost: 15, base: 26, unlock: 8,  note: '老者认这个' },
    { id: 'jade',    n: '玉扣',   cost: 55, base: 95, unlock: 12, note: '价高，砸手里也疼' }
  ];

  var KINDS = [
    { id: 'woman',   n: '挎篮妇人', w: 1.00, pay: 0.96, like: ['sachet', 'bowl', 'tea'],        line: ['这个怎么卖？', '家里正缺这个。', '便宜些我拿两个。'] },
    { id: 'scholar', n: '长衫书生', w: 0.90, pay: 1.06, like: ['fan', 'kite', 'tea'],            line: ['可有雅致些的？', '这扇面画得还好。', '学生囊中羞涩。'] },
    { id: 'kid',     n: '垂髫小儿', w: 1.00, pay: 0.86, like: ['candy', 'candied', 'doll'],      line: ['阿娘给我买嘛！', '我要那个！', '这个能吃吗？'] },
    { id: 'elder',   n: '拄杖老者', w: 0.85, pay: 0.92, like: ['tea', 'bowl', 'sachet'],         line: ['老朽看看。', '这货经用么？', '不急，慢慢挑。'] },
    { id: 'rich',    n: '富户管家', w: 0.55, pay: 1.24, like: ['lamp', 'jade', 'fan'],           line: ['府上要的，尽管包好。', '可有成色好的？', '价钱好说。'] }
  ];

  var WEATHERS = [
    { n: '晴',   crowd: 1.12, cls: '' },
    { n: '阴',   crowd: 0.98, cls: '' },
    { n: '微雨', crowd: 0.84, cls: '' }
  ];

  /* ============ 存档 ============ */

  function defaultSave() { return { coins: 0, best: 0, round: 1 }; }

  function readSave() {
    var raw = null;
    try {
      var mt = window.xhs && window.xhs.miniTool;
      if (mt && typeof mt.getStorage === 'function') {
        var r = mt.getStorage({ key: SAVE_KEY });
        if (r && typeof r.data === 'string') raw = r.data;
      }
    } catch (e) { raw = null; }
    if (!raw) {
      try { raw = window.localStorage.getItem(SAVE_KEY); } catch (e2) { raw = null; }
    }
    if (!raw) return defaultSave();
    try {
      var o = JSON.parse(raw);
      return {
        coins: Number(o.coins) || 0,
        best: Number(o.best) || 0,
        round: Number(o.round) || 1
      };
    } catch (e3) { return defaultSave(); }
  }

  function writeSave(o) {
    var s = JSON.stringify(o);
    try {
      var mt = window.xhs && window.xhs.miniTool;
      if (mt && typeof mt.setStorage === 'function') {
        mt.setStorage({ key: SAVE_KEY, data: s });
        return;
      }
    } catch (e) { /* 落 localStorage */ }
    try { window.localStorage.setItem(SAVE_KEY, s); } catch (e2) { /* 内存兜底 */ }
  }

  /* ============ 状态 ============ */

  var G = {
    coins: 0, best: 0, round: 1,
    cash: CAPITAL, stock: {}, price: {}, sign: 0, cost: 0,
    day: null, queue: [], qi: 0,
    rev: 0, sold: 0, asked: 0,
    run: false, paused: false, timer: null,
    haggle: null, haggleTimer: null,
    ai: { talk: false, verse: false }
  };

  function byId(id) {
    for (var i = 0; i < ALL_GOODS.length; i++) if (ALL_GOODS[i].id === id) return ALL_GOODS[i];
    return null;
  }

  function playGoods() {
    var out = [];
    for (var i = 0; i < ALL_GOODS.length; i++) {
      if (ALL_GOODS[i].unlock <= G.round) out.push(ALL_GOODS[i]);
    }
    return out;
  }

  function kindById(id) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].id === id) return KINDS[i];
    return KINDS[0];
  }

  function stockIds() {
    var out = [];
    for (var k in G.stock) {
      if (G.stock.hasOwnProperty(k) && G.stock[k] > 0) out.push(k);
    }
    return out;
  }

  function stockTotal() {
    var s = 0;
    for (var k in G.stock) if (G.stock.hasOwnProperty(k)) s += G.stock[k];
    return s;
  }

  /* ============ AI 层（当函数用：固定提示词 / 结构化 / 静默降级） ============ */

  function aiReady() {
    var ai = window.xhs && window.xhs.AI;
    return !!(AI_ENABLED && ai && typeof ai.createModel === 'function');
  }

  /* 只接受纯文本、限长、剔掉会破坏排版的字符 */
  function cleanStr(v, max) {
    if (typeof v !== 'string') return '';
    var s = v.replace(/[\r\n\t]+/g, ' ').replace(/["“”'']/g, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').replace(/^ +| +$/g, '');
    if (s.length > max) s = s.slice(0, max);
    return s;
  }

  function askAI(sys, user, maxTok, temp, cb) {
    if (!aiReady()) { cb(null); return; }
    var done = false;
    var guard = setTimeout(function () {
      if (done) return;
      done = true;
      cb(null);
    }, 3200);

    function finish(txt) {
      if (done) return;
      done = true;
      clearTimeout(guard);
      cb(txt);
    }

    try {
      var ai = window.xhs.AI;
      var model = ai.createModel('deepseek-v4-flash');
      var p = model.generateText({
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        max_output_tokens: maxTok,
        temperature: temp
      });
      if (!p || typeof p.then !== 'function') { finish(null); return; }
      p.then(function (res) {
        var txt = (res && res.choices && res.choices[0] && res.choices[0].message
          && res.choices[0].message.content) || '';
        finish(txt);
      })['catch'](function () { finish(null); });
      return;
    } catch (e) { finish(null); }
  }

  function parseJSON(raw) {
    if (!raw) return null;
    var s = raw;
    var a = s.indexOf('{');
    var b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    s = s.slice(a, b + 1);
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  /* --- 点 1：今日街谈（天气 + 俏货 + 一句闲话） --- */
  var GOSSIP_POOL = [
    '听说城外货郎今夜到', '今年雨水足，果子便宜', '东头说书先生今日开嗓',
    '城隍庙会还剩三日', '有富户嫁女，喜物好卖', '铁匠铺新到些好铁',
    '南门要修路，过两日人少', '京里来了批新奇玩意', '学塾明日休课，街上热闹',
    '近来夜里风凉，添衣裳'
  ];

  function localTalk() {
    var t = TIMES[Math.floor(Math.random() * TIMES.length)];
    var hotPool = t.hot;
    var pick = hotPool[Math.floor(Math.random() * hotPool.length)];
    var avail = [];
    for (var i = 0; i < hotPool.length; i++) if (byId(hotPool[i])) avail.push(hotPool[i]);
    if (avail.length && Math.random() < 0.6) {
      pick = avail[Math.floor(Math.random() * avail.length)];
    }
    var w = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
    return {
      time: t.key,
      timeName: t.n,
      timeLabel: t.label,
      weather: w.n,
      crowdBase: w.crowd,
      hot: byId(pick) ? pick : 'candy',
      gossip: GOSSIP_POOL[Math.floor(Math.random() * GOSSIP_POOL.length)]
    };
  }

  function aiTalk(cb) {
    var t = TIMES[Math.floor(Math.random() * TIMES.length)];
    var ids = [];
    var pool = playGoods();
    for (var i = 0; i < pool.length; i++) ids.push(pool[i].id);
    var SYS = '你是宋代市井的说书人。只输出 JSON：'
      + '{"weather":"晴","hot":"fan","gossip":"一句街谈"}。'
      + 'weather 只能取 晴、阴、微雨 之一；hot 只能取 ' + ids.join('/') + ' 之一；'
      + 'gossip 不超过 14 个汉字，古白话口吻。不要引号、不要换行、不要解释、不要寒暄。';

    askAI(SYS, '今日是' + t.n + '，写一句市井行情。', 90, 0.9, function (raw) {
      var d = parseJSON(raw);
      if (!d) { cb(null); return; }
      var w = null;
      for (var k = 0; k < WEATHERS.length; k++) {
        if (WEATHERS[k].n === d.weather || (d.weather === '雨' && WEATHERS[k].n === '微雨')) {
          w = WEATHERS[k];
        }
      }
      var hot = byId(d.hot) ? d.hot : '';
      var gossip = cleanStr(d.gossip, 18);
      if (!w || !hot || gossip.length < 3) { cb(null); return; }
      cb({
        time: t.key, timeName: t.n, timeLabel: t.label,
        weather: w.n, crowdBase: w.crowd,
        hot: hot, gossip: gossip
      });
    });
  }

  /* --- 点 2：吆喝词（开市时挂在摊上） --- */
  var CALL_POOL = [
    ['新蒸的糖，甜得很呐', '扇面题字，当场可画', '玩意儿便宜，随便看'],
    ['走过路过莫错过咧', '今日本钱让利三分', '瞧一瞧看一看呐'],
    ['老铺手艺，不欺童叟', '一样一件，卖完即止', '客官里边请']
  ];

  function localCall() {
    var p = CALL_POOL[G.sign] || CALL_POOL[0];
    return p[Math.floor(Math.random() * p.length)];
  }

  function aiCall(cb) {
    if (!aiReady()) { cb(null); return; }
    var ids = [];
    for (var k in G.stock) {
      if (G.stock.hasOwnProperty(k) && G.stock[k] > 0) {
        var g = byId(k);
        if (g) ids.push(g.n);
      }
    }
    var SYS = '你是摆摊的贩夫。只输出 JSON：{"call":"一句吆喝"}。'
      + 'call 不超过 12 个汉字，吆喝口吻，可含语气词。不要引号、不要换行、不要解释。';
    askAI(SYS, '摊上卖：' + (ids.join('、') || '杂货') + '。写一句吆喝。', 60, 1.0, function (raw) {
      var d = parseJSON(raw);
      var c = d ? cleanStr(d.call, 16) : '';
      cb(c.length >= 4 ? c : null);
    });
  }

  /* --- 点 3：收摊题词 --- */
  var VERSE_POOL = [
    { t: '白忙一场', l: '本钱还在，人却乏了，明日换个市口罢。' },
    { t: '勉强回本', l: '不多不少，恰够一顿热汤面。' },
    { t: '小有盈余', l: '钱袋沉了些，走路也稳了些。' },
    { t: '日进斗金', l: '收摊时手都数酸了，明日还得早些来。' },
    { t: '一摊春风', l: '货空人未散，都问明日还来不来。' }
  ];

  function localVerse(stars) {
    return VERSE_POOL[Math.max(0, Math.min(4, stars - 1))];
  }

  function aiVerse(ctx, cb) {
    if (!aiReady()) { cb(null); return; }
    var SYS = '你是替小贩写账簿题词的老先生。只输出 JSON：'
      + '{"title":"四字评语","line":"一句题词"}。'
      + 'title 恰好四个汉字；line 不超过 22 个汉字，古白话、平和，不喊口号。'
      + '不要引号、不要换行、不要解释。';
    var u = '净赚' + ctx.profit + '文，来客' + ctx.asked + '位，成交' + ctx.sold
      + '笔，剩' + ctx.left + '件，卖的是' + ctx.goods + '。';
    askAI(SYS, u, 100, 0.95, function (raw) {
      var d = parseJSON(raw);
      if (!d) { cb(null); return; }
      var t = cleanStr(d.title, 8);
      var l = cleanStr(d.line, 34);
      if (t.length < 2 || l.length < 5) { cb(null); return; }
      cb({ t: t, l: l });
    });
  }

  /* ============ 货品图标（剪纸双色） ============ */

  var INK = '#2A2420';
  var PAPER = '#FBF3E2';

  function ic(id) {
    var h = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">';
    if (id === 'fan') {
      h += '<path d="M24 39 L7 18 A20 20 0 0 1 41 18 Z" fill="#B4462F"/>';
      h += '<path d="M24 39 L7 18 A20 20 0 0 1 41 18 Z" fill="none" stroke="' + INK + '" stroke-width="1.5" stroke-linejoin="round"/>';
      h += '<path d="M24 39 L24 6 M24 39 L12 13 M24 39 L36 13" stroke="' + PAPER + '" stroke-width="1.4" opacity="0.85"/>';
      h += '<circle cx="24" cy="39" r="2.2" fill="' + INK + '"/>';
    } else if (id === 'sachet') {
      h += '<path d="M16 19 Q24 13 32 19 L35 33 Q24 41 13 33 Z" fill="#3F6E63"/>';
      h += '<path d="M16 19 Q24 24 32 19" fill="none" stroke="' + PAPER + '" stroke-width="1.4" opacity="0.9"/>';
      h += '<path d="M24 14 L24 19" stroke="' + INK + '" stroke-width="1.6"/>';
      h += '<path d="M24 8 Q27 11 24 14 Q21 11 24 8" fill="' + INK + '"/>';
      h += '<path d="M24 37 L24 44 M21 44 L24 46 L27 44" stroke="#C9902F" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
    } else if (id === 'candy') {
      h += '<path d="M18 30 C14 24 20 17 27 20 C33 23 31 31 25 31 C20 31 21 25 26 26" fill="none" stroke="#C9902F" stroke-width="3" stroke-linecap="round"/>';
      h += '<path d="M24 33 L23 44" stroke="' + INK + '" stroke-width="1.8" stroke-linecap="round"/>';
      h += '<circle cx="24" cy="25" r="10" fill="#C9902F" opacity="0.12"/>';
    } else if (id === 'lamp') {
      h += '<path d="M24 10 L24 14" stroke="' + INK + '" stroke-width="1.6"/>';
      h += '<ellipse cx="24" cy="25" rx="12" ry="13" fill="#B4462F"/>';
      h += '<path d="M12 25 L36 25 M24 12 L24 38" stroke="' + PAPER + '" stroke-width="1.2" opacity="0.7"/>';
      h += '<path d="M24 38 L24 45 M21 45 L24 47 L27 45" stroke="#C9902F" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
      h += '<path d="M18 9 L30 9" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>';
    } else if (id === 'kite') {
      h += '<path d="M24 6 L37 20 L24 35 L11 20 Z" fill="#3F6E63"/>';
      h += '<path d="M24 6 L24 35 M11 20 L37 20" stroke="' + PAPER + '" stroke-width="1.3" opacity="0.8"/>';
      h += '<path d="M24 35 Q20 39 25 41 Q30 43 26 46" fill="none" stroke="' + INK + '" stroke-width="1.4" stroke-linecap="round"/>';
    } else if (id === 'doll') {
      h += '<circle cx="24" cy="15" r="6" fill="#8A6B4A"/>';
      h += '<path d="M17 24 L31 24 L34 40 L14 40 Z" fill="#B4462F"/>';
      h += '<path d="M17 26 L11 33 M31 26 L37 33" stroke="#8A6B4A" stroke-width="3" stroke-linecap="round"/>';
      h += '<path d="M20 40 L19 46 M28 40 L29 46" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>';
      h += '<path d="M21.4 14 L22.6 15.2 M26.6 14 L25.4 15.2" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round"/>';
    } else if (id === 'candied') {
      h += '<path d="M24 46 L23 14" stroke="' + INK + '" stroke-width="1.8" stroke-linecap="round"/>';
      h += '<circle cx="24" cy="12" r="5.4" fill="#B4462F"/><circle cx="24" cy="21" r="5.4" fill="#B4462F"/><circle cx="24" cy="30" r="5.4" fill="#B4462F"/>';
      h += '<path d="M21 10 Q22 9 23 10" stroke="' + PAPER + '" stroke-width="1.2" opacity="0.8" fill="none"/>';
    } else if (id === 'bowl') {
      h += '<path d="M9 22 L39 22 Q37 38 24 38 Q11 38 9 22 Z" fill="#4A4458"/>';
      h += '<path d="M9 22 L39 22" stroke="' + PAPER + '" stroke-width="1.6" opacity="0.75"/>';
      h += '<path d="M15 27 Q24 31 33 27" fill="none" stroke="' + PAPER + '" stroke-width="1.2" opacity="0.55"/>';
      h += '<ellipse cx="24" cy="41" rx="8" ry="1.8" fill="' + INK + '" opacity="0.18"/>';
    } else if (id === 'tea') {
      h += '<circle cx="24" cy="24" r="14" fill="#8A6B4A"/>';
      h += '<circle cx="24" cy="24" r="8.4" fill="none" stroke="' + PAPER + '" stroke-width="1.4" opacity="0.8"/>';
      h += '<path d="M24 16 L24 32 M16 24 L32 24" stroke="' + PAPER + '" stroke-width="1.1" opacity="0.5"/>';
      h += '<circle cx="24" cy="24" r="2.6" fill="' + PAPER + '" opacity="0.7"/>';
    } else {
      h += '<circle cx="24" cy="24" r="14" fill="#3F6E63"/>';
      h += '<circle cx="24" cy="24" r="6.6" fill="' + PAPER + '"/>';
      h += '<path d="M24 10 L24 17 M24 31 L24 38 M10 24 L17 24 M31 24 L38 24" stroke="' + PAPER + '" stroke-width="1.6" opacity="0.65"/>';
      h += '<circle cx="24" cy="24" r="14" fill="none" stroke="' + INK + '" stroke-width="1.4"/>';
    }
    return h + '</svg>';
  }

  /* ============ 场景 ============ */

  function setVeil(mode) {
    var v = $('veil');
    v.className = mode || '';
  }

  function show(id) {
    var list = document.querySelectorAll('.scene');
    for (var i = 0; i < list.length; i++) list[i].className = 'scene';
    $(id).className = 'scene on';

    var art = window.StallArt;
    if (!art) return;
    if (id === 's-market') { art.setScene('market'); setVeil('none'); }
    else if (id === 's-intro') { art.setScene('intro'); setVeil(''); }
    else if (id === 's-result') { art.setScene('result'); setVeil('heavy'); }
    else { art.setScene('list'); setVeil('heavy'); }
  }

  /* ============ 行情 ============ */

  function dayBrief(d) {
    var g = byId(d.hot);
    var w = d.weather === '晴' ? '日头好，赶集的人挤' :
            (d.weather === '阴' ? '阴天，来人不多不少' : '飘着细雨，街上冷清');
    return d.timeLabel + '·' + d.timeName + ' ／ ' + d.weather + '，' + w
      + '；<b>' + (g ? g.n : '杂货') + '</b>今日俏。' + (d.gossip ? '「' + d.gossip + '」' : '');
  }

  /* ============ 进货 ============ */

  function renderBuy() {
    var pool = playGoods();
    var html = '';
    for (var i = 0; i < pool.length; i++) {
      var g = pool[i];
      var q = G.stock[g.id] || 0;
      var maxQ = Math.max(0, Math.min(8, Math.floor((G.cash + q * g.cost) / g.cost)));
      var hot = g.id === G.day.hot;
      html += '<div class="row">'
        + '<div class="ic">' + ic(g.id) + '</div>'
        + '<div class="info">'
        +   '<div class="nm">' + g.n
        +     (hot ? '<span class="tag">今日俏</span>' : '')
        +     '<span class="tag n">' + g.note + '</span>'
        +   '</div>'
        +   '<div class="meta">进 <b>' + g.cost + '</b> · 市价 <b>' + g.base + '</b>'
        +     ' · 可拿 <b>' + maxQ + '</b> 件</div>'
        + '</div>'
        + '<div class="step">'
        +   '<button class="step-btn" data-act="Buy-" data-id="' + g.id + '"' + (q <= 0 ? ' disabled' : '') + '>−</button>'
        +   '<span class="step-v">' + q + '</span>'
        +   '<button class="step-btn" data-act="Buy+" data-id="' + g.id + '"' + (q >= maxQ ? ' disabled' : '') + '>+</button>'
        + '</div>'
        + '</div>';
    }
    $('buyList').innerHTML = html
      + '<div class="tip">'
      +   '<b>进货的门道</b>'
      +   '<span>货要对人：<em>小儿</em>只问糖画泥人，<em>书生</em>看扇与纸鸢，'
      +   '<em>富户</em>才买得起花灯玉扣。样样都进，本钱摊薄，一件也卖不快。</span>'
      + '</div>';
    $('cashLeft').innerHTML = G.cash;
  }

  function changeBuy(id, delta) {
    var g = byId(id);
    if (!g) return;
    var q = G.stock[id] || 0;
    var next = q + delta;
    if (next < 0) next = 0;
    var maxQ = Math.min(8, Math.floor((G.cash + q * g.cost) / g.cost));
    if (next > maxQ) next = maxQ;
    if (next === q) return;
    G.stock[id] = next;
    G.cash = G.cash + (q - next) * g.cost;
    renderBuy();
    if (window.StallArt) window.StallArt.setStock(G.stock);
  }

  /* ============ 定价 ============ */

  function priceHint(g, p) {
    if (p <= g.cost) return { t: '白忙一场', c: 'bad' };
    if (p <= Math.round(g.base * 0.86)) return { t: '便宜，走得快', c: 'good' };
    if (p <= Math.round(g.base * 1.08)) return { t: '中规中矩', c: '' };
    if (p <= Math.round(g.base * 1.30)) return { t: '有人要还价', c: '' };
    return { t: '怕是要剩', c: 'bad' };
  }

  function renderPrice() {
    var pool = playGoods();
    var html = '';
    var cost = 0;
    for (var i = 0; i < pool.length; i++) {
      var g = pool[i];
      var q = G.stock[g.id] || 0;
      if (!q) continue;
      cost += q * g.cost;
      var p = G.price[g.id] === undefined ? Math.round(g.base * 0.95) : G.price[g.id];
      G.price[g.id] = p;
      var h = priceHint(g, p);
      html += '<div class="row">'
        + '<div class="ic">' + ic(g.id) + '</div>'
        + '<div class="info">'
        +   '<div class="nm">' + g.n + '<span class="tag n">' + q + ' 件</span></div>'
        +   '<div class="meta">进 <b>' + g.cost + '</b> · 市价 <b>' + g.base + '</b> · '
        +     '<span class="' + h.c + '">' + h.t + '</span></div>'
        + '</div>'
        + '<div class="step">'
        +   '<button class="step-btn" data-act="Pr-" data-id="' + g.id + '">−</button>'
        +   '<span class="step-v">' + p + '<i> 文</i></span>'
        +   '<button class="step-btn" data-act="Pr+" data-id="' + g.id + '">+</button>'
        + '</div>'
        + '</div>';
    }
    $('priceList').innerHTML = (html || '<div class="tip"><span>没进货，回去挑点东西吧。</span></div>')
      + (html ? ('<div class="tip">'
      +   '<b>开价的分寸</b>'
      +   '<span>客人心里有数，大抵在市价的八九成到一倍二之间。开到一倍二上下，'
      +   '有人会当场<em>还价</em>——你肯让，这单就成；不肯，人就走了。</span>'
      + '</div>') : '');
    $('costLeft').innerHTML = cost;
    G.cost = cost;
    renderSign();
  }

  function renderSign() {
    var btns = $('signRow').childNodes;
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!b.getAttribute || !b.getAttribute('data-act')) continue;
      var n = Number(b.getAttribute('data-id'));
      b.className = 'chip' + (n === G.sign ? ' on' : '');
    }
  }

  function changePrice(id, delta) {
    var g = byId(id);
    if (!g) return;
    var p = G.price[id];
    var next = p + delta;
    if (next < Math.round(g.cost * 0.9)) next = Math.round(g.cost * 0.9);
    if (next > Math.round(g.base * 1.7)) next = Math.round(g.base * 1.7);
    G.price[id] = next;
    renderPrice();
  }

  /* ============ 开市 ============ */

  function pickKind() {
    var total = 0, i;
    for (i = 0; i < KINDS.length; i++) total += KINDS[i].w;
    var r = Math.random() * total;
    for (i = 0; i < KINDS.length; i++) {
      r -= KINDS[i].w;
      if (r <= 0) return KINDS[i];
    }
    return KINDS[0];
  }

  function buildQueue() {
    var pool = playGoods();
    var have = stockIds();
    var q = [];
    var n = Math.max(3, G.day.count);
    for (var i = 0; i < n; i++) {
      var k = pickKind();
      var want = null;
      var j;
      /* 先按偏好挑，且优先挑有库存的 */
      var likes = [];
      for (j = 0; j < k.like.length; j++) {
        if (byId(k.like[j]) && byId(k.like[j]).unlock <= G.round) likes.push(k.like[j]);
      }
      if (likes.length) {
        var withStock = [];
        for (j = 0; j < likes.length; j++) {
          if ((G.stock[likes[j]] || 0) > 0) withStock.push(likes[j]);
        }
        var src = withStock.length ? withStock : likes;
        want = src[Math.floor(Math.random() * src.length)];
      }
      if (!want) want = have[Math.floor(Math.random() * have.length)];

      /* 想要的东西没货 → 将就问问别的，出价更低 */
      var compromise = (G.stock[want] || 0) <= 0;
      if (compromise) {
        var others = stockIds();
        if (others.length) want = others[Math.floor(Math.random() * others.length)];
      }

      var g = byId(want);
      if (!g) continue;
      var mul = k.pay * (0.86 + Math.random() * 0.30);
      mul = mul * (g.id === G.day.hot ? 1.08 : 1);
      mul = mul * SIGNS[G.sign].pay;
      if (compromise) mul = mul * 0.86;
      var willPay = Math.max(g.cost, Math.round(g.base * mul));
      q.push({ kind: k.id, id: g.id, willPay: willPay, compromise: compromise });
    }
    return q;
  }

  function startMarket() {
    var total = stockTotal();
    G.day.count = Math.max(4, Math.min(G.day.count, total + 4));
    G.queue = buildQueue();
    G.qi = 0; G.rev = 0; G.sold = 0; G.asked = 0;
    G.run = true; G.paused = false;
    $('feed').innerHTML = '';
    $('mkCome').innerHTML = '0';
    $('mkSold').innerHTML = '0';
    $('mkRev').innerHTML = '0';
    $('mkBar').style.width = '0%';
    $('mkClock').innerHTML = G.day.timeName + '·' + G.day.timeLabel;
    renderLeft();
    show('s-market');
    if (window.StallArt) {
      window.StallArt.setStock(G.stock);
      window.StallArt.setSign(G.sign);
    }
    /* 吆喝：先显示本地的，AI 回来若更好就用 AI 的（只换一次） */
    showBubble(localCall());
    aiCall(function (c) { if (c) showBubble(c); });
    G.timer = setTimeout(startGuest, 420);
  }

  function showBubble(text) {
    var b = $('bubble');
    b.innerHTML = text;
    b.className = 'bubble on';
    setTimeout(function () { b.className = 'bubble'; }, 2800);
  }

  function renderLeft() {
    var pool = playGoods();
    var h = '';
    var any = false;
    for (var i = 0; i < pool.length; i++) {
      var g = pool[i];
      if (G.stock[g.id] === undefined) continue;
      any = true;
      var left = G.stock[g.id] || 0;
      h += '<span class="lf' + (left <= 0 ? ' zero' : '') + '"><i>' + g.n + '</i><b>' + left + '</b></span>';
    }
    $('mkLeft').innerHTML = '<span class="lf-k">摊上' + (any ? '还剩' : '空了') + '</span>' + h;
  }

  function addEv(html, cls) {
    var line = document.createElement('div');
    line.className = 'ev' + (cls ? ' ' + cls : '');
    line.innerHTML = html;
    var feed = $('feed');
    feed.appendChild(line);
    while (feed.childNodes.length > 2) feed.removeChild(feed.firstChild);
    setTimeout(function () { line.className += ' in'; }, 16);
    return line;
  }

  function tick() {
    if (!G.run || G.paused) return;
    if (G.qi >= G.queue.length) { finishMarket(); return; }
    var c = G.queue[G.qi];
    var k = kindById(c.kind);
    var g = byId(c.id);
    var p = G.price[c.id] === undefined ? g.base : G.price[c.id];
    var have = G.stock[c.id] || 0;

    if (have <= 0) {
      G.asked += 1;
      addEv('<span class="ev-ic">·</span><span class="ev-t">' + k.n + '问 <b>' + g.n + '</b></span>'
        + '<span class="ev-v">没货</span>', 'miss');
      if (window.StallArt) window.StallArt.buyHeld(c.kind, null);
      G.qi += 1;
      syncStats();
      nextTurn(760);
      return;
    }

    if (p <= c.willPay) {
      sellNow(c, g, p, k, 1);
      nextTurn(820);
      return;
    }

    /* 价高三成以内：客人还价，给玩家一次机会 */
    if (p <= Math.round(c.willPay * 1.45)) {
      doHaggle(c, g, p, k);
      return;
    }

    addEv('<span class="ev-ic">✕</span><span class="ev-t">' + k.n + '看了一眼 <b>' + g.n
      + '</b>，嫌贵走了</span><span class="ev-v">—</span>', 'leave');
    if (window.StallArt) window.StallArt.buyHeld(c.kind, null);
    G.asked += 1;
    G.qi += 1;
    syncStats();
    nextTurn(760);
  }

  function sellNow(c, g, price, k, quiet) {
    G.stock[c.id] = (G.stock[c.id] || 0) - 1;
    G.rev += price;
    G.sold += 1;
    G.asked += 1;
    if (!quiet) {
      addEv('<span class="ev-ic">✓</span><span class="ev-t">' + k.n + '买走 <b>' + g.n + '</b></span>'
        + '<span class="ev-v">+' + price + ' 文</span>', c.id === G.day.hot ? 'hot' : '');
    }
    if (window.StallArt) {
      window.StallArt.buyHeld(c.kind, c.id);
      window.StallArt.flyCoins(3);
      window.StallArt.setStock(G.stock);
    }
    syncStats();
  }

  function syncStats() {
    $('mkCome').innerHTML = G.asked;
    $('mkSold').innerHTML = G.sold;
    $('mkRev').innerHTML = G.rev;
    renderLeft();
    if (window.StallArt) window.StallArt.setStock(G.stock);
  }

  function nextTurn(delay) {
    if (!G.run) return;
    $('mkBar').style.width = Math.round((G.qi + 1) / Math.max(1, G.queue.length) * 100) + '%';
    if (G.qi >= G.queue.length) {
      G.timer = setTimeout(finishMarket, delay);
      return;
    }
    G.timer = setTimeout(startGuest, delay);
  }

  function startGuest() {
    if (!G.run) return;
    if (G.qi >= G.queue.length) { finishMarket(); return; }
    var c = G.queue[G.qi];
    if (window.StallArt) window.StallArt.addGuest(c.kind);
    G.timer = setTimeout(tick, 1020);
  }

  /* --- 还价 --- */
  function doHaggle(c, g, p, k) {
    G.paused = true;
    var feed = $('feed');
    while (feed.childNodes.length > 0) feed.removeChild(feed.firstChild);
    var wait = 1900;
    var start = Date.now();
    var line = addEv(
      '<div class="talk-say">' + k.n + '拿起 <b>' + g.n + '</b>：「<em>'
      + (k.line[Math.floor(Math.random() * k.line.length)]) + '</em> ' + p + ' 文太贵，'
      + c.willPay + ' 文卖不卖？」</div>'
      + '<div class="talk-row">'
      +   '<div class="talk-bar"><i id="talkBar"></i></div>'
      +   '<button class="talk-btn ghost" data-act="NoDeal">不卖</button>'
      +   '<button class="talk-btn" data-act="Deal" data-id="' + c.id + '" data-p="' + c.willPay + '">让了</button>'
      + '</div>', 'talk');
    line.className = 'ev talk in';

    G.haggle = { c: c, g: g, price: c.willPay, kind: k, el: line };

    var bar = $('talkBar');
    clearInterval(G.haggleTimer);
    G.haggleTimer = setInterval(function () {
      var left = 1 - (Date.now() - start) / wait;
      if (left <= 0) {
        clearInterval(G.haggleTimer);
        closeHaggle(false);
        return;
      }
      if (bar) bar.style.width = Math.round(left * 100) + '%';
    }, 60);

    setTimeout(function () {
      if (G.haggle) closeHaggle(false);
    }, wait);
  }

  function closeHaggle(deal) {
    if (!G.haggle) return;
    var hg = G.haggle;
    G.haggle = null;
    clearInterval(G.haggleTimer);
    if (hg.el && hg.el.parentNode) hg.el.parentNode.removeChild(hg.el);

    if (deal) {
      sellNow(hg.c, hg.g, hg.price, hg.kind, true);
      addEv('<span class="ev-ic">✓</span><span class="ev-t">让到 <b>' + hg.price + ' 文</b>，'
        + hg.kind.n + '买走了 ' + hg.g.n + '</span><span class="ev-v">+' + hg.price + ' 文</span>', 'hot');
      if (window.StallArt) window.StallArt.shake(160);
    } else {
      addEv('<span class="ev-ic">✕</span><span class="ev-t">没让价，' + hg.kind.n
        + '放下 <b>' + hg.g.n + '</b> 走了</span><span class="ev-v">—</span>', 'leave');
      G.asked += 1;
      if (window.StallArt) window.StallArt.buyHeld(hg.kind.id, null);
    }
    G.qi += 1;
    G.paused = false;
    syncStats();
    nextTurn(760);
  }

  function skipMarket() {
    if (!G.run) return;
    clearTimeout(G.timer);
    clearInterval(G.haggleTimer);
    if (G.haggle) {
      var hg = G.haggle;
      G.haggle = null;
      if (hg.el && hg.el.parentNode) hg.el.parentNode.removeChild(hg.el);
    }
    G.paused = false;
    while (G.qi < G.queue.length) {
      var c = G.queue[G.qi];
      var g = byId(c.id);
      var p = G.price[c.id] === undefined ? g.base : G.price[c.id];
      var have = G.stock[c.id] || 0;
      if (have > 0 && p <= c.willPay) {
        G.stock[c.id] = have - 1;
        G.rev += p;
        G.sold += 1;
      }
      G.asked += 1;
      G.qi += 1;
    }
    $('mkBar').style.width = '100%';
    syncStats();
    finishMarket();
  }

  /* ============ 结算 ============ */

  function finishMarket() {
    if (!G.run) return;
    G.run = false;
    clearTimeout(G.timer);
    clearInterval(G.haggleTimer);
    var left = stockTotal();
    var profit = G.rev - G.cost;

    var stars = 1;
    if (profit >= 65) stars = 5;
    else if (profit >= 34) stars = 4;
    else if (profit >= 12) stars = 3;
    else if (profit >= 0) stars = 2;

    var card = $('rsCard');
    card.className = 'rs-card';
    $('rsProfit').innerHTML = (profit >= 0 ? '+' : '') + profit;
    $('rsProfit').parentNode.className = 'rs-profit' + (profit < 0 ? ' neg' : '');
    var seal = $('rsSeal');
    seal.innerHTML = profit >= 0 ? '盈' : '亏';
    seal.className = 'rs-seal' + (profit < 0 ? ' neg' : '');

    var rate = G.asked ? Math.round(G.sold / G.asked * 100) : 0;
    var base = profit >= 0 ? '日进斗金' : '赔了本钱';
    if (profit >= 0 && profit < 12) base = '勉强回本';
    else if (profit >= 12 && profit < 34) base = '小有盈余';
    else if (profit >= 34) base = '生意兴隆';

    $('rsTitle').innerHTML = base;
    $('rsSub').innerHTML = '来客 ' + G.asked + ' 位，成交 ' + G.sold + ' 笔，成交率 ' + rate + '%';

    $('rsLines').innerHTML =
        '<div class="rs-line"><span>进货支出</span><b>−' + G.cost + ' 文</b></div>'
      + '<div class="rs-line"><span>卖货收入</span><b>+' + G.rev + ' 文</b></div>'
      + '<div class="rs-line"><span>剩下没卖</span><b>' + left + ' 件</b></div>';

    var cmt = '';
    if (profit < 0) cmt = '价开高了，客人问一句就走。下一摊把俏货开得实在些。';
    else if (G.sold === 0) cmt = '一整摊没开张，怕是这市口不吃你这些货。';
    else if (left > 0) cmt = '还剩 ' + left + ' 件没出手，下回少进些，或早些让价。';
    else if (rate >= 85) cmt = '货备得准，价开得稳，几乎没让客人空手走。';
    else cmt = '货卖空了，说明还敢再进点——不过价或许还能再抬一分。';
    $('rsComment').innerHTML = cmt;

    var sh = '';
    for (var i = 0; i < 5; i++) sh += i < stars ? '<span>★</span>' : '<s>★</s>';
    $('rsStars').innerHTML = sh;

    $('rsCouplet').innerHTML = '　';

    G.coins = G.coins + profit;
    if (profit > G.best) G.best = profit;
    G.round += 1;
    writeSave({ coins: G.coins, best: G.best, round: G.round });
    renderHud();
    show('s-result');

    /* 印章砸落的同一拍，AI 题词占位先填本地的，回来再换 */
    setTimeout(function () { card.className = 'rs-card stamped'; }, 220);
    if (window.StallArt) window.StallArt.shake(200);

    var goodsNames = [];
    for (var k in G.stock) {
      if (G.stock.hasOwnProperty(k) && G.stock[k] !== undefined) {
        var gg = byId(k);
        if (gg) goodsNames.push(gg.n);
      }
    }
    var vb = localVerse(stars);
    $('rsCouplet').innerHTML = vb.t + '——' + vb.l;

    aiVerse({
      profit: profit, asked: G.asked, sold: G.sold, left: left,
      goods: goodsNames.slice(0, 4).join('、')
    }, function (v) {
      if (!v) return;
      $('rsCouplet').innerHTML = v.t + '——' + v.l;
    });
  }

  /* ============ 局面 ============ */

  function renderHud() {
    $('hudCoins').innerHTML = G.coins;
    $('hudRound').innerHTML = G.round;
  }

  function timeCrowd(key) {
    for (var i = 0; i < TIMES.length; i++) if (TIMES[i].key === key) return TIMES[i].crowd;
    return 1;
  }

  function applyDay(d) {
    G.day = d;
    G.day.count = Math.round((8 + Math.random() * 4) * d.crowdBase * timeCrowd(d.time))
      + SIGNS[G.sign].crowd;
    $('dayBrief').innerHTML = dayBrief(d);
    $('dayTip').innerHTML = dayBrief(d);
    $('hudTime').innerHTML = d.timeName;
    if (window.StallArt) {
      window.StallArt.setTime(d.time);
      window.StallArt.setStock(G.stock);
      window.StallArt.setSign(G.sign);
    }
  }

  function newRound() {
    G.cash = CAPITAL;
    G.stock = {};
    G.price = {};
    G.cost = 0;
    G.sign = 0;
    G.rev = 0; G.sold = 0; G.asked = 0; G.qi = 0;
    G.run = false; G.paused = false;
    clearTimeout(G.timer);
    clearInterval(G.haggleTimer);
    G.haggle = null;

    aiTalk(function (d) {
      applyDay(d || localTalk());
      renderBuy();
      renderPrice();
      show('s-buy');
    });
  }

  /* ============ 事件 ============ */

  function onAct(act, el) {
    var id = el.getAttribute('data-id');
    if (act === 'Start') {
      clearTimeout(G.timer);
      newRound();
    } else if (act === 'Buy+') { changeBuy(id, 1); }
    else if (act === 'Buy-') { changeBuy(id, -1); }
    else if (act === 'ToPrice') {
      if (stockTotal() === 0) return;
      renderPrice();
      show('s-price');
    } else if (act === 'Pr+') { changePrice(id, 1); }
    else if (act === 'Pr-') { changePrice(id, -1); }
    else if (act === 'Sign') {
      G.sign = Number(id) || 0;
      renderSign();
      if (window.StallArt) window.StallArt.setSign(G.sign);
      applyDay(G.day);
      renderPrice();
    } else if (act === 'Open') {
      if (stockTotal() === 0) return;
      startMarket();
    } else if (act === 'Skip') { skipMarket(); }
    else if (act === 'Deal') { closeHaggle(true); }
    else if (act === 'NoDeal') { closeHaggle(false); }
    else if (act === 'Again') { show('s-intro'); }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document) {
      if (t.getAttribute) {
        var act = t.getAttribute('data-act');
        if (act) { onAct(act, t); return; }
      }
      t = t.parentNode;
    }
  }, false);

  /* ============ 启动 ============ */

  function boot() {
    var s = readSave();
    G.coins = s.coins;
    G.best = s.best;
    G.round = s.round;
    renderHud();
    $('bestProfit').innerHTML = G.best;
    if (window.StallArt) {
      window.StallArt.init($('cv'));
      window.StallArt.setStock({});
      window.StallArt.setSign(0);
    }
    show('s-intro');
  }

  boot();
})();
