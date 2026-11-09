---
title: Lecture 4 — Real-time Shadows 2
publish: true
updated: 2026-10-26T11:21:01.023Z
---

# Lecture 4 — Real-time Shadows 2

## 1. VSSM（Variance Soft Shadow Mapping）

- PCF 和 PCSS 本质在做一件事情：把一个点映射回 shadow map，然后在一个 filter 的范围内，这个点的深度的百分位数是多少？
- VSSM 的基本思想：假设这个点周围的深度值分布满足某个分布，只需要求周围的深度的均值和方差即可（这句话可能有歧义，主要是关系到 Chebyshev 不等式）
  - **均值**：mipmap、SAT
  - **方差**：$D(x) = E(x^2) - E^2(x)$，前者可以直接在生成 shadow map 的时候生成一张深度平方的 shadow map，直接记录在纹理的第二个通道里面（RGBA）

- 有了均值和方差可以算 $P(x = t)$，这个值就是 visibility，这一步可以用 Chebyshev 不等式（对任意分布可用）加速（直接约等）

  ![](<Attachments/Pasted image 20260806095013.png>)

- 但是上述只解决了 PCSS 第三步的问题，下图方法用来解决第一步 blocker search 的问题（求 blocker 的 $d_{\text{avg}}$）

  ![](<Attachments/Pasted image 20260806095241.png>)

### 关于 SAT

- 给定一个二维矩阵 $I(x, y)$（比如深度图），其 SAT 定义为：

  $$\text{SAT}(x, y) = \sum_{i=0}^{x} \sum_{j=0}^{y} I(i, j)$$

  即**从左上角 $(0, 0)$ 到当前位置 $(x, y)$ 的矩形总和**。

- **构建的递推公式**（动态规划）：

  $$\text{SAT}(x, y) = I(x, y) + \text{SAT}(x-1, y) + \text{SAT}(x, y-1) - \text{SAT}(x-1, y-1)$$

  ![](<Attachments/Pasted image 20260806111042.png>)

### 存在的问题

- **漏光**：Chebyshev 给出了 $P(x > t)$（被照亮的比例）的上界，我们直接使用这个上界会导致偏大（在做 PCF 的第三步）
- **偏暗**：切比雪夫不等式给出的 $P$ 是上界，比真实照亮比例大。将高估的 $P$ 代入 $z_{\text{occ}}$ 推导会导致阴影过暗（block search的第一步），具体推导如下：
  - 软阴影的柔和程度取决于半影区宽度。在 PCSS 里，半影宽度大致正比于：

    $$\text{半影} \propto \frac{t - z_{\text{occ}}}{z_{\text{occ}}}$$

    - $t$：当前着色点的深度（离光源的距离）
    - $z_{\text{occ}}$：遮挡物的平均深度（挡住光线的那些东西的平均深度）

  - $z_{\text{occ}}$ 越小 → 遮挡物越靠近光源 → $(t - z_{\text{occ}})$ 越大 → 半影区越大 → 阴影边缘越柔和
  - $z_{\text{occ}}$ 越大 → 遮挡物越远 → 半影区越小 → 阴影边缘变硬、变黑

  - **VSSM 是怎么得到 $z_{\text{occ}}$ 的？** 遮挡物搜索不遍历像素，而是用均值 $\mu$ 和"照亮比例" $P$ 反推 $z_{\text{occ}}$
    - 公式来自一个数学恒等式，基于一个关键假设：

      $$\mu = P \cdot t + (1 - P) \cdot z_{\text{occ}}$$

      - $\mu$：区域里所有像素的平均深度（通过 SAT 精确已知）
      - $P$：区域里"能照亮着色点"的像素比例，即 $P(X > t)$
      - 假设：所有"非遮挡物"像素（深度 $> t$）的平均深度正好等于 $t$
    - 整理后得到：

      $$z_{\text{occ}} = \frac{\mu - P \cdot t}{1 - P}$$

  - **问题就出在 $P$ 身上** —— Chebyshev 不等式给出的 $P$ 是个上界，比真实的照亮比例要大
    - 把高估的 $P$ 代入 $z_{\text{occ}}$ 公式，观察 $z_{\text{occ}}$ 随 $P$ 的变化规律：

      $$\frac{d(z_{\text{occ}})}{dP} = \frac{\mu - t}{(1 - P)^2}$$

      - 若 $\mu > t$（区域平均深度比着色点还远），导数为正 → $P$ 越大，$z_{\text{occ}}$ 越大 → 半影压缩 → 阴影过暗
      - 若 $\mu < t$（区域平均深度比着色点更近），导数为负 → $P$ 越大，$z_{\text{occ}}$ 越小→ 半影过度放大  →阴影边缘变得**过于柔和、过亮**
      - **过暗正是发生在 $\mu > t$ 的情况里**

- **深度不是单峰分布**
- **接收物不是一个平面**（$z_{\text{unooc}}$ 用 $t$ 近似了）

## 2. MSM（Moment Shadow Mapping）

- **目标**：represent distribution more accurately
- **方法**：用更高阶的矩（moment）去描述

  ![](<Attachments/Pasted image 20260807113940.png>)
