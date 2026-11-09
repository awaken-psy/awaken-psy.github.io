---
title: 04 - 现代 API 对比与平台后端图鉴
publish: true
updated: 2026-09-10T12:02:43.387Z
---

# 04 - 现代 API 对比与平台后端图鉴

> 阅读时间：约 40 分钟
> 关键词：D3D12、Vulkan、Metal、显式资源状态、绑定模型、团结平台后端

---

## 你将学到什么

- 传统 API 与现代 API 的五项代差（内存、同步、管线状态、绑定、错误检查）
- 各 API 的性格速写与适用平台
- 团结引擎的平台后端全景（含 WeixinMiniGame、OpenHarmony 等特色平台）
- 对"选择图形 API"的实践判断力

---

## 1. 代差全景：五个维度看 API 演进

第02篇说现代 API"显式暴露一切"。具体显式在哪？五个维度，一张大表：

| 维度 | 传统（D3D11/GLES） | 现代（D3D12/Vulkan/Metal） |
|---|---|---|
| **内存** | 驱动分配管理 | 应用分配、管理堆、跟踪生命周期 |
| **资源状态** | 驱动自动跟踪与同步 | 手工 barrier：谁写→谁读，你要声明 |
| **管线状态** | 即时设置，驱动动态组合 | 预先烘焙 PSO（不可变整体） |
| **命令** | 即时调用 | 录制到 CommandList，可复制重放 |
| **错误处理** | 驱动静默修复 + 黑盒 | 核验层/调试层显式报错，错误直接崩 |

### 1.1 资源状态与 Barrier：现代 API 的核心新概念

同一块纹理，"正在被渲染写入"（RT）与"正在被采样读取"（Shader 资源）在硬件层面是不同的缓存/压缩/布局状态。传统 API 驱动自动判断并插同步；现代 API 要求**你**声明每次用途切换：

```
"Albedo RT" 写入完成
   → barrier: COLOR_ATTACHMENT → SHADER_READ
   → 后续 Pass 才能安全采样它
```

忘声明 → 竞态：后一个 Pass 可能读到"半旧半新"的纹理（画面闪烁、黑块）。这就是"现代 API 画面难调试"的根源——**不是性能差，是把驱动干过的脏活还给你了**。

### 1.2 绑定模型：从"插槽"到"表/堆"

传统 API 绑定资源像插线板：纹理进 0 号槽、常量进 1 号槽，每 Draw 逐个重插。现代 API 建一张**描述符堆/表（Descriptor Heap / Argument Table）**：资源引用打包成数组，着色器按索引取。一次绑定整组、切换成本极低——SRP Batcher 的高效底气之一（第05章）。

### 1.3 PSO：状态提前固化

现代 API 把光栅化+深度+混合+着色器组合成**一次创建、反复使用**的不可变对象。代价：创建贵（一次几百微秒）、组合爆炸需要缓存；收益：Draw 时零状态校验开销。这解释了引擎为何"PSO 缓存"这么重要（第02篇的"状态组合哈希"）。

## 2. 各 API 性格速写

**D3D11（2010，传统）**——稳定成熟的"老黄牛"。桌面兜底方案。驱动做主、兼容极广，但 DrawCall CPU 成本高。团结引擎 Windows 老平台/低配仍可用它。

**D3D12（2015，现代）**——Windows/Xbox 的现代王座。PSO+命令队列+显式同步。多线程录制、驱动开销极小。Xbox 系（含 GameCore、Switch2 等）全部基于此模型。

**Vulkan（2016，现代）**——跨厂商的现代标准。概念最全（队列族、分层显存、swapchain 细节全暴露），也最啰嗦。**Android 高端、Linux、部分国产平台（含 OpenHarmony）**走它。团结在安卓上 Vulkan 支持成熟， GLES 仍为兜底。

**Metal（2014，现代）**——苹果的答案。设计"最现代"（比 Vulkan 晚两年）且更克制：命令编码器按用途分段、资源自动跟踪起步。iOS/macOS/visionOS 唯一选择。

**GLES 3.x（传统）**——移动端的"事实兜底"，覆盖所有安卓机器。驱动质量参差、每 DrawCall 开销大 → 移动端"减 DrawCall"的优先级极高。

**WebGL2（传统）**——浏览器沙箱内的 GLES。Emscripten 把 C++ 翻译成 JS/WASM；无 compute（WebGL2 无）、共享上下文限制多。**团结的微信小游戏后端正是这一支的变体**——面向微信运行时做了资源/内存与纹理压缩的专门适配。

## 3. 团结引擎的平台后端图鉴

