---
title: PBR 理论与直接光照知识点详解
publish: true
updated: 2026-09-02T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - pbr
  - cook-torrance
---


# PBR 理论与直接光照知识点详解

原教程：[PBR 理论](https://learnopengl-cn.github.io/07%20PBR/01%20Theory/)、[PBR 光照](https://learnopengl-cn.github.io/07%20PBR/02%20Lighting/)

## 1 材质由几个可复用的物理参数描述

| 参数 | 作用 |
|---|---|
| albedo | 基础颜色；不应包含烘焙光影 |
| metallic | 0 接近非金属，1 接近金属 |
| roughness | 越小反射越集中，越大越宽、越模糊 |
| normal | 每个片段的表面方向 |
| AO | 减弱缝隙等位置的间接环境光 |

PBR 的优势不是“绝对真实”，而是同一套材质参数换到不同光照环境时仍较稳定。

金属与非金属最重要的区别：

```text
非金属：有漫反射；正视镜面反射率通常从约 0.04 开始
金属：几乎没有漫反射；镜面反射带有 albedo 的颜色
```

```glsl
vec3 F0 = vec3(0.04);
F0 = mix(F0, albedo, metallic);
```

## 2 Cook–Torrance 镜面 BRDF：D、G、F

```glsl
float NDF = DistributionGGX(N, H, roughness); // D
float G   = GeometrySmith(N, V, L, roughness);// G
vec3  F   = fresnelSchlick(max(dot(H, V), 0.0), F0); // F

vec3 numerator = NDF * G * F;
float denominator = 4.0 * max(dot(N,V),0.0)
                        * max(dot(N,L),0.0) + 0.0001;
vec3 specular = numerator / denominator;
```

- **D，法线分布**：有多少微小镜面朝向半程向量 H；roughness 影响高光宽窄。
- **G，几何遮蔽**：微表面之间互相遮挡、掩蔽多少。
- **F，菲涅尔**：观察越接近掠射角，反射通常越强。

菲涅尔近似：

```glsl
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0)
         * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
```

## 3 能量怎样分给漫反射和镜面反射

F 同时可以看作镜面比例：

```glsl
vec3 kS = F;
vec3 kD = vec3(1.0) - kS;
kD *= 1.0 - metallic;
```

`1-kS` 避免同一份能量同时完整进入漫反射和镜面反射；再乘 `1-metallic`，让纯金属没有漫反射。

每盏直接光的贡献：

```glsl
vec3 L = normalize(lightPos - WorldPos);
vec3 H = normalize(V + L);
float distance = length(lightPos - WorldPos);
vec3 radiance = lightColor / (distance * distance);
float NdotL = max(dot(N, L), 0.0);

Lo += (kD * albedo / PI + specular)
    * radiance * NdotL;
```

最后累加四盏灯，并加一个临时环境项：

```glsl
vec3 ambient = vec3(0.03) * albedo * ao;
vec3 color = ambient + Lo;
color = color / (color + vec3(1.0));
color = pow(color, vec3(1.0 / 2.2));
```

这里的常量 ambient 会在后两篇被 IBL 取代。

## 4 纹理化版本只是把参数来源换成贴图

```glsl
vec3 albedo = pow(texture(albedoMap, TexCoords).rgb, vec3(2.2));
float metallic  = texture(metallicMap, TexCoords).r;
float roughness = texture(roughnessMap, TexCoords).r;
float ao        = texture(aoMap, TexCoords).r;
vec3 N = getNormalFromMap();
```

albedo 是颜色，要从 sRGB 解码；metallic、roughness、AO 和 normal 是数据，不做 Gamma 解码。

`1.2` 为保持教程代码简单，在片段 Shader 中用 `dFdx/dFdy` 重建 TBN；常规模型也可以使用顶点切线。对应概念见 [[学习笔记/cg/LearnOpengl/Advanced Lighting/法线贴图与视差映射知识点详解.md|法线贴图与视差映射知识点详解]]、[[学习笔记/cg/LearnOpengl/Advanced Lighting/伽马校正知识点详解.md|伽马校正知识点详解]]。

> [!note] 为什么直接光版本的金属看起来偏黑
> 金属主要反射周围环境，而本篇只有四个点光源和很小的常量 ambient。加入 IBL 后，金属才能反射整个环境。

> [!summary] 一句话回忆
> **PBR 用 albedo、metallic、roughness 等参数控制 Cook–Torrance BRDF；D/G/F 计算镜面，kD/kS 分配能量，再累加每盏直接光。**

对应源码：直接光 Shader、纹理化 Shader。

#learnopengl #opengl #graphics #pbr
