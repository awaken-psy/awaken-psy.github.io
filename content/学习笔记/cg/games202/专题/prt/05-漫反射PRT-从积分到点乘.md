---
title: 05 漫反射 PRT：把整个渲染方程压成一次点乘
publish: true
updated: 2026-10-26T11:21:01.147Z
tags:
  - games202
  - prt
  - diffuse
  - spherical-harmonics
  - rendering-equation
  - derivation
---


# 05 漫反射 PRT：把整个渲染方程压成一次点乘

> 本篇在思维链上的位置：**核心推导**。前四篇准备了问题与工具，本篇用三步代数把带阴影的环境光渲染方程塌缩成运行时的一次点乘——PRT 的全部魔法就在这一页。

## 出发点：漫反射的渲染方程

漫反射（Lambertian）BRDF 是常数 $f_r=\rho/\pi$，与两端方向无关。把它代入 [[学习笔记/cg/games202/专题/prt/02-环境光阴影的困境.md|02 环境光阴影的困境：实时渲染为什么算不动]] 的完整方程，并把"下半球无贡献"用 $\max(0,\cdot)$ 显式写进被积函数（积分域从上半球 $\Omega^+$ 扩展到全球面 $S^2$，方便后面投影）：

$$
L_o(p)
=
\int_{S^2}
L(\omega_i)\,
\underbrace{
\frac{\rho}{\pi}\,
\max(0,\cos\theta_i)\,
V(p,\omega_i)
}_{\text{传输 transport：}\,T(p,\omega_i)}
\,d\omega_i
$$

$$
\boxed{
T(p,\omega_i)
=
\frac{\rho}{\pi}\,
\max(0,\cos\theta_i)\,
V(p,\omega_i)
}
$$

> 读法：**transport 是"这个点对每个方向入射光的固有响应"**——材质($\rho/\pi$)、朝向($\cos$)、几何($V$) 全部焊死在里面。只要场景静止、材质不变，它就永远不变。PRT 名字里的 "transfer" 指的就是它。

于是渲染方程取得极简形态：

$$
L_o(p) = \int_{S^2} L(\omega)\,T(p,\omega)\,d\omega
$$

这正是 [[学习笔记/cg/games202/专题/prt/03-函数即向量-基函数与投影.md|03 函数即向量：基函数、投影与正交]] 里"两个函数的积分"的形式。接下来三步，把积分变成点乘。

## 第一步：投影光照（换灯时做一次，全场景共享）

把环境光投影到前 $N$ 个 SH 基函数上（$N=9$ 或 $16$）：

$$
\boxed{
l_n = \int_{S^2} L(\omega)\,B_n(\omega)\,d\omega
\qquad\text{（}\mathbf l\text{ 是整张天空的 9~16 个坐标）}
}
$$

- 整个场景只需要**一份** $\mathbf l$（环境光是无限远的，对所有点相同）；
- 只在**换环境贴图**时重算，代价是一次对贴图的求和；
- 旋转天空时甚至不用重投影，直接旋转系数（[[学习笔记/cg/games202/专题/prt/04-球谐函数.md|04 球谐函数：球面上的正交基]] 性质三）。

同时得到光照的截断重建，后面运行时实际用的就是它：

$$
\tilde L(\omega) = \sum_{n=1}^{N} l_n B_n(\omega)
\qquad (\approx L)
$$

## 第二步：预计算传输（离线，每个点一次）

对**每个着色点 $p$**，把它的 transport 也投到同一组基上：

$$
\boxed{
T_n(p) = \int_{S^2} B_n(\omega)\,T(p,\omega)\,d\omega
}
$$

这一步是整个 PRT 中**唯一昂贵**的部分，也是"预计算"三个字的全部含义：

- 积分里含 $V(p,\omega)$，只能用射线追踪 + 蒙特卡洛来算（[[学习笔记/cg/rt in one weekend/rest_life/09-直接采样光源.md|第 9 章：直接采样光源]] 的 shadow ray 语言）；
- 它在**离线**执行，一个静态场景算一次；
- 输出是每个点 $N$ 个数（RGB 各一套）。

