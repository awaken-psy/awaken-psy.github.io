---
title: 第十章 表面着色（Surface Shading）
publish: true
updated: 2026-08-04T00:00:00.000Z
tags:
  - 虎书
  - 计算机图形学
  - 表面着色
  - 光照模型
aliases:
  - 虎书第十章
  - Surface Shading
  - 漫反射着色
  - Phong着色
  - 艺术着色
date: 2026-08-04
---


# 第十章 表面着色（Surface Shading）

> **来源**：《Fundamentals of Computer Graphics》第 4 版 · Ch.10 Surface Shading · PDF 第 248–257 页
> **定位**：经过观察变换和光栅化后，几何已"画到屏幕上"。本章解决"怎么上色"——用光照模型给表面赋予明暗与色彩。三类方法：**漫反射**（哑光）、**Phong**（高光）、**艺术着色**（非真实感）。
> **关键约束**：本章所有公式应在**世界坐标**中计算，不能用透视变换后的坐标——否则法线间角度被扭曲，着色不准。

---

## 1. 漫反射着色（Diffuse Shading）

### 1.1 朗伯模型（Lambertian）

许多物体呈"哑光"外观（纸张、未加工木材、干燥石头），颜色几乎不随视点变化。这类物体遵循**朗伯余弦定律**：表面颜色与法线 $\mathbf{n}$ 和光源方向 $\mathbf{l}$ 之间夹角的余弦成正比。

$$c \propto \cos\theta \quad\Longleftrightarrow\quad c \propto \mathbf{n}\cdot\mathbf{l}$$

其中 $\mathbf{n}$、$\mathbf{l}$ 均为单位向量。$\mathbf{l}$ 通常不依赖物体位置——即假设光源"无限远"，称为**定向光（directional light）**。

加入表面漫反射率 $\mathbf{c}_r$（RGB，各通道 $\in[0,1]$）和光源强度 $\mathbf{c}_l$（RGB，$\in[0,1]$）：

$$\mathbf{c} = \mathbf{c}_r\,\mathbf{c}_l\,(\mathbf{n}\cdot\mathbf{l}) \tag{10.2}$$

问题：$\mathbf{n}\cdot\mathbf{l}<0$（表面背向光源）时颜色为负。两种修法：

| 修法 | 公式 | 含义 |
|---|---|---|
| 截断到零 | $\mathbf{c}=\mathbf{c}_r\,\mathbf{c}_l\,\max(0,\,\mathbf{n}\cdot\mathbf{l})$ | 背光面纯黑（式 10.3） |
| 取绝对值 | $\mathbf{c}=\mathbf{c}_r\,\mathbf{c}_l\,|\mathbf{n}\cdot\mathbf{l}|$ | 双面光照——等价于在相反方向再加一个同色光源（式 10.4） |

### 1.2 环境光（Ambient）

式 (10.3) 的问题：背光面完全黑。现实中光四处反射，各方向都有入射。最简单的补法：加一个**常数环境光项** $\mathbf{c}_a$：

$$\mathbf{c} = \mathbf{c}_r\bigl(\mathbf{c}_a + \mathbf{c}_l\,\max(0,\,\mathbf{n}\cdot\mathbf{l})\bigr)$$

$\mathbf{c}_a$ 可直觉理解为"场景中所有表面的平均颜色"。为保证 RGB 不超 1，应满足 $\mathbf{c}_a + \mathbf{c}_l \le (1,1,1)$，否则需钳制。

### 1.3 基于顶点的漫反射着色

直接对每个三角形用 (10.2) 会得到**刻面外观（faceted）**——三角形之间有明显棱角。如果三角形是对光滑曲面的逼近，更自然的做法是：

1. 在**顶点处**放置法向量（而非每个三角形一个法线）；
2. 在每个顶点用式 (10.3) 算出颜色；
3. 用**重心坐标插值**（§8.1.2）在三角形内部平滑过渡颜色。

这就是 **Gouraud 着色**。

> **法线从哪来？**
> - 模型自带法线 → 直接用；
> - 曲面细分时自己生成；
> - 没有法线的多边形模型 → 取共享该顶点的所有三角形法线的**平均值**，再**归一化**为单位向量。

---

## 2. Phong 着色（高光）

### 2.1 动机

有些表面虽像哑光但有**高光（highlight）**——抛光瓷砖、光泽涂料、白板。高光随视点移动而移动，且高光颜色是**光源颜色**而非表面颜色（反射发生在表面，未穿透表面获取物体颜色）。

