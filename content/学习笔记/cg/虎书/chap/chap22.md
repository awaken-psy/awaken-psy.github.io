---
title: 第二十二章 隐式建模（Implicit Modeling）
publish: true
updated: 2026-08-10T00:00:00.000Z
tags:
  - 虎书
  - 计算机图形学
  - 隐式建模
  - 隐式曲面
  - BlobTree
  - CSG
  - 多边形化
  - 空间划分
aliases:
  - 虎书第二十二章
  - Implicit Modeling
  - 隐式曲面与BlobTree
  - 隐式建模
date: 2026-08-10
---


# 第二十二章 隐式建模（Implicit Modeling）

> **来源**：《Fundamentals of Computer Graphics》第 4 版 · Ch.22 · PDF 第 585–612 页
> **作者**：Brian Wyvill
> **定位**：隐式建模用标量场定义三维曲面/体——$f(x,y,z)=0$ 的等值面即为曲面。相比参数曲面，隐式方法在混合（blending）、CSG 布尔运算、碰撞检测等方面有根本性优势。本章从骨架基元 → 渲染 → 混合 → CSG → 翘曲 → BlobTree → 交互系统，完整介绍隐式建模管线。
> **关联**：依赖第 12 章（网格细化）、第 15 章（连续性）、第 9 章（插值/卷积）；与第 13 章（光线追踪）互补

---

## 1. 隐式函数与骨架基元（§22.1）

### 1.1 基本定义

隐式曲面由标量场 $f: \mathbb{E}^3 \to \mathbb{R}$ 定义，曲面上的点满足 $f(x,y,z) = \text{iso}$（通常 $\text{iso} = 0$）。

$$\text{例如圆：}\quad f(x,y) = x^2 + y^2 - r^2 = 0$$

$f > 0$ 在曲面外，$f < 0$ 在曲面内。三维空间中的标量场形成**等值面**（isosurface）。

每个隐式基元拆分为：

$$f_i(x,y,z) = g_i \circ d_i(x,y,z)$$

- $d_i$：**距离函数**——点 $\mathbf{p}$ 到骨架的最短距离
- $g_i$：**衰减滤波器（fall-off filter function）**——距离 → 场值，骨架处最大，距离增大衰减到零

### 1.2 常见衰减滤波器

| 名称 | 函数（$d \in [0, R]$，$R$ 为影响半径） |
|---|---|
| **Blinn / Blobby** | $g(d) = e^{-r d^2}$（高斯型，无界） |
| **Metaball** | $g(d) = \begin{cases} 1 - 3(d/R)^2 & 0 \le d \le R/3 \\ \frac{3}{2}(1 - d/R)^2 & R/3 \le d \le R \\ 0 & d > R \end{cases}$ |
| **Soft Objects** | $g(d) = 1 - \frac{4}{9}\frac{d^6}{R^6} + \frac{17}{9}\frac{d^4}{R^4} - \frac{22}{9}\frac{d^2}{R^2}$ |
| **Wyvill** | $g(d) = \left(1 - \frac{d^2}{R^2}\right)^3$ |

> **有限支撑**优于无限支撑：远离 $\mathbf{p}$ 的基元贡献为零，无需计算。

### 1.3 求和混合（Summation Blending）

全局场 = 所有骨架基元贡献之和：

$$f(x,y,z) = \sum_{i=1}^n f_i(x,y,z)$$

当两个基元靠近时，它们的场叠加使等值面"鼓起来"→ 自动产生光滑混合。

---

## 2. 其他隐式曲面类型（§22.1.2–22.1.5）

### 2.1 距离场与 R 函数（Distance Fields & R-Functions）

**距离场**：$F(T, \mathbf{p}) = \min_{\mathbf{q} \in T} |\mathbf{q} - \mathbf{p}|$，其中 $T$ 是参考几何体。

**R 函数**（Rvachev 函数）：符号仅由参数符号决定的函数 → 提供 $C^n$ CSG 算子所需的理论框架。通过加固定偏移可转为混合算子（R 算子）。

### 2.2 水平集（Level Sets）

