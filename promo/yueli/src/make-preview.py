#!/usr/bin/env python3
"""从真实小工具生成预览壳，避免维护一份会走样的 HTML 副本。

预览壳 = tools/yueli/index.html + 资源路径改成 file:// 绝对路径 + 注入模拟存储。
只在截图时用，不进交付物。
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))  # red-tool/
TOOL = os.path.join(ROOT, "tools", "yueli")
BUILD = os.path.abspath(os.path.join(HERE, "..", "build", "shells"))

# 五次完整记录：够触发「按实际周期重算」的分支
EPISODES = {
    "v": 1,
    "episodes": [
        {"s": "2026-07-16", "e": "2026-07-20"},
        {"s": "2026-08-13", "e": "2026-08-17"},
        {"s": "2026-09-10", "e": "2026-09-14"},
        {"s": "2026-10-08", "e": "2026-10-12"},
        {"s": "2026-11-06", "e": "2026-11-10"},
    ],
    "settings": {"cycleLen": 28, "periodLen": 5, "privacy": False},
}

# 弹层要停在展开位置：过渡没结束时截图会拍到半截面板
CLICK_SHEET = """var c=document.querySelector('.cal-cell[data-day="2026-11-10"]');
if(c){c.click();}
setTimeout(function(){var p=document.querySelector('.sheet-panel');
if(p){p.style.transition='none';p.style.transform='translateY(0)';}},30);"""

VIEWS = {
    # 名字      模拟数据    载入后执行
    "setup": (None, None),
    "main": (EPISODES, None),
    "pred": (EPISODES, "var b=document.getElementById('cal-next');if(b){b.click();}"),
    "sheet": (EPISODES, CLICK_SHEET),
}

STUB = """<script>window.xhs={miniTool:{
getStorage:function(o){var d=__DATA__;if(d===null){o.fail({errMsg:"getStorage:fail"});return;}o.success({data:JSON.stringify(d)});},
setStorage:function(o){o.success({});},
removeStorage:function(o){o.success({});}}};</script>"""


def shell(name):
    data, after = VIEWS[name]
    with open(os.path.join(TOOL, "index.html"), encoding="utf-8") as f:
        html = f.read()

    # 资源路径：预览壳在 build/shells/ 下，相对路径会指错地方
    html = html.replace('href="./assets/', 'href="file://%s/assets/' % TOOL)
    html = html.replace('src="./assets/', 'src="file://%s/assets/' % TOOL)

    stub = STUB.replace("__DATA__", json.dumps(data, ensure_ascii=False) if data else "null")
    mark = '<script src="file://%s/assets/date.js"></script>' % TOOL
    if mark not in html:
        raise SystemExit("index.html 里没找到入口脚本，模板变了需要同步本脚本")
    html = html.replace(mark, stub + "\n  " + mark, 1)

    if after:
        html = html.replace("</body>", '<script>window.addEventListener("load",function(){setTimeout(function(){%s},300);});</script>\n</body>' % after)

    os.makedirs(BUILD, exist_ok=True)
    path = os.path.join(BUILD, name + ".html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return path


if __name__ == "__main__":
    names = sys.argv[1:] or list(VIEWS)
    for n in names:
        print(n, "->", shell(n))
