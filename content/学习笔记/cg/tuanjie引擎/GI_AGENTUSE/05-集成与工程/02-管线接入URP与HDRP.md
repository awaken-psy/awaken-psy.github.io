---
title: 02 管线接入：URP 与 HDRP
publish: true
updated: 2026-09-21T03:01:30.908Z
---

# 02 管线接入：URP 与 HDRP

> 源文件：`RenderPipeline/TuanjieGIForURP.h/.cpp`、`RenderPipeline/TuanjieGIForHDRP.h/.cpp`、`RenderPipeline/TuanjieGIForRPCommon.h`、三个 `*.bindings.cs`
> 作用：把 TuanjieGI 挂进 URP/HDRP 的渲染循环——从管线拿输入（GBuffer/深度/运动矢量），算完把输出图交回去。
> 前置阅读：[01-TuanjieGIManager与帧调度](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/01-TuanjieGIManager与帧调度.md)、[../04-屏幕层/01-总体流程](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/01-总体流程.md)

## 1. 入口与调用链

两条接入路径同构：

```cpp
// TuanjieGIForURP.cpp:27-36（HDRP 版同构，HDRP.cpp:21-30）
void GIForURP::Execute(ExecutionContextURP& ctx) {
    if (!TuanjieGIManager::GetInstance()->ValidateGIPipeline()) return;
    if (!instance) return;                      // instance 单例（cpp:16-26）
    instance->updateView(ctx);
}
```

- `ExecutionContextURP` 是 C# 侧填充的"输入包"（`TuanjieGIForURP.bindings.cs`）：commandBuffer、camera、GBuffer0-3、normalBuffer、motionBuffer、colorBuffer、depthPyramid、depthMipOffset、灯计数、以及画质参数（renderScale、finalGatherQuadInterval=16、facetRasterizeFrameCount=50、facetMaxReRasterizeFrameCount=6、minGIDetail、updateSpeed 等）。
- C# 的 URP/HDRP 渲染 pass 构造该 context 后调静态 `Execute`。**具体是哪个 RenderPass/CustomPass 在本模块源码内不可见**（属于 C# 侧包代码）——确定的事实只有静态入口与数据流向。
- `GIForURP`/`GIForHDRP` 是刻意单例（注释 "if the wrong render pipeline accidently chosen, must crash."）。

## 2. `updateView`：一帧的完整流程（URP 版，cpp:120–300）

