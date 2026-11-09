---
title: Resource、View 与 Descriptor Heap
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - resource
  - descriptor
  - rtv
---


# Resource、View 与 Descriptor Heap

## 最核心的区分

```text
Resource：数据本身
View：如何使用这份数据
Descriptor Heap：存放 View 描述符的数组
```

在 HelloWindow 中：

```text
Back Buffer Resource：保存窗口图像的实际像素
RTV：描述如何把这张图像作为渲染输出
RTV Heap：保存两张 Back Buffer 的 RTV
```

RTV 不复制像素，也不拥有 Back Buffer。它只描述一种访问方式。

## 为什么 Resource 与 View 分离

同一份 Resource 在不同阶段可能有不同用途。例如一张纹理可以先作为渲染目标被写入，之后再作为 Shader 输入被读取。

```text
同一个 Resource
  ├─ RTV：作为渲染输出
  └─ SRV：作为 Shader 输入
```

这种设计把“内存里有什么数据”和“本次怎样解释、访问它”分开。

## 常见 View

- RTV：Render Target View，渲染输出。
- DSV：Depth Stencil View，深度模板。
- SRV：Shader Resource View，Shader 读取。
- UAV：Unordered Access View，随机读写。
- CBV：Constant Buffer View，常量缓冲区。

当前只需要掌握 RTV。

## RTV Heap 的两个位置

双缓冲需要两个 RTV：

```text
RTV Heap
  ├─ Heap[0] → Back Buffer 0
  └─ Heap[1] → Back Buffer 1
```

创建 Heap 只是建立空位置；之后才通过 `CreateRenderTargetView` 把 Descriptor 写入指定位置。

## Descriptor Handle 与间距

代码先取得 Heap 起始位置的 CPU Handle，再在循环中逐个写入 RTV。

相邻 Descriptor 的间距由 Device 决定，不能用 `sizeof` 推测或写死：

```text
Heap[0] 地址 = Heap 起始地址
Heap[1] 地址 = Heap 起始地址 + m_rtvDescriptorSize
```

Handle 的 `Offset` 只移动到下一个 Descriptor 位置，不会移动或复制 Back Buffer。

## 填充过程

```text
取得 Heap[0] Handle
→ GetBuffer(0) 得到 Back Buffer 0
→ 在 Heap[0] 创建 RTV
→ Handle 移到 Heap[1]
→ GetBuffer(1) 得到 Back Buffer 1
→ 在 Heap[1] 创建 RTV
```

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/04-Swap Chain与双缓冲.md|Swap Chain 与双缓冲]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/06-Command Allocator.md|Command Allocator]]