引入指向眼睛的单位向量 $\mathbf{e}$。高光中心在反射方向 $\mathbf{r}$ 与视线 $\mathbf{e}$ "对齐"处（$\sigma=0$）。

### 2.2 Phong 照明模型

$\mathbf{r}$ 是 $\mathbf{l}$ 关于法线 $\mathbf{n}$ 的反射：

$$\mathbf{r} = -\mathbf{l} + 2(\mathbf{l}\cdot\mathbf{n})\,\mathbf{n} \tag{10.6}$$

高光公式：

$$\mathbf{c} = \mathbf{c}_l\,\max(0,\,\mathbf{e}\cdot\mathbf{r})^p \tag{10.5}$$

指数 $p>0$ 称为 **Phong 指数**，控制高光锐度——$p$ 越大高光越窄越集中。


> [!tip] 半角向量（Blinn-Phong）
> 避免计算 $\mathbf{r}$ 的替代方案：用 $\mathbf{l}$ 和 $\mathbf{e}$ 的**半角向量**：
>
> $$\mathbf{h} = \frac{\mathbf{e}+\mathbf{l}}{\|\mathbf{e}+\mathbf{l}\|}$$
>
> 高光出现在 $\mathbf{h}$ 接近 $\mathbf{n}$ 时：
>
> $$\mathbf{c} = \mathbf{c}_l\,(\mathbf{h}\cdot\mathbf{n})^p \tag{10.7}$$
>
> 优势：$\mathbf{h}\cdot\mathbf{n}$ 在眼睛和光源位于表面上方时始终为正，无需 `max`。代价：需要归一化 $\mathbf{h}$（一次除法 + 平方根）。注意 $\mathbf{h}$ 与 $\mathbf{n}$ 的夹角是 $\mathbf{e}$ 与 $\mathbf{r}$ 夹角的**一半**，所以指数 $p$ 的效果略有不同。

### 2.3 漫反射 + 高光合成

实际材质通常同时有漫反射和高光。合并式 (10.3) 和 (10.7)：

$$\mathbf{c} = \mathbf{c}_r\bigl(\mathbf{c}_a + \mathbf{c}_l\,\max(0,\,\mathbf{n}\cdot\mathbf{l})\bigr) + \mathbf{c}_l\,(\mathbf{h}\cdot\mathbf{n})^p \tag{10.8}$$

加入高光控制项 $\mathbf{c}_p$（RGB）调暗/着色高光：

$$\boxed{\mathbf{c} = \mathbf{c}_r\bigl(\mathbf{c}_a + \mathbf{c}_l\,\max(0,\,\mathbf{n}\cdot\mathbf{l})\bigr) + \mathbf{c}_l\,\mathbf{c}_p\,(\mathbf{h}\cdot\mathbf{n})^p} \tag{10.9}$$

$\mathbf{c}_p$ 的用途：

| 材质 | $\mathbf{c}_p$ 取值 | 效果 |
|---|---|---|
| 塑料 | 中性灰，$<1$ | 高光偏白 |
| 金属 | $\mathbf{c}_p = \mathbf{c}_r$ | 高光继承金属色 |
| 保底不超 1 | $\mathbf{c}_p = 1 - M$，$M=\max(\mathbf{c}_r)$ | 单光源无环境光时颜色不溢出 |

### 2.4 法线插值（Phong 着色 vs Gouraud 着色）

高光颜色变化比漫反射快得多，在顶点处着色再插值颜色（Gouraud）会产生明显伪影——高光可能被"漏掉"或变形。

**解决方案**：不在顶点插值颜色，而是插值**法线**本身，在每个像素处重新着色：

$$\mathbf{n} = \alpha\,\mathbf{n}_0 + \beta\,\mathbf{n}_1 + \gamma\,\mathbf{n}_2 \tag{10.11}$$

然后对插值后的 $\mathbf{n}$ 归一化，代入式 (10.9)。这称为 **Phong 法线插值**（或 Phong 着色），质量远优于 Gouraud 着色，代价是每像素都要做完整着色计算。

| | Gouraud 着色 | Phong 着色 |
|---|---|---|
| 插值对象 | 顶点**颜色** | 顶点**法线** |
| 着色位置 | 顶点 | 每像素 |
| 高光质量 | 可能丢失/变形 | 锐利、正确 |
| 开销 | 低（N 个顶点） | 高（每像素） |

---

## 3. 艺术着色（Artistic Shading）

模仿人类画师的技法而非物理真实。适用于技术插图、车主手册等场景。

### 3.1 线条绘制

