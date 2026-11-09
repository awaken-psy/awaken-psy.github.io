import type {
  QuartzComponent,
  QuartzComponentProps,
} from "../quartz/components/types"
import type { PageFrame } from "../quartz/components/frames/types"
import {
  resolveRelative,
  slugifyFilePath,
  type FullSlug,
  type FilePath,
} from "../quartz/util/path"
import site from "../site.config.mjs"
import { htmlToJsx } from "../quartz/util/jsx"
import type { Root } from "hast"

function link(props: QuartzComponentProps, target: string) {
  return resolveRelative(
    props.fileData.slug ?? ("index" as FullSlug),
    slugifyFilePath(target as FilePath),
  )
}

function publicNotes(props: QuartzComponentProps) {
  return props.allFiles.filter(
    (file) => file.frontmatter?.publish === true && !file.frontmatter?.kind,
  )
}

function inFolder(file: QuartzComponentProps["fileData"], folder: string) {
  return String(file.relativePath ?? "").startsWith(`${folder}/`)
}

function Sphere() {
  return (
    <div class="hero-geometry" aria-hidden="true">
      <div class="geometry-label">01 / LIGHT &amp; SPACE</div>
      <svg viewBox="0 0 360 300" fill="none">
        <g
          transform="translate(180 147) rotate(-22)"
          stroke="currentColor"
          stroke-width="0.8"
        >
          <circle r="108" />
          {[28, 55, 79, 97].map((radius) => (
            <ellipse rx={radius} ry="108" />
          ))}
          {[28, 55, 79, 97].map((radius) => (
            <ellipse rx="108" ry={radius} />
          ))}
          <path
            d="M-135 0H135M0-135V135"
            opacity=".45"
            stroke-dasharray="3 5"
          />
        </g>
        <circle cx="279" cy="105" r="3" fill="currentColor" />
        <path d="M279 105h38l14-14" stroke="currentColor" />
      </svg>
      <span class="geometry-coordinate">x / y / z</span>
    </div>
  )
}