![每个着色点预计算 O(N) 个系数，ray tracing 过程顺便得到 visibility](<Attachments/Pasted image 20260808155438.png>)

具体怎么算（采样分布的选择、shadow ray 复用）在 [[学习笔记/cg/games202/专题/prt/07-实现管线-预计算与运行时.md|07 实现管线：系数怎么算、怎么存、怎么用]] 展开。本篇先假装 $T_n(p)$ 已经到手。

## 第三步：运行时点乘

把截断光照代入渲染方程，交换积分与有限求和（严格合法），再用正交性一次消掉所有交叉项：

$$
\begin{aligned}
L_o(p)
&=
\int_{S^2}
\left(\sum_{n=1}^{N} l_n B_n(\omega)\right)
T(p,\omega)\,d\omega\\
&=
\sum_{n=1}^{N} l_n
\underbrace{\int_{S^2} B_n(\omega)\,T(p,\omega)\,d\omega}_{\text{第二步已离线算好：}T_n(p)}\\
\end{aligned}
$$

$$
\boxed{
L_o(p)
=
\sum_{n=1}^{N} l_n\,T_n(p)
=
\mathbf l\cdot\mathbf T(p)
}
$$

![漫反射下 BRDF 为常数，着色变成一次点乘](<Attachments/Pasted image 20260808153333.png>)

对照 [[学习笔记/cg/games202/专题/prt/03-函数即向量-基函数与投影.md|03 函数即向量：基函数、投影与正交]] 的灵魂公式 $\int fg\,d\omega=\mathbf f\cdot\mathbf g$：光照的系数 $\mathbf l$ 乘上传输的系数 $\mathbf T(p)$——**整个渲染方程在运行时的全部开销，就是一次 9~16 维点乘**。

## 辨析一：近似到底发生在哪

这是初学 PRT 最容易糊涂的地方，值得单独掰开：

| 对象 | 是否被近似 | 何时 |
|---|---|---|
| 光照 $L$ | **是**。截断重建 $\tilde L=\sum l_nB_n$ 是近似 | 投影那一刻 |
| 传输 $T$ | **否**。$T_n=\int B_nT\,d\omega$ 是精确积分；且**从不重建** $T$ 本身 | — |
| 点乘 $\mathbf l\cdot\mathbf T$ | 精确等于 $\int \tilde L\cdot T\,d\omega$ | — |

> 关键理解：**传输的高频信息（阴影边缘的锐利明暗）不需要被重建**，它以"精确积分"的形式被封存在系数 $T_n$ 里。真正被丢掉的只有光照的高频部分。

那么丢掉光照高频，答案会差多少？用频率论证（[[学习笔记/cg/games202/lecture6 Real-time Environment Mapping 2.md|lecture6 Real-time Environment Mapping 2]]）：

$$
\text{积分结果频率} \le \min(\text{光照频率},\ \text{传输频率})
$$

漫反射 BRDF 本身就是低通滤波器（$\max(0,\cos\theta)$ 的系数 3 阶后归零，见 [[学习笔记/cg/games202/专题/prt/04-球谐函数.md|04 球谐函数：球面上的正交基]]），所以无论光照多复杂，漫反射的**正确答案**本来就是低频的——用低频 $\tilde L$ 去积分，误差天然很小。

反例也随之清晰：**小而亮的光源**（点光源、太阳在镜面地板上的高光）是光照里的高频成分，$\tilde L$ 表达不了，PRT-SH 会把它们"糊成一大片"→ 这正是 [[学习笔记/cg/games202/专题/prt/08-局限边界与思想延伸.md|08 PRT 的边界：它为什么没能统治实时渲染，以及留下了什么]] 要展开的边界。

## 辨析二：传输系数可以是负数

SH 基函数（除 0 阶）都有正负瓣（[[学习笔记/cg/games202/专题/prt/04-球谐函数.md|04 球谐函数：球面上的正交基]] 可视化图中的蓝/黄）。投影 $T_n=\int B_nT\,d\omega$ 是"在带符号坐标轴上取坐标"，所以：

