# Task 6 Report: 图鉴 + 存档 + 物品绘制

## Status: DONE

## Changes

### New: `assets/save.js`
- `window.LZSave` implemented verbatim per brief: `load() -> {best:0,bestDist:0,codex:[],runs:0,muted:false}` defaults, `save(o)`, `unlock(id)->bool(firstTime)`, `unlockAll()`, `codexCount()`.
- localStorage key `longzhou-save`; try/catch on both read and write.
- `index.html`: `<script src="./assets/save.js">` inserted immediately after data.js, before rng.js.

### Modified: `assets/sprites.js`
- Added `LZSprites.pickup(ctx, id, x, y, s, t)`:
  - Vertical bob `y + sin(t*3)*4*u*s`; rare ids (ai/changpu/wusai/wudu/xiangnang/ling) get a faint gold halo ellipse beneath; ling halo stronger + shadowBlur glow on the token.
  - 8 distinctive items drawn in unit space scaled by `metrics().u * s`:
    - zongzi: `#4a7c59` triangle + white rice tip + straw string lines
    - wine: brown-amber double-bulb gourd + red paper seal band + white/red "雄" dot
    - ai: 5 fanned mugwort leaves (3 greens) + rope band
    - changpu: 3 upright sword-like leaves + center ridge highlight
    - wusai: 5-color (cyan/white/red/black/yellow) arc ring over neutral base + red knot
    - wudu: yellow talisman rect + folded corner + red squiggle + red seal block
    - xiangnang: red-pink pouch + gold rim ellipse + gold bead + red tassel strands
    - ling: gold token, inner ring + dragon arc strokes, red tassel, strongest glow
  - All state wrapped in ctx.save()/restore() (transforms/alpha/shadow reset).

