import { findDmSection, parseDmSections } from './gameFlow/chatRoom/parseDmHostScript'

import dmScriptRaw from '../../../剧本杀/《雨夜归零》/剧本/DM-主持剧本.md?raw'

const YUYE_DM = parseDmSections(dmScriptRaw)

/** 第二段开场白起始（DM-主持剧本.md 第 13 行，与 dm语音开场白2.wav 对应） */
const VOICE_PART2_MARKER = '入局之前，请记住：'

function plainSpeech(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 与 dm语音开场白1/2.wav 一一对应：
 * - 第一段：开场欢迎词第 9–11 行（「入局之前」之前）
 * - 第二段：第 13–24 行（入局须知 + 本局目标 + 正式开场）
 */
export function getYuyeDmVoiceTypewriterScripts(): readonly [string, string] {
  const welcome = plainSpeech(findDmSection(YUYE_DM, '开场欢迎词'))
  const splitAt = welcome.indexOf(VOICE_PART2_MARKER)

  if (splitAt >= 0) {
    return [welcome.slice(0, splitAt).trim(), welcome.slice(splitAt).trim()] as const
  }

  const paragraphs = welcome.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  return [paragraphs[0] ?? welcome, paragraphs.slice(1).join('\n\n') || welcome] as const
}

export function getDmVoiceTypewriterScripts(scriptId: string): readonly string[] | null {
  if (scriptId !== 'yuye-guiling') return null
  return getYuyeDmVoiceTypewriterScripts()
}

/** 故事背景 · 第一段（dm故事背景1.wav） */
export const YUYE_STORY_BACKGROUND_PART1 = `2025 年 11 月 7 日周五傍晚
地点：滨海新城悬崖私宅"玻璃湾七号"`

/** 故事背景 · 第二段（dm故事背景2.wav） */
export const YUYE_STORY_BACKGROUND_PART2 = `归零科技完成 B 轮后，正面临「对赌延期补充协议」
周一上午须由资方沈厚泽与创始人林晚星共同签署。今晚林晚星以私人名义邀请四人聚餐，对外称「庆功」，对内是谈判前最后一夜。
到场四人：苏晚晴、陆景川、沈知意、程予安。林晚星为东道主

公共前提：
- 林晚星对金盏花过敏，宴席本应避免相关食材（细节仅核心圈知晓）。
- 暴雨，主楼餐厅与负一层酒窖、负二层车库连通。
- 保安队长周启驻场。

此时尚未发生中毒事件。`

const STORY_BG_PUBLIC_PREMISE_MARKER = '公共前提：'
const STORY_BG_AFTER_PREMISE_MARKER = '\n\n此时尚未发生中毒事件。'

/** 第二段中「公共前提」整块高亮区间（含三条 bullet，不含末句） */
export function getStoryBackgroundPart2Highlight(): { start: number; end: number } {
  const text = YUYE_STORY_BACKGROUND_PART2
  const start = text.indexOf(STORY_BG_PUBLIC_PREMISE_MARKER)
  const afterPremise = text.indexOf(STORY_BG_AFTER_PREMISE_MARKER)
  const end = afterPremise >= 0 ? afterPremise : text.length
  return { start: Math.max(0, start), end }
}

export type StoryBackgroundTrack = {
  plain: string
  highlight?: { start: number; end: number }
}

/** 与 dm故事背景1/2.wav 一一对应（聊天室 Step 2） */
export function getYuyeStoryBackgroundTracks(): readonly [StoryBackgroundTrack, StoryBackgroundTrack] {
  return [
    { plain: YUYE_STORY_BACKGROUND_PART1 },
    { plain: YUYE_STORY_BACKGROUND_PART2, highlight: getStoryBackgroundPart2Highlight() },
  ]
}

export function getStoryBackgroundTypewriterScripts(scriptId: string): readonly string[] | null {
  if (scriptId !== 'yuye-guiling') return null
  const tracks = getYuyeStoryBackgroundTracks()
  return [tracks[0].plain, tracks[1].plain]
}

export function getStoryBackgroundTracks(scriptId: string): readonly StoryBackgroundTrack[] | null {
  if (scriptId !== 'yuye-guiling') return null
  return getYuyeStoryBackgroundTracks()
}
