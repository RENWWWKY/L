import { isDefaultMomentsCoverUrl, resolveMomentsCoverDisplayUrl } from '../../../components/moments/momentsCoverDefaults'
import { resolveCharacterAvatarUrl } from '../../utils/characterAvatarUrl'

import type { Character, CharacterProfileImageHistoryEntry } from './newFriendsPersona/types'

export const PROFILE_IMAGE_HISTORY_MAX = 12

function newHistoryId(): string {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeHistoryEntry(raw: unknown): CharacterProfileImageHistoryEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const url = typeof o.url === 'string' ? o.url.trim() : ''
  if (!url) return null
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newHistoryId()
  const savedAt =
    typeof o.savedAt === 'number' && Number.isFinite(o.savedAt) ? Math.floor(o.savedAt) : Date.now()
  return { id, url, savedAt }
}

export function parseCharacterProfileImageHistory(raw: unknown): CharacterProfileImageHistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: CharacterProfileImageHistoryEntry[] = []
  for (const row of raw) {
    const entry = normalizeHistoryEntry(row)
    if (!entry) continue
    if (out.some((x) => x.url === entry.url)) continue
    out.push(entry)
    if (out.length >= PROFILE_IMAGE_HISTORY_MAX) break
  }
  return out
}

export function ensureCharacterProfileImageHistoryBaseline(character: Character): Character {
  let next = character
  const avatar = character.avatarUrl?.trim()
  if (avatar && !character.originalAvatarUrl?.trim()) {
    next = { ...next, originalAvatarUrl: avatar }
  }
  const cover = character.momentsCoverUrl?.trim()
  if (cover && !isDefaultMomentsCoverUrl(cover) && !character.originalMomentsCoverUrl?.trim()) {
    next = { ...next, originalMomentsCoverUrl: cover }
  }
  return next
}

function appendProfileImageHistory(
  history: CharacterProfileImageHistoryEntry[],
  url: string,
): CharacterProfileImageHistoryEntry[] {
  const t = url.trim()
  if (!t) return history
  if (history.some((x) => x.url === t)) return history
  const next = [...history, { id: newHistoryId(), url: t, savedAt: Date.now() }]
  return next.slice(-PROFILE_IMAGE_HISTORY_MAX)
}

export function buildCharacterProfileImageCatalogBlock(character: Character | null | undefined): string {
  if (!character?.id?.trim()) return ''
  const ch = ensureCharacterProfileImageHistoryBaseline(character)
  const avatarLines: string[] = []
  const coverLines: string[] = []

  if (ch.originalAvatarUrl?.trim()) {
    avatarLines.push('- original：原始微信头像（建档/首次有效头像）')
  }
  ch.avatarHistory?.forEach((entry, index) => {
    avatarLines.push(`- ${index + 1}：历史头像（id=${entry.id}）`)
  })

  if (ch.originalMomentsCoverUrl?.trim() && !isDefaultMomentsCoverUrl(ch.originalMomentsCoverUrl)) {
    coverLines.push('- original：原始朋友圈背景（首次有效背景）')
  }
  ch.momentsCoverHistory?.forEach((entry, index) => {
    coverLines.push(`- ${index + 1}：历史朋友圈背景（id=${entry.id}）`)
  })

  const blocks: string[] = [
    '【你的微信头像 / 朋友圈背景 · 当前与历史】',
    'system 之后若注入配图：第 1 张通常是你的微信头像，第 2 张是朋友圈主页顶部背景。',
    '请你根据对话自行判断：若要把用户刚发的图设为资料图，口语回应后输出 `[换头像]` 或 `[换朋友圈背景]`；若要换回原始/历史图，输出 `[恢复头像|original]` / `[恢复头像|1]` 或 `[恢复朋友圈背景|original]` / `[恢复朋友圈背景|1]`（数字对应下列序号）。换背景/头像不是发朋友圈动态——禁止用 `[发朋友圈]` 代替换背景。',
  ]

  if (avatarLines.length) {
    blocks.push('可恢复的微信头像：', ...avatarLines)
  } else if (ch.avatarUrl?.trim()) {
    blocks.push('（尚无头像历史记录；换过头像后会出现 original / 序号项。）')
  }

  if (coverLines.length) {
    blocks.push('可恢复的朋友圈背景：', ...coverLines)
  } else if (ch.momentsCoverUrl?.trim() && !isDefaultMomentsCoverUrl(ch.momentsCoverUrl)) {
    blocks.push('（尚无朋友圈背景历史；换过背景后会出现 original / 序号项。）')
  }

  return blocks.join('\n')
}

