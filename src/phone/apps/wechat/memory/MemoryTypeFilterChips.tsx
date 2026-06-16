import { MEMORY_TYPE_FILTER_OPTIONS, type MemoryTypeFilterId } from './memoryArchiveTypes'
import { MEMORY_TYPE_FILTER_CHIP_CLASS, memoryTypeFilterLabel } from './memorySceneChipStyles'

export function MemoryTypeFilterChips({
  value,
  onChange,
  available,
  wrap = false,
}: {
  value: ReadonlySet<MemoryTypeFilterId>
  onChange: (next: ReadonlySet<MemoryTypeFilterId>) => void
  /** 该角色实际出现过的类型；为空则展示全部选项 */
  available?: ReadonlySet<MemoryTypeFilterId>
  /** 详情页用换行布局，避免窄屏横向挤压 */
  wrap?: boolean
}) {
  const options = MEMORY_TYPE_FILTER_OPTIONS.filter((opt) => !available || available.has(opt.id))

  const toggle = (id: MemoryTypeFilterId) => {
    const next = new Set(value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <div
      data-memory-coach="type-filter"
      className={
        wrap
          ? 'flex flex-wrap gap-2'
          : 'flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      }
      aria-label="记忆分类筛选"
    >
      <button
        type="button"
        onClick={() => onChange(new Set())}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] transition-colors ${
          value.size === 0
            ? 'bg-gray-900 font-semibold text-white'
            : 'bg-white font-normal text-gray-500 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
        }`}
      >
        全部
      </button>
      {options.map((opt) => {
        const active = value.has(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(opt.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] transition-colors ${
              active
                ? `font-semibold shadow-sm ${MEMORY_TYPE_FILTER_CHIP_CLASS[opt.id]}`
                : 'bg-gray-100/80 font-normal text-gray-500'
            }`}
          >
            <span>{memoryTypeFilterLabel(opt.id)}</span>
          </button>
        )
      })}
    </div>
  )
}
