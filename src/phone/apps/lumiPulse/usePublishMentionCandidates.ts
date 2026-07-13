import { useMemo } from 'react'

import type { PublishMentionCandidate } from './components/publish/PublishMentionSheet'
import type { PulseFollowingUser, PulsePovOption } from './pulseTypes'
import { usePulseFollowingList } from './pulseStoreSelectors'

/** 合并世界角色与关注列表，供发布面板 @ 艾特 */
export function usePublishMentionCandidates(
  playerPovId: string | null,
  povOptions: PulsePovOption[],
): PublishMentionCandidate[] {
  const following = usePulseFollowingList(playerPovId)

  return useMemo(() => {
    const seen = new Set<string>()
    const rows: PublishMentionCandidate[] = []

    const push = (name: string, avatarUrl?: string, subtitle?: string) => {
      const key = name.trim()
      if (!key || seen.has(key)) return
      seen.add(key)
      rows.push({ name: key, avatarUrl, subtitle })
    }

    for (const opt of povOptions) {
      push(opt.label, opt.avatarUrl, opt.worldName)
    }
    for (const user of following as PulseFollowingUser[]) {
      push(user.name, user.avatarUrl, user.bio)
    }

    return rows
  }, [following, povOptions])
}
