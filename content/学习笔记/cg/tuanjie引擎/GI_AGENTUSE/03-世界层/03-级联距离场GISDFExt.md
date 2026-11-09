---
title: 03 级联距离场 GISDFExt（世界层的几何索引）
publish: true
updated: 2026-09-20T06:33:35.703Z
---

# 03 级联距离场 GISDFExt（世界层的几何索引）

> 源文件：`GISDFExt/GICascadedSDF.h`（约 1181 行）、`GISDFExt/GICascadedSDF.cpp`、`GISDFExt/CascadedSDFTracer.h`、`GISDFExt/GICascadeMipSpreading.h`、`GISDFExt/GICascadedSDFVisualize.h/.cpp`
> 作用：在相机周围建一张"近处细、远处粗"的稀疏距离场，加上模型索引表，让任意 GI 射线能快速回答"这个世界方向上撞到了什么、撞在哪"。
> 前置阅读：[../01-背景知识/04-SDF与球体步进](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/04-SDF与球体步进.md)、[../02-代码方言/01-Oceanus-DSL速成](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/02-代码方言/01-Oceanus-DSL速成.md)

## 1. 职责定位

GI 射线（屏幕层采样块发出的 64 条、面片算间接光发出的）都要做命中查询。逐三角形求交太贵且不通用，本模块主力方案是**距离场（SDF）**：

- 每个模型有一份**精场**（模型局部空间，见 [04-模型距离场GISDF](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/04-模型距离场GISDF.md)）；
- 相机周围合成一张**级联粗场**（本子系统）：距离近的级联格子细，远的粗——查询射线先在粗场里大步推进，接近表面时通过**索引表**找到该处的模型，转入精场精确判定。

## 2. 层次结构：cascade → node → brick → cluster → voxel

GICascadedSDF.h 顶部常量（L17–L40，逐条核实）决定了整个层次：

| 常量 | 值 | 含义 |
|---|---|---|
| `numCascades` | 4 | 级联数：4 层，每层覆盖范围翻倍 |
| `kAffectVoxels` | 4 | 距离场每个体素存储的影响半径（体素数）：编码范围 ±(4×体素) |
| `kLog2BrickResolutionInClusters` | 2 | 每砖 4×4×4 个 cluster |
| `kWorldNumBricksPerUnitOfCascade0` | 2.0 | 0 级每单位世界的砖数（影响 0 级砖尺寸 = 0.5×GIDistance） |
| `Log2CascadeResolutionInNodes` | 3 | 每级联 8×8×8 个 node |
| `kLog2NodeResolutionInBricks` | 2 | 每 node 4×4×4 个 brick（源码注释：必须为 2） |
| `cascadeResolutionInBricks` | 32（1<<5） | 每级联 32×32×32 个 brick |
| `cascadeResolutionInClusters` | 128（1<<7） | 每级联 128×128×128 个 cluster |
| `cascadeBufferSize` | 131072（32³×4） | 每级联的 cluster 总数上限 |
| `sparsity` | 0.5 | 稀疏率：最多一半 cluster 有砖 |
| `cascadeDFSpreadingInVoxels` | 4 | mip 扩散用的体素步 |
| `UnsignedTraceThresholdScale` / `SignedTraceThresholdScale` | 0.6 | UDF/SDF 追踪阈值缩放 |
| `rayMarchingMaxCountCDF` | 128 | **级联 march 步数上限 128** |
| `cascadeFacetSampleBiasScale` | 3/cascadeMipResolution | tracer 取面片色的采样偏移比例 |

结构自上而下：**级联**（4 层，半径逐级翻倍）→ **node**（8×8×8）→ **brick**（每 node 4×4×4，即每级联 32×32×32 砖）→ **cluster**（每砖 4×4×4，即每级联 128³）→ **voxel**（每 cluster 内的体素）。

### 2.1 级联半径与体素尺寸（GICascadedSDF.cpp）

```cpp
// cpp 顶部半径公式（L15-L27）
worldBrickSizeOfCascade0 = (1/kWorldNumBricksPerUnitOfCascade0) * GIDistance;  // = 0.5×GIDistance
CascadeRadius0 = worldBrickSizeOfCascade0 * cascadeResolutionInBricks / 2;
GetFacetMaxDistance = CascadeRadius0 * (1 << numCascades);   // 面片最大查询距离 = R0×16
```

每级（cpp L180–L190、L262–L268）：

