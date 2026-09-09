#!/usr/bin/env python3
"""Headless smoke suite for 中秋博饼 (tools/bobing).

三条主线：
  ① 判定内核不回退（judge 九向量 / 特彩优先 / 会饼池 63 / 种子确定性 / 无 Math.random）
  ② 产品流程完整（intro → 入席 → 掷骰 → 揭彩 → 团圆 → 再开一席 + 规则浮层 + 分享降级）
  ③ 画面诚实（WebGL 能力底线显式报错 / 客观渲染指标守住墨金夜宴与朱砂配色）

Run: python3 tests/bobing_smoke.py
"""
import os
import pathlib
import sys

from playwright.sync_api import Error as PWError
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
_default_index = ROOT / "tools" / "bobing" / "index.html"
_target = os.environ.get("BOBING_TARGET")
if _target and _target.startswith("http"):
    BASE = _target.rstrip("/")
    INDEX = _default_index
else:
    INDEX = pathlib.Path(_target or _default_index)
    BASE = INDEX.as_uri()
URL_SEED = BASE + "?seed=123"
URL_DEFAULT = BASE
SHOTS = pathlib.Path("/tmp/bobing_shots")
ASSETS = INDEX.parent / "assets"

WEBGL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

# 实测：SwiftShader 软渲染下，主页存活时再开第二个页会让其 load 事件拖到 42~58s
# （单页仅 3.3s）。默认 30s 不够，别把它调回去。
SEED_GOTO_MS = 120000

# 实测：同一软渲染环境 + 系统争用下，一秀一掷落定实测 69.1s（25s 预算会假失败）。
# 放宽上限不拖慢正常路径 —— wait_for_function 条件一满足就立刻返回。
SETTLE_MS = 90000

CHECKS = []


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok  " if cond else "  FAIL ") + name + ((" | " + extra) if extra and not cond else ""))


def shot(page, name, wait=700):
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.wait_for_timeout(wait)
    page.screenshot(path=str(SHOTS / (name + ".png")))


def ready(page, timeout=20000):
    """本工具没有 window.__ready —— 轮询 window.__bobing 本体就绪。"""
    check("window.__bobing 就绪", _wait(page, "!!window.__bobing", timeout))


def _wait(page, expr, timeout):
    try:
        page.wait_for_function(expr, timeout=timeout)
        return True
    except PWTimeout:
        return False


def _click(page, sel, **kw):
    """点击失败记为 FAIL 而不是抛栈：被遮挡/缺失的元素本身就是要抓的回归。"""
    kw.setdefault("timeout", 10000)
    try:
        page.click(sel, **kw)
        return True
    except (PWTimeout, PWError):
        return False


def _text(page, sel):
    try:
        return page.locator(sel).inner_text(timeout=6000).strip()
    except (PWTimeout, PWError):
        return ""


def wait_phase(page, phase, timeout=SETTLE_MS):
    """sim dt 夹在 0.033，一次落定在 headless 里要好几秒 wall-clock —— 预算必须宽。"""
    return _wait(page, "window.__bobing.phase === '%s'" % phase, timeout)


def state(page):
    return page.evaluate(
        "(function(){var b=window.__bobing;return {phase:b.phase,result:b.result,"
        "resultName:b.resultName,collected:b.collected,intro:b.intro,done:b.done,"
        "seed:b.seed,cakeTotal:b.cakeTotal,time:b.time};})()")


# =========================================================================
# A. 判定内核不回退
# =========================================================================

