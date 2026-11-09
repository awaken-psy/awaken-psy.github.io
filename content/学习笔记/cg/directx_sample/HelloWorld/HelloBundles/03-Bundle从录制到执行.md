---
title: Bundle：从录制到执行
publish: true
updated: 2026-09-12T04:29:29.563Z
tags:
  - DirectX
  - Direct3D12
  - HelloBundles
  - Bundle
  - CommandList
---


# Bundle：从录制到执行

上一节：[[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/02-Bundle命令分配器.md|Bundle 命令分配器]]  
索引：[[学习笔记/cg/directx_sample/HelloWorld/HelloBundles/00-HelloBundles学习索引.md|HelloBundles 学习索引]]

这一篇合并说明 Bundle 的创建、录制、调用、状态衔接、限制、生命周期，以及 HelloBundles 的完整一帧流程。

## 一、创建 Bundle

```cpp
m_device->CreateCommandList(
    0,
    D3D12_COMMAND_LIST_TYPE_BUNDLE,
    m_bundleAllocator.Get(),
    m_pipelineState.Get(),
    IID_PPV_ARGS(&m_bundle));
```

五个参数依次表达：

1. `0`：单适配器示例使用的 NodeMask；
2. `BUNDLE`：创建的是二级命令列表；
3. `m_bundleAllocator`：提供类型匹配的命令存储；
4. `m_pipelineState`：Bundle 自己的初始图形管线状态；
5. `m_bundle`：接收创建出的命令列表对象。

Bundle 不继承调用者的 PSO，因此创建时直接提供 `m_pipelineState`。`CreateCommandList` 成功返回后，Bundle 已经处于录制状态，不需要先调用 `Reset()`。

## 二、录制四条稳定命令

```cpp
m_bundle->SetGraphicsRootSignature(m_rootSignature.Get());
m_bundle->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
m_bundle->IASetVertexBuffers(0, 1, &m_vertexBufferView);
m_bundle->DrawInstanced(3, 1, 0, 0);
```

它们形成一条连续因果链：

```text
选择着色器绑定契约
        ↓
说明顶点按三角形列表解释
        ↓
告诉输入装配阶段从哪份顶点缓冲区读取
        ↓
读取三个顶点并绘制一个实例
```

这些调用只在 CPU 上写入命令记录，`DrawInstanced` 出现时也没有立即绘图。

随后：

```cpp
m_bundle->Close();
```

`Close()` 结束并验证录制。只有已经关闭的 Bundle 才能被调用；许多录制阶段发现的参数错误也会推迟到 `Close()` 返回。

## 三、为什么有些命令仍留在主命令列表

Bundle 适合绘制和部分状态绑定，但它不是缩小版的完整 DIRECT 命令列表。以下操作不能录入 Bundle：

- 清除渲染目标或深度缓冲区；
- 资源屏障；
- 绑定渲染目标；
- 设置 Viewport 和 Scissor；
- Copy、Resolve 和查询类操作；
- 在 Bundle 内再次执行另一个 Bundle。

因此本例的职责边界是：

| DIRECT 主命令列表 | Bundle |
|---|---|
| 选择当前后台缓冲区 | 设置根签名 |
| 设置 Viewport、Scissor | 设置三角形图元拓扑 |
| `PRESENT → RENDER_TARGET` 屏障 | 绑定顶点缓冲区 |
| 绑定并清除当前渲染目标 | 记录 `DrawInstanced` |
| 调用 Bundle |  |
| `RENDER_TARGET → PRESENT` 屏障 |  |

这种划分既符合 Bundle 的命令限制，也把随 `m_frameIndex` 变化的当帧工作留在主命令列表中。

## 四、主命令列表怎样调用 Bundle

```cpp
m_commandList->ExecuteBundle(m_bundle.Get());
```

调用发生时，主命令列表本身仍在录制。它只是把“在这里执行这份 Bundle”加入当前命令序列，并没有直接把 Bundle 提交给命令队列。

运行时会检查：

