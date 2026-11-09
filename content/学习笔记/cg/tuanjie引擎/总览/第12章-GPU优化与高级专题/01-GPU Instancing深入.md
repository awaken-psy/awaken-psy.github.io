---
title: 01 - GPU Instancing 深入与实例数据设计
publish: true
updated: 2026-09-10T12:13:46.440Z
---

# 01 - GPU Instancing 深入与实例数据设计

> 阅读时间：约 35 分钟
> 关键词：Instancing、StructuredBuffer、实例数据布局、限制与突破

---

## 你将学到什么

- Instancing 的 GPU 执行模型（第04章概览的深化）
- 两种实例数据通道：实例常量 vs 结构化缓冲
- "每实例一张图"的实现（Texture2DArray/图集）
- Instancing 的边界与常见失败原因

---

## 1. 回顾与深入：一次 DrawCall 里发生了什么

第04章：GPU Instancing = 同网格 × N 实例参数，一次 DrawCall。硬件层的真相：

```
VS 输入除了顶点属性，多了一个 SV_InstanceID
GPU 对每个实例循环：VertexID 走一轮顶点，InstanceID 递增
→ 实例数 N × 顶点数 M 次顶点着色（并行展开）
```

**性能画像**：CPU 侧一次 DrawCall 固定开销；GPU 侧顶点处理量不变（总顶点 = N×M 本来就该画这么多）——**省的纯是 CPU**。第04章的结论在深度层依然成立：**Instancing 是 CPU 优化，不是 GPU 优化**。

## 2. 实例数据的两条通道

### 2.1 通道一：实例常量（传统）

引擎封装好的 `UNITY_INSTANCING_BUFFER`（宏系统）：把 ` UNITY_MATRIX_M` 等逐实例常量打包进一个**大常量缓冲**，VS 按 InstanceID 索引：

$$
M_i = \text{InstanceCB}[i \cdot \text{stride} + \text{offset}]
$$

- 上限受常量缓冲大小约束（D3D11: 64KB；数千实例的矩阵刚好放满）；
- 每帧 CPU 填充上传（矩阵变动=重传）。

### 2.2 通道二：StructuredBuffer（现代主力）

实例数据放**结构化缓冲**（GPU 内存里的结构数组），VS/PS 直接 `Load(i)`：

```hlsl
StructuredBuffer<float4> _InstanceData;  // 位置+旋转压缩/缩放/参数...
// SV_InstanceID 驱动取数
```

**优势**：
- **容量无束缚**（几十万实例随便放）；
- **GPU 可写**：compute 更新后直接被绘制消费（**GPU→GPU 零回读**——GPU Driven 的基石，第02篇主角）；
- 布局自由：想存什么存什么（颜色、AI 状态、动画相位）。

**代价**：跨 API 兼容（老 GLES3.0 无 UBO/SSBO——引擎按能力回退）；数据填充走 compute 或异步上传。

> 💡 **设计心法**："实例数据越少越好"——矩阵别存 16 个 float，位置 3+四元数 4+缩放 3=10 个 float 甚至更少的紧凑编码；动画相位 1 个 float 替代整套骨骼姿势。

## 3. "每实例不同贴图"的三种解法

Instancing 的经典痛点（同网格但纹理差异）：

| 方案 | 原理 | 适用 |
|---|---|---|
| **Texture2DArray** | 同尺寸贴图叠成"书"，实例存 `index` 采样层 | 植被/石头变体（**推荐**，mipmap/压缩正常） |
| **图集** | 大图拼格，实例存 UV 偏移缩放 | 尺寸不齐的图标类；注意 mip 渗色（第02章） |
| **逐实例颜色/参数** | 根本不换图，用参数调色 | 草（色相抖动+粗糙度扰动）——最便宜 |

植被标准答案：**同网格 + Texture2DArray（几类叶片）+ 逐实例颜色抖动 + 风相位**——视觉多样性与合批兼得。

## 4. 边界与失败排查

**Instancing 断裂的原因**（合批中断，回退逐个画）：
1. **材质不同**（哪怕只差一个滑条）→ 分批；正确姿势：同材质+实例数据差异化；
2. **材质实例被修改**（脚本 `renderer.material` 触发实例化——第05章）→ 副本材质各自成批；
3. **阴影/深度 Pass 不兼容**（ShadowCaster 没写 Instancing 变体）→ 阴影批不合并（第05章变体问题）；
4. **关键合批键冲突**：第04章排序键里材质哈希不同的物体分开排——Instancing 组与 RenderQueue 排序交叉时拆批；
5. **MPB 个体化**：URP/SRP Batcher 时代的取舍见第05章04篇（SRP 时代可用 per-instance CBUFFER 数据替代）。

**诊断口诀**：Frame Debugger 找"Draw XXX"批次 → 看该批是 "Instanced" 还是逐物体 → 从上面五条按序排查。

> 📁 **源码指引**：引擎侧组批 `Runtime/GfxDevice/InstancingBatcher.cpp`（把"兼容的实例"打成一批的判定现场）；`InstancingProps.cpp`（逐实例属性收集）；`BuiltinInstancingPropertyMask.h`（哪些内置属性参与实例化）；SRP 路线 `ScriptableBatchRenderer.cpp` 与 Instancing 的衔接。

---

## 小结

- Instancing=CPU 优化：一次 DrawCall 摊掉 N 份固定开销，GPU 顶点量不变；
- 数据两通道：实例常量（兼容老 API、上限小）vs StructuredBuffer（容量大、GPU 可写——GPU Driven 地基）；
- 贴图差异三解：2DArray（推荐）、图集、逐实例参数调色；
- 断批五因：材质异、实例化副本、变体缺、排序冲突、MPB。

## 自测问题

1. 10000 棵草合并成一批后，DrawCall 省了多少？顶点开销变了吗？（精确回答"省的是什么"）
2. 为什么 StructuredBuffer 是 GPU Driven 的地基？（谁写它、谁读它、CPU 在干嘛）
3. 草要 4 种颜色+3 种叶片——给出数据通道设计（几个 buffer、各存什么）。
4. 你的森林 Instancing 正常但阴影 DrawCall 爆炸——查什么？（ShadowCaster 的 Instancing 变体）

---

*下一节：[02-Compute与GPU Driven](02-Compute与GPU Driven.md) —— 把"控制权"也交给 GPU：并行计算模型与管线新形态。*
