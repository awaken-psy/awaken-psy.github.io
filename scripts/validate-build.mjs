import fs from "node:fs/promises"
import path from "node:path"
import { parse, parseFragment } from "parse5"
import postcss from "postcss"
import valueParser from "postcss-value-parser"
import { parseArgs } from "node:util"
import { pathToFileURL } from "node:url"
import { slugifyFilePath } from "@quartz-community/utils/path"
import { listFiles, inside } from "./lib/vault.mjs"
import { validateContent } from "./validate-content.mjs"
import site from "../site.config.mjs"

export async function validateBuild({
  output = path.resolve("public"),
  content = path.resolve("content"),
  url = process.env.SITE_URL ?? site.url,
} = {}) {
  output = await fs.realpath(output)
  const manifest = await validateContent(content)
  const files = new Set(await listFiles(output))
  const basePath = new URL(url).pathname.replace(/\/$/u, "")
  const errors = []
  const index = JSON.parse(
    await fs.readFile(path.join(output, "static/contentIndex.json"), "utf8"),
  )
  const entries = index.content ?? index
  for (const entry of manifest.files) {
    const slug = slugifyFilePath(entry.path)
    const expected = entry.type === "note" ? `${slug}.html` : slug
    if (!files.has(expected)) errors.push(`缺少生成文件 ${expected}`)
    if (entry.type === "note" && !entries[slug])
      errors.push(`搜索索引缺少笔记 ${entry.path}`)
  }
  for (const file of files) {
    if (file.endsWith(".md") || file.includes(".publish-manifest"))
      errors.push(`构建产物含有源文件 ${file}`)
    if (!/\.(?:html?|svg|css)$/iu.test(file)) continue
    const source = await fs.readFile(path.join(output, file), "utf8")
    function check(raw) {
      if (!raw || /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/iu.test(raw)) return
      let target
      try {
        const address = new URL(raw, `https://build.local${basePath}/${file}`)
        const pathname = decodeURIComponent(address.pathname)
        if (
          basePath &&
          !pathname.startsWith(`${basePath}/`) &&
          pathname !== basePath
        ) {
          errors.push(`${file} 的引用越过站点基础路径 ${raw}`)
          return
        }
        target = pathname.slice(basePath.length).replace(/^\//u, "")
      } catch {
        errors.push(`${file} 的引用地址无效 ${raw}`)
        return
      }
      if (!inside(output, path.resolve(output, target))) {
        errors.push(`${file} 的引用越过输出目录 ${raw}`)
        return
      }
      const candidates = [
        target,
        `${target}.html`,
        `${target.replace(/\/$/u, "")}/index.html`,
      ]
      if (!target) candidates.push("index.html")
      if (!candidates.some((candidate) => files.has(candidate)))
        errors.push(`${file} 缺少本地引用 ${raw}`)
    }
    if (file.endsWith(".css")) {
      const css = postcss.parse(source)
      function checkUrls(value) {
        valueParser(value).walk((node) => {
          if (node.type !== "function" || node.value.toLowerCase() !== "url")
            return
          const address = valueParser.stringify(node.nodes).trim()
          check(address.replace(/^(['"])([\s\S]*)\1$/u, "$2"))
          return false
        })
      }
      css.walkDecls((declaration) => checkUrls(declaration.value))
      css.walkAtRules("import", (rule) => {
        const address = valueParser(rule.params).nodes[0]
        if (address?.type === "string") check(address.value)
        else checkUrls(rule.params)
      })
      continue
    }
    if (source.includes('class="katex-error"'))
      errors.push(`${file} 存在公式渲染错误`)
    const document = file.endsWith(".svg")
      ? parseFragment(source)
      : parse(source)
    function walk(node) {
      for (const attribute of node.attrs ?? []) {
        if (["href", "src", "poster", "data"].includes(attribute.name))
          check(attribute.value)
      }
      for (const child of node.childNodes ?? []) walk(child)
      if (node.content) walk(node.content)
    }
    walk(document)
  }
  if (errors.length)
    throw new Error(
      errors.slice(0, 30).join("\n") +
        (errors.length > 30 ? `\n另有 ${errors.length - 30} 项` : ""),
    )
  return {
    files: files.size,
    notes: manifest.files.filter((entry) => entry.type === "note").length,
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const { values } = parseArgs({
      options: { output: { type: "string" }, content: { type: "string" } },
    })
    const result = await validateBuild({
      output: values.output,
      content: values.content,
    })
    console.log(
      `构建校验通过，共 ${result.notes} 个页面输入、${result.files} 个产物文件`,
    )
  } catch (error) {
    console.error(`构建校验失败\n${error.message}`)
    process.exitCode = 1
  }
}
