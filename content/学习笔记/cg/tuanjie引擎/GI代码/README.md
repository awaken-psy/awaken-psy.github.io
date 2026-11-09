---
title: GI 源码阅读地图
publish: true
updated: 2026-09-18T09:28:46.107Z
---

# GI 源码阅读地图

对应：[../GI原理/README.md](学习笔记/cg/tuanjie引擎/GI原理/README.md)——先读原理册再进代码；这份地图负责把原理对应到真实文件。
源码根目录：`C:\Users\chang.wei\cw\tj\Modules\TuanjieGI\`

## 1. 代码的方言（先读这节）

TuanjieGI 的 GPU 程序不是手写着色器，而是用 C++ 模板生成（[04-工程与集成 §4](学习笔记/cg/tuanjie引擎/GI原理/04-工程与集成/01-增量与事件的设计思想.md)）。进代码前先认这几样构件：

| 构件 | 是什么 |
|---|---|
| `oceanus::Kernel(lambda)` | 一段用 C++ 写的 GPU 程序，编译成各平台的着色器 |
| `$define_permutation_*` / `$permutation_if($permu(...))` / `set_permutation` | 编译期开关——同一份源码生成多种排列，运行时选一份执行 |
| `Var<T>` | GPU 端对象的引用；不带 `Var` 的是 CPU 端变量 |
| `OC_STRUCT` / `OC_PARAM_STRUCT` | 把结构体成员布局反射给 GPU（跨 DX/Metal/VK 要求成员按 x4 对齐） |
| `configure_block(x, y, z)` | 线程组尺寸 |
| `Stream << shader(...) << commit()` | GPU 命令队列的提交 |
| `GIOption<T>::Add(默认值, 名字, 注释)` | 可调参数——注释是官方文档，核实原理断言最快的入口 |

第一篇建议精读 `GISDFExt/GICascadedSDF.h`：级联、索引表、球体步进都在里面，而且原理册已经陪着它核对过三处事实（见第 4 节），每一段都有出处。

## 2. 阅读地图（按数据流顺序）

| 顺序 | 原理笔记 | 源码位置 | 看什么 |
|---|---|---|---|
| 0 | [SDF 与球体步进](学习笔记/cg/tuanjie引擎/GI原理/01-数学基础/03-SDF与球体步进.md)、[分层距离场](学习笔记/cg/tuanjie引擎/GI原理/02-世界表示/02-分层距离场.md) | `GISDFExt/GICascadedSDF.h` | 方言入门，顺便复习级联、索引表、命中阈值 ✅ 2026-09-18 已读，笔记：[01-级联距离场](学习笔记/cg/tuanjie引擎/GI代码/01-级联距离场.md) |
| 1 | [一帧的旅程](学习笔记/cg/tuanjie引擎/GI原理/00-全景/02-一帧的旅程.md)、[增量与事件 §2](学习笔记/cg/tuanjie引擎/GI原理/04-工程与集成/01-增量与事件的设计思想.md) | `GIPipeline/`、`GITracing/IndirectLightingScene.h`、`Public/TuanjieGIManager.cpp` | 总装：子系统注册顺序、每帧执行顺序、交错更新开关 |
| 2 | [从采样块到像素](学习笔记/cg/tuanjie引擎/GI原理/03-核心算法/04-从采样块到像素.md) | `GITracing/QuadTraceSH.h` | **全模块最核心的文件**：历史混合参数、邻域 5×5、弯法线求值，逐行对照 §3–§6 |
| 2 | 同上 §6 | `GITracing/GISampleBentNormal.h` | 弯法线的计算：0.35 米、4 方向 |
| 2 | [接进画面与时间稳定性](学习笔记/cg/tuanjie引擎/GI原理/04-工程与集成/02-接进画面与时间稳定性.md) | `RenderPipeline/ReprojectHistory.h` | 像素层重投影、深度/法线校验、上限 8 |
| 3 | [面片与表面光场](学习笔记/cg/tuanjie引擎/GI原理/02-世界表示/01-面片与表面光场.md) | `GIFacet/`（`GIFacetScene.h`、`GIFacetInclude.h`） | 图集与 512² 工作台、优先级/有效期、面片侧累积上限 8 |
| 3 | [面片光照与多级反弹](学习笔记/cg/tuanjie引擎/GI原理/03-核心算法/03-面片光照与多级反弹.md) | `GILighting/` | 直接光入账、间接光入账、帧数累积 |
| 4 | [射线的六级查询](学习笔记/cg/tuanjie引擎/GI原理/03-核心算法/02-射线的六级查询.md) | `GISDFExt/CascadedSDFTracer.h`、`GISDF/GISDFTracer.h`、`GISDF/GIClusterTracer.h`、`RayTracing/` | 短程/全程两个 tracer、硬件光追替换 |
| 5 | [面片与距离场的生成](学习笔记/cg/tuanjie引擎/GI原理/02-世界表示/03-面片与距离场的生成.md) | `GIDataBuilder/` | 离线生成：距离场测量、面片布局 |

节奏参考：0 半天；1 一两天；2 三到五天（核心文件，值得慢）；3 三到五天；4 两三天。

## 3. 读法

1. **验证式阅读**：每次带一条原理册的断言进代码核实（"历史混合权重真是 1/帧数吗"）。这套方法已经用过多次且有效——occludeFactor 的真实机制、弯法线的求值方式、"资产侧撑厚偏置"（查无此参数，已从笔记删除）都是这么抓出来的。发现与笔记不符，回去改原理册。
2. **画面对照**：本地构建的编辑器能跑 TuanjieGI。打开 [调试视图清单](学习笔记/cg/tuanjie引擎/GI原理/04-工程与集成/03-调试可视化与调优.md)，读哪个 pass 就看哪张中间图。
3. **卡住就问**：把文件、行号、代码段贴回来，对着原理册讲。

## 4. 已核对过的源码事实（起手锚点）

以下断言都已在源码里逐条核实过，读代码时可直接当路标：

- `GICascadedSDF.h`：级联数 4；每 cluster 最多登记 4 个模型（保留最近 4 个）；步进上限 128（级联 march `rayMarchingMaxCountCDF`）/ 64（cluster 加速 march `rayMarchingMaxCount`）；生效命中阈值 = **min(半体素, 沿途最大读数)，硬编码 0.5**——`occludeFactor`（注释 "Set this to avoid light leaking"，默认 0.5）只接在无调用者的 `RayMarchingJumped` 上，当前调它无效，详见 [01-级联距离场](学习笔记/cg/tuanjie引擎/GI代码/01-级联距离场.md)
- `QuadTraceSH.h`：历史混合下限 2（注释 "for fast moving object"）、上限 16（"for static object"）、邻域核 5、三判据 sigma；摊回邻域 5×5（范围 2–7）、三个 sigma 默认值（1.5×块尺寸 / 0.3 / 1.0）；漫反射以弯法线求值；粗糙镜面的反射方向由弯法线算出、锥角 = π/2 × 粗糙度；漫反射输出除以 π
- `GISampleBentNormal.h`：遮挡检查距离默认 0.35 米、方向数默认 4；向量长度随遮挡变短（除以全方向加权和的模）
- `GIFacetInclude.h`：面片侧累积上限 8 帧（注意与屏幕侧的 16 不同）
- `GISDF/GISDFTracer.h`：全程 tracer 距离上限 1000；`GISDF/GIClusterTracer.h`：短程 tracer 预算 1 个 cluster
- `RenderPipeline/ReprojectHistory.h`：像素层历史重投影同样累积弯法线

## 5. 目录速览

| 目录 | 职责（对应原理册） |
|---|---|
| `GIPipeline/` | 各渲染管线的接入与总装（URP/HDRP） |
| `GITracing/` | 屏幕层：采样块追踪、历史混合、摊回求值、弯法线、调试可视化 |
| `GIFacet/` | 世界层存储：面片图集、工作台、更新调度 |
| `GILighting/` | 世界层光照：直接光与间接光入账 |
| `GISDF/` | 模型精场：存储、查询、生成 |
| `GISDFExt/` | 级联粗场、索引表、tracer |
| `RayTracing/` | 硬件光追（④⑤级） |
| `RenderPipeline/` | 重投影与画面接入 |
| `GIDataBuilder/` | 离线资产生成 |
| `Atlas/` | 图集资源 |
| `Math/` | 数学工具 |
| `Public/` | 对外接口与 TuanjieGIManager |
| `TrackedApi/` | GPU 资源跟踪封装 |
| `Utility/` | 分配器、过滤器等工具 |

## 6. 本文件夹的笔记怎么写

一篇一个主题（例如 `01-历史混合.md`），每篇建议三段式：**结论 → 关键代码摘录 → 与原理册的差异**。与原理册的出入以代码为准，发现后同步改原理册。
