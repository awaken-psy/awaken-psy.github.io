import {
  loadQuartzConfig,
  loadQuartzLayout,
} from "./quartz/plugins/loader/config-loader"
import { frameRegistry } from "./quartz/components/frames/registry"
import { componentRegistry } from "./quartz/components/registry"
import { slugifyFilePath, type FilePath } from "./quartz/util/path"
import { AwakenFrame, SiteBehavior } from "./site/components"
import site from "./site.config.mjs"

frameRegistry.register("awaken", AwakenFrame, "awaken")
const directoryDomains = site.categories.map(({ path, title }) => ({
  path: slugifyFilePath(`${path}/index.md` as FilePath).replace(
    /\/index$/u,
    "",
  ),
  title,
}))
// Explorer serializes callbacks for the browser, so embed the configured domains.
componentRegistry.setOptionOverrides("@quartz-community/explorer", {
  mapFn: new Function(
    "node",
    `
    if (node.slugSegments.length === 0) {
      const domains = ${JSON.stringify(directoryDomains)}
      const learning = node.children.find(child => child.slugSegment === "学习笔记")
      const children = learning?.children ?? []
      node.children = domains.flatMap(domain => {
        const child = children.find(entry => entry.slugSegments.join("/") === domain.path)
        if (!child) return []
        child.displayName = domain.title
        return [child]
      })
    }
    return node
  `,
  ),
  sortFn: new Function(
    "a",
    "b",
    `
    const roots = ${JSON.stringify(directoryDomains.map((domain) => domain.path))}
    const aIndex = roots.indexOf(a.slugSegments.join("/"))
    const bIndex = roots.indexOf(b.slugSegments.join("/"))
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
    return a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: "base" })
  `,
  ),
})
const config = await loadQuartzConfig()
const url = new URL(process.env.SITE_URL ?? site.url)
config.configuration.baseUrl = `${url.host}${url.pathname.replace(/\/$/, "")}`
export default config
const baseLayout = await loadQuartzLayout()
export const layout = await loadQuartzLayout({
  defaults: {
    frame: "awaken",
    header: [...(baseLayout.defaults.header ?? []), SiteBehavior],
  },
  byPageType: Object.fromEntries(
    ["content", "folder", "tag", "404"].map((name) => [
      name,
      { frame: "awaken" },
    ]),
  ),
})
