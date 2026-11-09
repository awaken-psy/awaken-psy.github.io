---
title: 06 BRDF 查找表：把材质积分压成一张 2D 纹理
publish: true
updated: 2026-10-26T11:21:01.092Z
tags:
  - games202
  - ibl
  - brdf
  - lookup-table
  - fresnel
  - microfacet
---


# 06 BRDF 查找表：把材质积分压成一张 2D 纹理

> 本篇在思维链上的位置：**拆分的材质一半**。[[学习笔记/cg/games202/专题/ibl/05-预滤波环境贴图.md|05 预滤波环境贴图：把"光照均值"烧进 mip 链]] 解决了光照项，本篇处理 [[学习笔记/cg/games202/专题/ibl/04-拆分近似与三个条件.md|04 拆分近似与三个条件：整个 IBL 的理论地基]] 公式的第二个因子：$\int f_r\cos\theta_i\,d\omega_i$。它不能靠"卷积"预计算，但可以靠"参数太少"预计算。

## 待预计算的量

$$
\int_{\Omega^+} f_r(\omega_i,\omega_o)\,\cos\theta_i\,d\omega_i
\qquad\text{（以 microfacet GGX BRDF 为例）}
$$

![以 microfacet BRDF 为例的拆分第二阶段](<Attachments/Pasted image 20260807182153.png>)

## 它依赖哪些参数

![BRDF 积分依赖的三个参数：观察方向、粗糙度、R0](<Attachments/Pasted image 20260807182235.png>)

| 参数 | 维度 | 降维手段 | 剩下 |
|---|---|---|---|
| 观察方向 $\omega_o$ | 2 | **各向同性 BRDF**：绕法线旋转视角不改变积分值 | $\cos\theta_v$（1 维） |
| 粗糙度 | 1 | 无需处理 | 1 维 |
| $R_0$（Fresnel 反射率） | 3 (RGB) | **Schlick 对 $R_0$ 线性** → 拆成 scale/bias | 0 维（见下） |

三个参数削成两个——一张 2D 纹理的容量。逐个看削维的依据：

### 观察方向 → cosθ_v

各向同性的 GGX 分布绕法线对称，把 $\omega_o$ 绕 $n$ 转任意角度，积分值不变（把整个积分跟着转回去即可）。所以视角只剩一个自由度：$\cos\theta_v = n\cdot v$。

### R0 → 线性拆分（本篇点睛之笔）

Schlick Fresnel 近似：

$$
F = R_0 + (1-R_0)(1-\cos\theta)^5
= \underbrace{R_0\,(1-s)}_{\text{随 }R_0\text{ 线性}} + \underbrace{s}_{\text{与 }R_0\text{ 无关}}
\qquad
s=(1-\cos\theta)^5
$$

microfacet BRDF 中 $F$ 是**乘性因子**：$f_r=\frac{D\,F\,G}{4(n\cdot l)(n\cdot v)}$，于是 $f_r=\frac{f_r}{F}\cdot F$，代回积分：

$$
\boxed{
\int f_r\cos\theta_i\,d\omega_i
\approx
R_0\underbrace{\int \frac{f_r}{F}\,(1-s)\cos\theta_i\,d\omega_i}_{\text{scale}}
+
\underbrace{\int \frac{f_r}{F}\,s\cos\theta_i\,d\omega_i}_{\text{bias}}
}
$$

![把 R0 提出来，剩下的两个积分各自对每个 (roughness, cosθ_v) 产生一个值，存入二维纹理](<Attachments/Pasted image 20260807214251.png>)

两个关键读法：

1. **这一步是精确代数，不是近似**。$F$ 对 $R_0$ 是线性的（斜率 $(1-s)$、截距 $s$），线性函数穿过积分号不需要任何条件——积分是线性算子。Schlick 选这种形式，等于免费送了一张通用 LUT。
2. **拆出的两个积分都不再依赖 $R_0$**，于是"每个 (roughness, cosθ_v) 产生一个值"——两个积分 = 两张 2D 表 = 一张 RG 双通道纹理。

（课件把 Fresnel 的角度简记为单一 $\cos\theta$；完整推导里它在半程向量角 $v\cdot h$ 上取值，这一简化连同其它实现细节归入下面的误差清单。）

## LUT 的读法与两个角点自检

纹理两轴是 $(\cos\theta_v,\ \text{roughness})$：

| 角点 | 物理情形 | 应有值 | 解释 |
|---|---|---|---|
| $\cos\theta_v=1$，roughness $=0$ | 完美镜面、正对看 | scale $=1$，bias $=0$ | $F=R_0$，只剩 Fresnel 反射率 |
| $\cos\theta_v\to0$，roughness $=0$ | 完美镜面、掠射 | scale $\to0$，bias $\to1$ | 掠射角 Fresnel $\to1$，什么颜色都变镜面 |

第二个角点正是 LUT 可视化中"左下角一小块绿（bias 主导）"的来源：**光滑表面掠射时反射是白的**，与 $R_0$ 无关——LUT 的颜色分布本身就在讲 Fresnel 物理。

## 预计算内部的近似清单

LUT 是用离线蒙特卡洛积分算出来的（[[学习笔记/cg/games202/专题/ibl/07-实现管线.md|07 实现管线：预滤波、LUT 与运行时]] 给代码），积分过程内嵌了几个工程近似：

| 近似 | 内容 |
|---|---|
| N=V 假设 | 采样与掩蔽项的计算把 $v$ 与 $n$ 等同，掠射角误差增大 |
| Fresnel 角度简记 | 用 $\cos\theta$（或 $n\cdot v$）代替 $v\cdot h$ |
| 地平裁剪 | $\cos\theta_i\le0$ 的样本直接丢弃 |

它们共同决定了"为什么这张 LUT 对极端掠射角不准"——但作为一张 64×64 的小纹理，精度已经覆盖了绝大多数材质/视角组合。

## 运行时合流

两个因子在本篇合流成完整公式：

$$
\boxed{
L_o^{\text{spec}}
=
\underbrace{\text{PrefilteredEnv}(r,\ \text{rough})}_{\text{光照因子：查预滤波贴图}}
\times
\big(\text{color}_{R_0}\cdot\underbrace{\text{LUT.r}}_{\text{scale}}
+
\underbrace{\text{LUT.g}}_{\text{bias}}\big)
}
$$

注意 LUT 本身是**无色**的（灰度两通道）：颜色完全来自 $R_0$（RGB），这也是 $R_0$ 拆分的意义——一张小表服务所有颜色的材质。

## 本篇结论

$$
\boxed{
\text{材质积分}
\xrightarrow{\text{各向同性}}
(\cos\theta_v,\ \text{rough})
\xrightarrow{\text{Schlick 线性}}
\text{scale}+\text{bias}
\;=\;
\text{一张 2D 双通道 LUT}
}
$$

> 记忆压缩：**视角砍一半靠对称，$R_0$ 整个消失靠线性**。

两个因子的预计算方案都齐了。下一站把离线卷积、LUT 生成和运行时着色器串成流水线：[[学习笔记/cg/games202/专题/ibl/07-实现管线.md|07 实现管线：预滤波、LUT 与运行时]]。
