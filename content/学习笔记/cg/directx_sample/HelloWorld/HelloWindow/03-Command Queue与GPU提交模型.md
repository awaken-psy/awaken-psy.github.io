---
title: Command Queue 与 GPU 提交模型
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - command-queue
  - cpu-gpu
---


# Command Queue 与 GPU 提交模型

## 为什么需要队列

CPU 和 GPU 是两个独立工作的处理器。CPU 调用 D3D12 函数时，通常不是让 GPU 当场完成工作，而是先准备命令，再统一提交。

```text
CPU 录制 Command List
→ 提交到 Command Queue
→ GPU 按队列顺序执行
```

这种显式提交模型给程序更强的调度能力，也意味着程序需要主动管理资源状态和同步。

## Queue、List、Allocator 的分工

```text
Command List
    描述这一批要执行的命令

Command Allocator
    提供录制命令所需的内部存储

Command Queue
    接收录制完成的 Command List，并交给 GPU 执行
```

可以把它们类比为：

```text
Command List      = 订单内容
Command Allocator = 记录订单所用的纸张
Command Queue     = 厨房收到的订单队列
GPU               = 执行订单的厨师
```

## DIRECT Queue

HelloWindow 创建 `DIRECT` 类型的 Queue。它是通用图形队列，可以承接绘制、计算和资源复制类命令。

当前阶段只创建了队列，队列仍然为空。真正提交发生在后面的 `ExecuteCommandLists`。

## 与 Swap Chain 的联系

D3D12 创建窗口 Swap Chain 时传入的是 DIRECT Command Queue。DXGI 因而知道窗口图像的工作来自哪条 GPU 队列，可以让呈现与这条队列上的渲染工作保持正确关系。

## 核心认识

- 调用录制函数不等于 GPU 已经执行。
- Queue 是 CPU 与 GPU 之间的工作提交通道。
- 同一条 Queue 上的提交顺序具有明确意义。
- 是否执行完成不能靠猜，需要 Fence 来确认。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/02-DXGI、Adapter与Device.md|DXGI、Adapter 与 Device]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/04-Swap Chain与双缓冲.md|Swap Chain 与双缓冲]]

