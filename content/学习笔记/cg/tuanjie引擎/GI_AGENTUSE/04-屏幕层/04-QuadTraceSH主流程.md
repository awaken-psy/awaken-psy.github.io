---
title: 04 QuadTraceSH 主流程（全模块最核心文件）
publish: true
updated: 2026-09-22T03:35:14.138Z
---

# 04 QuadTraceSH 主流程（全模块最核心文件）

> 源文件：`GITracing/QuadTraceSH.h`（1822 行，已全文核实）；配套：`GITracing/IndirectLightingScene.h`（采样分布与管线协调）、`GITracing/TracingDispatcher.h`（多 tracer 分发）、`Math/SphericalHarmonics.h`（SH 实现）
> 作用：屏幕层间接光的总算法——铺采样块、发射线、逐级查询、滤波、历史混合、压成 SH、摊回像素。
> 前置阅读：[02-采样块与射线发射](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/02-采样块与射线发射.md)、[08-方向采样与重要性采样](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/08-方向采样与重要性采样.md)、[../01-背景知识/02-球谐函数SH](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/02-球谐函数SH.md)、[06-历史混合与重投影](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/06-历史混合与重投影.md)

## 0. 先校准三个"块"的概念

| 名字 | 尺寸 | 用途 |
|---|---|---|
| **采样块 quad（屏幕）** | `quadInterval` 像素见方，URP 实配 **16**（`ExecutionContextURP.finalGatherQuadInterval=16` → `ViewContextURP.quadInterval`；QuadTraceSH 自己的 GIOption 默认 8，被 ViewContext 覆盖） | 屏幕层间接光的最小查询单位，256 像素共享一套结果 |
| **射线格** | 8×8 = **64 方向**/块（`kLightingQuadSize`） | 每块朝半球的 64 条射线按八面体格编号 |
| **面片光照块（图集上）** | 8×8 texel | 直接光/间接光在面片图集上的处理粒度（[../03-世界层/05-面片光照GILighting](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/05-面片光照GILighting.md)） |

## 1. 数据结构（L30–L53, L799–L812）

- `HitBuffer::kThreadBlockSize = (kLightingQuadSize, kLightingQuadSize, 1)`——每线程组处理一块的 64 条射线。
- `hit` 纹理：R32 单通道，**一帧生命周期**（L49）。
- `hitPayloadBuffer`：3×W×H 个 uint4（L50）——命中载荷（rendererIndex / hitPositionAndBias / hitNormal 三个 uint4）。
- `encodeCoord/decodeCoord`（L799–812）：把"块索引 + 块内 8×8 射线 xy"压进一个 uint，是贯穿全文件的坐标编码。
- `framesAccumlatedPerQuad`：R8，每块的累积帧数（历史可靠度）。

## 2. `execute`：入口（L325–395）

1. `SetQuadInterval(vctx)`：采样块尺寸；`interleaveCount`：交错更新分多少组（GIOption `interleavedUpdateSize=4` → 4×4=**16 组**轮换，每帧 1/16 的块真正发线）。
2. 建 `hitDistance`/`radiance` 纹理，尺寸 = `quadCount2D × kLightingQuadSize`（每块占 8×8 texel 的射线结果区）（L351–353）。
3. `jitterMode = (HDRP||URP) && integrateScreenSpace`（L362）。
4. **有历史**时 `GetQuadFromHistory` 取历史块（L371）；**射线方向生成器**二选一（L373–390）：
   - 重要性采样开 → `ProductImportanceDirSampling<VC, importanceSampling=true/false>`
   - 否则 → `HemiOctahedronDirSampling`（均匀半球八面体格）

### 2.1 两个方向生成器（IndirectLightingScene.h）

- `HemiOctahedronDirSampling`：`generateDistribution` 为空——**均匀**半球八面体 64 格，无偏。
- `ProductImportanceDirSampling`：用上一帧系数重建亮度分布——

