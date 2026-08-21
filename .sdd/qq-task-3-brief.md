### Task 3: 十二影形矢量

**Files:** Create `assets/shadow.js`

**Interfaces:** Produces `QQShadow.draw(ctx, id, x, y, size, alpha)`

- [ ] **Step 1: shadow.js** — 12 个影形剪影，统一在 size×size 包围盒内绘制（中心 x,y），墨色 `rgba(20,26,38,alpha)` 填充，风格=盆底投影（形状轮廓为主，细节 1-2 笔）：
  - yun 祥云：三团卷云连缀（圆弧叠合）
  - mudan 牡丹：层叠花瓣圆（3 层 8 瓣简化）
  - xique 喜鹊：鸟侧影（头/身/长尾一笔弧线）+ 一枝
  - jinyu 金鱼：椭圆身 + 扇尾 + 眼点
  - fenghuang 凤凰：长尾鸟影（冠+飘带尾 3 条弧线）
  - limao 狸猫：蜷卧猫影（圆身+耳+卷尾）
  - xiuxie 绣鞋：翘头弓鞋侧影 + 鞋口弧线
  - jiandao 剪刀：X 形双刃 + 环柄
  - yulong 玉龙：C 形龙身 + 角 + 须
  - lianhua 莲花：仰莲 7 瓣 + 莲蓬点
  - chui 槌影：粗短槌形（上粗下细圆头矩形）
  - zhuying 烛烟：竖直烛身 + 顶部一缕弯烟
  - 每个形状绘制后复位 transform/alpha；提供 `QQShadow.ids()` 返回 12 id 列表
- [ ] **Step 2: 无头验证**：离屏 canvas 逐个绘制 12 形，断言每个非空白（中心区域 alpha 覆盖率 >5%）；12 形两两像素差异 > 阈值（互不相同）；截图 `.sdd/shots/qq3-shadows.png`（12 宫格）
- [ ] **Step 3: 记录进度**

---

