import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import YAML from "yaml"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkObsidian from "@quartz-community/remark-obsidian"
import remarkStringify from "remark-stringify"
import { slugifyFilePath } from "@quartz-community/utils/path"
import { correctSource } from "../../site.content-fixes.mjs"

export const markdown = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkObsidian)
  .use(remarkStringify, { bullet: "-", fences: true, listItemIndent: "one" })

export const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex")
export const pathKey = (name) => name.normalize("NFC").toLowerCase()
export const posix = (name) => name.split(path.sep).join("/")
const internalDirectories = new Set([".obsidian", ".git", ".trash"])

export function inside(root, target) {
  const relative = path.relative(root, target)
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  )
}

export async function listFiles(root) {
  const result = []
  const visited = new Set()
  async function walk(directory) {
    const actual = await fs.realpath(directory)
    if (!inside(root, actual))
      throw new Error(
        `目录指向笔记库外部 ${posix(path.relative(root, directory))}`,
      )
    if (visited.has(actual))
      throw new Error(
        `目录存在重复或循环链接 ${posix(path.relative(root, directory))}`,
      )
    visited.add(actual)
    const entries = await fs.readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((a, b) =>
      a.name.localeCompare(b.name, "en"),
    )) {
      if (internalDirectories.has(entry.name)) continue
      const file = path.join(directory, entry.name)
      const stat = await fs.stat(file)
      if (stat.isDirectory()) await walk(file)
      else if (stat.isFile()) result.push(posix(path.relative(root, file)))
    }
  }
  await walk(root)
  return result.sort()
}

function nodeText(node) {
  if (typeof node.value === "string") return node.value
  return (node.children ?? []).map(nodeText).join("")
}

export function readNote(name, bytes, mtime) {
  const source = bytes.toString("utf8").replace(/^\uFEFF/, "")
  let body = source
  let metadata = {}
  if (/^---\r?\n/.test(source)) {
    const frontmatter = source.match(
      /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/,
    )
    if (!frontmatter) throw new Error(`${name} 的 frontmatter 缺少结束分隔符`)
    try {
      metadata = YAML.parse(frontmatter[1]) ?? {}
    } catch (error) {
      throw new Error(`${name} 的 frontmatter 无效\n${error.message}`)
    }
    if (typeof metadata !== "object" || Array.isArray(metadata))
      throw new Error(`${name} 的 frontmatter 必须是对象`)
    body = source.slice(frontmatter[0].length)
  }
  if (
    Object.hasOwn(metadata, "publish") &&
    typeof metadata.publish !== "boolean"
  ) {
    throw new Error(
      `${name} 的 publish 必须为布尔值，当前类型为 ${typeof metadata.publish}`,
    )
  }
  const tree = markdown.runSync(markdown.parse(body), body)
  const heading = tree.children.find(
    (node) => node.type === "heading" && node.depth === 1,
  )
  const title =
    typeof metadata.title === "string" && metadata.title.trim()
      ? metadata.title.trim()
      : heading
        ? nodeText(heading)
        : path.posix.basename(name, ".md")
  let updated = new Date(mtime).toISOString()
  for (const field of ["updated", "modified", "date"]) {
    const value = metadata[field]
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}(?:$|[T ])/u.test(value) &&
      Number.isFinite(Date.parse(value))
    ) {
      updated = new Date(value).toISOString()
      break
    }
  }
  const aliases = Array.isArray(metadata.aliases)
    ? metadata.aliases
    : [metadata.aliases]
  return {
    path: name,
    body,
    tree,
    metadata,
    title,
    aliases: aliases.filter(
      (value) => typeof value === "string" && value.trim(),
    ),
    updated,
    published: metadata.publish ?? name.split("/")[0] === "学习笔记",
    slug: slugifyFilePath(name),
  }
}

export async function readVault(input) {
  const root = await fs.realpath(input)
  if (!(await fs.stat(root)).isDirectory())
    throw new Error("笔记库路径必须为目录")
  const names = await listFiles(root)
  const files = new Map()
  const notes = new Map()
  const corrections = []
  for (const name of names) {
    const absolute = path.join(root, name)
    const actual = await fs.realpath(absolute)
    if (!inside(root, actual)) throw new Error(`文件指向笔记库外部 ${name}`)
    const bytes = await fs.readFile(absolute)
    const stat = await fs.stat(absolute)
    files.set(name, { bytes, hash: digest(bytes) })
    if (name.toLowerCase().endsWith(".md")) {
      const result = correctSource(name, bytes.toString("utf8"))
      if (result.corrected) corrections.push(name)
      notes.set(name, readNote(name, Buffer.from(result.source), stat.mtimeMs))
    }
  }
  return { root, names, files, notes, corrections }
}

export async function verifySnapshot(vault) {
  const current = await listFiles(vault.root)
  if (JSON.stringify(current) !== JSON.stringify(vault.names))
    throw new Error("导出期间笔记库的文件列表发生变化，请重新导出")
  for (const [name, file] of vault.files) {
    const absolute = path.join(vault.root, name)
    if (
      !inside(vault.root, await fs.realpath(absolute)) ||
      digest(await fs.readFile(absolute)) !== file.hash
    ) {
      throw new Error(`导出期间源文件发生变化，请重新导出 ${name}`)
    }
  }
}

export function noteOutput(note, extra = {}) {
  const metadata = {
    title: note.title,
    publish: true,
    updated: note.updated,
    ...extra,
  }
  for (const key of ["tags", "aliases", "description", "date"]) {
    if (note.metadata[key] !== undefined) metadata[key] = note.metadata[key]
  }
  return `---\n${YAML.stringify(metadata)}---\n\n${note.exportedBody ?? note.body}`
}
