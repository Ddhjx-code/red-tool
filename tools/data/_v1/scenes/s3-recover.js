/* 实验三：删了为什么还在，以及什么才算真删。
   先让他把删掉的东西捞回来，再让他亲手盖掉。 */

window.regScene({
  tag: '实验三 / 3',
  title: '它<em>还在</em>',
  sub: '同一块硬盘。刚才那六格，你已经删了。',
  next: '看结论',

  build: function (root, api) {
    var DEAD = [8, 12, 13, 21, 29, 34];
    var covered = 0;
    var stage = 'scan1';

    root.innerHTML =
      DU.wall(40, 'is-full') +
      '<div id="say"></div>' +
      '<div id="act" style="margin-top:calc(var(--u)*4)"></div>' +
      '<div id="rest"></div>';

    var wall = DU.q('.wall');
    var sayEl = DU.q('#say');
    var actEl = DU.q('#act');
    var rest = DU.q('#rest');

    /* 把六格变成"已删"：光没了，眼睛还在 */
    for (var d = 0; d < DEAD.length; d++) {
      var b = DU.q('.blk[data-i="' + DEAD[d] + '"]');
      b.className = 'blk is-dead';
    }

    function say(html, cls) {
      sayEl.innerHTML = '<div class="say ' + (cls || '') + '">' + html + '</div>';
    }

    function blkOf(i) {
      return DU.q('.blk[data-i="' + i + '"]');
    }

    /* ---------- 第一次扫描 ---------- */

    actEl.innerHTML =
      '<button class="btn" id="scan" type="button">扫描这块硬盘</button>' +
      '<p class="hint" style="margin-top:calc(var(--u)*2)">市面上那些「数据恢复」软件，做的就是这个</p>';

    DU.q('#scan').addEventListener('click', function () {
      DU.q('#scan').disabled = true;
      DU.q('#scan').textContent = '正在扫描…';
      say('扫描中。它不管目录上有没有名字，只管格子里的内容还在不在。', '');

      var n = 0;
      var timer = window.setInterval(function () {
        if (n >= DEAD.length) {
          window.clearInterval(timer);
          recovered();
          return;
        }
        var b = blkOf(DEAD[n]);
        b.className = 'blk is-dead is-lit';
        DU.poke(b);
        n += 1;
        say('找到第 ' + n + ' 块……', 'is-hi');
      }, 220);
    });

    function recovered() {
      stage = 'ask';
      say('六块全找到了。它们一秒都没离开过。', 'is-ok');
      actEl.innerHTML =
        '<div class="filecard" style="border-color:rgba(52,211,153,.5);background:rgba(52,211,153,.08)">' +
        '<span class="fi" style="border-color:var(--ok)"></span>' +
        '<span class="fn">星际穿越.mp4</span>' +
        '<span class="fs" style="color:var(--ok)">已恢复</span>' +
        '</div>';

      rest.innerHTML =
        '<div class="reveal">' +
        '<p class="reveal-k">内容一直在原地</p>' +
        '<p class="reveal-t">删的只是名字。内容还躺在那些格子里，直到<b>别的东西写进来，把它盖住</b>。</p>' +
        '</div>' +
        '<div class="sec"><span class="sec-n">04</span><span class="sec-t">那怎么才算真删</span></div>' +
        '<p class="say is-hi">下面四个做法，只有一个能让这些内容彻底找不回来。</p>' +
        '<div class="opts" id="opts">' +
        '<button class="opt" type="button" data-k="0"><span class="tag">A</span><span>再删一次，多删两下更彻底</span></button>' +
        '<button class="opt" type="button" data-k="1"><span class="tag">B</span><span>把回收站也清空</span></button>' +
        '<button class="opt" type="button" data-k="2"><span class="tag">C</span><span>往这些格子里写入新数据，把它们盖掉</span></button>' +
        '<button class="opt" type="button" data-k="3"><span class="tag">D</span><span>改个文件名，让它认不出来</span></button>' +
        '</div>' +
        '<div id="ans"></div>';

      DU.q('#opts').addEventListener('click', function (e) {
        var t = e.target;
        while (t && (t.className || '').indexOf('opt') < 0) t = t.parentNode;
        if (!t) return;
        pick(parseInt(t.getAttribute('data-k'), 10));
      });
    }

    /* ---------- 选择 ---------- */

    var answered = false;

    function pick(k) {
      if (answered) return;
      var why = [
        '再删一百次也是同一件事：把目录上那行划掉。划掉的东西已经划掉了。',
        '回收站只是另一层目录。清空它，仍然是划掉一行字。',
        '对。内容之所以在，是因为那几格没被别人占用。写新东西进去，它就被盖掉了 —— 这才是<strong>真的没了</strong>。',
        '名字和内容住的地方不一样。改名字，连目录都没撕，只是换了个标签。'
      ];
      var ok = k === 2;
      var nodes = DU.qa('#opts .opt');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].disabled = true;
        if (i === k) nodes[i].className = 'opt ' + (ok ? 'is-right' : 'is-wrong');
      }
      DU.q('#ans').innerHTML = '<div class="say ' + (ok ? 'is-ok' : 'is-no') + '">' + why[k] + '</div>';

      if (ok) {
        answered = true;
        window.setTimeout(coverUI, 500);
      } else {
        window.setTimeout(function () {
          for (var j = 0; j < nodes.length; j++) {
            if (j !== k) {
              nodes[j].disabled = false;
              nodes[j].className = 'opt';
            }
          }
        }, 1500);
      }
    }

    /* ---------- 覆盖 ---------- */

    function coverUI() {
      rest.innerHTML =
        '<div class="reveal">' +
        '<p class="reveal-k">来，你亲手盖一次</p>' +
        '<p class="reveal-t">点六下，往那六格里写新东西。写满之后，原来的内容就没地方待了。</p>' +
        '</div>' +
        '<div id="coverwrap" style="margin-top:calc(var(--u)*3)">' +
        '<button class="btn" id="cover" type="button">写入新数据（0 / 6）</button>' +
        '</div>' +
        '<div id="final"></div>';

      DU.q('#cover').addEventListener('click', function () {
        if (covered >= DEAD.length) return;
        var idx = DEAD[covered];
        var b = blkOf(idx);
        b.className = 'blk is-over';
        DU.poke(b);
        covered += 1;
        DU.q('#cover').textContent = '写入新数据（' + covered + ' / 6）';
        say('格子 #' + idx + ' 被新数据盖住了。原来的内容没地方待了。', covered === DEAD.length ? 'is-hi' : '');

        if (covered === DEAD.length) {
          DU.q('#cover').disabled = true;
          DU.q('#final').innerHTML =
            '<button class="btn is-ghost" id="scan2" type="button" style="margin-top:calc(var(--u)*2.4)">再扫描一次</button>';
          DU.q('#scan2').addEventListener('click', scanAgain);
        }
      });
    }

    /* ---------- 第二次扫描 ---------- */

    function scanAgain() {
      DU.q('#scan2').disabled = true;
      DU.q('#scan2').textContent = '正在扫描…';
      say('扫描中。同一套方法，同一块硬盘。', '');
      window.setTimeout(function () {
        for (var i = 0; i < DEAD.length; i++) DU.poke(blkOf(DEAD[i]));
        say('扫描完成：<b>0 项可恢复</b>。', 'is-ok');
        /* 刚才那张"已恢复"的卡片必须换掉，否则自己打自己的脸 */
        actEl.innerHTML =
          '<div class="filecard" style="border-color:var(--line);background:var(--panel);opacity:.5">' +
          '<span class="fi" style="border-color:var(--muted)"></span>' +
          '<span class="fn" style="color:var(--muted)">星际穿越.mp4</span>' +
          '<span class="fs">0 项</span>' +
          '</div>';
        rest.innerHTML =
          '<div class="reveal" style="background:rgba(52,211,153,.06);border-color:rgba(52,211,153,.4)">' +
          '<p class="reveal-k" style="color:var(--ok)">这次真没了</p>' +
          '<p class="reveal-t">内容被新数据盖住，扫不出来了。这就是删除的完整含义：<b>不是划掉名字，是让原来的内容没有容身之处</b>。</p>' +
          '</div>' +
          '<div class="say" style="margin-top:calc(var(--u)*3)">所以你卖掉旧手机之前，只点「恢复出厂设置」是不够的 —— 那也只是把目录全划了一遍。要么用大文件把空间写满再删，要么别卖。</div>';
        api.done();
      }, 900);
    }
  }
});
