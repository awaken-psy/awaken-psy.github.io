---
title: 02 面片系统 GIFacet（世界层存储）
publish: true
updated: 2026-09-22T03:36:43.234Z
---

# 02 面片系统 GIFacet（世界层存储）

> 源文件：`GIFacet/GIFacetScene.h`（2383 行）/ `.cpp`（1262 行）、`GIFacet/GIFacetInclude.h`、`GIFacet/GIFacetMesh.h`、`GIFacet/GIFacetVGRasterize.h/.cpp`
> 作用：静态世界的"表面光场"——把每个静态物体表面铺成小面片，在两张大图集里存它们的基础属性与出射光，并调度"哪些面片何时重算"。
> 前置阅读：[../01-背景知识/01-全局光照基础](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/01-全局光照基础.md) §4（辐射度迭代的世界层定位）

## 1. 面片是什么

**面片= 小矩形表面块**，每块有自己在物体局部空间的位置与朝向。资产侧 `GIFacetMesh`（Mesh 上的序列化资产，GIFacetMesh.h）持有 `GIFacetInfo` 列表：

- `rendererToFacet`（逆矩阵，加载时由 `facetToRenderer` 求逆）——把渲染器空间映射到面片局部空间；
- `facetToRenderer`（序列化字段 "matrix"）；
- `orientation`（"orientation"，±X/±Y/±Z 六方向之一）。

运行时 CPU 结构 `GIFacet`（GIFacetInclude.h）：`facetToWorld`、`log2Resolution`（图集分辨率）、`rectInAtlas`（图集矩形指针）、`rasterizePriority / lightingPriority`、`log2Bias`（各向异性轴缩放）、`hasLightingHistory`。GPU 结构 `GIFacetGPU`：`worldToFacetRot`（3×3）、`rectInAtlas`（uint4：xy 起点 + zw 尺寸）、`center/extent`、`orientation`、`isVisible`。

## 2. 两张图集与图层

| 图集 | 尺寸 | 角色 |
|---|---|---|
| **persistent atlas** | **4096²** | 长期存储：所有面片的最终数据 |
| **rasterize atlas（工作台）** | **512²** | 每帧待办面片先在这里重录，再搬回 persistent |

图层（GIFacetScene.cpp:46–68，格式均为源码事实）：

- persistent：`BaseColor`(R8G8B8A8→**BC7** 压缩)、`Normal`(R8G8→**BC5**)、`Emissive`(B10G11R11→**BC6H**)、`Depth`(D24→**BC4**)、`IndIrradiance`(B10G11R11)、`IndIrradianceFrameNum`(R8)、`Radiosity`(B10G11R11)、`Opacity`(R8→BC4)
- rasterize（帧内）：BaseColor/Normal R8G8B8A8、Emissive B10G11R11、Depth D32_SFloat_S8、DirectLighting（B10G11R11，每帧 memset 清零）；GPU-driven 平台另有 VG 可视缓冲层

**Radiosity 图层存的就是"出射光"**——面片上其他子系统消费的核心量（屏幕层射线命中后读它）。

## 3. 每帧调度：`FacetSceneWithLighting::UpdateFrame`（h:1523–1539）

```
UpdateMeshRenderers(fctx) → [有 rasterizeRequests] RasterizeFacets → [有 lightingRequests] LightingFacets → ClearChange
```

### 3.1 `UpdateMeshRenderers` 七步（cpp:570–800）

1. persistent atlas 尺寸变化 → 重建（`persistentRadiance` 同步重建并 memset 0，cpp:615–621）；
2. **Job 扫描可见性**（`PrepareFacetMeshRenderersJob`，按 `perJobMaxGIRendererNum=50` 分片并行）：`texelCount = facetMaxTexelDensityForCamera×maxExtent/(minDistance+0.01)`；可见判据 `minDistance < maxDistance && texelCount ≥ (自发光?1:facetCullTexelCount)`（cpp:372–378）；自发光物体放宽（`kRealtimeEmissive` 材质特判）；
3. 新 renderer 登记：分配 facet span（`GIFacets.Allocate(facetCount)`），初始 `priority=FLT_MAX`（未栅格化哨兵）；
4. 处理移除/更新列表；
5. **候选收集**（`CollectCandidateFacetsJob`）+ 两个 `MaxNPriorityQueue`（容量 = `fctx.facetRasterizeFrameCount`，即**每帧最多处理的面片数**；URP 实参 50，FrameContext 默认 300）；
6. 图集分配 + 生成 `rasterizeRequests`/`lightingRequests`（见 §3.2）；
7. 上传 GPU 缓冲（TrackedGPUBuffer 增量 diff）。

