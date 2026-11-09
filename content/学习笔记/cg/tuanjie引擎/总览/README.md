---
title: 《团结引擎渲染系统学习笔记》
publish: true
updated: 2026-09-10T12:15:09.801Z
---

# 《团结引擎渲染系统学习笔记》

> 面向新手图形程序员的团结引擎（Tuanjie Engine）渲染系统学习笔记。
> 重原理、轻代码 —— 先建立直觉与心智模型，再谈实现。
> 基于 Tuanjie 1.11.0（Unity 2022.3.62f1 分支）真实源码结构编写。

---

## 这本书是什么

这不是 API 手册，也不是源码逐行解读。它是一份**自底向上、循序渐进**的渲染原理笔记，目标是让你读完之后：

1. 理解屏幕上的每个像素**是怎么来的**；
2. 理解引擎为什么这样设计（为什么有 GfxDevice 抽象层、为什么要有 SRP）；
3. 面对 Frame Debugger / Profiler 里的每一项，能说出它背后的原理；
4. 为后续阅读 URP / HDRP 源码打下概念基础。

公式统一用 LaTeX 书写（`$...$` 行内、`$$...$$` 独立公式），流程图用 Mermaid 绘制，建议用 Obsidian 等支持这两种格式的工具阅读。

## 章节结构

| 篇章 | 内容 | 预计篇数 |
|---|---|---|
| **00-导读与全景** | 如何使用本书、渲染系统全景图、一帧画面的旅程 | 3 |
| **第01章 渲染数学基础** | 向量、矩阵、投影变换、辐射度量学与色彩 | 4 |
| **第02章 GPU图形管线原理** | 顶点处理、光栅化、像素着色、纹理、深度模板 | 5 |
| **第03章 引擎架构：从场景到GfxDevice** | 渲染分层架构、图形API抽象、多线程渲染 | 4 |
| **第04章 剔除与提交** | 视锥体剔除、遮挡剔除、渲染队列、批处理概览 | 4 |
| **第05章 材质与Shader系统** | Shader/材质数据流、着色器编译、变体系统、SRP Batcher | 4 |
| **第06章 光照与PBR** | 光的度量、经典光照模型、BRDF与PBR、IBL | 5 |
| **第07章 阴影** | ShadowMap原理、级联阴影CSM、工程化难题 | 4 |
| **第08章 渲染路径** | 前向渲染、延迟渲染、前向+、管线选型 | 4 |
| **第09章 SRP可编程渲染管线** | SRP架构、URP/HDRP流程、ShaderGraph原理 | 4 |
| **第10章 全局光照** | 烘焙Lightmap、探针系统、实时GI与TuanjieGI | 5 |
| **第11章 后处理** | 全屏Pass、Bloom与色调映射、抗锯齿 | 4 |
| **第12章 GPU优化与高级专题** | Instancing、Compute、粒子渲染、性能分析 | 4 |

全书约 55 篇笔记，每篇聚焦一个主题，可独立阅读，但按章节顺序阅读效果最佳。

## 详细目录

**00-导读与全景**
- [00-如何使用本书](学习笔记/cg/tuanjie引擎/总览/00-导读与全景/00-如何使用本书.md)
- [01-团结引擎渲染系统全景](学习笔记/cg/tuanjie引擎/总览/00-导读与全景/01-团结引擎渲染系统全景.md)
- [02-一帧画面的旅程总览](学习笔记/cg/tuanjie引擎/总览/00-导读与全景/02-一帧画面的旅程总览.md)

**第01章 渲染数学基础**
- [01-向量与点积叉积](学习笔记/cg/tuanjie引擎/总览/第01章-渲染数学基础/01-向量与点积叉积.md)
- [02-矩阵与坐标变换](学习笔记/cg/tuanjie引擎/总览/第01章-渲染数学基础/02-矩阵与坐标变换.md)
- [03-投影从3D到2D](学习笔记/cg/tuanjie引擎/总览/第01章-渲染数学基础/03-投影从3D到2D.md)
- [04-辐射度量学与色彩](学习笔记/cg/tuanjie引擎/总览/第01章-渲染数学基础/04-辐射度量学与色彩.md)

**第02章 GPU图形管线原理**
- [01-图形管线总览与顶点处理](学习笔记/cg/tuanjie引擎/总览/第02章-GPU图形管线原理/01-图形管线总览与顶点处理.md)
- [02-光栅化与重心插值](学习笔记/cg/tuanjie引擎/总览/第02章-GPU图形管线原理/02-光栅化与重心插值.md)
- [03-像素着色与输出合并](学习笔记/cg/tuanjie引擎/总览/第02章-GPU图形管线原理/03-像素着色与输出合并.md)
- [04-纹理采样与Mipmap](学习笔记/cg/tuanjie引擎/总览/第02章-GPU图形管线原理/04-纹理采样与Mipmap.md)
- [05-深度与模板进阶](学习笔记/cg/tuanjie引擎/总览/第02章-GPU图形管线原理/05-深度与模板进阶.md)

