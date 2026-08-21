# Task 4 Report: 拼色卡（两版式 × 三底 × 题字）

## Status: DONE — 24/24 headless checks passed

## Changes

### New: `tools/dunhuang/assets/card.js` (window.DHCard)
- `paint(opts) -> dataURL` on a 900×1200 canvas; opts = { colors:[{name,hex}], layout:'scroll'|'zaojing', bg:'paper'|'silk'|'night', title, source }.
- Common frame: bg fill (paper #F5F0E6 / silk #EFE6D2 / night #2E3D52); texture via `DHRng(11)` — ~1500 faint ink dots (alpha 0.025–0.045) on paper/silk, 150 faint 月白 star speckles on night; double red border (outer 6px inset 24, inner 2px inset 40) + four 34px corner brackets; kaishu title 72px bold (per-char letter-spacing 20) + subtitle 26px (accent #8A6A4A on paper/silk, #FFB61E on night; ink #425066 vs #D6ECF0) + line-diamond-line divider.
- `scroll` layout (per card-scroll.html): N bands clamped 3–6 (cycle-fill below 3, truncate above 6), 112×470 rounded-6 rects, drop shadow + inner white stroke, gap min(38, fit-to-780), centered; color names stacked vertically (27px kaishu) under each band; bottom source line 23px + 96×96 seal rotated −6° with white vertical 敦煌 and inner white border.
- `zaojing` layout (per card-zaojing.html): concentric layers at (450,600), sizes 600 / 424(rot45) / 300 / 212(rot45) / 150 + center circle Ø84 when 6 colors (circle dropped for 5), colors in order with cycle-fill below 5; legend row of 52px circle swatches + 24px names; bottom row = source + seal side by side.
- Guard: empty colors → blank card with frame + title only, no crash. No Math.random; IIFE/var/function style, no comments.

### Modified: `tools/dunhuang/assets/main.js`
- `buildSel = { colors, layout:'scroll', bg:'paper', title: TITLES[0] }`; exposed on `window.__game` (with `renderPreview`).
- `showBuild()`: rebuilds chips (one per unlocked color in COLORS order, 44px circle, hex fill, `title` tooltip), resets default selection to first min(5, unlocked), syncs pills, sets view, renders preview.
- `#btn-build` guard now `DHSave.codexCount() === 0` → toast 先去拾色, stay in extract.
- Chip toggle: max 6 selected; deselect blocked at 3 (min-3 enforcement).
- Pills: 2 layout (立轴色谱/藻井), 3 bg swatches (宣纸/绢本/夜空 with color dot), 5 title pills; every change → `renderPreview()` (full 900×1200 paint drawn scaled into #build-preview via Image, token-guarded against stale loads).
- `#btn-make-card`: sets `window.DHLastBuild = opts`, switches to result view, paints card into #result-card (Task 5 will refine sharing). Minimal wiring for #btn-again (back to build) and #btn-home-result.
- `source` derived from current mural: 莫高窟 · {name} · {era} (fallback 敦煌 · 矿物五色).

### Modified: `tools/dunhuang/assets/style.css`
- Added `.opt-pill .bg-sw` color dot for bg swatches. Existing `.color-chip` (44px, red ring + ::after ✓), `.opt-pill.is-on`, and #build-preview 3:4 styles were already present and reused.

## Verification — `.sdd/dh-task4-verify.py` (playwright chromium, 390×844, ?test=1, localStorage cleared first/last)
Setup: unlocked 6 colors (石青/石绿/朱砂/雌黄/赭石/铅白) via DHSave.

| # | Check | Result |
|---|-------|--------|
| 1 | No pageerrors | PASS |
| 2 | 2 layouts × 3 bgs → data:image/png, decoded 900×1200 (all 6) | PASS |
| 3 | Corners: paper [245,240,230], silk [239,230,210], night [46,61,82]; scroll band @ (116,550) = #2F5D9E; zaojing center = 6th color #E5DCC8, outer square = 1st color | PASS |
| 4 | Seal #C3272B pixels present (both layouts) | PASS |
| 5 | Build UI: 6 chips = unlocked count; default 5 selected; toggle mutates buildSel.colors; layout/bg/title switches each change preview frame | PASS |
| 6 | Min-3: deselect 5→3 ok, further attempt stays 3 | PASS |
| 7 | make-card: result view active, DHLastBuild set (3 colors), #result-card non-blank (1,080,000 opaque px) | PASS |
| 8 | Screenshots saved | PASS |

**24/24 checks passed.**

## Screenshots
- `.sdd/shots/dh4-build.png` — build view with preview + controls
- `.sdd/shots/dh4-card-scroll.png` — painted 立轴色谱 card (900×1200)
- `.sdd/shots/dh4-card-zaojing.png` — painted 藻井 card (900×1200)

## Concerns / Notes
- Card screenshots could not be visually eyeballed in this session (no image input); fidelity to mockups is enforced via copied constants (band 112×470, zaojing 600/424/300/212/150/84, borders, seal) plus pixel checks.
- `opts.source` appears both as top subtitle and bottom source line (matches task spec; mockups had two distinct strings).
- zaojing with <5 colors cycle-fills layers per brief; UI normally enforces ≥3 selected, so legend may show repeated names only in that edge.
- Task 5 owns result-view sharing/save; current make-card renders the card into #result-card as a working placeholder.
