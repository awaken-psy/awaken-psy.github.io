---
title: 09 线程束执行的本质与 Warp Divergence
publish: true
updated: 2026-07-30T00:00:00.000Z
tags:
  - CUDA
  - 执行模型
  - Warp
  - Warp Divergence
  - 分支分歧
  - SIMT
aliases:
  - 线程束分化
  - Warp Divergence
  - 分支预测
  - 条件谓词
date: 2026-07-30
---


# 09 线程束执行的本质与 Warp Divergence

> 深入理解 SIMT 执行模型，以及 if-else 为什么会导致性能下降。
> 关联：[[学习笔记/cg/cuda/cuda_freshman/08-CUDA执行模型概述.md|08 CUDA 执行模型概述]]

---

## 1. 为什么 Warp 只能"要么执行，要么干等"

### 根本原因：硬件只有一个指令调度器

一个 Warp 有 32 个线程，但 SM 里只有**一个 Warp 调度器**管这个 Warp。调度器每个时钟周期只发**一条指令**给这 32 个线程。

```
Warp 调度器（只有一个）
     │
     │  每个时钟周期发一条指令
     │
     ▼
  ┌──┬──┬──┬──┬──┬──┬── ── ──┬──┐
  │t0│t1│t2│t3│t4│t5│  ...   │t31│   32 个线程
  └──┴──┴──┴──┴──┴──┴── ── ──┴──┘
```

这 32 个线程共享同一个"指令指针"——它们必须在同一时刻执行同一条指令。

### CPU vs GPU 的关键区别

CPU 有**分支预测**硬件，能猜该走哪条路，猜对了流水线不停，猜错了回滚。CPU 的每个核心是独立的，不同核心可以执行不同指令。

GPU 没有这种复杂硬件。GPU 的设计哲学是**简单核心 + 大规模并行**——靠数量取胜，不靠单核心的智能。所以 Warp 内 32 个线程**共用一条指令流水线**，硬件层面就是一条线，物理上没法同时走两条路。

---

## 2. if-else 的实际执行过程

```cpp
if (con) {
    a = 100.0f;     // 分支 A
} else {
    b = 200.0f;     // 分支 B
}
```

假设 Warp 0 的 32 个线程中，16 个 `con` 为 true，16 个为 false：

```
时钟周期      调度器发出的指令      t0~t15 (true)    t16~t31 (false)
──────────────────────────────────────────────────────────────────
第 1 周期     if (con)              检查条件 ✓        检查条件 ✗
第 2 周期     a = 100  (分支A)      执行 ✓           被禁用，干等 ✗
第 3 周期     a = 100  (分支A续)    执行 ✓           干等 ✗
                                    ↑ 分支A执行完
第 4 周期     b = 200  (分支B)      被禁用，干等 ✗   执行 ✓
第 5 周期     b = 200  (分支B续)    干等 ✗           执行 ✓
                                                    ↑ 分支B执行完
第 6 周期     c[tid] = a + b       全部执行 ✓        全部执行 ✓
```

调度器先发出分支 A 的指令，`con` 为 false 的线程被硬件禁用（通过条件谓词寄存器）；然后发出分支 B 的指令，`con` 为 true 的线程被禁用。两个分支**串行执行**。

> [!abstract] 老师类比
> 老师只有一张嘴，每次只能说一条指令。老师喊"翻到第 10 页"，32 个学生都得翻。老师喊"做第 10 页的题"，16 个学生做，16 个不做——但不做的学生不能自己翻到第 20 页做别的题，因为老师没说翻到第 20 页，只能坐着等。等老师讲完第 10 页，再喊"翻到第 20 页"。

---

## 3. 为什么不能"不执行的线程去干别的"

因为**指令调度器只有一个**，32 个线程共用一条指令流水线。硬件上不存在"某个线程偷偷执行别的指令"的物理通路。

调度器发一条指令 → 32 个线程都收到 → 条件满足的线程执行，不满足的被硬件禁用 → 等这条指令走完 → 调度器发下一条指令。循环往复。

---

## 4. Warp Divergence 的代码示例

### ❌ 坏的写法 — Warp 内分化

```cpp
__global__ void mathKernel1(float *c)
{
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    float a = 0.0;
    float b = 0.0;
    if (tid % 2 == 0)      // 同一个 Warp 内，偶数/奇数线程交替
    {
        a = 100.0f;
    }
    else
    {
        b = 200.0f;
    }
    c[tid] = a + b;
}
```

