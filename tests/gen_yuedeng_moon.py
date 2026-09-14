"""Generate the 月下灯会 moon asset listed in docs/research/yuedeng-prompts.md.

The user rejected the CSS-drawn moon twice -- first "太像素化", then
"还是不好看，建议文生图月亮". CSS drawing is exhausted, so the moon becomes a
generated bitmap. This script never touches style.css / index.html / any game
module; another agent wires the asset in afterwards.

--------------------------------------------------------------------------
Gateway contract (docs/research/maas-image-api.md)
--------------------------------------------------------------------------
The ONLY working path is POST {MAAS_BASE_URL}/chat/completions with `content`
as a LIST of typed parts. /images/generations returns 400 "url error" on this
gateway and is never retried against -- this script has no code path to it.

`parameters.size` uses an ASTERISK ("1024*1024"); an 'x' silently falls back to
a square. Total pixels must sit in [589824, 16777216] or the gateway returns
HTTP 400 InvalidParameter, so a 512x512 asset CANNOT be requested directly --
it is generated at 1024*1024 and downscaled locally. Downscaling is a pipeline
step, not a fallback.

The image URL is at output.choices[0].message.content[i].image, an OSS URL that
expires in ~24h, so it is downloaded in the same breath it is returned.

The gateway has been returning quota errors (tpm_limit_exceeded,
"Allocated quota exceeded"). Those are retried with exponential backoff. An
asset that still fails after the retry budget is reported loudly, never skipped
silently.

--------------------------------------------------------------------------
SMOOTH pipeline -- the deliberate opposite of tests/gen_yueyan_pixels.py
--------------------------------------------------------------------------
The pixel pipeline (BOX reduce -> NEAREST snap -> palette quantize -> hard
alpha) is EXPLICITLY NOT USED. The user rejected the pixelated look. This file
contains no BOX, no NEAREST, no quantization and no alpha thresholding anywhere.

    raw 1024*1024 on a pure magenta #FF00FF ground
      -> chroma-key: distance-to-key mask (global tolerance)
      -> flood-fill region grow INWARD from the image border (border-connected
         component of that mask, grown by 4-neighbour dilation to a fixpoint)
      -> despill: strip the magenta cast off pixels still near the key colour
      -> halo cleanup: drop opaque border pixels that are basically bg colour
      -> 1-ring alpha erosion: kills the surviving background fringe
      -> crop to the opaque bounding box, squared, padded   (tight disc crop)
      -> Pillow **LANCZOS** downsample to 512x512           (smooth, not BOX)
      -> **lossless** WEBP

Why lossless WEBP: the moon is smooth gradients. Lossy WEBP ringing and
banding would re-introduce exactly the artefacts that make a gradient moon look
cheap. Lossless preserves every pixel exactly.

Why the tight bbox crop: the prompt asks for a >=12.5% composition margin, so
the disc would otherwise occupy only ~80% of the canvas and a 512px asset would
carry a ~410px disc -- below the 456px retina floor for the 228px display size.
Cropping to the disc makes the asset's full width BE the disc diameter, so the
wiring agent sets <img> width/height to the desired diameter with no conversion.

Why void RGB is refilled before resizing: LANCZOS over RGBA with (0,0,0,0)
voids drags the silhouette toward black and produces a dark fringe. Refilling
voids with the mean opaque colour keeps the edge cream-on-cream.

--------------------------------------------------------------------------
Determinism
--------------------------------------------------------------------------
Zero randomness in this file: no seeds, no shuffling, no random branches, and
every tie-break is over sorted sequences. The image model itself is NOT
deterministic and cannot be made so; the mitigation is that the raw PNG is
cached under docs/research/yuedeng-drafts/raw/ and reused, so a re-run never
calls the gateway and the shipped asset is byte-stable. Only --force re-rolls.

Usage:
    python tests/gen_yuedeng_moon.py                    # all 3, resumable
    python tests/gen_yuedeng_moon.py --only M-01        # subset
    python tests/gen_yuedeng_moon.py --only M-02 --force
    python tests/gen_yuedeng_moon.py --dry-run          # plan only, no network
    python tests/gen_yuedeng_moon.py --report           # objective metrics only
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHIP_DIR = os.path.join(ROOT, "tools", "yuedeng", "assets", "img")
DRAFT_DIR = os.path.join(ROOT, "docs", "research", "yuedeng-drafts")
RAW_DIR = os.path.join(DRAFT_DIR, "raw")

# --------------------------------------------------------------------------
# Gateway contract
# --------------------------------------------------------------------------
CHAT_PATH = "/chat/completions"      # the ONLY path; /images/generations 400s
GEN_SIZE = "1024*1024"               # asterisk, NOT 'x'
GEN_W, GEN_H = 1024, 1024
MIN_TOTAL_PIXELS = 589_824           # = 768**2, boundary inclusive
MAX_TOTAL_PIXELS = 16_777_216        # = 4096**2

# Quota retry budget. tpm_limit_exceeded needs real minutes, not seconds.
QUOTA_MARKERS = ("tpm_limit_exceeded", "allocated quota exceeded",
                 "quota exceeded", "throttling", "rate limit", "too many requests")
RETRY_MAX = 6
BACKOFF_BASE = 25.0
BACKOFF_FACTOR = 2.0
BACKOFF_CAP = 300.0

# --------------------------------------------------------------------------
# Shipping geometry
# --------------------------------------------------------------------------
DISPLAY_PX = 228          # .moon in view-create (style.css:455)
RETINA_FLOOR = DISPLAY_PX * 2          # 456 px -- the crisp-on-retina floor
SHIP_SIZE = (512, 512)                 # 2.245x the display size, > 456
CROP_PAD_PX = 8                        # 1024-space pad around the disc bbox
WEBP_LOSSLESS = True                   # smooth gradients -> no lossy ringing

# --------------------------------------------------------------------------
# Keying tolerances (Euclidean distances in RGB).
# --------------------------------------------------------------------------
KEY_RGB = (255, 0, 255)    # pure magenta ground, asked for in the style suffix
BG_GLOBAL_TOL = 130.0      # a pixel this close to the key counts as background
HALO_TOL = 96.0            # fringe pixels still too close to the key to keep
ALPHA_CUT = 128            # >= this is opaque

# --------------------------------------------------------------------------
# Palette: exactly three tokens belong to the asset itself, plus the CSS-only
# halo token which is measured purely to prove no glow was baked in.
# --------------------------------------------------------------------------
PALETTE = [
    ("moon",     0xF2, 0xE4, 0xC4),   # --moon      disc base
    ("moon-dk",  0xC8, 0xB7, 0x95),   # --moon-dk   maria / limb transition
    ("moon-rim", 0x3A, 0x2E, 0x26),   # --moon-rim  limb darkening
    ("halo",     0xE8, 0xB8, 0x4B),   # --halo      CSS-only, must be ~0% here
]
HALO_MAX_PCT = 3.0         # a baked glow would push this up
SMOOTH_MIN_COLORS = 1500   # quantized pixel art carries <= 24; smooth carries thousands

# --------------------------------------------------------------------------
# Byte-identical style suffix. 3/3 prompts must end with exactly this line.
# --------------------------------------------------------------------------
# 流派钉定值。preflight 用它断言「风格必须钉定到某个具名流派」。
# 做成具名常量而非字面量，是为了让驱动脚本能合法地换流派（例如插画月），
# 同时这条守卫依然生效 —— 换流派是改设计决策，必须显式声明并留下痕迹，
# 而不是绕过检查。
GENRE_PIN = "写实天文月面摄影质感"

STYLE_SUFFIX = (
    "写实天文月面摄影质感，天文望远镜实拍风格，月面肌理柔和细腻明暗过渡自然，"
    "整体暖米白调，色板严格限定为月白#F2E4C4、月面暗部#C8B795、月缘墨褐#3A2E26，"
    "不得引入板外色，不偏冷蓝不偏银白不发青，画面绝无光晕光斑辉光星点云层，"
    "背景为纯品红#FF00FF纯色平涂，月轮边缘干净利落便于抠图，不用文字，不用水印，高清。"
)

NEG_MOON = (
    "文字，水印，签名，logo，text，watermark，signature，冷色调，蓝色调，银白色，"
    "青色，blue tone，光晕，辉光，光斑，镜头光晕，星空，星星，云层，云朵，玉兔，"
    "嫦娥，月宫，广寒宫，桂树，建筑剪影，人物剪影，动物剪影，卡通，插画，像素画，"
    "渐变高光，塑料厚涂，粗黑卡通描边，低分辨率，噪点，jpeg压缩伪影，多余物件，"
    "边框，月亮以外的任何物件"
)

# --------------------------------------------------------------------------
# Manifest: 3 rows. M-01 is the shipping asset; M-02 / M-03 are alternates so
# the user can pick one -- no agent in this harness can see images.
# --------------------------------------------------------------------------
ASSETS = [
    {
        "id": "M-01", "file": "moon.webp", "role": "primary",
        "body": (
            "一轮完整满月悬于画面正中，月轮为暖米白#F2E4C4 圆盘，月面布满柔和的环形山"
            "与暗色月海肌理，明暗起伏细腻自然，左上方受光略亮，月缘向墨褐#3A2E26 "
            "柔和暗化一圈，夜空辉光桂金#E8B84B 由画面外叠加本图绝不含任何辉光，"
            "不含任何建筑人物动物剪影与桂树月宫，背景为纯品红#FF00FF纯色平涂，"
            "月轮居中四周留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "M-02", "file": "moon-b.webp", "role": "alternate",
        "body": (
            "一轮完整满月的正面特写，月轮为暖米白#F2E4C4 圆盘，月面上暗色月海#C8B795 "
            "与浅色高地对比清晰可辨，环形山边缘柔和不锐利，整体仍是低对比的柔和质感，"
            "月缘向墨褐#3A2E26 柔和暗化，夜空辉光桂金#E8B84B 由画面外叠加本图绝不含"
            "任何辉光，不含任何建筑人物动物剪影与桂树月宫，背景为纯品红#FF00FF纯色平涂，"
            "月轮居中四周留出至少八分之一空白余量。"
        ),
    },
    {
        "id": "M-03", "file": "moon-c.webp", "role": "alternate",
        "body": (
            "一轮柔和发亮的满月，月轮为暖米白#F2E4C4 圆盘，月面肌理极淡极柔和如薄雾，"
            "只有隐约的暗色斑块#C8B795 与轻微明暗起伏，月面中心略亮向四周渐柔，"
            "月缘向墨褐#3A2E26 柔和过渡，夜空辉光桂金#E8B84B 由画面外叠加本图绝不含"
            "任何辉光，不含任何建筑人物动物剪影与桂树月宫，背景为纯品红#FF00FF纯色平涂，"
            "月轮居中四周留出至少八分之一空白余量。"
        ),
    },
]

BODY_MIN_CHARS, BODY_MAX_CHARS = 50, 200


def full_prompt(asset):
    """Body + shared suffix. The suffix MUST be the last line (preflight relies on it)."""
    return asset["body"] + "\n" + STYLE_SUFFIX


# --------------------------------------------------------------------------
# Pre-flight: fail before spending a single request
# --------------------------------------------------------------------------
def preflight(assets):
    """Assert manifest invariants. Returns a list of fatal problem strings."""
    problems = []

    if len(assets) != 3:
        problems.append("manifest has %d rows, expected exactly 3 (1 primary + 2 alternates)"
                        % len(assets))

    ids = [a["id"] for a in assets]
    if len(set(ids)) != len(ids):
        problems.append("duplicate asset ids")
    files = [a["file"] for a in assets]
    if len(set(files)) != len(files):
        problems.append("duplicate file names")
    for f in files:
        if not f.endswith(".webp"):
            problems.append("%s is not .webp (PNG must not ship)" % f)
    if [a["role"] for a in assets].count("primary") != 1:
        problems.append("exactly one asset must be the primary shipping asset")

    # --- the byte-identity assertion, same shape as gen_yueyan_assets.py:350-361
    suffixes = {full_prompt(a).splitlines()[-1] for a in assets}
    if len(suffixes) != 1:
        problems.append("style suffix differs across assets (%d distinct)" % len(suffixes))
    elif next(iter(suffixes)) != STYLE_SUFFIX:
        problems.append("style suffix is not byte-identical to STYLE_SUFFIX")
    for a in assets:
        if not full_prompt(a).endswith(STYLE_SUFFIX):
            problems.append("%s prompt does not end with the shared suffix" % a["id"])

    # The genre must be pinned to a specific named kind, never a bare 国风.
    if GENRE_PIN not in STYLE_SUFFIX:
        problems.append("style suffix does not pin the declared genre %s" % GENRE_PIN)
    if "国风" in STYLE_SUFFIX or "Chinese style" in STYLE_SUFFIX:
        problems.append("style suffix contains a bare 国风 / Chinese style")

    total = GEN_W * GEN_H
    if not MIN_TOTAL_PIXELS <= total <= MAX_TOTAL_PIXELS:
        problems.append("generation size %d*%d = %d px is outside [%d, %d]"
                        % (GEN_W, GEN_H, total, MIN_TOTAL_PIXELS, MAX_TOTAL_PIXELS))
    if "*" not in GEN_SIZE or "x" in GEN_SIZE.replace("box", ""):
        problems.append("GEN_SIZE must use an asterisk separator, never 'x'")

    w, h = SHIP_SIZE
    if min(w, h) < RETINA_FLOOR:
        problems.append("shipping short edge %d < the %d px retina floor "
                        "(2x the %d px display size)" % (min(w, h), RETINA_FLOOR, DISPLAY_PX))
    if max(w, h) >= GEN_W:
        problems.append("shipping long edge %d must be < %d (downscale required)"
                        % (max(w, h), GEN_W))

    for a in assets:
        n = len(a["body"])
        if not BODY_MIN_CHARS <= n <= BODY_MAX_CHARS:
            problems.append("%s body is %d chars, must be %d-%d"
                            % (a["id"], n, BODY_MIN_CHARS, BODY_MAX_CHARS))

        # The chroma-key ground and the composition margin the flood fill needs.
        if "#FF00FF" not in a["body"]:
            problems.append("%s body lacks the #FF00FF chroma-key ground clause" % a["id"])
        if "空白余量" not in a["body"]:
            problems.append("%s body lacks a composition-margin clause, so the disc "
                            "may touch the border and the flood fill cannot reach it" % a["id"])
        if "八分之一" not in a["body"]:
            problems.append("%s body lacks the >=12.5%% margin clause" % a["id"])

        # The three asset tokens must be injected; the halo token must be
        # declared AND excluded, never authorised.
        for hexv in ("#F2E4C4", "#3A2E26"):
            if hexv not in a["body"] and hexv not in STYLE_SUFFIX:
                problems.append("%s declares neither in body nor suffix: %s" % (a["id"], hexv))
        if "#E8B84B" not in a["body"]:
            problems.append("%s body does not declare the halo token #E8B84B" % a["id"])
        if "绝不含任何辉光" not in a["body"]:
            problems.append("%s declares #E8B84B but never excludes it -- that would "
                            "authorise baking the glow, which must stay in CSS" % a["id"])

    # The halo hex must NOT be in the shared suffix: the glow is a per-phase CSS
    # variable (0.58 -> 0.14), so authorising it here would bake an unvarying glow.
    if "#E8B84B" in STYLE_SUFFIX:
        problems.append("halo hex is in the shared suffix, which would authorise "
                        "baking a glow that must vary per moon phase in CSS")

    banned = ["玉兔", "嫦娥", "月宫", "广寒宫", "桂树", "像素画", "文字", "水印"]
    missing = [b for b in banned if b not in NEG_MOON]
    if missing:
        problems.append("NEG_MOON is missing banned terms %s" % missing)

    return problems


# --------------------------------------------------------------------------
# .env handling -- robust, and never echoes the key
# --------------------------------------------------------------------------
def load_env():
    path = os.path.join(ROOT, ".env")
    env = {}
    if not os.path.exists(path):
        raise SystemExit("FATAL: repo-root .env not found at %s" % path)

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
        # Name the missing keys only -- never the value.
        raise SystemExit("FATAL: .env is missing or empty for %s" % ", ".join(missing))
    env.setdefault("MAAS_IMAGE_MODEL", "wan2.7-image-pro")
    return env


# --------------------------------------------------------------------------
# Gateway calls, with quota backoff
# --------------------------------------------------------------------------
def _post_once(env, prompt, negative):
    """One POST /chat/completions. Raises on any failure."""
    url = env["MAAS_BASE_URL"].rstrip("/") + CHAT_PATH
    payload = {
        "model": env["MAAS_IMAGE_MODEL"],
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        "parameters": {"size": GEN_SIZE},
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

    choices = (body.get("output") or {}).get("choices") or body.get("choices") or []
    if not choices:
        raise RuntimeError("no choices: " + json.dumps(body, ensure_ascii=False)[:300])
    parts = choices[0].get("message", {}).get("content") or []
    if isinstance(parts, str):
        raise RuntimeError("content came back as a string, expected a list of parts")
    for part in parts:
        if isinstance(part, dict) and part.get("type") == "image" and part.get("image"):
            return part["image"], (body.get("usage") or {}).get("size")
    raise RuntimeError("no image in response: " + json.dumps(parts, ensure_ascii=False)[:300])


def _classify(exc):
    """Return ('quota'|'fatal'|'transient', body_text).

    A plain HTTP 400 without a quota marker is a parameter problem -- retrying
    it just burns more quota, so it is fatal.
    """
    text = ""
    if isinstance(exc, urllib.error.HTTPError):
        try:
            text = exc.read().decode("utf-8", "replace")
        except OSError:
            text = ""
        if any(m in text.lower() for m in QUOTA_MARKERS):
            return "quota", text
        if exc.code == 400:
            return "fatal", text
        if exc.code in (429, 500, 502, 503, 504):
            return "transient", text
        return "fatal", text
    return "transient", str(exc)


def request_image(env, prompt, negative):
    """POST /chat/completions with exponential backoff on quota errors.

    Returns (image_url, api_size) or None. Never touches /images/generations.
    """
    wait = BACKOFF_BASE
    for attempt in range(1, RETRY_MAX + 1):
        try:
            return _post_once(env, prompt, negative)
        except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError) as exc:
            kind, text = _classify(exc)
            snippet = " ".join(text.split())[:180]
            if kind == "fatal":
                print("  GENERATE FAILED (fatal, not retried): %s" % snippet)
                print("  (do NOT retry against /images/generations -- it 400s here)")
                return None
            if attempt == RETRY_MAX:
                print("  GENERATE FAILED after %d attempts (%s): %s"
                      % (attempt, kind, snippet))
                return None
            print("  attempt %d/%d %s -- backing off %.0fs: %s"
                  % (attempt, RETRY_MAX, kind, wait, snippet))
            time.sleep(wait)
            wait = min(wait * BACKOFF_FACTOR, BACKOFF_CAP)
    return None


def download(image_url, dest):
    """Download immediately -- the OSS URL expires in ~24h."""
    req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()
    with open(dest, "wb") as fh:
        fh.write(data)
    return len(data)


# --------------------------------------------------------------------------
# Background removal -- chroma-key + flood-fill from the border.
# Everything here is numpy and deterministic. No randomness anywhere.
# --------------------------------------------------------------------------
def border_connected(cand):
    """Grow `cand` inward from the image border to a fixpoint (4-neighbour).

    This is the flood-fill region grow: only background that actually touches
    the frame becomes transparent, so an isolated magenta-ish patch inside the
    disc survives. Vectorised dilation, so it costs seconds not minutes.
    """
    conn = np.zeros_like(cand)
    conn[0, :], conn[-1, :], conn[:, 0], conn[:, -1] = (
        cand[0, :], cand[-1, :], cand[:, 0], cand[:, -1])
    while True:
        grown = conn.copy()
        grown[1:, :] |= conn[:-1, :]
        grown[:-1, :] |= conn[1:, :]
        grown[:, 1:] |= conn[:, :-1]
        grown[:, :-1] |= conn[:, 1:]
        grown &= cand
        if np.array_equal(grown, conn):
            return conn
        conn = grown


def flood_background(rgb):
    """Chroma-key + border flood fill. Returns (alpha, key_colour, distance)."""
    key = np.median(np.concatenate([
        rgb[0, :, :].reshape(-1, 3), rgb[-1, :, :].reshape(-1, 3),
        rgb[:, 0, :].reshape(-1, 3), rgb[:, -1, :].reshape(-1, 3),
    ]), axis=0)

    dist = np.sqrt(np.sum((rgb - key) ** 2, axis=2))
    cand = dist <= BG_GLOBAL_TOL
    bg = border_connected(cand)

    alpha = np.where(bg, 0, 255).astype(np.uint8)
    return alpha, key, dist


def despill(rgb, dist):
    """Strip the magenta cast off pixels that are still near the key colour.

    Weighted by proximity to the key rather than by alpha, because at this
    point alpha is still binary: the fringe lives in the pixels just OUTSIDE
    the flood-filled region, which carry alpha 255 but a magenta tint.
    """
    weight = np.clip((HALO_TOL - dist) / HALO_TOL, 0.0, 1.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = np.maximum(0.0, np.minimum(r, b) - g)
    rgb[..., 0] = np.clip(r - spill * weight, 0, 255)
    rgb[..., 2] = np.clip(b - spill * weight, 0, 255)
    return rgb


def halo_cleanup(alpha, dist):
    """Drop opaque pixels touching void that are still basically key colour."""
    opaque = alpha >= ALPHA_CUT
    touches_void = (~opaque).copy()
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        shifted = np.roll(np.roll(~opaque, dy, axis=0), dx, axis=1)
        touches_void |= shifted
    doomed = opaque & touches_void & (dist < HALO_TOL)
    alpha[doomed] = 0
    return alpha


def erode_alpha(alpha):
    """One-ring alpha erosion -- kills the surviving background fringe.

    At 1024 this removes a single pixel of fringe, which is ~0.5 px after the
    2:1 LANCZOS downsample, so the disc never visibly shrinks.
    """
    opaque = alpha >= ALPHA_CUT
    touches_void = (~opaque).copy()
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        touches_void |= np.roll(np.roll(~opaque, dy, axis=0), dx, axis=1)
    alpha[opaque & touches_void] = 0
    return alpha


def disc_crop_box(alpha):
    """Square crop box around the opaque bounding box, padded, clamped to canvas.

    Makes the disc fill the whole shipped asset, so <img> width == disc
    diameter and the wiring agent needs no scale conversion.
    """
    ys, xs = np.where(alpha >= ALPHA_CUT)
    if ys.size == 0:
        raise RuntimeError("keying removed every pixel -- the ground was not magenta")
    h, w = alpha.shape
    cx, cy = (xs.min() + xs.max()) / 2.0, (ys.min() + ys.max()) / 2.0
    half = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2.0 + CROP_PAD_PX
    side = int(round(half * 2))

    left = int(round(cx - half))
    top = int(round(cy - half))
    left = max(0, min(left, w - side))
    top = max(0, min(top, h - side))
    if side > min(w, h):                      # disc bigger than the canvas
        side = min(w, h)
        left = top = (min(w, h) - side) // 2
    return left, top, left + side, top + side


def key_and_ship(raw_path, asset):
    """raw 1024*1024 -> transparent smooth disc at SHIP_SIZE, lossless WEBP."""
    rgb = np.asarray(Image.open(raw_path).convert("RGB"), dtype=np.float64)

    alpha, key, dist = flood_background(rgb)
    rgb = despill(rgb, dist)
    alpha = halo_cleanup(alpha, dist)
    alpha = erode_alpha(alpha)

    left, top, right, bottom = disc_crop_box(alpha)
    rgb = rgb[top:bottom, left:right]
    alpha = alpha[top:bottom, left:right]

    # Refill voids with the mean opaque colour so LANCZOS does not drag the
    # silhouette toward black and leave a dark fringe.
    opaque = alpha >= ALPHA_CUT
    mean_rgb = np.round(rgb[opaque].mean(axis=0)) if opaque.any() else np.array(KEY_RGB)
    rgb[~opaque] = mean_rgb

    rgba = np.dstack([rgb.astype(np.uint8), alpha])
    img = Image.fromarray(rgba, "RGBA")
    img = img.resize(SHIP_SIZE, Image.LANCZOS)      # smooth, never BOX/NEAREST

    dest = os.path.join(SHIP_DIR, asset["file"])
    img.save(dest, "WEBP", lossless=WEBP_LOSSLESS, quality=100, method=6)
    return dest, tuple(np.round(key).astype(int)), (left, top, right, bottom)


# --------------------------------------------------------------------------
# Objective measurement. No visual judgement lives here -- no agent in this
# harness can see an image, so every check below is a number.
# --------------------------------------------------------------------------
def palette_shares(rgb, mask):
    """Nearest-of-4 assignment over opaque pixels. Shares sum to exactly 100.00."""
    flat = rgb[mask]
    if flat.size == 0:
        return None, 0
    tokens = np.array([[t[1], t[2], t[3]] for t in PALETTE], dtype=np.float64)
    d = np.sum((flat[:, None, :] - tokens[None, :, :]) ** 2, axis=2)
    counts = np.bincount(d.argmin(axis=1), minlength=len(PALETTE))
    total = int(counts.sum())
    shares = [round(100.0 * c / total, 2) for c in counts]
    top = int(np.argmax(shares))                    # give the residual to the biggest
    shares[top] = round(shares[top] + round(100.0 - sum(shares), 2), 2)
    return {PALETTE[i][0]: shares[i] for i in range(len(PALETTE))}, total


def inspect_ship(asset):
    """Return an objective report row for one shipped asset, or None if absent."""
    path = os.path.join(SHIP_DIR, asset["file"])
    if not os.path.exists(path):
        return None

    img = Image.open(path)
    arr = np.asarray(img.convert("RGBA"))
    rgb, alpha = arr[..., :3].astype(np.float64), arr[..., 3]
    h, w = alpha.shape
    nbytes = os.path.getsize(path)

    corners = [int(alpha[0, 0]), int(alpha[0, w - 1]),
               int(alpha[h - 1, 0]), int(alpha[h - 1, w - 1])]
    centre = int(alpha[h // 2, w // 2])
    opaque = alpha >= ALPHA_CUT
    void = alpha < ALPHA_CUT
    partial = int(np.sum((alpha > 0) & (alpha < 255)))

    ys, xs = np.where(opaque)
    if ys.size:
        bbox_touches_edge = bool(xs.min() == 0 or xs.max() == w - 1
                                 or ys.min() == 0 or ys.max() == h - 1)
        mean_rgb = tuple(round(float(v), 1) for v in rgb[opaque].mean(axis=0))
        colours = len({tuple(int(c) for c in px) for px in rgb[opaque].astype(int)})
        # Mean |delta| between horizontally adjacent opaque pixels. A smooth
        # gradient gives a small number; a quantized pixel grid gives a large one.
        lum = arr[..., :1].astype(np.float64)
        edge = opaque[:, :-1] & opaque[:, 1:]
        grad = float(np.abs(np.diff(lum, axis=1))[edge].mean()) if edge.any() else 0.0
    else:
        bbox_touches_edge, mean_rgb, colours, grad = True, None, 0, 0.0

    shares, counted = palette_shares(rgb, opaque)
    halo = shares["halo"] if shares else 0.0

    smooth_ok = colours >= SMOOTH_MIN_COLORS
    alpha_ok = max(corners) == 0 and centre == 255
    glow_ok = not bbox_touches_edge
    warm_ok = mean_rgb is not None and mean_rgb[0] > mean_rgb[2]

    return {
        "id": asset["id"], "file": asset["file"], "role": asset["role"],
        "path": path, "size": img.size, "mode": img.mode, "format": img.format,
        "bytes": nbytes, "kib": nbytes / 1024.0,
        "dims_ok": img.size == SHIP_SIZE,
        "corners": corners, "centre": centre,
        "opaque": int(opaque.sum()), "void": int(void.sum()), "partial": partial,
        "alpha_ok": alpha_ok, "glow_ok": glow_ok, "warm_ok": warm_ok,
        "colours": colours, "smooth_ok": smooth_ok, "grad": grad,
        "mean_rgb": mean_rgb, "shares": shares, "counted": counted,
        "halo": halo, "halo_ok": halo <= HALO_MAX_PCT,
    }


def already_shipped(asset):
    """True when the shipped file satisfies every hard constraint.

    Dims, transparent corners, opaque centre, smooth (not quantized), no baked
    glow, warm not cool, halo share inside the cap. Nothing advisory is in
    here, so a finished asset is never churned on a later run.
    """
    row = inspect_ship(asset)
    if row is None:
        return False
    return (row["dims_ok"] and row["alpha_ok"] and row["smooth_ok"]
            and row["glow_ok"] and row["warm_ok"] and row["halo_ok"])


def print_report(rows):
    print("\n=== moon asset report (%s) ===" % SHIP_DIR)
    header = ("%-6s %-13s %-10s %-9s %-6s %9s %8s %8s %7s %6s %-5s %s"
              % ("id", "file", "role", "dims", "KiB", "corners", "centre",
                 "opaque", "colors", "halo%", "grad", "palette shares (nearest-of-4)"))
    print(header)
    print("-" * len(header))

    for r in rows:
        if r is None:
            continue
        print("%-6s %-13s %-10s %-9s %9.2f %8s %8d %8d %7d %5.2f%% %5.2f %s"
              % (r["id"], r["file"], r["role"], "%dx%d" % r["size"], r["kib"],
                 "/".join(str(c) for c in r["corners"]), r["centre"], r["opaque"],
                 r["colours"], r["halo"], r["grad"],
                 " ".join("%s %.2f%%" % (k, v) for k, v in r["shares"].items())))

    present = [r for r in rows if r is not None]
    missing = [a["id"] for a, r in zip(ASSETS, rows) if r is None]

    print("-" * len(header))
    print("present        = %d / %d" % (len(present), len(ASSETS)))
    if missing:
        print("MISSING        = %s   <-- these were never produced, NOT skipped silently"
              % ", ".join(missing))
    for r in present:
        flags = []
        if not r["dims_ok"]:
            flags.append("dims != %dx%d" % SHIP_SIZE)
        if not r["alpha_ok"]:
            flags.append("ALPHA corners=%s centre=%d" % (r["corners"], r["centre"]))
        if not r["smooth_ok"]:
            flags.append("PIXELATED? only %d colours (< %d)"
                         % (r["colours"], SMOOTH_MIN_COLORS))
        if not r["glow_ok"]:
            flags.append("GLOW BAKED? opaque bbox touches the canvas edge")
        if not r["warm_ok"]:
            flags.append("COOL DRIFT? mean RGB %s has R <= B" % (r["mean_rgb"],))
        if not r["halo_ok"]:
            flags.append("halo share %.2f%% > %.1f%%" % (r["halo"], HALO_MAX_PCT))
        print("  %-6s %s" % (r["id"], " | ".join(flags) if flags else "all objective checks ok"))
    return present, missing


# --------------------------------------------------------------------------
# Generation loop (resumable / idempotent)
# --------------------------------------------------------------------------
def process(env, asset, force):
    stem = os.path.splitext(asset["file"])[0]
    raw_path = os.path.join(RAW_DIR, "%s_%s.png" % (asset["id"], stem))

    print("\n--- %s  %s  (%s) ---" % (asset["id"], asset["file"], asset["role"]))
    print("  pipeline   = generate %s on #FF00FF -> chroma-key + border flood fill"
          " -> despill -> halo cleanup -> 1-ring erode -> disc bbox crop"
          " -> LANCZOS -> lossless WEBP" % GEN_SIZE)
    print("  ship dims  = %dx%d   (display %d px, retina floor %d px)"
          % (SHIP_SIZE[0], SHIP_SIZE[1], DISPLAY_PX, RETINA_FLOOR))
    print("  NO pixel pipeline: no BOX, no NEAREST, no quantization, no alpha threshold")

    if not force and already_shipped(asset):
        row = inspect_ship(asset)
        print("  SKIP       = already generated, keyed and downscaled "
              "(%.2f KiB, %dx%d, %d colours)" % (row["kib"], row["size"][0],
                                                 row["size"][1], row["colours"]))
        return row

    if not force and os.path.exists(raw_path):
        print("  reuse raw  = %s (no gateway call -- the raw cache is what makes"
              " re-runs byte-stable)" % os.path.basename(raw_path))
    else:
        prompt = full_prompt(asset)
        print("  prompt     = %d chars body + %d chars shared suffix"
              % (len(asset["body"]), len(STYLE_SUFFIX)))
        result = request_image(env, prompt, NEG_MOON)
        if result is None:
            print("  !! NOT PRODUCED: %s has no asset. Reported loudly, not skipped."
                  % asset["id"])
            return None
        image_url, api_size = result
        try:
            nbytes = download(image_url, raw_path)
        except (urllib.error.HTTPError, urllib.error.URLError) as exc:
            print("  DOWNLOAD FAILED: %s" % exc)
            print("  !! NOT PRODUCED: %s has no asset. The OSS URL expires in ~24h"
                  " and was never fetched." % asset["id"])
            return None
        print("  api size   = %s   raw = %s (%.0f KB, cached, not shipped)"
              % (api_size, os.path.basename(raw_path), nbytes / 1024))

    try:
        dest, key, box = key_and_ship(raw_path, asset)
    except (OSError, RuntimeError, ValueError) as exc:
        print("  KEY/DOWNSCALE FAILED: %s" % exc)
        print("  !! NOT PRODUCED: %s has no asset." % asset["id"])
        return None

    row = inspect_ship(asset)
    print("  key colour = %s (border-ring median; distance to every palette "
          "token > %.0f)" % (list(key), min(
              float(np.sqrt(sum((key[i] - t[i + 1]) ** 2 for i in range(3))))
              for t in PALETTE)))
    print("  disc crop  = %s (%d px square at 1024) -> LANCZOS %.2f:1 -> %dx%d shipped"
          % (box, box[2] - box[0], (box[2] - box[0]) / float(SHIP_SIZE[0]),
             row["size"][0], row["size"][1]))
    print("  shipped    = %s  %dx%d  %.2f KiB  %s %s"
          % (os.path.basename(dest), row["size"][0], row["size"][1], row["kib"],
             row["format"], "lossless" if WEBP_LOSSLESS else "lossy"))
    print("  alpha      = corners %s (must be 0)   centre %d (must be 255)   "
          "opaque %d / void %d / partial %d"
          % (row["corners"], row["centre"], row["opaque"], row["void"], row["partial"]))
    print("  smooth     = %d distinct opaque colours (quantized pixel art would be "
          "<= 24; floor %d)   mean adjacent-pixel delta %.2f"
          % (row["colours"], SMOOTH_MIN_COLORS, row["grad"]))
    print("  warm       = mean RGB %s  (R > B required)  -> %s"
          % (row["mean_rgb"], "warm ok" if row["warm_ok"] else "COOL DRIFT"))
    print("  glow       = opaque bbox touches canvas edge: %s  -> %s"
          % (not row["glow_ok"], "no baked glow" if row["glow_ok"] else "GLOW BAKED"))
    print("  palette    = %s" % " ".join("%s %.2f%%" % (k, v)
                                         for k, v in row["shares"].items()))
    return row


def parse_only(spec):
    wanted = [s.strip().upper() for s in spec.split(",") if s.strip()]
    unknown = [w for w in wanted if w not in {a["id"] for a in ASSETS}]
    if unknown:
        raise SystemExit("FATAL: unknown asset ids %s" % ", ".join(unknown))
    return wanted


def main():
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", help="comma-separated asset ids, e.g. M-01,M-02")
    parser.add_argument("--force", action="store_true",
                        help="re-call the gateway and re-key even if already shipped")
    parser.add_argument("--dry-run", action="store_true",
                        help="print the plan, make no network call")
    parser.add_argument("--report", action="store_true",
                        help="print objective metrics for shipped assets only")
    args = parser.parse_args()

    problems = preflight(ASSETS)
    if problems:
        print("FATAL: manifest pre-flight failed, no request will be sent")
        for p in problems:
            print("  - %s" % p)
        sys.exit(1)
    print("preflight OK: %d assets, style suffix byte-identical across all %d, "
          "genre pinned to %s" % (len(ASSETS), len(ASSETS), GENRE_PIN))

    rows = [inspect_ship(a) for a in ASSETS]
    if args.report:
        print_report(rows)
        return

    selected = ASSETS
    if args.only:
        wanted = parse_only(args.only)
        selected = [a for a in ASSETS if a["id"] in wanted]

    if args.dry_run:
        print("\n=== dry run: %d row(s), no network call ===" % len(selected))
        print("%-6s %-13s %-10s %-9s %-9s %-18s %6s %s"
              % ("id", "file", "role", "gen", "ship", "downscale", "body", "negative"))
        for a in selected:
            print("%-6s %-13s %-10s %-9s %-9s %-18s %6d %s"
                  % (a["id"], a["file"], a["role"], GEN_SIZE,
                     "%dx%d" % SHIP_SIZE,
                     "disc bbox crop + LANCZOS",
                     len(a["body"]), "NEG_MOON"))
        print("\ngeneration size %s = %d total px, inside [%d, %d]"
              % (GEN_SIZE, GEN_W * GEN_H, MIN_TOTAL_PIXELS, MAX_TOTAL_PIXELS))
        print("shipping short edge %d >= retina floor %d (2x the %d px display size)"
              % (min(SHIP_SIZE), RETINA_FLOOR, DISPLAY_PX))
        print("ONE asset family, NOT five per-phase assets -- see "
              "docs/research/yuedeng-prompts.md section 三")
        return

    env = load_env()
    os.makedirs(SHIP_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)

    produced, failed = [], []
    for asset in selected:
        row = process(env, asset, args.force)
        (produced if row is not None else failed).append(asset["id"])

    print("\nprocessed %d / %d selected" % (len(produced), len(selected)))
    if failed:
        print("!! FAILED (loudly, never silently skipped): %s" % ", ".join(failed))
        print("   Re-run `python tests/gen_yuedeng_moon.py --only %s` once the"
              " gateway quota recovers." % ",".join(failed))
    print_report([inspect_ship(a) for a in ASSETS])
    print("\nNO agent in this harness can see an image. Every number above is an")
    print("objective measurement; whether the moon is BEAUTIFUL can only be")
    print("judged by the user. Alternates M-02 / M-03 exist for that choice.")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
