---
title: 反向传播四个基本方程的证明
publish: true
updated: 2026-07-13T09:39:56.026Z
---

# 反向传播四个基本方程的证明

> 出自《神经网络与深度学习》第二章

---

## 前置定义

在证明之前，先明确记号：

- $z_j^l$：第 $l$ 层第 $j$ 个神经元的加权输入，$z_j^l = \sum_k w_{jk}^l a_k^{l-1} + b_j^l$
- $a_j^l$：第 $l$ 层第 $j$ 个神经元的激活值，$a_j^l = \sigma(z_j^l)$
- $\delta_j^l$：第 $l$ 层第 $j$ 个神经元的误差，定义为 $\delta_j^l \equiv \frac{\partial C}{\partial z_j^l}$
- $C$：代价函数（单个样本）

核心工具是**链式法则**：

$$\frac{\partial C}{\partial x} = \sum_j \frac{\partial C}{\partial y_j} \frac{\partial y_j}{\partial x}$$

---

## BP1：输出层误差

$$\delta_j^L = \frac{\partial C}{\partial a_j^L} \sigma'(z_j^L) \tag{BP1}$$

### 证明

由误差的定义出发：

$$\delta_j^L = \frac{\partial C}{\partial z_j^L}$$

$C$ 不直接依赖 $z_j^L$，而是通过 $a_j^L$ 间接依赖（$a_j^L = \sigma(z_j^L)$）。用链式法则：

$$\delta_j^L = \frac{\partial C}{\partial z_j^L} = \sum_k \frac{\partial C}{\partial a_k^L} \frac{\partial a_k^L}{\partial z_j^L}$$

当 $k \neq j$ 时，$a_k^L$ 不依赖 $z_j^L$（不同神经元之间没有连接），所以 $\frac{\partial a_k^L}{\partial z_j^L} = 0$，求和只剩 $k = j$ 这一项：

$$\delta_j^L = \frac{\partial C}{\partial a_j^L} \frac{\partial a_j^L}{\partial z_j^L}$$

而 $a_j^L = \sigma(z_j^L)$，所以：

$$\frac{\partial a_j^L}{\partial z_j^L} = \sigma'(z_j^L)$$

代入：

