---
title: HelloBundles 学习索引
publish: true
updated: 2026-09-12T04:29:29.562Z
tags:
  - DirectX
  - Direct3D12
  - HelloBundles
  - 学习索引
---


# HelloBundles 学习索引

前置阶段：[[学习笔记/cg/directx_sample/HelloWorld/HelloTriangle/00-HelloTriangle学习索引.md|HelloTriangle 学习索引]]

## 这一阶段解决什么问题

HelloTriangle 已经展示了如何录制并提交一帧绘制命令，但其中稳定不变的绘制步骤仍会出现在每一帧的录制过程中。
HelloBundles 把这部分步骤预先录成一组可复用命令，再由每帧的主命令列表调用它，以此学习“当帧工作”和“可复用工作”的分工。

## 学习顺序

- [x] [[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/01-为什么需要Bundle.md|01 为什么需要 Bundle]]
- [x] [[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/02-Bundle命令分配器.md|02 Bundle 命令分配器]]
- [x] [[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/03-Bundle从录制到执行.md|03 Bundle：从录制到执行、状态衔接、生命周期与整体流程]]

当前进度：[[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/03-Bundle从录制到执行.md|Bundle：从录制到执行]]  
本阶段状态：核心主线已完成
