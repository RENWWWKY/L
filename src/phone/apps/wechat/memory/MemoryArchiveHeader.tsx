import { motion } from 'framer-motion'
import { Link2, Plus, Search } from 'lucide-react'
import type {
  MemoryArchiveKind,
  MemoryCharacterFocus,
  MemorySourceIdentity,
} from './memoryArchiveTypes'
import { MEMORY_ARCHIVE_KIND_TABS, MEMORY_ARCHIVE_SOURCE_TABS } from './memoryArchiveTypes'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import { MemoryTutorialButton } from './MemoryTutorialButton'

export function MemoryArchiveHeader({
  search,
  onSearchChange,
  source,
  onSourceChange,
  memoryKind,
  onMemoryKindChange,
  characters,
  focusCharId,
  onFocusCharChange,
  onCreate,
  alignUserBusy,
  alignUserDisabled,
  alignUserTitle,
  onAlignUser,
  alignUserToast,
  onOpenTutorial,
}: {
  search: string
  onSearchChange: (v: string) => void
  source: MemorySourceIdentity
  onSourceChange: (s: MemorySourceIdentity) => void
  memoryKind: MemoryArchiveKind
  onMemoryKindChange: (k: MemoryArchiveKind) => void
  characters: MemoryCharacterFocus[]
  focusCharId: string | 'all'
  onFocusCharChange: (id: string | 'all') => void
  onCreate: () => void
  alignUserBusy?: boolean
  alignUserDisabled?: boolean
  alignUserTitle?: string
  onAlignUser?: () => void
  alignUserToast?: string | null
  onOpenTutorial?: () => void
}) {
  return (
    <header className="z-10 shrink-0" style={{ background: ARCHIVE_BG }}>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.38em] text-gray-400">
              Memory Archive
            </p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-gray-900">记忆档案馆</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onOpenTutorial ? (
              <MemoryTutorialButton onClick={onOpenTutorial} coachTarget="archive-tutorial" />
            ) : null}
            {onAlignUser ? (
              <button
                type="button"
                data-memory-coach="align"
                disabled={alignUserBusy || alignUserDisabled}
                onClick={onAlignUser}
                title={alignUserTitle}
                className="flex items-center gap-1 rounded-full bg-gray-100/80 px-3.5 py-2 text-[11px] font-medium text-gray-800 transition-colors hover:bg-gray-200/60 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Link2 className="size-3.5" strokeWidth={1.5} />
                {alignUserBusy ? '对齐中…' : '对齐 {{user}}'}
              </button>
            ) : null}
            <button
              type="button"
              data-memory-coach="create"
              onClick={onCreate}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-gray-900 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
              aria-label="新建记忆"
            >
              <Plus className="size-[18px]" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {alignUserToast ? (
          <p className="mt-4 rounded-2xl bg-white/90 px-4 py-3 text-[11px] leading-relaxed text-gray-500 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            {alignUserToast}
          </p>
        ) : null}

        <div
          data-memory-coach="search"
          className="mt-5 flex items-center gap-3 rounded-full bg-gray-100/70 px-4 py-3"
        >
          <Search className="size-4 shrink-0 text-gray-400" strokeWidth={1.25} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="检索记忆切片…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-gray-900 outline-none placeholder:font-light placeholder:text-gray-400"
            spellCheck={false}
          />
        </div>

        <div className="mt-4 flex justify-center">
          <nav
            data-memory-coach="kind"
            className="inline-flex rounded-full bg-gray-100/80 p-1"
            aria-label="记忆类型"
          >
            {MEMORY_ARCHIVE_KIND_TABS.map((tab) => {
              const active = memoryKind === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onMemoryKindChange(tab.id)}
                  className={`relative px-4 py-2 text-[12px] tracking-wide transition-colors ${
                    active ? 'font-semibold text-gray-900' : 'font-normal text-gray-400'
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="memory-archive-kind-slider"
                      className="absolute inset-0 rounded-full bg-white shadow-sm"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="mt-4 flex justify-center">
          <nav
            data-memory-coach="source"
            className="inline-flex rounded-full bg-gray-100/80 p-1"
            aria-label="身份来源"
          >
            {MEMORY_ARCHIVE_SOURCE_TABS.map((tab) => {
              const active = source === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSourceChange(tab.id)}
                  className={`relative px-5 py-2 text-[13px] tracking-wide transition-colors ${
                    active ? 'font-semibold text-gray-900' : 'font-normal text-gray-400'
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="memory-archive-capsule-slider"
                      className="absolute inset-0 rounded-full bg-white shadow-sm"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <div
        data-memory-coach="focus"
        className="flex gap-4 overflow-x-auto px-5 pb-5 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="角色焦点"
      >
        <CharacterFocusHalo
          label="全部"
          active={focusCharId === 'all'}
          onClick={() => onFocusCharChange('all')}
        />
        {characters.map((c) => (
          <CharacterFocusHalo
            key={c.charId}
            label={c.displayName}
            avatarUrl={c.avatarUrl}
            active={focusCharId === c.charId}
            onClick={() => onFocusCharChange(c.charId)}
          />
        ))}
      </div>
    </header>
  )
}

function CharacterFocusHalo({
  label,
  avatarUrl,
  active,
  onClick,
}: {
  label: string
  avatarUrl?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-2"
      aria-pressed={active}
    >
      <motion.span
        layout
        className="relative flex h-[56px] w-[56px] items-center justify-center overflow-hidden rounded-full bg-white"
        animate={{
          scale: active ? 1.1 : 1,
          boxShadow: active
            ? '0 0 0 4px rgba(243,244,246,0.5), 0 8px 24px rgba(0,0,0,0.06)'
            : '0 4px 12px rgba(0,0,0,0.03)',
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className={`h-full w-full object-cover transition-all duration-300 ${
              active ? 'grayscale-0' : 'grayscale-[0.35]'
            }`}
          />
        ) : (
          <span className="text-[11px] font-medium tracking-widest text-gray-400">
            {label.slice(0, 2)}
          </span>
        )}
      </motion.span>
      <span
        className={`max-w-[72px] truncate text-[10px] ${active ? 'font-semibold text-gray-900' : 'font-normal text-gray-400'}`}
      >
        {label}
      </span>
    </button>
  )
}
