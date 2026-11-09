---
title: GBuffer 知识点详解
publish: true
updated: 2026-07-09T10:28:20.262Z
tags:
  - unity
  - graphics
  - deferred-rendering
  - gbuffer
  - hdrp
---


# GBuffer 知识点详解

## 1 一句话理解 GBuffer

> [!info] 核心概念
> GBuffer 是延迟渲染在第一趟渲染中拍下的"场景登记表"——每个像素的材质信息全部记到纹理里，第二趟算光照时直接读纹理，不再碰 3D 几何体。

---

## 2 延迟渲染的两趟

延迟渲染（Deferred Rendering）把渲染拆成两步：

```
第一趟：Geometry Pass（几何通道）
  画所有物体 → 不算光照 → 把材质信息写入 GBuffer

第二趟：Lighting Pass（光照通道）
  遍历每个像素 → 读 GBuffer → 算光照 → 输出最终颜色
```

### 为什么要拆成两趟

| | 前向渲染 | 延迟渲染 |
|---|---|---|
| 怎么算 | 画一个物体立刻算光照 | 先画所有物体存材质，再统一算光照 |
| 光照浪费 | 被遮挡的物体光照白算了 | 每个像素只算一次，零浪费 |
| 100 盏灯 | 物体数 × 100 次光照 | 每个像素读一次 GBuffer，批量算 |

> [!tip] 通俗类比
> 想象你是一个灯光师：
> - **前向渲染**：走进房间，看到桌子立刻算好打光涂上颜色，看到椅子又算一次……桌子挡住椅子，椅子的光白算了。
> - **延迟渲染**：先派助手给房间每个位置做一张"登记卡"（GBuffer），你拿到所有卡后再统一算光照。

---

## 3 GBuffer 存了什么

GBuffer 不是一张纹理，而是**一组纹理**。每张纹理跟屏幕一样大，每个纹素对应一个像素。

### 基本的 4 张纹理

| 纹理 | 存什么 | 通俗说 |
|---|---|---|
| **GBuffer0** | 漫反射颜色 + 遮蔽数据 | "这个点是什么颜色" |
| **GBuffer1** | 法线 + 感知粗糙度 | "这个点朝哪个方向、有多光滑" |
| **GBuffer2** | 材质特征参数 | "这个点是金属还是塑料、有没有清漆" |
| **GBuffer3** | 烘焙光照 + 自发光 + AO | "这个点自己发不发光、有没有预计算的光照" |

> [!note] 纹理数量可变
> GBuffer 的纹理数量是可变的。HDRP 基础配置用 4 张，如果开了光照层（Light Layers）、阴影遮罩（Shadow Mask）或虚拟纹理（VT），会多出额外的纹理。TuanjieGI 只用基础的 4 张。

### 每张纹理的格式

每张纹理都是 `float4`（RGBA 4 个通道），但存储格式不同：

| 纹理 | 格式 | 为什么 |
|---|---|---|
| GBuffer0 | R8G8B8A8 **sRGB** | 存颜色，sRGB 让暗部精度更高，符合人眼感知 |
| GBuffer1 | R8G8B8A8 **UNorm** | 存法线和粗糙度，物理数据不做 sRGB 转换 |
| GBuffer2 | R8G8B8A8 **UNorm** | 存材质参数，线性数据不做转换 |
| GBuffer3 | **R11G11B10** UFloat | 存 HDR 光照值（可能远超 1.0），需要浮点格式 |

> [!info] sRGB 和 UNorm 的区别
> - **sRGB 格式**：GPU 读写时自动做线性↔sRGB 转换，暗部分配更多精度
> - **UNorm 格式**：存什么就是什么，不转换

> [!note] GBuffer2 的特殊处理
> GBuffer2 需要存高光颜色时，因为自身是 UNorm，代码手动做 `FastLinearToSRGB()` / `FastSRGBToLinear()` 转换来获得和 GBuffer0 一样的精度优势。

---

## 4 各 GBuffer 纹理的通道详解

### GBuffer0 — 颜色 + 遮蔽

| 通道 | 标准材质 | SSS/透射材质 |
|---|---|---|
| RGB | 漫反射颜色（sRGB） | 漫反射颜色（sRGB） |
| A | specularOcclusion（镜面遮蔽） | subsurfaceMask + 扩散剖面ID（打包） |

> [!info] 漫反射颜色
> 就是物体在均匀白光照射下反射的颜色。木头棕色、金属灰色、墙漆白色。对金属来说，漫反射颜色接近黑色（金属几乎不产生漫反射）。

> [!info] specularOcclusion（镜面遮蔽）
> 表示"这个点的镜面反射有多少被周围几何体挡住"。角落里不仅漫反射间接光少，镜面反射也被挡。

### GBuffer1 — 法线 + 粗糙度

| 通道 | 内容 | 编码方式 |
|---|---|---|
| RGB | 世界空间法线 | 八面体编码 → 2D → 压缩到 3 字节 |
| A | 感知粗糙度（perceptualRoughness） | 直接存 float |

#### 八面体编码

