"""舞龙人动作表：一次生成「同一角色多动作」，交 Qwen 定位，再一次切分出全部动作。

角色一致性靠「同一次生成」保证，而不是靠提示词里反复描述同一个人。

    python3 tests/gen_wuhuolong_sheet.py           # 生成 + 识别 + 切分
    python3 tests/gen_wuhuolong_sheet.py --boxes   # 复用已缓存的 raw，只重新识别切分
"""
import argparse
import json
import os
import re
import sys
import urllib.error

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_wuhuolong_dragon import (RAW_DIR, SHIP_DIR, download, key_pipeline,  # noqa: E402
                                  load_env, request_image)
import vision_ask  # noqa: E402

SHEET_RAW = os.path.join(RAW_DIR, "SHEET_MAN_sheet.png")
TILE_DIR = os.path.join(RAW_DIR, "sheet_tiles")

POSES = [
    {"key": "idle", "file": "man-dancer.webp", "long_edge": 560,
     "desc": "站立待机：弓步、双手持竿斜举"},
    {"key": "walk", "file": "man-walk.webp", "long_edge": 560,
     "desc": "行走：跨步前行中"},
    {"key": "jump", "file": "man-jump.webp", "long_edge": 560,
     "desc": "跳跃：腾空、收膝"},
    {"key": "thrust", "file": "man-thrust.webp", "long_edge": 560,
     "desc": "前刺：上身大幅前倾、竿向前平伸捅出"},
]

PROMPT = (
    "**角色动作表（sprite sheet）**：一张图里画**同一个角色**的**四个不同动作**，"
    "2×2 网格排列、四格大小相等、互不重叠、每格角色都完整不被裁切。"
    "角色是**一位年轻的中国舞龙人**，短打劲装、头缠红巾、束腰、绑腿红靴，"
    "左肩甲是一只张口的小龙头（有角有须），腰带下垂龙尾状飘带，背后斜挂绣龙小旗，"
    "手持一根暖金色长竹竿。配色统一：米白#ECE3D0 劲装、朱红#C9482C 头巾腰带、"
    "暖金#B8863C 竹竿、粗墨黑描边。**四格必须是同一个人：脸型、发型、身材比例、"
    "服装纹样、配饰位置、竹竿样式全部一致，只有姿势不同。**"
    "四格姿势：左上＝站立待机（弓步、双手持竿斜举）；右上＝行走（跨步前行）；"
    "左下＝跳跃（腾空收膝、竿举过头）；右下＝向前突刺（上身大幅前倾、"
    "双手把竹竿向前平伸捅出）。**姿态一律侧面朝右。**"
    "**背景为纯品红#FF00FF 纯色平涂**，四格背景完全纯色无渐变无纹理无阴影；"
    "角色外轮廓为干净闭合的粗墨黑描边，不要任何地面、投影、光晕、粒子。"
    "**画面上不要出现任何文字、标签、边框线、数字、箭头、网格线。**"
    "2D 横版动作游戏素材，平涂赛璐璐上色，无写实渲染。"
)

ASK = (
    "这是一张 2x2 的角色动作表，纯品红#FF00FF 背景，里面是同一个人的四个姿势。"
    "请找出**每一个人物**，按「左上、右上、左下、右下」顺序，输出它的紧致包围盒。"
    "坐标用 0-1000 的整数归一化：x0=左边界/图宽*1000，y0=上边界/图高*1000，"
    "x1=右边界/图宽*1000，y1=下边界/图高*1000。包围盒要贴紧人物本体"
    "（含竹竿等道具），不要包含大片纯色背景，也不要切掉人物任何部分。"
    "同时判断每个格子是「站立」「行走」「跳跃」「突刺」中的哪一种。"
    "只输出 JSON，不要任何解释、不要 markdown 代码块："
    '{"poses":[{"slot":"左上","pose":"站立","x0":0,"y0":0,"x1":500,"y1":500}]}'
)


def ask_boxes(env, sheet_path):
    answer = vision_ask.ask(env, "qwen3.8-max", ASK, [sheet_path])
    text = answer[0] if isinstance(answer, tuple) else answer
    if not isinstance(text, str):
        text = json.dumps(text)
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise SystemExit("FATAL: Qwen 没有返回 JSON:\n%s" % text[:800])
    data = json.loads(m.group(0))
    poses = data.get("poses") or []
    if len(poses) != 4:
        raise SystemExit("FATAL: 期望 4 个姿势，Qwen 给了 %d 个:\n%s" % (len(poses), text[:800]))
    return poses


