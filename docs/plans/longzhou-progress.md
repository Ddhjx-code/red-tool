# 龙舟破浪 执行进度账本

- 计划：docs/plans/2026-08-18-longzhou-plan.md
- 规格：docs/specs/2026-08-18-longzhou-design.md
- 执行方式：子代理逐任务（无 git，review 读全文件；不 commit）

| Task | 状态 | 备注 |
| --- | --- | --- |
| 1 | ✅ complete | 竖排标题修复；JS 生成节点类名约定：.codex-cell/.codex-cell-name/.steady-dot |
| 2 | ✅ complete | review 通过；视觉门禁待用户最终确认（截图 .sdd/shots/task2-scene-*.png）；minor：波光 alpha+0.05、岸景未按 z 排序 |
| 3 | ✅ complete | 子代理中断但代码已完成；控制器直接验证 T3 CHECK PASS（swipe/pointer/keyboard 换线） |
| 4 | ✅ complete | 13/13 断言；review 修复：done 障碍不渲染+冲刺不可续杯 |
| 5 | ✅ complete | 13/13×3 稳定；review 通过（minor：按压 timer 未 clearTimeout，可接受） |
| 6 | ✅ complete | 8/8 断言；修复：isUnlocked indexOf + zongzi/wine 也入图鉴 + 全物品 toast（权重翻倍统计验证 0.260 vs 0.164） |
| 7 | ✅ complete | 15/15 断言；review 通过（minor：教学 timer 未随翻船取消，纯外观） |
| 8 | ✅ complete | 6/6 断言+mock xhs 验证；review 通过（minor：paintCard 未 try/catch、卡片字号与骨架微差，均外观） |
| 9 | ✅ complete | 被中断代理已写完 audio.js，复核验证+review 通过（参数/触发点全对，无双重播放） |
| 10 | ✅ complete | 14/14 全流程；review 通过（minor：HUD 同步在 draw 前、test 钩子翻船时残影残留，均无实感影响） |
| 11 | ✅ complete | 62s 自驾 646m 无翻船；review 通过；修复 demo 击鼓 88→100 门槛（冲刺改为纯鼓点驱动验证） |
| 12 | ✅ complete | tests/longzhou_smoke.py 11 项断言，SMOKE PASS×3（控制器复跑确认） |
| 13 | ✅ complete | dist/longzhou.zip 24KB（index.html 在根，仅支持类型）；禁用 API 扫描零命中；zip 独立冒烟 ZIP SMOKE PASS；series-plan §3+§8 更新 |
| 14 | ✅ complete | 6 张 3:4 配图（1260×1680@2x）+卡片图 900×1200+文案+README 行 8；结算素材为真实战绩 1500 分/图鉴 8/8 |

---

# 霓裳羽衣（汉服换装）进度

- 规格：汉服换装，wan2.6 出 27 组合（3 发髻×3 上衣×3 下裙）+3 背景，A 玩法（混搭）+B 素材（整人图）
- 素材：example.png 当参考图锁画风；PNG→WebP（512KB→28KB/张）
- 功能：发髻/上衣/下裙/背景四 tab 换装 + 存相册/发笔记分享卡（900×1200）
- 验证：换装切换/分享双出口断言 + zip http 源冒烟 PASS
- 打包：dist/hanfu.zip（1.2MB，36 文件，index.html 在根）
- release：release/hanfu/（5 图+文案+图标提示词+hanfu.zip），release/README 加行 12
- 状态：✅ 完成，待用户验收画质

## v1.1 鞋（2026-08-21）

- 方案：单品鞋图叠加对位不佳（preview 40-43）→ 整图烘焙，每组合含鞋
- 素材：wan2.7-image（token-plan.cn-beijing.maas.aliyuncs.com 网关，gen_combo_v2.py），绣花鞋/弓鞋/翘头履 ×27=81 张，q80 WebP 均 36KB
- 代码：鞋 tab + comboImg(h,t,s,shoe)；介绍页知识卡 3→4（data.js find 支持 shoe）；删 overlay 残留 CSS
- 验证：tests/hanfu_smoke.py 8 项断言 SMOKE PASS（http 源，file:// 会 taint canvas）+ zip 独立冒烟 PASS
- 打包：dist/hanfu.zip（3.2MB，88 文件）= release/hanfu/hanfu.zip；release 配图重制 6 张（+06-shoe-tab）+文案更新
- 状态：✅ 完成，预览 docs/preview-hanzhuang/44-49，待用户验收画质

## v1.2 抠图+特效（2026-08-21，用户反馈驱动）

- 反馈：生成卡人物带白底方框与背景冲突、背景被盖住、一致性不够稳（接受）
- 抠图：81 张组合图 rembg（u2net，0.5s/张）→ 透明底 WebP q80（均 53KB），换装页/分享卡均无白框
- 分享卡特效：地面投影 + 花瓣/金屑（seedRng 按搭配确定性随机）+ 竖排题字「霓裳羽衣」+朱红「汉服」印章 + 底部搭配名渐隐条
- 结果页：卡片入场动画（card-in 浮起缩放 .65s）
- 验证：hanfu_smoke 8 项 SMOKE PASS + zip 独立冒烟 PASS
- 打包：dist/hanfu.zip（4.5MB）= release/hanfu/hanfu.zip；release 配图重制
- 状态：✅ 完成，预览 docs/preview-hanzhuang/50-52，待用户验收
