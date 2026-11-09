---
title: Advancing World Simulation With 3D Gaussian Splatting — 课程资料汇总
publish: true
updated: 2026-09-22T08:10:52.399Z
---

# Advancing World Simulation With 3D Gaussian Splatting — 课程资料汇总

> 利用 3D 高斯泼溅推进大规模环境重建的世界模拟（SIGGRAPH 2026 · NVIDIA Hands-on Lab）
> 资料整理日期：2026-09-21

---

## 📌 课程基本信息

| 项目 | 内容 |
|---|---|
| **标题** | Advancing World Simulation With 3D Gaussian Splatting for Large-Scale Environment Reconstruction |
| **会议** | SIGGRAPH 2026（2026年7月19–23日，Los Angeles Convention Center） |
| **形式** | Hands-on Lab（动手实验室，自带笔记本和鼠标，席位有限先到先得） |
| **时间/地点** | 2026年7月23日（周四）12:00–1:30 PM PDT，Concourse Hall |
| **讲师** | Zoë LaLena（NVIDIA 解决方案架构师）、Francis Williams（NVIDIA 空间智能实验室高级科学家，fVDB 核心架构师） |
| **DOI** | 10.1145/3799820.3812508（SIGGRAPH Courses '26 论文集，Article No. 30，Pages 1–2，2026年8月13日出版） |
| **关键词** | Gaussian Splatting、object segmentation、robotic simulation |
| **核心技术** | NVIDIA fVDB 框架 + NVIDIA Omniverse NuRec → 重建真实世界大规模场景 → NVIDIA Isaac Sim 机器人仿真 |

### 课程大纲（三大环节）

1. **3DGS 重建**：现实捕捉与数据准备（含 SfM / Structure-from-Motion），使用 NuRec 的 fVDB pipeline 训练 3D Gaussian Splatting 场景（100–200 张图像即可完成真实场景重建）
2. **场景分割**：训练分割模型提取场景中的物体，为原重建场景添加更多障碍物与内容资产
3. **机器人仿真**：将重建结果与分割物体导出为 mesh 和 USD 资产，导入 Isaac Sim / Isaac Lab，配置 Spot 机器人进行导航仿真（现场在 DLI 虚拟桌面中实操）

其他主题：数据采集最佳实践；fVDB 中的 SfM 与 3DGS；大规模场景扩展；可选的分割与清理；mesh 与 USDZ 导出；与 Isaac Sim 的机器人仿真集成；NuRec 与 fVDB 如何支持城市级室外重建及其与 Physical AI / 机器人测试的联系。

---

## 🎬 课程回放（最接近 Lab 本身，免费，需 NVIDIA 账号）

| 版本 | 链接 | 说明 |
|---|---|---|
| **GTC San Jose 2026** | <https://www.nvidia.com/en-us/on-demand/session/gtc26-dlit81757> | 编号 DLIT81757，同一门 DLI Lab；selfshadow 汇总页标注的本课程材料出处 |
| **GTC DC 2025** | <https://www.nvidia.com/en-us/on-demand/session/gtcdc25-dct51174> | 编号 DCT51174，早期版本，含 Francis Williams 的 fVDB 现场演示 |
| SIGGRAPH Asia 2025 同名 Lab | <https://www.linkedin.com/posts/nvidia-omniverse_advancing-world-simulation-with-3d-gaussian-activity-7403913304630476800-mFgs> | NVIDIA Omniverse 官方 LinkedIn 宣传帖 |

> ⚠️ NVIDIA On-Demand 页面需登录（免费 NVIDIA Developer 账号）后才能加载视频和材料下载区。

---

## 📄 官方页面

- **ACM Digital Library 课程页**（正式出版物，含摘要）：<https://dl.acm.org/doi/10.1145/3799820.3812508>
- **SIGGRAPH 2026 官方日程页**（本课程条目）：<https://s2026.conference-schedule.org/presentation?id=gensub_123&sess=sess257>
- **SIGGRAPH 2026 官网**：<https://s2026.siggraph.org>
- **SIGGRAPH 2026 Courses 板块页**（含材料提交与出版规则）：<https://s2026.siggraph.org/program/courses>
- **SIGGRAPH 2026 Links（selfshadow 汇总页，社区维护的全会议材料索引）**：<https://blog.selfshadow.com/2026/07/26/siggraph-2026-links>

