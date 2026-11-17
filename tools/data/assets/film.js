/* 《删了》 —— 78 秒自动播放的动画，中途可插手。
   全程无滚动、无翻页。字幕每屏最多一行，其余靠画面。
   Chrome 61 基线：var / function / 无箭头函数 / 无模板串 / 无 let const。 */

(function () {
  'use strict';

  var STAGE = document.getElementById('stage');
  var FILM = document.getElementById('film');
  var CAP = document.getElementById('cap');
  var BAR = document.getElementById('bar');

  /* ---------- 参数 ---------- */

  var QS = window.location.search || '';

  function param(k) {
    var m = new RegExp('[?&]' + k + '=([^&]*)').exec(QS);
    return m ? decodeURIComponent(m[1]) : null;
  }

  var JUMP = param('t') === null ? -1 : parseInt(param('t'), 10);
  var INSTANT = JUMP >= 0;

  var DURATION = 66000;

  /* 录制用：?slow=N 把时间轴放慢 N 倍。
     截图每帧要几十到一百多毫秒，实时播只能抓到个位数帧。
     放慢之后，每一帧截图对应的内容时间变短，动作才连续。
     帧的真实时间戳由录制脚本从 window.__filmT 读取，合成时按它对齐，
     所以哪怕截图忽快忽慢，成片速度也是准的。 */
  var SLOW = param('slow') === null ? 1 : parseFloat(param('slow'));
  if (!(SLOW > 0)) SLOW = 1;

  /* 舞台状态类集中挂，避免 is-still 和 is-rec 互相覆盖 */
  var STAGE_CLS = [];
  if (param('still') !== null) STAGE_CLS.push('is-still');
  if (SLOW > 1) STAGE_CLS.push('is-rec');
  if (STAGE_CLS.length) STAGE.className = STAGE_CLS.join(' ');

  /* ---------- 小工具 ---------- */

  function el(tag, cls) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    return d;
  }

  function u(n) {
    return 'calc(var(--u) * ' + n + ')';
  }

  function unit() {
    var w = STAGE.clientWidth || 390;
    document.documentElement.style.setProperty('--u', w / 100 + 'px');
  }

  /* 数字滚动。INSTANT 模式下直接落到终值，供出图。 */
  function roll(node, from, to, dur, fmt, done) {
    if (INSTANT) {
      node.textContent = fmt(to);
      if (done) done();
      return;
    }
    var t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = (ts - t0) / (dur * SLOW);
      if (p > 1) p = 1;
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(from + (to - from) * e);
      if (p < 1) {
        window.requestAnimationFrame(step);
      } else if (done) {
        done();
      }
    }
    window.requestAnimationFrame(step);
  }

  function sec2(v) {
    return v.toFixed(2);
  }

  function mmss(v) {
    var s = Math.round(v);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' + r : '' + r);
  }

  /* ---------- 时间轴 ---------- */

  var cues = [];
  var clock = 0;
  var sorted = false;

  function at(t, fn) {
    cues.push({ t: t, fn: fn, done: false });
  }

  function tick(t) {
    /* 定格跳转是一次性扫完全部 cue，必须按时间顺序来 */
    if (!sorted) {
      cues.sort(function (a, b) { return a.t - b.t; });
      sorted = true;
    }
    for (var i = 0; i < cues.length; i++) {
      if (!cues[i].done && t >= cues[i].t) {
        cues[i].done = true;
        cues[i].fn();
      }
    }
    BAR.style.width = Math.min(100, (t / DURATION) * 100) + '%';
  }

  /* 字幕：一行，替换式。 */
  function say(html) {
    CAP.innerHTML = '<span class="cap-line">' + html + '</span>';
  }

  function clearSay() {
    CAP.innerHTML = '';
  }

  /* ---------- 数据墙 ---------- */

  var COLS = 8;
  var ROWS = 5;
  var CW = 10.6;
  var GAP = 1.2;
  var PADX = (100 - (COLS * CW + (COLS - 1) * GAP)) / 2;

  var wall = el('div', 'wall');
  wall.style.top = '56%';
  wall.style.height = u(ROWS * (CW + GAP) - GAP);
  wall.style.marginTop = u(-(ROWS * (CW + GAP) - GAP) / 2);

  var blocks = [];

  (function build() {
    for (var i = 0; i < 40; i++) {
      var c = i % COLS;
      var r = Math.floor(i / COLS);
      var b = el('div', 'blk is-full');
      b.style.left = u(PADX + c * (CW + GAP));
      b.style.top = u(r * (CW + GAP));
      b.style.transitionDelay = i * 11 + 'ms';
      b.appendChild(el('i', 'e l'));
      b.appendChild(el('i', 'e r'));
      b.setAttribute('data-i', String(i));
      wall.appendChild(b);
      blocks.push(b);
    }
    FILM.appendChild(wall);
  })();

  var DEAD = [3, 7, 16, 24, 31, 37];

  /* ---------- 文件卡 ---------- */

  function card() {
    var c = el('div', 'card');
    c.style.top = '12%';
    c.innerHTML =
      '<span class="nm">星际穿越.mp4</span>' +
      '<span class="sz">4.0 GB</span>';
    FILM.appendChild(c);
    return c;
  }

  /* ---------- 目录行 ---------- */

  function dirline(topPct) {
    var d = el('div', 'dirline');
    d.style.top = topPct + '%';
    d.innerHTML =
      '/Volumes/DATA/电影/星际穿越.mp4' +
      '<span class="st"></span>';
    FILM.appendChild(d);
    return d;
  }

  /* ---------- 秒表 ---------- */

  function watch(label) {
    var w = el('div', 'watch');
    w.innerHTML = '<span class="num">0.00</span><span class="unit">' + label + '</span>';
    FILM.appendChild(w);
    return w;
  }

  /* ---------- 气泡 ---------- */

  function bub(left, top, who, text) {
    var b = el('div', 'bub');
    b.style.left = u(left);
    b.style.top = u(top);
    b.innerHTML = '<span class="who">' + who + '</span>' + text;
    wall.appendChild(b);
    return b;
  }

  /* ---------- 管道组 ---------- */

  var duo = el('div', 'duo');
  duo.innerHTML =
    '<div class="dev is-l"><span class="lab">服务器</span></div>' +
    '<div class="dev is-r"><span class="lab">你的手机</span></div>' +
    '<div class="tube"></div>' +
    '<div class="prog"><i></i><i></i><i></i><i></i></div>';
  FILM.appendChild(duo);

  var prog = duo.querySelectorAll('.prog i');

  var tube = duo.querySelector('.tube');
  var pkts = [];

  (function buildPkts() {
    for (var i = 0; i < 4; i++) {
      var p = el('div', 'pkt');
      tube.appendChild(p);
      pkts.push(p);
    }
  })();

  /* ---------- 对照表 ---------- */

  var compare = el('div', 'compare');
  compare.innerHTML =
    '<span class="cmprow"><span class="k">删掉它</span><span class="v is-hot">0.12 秒</span></span>' +
    '<span class="cmprow"><span class="k">下载它</span><span class="v is-bad">3 分 52 秒</span></span>';
  FILM.appendChild(compare);

  /* ---------- 扫描线 / 恢复提示 ---------- */

  var scan = el('div', 'scanline');
  FILM.appendChild(scan);

  var recover = el('div', 'recover');
  FILM.appendChild(recover);

  /* ---------- 结算 ---------- */

  var endwrap = el('div', 'endwrap');
  endwrap.innerHTML =
    '<span class="h">删掉的<br><em>只是名字</em></span>' +
    '<span class="ln"><b>删</b>　　划掉目录里的一行字</span>' +
    '<span class="ln"><b>下载</b>　真的搬一遍，一格一格</span>' +
    '<span class="ln"><b>找回</b>　盖住之前，它一直都在</span>' +
    '<button class="replay" type="button">再看一遍</button>';
  FILM.appendChild(endwrap);

  endwrap.querySelector('.replay').addEventListener('click', function () {
    window.location.href = window.location.pathname;
  });

  /* ============================================================
     第一幕：删得有多快
     ============================================================ */

  at(200, function () {
    for (var i = 0; i < blocks.length; i++) blocks[i].className = 'blk is-full is-in';
  });

  at(1500, function () {
    say('四十格。每格 100 MB。');
  });

  at(3600, function () {
    var c = card();
    c.className = 'card is-drop';
    window.__card = c;
  });

  at(3900, function () {
    say('删掉这个电影。');
  });

  at(5200, function () {
    var r = el('div', 'ring');
    r.style.left = '50%';
    r.style.top = '18%';
    FILM.appendChild(r);
  });

  at(5350, function () {
    if (window.__card) window.__card.className = 'card is-gone';
  });

  at(5500, function () {
    if (window.__card) window.__card.style.display = 'none';
    var d = dirline(17);
    d.style.opacity = '1';
    window.__dir = d;
  });

  at(5800, function () {
    if (window.__dir) window.__dir.className = 'dirline is-cut';
  });

  at(6100, function () {
    if (window.__dir) window.__dir.className = 'dirline is-cut is-fly';
  });

  /* 飞完必须摘掉，否则它会一直悬在屏幕上 */
  at(7100, function () {
    if (window.__dir && window.__dir.parentNode) {
      window.__dir.parentNode.removeChild(window.__dir);
      window.__dir = null;
    }
  });

  at(6200, function () {
    var w = watch('秒');
    w.className = 'watch is-on';
    window.__watch = w;
    roll(w.querySelector('.num'), 0, 0.12, 900, sec2);
  });

  at(7300, function () {
    say('它<b>一个字节都没搬</b>。');
  });

  at(9200, function () {
    bub(3, -15, '格子 #17', '我们不是被删了吗？');
  });

  at(10300, function () {
    bub(47, -15, '格子 #22', '目录上那行没了。<br>我们还在这儿。');
    blocks[17].className = 'blk is-full is-in is-poke';
    blocks[22].className = 'blk is-full is-in is-poke';
  });

  at(11800, function () {
    say('删掉的只是<i>一行字</i>。');
  });

  at(14500, function () {
    clearSay();
    if (window.__watch) {
      window.__watch.className = 'watch';
    }
  });

  at(15200, function () {
    say('所以它这么快。');
  });

  at(17000, function () {
    clearSay();
  });

  /* ============================================================
     第二幕：下载有多慢
     ============================================================ */

  at(17600, function () {
    wall.className = 'wall is-out';
    wall.style.opacity = '0';
    wall.style.webkitTransform = 'scale(0.9)';
    wall.style.transform = 'scale(0.9)';
  });

  at(18200, function () {
    duo.className = 'duo is-on';
  });

  at(19000, function () {
    say('同一个文件，反着搬一次。');
  });

  at(20200, function () {
    pkts[0].className = 'pkt is-live';
    pkts[0].style.left = '0%';
  });

  at(20400, function () {
    pkts[0].style.left = 'calc(100% - ' + u(5) + ')';
  });

  at(21600, function () {
    pkts[0].style.opacity = '0';
    prog[0].className = 'is-on';
    pkts[1].className = 'pkt is-live';
    pkts[1].style.left = '0%';
  });

  at(21900, function () {
    pkts[1].style.left = '38%';
  });

  /* 丢包 */
  at(23000, function () {
    tube.className = 'tube is-open';
    var b = el('div', 'burst');
    tube.appendChild(b);
    prog[1].className = 'is-lost';
    pkts[1].className = 'pkt is-live is-bad';
  });

  at(23300, function () {
    say('丢了一个包。');
  });

  at(23500, function () {
    pkts[1].className = 'pkt is-live is-bad is-puff';
  });

  /* 重传 */
  at(24200, function () {
    tube.className = 'tube';
    var bs = tube.querySelectorAll('.burst');
    for (var i = 0; i < bs.length; i++) tube.removeChild(bs[i]);
    prog[1].className = '';
  });

  at(24400, function () {
    pkts[1].className = 'pkt is-live';
    pkts[1].style.opacity = '1';
    pkts[1].style.left = '0%';
  });

  at(24700, function () {
    pkts[1].style.left = 'calc(100% - ' + u(5) + ')';
  });

  at(25600, function () {
    pkts[1].style.opacity = '0';
    prog[1].className = 'is-on';
    clearSay();
    pkts[2].className = 'pkt is-live';
    pkts[3].className = 'pkt is-live';
    pkts[2].style.left = '0%';
    pkts[3].style.left = '0%';
  });

  at(25800, function () {
    pkts[2].style.left = 'calc(100% - ' + u(5) + ')';
    pkts[3].style.left = 'calc(100% - ' + u(5) + ')';
  });

  at(26800, function () {
    pkts[2].style.opacity = '0';
    pkts[3].style.opacity = '0';
    prog[2].className = 'is-on';
    prog[3].className = 'is-on';
  });

  /* 计时 → 3:52 */
  at(27000, function () {
    duo.className = 'duo';
    var w = watch('下载用时');
    w.querySelector('.num').textContent = '0:00';
    w.style.top = '26%';
    w.className = 'watch is-on';
    w.querySelector('.num').style.color = 'var(--bad)';
    window.__dload = w;
    roll(w.querySelector('.num'), 0, 232, 1800, mmss);
  });

  at(29200, function () {
    say('3 分 52 秒。');
  });

  at(30800, function () {
    compare.className = 'compare is-on';
  });

  at(31800, function () {
    say('慢了 <b>1933 倍</b>。');
  });

  /* 多车道 */
  at(33800, function () {
    compare.className = 'compare';
    if (window.__dload) window.__dload.className = 'watch';
    clearSay();
    var wrap = el('div', 'duo is-on');
    wrap.style.zIndex = '7';
    wrap.innerHTML =
      '<div class="dev is-l"><span class="lab">服务器</span></div>' +
      '<div class="dev is-r"><span class="lab">你的手机</span></div>';
    window.__lanes = [];
    for (var i = 0; i < 4; i++) {
      var ln = el('div', 'lane');
      ln.style.top = 'calc(50% + ' + u(-12 + i * 8) + ')';
      ln.innerHTML = '<span class="pkt" style="top:50%"></span>';
      wrap.appendChild(ln);
      window.__lanes.push(ln.firstChild);
    }
    FILM.appendChild(wrap);
    window.__laneWrap = wrap;
  });

  at(34800, function () {
    say('多开几条道。');
  });

  at(36000, function () {
    for (var i = 0; i < 4; i++) {
      window.__lanes[i].style.left = '0%';
      window.__lanes[i].style.opacity = '1';
    }
  });

  at(36200, function () {
    for (var i = 0; i < 4; i++) {
      window.__lanes[i].style.transitionDuration = '1.5s';
      window.__lanes[i].style.transitionDelay = (i * 90) + 'ms';
      window.__lanes[i].style.left = 'calc(100% - ' + u(3.4) + ')';
    }
  });

  at(37900, function () {
    /* 送达标记：四条道各留一个绿点，别堆成一列蓝块 */
    for (var i = 0; i < 4; i++) window.__lanes[i].className = 'pkt is-done';
    say('四条道一起搬，快得多。');
  });

  at(39800, function () {
    clearSay();
    if (window.__laneWrap) window.__laneWrap.className = 'duo';
  });

  /* ============================================================
     第三幕：它还在
     ============================================================ */

  at(40500, function () {
    wall.style.opacity = '1';
    wall.style.webkitTransform = 'scale(1)';
    wall.style.transform = 'scale(1)';
    /* 清掉第一幕的气泡 */
    var old = wall.querySelectorAll('.bub');
    for (var j = 0; j < old.length; j++) wall.removeChild(old[j]);
    /* 全部复位，再单独标出已删的六格 —— 上一幕的高亮不能留 */
    for (var i = 0; i < blocks.length; i++) {
      blocks[i].className = 'blk is-full is-in';
    }
    for (var k = 0; k < DEAD.length; k++) {
      blocks[DEAD[k]].className = 'blk is-dead is-in';
    }
  });

  at(41400, function () {
    say('删掉的六格，还在这儿。');
  });

  at(43600, function () {
    clearSay();
    scan.className = 'scanline is-run';
  });

  /* 六个格子逐个被扫出来。用独立时间点，不用 setTimeout —— 异步会跟时间轴抢执行顺序 */
  (function () {
    for (var i = 0; i < DEAD.length; i++) {
      (function (idx, n) {
        at(44100 + n * 300, function () {
          blocks[idx].className = 'blk is-flash is-in';
        });
        at(44260 + n * 300, function () {
          blocks[idx].className = 'blk is-restored is-in';
        });
      })(DEAD[i], i);
    }
  })();

  at(46000, function () {
    recover.className = 'recover is-on';
    recover.innerHTML = '星际穿越.mp4<br><b>6 项</b>可恢复';
  });

  at(46800, function () {
    say('扫一遍，全找回来了。');
  });

  at(49500, function () {
    recover.className = 'recover';
    scan.className = 'scanline';
    clearSay();
  });

  at(50200, function () {
    say('点它。往格子里写新东西。');
    for (var i = 0; i < DEAD.length; i++) {
      var b = blocks[DEAD[i]];
      b.className = 'blk is-restored is-in is-tappable';
      b.setAttribute('data-cover', '0');
    }
    window.__coverCount = 0;
  });

  function cover(b) {
    if (b.getAttribute('data-cover') === '1') return;
    b.setAttribute('data-cover', '1');
    b.className = 'blk is-cover is-in';
    window.__coverCount += 1;
    if (window.__coverCount >= DEAD.length) {
      window.setTimeout(function () {
        if (!window.__covered) {
          window.__covered = true;
          onCovered();
        }
      }, 700 * SLOW);
    }
  }

  at(50400, function () {
    for (var i = 0; i < DEAD.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { cover(b); });
      })(blocks[DEAD[i]]);
    }
  });

  /* 六秒没点完就替用户点完，不让流程卡住 */
  at(56200, function () {
    if (window.__coverCount >= DEAD.length) return;
    for (var i = 0; i < DEAD.length; i++) cover(blocks[DEAD[i]]);
  });

  /* 定格出图时不排定时器，直接落到终态，否则永远抓不到结算页 */
  function after(ms, fn) {
    if (INSTANT) { fn(); return; }
    /* 定时器走真实时间，时间轴走内容时间，慢放时必须换算，否则节奏被压成 1/SLOW */
    window.setTimeout(fn, ms * SLOW);
  }

  function onCovered() {
    clearSay();
    say('盖住了。');
    after(600, function () {
      scan.className = 'scanline is-run';
      after(1400, function () {
        recover.className = 'recover is-on';
        recover.innerHTML = '扫描完成<b>0 项</b>可恢复';
      });
    });
    after(2600, function () {
      say('0 项。');
    });
    /* 清场与结算只差 100ms：墙淡出和标题淡入叠在一起，避免中间出现纯黑空屏 */
    after(4700, function () {
      recover.className = 'recover';
      scan.className = 'scanline';
      wall.style.opacity = '0';
      wall.style.webkitTransform = 'scale(0.94)';
      wall.style.transform = 'scale(0.94)';
    });
    after(4800, function () {
      clearSay();
      endwrap.className = 'endwrap is-on';
    });
  }

  /* ---------- 暂停 ---------- */

  var paused = false;
  var pauseMark = el('div', 'paused');
  pauseMark.innerHTML = '<i></i><i></i>';
  STAGE.appendChild(pauseMark);

  STAGE.addEventListener('click', function (e) {
    var cls = (e.target && e.target.className) ? String(e.target.className) : '';
    if (cls.indexOf('blk') >= 0) return;
    if (cls.indexOf('replay') >= 0) return;
    if (INSTANT) return;
    paused = !paused;
    pauseMark.className = paused ? 'paused is-on' : 'paused';
  });

  /* ---------- 启动 ---------- */

  function boot() {
    unit();
    window.__filmT = 0;
    window.__filmDone = false;
    if (INSTANT) {
      tick(JUMP);
      window.__filmT = JUMP;
      window.__filmDone = JUMP >= DURATION;
      return;
    }
    var last = null;
    var acc = 0;
    function loop(ts) {
      if (last === null) last = ts;
      if (!paused) acc += (ts - last) / SLOW;
      last = ts;
      tick(acc);
      window.__filmT = acc;
      if (acc >= DURATION) window.__filmDone = true;
      if (acc < DURATION) {
        window.requestAnimationFrame(loop);
      }
    }
    /* ?auto=0 时不自动起跑，等录制脚本喊 __filmGo()，保证第一帧就是 t=0 */
    window.__filmGo = function () {
      window.requestAnimationFrame(loop);
    };
    if (param('auto') !== '0') window.__filmGo();
  }

  window.addEventListener('resize', unit);
  window.addEventListener('orientationchange', function () {
    window.setTimeout(unit, 140);
  });

  /* 录制用：冻结/恢复时间轴，但不显示暂停标记。
     录制脚本在冻结期间截图，保证画面与读到的 __filmT 严格对应。 */
  window.__filmPause = function (v) {
    paused = !!v;
    pauseMark.className = 'paused';
  };

  boot();
})();
