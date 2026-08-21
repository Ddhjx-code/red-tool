# Task 8: 分享出口 — Report

## Status: DONE

## Changes

### NEW `tools/longzhou/assets/share.js` — `window.LZShare`
- IIFE / var / function(){} / no comments / no Math.random(), matching codebase style.
- `LZShare.lastStats = null` — stashed by main.js when the result view renders.
- `LZShare.paintCard(st) -> dataURL` — offscreen 900×1200 canvas, top→bottom:
  - 宣纸 `#F5F0E6` bg; double 朱红 `#C3272B` border (outer 6px inset 24, inner 2px inset 40).
  - Caption 「非遗手作坊 · 端午」 黛青 30px Kaiti centered; two `LZSprites.pickup("zongzi")` 粽子点缀 flanking it (guarded by `window.LZSprites` existence).
  - Main title 「龙舟破浪」 bold 96px Kaiti 黛青.
  - 朱红 seal 150×150 rotated −6°, white Kaiti 称号 text (`st.title`, split into 2-char lines, thin white inset stroke).
  - Stats block: 4 rows 航程/总分/粽子/最高连击 — label 28px Kaiti left + value bold 64px right, 76px row spacing.
  - Knowledge card: white rounded rect (90,792,720,288,r22) + faint 黛青 stroke; bold 「《{knowName}》」 title line (skipped when knowName empty, body then gets 6 lines); body wrapped at 14 chars/line, lineHeight 44, 避头处理 (closing punctuation pulled onto previous line; opening punctuation carried to next line), overflow truncated with 「…」.
  - Bottom: 「图鉴 {codexCount}/8」 bold 32px + tagline 「龙舟破浪 · 端午竞渡」 22px 朱红 with 藤黄/月白 small dashes.
  - All `st` fields guarded via `str()` → `""` when null/undefined.
- `wrapText(text, per)` — manual fixed-width wrap + trivial orphan-punctuation avoidance.
- `saveAlbum()` / `postNote()` — shared `withFile()`:
  - `mt = window.xhs && window.xhs.miniTool`; null-checks `mt` and `lastStats` before painting; falls back to `alert("当前环境暂不支持直接保存，请截图保存哦")` when absent/failed (also wired to every `fail`).
  - `mt.writeTempFile({data: dataUrl})` → `success(res)` →
    - saveAlbum: `mt.saveImageToPhotosAlbum({filePath: res.filePath})` → `alert("已保存到相册")`.
    - postNote: `mt.postNote({title, content, tags, mediaInfo:{image_resources:[{url: res.filePath}]}, fail})`; title = 「我在端午划了 」+ distText, hard-clamped to ≤20 chars via substring.
  - All callbacks use `function(res){}` (no arrows).

### MODIFIED `tools/longzhou/assets/main.js`
- `fillResult()` (result event handler): refactored knowledge pick into `knowName`/`knowText` locals and now sets
  `window.LZShare.lastStats = {title, distText: dist+"m", score, zongzi: S.zongzi, maxCombo: S.maxCombo, knowName, knowText, codexCount: unlocked.length}` reusing values already computed there (guarded by `window.LZShare` existence).
- Bound `#btn-save-album` click → `LZShare.saveAlbum()` and `#btn-post-note` click → `LZShare.postNote()` (user-gesture driven, alongside existing result-view button bindings).

## Verification (playwright headless chromium, 390×844, `?test=1`, localStorage cleared first & last)

| # | Check | Result |
|---|-------|--------|
| 1 | No pageerrors; share.js loads; only audio.js 404 remains | PASS — `pageerror: []`, failed URLs = audio.js only, `LZShare` loaded |
| 2 | `paintCard` returns `data:image/png`, decodes to 900×1200 | PASS — prefix `data:image/png;base64,`, naturalWidth=900, naturalHeight=1200 |
| 3 | Non-blank render | PASS — corner pixel (245,240,230)=#F5F0E6; 35644 dark ink px + 17874 朱红 px in center region |
| 4 | No `window.xhs`: click both buttons → fallback alert | PASS — both fired 「当前环境暂不支持直接保存，请截图保存哦」 |
| 5 | Mock `window.xhs.miniTool` recording calls | PASS — save: `writeTempFile` (data prefix `data:image/png`) → `saveImageToPhotosAlbum({filePath:"/tmp/lz-card.png"})` → alert 「已保存到相册」; note: `writeTempFile` → `postNote` with title 「我在端午划了 1234m」(12 ≤ 20 chars), `mediaInfo.image_resources[0].url === filePath`, tags & content present |
| 6 | Full flow: start → forceHit×3 → result view | PASS — result view active, `lastStats` populated (`title:"见习桨手"`, `distText:"6m"`, knowText & codexCount set) |

Extra layout audit (pixel sampling on two card variants — full stats + 粽子 codex text, and empty-knowName + longest 龙头令 text):
- Title band / seal (red+white) / stats / knowledge-card body all contain expected ink pixels.
- Fixed an overflow found during audit: no-title 6-line body baseline sat 2px past the white card bottom; shifted body start up (by=850 / by=894) → 0 dark pixels in the 12px strip below the card for both variants.

## Concerns / Notes
- `LZSprites.pickup` scale depends on `LZScene.metrics().u` (stage-derived); the card 粽子 decorations are sized ~55px at current u — visually verified only via pixel counts, not human eyeball (image preview unavailable in this session).
- Long knowledge texts (>~70 chars, e.g. 龙头令) are truncated with 「…」 on the card by design (fixed card layout); the in-game result view still shows full text.
- `postNote` success callback isn't provided by the brief's contract — only `fail` fallback; container behavior on success is out of our control.
- No git operations performed, per instructions.

## Report path
`/Users/duanchao.wzj/AI/workspace/red-tool/.sdd/task-8-report.md`
