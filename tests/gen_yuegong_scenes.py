"""Generate the 3 yuegong style drafts (bridge/gate/court) via the MaaS gateway.

Prompts are copied verbatim from docs/research/yuegong-prompts.md.
The style suffix must stay byte-identical across all three scenes.
Usage: python tests/gen_yuegong_scenes.py [scene] [variant]  # variant -> scene_gate_b.png
"""

import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "docs", "research", "yuegong-drafts")

STYLE_SUFFIX = (
    "工笔画，绢本设色，青绿山水基调，月白#EEF7F2、石青#2E5D8C、缃绮#F8C471 色板，"
    "宣纸质感，留白构图。"
)

NEG_LANDSCAPE = "人物，文字，水印，建筑物变形，不自然颜色，过度饱和，text，watermark，oversaturated"

NEG_PORTRAIT = (
    "变形的手，多余手指，面部变形，不对称眼睛，extra fingers，deformed hands，"
    "文字，水印，建筑物变形，不自然颜色，过度饱和，text，watermark，oversaturated"
)

SCENES = [
    {
        "name": "bridge",
        "file": "scene_bridge.png",
        "negative": NEG_LANDSCAPE,
        "prompt": (
            "一道银白色石桥横跨夜空，桥体自画面下缘蜿蜒延伸至上方的巨大满月，桥面微微发光。\n"
            "唐代中秋望夜，桥下云海翻涌，人间宫阙灯火在远处下方若隐若现。\n"
            "全景，平视，广角。月光倾泻，体积光，光束穿透，雾气光线，冷色调光，低照度。\n"
            + STYLE_SUFFIX
        ),
    },
    {
        "name": "gate",
        "file": "scene_gate.png",
        "negative": NEG_PORTRAIT,
        "prompt": (
            "一座巍峨的月宫宫门矗立夜空，门楣悬匾额，门前两名兵卫持白刃肃立，白刃粲然望之如凝雪。\n"
            "唐代月宫广寒清虚之府，夜空青黛深邃，宫门之上月轮高悬，月轮完整不被云层遮挡。\n"
            "全景，仰视。月光倾泻，轮廓光，冷色调光，低照度，兵卫身形与宫门边缘清晰分离。\n"
            + STYLE_SUFFIX
        ),
    },
    {
        "name": "court",
        "file": "scene_court.png",
        "negative": NEG_PORTRAIT,
        "prompt": (
            "十余位素娥身着皓衣、乘白鸾，在一株巨大桂树下起舞，衣袖飘举。\n"
            "唐代月宫广庭，广陵大桂树之下，夜空高远，庭前留白开阔。\n"
            "远景，平视。月光倾泻，轮廓光，逆光，体积光，冷色调光，\n"
            "素娥皓衣靠轮廓光与逆光从深色夜空底上清晰跳出。桂花为缃绮金。\n"
            + STYLE_SUFFIX
        ),
    },
]


def load_env():
    env = {}
    with open(os.path.join(ROOT, ".env"), encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def request_image(env, prompt, negative):
    url = env["MAAS_BASE_URL"].rstrip("/") + "/chat/completions"
    payload = {
        "model": env.get("MAAS_IMAGE_MODEL", "wan2.7-image-pro"),
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        "parameters": {"size": "720*1280"},
        "negative_prompt": negative,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + env["MAAS_API_KEY"],
                 "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    choices = (body.get("output") or {}).get("choices") or []
    if not choices:
        raise RuntimeError("no choices: " + json.dumps(body, ensure_ascii=False)[:300])

    parts = choices[0].get("message", {}).get("content") or []
    image_url = None
    for part in parts:
        if part.get("type") == "image" and part.get("image"):
            image_url = part["image"]
            break
    if not image_url:
        raise RuntimeError("no image in response: " + json.dumps(parts, ensure_ascii=False)[:300])

    size = (body.get("usage") or {}).get("size")
    return image_url, size


def download(image_url, dest):
    req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()
    with open(dest, "wb") as fh:
        fh.write(data)
    return len(data)


def png_dims(path):
    with open(path, "rb") as fh:
        head = fh.read(33)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w = int.from_bytes(head[16:20], "big")
    h = int.from_bytes(head[20:24], "big")
    return w, h


def main():
    env = load_env()
    os.makedirs(OUT_DIR, exist_ok=True)

    suffixes = {s["prompt"].splitlines()[-1] for s in SCENES}
    if len(suffixes) != 1:
        print("FATAL: style suffix differs across scenes")
        sys.exit(1)
    print("style suffix byte-identical across 3 scenes  OK")

    only = sys.argv[1] if len(sys.argv) > 1 else None
    variant = sys.argv[2] if len(sys.argv) > 2 else None
    scenes = [s for s in SCENES if only is None or s["name"] == only]

    for scene in scenes:
        stem, ext = os.path.splitext(scene["file"])
        fname = "%s_%s%s" % (stem, variant, ext) if variant else scene["file"]
        print("\n--- %s ---" % scene["name"])
        print("  filename   = %s" % fname)
        try:
            image_url, size = request_image(env, scene["prompt"], scene["negative"])
        except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError) as exc:
            print("  FAILED: %s" % exc)
            continue

        dest = os.path.join(OUT_DIR, fname)
        try:
            nbytes = download(image_url, dest)
        except (urllib.error.HTTPError, urllib.error.URLError) as exc:
            print("  download FAILED: %s" % exc)
            continue

        dims = png_dims(dest)
        print("  api size   = %s" % size)
        print("  saved      = %s (%.0f KB)" % (fname, nbytes / 1024))
        print("  png dims   = %s  %s" % (dims, "OK" if dims == (720, 1280) else "MISMATCH"))

    print("\nout dir = %s" % OUT_DIR)
    for f in sorted(os.listdir(OUT_DIR)):
        if f.endswith(".png"):
            print("  %s" % f)


if __name__ == "__main__":
    main()
