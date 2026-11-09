---
title: 06 数据构建 GIDataBuilder（离线资产生成）
publish: true
updated: 2026-09-20T06:53:49.002Z
---

# 06 数据构建 GIDataBuilder（离线资产生成）

> 源文件：`GIDataBuilder/GIDataBuilder.h/.cpp`（cpp 约 98KB）、`GIDataBuilder/GIDoubleSided.h`、`GIDataBuilder/RadeonRaysHelper.h/.cpp`
> 仅在 `PLATFORM_TUANJIEGI && UNITY_EDITOR` 下编译。作用：资产导入时把普通 Mesh 烘成两份 GI 资产——`GISDFMesh`（模型距离场）与 `GIFacetMesh`（面片网格），运行时直接使用，不再现场计算。
> 前置阅读：[../01-背景知识/04-SDF与球体步进](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/04-SDF与球体步进.md) §1；产物消费见 [04-模型距离场GISDF](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/04-模型距离场GISDF.md) 与 [02-面片系统GIFacet](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/02-面片系统GIFacet.md)

## 1. 触发与构造

入口在 TuanjieGIManager.cpp `GenerateTuanjieGIMesh`（L528–L538）：

```cpp
GIDataBuilder builder(mesh, renderer, modelScale, maxFacetNum, DoubleSidedMode, sdfGenBias, GetDSLDevice());
if (builder.isValid()) {
    BuildGISDFMesh(mesh->GetGISDFMesh());   // SDF 资产
    BuildGIFacetMesh(mesh->GetGIFacetMesh()); // 面片资产
}
```

`Init()`：新建命令缓冲，`RadeonRaysManager.InitializeSize(50000)`；失败则 `m_isValid=false`。随后在 GPU 上分两步：`"Build BLAS"` → `BuildBLAS(cmd, doubleSidedMode)`、`"Build TLAS"` → `BuildTLAS(cmd)`。即**离线阶段先建好 BVH**，后续 SDF/面片测量全部用 GPU 光线求交来做。

`GIDoubleSided.h` 枚举：`kDoubleSidedModeFollowMaterial`（读材质 `_DoubleSidedEnable`）/ `kDoubleSidedModeSingleSided` / `kDoubleSidedModeDoubleSided`。

## 2. SDF 资产生成：`BuildGISDFMesh`

### 2.1 先决定有符号还是无符号（`ForceUDF`）

遍历每个 submesh 统计三角形数与双面三角形数（按 DoubleSidedMode 判定每 submesh 双面与否）：

```cpp
return doubleSideTriNum * 4 >= totalTriNum;   // 双面三角 > 25% → 整个 mesh 转 UDF
```

理由（原理见 [01-背景知识/04-SDF与球体步进](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/04-SDF与球体步进.md)）：开放表面（树叶、栅栏、布料）没有明确内外，强行造有符号场会产生方向翻转伪影，改存无符号距离。结果写入 `outSDFMesh->is2Sided`。

### 2.2 尺寸与体素化（`CalculateSDFSize`）

- 输入 AABB = `mesh->GetLocalAABB()`，各轴 extent 下限 0.01，按 `meshScale` 缩放；
- 期望砖尺寸 `desiredBrickSize = (sdfBrickVoxels-1)/sdfLocalSpaceVoxelDensity`（常量来自 `Utility/GlobalConfig.h`）；
- 每维砖数上限 `sdfMaxResolusion/(sdfBrickVoxels-1)`；UDF 时额外外扩 0.5 体素；
- 为 `sdfLODCount` 个 LOD 逐级计算砖数——**砖尺寸逐级翻倍**（金字塔：近 LOD 细、远 LOD 粗）。

### 2.3 GPU 测量（`GetSDFBuildShader`）

关键常量（GIDataBuilder.cpp 顶部）：`kSampleCount=32`、`kMaxSurfelCandidateSamplePerThread=48`、`kMaxSurfelCellNumPerVoxel=64`、`kDotThreshold=0.25`、每砖 `perBrickSizeIn32Bit=128` 个 uint、着色器内 `brickEdgeLen=8`、线程组 `configure_block(4,4,4)`。

