export type ScatterSlot = {
  top?: string
  bottom?: string
  left?: string
  right?: string
  rotate: number
  z: number
  width: string
}

/** 四张拍立得的不对称散落位 — 基于页面百分比，确定性布局 */
export const SCATTER_LAYOUT: readonly ScatterSlot[] = [
  { top: '7%', left: '3%', rotate: 0, z: 2, width: '46%' },
  { top: '5%', right: '1%', rotate: 0, z: 4, width: '44%' },
  { bottom: '8%', left: '6%', rotate: 0, z: 1, width: '42%' },
  { bottom: '5%', right: '3%', rotate: 0, z: 3, width: '45%' },
] as const