- `worldExtent = radius; radius *= 2.0` —— **每级覆盖半径翻倍**
- `worldBrickSize = worldBrickSizeOfCascade0 * (1 << i)` —— 每级砖尺寸翻倍
- `worldVoxelSize = worldBrickSize / sdfBrickSizeInVoxels`（体素尺寸随砖翻倍）
- `maxAffectDistance = kAffectVoxels * worldVoxelSize`（该级距离编码的半幅）

`GIDistance` 由渲染管线侧配置传入（FrameContext，见 [01-TuanjieGIManager与帧调度](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/01-TuanjieGIManager与帧调度.md)），决定整套级联的绝对尺度。

### 2.2 相机对齐：吸附到砖网格（cpp L285–L300）

级联中心跟随相机，但吸附到砖网格，避免相机微动导致全量重建：

```cpp
worldCenterInBrickUnit = round(camPos / worldBrickSize);
worldMinInBrickUnit = worldCenterInBrickUnit - numberOfBricksPerCascade1D/2;
worldCenter = worldCenterInBrickUnit * worldBrickSize;   // 吸附后的级联中心
```

### 2.3 增量更新：只重建新进入的边带（cpp L318–L350）

- `needReset` 时（首次/大改）：dirty region = 整个 worldAABB；
- 相机移动时：对 x/y/z 每轴比较新旧中心，只把**新进入视野的那条边带**（一条砖宽的带状区域，外扩 0.5 砖）标记为脏区域，存进 `sdfScene.dirtyRegionBuffer`（布局：前 3 个是 dummy，`dirtyRegionStartOffset = 3`）。

这样相机平移时每帧只重建两条边带，而不是整张级联。

## 3. 索引表：ClusterData（每格最多 4 个模型）

粗场每格（cluster）登记"这里有哪些模型"。数据结构（GICascadedSDF.h，`ClusterData`，`kClusterObjectCount` 在 **L258**，方法群在 L258–L330 一带）：

```cpp
constexpr static uint kClusterObjectCount = 4;        // 每 cluster 最多 4 个模型槽
constexpr static uint kInvalidObjectData = 0xFFFFFFFF;
uint4 data;    // packed distance and objectID（4 个槽打包进 uint4）
```

每个 `uint` 槽的编码：**高 8 位 = 归一化距离，低 24 位 = 模型（meshRenderer）索引**。

- `GetObjectIndex(idx) = data[idx] & 0x00ffffff` —— 低 24 位取对象索引
- 插入（`InsertObjectIfAllowed(normalizedDistance, meshRendererIndex)`）：
  1. 仅当 `0 ≤ normalizedDistance ≤ 1` 才插入（归一化距离超 1 视为"够不着本格"）；
  2. 编码：`objectData = (clamp(distance×255) << 24) | (meshRendererIndex & 0x00FFFFFF)`；
  3. **替换策略：挤掉当前 4 槽中编码值最大的**——高 8 位是距离，即"距离最远的让位"。
- `SortClusterData()`：对 4 个 uint 做**降序**冒泡排序 → 距离近的排前面。

插入时机（见 §5 的 `WriteCascadeSDF`）：只有 cluster 到物体的距离满足 `clusterAABB.sqrDistanceTo(aabb) < worldClusterSize²` 才登记，距离按 `saturate(clusterCenterDistance / clusterMaxAffectDistance)` 归一化（`clusterMaxAffectDistance = worldVoxelSize×sdfBrickSizeInVoxels + worldVoxelSize×2`，cpp L650）。

查询侧（`LoadClusterObject`，h 约 L660–L690）：世界坐标 → cluster 内坐标（`frac`）→ brick 索引 → `mappingBuffer` 查该砖在 atlas 里的位置 → `×64 + encodeClusterSubID` 得 cluster 线性索引 → 读 `ClusterBuffer`。

**世界坐标 → brick 索引 → atlas 位置的链条**（h 约 L590–L600）：

```cpp
encodeBrickIDInWorldSpace = cascadeIndex() << brickShift.w | encodeBrickID(getBrickIDInWorld(brickID))
```

`brickShift` 是 `(0, shift, shift*2, shift*3)` 的打包移位，把 3D brick 坐标压成 1D 线性索引去查 mapping buffer（`ReadBrickIndex`）。mapping buffer 里存的值 = 砖在稀疏 atlas 中的页号；无砖 = `-1`（`WriteBrickIndex(mapping, -1)` 见 §5 释放路径）。

## 4. 距离的存储与解码

