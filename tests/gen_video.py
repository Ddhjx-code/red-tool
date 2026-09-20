"""Generate a video via the MaaS HappyHorse video models, then download it.

Why this file exists / what bit us:
  * `/models` on this gateway is NOT the subscription model list. It omits
    `qwen-image-3.0-pro` and the whole `happyhorse-*` family. Never trust it to
    decide "do we have model X" -- read the console's 可用模型 list instead.
  * Video does NOT live on the OpenAI-compatible surface. Hitting
    `/compatible-mode/v1/video{,s}/generations` returns
      403 AccessDenied: current user api does not support asynchronous calls
    which reads like an account permission wall but is really just the WRONG
    PATH. The real endpoint is the DashScope-style async one:
      POST {HOST}/api/v1/services/aigc/video-generation/video-synthesis
      GET  {HOST}/api/v1/tasks/{task_id}
    and it REQUIRES the `X-DashScope-Async: enable` header. Without that header
    the same URL answers 403 "does not support synchronous calls" -- because
    video on this platform is async-only.
  where {HOST} = MAAS_BASE_URL with the trailing `/compatible-mode/v1` stripped.

Models (per the subscription list):
  happyhorse-1.1-t2v   text  -> video
  happyhorse-1.1-i2v   image -> video            (needs input.image)
  happyhorse-1.1-r2v   reference -> video        (needs input.image / ref)

Prompting note that matters for the motion-extraction pipeline:
  If the goal is to lift a MOTION CURVE off this video (mediapipe pose), ask for
  a HUMAN PERFORMER -- "a dancer performing lion-dance footwork" -- NOT "a lion".
  Fed an actual lion costume/sprite, the pose model either detects nothing or
  confidently hallucinates a skeleton whose "hip" sits on the lion's head with
  visibility=1.00. Confident garbage is the failure mode to avoid. A human
  performer yields a clean skeleton whose head/hip/shoulder curves map onto the
  lion rig.

Usage:
    python3 tests/gen_video.py --prompt "..." --out raw/lion-walk.mp4
    python3 tests/gen_video.py --prompt "..." --out x.mp4 --model happyhorse-1.1-i2v --image ref.png
    python3 tests/gen_video.py --poll <task_id> --out x.mp4      # resume a task
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEO_PATH = "/api/v1/services/aigc/video-generation/video-synthesis"
TASK_PATH = "/api/v1/tasks/%s"
POLL_EVERY = 8.0
POLL_TIMEOUT = 600.0
TERMINAL = ("SUCCEEDED", "FAILED", "CANCELED", "UNKNOWN")


def load_env(env_path=None):
    """Read .env / process env. Same contract as tests/gen_wuhuolong_dragon.py."""
    env = dict(os.environ)
    path = env_path or os.path.join(ROOT, ".env")
    if os.path.exists(path):
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    missing = [k for k in ("MAAS_BASE_URL", "MAAS_API_KEY") if not env.get(k)]
    if missing:
        raise SystemExit("missing in .env: %s" % ", ".join(missing))
    return env


def host_of(env):
    """The video API is NOT under the OpenAI-compatible prefix."""
    return env["MAAS_BASE_URL"].rstrip("/").replace("/compatible-mode/v1", "")


def _req(url, key, data=None, async_hdr=False, timeout=60):
    headers = {"Authorization": "Bearer " + key}
    if async_hdr:
        headers["X-DashScope-Async"] = "enable"
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                                 headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def submit(env, prompt, model="happyhorse-1.1-t2v", image=None, extra=None):
    """Kick off a video job. Returns task_id. Raises with the server message on error."""
    body = {"model": model, "input": {"prompt": prompt}}
    if image:
        body["input"]["image"] = image
    if extra:
        body.setdefault("parameters", {}).update(extra)
    url = host_of(env) + VIDEO_PATH
    try:
        r = _req(url, env["MAAS_API_KEY"], body, async_hdr=True)
    except urllib.error.HTTPError as exc:
        detail = exc.read(400).decode("utf-8", "replace")
        raise SystemExit("submit failed http=%s %s\n(endpoint=%s)" % (exc.code, detail, url))
    out = r.get("output") or {}
    tid = out.get("task_id")
    if not tid:
        raise SystemExit("no task_id in response: %s" % json.dumps(r, ensure_ascii=False)[:400])
    print("task_id=%s status=%s model=%s" % (tid, out.get("task_status"), model), flush=True)
    return tid


def poll(env, task_id, timeout=POLL_TIMEOUT):
    url = host_of(env) + (TASK_PATH % task_id)
    t0 = time.time()
    while time.time() - t0 < timeout:
        out = (_req(url, env["MAAS_API_KEY"]) .get("output") or {})
        st = out.get("task_status")
        print("  [%4ds] %s" % (int(time.time() - t0), st), flush=True)
        if st in TERMINAL:
            return out
        time.sleep(POLL_EVERY)
    return {"task_status": "TIMEOUT", "task_id": task_id}


def download(url, dest):
    os.makedirs(os.path.dirname(os.path.abspath(dest)), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()
    with open(dest, "wb") as fh:
        fh.write(data)
    return len(data)


def generate(env, prompt, out, model="happyhorse-1.1-t2v", image=None, extra=None):
    tid = submit(env, prompt, model=model, image=image, extra=extra)
    res = poll(env, tid)
    if res.get("task_status") != "SUCCEEDED":
        print("FAILED:", json.dumps(res, ensure_ascii=False)[:500])
        return None, tid
    url = res.get("video_url")
    if not url:
        print("SUCCEEDED but no video_url:", json.dumps(res, ensure_ascii=False)[:400])
        return None, tid
    n = download(url, out)
    print("OK -> %s (%.2f MB)  task=%s" % (out, n / 1048576.0, tid), flush=True)
    return out, tid


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--prompt", help="text prompt (t2v), or ignored for i2v/r2v")
    ap.add_argument("--out", required=True, help="destination .mp4")
    ap.add_argument("--model", default="happyhorse-1.1-t2v")
    ap.add_argument("--image", help="reference image URL/path for i2v / r2v")
    ap.add_argument("--poll", help="resume an existing task_id instead of submitting")
    ap.add_argument("--duration", type=int, help="seconds (model-dependent)")
    args = ap.parse_args()

    env = load_env()
    if args.poll:
        res = poll(env, args.poll)
        if res.get("task_status") == "SUCCEEDED" and res.get("video_url"):
            print("OK -> %s (%.2f MB)" % (args.out, download(res["video_url"], args.out) / 1048576.0))
        else:
            print("not succeeded:", json.dumps(res, ensure_ascii=False)[:500])
        return
    if not args.prompt:
        raise SystemExit("--prompt is required unless --poll is used")
    extra = {"duration": args.duration} if args.duration else None
    generate(env, args.prompt, args.out, model=args.model, image=args.image, extra=extra)


if __name__ == "__main__":
    main()
