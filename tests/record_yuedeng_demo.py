"""Record the 月下灯会 demo video: home → paint → light → release → finale → result.

Usage:
    python tests/record_yuedeng_demo.py

Writes a .webm under release/yuedeng/ (Playwright's only format), then converts to
H.264 .mp4 with ffmpeg so the release matches the series convention
(release/<game>/<game>-demo.mp4).

Determinism note: the game itself is zero-random, but the CAMERA/typing timings below
are wall-clock. That only affects pacing, never content.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "yuedeng" / "index.html"
OUT = ROOT / "release" / "yuedeng"
RAW = OUT / "_video"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

STROKES = [
    [[0.40, 0.34], [0.45, 0.33], [0.50, 0.35], [0.55, 0.33], [0.60, 0.35]],
    [[0.40, 0.44], [0.46, 0.46], [0.52, 0.44], [0.58, 0.46]],
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if RAW.exists():
        shutil.rmtree(RAW)
    RAW.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        # record_video_size 必须等于视口尺寸：Playwright 的录像把页面按 CSS 像素
        # 1:1 铺在画面左上角，既不按 deviceScaleFactor 放大、也不缩放填满。
        # 曾误设为 2×（780x1688），结果 390x844 的画面只占左上四分之一，其余是
        # 透明区，转 H.264/yuv420p 后变成中灰 —— 用户看到的「压缩到只有左上角」。
        # 放大交给 ffmpeg（源为 2× 渲染后降采样的画面，放大后仍清晰）。
        ctx = b.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            record_video_dir=str(RAW),
            record_video_size={"width": 390, "height": 844},
        )
        pg = ctx.new_page()
        pg.goto(TOOL.as_uri())
        pg.wait_for_function("window.__ready === true", timeout=20000)

        pg.wait_for_timeout(2800)                       # 首页：主视觉 + 标题 + CTA

        pg.click("#btn-start")
        pg.wait_for_selector("#view-create.is-active")
        pg.wait_for_timeout(900)                        # 空灯 + 控件全貌

        # 晕染打底 → 勾线定形 → 落纹样 → 换灯形
        pg.evaluate("window.__game.setBrush('wash')")
        pg.evaluate("window.__game.setColor(1)")
        pg.evaluate("window.__game.paintDrag(%s)" % str(STROKES[0]).replace(" ", ""))
        pg.wait_for_timeout(700)
        pg.evaluate("window.__game.setBrush('line')")
        pg.evaluate("window.__game.setColor(2)")
        pg.evaluate("window.__game.paintDrag(%s)" % str(STROKES[1]).replace(" ", ""))
        pg.wait_for_timeout(600)
        pg.evaluate("window.YDEngine.splatMotif('tu', {r:0.86, g:0.24, b:0.19})")
        pg.wait_for_timeout(900)
        pg.evaluate("window.__game.setShape(3)")        # 莲花灯
        pg.wait_for_timeout(1100)

        # 点亮：灯下透光 + 屋檐受光边 + 屋顶承接暖光
        pg.evaluate("window.__game.setLit(true)")
        pg.wait_for_function("window.YDEngine.state().litLevel > 0.99", timeout=10000)
        pg.wait_for_timeout(2200)

        # 放灯 → CG 结局四拍（12.5s，不跳过）
        pg.click("#btn-release")
        pg.wait_for_timeout(13800)
        pg.wait_for_timeout(1800)                       # 成品页 + 小记

        ctx.close()
        b.close()

    webms = sorted(RAW.glob("*.webm"))
    if not webms:
        print("FATAL: no .webm produced")
        return 1
    src = webms[0]
    dst = OUT / "yuedeng-demo.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(src),
        "-vf", "scale=720:1560:flags=lanczos",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
        "-movflags", "+faststart",
        str(dst),
    ], check=True)
    shutil.rmtree(RAW)
    print("video ->", dst, "%.2f MB" % (dst.stat().st_size / 1048576))
    return 0


if __name__ == "__main__":
    sys.exit(main())
