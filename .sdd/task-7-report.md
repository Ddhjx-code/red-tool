# Task 7 Report: 首页 + 结算屏 + 称号 + 知识卡

## Status: DONE — 15/15 headless checks PASS + supplement paths PASS

## Changes

### assets/game.js
- Added `pause()`：仅 `state==="playing"` → `"paused"`，并 emit `"pause"`。
- Added `resume()`：仅 `"paused"` → `"playing"`，并 emit `"resume"`。
- 两者挂到 `window.LZGame`。暂停时 `update()` 天然冻结（只推进 playing/capsized）。

### assets/main.js（重写引导段，其余渲染/HUD/图鉴接线原样保留）
1. **视图机**：移除临时 boot（删掉强制 view-game 切换 + 自动 `LZGame.start()`）。`showView(name)` 统一切换 `#view-home/#view-game/#view-codex/#view-result` 的 `.is-active`；boot → `showView("home")` + `renderHome()`。`renderHome()`：best>0 时 `#home-best = "最佳 {best} 分 · {bestDist}m"`，否则置空。
2. **开局流程**：`startRun()` = LZSave runs+1 持久化 → 清空 `#tutor`（含定时器）→ 隐藏 pause-mask → `showView("game")` → `LZGame.start()`。`#btn-start` 与 `#btn-again` 均走此函数。
3. **暂停**：`visibilitychange` hidden 且 playing → `LZGame.pause()`；mask 由 game 的 `"pause"/"resume"` 事件驱动显隐（无论暂停来自 visibilitychange 还是直接调 `LZGame.pause()` 都能显示）。`#btn-resume` → 隐藏 mask + resume；`#btn-quit` → 隐藏 mask + 回首页 + renderHome（state 保持非 playing，下次 start 重置）。
4. **结算渲染** `fillResult()`（监听 `"result"` 事件）：
   - score=floor(scoreFrac)；称号 = TITLES 降序首个 `score>=min`；
   - 填充 `#result-title/-dist(floor+"m")/-score/-zongzi/-combo(maxCombo)`；
   - best 提升 → 写回 LZSave 且 `#result-best="新纪录！"`，否则显示 `"最佳 {best} 分 · {bestDist}m"`；
   - `#result-know`：已解锁图鉴（LZSave.codex ∩ LZData.CODEX）经 `LZRng(Date.now()>>>0)` 抽取，显示 `《{name}》{text}`；无解锁则 `FACTS[runs % FACTS.length]`；
   - `#result-codex = "图鉴 {n}/8"`；最后 `showView("result")`。
5. **结算按钮**：`#btn-home-result` → home + renderHome；`#btn-codex-result` → `showCodex("result")`（沿用 Task 6 origin 跟踪，返回回结算屏）。
6. **教学**：runs===1 首局开局 `#tutor="左右滑动 换线"`，3s 后 `"连点右下鼓面 攒满冲刺"`，首个 `"dash"` 事件清定时器并清空文本（`:empty` 自动隐藏）。

## Verification（python3 + playwright，390×844，?test=1，首尾 localStorage.clear）
脚本：`.sdd/task7-verify.py`，15 项全 PASS：
1. 无 pageerror（audio/share 404 不计）。
2. Boot：`#view-home.is-active`、state==="home"、`#btn-start` 可见、新存档 home-best 为空。
3. 点 `#btn-start` → view-game active、playing、storage runs===1。
4. 教学：首段文案 → 3.2s 后第二段 → 击鼓攒满冲刺后 tutor 清空（dashT>0）。
5. forceHit×3 → 1.8s 后 `#view-result.is-active`；title/dist/score/zongzi/combo/know/codex 全非空；称号 ∈ 五个称号（实测「见习桨手」）；`图鉴 0/8` 匹配正则。
6. best 持久化（71>0），首局 `result-best="新纪录！"`。
7. `#btn-again` → playing（runs=2、无教学）；`LZGame.pause()` → mask 显示 + state paused；`#btn-resume` → playing。
8. 二次翻船后 `#btn-home-result` → 首页激活且 home-best = 「最佳 71 分 · 71m」。
9. 截图：`.sdd/shots/task7-home.png`、`.sdd/shots/task7-result.png`。

### 补充验证（单独脚本，均 PASS）
- 预置 codex=['zongzi','ling'] → 知识卡走图鉴路径 `《粽子》古称角黍…`，`图鉴 2/8`。
- 预置 best=9999 → 低分局 `result-best="最佳 9999 分 · 800m"` 且存储不被覆盖；home-best 渲染同格式。
- `visibilitychange`（非 hidden）不会误暂停。
- `#btn-codex-result` → 图鉴 → 返回回到 result 视图（origin 跟踪正确）。

## Concerns
- 暂停 mask 由 game 事件驱动而非仅在 visibilitychange 处理函数内显示，行为覆盖规范两种触发方式；若后续有音频/分享任务（audio.js/share.js 目前缺失，index.html 引用产生 404）接入，`#btn-mute-home`、`#btn-save-album`、`#btn-post-note` 尚无监听，属后续任务范围。
- 知识卡随机用 `Date.now()` 作种子，符合「禁 Math.random」约束。

## No git — 未提交。
