// 山海御空 游戏展示自动玩家（录制视频用，注入到页面运行）
// 用正确的 __game API：start/movePlayer/useBomb/state；引擎自动开火，主循环自动 step
window.__showcase = (function () {
  var G = window.__game, D = window.SHData;
  if (!G || !G.start) { return { stop: function () {}, state: function () { return null; } }; }
  G.start(0); // 直接进入第一关战斗（view-battle 激活，主循环开始 step）

  var raf = null;
  function step() {
    var S = G.state();
    if (!S) { raf = requestAnimationFrame(step); return; }
    if (S.phase === "win" || S.phase === "lose") { G.start(0); raf = requestAnimationFrame(step); return; }
    if (S.phase !== "play") { raf = requestAnimationFrame(step); return; }

    var p = S.player;
    var tx = p.x, ty = D.H - 90;

    // 躲避最近来袭弹幕（横向闪避）
    var threat = null;
    for (var i = 0; i < S.enemyBullets.length; i++) {
      var b = S.enemyBullets[i];
      if (Math.abs(b.x - p.x) < 42 && b.y > p.y - 170 && b.y < p.y + 40 && b.vy > 0) { threat = b; break; }
    }
    if (threat) {
      tx = p.x + (threat.x > p.x ? -80 : 80);
    } else {
      // 无威胁时：居中小幅摆动，保持画面动感
      tx = D.W / 2 + Math.sin(S.time * 1.6) * 110;
    }
    tx = Math.max(40, Math.min(D.W - 40, tx));
    G.movePlayer(tx, ty);

    // 雷符清屏：场上敌人多时
    if (S.bombs > 0 && S.enemies.length > 6) G.useBomb();

    raf = requestAnimationFrame(step);
  }
  raf = requestAnimationFrame(step);

  return {
    stop: function () { if (raf) cancelAnimationFrame(raf); },
    state: function () {
      var s = G.state();
      return s ? { hp: s.hp, score: s.score, wave: s.waveIdx, phase: s.phase, kills: s.kills } : null;
    }
  };
})();
