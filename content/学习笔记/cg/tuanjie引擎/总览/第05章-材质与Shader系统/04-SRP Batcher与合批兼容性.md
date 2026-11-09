---
title: 04 - SRP Batcher 与合批兼容性
publish: true
updated: 2026-09-10T12:05:12.723Z
---

# 04 - SRP Batcher 与合批兼容性

> 阅读时间：约 35 分钟
> 关键词：SRP Batcher、UnityPerMaterial、兼容性、静态合批对比、MPB 的取舍

---

## 你将学到什么

- SRP Batcher 的核心机制：材质常量常驻 GPU
- "兼容性"到底检查什么、为什么 shader 写法决定一切
- MPB / Instancing / 静态合批与 SRP Batcher 的相克关系
- 一张决策表：你的物体该走哪条路

---

## 1. 回顾：DrawCall 的固定开销在哪

第04章把 DrawCall 的 CPU 成本列为：排序分组、状态切换、**参数填充**、命令录制、驱动校验。其中**参数填充**是老管线的最痛处：

传统流程（内置管线/D3D11 时代）每次 DrawCall 前：把该物体+该材质的所有常量（矩阵、颜色、贴图索引…）**即时 memcpy 进一块全局缓冲**，再整体上传。材质有 20 个参数、物体 5000 个 → 一帧 10 万次小块拷贝 + 上传。**参数数据明明几乎不变（材质参数尤其静态），却每帧重复上传**——这就是 SRP Batcher 的攻击目标。

## 2. SRP Batcher 的机制：两块缓冲、一次绑定

核心思想一句话：

> **材质参数既然几乎不变，就让它在 GPU 常驻；每物体只上传一小块"每物体数据"。**

### 2.1 契约：UnityPerMaterial CBUFFER

SRP Batcher 要求 shader 把材质参数**统一放进名为 `UnityPerMaterial` 的常量缓冲块**（URP 模板天然满足）：

```hlsl
CBUFFER_START(UnityPerMaterial)
    float4 _BaseColor;
    float4 _MainTex_ST;
    half _Smoothness;
    ...
CBUFFER_END
```

引擎看到这个块，就为**每个材质实例**分配并维护一块**持久 GPU 常量缓冲**——材质参数只在**材质改动时**上传一次，之后一直躺在 GPU 上。

### 2.2 绘制时的两段式

每次 DrawCall 只需：

1. **绑定持久 CBUFFER**（`SetConstantBuffer`——现代 API 的"绑定一次、多次使用"，第03章描述符表的直接红利）：切换物体时只切"指向哪块"的句柄，不搬数据；
2. 上传**小块 per-object 缓冲**：只有物体矩阵这类每帧必变的少数量。

```
传统: [重传全部材质参数 + 物体参数] × 每物体
SRP Batcher: [材质参数已常驻] → 只传物体参数 → 换个"指针"
```

### 2.3 兼容性检查

引擎对每个"渲染器+材质"判定 SRP Batcher 兼容（Frame Debugger 里可见 `SRP Batched` 标记），不兼容的原因基本两条：

- shader **没有规范的 UnityPerMaterial 块**（老 shader、手写散乱参数）；
- 使用了破坏"材质常驻"的机制——主要是 **MaterialPropertyBlock**（见下）。

不兼容的物体**回退到传统路径**（全部重传），一个场景里混着兼容/不兼容的物体，就是"SRP Batcher 开了却没快多少"的常见真相。**Frame Debugger 的 SRP Batcher 面板/统计**是第一诊断入口。

## 3. 相克机制：谁会打破 SRP Batcher

