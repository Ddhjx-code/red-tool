# Task 3 Report: 提色交互 + 图鉴

## Status: DONE — 27/27 headless checks pass

## Files changed
- `tools/dunhuang/assets/extract.js` (NEW, window.DHExtract)
- `tools/dunhuang/assets/main.js` (REPLACED temp boot with full wiring)
- `tools/dunhuang/assets/mural.js` (added `dustAtPoint(x,y)` helper + export)
- `tools/dunhuang/assets/style.css` (codex swatch/cell-canvas rounded corners, `.codex-hex`)
- `.sdd/dh-task3-verify.py` (NEW verification script)

## Implementation notes

### extract.js (DHExtract)
- State: current `muralId`, per-shape `extracted` set (mirrors DHMural.markExtracted), flying-anim queue, toast queue (single owner; `toastState()` consumed by main each frame).
- `tap(x,y)`: hitTest → none = return; **dust gate via `DHMural.dustAtPoint`** (dust-layer alpha > 32 at tap point) → toast「拂去浮尘，方见其色」; else extract.
- `extract`: markExtracted → 0.6s eased parabolic flying anim from tap point to `#palette-bar` anchor → `DHSave.unlock` → emit `collected {color, first, hidden}` → first-time knowledge toast（hidden 加「发现隐藏色 · 」前缀）→ all-shapes check → emit `alldone` + toast「此壁画颜色拾尽」.
- `checkDust()` (called throttled ~150ms by main): every dusty unextracted shape with `dustProgress >= DUST_DONE (0.85)` auto-extracts from shape center (designToCanvas), toast「拂尘见色 · {名}」.
- `palette()` returns save-codex color ids in COLORS order (persists across murals).
- `snapshot()` = {muralId, extractedCount, totalCount, anims}. `setCallback('collected'|'alldone')`.

### main.js
- `setView` toggling `.view.is-active`; view machine for home/select/extract/build/codex.
- Home: progress「已集 n/18 色 · 成卡 X 张」rendered at boot + on return.
- Select: 3 mural cards, 120×120 thumbnails rendered via DHMural.load+draw on main canvas then `drawImage` crop of the design square (dpr-aware), name/era/progress `{unlocked-color-shapes}/{total}`.
- Extract: rAF loop = DHExtract.update + DHMural.draw + drawFx + throttled checkDust + palette/toast render. Pointer: down records origin; move interpolates `dustAt` every ~6px while down; up with move <12px → tap.
- Codex (mirrors qiqiao): 18-cell grid rebuilt each open, unlocked = rounded color swatch canvas + ink outline + name, locked = `.is-locked` "?"; detail card = 120×120 swatch + name + hex + text; origin-based back (home→refresh progress / extract→extract view); `#codex-count` n/18.
- `#btn-build` guard: empty palette → toast「先去拾色」and stay (Task 4 will wire build controls).

### Carryover fixes (both verified)
1. **Resize-after-activation**: `showExtract()` calls `DHMural.resize()` one rAF after activating the view (also on codex→extract re-entry). Verified at a 430×932 viewport: `DHMural.metrics().W == 430` (not the 390 fallback).
2. **Dust gate by tap-point dust alpha**: `dustAtPoint` samples dust-layer alpha (device-px, >32 = dusty), blocking taps on dusty shapes AND shapes under another shape's dust bbox.

## Verification (`.sdd/dh-task3-verify.py`, 390×844 @dpr2, ?test=1, localStorage cleared first+last)
1. No pageerrors (audio.js/card.js 404s expected, not pageerrors) ✔
2. Home→start: 3 cards, thumbnails non-blank (pixel-sampled) ✔
3. zaojing → extract active, backing store 780 = 390×dpr ✔
4. Gold center: **note below** → jin unlocked, toast「发现隐藏色 · 金｜金箔/泥金…」, flying anim queued (snapshot().anims≥1), gold palette dot ✔
5. Tap (6,6): qingshi unlocked, toast「石青｜蓝铜矿…」 ✔
6. Tap dusty shilv corner (35,35) before wiping: toast「拂去浮尘，方见其色」, shilv NOT unlocked ✔
7. Wipe strokes across shilv square → dustProgress 1.0 ≥ 0.85 → shilv auto-unlocks, toast「拂尘见色 · 石绿」 ✔
8. Tapped remaining shapes (zhusha/cihuang/zheshi) → alldone spy fired once, toast「此壁画颜色拾尽」, codex == 6 ✔
9. Codex from extract: 6/18, 6 unlocked + 12 locked, swatch painted, detail card「石青#2F5D9E」+ text, back → extract ✔
10. Reload: home「已集 6/18 色 · 成卡 0 张」, codex still 6/18 ✔
11. Screenshots: `.sdd/shots/dh3-extract.png`, `.sdd/shots/dh3-codex.png` ✔

## Concerns / notes
- **Test-4 sequencing vs carryover #2**: the gold (jin) circle sits under the shilv dust bbox, and the mandated dustAtPoint gate correctly blocks a raw tap there. The verify script therefore wipes a short stroke across the center first (clearing dust at the tap point, ~<10% progress so shilv does not auto-unlock), then taps — this exercises both the gate and the hidden-color path. Real players will naturally wipe-then-tap.
- Codex card name renders as「石青#2F5D9E」(name + `<small class="codex-hex">`), matching the "name + hex" spec.
- Mural-card progress counts shapes whose color is already in the save codex (per-shape session state isn't persisted; only the codex is).
- Build/result views remain unwired (Task 4/5); only the empty-palette guard + view switch exist for `#btn-build`.
