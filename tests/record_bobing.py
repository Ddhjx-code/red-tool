# -*- coding: utf-8 -*-
"""中秋博饼 展示视频录制。headed Chrome + CDP 轮询截帧 -> ffmpeg 按实测帧率合成。

三条实测结论决定了实现方式：
1. 必须 headed。headless 用 SwiftShader 软渲染 WebGL，截帧 485ms/帧 -> 2fps；
   headed 走 Apple M4 Metal 真 GPU，GPU 预热后 60ms/帧 -> 16.7fps（780x1688 q90）。
2. 必须用 CDP Page.captureScreenshot 而非 Playwright 录屏。
   Playwright 录屏走 screencast，时间轴与墙钟非 1:1 且逐次漂移
   （实测同一录制内 ratio 出现 0.971/0.998/1.004/1.164），片头裁剪会错位；
   且录制起始段内容与真实渲染不符（同一瞬间 screenshot=60.49 vs video=109.46）。
   CDP 截帧内容忠实（同一瞬间 diff=1.58）。
3. 必须按实测帧率编码（frames/elapsed），播放速度才与真实时间一致。

驱动用状态机而非固定 sleep：掷骰结算在 GPU 下约需数秒，固定时延会拍到空帧。
"""
import argparse, base64, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

W, H = 780, 1688          # 对齐 houyi/qishan/keju 惯例
DPR = 2                   # 390x844 CSS px @ DPR 2 -> 780x1688
QUALITY = 90

# (标签, 进入时执行的动作, 退出条件)
# 退出条件二选一：dwell=毫秒停留，await=等 JS 表达式为真。
STEPS = [
    ("intro",      None,              ("dwell", 3000)),
    ("enter",      "clickIntro",      ("await", "window.__bobing.phase === 'idle'")),
    ("idle",       None,              ("dwell", 2000)),
    ("prime",      "primeCakes",      ("dwell", 0)),
    ("throw",      "throwZhuangyuan", ("await", "window.__bobing.phase === 'reveal'")),
    ("reveal",     None,              ("dwell", 2500)),
    ("tuanyuan",   None,              ("dwell", 5000)),
]

DRIVERS = {
    "clickIntro":      "document.getElementById('intro-cta').click()",
    "primeCakes":      "window.__bobing.setCollected(62)",
    "throwZhuangyuan": "window.__bobing.forceThrow([4,4,4,4,2,3])",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/bobing-demo.mp4")
    ap.add_argument("--maxsecs", type=int, default=90)
    args = ap.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    base = "file://" + os.path.join(root, "tools", "bobing", "index.html")
    frames_dir = "/tmp/bobing_frames"
    os.makedirs(frames_dir, exist_ok=True)
    for f in os.listdir(frames_dir):
        os.remove(os.path.join(frames_dir, f))

    errors = []
    nframes = 0

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(headless=False)
        except Exception:
            browser = p.chromium.launch(channel="chrome", headless=False)
        ctx = browser.new_context(viewport={"width": W // DPR, "height": H // DPR},
                                  device_scale_factor=DPR)
        page = ctx.new_page()
        cdp = ctx.new_cdp_session(page)
        page.on("console",
                lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        # GPU 预热：软渲染(SwiftShader)会导致截帧退化到 2fps，必须确认真 GPU
        page.goto(base + "?seed=123")
        page.wait_for_function("!!window.__bobing", timeout=20000)
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_function("!!window.__bobing", timeout=20000)
        page.wait_for_timeout(4000)

        renderer = page.evaluate(
            "(function(){var c=document.getElementById('gl');"
            "var g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return 'none';"
            "return g.getParameter(g.getExtension('WEBGL_debug_renderer_info')"
            ".UNMASKED_RENDERER_WEBGL)})()")
        print("  renderer: %s" % renderer)
        if "SwiftShader" in str(renderer):
            print("ABORT: 软渲染 WebGL，截帧只有 ~2fps，必须 headed + 真 GPU"); sys.exit(1)

        idx = 0
        step_start = time.time()
        t0 = time.time()
        last = None

        while idx < len(STEPS):
            label, action, exit_cond = STEPS[idx]

            # 1) 轮询截帧（CDP，内容忠实且不阻塞渲染管线）
            r = cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": QUALITY})
            nframes += 1
            with open(os.path.join(frames_dir, "%05d.jpg" % nframes), "wb") as fh:
                fh.write(base64.b64decode(r["data"]))

            # 2) 退出条件满足 -> 进入下一步并执行其动作
            kind, val = exit_cond
            done = ((time.time() - step_start) * 1000 >= val) if kind == "dwell" \
                else bool(page.evaluate(val))
            if done:
                idx += 1
                if idx < len(STEPS):
                    nxt = STEPS[idx][1]
                    if nxt:
                        page.evaluate(DRIVERS[nxt])
                    step_start = time.time()

            if label != last:
                print("  [%5.1fs] frames=%d -> %-9s phase=%s collected=%d done=%s"
                      % (time.time() - t0, nframes, label,
                         page.evaluate("window.__bobing.phase"),
                         page.evaluate("window.__bobing.collected"),
                         page.evaluate("window.__bobing.done")))
                last = label
            if time.time() - t0 > args.maxsecs:
                print("  timeout at %s" % label); break

        elapsed = time.time() - t0
        assert page.evaluate("window.__bobing.done === true"), "did not reach 团圆"
        assert page.evaluate("window.__bobing.collected === 63"), "did not reach 63 cakes"
        browser.close()

    print("captured %d frames in %.1fs" % (nframes, elapsed))
    print("console/pageerror:", len(errors), errors[:6])
    if errors:
        print("ERRORS present, abort"); sys.exit(1)
    if nframes < 40:
        print("too few frames (%d) -> GPU 可能在软渲染，检查是否 headed" % nframes); sys.exit(1)

    # 按实测帧率编码，播放速度才与真实时间一致
    fps = max(1.0, round(nframes / elapsed, 2))
    print("encoding at %.2f fps (real-time)" % fps)
    cmd = ["ffmpeg", "-y", "-framerate", str(fps),
           "-i", os.path.join(frames_dir, "%05d.jpg"),
           "-vf", "scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d" % (W, H, W, H),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
           "-movflags", "+faststart", args.out]
    subprocess.run(cmd, check=True, capture_output=True)
    print("OK -> %s" % args.out)


if __name__ == "__main__":
    main()
