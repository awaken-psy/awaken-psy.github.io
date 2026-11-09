---
title: SDF 与级联 SDF 知识点详解
publish: true
updated: 2026-08-26T00:00:00.000Z
tags:
  - unity
  - graphics
  - sdf
  - ray-marching
  - tuanjie-engine
---


# SDF 与级联 SDF 知识点详解

## 1 一句话理解 SDF

> [!info] 核心概念
> SDF（Signed Distance Field，有符号距离场）是一个函数，告诉你空间中任意一点离最近表面有多远。用它来做射线步进时，每一步都能走"恰到好处的最远距离"——不会穿过表面，也不会走太小步浪费性能。

---

## 2 SDF 是什么

对于一个 3D 场景，SDF 是一个函数 `d = SDF(p)`：

| 返回值 | 含义 | 通俗说 |
|---|---|---|
| `d > 0` | 点 p 在表面外面 | 离墙还有 d 米 |
| `d = 0` | 点 p 正好在表面上 | 刚好碰到墙 |
| `d < 0` | 点 p 在表面内部 | 已经穿到墙里面了 |

---

## 3 SDF 如何加速射线步进

### 普通射线步进的问题

普通 Ray Marching 每步走固定距离，两难：

- 步子太大 → 可能直接穿过表面，没检测到命中
- 步子太小 → 要走几百步才到表面，太慢


> [!note] Sphere Tracing（球面追踪）
> 这种算法叫 Sphere Tracing。每步以当前点为圆心、SDF 值为半径画一个球——球内保证没有表面，可以一口气走到球边。所以叫"球面"追踪。

### 对比

| | 普通 Ray Marching | SDF Ray Marching |
|---|---|---|
| 步长 | 固定 | 自适应（= SDF 值） |
| 步数 | 多（可能几百步） | 少（远距离大步，近距离小步） |
| 安全性 | 可能穿过表面 | 保证不穿过 |
| 离表面远时 | 一步一步走，慢 | 大步前进，快 |

---

## 4 SDF 的数据结构：bricked sparse

### 为什么要稀疏存储

如果整个包围盒都填满体素，空区域会浪费大量内存。实际上只有表面穿过的区域才有存储价值——那里的体素距离值才有变化（从正到负过渡）。

### 怎么切分

```
1. 算出物体的包围盒（AABB）
2. 把包围盒空间切成 brick（块），每个 brick 包含 8×8×8 个体素
3. 检查每个 brick：有没有表面穿过？
   有 → 分配，里面 8×8×8 体素各存一个距离值
   没有 → 不分配，标记为无效（sdfInvalidBrickIdx = -1），不占内存
```

```
物体包围盒被切成 brick 网格：

  ┌────┬────┬────┐
  │空  │brick│空  │    第 1 行：表面穿过中间这个 brick
  ├────┼────┼────┤
  │brick│brick│brick│  第 2 行：表面穿过三个 brick
  ├────┼────┼────┤
  │空  │brick│空  │    第 3 行：表面穿过中间
  └────┴────┴────┘

  空的 brick = 不分配，不占内存
  有表面的 brick = 分配 8×8×8 体素，逐个存距离值
```

### 没分配 brick 的位置怎么查

追踪时射线走到一个位置 p，先查 brick 映射表（`sdfMeshMappingGPUBuffer`）：
- p 落在 active brick → 查纹理取距离值
- p 落在无效 brick → **说明离表面很远**，返回一个大值，表示"可以大步走"

### 3 级 LOD

同一个物体烘焙 3 套不同精度的 SDF：

```
LOD0：体素 0.25m，brick 最密，精度最高
LOD1：体素 0.5m，  brick 减半，精度中
LOD2：体素 1m，    brick 最少，精度低
```

> [!note] LOD 的关键点
> - **每个 brick 都是 8×8×8 个体素**，这个数量不变
> - 变的是每个体素覆盖多大空间——LOD 越高，体素越大，覆盖范围越大，精度越低
> - LOD1 从 LOD0 降采样（每 2×2×2 取 1 个），不需要重新算距离
> - LOD 选择每帧算一次（根据物体在屏幕上的投影大小），整帧复用，不是每步每射线都判断

### LOD 选择依据

不是纯看距离，而是看**物体在屏幕上占多大**：

```
物体 center + radius → 算屏幕投影面积
  投影面积大 → LOD0（需要细节）
  投影面积中 → LOD1
  投影面积小 → LOD2（看不清，省性能）
```

> [!note] LOD 和级联 SDF 的区别
> | | per-object LOD | 级联 SDF |
> |---|---|---|
> | 对象 | 单个物体 | 整个场景 |
> | 分层依据 | 物体在屏幕上的投影大小 | 位置离相机距离 |
> | 数据来源 | 物体自己的 SDF | 场景 SDF 烘焙成纹理 |
> | 谁用 | SDFTracer | CascadedSDFTracer |
> | 层数 | 3 级 | 4 级 |

