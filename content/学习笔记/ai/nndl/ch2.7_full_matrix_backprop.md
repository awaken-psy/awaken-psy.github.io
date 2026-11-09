---
title: 全矩阵反向传播
publish: true
updated: 2026-07-13T09:45:02.881Z
---

# 全矩阵反向传播

> 出自《神经网络与深度学习》第二章练习

---

## 原题

![题目](学习笔记/ai/nndl/image/ch02_full_matrix_backprop_exercise.png)

**题意：** 现有的 `network.py` 对 mini-batch 中的样本逐个计算梯度再累加。可以改成用矩阵一次性处理整个 mini-batch，用 $X = [x_1, x_2, ..., x_m]$ 代替单个 $x$，利用线性代数库加速。

---

## 原始方法 vs 全矩阵方法

### 原始方法（逐样本循环）

```
for 每个样本 x_i in mini_batch (循环 m 次):
    前向传播: 逐层算 z_i, a_i
    反向传播: 逐层算 delta_i, nabla_b_i, nabla_w_i
    累加梯度

取平均，更新 w, b
```

### 全矩阵方法（矩阵并行）

```
把 m 个样本拼成矩阵 X:
    X 的每一列是一个样本 x_i (784×1)
    X 形状: (784, m)

前向传播: 矩阵乘法一次性处理所有样本
反向传播: 矩阵乘法一次性算出所有梯度
取平均，更新 w, b
```

### 维度对比

| 量 | 原始方法（单样本） | 全矩阵方法（m 个样本） |
|---|---|---|
| 输入 | $x$: $(784, 1)$ | $X$: $(784, m)$ |
| 权重 | $w$: $(30, 784)$ | $w$: $(30, 784)$（不变） |
| 偏置 | $b$: $(30, 1)$ | $b$: $(30, 1)$（不变，靠广播） |
| 加权输入 $z$ | $(30, 1)$ | $Z$: $(30, m)$ |
| 激活值 $a$ | $(30, 1)$ | $A$: $(30, m)$ |

关键变化：所有原本是 $(n, 1)$ 向量的量，都变成了 $(n, m)$ 矩阵，$m$ 是 mini-batch 大小。

---

## 伪代码

### 前向传播

```
输入: X = [x_1, x_2, ..., x_m]  (n_0 × m, n_0=784)
      m = mini_batch_size

初始化 A_0 = X

for l = 1 to L:
    Z_l = W_l × A_{l-1} + b_l      (n_l × m)
           ↑         ↑
         (n_l×n_{l-1}) (n_{l-1}×m)
           
    b_l 是 (n_l × 1)，NumPy 广播自动扩展为 (n_l × m)
    
    A_l = σ(Z_l)                    (n_l × m)
    
    保存 Z_l, A_l 供反向传播使用
```

### 反向传播

```
输出层误差:
    Δ^L = (A^L - Y) ⊙ σ'(Z^L)       (n_L × m)
          ↑
      Y 是 (n_L × m) 的标签矩阵，每列是 y_i

    Y = [y_1, y_2, ..., y_m]  (one-hot 标签拼成矩阵)

偏置梯度（对 m 个样本取平均）:
    ∇b_L = (1/m) × Σ_j Δ^L[:,j]    (n_L × 1)
         = (1/m) × np.sum(Δ^L, axis=1, keepdims=True)

权重梯度:
    ∇W_L = (1/m) × Δ^L × (A^{L-1})^T   (n_L × n_{L-1})

逐层反向传播:
for l = L-1 down to 1:
    Δ^l = (W_{l+1}^T × Δ^{l+1}) ⊙ σ'(Z^l)    (n_l × m)
    
    ∇b_l = (1/m) × np.sum(Δ^l, axis=1, keepdims=True)
    ∇W_l = (1/m) × Δ^l × (A^{l-1})^T

更新参数:
    W_l = W_l - η × ∇W_l
    b_l = b_l - η × ∇b_l
```

