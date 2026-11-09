---
title: 03 注入：把 VPL 倒进格子场
publish: true
updated: 2026-10-26T11:03:33.373Z
tags:
  - games202
  - lpv
  - injection
  - spherical-harmonics
  - grid
---


# 03 注入：把 VPL 倒进格子场

> 本篇在思维链上的位置：**空间压缩**。[[学习笔记/cg/games202/专题/lpv/02-RSM-反射阴影贴图.md|02 RSM 反射阴影贴图：把"被照亮的表面"收集起来]] 收集了百万级 VPL，每个都是离散的"点灯"。LPV 的第一步是把它们**摊开**到一个均匀 3D 格子上，变成连续的"光场"——从此光有了空间结构，才有"流动"可言。

## 格子场：光的新家

把场景包在一个均匀 3D 网格里（典型 $32^3 \sim 64^3$）：

```text
world → grid：格子索引 = (world − origin) / cellSize

每个格子要回答一个问题：
    "如果我站在这个格子里，光从哪些方向进来、有多强？"
```

这是一个**方向 → 辐射亮度**的球面函数——正好是 [[学习笔记/cg/games202/专题/prt/04-球谐函数.md|04 球谐函数：球面上的正交基]] 的老对象。所以：

$$
\boxed{
\text{每个格子} = \text{一个 SH 系数向量}\ \mathbf c(\text{cell})\in\mathbb R^{N\times RGB}
}
$$

LPV 常用**前 2 阶 4 个系数**（RGB 各一套 → 每格 12 个数；PRT 用 3 阶是为了精确重建光照，LPV 只要"光大致从哪边来"的低频方向信息，2 阶够用又省内存）。PRT 专题的全部 SH 机器——投影、重建、旋转——在这里整体复用，只是对象从"环境光/每点传输"换成了"每格的入射光分布"。

## 注入：一个 VPL 贡献什么样的初始分布

单个 VPL 在它所在格子里制造一个初始的辐射分布。VPL 是 diffuse 小片，光向其法线所在的**上半球**发出，分布形状就是那个反复出现的老朋友：

$$
\boxed{
L_{\text{init}}(\omega)
\;\propto\;
\max\big(0,\ n_p\cdot\omega\big)
\qquad\text{（clamped cosine，瓣沿 } n_p \text{）}
}
$$

把这个瓣投影到 SH（[[学习笔记/cg/games202/专题/prt/03-函数即向量-基函数与投影.md|03 函数即向量：基函数、投影与正交]] 的投影公式），得到该 VPL 的初始系数，叠加进它所在的格子：

$$
\mathbf c(\text{cell}_p)\;{+}{=}\;\Phi_p\cdot\underbrace{\mathbf A(n_p)}_{\text{朝向 } n_p \text{ 的 clamped-cosine 系数}}
$$

由于格子轴向固定、只有 $n_p$ 在变，$\mathbf A(n_p)$ 就是"旋转到法线朝向的 clamped cosine 基础系数"——用 [[学习笔记/cg/games202/专题/prt/04-球谐函数.md|04 球谐函数：球面上的正交基]] 的旋转性质（每阶闭环）可以便宜地按 $n_p$ 旋转出任意朝向的系数。**Â_l 表的第二次直系复用**。

> 注入的读法：**VPL 不再是一盏点灯，而是它所在格子里的一片"方向性朝霞"**——从今往后，光的位置精度 = 格子精度，方向精度 = 2 阶 SH 的四向分辨率。压缩的损失从此处开始记账。

## 百万 VPL → 采样几百个

RSM 每个像素都注入太贵。实践：按 [[学习笔记/cg/games202/专题/lpv/02-RSM-反射阴影贴图.md|02 RSM 反射阴影贴图：把"被照亮的表面"收集起来]] 的采样策略，只取几百个 VPL 注入。

$$
\text{精度} \leftarrow \text{采样数}
\qquad
\text{频率} \leftarrow \text{SH 阶数}
\qquad
\text{空间精度} \leftarrow \text{格子尺寸}
$$

三个分辨率旋钮在注入这一步**同时拧下**——这解释了为什么 LPV 天生是"低频、柔和、大颗粒"的 GI。

## 注入完成后：一张初始条件图

$$
\boxed{
\mathbf c_0(\text{cell})\ =\ \sum_{p\,\in\,\text{采样 VPL}}\Phi_p\cdot\mathbf A(n_p)\cdot[\text{p 落在此格}]
}
$$

此时场上的图像非常不均匀：只有被光直接照到的格子亮着，其余全黑。**但它已经是"场"了**——问题是光不会自己动。下一站解决"动"：光如何在格子间流动、以多快的速度流动。

## 本篇结论

$$
\boxed{
\text{注入}
=
\underbrace{\text{VPL 通量}}_{\text{多少光}}
\times
\underbrace{\text{clamped cosine 系数}}_{\text{往哪个方向}}
\times
\underbrace{\text{格子索引}}_{\text{放在哪里}}
}
$$

> 记忆压缩：**灯单变成场**：几百个 VPL，每个往自己格子里倒一片"朝法线方向的余弦朝霞"。位置粗到格子、方向粗到 2 阶 SH、数量粗到几百——三个粗换来的是：场很小（32³ 格）、很规整（3D 数组）、**可传播**。

下一站是 LPV 的灵魂机制：[[学习笔记/cg/games202/专题/lpv/04-传播-光在格子间流动.md|04 传播：光在格子间一格一格流动]]。
