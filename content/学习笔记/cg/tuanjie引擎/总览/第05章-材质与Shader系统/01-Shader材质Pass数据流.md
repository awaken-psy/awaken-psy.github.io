---
title: 01 - Shader、材质、Pass：数据流全解
publish: true
updated: 2026-09-10T12:04:21.551Z
---

# 01 - Shader、材质、Pass：数据流全解

> 阅读时间：约 40 分钟
> 关键词：Shader、SubShader、Pass、Material、MaterialPropertyBlock、属性表

---

## 你将学到什么

- Shader / Material / MaterialPropertyBlock 的三层关系与各自的数据
- SubShader 与 Pass 的组织逻辑
- 一个绘制命令的"配置包"到底装了什么
- 属性表：引擎侧的材质数据仓库

---

## 1. 三层关系：模具、制品、贴纸

给新手的最准确类比：

| 层 | 类比 | 内容 | 谁可以有多少 |
|---|---|---|---|
| **Shader（着色器）** | 模具/配方 | "算法"：怎么算颜色（代码）+ 参数定义（Properties）+ 渲染状态 | 全场景共享一份 |
| **Material（材质）** | 按配方做的制品 | 模具 + 具体参数值（哪张贴图、什么颜色、数值多少） | 每个实例一份 |
| **MaterialPropertyBlock** | 贴在制品上的临时贴纸 | 少量参数的**临时覆盖**（不改材质本体） | 每个渲染器一份 |

数据流：

```
Shader (共享的算法与参数定义)
   │ 实例化（指定参数值）
   ▼
Material (石头的材质：贴图=石头.tga, 颜色=灰, 光滑=0.3)
   │ 被若干 Renderer 引用
   ▼
Renderer × N (网格A、网格B...，同一块石头材质)
   │ 部分物体想稍有不同
   ▼
MaterialPropertyBlock (仅"我"颜色改成蓝，其它照抄材质)
```

**关键机制**：Renderer 持有材质引用（同一材质被很多物体引用——**内存与合批友好的设计**）；想个体化时**不复制材质**（那会破坏共享、爆内存、毁合批），而是贴 MPB 覆盖少量参数。

## 2. Shader 的内部结构：SubShader → Pass

一个 .shader 文件在引擎侧展开为**四层嵌套**（`SerializedShader.cpp` 的数据结构正是它的序列化形态）：

```
Shader "My/Stone"
├── Properties              ← 参数声明（暴露给材质面板的表单）
│     _MainTex ("Albedo", 2D) = "white" {}
│     _Color ("Tint", Color) = (1,1,1,1)
├── SubShader #1            ← 一套"完整画法"（面向某能力等级硬件）
│     ├── Tags (Queue/RenderType/LightMode...)
│     ├── Pass #1           ← 一次几何绘制（一个可运行的最小着色单元）
│     │     ├─ 状态 (Cull/ZWrite/Blend/Stencil)
│     │     └─ HLSL 代码 (VS/PS 入口)
│     └── Pass #2 (可选)    ← 第二遍画法
├── SubShader #2            ← 低配 fallback 的另一种画法
└── FallBack "Diffuse"      ← 全部失败时借别家 SubShader
```

### 2.1 SubShader 的意义：能力分级

引擎**从上到下**尝试各 SubShader：第一个"当前硬件与管线能跑"的胜出。用途：老手机走简化版、支持新特性的走完整版（如 `#pragma require` 声明的特性检查）。

### 2.2 Pass 的意义：一次几何绘制

**一个 Pass = 一条"用什么状态、跑什么代码、画一遍几何"的完整指令**。多 Pass 即"同一物体画多遍"：

- 卡通描边：Pass1 正常画、Pass2 法线外扩画轮廓；
- 镜面反射：物体先画进"反射 RT"一遍，再画进主画面一遍；
- 内置管线的光照：**ForwardBase**（主光+环境）+ **ForwardAdd**（每盏逐像素光一遍）——多 Pass 就是旧管线处理多光源的手段（第08章）。

**管线选 Pass 的规则**：内置管线按 `LightMode` Tag 取（ForwardBase/ShadowCaster...）；URP/HDRP 也一样用 LightMode（`SRPDefaultUnlit`、`UniversalForward`、`ShadowCaster`、`DepthOnly`...），由各 Pass 类主动请求（第09章）。

