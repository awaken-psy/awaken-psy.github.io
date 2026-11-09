---
title: 05 CPU 计时方法
publish: true
updated: 2026-07-30T00:00:00.000Z
tags:
  - CUDA
  - 计时
  - wall-clock
  - clock
aliases:
  - CUDA计时方法
  - clock vs wall clock
  - cpuSecond
date: 2026-07-30
---


# 05 CPU 计时方法

> C 语言中最常用的 `clock()` 计时方式在并行程序中存在严重问题。CUDA 中应使用墙上时间（wall clock time）来计时。
> 关联：[[学习笔记/cg/cuda/cuda_freshman/03-显存分配与浮点误差.md|03 显存分配与浮点误差]]

---

## 1. C 语言经典的 `clock()` 计时

```cpp
clock_t start, finish;
start = clock();
// 要测试的部分
finish = clock();
double duration = (double)(finish - start) / CLOCKS_PER_SEC;
```

- `clock()` 测出来的是**进程运行时间**，单位为滴答数（ticks）
- `CLOCKS_PER_SEC` 是每秒钟的 ticks 数，不同系统值可能不同
- 两个 `clock()` 值相减再除以 `CLOCKS_PER_SEC`，得到秒数

---

## 2. `clock()` 的工作原理

`clock()` 统计的是**进程消耗的 CPU 时间**，不是墙上时间（wall clock time）。

关键在于"CPU 时间"怎么算——它会把**所有线程的执行时间累加**。

### 串行程序：没问题

```
1 个线程跑 3 秒
clock() → 3 秒的 ticks
```

CPU 时间 = 墙上时间 = 3 秒。结果正确。

### 并行程序：严重错误

假设 4 线程并行跑 3 秒：

```
线程1: ████████████████ 3 秒
线程2: ████████████████ 3 秒
线程3: ████████████████ 3 秒
线程4: ████████████████ 3 秒
clock() → 12 秒的 ticks    ← 4 个线程的 CPU 时间被累加了
```

实际上只过了 3 秒，`clock()` 却返回 12 秒。线程越多，误差越大。

> [!abstract] 类比
> 你派了 4 个人去搬砖，每人搬了 3 小时。`clock()` 问的是"你们 4 个一共干了多少小时" = 12 小时。但你实际等的时间只有 3 小时。

---

## 3. 正确做法：墙上时间

并行程序计时要用**墙上时间**（wall clock time），也就是现实世界经过的时间：

```cpp
// freshman.h 中的 cpuSecond() 实现
double cpuSecond()
{
  struct timeval tp;
  gettimeofday(&tp, NULL);
  return (double)tp.tv_sec + (double)tp.tv_usec * 1e-6;
}
```

`gettimeofday` 返回的是系统当前时间戳（墙上时间），不管开了几个线程，时间该怎么走就怎么走。

### CUDA 计时模板

```cpp
double t0 = cpuSecond();
kernel<<<grid, block>>>();
cudaDeviceSynchronize();       // 关键：等 GPU 干完
double dt = cpuSecond() - t0;   // 真实经过的秒数
```

> [!warning] 必须加 `cudaDeviceSynchronize()`
> Kernel 启动是异步的，不加同步的话 `cpuSecond() - t0` 测的是"提交任务"的时间，不是"执行任务"的时间。

---

## 4. CPU 计时的固有误差

用 CPU 端的 `cpuSecond()` 测 CUDA kernel，存在**不可避免的测量误差**。核函数从启动到结束的完整过程：

```
① 主机线程启动核函数
② 核函数启动成功
③ 控制返回主机线程
④ 核函数执行完成
⑤ 主机同步函数侦测到核函数执行完
```

我们真正想测的是 **②→④**（kernel 实际执行时间），但 CPU 计时测的是 **①→⑤**，多出来的部分：

- **①→②**：CPU 提交 kernel 的开销（配置参数、入队等）
- **③→④**：CPU 已经返回，但 GPU 还没开始或刚开始执行
- **④→⑤**：同步函数轮询侦测完成的开销

所以 CPU 计时测出来的时间总是**偏长**。

```
CPU 测到的时间 = kernel 实际执行时间 + 启动开销 + 同步开销
```

> [!tip] 如何更精确地测量 kernel 执行时间？
> 使用 CUDA Event API，它直接在 GPU 端打时间戳，不受 CPU 同步延迟影响：
> ```cpp
> cudaEvent_t start, stop;
> cudaEventCreate(&start);
> cudaEventCreate(&stop);
> cudaEventRecord(start);          // GPU 端记录起点
> kernel<<<grid, block>>>();
> cudaEventRecord(stop);           // GPU 端记录终点
> cudaEventSynchronize(stop);      // CPU 等待 stop 被记录
> float ms;
> cudaEventElapsedTime(&ms, start, stop);  // 毫秒
> ```
> 后续示例会用到这种方法。

---

## 📌 速查表

| 问 | 答案要点 |
|---|---|
| `clock()` 测的是什么 | 进程的 CPU 时间（所有线程累加） |
| `clock()` 串行程序 | CPU 时间 = 墙上时间，结果正确 |
| `clock()` 并行程序 | 线程数 × 单线程时间，严重偏大 |
| `CLOCKS_PER_SEC` | 每秒的 ticks 数，平台相关 |
| 并行程序应该用什么计时 | 墙上时间（wall clock time） |
| CUDA 计时关键步骤 | `cpuSecond()` → kernel → `cudaDeviceSynchronize()` → `cpuSecond()` |
| 为什么必须 `cudaDeviceSynchronize()` | kernel 是异步的，不加同步测的是提交时间而非执行时间 |
| CPU 计时测的是哪个区间 | ①→⑤（启动→同步侦测到完成），比实际 kernel 执行时间 ②→④ 偏长 |
| 更精确的计时方法 | CUDA Event API，在 GPU 端打时间戳 |
