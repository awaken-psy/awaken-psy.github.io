---
title: 修改后的反向传播算法
publish: true
updated: 2026-07-13T09:42:58.353Z
---

# 修改后的反向传播算法

> 出自《神经网络与深度学习》第二章练习

---

## 原题

![题目](学习笔记/ai/nndl/image/ch02_modified_neuron_exercise.png)

---

## 第一题：单个修正神经元的反向传播

**题目：** 假设我们改变一个前馈网络中的单个神经元，使得那个神经元的输出是 $f(\sum_j w_j x_j + b)$，其中 $f$ 是和 S 型函数不同的某一函数。如何调整反向传播算法？

### 分析

四个基本方程中，激活函数 $\sigma$ 只出现在一个地方：$\sigma'(z)$。如果某个神经元的激活函数换成了 $f$，那么该神经元所在层的 $\sigma'(z^l)$ 就要替换为 $f'(z^l)$。

### 具体影响

假设第 $l$ 层的第 $j$ 个神经元使用了 $f$ 而非 $\sigma$。

**BP1（输出层误差）：**

如果该神经元在输出层：

$$\delta_j^L = \frac{\partial C}{\partial a_j^L} f'(z_j^L)$$

原来 $\sigma'(z_j^L)$ 变成了 $f'(z_j^L)$。

**BP2（误差反向传播）：**

如果该神经元在隐藏层 $l$：

$$\delta_j^l = \sum_k w_{kj}^{l+1} \delta_k^{l+1} \cdot f'(z_j^l)$$

矩阵形式：

$$\delta^l = ((w^{l+1})^T \delta^{l+1}) \odot f'(z^l)$$

原来 $\sigma'(z^l)$ 变成了 $f'(z^l)$。注意这里 $f'$ 只作用于使用了 $f$ 的那个神经元的 $z_j^l$，其余神经元仍然用 $\sigma'$。

**BP3（偏置梯度）：** 不变，$\frac{\partial C}{\partial b_j^l} = \delta_j^l$。

**BP4（权重梯度）：** 不变，$\frac{\partial C}{\partial w_{jk}^l} = a_k^{l-1} \delta_j^l$。

### 结论

只需要把涉及该神经元的 $\sigma'(z_j^l)$ 替换为 $f'(z_j^l)$ 即可，其余全部不变。反向传播的框架完全通用，不依赖于具体激活函数。

---

## 第二题：线性神经元上的反向传播

**题目：** 假设我们将非线性神经元的 $\sigma$ 函数替换为 $\sigma(z) = z$。重写反向传播算法。

### 分析

线性激活函数 $\sigma(z) = z$，所以导数为：

$$\sigma'(z) = 1$$

### 四个方程的变化

**BP1：**

原来：

$$\delta^L = \nabla_a C \odot \sigma'(z^L)$$

现在 $\sigma'(z^L) = 1$：

$$\boxed{\delta^L = \nabla_a C}$$

二次代价函数下：

$$\delta^L = (a^L - y)$$

**BP2：**

原来：

$$\delta^l = ((w^{l+1})^T \delta^{l+1}) \odot \sigma'(z^l)$$

现在 $\sigma'(z^l) = 1$（全 1 向量，Hadamard 乘以全 1 等于不变）：

$$\boxed{\delta^l = (w^{l+1})^T \delta^{l+1}}$$

**BP3：** 不变：

$$\frac{\partial C}{\partial b} = \delta$$

**BP4：** 不变：

$$\frac{\partial C}{\partial w} = a_{\text{in}} \delta_{\text{out}}$$

### 直觉

线性神经元没有"饱和"问题。误差传递时不再被 $\sigma'(z)$ 衰减（sigmoid 在饱和时 $\sigma' \to 0$，梯度消失）。线性网络中误差可以无损地反向传播，但代价是网络失去了非线性表达能力——多层线性网络等价于单层线性网络。
