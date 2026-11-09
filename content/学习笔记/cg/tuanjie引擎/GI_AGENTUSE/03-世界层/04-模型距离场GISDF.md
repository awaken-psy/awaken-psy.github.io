---
title: 04 模型距离场 GISDF（精场）
publish: true
updated: 2026-09-20T06:53:40.257Z
---

# 04 模型距离场 GISDF（精场）

> 源文件：`GISDF/GISDFMesh.h`（资产与常量）、`GISDF/GISDFScene.h/.cpp`（场景登记与查询）、`GISDF/GISDFTracer.h`（②级全程）、`GISDF/GIClusterTracer.h`（②级短程）、`GISDF/GISDFVisualize.h`
> 作用：每个静态模型一份局部空间的稀疏距离场（**精场**），由离线资产生成（[06-数据构建GIDataBuilder](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/06-数据构建GIDataBuilder.md)），运行时只做登记、增量上传与查询。
> 前置阅读：[../01-背景知识/04-SDF与球体步进](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/04-SDF与球体步进.md)；与粗场的分工见 [03-级联距离场GISDFExt](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/03-级联距离场GISDFExt.md) §4

## 1. 资产结构（GISDFMesh）

资产挂在 `Mesh` 上（`mesh->GetGISDFMesh()`），按 **`sdfLODCount = 3`** 个 LOD 存储（砖尺寸逐级翻倍；**当前离线只生成 level 0**，GIDataBuilder 的 LOD 循环 `for(level=0; level>=0; --level)` 只跑一轮，TODO 注释 "match shader"）。每 LOD 含：

- `brickMappingSize`：3D 砖网格尺寸；
- `SDFDecodeBias / SDFDecodeScale`：`raw×Scale + Bias` 解码回带符号距离（`Scale=2×maxEncodeDistance×localToVolumeScale`、`Bias=−maxEncodeDistance×…`）；
- `volumeToMappingScale/Bias`：体素坐标 → 映射表坐标；
- `activeBrickIDs`（排序后的活跃砖线性坐标）+ `activeBrickData`（量化距离数据，每砖 `sdfBrickBytes=512` 字节）。

常量（GISDFMesh.h L9–L21，全部核实）：`sdfBrickVoxels=8`（每砖 8³ 体素）、`sdfBrickSizeInVoxels=7`（texel 数=8−1）、`sdfBiasInVoxels=0.25`、`sdfInvalidBrickIdx=0xFFFFFFFF`、`sdfMaxResolusion=128`、`sdfLocalSpaceVoxelDensity=20.0`、`sdfMaxEncodeScale=4`、`rayMarchingMaxCount=64`（精场 march 上限）、`sdfThinPlaneScale=100`（薄面最小缩放）。

## 2. 运行时场景（GISDFScene）

### 2.1 数据成员

- `GISparseSDF`：`sdfMeshMappingGPUBuffer`（uint32 结构化——世界 brick → 运行时砖号映射）+ `sdfMeshBricksData`（**TrackedGPUTexture3D**，R8_UNORM 稀疏砖图集）。**布局**（GISDFScene.h L215–L230 注释）：mapping 按模型分段 `Mesh0|Mesh1|...`，砖图集按 `Mesh0 Brick0|Mesh0 Brick1|Mesh1 Brick0|...` 排布。
- `sdfMeshHeaderGPUBuffer`：每 LOD 一条头记录（映射偏移等）。
- `sdfMeshRenderesCullingDataBuffer`：剔除用（center/extent/radius；flags=is2Sided，注释标"无用"）。
- **`sdfMeshRenderesRenderingDataBuffer`**（查询的钥匙，GISDFScene.cpp:406–423）：

```cpp
volumeToWorld = rendererLocalToWorld × sdfMesh->volumeToLocal;
worldToVolume = Invert_General3D(volumeToWorld);
// 每渲染器：worldToVolume / volumeToWorld / volumeToWorldLossyScale（非均匀缩放校正）
//           sdfMeshLod0ID / facetMeshRendererID / isUDF
```

`facetMeshRendererID` 由面片场景登记时写入——**SDF 命中 → 面片取色**的 ID 桥梁。

### 2.2 登记与增量（UpdateMeshesAndRenderers，GISDFScene.cpp:219–401）

渲染器的增删改经 SceneWatcher 进来（机制全景见 [../05-集成与工程/04-增量更新与事件机制](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/04-增量更新与事件机制.md) §7）：