### 关键公式对照

| 公式 | 原始（单样本） | 全矩阵（m 个样本） |
|---|---|---|
| 前向 | $z = wa + b$ | $Z = WA + b$（广播） |
| BP1 | $\delta^L = (a^L - y) \odot \sigma'(z^L)$ | $\Delta^L = (A^L - Y) \odot \sigma'(Z^L)$ |
| BP2 | $\delta^l = (w^{l+1})^T \delta^{l+1} \odot \sigma'(z^l)$ | $\Delta^l = (W^{l+1})^T \Delta^{l+1} \odot \sigma'(Z^l)$ |
| BP3 | $\nabla b = \delta$ | $\nabla b = \frac{1}{m}\text{sum}(\Delta, \text{axis}=1)$ |
| BP4 | $\nabla w = \delta \cdot a_{\text{in}}^T$ | $\nabla W = \frac{1}{m}\Delta \cdot A_{\text{in}}^T$ |

BP3 的变化最大：单样本时 $\nabla b = \delta$（直接等于）；多样本时每列有一个 $\delta$，取平均得到 $\nabla b$。

---

## 代码实现

```python
"""
network_matrix.py
~~~~~~~~~~~~~~~~~

全矩阵版反向传播实现。
每个 mini-batch 的所有样本一次性用矩阵运算处理，
不逐样本循环。

"""

import random
import time
import numpy as np

import mnist_loader


class Network(object):

    def __init__(self, sizes):
        self.num_layers = len(sizes)
        self.sizes = sizes
        self.biases = [np.random.randn(y, 1) for y in sizes[1:]]
        self.weights = [np.random.randn(y, x)
                        for x, y in zip(sizes[:-1], sizes[1:])]

    def feedforward(self, a):
        for b, w in zip(self.biases, self.weights):
            a = sigmoid(np.dot(w, a) + b)
        return a

    def SGD(self, training_data, epochs, mini_batch_size, eta,
            test_data=None):
        if test_data:
            n_test = len(test_data)
        n = len(training_data)
        for j in range(epochs):
            time1 = time.time()
            random.shuffle(training_data)
            mini_batches = [
                training_data[k:k+mini_batch_size]
                for k in range(0, n, mini_batch_size)]
            for mini_batch in mini_batches:
                self.update_mini_batch(mini_batch, eta)
            time2 = time.time()
            if test_data:
                print("Epoch {0}: {1} / {2}, 耗时 {3:.2f} 秒".format(
                    j, self.evaluate(test_data), n_test, time2-time1))
            else:
                print("Epoch {0} 完成，耗时 {1:.2f} 秒".format(j, time2-time1))

    def update_mini_batch(self, mini_batch, eta):
        """全矩阵版：一次性处理整个 mini-batch，不逐样本循环。"""
        m = len(mini_batch)

        # 把 m 个样本拼成矩阵
        # X: (n_0, m)，每列是一个输入样本
        # Y: (n_L, m)，每列是一个 one-hot 标签
        X = np.hstack([x for x, y in mini_batch])      # (784, m)
        Y = np.hstack([y for x, y in mini_batch])       # (10, m)

        # 前向传播 + 反向传播
        nabla_b, nabla_w = self.backprop(X, Y, m)

        # 更新参数
        self.weights = [w - eta * nw
                        for w, nw in zip(self.weights, nabla_w)]
        self.biases = [b - eta * nb
                       for b, nb in zip(self.biases, nabla_b)]

    def backprop(self, X, Y, m):
        """全矩阵反向传播。X: (n_0, m), Y: (n_L, m)"""
        nabla_b = [np.zeros(b.shape) for b in self.biases]
        nabla_w = [np.zeros(w.shape) for w in self.weights]

        # ========== 前向传播 ==========
        activation = X                    # (n_0, m)
        activations = [X]                 # 保存各层激活值
        zs = []                           # 保存各层加权输入

        for b, w in zip(self.biases, self.weights):
            # Z = W × A + b
            #   W: (n_l, n_{l-1}), A: (n_{l-1}, m)
            #   Z: (n_l, m)
            #   b: (n_l, 1), NumPy 广播自动扩展为 (n_l, m)
            z = np.dot(w, activation) + b
            zs.append(z)
            activation = sigmoid(z)       # (n_l, m)
            activations.append(activation)

        # ========== 反向传播 ==========
        # BP1: 输出层误差
        #   Δ^L = (A^L - Y) ⊙ σ'(Z^L)
        #   (A^L - Y): (n_L, m)
        #   σ'(Z^L): (n_L, m)
        delta = (activations[-1] - Y) * sigmoid_prime(zs[-1])  # (n_L, m)

        # BP3: 偏置梯度 = 对 m 个样本的误差取平均
        #   np.sum(delta, axis=1, keepdims=True): (n_L, 1)
        #   除以 m 取平均
        nabla_b[-1] = np.sum(delta, axis=1, keepdims=True) / m  # (n_L, 1)

        # BP4: 权重梯度 = (1/m) × Δ × A^{L-1}^T
        #   delta: (n_L, m), activations[-2]^T: (m, n_{L-1})
        #   结果: (n_L, n_{L-1})，和 weights[-1] 形状一致
        nabla_w[-1] = np.dot(delta, activations[-2].transpose()) / m

        # BP2: 逐层反向传播
        for l in range(2, self.num_layers):
            delta = np.dot(self.weights[-l+1].transpose(), delta) * \
                    sigmoid_prime(zs[-l])
            #   delta: (n_l, m)

            nabla_b[-l] = np.sum(delta, axis=1, keepdims=True) / m
            nabla_w[-l] = np.dot(delta, activations[-l-1].transpose()) / m

        return (nabla_b, nabla_w)

    def evaluate(self, test_data):
        test_results = [(np.argmax(self.feedforward(x)), y)
                        for (x, y) in test_data]
        return sum(int(x == y) for (x, y) in test_results)

    def cost_derivative(self, output_activations, y):
        return (output_activations - y)


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))

def sigmoid_prime(z):
    return sigmoid(z) * (1 - sigmoid(z))


if __name__ == "__main__":
    training_data, validation_data, test_data = mnist_loader.load_data_wrapper()
    net = Network([784, 30, 10])
    net.SGD(training_data, 30, 10, 3.0, test_data=test_data)
```

