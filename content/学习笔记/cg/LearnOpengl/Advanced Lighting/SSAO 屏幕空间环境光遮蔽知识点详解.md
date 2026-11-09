---
title: SSAO 屏幕空间环境光遮蔽知识点详解
publish: true
updated: 2026-09-01T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - ssao
  - ambient-occlusion
---


# SSAO 屏幕空间环境光遮蔽知识点详解

原教程：[LearnOpenGL-CN · SSAO](https://learnopengl-cn.readthedocs.io/zh/latest/05%20Advanced%20Lighting/09%20SSAO/)

## 1 SSAO 在估计“周围有多拥挤”

角落、缝隙和接触处，来自四周的环境光通常更难进入。SSAO 用当前屏幕保存的位置和法线，在表面附近取样，得到 0～1 的 AO：

```text
AO 接近 1：开阔，保留环境光
AO 接近 0：遮蔽强，压暗环境光
```

它不判断某盏灯的直接阴影，不能替代 Shadow Map，也不是完整全局光照。

## 2 准备半球 kernel 和随机旋转

CPU 初始化 64 个朝 +Z 的半球样本，并让更多样本靠近原点：

```cpp
std::uniform_real_distribution<float> randomFloats(0.0, 1.0);
for (int i = 0; i < 64; ++i) {
    glm::vec3 sample(
        randomFloats(generator) * 2.0 - 1.0,
        randomFloats(generator) * 2.0 - 1.0,
        randomFloats(generator));
    sample = glm::normalize(sample) * randomFloats(generator);
    float scale = float(i) / 64.0;
    scale = lerp(0.1, 1.0, scale * scale);
    ssaoKernel.push_back(sample * scale);
}
```

再准备 4×4 随机方向纹理，让邻近像素以不同方向旋转 kernel，减少规则条纹。随机会产生噪点，所以后面还要模糊。

本地 G-buffer 保存**观察空间**位置和法线；所有 SSAO 比较都保持在同一空间。

## 3 单个像素怎样累计遮蔽

先用法线和随机方向建立 TBN，把局部半球转到当前表面：

```glsl
vec3 fragPos   = texture(gPosition, TexCoords).xyz;
vec3 normal    = normalize(texture(gNormal, TexCoords).rgb);
vec3 randomVec = normalize(texture(texNoise, TexCoords * noiseScale).xyz);

vec3 tangent   = normalize(randomVec - normal * dot(randomVec, normal));
vec3 bitangent = cross(normal, tangent);
mat3 TBN       = mat3(tangent, bitangent, normal);
```

每个样本放到表面附近，投影回屏幕，再读取那个位置真正可见表面的 z：

```glsl
float occlusion = 0.0;
for (int i = 0; i < kernelSize; ++i) {
    vec3 samplePos = fragPos + (TBN * samples[i]) * radius;

    vec4 offset = projection * vec4(samplePos, 1.0);
    offset.xyz /= offset.w;
    offset.xyz = offset.xyz * 0.5 + 0.5;

    float sampleDepth = texture(gPosition, offset.xy).z;
    float rangeCheck = smoothstep(0.0, 1.0,
        radius / abs(fragPos.z - sampleDepth));
    occlusion += (sampleDepth >= samplePos.z + bias ? 1.0 : 0.0)
               * rangeCheck;
}
float ao = 1.0 - occlusion / kernelSize;
```

`bias` 减少表面自遮蔽，`rangeCheck` 避免把深度差很大的表面当成近邻。

## 4 四个 pass 怎样接起来

```text
1. 几何 pass：位置、法线、颜色 → G-buffer
2. SSAO pass：位置、法线、kernel、noise → 原始 AO
3. Blur pass：4×4 邻域平均 → 平滑 AO
4. 光照 pass：AO 只乘到 ambient，再加直接光
```

最终 Shader 的关键关系：

```glsl
vec3 ambient  = 0.3 * Diffuse * AmbientOcclusion;
vec3 lighting = ambient + diffuse + specular;
```

SSAO 依赖屏幕中可见的数据，屏幕外和被遮挡的几何没有信息；相机移动时结果也可能变化。本例 blur 是普通 box blur，可能连边缘一起抹开。

> [!summary] 一句话回忆
> **在观察空间中围绕表面采一个法线半球，把样本投影回屏幕比较深度，得到 AO；模糊后只压暗环境项。**

对应源码：四遍流程、采样 Shader、应用 AO。

前置：[[学习笔记/cg/LearnOpengl/Advanced Lighting/Deferred 延迟渲染知识点详解.md|Deferred 延迟渲染知识点详解]]、[[学习笔记/cg/LearnOpengl/Advanced OpenGL/Framebuffer 帧缓冲知识点详解.md|Framebuffer 帧缓冲知识点详解]]。

#learnopengl #opengl #graphics #ssao
