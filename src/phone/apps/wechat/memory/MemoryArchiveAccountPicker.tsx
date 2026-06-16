import type { MemoryArchiveAccountOption } from './memoryArchiveAccountScope'

export function MemoryArchiveAccountPicker({
  accounts,
  selectedAccountId,
  onSelect,
  compact = false,
  variant = 'default',
}: {
  accounts: MemoryArchiveAccountOption[]
  selectedAccountId: string
  onSelect: (accountId: string) => void
  /** 详情页顶栏内嵌时用更紧凑布局 */
  compact?: boolean
  /** 预览页：横向胶囊条，嵌入白色控制面板 */
  variant?: 'default' | 'roster'
}) {
  if (!accounts.length) {
    return (
      <p className="text-[12px] text-gray-400" data-memory-coach="source">
        暂无已登录微信账号
      </p>
    )
  }

  const rosterStyle = variant === 'roster' && !compact

  if (accounts.length === 1) {
    const only = accounts[0]!
    return (
      <div
        data-memory-coach="source"
        className={
          rosterStyle
            ? 'flex items-center gap-3 rounded-2xl bg-gray-50/90 px-3 py-2.5'
            : 'flex items-center gap-2.5 rounded-2xl bg-gray-50 px-3.5 py-2.5'
        }
      >
        {only.avatarUrl ? (
          <img src={only.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-gray-500 ring-2 ring-white">
            {only.label.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">查看账号</p>
          <p className="truncate text-[14px] font-semibold text-gray-900">{only.label}</p>
        </div>
      </div>
    )
  }

  if (rosterStyle) {
    return (
      <div data-memory-coach="source">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">查看账号</p>
        <nav
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="选择查看账号"
        >
          {accounts.map((acc) => {
            const active = acc.accountId === selectedAccountId
            return (
              <button
                key={acc.accountId}
                type="button"
                onClick={() => onSelect(acc.accountId)}
                className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-3 py-2 transition-colors ${
                  active
                    ? 'border-gray-900 bg-white text-gray-900'
                    : 'border-transparent bg-gray-100/90 text-gray-600 hover:border-gray-200 hover:bg-gray-100'
                }`}
              >
                {acc.avatarUrl ? (
                  <img
                    src={acc.avatarUrl}
                    alt=""
                    className={`h-6 w-6 rounded-full object-cover ${active ? 'ring-2 ring-gray-900/15' : ''}`}
                  />
                ) : (
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                      active ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-500'
                    }`}
                  >
                    {acc.label.slice(0, 1)}
                  </span>
                )}
                <span className={`max-w-[120px] truncate text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>
                  {acc.label}
                </span>
              </button>
            )
          })}
        </nav>
      </div>
    )
  }

  return (
    <div data-memory-coach="source">
      <p className={`font-medium tracking-[0.12em] text-gray-400 ${compact ? 'mb-1.5 text-[10px]' : 'mb-2 text-[11px]'}`}>
        选择查看账号
      </p>
      <nav
        className={compact ? 'flex flex-col gap-1.5' : 'flex flex-wrap justify-center gap-2'}
        aria-label="选择查看账号"
      >
        {accounts.map((acc) => {
          const active = acc.accountId === selectedAccountId
          return (
            <button
              key={acc.accountId}
              type="button"
              onClick={() => onSelect(acc.accountId)}
              className={`flex min-w-0 items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-gray-900 bg-white text-gray-900'
                  : 'border-transparent bg-gray-100/80 text-gray-700 hover:border-gray-200 hover:bg-gray-100'
              } ${compact ? 'w-full' : 'max-w-[min(100%,220px)]'}`}
            >
              {acc.avatarUrl ? (
                <img src={acc.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    active ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-500'
                  }`}
                >
                  {acc.label.slice(0, 1)}
                </span>
              )}
              <span className={`min-w-0 truncate text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>
                {acc.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
