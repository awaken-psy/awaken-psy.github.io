import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { exportNotes } from "../scripts/export-notes.mjs"
import { validateContent } from "../scripts/validate-content.mjs"
import { correctSource } from "../site.content-fixes.mjs"

async function fixture(t, files) {
  const root = path.resolve(".cache", `test-${randomUUID()}`)
  const vault = path.join(root, "vault")
  const project = path.join(root, "project")
  await fs.mkdir(path.join(project, "site-pages"), { recursive: true })
  await fs.writeFile(
    path.join(project, "site-pages", "index.md"),
    "# fixture\n",
  )
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(vault, name)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, body)
  }
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  return {
    root,
    vault,
    project,
    run: (options = {}) =>
      exportNotes({ vaultPath: vault, projectRoot: project, ...options }),
    read: (name) => fs.readFile(path.join(project, "content", name), "utf8"),
  }
}

test("文件夹默认、子目录、相似名字和单篇覆盖", async (t) => {
  const f = await fixture(t, {
    "学习笔记/公开.md": "# 公开\n",
    "学习笔记/子目录/公开.md": "# 继承\n",
    "学习笔记/草稿.md": "---\npublish: false\n---\nhidden-token",
    "面试准备/隐藏.md": "interview-token",
    "面试准备/公开.md": "---\npublish: true\n---\n# 公开面试\n",
    "日程/隐藏.md": "calendar-token",
    "杂感/隐藏.md": "thoughts-token",
    "学习笔记备份/隐藏.md": "backup-token",
    "新目录/隐藏.md": "new-token",
  })
  const result = await f.run()
  assert.equal(result.notes, 3)
  const manifest = await validateContent(path.join(f.project, "content"))
  assert.equal(manifest.files.filter((file) => file.type === "note").length, 8)
  assert.match(await f.read("面试准备/公开.md"), /publish: true/)
  assert.doesNotMatch(JSON.stringify(manifest), /隐藏|草稿/)
})

test("非布尔公开状态和损坏的 frontmatter 返回明确错误", async (t) => {
  for (const body of [
    '---\npublish: "false"\n---\ntext',
    "---\npublish: [\n---\ntext",
  ]) {
    const f = await fixture(t, { "学习笔记/错误.md": body })
    await assert.rejects(f.run(), /错误.md.*(?:publish|frontmatter)/)
  }
})

