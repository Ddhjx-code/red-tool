"""CG vs 工笔 style comparison for the court scene.

The canonical 3-scene prompts in tests/gen_yuegong_scenes.py came back as digital CG
rather than 绢本设色工笔. Root cause: the scene body itself requests CG vocabulary
(体积光 / 光束穿透 / 雾气光线 / 轮廓光), which outweighs the painting cues in the
trailing style suffix. This script therefore strips the CG lighting terms from the
body AND front-loads the painting style, so the two treatments can be compared fairly.

Existing CG reference: docs/research/yuegong-drafts/scene_court.png
New 工笔 candidate:      docs/research/yuegong-drafts/scene_court_gongbi.png
"""

import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "docs", "research", "yuegong-drafts")
OUT_FILE = "scene_court_gongbi.png"

GONGBI_PREFIX = (
    "中国传统工笔画，绢本设色，青绿山水，矿物颜料分层罩染，铁线描勾勒轮廓，"
    "宣纸质感，留白构图，月白#EEF7F2、石青#2E5D8C、缃绮#F8C471 色板。\n"
)

GONGBI_BODY = (
    "十余位素娥身着皓衣、乘白鸾，在一株巨大桂树下起舞，衣袖飘举。\n"
    "唐代月宫广庭，广陵大桂树之下，夜空高远，庭前留白开阔。\n"
    "远景，平视。工笔人物画技法，衣纹以铁线描勾出，皓衣靠留白与淡墨衬底显形，\n"
    "桂花以缃绮金点染，夜空以石青罩染分层。\n"
)

NEG_GONGBI = (
    "数字插画，CG渲染，3D渲染，体积光，光束，发光特效，霓虹，塑料光泽，"
    "变形的手，多余手指，面部变形，不对称眼睛，extra fingers，deformed hands，"
    "文字，水印，建筑物变形，不自然颜色，过度饱和，"
    "digital illustration，CG render，3D render，volumetric glow，light beam，neon，"
    "text，watermark，oversaturated"
)

PROMPT = GONGBI_PREFIX + GONGBI_BODY


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


def png_dims(path):
    with open(path, "rb") as fh:
        head = fh.read(33)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")


def main():
    env = load_env()
    os.makedirs(OUT_DIR, exist_ok=True)

    print("prompt (%d chars):" % len(PROMPT))
    print(PROMPT)
    print("negative (%d chars):" % len(NEG_GONGBI))

    try:
        image_url, size = request_image(env, PROMPT, NEG_GONGBI)
    except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError) as exc:
        print("FAILED: %s" % exc)
        sys.exit(1)

    dest = os.path.join(OUT_DIR, OUT_FILE)
    nbytes = download(image_url, dest)
    dims = png_dims(dest)

    print("\napi size  = %s" % size)
    print("saved     = %s (%.0f KB)" % (OUT_FILE, nbytes / 1024))
    print("png dims  = %s  %s" % (dims, "OK" if dims == (720, 1280) else "MISMATCH"))

    cg = os.path.join(OUT_DIR, "scene_court.png")
    print("\ncompare:")
    print("  CG  reference = scene_court.png        (%.0f KB)"
          % (os.path.getsize(cg) / 1024) if os.path.exists(cg) else "  CG reference missing")
    print("  工笔 candidate = %s (%.0f KB)" % (OUT_FILE, nbytes / 1024))


if __name__ == "__main__":
    main()
