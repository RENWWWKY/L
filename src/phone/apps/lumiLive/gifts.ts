import type { LiveGift } from './types'

/** 心意赞助目录 — 极简静物，无花哨特效 */
export const LIVE_GIFTS: LiveGift[] = [
  {
    id: 'americano',
    name: '一杯冰美式',
    priceYuan: 25,
    ceremonyLabel: '一杯冰美式',
    blurb: '深夜连线里最克制的温度',
  },
  {
    id: 'letter',
    name: '匿名信笺',
    priceYuan: 99,
    ceremonyLabel: '匿名信笺',
    blurb: '不署名，只留下一行心意',
  },
  {
    id: 'stardust',
    name: '私人星轨',
    priceYuan: 520,
    ceremonyLabel: '私人星轨',
    blurb: '只为一人划过的细光',
  },
]

export function findLiveGift(id: string): LiveGift | undefined {
  return LIVE_GIFTS.find((g) => g.id === id)
}