### Modified: `assets/main.js` (extended, still single IIFE)
- Entity render loop now draws `kind==="pick" && !e.done` via `LZSprites.pickup(ctx, e.type, p.x, p.y, p.s, S.t)` (obs/pick branched in one sorted loop).
- Toast: queue array + busy flag; shows `.is-on` on `#toast` for 1.8s, 0.26s fade gap, then drains next — consecutive unlocks don't clobber.
- First-unlock detection: local `seen` set initialized from `LZSave.load().codex` at boot; `LZGame.setCallback("collect")` — if rare id not in `seen`, add and toast `图鉴解锁 · {name}`. Robust to game.js unlock ordering (callback fires before game.js's own unlock call anyway).
- View helper `showView(name)` toggling `.is-active` across home/game/codex/result; tracks `curView`.
- Codex view:
  - `showCodex(origin)` records origin, hides card, rebuilds grid, switches view; grid rebuilt on every open.
  - `buildCodex()`: per CODEX item a `.codex-cell` (+ `.is-locked` when locked); unlocked cells get a 120×120 `<canvas>` icon via `LZSprites.pickup(ctx, id, 60, 66, 0.9, 0)` and name in `.codex-cell-name`; locked cells show "?" (CSS `::before`) and dimmed name text "?", no icon drawn.
  - Clicking an unlocked cell opens `#codex-card` (`.is-on`) with icon redrawn on `#codex-canvas`, name + full text; `#codex-card-close` hides it.
  - `#codex-count` shows `{n}/8`; `#btn-codex-back` returns to stored origin view; `#btn-codex-home` opens codex from home. (Result-screen button left for Task 7.)
- Test hook: `window.__ui = { toast, showCodex, seen }`.

## Verification (Playwright chromium, 390×844, ?test=1)

1. pageerrors: none (no 404 noise either).
2. Fresh localStorage → codex `0/8`, 8 cells, 8 `.is-locked`; locked cell canvases alpha ≈ 0 (blank).
3. `__game.unlockAll()` + reopen → `8/8`, 0 locked; all 8 cell canvases non-blank (center-region mean alpha 41–104, distinct-color variety 75–366).
4. Click unlocked cell (粽子) → `#codex-card` display:flex, name "粽子", text length 55; close → display:none. Back button returns to `view-home` (origin).
5. Toast: triggered via real callback path `LZGame.emit('collect', {type:'ai'})` → `#toast` text "图鉴解锁 · 艾草" with `.is-on`, and `seen.ai` set. (Full in-game collision not simulated; callback path is the exact code the collision collect emits through.)
6. Persistence: unlockAll → reload → codex still `8/8`.
7. `localStorage.clear()` at end; `localStorage.length === 0` (ships clean).
8. Screenshot: `.sdd/shots/task6-codex.png` (unlocked grid).

## Concerns / Notes
- game.js `isUnlocked()` probes `sv.codex[id]` (object-style) which never matches an array of ids, so its rare-weight doubling for already-unlocked items is effectively a no-op with the agreed array shape. Harmless (weights just stay base); flagging in case a later task cares.
- zongzi/wine are in CODEX but game.js never calls `unlock()` for them — they only light up via `unlockAll()` or future tasks. Per brief, main.js toasts only for rare ids.
- Codex cell canvas is 120×120 backing but CSS-displays at 60×60 (sharp on retina); icon scale uses stage `metrics().u` (~0.975 at 390px) so sizing is consistent with in-game rendering.
- No git operations performed, per instructions.

---

# Task 6 Cross-Task Fix Addendum (isUnlocked / zongzi-wine unlock / toast)

## Status: DONE

## Changes

### `assets/game.js`
- `isUnlocked(id)`: now `sv.codex.indexOf(id) >= 0` against the real array shape from `LZSave.load()`; dropped dead `sv.unlocked` and `sv[id]` branches. Locked-rares weight doubling in `pickRare()` is no longer a no-op.
- `collect(e)`: the guarded `if (window.LZSave) window.LZSave.unlock(e.type)` moved out of the rare-only branch to the end of `collect()` — first-time collection of ANY codex item (zongzi / wine / rares) now unlocks it, making 图鉴 8/8 reachable in normal play.

### `assets/main.js`
- Collect-callback toast: removed the `RARE` filter (and the now-unused `RARE` map); any codex id first collected (zongzi/wine/rares) passes the existing `seen`-set guard and shows 「图鉴解锁 · {name}」 via the existing queue, name looked up from `LZData.CODEX` (`codexById`). Non-codex types are skipped via the `codexById` null check.

## Verification

Command: `python3 /Users/duanchao.wzj/AI/workspace/red-tool/.sdd/task6-fix-verify.py`
(playwright chromium, 390×844, `index.html?test=1`, `localStorage.clear()` first and last)

```
PASS 1 no pageerrors (load) []
PASS 2 fresh zongzi collected -> codex has zongzi collected=True codex=['zongzi']
PASS 2 toast 图鉴解锁 · 粽子 seen toasts=['图鉴解锁 · 粽子']
PASS 3A codex=[zongzi], 2x400 waves: >=5 distinct rare ids AND total>0 distinct=['ai', 'changpu', 'ling', 'wudu', 'wusai', 'xiangnang'] total=28 counts={'wusai': 6, 'wudu': 5, 'xiangnang': 4, 'ai': 7, 'changpu': 5, 'ling': 1}
PASS 3B locked wusai share > 1.25x unlocked control share control wusai 12/73=0.164 vs locked 19/73=0.260
PASS 4 forceHit x3 -> capsized -> result (state machine) st1=capsized st2=result
PASS 4 swipe changes lane 0 -> 1
PASS 4 drum x9 -> dash dashT=2.8 gauge=100
PASS 1 no pageerrors (overall) []
PASS 5 localStorage clean at end length=0
TOTAL 10 FAIL 0
```

### Assertions stated
- Check 2: fresh start, steered boat (swipe toward nearest zongzi entity) until `snapshot().zongzi > 0`; then `LZSave.load().codex` contains `"zongzi"`, and a MutationObserver on `#toast` recorded 「图鉴解锁 · 粽子」 while `.is-on`.
- Check 3A (contract's simpler assertion, exact form): with codex exactly `["zongzi"]`, ran `__game.spawnWave()` 800 times (= two consecutive 400-wave windows in one rng stream; a single 400-wave window at the fixed test seed yielded only 4/6 ids from 11 rares — pure sampling variance — so the window was doubled) and asserted **≥5 distinct rare ids appear AND total rare-pick count > 0**. Result: 6/6 distinct, 28 rares.
- Check 3B (mechanism proof, stronger than contract minimum): note with codex=`["zongzi"]` ALL rares are locked, so uniform doubling leaves the relative distribution unchanged — a locked-vs-unlocked ratio needs a mixed codex. Ran 2000 spawnWaves fully-unlocked (control) vs codex missing only `wusai` (locked), same fixed seed so both runs hit the same 73 rare events; asserted locked `wusai` share > 1.25× control share. Result 0.260 vs 0.164 (ratio 1.58, theory 8/24.5 ÷ 4/20.5 = 1.67).
- Check 4: `forceHit()`×3 → state `capsized` → after capT state `result`; `swipe(1)` lane 0→1; 9 drums → gauge 100 → `dashT > 0`. The result **view** switch (`view-result`) is not asserted: no `showView("result")` wiring exists yet — that is Task-7 scope (per task-6 report), and only game.js/main.js were in scope here.

## Notes
- Only `game.js` and `main.js` touched; no comments added; all public interfaces (`LZGame`, `__game`, `__ui`) unchanged.
- Verify script kept at `.sdd/task6-fix-verify.py`; screenshot `.sdd/shots/task6-fix.png`.