- 调用者是 DIRECT 主命令列表；
- 被调用对象确实是 Bundle；
- Bundle 已经关闭；
- Bundle 使用的命令分配器自 `Close()` 后没有被 Reset。

## 五、父子状态怎样衔接

Bundle 执行时会继承父 DIRECT 命令列表的大部分状态，但有两个重要例外：

- 不继承 PSO；
- 不继承图元拓扑。

所以本例在创建 Bundle 时提供 `m_pipelineState`，并在 Bundle 内记录 `IASetPrimitiveTopology`。

父命令列表提前设置 Viewport、Scissor 和当前渲染目标。Bundle 虽然不能自己设置这些状态，却可以在父列表准备好的环境中使用它们完成绘制。

反过来，Bundle 内设置的状态会影响父命令列表在 `ExecuteBundle` 之后的状态。本例调用 Bundle 后只继续做资源状态转换，所以没有产生额外的状态冲突。

## 六、真正提交时只提交谁

`OnRender()` 中只有主命令列表进入数组：

```cpp
ID3D12CommandList* ppCommandLists[] = { m_commandList.Get() };
m_commandQueue->ExecuteCommandLists(
    _countof(ppCommandLists),
    ppCommandLists);
```

Bundle 不会出现在提交数组中。GPU 执行主命令列表，走到 `ExecuteBundle` 的位置时，才执行 Bundle 中预录的四条命令。

```text
提交 DIRECT 主命令列表
          ↓
GPU 执行屏障、绑定渲染目标、清屏
          ↓
遇到 ExecuteBundle
          ↓
执行 Bundle 中的绑定与 Draw
          ↓
回到 DIRECT 主命令列表
          ↓
执行呈现前屏障
```

## 七、生命周期要求

Bundle 记录命令时不会替应用持有所有被引用对象的 COM 引用。因此，只要 Bundle 仍可能执行，下列对象就必须保持有效：

- `m_bundle`；
- `m_bundleAllocator`；
- `m_pipelineState`；
- `m_rootSignature`；
- `m_vertexBuffer`。

本示例把它们都作为 `D3D12HelloBundles` 的成员保存到应用退出，并在销毁前通过 Fence 等待 GPU 完成，所以生命周期是安全的。

如果要修改这份 Bundle，正确方向是：等待所有旧执行完成，再安全地回收其分配器存储、重新录制并重新关闭。不能在 GPU 或后续帧仍依赖旧命令时直接 Reset 分配器。

## 八、HelloBundles 完整流程

```text
OnInit
├─ LoadPipeline
│  ├─ 创建 DIRECT 主分配器
│  └─ 创建 BUNDLE 分配器
│
└─ LoadAssets
   ├─ 创建根签名、PSO、主命令列表
   ├─ 创建顶点缓冲区
   └─ 创建 Bundle
      ├─ 记录根签名
      ├─ 记录三角形拓扑
      ├─ 记录顶点缓冲区
      ├─ 记录 DrawInstanced
      └─ Close

每一帧 OnRender
├─ PopulateCommandList
│  ├─ Reset 主分配器和主命令列表
│  ├─ 准备当前后台缓冲区
│  ├─ 清屏
│  ├─ ExecuteBundle
│  ├─ 准备呈现
│  └─ Close 主命令列表
├─ 只提交主命令列表
├─ Present
└─ Fence 等待
```

## 九、Bundle 是否一定更快

Bundle 的设计允许驱动在录制阶段尽量预处理，使后续调用成本较低；它适合反复执行的一小组命令。但是否产生可观收益仍取决于命令规模、调用次数、驱动和硬件。本例的三角形主要用于解释机制，不用于证明真实项目一定会获得明显性能提升。

## 最终结论

> DIRECT 主命令列表建立这一帧的渲染环境，Bundle 保存可跨帧复用的绘制片段；主列表在指定位置调用 Bundle，最后仍由命令队列只提交主列表。

参考：

- [Microsoft Learn：创建和录制命令列表与 Bundle](https://learn.microsoft.com/en-us/windows/win32/direct3d12/recording-command-lists-and-bundles)
- [Microsoft Learn：ExecuteBundle](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-executebundle)
