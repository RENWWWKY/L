import { normalizeMomentLocation } from '../../../../components/moments/momentLocationUtils'
import type { WeChatLocationPayload } from '../newFriendsPersona/types'
import { createMapImageSeed } from './locationMapVisual'

export const DISTANCE_SLIDER_MAX_KM = 10_000

/** 坐标覆写面板默认地点池（世界观内自拟） */
export const LOCATION_TARGET_PRESETS: readonly { name: string; address: string }[] = [
  { name: 'Blue Note Jazz Club', address: '朝阳区三里屯路 11 号院 · 地下一层' },
  { name: 'MINT 电子舞池', address: '工体北路 · 西侧入口 B2' },
  { name: '云岚市·槐序路', address: '静安区 · 河滨步道 23 号' },
  { name: '星港第七区', address: '旧码头观景平台 · 靠东栏' },
  { name: '临江西岭', address: '晚风广场 · 喷泉北侧长椅' },
  { name: '澄湖木栈道', address: '水岸西区 · 第三观景台' },
]

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pickLocationPreset(seedKey: string): { name: string; address: string } {
  const idx = hashSeed(seedKey) % LOCATION_TARGET_PRESETS.length
  return LOCATION_TARGET_PRESETS[idx]!
}

/** 格式化为卡片 / 特工设备风距离标签 */
export function formatTargetDistanceLabel(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return 'Unknown'
  const km = meters / 1000
  if (km < 0.001) return '0 KM'
  if (km < 1) {
    const v = km < 0.1 ? km.toFixed(2) : km.toFixed(1)
    return `${v} KM`
  }
  if (km < 100) return `${km.toFixed(1)} KM`
  return `${Math.round(km).toLocaleString('en-US')} KM`
}

export function resolveLocationDistanceMeters(payload: WeChatLocationPayload): number | null {
  if (
    typeof payload.distanceMeters === 'number' &&
    Number.isFinite(payload.distanceMeters) &&
    payload.distanceMeters >= 0
  ) {
    return payload.distanceMeters
  }
  const parsed = parseDistanceInput(payload.distance.trim())
  return parsed != null ? parsed : null
}

export type LocationDistanceSubtitleStyle = 'imessage' | 'telegram'

/** iMessage / Telegram 位置卡片副标题（自然语言距离，非特工设备风） */
export function formatLocationDistanceSubtitle(
  payload: WeChatLocationPayload,
  style: LocationDistanceSubtitleStyle = 'imessage',
): string {
  if (/unknown/i.test(payload.distance.trim())) {
    return style === 'imessage' ? 'Unknown distance' : '—'
  }
  const meters = resolveLocationDistanceMeters(payload)
  if (meters == null) {
    return style === 'imessage' ? 'Unknown distance' : '—'
  }
  if (meters < 1000) {
    const label = `${Math.round(meters).toLocaleString('en-US')} m`
    return style === 'imessage' ? `${label} away` : label
  }
  const km = meters / 1000
  const kmStr = km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('en-US')
  const label = `${kmStr} km`
  return style === 'imessage' ? `${label} away` : label
}

/** Talkmaker 位置卡片距离文案 */
export function formatLocationDistanceTalkmaker(payload: WeChatLocationPayload): {
  showNearBadge: boolean
  label: string
} {
  if (/unknown/i.test(payload.distance.trim())) {
    return { showNearBadge: false, label: '距离未知' }
  }
  const meters = resolveLocationDistanceMeters(payload)
  if (meters == null) {
    return { showNearBadge: false, label: '距离未知' }
  }
  if (meters < 1000) {
    return { showNearBadge: true, label: `距离你 ${Math.round(meters).toLocaleString('en-US')} m` }
  }
  const km = meters / 1000
  const kmStr = km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('en-US')
  return { showNearBadge: meters < 2000, label: `距离你 ${kmStr} km` }
}

/** 解析手填距离字符串（支持 km / m / 纯数字视为 km） */
export function parseDistanceInput(raw: string): number | null {
  const t = raw.trim().replace(/,/g, '')
  if (!t || /^unknown$/i.test(t)) return null
  const kmMatch = /^([\d.]+)\s*km$/i.exec(t)
  if (kmMatch) {
    const n = Number(kmMatch[1])
    return Number.isFinite(n) ? Math.max(0, n * 1000) : null
  }
  const mMatch = /^([\d.]+)\s*m$/i.exec(t)
  if (mMatch) {
    const n = Number(mMatch[1])
    return Number.isFinite(n) ? Math.max(0, n) : null
  }
  const n = Number(t)
  if (Number.isFinite(n)) return Math.max(0, n * 1000)
  return null
}

export type LocationSpoofDraft = {
  name: string
  address: string
  distanceMeters: number
  mapImageSeed: string
}

export function buildDefaultLocationSpoofDraft(seedKey: string): LocationSpoofDraft {
  const preset = pickLocationPreset(seedKey)
  return {
    name: preset.name,
    address: preset.address,
    distanceMeters: 1200,
    mapImageSeed: createMapImageSeed(),
  }
}

export function buildWeChatLocationPayload(draft: LocationSpoofDraft): WeChatLocationPayload | null {
  const name = normalizeMomentLocation(draft.name) ?? draft.name.trim().slice(0, 120)
  if (!name) return null
  const address = draft.address.trim().slice(0, 160) || undefined
  const distanceMeters = Math.max(0, Math.min(DISTANCE_SLIDER_MAX_KM * 1000, Math.round(draft.distanceMeters)))
  const distance = formatTargetDistanceLabel(distanceMeters)
  const mapImageSeed = draft.mapImageSeed.trim() || createMapImageSeed()

  return {
    locationId: `wxloc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    address,
    distance,
    distanceMeters,
    mapImageSeed,
  }
}

export function locationShareContentFallback(payload: WeChatLocationPayload): string {
  const place = payload.address?.trim() ? `${payload.name} · ${payload.address}` : payload.name
  return `[位置] ${place}（TARGET DISTANCE: ${payload.distance}）`
}

/** 从 IndexedDB 原始字段解析位置卡片 */
export function parseWeChatLocationPayloadFromDb(raw: unknown): WeChatLocationPayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const locationId = typeof r.locationId === 'string' ? r.locationId.trim() : ''
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 120) : ''
  if (!locationId || !name) return undefined
  const address = typeof r.address === 'string' ? r.address.trim().slice(0, 160) : undefined
  const distance = typeof r.distance === 'string' ? r.distance.trim() : 'Unknown'
  const distanceMetersRaw = typeof r.distanceMeters === 'number' ? r.distanceMeters : Number(r.distanceMeters)
  const distanceMeters = Number.isFinite(distanceMetersRaw) ? Math.max(0, distanceMetersRaw) : undefined
  const mapImageSeed = typeof r.mapImageSeed === 'string' ? r.mapImageSeed.trim() : undefined
  const snapshotUrl = typeof r.snapshotUrl === 'string' ? r.snapshotUrl.trim().slice(0, 4000) : undefined
  return {
    locationId,
    name,
    ...(address ? { address } : {}),
    distance: distance || 'Unknown',
    ...(distanceMeters !== undefined ? { distanceMeters } : {}),
    ...(mapImageSeed ? { mapImageSeed } : {}),
    ...(snapshotUrl ? { snapshotUrl } : {}),
  }
}
