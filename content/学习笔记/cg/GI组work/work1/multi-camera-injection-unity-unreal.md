---
title: 为 Unity / Unreal 游戏注入额外相机 —— 引擎级方案
publish: true
updated: 2026-07-07T08:15:41.066Z
---

# 为 Unity / Unreal 游戏注入额外相机 —— 引擎级方案

> 目标：给定一个 **Unity 或 Unreal 引擎**的游戏包（Android 或 Windows），在正常游玩时额外注入若干"相机"。这些相机随主相机/游戏世界一起运动，各自渲染出独立视角，用于生成多视角 / 深度 / 语义数据集。
>
> 文档定位：**在已确认目标为 Unity/Unreal 的前提下**的针对性落地方案。它是《通过图形 API 拦截为游戏注入额外相机 —— 可行性研究》里"路线 A（引擎级注入）"的完整展开。若目标引擎未知或为闭源自研引擎，请回到那篇总文档。撰写日期 2026-07-07。

---

## 0. 一句话结论

**目标是 Unity/Unreal 时，走引擎级注入是最省事、质量最高的路线——直接在引擎逻辑层 new 一个相机，剔除 / LOD / 阴影 / 后处理全部由引擎为该相机独立正确处理，拿到的是"游戏原生质量"的第二视角。**

关键优势（相对图形 API 拦截）：
- **没有剔除空洞**：引擎会为每个新相机**独立跑视锥剔除 / 遮挡剔除 / LOD 选择**，附加相机看向任意方向都能看到该看到的东西。这是图形 API 层根本做不到的——那条路线里 CPU 端剔除在提交 GPU 前就完成了，附加相机偏离主视角就会看到空洞（见总文档 §7）。
- **视角相关效果正确**：阴影贴图 / CSM、后处理、反射探针都按新相机重算，不是主视角的错误复用。
- **附加相机可以真正自由**：环绕、俯拍、固定机位、任意朝向都成立，不受"必须与主相机视锥高度重叠"的小基线限制。
- **能直接导出 G-buffer 真值**：Unreal 的 SceneCapture 天然可输出 depth、world normal、object ID、语义等通道，是做数据集的理想来源。

**唯一前提**：能把托管代码 / 脚本注入进程，并且游戏没有强反作弊拦截注入（见 §7）。

---

## 1. 先判引擎与平台（阶段 0，约 0.5 天）

动手前必须确定三件事：**引擎、平台、注入可行性**。

### 1.1 判引擎

| 线索 | Unity | Unreal |
|---|---|---|
| Windows 文件 | `UnityPlayer.dll`、`GameAssembly.dll`（IL2CPP）、`*_Data/` 目录、`il2cpp_data/` | `*-Win64-Shipping.exe`、`*.pak` / `*.utoc` / `*.ucas`、目录里有 `Engine/`、`UE4`/`UE5` 字样 |
| Android（APK/AAB 内） | `lib/arm64-v8a/libunity.so`、`libil2cpp.so`、`assets/bin/Data/` | `lib/arm64-v8a/libUnreal.so` 或 `libUE4.so`、`*.pak` |
| 脚本后端 | Mono（`libmono*.so` / `mono-2.0-bdwgc.dll`）或 IL2CPP（无托管 DLL，全 AOT 编译进 `GameAssembly`/`libil2cpp`） | C++ 原生 + UObject 反射系统 |

> **Unity 的 Mono vs IL2CPP 决定注入难度**：Mono 后端可直接加载托管 DLL、反射调用，最省事；IL2CPP 是 AOT 编译成原生代码，需要靠 `global-metadata.dat` 还原符号（BepInEx/MelonLoader 都内置了 IL2CPP 支持，Il2CppInterop 会在运行时生成可调用的托管代理程序集）。

### 1.2 判平台

- **Windows**：工具生态成熟，GPU 余量大，实时多相机可行。**优先选这里做 PoC。**
- **Android**：注入更难（见 §6），GPU 吃紧，实时几乎只能挂 1 个低分辨率附加相机；**更适合离线数据生成**。但即便在 Android，引擎级注入（挂 mono 层）也远比 Vulkan layer 稳。

