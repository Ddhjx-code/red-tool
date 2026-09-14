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
    if (stockSum(state) + it.gain > D.stockCap) { return false; }
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
    s.stock[act.item] += it.gain;
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

    // step 2: commit this day's cakes
    for (i = 0; i < staged.length; i++) {
      if (s.cakes.length >= D.board.cakeCap) { fail('cakes exceed 5'); }
      s.cakes.push(staged[i]);
    }

    // step 3: clamp banquet / ambience. The banquet cap is dynamic (V-24)
    s.banquet = Math.min(s.banquet, banquetCap(s));
    s.ambience = Math.min(s.ambience, D.actions.buzhi.ambienceCap);

    // step 4: meter preview. meters(state) is the single read path (§10.3.2),
    // so the engine caches nothing here.

    // step 5: advance the day, reset the slot counter
    s.day += 1;
    s.slotsUsed = 0;
    return s;
  }

  // §10.3.2 read path: applyDay minus the day advance.
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

  // ------------------------------------------------------- micro layer §4.3
  // Pure, DOM-free, clock-free (§4.3.9 / §10.3.2): elapsed time is always a
  // parameter; the engine never reads a wall clock, the DOM, or a timer.

  // §4.8.2 deadline ladder: D3 → 40.0 … D7 → 22.0, shared by every session of a day
  function deadlineOf(day) {
    if (typeof day !== 'number' || day < D.unlocks.shouzuo || day > D.board.days) {
      fail('bad craft day ' + day);
    }
    var v = D.micro.deadlineBase - D.micro.deadlinePerDay * (day - D.unlocks.shouzuo);
    return v < D.micro.deadlineFloor ? D.micro.deadlineFloor : v;
  }

  // §4.7.1 A-4b: the 1/2/3/4 ladder survives verbatim; §4.8.1 clamps real order
  // qty to 1 (one cake per family member), so spawnOrders never uses 2/3/4.
  function qtyOf(m) {
    var ladder = D.micro.qtyLadder, i;
    for (i = 0; i < ladder.length; i++) {
      if (m < ladder[i][0]) { return ladder[i][1]; }
    }
    return 4;
  }

  function sessionCapOf(n) {
    if (n !== 1 && n !== 2) { fail('bad n ' + n); }
    return D.micro.sessionCap[n];
  }

  // §4.3.12: the pattern channel now widens the bake window, half-width capped 0.19
  function heatHalfWidth(patterns) {
    if (typeof patterns !== 'number' || patterns < 0 || patterns > D.micro.patternCap) {
      fail('bad patterns ' + patterns);
    }
    var w = D.micro.heatHalfBase + D.micro.heatHalfPerPattern * patterns;
    return w > D.micro.heatHalfCap ? D.micro.heatHalfCap : w;
  }

  // §4.3.2 heat scale: p4 = precision(|h − 0.70|, half-width), precision verbatim
  function p4Of(h, patterns) {
    return precision(Math.abs(h - D.micro.heatCenter), heatHalfWidth(patterns));
  }

  // §4.3.5 four states are labels over one formula, not four formulas
  function heatLabelOf(h, lit) {
    if (h >= D.micro.burntAt) { return '焦'; }
    if (h >= D.micro.goldenAt) { return '佳'; }
    return lit ? '在烘' : '生';
  }

  // §4.3.5: h = clamp(litElapsed / T_burn, 0, 1); litElapsed counts only lit time,
  // so a cold stove freezes h (§4.3.6). 从容模式 returns 0.70 regardless (§4.3.10).
  function heatAt(litElapsed, stoveId, congRong) {
    if (congRong === true) { return D.micro.congRongHeat; }
    var T = D.micro.burn[stoveId];
    if (T === undefined) { fail('unknown stove ' + stoveId); }
    if (typeof litElapsed !== 'number' || litElapsed < 0) { fail('bad litElapsed ' + litElapsed); }
    var h = litElapsed / T;
    if (h < 0) { return 0; }
    if (h > 1) { return 1; }
    return h;
  }

  // §4.3.6: fuel left since lighting; fire dies at 0 and never deletes a cake
  function fuelAt(elapsed) {
    if (typeof elapsed !== 'number' || elapsed < 0) { fail('bad elapsed ' + elapsed); }
    var f = D.micro.fuelSeconds - elapsed;
    return f > 0 ? f : 0;
  }

  // §4.9.2: path is a waypoint list [{x, y}]; the chef starts at path[0] when
  // elapsed = 0 and walks on at 104 CSS px/s. Output is integer (§4.3.9).
  function chefAt(elapsed, path) {
    if (typeof elapsed !== 'number' || elapsed < 0) { fail('bad elapsed ' + elapsed); }
    if (!path || path.length === undefined || path.length < 1) { fail('chefAt needs waypoints'); }
    var x = path[0].x, y = path[0].y;
    var budget = elapsed * D.micro.chefSpeed, i, dx, dy, dist;
    for (i = 1; i < path.length && budget > 0; i++) {
      dx = path[i].x - x; dy = path[i].y - y;
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= budget) { x = path[i].x; y = path[i].y; budget -= dist; }
      else { x += dx * budget / dist; y += dy * budget / dist; budget = 0; }
    }
    return { x: Math.round(x), y: Math.round(y) };
  }

  // §4.10.2 next-station resolver: eleven priority rules, proximity gate ignored,
  // deterministic. k = { stoves: { A, B }, carrying, board, wood, rackWork } where
  // each stove is { cake: null | { state }, lit }, carrying is null or { kind } with
  // kind ∈ bowl / raw / golden / burnt / wood, wood is the柴堆存量, and rackWork says
  // whether the rack still holds a filling the order needs. The last two keep the
  // hint off a pile that is empty and off a rack that has nothing left to give.
  function nextGuide(k) {
    if (!k || !k.stoves || !k.stoves.A || !k.stoves.B) { fail('nextGuide needs stove state'); }
    if (typeof k.wood !== 'number' || k.wood < 0) { fail('nextGuide needs wood'); }
    if (typeof k.rackWork !== 'boolean') { fail('nextGuide needs rackWork'); }
    var a = k.stoves.A, b = k.stoves.B, c = k.carrying || null;
    function hot(st) {
      return st.cake && (st.cake.state === 'golden' || st.cake.state === 'burnt');
    }
    if (hot(a)) { return 'stoveA'; }                        // 1 take beats everything
    if (hot(b)) { return 'stoveB'; }                        // 2
    if (c && (c.kind === 'golden' || c.kind === 'burnt')) { return 'plate'; }   // 3 serve
    if (c && c.kind === 'raw') {                            // 4 any empty stove, lit first
      if (!a.cake && a.lit) { return 'stoveA'; }
      if (!b.cake && b.lit) { return 'stoveB'; }
      if (!a.cake) { return 'stoveA'; }                     // 4b cold stove takes the cake
      if (!b.cake) { return 'stoveB'; }                     // (§4.3.6 冷灶放饼)
      return k.wood > 0 ? 'wood' : 'rack';                  // both busy: fuel, else rack
    }
    if (k.board && k.board.active) { return 'board'; }      // 5
    if (c && c.kind === 'bowl') { return 'board'; }         // 6
    if (c && c.kind === 'wood') {                           // 7 unlit stove, else rack
      if (!a.lit) { return 'stoveA'; }
      if (!b.lit) { return 'stoveB'; }
      return 'rack';
    }
    // 8 both stoves cold. A cake on a stove means that cake needs fire → the pile.
    // No cake yet means the bundle should wait: shape the cake first, then light, so
    // one 15.0 s bundle covers the whole bake instead of dying during the board work.
    if (!a.lit && !b.lit) { return (a.cake || b.cake) && k.wood > 0 ? 'wood' : 'rack'; }
    if (k.rackWork) { return 'rack'; }                      // 9 the order still needs a cake
    if (a.cake) { return 'stoveA'; }                        // 10 wait on the one live stove
    if (b.cake) { return 'stoveB'; }
    return 'rack';                                          // 11 fallback
  }

  // §7.3 preference bonus: hit ∧ grade 3 → +12 (overrides), hit ∧ grade 2 → +8,
  // bronze or miss → +0. The macro path in applyAssignment keeps its own copy.
  function preferBonus(filling, familyKey, grade) {
    var fam = D.family[familyKey];
    if (!fam) { fail('unknown family ' + familyKey); }
    if (filling !== fam.pref) { return 0; }
    if (grade === 3) { return D.preferBonus.grade3; }
    if (grade >= 2) { return D.preferBonus.grade2; }
    return 0;
  }

  // §4.8: orders are the five family members' requests. Deterministic pick:
  // members whose pref matches the session fillings first (in familyOrder), then
  // the rest of familyOrder — so one spec always yields one identical list (A-4c).
  function spawnOrders(spec) {
    if (!spec || (spec.n !== 1 && spec.n !== 2)) { fail('spawnOrders needs n 1 or 2'); }
    var chosen = [], i, j, key, dl = deadlineOf(spec.day);
    for (i = 0; i < spec.n; i++) {
      for (j = 0; j < D.familyOrder.length; j++) {
        key = D.familyOrder[j];
        if (D.family[key].pref === spec.fillings[i] && chosen.indexOf(key) < 0) {
          chosen.push(key);
          break;
        }
      }
    }
    for (j = 0; chosen.length < spec.n && j < D.familyOrder.length; j++) {
      key = D.familyOrder[j];
      if (chosen.indexOf(key) < 0) { chosen.push(key); }
    }
    var orders = [];
    for (i = 0; i < chosen.length; i++) {
      orders.push({ family: chosen[i], filling: D.family[chosen[i]].pref,
                    qty: 1, deadline: dl, state: 'open' });   // qty clamped to 1 (§4.8.1)
    }
    return orders;
  }

  var SIM_OPS = ['tap', 'wood', 'light', 'place', 'take', 'serve', 'end'];

  function simCheckSpec(spec) {
    if (!spec) { fail('craftSim needs a spec'); }
    if (spec.n !== 1 && spec.n !== 2) { fail('bad n ' + spec.n); }
    if (spec.batch !== 'normal' && spec.batch !== 'premium') { fail('bad batch ' + spec.batch); }
    if (!spec.fillings || spec.fillings.length !== spec.n) { fail('fillings must match n'); }
    var i;
    for (i = 0; i < spec.n; i++) {
      if (!D.fillings[spec.fillings[i]]) { fail('unknown filling ' + spec.fillings[i]); }
    }
    heatHalfWidth(spec.patterns);
    deadlineOf(spec.day);
  }

  // §4.3.9 craftSim: the short game's single numeric truth source.
  // spec = { batch, n, fillings, patterns, day, congRong }; timeline items are
  // { t, op, cake, step, d }, op ∈ tap|wood|light|place|take|serve|end,
  // cake ∈ 1..n (null for wood/light/end), t non-decreasing. Illegal input throws
  // (§10.3.2 contract); no save write, no state change — merging into state stays
  // with finishCraft(state, P), called once per cake.
  function craftSim(spec, timeline) {
    simCheckSpec(spec);
    if (!timeline || timeline.length === undefined) { fail('timeline must be an array'); }

    var congRong = spec.congRong === true;
    var n = spec.n;
    var cap = congRong ? null : sessionCapOf(n);             // §4.3.7 40 / 48 seconds
    var woodStock = D.micro.woodCap;
    var carriedWood = 0;
    var woodUsed = 0;
    var stoves = {
      A: { lit: false, expireAt: 0, cake: null },
      B: { lit: false, expireAt: 0, cake: null }
    };
    var cakes = [], i;
    for (i = 0; i < n; i++) {
      cakes.push({ index: i, filling: spec.fillings[i],
                   taps: { S1: 0, S2: 0, S3: 0 },
                   p: [null, null, null, null],
                   stove: null, tOn: null, tTake: null, tServe: null,
                   litElapsed: 0, taken: false, served: false, orderServed: false,
                   auto: false, h: null, litAtTake: false });
    }
    var orders = spawnOrders(spec);
    var now = 0;
    var endT = null;

    // Burn fuel and accrue litElapsed only while a stove is lit; fire-out freezes
    // h and never deletes the cake (§4.3.6). Open orders past their deadline
    // expire: the family leaves, no score penalty, no loss (§4.8).
    function advance(toT) {
      var dt = toT - now;
      if (dt < 0) { fail('timeline t must be non-decreasing'); }
      if (dt > 0) {
        var id, st, burning, oi;
        for (id in stoves) {
          if (!stoves.hasOwnProperty(id)) { continue; }
          st = stoves[id];
          if (!st.lit || st.cake === null || congRong) { continue; }   // 从容: no burn (§4.3.10)
          burning = st.expireAt - now;
          if (dt >= burning) {
            if (burning > 0) { cakes[st.cake].litElapsed += burning; }
            st.lit = false;
          } else {
            cakes[st.cake].litElapsed += dt;
          }
        }
        if (!congRong) {
          for (oi = 0; oi < orders.length; oi++) {
            if (orders[oi].state === 'open' && toT >= orders[oi].deadline) {
              orders[oi].state = 'expired';
            }
          }
        }
      }
      now = toT;
    }

    function cakeIdx(ev, op) {
      if (typeof ev.cake !== 'number' || ev.cake < 1 || ev.cake > n) {
        fail(op + ' needs cake 1..' + n);
      }
      return ev.cake - 1;
    }

    for (i = 0; i < timeline.length; i++) {
      var ev = timeline[i];
      if (!ev || SIM_OPS.indexOf(ev.op) < 0) { fail('unknown op ' + (ev ? ev.op : ev)); }
      if (typeof ev.t !== 'number' || ev.t < 0) { fail('bad t ' + ev.t); }
      if (ev.t < now) { fail('timeline t must be non-decreasing'); }
      if (cap !== null && ev.t > cap) { fail('op past session cap ' + cap); }

      if (ev.op === 'end') {                                 // rule 10: one end, last
        if (endT !== null) { fail('only one end'); }
        if (i !== timeline.length - 1) { fail('end must be last'); }
        advance(ev.t);
        endT = ev.t;
        break;
      }
      advance(ev.t);

      if (ev.op === 'tap') {
        var ck = cakes[cakeIdx(ev, 'tap')];
        var step = ev.step;
        if (step !== 'S1' && step !== 'S2' && step !== 'S3') { fail('bad step ' + step); }
        // fixed order S1 → S2 → S3, no skipping, no parallelism (§4.3.2)
        if (step === 'S2' && ck.taps.S1 < D.micro.tapsPerStep) { fail('S2 before S1 done'); }
        if (step === 'S3' && ck.taps.S2 < D.micro.tapsPerStep) { fail('S3 before S2 done'); }
        if (ck.taps[step] >= D.micro.tapsPerStep) { fail('step ' + step + ' already done'); }
        if (ev.d !== ck.taps[step] + 1) { fail('tap d must climb 1, 2, 3; got ' + ev.d); }
        ck.taps[step] = ev.d;
        if (ck.taps[step] === D.micro.tapsPerStep) {
          var si = step === 'S1' ? 0 : (step === 'S2' ? 1 : 2);
          // §4.3.7 anchor: cake 1 from session start, cake 2 from cake 1's t_on
          var anchor = ck.index === 0 ? 0 : (cakes[0].tOn === null ? 0 : cakes[0].tOn);
          ck.p[si] = (congRong || ev.t <= anchor + D.micro.stepCum[step]) ? 1 : 0;
        }
      } else if (ev.op === 'wood') {
        if (ev.cake !== null && ev.cake !== undefined) { fail('wood takes cake null'); }
        if (!congRong) {                                     // 从容: stock untouched (§4.3.10)
          if (woodStock <= 0) { fail('wood stock empty'); }  // rule 5
          woodStock -= 1;
          carriedWood += 1;
          woodUsed += 1;
        }
      } else if (ev.op === 'light') {
        var lid = ev.step;
        if (lid !== 'A' && lid !== 'B') { fail('light needs stove A|B'); }   // rule 6
        if (congRong) { stoves[lid].lit = true; }            // always lit, no fuel (§4.3.10)
        else {
          // rule 6's stock check reads through the carried bundle: every lighting
          // consumes one bundle taken from the pile (§4.3.6)
          if (carriedWood <= 0) { fail('light needs a bundle taken from the pile'); }
          carriedWood -= 1;
          stoves[lid].lit = true;
          stoves[lid].expireAt = ev.t + D.micro.fuelSeconds;
        }
      } else if (ev.op === 'place') {
        var pk = cakes[cakeIdx(ev, 'place')];
        var pid = ev.step;
        if (pid !== 'A' && pid !== 'B') { fail('place needs stove A|B'); }   // rule 7
        if (pk.taps.S3 < D.micro.tapsPerStep) { fail('place before S3 done'); }
        if (pk.stove !== null) { fail('cake already on a stove'); }
        if (stoves[pid].cake !== null) { fail('stove ' + pid + ' occupied'); }
        pk.stove = pid;
        pk.tOn = ev.t;
        pk.litElapsed = 0;
        stoves[pid].cake = pk.index;
      } else if (ev.op === 'take') {
        var tk = cakes[cakeIdx(ev, 'take')];
        if (tk.stove === null || tk.taken) { fail('take needs a placed, untaken cake'); }  // rule 8
        stoves[tk.stove].cake = null;
        tk.h = heatAt(tk.litElapsed, tk.stove, congRong);
        tk.litAtTake = stoves[tk.stove].lit || congRong;
        tk.taken = true;
        tk.tTake = ev.t;
        tk.p[3] = p4Of(tk.h, spec.patterns);
      } else if (ev.op === 'serve') {
        var sk = cakes[cakeIdx(ev, 'serve')];
        if (!sk.taken) { fail('serve needs a taken cake'); } // rule 9
        if (sk.served) { fail('cake already served'); }
        sk.served = true;
        sk.tServe = ev.t;
        // §4.8.5: a match lets the family take the cake; a mismatch wastes it but
        // it still ships and still lands in cakes[] — so a mismatch never throws
        var oj;
        for (oj = 0; oj < orders.length; oj++) {
          if (orders[oj].state === 'open' && orders[oj].filling === sk.filling) {
            orders[oj].state = 'served';
            sk.orderServed = true;
            break;
          }
        }
      }

      // trigger ① (§4.3.8): every cake shipped ends the session immediately;
      // only a trailing end marker at the same moment may follow
      var done = true, dj;
      for (dj = 0; dj < n; dj++) { if (!cakes[dj].served) { done = false; break; } }
      if (done) {
        var nxt = (i === timeline.length - 1) ? null : timeline[i + 1];
        if (nxt === null) { break; }
        if (timeline.length - i === 2 && nxt.op === 'end'
            && typeof nxt.t === 'number' && nxt.t >= ev.t
            && (cap === null || nxt.t <= cap)) {
          advance(nxt.t);
          endT = nxt.t;
          break;
        }
        fail('session ends when every cake is served');
      }
    }

    // T_end: earliest of the explicit end, the session cap, and trigger ① (§4.3.8)
    var servedAll = true, lastServe = 0;
    for (i = 0; i < n; i++) {
      if (!cakes[i].served) { servedAll = false; }
      else if (cakes[i].tServe > lastServe) { lastServe = cakes[i].tServe; }
    }
    var tEnd = cap === null ? Infinity : cap;
    if (endT !== null && endT < tEnd) { tEnd = endT; }
    if (servedAll && lastServe < tEnd) { tEnd = lastServe; }
    if (tEnd === Infinity) { fail('从容 session needs an end op or every cake served'); }
    advance(tEnd);

    // auto-finale (§4.3.8): every cake ships — the zero-failure theorem has no
    // delete branch. On-stove cakes come out at their current or frozen h; the
    // rest get their board steps completed at p = 0 and come out raw (h = 0).
    for (i = 0; i < n; i++) {
      var ak = cakes[i];
      if (ak.taken) { continue; }
      ak.auto = true;
      ak.tTake = tEnd;
      if (ak.stove !== null) {
        stoves[ak.stove].cake = null;
        ak.h = heatAt(ak.litElapsed, ak.stove, congRong);
        ak.litAtTake = stoves[ak.stove].lit || congRong;
      } else {
        var aj;
        for (aj = 0; aj < 3; aj++) { if (ak.p[aj] === null) { ak.p[aj] = 0; } }
        ak.tOn = tEnd;
        ak.h = heatAt(0, 'A', congRong);
        ak.litAtTake = false;
      }
      ak.p[3] = p4Of(ak.h, spec.patterns);
    }

    var out = [], oc, P;
    for (i = 0; i < n; i++) {
      oc = cakes[i];
      P = oc.p[0] + oc.p[1] + oc.p[2] + oc.p[3];
      out.push({ index: oc.index, filling: oc.filling, stove: oc.stove,
                 tOn: oc.tOn, tTake: oc.tTake, tServe: oc.tServe, auto: oc.auto,
                 p: oc.p, P: P, grade: gradeOf(spec.batch, P),
                 heatAtTake: oc.h, heatLabel: heatLabelOf(oc.h, oc.litAtTake),
                 orderServed: oc.orderServed });
    }
    return { n: n, endedAt: tEnd, woodUsed: woodUsed, cakes: out };
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
    // §4.3.9 / §10.3.2 micro-layer hooks (pure, DOM-free, clock-free)
    craftSim: craftSim,
    heatAt: heatAt,
    chefAt: chefAt,
    nextGuide: nextGuide,
    fuelAt: fuelAt,
    deadlineOf: deadlineOf,
    qtyOf: qtyOf,
    spawnOrders: spawnOrders,
    sessionCapOf: sessionCapOf,
    heatHalfWidth: heatHalfWidth,
    p4Of: p4Of,
    heatLabelOf: heatLabelOf,
    preferBonus: preferBonus,
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
    precision: precision,
    beginCraft: beginCraft,
    abortCraft: abortCraft,
    finishCraft: finishCraft,
    applyAssignment: applyAssignment,
    attends: attends
  };
})();
