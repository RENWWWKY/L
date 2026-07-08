import type { PhotoLayout } from './memoryAlbumTypes'

/** 2×2 均匀网格槽位（百分比仅作持久化占位，展示由 CSS Grid 控制） */
const GRID_SLOTS: readonly PhotoLayout[] = [
  { x: 25, y: 25, rotate: 0, scale: 1, z: 1 },
  { x: 75, y: 25, rotate: 0, scale: 1, z: 2 },
  { x: 25, y: 75, rotate: 0, scale: 1, z: 3 },
  { x: 75, y: 75, rotate: 0, scale: 1, z: 4 },
] as const

/** 从页内槽位索引推导默认布局 */
export function defaultPhotoLayout(slotIndex: number): PhotoLayout {
  return GRID_SLOTS[slotIndex] ?? GRID_SLOTS[0]!
}

/** 单张相片居中默认位 */
export function centeredPhotoLayout(): PhotoLayout {
  return { x: 50, y: 50, rotate: 0, scale: 1, z: 2 }
}
