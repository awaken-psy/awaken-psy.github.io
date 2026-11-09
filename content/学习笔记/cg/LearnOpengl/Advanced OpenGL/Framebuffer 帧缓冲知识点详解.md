---
title: Framebuffer 帧缓冲知识点详解
publish: true
updated: 2026-08-31T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - framebuffer
  - post-processing
---


# Framebuffer 帧缓冲知识点详解

原教程：[LearnOpenGL-CN · 帧缓冲](https://learnopengl-cn.readthedocs.io/zh/latest/04%20Advanced%20OpenGL/05%20Framebuffers/)

## 1 先把场景画进纹理，再把纹理显示出来

以前 Draw 直接画到窗口；现在先把箱子和地板画成一张纹理，再把这张纹理贴到铺满屏幕的四边形上。

**场景 → 颜色纹理 → 全屏四边形 → 屏幕**

如果第二遍只是照原样显示，看起来与直接画场景没有区别。但现在可以在第二遍处理整张画面：变黑白、模糊、锐化，或者只把它显示在屏幕的一小块区域。

## 2 FBO、纹理、RBO 分别是什么

把 FBO 想成“这次绘制结果的存放配置”，它连接着真正保存数据的附件：

| 对象 | 在本例中负责什么 |
|---|---|
| FBO | 记录颜色、深度等结果写向哪些附件 |
| 颜色纹理 | 保存箱子与地板的画面，随后交给 Shader 采样 |
| 深度/模板 RBO | 保存深度与模板数据；本例只用深度判断遮挡 |

**FBO 本身不保存像素，附件才保存。** 附件可以是纹理，也可以是渲染缓冲对象（RBO）。

初始化时只需记住这个顺序：

1. 建立 FBO。
2. 分配颜色纹理和深度/模板 RBO，并挂上去。
3. 用 `glCheckFramebufferStatus` 检查是否完整。

纹理分配时传 `NULL`，只是在准备存储；里面的画面稍后由清除和绘制产生。

> [!important] 什么时候选纹理，什么时候选 RBO
> 后面要用 Shader 采样，就选纹理；只给本次深度、模板测试使用，可以选 RBO。RBO 不能直接作为 sampler 纹理读取。

## 3 一帧记住“两遍画”

下面省略清除、Shader、VAO 等设置，只看目标切换：

```cpp
glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
glEnable(GL_DEPTH_TEST);
// 第一遍：正常绘制箱子、地板，画面进入颜色纹理。

glBindFramebuffer(GL_FRAMEBUFFER, 0);
glDisable(GL_DEPTH_TEST);
// 第二遍：采样刚才的颜色纹理，绘制全屏四边形。
```

第二遍不再画箱子模型，而是在画**一张包含箱子的图片**。全屏四边形的 UV 决定读取这张图片的哪里，整个过程无需把图片读回 CPU。

只改第二遍的片段 Shader，就能改变显示效果：

| 效果 | 怎样处理采样结果 |
|---|---|
| 反色 | 用 `1 - RGB` |
| 灰度 | 把 RGB 合成一个灰度值 |
| 模糊、锐化、边缘检测 | 采样周围像素，用不同的 kernel 权重加起来 |

## 4 复习时别混淆这几件事

- **绑定 FBO 只是换输出目标，不会立即画图。** 切回 `0` 也不会自动把纹理显示到窗口。
- **挂到 FBO 与绑定给 sampler，是两件事。** 前者让纹理接收绘制结果，后者让 Shader 读取它。
- **普通后处理不要同时读写同一张图像。** 连续处理通常准备两张纹理，交替作为输入和输出。

> [!note]- 对照本地示例与后视窗口
> 5.1 示例 的屏幕 Shader 只是直接显示纹理，未启用上表的后处理效果。
> 5.2 练习 先用后向相机画入纹理，再画正常主画面，最后把后向画面贴到**屏幕顶部居中**的小四边形上。它是另一个视角的画中画，不是完整的平面镜反射。

> [!summary] 一句话回忆
> **FBO 决定画到哪里；纹理保存这一遍的结果；下一遍采样它，就能显示或处理整张画面。**

#learnopengl #opengl #graphics #framebuffer #post-processing
