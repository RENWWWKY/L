import type { CharacterMemory } from '../newFriendsPersona/types'

/** 三大身份来源：主号微信 / 副号微信 / 遇见 */
export type MemorySourceIdentity = 'main_wechat' | 'sub_wechat' | 'lumi_meet'

export type MemorySceneTag = '私聊' | '群聊' | '线下' | '关联线下' | '遇见'

export type MemoryTriggerType = 'always' | 'keyword'

/** 记忆档案馆 UI 视图模型（由 IndexedDB `CharacterMemory` 映射而来） */
export interface MemoryEntry {
  id: string
  sourceIdentity: MemorySourceIdentity
  /** 列表筛选与卡片展示用的角色 id（群聊取首个真实成员） */
  charId: string
  /** 原始 bucket characterId（群聊为占位 id） */
  storageCharacterId: string
  charDisplayName: string
  charAvatarUrl?: string
  content: string
  tags: MemorySceneTag[]
  triggerType: MemoryTriggerType
  triggerKeywords?: string[]
  timestamp: number
  /** 群聊记忆专用 */
  groupId?: string
  groupDisplayName?: string
  memoryScope?: CharacterMemory['memoryScope']
  linkedFromCharacterId?: string
  /** 写入来源：微信昵称 · 扮演身份（有 sourceWechatAccountId 时解析） */
  sourceLineLabel?: string
  /** 正文中各 {{user}} 槽位绑定，格式同 sourceLineLabel */
  userBindingLabels?: string[]
  /** 列表展示用：占位符已展开为昵称/角色名（与编辑页预览一致） */
  contentExpanded?: string
}

export type MemoryCharacterFocus = {
  charId: string
  displayName: string
  avatarUrl?: string
}

export const MEMORY_ARCHIVE_SOURCE_TABS: ReadonlyArray<{
  id: MemorySourceIdentity
  label: string
}> = [
  { id: 'main_wechat', label: '主身份' },
  { id: 'sub_wechat', label: '伪装小号' },
  { id: 'lumi_meet', label: 'Lumi Meet' },
] as const

/** 档案馆列表：自有长期记忆 vs 线下关联记忆（注入逻辑分轨，总结逻辑不变） */
export type MemoryArchiveKind = 'own' | 'linked'

export const MEMORY_ARCHIVE_KIND_TABS: ReadonlyArray<{
  id: MemoryArchiveKind
  label: string
}> = [
  { id: 'own', label: '角色记忆' },
  { id: 'linked', label: '关联记忆' },
] as const
