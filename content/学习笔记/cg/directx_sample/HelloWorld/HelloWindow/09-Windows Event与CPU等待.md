---
title: Windows Event 与 CPU 等待
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - fence
  - windows-event
  - synchronization
---


# Windows Event 与 CPU 等待

## Fence 与 Event 的分工

Fence 和 Event 解决的是两个不同问题：

```text
Fence：记录 GPU 已经执行到哪个进度值
Event：在目标进度到达时唤醒 CPU 线程
```

Fence 是 D3D12 同步对象，Event 是 Windows 操作系统提供的通用等待对象。

## 为什么不持续查询 Fence

CPU 可以不断调用 `GetCompletedValue` 检查进度：

```text
没有完成 → 再查一次
没有完成 → 再查一次
没有完成 → 再查一次
```

这种 Busy Waiting 会持续占用 CPU 时间，却没有完成有用工作。

更合适的方式是：

```text
告诉 Fence 目标值和 Event
→ CPU 等待 Event 并休眠
→ GPU 到达目标 Fence 值
→ Event 被触发
→ CPU 被唤醒并继续
```

## HelloWindow 创建的 Event

示例创建一个：

- 匿名 Event：不需要跨进程通过名称查找。
- 自动重置 Event：唤醒一个等待线程后自动回到未触发状态。
- 初始未触发：创建后不会让等待立即通过。

这些是单线程示例所需的简单配置，不需要背诵 `CreateEvent` 的参数顺序。

## 创建时还没有连接 Fence

仅调用 `CreateEvent` 后：

```text
Fence：已经存在，完成值为 0
Event：已经存在，当前未触发
二者：尚未建立等待关系
```

后面 `WaitForPreviousFrame()` 会通过 `SetEventOnCompletion` 表达：

> 当 Fence 到达指定值时，请触发这个 Event。

然后 CPU 才调用 `WaitForSingleObject` 进入等待。

## 生命周期

`CreateEvent` 返回普通 Windows `HANDLE`，不是 `ComPtr` 管理的 COM 对象。因此程序结束时必须显式调用 `CloseHandle`。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/08-Fence与GPU进度.md|Fence 与 GPU 进度]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/10-OnUpdate与OnRender帧入口.md|OnUpdate 与 OnRender 帧入口]]

