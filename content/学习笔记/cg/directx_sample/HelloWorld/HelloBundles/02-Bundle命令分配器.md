---
title: Bundle 命令分配器
publish: true
updated: 2026-09-12T04:29:29.563Z
tags:
  - DirectX
  - Direct3D12
  - HelloBundles
  - CommandAllocator
  - Bundle
---


# Bundle 命令分配器

上一节：[[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/01-为什么需要Bundle.md|为什么需要 Bundle]]  
索引：[[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/00-HelloBundles学习索引.md|HelloBundles 学习索引]]  
下一节：[[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/03-Bundle从录制到执行.md|Bundle：从录制到执行]]

## 先分清三个角色

```text
命令分配器：提供并管理记录 GPU 命令所需的底层存储
命令列表：提供录制接口，把一条条命令写入这些存储
命令队列：接收已经关闭的主命令列表，交给 GPU 执行
```

因此，命令分配器既不会调用绘制，也不会把工作送到 GPU。它更接近一块由 D3D12 管理的命令内存区域。

## 为什么创建两个分配器

HelloBundles 同时存在两种命令列表：

| 命令列表 | 分配器类型 | 生命周期 |
|---|---|---|
| 每帧主命令列表 | `DIRECT` | 每帧等待 GPU 完成后回收并重新录制 |
| 可复用 Bundle | `BUNDLE` | 初始化时录制一次，后续各帧反复调用 |

创建命令列表时，命令列表的类型必须与传入分配器的类型匹配。因此 `DIRECT` 主命令列表不能拿 `BUNDLE` 分配器来录制，反过来也一样。

```cpp
m_device->CreateCommandAllocator(
    D3D12_COMMAND_LIST_TYPE_DIRECT,
    IID_PPV_ARGS(&m_commandAllocator));

m_device->CreateCommandAllocator(
    D3D12_COMMAND_LIST_TYPE_BUNDLE,
    IID_PPV_ARGS(&m_bundleAllocator));
```

这里的第一个参数首先是在声明“这块命令存储要服务哪种命令列表”。调用结束后仍然没有录制任何绘制命令。

## Reset 回收的是什么

调用命令分配器的 `Reset()`，含义是允许运行时和驱动重新使用它管理的命令存储。它不是简单地把某个 C++ 对象变量清零。

只有当 GPU 已经执行完所有使用这块分配器存储的命令列表后，才能安全 Reset。否则 GPU 可能仍在读取一块已经被 CPU 当成可覆盖空间的存储。

HelloBundles 每帧只执行：

```cpp
m_commandAllocator->Reset();
```

上一帧末尾的 Fence 等待保证主命令存储已经不再被 GPU 使用。

本例没有执行：

```cpp
m_bundleAllocator->Reset();
```

因为已关闭的 Bundle 仍引用其中的命令记录。若重置了这个分配器，原 Bundle 就不能继续当作那份有效的预录命令来调用；必须重新录制并关闭后再使用。

## 一个容易产生的误解

“主命令列表和 Bundle 各有一个分配器”不表示 D3D12 永远要求一个命令列表独占一个分配器。一个分配器可以先后用于多个命令列表，但同一时刻最多只能有一个关联命令列表处于录制状态，而且回收存储前必须满足 GPU 生命周期要求。

本例分开创建的直接原因是：

1. 两个命令列表的类型不同，分配器类型必须匹配；
2. 两块命令存储的回收节奏不同，主分配器每帧复用，Bundle 分配器长期保留。

## 这一节应记住什么

> 命令列表是“录制者”，命令分配器是“存储提供者”；Reset 分配器就是回收命令存储，所以必须同时尊重类型匹配和 GPU 完成时机。

参考：

- [Microsoft Learn：创建和录制命令列表与 Bundle](https://learn.microsoft.com/en-us/windows/win32/direct3d12/recording-command-lists-and-bundles)
- [Microsoft Learn：ID3D12CommandAllocator::Reset](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12commandallocator-reset)
