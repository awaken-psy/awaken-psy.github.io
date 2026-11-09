---
title: Command List 的创建与状态
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - command-list
  - load-assets
---


# Command List 的创建与状态

## Command List 解决的问题

CPU 不通过一连串即时调用直接驱动 GPU，而是先把一批 GPU 操作录制成 Command List，再提交到 Command Queue。

```text
CPU 录制 Command List
→ Command Queue 接收列表
→ GPU 执行其中的命令
```

因此，调用 Command List 的录制方法只是在准备工作，并不代表 GPU 已经执行。

## 与 Allocator、Queue 的关系

```text
Command Allocator
    提供录制命令的内部存储
        ↓
Command List
    记录命令和顺序
        ↓
Command Queue
    接收录制完成的列表
        ↓
GPU
    真正执行
```

HelloWindow 中三者都使用 DIRECT 类型。类型必须匹配，因为这份列表将包含图形队列能够执行的资源转换和清屏命令。

## 为什么初始 Pipeline State 是空

HelloWindow 只清除 Back Buffer，不绘制三角形，也不运行 Vertex Shader 和 Pixel Shader，因此创建 Command List 时不需要指定初始 Graphics Pipeline State。

Pipeline State 会在 `HelloTriangle` 中成为主角。

## Command List 的状态

旧式 `CreateCommandList` 创建出的 Command List 默认已经处于 Recording 状态：

```text
Recording
    可以继续录制命令

Closed
    录制完成，可以提交或 Reset
```

初始化阶段没有一帧的命令需要录制，所以示例立即调用 `Close`：

```text
CreateCommandList
→ 自动进入 Recording
→ 当前没有命令
→ Close
→ 等待渲染阶段 Reset 后重新录制
```

`Close` 不是销毁对象，只是表示“这次录制结束”。

## 后续每帧的复用方式

```text
Closed
→ Reset
→ Recording
→ 录制 Barrier 和 Clear
→ Close
→ 提交到 Queue
```

Command List 可以重复使用，但重新录制前必须处于 Closed 状态。Allocator 的复用还有额外的 GPU 完成约束，需要通过 Fence 判断。

## 当前阶段

`LoadAssets()` 已经准备好录制命令的对象。下一步将创建 Fence 和 Windows Event，为 CPU/GPU 同步做准备。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/06-Command Allocator.md|Command Allocator]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/08-Fence与GPU进度.md|Fence 与 GPU 进度]]

