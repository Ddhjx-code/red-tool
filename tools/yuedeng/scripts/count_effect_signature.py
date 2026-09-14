#!/usr/bin/env python3
"""Byte-level guard for the approved 透光效应 in tools/yuedeng/assets/engine.js.

Counts fixed-string signatures that must survive any silhouette edit, plus the
patterns that must stay at zero (randomness / network / own rAF loop).
Read-only. Run: python3 tools/yuedeng/scripts/count_effect_signature.py
"""
from __future__ import annotations

import pathlib

ENGINE = pathlib.Path(__file__).resolve().parents[1] / "assets" / "engine.js"

# 已验证原型锁定、用户已批准的特效签名 —— 必须逐字保留
MUST_SURVIVE = [
    "lit *= 0.40 + 0.78 * lamp",
    "exp(-max(sdc, 0.0) * 3.0)",
    "vorticity",
    "curl",
    "gl_FragColor",
    "precision ",
    "SHAPE_DUR",
    "uShapeW.x * d0 + uShapeW.y * d1 + uShapeW.z * d2 + uShapeW.w * d3",
]

# 确定性 / 自包含约束 —— 必须恒为 0
MUST_BE_ZERO = [
    "Math.random",
    "rng",
    "fetch(",
    "XMLHttpRequest",
    "http://",
    "https://",
    "requestAnimationFrame",
]


def main() -> int:
    src = ENGINE.read_text(encoding="utf-8")
    print(f"# {ENGINE}")
    print("## must survive (approved effect)")
    bad = False
    for sig in MUST_SURVIVE:
        n = src.count(sig)
        print(f"  {n:>3}  {sig}")
        if n == 0:
            bad = True
    print("## must be zero (determinism / self-containment)")
    for sig in MUST_BE_ZERO:
        n = src.count(sig)
        print(f"  {n:>3}  {sig}")
        if n != 0:
            bad = True
    print("RESULT: " + ("FAIL" if bad else "OK"))
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
