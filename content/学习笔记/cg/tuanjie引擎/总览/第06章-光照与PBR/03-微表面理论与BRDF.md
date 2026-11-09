---
title: 03 - 微表面理论与 BRDF：PBR 的核心
publish: true
updated: 2026-09-10T12:06:07.535Z
---

# 03 - 微表面理论与 BRDF：PBR 的核心

> 阅读时间：约 50 分钟（全书最重要的一篇，值得慢读）
> 关键词：渲染方程、BRDF、Cook-Torrance、GGX、菲涅尔、能量守恒

---

## 你将学到什么

- 渲染方程：整个实时渲染的"总纲"
- BRDF：反射行为的数学画像（及它的两条铁律）
- 微表面理论：用统计把"粗糙"变成公式
- Cook-Torrance 公式三大件：法线分布 D、遮蔽 G、菲涅尔 F —— 逐个推导直觉
- 团结/Unity 的标准 PBR 着色器组装全景

---

## 1. 渲染方程：一切光照的宪法

Kajija 1986。实时渲染（离线渲染亦然）只是在解这一个方程：

$$
L_{out}(\mathbf{v}) = \underbrace{L_e(\mathbf{v})}_{自发光} + \int_{\Omega} \underbrace{f(\mathbf{l}, \mathbf{v})}_{BRDF} \, L_{in}(\mathbf{l}) \, (\mathbf{n} \cdot \mathbf{l}) \, d\omega_l
$$

读法：**眼睛方向看到的辐射率 = 物体自己发的光 + 对上半球每个方向来的光，"按 BRDF 说的比例"折算到视线方向**。三族术语已在第01章备齐：$L$（辐射率）、$d\omega$（立体角微元）、$\mathbf{n}\cdot\mathbf{l}$（余弦摊薄）。

实时渲染的两大难点：① 积分没法解析求解；② $L_{in}$ 里藏着"别的物体反射出来的光"（递归！全局光照，第10章）。**前向渲染的实质：把积分砍成 N 盏灯的求和**：

$$
L_{out} \approx L_e + \sum_{i=1}^{N} f(\mathbf{l}_i, \mathbf{v}) \, E_i \, (\mathbf{n}\cdot\mathbf{l}_i)
$$

所有光照模型的工作都收敛为**设计 $f$**——BRDF。

## 2. BRDF：反射行为的画像

**BRDF（双向反射分布函数）** $f(\mathbf{l}, \mathbf{v})$：

> 入射方向 $\mathbf{l}$ 打到表面、往 $\mathbf{v}$ 方向弹出去的**比例**（每立体角）。

单位 sr⁻¹。它是纯函数（四个标量入：两个方向的角坐标；出：RGB 三分量），完全描述"这块材质怎么反光"。

**两条物理铁律**（BRDF 必须满足，违反即"假材质"）：

1. **能量守恒**：所有方向弹出的能量 ≤ 打进来的能量；
2. **亥姆霍兹互易**：$f(\mathbf{l},\mathbf{v}) = f(\mathbf{v},\mathbf{l})$——光路可逆（把眼睛和光源对调，看到的东西一样）。离线渲染的光线双向追踪、烘焙 GI 都依赖它。

Blinn-Phong 高光之所以"假"：两条都违反。PBR 的承诺：**用一个满足铁律的参数化 BRDF，让"调得好看"变成"参数真实"**。

## 3. 微表面理论：粗糙的统计画像

**核心假设**：看似平坦的表面在微观上是**无数个微小、完美的镜面（微面元）**。所谓"粗糙度"= 这些小镜面的法线朝向有多乱。

```
光滑面（roughness→0）           粗糙面（roughness→1）
   /|  /|  /|  /|                /\ \/ /\ |\/ /\\
  / | / | / | / |   ← 全部同向    乱指 → 反射光散开
微镜面全部同向 → 光弹向同一处（亮斑小而锐）   → 亮斑大而糊
```

高光 = **"朝向恰好能把光从 $\mathbf{l}$ 镜到 $\mathbf{v}$ 的那批微面元"的集体贡献**。这样的微面元法线方向是唯一的：**半程向量 $\mathbf{h}$**（第02篇的 h 在这里获得了物理身份！）。

于是 BRDF 的高光项 = 三个问题的乘积：

1. **有多少微面元恰好朝向 $\mathbf{h}$** → 法线分布函数 **D**
2. **这些微面元有多少没被别的微面元挡住（出射与入射双向）** → 遮蔽-阴影函数 **G**
3. **每个微面元镜面反射多少** → 菲涅尔 **F**

## 4. Cook-Torrance：PBR 高光的组装公式

$$
f_{spec}(\mathbf{l},\mathbf{v}) = \frac{D(\mathbf{h}) \, G(\mathbf{l},\mathbf{v},\mathbf{h}) \, F(\mathbf{v},\mathbf{h})}{4 \, (\mathbf{n}\cdot\mathbf{l}) \, (\mathbf{n}\cdot\mathbf{v})}
$$

分母 $4(\mathbf{n}\cdot\mathbf{l})(\mathbf{n}\cdot\mathbf{v})$ 是**宏观面与微面元投影的几何换算**——它就是"能量守恒"的守护者（由推导自然产生，不是拍脑袋加的）。

