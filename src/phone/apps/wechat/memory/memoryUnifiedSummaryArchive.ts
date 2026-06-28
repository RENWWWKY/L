import type { MemoryCharacterRosterItem, MemorySceneTag } from './memoryArchiveTypes'
import type { StoryTimelineArchiveRosterItem } from './memoryStoryTimelineArchive'

export type MemoryUnifiedRosterItem = MemoryCharacterRosterItem & {
  onlineMemoryCount: number
  offlineRowCount: number
  lastActivityAt: number
}

function mergeSceneTags(a: MemorySceneTag[], b: MemorySceneTag[]): MemorySceneTag[] {
  const set = new Set<MemorySceneTag>([...a, ...b])
  return [...set]
}

/** 合并线上 prose 角色列表与线下摘要表 roster（同 charId 只出现一行） */
export function buildUnifiedSummaryRoster(params: {
  onlineRoster: MemoryCharacterRosterItem[]
  offlineRoster: StoryTimelineArchiveRosterItem[]
}): MemoryUnifiedRosterItem[] {
  const map = new Map<string, MemoryUnifiedRosterItem>()

  for (const item of params.onlineRoster) {
    map.set(item.charId, {
      ...item,
      onlineMemoryCount: item.memoryCount,
      offlineRowCount: 0,
      memoryCount: item.memoryCount,
      lastActivityAt: 0,
    })
  }

  for (const item of params.offlineRoster) {
    const offlineCount = item.rowCount
    const prev = map.get(item.charId)
    if (prev) {
      prev.offlineRowCount = offlineCount
      prev.memoryCount = prev.onlineMemoryCount + offlineCount
      prev.lastActivityAt = Math.max(prev.lastActivityAt, item.lastUpdatedAt)
      prev.sceneTags = mergeSceneTags(prev.sceneTags, item.sceneTags)
      if (item.avatarUrl && !prev.avatarUrl) prev.avatarUrl = item.avatarUrl
      if (item.wechatRemarkName && !prev.wechatRemarkName) {
        prev.wechatRemarkName = item.wechatRemarkName
      }
    } else {
      map.set(item.charId, {
        charId: item.charId,
        displayName: item.displayName,
        wechatRemarkName: item.wechatRemarkName,
        avatarUrl: item.avatarUrl,
        memoryCount: offlineCount,
        sceneTags: [...item.sceneTags],
        hasLinked: item.hasLinked,
        hasOwn: item.hasOwn,
        onlineMemoryCount: 0,
        offlineRowCount: offlineCount,
        lastActivityAt: item.lastUpdatedAt,
      })
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      b.lastActivityAt - a.lastActivityAt ||
      b.memoryCount - a.memoryCount ||
      a.displayName.localeCompare(b.displayName, 'zh-CN'),
  )
}
