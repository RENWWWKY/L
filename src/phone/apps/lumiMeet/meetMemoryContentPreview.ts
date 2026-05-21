import { useEffect, useState } from 'react'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import { expandCharUserPlaceholders } from '../wechat/charUserPlaceholders'
import { resolveMeetCharUserNames } from './meetPersonaPreview'
import { resolveMeetPublicDisplayName } from './meetPublicProfileDisplay'
import { resolveMeetNpcCharRealNameForLore, type EncounterNPC, type MeetPublicProfile } from './meetTypes'

/** {{user}} 记忆预览展开名：仅遇见假面，不读微信资料 */
export function resolveMeetMemoryPreviewUserName(profile: MeetPublicProfile): string {
  return resolveMeetPublicDisplayName(profile)
}

export function resolveMeetMemoryPreviewCharName(npc: EncounterNPC | null, fallback = '对方'): string {
  if (!npc) return fallback
  const real = resolveMeetNpcCharRealNameForLore(npc)?.trim()
  if (real) return real
  return npc.nickname?.trim() || fallback
}

/** 本地展开 {{user}} / {{char}}（无 IndexedDB 或兜底） */
export function expandMeetMemoryContentForDisplay(
  text: string,
  npc: EncounterNPC | null,
  profile: MeetPublicProfile,
): string {
  const raw = String(text ?? '')
  if (!raw.includes('{{')) return raw
  const names = resolveMeetCharUserNames(resolveMeetMemoryPreviewCharName(npc), {
    ...profile,
    displayName: resolveMeetMemoryPreviewUserName(profile),
  })
  return expandCharUserPlaceholders(raw, names)
}

/** 列表/编辑预览：优先 IndexedDB 人设绑定规则，失败则本地展开 */
export async function expandMeetMemoryContentForDisplayAsync(
  text: string,
  characterId: string | null | undefined,
  npc: EncounterNPC | null,
  profile: MeetPublicProfile,
): Promise<string> {
  const raw = String(text ?? '').trim()
  if (!raw.includes('{{')) return raw
  const cid = characterId?.trim()
  if (cid) {
    try {
      const out = await personaDb.expandMemoryDraftForPromptPreview({
        content: raw,
        characterId: cid,
        memoryScope: 'meet',
      })
      if (out && out !== raw) return out
    } catch {
      /* fallback */
    }
  }
  return expandMeetMemoryContentForDisplay(raw, npc, profile)
}

export function useMeetMemoryDraftPreview(opts: {
  draft: string
  characterId: string | null | undefined
  npc: EncounterNPC | null
  profile: MeetPublicProfile
  debounceMs?: number
}): { expanded: string; loading: boolean } {
  const [expanded, setExpanded] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const raw = String(opts.draft ?? '')
    if (!raw.includes('{{')) {
      setExpanded('')
      setLoading(false)
      return
    }
    let cancelled = false
    const ms = opts.debounceMs ?? 320
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const out = await expandMeetMemoryContentForDisplayAsync(
            raw,
            opts.characterId,
            opts.npc,
            opts.profile,
          )
          if (!cancelled) setExpanded(out)
        } catch {
          if (!cancelled) setExpanded(expandMeetMemoryContentForDisplay(raw, opts.npc, opts.profile))
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, ms)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [opts.draft, opts.characterId, opts.npc, opts.profile, opts.debounceMs])

  return { expanded, loading }
}
