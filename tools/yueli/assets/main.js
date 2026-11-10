/**
 * 月历 · 交互与渲染
 */
(function (global) {
  'use strict';

  var D = global.D;
  var Cycle = global.Cycle;
  var Store = global.Store;

  var state = {
    data: null,
    today: null,
    month: null,
    stats: null,
    revealed: false,
    setup: { date: '', period: 5, cycle: 28 }
  };

  var sheetCtx = { type: '', day: '', epStart: '', period: 5, cycle: 28, confirmClear: false };
  var dom = {};
  var toastTimer = null;
  var pressTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function show(el) {
    el.hidden = false;
  }

  function hide(el) {
    el.hidden = true;
  }

  function toast(text) {
    var t = dom.toast;
    t.textContent = text;
    t.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove('is-show');
    }, 1600);
  }

  function privacyHidden() {
    return !!state.data.settings.privacy && !state.revealed;
  }

  /* ================= 启动 ================= */

  function boot() {
    dom.setupView = $('view-setup');
    dom.mainView = $('view-main');
    dom.setupDate = $('setup-date');
    dom.setupPeriod = $('setup-period');
    dom.setupCycle = $('setup-cycle');
    dom.predKicker = $('pred-kicker');
    dom.predDate = $('pred-date');
    dom.predNote = $('pred-note');
    dom.calTitle = $('cal-title');
    dom.calGrid = $('cal-grid');
    dom.statusLine = $('status-line');
    dom.sheet = $('sheet');
    dom.sheetMask = $('sheet-mask');
    dom.sheetTitle = $('sheet-title');
    dom.sheetBody = $('sheet-body');
    dom.toast = $('toast');

    state.today = D.today();

    Store.load(function (data) {
      state.data = data || Store.blank();
      state.month = D.monthOf(state.today);
      bindOnce();
      if (!state.data.episodes.length) {
        openSetup();
      } else {
        openMain();
      }
    });
  }

  /* ================= 首次录入 ================= */

  function openSetup() {
    state.setup.period = state.data.settings.periodLen;
    state.setup.cycle = state.data.settings.cycleLen;
    state.setup.date = state.today;

    dom.setupDate.value = state.today;
    dom.setupDate.max = state.today;
    dom.setupPeriod.textContent = state.setup.period;
    dom.setupCycle.textContent = state.setup.cycle;

    show(dom.setupView);
    hide(dom.mainView);
  }

  function bindSetup() {
    dom.setupView.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.step-btn') : null;
      if (!btn) return;
      var delta = parseInt(btn.getAttribute('data-delta'), 10);
      var which = btn.getAttribute('data-step');
      if (which === 'period') {
        state.setup.period = Math.min(14, Math.max(1, state.setup.period + delta));
        dom.setupPeriod.textContent = state.setup.period;
      } else {
        state.setup.cycle = Math.min(60, Math.max(18, state.setup.cycle + delta));
        dom.setupCycle.textContent = state.setup.cycle;
      }
    });

    $('setup-submit').addEventListener('click', function () {
      var value = dom.setupDate.value;
      if (!D.isValid(value)) {
        toast('请先选择日期');
        return;
      }
      if (value > state.today) {
        toast('日期不能是未来');
        return;
      }
      var episode = { s: value, e: D.addDays(value, state.setup.period - 1) };
      state.data.episodes = Cycle.normalize(state.data.episodes.concat([episode]));
      state.data.settings.periodLen = state.setup.period;
      state.data.settings.cycleLen = state.setup.cycle;
      persist(function () {
        hide(dom.setupView);
        openMain();
      });
    });
  }

  /* ================= 主界面 ================= */

  function openMain() {
    hide(dom.setupView);
    show(dom.mainView);
    state.month = D.monthOf(state.today);
    render();
  }

  function persist(then) {
    Store.save(state.data, function (ok) {
      if (!ok) toast('保存失败，请重试');
      if (then) then();
    });
  }

  function render() {
    state.stats = Cycle.analyze(state.data.episodes, state.today, state.data.settings);
    renderPrediction();
    renderCalendar();
    renderStatus();
  }

  function renderPrediction() {
    var s = state.stats;
    if (!s.count) {
      dom.predKicker.textContent = '下次预计';
      dom.predDate.textContent = '—';
      dom.predNote.textContent = '还没有记录';
      return;
    }

    dom.predKicker.textContent = '下次预计';
    dom.predDate.textContent = D.mdLabel(s.nextStart);

    if (s.state === 'late') {
      dom.predNote.textContent = '已过 ' + s.lateDays + ' 天，可能只是这一轮波动';
      return;
    }
    if (s.state === 'due') {
      dom.predNote.textContent = '就在这几天，前后 ' + s.uncertainty + ' 天';
      return;
    }
    if (s.confidence === 'declared') {
      dom.predNote.textContent = '按你填写的 ' + s.avgCycle + ' 天估算';
      return;
    }
    if (s.confidence === 'rough') {
      dom.predNote.textContent = '前后 ' + s.uncertainty + ' 天 · 再记 ' + (3 - s.gapsUsed) + ' 次会更准';
      return;
    }
    dom.predNote.textContent = '前后 ' + s.uncertainty + ' 天 · 近 ' + s.gapsUsed + ' 次平均 ' + s.avgCycle + ' 天';
  }

  function renderCalendar() {
    dom.calTitle.textContent = D.monthLabel(state.month);

    var lead = D.weekday(state.month);
    var total = D.daysInMonth(state.month);
    var hidden = privacyHidden();
    var html = '';
    var i;

    for (i = 0; i < lead; i++) {
      html += '<div class="cal-cell is-blank"><span class="cal-day"></span></div>';
    }

    for (i = 1; i <= total; i++) {
      var day = D.addDays(state.month, i - 1);
      var cls = 'cal-cell';
      var dcls = 'cal-day';

      if (!hidden) {
        if (Cycle.episodeAt(day, state.stats.episodes)) {
          dcls += ' is-period';
        } else if (Cycle.isPredicted(day, state.stats)) {
          dcls += ' is-pred';
        }
      }
      if (day === state.today) cls += ' is-today';

      html += '<div class="' + cls + '" data-day="' + day + '">' +
        '<span class="' + dcls + '">' + i + '</span></div>';
    }

    dom.calGrid.innerHTML = html;
  }

  function renderStatus() {
    var s = state.stats;
    var text;

    if (privacyHidden()) {
      text = '记录已隐藏 · 长按月份可显示';
    } else if (!s.count) {
      text = '点下面的按钮记一笔';
    } else if (s.state === 'period') {
      text = '经期第 ' + s.periodDay + ' 天 · 通常持续 ' + s.avgPeriod + ' 天';
    } else if (s.state === 'waiting') {
      text = '距下次还有 ' + s.daysToNext + ' 天';
    } else if (s.state === 'due') {
      text = '这几天可能会来';
    } else {
      text = '比预计晚了 ' + s.lateDays + ' 天';
    }

    dom.statusLine.textContent = text;
  }

  /* ================= 底部面板 ================= */

  function openSheet(title, bodyHtml) {
    dom.sheetTitle.textContent = title;
    dom.sheetBody.innerHTML = bodyHtml;
    dom.sheet.classList.remove('is-hidden');
  }

  function closeSheet() {
    dom.sheet.classList.add('is-hidden');
    sheetCtx.type = '';
    sheetCtx.confirmClear = false;
  }

  function stepperHtml(name, value) {
    return '<div class="stepper">' +
      '<button class="step-btn" type="button" data-step="' + name + '" data-delta="-1">−</button>' +
      '<span class="step-val" data-val="' + name + '">' + value + '</span>' +
      '<button class="step-btn" type="button" data-step="' + name + '" data-delta="1">＋</button>' +
      '</div>';
  }

  function openDaySheet(day) {
    var source = state.stats ? state.stats.episodes : state.data.episodes;
    var episode = Cycle.episodeAt(day, source);

    if (episode) {
      var span = D.diffDays(episode.e, episode.s) + 1;
      sheetCtx.type = 'existing';
      sheetCtx.day = day;
      sheetCtx.epStart = episode.s;
      sheetCtx.period = span;
      openSheet(D.mdLabel(episode.s) + ' 起',
        '<p class="sheet-sub">这一次：' + D.mdLabel(episode.s) + ' – ' + D.mdLabel(episode.e) +
        '，共 ' + span + ' 天</p>' +
        '<div class="field">' +
        '<p class="field-label">持续几天</p>' +
        stepperHtml('period', span) +
        '</div>' +
        '<div class="sheet-actions">' +
        '<button class="sheet-btn is-primary" type="button" data-act="update">保存</button>' +
        '<button class="sheet-btn is-danger" type="button" data-act="delete">删除这一次</button>' +
        '<button class="sheet-btn" type="button" data-act="close">取消</button>' +
        '</div>');
      return;
    }

    sheetCtx.type = 'create';
    sheetCtx.day = day;
    sheetCtx.period = state.data.settings.periodLen;
    openSheet(D.mdLabel(day),
      '<p class="sheet-sub">从这天开始记一次经期</p>' +
      '<div class="field">' +
      '<p class="field-label">持续几天</p>' +
      stepperHtml('period', sheetCtx.period) +
      '</div>' +
      '<div class="sheet-actions">' +
      '<button class="sheet-btn is-primary" type="button" data-act="create">确认</button>' +
      '<button class="sheet-btn" type="button" data-act="close">取消</button>' +
      '</div>');
  }

  function openSettingsSheet() {
    sheetCtx.type = 'settings';
    sheetCtx.cycle = state.data.settings.cycleLen;
    sheetCtx.period = state.data.settings.periodLen;
    sheetCtx.confirmClear = false;

    openSheet('设置',
      '<div class="sheet-row">' +
      '<div><p class="sheet-row-label">两次之间一般隔几天</p>' +
      '<p class="sheet-row-note">只在历史不足时用于估算</p></div>' +
      stepperHtml('cycle', sheetCtx.cycle) +
      '</div>' +
      '<div class="sheet-row">' +
      '<div><p class="sheet-row-label">默认经期天数</p>' +
      '<p class="sheet-row-note">新建记录时的预设</p></div>' +
      stepperHtml('period', sheetCtx.period) +
      '</div>' +
      '<div class="sheet-row">' +
      '<div><p class="sheet-row-label">隐私模式</p>' +
      '<p class="sheet-row-note">打开后日历不显示标记，长按月份可临时显示</p></div>' +
      '<button class="switch' + (state.data.settings.privacy ? ' is-on' : '') +
      '" type="button" data-act="privacy" aria-label="隐私模式"></button>' +
      '</div>' +
      '<div class="sheet-actions is-gap">' +
      '<button class="sheet-btn is-danger" type="button" data-act="clear">清除所有数据</button>' +
      '<button class="sheet-btn" type="button" data-act="close">关闭</button>' +
      '</div>');
  }

  function refreshSteppers() {
    var vals = dom.sheetBody.querySelectorAll('.step-val');
    var i;
    for (i = 0; i < vals.length; i++) {
      var name = vals[i].getAttribute('data-val');
      vals[i].textContent = name === 'cycle' ? sheetCtx.cycle : sheetCtx.period;
    }
  }

  function bindSheet() {
    dom.sheetMask.addEventListener('click', closeSheet);

    dom.sheetBody.addEventListener('click', function (e) {
      var stepBtn = e.target.closest ? e.target.closest('.step-btn') : null;
      if (stepBtn) {
        var delta = parseInt(stepBtn.getAttribute('data-delta'), 10);
        var which = stepBtn.getAttribute('data-step');
        if (which === 'cycle') {
          sheetCtx.cycle = Math.min(60, Math.max(18, sheetCtx.cycle + delta));
        } else {
          sheetCtx.period = Math.min(14, Math.max(1, sheetCtx.period + delta));
        }
        refreshSteppers();
        return;
      }

      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');

      if (act === 'close') {
        closeSheet();
      } else if (act === 'create') {
        var episode = { s: sheetCtx.day, e: D.addDays(sheetCtx.day, sheetCtx.period - 1) };
        state.data.episodes = Cycle.normalize(state.data.episodes.concat([episode]));
        state.data.settings.periodLen = sheetCtx.period;
        persist(function () {
          closeSheet();
          render();
          toast('已记下');
        });
      } else if (act === 'update') {
        var startAt = sheetCtx.epStart;
        var list = [];
        var j;
        for (j = 0; j < state.data.episodes.length; j++) {
          var item = state.data.episodes[j];
          if (item.s === startAt) {
            list.push({ s: item.s, e: D.addDays(item.s, sheetCtx.period - 1) });
          } else {
            list.push(item);
          }
        }
        state.data.episodes = Cycle.normalize(list);
        persist(function () {
          closeSheet();
          render();
          toast('已更新');
        });
      } else if (act === 'delete') {
        var kept = [];
        var i;
        for (i = 0; i < state.data.episodes.length; i++) {
          if (state.data.episodes[i].s !== sheetCtx.epStart) {
            kept.push(state.data.episodes[i]);
          }
        }
        state.data.episodes = kept;
        persist(function () {
          closeSheet();
          render();
          toast('已删除');
        });
      } else if (act === 'privacy') {
        state.data.settings.privacy = !state.data.settings.privacy;
        state.revealed = false;
        btn.classList.toggle('is-on');
        persist(function () {
          render();
        });
      } else if (act === 'clear') {
        if (!sheetCtx.confirmClear) {
          sheetCtx.confirmClear = true;
          btn.textContent = '再点一次，确认清除';
          return;
        }
        Store.clear(function () {
          state.data = Store.blank();
          closeSheet();
          render();
          openSetup();
          toast('已清除');
        });
      }
    });
  }

  /* ================= 事件 ================= */

  function bindOnce() {
    bindSetup();
    bindSheet();

    $('cal-prev').addEventListener('click', function () {
      state.month = D.addMonths(state.month, -1);
      renderCalendar();
    });

    $('cal-next').addEventListener('click', function () {
      state.month = D.addMonths(state.month, 1);
      renderCalendar();
    });

    dom.calGrid.addEventListener('click', function (e) {
      var cell = e.target.closest ? e.target.closest('.cal-cell') : null;
      if (!cell) return;
      var day = cell.getAttribute('data-day');
      if (!day) return;
      openDaySheet(day);
    });

    $('btn-record').addEventListener('click', function () {
      openDaySheet(state.today);
    });

    $('btn-settings').addEventListener('click', function () {
      openSettingsSheet();
    });

    // 隐私模式：长按月份标题临时显示
    function clearPress() {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    }

    function startPress() {
      clearPress();
      pressTimer = setTimeout(function () {
        pressTimer = null;
        if (state.data.settings.privacy) {
          state.revealed = true;
          render();
          toast('已临时显示，离开后自动隐藏');
        }
      }, 600);
    }

    var title = dom.calTitle;
    title.addEventListener('touchstart', startPress);
    title.addEventListener('touchend', clearPress);
    title.addEventListener('touchmove', clearPress);
    title.addEventListener('touchcancel', clearPress);
    title.addEventListener('mousedown', startPress);
    title.addEventListener('mouseup', clearPress);
    title.addEventListener('mouseleave', clearPress);
    title.addEventListener('click', function () {
      if (privacyHidden()) toast('长按月份可显示记录');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