def slice_tiles(sheet_path, poses, pad_ratio):
    im = Image.open(sheet_path).convert("RGB")
    w, h = im.size
    os.makedirs(TILE_DIR, exist_ok=True)
    out = []
    for i, p in enumerate(poses):
        x0 = p["x0"] / 1000.0 * w
        y0 = p["y0"] / 1000.0 * h
        x1 = p["x1"] / 1000.0 * w
        y1 = p["y1"] / 1000.0 * h
        pad_x = (x1 - x0) * pad_ratio
        pad_y = (y1 - y0) * pad_ratio
        box = (max(0, int(x0 - pad_x)), max(0, int(y0 - pad_y)),
               min(w, int(x1 + pad_x)), min(h, int(y1 + pad_y)))
        if box[2] - box[0] < 24 or box[3] - box[1] < 24:
            raise SystemExit("FATAL: 第 %d 格包围盒太小 %s" % (i + 1, box))
        tile = im.crop(box)
        dest = os.path.join(TILE_DIR, "tile%d_%s.png" % (i, p.get("pose", i)))
        tile.save(dest)
        p["_box"] = box
        p["_tile"] = dest
        out.append(p)
    return out


def main():
    sys.stdout.reconfigure(line_buffering=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--boxes", action="store_true", help="复用缓存的 raw，只重识别重切分")
    ap.add_argument("--pad", type=float, default=0.06, help="包围盒外扩比例")
    ap.add_argument("--poses", nargs="*", default=None, help="只切这几个姿势（idle walk jump thrust）")
    ap.add_argument("--slot", nargs="*", default=None,
                    help="手动指定四格的姿势顺序，覆盖 Qwen 的判断")
    args = ap.parse_args()

    env = load_env()

    if not args.boxes:
        if os.path.exists(SHEET_RAW):
            os.remove(SHEET_RAW)
        print("prompt = %d chars" % len(PROMPT))
        r = request_image(env, PROMPT, neg=True)
        if r is None:
            raise SystemExit("FATAL: 动作表未生成")
        url, api_size = r
        try:
            n = download(url, SHEET_RAW)
        except (urllib.error.HTTPError, urllib.error.URLError) as exc:
            raise SystemExit("FATAL: 下载失败 %s -- OSS URL 约 24h 过期" % exc)
        print("api size = %s  raw %.0f KB" % (api_size, n / 1024.0))
    elif not os.path.exists(SHEET_RAW):
        raise SystemExit("FATAL: 没有缓存的 raw：%s" % SHEET_RAW)

    sheet = Image.open(SHEET_RAW)
    print("sheet = %dx%d" % sheet.size)

    poses = ask_boxes(env, SHEET_RAW)
    for i, p in enumerate(poses):
        print("  [%d] %s -> %s   box=(%s,%s,%s,%s)"
              % (i + 1, p.get("slot", "?"), p.get("pose", "?"),
                 p.get("x0"), p.get("y0"), p.get("x1"), p.get("y1")))

    if args.slot:
        if len(args.slot) != 4:
            raise SystemExit("FATAL: --slot 需要恰好 4 个姿势名")
        for p, s in zip(poses, args.slot):
            p["pose"] = s

    tiles = slice_tiles(SHEET_RAW, poses, args.pad)

    alias = {"站立": "idle", "行走": "walk", "跳跃": "jump", "突刺": "thrust",
             "待机": "idle", "前刺": "thrust"}
    done = []
    for p in tiles:
        key = alias.get(p.get("pose"), p.get("pose"))
        spec = next((s for s in POSES if s["key"] == key), None)
        if spec is None:
            print("  ?? 无法映射姿势 %r，跳过（用 --slot 手动指定顺序）" % p.get("pose"))
            continue
        if args.poses and spec["key"] not in args.poses:
            continue
        dest, k, size = key_pipeline(p["_tile"], {"file": spec["file"],
                                                  "long_edge": spec["long_edge"]})
        kb = os.path.getsize(dest) / 1024.0
        print("  KEYED %-18s -> %-20s %dx%d  %.1f KiB  key=%s"
              % (p.get("pose"), os.path.basename(dest), size[0], size[1], kb, list(k)))
        done.append(dest)

    print("\n切分产出 %d 个文件：" % len(done))
    for d in done:
        print("  %s  (%.1f KiB)" % (os.path.join("tools/wuhuolong/assets/img",
                                                 os.path.basename(d)),
                                    os.path.getsize(d) / 1024.0))


if __name__ == "__main__":
    main()
