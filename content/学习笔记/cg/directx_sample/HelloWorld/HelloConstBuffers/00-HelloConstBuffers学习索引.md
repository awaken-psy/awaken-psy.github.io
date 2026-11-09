---
title: HelloConstBuffers 学习索引
publish: true
updated: 2026-09-16T08:53:16.645Z
tags:
  - DirectX
  - Direct3D12
  - HelloConstBuffers
  - 学习索引
---


# HelloConstBuffers 学习索引

前置阶段：[[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/00-HelloBundles学习索引.md|HelloBundles 学习索引]]

## 这一阶段解决什么问题

HelloTriangle 已经能够绘制三角形，HelloBundles 又说明了怎样复用稳定的绘制命令。但如果绘制命令基本不变，只有少量数据需要每帧变化，继续改写顶点缓冲区或重录一套不同命令都不是合适的职责划分。

HelloConstBuffers 保留原来的三角形顶点，通过一块常量缓冲把 CPU 每帧计算出的位移交给顶点着色器。学习主线可以概括为：

```text
CPU 更新 offset
      ↓
写入常量缓冲
      ↓
通过 CBV 和根签名建立绑定
      ↓
顶点着色器读取 offset
      ↓
三角形整体移动
```

## 合并后的学习顺序

- [ ] [[学习笔记/cg/directx_sample/HelloWorld/HelloConstBuffers/01-为什么需要常量缓冲.md|01 为什么需要常量缓冲：变化的数据与 256 字节契约]]
- [ ] [[学习笔记/cg/directx_sample/HelloWorld/HelloConstBuffers/02-常量缓冲从创建到逐帧更新.md|02 常量缓冲：从创建、绑定到逐帧更新与完整流程]]

当前进度：注释与笔记已准备，等待开始讲解  
本阶段状态：尚未开始讲解

