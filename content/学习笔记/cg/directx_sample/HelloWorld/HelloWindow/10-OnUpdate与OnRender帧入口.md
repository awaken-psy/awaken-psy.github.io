---
title: OnUpdate 与 OnRender 帧入口
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - frame-loop
  - command-submission
  - present
---


# OnUpdate 与 OnRender 帧入口

## 一帧从哪里开始

Win32 窗口层在需要处理一帧时，依次调用：

```text
OnUpdate
→ OnRender
```

二者分工明确：

```text
OnUpdate：更新 CPU 侧会变化的状态
OnRender：组织本帧的 GPU 工作
```

## 为什么 OnUpdate 是空的

HelloWindow 没有动画、相机、模型或用户控制的渲染参数。它每帧都使用相同颜色清除窗口，所以没有状态需要更新。

后续示例会在 `OnUpdate` 中更新常量缓冲区、变换矩阵或动画数据。

## OnRender 的四个阶段

```text
1. PopulateCommandList
   CPU 录制本帧命令

2. ExecuteCommandLists
   把录制完成的列表提交到 Command Queue

3. Present
   请求 Swap Chain 呈现当前 Back Buffer

4. WaitForPreviousFrame
   等待 GPU 完成本帧并更新 Back Buffer 下标
```

这四步是 HelloWindow 的一帧主线。

## 录制和执行必须分开理解

`PopulateCommandList` 调用结束，只说明 CPU 已经准备好命令列表：

```text
命令已录制 ≠ GPU 已执行
```

只有提交到 Command Queue 后，GPU 才能开始处理它。

## 为什么 ExecuteCommandLists 使用数组

提交 API 可以一次接收多份 Command List，因此参数是数组。HelloWindow 只有一份列表，也要先放进单元素数组再提交。

这是接口形式，不是当前学习重点。

## Present 的作用

`Present` 请求显示当前 Back Buffer。示例使用同步间隔 1，让呈现与显示器垂直刷新保持同步，并且不传额外 Present 标志。

Present 负责把完成的窗口图像交给显示系统，不负责生成图像内容。

## 为什么本例每帧等待

HelloWindow 在 Present 后立即等待 GPU 完成，这让同一个 Command Allocator 和 Command List 可以被安全复用，也使控制流容易理解。

代价是 CPU 和 GPU 难以并行。这个教学简化将在 `HelloFrameBuffering` 中被替换。

## 一帧的最简心智模型

```text
更新 CPU 数据
→ 录制 GPU 命令
→ 提交 GPU 命令
→ 显示结果
→ 确认 GPU 已完成
```

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/09-Windows Event与CPU等待.md|Windows Event 与 CPU 等待]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/11-重置Command Allocator与Command List.md|重置 Command Allocator 与 Command List]]

