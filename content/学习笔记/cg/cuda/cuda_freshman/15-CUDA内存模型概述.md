---
title: 15 CUDA 内存模型概述
publish: true
updated: 2026-07-30T00:00:00.000Z
tags:
  - CUDA
  - 内存模型
  - 寄存器
  - 共享内存
  - 全局内存
  - 常量内存
  - 纹理内存
  - 局部内存
aliases:
  - CUDA内存模型
  - 内存层次结构
  - __shared__
  - __device__
  - __constant__
date: 2026-07-30
---


# 15 CUDA 内存模型概述

> CUDA 把内存层次结构暴露给开发者，让我们显式控制数据放在哪里。选对内存类型是性能优化的关键。
> 关联：[[学习笔记/cg/cuda/cuda_freshman/03-显存分配与浮点误差.md|03 显存分配与浮点误差]] · [[学习笔记/cg/cuda/cuda_freshman/10-资源分配与延迟隐藏与占用率.md|10 资源分配、延迟隐藏与占用率]]

---

## 1. 内存层次结构的优点

### 程序的局部性

内存层次结构有效的前提是程序的**局部性**：

- **时间局部性**：一个内存位置被访问后，近期很可能再次被访问（如循环变量）
- **空间局部性**：一个内存位置被访问后，附近的位置很可能也被访问（如数组遍历）

```
越快          ←→          越慢
寄存器 → L1缓存 → L2缓存 → 主存 → 硬盘
越小          ←→          越大
```

> [!info] 局部性是程序与生俱来的特征
> 不是因为有了缓存才出现局部性，而是程序本身就有局部性，硬件按此特征设计了内存层次。程序局部性越好，越能利用高速的缓存层。

### 最后一层（硬盘等）的特点

- 每个比特位的价格更低
- 容量更高
- 延迟较高
- 处理器访问频率低

### DRAM vs SRAM

| | DRAM（动态随机存取存储器） | SRAM（静态随机存取存储器） |
|---|---|---|
| 用途 | 主存（CPU/GPU 的内存条/显存） | 低延迟缓存（L1/L2） |
| 速度 | 慢 | 快 |
| 容量 | 大 | 小 |
| 造价 | 低 | 高 |

### CPU vs GPU 的内存设计区别

CPU 和 GPU 的主存都用 DRAM，低延迟缓存用 SRAM。

**关键区别**：CPU 的一级二级缓存完全不可编程（程序员无法控制）。CUDA 把内存层次结构暴露给开发者，让我们**显式控制**数据放在哪里。

---

## 2. 可编程 vs 不可编程内存

| 类型 | 说明 | 例子 |
|---|---|---|
| **可编程内存** | 程序员用代码控制其行为 | 寄存器、共享内存、常量内存、纹理内存、全局内存 |
| **不可编程内存** | 硬件出厂固化，程序员无法控制 | L1 缓存、L2 缓存 |

对于不可编程内存，只能了解其原理、利用规则加速，但不能通过代码直接控制。

---

## 3. 六种内存类型

### 3.1 寄存器（Registers）

最快 的内存，核函数内不加修饰符声明的变量就在寄存器中：

```cpp
__global__ void kernel() {
    float a = 0.0f;        // 寄存器
    int tid = threadIdx.x; // 寄存器
    float arr[4];          // 定长数组也在寄存器
}
```

| 属性 | 值 |
|---|---|
| 速度 | ~1 周期 |
| 容量 | 每线程最多 255 个（Kepler+），Fermi 为 63 个 |
| 可见性 | 线程私有 |
| 生命周期 | 随线程 |
| 管理 | 编译器自动分配，不能显式控制 |

> [!warning] 寄存器是稀缺资源
> 寄存器越少 → SM 能驻留的 Block 越多 → 占用率越高 → 性能越好。一个线程用太多寄存器会减少活跃 Warp 数量。

**寄存器溢出（Register Spilling）**：变量太多寄存器不够 → 多出来的放到**本地内存**（实际是全局内存）→ 性能暴跌。

控制寄存器用量的两种方法：

```cpp
// 方法一：__launch_bounds__ 限制每 Block 最大线程数和每 SM 最小 Block 数
__global__ void
__launch_bounds__(maxThreadsPerBlock, minBlocksPerMultiprocessor)
kernel(...) { }

// 方法二：编译选项限制最大寄存器数
nvcc -maxrregcount=32
```

