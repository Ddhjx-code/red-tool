#!/usr/bin/env python3
"""逐帧渲染视频：用负的 animation-delay 把 CSS 动画冻结在任意时刻。

页面读 location.hash 里的 t，给所有动画设 animation-delay: -t 秒并暂停，
同一份 CSS 动画就能在任意时刻定格。没有交互录制，也就没有录屏掉帧。
"""
import os
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE = os.path.dirname(os.path.abspath(__file__))
PAGE = "file://%s/index.html" % BASE
OUT = os.path.abspath(os.path.join(BASE, "..", "..", "build", "frames"))
FPS = 25
DUR = 17.0
WORKERS = 5


def shot(i):
    t = round(i / FPS, 3)
    dst = os.path.join(OUT, "f%04d.png" % i)
    # 已存在就跳过，允许中断续跑。改了时间轴要重渲时先删掉对应区间
    if os.path.exists(dst) and os.path.getsize(dst) > 10000:
        return
    ud = "/tmp/crf%d" % i
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", "--window-size=1080,1920",
        "--virtual-time-budget=2500", "--user-data-dir=%s" % ud,
        "--screenshot=%s" % dst, "%s#t=%s" % (PAGE, t),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    shutil.rmtree(ud, ignore_errors=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    n = int(DUR * FPS) + 1
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        list(ex.map(shot, range(n)))
    done = len([f for f in os.listdir(OUT) if f.startswith("f")])
    print("frames: %d/%d -> %s" % (done, n, OUT))
