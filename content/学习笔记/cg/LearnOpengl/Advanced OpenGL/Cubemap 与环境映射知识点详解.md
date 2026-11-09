---
title: Cubemap 与环境映射知识点详解
publish: true
updated: 2026-08-31T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - cubemap
  - environment-mapping
---


# Cubemap 与环境映射知识点详解

原教程：[LearnOpenGL-CN · 立方体贴图](https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/06%20Cubemaps/)

## 1 Cubemap：给一个方向，返回环境颜色

想象站在房间中央，向上下左右前后各拍一张照片。**Cubemap 把六个面的图像放在同一个纹理对象中，用方向向量查颜色。**

普通二维纹理问的是“UV 这个位置是什么颜色”；Cubemap 问的是“朝这个方向看，是什么颜色”。方向决定命中哪个面、面上的哪里。

![[学习笔记/cg/LearnOpengl/Advanced OpenGL/assets/LearnOpenGL-Cubemap-方向采样.png|400]]

*橙色方向从中心射向盒面，交到的位置决定采样哪里。图源：[LearnOpenGL-CN](https://learnopengl-cn.github.io/img/04/06/cubemaps_sampling.png)。*

Shader 使用 `samplerCube`，通过 `texture(cubemap, direction)` 采样。

## 2 天空盒：把这些方向显示为背景

用一个以原点为中心的立方体承载环境图，顶点位置就可以当成采样方向，插值后传给片段 Shader。

天空盒还要满足两点：**走动时不能靠近天空；场景物体必须挡在天空前面。** 本地示例这样处理：

| 处理 | 为什么 |
|---|---|
| view 去掉平移，只保留旋转 | 转头会看到不同环境，前进不会撞到天空盒 |
| 顶点输出 `pos.xyww` | 让 z/w = 1，在默认深度范围下把天空放到最远处 |
| 最后画天空盒，用 `GL_LEQUAL` | 背景深度仍为 1 时允许通过，已有更近物体的地方不会被覆盖 |

画完恢复 `GL_LESS`。这里不是关闭深度测试，而是借助已有深度，只填补没有物体挡住的背景。

## 3 镜面反射：换一个方向去查同一张图

让箱子像镜子，不需要给它重新拍六张图。**从眼睛看向表面，再根据表面法线计算反射方向，用这个方向查询 Cubemap。**

```glsl
vec3 I = normalize(Position - cameraPos); // 眼睛 → 表面
vec3 R = reflect(I, normalize(Normal));   // 表面 → 反射方向
FragColor = vec4(texture(skybox, R).rgb, 1.0);
```

相机移动，反射方向变化，箱子上显示的环境也跟着变化。位置、相机位置和法线要处于同一坐标空间；本例统一使用世界空间。

**天空盒按视野方向取色，镜面物体按反射方向取色。** 两者可以共享同一张环境图，但使用各自的 Shader。

折射则用 `refract(I, N, eta)` 算穿过界面后的方向，再查 Cubemap；`eta` 是两侧折射率之比。

## 4 记住它能做什么、不能做什么

- **静态环境图只包含拍进去的内容。** 新放一个箱子，不会自动出现在其他物体的反射里；动态环境映射需要重新从六个方向渲染场景。
- **天空盒不会自动照亮物体。** 本章直接查环境颜色，属于环境映射；PBR 的 IBL 还需要结合材质进行照明计算。
- **Cubemap 是纹理，天空盒是它的一种用途。** 同一纹理还可以被反射、折射 Shader 使用。

> [!summary] 一句话回忆
> **六面图保存环境，方向决定查哪里；天空盒直接显示环境，反射和折射通过改变查询方向显示它。**

#learnopengl #opengl #graphics #cubemap #environment-mapping
