---
title: HelloWindow 学习索引
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - sample/hello-window
aliases:
  - D3D12 HelloWindow
---


# HelloWindow 学习索引

## 这组笔记的目标

`HelloWindow` 不负责画几何体，它先搭起最小的 D3D12 运行闭环：

```text
Windows 窗口
→ 选择显卡并创建设备
→ 建立 GPU 命令提交通道
→ 获得可显示的 Back Buffer
→ 为 Back Buffer 建立 RTV
→ 录制、提交、呈现并同步
```

学习时优先回答三个问题：

1. 一个对象为什么存在？
2. 它依赖谁，又被谁使用？
3. 如果缺少它，整条渲染链会在哪里断掉？

API 参数、枚举值和 COM 宏只要求能查，不要求背诵。

## 当前笔记

| 顺序 | 笔记 | 核心问题 |
| --- | --- | --- |
| 1 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/01-HelloWindow初始化总览.md|HelloWindow 初始化总览]] | 程序从哪里开始，初始化为何分层？ |
| 2 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/02-DXGI、Adapter与Device.md|DXGI、Adapter 与 Device]] | 如何选择 GPU，并建立 D3D12 连接？ |
| 3 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/03-Command Queue与GPU提交模型.md|Command Queue 与 GPU 提交模型]] | CPU 如何把工作交给 GPU？ |
| 4 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/04-Swap Chain与双缓冲.md|Swap Chain 与双缓冲]] | 渲染结果如何进入窗口？ |
| 5 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/05-Resource、View与Descriptor Heap.md|Resource、View 与 Descriptor Heap]] | 为什么有图像资源还需要 RTV？ |
| 6 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/06-Command Allocator.md|Command Allocator]] | Command List 的命令存在哪里？ |
| 7 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/07-Command List的创建与状态.md|Command List 的创建与状态]] | 命令如何被录制，为什么创建后立即关闭？ |
| 8 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/08-Fence与GPU进度.md|Fence 与 GPU 进度]] | CPU 如何知道 GPU 已经执行到哪里？ |
| 9 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/09-Windows Event与CPU等待.md|Windows Event 与 CPU 等待]] | CPU 如何在等待 GPU 时休眠而不是空转？ |
| 10 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/10-OnUpdate与OnRender帧入口.md|OnUpdate 与 OnRender 帧入口]] | 一帧从哪里开始，四个阶段怎样衔接？ |
| 11 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/11-重置Command Allocator与Command List.md|重置 Command Allocator 与 Command List]] | 为什么每帧开始时要执行两个 Reset？ |
| 12 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/12-Resource Barrier与资源状态.md|Resource Barrier 与资源状态]] | 为什么 Back Buffer 在清屏前必须切换状态？ |
| 13 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/13-选择RTV、清屏与结束录制.md|选择 RTV、清屏与结束录制]] | 如何选中当前 Back Buffer 并完成本帧命令录制？ |
| 14 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/14-提交、呈现与WaitForPreviousFrame.md|提交、呈现与 WaitForPreviousFrame]] | 一帧如何提交、呈现，并确认 GPU 已完成？ |
| 15 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/15-OnDestroy与资源生命周期.md|OnDestroy 与资源生命周期]] | 为什么释放 CPU 对象前必须先确认 GPU 已完成？ |
| 16 | [[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/16-HelloWindow整体流程与思维链路.md|HelloWindow 整体流程与思维链路]] | 把初始化、帧循环、同步和销毁串成完整闭环 |

## 当前进度

已经完成 `LoadPipeline()`，并进入 `LoadAssets()`：

```text
Command List（已完成）
→ Fence（已完成）
→ Windows Event（已完成）
→ OnUpdate / OnRender 帧入口（已完成）
→ 重置 Allocator 与 Command List（已完成）
→ PRESENT 到 RENDER_TARGET（已完成）
→ 选择 RTV、清屏、切回 PRESENT、Close（已完成）
→ ExecuteCommandLists 与 Present（已完成）
→ WaitForPreviousFrame（已完成）
→ OnDestroy 与资源生命周期（已完成）
```

至此，HelloWindow 的初始化、一帧录制与提交、同步和退出主线已经完整走通。下一步适合做总复习与小型实践，再进入 HelloTriangle。

总复习入口：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/16-HelloWindow整体流程与思维链路.md|HelloWindow 整体流程与思维链路]]

## 阅读原则

- 主线笔记只写稳定原理和对象关系。
- 具体参数留在源码中文注释中。
- 每出现一个新对象，先理解职责，再看创建代码。
- 每学完一段，通过断点观察对象是否创建、状态何时变化。
