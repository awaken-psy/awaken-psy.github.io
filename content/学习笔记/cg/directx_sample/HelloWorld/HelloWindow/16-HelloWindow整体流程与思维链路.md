---
title: HelloWindow 整体流程与思维链路
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - sample/hello-window
  - summary
  - lifecycle
aliases:
  - D3D12 HelloWindow 总结
---


# HelloWindow 整体流程与思维链路

## 这个示例究竟完成了什么

HelloWindow 不绘制三角形，也没有 Shader、顶点缓冲区或复杂 Pipeline State。它只完成 D3D12 程序最小但完整的闭环：

```text
创建窗口和 D3D12 环境
→ 获得窗口 Back Buffer
→ 录制清屏命令
→ 提交给 GPU
→ 呈现到窗口
→ 等待 GPU 完成
→ 安全复用或销毁资源
```

它真正训练的是显式图形 API 的基本思维，而不是画面效果。

## 最重要的总原则

D3D12 中，CPU 主要负责描述、录制和调度工作；GPU 在 Command Queue 上异步执行这些工作。

```text
CPU 调用录制函数
≠ GPU 已经执行

CPU 提交 Command List
≠ GPU 已经完成

CPU 准备销毁对象
≠ GPU 已经停止使用对象
```

因此程序必须显式管理：

- 使用哪块 GPU；
- 创建哪些 D3D12 对象；
- Resource 当前用于什么状态；
- 命令何时录制、提交和完成；
- CPU 对象何时可以安全复用或释放。

## 第一阶段：程序启动与窗口创建

程序从 `WinMain` 开始：

```text
WinMain
→ 创建 D3D12HelloWindow sample
→ Win32Application::Run
→ CreateWindow 得到 HWND
→ 调用 sample.OnInit
```

窗口必须先创建，因为 Swap Chain 需要知道最终显示到哪个 `HWND`。

构造函数只初始化普通 C++ 状态；真正的 D3D12 初始化放在窗口就绪后的 `OnInit` 中。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/01-HelloWindow初始化总览.md|HelloWindow 初始化总览]]

## 第二阶段：建立基础 D3D12 环境

`OnInit` 先调用 `LoadPipeline`。这里的 `Pipeline` 是示例对基础运行环境的命名，不等同于完整 Graphics Pipeline State。

初始化遵循依赖顺序：

```text
Debug Layer
→ DXGI Factory
→ Adapter
→ D3D12 Device
→ Command Queue
→ Swap Chain
→ Back Buffer 与 RTV
→ Command Allocator
```

### Factory、Adapter、Device

```text
Factory：进入 DXGI 显示系统的入口
Adapter：选择使用哪块图形适配器
Device：程序操作该 Adapter 的 D3D12 主接口
```

Device 用于创建 Queue、Resource 和 Descriptor Heap 等 D3D12 对象，但 Device 自己不执行命令。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/02-DXGI、Adapter与Device.md|DXGI、Adapter 与 Device]]

### Command Queue

Command Queue 是 CPU 向 GPU 提交工作的通道：

```text
Command List
→ Command Queue
→ GPU
```

HelloWindow 使用 DIRECT Queue，它能承接本例的资源状态转换和清屏命令。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/03-Command Queue与GPU提交模型.md|Command Queue 与 GPU 提交模型]]

### Swap Chain 与 Back Buffer

Swap Chain 连接：

```text
DIRECT Command Queue
+ Windows HWND
+ Swap Chain 描述
```

它管理两张轮流使用的 Back Buffer。`m_frameIndex` 指出当前应操作哪一张，程序不自行猜测下标。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/04-Swap Chain与双缓冲.md|Swap Chain 与双缓冲]]

### Resource、RTV 与 Descriptor Heap

```text
Resource：保存 Back Buffer 的实际像素
RTV：描述如何把 Resource 作为渲染输出
RTV Heap：存放两份 RTV Descriptor
```

双缓冲最终建立一一对应关系：

```text
m_renderTargets[0] ← RTV Heap[0]
m_renderTargets[1] ← RTV Heap[1]
```

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/05-Resource、View与Descriptor Heap.md|Resource、View 与 Descriptor Heap]]

### Command Allocator

Command Allocator 不分配纹理或普通显存。它管理 Command List 录制命令时使用的内部存储。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/06-Command Allocator.md|Command Allocator]]

## 第三阶段：准备运行与同步对象

`OnInit` 接着调用 `LoadAssets`：

```text
创建 Command List
→ 初始状态为 Recording
→ 当前没有命令，立即 Close
→ 创建初值为 0 的 Fence
→ 准备下一个 Fence 编号 1
→ 创建未触发的 Windows Event
```

### Command List

Command List 是 CPU 用于录制 GPU 命令的接口。创建后立即 `Close` 不是销毁，而是让它处于之后可以 `Reset` 的 Closed 状态。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/07-Command List的创建与状态.md|Command List 的创建与状态]]

### Fence 与 Event

```text
Fence：记录 GPU Queue 已完成到哪个进度值
Event：Fence 到达目标值时唤醒休眠的 CPU
```

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/08-Fence与GPU进度.md|Fence 与 GPU 进度]]、[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/09-Windows Event与CPU等待.md|Windows Event 与 CPU 等待]]

## 第四阶段：窗口驱动帧循环

Win32 消息循环取得消息并交给 `WindowProc`。在 `WM_PAINT` 分支中：

```text
WM_PAINT
→ OnUpdate
→ OnRender
```

