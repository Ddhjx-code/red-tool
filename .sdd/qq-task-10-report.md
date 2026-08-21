# Task 10: 无头断言套件定稿 — Report

**Status:** ✅ 完成。`tests/qiqiao_smoke.py` 连续 3 次稳定通过（SMOKE PASS，exit 0），单次运行 18–38s（预算 ~90s）。

## 交付物

- `tests/qiqiao_smoke.py` — 单文件无头冒烟/回归套件，结构镜像 `tests/longzhou_smoke.py`：
  - `sync_playwright` + headless chromium，viewport 390×844
  - hermetic：`add_init_script("localStorage.clear()")` + 加载后再 clear + 结束前 clear
  - 以 `file://` 绝对路径加载 `tools/qiqiao/index.html?test=1`（固定种子 20260819 + `__game` hooks）
  - 全程收集 console `error` 与 `pageerror`，结尾断言为空；`page.on("dialog")` 捕获并 accept
  - 成功打印 `SMOKE PASS`；任何异常打印 `SMOKE FAIL: ...` 并 exit 1

## 断言覆盖（对照任务清单）

| # | 断言 | 实现方式 |
|---|------|----------|
| 1 | boot | `#view-home.is-active`；SHADOWS=12 / ASPECTS=5 / GRADES=5 / FACTS=5；phase=home |
| 2 | 注水 | `start()`→phase `water`；`holdWater(true)` → `wait_for_function` phase `calm` |
| 3 | 收束计时 | 原子 JS 表达式（检查+release 同一 tick，无 IPC 间隙）：phasePos>0.9 松手→calmValue>60（构造上保证 ≥78）；重启后 pointer 事件驱动（canvas pointerdown/pointerup），圈大时 phasePos∈[0.2,0.35] 松手→calmValue<50（构造上恒为 0） |
| 4 | drop→reveal→result | 计时断言 reveal 在 <1.5s 内到达（实际 0.9s=DROP_TIME+DROP_DELAY）；`wait_for_function` result（REVEAL_TIME=2.8s）；`snapshot().result` 的 shadowId∈12 / aspectId∈5 / gradeId∈5 |
| 5 | 结果视图 | result 后 1.2s 切视图 → `#view-result.is-active`；`#result-text p` 恰 3 个且全非空；`#result-seal` ∈ 5 个品级名；`#result-codex` 匹配 `图鉴 \d+/12` |
| 6 | 心诚值影响 | `setCalm(90)`×30 与 `setCalm(10)`×30，每局 `start()`+`setCalm`+`forcePhase('reveal')`+`QQDivine.update` 快进至 result，统计品级 |
| 7 | 影形不重复 | 20 局完整占卜（复用快进 helper：start→holdWater→calm→收束点 release→result），断言 shadowId 序列无相邻相同 |
| 8 | 图鉴 | `unlockAll()`→save.codex=12；打开图鉴 `#codex-count`="12/12"；clear localStorage 后重开="0/12" |
| 9 | 分享降级 | 确认无 `window.xhs`，设置 `QQShare.lastStats` 样本，点 `#btn-save-album` → dialog 文案含「截图保存」 |
| 10 | paintCard | 返回 `data:image/png` 前缀；页内 Image 解码 naturalWidth/Height = 900×1200 |
| 11 | 零错误 | 结尾 `assert not errors` |
| 12 | 输出 | `SMOKE PASS` / 失败 exit 非零 |

## 关键设计决定

1. **确定性验证先行**：`?test=1` 下每次 `start()` 重置 RNG 种子（20260819），结果完全确定。先用 Python 精确复刻 JS 的 mulberry32 RNG（与页面实际输出逐一比对 MATCH），再模拟整个会话的状态轨迹（codex 解锁、lastShadowId、runs），据此设计断言，避免统计断言靠运气。
2. **断言 6 的方向性**：模拟（并经 3 次实跑确认）给出确定分布 —— calm=90 组：{小巧×16, 上巧×14}（上上+上=14）；calm=10 组：{中巧×15, 未得巧×15}（上上+上=0，未得巧=15）。故 `good(90) > good(10)`（14>0）与 `weide(10) > weide(90)`（15>0）均为严格方向性断言，且因全确定性而**零波动**。任务备注的「容差」由「结果交替出现」这一现象本身覆盖（两组各在两个品级间 15/15 或 16/14 交替）。
3. **计时断言构造化**：收束点/大圈松手均采用「同一 evaluate 内先检查相位再 release」的原子表达式，若错过窗口则自动等下一个 2.4s 周期，永远不会在错误相位松手 —— calmValue 边界由构造保证，不依赖轮询延迟。
4. **速度**：真实时间仅用于验证真实动画链路（第 4 项的 drop/reveal 计时）；其余批量局（60+20 局）用 `QQDivine.update(dt)` 快进状态机（走真实的 pickShadow/pickGrade/QQSave 逻辑），整套 18–38s。
5. **静音**：启动后 `QQSound.setMuted(true)`，避免 headless 下 AudioContext 自动播放策略产生噪音（第 3b 项仍走真实 canvas pointerdown/up 路径）。

## 通过输出

```
$ cd /Users/duanchao.wzj/AI/workspace/red-tool && python3 tests/qiqiao_smoke.py
SMOKE PASS
python3 tests/qiqiao_smoke.py  3.15s user 0.47s system 19% cpu 18.136 total

$ python3 tests/qiqiao_smoke.py   # run 2
SMOKE PASS
python3 tests/qiqiao_smoke.py  3.37s user 1.07s system 15% cpu 28.607 total

$ python3 tests/qiqiao_smoke.py   # run 3
SMOKE PASS
python3 tests/qiqiao_smoke.py  4.50s user 1.42s system 15% cpu 37.586 total
```

3/3 通过，exit 0。耗时波动来自机器负载（CPU 占用 15–19% 时 wall time 上升），均远低于 90s 预算。

## 已知限制

- 断言 6 的分布依赖 `?test=1` 固定种子下的确定性轨迹；若 RNG 种子、权重表或抽取顺序变更，需重新运行模拟（报告中的 Python 复刻可作为基线）更新期望值。
- 快进局依赖 `QQDivine.update` 公开可用（现有 API 契约），与 longzhou 套件依赖 `__game` hooks 同级。
