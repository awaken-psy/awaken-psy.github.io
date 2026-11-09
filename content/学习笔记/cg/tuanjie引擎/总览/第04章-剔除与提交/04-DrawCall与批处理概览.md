---
title: 04 - DrawCall 与批处理概览
publish: true
updated: 2026-09-10T12:03:57.846Z
---

# 04 - DrawCall 与批处理概览

> 阅读时间：约 35 分钟
> 关键词：DrawCall、合批、静态批处理、动态批处理、GPU Instancing、SRP Batcher 预告

---

## 你将学到什么

- DrawCall 的真实成本结构（为什么慢的是 CPU）
- 合批的四种流派与各自原理
- 各流派的适用条件与陷阱
- 为什么"能合批"取决于"差异在哪里"

---

## 1. DrawCall 的成本解剖

第00篇给过结论"DrawCall 慢的是 CPU"，现在解剖它到底贵在哪。一次 DrawCall 从管线编排到 GPU 开工，CPU 侧开销：

| 步骤 | 干什么 | 量级 |
|---|---|---|
| **排序与分组** | 找到这批物体该排哪、能不能合 | 每物体微秒级 |
| **状态切换** | 换 shader/纹理/常量缓冲/顶点缓冲 | 每次 5~50μs（GLES 更贵） |
| **参数填充** | 写矩阵/颜色进常量缓冲 | 1~10μs |
| **命令录制** | 翻译成 API 调用/命令 | 2~20μs |
| **驱动层** | 驱动校验、内部重编译检查（GLES 的状态验证） | 可高达 100μs+ |

1000 个小物体各发 1 次 DrawCall，哪怕 GPU 画每个只用 1μs，CPU 侧可能已经烧掉 5~20ms。**合批的目标只有一个：用"共享"消灭重复的固定开销**。

> 性能经验值：桌面 D3D12/Vulkan 可承受 1~2 万 DrawCall/帧；移动 GLES 建议把"可见 DrawCall"压在几百到一两千。手机优化第一铁律：**先看 DrawCall 数**。

## 2. 合批流派一：静态批处理（Static Batching）

**原理**：把标记 Static 的物体在**构建时/加载时**把它们的网格变换到世界空间后**拼进一个大顶点缓冲**。运行时，一批共享材质的物体 = 1 次 DrawCall。

$$
N \text{ 个物体} \times \text{各自世界矩阵} \to \text{合并进同一个大 VB} \to 1 \times \text{DrawCall}
$$

- **收益**：运行时零 CPU 排序成本（早已合并），DrawCall 暴跌；
- **代价 1**：顶点数据**重复存储**（同一网格摆 100 次 = 100 份顶点）→ 内存与包体膨胀；
- **代价 2**：**顶点数被钉死**——1000 栋楼合一个 VB，视锥体剔除失效（一个 AABB 罩全部：看见一角 = 画全部），GPU 顶点处理白做；
- **适用**：数量适中、分布紧凑、共享材质的静物（一片废墟、一套室内）。

> ⚠️ 把全场景无脑 Static 合批是新手优化第一大坑：**DrawCall 降了，顶点开销和内存爆了**。正确姿势是分区域、分材质组合批。

## 3. 合批流派二：动态批处理（Dynamic Batching）

**原理**：运行时，CPU 把**共享材质、顶点数少**的动态物体，每帧在 CPU 上把顶点按世界矩阵变换后拼进一个大 VB，再 1 次 DrawCall。

- **收益**：动的也能合（小物件多时显著）；
- **代价**：**每帧 CPU 变换顶点**（顶点数多时代价爆炸）→ 引擎限制 900 顶点以下才尝试；且合并进大 VB 后 Early-Z/剔除粒度同样受损；
- **现状**：移动端常关（CPU 变换顶点比 DrawCall 还贵），桌面也少用。**了解即可，基本不靠它**。

## 4. 合批流派三：GPU Instancing

**思路反转**：不合并几何——**同一个网格**画 N 次，每次只给一份"实例参数"（世界矩阵 + 逐实例差异）。GPU 循环执行：

```
一次 DrawCall:
  for i in 0..N:
      变换 = 实例缓冲[i]
      用变换画共享网格
```

- **条件**：网格相同、材质相同（允许少量参数差异）；
- **差异注入**：per-instance 数据放 `UNITY_INSTANCING_BUFFER`（矩阵、颜色）；需要贴图差异时用 Texture2DArray 或 atlases；
- **收益**：CPU 只花 1 次 DrawCall，GPU 吃下 N 个实例。**草、树、重复道具、粒子簇的标准答案**（第12章深入）；
- **限制**：实例多的"阴影体"特殊处理；某些老 GLES 驱动支持差（可 fallback）。