### 3.2 优先级：累积即老化（cpp:553–559）

```cpp
facet.rasterizePriority += 1.0f / minDistance;      // 每帧累积"近度"
desc.rasterizePriority  = -1.0f / facet.rasterizePriority;  // 负值入队
// 更新完成后：facet.rasterizePriority = 0
```

- MaxNPriorityQueue 保留"最大 N 个"——`-1/累积值` 越小（累积值越大）越优先，**长期没被选中的面片累积值持续变大，自动排到队首**。没有独立的"超时计时器"，累积机制本身就是老化。
- `FLT_MAX` = 从未栅格化（必最优先）。

### 3.3 分辨率与图集分配（cpp:540–548, 719–793）

- 目标分辨率：`texelCount = NextPowerOf2(min(facetMaxTexelDensity×extent/minDistance, max))`，`log2Resolution` clamp 到 **[3, `facetMaxResolutionLog2`=6]**（即 8²~64² texel/面片），减去 `log2Bias`（各向异性校正）。
- 分配：`rasterizeAtlas.allocate(1<<log2Resolution)`（底层 smol-atlas 装箱）；分辨率变化时重分配 persistent（保留 `oriRectInPersistentAtlas` 供历史重采样，无效哨兵 `RectInt(-1,-1,0,0)`）；**分配失败逐级降分辨率重试**直到 `facetMinResolutionLog2`。

### 3.4 图集页装箱算法（smol-atlas，Shelf Best Height Fit）

底层是第三方库 **smol-atlas**（`Atlas/external/smol-atlas/smol-atlas.h`；TuanjieGI 侧经 `Atlas/Texture2DAtlas` 封装，只持有 `smol_atlas_t*` pimpl）。装箱策略（源码已核实）：

- **水平货架（shelf）**：条目按高度归入当前货架，货架高度 = 首个条目的高度；同一货架只放等高（或更矮）条目；
- **货架内 free-span 列表**：每条货架维护**有序的空闲区段列表**，`allocate` 找能放下的 span；`deallocate` 归还区段并**合并相邻 span**——面片释放后其矩形可被新面片复用；
- **货架不回收**：即使整条货架被清空也不会归还给其他高度使用——4096² 图集的行高分布随运行逐渐固定，只产生碎片不会塌缩；
- API：`sma_atlas_create/destroy/width/height`、`sma_item_add/remove`、`sma_atlas_clear`、`sma_item_x/y/width/height`（`Texture2DAtlas` 的 `allocate/deallocate` 直接转发）。

**TuanjieGI 侧封装**（`Atlas/Texture2DAtlas.cpp`，全文 150 行）：`allocate` 返回的 `RectInt*` 实际指向 smol-atlas 的 item 结构（强转，无类型安全）；`AllocateImages` 把图集层纹理数组初始化（每层按 LayerDesc 格式建 RenderTexture，深度类格式走 depthStencil 通道；写 `sizeAndRcpSize = (w, h, 1/w, 1/h)` 供 shader 用）；**压缩启用逻辑**：`compress = compressEnabled && compressedFormat ∈ [BC4, BC7]`——命中则层格式取压缩格式、走 `CreateObjectFromCode` 建只读 Texture2D 再包成外部纹理；**注意 IndIrradiance / Radiosity / IndIrradianceFrameNum 三层的"压缩格式"与原格式相同——即这三层实际不压缩**（可写、每帧复合要写它）。

这也是 §3.3 "分配失败→逐级降分辨率重试"兜底存在的原因之一：长期运行后图集可能没有能放下高分辨率面片的整块 span，降一级分辨率（尺寸减半）通常就能放进碎片。

## 4. `RasterizeFacets`：重录基础属性（cpp:828–1251）

把本批面片的基础属性（颜色/法线/自发光/深度）从原模型网格重新采样：

