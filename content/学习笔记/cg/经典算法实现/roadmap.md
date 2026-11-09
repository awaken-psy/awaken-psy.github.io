---
title: GraphicAlgorithm 学习路线图
publish: true
updated: 2026-10-26T11:03:50.536Z
tags:
  - cg
  - opengl
  - realtime-rendering
  - graphic-algorithm
  - source-code
  - roadmap
  - learning
---


# 🗺️ GraphicAlgorithm 学习路线图

> [!info] 你是谁、你要去哪
> **起点**：学过 GAMES101，了解光栅化、Phong 光照、渲染方程概念；正在跟 GAMES202 学实时渲染
> **终点**：能独立读懂并改写本仓库 28 篇论文的任意 demo
> **方法**：每篇配 GAMES202 对应 lecture + 知乎解析 + 代码三件套对照
> **前置**：先读 [[学习笔记/cg/经典算法实现/00 前期准备.md|00 前期准备]] 和 [[学习笔记/cg/经典算法实现/01 框架.md|01 框架（FRAME）]]

> [!tip] 怎么用这份路线图
> - 这是一份"按 GAMES202 章节顺序"的代码精读计划，不是 GAMES202 本身的笔记（那个在 ../games202/)
> - 前两个 Phase（准备 + 框架）是地基，必须先过
> - 之后每个 Phase = 一个渲染主题 = 一组 demo
> - 每个 Phase 结束有 ✅ 自检，过了再进下一个

---

## 全局路线

```mermaid
flowchart LR
    P0(["Phase 0<br/>前期准备"]) --> P1(["Phase 1<br/>FRAME 框架"])
    P1 --> P2(["Phase 2<br/>实时阴影"])
    P2 --> P3(["Phase 3<br/>环境光照/PRT"])
    P3 --> P4(["Phase 4<br/>实时全局光照"])
    P4 --> P5(["Phase 5<br/>PBR/区域光"])
    P5 --> P6(["Phase 6<br/>延伸主题"])

    classDef phase fill:#4a90d9,stroke:#2980b9,stroke-width:2px,color:#fff
    class P0,P1,P2,P3,P4,P5,P6 phase
```

---

## Phase 0 — 前期准备

> [!abstract] 目标
> 理解项目结构、对齐 OpenGL 概念、掌握读 demo 的固定套路。不碰算法。

详见 [[学习笔记/cg/经典算法实现/00 前期准备.md|00 前期准备]]。

| 要点 | 内容 |
|---|---|
| 项目结构 | demo 薄壳 + FRAME 动态库两层 |
| 构建 | premake5 → VS（仅 Windows） |
| 阅读法 | main → grep SharedData 键 → 按 executionOrder 读 Pass |

### ✅ 自检
- [ ] 能复述"延迟渲染骨架"4 步
- [ ] 记住三步阅读法
- [ ] 知道 Linux 上以读代码为主

---

## Phase 1 — FRAME 框架（地基中的地基）

> [!abstract] 目标
> 吃透 FRAME 的注册/调度/数据流机制。**这是后面所有 demo 的钥匙，跳过必然后悔。**

详见 [[学习笔记/cg/经典算法实现/01 框架.md|01 框架（FRAME）]]。

| 要点 | 内容 |
|---|---|
| 三类组件 | IRenderPass / IGameObject / IGUI |
| 主循环 | initApp 顺序初始化 → updateApp 每帧按 order 遍历 Pass |
| 灵魂机制 | SharedData（字符串键 + boost::any）让 Pass 解耦 |

### ✅ 自检
- [ ] 能解释 executionOrder 排序与五种 PassType
- [ ] 能解释 SharedData 的生产/消费模式
- [ ] 能口述 018 CSM 的数据流

---

## Phase 2 — 实时阴影（GAMES202 L2-L3）

> [!abstract] 目标
> 理解 Shadow Map 家族的演进：从硬阴影到各种软化/抗漏光方案。这是 GAMES202 阴影两讲的重点。

### 阅读顺序

| 顺序 | demo | 算法核心 | GAMES202 对应 |
|---|---|---|---|
| 1 | `018_Cascaded Shadow Maps` | 把视锥切成多级，每级一张阴影图，近处高精度 | L2 阴影基础 |
| 2 | `022_Variance Shadow Maps` | 阴影图存深度与深度²，切比雪夫不等式估遮挡，**可预滤波** | **L3 重点** |
| 3 | `026_Moment Shadow Mapping` | 存深度前 4 阶矩，比 VSM 更精确，治漏光 | **L3 重点** |
| 4 | `025_Exponential Shadow Maps` | 指数函数平滑深度比较 | L3 |
| 5 | `013_Fourier Opacity Optimization` | 傅里叶系数表示可见性函数（进阶延伸） | 课程外 |

