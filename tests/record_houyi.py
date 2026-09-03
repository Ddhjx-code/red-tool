# -*- coding: utf-8 -*-
"""后羿射日 游戏展示视频录制。Chrome CDP screencast 抓帧 -> ffmpeg 合成 mp4。

游戏自带 ?demo=1 自驾（打完第 1 关走到结算页），无需注入 showcase。
按实测帧率编码，保证播放速度与真实时间一致。
"""
import argparse, base64, json, os, subprocess, sys, threading, time
import urllib.request
from websocket import create_connection

W, H = 780, 1688


def cdp_target(port):
    data = json.load(urllib.request.urlopen("http://127.0.0.1:%d/json" % port))
    return [t for t in data if t.get("type") == "page"]


class CDP:
    def __init__(self, url, frames_dir):
        self.ws = create_connection(url, timeout=20, suppress_origin=True, max_size=None)
        self.mid = 0
        self.pending = {}
        self.cv = threading.Condition()
        self.frames_dir = frames_dir
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

    def capture(self, timeout=10):
        """主动截一帧（screencast 在 headed Chrome 下被节流，改用轮询保证帧率）"""
        self.mid += 1
        mid = self.mid
        self.ws.send(json.dumps({"id": mid, "method": "Page.captureScreenshot",
                                 "params": {"format": "jpeg", "quality": 90}}))
        deadline = time.time() + timeout
        with self.cv:
            while mid not in self.pending:
                if time.time() > deadline:
                    return None
                self.cv.wait(0.05)
            res = self.pending.pop(mid)
        data = res.get("data")
        if not data:
            return None
        self.nframes += 1
        with open(os.path.join(self.frames_dir, "%05d.jpg" % self.nframes), "wb") as fh:
            fh.write(base64.b64decode(data))
        return self.nframes

    def close(self):
        self.stop = True
        try: self.ws.close()
        except Exception: pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=9227)
    ap.add_argument("--secs", type=int, default=40)
    ap.add_argument("--out", default="/tmp/houyi-demo.mp4")
    args = ap.parse_args()

    pages = cdp_target(args.port)
    if not pages:
        print("no chrome page target"); sys.exit(1)
    cdp = CDP(pages[0]["webSocketDebuggerUrl"], "/tmp/houyi_frames")

    t0 = time.time()
    while time.time() - t0 < args.secs:
        cdp.capture()
        if cdp.nframes % 40 == 0:
            st = cdp.evaluate("window.__game ? window.__game.snapshot() : null")
            v = (st or {}).get("view")
            print("  frames=%d view=%s" % (cdp.nframes, v))
            if v == "result":
                break
    elapsed = time.time() - t0
    cdp.close()

    total = cdp.nframes
    print("captured %d frames in %.1fs" % (total, elapsed))
    if total < 10:
        print("too few frames, abort"); sys.exit(1)

    fps = max(1.0, round(total / elapsed, 2))
    print("encoding at %.2f fps (real-time)" % fps)
    cmd = ["ffmpeg", "-y", "-framerate", str(fps),
           "-i", os.path.join(cdp.frames_dir, "%05d.jpg"),
           "-vf", "scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d" % (W, H, W, H),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
           "-movflags", "+faststart", args.out]
    subprocess.run(cmd, check=True)
    print("OK -> %s" % args.out)


if __name__ == "__main__":
    main()