1. **包命令缓冲**：`stream = mgr->GetDSLDevice().create_stream_external(commandBuffer)`——GI 的 GPU 工作全部编进 URP 的 CommandBuffer，同一渲染流执行。
2. **建 FrameContext**（`MakeFrameContext` cpp:48–76）：搬运灯数、光照因子、quadInterval 等；两处换算：`facetCullTexelCount = clamp(round(facetOriginCullTexelCount/minGIDetail),1,1024)`、`sdfCullRadius = cdfOriginCullingSDFRadius/minGIDetail`；**`updateSpeed 存倒数**（`1/(context.updateSpeed+1e-6)`，越小越快）。
3. **`ExecuteGIPipeline(fctx)`**：先跑帧级管线（世界层等，见 [01-TuanjieGIManager与帧调度](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/01-TuanjieGIManager与帧调度.md)）。
4. **`FillViewContextWithNecessaryData`**（cpp:78–118）：把 URP 的 RenderTexture 用 `PooledRenderTexture` 包装进 `vctx`（depthPyramid/normalBuffer/motionBuffer/colorBuffer/cloudBuffer/depthMipOffset/GBuffer0-3）；`viewParam`（viewMin/viewMax=viewRect×renderScale、各缓冲尺寸及其倒数、灯数、referenceNear/Far）经 `GIConstantBuffer<ViewParamURP>::create + SetData` 上传。
5. **history/next 双缓冲切换**：`viewStates` 按 Camera* 存上帧状态；本帧从它取 `historyStates`，`nextStates.frameNumber = history+1`；视口尺寸变化则丢弃历史重建。
6. **创建输出纹理**（格式均为源码事实）：`outputDiffuse`/`outputRoughSpecular` = **B10G11R11_UFloatPack32**；`outputNumFrames` = R8_UNorm；`depthBuffer` = R32_SFloat；`worldNormalBuffer`/`bentNormalBuffer` = B10G11R11；反射开启时另有 `outputReflectionSpecular`、`specularAccumulationCountBuffer`（R32_SFloat/uint）、`outputCompositeSpecular`。全部走 `GraphicsTexturesPool`（池化）。
7. **`onUpdateView.Emit(fctx, vctx)`**：把填好的 vctx 广播给实际干活的监听者（TracingView → indirectLightingScene/specularLightingScene → tracer 链，见 [../04-屏幕层/01-总体流程](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/01-总体流程.md)）。**GIForURP 自己不 dispatch 追踪**，只做重投影与合成两步。
8. **时间重投影**：有历史且尺寸一致 → `ReprojectHistoryTextures(fctx)`；首帧/历史失效 → 对输出纹理逐个 ClearRenderTarget 清零（防池内陈旧内容污染）。
9. **镜面合成**：`enableReflection` 时 `CompositeSpecularTextures(fctx)`；否则 `outputCompositeSpecular` 直接别名 `outputRoughSpecular`。
10. **存档**：`viewStates.insert_or_assign(camera, vctx.nextStates)`——next 转正为下一帧的 history。

### 2.1 ReprojectHistoryTextures（cpp:386–397）

用 `GetCommonReprojectHistoryTexturesShader`（算法全文见 [../04-屏幕层/06-历史混合与重投影](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/06-历史混合与重投影.md)）；URP 设 permutation `enableAccurateHistory=true`、`enableBentNormal=false`；dispatch `(viewportSize+7)/8` 个 8×8 组；**`maxAccumulatedFrames = clamp(round(reprojectionMaxFrames × fctx.updateSpeed), 1, 20)`**——像素层历史上限由 GIOption `reprojectionMaxFrames`（默认 8）与 updateSpeed 共同决定。

### 2.2 CompositeSpecularTextures（cpp:399–433）

8×8 kernel：读 `GetReflectionSpecularRT()`（SSR 类反射结果）与 `GetSpecularRT()`（GI 粗糙镜面）；`NeedReflection` 为真时 `blendFactor = saturate((maxRoughnessToTrace - roughness)×10)` 混合两者（注释 "TODO: magic number"），否则直写粗糙高光。**HDRP 版多一个 clear coat 分支**：`MATERIALFEATUREFLAGS_LIT_CLEAR_COAT && coatMask>0` 时直写反射。

## 3. 输出交付

静态 getter 按 Camera 查 `viewStates` 返回 RenderTexture（cpp:339–374）：

| getter | 纹理 | 内容 |
|---|---|---|
| `GetDiffuseIndirectTexture` | outputDiffuse | 间接漫反射 |
| `GetSpecularIndirectTexture` | outputCompositeSpecular | 合成后的镜面（反射混合粗糙高光） |
| `GetReflectionSpecularIndirectTexture` | outputReflectionSpecular | 反射分量 |
| `GetRoughSpecularIndirectTexture` | outputRoughSpecular | GI 粗糙镜面分量 |

C# 侧同名的静态 extern（bindings.cs）供后续光照合成 pass 取用。bent normal 图经 `GetBentNormalRT` 供材质/调试使用。

## 4. URP vs HDRP 差异总表（均源码事实）

| 项 | URP | HDRP |
|---|---|---|
| 纹理类型 | `GITexture2D`（GBuffer/normal/color） | `GITexture2DArray`（同名资源全为数组切片） |
| depthBuffer 创建 | `create_texture2d` | `create_texture2d_array` |
| BSDF/光照 | `URPBSDFDataDummy`（仅 normal+roughness 的占位） | `LightingContextHDRP` 完整实现：Point/Spot/ProjectorPyramid/Box/Tube/Rectangle/Disc 光型衰减 |
| `fLightRangeCompressFactor` | **1.6384f** | **16384.0f**（相差 10⁴ 倍——光照范围压缩系数不同） |
| `useBentNormal` | false | true |
| `accurateGbufferNormals` | 0 | 1 |
| `enableInterleavedUpdate` | true（GIOption 可调） | 固定 false（无该 GIOption） |
| GIOption | referenceNear/referenceFar/enableInterleavedUpdate/reprojectionMaxFrames | referenceNear/referenceFar/reprojectionMaxFrames（3 项） |
| 硬件光追 | FrameContext 无该字段 | `fctx.enableHardwareRayTracing`（MakeFrameContext 设置） |
| 透明物体 | 无专门入口 | `ExecuteTransparentSpecular` → `updateForTransparency`（独立 `transparencyViewStates`，只建透明镜面输出，不跑 ExecuteGIPipeline） |
| viewMax 来源 | `camera->GetScreenViewportRectInt()×renderScale` | `context.screenParams`（动态分辨率需一致，HDRP.h:52 注释） |
| Reproject permutation | `enableAccurateHistory=true, enableBentNormal=false` | 只设 `enableAccurateHistory` |
| 首帧清屏 | 清 5–7 张输出 | 只清 outputNumFrames |
| 可视化颜色映射 | 整段被注释（未实现） | 已实现（ExecVizColorMapping 启用） |

## 5. URP 未实现 vs HDRP 已实现（2026-09 精读两文件全量后确认）

以下方法在 **URP 侧是占位/注释**、**HDRP 侧有真实现**——引用时必须区分平台：

| 方法 | URP 状态 | HDRP 实现 |
|---|---|---|
| `PlaceQuadInViewport` | 返回 `(uint)-1`（TODO: smart quad placer） | 视口内直接作 quadCenter，否则 -1 |
| `WorldPositionToViewportCoord` | 返回 `uint2(-1)` | 世界→RWS→NDC×viewportSize |
| `ViewPixelOffsetToUV` | **恒返回 (0,0)**（实现被注释） | `(viewPixelOffset+viewMin)×depthBufferSizeRcp` |
| `GetHistoryClipPosByDeviceZ` | 函数体全注释，返回 0 | 已实现（镜面历史深度投影） |
| `ReflectionHistoryColorAndCount` | **函数体全注释，返回 float4(0)** | 已实现：dissoclusion = `exp(−|1−max(0,dot(N,历史N))|×1.4) × exp(−|历史深度−当前深度|/当前深度)`；全部 >0.9 取均值、部分 >0.9 取最大池坐标（四象限 offsets）；`transparencySurface` permutation 切透明缓冲 |
| `ReadTransparencyMaterial` | 全注释（返回 0） | `_NormalBufferTexture` + `DecodeFromNormalBuffer` |
| 交错 `GetValidQuadInterleaved2` | 真正按组轮换（isTracing 生效） | **忽略 isTracing**（对应 HDRP 固定不交错） |

**URP 的 `ReflectionHistoryColorAndCount` 返回 0** 意味着：屏幕镜面 TemporalDenoise 的"命中深度历史源"在 **URP 上恒零**，双源混合实际只剩像素深度历史一路。

### 5.1 两套运动矢量解码（完全不同，别混用）

| | URP `DecodeMotionVector3D` | HDRP `DecodeMotionVector3D` |
|---|---|---|
| xy | `round(saturate(in)×65535)` → int16 符号扩展（32768→−65536）→ `/32767` | 直接用 `in.xy` |
| z | `(packed.z<<16)\|packed.w` 位拼 → `asfloat` | `in.z + in.w/65536`（w 是低位小数） |
| 缩放 | 整体 `×0.5f` | 无 |
| 无运动判定 | `PixelSetAsNoMotionVectors`：xy≈32767/65535（±1/65535 容差）且 zw≈0 | `in.x > 1.0f` 即无运动 |

### 5.2 其他精读确认的平台差异

- **粗糙度通道**：URP `1 − normalBuffer.w`；HDRP **直接用 `normalBuffer.w`**（不取反）。
- **历史深度查询**：URP `QueryHistoryCoordDepth` 从 `depthBufferBind.load` 取当前深度；**HDRP 从 `depthPyramid.load` 取**。该函数本身只判 `|prevClipPos|<1`；URP 的真实深度校验在 `CenterHistoryCoordAndDepth`（历史 viewZ 容差 **0.02**）。
- **抖动**：URP 主路径蓝噪声（`GetQuadJitter` 备用）；**HDRP 当前用 8 周期确定序列**（`GetJitter = GetQuadJitter()×quadSize`，蓝噪声版被注释）。
- **WeightMesure 历史中心**：URP `GetWeightMesureHistoryCenter` **normal 置 0**（即历史匹配只靠屏幕距离+深度两判据）；HDRP 用**历史世界法线**（三判据齐全）。
- **HDRP `IsScreenLightVisible`**：只有 Tube（`size.x/2`）与 Rectangle（对角线/2）有 lightExtent 外扩；Point/Spot/Projector 系为 0。
- **曝光**：URP 硬编码 1；HDRP 走 HLSL call 取真实曝光。
- `GetSkyboxCubemap`（URP.cpp:143–180）：临时 cubemap 1024²、11 mip、D16 深度、HDR 时 R16G16B16A16_SFloat；无 skybox 材质直接释放返回；`OnePassPerFaceMaterial()` 决定逐面或全脸渲染。

### 5.3 HDRP 各光型强度公式（calcLightIntensity，TuanjieGIForHDRP.h L258–428 全解）

按 `$switch(lightType)` 分发（L392–428），六种光型四个实现。注意**命名反直觉**：`calcLightIntensity_Punctual` 服务 **Point 和 Spot**（两者差异仅由 `angleScale/angleOffset` 参数携带，Spot 非零）；`calcLightIntensity_Projector` 服务 ProjectorPyramid/ProjectorBox。

| 光型 | 实现 | 公式（本档逐行抄录核实） |
|---|---|---|
| Point / Spot | `_Punctual`（L293–308） | `intensity = PunctualLightAttenuation(distances, rangeAttenuationScale, rangeAttenuationBias, angleScale, angleOffset)`——距离+角度衰减全部委托 HDRP 公共函数 |
| ProjectorPyramid / ProjectorBox | `_Projector`（L257–291） | 同上 PunctualLightAttenuation，**外加视锥包围盒检查**：把采样点变换到灯空间，`positionCS = positionLS.xy / (Box 型则 z=1)`；`boundZ = |z−r/2| − r/2 + 1`；`isInBounds = max(|x|,|y|,boundZ) ≤ boxLightSafeExtent`，不满足则 intensity=0 |
| Tube | `_Line`（L310–339） | `invAspectRatio = saturate(range/(range+len/2))`；`intensity = EllipsoidalDistanceAttenuation(unL, right, invAspectRatio, …)`；再乘 `len / max(sqDist, 0.0001)`——注释明确这是**对 LTC 立体角衰减的近似**（"area lights in HDRP get this via LTC polygon irradiance, which we don't compute in TuanjieGI"） |
| Rectangle | `_Rect`（L341–390） | 背面裁剪 `dot(forward, unL) < FLT_EPS` 才计算；距离衰减由 `ELLIPSOIDAL_ATTENUATION` 宏二选一（`EllipsoidalDistanceAttenuation` 或 `BoxDistanceAttenuation`，`invHalfDim = 1/(range+halfWidth, range+halfHeight, range)`）；再乘 `area(=size.x×size.y) / max(sqDist, 0.0001)`（同为 LTC 近似） |
| Disc | — | 枚举存在（GPULightType::Disc）但 `$switch` 无对应 case，intensity 保持 0 |

**超出本档范围**（诚实声明）：`PunctualLightAttenuation / EllipsoidalDistanceAttenuation / BoxDistanceAttenuation / GetPunctualLightVectors` 的函数体在 HDRP 公共包（`com.unity.render-pipelines.high-definition` 的 include）内，**不在 TuanjieGI 模块源码中**——TuanjieGIForHDRP.h 只经 `call<>()` 引擎函数调用它们。因此各衰减的精确数学式以 HDRP 文档为准，本档只保证调用签名与传参。

另外 `sphereOverlapOtherTypeLight`（原名即此，L431 起——灯-块包围球粗剔除）：`dist < range + lightExtent + blockRadius.w`；其中 lightExtent 仅 Tube（`size.x/2`）与 Rectangle（`sqrt(size.x²+size.y²)/2`）非零，其余光型为 0。

## 6. C# 绑定（三个 bindings.cs）

- **TuanjieGIManager.bindings.cs**：`PipelineType` 枚举、`enabled`/`pipelineType`/`debugTextureIndex`/`fullscreenDebug*` 属性、`SetTestTexture`、`GetTextureByIndex/ByName`（**调试用**：按名字/索引取池内纹理，调试视图的取图通道）。
- **TuanjieGIOptions.bindings.cs**：`MarshalOptions()` 把全部 `GIOption`（name/desc/type/id）拉到 C# 动态构面板；`SetBoolOption/GetIntOption/SetFloatOption` 按 id 写回。
- **TuanjieGIConfig.bindings.cs**：`TuanjieGIConfigObject` 只暴露 `enable` 开关。
- 非 `TUANJIEGI` 平台三者均有同名空 stub。

## 7. 支持的渲染后端

`Utility/GlobalConfig.h`：`TuanjieGISupportedRHI = Platform::d3d11 | Platform::vulkan | Platform::metal`。几乎每个 kernel 开头调 `TuanjieGiSetOnlyRenderers()` 把 DSL 生成目标限制在这三家（无 GLES/WebGL——对应"微信小游戏不在支持范围"）。

## 8. 快速问答

**Q：URP 的 GBuffer 语义是什么？**
A：GI 只用 GBuffer0 的 w 通道材质 flag（`GetMaterialFlag`）与 normalBuffer（法线 + w=1−perceptualRoughness，`ViewportCoordToWorldNormalRoughness` 还原）。`RenderPipelineBSDFData` 是 dummy——URP 侧 GI 不做完整材质重建。

**Q：为什么 URP 和 HDRP 的 `fLightRangeCompressFactor` 差一万倍？**
A：本档已核实：URP.h:114 为 1.6384、HDRP.h:115 为 16384.0，数值即如此。它是输出写入前的亮度压缩系数（写回时乘、读历史时除，见 [../04-屏幕层/06-历史混合与重投影](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/04-屏幕层/06-历史混合与重投影.md)）。**差异的具体原因源码无注释说明（[../06-参考/04-未解之处](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/06-参考/04-未解之处.md) B.5）；引用时注意别把两处混用。**

**Q：Exposure 校正起作用吗？**
A：URP 的 `GetInversePreviousExposureMultiplier/GetCurrentExposureMultiplier` **硬编码返回 1**（TuanjieGIForURP.h）——URP 路径下曝光校正实际不生效；HDRP 侧在 LightingContext 内处理，集成层无显式字段。