将隐式场离散化到规则/自适应网格上，使用曲率相关速度函数动态修改数据结构。网格可作为所有体模型的统一表示。

### 2.3 变分隐式曲面（Variational Implicit Surfaces）

用**全局支撑的径向基函数（RBF）**插值/逼近采样点。常用 $C^2$ thin-plate spline。若用**紧支撑 RBF**（CS-RBF），计算量大幅降低，但会产生额外等值轮廓。

### 2.4 卷积曲面（Convolution Surfaces）

$$f(\mathbf{p}) = \int_{S} g(\mathbf{r})\,h(\mathbf{p} - \mathbf{r})\,d\mathbf{r}$$

骨架构型（S）与核函数（h）的卷积。优点：组合骨架的卷积结果**不产生鼓包**（消除求和混合的典型问题）。支持点、线、弧、三角形、多边形等骨架。

---

## 3. 连续性、梯度与法线（§22.1.1）

隐式曲面的**梯度** $\nabla f$ 即为标量场的三维导数向量：

$$\nabla f(\mathbf{p}) = \left(\frac{\partial f}{\partial x}, \frac{\partial f}{\partial y}, \frac{\partial f}{\partial z}\right)$$

- $f$ 为 $C^1$ 当且仅当三个偏导数均为 $C^0$
- 曲面法线 = 梯度方向归一化：$\mathbf{n} = \pm\frac{\nabla f}{\|\nabla f\|}$
- 距离场在骨架处不 $C^1$，但合适的衰减函数可消除不连续性
- CSG 的 min/max 算子会引入 $C^1$ 不连续（产生折痕）——有时需要，有时不想要

---

## 4. 渲染隐式曲面（§22.2–22.3）

两大方法：

| 方法 | 原理 | 特点 |
|---|---|---|
| **光线追踪** | 直接沿光线求 $f(\mathbf{p}) = \text{iso}$ | 质量高，适合最终渲染 |
| **多边形化（Surface Tiling）** | 将曲面转为三角网格 | 速度快，适合交互预览 |

### 4.1 空间划分算法

**核心思想**（类比 Marching Cubes）：

1. **搜索种子立方体**：沿骨架元素方向逐顶点求值（$f(v_i) \ge \text{iso}$ 为内，$f(v_i) < \text{iso}$ 为外），找到首条含曲面交点的边
2. **推广到整个曲面**：用队列 BFS——处理当前立方体的六个面邻居，将有相交边的加入队列
3. **哈希表存储**：只存储含曲面的立方体顶点（$i,j,k$ 索引 → 哈希地址），避免存储全空间网格
4. **多边形化**：256 种顶点正负组合 → 查表出三角形。每个立方体独立替换为三角形集

**边-曲面交点计算**：
- 快速（线性插值）：$\displaystyle A = V_3 + \frac{\text{iso} - f(V_2)}{f(V_6) - f(V_2)}$
- 精确：用 regula falsi 求根 + 梯度

**梯度数值近似**：
$$\nabla f(\mathbf{p}) \approx \left(\frac{f(\mathbf{p}+\Delta x) - f(\mathbf{p})}{\Delta x}, \frac{f(\mathbf{p}+\Delta y) - f(\mathbf{p})}{\Delta y}, \frac{f(\mathbf{p}+\Delta z) - f(\mathbf{p})}{\Delta z}\right)$$
其中 $\Delta \approx 0.01 \times \text{side}$ 效果良好。

### 4.2 采样问题与歧义

- **歧义情况**：立方体相对顶点同符号，对角的另一对也同符号 → 两个曲面还是鞍点？
- **分辨率不足**：场在立方体内大幅变化但捕捉不到（表面有小于立方体的细节）
- **解决方案**：
  - 面中心额外采样消除歧义
  - 立方体分解为 **6 个四面体**（仅有 $2^4 = 16$ 种组合，无歧义，但三角形数翻倍）
  - **八叉树细化**（Bloomenthal）：自适应于曲率，减少三角形但实现更复杂

---

## 5. 混合与 CSG（§22.4–22.5）

### 5.1 Ricci 超椭圆混合

$$f_{A \oplus B} = \left(f_A^n + f_B^n\right)^{1/n}$$

