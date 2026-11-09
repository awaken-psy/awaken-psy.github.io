// These four export-only corrections were approved during implementation.
export function correctSource(name, source) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n"
  let text = source.replaceAll("\r\n", "\n")
  const before = text
  if (name === "学习笔记/cg/games202/专题/ss/02-AO的物理-遮蔽积分.md") {
    text = text.replace(
      String.raw`（$L_{\text{amb}} = $ 常数 $c$）`,
      String.raw`（$L_{\text{amb}} = c$，其中 $c$ 为常数）`,
    )
  }
  if (name === "学习笔记/cg/games202/专题/ssgi/07-缺陷与混合管线.md") {
    text = text.replace("$$**UE5 Lumen", () => "$$\n\n**UE5 Lumen")
  }
  if (name === "学习笔记/计算机基础/csapp/lec11 The Memory Hierarchy.md") {
    text = text.replace(
      "- 平均访问时间（简化模型，实际还可能包含排队等开销）\n$$",
      "- 平均访问时间（简化模型，实际还可能包含排队等开销）\n\n$$",
    )
  }
  if (name === "学习笔记/ai/吴恩达/2.深度学习.md") {
    const start = text.indexOf("\t1. 记录 $g_t$")
    const end = text.indexOf("\n- 性质", start)
    if (start !== -1 && end !== -1) {
      const lines = text.slice(start, end).split("\n")
      const normalized = []
      for (let line of lines) {
        line = line
          .replace(/^\t\t/u, "     ")
          .replace(/^\t/u, "  ")
          .replace(/^ {3}(?=\S)/u, "     ")
        if (/^ {2}\d\. .*\$\$$/u.test(line)) {
          normalized.push(line.slice(0, -2), "", "     $$")
        } else if (line.trimEnd().endsWith(String.raw`\end{aligned}$$`)) {
          normalized.push(line.slice(0, -2), "     $$")
        } else normalized.push(line)
      }
      text = text.slice(0, start) + normalized.join("\n") + text.slice(end)
    }
  }
  if (text === before) return { source, corrected: false }
  return { source: text.replaceAll("\n", newline), corrected: true }
}