**轮廓（silhouette）**：共享一条边的两个三角形，一个朝向观察者、另一个背向时，该边画为轮廓线。判据：

$$\text{draw silhouette if}\quad (\mathbf{e}\cdot\mathbf{n}_0)(\mathbf{e}\cdot\mathbf{n}_1) \le 0$$

即两个法线与视线 $\mathbf{e}$ 的点积异号。等价地，用隐式平面方程 $f_0$、$f_1$：

$$\text{draw silhouette if}\quad f_0(\mathbf{e})\,f_1(\mathbf{e}) \le 0$$

**折痕（crease）**：光滑表面上不应画三角形边，但几何上确实有拐角的地方要画。判据：

$$\text{draw crease if}\quad \mathbf{n}_0\cdot\mathbf{n}_1 \le \text{threshold}$$

两法线夹角足够大（点积小）说明有尖角。轮廓 + 折痕 = 美观的线稿。

### 3.2 冷暖着色（Cool-to-Warm Shading）

用低强度色调表现曲面方向感：朝"暖"方向的面涂暖色（橙），背向涂冷色（蓝），黑轮廓清晰可见，整体卡通效果。

定义温暖常数：

$$k_w = \frac{1 + \mathbf{n}\cdot\mathbf{l}}{2} \in [0,1]$$

颜色为冷色 $\mathbf{c}_c$ 与暖色 $\mathbf{c}_w$ 的线性混合：

$$\mathbf{c} = k_w\,\mathbf{c}_w + (1-k_w)\,\mathbf{c}_c$$

推荐取值：

$$\mathbf{c}_c = (0.4,\;0.4,\;0.7),\qquad \mathbf{c}_w = (0.8,\;0.6,\;0.6)$$
 

> [!warning] 没有轮廓的冷暖着色几乎没用
> 图 10.9 展示：纯冷暖着色不加轮廓时缺乏对比度，立体感不足。加上黑色轮廓后效果显著提升——轮廓是艺术着色的关键组成。

---

## 📌 速查表

| 问 | 答案要点 |
|---|---|
| 朗伯模型 | $\mathbf{c}=\mathbf{c}_r\mathbf{c}_l\max(0,\mathbf{n}\cdot\mathbf{l})$；颜色∝法线与光源夹角余弦 |
| 定向光 | $\mathbf{l}$ 不依赖物体位置，光源"无限远" |
| 环境光 | 常数项 $\mathbf{c}_a$ 模拟各方向散射光，消除纯黑背光面 |
| Gouraud 着色 | 顶点处算颜色 → 重心插值颜色；开销低但高光可能丢失 |
| 反射向量 | $\mathbf{r}=-\mathbf{l}+2(\mathbf{l}\cdot\mathbf{n})\mathbf{n}$（式 10.6） |
| Phong 高光 | $\mathbf{c}_l\max(0,\mathbf{e}\cdot\mathbf{r})^p$；指数 $p$ 越大高光越窄 |
| 半角向量 | $\mathbf{h}=\frac{\mathbf{e}+\mathbf{l}}{\|\mathbf{e}+\mathbf{l}\|}$，$\mathbf{h}\cdot\mathbf{n}$ 始终非负 |
| 合成公式 | $\mathbf{c}_r(\mathbf{c}_a+\mathbf{c}_l\max(0,\mathbf{n}\cdot\mathbf{l}))+\mathbf{c}_l\mathbf{c}_p(\mathbf{h}\cdot\mathbf{n})^p$（式 10.9） |
| $\mathbf{c}_p$ 用途 | 塑料取中性灰；金属取 $\mathbf{c}_p=\mathbf{c}_r$ |
| Phong 着色 | 插值法线 $\mathbf{n}=\alpha\mathbf{n}_0+\beta\mathbf{n}_1+\gamma\mathbf{n}_2$ → 归一化 → 每像素着色 |
| Gouraud vs Phong | 前者插值颜色（顶点着色），后者插值法线（每像素着色） |
| 轮廓线 | $(\mathbf{e}\cdot\mathbf{n}_0)(\mathbf{e}\cdot\mathbf{n}_1)\le0$ |
| 折痕线 | $\mathbf{n}_0\cdot\mathbf{n}_1\le\text{threshold}$ |
| 冷暖着色 | $k_w=\frac{1+\mathbf{n}\cdot\mathbf{l}}{2}$，$\mathbf{c}=k_w\mathbf{c}_w+(1-k_w)\mathbf{c}_c$ |
| 计算坐标系 | 必须在世界坐标，不能在透视变换后坐标 |
