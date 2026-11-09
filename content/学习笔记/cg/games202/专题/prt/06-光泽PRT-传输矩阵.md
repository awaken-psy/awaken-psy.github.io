---
title: 06 光泽 PRT：出射方向依赖让向量升级为矩阵
publish: true
updated: 2026-10-26T11:21:01.133Z
tags:
  - games202
  - prt
  - glossy
  - spherical-harmonics
  - transport-matrix
  - derivation
---


# 06 光泽 PRT：出射方向依赖让向量升级为矩阵

> 本篇在思维链上的位置：**推广与极限**。[[学习笔记/cg/games202/专题/prt/05-漫反射PRT-从积分到点乘.md|05 漫反射 PRT：把整个渲染方程压成一次点乘]] 的点乘依赖"传输与观察方向无关"。本篇放开这个假设，看推导如何自然地长出矩阵，以及它为什么止步于 glossy。

## 回看：漫反射的压缩来自哪

漫反射 BRDF 是常数 $f_r=\rho/\pi$，与出射方向 $\omega_o$ 无关，所以传输只是**三维**函数：

$$
T(p,\omega_i)
\qquad\text{——}\omega_o\text{ 不出现，每个点只需一列系数 }
\mathbf T(p)
$$

这就是点乘的来源。**压缩的额度，正是"对出射方向无依赖"这一条假设买的单**。

## Glossy：传输是四维函数

Glossy 材质的 BRDF $f_r(p,\omega_i,\omega_o)$ 与两端方向都相关——同一个点，从不同角度看，被照亮的响应不同：

$$
T(p,\omega_i,\omega_o)
=
f_r(p,\omega_i,\omega_o)\,
\max(0,\cos\theta_i)\,
V(p,\omega_i)
$$

对**每一个**观察方向 $\omega_o$，都有一个不同的"漫反射式"传输函数，也就有一套自己的 $\mathbf T$。观察方向连续变化，不可能每个方向存一列——除非把"随 $\omega_o$ 变化"这件事本身也投影。

## 推导：双投影，长出矩阵

### 第一次投影：对入射方向（和漫反射完全一样）

把光照的截断展开 $\tilde L(\omega_i)=\sum_n l_nB_n(\omega_i)$ 代入渲染方程。对固定的 $\omega_o$，交换求和与积分：

$$
L_o(p,\omega_o)
=
\sum_{n=1}^{N} l_n\,
\underbrace{
\int_{S^2} B_n(\omega_i)\,
T(p,\omega_i,\omega_o)\,d\omega_i
}_{g_n(\omega_o)}
$$

如果停在 这里，$g_n(\omega_o)$ 是一个必须**逐方向实时积分**的函数——不可行。

### 第二次投影：对出射方向也展开

$g_n(\omega_o)$ 本身是 $\omega_o$ 的球面函数，把它也投影到 SH（用 $B_m(\omega_o)$）：

$$
\boxed{
T_{nm}(p)
=
\int_{S^2}\int_{S^2}
B_n(\omega_i)\,
T(p,\omega_i,\omega_o)\,
B_m(\omega_o)\,
d\omega_i\,d\omega_o
}
$$

$$
L_o(p,\omega_o)
=
\sum_{m=1}^{N}
B_m(\omega_o)
\left[
\sum_{n=1}^{N}
T_{nm}(p)\,l_n
\right]
$$

![glossy：传输成为 4 维，通过矩阵存储从观察方向到光源方向的映射](<Attachments/Pasted image 20260808172420.png>)

## 矩阵的物理直觉：一个"方向转换器"

把 $N\times N$ 个数 $T_{nm}$ 排成矩阵 $\mathbf T(p)$，行索引 $m$（出射 SH），列索引 $n$（入射 SH）：

$$
\boxed{
\mathbf c(p) = \mathbf T(p)\,\mathbf l
\qquad\text{（出射光系数 = 矩阵 × 入射光系数）}
}
$$

