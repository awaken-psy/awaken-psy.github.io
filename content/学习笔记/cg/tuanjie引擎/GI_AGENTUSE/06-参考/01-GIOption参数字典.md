---
title: 01 GIOption 参数字典（全模块汇总）
publish: true
updated: 2026-09-20T10:06:42.975Z
---

# 01 GIOption 参数字典（全模块汇总）

> 全模块 `GIOption<T>::Add(默认值, 名字, 注释)` 的汇总——注释为源码原文（括注中文翻译）。按子系统分组。**运行时调参以此表为准；参数名前缀即子系统名。**

## GIForURP（TuanjieGIForURP.h:308–311）

| 名字 | 类型 | 默认 | 注释原文 |
|---|---|---|---|
| `GIForURP.referenceNear` | float | 2 | Set this value to fake bilateral sigma near plane.（双边滤波 σ 的近平面参考值） |
| `GIForURP.referenceFar` | float | 128 | Set this value to cascade SDF AABB extent.（级联 SDF 包围盒远面参考值） |
| `GIForURP.interleavedUpdate.enable` | bool | **true** | enable Quad interleaved updating（采样块交错更新） |
| `GIForURP.temporalReprojection.maxFrames` | int | **8** | Max accumulated frames for temporal reprojection（像素层历史累积上限；实际 = clamp(round(8×updateSpeed),1,20)） |

## GIForHDRP（TuanjieGIForHDRP.h:509–511）

同 URP 的 referenceNear(2)/referenceFar(128)/reprojectionMaxFrames(8)，前缀 `GIForHDRP.`；**无 interleavedUpdate 选项**（对应 ViewContext 固定 false）。

## QuadTraceSH（GITracing/QuadTraceSH.h L156–236；全部字段名/默认值/注释已逐条核验，本表即完整汇总）

| 字段（注册名） | 默认 | 注释原文 |
|---|---|---|
| `.interleavedUpdate.size` | 4 | number of quads to be used in interleaved update.（交错分组 4×4=16 组轮换） |
| `quadInterval`（字段） | 8 | 块边长（被接入层 `finalGatherQuadInterval=16` 覆盖） |
| `.integrate.Size` | 5 | Range 2 - 7, Default is 5（摊回邻域；permutation clamp 2–7） |
| `boxFilterKernelSize`（字段） | 5 | 盒滤波核 |
| `.blendHistoryQuads.minFrameCount` | 2.f | Frames to accum for fast moving object（历史权重下限） |
| `.blendHistoryQuads.maxFrameCount`（字段 `blendHistoryQuadsMaxFrameCount`） | 16.f | Frames to accum for static object（上限） |
| `historyDist`（字段） | 0.01 | 历史可信距离 |
| `borrowFalloff`（字段） | 100 | 邻块借光衰减率 |
| `integrateDistanceReject`（字段） | 100 | 摊回深度拒绝阈值 |
| `integrateEnableBentNormal` | true | Default to enable.（摊回是否用弯法线求值；**实际被 `vctx.useBentNormal` 覆盖——HDRP true / URP false**，关闭时求值回退世界法线） |
| `enableSeperableFilter` 等（字段） | true | 可分离滤波/块级历史混合/快速摊回三个开关 |

> 混合权重实际公式：`lerp(1/minFrameCount, 1/maxFrameCount, historyFrames)`（QuadTraceSH.h L1528/L1630）——界值之间连续插值，非硬钳制。

## FacetScene（GIFacetScene.h，前缀 `FacetScene.*`）

| 名字 | 类型 | 默认 | 注释原文 |
|---|---|---|---|
| `…GIFacetScene.facetMaxResolutionLog2` | int | 6 | Max log2 facet resolution(effective: 3 - 9, values higher or lower will be clamped) |
| `…enableFacetInstancing` | bool | true | When enable, it will use instancing to render facets, which can reduce draw call but may cause more GPU memory usage and worse performance when facet count is low. |
| `…renderGizmos` | bool | false | When enable, this will slow down the framerate. |
| `DirectLighting.enable` | bool | true | Default to enable. |
| `DirectLighting.UnlimitedShadowLights.enable` | bool | true | When enabled, all lights contribute to the direct lighting and shadowing.（选择 Loop 版实现） |
| `DirectLighting.InlineRayTracing.enable` | bool | true | Use inline ray tracing for direct lighting shadows when available.（仅 HWRT 平台） |
| `DirectionalLighting.enable` | bool | true | Default to enable. |
| `IndirectLighting.enable` | bool | true | Default to enable, when disable, no multibounce GI is computed. |
| `IndirectLightingHistory.enable` | bool | true | Blend with history radiosity to get infinite bounces. |
| `baseColor.enable` | bool | true | When disable, the base color is se to 1.（原文如此） |
| `DirectLighting.visualizeIrradiance` | bool | false | Output an additional direct irradiance buffer. |
| `finalLighting.zeroOutIndirect1`（与 2 同名注册，**疑为笔误**） | bool | false | Debug feature: Output black to indirect result on 1st/2st pass of finallighting. |