```
Warp 0 (thread 0~31)：
  tid:    0  1  2  3  4  5  6  7  8  9 ... 30 31
  偶数:   ✓  ✗  ✓  ✗  ✓  ✗  ✓  ✗  ✓  ✗ ... ✓  ✗

  → 同一个 Warp 内，偶数和奇数交替 → 分化严重
  → if 和 else 都得执行，效率减半
```

### ✅ 好的写法 — Warp 内不分化

```cpp
__global__ void mathKernel2(float *c)
{
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    float a = 0.0;
    float b = 0.0;
    if ((tid / warpSize) % 2 == 0)   // 按 Warp 整体分流
    {
        a = 100.0f;
    }
    else
    {
        b = 200.0f;
    }
    c[tid] = a + b;
}
```

```
Warp 0 (thread 0~31)：tid/32 = 0 → 全部走 if    → 无分化 ✓
Warp 1 (thread 32~63)：tid/32 = 1 → 全部走 else → 无分化 ✓
```

### 本质区别

| | mathKernel1 | mathKernel2 |
|---|---|---|
| 分支条件 | `tid % 2` | `(tid / warpSize) % 2` |
| Warp 0 内 | 16 个走 if，16 个走 else | 32 个全走 if |
| Warp 1 内 | 16 个走 if，16 个走 else | 32 个全走 else |
| 分化 | ❌ 严重 | ✅ 无 |
| 效率 | ~50% | ~100% |

> [!tip] 核心技巧
> 分支条件的设计要让**同一个 Warp 内的 32 个线程走同一条路**。用 `tid / warpSize` 可以按整个 Warp 分流，而不是按单个线程分流。

---

## 5. 线程束的划分规则

线程块被分配到 SM 后，线程按固定规则切成 Warp：

```
Block (128 个线程)
├── Warp 0: thread 0  ~ thread 31
├── Warp 1: thread 32 ~ thread 63
├── Warp 2: thread 64 ~ thread 95
└── Warp 3: thread 96 ~ thread 127
```

### 三维编号转一维索引

```cpp
int tid = threadIdx.x + threadIdx.y * blockDim.x + threadIdx.z * blockDim.x * blockDim.y;
```

x 是最内层（最快变化），z 是最外层。类似 C 语言的 `t[z][y][x]`。

### Warp 数量计算

```
WarpsPerBlock = ceil(ThreadsPerBlock / 32)
```

| ThreadsPerBlock | Warps |
|---|---|
| 32 | 1 |
| 64 | 2 |
| 96 | 3 |
| 128 | 4 |
| 1024 | 32 |

> [!warning] Block 大小最好是 32 的倍数
> 如果 Block 有 33 个线程，会被切成 2 个 Warp：Warp 0 有 32 个有效线程，Warp 1 只有 1 个有效线程，其余 31 个空闲浪费。

---

## 6. 编译器优化

> [!info] 实际测试中 mathKernel1 的分支效率可能是 100%
> 现代编译器会自动优化简单的分支。例如 `if (tid % 2 == 0)` 可能被编译器用谓词执行优化掉。
> 如果想看到真实的分化效果，可以：
> - 用更复杂的分支条件（如基于数据的判断）
> - 编译时加 `--disable-cccmp` 等选项禁用优化
> - 用 `bool ipred` 变量阻止编译器内联优化

---

## 7. 分支效率公式

$$
\text{Branch Efficiency} = \frac{\text{Branches} - \text{Divergent Branches}}{\text{Branches}}
$$

- **Branches**：总分支数
- **Divergent Branches**：产生分化的分支数（同一 Warp 内走了不同路）

用 ncu 可以查看：

```bash
ncu --metrics branch_efficiency ./divergence
```

---

## 📌 速查表

| 问 | 答案要点 |
|---|---|
| 为什么 Warp 遇到 if-else 只能串行执行 | 硬件只有一个指令调度器，32 个线程共用一条指令流水线 |
| 不执行的线程能去干别的吗 | ❌ 不能，被硬件禁用，只能干等 |
| Warp Divergence 的代价 | 分支串行执行，吞吐量减半甚至更多 |
| 如何避免 Divergence | 让同一 Warp 内 32 个线程走同一条分支 |
| 分流技巧 | 用 `tid / warpSize` 按整个 Warp 分流，而非 `tid % n` 按线程分流 |
| Block 大小建议 | 32 的倍数，避免 Warp 内有空闲线程 |
| 分支效率公式 | (总分支 - 分化分支) / 总分支 |
| Divergence 只影响谁 | 同一个 Warp 内的线程，不同 Warp 互不影响 |
| CPU vs GPU 分支 | CPU 有分支预测，GPU 没有，靠 SIMT 简单粗暴 |
