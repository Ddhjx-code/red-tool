/* 小摊记 —— 古风集市卖货经营
   一局：进货 → 定价 → 开市 → 结算，3 分钟左右
   Chrome 61 基线：var + function，无箭头函数、无模板串、无 let/const。 */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ============ 存档 ============ */
  var SAVE_KEY = 'stall_save_v1';
  var AI_ENABLED = false;   /* AI 分支开关：内测接口需加白，且走不了第三方 Agent 上传 */

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
    if (!raw) return { coins: 0, best: 0, round: 1 };
    try {
      var o = JSON.parse(raw);
      return {
        coins: Number(o.coins) || 0,
        best: Number(o.best) || 0,
        round: Number(o.round) || 1
      };
    } catch (e3) {
      return { coins: 0, best: 0, round: 1 };
    }
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

  /* ============ 货品 ============ */
  var ALL_GOODS = [
    { id: 'fan',     n: '折扇',  cost: 24, base: 40, w: 1.00, unlock: 0 },
    { id: 'sachet',  n: '香囊',  cost: 10, base: 18, w: 0.90, unlock: 0 },
    { id: 'candy',   n: '糖画',  cost: 5,  base: 10, w: 1.15, unlock: 0 },
    { id: 'lamp',    n: '花灯',  cost: 40, base: 70, w: 0.75, unlock: 0 },
    { id: 'kite',    n: '纸鸢',  cost: 18, base: 32, w: 0.95, unlock: 5 },
    { id: 'candied', n: '糖葫芦', cost: 4, base: 9,  w: 1.10, unlock: 11 }
  ];

  var CAPITAL = 100;

  var G = {
    coins: 0, best: 0, round: 1,
    cash: CAPITAL, stock: {}, price: {}, cost: 0,
    day: null, queue: [], qi: 0,
    rev: 0, sold: 0, asked: 0, run: false, timer: null
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

  function stockTotal() {
    var s = 0;
    for (var k in G.stock) if (G.stock.hasOwnProperty(k)) s += G.stock[k];
    return s;
  }

  /* ============ 图形 ============ */
  var INK = '#2C2620';

  function goodsIcon(id) {
    var h = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">';
    if (id === 'fan') {
      h += '<path d="M24 38 L6 17 A21 21 0 0 1 42 17 Z" fill="#B4462F" opacity="0.14"/>';
      h += '<path d="M24 38 L6 17 A21 21 0 0 1 42 17 Z" fill="none" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/>';
      h += '<path d="M24 38 L24 9 M24 38 L12 14 M24 38 L36 14" stroke="' + INK + '" stroke-width="1.1" opacity="0.55"/>';
      h += '<circle cx="24" cy="38" r="2.4" fill="' + INK + '"/>';
    } else if (id === 'sachet') {
      h += '<path d="M17 20 Q24 15 31 20 L34 33 Q24 40 14 33 Z" fill="#7A5C3E" opacity="0.16"/>';
      h += '<path d="M17 20 Q24 15 31 20 L34 33 Q24 40 14 33 Z" fill="none" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/>';
      h += '<path d="M17 20 Q24 24 31 20" fill="none" stroke="' + INK + '" stroke-width="1.2"/>';
      h += '<path d="M24 10 L24 16 M20 12 L24 10 L28 12" fill="none" stroke="' + INK + '" stroke-width="1.3" stroke-linecap="round"/>';
      h += '<path d="M24 36 L24 43 M22 43 L26 43" stroke="#B4462F" stroke-width="1.4" stroke-linecap="round"/>';
    } else if (id === 'candy') {
      h += '<path d="M24 22 C30 22 33 27 29 31 C25 35 17 32 18 26 C19 21 27 18 32 23" fill="none" stroke="#C9902F" stroke-width="2.2" stroke-linecap="round"/>';
      h += '<path d="M24 34 L24 44" stroke="' + INK + '" stroke-width="1.4" stroke-linecap="round"/>';
      h += '<circle cx="24" cy="25" r="9" fill="#C9902F" opacity="0.12"/>';
    } else if (id === 'lamp') {
      h += '<ellipse cx="24" cy="24" rx="12" ry="13" fill="#B4462F" opacity="0.15"/>';
      h += '<ellipse cx="24" cy="24" rx="12" ry="13" fill="none" stroke="' + INK + '" stroke-width="1.6"/>';
      h += '<path d="M12 24 L36 24 M24 11 L24 37" stroke="' + INK + '" stroke-width="1" opacity="0.5"/>';
      h += '<path d="M24 37 L24 45 M21 45 L27 45" stroke="#B4462F" stroke-width="1.5" stroke-linecap="round"/>';
      h += '<path d="M18 10 L30 10" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>';
    } else if (id === 'kite') {
      h += '<path d="M24 8 L36 20 L24 34 L12 20 Z" fill="#3F6E63" opacity="0.15"/>';
      h += '<path d="M24 8 L36 20 L24 34 L12 20 Z" fill="none" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/>';
      h += '<path d="M24 8 L24 34 M12 20 L36 20" stroke="' + INK + '" stroke-width="1" opacity="0.5"/>';
      h += '<path d="M24 34 Q20 39 25 42 Q30 45 26 47" fill="none" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round"/>';
    } else {
      h += '<path d="M24 40 L24 16" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>';
      h += '<circle cx="24" cy="13" r="4.2" fill="#B4462F" opacity="0.35" stroke="' + INK + '" stroke-width="1.3"/>';
      h += '<circle cx="24" cy="21" r="4.2" fill="#B4462F" opacity="0.35" stroke="' + INK + '" stroke-width="1.3"/>';
      h += '<circle cx="24" cy="29" r="4.2" fill="#B4462F" opacity="0.35" stroke="' + INK + '" stroke-width="1.3"/>';
    }
    return h + '</svg>';
  }

  function introArt() {
    var h = '<svg viewBox="0 0 176 132" xmlns="http://www.w3.org/2000/svg">';
    h += '<path d="M20 34 L156 34 L146 52 L30 52 Z" fill="#B4462F" opacity="0.18"/>';
    h += '<path d="M20 34 L156 34 L146 52 L30 52 Z" fill="none" stroke="' + INK + '" stroke-width="1.8" stroke-linejoin="round"/>';
    h += '<path d="M38 34 L38 52 M76 34 L76 52 M114 34 L114 52" stroke="' + INK + '" stroke-width="1" opacity="0.35"/>';
    h += '<path d="M34 52 L34 106 M142 52 L142 106" stroke="' + INK + '" stroke-width="1.8" stroke-linecap="round"/>';
    h += '<path d="M26 106 L150 106 L150 114 L26 114 Z" fill="#B4462F" opacity="0.12"/>';
    h += '<path d="M26 106 L150 106 L150 114 L26 114 Z" fill="none" stroke="' + INK + '" stroke-width="1.6"/>';
    h += '<circle cx="62" cy="88" r="9" fill="#C9902F" opacity="0.2" stroke="' + INK + '" stroke-width="1.4"/>';
    h += '<path d="M62 79 L62 97" stroke="' + INK + '" stroke-width="1" opacity="0.5"/>';
    h += '<path d="M84 96 L84 74 L100 74 L100 96" fill="#3F6E63" opacity="0.16" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>';
    h += '<path d="M118 96 L118 82 M116 96 L130 96" stroke="' + INK + '" stroke-width="1.4" stroke-linecap="round"/>';
    h += '<path d="M123 82 L131 88 L123 94 Z" fill="#B4462F" opacity="0.3" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>';
    h += '</svg>';
    return h;
  }

  function stallArt() {
    var h = '<svg viewBox="0 0 320 132" xmlns="http://www.w3.org/2000/svg">';
    // 檐下阴影
    h += '<path d="M30 30 L290 30 L272 54 L48 54 Z" fill="#B4462F" opacity="0.14"/>';
    // 檐（上宽下窄）+ 波浪边
    h += '<path d="M30 30 L290 30 L272 54 Q266 60 260 54 Q254 60 248 54 Q242 60 236 54 Q230 60 224 54 '
      + 'Q218 60 212 54 Q206 60 200 54 Q194 60 188 54 Q182 60 176 54 Q170 60 164 54 Q158 60 152 54 '
      + 'Q146 60 140 54 Q134 60 128 54 Q122 60 116 54 Q110 60 104 54 Q98 60 92 54 Q86 60 80 54 '
      + 'Q74 60 68 54 Q62 60 56 54 L48 54 Z" fill="#B4462F" opacity="0.2"/>';
    h += '<path d="M30 30 L290 30 L272 54 Q266 60 260 54 Q254 60 248 54 Q242 60 236 54 Q230 60 224 54 '
      + 'Q218 60 212 54 Q206 60 200 54 Q194 60 188 54 Q182 60 176 54 Q170 60 164 54 Q158 60 152 54 '
      + 'Q146 60 140 54 Q134 60 128 54 Q122 60 116 54 Q110 60 104 54 Q98 60 92 54 Q86 60 80 54 '
      + 'Q74 60 68 54 Q62 60 56 54 L48 54 Z" fill="none" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>';
    h += '<path d="M40 30 L280 30" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>';
    // 立柱
    h += '<path d="M56 56 L56 106 M264 56 L264 106" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round"/>';
    // 幌子
    h += '<path d="M264 58 L286 58 L286 92 L275 98 L264 92 Z" fill="#B4462F" opacity="0.26" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>';
    h += '<text x="275" y="82" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="13" fill="' + INK + '" opacity="0.75">市</text>';
    // 案桌
    h += '<path d="M40 106 L280 106 L280 116 L40 116 Z" fill="#B4462F" opacity="0.1"/>';
    h += '<path d="M40 106 L280 106 L280 116 L40 116 Z" fill="none" stroke="' + INK + '" stroke-width="1.4"/>';
    // 桌上的货
    h += '<rect x="66" y="80" width="26" height="26" rx="3" fill="#C9902F" opacity="0.18" stroke="' + INK + '" stroke-width="1.1"/>';
    h += '<path d="M79 80 L79 106" stroke="' + INK + '" stroke-width="0.8" opacity="0.4"/>';
    h += '<rect x="104" y="84" width="22" height="22" rx="3" fill="#3F6E63" opacity="0.18" stroke="' + INK + '" stroke-width="1.1"/>';
    h += '<circle cx="156" cy="92" r="12" fill="#B4462F" opacity="0.16" stroke="' + INK + '" stroke-width="1.2"/>';
    h += '<path d="M156 80 L156 104 M144 92 L168 92" stroke="' + INK + '" stroke-width="0.8" opacity="0.35"/>';
    h += '<path d="M196 106 L196 88 L222 88 L222 106" fill="#7A5C3E" opacity="0.14" stroke="' + INK + '" stroke-width="1.1" stroke-linejoin="round"/>';
    h += '<path d="M236 106 L236 94 M233 106 L250 106" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round"/>';
    h += '</svg>';
    return h;
  }

  function personIcon(mood) {
    var h = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">';
    h += '<circle cx="12" cy="8.5" r="3.6" fill="none" stroke="' + INK + '" stroke-width="1.5"/>';
    h += '<path d="M5 20 Q12 14.6 19 20" fill="none" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round"/>';
    if (mood === 'happy') {
      h += '<path d="M10.4 8.6 L11.2 9.4 M13.6 8.6 L12.8 9.4" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round"/>';
    }
    return h + '</svg>';
  }

  /* ============ 场景切换 ============ */
  function show(id) {
    var list = document.querySelectorAll('.scene');
    for (var i = 0; i < list.length; i++) list[i].className = 'scene';
    $(id).className = 'scene on';
  }

  /* ============ 行情 ============ */
  function genDay() {
    var wRoll = Math.random();
    var weather = wRoll < 0.55 ? '晴' : (wRoll < 0.82 ? '阴' : '微雨');
    var crowd = weather === '晴' ? 1.1 : (weather === '阴' ? 0.98 : 0.86);
    var pool = playGoods();
    var hot = pool[Math.floor(Math.random() * pool.length)].id;
    var n = Math.round((9 + Math.random() * 4) * crowd);
    return { weather: weather, hot: hot, crowd: crowd, count: n };
  }

  function dayBrief(d) {
    var g = byId(d.hot);
    var w = d.weather === '晴' ? '日头好，赶集的人挤' :
            (d.weather === '阴' ? '阴天，来人不多不少' : '飘着细雨，街上冷清');
    return w + '；' + (g ? g.n : '') + '今日俏。';
  }

  /* AI 分支：今日行情（结构化返回，只取字段，校验后才用）
     内测接口需加白，且这类能力走不了第三方 Agent 上传，故默认关闭。 */
  function aiDayBrief(cb) {
    if (!AI_ENABLED) { cb(null); return; }
    var ai = window.xhs && window.xhs.AI;
    if (!ai) { cb(null); return; }
    var SYS = '你是集市行情生成器。只输出 JSON，形如 {"weather":"晴","hot":"fan"}。'
      + 'weather 只能是 晴/阴/雨；hot 只能是 fan/sachet/candy/lamp/kite/candied 之一。不要解释。';
    try {
      var model = ai.createModel('deepseek-v4-flash');
      var p = model.generateText({
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: '给一日的集市行情' }
        ],
        max_output_tokens: 60,
        temperature: 0.6
      });
      if (p && typeof p.then === 'function') {
        p.then(function (res) {
          var raw = (res && res.choices && res.choices[0] && res.choices[0].message
            && res.choices[0].message.content) || '';
          var data = null;
          try { data = JSON.parse(raw); } catch (e) { cb(null); return; }
          var okW = data && (data.weather === '晴' || data.weather === '阴' || data.weather === '雨');
          var okH = data && byId(data.hot);
          if (!okW || !okH) { cb(null); return; }
          cb({ weather: data.weather === '雨' ? '微雨' : data.weather, hot: data.hot });
        })['catch'](function () { cb(null); });
        return;
      }
    } catch (e2) { /* 落到本地 */ }
    cb(null);
  }

  /* ============ 进货 ============ */
  function renderBuy() {
    var pool = playGoods();
    var html = '';
    for (var i = 0; i < pool.length; i++) {
      var g = pool[i];
      var q = G.stock[g.id] || 0;
      var maxQ = Math.max(0, Math.min(8, Math.floor(G.cash / g.cost)));
      html += '<div class="row">'
        + '<div class="ic">' + goodsIcon(g.id) + '</div>'
        + '<div class="info">'
        +   '<div class="nm">' + g.n + (g.id === G.day.hot ? '<span class="tag">今日俏</span>' : '') + '</div>'
        +   '<div class="meta">进价 <b>' + g.cost + '</b> 文 · 市价 <b>' + g.base + '</b> 文 · 还能拿 <b>' + maxQ + '</b> 件</div>'
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
      +   '<span>贵货压本钱，贱货占地方。今日 <em>' + (byId(G.day.hot) ? byId(G.day.hot).n : '') + '</em> 俏，多进两件有人接；'
      +   '花灯这类大件，卖不动就砸手里——先少拿。</span>'
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
  }

  /* ============ 定价 ============ */
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
      var hint = p <= g.cost ? '白忙一场' : (p <= g.base * 0.9 ? '便宜好卖' : (p >= g.base * 1.35 ? '怕是要剩' : '中规中矩'));
      html += '<div class="row">'
        + '<div class="ic">' + goodsIcon(g.id) + '</div>'
        + '<div class="info">'
        +   '<div class="nm">' + g.n + '<span class="tag">' + q + ' 件</span></div>'
        +   '<div class="meta">进价 <b>' + g.cost + '</b> · 市价 <b>' + g.base + '</b> · ' + hint + '</div>'
        + '</div>'
        + '<div class="step">'
        +   '<button class="step-btn" data-act="Pr-" data-id="' + g.id + '">−</button>'
        +   '<span class="step-v">' + p + '<i> 文</i></span>'
        +   '<button class="step-btn" data-act="Pr+" data-id="' + g.id + '">+</button>'
        + '</div>'
        + '</div>';
    }
    $('priceList').innerHTML = (html || '<div class="sc-d">没进货，回去挑点东西吧。</div>')
      + (html ? ('<div class="tip">'
      +   '<b>开价的分寸</b>'
      +   '<span>客人心里各有各的价，大抵在市价的八成到一倍二之间。开在市价上下最稳；'
      +   '开到一倍四以上，多半只能看着人走。</span>'
      + '</div>') : '');
    $('costLeft').innerHTML = cost;
    G.cost = cost;
  }

  function changePrice(id, delta) {
    var g = byId(id);
    if (!g) return;
    var p = G.price[id];
    var next = p + delta;
    if (next < g.cost) next = g.cost;
    if (next > Math.round(g.base * 1.7)) next = Math.round(g.base * 1.7);
    G.price[id] = next;
    renderPrice();
  }

  /* ============ 开市 ============ */
  function buildQueue() {
    var pool = playGoods();
    var q = [];
    for (var i = 0; i < G.day.count; i++) {
      var weights = [];
      var total = 0;
      for (var j = 0; j < pool.length; j++) {
        var g = pool[j];
        var w = g.w * (g.id === G.day.hot ? 1.8 : 1);
        w = w * ((G.stock[g.id] || 0) > 0 ? 1 : 0.14);
        weights.push(w);
        total += w;
      }
      var r = Math.random() * total;
      var pick = pool[pool.length - 1];
      for (var k = 0; k < pool.length; k++) {
        r -= weights[k];
        if (r <= 0) { pick = pool[k]; break; }
      }
      var willPay = Math.round(pick.base * (0.76 + Math.random() * 0.48) * (pick.id === G.day.hot ? 1.06 : 1));
      q.push({ id: pick.id, willPay: willPay });
    }
    return q;
  }

  function startMarket() {
    var total = stockTotal();
    G.day.count = Math.max(3, Math.min(G.day.count, total + 3));
    G.queue = buildQueue();
    G.qi = 0; G.rev = 0; G.sold = 0; G.asked = 0; G.run = true;
    $('feed').innerHTML = '';
    $('mkCome').innerHTML = '0';
    $('mkSold').innerHTML = '0';
    $('mkRev').innerHTML = '0';
    $('mkBar').style.width = '0%';
    renderLeft();
    show('s-market');
    G.timer = setTimeout(tick, 420);
  }

  function renderLeft() {
    var pool = playGoods();
    var h = '';
    var any = false;
    for (var i = 0; i < pool.length; i++) {
      var g = pool[i];
      var q = G.stock[g.id] || 0;
      if (!q) continue;
      any = true;
      h += '<span class="lf"><i>' + g.n + '</i><b>' + q + '</b></span>';
    }
    $('mkLeft').innerHTML = '<span class="lf-k">摊上' + (any ? '还剩' : '空了') + '</span>' + h;
  }

  function tick() {
    if (!G.run) return;
    if (G.qi >= G.queue.length) { finishMarket(); return; }
    var c = G.queue[G.qi];
    var g = byId(c.id);
    var p = G.price[c.id] === undefined ? g.base : G.price[c.id];
    var have = G.stock[c.id] || 0;
    var sold = false;

    if (have > 0 && p <= c.willPay) {
      G.stock[c.id] = have - 1;
      G.rev += p;
      G.sold += 1;
      sold = true;
    }
    G.asked += 1;
    $('mkCome').innerHTML = G.asked;
    $('mkSold').innerHTML = G.sold;
    $('mkRev').innerHTML = G.rev;
    renderLeft();

    var line = document.createElement('div');
    line.className = 'ev' + (sold ? '' : ' miss') + (g.id === G.day.hot ? ' hot' : '');
    var vTxt = sold ? ('+' + p + ' 文') : (have <= 0 ? '没货' : '嫌贵走了');
    line.innerHTML = '<span class="ev-ic">' + personIcon(sold ? 'happy' : '') + '</span>'
      + '<span class="ev-t">有人来问 <b>' + g.n + '</b></span>'
      + '<span class="ev-v">' + vTxt + '</span>';

    var feed = $('feed');
    feed.appendChild(line);
    while (feed.childNodes.length > 5) feed.removeChild(feed.firstChild);
    setTimeout(function () { line.className += ' in'; }, 16);

    G.qi += 1;
    $('mkBar').style.width = Math.round(G.qi / G.queue.length * 100) + '%';
    G.timer = setTimeout(tick, 720);
  }

  function skipMarket() {
    if (!G.run) return;
    clearTimeout(G.timer);
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
    $('mkCome').innerHTML = G.asked;
    $('mkSold').innerHTML = G.sold;
    $('mkRev').innerHTML = G.rev;
    $('mkBar').style.width = '100%';
    renderLeft();
    finishMarket();
  }

  function finishMarket() {
    if (!G.run) return;
    G.run = false;
    clearTimeout(G.timer);
    var left = stockTotal();
    var profit = G.rev - G.cost;

    var stars = 1;
    if (profit >= 60) stars = 5;
    else if (profit >= 32) stars = 4;
    else if (profit >= 12) stars = 3;
    else if (profit >= 0) stars = 2;

    $('rsProfit').innerHTML = (profit >= 0 ? '+' : '') + profit;
    $('rsProfit').parentNode.className = 'rs-profit' + (profit < 0 ? ' neg' : '');
    $('rsSeal').innerHTML = profit >= 0 ? '盈' : '亏';
    $('rsTitle').innerHTML = stars >= 4 ? '日进斗金' : (stars === 3 ? '小有盈余' : (stars === 2 ? '勉强回本' : '赔了本钱'));
    var rate = G.asked ? Math.round(G.sold / G.asked * 100) : 0;
    $('rsSub').innerHTML = '来客 ' + G.asked + ' 位，成交 ' + G.sold + ' 笔，成交率 ' + rate + '%';

    $('rsLines').innerHTML =
        '<div class="rs-line"><span>进货支出</span><b>−' + G.cost + ' 文</b></div>'
      + '<div class="rs-line"><span>卖货收入</span><b>+' + G.rev + ' 文</b></div>'
      + '<div class="rs-line"><span>剩下没卖</span><b>' + left + ' 件</b></div>';

    var cmt = '';
    if (profit < 0) cmt = '价开得太高，客人都摇着头走了。下一摊把俏货开得实在些。';
    else if (left > 0 && G.sold === 0) cmt = '一整摊没开张，怕是这市口不吃你这些货。';
    else if (left > 0) cmt = '还剩 ' + left + ' 件没出手，下回少进些，或早点让价。';
    else if (rate >= 85) cmt = '货备得准，价开得稳，几乎没让客人空手走。';
    else cmt = '货卖空了，说明还敢再进点——不过价或许还能再抬一分。';
    $('rsComment').innerHTML = cmt;

    var sh = '';
    for (var i = 0; i < 5; i++) sh += i < stars ? '<span>★</span>' : '<s>★</s>';
    $('rsStars').innerHTML = sh;

    G.coins = G.coins + profit;
    if (profit > G.best) G.best = profit;
    G.round += 1;
    writeSave({ coins: G.coins, best: G.best, round: G.round });
    renderHud();
    show('s-result');
  }

  /* ============ 局面 ============ */
  function renderHud() {
    $('hudCoins').innerHTML = G.coins;
    $('hudRound').innerHTML = G.round;
  }

  function newRound() {
    G.cash = CAPITAL;
    G.stock = {};
    G.price = {};
    G.cost = 0;
    G.rev = 0; G.sold = 0; G.asked = 0; G.qi = 0; G.run = false;
    clearTimeout(G.timer);
    aiDayBrief(function (aiDay) {
      var d = genDay();
      if (aiDay) { d.weather = aiDay.weather; d.hot = aiDay.hot; }
      G.day = d;
      $('dayBrief').innerHTML = dayBrief(d);
      renderBuy();
      renderPrice();
      $('dayTip').innerHTML = dayBrief(d);
      show('s-buy');
    });
  }

  /* ============ 事件 ============ */
  function onAct(act, el) {
    var id = el.getAttribute('data-id');
    if (act === 'Start') { newRound(); }
    else if (act === 'Buy+') { changeBuy(id, 1); }
    else if (act === 'Buy-') { changeBuy(id, -1); }
    else if (act === 'ToPrice') {
      if (stockTotal() === 0) return;
      renderPrice();
      show('s-price');
    }
    else if (act === 'Pr+') { changePrice(id, 1); }
    else if (act === 'Pr-') { changePrice(id, -1); }
    else if (act === 'Open') {
      if (stockTotal() === 0) return;
      startMarket();
    }
    else if (act === 'Skip') { skipMarket(); }
    else if (act === 'Again') { newRound(); }
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
  });

  /* ============ 启动 ============ */
  function boot() {
    var s = readSave();
    G.coins = s.coins;
    G.best = s.best;
    G.round = s.round;
    renderHud();
    $('bestProfit').innerHTML = G.best;
    $('introArt').innerHTML = introArt();
    $('stallArt').innerHTML = stallArt();
    show('s-intro');
  }

  boot();
})();
