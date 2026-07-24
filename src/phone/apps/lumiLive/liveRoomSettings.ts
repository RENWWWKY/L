import {
  DEFAULT_LIVE_ROOM_SETTINGS,
  LIVE_SCENE_DURATION_OPTIONS,
  type LiveDanmakuStyle,
  type LiveRoomSettings,
} from './types'

const STORAGE_KEY = 'lumi-live-room-settings-v1'

type StoreMap = Record<string, LiveRoomSettings>

function clampBatch(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 1
  return Math.min(5, Math.max(1, v))
}

function normalizeStyle(raw: unknown): LiveDanmakuStyle {
  if (raw === 'fangirl' || raw === 'quiet' || raw === 'sarcastic' || raw === 'restrained') return raw
  return DEFAULT_LIVE_ROOM_SETTINGS.danmakuStyle
}

function normalizeSceneDuration(raw: unknown): number {
  const v = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : DEFAULT_LIVE_ROOM_SETTINGS.sceneDurationSec
  if ((LIVE_SCENE_DURATION_OPTIONS as readonly number[]).includes(v)) return v
  // clamp to nearest option
  let best: (typeof LIVE_SCENE_DURATION_OPTIONS)[number] = LIVE_SCENE_DURATION_OPTIONS[0]!
  let bestDist = Math.abs(v - best)
  for (const opt of LIVE_SCENE_DURATION_OPTIONS) {
    const d = Math.abs(v - opt)
    if (d < bestDist) {
      best = opt
      bestDist = d
    }
  }
  return best
}

function normalizeSettings(raw: unknown): LiveRoomSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const bg = typeof o.backgroundUrl === 'string' ? o.backgroundUrl : ''
  return {
    backgroundUrl: bg.trim(),
    danmakuBatchCount: clampBatch(o.danmakuBatchCount),
    danmakuStyle: normalizeStyle(o.danmakuStyle),
    sceneDurationSec: normalizeSceneDuration(o.sceneDurationSec),
  }
}

function readAll(): StoreMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: StoreMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!k.trim()) continue
      out[k] = normalizeSettings(v)
    }
    return out
  } catch {
    return {}
  }
}

function writeAll(map: StoreMap) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // quota / private mode
  }
}

export function loadLiveRoomSettings(roomId: string): LiveRoomSettings {
  const id = roomId.trim()
  if (!id) return { ...DEFAULT_LIVE_ROOM_SETTINGS }
  const all = readAll()
  return all[id] ? { ...DEFAULT_LIVE_ROOM_SETTINGS, ...all[id] } : { ...DEFAULT_LIVE_ROOM_SETTINGS }
}

export function saveLiveRoomSettings(roomId: string, next: LiveRoomSettings): LiveRoomSettings {
  const id = roomId.trim()
  const normalized = normalizeSettings(next)
  if (!id) return normalized
  const all = readAll()
  all[id] = normalized
  writeAll(all)
  return normalized
}

export function patchLiveRoomSettings(
  roomId: string,
  patch: Partial<LiveRoomSettings>,
): LiveRoomSettings {
  const prev = loadLiveRoomSettings(roomId)
  return saveLiveRoomSettings(roomId, { ...prev, ...patch })
}
