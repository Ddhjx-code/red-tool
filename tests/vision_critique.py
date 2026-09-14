"""Vision critique harness: send screenshots to the gateway's vision model.

Usage:
    python tests/vision_critique.py SHOT.png [SHOT2.png ...] --ask "问题"
    python tests/vision_critique.py SHOT.png                # 用默认 CG 观感问题
    python tests/vision_critique.py SHOT.png --models       # 列出网关模型

Contract (docs/research/maas-image-api.md, 实测 2026-09-08):
POST {MAAS_BASE_URL}/chat/completions, `content` 为列表, 含 image_url 块;
响应走普通文本路径 choices[0].message.content, 不是出图那条 output.choices.
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAT_PATH = "/chat/completions"
MODELS_PATH = "/models"

# 图片验收一律用 qwen3.8-max, 不得换成 deepseek/glm 系列 —— 它们会静默丢图并
# 回「我看不到图片」, 不报错, 于是验收结论看似合理却完全无效。
VISION_MODEL = "qwen3.8-max"

DEFAULT_ASK = (
    "这是一款中秋灯笼小游戏的实机截图。请以美术总监的视角直白评价：\n"
    "1) 整体观感像不像 CG 级的作品？更像哪种档次（网页小游戏/CG/电影级）？\n"
    "2) 灯光与色彩是否可信？有没有发灰、发脏、过曝、塑料感？\n"
    "3) 构图与层次（远景/中景/近景）是否成立？哪里空、哪里挤？\n"
    "4) 最丑的三处具体是什么？给可执行的修改方向。\n"
    "请具体、直接，不要客套。"
)


def load_env():
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        raise SystemExit("FATAL: repo-root .env not found at %s" % path)
    env = {}
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip().lstrip("\ufeff")
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export "):].lstrip()
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key, value = key.strip(), value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            if key:
                env[key] = value
    missing = [k for k in ("MAAS_BASE_URL", "MAAS_API_KEY") if not env.get(k)]
    if missing:
        raise SystemExit("FATAL: .env missing %s" % ", ".join(missing))
    return env


def data_url(path):
    mime = mimetypes.guess_type(path)[0] or "image/png"
    with open(path, "rb") as fh:
        return "data:%s;base64,%s" % (mime, base64.b64encode(fh.read()).decode("ascii"))


def list_models(env):
    url = env["MAAS_BASE_URL"].rstrip("/") + MODELS_PATH
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + env["MAAS_API_KEY"]})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def ask(env, images, question):
    url = env["MAAS_BASE_URL"].rstrip("/") + CHAT_PATH
    content = [{"type": "image_url", "image_url": {"url": data_url(p)}} for p in images]
    content.append({"type": "text", "text": question})
    payload = {"model": VISION_MODEL, "messages": [{"role": "user", "content": content}]}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + env["MAAS_API_KEY"],
                 "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError("no choices: " + json.dumps(body, ensure_ascii=False)[:400])
    out = choices[0].get("message", {}).get("content")
    if not isinstance(out, str) or not out.strip():
        raise RuntimeError("empty/odd content: " + json.dumps(out, ensure_ascii=False)[:400])
    usage = body.get("usage") or {}
    return out, usage


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="*")
    ap.add_argument("--ask", default=DEFAULT_ASK)
    ap.add_argument("--models", action="store_true")
    args = ap.parse_args()

    env = load_env()

    if args.models:
        print(json.dumps(list_models(env), ensure_ascii=False, indent=2))
        return 0

    if not args.images:
        ap.error("need at least one image path")

    for p in args.images:
        if not os.path.exists(p):
            raise SystemExit("FATAL: no such image %s" % p)

    text, usage = ask(env, args.images, args.ask)
    print("model: %s | images: %d | usage: %s" % (VISION_MODEL, len(args.images), usage))
    print("-" * 68)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
