/**
 * 构建并以根路径部署到 Cloudflare Pages（不影响 GitHub Pages 的 /Lumi-Phone/ 构建）。
 *
 * 用法：node scripts/deploy-cloudflare-pages.mjs
 * 可选环境变量：与 .github/workflows/deploy-github-pages.yml 相同的 VITE_*。
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectName = process.env.CF_PAGES_PROJECT || 'lumi-phone'

/** 从 .env.local / .env 读取未在 process.env 中的键（不覆盖已有环境变量） */
function loadDotEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(root, name)
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!m) continue
      const key = m[1]
      if (process.env[key] != null && process.env[key] !== '') continue
      let val = m[2].trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  }
}

function run(command, args, env = {}) {
  const r = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

loadDotEnvFiles()

run('npm', ['run', 'build'], {
  CI: 'true',
  COLUMNS: '9999',
  VITE_BASE: '/',
  VITE_WEB_PUSH_API_BASE:
    process.env.VITE_WEB_PUSH_API_BASE || 'https://lumi-push.lyx815934990.workers.dev',
  VITE_USER_SYSTEM_API_BASE:
    process.env.VITE_USER_SYSTEM_API_BASE || 'https://user-system-api.lyx815934990.workers.dev',
  VITE_HF_REMOTE_HOST: process.env.VITE_HF_REMOTE_HOST || 'https://hf-mirror.com/',
})

run('node', ['scripts/prepare-cloudflare-dist.mjs'])
run('npx', ['wrangler', 'pages', 'deploy', 'dist', `--project-name=${projectName}`, '--branch=main', '--commit-dirty=true'])