```
Runtime/GfxDevice/
├── d3d11/      → Windows 老配置、兼容模式
├── d3d12/      → Windows 现代默认、Xbox/GameCore/Switch2 系
├── vulkan/    → Android 高端、Linux、OpenHarmony(配合 HarmonyOS NDK)
├── metal/      → 全苹果系（iOS/OSX/visionOS/AppleTV）
├── opengl/     → 桌面 OpenGL（兜底/CI）
├── opengles/   → Android/部分嵌入式的兜底
├── threaded/   → 横跨一切的命令流层（第03篇）
└── fake/       → 无 GPU 环境模拟（自动化测试/CI 冒烟）
PlatformDependent/
├── WebGLPlayer/          → WebGL2（Emscripten 工具链）
├── WeixinMiniGamePlayer/ → 微信小游戏（团结重点平台，WebGL 变体+专用渲染适配）
├── OpenHarmonyPlayer/    → 鸿蒙（vulkan/gles 后端选择）
├── HMIAndroidPlayer/     → 车机 Android
└── EmbeddedLinuxPlayer/  → 嵌入式 Linux
```

几个团结特色平台的实践要点：

- **微信小游戏**：受限于小游戏运行时，纹理压缩与内存预算极紧（首包 4MB 级别），后端围绕 WebGL2 + ASTC/ETC2 + 强力的剔除/合批展开——URP 面向它有专门变体（`WeixinMiniGame` URP 配置）；
- **OpenHarmony**：跟随鸿蒙系统 GPU 生态（主流芯片栈），D3D12 不可用，路线是 Vulkan/GLES；
- **HMI 车机**：芯片老、分辨率大、常驻帧率要求——传统 API（GLES）路径优化更受重视；
- **QNX/EmbeddedLinux**：无桌面级 GPU，嵌入式图形栈，抽象层再次证明价值——同一引擎核心直接落新平台。

## 4. 实践判断力：什么时候在乎 API 选择

给新手三把尺子：

1. **DrawCall 规模**：>2000 DrawCall 的桌面项目，现代 API（D3D12/Vulkan）的传统优势（CPU 端开销低）才明显；移动端无论哪代 API，先减 DrawCall 再谈其他；
2. **平台边界**：目标平台能用的 API 只有 1~2 个（苹果=Metal，微信=WebGL2），选择余地远小于桌面上看起来那么大——**引擎的抽象层把这种不可选变成"无感"**；
3. **驱动差异**：同是 GLES，高通/ARM/IMG 的驱动行为（尤其 mip/精度/同步）微差多——引擎后端里各家的 workaround 补丁比标准实现还长，遇到"某机型专属 bug"先查已知 workaround 列表。

## 5. 第03章总结：引擎架构层的心智模型

```
游戏/组件层（声明）
   ↓ 剔除+合批（C++，脏标记/包围盒，第04章）
渲染核心（C++：Renderer/材质引用/内置参数）
   ↓ GfxDeviceClient 录制命令
命令流（主线程录 → 渲染线程回放）
   ↓ GfxDevice 接口 → 各 API 后端
图形 API（传统即时 / 现代显式）
   ↓ 驱动
GPU 硬件（第02章的图形管线）
```

**贯穿三章的一条主线**：从"声明"到"硬件"，每往下一层，数据都被加工得更接近机器——组件→可渲染集→合批命令→API 调用→硬件操作。引擎的一切渲染优化，本质上都是在**减少"每层间数据量的膨胀"**：剔除减少物体数、合批减少命令数、状态缓存减少 API 调用数、命令流减少主线程占用。

> 📁 **源码指引**：各后端入口在 `Runtime/GfxDevice/<api>/` 各自的 `GfxDevice*.cpp`（如 `d3d12/GfxDeviceD3D12.cpp`、`vulkan/GfxDeviceVulkan.cpp`）；平台的构建装配在 `Platforms/<平台>/`；`GfxVersionList.cpp` 记录各 API 支持版本的表（引擎启动时按它选后端）。

---

## 小结

- 五项代差：内存、资源状态、PSO、命令、错误处理——现代 API 的"显式"含义；
- Barrier 是现代 API 最核心的新概念（状态切换必须声明）；
- 描述符表/堆替代逐插槽绑定 → 批量绑定 → SRP Batcher 的土壤；
- 各 API 性格与平台绑定：D3D12/Win+Xbox、Vulkan/安卓高端+鸿蒙、Metal/苹果、GLES/兜底、WebGL2/小游戏；
- 团结特色平台（微信小游戏、OpenHarmony、HMI）全部共享同一抽象层。

## 自测问题

1. Barrier 缺失会导致什么现象？为什么传统 API 不需要你写 barrier？
2. PSO 为什么创建贵、使用便宜？"组合爆炸"指什么？
3. 描述符堆相对"逐槽绑定"，为什么让 SRP Batcher 更可行？
4. 一款手游（安卓）想从 GLES 切 Vulkan，你要权衡哪些因素？（驱动成熟度/机型覆盖/特性差异）

---

*第03章完。架构层通关！接下来第04章深入"剔除与提交"——引擎性能的第一道闸门。*
