---
title: 05 面片光照 GILighting（直接光入账）
publish: true
updated: 2026-09-22T03:36:59.257Z
---

# 05 面片光照 GILighting（直接光入账）

> 源文件：`GILighting/DirectDiffuse.h`、`DirectDiffuseLoop.h`、`DirectionalDiffuse.h`、`GILightDataForDSL.h`、`GILightDataVisualize.h`
> 作用：在**面片图集上**逐 texel 计算直接光（点光/聚光/方向光），带阴影射线，结果写进工作台的 DirectLighting 图层，由 [02-面片系统GIFacet](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/02-面片系统GIFacet.md) 的复合步骤并入出射光。

## 1. 定位：这是"面片光照块"，不是屏幕

本目录的所有 "quad" 指**面片图集上的 8×8 texel 光照块**（`kLightingQuadSize`）——每块一块小正方形图集区域，共享一组共享内存与光列表。线程组 `(8,8,1)`，一组处理一块的 64 个 texel。GPU-driven 平台图集 512² → 64×64 块；persistent 4096² → 512×512 块。

调用点：`LightingFacets` 中 `DispatchMemset(DirectLighting, 0)` 清零后，`DirectDiffuseLoop::update` / `DirectDiffuse::update`（点光/聚光）与 `DirectionalDiffuse::update`（方向光）依次执行（GIFacetScene.h:1634–1668）。

## 2. DirectDiffuse（点光/聚光版）

`FilterRendererToLightQuadsAndTrace` 是一个 `NaiveGPUFilter` 的 `filter1ToNCustom` 上下文（名字 `, 0, 4` 是用途码参数）：

### 2.1 每组的准备（Context 构造，DirectDiffuse.h）

```cpp
$if (GroupIndex() == 0) {
    auto quad = This->vctx->GetValidQuad(validQuadIndex);   // 取本组对应的有效块
    centerAndRadius = float4(quad.GetWorldCenter(), quad.GetRadius());  // 块的世界包围球
    outputCoord = quad.ScreenOrigin();                      // 图集坐标
    inputCoord  = quad.GetOriginPixelOffset();
    facet = quad.parentFacet;                               // 宿主面片
}
// 每线程：从 persistent 图集读 texel 的世界位置与法线
worldPositionOfThisPixel = facet->PixelOffsetToWorldSpace(persistentAtlasLayers, inputCoord + GroupThreadID().xy());
worldNormalOfThisPixel   = facet->PixelOffsetToWorldSpaceNormal(persistentAtlasLayers, ...);
```

### 2.2 光的收集（每块最多 8 盏）

- `getValidatorCount()` = 其他类型灯总数；`useValidatorForGroup(lightIndex)` = `sphereOverlapOtherTypeLight(lightIndex, centerAndRadius)`——**块包围球先做粗剔除**。
- `runThreadLogic(lightIndex)`：命中的灯 `interlocked_add` 挤进组共享数组（`lightIndexArray/lightPositionWSAndRangeArray`），**上限 `kMaxDirectLightingPerQuad = 8`**，满了 `$break`。

### 2.3 逐 texel 逐灯计算

```cpp
intensity = calcLightIntensity(lightIndex, pos);
L = normalize(lightPos - pos);
NDotL = saturate(dot(N, L));
pixelToLightDistance = length(lightPos - (pos + N * traceBias));   // traceBias = 0.05
light = calcLightColor(lightIndex, pos) * intensity * NDotL;

inShadow = all(light < 0.01);        // 贡献小到不值得 trace
$if (!inShadow) {                    // 阴影射线：朝灯打一条遮挡检测线
    rayStart.start = pos + N*traceBias;
    rayStart.maxDistance = pixelToLightDistance;   // 到灯为止
    rayStart.direction = L;
    $if (tracer->trace(vctx, rayStart, rayHit) && rayHit.hitDistance < pixelToLightDistance)
        inShadow = true;
}
$if (!inShadow) result += light;
```

析构 `~Context()`：`GetDirectLightingRT().write(outputCoord + GroupThreadID().xy(), result)`——**写回工作台 DirectLighting 图层**（B10G11R11）。

阴影射线是**短程查询**：maxDistance 到灯即止，命中即遮挡——这正是六级查询中②级（cluster/精场短程）的典型用途；tracer 由 LightingFacets 选择（HWRT 平台 + `directLightingInlineRayTracing` 开 → inline ray tracer；否则 cdfTracer）。

## 3. DirectDiffuseLoop（循环版——**默认实现**）

`directLightingUnlimitedLights`（默认 **true**，"all lights contribute"）时走本实现（GIFacetScene.h L1589 的分支；false 才走 §2 的 DirectDiffuse）。核心差异：**不收集灯进组共享数组，逐灯直接算**。