---

## 🛠️ 实操材料（Lab 三大环节对应的公开资源）

### Part 1 — 数据采集 + 3DGS 重建（fVDB / NuRec pipeline）

| 资源 | 链接 | 说明 |
|---|---|---|
| **NuRec 官方主页** | <https://developer.nvidia.com/omniverse/nurec> | Download / Documentation / Agent Skills 入口；NuRec 库以 OpenUSD 为中心，集成 Isaac Sim（机器人）与 AlpaSim/CARLA（自动驾驶） |
| **Isaac Sim 开发者主页** | <https://developer.nvidia.com/isaac/sim> | 含 "Neural Reconstruction and Rendering Starter Kit"（本 Lab 工作流的官方公开版） |
| **数据集 nvidia/PhysicalAI-Robotics-NuRec** | <https://huggingface.co/datasets/nvidia/PhysicalAI-Robotics-NuRec> | Lab 用的真实采集数据：Nova Carter、苏黎世室内场景、iPhone 手持、双目手持数据集（gated，需 HF 登录 + 同意许可） |
| 数据集 nvidia/PhysicalAI-Autonomous-Vehicles-NuRec | <https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles-NuRec> | 1500+ 神经重建驾驶场景（AV 方向，USDZ + xodr） |
| **Physical AI 数据集合集** | <https://huggingface.co/collections/nvidia/physical-ai> | NVIDIA 全部 Physical AI 开放数据集合集 |
| **NGC Neural Reconstruction Container** | 在 NGC Catalog 搜索 "Neural Reconstruction Container"（版本 26.04.01） | NuRec 官方容器，多 GPU 分布式训练支持 |

### Part 2 — 场景分割与资产导出

| 资源 | 链接 | 说明 |
|---|---|---|
| **3DGUT 代码库 nv-tlabs/3dgrut** | <https://github.com/nv-tlabs/3dgrut> | 3DGS 训练 + USDZ/mesh 导出；Isaac Sim 官方推荐的 Gaussian 训练/导出工具（3DGUT：支持畸变相机与二次光线） |
| **NVIDIA/nurec-skills** | <https://github.com/NVIDIA/nurec-skills> | Coding agent 技能包：下载 Physical AI 数据集、NuRec 渲染、Harmonizer 帧精修 |
| **fVDB（已并入 OpenVDB）** | <https://github.com/AcademySoftwareFoundation/openvdb> | Francis Williams 维护；v0.6.0 起 Gaussian Splatting API 移入 fVDB Reality Capture（含 `frgs` 命令行工具与详细教程） |

### Part 3 — Isaac Sim 机器人仿真（Spot 导航）

| 资源 | 链接 | 说明 |
|---|---|---|
| **Isaac Sim 6.0 NuRec 官方示例文档** | <https://docs.isaacsim.omniverse.nvidia.com/6.0.0/assets/usd_assets_nurec.html> | 含完整脚本 + Hugging Face 数据集下载步骤；`NuRec Carter NavigationScene` 示例即 Lab 仿真环节的公开版 |
| CARLA + NuRec 集成指南 | <https://carla.readthedocs.io/en/latest/nvidia_nurec> | NuRec 神经重建数据在 CARLA 中的使用（AV 方向延伸） |
| Isaac Sim / Isaac Lab GitHub | 从 Isaac Sim 开发者主页（developer.nvidia.com/isaac/sim）"Get Started" 进入 | 开源仿真与学习框架 |

---

## 📝 配套教程与延伸阅读

### NVIDIA 官方技术博客

- **《How to Instantly Render Real-World Scenes in Interactive Simulation》**：<https://developer.nvidia.com/blog/how-to-instantly-render-real-world-scenes-in-interactive-simulation>
  （采集 → COLMAP → 3DGUT 训练 → USD 导出 → Isaac Sim，与 Lab 流程完全一致的 step-by-step 教程）
