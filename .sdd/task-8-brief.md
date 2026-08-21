### Task 8: 分享出口

**Files:**
- Create: `assets/share.js`
- Modify: `assets/main.js`（按钮绑定）

**Interfaces:**
- Consumes: `LZData`、`LZSprites.pickup`（卡片上画粽子点缀）、结算 stats
- Produces: `LZShare.paintCard(stats) -> dataURL`、`LZShare.saveAlbum()`、`LZShare.postNote()`

- [ ] **Step 1: share.js**

```js
(function () {
  var D = window.LZData;
  function paintCard(st) {
    var c = document.createElement("canvas"); c.width = 900; c.height = 1200;
    var g = c.getContext("2d");
    // 宣纸底 #F5F0E6；朱红双线边框（内缩 36px）
    // 顶部竖排小字「非遗手作坊 · 端午」；主标题「龙舟破浪」楷体 96px 黛青居中
    // 朱红方章（150×150，旋转 -6°）内白字称号（st.title）
    // 战绩区：航程/总分/粽子/最高连击 四行大字（数字 72px 黛青 + 标签 28px）
    // 知识卡：白底圆角片，题目 + 换行正文（手动按 14 字/行折行，行高 44）
    // 底部：图鉴 {n}/8 + 「龙舟破浪 · 端午竞渡」小字
    return c.toDataURL("image/png");
  }
  function miniTool() { return window.xhs && window.xhs.miniTool; }
  function fallback() { alert("当前环境暂不支持直接保存，请截图保存哦"); }
  function withFile(fn) {
    var mt = miniTool(); var dataUrl = paintCard(window.LZShare.lastStats);
    if (!mt || !dataUrl) { fallback(); return; }
    mt.writeTempFile({ data: dataUrl, success: function (res) { fn(mt, res.filePath); }, fail: fallback });
  }
  window.LZShare = {
    lastStats: null,
    paintCard: paintCard,
    saveAlbum: function () { withFile(function (mt, p) { mt.saveImageToPhotosAlbum({ filePath: p, success: function () { alert("已保存到相册"); }, fail: fallback }); }); },
    postNote: function () {
      withFile(function (mt, p) {
        mt.postNote({
          title: "我在端午划了 " + window.LZShare.lastStats.distText,
          content: "击鼓奋楫，破浪夺标。来《龙舟破浪》划一局，攒端午图鉴。",
          tags: "#国风vibecoding #端午 #龙舟 #非遗 #国风 #中式美学",
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
```

折行函数需完整实现（按字符宽度逐字测量或固定 14 字换行 + 标点避头尾从简）。

- [ ] **Step 2: main.js**：结算时 `LZShare.lastStats = {...}`；`btn-save-album`/`btn-post-note` click 绑定（用户手势触发）。
- [ ] **Step 3: 无头验证**：无 `window.xhs` 时点击 → dialog 出现且文案为降级提示；注入 mock `window.xhs.miniTool`（记录调用）→ 断言 writeTempFile→postNote 顺序与参数（title ≤20 字、mediaInfo 结构合法）；`paintCard` 返回 `data:image/png` 且尺寸 900×1200（解码检查）。
- [ ] **Step 4: Commit**

---

