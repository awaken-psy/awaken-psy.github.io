---
title: 正则化与改进的权重初始化的结合
publish: true
updated: 2026-07-17T06:50:56.429Z
---

# 正则化与改进的权重初始化的结合

> 出自《神经网络与深度学习》第三章

---

## 原题

![题目](学习笔记/ai/nndl/image/ch03_regularization_weight_init_exercise.png)

**题意：** 用旧的权重初始化方法 $w \sim N(0,1)$，但加上 L2 正则化。论证在特定条件下，正则化会自动把权重衰减到和新初始化方法差不多的水平（$1/\sqrt{n_{\text{in}}}$ 量级）。

---

## 背景

### 两种方法

| | 权重初始化 | L2 正则化 |
|---|---|---|
| 做法 | 一开始就把 $w \sim N(0, 1/\sqrt{n_{\text{in}}})$ | 一开始 $w \sim N(0,1)$，训练中每步缩小 |
| 公式 | `randn(y,x)/sqrt(x)` | $w \to (1-\eta\lambda/n) \cdot w - \eta \nabla C_0$ |

题目说：即使不用新的初始化方法，L2 正则化的权重衰减也能达到类似效果。

---

## 三个条件的论证

### 条件 1：训练初期被权重衰减统治

更新公式：

$$w \to \left(1 - \frac{\eta\lambda}{n}\right)w - \eta \frac{\partial C_0}{\partial w}$$

- 第一项 $\frac{\eta\lambda}{n}w$：权重衰减，直接缩小 $w$
- 第二项 $\eta \nabla C_0$：梯度更新，取决于数据

训练初期权重 $w \sim N(0,1)$，方差为 1，比较大。而梯度项 $\eta \nabla C_0$ 取决于具体的训练数据和代价函数，通常比较小。

当 $\lambda$ 不太小时，衰减项 $\frac{\eta\lambda}{n}w$ 主导了初期的更新。**权重在快速缩小，梯度还没来得及起作用。**

### 条件 2：权重按 $\exp(-\eta\lambda t / n)$ 衰减

如果只看衰减项，忽略梯度项：

$$w_{t} = \left(1 - \frac{\eta\lambda}{n}\right)^t w_0 \approx e^{-\eta\lambda t / n} w_0$$

- $t$：迭代次数
- $\eta\lambda/n$：每次衰减的比例
- $e^{-\eta\lambda t/n}$：连续近似（当 $\eta\lambda/n$ 很小时）

如果 $\eta\lambda \ll n$（即每次只衰减一点点），这个近似成立。权重按指数衰减。

### 条件 3：权重在 $1/\sqrt{n_{\text{in}}}$ 附近稳定

权重不可能无限衰减，因为：

- $w$ 很大时 → 衰减项 $\frac{\eta\lambda}{n}w$ 大 → 缩小为主
- $w$ 很小时 → 衰减项小，梯度项 $\eta \nabla C_0$ 开始占主导 → 更新为主

平衡点：当衰减和梯度更新达到平衡时，权重稳定在某个水平。

从条件 2，权重从 $O(1)$ 衰减到 $O(1/\sqrt{n_{\text{in}}})$ 大约需要：

$$e^{-\eta\lambda t/n} \sim \frac{1}{\sqrt{n_{\text{in}}}}$$

题目中的图示例子使用了：
- $\eta = 0.5$，$\lambda = 0.1$，$n = 50000$，$n_{\text{in}} = 784$
- $\eta\lambda/n = 0.5 \times 0.1 / 50000 = 10^{-6}$
- $\eta\lambda \ll n$ ✓
- 衰减到 $1/\sqrt{784} \approx 0.036$ 需要 $t \sim \frac{n \ln\sqrt{784}}{\eta\lambda} \approx \frac{50000 \times 3.3}{0.05} \approx 3.3 \times 10^6$ 步
- 30 个 epoch × 5000 mini-batch/epoch = 150000 步

虽然 30 个 epoch 还不能完全衰减到位，但趋势已经开始了：正则化在持续压低权重，和新初始化方法的效果方向一致。

---

## 直觉

```
不用正则化，旧初始化:
  w 初始 ~ N(0,1)  →  训练更新  →  w 变化取决于梯度
  → w 可能很大 → z 很大 → sigmoid 饱和 → 学习缓慢

用正则化，旧初始化:
  w 初始 ~ N(0,1)  →  衰减 + 梯度  →  w 被压小
  → w 最终 ~ 1/√n_in → z 不会太大 → 不饱和 → 学习正常

用新初始化，不用正则化:
  w 初始 ~ N(0,1/√n_in)  →  从一开始就不饱和
  → 效果和上面类似，但不用等正则化慢慢压
```

**一句话：L2 正则化像"温水煮青蛙"，慢慢把大权重压小，最终效果接近新初始化方法。但新初始化方法"一开始就对"，不用等正则化生效。**