- **材质 pass**：`"FacetGBuffer"`（普通路径）与 `"VGFacetGBuffer"`（VG 路径）——面片用专用材质 pass 画进工作台。
- **实例化**：按 `hash_combine(Mesh, Material, submesh)` 归并，一次 `AddDrawMeshInstancedProcedural` 画一批；按正/反面缩放分桶。
- **VG 路径**（`PLATFORM_GPU_DRIVEN_PIPELINE`，GIFacetVGRasterize.cpp 全文 219 行已核实）：CPU 侧四步装配——
  1. `InitVGCullingContext`（L13）：从引擎 GPUDriven 管线取上下文，找 4 个 kernel（`InitPersistentState`；按开关二选一组合：`DegenerateCullFacetRasterize` **或** `InstanceCullFacetRasterize`+`ClusterCullPersistent`）；
  2. `CreateVGView`（L39）：构 GPUView——**投影矩阵 Y 分量取反**（注释 "Non vg projMatrix set invertY true, but Vg requires false"）、viewOrigin 在面片法向偏移、near/far=±1000；
  3. `VGCull`（L155）：分配 instanceViews/rasterizeViews 缓冲 → `GPUCuller::BeforeCullInternal` → Degenerate 或 Instance+Cluster 两级剔除（culling kernel 的 HLSL 本体在引擎 GPUDriven 管线内，属[../06-参考/04-未解之处](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/06-参考/04-未解之处.md) D.2 的"超出本档范围"）；
  4. `AllocateRasterizeVGResources`（L207）：`NextPowerOf2(最大可见簇数×3)` 的 raw 缓冲。
  非 GPU-driven 平台逐请求 `CalcFacetVPMatrix`（正交投影，near=0/far=scale.z×2）+ `AddDrawMesh`。
- **搬回 persistent**：`CopyRects<encoder>(rasterize → persistent)`（普通拷贝）或 `CompressAndCopyRects`——**4×4 块 BC 压缩**（BC7/BC5/BC6H/BC4 按 6.1 表；先压进临时图集再 `AddCopyTexture` 到 persistent 对应 rect）。

## 5. `LightingFacets`：算光（h:1582–1778）

每帧流程：

1. **清零** `DispatchMemset(DirectLighting, 0)`（h:1634）。
2. **直接光**：`DirectDiffuseLoop::update`（或非 Loop 版）处理点光/聚光（`directLightingUnlimitedLights` 决定），`DirectionalDiffuse::update` 处理方向光——细节在 [05-面片光照GILighting](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/05-面片光照GILighting.md)。阴影 tracer：HWRT 且 `directLightingInlineRayTracing` 用 inline ray tracer，否则 cdfTracer（h:1640–1657）。
3. **历史回搬**：persistent → rasterize 重采样三个图层（IndIrradiance / FrameNum / Radiosity），供本帧在工位上继续累积。
4. **两次复合（finalLighting 两 pass，h:1730–1778）**：
   - **Pass 1**（间接光源准备）：`enableHistoryIndirect=true、enableCurrentIndirect=false`——只用历史算出一份 Radiosity（供刚要发射的间接射线取色），然后 `TracingView::DispatchTracing` **发间接光射线**（tracer 链可选 Dummy/SDF/Cluster/Cascaded/InlineRay/Ray，permutation 控制）。
   - **Pass 2**（finalLighting）：`enableCurrentIndirect=true`——把本帧新算的间接辐照度混入，再复合一次 Radiosity，然后 `CopyRects` 把 IndIrradiance/FrameNum 从工作台写回 persistent。

### 5.1 复合公式（DoCompositeRadiosity kernel，h:2252–2383）

每面片光照块（8×8 texel，`configure_block(kLightingQuadSize,…)`）一组；组内第 0 线程读 `GetValidQuad` 广播到共享内存：

```cpp
// 历史混合（帧数加权）
historyWeight = linearFactor * historyFrameNum;         // gather 历史帧数与辐照度
weightSum += historyWeight; 
若 enableCurrentIndirect:
    totalIndirect += currentIndirectIrradiance * currentFrameNum;   // currentFrameNum = 1/8
    weightSum += currentFrameNum;
currentIndirectIrradiance = totalIndirect / weightSum;

// 出射光合成
Float3 out = currentIndirectIrradiance;
若 enableDirect:   out += DirectLighting * (1/fLightRangeCompressFactor) * (1/PI) * directlightingFactor;
若 enableBaseColor: out *= baseColor * baseColor;        // 注意：平方！
若 enableEmissive:  out += emissive * emissivelightingFactor;
persistentAtlasLayers.Radiosity.write(targetCoord, out);
```