| 手段 | 与 SRP Batcher 关系 | 原因 |
|---|---|---|
| **MaterialPropertyBlock** | **破坏** | MPB 的临时参数没有"持久材质 CBUFFER"可住——引擎要么回退要么上传临时块。SRP 时代 MPB 从"个体化推荐方案"降级为"最后手段" |
| **GPU Instancing** | 互斥（二选一） | Instancing 的优势是"一次画 N 个"，SRP Batcher 的优势是"降低单次成本"。同 shader 二者不可同时；引擎按批类型自动选路。重复同网格 → Instancing 通常仍更优 |
| **静态合批** | 可共存但通常不必 | 静态批还在省 DrawCall 数；但牺牲剔除粒度。URP 时代"SRP Batcher + 不合并几何"常常总收益更高 |
| **动态合批** | 同上，且动态批本身过时 | 直接关掉，用 SRP Batcher/Instancing |
| **Renderer.material 修改** | 打破共享 | `material` 属性是"实例化副本"（第01篇），每个副本一份 CBUFFER——大量实例化=内存+上传膨胀 |

**MPB 的替代方案**（URP 实践）：需要个体化颜色/参数时——
- 简单差异（颜色）：改用 **Instancing + per-instance 颜色**（`UNITY_INSTANCING_BUFFER`，天然支持 N 个体参数）；
- 复杂差异：接受实例化材质副本（少量）或按类别拆成多个材质；
- SRP 的 `MaterialPropertyBlock` 在 2023+ 已重新支持为 "UsePerMaterialProperty"（数据仍走 per-object 小缓冲，不破坏持久块）——**查你版本的说明再下结论**。

## 4. 决策表：你的物体走哪条路

```
同一网格重复 N 次？（草/树/道具/小怪）
├─ 是 → GPU Instancing（+ per-instance 参数差异）
└─ 否
   ├─ 静止、紧凑、同材质小物件群 → 静态合批（可叠加）
   ├─ 一般情况（绝大多数物体） → SRP Batcher（默认路径，保证 shader 规范）
   └─ 需要运行时个体改参数 → Instancing 的 per-instance 数据；
       否则 MaterialPropertyBlock（接受该物体退出 SRP Batcher）
```

**经验法则（URP 时代）**：先把所有 shader 迁到规范写法（UnityPerMaterial），让 95% 物体走 SRP Batcher；重复网格专项走 Instancing；静态合批只在"同材质小物件密集"的局部使用。

## 5. 验证手段

- **Profiler**：`RenderThread` 的 `Submit`/`SetPass Calls` 计数对比开/关 Batcher；
- **Frame Debugger**：顶部显示"SRP Batch"与不兼容原因（`Not Batcher compatible: shader`...）；
- **源码层**：持久材质缓冲的管理在 `Runtime/Shaders/GlobalConstantBuffers.cpp` 与 `Runtime/GfxDevice/BuiltinMatrixParamCache.h`（引擎如何缓存与复用常量）；SRP 路线的批次执行在 `Runtime/Graphics/ScriptableRenderLoop/ScriptableBatchRenderer.cpp`、`ScriptableBatcherShaderData.cpp`（材质数据/变体数据的批内一致性检查——兼容性判定的现场）。

---

## 小结

- SRP Batcher = 材质常量**常驻 GPU** + 每物体只传小缓冲 + 换绑定不搬数据；
- 契约是 `UnityPerMaterial` CBUFFER——shader 规范写法决定兼容性；
- MPB 破坏它、Instancing 与它互斥（按场景二选一）、实例化材质副本产生上传膨胀；
- URP 时代优化哲学：**降低每个 DrawCall 成本（SRP Batcher）优先于减少 DrawCall 数量（强合批）**。

## 自测问题

1. 用一段话向同事解释：为什么"材质参数常驻 GPU"能大幅降低 DrawCall 成本？
2. 你的场景 SRP Batcher 开了但没提升，三个最可能原因？（提示：混不兼容、MPB 满天飞、瓶颈根本不在 CPU 提交）
3. 1000 棵树 + 每棵颜色不同：Instancing 与 SRP Batcher 怎么选？怎么既保留个体颜色又不破坏方案？
4. 为什么内置管线（Built-in）不能享受 SRP Batcher？（提示：管线架构与常量管理路径不同）

---

*第05章完。材质与 shader 的机器侧闭环已完成。下一章进入画面的灵魂——光照与 PBR。*
