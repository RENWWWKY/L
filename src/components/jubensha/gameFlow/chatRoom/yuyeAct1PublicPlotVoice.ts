import { findDmSection, parseDmSections } from './parseDmHostScript'

import dmScriptRaw from '../../../../../剧本杀/《雨夜归零》/剧本/DM-主持剧本.md?raw'

const YUYE_DM = parseDmSections(dmScriptRaw)

/** 与 `剧本杀/《雨夜归零》/音频顺序.md` 第一幕段一致 */
const ACT1_WAV_ORDER = [
  'dm公共第一幕1.wav',
  '林晚星公共第一幕1.wav',
  'dm公共第一幕2.wav',
  '苏晚晴公共第一幕1.wav',
  'dm公共第一幕3.wav',
  '陆景川公共第一幕1.wav',
  'dm公共第一幕4.wav',
  '沈知意公共第一幕1.wav',
  'dm公共第一幕5.wav',
  '林晚星公共第一幕2.wav',
  'dm公共第一幕6.wav',
  'dm公共第一幕7.wav',
  'dm公共第一幕8.wav',
  '林晚星公共第一幕3.wav',
  'dm公共第一幕9.wav',
  '陆景川公共第一幕2.wav',
  'dm公共第一幕10.wav',
  '林晚星公共第一幕4.wav',
  'dm公共第一幕11.wav',
  '林晚星公共第一幕5.wav',
  'dm公共第一幕12.wav',
  'dm公共第一幕13.wav',
  '林晚星公共第一幕6.wav',
  'dm公共第一幕14.wav',
  '医生公共第一幕1.wav',
  'dm公共第一幕15.wav',
  '沈知意公共第一幕2.wav',
  'dm公共第一幕16.wav',
  '医生公共第一幕2.wav',
  'dm公共第一幕17.wav',
  'dm公共第一幕18.wav',
  '保安公共第一幕1.wav',
  'dm公共第一幕19.wav',
  '保安公共第一幕2.wav',
  'dm公共第一幕20.wav',
  'dm公共第一幕21.wav',
  '保安公共第一幕3.wav',
  'dm公共第一幕22.wav',
] as const

const ACT1_WAV_URLS = import.meta.glob<string>(
  '../../../../../剧本杀/《雨夜归零》/第一幕公共剧情/**/*.wav',
  { eager: true, query: '?url', import: 'default' },
)

const ROLE_PREFIXES = [
  { prefix: '林晚星', role: '林晚星' },
  { prefix: '苏晚晴', role: '苏晚晴' },
  { prefix: '陆景川', role: '陆景川' },
  { prefix: '沈知意', role: '沈知意' },
  { prefix: '医生', role: '医生' },
  { prefix: '保安队长周启', role: '保安' },
  { prefix: '保安', role: '保安' },
] as const

export type PublicPlotVoiceTrack = {
  url: string
  script: string
  speaker: 'dm' | { role: string }
}

function resolveAct1WavUrl(filename: string): string {
  for (const [path, url] of Object.entries(ACT1_WAV_URLS)) {
    if (path.replace(/\\/g, '/').endsWith(filename)) return url
  }
  return ''
}

function stripSectionForParse(section: string): string {
  return section
    .replace(/\*\*[^*]+\*\*/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^---$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function findNextQuote(text: string): {
  dmBefore: string
  role: string
  quote: string
  rest: string
} | null {
  let bestAt = -1
  let roleLabel = ''
  let qOpen = -1
  let qClose = -1

  for (const { prefix, role } of ROLE_PREFIXES) {
    const roleAt = text.indexOf(prefix)
    if (roleAt < 0) continue
    const open = text.indexOf('「', roleAt)
    const close = open >= 0 ? text.indexOf('」', open + 1) : -1
    if (open < 0 || close < 0) continue
    if (bestAt < 0 || roleAt < bestAt) {
      bestAt = roleAt
      roleLabel = role
      qOpen = open
      qClose = close
    }
  }

  if (bestAt < 0 || qOpen < 0 || qClose < 0) return null

  const dmBefore = text.slice(0, bestAt).trim()
  const quote = text.slice(qOpen + 1, qClose).trim()
  const rest = text.slice(qClose + 1).trim()
  return { dmBefore, role: roleLabel, quote, rest }
}

function parseAct1ScriptPools(section: string): {
  dmQueue: string[]
  roleQueues: Record<string, string[]>
} {
  const dmQueue: string[] = []
  const roleQueues: Record<string, string[]> = {
    林晚星: [],
    苏晚晴: [],
    陆景川: [],
    沈知意: [],
    医生: [],
    保安: [],
  }

  let rest = stripSectionForParse(section)
  while (rest.length > 0) {
    const next = findNextQuote(rest)
    if (!next) {
      if (rest.trim()) dmQueue.push(rest.trim())
      break
    }
    if (next.dmBefore) dmQueue.push(next.dmBefore)
    if (next.quote) {
      const list = roleQueues[next.role] ?? []
      list.push(next.quote)
      roleQueues[next.role] = list
    }
    rest = next.rest
  }

  return { dmQueue, roleQueues }
}

function splitDmQueueToCount(parts: string[], count: number): string[] {
  const joined = parts.join('\n\n').trim()
  if (!joined) return Array.from({ length: count }, () => '')
  const sentences = joined.split(/(?<=[。！？])\s*/).map((s) => s.trim()).filter(Boolean)
  if (sentences.length === 0) return [joined, ...Array.from({ length: count - 1 }, () => '')]

  if (sentences.length <= count) {
    const out = [...sentences]
    while (out.length < count) out.push('')
    return out
  }

  const out: string[] = []
  const per = sentences.length / count
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * per)
    const end = i === count - 1 ? sentences.length : Math.floor((i + 1) * per)
    out.push(sentences.slice(start, end).join(''))
  }
  return out
}

function roleFromFilename(filename: string): 'dm' | string {
  if (filename.startsWith('dm')) return 'dm'
  for (const { prefix, role } of ROLE_PREFIXES) {
    if (filename.startsWith(prefix)) return role
  }
  return 'dm'
}

function indexFromFilename(filename: string): number {
  const m = filename.match(/(\d+)\.wav$/i)
  return m ? Math.max(0, parseInt(m[1]!, 10) - 1) : 0
}

export function getYuyeAct1PublicPlotTracks(): PublicPlotVoiceTrack[] {
  const section = findDmSection(YUYE_DM, '公共剧情①')
  const { dmQueue, roleQueues } = parseAct1ScriptPools(section)
  const dmCount = ACT1_WAV_ORDER.filter((f) => f.startsWith('dm')).length
  const dmScripts = splitDmQueueToCount(dmQueue, dmCount)
  let dmCursor = 0

  return ACT1_WAV_ORDER.map((file) => {
    const url = resolveAct1WavUrl(file)
    const speakerKind = roleFromFilename(file)
    if (speakerKind === 'dm') {
      const script = dmScripts[dmCursor]?.trim() || '……'
      dmCursor += 1
      return { url, script, speaker: 'dm' as const }
    }
    const idx = indexFromFilename(file)
    const script = roleQueues[speakerKind]?.[idx]?.trim() || `（${speakerKind}）`
    return { url, script, speaker: { role: speakerKind } }
  }).filter((t) => t.url.length > 0)
}

export function getAct1PublicPlotVoiceUrls(scriptId: string): readonly string[] | null {
  if (scriptId !== 'yuye-guiling') return null
  const tracks = getYuyeAct1PublicPlotTracks()
  return tracks.length ? tracks.map((t) => t.url) : null
}
