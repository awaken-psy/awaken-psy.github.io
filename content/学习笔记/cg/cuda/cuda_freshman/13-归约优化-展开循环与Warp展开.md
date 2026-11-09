---
title: 13 归约优化：展开循环与 Warp 展开
publish: true
updated: 2026-07-30T00:00:00.000Z
tags:
  - CUDA
  - 归约
  - 展开循环
  - Warp展开
  - 模板
  - 编译期优化
aliases:
  - reduceUnrollWarp8
  - reduceCompleteUnrollWarp8
  - reduceCompleteUnroll
  - volatile
  - 循环展开
date: 2026-07-30
---


# 13 归约优化：展开循环与 Warp 展开

> 对 `12_reduce_unrolling` 中 kernel 4/5/6 的逐行解析，以及完整计算实例。
> 关联：[[学习笔记/cg/cuda/cuda_freshman/12-展开循环与并行归约.md|12 展开循环与并行归约]]

---

## 1. 优化递进关系

| Kernel | 优化点 | 省掉了什么 |
|---|---|---|
| 3 (reduceUnroll8) | 基准：for 循环到 stride=1 | — |
| 4 (reduceUnrollWarp8) | 展开 Warp：stride ≤ 32 手动写 | 5 次 `__syncthreads` |
| 5 (reduceCompleteUnrollWarp8) | 完全展开：for 循环也手写 | 循环开销 + 动态分支 |
| 6 (reduceCompleteUnroll) | 模板常量：编译期裁剪 | 运行时 if 判断 |

先回顾 kernel 3 的第二阶段：

```cpp
for (int stride = blockDim.x / 2; stride > 0; stride >>= 1)
{
    if (tid < stride)
        idata[tid] += idata[tid + stride];
    __syncthreads();   // ← 每轮都要同步
}
```

blockDim.x = 1024 时跑 10 轮（512→256→128→64→32→16→8→4→2→1），每轮都有 `__syncthreads`。

---

## 2. Kernel 4：reduceUnrollWarp8 — 展开最后一个 Warp

### 优化点

stride > 32 时用循环，stride ≤ 32 手动展开：

```cpp
for (int stride = blockDim.x / 2; stride > 32; stride >>= 1)
{
    if (tid < stride) idata[tid] += idata[tid + stride];
    __syncthreads();
}
```

blockDim.x = 1024 时只跑 5 轮（512→256→128→64），到 32 停下来进入第三阶段。

### 为什么 stride=32 时不需要 `__syncthreads`

```
stride=32: 只有 tid 0~31 干活 → 同一个 Warp
stride=16: 只有 tid 0~15 干活 → 同一个 Warp
stride=8:  只有 tid 0~7 干活  → 同一个 Warp
...
```

Warp 内 32 个线程 SIMT 同步执行，天然同步，不需要 `__syncthreads`。

### 第三阶段：手动展开

```cpp
if (tid < 32)
{
    volatile int *vmem = idata;
    vmem[tid] += vmem[tid + 32];   // 64 → 32
    vmem[tid] += vmem[tid + 16];   // 32 → 16
    vmem[tid] += vmem[tid + 8];    // 16 → 8
    vmem[tid] += vmem[tid + 4];    // 8 → 4
    vmem[tid] += vmem[tid + 2];    // 4 → 2
    vmem[tid] += vmem[tid + 1];    // 2 → 1
}
```

> [!info] 为什么用 `volatile`
> 不用 volatile 的话，编译器可能把 `vmem[tid]` 缓存在寄存器里，后续读取用寄存器里的旧值而不是内存里的新值。`volatile` 强制每次都从内存读写，确保看到其他线程的最新写入。

### 省了什么

- kernel 3：10 轮循环，10 次 `__syncthreads`
- kernel 4：5 轮循环 + 5 次 `__syncthreads`，后 5 轮手动展开无同步

---

## 3. Kernel 5：reduceCompleteUnrollWarp8 — 完全展开循环

### 优化点

把第二阶段的 for 循环也手动展开：

```cpp
if (blockDim.x >= 1024 && tid < 512) idata[tid] += idata[tid + 512];
__syncthreads();
if (blockDim.x >= 512  && tid < 256) idata[tid] += idata[tid + 256];
__syncthreads();
if (blockDim.x >= 256  && tid < 128) idata[tid] += idata[tid + 128];
__syncthreads();
if (blockDim.x >= 128  && tid < 64)  idata[tid] += idata[tid + 64];
__syncthreads();
```

### 为什么手写比 for 循环快

for 循环时编译器不知道 stride 的具体值（运行时才知道），每轮要算 `stride >>= 1`、判断 `stride > 0`、动态分支。

手写后编译器在编译期就知道每轮的 stride（512、256、128、64），可以更好地调度指令。

### 省了什么

- kernel 4：5 轮 for 循环（有循环开销）
- kernel 5：5 条手写的 if（无循环开销）

---

## 4. Kernel 6：reduceCompleteUnroll — 模板版本

### 优化点

用编译期常量 `iBlockSize` 替代运行时变量 `blockDim.x`：

```cpp
template <unsigned int iBlockSize>
__global__ void reduceCompleteUnroll(int *g_idata, int *g_odata, unsigned int n)
{
    // ...
    if (iBlockSize >= 1024 && tid < 512) idata[tid] += idata[tid + 512];
    // ...
}
```

### 区别

