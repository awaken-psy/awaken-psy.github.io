# awaken

倘若重新穿越时光河流

基于 Quartz 的个人笔记网站，内容在 Obsidian 中维护，网站通过 GitHub Pages 发布。

## 1. 安装与预览

使用 Node.js 24。首次安装后执行以下命令。

```powershell
npm ci
npm run plugins:install
npm run notes:export -- --vault "D:\Obsidian repository\awaken"
npm run dev
```

打开终端打印的本地地址。`npm run dev` 完成校验与构建后启动静态预览，按 `Ctrl+C` 结束。构建产物已经存在时，可以使用 `npm run preview` 启动预览。

## 2. 控制公开范围

| 笔记位置                                 | 默认状态 |
| ---------------------------------------- | -------- |
| `学习笔记/` 及子目录                     | 公开     |
| `面试准备/`、`日程/`、`杂感/` 及其他目录 | 隐藏     |

单篇布尔属性 `publish` 优先于文件夹默认值。在 Obsidian 属性面板中将其设置为复选框，或者使用 frontmatter。

```yaml
---
publish: false
---
```

`publish: false` 隐藏该篇，`publish: true` 公开该篇。导出读取原笔记，生成文件写入网站工程的 `content/`。每次重新导出都会完整计算公开范围及必要附件。

隐藏目标链接采用纯文本，手写标签保留，自动目标名称显示“未公开笔记”。隐藏内容嵌入也显示同一占位文本。缺失普通笔记链接和本机文件链接转为纯文本，必要附件缺失或引用歧义会使导出失败。

本地诊断位于 `.cache/export-report.json`。该文件记录链接提示及应用过的副本公式修正。四篇已授权的公式局部修正规则位于 `site.content-fixes.mjs`，用于网站导出副本。

## 3. 更新网站

每次发布按以下顺序操作。

```powershell
npm run notes:export -- --vault "D:\Obsidian repository\awaken"
npm test
npm run build
git add .
git commit -m "更新公开笔记"
git push origin master
```

在 GitHub 仓库的 Actions 中检查 `Publish awaken`。成功后的地址为 [awaken-psy.github.io](https://awaken-psy.github.io/)。公开内容清单、静态构建或资源校验失败时，该次部署终止。

隐藏、删除或取消附件引用的变更在下一次成功发布后生效。历史 Git 提交、外部缓存和读者已下载的副本需要另行处理。代码回退时，先恢复所需代码版本，再从当前笔记库重新导出、校验和构建，确保回退内容符合当前公开规则。

## 4. 配置首页与站点地址

`site.config.mjs` 集中管理站名、介绍、分类、专题、精选及公开链接。`featuredNotes` 使用笔记库相对路径，最多六篇，空列表时省略精选区域。最近更新展示五篇公开笔记，日期依次取有效 `updated`、`modified`、`date` 和源文件修改时间。

作者维护页面位于 `site-pages/`，导出时与公开笔记合成完整内容。文章旁的 HTML 附件会使用 `.htm` 后缀，配合 Quartz 的资源路径生成方式保持可访问。

项目子路径可以通过环境变量配置，GitHub Actions 使用同名仓库变量 `SITE_URL`。

```powershell
$env:SITE_URL = "https://awaken-psy.github.io/notes"
npm run build
npm run preview
```

预览地址会包含对应的基础路径。恢复账户首页配置时，在当前终端移除 `SITE_URL` 环境变量即可。

## 5. 校验与恢复

```powershell
npm test
npm run typecheck
npm run content:check
npm run build
```

测试覆盖文件夹继承、单篇覆盖、链接与嵌入、附件、并发导出、失败恢复、隐藏撤回、首页列表和完整静态构建。部署工作流位于 `.github/workflows/deploy.yml`，Pages 的构建来源使用 GitHub Actions。

导出进程异常退出时，先确认对应进程已结束，再清理 `.cache/export.lock` 后重试。当前输出目录和本地报告可用于核对上一次成功导出的内容。

Quartz 核心基线固定为 `8be3806431d33b9edaafcfc34a9520333399bf1e`，npm 插件版本由 `package-lock.json` 固定。上游授权见 `LICENSE.txt`。[Quartz 源码](https://github.com/jackyzha0/quartz/tree/8be3806431d33b9edaafcfc34a9520333399bf1e)
