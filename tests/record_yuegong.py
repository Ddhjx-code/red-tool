# -*- coding: utf-8 -*-
"""月宫一夜 展示视频 + 配图录制。headed Chrome + CDP 轮询截帧 -> ffmpeg 按实测帧率合成。

沿用 bobing 的三条实测结论：
1. headed 截帧走真 GPU，软渲染会把帧率退化到 ~2fps。本作是 Canvas 2D 而非 WebGL，
   软渲染代价小得多，但仍保持 headed 以与系列一致。
2. CDP Page.captureScreenshot 而非 Playwright 录屏：screencast 时间轴与墙钟非 1:1 且漂移。
3. 按实测帧率 (frames/elapsed) 编码，播放速度才与真实时间一致。

本作是剧情树而非骰子收集，所以驱动用「选择 -> 结算页 -> advance -> 下一节点」的状态机，
退出条件查 view-* 区块的 is-active 类。advance() 有 320ms 的 locked 互斥，
故每个 advance 之后必须 dwell，不能立刻再 choose。

同一次录制顺带导出 6 张竖屏 PNG 配图到 release/yuegong/images/。
"""
import argparse, base64, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

W, H = 780, 1688          # 对齐 houyi/qishan/keju/bobing 惯例
DPR = 2                   # 390x844 CSS px @ DPR 2 -> 780x1688
QUALITY = 90

ACT_NODE = "document.getElementById('view-node').classList.contains('is-active')"
ACT_OUTCOME = "document.getElementById('view-outcome').classList.contains('is-active')"
ACT_ENDING = "document.getElementById('view-ending').classList.contains('is-active')"

# end_nichang 线，choice 索引 [0,0,1,0,0,0,1]，须与验证脚本走同一条路径。
STEPS = [
    ("intro",      None,        ("dwell", 2500)),
    ("start",      "clickStart", ("await", ACT_NODE)),
    ("n-start",    None,        ("dwell", 1800)),
    ("c-start",    "choose0",   ("await", ACT_OUTCOME)),
    ("o-1",        None,        ("dwell", 1100)),
    ("n-bridge",   "advance",   ("await", ACT_NODE)),
    ("bridge",     None,        ("dwell", 1800)),
    ("c-bridge",   "choose0",   ("await", ACT_OUTCOME)),
    ("o-2",        None,        ("dwell", 1100)),
    ("n-gate",     "advance",   ("await", ACT_NODE)),
    ("gate",       None,        ("dwell", 2000)),
    ("c-gate",     "choose1",   ("await", ACT_OUTCOME)),
    ("o-3",        None,        ("dwell", 1400)),
    ("n-court",    "advance",   ("await", ACT_NODE)),
    ("court",      None,        ("dwell", 2200)),
    ("c-court",    "choose0",   ("await", ACT_OUTCOME)),
    ("o-4",        None,        ("dwell", 1800)),
    ("n-listen",   "advance",   ("await", ACT_NODE)),
    ("listen",     None,        ("dwell", 1500)),
    ("c-listen",   "choose0",   ("await", ACT_OUTCOME)),
    ("o-5",        None,        ("dwell", 1100)),
    ("n-return",   "advance",   ("await", ACT_NODE)),
    ("return",     None,        ("dwell", 1500)),
    ("c-return",   "choose0",   ("await", ACT_OUTCOME)),
    ("o-6",        None,        ("dwell", 1100)),
    ("n-second",   "advance",   ("await", ACT_NODE)),
    ("second",     None,        ("dwell", 1800)),
    ("c-second",   "choose1",   ("await", ACT_OUTCOME)),
    ("o-7",        None,        ("dwell", 1600)),
    ("n-end",      "advance",   ("await", ACT_ENDING)),
    ("ending",     None,        ("dwell", 4500)),
]

DRIVERS = {
    "clickStart": "document.getElementById('btn-start').click()",
    "choose0":    "window.__game.choose(0)",
    "choose1":    "window.__game.choose(1)",
    "advance":    "window.__game.advance()",
}

