(function () {
  'use strict';
  window.YueYan = window.YueYan || {};
  var D = window.YueYan.Data;

  // ---------------------------------------------------------------- helpers
  function fail(msg) { throw new Error('[yueyan] ' + msg); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clampHeart(v) { return Math.max(0, Math.min(D.heartCap, v)); }

  function stockSum(state) {
    var s = state.stock, t = 0, k;
    for (k in s) { if (s.hasOwnProperty(k)) { t += s[k]; } }
    return t;
  }

  function banquetCap(state) {
    return state.flags.guihuaWine ? D.banquetCapWithWine : D.banquetCapNoGuihua;
  }

  // The fifth banquet item is 桂花酒 (§3.2.2). Lighting it raises the cap from 4
  // to 5, so the cap check has to read the *prospective* cap: a route holding one
  // 桂花 must be able to reach banquet 5, while a route holding none is refused at
  // exactly the fifth 备宴. Reading banquetCap(state) alone would refuse both.
  function wineReady(state) {
    return state.banquet === D.banquetCapNoGuihua
        && state.stock.guihua >= D.actions.beiyan.guihuaOnFifth;
  }

  function effectiveBanquetCap(state) {
    return (state.flags.guihuaWine || wineReady(state))
      ? D.banquetCapWithWine : D.banquetCapNoGuihua;
  }

  function inWindow(day, w) { return day >= w.from && day <= w.to; }

  function unlockOk(type, day) {
    var u = D.unlocks[type];
    return u === undefined || day >= u;
  }

  // ------------------------------------------------------------------ state
  function initialState() {
    var family = {}, k;
    for (k in D.family) { family[k] = D.family[k].heart; }
    return {
      version: D.version,
      day: 1,
      slotsUsed: 0,
      silver: D.initial.silver,
      stock: { putong: D.initial.putong, haoliao: 0, xiandanhuang: 0, guihua: 0 },
      pendingEgg: [],
      cakes: [],
      patterns: 0,
      banquet: 0,
      ambience: 0,
      family: family,
      flags: { xieXin: false, congRong: false, guihuaWine: false },
      assignment: { grandma: null, father: null, mother: null,
                    younger: null, brother: null }
    };
  }

  // ------------------------------------------------------------ cost / caps
  function craftCost(filling, batch) {
    var f = D.fillings[filling];
    if (!f) { fail('unknown filling ' + filling); }
    var cost = {}, k;
    for (k in f.cost) { cost[k] = f.cost[k]; }
    if (batch === 'premium') {
      cost.haoliao = (cost.haoliao || 0) + D.premiumCost.haoliao;
    }
    return cost;
  }

  function afford(state, cost) {
    var k;
    for (k in cost) { if ((state.stock[k] || 0) < cost[k]) { return false; } }
    return true;
  }

  function deduct(state, cost) {
    var k;
    for (k in cost) {
      if ((state.stock[k] || 0) < cost[k]) { fail('insufficient ' + k); }
      state.stock[k] -= cost[k];
    }
  }

  function refund(state, cost) {
    var k;
    for (k in cost) { state.stock[k] += cost[k]; }
  }

  function fillingOk(state, filling) { return afford(state, craftCost(filling, 'normal')); }
  function batchOk(state, filling, batch) { return afford(state, craftCost(filling, batch)); }

  function buyOk(state, item, day) {
    var it = D.items[item];
    if (!it) { fail('unknown item ' + item); }
    if (D.gates[item] && !inWindow(day, D.gates[item])) { return false; }
    if (state.silver < it.silver) { return false; }
    var add = it.gain;
    if (it.order) { add = 1 + state.pendingEgg.length; }   // future arrivals count too
    if (stockSum(state) + add > D.stockCap) { return false; }
    return true;
  }

  // §4.4.1 双闸门：金 = 好料批次 ∧ P >= 3.60
  function gradeOf(batch, P) {
    if (batch === 'premium' && P >= D.grade.gold) { return 3; }
    if (P >= D.grade.silver) { return 2; }
    return D.grade.floor;
  }

  // ------------------------------------------------------- action executors
  function execBuy(s, act, day) {
    if (!buyOk(s, act.item, day)) { fail('buy rejected: ' + act.item + ' on D' + day); }
    var it = D.items[act.item];
    s.silver -= it.silver;
    if (it.order) { s.pendingEgg.push(day); } else { s.stock[act.item] += it.gain; }
  }

  function execShishi(s, day) {
    if (!unlockOk('shishi', day)) { fail('shishi locked on D' + day); }
    if (s.patterns >= D.actions.shishi.cap) { fail('patterns at cap 3'); }
    if (s.silver < D.actions.shishi.silver) { fail('insufficient silver'); }
    if (s.stock.putong < D.actions.shishi.putong) { fail('insufficient putong'); }
    s.silver -= D.actions.shishi.silver;
    s.stock.putong -= D.actions.shishi.putong;
    s.patterns += 1;
  }

  function execDaizuo(s, act, day, staged) {
    if (!unlockOk('daizuo', day)) { fail('daizuo locked on D' + day); }
    if (s.cakes.length + staged.length >= D.board.cakeCap) { fail('cakes at cap 5'); }
    if (s.silver < D.actions.daizuo.silver) { fail('insufficient silver'); }
    if (!fillingOk(s, act.filling)) { fail('filling unavailable: ' + act.filling); }
    s.silver -= D.actions.daizuo.silver;
    deduct(s, craftCost(act.filling, 'normal'));
    staged.push({ filling: act.filling, grade: D.actions.daizuo.grade,
                  method: 'daizuo', batch: null, P: null });
  }

  function execShouzuo(s, act, day, staged) {
    if (!unlockOk('shouzuo', day)) { fail('shouzuo locked on D' + day); }
    if (s.cakes.length + staged.length >= D.board.cakeCap) { fail('cakes at cap 5'); }
    if (act.batch !== 'normal' && act.batch !== 'premium') { fail('bad batch ' + act.batch); }
    if (!batchOk(s, act.filling, act.batch)) { fail('batch unavailable'); }
    if (typeof act.P !== 'number' || act.P < 0 || act.P > 4) { fail('bad P ' + act.P); }
    deduct(s, craftCost(act.filling, act.batch));
    staged.push({ filling: act.filling, grade: gradeOf(act.batch, act.P),
                  method: 'shouzuo', batch: act.batch, P: act.P });
  }

  function execXiexin(s, day) {
    if (!unlockOk('xiexin', day)) { fail('xiexin locked on D' + day); }
    if (s.flags.xieXin) { fail('letter already sent'); }
    if (s.silver < D.actions.xiexin.silver) { fail('insufficient silver'); }
    s.silver -= D.actions.xiexin.silver;
    s.flags.xieXin = true;
    s.family.brother = clampHeart(s.family.brother + D.letterBonus);
  }

  function execBeiyan(s, day) {
    if (!unlockOk('beiyan', day)) { fail('beiyan locked on D' + day); }
    var canWine = wineReady(s);
    if (s.banquet >= effectiveBanquetCap(s)) {
      fail('banquet at cap ' + effectiveBanquetCap(s));
    }
    if (s.silver < D.actions.beiyan.silver) { fail('insufficient silver'); }
    if (canWine) {                       // the fifth item consumes 桂花 1 (§3.2.2)
      s.stock.guihua -= D.actions.beiyan.guihuaOnFifth;
      s.flags.guihuaWine = true;
    }
    s.silver -= D.actions.beiyan.silver;
    s.banquet += 1;
  }

  function execBuzhi(s, day) {
    if (!unlockOk('buzhi', day)) { fail('buzhi locked on D' + day); }
    if (s.ambience >= D.actions.buzhi.ambienceCap) { fail('ambience at cap 40'); }
    if (s.silver < D.actions.buzhi.silver) { fail('insufficient silver'); }
    s.silver -= D.actions.buzhi.silver;
    s.ambience += D.actions.buzhi.ambienceGain;
  }

  function exec(s, act, staged) {
    var day = s.day;
    if (act.type === 'buy')     { execBuy(s, act, day); }
    else if (act.type === 'shishi')  { execShishi(s, day); }
    else if (act.type === 'daizuo')  { execDaizuo(s, act, day, staged); }
    else if (act.type === 'shouzuo') { execShouzuo(s, act, day, staged); }
    else if (act.type === 'xiexin')  { execXiexin(s, day); }
    else if (act.type === 'beiyan')  { execBeiyan(s, day); }
    else if (act.type === 'buzhi')   { execBuzhi(s, day); }
    else { fail('unknown action ' + act.type); }
  }

  // ------------------------------------------------------ day settlement §3.7
  function arriveEggs(s) {
    var keep = [], i, orderDay;
    for (i = 0; i < s.pendingEgg.length; i++) {
      orderDay = s.pendingEgg[i];
      if (orderDay + D.items.xiandanhuang.delayDays === s.day) {
        s.stock.xiandanhuang += 1;
      } else {
        keep.push(orderDay);
      }
    }
    s.pendingEgg = keep;
  }

  function applyDay(state, actions) {
    if (!actions || actions.length === undefined) { fail('actions must be an array'); }
    if (state.day > D.board.days) { fail('no actions after D7'); }
    var s = clone(state);
    var staged = [];
    var i;

    for (i = 0; i < actions.length; i++) {
      exec(s, actions[i], staged);
      s.slotsUsed += 1;
    }

    // step 1: validate the slot budget
    if (s.slotsUsed > D.board.slotsPerDay) { fail('slotsUsed ' + s.slotsUsed + ' > 3'); }

    // step 2: arrivals (order day + 2 == this day), before the day advance, so a
    // D1 order lands at the D3 settlement and is unusable by D3 crafts
    arriveEggs(s);

    // step 3: commit this day's cakes
    for (i = 0; i < staged.length; i++) {
      if (s.cakes.length >= D.board.cakeCap) { fail('cakes exceed 5'); }
      s.cakes.push(staged[i]);
    }

    // step 4: clamp banquet / ambience. The banquet cap is dynamic (V-24)
    s.banquet = Math.min(s.banquet, banquetCap(s));
    s.ambience = Math.min(s.ambience, D.actions.buzhi.ambienceCap);

    // step 5: meter preview. meters(state) is the single read path (§10.3.2),
    // so the engine caches nothing here.

    // step 6: advance the day, reset the slot counter
    s.day += 1;
    s.slotsUsed = 0;
    return s;
  }

  // §3.7 step 2 settles arrivals AFTER this day's actions, so a D1 order that
  // lands at the D3 settlement stays unusable by D3 crafts. A preview that ran
  // arriveEggs would offer an action the real settlement then refuses, so the
  // read path keeps the same order and leaves the day counter open.
  function applyDayPreview(state, actions) {
    if (!actions || actions.length === undefined) { fail('actions must be an array'); }
    if (state.day > D.board.days) { fail('no actions after D7'); }
    var s = clone(state);
    var staged = [];
    var i;

    for (i = 0; i < actions.length; i++) {
      exec(s, actions[i], staged);
      s.slotsUsed += 1;
    }
    if (s.slotsUsed > D.board.slotsPerDay) { fail('slotsUsed ' + s.slotsUsed + ' > 3'); }

    for (i = 0; i < staged.length; i++) {
      if (s.cakes.length >= D.board.cakeCap) { fail('cakes exceed 5'); }
      s.cakes.push(staged[i]);
    }
    s.banquet = Math.min(s.banquet, banquetCap(s));
    s.ambience = Math.min(s.ambience, D.actions.buzhi.ambienceCap);
    return s;
  }

  // ------------------------------------------------------------ craft path
  function tolOf(patterns, stepId) {
    var tol = D.tolBase;
    if (stepId === D.patternStepId) {                       // 纹样只增益 S3 (§4.3.2)
      tol = D.tolBase + D.tolPerPattern * patterns;
      if (tol > D.tolCap) { tol = D.tolCap; }
    }
    return tol;
  }

  function precision(d, tol) {
    if (tol <= 0) { return 0; }
    var v = 1 - d / tol;                                    // §4.3.1
    if (v < 0) { return 0; }
    if (v > 1) { return 1; }
    return v;
  }

  function beginCraft(state, spec) {
    var s = clone(state);
    if (s.day > D.board.days) { fail('no actions after D7'); }
    if (!unlockOk('shouzuo', s.day)) { fail('shouzuo locked on D' + s.day); }
    if (s.slotsUsed >= D.board.slotsPerDay) { fail('slots full'); }
    if (s.cakes.length >= D.board.cakeCap) { fail('cakes at cap 5'); }
    if (spec.batch !== 'normal' && spec.batch !== 'premium') { fail('bad batch ' + spec.batch); }
    if (!batchOk(s, spec.filling, spec.batch)) { fail('batch unavailable'); }
    deduct(s, craftCost(spec.filling, spec.batch));
    s.slotsUsed += 1;
    s.crafting = { filling: spec.filling, batch: spec.batch, step: 0 };
    return s;
  }

  // §4.6: abort is the only refund path
  function abortCraft(state) {
    var s = clone(state);
    if (!s.crafting) { fail('nothing to abort'); }
    refund(s, craftCost(s.crafting.filling, s.crafting.batch));
    s.slotsUsed -= 1;
    delete s.crafting;
    return s;
  }

  // §4.1 / I-7: finishing never refunds, even below the gold threshold
  function finishCraft(state, P) {
    var s = clone(state);
    if (!s.crafting) { fail('nothing to finish'); }
    if (s.cakes.length >= D.board.cakeCap) { fail('cakes at cap 5'); }
    if (typeof P !== 'number' || P < 0 || P > 4) { fail('bad P ' + P); }
    var filling = s.crafting.filling, batch = s.crafting.batch;
    delete s.crafting;
    s.cakes.push({ filling: filling, grade: gradeOf(batch, P),
                   method: 'shouzuo', batch: batch, P: P });
    return s;
  }

  // ------------------------------------------------------- UI availability
  function actionOk(state, act) {
    var day = state.day;
    if (act.type === 'buy')     { return buyOk(state, act.item, day); }
    if (act.type === 'shishi')  { return unlockOk('shishi', day)
                                    && state.patterns < D.actions.shishi.cap
                                    && state.silver >= D.actions.shishi.silver
                                    && state.stock.putong >= D.actions.shishi.putong; }
    if (act.type === 'daizuo')  { return unlockOk('daizuo', day)
                                    && state.cakes.length < D.board.cakeCap
                                    && state.silver >= D.actions.daizuo.silver
                                    && fillingOk(state, act.filling); }
    if (act.type === 'shouzuo') { return unlockOk('shouzuo', day)
                                    && state.cakes.length < D.board.cakeCap
                                    && batchOk(state, act.filling, act.batch || 'normal'); }
    if (act.type === 'xiexin')  { return unlockOk('xiexin', day)
                                    && !state.flags.xieXin
                                    && state.silver >= D.actions.xiexin.silver; }
    if (act.type === 'beiyan')  { return unlockOk('beiyan', day)
                                    && state.banquet < effectiveBanquetCap(state)
                                    && state.silver >= D.actions.beiyan.silver; }
    if (act.type === 'buzhi')   { return unlockOk('buzhi', day)
                                    && state.ambience < D.actions.buzhi.ambienceCap
                                    && state.silver >= D.actions.buzhi.silver; }
    return false;
  }

  // ------------------------------------------------- assignment, meters, end
  // §10.3.2 keeps A's only *counting* exit at meters(); the predicate itself is
  // exported so callers reuse it instead of re-deriving the §7.4 three conditions.
  function attends(state, key) {    if (key !== 'brother') { return true; }                 // 四位同城家人必到席 (§3.9)
    return state.flags.xieXin
        && state.cakes.length >= 1
        && state.assignment.brother !== null;               // §7.4 三条件缺一不可
  }

  function assignmentApplied(state) {                       // §6.6 derived from §10.2 fields
    var order = D.familyOrder, i, v;
    for (i = 0; i < order.length; i++) {
      v = state.assignment ? state.assignment[order[i]] : null;
      if (v !== null && v !== undefined) { return true; }
    }
    return false;
  }

  function applyAssignment(state, assignment) {
    var s = clone(state);
    var order = D.familyOrder, i, key, idx, seen = {};
    var already = assignmentApplied(state);                 // read before the write below

    for (i = 0; i < order.length; i++) {                    // §10.3.2 validation first
      key = order[i];
      idx = assignment ? assignment[key] : null;
      if (idx === null || idx === undefined) { continue; }
      if (typeof idx !== 'number' || idx < 0 || idx >= s.cakes.length) {
        fail('assignment index out of range: ' + key + ' = ' + idx);
      }
      if (seen[idx] === true) { fail('cake ' + idx + ' assigned to two people'); }
      seen[idx] = true;
    }

    for (i = 0; i < order.length; i++) {                    // write the schema field
      key = order[i];
      idx = assignment ? assignment[key] : null;
      s.assignment[key] = (idx === undefined) ? null : idx;
    }

    if (already !== true) {                                 // §6.6 bonus granted exactly once
      for (i = 0; i < order.length; i++) {                  // §7.3 preference bonus
        key = order[i];
        idx = s.assignment[key];
        if (idx === null) { continue; }
        var cake = s.cakes[idx];
        if (cake.filling !== D.family[key].pref) { continue; }
        var bonus = (cake.grade === 3) ? D.preferBonus.grade3
                  : (cake.grade >= 2 ? D.preferBonus.grade2 : 0);
        s.family[key] = clampHeart(s.family[key] + bonus);  // grade 3 does not stack (§3.9)
      }
    }
    return s;
  }

  function meters(state) {
    var i, key, order = D.familyOrder;
    var gradeSum = 0;
    for (i = 0; i < state.cakes.length; i++) { gradeSum += state.cakes[i].grade; }
    var Q = Math.round(gradeSum / D.meters.cakeDenominator * 100);   // denominator 15

    var B = state.banquet * D.meters.banquetItemValue + state.ambience;

    var heartSum = 0, A = 0;
    for (i = 0; i < order.length; i++) {
      key = order[i];
      if (attends(state, key)) { heartSum += state.family[key]; A += 1; }
    }
    var H = Math.round(heartSum / D.meters.heartDenominator * 100);  // denominator 500

    return { Q: Q, B: B, H: H, A: A };
  }

  // §6.3.1: each predicate negates its predecessors explicitly, so the five are
  // pairwise exclusive independent of evaluation order (I-5)
  function isE1(state) {
    var m = meters(state), t = D.endings.E1;
    return m.A === t.A && m.Q >= t.Q && m.B >= t.B && m.H >= t.H;
  }

  function isE2(state) {
    var m = meters(state), t = D.endings.E2;
    return !isE1(state) && m.B >= t.B && m.Q >= t.Q;
  }

  function isE3(state) {
    var m = meters(state), t = D.endings.E3;
    return !isE1(state) && !isE2(state) && m.H >= t.H && m.A === t.A;
  }

  function isE4(state) {
    var m = meters(state), t = D.endings.E4.threshold;
    return !isE1(state) && !isE2(state) && !isE3(state)
        && (m.Q >= t || m.B >= t || m.H >= t);
  }

  function isE5(state) {
    return !isE1(state) && !isE2(state) && !isE3(state) && !isE4(state);
  }

  function ending(state) {
    if (isE1(state)) { return 'E1'; }
    if (isE2(state)) { return 'E2'; }
    if (isE3(state)) { return 'E3'; }
    if (isE4(state)) { return 'E4'; }
    return 'E5';
  }

  // §10.3.2 locked order: D1..D7 -> validate/write assignment -> §7.3 bonus
  function runRoute(actionsByDay, assignment) {
    if (!actionsByDay || actionsByDay.length !== D.board.days) { fail('need 7 day arrays'); }
    var s = initialState(), i;
    for (i = 0; i < D.board.days; i++) {
      s = applyDay(s, actionsByDay[i] || []);
    }
    if (assignment) { s = applyAssignment(s, assignment); }
    return s;
  }

  window.YueYan.Engine = {
    // §10.3.2 hooks
    initialState: initialState,
    applyDay: applyDay,
    applyDayPreview: applyDayPreview,
    runRoute: runRoute,
    meters: meters,
    ending: ending,
    isE1: isE1, isE2: isE2, isE3: isE3, isE4: isE4, isE5: isE5,
    gradeOf: gradeOf,
    // internal helpers
    stockSum: stockSum,
    banquetCap: banquetCap,
    craftCost: craftCost,
    deduct: deduct,
    refund: refund,
    buyOk: buyOk,
    fillingOk: fillingOk,
    batchOk: batchOk,
    actionOk: actionOk,
    tolOf: tolOf,
    precision: precision,
    beginCraft: beginCraft,
    abortCraft: abortCraft,
    finishCraft: finishCraft,
    applyAssignment: applyAssignment,
    attends: attends
  };
})();
