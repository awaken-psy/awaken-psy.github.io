---
title: 第 12 章：PDF 管理重构
publish: true
updated: 2026-09-09T07:15:29.201Z
tags:
  - ray-tracing
  - architecture
  - pdf
  - importance-sampling
  - solid-angle
  - caustics
---


# 第 12 章：PDF 管理重构

## 本章核心

本章把第十一章的架构决定全部落实到代码，并进一步让灯光之外的任意重要物体参与采样。

主要完成四件事：

1. 用 `scatter_record` 统一材质输出；
2. 分离连续散射与 Delta 散射；
3. 为球体实现可见立体角采样；
4. 用 `hittable_list` 混合多个重要物体的 PDF。

最后还在输出阶段加入 NaN 防护。

上一章：[[学习笔记/cg/rt in one weekend/rest_life/11-架构决策.md|第 11 章：架构决策]]。

## 最终调用链

```text
main.cc
   ├── world：真实场景
   └── lights：重要物体采样代理
                ↓
camera::ray_color()
                ↓
material::scatter() → scatter_record
                ↓
      ┌─────────┴─────────┐
      │                   │
 skip_pdf=true       skip_pdf=false
      │                   │
Delta 专用光线       材质 PDF + 几何 PDF
      │                   │
直接递归             mixture_pdf
                          │
                generate() / value()
                          │
              attenuation * scattering_pdf
              * recursive_color / pdf_value
```

## `scatter_record`

文件：`rest_life/material.h`

```cpp
class scatter_record {
  public:
    color attenuation;
    shared_ptr<pdf> pdf_ptr;
    bool skip_pdf;
    ray skip_pdf_ray;
};
```

字段意义：

| 字段 | 作用 |
|---|---|
| `attenuation` | 本次散射保留的能量或颜色因子 $A$ |
| `pdf_ptr` | 材质建议的连续方向采样分布 |
| `skip_pdf` | 是否跳过普通 PDF 计算 |
| `skip_pdf_ray` | Delta 材质直接生成的后继光线 |

`scatter_record` 统一了不同材质的返回方式，但没有混淆物理散射与程序采样：

```text
pdf_ptr
    描述程序建议怎样生成方向

scattering_pdf(...)
    描述材质在物理上怎样散射
```

## `material::scatter()` 的契约

```cpp
virtual bool scatter(
    const ray& r_in,
    const hit_record& rec,
    scatter_record& srec
) const {
    return false;
}
```

- 返回 `false`：材质不再散射，积分器只保留 `emitted()`；
- 返回 `true` 且 `skip_pdf=false`：提供连续 `pdf_ptr`；
- 返回 `true` 且 `skip_pdf=true`：提供 `skip_pdf_ray`。

积分器通过统一接口工作，不需要用 `dynamic_cast` 判断具体材质类型。

## Lambertian 材质

```cpp
bool scatter(
    const ray& r_in,
    const hit_record& rec,
    scatter_record& srec
) const override {
    srec.attenuation =
        tex->value(rec.u, rec.v, rec.p);

    srec.pdf_ptr =
        make_shared<cosine_pdf>(rec.normal);

    srec.skip_pdf = false;
    return true;
}
```

材质建议余弦加权采样：

$$
p_{material}(\omega)
=
\frac{\max(0,\cos\theta)}{\pi}
$$

物理散射项单独计算：

```cpp
double scattering_pdf(...) const override {
    auto cos_theta = dot(
        rec.normal,
        unit_vector(scattered.direction())
    );

    return cos_theta < 0
        ? 0
        : cos_theta/pi;
}
```

$$
p_{scatter}(\omega)
=
\frac{\max(0,\cos\theta)}{\pi}
$$

这里两者数值相同，但职责不同。`pdf_ptr` 后面会与重要物体 PDF 混合，因此最终分母并不是单独的余弦 PDF。

## 各向同性介质