HelloWindow 没有动画和每帧变化的数据，所以 `OnUpdate` 为空。

`OnRender` 是一帧的总控函数：

```text
PopulateCommandList
→ ExecuteCommandLists
→ Present
→ WaitForPreviousFrame
```

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/10-OnUpdate与OnRender帧入口.md|OnUpdate 与 OnRender 帧入口]]

## 第五阶段：录制一帧命令

`PopulateCommandList` 完整流程：

```text
1. Reset Command Allocator
2. Reset Command List，进入 Recording
3. 当前 Back Buffer：PRESENT → RENDER_TARGET
4. 根据 m_frameIndex 找到对应 RTV
5. ClearRenderTargetView，录制深蓝色清屏
6. 当前 Back Buffer：RENDER_TARGET → PRESENT
7. Close Command List
```

### 两个 Reset

```text
Allocator::Reset
    回收上一轮命令存储

CommandList::Reset
    把 Closed 列表切回 Recording
```

重置 Allocator 前必须确认 GPU 不再使用它。HelloWindow 在每帧末尾等待 GPU，因此下一帧可以安全复用同一个 Allocator。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/11-重置Command Allocator与Command List.md|重置 Command Allocator 与 Command List]]

### Resource State 闭环

```text
PRESENT
→ RENDER_TARGET
→ Clear
→ PRESENT
```

`BufferUsage` 声明 Resource 被允许承担哪些用途；Resource State 表示它此刻正在用于什么。二者不是同一概念。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/12-Resource Barrier与资源状态.md|Resource Barrier 与资源状态]]

### 选择 RTV 并清屏

当前 RTV 的位置由以下关系决定：

```text
Heap 起始位置
+ m_frameIndex × m_rtvDescriptorSize
```

`ClearRenderTargetView` 接收该 RTV Handle，并把整张 Back Buffer 清成固定颜色。该调用仍然只是录制命令。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/13-选择RTV、清屏与结束录制.md|选择 RTV、清屏与结束录制]]

## 第六阶段：提交、呈现与同步

### 提交

```text
ExecuteCommandLists
→ 已关闭的 Command List 进入 Command Queue
→ GPU 可以开始执行
```

提交函数返回不代表 GPU 已完成。

### 呈现

```text
Present
→ 请求 Swap Chain 呈现当前 Back Buffer
```

Present 不生成图像内容，也不证明 GPU 已完成；它要求 Back Buffer 已回到可呈现状态。

### 等待 GPU

`WaitForPreviousFrame` 的主线：

```text
保存本次 Fence 目标值
→ 在 Command Queue 上安排 Signal
→ 增加下一次使用的编号
→ 检查 Fence 已完成值
→ 未完成时注册 Event 并休眠等待
→ GPU 到达 Signal，Event 唤醒 CPU
→ 查询下一张 Back Buffer 的 m_frameIndex
```

Fence 到达目标值，只证明该 Signal 前的 GPU Queue 工作已经完成，不代表显示器一定已经扫描完这一帧。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/14-提交、呈现与WaitForPreviousFrame.md|提交、呈现与 WaitForPreviousFrame]]

## 第七阶段：退出与资源释放

```text
WM_DESTROY
→ 消息循环退出
→ OnDestroy
→ 再次等待 GPU Queue 完成
→ CloseHandle(m_fenceEvent)
→ Run 返回
→ sample 析构
→ ComPtr 成员自动 Release
```

`ComPtr` 管理 CPU 侧 COM 引用，但不知道 GPU 是否仍在使用对象，所以销毁前的 Fence 等待仍不可缺少。

Windows Event 是普通 `HANDLE`，不由 `ComPtr` 管理，需要显式 `CloseHandle`。

关联笔记：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/15-OnDestroy与资源生命周期.md|OnDestroy 与资源生命周期]]

## 六组必须分清的概念

| 容易混淆的对象 | 正确边界 |
| --- | --- |
| Adapter / Device | Adapter 代表所选显卡；Device 是程序使用它的 D3D12 接口 |
| Resource / View | Resource 保存数据；View 描述如何使用数据 |
| Command Allocator / List / Queue | Allocator 提供命令存储；List 录制；Queue 提交给 GPU |
| BufferUsage / Resource State | Usage 是创建时允许的用途；State 是当前用途 |
| Record / Execute | 录制只生成命令列表；提交后 GPU 才能执行 |
| ComPtr / Fence | ComPtr 管 CPU 引用；Fence 判断 GPU 是否仍在使用对象 |

## 能够实际使用时应掌握什么

完成 HelloWindow 后，应能独立解释并复现：

1. 为什么先创建窗口，再初始化 Swap Chain。
2. Factory、Adapter、Device、Queue 的依赖关系。
3. 为什么双缓冲需要两份 Resource 和两份 RTV。
4. 为什么每帧要 Reset、录制、Close、提交。
5. 为什么 Back Buffer 清屏前后必须转换状态。
6. 为什么提交和 Present 都不等于 GPU 已完成。
7. 为什么复用 Allocator、切换 Back Buffer 和销毁资源都依赖同步。

不需要背诵枚举值、COM 宏、完整函数签名或驱动内部实现。

返回：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/00-HelloWindow学习索引.md|HelloWindow 学习索引]]

## 详细流程图

可编辑 HTML 源：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/assets/hello-window-flow-dark.htm]]

![[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/assets/hello-window-flow-dark.svg|1365]]