# 九个测试向量由 assets/engine.js judge() 推导并已核对，勿自行臆造
JUDGE_VECTORS = [
    ([4, 4, 4, 4, 4, 4], "liubeihong", "六抔红 · fours===6"),
    ([4, 4, 4, 4, 1, 1], "jinhua",     "插金花 · fours>=4 && ones===2"),
    ([4, 4, 4, 4, 2, 3], "zhuangyuan", "状元 · fours>=4"),
    ([1, 2, 3, 4, 5, 6], "duitang",    "对堂 · 顺子"),
    ([4, 4, 4, 2, 3, 5], "sanhong",    "三红 · fours===3"),
    ([2, 2, 2, 2, 3, 5], "sijin",      "四进 · maxCount>=4 && kindValue!==4"),
    ([4, 4, 2, 3, 5, 6], "erju",       "二举 · fours===2"),
    ([4, 2, 3, 3, 5, 6], "yixiu",      "一秀 · fours===1"),
    ([2, 3, 5, 6, 6, 3], "none",       "无彩 · fours===0"),
]

BASE_CAKES = {
    "zhuangyuan": 1, "duitang": 2, "sanhong": 4,
    "sijin": 8, "erju": 16, "yixiu": 32,
}


def engine_suite(page):
    page.goto(URL_SEED, timeout=SEED_GOTO_MS)
    ready(page)

    check("hooks exposed (window.__bobing)", page.evaluate("!!window.__bobing"))
    check("QA 面是 __bobing 而非 __game", page.evaluate("!window.__game"))
    check("seed: ?seed=123 -> 123", page.evaluate("window.__bobing.seed") == 123,
          str(page.evaluate("window.__bobing.seed")))

    # ---- judge() 九向量 ----
    for dice, key, why in JUDGE_VECTORS:
        got = page.evaluate("window.__bobing.judge(%s).key" % repr(dice).replace("'", ""))
        check("judge %s -> %s（%s）" % (dice, key, why), got == key, str(got))

    # ---- 特彩优先于基础功名 ----
    prec = page.evaluate(
        "window.__bobing.judge([4,4,4,4,1,1]).key")
    check("优先级: [4,4,4,4,1,1] 不是普通状元（特彩压过基础功名）",
          prec == "jinhua" and prec != "zhuangyuan", str(prec))
    prec6 = page.evaluate("window.__bobing.judge([4,4,4,4,4,4]).key")
    check("优先级: [4,4,4,4,4,4] 不是普通状元（六抔红通吃）",
          prec6 == "liubeihong" and prec6 != "zhuangyuan", str(prec6))

    # ---- 会饼池 63 ----
    tiers = page.evaluate("window.__bobing.TIERS.map(function(t){return {key:t.key,cakes:t.cakes};})")
    by_key = {t["key"]: t["cakes"] for t in tiers}
    for k, want in BASE_CAKES.items():
        check("会饼池: %s = %d 块" % (k, want), by_key.get(k) == want, str(by_key.get(k)))
    pool = sum(by_key.get(k, -999) for k in BASE_CAKES)
    check("六功名会饼池合计 = 63（1+2+4+8+16+32）", pool == 63, str(pool))
    check("CAKE_TOTAL === 63 (__bobing.cakeTotal)", page.evaluate("window.__bobing.cakeTotal") == 63,
          str(page.evaluate("window.__bobing.cakeTotal")))
    check("CAKE_TOTAL === 63 (Bobing.Data)", page.evaluate("window.Bobing.Data.CAKE_TOTAL") == 63,
          str(page.evaluate("window.Bobing.Data.CAKE_TOTAL")))
    check("六抔红 = 通吃全场（cakes 63）", by_key.get("liubeihong") == 63, str(by_key.get("liubeihong")))
    check("无彩 = 0 块", by_key.get("none") == 0, str(by_key.get("none")))


