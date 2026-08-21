(function () {
  function miniTool() { return window.xhs && window.xhs.miniTool; }

  function fallback() { alert("当前环境暂不支持直接保存，请截图保存哦"); }

  function withFile(fn) {
    var mt = miniTool();
    var st = window.DHShare.lastStats;
    if (!mt || !st || !st.dataUrl) { fallback(); return; }
    mt.writeTempFile({
      data: st.dataUrl,
      success: function (res) { fn(mt, res && res.filePath); },
      fail: fallback
    });
  }

  function makeTitle(n) {
    var t = "我在敦煌拾了" + n + "色";
    if (t.length > 20) t = t.substring(0, 20);
    return t;
  }

  window.DHShare = {
    lastStats: null,
    makeTitle: makeTitle,
    saveAlbum: function () {
      withFile(function (mt, p) {
        mt.saveImageToPhotosAlbum({
          filePath: p,
          success: function () { alert("已保存到相册"); },
          fail: fallback
        });
      });
    },
    postNote: function () {
      withFile(function (mt, p) {
        var st = window.DHShare.lastStats || {};
        mt.postNote({
          title: st.title || makeTitle(st.colorCount || 0),
          content: st.content || "拾取千年矿物色，拼一张敦煌色卡。",
          tags: st.tags || "#国风vibecoding #敦煌 #敦煌色卡 #非遗 #国风 #中式美学",
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
