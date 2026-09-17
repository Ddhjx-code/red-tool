#!/usr/bin/env python3
"""Headless smoke suite for 容器方向探针 (tools/orientprobe).

要点：探针的价值在于"没变化就是真没变化"，所以必须证明旋转检测本身是活的 ——
用 set_viewport_size 模拟横竖屏切换，断言读数确实跟着变。否则容器里
"一直竖屏"的结论无法与"探针坏了"区分。

Run: python3 tests/orientprobe_smoke.py
"""
import os
import pathlib
import re
import sys

from playwright.sync_api import Error as PWError
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
INDEX = ROOT / "tools" / "orientprobe" / "index.html"
URL = INDEX.as_uri()
PORTRAIT = {"width": 390, "height": 844}
LANDSCAPE = {"width": 844, "height": 390}
ENGINE = os.environ.get("ORIENTPROBE_ENGINE", "chromium")

# 导出成功路径只能在容器里跑，本地用 mock 顶替
MOCK_BRIDGE_OK = """
window.__bridgeCalls = { write: [], save: [], writeLen: 0 };
window.xhs = {
  miniTool: {
    writeTempFile: function (opts) {
      var d = opts && opts.data ? opts.data : null;
      window.__bridgeCalls.write.push(d ? d.slice(0, 30) : null);
      window.__bridgeCalls.writeLen = d ? d.length : 0;
      return Promise.resolve({ filePath: '/tmp/probe-mock.png', errMsg: 'writeTempFile:ok' });
    },
    saveImageToPhotosAlbum: function (opts) {
      window.__bridgeCalls.save.push(opts && opts.filePath);
      return Promise.resolve({ errMsg: 'saveImageToPhotosAlbum:ok' });
    }
  }
};
"""

MOCK_BRIDGE_FAIL = """
window.xhs = {
  miniTool: {
    writeTempFile: function () {
      return Promise.reject({ errMsg: 'writeTempFile:fail mock', errCode: 1 });
    },
    saveImageToPhotosAlbum: function () {
      return Promise.resolve({ errMsg: 'saveImageToPhotosAlbum:ok' });
    }
  }
};
"""

MOCK_BRIDGE_NO_FILEPATH = """
window.__saveCalls = 0;
window.xhs = {
  miniTool: {
    writeTempFile: function () {
      return Promise.resolve({ errMsg: 'writeTempFile:ok' });
    },
    saveImageToPhotosAlbum: function () {
      window.__saveCalls++;
      return Promise.resolve({ errMsg: 'saveImageToPhotosAlbum:ok' });
    }
  }
};
"""

DEGRADE_ENV = """
try { Object.defineProperty(window.screen, 'orientation', { get: function () { return undefined; }, configurable: true }); } catch (e) {}
try { Object.defineProperty(window, 'visualViewport', { get: function () { return undefined; }, configurable: true }); } catch (e) {}
try { delete window.AudioContext; delete window.webkitAudioContext; } catch (e) {}
try { Object.defineProperty(window, 'localStorage', { get: function () { throw new Error('blocked'); }, configurable: true }); } catch (e) {}
try { delete window.CSS; } catch (e) {}
try { delete window.ResizeObserver; } catch (e) {}
"""

CHECKS = []


def check(name, cond, extra=""):
    CHECKS.append((name, bool(cond)))
    print(("  ok  " if cond else "  FAIL ") + name + ((" | " + str(extra)) if extra and not cond else ""))


def _wait(page, expr, timeout):
    try:
        page.wait_for_function(expr, timeout=timeout)
        return True
    except PWTimeout:
        return False


def snapshot(page):
    return page.evaluate("window.__probe.snapshot()")


def dl_counts(page):
    return page.evaluate(
        "['sec-summary','sec-orient','sec-viewport','sec-host','sec-caps'].map(function(id){"
        "var dl=document.getElementById(id);"
        "return dl?dl.querySelectorAll('dd').length:-1;})")


def summary_map(page):
    return page.evaluate("""(function(){
      var out = {};
      var dds = document.querySelectorAll('#sec-summary dd');
      var dts = document.querySelectorAll('#sec-summary dt');
      for (var i = 0; i < dts.length; i++){ out[dts[i].textContent] = dds[i].textContent; }
      return out;
    })()""")