### 4.1 D —— 法线分布：亮斑的形状与锐度

"朝向 $\mathbf{h}$ 的微面元密度"。团结/Unity 及业界标准用 **GGX**（也叫 Trowbridge-Reitz）：

$$
D_{GGX}(\mathbf{h}) = \frac{\alpha^2}{\pi \big((\mathbf{n}\cdot\mathbf{h})^2(\alpha^2-1)+1\big)^2}
$$

其中 $\alpha = roughness^2$（**参数平方映射**：让粗糙度的低段变化更细腻，美术拖滑条手感更好）。

**形状直觉**：GGX 有一条著名的**长尾**——中心亮斑外还有一圈渐隐的光晕（软过渡）。这正是真实材质高光的特征（老 Blinn-Phong 的指数衰减太"干脆"，边缘生硬）。roughness 从 0→1，分布从"细针"变成"满半球"。

### 4.2 G —— 遮蔽与阴影：微表面互相踩踏

凹凸不平的微表面世界里，一块凸起会挡住邻居的入射光（阴影）和出射光（遮蔽）。粗糙度越大越严重。标准实现 **Smith 遮蔽**（分离近似，GGX 配套）：

$$
G(\mathbf{l},\mathbf{v}) = G_1(\mathbf{l}) \, G_1(\mathbf{v}), \qquad
G_1(\mathbf{x}) = \frac{\mathbf{n}\cdot\mathbf{x}}{\mathbf{n}\cdot\mathbf{x}\,\big(1 - \frac{1}{2}\big) + \frac{1}{2}}
$$

它只衰减掠射（$\mathbf{n}\cdot\mathbf{x}$ 小）方向的光——**正对方向基本无损**。你肉眼在"高粗糙度材质的掠射高光变暗"看到的就是它。

### 4.3 F —— 菲涅尔：掠射角的镜面化

第01篇"应用三"的正式版。**Schlick 近似**：

$$
F(\mathbf{v},\mathbf{h}) = F_0 + (1 - F_0)(1 - (\mathbf{v}\cdot\mathbf{h}))^5
$$

- $F_0$：**垂直视角的基础反射率**（材质的本征颜色：金属彩色、非金属灰白约 0.04）；
- 视线越掠射（v·h 越小），反射率→1：**所有材质在掠射角都变成镜子**——湖面、桌面、马路远处都是证人。

$$
F_0 = \begin{cases} albedo & \text{金属（彩色反射率）} \\ 0.04 & \text{非金属（常见塑料/石头固定值）} \end{cases}
$$

**金属 vs 非金属的分野全在 $F_0$**——这正是下一节"金属度工作流"要讲的内容。

## 5. 完整的团结/Unity PBR 着色器

漫反射保留 Lambert（粗糙全散射），高光用 Cook-Torrance，按能量守恒分配两者：

$$
f = \underbrace{(1-F)\,\frac{albedo_{diffuse}}{\pi}}_{漫（金属无漫）} + \underbrace{\frac{D\,G\,F}{4(\mathbf{n}\cdot\mathbf{l})(\mathbf{n}\cdot\mathbf{v})}}_{高光}
$$

细节：①菲涅尔出现在两项——"正视角反射的那部分光不再进漫反射"（高光抢走的光，漫反射就没了）；②金属漫反射=0（金属的自由电子吞噬渗透光）。这两条加上 D/G/F 的铁律，让"参数真实"自带"光照正确"。

**URP Lit / 内置 Standard 的 PS 主干正是它**（`Packages/com.unity.render-pipelines.universal/` 的 `Lit.shader` → `Lighting.hlsl` → `DirectLighting` 系列 include）。**第04篇把参数化（albedo/metallic/smoothness 贴图）讲透后，你就能逐行读懂整个 Lit shader。**

> ⚠️ 调试 PBR 的经典直觉：roughness=1 且 metallic=1 时画面接近纯黑（漫没了、高光糊了）——不是 bug，是物理诚实；美术资产出问题先看贴图通道是否错位（metallic 存在 roughness 通道里之类）。

---

## 小结

- 渲染方程是总纲，前向渲染 = 积分砍成 N 盏灯求和，一切收敛于 BRDF 设计；
- BRDF 两铁律：能量守恒、光路可逆；
- 微表面：粗糙 = 微镜面朝向的统计分布，半程向量 h = "能弹给你"的微面元朝向；
- Cook-Torrance = $\frac{DGF}{4(\text{NdotL})(\text{NdotV})}$：D 管形状、G 管踩踏、F 管掠射镜面化，分母自动守恒；
- 完整 PBR = (1-F)·Lambert + Cook-Torrance，金属吞漫反射。

## 自测问题

1. 用微表面语言解释：roughness 上升时，为什么亮斑变大变糊、且整体变暗一点点？（G 项的功劳）
2. 为什么说 GGX 的"长尾"让 PBR 高光比 Blinn-Phong 真实？
3. 菲涅尔与漫反射里的 (1-F)：如果去掉这个因子，违反哪条铁律？
4. 为什么 metallic=1 时漫反射必须归零？（自由电子与吸收的物理）

---

*下一节：04-金属度粗糙度工作流 —— 把理论变成贴图与滑条：albedo/metallic/smoothness 三剑客与法线贴图。*