| 参数 | 含义 |
|---|---|
| `maxThreadsPerBlock` | 线程块内包含的最大线程数 |
| `minBlocksPerMultiprocessor` | 每个 SM 预期的最小常驻 Block 数（可选） |

---

### 3.2 本地内存（Local Memory）

"本地"只是逻辑概念，**物理上在全局内存中**，所以很慢。编译器会把以下变量放到本地内存：

- **使用未知索引引用的本地数组**（编译期无法确定索引）
- **较大的本地数组或结构体**（占用大量寄存器空间）
- **不满足核函数寄存器限定条件的变量**

| 属性 | 值 |
|---|---|
| 速度 | 和全局内存一样（~400-800 周期），但有 L1/L2 缓存缓解 |
| 可见性 | 线程私有 |
| 生命周期 | 随线程 |
| 管理 | 编译器自动决定 |

> [!danger] 寄存器溢出是性能杀手
> 本地内存本质上是全局内存，访问延迟 400-800 周期。避免的方法：减少每线程的变量数量、使用 `__launch_bounds__` 或 `-maxrregcount` 限制寄存器用量。

---

### 3.3 共享内存（Shared Memory）

**可编程管理的高速缓存**，Block 内所有线程共享：

```cpp
__shared__ float tile[256];  // 声明共享内存

// 典型用法：把全局内存数据搬到共享内存，再反复使用
tile[threadIdx.x] = global_data[tid];  // 慢：一次全局内存读取
__syncthreads();                        // 等所有人搬完
float v = tile[255 - threadIdx.x];      // 快：共享内存读取
__syncthreads();
```

| 属性 | 值 |
|---|---|
| 速度 | ~30 周期（比全局内存快 10-20 倍） |
| 容量 | 每 Block 最多 48KB（可配置） |
| 可见性 | Block 内所有线程 |
| 生命周期 | 随 Block |
| 管理 | `__shared__` 关键字，程序员显式管理 |
| 物理位置 | 片上（on-chip） |

> [!tip] 共享内存是 CUDA 性能优化的核心
> 把频繁访问的数据从慢的全局内存搬到快的共享内存，就像 CPU 的 L1 缓存，但由程序员控制放什么。

**共享内存过多的问题**：一个 Block 用太多共享内存 → SM 能驻留的 Block 减少 → 活跃 Warp 减少 → 占用率下降。

**同步**：共享内存是 Block 内共享的，存在竞争问题，需要 `__syncthreads()` 同步：

```cpp
void __syncthreads();
```

此语句是线程块内所有线程的障碍点——块内所有线程都执行到此点时才能继续。频繁使用会影响内核执行效率。

**共享内存和 L1 缓存的配置**：两者共享 64KB 片上内存（Fermi 时代），可以配置比例：

```cpp
cudaFuncSetCacheConfig(kernel, cudaFuncCachePreferShared); // 48K shared, 16K L1
cudaFuncSetCacheConfig(kernel, cudaFuncCachePreferL1);     // 48K L1, 16K shared
cudaFuncSetCacheConfig(kernel, cudaFuncCachePreferEqual);  // 32K each
```

| 配置 | 共享内存 | L1 缓存 |
|---|---|---|
| `cudaFuncCachePreferNone` | 默认 | 默认 |
| `cudaFuncCachePreferShared` | 48KB | 16KB |
| `cudaFuncCachePreferL1` | 16KB | 48KB |
| `cudaFuncCachePreferEqual` | 32KB | 32KB |

---

### 3.4 常量内存（Constant Memory）

只读，有专用缓存，所有线程可见：

```cpp
__constant__ float params[256];  // 全局声明（核函数外）

// 主机端初始化
cudaMemcpyToSymbol(params, host_data, size);

// 核函数内读取
float v = params[idx];
```

| 属性 | 值 |
|---|---|
| 速度 | 缓存命中 ~4 周期，未命中 ~400 周期 |
| 容量 | 总共 64KB |
| 可见性 | 所有线程 |
| 生命周期 | 整个程序 |
| 管理 | `__constant__` 关键字，只读 |
| 初始化 | `cudaMemcpyToSymbol`（主机端） |