---

## 5 从物体 SDF 到场景 SDF

### 数学原理：取最小值

空间中任意一点 p，到最近表面的距离 = 所有物体各自 SDF 在 p 点取最小值：

```
SceneSDF(p) = min(SDF_椅子(p), SDF_桌子(p), SDF_墙(p), ...)
```

### 包围盒外的距离计算

一个物体只在它的包围盒内有 SDF 纹理。点 p 在包围盒外面时，不用查纹理，直接算 p 到包围盒（AABB）的距离作为**保守估计**：

```
点 p 在椅子包围盒外：

  dx = max(boxMin.x - p.x, 0, p.x - boxMax.x)
  dy = max(boxMin.y - p.y, 0, p.y - boxMax.y)
  dz = max(boxMin.z - p.z, 0, p.z - boxMax.z)

  distance = sqrt(dx² + dy² + dz²)
```

这是物体 SDF 值的**下界**（实际距离可能更远，但不会更近）。用这个保守值做步进，保证不会穿过表面。

### 运行时遍历 vs 预烘焙

> [!important] 两种做法的权衡
> **SDFTracer（运行时遍历）**：每步遍历所有物体，在包围盒内查纹理，在包围盒外算 AABB 距离，取最小值。精度高，但物体多了每步 O(N) 很慢。
>
> **级联 SDF（预烘焙）**：把"遍历取 min"的结果提前算好存进 3D 纹理。运行时只查一次纹理 O(1)。代价是精度受体素分辨率限制。

---

## 6 级联 SDF（Cascade SDF）

### 为什么要级联

单个 SDF 覆盖范围有限。如果要用高精度 SDF 覆盖整个场景，需要海量内存。解决方案：**近处用高精度，远处用低精度**——类似 Mipmap 的思路。

> [!info] 级联 SDF
> 把场景分成多个同心圆区域（cascade），越远的 cascade 分辨率越低：
>
> ```
> 近处 Cascade：高精度 SDF，覆盖范围小（如 0~16m）
> 中距离 Cascade：中等精度（如 16~64m）
> 远处 Cascade：低精度（如 64~256m）
> ```

![[学习笔记/cg/unityGI代码学习/clip/SDF-图2-级联SDF.svg|1200]]

*图 2 · 级联 SDF 同心圆区域 — 近处高精度、远处低精度，射线追踪时逐级切换*

> [!tip] 为什么近处精远处粗？
> 近处的物体在屏幕上占的像素多，需要高精度才能正确反射。远处的物体只占几个像素，低精度就够用了。这和纹理 Mipmap 是同一个思路——远处的东西不需要看那么清楚。

### 射线追踪时的级联切换

射线从近到远追踪时，先在近处 Cascade 中步进（高精度），走出范围后切到中距离 Cascade（中精度），再走出范围后切到远处 Cascade（低精度），直到命中或超出最大范围。图 2 中的射线展示了这一逐级切换过程。

### 每帧更新

> [!note] 级联 SDF 每帧更新，但开销很小
> 级联 SDF 以相机为中心，相机移动后 4 个 cascade 的中心跟着移。
>
> 但"更新"不是重新计算距离——只是从已烘焙好的场景 SDF 纹理中按新位置采样拷贝。本质上是 GPU 纹理采样 + 拷贝，非常快。
>
> 场景物体移动了才需要更新场景 SDF 中受影响的部分，不用全量重建。

---

## 7 TuanjieGI 中的 SDF

### 三级加速链路

TuanjieGI 的 SDF 不是从原始三角形直接构建的，而是经过三级处理：

![[学习笔记/cg/unityGI代码学习/clip/SDF-图3-三级加速链路.svg|1200]]

*图 3 · 三级加速链路 — 场景三角形 → Facet 场景 → SDF 场景 → 级联 SDF*

> [!info] 三级结构各自的作用
> - **Facet 场景**：把三角形"拍扁"到一张大纹理上。每个纹素存：颜色、法线、自发光、间接辐照度。射线命中后从这里读颜色。
> - **SDF 场景**：从 Facet 场景构建 3D 距离场。用于快速判断"射线还能走多远"。
> - **级联 SDF**：在 SDF 场景基础上分级，让射线能追踪到远处。

### TuanjieGI 的 SDF 参数

> [!note] 关键常量（源码 GISDFMesh.h）
> - `sdfBrickVoxels = 8` — 每个 brick 边长 8 个体素
> - `sdfBrickSizeInVoxels = 7` — 实际采样 7×7×7（边缘共享）
> - `sdfLODCount = 3` — 3 级 LOD
> - `rayMarchingMaxCount = 64` — 基础 SDF 最大步进 64 次
> - `sdfInvalidBrickIdx = -1` — 无效 brick 标记（空区域）
> - 级联 SDF 有 4 个 cascade，最大步进 128 次

