---
title: 梯度不稳定问题
publish: true
updated: 2026-07-20T09:50:27.858Z
---

# 梯度不稳定问题

> 出自《神经网络与深度学习》第 5.2 节

---

## 原题

![练习1](学习笔记/ai/nndl/image/ch05_vanishing_gradient_exercises_1.png)

![练习2](学习笔记/ai/nndl/image/ch05_vanishing_gradient_exercises_2.png)

---

## 练习 1：$|w\sigma'(wa+b)| \geq 1$ 的条件

**题目：** 考虑乘积 $|w\sigma'(wa+b)|$。在什么条件下 $\geq 1$？证明满足条件的输入激活区间很窄。

### (1) 证明 $|w| \geq 4$

$\sigma'(z)$ 的最大值是 $0.25$（在 $z=0$ 时取到）：

$$\sigma'(z) = \sigma(z)(1-\sigma(z)) \leq \frac{1}{4}$$

所以要使 $|w\sigma'(wa+b)| \geq 1$，至少需要：

$$|w| \cdot \frac{1}{4} \geq 1 \implies |w| \geq 4 \qquad \blacksquare$$

### (2) 证明满足条件的 $a$ 的区间宽度

设 $|w\sigma'(wa+b)| \geq 1$，即：

$$|w| \cdot \sigma'(wa+b) \geq 1$$

令 $z = wa + b$，则 $\sigma'(z) = \frac{1}{1+e^{-z}} \cdot \frac{1}{1+e^{z}} = \frac{e^z}{(1+e^z)^2}$。

要解 $\sigma'(z) \geq 1/|w|$，即：

$$\frac{e^z}{(1+e^z)^2} \geq \frac{1}{|w|}$$

令 $t = e^z > 0$，不等式变为：

$$\frac{t}{(1+t)^2} \geq \frac{1}{|w|}$$

$$|w| \cdot t \geq (1+t)^2$$

$$|w| \cdot t \geq 1 + 2t + t^2$$

$$t^2 - (|w|-2)t + 1 \leq 0$$

这是一元二次不等式 $t^2 - (|w|-2)t + 1 \leq 0$。判别式 $\Delta = (|w|-2)^2 - 4 = |w|^2 - 4|w| = |w|(|w|-4)$。

当 $|w| \geq 4$ 时 $\Delta \geq 0$，两个根为：

$$t_{1,2} = \frac{|w|-2 \pm \sqrt{|w|^2 - 4|w|}}{2} = \frac{|w|-2 \pm \sqrt{|w|(|w|-4)}}{2}$$

不等式在 $t \in [t_1, t_2]$ 之间成立。对应的 $z = \ln t$ 的范围为 $[\ln t_1, \ln t_2]$。

区间宽度（在 $z$ 空间）：

$$\Delta z = \ln t_2 - \ln t_1 = \ln \frac{t_2}{t_1}$$

由韦达定理 $t_1 \cdot t_2 = 1$，所以 $t_2 = 1/t_1$，$\Delta z = \ln(1/t_1^2) = -2\ln t_1$。

取 $t_1 = \frac{|w|-2 - \sqrt{|w|(|w|-4)}}{2}$（较小的根），$z$ 区间宽度为：

$$\Delta z = \ln t_2 - \ln t_1 = 2\ln t_2$$

其中 $t_2 = \frac{|w|-2 + \sqrt{|w|(|w|-4)}}{2} = \frac{|w|(1+\sqrt{1-4/|w|}) - 2}{2}$。

从 $z$ 转换回 $a$（$z = wa + b$，$a = (z-b)/w$）：

$$\Delta a = \frac{\Delta z}{|w|} = \frac{2}{|w|} \ln\left(\frac{|w|(1+\sqrt{1-4/|w|}) - 2}{2}\right)$$

化简（利用 $t_2 = \frac{|w|(1+\sqrt{1-4/|w|})}{2} - 1$）：

$$\boxed{\Delta a = \frac{2}{|w|} \ln\left(\frac{|w|(1+\sqrt{1-4/|w|})}{2} - 1\right)} \qquad \blacksquare$$

### (3) 数值上说明 $|w| = 6.9$ 时取最大值约 0.45

定义 $f(W) = \frac{2}{W} \ln\left(\frac{W(1+\sqrt{1-4/W})}{2} - 1\right)$，求 $f$ 的最大值。

对几个 $W$ 值计算：

| $|w|$ | $f(|w|)$ |
|---|---|
| 4.0 | 0 |
| 5.0 | $\approx 0.30$ |
| 6.0 | $\approx 0.41$ |
| 6.9 | $\approx 0.45$ |
| 8.0 | $\approx 0.43$ |
| 10.0 | $\approx 0.38$ |
| 100 | $\approx 0.093$ |

在 $|w| = 6.9$ 附近达到最大值 $\approx 0.45$。

**结论：** 即使 $|w|$ 取最优值，满足 $|w\sigma'(wa+b)| \geq 1$ 的输入区间宽度也**不超过 0.45**。这意味着：