- 《Scale AV Perception Across Vehicle Platforms with NVIDIA Omniverse NuRec》：<https://developer.nvidia.com/blog/scale-av-perception-across-vehicle-platforms-with-nvidia-omniverse-nurec>
- 《Building Spatial Intelligence from Real-World 3D Data Using Deep-Learning Framework fVDB》：<https://developer.nvidia.com/blog/building-spatial-intelligence-from-real-world-3d-data-using-deep-learning-framework-fvdb>
- 《Reconstruct a Scene in NVIDIA Isaac Sim Using Only a Smartphone》（见 NuRec 主页/Starter Kit 引用，智能手机采集重建入门）

### 视频

- 《Build Photorealistic Isaac Sim Environments with Gaussian Splatting》（2026年1月直播，演示 fVDB Reality Capture pipeline + 3DGRUT 转换 + 导入 Isaac Sim）：<https://www.youtube.com/watch?v=DYeutmDZOyI>
- 《NuRec and Isaac Sim》Robotics Office Hours（含 Isaac Lab / Isaac Sim / NuRec 资源链接汇总）：<https://www.youtube.com/watch?v=ybtJxQbj2NE>
- 《NVIDIA's 3DGS Pipeline Processes 100M+ Gaussians AND Render in Browser!》（GTC DC 对 Francis Williams 的采访，fVDB 实操演示：177 张无人机照片 → 3DGS + mesh）：<https://www.youtube.com/watch?v=ZnhBGmHyJqM>
- 《Neural Reconstruction for Robotics and Autonomous Vehicles》（SIGGRAPH 2025 官方演示视频）：<https://www.youtube.com/watch?v=e3dfXj6ATA0>
- 《3D Gaussian Splatting for Autonomous Vehicle Simulation》（NuRec Fixer / Asset Harvester / Harmonizer 演示）：<https://www.youtube.com/watch?v=IV4zYkYsu7I>

### 第三方分析文章

- 《NVIDIA's Isaac Sim 6.0 Ships With NuRec Gaussian Splatting》：<https://radiancefields.com/nvidia-s-isaac-sim-6-0-ships-with-nurec-gaussian-splatting>
- 《NVIDIA Announces NuRec Gaussian Splatting Libraries at SIGGRAPH》：<https://radiancefields.com/nvidia-announces-nurec-libraries-at-siggraph>

---

## 👥 讲师信息

### Francis Williams
- NVIDIA 空间智能实验室高级科学家（Senior Research Scientist，NYC），fVDB 核心架构师/维护者
- 个人主页（NVIDIA Research）：<http://research.nvidia.com/labs/prl/author/francis-williams>
- 个人网站/出版物：<https://fwilliams.info/publications.html>
- GitHub：<https://github.com/fwilliams>
- LinkedIn：<https://www.linkedin.com/in/francis-williams>
- 代表论文：《fVDB: A Deep-Learning Framework for Sparse, Large-Scale, and High-Performance Spatial Intelligence》（SIGGRAPH 2024）
- 开源项目：fVDB、Point Cloud Utils、NumpyEigen（OpenVDB 贡献者/维护者）

### Zoë LaLena
- NVIDIA 解决方案架构师（Solutions Architect，Santa Clara）
- ACM 作者信息：<zlalena@nvidia.com>（见 ACM DL 课程页）

---

## 🔗 相关课程（SIGGRAPH 2026 Hands-on Courses）

- 《NVIDIA: From 3D Captures to Simulated Digital Environments》
- 《NVIDIA: Beyond 3D: From Real-World Objects to Digital Assets and Physical AI》（Kaolin Library：捕获到仿真管线、物体分割、体积机械属性预测、splat-mesh 混合物理仿真）
- 《Accelerate Robot Learning With NVIDIA Isaac Lab and Newton》（GTC）

---

## 🧭 建议学习路径

