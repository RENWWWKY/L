import { ArrowLeft, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { Pressable } from '../../../components/Pressable'
import { phoneNumStyle } from '../../../types'
import type { ChatConversationSettingsRow } from '../newFriendsPersona/types'
import {
  CLASSIC_EMOJI_UI_DEFAULT_ROUND_TRIGGER_PERCENT,
  STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT,
  countClassicEmojiBannedNames,
  countStickerBannedRefs,
  countStickerTargetedGroups,
  displayRoundTriggerPercent,
  applyStickerGroupTargetedPercent,
  coerceStickerTargetedEntriesForStorage,
  inferStickerTargetedGroupsFromEntries,
  isRoundTriggerCustomized,
  isStickerTargetedModeEnabled,
  resolveStickerGroupTargetedPercent,
  type StickerTargetedEntryMap,
} from '../wechatMediaSendFrequency'
import { ensureStickerStoreHydrated, getStickerCatalogEntries, type StickerCatalogEntry } from '../stickers/stickerStore'
import { buildWechatClassicStickerGroups } from '../stickers/wechatClassicStickerPack'

type EmojiProbTab = 'unified' | 'targeted' | 'classic'

function ChatSettingsNum({ children }: { children: ReactNode }) {
  return <span style={phoneNumStyle}>{children}</span>
}

function renderGroupCountSubtitle(total: number, allowed: number): ReactNode {
  return (
    <>
      <ChatSettingsNum>{total}</ChatSettingsNum> 个 · 可发 <ChatSettingsNum>{allowed}</ChatSettingsNum> 个
    </>
  )
}

function WxSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200"
      style={{ backgroundColor: on ? '#000000' : '#cccccc' }}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
        style={{ left: on ? 26 : 4 }}
        aria-hidden
      />
    </button>
  )
}

function RoundTriggerPercentControl({
  kind,
  stored,
  onChange,
  onResetDefault,
}: {
  kind: 'sticker' | 'classicEmoji'
  stored: number | undefined
  onChange: (percent: number) => void
  onResetDefault: () => void
}) {
  const display = displayRoundTriggerPercent(stored, kind)
  const customized = isRoundTriggerCustomized(stored)

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-medium text-black">
          {customized ? (
            <ChatSettingsNum>{display}%</ChatSettingsNum>
          ) : kind === 'classicEmoji' ? (
            <>
              展示默认约 <ChatSettingsNum>{CLASSIC_EMOJI_UI_DEFAULT_ROUND_TRIGGER_PERCENT}%</ChatSettingsNum>
            </>
          ) : (
            '系统默认由语境决定（无固定概率）'
          )}
        </span>
        {customized ? (
          <button type="button" onClick={onResetDefault} className="shrink-0 text-[12px] text-[#576b95]">
            恢复默认
          </button>
        ) : null}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={display}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-black"
        aria-label={kind === 'classicEmoji' ? '微信黄脸每轮触发概率' : '表情包每轮触发概率'}
      />
      <div className="mt-1 flex justify-between text-[11px] text-[#8e8e8e]">
        <span>
          <ChatSettingsNum>0%</ChatSettingsNum> 不发
        </span>
        <span>
          <ChatSettingsNum>100%</ChatSettingsNum> 每轮必发
        </span>
      </div>
    </div>
  )
}

function groupCatalogEntries(entries: StickerCatalogEntry[]): Map<string, StickerCatalogEntry[]> {
  const map = new Map<string, StickerCatalogEntry[]>()
  for (const entry of entries) {
    const key = entry.groupTag || entry.groupName || '其它'
    const list = map.get(key) ?? []
    list.push(entry)
    map.set(key, list)
  }
  return map
}