# 每个标签首次出现时额外存一张 PNG，用于 release/yuegong/images/
SNAPS = [
    ("intro",     "01-intro.png"),
    ("n-start",   "02-start.png"),
    ("bridge",    "03-bridge.png"),
    ("gate",      "04-gate.png"),
    ("court",     "05-court.png"),
    ("ending",    "06-end-nichang.png"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/yuegong-demo.mp4")
    ap.add_argument("--imgs", default=None,
                    help="PNG 配图输出目录，默认 release/yuegong/images")
    ap.add_argument("--maxsecs", type=int, default=120)
    args = ap.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    base = "file://" + os.path.join(root, "tools", "yuegong", "index.html")
    frames_dir = "/tmp/yuegong_frames"
    imgs_dir = args.imgs or os.path.join(root, "release", "yuegong", "images")
    os.makedirs(frames_dir, exist_ok=True)
    os.makedirs(imgs_dir, exist_ok=True)
    for f in os.listdir(frames_dir):
        os.remove(os.path.join(frames_dir, f))

    errors = []
    nframes = 0
    snapped = set()

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

        page.goto(base + "?seed=123")
        page.wait_for_function("window.__ready === true", timeout=60000)
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_function("window.__ready === true", timeout=60000)
        page.wait_for_timeout(3000)

        idx = 0
        step_start = time.time()
        t0 = time.time()
        last = None

        while idx < len(STEPS):
            label, action, exit_cond = STEPS[idx]

            r = cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": QUALITY})
            nframes += 1
            with open(os.path.join(frames_dir, "%05d.jpg" % nframes), "wb") as fh:
                fh.write(base64.b64decode(r["data"]))

            for snap_label, snap_name in SNAPS:
                if label == snap_label and snap_label not in snapped:
                    snapped.add(snap_label)
                    png = cdp.send("Page.captureScreenshot", {"format": "png"})
                    with open(os.path.join(imgs_dir, snap_name), "wb") as fh:
                        fh.write(base64.b64decode(png["data"]))
                    print("  snap -> %s" % snap_name)

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
                st = page.evaluate("window.__game.state()")
                rs = page.evaluate("window.__game.resources()")
                print("  [%5.1fs] frames=%d -> %-11s node=%s w=%d t=%d d=%d"
                      % (time.time() - t0, nframes, label, st["nodeId"],
                         rs["warmth"], rs["tune"], rs["dance"]))
                last = label
            if time.time() - t0 > args.maxsecs:
                print("  timeout at %s" % label)
                break

        elapsed = time.time() - t0
        st = page.evaluate("window.__game.state()")
        assert st["nodeId"] == "end_nichang", "did not reach end_nichang, got %s" % st["nodeId"]
        assert page.evaluate(ACT_ENDING), "ending view not active"
        browser.close()

    print("captured %d frames in %.1fs" % (nframes, elapsed))
    print("console/pageerror:", len(errors), errors[:6])
    if errors:
        print("ERRORS present, abort")
        sys.exit(1)
    if nframes < 40:
        print("too few frames (%d) -> 检查是否 headed / GPU 在软渲染" % nframes)
        sys.exit(1)
    if len(snapped) != len(SNAPS):
        print("only %d/%d snaps captured: %s" % (len(snapped), len(SNAPS), sorted(snapped)))
        sys.exit(1)

    fps = max(1.0, round(nframes / elapsed, 2))
    print("encoding at %.2f fps (real-time)" % fps)
    cmd = ["ffmpeg", "-y", "-framerate", str(fps),
           "-i", os.path.join(frames_dir, "%05d.jpg"),
           "-vf", "scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d" % (W, H, W, H),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
           "-movflags", "+faststart", args.out]
    subprocess.run(cmd, check=True, capture_output=True)
    print("OK -> %s" % args.out)
    print("images -> %s" % imgs_dir)


if __name__ == "__main__":
    main()
