### Task 10: 无头断言套件定稿

**Files:** Create `tests/qiqiao_smoke.py`

- [ ] **Step 1: 套件**（参照 tests/longzhou_smoke.py 结构，?test=1，hermetic）：
  1. boot：#view-home.is-active；QQData.SHADOWS.length===12
  2. start→phase water；holdWater 注满→calm
  3. 收束点 releaseCalm→calmValue>60；乱点 releaseCalm（圈很大时）→calmValue<50
  4. drop→reveal→result 全流程；result 三要素合法（shadow∈12、aspect∈5、grade∈5）
  5. 组合拼装：result 视图三段断语非空
  6. 心诚值影响：setCalm(90)×30 局上品级占比 > setCalm(10)×30 局（统计断言，容差内）
  7. 影形不连续重复：20 局序列无相邻同影
  8. unlockAll→图鉴 12/12；清 storage 回 0/12
  9. 分享降级：无 xhs 点击→dialog
  10. console error 零收集；打印 SMOKE PASS
- [ ] **Step 2: Run** `python3 tests/qiqiao_smoke.py` ×3 稳定通过
- [ ] **Step 3: 记录进度**

---