### 1.3 判注入可行性

- 有无反作弊（EAC / BattlEye / nProtect / 自研完整性校验）？**优先选单机 / 无反作弊游戏。**
- 有无代码混淆 / 加壳（Unity 常见 Beebyte、IL2CPP metadata 加密；UE 常见 pak 加密）？影响符号还原成本，不影响机制。

---

## 2. 方案总览：一张图

```
                ┌──────────────────────────────────────────────┐
                │              游戏进程（Unity / UE）            │
                │                                              │
   注入框架 ───▶│  1. 找到主相机（Camera / APlayerCameraManager）│
  (BepInEx /    │  2. new 附加相机，父挂到主相机或世界锚点         │
   MelonLoader /│  3. 各相机独立 targetTexture / RenderTarget    │
   UE4SS)       │  4. 每帧驱动相机运动（环绕 / 跟随 / 固定机位）    │
                │  5. 引擎自动为每个相机剔除 + 渲染               │
                │  6. 读回 RT（color/depth/normal/id）→ 落盘      │
                └──────────────────────────────────────────────┘
                                     │
                                     ▼
                       多视角数据集（color + depth + 内外参 + 语义）
```

三步骨架，Unity 与 Unreal 各有对应实现，下面分别展开。

---

## 3. Unity 落地方案

### 3.1 注入框架选型

| 框架 | 适用 | 特点 |
|---|---|---|
| **BepInEx** | Mono + IL2CPP（BepInEx 6 支持 IL2CPP） | 生态最大、文档全、`MonoBehaviour` 插件模型，推荐首选 |
| **MelonLoader** | Mono + IL2CPP | 对 IL2CPP 支持成熟，很多现代 Unity 游戏用它，二选一 |

两者都提供：进程启动早期加载托管插件、Harmony 运行时打补丁、Il2CppInterop（IL2CPP 下的托管代理）。

### 3.2 核心代码骨架（BepInEx 插件，概念示意）

```csharp
[BepInPlugin("com.seeddata.multicam", "MultiCam", "0.1.0")]
public class MultiCamPlugin : BasePlugin   // IL2CPP 用 BasePlugin；Mono 用 BaseUnityPlugin
{
    public override void Load()
    {
        // 挂一个每帧运行的组件
        AddComponent<MultiCamRunner>();
    }
}

public class MultiCamRunner : MonoBehaviour
{
    Camera main;
    readonly List<Camera> extras = new();
    readonly List<RenderTexture> rts = new();

    void Start()
    {
        // 1. 找主相机：优先 Camera.main（有 MainCamera tag），否则遍历 Camera.allCameras 取 depth 最大者
        main = Camera.main ?? Camera.allCameras.OrderByDescending(c => c.depth).First();

        // 2. 造附加相机
        foreach (var offset in CameraRig.Offsets)   // 你的机位定义
        {
            var go = new GameObject($"ExtraCam_{offset.name}");
            var cam = go.AddComponent<Camera>();
            cam.CopyFrom(main);                       // 继承 FOV/近远平面/裁剪层等
            cam.targetTexture = new RenderTexture(1920, 1080, 24, RenderTextureFormat.ARGB32);
            cam.enabled = true;                       // 引擎会在渲染循环里自动为它剔除+渲染
            cam.depth = main.depth - 1;               // 不抢主相机上屏
            extras.Add(cam);
            rts.Add(cam.targetTexture);

            // 3. 绑定运动：父挂到主相机，或世界锚点
            go.transform.SetParent(main.transform, false);
            go.transform.localPosition = offset.localPos;
            go.transform.localRotation = offset.localRot;
        }
    }

    void LateUpdate()
    {
        // 4. 程序化运动（如需环绕/跟随，在此更新每个 extra 的 transform）
        CameraRig.Drive(extras, main, Time.time);
    }
}
```

> **关键点**：`cam.enabled = true` 后，Unity 的渲染管线会在每帧自动把这个相机加入渲染队列，**为它独立做视锥剔除、阴影、LOD 选择**——这正是"无空洞"优势的来源，你不需要自己复制任何几何。

### 3.3 渲染管线差异（重要）

