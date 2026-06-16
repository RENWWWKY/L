import type { CharacterMemory } from '../newFriendsPersona/types'
import type { MomentMemoryPayload } from '../newFriendsPersona/types'

/** 三大身份来源：主号微信 / 副号微信 / 遇见 */
export type MemorySourceIdentity = 'main_wechat' | 'sub_wechat' | 'lumi_meet'

export type MemorySceneTag = '私聊' | '群聊' | '线下' | '关联线下' | '遇见' | '朋友圈'

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
  /** 写入来源微信账号（遇见记忆通常为空，改由场景标签区分） */
  sourceWechatAccountId?: string
  /** 写入来源：微信昵称 · 扮演身份（有 sourceWechatAccountId 时解析） */
  sourceLineLabel?: string
  /** 正文中各 {{user}} 槽位绑定，格式同 sourceLineLabel */
  userBindingLabels?: string[]
  /** 列表展示用：占位符已展开为昵称/角色名（与编辑页预览一致） */
  contentExpanded?: string
  /** 朋友圈记忆专属元数据 */
  momentPayload?: MomentMemoryPayload
  /** 发布者朋友圈记忆：曾互动过的关联角色（仅 publisher 卡片展示） */
  momentLinkedInteractors?: Array<{
    charId: string
    displayName: string
    avatarUrl?: string
  }>
  momentMemoryRole?: CharacterMemory['momentMemoryRole']
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

/** 角色详情页：可多选筛选的记忆场景分类 */
export type MemoryScopeFilterId = 'linked'

export type MemoryTypeFilterId = MemorySceneTag | MemoryScopeFilterId

export const MEMORY_SCENE_FILTER_OPTIONS: ReadonlyArray<{
  id: MemorySceneTag
  label: string
}> = [
  { id: '私聊', label: '私聊' },
  { id: '群聊', label: '群聊' },
  { id: '朋友圈', label: '朋友圈' },
  { id: '遇见', label: '遇见应用' },
  { id: '线下', label: '线下' },
  { id: '关联线下', label: '关联线下' },
] as const

export const MEMORY_TYPE_FILTER_OPTIONS: ReadonlyArray<{
  id: MemoryTypeFilterId
  label: string
}> = [
  ...MEMORY_SCENE_FILTER_OPTIONS,
  { id: 'linked', label: '关联记忆' },
] as const

export type MemoryCharacterRosterItem = {
  charId: string
  /** 人设真实姓名（优先 `Character.name`，非微信备注） */
  displayName: string
  /** 与真实姓名不同时，用于副标题展示微信备注 */
  wechatRemarkName?: string
  avatarUrl?: string
  memoryCount: number
  /** 该角色下出现过的场景标签（去重） */
  sceneTags: MemorySceneTag[]
  hasLinked: boolean
  hasOwn: boolean
}

/** 角色独立记忆页：同步给顶栏标题与翻页 */
export type MemoryCharacterPageMeta = {
  charId: string
  displayName: string
  rosterIndex: number
  rosterTotal: number
  canPrev: boolean
  canNext: boolean
}
