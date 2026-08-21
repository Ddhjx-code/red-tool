# Task 3: 十二影形矢量 — Report

## Status: PASS

Created `tools/qiqiao/assets/shadow.js` implementing `window.QQShadow` with 12 needle-shadow
silhouettes drawn in a normalized 100×100 box (centered at 0,0), scaled to `size` and filled
with ink `rgba(20,26,38,alpha)`.

## Interface
- `QQShadow.draw(ctx, id, x, y, size, alpha)` — `ctx.save()` on entry, translate(x,y) +
  scale(size/100), dispatch to per-id drawing function by lookup, `ctx.restore()` on exit
  (restores transform/alpha/shadow). Unknown `id` returns early (no-op). `lineCap`/`lineJoin`
  set to round for soft ink edges.
- `QQShadow.ids()` — returns the 12 ids, derived from `QQData.SHADOWS` order when available
  (falls back to the fixed list), so ordering always matches Task 1 data.

## Style compliance
- IIFE, `var`, `function(){}` only; **no** `let`/`const`/arrow (grep = 0 hits).
- **No comments**, **no `Math.random()`** (grep = 0 hits). All geometry is fixed/deterministic.
- Negative-space details (eyes, pod dots, shoe opening, wing hints) are done with a lighter ink
  `rgba(228,234,240, alpha*0.5)` for 1–2 internal strokes — never background-color fills.

## Headless verification (Playwright/Chromium, viewport 390×844, file:// index.html)
Harness draws each id to an offscreen 200×200 canvas at `draw(ctx,id,100,100,160,1)`,
reads pixels, and asserts. Screenshot grid saved to `.sdd/shots/qq3-shadows.png` (450×600).

1. **No pageerrors** — PASS (0 errors; only expected 404s for not-yet-created scripts, ignored).
2. **ids() order** — PASS: exactly the 12 ids, matching `QQData.SHADOWS` order.
3. **Coverage** — PASS: every id between 4% and 60% (see table; range 7.06%–22.88%).
4. **Distinctness** — PASS: all 66 pairs, 32×32 binary-mask normalized difference > 0.08.
   Minimum pair = **0.091** (jinyu/lianhua). Full sorted distribution min→max: 0.091 … 0.216.
5. **Grid screenshot** — written to `.sdd/shots/qq3-shadows.png` (3×4, labelled).
6. **State reset** — PASS: after each draw, transform is identity and globalAlpha === 1.

## Per-id ink coverage (of the 200×200 box)
| id | name | coverage % |
|----|------|-----------|
| yun | 祥云 | 22.88 |
| mudan | 牡丹 | 14.17 |
| xique | 喜鹊 | 11.72 |
| jinyu | 金鱼 | 8.31 |
| fenghuang | 凤凰 | 9.75 |
| limao | 狸猫 | 14.66 |
| xiuxie | 绣鞋 | 12.77 |
| jiandao | 剪刀 | 8.53 |
| yulong | 玉龙 | 8.35 |
| lianhua | 莲花 | 9.29 |
| chui | 槌影 | 11.92 |
| zhuying | 烛烟 | 7.06 |

No outliers: all comfortably inside the 4–60% band (none near either bound).

## Design notes (silhouette legibility at 120–240px)
Each shape leans on a distinct gesture + 1–2 detail strokes:
- yun: three joined scrolls + curl tail; mudan: 3 concentric petal rings (8/6/cluster).
- xique: profile bird, long single-stroke tail, eye dot, branch with 2 leaves.
- jinyu: oval body, flowing double tail (two bezier lobes), dorsal fin, eye dot.
- fenghuang: crested head, curved neck, 3 long sweeping tail ribbons.
- limao: loafing round body, two triangular ears, wrapped tail, closed-eye arcs.
- xiuxie: upturned pointed toe, curved body, ankle-opening arc, floral dot.
- jiandao: open X blades, ring handles, pivot dot.
- yulong: C-coiled thick arc, horn, snout, whisker curves, claw hints.
- lianhua: 7 upward fan petals + seed-pod circle with dots.
- chui: chunky rounded head tapering to short handle.
- zhuying: tapered candle body + S-curve smoke wisp.

## Concerns
- Distinctness passes but the closest pairs cluster around 0.09–0.10 (several involve `lianhua`).
  The threshold (>0.08) is met with margin, but if a later task re-renders at a very different
  size/AA setting, the lotus is the shape most likely to drift toward neighbours. Flagging for the
  controller; no action required now.
- Verification ran against `file://` with sibling scripts (save.js, audio.js, etc.) not yet present;
  their 404s are expected and were ignored per the brief.

## Report path
/Users/duanchao.wzj/AI/workspace/red-tool/.sdd/qq-task-3-report.md
