---
title: 01 TuanjieGIManager 与帧调度（总装）
publish: true
updated: 2026-09-20T10:06:42.980Z
---

# 01 TuanjieGIManager 与帧调度（总装）

> 源文件：`Public/TuanjieGIManager.h/.cpp`、`Public/TuanjieGIOptions.h/.cpp`、`Public/TuanjieGIConfig.h/.cpp`、`GIPipeline/ITuanjieGIPipeline.h/.cpp`、`GIPipeline/SWRTPipeline.h`、`GIPipeline/DFAOPipeline.h`
> 作用：把全部子系统组装成一台"每帧跑一遍"的机器——谁被谁构造、每帧按什么顺序执行。

## 1. 总装视角

三层结构：

1. **`TuanjieGIManager`**（单例）：持有 DSL 设备/上下文、帧事件、场景对象监视器（SceneWatcher）。本身**几乎不含逻辑**，只负责"每帧按序发三个事件"。
2. **`SWRTPipeline<GIForURP>` / `SWRTPipeline<GIForHDRP>`**：持有**全部**子系统（场景、tracer、视图）的具体对象，构造时把各子系统的执行段挂到事件上。
3. **`GIForURP` / `GIForHDRP`**（RenderPipeline/ 下）：渲染管线适配层，负责从 URP/HDRP 的 RenderTexture 填充 ViewContext，提供 `onUpdateView` 事件与输出访问器。

模块注册（`TuanjieGIModuleRegistration.cpp` L14–L26）：`UNITY_MODULE_INITIALIZE(TuanjieGI)` 时 `UNITY_NEW(TuanjieGIManager)` 存入全局 `SetITuanjieGIManager(...)`；cleanup 时删除。仅 `PLATFORM_TUANJIEGI` 下编译。

## 2. TuanjieGIManager 关键成员

- `oceanus::OCContext m_dsl_context; oceanus::Device m_dsl_device;`——构造时 `m_dsl_device(m_dsl_context.create_device("tj"))`，设备名固定 `"tj"`（TuanjieGIManager.cpp L44–L50）。所有 DSL shader 由它创建。
- `GetDSLShader<ShaderClass>()`（h L56–L75）：经 `hotfix::HotfixSlot` 惰性创建并缓存 shader。
- 帧事件（h L112–L118）：
  - `TuanjieGIEvent<FrameContext&> onBeforeUpdateFrame`
  - `TuanjieGIEvent<FrameContext&> onUpdateFrame`
  - `TuanjieGIEvent<FrameContext&> onAfterUpdateFrame`
  - `TuanjieGIEvent<> onGfxCleanup`
  - editor 专属：`onEditorCameraRendering`
- 场景监视器：宏 `TUANJIE_GI_DECLARE_WATCHER(TYPE,...)`（h L28–L29）为每类场景对象声明 `SceneWatcher<TuanjieGI<TYPE>>` 成员；`TUANJIE_GI_OBJECT(SCENE_EVENTS_CLEAR)` 之类宏按类型转发 Add/Remove/Update 通知。
- 常量（h L18–L22）：`kLog2LightingQuadSize = 3` → **`kLightingQuadSize = 8`**（L18–L19；直接光照用的 8×8 灯光块，与 GI 追踪的 16×16 采样块是两套）、`kFloatEpsilon = 1e-5`（L20）、`facetOriginCullTexelCount = 4`（L21）、`cdfOriginCullingSDFRadius = 0.2f`（L22）。
- 管线状态：`m_pipelineType`（默认 `kDisableTuanjieGI`）、`m_pipeline`（`SharedObjectPtr<ITuanjieGIPipeline>`）、`m_frameNumber`、editor 下另有 `m_applicationTickNumber`。

## 3. 每帧驱动：`ExecuteGIPipeline(FrameContext&)`

TuanjieGIManager.cpp L463–L522，按代码顺序：

1. **相机列表来自上一帧**（L466–L478）：把本帧 `fctx.cameras` 的 InstanceID 并入 `previousFrameCameras` 集合；清空后按集合重取相机指针——效果是"只要相机上帧出现过，本帧继续参与 GI"。注释明说"基于上一帧相机构造相机列表"。
2. **帧号判定**（L481–L496）：editor 下 `GetTimeManager().GetFrameCount()` 不变化，改用 `m_applicationTickNumber`（每次应用 tick 自增）；非 editor 用 `GetFrameCount()`。`isNewFrame = m_frameNumber != 新值`。
3. **GPU 资源池 Tick**（L497–L501）：`isNewFrame` 时调 `GraphicsBufferPool/GraphicsTexturesPool::TickPoolElements()`——池里"多久没用"的判断在此时更新。
4. **三段事件**（L503–L517），条件 `isNewFrame || fctx.isNewView`，**严格串行**（各有 Profiler 标记）：
   - `onBeforeUpdateFrame.Emit(fctx)`
   - `onUpdateFrame.Emit(fctx)`
   - `onAfterUpdateFrame.Emit(fctx)`
