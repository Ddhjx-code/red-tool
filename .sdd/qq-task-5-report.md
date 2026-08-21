# Task 5 Report: 显影动画 + 针渲染

## Status: PASS

## Changes

### tools/qiqiao/assets/main.js (render loop)
- `drawNeedle(s)`: silver needle (#dfe6ee, 40u long, 2.2u wide, white bright tip).
  - Falling (needleY<1): y = floatY − (1−needleY)·(80u + basinRy·0.85) — equals the spec's `basinY − basinRy − (1−needleY)·80u` at needleY=0 but stays continuous with the floating position at landing (no 50px pop); rotation −0.3·(1−needleY) rad settling to 0; faint motion-hint line above.
  - Floating (needleY≥1, drop/reveal/result): horizontal at (cx, basinY − basinRy·0.15) + faint shimmer reflection line 4u below (alpha oscillates via sin(s.t·3), deterministic).
- `drawReveal(s)`: shadow at (cx, basinY + basinRy·0.25) — beneath the needle; clipped to the water ellipse (same geometry as scene.js).
  - alpha = 0.85·revealP^1.4; size = basinRy·1.15·(0.85+0.15·revealP), clamped to waterRy·1.9.
  - Blur→sharp: 3 ghost passes of QQShadow.draw at 120°-spaced offsets of (1−revealP)·6u, ghost alpha = alpha·(1−revealP) (→0 continuously at revealP=1), plus the main pass; result phase renders a single crisp draw at alpha 0.85.
- result auto-transition: on `result` callback setTimeout 1200ms → setView("view-result") (adds is-active there, removes from #view-ceremony); timer cleared on every new `start` and re-armed per result (double-fire guard).

### tools/qiqiao/assets/scene.js
- `metrics()` now also exposes `waterRx`, `waterRy` (needed for the clip geometry).

### tools/qiqiao/assets/divine.js (one necessary deviation)
- `computeResult()` moved from reveal-END to reveal-START (drop→reveal transition). Reason: the reveal animation must draw `result.shadowId`, but the old state machine only computed the result when revealP hit 1 — the shadow to display was unknowable during reveal. Observable event order (`revealed`/`result` emitted at reveal end) is unchanged; inputs (calmValue, rng, save) don't change during reveal, so the outcome is identical.

## Verification (Playwright, chromium, 390×844, ?test=1, localStorage cleared first+last)
Full run driven via __game: start → holdWater until calm → releaseCalm at phasePos≈0.95 (calmValue 85) → drop → reveal → result. Seeded shadow: **jinyu**.

| Check | Result |
|---|---|
| pageerrors | none (only ignorable 404s: audio.js, share.js — other tasks' files) |
| Needle mid-fall (needleY≈0.3, y≈427px above basin) | 82 bright px along path ✓ |
| Needle floating at water center | 122 bright px ✓ |
| Coverage abs (lum<55, water-masked) revealP 0.18 → 0.74 | 0 → 498 px ✓ increase |
| Ink mass (Σ darkening vs pre-reveal ref) p 0.18→0.27→0.74→0.93 | 3592 → 5346 → 11212 → 12873 ✓ monotonic |
| Core box avg luminance p0.18 → p0.74 | 75.0 → 66.2 ✓ darkens |
| Blur spread (dark-px bbox width) p0.27 vs p0.93 | raw 50 → 48 px; size-normalized 56.1 → 48.5 ✓ shrinks |
| result +1.2s → #view-result.is-active, #view-ceremony not | ✓ |

Notes on measurement: at revealP≈0.2 the ink is genuinely sub-threshold faint (alpha≈0.08) — dark-pixel count is 0 there by design of the ease; differential measurement vs a pre-reveal reference frame (min of 3 grabs, ripple-safe) shows the faint wide halo (496 px >3-lumen darkening) that later converges into the crisp core (326 px, ~4× darker). Measurements masked to the water ellipse to exclude sky below the basin.

## Screenshots
- .sdd/shots/qq5-drop.png (needle mid-fall, needleY≈0.3)
- .sdd/shots/qq5-reveal-mid.png (revealP≈0.5, shadow half-formed)
- .sdd/shots/qq5-reveal-full.png (result phase, crisp shadow + floating needle)

## Concerns
- divine.js change (result computed at reveal start) is a state-machine tweak outside the stated file scope — flagged for review; Task 6 consumers of the `result` callback are unaffected.
- Ghost-blur alpha uses `alpha·(1−revealP)` per pass (slightly stronger than a naive /3 split) so the blur is measurable; visually still a subtle defocus.
- #view-result is empty until Task 6 wires content — expected.

## Fix note (post-review hardening)
Change: divine.js reveal-completion branch — added `if (!S.result) { S.result = computeResult(); }` before emit('revealed')/emit('result'). Covers `__game.forcePhase('reveal')` fast-forward, which skips the drop→reveal transition where computeResult() normally runs (previously emitted 'result' with S.result null and skipped the QQSave write).

Re-verification (python3 + playwright, ?test=1, localStorage.clear() first/last):
- pageerrors: none
- Forced flow: start → forcePhase('reveal') → wait 3.5s → phase=result, result={shadowId:'jinyu', aspectId:'wencai', gradeId:'weide'} (all valid ids), QQSave runs 0→1 ✓
- Natural flow: start → holdWater→calm → releaseCalm → drop → reveal → result={shadowId:'limao', aspectId:'caishi', gradeId:'zhong'}, runs 1→2 ✓
- No double-compute: runs delta across the natural run == 1 ✓