```cpp
pdf = 0.3f*L.x + 0.5f*L.y + 0.2f*L.z;        // L = 历史重建的该方向亮度
weight = dot(normal, dir) < 0 ? 0 : 1;        // 上半球裁剪
// 前缀和 64 项；pdfStep = lightingPDFSum / 128.0f
```

  求和按立体角权重校正；`GetImportance = 4π/kLightingQuadSize²`（64 格均分半球）。

## 3. `DoExecute`：六级的实现（L396–470）

**TracerType 位掩码**（L416–425）：

```
kScreen=0, kSDF=1, kCDF=2, kInlineRay=3, kRay=4
```

- mask 按能力构建（L428–456）：屏幕 tracer 恒可用；SDF/CDF 看精场数据；**硬件光追可用时把 kSDF/kCDF 位清掉**（L449–455）——光追整体替换距离场，不叠加。
- `lowestBit/highestBit`（L458–459）：**第一级用最便宜的可用级，最后一级用最贵的**——中间的全跳过。
- `dispatchTrace<isFirst, isLast>` 四个特化（L461–482，对应 TracingDispatcher）：
  - `<true,true>`：只有一个 tracer，`nofilter` 直接全量
  - `<true,false>`：第一级之后要压缩未命中的
  - `<false,true>`：接手压缩队列，之后不再压缩
  - `<false,false>`：接手队列，还要继续压缩给下一级

### 3.1 TracingDispatcher 的流压缩（TracingDispatcher.h）

- `FirstDispatch::kThreadBlockSize = RayGenerator 的线程块`；`CompactDispatch` 64×1。
- `DoDispatch` 四特化对应上面四个模板参数组合：不需要压缩时 `nofilter`，需要时 `filter1To1`（GPUFilter 把"未命中的射线"紧凑重排）。
- `DoMultiPassDispatcher`：串联多个 tracer，**只有链上最后一个做压缩后的收尾**。
- `createOptionalDispatcher<DummyTracer, A, B, C...>`：按 `HasValidData()` 挑第一个有效的；**DummyTracer 恒无效**——占位用（如无 HWRT 平台）。

## 4. 后处理链（DoExecute 尾部，L522–549）

```
alignRay → borrowRadiance → SeperableFilter → BoxFilter → BlendHistoryQuads → convertSH(9×3) → IntegrateScreenSpace / Integrate
```

### 4.1 alignRay：归位（L885–951）

重要性采样把射线派到了非均匀方向，结果须按真实方向归回规整 8×8 格：

```cpp
targetProjection = clamp(floor(mapToSphereOctahedronInverse(dir) * 8), 0, 7);
```

多个射线挤进同一格时累加（编码上限 `0xffffffff/(quadSize²)/1000`，L928）。此后所有处理只针对规整格。

### 4.2 borrowRadiance：向邻块借光（L953–1021）

历史块与本帧采样点错位（抖动）或历史失效时，从同平面的邻块借结果：

```cpp
historyConfidence  = exp(-len / max(historyDist, 1e-6));       // 历史离本帧越远越不可信
isClose            = (dPlane < 0.1) && (normalDot > 0.95);     // 同平面判据
spatialBorrowWeight = exp(-dLength * borrowFalloff);           // 距离衰减
borrowWeight       = (1 - historyConfidence) * spatialBorrowWeight;
result             = lerp(自身, 邻块, borrowWeight);
```

### 4.3 SeperableFilter：可分离空间滤波（L1317–1408）

- 两趟（横/纵），**kernelRadius=14 硬编码**（L1323）。
- **`realSigma = lerp(sigmaRsqr, sigmaRsqrMin, historyFrames)`**（L1345）——历史帧数越多，滤波越弱：新块靠宽 σ 压噪，老块保细节。
- 权重定点化 `×65536`（L1357）。
- 之后 `BoxFilter`（核 5）再过一遍轻滤波。

### 4.4 BlendHistoryQuads2：块级历史混合（L1524–1636）

- 混合权重（L1528/L1630，源码原文）：

