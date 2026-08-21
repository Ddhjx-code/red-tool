### Task 4: 拼色卡（两版式 × 三底 × 题字）

**Files:** Create `assets/card.js`；Modify `assets/main.js`（build 视图）

- [ ] **Step 1: card.js** — `paint(opts)` 900×1200：
  - 公共：三底背景（paper #F5F0E6 / silk #EFE6D2 / night #2E3D52；night 时文字转月白 #D6ECF0、边框仍朱红）+ 宣纸噪点纹理（DHRng 种子）+ 朱红双线框（外 6px inset24 / 内 2px inset40）+ 四角饰
  - scroll 版式（照视觉稿 A）：顶题字（opts.title，楷体 72px 黛青/月白）+ 副题「{source}」26px + 分隔饰线；N 色竖条（宽 112 高 470，圆角 6，内白描边，均分排布）+ 色名竖排 27px 于条下；底部来源行 + 朱印「敦煌」（旋转 -6°，白字竖排）
  - zaojing 版式（照视觉稿 B）：顶题字 + 副题；同心方井 620×620 居中：按色数 5-6 层交替正方/45°菱形递缩（边长 600→424→300→212→150→中心圆 84），层色取 opts.colors 顺序；下方圆形色点图例（52px 圆+名 24px）；底部来源+朱印
  - 色数约束：scroll 3-6；zaojing 5-6（不足 5 循环补色，超出截断）
- [ ] **Step 2: build 视图**：#color-chips 已解锁色 chips（多选，上限按版式）；#layout-opts 两 pill（立轴色谱/藻井）；#bg-opts 三 swatch（宣纸/绢本/夜空）；#title-opts 五题字 pill；#build-preview 实时渲染（390 宽内 3:4，每次选择变更重绘，debounce）；默认选择：前 5 个已解锁色 + scroll + paper + 首个题字；未解锁任何色时进 build → toast 提示先去拾色并弹回
- [ ] **Step 3: 无头验证**：paint 各版式×三底返回 dataURL 900×1200；像素：paper 角点 ≈#F5F0E6、night 角点 ≈#2E3D52；scroll 版式竖条区域采样到所选色 hex（±30）；zaojing 中心圆采样到第 6 色；build 预览交互：选色/切版式/切底 → preview canvas 帧差变化
- [ ] **Step 4: 记录进度**

---