5. **场景事件清空**（L519）：`TUANJIE_GI_OBJECT(TUANJIE_GI_SCENE_EVENTS_CLEAR)`——把各 SceneWatcher 里积累的增删改通知清空，表示这些变更已在帧内被消化。

> `RenderGI()`（cpp L313）函数体为空；真正入口是 URP/HDRP 适配层调用 `ValidateGIPipeline()` → `ExecuteGIPipeline(fctx)`。

## 4. SWRTPipeline：全部子系统的构造顺序

`SWRTPipeline<GIForRP>`（SWRTPipeline.h L46 起）成员声明顺序即构造顺序——这份清单就是整个模块的"零件表"：

1. `BlueNoise blueNoise`（注释：必须随 pipeline 销毁而销毁）
2. `GIForRP giForRP`（URP/HDRP 适配层）
3. `GISDFScene sdfScene = facetScene`（模型精场）
4. `GICascadedSDFScene csdfScene = sdfScene`（级联粗场，见 [03-级联距离场GISDFExt](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/03-级联距离场GISDFExt.md)）
5. `GIHWRTScene hwrtScene{ facetScene }`（仅 `PLATFORM_HWRT_TUANJIEGI`）
6. `FacetSceneWithLighting<...> facetScene{ csdfScene [, hwrtScene] }`（面片系统 + 光照，见 [02-面片系统GIFacet](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/02-面片系统GIFacet.md)）
7. `IndirectLightingScene<QuadTraceIndirectLighting<...>> indirectLightingScene`（间接光屏幕层）
8. `IndirectLightingScene<ScreenTraceSpecular<...>> specularLightingScene`（屏幕空间镜面层）
9. `facetAccessorRadiosityStates`（面片访问器状态）
10. 一组 tracer：`SDFTracer`、`ClusterTracer`、`SkyLightTracer`、`CascadedSDFTracer`（+ HWRT 下 `InlineRayTracer`、`RayTracer`）、`ScreenTracer`
11. `GISampleBentNormalUpdater bentNormalUpdater`（弯法线）
12. **两个 `TracingView`**（定义在 GITracing/TracingDispatcher.h）：`indirectView` 与 `indirectViewReflection`——间接光与反射**复用同一批 tracer，但各挂各的 lighting scene**（SWRTPipeline.h L98–L129）
13. editor 专属：一串 `*Visualize` 对象（级联、SDF、光照数据、追踪、GBuffer、HWRT 等）
14. 两个相机移除监听：相机销毁时清对应 `indirectLightingStates`

管线选择：`CreateTuanjieGIPipelineByType`（工厂，ITuanjieGIPipeline.cpp）按 `m_pipelineType` 构造 `SWRTPipeline<GIForHDRP>` 或 `SWRTPipeline<GIForURP>`；`DFAOPipeline` 的工厂行被注释掉（ITuanjieGIPipeline.h L17–L19），属未接线的旧实验。

## 5. 事件挂接总表（谁监听哪段事件——已逐一核实）

帧的执行顺序 = 事件 Emit 顺序 × 各监听者的注册顺序（构造顺序）。每个子系统的挂接点：

| 子系统 | 挂接事件 | 溯源坐标 | 做什么 |
|---|---|---|---|
| `TransformTracker` | **onBeforeUpdateFrame** | TransformTracker.h:29 | 取本帧变化的 Transform → 逐组件 `UpdateForTuanjieGI()` |
| `GISDFScene` | **onUpdateFrame** + **onAfterUpdateFrame** | GISDFScene.h:100/110 | 精场登记/LOD 反馈/增量上传；After 段做清理类工作 |
| `GIHWRTScene` | **onUpdateFrame** | GIHWRTScene.h:85 | 光追加速结构 Reset/Cull/Build |
| `GIFacetScene`（FacetSceneWithLighting） | **onUpdateFrame** | GIFacetScene.h:1476 | 面片调度 → 光栅化 → 光照 → 复合（§世界层总架构） |
| `GICascadedSDFScene` | **onSDFSceneFrameUpdate** | GICascadedSDF.cpp:34 | 级联粗场增量重建（由 GISDFScene 每帧 Emit） |
| `SceneTrackedList`（各实例） | **onAfterUpdateFrame** | SceneTrackedList.h:38 | 帧末 ClearChange 清空变更列表 |
| `TracingView` ×2（间接/反射） | **onUpdateView**（GIForRP 的） | TracingDispatcher.h:289（267 行是被注释的旧构造，仅 289 为现役监听） | 屏幕层两条追踪管线 dispatch（透明 pass 有条件分支） |
| `GISampleBentNormal` / `GITraceBentNormal` | **onUpdateView** | GISampleBentNormal.h:84 / GITraceBentNormal.h:76 | 弯法线全屏更新（**开头守卫 `if(!useBentNormal) return`——URP 直接跳过**；透明 pass 也跳过） |
| 全部 `*Visualize` | **onVisualize**（GIForRP 的） | 各 Visualize 文件 | 编辑器调试视图（不进帧循环） |
| `DFAOPipeline`（未接线） | onUpdateView | DFAOPipeline.h:13 | （历史遗留） |