## 3. 状态去哪了：材质里的"渲染状态包"

第02章说输出合并需要深度/混合/模板状态。这些状态的**归属**：

- shader 的 Pass 里写死的（`Blend SrcAlpha OneMinusSrcAlpha`）：所有引用此 shader 的材质共享；
- 脚本运行时改 `material.renderQueue` / `SetInt("_Stencil")`：**写进材质实例**（从此与其它同名材质分道扬镳——共享被打破，注意这是隐藏的合批杀手）；
- `RenderStateBlock`（URP）：Pass 级临时覆盖，不污染材质。

## 4. 引擎侧仓库：属性表

材质的参数在 C++ 侧不是散装字典，而是**属性表**——带类型的紧凑容器：

```
ShaderPropertySheet      ← Shader 层：所有声明参数的类型布局（静态）
   ↓ 派生
UnityPropertySheet       ← Material 层：每参数的实际值（贴图ID/浮点/向量/矩阵）
   ↓ 可选覆盖
DynamicPropertySheet     ← MPB：临时覆盖层（只存被覆盖的键）
```

查值顺序：**MPB → 材质 → Shader 默认值 → 全局值**（`Shader.SetGlobal*`——引擎把 `_Time`、全局风参数、SRP Batcher 的全局 CBUFFER 都从这里进）。这个"逐层回退链"是理解"为什么改了材质颜色有的物体不变"类 bug 的钥匙：**有人在你上面盖了一层**。

> 📁 **源码指引**：`Runtime/Shaders/Material.cpp`（材质本体）、`ShaderPropertySheet.cpp` / `UnityPropertySheet.cpp`（属性表仓库）、`DynamicPropertySheet.cpp`（MPB 数据）、`GlobalConstantBuffers.cpp`（全局常量缓冲——SRP 时代的重要优化）、`Keywords/`（关键词子系统，第03篇主角）、`ShaderPassContext.cpp`（"哪个相机/Pass 上下文在请求绘制"——管线按它选 LightMode）。

## 5. 把数据流走完整：一次绘制的配置组装

以 URP 画一个石头为例，逐项列清"这次 DrawCall 用到的所有数据从哪来"：

| 数据 | 来源 |
|---|---|
| 几何（VB/IB） | Renderer → Mesh → GPU 缓冲（第03章） |
| VS/PS 代码 | 当前相机 Pass 按需求（LightMode）选中某 Pass 的着色程序（+关键词变体选择，第03篇） |
| 相机矩阵等 | `BuiltinShaderParams`（引擎每帧/每 Pass 自动更新，`GfxDevice/BuiltinShaderParams.cpp`） |
| 物体矩阵 | per-object 常量（或 per-instance，合批模式决定） |
| 材质参数 | UnityPerMaterial 常量缓冲块（SRP Batcher 的契约，第04篇） |
| 贴图 | 材质属性表 → 纹理绑定 |
| 状态（深度/混合） | Pass 声明（或运行时覆盖） |

排好队后由合批系统（第04章的 BatchRendering）把"兼容"的一批装配进命令流——第02篇讲 shader 如何被翻译成 GPU 指令。

---

## 小结

- 三层：Shader=模具（算法+参数定义）、Material=制品（参数值）、MPB=贴纸（临时覆盖）；
- Shader 结构四层：Properties / SubShader（能力分级）/ Pass（一遍绘制）/ 代码；
- Pass 是渲染的最小完整单元，多 Pass=多遍画，管线按 LightMode 挑 Pass；
- 属性表逐层回退：MPB→材质→Shader默认→全局；
- 运行时改 material 会**实例化材质副本**，悄悄破坏共享与合批。

## 自测问题

1. 为什么设计 MPB 而不是让每个物体拥有独立 Material？（从内存与合批两个角度回答）
2. 描边效果为什么要两个 Pass？每个 Pass 的状态配置差异是什么？
3. `Shader.SetGlobalFloat` 与 `material.SetFloat` 生效范围差在哪？回退链谁覆盖谁？
4. 同一材质上的 `renderQueue` 改动会破坏什么？（提示：第04章排序键的材质哈希）

---

*下一节：[02-着色语言与编译](学习笔记/cg/tuanjie引擎/总览/第05章-材质与Shader系统/02-着色语言与编译.md) —— 一段 HLSL 怎么变成七种 GPU 的指令。*
