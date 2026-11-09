---
title: Resource Barrier 与资源状态
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - resource-barrier
  - resource-state
  - back-buffer
---


# Resource Barrier 与资源状态

## 为什么 Resource 需要状态

GPU 对同一块图像内存可以执行不同用途的操作，例如显示、渲染写入、复制或供 Shader 读取。不同用途可能需要不同的缓存、内存访问和硬件准备。

D3D12 把资源状态管理交给应用：

```text
应用说明接下来怎样使用 Resource
→ 驱动和 GPU 完成必要的同步与准备
→ 执行对应操作
```

## HelloWindow 的两个状态

当前只需要理解两个状态：

```text
PRESENT
    Back Buffer 准备交给显示系统

RENDER_TARGET
    GPU 可以把它作为渲染目标写入颜色
```

同一张 Back Buffer 在一帧中会经历：

```text
PRESENT
→ RENDER_TARGET
→ 清屏
→ PRESENT
→ Present
```

## Transition Barrier

Transition 类型的 Resource Barrier 描述：

```text
哪一个 Resource
从什么状态
切换到什么状态
```

HelloWindow 清屏前录制：

```text
当前 Back Buffer
PRESENT → RENDER_TARGET
```

因为 `ClearRenderTargetView` 会写入 Back Buffer，所以它必须先进入允许渲染写入的状态。

## Barrier 也是一条 GPU 命令

调用 `ResourceBarrier` 时，CPU 只是把状态转换写入 Command List：

```text
CPU 调用 ResourceBarrier
→ Barrier 被录制
→ ExecuteCommandLists 提交
→ GPU 执行转换
```

因此，录制完 Barrier 不表示资源已经立即完成转换。

## 为什么 D3D12 要显式管理

较高层 API 可以由驱动在后台猜测和跟踪资源用途。D3D12 把责任交给应用，减少隐藏工作，并让多线程录制和 GPU 调度更可预测。

代价是应用必须保证：

- Barrier 的前状态与资源实际状态一致。
- 在某种用途前切换到合法状态。
- 呈现 Back Buffer 前切回 PRESENT。

## 当前帧的前半段

```text
Reset Allocator
→ Reset Command List
→ Command List 进入 Recording
→ 录制 PRESENT 到 RENDER_TARGET 的 Barrier
→ 准备选择对应 RTV 并清屏
```

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/11-重置Command Allocator与Command List.md|重置 Command Allocator 与 Command List]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/13-选择RTV、清屏与结束录制.md|选择 RTV、清屏与结束录制]]