**广播机制**：

- 一个 Warp 内所有线程读**同一地址** → 1 次读取广播给 32 个线程 → 高效
- 不同线程读**不同地址** → 串行化 → 比全局内存还慢

> [!warning] 常量内存的适用场景
> 只有当所有线程都读同一个值时才高效（如多项式系数）。如果不同线程读不同值，常量内存反而比全局内存更慢。

---

### 3.5 纹理内存（Texture Memory）

只读，有专用缓存，支持硬件插值和特殊寻址：

| 属性 | 值 |
|---|---|
| 速度 | 有缓存，命中时快 |
| 容量 | 受全局内存大小约束 |
| 可见性 | 所有线程 |
| 生命周期 | 整个程序 |
| 管理 | 通过纹理 API，只读 |
| 特殊功能 | 硬件滤波、浮点插值、特殊寻址 |

**适用场景**：图像处理、空间局部性强的访问（相邻线程读相邻坐标）。设计初衷是 GPU 的本职工作——图形显示。

---

### 3.6 全局内存（Global Memory）

最大但最慢，所有线程和主机都可见：

```cpp
// 动态分配
float *dev_data;
cudaMalloc((void**)&dev_data, size);
cudaMemcpy(dev_data, host_data, size, cudaMemcpyHostToDevice);
kernel<<<grid, block>>>(dev_data);
cudaFree(dev_data);

// 静态声明
__device__ float devData;
```

| 属性 | 值 |
|---|---|
| 速度 | ~400-800 周期（有 L2 缓存） |
| 容量 | 显存大小（8GB+） |
| 可见性 | 所有线程 + 主机 |
| 生命周期 | 整个程序（显式 `cudaFree` 才释放） |
| 管理 | `cudaMalloc`/`cudaFree` 或 `__device__` |

**全局内存访问的对齐要求**：一次要读取 32/64/128 字节整数倍的内存。

**影响全局内存效率的两个因素**：

1. **跨线程的内存地址分布**：相邻线程是否访问相邻地址
2. **内存事务的对齐方式**：访问是否对齐到 32/64/128 字节边界

```
事务越多 → 未使用的字节被传输 → 吞吐量下降
```

> [!info] 全局内存是第四章的核心
> 后续会深入讲解如何优化全局内存访问模式（合并访问 vs 非合并访问），最大程度提高吞吐量。

---

## 4. GPU 缓存（不可编程）

| 缓存 | 位置 | 作用 |
|---|---|---|
| L1 缓存 | 每 SM 一个 | 缓存本地内存和全局内存的读取 |
| L2 缓存 | 所有 SM 共享 | 缓存全局内存的读取 |
| 常量缓存 | 每 SM 一个 | 缓存常量内存的读取 |
| 纹理缓存 | 每 SM 一个 | 缓存纹理内存的读取 |

L1/L2 缓存存储本地内存和全局内存中的数据，也包括寄存器溢出的部分。Fermi 之后的设备可以配置读操作使用 L1+L2 还是只用 L2。

> [!danger] GPU 和 CPU 缓存的关键区别
> CPU 读写都能被缓存。**GPU 只有读取会被缓存，写操作不被缓存**——直接写到全局内存。

---

## 5. 静态全局内存

用 `__device__` 静态声明全局变量，不需要 `cudaMalloc`：

```cpp
#include <cuda_runtime.h>
#include <stdio.h>

__device__ float devData;  // 静态全局变量

__global__ void checkGlobalVariable()
{
    printf("Device: The value of the global variable is %f\n", devData);
    devData += 2.0f;  // kernel 可以读写
}

int main()
{
    float value = 3.14f;
    cudaMemcpyToSymbol(devData, &value, sizeof(float));  // 主机写入
    printf("Host: copy %f to the global variable\n", value);

    checkGlobalVariable<<<1, 1>>>();

    cudaMemcpyFromSymbol(&value, devData, sizeof(float));  // 主机读回
    printf("Host: the value changed by the kernel to %f\n", value);

    cudaDeviceReset();
    return EXIT_SUCCESS;
}
```

### 关键注意事项