```cpp
Float currentFrames = lerp(rcpMinFrameCount, rcpMaxFrameCount, historyFrames);
// rcpMinFrameCount = 1/2, rcpMaxFrameCount = 1/16（historyFrames 为归一化帧数 0..1）
```

  即权重在 **1/2 与 1/16 之间随历史长短插值**——界即选项 `.blendHistoryQuads.minFrameCount=2`（注释 "Frames to accum for fast moving object"）与 `.maxFrameCount=16`（"Frames to accum for static object"）（L210–211）。`lerp(历史, 本帧, 权重)`；历史值混合前做 ±2 倍钳制（L1563）。数学意义：1/n 滚动平均的连续化版本（推导见 [01-背景知识/06-时域累积与重投影](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/01-背景知识/06-时域累积与重投影.md)）。
- 旧版 `BlendHistoryQuads` 整段 `#if 0` 保留（L1480–1522）。

### 4.5 convertSH：压成 9×3 系数（L1023–1067）

```cpp
importance = GetImportance;                 // 4π/kLightingQuadSize²
shInt->project(dir, radiance * importance); // 逐方向累加进 SH
```

SH 存储细节（Math/SphericalHarmonics.h，源码事实）：

- `SphericalHarmonicsInt<9>`：**int3 定点编码，`SHEncodingScale = 1048576`（2^20）**——整数化让 `interlocked_add` 能原子累加。
- `project` 用标准 9 系数基（Y00=0.28209…，1/2/3 阶归一化系数在 .cpp 特化）。
- `invalid()` 标记：`rgb[0].x = -1`（常数项恒正，负即无效）。

### 4.6 Integrate：摊回（L1083–1183）

线程组 = `quadInterval`（一个块一处理），**邻域 size×size，默认 5（5×5 块）**（L1093）：

1. **系数插值**：每像素取邻域 5×5 块的系数，按"像素距块心 / 深度差 / 法线夹角"三判据高斯加权（`integrateDistanceReject=100`）——块分辨率回到像素分辨率，块印消除。
2. **按瓣求值**：

```cpp
// 漫反射：弯法线方向 + 余弦瓣（integrateDiffuse 固定 9 系数）
// ※ 弯法线由 permutation "integrateEnableBentNormal" 控制（=vctx.useBentNormal）：
//    HDRP 读弯法线缓冲；URP 关闭，$permutation_else 回退普通世界法线
diffuse += neighbors[i]->integrateDiffuse(bentNormal) * weight;
输出 *= INV_PI;
// 粗糙镜面：反射方向由（弯法线或回退的世界法线）算出 + 锥角瓣
Float3 reflect   = 2*dot(viewDir, bentNormal)*bentNormal - viewDir;
Float3 reflection = -normalize(reflect);
Cosine = (PI/2) * roughness;      // 锥角
specular += neighbors[i]->integrateRoughSpecular(reflection, Cosine) * weight;
```

（`integrateDiffuse` 用 9 阶 ClampedCosine 预卷积系数——`CosineA0=π` 等；`integrateRoughSpecular` 用 num 阶锥角系数，4 阶 16 系数版本存在特化。均见 SphericalHarmonics.h/.cpp。弯法线的平台开关全解见 [05-弯法线GISampleBentNormal](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/05-弯法线GISampleBentNormal.md) §2–§4。）

### 4.7 IntegrateScreenSpace：快速摊回（L1180–1300，逐行核实）

`useFastScreenIntegrate` 开启（URP 默认开）时的省成本版，与 §4.6 的 Integrate 是**两套不同实现**（还有更旧的 `IntegrateShader` L1063 起，用 quadSize 邻域 + bentNormal——三个版本勿混）：

1. **4 邻域取法**（L1196–1221）：`baseQuadCoord = GroupID().xy − 1`；组内前 4 个线程按 `delta = (n&1, n>>1)` 各取一个邻块（自身+右上 2×2），经 `GetQuadByCoord` + `LoadSHReal`（SH 从纹理逐系数读入）存入组共享；无效块清零（valid 位在 w）。
2. **空间权重 = 双线性基**（L1257）：

