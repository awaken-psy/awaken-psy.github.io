---
title: UBO 统一缓冲对象知识点详解
publish: true
updated: 2026-08-31T00:00:00.000Z
tags:
  - learnopengl
  - opengl
  - graphics
  - ubo
---


# UBO 统一缓冲对象知识点详解

原教程：[LearnOpenGL-CN · 高级 GLSL（Uniform 缓冲对象）](https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/08%20Advanced%20GLSL/)

## 1 四个箱子，为什么相机矩阵要传四遍

示例用四个不同的 Shader program，分别画红、绿、蓝、黄四个箱子。它们位置不同，却由同一个相机观察。

使用普通 uniform 时，每个 program 各自保存参数，相同的 `view` 和 `projection` 也要分别设置。

**UBO 的办法是：把公共参数放进一块 GPU 缓冲，让四个 program 都读取它。** 相机移动后更新这一份数据，接下来的四次绘制就能共用新相机矩阵。

| 参数 | 是否共享 | 本例放哪里 |
|---|---|---|
| `view`：从哪里观察 | 四个箱子相同 | UBO |
| `projection`：怎样投影 | 四个箱子相同 | UBO |
| `model`：箱子在哪里 | 每个箱子不同 | 普通 uniform，绘制前单独设置 |

## 2 Shader 里把公共参数放在一个 block

```glsl
layout (std140) uniform Matrices {
    mat4 projection;
    mat4 view;
};
uniform mat4 model;
```

`Matrices` 是 **uniform block**，声明“我要从缓冲里读取这两个矩阵”。顶点变换仍然使用 `projection * view * model`，算法没有改变。

`std140` 规定参数在缓冲中的排列方式。可以理解成双方约定：**CPU 写到哪个位置，GLSL 就从哪个位置读取。**

本例先放 `projection`，后放 `view`，各占一个 `mat4`。以后加入 `vec3`、数组等，不能只把数值紧挨着塞进去，还要按布局规则留出必要的空隙。

## 3 怎样让四个 program 找到同一块数据

只记这条连接：

**各 program 的 `Matrices` → UBO 绑定点 0 → `uboMatrices` 缓冲。**

绑定点像中间的插槽，两端都要接上：

| 哪一端 | 配置动作 |
|---|---|
| program → 插槽 | 对四个 program 分别用 `glUniformBlockBinding`，让其 `Matrices` 连接到绑定点 0 |
| 插槽 → 数据 | 用 `glBindBufferRange` 或 `glBindBufferBase`，让绑定点 0 指向 UBO |

CPU 先为两个矩阵分配缓冲，再把这两端接好。之后更新缓冲中的矩阵即可，通常不用每帧重新建立连接。

> [!important] 名字相同，不代表自动共享
> 四个 Shader 都声明 `Matrices` 还不够；必须把它们接到保存同一份数据的缓冲。
> 这里的 0 是 **UBO 绑定点编号**，不是缓冲对象 ID，也不是某个 program 内的 block index。

## 4 用四个箱子记住更新规则

| 发生什么 | 需要更新什么 |
|---|---|
| 相机移动 | 更新 UBO 中的一份 `view`，四个箱子都按新视角绘制 |
| 视野角或宽高比改变 | 更新 UBO 中的一份 `projection` |
| 只移动红箱子 | 改绘制红箱子时的 `model`，其他箱子不受影响 |

UBO 共享的是参数，**四个箱子仍然分别选择 program、设置 model、提交 Draw**。它不会自动把四次绘制合并成一次，也不替代保存顶点的 VBO。

因此复习时只需要区分：**共同变化的参数放一起，物体各自的变化单独处理。** 普通 uniform 和 UBO 可以同时使用。

> [!note]- 对照本地代码
> UBO 示例 在初始化时写入 projection，每帧通过 `glBufferSubData` 更新 view，再分别设置四个 model。它的投影固定，因此没有每帧重写；这不是 UBO 的限制。
> 顶点 Shader 中的 `Matrices` 与 CPU 写入顺序对应。

> [!summary] 一句话回忆
> **一块 UBO 保存公共参数，多个 program 通过绑定点读取它；更新一次数据，后续绘制共同使用。**

#learnopengl #opengl #graphics #ubo
