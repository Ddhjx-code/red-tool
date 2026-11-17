/* 演示层（mtea 版）：由 CDP 注入，仅录制时存在，不进产物包。
   提供 __capT / __tap / __slider / __mapDrag / __dot */
(function () {
  if (window.__demoReady) return;
  window.__demoReady = true;

  var css = [
    '#__cap{position:fixed;left:0;right:0;text-align:center;pointer-events:none;z-index:2147483000;opacity:0;',
    '-webkit-transition:opacity .3s linear;transition:opacity .3s linear;}',
    '#__cap.on{opacity:1;}',
    '#__cap b{display:inline-block;max-width:82%;padding:9px 17px;border-radius:999px;background:rgba(35,32,28,.9);',
    'color:#FFFDF9;font:400 13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;letter-spacing:.02em;',
    'box-shadow:0 5px 20px rgba(35,32,28,.16);}',
    '#__dot{position:fixed;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;',
    'background:rgba(255,253,249,.94);box-shadow:0 3px 12px rgba(35,32,28,.32),0 0 0 1.5px rgba(35,32,28,.13);',
    'z-index:2147482999;pointer-events:none;opacity:0;',
    '-webkit-transition:opacity .1s linear;transition:opacity .1s linear;}',
    '#__dot.on{opacity:1;}',
    '#__rp{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;',
    'background:rgba(35,32,28,.14);z-index:2147482998;pointer-events:none;opacity:0;}',
    '#__rp.go{-webkit-animation:__rp .46s ease-out forwards;animation:__rp .46s ease-out forwards;}',
    '@-webkit-keyframes __rp{0%{opacity:.5;-webkit-transform:scale(.3)}60%{opacity:.2;-webkit-transform:scale(1.05)}100%{opacity:0;-webkit-transform:scale(1.5)}}',
    '@keyframes __rp{0%{opacity:.5;transform:scale(.3)}60%{opacity:.2;transform:scale(1.05)}100%{opacity:0;transform:scale(1.5)}}',
    /* 录制时隐藏底部提示，字幕替它说话；舞台让出字幕带 */
    '#footTxt{visibility:hidden!important;}',
    '#stage{margin-bottom:46px;}'
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

  function placeCap() {
    var f = document.getElementById('foot');
    var h = f ? f.getBoundingClientRect().height : 96;
    var c = document.getElementById('__cap');
    if (c) c.style.bottom = (h + 10) + 'px';
  }

  function ctr(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function dotAt(x, y, on) {
    var d = document.getElementById('__dot');
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.className = on === false ? '' : 'on';
    return d;
  }

  window.__capT = function (t) {
    var c = document.getElementById('__cap');
    if (!c) return;
    if (!t) { c.className = ''; return; }
    c.querySelector('b').textContent = t;
    c.className = 'on';
    placeCap();
  };

  window.__dot = function (x, y, on) { dotAt(x, y, on); };

  window.__tap = function (sel) {
    return new Promise(function (res) {
      var el = document.querySelector(sel);
      if (!el) { res(false); return; }
      var p = ctr(el);
      var d = dotAt(p.x, p.y);
      var rp = document.getElementById('__rp');
      rp.style.left = p.x + 'px';
      rp.style.top = p.y + 'px';
      setTimeout(function () { d.style.transform = 'scale(.8)'; }, 130);
      setTimeout(function () {
        rp.className = '';
        void rp.offsetWidth;
        rp.className = 'go';
        el.click();
      }, 200);
      setTimeout(function () {
        d.style.transform = '';
        d.className = '';
        res(true);
      }, 560);
    });
  };

  function fire(el, type, x, y) {
    var e = document.createEvent('MouseEvents');
    e.initMouseEvent(type, true, true, window, 1, x, y, x, y, false, false, false, false, 0, null);
    el.dispatchEvent(e);
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  /* 拖滑杆：ratio 0~1 对应 min~max */
  window.__slider = function (sel, ratio, ms) {
    return new Promise(function (res) {
      var el = document.querySelector(sel);
      if (!el) { res(false); return; }
      var r = el.getBoundingClientRect();
      var thumb = el.querySelector('.sl-thumb');
      var x0 = thumb ? ctr(thumb).x : r.left;
      var y0 = r.top + r.height / 2;
      var x1 = r.left + ratio * r.width;
      var t0 = Date.now();
      ms = ms || 620;
      fire(el, 'mousedown', x0, y0);
      dotAt(x0, y0);
      (function step() {
        var k = Math.min(1, (Date.now() - t0) / ms);
        var x = x0 + (x1 - x0) * ease(k);
        fire(document, 'mousemove', x, y0);
        dotAt(x, y0);
        if (k < 1) { requestAnimationFrame(step); }
        else {
          fire(document, 'mouseup', x1, y0);
          setTimeout(function () {
            document.getElementById('__dot').className = '';
            res(true);
          }, 200);
        }
      })();
    });
  };

  /* 数据坐标(0~300) 转屏幕坐标，与 game.js 的 preserveAspectRatio=meet 换算一致 */
  function mapPx(svg, x, y) {
    var r = svg.getBoundingClientRect();
    var k = Math.min(r.width / 320, r.height / 200);
    var ox = r.left + (r.width - 320 * k) / 2;
    var oy = r.top + (r.height - 200 * k) / 2;
    var MX0 = 36, MW = 248, MY0 = 176, MH = 146;
    return {
      x: ox + (MX0 + x / 300 * MW) * k,
      y: oy + (MY0 - y / 300 * MH) * k
    };
  }

  window.__mapXY = function (x, y) {
    var p = mapPx(document.getElementById('map'), x, y);
    return [Math.round(p.x), Math.round(p.y)];
  };

  /* 从 (x0,y0) 拖到 (x1,y1)，数据坐标 */
  window.__mapDrag = function (x0, y0, x1, y1, ms) {
    return new Promise(function (res) {
      var svg = document.getElementById('map');
      if (!svg) { res(false); return; }
      var a = mapPx(svg, x0, y0), b = mapPx(svg, x1, y1);
      var t0 = Date.now();
      ms = ms || 900;
      fire(svg, 'mousedown', a.x, a.y);
      dotAt(a.x, a.y);
      (function step() {
        var k = Math.min(1, (Date.now() - t0) / ms);
        var x = a.x + (b.x - a.x) * ease(k);
        var y = a.y + (b.y - a.y) * ease(k);
        fire(document, 'mousemove', x, y);
        dotAt(x, y);
        if (k < 1) { requestAnimationFrame(step); }
        else {
          fire(document, 'mouseup', b.x, b.y);
          setTimeout(function () {
            document.getElementById('__dot').className = '';
            res(true);
          }, 200);
        }
      })();
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
