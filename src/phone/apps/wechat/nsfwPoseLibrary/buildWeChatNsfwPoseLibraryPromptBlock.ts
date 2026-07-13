import type { ChatTranscriptTurn } from '../wechatChatAi'
import { isCharacterMediaNsfwImageScene } from '../characterMediaNsfwImageGate'
import {
  detectCharacterMediaNsfwImagePairing,
  pairingLabelZh,
} from '../characterMediaNsfwImagePairing'
import type { Gender } from '../newFriendsPersona/types'
import { recallNsfwPoseLibraryEntries, loadNsfwPoseLibraryEntries } from './nsfwPoseLibraryCatalog'

export function buildChatContextTailFromTranscript(
  transcript: ChatTranscriptTurn[],
  maxTurns = 14,
): string {
  return buildChatContextTailFromLines(
    transcript.slice(-maxTurns).map((t) => ({
      who:
        t.from === 'self'
          ? t.speakerLabel
            ? `用户(${t.speakerLabel})`
            : '用户'
          : t.speakerLabel || '角色',
      text: t.text,
    })),
  )
}

export function buildChatContextTailFromLines(
  lines: Array<{ who: string; text: string }>,
  maxChars = 2000,
): string {
  return lines
    .map((line) => {
      const text = String(line.text ?? '').trim().slice(0, 280)
      return text ? `${line.who}：${text}` : ''
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, maxChars)
}

/** 注入聊天 LLM system：亲密语境下提供姿势库 tag 参考，供第一轮 `[图片]` 行直接撰写 */
export function buildWeChatNsfwPoseLibraryPromptBlock(params: {
  chatContextTail: string
  characterGender?: Gender | null
  playerGender?: Gender | null
  maxEntries?: number
  maxChars?: number
}): string {
  const ctx = params.chatContextTail.trim()
  if (!ctx) return ''
  if (!isCharacterMediaNsfwImageScene({ imagePrompt: '', chatContextTail: ctx })) return ''

  if (!loadNsfwPoseLibraryEntries().length) return ''

  const recalled = recallNsfwPoseLibraryEntries(ctx, params.maxEntries ?? 2)
  if (!recalled.length) return ''

  const pairing = detectCharacterMediaNsfwImagePairing({
    imagePrompt: '',
    chatContextTail: ctx,
    characterGender: params.characterGender,
    playerGender: params.playerGender,
  })

  const lines: string[] = [
    '---------------------',
    '【NSFW 姿势 tag 参考库｜仅当本轮写亲密 `[图片]` 时参照】',
    '---------------------',
    `- 配对类型（硬性）：${pairingLabelZh(pairing)}；tag 须与此一致（如 GL→2girls,yuri；BL→2boys,yaoi；BG→1girl,1boy）。`,
    '- 下列为**参考 tag**，须按当轮语境**改写合并**进单独一行 `[图片]英文 comma-separated tags`。',
    '- **禁止**输出 image###、imgthink、中文句子；**禁止**整段照抄与语境无关的体位。',
    '',
  ]

  let chars = lines.join('\n').length
  const cap = params.maxChars ?? 3200
  for (const row of recalled) {
    const block = `■ 命中「${row.matchedKey}」·参考 tag（${row.entry.keys.slice(0, 3).join(' / ')}）\n${row.variantTags.slice(0, 520)}`
    if (chars + block.length > cap && lines.length > 4) break
    lines.push(block, '')
    chars += block.length + 1
  }

  return lines.join('\n').trim()
}
