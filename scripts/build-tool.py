#!/usr/bin/env python3
"""把 tools/<name>/ 打成可直接上传的小工具包 dist/<name>.zip。

规范见 .skill/references/zip-artifact-spec.md，几条硬要求在这里落地：
  - index.html 必须在 zip 根目录（压的是目录内容，不是目录本身）
  - 禁止 node_modules / .git / .DS_Store / *.map / 构建配置
  - 只允许 html/css/js/图片/字体/json
  - 总包 <= 10MB，建议 <= 2MB

用法：
    python3 scripts/build-tool.py yueli
    python3 scripts/build-tool.py qishan --out /tmp
    python3 scripts/build-tool.py --all
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
DIST = ROOT / "dist"
AUDIT = ROOT / ".skill" / "scripts" / "audit_artifact.py"

ALLOWED_SUFFIXES = {
    ".html", ".css", ".js", ".json",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    ".woff", ".woff2",
}
# 开发期文件，不该进包
EXCLUDE_NAMES = {".DS_Store", "Thumbs.db"}
EXCLUDE_SUFFIXES = {".map", ".md", ".zip", ".py", ".sh", ".txt"}
EXCLUDE_DIRS = {"node_modules", ".git", "__pycache__", ".vscode"}
# 工具目录里的原型稿 / 调试页，只留在仓库里
EXCLUDE_GLOBS = {"prototype*.html", "*-prototype.html", "_*.html"}

MIB = 1024 * 1024


def collect(tool_dir: Path) -> tuple[list[Path], list[str]]:
    """返回要打包的文件与被跳过的文件说明。"""
    files: list[Path] = []
    skipped: list[str] = []
    for path in sorted(tool_dir.rglob("*")):
        rel = path.relative_to(tool_dir)
        if any(part in EXCLUDE_DIRS for part in rel.parts):
            if path.is_file():
                skipped.append(f"{rel}（开发目录）")
            continue
        if path.is_dir():
            continue

        name = path.name
        if name in EXCLUDE_NAMES:
            continue
        if path.suffix.lower() in EXCLUDE_SUFFIXES:
            skipped.append(f"{rel}（非交付文件类型）")
            continue
        if any(rel.match(g) for g in EXCLUDE_GLOBS):
            skipped.append(f"{rel}（原型/调试页）")
            continue
        if path.suffix.lower() not in ALLOWED_SUFFIXES:
            skipped.append(f"{rel}（类型不允许：{path.suffix}）")
            continue
        files.append(path)
    return files, skipped


def build(name: str, out_dir: Path) -> Path:
    tool_dir = TOOLS / name
    if not tool_dir.is_dir():
        raise SystemExit(f"工具目录不存在：{tool_dir}")
    entry = tool_dir / "index.html"
    if not entry.is_file():
        raise SystemExit(f"{name}: 缺 index.html，规范要求入口在根目录")

    files, skipped = collect(tool_dir)
    if not files:
        raise SystemExit(f"{name}: 没有可打包的文件")

    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"{name}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in files:
            arc = path.relative_to(tool_dir).as_posix()
            zf.write(path, arc)

    # 打完立即回读校验，不相信自己刚写的东西
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        if "index.html" not in names:
            raise SystemExit(f"{name}: 校验失败，index.html 不在 zip 根")
        nested = [n for n in names if n.count("/") and n.split("/")[0] == "index.html"]
        if nested:
            raise SystemExit(f"{name}: 校验失败，多套了一层目录")
        bad = [n for n in names if Path(n).suffix.lower() not in ALLOWED_SUFFIXES]
        if bad:
            raise SystemExit(f"{name}: 校验失败，含不允许的类型：{bad}")

    size = zip_path.stat().st_size
    print(f"[{name}] {zip_path.relative_to(ROOT)}")
    print(f"  文件 {len(names)} 个，{size / 1024:.1f} KB，原目录 {sum(f.stat().st_size for f in files) / MIB:.2f} MiB")
    if skipped:
        print("  跳过：")
        for s in skipped:
            print(f"    - {s}")
    if size > 10 * MIB:
        raise SystemExit(f"{name}: 超过 10MB 上限")
    if size > 2 * MIB:
        print(f"  ⚠️  超过建议值 2MB，规范要求先优化而不是靠压缩率掩盖")
    return zip_path


def audit(zip_path: Path) -> None:
    if not AUDIT.is_file():
        print("  （未找到 audit_artifact.py，跳过体积审计）")
        return
    proc = subprocess.run(
        [sys.executable, str(AUDIT), str(zip_path)],
        capture_output=True, text=True,
    )
    out = (proc.stdout + proc.stderr).strip()
    for line in out.splitlines():
        print(f"  audit | {line}")
    if proc.returncode not in (0, None):
        print(f"  ⚠️  audit 退出码 {proc.returncode}")


def main() -> None:
    ap = argparse.ArgumentParser(description="打包小工具为可上传的 zip")
    ap.add_argument("name", nargs="?", help="tools/ 下的目录名")
    ap.add_argument("--all", action="store_true", help="打包 tools/ 下全部工具")
    ap.add_argument("--out", default=None, help="输出目录，默认 dist/")
    args = ap.parse_args()

    if args.all:
        names = sorted(p.name for p in TOOLS.iterdir() if (p / "index.html").is_file())
    elif args.name:
        names = [args.name]
    else:
        ap.error("要么给工具名，要么用 --all")

    out_dir = Path(args.out).resolve() if args.out else DIST
    for name in names:
        zip_path = build(name, out_dir)
        audit(zip_path)


if __name__ == "__main__":
    main()