三个要点（全部源码核实）：**baseColor 取平方**；直接光先除压缩因子再乘 1/π（把辐射亮度归一成辐照度贡献）；`currentFrameNum = 1.0f/maxFramesAccumlated`——**面片侧累积上限 8 帧**（GIFacetInclude.h:27 `maxFramesAccumlated = 8`；用法 GIFacetScene.h L1631/L2277/L2305）——新样本权重固定 1/8，与屏幕侧的 16 不同。

## 6. 面片的间接光射线

- **每块每帧 1 条抖动射线**（方向偏移来自蓝噪声 `GetJitter`，h:2248–2252）；每面片总射线数 = 该面片覆盖的块数（`rectInAtlas.zw()/kLightingQuadSize`），不是固定值。
- 射线经 `TracingView::DispatchTracing` 走 tracer 链（与屏幕层共用同一套 tracer——**六级查询在两个层是同一份代码**）；命中后读**别的面片的 Radiosity**（`GIRadiosityVisitor::SampleAtlas`，h:773–776）。
- 上一帧的 Radiosity 是本帧间接光的来源——**每帧推进一反弹**；`indirectHistoryEnable`（注释 "Blend with history radiosity to get infinite bounces."）开历史混合收敛到多级反弹。

## 7. GIRadianceCacheSH：SH 辐射缓存（h:899–930, 1156–1275)

`FacetSceneWithLighting` 另维护一张 **persistentRadiance**（R32_SFloat）+ **persistentRadianceNumFrames**——按**面片光照块**存的 SH 辐射缓存：

- 布局：`shCoord = quadCoord × uint2(8,6) + shCoefficientIndex`（h:1253）——**每块 8×6=48 个 float**，与"4 阶 SH 16 系数 × RGB = 48"吻合（源码未显式写阶数，此为有据推断；SphericalHarmonics.h 存在 16 系数特化）。
- 取色 `GetRadiance` 两条路径：(a) 按 cluster 索引（`LoadClusterObject` 4 物体，z≥0.9 提前停）；(b) 在面片图集上按深度 gather 加权找面（`depthAttenuation=0.25`，注释 "Controlling the sensitivity of bias to depth"）。
- 接到 `historyStates.radiance/framesAccumlatedPerQuad` 供 IndirectLightingPipeline 使用；persistent 尺寸变化时清零（cpp:615–621）。

## 8. GISDFScene 的联动（GISDFScene.cpp）

`GIFacetScene` 构造依赖 `sdfScene + csdfScene`（h:241）；反过来 GISDFScene 每个渲染器登记时写 `facetMeshRendererID = facetScene.GIFacetMeshRenderersTracker.GetObjectID(renderer)`（cpp:417–422）——**SDF 命中→面片取色**的链条就是这个 ID。面片可见性变化也会 `NotifyMeshRendererFacetIDChange` 通知 SDF 侧。

## 9. 射线命中后的取色链路（Visitor 家族与三个 GetColor）

任何 tracer（③级/④⑤级/面片间射线）命中后，"读那里发多少光"都经 `GIFacetScene*::GetColor` 走面片图集。这是六级查询与世界层存储之间的最后一环。

### 9.1 包装器与 Visitor（GIFacetScene.h L624–880）

- **包装器**（`GIFacetSceneSampler/Gather/DebugLoad <Visitor>`，L624/655/689）：State 持有 facetScene 引用与 `depthAttenuation` GIOption（默认 **0.25**，注释 "Controlling the sensitivity of bias to depth"，L660/L694——它是 GIOption 默认值，非硬编码）；`HasValidData()` = 面片渲染器缓冲非空。
- **内层 Visitor 绑定到图集图层**：

