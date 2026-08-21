### Task 6: 图鉴 + 存档 + 物品绘制

**Files:**
- Create: `assets/save.js`（新增，index.html 在 data.js 后加载）
- Modify: `assets/sprites.js`（8 种物品）、`assets/main.js`（图鉴视图）、`assets/style.css`

**Interfaces:**
- Produces: `window.LZSave`：`load() -> {best,bestDist,codex:[],runs,muted}`、`save(o)`、`unlock(id) -> bool(是否首次)`、`unlockAll()`、`codexCount()`

- [ ] **Step 1: save.js**

```js
(function () {
  var KEY = "longzhou-save";
  function load() {
    try { var o = JSON.parse(localStorage.getItem(KEY) || "{}"); return { best: o.best || 0, bestDist: o.bestDist || 0, codex: o.codex || [], runs: o.runs || 0, muted: !!o.muted }; }
    catch (e) { return { best: 0, bestDist: 0, codex: [], runs: 0, muted: false }; }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  window.LZSave = {
    load: load, save: save,
    unlock: function (id) { var o = load(); if (o.codex.indexOf(id) >= 0) return false; o.codex.push(id); save(o); return true; },
    unlockAll: function () { var o = load(); o.codex = window.LZData.CODEX.map(function (c) { return c.id; }); save(o); },
    codexCount: function () { return load().codex.length; }
  };
})();
```

- [ ] **Step 2: sprites.js 物品绘制**（`pickup(ctx, id, x, y, s, t)`，上下浮动 `y + sin(t*3)*4u*s`，稀有物底部淡金光圈）：
- zongzi：箬叶绿 `#4a7c59` 三角粽 + 白米尖 + 缠线
- wine：褐黄葫芦瓶 + 红封纸 + 「雄」字点
- ai：一束青绿艾叶（3-5 片裂叶）+ 麻绳扎口
- changpu：3 片直立剑形绿叶
- wusai：五色（青白红黑黄）编绳圆环
- wudu：黄符纸 + 朱红印纹 + 折角
- xiangnang：红粉荷包 + 金边 + 下垂流苏
- ling：金色圆牌 + 龙纹弧线 + 红穗，光晕最强

- [ ] **Step 3: main.js 图鉴视图**：网格渲染 8 格（已解锁：canvas 120×120 画 `LZSprites.pickup` + 名称；未解锁：灰底「?」）；点已解锁 → `codex-card` 弹层显示全文；`codex-count` = `x/8`；返回按钮回来源视图（home 或 result，记录来源）。
- [ ] **Step 4: 解锁 toast**：`LZGame.setCallback("collect")` 内若 `LZSave.unlock` 返回 true → toast「图鉴解锁 · {name}」（toast 组件：显示 1.8s，队列）。
- [ ] **Step 5: 无头验证**：`__game.unlockAll()` → 图鉴 8/8 全亮、点开展开文案；清 localStorage 后回到 0/8；收集稀有（注入）触发 toast。
- [ ] **Step 6: Commit**

---

