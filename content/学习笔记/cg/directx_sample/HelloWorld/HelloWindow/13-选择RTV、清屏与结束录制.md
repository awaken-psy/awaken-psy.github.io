---
title: 选择 RTV、清屏与结束录制
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - rtv
  - clear
  - command-list
---


# 选择 RTV、清屏与结束录制

## 从当前 Back Buffer 找到 RTV

Swap Chain 决定当前应操作哪张 Back Buffer，`m_frameIndex` 保存其下标。RTV Heap 使用相同顺序保存两个 View：

```text
m_frameIndex = 0
→ m_renderTargets[0]
→ RTV Heap[0]

m_frameIndex = 1
→ m_renderTargets[1]
→ RTV Heap[1]
```

当前 RTV Handle 的位置为：

```text
Heap 起始位置
+ m_frameIndex × m_rtvDescriptorSize
```

Handle 只是指向 Descriptor 的位置，不包含 Back Buffer 像素。

## 清屏命令

HelloWindow 使用固定 RGBA 颜色清除当前 RTV：

```text
R = 0.0
G = 0.2
B = 0.4
A = 1.0
```

结果是深蓝色窗口。

`ClearRenderTargetView` 把整个 RTV 设置为这一颜色。它仍然只是在 Command List 中录制命令，直到列表被提交后 GPU 才执行。

清屏要求目标 Resource 已处于 `RENDER_TARGET` 状态，这就是前一条 Barrier 存在的原因。

## 为什么清屏后要切回 PRESENT

清屏完成后，Back Buffer 的下一项用途是交给 Swap Chain 呈现。因此需要录制反向转换：

```text
RENDER_TARGET
→ PRESENT
```

一帧中 Back Buffer 的状态闭环是：

```text
PRESENT
→ RENDER_TARGET
→ Clear
→ PRESENT
```

如果忘记切回可呈现状态，调试层会报告 Present 时资源状态不正确。

## Close 结束录制

完成所有命令后调用 `Close`：

```text
Recording
→ Close
→ Closed
```

Close 不会执行命令。它只表示这份列表已经完整，可以提交到 Command Queue。

## PopulateCommandList 完整流程

```text
1. Reset Command Allocator
2. Reset Command List，进入 Recording
3. Barrier：PRESENT → RENDER_TARGET
4. 根据 m_frameIndex 取得当前 RTV
5. ClearRenderTargetView
6. Barrier：RENDER_TARGET → PRESENT
7. Close Command List
```

函数返回时：

```text
Command List：已经录制并关闭
Command Queue：尚未收到这份列表
GPU：尚未执行本帧命令
```

下一阶段由 `OnRender` 调用 `ExecuteCommandLists` 提交这份列表。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/12-Resource Barrier与资源状态.md|Resource Barrier 与资源状态]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/14-提交、呈现与WaitForPreviousFrame.md|提交、呈现与 WaitForPreviousFrame]]