**第03章 引擎架构：从场景到GfxDevice**
- [01-渲染核心层与Renderer组件](学习笔记/cg/tuanjie引擎/总览/第03章-引擎架构：从场景到GfxDevice/01-渲染核心层与Renderer组件.md)
- [02-GfxDevice图形API抽象层](学习笔记/cg/tuanjie引擎/总览/第03章-引擎架构：从场景到GfxDevice/02-GfxDevice图形API抽象层.md)
- [03-多线程渲染与命令流](学习笔记/cg/tuanjie引擎/总览/第03章-引擎架构：从场景到GfxDevice/03-多线程渲染与命令流.md)
- [04-现代API对比与平台后端图鉴](学习笔记/cg/tuanjie引擎/总览/第03章-引擎架构：从场景到GfxDevice/04-现代API对比与平台后端图鉴.md)

**第04章 剔除与提交**
- [01-包围盒与视锥体剔除](学习笔记/cg/tuanjie引擎/总览/第04章-剔除与提交/01-包围盒与视锥体剔除.md)
- [02-遮挡剔除](学习笔记/cg/tuanjie引擎/总览/第04章-剔除与提交/02-遮挡剔除.md)
- [03-Layer与渲染队列](学习笔记/cg/tuanjie引擎/总览/第04章-剔除与提交/03-Layer与渲染队列.md)
- [04-DrawCall与批处理概览](学习笔记/cg/tuanjie引擎/总览/第04章-剔除与提交/04-DrawCall与批处理概览.md)

**第05章 材质与Shader系统**
- [01-Shader材质Pass数据流](学习笔记/cg/tuanjie引擎/总览/第05章-材质与Shader系统/01-Shader材质Pass数据流.md)
- [02-着色语言与编译](学习笔记/cg/tuanjie引擎/总览/第05章-材质与Shader系统/02-着色语言与编译.md)
- [03-变体系统与剔除](学习笔记/cg/tuanjie引擎/总览/第05章-材质与Shader系统/03-变体系统与剔除.md)
- [04-SRP Batcher与合批兼容性](<学习笔记/cg/tuanjie引擎/总览/第05章-材质与Shader系统/04-SRP Batcher与合批兼容性.md>)

**第06章 光照与PBR**
- [01-光源类型与光照组织](学习笔记/cg/tuanjie引擎/总览/第06章-光照与PBR/01-光源类型与光照组织.md)
- [02-从Lambert到Blinn-Phong](学习笔记/cg/tuanjie引擎/总览/第06章-光照与PBR/02-从Lambert到Blinn-Phong.md)
- [03-微表面理论与BRDF](学习笔记/cg/tuanjie引擎/总览/第06章-光照与PBR/03-微表面理论与BRDF.md)
- [04-金属度粗糙度工作流与法线贴图](学习笔记/cg/tuanjie引擎/总览/第06章-光照与PBR/04-金属度粗糙度工作流与法线贴图.md)
- [05-环境光与IBL](学习笔记/cg/tuanjie引擎/总览/第06章-光照与PBR/05-环境光与IBL.md)

**第07章 阴影**
- [01-阴影映射ShadowMap原理](学习笔记/cg/tuanjie引擎/总览/第07章-阴影/01-阴影映射ShadowMap原理.md)
- [02-级联阴影CSM](学习笔记/cg/tuanjie引擎/总览/第07章-阴影/02-级联阴影CSM.md)
- [03-软阴影与工程问题](学习笔记/cg/tuanjie引擎/总览/第07章-阴影/03-软阴影与工程问题.md)
- [04-接触阴影与替代方案](学习笔记/cg/tuanjie引擎/总览/第07章-阴影/04-接触阴影与替代方案.md)

**第08章 渲染路径**
- [01-前向渲染](学习笔记/cg/tuanjie引擎/总览/第08章-渲染路径/01-前向渲染.md)
- [02-延迟渲染与GBuffer](学习笔记/cg/tuanjie引擎/总览/第08章-渲染路径/02-延迟渲染与GBuffer.md)
- [03-前向+与光的分块](学习笔记/cg/tuanjie引擎/总览/第08章-渲染路径/03-前向+与光的分块.md)
- [04-管线选型对比](学习笔记/cg/tuanjie引擎/总览/第08章-渲染路径/04-管线选型对比.md)

