---
title: 抗锯齿与 MSAA 知识点详解
publish: true
updated: 2026-08-31T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - anti-aliasing
  - msaa
---


# 抗锯齿与 MSAA 知识点详解

原教程：[LearnOpenGL-CN · 抗锯齿](https://learnopengl-cn.readthedocs.io/zh/latest/04%20Advanced%20OpenGL/11%20Anti%20Aliasing/)

## 1 斜边为什么像台阶

三角形可能只覆盖一个像素的一部分。如果只检查像素中心，就容易得到“全画”或“全不画”的结果，斜边因此变成台阶。

**MSAA 在一个像素内设置多个采样位置，记录哪些位置被覆盖，最后合成一个颜色。**

![[学习笔记/cg/LearnOpengl/Advanced OpenGL/assets/LearnOpenGL-MSAA-采样点.png|550]]

*左边只检查一个点，右边检查四个点，可以表达部分覆盖。图源：[LearnOpenGL](https://learnopengl.com/img/advanced/anti_aliasing_sample_points.png)。*

例如白色三角形在黑色背景上覆盖了四个样本中的两个，可以把最后的颜色理解为“两份白、两份黑合成灰色”。这个灰色让边缘过渡更平滑，不是把整个物体变成了半透明。

## 2 直接画到窗口：准备多样本存储

```cpp
// 创建窗口之前，请求 4 个样本
glfwWindowHint(GLFW_SAMPLES, 4);
// 上下文和 GLAD 准备好之后
glEnable(GL_MULTISAMPLE);
```

关键是两件事：**帧缓冲有地方存多个样本，并且启用了多重采样状态。** 只打开开关，不会给普通缓冲自动增加样本；实际配置还要看平台支持。

之后仍按原来的方式画场景，不需要在普通片段 Shader 里手写边缘平滑算法。

## 3 画到自己的 FBO：多一步 resolve

结合 [[学习笔记/cg/LearnOpengl/Advanced OpenGL/Framebuffer 帧缓冲知识点详解.md|Framebuffer 帧缓冲知识点详解]]，记住这条顺序：

**画到多采样 FBO → resolve 成普通颜色纹理 → 后处理并显示。**

| 阶段 | 做什么 |
|---|---|
| 场景绘制 | 多采样颜色附件记录颜色样本，匹配的深度附件记录各样本遮挡 |
| Resolve（解析） | 用 `glBlitFramebuffer` 将多个颜色样本合成单采样结果 |
| 屏幕绘制 | 用普通 `sampler2D` 读取结果纹理，执行灰度等后处理 |

Resolve 不会再画一遍模型，也不需要把图片读回 CPU。它把“一个像素有多个样本”的结果变成下一步容易使用的普通图像。

## 4 复习时别混淆

- **4× MSAA 不等于片段 Shader 必须执行四次。** 通常可以把一次片段着色结果写给多个被覆盖的样本；深度、模板判断则按样本处理。
- **MSAA 与 SSAA 不同。** SSAA 在更高分辨率下完整渲染再缩小；MSAA 主要通过多点覆盖判断平滑几何边缘。
- **不是所有锯齿都能解决。** 高频纹理、尖锐高光或后处理新生成的边缘，仍可能走样。
- **样本越多也有代价。** 颜色、深度等存储及处理量会增加，还需要最终解析。

> [!note]- 对照本地代码
> `11.1` 只调用了 `glEnable(GL_MULTISAMPLE)`，没有申请 `GLFW_SAMPLES`，不能认定当前代码已得到 4× MSAA。
> `11.2` 明确创建 4 样本 FBO，resolve 到普通纹理，再做灰度显示；灰度转换不是 MSAA 本身。
> 多采样纹理也可以用 `sampler2DMS` 配合 `texelFetch` 读取指定样本，但本例采用先 resolve 的路线。

> [!summary] 一句话回忆
> **一个像素多检查几个位置，保留部分覆盖，合成后得到更平滑的边缘。离屏处理时，先 resolve，再接普通后处理。**

对应源码：窗口示例 11.1、离屏与 resolve 11.2。

#learnopengl #opengl #graphics #anti-aliasing #msaa