- **Built-in RP**：上面的 `Camera` + `targetTexture` 直接可用，最简单。
- **URP / HDRP（SRP）**：相机仍然照常创建，但渲染由 `RenderPipelineManager` 统一调度；如需按相机定制（例如关掉某些 pass、单独取 depth），用 `RenderPipelineManager.beginCameraRendering` / `endCameraRendering` 回调，或给相机加 `UniversalAdditionalCameraData` 配置。**先确认游戏用的是哪套 RP**（看是否有 `UniversalRenderPipelineAsset` / HDRP 资源）。

### 3.4 数据导出

- **同步读回**：`RenderTexture.active = rt; texture2D.ReadPixels(...); ReadPixels` → PNG/EXR。简单但会 stall GPU，适合离线。
- **异步读回**：`AsyncGPUReadback.Request(rt, ...)`，回调里拿 `NativeArray` 落盘，不阻塞主线程，实时优选。
- **深度**：设 `cam.depthTextureMode |= DepthTextureMode.Depth`，或在 SRP 里从 `_CameraDepthTexture` 取；导出为线性深度需按近远平面反投影。
- **相机内外参**：从 `cam.projectionMatrix`、`cam.worldToCameraMatrix` 直接读出，随每帧落盘，供下游（NeRF / 3DGS）使用。

---

## 4. Unreal 落地方案

### 4.1 注入框架选型

| 框架 | 语言 | 用途 |
|---|---|---|
| **UE4SS** | Lua + C++ | 运行时脚本 mod 框架，能访问 UObject 反射系统、调用蓝图/原生函数、生成 Actor/Component，首选 |
| **Dumper-7** | —— | 从游戏内存 dump 出完整 SDK（UObject/UFunction 偏移），供你写原生 C++ DLL 直接调用引擎函数，重型但最灵活 |

UE 是 C++ 原生引擎，没有 Mono 那样的托管层，所以注入本质是**通过反射系统（`UObject`/`UFunction`/`FName`）找到并调用引擎 API**。UE4SS 把这套封装好了。

### 4.2 加相机的两种方式

**方式一：`USceneCaptureComponent2D`（做数据集首选）**

`SceneCapture2D` 是 UE 原生的"离屏相机"，专门把场景渲染到 `UTextureRenderTarget2D`，且能直接输出多种 G-buffer 通道：

```
// 概念流程（UE4SS Lua / 原生 C++ 皆可）
1. 找到主相机锚点：APlayerController -> PlayerCameraManager -> GetCameraLocation/Rotation
2. SpawnActor(ASceneCapture2D) 或给现有 Actor 挂 USceneCaptureComponent2D
3. 创建 UTextureRenderTarget2D，赋给 SceneCapture 的 TextureTarget
4. 设 CaptureSource：
     - FinalColorLDR / FinalColorHDR  → 最终画面
     - SceneDepth                     → 深度真值
     - Normal / BaseColor             → G-buffer 通道
     - （配合 Custom Depth / Stencil 可导出 object ID / 语义分割）
5. 每帧把 SceneCapture 的 transform 跟随/偏移主相机
6. CaptureScene() 触发渲染 → 读回 RenderTarget → 落盘
```

> **数据集优势**：一个 SceneCapture 可切换 CaptureSource 分别取 color / depth / normal；配合 **Custom Depth Stencil**，能给不同物体打 stencil 值，直接导出**语义分割 / 实例 ID 真值**——这是 Unity Built-in 要额外费劲才能拿到的，UE 原生支持。

**方式二：额外 `APlayerCameraManager` / 视口相机**

若要的是"第二个真正的玩家视角"（含完整后处理、UI 之外），可生成额外的 camera manager 或操作 view target。比 SceneCapture 重，一般数据集用途用方式一即可。

### 4.3 相机运动绑定

每帧从 `PlayerCameraManager->GetCameraLocation() / GetCameraRotation()` 取主相机位姿作为基准，对每个附加 SceneCapture 施加偏移 / 环绕 / 固定机位变换。UE4SS 可 hook `Tick` 或某个每帧调用的 UFunction 来驱动。