```cpp
Float2 t = (viewportCoord − baseQuadCenter + 1) / (quadInterval + 2);
Float4 SpatialWeights = 三个双线性基顶点权重的组合;   // 像素在本块内位置的 bilinear 权重
```

3. **深度权重**（L1259–1277）：对本像素切平面算各邻块世界位置的相对深度差：

```cpp
planeDistance[i]  = dot(邻块世界位置, 本像素法线) − dot(本像素位置, 本像素法线);
relativeDepthDiff = planeDistance / max(pixelDepth, 1e-4);
distanceWeight    = exp2(-quadWeightSigma × relativeDepthDiff²);
overlayWeight     = SpatialWeights × distanceWeight;   // quadWeightSigma = options.integrateDistanceReject（默认 100）
```

4. **求值**：漫反射方向用 `pixelDiffuseNormal = pixelSpecularNormalRoughness.xyz()`——**本路径直接用世界法线，bent normal 的使用行被注释**；粗糙镜面锥角 `(π/2)×roughness` 照旧。加权累加后按 `totalWeight` 归一。
5. **输出**（L1278–1284）：`diffuse × INV_PI` 写 `GetIndirectDiffuseRT()`；粗糙镜面在 `kSupportSpecular && permutation("integrateEnableRoughSpecular")` 下 `× INV_PI` 写 `GetSpecularRT()`（**注意镜面这里也乘 INV_PI**）。

## 5. 与其他子系统的协作

| 协作 | 说明 |
|---|---|
| 被谁驱动 | `IndirectLightingScene<QuadTraceIndirectLighting<...>>`（SWRTPipeline 的 `indirectLightingScene`），挂在 `onUpdateView` 上；其按相机的 `indirectLightingStates`、options 注入点（`finalGatherQuadInterval` 等）、`LoadSH` 9×3=27 逐系数读入与三个方向采样策略详见 [08-方向采样与重要性采样](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/08-方向采样与重要性采样.md) |
| 用谁的几何 | 六级 tracer（[03-六级查询与流压缩](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/03-六级查询与流压缩.md)）：ScreenTracer / SDFTracer / ClusterTracer / CascadedSDFTracer /（InlineRayTracer/RayTracer） |
| 用谁的光照数据 | 命中处面片的 Radiosity 图集（世界层，[../03-世界层/02-面片系统GIFacet](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/02-面片系统GIFacet.md)） |
| 输出给谁 | `GetIndirectDiffuseRT()`/`GetSpecularRT()` → 像素层重投影（[06-历史混合与重投影](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/06-历史混合与重投影.md)）→ 管线合成 |
| 双胞胎 | 同一个 TracingView 模式还实例化了一份给 `ScreenTraceSpecular`（镜面反射），复用同一批 tracer（SWRTPipeline.h L98–L129） |

## 6. 快速问答

**Q：一帧里每块到底发多少射线？**
A：64 条（8×8 射线格）；交错更新开时（URP 默认），每帧只有 1/16 的块真发——其余 15 组沿用历史（经借用/混合维持连续）。

**Q：为什么硬件光追开了就不用距离场？**
A：mask 构建时直接清 kSDF/kCDF 位（L449–455）——两套几何引擎只跑一套；命中后取色仍读面片图集。

**Q：`quadInterval` 到底是 8 还是 16？**
A：QuadTraceSH 的 GIOption 默认 8；URP/HDRP 接入层用 `finalGatherQuadInterval=16` 覆盖（`SetQuadInterval`）。实际运行 16×16 像素/块；8 是"面片光照块"和"射线格"的尺寸，三个数字不要混。

**Q：SH 系数是 float 吗？**
A：块内累加阶段用 **int3 定点（×2^20）**便于原子累加（SphericalHarmonicsInt）；求值阶段转 float（SphericalHarmonicsFloat/Real）。
