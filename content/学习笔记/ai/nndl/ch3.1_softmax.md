---
title: 柔性最大值（Softmax）与对数似然代价
publish: true
updated: 2026-07-16T07:25:47.498Z
---

# 柔性最大值（Softmax）与对数似然代价

> 出自《神经网络与深度学习》第三章

---

## 原题

![练习1](学习笔记/ai/nndl/image/ch03_softmax_exercises_1.png)

![练习2](学习笔记/ai/nndl/image/ch03_softmax_exercises_2.png)

---

## 练习 1：S 型输出层的激活值和不为 1

**题目：** 构造例子表明在使用 S 型输出层的网络中输出激活值 $a^L_j$ 的和并不会确保为 1。

### 解答

S 型神经元的输出 $a^L_j = \sigma(z^L_j) = \frac{1}{1+e^{-z^L_j}}$，每个输出独立取值在 $(0,1)$。

举例：3 个输出神经元，$z = [0, 0, 0]$：

$$a = [\sigma(0), \sigma(0), \sigma(0)] = [0.5, 0.5, 0.5]$$

和为 $0.5+0.5+0.5 = 1.5 \neq 1$。

而 softmax 的 $a^L_j = \frac{e^{z^L_j}}{\sum_k e^{z^L_k}}$，分母是所有 $e^{z^L_k}$ 的和，保证了和恒为 1。 $\blacksquare$

---

## 练习 2：柔性最大值的单调性

**题目：** 证明 $j=k$ 时 $\partial a^L_j / \partial z^L_k$ 为正，$j \neq k$ 时为负。

### 解答

Softmax 定义：

$$a^L_j = \frac{e^{z^L_j}}{\sum_k e^{z^L_k}} = \frac{e^{z^L_j}}{S}, \quad S = \sum_k e^{z^L_k}$$

**情况 1：$j = k$**

$$\frac{\partial a^L_j}{\partial z^L_j} = \frac{e^{z^L_j} \cdot S - e^{z^L_j} \cdot e^{z^L_j}}{S^2} = \frac{e^{z^L_j}(S - e^{z^L_j})}{S^2} = a^L_j(1 - a^L_j) > 0$$

因为 $0 < a^L_j < 1$，所以为正。提高 $z^L_j$ → $a^L_j$ 增大。

**情况 2：$j \neq k$**

$$\frac{\partial a^L_j}{\partial z^L_k} = \frac{0 \cdot S - e^{z^L_j} \cdot e^{z^L_k}}{S^2} = -\frac{e^{z^L_j} \cdot e^{z^L_k}}{S^2} = -a^L_j \cdot a^L_k < 0$$

因为 $a^L_j, a^L_k > 0$，所以为负。提高 $z^L_k$ → $a^L_j$ 减小。

**直觉：** softmax 是一个"零和博弈"——一个输出的概率增大，其他所有输出的概率必然减小，因为总和恒为 1。 $\blacksquare$

---

## 练习 3：柔性最大值的非局部性

**题目：** 解释为何对于柔性最大值层，任何特定的输出激活值 $a^L_j$ 依赖所有的带权输入。

### 解答

S 型层：$a^L_j = \sigma(z^L_j)$，$a^L_j$ 只依赖自己的 $z^L_j$，与其他神经元无关。

柔性最大值层：

$$a^L_j = \frac{e^{z^L_j}}{\sum_k e^{z^L_k}}$$

分母 $S = \sum_k e^{z^L_k}$ 包含**所有**神经元的 $z^L_k$。改变任何一个 $z^L_k$ 都会改变分母，从而改变所有 $a^L_j$。

这就是"非局部性"的含义：每个输出都依赖于全部输入，而不是只依赖自己那一个。 $\blacksquare$

---

## 练习 4：逆转柔性最大值层

**题目：** 假设 $a^L_j$ 已知，证明 $z^L_j = \ln a^L_j + C$，其中 $C$ 独立于 $j$。

### 解答

由 softmax 定义：

$$a^L_j = \frac{e^{z^L_j}}{\sum_k e^{z^L_k}} = \frac{e^{z^L_j}}{S}$$

取对数：

$$\ln a^L_j = \ln e^{z^L_j} - \ln S = z^L_j - \ln S$$

所以：

$$z^L_j = \ln a^L_j + \ln S$$

令 $C = \ln S = \ln\left(\sum_k e^{z^L_k}\right)$，这个 $C$ 对所有 $j$ 都是同一个值（是所有 $z$ 的函数，但不依赖具体的 $j$）：

$$\boxed{z^L_j = \ln a^L_j + C} \qquad \blacksquare$$