### 4.4 数据导出

- `UTextureRenderTarget2D` → `FReadSurfaceData` / `ReadPixels` 读回，或用 `UKismetRenderingLibrary::ExportRenderTarget` 直接存盘。
- 内外参：从 SceneCapture 的 FOV、`GetViewProjectionMatrix` 及世界 transform 计算。
- 深度/法线/ID 各通道分别 CaptureSource 渲染后合并成一帧多通道数据。

---

## 5. 剔除问题为什么在这条路线上消失

总文档 §7 把"剔除"列为图形 API 拦截路线的**质量天花板**：主相机在 CPU 端提交 GPU 前就把视锥外 / 被遮挡 / 远距离的物体剔掉了，附加相机看向别处时那些物体从没进过绘制流 → 空洞。

**引擎级注入从根上绕开了这个问题**：你创建的相机是引擎渲染循环里的**一等公民**，引擎会：
- 为它**独立跑视锥剔除**——按它自己的视锥决定提交谁，不复用主相机的剔除结果；
- 为它独立做**遮挡剔除 / LOD 选择 / 阴影计算 / 后处理**。

所以附加相机可以自由朝向、环绕、俯拍，看到的永远是"这个视角本该看到的正确画面"。**这是选择 Unity/UE 目标时最大的收益**，也是本文档独立于总文档的核心理由。

> 唯一残留的注意点：极端性能优化的游戏可能全局关闭某些远处物体的生成（不是剔除，是根本没 spawn，比如开放世界的流式加载 / HLOD）。这类"物体不在场景里"的情况任何相机都拿不到，但这与剔除无关，且远比图形 API 路线的空洞问题少见。

---

## 6. Android 平台补充

引擎级注入在 Android 上依然优于 Vulkan layer，但有额外约束：

- **Unity（Android）**：
  - Mono 后端：可用 **BepInEx/MelonLoader 的 Android 移植**或自定义方案把托管 DLL 注入 `libmono`；相对可行。
  - IL2CPP 后端：需处理 `libil2cpp.so` + `global-metadata.dat`，可用 **LSPatch / Frida** 注入原生 hook 再调用 IL2CPP 导出函数。
  - 通用前置：多数商业 APK 是 release，注入常需**重打包（改 manifest / 塞 so / 重签名）** 或 **root**——会破坏签名校验、触发完整性检测。优先选可 root 的测试机或无校验的游戏。
- **Unreal（Android）**：C++ 原生，注入靠 Frida hook `libUnreal.so` 导出 + Dumper-7 还原偏移，比 Windows 麻烦。
- **性能**：手机 GPU（Adreno/Mali/PowerVR）跑多相机很贵，实时建议 ≤1 个低分辨率附加相机；**多视角 / 高质量数据集走离线**（让玩家/AI 把场景扫一遍，跨帧累积覆盖）。

> Android 现实建议：把它定位为**离线数据采集平台**，不追求实时多路。

---

## 7. 风险与注意事项

- **反作弊 / 完整性校验**：BepInEx/MelonLoader/UE4SS 的注入行为极易触发 EAC/BattlEye/nProtect 及自研校验，导致封号或崩溃。**只在单机 / 无反作弊游戏上做研究。**
- **IL2CPP / pak 加密**：Unity 的 metadata 加密、UE 的 pak 加密会增加符号还原 / 资源访问成本，但不改变机制可行性。
- **渲染管线适配**：Unity URP/HDRP、UE 的不同版本（UE4 vs UE5、是否 Nanite/Lumen）会让"取 depth / 关某些 pass / 语义 ID"的细节不同，PoC 前先确认版本与管线。
- **法律 / 授权**：修改游戏客户端、重打包、抓取渲染数据可能违反 EULA；用于数据集 / 商业用途需评估版权。仅在**授权范围内（自研游戏、拥有授权的素材、研究用途）** 开展。
- **性能倍增**：每多一个附加相机 ≈ 多一遍剔除 + 渲染负载（近线性）。实时 ≤1–2 个降分辨率相机；高质量 / 多路走离线。

---

## 8. 分阶段落地路线（PoC 建议顺序）

