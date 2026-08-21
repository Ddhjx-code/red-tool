# Task v11 Report — 龙舟破浪 Top-Down Rework

## Status: PASS

## Changes

### 1. scene.js — top-down rewrite
- Removed horizon/sky/mountains/perspective. New metrics: `W,H,u,cx,laneW=W*0.27,boatY=H*0.78,AHEAD_M=55,ppm=boatY/AHEAD_M` (exposed via `metrics()`; `horizonY` dropped, no consumer referenced it).
- `project(laneX,z)` = `{x: cx+laneX*laneW, y: boatY - z*ppm, s: 1}` (constant scale). Interface preserved; main.js entity rendering unchanged.
- Painter order: bank ground gradient (#6b7a5e→#5c6b52) → centered river strip (黛青 #3c5468→#2e3d52) with 3px sand line #c9b98a + white foam edge → scrolling lane-divider dashes (18u dash/18u gap, offset=(dist*ppm)%(36u), white α0.25, 3u) → 14 seeded (LZRng(11)) shimmer streaks wrapping over AHEAD_M+10, α0.10–0.16 → bank scenery every 12m world-spaced (SPAN=AHEAD_M+20), 4 cycling types (reed/tree/house/stone), ink-green #39462f/#2f3a27, deterministic side/margin from k → splash particles (physics unchanged).
- Deviation (documented): spec river half-width `laneW*1.9 = 0.513W > cx` would cover the full screen at ANY width (banks never visible, scenery off-screen). Capped: `riverHW = min(laneW*1.9, cx - 56u)` so banks/scenery/shoreline read as intended; shimmer x clamped inside river; scenery margin clamped if bank narrower than margin.
- Scroll direction verified: dashes/shimmer/scenery move DOWN-screen as dist grows (pixel-correlation: +1m ⇒ +12px, matches ppm≈11.97).

### 2. sprites.js — top-down boat
- Hull 朱红 #C3272B ~136u×40u, pointed bow (top) / rounded stern, #8E1B1F outline, center deck line + 3 cross-bench lines.
- Gold #FFB61E top-down dragon head at bow: circle + forward snout ellipse + two horns swept back; dashing → gold shadowBlur glow kept.
- Drummer 1/4 from bow: ink head+shoulders, drum circle ahead, arms raised on `o.drumHit` else resting.
- 3 paddlers/side, paddle angle = sin(phase+i*0.9)*0.5, white splash dot at tip when raw>0.3 (kept).
- Stern steering oar trailing down. `o.tilt`, `o.blink`, ghost-trail `ctx.globalAlpha` multiplication, save/restore all kept.
- Obstacles/pickups untouched (they only use `metrics().u`).

### 3. main.js + index.html + style.css — controls
- `#btn-left`/`#btn-right` (◀ ▶) added bottom-right in `.lane-btns`; pointerdown → `LZGame.swipe(∓/±1)` + 100ms `.is-hit` feedback; 64px targets, rgba(66,80,102,0.55), safe-area bottom.
- `#btn-drum` moved bottom-left; HOLD-TO-BEAT: pointerdown → immediate `drum()` + 140ms interval (game's DRUM_INTERVAL gates); cleared on pointerup/pointercancel/pointerleave and guarded by state check inside tick (auto-stops on capsize/result/view exit). `.is-hit` toggles per beat. Space key kept; canvas swipe + arrow keys kept.
- `.gauge-wrap` repositioned above drum (bottom-left). Tutorial text updated ("左右键或滑动 换线" / "按住左下鼓面 攒满冲刺").

### 4. data.js
- `SPEED_RAMP_DIST: 2500 → 1200`. BASE/MAX speed unchanged.

### 5. Demo autopilot
- Untouched (lane-based); verified 20s survival + dash.

## Verification (390×844, chromium, localStorage cleared first/last)
1. `?test=1` no pageerrors; start→playing; `project(0,45).y=119.7 < project(0,0).y=658.3` ✓
2. Frames 300ms apart differ; lane-divider column changes; paused-step test: +1m ⇒ +12px DOWN ✓
3. `#btn-right`→lane 1, `#btn-left`→lane 0 (400ms); hold drum 1s ⇒ gauge 96 (≥60) ✓; hold from zero reaches dash in ~1.15s (<2.5s) ✓
4. Speed ramp: setDist 0/600/1200 ⇒ 8.03 / 15.05 / 22.00 ✓
5. `python3 tests/longzhou_smoke.py` → SMOKE PASS ✓
6. `?demo=1` 20s: survives, dash observed ✓
7. Screenshots (fresh storage, demo): `.sdd/shots/v11-play.png`, `v11-dash.png`, `v11-home.png`, `v11-result.png` (result via ?test=1 + forceHit×3 from played run) ✓

## Concerns
- River half-width capped below spec value (see deviation) — spec value made banks invisible at every viewport width; revisit if a wider min-width is targeted.
- Hold-to-dash is fast (~1.2s from zero); if too strong, reduce GAUGE_DRUM or raise interval.
- Screenshots verified only by pixel sampling (no visual review available in this session).

## Balance Fix — post-dash rest period (鼓手喘口气)

### Status: PASS

### Changes
- game.js: added `S.restT` (init 0, reset in `start()`). `startDash()` sets `S.restT = 3`. `drum()` early-returns (no gauge gain, no emit) while `restT > 0`. Wine branch of `collect()` gates the +50 gauge add on `restT <= 0` (emit/codex unlock kept). `update()` decrements `restT` toward 0 while playing, gated on `dashT <= 0`.
  - Deviation from literal spec: decrement is gated on `dashT <= 0` so the 3s rest runs AFTER the 3s dash. Unconditional decrement would make rest expire exactly when the dash ends, contradicting verification expectation 2 (drumming right after dash must stay gated). Effective cycle: dash 3s → rest 3s → refill ~1.2s.
- main.js: `syncHud` toggles `.is-rest` on `#gauge-wrap` when `restT > 0`.
- style.css: `.gauge-wrap.is-rest .gauge-fill { background: #8a8f98; }` (fill height already shows 0 during rest since gauge resets).
- `snapshot()` returns live S — `restT` exposed automatically. Demo autopilot unchanged (its drums during rest are harmlessly gated).

### Verification (390×844, chromium, fresh localStorage, ?test=1)
1. No pageerrors ✓
2. Hold #btn-drum 1.5s → dash (dashT=2.62, restT=3.00); after dash ends, hold 1s → gauge stays 0, restT=2.03, `#gauge-wrap.is-rest` present ✓; rest ended ~3.5s after dash end, hold 1.5s → gauge refilled to 100 and re-dashed (dashT=2.07) ✓
3. Wine during rest: SKIPPED — no entity-injection hook to force a wine pickup on demand; the gate is the same `restT` check verified for drumming.
4. `python3 tests/longzhou_smoke.py` → SMOKE PASS (suite's initial 12-drum burst runs from gauge 0 with no prior dash, restT=0 — no conflict) ✓
5. `?demo=1` 15s: state=playing throughout, 2 dashes fired ✓
