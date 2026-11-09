---
title: 03 闭式积分的钥匙：clamped cosine × 多边形
publish: true
updated: 2026-09-10T10:42:06.461Z
tags:
  - games202
  - ltc
  - clamped-cosine
  - closed-form
  - polygon-irradiance
---


# 03 闭式积分的钥匙：clamped cosine × 多边形

> 本篇在思维链上的位置：**盘点家底**。变形之前，先把"会积分的那个函数"的闭式结构看清楚——它是整场魔法的唯一支点，也是 LTC 名字里 Cosine 一词的由来。

## 会积分的函数：clamped cosine

老朋友第三次正面出场（PRT 04 的 Â 表、IBL 03 的辐照度核都是它）：

$$
D_c(\omega) = \max(0,\ \cos\theta)
$$

漫反射 BRDF 为常数时的整个材质项 $f_r\cdot\cos\theta = \frac{\rho}{\pi}\cos\theta$ 就是它乘个常数。**它对多边形光源的积分是图形学最古老的结果之一**（Lambert 时代的矢量辐照 / 多边形 form factor）：

$$
\boxed{
\int_{P} D_c(\omega)\,d\omega
=
\text{逐边求和的闭式}
\qquad
P=\text{任意凸多边形（方向域）}
}
$$

## 闭式的结构：多边形的每条边独立贡献

不写全公式，只看**结构**——结构才是 LTC 能复用它的原因：

```text
多边形 P 的顶点 p₁, p₂, …, pₙ（着色点指向顶点的单位方向）

I(P) = Σⱼ  [第 j 条边 (pⱼ, pⱼ₊₁) 的解析贡献]
      贡献只依赖：这条边的两个顶点方向 + 法线 n
      （每条边贡献一个由 F(·) 类闭式函数表达的项）
```

两个性质价值千金：

1. **逐边独立** → 任意凸多边形 = 边的求和 → 矩形、五边形、任意 N 边形**一个引擎通吃**；
2. **只依赖顶点方向** → 只要"顶点"变了，代入同一公式即可，**完全不关心顶点是怎么来的**。

> 第二条正是 LTC 的突破口：**闭式只要求"给我多边形的顶点方向"——它不问这些顶点被谁变过形**。

## 为什么 GGX 瓣享受不到这个待遇

GGX 的材质项（固定 $\omega_o$，对 $\omega_i$）：

$$
D_{\text{GGX}}(\omega_i)
=
\frac{D(h)\,G(l,v)\,F(v,h)}{4\,(n\cdot l)(n\cdot v)}\cdot(n\cdot l)
$$

- $D(h)$：半程向量的复杂有理函数，分母带 $\cos^4\theta_h$；
- $G$：掩蔽-阴影项，又一个有理函数；
- 视角依赖：瓣的**位置**（绕向镜面方向）和**形状**（拉歪、变宽）随 $\omega_o$ 变化。

把它代入 $\int_P$ 的闭式推导，所有边项立刻崩坏——**没有任何经典结构可以复用**。对每对（形状, 材质, 视角）数值积分，实时预算下不可行。

## 两件家底的摆放

$$
\boxed{
\text{会积分的核：}\ clamped\ cosine\quad\checkmark
\qquad
\text{想要积分的核：}\ GGX\ 瓣\quad\text{（不闭式）}
}
$$

于是问题被压缩成一句：

> **能不能找到一个"变换"，把 GGX 瓣变成 clamped cosine？**

如果 GGX 瓣 = "变换后的 clamped cosine"，那么积分可以通过换元全部转嫁给**变换后的多边形**——而 clamped cosine 的闭式"只看顶点"，恰好不在乎顶点被变过形。全部赌注押在"变什么样的形"上——下一篇正式揭晓：一个线性变换 M 就够。下一站：[[学习笔记/cg/games202/专题/ltc/04-线性变换的魔法.md|04 线性变换的魔法：M 揉捏瓣，M⁻¹ 转嫁灯]]。

## 本篇结论

$$
\boxed{
\text{clamped cosine} \times \text{多边形} = \text{逐边闭式}
\;\Longleftrightarrow\;
\text{只要顶点方向给得出，闭式就能用}
}
$$

> 记忆压缩：**余弦瓣天生会积分**——而且它的闭式是"逐边求和、只认顶点"的宽容结构。LTC 整场戏的台词就此定下：GGX 瓣演不了这个角色，就找一个"整形余弦"来替它演。
