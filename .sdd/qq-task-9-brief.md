### Task 9: 教学 + demo 自驾 + 打磨

**Files:** Modify `assets/main.js`

- [ ] **Step 1: 教学**：runs===0 首占：#tutor 依次提示三幕操作（随 phase 切换文案，water「长按舀水」/calm「圈收至心松手」/drop「点按投针」），进入 result 后不再出现
- [ ] **Step 2: demo 模式**（?demo=1）：boot 自动 start()；autopilot 按阶段自动操作——water：holdWater(true) 直到 filled；calm：在收束点（phasePos>0.94）releaseCalm；drop：0.5s 后 dropNeedle；result：停留 3s 展示卡片 → 自动再占（循环出素材）；非 demo 路径零影响
- [ ] **Step 3: 打磨**：阶段切换转场（canvas 层淡入淡出 0.3s）；呼吸圈收束瞬间微光反馈；结果视图入场动画（印章盖落 scale 1.3→1 + 微旋）
- [ ] **Step 4: 无头验证**：?demo=1 跑 60s：至少完成 2 次完整占卜、无 pageerror、无卡死（phase 持续推进）；普通模式 boot 停在 home
- [ ] **Step 5: 记录进度**

---

