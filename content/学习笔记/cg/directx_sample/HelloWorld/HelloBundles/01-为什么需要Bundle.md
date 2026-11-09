---
title: 为什么需要 Bundle
publish: true
updated: 2026-09-12T02:21:53.759Z
tags:
  - DirectX
  - Direct3D12
  - HelloBundles
  - Bundle
---


# 为什么需要 Bundle

上一节：[[学习笔记/cg/directx_sample/HelloWorld/HelloTriangle/12-HelloTriangle整体流程.md|HelloTriangle 整体流程]]  
索引：[[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/00-HelloBundles学习索引.md|HelloBundles 学习索引]]  
下一节：[[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/02-Bundle命令分配器.md|Bundle 命令分配器]]

## 先看问题

在 HelloTriangle 中，CPU 每帧都会准备一份完整的绘制命令记录。这样做容易理解，但其中并非所有内容都会随帧变化。

本例中的三角形具有这些稳定内容：

- 使用同一份根签名；
- 使用同一种图元类型；
- 使用同一个顶点缓冲区；
- 始终绘制同样的三个顶点。

与之相对，当前使用哪一个后台缓冲区、它何时进入渲染状态以及何时恢复到呈现状态，属于每帧都要正确处理的工作。

## HelloBundles 的分工

HelloBundles 把命令分成两层：

```text
初始化阶段
    └─ 录制稳定不变的三角形绘制步骤
               ↓ 保存为 Bundle

每一帧
    └─ 录制当前后台缓冲区相关工作
       └─ 在需要绘制的位置调用 Bundle
               ↓
          提交主命令列表
               ↓
          GPU 执行完整的一帧
```

这里的 Bundle 可以先理解成“一段已经录好的子命令”。它不是已经完成的 GPU 工作，也不能独立提交给命令队列。主命令列表调用它以后，GPU 才会在执行主命令列表的过程中执行其中的绘制步骤。

## 与普通函数调用的区别

普通 C++ 函数封装的是 CPU 代码；Bundle 保存的是 D3D12 命令记录。调用 Bundle 的目的不是重复运行一段 C++ 逻辑，而是复用之前已经生成的 GPU 命令序列。

## 为什么不把整帧都放进去

本示例每帧使用的后台缓冲区会轮换，缓冲区状态转换、渲染目标选择和清屏都与当前帧有关。因此示例只把稳定的绘制部分放进 Bundle，把当帧工作留在主命令列表中。

## 这一节应记住什么

> Bundle 解决的不是“怎样画三角形”，而是“怎样复用已经录制好的绘制步骤”。

当前只需要建立这层分工。下一节再看为什么 Bundle 必须拥有与主命令列表分开的命令分配器。