def seed_suite(browser):
    """默认种子 + 同种子双跑确定性（fresh page loads）。"""
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto(URL_DEFAULT, timeout=SEED_GOTO_MS)
    ready(page)
    check("默认种子 = 20260925（无 seed 参数）", page.evaluate("window.__bobing.seed") == 20260925,
          str(page.evaluate("window.__bobing.seed")))
    page.close()

    SEQ_JS = """(function(){
      var E = window.Bobing.Engine, Sc = window.Bobing.Scene, out = [];
      window.__bobing.beginSeat();
      for (var i = 0; i < 6; i++){
        E.S.phase = 'idle';                       /* 同一 evaluate 内原子重置，不走 wall-clock */
        window.__bobing.forceThrow(null);         /* rollDice() 真实路径 */
        out.push({
          key: window.__bobing.result,
          dice: Sc.dice.map(function(d){ return d.val; }),
          thrown: E.S.thrown,
        });
      }
      window.__bobing.resetSeat();
      return out;
    })()"""

    runs = []
    for i in (1, 2):
        p = browser.new_page(viewport={"width": 390, "height": 844})
        p.goto(URL_SEED, timeout=SEED_GOTO_MS)
        ready(p)
        runs.append(p.evaluate(SEQ_JS))
        p.close()

    keys_a = [r["key"] for r in runs[0]]
    keys_b = [r["key"] for r in runs[1]]
    dice_a = [r["dice"] for r in runs[0]]
    dice_b = [r["dice"] for r in runs[1]]
    check("确定性: 同 seed=123 双跑功名序列逐掷一致", keys_a == keys_b,
          "%s vs %s" % (keys_a, keys_b))
    check("确定性: 同 seed=123 双跑骰面逐掷一致", dice_a == dice_b,
          "%s vs %s" % (dice_a, dice_b))
    check("确定性: 六掷骰面全在 1..6", all(1 <= v <= 6 for row in dice_a for v in row),
          str(dice_a))
    check("确定性: judge 与骰面自洽（每一掷 key == judge(dice)）",
          all(page_judge_key(d) == r["key"] for d, r in zip(dice_a, runs[0])),
          str(list(zip(dice_a, keys_a))))
    check("确定性: thrown 计数递增 1..6", [r["thrown"] for r in runs[0]] == [1, 2, 3, 4, 5, 6],
          str([r["thrown"] for r in runs[0]]))

    rng_src = []
    for f in sorted(ASSETS.glob("*.js")):
        txt = f.read_text(encoding="utf-8")
        if "Math.random" in txt:
            rng_src.append(f.name)
    check("assets/*.js 无 Math.random（全部走 mulberry32）", not rng_src, str(rng_src))


def page_judge_key(dice):
    """独立复算 judge 期望值（Python 侧镜像 engine.js，用于自洽交叉验证）。"""
    fours = sum(1 for v in dice if v == 4)
    ones = sum(1 for v in dice if v == 1)
    counts = {}
    for v in dice:
        counts[v] = counts.get(v, 0) + 1
    max_count, kind = 0, 0
    for k in sorted(counts):                       # engine.js 用 for..in，键按插入序但数值小者优先
        if counts[k] > max_count:
            max_count, kind = counts[k], k
    straight = "".join(str(v) for v in sorted(dice)) == "123456"
    if fours == 6:
        return "liubeihong"
    if fours >= 4 and ones == 2:
        return "jinhua"
    if fours >= 4:
        return "zhuangyuan"
    if straight:
        return "duitang"
    if fours == 3:
        return "sanhong"
    if max_count >= 4 and kind != 4:
        return "sijin"
    if fours == 2:
        return "erju"
    if fours == 1:
        return "yixiu"
    return "none"


