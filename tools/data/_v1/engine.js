/* 场景框架。每幕自己 build，引擎只管外壳、推进和重置。
   兼容 Chrome 61：不用箭头函数、模板字符串、let/const、flex gap。 */

(function () {
  'use strict';

  var SCENES = window.SCENES || [];
  var app = document.getElementById('app');
  var idx = 0;
  var unlocked = false;

  var shell = null;
  var bodyEl = null;
  var kickEl = null;
  var titleEl = null;
  var subEl = null;
  var nextEl = null;
  var hintEl = null;

  function applyUnit() {
    var w = app.clientWidth || window.innerWidth || 390;
    document.documentElement.style.setProperty('--u', w / 100 + 'px');
  }

  function buildShell() {
    app.innerHTML = '';
    shell = document.createElement('div');
    shell.className = 'screen';
    shell.innerHTML =
      '<header class="hd">' +
      '<p class="kicker" id="k"></p>' +
      '<h1 class="title" id="t"></h1>' +
      '<p class="sub" id="s"></p>' +
      '</header>' +
      '<main class="body" id="b"></main>' +
      '<footer class="ft">' +
      '<button class="btn" id="n" type="button"></button>' +
      '<p class="hint" id="h"></p>' +
      '</footer>';
    app.appendChild(shell);

    kickEl = document.getElementById('k');
    titleEl = document.getElementById('t');
    subEl = document.getElementById('s');
    bodyEl = document.getElementById('b');
    nextEl = document.getElementById('n');
    hintEl = document.getElementById('h');

    nextEl.addEventListener('click', function () {
      if (nextEl.disabled) return;
      /* 最后一幕的按钮是「再看一遍」 */
      if (idx >= SCENES.length - 1) {
        go(0);
        return;
      }
      go(idx + 1);
    });
  }

  var api = {
    done: function () {
      if (unlocked) return;
      unlocked = true;
      nextEl.disabled = false;
    },
    lock: function () {
      unlocked = false;
      nextEl.disabled = true;
    },
    hint: function (txt) {
      hintEl.textContent = txt || '';
    },
    label: function (txt) {
      nextEl.textContent = txt;
    },
    body: function () {
      return bodyEl;
    },
    /* 场景内部换一个小节，不用重建外壳 */
    clear: function () {
      bodyEl.innerHTML = '';
      bodyEl.scrollTop = 0;
      return bodyEl;
    },
    restart: function () {
      render();
    }
  };

  function render() {
    var sc = SCENES[idx];
    if (!sc) return;
    unlocked = false;
    nextEl.disabled = true;
    nextEl.textContent = sc.next || '继续';
    hintEl.textContent = '';

    kickEl.textContent = sc.tag || '';
    titleEl.innerHTML = sc.title || '';
    if (sc.sub) {
      subEl.textContent = sc.sub;
      subEl.style.display = '';
    } else {
      subEl.textContent = '';
      subEl.style.display = 'none';
    }

    bodyEl.innerHTML = '';
    bodyEl.scrollTop = 0;
    sc.build(bodyEl, api);
  }

  function go(n) {
    if (n < 0 || n >= SCENES.length) return;
    idx = n;
    render();
  }

  window.DATA = {
    go: go,
    total: function () {
      return SCENES.length;
    },
    unit: function () {
      return parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--u')
      ) || 3.9;
    }
  };

  window.addEventListener('resize', applyUnit);
  window.addEventListener('orientationchange', function () {
    window.setTimeout(applyUnit, 120);
  });

  applyUnit();
  buildShell();

  /* ?s=N 直达第 N 幕（1 起），出图和排查用 */
  var m = /[?&]s=(\d+)/.exec(window.location.search || '');
  if (m) {
    var n = parseInt(m[1], 10) - 1;
    if (n >= 0 && n < SCENES.length) idx = n;
  }
  render();
})();
