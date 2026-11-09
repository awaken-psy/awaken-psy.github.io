---
title: 01 - 后处理栈与全屏 Pass
publish: true
updated: 2026-09-10T12:12:48.013Z
---

# 01 - 后处理栈与全屏 Pass

> 阅读时间：约 30 分钟
> 关键词：后处理、全屏三角形、Volume、RenderGraph、中间 RT 链

---

## 你将学到什么

- 后处理在管线里的位置与"为什么最后做"
- 全屏 Pass 的硬件形态（大三角形 vs 四边形）
- Volume/全局后处理配置的组织
- 中间 RT 链的内存-带宽账（RenderGraph 的动因）

---

## 1. 后处理：画面的"暗房"

3D 场景画完（几何+光照+阴影+GI）得到的**不是成片**，而是"底片"——一张 HDR 的、未加工的线性图。后处理（Post Processing）就是暗房冲洗：把"物理正确的底片"变成"有艺术意图的成片"：

```
底片（HDR, 线性, 可能锯齿/超亮/发闷）
  → 抗锯齿（去锯齿）
  → Bloom（光晕）
  → 景深/运动模糊（镜头感）
  → 曝光 + ToneMapping（把 HDR 压回可显示范围）
  → ColorGrading（调色）
  → 输出（sRGB/HDR10）
```

**为什么必须最后做**：效果（如 Bloom、调色）的输入是"完成态像素"；如果场景物体动态影响，顺序无法保证稳定。而后处理的成本模型是**与场景复杂度无关、只与分辨率挂钩**——固定费"画布层"。

## 2. 全屏 Pass 的硬件形态

后处理的 Pass 不画"几何"——它对整张图做数学。硬件上最常见三种形态：

**形态一：全屏三角形**
只提交一个覆盖整个视口的大三角形（顶点在 NDC 之外），PS 里用 `SV_Position` 反推 UV。**比四边形好的原因**：对角线没有那条斜边插值缝（quad 对角线的导数不对称问题），且只有一次图元装配。现代管线标配。

**形态二：Blit/Copy**
GfxDevice 的 Blit 接口（源图→目标图 + 可选缩放/格式转换）：引擎 `Runtime/Graphics/CopyTexture.cpp`、`LowerResBlitTexture.h`——很多"纯复制"（如 `_CameraOpaqueTexture` 的拷贝）走硬件专用路径（D3D12 的 CopyResource）几乎免费。

**形态三：Compute 全屏 Dispatch**
按 8×8 线程组分块跑——越来越主流（写入布局自由、可做 tile 内共享内存优化；第12章 compute 详述）。

**PS 里最常见的代码模式**（读懂一切后处理 shader 的钥匙）：

```hlsl
half4 Frag(float2 uv : TEXCOORD0) : SV_Target {
    half3 c = SAMPLE(uv);            // 中心
    half3 l = SAMPLE(uv - off);      // 邻居（off = 1/分辨率）
    ...
    return half4(c, 1);
}
```

## 3. 后处理的配置组织：Volume 与全局

**URP**：`Global Volume`（Scene）+ `Universal Additional Camera Data`（每相机开关与覆盖）。Volume Profile 装各效果组件（Bloom/ColorAdjustments/Vignette...），按相机配 override（优先级/混合距离——HDRP Volume 系统的简化版，第09章03篇）。

**两大类效果的分野**（配置面板的心理地图）：

| 需要"邻居像素"（卷积/重投影） | 只需要"本像素曲线" |
|---|---|
| Bloom、DoF、TAA、运动模糊、SSR | 曝光、ToneMap、调色、Vignette、噪点、色差 |
| 采样多次、带宽大 | 一次采样、极便宜 |

优化直觉：左列是移动端裁剪对象（第02类几乎白送）。

## 4. 中间 RT 链：后处理的"内存剧场"

每个效果（或一组）需要中间 RT（输入一张、输出另一张）。9 个效果可能产生十几张 RT：

```
sceneRT → [Bloom: 4张down/up] → [DoF: 2张] → [TAA: 1张+历史] → [ToneMap: 1张] → 屏
```

**1080p B16F 一张 ≈ 16MB**——不加管理就是"百 MB 剧场"。两级解法：

1. **人工分组**（老 URP 实践）：几个便宜曲线类效果合并进一个 Uber Post Pass（一次采样完成曝光+调色+暗角——`UberPost.shader` 的设计思想），卷积类各自 RT；
2. **RenderGraph（新）**：声明每 Pass 的读写，**自动算生命期与复用**——Bloom 的 mip 图与 DoF 的临时图可共享同一块显存（时间上不重叠）。

**移动端的现实**：游戏常把后处理整段**半分辨率执行再放大**（第09章 HDRP 体积块的同款思路）——Bloom 本来就是模糊效果，半分辨率无损观感、半价带宽。

> ⚠️ 后处理链的经典 bug 三连：① RT 格式不带 HDR（Bloom 看不见、高光被提前裁断——查 Camera/URP asset 的 HDR 开关）；② 线性/sRGB 标记错误（整画面发灰/过饱和——第01章色彩链的后半段错位）；③ 多 Pass 的 UV 采样起点错（directx 与 opengl 的 UV.y 方向历史差异，引擎宏 `UNITY_UV_STARTS_AT_TOP` 帮你兜）。

> 📁 **源码指引**：URP 后处理 C#：`Packages/com.unity.render-pipelines.universal/Runtime/RendererFeatures/PostProcessing/`（Pass 装配与 Uber 合并）；shader 侧 `Shaders/PostProcessing/*.shader`（每效果一个+Uber 总成）；HDRP 的完整 Volume 体系在 `Packages/com.unity.render-pipelines.high-definition/Runtime/PostProcess/`（ReferenceVolume 分块常量）。

---

## 小结

- 后处理=暗房：固定费的"画布层"，与场景复杂度无关；
- 全屏三角形是现代 Pass 形态；Blit 走硬件拷贝；compute 渐成主流；
- 效果二分法：邻居类（贵、可半分辨率）vs 曲线类（便宜、可 Uber 合并）；
- 中间 RT 链是后处理的内存主角——Uber 合并与 RenderGraph 是两级管理；
- 三连 bug：HDR 开关、sRGB 标记、UV 方向。

## 自测问题

1. 为什么 Bloom/DoF 可以半分辨率而调色不行？（信息论：模糊丢失的正是高频）
2. Uber Pass 合并的理论基础是什么？（同为"单采样曲线"，合并不增加带宽只减 Pass）
3. 后处理的成本为什么"与场景复杂度无关"？这一性质对预算意味着什么？
4. RT 的 B16F 与 ARGB32 一张 1080p 各多少 MB？10 张链不加管理是什么量级？

---

*下一节：[02-Bloom与ToneMapping](学习笔记/cg/tuanjie引擎/总览/第11章-后处理/02-Bloom与ToneMapping.md) —— 最出效果的两步：光晕与曝光曲线。*
