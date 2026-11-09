---
title: Lecture 3 — Real-time Shadows 1
publish: true
updated: 2026-10-26T11:21:01.019Z
---

# Lecture 3 — Real-time Shadows 1

## 1. Shadow Map

- **Cons**：自遮挡、走样

## 2. 自遮挡

离散网格无法表示连续的倾斜平面，导致一个 shadow map 像素映射的范围内，深度信息为常数 $d$，有部分大于 $d$、部分小于 $d$，出现部分暗部分亮的情况。

- **Solution**：加一个 bias
  - 引入了 detached shadow → 可用 second depth shadow mapping（效果不好）

## 3. 走样（Aliasing）

本质是采样率不足 + 两个视角网格不一致。

## 4. Shadow Map 中的数学

1. ![[Attachments/Pasted image 20260625134251.png]]

   $$E = \int_\Omega f \cdot g \, dx - f_{\text{avg}} \cdot \int_\Omega g \, dx = \int_\Omega (f - f_{\text{avg}}) \cdot g \, dx$$

   关键：$\int_\Omega (f - f_{\text{avg}}) \, dx = 0$ → $(f - f_{\text{avg}})$ 是个均值为零的振荡，所谓"近似准确"，就是这个 $E$ 小。所有条件都是在问"怎样让 $E$ 小"。

   a. $f$ 光滑（接近常数） → $f - f_{\text{avg}} \approx 0$ → $E \approx 0$
   b. $g$ 光滑（接近常数） → $g$ 与零均值振荡内积 $\approx 0$ → $E \approx 0$
   c. $g$ 支撑集小（窄峰） → 小范围内 $f$ 近常数可提出 → $E$ 小

2. ![[Attachments/Pasted image 20260625143517.png|994]]

   1. $V$（可见性）单独拎出来，用它在整个上半球的平均值代替逐方向的 $V$
   2. **Small support（小支撑集）**→ 点光源 / 方向光。点光、方向光本质是 $\delta$ 函数（光只来自一个方向）。整个积分只在那一个方向上有贡献
   3. **Smooth integrand（光滑被积函数）**→ diffuse BSDF 或恒定辐射的面光源 → $g$ 光滑

## 5. Percentage Closer Filter（PCF）

1. 既不是对 shadow map 的深度值去做 filter，也不是对已生成的阴影去做 filter
2. 第二趟"查深度比较"这一步的改进：在查询点周围取一组样本，每个都单独和 shadow map 比一次（各自得 0 或 1），再把这些 0/1 平均
3. 点 $P$ 变换到光源空间 → 得 shadow map 坐标 $(u, v)$ 和自身深度 $d$，在 $(u, v)$ 周围取 $N$ 个采样点（3×3 / Poisson 盘 / …）
4. 问题：PCF 的 filter 固定 → 不物理 → 想要"近锐远软"。半影宽度随遮挡距离变，半影只有面光源能产生（点光源只有硬阴影）

## 6. Percentage Closer Soft Shadows（PCSS）

![[Attachments/Pasted image 20260626012220.png|816]]

1. 软阴影的核心：遮挡物和阴影的距离，近 → sharper，远 → softer
2. **3 steps of PCSS**
   1. **Blocker search**：在 $P$ 的 $(u, v)$ 周围采样一圈 shadow map。每个采样点存的深度有两种：
      - $< d$（比 $P$ 近）：这个纹素记录的是挡在 $P$ 前面的遮挡物 → 是 blocker，收下它的深度
      - $\geq d$（不比 $P$ 近）：要么是 $P$ 自己、要么是更远的背景 → 不是 $P$ 的遮挡物，丢掉
      - 收下的 blocker 深度求平均 → $d_{\text{Blocker}}$，$d_{\text{Receiver}}$ 直接用 $P$ 自己的深度 $d$
   2. **Penumbra estimation**：

      $$\text{filter\_size} = r_{\text{light}} \cdot \frac{d_{\text{Receiver}} - d_{\text{Blocker}}}{d_{\text{Blocker}}}$$

   3. **Percentage Closer Filtering** — 用这个 size 做 PCF
3. 注意到 step 1 还是需要预估一个 size 来采样，虽然不是用来做 PCF，是算 $d_{\text{Blocker}}$，问题套娃。
   - **Solution**：$P$ 是一个点，但光源是面。从 $P$ 回头看光源，光源张成一个角度锥。任何落在这个锥内的遮挡物都可能挡住"光源某部分射向 $P$ 的光"。这些遮挡物，从光源视角（shadow map）看，会落在一个以 $P$ 的 $(u, v)$ 为中心的区域里——这就是 blocker search 的搜索范围。

   ![[Attachments/Pasted image 20260626015409.png|766]]

4. **开销**
   - PCF 开销 $\approx N \times$（1 次纹理读取 + 1 次比较）
   - PCSS：2~3× PCF，甚至更多
     - Step 1 blocker search：采 $N_1$ 次，每次要"比较 + 收集深度"（判断是不是 blocker）
     - Step 2 penumbra est.：可忽略
     - Step 3 PCF：采 $N_2$ 次，$N_2$ 由自适应 size 决定 → 可能很大
5. **采样方式：Poisson 盘**

   是一种采样点的分布模式：点随机散布，但任意两点之间保持一个最小距离——既随机又均匀，不会扎堆也不会出现规则排列。每个采样点可以想象成"周围有一个半径 $r$ 的空圆盘"——这个盘里不会有其他采样点。所有点都保持这种最小空盘，所以叫 Poisson "disk"。

6. **工程优化**
   - **通用优化**（PCF / PCSS 都用）
     1. 硬件 PCF：GPU 的 shadow sampler 一次采样自动做 2×2 双线性 PCF（4 邻点比较平均），几乎免费。固定小 filter 的 PCF 永远该用它
     2. 边缘剔除（early-out）：先做 1 次单点测试：完全照亮（$V = 1$）或完全在深阴影里（$V = 0$）的片元，直接返回，跳过昂贵的滤波，只有阴影边缘附近才需要 PCF / PCSS
     3. 降分辨率 / 隔行采样：只在 1/2 或 1/4 的片元上算，其余复用邻近结果（插值或 TAA 重投影）。牺牲少量质量换性能
     4. 少而精的 Poisson 盘：用 16 个旋转 Poisson 点，常常胜过 25 个规则网格点——点少、质量还更好
     5. shadow map 本身的优化：更高分辨率、CSM（近处高分辨率）、收紧光锥让有限分辨率集中——从源头提升采样质量，间接减少 PCF 需要的采样数
   - **PCSS 特有优化**
     1. 限制 blocker search 采样数：Step 1 用较少 Poisson 点
     2. 截断最大 filter size：Step 2 算出的 filter size 设上限，避免 Step 3 的 PCF 在极端情况采几十上百次
     3. blocker search 区域用近似：搜索区域大小用基于"光源大小 + $P$ 距离"的固定近似公式，每点只算几个乘除，不做复杂几何
