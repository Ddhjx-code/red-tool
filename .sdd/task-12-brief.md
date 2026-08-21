### Task 12: 无头断言套件定稿

**Files:**
- Create: `tests/longzhou_smoke.py`

- [ ] **Step 1: 完整脚本**（playwright sync_api，viewport 390×844，`file://` 加载 `?test=1`，收集 console error 最后断言为空）：

```python
import pathlib, sys, zipfile, tempfile, subprocess
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = (ROOT / "tools/longzhou/index.html").as_uri() + "?test=1"
errors = []

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(URL)
        assert pg.eval_on_selector("#view-home", "el.classList.contains('is-active')")
        assert pg.evaluate("window.LZData.CODEX.length") == 8
        g = lambda: pg.evaluate("window.__game.snapshot()")
        pg.evaluate("window.__game.start()")
        assert g()["state"] == "playing"
        pg.wait_for_timeout(1500)
        assert g()["entities"] > 0, "应有实体生成"
        pg.evaluate("window.__game.swipe(1)")
        pg.wait_for_timeout(400)
        assert g()["lane"] == 1
        for _ in range(12):
            pg.evaluate("window.__game.drum()")
            pg.wait_for_timeout(130)
        s = g()
        assert s["dashT"] > 0 or s["gauge"] >= 96, "击鼓应攒槽/触发冲刺"
        pg.evaluate("window.__game.setDist(600)")
        pg.wait_for_timeout(800)
        assert g()["speed"] > 9, "难度应随里程上升"
        waves_ok = pg.evaluate("(function(){ for(var i=0;i<200;i++){ window.__game.spawnWave(); } return true; })()")
        assert waves_ok
        pg.evaluate("window.__game.unlockAll()")
        assert len(pg.evaluate("window.__game.save().codex")) == 8
        pg.evaluate("window.__game.forceHit()")
        pg.evaluate("window.__game.forceHit()")
        pg.evaluate("window.__game.forceHit()")
        assert g()["state"] in ("capsized", "result")
        pg.wait_for_timeout(1800)
        assert g()["state"] == "result"
        assert pg.eval_on_selector("#view-result", "el.classList.contains('is-active')")
        assert pg.evaluate("!!document.getElementById('result-title').textContent")
        pg.click("#btn-save-album")
        pg.wait_for_timeout(200)
        # 无 xhs 环境应走降级 alert
        b.close()
    assert not errors, errors
    print("SMOKE PASS")

run()
```

（alert 处理：`pg.on("dialog", lambda d: d.accept())` 加到 new_page 后。）

- [ ] **Step 2: Run** `python3 tests/longzhou_smoke.py`
Expected: `SMOKE PASS`
- [ ] **Step 3: Commit**

---