### 4.1 纹理格式

距离存在稀疏 3D 纹理 **atlas**（`sdfMeshBricksData.encodedTexture3D`）里，格式 **R8_UNORM**（h 约 L545，`sample` 用 LINEAR+CLAMP——硬件三线性插值免费获得平滑距离）。

### 4.2 编码范围：不是 [0,1] 而是带符号区间

CPU 侧（GICascadedSDF.cpp L330–L333、L640）设置解码参数：

```cpp
SDFDecodeScale = 2.0f * maxAffectDistance;   // maxAffectDistance = kAffectVoxels × worldVoxelSize
SDFDecodeBias  = -maxAffectDistance;
// GPU：LoadDistance = rawDistance * SDFDecodeScale + SDFDecodeBias
// 写入：clamp(minDistance, -affectRadius, +affectRadius) 再编码
```

即 UNORM [0,1] 线性映射到 **[−affectRadius, +affectRadius]** 的带符号距离。一个 R8 通道存下"±4 体素"范围内的有符号距离；超出范围的表面被截断在 ±4 体素处。

### 4.3 法线不存，用时算

`LoadNormal` 用**中心差分 6 次采样**求场的梯度（h 约 L560–L600）——零值面的法线 = 梯度方向。好处：省一张法线纹理；代价：每次求法线 6 次采样。

## 5. CPU 侧：级联的生成与更新流程

入口 `UpdateFrame`（cpp L45–L65）：挂在 `sdfScene.onSDFSceneFrameUpdate` 上；对 `fctx.cameras` 每台相机调 `views[camera].Update(vctx, config)`。`occludeFactor` 每帧写入 `sparseTexture.occludeFactor`（cpp L60，虽然当前 GPU 主路径不消费它，见 §6.2）。

每级联的生成是一条 **kernel 链**（cpp L370–L430 按执行顺序）：

| 顺序 | Kernel/结构体 | 线程块 | 干什么 |
|---|---|---|---|
| 1 | `FilterMeshRendererFromSDFScene` | 64×1×1 | 从 SDF 场的可渲染列表过滤出"影响本级的模型"（测试：`sqrDistance < sqrAffectRadius && radius > minRadius`） |
| 1' | `FilterMeshRendererFromPrevResult` | 64×1×1 | 复用**外一级**（i+1，更大）的结果再过滤，省一遍全表扫描 |
| 2 | `FilterDirtyRegions` | 4×1×1，缓冲 508 | 把 dirty 区域展开成"待更新的 node→brick"清单（GroupedGPUFilter：group=node，item=brick） |
| 3 | `FilterMeshRenderersToNodes` | 64×1×1 | 模型分派到 node，产出 node→object 计数索引 |
| 4 | `ValidateActiveBricks` | 64×1×1 | **砖的分配与释放**（见下） |
| 5 | `WriteCascadeSDF` | 4×4×4（每砖 8 组×64 线程=512 体素） | 逐体素算距离写入 atlas + 填 ClusterBuffer |

### 5.1 砖的分配与释放（`ValidateActiveBricks`，cpp L520–L590）

- 判定某砖是否需要存在：`hasObjectsAffectBrick = (brickMinDistance + brickRadius) ≥ −cascadeAffectRadius && (brickMinDistance − brickRadius) ≤ cascadeAffectRadius`（砖的包围球和编码范围相交）
- 需要而无砖 → `brickIndexAllocator->alloc()` 分配 atlas 页；
- 有砖而不再需要 → `WriteBrickIndex(mapping, -1)` 标空 + `pendingToFree(brickIdx)` **延迟释放**（三个 kernel：initIndirectArgs / freePending / resetPendingCounter，cpp L437–L451）——延迟是为了防止本帧还有查询在读这块砖。

### 5.2 写距离（`WriteCascadeSDF`，cpp L600–L720）

- `brickRadius = worldBrickSize × 0.5 × 1.732`（√3/2×边长 = 砖外接球半径）
- 每 voxel 对该级相关的每个模型算"点到表面距离"（`CalculateDistanceFromPointToSurface`，非均匀缩放经 `volumeToWorldLossyScale` 校正，见 [04-模型距离场GISDF](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/04-模型距离场GISDF.md)），取 min；
- `clamp(minDistance, −affectRadius, +affectRadius)` 后编码写入纹理（cpp L688）；
- ClusterBuffer 只在 `GroupID().x % 8 == 0` 的组写（每 cluster 一组足够）：按 §3 的规则 `InsertObjectIfAllowed` + `SortClusterData`。