```cpp
srec.attenuation =
    tex->value(rec.u, rec.v, rec.p);

srec.pdf_ptr = make_shared<sphere_pdf>();
srec.skip_pdf = false;
```

各向同性介质没有表面法线方向偏好，在整个球面上均匀散射：

$$
p(\omega)=\frac1{4\pi}
$$

其 `scattering_pdf()` 同样返回 $1/(4\pi)$。

这说明材质 PDF 不能硬编码在 `camera` 中：Lambertian 使用半球余弦 PDF，体积介质使用整个球面的均匀 PDF。

## 金属与玻璃

金属和玻璃使用 Delta 专用分支：

```cpp
srec.attenuation = albedo;
srec.pdf_ptr = nullptr;
srec.skip_pdf = true;
srec.skip_pdf_ray = ray(
    rec.p,
    reflected_or_refracted_direction,
    r_in.time()
);
```

`camera` 看到 `skip_pdf=true` 后直接递归：

```cpp
if (srec.skip_pdf) {
    return srec.attenuation
         * ray_color(
               srec.skip_pdf_ray,
               depth-1,
               world,
               lights
           );
}
```

这里不会：

- 构造 `mixture_pdf`；
- 调用 `scattering_pdf()`；
- 调用 `pdf::value()`；
- 显式计算 $f/p$。

玻璃根据全反射条件与 Schlick 反射率选择方向：

```cpp
if (cannot_refract
    || reflectance(cos_theta, ri) > random_double())
    direction = reflect(unit_direction, rec.normal);
else
    direction = refract(unit_direction, rec.normal, ri);
```

这是在反射和折射两个离散 Delta 方向之间选择。

## `camera::ray_color()` 的连续路径

文件：`rest_life/camera.h`

### 1. 求交

```cpp
if (!world.hit(
        r,
        interval(0.001, infinity),
        rec
    ))
    return background;
```

### 2. 取得自发光

```cpp
color color_from_emission =
    rec.mat->emitted(
        r, rec,
        rec.u, rec.v, rec.p
    );
```

### 3. 让材质填写 `scatter_record`

```cpp
scatter_record srec;

if (!rec.mat->scatter(r, rec, srec))
    return color_from_emission;
```

### 4. 处理 Delta 分支

```cpp
if (srec.skip_pdf) {
    return srec.attenuation
         * ray_color(srec.skip_pdf_ray, ...);
}
```

### 5. 混合重要物体 PDF 与材质 PDF

```cpp
auto light_ptr =
    make_shared<hittable_pdf>(lights, rec.p);

mixture_pdf p(light_ptr, srec.pdf_ptr);
```

$$
p(\omega)
=
\frac12p_{objects}(\omega)
+
\frac12p_{material}(\omega)
$$

### 6. 用同一个 PDF 生成与评估

```cpp
ray scattered(
    rec.p,
    p.generate(),
    r.time()
);

auto pdf_value =
    p.value(scattered.direction());
```

### 7. 计算物理散射项

```cpp
double scattering_pdf =
    rec.mat->scattering_pdf(
        r, rec, scattered
    );
```

### 8. 递归查询入射光

```cpp
color sample_color =
    ray_color(
        scattered,
        depth-1,
        world,
        lights
    );
```

### 9. 完成 Monte Carlo 权重

```cpp
color color_from_scatter =
    srec.attenuation
    * scattering_pdf
    * sample_color
    / pdf_value;
```

$$
\boxed{
C_o
=
C_e
+
\frac{
A\,p_{scatter}(\omega)C_i(\omega)
}{
p(\omega)
}
}
$$

## 为什么要朝玻璃球采样

Cornell Box 中的玻璃球会在地面形成焦散。

从相机反向追踪，一条产生焦散的路径可能是：

```text
相机 → 地面 → 玻璃球 → 灯
```

只按地面的余弦 PDF 采样时，方向恰好击中玻璃球的概率较低。

只朝灯采样也不够，因为这条路径必须先进入玻璃球，再通过折射或反射到达灯。

