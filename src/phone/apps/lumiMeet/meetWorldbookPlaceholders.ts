import { isMeetProfilePlaceholder } from './comprehensivePersona'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export type MeetWorldbookNameIds = {
  nickname: string
  realName?: string | null
  /** 写入尾声档案标题 / 正文时替换为 {{user}} */
  userDisplayName?: string | null
}

/**
 * 将遇见写入「档案法则 / 人设世界书分册」的正文中的角色实名、网名及用户展示名
 * 替换为 `{{char}}` / `{{user}}`，便于与微信侧占位符注入一致。
 */
export function rewriteMeetWorldbookNamesToPlaceholders(text: string, ids: MeetWorldbookNameIds): string {
  let t = String(text ?? '')
  const nick = String(ids.nickname ?? '').trim()
  const rn = String(ids.realName ?? '').trim()
  const ud = String(ids.userDisplayName ?? '').trim()

  const charChunks = [...new Set([rn, nick].filter((x) => x && !isMeetProfilePlaceholder(x)))]
  charChunks.sort((a, b) => b.length - a.length)
  for (const chunk of charChunks) {
    t = t.replace(new RegExp(escapeRegExp(chunk), 'g'), '{{char}}')
  }

  if (ud && !isMeetProfilePlaceholder(ud)) {
    t = t.replace(new RegExp(escapeRegExp(ud), 'g'), '{{user}}')
  }
  return t
}
