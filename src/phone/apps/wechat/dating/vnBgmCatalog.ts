export type VnBgmAsset = {
  name: string
  fileName: string
  url: string
}

type GlobModule = {
  default?: string
}

const VN_BGM_MODULES_REL = import.meta.glob<GlobModule>(
  '../../../../../BGM/**/*.{mp3,wav,ogg,m4a,flac,aac,MP3,WAV,OGG,M4A,FLAC,AAC}',
  { eager: true },
)
const VN_BGM_MODULES_ABS = import.meta.glob<GlobModule>(
  '/BGM/**/*.{mp3,wav,ogg,m4a,flac,aac,MP3,WAV,OGG,M4A,FLAC,AAC}',
  { eager: true },
)
const VN_BGM_MODULES_PUBLIC = import.meta.glob<GlobModule>(
  '/public/BGM/**/*.{mp3,wav,ogg,m4a,flac,aac,MP3,WAV,OGG,M4A,FLAC,AAC}',
  { eager: true },
)
const VN_BGM_MODULES = {
  ...VN_BGM_MODULES_REL,
  ...VN_BGM_MODULES_ABS,
  ...VN_BGM_MODULES_PUBLIC,
}

function cleanBgmName(raw: string): string {
  const t = String(raw || '').trim()
  if (!t) return ''
  return t
    .replace(/\.[A-Za-z0-9]+$/u, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeBgmKey(raw: string): string {
  return cleanBgmName(raw)
    .toLowerCase()
    .replace(/[，,。.!！?？、;；:："“”"'‘’（）()[\]【】\-_/\\]/g, '')
    .replace(/\s+/g, '')
}

function pathBaseName(path: string): string {
  const norm = String(path || '').replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  return idx >= 0 ? norm.slice(idx + 1) : norm
}

export const VN_BGM_ASSETS: VnBgmAsset[] = Object.entries(VN_BGM_MODULES)
  .map(([path, mod]) => {
    const fileName = pathBaseName(path)
    const name = cleanBgmName(fileName)
    const url = String(mod?.default || '').trim()
    if (!name || !url) return null
    return { name, fileName, url }
  })
  .filter((x): x is VnBgmAsset => !!x)
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

/** 把「心动、氛围、emo」这类文件名拆成可匹配的关键词（已 normalize） */
function bgmNameToTokens(raw: string): string[] {
  const cleaned = cleanBgmName(raw)
  if (!cleaned) return []
  const parts = cleaned
    .split(/[、，,\s|\/·]+/u)
    .map((p) => normalizeBgmKey(p))
    .filter((t) => t.length >= 2)
  const full = normalizeBgmKey(cleaned)
  if (full.length >= 2 && !parts.includes(full)) parts.unshift(full)
  return [...new Set(parts)]
}

function tokenPairMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length < 2 || b.length < 2) return false
  return a.includes(b) || b.includes(a)
}

/** 同一 cue 多次命中多首同分时轮询，避免总播排序后的第一首 */
const bgmResolveRoundRobin = new Map<string, number>()

function pickRoundRobin(cacheKey: string, list: VnBgmAsset[]): VnBgmAsset {
  if (list.length === 1) return list[0]!
  const i = bgmResolveRoundRobin.get(cacheKey) ?? 0
  bgmResolveRoundRobin.set(cacheKey, i + 1)
  return list[i % list.length]!
}

export function buildVnBgmPromptBlock(): string {
  if (!VN_BGM_ASSETS.length) return ''
  const names = VN_BGM_ASSETS.map((x) => x.name)
  return (
    `【VN背景音乐库】以下 BGM 名可用（直接使用文件名语义）：\n` +
    `${names.map((x) => `- ${x}`).join('\n')}\n` +
    `【BGM输出规则】` +
    `需要切换音乐时，在对应气泡前单独输出一行「【BGM】音乐名」。` +
    `文件名里若用「、」等串联多个情绪/场景词，你只需输出**任意一个词或一小段**即可命中对应曲目；不必写全名，也无需固定写第一个词。` +
    `同一轮可多次切换，且必须从上述列表中选最符合当下情绪和场景的一项；` +
    `若当前音乐已合适则不要重复输出。`
  )
}

export function resolveVnBgmByName(name: string): VnBgmAsset | null {
  const raw = String(name || '').trim()
  if (!raw) return null
  const key = normalizeBgmKey(raw)
  if (!key) return null

  const exact = VN_BGM_ASSETS.find((x) => normalizeBgmKey(x.name) === key)
  if (exact) return exact

  let cueTokens = bgmNameToTokens(raw)
  if (!cueTokens.length && key.length >= 2) cueTokens = [key]
  if (!cueTokens.length) return null

  type Scored = { asset: VnBgmAsset; score: number }
  const scored: Scored[] = []

  for (const x of VN_BGM_ASSETS) {
    const nk = normalizeBgmKey(x.name)
    const assetTokens = bgmNameToTokens(x.name)
    let score = 0

    for (const ct of cueTokens) {
      let best = 0
      for (const at of assetTokens) {
        if (tokenPairMatch(ct, at)) {
          const rank = ct === at || nk === key ? 100 : ct.length >= 4 && (at === ct || nk.includes(ct) || ct.includes(nk)) ? 40 : 25
          if (rank > best) best = rank
        }
      }
      if (best === 0 && nk.includes(ct)) best = 20
      if (best === 0 && ct.includes(nk) && nk.length >= 2) best = 15
      score += best
    }

    if (score === 0 && (nk.includes(key) || key.includes(nk))) {
      score = 10
    }
    if (score > 0) scored.push({ asset: x, score })
  }

  if (!scored.length) return null

  const maxScore = Math.max(...scored.map((s) => s.score))
  const top = scored.filter((s) => s.score === maxScore).map((s) => s.asset)
  const rrKey = `${key}::${cueTokens.join('|')}`
  return pickRoundRobin(rrKey, top)
}

export function extractVnBgmCueName(rawLine: string): string | null {
  const t = String(rawLine || '').trim()
  if (!t) return null
  const m1 = t.match(/^【\s*BGM\s*】\s*(.+)$/iu)
  if (m1?.[1]) return m1[1].trim()
  const m2 = t.match(/^BGM[：:]\s*(.+)$/iu)
  if (m2?.[1]) return m2[1].trim()
  return null
}
