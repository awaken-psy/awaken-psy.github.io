---
title: 01 - 渲染核心层：Renderer 组件的背面
publish: true
updated: 2026-09-10T12:01:46.619Z
---

# 01 - 渲染核心层：Renderer 组件的背面

> 阅读时间：约 35 分钟
> 关键词：Renderer、渲染数据、更新循环、脏标记、GPU数据

---

## 你将学到什么

- C# 的 `MeshRenderer` 背后，引擎真正维护了什么数据
- "每帧更新什么"：脏标记与按需同步
- 渲染核心层的三大数据族：几何、材质、状态
- 引擎如何组织"每帧的渲染事件流"

---

## 1. 从一个组件说起

你在编辑器里挂一个 `MeshRenderer`，检查器里显示 Mesh、Materials。但从渲染的角度，这个组件只是**一份"愿望声明"**：请把我画出来。真正的绘制数据、加速结构、GPU 资源，全部在 C++ 渲染核心层。本篇讲清"声明 → 数据 → GPU"这条内部链路。

### 1.1 渲染核心的三大数据族

一个可渲染物体在 C++ 侧由三类数据构成：

**① 几何数据**：网格的顶点/索引缓冲、包围盒、LOD 链。顶点数据一般**只上传一次**到 GPU（静态网格），动态修改走 `AsyncUploadManager` 或重建缓冲。

**② 材质引用**：渲染器不复制材质，只指向材质对象 + 各自的材质参数覆盖（`MaterialPropertyBlock` 的数据在 C++ 侧是独立的小块，避免为每个实例复制整份材质——合批兼容性的关键之一，第05章展开）。

**③ 空间与状态**：世界矩阵（含缩放的包围盒）、阴影设置、Probe/Lightmap 采样信息（第10章）、LOD 层级、RenderQueue、Layer。

### 1.2 每帧更新：脏标记驱动

新手常以为"引擎每帧全量重算一切"，实际相反——**没有变化的绝不重算**。引擎的核心机制是**脏标记**：

> 数据被改动时（你移动了物体、改了材质参数）→ 打上"脏"标记 → 本帧更新循环里只处理脏数据 → 处理完清除标记。

- 你没动过的物体，世界矩阵缓存原样复用；
- 材质参数没变，GPU 常量缓冲不再重新上传；
- 网格没变，GPU 缓冲根本不碰。

这就是为什么"往场景里再放一个静止物体"的代价远低于"让现有物体每帧乱动"。`Static` 标记更进一步：把静止物体的变换矩阵、光照采样等烘焙成只读批（静态合批的基础，第04章）。

> 📁 **源码指引**：`Runtime/Graphics/RendererUpdateManager.cpp` 集中管理渲染器的批量按需更新；`Renderer.cpp` 是渲染器本体；`LOD/` 子目录管理 LOD 选择数据。

## 2. 渲染器家族：不止 MeshRenderer

"渲染器"是引擎里一群"我想上画面"的组件统称，每种背后对应 C++ 里的独立绘制路径：

| C# 组件 | 绘制方式 | C++ 关键源码 |
|---|---|---|
| `MeshRenderer` | 网格 + 材质 | `Renderer.cpp` |
| `SkinnedMeshRenderer` | 蒙皮网格（骨骼矩阵） | `RendererAnimationBinding.cpp`、蒙皮矩阵缓冲 `GPUSkinPoseBuffer.h` |
| `BillboardRenderer` / `SpriteRenderer` | 面向相机的四边形 | `Billboard/` 子目录、`Sprite*.cpp` |
| `LineRenderer` / `TrailRenderer` | 条带几何 | `LineBuilder.cpp`、`TrailRenderer.cpp` |
| `ParticleSystem`（Renderer 模块） | 数千 billboard | `Modules/ParticleSystem/` |
| `Terrain` | 高度图网格 | `Modules/Terrain/` |
| UI（UGUI） | 网格化的 2D 合批 | `Modules/UI/` |

理解这个表的意义：**它们最终全部退化成"提交三角形给 GPU"**，区别只在几何生成方式与 CPU 侧组织方式。引擎的统一性来自这里——第02章的管线对它们一视同仁。

