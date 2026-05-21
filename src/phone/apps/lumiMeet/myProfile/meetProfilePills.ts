import type { MeetMatchIntention } from '../meetTypes'

/** 与策划 Tab1 顺序一致：浪漫邂逅、纯粹友谊、闲聊搭子、灵魂共鸣 */
export const INTENT_BLOCKS: { id: MeetMatchIntention; en: string; zh: string }[] = [
  { id: 'romance', en: 'Romance', zh: '浪漫邂逅' },
  { id: 'platonic', en: 'Platonic', zh: '纯粹友谊' },
  { id: 'casual', en: 'Casual', zh: '闲聊搭子' },
  { id: 'soulmate', en: 'Soulmate', zh: '灵魂共鸣' },
]

export const ORIENTATION_PILLS: { value: string; en: string; zh: string }[] = [
  { value: 'Hetero | 异性恋', en: 'Hetero', zh: '异性恋' },
  { value: 'Homo | 同性恋', en: 'Homo', zh: '同性恋' },
  { value: 'Bi/Pan | 双性恋 / 泛性恋', en: 'Bi/Pan', zh: '双性恋 / 泛性恋' },
  { value: 'Asexual | 无性恋', en: 'Asexual', zh: '无性恋' },
]

export function meetProfilePillClass(active: boolean): string {
  const base =
    'rounded-full border px-3.5 py-1.5 text-[11px] font-light tracking-wide transition-colors duration-300 '
  if (active) {
    return `${base} border-transparent bg-[#1C1C1E] text-white`
  }
  return `${base} border-[#d6d2ca] bg-transparent text-[#5c574f]`
}
