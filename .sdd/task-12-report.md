# Task 12 报告：无头断言套件定稿

## Status: DONE

## 交付物
- 新建 `tests/longzhou_smoke.py`（repo 根 tests/ 目录，不进 tools/longzhou，不会被打进 zip）
- 单文件可运行：`python3 tests/longzhou_smoke.py`，成功打印 `SMOKE PASS`，退出码 0

## 实现说明

基于 brief 参考脚本，按实际实现 API 做了以下适配（先读了 `assets/game.js`、`main.js`、`share.js`、`save.js`、`data.js`、`style.css`）：

1. **snapshot 字段确认**：`window.__game.snapshot()` 返回 state/lane/dist/speed/score/scoreFrac/zongzi/combo/maxCombo/steady/gauge/dashT/invT/capT/entities(数量)/sinceSpawn/lastDrumAt，与参考脚本断言字段一致，无需改名。
2. **eval_on_selector 表达式**：本机 Playwright 版本不支持 `el.classList.contains(...)` 裸表达式（报 `ReferenceError: el is not defined`），改为箭头函数形式 `el => el.classList.contains('is-active')`。
3. **固定等待改轮询**：entities>0、lane===1、state==='result' 均用 `wait_for_function`（超时 2s~6s）轮询，减少抖动；仅 drum 间隔（130ms）与难度坡道（800ms）保留固定等待。
4. **spawnWave x200 附加断言**：在单次 evaluate 内循环 200 次 `spawnWave()`，逐波统计新增 obs 占用的 lane 数，断言无异常且每波被封锁 lane ≤2（实测 maxObs≤2，bad=0）——验证生成器永不封死三条航道。
5. **dialog 捕获**：`page.on("dialog")` 记录 message 并 accept；点击 `#btn-save-album`（无 window.xhs 环境）断言降级 alert 触发且文案含「截图保存」（对应 share.js `fallback()`）。
6. **错误收集**：console `error` 事件 + pageerror 全量收集，结尾断言为空（不排除任何项）。
7. **密封性**：`add_init_script("localStorage.clear()")` + 加载后再次 clear + 用例结束前 clear；URL 带 `?test=1`（确定性种子 20260818 + `__game` 钩子）。

## 断言清单（11 项全覆盖）

| # | 断言 | 结果 |
|---|------|------|
| 1 | Boot: `#view-home.is-active`；`LZData.CODEX.length===8`；state==="home" | PASS |
| 2 | `__game.start()` → snapshot().state==="playing" | PASS |
| 3 | 轮询 ≤5s 内 entities>0 | PASS |
| 4 | `swipe(1)` → 轮询 ≤2s 内 lane===1 | PASS |
| 5 | drum ×12（间隔 130ms）→ dashT>0 或 gauge>=96 | PASS |
| 6 | `setDist(600)` + 800ms → speed>9（难度坡道） | PASS |
| 7 | spawnWave ×200 无异常，且每波 obs lanes≤2 | PASS |
| 8 | `unlockAll()` → save().codex 长度===8 | PASS |
| 9 | forceHit ×3 → state∈(capsized,result)；轮询 ≤6s state==="result"；`#view-result.is-active`；`#result-title` 非空 | PASS |
| 10 | 无 xhs 点 `#btn-save-album` → alert 降级（文案含「截图保存」） | PASS |
| 11 | console error + pageerror 列表为空 | PASS |

## 验证输出

连续 3 次运行（首次 + 稳定性复跑 2 次）全部通过，退出码 0：

```
$ cd /Users/duanchao.wzj/AI/workspace/red-tool && python3 tests/longzhou_smoke.py
SMOKE PASS
$ python3 tests/longzhou_smoke.py && python3 tests/longzhou_smoke.py && echo "EXIT_CODES_OK"
SMOKE PASS
SMOKE PASS
EXIT_CODES_OK
```

## 备注 / 关注点
- 首次运行暴露并修复了唯一适配问题（eval_on_selector 箭头函数），其余断言一次通过，说明前序任务的 API 实现与 brief 预期高度一致。
- 套件对确定性种子敏感属预期（?test=1 固定种子 20260818）；若后续改动生成器权重或 drum/难度常量，断言 5/6/7 的阈值需同步复核。
- 未提交 git（按任务要求跳过）。
