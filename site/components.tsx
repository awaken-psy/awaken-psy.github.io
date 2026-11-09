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

export function TopicList(props: QuartzComponentProps) {
  const notes = publicNotes(props)
  return (
    <div class="topic-grid">
      {site.topics.map((topic) => {
        const count = notes.filter((file) => inFolder(file, topic.path)).length
        return (
          count > 0 && (
            <a
              class="topic-item internal"
              href={link(props, `${topic.path}/index.md`)}
            >
              <span class="topic-glyph" aria-hidden="true">
                {topic.title === "CUDA"
                  ? "⌘"
                  : topic.title === "LearnOpenGL"
                    ? "◇"
                    : "◈"}
              </span>
              <div>
                <h3>{topic.title}</h3>
                <p>{topic.description}</p>
              </div>
              <span class="topic-count">
                {count} 篇 <span aria-hidden="true">↗</span>
              </span>
            </a>
          )
        )
      })}
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
        <div class="hero-baseline">
          <span>学习 · 推演 · 实践</span>
          <span>
            {notes.length} 篇公开笔记 <span class="baseline-divider">/</span> 4
            个学习方向
          </span>
        </div>
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
      <section class="home-section">
        <SectionTitle
          number="02"
          title="沿着专题阅读"
          href={link(props, "topics.md")}
        />
        <TopicList {...props} />
      </section>
      {featured.length > 0 && (
        <section class="home-section">
          <SectionTitle number="03" title="精选笔记" />
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
          number={featured.length > 0 ? "04" : "03"}
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
  const update = () => document.querySelectorAll(".rail-disclosure").forEach(node => { node.open = media.matches })
  update()
  media.addEventListener("change", update)
  window.addCleanup(() => media.removeEventListener("change", update))
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
    const hasHeading = (
      props.tree as { children?: { type: string; tagName?: string }[] }
    ).children?.some((node) => node.type === "element" && node.tagName === "h1")
    const current = String(props.fileData.slug ?? "index")
    return (
      <div class={home ? "awaken-shell is-home" : "awaken-shell"}>
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
              ["notes", "笔记"],
              ["topics", "专题"],
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
        ) : (
          <div class="reading-layout">
            <aside class="site-rail site-rail-left" aria-label="笔记分类">
              <details class="rail-disclosure" open>
                <summary>笔记目录</summary>
                <div class="rail-content">
                  {left.map((Component) => (
                    <Component {...props} />
                  ))}
                </div>
              </details>
            </aside>
            <main class="site-document" id="main-content">
              <div class="document-meta">
                {beforeBody.map((Component) => (
                  <Component {...props} />
                ))}
              </div>
              {!hasHeading && (
                <h1 class="document-title">
                  {props.fileData.frontmatter?.title}
                </h1>
              )}
              <Content {...props} />
              {kind === "topics" && <TopicList {...props} />}
              <div class="document-after">
                {afterBody.map((Component) => (
                  <Component {...props} />
                ))}
              </div>
            </main>
            <aside class="site-rail site-rail-right" aria-label="文章导航">
              <details class="rail-disclosure" open>
                <summary>本页导航</summary>
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
