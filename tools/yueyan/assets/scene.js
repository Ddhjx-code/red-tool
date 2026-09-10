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
    // §4.6 / X-12: the day must not settle while a slot is in flight, and the
    // seven-day run is over once the finale views take the screen.
    var bar = el('day-bar');
    if (bar) {
      var finale = viewId === 'view-craft' || viewId === 'view-assign'
        || viewId === 'view-preview' || viewId === 'view-ending';
      if (finale) { bar.classList.add('is-hidden'); }
      else { bar.classList.remove('is-hidden'); }
    }
  }

  // Rows keep their children (row-buy owns its four buy branches), so a repaint
  // edits the two spans instead of replacing innerHTML.
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

  // §10.3.1: every grey-out message mirrors the engine predicate it belongs to,
  // so the drawer can never contradict Engine.actionOk.
  function reasonFor(state, act) {
    var day = state.day;
    if (act.type === 'buy') {
      if (D.gates[act.item] && (day < D.gates[act.item].from || day > D.gates[act.item].to)) {
        return D.copy.marketEmpty;                        // §5.2 市集无货
      }
      if (state.silver < D.items[act.item].silver) { return '银钱不足'; }
      var add = D.items[act.item].order ? 1 + state.pendingEgg.length
                                        : D.items[act.item].gain;
      if (E.stockSum(state) + add > D.stockCap) { return '仓已满'; }
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
      if (state.cakes.length >= D.board.cakeCap) { return D.copy.cakeFull; }   // §3.3 五份已足
      if (!E.actionOk(state, act)) { return '缺料'; }
      return '';
    }
    if (act.type === 'xiexin') {
      if (day < D.unlocks.xiexin) { return '未到十一'; }
      if (state.flags.xieXin) { return D.copy.letterSent; }                    // §3.3 信已寄出
      if (state.silver < D.actions.xiexin.silver) { return '银钱不足'; }
      return '';
    }
    if (act.type === 'beiyan') {
      if (day < D.unlocks.beiyan) { return '未到十二'; }
      if (state.silver < D.actions.beiyan.silver) { return '银钱不足'; }
      if (!E.actionOk(state, act)) {                       // §3.2.2 dynamic cap
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

  function renderIntro(state) {
    el('intro-title').textContent = D.intro.title;
    el('intro-sub').textContent = D.intro.sub;
    el('intro-howto').textContent = D.intro.howto;
    el('toggle-congrong-text').textContent = D.intro.congrong;
    el('intro-save-hint').textContent = D.intro.saveHint;
    el('btn-start').textContent = D.intro.start;
    el('toggle-congrong').checked = state.flags.congRong;
    show('view-intro');
  }

  // §5.2: a filled slot names its action and material, never a counter.
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
      '第' + D.dates[Math.min(state.day, D.board.days) - 1] + '日';         // V-18 越界钳制
    el('meter-q').textContent = m.Q;
    el('meter-b').textContent = m.B;
    el('meter-h').textContent = m.H;
    el('silver-count').textContent = '银钱 ' + state.silver;
    el('cake-count').textContent = '饼 ' + state.cakes.length + '/' + D.board.cakeCap;
    el('stock-putong').textContent = D.items.putong.label + ' ' + state.stock.putong;
    el('stock-haoliao').textContent = D.items.haoliao.label + ' ' + state.stock.haoliao;
    el('stock-xiandanhuang').textContent =
      D.items.xiandanhuang.label + ' ' + state.stock.xiandanhuang;
    el('stock-guihua').textContent = D.items.guihua.label + ' ' + state.stock.guihua;
    el('btn-finish-day').textContent = D.copy.finishDay;                      // §5.2

    renderSlots(state, actions);

    // §3.3: six top-level rows; 采买 and 制饼 are the two that expand.
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
      child(btn, 'buy-name').textContent =
        D.items[keys[i]].label + ' ' + D.items[keys[i]].silver + '银';
      child(btn, 'branch-reason').textContent = buyOk ? '' : reasonFor(state, buyAct);
      toggleDisabled(btn, buyOk);
    }
  }

  // §4.4.1 tier labels and §4.4.1 rule 2 wording. data.js carries no key for
  // either, and Task 11 authorises scene.js only, so they live here.
  var GRADE_LABEL = ['铜饼', '银饼', '金饼'];
  var PREMIUM_MISS = '料是好料，火候差了些。';
  var STEP_CONTROLS = ['bar-s1', 'pad-s2', 'pad-s3', 'bar-s4'];

  var craft = null;
  var choice = { filling: null, batch: 'normal' };

  function resetControls() {
    var i, node, movable;
    for (i = 0; i < STEP_CONTROLS.length; i++) {
      node = el(STEP_CONTROLS[i]);
      node.style.display = 'none';
      node.classList.remove('is-swinging');
      movable = node.querySelector('.marker, .knob');
      if (movable) { movable.style.left = ''; movable.style.top = ''; }
    }
    el('btn-step-confirm').setAttribute('disabled', 'disabled');
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
    el('craft-batch-normal').textContent = '普通批次';
    el('craft-batch-premium').textContent = '好料批次';
    el('craft-batch-normal').setAttribute('aria-pressed', 'true');
    el('craft-batch-premium').setAttribute('aria-pressed', 'false');
    toggleDisabled(el('craft-batch-normal'), state.stock.putong >= 2);
    toggleDisabled(el('craft-batch-premium'),
                   state.stock.putong >= 2
                   && state.stock.haoliao >= D.premiumCost.haoliao);
    el('btn-craft-start').textContent = '开始手作';
    toggleDisabled(el('btn-craft-start'), false);
    el('btn-step-confirm').textContent = '确认';
    el('btn-craft-abort').textContent = '放弃';
    el('step-index').textContent = '';
    el('craft-grade').textContent = '';
    craft = null;
    choice = { filling: null, batch: 'normal' };
    resetControls();
    show('view-craft');
  }

  function startStep(state, filling, batch) {
    if (craft || !filling) { return null; }
    if (!E.batchOk(state, filling, batch)) { return null; }
    craft = {
      filling: filling,
      batch: batch,
      stepIndex: 0,
      state: E.beginCraft(state, { filling: filling, batch: batch }),
      deviations: [],
      timer: null
    };
    window.YueYan.Audio.play('craft');
    paintStep();
    return craft.state;
  }

  function paintStep() {
    var step = D.steps[craft.stepIndex];
    el('step-index').textContent = '第 ' + (craft.stepIndex + 1) + ' 步 / 共 4 步';
    STEP_CONTROLS.forEach(function (id, i) {
      el(id).style.display = (i === craft.stepIndex) ? 'block' : 'none';
    });
    var bar = el('bar-' + step.id);
    if (bar) { bar.classList.add('is-swinging'); }              // §4.3.3 swing is constant; 从容模式 only removes the timer/cap
    el('btn-step-confirm').removeAttribute('disabled');
    if (craft.timer) { clearTimeout(craft.timer); craft.timer = null; }
    if (!craft.state.flags.congRong) {                         // §4.2 removes the cap
      craft.timer = setTimeout(function () {
        var done = confirmStep(liveOffset());                  // §4.4 超时照样出饼
        if (done) { window.YueYan.Main.finishCraft(done); }
      }, step.budget * 1000);
    }
  }

  // §4.3.1 offset for the linear bars: normalized marker centre in [0, 1].
  function barOffset(barId) {
    var bar = el(barId);
    if (!bar) { return 0; }
    var mk = bar.querySelector('.marker');
    var span = bar.clientWidth - mk.clientWidth;
    if (span <= 0) { return 0; }
    var x = (parseFloat(getComputedStyle(mk).left) || 0) / span;
    if (x < 0) { x = 0; }
    if (x > 1) { x = 1; }
    return Math.abs(x - 0.5);
  }

  // §4.3.1 dist for the pads: euclidean distance over the ring radius.
  function padOffset(padId) {
    var pad = el(padId);
    if (!pad) { return 0; }
    var ring = pad.querySelector('.ring').getBoundingClientRect();
    var knob = pad.querySelector('.knob').getBoundingClientRect();
    var radius = ring.width / 2;
    if (radius <= 0) { return 0; }
    var dx = (knob.left + knob.width / 2) - (ring.left + ring.width / 2);
    var dy = (knob.top + knob.height / 2) - (ring.top + ring.height / 2);
    return Math.sqrt(dx * dx + dy * dy) / radius;
  }

  function liveOffset() {
    if (!craft) { return 0; }
    var step = D.steps[craft.stepIndex];
    return (step.id === 's1' || step.id === 's4')
      ? barOffset('bar-' + step.id) : padOffset('pad-' + step.id);
  }

  function confirmStep(deviation) {
    if (!craft) { return null; }
    var step = D.steps[craft.stepIndex];
    var tol = E.tolOf(craft.state.patterns, step.id);
    craft.deviations.push(E.precision(deviation, tol));        // engine owns the math
    if (craft.timer) { clearTimeout(craft.timer); craft.timer = null; }
    window.YueYan.Audio.play('step', craft.stepIndex);         // audio.js S1..S4 升序，先播后递进
    craft.stepIndex += 1;
    if (craft.stepIndex < D.steps.length) { paintStep(); return null; }

    var P = 0, i;
    for (i = 0; i < craft.deviations.length; i++) { P += craft.deviations[i]; }
    var done = E.finishCraft(craft.state, P);                  // §4.4.1 double gate
    var cake = done.cakes[done.cakes.length - 1];
    el('craft-grade').textContent = GRADE_LABEL[cake.grade - 1]
      + ((cake.batch === 'premium' && cake.grade < 3) ? ' ' + PREMIUM_MISS : '');
    window.YueYan.Audio.play('grade', cake.grade);
    craft = null;
    resetControls();
    return done;
  }

  function abortCraft() {
    if (!craft) { return null; }
    if (craft.timer) { clearTimeout(craft.timer); craft.timer = null; }
    var back = E.abortCraft(craft.state);                      // §4.6 only refund path
    craft = null;
    resetControls();
    return back;
  }

  function injectStep(i, deviation) {                          // V-15 / V-16 test hook
    if (!craft || i !== craft.stepIndex) { throw new Error('step index mismatch'); }
    return confirmStep(deviation);
  }

  function moveControl(controlId, ev) {
    if (!craft || STEP_CONTROLS[craft.stepIndex] !== controlId) { return; }
    var node = el(controlId), rect = node.getBoundingClientRect();
    if (node.classList.contains('lin-bar')) {
      var mk = node.querySelector('.marker');
      var span = rect.width - mk.clientWidth;
      if (span <= 0) { return; }
      var x = (ev.clientX - rect.left - mk.clientWidth / 2) / span;
      if (x < 0) { x = 0; }
      if (x > 1) { x = 1; }
      mk.style.left = Math.round(x * span) + 'px';
      return;
    }
    var knob = node.querySelector('.knob');
    knob.style.left = 'calc(50% + '
      + Math.round(ev.clientX - rect.left - rect.width / 2) + 'px)';
    knob.style.top = 'calc(50% + '
      + Math.round(ev.clientY - rect.top - rect.height / 2) + 'px)';
  }

  function bindDrag(controlId) {
    var node = el(controlId);
    node.addEventListener('pointerdown', function (ev) {
      node.setPointerCapture(ev.pointerId);
      moveControl(controlId, ev);
    });
    node.addEventListener('pointermove', function (ev) { moveControl(controlId, ev); });
  }

  function pickFilling(key) {
    choice.filling = key;
    var btns = el('craft-filling-list').querySelectorAll('[data-filling]'), i;
    for (i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed',
                           btns[i].getAttribute('data-filling') === key ? 'true' : 'false');
    }
    var state = window.YueYan.Main.state();
    toggleDisabled(el('craft-batch-premium'), E.batchOk(state, key, 'premium'));
    toggleDisabled(el('btn-craft-start'), E.batchOk(state, key, choice.batch));
  }

  function pickBatch(batch) {
    choice.batch = batch;
    el('craft-batch-normal').setAttribute('aria-pressed', batch === 'normal' ? 'true' : 'false');
    el('craft-batch-premium').setAttribute('aria-pressed', batch === 'premium' ? 'true' : 'false');
    if (choice.filling) {
      toggleDisabled(el('btn-craft-start'),
                     E.batchOk(window.YueYan.Main.state(), choice.filling, batch));
    }
  }

  // §6.6 the deal is an emotional choice made exactly once, so a state that
  // already carries an assignment renders locked and cannot be re-dealt (X-10).
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
    for (i = 0; i < D.familyOrder.length; i++) {            // §6.6 one cake per member
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
    var assigned = E.applyAssignment(state, pick);          // §7.3 engine owns the bonus
    dealt = true;
    pick = {};
    pendingFamily = null;
    finaleState = assigned;
    el('assign-cake-list').innerHTML = '';                  // X-10 the deal is over
    show('view-preview');
    return assigned;
  }

  // §3.9 four family members always attend, so the engine's A decides the fifth.
  function attends(state, key, a) {
    if (key !== 'brother') { return true; }
    return a === D.familyOrder.length;
  }

  function renderPreview(state) {
    var m = E.meters(state), i, key;

    var cakes = el('preview-cakes');
    cakes.innerHTML = '';
    for (i = 0; i < state.cakes.length; i++) {              // §6.2 production order
      var li = document.createElement('div');
      li.className = 'preview-cake';
      li.appendChild(cakeGlyph(state.cakes[i].filling));
      child(li, 'cake-label').textContent = cakeLabel(state.cakes[i]);
      cakes.appendChild(li);
    }

    var seats = el('preview-seats');
    seats.innerHTML = '';
    for (i = 0; i < D.familyOrder.length; i++) {            // §7.1 an empty seat is the story
      key = D.familyOrder[i];
      var seat = document.createElement('div');
      seat.className = 'seat' + (attends(state, key, m.A) ? ' is-filled' : '');
      seat.textContent = D.family[key].label
        + (hasCake(state, key) ? '' : '（' + D.copy.noCake + '）');
      seats.appendChild(seat);
    }

    var banquet = el('preview-banquet');
    banquet.innerHTML = '';
    for (i = 0; i < D.banquetItems.length; i++) {           // §3.3 the cap stays visible
      var item = document.createElement('span');
      item.className = 'banquet-item' + (i < state.banquet ? ' is-on' : '');
      item.textContent = D.banquetItems[i];
      banquet.appendChild(item);
    }

    var lanterns = el('preview-lanterns');
    lanterns.innerHTML = '';
    for (i = 0; i < D.actions.buzhi.cap; i++) {             // §3.5 four lanterns
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

  // X-8 只存结局清单，不存进程：结局一渲染就记录，不依赖玩家是否点分享。
  function recordEnding(code) {
    var Save = window.YueYan.Save;
    if (!Save) { return; }
    var meta = Save.readMeta();
    if (meta.endingsSeen.indexOf(code) < 0) { meta.endingsSeen.push(code); }
    Save.writeMeta(meta.endingsSeen);
  }

  function renderEnding(state) {
    finaleState = state;
    var code = E.ending(state), meta = D.endings[code];
    recordEnding(code);
    el('end-name').textContent = meta.name;
    el('end-text').textContent = meta.text;                 // §6.3.4 reunion only
    el('btn-share').textContent = '生成分享卡';
    el('end-moon').setAttribute('data-ending', code);
    show('view-ending');                                       // visible before it fades
    drawMoon(el('end-moon'), code);
    window.YueYan.Audio.play('moon', code);
    return code;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  // §6.3.1 月亮呈现: E1 满月无云 → E5 薄云遮月, the cloud band growing per ending.
  var MOON_COVER = { E1: 0.00, E2: 0.18, E3: 0.35, E4: 0.55, E5: 0.75 };

  // §8.3 对称几何刻印: five fillings, five distinct symmetric engravings.
  var CAKE_PATH = {
    dousha:       'M0,-14 L14,0 L0,14 L-14,0 Z',
    wuren:        'M0,-16 L16,-6 L10,14 L-10,14 L-16,-6 Z',
    lianrong:     'M0,-15 C10,-15 15,-5 15,0 C15,10 8,15 0,15 C-8,15 -15,10 -15,0 Z',
    xiandanhuang: 'M0,-12 A12,12 0 1,1 0,12 A12,12 0 1,1 0,-12 Z',
    guihua:       'M0,-14 L4,-4 L14,0 L4,4 L0,14 L-4,4 L-14,0 L-4,-4 Z'
  };

  function drawMoon(canvas, code) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.42;
    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = D.palette.moon;
    ctx.fill();
    ctx.lineWidth = 1.5;                                       // §8.3 工笔描边
    ctx.strokeStyle = D.palette.ink;
    ctx.stroke();

    var band = MOON_COVER[code] || 0;
    if (band > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = D.palette.paper;                         // 米纸底作云
      var y = cy + r - band * 2 * r;
      ctx.fillRect(cx - r, y, r * 2, band * 2 * r);
      ctx.restore();
    }
    // An element that was display:none has no prior computed style, so the
    // one-shot fade needs the pre-reveal opacity resolved before the class lands.
    void canvas.offsetWidth;
    canvas.classList.add('is-revealing');                      // §8.4 唯一长动效
  }

  function drawCakePattern(pathEl, filling) {
    pathEl.setAttribute('d', CAKE_PATH[filling] || CAKE_PATH.dousha);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', D.palette.cinnabar);         // sanctioned position 1
    pathEl.setAttribute('stroke-width', '1.5');
  }

  function tintLanterns(root) {
    var lamps = root.querySelectorAll('.lantern.is-on'), i;
    for (i = 0; i < lamps.length; i++) {
      lamps[i].style.background = D.palette.lantern;           // V-20 单色暖黄
      lamps[i].style.borderColor = D.palette.ink;
    }
  }

  // §8.3 细微噪点: deterministic arithmetic checker jitter (V-3: no stochastic source), built once
  // at boot rather than per frame, so §8.4's no-frame-loop guard stays intact.
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

  // The scaffold ships seven sibling rows; the drawer needs six top-level rows
  // with 制饼 owning its two variants, so the two locked ids move into a group.
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
      if (ev.target.closest('.craft-branch') || ev.target.closest('.craft-fillings')) {
        return;
      }
      expand(craft);
    });
    tap('row-shishi', function () { window.YueYan.Main.schedule({ type: 'shishi' }); });
    tap('row-xiexin', function () { window.YueYan.Main.schedule({ type: 'xiexin' }); });
    tap('row-beiyan', function () { window.YueYan.Main.schedule({ type: 'beiyan' }); });
    tap('row-buzhi', function () { window.YueYan.Main.schedule({ type: 'buzhi' }); });
    tap('row-daizuo', function () { renderFillings(window.YueYan.Main.state()); });
    tap('row-shouzuo', function () { window.YueYan.Main.enterCraft(); });
    tap('buy-putong', function () {
      window.YueYan.Main.schedule({ type: 'buy', item: 'putong' }); });
    tap('buy-haoliao', function () {
      window.YueYan.Main.schedule({ type: 'buy', item: 'haoliao' }); });
    tap('buy-xiandanhuang', function () {
      window.YueYan.Main.schedule({ type: 'buy', item: 'xiandanhuang' }); });
    tap('buy-guihua', function () {
      window.YueYan.Main.schedule({ type: 'buy', item: 'guihua' }); });
    fillings.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-filling]');
      if (!btn) { return; }
      window.YueYan.Main.schedule({
        type: 'daizuo', filling: btn.getAttribute('data-filling')
      });
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
      startStep(window.YueYan.Main.state(), choice.filling, choice.batch);
    });
    tap('btn-step-confirm', function () {
      var done = confirmStep(liveOffset());
      if (done) { window.YueYan.Main.finishCraft(done); }
    });
    tap('btn-craft-abort', function () { window.YueYan.Main.abortCraft(); });
    STEP_CONTROLS.forEach(bindDrag);

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
    tap('btn-open-feast', function () {
      if (finaleState) { renderEnding(finaleState); }
    });
    tap('btn-share', function () {
      // share.js 与 save.js 都在 scene.js 之后加载，故只在点击时解析。
      var Share = window.YueYan.Share;
      if (finaleState && Share && typeof Share.build === 'function') {
        Share.publish(Share.build(finaleState));                 // §9.1 终局才生成
        recordEnding(E.ending(finaleState));                     // X-8 重复分享不重复记录
      }
    });
  }

  window.YueYan.Scene = {
    renderIntro: renderIntro,
    renderSchedule: renderSchedule,
    reasonFor: reasonFor,
    renderFillings: renderFillings,
    slotLabel: slotLabel,
    renderCraft: renderCraft,
    startStep: startStep,
    confirmStep: confirmStep,
    abortCraft: abortCraft,
    injectStep: injectStep,
    liveOffset: liveOffset,
    renderAssign: renderAssign,
    confirmAssign: confirmAssign,
    currentPick: function () { return pick; },                   // §10.3.1 只暴露既有 pick，非第二真相源
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
