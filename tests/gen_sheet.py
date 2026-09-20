"""通用角色动作表：一次生成「同一角色的 N 帧动作序列」，交 Qwen 定位，再一次切分全部帧。

    python3 tests/gen_sheet.py --name lion-walk --frames 6 --grid 3x2 \
        --char "..." --action "..."
"""
import argparse
import json
import os
import re
import sys
import urllib.error

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_wuhuolong_dragon import RAW_DIR, download, key_pipeline, load_env, request_image  # noqa: E402
import vision_ask  # noqa: E402

STYLE = ("2D横版动作游戏素材，平涂赛璐璐上色，粗墨黑描边，"
         "无写实渲染、无光影渐变、无地面、无投影、无粒子。**画面上不要出现任何文字、标签、边框、数字、网格线。**")


def build_prompt(char, action, frames, cols, rows, extra=""):
    return (
        "**动作序列表（sprite sheet）**：一张图里画**同一个角色**的**%d 帧连续动作**，"
        "%d列×%d行 网格排列、每格大小相等、互不重叠、每格角色都完整不被裁切。"
        "**角色**：%s"
        "**这 %d 帧必须是同一个动作的连续分解**（像翻页动画），"
        "**身体位置逐帧推进、四肢姿态逐帧变化，第 1 帧和第 %d 帧要能无缝接回**。"
        "**%s**"
        "**四格必须是同一个人：脸型、发型、身材比例、服装配色与纹样、配饰位置全部一致，只有姿态不同。**"
        "**背景为纯品红#FF00FF 纯色平涂**，每格背景完全纯色；角色外轮廓为干净闭合的粗墨黑描边。"
        "%s%s"
        % (frames, cols, rows, char, frames, frames, action, extra, STYLE)
    )


def build_ask(frames, cols, rows):
    return (
        "这是一张 %d列×%d行 的角色动作序列表，纯品红#FF00FF 背景，里面是同一个人的 %d 帧连续动作。"
        "请**按阅读顺序（从左到右、从上到下）**逐格输出每个人物的紧致包围盒。"
        "坐标用 0-1000 归一化整数：x0=左边界/图宽*1000，y0=上边界/图高*1000，x1=右边界/图宽*1000，y1=下边界/图高*1000。"
        "包围盒贴紧人物本体（含手持道具），不要含大片纯色背景，也不要切掉任何部分。"
        "只输出 JSON，不要解释、不要 markdown："
        '{"frames":[{"idx":1,"x0":0,"y0":0,"x1":300,"y1":500}]}'
        % (cols, rows, frames)
    )


def main():
    sys.stdout.reconfigure(line_buffering=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True, help="输出前缀，如 lion-walk")
    ap.add_argument("--frames", type=int, required=True)
    ap.add_argument("--grid", default="3x2", help="列x行，如 3x2")
    ap.add_argument("--char", required=True, help="角色描述")
    ap.add_argument("--action", required=True, help="动作描述")
    ap.add_argument("--extra", default="")
    ap.add_argument("--long-edge", type=int, default=560)
    ap.add_argument("--pad", type=float, default=0.06)
    ap.add_argument("--boxes-only", action="store_true", help="复用已缓存 raw，只重识别切分")
    args = ap.parse_args()
    cols, rows = (int(v) for v in args.grid.lower().split("x"))
    if cols * rows != args.frames:
        raise SystemExit("FATAL: %d列×%d行 != %d 帧" % (cols, rows, args.frames))

    raw = os.path.join(RAW_DIR, "SHEET_%s.png" % args.name)
    os.makedirs(RAW_DIR, exist_ok=True)
    env = load_env()

    if not args.boxes_only:
        if os.path.exists(raw):
            os.remove(raw)
        prompt = build_prompt(args.char, args.action, args.frames, cols, rows, args.extra)
        print("prompt = %d chars" % len(prompt))
        r = request_image(env, prompt, True)
        if r is None:
            raise SystemExit("FATAL: 未生成")
        url, api_size = r
        try:
            n = download(url, raw)
        except (urllib.error.HTTPError, urllib.error.URLError) as exc:
            raise SystemExit("FATAL: 下载失败 %s（OSS URL 约 24h 过期）" % exc)
        print("api size = %s  raw %.0f KB" % (api_size, n / 1024.0))

    sheet = Image.open(raw)
    print("sheet = %dx%d" % sheet.size)

    ans = vision_ask.ask(env, "qwen3.8-max", build_ask(args.frames, cols, rows), [raw])
    text = ans[0] if isinstance(ans, tuple) else ans
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise SystemExit("FATAL: Qwen 未返回 JSON:\n%s" % text[:600])
    frames = json.loads(m.group(0)).get("frames") or []
    if len(frames) != args.frames:
        raise SystemExit("FATAL: 期望 %d 帧，Qwen 给了 %d" % (args.frames, len(frames)))
    for f in frames:
        print("  [%d] box=(%s,%s,%s,%s)" % (f.get("idx"), f.get("x0"), f.get("y0"), f.get("x1"), f.get("y1")))

    w, h = sheet.size
    out = []
    for i, f in enumerate(frames):
        x0 = f["x0"] / 1000.0 * w
        y0 = f["y0"] / 1000.0 * h
        x1 = f["x1"] / 1000.0 * w
        y1 = f["y1"] / 1000.0 * h
        px = (x1 - x0) * args.pad
        py = (y1 - y0) * args.pad
        box = (max(0, int(x0 - px)), max(0, int(y0 - py)),
               min(w, int(x1 + px)), min(h, int(y1 + py)))
        tile = sheet.crop(box)
        tile_path = os.path.join(RAW_DIR, "%s_tile%02d.png" % (args.name, i))
        tile.save(tile_path)
        dest, key, size = key_pipeline(tile_path, {"file": "%s-%02d.webp" % (args.name, i),
                                                  "long_edge": args.long_edge})
        # 抠像后按 alpha 紧致裁剪：切掉透明边距，同时清掉「邻帧框重叠」带来的分离碎片
        keyed = Image.open(dest).convert("RGBA")
        bb = keyed.getbbox()
        if bb and bb != (0, 0, keyed.width, keyed.height):
            trim = keyed.crop(bb)
            trim.save(dest, "WEBP", lossless=False, quality=88, method=6)
            size = trim.size
        kb = os.path.getsize(dest) / 1024.0
        print("  KEYED %s-%02d.webp  %dx%d  %.1f KiB" % (args.name, i, size[0], size[1], kb))
        out.append(dest)
    print("\n产出 %d 帧：%s" % (len(out), ", ".join(os.path.basename(p) for p in out)))


if __name__ == "__main__":
    main()