由此得出**一帧内的可靠顺序**：Before（TransformTracker）→ Update（GISDFScene → GIHWRTScene → GIFacetScene 按 SWRTPipeline 构造序，GICascadedSDF 随 GISDFScene 内部的 onSDFSceneFrameUpdate）→ After（SceneTrackedList 清理）；屏幕层在接入层 `updateView` 的 `onUpdateView.Emit` 处执行（世界层之后）。`IndirectLightingScene` **不直接订阅任何管理器事件**——它由 TracingView 驱动（TracingDispatcher 持有并 dispatch 它）。

## 6. 参数与配置系统

- **`GIOption<T>`**（TuanjieGIOptions.h L88）：模块内一切可调参数的类型。`Add(默认值, 名字, 注释[, onChange][, isFiltered])` 注册进静态 map（`ListOptions`/`ListFilteredOptions` 等，cpp L12–L30）；`VisualizeMode` 走 `AddVisualize`（初值恒 false）。C# 侧经 `TuanjieGIOptions.bindings.cs` 暴露。
- URP 实际注册的四个全局参数（TuanjieGIForURP.h L295–L298）：`referenceNear`（float，默认 2，"fake bilateral sigma near plane"）、`referenceFar`（float，默认 128，"cascade SDF AABB extent"）、`enableInterleavedUpdate`（bool，默认 **true**）、`reprojectionMaxFrames`（int，默认 **8**——像素层重投影的帧数上限）。
- **`TuanjieGIConfig`**（TuanjieGIConfig.h）：序列化配置对象，当前 `Transfer` 为空（无字段）；`TuanjieGIConfigObject`（类 ID `'TJGI'`）持 `enable` 开关，`SetEnable(true)` 时把副本写入全局单例。

## 7. 图形资源生命周期

- `CleanupGfxResources()`（cpp L63–L68）：`DestroyPipeline()` → 纹理池/缓冲池 `ReleasePool()`。
- `DestroyPipeline()`（L419–L427）：释放 `m_pipeline` 并 `onGfxCleanup.Emit()`——子系统监听它释放 GPU 资源。
- editor 的 `GenerateTuanjieGIMesh`（L528–L538）：资产导入入口——构造 `GIDataBuilder`（参数：mesh、renderer、scale、maxFacetNum、DoubleSidedMode、sdfGenBias），依次 `BuildGISDFMesh` / `BuildGIFacetMesh`，见 [06-数据构建GIDataBuilder](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/03-世界层/06-数据构建GIDataBuilder.md)。
- `InitShader()`（L277–L284）：按 `m_pipelineType` 对 URP/HDRP 分别预热一长串 shader（`DoInitShader<GIForRP>` L107–L275：GIFacetScene/GICascadedSDFScene/ReprojectHistory/CompositeSpecular 等的 `InitShaders`）。

## 8. 快速问答

**Q：每帧具体谁在干活？**
A：Manager 只发三个事件；真正的执行段挂在 `SWRTPipeline` 构造的子系统监听器上（TracingView → lighting scene → tracer 链，详见 04-屏幕层）。事件顺序：Before → Update → After，串行。

**Q：GI 与渲染管线怎么接？**
A：`GIForURP`/`GIForHDRP` 各有 `Execute(ExecutionContext)` 静态入口（实现于各自的 .cpp）与 `onUpdateView` 事件；URP/HDRP 的自定义 pass 调 `Execute` → `ExecuteGIPipeline`。细节见 [02-管线接入URP与HDRP](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/02-管线接入URP与HDRP.md)。

**Q：为什么 8×8 和 16×16 两套"quad"并存？**
A：`kLightingQuadSize = 8`（TuanjieGIManager.h L19–L20）服务直接光照（GILighting 的线程块也是 8×8）；屏幕层 GI 追踪的采样块是 `ViewContextURP::quadInterval = 16`（TuanjieGIForURP.h L107）。两套粒度、两个用途。
