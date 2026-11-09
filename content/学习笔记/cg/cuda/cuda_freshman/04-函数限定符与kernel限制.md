---
title: 04 函数限定符与 Kernel 限制
publish: true
updated: 2026-07-30T00:00:00.000Z
tags:
  - CUDA
  - 函数限定符
  - kernel
  - 异步执行
aliases:
  - CUDA函数限定符
  - global device host
  - kernel限制
date: 2026-07-30
---


# 04 函数限定符与 Kernel 限制

> CUDA 在 C 语言基础上加了三个函数限定符，决定函数在哪里执行、谁能调用。Kernel 函数本身也有若干限制。
> 关联：[[学习笔记/cg/cuda/cuda_freshman/01-hello-world与线程层级.md|01 Hello World 与 CUDA 线程层级]]

---

## 1. 三个函数限定符

| 限定符 | 执行方 | 谁能调用 | 备注 |
|---|---|---|---|
| `__global__` | GPU | CPU（或 GPU，需算力 ≥ 3.0） | 就是 kernel 函数，返回值必须 `void` |
| `__device__` | GPU | GPU | 只能在核函数内部被调用，CPU 看不见 |
| `__host__` | CPU | CPU | 就是普通 C 函数，写不写都一样 |

- `__global__`：由 CPU 通过 `<<<>>>` 语法启动，在 GPU 上执行
- `__device__`：GPU 内部的辅助函数，供其他 `__global__` 或 `__device__` 函数调用
- `__host__`：普通 C 函数，`nvcc` 不加任何限定符时默认就是 `__host__`

### `__device__` 和 `__host__` 可以同时用

```cpp
// 同时编译成 CPU 和 GPU 两份机器码
__device__ __host__ int add(int a, int b) {
    return a + b;
}
```

这样 CPU 和 GPU 都能调用同一个函数。编译器 `nvcc` 会生成**两份**机器码：一份给 CPU，一份给 GPU。不加限定符的普通函数只生成 CPU 机器码，GPU 核函数里调用会编译报错。

---

## 2. Kernel 函数的限制

| 限制 | 说明 |
|---|---|
| 只能访问设备内存 | 不能访问 `malloc` 分配的主机内存，只能用 `cudaMalloc` 分配的设备指针 |
| 必须 `void` 返回 | kernel 是异步启动的，调用方拿不到返回值 |
| 不支持可变参数 | 不能用 `...`（如 `printf("...", args...)`） |
| 不支持静态变量 | 不能在 kernel 内用 `static` 变量 |
| 显式异步行为 | `<<<>>>` 启动后 CPU 不等它，立刻继续往下走 |

### 逐条解释

**只能访问设备内存**：kernel 跑在 GPU 上，GPU 只能直接访问自己的显存。传给 kernel 的指针必须是 `cudaMalloc` 分配的设备指针，传主机指针会段错误。

**必须 `void` 返回**：`kernel<<<>>>()` 只是把任务提交给 GPU，CPU 马上继续执行下一行。GPU 执行完的时候，CPU 早就不知道跑到哪了——返回值给谁？所以不允许有返回值。结果必须写到设备内存里，再 `cudaMemcpy` 拷回来。

**不支持可变参数**：GPU 上没有 C 的 `va_list` 机制，不能写 `int sum(int n, ...)` 这种。

**不支持静态变量**：`static` 变量在 CPU 程序里是全局存储。但 GPU 上成千上万个线程同时执行一个 kernel，如果允许 `static`，所有线程共享还是各有一份？语义混乱，直接禁止。

**显式异步行为**：最重要的特性。CPU 调用 `kernel<<<>>>()` 后**不会等待**，立刻执行下一行。需要等结果时必须显式同步。

```cpp
kernel<<<grid, block>>>(a_d, b_d, res_d);  // 提交任务，CPU 立刻继续
// 此时 GPU 可能还没开始执行
cudaMemcpy(res_h, res_d, ...);  // 这一步会等 GPU 执行完
```

> [!info] `cudaDeviceSynchronize()` vs `cudaDeviceReset()`
> - `cudaDeviceSynchronize()` — 阻塞 CPU 等 GPU 干完，上下文保留，之后还能继续用 GPU
> - `cudaDeviceReset()` — 阻塞 CPU 等 GPU 干完，然后**销毁整个 CUDA 上下文**，释放该设备上的所有资源
> - hello_world 里用 `cudaDeviceReset()` 是因为程序马上 `return 0` 了，顺便清理
> - 实际开发中 `cudaDeviceSynchronize()` 更常用——只是等结果，不想销毁设备

---

## 📌 速查表

| 问 | 答案要点 |
|---|---|
| `__global__` | GPU 执行、CPU 调用，就是 kernel，必须返回 `void` |
| `__device__` | GPU 执行、GPU 调用，CPU 看不见 |
| `__host__` | CPU 执行、CPU 调用，普通 C 函数，可省略 |
| `__device__ __host__` 同时用 | nvcc 生成两份机器码，CPU 和 GPU 都能调用 |
| kernel 能否访问主机内存 | ❌ 只能访问设备内存 |
| kernel 返回类型 | 必须 `void` |
| kernel 能否用可变参数 | ❌ 不支持 |
| kernel 能否用 static 变量 | ❌ 不支持 |
| kernel 调用是否同步 | ❌ 异步，CPU 不等待 |
| 如何等待 GPU 完成 | `cudaDeviceSynchronize()` 或 `cudaMemcpy`（会隐式同步） |
