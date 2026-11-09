---
title: 01 Oceanus DSL 速成（读懂本模块源码的前置技能）
publish: true
updated: 2026-09-20T09:12:24.292Z
---

# 01 Oceanus DSL 速成（读懂本模块源码的前置技能）

> TuanjieGI 的 GPU 程序不是手写着色器，而是用 **Oceanus DSL** 写：以 C++ 模板元编程描述 GPU 程序，编译期生成各平台的着色器（HLSL 等）。不认识这些构件，一行源码都读不懂；认识之后，`.h` 文件里的 `Kernel(lambda)` 就是普通 GPU 代码。

## 1. 两层世界：CPU 值与 GPU 值

| 写法 | 层 | 说明 |
|---|---|---|
| `float x = 1.0f;` | CPU | 编译期/调度期计算的普通 C++ 值 |
| `Float x = 1.0f;` | GPU | kernel 内的运行期值，会变成 HLSL 局部变量 |
| `Var<T> tex;` | GPU | 对 GPU 资源/结构的引用（kernel 内看到 `Var<...>` 就是 GPU 侧对象） |
| `Texture2D<oceanus::float4> tex;` | DSL 描述 | 资源的**类型声明**（尺寸/格式在 create 时给） |

GPU 数值类型：`Float/Float2/Float3/Float4/Uint/Uint2/Uint3/Uint4/Int2/Bool`；构造用 `make_float3(...)`、`make_uint2(...)`；`select(cond, a, b)` 是三元；`cast<uint>(x)` 是转换；`saturate/clamp/min/max/lerp/rcp/frac` 与 HLSL 同名同义。

## 2. GPU 程序的声明与调度

### 2.1 oceanus::Kernel(lambda)

```cpp
// 例：GIFacetScene.h DoCompositeRadiosity（h:2252 起）
auto& shader = oceanus::Kernel([&](ViewContext vctx, Float3 emissivelightingFactor, Float3 directlightingFactor) {
    TuanjieGiSetOnlyRenderers();          // 限定生成 d3d11|vulkan|metal（GlobalConfig.h）
    configure_block(8, 8, 1);             // 线程组尺寸 = 8×8×1
    // ... kernel 体 ...
});
stream << shader(vctx, emissiveF, directF) << oceanus::commit();   // 调度
```

- `configure_block(x,y,z)`：线程组尺寸（对应 HLSL `[numthreads]`）。
- `stream << shader(args...) << commit()`：把一次 dispatch 编入命令流。`stream` 可来自 `GetDSLDevice().create_stream_external(URP的CommandBuffer)`——即 GI 的工作直接编进渲染管线的命令缓冲。
- 绘制型 pass（不是 compute）：`draw_procedure(viewport, kPrimitiveQuads, 4, N)`——每请求画一个 quad，本模块的图集拷贝走这条路（`CopyRects`）。
- 光追型：`dispatch_ray(..., "TuanjieGIDXR")` + `ray_max_recursion_depth(1)`（RaytracingVisualize）。

### 2.2 内建与组内存

- `GroupID().xy()/GroupIndex()/GroupThreadID().xy()`：线程组坐标/组内索引/线程坐标（HLSL 语义）。
- `group_shared(var)`：声明组共享内存（`Context` 构造函数里集中声明）；`GroupMemoryBarrierWithGroupSync()` 同步。
- `interlocked_add(buffer, 1u, offset)`：原子加，第二个输出参数返回旧值——GPUFilter 压缩写与计数都靠它。
- `include("xxx.hlsl")`：直接嵌一段原生 HLSL（如 `UnityRayQuery.cginc`）；`add_require_feature("inlineraytracing")`：声明特性需求。

## 3. 控制流：$ 前缀

**分支/循环用 `$` 前缀**——它们不是 C++ 的 if/while，是告诉生成器"这里生成 HLSL 的动态控制流"：

