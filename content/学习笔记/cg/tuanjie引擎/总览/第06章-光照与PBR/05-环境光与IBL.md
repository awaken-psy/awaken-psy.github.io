---
title: 05 - 环境光与 IBL：漫反射辐照度与预滤波高光
publish: true
updated: 2026-09-10T12:06:42.380Z
---

# 05 - 环境光与 IBL：漫反射辐照度与预滤波高光

> 阅读时间：约 45 分钟
> 关键词：环境贴图、辐照度、预滤波、分裂和近似、环境探针、球谐

---

## 你将学到什么

- 为什么"环境光"是渲染方程里最贵的部分
- IBL 的思想：把环境当成"无穷远的一张贴图光源"
- 漫反射环境的压缩：辐照度图 / 球谐
- 高光环境的压缩：预滤波 mip + BRDF LUT
- 团结/Unity 的落地：Ambient Probe、Reflection Probe、采样与混合

---

## 1. 问题的形状：一片光，无穷方向

前几篇的光照都是"点状光源"——方向有限、能量集中、一个个算。但真实世界的大头是**环境**：天空的整体天光、墙面的反弹、云层的散射……来自**四面八方、连续分布**。

回看渲染方程，环境项是**球面积分**：

$$
L_{env}(\mathbf{v}) = \int_{\Omega} f(\mathbf{l},\mathbf{v}) \, L_{env}(\mathbf{l}) \, (\mathbf{n}\cdot\mathbf{l}) \, d\omega_l
$$

被积函数里 $\mathbf{l}$ 无穷多——直接算=对每个像素遍历整个环境。实时思路：**把"环境"预计算成可廉价采样的形式**。这就是 **IBL（Image-Based Lighting，基于图像的光照）**。

**IBL 的建模**：环境辐射率来自"无穷远"，与位置无关（方向函数）→ 天生适合 **立方体贴图（Cubemap）**：环境=6 个面组成的"包围你的盒子光源"。（第02篇 Cubemap 硬件已就位，`Runtime/Graphics/CubemapTexture.cpp`。）

## 2. 漫反射环境：辐照度图

漫反射 BRDF 是常数（albedo/π）！于是积分里 BRDF 可以**提到积分号外**：

$$
L_{diff}^{env} = \frac{albedo}{\pi} \int_{\Omega(\mathbf{n})} L_{env}(\mathbf{l}) (\mathbf{n}\cdot\mathbf{l}) \, d\omega_l \;\equiv\; \frac{albedo}{\pi} \cdot E_{irr}(\mathbf{n})
$$

剩下的积分只依赖法线方向——**它就是辐照度**（第01章的 $E$ 的方向版本）！

**预计算**：离线对每个法线方向，把上半球的环境卷积一遍，存成一张新的 Cubemap（**辐照度图 Irradiance Map**）。运行时漫反射环境光 = 一次 Cubemap 采样（法线方向取值）× albedo/π。

$$
L_{diff}^{env} \approx \frac{albedo}{\pi} \cdot \text{IrradianceMap}[\mathbf{n}]
$$

低频特性：环境漫反射极其"平缓"（各方向被平均得一塌糊涂）→ 甚至可以用**球谐函数（SH）**压到 9 个系数（L2）。引擎的 **Ambient Probe**（环境探针，含天空自动烘焙）正是 SH 版辐照度——第10章光照探针同源。

> 💡 常见误区：看到教程采样"Radiance Map（原始环境贴图）"当漫反射环境——错！必须用卷积后的 Irradiance 版，否则环境光会"高光化"。

## 3. 镜面环境：粗糙度与视角都要管的积分

高光 BRDF 不是常数——依赖 $\mathbf{l},\mathbf{v}, roughness, F_0$，积分没法直接预卷。**Epic 的 Split-Sum（分裂和）近似**是行业标准解法：

$$
\int_{\Omega} f(\mathbf{l},\mathbf{v}) \, L(\mathbf{l}) \cos\theta_l \, d\omega \approx
\underbrace{\int_{\Omega} L(\mathbf{l}) \, w(\mathbf{l},\mathbf{v},\alpha) \, d\omega}_{①\ 预滤波环境图}
\cdot
\underbrace{\int_{\Omega} f \cos\theta_l \, d\omega}_{②\ BRDF\ LUT}
$$

**直觉**：把"环境贡献×BRDF 权重"拆成"加权平均的环境"和"平均掉的 BRDF"两半分别预计算。

### 3.1 ① 预滤波环境贴图

把 Cook-Torrance 的 GGX 权重当"模糊核"去卷环境图，**按粗糙度分层存进 Cubemap 的 mip 链**：

- mip 0（roughness=0）：几乎原始图（镜面反射）；
- 越高 mip（越粗糙）：模糊越狠（光斑散开）。