`blockDim.x` 是运行时变量，`if (blockDim.x >= 1024)` 保留在运行时判断。

`iBlockSize` 是模板参数，编译期就知道值，**直接裁剪分支**：

```
如果 iBlockSize = 128：
  if (128 >= 1024 && ...) → false → 整条删除
  if (128 >= 512  && ...) → false → 整条删除
  if (128 >= 256  && ...) → false → 整条删除
  if (128 >= 128  && ...) → true  → 简化为 if (tid < 64)
```

调用方式：

```cpp
switch (blocksize) {
    case 1024: reduceCompleteUnroll<1024><<<...>>>(); break;
    case 512:  reduceCompleteUnroll<512><<<...>>>();  break;
    case 256:  reduceCompleteUnroll<256><<<...>>>();  break;
    case 128:  reduceCompleteUnroll<128><<<...>>>();  break;
}
```

编译器为每个模板实例生成一份专门优化的机器码。

---

## 5. 完整实例：reduceCompleteUnroll<128>

### 实验设置

- 数据：4096 个 1，正确答案 = 4096
- blockDim.x = 128，iBlockSize = 128
- 展开因子 8 → 每个 Block 处理 128×8 = 1024 个元素
- 4096 / 1024 = 4 个 Block

### 第一阶段：8 段合并成 1 段

Block 0 的 1024 个元素分成 8 段，每段 128 个。每个线程读 8 个位置的值，加起来写回段0：

```
tid=0:   读 [0],[128],[256],[384],[512],[640],[768],[896] = 1×8 = 8 → 写 [0]
tid=1:   读 [1],[129],[257],[385],[513],[641],[769],[897] = 8 → 写 [1]
...
tid=127: 读 [127],[255],[383],[511],[639],[767],[895],[1023] = 8 → 写 [127]
```

第一阶段结束后：`idata: [8, 8, 8, ...8]`，1024 个值 → 128 个值

### 第二阶段：完全展开（128 → 64）

编译期裁剪掉不可能的分支，只执行最后一行：

```cpp
// iBlockSize=128 时，前三条编译期删除，只留：
if (tid < 64) idata[tid] += idata[tid + 64];
__syncthreads();
```

```
tid=0:  idata[0]  += idata[64]   → 8+8 = 16
tid=1:  idata[1]  += idata[65]   → 8+8 = 16
...
tid=63: idata[63] += idata[127]  → 8+8 = 16
```

结果：`idata[0~63] = 16`，128 个值 → 64 个值

### 第三阶段：Warp 手动展开（64 → 1）

进入时 idata[0~63] = 16，共 64 个有效值，tid 0~31 刚好一个 Warp：

```
vmem[tid] += vmem[tid+32]:  64 → 32   全部 tid 0~31 各加 +32 位置
    idata[0~31] = 16+16 = 32

vmem[tid] += vmem[tid+16]:  32 → 16   tid 0~15 有意义，tid 16~31 也执行但废数据
    idata[0~15] = 32+32 = 64

vmem[tid] += vmem[tid+8]:   16 → 8    tid 0~7 有意义
    idata[0~7] = 64+64 = 128

vmem[tid] += vmem[tid+4]:    8 → 4     tid 0~3 有意义
    idata[0~3] = 128+128 = 256

vmem[tid] += vmem[tid+2]:    4 → 2     tid 0~1 有意义
    idata[0~1] = 256+256 = 512

vmem[tid] += vmem[tid+1]:    2 → 1     tid 0 有意义
    idata[0] = 512+512 = 1024
```

### 写结果

```
g_odata[0] = 1024
```

### 4 个 Block + CPU 求和

```
Block 0: 1024
Block 1: 1024
Block 2: 1024
Block 3: 1024
CPU: 1024 × 4 = 4096 ✓
```

### 全流程总结

```
第一阶段（数据合并）    8×128 = 1024 个值 → 128 个值（每个 = 8）
         │
第二阶段（完全展开）    128 → 64（编译期裁剪掉 3 条不可能的 if）
         │
第三阶段（Warp 展开）   64 → 32 → 16 → 8 → 4 → 2 → 1
         │              不需要 __syncthreads，SIMT 天然同步
         │
    idata[0] = 1024（这个 Block 处理的 1024 个 1 的总和）
```

---

## 📌 速查表

| 问 | 答案要点 |
|---|---|
| Kernel 4 省了什么 | 最后 5 轮的 `__syncthreads`（Warp 内 SIMT 天然同步） |
| 为什么 Warp 内不需要 `__syncthreads` | 32 个线程走同一条指令，天然同步 |
| 为什么用 `volatile` | 防止编译器把中间结果缓存在寄存器里，强制每次读写内存 |
| Kernel 5 省了什么 | for 循环开销，编译器知道每轮 stride 可以更好地调度指令 |
| Kernel 6 省了什么 | 运行时 if 判断（模板参数编译期已知，直接裁剪分支） |
| `blockDim.x` vs `iBlockSize` | 前者运行时变量，后者编译期常量 |
| 第三阶段归约的是多少个值 | 取决于 blockDim.x，1024 时是 64 个，128 时也是 64 个 |
| 进入第三阶段时有几个有效值 | blockDim.x / 2 ÷ 2^（循环轮数）→ 最终是 blockDim.x/2 的结果 |
| tid 16~31 在第三阶段也执行吗 | ✅ 执行，但结果无用，不影响正确性 |
