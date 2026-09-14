(function () {
  'use strict';
  window.YueYan = window.YueYan || {};
  var D = window.YueYan.Data;
  var E = window.YueYan.Engine;

  var OPEN = 'is-open';
  var COLLAPSED = 'is-collapsed';
  var built = false;

  function el(id) { return document.getElementById(id); }

  function show(viewId) {
    var views = document.querySelectorAll('.view'), i;
    for (i = 0; i < views.length; i++) { views[i].classList.remove('is-active'); }
    el(viewId).classList.add('is-active');
    var bar = el('day-bar');
    if (bar) {
      // §8.5：首屏一屏读完不滚动，故开场也不挂排程工具条。
      var noBar = viewId === 'view-intro' || viewId === 'view-craft'
        || viewId === 'view-kitchen' || viewId === 'view-prologue'
        || viewId === 'view-assign' || viewId === 'view-preview'
        || viewId === 'view-ending';
      if (noBar) { bar.classList.add('is-hidden'); }
      else { bar.classList.remove('is-hidden'); }
    }
  }

  function child(node, cls) {
    var span = node.querySelector(':scope > .' + cls);
    if (!span) {
      span = document.createElement('span');
      span.className = cls;
      node.appendChild(span);
    }
    return span;
  }

  function toggleDisabled(node, ok) {
    if (ok) { node.removeAttribute('disabled'); }
    else { node.setAttribute('disabled', 'disabled'); }
  }

  function setRow(id, ok, label, reason) {
    var row = el(id);
    if (!row) { return; }
    child(row, 'row-name').textContent = label;
    child(row, 'row-reason').textContent = ok ? '' : reason;
    if (row.tagName === 'BUTTON') { toggleDisabled(row, ok); }
  }

  function setRes(id, label, value) {
    var node = el(id);
    if (!node) { return; }
    child(node, 'res-k').textContent = label;
    child(node, 'res-v').textContent = value;
  }

  function reasonFor(state, act) {
    var day = state.day;
    if (act.type === 'buy') {
      if (D.gates[act.item] && (day < D.gates[act.item].from || day > D.gates[act.item].to)) {
        return D.copy.marketEmpty;
      }
      if (state.silver < D.items[act.item].silver) { return '银钱不足'; }
      if (E.stockSum(state) + D.items[act.item].gain > D.stockCap) { return '仓已满'; }
      return '';
    }
    if (act.type === 'shishi') {
      if (day < D.unlocks.shishi) { return '未到初九'; }
      if (state.patterns >= D.actions.shishi.cap) { return D.copy.patternFull; }
      if (state.silver < D.actions.shishi.silver) { return '银钱不足'; }
      if (state.stock.putong < D.actions.shishi.putong) { return '缺普通料'; }
      return '';
    }
    if (act.type === 'daizuo' || act.type === 'shouzuo') {
      if (day < D.unlocks[act.type]) { return '未到' + D.dates[D.unlocks[act.type] - 1]; }
      if (state.cakes.length >= D.board.cakeCap) { return D.copy.cakeFull; }
      if (!E.actionOk(state, act)) { return '缺料'; }
      return '';
    }
    if (act.type === 'xiexin') {
      if (day < D.unlocks.xiexin) { return '未到十一'; }
      if (state.flags.xieXin) { return D.copy.letterSent; }
      if (state.silver < D.actions.xiexin.silver) { return '银钱不足'; }
      return '';
    }
    if (act.type === 'beiyan') {
      if (day < D.unlocks.beiyan) { return '未到十二'; }
      if (state.silver < D.actions.beiyan.silver) { return '银钱不足'; }
      if (!E.actionOk(state, act)) {
        return state.stock.guihua < D.actions.beiyan.guihuaOnFifth
          ? D.copy.wineNeedsGuihua : '席已满';
      }
      return '';
    }
    if (act.type === 'buzhi') {
      if (day < D.unlocks.buzhi) { return '未到十三'; }
      if (state.ambience >= D.actions.buzhi.ambienceCap) { return D.copy.lanternFull; }
      if (state.silver < D.actions.buzhi.silver) { return '银钱不足'; }
      return '';
    }
    return '';
  }

  function slotLabel(act) {
    if (act.type === 'buy') { return '采买 ' + D.items[act.item].label; }
    if (act.type === 'daizuo' || act.type === 'shouzuo') {
      return '制饼·' + D.actions[act.type].label + ' ' + D.fillings[act.filling].label;
    }
    return D.actions[act.type].label;
  }

  var BATCH_LABEL = { normal: '普通批次', premium: '好料批次' };

  // §3.2 用途标注：标签一律取自 D.actions / D.fillings / 批次名，不得新写文案。
  function itemUses(item) {
    var uses = [], k, hit = 0, only = null;
    if (D.actions.shishi[item] > 0) { uses.push(D.actions.shishi.label); }
    for (k in D.fillings) {
      if (!D.fillings.hasOwnProperty(k) || !(D.fillings[k].cost[item] > 0)) { continue; }
      hit += 1;
      if (only === null) { only = k; }
    }
    if (hit === D.fillingOrder.length) { uses.push(D.actions.shouzuo.label + '·全部馅料'); }
    else if (hit === 1) { uses.push(D.actions.shouzuo.label + '·' + D.fillings[only].label); }
    if (D.premiumCost[item] > 0) { uses.push(BATCH_LABEL.premium); }
    if (D.actions.beiyan[item] > 0) { uses.push(D.actions.beiyan.label); }
    return uses.join(' · ');
  }

  // §5.2.1-d：价与到手数必须同时出现。只写「好料 3银」时玩家把 3 读成到手数，
  // 于是「写着 3，实际 2」。两个数都取自 D.items，不写死。
  function buyLabel(item) {
    var it = D.items[item];
    return it.label + ' ' + it.silver + '银 → 得' + it.gain;
  }

  // ============================ §8.5 首屏像素场景 ============================
  var INTRO_PROPS = [
    ['is-rack',   'px-rack',          2,   6,  48],
    ['is-board',  'px-board',         56,  6,  48],
    ['is-cake-a', 'px-cake-golden',   68,  18, 24],
    ['is-stove',  'px-stove',         110, 6,  48],
    ['is-cake-b', 'px-cake-baking',   122, 16, 24],
    ['is-bowl-a', 'px-bowl-lian',     164, 30, 24],
    ['is-bowl-b', 'px-bowl-dan',      194, 30, 24],
    ['is-bowl-c', 'px-bowl-gui',      224, 30, 24],
    ['is-wood',   'px-firewood',      252, 24, 32],
    ['is-plate',  'px-plate-station', 290, 6,  48]
  ];

  function introTileRow(name, count, size, cls, top) {
    var out = '', i;
    for (i = 0; i < count; i++) {
      out += '<img class="is-tile ' + cls + '" src="' + spr(name) + '" alt=""' +
        ' style="left:' + (i * size) + 'px;top:' + top + 'px">';
    }
    return out;
  }

  // 顶饰是一条挂灯笼的绳。悬挂长度是常量数组，零随机（V-3）。
  var INTRO_LANTERNS = [[20, 4], [108, 8], [196, 6]];   // [left, hang] CSS px

  function introGarland() {
    var out = '', i, l;
    for (i = 0; i < INTRO_LANTERNS.length; i++) {
      l = INTRO_LANTERNS[i];
      out += '<span class="lg" style="left:' + l[0] + 'px">' +
        '<span class="lg-hang" style="height:' + l[1] + 'px"></span>' +
        '<span class="lg-cap"></span>' +
        '<span class="lg-body"><span class="lg-glow"></span></span>' +
        '<span class="lg-tail"></span>' +
      '</span>';
    }
    return out;
  }

  function introProps() {
    var out = '', i, p;
    for (i = 0; i < INTRO_PROPS.length; i++) {
      p = INTRO_PROPS[i];
      out += '<img class="is-prop ' + p[0] + '" src="' + spr(p[1]) + '" alt=""' +
        ' style="left:' + p[2] + 'px;top:' + p[3] + 'px;width:' + p[4] +
        'px;height:' + p[4] + 'px">';
    }
    return out;
  }

  function buildIntroScene() {
    var host = el('intro-scene');
    if (!host || host.childNodes.length) { return; }
    host.innerHTML =
      '<div class="is-sky">' +
        '<div class="is-moon"></div><div class="is-moon-core"></div>' +
        '<div class="is-garland"><div class="gcord"></div>' + introGarland() + '</div>' +
      '</div>' +
      '<div class="is-band">' + introTileRow('px-counter', 6, 64, 'is-counter', 0) +
        introProps() + '</div>' +
      '<div class="is-ground">' + introTileRow('px-floor', 11, 32, 'is-floor', 0) +
        introTileRow('px-floor', 11, 32, 'is-floor', 32) + '</div>' +
      '<div class="is-chef-shd"></div>' +
      '<img class="is-spr is-chef" src="' + spr('px-chef') + '" alt="备宴的人">';
  }

  var PATH_ORDER = ['daizuo', 'shishi', 'shouzuo', 'xiexin', 'beiyan', 'buzhi'];

  function buildIntroPath() {
    var host = el('intro-path');
    if (!host || host.childNodes.length) { return; }

    var head = document.createElement('p');
    head.className = 'ip-head';
    head.textContent = '七日备宴 · 六样逐一开';
    host.appendChild(head);

    var grid = document.createElement('div');
    grid.className = 'ip-grid';
    var i;
    for (i = 0; i < PATH_ORDER.length; i++) {
      var key = PATH_ORDER[i];
      var day = D.unlocks[key];
      var cell = document.createElement('div');
      cell.className = 'ip-cell' + (key === 'shouzuo' ? ' is-key' : '');
      var dt = document.createElement('span');
      dt.className = 'ip-date';
      dt.textContent = D.dates[day - 1];
      cell.appendChild(dt);
      var nm = document.createElement('span');
      nm.className = 'ip-name';
      nm.textContent = D.actions[key].label;
      cell.appendChild(nm);
      if (key === 'shouzuo') {
        var mk = document.createElement('span');
        mk.className = 'ip-mark';
        mk.textContent = '进厨房';
        cell.appendChild(mk);
      }
      grid.appendChild(cell);
    }

    // §3.10：六个机制在初八至十三逐一开完，第七日无新样可开，故第七格只交代收工与开席。
    var last = document.createElement('div');
    last.className = 'ip-cell is-last';
    var ldt = document.createElement('span');
    ldt.className = 'ip-date';
    ldt.textContent = D.dates[D.dates.length - 1];
    last.appendChild(ldt);
    var lnm = document.createElement('span');
    lnm.className = 'ip-name';
    lnm.textContent = '不开新样，收工备宴';
    last.appendChild(lnm);
    var lmk = document.createElement('span');
    lmk.className = 'ip-mark';
    lmk.textContent = '十五开席';
    last.appendChild(lmk);
    grid.appendChild(last);

    host.appendChild(grid);

    var note = document.createElement('p');
    note.className = 'ip-note';
    note.textContent = '手作在' + D.dates[D.unlocks.shouzuo - 1] +
      '开灶，进像素厨房亲手制饼。先把' + D.dates[D.unlocks.daizuo - 1] + '、' +
      D.dates[D.unlocks.shishi - 1] + '两天过完，灶台就开了。';
    host.appendChild(note);
  }

  function renderIntro(state) {
    buildIntroScene();
    buildIntroPath();
    el('intro-title').textContent = D.intro.title;
    el('intro-sub').textContent = D.intro.sub;
    el('intro-howto').textContent = D.intro.howto;
    el('toggle-congrong-text').textContent = D.intro.congrong;
    el('intro-save-hint').textContent = D.intro.saveHint;
    el('btn-start').textContent = D.intro.start;
    el('toggle-congrong').checked = state.flags.congRong;
    show('view-intro');
  }

  function renderSlots(state, plan) {
    var grid = el('slot-grid'), i;
    var filled = plan.length || Math.min(state.slotsUsed, D.board.slotsPerDay);
    grid.innerHTML = '';
    for (i = 0; i < D.board.slotsPerDay; i++) {
      var slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'slot' + (i < filled ? ' is-filled' : '');
      var mark = document.createElement('span');
      mark.className = 'slot-mark';
      slot.appendChild(mark);
      var label = document.createElement('span');
      label.className = 'slot-text';
      label.textContent = (i < filled) ? slotLabel(plan[i]) : '空槽';
      slot.appendChild(label);
      grid.appendChild(slot);
    }
  }

  function renderFillings(state) {
    var box = el('drawer').querySelector('.craft-fillings');
    box.innerHTML = '';
    var i, key;
    for (i = 0; i < D.fillingOrder.length; i++) {
      key = D.fillingOrder[i];
      var act = { type: 'daizuo', filling: key };
      var ok = E.actionOk(state, act);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost filling';
      btn.setAttribute('data-filling', key);
      child(btn, 'filling-name').textContent = D.fillings[key].label;
      child(btn, 'filling-reason').textContent = ok ? '' : reasonFor(state, act);
      toggleDisabled(btn, ok);
      box.appendChild(btn);
    }
    box.classList.add(OPEN);
  }

  function renderSchedule(state, plan) {
    var actions = plan || [];
    var m = E.meters(state);
    el('day-label').textContent =
      '第' + D.dates[Math.min(state.day, D.board.days) - 1] + '日';
    el('meter-q').textContent = m.Q;
    el('meter-b').textContent = m.B;
    el('meter-h').textContent = m.H;
    setRes('silver-count', '银钱', state.silver);
    setRes('cake-count', '饼', state.cakes.length + '/' + D.board.cakeCap);
    setRes('stock-putong', D.items.putong.label, state.stock.putong);
    setRes('stock-haoliao', D.items.haoliao.label, state.stock.haoliao);
    setRes('stock-xiandanhuang', D.items.xiandanhuang.label, state.stock.xiandanhuang);
    setRes('stock-guihua', D.items.guihua.label, state.stock.guihua);
    el('btn-finish-day').textContent = D.copy.finishDay;

    renderSlots(state, actions);

    var craftOk = state.day >= D.unlocks.daizuo && state.cakes.length < D.board.cakeCap;
    setRow('row-buy', state.silver >= D.items.putong.silver, '采买', '');
    setRow('row-shishi', E.actionOk(state, { type: 'shishi' }),
           D.actions.shishi.label, reasonFor(state, { type: 'shishi' }));
    setRow('row-daizuo', E.actionOk(state, { type: 'daizuo', filling: 'dousha' }),
           D.actions.daizuo.label,
           reasonFor(state, { type: 'daizuo', filling: 'dousha' }));
    setRow('row-shouzuo', state.cakes.length < D.board.cakeCap
                          && state.day >= D.unlocks.shouzuo,
           D.actions.shouzuo.label,
           reasonFor(state, { type: 'shouzuo', filling: 'dousha', batch: 'normal' }));
    setRow('row-xiexin', E.actionOk(state, { type: 'xiexin' }),
           D.actions.xiexin.label, reasonFor(state, { type: 'xiexin' }));
    setRow('row-beiyan', E.actionOk(state, { type: 'beiyan' }),
           D.actions.beiyan.label, reasonFor(state, { type: 'beiyan' }));
    setRow('row-buzhi', E.actionOk(state, { type: 'buzhi' }),
           D.actions.buzhi.label, reasonFor(state, { type: 'buzhi' }));

    var craftRow = el('drawer').querySelector('[data-action="craft"]');
    if (craftRow) {
      child(craftRow, 'row-name').textContent = '制饼';
      child(craftRow, 'row-reason').textContent =
        craftOk ? '' : reasonFor(state, { type: 'daizuo', filling: 'dousha' });
    }

    var keys = ['putong', 'haoliao', 'xiandanhuang', 'guihua'], i, btn;
    for (i = 0; i < keys.length; i++) {
      btn = el('buy-' + keys[i]);
      var buyAct = { type: 'buy', item: keys[i] };
      var buyOk = E.actionOk(state, buyAct);
      child(btn, 'buy-name').textContent = buyLabel(keys[i]);
      child(btn, 'buy-use').textContent = itemUses(keys[i]);
      child(btn, 'branch-reason').textContent = buyOk ? '' : reasonFor(state, buyAct);
      toggleDisabled(btn, buyOk);
    }
  }

  var GRADE_LABEL = ['铜饼', '银饼', '金饼'];

  // ============================ §8.6 开场叙事面板 ============================
  var PROLOGUE_TITLE = '中秋之前';
  var PROLOGUE_CLOSE = '着手备宴';
  var PROLOGUE_CARDS = [
    '今年中秋的家宴由我来备。八月十五开席。',
    '祖母、父亲、母亲、幼弟，加上兄长，一共五人，一人一枚饼。',
    '兄长在外乡谋生，路远。今年能不能回来，要等信到。',
    '初八市集开市，十四收工，共七日。十一日起才捎得出信。'
  ];
  var PROLOGUE_DATES = ['十五', '初八', '十四', '十一日'];

  function buildPrologueCard(text) {
    var card = document.createElement('div');
    card.className = 'prologue-card';
    var rest = text, i, idx;
    for (i = 0; i < PROLOGUE_DATES.length; i++) {
      idx = rest.indexOf(PROLOGUE_DATES[i]);
      if (idx < 0) { continue; }
      if (idx > 0) { card.appendChild(document.createTextNode(rest.slice(0, idx))); }
      var span = document.createElement('span');
      span.className = 'pdate';
      span.textContent = PROLOGUE_DATES[i];
      card.appendChild(span);
      rest = rest.slice(idx + PROLOGUE_DATES[i].length);
    }
    if (rest.length) { card.appendChild(document.createTextNode(rest)); }
    return card;
  }

  function prologueSeat(key) {
    var fam = D.family[key];
    var seat = document.createElement('div');
    seat.className = 'pseat';
    seat.setAttribute('data-member', key);

    var bowl = document.createElement('img');
    bowl.className = 'pseat-bowl';
    bowl.src = FILL_BOWL[fam.pref];
    bowl.alt = '';
    seat.appendChild(bowl);

    var mark = document.createElementNS(SVG_NS, 'svg');
    mark.setAttribute('class', 'pseat-mark');
    mark.setAttribute('viewBox', '-20 -20 40 40');
    mark.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(SVG_NS, 'path');
    drawCakePattern(path, fam.pref);
    mark.appendChild(path);
    seat.appendChild(mark);

    var nm = document.createElement('span');
    nm.className = 'pseat-name';
    nm.textContent = fam.label;
    seat.appendChild(nm);

    var chip = document.createElement('span');
    chip.className = 'pseat-chip';
    chip.style.background = FILL_CHIP[fam.pref];
    seat.appendChild(chip);

    return seat;
  }

  function buildPrologue() {
    if (el('view-prologue')) { return; }
    var view = document.createElement('section');
    view.id = 'view-prologue';
    view.className = 'view';
    var h = document.createElement('h2');
    h.className = 'prologue-title';
    h.textContent = PROLOGUE_TITLE;
    view.appendChild(h);

    var strip = document.createElement('div');
    strip.className = 'prologue-strip';
    var i;
    for (i = 0; i < D.familyOrder.length; i++) {
      strip.appendChild(prologueSeat(D.familyOrder[i]));
    }
    view.appendChild(strip);

    var box = document.createElement('div');
    box.className = 'prologue-cards';
    for (i = 0; i < PROLOGUE_CARDS.length; i++) { box.appendChild(buildPrologueCard(PROLOGUE_CARDS[i])); }
    view.appendChild(box);
    var acts = document.createElement('div');
    acts.className = 'actions';
    var btn = document.createElement('button');
    btn.id = 'btn-prologue-close';
    btn.type = 'button';
    btn.className = 'btn btn-primary';
    btn.textContent = PROLOGUE_CLOSE;
    acts.appendChild(btn);
    view.appendChild(acts);
    el('ui').appendChild(view);
    btn.addEventListener('click', function () { closePrologue(); });
  }

  function showPrologue(state) {
    if (state.day !== 1 || state.slotsUsed !== 0 || state.flags.prologueSeen === true) {
      return false;
    }
    buildPrologue();
    show('view-prologue');
    return true;
  }

  function closePrologue() {
    var Main = window.YueYan.Main;
    var state = Main.state();
    state.flags.prologueSeen = true;
    var Save = window.YueYan.Save;
    if (Save) { Save.writeProgress(state); }
    Main.resumeSchedule();
  }

  // ============================ 像素厨房（Micro 层） ============================
  var SIMG = 'assets/img/';
  function spr(name) { return SIMG + name + '.webp'; }

  var S = 2;
  var TILE = 32 * S;
  var STPX = 48 * S;
  var PROP = 2;
  var PROPPX = 24 * PROP;
  var COLS = 6, ROWS = 9;
  var WORLD_W = COLS * TILE;
  var WORLD_H = ROWS * TILE;
  var AISLE_TOP = 116, AISLE_BOT = 460, AISLE_RIGHT = 272;
  var CHEF_HALF = 22;
  var AUTO_STOP = 8;
  // §8.4.5 摇杆三个几何常量：DEAD 内的位移读作「没有方向」，FULL 处达到满速，
  // VIS 是旋钮可离开圆心的最大像素——72px 底座减去 46px 旋钮后正好 13px，
  // 于是旋钮无论怎么拖都留在底座里，不会被读成「偏右 / 偏左」。
  var JOY_DEAD = 9, JOY_FULL = 30, JOY_VIS = 13;
  var TAPS = D.micro.tapsPerStep;
  var STEP_IDS = ['S1', 'S2', 'S3'];
  var STEP_NAME = ['揉皮', '包馅', '落模'];

  var SPRITES = ['px-floor', 'px-counter', 'px-chef', 'px-stove', 'px-board',
    'px-plate-station', 'px-rack', 'px-firewood', 'px-cake-raw', 'px-cake-baking',
    'px-cake-golden', 'px-cake-burnt', 'px-bowl-gui', 'px-bowl-lian', 'px-bowl-dan'];

  var CAKE_SPR = { raw: spr('px-cake-raw'), baking: spr('px-cake-baking'),
    golden: spr('px-cake-golden'), burnt: spr('px-cake-burnt') };
  var LABEL_SPR = { '生': 'raw', '在烘': 'baking', '佳': 'golden', '焦': 'burnt' };

  var FILL_CHIP = { dousha: 'var(--red-dk)', wuren: 'var(--wood-dk)',
    lianrong: 'var(--lotus)', xiandanhuang: 'var(--yolk)',
    guihua: 'var(--osmanthus)' };
  var FILL_BOWL = { dousha: spr('px-bowl-lian'), wuren: spr('px-bowl-lian'),
    lianrong: spr('px-bowl-lian'), xiandanhuang: spr('px-bowl-dan'),
    guihua: spr('px-bowl-gui') };

  function mkStation(id, kind, img, x, y, size, hitW, hitH, ipx, ipy, range, sx, sy) {
    return { id: id, kind: kind, img: img, x: x, y: y, size: size,
      hit: { x: x + (size - hitW) / 2, y: y + (size - hitH) / 2, w: hitW, h: hitH },
      ip: { x: ipx, y: ipy }, range: range, stand: { x: sx, y: sy } };
  }
  var RANGE_WIDE = 76, RANGE_NARROW = 61;
  var STATIONS = [
    mkStation('rack', 'rack', spr('px-rack'), 0, 0, STPX, 84, 84, 48, AISLE_TOP, RANGE_WIDE, 48, AISLE_TOP),
    mkStation('firewood', 'wood', spr('px-firewood'), 128, 0, TILE, 54, 54, 160, AISLE_TOP, RANGE_NARROW, 160, AISLE_TOP),
    mkStation('board', 'board', spr('px-board'), 192, 0, STPX, 84, 84, 240, AISLE_TOP, RANGE_WIDE, 240, AISLE_TOP),
    mkStation('stove0', 'stove', spr('px-stove'), 288, 192, STPX, 84, 84, 288, 240, RANGE_WIDE, 272, 240),
    mkStation('stove1', 'stove', spr('px-stove'), 288, 288, STPX, 84, 84, 288, 336, RANGE_WIDE, 272, 336),
    mkStation('plate', 'plate', spr('px-plate-station'), 0, 480, STPX, 84, 84, 48, AISLE_BOT, RANGE_WIDE, 48, AISLE_BOT)
  ];
  var ST_BY_ID = {};
  STATIONS.forEach(function (s) { ST_BY_ID[s.id] = s; });
  var STOVE_KEY = { stove0: 'A', stove1: 'B' };
  var PROMPT_BELOW = { rack: true, firewood: true, board: true, stove1: true,
    stove0: false, plate: false };
  var COUNTER_TILES = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
    { x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 },
    { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }
  ];
  var GUIDE_TO_STATION = { stoveA: 'stove0', stoveB: 'stove1', plate: 'plate',
    wood: 'firewood', board: 'board', rack: 'rack' };
  var ST_NAME = { rack: '食材架', firewood: '柴堆', board: '案板',
    stove0: '灶甲', stove1: '灶乙', plate: '出餐台' };
  var CARRY_NAME = { bowl: '馅料碗', wood: '柴火', raw: '生饼',
    golden: '金黄饼', burnt: '焦饼' };

  var K = null;
  var kitchenBuilt = false;
  var ST_DOM = {};
  var ORDER_DOM = [];
  var CUST_DOM = [];
  var prevRender = {};

  function distTo(st) {
    var dx = K.chef.x - st.ip.x, dy = K.chef.y - st.ip.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function inRange(st) { return distTo(st) <= st.range; }
  // §4.3.6 / §4.3.10：从容模式下灶恒为有点火状态、燃料不倒数，故「火在不在烧」必须
  // 同时看 lit 与从容开关——只看 lit 会在从容模式下把续火键推给一个永不需要柴的灶。
  function firing(st) { return st.lit || K.spec.congRong === true; }

  function buildKitchen() {
    if (kitchenBuilt) { return; }
    kitchenBuilt = true;

    var view = document.createElement('section');
    view.id = 'view-kitchen';
    view.className = 'view';
    view.innerHTML =
      '<div id="k-status">' +
        '<div class="scell"><span class="k">柴</span><span class="v" id="k-wood">8</span></div>' +
        '<div class="scell"><span class="k">已用时</span><span class="vrow"><span class="v" id="k-clock">0.0</span><span class="cu">秒</span></span></div>' +
      '</div>' +
      '<div id="k-orders"></div>' +
      '<div id="k-world">' +
        '<div id="k-counter"></div><div id="k-floor"></div>' +
        '<div id="k-walls"><div class="wall wtop"></div><div class="wall wleft"></div>' +
          '<div class="wall wright"></div><div class="wall wbot"></div></div>' +
        '<div id="k-decor">' +
          '<div class="dshadow" style="left:300px;top:466px;width:84px;height:8px"></div>' +
          '<div class="dshadow" style="left:300px;top:570px;width:62px;height:6px"></div>' +
          '<div class="lane"><i style="left:14px"></i><i style="left:54px"></i><i style="left:94px"></i><i style="left:134px"></i><i style="left:174px"></i></div>' +
          '<div class="qmat"><u style="left:18px"></u><u style="left:66px"></u><u style="left:114px"></u></div>' +
          '<div class="door"><div class="leaf a"></div><div class="leaf b"></div><div class="sill"></div></div>' +
          '<div class="window"><div class="moon"></div><div class="muntin"></div></div>' +
          '<div class="klantern l1"><div class="cord"></div><div class="cap"></div><div class="body"></div><div class="tail"></div></div>' +
          '<div class="klantern l2"><div class="cord"></div><div class="cap"></div><div class="body"></div><div class="tail"></div></div>' +
          '<div class="garland"><div class="gcord"></div>' +
            '<i style="left:2px"></i><u style="left:11px"></u><i style="left:16px"></i><u style="left:25px"></u>' +
            '<i style="left:30px"></i><u style="left:39px"></i><i style="left:44px"></i><u style="left:53px"></u>' +
            '<i style="left:58px"></i><u style="left:67px"></i><i style="left:72px"></i></div>' +
          '<div class="shelf">' +
            '<div class="jar j1"><div class="silh"></div><div class="body"></div><div class="ear l"></div><div class="ear r"></div><div class="band"></div><div class="lid"></div><div class="rim"></div><div class="knob"></div></div>' +
            '<div class="jar j2"><div class="silh"></div><div class="body"></div><div class="ear l"></div><div class="ear r"></div><div class="band"></div><div class="lid"></div><div class="rim"></div><div class="knob"></div></div>' +
            '<div class="jar j3"><div class="silh"></div><div class="body"></div><div class="ear l"></div><div class="ear r"></div><div class="band"></div><div class="lid"></div><div class="rim"></div><div class="knob"></div></div>' +
            '<div class="board"></div><div class="brk a"></div><div class="brk b"></div></div>' +
          '<div class="cust c0"><div class="shd"></div><div class="bubble"><b></b></div><div class="head"><div class="hair"></div></div><div class="body"><div class="arm l"></div><div class="arm r"></div></div></div>' +
          '<div class="cust c1"><div class="shd"></div><div class="bubble"><b></b></div><div class="head"><div class="hair"></div></div><div class="body"><div class="arm l"></div><div class="arm r"></div></div></div>' +
          '<div class="cust c2"><div class="shd"></div><div class="bubble"><b></b></div><div class="head"><div class="hair"></div></div><div class="body"><div class="arm l"></div><div class="arm r"></div></div></div>' +
        '</div>' +
        '<div id="k-stations"></div>' +
        '<div id="k-guide-arrow"></div>' +
        '<div id="k-stand"></div>' +
        '<div id="k-chef"><img id="k-chef-img" src="' + spr('px-chef') + '" alt="厨师"><img id="k-carry" src="' + spr('px-cake-raw') + '" alt="手上"></div>' +
        '<div id="k-toast"></div>' +
        // 摇杆浮在厨房世界的中下偏右（§4.9.3，坐标推导见 style.css 的 #k-joy-base）：
        // 它离开底栏，落进世界内部，于是拇指够得到——真机底部的系统手势条 / 浏览器
        // 工具条会盖住贴底的那一条。
        '<div id="k-joy-base" data-tap="1"><div class="well"></div>' +
          '<div class="notch n-n"></div><div class="notch n-s"></div><div class="notch n-w"></div><div class="notch n-e"></div>' +
          '<div id="k-joy-knob"><div class="face"></div></div></div>' +
        '<div id="k-joy-label"><b>摇杆走位</b></div>' +
      '</div>' +
      '<div id="k-actions"></div>' +
      '<div id="k-controls">' +
        '<button id="k-abort" class="btn btn-ghost" type="button">放弃</button>' +
      '</div>' +
      '<div id="k-sprlib"></div>';
    el('ui').appendChild(view);

    var lib = el('k-sprlib');
    lib.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    var i;
    for (i = 0; i < SPRITES.length; i++) {
      var im = document.createElement('img');
      im.id = 'kspr-' + SPRITES[i];
      im.src = spr(SPRITES[i]);
      im.alt = '';
      lib.appendChild(im);
    }

    buildFloorCounter();
    buildStations();
    buildOrders();
    CUST_DOM = [];
    for (i = 0; i < 3; i++) { CUST_DOM.push(el('k-decor').querySelector('.cust.c' + i)); }
    bindJoystick();
    bindActions();
    el('k-abort').addEventListener('click', function () { abortKitchen(); });
    document.addEventListener('visibilitychange', onVisibility);
  }

  function buildFloorCounter() {
    var floor = el('k-floor'), counter = el('k-counter');
    floor.innerHTML = ''; counter.innerHTML = '';
    var ff = spr('px-floor'), cf = spr('px-counter');
    var r, c;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        var im = document.createElement('img');
        im.className = 'ftile';
        im.src = ff;
        im.alt = '';
        im.style.left = (c * TILE) + 'px';
        im.style.top = (r * TILE) + 'px';
        floor.appendChild(im);
      }
    }
    COUNTER_TILES.forEach(function (t) {
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;left:' + (t.x * TILE) + 'px;top:' + (t.y * TILE) +
        'px;width:' + TILE + 'px;height:' + TILE + 'px;background-image:url(' + cf +
        ');background-size:' + TILE + 'px ' + TILE + 'px;background-repeat:no-repeat';
      counter.appendChild(d);
    });
  }

  function buildStations() {
    var host = el('k-stations');
    host.innerHTML = '';
    ST_DOM = {};
    STATIONS.forEach(function (s) {
      var box = document.createElement('div');
      box.className = 'st';
      box.id = 'kst-' + s.id;
      box.dataset.tap = '1';
      box.dataset.station = s.id;
      box.style.left = s.x + 'px';
      box.style.top = s.y + 'px';
      box.style.width = s.size + 'px';
      box.style.height = s.size + 'px';

      var gnd = document.createElement('div');
      gnd.className = 'ground';
      gnd.style.width = (s.size - 20) + 'px';
      box.appendChild(gnd);

      var img = document.createElement('img');
      img.className = 'st-img';
      img.src = s.img;
      img.alt = s.id;
      box.appendChild(img);

      var glow = document.createElement('div');
      glow.className = 'glow';
      box.appendChild(glow);

      var ring = document.createElement('div');
      ring.className = 'ring';
      box.appendChild(ring);

      var ck = null, ht = null, hi = null;
      if (s.kind === 'stove') {
        ck = document.createElement('img');
        ck.className = 'scake';
        ck.src = CAKE_SPR.raw;
        ck.alt = '';
        ck.style.left = ((s.size - PROPPX) / 2) + 'px';
        ck.style.top = ((s.size - PROPPX) / 2) + 'px';
        box.appendChild(ck);
        ht = document.createElement('div');
        ht.className = 'heat';
        ht.style.left = ((s.size - 76) / 2) + 'px';
        ht.style.top = (s.size - 20) + 'px';
        hi = document.createElement('i');
        ht.appendChild(hi);
        box.appendChild(ht);
      }

      var below = PROMPT_BELOW[s.id];
      var pm = document.createElement('div');
      pm.className = 'prompt';
      pm.style[below ? 'bottom' : 'top'] = '-22px';
      box.appendChild(pm);

      var pp = null;
      if (s.kind === 'board') {
        pp = document.createElement('div');
        pp.className = 'pips';
        pp.style[below ? 'bottom' : 'top'] = '-40px';
        for (var q = 0; q < TAPS; q++) { pp.appendChild(document.createElement('i')); }
        box.appendChild(pp);
      }

      var gm = document.createElement('div');
      gm.className = 'gmark';
      gm.style[below ? 'bottom' : 'top'] = '-44px';
      box.appendChild(gm);

      // 工位名牌：常驻的识别读数，六座工位同构。它钉在工位盒内上沿——顶排三座之上
      // 是墙带（y 0 起）没有余地，而盒内下沿会撞上灶的火候条（盒内 y 76 至 85），
      // 提示点 / 三步格 / 引导标记又都在盒外，故盒内上沿是唯一不与任何读数相撞的位置。
      // 素材四周留了 ≥ 1/8 余量（§5.4.3-g），名牌正好落在这条余量里，不盖住道具本体。
      var nm = document.createElement('div');
      nm.className = 'st-name';
      nm.textContent = ST_NAME[s.id];
      box.appendChild(nm);

      box.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        tapStation(s.id);
      });

      host.appendChild(box);
      ST_DOM[s.id] = { box: box, img: img, ring: ring, glow: glow, prompt: pm, pips: pp,
        cake: ck, heat: ht, hfill: hi };
    });
  }

  function buildOrders() {
    var ord = el('k-orders');
    ord.innerHTML = '';
    ORDER_DOM = [];
    for (var i = 0; i < 3; i++) {
      var card = document.createElement('div');
      card.className = 'ocard ghost';
      card.textContent = '空位';
      ord.appendChild(card);
      ORDER_DOM.push(card);
    }
  }

  function setText(node, text) { if (node && node.textContent !== text) { node.textContent = text; } }
  function setCls(node, cls) { if (node && node.className !== cls) { node.className = cls; } }

  // ------------------------------ 反馈 ------------------------------
  var toastTimer = 0;
  function toast(text, bad) {
    var node = el('k-toast');
    node.textContent = text;
    node.className = bad ? 'show bad' : 'show';
    toastTimer = K.elapsed + 1.5;
  }
  function pop(x, y, text, bad) {
    var node = document.createElement('div');
    node.className = bad ? 'pop bad' : 'pop';
    node.textContent = text;
    node.style.left = Math.max(4, Math.min(WORLD_W - 84, x - 24)) + 'px';
    node.style.top = Math.max(4, Math.min(WORLD_H - 40, y - 20)) + 'px';
    el('k-world').appendChild(node);
    window.setTimeout(function () { if (node.parentNode) { node.parentNode.removeChild(node); } }, 720);
  }

  // ------------------------------ 工位动作 ------------------------------
  function logEvent(op, cake, step, d) {
    K.timeline.push({ t: K.elapsed, op: op, cake: cake === undefined ? null : cake,
      step: step === undefined ? null : step, d: d === undefined ? null : d });
  }

  function freeCakeFor(filling) {
    for (var i = 0; i < K.cakes.length; i++) {
      if (K.cakes[i].filling === filling && !K.cakes[i].made &&
          K.cakes[i].stove === null && !K.cakes[i].taken) { return i; }
    }
    return -1;
  }

  function rackTap(filling) {
    if (K.carry !== null) { toast('手里已经拿着东西了', true); return; }
    if (filling === undefined) { filling = urgentFilling(); }
    if (freeCakeFor(filling) < 0) { toast('这味馅料已经备好了', true); return; }
    K.carry = { kind: 'bowl', filling: filling };
    toast('取了' + D.fillings[filling].label + '馅料');
    window.YueYan.Audio.play('craft');
  }

  function urgentFilling() {
    var best = null, i;
    for (i = 0; i < K.orders.length; i++) {
      if (K.orders[i].state !== 'open') { continue; }
      if (freeCakeFor(K.orders[i].filling) < 0) { continue; }
      if (best === null || K.orders[i].deadline < best.deadline) { best = K.orders[i]; }
    }
    if (best !== null) { return best.filling; }
    for (i = 0; i < K.cakes.length; i++) {
      if (!K.cakes[i].made && K.cakes[i].stove === null && !K.cakes[i].taken) {
        return K.cakes[i].filling;
      }
    }
    return K.spec.fillings[0];
  }

  function boardTap() {
    var b = K.board;
    if (!b.busy) {
      if (K.carry === null || K.carry.kind !== 'bowl') { toast('先去食材架取馅料碗', true); return; }
      var idx = freeCakeFor(K.carry.filling);
      if (idx < 0) { toast('这味馅料已经备好了', true); return; }
      b.busy = true;
      b.cakeIdx = idx;
      b.filling = K.carry.filling;
      b.step = 0;
      b.taps = 0;
      K.carry = null;
    }
    b.taps += 1;
    logEvent('tap', b.cakeIdx + 1, STEP_IDS[b.step], b.taps);
    window.YueYan.Audio.play('step', b.step);
    pop(ST_BY_ID.board.ip.x, ST_BY_ID.board.ip.y - 10, STEP_NAME[b.step] + ' ' + b.taps + '/' + TAPS);
    if (b.taps >= TAPS) {
      if (b.step < 2) { b.step += 1; b.taps = 0; return; }
      var cake = K.cakes[b.cakeIdx];
      cake.made = true;
      cake.state = 'raw';
      K.carry = { kind: 'raw', cakeIdx: b.cakeIdx, filling: cake.filling };
      b.busy = false;
      b.cakeIdx = -1;
      b.step = 0;
      b.taps = 0;
      pop(ST_BY_ID.board.ip.x, ST_BY_ID.board.ip.y - 34, '成型!');
      toast('饼成型了 · 送去灶上');
    }
  }

  function grabWood() {
    if (K.carry !== null) { toast('手里已经拿着东西了', true); return; }
    if (K.wood <= 0) { toast('柴堆空了', true); return; }
    K.wood -= 1;
    K.carry = { kind: 'wood' };
    logEvent('wood');
    toast('拿了柴火 · 剩 ' + K.wood + ' 把');
  }

  function stoveTap(id) {
    var key = STOVE_KEY[id];
    var st = K.stoves[key];
    var at = ST_BY_ID[id].ip;

    if (st.cake !== null) {
      var cake = K.cakes[st.cake];
      if (cake.state === 'golden' || cake.state === 'burnt') {
        K.carry = { kind: cake.state, cakeIdx: st.cake, filling: cake.filling };
        cake.taken = true;
        st.cake = null;
        logEvent('take', cake.index + 1);
        toast(cake.state === 'golden' ? '出炉! 金黄 · 快去出餐台' : '火大了些 · 这枚仍可上菜',
              cake.state === 'burnt');
        return;
      }
      // §4.3.6 锁定「重新点火：fuel 重置为 15.0，litElapsed 从冻结处继续推进」，并明写
      // 「玩家补一把柴就能继续烘」。旧版在炉上有饼时一律回「还在烘」，于是火灭之后 h
      // 永远冻在佳窗口之下、饼永远取不出来，玩家只能干等到会话上限——这正是「一直卡着」。
      if (K.carry !== null && K.carry.kind === 'wood' && !firing(st)) {
        K.carry = null;
        st.lit = true;
        st.litAt = K.elapsed;
        logEvent('light', null, key);
        toast('续火 · 从刚才的火候接着烘');
        return;
      }
      toast('还在烘 · 等它变金黄', true);
      return;
    }

    if (K.carry !== null && K.carry.kind === 'wood') {
      K.carry = null;
      st.lit = true;
      st.litAt = K.elapsed;
      logEvent('light', null, key);
      toast('点火 · 火还有 ' + D.micro.fuelSeconds.toFixed(0) + '秒');
      return;
    }

    if (K.carry !== null && K.carry.kind === 'raw') {
      // §4.3.6「冷灶放饼：饼放上去但不烘」。放饼恒成立，于是拎着生饼的玩家永远有一条
      // 腾出手的路；冷灶时 state 停在 P-09 `px-cake-raw`，h 冻在 0，等点火后才推进。
      var rc = K.cakes[K.carry.cakeIdx];
      var hot = firing(st);
      rc.stove = key;
      rc.tOn = K.elapsed;
      rc.litElapsed = 0;
      rc.state = hot ? 'baking' : 'raw';
      st.cake = K.carry.cakeIdx;
      K.carry = null;
      logEvent('place', rc.index + 1, key);
      toast(hot ? '进灶 · 等它烘到金黄'
                : '放上' + ST_NAME[id] + ' · 这台灶没火，拿柴火来点', !hot);
      return;
    }

    if (!st.lit) { toast('灶是冷的 · 去柴堆拿柴火', true); return; }
    toast('灶空着 · 拿生饼来烘');
  }

  function plateTap() {
    if (K.carry === null || (K.carry.kind !== 'golden' && K.carry.kind !== 'burnt')) {
      toast('手上没有出炉的饼', true); return;
    }
    var cake = K.cakes[K.carry.cakeIdx];
    cake.served = true;
    logEvent('serve', cake.index + 1);
    var matched = null, i;
    for (i = 0; i < K.orders.length; i++) {
      if (K.orders[i].state === 'open' && K.orders[i].filling === cake.filling) {
        K.orders[i].state = 'served';
        K.orders[i].flash = K.elapsed + 0.4;
        matched = K.orders[i];
        break;
      }
    }
    K.carry = null;
    if (matched !== null) {
      toast(D.family[matched.family].label + '收下了' + D.fillings[cake.filling].label + '饼');
    } else {
      toast('没人在等这味 · 饼照样留给你', true);
    }
    pop(ST_BY_ID.plate.ip.x, ST_BY_ID.plate.ip.y, '上菜');
    checkSessionEnd();
  }

  function tapStation(id) {
    var st = ST_BY_ID[id];
    if (!inRange(st)) { walkTo(id); toast('走过去…'); return; }
    if (st.kind === 'rack') { rackTap(); }
    else if (st.kind === 'board') { boardTap(); }
    else if (st.kind === 'wood') { grabWood(); }
    else if (st.kind === 'plate') { plateTap(); }
    else { stoveTap(id); }
  }

  // ------------------------------ 走位 ------------------------------
  var joy = { active: false, dx: 0, dy: 0, id: -1 };
  var auto = null;

  // §4.9.1 走位区：一条没有障碍的凸矩形走廊。四个边正好把六个工位挡在外面——
  // 顶排工位的命中盒止于 y 90，出餐台起于 y 486，两台灶起于 x 294，厨师半边 22，
  // 于是 [22, 272] × [116, 460] 内没有任何碰撞体。凸区域里任意 L 形路径都不会撞墙，
  // 厨师也就不可能被夹在两台灶之间再也动不了（旧版把灶间 12px 缝当成可走区）。
  function collide(nx, ny) {
    return nx < CHEF_HALF || nx > AISLE_RIGHT || ny < AISLE_TOP || ny > AISLE_BOT;
  }

  function moveChef(dx, dy, dt) {
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) { return false; }
    var step = D.micro.chefSpeed * dt * Math.min(1, len);
    var ux = dx / len * step, uy = dy / len * step;
    var moved = false;
    if (!collide(K.chef.x + ux, K.chef.y)) { K.chef.x += ux; moved = true; }
    if (!collide(K.chef.x, K.chef.y + uy)) { K.chef.y += uy; moved = true; }
    return moved;
  }

  function pathLen(path) {
    var total = 0, i;
    for (i = 1; i < path.length; i++) {
      var dx = path[i].x - path[i - 1].x, dy = path[i].y - path[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
  }

  function stepChef(dt) {
    if (joy.active) { moveChef(joy.dx, joy.dy, dt); return; }
    if (auto === null) { return; }
    var walked = (K.elapsed - auto.t0) * D.micro.chefSpeed;
    if (walked >= auto.len) { K.chef.x = auto.path[auto.path.length - 1].x;
      K.chef.y = auto.path[auto.path.length - 1].y; auto = null; return; }
    var p = E.chefAt(K.elapsed - auto.t0, auto.path);
    K.chef.x = p.x; K.chef.y = p.y;
  }

  // §4.10.1 点工位即走过去：走位区是凸矩形，故 L 形路径整段都在区内，
  // 逐帧直接落点也安全（§4.9.2 chefAt 的求值路径保留）。
  function walkTo(id) {
    var stand = ST_BY_ID[id].stand;
    var start = { x: Math.round(K.chef.x), y: Math.round(K.chef.y) };
    var path = [start, { x: start.x, y: stand.y }, { x: stand.x, y: stand.y }];
    auto = { target: id, path: path, len: pathLen(path), t0: K.elapsed };
  }

  function bindJoystick() {
    var base = el('k-joy-base'), knob = el('k-joy-knob');
    function setVec(cx, cy) {
      var r = base.getBoundingClientRect();
      var ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2);
      var len = Math.sqrt(ox * ox + oy * oy);
      var ux = len > 0 ? ox / len : 0, uy = len > 0 ? oy / len : 0;
      var mag = len <= JOY_DEAD ? 0
              : Math.min(1, (len - JOY_DEAD) / (JOY_FULL - JOY_DEAD));
      knob.style.transform = 'translate(' + (ux * mag * JOY_VIS) + 'px,' +
                                            (uy * mag * JOY_VIS) + 'px)';
      joy.dx = ux * mag;
      joy.dy = uy * mag;
    }
    function release() {
      joy.active = false; joy.dx = 0; joy.dy = 0; joy.id = -1;
      knob.style.transform = 'translate(0px,0px)';
    }
    base.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      auto = null;
      joy.active = true; joy.id = ev.pointerId;
      // Capture is best-effort: setPointerCapture throws NotFoundError for an inactive
      // pointer and some phones never honour it. Tracking lives on window below, so a
      // failed capture must not abort the drag.
      if (base.setPointerCapture) { try { base.setPointerCapture(ev.pointerId); } catch (err) { /* window listeners still track */ } }
      setVec(ev.clientX, ev.clientY);
    });
    // Track on window, not on base: once the finger leaves the 72×72 base — or capture
    // fails — a base-bound pointermove stops firing and the joystick silently dies.
    // Gating on the live pointer id keeps the drag alive anywhere on screen and always
    // releases, so tracking no longer depends on setPointerCapture succeeding.
    window.addEventListener('pointermove', function (ev) {
      if (!joy.active || ev.pointerId !== joy.id) { return; }
      ev.preventDefault();
      setVec(ev.clientX, ev.clientY);
    });
    window.addEventListener('pointerup', function (ev) {
      if (!joy.active || ev.pointerId !== joy.id) { return; }
      release();
    });
    window.addEventListener('pointercancel', function (ev) {
      if (!joy.active || ev.pointerId !== joy.id) { return; }
      release();
    });
  }

  function bindActions() {
    el('k-actions').addEventListener('pointerdown', function (ev) {
      var b = ev.target.closest ? ev.target.closest('.abtn') : null;
      if (!b || b.disabled) { return; }
      ev.preventDefault();
      if (b.dataset.fill !== undefined) {
        if (!inRange(ST_BY_ID.rack)) { toast('太远了 · 走过去再动手', true); return; }
        rackTap(b.dataset.fill);
        return;
      }
      tapStation(b.dataset.station);
    });
  }

  // ------------------------------ 仿真推进 ------------------------------
  function stepStoves(dt) {
    var keys = ['A', 'B'], i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var st = K.stoves[key];
      var congRong = K.spec.congRong === true;
      if (st.lit && !congRong) {
        var fuel = E.fuelAt(K.elapsed - st.litAt);
        if (fuel <= 0) { st.lit = false; }
      }
      if (st.cake === null) { continue; }
      var cake = K.cakes[st.cake];
      if (st.lit && !congRong) { cake.litElapsed += dt; }
      var h = E.heatAt(cake.litElapsed, key, congRong);
      var label = E.heatLabelOf(h, st.lit || congRong);
      cake.state = LABEL_SPR[label];
      cake.h = h;
      if (label === '焦' && cake.prevLabel !== '焦') {
        pop(ST_BY_ID[key === 'A' ? 'stove0' : 'stove1'].ip.x,
            ST_BY_ID[key === 'A' ? 'stove0' : 'stove1'].ip.y - 30, '火大了些', true);
      }
      cake.prevLabel = label;
    }
  }

  function stepOrders() {
    if (K.spec.congRong === true) { return; }
    for (var i = 0; i < K.orders.length; i++) {
      if (K.orders[i].state === 'open' && K.elapsed >= K.orders[i].deadline) {
        K.orders[i].state = 'expired';
      }
    }
  }

  function checkSessionEnd() {
    var i;
    for (i = 0; i < K.cakes.length; i++) { if (!K.cakes[i].served) { return; } }
    endSession();
  }

  // ------------------------------ 渲染 ------------------------------
  function renderStatus() {
    setText(el('k-wood'), String(K.wood));
    setText(el('k-clock'), K.elapsed.toFixed(1));
  }

  function renderOrders() {
    for (var i = 0; i < ORDER_DOM.length; i++) {
      var card = ORDER_DOM[i], o = K.orders[i];
      var open = o && o.state === 'open';
      if (!open) {
        if (!card.classList.contains('ghost')) {
          setCls(card, 'ocard ghost');
          card.innerHTML = '';
          card.textContent = '空位';
        }
        continue;
      }
      if (card.classList.contains('ghost')) {
        setCls(card, 'ocard');
        card.innerHTML =
          '<div class="ohead"><span class="chip"></span><span class="oname"></span>' +
          '<span class="owho"></span></div>' +
          '<div class="oline"></div>' +
          '<div class="otime"><span class="tag">剩余</span><span class="num"></span>' +
          '<span class="u">秒</span></div>' +
          '<div class="obar"><i></i></div>';
      }
      var head = card.firstChild;
      var chip = head.firstChild;
      var bg = FILL_CHIP[o.filling];
      if (chip.style.background !== bg) { chip.style.background = bg; }
      setText(head.childNodes[1], D.fillings[o.filling].label + '饼');
      setText(head.childNodes[2], D.family[o.family].label);
      setText(card.childNodes[1], D.family[o.family].label + '想要一枚' +
        D.fillings[o.filling].label + '饼');

      var num = card.childNodes[2].childNodes[1];
      var secs = Math.max(0, o.deadline - K.elapsed);
      setText(num, secs.toFixed(1));
      setCls(num, secs < 8 ? 'num crit' : (secs < 16 ? 'num warn' : 'num'));

      var bar = card.childNodes[3].firstChild;
      var ratio = Math.max(0, Math.min(1, secs / o.deadline));
      var w = Math.round(ratio * 100) + '%';
      if (bar.style.width !== w) { bar.style.width = w; }
      setCls(bar, ratio < 0.25 ? 'crit' : (ratio < 0.45 ? 'warn' : ''));

      var urgent = secs < 8;
      var done = o.flash > K.elapsed;
      setCls(card, 'ocard' + (urgent ? ' urgent' : '') + (done ? ' done' : ''));
    }
  }

  function kitchenKey() {
    function stoveView(key) {
      var st = K.stoves[key];
      return { cake: st.cake === null ? null : { state: K.cakes[st.cake].state }, lit: st.lit };
    }
    var rackWork = false, i;
    for (i = 0; i < K.spec.fillings.length; i++) {
      if (freeCakeFor(K.spec.fillings[i]) >= 0) { rackWork = true; }
    }
    return {
      stoves: { A: stoveView('A'), B: stoveView('B') },
      carrying: K.carry === null ? null : { kind: K.carry.kind },
      board: { active: K.board.busy },
      wood: K.wood,
      rackWork: rackWork
    };
  }

  function renderWorld(guideId) {
    var ch = el('k-chef');
    var tx = 'translate(' + Math.round(K.chef.x - 32) + 'px,' + Math.round(K.chef.y - 32) + 'px)';
    if (prevRender.chefTx !== tx) { ch.style.transform = tx; prevRender.chefTx = tx; }
    setCls(ch, (joy.active || auto !== null) ? 'walk' : '');

    var cy = el('k-carry');
    if (K.carry === null) {
      if (prevRender.carry !== 'none') { setCls(cy, ''); prevRender.carry = 'none'; }
    } else {
      var src = K.carry.kind === 'bowl' ? FILL_BOWL[K.carry.filling]
              : (K.carry.kind === 'wood' ? spr('px-firewood') : CAKE_SPR[K.carry.kind]);
      if (prevRender.carry !== src) { cy.src = src; setCls(cy, 'show'); prevRender.carry = src; }
    }

    STATIONS.forEach(function (s) {
      var d = ST_DOM[s.id];
      var near = inRange(s);
      var live = false, extra = '';

      if (s.kind === 'rack') {
        live = near && K.carry === null;
      } else if (s.kind === 'board') {
        live = near && (K.board.busy || (K.carry !== null && K.carry.kind === 'bowl'));
      } else if (s.kind === 'wood') {
        live = near && K.carry === null && K.wood > 0;
      } else if (s.kind === 'plate') {
        live = near && K.carry !== null &&
               (K.carry.kind === 'golden' || K.carry.kind === 'burnt');
      } else {
        var key = STOVE_KEY[s.id];
        var st = K.stoves[key];
        var c = K.carry;
        var onStove = st.cake !== null ? K.cakes[st.cake].state : null;
        // §4.10.1 第 ③ 档的判据是「这一下点了真的会产生结果」。§4.3.6 的续火是这条判据
        // 的第四个实例（炉上有饼、火已灭、手里有柴），故与点火 / 放饼 / 取饼同列。放饼
        // 一项**不看 `st.lit`**：冷灶放饼照样成立（只是不烘），看 lit 会让环不脉冲，
        // 玩家读成「这台灶点不了」，与动作条给出的放饼键自相矛盾。
        live = near && (
          (onStove === 'golden' || onStove === 'burnt') ||
          (st.cake === null && c !== null && c.kind === 'wood') ||
          (st.cake === null && c !== null && c.kind === 'raw') ||
          (st.cake !== null && onStove !== 'golden' && onStove !== 'burnt' &&
           c !== null && c.kind === 'wood' && !firing(st))
        );
        var ck = d.cake, ht = d.heat;
        if (st.cake === null) {
          setCls(ck, 'scake');
          setCls(ht, 'heat');
        } else {
          var cake = K.cakes[st.cake];
          var want = CAKE_SPR[cake.state];
          if (prevRender['sc' + key] !== want) { ck.src = want; prevRender['sc' + key] = want; }
          setCls(ck, 'scake show');
          setCls(ht, 'heat show');
          var hf = d.hfill;
          var ratio = Math.max(0, Math.min(1, cake.h / D.micro.burntAt));
          var w = Math.round(ratio * 100) + '%';
          if (hf.style.width !== w) { hf.style.width = w; }
          setCls(hf, cake.state === 'burnt' ? 'burn' : (cake.state === 'golden' ? 'gold' : ''));
        }
        if (st.lit) { extra += ' lit'; }
        if (st.cake !== null && K.cakes[st.cake].state === 'burnt') { extra += ' burning'; }
      }

      setCls(d.box, 'st' + (near ? ' inrange' : ' far') + (live ? ' live' : '') +
             (s.id === guideId ? ' guide' : '') + extra);

      if (d.pips) {
        var b = K.board;
        for (var q = 0; q < d.pips.childNodes.length; q++) {
          var cls = q < b.step ? 'done' : (q === b.step && b.busy && b.taps > 0 ? 'now' : '');
          setCls(d.pips.childNodes[q], cls);
        }
      }
    });

    if (toastTimer !== 0 && K.elapsed >= toastTimer) {
      toastTimer = 0;
      var tn = el('k-toast');
      if (tn.className !== '') { tn.className = ''; }
    }

    renderGuide(guideId);
    renderStand(guideId);
  }

  // §4.10.1 站位标记：把「该站哪儿」画在地上。旧版只有一个看不见的 stand 点，
  // 玩家必须凭手感走到 61–76px 半径里，于是「拿着饼放不到灶台」。
  function renderStand(guideId) {
    var node = el('k-stand');
    var st = ST_BY_ID[auto !== null ? auto.target : guideId];
    var t = 'translate(' + (st.stand.x - 18) + 'px,' + (st.stand.y - 18) + 'px)';
    if (prevRender.standTx !== t) { node.style.transform = t; prevRender.standTx = t; }
    setCls(node, inRange(st) ? '' : 'on');
  }

  function renderGuide(guideId) {
    var ar = el('k-guide-arrow');
    var st = ST_BY_ID[guideId];
    var dx = st.ip.x - K.chef.x, dy = st.ip.y - K.chef.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var on = dist > st.range;
    var dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left')
                                           : (dy >= 0 ? 'down' : 'up');
    setCls(ar, on ? 'on ' + dir : '');
    if (!on) { return; }
    var ux = dx / dist, uy = dy / dist;
    var t = 'translate(' + Math.max(2, Math.min(WORLD_W - 24, Math.round(K.chef.x + ux * 52 - 11))) + 'px,' +
            Math.max(2, Math.min(WORLD_H - 24, Math.round(K.chef.y + uy * 52 - 11))) + 'px)';
    if (prevRender.garTx !== t) { ar.style.transform = t; prevRender.garTx = t; }
  }

  function renderCustomers() {
    for (var i = 0; i < CUST_DOM.length; i++) {
      var node = CUST_DOM[i], o = K.orders[i];
      var on = (o && o.state === 'open') ? 1 : 0;
      if (prevRender['cust' + i] !== on) {
        setCls(node, 'cust c' + i + (on ? ' show' : ''));
        prevRender['cust' + i] = on;
      }
      if (!on) { continue; }
      var chip = FILL_CHIP[o.filling];
      var dot = node.querySelector('.bubble b');
      if (dot.style.background !== chip) { dot.style.background = chip; }
    }
  }

  // §4.10.1 动作条只说一件事。旧版把近身半径内的三座工位各推一颗键，于是站在灶边也
  // 看得到案板的「开始做饼」、站在案板边也看得到柴堆的「拿柴火」——玩家点了那颗不相干
  // 的键什么也不会发生，读成「落模之后就卡住了」。故本节改成：只解析**脚下最近的一座
  // 工位**（`stationHere`），只给出这一下真会产生结果的键（`planAt`）；做不成事时改给
  // 一行说明 + 一颗「走到下一站」键。于是动作条既不会空，也不会出现点了没反应的键。
  // 注：§4.10 的「四层呈现没有任何文字标签」指的是 far / inrange / live / guide 四档
  // 可达性状态，不是工位名牌——名牌是识别读数（`buildStations` 的 `.st-name`），常驻。
  function stationHere() {
    var best = null;
    STATIONS.forEach(function (s) {
      if (!inRange(s)) { return; }
      if (best === null || distTo(s) < distTo(best)) { best = s; }
    });
    return best;
  }

  // 手里拎着东西却站在不相干的工位：说清手上是什么、该送去哪儿（目标取 nextGuide）。
  function carryHint(guideId) {
    return '手里是' + CARRY_NAME[K.carry.kind] + ' · 送去' + ST_NAME[guideId];
  }

  // 每座工位在「当前手里拿着什么」下的唯一可动手作。acts 为空时 hint 必非空——
  // 这是「动作条永不空」与「不存在点了没反应的键」两条不变量的共同落点。
  function planAt(s, guideId) {
    var acts = [], c = K.carry;

    if (s.kind === 'rack') {
      if (c !== null) { return { acts: acts, hint: carryHint(guideId) }; }
      K.spec.fillings.forEach(function (f) {
        if (freeCakeFor(f) < 0) { return; }
        acts.push({ st: 'rack', label: '取' + D.fillings[f].label, good: true, arg: f });
      });
      return { acts: acts, hint: acts.length === 0 ? '这单的馅料都备好了' : '' };
    }

    if (s.kind === 'board') {
      var b = K.board;
      if (b.busy) { return { acts: [{ st: 'board', label: STEP_NAME[b.step], good: true }], hint: '' }; }
      if (c !== null && c.kind === 'bowl') {
        if (freeCakeFor(c.filling) < 0) { return { acts: acts, hint: '这味馅料已经备好了' }; }
        return { acts: [{ st: 'board', label: '开始做饼', good: true }], hint: '' };
      }
      return { acts: acts, hint: c !== null ? carryHint(guideId) : '先去食材架取馅料碗' };
    }

    if (s.kind === 'wood') {
      if (c !== null) { return { acts: acts, hint: carryHint(guideId) }; }
      if (K.wood <= 0) { return { acts: acts, hint: '柴堆空了' }; }
      return { acts: [{ st: 'firewood', label: '拿柴火', good: true }], hint: '' };
    }

    if (s.kind === 'plate') {
      if (c !== null && (c.kind === 'golden' || c.kind === 'burnt')) {
        return { acts: [{ st: 'plate', label: '上菜', good: true }], hint: '' };
      }
      return { acts: acts, hint: c !== null ? carryHint(guideId) : '手上没有出炉的饼' };
    }

    // 灶甲 / 灶乙：标签一律带上灶名，于是「把饼放上灶甲」不会被读成案板或柴堆的动作。
    var key = STOVE_KEY[s.id], stv = K.stoves[key], name = ST_NAME[s.id];
    if (stv.cake !== null) {
      var cst = K.cakes[stv.cake].state;
      if (cst === 'golden' || cst === 'burnt') {
        return { acts: [{ st: s.id, label: cst === 'golden' ? '出炉' : '取饼', good: true }], hint: '' };
      }
      if (c !== null && c.kind === 'wood' && !firing(stv)) {
        return { acts: [{ st: s.id, label: '给' + name + '续火', good: true, fire: true }], hint: '' };
      }
      return { acts: acts, hint: firing(stv) ? name + '还在烘 · 等它变金黄'
                                             : name + '火灭了 · 拿柴火来续' };
    }
    if (c !== null && c.kind === 'wood') {
      return { acts: [{ st: s.id, label: '给' + name + '点火', good: true, fire: true }], hint: '' };
    }
    if (c !== null && c.kind === 'raw') {
      // §4.3.6 锁定「冷灶放饼：饼放上去但不烘」，故放饼不以点火为前提。旧版在此加了
      // `!stv.lit` 闸门：火在做饼途中烧完后，拎饼站在灶边的玩家只剩「走到柴堆」键——
      // 放不下饼 → 腾不出手 → 拿不了柴，这正是「落模之后就卡住了」。冷灶时另附说明。
      return { acts: [{ st: s.id, label: '把饼放上' + name, good: true }],
               hint: firing(stv) ? '' : name + '是冷的 · 放上去不烘，要拿柴火来点' };
    }
    if (c !== null) { return { acts: acts, hint: carryHint(guideId) }; }
    return { acts: acts, hint: stv.lit ? name + '空着 · 拿生饼来烘'
                                       : name + '是冷的 · 去柴堆拿柴火' };
  }

  function renderActions(guideId) {
    var bar = el('k-actions');
    var here = stationHere();
    var items = [];
    if (here === null) {
      // §4.10.1 不在任何工位近身半径内：动作条给出唯一一颗「走到〈工位名〉」键。
      items.push({ st: guideId, label: '走到' + ST_NAME[guideId] });
    } else {
      var plan = planAt(here, guideId);
      items = plan.acts.slice();
      if (plan.hint !== '') { items.push({ hint: plan.hint }); }
      // 走位键的判据是 plan.acts 而不是 items：items 里已经放进了 hint，用 items 会把
      // 「走到下一站」整个吃掉，玩家读不到去哪儿——正是软锁的呈现端。
      if (plan.acts.length === 0 && guideId !== here.id) {
        items.push({ st: guideId, label: '走到' + ST_NAME[guideId] });
      }
    }

    var sig = items.map(function (w) {
      return w.hint !== undefined ? '~' + w.hint
        : w.st + '|' + w.label + '|' + (w.good ? 1 : 0) + '|' +
          (w.fire ? 1 : 0) + '|' + (w.arg === undefined ? '' : w.arg);
    }).join(';');
    if (prevRender.actions === sig) { return; }
    prevRender.actions = sig;

    bar.innerHTML = '';
    items.forEach(function (w) {
      if (w.hint !== undefined) {
        var h = document.createElement('p');
        h.className = 'ahint';
        h.textContent = w.hint;
        bar.appendChild(h);
        return;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'abtn' + (w.good ? ' good' : '') + (w.fire ? ' fire' : '');
      b.dataset.tap = '1';
      b.dataset.station = w.st;
      b.textContent = w.label;
      if (w.arg !== undefined) { b.dataset.fill = w.arg; }
      bar.appendChild(b);
    });
  }

  function renderAll() {
    var guideId = GUIDE_TO_STATION[E.nextGuide(kitchenKey())];
    renderStatus();
    renderOrders();
    renderWorld(guideId);
    renderCustomers();
    renderActions(guideId);
  }

  // ------------------------------ 时钟与单一 rAF 循环 ------------------------------
  var rafId = 0;
  var last = 0;
  var t0 = 0;
  var pausedElapsed = 0;
  var paused = false;

  function clock() { return window.performance && window.performance.now ? window.performance.now() : Date.now(); }

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (!K || K.done) { return; }
    if (!last) { last = now; }
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) { dt = 0.25; }
    if (dt < 0) { dt = 0; }
    K.elapsed = (now - t0) / 1000;
    stepChef(dt);
    stepStoves(dt);
    stepOrders();
    if (!K.done && K.spec.congRong !== true && K.elapsed >= E.sessionCapOf(K.spec.n)) {
      K.elapsed = E.sessionCapOf(K.spec.n);
      endSession();
      return;
    }
    renderAll();
  }

  function startLoop() { last = 0; rafId = requestAnimationFrame(loop); }
  function stopLoop() { if (rafId) { cancelAnimationFrame(rafId); } rafId = 0; last = 0; }

  // pausedElapsed is held in seconds so it matches K.elapsed's unit.
  function onVisibility() {
    if (!K || K.done) { return; }
    if (document.visibilityState === 'hidden') {
      paused = true;
      pausedElapsed = (clock() - t0) / 1000;
      stopLoop();
    } else if (paused) {
      paused = false;
      t0 = clock() - pausedElapsed * 1000;
      startLoop();
    }
  }

  // ------------------------------ 会话生命周期 ------------------------------
  var choice = { n: 1, fillings: [], batch: 'normal' };

  function newKitchen(spec, baseState) {
    var orders = E.spawnOrders(spec);
    var i;
    for (i = 0; i < orders.length; i++) { orders[i].flash = 0; }
    var cakes = [];
    for (i = 0; i < spec.n; i++) {
      cakes.push({ index: i, filling: spec.fillings[i], made: false, stove: null,
        litElapsed: 0, tOn: null, state: 'raw', h: 0, prevLabel: '', taken: false, served: false });
    }
    return {
      spec: spec,
      baseState: baseState,
      craftState: E.beginCraft(baseState, { filling: spec.fillings[0], batch: spec.batch }),
      orders: orders,
      cakes: cakes,
      chef: { x: 192, y: 300 },
      carry: null,
      board: { busy: false, cakeIdx: -1, filling: null, step: 0, taps: 0 },
      wood: D.micro.woodCap,
      stoves: { A: { lit: false, litAt: 0, cake: null }, B: { lit: false, litAt: 0, cake: null } },
      timeline: [],
      elapsed: 0,
      done: false
    };
  }

  // auto / joy are module-level, so they outlive a session; a new session must
  // start from rest or stepChef feeds chefAt a negative elapsed from the old t0.
  function resetInput() {
    auto = null;
    joy.active = false; joy.dx = 0; joy.dy = 0; joy.id = -1;
    var knob = el('k-joy-knob');
    if (knob) { knob.style.transform = 'translate(0px,0px)'; }
  }

  function enterKitchen(state, sel) {
    var spec = { batch: sel.batch, n: sel.n, fillings: sel.fillings.slice(),
      patterns: state.patterns, day: state.day, congRong: state.flags.congRong === true };
    buildKitchen();
    K = newKitchen(spec, state);
    prevRender = {};
    resetInput();
    t0 = clock();
    paused = false;
    show('view-kitchen');
    renderAll();
    startLoop();
  }

  function endSession() {
    if (K.done) { return; }
    K.done = true;
    stopLoop();
    logEvent('end');
    var sim = E.craftSim(K.spec, K.timeline);
    var done = { cakes: [] };
    var i;
    for (i = 0; i < sim.cakes.length; i++) {
      var c = sim.cakes[i];
      done.cakes.push({ filling: c.filling, batch: K.spec.batch, P: c.P,
        grade: c.grade, orderServed: c.orderServed });
      if (c.orderServed) {
        var fam = orderFamilyFor(c.filling);
        if (fam) {
          var bonus = E.preferBonus(c.filling, fam, c.grade);
          if (bonus > 0) { pop(ST_BY_ID.plate.ip.x, ST_BY_ID.plate.ip.y - 26, '+' + bonus + ' 心意'); }
        }
      }
      window.YueYan.Audio.play('grade', c.grade);
    }
    K = null;
    window.YueYan.Main.finishCraft(done);
  }

  function orderFamilyFor(filling) {
    var order = D.familyOrder, j;
    for (j = 0; j < order.length; j++) {
      if (D.family[order[j]].pref === filling) { return order[j]; }
    }
    return null;
  }

  function abortKitchen() {
    if (!K) { return; }
    stopLoop();
    E.abortCraft(K.craftState);
    K = null;
    window.YueYan.Main.abortCraft();
  }

  // §4.3.9 / V-15 / V-16 的验收钩子：驱动的是真实的短局状态机，不是 craftSim。
  // 时钟由 timeline 的 t 推进，scene 仍是唯一时钟持有者；非法输入一律抛明确错误。
  var TL_OPS = { tap: 1, wood: 1, light: 1, place: 1, take: 1, serve: 1, end: 1 };
  var TL_STOVE = { A: 'stove0', B: 'stove1' };

  function tlFail(msg) { throw new Error('injectTimeline: ' + msg); }

  function tlCheck(actions) {
    if (!Array.isArray(actions)) { tlFail('timeline must be an array'); }
    var i, a, prev = 0;
    for (i = 0; i < actions.length; i++) {
      a = actions[i];
      if (!a || typeof a !== 'object') { tlFail('entry ' + i + ' is not an object'); }
      if (typeof a.t !== 'number' || !(a.t >= 0)) { tlFail('entry ' + i + ' needs t >= 0'); }
      if (a.t < prev) { tlFail('timeline must be sorted by t at entry ' + i); }
      if (!TL_OPS[a.op]) { tlFail('entry ' + i + ' carries an unknown op'); }
      prev = a.t;
    }
  }

  // 以真实渲染循环同样的 dt 上限逐段推进，故火候累计与燃料耗尽的语义与真人游玩一致。
  function tlAdvance(t) {
    while (K.elapsed < t) {
      var dt = Math.min(0.25, t - K.elapsed);
      K.elapsed += dt;
      stepStoves(dt);
      stepOrders();
      if (!K.done && K.spec.congRong !== true &&
          K.elapsed >= E.sessionCapOf(K.spec.n)) { endSession(); return; }
    }
  }

  // 走位跳过真实耗时，但仍经 chefAt 求出终点坐标，故 §4.7.1 P-3 的求值路径被保留。
  function tlStand(id) {
    var st = ST_BY_ID[id];
    if (!st) { tlFail('unknown station ' + id); }
    walkTo(id);
    var p = E.chefAt(auto.len / D.micro.chefSpeed, auto.path);
    K.chef.x = p.x;
    K.chef.y = p.y;
    auto = null;
  }

  function tlOp(a) {
    var before = K.timeline.length;
    switch (a.op) {
      case 'tap':
        if (!K.board.busy) { tlStand('rack'); rackTap(K.cakes[a.cake - 1].filling); }
        tlStand('board');
        boardTap();
        break;
      case 'wood':
        tlStand('firewood');
        grabWood();
        break;
      case 'serve':
        tlStand('plate');
        plateTap();
        break;
      case 'light':
      case 'place':
        tlStand(TL_STOVE[a.step]);
        stoveTap(TL_STOVE[a.step]);
        break;
      case 'take':
        tlStand(TL_STOVE[K.cakes[a.cake - 1].stove]);
        stoveTap(TL_STOVE[K.cakes[a.cake - 1].stove]);
        break;
      case 'end':
        endSession();
        return;
      default:
        tlFail('entry carries an unknown op');
    }
    // A null K means the op succeeded and completed the session, so it is only a
    // rejection when K survives without having logged the entry.
    if (K && K.timeline.length === before) {
      tlFail('the kitchen rejected op ' + a.op + ' at t=' + a.t);
    }
  }

  function injectTimeline(actions) {
    tlCheck(actions);
    if (!K) { tlFail('no active session; call Main.startCraft first'); }
    var i;
    for (i = 0; i < actions.length; i++) {
      // checkSessionEnd can finish the session mid-timeline, which nulls K, so both
      // guards are needed to keep §4.3.9's explicit-error contract on every entry.
      if (!K || K.done) { tlFail('entry ' + i + ' arrives after the session ended'); }
      tlAdvance(actions[i].t);
      if (!K || K.done) { tlFail('entry ' + i + ' arrives after the session ended'); }
      tlOp(actions[i]);
    }
    return window.YueYan.Main.state();
  }

  // ------------------------------ 制饼预选择（§4.1 三步选择） ------------------------------
  function ensureNRow() {
    if (el('craft-n-row')) { return; }
    var row = document.createElement('div');
    row.id = 'craft-n-row';
    row.className = 'craft-n-row';
    var b1 = document.createElement('button');
    b1.id = 'craft-n-1'; b1.type = 'button'; b1.className = 'btn btn-ghost'; b1.textContent = '做 1 枚';
    var b2 = document.createElement('button');
    b2.id = 'craft-n-2'; b2.type = 'button'; b2.className = 'btn btn-ghost'; b2.textContent = '做 2 枚';
    row.appendChild(b1); row.appendChild(b2);
    var list = el('craft-filling-list');
    list.parentNode.insertBefore(row, list);
    b1.addEventListener('click', function () { pickN(1); });
    b2.addEventListener('click', function () { pickN(2); });
  }

  function pickN(n) {
    choice.n = n;
    if (choice.fillings.length > n) { choice.fillings = choice.fillings.slice(0, n); }
    el('craft-n-1').setAttribute('aria-pressed', n === 1 ? 'true' : 'false');
    el('craft-n-2').setAttribute('aria-pressed', n === 2 ? 'true' : 'false');
    refreshCraftStart();
    paintFillingPicks();
  }

  function paintFillingPicks() {
    var btns = el('craft-filling-list').querySelectorAll('[data-filling]'), i;
    for (i = 0; i < btns.length; i++) {
      var key = btns[i].getAttribute('data-filling');
      btns[i].setAttribute('aria-pressed', choice.fillings.indexOf(key) >= 0 ? 'true' : 'false');
    }
  }

  function pickFilling(key) {
    var at = choice.fillings.indexOf(key);
    if (at >= 0) { choice.fillings.splice(at, 1); }
    else if (choice.fillings.length < choice.n) { choice.fillings.push(key); }
    else { choice.fillings.shift(); choice.fillings.push(key); }
    paintFillingPicks();
    refreshCraftStart();
  }

  function pickBatch(batch) {
    choice.batch = batch;
    el('craft-batch-normal').setAttribute('aria-pressed', batch === 'normal' ? 'true' : 'false');
    el('craft-batch-premium').setAttribute('aria-pressed', batch === 'premium' ? 'true' : 'false');
    refreshCraftStart();
  }

  function craftStartOk(state) {
    if (choice.fillings.length !== choice.n) { return false; }
    if (state.cakes.length + choice.n > D.board.cakeCap) { return false; }
    for (var i = 0; i < choice.fillings.length; i++) {
      if (!E.batchOk(state, choice.fillings[i], choice.batch)) { return false; }
    }
    return true;
  }

  function refreshCraftStart() {
    var state = window.YueYan.Main.state();
    toggleDisabled(el('btn-craft-start'), craftStartOk(state));
    toggleDisabled(el('craft-batch-premium'),
      choice.fillings.length > 0 && E.batchOk(state, choice.fillings[0], 'premium'));
  }

  function renderCraft(state) {
    var list = el('craft-filling-list'), i, key, ok, btn;
    list.innerHTML = '';
    for (i = 0; i < D.fillingOrder.length; i++) {
      key = D.fillingOrder[i];
      ok = E.fillingOk(state, key);
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost filling';
      btn.setAttribute('data-filling', key);
      btn.setAttribute('aria-pressed', 'false');
      child(btn, 'filling-name').textContent = D.fillings[key].label;
      child(btn, 'filling-reason').textContent = ok ? '' : '缺料';
      toggleDisabled(btn, ok);
      list.appendChild(btn);
    }
    ensureNRow();
    el('craft-batch-normal').textContent = BATCH_LABEL.normal;
    el('craft-batch-premium').textContent = BATCH_LABEL.premium;
    el('btn-craft-start').textContent = '开始手作';
    el('btn-craft-abort').textContent = '放弃';
    choice = { n: 1, fillings: [], batch: 'normal' };
    pickN(1);
    pickBatch('normal');
    refreshCraftStart();
    show('view-craft');
  }

  // ------------------------------ 终局视图（保留既有） ------------------------------
  var pick = {};
  var pendingFamily = null;
  var dealt = false;
  var finaleState = null;

  function hasCake(state, key) { return state.assignment[key] !== null; }

  function assignmentMade(state) {
    var i, key;
    for (i = 0; i < D.familyOrder.length; i++) {
      key = D.familyOrder[i];
      if (state.assignment[key] !== null && state.assignment[key] !== undefined) { return true; }
    }
    return false;
  }

  function cakeLabel(cake) {
    return D.fillings[cake.filling].label + ' · ' + GRADE_LABEL[cake.grade - 1]
      + ' · ' + D.actions[cake.method].label;
  }

  function paintAssign(state) {
    var rows = el('assign-cake-list').querySelectorAll('[data-cake]'), i, key;
    var holder = {};
    for (key in pick) {
      if (pick.hasOwnProperty(key) && pick[key] !== null) { holder[pick[key]] = key; }
    }
    for (i = 0; i < rows.length; i++) {
      rows[i].setAttribute('aria-pressed',
                           holder[Number(rows[i].getAttribute('data-cake'))] ? 'true' : 'false');
    }
    var fams = el('assign-family-list').querySelectorAll('[data-family]');
    for (i = 0; i < fams.length; i++) {
      key = fams[i].getAttribute('data-family');
      fams[i].setAttribute('aria-pressed', key === pendingFamily ? 'true' : 'false');
      child(fams[i], 'fam-cake').textContent =
        (pick[key] === null || pick[key] === undefined)
          ? '' : ' · ' + cakeLabel(finaleState.cakes[pick[key]]);
    }
  }

  function pickFamily(key) {
    if (dealt) { return; }
    pendingFamily = key;
    paintAssign();
  }

  function dealCake(index) {
    if (dealt || pendingFamily === null) { return; }
    var i, key;
    for (i = 0; i < D.familyOrder.length; i++) {
      key = D.familyOrder[i];
      if (pick[key] === index) { pick[key] = null; }
    }
    pick[pendingFamily] = index;
    paintAssign();
    window.YueYan.Audio.play('assign');
  }

  function renderAssign(state) {
    pick = {};
    pendingFamily = null;
    finaleState = state;
    dealt = assignmentMade(state);
    var cakes = el('assign-cake-list'), fams = el('assign-family-list'), i, key;
    cakes.innerHTML = '';
    fams.innerHTML = '';
    if (!dealt) {
      for (i = 0; i < state.cakes.length; i++) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'cake-row';
        row.setAttribute('data-cake', String(i));
        row.setAttribute('aria-pressed', 'false');
        row.appendChild(cakeGlyph(state.cakes[i].filling));
        child(row, 'cake-label').textContent = cakeLabel(state.cakes[i]);
        cakes.appendChild(row);
      }
    }
    for (i = 0; i < D.familyOrder.length; i++) {
      key = D.familyOrder[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost fam-row';
      btn.setAttribute('data-family', key);
      btn.setAttribute('aria-pressed', 'false');
      if (dealt) { btn.setAttribute('disabled', 'disabled'); }
      child(btn, 'fam-name').textContent = D.family[key].label;
      child(btn, 'fam-cake').textContent = '';
      fams.appendChild(btn);
    }
    el('btn-assign-confirm').textContent = D.copy.assignConfirm;
    toggleDisabled(el('btn-assign-confirm'), !dealt);
    show('view-assign');
  }

  function confirmAssign(state) {
    var assigned = E.applyAssignment(state, pick);
    dealt = true;
    pick = {};
    pendingFamily = null;
    finaleState = assigned;
    el('assign-cake-list').innerHTML = '';
    show('view-preview');
    return assigned;
  }

  function attends(state, key, a) {
    if (key !== 'brother') { return true; }
    return a === D.familyOrder.length;
  }

  function renderPreview(state) {
    var m = E.meters(state), i, key;

    var cakes = el('preview-cakes');
    cakes.innerHTML = '';
    for (i = 0; i < state.cakes.length; i++) {
      var li = document.createElement('div');
      li.className = 'preview-cake';
      li.appendChild(cakeGlyph(state.cakes[i].filling));
      child(li, 'cake-label').textContent = cakeLabel(state.cakes[i]);
      cakes.appendChild(li);
    }

    var seats = el('preview-seats');
    seats.innerHTML = '';
    for (i = 0; i < D.familyOrder.length; i++) {
      key = D.familyOrder[i];
      var seat = document.createElement('div');
      seat.className = 'seat' + (attends(state, key, m.A) ? ' is-filled' : '');
      seat.textContent = D.family[key].label
        + (hasCake(state, key) ? '' : '（' + D.copy.noCake + '）');
      seats.appendChild(seat);
    }

    var banquet = el('preview-banquet');
    banquet.innerHTML = '';
    for (i = 0; i < D.banquetItems.length; i++) {
      var item = document.createElement('span');
      item.className = 'banquet-item' + (i < state.banquet ? ' is-on' : '');
      item.textContent = D.banquetItems[i];
      banquet.appendChild(item);
    }

    var lanterns = el('preview-lanterns');
    lanterns.innerHTML = '';
    for (i = 0; i < D.actions.buzhi.cap; i++) {
      var lamp = document.createElement('span');
      lamp.className = 'lantern'
        + (i * D.actions.buzhi.ambienceGain < state.ambience ? ' is-on' : '');
      lanterns.appendChild(lamp);
    }
    tintLanterns(lanterns);

    el('preview-q').textContent = m.Q;
    el('preview-b').textContent = m.B;
    el('preview-h').textContent = m.H;
    el('btn-open-feast').textContent = D.copy.openFeast;
    show('view-preview');
  }

  function recordEnding(code) {
    var Save = window.YueYan.Save;
    if (!Save) { return; }
    var meta = Save.readMeta();
    if (meta.endingsSeen.indexOf(code) < 0) { meta.endingsSeen.push(code); }
    Save.writeMeta(meta.endingsSeen);
  }

  // §6.3.5 终局是一场七步仪式，不是一张结果页。整段揭示由「一次类翻转 + 固定
  // animation-delay」驱动：S1 月起（月亮渐显，§8.4 唯一 1.2 秒长动效）→ S2 云定
  // （云层按本结局的云量落定）→ S3 名出 → S4 文出 → S5 席齐（五席自左至右）→
  // S6 饼落（一人一枚，§7.2）→ S7 收束（分享卡一行）。全部纯 CSS：不进 rAF、
  // 不引入任何 JS timer（§8.4.6 / V-37a / X-12），零随机（V-3）。
  function renderEnding(state) {
    finaleState = state;
    var view = el('view-ending');
    var code = E.ending(state), meta = D.endings[code];
    recordEnding(code);
    view.classList.remove('is-revealed');
    el('end-name').textContent = meta.name;
    el('end-text').textContent = meta.text;
    el('btn-share').textContent = '生成分享卡';
    el('card-wrap').classList.remove('is-open');
    renderEndingSeats(state);
    show('view-ending');
    drawMoon(el('end-moon'), code);
    void view.offsetWidth;
    view.classList.add('is-revealed');
    window.YueYan.Audio.play('moon', code);
    return code;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MOON_COVER = { E1: 0.00, E2: 0.18, E3: 0.35, E4: 0.55, E5: 0.75 };
  var CAKE_PATH = {
    dousha:       'M0,-14 L14,0 L0,14 L-14,0 Z',
    wuren:        'M0,-16 L16,-6 L10,14 L-10,14 L-16,-6 Z',
    lianrong:     'M0,-15 C10,-15 15,-5 15,0 C15,10 8,15 0,15 C-8,15 -15,10 -15,0 Z',
    xiandanhuang: 'M0,-12 A12,12 0 1,1 0,12 A12,12 0 1,1 0,-12 Z',
    guihua:       'M0,-14 L4,-4 L14,0 L4,4 L0,14 L-4,4 L-14,0 L-4,-4 Z'
  };

  // §6.3.5 / §5.5 第 8 条：月相是 CSS 像素块，不是位图、不是逐帧画布。同一枚月轮
  // 叠五档云量：云带高度由 MOON_COVER 写入 --cover（与 §9.3 分享卡顶区同源同值），
  // 云缕数、月轮明度、月华强度逐档不同，故 E1 至 E5 一眼可分（§6.3.1）。
  function paintMoonBody(host) {
    if (host.childNodes.length) { return; }
    host.innerHTML =
      '<div class="em-halo"></div>' +
      '<div class="em-rim"></div>' +
      '<div class="em-disc">' +
        '<span class="em-crater k1"></span>' +
        '<span class="em-crater k2"></span>' +
        '<span class="em-crater k3"></span>' +
      '</div>' +
      '<div class="em-clouds">' +
        '<span class="em-wisp em-w1"></span>' +
        '<span class="em-wisp em-w2"></span>' +
        '<span class="em-wisp em-w3"></span>' +
        '<div class="em-band"></div>' +
      '</div>';
  }

  function drawMoon(host, code) {
    paintMoonBody(host);
    host.setAttribute('data-ending', code);
    host.style.setProperty('--cover', String(MOON_COVER[code] || 0));
    host.classList.remove('is-revealing');
    void host.offsetWidth;
    host.classList.add('is-revealing');
  }

  // §6.3.5-d 把圆桌穷举为「圆桌 188 × 188 + 五席 + 五饼」三件。旧版桌面正中那枚
  // 黄色八角形不在锁定版面里，也无法呈现 E5 文案的「两盏」（盏 = 灯笼，见
  // D.copy.lanternFull，而 §6.3.5-d 明文规定终局无灯笼阵、氛围由桂花枝承担），
  // 故语义不明即移除。留痕是为了不让后人把它加回来。
  function buildEndingTable() {
    var table = el('end-table');
    if (table.childNodes.length) { return; }
    table.innerHTML =
      '<div class="et-round"></div>' +
      '<div class="et-cake-layer"></div>' +
      '<div class="et-seat-layer"></div>';
  }

  function endingSeat(key, slot, present) {
    var seat = document.createElement('div');
    seat.className = 'et-seat' + (present ? '' : ' is-empty');
    seat.setAttribute('data-member', key);
    seat.setAttribute('data-slot', String(slot));

    var stool = document.createElement('span');
    stool.className = 'et-stool';
    seat.appendChild(stool);

    if (!present) { return seat; }
    var fig = document.createElement('div');
    fig.className = 'et-fig';
    fig.innerHTML = '<span class="fg-shd"></span><span class="fg-body"></span>' +
      '<span class="fg-head"></span><span class="fg-hair"></span>';
    seat.appendChild(fig);

    var nm = document.createElement('span');
    nm.className = 'et-name';
    nm.textContent = D.family[key].label;
    seat.appendChild(nm);
    return seat;
  }

  function endingCake(slot) {
    var img = document.createElement('img');
    img.className = 'et-cake';
    img.src = spr('px-cake-golden');
    img.alt = '';
    img.setAttribute('data-slot', String(slot));
    return img;
  }

  // §7.1 / §7.2 / X-11：五席永远画满五格，到席者坐人、缺席者只留一张空凳，
  // 不出现任何称谓或文案；分到饼的家人面前落一枚饼，一人一枚。
  function renderEndingSeats(state) {
    buildEndingTable();
    var table = el('end-table');
    var seats = table.querySelector('.et-seat-layer');
    var cakes = table.querySelector('.et-cake-layer');
    seats.innerHTML = '';
    cakes.innerHTML = '';
    var i, key;
    for (i = 0; i < D.familyOrder.length; i++) {
      key = D.familyOrder[i];
      seats.appendChild(endingSeat(key, i + 1, E.attends(state, key)));
      if (hasCake(state, key)) { cakes.appendChild(endingCake(i + 1)); }
    }
  }

  function drawCakePattern(pathEl, filling) {
    pathEl.setAttribute('d', CAKE_PATH[filling] || CAKE_PATH.dousha);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', D.palette.cinnabar);
    pathEl.setAttribute('stroke-width', '1.5');
  }

  function tintLanterns(root) {
    var lamps = root.querySelectorAll('.lantern.is-on'), i;
    for (i = 0; i < lamps.length; i++) {
      lamps[i].style.background = D.palette.lantern;
      lamps[i].style.borderColor = D.palette.ink;
    }
  }

  function buildPaperLayer() {
    var c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    var ctx = c.getContext('2d');
    ctx.fillStyle = D.palette.paper;
    ctx.fillRect(0, 0, 64, 64);
    var x, y;
    for (y = 0; y < 64; y += 4) {
      for (x = 0; x < 64; x += 4) {
        if (((x * 7 + y * 13) % 5) === 0) {
          ctx.fillStyle = D.palette.moon;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    document.body.style.backgroundImage = 'url(' + c.toDataURL() + ')';
  }

  function cakeGlyph(filling) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '-20 -20 40 40');
    svg.setAttribute('width', '28');
    svg.setAttribute('height', '28');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(SVG_NS, 'path');
    svg.appendChild(path);
    drawCakePattern(path, filling);
    return svg;
  }

  function openSheet() {
    el('drawer').classList.add(OPEN);
    el('sheet-backdrop').classList.add(OPEN);
  }

  function closeSheet() {
    el('drawer').classList.remove(OPEN);
    el('sheet-backdrop').classList.remove(OPEN);
    var box = el('drawer').querySelector('.craft-fillings');
    if (box) { box.classList.remove(OPEN); }
  }

  function expand(row) { row.classList.toggle(COLLAPSED); }

  function tap(id, fn) {
    var node = el(id);
    if (node) { node.addEventListener('click', fn); }
  }

  // §3.3 feedback: an accepted action pulses exactly the readouts it actually moved,
  // derived from the before/after numbers so no per-action table can drift from the
  // engine. A rejected action is already greyed with its reason, so only a success flashes.
  var RES_CHIP = [['silver-count', 'silver'], ['cake-count', 'cake'],
                  ['stock-putong', 'putong'], ['stock-haoliao', 'haoliao'],
                  ['stock-xiandanhuang', 'xiandanhuang'], ['stock-guihua', 'guihua']];

  function resReadout(state) {
    var out = { silver: state.silver, cake: state.cakes.length }, k;
    for (k in D.items) {
      if (D.items.hasOwnProperty(k)) { out[k] = state.stock[k]; }
    }
    return out;
  }

  function pulseRes(id) {
    var node = el(id);
    if (!node) { return; }
    node.classList.remove('is-confirm');
    void node.offsetWidth;                 // reflow so the pulse re-fires on the next tap
    node.classList.add('is-confirm');
  }

  function confirmAction(before, after) {
    var i, key;
    for (i = 0; i < RES_CHIP.length; i++) {
      key = RES_CHIP[i][1];
      if (before[key] === after[key]) { continue; }
      pulseRes(RES_CHIP[i][0]);
    }
  }

  function scheduleAct(act) {
    var before = resReadout(window.YueYan.Main.state());
    if (window.YueYan.Main.schedule(act)) {
      confirmAction(before, resReadout(window.YueYan.Main.state()));
    }
  }

  function buildDrawer() {
    if (built) { return; }
    built = true;
    buildPaperLayer();
    var drawer = el('drawer'), ui = el('ui');

    var backdrop = document.createElement('div');
    backdrop.id = 'sheet-backdrop';
    backdrop.className = 'sheet-backdrop';
    ui.appendChild(backdrop);

    var craft = document.createElement('div');
    craft.className = 'drawer-row ' + COLLAPSED;
    craft.setAttribute('data-action', 'craft');
    craft.appendChild(document.createElement('span')).className = 'row-name';
    craft.appendChild(document.createElement('span')).className = 'row-reason';
    var branch = document.createElement('div');
    branch.className = 'craft-branch';
    branch.appendChild(el('row-daizuo'));
    branch.appendChild(el('row-shouzuo'));
    craft.appendChild(branch);
    var fillings = document.createElement('div');
    fillings.className = 'craft-fillings';
    craft.appendChild(fillings);
    drawer.insertBefore(craft, el('row-xiexin'));

    var buyRow = el('row-buy');
    buyRow.classList.add(COLLAPSED);
    buyRow.insertBefore(document.createElement('span'), buyRow.querySelector('.buy-sub'))
      .className = 'row-reason';

    var bar = document.createElement('div');
    bar.id = 'day-bar';
    bar.className = 'day-bar';
    var undo = document.createElement('button');
    undo.id = 'btn-undo-slot';
    undo.type = 'button';
    undo.className = 'btn btn-ghost';
    undo.textContent = '撤销一步';
    undo.setAttribute('disabled', 'disabled');
    bar.appendChild(undo);
    bar.appendChild(el('btn-finish-day'));
    ui.appendChild(bar);

    el('slot-grid').addEventListener('click', function (ev) {
      var slot = ev.target.closest('.slot');
      if (!slot || slot.classList.contains('is-filled')) { return; }
      openSheet();
    });
    backdrop.addEventListener('click', closeSheet);
    tap('row-buy', function () { expand(buyRow); });
    craft.addEventListener('click', function (ev) {
      if (ev.target.closest('.craft-branch') || ev.target.closest('.craft-fillings')) { return; }
      expand(craft);
    });
    tap('row-shishi', function () { scheduleAct({ type: 'shishi' }); });
    tap('row-xiexin', function () { scheduleAct({ type: 'xiexin' }); });
    tap('row-beiyan', function () { scheduleAct({ type: 'beiyan' }); });
    tap('row-buzhi', function () { scheduleAct({ type: 'buzhi' }); });
    tap('row-daizuo', function () { renderFillings(window.YueYan.Main.state()); });
    tap('row-shouzuo', function () { window.YueYan.Main.enterCraft(); });
    tap('buy-putong', function () { scheduleAct({ type: 'buy', item: 'putong' }); });
    tap('buy-haoliao', function () { scheduleAct({ type: 'buy', item: 'haoliao' }); });
    tap('buy-xiandanhuang', function () { scheduleAct({ type: 'buy', item: 'xiandanhuang' }); });
    tap('buy-guihua', function () { scheduleAct({ type: 'buy', item: 'guihua' }); });
    fillings.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-filling]');
      if (!btn) { return; }
      scheduleAct({ type: 'daizuo', filling: btn.getAttribute('data-filling') });
    });
    tap('btn-undo-slot', function () { window.YueYan.Main.undo(); });
    tap('btn-finish-day', function () { window.YueYan.Main.finishDay(); });
    tap('btn-start', function () { window.YueYan.Main.start(); });

    el('craft-filling-list').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-filling]');
      if (!btn) { return; }
      pickFilling(btn.getAttribute('data-filling'));
    });
    tap('craft-batch-normal', function () { pickBatch('normal'); });
    tap('craft-batch-premium', function () { pickBatch('premium'); });
    tap('btn-craft-start', function () {
      var state = window.YueYan.Main.state();
      if (!craftStartOk(state)) { return; }
      window.YueYan.Main.startCraft(state, choice);
    });
    tap('btn-craft-abort', function () { window.YueYan.Main.abortCraft(); });

    el('assign-family-list').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-family]');
      if (!btn) { return; }
      pickFamily(btn.getAttribute('data-family'));
    });
    el('assign-cake-list').addEventListener('click', function (ev) {
      var row = ev.target.closest('[data-cake]');
      if (!row) { return; }
      dealCake(Number(row.getAttribute('data-cake')));
    });
    tap('btn-assign-confirm', function () {
      var assigned = confirmAssign(finaleState);
      if (assigned) { renderPreview(assigned); }
    });
    tap('btn-open-feast', function () { if (finaleState) { renderEnding(finaleState); } });
    tap('btn-share', function () {
      var Share = window.YueYan.Share;
      if (finaleState && Share && typeof Share.build === 'function') {
        if (Share.publish(Share.build(finaleState)) === 'fallback') {
          el('card-wrap').classList.add('is-open');
        }
        recordEnding(E.ending(finaleState));
      }
    });
    el('card-wrap').addEventListener('click', function () {
      el('card-wrap').classList.remove('is-open');
    });
  }

  window.YueYan.Scene = {
    renderIntro: renderIntro,
    renderSchedule: renderSchedule,
    reasonFor: reasonFor,
    renderFillings: renderFillings,
    slotLabel: slotLabel,
    showPrologue: showPrologue,
    closePrologue: closePrologue,
    renderCraft: renderCraft,
    enterKitchen: enterKitchen,
    injectTimeline: injectTimeline,
    abortCraft: abortKitchen,
    renderAssign: renderAssign,
    confirmAssign: confirmAssign,
    currentPick: function () { return pick; },
    renderPreview: renderPreview,
    renderEnding: renderEnding,
    hasCake: hasCake,
    drawMoon: drawMoon,
    drawCakePattern: drawCakePattern,
    tintLanterns: tintLanterns,
    buildPaperLayer: buildPaperLayer,
    buildDrawer: buildDrawer,
    openSheet: openSheet,
    closeSheet: closeSheet,
    show: show,
    el: el
  };
})();