---

## 问题 1：推导方程 (81) 和 (82)

**题目：** 对数似然代价 $C = -\ln a^L_y$，推导 $\partial C / \partial b^L_j = a^L_j - y_j$ 和 $\partial C / \partial w^L_{jk} = a^{L-1}_k(a^L_j - y_j)$。

### 解答

先算 $\partial C / \partial z^L_j$（即 $\delta^L_j$）：

$$C = -\ln a^L_y = -\ln \frac{e^{z^L_y}}{S} = -z^L_y + \ln S$$

其中 $S = \sum_k e^{z^L_k}$。

**当 $j = y$（正确类别）：**

$$\frac{\partial C}{\partial z^L_j} = -1 + \frac{e^{z^L_j}}{S} = -1 + a^L_j$$

**当 $j \neq y$：**

$$\frac{\partial C}{\partial z^L_j} = 0 + \frac{e^{z^L_j}}{S} = a^L_j$$

两种情况可以统一写成：

$$\frac{\partial C}{\partial z^L_j} = a^L_j - y_j$$

其中 $y$ 是 one-hot 向量（正确类别位置为 1，其余为 0）。

**偏置梯度（BP3）：**

$$\boxed{\frac{\partial C}{\partial b^L_j} = \delta^L_j = a^L_j - y_j} \tag{81}$$

**权重梯度（BP4）：**

$$\frac{\partial C}{\partial w^L_{jk}} = \frac{\partial C}{\partial z^L_j} \cdot \frac{\partial z^L_j}{\partial w^L_{jk}} = (a^L_j - y_j) \cdot a^{L-1}_k$$

$$\boxed{\frac{\partial C}{\partial w^L_{jk}} = a^{L-1}_k(a^L_j - y_j)} \tag{82} \qquad \blacksquare$$

和交叉熵 + sigmoid 的公式形式完全一致！梯度不含 $\sigma'$，不会学习缓慢。

---

## 问题 2：柔性最大值名称的由来

**题目：** 广义 softmax $a^L_j = \frac{e^{c z^L_j}}{\sum_k e^{c z^L_k}}$，证明 $c \to \infty$ 时输出激活值的极限。

### 解答

设 $z^L_m = \max_k z^L_k$（最大的那个），则：

$$a^L_j = \frac{e^{c z^L_j}}{\sum_k e^{c z^L_k}} = \frac{e^{c(z^L_j - z^L_m)}}{\sum_k e^{c(z^L_k - z^L_m)}}$$

分子分母同除以 $e^{c z^L_m}$（最大值），这样最大项变成 $e^0 = 1$。

当 $c \to \infty$：

- **$j = m$（最大值的项）：** 分子 $= e^0 = 1$，分母中该项 $= 1$
- **$j \neq m$（非最大项）：** 分子 $= e^{c(z^L_j - z^L_m)} \to 0$（因为 $z^L_j - z^L_m < 0$）

分母 $\to 1$（只有最大项贡献），所以：

$$a^L_j \to \begin{cases} 1 & j = m = \arg\max_k z^L_k \\ 0 & \text{其他} \end{cases}$$

这就是 **argmax 函数**（硬最大值）——直接取最大值位置为 1，其余为 0。

$c=1$ 的 softmax 是这个硬 argmax 的"软化版"——不是非黑即白，而是用指数函数平滑过渡。**"柔性"最大值 = "软"最大值 = softmax。** $\blacksquare$

---

## 问题 3：柔性最大值和对数似然的反向传播

**题目：** 证明 $\delta^L_j = a^L_j - y_j$。

### 解答

这和问题 1 的推导完全一致：

$$\delta^L_j \equiv \frac{\partial C}{\partial z^L_j}$$

由问题 1 已证：

$$\frac{\partial C}{\partial z^L_j} = a^L_j - y_j$$

所以：

$$\boxed{\delta^L_j = a^L_j - y_j} \tag{84} \qquad \blacksquare$$

---

## 总结

| 组合 | $\delta^L$ | 学习缓慢？ | 输出是概率？ |
|---|---|---|---|
| sigmoid + 二次代价 | $(a-y)\sigma'(z)$ | ✅ 会 | ❌ 和不为 1 |
| sigmoid + 交叉熵 | $a - y$ | ❌ 不会 | ❌ 和不为 1 |
| softmax + 对数似然 | $a - y$ | ❌ 不会 | ✅ 和为 1 |

**softmax + 对数似然 = 交叉熵 + sigmoid 的"概率版"。** 梯度形式完全一样，但 softmax 额外保证了输出是合法的概率分布（非负 + 和为 1）。
