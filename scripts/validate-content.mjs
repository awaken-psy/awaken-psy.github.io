import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { digest, listFiles, readNote, inside, pathKey } from "./lib/vault.mjs"

export async function validateContent(directory = path.resolve("content")) {
  directory = await fs.realpath(directory)
  const manifest = JSON.parse(
    await fs.readFile(path.join(directory, ".publish-manifest.json"), "utf8"),
  )
  if (manifest.version !== 1 || !Array.isArray(manifest.files))
    throw new Error("公开清单格式无效")
  const expected = new Set()
  for (const entry of manifest.files) {
    if (
      typeof entry.path !== "string" ||
      !["note", "asset"].includes(entry.type)
    )
      throw new Error("公开清单条目无效")
    const target = path.resolve(directory, entry.path)
    if (
      !inside(directory, target) ||
      entry.path.includes("\\") ||
      entry.path.startsWith(".")
    )
      throw new Error(`公开清单包含无效路径 ${entry.path}`)
    const key = pathKey(entry.path)
    if (expected.has(key)) throw new Error(`公开清单路径重复 ${entry.path}`)
    expected.add(key)
    if (!inside(directory, await fs.realpath(target)))
      throw new Error(`生成文件指向目录外部 ${entry.path}`)
    const bytes = await fs.readFile(target)
    if (digest(bytes) !== entry.sha256)
      throw new Error(`生成文件摘要不匹配 ${entry.path}`)
    if (entry.type === "note") {
      const note = readNote(entry.path, bytes, 0)
      if (note.metadata.publish !== true)
        throw new Error(`生成笔记缺少明确的公开状态 ${entry.path}`)
      if (entry.updated !== note.updated)
        throw new Error(`生成笔记更新日期与清单不一致 ${entry.path}`)
    }
  }
  for (const name of await listFiles(directory)) {
    if (name !== ".publish-manifest.json" && !expected.has(pathKey(name)))
      throw new Error(`生成目录包含清单外文件 ${name}`)
  }
  return manifest
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const manifest = await validateContent()
    console.log(`公开内容校验通过，共 ${manifest.files.length} 个文件`)
  } catch (error) {
    console.error(`内容校验失败\n${error.message}`)
    process.exitCode = 1
  }
}
