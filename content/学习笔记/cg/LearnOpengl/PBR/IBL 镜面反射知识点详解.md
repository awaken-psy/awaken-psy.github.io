---
title: IBL 镜面反射知识点详解
publish: true
updated: 2026-09-02T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - pbr
  - ibl
  - specular
---


# IBL 镜面反射知识点详解

原教程：[LearnOpenGL-CN · 镜面反射 IBL](https://learnopengl-cn.github.io/07%20PBR/03%20IBL/02%20Specular%20IBL/)

## 1 镜面 IBL 为什么比漫反射复杂

漫反射主要依赖法线 N，可以预计算成一张 irradianceMap。

镜面反射还依赖：

```text
反射方向 R
粗糙度 roughness
观察角 N·V
基础反射率 F0
```

直接实时积分环境各方向太贵，所以使用 **Split-Sum 近似**，拆成两份预计算：

```text
环境光部分 → prefilterMap
BRDF 响应   → brdfLUT
```

运行时各采样一次，再组合。

## 2 第一部分：按粗糙度预过滤环境

`prefilterMap` 是带 mipmap 的 Cubemap：

```text
mip 0：roughness = 0，反射清晰
mip 1～3：逐渐模糊
mip 4：roughness = 1，反射最模糊
```

CPU 对每个 mip 调整尺寸和 roughness，再渲染六个面：

```cpp
const unsigned int maxMipLevels = 5;
for (unsigned int mip = 0; mip < maxMipLevels; ++mip) {
    unsigned int size = 128 * std::pow(0.5, mip);
    glViewport(0, 0, size, size);

    float roughness = float(mip) / float(maxMipLevels - 1);
    prefilterShader.setFloat("roughness", roughness);

    for (unsigned int face = 0; face < 6; ++face) {
        prefilterShader.setMat4("view", captureViews[face]);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0,
            GL_TEXTURE_CUBE_MAP_POSITIVE_X + face,
            prefilterMap, mip);
        renderCube();
    }
}
```

预过滤 Shader 用 Hammersley 序列和 GGX 重要性采样，让样本更多集中在贡献大的方向：

```glsl
vec2 Xi = Hammersley(i, SAMPLE_COUNT);
vec3 H = ImportanceSampleGGX(Xi, N, roughness);
vec3 L = normalize(2.0 * dot(V, H) * H - V);

if (dot(N, L) > 0.0)
    prefilteredColor += textureLod(environmentMap, L, mipLevel).rgb
                      * dot(N, L);
```

因此 prefilterMap 不是普通高斯模糊，而是按 GGX 镜面分布预积分的环境颜色。

## 3 第二部分：生成二维 BRDF LUT

BRDF 剩余部分主要依赖：

```text
横轴：NdotV，观察角
纵轴：roughness，粗糙度
```

用全屏四边形离线式预计算到一张 `GL_RG16F` 二通道纹理：

```glsl
vec2 IntegrateBRDF(float NdotV, float roughness)
{
    vec3 V = vec3(sqrt(1.0 - NdotV*NdotV), 0.0, NdotV);
    float A = 0.0;
    float B = 0.0;

    for (uint i = 0u; i < SAMPLE_COUNT; ++i) {
        vec3 H = ImportanceSampleGGX(Hammersley(i, SAMPLE_COUNT),
                                     vec3(0,0,1), roughness);
        vec3 L = normalize(2.0 * dot(V,H) * H - V);
        // 根据 G 与 Fresnel 权重累加 A、B
    }
    return vec2(A, B) / float(SAMPLE_COUNT);
}

void main()
{
    FragColor = IntegrateBRDF(TexCoords.x, TexCoords.y);
}
```

LUT 不包含某个具体环境的颜色，因此在相同 BRDF 模型下可以复用；prefilterMap 则来自当前 HDR 环境。

## 4 运行时组合完整 IBL

```glsl
vec3 F  = fresnelSchlickRoughness(max(dot(N,V),0.0), F0, roughness);
vec3 kS = F;
vec3 kD = (1.0 - kS) * (1.0 - metallic);

// 间接漫反射
vec3 irradiance = texture(irradianceMap, N).rgb;
vec3 diffuse = irradiance * albedo;

// 间接镜面反射
vec3 R = reflect(-V, N);
const float MAX_REFLECTION_LOD = 4.0;
vec3 prefiltered = textureLod(
    prefilterMap, R, roughness * MAX_REFLECTION_LOD).rgb;
vec2 brdf = texture(brdfLUT,
    vec2(max(dot(N,V),0.0), roughness)).rg;
vec3 specular = prefiltered * (F * brdf.x + brdf.y);

vec3 ambient = (kD * diffuse + specular) * ao;
vec3 color = ambient + Lo;
```

三个预计算资源分工：

| 资源 | 用什么方向/坐标查询 | 返回什么 |
|---|---|---|
| irradianceMap | 法线 N | 环境间接漫反射光 |
| prefilterMap | 反射方向 R + roughness LOD | 模糊程度合适的环境反射 |
| brdfLUT | NdotV + roughness | BRDF 的 scale / bias |

`2.2.2` 再把 albedo、normal、metallic、roughness、AO 改为纹理输入，公式不变。

> [!summary] 一句话回忆
> **镜面 IBL 拆成“按粗糙度预过滤的环境”与“按视角/粗糙度查询的 BRDF LUT”，运行时再用菲涅尔组合，并与漫反射 IBL、直接光相加。**

对应源码：预计算流程、环境预过滤、BRDF LUT、最终 PBR。

前置：[[学习笔记/cg/LearnOpengl/PBR/PBR 理论与直接光照知识点详解.md|PBR 理论与直接光照知识点详解]]、[[学习笔记/cg/LearnOpengl/PBR/IBL 漫反射辐照度知识点详解.md|IBL 漫反射辐照度知识点详解]]。

#learnopengl #opengl #graphics #pbr #ibl