法线是 3D 向量 `(x, y, z)`，但只有 2 个自由度（单位向量）。八面体编码把 3D 法线压成 2D：

```
3D 法线向量 (x, y, z)
    ↓  投影到八面体表面
2D 坐标 (u, v)
    ↓  映射到 [0,1]
2D 值
    ↓  PackFloat2To888
3 个字节（RGB）
```

> [!tip] 为什么不直接存 (x, y, z)？
> 直接存需要 3 个通道。八面体编码只用 2 个量就够，剩余 1 个通道可以存粗糙度。而且精度分布比球面映射更均匀。

#### 感知粗糙度 vs 粗糙度

```
perceptualRoughness（感知粗糙度）：艺术家调参用的，0~1 感知线性
roughness（物理粗糙度）：≈ perceptualRoughness²
```

> [!note] 为什么存 perceptualRoughness
> 8 bit 精度在感知线性空间分布更均匀。如果存 roughness（平方关系），低粗糙度区域调整不够灵敏，精度浪费。

### GBuffer2 — 材质特征参数

GBuffer2 是最复杂的——**不同材质类型在 RGB 通道存不同的内容**。材质类型由 Alpha 通道的低 3 bit 标识。

#### 材质类型枚举

| 值 | 材质类型 | 通俗解释 |
|---|---|---|
| 0 | Standard | 标准材质（非金属/金属） |
| 1 | SSS | 次表面散射（皮肤、蜡） |
| 2 | Transmission | 透射（薄叶子、玻璃） |
| 3 | Transmission+SSS | 透射 + 次表面散射 |
| 4 | Anisotropic | 各向异性（拉丝金属） |
| 5 | Iridescence | 虹彩（肥皂泡、油膜） |

Alpha 通道打包了两个值：`coatMask`（清漆遮罩，5 bit）和 `materialFeatureId`（材质类型，3 bit）。

#### 各类型在 RGB 存什么

| 材质类型 | R | G | B |
|---|---|---|---|
| Standard | fresnel0.r（高光颜色） | fresnel0.g | fresnel0.b |
| SSS/Transmission | specularOcclusion | thickness | 透射遮罩+剖面ID |
| Anisotropic | 各向异性程度 | 切线旋转角 | 金属度+标志 |
| Iridescence | 虹彩遮罩 | 虹彩厚度 | 金属度 |

> [!info] fresnel0（F0）是什么
> 法线方向入射时的反射率。非金属 F0 很低（2%~5%），金属 F0 就是材质颜色本身（70%~100%）。标准材质直接存 F0，金属材质在解码时从 baseColor + metallic 算出来。

> [!info] coatMask（清漆遮罩）是什么
> 表示表面有多少比例是透明清漆层。车漆 = 金属底色 + 透明漆面。coatMask > 0 时表面有效粗糙度会被清漆层修改。

### GBuffer3 — 烘焙光照 + 自发光

| 通道 | 常规情况 | SSGI/RTGI 模式 | 无光照时 |
|---|---|---|---|
| RGB | 烘焙光照×AO + 自发光 | 仅自发光 | AO 标记值 |
| A | 0 | 0 | 0 |

> [!note] 一个通道怎么存三样东西？
> 用标记值区分：
> - 烘焙光照+自发光 ≠ 0 → 直接存
> - 全为 0 → 存特殊标记值 (2048, _, 1024) + AO 值
>
> 解码时检查标记值就知道存的是光照还是 AO。

> [!info] 为什么用 11:11:10 浮点格式
> 烘焙光照和自发光是 HDR 值，可能远超 1.0。8 bit 整数最大只能存 1.0，会截断。11 bit 浮点能表示 0~65000+。

---

## 5 GBuffer 怎么生成

### 光栅化 + MRT

GPU 画三角形叫光栅化。GBuffer 的生成就是把场景画一遍，但**不算光照，只存材质**。

> [!info] MRT（Multiple Render Targets）
> 普通渲染的像素着色器只输出 1 个颜色。MRT 让像素着色器一次输出 4 个 `float4`，同时写入 4 张纹理：
> ```
> → SV_Target0 写入 GBuffer0（颜色+遮蔽）
> → SV_Target1 写入 GBuffer1（法线+粗糙度）
> → SV_Target2 写入 GBuffer2（材质特征）
> → SV_Target3 写入 GBuffer3（光照+自发光）
> ```

### 深度测试保证只留最前面

如果多个物体在同一像素重叠，深度测试（Z-Test）保证只有最近的物体写入 GBuffer：

```
像素 (50, 60)：
  画桌子（深度 10m）→ 写入 GBuffer
  画椅子（深度 15m）→ 更远 → 深度测试失败 → 不写入
  最终 GBuffer[50,60] 存的是桌子
```

> [!note] GBuffer1 就是 NormalBuffer
> 在 HDRP 中，GBuffer1 和 NormalBuffer 是**同一张纹理的两个名字**。法线和粗糙度通过 `EncodeIntoNormalBuffer()` 写入 GBuffer1。某些场景（Forward 渲染、Decal 贴花）不需要写完整 GBuffer，但需要写法线——这时单独写 NormalBuffer。

