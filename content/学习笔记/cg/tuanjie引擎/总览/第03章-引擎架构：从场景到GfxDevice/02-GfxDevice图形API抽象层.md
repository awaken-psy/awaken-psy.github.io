---
title: 02 - GfxDevice：图形 API 抽象层
publish: true
updated: 2026-09-10T12:02:06.627Z
---

# 02 - GfxDevice：图形 API 抽象层

> 阅读时间：约 40 分钟
> 关键词：GfxDevice、抽象层、设备/上下文、资源模型、状态机、命令

---

## 你将学到什么

- GfxDevice 抽象层要解决的根本问题与设计要点
- 设备与上下文：API 术语表
- GfxDevice 的五类核心操作全景
- 资源与状态：现代 API 的两代模型
- "一个接口，七个实现"如何落地

---

## 1. 问题：一个引擎，七个世界

市面上每种图形 API 都是一个独立王国，同义词互不相同：

| 概念 | D3D11 | D3D12/Vulkan | Metal | GLES/WebGL |
|---|---|---|---|---|
| 显卡连接 | Device | Device（+Adapter） | Device | Context |
| 发令通道 | DeviceContext | CommandList / Queue | CommandBuffer | Context（隐式） |
| 资源 | Resource | Resource+显式堆内存 | MTLBuffer/Texture | Buffer/Texture |
| 着色器 | HLSL → 驱动编译 | IL + 运行时编译 | Metal Shading Language | GLSL ES |
| 同步 | 驱动自动 | 手动 fence/barrier | 手动 fence | 驱动自动 |

若渲染核心直接写某一家的 API，换平台 = 重写全部。所以引擎仿照操作系统对待硬件的方式——**HAL（硬件抽象层）**——为图形硬件造一层抽象。团结引擎中它叫 **GfxDevice**，约是整个引擎里"被 include 次数最多"的模块家族。

## 2. 两代图形 API 与抽象的难度

理解 GfxDevice 必须先理解两代 API 的代差（第04篇会逐个细讲，这里先立概念）：

**传统代（D3D11 / GLES / WebGL）**：驱动藏起一切。你"即时"调用 `Draw()`，驱动内部排队乱序优化；内存自动管理；同步自动。简单，但 CPU 开销大、优化空间受限。

**现代代（D3D12 / Vulkan / Metal）**：显式暴露一切。命令先录制再提交；内存要自己分配管理；渲染资源间的依赖（"纹理 A 写完才能被 B 读"）要用 barrier 手工声明。换来的是多线程录制、极低 CPU 开销。

**抽象层的噩梦**：接口若按传统代设计（同步即时调用），现代代的性能优势出不来；若按现代代设计（异步命令流），传统代又得靠驱动/线程模拟。团结的选择是**命令流为核**：上层看到的是"录制命令 + 刷新"，每个后端自行决定映射方式——D3D12 直接映射到 CommandQueue，D3D11 由驱动排队，GLES 用主线程即时翻译。这个选择直接引出下一篇的多线程渲染。

## 3. GfxDevice 的五类核心操作

`GfxDevice.h` 定义的"合同"可以归纳为五类（每类你都能在渲染管线章节找到对应物）：

### 3.1 资源管理

- **创建/销毁**：顶点缓冲、索引缓冲、纹理（1D/2D/3D/Cube/Array）、渲染目标、着色器、采样器、查询；
- **上传/回读**：CPU 数据 → GPU（纹理上传 `TextureUploadUtils`、动态缓冲映射）；GPU → CPU（`AsyncGPUReadback`，异步回读不卡主线程）；
- **别名与重创建**：设备丢失（移动端切后台）时重建资源（`GfxDeviceRecreate.cpp`）——窗口系统资源重建是移动端保命机制。

### 3.2 状态设置

管线三大状态族（都是第02章学过的概念）：

- **光栅化状态**：cull 方向、填充模式、深度偏移（阴影消 acne 用）、视口/裁剪矩形；
- **深度模板状态**：深度测试开/关、比较函数、写不写深度、模板测试与操作；
- **混合状态**：src/dst 因子、操作符、各通道掩码。

现代 API 把状态组合成**不可变的 Pipeline State Object（PSO）**提前创建；传统 API 每次设置即时生效。抽象层的选择：提供逐项设置接口，现代后端在内部做 PSO 缓存（状态组合哈希 → 已创建 PSO 复用）。

### 3.3 命令绘制

- `Draw` / `DrawIndexed`：普通绘制；
- `DrawInstanced` / `DrawIndexedInstanced`：一次画 N 个实例（GPU Instancing，第12章）；
- `DrawProcedural`：无顶点缓冲、VS 里自己生成几何（粒子/GPU driven 常用）；
- Clear / Blit / Resolve（MSAA 解析）/ Dispatch（compute）。

### 3.4 绑定

绘制前要把资源"接上"管线：绑定哪个渲染目标、哪些顶点缓冲与布局、哪个着色器、哪组纹理与采样器、哪个常量缓冲区（`SetConstantBuffer`）——引擎的 `BuiltinShaderParams`（相机矩阵、光源参数）正是通过常量缓冲区送进 shader 的（第05章展开）。

