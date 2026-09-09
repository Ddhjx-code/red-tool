"""Screenshot the live yuegong views headlessly so the visuals can be judged.

Renders each view through the real user path and captures the canvas plus UI,
then sends the shots to a vision model for review. Headless only.

Usage: python tests/shot_yuegong_views.py [node ...]
"""

import base64
import json
import os
import sys
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = "file://" + os.path.join(ROOT, "tools/yuegong/index.html")
OUT_DIR = os.path.join(ROOT, "docs/research/yuegong-drafts/shots")
VISION_MODEL = "qwen3.8-max"

DEFAULT_NODES = ["start", "bridge", "gate", "court", "return"]


def load_env():
    env = {}
    with open(os.path.join(ROOT, ".env"), encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def drive_to_node(page, node):
    page.evaluate("window.__game.reset()")
    page.evaluate("window.__game.start()")
    page.evaluate("window.__game.goto(%s)" % json.dumps(node))
    return page.evaluate("window.__game.state().nodeId") == node


def review(env, path):
    with open(path, "rb") as fh:
        uri = "data:image/png;base64," + base64.b64encode(fh.read()).decode()
    payload = {
        "model": VISION_MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": uri}},
            {"type": "text", "text": (
                "这是一个网页游戏的实机截图。三句话回答："
                "画面好看吗、有没有吸引力？视觉元素是不是太少、太依赖文字？"
                "特效和粒子是否过多或显得廉价？"
            )},
        ]}],
    }
    req = urllib.request.Request(
        env["MAAS_BASE_URL"].rstrip("/") + "/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + env["MAAS_API_KEY"],
                 "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        body = json.loads(resp.read().decode())
    choices = body.get("choices") or (body.get("output") or {}).get("choices") or []
    if not choices:
        return "UNPARSED: " + json.dumps(body, ensure_ascii=False)[:250]
    msg = choices[0].get("message", {}).get("content")
    return msg if isinstance(msg, str) else " ".join(p.get("text", "") for p in msg)


def main():
    sys.stdout.reconfigure(line_buffering=True)
    env = load_env()
    os.makedirs(OUT_DIR, exist_ok=True)
    nodes = sys.argv[1:] or DEFAULT_NODES

    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 430, "height": 932})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(PAGE)
        page.wait_for_timeout(1200)

        shots = []
        for node in nodes:
            if not drive_to_node(page, node):
                print("SKIP %s (unreachable)" % node)
                continue
            page.wait_for_timeout(900)
            dest = os.path.join(OUT_DIR, "shot_%s.png" % node)
            page.screenshot(path=dest)
            shots.append((node, dest))
            print("shot %s -> %s (%.0f KB)" % (node, os.path.basename(dest),
                                               os.path.getsize(dest) / 1024))
        browser.close()

    print("\nconsole errors: %d %s" % (len(errors), errors[:3] if errors else ""))

    for node, dest in shots:
        print("\n=== %s ===" % node)
        try:
            for line in review(env, dest).splitlines():
                print("  " + line)
        except Exception as exc:
            print("  vision FAILED: %s %s" % (type(exc).__name__, str(exc)[:120]))

    print("\nout dir = %s" % OUT_DIR)


if __name__ == "__main__":
    main()