运行时：视线方向 + 折射向量 $\mathbf{r} = 2(\mathbf{n}\cdot\mathbf{v})\mathbf{n}-\mathbf{v}$ 采样，**用 roughness 估 mip 层**（硬件 trilinear 在 mip 间插值——第02章 mip 机制被这里"挪用"了）。

### 3.2 ② BRDF LUT

另一半积分只依赖 $roughness$ 与 $\mathbf{n}\cdot\mathbf{v}$（视角）两个标量——预积分成一张 256×256 的 **2D LUT**：R 通道 = 缩放系数、G = 偏移。运行时菲涅尔结合 LUT：

$$
F_{env} = F_0 \cdot LUT.r + LUT.g
$$

这张图每个管线都内置一张常量纹理（URP 的 `BRDFLUT`）——**它就是"环境高光的全部 BRDF 知识"**。

### 3.3 组装

$$
L_{spec}^{env} \approx PreFilteredEnv[\mathbf{r}, mip(\alpha)] \cdot \big(F_0 \cdot LUT.r + LUT.g\big)
$$

环境高光的一次完整求解 = 2 次纹理采样 + 少量 ALU。这就是你在镜面金属球上看到"整个环境反射"的实时实现。

## 4. 团结/Unity 的落地

| 组件 | 内容 | 采样者 |
|---|---|---|
| **Ambient Probe** | 天空/环境的 SH 辐照度（L1/L2） | 所有物体漫反射环境（无光照贴图时） |
| **Reflection Probe** | 某位置的**预滤波 Cubemap**（+ 可选烘焙辐照度） | 该范围内物体的高光（与漫反射环境回退） |
| **Skybox** | 天空本身（程序化/HDRI） | 天空盒 Pass + 作为探针的辐射源 |
| **Lighting Window** | 环境光源：Skybox/Gradient/Color 的三选一 | 全局 ambient |

**探针的范围与混合**：Reflection Probe 有包围盒，物体按"最近的探针"取高光；跨盒边界用 **Box Projection**（把采样方向按盒大小修正，让反射"贴合房间"）与多探针混合（每个物体的两个探针 + 权重）。第10章会把"烘焙探针"与"实时探针"的生产线讲全。

> ⚠️ **性能与一致性**：预滤波 cubemap 每层是独立 mipmap（32×32…），实时探针刷新整链成本不小——URP 里 Reflection Probe 的 `Time Slicing`（分帧刷新）与 `Mode`（Baked/Realtime）就是预算工具。金属度=1 的材质**完全没有漫反射**，环境全部依赖探针质量——场景没探针时金属一片死灰，美术第一反应该是"放探针"而不是"调参数"。

## 5. 光照篇收官：完整的一帧光照清单

把第06章组装成"物体像素的完整着色"，这就是 URP Lit PS 的主干结构：

$$
\begin{aligned}
L_{pixel} =\ & L_e \\
& + \sum_{i} \Big[ \tfrac{(1-F)\,albedo}{\pi} + \tfrac{D\,G\,F}{4(\mathbf{n}\cdot\mathbf{l}_i)(\mathbf{n}\cdot\mathbf{v})} \Big] E_i (\mathbf{n}\cdot\mathbf{l}_i) \cdot \text{shadow}_i \\
& + \tfrac{albedo}{\pi} \cdot E_{probe}(\mathbf{n}) \quad (\text{漫反射环境/AO})\\
& + PreFiltered_{probe}[\mathbf{r}, mip(\alpha)] \cdot (F_0 LUT.r + LUT.g) \cdot \text{specularOcclusion}
\end{aligned}
$$

四行分别：自发光、**直接光**（本篇主角）、**间接漫反射**、**间接高光**。第07章讲 $\text{shadow}$ 从哪来；第10章讲 $E_{probe}$ 的烘焙生产；第08章讲这四行被装进哪条管线。

---

## 小结

- 环境 = 无穷方向的光，靠**预计算**压成可采样资产：漫反射→辐照度图/SH；高光→预滤波 mip 链 + BRDF LUT；
- Split-Sum：环境加权平均 × BRDF 预积分——一次采样换来物理近似的环境高光；
- Unity 落地：Ambient Probe（SH 漫反射）、Reflection Probe（预滤波高光，Box projection、Time slicing）；
- 金属无漫反射，环境全靠探针——金属材质出问题先查探针覆盖。

## 自测问题

1. 漫反射环境为什么可以"提前卷"？卷积后的贴图与原始贴图视觉差在哪？（低频化）
2. 预滤波 cubemap 的 mip 与普通纹理 mip 的语义差异是什么？
3. BRDF LUT 的两个输入轴是什么？为什么这张图可以全场景共享？
4. 场景里只有一个大金属球，画面灰暗没反射——用本篇知识诊断（至少两个候选原因）。

---

*第06章完。下一章：阴影——$\text{shadow}$ 项的完整故事。*