```text
T_n < 0 完全正常 —— 系数是"坐标"，不是"能量"
例如某点的上方被遮、光只从偏 -y 的方向漏进来
它的 T(y 方向基) 自然是负的
```

点乘时正负系数与 $\mathbf l$ 中相应分量组合、相互抵消，最终 $L_o$ 仍是非负的辐射亮度。**不要**试图对 $\mathbf T$ 做裁剪或取绝对值——那等于破坏坐标系。

## Sanity check：完全照亮点必须复原

推导是否可信，用最简单的情形验证一次。取**无遮挡**（$V\equiv1$）、**白色**（$\rho=1$）的漫反射点，放进**均匀环境光** $L(\omega)=c$ 中。

物理预期：四面八方的均匀光，辐照度 $E=\pi c$，出射 $=\frac{1}{\pi}E=c$，即**表面应显示环境光本身的颜色 $c$**。

PRT 给出：

- 光照系数：$l_0=\int c\,Y_0^0\,d\omega=c\cdot 4\pi\cdot\frac{1}{2\sqrt\pi}=2\sqrt\pi\,c$；其余 $l_n=0$（均匀光没有高阶分量）
- 传输系数：$T_0=\int_{\Omega^+}Y_0^0\,\frac{\cos\theta}{\pi}\,d\omega=\frac{1}{\pi}\cdot\frac{1}{2\sqrt\pi}\cdot\pi=\frac{1}{2\sqrt\pi}$（用了 $\int_{\Omega^+}\cos\theta\,d\omega=\pi$）

$$
L_o = \mathbf l\cdot\mathbf T
=
\left(2\sqrt\pi\,c\right)\cdot\left(\frac{1}{2\sqrt\pi}\right)
=
\boxed{c}
\quad\checkmark
$$

点乘精确复原物理答案。顺带验证了 [[学习笔记/cg/games202/专题/prt/04-球谐函数.md|04 球谐函数：球面上的正交基]] 的 $\hat A_0$ 表：$T_0=\hat A_0/\pi$。被遮挡点的 sanity check 同样简单：$V\equiv0\Rightarrow\mathbf T=\mathbf 0\Rightarrow L_o=0$，全黑。

## 代价总账

| 阶段 | 漫反射直接蒙特卡洛（每帧） | PRT |
|---|---|---|
| 每点每帧 | 数百条 shadow ray + 光照查询 | **9~16 次乘加** |
| 遮挡计算 | 每帧重复 | 离线一次，永久保存 |
| 换光照 | 天然支持 | 重投影一次（全场景共享） |
| 旋转光照 | 天然支持 | 旋转系数向量（便宜，见 [[学习笔记/cg/games202/专题/prt/04-球谐函数.md|04 球谐函数：球面上的正交基]]） |
| 移动/变形场景 | 天然支持 | **全部作废，重跑离线** |

实时性来自最后两行之上的所有行；实时性的代价被压缩进最后一行。这就是 PRT 的交易结构。

## 本篇结论

$$
\boxed{
L_o(p)
=
\int_{S^2} L(\omega)\,T(p,\omega)\,d\omega
=
\mathbf l\cdot\mathbf T(p)
\quad
\begin{cases}
\mathbf l & \text{天空投到 SH，换灯时算，全场景共享}\\
\mathbf T(p) & \text{每个点的}\;V\cdot\cos\cdot f_r\;\text{投到 SH，离线射线追踪}\\
\cdot & \text{运行时唯一的运算}
\end{cases}
}
$$

记忆压缩：**灯是一列数，点是一列数，着色=点乘**。

## 下一步

点乘成立的前提是"传输与观察方向无关"。Glossy 材质一旦引入，$\omega_o$ 出现在 BRDF 里，$\mathbf T(p)$ 不再是一个向量——它升级为一个矩阵。下一站：[[学习笔记/cg/games202/专题/prt/06-光泽PRT-传输矩阵.md|06 光泽 PRT：出射方向依赖让向量升级为矩阵]]。
