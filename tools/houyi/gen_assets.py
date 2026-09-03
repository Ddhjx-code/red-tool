"""后羿射日 文生图素材生成。
API key 从环境变量 BAILIAN_KEY 读取，绝不写入仓库。
画风参考：山海御空 yinglong.webp（神话生物风格）。
轮廓对齐契约见 prototype.html SHAPES —— 生成的图要贴合碰撞体轮廓。
"""
import base64
import json
import os
import sys
import urllib.request

ENDPOINT = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions"
MODEL = "wan2.7-image-pro"
ROOT = os.path.dirname(os.path.abspath(__file__))
REF = os.environ.get("HOUYI_REF") or os.path.join(
    ROOT, "..", "shanhai", "assets", "img", "yinglong.webp")
OUT = os.path.join(ROOT, "assets", "img", "raw")

STYLE = (
    "严格保持与参考图一致的中国上古神话国风插画画风："
    "厚重矿物颜料质感、金红与青黑主调、清晰硬边轮廓、无背景杂物。"
)

# 每项 = (文件名, 提示词)。提示词描述碰撞轮廓，保证所见即所撞。
TASKS = [
    ("jinwu",
     "三足金乌，中国上古神话中的太阳神鸟，侧面视角、头朝左。"
     "圆润鸟身、向上伸出的长颈与小头、尖喙、向右上方扬起的长尾羽、贴身翅膀、"
     "腹部清晰伸出三只细长足。金红色羽毛带火焰般光晕，眼为金色。"
     "整体紧凑成一只完整的鸟，纯白色背景，单个主体居中，无文字无边框。"),
    ("trunk",
     "扶桑神树的一段竖直枝干，深褐古木纹理。"
     "上下两端平整且略宽（便于堆叠），中段明显收腰变细。"
     "竖直长条造型，比例瘦高，纯白色背景，单个主体居中，无文字无边框。"),
    ("beam",
     "扶桑神树的一段水平横枝，深褐古木纹理。"
     "整体为扁长条，两端平整切口，顶面有两处向上的节瘤凸起。"
     "水平横放造型，纯白色背景，单个主体居中，无文字无边框。"),
    ("arrow",
     "中国古代白羽箭（素缯），水平放置、箭头朝右。"
     "极细长的箭杆、右侧三角形箭头、左侧尾羽。白色与浅灰为主，箭杆笔直。"
     "长宽比约 6:1 的细长造型，纯白色背景，单个主体居中，无文字无边框。"),
    ("rilun",
     "太阳日轮，正圆形。金色光辉环绕的圆轮，中心为金乌巢纹样，"
     "边缘放射状金芒。正圆造型，纯白色背景，单个主体居中，无文字无边框。"),
    ("houyi",
     "后羿，中国上古神话射日英雄，侧身拉弓仰射的姿态。"
     "红色彤弓、白色箭矢，肌肉线条有力，衣袍为上古风。"
     "全身像，纯白色背景，单个主体居中，无文字无边框。"),
]


def ref_data_uri():
    ext = os.path.splitext(REF)[1].lower().lstrip(".")
    mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp"}.get(ext, "png")
    with open(REF, "rb") as fh:
        return "data:image/%s;base64," % mime + base64.b64encode(fh.read()).decode()


def generate(name, prompt, key, ref):
    body = {
        "model": MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image", "image": ref},
                {"type": "text", "text": STYLE + prompt},
            ],
        }],
    }
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError("HTTP %s: %s" % (exc.code, exc.read().decode()[:1200]))

    out = data.get("output") or data
    msg = out["choices"][0]["message"]
    content = msg.get("content")
    if isinstance(content, list):
        for part in content:
            if part.get("type") in ("image", "image_url"):
                url = part.get("image") or part.get("image_url", {}).get("url")
                if url:
                    return url
    raise RuntimeError("响应中未找到图片: " + json.dumps(msg)[:400])


def fetch_image(url, dest):
    if url.startswith("data:"):
        raw = base64.b64decode(url.split(",", 1)[1])
    else:
        with urllib.request.urlopen(url, timeout=300) as resp:
            raw = resp.read()
    with open(dest, "wb") as fh:
        fh.write(raw)
    return len(raw)


def main():
    key = os.environ.get("BAILIAN_KEY")
    if not key:
        print("缺少 BAILIAN_KEY 环境变量", file=sys.stderr)
        return 1
    os.makedirs(OUT, exist_ok=True)
    ref = ref_data_uri()

    only = sys.argv[1:] or [t[0] for t in TASKS]
    for name, prompt in TASKS:
        if name not in only:
            continue
        dest = os.path.join(OUT, name + ".png")
        print("生成 %s ..." % name, flush=True)
        try:
            url = generate(name, prompt, key, ref)
            size = fetch_image(url, dest)
            print("  -> %s (%d bytes)" % (dest, size), flush=True)
        except Exception as exc:
            print("  !! %s 失败: %s" % (name, exc), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