> [!note] 为什么 VSM 和 MSM 要连读
> GAMES202 L3 推导 VSM 的数学（切比雪夫），并指出 VSM 的漏光问题引出 MSM。
> 连读 `022` → `026` 能看清"用什么数据存阴影 → 能支持什么滤波 → 误差长什么样"这条主线。
> 读代码时重点看：**阴影图纹理格式** 和 **滤波/重构 Pass**。

### ✅ 自检
- [ ] 能解释 VSM 为什么可以预滤波（存了矩 → 期望/方差）
- [ ] 能解释 MSM 相比 VSM 解决了什么（漏光 light leaking）
- [ ] 能在 018/022/026 里分别定位"生成阴影图"和"应用阴影"两个 Pass

---

## Phase 3 — 环境光照与 PRT（GAMES202 L4-L5）

> [!abstract] 目标
> 理解如何用球谐（SH）和预计算辐射度传递（PRT）表示环境光照。GAMES202 环境光照两讲的核心。

### 阅读顺序

| 顺序 | demo / 工具 | 算法核心 | 对应 |
|---|---|---|---|
| 1 | `SH_Sampler`（工具） | 离线算 SH 系数，先建立直觉 | L4 SH 基础 |
| 2 | `009_Spherical Harmonic Lighting` | SH 光照详解（SH 光照经典论文） | **L5 重点** |
| 3 | `011_An Efficient Representation for Irradiance Environment Maps` | Ramamoorthi：用 SH 前几阶表示辐照度环境贴图 | L5 |
| 4 | `019_A Survey of Efficient Representations for Independent Unit Vectors` | 单位向量高效编码（八面体等），与 SH 互补压缩方向 | L4-L5 补充 |

> [!note] 球谐阅读建议
> 不要先抠 SH 数学。先建立直觉：SH 把球面函数压成有限个系数，前 3 阶（9 系数）够表示低频漫反射光。
> 读 `009` 时关注：**SH 系数怎么投影（encode）、怎么重建（evaluate）**。

### ✅ 自检
- [ ] 能解释为什么漫反射间接光适合用 SH（低频，前 3 阶够）
- [ ] 能在 009 里找到 SH 的投影与重建代码
- [ ] 理解 011 是 PRT 思想的简化版

---

## Phase 4 — 实时全局光照（GAMES202 L6-L7，本项目最重）

> [!abstract] 目标
> 理解实时 GI 的两大流派：**基于虚拟光源传播**（RSM/LPV）与**屏幕空间**（SSAO/SSDO/SSR）。这是 GAMES202 GI 两讲的主场。

### 4a. 先打地基

| demo / 工具 | 作用 |
|---|---|
| `DepthToPositionAndNormal`（工具） | 从深度图重建位置/法线——后面所有屏幕空间算法的基础 |

### 4b. 虚拟光源传播主线

| 顺序 | demo | 算法核心 | 对应 |
|---|---|---|---|
| 1 | `001_Reflective shadow map` | RSM：把阴影图每个纹素当虚拟点光源向场景撒间接光 | **L6 重点** |
| 2 | `016_Cascaded Light Propagation Volumes` | LPV：间接光在 3D 格子里迭代传播，级联覆盖大范围（最复杂） | **L6 重点** |
| 3 | `017_Forward Light Cuts` | 多虚拟光源的采样加速 | L6 |
| 4 | `021_Real-time indirect illumination by virtual planar area lights` | VPAL：用虚拟平面区域光近似间接光 | L6 |
| 5 | `024_Precomputed Light Field Probes` | 预计算光场探针做 GI | L6-L7 |

### 4c. 屏幕空间主线

| 顺序 | demo | 算法核心 | 对应 |
|---|---|---|---|
| 1 | `015_Image Space Horizon Based Ambient Occlusion` | HBAO：地平线法屏幕空间环境光遮蔽 | L6 SSAO 族 |
| 2 | `014_Approximating Dynamic Global Illumination in Image Space` | 图像空间动态 GI（SSDO 思路） | L6 |
| 3 | `023_Efficient GPU Screen-Space Ray Tracing` | 屏幕空间光线追踪（SSR 基础） | **L7 重点** |