- 新渲染器：`sdfMeshRuntimeIDAllocator.Allocate(LODs.size())` → 逐 LOD `AllocLOD`（活跃砖 `AllocDisContinue` 领运行时砖号、映射段 `sdfMeshMappingAllocator.Allocate`、初始全置 `sdfInvalidBrickIdx` 再填活跃砖）；
- 移除：`FreeLOD`（释放数据**不释放 ID**）+ 释放 ID 段 + `dirtyRegion` 记录旧 AABB；
- 移动：AABB 平方距离 >1 才记 dirty（新旧两块），否则合并区域；
- **LOD 反馈环**：GPU 回读 per-ID 位图（哪些 LOD 真被用到）→ 异步消费上帧结果 → Alloc/FreeLOD 对应级；
- 上传：header/mapping/brick 三个 `ApplyDiff`；`dirtyRegion` 上传给级联粗场做增量重建（`onSDFSceneFrameUpdate.Emit(fctx)` 触发 GICascadedSDF 的每帧更新）。

### 2.3 查询原语（GISDFScene.h）

- `LoadDistance`：`sample` 带硬件三线性插值（LINEAR+CLAMP）+ 解码。
- **`RayMarchingVS`**（L370–L400）：单模型 march——阈值 `clamp(0.25×已走距离, 0, SDFBiasDistance())`，**命中判 `abs(distance) < 阈值`**（取绝对值——UDF 兼容；与级联版的 `distance <` 不同）；步数上限 `rayMarchingMaxCount=64`。
- `TraceSdfMesh<isAdjustOriginWhenInside>`（L430–L500）：AABB 相交 + march；**起点在盒内且读数 <0 直接判命中**（inside 起点的合法处理）。
- `CalculateDistanceFromPointToSurface`（L505–L545）：用 `volumeToWorldLossyScale` 做非均匀缩放的距离校正。
- `GISDFTraceResult`：`{hitPosition, isHit, hitNormal, hitDistance, facetMeshRendererID, hitCascadeIndex}`（Init `hitCascadeIndex=-1`）。

## 3. 两个 tracer（②级）

- **`SDFTracer`**（GISDFTracer.h）：`traceMaxDistance` 默认 1000（实取 `min(它, fctx.maxDistance)`）、`sampleBias=0.2`。查询哪几个模型由调用方决定（cluster 索引表或遍历）。
- **`ClusterTracer`**（GIClusterTracer.h）：短程版——先查**起点与预算终点所在 cluster** 的索引表（每格 ≤4 模型），只在预算内进精场；`traceMaxDistance` 默认 **1**，注释写 "Tracer cluster count."（**选项名与语义错位**：实际含义是 cluster 数预算）；命中 `hitDistance = startInWorldSpace.maxDistance`。面片朝灯的遮挡检测线走这一级。

## 4. 与级联粗场的关系

| | 精场（本页） | 粗场（级联） |
|---|---|---|
| 空间 | 模型局部空间 | 相机周围世界空间（4 级） |
| 生成 | **离线**（资产） | **运行时**每帧增量（把精场重采样进 atlas） |
| 存储 | 每模型独立稀疏砖图集 | 一张全局稀疏 3D 纹理 + cluster 索引表 |
| 查询 | 需要知道"查哪个模型" | 索引表自动找模型 |
| 命中阈值 | `abs(0.25×已走距离)` | `min(半体素, 沿途最大读数)` |

级联生成时 `ValidateActiveBricks/WriteCascadeSDF` 调 `CalculateDistanceFromPointToSurface` 读的就是本子系统登记的精场数据——**粗场是精场的运行时重采样聚合**。

## 5. 可视化（GISDFVisualize.h）

`SDFNormalVisualizer`/`GISDFVisualize`：8×8 kernel 从相机打射线多次 trace 取最近命中，输出法线/级联信息（`hitCascadeIndex >= 0` 判据）；`ExecuteVisualize` 挂在编辑器可视化事件上。另有 GICascadedSDFVisualize 画级联结构/脏区域/砖分配（[03-级联距离场GISDFExt](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/03-级联距离场GISDFExt.md) §10）。

## 6. 快速问答

**Q：精场 march 为什么 64 步、级联 128 步？**
A：单模型盒子小（`sdfMaxResolusion=128` 体素封顶），64 步足够穿过；级联覆盖整个世界、步距随读数变化大，128 步上限保证掠射也收敛。

**Q：isUDF（无符号）模型怎么判"在内部"？**
A：UDF 没有内部——march 命中判 `abs(distance)<阈值`，起点在内也只算"贴近表面"。树叶影边发糊的固有代价即源于此（[../01-背景知识/04-SDF与球体步进](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/04-SDF与球体步进.md) §6）。

**Q：`volumeToWorldLossyScale` 是什么？**
A：变换的"有损缩放"分量（各轴缩放绝对值）——非均匀缩放的模型上，体素距离换算回世界距离要用它逐轴校正。
