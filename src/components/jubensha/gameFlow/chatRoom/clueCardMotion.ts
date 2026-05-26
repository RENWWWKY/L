import type { Transition } from 'framer-motion'

/** 线索牌 Y 轴翻转 · 纸质回弹感 */
export const CLUE_FLIP_SPRING: Transition = {
  type: 'spring',
  stiffness: 88,
  damping: 13,
  mass: 0.92,
}

/** 详情弹层 · 翻牌入场 */
export const CLUE_OPEN_SPRING: Transition = {
  type: 'spring',
  stiffness: 110,
  damping: 16,
  mass: 0.88,
}

export const CLUE_FLIP_PERSPECTIVE = 1100
