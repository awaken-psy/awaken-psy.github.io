---
title: Shadow Map 阴影映射知识点详解
publish: true
updated: 2026-09-01T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - shadow-mapping
---


# Shadow Map 阴影映射知识点详解

原教程：[阴影映射](https://learnopengl-cn.readthedocs.io/zh/latest/05%20Advanced%20Lighting/03%20Shadows/01%20Shadow%20Mapping/)、[点阴影](https://learnopengl-cn.readthedocs.io/zh/latest/05%20Advanced%20Lighting/03%20Shadows/02%20Point%20Shadows/)

## 1 核心：光源先看到谁

从光源看某个方向，最先出现的表面会挡住后面的表面。

**第一遍从光源画深度图；第二遍从相机画场景，并比较当前片段与深度图。**

```cpp
// 1. 光源视角：只写深度
glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
glClear(GL_DEPTH_BUFFER_BIT);
renderScene(simpleDepthShader);

// 2. 相机视角：读取刚才的深度图
glBindFramebuffer(GL_FRAMEBUFFER, 0);
glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);
glBindTexture(GL_TEXTURE_2D, depthMap);
renderScene(lightingShader);
```

阴影图存的是光源视角的最近深度，不是黑色阴影图片。

## 2 第二遍怎样判断阴影

片段的世界位置先变到光源空间，再映射成深度纹理坐标：

```glsl
vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
projCoords = projCoords * 0.5 + 0.5;

float storedDepth  = texture(shadowMap, projCoords.xy).r;
float currentDepth = projCoords.z;
float shadow = currentDepth - bias > storedDepth ? 1.0 : 0.0;
```

当前深度更远，说明光源与片段之间有遮挡物。最终通常只压暗直接光：

```glsl
vec3 lighting = ambient
              + (1.0 - shadow) * (diffuse + specular);
```

材质 UV 用来采颜色，`projCoords.xy` 用来查阴影；两套坐标不要混淆。

## 3 Bias 和 PCF

没有偏移时，表面可能把自己错误判断为阴影，产生条纹。加入与表面斜率相关的 bias：

```glsl
vec3 normal   = normalize(Normal);
vec3 lightDir = normalize(lightPos - FragPos);
float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
```

PCF 在周围多比较几次，再平均结果：

```glsl
float shadow = 0.0;
vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
for (int x = -1; x <= 1; ++x)
for (int y = -1; y <= 1; ++y) {
    float d = texture(shadowMap,
        projCoords.xy + vec2(x, y) * texelSize).r;
    shadow += currentDepth - bias > d ? 1.0 : 0.0;
}
shadow /= 9.0;
```

Bias 太大会让阴影与物体分离；PCF 只是过滤比较结果，不是物理软阴影。

## 4 点光源为什么用深度 Cubemap

点光源向六个方向发光，所以使用六面深度图。第一遍通过 GS 把三角形写到 Cubemap 六个面，并存“片段到灯的距离 ÷ far”：

```glsl
float lightDistance = length(FragPos.xyz - lightPos);
gl_FragDepth = lightDistance / far_plane;
```

第二遍用方向向量采样：

```glsl
vec3 fragToLight = FragPos - lightPos;
float closest = texture(depthMap, fragToLight).r * far_plane;
float current = length(fragToLight);
float shadow = current - bias > closest ? 1.0 : 0.0;
```

`3.2.2` 在附近 20 个方向采样并平均，让边缘更柔和。

> [!summary] 一句话回忆
> **先从光源保存最近深度，再从相机视角比较当前片段；二维图适合单方向覆盖，Cubemap 适合点光源六个方向。**

对应源码：二维 Shadow Map、点阴影。

前置：[[学习笔记/cg/LearnOpengl/Advanced OpenGL/Framebuffer 帧缓冲知识点详解.md|Framebuffer 帧缓冲知识点详解]]、[[学习笔记/cg/LearnOpengl/Advanced OpenGL/深度测试与模板测试知识点详解.md|深度测试与模板测试知识点详解]]；相关：[[学习笔记/cg/LearnOpengl/Advanced OpenGL/Cubemap 与环境映射知识点详解.md|Cubemap 与环境映射知识点详解]]。

#learnopengl #opengl #graphics #shadow-mapping
