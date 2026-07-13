/** 自拍/对镜 `[图片]` 行前缀（LLM 输出）；与 cast 填 {{char}} 真名 */
export const CHARACTER_MEDIA_SELFIE_PREFIX_TEMPLATE = '[wx-selfie|who={{char}}]'

/** 旧版前缀（历史消息兼容识别，不再写入新 prompt 规则） */
export const LEGACY_CHARACTER_MEDIA_SELFIE_PREFIX_RE =
  /^\[SUBJECT:PERSON_ACTION(?:\|cast=[^\]]+)?\]/i

export const CHARACTER_MEDIA_SELFIE_PREFIX_RE =
  /^\[(?:wx-selfie\|who=[^\]]+|SUBJECT:PERSON_ACTION(?:\|cast=[^\]]+)?)\]/i

export function buildCharacterMediaSelfiePrefix(characterName: string): string {
  const name = characterName.trim()
  return name
    ? `[wx-selfie|who=${name}]`
    : CHARACTER_MEDIA_SELFIE_PREFIX_TEMPLATE
}

export function hasCharacterMediaSelfiePrefix(prompt: string): boolean {
  return CHARACTER_MEDIA_SELFIE_PREFIX_RE.test(String(prompt ?? '').trim())
}

/** 去掉自拍前缀，保留英文 tag 正文 */
export function stripCharacterMediaSelfiePrefix(prompt: string): string {
  return String(prompt ?? '')
    .trim()
    .replace(CHARACTER_MEDIA_SELFIE_PREFIX_RE, '')
    .replace(/^\s+/, '')
    .trim()
}
