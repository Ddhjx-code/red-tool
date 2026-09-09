'use strict';

  /* ========================== [ENGINE] ============================
     Pure node-graph logic. No DOM, no canvas. §3.1 semantics verbatim.
     ================================================================ */
  var YGEngine = (function () {
    var RESOLVE = "RESOLVE";
    var WARMTH_MAX = 3;     /* §3.4 暖意三度 */
    var HARVEST_MAX = 2;    /* §3.5 记曲/观舞 上限 = 可达最大值 */
    var PATH_NOMINAL = 7;   /* visual pacing constant for bridge decay */

    var DATA = null;
    var S = null;

    function fresh() {
      return { nodeId: "start", warmth: WARMTH_MAX, tune: 0, dance: 0, path: ["start"], outcome: "" };
    }

    function init(data) { DATA = data; S = fresh(); }

    function isEnding(id) { return !!(DATA && DATA.endings && DATA.endings[id]); }
    function node(id) { return (DATA && DATA.nodes) ? DATA.nodes[id] : null; }
    function currentNode() { return node(S.nodeId); }
    function currentEnding() { return (DATA && DATA.endings) ? DATA.endings[S.nodeId] : null; }

    /* §4 resolution — SEQUENTIAL priority, never parallel ifs */
    function resolveEnding() {
      if (S.warmth <= 0) return "end_weiru";
      if (S.tune === HARVEST_MAX) return "end_nichang";
      if (S.dance === HARVEST_MAX) return "end_banyue";
      return "end_banyue";
    }

    /* §3.1 transition — exact order: next, deltas, RESOLVE, warmth override */
    function choose(i) {
      if (!DATA) return null;
      var from = S.nodeId;
      var nd = node(from);
      if (!nd || !nd.choices || !nd.choices[i]) return null;
      var choice = nd.choices[i];

      S.nodeId = choice.next;
      if (typeof choice.warmth === "number") S.warmth = Math.min(WARMTH_MAX, S.warmth + choice.warmth);
      if (typeof choice.tune === "number") S.tune = Math.min(HARVEST_MAX, S.tune + choice.tune);
      if (typeof choice.dance === "number") S.dance = Math.min(HARVEST_MAX, S.dance + choice.dance);

      if (S.nodeId === RESOLVE) S.nodeId = resolveEnding();
      if (S.warmth <= 0) S.nodeId = "end_weiru";   /* 资源耗尽 → 强制终局, overrides everything */

      if (!isEnding(S.nodeId)) S.path.push(S.nodeId);
      S.outcome = (typeof choice.outcome === "string") ? choice.outcome : "";
      return { choice: choice, from: from };
    }

    function goto(id) {
      if (!DATA) return;
      S.nodeId = id;
      S.outcome = "";
    }

    function reset() { S = fresh(); }

    function state() {
      return { nodeId: S.nodeId, warmth: S.warmth, tune: S.tune, dance: S.dance };
    }

    function resources() { return { warmth: S.warmth, tune: S.tune, dance: S.dance }; }

    function walked() { return S.path.length; }

    /* journey fraction — drives 「却顾其桥，随步而灭」 (§6.3) */
    function progress() {
      var p = (S.path.length - 1) / PATH_NOMINAL;
      return p < 0 ? 0 : (p > 1 ? 1 : p);
    }

    function outcomeText() { return S.outcome; }

    return {
      init: init, reset: reset, choose: choose, goto: goto,
      state: state, resources: resources, walked: walked, progress: progress,
      isEnding: isEnding, node: node, currentNode: currentNode,
      currentEnding: currentEnding, resolveEnding: resolveEnding,
      outcomeText: outcomeText,
      limits: { warmth: WARMTH_MAX, harvest: HARVEST_MAX },
      data: function () { return DATA; }
    };
  })();
