"""扫描 img/ 下的序列帧（base-NN.webp），把帧数写回 data.js 的 ANIM_FRAMES。

    python3 tests/sync_anim_frames.py          # 扫描并同步
    python3 tests/sync_anim_frames.py --check  # 只检查是否为最新（CI 用）
"""
import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "tools", "wuhuolong", "assets", "img")
DATA = os.path.join(ROOT, "tools", "wuhuolong", "assets", "data.js")


def scan():
    src = open(DATA, encoding="utf-8").read()
    m = re.search(r"ANIM:\s*\{(.*?)\}\s*,\s*ANIM_FRAMES", src, re.S)
    if not m:
        raise SystemExit("FATAL: 无法从 data.js 解析 ANIM 区块")
    spec = m.group(1)
    bases = dict(re.findall(r"(\w+):\s*\{\s*base:\s*'([^']+)'", spec))
    out = {}
    for name, base in bases.items():
        n = 0
        while os.path.exists(os.path.join(IMG, "%s-%02d.webp" % (base, n))):
            n += 1
        out[name] = n
    return out, bases


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只校验，不写入")
    args = ap.parse_args()

    found, bases = scan()
    src = open(DATA, encoding="utf-8").read()
    cur = re.search(r"ANIM_FRAMES:\s*\{([^}]*)\}", src)
    if not cur:
        print("FATAL: data.js 里没有 ANIM_FRAMES")
        return 1
    have = {k.strip(): int(v) for k, v in
            (p.split(":") for p in cur.group(1).split(",") if p.strip())}

    print("片段        磁盘帧数   声明帧数")
    bad = False
    for name in sorted(found):
        mark = "ok" if found[name] == have.get(name, -1) else "!!"
        if mark == "!!":
            bad = True
        print("  %-8s %6d %10d  %s" % (name, found[name], have.get(name, -1), mark))

    if args.check:
        print("\n%s" % ("需同步" if bad else "已同步"))
        return 1 if bad else 0

    if not bad:
        print("\n已同步，无需改动")
        return 0
    body = ", ".join("%s: %d" % (k, found[k]) for k in sorted(found))
    out = re.sub(r"ANIM_FRAMES:\s*\{[^}]*\}", "ANIM_FRAMES: { %s }" % body, src)
    open(DATA, "w", encoding="utf-8").write(out)
    print("\n已写回 ANIM_FRAMES: { %s }" % body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