**第09章 SRP可编程渲染管线**
- [01-SRP架构与ScriptableRenderContext](学习笔记/cg/tuanjie引擎/总览/第09章-SRP可编程渲染管线/01-SRP架构与ScriptableRenderContext.md)
- [02-URP管线流程详解](学习笔记/cg/tuanjie引擎/总览/第09章-SRP可编程渲染管线/02-URP管线流程详解.md)
- [03-HDRP管线流程详解](学习笔记/cg/tuanjie引擎/总览/第09章-SRP可编程渲染管线/03-HDRP管线流程详解.md)
- [04-ShaderGraph原理](学习笔记/cg/tuanjie引擎/总览/第09章-SRP可编程渲染管线/04-ShaderGraph原理.md)

**第10章 全局光照**
- [01-全局光照概念与间接光](学习笔记/cg/tuanjie引擎/总览/第10章-全局光照/01-全局光照概念与间接光.md)
- [02-烘焙Lightmap原理](学习笔记/cg/tuanjie引擎/总览/第10章-全局光照/02-烘焙Lightmap原理.md)
- [03-Lightmap采样与ShadowMask](学习笔记/cg/tuanjie引擎/总览/第10章-全局光照/03-Lightmap采样与ShadowMask.md)
- [04-LightProbe与ReflectionProbe](学习笔记/cg/tuanjie引擎/总览/第10章-全局光照/04-LightProbe与ReflectionProbe.md)
- [05-实时GI与TuanjieGI](学习笔记/cg/tuanjie引擎/总览/第10章-全局光照/05-实时GI与TuanjieGI.md)

**第11章 后处理**
- [01-后处理栈与全屏Pass](学习笔记/cg/tuanjie引擎/总览/第11章-后处理/01-后处理栈与全屏Pass.md)
- [02-Bloom与ToneMapping](学习笔记/cg/tuanjie引擎/总览/第11章-后处理/02-Bloom与ToneMapping.md)
- [03-抗锯齿MSAA-FXAA-TAA](学习笔记/cg/tuanjie引擎/总览/第11章-后处理/03-抗锯齿MSAA-FXAA-TAA.md)
- [04-景深运动模糊与SSR](学习笔记/cg/tuanjie引擎/总览/第11章-后处理/04-景深运动模糊与SSR.md)

**第12章 GPU优化与高级专题**
- [01-GPU Instancing深入](<学习笔记/cg/tuanjie引擎/总览/第12章-GPU优化与高级专题/01-GPU Instancing深入.md>)
- [02-Compute与GPU Driven](<学习笔记/cg/tuanjie引擎/总览/第12章-GPU优化与高级专题/02-Compute与GPU Driven.md>)
- [03-粒子与VFXGraph渲染](学习笔记/cg/tuanjie引擎/总览/第12章-GPU优化与高级专题/03-粒子与VFXGraph渲染.md)
- [04-渲染性能分析与工具](学习笔记/cg/tuanjie引擎/总览/第12章-GPU优化与高级专题/04-渲染性能分析与工具.md)

## 学习路径建议

```
完全新手：00 → 01 → 02 → 03（前两章是地基，别跳）
只补理论：01 → 02 → 06 → 07
只关心管线选型：03 → 08 → 09
只关心光照：06 → 07 → 10
```

## 与源码的对应关系

笔记中的"源码指引"小节会指向 Tuanjie 真实源码位置（仓库根目录即引擎源码，`C:\Users\chang.wei\cw\tj`）：

```
Runtime/GfxDevice/                  ← 图形API硬件抽象层（第03章）
Runtime/Graphics/                   ← 渲染器、纹理、光照贴图等资源层（第03、04、10章）
Runtime/Graphics/ScriptableRenderLoop/  ← SRP 的C++后端（第09章）
Runtime/Shaders/                    ← 内置管线的FXPass着色器（第05、08章）
Modules/TuanjieGI/                  ← 团结自研的SDF实时全局光照（第10章）
Packages/com.unity.render-pipelines.universal/      ← URP 源码（第09章）
Packages/com.unity.render-pipelines.high-definition/ ← HDRP 源码（第09章）
Packages/com.unity.shadergraph/                  ← ShaderGraph 源码（第09章）
Packages/com.unity.visualeffectgraph/            ← VFX Graph 源码（第12章）
```

## 写作约定

- 📐 **公式**：LaTeX，重要公式都会解释每个符号的物理/几何含义
- 🗺️ **流程图**：Mermaid，展示数据流与管线结构
- 📁 **源码指引**：告诉你"这个概念在引擎源码的哪里"，但不会贴大段代码
- 💡 **直觉**：用类比和图示解释，避免"定义的堆砌"
- ⚠️ **常见误区**：新手容易踩的坑
