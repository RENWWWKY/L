import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const env = {
  ...process.env,
  CI: 'true',
  COLUMNS: '9999',
}

const isWin = process.platform === 'win32'
const viteArgs = ['vite', 'build', '--logLevel', 'warn']
const cmd = isWin ? 'npx.cmd' : 'npx'

const result = spawnSync(cmd, viteArgs, {
  stdio: 'inherit',
  env,
  shell: isWin,
})

const distOk = existsSync('dist/index.html')
if (!distOk) {
  process.exit(typeof result.status === 'number' && result.status !== 0 ? result.status : 1)
}

// Rolldown vite-reporter may crash on Windows after a successful build when paths contain CJK.
if (isWin && result.status !== 0 && result.status !== null) {
  process.exit(0)
}

process.exit(result.status ?? 0)
