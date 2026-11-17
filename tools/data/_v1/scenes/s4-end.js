/* 结算。三句话，玩家刚刚亲手验过。 */

window.regScene({
  tag: '结算',
  title: '所以你删的<br>到底是什么',
  next: '再看一遍',

  build: function (root, api) {
    root.innerHTML =
      '<p class="endmark">三个实验 · 全部完成</p>' +
      '<div class="creed">' +
      '<div class="creed-row">' +
      '<span class="creed-n">01</span>' +
      '<span class="creed-t">删得快，是因为它<b>什么都没做</b>。只把目录里那一行划掉了，四十格一个字节都没动。</span>' +
      '</div>' +
      '<div class="creed-row">' +
      '<span class="creed-n">02</span>' +
      '<span class="creed-t">下得慢，是因为每一块数据都得<b>真的走过那条线</b>。搬东西要时间，撕目录不用。</span>' +
      '</div>' +
      '<div class="creed-row">' +
      '<span class="creed-n">03</span>' +
      '<span class="creed-t">删完还在，是因为内容一直躺在原地，等着被别的东西<b>盖住</b>。盖住之前，它随时能被捞出来。</span>' +
      '</div>' +
      '</div>' +
      '<div class="tail">所以卖旧手机、旧硬盘之前，别只点「恢复出厂设置」——那也只是把目录全划了一遍。要么用大文件把空间写满再删，要么别卖。</div>' +
      '<p class="say" style="border:0;background:none;padding-left:0;color:var(--muted);font-size:calc(var(--u)*3.1)">这三个结论你都亲手验过：删过、搬过、也捞回来过。</p>';

    api.done();
  }
});