每体素两步：

1. **最近距离**：`PointQuery(voxelPosition, ..., maxTraceDistance, maxEncodeDistance/255)` 向 BVH 查最近表面距离，写入共享内存 `distanceFieldVolume`（512 float = 8³ 体素）。
2. **内外判定**（仅当该砖贴近网格且非 FORCE_UDF）：对体素做 **100 次全球面方向采样**（HammerSley 序），`TraceRaySoftware(CULL_MODE_NONE)` 统计 `hitNum`（总命中）与 `innerHitNum`（背面命中）：

```cpp
if (hitNum > 0 && innerHitNum * 4 > sampleNum)   // 背面命中 > 25% → 在内部
    distanceFieldVolume[index] = -distanceFieldVolume[index];   // 负号 = 内部
```

即"内外"靠射线穿透统计判定：从体素往外射 100 条，若超过四分之一的命中是三角形背面（面朝里的那一侧），该点在几何内部。

3. **量化打包**：`rescaled = (d + maxEncodeDistance)/(2×maxEncodeDistance)` → `clamp(rescaled×255+0.5)`，**4 个体素打包进一个 uint**（每体素 8 bit）写入 `brickDataBuffer[validBrickId×128 + offset/4]`。
4. **活跃砖记录**：`atomicAdd` 计数 + `activeBricksBuffer[validBrickId] = 线性化砖坐标`。

### 2.4 CPU 收尾与输出 `GISDFMesh`

- 回读 `activeBrickNum`、`activeBrickIDs`、`activeBrickData`；对砖 ID **QSort 排序**并按偏移重排数据（保证映射表有序）；
- 写入 LOD 字段：`brickMappingSize = intBrickNum`、**`SDFDecodeBias = −maxEncodeDistance×localToVolumeScale`、`SDFDecodeScale = 2×maxEncodeDistance×localToVolumeScale`**（运行时按 `raw×Scale + Bias` 解码回带符号距离）、`volumeToMappingScale/Bias`（体素→映射表坐标）；
- `localAABB` 用 `1/meshScale` 反变换回 mesh 局部空间；`is2Sided = forceUDF`；`sdfGenBias` 原样存储。

> **注意（源码如实记录）**：`BuildSDFData` 的 LOD 循环写作 `for (int32_t level=0; level>=0; --level)`，实际只跑 level 0，注释 "TODO: match shader"——多 LOD 生成当前未完成。

## 3. 面片资产生成：`BuildGIFacetMesh`

若 `maxFacetNum <= 0` 直接返回。目标是把表面切成一组小矩形面片（光照采样单位）。

### 3.1 体素划分

```cpp
maxSizeInVoxels = clamp(maxDim/0.1 + 0.5, 1, 64);   // 最小体素 0.1 米，最多 64 格
voxelSize = max(maxDim/maxSizeInVoxels, 0.1);
sizeInVoxels[i] = clamp(round(boundSize[i]/voxelSize), 1, 64);
```

### 3.2 六方向投影采样（GPU）

对 **±X/±Y/±Z 六个轴向**各做一遍（`SizeInVoxelsDimsData[6][3]`、`SurfelOffetCandidateData[6]` 记录各面维度与偏移）：

1. `GetGenerateCandidateSurfelsShader`（每面 dispatch `(Vx+7)/8 × (Vy+7)/8`）：沿该轴 ray trace，`kSampleCount=32` 次采样；命中处按 `NdotL ≥ kDotThreshold(0.25)` 生成候选 `FacetSurfelSample{hitPosition, hitVoxelCoordZ, hitNormal, rayOriginCoordZ}`，每线程最多 48 个候选，按 `(hitVoxelCoordZ, rayOriginCoordZ)` 本地冒泡排序。
2. `GetFilterCandidateSurfelsShader`：对每个体素 cell 分组 span；再对每个候选做 **8×8=64 次半球反向 ray trace** 判定其是否在几何内部：