另有三处 `depthAttenuation`（float 0.25，"Controlling the sensitivity of bias to depth"）：`GIFacetSceneGather`（h:759）、`GIFacetSceneDebugLoad`（h:798）、`GIRadianceCacheSH`（h:903）。

## Tracer 们

| 名字 | 默认 | 注释原文 |
|---|---|---|
| `cdfTracer.traceMaxDistance`（CascadedSDFTracer.h:46） | 1000 | Tracer max distance. |
| `sdfTracer…traceMaxDistance`（GISDFTracer.h:36） | 1000 | Tracer max distance. |
| `clusterTracer…traceMaxDistance`（GIClusterTracer.h:32） | **1** | Tracer cluster count.（**名字与注释错位**——语义是 cluster 数预算） |
| `rayTracer…traceMaxDistance`（RayTracer.h） | 1000 | Tracer max distance. |
| `screenTracer.traceMaxDistance`（ScreenTracer.h:12） | **50** | Tracer max distance. |
| `screenTracer.vignetteScale`（:13） | 2 | SSR vignette falloff scale. Smaller value = wider falloff region. |
| `occludeFactor`（GICascadedSDF.cpp:38） | 0.5 | Set this to avoid light leaking.——**只接在 RayMarchingJumped 上，当前无调用者，调参无效** |
| `hwrtSceneEnable`（GIHWRTScene.h） | — | 硬件光追场景总开关（HasValidData 判据之一） |

## ScreenTraceSpecular（前缀 = 名字 + '.'）

| 名字 | 默认 | 注释原文 |
|---|---|---|
| `.enableReflection` | true | Enable TuanjieGI Reflection. |
| `.enableReflection.sdfTrace` | false | enable reflection sdf trace |
| `.enableReflection.clusterTrace` | false | enable reflection cluster trace |
| `.enableReflection.cdfTrace` | true | enable reflection cdf trace |
| `.enableReflection.inlineRayTrace`（HWRT） | false | enable reflection inline ray trace |
| `.enableReflection.rayTrace`（HWRT） | true | enable reflection ray trace |
| `.MaxRoughnessToTrace` | 0.4 | Max Roughness of pixel reflection. |
| `.MaxRoughnessBackfaceDiffuseToTrace` | 0.2 | Max Roughness for backface diffuse material of pixel reflection. |
| `.MinResolveKernelRadius` / `.MaxResolveKernelRadius` / `.ResolveKernelScale` | 1.0 / 8.0 / 2.0 | 解析核半径与缩放（注释空） |
| `.MinSpatialFilterKernelRadius` / `.MaxSpatialFilterKernelRadius` / `.spatialFilterKernelScale` | 1.0 / 3.0 / 2.0 | 空间滤波核（注释空） |
| `.ResolveNeighborSampleNum` / `.SpatialFilterNeighborSampleNum` | 16 / 16 | 邻域样本数（注释空） |
| `.reprojectMaxFrame` | 16.0 | 反射时间累积上限（注释空） |
| `.minResolveClampedWeight` | 1e3 | 解析归一化下限（注释空） |
| `.enableHitLight` / `.enableSkyLight` | true / true | Default to enable. |

（另有被注释的 `enableReflectionScreenTrace`："use screen trace control in global volume options instead"——屏幕追踪开关移到了全局 Volume。）

## 弯法线

| 名字 | 默认 | 注释原文 |
|---|---|---|
| `BentNormal.sampleDistance`（GISampleBentNormal.h:81） | **0.35** | Default 0.35.（遮挡检查距离，米） |
| `BentNormal.sampleNumber`（h:82） | **4** | Range 1 - 5, default is 4.（方向数；permutation clamp 1–6） |
| `GITraceBentNormal.numSample/numTraceStep`（h:29/30） | 8 / 30 | 射线版：方向数/步数（maxDistance=100） |

## 可视化开关（`AddVisualize`，初值恒 false）

全部形如 "When enable, this will slow down the framerate, since it cost GPU time to render the TuanjieGI XXX."，分布在：`GILightDataVisualize`、`GISDFVisualize`、`GICascadedSDFVisualize`、`GITraceVisualize`、`GIDirSampleVisualize`（另有 enableTraceDir/enableDotSign 两个）、`GIGBufferVisualize`、`InlineRaytracingVisualize`、`RaytracingVisualize`。

## 使用须知

1. **C# 调参**：`TuanjieGIOptions.bindings.cs` 按 id 读写（`SetBoolOption/SetIntOption/SetFloatOption`），`MarshalOptions()` 拉全表构面板。
2. **同名不同物**：三处 `depthAttenuation`、两处 `traceMaxDistance`（50/1000）、`reprojectMaxFrame`（镜面 16）与 `reprojectionMaxFrames`（像素层 8）——注意区分。
3. **已核实失效项**：`occludeFactor`（无调用者）、`writeBlackToIndIrradiance` 的第 2 个注册名与第 1 个重复（应为 zeroOutIndirect2）。