所以把玻璃球作为重要采样目标，可以提高相关路径的出现频率。

这也说明代码中的 `lights` 更准确的含义其实是：

```text
important_objects
```

它可以包含：

- 发光矩形；
- 玻璃球；
- 窗口；
- 明亮门缝；
- 其他预计有重要贡献的几何体。

## 球体为什么不能简单均匀选表面点

从球外一点 $P$ 看球体时，均匀选择整个球面上的点会频繁选到背面。

背面采样点被球正面遮挡，造成浪费。我们真正需要均匀采样的是球体从 $P$ 看来覆盖的方向立体角。

所有能击中球体的方向构成一个圆锥：

- 圆锥轴：从 $P$ 指向球心 $C$；
- 圆锥边界：从 $P$ 到球面的切线；
- 半顶角：$\theta_{max}$。

设球半径为 $R$，点到球心距离为：

$$
d=\|C-P\|
$$

由切线直角三角形：

$$
\sin\theta_{max}=\frac Rd
$$

所以：

$$
\boxed{
\cos\theta_{max}
=
\sqrt{1-\frac{R^2}{d^2}}
}
$$

## 球体可见立体角

圆锥在单位球面上覆盖的立体角为：

$$
\begin{aligned}
\Omega
&=
\int_0^{2\pi}
\int_0^{\theta_{max}}
\sin\theta\,d\theta\,d\phi\\
&=
2\pi(1-\cos\theta_{max})
\end{aligned}
$$

在这个立体角内均匀采样时：

$$
\boxed{
p_{sphere}(\omega)
=
\frac1{
2\pi(1-\cos\theta_{max})
}
}
$$

圆锥外的方向密度为 0。

## `sphere::pdf_value()`

文件：`rest_life/sphere.h`

```cpp
double pdf_value(
    const point3& origin,
    const vec3& direction
) const override {
    hit_record rec;

    if (!hit(
            ray(origin, direction),
            interval(0.001, infinity),
            rec
        ))
        return 0;

    auto dist_squared =
        (center.at(0) - origin).length_squared();

    auto cos_theta_max = std::sqrt(
        1 - radius*radius/dist_squared
    );

    auto solid_angle =
        2*pi*(1-cos_theta_max);

    return 1 / solid_angle;
}
```

该实现假定：

- 球体是静止的，因此使用 `center.at(0)`；
- `origin` 位于球外；
- 方向命中球体时使用常数 $1/\Omega$，否则为 0。

## 在圆锥立体角中均匀生成方向

取：

$$
r_1,r_2\sim U(0,1)
$$

令：

$$
\phi=2\pi r_1
$$

$$
z=\cos\theta
=
1+r_2(\cos\theta_{max}-1)
$$

因为：

$$
d\omega
=
\sin\theta d\theta d\phi
=
-d(\cos\theta)d\phi
$$

均匀采样 $\phi$ 和 $z=\cos\theta$ 就是在圆锥立体角中均匀采样。

再计算：

$$
x=\cos\phi\sqrt{1-z^2}
$$

$$
y=\sin\phi\sqrt{1-z^2}
$$

代码：

```cpp
auto z = 1 + r2 * (
    std::sqrt(
        1-radius*radius/distance_squared
    ) - 1
);

auto phi = 2*pi*r1;
auto x = std::cos(phi) * std::sqrt(1-z*z);
auto y = std::sin(phi) * std::sqrt(1-z*z);
```

这个方向先以局部 $+z$ 为圆锥轴，然后用 ONB 旋转到世界空间：

```cpp
vec3 direction = center.at(0) - origin;
onb uvw(direction);

return uvw.transform(
    random_to_sphere(radius, distance_squared)
);
```

## `hittable_list` 也是一个混合 PDF

若重要物体列表有 $N$ 个对象，`random()` 先以 $1/N$ 的概率选择一个对象：

```cpp
return objects[
    random_int(0, int_size-1)
]->random(origin);
```

