"""Chroma-key a magenta-background asset into real alpha, then shrink it to ship.

The image model returns an RGBA container that is fully opaque, so assets cannot
be composited as generated. This derives alpha from a magenta background, despills
the edge tint, and converts to webp at a shippable size.

Usage: python tests/key_yuegong_asset.py <input.png> [target_size]
"""

import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The 工笔 palette. A key color is only safe if it is far from every one of these,
# otherwise keying eats part of the subject.
PALETTE_HEX = {"月白": "#EEF7F2", "石青": "#2E5D8C", "缃绮": "#F8C471", "墨": "#1A1A1A"}


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def dist(a, b):
    return float(np.sqrt(np.sum((np.asarray(a, float) - np.asarray(b, float)) ** 2)))


def derive_key(rgb):
    """Key color = median of the border ring (robust to compression noise)."""
    h, w = rgb.shape[:2]
    ring = np.concatenate([
        rgb[0, :, :].reshape(-1, 3), rgb[h - 1, :, :].reshape(-1, 3),
        rgb[:, 0, :].reshape(-1, 3), rgb[:, w - 1, :].reshape(-1, 3),
    ])
    return np.median(ring, axis=0)


def key_safety(key):
    """Distance from the key color to every palette color. All must be large."""
    return {name: round(dist(key, hex_rgb(h)), 1) for name, h in PALETTE_HEX.items()}


def build_alpha(rgb, key, inner=30.0, outer=110.0):
    """Soft-ramp alpha by distance to the key color, preserving edge AA."""
    d = np.sqrt(np.sum((rgb.astype(float) - key.astype(float)) ** 2, axis=2))
    a = np.clip((d - inner) / (outer - inner), 0.0, 1.0)
    return (a * 255.0).astype(np.uint8)


def despill(rgb, key, alpha):
    """Pull edge pixels away from the key hue so no magenta fringe survives."""
    frac = 1.0 - alpha.astype(float) / 255.0
    out = rgb.astype(float)
    for c in range(3):
        out[:, :, c] = out[:, :, c] * (1.0 - frac) + key[c] * frac * 0.0
        # blend toward a neutral silk tone rather than toward the key color
        out[:, :, c] = out[:, :, c] + (242.0 - out[:, :, c]) * frac * 0.35
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        ROOT, "docs/research/yuegong-drafts/assets/asset_guizhi_magenta.png")
    target = int(sys.argv[2]) if len(sys.argv) > 2 else 512

    im = Image.open(src)
    rgb = np.asarray(im.convert("RGB"))

    key = derive_key(rgb)
    safety = key_safety(key)
    print("source      %s  %s  %.0f KB" % (os.path.basename(src), im.size, os.path.getsize(src) / 1024))
    print("key color   %s" % np.round(key).astype(int).tolist())
    print("key safety  distance to each palette color (want all > 90):")
    for name, d in safety.items():
        print("              %-4s %6.1f  %s" % (name, d, "OK" if d > 90 else "TOO CLOSE"))

    alpha = build_alpha(rgb, key)
    rgb = despill(rgb, key, alpha)

    out = np.dstack([rgb, alpha]).astype(np.uint8)
    pil = Image.fromarray(out, "RGBA")

    # opaque bounding box -> crop the dead magenta border, then downscale
    bbox = pil.getbbox()
    if bbox:
        pil = pil.crop(bbox)
    pil = pil.resize((target, target), Image.LANCZOS)

    stem = os.path.splitext(os.path.basename(src))[0].replace("_magenta", "")
    out_dir = os.path.dirname(src)
    png_path = os.path.join(out_dir, stem + "_keyed.png")
    webp_path = os.path.join(out_dir, stem + "_keyed.webp")
    pil.save(png_path)
    pil.save(webp_path, "WEBP", quality=88, method=6)

    a = np.asarray(pil.getchannel("A"))
    print("\nresult      %s  %s" % (pil.size, os.path.basename(webp_path)))
    print("  transparent %%   %.2f" % (100.0 * (a < 8).mean()))
    print("  opaque %%        %.2f" % (100.0 * (a > 247).mean()))
    print("  partial %%       %.2f  (edge anti-aliasing)" % (100.0 * ((a >= 8) & (a <= 247)).mean()))
    print("  png             %.0f KB" % (os.path.getsize(png_path) / 1024))
    print("  webp            %.0f KB   <- this is what ships" % (os.path.getsize(webp_path) / 1024))

    # residual magenta check: any surviving pixel close to the key color
    resid = np.asarray(pil.convert("RGB")).astype(float)
    kd = np.sqrt(np.sum((resid - key) ** 2, axis=2))
    fringe = ((kd < 60) & (a > 200)).mean() * 100
    print("  magenta fringe  %.2f%%  %s" % (fringe, "OK" if fringe < 1.0 else "FRINGE REMAINS"))


if __name__ == "__main__":
    main()
