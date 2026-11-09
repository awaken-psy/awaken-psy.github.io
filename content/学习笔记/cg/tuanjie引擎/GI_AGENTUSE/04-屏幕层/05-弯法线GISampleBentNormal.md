---
title: 05 弯法线（bent normal）
publish: true
updated: 2026-09-20T10:02:47.502Z
---

# 05 弯法线（bent normal）

> 源文件：`GITracing/GISampleBentNormal.h`、`GITracing/GITraceBentNormal.h`；消费处：`GITracing/QuadTraceSH.h`（Integrate）、`RenderPipeline/ReprojectHistory.h`
> 作用：逐像素计算"这一点实际看得到哪些方向"，替代表面法线参与漫反射与粗糙镜面求值，让低频的块级光场数据也能表现像素级遮挡。
> 前置阅读：[../01-背景知识/02-球谐函数SH](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/02-球谐函数SH.md) §4（为什么求值方向影响亮度）；消费方见 [04-QuadTraceSH主流程](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/04-QuadTraceSH主流程.md) §4.6

## 1. 为什么需要它

采样块的 9 个 SH 系数是**块级**的——块内 256 个像素共享同一份环境光描述。表面法线求值隐含"这一点看得到完整环境"的假设；墙角、缝隙里该假设不成立，按原法线求值会把被挡方向也算进去，角落偏亮。而块级数据本身分不出单个像素身处的缝隙。

**弯法线**回答"这一点实际看得到哪些方向"：把未遮挡方向加权平均。开阔处 ≈ 原法线；墙角处偏向开阔侧，且**向量长度随遮挡加重而变短**——长度本身携带该点的可见度。求值时用弯法线代替原法线（漫反射求值方向、粗糙镜面反射方向都由它派生），墙角与缝隙自动暗下去，产生物理正确的遮蔽感——无需再叠一层 SSAO。

## 2. 两个实现

### 2.1 `GISampleBentNormal.h`（深度采样版，主用）

GIOption（默认值即源码事实，注册名 `BentNormal.*`）：

- `BentNormal.sampleDistance = 0.35f`（h:81，注释 "Default 0.35."）——遮挡检查距离，**0.35 米**
- `BentNormal.sampleNumber = 4`（h:82，注释 "Range 1 - 5, default is 4."）——方向数，**4 方向**（permutation clamp 1–6）

Kernel（8×8 线程组）`SampleBentNormal`（L23–78）流程：

1. 在深度缓冲上朝若干方向做短距离遮挡检查：4 个基础方向做对称采样（共 8 次）；
2. 每次采样按采样点深度算权重 `w = exp(-d²/maxDist²)`（d 为采样点到本像素的距离，远者权重小）；
3. 遮挡判据：`IsDepthOutBias(deviceDepth, actualDepth, maxDistance×1.2f) || (samplePosSS.z - actualDepth×1.0001f) > 0`——采样点深度比"沿该方向应有的深度"更近，说明有东西挡着；
4. 未遮挡方向加权平均求和得 `rayDirectionSum`；
5. **归一化：`bentNormal /= length(rayDirectionSum)`**——和向量的模越短（方向越互相抵消/越少方向通过），除出来的结果越短。这就是"长度携带可见度"的实现；
6. 输出编码 `×0.5+0.5`（存 [0,1]）。

CPU 侧 `GISampleBentNormalUpdater`（SWRTPipeline 成员）挂在 onUpdateView 上每帧驱动；**监听开头有守卫 `if(!vctx.useBentNormal) return;`（h:87）——弯法线特性是按平台开关的**：HDRP `useBentNormal=true`（全开），**URP `useBentNormal=false`（整体关闭，详见 §3/§4）**。

### 2.2 `GITraceBentNormal.h`（射线版）

- `numSample = 8`（L31）、`numTraceStep = 30`（L32）、`maxDistance = 100`（L51）
- 朝 8 个方向发真实射线步进，同样 `bentNormal /= length(rayDirectionSum)` 归一化。成本高于深度采样版，是备选/调试路径（监听开头有 `if(vctx.isTransparencyPass) return;`）。

## 3. 消费：QuadTraceSH 的 Integrate（含平台开关）

按瓣求值阶段（QuadTraceSH.h `Integrate` L1083–1092）——**弯法线不是无条件使用的**，由 permutation 决定：

```cpp
Float3 bentNormal;
$permutation_if($permu("integrateEnableBentNormal")) {
    bentNormal = currentQuad.SubPixelGetWorldBentNormal(...);   // 读弯法线缓冲
} $permutation_else {
    bentNormal = normalWSRoughness.xyz();                      // 回退：普通世界法线
};
Float Cosine = (PI/2) * normalWSRoughness.w;                   // 锥角照旧由粗糙度定
```

- permutation 的值来自 `states.options.integrateEnableBentNormal = vctx.useBentNormal`（IndirectLightingScene.h:167）——GIOption 默认 true（".integrate.EnableBentNormal"，"Default to enable."）被 ViewContext 覆盖。
- **结果**：HDRP 上漫反射与粗糙镜面都以弯法线求值（反射方向 `2*dot(viewDir,bentNormal)*bentNormal−viewDir`）；**URP 上弯法线整体关闭——漫反射/镜面都退回世界法线求值**，角落遮蔽感不由 TuanjieGI 提供（需要 SSAO 之类另配）。

## 4. 消费：时间累积

`ReprojectHistory.h` 有 permutation `enableBentNormal`（默认 true）——开启时 bent normal 与 diffuse/specular 一起做历史混合。**三处平台事实**：URP 的 `ReprojectHistoryTextures` 显式设 `enableBentNormal=false`（不累积）；配合 §2.1 的 updater 守卫与 §3 的求值回退——**URP 上弯法线从计算、求值到累积三关全关**；HDRP 三关全开（每帧更新 + 求值使用 + 历史累积）。

## 5. 快速问答

**Q：0.35 米和 4 方向是硬编码吗？**
A：是 GIOption 默认值（`BentNormal.sampleDistance` h:81 / `BentNormal.sampleNumber` h:82），运行时可调；"0.35 米"即遮挡检查的最大距离，超过它的遮挡不参与弯法线。

**Q：弯法线长度为什么能携带可见度？**
A：归一化方式决定的——除以的是"通过方向的加权和"的模，方向越少、越偏一侧，模越小，弯法线越短（见 §2.1 第 5 步）。

**Q：它和 SSAO 什么关系？**
A：功能上替代 SSAO 的"遮蔽变暗"效果（弯法线求值自动产生），但它是方向量不是标量遮蔽系数；bent normal 图本身也单独输出（`GetBentNormalRT`），供材质与调试使用。**注意平台**：这套效果只在 HDRP 生效——URP 上弯法线三关全关（§2–§4），角落遮蔽需要 SSAO 另配。
