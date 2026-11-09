---
title: Command Allocator
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - command-allocator
  - command-list
---


# Command Allocator

## 它分配的不是图形资源

Command Allocator 不负责分配纹理、Back Buffer、顶点数据或普通 GPU 显存。

它负责管理 Command List 录制命令时使用的内部存储。

```text
Command Allocator 提供存储
→ Command List 在其中录制命令
→ Command Queue 接收录制完成的 Command List
→ GPU 执行
```

## 为什么与 Command List 分离

Command List 表示命令录制接口和命令序列；Allocator 管理这些命令背后的存储。分离之后，Command List 对象可以重置并复用，而底层命令存储由应用更明确地管理。

## 类型必须匹配

HelloWindow 使用 DIRECT Command Queue，因此创建 DIRECT 类型的 Command Allocator，后面也会创建 DIRECT Command List。

```text
DIRECT Allocator
↕ 类型匹配
DIRECT Command List
→ DIRECT Command Queue
```

## 最重要的生命周期约束

Allocator 可以通过 `Reset` 回收并复用已有命令存储，但前提是 GPU 已经执行完所有依赖它的命令。

```text
GPU 仍在使用 Allocator
→ 不能 Reset

Fence 确认 GPU 已完成
→ 可以 Reset 并录制下一帧
```

HelloWindow 为了简单，每帧都等待 GPU，因此只使用一个 Allocator。后面的 `HelloFrameBuffering` 会展示多个帧同时进行时，如何为不同帧管理 Allocator。

## 当前阶段

`LoadPipeline()` 已创建 Allocator，但 Command List 尚未创建。下一阶段的 `LoadAssets()` 会把二者关联起来。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/05-Resource、View与Descriptor Heap.md|Resource、View 与 Descriptor Heap]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/07-Command List的创建与状态.md|Command List 的创建与状态]]

