import type { MemoryEditorIdentityOption } from './memoryEditorCharacterIdentityOptions'

const ROLE_HINT: Record<MemoryEditorIdentityOption['role'], string> = {
  session: '当前登录',
  primary: '档案主绑定',
  linked: '副绑定马甲',
}

export function MemoryEditorIdentityPicker({
  options,
  selectedKey,
  onSelectKey,
  loading,
  embedded,
}: {
  options: MemoryEditorIdentityOption[]
  selectedKey: string | null
  onSelectKey: (key: string) => void
  loading?: boolean
  /** 嵌入 Tab 面板时不加顶部外边距 */
  embedded?: boolean
}) {
  const wrap = embedded ? '' : 'mt-5 '
  if (loading) {
    return (
      <div className={`${wrap}rounded-2xl bg-gray-50/90 px-4 py-3.5`}>
        <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400">绑定身份</p>
        <p className="mt-2 text-[12px] text-gray-400">加载该角色关联马甲…</p>
      </div>
    )
  }

  if (options.length < 2) return null

  return (
    <div className={`${wrap}rounded-2xl bg-gray-50/90 px-4 py-3.5`}>
      <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400">绑定身份</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
        该角色关联了多个微信账号或扮演身份。选择后，插入 {'{{user}}'} 与新补绑的槽位将绑定到所选马甲（各槽位可在「user 绑定」页逐条修改）。
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((opt) => {
          const active = selectedKey === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelectKey(opt.key)}
              className={`rounded-xl px-3.5 py-2.5 text-left transition-colors ${
                active
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white/80 text-gray-800 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${
                    active ? 'bg-white/15 text-white/90' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {ROLE_HINT[opt.role]}
                </span>
              </div>
              <p className={`mt-1 text-[13px] font-semibold ${active ? 'text-white' : 'text-gray-900'}`}>
                {opt.label}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