## 5. 合批流派四：SRP Batcher（现代主角，第05章详述）

**观察**：合批最贵的是"每 DrawCall 重写材质常量"。现代 API 的常量缓冲+描述符表允许**"同一 shader 的所有物体共享一份绑定，只换小块"**。

**做法**：URP/HDRP 里，材质常量被要求放 `UnityPerMaterial` 这个 CBUFFER 块——引擎给每个材质**持久保留一块 GPU 常量缓冲**，物体绘制时只切换"指向哪个材质块"，不再重传。于是：

$$
\text{不合并几何，但使 DrawCall 的 CPU 成本} \downarrow\downarrow \Rightarrow \text{上千物体不必强求几何合批}
$$

- **条件**：shader 用 URP 风格写（CBUFFER 命名规范），管线开启 SRP Batcher；
- **效果**：DrawCall 数量**没变**，但每个的 CPU 成本大降——Profiler 里"渲染主线程时间"大幅缩短；
- **定位**：**现代管线的默认方案**，它改变了优化的重点——"强行合并几何"在 URP 时代重要性下降，"少 shader 变体、材质数据规范"重要性上升（第05章、第12章展开）。

## 6. 四流派对照与组合拳

| 流派 | 合的是什么 | CPU 成本 | 代价 | 最佳场景 |
|---|---|---|---|---|
| 静态批 | 几何（构建期拼 VB） | 零（运行时） | 顶点重复、剔除粒度粗 | 紧凑静物群 |
| 动态批 | 几何（每帧 CPU 变换） | 高（顶点变换） | 帧内重算 | 小且动的物件（少用） |
| GPU Instancing | 调用（一次画 N 实例） | 低 | 需同网格同材质 | 草木、重复道具、粒子 |
| SRP Batcher | 状态切换成本 | 极低 | shader 要按规范写 | URP/HDRP 全场景 |

**组合思路**：
- URP 项目：**SRP Batcher 全程开** + 植被走 Instancing + 少量静态批点缀；动态批基本不碰；
- 微信小游戏/移动老平台（SRP Batcher 收益打折）：Instancing 与材质共享权重上升。

> 📁 **源码指引**：合批心脏 `Runtime/GfxDevice/BatchRendering.cpp`（引擎级合批调度）；`InstancingBatcher.cpp`（Instancing 组批）；`StaticBatchInfo.h` 与编辑器静态批构建；`DynamicBatchingCompatibilityHelper.cpp`（动态批兼容判定——动态批为什么限制多，看这里）；`ScriptableBatchRenderer.cpp`（SRP 路线的批次执行，与 SRP Batcher 对接）。

## 7. 第04章总结：提交侧全流程

```
可见集（剔除后）
  → 按队列分类（Layer/RenderQueue）
  → 字典序排序（队列→材质哈希→距离）
  → 合批分组（静态/Instancing/SRP Batcher 兼容性）
  → 逐批：填参+绑定+录制 DrawCall
  → 命令流提交 GPU
```

至此，"一帧画面"从场景数据到 GPU 命令的 **CPU 侧全景**已完整。第05章进入"每次 DrawCall 内部"：材质与 shader 如何被装进管线。

---

## 小结

- DrawCall 成本 = CPU 固定开销（排序/状态/参数/录制/驱动）；
- 四合批流派：静态批（拼几何，剔除受损）、动态批（少用）、Instancing（一次画 N 实例）、SRP Batcher（砍单次成本）；
- SRP Batcher 改变优化哲学：从"减少 DrawCall 数量"转向"降低每个 DrawCall 的成本"；
- 组合拳按平台选：URP 桌面 = SRP Batcher + Instancing；移动小游戏再加重 Instancing。

## 自测问题

1. 为什么静态批处理会毁掉剔除收益？什么样的 Static 组合是"安全"的？
2. 动态批处理为什么限制 900 顶点以下？它每帧在 CPU 做什么昂贵的事？
3. 1000 棵相同的树，用哪种合批？如果把树做成 1000 个不同 Mesh 呢？
4. SRP Batcher 没有减少 DrawCall 数量，为什么 Profiler 里渲染时间还是降了？

---

*第04章完。下一章进入材质与 Shader 系统——每次绘制的"灵魂配置"如何组装。*