export function summarizeEmojiProbabilitySettings(row: Pick<
  ChatConversationSettingsRow,
  | 'stickerRoundTriggerPercent'
  | 'stickerTargetedModeEnabled'
  | 'stickerTargetedGroups'
  | 'stickerTargetedEntries'
  | 'stickerBannedRefs'
  | 'classicEmojiRoundTriggerPercent'
  | 'classicEmojiBannedNames'
>): string {
  const parts: string[] = []
  if (row.stickerRoundTriggerPercent !== undefined) {
    parts.push(`表情包 ${row.stickerRoundTriggerPercent}%`)
  }
  if (isStickerTargetedModeEnabled(row.stickerTargetedModeEnabled)) {
    parts.push(`定向 ${countStickerTargetedGroups(row.stickerTargetedGroups)} 组`)
  }
  if (countStickerBannedRefs(row.stickerBannedRefs) > 0) {
    parts.push(`禁表情包 ${countStickerBannedRefs(row.stickerBannedRefs)}`)
  }
  if (row.classicEmojiRoundTriggerPercent !== undefined) {
    parts.push(`黄脸 ${row.classicEmojiRoundTriggerPercent}%`)
  }
  if (countClassicEmojiBannedNames(row.classicEmojiBannedNames) > 0) {
    parts.push(`禁黄脸 ${countClassicEmojiBannedNames(row.classicEmojiBannedNames)}`)
  }
  return parts.length ? parts.join(' · ') : '未定制'
}

export type ChatEmojiProbabilityPatch = Partial<
  Pick<
    ChatConversationSettingsRow,
    | 'stickerRoundTriggerPercent'
    | 'stickerTargetedModeEnabled'
    | 'stickerTargetedGroups'
    | 'stickerTargetedEntries'
    | 'stickerBannedRefs'
    | 'classicEmojiRoundTriggerPercent'
    | 'classicEmojiBannedNames'
  >
> & {
  clearStickerRoundTriggerPercent?: boolean
  clearClassicEmojiRoundTriggerPercent?: boolean
  clearClassicEmojiBannedNames?: boolean
  clearStickerTargetedConfig?: boolean
}