## 3. 层级变换：矩阵的传递链

物体的世界矩阵不是独立计算的，而是**层级传递**：

$$
M_{world}^{child} = M_{world}^{parent} \cdot M_{local}^{child}
$$

每个物体只存"相对父级的局部变换"，世界矩阵沿树递推缓存。你把角色（父）挪 2 米，角色全身 20 个部位（子）的世界矩阵全部变脏、重新级联——**深层级的动画物体是矩阵更新大户**。

这带来一个优化直觉：**让动的东西浅、让静的东西断**。骨骼层级过深、或父物体整体每帧移动还带着巨大子树，都会放大矩阵更新成本。（引擎对"根本不变"的子树有短路，但检测本身也有成本。）

## 4. 渲染事件流：一帧里渲染核心在哪几步出场

结合第00篇的时序图，渲染核心层（C++）出场三次：

1. **Update 之后**：按脏标记批量更新渲染器数据（矩阵、探针、LOD）；
2. **剔除阶段**：视锥体/遮挡剔除在 C++ 执行（性能敏感，含 SIMD 批量包围盒测试）——注意**剔除结果（可见集）交给谁**取决于管线：内置管线内部消化，URP/HDRP 通过 `ScriptableRenderContext.Cull` 拿回 `CullingResults`；
3. **绘制提交**：管线（C# 或内置 C++）逐 Pass 下发 `DrawRenderers` 类命令 → C++ 按"排序→合批→填参数→组装 GfxDevice 调用"完成。

每一步的公共哲学：**CPU 侧尽量批量、缓存、少动；GPU 侧资源一次上传、多次消费**。

## 5. 剔除与合批的预告

渲染核心层最大的两个"加工厂"留待专章：

- **剔除**（第04章）：包围盒 → 视锥体/遮挡 → 可见集。它是渲染性能的第一道闸门；
- **合批**（第04/05/12章）：可见集 → 按"兼容性"分组 → 尽量少的 DrawCall。`Runtime/GfxDevice/BatchRendering.cpp` 是合批的心脏，`InstancingBatcher.cpp` 负责 GPU Instancing。

## 6. 在引擎中：一张"谁住哪"的地图

```
Runtime/Graphics/Renderer.cpp            ← 渲染器本体（可见性、LOD、探针数据）
Runtime/Graphics/RendererUpdateManager.cpp ← 每帧按需更新调度
Runtime/Graphics/Mesh/                    ← 网格与顶点数据（上传 GPU）
Runtime/Graphics/RenderTexture.cpp       ← RT（管线的"画布"）
Runtime/GfxDevice/BatchRendering.cpp      ← 合批核心
Runtime/GfxDevice/InstancingBatcher.cpp   ← GPU Instancing
Runtime/Math/                              ← SIMD 数学（矩阵/包围盒）
Modules/Animation/...                      ← 蒙皮（供 SkinnedMeshRenderer）
Runtime/Export/...*.bindings.cpp          ← C# API 绑定层
```

---

## 小结

- 组件是声明，C++ 渲染核心才是真实数据：几何、材质引用、空间状态；
- **脏标记驱动按需更新**，静止即免费、常动则昂贵；
- 一切渲染器殊途同归：最终都变成"三角形提交"；
- 世界矩阵沿层级级联缓存，动画层级是更新大户；
- 渲染核心在一帧里出场三次：更新、剔除、提交组装。

## 自测问题

1. 为什么往场景加一个静止物体便宜，而每帧移动的动画物体贵？（用脏标记机制解释）
2. `SkinnedMeshRenderer` 的"骨骼矩阵"从哪来、到哪去？（提示：动画系统 → 蒙皮矩阵缓冲 → VS）
3. 三层里剔除为什么放在 C++ 而不是像 URP 的 Pass 编排那样放 C#？
4. "UI 也是网格化的"——UGUI 按钮的四个圆角，到 GPU 眼里是什么？

---

*下一节：[02-GfxDevice图形API抽象层](学习笔记/cg/tuanjie引擎/总览/第03章-引擎架构：从场景到GfxDevice/02-GfxDevice图形API抽象层.md) —— 引擎与图形 API 之间那道最重要的墙。*
