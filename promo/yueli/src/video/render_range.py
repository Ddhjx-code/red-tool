#!/usr/bin/env python3
"""重渲染指定帧区间，直接覆盖同名文件。

改转场时只重渲受影响的几十帧，比整片重来省一半时间。
用法: python3 render_range.py 265 319
"""
import os
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE = os.path.dirname(os.path.abspath(__file__))
PAGE = "file://%s/index.html" % BASE
OUT = os.path.abspath(os.path.join(BASE, "..", "..", "build", "frames"))
FPS = 25


def shot(i):
    t = round(i / FPS, 3)
    dst = os.path.join(OUT, "f%04d.png" % i)
    ud = "/tmp/crr%d" % i
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", "--window-size=1080,1920",
        "--virtual-time-budget=2500", "--user-data-dir=%s" % ud,
        "--screenshot=%s" % dst, "%s#t=%s" % (PAGE, t),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    shutil.rmtree(ud, ignore_errors=True)


if __name__ == "__main__":
    a, b = int(sys.argv[1]), int(sys.argv[2])
    os.makedirs(OUT, exist_ok=True)
    with ThreadPoolExecutor(max_workers=5) as ex:
        list(ex.map(shot, range(a, b + 1)))
    print("rerendered %d-%d" % (a, b))
