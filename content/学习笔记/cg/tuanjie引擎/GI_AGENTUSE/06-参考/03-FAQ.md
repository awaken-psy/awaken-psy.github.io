---
title: 03 FAQ（高频问题速答）
publish: true
updated: 2026-09-20T10:05:14.936Z
---

# 03 FAQ（高频问题速答）

> 按主题排序；每条答案给出依据文档。详细机制不在此重复，只给结论 + 指路。

## 基础定位

**Q1：TuanjieGI 是什么、输出什么？**
实时全局光照模块（静态世界 + 动态灯光）。输出三张全屏图：间接漫反射、合成镜面（反射⊕粗糙高光）、弯法线，外加累积帧数图。→ [00-系统总览](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/00-系统总览.md)

**Q2：它和烘焙 GI / Light Probe / SSGI 的区别？**
→ [../01-背景知识/07-实时GI技术谱系](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/07-实时GI技术谱系.md)

**Q3：支持哪些平台/RHI？**
`d3d11 | vulkan | metal`（Utility/GlobalConfig.h）；微信小游戏 `GetEnabled()` 直接 false。→ [../05-集成与工程/02-管线接入URP与HDRP](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/02-管线接入URP与HDRP.md) §7

## 数字与参数（最常被问）

**Q4：128 和 64 两个步数上限分别在哪？**
128 = 级联粗场 march（`rayMarchingMaxCountCDF`，GICascadedSDF.h:37）；64 = 精场/cluster march（`rayMarchingMaxCount`，GISDFMesh.h:20）。→ [../06-参考/02-常量与魔法数字表](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/06-参考/02-常量与魔法数字表.md)

**Q5：为什么我调 occludeFactor 没有效果？**
它只接在 `RayMarchingJumped` 上，该函数当前无调用者——主路径 `RayMarching` 用 `min(半体素, 沿途最大读数)`，不消费它。→ [../03-世界层/03-级联距离场GISDFExt](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/03-级联距离场GISDFExt.md) §6.2

**Q6：采样块到底是 8×8 还是 16×16？**
屏幕采样块 16×16 像素（URP 实配）；8×8 是"每块 64 条射线的方向格"和"面片图集光照块"的尺寸——三个概念都叫 quad，别混。→ [../04-屏幕层/02-采样块与射线发射](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/02-采样块与射线发射.md) §0 对照表在 [../04-屏幕层/04-QuadTraceSH主流程](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/04-QuadTraceSH主流程.md)

**Q7：历史混合的帧数上限到底是 8 还是 16？**
三套系统三个值：块级 2–16、面片级 8、像素级 `reprojectionMaxFrames(8)×updateSpeed` clamp [1,20]。→ [../01-背景知识/06-时域累积与重投影](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/06-时域累积与重投影.md) §7

**Q8：0.35 和 4 是什么？**
弯法线的遮挡检查距离（米）与方向数（GISampleBentNormal.h:87/88）。→ [../04-屏幕层/05-弯法线GISampleBentNormal](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/05-弯法线GISampleBentNormal.md)

## 算法

**Q9：多级反弹是怎么实时算出来的？**
不是一帧算完：面片间接光读"别的面片上一帧的出射光"，每帧推进一反弹，静止收敛（`indirectHistoryEnable` 注释 "Blend with history radiosity to get infinite bounces."）。→ [../03-世界层/01-总体架构与更新流程](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/01-总体架构与更新流程.md) §2

**Q10：为什么屏幕命中算"接近两反弹"？**
①级取色读上一帧最终画面（已含上一帧的直接光+反弹光），叠加命中本身的传递即约两反弹。→ [../04-屏幕层/03-六级查询与流压缩](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/03-六级查询与流压缩.md) §3

**Q11：硬件光追开了还用距离场吗？**
不用——mask 清 kSDF/kCDF，④⑤ 整体替换②③；但取色仍读面片图集（换几何后端不换光照数据）。→ [../04-屏幕层/03-六级查询与流压缩](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/03-六级查询与流压缩.md) §1

**Q12：粗糙镜面的"锥角"怎么定的？**
锥角 = π/2 × 粗糙度；反射方向由弯法线算出。粗糙度 >0.4 的屏幕镜面追踪不再做（交给 SH 锥角瓣）。→ [../04-屏幕层/04-QuadTraceSH主流程](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/04-QuadTraceSH主流程.md) §4.6、[../04-屏幕层/07-屏幕空间镜面追踪](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/07-屏幕空间镜面追踪.md) §1

**Q13：为什么墙角自动变暗，不用 SSAO？**
HDRP 上：漫反射以弯法线求值——被挡方向不参与，且向量长度携带可见度，角落遮蔽感自动出现。**URP 上弯法线整体关闭（useBentNormal=false，三关全关）——TuanjieGI 不提供角落遮蔽，需要 SSAO 另配**。→ [../04-屏幕层/05-弯法线GISampleBentNormal](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/05-弯法线GISampleBentNormal.md)

