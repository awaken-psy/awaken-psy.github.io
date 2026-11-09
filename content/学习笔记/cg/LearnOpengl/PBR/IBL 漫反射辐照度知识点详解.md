---
title: IBL 漫反射辐照度知识点详解
publish: true
updated: 2026-09-02T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - pbr
  - ibl
  - irradiance
---


# IBL 漫反射辐照度知识点详解

原教程：[LearnOpenGL-CN · 漫反射辐照度](https://learnopengl-cn.github.io/07%20PBR/03%20IBL/01%20Diffuse%20irradiance/)

## 1 IBL 把整个环境当作光源

直接光只遍历已知灯光；IBL（Image-Based Lighting）把 HDR 环境图的各个方向都视为入射光。

漫反射需要积分法线朝向的整个半球，实时为每个片段采很多方向太贵。因此先将环境做一次卷积，生成 **irradianceMap 辐照度 Cubemap**：

```text
HDR 全景图 → 环境 Cubemap → 半球卷积 → irradianceMap
```

运行时只需要用世界空间法线 `N` 采样一次。

## 2 先把 HDR 全景图转换成 Cubemap

输入是等距柱状投影的 `.hdr` 图片。采样方向先转换成全景图 UV：

```glsl
vec2 SampleSphericalMap(vec3 v)
{
    vec2 uv = vec2(atan(v.z, v.x), asin(v.y));
    uv *= vec2(0.1591, 0.3183);
    uv += 0.5;
    return uv;
}

vec3 color = texture(equirectangularMap,
                     SampleSphericalMap(normalize(WorldPos))).rgb;
```

CPU 建立 90° 投影和六个方向的 view，依次把立方体六面画入 `envCubemap`：

```cpp
for (unsigned int face = 0; face < 6; ++face) {
    conversionShader.setMat4("view", captureViews[face]);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0,
        GL_TEXTURE_CUBE_MAP_POSITIVE_X + face, envCubemap, 0);
    renderCube();
}
```

这一步只是改变环境图的存储形式，便于以后用方向向量采样；还没有完成漫反射积分。

## 3 将环境卷积成 irradianceMap

对 irradianceMap 的每个输出方向 N，在其上半球采样环境：

```glsl
vec3 N = normalize(WorldPos);
vec3 up    = vec3(0.0, 1.0, 0.0);
vec3 right = normalize(cross(up, N));
up         = normalize(cross(N, right));

vec3 irradiance = vec3(0.0);
float nrSamples = 0.0;
for (float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta)
for (float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta) {
    vec3 tangentSample = vec3(
        sin(theta) * cos(phi),
        sin(theta) * sin(phi),
        cos(theta));
    vec3 sampleVec = tangentSample.x * right
                   + tangentSample.y * up
                   + tangentSample.z * N;
    irradiance += texture(environmentMap, sampleVec).rgb
                * cos(theta) * sin(theta);
    nrSamples++;
}
irradiance = PI * irradiance / nrSamples;
```

- `cos(theta)`：斜着照到表面的光贡献更小。
- `sin(theta)`：补偿球面采样面积。
- 输出非常平滑，所以本地 irradianceMap 只使用 `32×32×6`。

CPU 仍然对六个面各画一次，只是输入改成 envCubemap，输出改成 irradianceMap。

## 4 PBR 运行时怎样使用

```glsl
vec3 F  = fresnelSchlickRoughness(max(dot(N,V),0.0), F0, roughness);
vec3 kS = F;
vec3 kD = (1.0 - kS) * (1.0 - metallic);

vec3 irradiance = texture(irradianceMap, N).rgb;
vec3 diffuseIBL = irradiance * albedo;
vec3 ambient = kD * diffuseIBL * ao;

vec3 color = ambient + Lo; // Lo 仍是直接灯光
```

辐照度图用 N 采样，因为漫反射与观察方向无关；roughness 不用于选择 irradianceMap 层，因为漫反射本来就很模糊。

本篇只加入间接漫反射，镜面环境反射尚未加入，所以金属仍会偏暗。下一篇会补齐它。

> [!note] 一个环境图假设光照来自同一中心
> 室外或远景通常可接受；复杂室内会使用多个反射探针，并在空间中选择或插值。

> [!summary] 一句话回忆
> **把 HDR 环境转成 Cubemap，再提前对每个法线方向做半球积分；运行时用 N 查 irradianceMap，得到间接漫反射。**

对应源码：全景图转换和卷积、卷积 Shader、PBR 使用辐照度图。

前置：[[学习笔记/cg/LearnOpengl/PBR/PBR 理论与直接光照知识点详解.md|PBR 理论与直接光照知识点详解]]、[[学习笔记/cg/LearnOpengl/Advanced OpenGL/Cubemap 与环境映射知识点详解.md|Cubemap 与环境映射知识点详解]]、[[学习笔记/cg/LearnOpengl/Advanced Lighting/HDR 高动态范围知识点详解.md|HDR 高动态范围知识点详解]]。

#learnopengl #opengl #graphics #pbr #ibl
