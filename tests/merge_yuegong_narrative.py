"""Merge authored narrative text into tools/yuegong/assets/data.js.

Replaces prose only (meta.intro, node text, choice text/outcome, ending text,
gloss, ruby, knowledge) while preserving every structural field the engine and
test suite depend on: node ids, choices[].next, warmth/tune/dance deltas, and
ending ids.

The merge is a deterministic rebuild rather than regex surgery: the existing
file is parsed to recover structure, the narrative JSON supplies prose, and the
result is regenerated with a stable serializer. Invariants are verified before
anything is written, so a failed merge leaves the file untouched.

Usage: python tests/merge_yuegong_narrative.py
"""

import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NARRATIVE = os.path.join(ROOT, "docs/research/yuegong-narrative.json")
DATA = os.path.join(ROOT, "tools/yuegong/assets/data.js")
INDEX = os.path.join(ROOT, "tools/yuegong/index.html")

BANNED = ["eval(", "new Function(", "http://", "https://", "Math.random",
          "DEBUG_PASS"]

DELTA_KEYS = ("warmth", "tune", "dance")


def js(s):
    return json.dumps(s, ensure_ascii=False)


def load_current():
    """Parse the on-disk data.js in Node and return its structure as JSON."""
    script = (
        "global.window={};"
        "require(%s);"
        "process.stdout.write(JSON.stringify(window.YGData));" % js(DATA)
    )
    out = subprocess.run(["node", "-e", script], capture_output=True, text=True,
                         cwd=ROOT)
    if out.returncode != 0:
        raise SystemExit("ABORT: cannot parse data.js\n%s" % out.stderr)
    return json.loads(out.stdout)


def serialize(D):
    """Deterministic serializer matching the file's existing hand-written shape."""
    L = ["'use strict';", "", "/* =========================== [DATA] ============================",
         "   Pure data. No logic. §2 node graph verbatim from source texts.",
         "   ================================================================ */", "",
         "var D = {"]

    L.append("  meta: {")
    for k in ("title", "subtitle", "intro"):
        L.append("    %s: %s," % (k, js(D["meta"][k])))
    L[-1] = L[-1].rstrip(",")
    L.append("  },")
    L.append("")

    L.append("  nodes: {")
    for nid in D["_node_order"]:
        nd = D["nodes"][nid]
        L.append("    %s: {" % js(nid))
        if nd.get("title") is not None:
            L.append("      title: %s," % js(nd["title"]))
        L.append("      text: %s," % js(nd["text"]))
        L.append("      choices: [")
        for i, c in enumerate(nd["choices"]):
            tail = "," if i < len(nd["choices"]) - 1 else ""
            parts = ["text: %s" % js(c["text"]), "next: %s" % js(c["next"])]
            for dk in DELTA_KEYS:
                if dk in c:
                    parts.append("%s: %d" % (dk, c[dk]))
            parts.append("outcome: %s" % js(c["outcome"]))
            L.append("        { %s }%s" % (", ".join(parts), tail))
        L.append("      ]")
        L.append("    },")
    L[-1] = L[-1].rstrip(",")
    L.append("  },")
    L.append("")

    L.append("  endings: {")
    for eid in D["_ending_order"]:
        e = D["endings"][eid]
        L.append("    %s: {" % js(eid))
        L.append("      name: %s," % js(e["name"]))
        L.append("      cond: %s," % js(e["cond"]))
        L.append("      text: %s" % js(e["text"]))
        L.append("    },")
    L[-1] = L[-1].rstrip(",")
    L.append("  },")
    L.append("")

    L.append("  knowledge: [")
    for i, k in enumerate(D["knowledge"]):
        tail = "," if i < len(D["knowledge"]) - 1 else ""
        L.append("    { title: %s, text: %s }%s" % (js(k["title"]), js(k["text"]), tail))
    L.append("  ],")
    L.append("")

    g = D["gloss"]
    L.append("  gloss: {")
    L.append("    intro: %s," % js(g["intro"]))
    L.append("    nodes: {")
    for k in D["_node_order"]:
        L.append("      %s: %s," % (k, js(g["nodes"][k])))
    L[-1] = L[-1].rstrip(",")
    L.append("    },")
    L.append("    outcomes: {")
    ok = sorted(g["outcomes"])
    for k in ok:
        L.append("      %s: %s," % (js(k), js(g["outcomes"][k])))
    L[-1] = L[-1].rstrip(",")
    L.append("    },")
    L.append("    endings: {")
    for k in D["_ending_order"]:
        L.append("      %s: %s," % (k, js(g["endings"][k])))
    L[-1] = L[-1].rstrip(",")
    L.append("    }")
    L.append("  },")
    L.append("")

    L.append("  ruby: [")
    for i, r in enumerate(D["ruby"]):
        tail = "," if i < len(D["ruby"]) - 1 else ""
        L.append("    { term: %s, rt: %s, note: %s }%s"
                 % (js(r["term"]), js(r["rt"]), js(r["note"]), tail))
    L.append("  ]")

    L.append("};")
    L.append("")
    L.append("window.YGData = D;")
    return "\n".join(L) + "\n"


