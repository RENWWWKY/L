import { Link2, Plus, Search } from 'lucide-react'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { MemoryArchiveAccountOption } from './memoryArchiveAccountScope'
import { MemoryArchiveAccountPicker } from './MemoryArchiveAccountPicker'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import { MemoryTutorialButton } from './MemoryTutorialButton'

/** 角色列表页顶栏（详情页使用 {@link MemoryCharacterDetailView}） */
export function MemoryArchiveHeader({
  search,
  onSearchChange,
  accountOptions,
  selectedAccountId,
  onAccountChange,
  onCreate,
  alignUserBusy,
  alignUserDisabled,
  alignUserTitle,
  onAlignUser,
  alignUserToast,
  onOpenTutorial,
  rosterSummary,
}: {
  search: string
  onSearchChange: (v: string) => void
  accountOptions: MemoryArchiveAccountOption[]
  selectedAccountId: string
  onAccountChange: (accountId: string) => void
  onCreate: () => void
  alignUserBusy?: boolean
  alignUserDisabled?: boolean
  alignUserTitle?: string
  onAlignUser?: () => void
  alignUserToast?: string | null
  onOpenTutorial?: () => void
  rosterSummary?: { characterCount: number; memoryCount: number }
}) {
  const hasStats = rosterSummary && rosterSummary.characterCount > 0

  return (
    <header className="z-10 shrink-0">
      <div className="px-4 pt-3 pb-2" style={{ background: ARCHIVE_BG }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold tracking-tight text-gray-900">角色记忆</h1>
            <p className="mt-0.5 text-[12px] text-gray-400">
              {hasStats ? (
                <ListenNumericText
                  text={`${rosterSummary.characterCount} 位角色 · ${rosterSummary.memoryCount} 条记忆`}
                />
              ) : (
                '选择账号后浏览各角色长期记忆'
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onOpenTutorial ? (
              <MemoryTutorialButton onClick={onOpenTutorial} coachTarget="archive-tutorial" />
            ) : null}
            <button
              type="button"
              data-memory-coach="create"
              onClick={onCreate}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white shadow-[0_6px_20px_rgba(0,0,0,0.12)] transition-opacity active:opacity-90"
              aria-label="新建记忆"
            >
              <Plus className="size-[18px]" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div
        className="sticky top-0 z-20 px-4 pb-3"
        style={{ background: ARCHIVE_BG }}
      >
        <div className="rounded-[24px] bg-white p-4 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <MemoryArchiveAccountPicker
            accounts={accountOptions}
            selectedAccountId={selectedAccountId}
            onSelect={onAccountChange}
            variant="roster"
          />

          <div
            data-memory-coach="search"
            className="mt-3 flex items-center gap-2.5 rounded-2xl bg-gray-50/90 px-3.5 py-2.5"
          >
            <Search className="size-4 shrink-0 text-gray-400" strokeWidth={1.5} />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索角色名或场景…"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-gray-900 outline-none placeholder:text-gray-400"
              spellCheck={false}
            />
          </div>

          {onAlignUser ? (
            <button
              type="button"
              data-memory-coach="align"
              disabled={alignUserBusy || alignUserDisabled}
              onClick={onAlignUser}
              title={alignUserTitle}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-200 py-2.5 text-[12px] font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Link2 className="size-3.5" strokeWidth={1.5} />
              {alignUserBusy ? '对齐中…' : '对齐 {{user}} 占位符'}
            </button>
          ) : null}
        </div>

        {alignUserToast ? (
          <p className="mt-2 rounded-2xl bg-white/95 px-4 py-3 text-[11px] leading-relaxed text-gray-500 shadow-sm">
            {alignUserToast}
          </p>
        ) : null}

        <p data-memory-coach="roster" className="sr-only">
          {hasStats
            ? `共 ${rosterSummary.characterCount} 位角色，${rosterSummary.memoryCount} 条记忆`
            : '当前账号下有记忆的角色列表'}
        </p>
      </div>
    </header>
  )
}
