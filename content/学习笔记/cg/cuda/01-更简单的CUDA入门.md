---
title: CUDA 入门：更简单的介绍（更新版）
publish: true
updated: 2026-07-22T20:07:12.360Z
---

# CUDA 入门：更简单的介绍（更新版）

> **来源**：NVIDIA Developer Blog — [An Even Easier Introduction to CUDA](https://developer.nvidia.cn/blog/even-easier-introduction-cuda-2/)
> **作者**：Mark Harris（NVIDIA 首席科学家）
> **初版**：2017-01-25，**更新**：2025-05
> **整理**：2026-07-23，修正了官方中文版的机翻乱码（`tg_44` 等），代码块还原为可运行版本

---

## 这篇讲什么

用一个「百万元素数组相加」的例子，一步步把 C++ 程序搬上 GPU：

```
C++ 单线程版  →  CUDA 单线程版  →  一个 block 多线程  →  多个 block（grid）  →  预取显存优化
```

最终在 NVIDIA T4 上拿到 **1932× 加速、265 GB/s 带宽**。

前置条件：一台带 NVIDIA GPU 的机器（Win/WSL/Linux）、装好 [CUDA Toolkit](https://developer.nvidia.cn/cuda-toolkit)。

---

## 1. 从简单开始：纯 C++ 版本

先写一个普通的 C++ 程序，把两个长度 100 万（`1<<20`）的数组对应相加。

```cpp
// add.cpp
#include <iostream>
#include <math.h>

void add(int n, float *x, float *y)
{
    for (int i = 0; i < n; i++)
        y[i] = x[i] + y[i];
}

int main(void)
{
    int N = 1 << 20;                       // 1M 个元素
    float *x = new float[N];
    float *y = new float[N];

    for (int i = 0; i < N; i++) {
        x[i] = 1.0f;
        y[i] = 2.0f;
    }

    add(N, x, y);

    float maxError = 0.0f;
    for (int i = 0; i < N; i++)
        maxError = fmax(maxError, fabs(y[i] - 3.0f));
    std::cout << "Max error: " << maxError << std::endl;

    delete[] x;
    delete[] y;
    return 0;
}
```

编译运行：

```bash
g++ add.cpp -o add
./add
# Max error: 0.000000
```

现在我想把这个计算挪到 GPU 的多个核心上并行跑。第一步其实非常简单。

---

## 2. 写第一个 CUDA kernel

把 `add` 函数变成 GPU 能跑的 **kernel（内核函数）**，只需加一个 `__global__` 说明符，告诉 nvcc 编译器：「这是个在 GPU 上跑、可以从 CPU 调用的函数」。

```cpp
__global__
void add(int n, float *sum, float *x, float *y)
{
    for (int i = 0; i < n; i++)
        sum[i] = x[i] + y[i];
}
```

> **术语**
> - `__global__` function = **CUDA 内核**，运行在 GPU 上
> - 运行在 GPU 上的代码 = **设备代码（device code）**
> - 运行在 CPU 上的代码 = **主机代码（host code）**

### 显存分配：Unified Memory

要在 GPU 上算，就得分配 GPU 能访问的内存。[Unified Memory（统一内存）](https://developer.nvidia.cn/zh-cn/blog/unified-memory-in-cuda-6/)给 CPU 和 GPU 提供一个单一的内存空间，用 `cudaMallocManaged()` 分配，用 `cudaFree()` 释放——可以理解为「CPU 和 GPU 都能直接访问的指针」。

把 `new` 换成 `cudaMallocManaged`，把 `delete[]` 换成 `cudaFree`：

```cpp
float *x, *y;
cudaMallocManaged(&x, N * sizeof(float));
cudaMallocManaged(&y, N * sizeof(float));
// ...
cudaFree(x);
cudaFree(y);
```

### 启动 kernel：三重尖括号 `<<<>>>`

CUDA 用 `<<<>>>` 语法指定执行配置来启动 kernel：

```cpp
add<<<1, 1>>>(N, x, y);
```

现在只要知道：这一行启动了 **1 个 GPU 线程**来跑 `add()`。尖括号里的含义后面细讲。

还有一件事：CUDA kernel 启动**不会阻塞** CPU 线程，所以 CPU 访问结果前要调 `cudaDeviceSynchronize()` 等它跑完。

### 完整的 `add.cu`

```cpp
// add.cu
#include <iostream>
#include <math.h>

__global__
void add(int n, float *x, float *y)
{
    for (int i = 0; i < n; i++)
        y[i] = x[i] + y[i];
}

int main(void)
{
    int N = 1 << 20;
    float *x, *y;
    cudaMallocManaged(&x, N * sizeof(float));
    cudaMallocManaged(&y, N * sizeof(float));

    for (int i = 0; i < N; i++) {
        x[i] = 1.0f;
        y[i] = 2.0f;
    }

    add<<<1, 1>>>(N, x, y);          // 启动 kernel
    cudaDeviceSynchronize();          // 等 GPU 跑完

    float maxError = 0.0f;
    for (int i = 0; i < N; i++) {
        maxError = fmax(maxError, fabs(y[i] - 3.0f));
    }
    std::cout << "Max error: " << maxError << std::endl;

    cudaFree(x);
    cudaFree(y);
    return 0;
}
```

CUDA 源文件后缀是 `.cu`，用 `nvcc` 编译：

```bash
nvcc add.cu -o add_cuda
./add_cuda
# Max error: 0.000000
```

但这只是第一步——目前 kernel 只有 **1 个线程**在跑整个循环，而且多线程时会有读写同一位置的 race condition（后面解决）。

> Windows 注意：MSVC 项目属性里要把 Platform 设成 x64。

---

## 3. 用 Nsight Systems 分析耗时

用 `nsys`（Nsight Systems CLI）测内核耗时。作者写了个精简输出脚本 `nsys_easy`（[GitHub](https://github.com/harrism/nsys_easy)）：

```bash
nsys_easy ./add_cuda
```

输出（T4 GPU）：

```
Time (%)  Total Time (ns)  Count  Category     Operation
--------  ---------------  -----  -----------  ------------------------
98.5      75,403,544       1      CUDA_KERNEL  add(int, float*, float*)
1.0       768,480          48     MEMORY_OPER  [memcpy Unified H2D]
0.5       352,787          24     MEMORY_OPER  [memcpy Unified D2D]
```

单线程跑 `add` 大约 **75 ms**。下面开始提速。

---

## 4. 拿到多个线程：一个 block

并行的钥匙就在 `<<<1, 1>>>` 这个**执行配置**里。第二个参数 = 一个线程块（block）里的线程数。CUDA GPU 以 block（大小为 32 的倍数）为单位跑 kernel，256 是常见选择：

```cpp
add<<<1, 256>>>(N, x, y);
```

但光改启动参数，会让每个线程都跑一遍整个数组——还得改 kernel，让每个线程负责不同的部分。CUDA 提供：
- `threadIdx.x`：当前线程在 block 内的索引
- `blockDim.x`：block 内线程总数

用 **grid-stride 循环**让并行线程在数组上「跨步」推进：

```cpp
__global__
void add(int n, float *x, float *y)
{
    int index = threadIdx.x;
    int stride = blockDim.x;
    for (int i = index; i < n; i += stride)
        y[i] = x[i] + y[i];
}
```

> 把 `index=0, stride=1` 代回去，语义上就和最初的串行版完全一样。

存为 `add_block.cu`，编译运行：

```
Time (%)  Time (ns)    Count  Category     Operation
--------  -----------  -----  -----------  ------------------------
79.0      4,221,011    1      CUDA_KERNEL  add(int, float*, float*)
```

**75ms → 4ms**，因为从 1 个线程扩展到了 256 个。继续。

---

## 5. 突破 block 限制：多个 block 组成 grid

GPU 有很多并行处理器，分成若干 **Streaming Multiprocessor（SM，流多处理器）**。每个 SM 能同时跑多个 block，但一个 block 只在一个 SM 上跑。例如 T4（Turing 架构）有 **40 个 SM、2560 个 CUDA 核心**，每个 SM 最多 1024 个活跃线程。要榨干这些线程，得启动**多个 block**。

执行配置的第一个参数就是 block 数量。所有并行 block 合起来叫一个 **grid**。N 个元素、每 block 256 线程，block 数向上取整：

```cpp
int blockSize = 256;
int numBlocks = (N + blockSize - 1) / blockSize;   // 向上取整
add<<<numBlocks, blockSize>>>(N, x, y);
```

kernel 也要改成考虑整个 grid。CUDA 提供：
- `gridDim.x`：grid 里的 block 总数
- `blockIdx.x`：当前 block 在 grid 里的索引

![图1. Grid / Block / Thread 索引（一维）](https://developer-blogs.nvidia.com/wp-content/uploads/2017/01/Even-easier-intro-to-CUDA-image.png)
*图 1. CUDA 内核中 Grid、Block、Thread 的一维索引*

每个线程算出自己的全局索引：**块起点偏移 + 块内线程索引**，这就是 CUDA 最经典的惯用法：

```cpp
int index = blockIdx.x * blockDim.x + threadIdx.x;
```

完整 kernel：

```cpp
// add_grid.cu 的 kernel
__global__
void add(int n, float *x, float *y)
{
    int index  = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = blockDim.x * gridDim.x;     // grid 里线程总数
    for (int i = index; i < n; i += stride)
        y[i] = x[i] + y[i];
}
```

> stride 现在是整个 grid 的线程总数，这种循环叫 [**grid-stride loop**](https://developer.nvidia.cn/zh-cn/blog/cuda-pro-tip-write-flexible-kernels-grid-stride-loops/)。

存为 `add_grid.cu` 编译运行：

```
Time (%)  Time (ns)    Count  Category     Operation
--------  -----------  -----  -----------  ----------------------------
79.6      4,514,384    1      CUDA_KERNEL  add(int, float*, float*)
```

**奇怪——加了 40 倍线程（40 个 SM），耗时几乎没变甚至略慢。** 为什么？如果计算量翻 40 倍都不省时间，说明**瓶颈不在计算**。

---

## 6. 找到真瓶颈：统一内存预取

看完整 summary 表就明白了：

```
Time (%)  Time (ns)    Count  Category     Operation
--------  -----------  ------  -----------  ------------------------
79.6      4,514,384    1       CUDA_KERNEL  add(int, float*, float*)
14.2      807,245      64      MEMORY_OPER  [CUDA memcpy Unified H2D]
6.2       353,201      24      MEMORY_OPER  [CUDA memcpy Unified D2H]
```

代码里明明没有 `memcpy` 调用，却有 64 次 H2D 和 24 次 D2H 拷贝。原因是：**Unified Memory 是虚拟内存**，单个页面可能驻留在 GPU 或 CPU 任意一端，按需迁移。程序先在 CPU 上初始化数组，kernel 启动时所有页面都在 CPU 端，于是 GPU 访问时触发大量 **page fault（缺页）**，硬件再把页面一个个搬到 GPU——这就是内存瓶颈。

**解决办法：预取（prefetch）。** 既然我知道 kernel 要用 x 和 y，就在启动 kernel 前用 `cudaMemPrefetchAsync()` 把数据提前搬到 GPU：

```cpp
cudaMemPrefetchAsync(x, N * sizeof(float), 0, 0);
cudaMemPrefetchAsync(y, N * sizeof(float), 0, 0);
```

再跑分析器，**kernel 只要不到 50 微秒**：

```
Time (%)  Time (ns)   Count  Category     Operation
--------  ----------  -----  -----------  ------------------------
63.2      690,043     4      MEMORY_OPER  [CUDA memcpy Unified H2D]
32.4      353,647     24     MEMORY_OPER  [CUDA memcpy Unified D2H]
4.4       47,520      1      CUDA_KERNEL  add(int, float*, float*)
```

---

## 7. 总结：三个版本性能对比

把 prefetch 加到全部三个版本，汇总（T4 GPU）：

| 版本 | 耗时 | 相对单线程加速 | 带宽 |
|------|------|:--------------:|-----|
| 单线程（1 thread） | 91,811,206 ns ≈ 91.8 ms | 1× | 137 MB/s |
| 单 block（256 threads） | 2,049,034 ns ≈ 2.0 ms | 45× | 6 GB/s |
| 多 block（grid） | 47,520 ns ≈ 47.5 μs | **1932×** | **265 GB/s** |

数据进显存后，从单 block 到多 block 的加速 ≈ SM 数量（40）。265 GB/s 是 T4 峰值带宽（320 GB/s）的 80% 以上——这个加法 kernel 已经是**带宽受限（memory-bound）**的了。

> GPU 除了带宽，在「计算密集型」任务上更猛：稠密矩阵线性代数、深度学习、图像/信号处理、物理模拟等。

---

## 8. 关键概念速查（C++ 视角）

| CUDA 概念 | C++ 类比 / 说明 |
|-----------|-----------------|
| `__global__` | 标记函数为 GPU kernel，从 CPU 调用、在 GPU 执行 |
| `<<<numBlocks, blockSize>>>` | 启动配置：开多少个 block、每 block 多少线程 |
| `threadIdx.x` | 当前线程在 block 内的编号 |
| `blockDim.x` | 一个 block 的线程数 |
| `blockIdx.x` | 当前 block 在 grid 内的编号 |
| `gridDim.x` | grid 里 block 总数 |
| `blockIdx.x*blockDim.x + threadIdx.x` | 全局线程索引（最常用惯用法） |
| `cudaMallocManaged / cudaFree` | 统一内存的 new / delete |
| `cudaDeviceSynchronize()` | 等 GPU 跑完（kernel 启动是异步的） |
| `cudaMemPrefetchAsync` | 预取数据到 GPU，避免运行时缺页迁移 |
| grid-stride loop | 用 `stride = blockDim.x * gridDim.x` 让线程跨数组推进 |

**心智模型一句话**：把 C++ 的 `for` 循环，拆给成千上万个线程各跑一段，每个线程用 `blockIdx*blockDim+threadIdx` 算出自己负责哪一份。

---

## 9. 练习（作者留的作业）

1. 浏览 [CUDA Toolkit 文档](http://docs.nvidia.com/cuda/index.html)：[快速入门](http://docs.nvidia.com/cuda/cuda-quick-start-guide/index.html)、[编程指南](http://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html)、[最佳实践指南](http://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html)。
2. 在 kernel 里试 `printf()`，打印部分或全部线程的 `threadIdx.x` 和 `blockIdx.x`。它们的打印顺序有序吗？为什么？
3. 打印 `threadIdx.y / threadIdx.z`（`blockDim / gridDim` 同理）。它们为何存在？怎样让它们取非 0 值（即 dim > 1）？

---

## 10. 延伸阅读（NVIDIA 博客系列）

- [如何在 CUDA C++ 中实现 Performance Metrics](https://developer.nvidia.cn/zh-cn/blog/how-implement-performance-metrics-cuda-cc/)
- [如何查询设备属性并处理错误](https://developer.nvidia.cn/zh-cn/blog/how-query-device-properties-and-handle-errors-cuda-cc/)
- [如何优化数据传输](https://developer.nvidia.cn/zh-cn/blog/how-optimize-data-transfers-cuda-cc/)
- [如何重叠数据传输](https://developer.nvidia.cn/zh-cn/blog/how-overlap-data-transfers-cuda-cc/)
- [如何高效访问 Global Memory](https://developer.nvidia.cn/zh-cn/blog/how-access-global-memory-efficiently-cuda-c-kernels/)
- 在 CUDA C++ 中使用 Shared Memory
- [高效的矩阵转置](https://developer.nvidia.cn/zh-cn/blog/efficient-matrix-transpose-cuda-cc/)
- Finite Difference Methods 第 1 / 第 2 部分
- 🔥 **[借助 CUDA 在一个周末加速 Ray Tracing](https://developer.nvidia.cn/zh-cn/blog/accelerated-ray-tracing-cuda/)** ← 联动我的 `Ray-Tracing-in-One-Weekend` 项目