### 4d. 多光源剔除（工程向，可选）

> [!note] 这一组偏系统实现，GAMES202 提到但不深入。时间紧可跳过。

| demo | 算法 |
|---|---|
| `002_Non-interleaved Deferred Shading of Interleaved Sample` | 交错采样的延迟着色 |
| `003_Stochastic Light Culling` | 随机光剔除 |
| `004_Metalights Improved Interleaved Shading` | 改进交错着色 |
| `007_Tile Shading` | Tile-based 多光源着色 |

> [!important] 难度提醒
> `016 LPV` 是全项目最难之一，建议放本阶段最后。先读 `001 RSM` 建立"虚拟光源"直觉，再啃 LPV。
> 读 LPV 重点看：**3D 网格（体素）如何存储/传播 SH 辐射度**，以及级联如何覆盖远近。

### ✅ 自检
- [ ] 能解释 RSM 的核心思想（阴影图纹素 = 虚拟点光源）
- [ ] 能解释 LPV 如何在网格里传播间接光
- [ ] 能解释 HBAO 与朴素 SSAO 的区别（地平线角）
- [ ] 能解释屏幕空间算法的根本局限（看不到屏幕外）
- [ ] 能在 SSR demo 里定位"沿射线步进深度图"的循环

---

## Phase 5 — PBR 与区域光（GAMES202 L8-L9）

> [!abstract] 目标
> 理解微表面 BRDF 和 LTC（线性变换余弦）多边形区域光着色。GAMES202 PBR 讲的核心。

### 阅读顺序

| 顺序 | demo / 工具 | 算法核心 | 对应 |
|---|---|---|---|
| 1 | `BRDF_Sampler`（工具） | 采样微表面 BRDF，建立积分直觉 | L8 BRDF |
| 2 | `010_RealTimePolygonalLightShadingWithLinearlyTransformedCosines` | **LTC**：用线性变换余弦解析地给多边形区域光着色（Eric Heitz） | **L8 重点** |
| 3 | `FitLTCMatrix`（工具） | 离线拟合 LTC 变换矩阵——读完回看 010 豁然开朗 | L8 配套 |
| 4 | `008_A Non-Photorealistic Lighting Model` | NPR 非真实感光照（可后置） | L11 边角 |

> [!tip] LTC 的读法
> 010 是运行时用预拟合好的矩阵着色；FitLTCMatrix 是离线把矩阵算出来。
> **先读 FitLTCMatrix 理解"矩阵怎么来的"，再读 010 看"矩阵怎么用"**，因果关系最清晰。

### ✅ 自检
- [ ] 能解释 LTC 的核心思想（把复杂 BRDF lobe 变换成余弦，使多边形积分解析可解）
- [ ] 能说出 010 运行时与 FitLTCMatrix 离线的关系
- [ ] 能在 010 里找到区域光的着色 shader

---

## Phase 6 — 延伸主题（课程外，按兴趣）

> [!abstract] 目标
> 这些不在 GAMES202 主线，是工程上有价值的补充。挑感兴趣的读。

| demo | 算法 | 主题 |
|---|---|---|
| `005_Interactive Order Independent Transparency` | OIT 顺序无关透明 | 透明 |
| `012_Real Time Concurrent Linked List Construction on the GPU` | GPU 并发链表（per-pixel linked list，OIT 高级） | 透明 |
| `027_FidelityFX Super Resolution` | AMD FSR 超分辨率 | 后处理 |
| `028_Mobile Friendly FSR` | 移动端 FSR | 后处理 |
| `020_Real-time Approximation to Large Convolution Kernel` | 实时大卷积核近似（Mipmap 技巧） | 后处理 |
| `006_Wang Tiles for Image and Texture Generation` | Wang 平铺生成无重复纹理 | 纹理 |

### ✅ 自检（选读后）
- [ ] 能解释 OIT 为什么需要 per-pixel linked list
- [ ] 能说出 FSR 的基本思路（边缘自适应 + EASU/RCAS）

---

## 附录 A — GAMES202 lecture ↔ 项目 demo 映射

