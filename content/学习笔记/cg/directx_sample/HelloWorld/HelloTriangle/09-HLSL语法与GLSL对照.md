---
title: HelloTriangle 09 - HLSL 语法与 GLSL 对照
publish: true
updated: 2026-09-11T17:39:50.600Z
tags:
  - DirectX
  - Direct3D12
  - HelloTriangle
  - HLSL
  - GLSL
  - 着色器语法
---


# 09 HLSL 语法与 GLSL 对照

上一篇：[[学习笔记/cg/directx_sample/HelloWorld/HelloTriangle/08-根签名.md|根签名]]  
下一篇：[[学习笔记/cg/directx_sample/HelloWorld/HelloTriangle/10-视口与裁剪矩形.md|视口与裁剪矩形]]

## 先看整体差异

HLSL 和 GLSL 都是 C 风格着色语言。算术表达式、`if`、循环、函数、结构体和成员访问都很接近。当前 HelloTriangle 中最明显的差异不在计算语法，而在**着色器阶段怎样声明输入和输出**。

【核心】GLSL 通常使用全局 `in/out` 变量和 `layout(location = ...)`；HLSL 可以直接使用入口函数的参数、返回值和冒号后的语义。

| 目的 | GLSL 常见写法 | 当前 HLSL 写法 |
| --- | --- | --- |
| 二维浮点向量 | `vec2` | `float2` |
| 三维浮点向量 | `vec3` | `float3` |
| 四维浮点向量 | `vec4` | `float4` |
| 4×4 浮点矩阵 | `mat4` | `float4x4` |
| 阶段输入 | 全局 `in` | 入口函数参数及其语义 |
| 阶段输出 | 全局 `out` | 返回值、返回结构成员或 `out` 参数的语义 |
| 顶点最终位置 | `gl_Position` | `SV_POSITION` |
| 颜色目标输出 | 自定义 `out vec4` | `SV_TARGET` |
| 入口函数 | 通常固定为 `main` | 名字可自定，由编译命令选择入口 |

## 类型写法

当前 HLSL 中的：

```hlsl
float4 position;
float4 color;
```

对应 GLSL：

```glsl
vec4 position;
vec4 color;
```

HLSL 用“标量类型 + 分量数”组成向量类型：

```hlsl
float2
float3
float4
int2
uint4
bool3
```

访问分量仍可使用熟悉的 `.x/.y/.z/.w` 或 `.r/.g/.b/.a`。本例中的 `float` 是 32 位浮点类型。

## struct 写法基本相同

HLSL：

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float4 color : COLOR;
};
```

如果先忽略冒号后的语义，结构体本身与 GLSL/C++ 很相似。可以声明局部变量并访问成员：

```hlsl
PSInput result;
result.position = position;
result.color = color;
```

`PSInput` 只是程序员选择的类型名，不是 HLSL 关键字。这里它同时充当顶点着色器输出和像素着色器输入。

## 冒号后的内容：语义

HLSL 常见接口语法是：

```text
类型 变量名 : 语义
```

例如：

```hlsl
float4 color : COLOR;
```

【核心】语义描述这个值在着色器接口中的用途。它可以写在：

- 入口函数参数后；
- 结构体成员后；
- 整个函数返回值后。

微软文档把语义定义为附着在着色器输入或输出上的字符串，用来表达参数用途；在阶段之间传递的数据需要通过语义连接。

### 普通语义

`POSITION`、`COLOR`、`TEXCOORD0` 等是不带 `SV_` 前缀的语义。对当前 DXC 和现代着色器模型而言，它们主要是用户定义的接口标签。

当前顶点着色器输入：

```hlsl
float4 position : POSITION
float4 color : COLOR
```

它们分别匹配 C++ 输入布局中的 `"POSITION"` 和 `"COLOR"`。变量名可以改变，只要接口语义仍然匹配。

顶点着色器输出中的 `COLOR` 又与像素着色器输入中的 `COLOR` 对应，因此颜色能跨过光栅化阶段继续传递。

### 同一个 COLOR 为什么既是输出又是输入

首先要稍微修正“`VSMain` 参数由 CPU 传入”这个说法：数据的源头确实由 CPU 准备，但 CPU 不会像调用普通 C++ 函数那样直接调用 `VSMain(position, color)`。

真实路径是：

```text
CPU 填写顶点缓冲区和输入布局
              ↓
GPU 输入装配阶段读取 POSITION/COLOR
              ↓
作为参数交给一次 VSMain 调用
```

再看 `PSInput`：

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float4 color : COLOR;
};
```

语义本身不固定表示“输入”或“输出”，方向由这个变量位于哪个着色器接口位置决定：

- `PSInput` 作为 `VSMain` 返回类型时，成员是顶点着色器输出；此时 `COLOR` 是 VS 输出语义。
- `PSInput` 作为 `PSMain` 参数类型时，成员是像素着色器输入；此时 `COLOR` 是 PS 输入语义。

`COLOR` 没写数字时等价于第一组 `COLOR0`。顶点着色器输出 `COLOR0`，像素着色器输入也声明 `COLOR0`，所以管线知道这两端是同一条跨阶段数据通道。

完整颜色路径是：

