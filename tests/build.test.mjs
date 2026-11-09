import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import YAML from "yaml"
import { exportNotes } from "../scripts/export-notes.mjs"
import { validateBuild } from "../scripts/validate-build.mjs"
import { listFiles } from "../scripts/lib/vault.mjs"

test(
  "完整构建覆盖隐藏标记、语法呈现和下架清理",
  { timeout: 120_000 },
  async (t) => {
    const root = path.resolve(".cache", `build-test-${randomUUID()}`)
    const vault = path.join(root, "vault")
    const project = path.join(root, "project")
    const output = path.join(root, "public")
    await fs.mkdir(project, { recursive: true })
    const initialized = spawnSync("git", ["init", "--quiet", project], {
      encoding: "utf8",
    })
    assert.equal(initialized.status, 0, initialized.stderr)
    await fs.cp(path.resolve("site-pages"), path.join(project, "site-pages"), {
      recursive: true,
    })
    t.after(() => fs.rm(root, { recursive: true, force: true }))
    const files = {
      "学习笔记/cg/main.md":
        "---\ndate: 2026-11-09\n---\n# PUBLIC_MAIN\n\n标签 #公开标签\n\n[[PRIVATE_TITLE]] ![[PRIVATE_ALIAS#章节]]\n\n![专用图](../../Attachments/unique.svg)\n\n![[shared.svg|250]]\n\n$x^2$\n\n> [!note]\n> 提示\n\n```cpp\nint value = 1;\n```\n\n```mermaid\ngraph TD\nA --> B\n```\n\n[[peer#章节]]\n",
      "学习笔记/cg/peer.md":
        "---\ndate: 2026-11-08\n---\n# PUBLIC_PEER\n\n## 章节\n\n公开块 ^referenceblock\n\n![[shared.svg]]\n",
      "日程/PRIVATE_TITLE.md":
        "---\naliases: [PRIVATE_ALIAS]\n---\n# PRIVATE_TITLE\n\nPRIVATE_BODY_SENTINEL\n",
      "Attachments/unique.svg":
        '<svg xmlns="http://www.w3.org/2000/svg"><text>UNIQUE_RESOURCE</text></svg>',
      "Attachments/shared.svg":
        '<svg xmlns="http://www.w3.org/2000/svg"><text>SHARED_RESOURCE</text></svg>',
      "Attachments/hidden.svg":
        '<svg xmlns="http://www.w3.org/2000/svg"><text>PRIVATE_ASSET_SENTINEL</text></svg>',
    }
    for (const [name, body] of Object.entries(files)) {
      const file = path.join(vault, name)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, body)
    }
    function build() {
      const result = spawnSync(
        process.execPath,
        [
          "quartz/bootstrap-cli.mjs",
          "build",
          "-d",
          path.join(project, "content"),
          "-o",
          output,
          "--concurrency",
          "1",
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          maxBuffer: 5_000_000,
          env: {
            ...process.env,
            SITE_URL: "https://awaken-psy.github.io/notes",
          },
        },
      )
      assert.equal(result.status, 0, result.stdout + result.stderr)
    }
    await exportNotes({ vaultPath: vault, projectRoot: project })
    build()
    await validateBuild({
      output,
      content: path.join(project, "content"),
      url: "https://awaken-psy.github.io/notes",
    })
    const main = await fs.readFile(
      path.join(output, "学习笔记/cg/main.html"),
      "utf8",
    )
    assert.match(main, /class="katex"/)
    assert.match(main, /callout/)
    assert.match(main, /mermaid/)
    const peer = await fs.readFile(
      path.join(output, "学习笔记/cg/peer.html"),
      "utf8",
    )
    assert.match(peer, /id="referenceblock"/)
    for (const file of await listFiles(output)) {
      if (!/\.(?:html|json|js|css|svg)$/u.test(file)) continue
      const bytes = await fs.readFile(path.join(output, file), "utf8")
      assert.doesNotMatch(
        bytes,
        /PRIVATE_TITLE|PRIVATE_ALIAS|PRIVATE_BODY_SENTINEL|PRIVATE_ASSET_SENTINEL/,
      )
    }
    await fs.writeFile(
      path.join(vault, "学习笔记/cg/main.md"),
      "---\npublish: false\n---\n# PUBLIC_MAIN\n",
    )
    await exportNotes({ vaultPath: vault, projectRoot: project })
    build()
    await validateBuild({
      output,
      content: path.join(project, "content"),
      url: "https://awaken-psy.github.io/notes",
    })
    const names = await listFiles(output)
    assert.ok(!names.includes("学习笔记/cg/main.html"))
    assert.ok(!names.includes("attachments/unique.svg"))
    assert.ok(names.includes("attachments/shared.svg"))
    assert.doesNotMatch(
      await fs.readFile(path.join(output, "static/contentIndex.json"), "utf8"),
      /PUBLIC_MAIN/,
    )
    await fs.unlink(path.join(output, "attachments/shared.svg"))
    await assert.rejects(
      validateBuild({
        output,
        content: path.join(project, "content"),
        url: "https://awaken-psy.github.io/notes",
      }),
      /缺少生成文件|缺少本地引用/,
    )
  },
)

test("部署工作流受构建成功状态约束", async () => {
  const workflow = YAML.parse(
    await fs.readFile(".github/workflows/deploy.yml", "utf8"),
  )
  assert.equal(workflow.jobs.deploy.needs, "build")
  const commands = workflow.jobs.build.steps
    .map((step) => step.run)
    .filter(Boolean)
  assert.ok(commands.includes("npm test"))
  assert.ok(commands.includes("npm run build"))
  assert.ok(!workflow.jobs.deploy["if"]?.includes("always"))
})
