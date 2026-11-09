---
title: Bloom 泛光知识点详解
publish: true
updated: 2026-09-01T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - bloom
  - post-processing
---


# Bloom 泛光知识点详解

原教程：[LearnOpenGL-CN · 泛光](https://learnopengl-cn.readthedocs.io/zh/latest/05%20Advanced%20Lighting/07%20Bloom/)

## 1 Bloom 的三步

**保留清晰场景 → 提取并模糊亮部 → 把模糊亮部加回场景。**

```text
场景 ─┬→ 完整 HDR 图 ───────────┐
      └→ 亮部图 → 模糊 ─────────┤→ 相加 → tone mapping → 显示
```

只模糊亮部，原场景保持清晰。Bloom 是屏幕空间光晕，不会让光真的照亮附近物体。

## 2 MRT 同时输出场景和亮部

```glsl
layout (location = 0) out vec4 FragColor;
layout (location = 1) out vec4 BrightColor;

FragColor = vec4(result, 1.0);
float brightness = dot(result, vec3(0.2126, 0.7152, 0.0722));
BrightColor = brightness > 1.0
    ? vec4(result, 1.0)
    : vec4(0.0, 0.0, 0.0, 1.0);
```

HDR FBO 挂两张浮点颜色纹理，CPU 用 `glDrawBuffers` 接好两个输出。亮部图保存原 RGB 强度，不只是黑白遮罩。

## 3 Ping-pong 模糊

```cpp
bool horizontal = true, first = true;
for (int i = 0; i < 10; ++i) {
    glBindFramebuffer(GL_FRAMEBUFFER, pingpongFBO[horizontal]);
    blurShader.setBool("horizontal", horizontal);
    glBindTexture(GL_TEXTURE_2D,
        first ? brightTexture : pingpongTexture[!horizontal]);
    renderQuad();
    horizontal = !horizontal;
    first = false;
}
```

两张纹理轮流做输入和输出，避免同一遍读写同一张图。本例是 10 个单方向 pass，即 5 组水平＋垂直。

## 4 在线性 HDR 中合成

```glsl
vec3 hdrColor = texture(scene, TexCoords).rgb;
if (bloom)
    hdrColor += texture(bloomBlur, TexCoords).rgb;

vec3 result = vec3(1.0) - exp(-hdrColor * exposure);
result = pow(result, vec3(1.0 / 2.2));
```

这是 Shader 中的纹理加法，不是 `GL_BLEND`。顺序是：相加 → tone mapping → Gamma 编码。

> [!summary] 一句话回忆
> **一次场景绘制得到完整图和亮部图，只模糊亮部，再加回 HDR 场景。**

对应源码：MRT 与模糊、亮部输出、合成。

前置：[[学习笔记/cg/LearnOpengl/Advanced Lighting/伽马校正知识点详解.md|伽马校正知识点详解]]、[[学习笔记/cg/LearnOpengl/Advanced Lighting/HDR 高动态范围知识点详解.md|HDR 高动态范围知识点详解]]、[[学习笔记/cg/LearnOpengl/Advanced OpenGL/Framebuffer 帧缓冲知识点详解.md|Framebuffer 帧缓冲知识点详解]]。

#learnopengl #opengl #graphics #bloom
