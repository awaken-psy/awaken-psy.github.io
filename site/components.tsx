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

export function TopicList(props: QuartzComponentProps & { domain?: string }) {
  const domains = topicDomains(props).filter(
    (domain) => !props.domain || domain.path === props.domain,
  )
  return (
    <div class="topic-groups">
      {domains.map((domain, index) => (
        <section class="topic-domain" aria-label={domain.title}>
          {!props.domain && (
            <div class="topic-domain-heading">
              <h2 id={`topic-domain-${index}`}>{domain.title}</h2>
              <p>{domain.topics.length} 个专题</p>
            </div>
          )}
          <div
            class={props.domain ? "topic-grid domain-topic-grid" : "topic-grid"}
          >
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

export function TopicNotes(
  props: QuartzComponentProps & { folder: string; domain?: string },
) {
  const notes = publicNotes(props).filter((file) =>
    inFolder(file, props.folder),
  )
  const currentIndex = slugifyFilePath(`${props.folder}/index.md` as FilePath)
  const children = new Map<
    string,
    { path: string; title: string; isFolder: boolean }
  >()
  for (const file of notes) {
    const source = String(file.relativePath)
    if (slugifyFilePath(source as FilePath) === currentIndex) continue
    const parts = source.slice(props.folder.length + 1).split("/")
    if (parts.length > 1) {
      const path = `${props.folder}/${parts[0]}/index.md`
      if (children.has(path)) continue
      const folderIndex = slugifyFilePath(path as FilePath)
      const indexNote = notes.find(
        (note) =>
          slugifyFilePath(String(note.relativePath) as FilePath) ===
          folderIndex,
      )
      children.set(path, {
        path,
        title: indexNote?.frontmatter?.title ?? parts[0],
        isFolder: true,
      })
    } else {
      children.set(source, {
        path: source,
        title: file.frontmatter?.title ?? parts[0],
        isFolder: false,
      })
    }
  }
  const entries = [...children.values()]
    .filter((entry) => !props.domain || !entry.isFolder)
    .sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
      return a.title.localeCompare(b.title, "zh-CN", { numeric: true })
    })
  const folderCount = entries.filter((entry) => entry.isFolder).length
  const noteCount = entries.length - folderCount
  return (
    <div class="topic-notes">
      <article>{htmlToJsx(props.fileData.filePath!, props.tree)}</article>
      {props.domain && <TopicList {...props} domain={props.domain} />}
      {(!props.domain || entries.length > 0) && (
        <>
          <p class="topic-notes-count">
            共 {folderCount > 0 && <>{folderCount} 个文件夹，</>}
            {noteCount} 篇公开笔记
          </p>
          <div class="note-list">
            {entries.map((entry) => (
              <a class="note-row internal" href={link(props, entry.path)}>
                <span>
                  {entry.title}
                  {entry.isFolder && <span class="note-location">文件夹</span>}
                </span>
                <span class="note-arrow" aria-hidden="true">
                  {entry.isFolder ? "→" : "↗"}
                </span>
              </a>
            ))}
          </div>
        </>
      )}
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
let pendingDirectoryToggle
const readingSidebarPreference = {}
try {
  const saved = JSON.parse(localStorage.getItem("awaken.readingSidebar") || "{}")
  if (Number.isFinite(saved?.width)) readingSidebarPreference.width = saved.width
  if (typeof saved?.collapsed === "boolean") readingSidebarPreference.collapsed = saved.collapsed
} catch {}

document.addEventListener("nav", () => {
  const media = window.matchMedia("(min-width: 1100px)")
  const folderOverrides = new Map()
  if (pendingDirectoryToggle?.target === location.pathname) {
    folderOverrides.set(pendingDirectoryToggle.path, pendingDirectoryToggle.open)
  }
  pendingDirectoryToggle = undefined
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

  const layout = document.querySelector(".reading-layout")
  const panel = layout?.querySelector(".site-rail-left")
  const collapseButton = panel?.querySelector(".directory-collapse")
  const shell = layout?.closest(".awaken-shell")
  const restoreButton = shell?.querySelector(".directory-restore")
  const separator = layout?.querySelector(".directory-resizer")
  if (panel && collapseButton && restoreButton && separator) {
    let drag
    const savePreference = () => {
      try { localStorage.setItem("awaken.readingSidebar", JSON.stringify(readingSidebarPreference)) } catch {}
    }
    const widthRange = () => {
      const style = getComputedStyle(layout)
      const outline = parseFloat(style.getPropertyValue("--outline-width")) || 0
      const gap = parseFloat(style.getPropertyValue("--reading-gap")) || 0
      const available = Math.floor(layout.getBoundingClientRect().width - outline - gap * 2 - 480)
      return { min: 200, max: Math.max(200, Math.min(520, available)) }
    }
    const clampWidth = width => {
      const range = widthRange()
      return Math.round(Math.max(range.min, Math.min(range.max, width)))
    }
    const applySidebar = () => {
      const desktop = media.matches
      const collapsed = desktop && readingSidebarPreference.collapsed === true
      const fallback = parseFloat(getComputedStyle(layout).getPropertyValue("--directory-default-width")) || 260
      const width = clampWidth(readingSidebarPreference.width ?? fallback)
      layout.style.setProperty("--directory-width", width + "px")
      shell.classList.toggle("is-directory-collapsed", collapsed)
      panel.inert = collapsed
      if (collapsed) panel.setAttribute("aria-hidden", "true")
      else panel.removeAttribute("aria-hidden")
      collapseButton.setAttribute("aria-expanded", String(!collapsed))
      restoreButton.setAttribute("aria-expanded", String(!collapsed))
      const range = widthRange()
      separator.setAttribute("aria-valuemin", String(range.min))
      separator.setAttribute("aria-valuemax", String(range.max))
      separator.setAttribute("aria-valuenow", String(width))
      document.dispatchEvent(new Event("reading-layout-change"))
    }
    const finishDrag = event => {
      if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.id)) return
      const id = drag.id
      drag = undefined
      if (separator.hasPointerCapture(id)) separator.releasePointerCapture(id)
      document.documentElement.classList.remove("is-resizing-directory")
      savePreference()
    }
    const onPointerDown = event => {
      if (!media.matches || event.button !== 0 || drag) return
      event.preventDefault()
      drag = { id: event.pointerId, x: event.clientX, width: panel.getBoundingClientRect().width }
      separator.setPointerCapture(event.pointerId)
      document.documentElement.classList.add("is-resizing-directory")
    }
    const onPointerMove = event => {
      if (!drag || event.pointerId !== drag.id) return
      readingSidebarPreference.width = clampWidth(drag.width + event.clientX - drag.x)
      applySidebar()
    }
    const onSeparatorKey = event => {
      if (!media.matches) return
      const range = widthRange()
      const width = panel.getBoundingClientRect().width
      const next = { ArrowLeft: width - 16, ArrowRight: width + 16, Home: range.min, End: range.max }[event.key]
      if (typeof next !== "number") return
      event.preventDefault()
      finishDrag()
      readingSidebarPreference.width = clampWidth(next)
      applySidebar()
      savePreference()
    }
    const onCollapse = () => {
      finishDrag()
      readingSidebarPreference.collapsed = true
      applySidebar()
      savePreference()
      restoreButton.focus({ preventScroll: true })
    }
    const onRestore = () => {
      readingSidebarPreference.collapsed = false
      applySidebar()
      savePreference()
      collapseButton.focus({ preventScroll: true })
    }
    const onViewportChange = () => {
      finishDrag()
      applySidebar()
    }
    separator.addEventListener("pointerdown", onPointerDown)
    separator.addEventListener("pointermove", onPointerMove)
    separator.addEventListener("pointerup", finishDrag)
    separator.addEventListener("pointercancel", finishDrag)
    separator.addEventListener("lostpointercapture", finishDrag)
    separator.addEventListener("keydown", onSeparatorKey)
    collapseButton.addEventListener("click", onCollapse)
    restoreButton.addEventListener("click", onRestore)
    window.addEventListener("resize", onViewportChange)
    window.addEventListener("blur", finishDrag)
    applySidebar()
    window.addCleanup(() => {
      finishDrag()
      separator.removeEventListener("pointerdown", onPointerDown)
      separator.removeEventListener("pointermove", onPointerMove)
      separator.removeEventListener("pointerup", finishDrag)
      separator.removeEventListener("pointercancel", finishDrag)
      separator.removeEventListener("lostpointercapture", finishDrag)
      separator.removeEventListener("keydown", onSeparatorKey)
      collapseButton.removeEventListener("click", onCollapse)
      restoreButton.removeEventListener("click", onRestore)
      window.removeEventListener("resize", onViewportChange)
      window.removeEventListener("blur", finishDrag)
    })
  }

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
        const contents = folder.nextElementSibling
        const preferred = folderOverrides.get(folder.dataset.folderpath)
        if (preferred !== undefined && contents.classList.contains("open") !== preferred) {
          contents.classList.toggle("open", preferred)
        }
        const open = contents.classList.contains("open")
        contents.inert = !open
        folder.querySelector(".folder-button")?.setAttribute("aria-expanded", String(open))
        const title = folder.querySelector(".folder-title")?.textContent ?? "目录"
        icon.setAttribute("role", "button")
        icon.setAttribute("tabindex", "0")
        icon.setAttribute("aria-expanded", String(open))
        icon.setAttribute("aria-label", (open ? "收起 " : "展开 ") + title)
      })
    }
    const onDirectoryClick = event => {
      const icon = event.target.closest(".folder-icon")
      const link = event.target.closest("a.folder-button")
      if (!icon && !link) return
      if (link && (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return
      const folder = event.target.closest(".folder-container")
      const open = !folder.nextElementSibling.classList.contains("open")
      folderOverrides.set(folder.dataset.folderpath, open)
      if (link) {
        if (link.pathname === location.pathname) {
          event.preventDefault()
          event.stopPropagation()
        } else {
          pendingDirectoryToggle = { path: folder.dataset.folderpath, target: link.pathname, open }
        }
        folder.querySelector(".folder-icon").dispatchEvent(new MouseEvent("click", { bubbles: true }))
      }
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
    directory.addEventListener("click", onDirectoryClick, true)
    updateDirectory()
    window.addCleanup(() => {
      observer.disconnect()
      directory.removeEventListener("keydown", onDirectoryKey)
      directory.removeEventListener("click", onDirectoryClick, true)
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
  document.addEventListener("reading-layout-change", onScroll)
  window.addEventListener("resize", onScroll)
  updateOutline()
  window.addCleanup(() => {
    document.removeEventListener("scroll", onScroll)
    document.removeEventListener("reading-layout-change", onScroll)
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
    const domain = site.categories.find(
      (category) =>
        current === slugifyFilePath(`${category.path}/index.md` as FilePath),
    )
    const folderNote = current.endsWith("/index")
      ? publicNotes(props).find((note) =>
          slugifyFilePath(String(note.relativePath) as FilePath).startsWith(
            current.slice(0, -"index".length),
          ),
        )
      : undefined
    const folder =
      domain?.path ??
      (folderNote
        ? String(folderNote.relativePath)
            .split("/")
            .slice(0, current.split("/").length - 1)
            .join("/")
        : undefined)
    const topic = site.topics.find((entry) => entry.path === folder)
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
            {!home && kind !== "topics" && left.length > 0 && (
              <button
                type="button"
                class="directory-toggle directory-restore"
                aria-label="展开目录"
                title="展开目录"
                aria-controls="awaken-directory-panel"
                aria-expanded="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M9 4v16m4-11 3 3-3 3" />
                </svg>
              </button>
            )}
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
            <aside
              class="site-rail site-rail-left"
              aria-label="笔记分类"
              id="awaken-directory-panel"
            >
              {left.length > 0 && (
                <div class="directory-toolbar">
                  <button
                    type="button"
                    class="directory-toggle directory-collapse"
                    aria-label="收起目录"
                    title="收起目录"
                    aria-controls="awaken-directory-panel"
                    aria-expanded="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M9 4v16m7-11-3 3 3 3" />
                    </svg>
                  </button>
                </div>
              )}
              <nav class="rail-content" aria-label="领域目录">
                {left.map((Component) => (
                  <Component {...props} />
                ))}
              </nav>
            </aside>
            {left.length > 0 && (
              <div
                class="directory-resizer"
                role="separator"
                aria-label="调整目录宽度"
                aria-orientation="vertical"
                aria-controls="awaken-directory-panel"
                aria-valuemin={200}
                aria-valuemax={520}
                aria-valuenow={260}
                tabIndex={0}
              />
            )}
            <main class="site-document" id="main-content">
              <header class="document-heading">
                {heading ? (
                  htmlToJsx(props.fileData.filePath!, heading)
                ) : (
                  <h1 class="document-title">
                    {domain?.title ??
                      topic?.title ??
                      props.fileData.frontmatter?.title}
                  </h1>
                )}
                <div class="document-meta">
                  {beforeBody.map((Component) => (
                    <Component {...props} />
                  ))}
                </div>
              </header>
              {folder ? (
                <TopicNotes
                  {...props}
                  tree={bodyTree}
                  folder={folder}
                  domain={domain?.path}
                />
              ) : (
                <Content {...props} tree={bodyTree} />
              )}
              <div class="document-after">
                {afterBody.map((Component) => (
                  <Component {...props} />
                ))}
              </div>
            </main>
            {right.length > 0 && (
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
            )}
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
