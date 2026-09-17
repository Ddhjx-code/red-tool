"""Ask the MaaS vision model a question about an image.

Contract lives in docs/research/maas-image-api.md. The short version:

  POST {MAAS_BASE_URL}/chat/completions
  content is a LIST: [{"type":"image_url","image_url":{"url": <data url>}},
                      {"type":"text","text": <question>}]
  the answer comes back on the ordinary TEXT path: choices[0].message.content
  (a string), NOT output.choices[0].message.content[0].image.

Model choice is not taste. Per that doc's probe:
  qwen3.8-max / qwen3.8-flash / qwen3.7-plus   -> real vision
  qwen3.7-max                                  -> HTTP 400, refuses
  glm-5.2 / deepseek-v4-*                      -> SILENTLY DROP the image and
                                                  then claim "I cannot see an
                                                  image attached"
That last failure mode is the dangerous one: an acceptance check would come
back looking plausible while being entirely void. So this script refuses to
run against a model on the known-bad list.

Usage:
    python tests/vision_ask.py shot.png "这看起来像什么？"
    python tests/vision_ask.py a.png b.png "哪一张更像龙？" --json
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAT_PATH = "/chat/completions"

VISION_MODELS = ("qwen3.8-max", "qwen3.8-flash", "qwen3.7-plus")
BLIND_MODELS = ("glm-5.2", "deepseek-v4-pro", "deepseek-v4-flash-0731",
                "deepseek-v4-flash", "qwen3.7-max")

QUOTA_MARKERS = ("tpm_limit_exceeded", "allocated quota exceeded", "quota exceeded",
                 "throttling", "rate limit", "too many requests")
RETRY_MAX = 5
BACKOFF_BASE = 20.0
BACKOFF_CAP = 240.0


def load_env():
    """Same robust .env reader as tests/gen_yuedeng_moon.py; never echoes the key."""
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
        blob = fh.read()
    return "data:%s;base64,%s" % (mime, base64.b64encode(blob).decode("ascii")), len(blob)


def ask(env, model, question, paths):
    parts = []
    for p in paths:
        url, nbytes = data_url(p)
        parts.append({"type": "image_url", "image_url": {"url": url}})
    parts.append({"type": "text", "text": question})
    payload = {"model": model, "messages": [{"role": "user", "content": parts}]}

    url = env["MAAS_BASE_URL"].rstrip("/") + CHAT_PATH
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + env["MAAS_API_KEY"],
                 "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    choices = (body.get("output") or {}).get("choices") or body.get("choices") or []
    if not choices:
        raise RuntimeError("no choices: " + json.dumps(body, ensure_ascii=False)[:400])
    content = choices[0].get("message", {}).get("content")
    if isinstance(content, list):
        chunks = []
        for part in content:
            if isinstance(part, dict) and part.get("text"):
                chunks.append(part["text"])
        content = "\n".join(chunks)
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("empty text answer: " + json.dumps(body, ensure_ascii=False)[:400])
    return content, (body.get("usage") or {})


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("images", nargs="+", help="image files to send")
    ap.add_argument("question", help="what to ask about them")
    ap.add_argument("--model", default="qwen3.8-max")
    ap.add_argument("--json", action="store_true", help="print the raw answer as JSON")
    args = ap.parse_args()

    if args.model in BLIND_MODELS:
        raise SystemExit("FATAL: %s is on the known-bad list (silently drops images "
                         "then fabricates 'I cannot see an image'). Use one of %s."
                         % (args.model, ", ".join(VISION_MODELS)))

    missing = [p for p in args.images if not os.path.exists(p)]
    if missing:
        raise SystemExit("FATAL: not found: %s" % ", ".join(missing))

    env = load_env()
    wait = BACKOFF_BASE
    for attempt in range(1, RETRY_MAX + 1):
        try:
            answer, usage = ask(env, args.model, args.question, args.images)
            break
        except urllib.error.HTTPError as exc:
            text = exc.read().decode("utf-8", "replace") if exc.fp else ""
            if any(m in text.lower() for m in QUOTA_MARKERS) and attempt < RETRY_MAX:
                print("[quota] attempt %d/%d, backoff %.0fs" % (attempt, RETRY_MAX, wait),
                      file=sys.stderr)
                time.sleep(wait)
                wait = min(wait * 2, BACKOFF_CAP)
                continue
            raise SystemExit("HTTP %d: %s" % (exc.code, " ".join(text.split())[:300]))
        except (urllib.error.URLError, RuntimeError) as exc:
            if attempt < RETRY_MAX:
                print("[transient] attempt %d/%d, backoff %.0fs: %s"
                      % (attempt, RETRY_MAX, wait, exc), file=sys.stderr)
                time.sleep(wait)
                wait = min(wait * 2, BACKOFF_CAP)
                continue
            raise SystemExit("FAILED after %d attempts: %s" % (RETRY_MAX, exc))
    else:
        raise SystemExit("FAILED: retry budget exhausted")

    if args.json:
        print(json.dumps({"model": args.model, "images": args.images,
                          "question": args.question, "answer": answer,
                          "usage": usage}, ensure_ascii=False, indent=2))
    else:
        print(answer)


if __name__ == "__main__":
    main()