1. **看回放过流程**：登录 NVIDIA On-Demand，观看 GTC San Jose 2026 的 DLIT81757 完整 Lab 录像（辅以 GTC DC 2025 版本中 fVDB 实操演示）
2. **跑通仿真环节**：按 Isaac Sim 6.0 NuRec 示例文档，从 Hugging Face 下载 `PhysicalAI-Robotics-NuRec` 数据集，在 Isaac Sim 中加载重建场景并运行 Carter 导航
3. **从头重建自己的场景**：用手机/相机采集 100–200 张照片 → COLMAP SfM → 用 3dgrut（3DGUT）或 NGC 的 Neural Reconstruction Container 训练 → 导出 USDZ → 导入 Isaac Sim
4. **进阶**：fVDB Reality Capture（`frgs` 命令行）处理大规模场景；用 nurec-skills 的分割/资产工作流为场景添加可交互物体

---

## ⚠️ 备注

- 现场使用的 **DLI 虚拟桌面环境会后不公开**，以上公开资源覆盖同样的工作流内容。
- ACM DL 收录的本课程条目为 **2 页 extended abstract**；完整课件以 GTC On-Demand 为主（SIGGRAPH 2026 Courses 规则中补充材料会在会后交付 ACM DL，可留意课程页更新）。
- Hugging Face 数据集为 **gated**：需登录 HF 账号、同意许可条款并使用 token 下载。
- Isaac Sim 6.0（2025年6月 GA，Kit 110）起原生支持 NuRec 3DGS 渲染；数据集版本需与 Isaac Sim 版本对应（HF 上按 Git tag 区分）。

---

## 🚀 附录：本地复现执行指南（本机评估，2026-09-21）

> **本机配置**：NVIDIA GeForce RTX 5060 Ti（8GB，Blackwell，驱动 616.64）
> 结论：满足 Isaac Sim 最低要求（8GB + RT Core 的 RTX 卡），**可跑通全流程**；CUDA 12.8 覆盖 Blackwell 架构。

### A. 硬件评估

| 环节 | 要求 | 评估 |
|---|---|---|
| 3DGS 训练 | 最低 12GB 显存（推荐 24GB），带 RT Core | ⚠️ 8GB 偏紧：场景控制在 **100–250 张图**，必要时降低分辨率；中小场景可行 |
| Isaac Sim 6.0 | 最低 RTX 3070 / 8GB，需 RT Core（A100/H100 反而不支持） | ✅ 达标；基础示例流畅，超大场景会吃紧 |
| 其他 | 16GB+ 内存、50GB+ 磁盘 | 自查内存/磁盘 |

> 显存不够时的替代：租云 GPU（A100 80GB 约 $1.10/小时；300 张图场景全流程约 $0.83）

### B. 工具清单（按三环节）

| 环节 | 工具 | 获取 |
|---|---|---|
| **0. 采集** | 手机相机拍 100–200 张环绕照片（Lab 官方推荐量） | 自备 |
| **1. 重建** | COLMAP（SfM 求相机位姿，Windows 预编译包）；3DGUT `nv-tlabs/3dgrut`（训练 + playground 可视化 + USDZ 导出；Windows 用 UV 安装脚本；CUDA 11.8–12.8） | <https://colmap.github.io> · <https://github.com/nv-tlabs/3dgrut> |
| **2. 分割/资产** | NVIDIA/nurec-skills（Asset Harvester 物体提取、Harmonizer 修帧）或 SAM 系分割工具 | <https://github.com/NVIDIA/nurec-skills> |
| **3. 仿真** | Isaac Sim 6.0（Windows 原生版可用；容器版仅 Linux）；Isaac Lab（Spot/Carter 导航）+ HF 账号 token | <https://developer.nvidia.com/isaac/sim> |
| 基础环境 | CUDA Toolkit ≥12.8（Blackwell 必须）、Python/uv、约 50GB 磁盘 | — |

### C. 数据集选择

