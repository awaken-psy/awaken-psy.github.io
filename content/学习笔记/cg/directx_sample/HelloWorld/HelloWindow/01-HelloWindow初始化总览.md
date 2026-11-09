---
title: HelloWindow 初始化总览
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - sample/hello-window
  - initialization
---


# HelloWindow 初始化总览

## 程序入口

Windows 图形程序从 `WinMain` 开始。入口函数只做两件事：

```text
创建 D3D12HelloWindow 示例对象
→ 交给 Win32Application 运行
```

`Main.cpp` 不负责绘图，它只是把具体示例接入通用窗口框架。

## 四层职责

### Main.cpp

负责创建示例对象并启动程序。

### Win32Application

负责创建窗口、保存 `HWND`、处理消息，并在合适的时间调用示例生命周期函数。对 D3D12 学习而言，只需知道：

```text
创建窗口
→ OnInit
→ OnUpdate / OnRender
→ OnDestroy
```

窗口样式和 Win32 参数属于可查阅的外围知识，不是当前主线。

### DXSample

所有 Hello 示例共享的抽象基类。它约定了初始化、更新、渲染和销毁接口，并保存窗口尺寸、标题等公共数据。

### D3D12HelloWindow

具体示例。它拥有 D3D12 对象并实现初始化和渲染行为。

## 构造函数与 OnInit 的边界

构造函数只建立普通 C++ 对象并初始化基础成员；它不立即创建 D3D12 环境。

原因是 Swap Chain 必须关联一个已经存在的窗口：

```text
构造 sample
→ CreateWindow 得到 HWND
→ 调用 OnInit
→ 创建与窗口关联的 D3D12 对象
```

这体现了一个重要原则：先满足依赖，再创建依赖它的对象。

## OnInit 的两阶段结构

```text
OnInit
├─ LoadPipeline：建立基础运行环境
└─ LoadAssets：创建运行时所需的其余对象
```

`HelloWindow` 没有模型或纹理，因此 `LoadAssets` 只是沿用 Hello 系列的统一命名。

`LoadPipeline` 的依赖顺序是：

```text
调试层
→ DXGI Factory
→ Adapter
→ D3D12 Device
→ Command Queue
→ Swap Chain
→ Back Buffer 与 RTV
→ Command Allocator
```

## 关键认识

- 窗口外壳和 D3D12 渲染职责分离。
- 构造对象不等于初始化图形 API。
- 初始化顺序反映了对象之间的依赖关系。
- Hello 示例的函数名是学习路线，不是要求照搬的引擎架构。

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/00-HelloWindow学习索引.md|HelloWindow 学习索引]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/02-DXGI、Adapter与Device.md|DXGI、Adapter 与 Device]]

