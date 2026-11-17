/* 实验一：删得有多快。
   核心画面：目录那一行被划掉，四十格纹丝不动，其中两块还眨着眼问"我们不是被删了吗"。 */

window.regScene({
  tag: '实验一 / 3',
  title: '删得有多快',
  sub: '一个 4.2 GB 的电影。按删除，盯着秒表。',
  next: '下一个实验',

  build: function (root, api) {
    var LOCKED = false;

    root.innerHTML =
      '<div class="sec"><span class="sec-n">01</span><span class="sec-t">你的文件夹</span></div>' +
      '<div class="folder">' +
      '<div class="folder-k">/Volumes/DATA/电影</div>' +
      '<div class="filecard" id="fc">' +
      '<span class="fi"></span>' +
      '<span class="fn">星际穿越.mp4</span>' +
      '<span class="fs">4.2 GB</span>' +
      '</div>' +
      '</div>' +
      '<button class="btn is-ghost" id="del" type="button" style="margin-top:calc(var(--u)*2.4)">删除这个文件</button>' +
      '<div class="sec"><span class="sec-n">02</span><span class="sec-t">硬盘 · 四十格，每格 100 MB</span></div>' +
      DU.wall(40, 'is-full') +
      '<div id="after"></div>';

    var fc = DU.q('#fc');
    var del = DU.q('#del');
    var after = DU.q('#after');

    function clockBlock(showCompare) {
      after.innerHTML =
        '<div style="margin-top:calc(var(--u)*5)">' +
        '<div class="clock"><span id="clk">0.00</span><span class="unit">秒</span></div>' +
        '<p class="clockcap" id="cap">这就是删除一个 4.2 GB 文件要用的全部时间。</p>' +
        '</div>' +
        '<div id="bub"></div>' +
        '<div id="ask"></div>';
      DU.countTo(DU.q('#clk'), 0.12, 180, DU.sec2, function () {
        window.setTimeout(react, 260);
      });
    }

    /* 格子开始说话 —— 这一幕的全部意思在这里 */
    function react() {
      var blks = DU.qa('.blk');
      DU.poke(blks[17]);
      DU.poke(blks[22]);
      DU.q('#bub').innerHTML =
        '<div class="bubble"><span class="who">格子 #17</span><br>我们不是被删了吗？</div>' +
        '<div class="bubble"><span class="who">格子 #22</span><br>目录上那行没了。我们还在这儿。</div>';
      DU.q('#cap').textContent = '四十格，一格没动。';
      window.setTimeout(ask, 700);
    }

    function ask() {
      DU.q('#ask').innerHTML =
        '<div class="sec"><span class="sec-n">03</span><span class="sec-t">那你删掉的是什么</span></div>' +
        '<p class="say is-hi">刚才那 0.12 秒里，消失的是下面哪一个？点它。</p>' +
        '<button class="dirrow" id="dir" type="button">' +
        '<span class="strike">/Volumes/DATA/电影/星际穿越.mp4</span><br>' +
        '<span style="color:var(--muted);font-size:calc(var(--u)*2.6)">→ 指向第 4096 块开始的 4.2 GB</span>' +
        '</button>' +
        '<p class="say" style="border:0;padding:calc(var(--u)*1.6) 0;background:none">或者……直接点上面那堆格子。</p>';

      DU.q('#dir').addEventListener('click', right);

      /* 点格子 = 认为是内容被删了 */
      var wall = DU.q('.wall');
      wall.style.cursor = 'pointer';
      wall.addEventListener('click', function (e) {
        var t = e.target;
        while (t && t !== wall && (t.className || '').indexOf('blk') < 0) t = t.parentNode;
        if (!t || t === wall) return;
        DU.poke(t);
        wrong();
      });
    }

    function right() {
      if (LOCKED) return;
      LOCKED = true;
      DU.q('#dir').className = 'dirrow is-right';
      DU.q('#ask').innerHTML =
        '<div class="say is-ok">对。它只是把目录里那一行划掉了。</div>' +
        '<div class="reveal">' +
        '<p class="reveal-k">删除 = 撕掉目录卡</p>' +
        '<p class="reveal-t">内容原封不动待在原地，一个字节都没搬。所以它快得不像话——因为它<b>什么都没做</b>。</p>' +
        '</div>' +
        '<div class="rows">' +
        '<div class="row"><span class="rk">删掉 4.2 GB 用了</span><span class="rv">0.12 秒</span></div>' +
        '<div class="row"><span class="rk">真正搬动 4.2 GB 要</span><span class="rv is-big">下一个实验</span></div>' +
        '</div>';
      api.hint('记住这四十格还是满的');
      api.done();
    }

    function wrong() {
      var s = DU.q('#ask .say.is-hi') || DU.q('#ask .say');
      if (s) {
        s.className = 'say is-no';
        s.textContent = '格子纹丝不动。你删的不是内容，是那行字。再想想。';
      }
    }

    del.addEventListener('click', function () {
      if (del.disabled) return;
      del.disabled = true;
      del.textContent = '正在删除…';
      fc.className = 'filecard is-gone';
      window.setTimeout(function () {
        del.textContent = '已从文件夹移除';
        del.style.display = 'none';
        clockBlock();
      }, 520);
    });
  }
});