test("中文、空格、URL 编码、别名、章节与块引用", async (t) => {
  const f = await fixture(t, {
    "学习笔记/一.md":
      "[[别名#章节|说明]]\n[标准](子目录/有%20空格.md#章节)\n[[子目录/有 空格#^block]]\n",
    "学习笔记/子目录/有 空格.md":
      "---\naliases: [别名]\n---\n# 标题\n\n## 章节\n\n内容 ^block\n",
  })
  await f.run()
  const body = await f.read("学习笔记/一.md")
  assert.match(body, /学习笔记\/子目录\/有 空格.md#章节\|说明/)
  assert.match(
    body,
    /学习笔记\/子目录\/有%20空格.md#章节|<学习笔记\/子目录\/有 空格.md#章节>/,
  )
  assert.match(body, /#\^block/)
})

test("隐藏链接、整篇与局部嵌入采用占位并保留显式标签", async (t) => {
  const f = await fixture(t, {
    "学习笔记/公开.md":
      "[[秘密标题]] [[秘密标题|手写标签]] [标准标签](../日程/秘密标题.md)\n![[秘密标题]] ![[秘密标题#章节]] ![[秘密标题#^block]]\n%% [[秘密别名]] %%\n<a href='../日程/秘密标题.md'>HTML标签</a>\n<iframe style='color:red' src='../日程/秘密标题.md'></iframe>\n",
    "日程/秘密标题.md":
      "---\naliases: [秘密别名]\n---\n# 秘密标题\nPRIVATE_BODY\n",
  })
  await f.run()
  const body = await f.read("学习笔记/公开.md")
  assert.match(body, /未公开笔记/)
  assert.match(body, /手写标签/)
  assert.match(body, /标准标签/)
  assert.match(body, /HTML标签/)
  assert.doesNotMatch(body, /秘密标题|秘密别名|PRIVATE_BODY|href=|<iframe/)
})

test("引用式链接、本机 URI、缺失普通笔记和代码围栏", async (t) => {
  const f = await fixture(t, {
    "学习笔记/公开.md":
      "[别名][ref]\n\n[ref]: ../日程/私有.md\n\n[文件](file:///C:/private/code.h)\n[[缺失笔记]]\n\n```cpp\n[[私有]] file:///C:/example\n```\n",
    "日程/私有.md": "SECRET",
  })
  const result = await f.run()
  const body = await f.read("学习笔记/公开.md")
  assert.match(body, /别名/)
  assert.match(body, /文件/)
  assert.match(body, /缺失笔记/)
  assert.match(body, /```cpp\n\[\[私有\]\] file:\/\/\/C:\/example/)
  assert.doesNotMatch(body, /private\/code.h|\[ref\]:/)
  assert.equal(result.warnings, 2)
})

test("必要附件去重，HTML、SVG、CSS 依赖递归导出", async (t) => {
  const f = await fixture(t, {
    "学习笔记/公开.md":
      "![[diagram.svg|500]]\n![共享](../Attachments/shared.png)\n[展示](assets/demo.html)\n",
    "学习笔记/二.md": "![[shared.png]]",
    "Attachments/shared.png": "PNG_SHARED",
    "Attachments/private.png": "PRIVATE_PNG",
    "学习笔记/assets/diagram.svg":
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="../../Attachments/shared.png"/></svg>',
    "学习笔记/assets/demo.html":
      '<link rel="stylesheet" href="theme.css"><img src="../../Attachments/shared.png">',
    "学习笔记/assets/theme.css":
      'body { background: url("../../Attachments/shared.png") }',
  })
  const result = await f.run()
  assert.equal(result.assets, 4)
  const manifest = await validateContent(path.join(f.project, "content"))
  assert.ok(manifest.files.some((file) => file.path.endsWith("demo.htm")))
  assert.doesNotMatch(JSON.stringify(manifest), /private.png/)
  assert.match(
    await f.read("学习笔记/assets/diagram.svg"),
    /\.\.\/\.\.\/attachments\/shared.png/,
  )
})

test("缺失附件、库外路径和链接歧义阻止导出", async (t) => {
  for (const link of [
    "![[missing.png]]",
    "![图](../../../outside.png)",
    "[[重复]]",
  ]) {
    const f = await fixture(t, {
      "学习笔记/公开.md": link,
      "日程/a.md": "---\naliases: [重复]\n---\nA",
      "杂感/b.md": "---\naliases: [重复]\n---\nB",
    })
    await assert.rejects(f.run(), /缺少必要资源|笔记库外部|存在歧义/)
  }
})

test("输出路径与保留页面冲突会报错", async (t) => {
  const f = await fixture(t, { "index.md": "---\npublish: true\n---\n# 冲突" })
  await assert.rejects(f.run(), /输出路径冲突/)
  const g = await fixture(t, {
    "学习笔记/a b.md": "# A",
    "学习笔记/a-b.md": "# B",
  })
  await assert.rejects(g.run(), /输出路径冲突/)
})

test("循环公开嵌入被转换为有限链接", async (t) => {
  const f = await fixture(t, {
    "学习笔记/a.md": "![[b]]",
    "学习笔记/b.md": "![[a]]",
  })
  await f.run()
  const output =
    (await f.read("学习笔记/a.md")) + (await f.read("学习笔记/b.md"))
  assert.equal((output.match(/!\[\[/gu) ?? []).length, 1)
})

test("公开改隐藏清理旧文件并保留仍被引用的共享资源", async (t) => {
  const f = await fixture(t, {
    "学习笔记/a.md": "![[private.png]] ![[shared.png]]",
    "学习笔记/b.md": "![[shared.png]]",
    "Attachments/private.png": "PRIVATE",
    "Attachments/shared.png": "SHARED",
  })
  await f.run()
  await fs.writeFile(
    path.join(f.vault, "学习笔记/a.md"),
    "---\npublish: false\n---\n![[private.png]]",
  )
  await f.run()
  const manifest = await validateContent(path.join(f.project, "content"))
  assert.doesNotMatch(JSON.stringify(manifest), /a.md|private.png/)
  assert.match(JSON.stringify(manifest), /shared.png/)
  const first = await fs.readFile(
    path.join(f.project, "content", ".publish-manifest.json"),
    "utf8",
  )
  await f.run()
  assert.equal(
    await fs.readFile(
      path.join(f.project, "content", ".publish-manifest.json"),
      "utf8",
    ),
    first,
  )
})

test("源文件变化、并发占用与替换失败保持先前成功内容", async (t) => {
  const f = await fixture(t, { "学习笔记/a.md": "# A\n" })
  await f.run()
  const previous = await f.read("学习笔记/a.md")
  await assert.rejects(
    f.run({
      beforeVerify: async () => {
        await fs.writeFile(path.join(f.vault, "学习笔记/a.md"), "# B\n")
      },
    }),
    /源文件发生变化/,
  )
  assert.equal(await f.read("学习笔记/a.md"), previous)
  await assert.rejects(
    f.run({
      beforeVerify: async () => {
        await assert.rejects(f.run(), /已有导出任务/)
        throw new Error("STOP_AFTER_CONCURRENT_CHECK")
      },
    }),
    /STOP_AFTER_CONCURRENT_CHECK/,
  )
  await assert.rejects(
    f.run({
      beforeReplace: () => {
        throw new Error("REPLACE_FAILED")
      },
    }),
    /REPLACE_FAILED/,
  )
  assert.equal(await f.read("学习笔记/a.md"), previous)
  await f.run()
  assert.match(await f.read("学习笔记/a.md"), /title: B/)
})

test("清单外文件和摘要变更在 CI 校验中失败", async (t) => {
  const f = await fixture(t, { "学习笔记/a.md": "# A" })
  await f.run()
  await fs.writeFile(path.join(f.project, "content", "extra.txt"), "EXTRA")
  await assert.rejects(
    validateContent(path.join(f.project, "content")),
    /清单外文件/,
  )
  await fs.unlink(path.join(f.project, "content", "extra.txt"))
  await fs.appendFile(
    path.join(f.project, "content", "学习笔记/a.md"),
    "CHANGED",
  )
  await assert.rejects(
    validateContent(path.join(f.project, "content")),
    /摘要不匹配/,
  )
})

test("仅替换引用，公式、列表缩进和代码的原始文字保持完整", async (t) => {
  const original =
    "# 数学\n\n1. 更新梯度\n\n   $$\n   \\theta_t=\\theta_{t-1}-\\alpha\n   $$\n\n   - $\\varepsilon$ 防止除零\n\n公式 $L_{\\text{amb}} = c$\n\n[[目标]]\n"
  const f = await fixture(t, {
    "学习笔记/数学.md": original,
    "学习笔记/目标.md": "# 目标",
  })
  await f.run()
  const body = await f.read("学习笔记/数学.md")
  assert.ok(
    body.endsWith(original.replace("[[目标]]", "[[学习笔记/目标.md|目标]]")),
  )
})

test("已授权的公式副本修正保留双美元分隔符且可重复执行", () => {
  const source = "$$\n\\boxed{x+y}\n$$**UE5 Lumen 后续正文**"
  const name = "学习笔记/cg/games202/专题/ssgi/07-缺陷与混合管线.md"
  const fixed = correctSource(name, source)
  assert.equal(fixed.source, "$$\n\\boxed{x+y}\n$$\n\n**UE5 Lumen 后续正文**")
  assert.equal(correctSource(name, fixed.source).source, fixed.source)
  assert.equal(correctSource("学习笔记/其他.md", source).source, source)
})