# =========================================================================
# B. 产品流程
# =========================================================================
def flow_suite(page):
    page.goto(URL_SEED, timeout=SEED_GOTO_MS)
    ready(page)
    page.evaluate("window.__bobing.setCollected(0)")

    # ---- intro ----
    s = state(page)
    check("开场: intro === true", s["intro"] is True, str(s))
    check("开场: #intro 可见", page.locator("#intro").is_visible())
    check("开场: #intro 未加 .off", "off" not in (page.locator("#intro").get_attribute("class") or ""))
    check("开场: #progress 隐藏（未入席不显示进度）",
          "on" not in (page.locator("#progress").get_attribute("class") or "").split())
    check("开场: 竖排介绍 4 行", page.locator("#intro-cols p").count() == 4,
          str(page.locator("#intro-cols p").count()))
    check("开场: 白话规则两行非空",
          len(page.locator("#intro-rule-1").inner_text().strip()) > 8
          and len(page.locator("#intro-rule-2").inner_text().strip()) > 8)
    shot(page, "00-intro", 1400)

    # ---- 入席 ----
    check("开场: #intro-cta 可点击入席", _click(page, "#intro-cta"))
    page.wait_for_timeout(1400)                 # --dur-4 = 1.15s 淡出
    s = state(page)
    check("入席: intro === false", s["intro"] is False, str(s))
    check("入席: #intro 收起 (.off)", "off" in (page.locator("#intro").get_attribute("class") or ""))
    check("入席: #progress 显示 (.on)",
          "on" in (page.locator("#progress").get_attribute("class") or "").split())
    check("入席: 进度数字 0/63", page.locator("#pg-n").inner_text().strip() == "0",
          page.locator("#pg-n").inner_text())
    check("入席: phase = idle", s["phase"] == "idle", str(s))
    shot(page, "01-idle", 1500)

    # ---- 掷骰（状元）----
    page.evaluate("window.__bobing.forceThrow([4,4,4,4,2,3])")
    check("掷骰: 进入 throw 相位", wait_phase(page, "throw"))
    shot(page, "02-throw", 480)
    check("掷骰: phase = throw（骰子在空中）", state(page)["phase"] == "throw")

    check("揭彩①: 落定后进入 reveal 相位", wait_phase(page, "reveal"))
    page.wait_for_timeout(1600)                 # revealLift 缓动 + 金箔绽放到位
    s = state(page)
    check("揭彩: result = zhuangyuan", s["result"] == "zhuangyuan", str(s))
    check("揭彩: resultName = 状元", s["resultName"] == "状元", str(s))
    check("揭彩: collected 恰好 +1（状元一块饼）", s["collected"] == 1, str(s))
    check("揭彩: #reveal.on", "on" in (page.locator("#reveal").get_attribute("class") or "").split())
    check("揭彩: #rv-tier 文案 = 状元", page.locator("#rv-tier").inner_text().strip() == "状元",
          page.locator("#rv-tier").inner_text())
    check("揭彩: 状元走朱砂 (.t-cinnabar)",
          "t-cinnabar" in (page.locator("#reveal").get_attribute("class") or ""))
    check("揭彩: #pg-n 同步为 1", page.locator("#pg-n").inner_text().strip() == "1",
          page.locator("#pg-n").inner_text())
    check("揭彩: 榜单高亮状元一行",
          "on" in (page.locator('#board-list li[data-key="zhuangyuan"]').get_attribute("class") or "").split())
    check("揭彩: #seal.on 印章落下", "on" in (page.locator("#seal").get_attribute("class") or "").split())
    shot(page, "03-reveal-zhuangyuan", 400)

    # ---- 掷骰（一秀）----
    page.evaluate("window.__bobing.forceThrow([4,2,3,3,5,6])")
    check("掷骰②: 进入 throw 相位", wait_phase(page, "throw"))
    check("揭彩②: 落定后进入 reveal 相位", wait_phase(page, "reveal"))
    page.wait_for_timeout(1600)
    s = state(page)
    check("揭彩: result = yixiu", s["result"] == "yixiu", str(s))
    check("揭彩: 一秀 +32 -> collected 33", s["collected"] == 33, str(s))
    check("揭彩: #rv-tier 文案 = 一秀", page.locator("#rv-tier").inner_text().strip() == "一秀",
          page.locator("#rv-tier").inner_text())
    check("揭彩: 一秀不走朱砂",
          "t-cinnabar" not in (page.locator("#reveal").get_attribute("class") or ""))
    shot(page, "04-reveal-yixiu", 400)

    # ---- 团圆 ----
    page.evaluate("window.__bobing.setCollected(62)")
    page.evaluate("window.__bobing.forceThrow([4,4,4,4,2,3])")
    check("团圆前置: 落定后进入 reveal 相位", wait_phase(page, "reveal"))
    s = state(page)
    check("团圆前置: collected 封顶 63（62 + 状元 1）", s["collected"] == 63, str(s))
    check("团圆: done === true", _wait(page, "window.__bobing.done === true", SETTLE_MS),
          str(state(page)))
    check("团圆: #tuanyuan.on",
          "on" in (page.locator("#tuanyuan").get_attribute("class") or "").split())
    check("团圆: #tuanyuan 可见", page.locator("#tuanyuan").is_visible())
    check("团圆: 揭彩卡收起（团圆是终幕）",
          "on" not in (page.locator("#reveal").get_attribute("class") or "").split())
    shot(page, "05-tuanyuan", 1600)

    # ---- 再开一席 ----
    check("团圆: #ty-cta 可点击再开一席", _click(page, "#ty-cta"))
    page.wait_for_timeout(1400)
    s = state(page)
    check("再开一席: collected 归零", s["collected"] == 0, str(s))
    check("再开一席: done === false", s["done"] is False, str(s))
    check("再开一席: intro === true", s["intro"] is True, str(s))
    check("再开一席: #intro 回到台前（无 .off）",
          "off" not in (page.locator("#intro").get_attribute("class") or ""))
    check("再开一席: #tuanyuan 收起",
          "on" not in (page.locator("#tuanyuan").get_attribute("class") or "").split())
    check("再开一席: #cta 重新可点", page.locator("#cta").is_enabled())


