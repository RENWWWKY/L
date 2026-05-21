import { useEffect, useState } from 'react'
import { parseMemorySourcePrefix } from '../wechat/memory/memorySourceBadges'
import type { CharacterMemory } from '../wechat/newFriendsPersona/types'
import { expandMeetMemoryContentForDisplayAsync } from './meetMemoryContentPreview'
import type { EncounterNPC, MeetPublicProfile } from './meetTypes'

/** 列表预览：展开 {{user}} / {{char}} 为显示名（入库仍为表达式） */
export function MeetMemoryEntryBody({
  mem,
  characterId,
  npc,
  meetProfile,
}: {
  mem: CharacterMemory
  characterId: string
  npc: EncounterNPC | null
  meetProfile: MeetPublicProfile
}) {
  const body = parseMemorySourcePrefix(mem.content).body.trim()
  const [display, setDisplay] = useState(body)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!body.includes('{{')) {
        if (!cancelled) setDisplay(body)
        return
      }
      try {
        const out = await expandMeetMemoryContentForDisplayAsync(body, characterId, npc, meetProfile)
        if (!cancelled) setDisplay(out)
      } catch {
        if (!cancelled) setDisplay(body)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [body, characterId, npc, meetProfile, mem.id])

  return (
    <p className="font-elegant-serif text-[14px] leading-relaxed text-[#4a4540] whitespace-pre-wrap">{display || '—'}</p>
  )
}
