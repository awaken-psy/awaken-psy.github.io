---
title: HelloTriangle 12 - HelloTriangle 整体流程
publish: true
updated: 2026-09-11T18:27:47.440Z
tags:
  - DirectX
  - Direct3D12
  - HelloTriangle
  - 整体流程
  - 图形管线
---


# 12 HelloTriangle 整体流程

上一篇：[[学习笔记/cg/directx_sample/HelloWorld/HelloTriangle/11-绑定状态并绘制.md|绑定状态并绘制]]  
下一阶段：HelloTexture（待开始）

## HelloTriangle 比 HelloWindow 多解决了什么

HelloWindow 已经能够取得后台缓冲区、清屏、提交命令并呈现。HelloTriangle 在“清屏”和“呈现”之间增加了一条真正的几何绘制路径。

```text
HelloWindow：清屏 → Present
HelloTriangle：清屏 → 读取顶点 → 执行图形管线 → 写入三角形像素 → Present
```

## 初始化阶段

### 复用自 HelloWindow

```text
Factory
  ↓
Adapter
  ↓
Device
  ↓
Command Queue
  ↓
Swap Chain / Back Buffers / RTV
  ↓
Command Allocator
```

### HelloTriangle 新增

```text
空根签名
  ↓
读取 VS/PS 字节码
  ↓
输入布局 + 根签名 + 着色器 + 固定状态
  ↓
创建 PSO
  ↓
创建 Command List，并以 PSO 作为初始状态

CPU 三个 Vertex
  ↓ Map / memcpy
顶点缓冲区资源
  ↓
顶点缓冲区视图
```

这些对象只需在初始化阶段准备，随后每帧重复使用。

## 每帧 CPU 录制阶段

```text
OnRender
  ↓
PopulateCommandList
  ↓
Reset Allocator
  ↓
Reset Command List，并选择 PSO
  ↓
绑定 Root Signature
  ↓
绑定 Viewport / Scissor Rect
  ↓
后台缓冲区 PRESENT → RENDER_TARGET
  ↓
选择并绑定当前 RTV
  ↓
ClearRenderTargetView
  ↓
设置 TRIANGLELIST
  ↓
绑定 Vertex Buffer View
  ↓
DrawInstanced(3, 1, 0, 0)
  ↓
后台缓冲区 RENDER_TARGET → PRESENT
  ↓
Close Command List
```

【核心】以上全部仍是 CPU 在记录命令，不是 GPU 正在同步执行每一行 C++。

## GPU 执行绘制阶段

`OnRender()` 提交命令列表：

```text
ExecuteCommandLists
  ↓
GPU 按记录顺序执行
```

执行到 DrawInstanced 后：

```text
Vertex Buffer 中的三个 Vertex
  ↓ Vertex Buffer View 划分记录
Input Layout 解释 POSITION / COLOR
  ↓
VSMain 对三个顶点分别执行
  ↓ 输出 SV_POSITION / COLOR0
Triangle List 组装一个三角形
  ↓
Viewport 映射 + Scissor 裁剪
  ↓
光栅化产生候选像素并插值 COLOR0
  ↓
PSMain 输出 SV_TARGET
  ↓
Output Merger 写入当前后台缓冲区 RTV
```

## 呈现和同步阶段

```text
Present(1, 0)
  ↓
交换链呈现完成的后台缓冲区
  ↓
WaitForPreviousFrame
  ↓
Fence 保证 GPU 完成后再复用同一 Allocator 和资源
```

这个逐帧等待方式容易理解，但会让 CPU 与 GPU 大体串行。后面的 HelloFrameBuffering 会专门改进它。

## 三条总原则

### 1. 数据、解释规则和处理程序是分开的

```text
Vertex Buffer：保存字节
Vertex Buffer View：划分顶点记录
Input Layout：解释记录内部字段
Shader：处理解释后的数据
```

### 2. 创建、绑定、执行是三件不同的事

```text
LoadAssets 创建对象
PopulateCommandList 绑定并记录命令
ExecuteCommandLists 让 GPU 执行
```

### 3. 每个对象只解决一种问题

```text
Root Signature：资源绑定契约
PSO：固定绘制规则集合
Viewport：坐标到像素区域的映射
Scissor Rect：像素裁剪边界
RTV：后台缓冲区作为颜色输出目标的描述
Fence：CPU/GPU 完成关系
```

## HelloTriangle 完成检查

- [x] 理解三个顶点怎样描述三角形
- [x] 理解顶点缓冲区和视图的职责区别
- [x] 理解输入布局如何连接 C++ 与 HLSL
- [x] 理解 VSMain、PSMain 和语义
- [x] 理解空根签名
- [x] 理解 PSO 为什么存在
- [x] 理解 Viewport 与 Scissor Rect
- [x] 理解状态绑定和 DrawInstanced
- [x] 理解 CPU 录制、Queue 提交和 GPU 执行的边界

## 下一阶段

HelloTexture 将在这条管线之上增加纹理资源、上传过程、Shader Resource View、着色器可见描述符堆和纹理采样。

返回：[[学习笔记/cg/directx_sample/HelloWorld/HelloTriangle/00-HelloTriangle学习索引.md|HelloTriangle 学习索引]]

## 详细流程图

浏览器版：[[学习笔记/cg/directx_sample/HelloWorld/HelloTriangle/assets/hello-triangle-flow-dark.htm|打开交互式 HTML 原图]]

![[学习笔记/cg/directx_sample/HelloWorld/HelloTriangle/assets/hello-triangle-flow-dark.svg]]
