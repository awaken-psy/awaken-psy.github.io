---
title: Deferred 延迟渲染知识点详解
publish: true
updated: 2026-09-01T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - deferred-shading
  - g-buffer
---


# Deferred 延迟渲染知识点详解

原教程：[LearnOpenGL-CN · 延迟着色法](https://learnopengl-cn.readthedocs.io/zh/latest/05%20Advanced%20Lighting/08%20Deferred%20Shading/)

## 1 “延迟”的是光照

普通前向渲染在画物体时直接计算光照。延迟渲染先把**最终可见表面的属性**保存下来，第二遍再统一计算灯光。

```text
几何 pass：模型 → G-buffer 位置/法线/颜色/高光
光照 pass：G-buffer + 多盏灯 → 最终颜色
```

这样昂贵的多灯光照主要发生在屏幕上留下的那层表面。代价是多张屏幕纹理的存储与带宽。

## 2 几何 pass：一次写入多张纹理

本地 G-buffer 使用三个颜色附件：

```glsl
layout (location = 0) out vec3 gPosition;
layout (location = 1) out vec3 gNormal;
layout (location = 2) out vec4 gAlbedoSpec;

gPosition = FragPos;                         // 世界空间位置
gNormal = normalize(Normal);                 // 世界空间法线
gAlbedoSpec.rgb = texture(texture_diffuse1, TexCoords).rgb;
gAlbedoSpec.a   = texture(texture_specular1, TexCoords).r;
```

CPU 用 `glDrawBuffers` 将三个输出接到三个附件。位置、法线可能有负值，所以本地使用 `GL_RGBA16F`；颜色＋高光使用普通 RGBA 纹理。

深度 RBO 同时保证重叠模型只留下最近表面的属性。

## 3 光照 pass：全屏读取 G-buffer

第二遍画全屏四边形，每个屏幕位置重建光照输入：

```glsl
vec3 FragPos = texture(gPosition, TexCoords).rgb;
vec3 Normal  = normalize(texture(gNormal, TexCoords).rgb);
vec3 Diffuse = texture(gAlbedoSpec, TexCoords).rgb;
float Specular = texture(gAlbedoSpec, TexCoords).a;

vec3 lighting = Diffuse * 0.1;
for (int i = 0; i < NR_LIGHTS; ++i) {
    vec3 lightDir = normalize(lights[i].Position - FragPos);
    float diff = max(dot(Normal, lightDir), 0.0);
    float d = length(lights[i].Position - FragPos);
    float attenuation = 1.0 /
        (1.0 + lights[i].Linear*d + lights[i].Quadratic*d*d);
    lighting += Diffuse * diff * lights[i].Color * attenuation;
    // 本地 Shader 还会累加带 Specular 的高光项
}
```

全屏 quad 只是让 FS 覆盖所有像素；真正的三维表面数据来自 G-buffer。

## 4 深度复制与本地“光体积”

光照 pass 只写颜色，默认帧缓冲还没有背包的深度。要继续前向绘制灯光方块，先复制深度：

```cpp
glBindFramebuffer(GL_READ_FRAMEBUFFER, gBuffer);
glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);
glBlitFramebuffer(0, 0, W, H, 0, 0, W, H,
                  GL_DEPTH_BUFFER_BIT, GL_NEAREST);
renderLightBoxes();
```

`8.2` 为每盏灯计算 Radius，但没有真的画球形光体积；它仍在全屏 Shader 中遍历 32 盏灯，只在距离小于 Radius 时计算该灯贡献。

> [!note] 常见限制
> 单层 G-buffer 主要适合不透明表面；透明物体通常另接前向阶段。MSAA、更多材质属性也能实现，但存储和处理会更复杂。

> [!summary] 一句话回忆
> **先把可见表面的属性写进 G-buffer，再用全屏 Shader 统一算灯光；需要继续画三维物体时，把深度复制回来。**

对应源码：8.1 主流程、G-buffer 输出、8.2 Radius。

相关：[[学习笔记/cg/LearnOpengl/Advanced OpenGL/Framebuffer 帧缓冲知识点详解.md|Framebuffer 帧缓冲知识点详解]]、[[学习笔记/cg/LearnOpengl/Advanced OpenGL/深度测试与模板测试知识点详解.md|深度测试与模板测试知识点详解]]、[[学习笔记/cg/LearnOpengl/Advanced Lighting/SSAO 屏幕空间环境光遮蔽知识点详解.md|SSAO 屏幕空间环境光遮蔽知识点详解]]。

#learnopengl #opengl #graphics #deferred-shading
