"""Merge the authored glosses into tools/yuegong/assets/data.js.

Inserts a `gloss` map and a `ruby` table into D at a single point, so the
existing node/choice/ending structures stay untouched.

Usage: python tests/merge_yuegong_gloss.py
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLOSS = os.path.join(ROOT, "docs/research/yuegong-gloss.json")
DATA = os.path.join(ROOT, "tools/yuegong/assets/data.js")
ANCHOR = "\n  ]\n};\n\nwindow.YGData = D;"
REPLACEMENT_HEAD = "\n  ],\n"


def js(s):
    return json.dumps(s, ensure_ascii=False)


def block(g):
    lines = ["", "  gloss: {", "    intro: %s," % js(g["intro"])]

    lines.append("    nodes: {")
    for k in sorted(g["nodes"]):
        lines.append("      %s: %s," % (k, js(g["nodes"][k])))
    lines.append("    },")

    lines.append("    outcomes: {")
    for k in sorted(g["outcomes"]):
        lines.append("      %s: %s," % (js(k), js(g["outcomes"][k])))
    lines.append("    },")

    lines.append("    endings: {")
    for k in sorted(g["endings"]):
        lines.append("      %s: %s," % (k, js(g["endings"][k])))
    lines.append("    }")
    lines.append("  },")

    lines.append("")
    lines.append("  ruby: [")
    for i, r in enumerate(g["ruby"]):
        tail = "," if i < len(g["ruby"]) - 1 else ""
        lines.append("    { term: %s, rt: %s, note: %s }%s"
                     % (js(r["term"]), js(r["rt"]), js(r["note"]), tail))
    lines.append("  ]")

    return "\n".join(lines)


def main():
    sys.stdout.reconfigure(line_buffering=True)
    g = json.load(open(GLOSS, encoding="utf-8"))
    src = open(DATA, encoding="utf-8").read()

    if "  gloss: {" in src:
        print("ABORT: data.js already carries a gloss map")
        return 1

    if src.count(ANCHOR) != 1:
        print("ABORT: anchor not found exactly once (%d)" % src.count(ANCHOR))
        return 1

    before = sorted(set(re.findall(r"\bend_[a-z]+\b", src)))
    out = src.replace(ANCHOR, REPLACEMENT_HEAD + block(g) + "\n};\n\nwindow.YGData = D;")
    after = sorted(set(re.findall(r"\bend_[a-z]+\b", out)))

    open(DATA, "w", encoding="utf-8").write(out)

    print("inserted gloss map + %d ruby entries" % len(g["ruby"]))
    print("nodes %d / outcomes %d / endings %d"
          % (len(g["nodes"]), len(g["outcomes"]), len(g["endings"])))
    print("end_ id set before: %s" % before)
    print("end_ id set after : %s" % after)
    print("set unchanged     : %s" % (before == after))
    print("lines %d -> %d" % (src.count("\n"), out.count("\n")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
