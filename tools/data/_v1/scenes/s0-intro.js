/* 开场。先立一个"你以为"的靶子。 */

window.regScene({
  tag: '三个实验',
  title: '你以为你<em>删了</em>',
  sub: '三个实验，每个二十秒。做完再看「删除」这两个字，意思会不太一样。',
  next: '开始第一个实验',

  build: function (root, api) {
    root.innerHTML =
      DU.wall(40, 'is-full') +
      '<p class="say">这是你的硬盘。四十格，每格住着一点东西——一张照片、一段聊天、一个电影。</p>' +
      '<p class="say is-hi">下面三个实验都是你自己动手。第一件事：删掉一个 4.2 GB 的电影。</p>';

    api.done();
  }
});
