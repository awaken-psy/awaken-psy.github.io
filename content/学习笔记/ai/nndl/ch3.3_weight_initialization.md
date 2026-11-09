---
title: 权重初始化：避免饱和
publish: true
updated: 2026-07-17T06:44:45.832Z
---

# 权重初始化：避免饱和

> 出自《神经网络与深度学习》第三章

---

## 原题

![题目](学习笔记/ai/nndl/image/ch03_weight_init_exercise.png)

**设定：**
- 神经元有 $n_{\text{in}}$ 个输入权重
- 权重 $w_j$ 服从 $N(0, 1/n_{\text{in}})$，即均值为 0，标准差为 $1/\sqrt{n_{\text{in}}}$
- 偏置 $b$ 服从 $N(0, 1)$，即均值为 0，标准差为 1
- 假设 500 个输入为 0，500 个输入为 1

**求证：** $z = \sum_j w_j x_j + b$ 的标准差为 $\sqrt{3/2} \approx 1.22$

---

## 证明

### 前置知识

题目的两个提示：

**(a) 独立随机变量和的方差 = 各自方差的和：**

$$\text{Var}(X_1 + X_2 + \dots + X_n) = \text{Var}(X_1) + \text{Var}(X_2) + \dots + \text{Var}(X_n)$$

**(b) 方差 = 标准差的平方：**

$$\text{Var}(X) = \sigma^2$$

### 分解 $z$

$$z = \sum_j w_j x_j + b$$

- 500 个输入为 0：$x_j = 0$ → $w_j \cdot 0 = 0$，不贡献
- 500 个输入为 1：$x_j = 1$ → $w_j \cdot 1 = w_j$，贡献 $w_j$
- 偏置 $b$ 单独一项

所以：

$$z = \sum_{j=1}^{500} w_j + b$$

（只算 $x_j = 1$ 的那 500 项）

### 计算各部分方差

**权重项 $w_j$：**

- $w_j \sim N(0, 1/n_{\text{in}})$，标准差 $\sigma_w = 1/\sqrt{n_{\text{in}}}$
- $n_{\text{in}} = 1000$（总共 1000 个输入），所以 $\sigma_w = 1/\sqrt{1000}$
- $\text{Var}(w_j) = \sigma_w^2 = 1/1000$

**偏置 $b$：**

- $b \sim N(0, 1)$，标准差 $\sigma_b = 1$
- $\text{Var}(b) = 1$

### 计算总和的方差

$w_j$ 和 $b$ 都是独立的，用提示 (a)：

$$\text{Var}(z) = \sum_{j=1}^{500} \text{Var}(w_j) + \text{Var}(b)$$

$$\text{Var}(z) = 500 \times \frac{1}{1000} + 1 = \frac{1}{2} + 1 = \frac{3}{2}$$

### 计算标准差

用提示 (b)，标准差 = $\sqrt{\text{方差}}$：

$$\sigma_z = \sqrt{\text{Var}(z)} = \sqrt{\frac{3}{2}} \approx 1.22 \qquad \blacksquare$$

---

## 为什么这很重要

### 对比旧初始化

| | 旧初始化 | 新初始化 |
|---|---|---|
| $w_j$ 分布 | $N(0, 1)$ | $N(0, 1/n_{\text{in}})$ |
| $\text{Var}(w_j)$ | 1 | $1/1000$ |
| $\text{Var}(z)$（500个1输入） | $500 \times 1 + 1 = 501$ | $500 \times \frac{1}{1000} + 1 = 1.5$ |
| $\sigma_z$ | $\sqrt{501} \approx 22.4$ | $\sqrt{1.5} \approx 1.22$ |

### 直觉

```
旧初始化的 z 分布:              新初始化的 z 分布:
  σ ≈ 22                          σ ≈ 1.2

  │  ╱╲                          │  ╱╲╲╲
  │ ╱  ╲                          │ ╱    ╲
  │╱    ╲                         │╱      ╲
  └──────────────              └──────────────
  -22    0    22                 -3    0    3

  z 很容易到 ±22                z 集中在 ±3 以内
  → sigmoid 饱和(σ≈0或1)        → sigmoid 在线性区(σ≈0.5)
  → σ'(z) ≈ 0 学习缓慢           → σ'(z) ≈ 0.25 学习正常
```

**权重缩小 $\sqrt{n_{\text{in}}}$ 倍 → $z$ 的分布变窄 → 神经元不容易饱和 → 梯度不会消失 → 学习正常。**

---

## 对应到代码

```python
# network2.py 中的 default_weight_initializer:
self.weights = [np.random.randn(y, x)/np.sqrt(x)
                for x, y in zip(self.sizes[:-1], self.sizes[1:])]
#               ──────────────────  ──────────
#               N(0,1) 标准正态     除以 √n_in，得到 N(0, 1/n_in)

# 对比旧初始化 large_weight_initializer:
self.weights = [np.random.randn(y, x)
                for x, y in zip(self.sizes[:-1], self.sizes[1:])]
#               ──────────────────
#               N(0,1) 标准正态，不缩小
```
