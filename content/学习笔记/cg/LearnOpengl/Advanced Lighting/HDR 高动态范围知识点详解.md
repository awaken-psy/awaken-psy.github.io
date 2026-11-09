---
title: HDR 高动态范围知识点详解
publish: true
updated: 2026-09-01T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - hdr
  - tone-mapping
---


# HDR 高动态范围知识点详解

原教程：[LearnOpenGL-CN · HDR](https://learnopengl-cn.readthedocs.io/zh/latest/05%20Advanced%20Lighting/06%20HDR/)

## 1 先保留“很亮”和“非常亮”的区别

光照可能得到 `0.2、1、5、20`。若过早写进只能保存 0～1 的普通附件，5 和 20 都会变成 1，之后再调暗也找不回差别。

**HDR 用浮点附件保留超过 1 的线性光照；tone mapping 最后把它压到显示范围。**

```cpp
glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F,
             SCR_WIDTH, SCR_HEIGHT, 0,
             GL_RGBA, GL_FLOAT, nullptr);
glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0,
                       GL_TEXTURE_2D, colorBuffer, 0);
```

关键是 `GL_RGBA16F`：Shader 本来就在用浮点数，接收结果的附件也必须能保留它。

## 2 一帧画两遍

```text
场景几何 + 线性光照 → HDR FBO 浮点纹理
                         ↓
                  屏幕四边形采样
                         ↓
               tone mapping + 编码 → 显示
```

```cpp
glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
renderTunnel();

glBindFramebuffer(GL_FRAMEBUFFER, 0);
glBindTexture(GL_TEXTURE_2D, colorBuffer);
renderQuad();
```

第一遍仍需要深度附件；第二遍处理二维画面，不再计算隧道几何。整个过程留在 GPU。

## 3 Tone mapping 与曝光

本例使用指数映射：

```glsl
vec3 hdrColor = texture(hdrBuffer, TexCoords).rgb;
vec3 mapped = vec3(1.0) - exp(-hdrColor * exposure);
mapped = pow(mapped, vec3(1.0 / 2.2));
FragColor = vec4(mapped, 1.0);
```

`exposure` 控制呈现尺度，tone mapping 压缩动态范围，最后的 `pow` 是 Gamma 编码近似。Gamma 不能替代 tone mapping。

## 4 对照本地开关

场景有四盏灯，主灯颜色达到 `(200,200,200)`。关闭 `hdr` 只跳过 tone mapping：第一遍仍写浮点 FBO，最终仍做 Gamma 编码。Q/E 只调整曝光。

> [!summary] 一句话回忆
> **先在浮点附件里保留亮度，最后用曝光和 tone mapping 决定怎样显示，再编码一次。**

对应源码：FBO 与两遍绘制、映射 Shader。

前置：[[学习笔记/cg/LearnOpengl/Advanced OpenGL/Framebuffer 帧缓冲知识点详解.md|Framebuffer 帧缓冲知识点详解]]、[[学习笔记/cg/LearnOpengl/Advanced Lighting/伽马校正知识点详解.md|伽马校正知识点详解]]；后续：[[学习笔记/cg/LearnOpengl/Advanced Lighting/Bloom 泛光知识点详解.md|Bloom 泛光知识点详解]]。

#learnopengl #opengl #graphics #hdr #tone-mapping