```cpp
$if (GroupIndex() == 0) { ... }                    // if
$if (a) { ... } $else { ... };                    // if-else
$while (marchCount < TuanjieGI::rayMarchingMaxCountCDF) { ... $break; }   // while + break
$for (cascadeId, startCascade, usedSize) { ... }  // for
$for_unroll(i, 0, 4) { ... }                       // 编译期展开的 for
```

注意：lambda 内的**普通** C++ `for (uint i = 0; i < 8; i++)` 也存在（如 DirectDiffuse 遍历灯数组）——那是编译期展开/或生成循环，两种风格源码里都有。判断依据：循环体内是否操作 `Float/Uint` 等 GPU 值。

## 4. 排列（permutation）：同一份源码，多种变体

```cpp
$define_permutation_bool("enableAccurateHistory", false);   // 声明开关+默认值
...
shader.set_permutation("enableAccurateHistory", true);      // 调度时选一种变体
$if (enableAccurateHistory) { ...准确分支... } $else { ...快速分支... };
```

生成器为每个排列组合各编一份着色器；运行时 `set_permutation` 挑一份执行。典型用户：ReprojectHistory 的准确/快速两版、CompositeRadiosity 的 enableDirect/enableEmissive 等开关、QuadTraceSH 的 importanceSampling 开关。

## 5. 结构体反射：OC_STRUCT 家族

GPU 要读写 C++ 结构体，必须把成员布局告诉生成器（跨 DX/Metal/VK 要求成员按 16 字节对齐打包）：

- `OC_STRUCT(T, 成员名...)`：注册普通结构（如 `ViewParamURP`）。
- `OC_PARAM_STRUCT(T, 成员名...) { ... }`：**带行为的参数结构**——花括号里可以写成员函数/Context，kernel 通过 `Var<T>` 调它们（ViewContextURP、FilterRendererToLightQuadsAndTrace 都是这种）。
- `OC_BUILTIN_STRUCT(T, 成员...)`：引擎内建类型（URPBSDFDataDummy）。
- `OC_PARAM_TEMPLATE((typename A, typename B), T, (A,B), 成员...)`：模板参数结构（DirectDiffuse 的 filter）。
- `BIND_MANAGED_TYPE_NAME(CppType, CSharpName)`：C# 绑定命名。

## 6. OC_PARAM_STRUCT 的 Context 惯用法（GPUFilter 框架）

本模块大量"逐项处理"任务（过滤、压缩、追踪）用 `NaiveGPUFilter`/`GroupedGPUFilter` 框架，参数结构实现一组回调（以 DirectDiffuse 为例，DirectDiffuse.h）：

```cpp
OC_PARAM_TEMPLATE(..., FilterRendererToLightQuadsAndTrace, ...) {
    struct Context {
        // 组内共享与逐线程状态
        Context(Proxy<...>* This) { group_shared(...); ... }   // 每线程组开头执行
        Uint getValidatorCount();            // 候选项总数（如灯数）
        Bool useValidatorForGroup(Uint i);   // 该候选项与本组是否相关（包围球测试）
        void runThreadLogic(Uint i);         // 命中候选项时（收集进组共享数组）
        void runThreadLogicEnd(...);         // 收尾（逐线程计算+写结果）
        ~Context();                          // 每线程退出时（写 RT）
    };
    auto getContext() { return Context(this); }
    Uint3 numThreads();                     // dispatch 尺寸
};
```

调用侧：`NaiveGPUFilter<> f("名字", 0, 4); f.filter1ToNCustom(stream, filter);`。框架变体：`filter1To1`（一对一）、`filter1ToNFixedBuffer/TestAndWrite/Loop/Custom`（一对多）、`GroupedGPUFilter`（分组），以及 RayTracing 版。`Proxy<T>* This` 是"指向宿主结构 GPU 视图"的指针——`This->vctx->...` 跨层访问。

## 7. 资源类型

