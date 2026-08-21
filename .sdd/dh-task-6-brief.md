### Task 6: 音效 + 教学 + 打磨

**Files:** Create `assets/audio.js`；Modify `assets/main.js`

- [ ] **Step 1: audio.js**（结构同系列）：unlock/isMuted/setMuted（持久化）+ chime（提色：五声音阶随连提序号 [523,587,659,784,880][n%5] 三角波 0.18s）+ hidden（发现隐藏色：双泛音铃 880+1760 0.6s）+ brush（擦尘：低通噪声短段，擦动时节流触发）+ stamp（钤印：低频墩 120→60 0.2s）+ card（成卡：磬 440+880 1s）；全 try/catch + muted 早退
- [ ] **Step 2: 触发接线**：首次 pointerdown unlock；提色/隐藏/擦尘(节流 0.25s)/钤印/成卡各触发；#btn-mute-home 声/静切换
- [ ] **Step 3: 教学**：cards===0 且 codex 空时首进 extract：#extract-toast 依次提示「点按色块，拾取矿物色」（3s）→「有些色藏着、有些蒙着尘」（3s）；之后不再出现
- [ ] **Step 4: 打磨**：select 卡片入场错峰淡入；build 选择变更时预览微动效（scale 0.98→1）；home 背景加一幅藻井小图点缀（canvas 或 CSS）
- [ ] **Step 5: 无头验证**：全音效方法调用无异常；静音持久化；教学 toast 首现条件断言
- [ ] **Step 6: 记录进度**

---