$$\boxed{\delta_j^L = \frac{\partial C}{\partial a_j^L} \sigma'(z_j^L)} \qquad \blacksquare$$

### 矩阵形式

$$\delta^L = \nabla_a C \odot \sigma'(z^L) \tag{BP1a}$$

其中 $\nabla_a C$ 是 $C$ 对输出激活值 $a^L$ 的梯度向量，$\odot$ 是逐元素乘法（Hadamard 积）。

二次代价函数 $C = \frac{1}{2}\sum_j (y_j - a_j^L)^2$ 时，$\nabla_a C = (a^L - y)$，所以：

$$\delta^L = (a^L - y) \odot \sigma'(z^L) \tag{30}$$

---

## BP2：误差反向传播

$$\delta^l = ((w^{l+1})^T \delta^{l+1}) \odot \sigma'(z^l) \tag{BP2}$$

### 证明

由误差的定义出发：

$$\delta_j^l = \frac{\partial C}{\partial z_j^l}$$

$C$ 不直接依赖 $z_j^l$，而是通过第 $l+1$ 层的加权输入 $z^{l+1}$ 间接依赖。用链式法则：

$$\delta_j^l = \sum_k \frac{\partial C}{\partial z_k^{l+1}} \frac{\partial z_k^{l+1}}{\partial z_j^l}$$

第一项 $\frac{\partial C}{\partial z_k^{l+1}}$ 就是第 $l+1$ 层第 $k$ 个神经元的误差 $\delta_k^{l+1}$。

第二项需要展开 $z_k^{l+1}$：

$$z_k^{l+1} = \sum_j w_{kj}^{l+1} a_j^l + b_k^{l+1} = \sum_j w_{kj}^{l+1} \sigma(z_j^l) + b_k^{l+1}$$

对 $z_j^l$ 求偏导：

$$\frac{\partial z_k^{l+1}}{\partial z_j^l} = w_{kj}^{l+1} \sigma'(z_j^l)$$

代入：

$$\delta_j^l = \sum_k \delta_k^{l+1} w_{kj}^{l+1} \sigma'(z_j^l) = \sigma'(z_j^l) \sum_k w_{kj}^{l+1} \delta_k^{l+1}$$

注意 $\sum_k w_{kj}^{l+1} \delta_k^{l+1}$ 正好是矩阵乘法 $(w^{l+1})^T \delta^{l+1}$ 的第 $j$ 个元素，写成矩阵形式：

$$\boxed{\delta^l = ((w^{l+1})^T \delta^{l+1}) \odot \sigma'(z^l)} \qquad \blacksquare$$

### 为什么 $\sum_k w_{kj}^{l+1} \delta_k^{l+1} = [(w^{l+1})^T \delta^{l+1}]_j$？

矩阵乘法的基本规则：矩阵 $A$ 乘以向量 $v$，结果的第 $i$ 个元素是 $A$ 的第 $i$ **行**和 $v$ 的点积：

$$[Av]_i = \sum_k A_{ik} v_k$$

而我们的求和是 $\sum_k w_{kj}^{l+1} \delta_k^{l+1}$，**固定 $j$，对 $k$ 求和**，下标顺序是 $kj$。这等于取 $w^{l+1}$ 的第 $j$ **列**和 $\delta^{l+1}$ 做点积。

但矩阵乘法是"行 × 向量"，不是"列 × 向量"。所以需要**转置**：$w^T$ 的第 $j$ 行 = $w$ 的第 $j$ 列。因此：

$$\sum_k w_{kj}^{l+1} \delta_k^{l+1} = [(w^{l+1})^T \delta^{l+1}]_j$$

#### 具体数字验证

假设 $l+1$ 层有 3 个神经元，$l$ 层有 2 个神经元：

$$w^{l+1} = \begin{bmatrix} 2 & 5 \\ 3 & 7 \\ 1 & 9 \end{bmatrix}, \quad \delta^{l+1} = \begin{bmatrix} 4 \\ 1 \\ 2 \end{bmatrix}$$

当 $j=1$ 时：

$$\sum_k w_{k1} \delta_k = 5 \times 4 + 7 \times 1 + 9 \times 2 = 45$$

用转置矩阵验证：

$$(w^{l+1})^T = \begin{bmatrix} 2 & 3 & 1 \\ 5 & 7 & 9 \end{bmatrix}$$

$$[(w^{l+1})^T \delta^{l+1}]_1 = 5 \times 4 + 7 \times 1 + 9 \times 2 = 45 \quad \checkmark$$

### 直觉

- $(w^{l+1})^T \delta^{l+1}$：把后一层的误差按权重的转置**反向搬运**到当前层
- $\odot \sigma'(z^l)$：用当前层激活函数导数**过滤**（饱和的神经元误差传不过去）

---

## BP3：偏置的梯度

$$\frac{\partial C}{\partial b_j^l} = \delta_j^l \tag{BP3}$$

### 证明

由链式法则：

$$\frac{\partial C}{\partial b_j^l} = \frac{\partial C}{\partial z_j^l} \frac{\partial z_j^l}{\partial b_j^l}$$

第一项就是误差 $\delta_j^l$。

第二项，因为 $z_j^l = \sum_k w_{jk}^l a_k^{l-1} + b_j^l$，对 $b_j^l$ 求偏导：

$$\frac{\partial z_j^l}{\partial b_j^l} = 1$$

所以：

$$\boxed{\frac{\partial C}{\partial b_j^l} = \delta_j^l \times 1 = \delta_j^l} \qquad \blacksquare$$

### 直觉

偏置 $b$ 直接加到 $z$ 上，改变 $b$ 就是改变 $z$，1:1 的关系，所以偏置的梯度 = 误差本身。

---

## BP4：权重的梯度

$$\frac{\partial C}{\partial w_{jk}^l} = a_k^{l-1} \delta_j^l \tag{BP4}$$

### 证明

由链式法则：

$$\frac{\partial C}{\partial w_{jk}^l} = \frac{\partial C}{\partial z_j^l} \frac{\partial z_j^l}{\partial w_{jk}^l}$$

第一项就是误差 $\delta_j^l$。

第二项，因为 $z_j^l = \sum_{k'} w_{jk'}^l a_{k'}^{l-1} + b_j^l$，对 $w_{jk}^l$ 求偏导时，只有 $k' = k$ 这一项不为零：

$$\frac{\partial z_j^l}{\partial w_{jk}^l} = a_k^{l-1}$$

所以：

$$\boxed{\frac{\partial C}{\partial w_{jk}^l} = a_k^{l-1} \delta_j^l} \qquad \blacksquare$$

### 简化记法

$$\frac{\partial C}{\partial w} = a_{\text{in}} \delta_{\text{out}} \tag{32}$$

$$\bigcirc \xrightarrow{\frac{\partial C}{\partial w} = a_{\text{in}} \delta_{\text{out}}} \bigcirc$$

- $a_{\text{in}}$：流入权重 $w$ 的激活值（前一层的输出）
- $\delta_{\text{out}}$：流出权重 $w$ 的误差（当前层的误差）

### 直觉

- $a_{\text{in}}$ 大 → 输入信号强 → 权重影响大 → 梯度大 → 学习快
- $a_{\text{in}} \approx 0$ → 输入信号弱 → 权重影响小 → 梯度小 → **学习缓慢**

---

## 对应到 network.py 代码

```python
# BP1: 输出层误差
delta = self.cost_derivative(activations[-1], y) * sigmoid_prime(zs[-1])

# BP2: 逐层反向传播
delta = np.dot(self.weights[-l+1].transpose(), delta) * sp

# BP3: 偏置梯度 = 误差
nabla_b[-l] = delta

# BP4: 权重梯度 = 输入激活值 × 误差
nabla_w[-l] = np.dot(delta, activations[-l-1].transpose())
```

| 公式 | 数学 | 代码 |
|------|------|------|
| BP1 | $\delta^L = \nabla_a C \odot \sigma'(z^L)$ | `cost_derivative(...) * sigmoid_prime(...)` |
| BP2 | $\delta^l = ((w^{l+1})^T \delta^{l+1}) \odot \sigma'(z^l)$ | `np.dot(weights.T, delta) * sp` |
| BP3 | $\partial C/\partial b = \delta$ | `nabla_b[-l] = delta` |
| BP4 | $\partial C/\partial w = a_{\text{in}} \delta_{\text{out}}$ | `np.dot(delta, activations.T)` |