export type CharacterSelfProfileVisionPart = {
  label: string
  url: string
}

export function buildCharacterSelfProfileVisionParts(
  character: Character | null | undefined,
): CharacterSelfProfileVisionPart[] {
  if (!character?.id?.trim()) return []
  const ch = ensureCharacterProfileImageHistoryBaseline(character)
  const out: CharacterSelfProfileVisionPart[] = []
  const avatar = resolveCharacterAvatarUrl({ avatarUrl: ch.avatarUrl })
  if (avatar?.trim()) {
    out.push({ label: '下图：你当前的微信头像', url: avatar.trim() })
  }
  const cover = resolveMomentsCoverDisplayUrl(ch.momentsCoverUrl)
  if (cover?.trim()) {
    out.push({ label: '下图：你朋友圈主页顶部背景图', url: cover.trim() })
  }
  return out
}

export function resolveProfileImageRestoreUrl(
  character: Character,
  target: 'avatar' | 'momentsCover',
  restoreKey: string,
): string | null {
  const ch = ensureCharacterProfileImageHistoryBaseline(character)
  const key = restoreKey.trim().toLowerCase()
  if (!key) return null

  if (target === 'avatar') {
    if (key === 'original' || key === '原始' || key === '最初') {
      return ch.originalAvatarUrl?.trim() || ch.avatarUrl?.trim() || null
    }
    const history = ch.avatarHistory ?? []
    if (/^\d+$/.test(key)) {
      const idx = Number(key) - 1
      return history[idx]?.url?.trim() || null
    }
    return history.find((x) => x.id === restoreKey.trim())?.url?.trim() || null
  }

  if (key === 'original' || key === '原始' || key === '最初') {
    const orig = ch.originalMomentsCoverUrl?.trim()
    if (orig) return orig
    const current = ch.momentsCoverUrl?.trim()
    return current && !isDefaultMomentsCoverUrl(current) ? current : null
  }
  const history = ch.momentsCoverHistory ?? []
  if (/^\d+$/.test(key)) {
    const idx = Number(key) - 1
    return history[idx]?.url?.trim() || null
  }
  return history.find((x) => x.id === restoreKey.trim())?.url?.trim() || null
}

export function applyProfileImageUrlChange(
  character: Character,
  target: 'avatar' | 'momentsCover',
  nextUrl: string,
): Character {
  const url = nextUrl.trim()
  if (!url) return character
  const ch = ensureCharacterProfileImageHistoryBaseline(character)

  if (target === 'avatar') {
    const current = ch.avatarUrl?.trim()
    if (current === url) return ch
    const history = current ? appendProfileImageHistory(ch.avatarHistory ?? [], current) : ch.avatarHistory ?? []
    return {
      ...ch,
      avatarUrl: url,
      avatarHistory: history,
      originalAvatarUrl: ch.originalAvatarUrl?.trim() || current || url,
      updatedAt: Date.now(),
    }
  }

  const current = ch.momentsCoverUrl?.trim()
  if (current === url) return ch
  const history =
    current && !isDefaultMomentsCoverUrl(current)
      ? appendProfileImageHistory(ch.momentsCoverHistory ?? [], current)
      : ch.momentsCoverHistory ?? []
  const original =
    ch.originalMomentsCoverUrl?.trim() ||
    (current && !isDefaultMomentsCoverUrl(current) ? current : undefined) ||
    (!isDefaultMomentsCoverUrl(url) ? url : undefined)
  return {
    ...ch,
    momentsCoverUrl: url,
    momentsCoverHistory: history,
    originalMomentsCoverUrl: original,
    updatedAt: Date.now(),
  }
}