function CollapsibleGroupHeader({
  title,
  subtitle,
  checked,
  onToggleCheck,
  expanded,
  onToggleExpand,
  groupPercentControl,
}: {
  title: string
  subtitle?: ReactNode
  checked: boolean
  onToggleCheck: () => void
  expanded: boolean
  onToggleExpand: () => void
  groupPercentControl?: {
    percent: number
    mixed: boolean
    onChange: (percent: number) => void
  }
}) {
  return (
    <div className="border-b border-[#f0f0f0] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleCheck}
          className="size-4 shrink-0 accent-black"
          aria-label={`${title} 分组`}
        />
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-[#8e8e8e]" aria-hidden />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-[#8e8e8e]" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-black">{title}</p>
            {subtitle ? <p className="truncate text-[11px] text-[#8e8e8e]">{subtitle}</p> : null}
          </div>
        </button>
      </div>
      {checked && groupPercentControl ? (
        <div className="mt-2 pl-6">
          <div className="flex items-center justify-between text-[12px] text-[#666]">
            <span>组内选用概率</span>
            <span>
              {groupPercentControl.mixed ? '约 ' : ''}
              <ChatSettingsNum>{groupPercentControl.percent}%</ChatSettingsNum>
              {groupPercentControl.mixed ? '（组内不一致）' : ''}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={groupPercentControl.percent}
            onChange={(e) => groupPercentControl.onChange(Number(e.target.value))}
            className="mt-1 w-full accent-black"
            aria-label={`${title} 组内选用概率`}
          />
        </div>
      ) : null}
    </div>
  )
}

export function ChatEmojiProbabilitySettingsScreen({
  peerDisplayName,
  settings,
  onPatch,
  onClose,
}: {
  peerDisplayName: string
  settings: ChatConversationSettingsRow
  onPatch: (partial: ChatEmojiProbabilityPatch) => void | Promise<void>
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<EmojiProbTab>('unified')
  const [catalog, setCatalog] = useState<StickerCatalogEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [draftGroups, setDraftGroups] = useState<string[]>([])
  const [draftBannedRefs, setDraftBannedRefs] = useState<string[]>([])
  const [draftTargeted, setDraftTargeted] = useState<StickerTargetedEntryMap>({})
  const [draftClassicBanned, setDraftClassicBanned] = useState<string[]>([])
  const [expandedGifGroups, setExpandedGifGroups] = useState<Set<string>>(() => new Set())
  const [expandedClassicGroups, setExpandedClassicGroups] = useState<Set<string>>(() => new Set())

  const stickerStored = settings.stickerRoundTriggerPercent
  const classicStored = settings.classicEmojiRoundTriggerPercent
  const targetedEnabled = isStickerTargetedModeEnabled(settings.stickerTargetedModeEnabled)

  const classicGroups = useMemo(() => buildWechatClassicStickerGroups(), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setCatalogLoading(true)
      try {
        await ensureStickerStoreHydrated()
        if (cancelled) return
        setCatalog(getStickerCatalogEntries())
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const groups =
      settings.stickerTargetedGroups !== undefined
        ? settings.stickerTargetedGroups
        : inferStickerTargetedGroupsFromEntries(settings.stickerTargetedEntries, catalog)
    setDraftGroups(groups)
    setDraftBannedRefs(settings.stickerBannedRefs ?? [])
    setDraftTargeted(settings.stickerTargetedEntries ?? {})
    setDraftClassicBanned(settings.classicEmojiBannedNames ?? [])
  }, [
    settings.stickerTargetedGroups,
    settings.stickerTargetedEntries,
    settings.stickerBannedRefs,
    settings.classicEmojiBannedNames,
    catalog,
  ])

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return catalog
    return catalog.filter(
      (e) =>
        e.ref.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.groupTag.toLowerCase().includes(q),
    )
  }, [catalog, search])

  const groupedCatalog = useMemo(() => groupCatalogEntries(filteredCatalog), [filteredCatalog])

  const persistTargeted = useCallback(
    (patch: {
      enabled?: boolean
      groups?: string[]
      entries?: StickerTargetedEntryMap
      bannedRefs?: string[]
    }) => {
      void onPatch({
        stickerTargetedModeEnabled: patch.enabled ?? targetedEnabled,
        stickerTargetedGroups: patch.groups ?? draftGroups,
        stickerTargetedEntries:
          coerceStickerTargetedEntriesForStorage(patch.entries ?? draftTargeted) ?? {},
        stickerBannedRefs: patch.bannedRefs ?? draftBannedRefs,
      })
    },
    [onPatch, targetedEnabled, draftGroups, draftTargeted, draftBannedRefs],
  )

  const toggleGifGroup = useCallback(
    (groupName: string, enabled: boolean, groupRefs: string[]) => {
      const nextGroups = enabled
        ? [...new Set([...draftGroups, groupName])]
        : draftGroups.filter((g) => g !== groupName)
      let nextTargeted = draftTargeted
      if (!enabled && groupRefs.length) {
        nextTargeted = { ...draftTargeted }
        for (const ref of groupRefs) delete nextTargeted[ref]
      }
      setDraftGroups(nextGroups)
      setDraftTargeted(nextTargeted)
      void persistTargeted({ groups: nextGroups, entries: nextTargeted })
    },
    [persistTargeted, draftGroups, draftTargeted],
  )

  const toggleGifBanned = useCallback(
    (ref: string, banned: boolean) => {
      setDraftBannedRefs((prev) => {
        const set = new Set(prev)
        if (banned) set.add(ref)
        else set.delete(ref)
        const next = [...set]
        void persistTargeted({ bannedRefs: next })
        return next
      })
    },
    [persistTargeted],
  )

  const setGifPercent = useCallback(
    (ref: string, percent: number) => {
      setDraftTargeted((prev) => {
        const next = { ...prev, [ref]: percent }
        void persistTargeted({ entries: next })
        return next
      })
    },
    [persistTargeted],
  )

  const setGifGroupPercent = useCallback(
    (refs: string[], percent: number) => {
      const bannedSet = new Set(draftBannedRefs)
      setDraftTargeted((prev) => {
        const next = applyStickerGroupTargetedPercent(refs, bannedSet, prev, percent)
        void persistTargeted({ entries: next })
        return next
      })
    },
    [persistTargeted, draftBannedRefs],
  )

  const persistClassicBanned = useCallback(
    (next: string[]) => {
      void onPatch({ classicEmojiBannedNames: next })
    },
    [onPatch],
  )

  const toggleClassicGroup = useCallback(
    (groupId: string, enabled: boolean) => {
      const group = classicGroups.find((g) => g.categoryId === groupId)
      if (!group) return
      const names = group.items.map((it) => it.description)
      setDraftClassicBanned((prev) => {
        const set = new Set(prev)
        if (enabled) {
          for (const n of names) set.delete(n)
        } else {
          for (const n of names) set.add(n)
        }
        const next = [...set]
        persistClassicBanned(next)
        return next
      })
    },
    [classicGroups, persistClassicBanned],
  )

  const toggleClassicBanned = useCallback(
    (name: string, banned: boolean) => {
      setDraftClassicBanned((prev) => {
        const set = new Set(prev)
        if (banned) set.add(name)
        else set.delete(name)
        const next = [...set]
        persistClassicBanned(next)
        return next
      })
    },
    [persistClassicBanned],
  )

  const bannedGifSet = useMemo(() => new Set(draftBannedRefs), [draftBannedRefs])
  const bannedClassicSet = useMemo(() => new Set(draftClassicBanned), [draftClassicBanned])
  const enabledGifGroupSet = useMemo(() => new Set(draftGroups), [draftGroups])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#ededed]">
      <header
        className="shrink-0 border-b border-[#e5e5e5] bg-[#ededed] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex w-full items-center">
          <Pressable
            type="button"
            aria-label="返回聊天信息"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          >
            <ArrowLeft className="size-5 text-black" strokeWidth={2} />
          </Pressable>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-[18px] font-bold text-black">表情包发送概率</h1>
            <p className="mt-0.5 truncate text-[12px] text-[#8e8e8e]">仅本聊天 · {peerDisplayName}</p>
          </div>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="shrink-0 border-b border-[#e5e5e5] px-4 py-2">
        <div className="flex gap-1">
          {(
            [
              { id: 'unified' as const, label: '统一表情包' },
              { id: 'targeted' as const, label: '定向表情包' },
              { id: 'classic' as const, label: '微信黄脸' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-full py-2 text-[12px] font-medium transition-colors ${
                  active ? 'bg-black text-white' : 'bg-white text-[#666]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {activeTab === 'unified' ? (
          <div className="rounded-[12px] bg-white px-4 py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p className="text-[16px] font-medium text-black">统一表情包概率</p>
            <p className="mt-2 text-[12px] leading-relaxed text-[#8e8e8e]">
              控制角色每轮回复中是否至少发 1 条 <span className="font-mono">[表情包]</span>
              行。展示默认约 <ChatSettingsNum>{STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT}%</ChatSettingsNum>；未定制时由系统语境决定。
            </p>
            <RoundTriggerPercentControl
              kind="sticker"
              stored={stickerStored}
              onChange={(percent) => void onPatch({ stickerRoundTriggerPercent: percent })}
              onResetDefault={() => void onPatch({ clearStickerRoundTriggerPercent: true })}
            />
          </div>
        ) : null}

        {activeTab === 'targeted' ? (
          <div className="space-y-3">
            <div className="rounded-[12px] bg-white px-4 py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[16px] font-medium text-black">启用定向限制</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#8e8e8e]">
                    开启后仅已勾选分组内的表情包可发；可对单个表情永久禁止，不影响同组其它已允许项。取消勾选分组即可禁用整组；组内概率调为{' '}
                    <ChatSettingsNum>0%</ChatSettingsNum> 仍视为已勾选。
                  </p>
                </div>
                <WxSwitch
                  on={targetedEnabled}
                  onToggle={() => {
                    void onPatch({
                      stickerTargetedModeEnabled: !targetedEnabled,
                      stickerTargetedGroups: draftGroups,
                      stickerTargetedEntries: draftTargeted,
                      stickerBannedRefs: draftBannedRefs,
                    })
                  }}
                />
              </div>
              {targetedEnabled ? (
                <p className="mt-3 text-[12px] text-[#576b95]">
                  已勾选 <ChatSettingsNum>{draftGroups.length}</ChatSettingsNum> 个分组 · 永久禁止{' '}
                  <ChatSettingsNum>{draftBannedRefs.length}</ChatSettingsNum> 条
                </p>
              ) : draftBannedRefs.length ? (
                <p className="mt-3 text-[12px] text-[#576b95]">
                  未开定向时，仍生效永久禁止 <ChatSettingsNum>{draftBannedRefs.length}</ChatSettingsNum> 条
                </p>
              ) : null}
            </div>

            <div className="rounded-[12px] bg-white px-4 py-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2 rounded-[10px] border border-[#e5e5e5] bg-[#f7f7f7] px-3">
                <Search className="size-4 shrink-0 text-[#8e8e8e]" aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索引用名 / 分组 / 描述"
                  className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-black outline-none"
                />
              </div>
            </div>

            {catalogLoading ? (
              <p className="px-1 text-[13px] text-[#8e8e8e]">正在加载表情包目录…</p>
            ) : groupedCatalog.size === 0 ? (
              <p className="px-1 text-[13px] text-[#8e8e8e]">没有匹配的表情包。</p>
            ) : (
              [...groupedCatalog.entries()].map(([groupName, entries]) => {
                const groupEnabled = enabledGifGroupSet.has(groupName)
                const expanded = expandedGifGroups.has(groupName)
                const allowedCount = entries.filter((e) => groupEnabled && !bannedGifSet.has(e.ref)).length
                const groupRefs = entries.map((e) => e.ref)
                const groupPercent = resolveStickerGroupTargetedPercent(groupRefs, bannedGifSet, draftTargeted)
                return (
                  <div
                    key={groupName}
                    className="overflow-hidden rounded-[12px] bg-white"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  >
                    <CollapsibleGroupHeader
                      title={groupName}
                      subtitle={renderGroupCountSubtitle(entries.length, allowedCount)}
                      checked={groupEnabled}
                      onToggleCheck={() => toggleGifGroup(groupName, !groupEnabled, groupRefs)}
                      expanded={expanded}
                      onToggleExpand={() => {
                        setExpandedGifGroups((prev) => {
                          const next = new Set(prev)
                          if (next.has(groupName)) next.delete(groupName)
                          else next.add(groupName)
                          return next
                        })
                      }}
                      groupPercentControl={
                        groupEnabled && allowedCount > 0
                          ? {
                              percent: groupPercent.percent,
                              mixed: groupPercent.mixed,
                              onChange: (percent) => setGifGroupPercent(groupRefs, percent),
                            }
                          : undefined
                      }
                    />
                    {expanded ? (
                      <div className="px-3 pb-2">
                        {entries.map((entry, idx) => {
                          const banned = bannedGifSet.has(entry.ref)
                          const allowed = groupEnabled && !banned
                          const percent = draftTargeted[entry.ref] ?? STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT
                          return (
                            <div
                              key={entry.ref}
                              className={`py-3 ${idx < entries.length - 1 ? 'border-b border-[#f2f2f7]' : ''} ${!groupEnabled ? 'opacity-55' : ''}`}
                            >
                              <div className="flex items-start gap-3">
                                {entry.url ? (
                                  <img src={entry.url} alt="" className="size-10 shrink-0 rounded-[8px] object-cover" />
                                ) : null}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[14px] text-black">{entry.description}</p>
                                  <p className="truncate text-[11px] text-[#8e8e8e]">[表情包]{entry.ref}</p>
                                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-[#666]">
                                    <input
                                      type="checkbox"
                                      checked={!banned}
                                      disabled={!groupEnabled}
                                      onChange={(e) => toggleGifBanned(entry.ref, !e.target.checked)}
                                      className="size-4 accent-black disabled:opacity-40"
                                    />
                                    允许发送
                                  </label>
                                  {allowed ? (
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between text-[12px] text-[#666]">
                                        <span>选用概率</span>
                                        <ChatSettingsNum>{percent}%</ChatSettingsNum>
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={percent}
                                        onChange={(e) => setGifPercent(entry.ref, Number(e.target.value))}
                                        className="mt-1 w-full accent-black"
                                      />
                                    </div>
                                  ) : banned && groupEnabled ? (
                                    <p className="mt-1 text-[11px] text-[#fa5151]">已永久禁止发送</p>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}

            <button
              type="button"
              className="w-full rounded-[12px] bg-white py-3 text-[13px] text-[#576b95]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              onClick={() => {
                setDraftGroups([])
                setDraftBannedRefs([])
                setDraftTargeted({})
                void onPatch({ clearStickerTargetedConfig: true })
              }}
            >
              清空定向配置
            </button>
          </div>
        ) : null}

        {activeTab === 'classic' ? (
          <div className="space-y-3">
            <div className="rounded-[12px] bg-white px-4 py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <p className="text-[16px] font-medium text-black">微信经典黄脸概率</p>
              <p className="mt-2 text-[12px] leading-relaxed text-[#8e8e8e]">
                控制是否在文字行内写经典黄脸 token；下方可按分类勾选，并永久禁止部分黄脸。
              </p>
              <RoundTriggerPercentControl
                kind="classicEmoji"
                stored={classicStored}
                onChange={(percent) => void onPatch({ classicEmojiRoundTriggerPercent: percent })}
                onResetDefault={() => void onPatch({ clearClassicEmojiRoundTriggerPercent: true })}
              />
            </div>

            {classicGroups.map((group) => {
              const expanded = expandedClassicGroups.has(group.categoryId)
              const names = group.items.map((it) => it.description)
              const groupEnabled = names.some((n) => !bannedClassicSet.has(n))
              const allowedCount = names.filter((n) => !bannedClassicSet.has(n)).length
              return (
                <div
                  key={group.categoryId}
                  className="overflow-hidden rounded-[12px] bg-white"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                >
                  <CollapsibleGroupHeader
                    title={group.label}
                    subtitle={renderGroupCountSubtitle(group.items.length, allowedCount)}
                    checked={groupEnabled}
                    onToggleCheck={() => toggleClassicGroup(group.categoryId, !groupEnabled)}
                    expanded={expanded}
                    onToggleExpand={() => {
                      setExpandedClassicGroups((prev) => {
                        const next = new Set(prev)
                        if (next.has(group.categoryId)) next.delete(group.categoryId)
                        else next.add(group.categoryId)
                        return next
                      })
                    }}
                  />
                  {expanded ? (
                    <div className="grid grid-cols-8 gap-1 px-2 pb-3 pt-1">
                      {group.items.map((item) => {
                        const banned = bannedClassicSet.has(item.description)
                        return (
                          <label
                            key={item.id}
                            className={`flex flex-col items-center gap-0.5 rounded-[8px] border p-1 ${
                              banned ? 'border-[#fecaca] bg-[#fff5f5]' : 'border-[#f0f0f0] bg-[#fafafa]'
                            } ${!groupEnabled ? 'opacity-55' : ''}`}
                            title={item.description}
                          >
                            <img src={item.url} alt="" className="size-7 object-contain" />
                            <span className="line-clamp-1 w-full text-center text-[8px] leading-tight text-[#666]">
                              {item.description}
                            </span>
                            <input
                              type="checkbox"
                              checked={!banned}
                              disabled={!groupEnabled}
                              onChange={(e) => toggleClassicBanned(item.description, !e.target.checked)}
                              aria-label={`${item.description} 允许发送`}
                              className="size-3 accent-black disabled:opacity-40"
                            />
                          </label>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}

            {draftClassicBanned.length ? (
              <button
                type="button"
                className="w-full rounded-[12px] bg-white py-3 text-[13px] text-[#576b95]"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                onClick={() => {
                  setDraftClassicBanned([])
                  void onPatch({ clearClassicEmojiBannedNames: true })
                }}
              >
                清空黄脸禁止列表
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