- DSL 侧纹理：`GITexture2D<float4>`（读写 read/write、采样 sample、gather）；`GITexture3D`（3D 纹理，SDF 用）；`GITexture2DArray`（HDRP 全用它，URP 用 2D）。读法：`read/load`（load 无滤波）、写法 `write`；`gather_red(uv)` 取 4 邻（返回顺序用 `.wzxy()` 重排对齐象限）。
- 缓冲：`GIStructuredBuffer<T>`（结构化，`.at(i)/.read(i)/.write(i)`）、`GIConstantBuffer<T>`（`SetData` 上传常量）、`GIByteAddressBuffer`。
- 全部资源创建走池：`oceanus::GraphicsTexturesPool::GetInstance()->GetTexture(desc, name)`（名字即池键——同 desc+name 复用）。CPU↔GPU 拷贝：`stream << buffer.OCRes().upload(&x)` / `.download(&x)`。
- `TrackedGPUBuffer/TrackedGPUTexture3D`（Utility/）：把 CPU 对象列表与 GPU 缓冲**增量同步**（move+update shader），见 [../05-集成与工程/04-增量更新与事件机制](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/04-增量更新与事件机制.md)。

## 8. GIOption：自带文档的可调参数

```cpp
GIOption<float> traceMaxDistance = GIOption<float>::Add(
    1000.f,                          // 默认值
    name + ".traceMaxDistance",      // 全局名（C# 面板用）
    "Tracer max distance.");         // 注释 = 官方文档
```

- C++ 侧 `traceMaxDistance` 直接当值读；C# 侧 `TuanjieGIOptions.bindings.cs` 按 id 读写。
- `AddVisualize(name, comment)`：可视化开关（初值恒 false）。
- **查证技巧：想核实某个机制的行为，先查 [../06-参考/01-GIOption参数字典](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/06-参考/01-GIOption参数字典.md)——它就是全模块 GIOption 注册注释的完整汇总（参数注释是模块内最权威的行为说明）。**

## 9. 硬件光追的 DSL 写法

```cpp
// 完整光追（RayTracer.h）
TraceRay(hwrtScene.rayAccelStruct, OC_RAY_FLAG_CULL_BACK_FACING_TRIANGLES,
         RAYTRACINGRENDERERFLAG_ALL, 0, 1, 0, rayDescriptor, rayIntersection);
// 内联 ray query（InlineRayTracer.h）
RayQuery<OC_RAY_FLAG_NONE> query;
query.TraceRayInline(hwrtScene.rayAccelStruct, OC_RAY_FLAG_NONE, 0xff, ray);
while (query.Proceed()) {}
if (query.CommittedStatus() == OC_COMMITTED_TRIANGLE_HIT) { t = query.CommittedRayT(); }
```

## 10. 本套文档怎么对应到这些构件

读机制分册时的对照关系（源码阅读顺序在本档中的映射）：

| 想理解什么 | 去哪 |
|---|---|
| 常量与可调参数 | [../06-参考/02-常量与魔法数字表](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/06-参考/02-常量与魔法数字表.md) + [../06-参考/01-GIOption参数字典](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/06-参考/01-GIOption参数字典.md)（即"文件顶部的 constexpr 与 GIOption"的完整汇总） |
| GPU 主逻辑（Kernel lambda 体、并行度） | 各机制分册的"算法流程 / Kernel 清单"节 |
| CPU 侧每帧入口与 dispatch 顺序 | [../05-集成与工程/01-帧调度](学习笔记/cg/tuanjie引擎/GI_AGENTUSE/05-集成与工程/01-TuanjieGIManager与帧调度.md) §5 事件挂接表 + 各分册"每帧流程/执行链" |
| OC_PARAM_STRUCT 的 Context 惯用法 | 本文 §6 |
| CPU/GPU 值的分辨（`Float/Uint/Var` = GPU） | 本文 §1 |

## 11. 快速自检

- "$if 和 if 有什么区别？" —— `$if` 生成 GPU 上的动态分支；普通 `if` 在 CPU/编译期求值（或者包裹的代码根本是 CPU 侧逻辑）。
- "为什么成员要 x4 对齐？" —— 跨图形 API 的 cbuffer 打包规则；OC_STRUCT 生成器负责按规则排布。
- "set_permutation 是运行时改代码吗？" —— 不是；所有变体在编译期生成好了，运行时只是挑一份。