---

## 8 追踪器回退链路

### 完整流程

TuanjieGI 的追踪器级联回退策略——从最快到最慢依次尝试：

![[学习笔记/cg/unityGI代码学习/clip/SDF-图4-追踪器回退.svg|1200]]

*图 4 · 追踪器回退策略 — ScreenTracer → SDFTracer → CascadedSDFTracer → HWRT（可选）*

### 四种追踪器

> [!info] ScreenTracer — 屏幕空间追踪
> 把 3D 射线投影到 2D 屏幕上，沿像素路径走，比较射线深度和深度图（depth buffer）中存的物体深度：
> - 射线深度 > 像素深度 → 射线穿到物体后面了 → 命中
> - 射线深度 < 像素深度 → 还在前面 → 继续
>
> 不做任何 3D 计算，只查屏幕 buffer，O(1)。但只能命中屏幕上可见的像素——射线朝屏幕外走或被遮挡的区域查不到。
>
> 和 SSAO/SSR 同理：把 3D 问题降维到 2D 屏幕空间。

> [!important] SDFTracer vs CascadedSDFTracer
> - **SDFTracer**：用每个物体自己的 SDF 做追踪。每步遍历物体列表，在包围盒内查 SDF 纹理，在包围盒外算 AABB 距离，取最小值。精度高（用物体最细 LOD），但每步 O(N)，物体多了慢。最多 64 步。
> - **CascadedSDFTracer**：用级联 SDF 追踪。每步只查一次 3D 纹理 O(1)，不遍历物体。覆盖远（4 层 cascade），最多 128 步。但精度不如 SDFTracer——远处体素大，命中点不精确。

### 追踪器之间传递位置

> [!note] 追踪器串成一条链
> 三个追踪器共享同一条射线的当前位置。前一个走完了把位置交给后一个，不从头重新走：
>
> ```
> ScreenTracer     SDFTracer           CascadedSDFTracer
> (屏幕空间)        (per-object SDF)     (cascade 纹理)
>                   ≤64步               ≤128步
>  t=0 ────────→ t=a ────────→ t=b ────────→ t=c
>                 传位置               传位置
> ```
>
> 切换时，新追踪器用自己数据源重新查一次当前位置的距离值（O(1) 纹理采样），然后从那个值继续步进。

### 命中后怎么读颜色

| 追踪器 | 命中后 |
|---|---|
| ScreenTracer | 直接从屏幕 buffer 读颜色 |
| SDFTracer | 从 Facet 场景纹理读颜色（命中点在物体附近，精度够） |
| CascadedSDFTracer | 记录 `rendererIndex`（命中了哪个物体），延后到更精确时再读颜色 |
| HWRT | 精确命中三角形，直接读颜色 |

> [!note] CascadedSDFTracer 支持 RecordPayload
> CascadedSDFTracer 的 3D 纹理里存的不只是距离值，还打包了 `objectID`（`uint4` 格式：distance + objectID）。命中后通过 `rendererIndex` 找到具体物体。远处 cascade 体素大，命中点不精确，不知道命中了物体表面的哪个位置。所以先记下"命中了椅子"，等后面需要时再用 SDFTracer 或 HWRT 精确命中一次，从精确命中点读颜色。

### 为什么这么设计

每条射线都从最快的追踪器开始试。大部分射线在 ScreenTracer 就命中了（屏幕上可见的像素占大多数）。只有少量射线走到屏幕外才降级到 SDFTracer，更少量走到远处才降级到 CascadedSDFTracer。这样整体性能最好。

---

## 9 关键概念速查

> [!summary] 速查表
>
> | 概念 | 一句话 |
> |---|---|
> | SDF | 有符号距离场，告诉你任意一点离最近表面多远 |
> | Sphere Tracing | 用 SDF 值做安全步长的射线步进算法 |
> | 安全步长 | 当前位置能走的最远距离 = SDF(p)，保证不穿过表面 |
> | bricked sparse | 只在表面穿过的区域分配 brick，空区域不占内存 |
> | LOD | 同一物体 3 套不同精度的 SDF，每帧按屏幕投影大小选一次 |
> | 场景 SDF | 所有物体 SDF 取 min，包围盒外算 AABB 距离作为保守值 |
> | Cascade SDF | 以相机为中心分 4 层，近精远粗，每帧从场景 SDF 采样 |
> | Facet 场景 | 三角形面片光栅化到纹理，存颜色/法线/自发光 |
> | 三级加速链路 | 场景三角形 → Facet → SDF → Cascade SDF |
> | TuanjieGI 回退 | ScreenTracer → SDFTracer → CascadedSDFTracer → HWRT |
> | 追踪器传位置 | 前一个追踪器走完把位置交给后一个，不从头重新走 |

---

## 🏷️ 标签

#unity #graphics #sdf #ray-marching #tuanjie-engine
