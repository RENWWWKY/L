import { compactDmNarrationLines } from './dmBubbleText'
import {
  extractDmBlockquoteChunks,
  findDmSection,
  parseDmSections,
} from './parseDmHostScript'
import {
  getAmbulanceSirenUrl,
  getDoctorRunSfxUrl,
  getOpenWineBottleSfxUrl,
  getPlateSfxUrl,
  getPourWineSfxUrl,
} from '../../jbsChatRoomMedia'

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

/** 有独立 WAV 的角色（程予安等无 WAV 的台词归入旁白轨） */
const SPOKEN_ROLES = new Set(['林晚星', '苏晚晴', '陆景川', '沈知意', '医生', '保安'])

const DIALOGUE_ROLE_PREFIXES = [
  { prefix: '保安队长周启', role: '保安' },
  { prefix: '驻家医生', role: '医生' },
  { prefix: '林晚星', role: '林晚星' },
  { prefix: '苏晚晴', role: '苏晚晴' },
  { prefix: '陆景川', role: '陆景川' },
  { prefix: '沈知意', role: '沈知意' },
  { prefix: '程予安', role: '程予安' },
  { prefix: '周启', role: '保安' },
  { prefix: '保安', role: '保安' },
  { prefix: '医生', role: '医生' },
] as const

const ROLE_PREFIXES = DIALOGUE_ROLE_PREFIXES

const SPEECH_VERB =
  '(?:[：:]|(?:喊|说|问|答|低声应|宣布|厉声答|接(?:了)?(?:一)?句|只淡淡接(?:了)?(?:一)?句|冷笑(?:一)?声|念出|对全桌说|挤出几个字|补(?:了)?一?句|沉声问))'

/** 第一轨 DM 旁白：直接从暴雨开场，不含「第一幕读本前」等主持备忘 */
const ACT1_DM1_OPENING =
  '滨海暴雨从傍晚下到入夜，雨鞭抽打玻璃湾七号面朝悬崖的落地窗，海在脚下翻涌成一片灰白。19:30，主楼餐厅吊灯全亮，长桌一头是东道主林晚星——墨色长裙，举杯时腕表折出冷光。'

/** 第一幕公共剧情收束旁白（dm公共第一幕22.wav） */
const ACT1_DM22_SCRIPT = '请翻开第一幕——从你们现在的位置，把今夜重新想一遍。'

/** 角色 WAV 台词覆盖（与录音口径一致时可改显示文案） */
const ACT1_ROLE_SCRIPT_OVERRIDES: Partial<Record<(typeof ACT1_WAV_ORDER)[number], string>> = {
  '陆景川公共第一幕2.wav': '这瓶不在酒水单上',
}

/** 第一幕 20:10 救护车鸣笛（与 dm公共第一幕18.wav 旁白同步） */
const ACT1_AMBULANCE_SFX_MARKER = '救护车鸣笛'
const ACT1_AMBULANCE_SFX_URL = getAmbulanceSirenUrl('yuye-guiling')
/** 程予安开席换盘（放盘子 → 倒酒，仅第一处添酒） */
const ACT1_PLATE_SFX_MARKER = '换盘'
const ACT1_PLATE_SFX_URL = getPlateSfxUrl('yuye-guiling')
const ACT1_POUR_WINE_SFX_MARKER = '添酒'
const ACT1_POUR_WINE_SFX_URL = getPourWineSfxUrl('yuye-guiling')
/** 19:55 林晚星亲手开瓶 */
const ACT1_OPEN_BOTTLE_SFX_MARKER = '亲手开瓶'
const ACT1_OPEN_BOTTLE_SFX_URL = getOpenWineBottleSfxUrl('yuye-guiling')
/** 20:03 驻家医生从侧廊冲入 */
const ACT1_DOCTOR_RUN_SFX_MARKER = '从侧廊冲入'
const ACT1_DOCTOR_RUN_SFX_URL = getDoctorRunSfxUrl('yuye-guiling')

type Act1SfxAssignContext = {
  pourWineUsed: boolean
}