| GAMES202 主题 | lecture | 项目 demo |
|---|---|---|
| 实时阴影 | L2-L3 | 018 / 022 / 026 / 025 / 013 |
| 实时环境光照 / PRT | L4-L5 | 009 / 011 / 019（+ 工具 SH_Sampler） |
| 实时全局光照 | L6-L7 | 001 / 016 / 017 / 021 / 024 / 014 / 015 / 023 |
| 多光源 / 延迟 | L6 附带 | 002 / 003 / 004 / 007 |
| PBR / 区域光 | L8-L9 | 010（+ 工具 FitLTCMatrix / BRDF_Sampler） |
| 透明 / 可见性 | 课程外 | 005 / 012 / 013 |
| 后处理 / 纹理 | 课程外 | 020 / 027 / 028 / 006 / 008 |

---

## 附录 B — 工具项目索引

| 工具 | 用途 | 服务于哪个 Phase |
|---|---|---|
| `DepthToPositionAndNormal` | 深度 → 位置/法线 重建 | Phase 4（屏幕空间地基） |
| `SH_Sampler` | 离线算球谐系数 | Phase 3 |
| `BRDF_Sampler` | 采样微表面 BRDF | Phase 5 |
| `FitLTCMatrix` | 离线拟合 LTC 矩阵 | Phase 5（配合 010） |

---

## 附录 C — 难度与时间安排

| Phase | 难度 | 建议时长 | 累计 |
|---|---|---|---|
| 0 前期准备 | ⭐ | 1 天 | 1 天 |
| 1 框架 | ⭐⭐ | 2-3 天 | 3-4 天 |
| 2 阴影 | ⭐⭐⭐ | 5-7 天 | 8-11 天 |
| 3 环境光照/PRT | ⭐⭐⭐⭐ | 5-7 天 | 13-18 天 |
| 4 全局光照 | ⭐⭐⭐⭐⭐ | 8-12 天 | 21-30 天 |
| 5 PBR/区域光 | ⭐⭐⭐⭐ | 4-6 天 | 25-36 天 |
| 6 延伸 | ⭐⭐-⭐⭐⭐ | 按兴趣 | — |

> [!tip] 节奏建议
> 这是一份 4-6 周的计划。每个 demo 可多轮读：第一遍扫管线骨架，第二遍读 Pass 逻辑，第三遍抠 shader 数学。
> 慢即是快——尤其是 Phase 4 的 RSM/LPV，是实时 GI 的根基，值得反复。

---

## 附录 D — 术语表

| 术语 | 英文 | 含义 |
|---|---|---|
| 阴影图 | Shadow Map (SM) | 从光源视角渲染的深度图，用于判断遮挡 |
| 级联阴影 | Cascaded Shadow Maps (CSM) | 视锥分级，每级一张阴影图 |
| 方差阴影 | Variance Shadow Maps (VSM) | 存深度矩，支持预滤波软化 |
| 矩阴影 | Moment Shadow Mapping (MSM) | 存深度高阶矩，抗漏光 |
| 球谐函数 | Spherical Harmonics (SH) | 球面函数的有限系数编码 |
| 预计算辐射度传递 | Precomputed Radiance Transfer (PRT) | 预计算光线传递，运行时快速重光照 |
| 反射阴影图 | Reflective Shadow Map (RSM) | 把阴影图当虚拟点光源 |
| 光传播体积 | Light Propagation Volumes (LPV) | 3D 网格迭代传播间接光 |
| 屏幕空间环境光遮蔽 | SSAO / HBAO | 屏幕空间近似环境光遮蔽 |
| 屏幕空间反射/光线追踪 | SSR / SSRT | 屏幕空间沿射线步进深度图 |
| 线性变换余弦 | Linearly Transformed Cosines (LTC) | 多边形区域光解析着色 |
| 顺序无关透明 | Order-Independent Transparency (OIT) | 不依赖绘制顺序的透明 |
| 超分辨率 | Super Resolution (FSR) | 低分辨率图重建高分辨率 |

---

## 🔗 关联笔记

- 地基：[[学习笔记/cg/经典算法实现/00 前期准备.md|00 前期准备]] · [[学习笔记/cg/经典算法实现/01 框架.md|01 框架（FRAME）]]
- 算法笔记（待写）：02 实时阴影 · 03 环境光照与PRT · 04 实时全局光照 · 05 PBR与区域光
- 相关课程笔记：[[学习笔记/cg/games202/lecture3 Real-time Shadows 1.md|GAMES202 L3 阴影]]

---

## 🏷️ 标签

#cg #opengl #realtime-rendering #graphic-algorithm #source-code #roadmap #learning