| 数据集 | 内容 | 说明 |
|---|---|---|
| ⭐ nvidia/PhysicalAI-Robotics-NuRec | Nova Carter、苏黎世室内（iPhone/lounge）、双目手持场景 | 与 Lab 直接对应；按与 Isaac Sim 版本匹配的 Git tag 下载 |
| nvidia/PhysicalAI-Autonomous-Vehicles-NuRec | 1500+ 驾驶场景（USDZ + xodr 地图） | AV 方向延伸 |
| 自采数据 | 手机环绕拍 100–200 张 | Lab 原始方法，效果最直观 |
| 公开基准 | Mip-NeRF 360、Tanks & Temples（COLMAP 格式） | 3DGUT/fVDB 均直接兼容 COLMAP 数据 |

### D. 效果预期

- **重建质量**：摄影级真实感新视角合成，实时 60fps+（1080p 可达 100+ FPS）
- **速度参考**：146 张图 → 200 万 Gaussians ≈ 9 分钟（展示级 GPU）；300 张室内图 COLMAP+训练全流程 A100 约 45 分钟；**本机中小场景预计 1–2 小时**
- **最终成果**（Lab 的终点）：
  1. 把拍摄的真实场景变成可交互的 USD/USDZ 资产（含 mesh + splat）
  2. 在 Isaac Sim 里让 **Spot 四足机器人 / Carter 在这个"照片级真实"的场景中导航、避障**
  3. 分割出的物体可增删，把场景改造成测试关卡
  4. 可用于机器人训练的合成数据生成、sim-to-real 测试

### E. 三天执行路径（最小可行）

1. **第1天见效**：装 Isaac Sim 6.0 → HF 下载 `PhysicalAI-Robotics-NuRec` 数据集 → 跑通官方 `NuRec Carter NavigationScene` 示例（直接体验终点效果）
2. **第2天**：装 COLMAP + 3dgrut → 用 Zurich iPhone 数据（或自拍一组）训练 → 导出 USDZ
3. **第3天**：把 USDZ 导入 Isaac Sim，加地面和碰撞体 → 放 Spot 跑导航

---

## 🧪 附录二：本地复现实录（2026-09-22，已全流程跑通）

> 本机：RTX 5060 Ti 8GB · Windows · CUDA v12.1/v13.3 原有 → **补装 v12.8** · VS 2022 BuildTools + VS 2026
> 结论：**全流程可在本机跑通**——训练 22 分钟 / 30K 迭代完成 Bonsai 重建。

### 1. 环境搭建（实际执行的命令）

```powershell
# ① 克隆仓库 + 子模块
git clone https://github.com/nv-tlabs/3dgrut.git
cd 3dgrut
git submodule update --init --recursive

# ② 安装 CUDA 12.8（winget 无法与已有 CUDA 并存，改用官方 CDN 直链 + 静默安装，只装 toolkit 不动驱动）
# 下载: https://developer.download.nvidia.com/compute/cuda/12.8.0/local_installers/cuda_12.8.0_571.96_windows.exe
# 安装: .\cuda_12.8.0_571.96_windows.exe -s   （会弹一次 UAC）

# ③ 运行官方安装脚本（必须用 PowerShell 7！5.1 有原生命令传参 bug 会毁掉内嵌 Python 代码）
$env:CUDA_HOME = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8"
pwsh -NoProfile -ExecutionPolicy Bypass -File .\install_env_uv.ps1
```

### 2. 下载 Bonsai 数据集（真实照片，COLMAP 格式）

```powershell
# HuggingFace 第三方镜像，标准 mipnerf360 布局（images_2/4/8 + sparse/）
uvx --from "huggingface_hub[cli]" hf download alexmkwizu/gaussian_training_datasets `
  --repo-type dataset --include "mipnerf360/bonsai/*" --local-dir .\data
# 结果: data/mipnerf360/bonsai/，292 张图，1.34GB
```

### 3. 训练 + 产物

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -Command ". .\.venv\Scripts\Activate.ps1; python train.py --config-name apps/colmap_3dgut.yaml path=data/mipnerf360/bonsai out_dir=runs experiment_name=bonsai_3dgut dataset.downsample_factor=4 export_usd.enabled=true"
```

