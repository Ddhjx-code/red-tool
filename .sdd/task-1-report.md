# Task 1 Report: 骨架 + 数据 + 随机数

## What I implemented

- `tools/longzhou/index.html` — 4-view DOM skeleton (home / game / codex / result), verbatim from brief. External scripts only, no inline handlers, relative paths. References the 6 not-yet-existing assets (audio/scene/sprites/game/share/main) as required.
- `tools/longzhou/assets/data.js` — `window.LZData` verbatim from brief (tuning constants, 5 TITLES, 8 CODEX entries, weights, 3 FACTS). IIFE, no comments.
- `tools/longzhou/assets/rng.js` — `window.LZRng(seed)` (mulberry32) verbatim from brief, returning `{next, range, int, pick}`.
- `tools/longzhou/assets/style.css` — full implementation of the brief's prose spec:
  - Exact tokens: `--red:#C3272B; --ink:#425066; --gold:#FFB61E; --moon:#D6ECF0; --paper:#F5F0E6; --font-kai` + safe-area vars (matching jianzhi convention).
  - `.view` fixed + `is-active` switching; home 宣纸 layered background + `vertical-rl` 13vw 楷体 title; `.primary-btn` (朱红, 999px), `.ghost-btn` (描边), `.chip-btn`, `.mute-btn`.
  - Game: full-screen canvas; HUD with `padding-top:calc(12px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))`; `.steady-dot` 12px dots with `.is-off`; `.drum-btn` 88px radial-gradient drum + gold rim, `:active scale(0.92)`, safe-area bottom; `.gauge-wrap` 6×72px vertical above drum, `.gauge-fill` bottom-anchored `height:%` gold; `.toast` top-center fade (`.is-on`); `.tutor` bottom-center translucent; `.pause-mask` hidden until `.is-on`.
  - Codex: paper bg, 3-col grid, `.codex-cell.is-locked` grey with `?` overlay, unlocked white + canvas icon; `.codex-card` bottom sheet hidden until `.is-on`.
  - Result: paper bg, `.result-seal` 朱红方章 楷体白字 `rotate(-6deg)` (vertical name), 4-col stats grid, `.result-know` white card, action/share button groups.
  - No comments anywhere; ES5-ish style matching existing tools.

## What I tested and results

Command: `python3 /tmp/opencode/lz_task1_check.py` (playwright chromium, 390×844 viewport, file:// URL)

Assertions:
- no console errors / pageerrors excluding failed-resource loads → PASS
- `#view-home.is-active` present → PASS
- `window.LZData.CODEX.length === 8` → PASS
- `LZRng(1).next()` ×3 all ∈ [0,1) and pairwise distinct → PASS
- extra: same-seed determinism (`LZRng(1).next()` reproducible), `range(5,10)`/`int(1,6)`/`pick` bounds → PASS

Output:
```
expected 404s: 6
   Failed to load resource: net::ERR_FILE_NOT_FOUND  (×6)
ALL CHECKS PASSED
```
The 6 404s are exactly the not-yet-created audio/scene/sprites/game/share/main.js — expected this task.

## Files changed

- Created: `tools/longzhou/index.html`
- Created: `tools/longzhou/assets/data.js`
- Created: `tools/longzhou/assets/rng.js`
- Created: `tools/longzhou/assets/style.css`

Commit skipped (workspace is not a git repo, per task instructions).

## Self-review findings

- index.html / data.js / rng.js diffed mentally against brief: verbatim, including all ids referenced by later tasks.
- Every class/id in index.html has styling; state classes (`.is-active`, `.is-on`, `.is-off`, `.is-muted`, `.is-locked`) all defined.
- Container constraints respected: only the boilerplate reset `<style>` in head (allowed by brief), no inline handlers, all paths relative.
- No comments in any file; `var`/`function` ES5 style; IIFE wrappers on both JS modules.

## Concerns

- `.codex-cell`, `.codex-cell-name`, `.steady-dot` class names are my invention (brief's prose mentions the cells/dots but gives no class names; main.js comes in a later task). Later tasks must emit these exact class names, or style.css will need a small sync.
- `.mute-btn.is-muted` style included speculatively for the mute toggle state; harmless if unused.
- Codex/result views use `overflow-y:auto` for small screens; game view elements are pointer-events-safe (HUD/toast/tutor non-interactive).

## Review-fix round

### What changed (style.css only)

1. Critical: deleted `.home-title span { display: block; }` (was line 112). Block-level spans broke the `writing-mode:vertical-rl` title into a horizontal reversed row; spans now stay inline and stack top-to-bottom.
2. Minor: `.gauge-wrap { right: calc(16px + 38px) }` → `calc(16px + 41px)` (drum center is 16px + 44px from right edge; gauge half-width 3px ⇒ right offset 57px = 16+41).

### Test command

`python3 /var/folders/lb/v_0jd2l11hb4l3dwysz0l2sh0000gp/T/opencode/verify_task1.py`
(playwright chromium, 390×844, opens file:///Users/duanchao.wzj/AI/workspace/red-tool/tools/longzhou/index.html; measures `.home-title` box + span rects on home view, then activates `#view-game` class to measure gauge/drum since game JS does not exist yet)

### Output

```
PASS: no pageerrors
PASS: title tall/narrow 71x290
PASS: spans stacked top-to-bottom 龙→舟→破→浪 ys=[176.6, 245.0, 313.5, 382.0]
PASS: gauge-fill center aligned with drum (diff=0.00px)
OVERALL: PASS
```

Details: title box 71×289.8 (height > width as expected); first span 龙 has smallest y; gauge-fill center x = drum center x exactly (fill x=327 w=6, drum x=286 w=88).
