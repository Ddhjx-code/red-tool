### Task 4: 游戏核心——移动、生成器、碰撞、翻船

**Files:**
- Modify: `assets/game.js`（主体）、`assets/sprites.js`（障碍绘制）

**Interfaces:**
- Produces: 完整 `LZGame`（start/update/swipe/drum/snapshot/setCallback）、`window.__game` 测试钩子、实体结构 `{kind:'obs'|'pick', type, lane, z, done, drift?}`

- [ ] **Step 1: game.js 扩展状态与速度**

S 增加字段：`speed, score, scoreFrac, zongzi, combo, maxCombo, steady, gauge, dashT, invT, capT, entities, sinceSpawn, lastDrumAt, rng`。
- `start()`：`rng = LZRng(testMode ? 20260818 : (Date.now() >>> 0))`（testMode = `[?&]test=1/.test(location.search)`），重置全部字段，`steady=3`
- `baseSpeed(d) = D.BASE_SPEED + (D.MAX_SPEED - D.BASE_SPEED) * Math.min(1, d / D.SPEED_RAMP_DIST)`
- update 推进：`sp = baseSpeed(S.dist) * (S.dashT > 0 ? D.DASH_MULT : 1)`；`S.dist += sp*dt`；`S.scoreFrac += sp*dt`（里程分）；`S.speed = sp`

- [ ] **Step 2: 生成器**

```js
function spawnGap(d) { return Math.max(D.GAP_MIN, D.GAP_MAX - d / D.GAP_RAMP * (D.GAP_MAX - D.GAP_MIN)); }

function spawnWave() {
  var z = D.Z_MAX;
  var roll = S.rng.next() * 100;
  var d = S.dist;
  if (roll < 30) { push("obs", S.rng.pick(["rock", d > 200 ? "whirl" : "rock", d > 500 ? "log" : "rock"]), S.rng.int(-1, 1), z); }
  else if (roll < 50 && d > 150) { var free = S.rng.int(-1, 1); for (var l = -1; l <= 1; l++) if (l !== free) push("obs", "rock", l, z); }
  else if (roll < 72) { var ln = S.rng.int(-1, 1); for (var k = 0; k < 3; k++) push("pick", "zongzi", ln, z + k * 6); }
  else if (roll < 90) { var ob = S.rng.int(-1, 1); push("obs", "rock", ob, z); var pl = ob + (ob === 1 ? -1 : 1); push("pick", "zongzi", pl, z); push("pick", "zongzi", pl, z + 6); }
  else if (roll < 96) { push("pick", "wine", S.rng.int(-1, 1), z); }
  else { push("pick", pickRare(), S.rng.int(-1, 1), z); }
}
```

- `push(kind, type, lane, z)`：`S.entities.push({kind, type, lane, z, done:false, drift: type==="log" ? (S.rng.next()<0.5?-1:1)*0.35 : 0})`
- `pickRare()`：按权重抽——未解锁稀有物（含 ling）权重 ×2；权重表：每个 rare 4，ling 0.5；已解锁的 rare 权重 4 保持（可重复收集得分）
- update 内：`S.sinceSpawn += sp*dt; if (S.sinceSpawn >= spawnGap(S.dist)) { S.sinceSpawn = 0; spawnWave(); }`
- 实体推进：`e.z -= sp*dt`；log 漂移：`e.laneF = (e.laneF==null? e.lane : e.laneF) + e.drift*dt`，clamp [-1,1]（碰撞用 `Math.round(e.laneF)`）；`e.z < -12` 移除
- **硬约束自检**：任一 wave 内 obs 最多占 2 航道（上面代码已保证），无头遍历断言

- [ ] **Step 3: 碰撞与受击/翻船**

```js
function boatLane() { return Math.round(S.boatX); }
function collide(e) {
  if (e.done) return;
  var inZ = e.z < 6 && e.z > -2;
  if (!inZ) return;
  if (e.kind === "obs") {
    var el = Math.round(e.laneF != null ? e.laneF : e.lane);
    if (el !== boatLane()) return;
    if (S.dashT > 0) { e.done = true; addScore(50); emit("hit", {smash:true}); return; }
    if (S.invT > 0) return;
    e.done = true; S.steady--; S.invT = D.HIT_INV; S.combo = 0; emit("hit", {});
    if (S.steady <= 0) capsize();
  } else {
    if (Math.abs(S.boatX - e.lane) > 0.6) return;
    e.done = true; collect(e);
  }
}
function capsize() { S.state = "capsized"; S.capT = 1.4; emit("capsize"); }
```

- capsized 状态 update：`S.capT -= dt`，船 tilt 从 0→1.1 弧度、下沉（main 用 snapshot 渲染）；`capT<=0` → `S.state="result"; emit("result")`

- [ ] **Step 4: sprites.js 障碍绘制**

`obstacle(ctx, type, x, y, s, t)`：
- rock：深灰 `#3a424d` 不规则五边形（固定形状参数）+ 底部白色泡沫椭圆弧
- whirl：黛青深底椭圆 + 3 条旋转螺旋弧（相位 = t*3），中心深点
- log：棕色 `#7a5a3a` 圆角矩形横置（宽 90u*s 高 16u*s）+ 两端年轮圆 + 水线白边

- [ ] **Step 5: `window.__game` 测试钩子**（testMode 或始终暴露，文档注明）

```js
window.__game = {
  snapshot: function () { var o = {}; for (var k in S) if (k !== "entities" && k !== "rng") o[k] = S[k]; o.entities = S.entities.length; return o; },
  start: function () { window.LZGame.start(); },
  swipe: function (d) { window.LZGame.swipe(d); },
  drum: function () { window.LZGame.drum(); },
  setDist: function (m) { S.dist = m; },
  addScore: function (n) { addScore(n); },
  forceHit: function () { if (S.invT > 0) S.invT = 0; S.steady--; S.combo = 0; emit("hit", {}); if (S.steady <= 0) capsize(); },
  capsize: capsize,
  spawnWave: spawnWave,
  unlockAll: function () { window.LZSave.unlockAll(); },
  save: function () { return window.LZSave.load(); }
};
```

（`LZSave` 在 Task 6 定义；本任务先引用，Task 6 落地。）

- [ ] **Step 6: main.js 临时循环接实体渲染**：遍历 `S.entities` 投影绘制（obs 用 sprites.obstacle）；受击时 `LZScene.addSplash` + 画面抖动（canvas translate 随机种子偏移 0.2s）。
- [ ] **Step 7: 无头验证**：start → 2s 后 entities>0；`setDist(300)` 后 spawn 含 whirl；`forceHit()`×3 → state 经 capsized → result；遍历 200 个 spawnWave 断言每 wave obs 航道数 ≤2。
- [ ] **Step 8: Commit**

---

