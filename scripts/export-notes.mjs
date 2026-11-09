import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { parseArgs } from "node:util"
import { pathToFileURL } from "node:url"
import { slugifyFilePath } from "@quartz-community/utils/path"
import {
  readVault,
  readNote,
  verifySnapshot,
  noteOutput,
  listFiles,
  digest,
  inside,
  pathKey,
} from "./lib/vault.mjs"
import { createReferenceProcessor, assetOutputPath } from "./lib/references.mjs"
import { validateContent } from "./validate-content.mjs"
import site from "../site.config.mjs"

export async function exportNotes({
  vaultPath,
  projectRoot = process.cwd(),
  beforeVerify,
  beforeReplace,
} = {}) {
  if (!vaultPath)
    throw new Error("请通过 --vault 或 OBSIDIAN_VAULT_PATH 提供笔记库路径")
  projectRoot = await fs.realpath(projectRoot)
  const resolvedVault = await fs.realpath(vaultPath)
  const output = path.join(projectRoot, "content")
  if (inside(resolvedVault, projectRoot) || inside(output, resolvedVault)) {
    throw new Error("网站工程与笔记库必须分开，生成目录也必须独立")
  }
  const cache = path.join(projectRoot, ".cache")
  await fs.mkdir(cache, { recursive: true })
  if (!inside(projectRoot, await fs.realpath(cache)))
    throw new Error("工程缓存目录必须位于工程内")
  const previousOutput = await fs.lstat(output).catch((error) => {
    if (error.code !== "ENOENT") throw error
    return null
  })
  if (previousOutput?.isSymbolicLink())
    throw new Error("生成内容目录必须为工程内的普通目录")
  const lockPath = path.join(cache, "export.lock")
  let lock
  try {
    lock = await fs.open(lockPath, "wx")
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error("已有导出任务占用输出目录，请等待该任务结束")
    throw error
  }
  const staging = path.join(cache, `export-${randomUUID()}`)
  const backup = path.join(cache, `previous-${randomUUID()}`)
  let movedPrevious = false
  let promoted = false
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid }))
    const vault = await readVault(resolvedVault)
    const processor = createReferenceProcessor(vault)
    const published = [...vault.notes.values()].filter((note) => note.published)
    for (const note of published) processor.rewriteNote(note)
    processor.limitEmbedCycles()
    const exported = new Map()
    const outputNames = new Map()
    function add(name, bytes, type, updated) {
      const destination =
        type === "note"
          ? `${slugifyFilePath(name)}.html`
          : slugifyFilePath(name)
      const key = pathKey(destination)
      if (outputNames.has(key))
        throw new Error(`输出路径冲突 ${name} 与 ${outputNames.get(key)}`)
      outputNames.set(key, name)
      exported.set(name, { bytes: Buffer.from(bytes), type, updated })
    }
    const authorRoot = path.join(projectRoot, "site-pages")
    for (const name of await listFiles(authorRoot)) {
      const bytes = await fs.readFile(path.join(authorRoot, name))
      if (!name.endsWith(".md"))
        throw new Error(`作者维护页面只接受 Markdown ${name}`)
      const page = readNote(name, bytes, 0)
      add(
        name,
        noteOutput(page, { kind: page.metadata.kind ?? "page" }),
        "note",
        page.updated,
      )
    }
    for (const note of published)
      add(note.path, noteOutput(note), "note", note.updated)
    for (const [name, bytes] of processor.assets)
      add(assetOutputPath(name), bytes, "asset")
    for (const category of site.categories) {
      if (published.some((note) => note.path.startsWith(`${category.path}/`)))
        continue
      const name = `${category.path}/index.md`
      const page = readNote(
        name,
        Buffer.from(`# ${category.title}\n\n这个分类的公开笔记正在整理中。\n`),
        Date.parse("2026-11-09"),
      )
      add(name, noteOutput(page, { kind: "collection" }), "note", page.updated)
    }
    await fs.mkdir(staging)
    const manifest = { version: 1, files: [] }
    for (const [name, file] of [...exported].sort(([a], [b]) =>
      a.localeCompare(b, "en"),
    )) {
      const target = path.join(staging, name)
      if (!inside(staging, target)) throw new Error(`无效输出路径 ${name}`)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, file.bytes)
      const entry = { path: name, sha256: digest(file.bytes), type: file.type }
      if (file.updated) entry.updated = file.updated
      manifest.files.push(entry)
    }
    await fs.writeFile(
      path.join(staging, ".publish-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    await validateContent(staging)
    await fs.writeFile(
      path.join(cache, "export-report.json"),
      JSON.stringify(
        {
          notes: published.length,
          assets: processor.assets.size,
          warnings: processor.warnings,
          corrections: vault.corrections,
        },
        null,
        2,
      ),
    )
    await beforeVerify?.(vault)
    await verifySnapshot(vault)
    try {
      await fs.rename(output, backup)
      movedPrevious = true
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
    await beforeReplace?.()
    await fs.rename(staging, output)
    promoted = true
    if (movedPrevious) await fs.rm(backup, { recursive: true })
    return {
      notes: published.length,
      assets: processor.assets.size,
      warnings: processor.warnings.length,
    }
  } catch (error) {
    if (movedPrevious && !promoted) await fs.rename(backup, output)
    throw error
  } finally {
    await fs.rm(staging, { recursive: true, force: true })
    await lock.close()
    await fs.rm(lockPath, { force: true })
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const { values } = parseArgs({ options: { vault: { type: "string" } } })
    const summary = await exportNotes({
      vaultPath: values.vault ?? process.env.OBSIDIAN_VAULT_PATH,
    })
    console.log(
      `导出完成，公开笔记 ${summary.notes} 篇，必要附件 ${summary.assets} 个，本地提示 ${summary.warnings} 条`,
    )
    console.log("详细提示位于 .cache/export-report.json")
  } catch (error) {
    console.error(`导出失败\n${error.message}`)
    process.exitCode = 1
  }
}