### 3.5 同步与查询

- Fence/Flush：命令缓冲的前后依赖；
- Occlusion Query / 时间戳查询（性能分析器的数据源，`GfxTimerQuery.h`）；
- 事件标记：调试工具里的 GPU 域名（Frame Debugger 能显示引擎事件名，靠它）。

## 4. 设备与上下文：术语解码

你会反复遇到这几个词，在此建立统一译名：

- **Device（设备）**：整个显卡/驱动连接的化身，负责**创建一切资源**（全局唯一或接近唯一）；
- **Context / CommandList（上下文/命令表）**：发号施令的通道，负责**记录状态与绘制**（可多份 → 多线程录制）；
- **Queue（队列）**：现代 API 的命令消费者，图形队列/compute 队列/复制队列分家（异步 compute 的基础）；
- **Swapchain（交换链）**：管理"前台给显示器、后台给 GPU 画"的 N 张图轮换（第00篇的 VSync 落点）。

团结引擎的实际组织：`GfxDevice`（设备+接口集合）+ `GfxDeviceWorker`（消费命令的工作线程，见下一篇）+ 各 API 后端各自的 Device/Context 封装（`d3d11/`、`vulkan/` 目录里 `DeviceContext` 系列文件）。

## 5. 一次 DrawCall 在抽象层的旅程

把第02章硬件视角补上抽象层视角。URP 发出 `DrawRenderers` 后：

```
C# RenderPipeline (URP)
  └─ ScriptableRenderContext (C++ 接口)          ← 合同
      └─ 渲染核心：排序/合批/填参
          └─ GfxDevice 接口调用（状态+绑定+Draw）  ← 抽象合同
              ├─ d3d11  : 翻译成 ID3D11DeviceContext::DrawIndexed...
              ├─ d3d12  : 录制进 CommandList → 队列提交
              ├─ vulkan : 录制进 VkCommandBuffer → 队列提交
              ├─ metal  : 编码进 MTLCommandBuffer → 提交
              ├─ gles   : 翻译成 glDrawElements...
              └─ webgl  : 同 gles（经 Emscripten 桥接 JS）
```

**同一段渲染核心代码，7 个后端各自落地**——这就是 `PlatformDependent/` 与 `Runtime/GfxDevice/` 各 API 子目录存在的意义。而微信小游戏（WebGL 变体）、OpenHarmony（GLES/Vulkan）作为团结特色平台，同样挂在这套抽象之下。

> ⚠️ **调试观感差异的来源**：同一段代码在 D3D11（驱动乱序执行命令）和 D3D12（命令按序）下表现不同；初学者遇到"某平台画面正确某平台黑屏"，多半是状态/同步在抽象层之下的语义差异（如边界 barrier 缺失），不是"玄学"。

## 6. 设计权衡：为什么接口长这样

三个值得记住的折衷：

1. **对象句柄化**：GfxDevice 大量用整数 ID（`TextureID`、`GfxBuffer` 句柄）而非裸指针跨层传递，配合 `GfxResourceIDMap` 全局映射——安全（悬挂即报错）且便于后端隐藏真实对象；
2. **状态缓存去重**：抽象层记得"当前已设置的状态"，重复设置直接跳过（API 调用有固定开销，尤其 GLES 每次状态切换都可能触发驱动重编译检查）——第02篇的"兼容性合批"本质上就是在 CPU 侧减少这类设置；
3. **绘制抽象粒度**：`DrawRenderer`（引擎级）而非 `DrawTriangle`（过细）或 `DrawFrame`（过粗）——粒度决定灵活与开销的平衡点。

> 📁 **源码指引**：`Runtime/GfxDevice/GfxDevice.h`（接口全景）、`GfxDeviceTypes.h`（全部状态与枚举的"字典"）、`GfxDeviceObjects.h`（资源对象族）、`GfxDeviceStats.cpp`（DrawCall 统计——Profiler 的原始数据源）、`fake/`（无 GPU 环境的假后端，测试/CI 用）。

---

## 小结

- GfxDevice 是图形 HAL：一套接口，七个后端实现（D3D11/12、Vulkan、Metal、GLES、WebGL+特殊平台）；
- 五类操作：资源、状态、绘制、绑定、同步——渲染的一切必经之路；
- 两代 API 的代差（即时 vs 命令流）决定了抽象层必须以**命令流为核**；
- Device/Context/Queue/Swapchain 术语在此定型；
- 状态去重、句柄化、粒度选择是抽象层的三大工程智慧。

## 自测问题

1. 为什么"按现代 API 设计接口、传统 API 做模拟"比反过来好？（提示：性能上限 vs 模拟成本）
2. 逐项设置状态 vs PSO：抽象层是怎么让两者并存的？
3. GLES 上状态重复设置为什么贵？抽象层如何缓解？
4. 微信小游戏平台为什么能"自动"被支持？（提示：它挂在哪个后端之下）

---

*下一节：[03-多线程渲染与命令流](学习笔记/cg/tuanjie引擎/总览/第03章-引擎架构：从场景到GfxDevice/03-多线程渲染与命令流.md) —— 录制与执行分离：GfxDeviceWorker 的故事。*
