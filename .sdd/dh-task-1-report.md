# Task 1 报告：骨架 + 数据 + 藻井壁画（视觉检查点 1）

**Status: PASS（全部无头断言通过，2 连跑稳定；截图待人眼过目）**

## 交付文件

| 文件 | 内容 |
| --- | --- |
| `tools/dunhuang/index.html` | 6 视图（home/select/extract/build/result/codex），元素 id 全按 brief；外置脚本按 data→save→rng→audio→mural→extract→card→main 加载；head 内联 reset 与乞巧一致；viewport-fit=cover |
| `assets/data.js` | `DHData`：COLORS 18 色（spec §2.2 原样）、TITLES 5、FACTS 5（spec §7 原样）、MURALS 3、SHAPES（zaojing 六层按 brief 坐标，feitian/jiuse 空数组）、DUST_DONE 0.85、BRUSH_R 18 |
| `assets/rng.js` | `DHRng` mulberry32（乞巧 QQRng 改名） |
| `assets/save.js` | `DHSave`：key "dunhuang-save"，`{codex:[],cards:0,lastBuild:null}`，load/save/unlock/codexCount，双向 try/catch |
| `assets/mural.js` | `DHMural`：init/resize（DPR cap 2，内容区居中正方形 side=min(W,H*0.62)，oy=(H-side)*0.42 顶部留 hint 区）、load（深拷贝+重置蒙尘/已提）、draw（数组顺序 flat 填充 + 黛青勾线 2.5px α0.55；已提 α0.55+月白虚线；蒙尘层最后盖）、hitTest（逆序，poly 射线法/circle 距离）、dustAt（destination-out 圆笔刷 r=BRUSH_R）、dustProgress（bbox 内 10×10 网格采样 α<32 记清）、markExtracted、metrics、designToCanvas/canvasToDesign 辅助 |
| `assets/style.css` | tokens（--red/--ink/--gold/--moon/--paper/--font-kai）+ 六视图全套：home 竖排标题（vertical-rl 同系列）、select 卡片、extract 底栏（半透明黛青底+安全区）、build（chip 圆 44px 选中朱红描边+✓、pill 选中朱红底）、result 居中、codex 3 列网格 .codex-cell/.is-locked/.codex-cell-name（同乞巧）、#extract-toast（顶中黛青底宣纸字淡入） |
| `assets/main.js` | 临时版：init canvas + load("zaojing") + rAF draw + 切 #view-extract + `window.__game` |

## 无头验证（390×844，file://，?test=1，连跑 2 遍全绿）

1. **pageerror：0**；console error 仅 3 条预期 404（audio/extract/card.js 本任务不存在）
2. **截图**：`.sdd/shots/dh1-zaojing.png`（390×844，1584 种颜色非空白；主色分布 = 宣纸底/石青/朱砂/蒙尘层/朱红底栏，程序化确认渲染正确）；另有 `dh1-zaojing-dusted.png` 擦尘后对照
3. **像素采样六层（±30 全过，实测全为精确值）**：qingshi (47,93,158)=#2F5D9E、zhusha (184,58,46)=#B83A2E、shilv (69,137,122)=#45897A、cihuang (217,164,65)=#D9A441、zheshi (156,91,60)=#9C5B3C、jin (201,162,39)=#C9A227
4. **hitTest**：设计 (50,50)→jin、(50,20)→zhusha、(6,6)→qingshi（断言 color id 全过）
5. **dustAt**：石绿区 20 笔 → dustProgress 0 → 0.76（>0 ✓；before 严格 ≈0）
6. **DHData 完整性**：COLORS 18 / TITLES 5 / FACTS 5 / MURALS 3，无色缺 id/name/hex/text，zaojing 6 层、feitian/jiuse 空

## 实现备注

- 蒙尘层为**单一共享离屏 canvas**（device px，setTransform(dpr)），load/resize 时以 DHRng(3) 重建：dusty 形状区域填 #B8A88A α0.93 + 420 斑点（clip 在形状内）。蒙尘盖住 shilv 整个 bbox（含内层形状）——与计划 T2 九色鹿「蒙尘层覆盖躯干 bbox」的取简方案一致；像素采样测试先在该点擦尘再取样
- 内容区垂直定位 oy=(H-side)*0.42：上留 hint 区、下留底栏空间（390×844 时 side=390 满宽，oy≈191）
- dustProgress 采样网格取 10×10（brief 建议 8×8 起步，取略密仍轻量，调用方限频）
- 验证脚本暂存临时目录（`$TMP/opencode/dh1_verify.py`），T7 并入 `tests/dunhuang_smoke.py`

## 遗留 / 关注点

- **视觉检查点 1 需人眼过目截图**（本模型无图像输入，仅程序化验证了颜色/构图数值）：`.sdd/shots/dh1-zaojing.png`
- 404 × 3（audio/extract/card）为预期，T3/T6 补齐后消失
- 藻井满宽铺满（side=W），左右无留白，视觉上可接受；如需呼吸感可在后续任务微调 0.62 系数或加内缩
