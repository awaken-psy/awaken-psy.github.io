---
title: 02 - 从 Lambert 到 Blinn-Phong
publish: true
updated: 2026-09-10T12:05:45.477Z
---

# 02 - 从 Lambert 到 Blinn-Phong

> 阅读时间：约 35 分钟
> 关键词：Lambert、Phong、Blinn-Phong、环境光、半程向量

---

## 你将学到什么

- 光照模型在回答什么问题（渲染方程的极简版）
- Lambert 漫反射：一个点积的全部威力
- 高光的三代：Phong → Blinn-Phong（及它为何赢了）
- 经典组合：Ambient + Diffuse + Specular 的完整局部光照

---

## 1. 局部光照模型：渲染方程的"先修版"

第01章说渲染算的是辐射率。完整的"从哪里来、到哪里去"积分（渲染方程）第03篇展开。先学它的极简版——**局部光照**：只考虑"光源直射到点 P、反射进眼睛"这一条路径：

$$
L_{out}(\mathbf{v}) = \sum_i f(\mathbf{l}_i, \mathbf{v}) \cdot E_i \cdot \cos\theta_i
$$

读法：出射辐射率 = 对每盏灯，"反射函数 $f$" 决定入射光有多少、往哪些方向弹。**光照模型的历史就是 $f$ 的进化史**。本篇的两个主角：$f$ 只管漫反射，$f$ 再加高光。

## 2. Lambert：理想的"哑光面"

**物理假设**：表面完全粗糙——入射光被均匀弹向所有上半球方向（各向同性漫反射）。

$$
L_{diffuse} = \frac{albedo}{\pi} \cdot E \cdot \max(0, \mathbf{n} \cdot \mathbf{l})
$$

三样东西，逐个理解：

- **$\max(0, \mathbf{n}\cdot\mathbf{l})$**：第01章的 Lambert 余弦定律——单位面积摊到的光量。max 0 把"光从背面来"截断；
- **albedo**：表面反射率（"这块料反射百分之多少、什么颜色"），来自纹理；
- **$\frac{1}{\pi}$**：能量守恒归一化——"往整个半球均匀撒"的几何分母（半球立体角 $2\pi$ 乘 $\cos$ 积分 = $\pi$）。老 shader 常省略它（艺术调参掩盖了物理偏差），PBR 里必须保留。

**Lambert 的性格**：从哪个角度看亮度都一样（视角无关）——因为弹得均匀，眼睛在哪都收到同样的份量。纸张、石灰墙、布料接近它。

> 💡 引擎里 `(albedo/π)·E·NdotL` 的 NdotL 部分是第01章"点积应用一"的落地；阴影对它的作用是"把 $E$ 乘上 0~1 的遮蔽系数"（第07章）。

## 3. 高光：镜面反射的那一束

哑光面之外，现实表面还有"镜面分量"——油漆、金属、湿地面会把光**集中弹向反射方向**，形成亮斑。

### 3.1 Phong（1975）：绕"反射向量"看

反射方向由入射方向镜像得到：

$$
\mathbf{r} = 2(\mathbf{n}\cdot\mathbf{l})\mathbf{n} - \mathbf{l}
$$

眼睛离反射方向越近越亮，用幂次收紧亮斑：

$$
L_{spec}^{Phong} = k_s \, E \, \max(0, \mathbf{r} \cdot \mathbf{v})^{\alpha}
$$

- $\alpha$（shininess）越大亮斑越小越锐——"越亮斑越像硬质抛光面"的直觉来源；
- 缺陷 1：**不守能量**——$k_s$ 与 $\alpha$ 都是自由参数，可以调出"反射出比入射更多的光"的假材质，美术调参全靠玄学；
- 缺陷 2：$\alpha$ 小时（粗糙面），掠射角的高光**长条变形**（Phong 班纹）。

### 3.2 Blinn（1977）：换一个观察点

Blinn 的替换：不去比"反射方向 vs 视线"，改比"**半程向量 vs 法线**"。半程向量是入射与视线方向的中间派：

