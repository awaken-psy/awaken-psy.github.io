import path from "node:path"
import { parseFragment } from "parse5"
import postcss from "postcss"
import valueParser from "postcss-value-parser"
import parseSrcset from "parse-srcset"
import { slugifyFilePath } from "@quartz-community/utils/path"
import { markdown, pathKey } from "./vault.mjs"

const hiddenLabel = "未公开笔记"
const downloadable =
  /\.(?:png|jpe?g|gif|webp|avif|svg|pdf|html?|css|js|woff2?|mp[34]|webm|ogg)$/iu
const htmlEscape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")

// Quartz strips .html from asset names. .htm keeps HTML attachments addressable.
export function assetOutputPath(name) {
  return name.replace(/\.html$/iu, ".htm")
}

export function createReferenceProcessor(vault) {
  const paths = new Map()
  const names = new Map()
  const aliases = new Map()
  const assets = new Map()
  const warnings = []
  const graph = new Map()
  const noteEdits = new Map()

  function index(map, key, name) {
    const normalized = pathKey(key)
    const values = map.get(normalized) ?? []
    if (!values.includes(name)) values.push(name)
    map.set(normalized, values)
  }

  for (const name of vault.files.keys()) {
    if (paths.has(pathKey(name)))
      throw new Error(`文件路径规范化后重复 ${name}`)
    paths.set(pathKey(name), name)
    index(names, path.posix.basename(name), name)
    if (vault.notes.has(name)) {
      index(names, path.posix.basename(name, ".md"), name)
      for (const alias of vault.notes.get(name).aliases)
        index(aliases, alias, name)
    }
  }

  function unique(candidates, raw, from) {
    if (!candidates?.length) return undefined
    if (candidates.length > 1)
      throw new Error(
        `${from} 中的引用 ${raw} 存在歧义\n${candidates.join("\n")}`,
      )
    return candidates[0]
  }

  function resolve(raw, from, required = false) {
    if (/^(?:https?:|mailto:|tel:|data:|\/\/)/iu.test(raw))
      return { kind: "external", url: raw }
    if (/^(?:[a-z][a-z\d+.-]*:|\\\\)/iu.test(raw)) {
      if (required)
        throw new Error(`${from} 的必要资源使用本机或不支持的地址 ${raw}`)
      warnings.push({
        path: from,
        target: raw,
        reason: "本机链接已转换为纯文本",
      })
      return { kind: "local" }
    }
    const fragment = raw.indexOf("#")
    const anchor = fragment < 0 ? "" : raw.slice(fragment)
    const beforeAnchor = fragment < 0 ? raw : raw.slice(0, fragment)
    const queryIndex = beforeAnchor.indexOf("?")
    const query = queryIndex < 0 ? "" : beforeAnchor.slice(queryIndex)
    let target =
      queryIndex < 0 ? beforeAnchor : beforeAnchor.slice(0, queryIndex)
    try {
      target = decodeURIComponent(target)
    } catch {
      /* Literal percent signs are valid filenames. */
    }
    target = target.replaceAll("\\", "/")
    if (!target) return { kind: "external", url: raw }
    const relative = path.posix.normalize(
      path.posix.join(path.posix.dirname(from), target),
    )
    const absolute = path.posix.normalize(target.replace(/^\//u, ""))
    let candidates = target.startsWith("/") ? [absolute] : [relative, absolute]
    if (
      candidates.every(
        (candidate) => candidate === ".." || candidate.startsWith("../"),
      )
    ) {
      if (required) throw new Error(`${from} 的资源指向笔记库外部 ${raw}`)
      warnings.push({
        path: from,
        target: raw,
        reason: "库外链接已转换为纯文本",
      })
      return { kind: "local" }
    }
    candidates = candidates.filter(
      (candidate) => !candidate.startsWith("../") && candidate !== "..",
    )
    let name
    for (const candidate of candidates) {
      name =
        paths.get(pathKey(candidate)) ?? paths.get(pathKey(`${candidate}.md`))
      if (name) break
    }
    if (!name && !target.includes("/") && !target.startsWith(".")) {
      name =
        unique(names.get(pathKey(target)), raw, from) ??
        unique(aliases.get(pathKey(target)), raw, from)
    }
    if (
      !name &&
      target.includes("/") &&
      !target.startsWith(".") &&
      !target.startsWith("/")
    ) {
      const suffix = pathKey(target)
      name = unique(
        vault.names.filter((candidate) => {
          const key = pathKey(candidate)
          return key.endsWith(`/${suffix}`) || key.endsWith(`/${suffix}.md`)
        }),
        raw,
        from,
      )
    }
    if (!name) {
      if (required || downloadable.test(target))
        throw new Error(`${from} 缺少必要资源 ${raw}`)
      warnings.push({
        path: from,
        target: raw,
        reason: "缺失笔记链接已转换为纯文本",
      })
      return { kind: "missing" }
    }
    const note = vault.notes.get(name)
    if (note)
      return {
        kind: note.published ? "note" : "hidden",
        path: name,
        note,
        anchor,
        query,
      }
    return { kind: "asset", path: name, anchor, query }
  }

  function canonical(target) {
    const name =
      target.kind === "asset" ? assetOutputPath(target.path) : target.path
    return name + target.query + target.anchor
  }

  function relativeOutput(target, from) {
    const source = vault.notes.has(from) ? from : assetOutputPath(from)
    const destination =
      target.kind === "asset" ? assetOutputPath(target.path) : target.path
    let relative = path.posix.relative(
      path.posix.dirname(slugifyFilePath(source)),
      slugifyFilePath(destination),
    )
    if (!relative.startsWith(".")) relative = `./${relative}`
    return relative + target.query + target.anchor
  }

  function collectAsset(target) {
    if (assets.has(target.path)) return
    const file = vault.files.get(target.path)
    assets.set(target.path, file.bytes)
    const extension = path.posix.extname(target.path).toLowerCase()
    if ([".html", ".htm", ".svg"].includes(extension)) {
      assets.set(
        target.path,
        Buffer.from(rewriteHtml(file.bytes.toString("utf8"), target.path)),
      )
    } else if (extension === ".css") {
      assets.set(
        target.path,
        Buffer.from(rewriteCss(file.bytes.toString("utf8"), target.path)),
      )
    }
  }

  function resolveResource(raw, from, coreTransforms = false) {
    const target = resolve(raw, from, true)
    if (target.kind === "external") return raw
    if (target.kind === "hidden") return null
    if (target.kind === "asset") collectAsset(target)
    return coreTransforms ? canonical(target) : relativeOutput(target, from)
  }

  function rewriteCss(source, from) {
    const tree = postcss.parse(source, { from: undefined })
    const rewriteValue = (value, isImport = false) => {
      const parsed = valueParser(value)
      parsed.walk((node) => {
        if (node.type === "function" && node.value.toLowerCase() === "url") {
          const raw = valueParser
            .stringify(node.nodes)
            .trim()
            .replace(/^(['"])([\s\S]*)\1$/u, "$2")
          const url = resolveResource(raw, from) ?? ""
          node.nodes = [{ type: "string", quote: '"', value: url }]
          return false
        }
        if (isImport && node.type === "string")
          node.value = resolveResource(node.value, from) ?? ""
      })
      return parsed.toString()
    }
    tree.walkDecls((declaration) => {
      declaration.value = rewriteValue(declaration.value)
    })
    tree.walkAtRules("import", (rule) => {
      rule.params = rewriteValue(rule.params, true)
    })
    return tree.toString()
  }

  function rewriteHtml(source, from) {
    const tree = parseFragment(source, { sourceCodeLocationInfo: true })
    const edits = []
    const isNote = vault.notes.has(from)
    function walk(node) {
      const location = node.sourceCodeLocation
      const editStart = edits.length
      if (node.nodeName === "#comment" && location) {
        edits.push({
          start: location.startOffset,
          end: location.endOffset,
          text: "",
        })
        return
      }
      for (const attribute of node.attrs ?? []) {
        const key = attribute.prefix
          ? `${attribute.prefix}:${attribute.name}`
          : attribute.name
        const range = location?.attrs?.[key]
        if (!range) continue
        let value = attribute.value
        if (key === "style") value = rewriteCss(value, from)
        else if (key === "srcset") {
          value = parseSrcset(value)
            .map((item) => {
              const url = resolveResource(item.url, from)
              const descriptor = item.w
                ? `${item.w}w`
                : item.d
                  ? `${item.d}x`
                  : ""
              return url ? [url, descriptor].filter(Boolean).join(" ") : ""
            })
            .filter(Boolean)
            .join(", ")
        } else if (
          ["src", "href", "xlink:href", "data", "poster"].includes(key)
        ) {
          const isLink = key === "href" && node.tagName === "a"
          const target = resolve(value, from, !isLink)
          if (target.kind === "external") continue
          if (target.kind === "hidden" && !isLink) {
            edits.splice(editStart)
            edits.push({
              start: location.startOffset,
              end: location.endOffset,
              text: `<span>${hiddenLabel}</span>`,
            })
            return
          }
          if (["hidden", "missing", "local"].includes(target.kind)) {
            edits.push({
              start: range.startOffset,
              end: range.endOffset,
              text: "",
            })
            continue
          }
          if (target.kind === "asset") collectAsset(target)
          const coreTransforms =
            isNote &&
            ((key === "src" &&
              ["img", "video", "audio", "iframe"].includes(node.tagName)) ||
              isLink)
          value = coreTransforms
            ? canonical(target)
            : relativeOutput(target, from)
        } else continue
        edits.push({
          start: range.startOffset,
          end: range.endOffset,
          text: `${key}="${htmlEscape(value)}"`,
        })
      }
      if (node.tagName === "style") {
        for (const child of node.childNodes ?? []) {
          if (child.nodeName === "#text" && child.sourceCodeLocation) {
            edits.push({
              start: child.sourceCodeLocation.startOffset,
              end: child.sourceCodeLocation.endOffset,
              text: rewriteCss(child.value, from),
            })
          }
        }
      }
      for (const child of node.childNodes ?? []) walk(child)
      if (node.content) walk(node.content)
    }
    walk(tree)
    let result = source
    for (const edit of edits.sort((a, b) => b.start - a.start))
      result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
    return result
  }

  function rewriteNote(note) {
    const definitions = new Map()
    const edges = []
    const edits = []
    function findDefinitions(node) {
      if (node.type === "definition")
        definitions.set(node.identifier.toLowerCase(), node)
      for (const child of node.children ?? []) findDefinitions(child)
    }
    findDefinitions(note.tree)
    function transform(node) {
      if (["yaml", "comment", "definition"].includes(node.type)) return []
      if (node.type === "html")
        return [{ ...node, value: rewriteHtml(node.value, note.path) }]
      if (["code", "inlineCode", "math", "inlineMath"].includes(node.type))
        return [node]
      if (node.children) node.children = node.children.flatMap(rewrite)
      if (["linkReference", "imageReference"].includes(node.type)) {
        const definition = definitions.get(node.identifier.toLowerCase())
        if (!definition) return [node]
        node = {
          ...node,
          type: node.type === "imageReference" ? "image" : "link",
          url: definition.url,
          title: definition.title,
        }
      }
      if (!["wikilink", "link", "image"].includes(node.type)) return [node]
      const wiki = node.type === "wikilink"
      const embedded = wiki ? node.embedded : node.type === "image"
      const raw = wiki
        ? node.path + (node.heading ? `#${node.heading}` : "")
        : node.url
      const target = resolve(raw, note.path, embedded)
      if (target.kind === "external") return [node]
      if (["hidden", "missing", "local"].includes(target.kind)) {
        if (embedded || (target.kind === "hidden" && wiki && !node.alias))
          return [{ type: "text", value: hiddenLabel }]
        if (wiki) return [{ type: "text", value: node.alias || node.value }]
        return node.children ?? [{ type: "text", value: node.alt ?? "" }]
      }
      if (target.kind === "asset") collectAsset(target)
      if (wiki) {
        node.path =
          target.kind === "asset" ? assetOutputPath(target.path) : target.path
        if (target.kind === "note" && !node.alias)
          node.alias = target.note.title
        if (embedded && target.kind === "note")
          edges.push({ node, target: target.path })
      } else node.url = canonical(target)
      return [node]
    }
    function rewrite(node) {
      const result = transform(node)
      if (
        [
          "comment",
          "definition",
          "html",
          "wikilink",
          "link",
          "image",
          "linkReference",
          "imageReference",
        ].includes(node.type) &&
        node.position
      ) {
        edits.push({
          start: node.position.start.offset,
          end: node.position.end.offset,
          nodes: result,
        })
      }
      return result
    }
    note.tree.children = note.tree.children.flatMap(rewrite)
    graph.set(note.path, edges)
    noteEdits.set(note, edits)
  }

  function limitEmbedCycles() {
    const completed = new Set()
    const active = new Set()
    function walk(name) {
      active.add(name)
      for (const edge of graph.get(name) ?? []) {
        if (active.has(edge.target)) edge.node.embedded = false
        else if (!completed.has(edge.target)) walk(edge.target)
      }
      active.delete(name)
      completed.add(name)
    }
    for (const name of graph.keys()) if (!completed.has(name)) walk(name)
    for (const [note, edits] of noteEdits) {
      const disjoint = []
      for (const edit of edits.sort(
        (a, b) => a.start - b.start || b.end - a.end,
      )) {
        if (!disjoint.length || edit.start >= disjoint.at(-1).end)
          disjoint.push(edit)
      }
      let body = note.body
      for (const edit of disjoint.reverse()) {
        let replacement = ""
        if (edit.nodes.length === 1 && edit.nodes[0].type === "html")
          replacement = edit.nodes[0].value
        else if (edit.nodes.length) {
          replacement = markdown
            .stringify({
              type: "root",
              children: [{ type: "paragraph", children: edit.nodes }],
            })
            .replace(/\n+$/u, "")
        }
        body = body.slice(0, edit.start) + replacement + body.slice(edit.end)
      }
      note.exportedBody = body
    }
  }

  return { rewriteNote, limitEmbedCycles, assets, warnings }
}