---

## 6 GBuffer 怎么被读取

### Lighting Pass 逐像素读

```
for 每个像素 (x, y):
    从 GBuffer0[x,y] 读到颜色
    从 GBuffer1[x,y] 读到法线、粗糙度
    从 GBuffer2[x,y] 读到材质特征
    从 GBuffer3[x,y] 读到自发光
    从 Depth[x,y] 读到深度 → 反推出 3D 世界坐标
    
    for 每盏灯:
        用法线 + 世界坐标 + 光源位置 → 算光照
    全部加起来 + 自发光 → 写入最终颜色
```

> [!tip] 并行执行
> GPU 上千万个像素**同时并行**做这件事，所以虽然逻辑是"一个一个像素过"，实际上是一瞬间全部算完。

### 解码后的 BSDFData

GBuffer 的 4 张纹理解码后得到一个完整的 `BSDFData` 结构体，包含材质的所有物理参数：

| BSDFData 字段 | 来自哪 | 通俗说 |
|---|---|---|
| diffuseColor | GBuffer0.RGB | 漫反射颜色 |
| normalWS | GBuffer1.RGB（八面体解码） | 世界空间法线 |
| perceptualRoughness | GBuffer1.A | 感知粗糙度 |
| fresnel0 | GBuffer2.RGB（标准）或 baseColor+metallic（金属） | F0 反射率 |
| specularOcclusion | GBuffer0.A | 镜面遮蔽 |
| coatMask | GBuffer2.A（高 5 bit） | 清漆遮罩 |
| ambientOcclusion | GBuffer3（标记模式）或默认 1.0 | 环境光遮蔽 |
| emissiveColor | GBuffer3.RGB | 自发光颜色 |

### TuanjieGI 怎么用 GBuffer

TuanjieGI 是在 Lighting Pass 之前/之后插入的 GI 计算阶段。它**不自己渲染几何体**，直接读 GBuffer：

| TuanjieGI 需要的 | 用途 |
|---|---|
| normalWS | 确定射线发射方向（半球采样、反射方向） |
| perceptualRoughness | 确定追踪粗糙度阈值（太粗糙的不做镜面追踪） |
| coatMask + featureFlags | 判断是否清漆特殊处理 |

> [!warning] TuanjieGI 不需要 diffuseColor
> 间接光的颜色来自射线命中点的材质，不是当前像素的材质。当前像素的 diffuseColor 用于直接光照计算（HDRP 的 Lighting Pass 负责）。

### HDRP vs URP 读取差异

| | HDRP | URP |
|---|---|---|
| 解码方式 | 调用 `DecodeFromGBuffer` 完整解码 24+ 字段 | 手动从 NormalBuffer 读法线+粗糙度 |
| 粗糙度 | 直接读 `bsdfData.perceptualRoughness` | `1.0 - normalBuffer.w`（存的是平滑度，取反） |
| 清漆 | 支持 | 不支持 |
| 材质标记 | 从 GBuffer2.A 解码 | 从 GBuffer0.w × 255 解码 |

---

## 7 GBuffer 在整个管线中的位置

```
HDRP 渲染管线：

  Geometry Pass
    │  画所有物体，不算光照
    │  通过 MRT 同时写入 GBuffer0~3
    │  同时生成 Depth Buffer
    ↓
  Motion Vector Pass
    │  生成运动向量纹理
    ↓
  ┌─ TuanjieGI Custom Pass ──────────────────┐
  │  读 GBuffer → 拿到法线、粗糙度             │
  │  读 Depth → 重建世界坐标                    │
  │  发射射线 → 追踪间接光                      │
  │  时序重投影 → 降噪                          │
  │  输出间接光纹理                             │
  └──────────────────────────────────────────┘
    ↓
  Lighting Pass
    │  读 GBuffer → 算直接光（Phong/BRDF）
    │  合成 TuanjieGI 的间接光
    │  输出最终颜色
    ↓
  后处理（色调映射、bloom 等）
```

---

## 8 关键概念速查

> [!summary] 速查表
>
> | 概念 | 一句话 |
> |---|---|
> | GBuffer | 延迟渲染第一趟存下的材质纹理组 |
> | MRT | 让像素着色器一次输出多个颜色到多张纹理 |
> | 八面体编码 | 把 3D 法线压成 2D 存储，省出一个通道 |
> | materialFeatureId | 3 bit 枚举，标识材质类型（标准/SSS/各向异性等） |
> | coatMask | 清漆遮罩，表示透明漆层的比例 |
> | perceptualRoughness | 感知粗糙度，艺术家友好的粗糙度参数 |
> | sRGB 格式 | GPU 自动做线性↔sRGB 转换，暗部精度更高 |
> | BSDFData | 从 GBuffer 解码后的完整材质参数结构体 |
> | Depth Buffer | 和 GBuffer 一起生成，不存 3D 位置但能反推 |
> | TuanjieGI 读 GBuffer | 只取法线+粗糙度+coatMask，不需要颜色 |

---

## 🏷️ 标签

#unity #graphics #deferred-rendering #gbuffer #hdrp