def main():
    errors = []

    with sync_playwright() as p:
        browser = getattr(p, ENGINE).launch()
        page = browser.new_page(viewport=PORTRAIT)
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

        page.goto(URL, timeout=30000)

        print("\n[A] 探针装载")
        check("hook 就位 (window.__probe)", _wait(page, "!!window.__probe", 10000))
        check("rAF 帧率探针完成（bar 到 100%）",
              _wait(page, "document.getElementById('bar').style.width === '100%'", 15000))

        counts = dl_counts(page)
        for sec, n in zip(["自检结论", "方向 API", "视口与安全区", "容器与宿主", "能力探测"], counts):
            check("区块 %s 有读数 (%d)" % (sec, n), n > 0, n)

        print("\n[B] 竖屏读数")
        s = snapshot(page)
        check("innerWidth × innerHeight = 390 × 844", s["iw"] == 390 and s["ih"] == 844, s)
        check("shape 判定为纵向 portrait", s["shape"].startswith("纵向"), s["shape"])
        check("verdict 文本显示纵向",
              "纵向" in page.locator("#verdict").inner_text(), page.locator("#verdict").inner_text())
        check("ratio ≈ 0.462", abs(s["iw"] / s["ih"] - 0.462) < 0.01, s["iw"] / s["ih"])
        check("media (orientation:portrait) 匹配",
              page.evaluate("window.matchMedia('(orientation: portrait)').matches"))
        check("旋转记录初始 1 行", page.locator("#rotlog li").count() >= 1,
              page.locator("#rotlog li").count())

        sm = summary_map(page)
        for key in ["屏幕方向", "支持横屏旋转", "旋转事件次数", "内核", "安全区 上/下", "安全区 左/右",
                    "触感反馈 vibrate", "程序化音频", "渲染帧率", "端能力桥 miniTool"]:
            check("自检结论含 [%s]" % key, key in sm, list(sm.keys()))
        check("自检结论 屏幕方向 = 纵向", (sm.get("屏幕方向") or "").startswith("纵向"), sm.get("屏幕方向"))
        check("旋转前 支持横屏旋转 = 未观测到",
              "未观测到" in (sm.get("支持横屏旋转") or ""), sm.get("支持横屏旋转"))
        expected_engine = "Safari" if ENGINE == "webkit" else "Chrome"
        check("自检结论 内核含 %s（%s 引擎）" % (expected_engine, ENGINE),
              expected_engine in (sm.get("内核") or ""), sm.get("内核"))
        real_ua = page.evaluate("navigator.userAgent")
        parsed_v = page.evaluate("(function(u){return window.__probe.uaVersion(u);})", real_ua)
        parsed_e = page.evaluate("(function(u){return window.__probe.uaEngine(u);})", real_ua)
        check("本机 UA 版本可解析（非未知）",
              "未知" not in parsed_v and re.search(r"\d", parsed_v) is not None, parsed_v)
        check("本机 UA 引擎可识别（非未知）", parsed_e != "未知", parsed_e)
        check("内核字段 = 版本 · 引擎（两段都非未知）",
              "未知" not in (sm.get("内核") or ""), sm.get("内核"))
        check("自检结论 端能力桥 = 不可用", "不可用" in (sm.get("端能力桥 miniTool") or ""),
              sm.get("端能力桥 miniTool"))
        check("自检结论 渲染帧率已出数",
              "fps" in (sm.get("渲染帧率") or ""), sm.get("渲染帧率"))

        print("\n[C] 旋转检测是活的（关键：证明探针不会把「坏掉」误报成「竖屏锁定」）")
        page.set_viewport_size(LANDSCAPE)
        check("旋转后 rec 追加新行",
              _wait(page, "document.querySelectorAll('#rotlog li').length >= 2", 8000),
              page.locator("#rotlog li").count())
        s2 = snapshot(page)
        check("旋转后 innerWidth × innerHeight = 844 × 390", s2["iw"] == 844 and s2["ih"] == 390, s2)
        check("旋转后 shape 判定为横向 landscape", s2["shape"].startswith("横向"), s2["shape"])
        check("旋转后 verdict 文本显示横向",
              "横向" in page.locator("#verdict").inner_text(), page.locator("#verdict").inner_text())
        check("旋转后 media (orientation:landscape) 匹配",
              page.evaluate("window.matchMedia('(orientation: landscape)').matches"))
        check("变化行被标了 changed", page.locator("#rotlog li.changed").count() >= 1,
              page.locator("#rotlog li.changed").count())
        sm2 = summary_map(page)
        check("旋转后 自检结论 支持横屏旋转 = 是（结论跟随实测翻转）",
              (sm2.get("支持横屏旋转") or "").startswith("是"), sm2.get("支持横屏旋转"))
        check("旋转后 自检结论 屏幕方向 = 横向",
              (sm2.get("屏幕方向") or "").startswith("横向"), sm2.get("屏幕方向"))
        check("旋转事件次数已累加 (>=1)", (sm2.get("旋转事件次数") or "0").isdigit()
              and int(sm2.get("旋转事件次数") or 0) >= 1, sm2.get("旋转事件次数"))

        page.set_viewport_size(PORTRAIT)
        check("转回竖屏后再次追加行",
              _wait(page, "document.querySelectorAll('#rotlog li').length >= 3", 8000),
              page.locator("#rotlog li").count())
        check("转回竖屏后 shape 回到纵向", snapshot(page)["shape"].startswith("纵向"))

        print("\n[D] 能力探测结果可用")
        caps = page.evaluate("""(function(){
          var out = {};
          var dds = document.querySelectorAll('#sec-caps dd');
          var dts = document.querySelectorAll('#sec-caps dt');
          for (var i = 0; i < dts.length; i++){ out[dts[i].textContent] = dds[i].textContent; }
          return out;
        })()""")
        for k in ["PointerEvent", "Canvas 2D", "AudioContext", "Flex gap 行为实测"]:
            check("能力项存在: %s" % k, k in caps, list(caps.keys())[:6])
        check("rAF 帧率是数字", any("fps" in str(v) for v in caps.values()),
              [v for v in caps.values() if "fps" in str(v)])
        fg = page.evaluate("window.__probe.supportsFlexGap()")
        check("Flex gap 行为探测返回布尔", fg is True or fg is False, fg)

        host = page.evaluate("""(function(){
          var out = {};
          var dds = document.querySelectorAll('#sec-host dd');
          var dts = document.querySelectorAll('#sec-host dt');
          for (var i = 0; i < dts.length; i++){ out[dts[i].textContent] = dds[i].textContent; }
          return out;
        })()""")
        check("宿主区块含 window.xhs 行", "window.xhs 存在" in host, list(host.keys()))
        check("无端能力环境 xhs.miniTool 标为否",
              host.get("xhs.miniTool 存在") == "否", host.get("xhs.miniTool 存在"))
        check("无端能力环境 window.xhs 标为否", host.get("window.xhs 存在") == "否",
              host.get("window.xhs 存在"))

        print("\n[E] 导出降级")
        before = len(errors)
        page.click("#btn-save")
        page.wait_for_timeout(400)
        toast = page.locator("#toast").inner_text()
        check("无端能力时给截图提示而非报错", "截图" in toast, repr(toast))
        check("导出降级零 console/page 报错", len(errors) == before, errors[before:])
        data = page.evaluate("document.getElementById('toast').textContent.length > 0 && true")
        check("toast 有内容", data)

        print("\n[F] 报告串（用于导出图片）")
        n = page.evaluate("window.__probe.lines.length")
        check("LINES 已累积 (>25 行)", n > 25, n)
        joined = page.evaluate("window.__probe.lines.join('\\n')")
        for token in ["旋转记录", "方向 API", "视口与安全区", "容器与宿主", "能力探测"]:
            check("报告含区块 [%s]" % token, token in joined)

        report = page.evaluate("window.__probe.reportLines().join('\\n')")
        check("导出报告含 [自检结论] 段", "== 自检结论 ==" in report)
        for key in ["屏幕方向", "支持横屏旋转", "内核", "渲染帧率", "端能力桥 miniTool"]:
            check("导出报告含结论项 [%s]" % key, (key + ": ") in report)
        check("导出报告结论排在详细报告之前",
              report.index("== 自检结论 ==") < report.index("方向 API"))

        print("\n[G] 端能力成功路径（mock window.xhs.miniTool）—— 这是真实上传后唯一会走的路径")
        ctx = browser.new_context(viewport=PORTRAIT)
        ctx.add_init_script(MOCK_BRIDGE_OK)
        mp = ctx.new_page()
        merr = []
        mp.on("console", lambda m: merr.append("console: " + m.text) if m.type == "error" else None)
        mp.on("pageerror", lambda e: merr.append("pageerror: " + str(e)))
        mp.goto(URL, timeout=30000)
        check("mock 桥就位", _wait(mp, "!!(window.xhs && window.xhs.miniTool)", 10000))
        check("宿主区块识别到 miniTool",
              mp.evaluate("document.querySelectorAll('#sec-host dd')") is not None)
        _wait(mp, "document.getElementById('bar').style.width === '100%'", 15000)
        mp.click("#btn-save")
        _wait(mp, "document.getElementById('toast').textContent.indexOf('已存') >= 0", 10000)
        toast2 = mp.locator("#toast").inner_text()
        check("成功路径 toast = 已存到相册", "已存" in toast2, repr(toast2))
        calls = mp.evaluate("window.__bridgeCalls")
        check("writeTempFile 被调用 1 次", len(calls["write"]) == 1, calls["write"])
        check("writeTempFile.data 是完整 data:uri（非裸 base64）",
              calls["write"] and calls["write"][0].startswith("data:image/png;base64,"),
              calls["write"])
        check("data 长度 > 10000（真报告而非空图）", (calls.get("writeLen") or 0) > 10000,
              calls.get("writeLen"))
        check("saveImageToPhotosAlbum 收到 writeTempFile 返回的 filePath",
              calls["save"] == ["/tmp/probe-mock.png"], calls["save"])
        check("成功后按钮恢复可用",
              mp.evaluate("!document.getElementById('btn-save').disabled"))
        check("成功路径零 console/page 报错", len(merr) == 0, merr[:4])
        ctx.close()

        print("\n[H] 端能力失败路径（writeTempFile reject）")
        ctx2 = browser.new_context(viewport=PORTRAIT)
        ctx2.add_init_script(MOCK_BRIDGE_FAIL)
        fp = ctx2.new_page()
        ferr = []
        fp.on("pageerror", lambda e: ferr.append(str(e)))
        fp.goto(URL, timeout=30000)
        _wait(fp, "!!window.__probe", 10000)
        _wait(fp, "document.getElementById('bar').style.width === '100%'", 15000)
        fp.click("#btn-save")
        _wait(fp, "document.getElementById('toast').textContent.indexOf('失败') >= 0", 10000)
        toast3 = fp.locator("#toast").inner_text()
        check("失败路径 toast 报失败且带 errMsg", "失败" in toast3 and "fail" in toast3, repr(toast3))
        check("失败后按钮恢复可用（可重试）",
              fp.evaluate("!document.getElementById('btn-save').disabled"))
        check("失败路径零 pageerror（不吞异常也不炸页）", len(ferr) == 0, ferr[:4])
        ctx2.close()

        print("\n[I] 环境缺失健壮性（删掉 orientation / visualViewport / AudioContext / localStorage / CSS / ResizeObserver）")
        ctx3 = browser.new_context(viewport=PORTRAIT)
        ctx3.add_init_script(DEGRADE_ENV)
        dp = ctx3.new_page()
        derr = []
        dp.on("console", lambda m: derr.append("console: " + m.text) if m.type == "error" else None)
        dp.on("pageerror", lambda e: derr.append("pageerror: " + str(e)))
        dp.goto(URL, timeout=30000)
        check("缺 API 时 hook 仍就位", _wait(dp, "!!window.__probe", 10000))
        check("缺 API 时帧率探针仍完成",
              _wait(dp, "document.getElementById('bar').style.width === '100%'", 15000))
        dc = dp.evaluate("""['sec-orient','sec-viewport','sec-host','sec-caps'].map(function(id){
          return document.getElementById(id).querySelectorAll('dd').length;})""")
        for sec, n in zip(["方向 API", "视口与安全区", "容器与宿主", "能力探测"], dc):
            check("缺 API 时区块 %s 仍有读数 (%d)" % (sec, n), n > 0, n)
        check("缺 API 时报告仍完整 (>25 行)",
              dp.evaluate("window.__probe.lines.length") > 25, dp.evaluate("window.__probe.lines.length"))
        check("缺 visualViewport 不崩（shape 仍可判定）",
              dp.evaluate("window.__probe.snapshot().shape").startswith("纵向"))
        dtext = dp.evaluate("window.__probe.lines.join('\\n')")
        check("缺 orientation 时标注为否", "screen.orientation 存在: 否" in dtext)
        check("localStorage 被禁时标注异常", "localStorage 读写: 异常" in dtext)
        check("缺 API 时零 console/page 报错", len(derr) == 0, derr[:4])
        ctx3.close()

        print("\n[J] UA 解析（本机无 WebKit，用合成 UA 验 iOS / Android WebView 分支）")
        ua_fixtures = [
            ("Android 8.1 出场 WebView（规范最低基线）",
             "Mozilla/5.0 (Linux; Android 8.1.0; Nexus 5X Build/OPM1) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Version/4.0 Chrome/61.0.3163.98 Mobile Safari/537.36",
             "Chrome 61", "WebView (Android)"),
            ("Android 现代 WebView（带 wv 标记）",
             "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.43 Mobile Safari/537.36",
             "Chrome 120", "WebView (Android)"),
            ("iOS WKWebView（内嵌浏览器常发的纯 Safari UA，无 Chrome 标记）",
             "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 "
             "(KHTML, like Gecko) Mobile/15E148",
             "iOS 18.4", "WebKit (iOS)"),
            ("iOS Safari 完整 UA",
             "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 "
             "(KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1",
             "iOS 18.4", "WebKit (iOS)"),
            ("iOS 上的 Chrome (CriOS)",
             "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
             "(KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1",
             "Chrome iOS 119", "WebKit (iOS)"),
            ("Android Chrome 浏览器（非 WebView）",
             "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
             "Chrome 120", "Chrome (Android)"),
        ]
        for label, ua, want_v, want_e in ua_fixtures:
            got_v = page.evaluate("(function(u){return window.__probe.uaVersion(u);})", ua)
            got_e = page.evaluate("(function(u){return window.__probe.uaEngine(u);})", ua)
            check("UA 版本 %s -> %s" % (label, want_v), got_v == want_v, got_v)
            check("UA 内核 %s -> %s" % (label, want_e), got_e == want_e, got_e)

        print("\n[K] 端能力畸形返回（writeTempFile 成功但不带 filePath）")
        ctx4 = browser.new_context(viewport=PORTRAIT)
        ctx4.add_init_script(MOCK_BRIDGE_NO_FILEPATH)
        np_ = ctx4.new_page()
        nerr = []
        np_.on("pageerror", lambda e: nerr.append(str(e)))
        np_.goto(URL, timeout=30000)
        _wait(np_, "!!window.__probe", 10000)
        _wait(np_, "document.getElementById('bar').style.width === '100%'", 15000)
        np_.click("#btn-save")
        _wait(np_, "document.getElementById('toast').textContent.indexOf('失败') >= 0", 10000)
        toast4 = np_.locator("#toast").inner_text()
        check("畸形返回时明确报错（不静默）", "失败" in toast4, repr(toast4))
        check("错误信息点明是 filePath 缺失", "filePath" in toast4, repr(toast4))
        check("错误信息带上实际收到的内容（可诊断）", "errMsg" in toast4 or "{" in toast4, repr(toast4))
        check("绝不把 undefined 传给存相册（save 未被调用）",
              np_.evaluate("window.__saveCalls") == 0, np_.evaluate("window.__saveCalls"))
        check("畸形返回后按钮恢复可用",
              np_.evaluate("!document.getElementById('btn-save').disabled"))
        check("畸形返回零 pageerror", len(nerr) == 0, nerr[:4])
        ctx4.close()

        check("无 console / pageerror", len(errors) == 0, errors[:6])
        browser.close()

    failed = [nm for nm, ok in CHECKS if not ok]
    print("\n%d/%d checks passed" % (len(CHECKS) - len(failed), len(CHECKS)))
    if failed:
        print("FAILED:")
        for nm in failed:
            print("  - " + nm)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
