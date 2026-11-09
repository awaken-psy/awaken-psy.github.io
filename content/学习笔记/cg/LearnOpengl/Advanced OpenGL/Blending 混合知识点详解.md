---
title: Blending 混合知识点详解
publish: true
updated: 2026-08-31T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - blending
---


# Blending 混合知识点详解

原教程：[LearnOpenGL-CN · 混合](https://learnopengl-cn.readthedocs.io/zh/latest/04%20Advanced%20OpenGL/03%20Blending/)

## 1 草叶和玻璃，是两种“透明”

| 想画什么 | 处理方法 |
|---|---|
| 草叶：有草的地方保留，空白处不要 | 用 `discard` 丢弃空白处的片段 |
| 玻璃：既看到玻璃颜色，也看到后面的东西 | 用 blending 把两种颜色混合 |

草叶实际仍贴在矩形上，只是在片段 Shader 中做了筛选：

``` cpp
vec4 texColor = texture(texture1, TexCoords);
if (texColor.a < 0.1) discard;
FragColor = texColor;
```

本例被丢弃的片段不写颜色、深度；保留下来的部分正常遮挡后方。**它是“留或不留”，没有半透明过渡。**

## 2 玻璃的颜色怎样算

假设玻璃是红色，alpha 为 0.25，背后是蓝色：最后得到 **25% 红色 + 75% 蓝色**。

常用的普通 alpha 混合配置：

```cpp
glEnable(GL_BLEND);
glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
```

对应 RGB 公式：

$$
C_{结果}=C_{当前片段}\alpha+C_{已有画面}(1-\alpha)
$$

- **源颜色 source**：当前片段 Shader 的输出，本例就是玻璃颜色。
- **目标颜色 destination**：颜色缓冲这个位置已经保存的颜色。
- alpha 为 1，当前颜色完全覆盖；alpha 为 0，已有 RGB 保持不变。

混合发生在片段输出之后：Shader 交出 RGBA，OpenGL 按设置把新旧颜色合成。

## 3 为什么必须先画后面的玻璃

**先有背景颜色，前面的玻璃才有东西可以混合。**

1. 先画不透明物体，例如地板、箱子。
2. 按相机距离给透明物体排序。
3. 从远到近画透明物体，近处玻璃叠到已经合成好的远处画面上。

反过来先画近处玻璃，它可能先写入深度，导致后面的玻璃通不过深度测试；即使关闭深度写入，混合的先后顺序通常仍会影响颜色。

## 4 复习时别混淆这几件事

- **图片有 alpha，不等于自动透明。** 还需要 `discard`，或者开启并配置混合。
- **不改变颜色，不等于不写深度。** alpha 为 0 的片段仍可能留下深度；`discard` 才是直接丢掉片段。
- **深度测试仍然有用。** 玻璃应该被前面的箱子挡住；关闭深度写入和关闭深度测试是两件事。
- **透明贴图边缘出现细框时，检查环绕方式。** 本例用 `GL_CLAMP_TO_EDGE`，避免边缘与图片另一侧重复采样的颜色混在一起。

> [!note]- 深度写入、排序与本地代码
> 常见透明流程会保留深度测试，临时用 `glDepthMask(GL_FALSE)` 关闭深度写入，画完后恢复。但本地 3.2 窗户示例 **没有关闭深度写入**，主要依靠从远到近的排序。
> 按物体位置排序只是近似；交叉透明面不一定存在一个适合所有像素的物体顺序。

> [!summary] 一句话回忆
> **草叶用 discard 挖空；玻璃用 alpha 混合；先画不透明，再从远到近画透明。**

#learnopengl #opengl #graphics #blending