- $n = 1$：标准加法混合（$A + B$）
- $n \to \infty$：max（并集）
- $n \to -\infty$：min（交集）
- 性质：**封闭**（对任意隐式体运算结果仍是隐式体），**结合律** $f_{(A\oplus B)\oplus C} = f_{A\oplus (B\oplus C)}$

### 5.2 Pasko 广义混合

$$f_{A \oplus B} = f_A + f_B + \alpha\sqrt{f_A^2 + f_B^2}\left(\frac{f_A^2 + f_B^2}{f_A^2 + f_B^2}\right)^{\frac{n}{2}}$$

$\omega \in [-1, 1]$ 控制从交集到并集的连续过渡。缺点是**不满足结合律**。

### 5.3 隐式 CSG

对隐式体做布尔运算**极为简单**（与 B-rep CSG 形成鲜明对比）：

| 运算 | 隐式定义 |
|---|---|
| **并集** $\cup$ | $\max_{i=0}^{k-1} f_i$ |
| **交集** $\cap$ | $\min_{i=0}^{k-1} f_i$ |
| **差集** $\setminus$ | $\min\left(f_0,\; 2\cdot\text{iso} - \max_{j=1}^{k-1} f_j\right)$ |

> **警告**：CSG 的 min/max 在 $f_1(p) = f_2(p)$ 处产生 $C^1$ 不连续面 → 之后再做 blending 会出现**着色不连续**（折痕）。已有 $C^1$ CSG 算子（除 $f_1 = f_2 = \text{iso}$ 外处处 $C^1$）。

---

## 6. 翘曲（Warping, §22.6）

通过连续函数 $w: \mathbb{R}^3 \to \mathbb{R}^3$ 扭曲空间来变形隐式曲面：

$$f_i(x,y,z) = g_i \circ d_i \circ w_i(x,y,z)$$

渲染时：先对 $\mathbf{p}$ 应用翘曲得到 $\mathbf{Q}$，返回 $f(\mathbf{Q})$。

**三种经典 Barr 翘曲**（可嵌套）：

| 翘曲 | 公式 | 说明 |
|---|---|---|
| **Twist**（绕 $z$） | $\begin{pmatrix} x\cos\theta(z) - y\sin\theta(z) \\ x\sin\theta(z) + y\cos\theta(z) \\ z \end{pmatrix}$ | 螺旋扭曲 |
| **Taper**（沿 $y$） | $\begin{pmatrix} s(y)\,x \\ y \\ s(y)\,z \end{pmatrix},\; s(y) = \frac{y_{\max}-y}{y_{\max}-y_{\min}}$ | 线性锥化 |
| **Bend**（绕 $z$） | $\begin{pmatrix} -\sin\theta\,(y-1/k) + x_0 \\ \cos\theta\,(y-1/k) + 1/k \\ z \end{pmatrix}$ | $\theta = (x-x_0)k$，$k$ 为弯曲率 |

> **法线不跟随翘曲**：翘曲点不能同理翘曲法线 → 需要用 Jacobian 或数值梯度近似。

---

## 7. 精确接触建模 / PCM（§22.7）

**问题**：两个隐式物体碰撞时如何变形而非互相穿透？

**PCM 方案**：在碰撞物体的场值上叠加**变形函数 $s_i(\mathbf{p})$**：

$$f_1(p) + s_1(p) = \text{iso},\quad f_2(p) + s_2(p) = \text{iso}$$

- **互穿区（interpenetration region）**：$s_i = -f_i$（物体被压缩）
- **传播区（propagation region）**：$s_i = h_i(r)$，用两段三次多项式构建的平滑过渡函数，在 $r = r_i$ 处衰减到零

$h_i$ 设计为 $C^1$ 连续（在穿/传边界处 $h_i(0) = k$ 等于 $f_i$ 的方向导数）。PCM 是一个**近似**但因其简单性而吸引人。

---

## 8. BlobTree（§22.8）

**BlobTree** = 扩展的 CSG 树 → 融合了隐式建模的所有元素。

### 节点类型

