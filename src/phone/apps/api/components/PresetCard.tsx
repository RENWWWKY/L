import { Edit, Trash2 } from 'lucide-react'
import { apiTheme } from '../theme'

export function PresetCard({
  name,
  description,
  active,
  onClick,
  onEdit,
  onDelete,
}: {
  name: string
  description?: string
  active?: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="mx-4 mt-3 rounded-2xl bg-white p-4 transition-all duration-200 ease-out"
      style={{ boxShadow: apiTheme.shadow }}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium" style={{ color: apiTheme.text }}>
            {name || '未命名预设'}
          </p>
          {description ? (
            <p className="mt-1 line-clamp-1 text-[14px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
              {description}
            </p>
          ) : null}
        </div>
        {active ? (
          <span
            className="shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-medium text-white"
            style={{ background: apiTheme.accent }}
          >
            使用中
          </span>
        ) : null}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-lg p-2 transition-all duration-200 ease-out hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            style={{ color: apiTheme.subText }}
            aria-label="编辑预设"
          >
            <Edit className="size-[18px]" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 transition-all duration-200 ease-out hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            style={{ color: apiTheme.subText }}
            aria-label="删除预设"
          >
            <Trash2 className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  )
}