## 6. GPU 侧：球体步进的三个实现

GICascadedSDF.h 里有三个 march 函数，**行为不同、用在不同路径**：

### 6.1 `RayMarching`（主用版本，h 约 L825–L860）

```cpp
Float affectDistance = cascadeHeader->worldVoxelSize() * 0.5f;  // 半体素（硬编码 0.5）
Float maxDistance = 0.f;
$while(marchCount < TuanjieGI::rayMarchingMaxCountCDF) {       // 128 步上限
    Float distance = LoadDistance(marchPosVS, cascadeHeader);
    maxDistance = max(maxDistance, distance);                   // 沿途最大读数
    Float hitThreshold = min(affectDistance, maxDistance);      // 命中阈值
    $if(distance < hitThreshold) {
        hit = true;
        marchDistance = max(0.f, marchDistance + distance - worldVoxelSize * 1.f);  // 回退一个体素
        $break;
    };
    marchDistance = marchDistance + distance;                    // 球体步进：跳整段读数
    $if(marchDistance >= marchMaxDistance) $break;
    marchCount = marchCount + 1;
}
```

三个要点（均已对照源码核实）：

1. **命中阈值 = min(半体素, 沿途最大读数)**：`affectDistance` 是硬编码 `worldVoxelSize × 0.5`；`maxDistance` 是整条 march 沿途见过的最大距离读数。效果：从未接近过表面的射线（读数一直大）用半体素做阈值；掠过薄墙等读数小的区域，阈值随最大读数缩小，防误命中。
2. **判命中用 `distance < hitThreshold`（不取绝对值）**：带符号 SDF 下，深入物体内（负读数）也算命中。
3. **命中后回退一个体素**（`− worldVoxelSize×1.0`），把命中点拉回表面外侧，供后续取色。

### 6.2 `RayMarchingJumped`（occludeFactor 版本，**当前无人调用**）

```cpp
Float hitThreshold = cascadeHeader->worldVoxelSize() * occludeFactor;   // 唯一消费 occludeFactor 的地方
```

`occludeFactor` 是 `GIOption<float>::Add(0.5f, "GICascadedSDFScene.occludeFactor", "Set this to avoid light leaking.")`（GICascadedSDF.h:217）。**三个 march 实现里只有 Jumped 版把 occludeFactor 乘进阈值**（h:802）；主用路径 `RayMarching` 不消费它，所以**运行时调 occludeFactor 当前无效**。它对应 `TraceCascadeSDF<useJump>` 的 `useJump=true` 排列，但现有调用全部走 false 分支。

### 6.3 `RayMarchingOld`（旧版）

阈值 `hitThreshold = affectDistance × min(maxDistance/(2×affectDistance), 1)`，步长强制下限 `max(distance, affectDistance)`（最小半体素步）。已被 6.1 取代，保留作对照。

### 6.4 步数上限

- 级联 march 用 `rayMarchingMaxCountCDF = 128`（GICascadedSDF.h L37/L39）——h 内 4 处 `$while` 全是它；
- **64 是另一个常量**：`rayMarchingMaxCount = 64`（**GISDF/GISDFMesh.h L20**），用于 GISDFScene.h 的单模型精场 march（L292），以及本文件 L1015 的 cluster 加速 march。两者不要混淆。

## 7. 级联切换：`TraceCascadeSDF<useJump>`

射线怎么跨级联走（h 约 L920–L1000）：

1. `startCascade = min(GetCurrentCascade(input.rayPos), usedSize-1)` —— 从包含**射线起点**的级联开始（起点在近处则从细级开始）；
2. `$for(cascadeId, startCascade, usedSize)` —— 从内向外逐级；
3. 每级先 `IntersectRayAABB` 求射线与该级包围盒的进/出参数（entry/exit），命中则在本级 march（§6.1）；
4. 本级没命中 → `rayStart = rayPos + rayDir × exitTime`，`prevDistance += exitTime`，跳到下一级继续；
5. 命中后 `LoadNormal` 求法线；若 `dot(hitNormalVS, −rayDir) < 0` 则翻转法线（保证法线朝向射线来向）；
6. `hitDistance = length(hitPosition − input.rayPos)`。

## 8. 命中之后：CascadedSDFTracer（取面片色）

`CascadedSDFTracer.h` 是把"粗场命中"升级成"光照结果"的 tracer：

