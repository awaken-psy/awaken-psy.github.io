---
title: 提交、呈现与 WaitForPreviousFrame
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - execute-command-lists
  - present
  - fence
  - synchronization
---


# 提交、呈现与 WaitForPreviousFrame

## 从录制到执行

`PopulateCommandList` 返回时，Command List 已经录制完成并关闭，但 GPU 尚未执行。

```text
PopulateCommandList
→ Command List 已准备好
→ ExecuteCommandLists
→ 列表提交到 Command Queue
→ GPU 可以开始执行
```

`ExecuteCommandLists` 返回只表示提交完成，不表示 GPU 工作完成。

## Present 的边界

Command List 中最后一条 Barrier 已把 Back Buffer 切回 `PRESENT`。随后 Swap Chain 可以请求呈现当前 Back Buffer。

```text
ExecuteCommandLists：提交生成画面的命令
Present：请求显示生成的 Back Buffer
```

Present 不负责绘制，也不负责向 CPU 证明 GPU 已经完成。

## WaitForPreviousFrame 的目标

HelloWindow 只有一个 Command Allocator，并在每帧重复使用。下一帧重置它之前，必须确认 GPU 已完成上一帧相关命令。

`WaitForPreviousFrame` 完成两项工作：

1. 通过 Fence 等待 GPU Queue 的进度。
2. 取得下一帧应使用的 Back Buffer 下标。

## Signal：在 Queue 上放置里程碑

CPU 先保存本次目标值，再在 Command Queue 上安排 Signal：

```text
此前提交的 GPU 命令
→ Signal(Fence, 目标值)
```

当 GPU 沿 Queue 执行到 Signal 点时，Fence 的完成值才推进到目标值。

`m_fenceValue` 是 CPU 管理的下一个编号。递增它不会推进真实 Fence。

## 检查是否需要等待

```text
Fence 已完成值 >= 本次目标值
→ GPU 已到达 Signal
→ 不需要等待

Fence 已完成值 < 本次目标值
→ GPU 尚未到达 Signal
→ 注册 Event 并等待
```

## Event 等待

CPU 告诉 Fence：达到目标值时触发 Event。随后线程通过 `WaitForSingleObject` 休眠。

```text
SetEventOnCompletion
→ WaitForSingleObject
→ CPU 休眠
→ GPU 到达 Signal
→ Fence 推进
→ Event 触发
→ CPU 醒来
```

这避免了 CPU 不断轮询 Fence。

## 更新 Back Buffer 下标

Present 后 Swap Chain 已推进到下一张可用 Back Buffer，因此函数最后重新查询 `m_frameIndex`。

```text
上一帧使用 Buffer 0
→ Present
→ 下一帧通常使用 Buffer 1
```

程序直接查询 Swap Chain，不自行假设下标一定交替。

## HelloWindow 的一帧闭环

```text
Reset Allocator 和 Command List
→ 录制 Barrier、Clear、Barrier
→ Close
→ ExecuteCommandLists
→ Present
→ Queue Signal
→ 必要时通过 Event 等待 Fence
→ 更新 m_frameIndex
→ 开始下一帧
```

## 这一实现的取舍

每帧都等待 GPU，使控制流和对象复用容易理解，但阻止 CPU 提前准备下一帧。它是教学实现，不是高性能最终结构。

后面的 `HelloFrameBuffering` 会通过多份帧资源避免这种逐帧停顿。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/13-选择RTV、清屏与结束录制.md|选择 RTV、清屏与结束录制]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/15-OnDestroy与资源生命周期.md|OnDestroy 与资源生命周期]]