def structure_of(D):
    """Snapshot of every field the merge must preserve, for before/after diffing."""
    snap = {"node_ids": [], "next": {}, "deltas": {}, "choice_counts": {},
            "ending_ids": [], "titles": {}}
    for nid in D["_node_order"]:
        nd = D["nodes"][nid]
        snap["node_ids"].append(nid)
        snap["choice_counts"][nid] = len(nd["choices"])
        snap["titles"][nid] = nd.get("title")
        for i, c in enumerate(nd["choices"]):
            snap["next"]["%s:%d" % (nid, i)] = c["next"]
            snap["deltas"]["%s:%d" % (nid, i)] = {dk: c[dk] for dk in DELTA_KEYS if dk in c}
    snap["ending_ids"] = list(D["_ending_order"])
    return snap


def all_prose(D):
    """Every prose string, used for ruby orphan detection and banned-string scan."""
    parts = [D["meta"]["intro"]]
    for nid in D["_node_order"]:
        nd = D["nodes"][nid]
        parts.append(nd["text"] or "")
        for c in nd["choices"]:
            parts.append(c["text"] or "")
            parts.append(c["outcome"] or "")
    for eid in D["_ending_order"]:
        parts.append(D["endings"][eid]["text"] or "")
    for g in D["gloss"]["nodes"].values():
        parts.append(g)
    for g in D["gloss"]["outcomes"].values():
        parts.append(g)
    for g in D["gloss"]["endings"].values():
        parts.append(g)
    parts.append(D["gloss"]["intro"])
    return "\n".join(parts)


def ruby_orphans(D):
    prose = all_prose(D)
    return [r["term"] for r in D["ruby"] if r["term"] not in prose]


def verify(before, after, full, text, failures):
    def chk(cond, label):
        if not cond:
            failures.append(label)
        print("  %s %s" % ("PASS" if cond else "FAIL", label))

    print("\n[structure preserved]")
    chk(before["node_ids"] == after["node_ids"],
        "node ids unchanged (%d)" % len(after["node_ids"]))
    chk(before["choice_counts"] == after["choice_counts"],
        "per-node choice counts unchanged (%d total)"
        % sum(after["choice_counts"].values()))
    chk(before["next"] == after["next"], "choices[].next unchanged")
    chk(before["deltas"] == after["deltas"], "warmth/tune/dance deltas unchanged")
    chk(before["ending_ids"] == after["ending_ids"],
        "ending ids unchanged (%s)" % ",".join(after["ending_ids"]))
    chk(before["titles"] == after["titles"], "node titles unchanged")

    print("\n[content invariants]")
    chk(len(after["ending_ids"]) == 5, "exactly 5 endings")
    chk(sum(after["choice_counts"].values()) == 21, "exactly 21 choices")
    chk(len(after["node_ids"]) == 12, "exactly 12 nodes")

    ids = sorted(set(re.findall(r"\bend_[a-z]+\b", text)))
    idx = open(INDEX, encoding="utf-8").read()
    ids_both = sorted(set(ids) | set(re.findall(r"\bend_[a-z]+\b", idx)))
    chk(ids_both == sorted(after["ending_ids"]),
        "\\bend_[a-z]+\\b across data.js+index.html == the 5 ending ids %s" % ids_both)

    print("\n[prose non-empty]")
    prose_fail = []
    for k in ("title", "subtitle", "intro"):
        if not str(full["meta"][k]).strip():
            prose_fail.append("meta.%s" % k)
    for nid in full["_node_order"]:
        nd = full["nodes"][nid]
        if nd.get("title") is not None and not str(nd["title"]).strip():
            prose_fail.append("%s.title" % nid)
        if not str(nd["text"]).strip():
            prose_fail.append("%s.text" % nid)
        for i, c in enumerate(nd["choices"]):
            if not str(c["text"]).strip():
                prose_fail.append("%s:%d.text" % (nid, i))
            if not str(c["outcome"]).strip():
                prose_fail.append("%s:%d.outcome" % (nid, i))
    for eid in full["_ending_order"]:
        e = full["endings"][eid]
        for k in ("name", "cond", "text"):
            if not str(e[k]).strip():
                prose_fail.append("%s.%s" % (eid, k))
    for i, k in enumerate(full["knowledge"]):
        if not str(k["title"]).strip():
            prose_fail.append("knowledge[%d].title" % i)
        if not str(k["text"]).strip():
            prose_fail.append("knowledge[%d].text" % i)
    chk(not prose_fail, "all replaced prose non-empty %s" % prose_fail[:8])

    print("\n[gloss coverage]")
    g = full["gloss"]
    chk(set(g["nodes"]) == set(after["node_ids"]), "gloss.nodes covers all 12 nodes")
    want_out = {"%s:%d" % (nid, i)
                for nid in after["node_ids"]
                for i in range(after["choice_counts"][nid])}
    chk(set(g["outcomes"]) == want_out,
        "gloss.outcomes covers all 21 (%d keys)" % len(g["outcomes"]))
    chk(set(g["endings"]) == set(after["ending_ids"]), "gloss.endings covers all 5")
    empty = [k for k, v in list(g["nodes"].items()) + list(g["outcomes"].items())
             + list(g["endings"].items()) if not str(v).strip()]
    chk(not empty, "no empty gloss values")

    print("\n[ruby]")
    orphans = ruby_orphans(full)
    chk(not orphans, "no orphan ruby terms %s" % orphans)
    chk(len(full["ruby"]) >= 14, "ruby >= 14 entries (%d)" % len(full["ruby"]))

    print("\n[banned strings]")
    hits = [b for b in BANNED if b in text]
    chk(not hits, "no banned strings %s" % hits)
    chk(not re.search(r"^import |^export ", text, re.M), "no leading import/export")

    print("\n[syntax]")
    tmp = os.path.join(ROOT, ".narrative_syntax_check.js")
    open(tmp, "w", encoding="utf-8").write(text)
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
    os.remove(tmp)
    chk(r.returncode == 0, "node --check passes")


