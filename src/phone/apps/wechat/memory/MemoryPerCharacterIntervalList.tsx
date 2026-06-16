import { useMemo } from 'react'
import { listenPlainNumStyle } from '../../../../components/discoverListen/listenTogetherTypography'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { Character } from '../newFriendsPersona/types'

export type MemoryPerCharacterIntervalRow = {
  charId: string
  displayName: string
  avatarUrl?: string
  intervalDraft: string
}

function resolveCharacterDisplayName(ch: Character): string {
  return ch.name?.trim() || ch.wechatNickname?.trim() || ch.id.slice(0, 8)
}

export function buildMemoryPerCharacterIntervalRows(
  characters: Character[],
  intervalByCharId: Record<string, number | undefined>,
  globalInterval: number,
  draftOverrides?: Record<string, string>,
): MemoryPerCharacterIntervalRow[] {
  return characters
    .filter((ch) => ch.id?.trim())
    .map((ch) => {
      const charId = ch.id.trim()
      const saved = intervalByCharId[charId]
      const fallback = typeof saved === 'number' ? String(saved) : String(globalInterval)
      return {
        charId,
        displayName: resolveCharacterDisplayName(ch),
        avatarUrl: ch.avatarUrl,
        intervalDraft: draftOverrides?.[charId] ?? fallback,
      }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN'))
}

export function MemoryPerCharacterIntervalList({
  rows,
  disabled,
  onIntervalDraftChange,
  onIntervalCommit,
}: {
  rows: MemoryPerCharacterIntervalRow[]
  disabled?: boolean
  onIntervalDraftChange: (charId: string, draft: string) => void
  onIntervalCommit: (charId: string, draft: string) => void
}) {
  const countLabel = useMemo(() => `共 ${rows.length} 位角色`, [rows.length])

  if (!rows.length) {
    return <p className="text-[12px] text-gray-400">暂无人设角色；创建角色后可在此单独设定总结间隔。</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-400">
        <ListenNumericText text={countLabel} />
        <span className="ml-1">· 未单独改动的角色沿用全局默认值</span>
      </p>
      <ul className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto overscroll-y-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
        {rows.map((row) => (
          <li
            key={row.charId}
            className="flex items-center gap-3 rounded-[18px] bg-gray-50/90 px-3 py-2.5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-gray-100">
              {row.avatarUrl ? (
                <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px] font-medium text-gray-400">{row.displayName.slice(0, 2)}</span>
              )}
            </div>
            <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-gray-900">{row.displayName}</p>
            <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-gray-500">
              <span>间隔</span>
              <div className="rounded-xl bg-white px-2 py-1 ring-1 ring-gray-100">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={row.intervalDraft}
                  disabled={disabled}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 3)
                    onIntervalDraftChange(row.charId, digits)
                  }}
                  onBlur={() => onIntervalCommit(row.charId, row.intervalDraft)}
                  className="w-8 border-0 bg-transparent text-center text-[14px] font-medium text-gray-900 outline-none disabled:opacity-40"
                  style={listenPlainNumStyle}
                  aria-label={`${row.displayName} 自动总结间隔轮数`}
                />
              </div>
              <span>轮</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
