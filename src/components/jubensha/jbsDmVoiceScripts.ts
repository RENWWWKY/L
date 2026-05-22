import { findDmSection, parseDmSections } from './gameFlow/chatRoom/parseDmHostScript'

import dmScriptRaw from '../../../剧本杀/《雨夜归零》/DM-主持剧本.md?raw'

const YUYE_DM = parseDmSections(dmScriptRaw)

/** 第二段开场白起始标记（DM-主持剧本.md 第 13 行） */
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
 * - 第一段：开场欢迎词第 9–11 行
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
