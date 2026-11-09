---
title: 交叉熵代价函数练习
publish: true
updated: 2026-07-14T09:33:14.663Z
---

# 交叉熵代价函数练习

> 出自《神经网络与深度学习》第三章

---

## 原题

![练习1](学习笔记/ai/nndl/image/ch03_cross_entropy_exercises_1.png)

![练习2](学习笔记/ai/nndl/image/ch03_cross_entropy_exercises_2.png)

---

## 练习 1：交叉熵表达式中 y 和 a 的角色

**题目：** 交叉熵的正确形式是 $-[y \ln a + (1-y) \ln(1-a)]$ 还是 $-[a \ln y + (1-a) \ln(1-y)]$？在 $y=0$ 或 $y=1$ 时第二个表达式结果怎样？第一个表达式有这个问题吗？

### 解答

**第二个表达式 $-[a \ln y + (1-a) \ln(1-y)]$ 在 $y=0$ 或 $y=1$ 时会崩溃：**

- 当 $y=0$ 时：$\ln y = \ln 0 = -\infty$，表达式无意义
- 当 $y=1$ 时：$\ln(1-y) = \ln 0 = -\infty$，表达式无意义

**第一个表达式 $-[y \ln a + (1-y) \ln(1-a)]$ 没有这个问题：**

- 当 $y=0$ 时：$C = -[0 \cdot \ln a + 1 \cdot \ln(1-a)] = -\ln(1-a)$，只要 $a \neq 1$ 就有定义
- 当 $y=1$ 时：$C = -[1 \cdot \ln a + 0 \cdot \ln(1-a)] = -\ln a$，只要 $a \neq 0$ 就有定义

关键区别：在交叉熵中，$y$ 是真实标签（0 或 1），$a$ 是网络输出（sigmoid 的值在 $(0,1)$ 之间）。$\ln$ 的自变量应该是 $a$（永远不为 0 或 1），而不是 $y$（恰好是 0 或 1）。

---

## 练习 2：交叉熵在 $\sigma(z) = y$ 时最小化

**题目：** 证明交叉熵对所有训练输入在 $\sigma(z) = y$ 时最小化，此时 $C = -\frac{1}{n}\sum_x [y \ln y + (1-y) \ln(1-y)]$。

### 解答

单个样本的交叉熵：

$$C = -[y \ln a + (1-y) \ln(1-a)]$$

其中 $a = \sigma(z)$。对 $a$ 求导：

$$\frac{\partial C}{\partial a} = -\left[\frac{y}{a} - \frac{1-y}{1-a}\right] = -\frac{y}{a} + \frac{1-y}{1-a}$$

令其为零：

$$\frac{y}{a} = \frac{1-y}{1-a}$$

交叉相乘：

$$y(1-a) = (1-y)a$$

$$y - ya = a - ya$$

$$y = a$$

所以 $a = \sigma(z) = y$ 是极值点。二阶导数：

$$\frac{\partial^2 C}{\partial a^2} = \frac{y}{a^2} + \frac{1-y}{(1-a)^2} > 0$$

所以这是最小值。代入 $a = y$：

$$C = -[y \ln y + (1-y) \ln(1-y)]$$

对所有 $n$ 个样本取平均：

$$\boxed{C = -\frac{1}{n}\sum_x [y \ln y + (1-y) \ln(1-y)]}$$

其中 $-[y \ln y + (1-y) \ln(1-y)]$ 就是**二元熵**。 $\blacksquare$

---

## 练习 3：多层多神经元网络的交叉熵

**题目：**

1. 证明对二次代价函数，输出层权重梯度为 $\frac{\partial C}{\partial w_{jk}^L} = \frac{1}{n}\sum_x a_k^{L-1}(a_j^L - y_j)\sigma'(z_j^L)$
2. 证明对交叉熵代价函数，输出误差 $\delta^L = a^L - y$
3. 证明对交叉熵，权重梯度为 $\frac{\partial C}{\partial w_{jk}^L} = \frac{1}{n}\sum_x a_k^{L-1}(a_j^L - y_j)$

### 解答

#### 第 1 问：二次代价函数的权重梯度

二次代价函数（对 $n$ 个样本取平均）：

$$C = \frac{1}{2n}\sum_x \sum_j (a_j^L - y_j)^2$$

由 BP4：

$$\frac{\partial C}{\partial w_{jk}^L} = \frac{1}{n}\sum_x a_k^{L-1} \delta_j^L$$

由 BP1，二次代价函数下 $\nabla_a C = (a^L - y)$：

