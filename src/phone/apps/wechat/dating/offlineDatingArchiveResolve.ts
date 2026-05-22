import type { Character } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'

/**
 * 线下约会剧情 KV（`wechat-dating-archives-v1`）按**根人设 characterId** 存；NPC 有人脉字段 `generatedForCharacterId` 指向主角时，应从主角档读取同一时间线。
 */
export type OfflineDatingArchiveContext = {
  /** 读 KV / 游标用的 id（通常为根人设） */
  archiveCharacterId: string
  /** 当前会话/视角人设 id（可能是 NPC） */
  perspectiveCharacterId: string
  archiveOwner: Character | null
  perspective: Character | null
}

export async function resolveOfflineDatingArchiveContext(peerCharacterId: string): Promise<OfflineDatingArchiveContext | null> {
  const pid = peerCharacterId.trim()
  if (!pid) return null
  let perspective: Character | null = null
  try {
    perspective = await personaDb.getCharacter(pid)
  } catch {
    perspective = null
  }
  const parent = perspective?.generatedForCharacterId?.trim()
  const archiveId = parent && parent !== pid ? parent : pid
  let archiveOwner: Character | null = null
  if (archiveId === pid) {
    archiveOwner = perspective
  } else {
    try {
      archiveOwner = await personaDb.getCharacter(archiveId)
    } catch {
      archiveOwner = null
    }
  }
  return {
    archiveCharacterId: archiveId,
    perspectiveCharacterId: pid,
    archiveOwner,
    perspective,
  }
}

/** 用于在主角线下正文里筛「与某 NPC 相关」的可检索片段（长词优先） */
export function collectCharacterMentionSearchTokens(ch: Character | null): string[] {
  if (!ch) return []
  const s = new Set<string>()
  const add = (raw?: string | null) => {
    const t = String(raw ?? '').trim()
    if (t.length >= 2) s.add(t)
  }
  add(ch.name)
  add(ch.wechatNickname)
  add(ch.remark)
  const name = String(ch.name ?? '').trim()
  if (name.length >= 1) s.add(`【${name}】`)
  return [...s].sort((a, b) => b.length - a.length)
}

export function textMentionsAnyToken(text: string, tokens: string[]): boolean {
  if (!tokens.length) return true
  const flat = String(text ?? '')
  for (const tok of tokens) {
    if (tok && flat.includes(tok)) return true
  }
  return false
}

/** 剧情正文是否提及该人设（姓名/昵称或 `{{id:人设UUID}}`） */
export function plotBodyMentionsCharacter(ch: Character | null, body: string): boolean {
  const flat = String(body ?? '')
  if (!flat.trim() || !ch) return false
  const id = ch.id.trim()
  if (id && flat.includes(`{{id:${id}}}`)) return true
  return textMentionsAnyToken(flat, collectCharacterMentionSearchTokens(ch))
}
