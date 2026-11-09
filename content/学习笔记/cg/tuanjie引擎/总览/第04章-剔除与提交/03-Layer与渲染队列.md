---
title: 03 - Layer 与渲染队列
publish: true
updated: 2026-09-10T12:03:40.096Z
---

# 03 - Layer 与渲染队列

> 阅读时间：约 30 分钟
> 关键词：Layer、Culling Mask、RenderQueue、排序、Tags

---

## 你将学到什么

- Layer 与 RenderQueue：两个最容易混淆的"分类轴"
- 谁决定"这个物体被哪些相机看到"
- 谁决定"这个物体按什么顺序画"
- 固着管线排序原理，及管线如何在其上自定义排序

---

## 1. 两个正交的轴

新手经常把这两者搅在一起。先一图定分野：

| | **Layer** | **RenderQueue** |
|---|---|---|
| 定义在 | GameObject 上（Tag & Layer） | 材质上（shader Tags/`material.renderQueue`） |
| 决定 | **哪些相机**能看见它 | **以什么顺序**被画 |
| 作用阶段 | **剔除阶段**（CPU，画不画） | **提交阶段**（排序，怎么画） |
| 用途 | 视野控制、逻辑分组、物理过滤 | 不透明/透明分层、特殊效果排序 |
| 常见值 | 32 个用户层 | Geometry=2000、Transparent=3000… |

一句话：**Layer 管"生死"，RenderQueue 管"座次"**。

## 2. Layer：可见性的开关面板

### 2.1 相机的 Culling Mask

每个相机带一个 32 位掩码（`Camera.cullingMask`），物体带一个层位（`gameObject.layer`）：

$$
\text{可见} \iff \text{cullingMask} \; \& \; (1 \ll \text{layer}) \neq 0
$$

**在剔除前就生效**：不在掩码里的物体根本不进入该相机的可见集——后续合批、排序、绘制全免。这是"小地图相机只画小图标层"、"3D 主相机不画 UI 层"的实现方式。

实用模式：

- **多相机分工**：主相机（Default + 角色）、武器相机（仅 Weapons 层，局部视野画武器避免穿模）、小地图相机（仅 Minimap 层）；
- **相机栈**：URP 里 Base+Overlay 相机叠加，各带各的 mask 与视口。

> ⚠️ **多相机的代价**：每个相机都要走剔除+绘制流程。相机数、每个相机的剔除开销（视锥测试是按相机×物体计数的）都要预算——4 个全屏相机不会让你"免费"多出画面。

### 2.2 渲染相关的其它 Layer 用法

- **Light Culling Mask**：光源也带 mask，不照某层（`Light.cullingMask`）；
- **Shader Replacement**：按 layer 替换成简化 shader 渲（例如小地图的"纯色剪影"）；
- **剔除距离**：Layer Culling Distances 按层设距离阈值（第02篇距离剔除）。

## 3. RenderQueue：提交顺序的灵魂

### 3.1 为什么顺序重要

回看第02章两个硬性约束：

1. **不透明**：近→远最优（Early-Z 尽早垫深度，越画越省）；
2. **透明**：远→近**必须**（混合依赖背景已就位）；
3. **不透明必须全部画完才能画透明**（透明要"看到"完整背景）。

所以引擎需要一个"分类 → 组内排序"的统一座次表。团结/Unity 的渲染队列数字区段：

| 队列 | 值 | 含义 | 组内排序 |
|---|---|---|---|
| Background | 1000 | 最先画（天空盒前的深背景/水体底） | 近→远 |
| Geometry | 2000 | **不透明主力** | **近→远** |
| AlphaTest | 2450 | alpha clip 的"硬透明"（树叶/栅栏） | 近→远 |
| GeometryLast | 2500 | 不透明末尾 | 近→远 |
| Transparent | 3000 | **混合透明主力**（玻璃、粒子、水） | **远→近** |
| Overlay | 4000 | 最后画（光晕、最后叠加） | 远→近 |

### 3.2 排序键：多级字典序

引擎排序不是单键比较，而是**字典序多键排序**（高级键相同时比低级键）：

```
RenderQueue（大类）
  → 排序标志（Sorting Layer / Sorting Order，2D 与粒子常用）
    → 物体材质哈希（材质相同的相邻 → 减状态切换，合批友好）
      → 距离（Geometry近→远 / Transparent远→近）
```

其中"材质哈希优先于距离"值得体会：不透明组内先按材质分组、组内再按距离——**刻意牺牲一点 Early-Z 效率换取大幅减少状态切换**（换材质=换 shader+纹理+常量）。这是 CPU/GPU 负载的权衡，引擎选择的默认答案偏 CPU。

### 3.3 自定义排序干预

- 材质上直接改 `renderQueue`：`material.renderQueue = 3001`（+1 的透明插队画在玻璃之后）；
- shader Tags 里 `Queue = Geometry+1`；
- Sorting Layer / Order in Layer：2D 与粒子系统的专用细分轴（`Modules/ParticleSystem`、`Modules/UI` 大量使用）；
- URP 侧：每个 Pass 里自己 `sortingCriteria`（第09章），可改为纯"无分类距离序"（某些移动策略）。

> ⚠️ **经典事故**：不透明物体被错误设成 Transparent 队列 → 全场景顺序混乱 + 无 Early-Z 收益；半透明设成 Geometry → 深度写坏 + 混合失效。**看见"透明物体在远处显示在近处前面"先查 renderQueue**。

## 4. 引擎里这些配置住在哪

- Layer 定义：TagManager（项目设置），32 位限制；
- Culling Mask：`Camera` 参数 → 剔除系统（`ScriptableCulling.cpp`）；
- RenderQueue：材质/shader 数据 → `Renderer.cpp` 排序键组装 → 合批分组（`BatchRendering.cpp`）；
- SRP 路线：URP 的 `DrawObjectsPass` 按 `sortingCriteria | Sturcture`过滤队列区间（不透明 pass 画 [0,2500]，透明 pass 画 (2500,∞)——第09章会看到这段逻辑）。

---

## 小结

- Layer 决定"被谁看见"（剔除前生效），RenderQueue 决定"按什么顺序画"（提交时生效）；
- 32 位 cullingMask 与层位做按位与；多相机是成本要预算的；
- 队列大区段 + 组内排序（材质键→距离）构成字典序排序；不透明近→远、透明远→近是两条铁律；
- 材质哈希排在距离前 = 宁可牺牲 Early-Z 也要少状态切换（CPU 权衡）；
- 排序 bug 的第一反应：查 renderQueue。

## 自测问题

1. 为什么"不透明组内按材质哈希排序"会伤害 Early-Z 效率？引擎为什么还是这么选？
2. 武器不穿墙的实现：哪两个 layer 相关设置组合能实现"武器相机只画武器"？
3. AlphaTest（2450）为什么分在不透明区间而不是透明区间？（提示：它写不写深度）
4. 两个透明物体 renderQueue 相同，靠什么决定先后？

---

*下一节：[04-DrawCall与批处理概览](学习笔记/cg/tuanjie引擎/总览/第04章-剔除与提交/04-DrawCall与批处理概览.md) —— 提交的最后一课：把 N 次调用变成 1 次。*