- 顶层：`filter1ToNLoop(fctx.stream, filter)`（区别于 DirectDiffuse 的 `filter1ToNCustom`），`kBlockBufferSize = 256`——`filter1ToNLoop` 模式下每线程块以 256 个候选为一组迭代处理**全部**灯（这就是 "unlimited lights" 的实现方式）。
- Context 构造与 §2 相同（组共享只有 facet/outputCoord/inputCoord/centerAndRadius，**没有灯数组**，因此不需要两次 barrier）；
- 核心回调换成 `validateForThread(lightIndex)`——每灯**当场**计算：位置/强度/NDotL（`traceBias=0.05`）→ `inShadow = all(light<0.01)` 早退 → 阴影线（`maxDistance=到灯距离`）→ 未遮挡则 `result += light`；
- 析构写回同 §2（`GetDirectLightingRT().write`）。

| 维度 | DirectDiffuse（§2） | DirectDiffuseLoop（本节，默认） |
|---|---|---|
| 筛选调用 | `filter1ToNCustom` | `filter1ToNLoop` |
| kBlockBufferSize | 8（**每块灯数硬上限**，超了丢弃） | 256（分批迭代，不丢灯） |
| 组共享灯数组 | 有（收集→barrier→统一算） | **无**（逐灯直接算，无 barrier） |
| 适用 | 灯少 | 灯多/不限灯 |

两条分支内的阴影 tracer 选择相同：HWRT 且 `directLightingInlineRayTracing` → inline ray tracer，否则 cdfTracer。

## 4. DirectionalDiffuse（方向光）

- 对 `GetDirectionalLightCount()` 循环，每盏方向光一次 **nofilter**（无过滤）dispatch（DirectionalDiffuse.h:46–50）。
- 每方向光：`L = normalize(-getDirectionalLightDirection(id))`、`NDotL = saturate(dot(N,L))`、`light = calcDirectionalLightColor(id, pos) * NDotL`。
- **阴影**：`rayStart.maxDistance = 1000000.0f`（无界——方向光的"灯"在无限远），命中即 `inShadow`。
- 写回是**累加**：`rt.read(pixelCoord) + light`——多盏方向光逐次叠加（每盏一次 dispatch）。

## 5. 光数据布局（GILightDataForDSL.h）

纯数据结构，对齐 HDRP `LightDefinition.cs.hlsl`：

- `GIDirectionalLightData`：positionRWS、lightLayers、lightDimmer、shadowTint/shadowDimmer、flare 等；
- `GILightData`：lightType、range、angleScale/angleOffset（聚光锥）、iesCut、size、boxLightSafeExtent；
- `GILightDataURP`（URP 版）：lightType/posWS/color/attenuation/scale/direction/hasShadows——URP/HDRP 光源数据结构不同，由各自 LightingContext 填充。

URP 侧的光强求值（LightingContextURP，TuanjieGIForURP.h:264–282）：`calcLightIntensity_Punctual` 调 URP 的 `DistanceAttenuation`/`AngleAttenuation`；HDRP 侧在 LightingContextHDRP 支持更多光型（Point/Spot/ProjectorPyramid/ProjectorBox/Tube/Rectangle/Disc）。一个 URP 侧源码事实：`GetLightPositionWSAndRange` 硬编码 range=1000（TuanjieGIForURP.h:310–314）。

## 6. 与复合的关系

DirectLighting 图层的值在 `DoCompositeRadiosity` 里并入出射光（[02-面片系统GIFacet](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/02-面片系统GIFacet.md) §5.1）：

```
out += DirectLighting × (1/fLightRangeCompressFactor) × (1/PI) × directlightingFactor
```

（写 DirectLighting 时灯色已含强度与 NDotL；1/π 把它规约为漫反射辐照度贡献。）

## 7. 调试可视化（GILightDataVisualize.h）

`GIOption<bool> enable = AddVisualize(name+".enable", "When enable, this will slow down the framerate, since it cost GPU time to render the TuanjieGI GILightDataVisualize.")`；kernel 累加全部方向光色 + 点光/聚光 `calcLightColor×calcLightIntensity`，乘曝光写 VisualizeRT——**不 trace 阴影**，纯光照可视化。另有 `directLightingDebug`（"Output an additional direct irradiance buffer."）输出直接辐照度缓冲。

## 8. 快速问答

**Q：面片直接光和屏幕层什么关系？**
A：无关——本目录只服务世界层（面片出射光含直接光成分）。屏幕层的直接光是渲染管线自己画的，GI 只补间接部分。

**Q：每块最多 8 盏灯是硬限制吗？**
A：`kMaxDirectLightingPerQuad=8` 是组共享数组的容量；超过 8 盏灯重叠的面片块只处理 8 盏。`directLightingUnlimitedLights`（默认 true）选择 Loop 版实现以支持更多灯。

**Q：阴影射线的成本怎么控制？**
A：三重裁剪——块包围球先剔除无关灯；`light < 0.01` 的灯跳过 trace；射线 maxDistance 到灯为止（短程），不全程步进。
