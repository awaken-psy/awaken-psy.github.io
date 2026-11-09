---
title: Fence 与 GPU 进度
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - fence
  - synchronization
  - cpu-gpu
---


# Fence 与 GPU 进度

## 为什么需要 Fence

CPU 向 Command Queue 提交工作后，提交函数可以很快返回，而 GPU 可能仍在执行。

```text
CPU：命令已经提交
GPU：命令不一定已经完成
```

因此，CPU 不能仅凭“提交函数返回”判断某个 GPU Resource 或 Command Allocator 已经可以安全复用。

Fence 为 CPU 和 GPU 提供一个双方都能观察的进度数字。

## Fence 是时间线上的里程碑

可以把一条 Command Queue 想成一条时间线：

```text
GPU 工作 A
→ Fence = 1
→ GPU 工作 B
→ Fence = 2
```

当 Fence 的已完成值到达 1，表示排在这次 Signal 之前的队列工作已经完成。

Fence 不会自动理解“第几帧”。数值的含义和递增方式由应用自己规定。

## HelloWindow 的初始值

初始化时创建 Fence，并设置：

```text
Fence 当前完成值 = 0
m_fenceValue      = 1
```

这两个值含义不同：

- Fence 的 0 是 GPU 当前公开的完成进度。
- `m_fenceValue` 的 1 是 CPU 准备在下一次 Signal 中使用的里程碑编号。

仅给 `m_fenceValue` 赋值不会改变 Fence，也不会让 GPU 执行任何工作。

## 后续同步的基本过程

```text
CPU 提交 Command List
→ 在 Queue 上安排 Signal(Fence, 1)
→ GPU 执行前面的工作
→ GPU 到达 Signal 点
→ Fence 完成值变为 1
→ CPU 得知此前工作已经完成
```

如果 CPU 检查时 Fence 还没有到目标值，就需要等待。HelloWindow 使用 Windows Event 实现高效等待，这部分放在下一篇。

## Fence 与 Command Allocator

Fence 的一个直接用途是保护 Command Allocator：

```text
GPU 尚未完成相关命令
→ 不能 Reset Allocator

Fence 到达对应值
→ 可以安全 Reset 并复用
```

HelloWindow 每帧都等待 GPU，逻辑简单但会牺牲 CPU/GPU 并行度。更完整的多帧模型由 `HelloFrameBuffering` 展示。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/07-Command List的创建与状态.md|Command List 的创建与状态]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/09-Windows Event与CPU等待.md|Windows Event 与 CPU 等待]]

