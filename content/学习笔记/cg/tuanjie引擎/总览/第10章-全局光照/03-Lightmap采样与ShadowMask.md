---
title: 03 - Lightmap 采样与 ShadowMask
publish: true
updated: 2026-09-10T12:11:53.481Z
---

# 03 - Lightmap 采样与 ShadowMask

> 阅读时间：约 35 分钟
> 关键词：光照模式、Shadowmask、Baked/Realtime 揉合、HDR 编码

---

## 你将学到什么

- 四种光照模式（Realtime/Subtractive/Masked/Baked）的真实语义
- Shadowmask 的每灯一位编码与 Distance Shadowmask 的取舍
- Lightmap 的 HDR 编码（dLDR/RGBM/dRGBM）与带宽
- 混合光照的完整决策树

---

## 1. 光照模式：混合光照的"宪法"

烘焙不可能烘"动态的灯"，也舍不得放弃"实时阴影的锐度"。于是引擎提供**光照模式**（Lighting Window → Mixed Lighting）声明每盏灯的角色分工：

| 模式 | 语义 | 适合 |
|---|---|---|
| **Realtime** | 全实时：直接+阴影运行时算 | 动态灯、需要移动的光 |
| **Baked** | 全烘焙：直接光也进 Lightmap | 装饰灯、远处灯 |
| **Mixed** | 直接光实时、间接+阴影烘焙 | **主流**：可动的静态灯 |

Mixed 灯的运行时公式（把第06章直接光里的阴影项替换为烘焙掩码）：

$$
L_{direct} = f(\mathbf{l}, \mathbf{v}) \, E_l \cos\theta \cdot \text{shadowmask}[\text{uv}_2]
$$

四种"阴影伴生模式"（团结/Unity 的 Lighting Mode）：

| 模式 | 阴影行为 |
|---|---|
| **Baked Indirect** | 阴影全实时（Shadow Map 老老实实算） |
| **Distance Shadowmask** | 近处实时阴影 + 远处用 Shadowmask 接管（一个灯两种影子） |
| **Shadowmask** | 阴影全部用烘焙掩码（远处近处都不画实时影） |
| **Subtractive** | 特殊降级：烘焙阴影 + **仅一盏**实时方向光直射（移动端老方案） |

## 2. Shadowmask：每灯一位的"影子 ID 卡"

Shadowmask 纹理的每纹素 **4 个通道各存 1 盏灯的遮蔽**（最多 4 盏 Mixed 灯）：

$$
R = \text{灯1遮蔽},\ G = \text{灯2},\ B = \text{灯3},\ A = \text{灯4}
$$

PS 里"这盏 Mixed 灯的阴影" = 取出对应通道 ×（实时阴影或 1）。**妙处**：

- 运行时**不画这盏灯的 Shadow Map**（省整个第07章的深度渲染流程）；
- 阴影质量与烘焙分辨率绑定（2K Shadowmask 全场静态阴影常常比 4 级 CSM 更清晰）。

**致命约束**：物体动了，影子还在原地（烘死的影子）。所以：
- **静态物体**（房子、墙）：享受 Shadowmask；
- **动态物体**（角色）：**必须另外画实时阴影**（角色没有 UV2 也没烘）——角色用 Shadow Map，地面接角色的影子靠实时。这是"角色影子比房子锐利"的混合画面来源，也是参数（Shadowmask Distance）要按场景调的原因。

**Distance Shadowmask 的分界**：`Shadow Distance` 内实时（角色影子区域），外 Shadowmask（远景静态影）——**等于把第07章"阴影距离"与烘焙衔接起来**，开放世界标配。

> ⚠️ 常见翻车：把角色放到 Shadowmask 模式场景里、又没开角色 Cast Shadows → 角色没影子、悬空感爆表。检查顺序：Mixed 灯的 Shadow Type → 角色投影开关 → Shadowmask Distance。

## 3. HDR 编码：Lightmap 怎么塞进普通纹理

Lightmap 的值**可以超过 1**（太阳直射 + 反弹叠加，物理值可达数倍）。但普通纹理（LDR ARGB32）只能存 [0,1]。三种编码（引擎按平台自动选，也可在 Lighting Settings 指定）：

