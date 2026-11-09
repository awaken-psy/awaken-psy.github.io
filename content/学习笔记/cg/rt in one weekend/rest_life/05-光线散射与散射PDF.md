---
title: 第 5 章：光线散射与散射 PDF
publish: true
updated: 2026-09-09T05:50:59.229Z
tags:
  - ray-tracing
  - light-transport
  - brdf
  - pdf
---


# 第 5 章：光线散射与散射 PDF

## 一次反弹包含三件事

光线到达表面后，可以把一次反弹拆成：

1. **保留多少能量**：albedo $A$；
2. **更倾向向哪个方向散射**：$p_{\text{scatter}}(\omega)$；
3. **那个方向传来多少光**：$C_i(\omega)$。

因此表面返回的颜色是对上半球所有入射方向的积分：

$$
\boxed{
C_o
=
\int_{H^2}
A\,
p_{\text{scatter}}(\omega)\,
C_i(\omega)\,
d\omega
}
$$

这里 $C_i(\omega)$ 无法直接知道，渲染器要沿方向 $\omega$ 继续追踪一条光线，所以 `ray_color()` 是递归的。

## Albedo

Albedo 表示表面保留而没有吸收的能量比例。在 RGB 渲染器中它通常是颜色：

```cpp
color attenuation;
```

例如红色物体对红色通道保留较多，对绿色和蓝色通道吸收较多。

项目中：

```cpp
srec.attenuation = tex->value(rec.u, rec.v, rec.p);
```

可理解为公式中的 $A$。

## Scattering PDF

$p_{\text{scatter}}(\omega)$ 描述材质的物理散射方向分布。

它可以依赖：

- 当前表面位置；
- 入射方向和出射方向；
- 波长；
- 表面法线或材质参数。

改变 `scattering_pdf` 会改变材质本身和最终正确图像，不只是改变噪声。

## Lambertian 的散射 PDF

Lambertian 表面满足余弦分布：

$$
p_{\text{scatter}}(\omega)=C\cos\theta
$$

要求在上半球积分为 1：

$$
1
=
\int_0^{2\pi}
\int_0^{\pi/2}
C\cos\theta\sin\theta
\,d\theta\,d\phi
$$

积分结果为：

$$
1=C\pi
$$

所以：

$$
\boxed{
p_{\text{scatter}}(\omega)
=
\frac{\cos\theta}{\pi}
}
$$

代码：

```cpp
double scattering_pdf(
    const ray& r_in,
    const hit_record& rec,
    const ray& scattered
) const override {
    auto cos_theta = dot(
        rec.normal,
        unit_vector(scattered.direction())
    );

    return cos_theta < 0 ? 0 : cos_theta / pi;
}
```

表面下方方向的余弦为负，物理散射密度应为 0。

## 蒙特卡洛形式

如果程序实际按照 $p(\omega)$ 生成方向：

$$
\boxed{
C_o
\approx
\frac1N\sum_{k=1}^{N}
\frac{
A\,p_{\text{scatter}}(\omega_k)\,C_i(\omega_k)
}{p(\omega_k)}
}
$$

单个样本在代码中对应：

```cpp
color sample_color = ray_color(
    scattered,
    depth - 1,
    world,
    lights
);

color color_from_scatter =
    srec.attenuation
    * scattering_pdf
    * sample_color
    / pdf_value;
```

各项对应：

| 公式 | 代码 | 含义 |
|---|---|---|
| $A$ | `srec.attenuation` | 保留的颜色/能量 |
| $p_{\text{scatter}}$ | `scattering_pdf` | 材质物理散射项 |
| $C_i$ | `sample_color` | 该方向返回的光 |
| $p$ | `pdf_value` | 程序实际采样 PDF |

## 为什么第一本书的代码看起来没有 PDF

如果程序恰好按照 Lambertian 散射 PDF 采样：

$$
p(\omega)
=
p_{\text{scatter}}(\omega)
=
\frac{\cos\theta}{\pi}
$$

那么：

$$
\frac{p_{\text{scatter}}}{p}=1
$$

于是：

$$
C_o\approx A\,C_i
$$

代码就简化成：

```cpp
return attenuation * ray_color(scattered, depth-1, world);
```

PDF 没有消失，它只是因为分子和分母相同而被约掉了；采样方向本身仍然服从这个 PDF。

## 与 BRDF 的关系

标准渲染方程通常写成：

$$
L_o
=
\int f_r(\omega_i,\omega_o)
L_i(\omega_i)
\cos\theta_i\,d\omega_i
$$

与书中的拆分对照：

$$
\boxed{
A\,p_{\text{scatter}}(\omega)
=
f_r(\omega_i,\omega_o)\cos\theta
}
$$

所以：

$$
\boxed{
f_r
=
\frac{A\,p_{\text{scatter}}}{\cos\theta}
}
$$

对于 Lambertian：

$$
p_{\text{scatter}}=\frac{\cos\theta}{\pi}
$$

因此：

$$
\boxed{f_r=\frac{A}{\pi}}
$$

所以 `albedo × scattering_pdf` 不是 BRDF 本身，而是：

$$
\text{BRDF}\times\cos\theta
$$

## 物理散射 PDF 与采样 PDF

这是后续章节最重要的区分：

- `scattering_pdf`：材质物理规律，属于被积函数；
- `pdf::generate()`：程序如何生成方向；
- `pdf::value(direction)`：实际生成分布在该方向上的密度；
- `pdf_value`：蒙特卡洛估计器分母。

它们可以数值相同，但概念职责不同。

## 本章结论

> 表面颜色来自对所有方向的光照积分。Albedo 决定保留多少能量，scattering PDF 决定材质如何分配这些能量，递归 `ray_color()` 决定该方向实际有多少入射光。

下一章：[[学习笔记/cg/rt in one weekend/rest_life/06-重要性采样实验.md|第 6 章：重要性采样实验]]。
