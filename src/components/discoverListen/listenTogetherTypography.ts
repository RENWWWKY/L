import type { CSSProperties } from 'react'

import { PHONE_NUM_FONT_FAMILY } from '../../phone/types'

/** 与全站 .font-num 一致；内联硬编码保证覆盖父级无衬线栈（与朋友圈数字同源） */
export const listenNumStyle: CSSProperties = {
  fontFamily: PHONE_NUM_FONT_FAMILY,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
  fontWeight: 700,
}

/** 小计数/比例用：走全局衬线数字，但不强制等宽，避免 2/3 显示成 02/03 */
export const listenPlainNumStyle: CSSProperties = {
  fontFamily: PHONE_NUM_FONT_FAMILY,
  fontVariantNumeric: 'proportional-nums',
  fontFeatureSettings: '"lnum" 1',
  fontWeight: 700,
}

/** 听一听数字：全局衬线数字 + 等宽 + 略紧字距 */
export const listenNumClass = 'font-num tabular-nums tracking-tight'

/** 「我的」资料栏大号统计数字 */
export const listenNumStatClass = `text-2xl text-stone-800 ${listenNumClass}`

export function listenNumMetaClass(extra = '') {
  return [listenNumClass, extra].filter(Boolean).join(' ')
}
