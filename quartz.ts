import {
  loadQuartzConfig,
  loadQuartzLayout,
} from "./quartz/plugins/loader/config-loader"
import { frameRegistry } from "./quartz/components/frames/registry"
import { AwakenFrame, SiteBehavior } from "./site/components"
import site from "./site.config.mjs"

frameRegistry.register("awaken", AwakenFrame, "awaken")
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
