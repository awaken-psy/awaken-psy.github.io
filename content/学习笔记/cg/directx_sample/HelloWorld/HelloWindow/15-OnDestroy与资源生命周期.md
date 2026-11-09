---
title: OnDestroy 与资源生命周期
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - lifetime
  - comptr
  - fence
  - cleanup
---


# OnDestroy 与资源生命周期

## CPU 对象销毁不等于 GPU 已经停止使用

D3D12 中，CPU 负责创建和持有 API 对象，GPU 则异步执行引用这些对象的命令。

```text
CPU 认为程序准备退出
≠
GPU 一定已经执行完全部命令
```

如果 CPU 先释放 Back Buffer、Command Allocator 或 Device，而 GPU 仍在使用它们，就会发生生命周期错误。

## 退出前先等待 GPU

`OnDestroy` 首先调用 `WaitForPreviousFrame`。它在 Command Queue 上放置新的 Fence Signal，并等待 GPU 到达该进度。

```text
此前提交的 GPU 工作
→ Fence Signal
→ CPU 等到 Fence 完成
→ 可以开始释放对象
```

HelloWindow 每帧末尾已经等待，但销毁阶段仍再次确认，使退出路径始终遵守同一条安全规则。

## ComPtr 管理什么

D3D12 Device、Queue、Swap Chain、Resource、Descriptor Heap、Command List、Allocator 和 Fence 都保存在 `ComPtr` 中。

当 `D3D12HelloWindow` 对象析构时，成员 `ComPtr` 会自动减少对应 COM 接口的引用计数，不需要逐个手写 `Release`。

```text
D3D12HelloWindow 析构
→ ComPtr 成员析构
→ 自动 Release COM 接口
```

但 ComPtr 只管理 CPU 侧 COM 引用，它不知道 GPU 是否还在使用对象。因此 Fence 等待仍不可缺少。

## Windows HANDLE 不由 ComPtr 管理

`m_fenceEvent` 来自 Win32 `CreateEvent`，类型是 `HANDLE`，不是 COM 接口。

因此它需要显式释放：

```text
CreateEvent
→ 使用 Event 等待
→ CloseHandle
```

不能依赖 ComPtr，也不应调用 COM 的 `Release`。

## 完整退出顺序

```text
窗口收到关闭消息
→ 退出消息循环
→ OnDestroy
→ 等待 GPU Queue 完成
→ CloseHandle(m_fenceEvent)
→ Run 返回
→ WinMain 中的 sample 析构
→ ComPtr 成员自动 Release
→ 程序退出
```

## 核心原则

```text
先结束使用
再释放资源
```

在异步 GPU API 中，CPU 侧对象是否离开作用域，不足以证明 GPU 已经完成。资源生命周期必须同时考虑 CPU 所有权和 GPU 执行进度。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/14-提交、呈现与WaitForPreviousFrame.md|提交、呈现与 WaitForPreviousFrame]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/16-HelloWindow整体流程与思维链路.md|HelloWindow 整体流程与思维链路]]