# =========================================================================
# C. 理解成本：规则浮层与榜单
# =========================================================================
def rule_suite(page):
    rows = page.locator("#board-list li").count()
    check("榜单: 6 行功名", rows == 6, str(rows))
    board_keys = page.evaluate(
        "[].map.call(document.querySelectorAll('#board-list li'), function(li){return li.dataset.key;})")
    check("榜单: 顺序 = 状元/对堂/三红/四进/二举/一秀",
          board_keys == ["zhuangyuan", "duitang", "sanhong", "sijin", "erju", "yixiu"], str(board_keys))
    board_txt = page.locator("#board-list").inner_text()
    check("榜单: 每行功名与饼数都在（文本非空）", len(board_txt.replace(" ", "")) >= 12, board_txt[:60])
    check("榜单: 每行带饼数（以「饼」结尾）", all(
        page.locator("#board-list li").nth(i).locator(".tc").inner_text().strip().endswith("饼")
        for i in range(rows)))
    check("榜单: 榜头写明会饼六十三", "会饼六十三" in page.locator(".board-head").inner_text())

    # ---- 规则浮层开合 ----
    check("规则: #rule-btn 在位", page.locator("#rule-btn").count() == 1)
    check("规则: 浮层初始收起",
          "on" not in (page.locator("#rule-panel").get_attribute("class") or "").split())
    check("规则: 浮层初始 aria-hidden=true",
          page.locator("#rule-panel").get_attribute("aria-hidden") == "true")

    check("规则: #rule-btn 可点击打开浮层", _click(page, "#rule-btn"))
    page.wait_for_timeout(750)
    check("规则: #rule-btn 点击 -> #rule-panel.on",
          "on" in (page.locator("#rule-panel").get_attribute("class") or "").split())
    check("规则: 打开后 aria-hidden=false",
          page.locator("#rule-panel").get_attribute("aria-hidden") == "false")
    shot(page, "06-rule-panel", 300)

    # ---- 规则正文（浮层展开时读，收起后 inner_text 为空）----
    cells = page.locator("#rule-diagram .die-cell").count()
    check("骰图: 六面骰 6 格", cells == 6, str(cells))
    red_pips = page.locator("#rule-diagram .die-pip.red").count()
    check("骰图: 红点共 5 个（一点 1 + 四点 4）", red_pips == 5, str(red_pips))
    check("骰图: 四点格标 hot",
          "hot" in (page.locator("#die-4").get_attribute("class") or ""))
    check("骰图: 四点格 4 个红点", page.locator("#die-4 .die-pip.red").count() == 4,
          str(page.locator("#die-4 .die-pip.red").count()))

    tr = page.locator("#rule-tier-table tr")
    check("功名表: 6 行", tr.count() == 6, str(tr.count()))
    cakes = page.evaluate(
        "[].map.call(document.querySelectorAll('#rule-tier-table tr td.rt-cake'),"
        "function(td){return parseInt(td.textContent,10);})")
    check("功名表: 饼数逐行 = 1/2/4/8/16/32", cakes == [1, 2, 4, 8, 16, 32], str(cakes))
    check("功名表: 合计 63 块", sum(cakes) == 63, str(sum(cakes)))
    check("功名表: 表头三列", page.locator("#rule-tier-head th").count() == 3,
          str(page.locator("#rule-tier-head th").count()))
    check("功名表: 每行白话条件与判据非空", all(
        len(page.locator("#rule-tier-table tr").nth(i).locator(".rt-plain").inner_text().strip()) > 4
        and len(page.locator("#rule-tier-table tr").nth(i).locator(".rt-note").inner_text().strip()) > 4
        for i in range(tr.count())))
    for eid, label in [("rule-mechanic", "怎么定功名"), ("rule-goal", "为什么是中秋"),
                       ("rule-fun", "乐趣在哪"), ("rule-prog", "进度说明")]:
        check("规则正文: %s 非空" % label,
              len(page.locator("#" + eid).inner_text().strip()) > 12,
              page.locator("#" + eid).inner_text()[:40])

    # ---- 浮层开合 ----
    check("规则: #rule-close 可点击", _click(page, "#rule-close"))
    page.wait_for_timeout(750)
    check("规则: #rule-close 关闭浮层",
          "on" not in (page.locator("#rule-panel").get_attribute("class") or "").split())

    check("规则: 收起后 #rule-btn 仍可再开", _click(page, "#rule-btn"))
    page.wait_for_timeout(750)
    # veil 是全屏背板，中心被 .rule-out 卡片挡住 -> 点在面板左上留白处
    check("规则: #rule-veil 可点击", _click(page, "#rule-veil", position={"x": 6, "y": 6}))
    page.wait_for_timeout(750)
    check("规则: #rule-veil 点击关闭浮层",
          "on" not in (page.locator("#rule-panel").get_attribute("class") or "").split())

    check("规则: 三次打开浮层以备 resetSeat 测试", _click(page, "#rule-btn"))
    page.wait_for_timeout(750)
    page.evaluate("window.__bobing.resetSeat()")
    page.wait_for_timeout(750)
    check("规则: resetSeat() 一并关闭浮层",
          "on" not in (page.locator("#rule-panel").get_attribute("class") or "").split())


