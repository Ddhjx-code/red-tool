#!/usr/bin/env python3
"""月宫一夜 DOM 冒烟回归 (tools/yuegong)。

三条主线：
  ① 容器合规（index.html 零内联脚本 / 零内联事件 / 脚本加载顺序 / assets 无 ambient 随机）
  ② 真实用户路径（DOM 点击 btn-start -> .choice[i] -> btn-advance）逐步断言视图切换
  ③ DOM 视图与引擎状态互相印证（nodeId 是终局 -> view-ending，否则 -> view-node）

为什么必须走 DOM 而不是只读 window.__game.state().nodeId：
nodeId 在 YGEngine.choose() 内部就前进了，与界面无关。render() 在 outcome 相位是
空转分支，所以任何让 advance() 绕道 render() 的实现都会把真人永久卡在结算页，而
只读 nodeId 的断言全部照样通过。只有断言 .view 的 is-active 才能抓住这类回归。

Run: python3 tests/yuegong_smoke.py
"""
import pathlib
import re
import sys

from playwright.sync_api import Error as PWError
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
YUEGONG = ROOT / "tools" / "yuegong"
INDEX = YUEGONG / "index.html"
PROTOTYPE = YUEGONG / "prototype.html"
ASSETS = YUEGONG / "assets"

VIEWPORT = {"width": 390, "height": 844}

READY_MS = 60000
# 首帧前留足时间让 Canvas 起帧 + 字体落定，否则第一次点击可能撞上还没挂好的监听
SETTLE_MS = 2500
# choose() 与 advance() 各自把 locked 置位 320ms，期间再点会被静默丢弃，
# 表现为「点了没反应」的假失败 —— 每次点击后的 dwell 必须明显大于这个互斥窗口。
CLICK_DWELL_MS = 600
VIEW_TIMEOUT_MS = 10000

ACT_VIEW_JS = (
    "(function(){var v=document.querySelectorAll('.view'),o=[];"
    "for(var i=0;i<v.length;i++)if(v[i].classList.contains('is-active'))o.push(v[i].id);"
    "return o.join(',')||'(none)'})()"
)

VIEWS = ["view-intro", "view-node", "view-outcome", "view-ending"]
SCRIPT_ORDER = ["data", "rng", "engine", "audio", "scene", "share", "main"]

# choice 索引序列（已核对 data.js 可达）：最后一步必定落在终局
ENDINGS = [
    ("end_renjian", [1, 0]),
    ("end_weiru", [2, 1, 0, 0]),
    ("end_nichang", [0, 0, 1, 0, 0, 0, 1]),
    ("end_banyue", [0, 0, 1, 1, 0, 0, 1]),
    ("end_buyun", [0, 0, 1, 2, 0, 0, 0]),
]

INLINE_HANDLER_RE = re.compile(r"\bon(?:click|load|error|input|change|touchstart)\s*=", re.I)
SCRIPT_TAG_RE = re.compile(r"<script\b[^>]*>", re.I)
SCRIPT_SRC_RE = re.compile(r"""src\s*=\s*["']([^"']+)["']""", re.I)
MODULE_RE = re.compile(r"^\s*(?:import|export)\b", re.M)
# prototype.html 把整段脚本裹在 IIFE 里，YGEngine 不是全局，终局 id 只能从数据源静态取
ENDING_ID_RE = re.compile(r"\bend_[a-z]+\b")

CHECKS = []


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  PASS  " if cond else "  FAIL ") + name + ((" | " + extra) if extra and not cond else ""))


def _dom_click(page, expr):
    """点击失败记为 FAIL 而不是抛栈：元素缺失本身就是回归信号。"""
    try:
        page.evaluate(expr)
    except PWError:
        page.wait_for_timeout(CLICK_DWELL_MS)
        return False
    page.wait_for_timeout(CLICK_DWELL_MS)
    return True


def click_button(page, eid):
    return _dom_click(page, "document.getElementById('%s').click()" % eid)


def click_choice(page, i):
    return _dom_click(page, "document.querySelectorAll('#choice-list .choice')[%d].click()" % i)


def active_view(page):
    return page.evaluate(ACT_VIEW_JS)


def state(page):
    return page.evaluate("window.__game.state()")


def is_ending(page, ending_ids):
    return state(page)["nodeId"] in ending_ids


def choice_text(page, i):
    try:
        return page.locator("#choice-list .choice").nth(i).inner_text(timeout=VIEW_TIMEOUT_MS).strip()
    except PWError:
        return ""


def text_of(page, sel):
    try:
        return page.locator(sel).inner_text(timeout=VIEW_TIMEOUT_MS).strip()
    except PWError:
        return ""


def advance_label(page):
    return text_of(page, "#btn-advance")


def assert_view(page, want, label):
    view = active_view(page)
    check("%s: 视图切到 %s" % (label, want), view == want, view)