$$
L_o(p,\omega_o) = \mathbf B(\omega_o)^T\,\mathbf c(p)
\qquad\text{（用出射 SH 重建任意观察方向的亮度）}
$$

读法：

> **传输矩阵是"入射光函数空间 → 出射光函数空间"的线性算子**。它把环境光的系数向量 $\mathbf l$ 变换成一个**新的球面函数的系数向量** $\mathbf c$——这个新函数就是"这个点反弹出去的辐射如何随观察方向分布"。查任意观察方向 $\omega_o$ 的亮度，只需用 SH 重建一次。

漫反射在这个视角下是特例：漫反射的出射辐射**不随 $\omega_o$ 变化**（是常数函数），而常数函数的 SH 展开只有 0 阶非零——所以矩阵的有效自由度塌缩成一列，退化为向量 $\mathbf T(p)$。**点乘是矩阵乘法的退化形态**。

## 复杂度与存储的代价

| | 漫反射 | Glossy |
|---|---|---|
| 传输依赖 | $T(p,\omega_i)$：3 维 | $T(p,\omega_i,\omega_o)$：4 维 |
| 每点存储 | $N$ 个数 | $N\times N$ 个数 |
| 每点运行时 | 点乘 $O(N)$ | 矩阵×向量 $O(N^2)$ |
| $N=16$ 时 | 16 个数 / 16 次乘加 | **256 个数** / 256 次乘加（每颜色通道） |

存储爆炸是 glossy PRT 的实际瓶颈。实践中的缓解手段：矩阵做**低秩近似 / PCA 压缩 / 聚类共享**（Sloan 后续论文的方向），或对 glossy 只用较低阶（如入射 9 项、出射 9 项的 9×9 矩阵）。原理上不改变"传输是矩阵"这个结构。

## 为什么镜面是 PRT 的终点

PRT 的整套压缩成立的前提是：**被投影的量在 SH 下系数衰减快**（低频）。逐级检查：

| 材质 | BRDF 的方向行为 | SH 可压缩性 |
|---|---|---|
| 漫反射 | 常数 | 3 阶后为零，完美 |
| Glossy | 有主方向的宽瓣 | 数阶内可接受 |
| 完美镜面 | $\delta(\omega_o - R\,\omega_i)$ 冲激 | **各阶系数都不可忽略** |

冲激函数的 SH 系数衰减极其缓慢——要无穷多阶才能重建一个"点"。截断重建出来的不是亮点，而是一圈振铃状的模糊斑。物理上等价的读法：

> 镜面反射需要**精确的方向信息**（把光源的样子映在表面上），而 SH 拿来压缩的恰恰是方向上的低频结构。信息不在低频里，压缩就无从谈起。

所以 PRT 的适用域天然止步于"低频 BRDF"：漫反射最优，粗糙 glossy 可用，越接近镜面越失真。镜面反射这条路由 [[学习笔记/cg/games202/lecture5 Real-time Environment Mapping 1.md|lecture5 Real-time Environment Mapping 1]] 的 prefiltering/split-sum（假设 $V=1$）接管——两种技术在 BRDF 频谱的两端各占一半，中间存在一段双方都不完美的空档。

## 本篇结论

$$
\boxed{
\begin{aligned}
\text{漫反射：}\quad &L_o(p)=\mathbf l\cdot\mathbf T(p)
&&O(N)\\
\text{Glossy：}\quad &L_o(p,\omega_o)=\mathbf B(\omega_o)^T\,\mathbf T(p)\,\mathbf l
&&O(N^2)
\end{aligned}
}
$$

> 向量变矩阵，不是引入了新技巧，而是同一条推导在"传输依赖出射方向"时的自然延伸：**对哪个变量依赖，就对哪个变量多投影一次**。

## 下一步

推导已经完备：diffuse 点乘、glossy 矩阵。剩下的全是工程——这些系数**怎么算出来**（离线）、**怎么存**、运行时**怎么写**。下一站：[[学习笔记/cg/games202/专题/prt/07-实现管线-预计算与运行时.md|07 实现管线：系数怎么算、怎么存、怎么用]]。
