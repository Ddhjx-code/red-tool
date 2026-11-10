#!/usr/bin/env python3
"""按 minitool-zip-builder 1.7.0 门禁扫描 tools/ 下各小工具产物。

检查项对应 .skill/references 中：
  js-compatibility.md   ES2018+ 语法、classic script
  css-compatibility.md  Chrome 61 不能作为唯一实现的能力
  zip-artifact-spec.md  内联脚本 / 行内事件 / 外部引用 / 单入口
  performance-budget.md 文本体积、Base64 体积

vendor/ 目录与 *.min.js 单独归为 vendor 项：第三方库命中不等于违规，
但必须确认存在「包内不联网」的调用路径（例如不触发 three.js 的 Loader 网络分支）。

用法：
  python3 tests/spec_compliance_scan.py            # 扫描全部工具
  python3 tests/spec_compliance_scan.py hanfu      # 只扫某个
  python3 tests/spec_compliance_scan.py --md       # 额外输出 markdown 表格
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"

MIB = 1024 * 1024
KIB = 1024

# --- JS：ES2018+ 语法（解析期即失败，无法用运行时 if 兜底） ---
JS_SYNTAX = [
    (r"\?(?=\.[A-Za-z_$\[(])", "可选链 ?."),
    (r"\?\?", "空值合并 ??"),
    (r"\|\|=|&&=|\?\?=", "逻辑赋值"),
    (r"\{\s*\.\.\.\w+\s*[,}]", "对象展开（字面量）"),
    (r",\s*\.\.\.\w+\s*[,}]", "对象展开（字面量 2）"),
    (r"\{\s*[\w$]+\s*,\s*\.\.\.\w+\s*\}\s*=", "解构 rest"),
    (r"for\s+await\s*\(", "for await"),
    (r"^await\s", "顶层 await"),
    (r"^\s*#\w+\s*=", "class 私有字段"),
    (r"this\.#\w+", "class 私有字段（访问）"),
    (r"\bstatic\s*\{", "class static block"),
]

# --- JS：更新的运行时 API（非语法，需能力检测或避免单一路径） ---
JS_RUNTIME = [
    (r"\.replaceAll\(", "String.replaceAll"),
    (r"\.at\(\s*-?\d", "Array.prototype.at"),
    (r"Object\.hasOwn\(", "Object.hasOwn"),
    (r"structuredClone\(", "structuredClone"),
]

# --- 容器明确禁用 ---
JS_BLOCKED = [
    (r"\bfetch\s*\(", "fetch"),
    (r"XMLHttpRequest", "XMLHttpRequest"),
    (r"new\s+WebSocket\s*\(", "WebSocket"),
    (r"new\s+EventSource\s*\(", "EventSource"),
    (r"new\s+RTCPeerConnection\s*\(", "WebRTC"),
    (r"\beval\s*\(", "eval"),
    (r"new\s+Function\s*\(", "new Function"),
    (r"WebAssembly\.", "WebAssembly"),
    (r"new\s+SharedWorker\s*\(", "SharedWorker"),
    (r"serviceWorker\.register", "Service Worker"),
    (r"navigator\.clipboard", "剪贴板"),
    (r"document\.execCommand\s*\(\s*['\"](?:copy|cut|paste)", "execCommand 剪贴板"),
    (r"navigator\.geolocation", "Web 地理定位"),
    (r"DeviceMotionEvent|DeviceOrientationEvent|devicemotion|deviceorientation", "设备运动/朝向"),
    (r"requestFullscreen", "requestFullscreen"),
    (r"window\.open\s*\(", "window.open"),
    (r"window\.prompt\s*\(", "window.prompt"),
]

# --- CSS：Chrome 61 不可作为唯一实现 ---
# `gap` 单独按规则块分析（flex / grid 的修法不同），不放在此表
CSS_RISK = [
    (r"aspect-ratio\s*:", "aspect-ratio"),
    (r"\binset\s*:", "inset"),
    (r"\bclamp\s*\(", "clamp()"),
    (r"margin-inline|padding-block|margin-block|padding-inline", "逻辑属性"),
    (r":has\s*\(", ":has()"),
    (r"@container", "Container Queries"),
    (r"@layer", "Cascade Layers"),
    (r"@property", "CSS @property"),
    (r"\b[dls]vh\b", "动态视口单位"),
    (r"backdrop-filter", "backdrop-filter"),
    (r"color-mix\s*\(|oklch\s*\(|oklab\s*\(", "现代颜色"),
    (r"text-wrap\s*:", "text-wrap"),
    (r":focus-visible", ":focus-visible"),
    (r"overflow\s*:\s*clip", "overflow: clip"),
]

GAP_DECL = re.compile(r"(?<!grid-)\b(?:row-|column-)?gap\s*:")
DISPLAY_FLEX = re.compile(r"display\s*:\s*(?:inline-)?flex", re.I)
DISPLAY_GRID = re.compile(r"display\s*:\s*(?:inline-)?grid", re.I)


def scan_css_gap(text: str) -> dict[str, int]:
    """按规则块判断 gap 落在 flex 还是 grid 容器上；Chrome 61 两者都不支持 gap 简写。"""
    counts = {"flex": 0, "grid": 0, "unknown": 0}
    # 粗切规则块：去掉注释后以 } 分块即可覆盖本仓库的实际写法
    body = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    for block in body.split("}"):
        if not GAP_DECL.search(block):
            continue
        n = len(GAP_DECL.findall(block))
        if DISPLAY_GRID.search(block):
            counts["grid"] += n
        elif DISPLAY_FLEX.search(block):
            counts["flex"] += n
        else:
            counts["unknown"] += n
    return counts

HTML_INLINE_SCRIPT = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>", re.I)
HTML_INLINE_HANDLER = re.compile(r"\son(?:click|change|input|touch\w+|pointer\w+|load|error|submit)\s*=", re.I)
HTML_MODULE = re.compile(r"<script[^>]*type\s*=\s*['\"]module['\"]", re.I)
HTML_EXTERNAL = re.compile(r"(?:src|href)\s*=\s*['\"]https?://", re.I)
CSS_EXTERNAL = re.compile(r"url\(\s*['\"]?https?://", re.I)
JS_IMPORT = re.compile(r"^\s*(?:import|export)\s+[\w{*]", re.M)

# 长 base64 字符串（无论是否带 data: 前缀）
LONG_B64_LITERAL = re.compile(r"['\"]([A-Za-z0-9+/]{40000,}={0,2})['\"]")
DATA_URI = re.compile(r"data:[\w/+.-]+;base64,([A-Za-z0-9+/=]{1000,})")


def is_vendor(path: Path) -> bool:
    return "vendor" in path.parts or path.name.endswith(".min.js")


def scan_js(path: Path, text: str, hits: dict, vendor_hits: dict) -> None:
    bucket = vendor_hits if is_vendor(path) else hits
    for pattern, label in JS_SYNTAX + JS_RUNTIME + JS_BLOCKED:
        n = len(re.findall(pattern, text, re.M))
        if n:
            bucket.setdefault(label, []).append(f"{path.name}×{n}")
    if JS_IMPORT.search(text):
        bucket.setdefault("import/export 模块语法", []).append(path.name)


def scan_tool(tool: Path) -> dict:
    result = {
        "name": tool.name,
        "hits": {},
        "vendor_hits": {},
        "files": 0,
        "text_bytes": 0,
        "big_text": [],
        "big_b64": [],
        "errors": [],
    }
    hits, vendor_hits = result["hits"], result["vendor_hits"]

    html_files = sorted(tool.rglob("*.html"))
    if not (tool / "index.html").exists() and html_files:
        result["errors"].append("index.html 不在根目录")
    if len(html_files) > 1:
        names = ", ".join(p.relative_to(tool).as_posix() for p in html_files)
        result["errors"].append(f"多个 HTML 文件：{names}")

    for path in sorted(tool.rglob("*")):
        if not path.is_file():
            continue
        suffix = path.suffix.lower()
        if suffix not in {".html", ".css", ".js", ".json"}:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError as exc:
            result["errors"].append(f"读取失败 {path.name}: {exc}")
            continue

        result["files"] += 1
        size = path.stat().st_size
        result["text_bytes"] += size
        if size > 2 * MIB:
            result["big_text"].append(f"{path.name} {size / MIB:.2f}MiB")

        if not is_vendor(path):
            for match in DATA_URI.finditer(text):
                decoded = len(match.group(1)) * 3 // 4
                if decoded > 100 * KIB:
                    result["big_b64"].append(f"{path.name} data-uri≈{decoded // KIB}KiB")
            for match in LONG_B64_LITERAL.finditer(text):
                decoded = len(match.group(1)) * 3 // 4
                if decoded > 100 * KIB:
                    result["big_b64"].append(f"{path.name} 长 base64≈{decoded // KIB}KiB")

        if suffix == ".js":
            scan_js(path, text, hits, vendor_hits)
        elif suffix == ".html":
            if HTML_MODULE.search(text):
                hits.setdefault('type="module"', []).append(path.name)
            if HTML_INLINE_SCRIPT.search(text):
                hits.setdefault("内联 <script>", []).append(path.name)
            if HTML_INLINE_HANDLER.search(text):
                hits.setdefault("行内事件 onclick=", []).append(path.name)
            if HTML_EXTERNAL.search(text):
                hits.setdefault("外部 http(s) 引用", []).append(path.name)
            referenced = set(re.findall(r'(?:src|href)\s*=\s*["\']([^"\']+)', text))
            for ref in referenced:
                ref = ref.split("?")[0]
                if ref.startswith(("http://", "https://", "//", "data:", "#")):
                    continue
                target = (path.parent / ref.lstrip("./")).resolve()
                if not target.exists():
                    result["errors"].append(f"引用缺失：{path.name} → {ref}")
            # 页面内 <style> 与行内 style="" 同样受 Chrome 61 约束
            gaps = scan_css_gap(text)
            if gaps["flex"]:
                hits.setdefault("Flex gap（需改 margin）", []).append(f"{path.name}×{gaps['flex']}")
            if gaps["grid"]:
                hits.setdefault("Grid gap（改 grid-gap）", []).append(f"{path.name}×{gaps['grid']}")
            for match in DATA_URI.finditer(text):
                decoded = len(match.group(1)) * 3 // 4
                if decoded > 100 * KIB:
                    result["big_b64"].append(f"{path.name} data-uri≈{decoded // KIB}KiB")
        elif suffix == ".css":
            for pattern, label in CSS_RISK:
                n = len(re.findall(pattern, text, re.I))
                if n:
                    hits.setdefault(label, []).append(f"{path.name}×{n}")
            gaps = scan_css_gap(text)
            if gaps["flex"]:
                hits.setdefault("Flex gap（需改 margin）", []).append(f"{path.name}×{gaps['flex']}")
            if gaps["grid"]:
                hits.setdefault("Grid gap（改 grid-gap）", []).append(f"{path.name}×{gaps['grid']}")
            if gaps["unknown"]:
                hits.setdefault("gap 容器未判定（人工确认）", []).append(f"{path.name}×{gaps['unknown']}")
            if CSS_EXTERNAL.search(text):
                hits.setdefault("外部 http(s) 引用", []).append(path.name)

    return result


def render(results: list[dict]) -> None:
    print(f"{'工具':<10}{'文本':>7}  检出")
    print("-" * 92)
    for r in results:
        parts = []
        for label, where in r["hits"].items():
            parts.append(f"{label}({len(where)})")
        if r["big_text"]:
            parts.append(f"单文件>2MiB({len(r['big_text'])})")
        if r["big_b64"]:
            parts.append(f"大Base64({len(r['big_b64'])})")
        if r["vendor_hits"]:
            parts.append(f"vendor残留({len(r['vendor_hits'])})")
        if r["errors"]:
            parts.append(f"错误({len(r['errors'])})")
        print(f"{r['name']:<10}{r['text_bytes'] / KIB:>6.0f}K  {', '.join(parts) or '通过'}")


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    emit_md = "--md" in sys.argv
    tools = [TOOLS / args[0]] if args else sorted(p for p in TOOLS.iterdir() if p.is_dir())
    results = [scan_tool(t) for t in tools if t.is_dir()]
    render(results)

    if emit_md:
        print()
        print("| 工具 | 文本体积 | 业务代码检出 | vendor 残留 | 体积风险 | 结构错误 |")
        print("| --- | --- | --- | --- | --- | --- |")
        for r in results:
            biz = "<br>".join(f"{k}: {', '.join(v)}" for k, v in r["hits"].items()) or "—"
            ven = "<br>".join(f"{k}: {', '.join(v)}" for k, v in r["vendor_hits"].items()) or "—"
            vol = "<br>".join(r["big_text"] + r["big_b64"]) or "—"
            err = "<br>".join(r["errors"]) or "—"
            print(f"| {r['name']} | {r['text_bytes'] / KIB:.0f}K | {biz} | {ven} | {vol} | {err} |")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