```cpp
isInsideGeometry = (totalHitSamples > 0.8*64) && (totalInnerHitSamples > 0.2*64);
// 非内部才保留；scopeWeights = scope * (1 + totalVisibleSamples/64)
```

以 `interlocked_add` 紧凑写入 `FacetSurfelLayout{voxelCoord, rayOriginCoordZ, scope, scopeWeights}`。

### 3.3 Cluster 生长与输出（CPU+GPU）

1. `GetCompactOffsetBufferShader` / `GetCompactSurfelsBufferShader`：六方向计数前缀和 + 紧凑化；
2. `GetBuildClusterShader`：每方向一组 8×8 线程，共享内存做 **64→1 归约取最大 scopeWeights** 的 cluster 生长，准入条件 `(scope/area) > 0.01 && scopeWeights ≥ 0.15`，cluster 缓冲上限 384；
3. CPU 回读 `clusterCount`，按 `scopeWeights > direction > rayOriginCoordZ` QSort；每个 cluster 结合局部 AABB 与体素边界算 min/max，构造 `GIFacetInfo{facetToRenderer（位置+三轴）, orientation}`；**超过 `maxFacetNum` 截断**；最后乘 `1/meshScale` 回 mesh 空间。

## 4. RadeonRaysHelper：第三方 BVH 封装

- 底层是 **AMD RadeonRays**（第三方，位于 `Utility/RadeonRays/`：HlbvhBuilder、HlbvhTopLevelBuilder、RadixSort、Scan、RestructureBvh、AccStruct 等）。
- `RadeonRaysManager`（`RadeonRaysHelper.h`）持有 `TopLevelAccStruct` + `RadeonRaysAPI`；`InitializeSize(rayCount=50000)`；`BuildBLAS/BuildTLAS(cmd, doubleSidedMode)`；`SetTrace*` 系列把 GPU 求交配置给 DSL 侧。
- 数据结构：`RayWithFlags{origin, minT, direction, maxT, culling, instanceMask}`、`Hit{instanceID, primitiveIndex, uvBarycentrics, hitDistance, isFrontFace}`、`HitGeomAttributes{position, normal, faceNormal, uv0, uv1}`、`MeshInstanceDesc`。
- 自由函数 `UniformSampleSphere/UniformSampleHemiSphere` 供采样方向生成。

## 5. 与运行时的对接

| 产物 | 存进 | 运行时消费者 |
|---|---|---|
| `GISDFMesh`（砖映射 + 编码距离 + 解码参数 + LOD） | `Mesh::GetGISDFMesh()` | `GISDFScene` 登记为模型精场（[04-模型距离场GISDF](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/04-模型距离场GISDF.md)）；级联粗场把它重采样进 atlas |
| `GIFacetMesh`（`GIFacetInfo` 列表：位置、三轴、朝向） | `Mesh::GetGIFacetMesh()` | `GIFacetScene` 注册面片、分配图集页（[02-面片系统GIFacet](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/02-面片系统GIFacet.md)） |

## 6. 快速问答

**Q：SDF 是怎么"量"出来的？**
A：GPU 上建 BVH 后，每个体素向最近三角形发 PointQuery 得无符号距离；再以 100 条全球面射线统计背面命中比例（>25% 判内部）决定符号；最后 8 bit 量化、4 体素打包一个 uint。

**Q：面片是怎么切出来的？**
A：六个轴向各把表面投影到 2D 体素网格（体素最小 0.1 m，最多 64³），ray trace 采样候选、64 次反向半球射线剔除几何内部的候选，按可见度权重聚类生长，CPU 排序截断到 `maxFacetNum`。

**Q：什么资产会变成 UDF？**
A：材质声明双面（或被强制双面）的三角形占比超过 25% 的 mesh——整个 mesh 的距离场按无符号处理，运行时步进用 `abs` 判命中（见 [04-模型距离场GISDF](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/04-模型距离场GISDF.md)）。