$$
\mathbf{h} = \frac{\mathbf{l} + \mathbf{v}}{|\mathbf{l} + \mathbf{v}|}
$$

$$
L_{spec}^{Blinn} = k_s \, E \, \max(0, \mathbf{n} \cdot \mathbf{h})^{\alpha}
$$

**为什么更优**：

1. 视线与光源都固定时，$\mathbf{h}$ 在整个平面上变化平缓，亮斑形态稳定（没有掠射畸变）；
2. $\mathbf{h}$ 计算只需一次加法归一化，不用矩阵反射——**更便宜**；
3. 同样 $\alpha$ 下 Blinn 斑比 Phong 班宽约 4 倍 → 换算习惯：Blinn 的 $\alpha_{Blinn} \approx 4\alpha_{Phong}$。

**它赢的历史原因就是 2+3：效果近似、更省——是"移动端资历最老的高光"**。你今天仍能在无数卡通渲染 shader 里见到它（卡通不需要物理，只要亮斑可控）。

## 4. 组装：经典三件套

$$
L_{out} = \underbrace{ambient}_{环境光} + \sum_i \Big[ \underbrace{L_{diffuse}}_{漫} + \underbrace{L_{spec}}_{高光} \Big]
$$

- **ambient**：场景"到处都有"的底光（没有方向的近似环境光，URP 里由环境探针/球谐替代——第10章）；
- 实践里引入"光泽度映射（gloss map）"让高光强度随位置变化——PBR 的 roughness 贴图前身。

这套（尤其 Blinn-Phong 版）统治了实时渲染二十年，团结/Unity 内置管线的 Legacy 系列着色器（`Shaders/` 目录的 FXP 家族、`Runtime/Shaders/GpuPrograms` 里的实现）就是它的收官之作。**它的所有弱点**——高光与漫反射无联系、参数无物理含义、能量不守恒、无法跨材质一致地"看起来对"——正是微表面 PBR 要逐个解决的清单。

> ⚠️ 常见视觉 bug：法线没归一化（半程向量算歪，高光拉长变形）；视线向量在透视下没有用插值后的正确版本；`pow(0, 0)` 未定义——半程向量公式的 $\max$ 别忘。

## 5. 对比表（为第03篇 PBR 铺路）

| | Lambert | Phong/Blinn | （预告）PBR 微表面 |
|---|---|---|---|
| 表面假设 | 全粗糙 | 粗糙+理想镜叠加 | 微小镜面统计分布 |
| 参数 | albedo | albedo、$k_s$、$\alpha$（玄学） | albedo、metallic、roughness（物理） |
| 能量守恒 | 有（1/π） | **无** | 有（内置） |
| 视角相关性 | 无 | 高光有 | 高光+菲涅尔全有 |
| 美术流程 | — | "调到好看" | "材质参数真实" |

---

## 小结

- 局部光照 = $f(\mathbf{l},\mathbf{v})$ 决定光往哪弹；
- Lambert = $\frac{albedo}{\pi}E(\mathbf{n}\cdot\mathbf{l})$——均匀弹射+余弦+能量归一；
- Phong 用反射向量、Blinn 用半程向量；后者便宜且无掠射畸变，$\alpha$ 换算约 ×4；
- 三件套 ambient+diffuse+spec 是前 PBR 时代的标准像；
- Blinn-Phong 的四大弱点就是 PBR 的设计清单。

## 自测问题

1. 从能量守恒角度解释 $\frac{1}{\pi}$：它平衡的是哪个积分？
2. Blinn-Phong 为什么对法线未归一化更宽容？（提示：h 的定义包含归一化）
3. 粗糙面（小 $\alpha$）的 Blinn 高光为什么不会像 Phong 一样在掠射角拉出长条？
4. Blinn-Phong 的 $k_s=1.5, \alpha=200$ 调出的材质，物理上犯了什么错？

---

*下一节：[03-微表面理论与BRDF](学习笔记/cg/tuanjie引擎/总览/第06章-光照与PBR/03-微表面理论与BRDF.md) —— PBR 的理论核心：Cook-Torrance / GGX / 菲涅尔，一次性讲透。*