function SectionTitle({
  number,
  title,
  href,
  label = "查看全部",
}: {
  number: string
  title: string
  href?: string
  label?: string
}) {
  return (
    <div class="section-heading">
      <h2>
        <span>{number}</span>
        {title}
      </h2>
      {href && (
        <a class="quiet-link internal" href={href}>
          {label}
          <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  )
}

function topicDomains(props: QuartzComponentProps) {
  const notes = publicNotes(props)
  return site.categories
    .map((category) => {
      const counts = new Map<string, number>()
      for (const file of notes.filter((note) =>
        inFolder(note, category.path),
      )) {
        const parts = String(file.relativePath)
          .slice(category.path.length + 1)
          .split("/")
        if (parts.length < 2) continue
        const path = `${category.path}/${parts[0]}`
        counts.set(path, (counts.get(path) ?? 0) + 1)
      }
      const topics = [...counts].map(([path, count]) => {
        const configured = site.topics.find((topic) => topic.path === path)
        return {
          path,
          count,
          title: configured?.title ?? path.split("/").at(-1)!,
          description: configured?.description,
        }
      })
      topics.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"))
      return { ...category, topics }
    })
    .filter((domain) => domain.topics.length > 0)
}

export function TopicList(props: QuartzComponentProps) {
  const domains = topicDomains(props)
  return (
    <div class="topic-groups">
      {domains.map((domain, index) => (
        <section class="topic-domain" aria-labelledby={`topic-domain-${index}`}>
          <div class="topic-domain-heading">
            <h2 id={`topic-domain-${index}`}>{domain.title}</h2>
            <p>{domain.topics.length} 个专题</p>
          </div>
          <div class="topic-grid">
            {domain.topics.map((topic) => (
              <a
                class="topic-item internal"
                href={link(props, `${topic.path}/index.md`)}
              >
                <h3>{topic.title}</h3>
                {topic.description && <p>{topic.description}</p>}
                <div class="topic-count">
                  <span>{topic.count} 篇笔记</span>
                  <span aria-hidden="true">↗</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
      {domains.length === 0 && <p class="topics-empty">暂无公开专题。</p>}
    </div>
  )
}

export function TopicNotes(props: QuartzComponentProps & { folder: string }) {
  const notes = publicNotes(props)
    .filter((file) => inFolder(file, props.folder))
    .sort((a, b) =>
      String(a.relativePath).localeCompare(String(b.relativePath), "zh-CN", {
        numeric: true,
      }),
    )
  return (
    <div class="topic-notes">
      <article>{htmlToJsx(props.fileData.filePath!, props.tree)}</article>
      <p class="topic-notes-count">共 {notes.length} 篇公开笔记</p>
      <div class="note-list">
        {notes.map((file) => (
          <a
            class="note-row internal"
            href={link(props, String(file.relativePath))}
          >
            <span>{file.frontmatter?.title}</span>
            <span class="note-arrow" aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

export function Home(props: QuartzComponentProps) {
  const notes = publicNotes(props)
  const recent = [...notes]
    .sort((a, b) => {
      const order = String(b.frontmatter?.updated ?? "").localeCompare(
        String(a.frontmatter?.updated ?? ""),
      )
      return (
        order ||
        String(a.relativePath).localeCompare(String(b.relativePath), "en")
      )
    })
    .slice(0, 5)
  const featured = site.featuredNotes
    .slice(0, 6)
    .flatMap((name: string) =>
      notes.filter((file) => file.relativePath === name),
    )
  return (
    <main id="main-content" class="site-home">
      <section class="home-hero">
        <div class="hero-copy">
          <p class="eyebrow">
            <span class="status-dot" />
            PERSONAL NOTES / DIGITAL GARDEN
          </p>
          <h1>
            awaken
            <span class="hero-period" aria-hidden="true">
              .
            </span>
          </h1>
          <p class="hero-description">{site.description}</p>
          <div class="hero-actions">
            <a class="primary-link internal" href={link(props, "notes.md")}>
              浏览笔记 <span aria-hidden="true">↗</span>
            </a>
            <a class="quiet-link internal" href={link(props, "topics.md")}>
              探索专题 <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
        <Sphere />
      </section>
      <section class="home-section">
        <SectionTitle
          number="01"
          title="探索笔记"
          href={link(props, "notes.md")}
        />
        <div class="category-grid">
          {site.categories.map((category, index) => (
            <a
              class="category-card internal"
              href={link(props, `${category.path}/index.md`)}
            >
              <div class="category-topline">
                <span class="category-number">0{index + 1}</span>
                <span aria-hidden="true">↗</span>
              </div>
              <p class="category-label">{category.label}</p>
              <h3>{category.title}</h3>
              <p class="category-description">{category.description}</p>
              <span class="category-total">
                {notes.filter((file) => inFolder(file, category.path)).length}
                <span>篇笔记</span>
              </span>
            </a>
          ))}
        </div>
      </section>
      {featured.length > 0 && (
        <section class="home-section">
          <SectionTitle number="02" title="精选笔记" />
          <div class="note-list">
            {featured.map((file) => (
              <a
                class="note-row internal"
                href={link(props, String(file.relativePath))}
              >
                <span>{file.frontmatter?.title}</span>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </section>
      )}
      <section class="home-section recent-section">
        <SectionTitle
          number={featured.length > 0 ? "03" : "02"}
          title="最近更新"
          href={link(props, "notes.md")}
        />
        <div class="note-list">
          {recent.map((file) => (
            <a
              class="note-row internal"
              href={link(props, String(file.relativePath))}
            >
              <time dateTime={String(file.frontmatter?.updated)}>
                {String(file.frontmatter?.updated)
                  .slice(0, 10)
                  .replaceAll("-", ".")}
              </time>
              <div>
                <h3>{file.frontmatter?.title}</h3>
                <span class="note-location">
                  {String(file.relativePath)
                    .split("/")
                    .slice(1, -1)
                    .join(" / ")}
                </span>
              </div>
              <span class="note-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}

export const SiteBehavior: QuartzComponent = () => null
SiteBehavior.afterDOMLoaded = `
document.addEventListener("nav", () => {
  const media = window.matchMedia("(min-width: 1100px)")
  const menus = document.querySelectorAll(".rail-disclosure")
  const syncMenu = event => {
    const menu = event.currentTarget
    menu.querySelector("summary").setAttribute("aria-expanded", String(menu.open))
    if (menu.open) menu.querySelector(".explorer-ul a.active")?.scrollIntoView({ block: "nearest" })
  }
  menus.forEach(menu => menu.addEventListener("toggle", syncMenu))
  const update = () => menus.forEach(menu => {
    menu.open = media.matches
    menu.querySelector("summary").setAttribute("aria-expanded", String(menu.open))
  })
  update()
  media.addEventListener("change", update)
  window.addCleanup(() => {
    media.removeEventListener("change", update)
    menus.forEach(menu => menu.removeEventListener("toggle", syncMenu))
  })

  const directory = document.querySelector(".site-rail-left .explorer-content")
  if (directory) {
    const updateDirectory = () => {
      directory.querySelectorAll("a").forEach(link => {
        link.title = link.textContent.trim()
        if (link.classList.contains("active")) link.setAttribute("aria-current", "page")
        else link.removeAttribute("aria-current")
      })
      directory.querySelectorAll(".folder-icon").forEach(icon => {
        const folder = icon.closest(".folder-container")
        const open = folder.nextElementSibling?.classList.contains("open") ?? false
        const title = folder.querySelector(".folder-title")?.textContent ?? "目录"
        icon.setAttribute("role", "button")
        icon.setAttribute("tabindex", "0")
        icon.setAttribute("aria-expanded", String(open))
        icon.setAttribute("aria-label", (open ? "收起 " : "展开 ") + title)
      })
    }
    const onDirectoryKey = event => {
      if (event.key !== "Enter" && event.key !== " ") return
      const icon = event.target.closest(".folder-icon")
      if (!icon) return
      event.preventDefault()
      icon.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    }
    const observer = new MutationObserver(updateDirectory)
    observer.observe(directory, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] })
    directory.addEventListener("keydown", onDirectoryKey)
    updateDirectory()
    window.addCleanup(() => {
      observer.disconnect()
      directory.removeEventListener("keydown", onDirectoryKey)
    })
  }

  const sections = Array.from(document.querySelectorAll(".site-rail-right .toc-content a[data-for]"))
    .map(link => {
      link.title = link.textContent.trim()
      return { link, heading: document.getElementById(link.dataset.for) }
    })
    .filter(section => section.heading)
  if (sections.length === 0) return
  let frame
  const updateOutline = () => {
    frame = undefined
    const offset = document.querySelector(".site-topbar").getBoundingClientRect().bottom + 26
    let active = sections[0]
    for (const section of sections) {
      if (section.heading.getBoundingClientRect().top > offset) break
      active = section
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      active = sections[sections.length - 1]
    }
    sections.forEach(section => {
      if (section === active) section.link.setAttribute("aria-current", "location")
      else section.link.removeAttribute("aria-current")
    })
  }
  const onScroll = () => {
    if (frame === undefined) frame = requestAnimationFrame(updateOutline)
  }
  document.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll)
  updateOutline()
  window.addCleanup(() => {
    document.removeEventListener("scroll", onScroll)
    window.removeEventListener("resize", onScroll)
    if (frame !== undefined) cancelAnimationFrame(frame)
  })
})
`

export const AwakenFrame: PageFrame = {
  name: "awaken",
  render({
    componentData: props,
    header,
    beforeBody,
    pageBody: Content,
    afterBody,
    left,
    right,
  }) {
    const kind = props.fileData.frontmatter?.kind
    const home = kind === "home"
    const tree = props.tree as Root
    const heading = tree.children?.find(
      (node) => node.type === "element" && node.tagName === "h1",
    )
    const bodyTree = heading
      ? { ...tree, children: tree.children.filter((node) => node !== heading) }
      : tree
    const current = String(props.fileData.slug ?? "index")
    const topic = current.endsWith("/index")
      ? topicDomains(props)
          .flatMap((domain) => domain.topics)
          .find(
            (entry) =>
              current === slugifyFilePath(`${entry.path}/index.md` as FilePath),
          )
      : undefined
    return (
      <div
        class={
          home
            ? "awaken-shell is-home"
            : kind === "topics"
              ? "awaken-shell"
              : "awaken-shell is-reading"
        }
      >
        <a class="skip-link" href="#main-content">
          跳转到正文
        </a>
        <header class="site-topbar">
          <a
            class="site-brand internal"
            href={link(props, "index.md")}
            aria-label="awaken 首页"
          >
            <span class="brand-mark" aria-hidden="true">
              a
            </span>
            awaken
            <span class="brand-slash" aria-hidden="true">
              /
            </span>
          </a>
          <nav class="site-navigation" aria-label="主要导航">
            {[
              ["index", "首页"],
              ["topics", "专题"],
              ["notes", "笔记"],
              ["about", "关于"],
            ].map(([slug, label]) => (
              <a
                class="internal"
                href={link(props, `${slug}.md`)}
                aria-current={current === slug ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <div class="site-tools">
            {header.map((Component) => (
              <Component {...props} />
            ))}
          </div>
        </header>
        {home ? (
          <Home {...props} />
        ) : kind === "topics" ? (
          <main class="site-topics" id="main-content">
            <header class="topics-intro">
              <h1>{props.fileData.frontmatter?.title}</h1>
              <Content {...props} />
            </header>
            <TopicList {...props} />
          </main>
        ) : (
          <div class="reading-layout">
            <aside class="site-rail site-rail-left" aria-label="笔记分类">
              <nav class="rail-content" aria-label="领域目录">
                {left.map((Component) => (
                  <Component {...props} />
                ))}
              </nav>
            </aside>
            <main class="site-document" id="main-content">
              <header class="document-heading">
                {heading ? (
                  htmlToJsx(props.fileData.filePath!, heading)
                ) : (
                  <h1 class="document-title">
                    {topic?.title ?? props.fileData.frontmatter?.title}
                  </h1>
                )}
                <div class="document-meta">
                  {beforeBody.map((Component) => (
                    <Component {...props} />
                  ))}
                </div>
              </header>
              {topic ? (
                <TopicNotes {...props} tree={bodyTree} folder={topic.path} />
              ) : (
                <Content {...props} tree={bodyTree} />
              )}
              <div class="document-after">
                {afterBody.map((Component) => (
                  <Component {...props} />
                ))}
              </div>
            </main>
            <aside class="site-rail site-rail-right" aria-label="文章导航">
              <details class="rail-disclosure" open>
                <summary role="button" aria-expanded="true">
                  本页大纲
                </summary>
                <div class="rail-content">
                  {right.map((Component) => (
                    <Component {...props} />
                  ))}
                </div>
              </details>
            </aside>
          </div>
        )}
        <footer class="site-footer">
          <span>
            awaken <span class="footer-separator">/</span> 倘若重新穿越时光河流
          </span>
          <a href={site.links.GitHub} target="_blank" rel="noopener noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </footer>
      </div>
    )
  },
}