**阶段 0 — 定目标、判引擎与平台（0.5 天）**
判 Unity/UE、Mono/IL2CPP、Win/Android、渲染管线、有无反作弊。→ 见 §1。

**阶段 1 — 单个附加相机 PoC（1–2 天）**
- Unity：BepInEx 插件 `new Camera` → RenderTexture → 落一张图。
- UE：UE4SS + `SceneCapture2D` → RenderTarget → 落一张图。
- 验收：看到第二视角画面，且**朝向偏离主相机时无剔除空洞**（这是引擎路线的关键验证）。

**阶段 2 — 相机运动绑定（2–3 天）**
让附加相机相对主相机做程序化运动（环绕 / 跟随 / 固定机位），每帧稳定跟随世界。

**阶段 3 — 多相机 + 多通道（1 周）**
- 扩到 N 个机位；
- 导出 color + depth（+ UE 侧的 normal / object-id / 语义 stencil）；
- 异步读回避免 stall。

**阶段 4 — 数据集管线（持续）**
每帧落盘：各视角 color/depth/通道 + 相机内外参 + 时间戳，形成对标 Playing-for-Data / NeRF·3DGS 训练格式的多视角数据集。离线场景可多帧累积覆盖全场。

---

## 9. 与总文档的关系

| 维度 | 本文档（引擎级注入） | 总文档路线 B（图形 API 拦截） |
|---|---|---|
| 适用目标 | Unity / Unreal（引擎已知） | 任意 / 闭源自研引擎 |
| 剔除空洞 | **无**（引擎为每相机独立剔除） | 有（附加相机偏离主视角即空洞，是硬限制） |
| 相机自由度 | 任意朝向 / 环绕 / 俯拍 | 只宜小基线、与主相机视锥高度重叠 |
| 找相机矩阵 | 直接读引擎 API，无需逆向 | 逐游戏逆向定位 constant buffer，最耗人力 |
| 视角相关效果 | 引擎正确重算 | 复用主视角、不同程度失真 |
| 语义 / G-buffer 真值 | UE 原生支持，Unity 可得 | 难 |
| 工程量 | **低**，PoC 数天 | 高，闭源每款重做 |

**结论：目标一旦确认为 Unity/Unreal，本文档即为默认执行方案；只有当引擎未知或闭源时，才回退到总文档的图形 API 拦截路线。**

---

## 参考来源

- [BepInEx（GitHub）— Unity Mono/IL2CPP 插件框架](https://github.com/BepInEx/BepInEx) · [BepInEx 文档](https://docs.bepinex.dev/) · [Il2CppInterop](https://github.com/BepInEx/Il2CppInterop)
- [MelonLoader（GitHub）— Unity Mono/IL2CPP mod loader](https://github.com/LavaGang/MelonLoader)
- [Unity — Camera.targetTexture / RenderTexture](https://docs.unity3d.com/ScriptReference/Camera-targetTexture.html) · [AsyncGPUReadback](https://docs.unity3d.com/ScriptReference/Rendering.AsyncGPUReadback.html) · [SRP RenderPipelineManager 回调](https://docs.unity3d.com/ScriptReference/Rendering.RenderPipelineManager.html)
- [Unreal — USceneCaptureComponent2D](https://docs.unrealengine.com/API/Runtime/Engine/Components/USceneCaptureComponent2D/) · [Scene Capture / Capturing the Scene](https://dev.epicgames.com/documentation/en-us/unreal-engine/scene-capture-2d-in-unreal-engine) · [Custom Depth / Stencil（语义/ID 真值）](https://dev.epicgames.com/documentation/en-us/unreal-engine/custom-depth-in-unreal-engine)
- [UE4SS（GitHub）— UE 运行时脚本 mod 框架](https://github.com/UE4SS-RE/RE-UE4SS) · [Dumper-7（GitHub）— UE SDK dumper](https://github.com/Encryqed/Dumper-7)
- 剔除对照（说明本路线为何无空洞）：[Unity — Occlusion Culling / Frustum](https://docs.unity3d.com/Manual/UnderstandingFrustum.html) · 总文档《multi-camera-injection-feasibility.md》§7