def cross_check(page, ending_ids, label):
    """DOM 视图与引擎状态互证 —— 本套件的核心保证。

    nodeId 是终局就必须显示 view-ending，否则 advance 之后必须落在 view-node。
    两边不一致说明引擎已前进而界面没跟上，正是真人被永久卡在结算页的那类回归。"""
    view = active_view(page)
    node_id = state(page)["nodeId"]
    end = node_id in ending_ids
    want = "view-ending" if end else "view-node"
    check("%s: DOM 视图与 nodeId 一致（%s -> %s）" % (label, "终局" if end else "进行中", want),
          view == want, "view=%s nodeId=%s" % (view, node_id))


# =========================================================================
# A. 容器合规
# =========================================================================
def container_suite():
    html = INDEX.read_text(encoding="utf-8")
    tags = SCRIPT_TAG_RE.findall(html)
    inline = [t for t in tags if "src=" not in t.lower()]
    check("index.html: 内联 <script> 块 = 0（只允许 <script src=...>）", not inline, str(inline))
    check("index.html: <script src=...> 共 %d 个" % len(SCRIPT_ORDER), len(tags) == len(SCRIPT_ORDER),
          str(len(tags)))

    srcs = []
    for t in tags:
        m = SCRIPT_SRC_RE.search(t)
        if m:
            srcs.append(pathlib.PurePosixPath(m.group(1).split("?")[0]).stem)
    check("index.html: 脚本加载顺序 = %s" % ",".join(SCRIPT_ORDER), srcs == SCRIPT_ORDER, str(srcs))

    handlers = INLINE_HANDLER_RE.findall(html)
    check("index.html: 内联事件处理器 = 0（onclick/onload/onerror/oninput/onchange/ontouchstart）",
          not handlers, str(handlers))

    check("index.html: 四个视图区块齐备", all(('id="%s"' % v) in html for v in VIEWS))
    check("index.html: 真人可点的按钮齐备",
          all(('id="%s"' % b) in html for b in ("btn-start", "btn-advance", "btn-restart", "btn-home")))

    js_files = sorted(ASSETS.glob("*.js"))
    want_files = sorted("%s.js" % s for s in SCRIPT_ORDER)
    check("assets/*.js 七个模块齐备", [f.name for f in js_files] == want_files,
          str([f.name for f in js_files]))

    offenders = {}
    for f in js_files + [INDEX]:
        txt = f.read_text(encoding="utf-8")
        hits = []
        for label, needle in (("eval", "eval("), ("newFunction", "new Function("),
                              ("http", "http://"), ("https", "https://"),
                              ("MathRandom", "Math.random"), ("DEBUG_PASS", "DEBUG_PASS")):
            if needle in txt:
                hits.append(label)
        if MODULE_RE.search(txt):
            hits.append("esmodule")
        if hits:
            offenders[f.name] = hits
    check("index.html + assets/*.js: 无 eval / new Function / 外链 / ES module / Math.random / DEBUG_PASS",
          not offenders, str(offenders))

    check("assets/style.css 存在", (ASSETS / "style.css").exists())


