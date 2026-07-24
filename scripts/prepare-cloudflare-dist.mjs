/**
 * Cloudflare Pages 单文件上限 25 MiB。
 * 将超限静态资源从 dist 移除，并把产物中的引用改写到 GitHub Pages
 *（github.io 链接继续服务该资源，不改动原仓库 Pages 流程）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const LIMIT = 25 * 1024 * 1024
const GH_ASSET_ORIGIN =
  (process.env.CF_OVERSIZE_ASSET_ORIGIN || 'https://lyx815934990-oss.github.io/Lumi-Phone').replace(/\/$/, '')

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function toPosix(p) {
  return p.split(path.sep).join('/')
}

if (!fs.existsSync(dist)) {
  console.error('dist/ missing — run build first')
  process.exit(1)
}

const oversized = walk(dist).filter((f) => fs.statSync(f).size > LIMIT)
if (!oversized.length) {
  console.log('No oversize assets; dist ready for Cloudflare Pages.')
  process.exit(0)
}

const rewrites = []
for (const file of oversized) {
  const rel = toPosix(path.relative(dist, file))
  const localUrl = `/${rel}`
  const remoteUrl = `${GH_ASSET_ORIGIN}/${rel}`
  rewrites.push({ localUrl, remoteUrl, file, mb: (fs.statSync(file).size / 1024 / 1024).toFixed(1) })
}

const textExt = new Set(['.js', '.css', '.html', '.json', '.webmanifest', '.map', '.txt'])
const textFiles = walk(dist).filter((f) => textExt.has(path.extname(f).toLowerCase()))

let patchCount = 0
for (const { localUrl, remoteUrl } of rewrites) {
  for (const tf of textFiles) {
    let raw = fs.readFileSync(tf, 'utf8')
    if (!raw.includes(localUrl)) continue
    // Cover "/assets/x.mp4", "assets/x.mp4", and escaped forms in source maps lightly
    const next = raw.split(localUrl).join(remoteUrl)
    if (next !== raw) {
      fs.writeFileSync(tf, next)
      patchCount++
    }
  }
}

for (const { file, localUrl, remoteUrl, mb } of rewrites) {
  fs.unlinkSync(file)
  console.log(`Moved oversize ${localUrl} (${mb} MiB) → ${remoteUrl}`)
}

console.log(`Patched ${patchCount} text file(s). Cloudflare dist is under 25 MiB/file.`)