```text
CPU Vertex::color
      ↓ 输入布局中的 "COLOR"
VSMain 参数 color : COLOR
      ↓ result.color = color
VS 输出 result.color : COLOR0
      ↓ 光栅化阶段在三个顶点之间插值
PS 输入 input.color : COLOR0
      ↓ return input.color
SV_TARGET
```

它在 GLSL 中大致相当于：

```glsl
// vertex shader
layout(location = 0) out vec4 vertexColor;

// fragment shader
layout(location = 0) in vec4 vertexColor;
```

区别是 GLSL 示例用相同 `location` 连接两端，而当前 HLSL 用相同的 `COLOR0` 语义连接两端。

`SV_POSITION` 与普通 `COLOR` 不同：`SV_POSITION` 是系统语义，光栅化阶段必须把它解释为位置；`COLOR` 是普通用户语义，管线主要负责把它匹配、插值并传给下一阶段，并不强制它必须真的表示颜色。

### SV_ 系统语义

`SV_` 表示 System Value，即图形管线赋予特殊含义的系统语义。

当前文件使用两个：

- `SV_POSITION`：顶点着色器输出的最终位置，交给光栅化阶段；
- `SV_TARGET`：像素着色器输出的颜色，写向渲染目标。

可以把它们近似理解成 GLSL 内建接口：

```text
SV_POSITION ≈ gl_Position
SV_TARGET   ≈ layout(location = 0) out vec4
```

注意：这是职责上的对照，不表示两种 API 的坐标、资源绑定和编译模型完全相同。

## 入口函数不必叫 main

GLSL 通常写：

```glsl
void main()
```

HLSL 的入口函数名可以自定义。本例同一个文件里有：

```hlsl
PSInput VSMain(...)
float4 PSMain(...)
```

构建时，DXC 被分别告知：

- 以 `VSMain` 为入口，按顶点着色器目标编译；
- 以 `PSMain` 为入口，按像素着色器目标编译。

因此同一个 `.hlsl` 文件会产生两份 `.cso` 字节码。

本文件也没有写 GLSL 风格的 `#version`。HLSL 使用的 Shader Model 由 DXC 编译目标指定，本例分别是 `vs_6_0` 和 `ps_6_0`。

## 顶点着色器的函数式接口

当前 HLSL：

```hlsl
PSInput VSMain(float4 position : POSITION, float4 color : COLOR)
{
    PSInput result;
    result.position = position;
    result.color = color;
    return result;
}
```

可以从左到右读成：

1. 返回一份 `PSInput`；
2. 函数名为 `VSMain`；
3. 接收带 `POSITION` 语义的位置；
4. 接收带 `COLOR` 语义的颜色；
5. 返回结构中的 `SV_POSITION` 和 `COLOR` 进入后续阶段。

大致对应下面的 GLSL 顶点着色器：

```glsl
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec4 inColor;

layout(location = 0) out vec4 vertexColor;

void main()
{
    gl_Position = vec4(inPosition, 1.0);
    vertexColor = inColor;
}
```

## 像素着色器直接返回颜色

当前 HLSL：

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return input.color;
}
```

函数返回值后的 `: SV_TARGET` 表示整个返回值是颜色目标输出。可以读成：

> `PSMain` 接收一份插值后的 `PSInput`，返回一个写入颜色渲染目标的 `float4`。

大致对应下面的 GLSL 片元着色器：

```glsl
layout(location = 0) in vec4 vertexColor;
layout(location = 0) out vec4 outColor;

void main()
{
    outColor = vertexColor;
}
```

HLSL 也支持使用 `out` 参数表达输出，但当前示例选择返回值和返回结构，代码更紧凑。

## 插值写在哪里

当前 `COLOR` 没有添加插值修饰符，因此使用默认插值行为。和 GLSL 默认的平滑插值类似，三个顶点颜色会在三角形内部变化。

以后如果需要不插值的数据，HLSL 可以使用 `nointerpolation` 等修饰符；当前 HelloTriangle 不需要展开。

## 当前阶段暂不展开的 HLSL 内容

- `cbuffer` 与常量缓冲区；
- `Texture2D`、`SamplerState` 和采样；
- `register(b0/t0/s0/u0)` 资源寄存器；
- `mul` 与矩阵行列约定；
- Direct3D 与 OpenGL 的坐标和纹理方向差异。

这些语法会在后续样例真正出现时分别学习，避免只背一张完整语法表。

## 暂时只需记住

1. `float4` 大致对应 GLSL `vec4`。
2. HLSL 常用函数参数和返回值表达阶段输入输出。
3. 冒号后是语义；普通语义连接数据，`SV_` 语义具有系统含义。
4. `SV_POSITION` 对应顶点最终位置，`SV_TARGET` 对应颜色目标输出。
5. HLSL 入口函数不必叫 `main`，由编译命令选择。

## 参考

- [HLSL Semantics（Microsoft Learn）](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-semantics)
- [HLSL Struct Type（Microsoft Learn）](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-struct)
- [HLSL Variable Syntax（Microsoft Learn）](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-variable-syntax)

返回：[[学习笔记/cg/directx_sample/HelloWorld/HelloTriangle/00-HelloTriangle学习索引.md|HelloTriangle 学习索引]]