| 编码 | 原理 | 带宽/质量 |
|---|---|---|
| **dLDR**（桌面老默认） | 直接线性存 [0,1]，超 1 截断 | 移动省、高光比截断 |
| **RGBM** | RGB × 共享 alpha 幂：$V = rgb \cdot M \cdot M_{max}$ | 中庸；alpha mip 渗色问题 |
| **dRGBM**（团结/Unity 现默认） | 桌面用双线性过滤安全的改进 RGBM | mip 混合正确 |

$$
\text{RGBM: } V_{stored} = rgb \cdot M, \quad M \in [0,1] \to V_{real} = rgb \cdot M \cdot k
$$

**为什么编码重要**：解码必须和采样一致——alpha 参与颜色缩放时，硬件 trilinear 会在 mip 间线性混合 RGB 与 M，**比例被破坏**（远处 Lightmap 变暗/变亮）——dRGBM 就是为了修这个。你的"游戏在远处偏暗"可以查一眼 Lightmap 编码设置。

## 4. 运行时消费：PS 里的三步

```hlsl
// URP 的 baked light 采样骨架（简化）
half3 lm = SAMPLE_GI(uv2, lightmapTex, lightmapSampler);   // ① 输辐照度采样
half3 bakedGI = DecodeLightmap(lm);                        // ② 解码（RGBM/Directional 拆解）
half3 directShadow = shadowMaskChannel * realtimeShadow;   // ③ Shadowmask 通道×实时
color.rgb += bakedGI * albedo / PI;                        //    间接光入账
```

与第06章05篇的环境光采样（SH）**同一位置汇合**：`SampleSH`（动态物/无 Lightmap）与 `SAMPLE_GI`（静态物）在 `GlobalIllumination.hlsl` 汇合——**管线里"这块表面有 Lightmap 就用，没有就回退探针"**的分支就是第05章变体（LIGHTMAP_ON）的由来。

## 5. 决策树：一盏灯该给什么待遇

```
这盏灯会移动/会变强变弱吗？
├─ 会 → Realtime（+预算检查第06章）
└─ 不会（静态）
   ├─ 它的阴影需要投在动态物体上吗？
   │   ├─ 需要（角色要在灯下走动）→ Mixed
   │   │     ├─ 大场景远处很多静态灯 → Shadowmask / Distance Shadowmask
   │   │     └─ 少量近景重要灯 → Baked Indirect（全实时影）
   │   └─ 不需要（装饰光、天花板灯带）→ Baked
   └─ 移动端：Subtractive 只在"必须支持低端的旧方案"时考虑
```

> 📁 **源码指引**：`Runtime/Graphics/LightmapEnums.h`（光照模式与 Shadowmask 的枚举定义——本篇的"词汇表"）；`SharedLightmapSettingsData.h`（管线与烘焙的共享配置）；`LightmapSTConcatenate.h`（UV2 的逐物体拼装——"图集怎么找到我"的答案）；采样 shader 宏在 URP 包 `Shaders/Lighting.hlsl` 的 `SAMPLE_GI/DecodeLightmap`。

---

## 小结

- 四模式定"灯与影的分工"：Realtime 全时算、Baked 全固化、Mixed 直接实时+间接阴影烘焙；
- Shadowmask=每纹素 4 灯遮蔽（RGBA 各一）：省实时 Shadow Map、静态影锐利，但动态物体必须补实时影；
- Distance Shadowmask：近实时远烘焙的开放世界答案；
- HDR 编码（dLDR/RGBM/dRGBM）决定"超 1 的光"与"远处渗色"问题；
- 采样三步：SAMPLE_GI→解码→Shadowmask 通道合并，与 SH 环境光在同一分支汇合。

## 自测问题

1. Shadowmask 模式下"角色影子哪来的"？为什么它不可能是烘焙的？
2. RGBM 的 mip 渗色问题的数学原因？（alpha 与 rgb 的相关性）
3. 一条灯带（10 盏小灯）在天花板装饰，选什么模式最省？理由？
4. Distance Shadowmask 的距离参数与第07章的 Shadow Distance 有什么关系？

---

*下一节：[04-LightProbe与ReflectionProbe](学习笔记/cg/tuanjie引擎/总览/第10章-全局光照/04-LightProbe与ReflectionProbe.md) —— 动态物体怎么"蹭"烘焙的光：SH 探针与四面体插值。*
