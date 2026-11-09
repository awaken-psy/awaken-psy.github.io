---
title: 05 GPU 资源与数据布局总表
publish: true
updated: 2026-09-20T06:52:54.753Z
---

# 05 GPU 资源与数据布局总表

> 回答"某个数据存在哪、什么格式、谁写谁读"。全部条目经源码核实（2026-09）；格式名 = 引擎 GraphicsFormat。

## 1. 面片系统（GIFacetScene）

### 1.1 persistent atlas（4096²，长期存储；BC 压缩行 = 存储格式）

| 图层 | 格式 | 写者 | 读者 |
|---|---|---|---|
| BaseColor | R8G8B8A8 → **BC7** | 光栅化搬运（CompressAndCopyRects） | 复合 kernel、直接光、取色 Visitor |
| Normal | R8G8 → **BC5** | 同上 | 复合（表面颜色×光时）、PixelOffsetToWorldSpaceNormal |
| Emissive | B10G11R11 → **BC6H** | 同上 | 复合（自发光项） |
| Depth | D24_UNorm → **BC4** | 同上 | 复合、取色深度校验 |
| Opacity | R8_UNorm → **BC4** | 同上 | 复合 |
| IndIrradiance | B10G11R11 | 复合 pass2 → CopyRects 回写 | 间接光射线取色、历史混合 |
| IndIrradianceFrameNum | R8_UNorm | 同上（归一化存储） | 面片历史混合（权重 1/8） |
| **Radiosity**（出射光） | B10G11R11 | DoCompositeRadiosity | **一切取色的核心**：屏幕层射线命中、面片间间接射线、光追回退取色 |

### 1.2 rasterize atlas（512² 工作台，帧内）

| 图层 | 格式 | 说明 |
|---|---|---|
| BaseColor / Normal | R8G8B8A8 | 本批面片重录属性（"FacetGBuffer" pass） |
| Emissive | B10G11R11 | 同上 |
| Depth | D32_SFloat_S8 | 同上 |
| DirectLighting | B10G11R11 | 每帧 `DispatchMemset` 清零 → DirectDiffuse/DirectionalDiffuse 写入 |
| VGVisBuffer / VGMaterialDepth（GPU-driven） | R32G32_UInt / D32_SFloat_S8 | VG 光栅化路径附加层 |

### 1.3 其他面片资源

| 资源 | 格式/类型 | 内容 |
|---|---|---|
| `persistentRadiance` | R32_SFloat 纹理 | 面片块级 SH 辐射缓存：每块 8×6=**48 个 float**（`shCoord = quadCoord×(8,6)+idx`） |
| `persistentRadianceNumFrames` | R32_SFloat | 每块累积帧数 |
| `GIFacetsBuffer` | 结构化 | 全部 `GIFacetGPU{worldToFacetRot, rectInAtlas(uint4), center, extent, orientation, isVisible}` |
| `GIFacetMeshRenderersBuffer` | 结构化 | 每渲染器：facetIndex span、isEmissive、orientationMasks0 |
| `rasterizeGPURequests` / `lightingGPURequests` | 结构化 | 本帧请求（`RasterizeDescGPU{facetID, log2Resolution, rect, oriRect, 优先级}`） |
| `validQuadsBuffer` / `quadCoordToValidQuadID` | 结构化 | 有效面片光照块列表与坐标映射 |

## 2. 级联粗场（GICascadedSDF）

| 资源 | 类型 | 内容 |
|---|---|---|
| `sdfMeshBricksData.encodedTexture3D` | 3D 纹理 R8_UNORM | 稀疏砖 atlas：UNORM[0,1] 编码 [−affectRadius,+affectRadius]（解码 `raw×SDFDecodeScale + SDFDecodeBias`） |
| `ClusterBuffer` | 结构化 | 每 cluster 一个 `uint4`——4 槽模型：低 24 位对象索引 + 高 8 位归一化距离（降序排） |
| mapping buffer（`ReadBrickIndex`） | uint32 结构化 | 世界砖坐标（经 brickShift 打包）→ atlas 砖号；`-1` = 无砖 |
| `dirtyRegionBuffer` | 缓冲 | 增量重建区域（前 3 个 dummy，`dirtyRegionStartOffset=3`） |
| `meshRendererForCascades[i]` | GPUFilter 输出 | 每级"影响本级的模型"过滤结果（级 i 复用级 i+1 的再过滤） |
| 砖分配 | `GPUItemAllocator` | `alloc()`/`pendingToFree`（延迟释放三 kernel） |
| cascadeMipmap（`enableSpreadMipmap`） | R8 3D | **当前被短路**（`LoadSrcDFValue` 返回 0） |

## 3. 精场（GISDFScene）

