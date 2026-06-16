import { Link2, MoreHorizontal, Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { MemoryArchiveAccountOption } from './memoryArchiveAccountScope'
import { MemoryArchiveAccountPicker } from './MemoryArchiveAccountPicker'
import type { MemoryCharacterRosterItem, MemoryTypeFilterId } from './memoryArchiveTypes'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import { MemoryTypeFilterChips } from './MemoryTypeFilterChips'
import { MEMORY_SCENE_CHIP_CLASS, memorySceneFilterLabel } from './memorySceneChipStyles'

export function MemoryCharacterDetailView({
  character,
  rosterIndex,
  rosterTotal: _rosterTotal,
  search,
  onSearchChange,
  accountOptions,
  selectedAccountId,
  onAccountChange,
  typeFilters,
  onTypeFiltersChange,
  availableTypeFilters,
  filteredCount,
  totalCount,
  onCreate,
  onOpenTutorial,
  onAlignUser,
  alignUserBusy,
  alignUserDisabled,
  alignUserTitle,
  alignUserToast,
  children,
}: {
  character: MemoryCharacterRosterItem
  rosterIndex: number
  rosterTotal: number
  search: string
  onSearchChange: (v: string) => void
  accountOptions: MemoryArchiveAccountOption[]
  selectedAccountId: string
  onAccountChange: (accountId: string) => void
  typeFilters: ReadonlySet<MemoryTypeFilterId>
  onTypeFiltersChange: (next: ReadonlySet<MemoryTypeFilterId>) => void
  availableTypeFilters?: ReadonlySet<MemoryTypeFilterId>
  filteredCount: number
  totalCount: number
  onCreate: () => void
  onOpenTutorial?: () => void
  onAlignUser?: () => void
  alignUserBusy?: boolean
  alignUserDisabled?: boolean
  alignUserTitle?: string
  alignUserToast?: string | null
  children: ReactNode
}) {
  const [toolsOpen, setToolsOpen] = useState(false)
  const toolsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!toolsOpen) return
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const t = e.target
      if (!(t instanceof Node) || toolsRef.current?.contains(t)) return
      setToolsOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [toolsOpen])

  return (
    <div className="pb-6">
      <div className="px-4 pt-2" style={{ background: ARCHIVE_BG }}>
        {alignUserToast ? (
          <p className="mb-3 rounded-2xl bg-white/95 px-4 py-3 text-[11px] leading-relaxed text-gray-500 shadow-sm">
            {alignUserToast}
          </p>
        ) : null}

        <div className="relative overflow-hidden rounded-[28px] bg-white px-4 py-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-gray-100/80 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-4 ring-gray-50">
                {character.avatarUrl ? (
                  <img src={character.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[13px] font-semibold text-gray-400">
                    {character.displayName.slice(0, 2)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400">
                  <ListenNumericText
                    text={
                      (rosterIndex >= 0
                        ? `共 ${totalCount} 条记忆`
                        : `当前来源 · 共 ${totalCount} 条`) +
                      (filteredCount !== totalCount ? ` · 已筛 ${filteredCount} 条` : '')
                    }
                  />
                </p>
                {character.sceneTags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {character.sceneTags.map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${MEMORY_SCENE_CHIP_CLASS[tag]}`}
                      >
                        {memorySceneFilterLabel(tag)}
                      </span>
                    ))}
                  </div>
                ) : totalCount === 0 ? (
                  <p className="mt-2 text-[11px] text-gray-400">当前账号下暂无记忆</p>
                ) : null}
              </div>
            </div>
            <div className="relative shrink-0" ref={toolsRef}>
              <button
                type="button"
                onClick={() => setToolsOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-600"
                aria-label="更多操作"
                aria-expanded={toolsOpen}
              >
                <MoreHorizontal className="size-[18px]" strokeWidth={1.5} />
              </button>
              {toolsOpen ? (
                <div className="absolute right-0 top-full z-30 mt-2 min-w-[148px] overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_40px_rgba(0,0,0,0.1)]">
                  {onOpenTutorial ? (
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left text-[13px] text-gray-800 hover:bg-gray-50"
                      onClick={() => {
                        setToolsOpen(false)
                        onOpenTutorial()
                      }}
                    >
                      教程说明
                    </button>
                  ) : null}
                  {onAlignUser ? (
                    <button
                      type="button"
                      data-memory-coach="align"
                      disabled={alignUserBusy || alignUserDisabled}
                      title={alignUserTitle}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] text-gray-800 hover:bg-gray-50 disabled:opacity-45"
                      onClick={() => {
                        setToolsOpen(false)
                        onAlignUser()
                      }}
                    >
                      <Link2 className="size-3.5" strokeWidth={1.5} />
                      {alignUserBusy ? '对齐中…' : '对齐 {{user}}'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            data-memory-coach="create"
            onClick={onCreate}
            className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3 text-[14px] font-semibold text-white active:opacity-90"
          >
            <Plus className="size-4" strokeWidth={2} />
            刻录记忆
          </button>
        </div>

        <div
          className="sticky top-0 z-20 mt-4 space-y-3 rounded-[24px] bg-white/95 px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-sm"
          style={{ background: 'rgba(255,255,255,0.92)' }}
        >
          <div data-memory-coach="search" className="flex items-center gap-2.5 rounded-2xl bg-gray-50 px-3.5 py-2.5">
            <Search className="size-4 shrink-0 text-gray-400" strokeWidth={1.25} />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索该角色记忆正文、触发词…"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-gray-900 outline-none placeholder:text-gray-400"
              spellCheck={false}
            />
          </div>

          <MemoryArchiveAccountPicker
            accounts={accountOptions}
            selectedAccountId={selectedAccountId}
            onSelect={onAccountChange}
            compact
          />

          <div>
            <p className="mb-1 text-[10px] font-medium tracking-[0.12em] text-gray-400">记忆分类</p>
            <p className="mb-2 text-[11px] leading-relaxed text-gray-500">可多选：私聊、群聊、关联记忆等</p>
            <MemoryTypeFilterChips
              value={typeFilters}
              onChange={onTypeFiltersChange}
              available={availableTypeFilters}
              wrap
            />
          </div>
        </div>
      </div>

      <div className="mt-2">{children}</div>
    </div>
  )
}