# =========================================================================
# D. 分享降级
# =========================================================================
def share_suite(page, errors):
    check("分享: 无端能力（window.xhs.miniTool 缺失）",
          page.evaluate("!(window.xhs && window.xhs.miniTool)"))
    check("分享: #btn-save-album / #btn-post-note 在位",
          page.locator("#btn-save-album").count() == 1 and page.locator("#btn-post-note").count() == 1)

    before = len(errors)
    check("分享: #btn-save-album 可点击", _click(page, "#btn-save-album"))
    page.wait_for_timeout(500)
    check("分享: #btn-post-note 可点击", _click(page, "#btn-post-note"))
    page.wait_for_timeout(500)
    check("端能力缺失时优雅降级（存相册 + 发笔记零报错）",
          len(errors) == before, str(errors[before:]))
    toast = _text(page, "#bobing-toast")
    check("降级提示已给出（toast 非空）", len(toast) > 4, repr(toast))

    card = page.evaluate("window.__bobing.shareCard()")
    check("分享卡: PNG data URL", isinstance(card, str) and card.startswith("data:image/png;base64,"),
          str(card)[:48] if isinstance(card, str) else str(type(card)))
    check("分享卡: 长度 > 20000", len(card) > 20000, str(len(card)))


# =========================================================================
# E. WebGL 能力底线
# =========================================================================
STUB_NO_FLOAT = """
(function(){
  var proto = WebGL2RenderingContext.prototype;
  /* supFmt() 唯一的探测出口就是 checkFramebufferStatus —— 让它一律报不完整，
     于是 RGBA16F / RG16F / R16F 半精度浮点 FBO 全部判定为不可用 */
  proto.checkFramebufferStatus = function(){ return this.FRAMEBUFFER_UNSUPPORTED; };
})();
"""