| 节点 | 含义 | 类型 |
|---|---|---|
| **primitive** | 骨架隐式基元（点、线、面……） | 叶节点 |
| **$\cup$** | 并集 | 二元 |
| **$\cap$** | 交集 | 二元 |
| **$-$** | 差集 | 二元 |
| **$+$** | 加法混合 | 二元 |
| **$\oplus$** | 超椭圆混合（Ricci） | $n$ 元 |
| **$w$** | 翘曲（twist/taper/bend） | 一元 |
| **affine transform** | 仿射变换 | 场景图节点 |

### 遍历算法（简化二元形式）

```
function f(N, M):
    ■ primitive:     f(M)
    ■ warp:          f(L(N), w(M))
    ■ blend (+):     f(L(N), M) + f(R(N), M)
    ■ union (∪):     max(f(L(N), M), f(R(N), M))
    ■ intersection:  min(f(L(N), M), f(R(N), M))
    ■ difference:    min(f(L(N), M), -f(R(N), M))
```

BlobTree 同时是**场景图**（含实例化），兼具 CSG 和混合的全部能力。

---

## 9. 交互隐式建模系统（§22.9）

| 系统 | 特点 |
|---|---|
| **Teddy**（1999） | 早期草图建模，2D 笔画 → 多边形模型 |
| **Shapeshop** | 2D 笔画 → 隐式 Sweep 曲面，保留 BlobTree 层次结构 |
| **Hyperfun** | F-rep 的 C 语言式描述，纯程序化 |

**性能关键**：BlobTree 节点上的 **3D 缓存网格**——节点子树未变时，直接用三线性插值（位置）/ 三二次插值（梯度）返回缓存值，避免重复遍历。

---

## 📌 核心知识速查

| 概念 | 要点 |
|---|---|
| **隐式曲面** | $f(p) = \text{iso}$ 的所有点集，内部 $f < \text{iso}$，外部 $f > \text{iso}$ |
| **骨架基元分解** | $f_i = g_i \circ d_i$：距离函数 $d_i$ + 衰减滤波器 $g_i$ |
| **求和混合** | $f = \sum f_i$ ——最简洁高效的混合方式 |
| **常用 $g_i$** | Blinn(高斯,无界)、Metaball、Soft Objects、Wyvill（$C^1$，有限支撑） |
| **梯度 $\nabla f$** | 标量场的一阶导（向量），归一化即曲面法线 |
| **Ricci 混合** | $f = (f_A^n + f_B^n)^{1/n}$，$n=1$ 为加法，$n \to \infty$ 为 max |
| **隐式 CSG** | $\max$ 并，$\min$ 交，$\min(f_0, 2\text{iso} - \max f_j)$ 差 |
| **空间划分渲染** | 种子立方体 → BFS + 哈希表 → 查 256 表多边形化 |
| **采样歧义** | 相对顶点同号 → 面中心额外采样 或 分解为 6 四面体（16 表，无歧义） |
| **翘曲（Warp）** | Twists / Taper / Bend，嵌套使用；渲染时逆向映射 |
| **PCM** | 碰撞自动变形：互穿区压缩 + 传播区三次多项式衰减 |
| **BlobTree** | CSG 树 + 混合 + 翘曲 + 场景图 = 统一隐式建模框架 |
| **法线计算** | 梯度归一化；翘曲后需 Jacobian 不能直接翘曲法线 |

---

## 🔗 隐式 vs 参数曲面对比

| 维度 | 隐式曲面 | 参数曲面（如 Bézier/B-spline） |
|---|---|---|
| **Blending** | 天然——标量场自然叠加 | 困难 |
| **CSG** | 极简单（min/max 一行代码） | 极复杂 |
| **碰撞检测** | 只需 $f(p)$ 符号——$O(1)$ 内外测试 | 需复杂几何相交计算 |
| **精确圆锥曲线** | NURBS 需比值形式；隐式天然可表示 | 有 NURBS |
| **曲面点采样** | 困难——需要空间搜索 | 简单——$f(u,v)$ 直接计算 |
| **直觉编辑** | 间接（修改骨架/权重） | 直接（拖动控制点） |