| Visitor | 行 | 采样图层 | 颜色 gather |
|---|---|---|---|
| `GIRadiosityVisitor` | L722 | **.Radiosity**（出射光——GI 取色的主力） | 是（gather_red/green/blue 点乘权重） |
| `GIIndIrradianceVisitor` | L833 | .IndIrradiance | 是 |
| `GIBaseColorVisitor` / `GIWorldSpaceNormalVisitor` / `GIEmissiveVisitor` | L745/769/815 | .BaseColor / .Normal（含解码）/ .Emissive | 是（光追直读材质路径用） |
| `GIDepthVisitor` | L793 | .Depth | 否（直接 sample，TODO 注释） |
| `GIUVDebugVisitor` | L856 | 程序化 UV 棋盘（调试） | 否 |

所有 Visitor 的 `GatherDepthAtlas` **一律读 .Depth 图层**（与自身颜色层无关）。

### 9.2 GetColor 的公共骨架

```
FacetMeshIndex 边界检查 → 世界法线转渲染器空间 → 轴向权重（normalRS²）与 orientation 掩码
→ firstbitlow 逐候选（每面片网格对应一个 orientation 位）
→ 每候选：世界→面片空间 positionFS、ISPositionInFacet、图集 UV
→ 深度校验（见 9.3）→ 采样 Visitor 图层 → rtn += (value, 1) × weight
```

**返回值不归一化**：`rtn.w` 是权重和，由调用方除（L988/L1106 注释 "we do not divide the totalWeights, the caller will."）。多候选加权平均就发生在这里：tracer 把各候选的 `(value,weight)` 累加后除以 w。`GIRadianceCacheSH::GetRadiance` 的 cluster 循环里 `sampleFacetResultSum.z ≥ 0.9` **提前结束**（L1133，哨兵 `0x00ffffff` 终止）；CascadedSDFTracer 自身的 cluster 循环也有独立的 `w ≥ 0.9` break（见 [03-级联距离场GISDFExt](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/03-级联距离场GISDFExt.md) §8）。

### 9.3 三套深度校验并存（源码逐行核实——不是同一套）

| 实现 | 行 | 深度权重公式 | 特征 |
|---|---|---|---|
| `Sampler`（点采样版） | L910–991 | `exp(d² / −0.001) × saturate(texelDepth/0.01)` | 高斯衰减；含 `ClampInsideFacet`；轴向阈值 >0.0 |
| **`Gather`（主用）** | L993–1107 | `1 − saturate((\|Δdepth\| − bias) / (0.25 × bias))` | **减死区的线性软衰减**：死区 = sampleBias，超出后在 `depthAttenuation(0.25)×bias` 宽度内线性归零；2×2 gather 双线性（权重来自 `frac(pixelUV − 0.5 + 1/512)` 半像素补偿）；`texelDepth ≤ 0` 直接弃 |
| `DebugLoad` | L1224–1343 | 同 Gather | **winner-take-all**（只留最优候选覆盖，不累加） |
| `GIRadianceCacheSH` 单面片版 | L1191–1198 | `exp(+d² / depthAttenuation) × (minDepth > 0)` | **正号**——与其他三处的负号相反，设计意图未理解（如实记录） |

**读文档/源码注意**：百科其他篇写"带深度校验的双线性取色"时默认指 **Gather 版**（GI 主用路径）；三套公式并存，引用时别混。

### 9.4 悬空占位（诚实记录）

`GIFacetSceneDSL::GetFacetWorldCenter / GetFacetWorldAxisX / GetFacetWorldAxisY / GetFacetWorldExtent`（L591–L608）**全部返回空 `Float3()`**，注释 `//todo : wait fentyuan 's edit`——面片几何的 DSL 访问器是待接线的占位；`GetFacetOrigin`（center − extent）与 `GetQuadExtent` 可用。QuadGPU 的图集坐标方法群（`PersistentSubPixel` L1920、`SubPixelHistoryCoordClamped` L2060 等）承担了实际坐标换算。

### 9.5 图集坐标体系（RasterizeDescGPU / LightingQuadID / QuadGPU 全解）

图集上的一切光照处理以"面片光照块"为单位组织，坐标换算由三个结构承担：

**`RasterizeDescGPU`**（GIFacetInclude.h:368–372）——本帧光栅化请求：

```cpp
struct RasterizeDescGPU {
    uint4 rasterizeRect;               // 本帧光栅化矩形（xy=原点, zw=尺寸，工作台坐标）
    uint4 oriRectInPersistentAtlas;   // 对应的持久图集矩形（xy=原点, zw=尺寸）
    uint32_t facetID;
};
// PixelOffsetToAtlasOffset(p) = p + rasterizeRect.xy()   // facet 内偏移 → 工作台坐标
```