1. **主机端 `devData` 只是一个标识符，不是地址**
   - 不能直接取地址：`&devData` 是非法的
   - 不能用 `cudaMemcpy` 操作静态变量

2. **必须用 `cudaMemcpyToSymbol`/`cudaMemcpyFromSymbol`**：
   ```cpp
   // ✅ 正确
   cudaMemcpyToSymbol(devData, &value, sizeof(float));
   cudaMemcpyFromSymbol(&value, devData, sizeof(float));

   // ❌ 错误！不能用 cudaMemcpy
   cudaMemcpy(&value, devData, sizeof(float), cudaMemcpyDeviceToHost);
   ```

3. **如果非要用 `cudaMemcpy`，需要先获取地址**：
   ```cpp
   float *dptr = NULL;
   cudaGetSymbolAddress((void**)&dptr, devData);
   cudaMemcpy(dptr, &value, sizeof(float), cudaMemcpyHostToDevice);
   ```

4. **主机代码不能直接访问设备变量，设备也不能访问主机变量**

> [!warning] CUDA 编程与 CPU 多核最大的不同
> 主机端和设备端的变量是隔离的。主机不能直接读写设备变量（必须通过 `cudaMemcpy` 或 `cudaMemcpyToSymbol`），设备也不能访问主机变量。

---

## 6. CUDA 变量声明总结

### 变量声明对照表

| 修饰符 | 变量名称 | 存储器 | 作用域 | 生命周期 |
|---|---|---|---|---|
| `float var` | 普通变量 | 寄存器 | 线程 | 线程 |
| `float var[100]` | 大数组 | 本地内存 | 线程 | 线程 |
| `__shared__ float var` | 共享变量 | 共享内存 | Block | Block |
| `__device__ float var` | 全局变量 | 全局内存 | 全局 | 程序 |
| `__constant__ float var` | 常量变量 | 常量内存 | 全局 | 程序 |

### 设备存储器特征表

| 存储器 | 片上/片外 | 缓存 | 读写 | 范围 | 生命周期 |
|---|---|---|---|---|---|
| 寄存器 | 片上 | 无 | R/W | 线程 | 线程 |
| 本地内存 | 片外 | 有 L1/L2 | R/W | 线程 | 线程 |
| 共享内存 | 片上 | 无 | R/W | Block | Block |
| 全局内存 | 片外 | 有 L2 | R/W | 所有线程+主机 | 程序 |
| 常量内存 | 片外 | 有专用缓存 | 只读 | 所有线程+主机 | 程序 |
| 纹理内存 | 片外 | 有专用缓存 | 只读 | 所有线程+主机 | 程序 |

---

## 📌 速查表

| 问 | 答案要点 |
|---|---|
| CUDA 有几种内存类型 | 6 种：寄存器、本地、共享、常量、纹理、全局 |
| 可编程 vs 不可编程 | 可编程：寄存器/共享/常量/纹理/全局；不可编程：L1/L2 缓存 |
| 哪种最快 | 寄存器（~1 周期） |
| 哪种最大 | 全局内存（显存大小） |
| 寄存器溢出会怎样 | 多出来的变量放到本地内存（全局内存），性能暴跌 |
| 如何控制寄存器用量 | `__launch_bounds__` 或 `-maxrregcount` |
| 共享内存速度 | ~30 周期，比全局内存快 10-20 倍 |
| 共享内存可见性 | Block 内所有线程 |
| 共享内存需要同步吗 | 需要 `__syncthreads()` |
| 常量内存适合什么场景 | 所有线程读同一地址（广播） |
| 常量内存不适合什么场景 | 不同线程读不同地址（串行化，比全局内存还慢） |
| 常量内存上限 | 64KB |
| 纹理内存特点 | 只读、有缓存、硬件插值、空间局部性优化 |
| GPU 缓存和 CPU 缓存的区别 | GPU 只有读取被缓存，写操作不被缓存 |
| 静态全局变量如何初始化 | `cudaMemcpyToSymbol` |
| 能否用 `cudaMemcpy` 操作静态变量 | ❌ 不能，必须用 `cudaMemcpyToSymbol`/`cudaMemcpyFromSymbol` |
| 全局内存效率取决于什么 | 跨线程地址分布 + 内存事务对齐方式 |
| 本地内存物理上在哪里 | 全局内存中 |
