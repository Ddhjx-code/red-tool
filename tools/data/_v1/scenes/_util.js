/* 场景公用小工具。
   注册器放在这里而不是 engine.js：场景文件先于引擎加载，必须能先把自己挂上去。 */

window.SCENES = window.SCENES || [];

window.regScene = function (s) {
  window.SCENES.push(s);
};

window.DU = {
  /* 一面数据墙。每格都带眼睛 —— 它是这整个工具的主角。 */
  wall: function (n, cls) {
    var s = '';
    for (var i = 0; i < n; i++) {
      s +=
        '<div class="blk ' +
        (cls || 'is-full') +
        '" data-i="' +
        i +
        '"><i class="eye"></i><i class="eye"></i></div>';
    }
    return '<div class="wall">' + s + '</div>';
  },

  q: function (sel, root) {
    return (root || document).querySelector(sel);
  },

  qa: function (sel, root) {
    return (root || document).querySelectorAll(sel);
  },

  /* 数字飞起来。删除的 0.12 秒和下载的 3 分 52 秒都用它。 */
  countTo: function (node, target, ms, fmt, done) {
    var start = new Date().getTime();
    var id = window.setInterval(function () {
      var t = Math.min(1, (new Date().getTime() - start) / ms);
      node.textContent = fmt(target * t);
      if (t >= 1) {
        window.clearInterval(id);
        node.textContent = fmt(target);
        if (done) done();
      }
    }, 16);
  },

  mmss: function (sec) {
    var s = Math.round(sec);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' + r : r);
  },

  sec2: function (v) {
    return v.toFixed(2);
  },

  /* 点一下有个"砰"的反馈 */
  poke: function (node) {
    node.className += ' is-poke';
    window.setTimeout(function () {
      node.className = node.className.replace(' is-poke', '');
    }, 340);
  }
};
