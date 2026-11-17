/* 演示层：由 CDP 注入，仅录制时存在，不进产物包。
   提供 __capT(text) / __tap(sel) / __type(sel,text,ms) 三个给录制器调用的接口。 */
(function () {
  if (window.__demoReady) return;
  window.__demoReady = true;

  var css = [
    '#__cap{position:fixed;left:0;right:0;text-align:center;pointer-events:none;z-index:2147483000;opacity:0;',
    '-webkit-transition:opacity .3s linear;transition:opacity .3s linear;}',
    '#__cap.on{opacity:1;}',
    '#__cap b{display:inline-block;max-width:80%;padding:9px 17px;border-radius:999px;background:rgba(35,32,28,.9);',
    'color:#FFFDF9;font:400 13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;letter-spacing:.02em;',
    'box-shadow:0 5px 20px rgba(35,32,28,.16);}',
    '#__dot{position:fixed;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;',
    'background:rgba(255,253,249,.96);box-shadow:0 3px 12px rgba(35,32,28,.3),0 0 0 1.5px rgba(35,32,28,.13);',
    'z-index:2147482999;pointer-events:none;opacity:0;',
    '-webkit-transition:opacity .1s linear,-webkit-transform .12s ease-out;transition:opacity .1s linear,transform .12s ease-out;}',
    '#__dot.on{opacity:1;}',
    '#__dot.dn{-webkit-transform:scale(.78);transform:scale(.78);opacity:.55;}',
    '#__rp{position:fixed;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;',
    'background:rgba(35,32,28,.15);z-index:2147482998;pointer-events:none;opacity:0;}',
    '#__rp.go{-webkit-animation:__rp .48s ease-out forwards;animation:__rp .48s ease-out forwards;}',
    '@-webkit-keyframes __rp{0%{opacity:.5;-webkit-transform:scale(.3)}60%{opacity:.2;-webkit-transform:scale(1.1)}100%{opacity:0;-webkit-transform:scale(1.55)}}',
    '@keyframes __rp{0%{opacity:.5;transform:scale(.3)}60%{opacity:.2;transform:scale(1.1)}100%{opacity:0;transform:scale(1.55)}}',
    /* 录制时屏蔽页面自带 toast，避免与字幕重叠 */
    '.toast{display:none!important;}'
  ].join('');

  function build() {
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    var cap = document.createElement('div');
    cap.id = '__cap';
    cap.innerHTML = '<b></b>';
    document.body.appendChild(cap);

    var dot = document.createElement('div');
    dot.id = '__dot';
    document.body.appendChild(dot);

    var rp = document.createElement('div');
    rp.id = '__rp';
    document.body.appendChild(rp);

    placeCap();
  }

  var capLift = 0;

  function placeCap() {
    var tabs = document.getElementById('tabs');
    var h = tabs ? tabs.getBoundingClientRect().height : 58;
    var c = document.getElementById('__cap');
    if (c) c.style.bottom = (h + 16 + capLift) + 'px';
  }

  function center(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  window.__capT = function (t, lift) {
    var c = document.getElementById('__cap');
    if (!c) return;
    if (!t) { c.className = ''; return; }
    capLift = lift || 0;
    c.querySelector('b').textContent = t;
    c.className = 'on';
    placeCap();
  };

  window.__tap = function (sel, hold) {
    return new Promise(function (res) {
      var el = document.querySelector(sel);
      if (!el) { res(false); return; }
      var p = center(el);
      var dot = document.getElementById('__dot');
      var rp = document.getElementById('__rp');
      dot.style.left = p.x + 'px';
      dot.style.top = p.y + 'px';
      rp.style.left = p.x + 'px';
      rp.style.top = p.y + 'px';
      dot.className = 'on';

      setTimeout(function () { dot.className = 'on dn'; }, 140);
      setTimeout(function () {
        rp.className = '';
        void rp.offsetWidth;
        rp.className = 'go';
        el.click();
      }, 210);
      setTimeout(function () { dot.className = 'on'; }, 280);
      setTimeout(function () { dot.className = ''; res(true); }, hold || 620);
    });
  };

  window.__type = function (sel, text, per) {
    return new Promise(function (res) {
      var el = document.querySelector(sel);
      if (!el) { res(false); return; }
      try { el.focus(); } catch (e) {}
      var i = 0;
      per = per || 88;
      var t = setInterval(function () {
        i++;
        el.value = text.slice(0, i);
        var ev = document.createEvent('HTMLEvents');
        ev.initEvent('input', true, true);
        el.dispatchEvent(ev);
        if (i >= text.length) {
          clearInterval(t);
          setTimeout(function () { res(true); }, 130);
        }
      }, per);
    });
  };

  /* 强制让页面对合成器产生一次可见变化：静止时 screencast 不推帧，
     过渡中间态会被一直冻结。差异 0.1%，肉眼不可见。 */
  window.__kick = function () {
    var b = document.body;
    b.style.opacity = b.style.opacity === '0.999' ? '1' : '0.999';
    return b.style.opacity;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