所以 `pdf_value()` 必须以相同权重平均全部子 PDF：

```cpp
auto weight = 1.0 / objects.size();
auto sum = 0.0;

for (const auto& object : objects)
    sum += weight
         * object->pdf_value(origin, direction);

return sum;
```

数学上：

$$
p_{objects}(\omega)
=
\frac1N\sum_{i=1}^{N}p_i(\omega)
$$

如果列表包含矩形灯和玻璃球：

$$
p_{objects}
=
0.5p_{light}
+
0.5p_{sphere}
$$

`camera` 又把它与材质 PDF 等权混合：

$$
\begin{aligned}
p_{total}
&=
0.5p_{objects}
+
0.5p_{material}\\
&=
0.25p_{light}
+
0.25p_{sphere}
+
0.5p_{material}
\end{aligned}
$$

每一层都必须保持：

```text
对象被选择的概率
        =
pdf_value 中对应的混合权重
```

## `world` 与采样代理

文件：`rest_life/main.cc`

真正参与渲染的玻璃球：

```cpp
auto glass = make_shared<dielectric>(1.5);

world.add(
    make_shared<sphere>(
        point3(190,90,190),
        90,
        glass
    )
);
```

供 PDF 使用的采样代理：

```cpp
auto empty_material = shared_ptr<material>();
hittable_list lights;

lights.add(
    make_shared<quad>(
        point3(343,554,332),
        vec3(-130,0,0),
        vec3(0,0,-105),
        empty_material
    )
);

lights.add(
    make_shared<sphere>(
        point3(190,90,190),
        90,
        empty_material
    )
);
```

这不是在场景中渲染了两个玻璃球：

| 对象 | 责任 |
|---|---|
| `world` 中的玻璃球 | 真实求交、反射、折射和着色 |
| `lights` 中的空材质球 | 只提供 `random()` 与 `pdf_value()` |

采样代理不需要材质，因为最终散射光线仍然与 `world` 求交。

## NaN 黑点处理

极少数异常 PDF 除法或浮点计算可能产生 NaN。只要一个颜色样本变成 NaN，像素累加结果也会被污染。

NaN 有一个特殊性质：

$$
\mathrm{NaN}\neq\mathrm{NaN}
$$

因此 `rest_life/color.h` 在输出阶段执行：

```cpp
if (r != r) r = 0.0;
if (g != g) g = 0.0;
if (b != b) b = 0.0;
```

这可以防止单个异常样本让整个像素成为无效值。

> [!warning] 这只是输出端保护
> 它没有修复产生 NaN 的根本原因。更严格的实现还应检查 PDF 分母、向量长度、平方根参数以及无穷大，并尽量在异常值产生的位置处理。

## 最终架构

| 层次 | 类型或文件 | 责任 |
|---|---|---|
| 积分器 | `camera.h` | 递归查询光照、混合 PDF、计算 $f/p$ |
| 材质 | `material.h` | 物理散射、衰减、材质 PDF、Delta 分支 |
| PDF | `pdf.h` | `generate()` 与 `value()` 的统一接口 |
| 坐标 | `onb.h` | 将局部采样方向变换到世界空间 |
| 几何 | `quad.h`、`sphere.h` | 几何特定的方向生成和 PDF |
| 聚合 | `hittable_list.h` | 混合多个重要物体的 PDF |
| 场景 | `main.cc` | 构造真实世界和采样代理列表 |
| 输出 | `color.h` | 最终颜色转换和 NaN 防护 |

## 本章结论

$$
\boxed{
\text{材质 PDF}
+
\text{几何 PDF}
+
\text{PDF 混合器}
+
\text{Delta 专用路径}
=
\text{完整的采样架构}
}
$$

> 材质决定要积分什么，PDF 决定怎样寻找样本，几何体负责朝自己采样，积分器使用最终真实分布完成 $f(\omega)/p(\omega)$ 修正。

下一章：书的总结与后续方向。