def capability_suite(browser, errors):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto(URL_SEED, timeout=SEED_GOTO_MS)
    ready(page)
    check("能力底线: #err 默认隐藏（display:none）",
          page.evaluate("getComputedStyle(document.getElementById('err')).display") == "none",
          page.evaluate("getComputedStyle(document.getElementById('err')).display"))
    alive = page.evaluate(
        "(function(){var g=window.Bobing&&window.Bobing.Scene&&window.Bobing.Scene.gl;"
        "if(!g)return {ok:false};return {ok:true,ver:String(g.getParameter(g.VERSION)),"
        "w:g.drawingBufferWidth,h:g.drawingBufferHeight,lost:g.isContextLost()};})()")
    check("能力底线: WebGL2 上下文存活", alive["ok"] is True and alive["lost"] is False, str(alive))
    check("能力底线: 版本串为 WebGL 2", "WebGL 2" in alive.get("ver", ""), str(alive.get("ver")))
    check("能力底线: 绘制缓冲非零尺寸", alive["w"] > 0 and alive["h"] > 0, str(alive))
    page.close()

    # ---- 模拟半精度浮点不可用 ----
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    ctx.add_init_script(STUB_NO_FLOAT)
    deg_errors = []
    dpage = ctx.new_page()
    dpage.on("console", lambda m: deg_errors.append("console: " + m.text) if m.type == "error" else None)
    dpage.on("pageerror", lambda e: deg_errors.append("pageerror: " + str(e)))
    dpage.goto(URL_SEED, timeout=SEED_GOTO_MS)
    check("能力底线: 半精度浮点缺失 -> #err 显式报错",
          _wait(dpage, "getComputedStyle(document.getElementById('err')).display !== 'none'", 20000))
    shown = dpage.evaluate("getComputedStyle(document.getElementById('err')).display")
    check("能力底线: 半精度浮点缺失 -> #err 可见", shown == "flex", str(shown))
    msg = _text(dpage, "#err")
    check("能力底线: #err 文案非空", len(msg) > 0, repr(msg))
    check("能力底线: #err 文案是中文说明",
          "半精度浮点" in msg and "墨金夜宴" in msg, repr(msg))
    check("能力底线: 只抛出预期的能力错误（不静默渲染残缺画面）",
          len(deg_errors) == 1 and "half-float" in deg_errors[0], str(deg_errors))
    check("能力底线: 流体场景未启动（Bobing.Scene 未导出）",
          dpage.evaluate("!(window.Bobing && window.Bobing.Scene)") is True)
    dpage.close()
    ctx.close()


# =========================================================================
# F. 客观渲染指标（无视觉判断，只报数字）
# =========================================================================
FRAMES = ["00-intro", "01-idle", "02-throw", "03-reveal-zhuangyuan",
          "04-reveal-yixiu", "05-tuanyuan"]


