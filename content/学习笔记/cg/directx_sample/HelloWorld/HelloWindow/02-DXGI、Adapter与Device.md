---
title: DXGI、Adapter 与 Device
publish: true
updated: 2026-09-11T00:00:00.000Z
tags:
  - directx/d3d12
  - dxgi
  - adapter
  - device
---


# DXGI、Adapter 与 Device

## DXGI 与 D3D12 的分工

可以先用一句话区分：

```text
DXGI：连接显卡、显示器和窗口
D3D12：创建渲染资源并向 GPU 提交工作
```

它们互相配合，但职责不同。

## Factory：进入 DXGI 的入口

DXGI Factory 是访问显示系统的入口。程序通过它枚举 Adapter、创建 Swap Chain，并设置部分窗口显示行为。

Factory 不是显卡，也不执行绘制。它更接近一个查询和创建其他 DXGI 对象的管理入口。

## Adapter：选择哪块显卡

Adapter 是程序对某个图形适配器的表示。机器可能同时存在集成显卡、独立显卡和 WARP 软件适配器。

HelloWindow 有两条路径：

```text
默认路径：选择支持 D3D12 的硬件 Adapter
WARP 路径：使用 CPU 实现的软件 Adapter
```

WARP 适合验证基础逻辑或排查硬件、驱动差异，不适合正常性能目标。

## Device：程序操作 Adapter 的 D3D12 接口

Adapter 和 Device 的区别是：

```text
Adapter：选中了哪块显卡
Device：程序通过什么 D3D12 接口使用它
```

Device 是后续 D3D12 对象的主要创建入口，例如命令队列、资源和 Descriptor Heap。

Device 本身不执行命令。真正承接 GPU 工作的是 Command Queue。

## Feature Level 不等于 API 版本

`D3D_FEATURE_LEVEL_11_0` 表示最低硬件能力要求，不表示程序使用 D3D11。只要调用的是 `D3D12CreateDevice`，得到的就是 D3D12 Device。

```text
API：Direct3D 12
最低硬件能力：Feature Level 11_0
```

## 关系总结

```text
DXGI Factory
    ↓ 枚举
Adapter
    ↓ 建立 D3D12 连接
Device
    ↓ 创建
其他 D3D12 对象
```

上一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/01-HelloWindow初始化总览.md|HelloWindow 初始化总览]]  
下一页：[[学习笔记/cg/directx_sample/HelloWorld/HelloWindow/03-Command Queue与GPU提交模型.md|Command Queue 与 GPU 提交模型]]

