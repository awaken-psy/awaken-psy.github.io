/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import test from "node:test"
import assert from "node:assert/strict"
import { render } from "preact-render-to-string"
import { AwakenFrame, Home, TopicList, TopicNotes } from "../site/components"
import type { QuartzComponentProps } from "../quartz/components/types"
import site from "../site.config.mjs"
import { readNote } from "../scripts/lib/vault.mjs"

function props(files: unknown[]): QuartzComponentProps {
  return {
    fileData: { slug: "index" },
    allFiles: files,
  } as QuartzComponentProps
}

function note(index: number, published = true) {
  return {
    relativePath: `学习笔记/cg/笔记${index}.md`,
    slug: `学习笔记/cg/笔记${index}`,
    frontmatter: {
      title: `笔记${index}`,
      publish: published,
      updated: `2026-11-0${index}T00:00:00.000Z`,
    },
  }
}

test("首页文案、四类入口与五条稳定的最近更新", () => {
  const input = props([
    note(1),
    note(3),
    note(2),
    note(6),
    note(5),
    note(4),
    note(7, false),
  ])
  const first = render(<Home {...input} />)
  assert.match(first, /倘若重新穿越时光河流/)
  assert.match(first, /计算机基础/)
  assert.doesNotMatch(first, /沿着专题阅读|class="topic-grid"/)
  assert.match(first, /<span>01<\/span>探索笔记/)
  assert.match(first, /<span>02<\/span>最近更新/)
  assert.equal((first.match(/class="note-row internal"/gu) ?? []).length, 5)
  assert.ok(first.indexOf("笔记6") < first.indexOf("笔记5"))
  assert.doesNotMatch(first, /笔记7/)
  assert.equal(render(<Home {...input} />), first)
})

test("顶部导航按首页、专题、笔记、关于排列", () => {
  const html = render(
    AwakenFrame.render({
      componentData: {
        ...props([]),
        fileData: { slug: "topics", frontmatter: { kind: "topics" } },
        tree: { type: "root", children: [] },
      } as QuartzComponentProps,
      header: [],
      beforeBody: [],
      pageBody: () => <article />,
      afterBody: [],
      left: [],
      right: [],
    }),
  )
  const navigation = html.match(
    /<nav class="site-navigation"[^>]*>(.*?)<\/nav>/u,
  )?.[1]
  assert.ok(navigation)
  assert.deepEqual(
    [...navigation.matchAll(/>(首页|专题|笔记|关于)<\/a>/gu)].map(
      (match) => match[1],
    ),
    ["首页", "专题", "笔记", "关于"],
  )
  assert.match(navigation, /aria-current="page">专题<\/a>/)
})

test("专题按领域与直属文件夹生成，合并深层笔记并排除隐藏内容", () => {
  const input = props([
    { ...note(1), relativePath: "学习笔记/cg/cuda/入门/hello.md" },
    { ...note(2), relativePath: "学习笔记/cg/cuda/world.md" },
    { ...note(3), relativePath: "学习笔记/cg/new topic/notes.md" },
    { ...note(4), relativePath: "学习笔记/算法/hot100/两数之和.md" },
    { ...note(5, false), relativePath: "学习笔记/cg/私人专题/secret.md" },
    { ...note(6), relativePath: "学习笔记/cg/overview.md" },
    { ...note(7, false), relativePath: "学习笔记/cg/cuda/hidden.md" },
  ])
  const html = render(<TopicList {...input} />)
  assert.match(html, /图形学与渲染<\/h2><p>2 个专题/)
  assert.match(html, /算法<\/h2><p>1 个专题/)
  assert.match(html, /CUDA<\/h3>.*?2 篇笔记/)
  assert.match(html, /href="[^"]*学习笔记\/cg\/new-topic\/"/)
  assert.match(html, /href="[^"]*学习笔记\/算法\/hot100\/"/)
  assert.doesNotMatch(html, /私人专题|overview|计算机基础|入门<\/h3>/)
  assert.match(render(<TopicList {...props([])} />), /暂无公开专题/)
  const listing = render(
    <TopicNotes
      {...input}
      folder="学习笔记/cg/cuda"
      tree={{ type: "root", children: [] } as QuartzComponentProps["tree"]}
    />,
  )
  assert.equal((listing.match(/class="note-row internal"/gu) ?? []).length, 2)
  assert.match(listing, /入门\/hello/)
  assert.doesNotMatch(listing, /笔记3|笔记4|笔记5|笔记6|笔记7/)
})

test("空精选省略，已隐藏精选排除，最多展示六篇", () => {
  const original = [...site.featuredNotes]
  try {
    site.featuredNotes.splice(0)
    assert.doesNotMatch(render(<Home {...props([note(1)])} />), /精选笔记/)
    const names = Array.from(
      { length: 7 },
      (_, index) => note(index + 1).relativePath,
    )
    site.featuredNotes.push(...(names as never[]))
    const html = render(
      <Home
        {...props([
          note(1),
          note(2, false),
          note(3),
          note(4),
          note(5),
          note(6),
          note(7),
        ])}
      />,
    )
    const featured = html.slice(
      html.indexOf("精选笔记"),
      html.indexOf("最近更新"),
    )
    assert.doesNotMatch(featured, /笔记2|笔记7/)
    assert.match(featured, /笔记6/)
    assert.match(html, /<span>02<\/span>精选笔记/)
    assert.match(html, /<span>03<\/span>最近更新/)
  } finally {
    site.featuredNotes.splice(0, site.featuredNotes.length, ...original)
  }
})

test("不足五篇时按实际数量呈现，空公开集保持首页可用", () => {
  assert.equal(
    (
      render(<Home {...props([note(1), note(2)])} />).match(
        /class="note-row internal"/gu,
      ) ?? []
    ).length,
    2,
  )
  const empty = render(<Home {...props([])} />)
  assert.match(empty, /0 篇公开笔记/)
  assert.doesNotMatch(empty, /class="note-row internal"/)
})

test("更新日期依次取有效 updated、modified、date 和源修改时间", () => {
  const body =
    "---\nupdated: invalid\nmodified: 2026-11-03\ndate: 2026-11-01\n---\n# 日期"
  assert.equal(
    readNote("学习笔记/a.md", Buffer.from(body), Date.parse("2026-11-04"))
      .updated,
    "2026-11-03T00:00:00.000Z",
  )
  assert.equal(
    readNote("学习笔记/a.md", Buffer.from("# 日期"), Date.parse("2026-11-04"))
      .updated,
    "2026-11-04T00:00:00.000Z",
  )
})