| 产物（`runs\bonsai_3dgut\bonsai-2209_141721\`） | 说明 |
|---|---|
| `ours_30000\ckpt_30000.pt`（947MB） | 最终模型，喂给 playground/render.py |
| `export_last_lightfield.usdz`（312MB） | **USD ParticleField 资产，可导入 Isaac Sim 6.0** |
| `ours_30000\renders\*.png` | 37 张测试视角渲染 |
| `renders_all\bonsai-2209_160411\` | render.py 渲染：gt/ 与 renders/ 各 37 张对照 |

训练指标：测试视角 PSNR 33–36 dB；30K 迭代约 22 分钟（downsample_factor=4 适配 8GB 显存）。

### 4. 查看结果

```powershell
# 交互式查看（打补丁后可用）
pwsh -NoProfile -ExecutionPolicy Bypass -Command ". .\.venv\Scripts\Activate.ps1; python playground.py --gs_object runs\bonsai_3dgut\bonsai-2209_141721\ours_30000\ckpt_30000.pt"

# 渲染 test split 全部视角（含 GT 对照）
pwsh -NoProfile -ExecutionPolicy Bypass -Command ". .\.venv\Scripts\Activate.ps1; python render.py --checkpoint runs\bonsai_3dgut\bonsai-2209_141721\ours_30000\ckpt_30000.pt --out-dir runs\bonsai_3dgut\bonsai-2209_141721\renders_all"
```

### 5. 踩坑记录（全部已修复）

| # | 坑 | 修复 |
|---|---|---|
| 1 | winget 检测到已有 CUDA，拒绝安装并存版本 | NVIDIA CDN 直链下载 + `-s` 静默安装 |
| 2 | PowerShell 5.1 原生命令传参丢失引号 → 安装脚本内嵌 Python 语法错误 | 全程用 **pwsh 7** 运行 `.ps1` |
| 3 | 中文系统 GBK 控制台无法编码 emoji 日志 → 训练启动即崩 | `Activate.ps1` 追加 `$env:PYTHONUTF8="1"` |
| 4 | torch JIT 自动选了 VS 2026 (MSVC 14.51) 当 CUDA 12.8 宿主编译器（只支持 ≤2022）→ 编译失败 | `Activate.ps1` 追加 VS 2022 vcvars 环境导入 + `DISTUTILS_USE_SDK=1` |
| 5 | 混用新旧编译器的 .obj 缓存 → LNK2019 (`__std_find_*` 符号缺失) | 删除 `%LOCALAPPDATA%\torch_extensions\torch_extensions\Cache\py311_cu128\lib3dgut_cc` 重编 |
| 6 | Playground 报 `UnauthorizedAccess` 执行策略错误（用户终端） | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

### 6. 本地源码补丁（Playground 上游 master 回归 bug，已修 4 处）

Playground 的 NVRTC 光追内核与最新 Slang 生成 API 不同步。已本地修补（`git diff` 可查，建议回馈上游 issue）：

1. `threedgrt_tracer/include/3dgrt/kernels/cuda/3dgrtTracer.cuh`
   - `particleDensityProcessHitFwdFromBuffer` 调用补充第 7 参 `&canonicalIntersectionDummy`（生成代码会**无条件写**该指针，不能传 nullptr，否则 CUDA 719 崩溃）
   - `particleFeaturesIntegrateFwdGeneric` 改名 `particleFeaturesIntegrateFwdFromBuffer`，补 `canonicalPosition=(0,0,0)` 参数并加类型转换
2. `threedgrut_playground/include/playground/kernels/cuda/trace.cuh` — `RayData.radiance` → `RayData.features[0/1/2]`（结构体成员早已改名）
3. `threedgrut_playground/src/kernels/cuda/3dgrtKernel.cu` — 同上 `radiance` → `features`

### 7. 下一步（对接课程的完整流程）

- 用 `export_last_lightfield.usdz` 导入 Isaac Sim 6.0（`Window → Content` 拖入或双击打开）
- 场景加 Ground Plane + 碰撞体，再放 Carter/Spot 跑导航 → 即完成课程 Lab 第三环节
- 想跑自己拍的场景：手机环绕拍 100–200 张 → COLMAP（`colmap gui` 导出 sparse/0）→ 按 §3 命令训练
