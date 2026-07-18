import { Link2, Plus, Search } from 'lucide-react'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { MemoryArchiveAccountOption } from './memoryArchiveAccountScope'
import { MemoryArchiveAccountPicker } from './MemoryArchiveAccountPicker'
import {
  ARCHIVE_SOURCE_OFFLINE_LABEL,
  ARCHIVE_SOURCE_ONLINE_LABEL,
} from './memoryArchiveSourceLabels'
import {
  ARCHIVE_BG,
  ARCHIVE_SOFT_BTN_SECONDARY,
  ARCHIVE_SOFT_CHIP,
  ARCHIVE_SOFT_SECTION,
} from './memoryArchiveTheme'
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
  rosterSummary?: { characterCount: number; memoryCount: number; onlineCount: number; offlineCount: number }
}) {
  const hasStats = rosterSummary && rosterSummary.characterCount > 0

  return (
    <div className="sticky top-0 z-20 px-4 pb-2 pt-2" style={{ background: ARCHIVE_BG }}>
      <div className={ARCHIVE_SOFT_SECTION}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-gray-900">角色总结</h2>
              {hasStats ? (
                <span className={ARCHIVE_SOFT_CHIP}>
                  <ListenNumericText
                    text={`${rosterSummary.characterCount} 角色 · 线上 ${rosterSummary.onlineCount} · 线下 ${rosterSummary.offlineCount}`}
                  />
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
              同一角色下，{ARCHIVE_SOURCE_ONLINE_LABEL}（微信聊天收成的大段文字）与 {ARCHIVE_SOURCE_OFFLINE_LABEL}
              （约会每轮的小摘要）在这里一起看；切换上方账号后，列表会跟着变。
            </p>
          </div>
          <button
            type="button"
            data-memory-coach="create"
            onClick={onCreate}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white shadow-[0_6px_20px_rgba(0,0,0,0.1)] transition-opacity active:opacity-90"
            aria-label="新建记忆"
          >
            <Plus className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <MemoryArchiveAccountPicker
            accounts={accountOptions}
            selectedAccountId={selectedAccountId}
            onSelect={onAccountChange}
            variant="roster"
          />
        </div>

        <div data-memory-coach="search" className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-300"
            strokeWidth={1.75}
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索角色名或场景…"
            className="w-full rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-3 text-[14px] text-gray-900 outline-none ring-1 ring-gray-100 placeholder:text-gray-400 focus:bg-white focus:ring-gray-200"
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
            className={`mt-3 flex w-full items-center justify-center gap-1.5 ${ARCHIVE_SOFT_BTN_SECONDARY} py-2 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <Link2 className="size-3.5" strokeWidth={1.5} />
            {alignUserBusy ? '对齐中…' : '对齐 {{user}} 占位符'}
          </button>
        ) : null}
      </div>

      {alignUserToast ? (
        <p className="mt-2 rounded-2xl border border-gray-200/60 bg-white px-4 py-3 text-[11px] leading-relaxed text-gray-500 shadow-sm">
          {alignUserToast}
        </p>
      ) : null}
    </div>
  )
}