**`LightingQuadID`**（GIFacetInclude.h:430–443）——有效块的三元组：

```cpp
// 注释写着 "12, 10, 10" 位打包（12 位请求 ID + 10/10 位抖动中心）——**这是 TODO 未实现的设计**；
// 现行结构就是三个独立字段，0xffffffff/uint2(-1) 表示无效：
struct LightingQuadID {
    uint32_t rasterRequestID;
    uint32_t facetID;
    uint2 jitteredPixelOffset;   // = rasterRequest.rasterizeRect.xy + facet 内像素偏移
};
```

CPU 侧生成（GIFacetScene.h:1562–1580）：`rasterizeRect` 断言按 8 对齐；块的像素偏移 = `网格坐标×8 + GetJitter(网格坐标, 8)`——即**块对齐到 8×8 网格、块内位置由抖动决定**。

**`QuadGPU`**（GIFacetScene.h:1801–2100）——块在 kernel 内的 GPU 视图。派生字段（`calcDerived`，L1817–1824）：

```cpp
facetSizeInQuads            = facet.rectInAtlas.zw / 8;         // facet 内的块网格尺寸
facetHistorySizeInQuads     = oriRectInPersistentAtlas / 8;     // 历史图集中的块网格（原点+尺寸都除 8）
quadOffset                  = jitteredPixelOffset / 8;          // 本块在 facet 网格内的坐标
validQuadIDOfFacetOrigin    = validQuadID − (quadOffset.x + quadOffset.y×facetSizeInQuads.x);
                                                               // 反推 facet (0,0) 块的全局 ID（邻块计算基准）
```

关键方法（全部逐行核实）：

| 方法 | 算法 |
|---|---|
| `GetOriginPixelOffset`（L1875） | `jitteredPixelOffset & (0xffffffff<<3)`——低 3 位清零，**向下对齐到块原点（抖动被抹掉）** |
| `GetCenterPixelOffset`（L1883） | 对齐原点 + (4,4)（块尺寸 8 的一半） |
| `GetSubPixelOffset(p)`（L1887） | 对齐原点 + p（`p∈[0,8)`）→ facet 内像素偏移 |
| `ScreenOrigin/Center/JitteredCenter` | `PixelOffsetToAtlasOffset(上述三者)`——加 `rasterizeRect.xy` 进**工作台**坐标 |
| **`PersistentSubPixel(p)`**（L1920） | `parentFacet->PixelOffsetToAtlasOffset(GetSubPixelOffset(p))`——**走持久图集**（与 Screen* 走工作台不同路！） |
| `GetNeighorQuad(delta)`（L1945） | `target = quadOffset+delta`；在 `facetSizeInQuads` 内则 `id = 基准ID + (target.x+target.y×facetSizeInQuads.x)` 取邻块；越界返回无效 |
| `GetHistoryQuadByCoord(c)`（L1959） | 历史块中心 `c×8+(4,4)` → 按 `rasterizeRect.zw / oriRect.zw`（本帧/持久尺寸比）**缩放映射回本帧坐标**，沿用 facetID/rasterRequestID 构造"历史位置伪块"（L1972 有 `todo get the read offset`——读取偏移未定案） |
| `SubPixelHistoryCoordClamped(p)`（L2060） | 像素中心 +0.5，×（持久/光栅化尺寸比），加 `oriRect.xy`，clamp 到 `[0.5, zw−(0.5+2/256)]` 留边（注释：极端尺寸下下界可能应为 0.25，clamp 会失效） |

复合 kernel 的两个关键调用（L2296–2297）：`targetCoord = PersistentSubPixel(threadID)`（读持久图集）、`historyCoord = SubPixelHistoryCoordClamped(threadID)`（读历史）。

### 9.6 面片空间坐标系与坐标换算方法群（GIFacetGPU，逐方法抄录）

取色与复合的一切坐标换算都建立在"面片空间"上（GIFacetInclude.h OC_STRUCT 绑定体，约 L264 起）：