def main():
    sys.stdout.reconfigure(line_buffering=True)

    if not os.path.exists(NARRATIVE):
        print("ABORT: %s not found" % NARRATIVE)
        return 1

    cur = load_current()
    cur["_node_order"] = list(cur["nodes"])
    cur["_ending_order"] = list(cur["endings"])
    cur["_gloss"] = cur["gloss"]

    nar = json.load(open(NARRATIVE, encoding="utf-8"))

    out = json.loads(json.dumps(cur))
    out["_node_order"] = cur["_node_order"]
    out["_ending_order"] = cur["_ending_order"]

    out["meta"]["title"] = nar["meta"]["title"]
    out["meta"]["subtitle"] = nar["meta"]["subtitle"]
    out["meta"]["intro"] = nar["meta"]["intro"]

    for nid in out["_node_order"]:
        src = cur["nodes"][nid]
        new = nar["nodes"][nid]
        out["nodes"][nid]["text"] = new["text"]
        for i, c in enumerate(src["choices"]):
            nc = new["choices"][i]
            out["nodes"][nid]["choices"][i]["text"] = nc["text"]
            out["nodes"][nid]["choices"][i]["outcome"] = nc["outcome"]

    for eid in out["_ending_order"]:
        ne = nar["endings"][eid]
        out["endings"][eid]["name"] = ne["name"]
        out["endings"][eid]["cond"] = ne["cond"]
        out["endings"][eid]["text"] = ne["text"]

    out["gloss"] = nar["gloss"]
    out["_gloss"] = nar["gloss"]
    out["ruby"] = nar["ruby"]
    out["knowledge"] = nar["knowledge"]

    text = serialize(out)

    failures = []
    print("[merge] %d nodes / %d endings / %d ruby / %d knowledge"
          % (len(out["_node_order"]), len(out["_ending_order"]),
             len(out["ruby"]), len(out["knowledge"])))
    verify(structure_of(cur), structure_of(out), out, text, failures)

    if failures:
        print("\nABORT: %d invariant(s) failed, data.js NOT written" % len(failures))
        for f in failures:
            print("  - %s" % f)
        return 1

    backup = DATA + ".bak"
    open(backup, "w", encoding="utf-8").write(open(DATA, encoding="utf-8").read())
    open(DATA, "w", encoding="utf-8").write(text)
    print("\nwrote data.js (%d -> %d lines); backup at %s"
          % (open(DATA + ".bak", encoding="utf-8").read().count("\n"),
             text.count("\n"), backup))
    return 0


if __name__ == "__main__":
    sys.exit(main())