```cpp
GIOption<float> traceMaxDistance = GIOption<float>::Add(1000.f, name+".traceMaxDistance", "Tracer max distance.");
// 实际生效值 = min(traceMaxDistance, fctx.maxDistance)
```

`trace()` 流程（约 L130–L215）：

1. 调 `TraceCascadeSDF` 得到几何命中；
2. `LoadClusterObject` 拿命中处 cluster，**遍历其中 ≤4 个模型**（`$for_unroll(i, 0, 4)`），逐个到模型的**面片**上采样（精场判定 + 面片取色），按可信度加权累加 `sampleFacetResultSum`；
3. `w ≥ 0.9f` 提前结束（可信度够了，不用把 4 个全试完）；
4. `hitRadiance = sum.xyz / sum.w`（加权平均）；
5. 采样偏移 `sampleBias = cascadeFacetSampleBiasScale × volumeToWorldScale1D`——按级联尺度放大偏移，远处粗级取色位置允许更粗略。

`calculateRadiance`（约 L85–L130）从命中 payload（3 个 uint4：rendererIndex / hitPositionAndBias / hitNormal）解包，用 `PackRGBE_sqrt` 压缩写出（RGBE 共享指数编码 + 先开方，扩展小值精度）。

> 面片取色的细节（双线性、深度校验、多候选加权）在 [02-面片系统GIFacet](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/02-面片系统GIFacet.md)。

## 9. GICascadeMipSpreading：一个被短路的实验

`GICascadeMipSpreading.h` 实现了距离场 mip 的 Eikonal 扩散（把低分辨率层的距离向外扩散，用于更远的命中检测），线程块 4×4×4。**但当前版本 `LoadSrcDFValue`（L62–L120）直接 `return 0.0f`**——真正的 atlas 读取代码整块被注释（含 `$permutation_if("READ_ATLAS")` 分支）。即该机制处于**禁用/未完成状态**，扩散在常量 0 上做。源码无注释说明原因。读代码时不要把它当成生效路径。

## 10. 可视化（编辑器）

`GICascadedSDFVisualize`：`VisualizeBox` 命名空间提供 4 种 `GetWorldMatrix`（draw-from-CPU / dirty node / dirty brick / allocator 使用情况），`MakeUnitCubeMesh` 手工构造单位立方体网格；`ExecuteVisualize` 按 8×8 线程渲染 `TraceCascadeSDF` 的命中结果（tMax=1000000）。用途：编辑器里直接看到级联结构、脏区域和砖分配。

## 11. 与其他子系统的关系

| 方向 | 关系 |
|---|---|
| 被构造于 | `SWRTPipeline`（见 [01-TuanjieGIManager与帧调度](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/01-TuanjieGIManager与帧调度.md)）：`GICascadedSDFScene csdfScene = sdfScene`——它持有 sdfScene（精场）用于登记与精场判定 |
| 被 tracer 包装 | `CascadedSDFTracer`（⑥级查询中的③级，"粗场步进"） |
| 被消费于 | 屏幕层 `IndirectLightingScene` 的射线分发（[03-六级查询与流压缩](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/03-六级查询与流压缩.md)）、面片间接光入账 |
| 帧驱动 | `sdfScene.onSDFSceneFrameUpdate` → `UpdateFrame` → 每相机 `views[camera].Update` |

## 12. 快速问答

**Q：为什么级联数是 4？**
A：`numCascades = 4`（h L17）硬编码；覆盖半径逐级翻倍，4 级 ×16 倍刚好匹配 `GetFacetMaxDistance = R0 × 16` 的面片查询距离上限。改这个数要连带 `sdfRequiredLODBits[4]`（GISDFScene.h）与各级分配尺寸。

**Q：命中阈值到底是多少？**
A：主路径 `RayMarching`：`min(worldVoxelSize × 0.5, 沿途最大读数)`。前者是硬编码 0.5，后者防掠射误命中。`occludeFactor`（默认 0.5，注释防漏光）只接在 `RayMarchingJumped` 上，该函数当前无调用者，调参无效。

**Q：粗场步进最多走几步？**
A：128（`rayMarchingMaxCountCDF`）。单模型精场与 cluster 加速 march 是 64（`rayMarchingMaxCount`，定义在 GISDFMesh.h L20）。

**Q：相机移动时级联会全量重建吗？**
A：不会。中心吸附到砖网格；移动时只把新进入的边带标记为 dirty（§2.3），每级只更新脏砖。砖的释放走 pending 延迟队列。
