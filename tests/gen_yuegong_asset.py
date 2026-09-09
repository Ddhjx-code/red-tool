"""Generate an isolated 工笔绢本 element asset and judge whether it is composable.

The asset-composition route needs elements that code can splice together, which
requires either an alpha channel or a clean uniform background that can be keyed.
This script generates candidate variants and decides empirically which strategy
works, using both objective metrics (Pillow) and subjective review (vision model).

Usage: python tests/gen_yuegong_asset.py [element] [variant]
"""

import base64
import json
import os
import sys
import urllib.error
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "docs", "research", "yuegong-drafts", "assets")
VISION_MODEL = "qwen3.8-max"

# Byte-identical style suffix. Must match gen_yuegong_scenes.py so the asset set
# and any scene work stay in one art language.
STYLE_SUFFIX = (
    "工笔画，绢本设色，青绿山水基调，月白#EEF7F2、石青#2E5D8C、缃绮#F8C471 色板，"
    "宣纸质感，留白构图。"
)

NEG = "文字，水印，边框，阴影，投影，渐变背景，复杂背景，text，watermark，border，shadow，gradient background"

# Keying strategies under test. A 绢本 tone is warm cream, so pure white would
# blend into the subject; a saturated color outside the 工笔 palette is the
# candidate that should separate cleanly.
VARIANTS = {
    "white": "纯白色背景，#FFFFFF，完全均匀的纯色背景，无任何纹理。",
    "magenta": "纯洋红色背景，#FF00FF，完全均匀的纯色背景，无任何纹理。",
    "green": "纯绿色背景，#00FF00，完全均匀的纯色背景，无任何纹理。",
    "cream": "纯绢本色背景，均匀纯色，无任何纹理。",
}

ELEMENTS = {
    "guizhi": (
        "一枝桂花枝，工笔花鸟画，枝叶与花朵完整，构图居中。"
        "孤立元素，四周大量留白，元素不与画面边缘接触。"
    ),
    "guishu": (
        "一株桂树，工笔画，树冠完整，枝干舒展，竖向构图。"
        "孤立元素，四周大量留白，不与画面边缘接触。"
    ),
    "yuelun": (
        "一轮满月，月轮以细线勾勒轮廓，月面内有一株桂树的淡影，枝干分明可辨，"
        "工笔重彩，层层敷彩，绢本底质，不要水彩晕染。"
        "孤立元素，四周大量留白，圆形居中，不与画面边缘接触。"
    ),
    "yinqiao": (
        "一段银色石桥，桥身自左向右蜿蜒，桥面泛着银光，工笔设色。"
        "孤立元素，四周大量留白，不与画面边缘接触。"
    ),
    "gongmen": (
        "一座月宫宫门城阙，飞檐斗拱，门楣悬匾额，工笔界画。"
        "孤立元素，四周大量留白，不与画面边缘接触。"
    ),
    "bairen": (
        "两名守门兵卫手持白色长刃肃立，衣袍褶皱分明，刃身光洁如凝雪，工笔重彩，"
        "衣纹以游丝描勾勒，设色层层晕染，绢本底质，不要矢量平涂，不要赛璐璐风格。"
        "孤立元素，四周大量留白，不与画面边缘接触。"
        "整个画面背景全部是纯洋红色，四边和四角也必须是纯洋红，不要绢素底纹，不要米色边缘。"
    ),
    "suequn": (
        "十余位白衣仙人在远处起舞，身形纤小，衣袖飘举，只作远景群像不作单人特写，工笔设色。"
        "孤立元素，四周大量留白，不与画面边缘接触。"
    ),
    "bailuan": (
        "一只白色鸾鸟，展翅飞翔，羽翼完整，工笔花鸟画。"
        "孤立元素，四周大量留白，不与画面边缘接触。"
    ),
    "yunwen": (
        "一团祥云纹样，工笔线描，云纹卷曲完整，横向构图。"
        "孤立元素，四周大量留白，不与画面边缘接触。"
    ),
    "denghuo": (
        "远处人间宫阙的一点灯火，暖黄色光点，周围是夜色，工笔设色。"
        "孤立元素，四周大量留白，不与画面边缘接触。"
    ),
}

ASSET_SIZE = "1024*1024"


