import http from "node:http"
import path from "node:path"
import handler from "serve-handler"
import site from "../site.config.mjs"

const host = "127.0.0.1"
const port = Number(process.env.PORT ?? 8080)
const basePath = new URL(process.env.SITE_URL ?? site.url).pathname.replace(
  /\/$/u,
  "",
)
const directory = path.resolve(process.env.PREVIEW_DIRECTORY ?? "public")
const server = http.createServer((request, response) => {
  if (basePath && !request.url.startsWith(`${basePath}/`)) {
    response.writeHead(302, { Location: `${basePath}/` })
    response.end()
    return
  }
  request.url = request.url.slice(basePath.length) || "/"
  return handler(request, response, {
    public: directory,
    cleanUrls: true,
    directoryListing: false,
    headers: [
      { source: "**", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ],
  })
})
server.listen(port, host, () =>
  console.log(`本地预览 http://${host}:${port}${basePath}/`),
)
server.on("error", (error) => {
  console.error(error.message)
  process.exitCode = 1
})
process.on("SIGINT", () => server.close())
process.on("SIGTERM", () => server.close())