function resolveAct1TrackSfxUrls(
  script: string,
  ctx: Act1SfxAssignContext,
): readonly string[] | undefined {
  if (ACT1_AMBULANCE_SFX_URL && script.includes(ACT1_AMBULANCE_SFX_MARKER)) {
    return [ACT1_AMBULANCE_SFX_URL]
  }
  if (ACT1_DOCTOR_RUN_SFX_URL && script.includes(ACT1_DOCTOR_RUN_SFX_MARKER)) {
    return [ACT1_DOCTOR_RUN_SFX_URL]
  }
  if (ACT1_OPEN_BOTTLE_SFX_URL && script.includes(ACT1_OPEN_BOTTLE_SFX_MARKER)) {
    return [ACT1_OPEN_BOTTLE_SFX_URL]
  }

  const hasPlate = script.includes(ACT1_PLATE_SFX_MARKER)
  const hasFirstPour = script.includes(ACT1_POUR_WINE_SFX_MARKER) && !script.includes('添杯')

  if (hasPlate && ACT1_PLATE_SFX_URL) {
    const urls: string[] = [ACT1_PLATE_SFX_URL]
    if (hasFirstPour && !ctx.pourWineUsed && ACT1_POUR_WINE_SFX_URL) {
      urls.push(ACT1_POUR_WINE_SFX_URL)
      ctx.pourWineUsed = true
    }
    return urls
  }

  if (hasFirstPour && !ctx.pourWineUsed && ACT1_POUR_WINE_SFX_URL) {
    ctx.pourWineUsed = true
    return [ACT1_POUR_WINE_SFX_URL]
  }

  return undefined
}

export type PublicPlotVoiceTrack = {
  url: string
  script: string
  speaker: 'dm' | { role: string }
  /** 该轨开始播放时叠加的功能音效（如救护车鸣笛；可多条顺序播放） */
  sfxUrls?: readonly string[]
}

type DialogueHit = {
  index: number
  end: number
  role: string
  quote: string
}

function resolveAct1WavUrl(filename: string): string {
  for (const [path, url] of Object.entries(ACT1_WAV_URLS)) {
    if (path.replace(/\\/g, '/').endsWith(filename)) return url
  }
  return ''
}

