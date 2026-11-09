---
title: 第 8 章：正交归一基 ONB
publish: true
updated: 2026-09-09T05:56:58.067Z
tags:
  - ray-tracing
  - geometry
  - coordinate-system
  - onb
---


# 第 8 章：正交归一基 ONB

## 为什么需要 ONB

第七章的 `random_cosine_direction()` 默认局部法线为：

$$
(0,0,1)
$$

也就是说，它只会生成围绕局部 $+z$ 轴的余弦方向。

真实表面法线可能朝任意方向，所以需要建立一个以真实法线为轴的局部坐标系，再把第七章的局部方向转换到世界坐标。

## 什么是正交归一基

ONB 由三个单位向量组成：

$$
\mathbf u,\mathbf v,\mathbf w
$$

满足：

$$
\|\mathbf u\|
=\|\mathbf v\|
=\|\mathbf w\|=1
$$

并且两两垂直：

$$
\mathbf u\cdot\mathbf v
=
\mathbf v\cdot\mathbf w
=
\mathbf w\cdot\mathbf u
=0
$$

其中令：

$$
\mathbf w=\operatorname{unit}(\mathbf n)
$$

也就是让局部 $w$ 轴指向真实表面法线。

## 坐标是基向量的系数

局部向量：

$$
\mathbf d_{local}=(x,y,z)
$$

表示的不是世界坐标分量，而是：

$$
\boxed{
\mathbf d_{world}
=
x\mathbf u+y\mathbf v+z\mathbf w
}
$$

因为处理的是方向而不是位置，所以只需要三根坐标轴，不需要原点。

## 根据法线构造 ONB

代码：

```cpp
onb(const vec3& n) {
    axis[2] = unit_vector(n);

    vec3 a = (std::fabs(axis[2].x()) > 0.9)
           ? vec3(0,1,0)
           : vec3(1,0,0);

    axis[1] = unit_vector(cross(axis[2], a));
    axis[0] = cross(axis[2], axis[1]);
}
```

### 第一步：确定 $w$

$$
\mathbf w=\operatorname{unit}(\mathbf n)
$$

### 第二步：选择不平行的辅助轴 $a$

一般选择 $x$ 轴。如果 $w$ 已经非常接近 $x$ 轴，就改用 $y$ 轴，避免：

$$
\mathbf w\times\mathbf a\approx0
$$

对接近零的向量做单位化会造成数值不稳定。`0.9` 是一个安全阈值，不是物理常数。

### 第三步：叉积得到 $v$

$$
\mathbf v
=
\operatorname{unit}(\mathbf w\times\mathbf a)
$$

$v$ 同时垂直于 $w$ 和辅助向量 $a$。

### 第四步：得到 $u$

$$
\mathbf u=\mathbf w\times\mathbf v
$$

因为 $w,v$ 已经互相垂直且长度为 1，所以 $u$ 也自动是单位向量。

## `transform()`

```cpp
vec3 transform(const vec3& d) const {
    return d[0] * axis[0]
         + d[1] * axis[1]
         + d[2] * axis[2];
}
```

即：

$$
\operatorname{transform}(x,y,z)
=
x\mathbf u+y\mathbf v+z\mathbf w
$$

因此：

```cpp
uvw.transform(random_cosine_direction())
```

表示：

1. 围绕局部 $z$ 轴生成余弦方向；
2. 把局部 $z$ 轴映射到真实法线 $w$；
3. 得到围绕真实表面法线的世界空间方向。

## 一个具体例子

假设真实法线：

$$
\mathbf n=(0,1,0)
$$

可能得到：

$$
\mathbf w=(0,1,0),\quad
\mathbf v=(0,0,-1),\quad
\mathbf u=(-1,0,0)
$$

局部方向：

$$
\mathbf d_{local}=(0.3,0.4,0.866)
$$

转换后：

$$
\begin{aligned}
\mathbf d_{world}
&=0.3\mathbf u+0.4\mathbf v+0.866\mathbf w\\
&=(-0.3,0.866,-0.4)
\end{aligned}
$$

它与真实法线的点积：

$$
\mathbf d_{world}\cdot\mathbf w=0.866
$$

等于转换前的局部 $z$。所以变换改变了整体朝向，却没有改变方向与法线之间的夹角。

## 为什么 PDF 不会被变换破坏

因为 ONB 正交归一：

$$
\|x\mathbf u+y\mathbf v+z\mathbf w\|^2
=
x^2+y^2+z^2
$$

所以变换保持：

- 向量长度；
- 向量夹角；
- 固体角面积；
- 原有概率密度形状。

并且：

$$
\mathbf d_{world}\cdot\mathbf w=z
$$

所以余弦 PDF 可以直接计算：

```cpp
auto cosine_theta = dot(unit_vector(direction), uvw.w());
return std::fmax(0, cosine_theta / pi);
```

## 当前 `cosine_pdf` 的结构

```cpp
class cosine_pdf : public pdf {
  public:
    cosine_pdf(const vec3& w) : uvw(w) {}

    double value(const vec3& direction) const override {
        auto cosine_theta =
            dot(unit_vector(direction), uvw.w());

        return std::fmax(0, cosine_theta / pi);
    }

    vec3 generate() const override {
        return uvw.transform(random_cosine_direction());
    }

  private:
    onb uvw;
};
```

- `generate()`：生成围绕真实法线的余弦方向；
- `value()`：查询任意方向在这个余弦分布下的密度。

二者必须描述同一个分布。

## 各向同性介质为什么不需要 ONB

各向同性散射在整个球面上均匀：

$$
p(\omega)=\frac{1}{4\pi}
$$

它没有偏好的法线方向。球面均匀分布经过任意旋转仍然不变，因此可以直接使用 `random_unit_vector()` 和 `sphere_pdf`。

## 本章结论

> 第七章决定方向“相对于法线偏多少”，第八章用 ONB 把假想的 $z$ 轴法线替换成真实表面法线。

下一章：[[学习笔记/cg/rt in one weekend/rest_life/09-直接采样光源.md|第 9 章：直接采样光源]]。
