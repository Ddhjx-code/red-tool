/* 实验二：下载有多慢。
   同一个文件，反过来搬一次。数据得一块一块真的走过那条线，丢包还得重传。 */

window.regScene({
  tag: '实验二 / 3',
  title: '下载有多慢',
  sub: '同一个文件，从服务器搬到你手机。一直点，直到搬完。',
  next: '下一个实验',

  build: function (root, api) {
    var TOTAL_STEPS = 12; // 4 块 × 3 步
    var FULL_SEC = 232; // 3 分 52 秒
    var steps = 0;
    var lostDone = false;
    var done = false;

    root.innerHTML =
      '<div class="clock" id="clk" style="font-size:calc(var(--u)*9)">0:00</div>' +
      '<p class="clockcap" id="cap">已经搬了这么久。目标是 4.2 GB。</p>' +
      '<div class="pipe-ends"><span>服务器</span><span>你的手机</span></div>' +
      '<div class="pipe"><div id="dots"></div></div>' +
      '<div class="packs" id="packs"></div>' +
      '<div id="say"></div>' +
      '<div id="ask"></div>';

    var packsEl = DU.q('#packs');
    var sayEl = DU.q('#say');
    var capEl = DU.q('#cap');
    var clkEl = DU.q('#clk');
    var dotsEl = DU.q('#dots');

    var packs = [];
    var builder = '';
    for (var i = 0; i < 4; i++) {
      builder +=
        '<button class="pack" type="button" data-k="' + i + '">' +
        '<div class="pk-h"><span class="pk-n">包 ' + (i + 1) + '</span>' +
        '<span class="pk-p" data-p="' + i + '">0%</span></div>' +
        '<div class="pk-bar"><div class="pk-fill" data-f="' + i + '"></div></div>' +
        '</button>';
      packs.push(0);
    }
    packsEl.innerHTML = builder;

    function dot() {
      var d = document.createElement('i');
      d.className = 'dot';
      d.style.left = '0';
      dotsEl.appendChild(d);
      window.setTimeout(function () {
        d.style.left = '100%';
      }, 10);
      window.setTimeout(function () {
        if (d.parentNode) d.parentNode.removeChild(d);
      }, 420);
    }

    function paint() {
      for (var i = 0; i < 4; i++) {
        var p = DU.q('.pack[data-k="' + i + '"]');
        var pct = DU.q('[data-p="' + i + '"]');
        var fill = DU.q('[data-f="' + i + '"]');
        pct.textContent = Math.round((packs[i] / 3) * 100) + '%';
        fill.style.width = (packs[i] / 3) * 100 + '%';
        if (packs[i] >= 3) p.className = 'pack is-done';
      }
      clkEl.textContent = DU.mmss((FULL_SEC * steps) / TOTAL_STEPS);
    }

    function say(html, cls) {
      sayEl.innerHTML = '<div class="say ' + (cls || '') + '">' + html + '</div>';
    }

    function clickPack(k, node) {
      if (done) return;
      if (packs[k] >= 3) return;

      /* 第二块传一半会丢包，必须重传 —— 这不是惩罚，是这个实验的一部分 */
      if (k === 1 && packs[1] === 1 && !lostDone) {
        lostDone = true;
        node.className = 'pack is-lost';
        say('丢包了。这一块传到一半断了，得从头再传一次。<b>网线不保证送到。</b>', 'is-no');
        window.setTimeout(function () {
          node.className = 'pack';
        }, 520);
        return;
      }

      packs[k] += 1;
      steps += 1;
      dot();
      paint();

      if (packs[k] >= 3) {
        say('包 ' + (k + 1) + ' 到了。', 'is-ok');
      } else {
        say('包 ' + (k + 1) + ' 传到 ' + Math.round((packs[k] / 3) * 100) + '%。', '');
      }

      var all = packs[0] >= 3 && packs[1] >= 3 && packs[2] >= 3 && packs[3] >= 3;
      if (all) finish();
    }

    packsEl.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== packsEl && (t.className || '').indexOf('pack') < 0) t = t.parentNode;
      if (!t || t === packsEl) return;
      clickPack(parseInt(t.getAttribute('data-k'), 10), t);
    });

    function finish() {
      done = true;
      clkEl.textContent = DU.mmss(FULL_SEC);
      clkEl.className = 'clock is-slow';
      capEl.textContent = '搬完了。4.2 GB，三分五十二秒。';
      say('<b>同一个文件。</b>刚才删除它花了 0.12 秒，搬它花了 232 秒。差 1933 倍。', 'is-hi');
      window.setTimeout(ask, 600);
    }

    function ask() {
      DU.q('#ask').innerHTML =
        '<div class="sec"><span class="sec-n">04</span><span class="sec-t">太慢了，怎么办</span></div>' +
        '<div class="rows">' +
        '<div class="row"><span class="rk">删掉 4.2 GB</span><span class="rv">0.12 秒</span></div>' +
        '<div class="row"><span class="rk">搬来 4.2 GB</span><span class="rv is-big">3 分 52 秒</span></div>' +
        '</div>' +
        '<p class="say is-hi" style="margin-top:calc(var(--u)*4)">下次下同样的电影，怎么才能更快？</p>' +
        '<div class="opts" id="opts">' +
        '<button class="opt" type="button" data-k="0"><span class="tag">A</span><span>手点快一点，别停</span></button>' +
        '<button class="opt" type="button" data-k="1"><span class="tag">B</span><span>同时开四条管道，四块并排搬</span></button>' +
        '<button class="opt" type="button" data-k="2"><span class="tag">C</span><span>扔到后台慢慢下，眼不见为净</span></button>' +
        '</div>' +
        '<div id="ans"></div>';

      DU.q('#opts').addEventListener('click', function (e) {
        var t = e.target;
        while (t && (t.className || '').indexOf('opt') < 0) t = t.parentNode;
        if (!t) return;
        pick(parseInt(t.getAttribute('data-k'), 10));
      });
    }

    var answered = false;

    function pick(k) {
      if (answered) return;
      var why = [
        '你的手速不是瓶颈。数据必须沿着那条线一块一块走完，点得再快它也不会跳过去。',
        '对。把文件切成几块，几条连接同时搬 —— 这就是分块下载。<b>但总线宽没变，所以还是快不过带宽。</b>',
        '只是你不管它了。时间一秒没少，只是你不再盯着进度条。'
      ];
      var ok = k === 1;
      var nodes = DU.qa('#opts .opt');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].disabled = true;
        if (i === k) nodes[i].className = 'opt ' + (ok ? 'is-right' : 'is-wrong');
      }
      DU.q('#ans').innerHTML =
        '<div class="say ' + (ok ? 'is-ok' : 'is-no') + '">' + why[k] + '</div>' +
        (ok
          ? '<div class="reveal">' +
            '<p class="reveal-k">下载是搬，删除是不搬</p>' +
            '<p class="reveal-t">搬东西要时间，撕目录不用。速度快慢的差别，不在于文件多大，在于<b>到底有没有东西真的移动</b>。</p>' +
            '</div>'
          : '');

      if (ok) {
        answered = true;
        api.hint('下一幕：把它找回来');
        api.done();
      } else {
        /* 答错不锁死，让他再试一次 */
        window.setTimeout(function () {
          for (var j = 0; j < nodes.length; j++) {
            if (j !== k) {
              nodes[j].disabled = false;
              nodes[j].className = 'opt';
            }
          }
        }, 1400);
      }
    }
  }
});
