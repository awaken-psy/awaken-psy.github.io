## Why

现有 Obsidian 笔记分散在本地目录中，需要一个面向外部读者、同时便于自己查阅的个人网站。以现有 Markdown 为内容来源，通过明确的公开规则和 GitHub Pages 托管，让日常写作能够持续转化为可浏览、可搜索的技术笔记。

## What Changes

- 建立名为 `awaken` 的深色技术风个人网站，首页介绍使用原句“倘若重新穿越时光河流”，提供分类入口、专题入口、精选笔记与最近更新。
- 按文件夹继承默认公开状态。`学习笔记/` 及子目录默认公开，`面试准备/`、`日程/`、`杂感/` 及新增的其他目录默认隐藏，单篇布尔属性 `publish` 覆盖默认值。
- 建立本地发布导出流程，从外部笔记库中提取公开笔记及其引用的附件，生成供网站构建使用的独立内容集，处理隐藏目标链接、嵌入内容和重复导出时的撤回。
- 使用 Quartz 提供中文全文搜索、分类目录、章节目录和关联阅读，兼容现有双链、公式、提示块、代码及 Mermaid 图表。
- 建立 GitHub Actions 构建和 GitHub Pages 部署流程，支持账户首页地址与项目子路径，发布前验证内容范围及站内资源。

## Capabilities

### New Capabilities

- `selective-note-publishing` — 文件夹默认值、单篇覆盖、公开内容导出、附件筛选与重新发布时的内容撤回。
- `notes-reading-and-discovery` — Obsidian 内容呈现、中文检索、分类和专题导航、公开笔记之间的关联阅读。
- `personal-site-homepage` — 固定站名和介绍、深色视觉、分类与专题入口、精选及最近更新、响应式首页布局。
- `github-pages-delivery` — 本地导出与预览、公开网站仓库边界、可重复构建、GitHub Pages 部署及路径兼容。

### Modified Capabilities

## Impact

- 网站工程位于 `D:\project\awaken`，内容来源位于 `D:\Obsidian repository\awaken`。导出以读取外部笔记库为入口，生成文件集中写入网站工程。
- 新增 Quartz、匹配的 Node.js 工具链、Markdown/YAML 解析与本地导出逻辑。实现时固定 Quartz 版本及依赖锁文件。
- GitHub 网站仓库承载经过筛选的内容、网站配置与构建流程。目标为 `awaken-psy/awaken-psy.github.io`，默认分支为 `master`，站点地址为 `https://awaken-psy.github.io/`。
- 当前笔记规模为 768 篇 Markdown 和约 24.5 MB 非 Markdown 文件，其中学习笔记 462 篇。筛选前需要建立完整路径与别名索引，筛选后统一生成导航、搜索与资源清单。