def frame_metrics(name):
    from PIL import Image
    im = Image.open(str(SHOTS / (name + ".png"))).convert("RGB")
    im = im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS)   # 降采样 2x
    raw = im.tobytes()
    n = len(raw) // 3
    lum_sum = 0
    levels = set()
    black = 0
    red = 0
    for i in range(0, len(raw), 3):
        r = raw[i]
        g = raw[i + 1]
        b = raw[i + 2]
        lum = (r * 299 + g * 587 + b * 114) // 1000
        lum_sum += lum
        levels.add(lum)
        if r < 8 and g < 8 and b < 8:
            black += 1
        if r > 90 and r > g + 40 and r > b + 40:
            red += 1
    return {
        "name": name,
        "lum": lum_sum / float(n),
        "levels": len(levels),
        "black": 100.0 * black / n,
        "red": 100.0 * red / n,
    }


def metrics_suite():
    print("  %-24s %8s %8s %8s %8s" % ("frame", "lum", "levels", "black%", "red%"))
    m = {}
    for f in FRAMES:
        m[f] = frame_metrics(f)
        d = m[f]
        print("  %-24s %8.2f %8d %8.3f %8.3f" % (d["name"], d["lum"], d["levels"], d["black"], d["red"]))

    idle = m["01-idle"]["lum"]
    for f in ("03-reveal-zhuangyuan", "04-reveal-yixiu"):
        check("结尾即峰值: %s 亮度 > 01-idle（%.2f > %.2f）" % (f, m[f]["lum"], idle),
              m[f]["lum"] > idle, "%.2f vs %.2f" % (m[f]["lum"], idle))

    brightest = max(FRAMES, key=lambda f: m[f]["lum"])
    check("05-tuanyuan 是全序列最亮帧", brightest == "05-tuanyuan",
          "brightest=%s (%.2f), tuanyuan=%.2f" % (brightest, m[brightest]["lum"], m["05-tuanyuan"]["lum"]))

    over = [f for f in FRAMES if m[f]["black"] >= 1.0]
    check("纯黑像素占比 < 1%（墨金夜宴渐变不塌成黑）", not over,
          str([(f, round(m[f]["black"], 3)) for f in over]))

    bad_red = [f for f in FRAMES if not (0.2 <= m[f]["red"] <= 6.0)]
    check("朱砂像素占比 0.2%-6%（配色既不消失也不泛滥）", not bad_red,
          str([(f, round(m[f]["red"], 3)) for f in bad_red]))

    band = [f for f in FRAMES if m[f]["levels"] < 200]
    check("亮度层级 >= 200/256（渐变无 banding）", not band,
          str([(f, m[f]["levels"]) for f in band]))


# =========================================================================
def main():
    errors = []

    def on_console(m):
        if m.type != "error":
            return
        url = (m.location or {}).get("url", "")
        if "favicon" in url:
            return
        errors.append("console: " + m.text + " @ " + url)

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(args=WEBGL_ARGS)
        except Exception:
            browser = p.chromium.launch(channel="chrome", args=WEBGL_ARGS)

        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", on_console)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        print("\n[A] 判定内核不回退")
        engine_suite(page)
        print("\n[A2] 种子与确定性")
        seed_suite(browser)
        print("\n[B] 产品流程")
        flow_suite(page)
        print("\n[C] 规则与榜单")
        rule_suite(page)
        print("\n[D] 分享降级")
        share_suite(page, errors)
        print("\n[E] WebGL 能力底线")
        capability_suite(browser, errors)

        check("无 console / pageerror", len(errors) == 0, str(errors[:6]))
        browser.close()

    print("\n[F] 客观渲染指标（PIL，降采样 2x）")
    metrics_suite()

    failed = [n for n, ok in CHECKS if not ok]
    print("\n%d/%d checks passed" % (len(CHECKS) - len(failed), len(CHECKS)))
    if failed:
        print("FAILED:")
        for n in failed:
            print("  - " + n)
        return 1
    print("screenshots -> " + str(SHOTS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
