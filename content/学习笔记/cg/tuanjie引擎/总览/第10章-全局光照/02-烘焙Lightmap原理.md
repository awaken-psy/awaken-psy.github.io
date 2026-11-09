---
title: 02 - 烘焙 Lightmap：离线渲染器的打工生活
publish: true
updated: 2026-09-10T12:11:35.101Z
---

# 02 - 烘焙 Lightmap：离线渲染器的打工生活

> 阅读时间：约 40 分钟
> 关键词：UV2、Progressive Lightmapper、路径追踪、辐照度纹理、AO 烘焙

---

## 你将学到什么

- Lightmap 的物理含义：静态表面的"已解好的积分"
- UV2 的存在理由与排图
- Progressive Lightmapper 的渐进路径追踪思想
- 直接光与间接光的分离烘焙、Directional Lightmap 与 AO 通道

---

## 1. Lightmap 的本质：把积分结果存成图

静态表面点 $P$ 的漫反射最终颜色（第06章漫反射+环境）：

$$
L_{diff}(P) = \frac{albedo_P}{\pi} \cdot \underbrace{\int_{\Omega(\mathbf{n}_P)} L_{in}(\mathbf{l}) \cos\theta \, d\omega}_{E_{irr}(P)\ ——\text{这就是 Lightmap 存的东西}}
$$

**Lightmap = 一张贴在每个静态表面上的"辐照度纹理"**——每个纹素存"这一小块表面接到的全部入射光的总和"（直接光+若干次反弹的间接光，离线已算好）。运行时 PS 只做一次采样 + 乘 albedo/π。把"每帧百万次积分"变成"每像素一次查表"——这就是烘焙的全部魔法。

> ⚠️ 语义细节：Lightmap 存的是**辐照度**（不含 albedo）——所以它必须**按表面展开**（不是屏幕空间），同一石墙刷两种颜色不需要重烘（颜色乘在材质端）。

## 2. UV2：为烘焙而生的第二套展开

### 2.1 为什么 UV0 不能用

模型自带 UV0（贴图用）：可以重叠（同一贴图重复用）、可以镜像、可以塞满任意利用率——**对"颜色图案"无所谓，对"逐位置唯一光照值"是灾难**：两个面共用一个 UV 区 = 共用一份光照值。

### 2.2 UV2（Lightmap UV）

引擎自动（或美术手动 DCC）生成**第二套 UV**：
- **不重叠**：每个表面点对应唯一纹素；
- **尽量均匀**：纹素密度代表光照精度，缝隙处密度突变 = 烘焙接缝可见；
- **组合成图集**：整个场景所有物体的 UV2 排进共享大图（1024~4096），**一张场景图**搞定。

引擎的 "Generate Lightmap UVs"（模型导入开关）即此。排图与密度控制的技术细节由 `Runtime/Graphics/LightmapSTConcatenate.h`（场景里逐物体的 scale/offset 拼装）与烘焙系统协作完成。

## 3. Progressive Lightmapper：离线打工的路径追踪

团结/Unity 的烘焙器叫 **Progressive Lightmapper**（CPU 或 **GPU 加速**，用 compute 做的路径追踪）。核心思想——**路径追踪（Path Tracing）**：

> 从光源或相机随机发射大量光线路径，在场景里按 BRDF 采样反弹（含漫反射的余弦加权采样），累计能量；样本越多噪声越小（蒙特卡洛收敛）。

$$
E_{irr}(P) \approx \frac{1}{N} \sum_{k=1}^{N} w_k \cdot L_{path_k}
$$

"**Progressive（渐进）**"的工程意义：不需要"等收敛完才能看"，**边追踪边输出可预览的低噪图**——每秒都在进步，美术随时中断拿结果（比老式 Radiosity/Enlighten 的"黑箱等待"体验质变）。GPU 版利用 compute：光路并行推进（第12章 compute 的离线应用）。

**质量选项对照**：
- **直接光**：可以解析算（阴影贴图式精确），或与间接一起蒙特卡洛；
- **反弹次数**：1 次反弹 vs 无限（俄罗斯轮盘终止）；
- **重要性采样**：先打向"光"的路径——噪声大减；
- **过滤**：噪声过滤（firefly 剔除、A-Trous）让低样本也干净。

## 4. 烘焙产物的三个通道（不是一张 RGB）

现代烘焙输出的是**多通道数据**（团结/Unity 在 Lightmap 设置里的产品）：

| 产物 | 内容 | 用途 |
|---|---|---|
| **光照颜色**（RGB） | 直接+间接辐照度 | 主光照 |
| **Directional Lightmap** | 主光方向+占比（NM/RLmap 编码） | 让烘焙光也能有法线响应的"方向感"（否则贴图光照是"平"的） |
| **Occlusion/阴影遮罩** | 每纹素"被哪些灯的阴影遮住"掩码 | **Shadowmask 模式的数据源**（第03篇主角） |

**Directional 的意义**值得强调：纯 Lightmap 的光没有方向（辐照度总和），高光无从谈起、法线贴图失去意义（漫反射也被"平均"）。编码主方向后，PS 里可以把辐照度按 $E \cdot (\text{主方向}\cdot\mathbf{n})$ 重新分配，近似方向性——**烘焙光与法线贴图的和解方案**。

## 5. 烘焙成本账（决定工作流的现实）

- **时间**：中型场景 CPU 分钟~小时级、GPU 数十秒~分钟级；美术改一盏灯→重烘（大场景必须分区/分 Lightmap，或用 GPU 渐进快速迭代）；
- **内存**：一张 2048 Lightmap（HDR 编码后）≈ 16~22MB；整场景 10 张 = **150MB+ 级预算**——移动端要严控分辨率与张数（第03篇编码讲怎么省）；
- **包体**：Lightmap 压缩后仍是大户——微信小游戏对 Lightmap 尺寸/张数要**极度克制**（配合距离剔除只加载近处）。

> 📁 **源码指引**：运行时 Lightmap 数据结构 `Runtime/Graphics/LightmapData.cpp`、`LightmapSettingsManager.cpp`（加载/激活/流式管理）；`LightingSettings.cpp`（烘焙配置——bounces、采样数、GPU 开关的数据面）；烘焙器本体在 Editor 侧（C++ + compute），探针与烘焙的交叉引用见 `LightProbesManager.cpp`。

---

## 小结

- Lightmap=静态表面的辐照度纹理：把每帧积分变成一次采样；存"光"不存"颜色"（albedo 运行时乘）；
- UV2：唯一、均匀、图集化——光照的"身份证"；
- Progressive Lightmapper：渐进路径追踪，边烘边看，GPU 版 compute 并行；
- 产物三件：辐照度 + 主方向编码 + 阴影掩码（Shadowmask 数据源）；
- 成本三账：时间（重烘痛）、内存（张数×分辨率）、包体（移动克制的根源）。

## 自测问题

1. 为什么 UV0 的重叠/镜像对 Lightmap 是灾难，对 Albedo 却无所谓？
2. "渐进"烘焙对美术工作流的实际改变是什么？（对比黑箱等待）
3. Directional Lightmap 解决了烘焙光的什么缺陷？（提示：法线贴图为何在纯 Lightmap 下失效）
4. 移动项目 Lightmap 预算策略：分辨率、张数、图集复用各怎么取舍？

---

*下一节：[03-Lightmap采样与ShadowMask](学习笔记/cg/tuanjie引擎/总览/第10章-全局光照/03-Lightmap采样与ShadowMask.md) —— 烘焙数据怎么被 shader 消费、烘焙阴影与实时阴影怎么握手。*
