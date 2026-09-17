(function () {
  'use strict';

  var LINES = [];

  function el(id) { return document.getElementById(id); }

  function row(dlId, key, value, cls) {
    var dl = el(dlId);
    if (!dl) { return; }
    var dt = document.createElement('dt');
    dt.textContent = key;
    var dd = document.createElement('dd');
    dd.textContent = String(value);
    if (cls) { dd.className = cls; }
    dl.appendChild(dt);
    dl.appendChild(dd);
    LINES.push(key + ': ' + value);
  }

  function head(text) {
    var h = document.createElement('div');
    h.textContent = '== ' + text + ' ==';
    LINES.push('');
    LINES.push('== ' + text + ' ==');
  }

  function safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback !== undefined ? fallback : ('ERR ' + (e && e.name ? e.name : e)); }
  }

  function metric() {
    var vv = window.visualViewport;
    var so = window.screen && window.screen.orientation;
    return {
      iw: window.innerWidth,
      ih: window.innerHeight,
      vw: vv ? Math.round(vv.width) : -1,
      vh: vv ? Math.round(vv.height) : -1,
      voTop: vv ? Math.round(vv.offsetTop) : -1,
      vvScale: vv ? vv.scale : -1,
      ow: so && so.type ? so.type : String(window.orientation),
      oa: so && typeof so.angle === 'number' ? so.angle : -1
    };
  }

  function shape(m) {
    if (m.iw === m.ih) { return '方形'; }
    return m.iw > m.ih ? '横向 (landscape)' : '纵向 (portrait)';
  }

  function paint(m) {
    el('verdict').textContent = shape(m);
    el('dims').textContent = m.iw + ' × ' + m.ih + '  @' + window.devicePixelRatio +
      '   ratio ' + (m.iw / m.ih).toFixed(3) + '   方向 ' + m.ow + ' / ' + m.oa + '°';
  }

  var FPS = -1;
  var seenLandscape = false;
  var rotChanges = 0;

  function summaryRows() {
    var m = metric();
    var ua = navigator.userAgent;
    var rows = [];
    rows.push(['屏幕方向', shape(m) + '  ' + m.iw + '×' + m.ih, 'ok']);
    rows.push(['支持横屏旋转',
      seenLandscape ? '是（已观测到横向）' : '未观测到（请横置手机 2 秒再确认）',
      seenLandscape ? 'ok' : 'warn']);
    rows.push(['旋转事件次数', String(rotChanges)]);
    rows.push(['内核', uaVersion(ua) + ' · ' + uaEngine(ua), 'warn']);
    rows.push(['安全区 上/下', safe(function () { return envInset('top'); }) + ' / ' + safe(function () { return envInset('bottom'); })]);
    rows.push(['安全区 左/右', safe(function () { return envInset('left'); }) + ' / ' + safe(function () { return envInset('right'); })]);
    var vib = typeof navigator.vibrate === 'function';
    rows.push(['触感反馈 vibrate', vib ? '可用' : '不可用', vib ? 'ok' : 'warn']);
    var ac = !!(window.AudioContext || window.webkitAudioContext);
    rows.push(['程序化音频', ac ? '可用' : '不可用', ac ? 'ok' : 'no']);
    rows.push(['渲染帧率', FPS < 0 ? '测量中…' : FPS + ' fps', FPS < 0 ? 'warn' : (FPS >= 50 ? 'ok' : 'warn')]);
    var mt = window.xhs && window.xhs.miniTool;
    rows.push(['端能力桥 miniTool', mt ? '可用（' + (Object.keys(mt).length) + ' 个 API）' : '不可用', mt ? 'ok' : 'warn']);
    return rows;
  }

  function renderSummary() {
    var dl = el('sec-summary');
    if (!dl) { return; }
    while (dl.firstChild) { dl.removeChild(dl.firstChild); }
    var rows = summaryRows();
    var i;
    for (i = 0; i < rows.length; i++) {
      var dt = document.createElement('dt');
      dt.textContent = rows[i][0];
      var dd = document.createElement('dd');
      dd.textContent = rows[i][1];
      if (rows[i][2]) { dd.className = rows[i][2]; }
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
  }

  var last = null;
  function logRotation(tag) {
    var m = metric();
    var key = m.iw + 'x' + m.ih + '|' + m.ow + '|' + m.oa;
    var changed = last !== null && key !== last;
    last = key;
    if (changed) { rotChanges++; }
    if (m.iw > m.ih) { seenLandscape = true; }
    paint(m);
    renderSummary();
    var li = document.createElement('li');
    li.textContent = '[' + tag + '] ' + m.iw + '×' + m.ih +
      '  vv ' + m.vw + '×' + m.vh +
      '  方向 ' + m.ow + '/' + m.oa + '°   屏幕 ' +
      (window.screen ? window.screen.width + '×' + window.screen.height : '?');
    if (changed) { li.className = 'changed'; }
    el('rotlog').appendChild(li);
    LINES.push('  ' + li.textContent);
    return changed;
  }

  function bindRotation() {
    var raf = 0;
    function onAny(tag) {
      if (raf) { return; }
      raf = window.requestAnimationFrame(function () { raf = 0; logRotation(tag); });
    }
    window.addEventListener('resize', function () { onAny('resize'); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { onAny('orientationchange'); }, 120); });
    if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) {
      window.screen.orientation.addEventListener('change', function () { onAny('screen.orientation'); });
    }
  }

  function uaVersion(ua) {
    var m = /Chrome\/(\d+)/.exec(ua);
    if (m) { return 'Chrome ' + m[1]; }
    m = /CriOS\/(\d+)/.exec(ua);
    if (m) { return 'Chrome iOS ' + m[1]; }
    m = /OS (\d+)_(\d+)/.exec(ua);
    if (m && /iPhone|iPad|iPod/.test(ua)) { return 'iOS ' + m[1] + '.' + m[2]; }
    m = /Android (\d+(?:\.\d+)?)/.exec(ua);
    if (m) { return 'Android ' + m[1]; }
    m = /Version\/(\d+(?:\.\d+)?).*Safari/.exec(ua);
    if (m) { return 'Safari ' + m[1]; }
    return '未知';
  }

  function uaEngine(ua) {
    if (/iPhone|iPad|iPod/.test(ua)) { return 'WebKit (iOS)'; }
    if (/Android/.test(ua)) {
      if (/; wv\)/.test(ua) || /Version\/\d+\.\d+ Chrome\//.test(ua)) { return 'WebView (Android)'; }
      return 'Chrome (Android)';
    }
    if (/(Headless)?Chrome\//.test(ua)) { return '桌面 Chromium'; }
    if (/AppleWebKit\//.test(ua) && /Version\//.test(ua)) { return 'Safari (桌面)'; }
    if (/AppleWebKit\//.test(ua)) { return 'AppleWebKit (未识别变体)'; }
    return '未知';
  }

  function envInset(side) {
    var probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.top = '0';
    probe.style.left = '0';
    probe.style.width = '1px';
    probe.style.height = '0';
    probe.style.paddingTop = 'env(safe-area-inset-' + side + ', 0px)';
    document.body.appendChild(probe);
    var v = window.getComputedStyle(probe).paddingTop;
    document.body.removeChild(probe);
    return v;
  }

  function cssVarInset(side) {
    var probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.paddingTop = 'var(--safe-area-inset-' + side + ', 0px)';
    document.body.appendChild(probe);
    var v = window.getComputedStyle(probe).paddingTop;
    document.body.removeChild(probe);
    return v;
  }

  function supportsFlexGap() {
    var flex = document.createElement('div');
    flex.style.position = 'absolute';
    flex.style.visibility = 'hidden';
    flex.style.display = 'flex';
    flex.style.flexDirection = 'column';
    flex.style.rowGap = '1px';
    flex.appendChild(document.createElement('div'));
    flex.appendChild(document.createElement('div'));
    document.body.appendChild(flex);
    var supported = flex.scrollHeight === 1;
    document.body.removeChild(flex);
    return supported;
  }

  function measureFps(cb) {
    var n = 0;
    var t0 = 0;
    function tick(t) {
      if (!t0) { t0 = t; }
      n++;
      if (t - t0 < 1000) { window.requestAnimationFrame(tick); return; }
      cb(Math.round((n * 1000) / (t - t0)));
    }
    window.requestAnimationFrame(tick);
  }

  function reportHost() {
    head('容器与宿主');
    var ua = navigator.userAgent;
    row('sec-host', 'userAgent', ua);
    row('sec-host', '内核版本', uaVersion(ua), 'warn');
    row('sec-host', '内核类型', uaEngine(ua), 'warn');
    var inFrame = safe(function () { return window.self !== window.top; });
    row('sec-host', '在 iframe 内', inFrame ? '是' : '否', inFrame ? 'warn' : 'ok');
    row('sec-host', 'devicePixelRatio', window.devicePixelRatio);
    row('sec-host', 'maxTouchPoints', navigator.maxTouchPoints);
    row('sec-host', 'standalone', safe(function () { return window.navigator.standalone ? '是' : '否'; }, '否'));

    var xhs = window.xhs;
    row('sec-host', 'window.xhs 存在', xhs ? '是' : '否', xhs ? 'ok' : 'no');
    row('sec-host', 'xhs 下的键', xhs ? (Object.keys(xhs).join(', ') || '(空)') : '(无 xhs)');
    var mt = xhs && xhs.miniTool;
    row('sec-host', 'xhs.miniTool 存在', mt ? '是' : '否', mt ? 'ok' : 'no');
    row('sec-host', 'miniTool API', mt ? (Object.keys(mt).join(', ') || '(空)') : '(无 miniTool)');

    var sc = document.scrollingElement || document.documentElement;
    row('sec-host', '文档滚动高度', sc.scrollHeight + ' / 视口 ' + window.innerHeight);
    row('sec-host', '可滚动', sc.scrollHeight > window.innerHeight + 2 ? '是（可能不是全屏）' : '否（全屏）',
      sc.scrollHeight > window.innerHeight + 2 ? 'warn' : 'ok');
    row('sec-host', 'visibilityState', document.visibilityState);
  }

  function reportViewport() {
    head('视口与安全区');
    var m = metric();
    row('sec-viewport', 'innerWidth × innerHeight', m.iw + ' × ' + m.ih);
    row('sec-viewport', 'visualViewport', m.vw + ' × ' + m.vh + ' (offsetTop ' + m.voTop + ', scale ' + m.vvScale + ')');
    row('sec-viewport', 'screen.width × height', window.screen ? window.screen.width + ' × ' + window.screen.height : '?');
    row('sec-viewport', 'screen.availW × availH', window.screen ? window.screen.availWidth + ' × ' + window.screen.availHeight : '?');
    row('sec-viewport', 'documentElement.client', document.documentElement.clientWidth + ' × ' + document.documentElement.clientHeight);
    row('sec-viewport', 'media (orientation:portrait)', window.matchMedia('(orientation: portrait)').matches ? '匹配' : '不匹配');
    row('sec-viewport', 'media (orientation:landscape)', window.matchMedia('(orientation: landscape)').matches ? '匹配' : '不匹配');

    var sides = ['top', 'right', 'bottom', 'left'];
    var i;
    var envAll = [];
    var varAll = [];
    for (i = 0; i < sides.length; i++) {
      envAll.push(sides[i] + '=' + safe(function () { return envInset(sides[i]); }));
      varAll.push(sides[i] + '=' + safe(function () { return cssVarInset(sides[i]); }));
    }
    row('sec-viewport', 'env(safe-area-inset-*)', envAll.join('  '));
    row('sec-viewport', '--safe-area-inset-*', varAll.join('  '));
    row('sec-viewport', 'body padding-top 实测', safe(function () { return window.getComputedStyle(document.body).paddingTop; }));
  }

  function reportOrient() {
    head('方向 API');
    var so = window.screen ? window.screen.orientation : null;
    row('sec-orient', 'screen.orientation 存在', so ? '是' : '否', so ? 'ok' : 'no');
    if (so) {
      row('sec-orient', 'orientation.type', String(so.type));
      row('sec-orient', 'orientation.angle', String(so.angle));
      row('sec-orient', 'lock 方法', typeof so.lock === 'function' ? '有' : '无', typeof so.lock === 'function' ? 'ok' : 'no');
    }
    row('sec-orient', 'window.orientation (旧)', String(window.orientation));
    row('sec-orient', 'matchMedia 支持', window.matchMedia ? '是' : '否');
  }

  function reportCaps(fps) {
    head('能力探测');
    row('sec-caps', 'PointerEvent', window.PointerEvent ? '有' : '无', window.PointerEvent ? 'ok' : 'no');
    row('sec-caps', 'TouchEvent', 'ontouchstart' in window ? '有' : '无');
    row('sec-caps', 'CSS.supports', window.CSS && CSS.supports ? '有' : '无');
    row('sec-caps', '  touch-action:none', safe(function () { return CSS.supports('touch-action', 'none') ? '支持' : '不支持'; }, 'n/a'));
    row('sec-caps', '  display:grid', safe(function () { return CSS.supports('display', 'grid') ? '支持' : '不支持'; }, 'n/a'));
    row('sec-caps', '  aspect-ratio', safe(function () { return CSS.supports('aspect-ratio', '1/1') ? '支持' : '不支持'; }, 'n/a'));
    row('sec-caps', '  inset:0', safe(function () { return CSS.supports('inset', '0') ? '支持' : '不支持'; }, 'n/a'));
    row('sec-caps', '  clamp()', safe(function () { return CSS.supports('width', 'clamp(1px,2px,3px)') ? '支持' : '不支持'; }, 'n/a'));
    row('sec-caps', '  dvh', safe(function () { return CSS.supports('height', '100dvh') ? '支持' : '不支持'; }, 'n/a'));
    row('sec-caps', '  backdrop-filter', safe(function () { return CSS.supports('backdrop-filter', 'blur(1px)') ? '支持' : '不支持'; }, 'n/a'));
    row('sec-caps', '  :focus-visible', safe(function () { return CSS.supports('selector(:focus-visible)') ? '支持' : '不支持'; }, 'n/a'));

    var fg = safe(supportsFlexGap, null);
    row('sec-caps', 'Flex gap 行为实测', fg === null ? 'ERR' : (fg ? '生效（现代内核）' : '不生效（Chrome 61 基线）'),
      fg ? 'ok' : 'warn');

    var ac = false;
    var osc = false;
    safe(function () {
      var A = window.AudioContext || window.webkitAudioContext;
      if (A) { ac = true; var c = new A(); osc = typeof c.createOscillator === 'function'; try { c.close(); } catch (e) {} }
    });
    row('sec-caps', 'AudioContext', ac ? '有' : '无', ac ? 'ok' : 'no');
    row('sec-caps', 'createOscillator', osc ? '有' : '无', osc ? 'ok' : 'no');
    row('sec-caps', 'navigator.vibrate', typeof navigator.vibrate === 'function' ? '有' : '无',
      typeof navigator.vibrate === 'function' ? 'ok' : 'warn');

    var c2 = false;
    var gl1 = false;
    var gl2 = false;
    safe(function () {
      var cv = document.createElement('canvas');
      c2 = !!(cv.getContext && cv.getContext('2d'));
      gl1 = !!(cv.getContext && (cv.getContext('webgl') || cv.getContext('experimental-webgl')));
      gl2 = !!(cv.getContext && cv.getContext('webgl2'));
    });
    row('sec-caps', 'Canvas 2D', c2 ? '有' : '无', c2 ? 'ok' : 'no');
    row('sec-caps', 'WebGL 1', gl1 ? '有' : '无');
    row('sec-caps', 'WebGL 2', gl2 ? '有' : '无');
    row('sec-caps', 'ResizeObserver', typeof window.ResizeObserver === 'function' ? '有' : '无');
    row('sec-caps', 'requestIdleCallback', typeof window.requestIdleCallback === 'function' ? '有' : '无');

    var ls = safe(function () {
      window.localStorage.setItem('__probe', '1');
      var v = window.localStorage.getItem('__probe');
      window.localStorage.removeItem('__probe');
      return v === '1';
    });
    row('sec-caps', 'localStorage 读写', ls === true ? '正常' : '异常', ls === true ? 'ok' : 'no');

    row('sec-caps', 'rAF 实测帧率(1s)', fps + ' fps', fps >= 50 ? 'ok' : 'warn');
    row('sec-caps', 'performance.now 精度', safe(function () {
      var a = performance.now();
      var b = performance.now();
      return (b - a) >= 0 ? '可用' : '异常';
    }));
  }

  function wrapLines(ctx, text, maxW) {
    var out = [];
    var i;
    var chars = text.split('');
    var line = '';
    for (i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line.length) {
        out.push(line);
        line = chars[i];
      } else {
        line = test;
      }
    }
    if (line) { out.push(line); }
    return out;
  }

  function reportLines() {
    var summary = summaryRows();
    var src = ['== 自检结论 =='];
    var i;
    for (i = 0; i < summary.length; i++) { src.push(summary[i][0] + ': ' + summary[i][1]); }
    src.push('');
    return src.concat(LINES);
  }

  function renderReport() {
    var W = 720;
    var pad = 24;
    var fs = 17;
    var lh = 25;
    var tmp = document.createElement('canvas');
    var tctx = tmp.getContext('2d');
    tctx.font = fs + 'px monospace';
    var src = reportLines();
    var wrapped = [];
    var i;
    var j;
    for (i = 0; i < src.length; i++) {
      var parts = wrapLines(tctx, src[i], W - pad * 2);
      for (j = 0; j < parts.length; j++) { wrapped.push(parts[j]); }
    }
    var H = pad * 2 + 56 + wrapped.length * lh;
    var cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#0d1016';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd479';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('容器方向探针报告', pad, pad + 22);
    ctx.font = fs + 'px monospace';
    ctx.fillStyle = '#e8ecf4';
    for (i = 0; i < wrapped.length; i++) {
      ctx.fillText(wrapped[i], pad, pad + 56 + i * lh);
    }
    return cv.toDataURL('image/png');
  }

  function toast(msg) { el('toast').textContent = msg; }

  function saveReport() {
    var data;
    try {
      data = renderReport();
    } catch (e) {
      toast('生成图片失败：' + e.message);
      return;
    }
    var mt = window.xhs && window.xhs.miniTool;
    if (!mt || typeof mt.writeTempFile !== 'function' || typeof mt.saveImageToPhotosAlbum !== 'function') {
      toast('无端能力（writeTempFile/saveImageToPhotosAlbum），请直接截图本页');
      return;
    }
    el('btn-save').disabled = true;
    toast('正在保存…');
    mt.writeTempFile({ data: data }).then(function (res) {
      var fp = res && res.filePath;
      if (!fp) {
        var shape = '';
        try { shape = JSON.stringify(res); } catch (e2) { shape = String(res); }
        throw { errMsg: 'writeTempFile 未返回 filePath，实际收到: ' + shape };
      }
      return mt.saveImageToPhotosAlbum({ filePath: fp });
    }).then(function () {
      el('btn-save').disabled = false;
      toast('已存到相册');
    })['catch'](function (err) {
      el('btn-save').disabled = false;
      toast('失败：' + (err && err.errMsg ? err.errMsg : err));
    });
  }

  function bindOrientActions() {
    var box = el('orient-actions');
    if (!box) { return; }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '尝试锁定横屏 (orientation.lock)';
    btn.addEventListener('click', function () {
      var so = window.screen ? window.screen.orientation : null;
      if (!so || typeof so.lock !== 'function') {
        toast('无 screen.orientation.lock 方法（iOS 与多数 WebView 常见）。此项不能定性，请看上面的旋转记录');
        LINES.push('lock(landscape): 方法不存在（非「被拒绝」，需以旋转记录为准）');
        return;
      }
      so.lock('landscape').then(function () {
        toast('lock(landscape) 成功 —— 容器允许横屏');
        LINES.push('lock(landscape): 成功');
      })['catch'](function (e) {
        toast('lock 失败：' + (e && e.name ? e.name : e) + ' —— 容器大概率竖屏锁定');
        LINES.push('lock(landscape): 失败 ' + (e && e.name ? e.name : e));
      });
    });
    box.appendChild(btn);

    var btn2 = document.createElement('button');
    btn2.type = 'button';
    btn2.textContent = '解除锁定';
    btn2.style.marginTop = '8px';
    btn2.addEventListener('click', function () {
      var so = window.screen ? window.screen.orientation : null;
      if (!so || typeof so.unlock !== 'function') { toast('无 unlock'); return; }
      safe(function () { so.unlock(); });
      toast('已调用 unlock');
    });
    box.appendChild(btn2);
  }

  function boot() {
    var m = metric();
    paint(m);
    head('旋转记录');
    logRotation('初始');
    bindRotation();

    reportOrient();
    reportViewport();
    reportHost();

    measureFps(function (fps) {
      FPS = fps;
      reportCaps(fps);
      renderSummary();
      el('bar').style.width = '100%';
      LINES.push('');
      LINES.push('（以上为完整探针结果）');
    });

    el('btn-save').addEventListener('click', saveReport);
    bindOrientActions();

    window.__probe = {
      metric: metric,
      lines: LINES,
      supportsFlexGap: supportsFlexGap,
      save: saveReport,
      render: renderReport,
      reportLines: reportLines,
      uaVersion: uaVersion,
      uaEngine: uaEngine,
      summary: summaryRows,
      snapshot: function () {
        var s = metric();
        s.shape = shape(s);
        return s;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