- 在大部分输入范围内，$|w\sigma'(wa+b)| < 1$
- 只有在很窄的区间内梯度才不会衰减
- 所以**梯度消失问题无法通过调权重完全避免** $\blacksquare$

---

## 练习 2：幺神经元（Identity Neuron）

**题目：** 考虑单输入神经元 $x$，权重 $w_1$，偏置 $b$，输出权重 $w_2$。证明可以构造 $w_2 \sigma(w_1 x + b) \approx x$，$x \in [0,1]$。

### 证明

**思路：** sigmoid 在 $z=0$ 附近近似线性：$\sigma(z) \approx \frac{1}{2} + \frac{z}{4}$。利用这个线性区，让神经元充当"直通"的幺元。

#### 第 1 步：中心化

令 $x = \frac{1}{2} + \Delta$，其中 $\Delta \in [-\frac{1}{2}, \frac{1}{2}]$。

设偏置 $b = -\frac{w_1}{2}$，则加权输入为：

$$z = w_1 x + b = w_1\left(\frac{1}{2} + \Delta\right) - \frac{w_1}{2} = w_1 \Delta$$

#### 第 2 步：泰勒展开

当 $w_1$ 较小时，$z = w_1\Delta$ 较小，对 $\sigma(z)$ 在 $z=0$ 处泰勒展开：

$$\sigma(w_1\Delta) \approx \sigma(0) + \sigma'(0) \cdot w_1\Delta = \frac{1}{2} + \frac{w_1\Delta}{4}$$

#### 第 3 步：乘以 $w_2$，匹配系数

$$w_2 \sigma(w_1\Delta) \approx \frac{w_2}{2} + \frac{w_2 w_1}{4}\Delta$$

要使输出 $\approx x = \frac{1}{2} + \Delta$，匹配常数项和线性项：

$$\begin{cases} \dfrac{w_2}{2} = \dfrac{1}{2} \\[6pt] \dfrac{w_2 w_1}{4} = 1 \end{cases}$$

解得：

$$\boxed{w_2 = 1, \quad w_1 = 4, \quad b = -2}$$

#### 第 4 步：验证

$$w_2 \sigma(w_1 x + b) = \sigma(4x - 2)$$

| $x$ | $4x-2$ | $\sigma(4x-2)$ | 目标 $x$ | 误差 |
|---|---|---|---|---|
| 0.00 | -2.0 | 0.119 | 0.00 | 0.119 |
| 0.25 | -1.0 | 0.269 | 0.25 | 0.019 |
| 0.50 | 0.0 | 0.500 | 0.50 | 0.000 |
| 0.75 | 1.0 | 0.731 | 0.75 | 0.019 |
| 1.00 | 2.0 | 0.881 | 1.00 | 0.119 |

中心附近近似很好，边缘有偏差——因为 sigmoid 的两端趋于平缓，无法完全线性。但在 $x \in [0.25, 0.75]$ 范围内误差已很小。 $\blacksquare$

**直觉：** sigmoid 在 $z=0$ 处的切线斜率是 $\sigma'(0) = 1/4$。要让输出随输入以 $1:1$ 变化，需要 $w_1 \times 1/4 \times w_2 = 1$，即 $w_1 w_2 = 4$。同时常数项要求 $w_2/2 = 1/2$，即 $w_2 = 1$，所以 $w_1 = 4$。偏置 $b = -w_1/2 = -2$ 把 sigmoid 的中心对准 $x = 1/2$。

---

## 练习 3：导数很大的激活函数能避免梯度不稳定吗？

**题目：** 假设使用一个导数值非常大的激活函数，能避免梯度不稳定问题吗？

### 解答

**不能。** 会从一个极端走向另一个极端：从梯度消失变成**梯度爆炸**。

BP2 公式：

$$\delta^l = (w^{l+1})^T \delta^{l+1} \odot \sigma'(z^l)$$

每往前传一层，乘以 $\sigma'(z^l)$。

| 情况 | $\sigma'(z)$ | 乘积效应 | 结果 |
|---|---|---|---|
| sigmoid | $\leq 0.25$ | 每层缩小 | 梯度消失 |
| 导数很大的函数 | $\gg 1$ | 每层放大 | **梯度爆炸** |

梯度爆炸同样有害：

```
梯度消失:                  梯度爆炸:
  δ^4 = 1.0                  δ^4 = 1.0
  δ^3 ≈ 0.25                 δ^3 ≈ 10
  δ^2 ≈ 0.0625               δ^2 ≈ 100
  δ^1 ≈ 0.0156               δ^1 ≈ 1000  ← 爆炸！
  → 前面的层学不动             → 权重剧烈震荡，发散
```

### 本质问题

梯度不稳定是**乘积链**的结构性问题，和激活函数导数的大小无关：

- $|\sigma'| < 1$：连乘 → 0（消失）
- $|\sigma'| > 1$：连乘 → ∞（爆炸）
- $|\sigma'| = 1$：连乘不变（理想，如 ReLU 的正区间）

**只要 $|\sigma'| \neq 1$，多层连乘就会导致不稳定。** 解决方案是让激活函数的导数在大部分区域接近 1（如 ReLU）或使用残差连接（ResNet）。
