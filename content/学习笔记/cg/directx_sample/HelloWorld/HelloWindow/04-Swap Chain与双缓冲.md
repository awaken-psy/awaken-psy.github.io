---
title: Swap Chain 与双缓冲
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - dxgi
  - swap-chain
  - back-buffer
---


# Swap Chain 与双缓冲

## Swap Chain 解决的问题

GPU 不直接在显示器表面上绘制，而是先把结果写入 Back Buffer。Swap Chain 管理这些用于窗口显示的图像，并在 `Present` 时将完成的图像交给桌面显示系统。

## 双缓冲

HelloWindow 使用两张 Back Buffer：

```text
一张用于当前显示
另一张用于准备后续画面
```

`Present` 后两张图像轮换角色。这里的核心不是“交换两块内存”，而是显示系统推进到下一张可用的 Buffer。

当前应当操作哪张 Back Buffer，由 Swap Chain 提供的下标决定：

```text
m_frameIndex = 0 或 1
```

程序不应自行猜测当前下标。

## 创建时最重要的信息

- `BufferCount = 2`：双缓冲。
- `Width / Height`：Back Buffer 尺寸。
- `Format`：像素存储格式。
- `BufferUsage`：允许怎样使用 Back Buffer。
- `SwapEffect`：呈现模型。

其余默认字段按需查询，不必背诵。

## BufferUsage

HelloWindow 使用 `RENDER_TARGET_OUTPUT`，表示 Back Buffer 可以作为 GPU 渲染输出目标。它是一项用途声明，不会主动执行绘制。

```text
BufferUsage：允许把房间当厨房
Clear / Draw：真正在厨房里工作
```

## 初始化流程

```text
1. 填写 Swap Chain 描述
2. Factory 连接 Command Queue、HWND 和描述并创建 Swap Chain
3. 禁止示例未处理的自动 Alt+Enter 全屏切换
4. 取得 IDXGISwapChain3 接口
5. 查询当前 Back Buffer 下标
6. 创建容量为 2 的 RTV Heap
7. 从 Swap Chain 取得两张 Back Buffer Resource
8. 为每张 Back Buffer 创建 RTV
```

## 初始化完成后的结构

```text
Swap Chain
  ├─ Back Buffer 0 ← m_renderTargets[0]
  │                    ↑
  │                 RTV Heap[0]
  │
  └─ Back Buffer 1 ← m_renderTargets[1]
                       ↑
                    RTV Heap[1]
```

`m_frameIndex` 把当前帧与正确的 Resource、RTV 对应起来。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/03-Command Queue与GPU提交模型.md|Command Queue 与 GPU 提交模型]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/05-Resource、View与Descriptor Heap.md|Resource、View 与 Descriptor Heap]]