function getAct1PlayableChunks(section: string): string[] {
  return extractDmBlockquoteChunks(section).filter((chunk) => {
    const t = chunk.trim()
    if (!t) return false
    if (/^请翻开/.test(t)) return false
    if (t.includes('【衔接校验】') || t.includes('【互见校验】')) return false
    return true
  })
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isInsideQuotes(text: string, index: number): boolean {
  const before = text.slice(0, index)
  return (before.match(/「/g)?.length ?? 0) % 2 === 1
}

function hasInterveningRole(
  text: string,
  roleStart: number,
  speechAt: number,
  ownPrefix: string,
): boolean {
  const scanStart = roleStart + ownPrefix.length
  if (scanStart >= speechAt) return false
  const between = text.slice(scanStart, speechAt)
  for (const { prefix } of DIALOGUE_ROLE_PREFIXES) {
    if (prefix === ownPrefix) continue
    const re = new RegExp(`(?<![\\u4e00-\\u9fff])${escapeRegExp(prefix)}`)
    if (re.test(between)) return true
  }
  return false
}

function findNextExplicitQuote(text: string): {
  localIndex: number
  end: number
  role: string
  quote: string
} | null {
  let best: { localIndex: number; end: number; role: string; quote: string } | null = null

  for (const { prefix, role } of DIALOGUE_ROLE_PREFIXES) {
    const re = new RegExp(
      `(?<![\\u4e00-\\u9fff])${escapeRegExp(prefix)}[^「\\n]{0,60}?${SPEECH_VERB}[^「]*?「([^」]+)」`,
    )
    const m = re.exec(text)
    if (!m || m.index === undefined) continue
    if (isInsideQuotes(text, m.index)) continue
    const speechMatch = new RegExp(SPEECH_VERB).exec(m[0])
    const speechAt = m.index + (speechMatch?.index ?? 0)
    if (hasInterveningRole(text, m.index, speechAt, prefix)) continue
    const quote = m[1]!.trim()
    if (isLabelQuote(quote)) continue
    if (m[0].includes('对全桌说') && role !== '林晚星') continue
    if (m[0].includes('宣布') && role !== '保安') continue
    const end = m.index + m[0].length
    if (!best || m.index < best.localIndex) {
      best = { localIndex: m.index, end, role, quote }
    }
  }

  return best
}

function findNextImplicitQuote(text: string): {
  localIndex: number
  end: number
  role: string
  quote: string
} | null {
  const implicitRe = /(?:她|他)(?:[^。！？\n]{0,48}?)说：「([^」]+)」/
  const m = implicitRe.exec(text)
  if (!m || m.index === undefined) return null
  if (isInsideQuotes(text, m.index)) return null

  const clauseStart =
    Math.max(text.lastIndexOf('。', m.index), text.lastIndexOf('\n', m.index)) + 1
  const clauseBefore = text.slice(clauseStart, m.index)
  let attributed: string | null = null
  let roleAt = -1
  for (const { prefix, role } of DIALOGUE_ROLE_PREFIXES) {
    if (role === '程予安') continue
    const idx = clauseBefore.lastIndexOf(prefix)
    if (idx < 0) continue
    if (idx > 0 && /[\u4e00-\u9fff]/.test(clauseBefore[idx - 1]!)) continue
    const abs = clauseStart + idx
    if (!attributed || abs > roleAt) {
      attributed = role
      roleAt = abs
    }
  }
  if (!attributed) return null

  const quote = m[1]!.trim()
  if (quote.includes('庆功酒')) attributed = '林晚星'

  return {
    localIndex: m.index,
    end: m.index + m[0].length,
    role: attributed,
    quote,
  }
}

function findNextAnyQuote(text: string): {
  localIndex: number
  end: number
  role: string
  quote: string
} | null {
  const explicit = findNextExplicitQuote(text)
  const implicit = findNextImplicitQuote(text)
  let hit: { localIndex: number; end: number; role: string; quote: string } | null = null
  if (!explicit) hit = implicit
  else if (!implicit) hit = explicit
  else hit = explicit.localIndex <= implicit.localIndex ? explicit : implicit
  if (!hit) return null
  if (hit.quote.includes('庆功酒')) return { ...hit, role: '林晚星' }
  return hit
}

/** 按剧本出现顺序提取全部对白；仅含 WAV 的角色的命中用于角色轨 */
function extractSpokenDialoguesInOrder(fullText: string): DialogueHit[] {
  const spokenHits: DialogueHit[] = []
  let rest = textRemainder(fullText, 0)
  let offset = 0

  while (rest.length > 0) {
    const next = findNextAnyQuote(rest)
    if (!next) break
    const hit: DialogueHit = {
      index: offset + next.localIndex,
      end: offset + next.end,
      role: next.role,
      quote: next.quote,
    }
    if (SPOKEN_ROLES.has(next.role)) spokenHits.push(hit)
    offset += next.end
    rest = textRemainder(fullText, offset)
  }

  return spokenHits
}

function textRemainder(fullText: string, offset: number): string {
  return fullText.slice(offset)
}

function isLabelQuote(quote: string): boolean {
  const t = quote.trim()
  if (!t) return true
  if (/^陆景川贺酒$/.test(t)) return true
  if (t.length <= 4 && !/[，。！？、：]/.test(t)) return true
  return false
}

function spokenDialogueQuoteOpen(fullText: string, hit: DialogueHit): number {
  const marker = `「${hit.quote}`
  const at = fullText.indexOf(marker, hit.index)
  return at >= 0 ? at : hit.index
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 将一段旁白按句序分给连续多轨 DM 音频 */
function splitDmAcrossTracks(text: string, trackCount: number): string[] {
  if (trackCount <= 0) return []
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trackCount === 1) return [trimmed]

  const sentences = splitSentences(trimmed)
  if (sentences.length === 0) return [trimmed]

  if (sentences.length <= trackCount) {
    const out = [...sentences]
    const last = out[out.length - 1] ?? trimmed
    while (out.length < trackCount) out.push(last)
    return out
  }

  const out: string[] = []
  const per = sentences.length / trackCount
  for (let i = 0; i < trackCount; i += 1) {
    const start = Math.floor(i * per)
    const end = i === trackCount - 1 ? sentences.length : Math.floor((i + 1) * per)
    const part = sentences.slice(start, end).join('')
    if (part) out.push(part)
  }
  return out.length > 0 ? out : [trimmed]
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

function takeSpokenDialogue(
  dialogues: DialogueHit[],
  role: string,
  quoteIndex: number,
): DialogueHit | null {
  let count = 0
  for (const hit of dialogues) {
    if (hit.role !== role) continue
    if (count === quoteIndex) return hit
    count += 1
  }
  return null
}

function nextSpokenDialogueFrom(dialogues: DialogueHit[], pos: number): DialogueHit | undefined {
  return dialogues.find((d) => d.index >= pos)
}

/**
 * 按 WAV 顺序映射：旁白取「上一句对白结束 → 下一句有 WAV 的对白开始」之间的文本，
 * 与音频顺序一致，避免 timeline 把整段对白堆在前导致旁白轨为空。
 */
function buildTracksFromSection(section: string): PublicPlotVoiceTrack[] {
  const fullText = getAct1PlayableChunks(section).join('\n\n')
  const dialogues = extractSpokenDialoguesInOrder(fullText)
  const tracks: PublicPlotVoiceTrack[] = []
  let narrationCursor = 0
  const sfxCtx: Act1SfxAssignContext = { pourWineUsed: false }

  for (let i = 0; i < ACT1_WAV_ORDER.length; ) {
    const file = ACT1_WAV_ORDER[i]!
    const url = resolveAct1WavUrl(file)
    if (!url) {
      i += 1
      continue
    }

    const speakerKind = roleFromFilename(file)

    if (speakerKind !== 'dm') {
      const hit = takeSpokenDialogue(dialogues, speakerKind, indexFromFilename(file))
      if (hit) {
        let script = compactDmNarrationLines(hit.quote)
        const overridden = ACT1_ROLE_SCRIPT_OVERRIDES[file]
        if (overridden) script = overridden
        if (script) {
          tracks.push({
            url,
            script,
            speaker: { role: speakerKind },
          })
          narrationCursor = Math.max(narrationCursor, hit.end)
        }
      }
      i += 1
      continue
    }

    let dmRun = 0
    while (i + dmRun < ACT1_WAV_ORDER.length && roleFromFilename(ACT1_WAV_ORDER[i + dmRun]!) === 'dm') {
      dmRun += 1
    }

    const nextDlg = nextSpokenDialogueFrom(dialogues, narrationCursor)
    const endPos = nextDlg ? spokenDialogueQuoteOpen(fullText, nextDlg) : fullText.length
    const narrationBlock = fullText.slice(narrationCursor, endPos).trim().replace(/请翻开[\s\S]*$/, '').trim()
    narrationCursor = endPos

    const dmScripts = splitDmAcrossTracks(narrationBlock, dmRun)

    for (let j = 0; j < dmRun; j += 1) {
      const dmFile = ACT1_WAV_ORDER[i + j]!
      const dmUrl = resolveAct1WavUrl(dmFile)
      if (!dmUrl) continue

      let script = dmScripts[j]?.trim() ?? ''
      if (dmFile === 'dm公共第一幕1.wav') {
        script = ACT1_DM1_OPENING
      } else if (dmFile === 'dm公共第一幕22.wav') {
        script = ACT1_DM22_SCRIPT
      }
      script = compactDmNarrationLines(script)
      if (!script) continue

      const track: PublicPlotVoiceTrack = { url: dmUrl, script, speaker: 'dm' }
      const sfxUrls = resolveAct1TrackSfxUrls(script, sfxCtx)
      if (sfxUrls?.length) track.sfxUrls = sfxUrls
      tracks.push(track)
    }

    i += dmRun
  }

  return tracks
}

export function getYuyeAct1PublicPlotTracks(): PublicPlotVoiceTrack[] {
  const section = findDmSection(YUYE_DM, '公共剧情①')
  return buildTracksFromSection(section)
}

export function getAct1PublicPlotVoiceUrls(scriptId: string): readonly string[] | null {
  if (scriptId !== 'yuye-guiling') return null
  const tracks = getYuyeAct1PublicPlotTracks()
  return tracks.length ? tracks.map((t) => t.url) : null
}

/** 连续旁白轨起点（与 `音频顺序.md` 中 back-to-back 的 dm*.wav 一致） */
export function getAct1PublicPlotDmRunStart(
  tracks: readonly PublicPlotVoiceTrack[],
  trackIndex: number,
): number {
  if (tracks[trackIndex]?.speaker !== 'dm') return trackIndex
  let i = trackIndex
  while (i > 0 && tracks[i - 1]?.speaker === 'dm') i -= 1
  return i
}

export function getAct1PublicPlotDmRunEnd(
  tracks: readonly PublicPlotVoiceTrack[],
  trackIndex: number,
): number {
  if (tracks[trackIndex]?.speaker !== 'dm') return trackIndex
  let i = trackIndex
  while (i + 1 < tracks.length && tracks[i + 1]?.speaker === 'dm') i += 1
  return i
}

export function getAct1PublicPlotDmRunFullText(
  tracks: readonly PublicPlotVoiceTrack[],
  trackIndex: number,
): string {
  if (tracks[trackIndex]?.speaker !== 'dm') return ''
  const start = getAct1PublicPlotDmRunStart(tracks, trackIndex)
  const end = getAct1PublicPlotDmRunEnd(tracks, trackIndex)
  return mergeAct1PublicPlotDmScripts(tracks, start, end + 1)
}

export function mergeAct1PublicPlotDmScripts(
  tracks: readonly PublicPlotVoiceTrack[],
  fromIndex: number,
  toIndexExclusive: number,
): string {
  return tracks
    .slice(fromIndex, toIndexExclusive)
    .filter((t) => t.speaker === 'dm')
    .map((t) => compactDmNarrationLines(t.script))
    .filter(Boolean)
    .join('\n\n')
}
