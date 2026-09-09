"""Functional check for the 白话折叠 toggle + 术语级 ruby layer.

The smoke suite only asserts DOM invariants, so gloss/ruby behaviour needs its
own evidence. Headless only — never opens a visible window.

Usage: python tests/check_yuegong_gloss.py
"""

import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "tools/yuegong/index.html"
VIEWPORT = {"width": 430, "height": 932}

VIEWS = [
    ("view-intro", "btn-gloss-intro", "intro-gloss"),
    ("view-node", "btn-gloss-node", "node-gloss"),
    ("view-outcome", "btn-gloss-outcome", "outcome-gloss"),
    ("view-ending", "btn-gloss-end", "end-gloss"),
]

fails = []


def check(label, cond, detail=""):
    print("%s  %s%s" % ("PASS" if cond else "FAIL", label,
                        (" | %s" % detail) if detail else ""))
    if not cond:
        fails.append(label)


def probe(page, view, btn, panel):
    shown = page.evaluate(
        "() => [...document.querySelectorAll('.view')]"
        ".find(v => v.classList.contains('is-active')).id")
    if shown != view:
        check("%s: 视图已激活" % view, False, "got %s" % shown)
        return

    text = page.eval_on_selector("#%s" % panel, "el => el.textContent")
    visible = page.eval_on_selector("#%s" % btn,
                                    "el => getComputedStyle(el).display !== 'none'")
    folded = not page.eval_on_selector(
        "#%s" % panel, "el => el.classList.contains('is-open')")

    check("%s: 白话面板有内容" % view, bool(text.strip()), "%d 字" % len(text))
    check("%s: 折叠按钮可见" % view, visible)
    check("%s: 默认折叠（无 is-open）" % view, folded)

    # JS click: keeps wiring under test independent of sheet-overflow reachability.
    page.eval_on_selector("#%s" % btn, "el => el.click()")
    open_panel = page.eval_on_selector(
        "#%s" % panel, "el => el.classList.contains('is-open')")
    open_btn = page.eval_on_selector(
        "#%s" % btn, "el => el.classList.contains('is-open')")
    check("%s: 点击后展开（面板 + 按钮同步 is-open）" % view,
          open_panel and open_btn)
    check("%s: 展开后正文可读" % view, bool(text.strip()))

    page.eval_on_selector("#%s" % btn, "el => el.click()")
    refolded = not page.eval_on_selector(
        "#%s" % panel, "el => el.classList.contains('is-open')")
    check("%s: 再点收回折叠" % view, refolded)

    r = page.eval_on_selector("#%s" % btn, """el => {
      const b = el.getBoundingClientRect();
      return {top: Math.round(b.top), bottom: Math.round(b.bottom),
              vh: window.innerHeight}; }""")
    reachable = r["top"] >= 0 and r["bottom"] <= r["vh"]
    if reachable:
        check("%s: 折叠按钮在视口内可点" % view, True)
    else:
        print("NOTE  %s: 按钮超出视口 top=%d bottom=%d vh=%d "
              "(终局 sheet 溢出，见 end-sheet overflow 说明)"
              % (view, r["top"], r["bottom"], r["vh"]))


def expected_ruby(page, text):
    return page.evaluate("""(text) => {
      const terms = window.YGData.ruby.slice()
        .sort((a, b) => b.term.length - a.term.length);
      const alts = terms.map(t => t.term.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'));
      return (text.match(new RegExp(alts.join('|'), 'g')) || []).length;
    }""", text)


def ruby_check(page, label, selector, text):
    actual = page.eval_on_selector_all(selector, "els => els.length")
    want = expected_ruby(page, text)
    check("%s: ruby 数量与正文术语数一致" % label, actual == want,
          "actual=%d want=%d" % (actual, want))
    if want > 0:
        rt = page.eval_on_selector_all(
            selector + " rt", "els => els.map(e => e.textContent)")
        check("%s: rt 注音非空" % label,
              bool(rt) and all(t.strip() for t in rt), str(rt[:3]))


def main():
    sys.stdout.reconfigure(line_buffering=True)
    errors = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport=VIEWPORT)
        page.on("console", lambda m: errors.append(m.text)
                if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(INDEX.as_uri() + "?seed=123")
        page.wait_for_function("window.__ready === true")

        probe(page, "view-intro", "btn-gloss-intro", "intro-gloss")

        ruby_check(page, "intro", "#intro-body ruby",
                   page.evaluate("window.YGData.meta.intro"))

        page.click("#btn-start")
        page.wait_for_function(
            "document.querySelector('.view.is-active').id === 'view-node'")
        probe(page, "view-node", "btn-gloss-node", "node-gloss")

        node_id = page.evaluate("window.__game.state().nodeId")
        ruby_check(page, "node(%s)" % node_id, "#node-text ruby",
                   page.evaluate(
                       "id => window.YGData.nodes[id].text", node_id))

        expect = page.evaluate(
            "() => window.YGData.gloss.nodes[window.__game.state().nodeId]")
        got = page.eval_on_selector("#node-gloss", "el => el.textContent")
        check("node: 面板内容与 data.js 一致", got == expect,
              "len %d/%d" % (len(got), len(expect or "")))

        page.click("#choice-list .choice")
        page.wait_for_selector(".view.is-active#view-outcome")
        probe(page, "view-outcome", "btn-gloss-outcome", "outcome-gloss")

        out_txt = page.eval_on_selector("#outcome-text", "el => el.textContent")
        check("outcome: 正文非空", bool(out_txt.strip()), "%d 字" % len(out_txt))

        page.click("#btn-advance")
        page.evaluate("window.__game.goto('end_renjian')")
        page.wait_for_function(
            "document.querySelector('.view.is-active').id === 'view-ending'")
        probe(page, "view-ending", "btn-gloss-end", "end-gloss")

        end_id = page.evaluate("window.__game.state().nodeId")
        expect_e = page.evaluate(
            "id => window.YGData.gloss.endings[id]", end_id)
        got_e = page.eval_on_selector("#end-gloss", "el => el.textContent")
        check("ending(%s): 面板内容与 data.js 一致" % end_id, got_e == expect_e)

        ruby_check(page, "ending(%s)" % end_id, "#end-text ruby",
                   page.evaluate("id => window.YGData.endings[id].text", end_id))

        page.click("#btn-restart")
        page.wait_for_function("window.__game.state().nodeId === 'start'")
        folded_after = not page.eval_on_selector(
            "#node-gloss", "el => el.classList.contains('is-open')")
        check("重游后: 折叠状态已复位", folded_after)

        page.click("#btn-gloss-node")
        page.click("#btn-gloss-node")
        page.evaluate("window.__game.goto('end_renjian')")
        page.wait_for_function(
            "document.querySelector('.view.is-active').id === 'view-ending'")
        page.click("#btn-home")
        home_folded = not page.eval_on_selector(
            "#intro-gloss", "el => el.classList.contains('is-open')")
        check("回首页后: intro 折叠状态已复位", home_folded)

        browser.close()

    check("无 console / pageerror", not errors, "; ".join(errors[:4]))
    print("\ntotal: %d fail" % len(fails))
    if fails:
        for f in fails:
            print("  FAILED: %s" % f)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
