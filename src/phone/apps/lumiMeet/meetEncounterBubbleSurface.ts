import type { CSSProperties } from 'react'

import { MEET_ENCOUNTER_BUBBLE_THEME } from './constants'

type BubblePalette = {
  highlight: string
  mid: string
  depth: string
  border: string
}

const SELF_BUBBLE: BubblePalette = {
  highlight: '#FFF8E8',
  mid: MEET_ENCOUNTER_BUBBLE_THEME.selfBubbleBg,
  depth: '#E5D4A8',
  border: 'rgba(212, 175, 55, 0.35)',
}

const OTHER_BUBBLE: BubblePalette = {
  highlight: '#FFFCF6',
  mid: MEET_ENCOUNTER_BUBBLE_THEME.otherBubbleBg,
  depth: '#EDE3CF',
  border: 'rgba(200, 170, 100, 0.28)',
}

function buildBubbleSurface(p: BubblePalette): CSSProperties {
  return {
    background: `linear-gradient(152deg, ${p.highlight} 0%, ${p.mid} 42%, ${p.depth} 100%)`,
    border: `1px solid ${p.border}`,
    boxShadow: 'none',
  }
}

/** 遇见临时会话 · 浅金气泡（渐变 + 描边，无阴影） */
export function meetEncounterBubbleSurfaceStyle(isSelf: boolean): CSSProperties {
  return buildBubbleSurface(isSelf ? SELF_BUBBLE : OTHER_BUBBLE)
}

/** 气泡内引用条 */
export function meetEncounterQuoteInsetStyle(isSelf: boolean): CSSProperties {
  return {
    background: isSelf ? 'rgba(255, 255, 255, 0.38)' : 'rgba(255, 255, 255, 0.45)',
    boxShadow: 'none',
  }
}
