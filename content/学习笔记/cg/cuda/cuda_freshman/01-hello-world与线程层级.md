---
title: 01 Hello World 与 CUDA 线程层级
publish: true
updated: 2026-07-29T00:00:00.000Z
tags:
  - CUDA
  - 线程模型
  - hello_world
aliases:
  - CUDA线程层级
  - Block与Grid
  - cudaDeviceReset
date: 2026-07-29
---


# 01 Hello World 与 CUDA 线程层级

> 从最简单的 `hello_world.cu` 出发，理解 CUDA 的线程组织结构和 GPU 异步执行特性。
> 关联：02-检查设备维度

---

## 0. 源码速览

```cpp
#include <stdio.h>

// __global__ 修饰符表示该函数由 CPU 调用、在 GPU 上执行（即 kernel 函数）
__global__ void hello_world(void)
{
  // kernel 内的 printf 由每个 GPU 线程各自执行
  printf("GPU: Hello world!\n");
}

int main(int argc, char **argv)
{
  printf("CPU: Hello world!\n");

  // <<<gridDim, blockDim>>> 配置 kernel 启动参数
  // 1 个 block，每 block 10 个线程 → 共启动 10 个 GPU 线程
  hello_world<<<1, 10>>>();

  // cudaDeviceReset 销毁当前设备上的所有 CUDA 上下文
  // GPU 的 printf 输出是异步的，需要在此处同步刷新才能在终端看到结果
  cudaDeviceReset();
  return 0;
}
```

运行结果：CPU 输出 1 次，GPU 输出 10 次。

---

## 1. 线程三层级：Grid → Block → Thread

CUDA 的线程组织结构是三层层级：

```
Grid（网格）
 └── Block（线程块）
      └── Thread（线程）
```

**Grid** 是一次 kernel 启动的全部线程集合，里面包含若干 **Block**，每个 Block 里又包含若干 **Thread**。

### `<<<gridDim, blockDim>>>` 参数解读

| 参数位置 | 含义 | 示例 `<<<1, 10>>>` |
|---|---|---|
| 第一个参数 | Grid 里有几个 **Block** | `1` 个 Block |
| 第二个参数 | 每个 Block 里有几个 **Thread** | `10` 个 Thread |

所以 `<<<1, 10>>>` 表示：1 个 Block × 10 个 Thread = **总共 10 个 GPU 线程**，每个线程都会执行一遍 `hello_world()` 里的 `printf`。

如果写 `<<<2, 10>>>`，那就是 2 × 10 = 20 个线程，`printf` 会输出 20 次。

> [!tip] Block 是 GPU 调度的基本单位
> - 同一个 Block 内的线程**共享共享内存**（shared memory）
> - 同一个 Block 内的线程可以通过 `__syncthreads()` **同步**
> - **不同 Block 之间不能同步**，也不能共享 shared memory

> [!info] 还有第三个参数
> `<<<gridDim, blockDim, sharedMem>>>
> 第三个参数（可选）指定每个 Block 动态分配的 shared memory 大小（字节），默认为 0。后续示例会用到。

---

## 2. `cudaDeviceReset()` —— 为什么不加就看不到输出？

> [!warning] 关键点：GPU 上的 `printf` 不会立即输出

CPU 上的 `printf` 是**同步**的——调用完马上就能在屏幕上看到。但 GPU 上的 `printf` 是**异步**的：

1. CPU 调用 `hello_world<<<1,10>>>()` 后，只是把任务**提交**给 GPU，CPU 马上继续执行下一行
2. GPU 真正执行 `printf` 的时间点是不确定的，可能还没来得及执行
3. CPU 马上就 `return 0` 了，程序结束，GPU 的输出被丢弃

`cudaDeviceReset()` 的作用是：**销毁当前设备的 CUDA 上下文**，这会强制 GPU 把所有还没完成的工作执行完并刷新输出。

> [!abstract] 类比
> CPU 那边程序已经准备关门走人了，`cudaDeviceReset()` 就是喊一声"等等，GPU 那边的活还没干完，等它弄完再走"。

> [!question] 不加 `cudaDeviceReset()` 会怎样？
> 程序结束时 GPU 的 `printf` 还没刷新，终端上看不到 "GPU: Hello world!" 这行输出。`cudaDeviceSynchronize()` 也能达到类似效果（只同步不销毁上下文），但本示例用的是 `cudaDeviceReset()`。

---

## 3. `__global__` 修饰符

| 修饰符 | 调用方 | 执行方 | 说明 |
|---|---|---|---|
| `__global__` | CPU | GPU | kernel 函数，必须返回 `void` |
| `__device__` | GPU | GPU | 只能在 GPU 内部调用 |
| `__host__` | CPU | CPU | 普通函数（默认） |

`__global__` 表示该函数是一个 **kernel**：由 CPU 调用、在 GPU 上执行。每个被启动的线程都会执行一遍该函数体。

---

## 📌 速查表

| 问 | 答案要点 |
|---|---|
| 线程三层级 | Grid → Block → Thread |
| `<<<gridDim, blockDim>>>` | gridDim = Block 数量，blockDim = 每 Block 的 Thread 数 |
| 总线程数 | gridDim × blockDim |
| Block 内可共享 | shared memory + `__syncthreads()` 同步 |
| Block 间能否同步 | ❌ 不能 |
| `cudaDeviceReset()` | 销毁 CUDA 上下文，强制刷新 GPU 异步输出 |
| GPU `printf` 特性 | 异步，需同步刷新才能看到输出 |
| `__global__` | CPU 调用、GPU 执行的 kernel 函数 |