# =========================================================================
# B. 真实用户路径：开场 -> 节点 -> 结算 -> 终局
# =========================================================================
def open_page(browser, path, tag, errors):
    """固定 seed 保证确定性；清掉残留后 reload，避免跨轮污染。

    监听器必须在 goto 之前挂上，否则首屏加载期的报错会漏掉。"""
    page = browser.new_page(viewport=VIEWPORT)
    page.on("console",
            lambda m: errors.append("%s console: %s" % (tag, m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("%s pageerror: %s" % (tag, e)))
    page.goto(path.as_uri() + "?seed=123")
    page.wait_for_function("window.__ready === true", timeout=READY_MS)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_function("window.__ready === true", timeout=READY_MS)
    page.wait_for_timeout(SETTLE_MS)
    return page


def intro_suite(page, tag):
    check("%s: 开场视图 = view-intro" % tag, active_view(page) == "view-intro", active_view(page))
    check("%s: 开场 nodeId = start" % tag, state(page)["nodeId"] == "start", str(state(page)))
    check("%s: 开场标题非空" % tag, len(text_of(page, "#intro-title")) > 0, repr(text_of(page, "#intro-title")))
    check("%s: #btn-start 可见" % tag, page.locator("#btn-start").is_visible())
    check("%s: hooks 暴露 (window.__game)" % tag, bool(page.evaluate("!!window.__game")))
    check("%s: ?seed=123 -> 123" % tag, page.evaluate("window.__game.seed()") == 123,
          str(page.evaluate("window.__game.seed()")))


def advance_regression_probe(page, ending_ids, tag):
    """最短复现路径：一次选择后点「继续」必须离开结算页。

    advance() 只要绕道 render()，render() 的 outcome 空转分支就会吞掉这次跳转，
    真人从此再也走不到下一节点。"""
    page.evaluate("window.__game.reset()")
    page.wait_for_timeout(CLICK_DWELL_MS)
    check("%s/探针: reset() 回到 view-intro" % tag, active_view(page) == "view-intro", active_view(page))

    check("%s/探针: #btn-start 可点" % tag, click_button(page, "btn-start"))
    assert_view(page, "view-node", "%s/探针 btn-start 后" % tag)
    cross_check(page, ending_ids, "%s/探针 btn-start 后" % tag)

    check("%s/探针: .choice[0] 可点" % tag, click_choice(page, 0))
    assert_view(page, "view-outcome", "%s/探针 choose 后" % tag)
    check("%s/探针: 结算页正文非空" % tag, len(text_of(page, "#outcome-text")) > 0,
          repr(text_of(page, "#outcome-text")))

    check("%s/探针: #btn-advance 可点" % tag, click_button(page, "btn-advance"))
    check("%s/探针: advance() 离开结算页（不被 render() 的 outcome 分支吞掉）" % tag,
          active_view(page) != "view-outcome", active_view(page))
    cross_check(page, ending_ids, "%s/探针 advance 后" % tag)


def walk_ending(page, ending_ids, tag, end_id, seq):
    label = "%s/%s" % (tag, end_id)
    page.evaluate("window.__game.reset()")
    page.wait_for_timeout(CLICK_DWELL_MS)
    check("%s 复位: view-intro" % label, active_view(page) == "view-intro", active_view(page))
    check("%s 复位: nodeId = start" % label, state(page)["nodeId"] == "start", str(state(page)))

    check("%s 开局: #btn-start 可点" % label, click_button(page, "btn-start"))
    assert_view(page, "view-node", "%s 开局" % label)
    cross_check(page, ending_ids, "%s 开局" % label)

    for step, i in enumerate(seq, 1):
        last = step == len(seq)
        n = page.locator("#choice-list .choice").count()
        check("%s 第%d步: choice[%d] 在位（该节点共 %d 个选项）" % (label, step, i, n), n > i, str(n))
        check("%s 第%d步: choice[%d] 可见" % (label, step, i),
              page.locator("#choice-list .choice").nth(i).is_visible())
        check("%s 第%d步: choice[%d] 文案非空" % (label, step, i), len(choice_text(page, i)) > 0,
              repr(choice_text(page, i)))

        check("%s 第%d步: 点击 choice[%d]" % (label, step, i), click_choice(page, i))
        assert_view(page, "view-outcome", "%s 第%d步 choose 后" % (label, step))
        check("%s 第%d步: 结算页正文非空" % (label, step), len(text_of(page, "#outcome-text")) > 0,
              repr(text_of(page, "#outcome-text")))

        want_label = "天 将 明" if is_ending(page, ending_ids) else "继 续"
        got_label = advance_label(page)
        check("%s 第%d步: #btn-advance 文案 = %s" % (label, step, want_label),
              got_label == want_label, got_label)

        check("%s 第%d步: 点击 #btn-advance" % (label, step), click_button(page, "btn-advance"))
        assert_view(page, "view-ending" if last else "view-node", "%s 第%d步 advance 后" % (label, step))
        cross_check(page, ending_ids, "%s 第%d步 advance 后" % (label, step))
        if not last:
            check("%s 第%d步: 节点标题非空" % (label, step), len(text_of(page, "#node-title")) > 0,
                  repr(text_of(page, "#node-title")))
            check("%s 第%d步: 步数计数非空" % (label, step), len(text_of(page, "#node-step")) > 0,
                  repr(text_of(page, "#node-step")))

    got = state(page)["nodeId"]
    check("%s 终局: nodeId = %s" % (label, end_id), got == end_id, str(got))
    check("%s 终局: view-ending 在台前" % label, active_view(page) == "view-ending", active_view(page))
    check("%s 终局: 结局名非空" % label, len(text_of(page, "#end-name")) > 0, repr(text_of(page, "#end-name")))
    check("%s 终局: 结局条件非空" % label, len(text_of(page, "#end-cond")) > 0, repr(text_of(page, "#end-cond")))
    check("%s 终局: 统计行非空" % label, len(text_of(page, "#end-stats")) > 0, repr(text_of(page, "#end-stats")))
    check("%s 终局: 结局清单 %d 枚 chip" % (label, len(ENDINGS)),
          page.locator("#endings-list .ending-chip").count() == len(ENDINGS),
          str(page.locator("#endings-list .ending-chip").count()))
    check("%s 终局: 本次结局 chip 标 got" % label,
          page.locator("#endings-list .ending-chip.got").count() >= 1,
          str(page.locator("#endings-list .ending-chip.got").count()))


def ending_buttons_suite(page, ending_ids, tag):
    """终幕上还有两个真人可点的转换：再游一夜 -> view-node，回首页 -> view-intro。"""
    end_id, seq = ENDINGS[0]
    page.evaluate("window.__game.reset()")
    page.wait_for_timeout(CLICK_DWELL_MS)
    check("%s/终幕按钮: #btn-start 可点" % tag, click_button(page, "btn-start"))
    assert_view(page, "view-node", "%s/终幕按钮 开局" % tag)
    for step, i in enumerate(seq, 1):
        last = step == len(seq)
        check("%s/终幕按钮 首游第%d步: 点击 choice[%d]" % (tag, step, i), click_choice(page, i))
        assert_view(page, "view-outcome", "%s/终幕按钮 首游第%d步 choose 后" % (tag, step))
        check("%s/终幕按钮 首游第%d步: 点击 #btn-advance" % (tag, step), click_button(page, "btn-advance"))
        assert_view(page, "view-ending" if last else "view-node",
                    "%s/终幕按钮 首游第%d步 advance 后" % (tag, step))
        cross_check(page, ending_ids, "%s/终幕按钮 首游第%d步 advance 后" % (tag, step))
    check("%s/终幕按钮: 已走到 %s" % (tag, end_id),
          active_view(page) == "view-ending" and state(page)["nodeId"] == end_id,
          "%s %s" % (active_view(page), state(page)["nodeId"]))

    check("%s/终幕按钮: #btn-restart 可点" % tag, click_button(page, "btn-restart"))
    assert_view(page, "view-node", "%s/终幕按钮 btn-restart 后" % tag)
    cross_check(page, ending_ids, "%s/终幕按钮 btn-restart 后" % tag)
    check("%s/终幕按钮: 重游回到开局 nodeId = start" % tag, state(page)["nodeId"] == "start",
          str(state(page)))

    for step, i in enumerate(seq, 1):
        last = step == len(seq)
        check("%s/终幕按钮 重游第%d步: 点击 choice[%d]" % (tag, step, i), click_choice(page, i))
        assert_view(page, "view-outcome", "%s/终幕按钮 重游第%d步 choose 后" % (tag, step))
        check("%s/终幕按钮 重游第%d步: 点击 #btn-advance" % (tag, step), click_button(page, "btn-advance"))
        assert_view(page, "view-ending" if last else "view-node",
                    "%s/终幕按钮 重游第%d步 advance 后" % (tag, step))
        cross_check(page, ending_ids, "%s/终幕按钮 重游第%d步 advance 后" % (tag, step))
    check("%s/终幕按钮: 重游后仍能回到 %s" % (tag, end_id),
          active_view(page) == "view-ending" and state(page)["nodeId"] == end_id,
          "%s %s" % (active_view(page), state(page)["nodeId"]))

    check("%s/终幕按钮: #btn-home 可点" % tag, click_button(page, "btn-home"))
    assert_view(page, "view-intro", "%s/终幕按钮 btn-home 后" % tag)
    check("%s/终幕按钮: 回首页只切视图，nodeId 仍停在终局" % tag, is_ending(page, ending_ids) is True,
          str(state(page)))


def dom_suite(browser, path, tag, errors):
    ending_ids = set(ENDING_ID_RE.findall(path.read_text(encoding="utf-8")))
    if tag == "index":
        ending_ids |= set(ENDING_ID_RE.findall((ASSETS / "data.js").read_text(encoding="utf-8")))
    check("%s: 数据源里的终局 id 集合 = 五个结局" % tag, ending_ids == {e for e, _ in ENDINGS},
          str(sorted(ending_ids)))

    page = open_page(browser, path, tag, errors)
    intro_suite(page, tag)
    advance_regression_probe(page, ending_ids, tag)
    for end_id, seq in ENDINGS:
        walk_ending(page, ending_ids, tag, end_id, seq)
    ending_buttons_suite(page, ending_ids, tag)
    page.close()


# =========================================================================
def main():
    errors = []

    print("\n[A] 容器合规（index.html + assets/*.js）")
    container_suite()

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            browser = p.chromium.launch(channel="chrome")

        print("\n[B] 真实用户路径 · tools/yuegong/index.html")
        dom_suite(browser, INDEX, "index", errors)
        print("\n[C] 真实用户路径 · tools/yuegong/prototype.html")
        dom_suite(browser, PROTOTYPE, "prototype", errors)

        check("无 console / pageerror", not errors, str(errors[:6]))
        browser.close()

    failed = [n for n, ok in CHECKS if not ok]
    print("\ntotal: %d pass / %d fail" % (len(CHECKS) - len(failed), len(failed)))
    if failed:
        print("FAILED:")
        for n in failed:
            print("  - " + n)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
