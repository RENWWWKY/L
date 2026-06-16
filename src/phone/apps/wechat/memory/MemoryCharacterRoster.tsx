import { motion } from 'framer-motion'
import { ChevronRight, Users } from 'lucide-react'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { MemoryCharacterRosterItem, MemorySceneTag } from './memoryArchiveTypes'
import { MEMORY_SCENE_CHIP_CLASS, memorySceneFilterLabel } from './memorySceneChipStyles'

const ROSTER_TAG_PRIORITY: MemorySceneTag[] = ['私聊', '群聊', '朋友圈', '遇见', '线下', '关联线下']

function pickRosterSceneTags(tags: MemorySceneTag[], max = 2): MemorySceneTag[] {
  const set = new Set(tags)
  const ordered = ROSTER_TAG_PRIORITY.filter((t) => set.has(t))
  if (ordered.length >= max) return ordered.slice(0, max)
  for (const t of tags) {
    if (!ordered.includes(t) && ordered.length < max) ordered.push(t)
  }
  return ordered
}

export function MemoryCharacterRoster({
  items,
  loading,
  searchQuery,
  onSelect,
}: {
  items: MemoryCharacterRosterItem[]
  loading: boolean
  searchQuery: string
  onSelect: (charId: string) => void
}) {
  if (loading) {
    return (
      <div className="flex min-h-[36vh] flex-col items-center justify-center gap-3 px-5 py-16">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200/80" />
        <p className="text-[12px] text-gray-400">加载角色列表…</p>
      </div>
    )
  }

  if (!items.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-sm px-6 py-20 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
          <Users className="size-6 text-gray-300" strokeWidth={1.25} />
        </div>
        <p className="text-[15px] font-semibold text-gray-800">
          {searchQuery.trim() ? '无匹配角色' : '暂无角色记忆'}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-400">
          {searchQuery.trim()
            ? '试试换个检索词，或切换上方查看账号。'
            : '自动总结或手动刻录后，会按角色出现在这里。'}
        </p>
      </motion.div>
    )
  }

  return (
    <ul className="mx-auto flex w-full max-w-lg flex-col gap-2.5 px-4 pb-6 pt-1">
      {items.map((item, i) => {
        const isGroup = item.charId.startsWith('__group__')
        const displayTags = pickRosterSceneTags(item.sceneTags)
        const extraTagCount = Math.max(0, item.sceneTags.length - displayTags.length)

        return (
          <motion.li
            key={item.charId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.18), duration: 0.24 }}
          >
            <button
              type="button"
              data-memory-coach={i === 0 ? 'roster' : undefined}
              onClick={() => onSelect(item.charId)}
              className="group flex w-full items-center gap-3.5 rounded-[22px] bg-white px-4 py-3.5 text-left shadow-[0_6px_24px_rgba(0,0,0,0.035)] transition-[transform,box-shadow] active:scale-[0.995] active:shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
            >
              <div className="relative shrink-0">
                <div className="flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-[3px] ring-gray-50">
                  {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : isGroup ? (
                    <Users className="size-5 text-gray-400" strokeWidth={1.5} aria-hidden />
                  ) : (
                    <span className="text-[12px] font-semibold text-gray-400">{item.displayName.slice(0, 2)}</span>
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                  <ListenNumericText text={String(item.memoryCount)} />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-[16px] font-semibold leading-tight text-gray-900">{item.displayName}</p>
                </div>
                {item.wechatRemarkName ? (
                  <p className="mt-0.5 truncate text-[12px] text-gray-400">备注 {item.wechatRemarkName}</p>
                ) : (
                  <p className="mt-0.5 text-[12px] text-gray-400">
                    <ListenNumericText text={`共 ${item.memoryCount} 条记忆`} />
                  </p>
                )}
                {displayTags.length ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {displayTags.map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${MEMORY_SCENE_CHIP_CLASS[tag]}`}
                      >
                        {memorySceneFilterLabel(tag)}
                      </span>
                    ))}
                    {extraTagCount > 0 ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        +{extraTagCount}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <ChevronRight
                className="size-4 shrink-0 text-gray-300 transition-transform group-active:translate-x-0.5"
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
          </motion.li>
        )
      })}
    </ul>
  )
}
