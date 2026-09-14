(function () {
  'use strict';
  window.YueYan = window.YueYan || {};
  var D = window.YueYan.Data;
  var E = window.YueYan.Engine;
  var Save = window.YueYan.Save;

  var dayBase = null;
  var plan = [];

  // The day is still open, so the preview delegates to the engine's read path,
  // which commits exactly what §3.7's settlement will commit.
  function projected() {
    if (!plan.length) { return dayBase; }
    return E.applyDayPreview(dayBase, plan);
  }

  function paint() {
    var S = window.YueYan.Scene;
    S.renderSchedule(projected(), plan.slice());
    var undo = S.el('btn-undo-slot');
    if (undo) {
      if (plan.length) { undo.removeAttribute('disabled'); }
      else { undo.setAttribute('disabled', 'disabled'); }
    }
  }

  function resumeSchedule() {
    paint();
    window.YueYan.Scene.show('view-schedule');
    window.YueYan.Scene.closeSheet();
  }

  function start() {
    if (!dayBase) { dayBase = E.initialState(); }                // V-17 续局不重置进度
    dayBase.flags.congRong = window.YueYan.Scene.el('toggle-congrong').checked === true;
    plan = [];
    // §8.6: the one-shot narrative panel sits between the first screen and D1.
    if (window.YueYan.Scene.showPrologue(dayBase)) { return; }
    resumeSchedule();
  }

  function schedule(act) {
    if (!dayBase) { return false; }
    if (plan.length >= D.board.slotsPerDay) { return false; }
    if (!E.actionOk(projected(), act)) { return false; }
    plan.push(act);
    window.YueYan.Audio.play('slot');
    paint();
    window.YueYan.Scene.closeSheet();
    return true;
  }

  function undo() {
    if (!plan.length) { return false; }
    plan.pop();
    paint();
    return true;
  }

  // §3.8: the day boundary is the only save point.
  function finishDay() {
    if (!dayBase) { return null; }
    var settled = E.applyDay(dayBase, plan);
    dayBase = settled;
    plan = [];
    Save.writeProgress(settled);
    if (settled.day > D.board.days) {
      window.YueYan.Scene.renderAssign(settled);
      return settled;
    }
    paint();
    window.YueYan.Scene.closeSheet();
    return settled;
  }

  function enterCraft() {
    if (!dayBase) { return; }
    var S = window.YueYan.Scene;
    S.closeSheet();
    S.renderCraft(projected());
  }

  function startCraft(state, sel) {
    window.YueYan.Scene.enterKitchen(state, sel);
  }

  // §4.3.9：injectTimeline 的双出口结构——Scene 持有，Main 转发。
  function injectTimeline(actions) {
    return window.YueYan.Scene.injectTimeline(actions);
  }

  // The short game ran on a craft-local snapshot, so only its measured result
  // enters the day; the engine settles the real cost at the day boundary. A
  // concurrent session ships n cakes (§4.3.1), so every cake is scheduled.
  function finishCraft(done) {
    if (!dayBase || !done) { return false; }
    var i, ok = true;
    for (i = 0; i < done.cakes.length; i++) {
      var cake = done.cakes[i];
      if (!schedule({ type: 'shouzuo', filling: cake.filling,
                      batch: cake.batch, P: cake.P })) { ok = false; }
    }
    window.YueYan.Scene.show('view-schedule');
    paint();
    return ok;
  }

  function abortCraft() {
    window.YueYan.Scene.abortCraft();
    resumeSchedule();
    return true;
  }

  // §6.6 the deal is made once, and §6.2 the preview is a read-only ledger, so
  // Scene owns the settled finale state; Main only hands it over at day seven.
  // share.js 虽先于 main.js 加载，share 仍用 getter 在读取时解析，避免 Main 持有引用。
  function installFacade() {
    window.__yueyan = {
      state: projected,
      engine: E,
      data: D,
      save: Save,
      ready: true,
      craftStep: injectTimeline
    };
    Object.defineProperty(window.__yueyan, 'share', {
      enumerable: true,
      get: function () { return window.YueYan.Share; }
    });
    window.__ready = true;
  }

  function boot() {
    window.YueYan.Scene.buildDrawer();
    var saved = Save.readProgress();                             // V-17 §3.8 唯一存档点
    dayBase = saved || E.initialState();
    plan = [];
    window.YueYan.Scene.renderIntro(dayBase);
    if (saved && dayBase.day <= D.board.days) {                  // renderIntro 先写通用提示
      var hint = document.getElementById('intro-save-hint');
      if (hint) {
        hint.textContent = D.intro.saveHint + '（上次进行到第' + D.dates[dayBase.day - 1] + '日）';
      }
    }
    installFacade();
    // A D7 save records day 8, so resuming it must skip the schedule view and go
    // straight to the deal: renderSchedule on day 8 has no date and no legal action.
    if (dayBase.day > D.board.days) {                            // V-29 续局直达分饼
      window.YueYan.Scene.renderAssign(dayBase);
      return;
    }
    paint();
  }

  window.YueYan.Main = {
    state: projected,
    plan: function () { return plan.slice(); },
    start: start,
    resumeSchedule: resumeSchedule,
    schedule: schedule,
    undo: undo,
    finishDay: finishDay,
    enterCraft: enterCraft,
    startCraft: startCraft,
    injectTimeline: injectTimeline,
    finishCraft: finishCraft,
    abortCraft: abortCraft,
    boot: boot
  };

  boot();
})();