$$\delta_j^L = (a_j^L - y_j)\sigma'(z_j^L)$$

代入：

$$\boxed{\frac{\partial C}{\partial w_{jk}^L} = \frac{1}{n}\sum_x a_k^{L-1}(a_j^L - y_j)\sigma'(z_j^L)}$$

可以看到 $\sigma'(z_j^L)$ 项会在神经元饱和时趋近 0，导致学习缓慢。 $\blacksquare$

#### 第 2 问：交叉熵的输出误差 $\delta^L = a^L - y$

交叉熵代价函数（多神经元，对 $n$ 个样本取平均）：

$$C = -\frac{1}{n}\sum_x \sum_j [y_j \ln a_j^L + (1-y_j)\ln(1-a_j^L)]$$

由 BP1：

$$\delta_j^L = \frac{\partial C}{\partial a_j^L}\sigma'(z_j^L)$$

计算 $\frac{\partial C}{\partial a_j^L}$：

$$\frac{\partial C}{\partial a_j^L} = -\frac{1}{n}\sum_x \left[\frac{y_j}{a_j^L} - \frac{1-y_j}{1-a_j^L}\right]$$

对单个样本（去掉 $\frac{1}{n}\sum_x$）：

$$\frac{\partial C}{\partial a_j^L} = -\frac{y_j}{a_j^L} + \frac{1-y_j}{1-a_j^L} = \frac{-(y_j)(1-a_j^L) + (1-y_j)a_j^L}{a_j^L(1-a_j^L)}$$

展开分子：

$$-y_j + y_j a_j^L + a_j^L - y_j a_j^L = a_j^L - y_j$$

所以：

$$\frac{\partial C}{\partial a_j^L} = \frac{a_j^L - y_j}{a_j^L(1-a_j^L)}$$

而 sigmoid 导数：

$$\sigma'(z_j^L) = a_j^L(1-a_j^L)$$

代入 BP1：

$$\delta_j^L = \frac{a_j^L - y_j}{a_j^L(1-a_j^L)} \cdot a_j^L(1-a_j^L) = a_j^L - y_j$$

$\sigma'(z_j^L)$ 被约掉了！所以：

$$\boxed{\delta^L = a^L - y} \tag{66} \qquad \blacksquare$$

#### 第 3 问：交叉熵的权重梯度

由 BP4：

$$\frac{\partial C}{\partial w_{jk}^L} = \frac{1}{n}\sum_x a_k^{L-1}\delta_j^L$$

代入 $\delta_j^L = a_j^L - y_j$：

$$\boxed{\frac{\partial C}{\partial w_{jk}^L} = \frac{1}{n}\sum_x a_k^{L-1}(a_j^L - y_j)} \tag{67}$$

$\sigma'(z_j^L)$ 完全消失了！梯度不再依赖激活函数的导数，不会因为神经元饱和而学习缓慢。 $\blacksquare$

---

## 练习 4：输出层使用线性神经元时的二次代价函数

**题目：** 假设输出层是线性神经元 $a_j^L = z_j^L$（不用 sigmoid），证明二次代价函数下 $\delta^L = a^L - y$，且权重和偏置的梯度不含 $\sigma'$ 项。

### 解答

#### 输出误差

线性激活函数 $\sigma(z) = z$，所以 $\sigma'(z) = 1$。

二次代价函数：$\nabla_a C = (a^L - y)$

由 BP1：

$$\delta^L = \nabla_a C \odot \sigma'(z^L) = (a^L - y) \odot \mathbf{1} = a^L - y$$

$$\boxed{\delta^L = a^L - y} \tag{68}$$

#### 权重梯度

由 BP4：

$$\frac{\partial C}{\partial w_{jk}^L} = \frac{1}{n}\sum_x a_k^{L-1}\delta_j^L = \frac{1}{n}\sum_x a_k^{L-1}(a_j^L - y_j)$$

$$\boxed{\frac{\partial C}{\partial w_{jk}^L} = \frac{1}{n}\sum_x a_k^{L-1}(a_j^L - y_j)} \tag{69}$$

#### 偏置梯度

由 BP3：

$$\frac{\partial C}{\partial b_j^L} = \frac{1}{n}\sum_x \delta_j^L = \frac{1}{n}\sum_x (a_j^L - y_j)$$

$$\boxed{\frac{\partial C}{\partial b_j^L} = \frac{1}{n}\sum_x (a_j^L - y_j)} \tag{70}$$

#### 结论

线性神经元的 $\sigma'(z) = 1$，所以二次代价函数天然就没有 $\sigma'$ 衰减问题。**当输出层是线性神经元时，二次代价函数就是一种合适的选择，不需要换成交叉熵。** $\blacksquare$

#### 为什么线性神经元不会学习缓慢？

学习缓慢的根因是 $\sigma'(z) \to 0$。

在 BP1 中，输出层误差为：

$$\delta^L = (a^L - y) \odot \sigma'(z^L)$$

- **sigmoid 神经元**：$\sigma'(z) = a(1-a)$，当 $a \to 0$ 或 $a \to 1$ 时 $\sigma' \to 0$，梯度消失
- **线性神经元**：$\sigma(z) = z$，所以 $\sigma'(z) = 1$，永远不衰减

代入 BP1：

$$\delta^L = (a^L - y) \odot 1 = a^L - y$$

权重梯度（BP4）：

$$\frac{\partial C}{\partial w} = a_{\text{in}} \times \delta = a_{\text{in}} \times (a^L - y)$$

没有任何 $\sigma'$ 项了。梯度大小只取决于误差 $(a - y)$ 本身：错得越多，梯度越大，学得越快；错得越少，梯度越小，自然减速。不存在"饱和区"把梯度压没了。

---

## 总结对比

| 情况 | $\delta^L$ | 权重梯度含 $\sigma'$？ | 学习缓慢？ |
|---|---|---|---|
| sigmoid + 二次代价 | $(a-y)\sigma'(z)$ | ✅ 有 | ✅ 会 |
| sigmoid + 交叉熵 | $a - y$ | ❌ 没有 | ❌ 不会 |
| 线性 + 二次代价 | $a - y$ | ❌ 没有 | ❌ 不会 |

核心洞察：**交叉熵之所以能解决学习缓慢，是因为它的 $\partial C / \partial a$ 恰好有一个 $1/[a(1-a)]$ 因子，和 $\sigma'(z) = a(1-a)$ 完美约掉了。**

---

## 为什么修输出层收益最大？

### 输出层是误差的源头

反向传播从输出层开始，逐层往前传：

```
输出层 δ^L      ← BP1，这里如果 σ'(z^L) ≈ 0，δ^L 就死了
   ↓ BP2
隐藏层 δ^{L-1}  ← 依赖 δ^L，δ^L 是 0 的话这里也接近 0
   ↓ BP2
隐藏层 δ^{L-2}  ← 同样接近 0
   ↓
...全死了
```

**输出层的 $\sigma'(z^L)$ 是"零号病人"**——如果它把误差扼杀在源头，后面所有层都收不到信号，整个网络都学不了。所以修好输出层效果最显著。

### 但隐藏层的 $\sigma'$ 衰减是另一个问题

交叉熵只消去了 BP1 里的 $\sigma'(z^L)$，没有消去 BP2 里隐藏层的 $\sigma'(z^l)$：

$$\delta^l = \underbrace{(w^{l+1})^T \delta^{l+1}}_{\text{后层传来的误差}} \odot \underbrace{\sigma'(z^l)}_{\text{隐藏层也会衰减}}$$

如果隐藏层某个神经元饱和了（$\sigma' \approx 0$），误差传到这一层也会被衰减。

### 具体例子

```
4层网络，输出层饱和：

二次代价（修复前）:
  δ^4 = (a-y) × σ'(z^4) ≈ (1-0) × 0.001 = 0.001   ← 输出层就死了
  δ^3 = w^T × 0.001 × σ'(z^3) ≈ 0.0001             ← 连带死亡
  δ^2 = w^T × 0.0001 × σ'(z^2) ≈ 0.00001           ← 连带死亡

交叉熵（修复后）:
  δ^4 = (a-y) = 1.0                                  ← 输出层修好了！
  δ^3 = w^T × 1.0 × σ'(z^3)                         ← 但这里还有 σ'(z^3)
  δ^2 = w^T × δ^3 × σ'(z^2)                         ← 这里也还有 σ'(z^2)
```

如果隐藏层没有饱和（$\sigma'$ 不算太小），交叉熵就够了。如果隐藏层也饱和，就需要换激活函数（如 ReLU）来解决。

### 两种问题的解决方案

| 问题 | 原因 | 解决方案 |
|---|---|---|
| 输出层饱和 | BP1 中的 $\sigma'(z^L) \to 0$ | 交叉熵代价函数 |
| 隐藏层饱和 | BP2 中的 $\sigma'(z^l) \to 0$ | 换激活函数（ReLU 等） |

**输出层是误差的源头，修好它收益最大；但隐藏层的 $\sigma'$ 衰减是另一个问题，交叉熵管不了，需要换激活函数来解决。**
