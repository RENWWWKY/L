export type VnBackgroundAsset = {
  name: string
  fileName: string
  url: string
}

type GlobModule = {
  default?: string
}

const VN_BG_MODULES = import.meta.glob<GlobModule>(
  '../../../../../image/VN模型背景图/*.{png,jpg,jpeg,webp,gif,avif,PNG,JPG,JPEG,WEBP,GIF,AVIF}',
  { eager: true },
)

function cleanBgName(raw: string): string {
  const t = String(raw || '').trim()
  if (!t) return ''
  return t
    .replace(/\.[A-Za-z0-9]+$/u, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeBgKey(raw: string): string {
  return cleanBgName(raw).toLowerCase().replace(/\s+/g, '')
}

function pathBaseName(path: string): string {
  const norm = String(path || '').replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  return idx >= 0 ? norm.slice(idx + 1) : norm
}

export const VN_BACKGROUND_ASSETS: VnBackgroundAsset[] = Object.entries(VN_BG_MODULES)
  .map(([path, mod]) => {
    const fileName = pathBaseName(path)
    const name = cleanBgName(fileName)
    const url = String(mod?.default || '').trim()
    if (!name || !url) return null
    return { name, fileName, url }
  })
  .filter((x): x is VnBackgroundAsset => !!x)
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

export function buildVnBackgroundPromptBlock(): string {
  if (!VN_BACKGROUND_ASSETS.length) return ''
  const names = VN_BACKGROUND_ASSETS.map((x) => x.name)
  return (
    `【VN场景背景库】以下背景名可用，背景名即画面内容语义：\n` +
    `${names.map((x) => `- ${x}`).join('\n')}\n` +
    `【背景输出规则】` +
    `在 VN 模式回复中，第一行必须输出「【背景】背景名」。` +
    `背景名必须从上述列表中选择最符合当前场景的一项；` +
    `后续才输出剧情气泡内容。`
  )
}

export function resolveVnBackgroundByName(name: string): VnBackgroundAsset | null {
  const key = normalizeBgKey(name)
  if (!key) return null
  const exact = VN_BACKGROUND_ASSETS.find((x) => normalizeBgKey(x.name) === key)
  if (exact) return exact
  const fuzzy = VN_BACKGROUND_ASSETS.find((x) => {
    const nk = normalizeBgKey(x.name)
    return nk.includes(key) || key.includes(nk)
  })
  return fuzzy ?? null
}

export function extractVnBackgroundCue(raw: string): { cleanedText: string; backgroundName: string | null } {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
  if (!lines.length) return { cleanedText: '', backgroundName: null }

  const pickName = (line: string): string | null => {
    const t = String(line || '').trim()
    if (!t) return null
    const m1 = t.match(/^【\s*背景\s*】\s*(.+)$/u)
    if (m1?.[1]) return m1[1].trim()
    const m2 = t.match(/^背景[：:]\s*(.+)$/u)
    if (m2?.[1]) return m2[1].trim()
    return null
  }

  let bgName: string | null = null
  const rest: string[] = []
  for (const line of lines) {
    if (!bgName) {
      const n = pickName(line)
      if (n) {
        bgName = n
        continue
      }
    }
    rest.push(line)
  }
  return { cleanedText: rest.join('\n'), backgroundName: bgName }
}
