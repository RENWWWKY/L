import type { MemorySceneTag, MemoryTypeFilterId } from './memoryArchiveTypes'

export const MEMORY_SCENE_CHIP_CLASS: Record<MemorySceneTag, string> = {
  私聊: 'bg-[#07c160]/12 text-[#047857] ring-1 ring-[#07c160]/20',
  群聊: 'bg-[#c2410c]/12 text-[#9a3412] ring-1 ring-[#c2410c]/20',
  线下: 'bg-[#6366f1]/12 text-[#4338ca] ring-1 ring-[#6366f1]/20',
  关联线下: 'bg-[#0d9488]/12 text-[#0f766e] ring-1 ring-[#0d9488]/20',
  遇见: 'bg-gray-900/10 text-gray-800 ring-1 ring-gray-900/10',
  朋友圈: 'bg-gray-600/10 text-gray-700 ring-1 ring-gray-600/15',
}

export function memorySceneFilterLabel(tag: MemorySceneTag): string {
  if (tag === '遇见') return '遇见应用'
  return tag
}

export const MEMORY_TYPE_FILTER_CHIP_CLASS: Record<MemoryTypeFilterId, string> = {
  ...MEMORY_SCENE_CHIP_CLASS,
  linked: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200',
}

export function memoryTypeFilterLabel(id: MemoryTypeFilterId): string {
  if (id === 'linked') return '关联记忆'
  return memorySceneFilterLabel(id)
}
