---
title: 03 - 粒子系统与 VFX Graph 渲染
publish: true
updated: 2026-09-10T12:14:53.083Z
---

# 03 - 粒子系统与 VFX Graph 渲染

> 阅读时间：约 35 分钟
> 关键词：CPU/GPU 粒子、粒子发射、输出四边形、Strip/SO、VFX Graph

---

## 你将学到什么

- 粒子系统的本质：模拟与渲染两个独立环节
- CPU 粒子与 GPU 粒子的架构差异与选型
- 粒子如何变成三角形（四边形装配/流带/Sorting）
- VFX Graph 的数据流模型（团结生态里的位置）

---

## 1. 粒子的本质：两件独立的事

```
模拟: 粒子状态 (位置/速度/寿命/颜色) 每帧更新
渲染: 把状态变成三角形给图形管线
```

两者**数据驱动地解耦**——模拟可以在 CPU 也可以在 GPU；渲染只管"拿状态画"。理解这一分离，两大引擎方案（CPU 粒子 vs GPU 粒子）的取舍就清晰了。

## 2. CPU 粒子（引擎经典 Particle System）

**模拟**：Job System 多核遍历粒子表（发射器→积分→碰撞→死亡回收）——`Modules/ParticleSystem/` 的主场。**上限**：单系统约数千~万级（内存与 Job 时间）。

**渲染**：CPU 模拟完，把活跃粒子**顶点流组装**成动态大网格（引擎的 `DynamicVBO` 家族，`ThreadedDynamicVBO.cpp`——第03章命令流的动态缓冲版本），一个系统一个 DrawCall（URP 还会多系统合批 Instancing）。

**优点**：交互自由（脚本随意读写粒子）、碰撞好做（CPU 物理查询）、全平台；
**代价**：CPU 模拟成本线性于粒子数；**CPU→GPU 上传带宽**（每帧顶点全量传输——粒子多时这是主瓶颈）。

**团结/Unity 生态位**：`ParticleSystem` 组件（内置与 URP 通用）——**手游主力**。`Modules/ParticleSystem/` 的 Box/Space 等 + `Runtime/Graphics/` 的粒子缓冲协同。

## 3. GPU 粒子：状态活在 GPU 里

**模拟**：粒子状态存 `GraphicsBuffer`（第01篇的 SSBO），**compute 积分**（第02篇）——每粒子一次线程执行，几十万粒子随意：

```hlsl
RWStructuredBuffer<Particle> _Particles;
[numthreads(64,1,1)]
void Sim(uint id : SV_DispatchThreadID) {
    Particle p = _Particles[id];
    p.vel += gravity * dt;  p.pos += p.vel * dt;
    p.life -= dt;           // 死亡回收用 free list（原子操作/扫描紧凑化）
    _Particles[id] = p;
}
```

**渲染**：无 CPU 回读——**间接绘制**（第02篇）告诉 GPU "自己数活跃粒子画几个"；或**VertexID/InstanceID 程序化装配**（`DrawProcedural`，第03章 GfxDevice 提过的"无顶点缓冲"绘制）：VS 从 SSBO 拉状态、当场展开成四边形顶点。

**优点**：十万级粒子、零 CPU 参与、零回传；
**代价**：交互要经 GPU 缓冲桥接（脚本改单粒子要 compute 改写）；老平台无 SSBO；调试困难（数据在 GPU）。

## 4. 粒子的三种渲染形态

1. **四边形 Billboard**：永远面向相机的四边形（2 三角形）——VS 展开：中心+相机右/上向量构造 4 角。烟/火/闪光的标准形；
2. **Mesh 粒子**：每粒子画一个小网格（Instancing 天然契合，第01篇）——碎片/落叶；
3. **Stream/Strip（流带）**：粒子按轨迹连成带（拖尾）——`TrailRenderer`（`Runtime/Graphics/TrailRenderer.cpp`）与 VFX 的 strip context。**LineBuilder.cpp** 的三角化引擎是底层。

**排序问题**：加法混合火花不排序（第02章：加法可交换）；alpha 混合的烟必须**远→近**——粒子系统内的排序是模拟后 CPU 排（CPU 粒子）或 GPU bitonic（VFX Graph），透明粒子的传统痛点。

## 5. VFX Graph：GPU 粒子的产品化

`Packages/com.unity.visualeffectgraph/`（团结内置包）——**面向 HDRP（PC/主机）的 GPU 粒子工作流**：

- **节点图数据流**：Spawn（生成速率）→ Initialize（出生状态）→ Update（模拟：力/碰撞/死亡）→ Output（渲染形态）——四块 Context 的有向图（与 ShaderGraph 的"数据流"思想同源，第09章04篇）；
- **数据**：全部 `GraphicsBuffer`/纹理，compute 执行；输出走**间接绘制+程序化装配**（第02篇闭环）；
- **能力特征**：百万级粒子、与 ShaderGraph 集成的自定义渲染、电光/流体类高级模板；
- **限制**：**URP 官方在团结/Unity 2022.3 支持已加入（VFX Graph URP 支持）**但移动端仍受 compute/SSBO 门槛限制——**移动小游戏仍是经典 ParticleSystem 的天下**。

**选型速记**：

| 目标 | 选 |
|---|---|
| 手游/小游戏 | 经典 ParticleSystem（CPU/Job） |
| PC 中型项目 | ParticleSystem 为主 + 局部 VFX |
| 主机/PC 3A | VFX Graph |

> 📁 **源码指引**：经典系统 `Modules/ParticleSystem/`（模拟/渲染的 C++ 侧全量）；粒子缓冲与动态装配 `Runtime/Graphics/` 的 `ThreadedDynamicVBO`（第03章 threaded/ 目录）；拖尾 `TrailRenderer.cpp`/`LineBuilder.cpp`；VFX Graph 包源码 `Packages/com.unity.visualeffectgraph/`（Runtime/ 的 context 系统与 cull/update/output 的 HLSL 生成器）。

---

## 小结

- 粒子=模拟（状态更新）+渲染（三角形装配）两件解耦的事；
- CPU 粒子：交互自由、全平台、数万级封顶、上传带宽是瓶颈；
- GPU 粒子：SSBO+compute 模拟、间接/程序化渲染，十万级、零回传——VFX Graph 的产品化；
- 三形态：billboard/mesh/strip；加法不排序、alpha 排序；
- 团结生态：手游经典系统，3A 用 VFX Graph（URP 支持随版本完善）。

## 自测问题

1. CPU 粒子的"每帧全量上传"瓶颈具体在哪个环节？（模拟后 CPU→GPU 顶点传输）
2. GPU 粒子怎么让"该画几个"不回 CPU？（间接绘制读 GPU 计数）
3. 加法火花为什么可以不排序？烟为什么要？（混合可交换性）
4. 你的小游戏要 3000 个拖尾火花——选什么方案？为什么不用 VFX Graph？

---

*最后一节：[04-渲染性能分析与工具](学习笔记/cg/tuanjie引擎/总览/第12章-GPU优化与高级专题/04-渲染性能分析与工具.md) —— 全书收官：把一切知识拧成性能诊断的螺丝刀。*