| 资源 | 类型 | 内容 |
|---|---|---|
| `sparseSDF.sdfMeshMappingGPUBuffer` | uint32 结构化 | 模型分段的砖映射（`Mesh0|Mesh1|…`；SpanAllocator 分配段，初始全 `sdfInvalidBrickIdx`） |
| `sparseSDF.sdfMeshBricksData` | TrackedGPUTexture3D R8_UNORM | 砖图集（`Mesh0 Brick0|Mesh0 Brick1|Mesh1 Brick0|…`），每砖 512 字节（8³×char） |
| `sdfMeshHeaderGPUBuffer` | 结构化 | 每 LOD 一条头（映射偏移等） |
| `sdfMeshRenderesCullingDataBuffer` | 结构化 | center/extent/radius/flags（注释标 flags 无用） |
| **`sdfMeshRenderesRenderingDataBuffer`** | 结构化 | **查询钥匙**：worldToVolume / volumeToWorld / lossyScale / sdfMeshLod0ID / facetMeshRendererID / isUDF |
| LOD 反馈 | bit buffer | 每 SDF ID 1 bit，GPU 写、CPU 异步回读 |

## 4. 屏幕层（QuadTraceSH / ScreenTraceSpecular / ViewContext）

### 4.1 QuadTraceSH（尺寸按 quadCount2D×8）

| 资源 | 格式 | 内容 |
|---|---|---|
| `hit` | R32 | 命中标记（一帧生命周期） |
| `hitPayloadBuffer` | 3×W×H uint4 | rendererIndex / hitPositionAndBias / hitNormal 三个 uint4 |
| hitDistance / radiance | — | 每块 8×8 texel 的射线结果区 |
| `framesAccumlatedPerQuad` | R8 | 每块累积帧数（历史可靠度） |
| 历史块 SH | int3 定点 ×2²⁰ | `SphericalHarmonicsInt` 原子累加 |

### 4.2 每相机输出/状态（ViewStateURP/HDRP，history/next 双缓冲）

| 资源 | 格式 | 内容 |
|---|---|---|
| outputDiffuse | B10G11R11 | 间接漫反射 |
| outputRoughSpecular | B10G11R11 | GI 粗糙镜面 |
| outputCompositeSpecular | B10G11R11 | 反射⊕粗糙高光合成 |
| outputReflectionSpecular | B10G11R11 | 反射分量（+R32 specularAccumulationCount 累积计数） |
| outputNumFrames | R8_UNorm | 累积帧数（**归一化 0..1，读时 ×framesLimit**） |
| depthBuffer | R32_SFloat | 校验用（只存 1 帧） |
| worldNormalBuffer | B10G11R11 | `0.5n+0.5` 编码（只存 1 帧） |
| bentNormalBuffer | B10G11R11 | 弯法线（`×0.5+0.5` 编码） |
| outputTransparentSpecular | B10G11R11 | HDRP 透明镜面路径 |

### 4.3 ScreenTraceSpecular

| 资源 | 格式 |
|---|---|
| directionTexture | R16G16B16A16_SFloat（xyz 方向 + w pdf） |
| hitRadianceTexture / resolvedRadiance / reprojectedReflection | B10G11R11 |
| hitDistanceTexture / hitDeviceZTexture | R32_SFloat |
| validTileCountBuffer / validTileBuffer | uint / uint2 |

## 5. 输入（由 URP/HDRP 传入 ViewContext）

| 资源 | 说明 |
|---|---|
| `depthPyramid`（Texture2DArray）+ `depthMipOffset`（int2 buffer） | Hi-Z 金字塔与逐层偏移（`SampleHZB` 用） |
| `normalBuffer` | w 通道 = 1−perceptualRoughness（还原 `1-w`） |
| `motionBuffer`（Texture2DArray） | 运动矢量（`DecodeMotionVector3D`：UNORM×65535→int16 符号扩展→/32767，zw 拼位→asfloat→×0.5） |
| `colorBuffer` | ①级取色来源（上一帧最终画面） |
| GBuffer0..3 / cloudBuffer | 材质 flag/粗糙度（URP 用得少，HDRP 走完整 BSDF） |
| 光源数据缓冲 | `GIDirectionalLightData` / `GILightData`（HDRP）/ `GILightDataURP` 三套布局 |

## 6. 硬件光追（GIHWRTScene）

| 资源 | 内容 |
|---|---|
| `HWRTVertexGPUBuffer` | 交错顶点：position + u + normal + v |
| `HWRTTriangleGPUBuffer` | uint3 索引 |
| `HWRTRendererGPUBuffer` | worldMatrix / HWRTMeshID / firstVertex / firstTriangle / **facetMeshRendererID** |
| `rayAccelStruct` | 引擎 `RayTracingAccelerationStructure`（自建 native TLAS 路径 `#if 0` 未启用） |

## 7. 编码约定速查

| 编码 | 用在哪 |
|---|---|
| `PackRGBE_sqrt` | 命中载荷 radiance、重要性采样历史（开方版换小值精度） |
| `×2^20` 定点 int3 | SH 系数原子累加（SphericalHarmonicsInt） |
| `0.5n+0.5` | 法线/弯法线入 [0,1] 纹理 |
| R8 归一化帧数 | outputNumFrames、IndIrradianceFrameNum |
| 低24+高8 位打包 | ClusterData 槽（对象索引+距离） |
| 4 voxel/uint | 离线 SDF 量化（每体素 8bit） |
| Reinhard 压缩 | 反射时间累积的颜色存储（c/(1+c) 存、读回 c/max(1−c,1e-4)） |
