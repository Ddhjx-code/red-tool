# -*- coding: utf-8 -*-
"""山海御空 游戏展示视频录制。Chrome CDP screencast 抓帧 -> ffmpeg 合成 mp4。"""
import argparse, base64, json, os, subprocess, sys, threading, time
import urllib.request
from websocket import create_connection

W, H, FPS = 720, 1280, 30


def cdp_target(port):
    data = json.load(urllib.request.urlopen("http://127.0.0.1:%d/json" % port))
    return [t for t in data if t.get("type") == "page"]


class CDP:
    def __init__(self, url):
        self.ws = create_connection(url, timeout=20, suppress_origin=True, max_size=None)
        self.mid = 0
        self.pending = {}
        self.cv = threading.Condition()
        self.frames_dir = "/tmp/shanhai_frames"
        os.makedirs(self.frames_dir, exist_ok=True)
        for f in os.listdir(self.frames_dir):
            os.remove(os.path.join(self.frames_dir, f))
        self.nframes = 0
        self.stop = False
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        while not self.stop:
            try:
                m = json.loads(self.ws.recv())
            except Exception:
                break
            if m.get("method") == "Page.screencastFrame":
                d = m["params"]["data"]
                self.nframes += 1
                with open(os.path.join(self.frames_dir, "%05d.jpg" % self.nframes), "wb") as fh:
                    fh.write(base64.b64decode(d))
                self.ws.send(json.dumps({"id": 900000 + self.nframes,
                                         "method": "Page.screencastFrameAck",
                                         "params": {"sessionId": m["params"]["sessionId"]}}))
            elif "id" in m and "result" in m:
                with self.cv:
                    self.pending[m["id"]] = m["result"]
                    self.cv.notify_all()

    def evaluate(self, expr, timeout=10):
        self.mid += 1
        mid = self.mid
        self.ws.send(json.dumps({"id": mid, "method": "Runtime.evaluate",
                                 "params": {"expression": expr, "returnByValue": True}}))
        deadline = time.time() + timeout
        with self.cv:
            while mid not in self.pending:
                if time.time() > deadline:
                    return None
                self.cv.wait(0.2)
            return self.pending.pop(mid).get("result", {}).get("value")

    def send(self, method, params=None):
        self.mid += 1
        self.ws.send(json.dumps({"id": self.mid, "method": method, "params": params or {}}))

    def close(self):
        self.stop = True
        try: self.ws.close()
        except Exception: pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=9223)
    ap.add_argument("--secs", type=int, default=38)
    ap.add_argument("--out", default="/tmp/shanhai.mp4")
    args = ap.parse_args()

    pages = cdp_target(args.port)
    if not pages:
        print("no chrome page target"); sys.exit(1)
    cdp = CDP(pages[0]["webSocketDebuggerUrl"])

    # showcase.js 自己调用 __game.start(0) 进入战斗，无需点 btn-start
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "showcase_shanhai.js"), encoding="utf-8") as fh:
        showcase = fh.read()
    cdp.evaluate(showcase)
    time.sleep(0.5)
    print("showcase injected; recording %ds..." % args.secs)

    cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 90,
                                      "maxWidth": W, "maxHeight": H, "everyNthFrame": 1})
    t0 = time.time()
    while time.time() - t0 < args.secs:
        time.sleep(1)
        st = cdp.evaluate("__showcase.state()")
        print("  t=%.0fs frames=%d state=%s" % (time.time() - t0, cdp.nframes, st))
    cdp.send("Page.stopScreencast")
    cdp.evaluate("__showcase.stop()")
    time.sleep(0.5)
    cdp.close()

    total = cdp.nframes
    print("captured %d frames" % total)
    if total < 10:
        print("too few frames, abort"); sys.exit(1)

    cmd = ["ffmpeg", "-y", "-framerate", str(FPS),
           "-i", os.path.join(cdp.frames_dir, "%05d.jpg"),
           "-vf", "scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d" % (W, H, W, H),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
           "-movflags", "+faststart", args.out]
    subprocess.run(cmd, check=True)
    print("OK -> %s" % args.out)


if __name__ == "__main__":
    main()