def load_env():
    env = {}
    with open(os.path.join(ROOT, ".env"), encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def post(env, payload):
    req = urllib.request.Request(
        env["MAAS_BASE_URL"].rstrip("/") + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + env["MAAS_API_KEY"],
                 "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode("utf-8"))


def request_image(env, prompt):
    body = post(env, {
        "model": env.get("MAAS_IMAGE_MODEL", "wan2.7-image-pro"),
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        "parameters": {"size": ASSET_SIZE},
        "negative_prompt": NEG,
    })
    choices = (body.get("output") or {}).get("choices") or []
    if not choices:
        raise RuntimeError("no choices: " + json.dumps(body, ensure_ascii=False)[:300])
    for part in choices[0].get("message", {}).get("content") or []:
        if part.get("type") == "image" and part.get("image"):
            return part["image"], (body.get("usage") or {}).get("size")
    raise RuntimeError("no image in response")


def download(image_url, dest):
    req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()
    with open(dest, "wb") as fh:
        fh.write(data)
    return len(data)


def analyze(path):
    """Objective metrics: alpha presence + background uniformity for keying."""
    im = Image.open(path)
    out = {"mode": im.mode, "size": im.size}

    if im.mode in ("RGBA", "LA", "PA"):
        alpha = im.getchannel("A")
        vals = list(alpha.tobytes())
        out["has_alpha"] = True
        out["alpha_min"] = min(vals)
        out["alpha_max"] = max(vals)
        out["alpha_transparent_pct"] = round(100.0 * sum(1 for v in vals if v < 8) / len(vals), 2)
    else:
        out["has_alpha"] = False

    rgb = im.convert("RGB")
    w, h = rgb.size
    ring = []
    for x in range(w):
        ring.append(rgb.getpixel((x, 0)))
        ring.append(rgb.getpixel((x, h - 1)))
    for y in range(h):
        ring.append(rgb.getpixel((0, y)))
        ring.append(rgb.getpixel((w - 1, y)))

    n = len(ring)
    mean = [round(sum(c[i] for c in ring) / n) for i in range(3)]
    std = [round((sum((c[i] - mean[i]) ** 2 for c in ring) / n) ** 0.5, 1) for i in range(3)]
    out["border_mean_rgb"] = mean
    out["border_std_rgb"] = std
    out["corners"] = [rgb.getpixel((0, 0)), rgb.getpixel((w - 1, 0)),
                      rgb.getpixel((0, h - 1)), rgb.getpixel((w - 1, h - 1))]
    out["border_uniform"] = max(std) < 16.0
    return out


def vision_review(env, path):
    """Subjective review via a vision-capable model.

    Keep the prompt short. A long multi-part analytical prompt stalled the call
    for minutes on this gateway, while a concise one replies in ~4s.
    """
    with open(path, "rb") as fh:
        ext = path.rsplit(".", 1)[-1].lower()
        mime = "image/webp" if ext == "webp" else "image/png"
        uri = "data:%s;base64,%s" % (mime, base64.b64encode(fh.read()).decode())
    body = post(env, {
        "model": VISION_MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": uri}},
            {"type": "text", "text": (
                "游戏素材图。三句话回答：是不是工笔绢本风格？主体是否完整无缺损？"
                "边缘有无残留洋红或被误删的部分？"
            )},
        ]}],
    })
    choices = body.get("choices") or (body.get("output") or {}).get("choices") or []
    if not choices:
        return "UNPARSED: " + json.dumps(body, ensure_ascii=False)[:300]
    content = choices[0].get("message", {}).get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return " ".join(p.get("text", "") for p in content if isinstance(p, dict)).strip()
    return "UNPARSED"


def main():
    sys.stdout.reconfigure(line_buffering=True)
    env = load_env()
    os.makedirs(OUT_DIR, exist_ok=True)

    element = sys.argv[1] if len(sys.argv) > 1 else "guizhi"
    variants = [sys.argv[2]] if len(sys.argv) > 2 else list(VARIANTS)

    if element not in ELEMENTS:
        print("unknown element: %s (choose from %s)" % (element, ", ".join(ELEMENTS)))
        sys.exit(1)

    for variant in variants:
        if variant not in VARIANTS:
            print("unknown variant: %s (choose from %s)" % (variant, ", ".join(VARIANTS)))
            continue

        prompt = ELEMENTS[element] + "\n" + VARIANTS[variant] + "\n" + STYLE_SUFFIX
        fname = "asset_%s_%s.png" % (element, variant)
        dest = os.path.join(OUT_DIR, fname)

        print("\n=== %s / %s ===" % (element, variant))
        try:
            image_url, api_size = request_image(env, prompt)
            nbytes = download(image_url, dest)
        except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError) as exc:
            print("  GENERATE FAILED: %s" % exc)
            continue

        print("  api size = %s | saved %s (%.0f KB)" % (api_size, fname, nbytes / 1024))

        metrics = analyze(dest)
        print("  --- objective (Pillow) ---")
        for k in ("mode", "size", "has_alpha", "alpha_transparent_pct",
                  "border_mean_rgb", "border_std_rgb", "border_uniform", "corners"):
            if k in metrics:
                print("  %-22s %s" % (k, metrics[k]))

        print("  --- subjective (%s) ---" % VISION_MODEL)
        try:
            review = vision_review(env, dest)
            for line in review.splitlines():
                print("  " + line)
        except (urllib.error.HTTPError, urllib.error.URLError) as exc:
            print("  vision FAILED: %s" % exc)

        print("  next: python tests/key_yuegong_asset.py %s" % dest)

    print("\nout dir = %s" % OUT_DIR)


if __name__ == "__main__":
    main()
