---
title: 重置 Command Allocator 与 Command List
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - command-allocator
  - command-list
  - reset
---


# 重置 Command Allocator 与 Command List

## 为什么每帧都要重置

HelloWindow 不为每一帧重新创建 Command Allocator 和 Command List，而是重复使用初始化阶段创建的对象。

```text
上一帧使用
→ Reset
→ 录制当前帧
→ 提交
→ 下一帧继续复用
```

这样可以避免每帧创建和销毁对象。

## 两个 Reset 作用不同

```text
Allocator::Reset
    回收并复用录制命令所用的内部存储

CommandList::Reset
    把已关闭的列表重新切换到 Recording 状态
```

不能把它们理解成同一个动作。

## 为什么先重置 Allocator

Command List 重新开始录制时，需要一个可用的 Allocator 提供存储。因此顺序是：

```text
先 Reset Allocator
→ 再 Reset Command List 并关联这个 Allocator
→ 开始录制
```

## Allocator Reset 的安全条件

Allocator 背后的存储可能仍被 GPU 执行中的命令使用。CPU 只有确认 GPU 完成后才能回收它：

```text
GPU 仍在使用
→ Reset Allocator 是未定义行为

Fence 确认 GPU 完成
→ 可以安全 Reset
```

HelloWindow 在每帧末尾调用 `WaitForPreviousFrame`，因此下一帧开始时可以安全重置同一个 Allocator。

## Command List 的状态变化

初始化结束时，Command List 已经被关闭：

```text
Closed
→ Reset
→ Recording
→ 录制本帧命令
→ Close
→ 提交到 Queue
```

Command List 的 `Reset` 不负责等待 GPU，也不替 Allocator 保证安全；这些生命周期条件仍由应用管理。

## 初始 Pipeline State

重置 Command List 时还可以传入初始 Pipeline State。HelloWindow 只执行清屏，不执行 Draw，因此这里仍然使用空的 Pipeline State。

## 本节后的状态

两个 Reset 成功后：

```text
Command Allocator：存储已可复用
Command List：处于 Recording
GPU：尚未因为这两个 Reset 执行任何新工作
```

接下来对 Command List 的调用才会真正录入本帧命令。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/10-OnUpdate与OnRender帧入口.md|OnUpdate 与 OnRender 帧入口]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/12-Resource Barrier与资源状态.md|Resource Barrier 与资源状态]]