**Q14：直接光在哪算？屏幕层还是面片？**
面片侧（图集上逐 texel + 阴影线，GILighting/）计入面片出射光；屏幕画面的直接光是渲染管线自己画的，GI 只补间接。注意 GILighting 的 "quad" 是面片图集光照块，不是屏幕块。→ [../03-世界层/05-面片光照GILighting](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/05-面片光照GILighting.md)

**Q15：重要性采样会不会偏色？**
按立体角权重校正（`GetImportance=4π/64`，前缀和+128 分箱），上一帧只引导方向不直接当结果。→ [../04-屏幕层/02-采样块与射线发射](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/02-采样块与射线发射.md) §3

## 工程

**Q16：一帧的执行顺序？**
世界层（GISDFScene → 级联 → 面片）先、屏幕层（两条 TracingView + 弯法线）后、像素重投影、镜面合成。→ [../04-屏幕层/01-总体流程](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/01-总体流程.md) §2

**Q17：URP 和 HDRP 接入有什么不同？**
纹理 2D vs 2DArray、光照实现 dummy vs 完整、压缩系数 1.6384 vs 16384、透明镜面只有 HDRP、交错更新只有 URP 默认开等。→ [../05-集成与工程/02-管线接入URP与HDRP](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/02-管线接入URP与HDRP.md) §4

**Q18：动态物体有间接光吗？**
部分有——动态物体出现在屏幕空间数据（Hi-Z/上一帧颜色）里被屏幕层采集；它自身表面不铺面片，其反射的间接光来自屏幕层近似。静态物体被移动时 TransformTracker 触发重算。→ [../01-背景知识/07-实时GI技术谱系](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/07-实时GI技术谱系.md) §3

**Q19：怎么调画质/性能？"多反弹收敛速度"对应哪个参数？**
显式映射（口语→参数）：

| 想要什么 | 动哪个 |
|---|---|
| **多反弹收敛更快/更慢**（面片间反弹链） | `updateSpeed`（接入层传入；FrameContext 里存**倒数**，值越大收敛越慢）——它同时缩放面片更新节奏与像素层历史上限（8×updateSpeed） |
| 完全关掉多反弹 | `FacetScene.IndirectLighting.enable = false`（"no multibounce GI is computed"） |
| 只关历史混合（保留单反弹） | `FacetScene.IndirectLightingHistory.enable = false` |
| 拖影 vs 平滑 | `reprojectionMaxFrames`（像素层）；`.blendHistoryQuads.maxFrameCount`（块级 16） |
| 省性能 | 交错更新（URP `interleavedUpdate.enable`，省 16 倍射线）、面片配额 `facetRasterizeFrameCount`、反射 `reflectionQuality`、级联尺度 `minGIDetail` |

→ [../06-参考/01-GIOption参数字典](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/06-参考/01-GIOption参数字典.md)

**Q19b：SH 的 9 系数和 16 系数各用在哪？**
`integrateDiffuse`（漫反射余弦瓣）**固定用 9 阶**（SphericalHarmonics.h 注释 "regardless of num, always use 9"）；`integrateRoughSpecular`（粗糙镜面锥角瓣）用模板 num 阶——**存在 16 系数（4 阶）特化**供更锐的镜面用；`GIRadianceCacheSH` 的面片块缓存每块 48 个 float，与"4 阶 16 系数 × RGB=48"吻合（阶数未显式声明，属有据推断）。→ [../01-背景知识/02-球谐函数SH](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/02-球谐函数SH.md) §7

**Q20：编辑器里怎么看到中间结果？**
两条路：(a) C# 侧 `GetTextureByName/SetTestTexture`（池内纹理按名取，想看哪张直接取）；(b) 各 `*Visualize` 的 enable 选项（全屏调试视图，开关清单与注意事项见 [06-调试可视化指南](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/06-参考/06-调试可视化指南.md)）。→ [../05-集成与工程/01-TuanjieGIManager与帧调度](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/01-TuanjieGIManager与帧调度.md) §5

## 文档使用

**Q21：分册里引用的这些 C++ 段落是什么写法？**
Oceanus DSL：`oceanus::Kernel(lambda)` + `$if/$while` + `Var<T>` + permutation——C++ 模板生成 GPU 程序。→ [../02-代码方言/01-Oceanus-DSL速成](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/02-代码方言/01-Oceanus-DSL速成.md)

**Q22：想了解某个文件/目录是干什么的？**
→ [../02-代码方言/02-模块目录与文件地图](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/02-代码方言/02-模块目录与文件地图.md)（含 Math 库 11 件逐件说明）

**Q23：哪些断言要小心？**
失效/存疑项清单（短路功能、错位注释、疑似 bug、超出本档范围的部分）单独维护在 [04-未解之处](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/06-参考/04-未解之处.md)——引用相关机制前先查它；引用其声明为"未覆盖"的内容时，如实回答"本档未覆盖"。