---

## 为什么更快？

原始方法中，mini-batch 大小为 10 时，`for x, y in mini_batch` 循环 10 次，每次调用 `backprop` 做一次前向 + 反向。

全矩阵方法把 10 次循环合并成一次大矩阵乘法。NumPy 底层调用 BLAS（C/Fortran 实现）做矩阵乘法，有 SIMD 指令和缓存优化，比 Python 循环快得多。

```
原始:  10 次 Python 循环 × (前向 + 反向) = 10 × (多次小矩阵乘法)
全矩阵: 1 次大矩阵乘法（NumPy 底层并行优化）
```

---

## 两种方法对比

| | 原始方法 | 全矩阵方法 |
|---|---|---|
| mini-batch 处理 | 逐样本循环 | 一次性矩阵运算 |
| BP1 | $(a^L - y) \odot \sigma'(z^L)$ | $(A^L - Y) \odot \sigma'(Z^L)$ |
| BP3 | $\nabla b = \delta$ | $\nabla b = \frac{1}{m}\text{sum}(\Delta)$ |
| BP4 | $\nabla w = \delta \cdot a^T$ | $\nabla W = \frac{1}{m}\Delta \cdot A^T$ |
| 速度 | 慢（Python 循环开销） | 快（BLAS 矩阵并行） |
| 内存 | 少（每次一个样本） | 多（存所有样本的矩阵） |
