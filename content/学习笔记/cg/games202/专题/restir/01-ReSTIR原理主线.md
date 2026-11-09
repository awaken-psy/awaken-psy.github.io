---
title: ReSTIR 原理主线：让"选择"本身成为蒙特卡洛
publish: true
updated: 2026-10-26T11:04:06.521Z
tags:
  - restir
  - resampling
  - importance-sampling
  - rtrt
  - many-lights
  - overview
---


# ReSTIR 原理主线：让"选择"本身成为蒙特卡洛

> 本篇在思维链上的位置：**总入口**。ReSTIR 是 2020 年之后实时渲染样本预算革命的核心。它的直觉一句话：**灯太多、射线太少时，"选哪盏灯看"本身就是个采样问题**——ReSTIR 把"选"做成了蒙特卡洛的一部分：流式称重一堆便宜候选，只给赢家付一根阴影射线的钱，再把时空邻居的赢家拿来当自己的候选。

## ReSTIR 一句话

> **每像素从便宜的源分布抽 M 个候选，按"着色点的无遮蔽贡献"加权，用 O(1) 的水库留一个赢家；赢家的可见性只花一根阴影射线去验；然后把上一帧、邻像素的水库合并进来——有效候选数被时空复用放大几个数量级，而每像素每帧始终只付一根射线的钱。**

$$
\boxed{
\text{ReSTIR}
=
\underbrace{\text{RIS}}_{\text{选择即采样}}
+
\underbrace{\text{WRS 水库}}_{\text{O(1) 流式状态}}
+
\underbrace{\text{时空复用}}_{\text{邻居的赢家也是候选}}
+
\underbrace{\text{GRIS}}_{\text{跨域复用的无偏性}}
}
$$

## 全专题思维链路

```mermaid
flowchart TD
    A(["出发点：百万盏灯 × 每像素一根阴影射线的预算<br/>理想重要性采样分布无法预计算"]) --> B["分离两种成本：<br/>加权便宜（查表），评估昂贵（打射线）"]
    B --> C["RIS：M 个候选按无遮蔽贡献加权<br/>只有赢家付评估的钱"]
    C --> D["WRS：水库 O(1) 状态<br/>流式选赢家，还能合并水库"]
    D --> E["时空复用：上帧与邻居的水库<br/>当候选合并 —— 等效样本爆炸"]
    E --> F{"跨像素复用破坏了<br/>分布假设 → 偏置"}
    F --> G["GRIS：目标重加权 + MIS + Jacobian<br/>把复用做成无偏"]
    G --> H["泛化：sample 从\"灯\"变成\"路径\"<br/>ReSTIR GI → ReSTIR PT"]
    H --> I(["收官：RTXDI / MegaLights / AW2<br/>RTRT 的采样-重建两件套"])

    classDef entry fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    classDef process fill:#4a90d9,stroke:#2980b9,stroke-width:2px,color:#fff
    classDef question fill:#d4ac0d,stroke:#b7950b,stroke-width:2px,color:#fff
    classDef fix fill:#27ae60,stroke:#1e8449,stroke-width:2px,color:#fff
    classDef finale fill:#9b59b6,stroke:#8e44ad,stroke-width:2px,color:#fff

    class A entry
    class B,C,D,E,H process
    class F question
    class G fix
    class I finale
```

## 各篇在主线中的位置

| 篇 | 解决的问题 |
|---|---|
| [[学习笔记/cg/games202/专题/restir/02-多光的采样困境.md|02 多光的采样困境：理想分布拿不到]] | 问题本身：为什么多灯直射的"理想采样分布"拿不到 |
| [[学习笔记/cg/games202/专题/restir/03-RIS-重采样重要性采样.md|03 RIS：重采样重要性采样]] | 核心发明一：候选加权、只评估赢家（⟨L⟩ 的无偏结构） |
| [[学习笔记/cg/games202/专题/restir/04-水库采样WRS.md|04 水库采样 WRS：O(1) 的流式赢家]] | 核心发明二：O(1) 流式选赢家 + 水库合并律 |
| [[学习笔记/cg/games202/专题/restir/05-时空复用.md|05 时空复用：邻居的赢家也是候选]] | 威力所在：邻居的赢家也是候选，等效样本数爆炸 |
| [[学习笔记/cg/games202/专题/restir/06-偏置与GRIS.md|06 偏置与 GRIS：跨域复用的无偏化]] | 代价所在：跨像素复用的偏置与无偏化三件套 |
| [[学习笔记/cg/games202/专题/restir/07-ReSTIR-GI与PT.md|07 ReSTIR GI 与 PT：样本从"灯"变成"路径"]] | 泛化：样本从"灯"变成"路径"，一路通到全路径追踪 |
| [[学习笔记/cg/games202/专题/restir/08-实现与赛道收官.md|08 实现与赛道收官]] | GPU 工程细节、工业落地、多光谱系终局对照 |

## 与已有专题的三条快线

- **MC 基础在此兑现**：[[学习笔记/cg/rt in one weekend/rest_life/03-一维蒙特卡洛积分与重要性采样.md|第 3 章：一维蒙特卡洛积分与重要性采样]] 讲"方差靠分布杀"，[[学习笔记/cg/rt in one weekend/rest_life/09-直接采样光源.md|第 9 章：直接采样光源]] 是单灯情形的最简版（只有一盏灯时不需要"选"）——ReSTIR 是它们的百万灯版；[[学习笔记/cg/rt in one weekend/rest_life/10-混合密度.md|第 10 章：混合密度]] 的混合思想在 [[学习笔记/cg/games202/专题/restir/06-偏置与GRIS.md|06 偏置与 GRIS：跨域复用的无偏化]] 的 MIS 权重里满血复活；
- **多光谱系的换代**：VPL/阴影图百万灯单（[[学习笔记/cg/games202/专题/lpv/02-RSM-反射阴影贴图.md|02 RSM 反射阴影贴图：把"被照亮的表面"收集起来]]）、Lightcuts 这些 2000 年代方案走"**把灯压少**"路线，ReSTIR 走"**接受灯多、只选对的**"路线——[[学习笔记/cg/games202/专题/restir/08-实现与赛道收官.md|08 实现与赛道收官]] 会把两代方案对表；
- **与 SSGI 是一对孪生**：SSGI 复用上一帧的**值**（[[学习笔记/cg/games202/专题/ssgi/03-辐射缓存-上一帧的画面.md|03 辐射缓存：上一帧的画面]]），ReSTIR 复用上一帧的**选择**（水库）——同样是"时间换样本"，一个换辐射，一个换决策。

## 记忆压缩

> **ReSTIR = 把"选样本"升格为蒙特卡洛操作**：加权便宜、评估昂贵的成本分离是地基，水库给了 O(1) 的流式身份，时空复用让每像素的穷预算攒出富样本，GRIS 保证复用不犯法。它的位置一句话：**RTRT 时代，采样器和降噪器是两件套——ReSTIR 是当代采样器的标准答案**。从困境开始：[[学习笔记/cg/games202/专题/restir/02-多光的采样困境.md|02 多光的采样困境：理想分布拿不到]]。
