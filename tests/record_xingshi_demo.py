"""Record the 醒狮 demo video: 序章 → 村口开打 → 四个技能 → 门神/狮王 → 结算 → 分享卡.

Usage:
    python tests/record_xingshi_demo.py

Writes a .webm under release/xingshi/ (Playwright's only format), then converts to H.264
.mp4 with ffmpeg so the release matches the series convention
(release/<game>/<game>-demo.mp4 at 780x1688).

Two sizing facts, both learned the hard way elsewhere in this repo:
  * record_video_size MUST equal the viewport. Playwright lays the page out at 1:1 CSS px
    in the top-left of the frame; asking for 2x leaves three quarters transparent, which
    H.264/yuv420p turns into a grey block.
  * the page is loaded over file://, which taints the render canvas on the first bitmap
    draw. The share card is safe anyway because paintCard draws only text and shapes onto
    its own offscreen canvas, so toDataURL never sees a tainted bitmap -- and a pageerror
    check aborts the take if that ever stops being true.

Determinism note: the game is zero-random, but the timings below are wall clock. That
affects pacing only, never content.
"""

import shutil
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "xingshi" / "index.html"
OUT = ROOT / "release" / "xingshi"
RAW = OUT / "_video"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

W, H = 390, 844
VP = {"width": W, "height": H}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if RAW.exists():
        shutil.rmtree(RAW)
    RAW.mkdir(parents=True)

    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        ctx = b.new_context(
            viewport=VP,
            device_scale_factor=2,
            record_video_dir=str(RAW),
            record_video_size=VP,
        )
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(TOOL.as_uri())
        pg.wait_for_function("window.__ready === true", timeout=20000)

        # 序章：第一句停久一点，其余快速翻过。STORY 有 5 句，别写死翻页次数。
        pg.wait_for_timeout(3200)
        for _ in range(10):
            if pg.evaluate("() => window.__wh2.phase()") == "play":
                break
            pg.evaluate("() => window.__wh2.tap()")
            pg.wait_for_timeout(1300)
        pg.wait_for_function("() => window.__wh2.phase() === 'play'", timeout=8000)

        # 村口：走过去、普攻、弹反
        pg.wait_for_timeout(1500)
        for _ in range(3):
            pg.evaluate("() => window.__wh2.tap()")
            pg.wait_for_timeout(340)
        pg.evaluate("() => window.__wh2.parry()")
        pg.wait_for_timeout(700)

        # 扫堂（AoE）
        pg.evaluate("() => window.__wh2.skill1()")
        pg.wait_for_timeout(1200)

        # 冲天（挑空）：先放一只飞怪，再把它挑上天
        pg.evaluate("() => window.__wh2.spawnFly()")
        pg.wait_for_timeout(1500)
        pg.evaluate("() => window.__wh2.skill2()")
        pg.wait_for_timeout(1500)

        # 采青必杀：满蓄力后爆发
        pg.evaluate("() => window.__wh2.setCharge(100)")
        pg.wait_for_timeout(500)
        pg.evaluate("() => window.__wh2.ult()")
        pg.wait_for_timeout(2400)

        # 门神
        pg.evaluate("() => window.__wh2.gotoGate(0)")
        pg.evaluate("() => window.__wh2.spawnBoss()")
        pg.wait_for_timeout(3400)
        pg.evaluate("() => { window.__wh2.setCharge(100); window.__wh2.ult(); }")
        pg.wait_for_timeout(2600)

        # 狮王（体型最大、最有辨识度）
        pg.evaluate("() => window.__wh2.gotoGate(2)")
        pg.evaluate("() => { window.__wh2.spawnBoss(); window.__wh2.spawnShield(); }")
        pg.wait_for_timeout(3600)
        pg.evaluate("() => { window.__wh2.setCharge(100); window.__wh2.ult(); }")
        pg.wait_for_timeout(2400)

        # 结算 → 分享卡
        pg.evaluate("() => window.__wh2.finish()")
        pg.wait_for_timeout(3200)
        pg.evaluate("() => window.__wh2.tap()")
        pg.wait_for_timeout(3400)

        ctx.close()
        b.close()

    if errors:
        print("PAGE ERRORS, not encoding:", errors[:3])
        return 1

    webms = sorted(RAW.glob("*.webm"))
    if not webms:
        print("FATAL: no .webm produced")
        return 1
    dst = OUT / "xingshi-demo.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(webms[0]),
        "-vf", "scale=780:1688:flags=lanczos",
        # crf 20 on this much detail (busy night backdrop + particle effects) lands at
        # ~11 MB, roughly twice the largest demo in the series; 24 gives ~6 MB.
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24",
        "-movflags", "+faststart",
        str(dst),
    ], check=True)
    shutil.rmtree(RAW)
    print("video ->", dst, "%.2f MB" % (dst.stat().st_size / 1048576))
    return 0


if __name__ == "__main__":
    sys.exit(main())