**面片空间的定义**：
- **原点**在 `center`（世界空间）；三轴由 `worldToFacetRot` 旋转矩阵定义；
- **xy 平面**贴着面片表面，`extent.xy` = 面片半宽/半高；
- **z 轴是沿面片法向的深度轴**（不是法向本身），`extent.z` = 深度半范围；深度纹理存 [0,1]，换算 NDC 用 `depth×2−1`（即 [-1,1]），再乘 extent 回面片空间——这就是取色公式里 `positionFS.z/extent.z×0.5+0.5` 的来历（NDC z → [0,1] 深度）。

关键方法（全部逐行核实）：

| 方法 | 公式 |
|---|---|
| `WorldSpaceToFacetSpace(p)` | `mul(worldToFacetRot, p − center)` |
| `ISPositionInFacet(p, halfBias)` | `all(abs(p) ≤ extent + halfBias)`——三分量全判 |
| `ClampInsideFacet(p)` | **只 clamp xy**（`clamp(p.xy, −extent.xy, extent.xy)`），z 原样保留 |
| `FacetSpaceToAtlasUV(p)` | `(clamp((p.xy+extent.xy)/(2×extent.xy)×rect.zw, 0.5, rect.zw−0.5) + rect.xy) / 4096`——工作台半像素留边 |
| `FacetSpaceToPixelUV(p)` | 同上但 clamp 到 `rect.zw − 1.5`（像素坐标版） |
| `AtlasUVToFacetSpacePos(uv)` | 逆运算：`((uv×4096 − rect.xy)/rect.zw)×2×extent.xy − extent.xy` |
| `PixelOffsetToFacetNDC(offset)` | xy = 像素→UV→[−1,1]；**z = 图集 Depth 图层读值 ×2−1** |
| `DecodeNormalToFacetSpace(n)` | xy 通道 `×2−1`，**z = sqrt(1−x²−y²)**（法线只存两通道，z 重建且恒为正——面片法向固定） |
| `FacetSpaceToWorldSpace / RotateFromFacetSpaceToWorldSpace` | `mul(p, worldToFacetRot) + center`（法线版不加 center） |
| `GetQuadExtent / GetQuadRadius` | 面片网格中一个光照块的 OBB 半长/包围球半径（`extent.xy ÷ (rect.zw/8)`） |

**渲染器空间与朝向掩码**（GIFacetMeshRendererGPU，L170–205）：`RotateWorldSpaceToRendererSpace(v) = mul(worldToRendererRot, v)`；`Get[X/Y/Z]AxisMask(法线分量)` = `select(分量<0, orientationMasks[偶], orientationMasks[奇])`——按法线分量**正负**选朝向掩码，即每渲染器预存了 6 个朝向（±X/±Y/±Z）的面片集合位图。

**面片侧的 SubPixel 读取方法**（ViewContextFacetLighting 的 QuadGPU，L1997–2030）：`SubPixelGetWorldPos/WorldNormal` 从持久图集读位置/法线；**`SubPixelGetWorldBentNormal` = normalize(世界法线)**——面片光照场景里"弯法线"就是普通法线归一化；`SubPixelGetRoughness` 恒返回 **1.0**、`GetQuadWorldPos` 返回 **−999**（TODO 占位）——面片侧粗糙度恒为 1 的意义：它的求值只需漫反射瓣。

**源码如实记录**：`WorldSpaceToFacetNDC(p)` 的实现写的是 `WorldSpaceToFacetSpace(p − center)`——叠加定义后 center 被减了**两次**；无注释说明是否有意为之，引用该函数时注意。

## 10. 快速问答

**Q：面片数据会不会无限增长？**
A：图集固定 4096²；`Texture2DAtlas`（smol-atlas 装箱）deallocate 释放的面片矩形可复用；不可见面片进 `freeFacetsIDs` 释放（cpp:553–556），可见性由 minDistance + texelCount 判定。

**Q：为什么要有 512² 工作台，直接写 4096² 不行吗？**
A：工作台只装"本帧待办"（≤50 个面片请求），小而快；全图集每帧重画不现实。属性与光照都在工作台算完再 `CopyRects` 搬回。

**Q：面片怎么跟模型的 LOD 对应？**
A：GIFacet 无显式 LOD 枚举——`log2Resolution` 随距离变（近处 64²、远处 8²），分辨率变化触发 persistent 重分配（保留旧 rect 做历史重采样）；`log2Bias` 处理各向异性。
