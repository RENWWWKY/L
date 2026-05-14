import { normalizeComprehensivePersona } from './comprehensivePersona'
import type {
  EncounterNPC,
  EncounterStatus,
  LumiMeetPersistedState,
  MeetMatchIntention,
  MeetOrientationPreference,
  RadarFilters,
} from './meetTypes'
import { DEFAULT_MEET_STATE, DEFAULT_RADAR_FILTERS } from './constants'
import { legacyPurposeToMeetIntentions, MEET_ORIENTATION_PREFERENCE_IDS } from './meetMatchCriteria'

const VALID_STATUS: EncounterStatus[] = ['orbiting', 'missed', 'matched', 'wechat_added']

export function normalizeEncounterNpc(raw: unknown): EncounterNPC | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  if (!id) return null

  const rawStatus = typeof o.status === 'string' ? o.status : 'orbiting'
  let status: EncounterStatus =
    rawStatus === 'discovered'
      ? 'orbiting'
      : VALID_STATUS.includes(rawStatus as EncounterStatus)
        ? (rawStatus as EncounterStatus)
        : 'orbiting'

  const lastRaw = o.lastEncounterTime
  const lastEncounterTime =
    typeof lastRaw === 'number' && Number.isFinite(lastRaw) && lastRaw > 0
      ? Math.floor(lastRaw)
      : Date.now()

  const compRaw = o.comprehensive ?? o.comprehensivePersona
  const comprehensivePersona =
    compRaw && typeof compRaw === 'object' ? normalizeComprehensivePersona(compRaw) : undefined

  const ageRaw = o.ageYears
  const ageYears =
    typeof ageRaw === 'number' && Number.isFinite(ageRaw) ? Math.max(0, Math.min(120, Math.floor(ageRaw))) : undefined

  return {
    id,
    avatarUrl: typeof o.avatarUrl === 'string' ? o.avatarUrl : '',
    nickname: typeof o.nickname === 'string' ? o.nickname : '未命名',
    realName: typeof o.realName === 'string' ? o.realName : undefined,
    ageYears,
    birthdayMD: typeof o.birthdayMD === 'string' ? o.birthdayMD : undefined,
    weightKg: typeof o.weightKg === 'string' ? o.weightKg : undefined,
    heightCm: typeof o.heightCm === 'string' ? o.heightCm : undefined,
    occupation: typeof o.occupation === 'string' ? o.occupation : undefined,
    motto: typeof o.motto === 'string' ? o.motto : undefined,
    mbti: typeof o.mbti === 'string' ? o.mbti : undefined,
    zodiac: typeof o.zodiac === 'string' ? o.zodiac : undefined,
    gender: typeof o.gender === 'string' ? o.gender : '',
    orientation: typeof o.orientation === 'string' ? o.orientation : '',
    persona: typeof o.persona === 'string' ? o.persona : '',
    ...(comprehensivePersona ? { comprehensivePersona } : {}),
    status,
    lastEncounterTime,
    wechatId: typeof o.wechatId === 'string' ? o.wechatId : undefined,
    ...(typeof o.mutualSpark === 'boolean' ? { mutualSpark: o.mutualSpark } : {}),
    ...(o.generationSource === 'offline' || o.generationSource === 'api'
      ? { generationSource: o.generationSource }
      : {}),
  }
}

function normalizeRadarFilters(raw: unknown): RadarFilters {
  const base: RadarFilters = { ...DEFAULT_RADAR_FILTERS }
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const gender =
    o.gender === 'male' || o.gender === 'female' || o.gender === 'any' ? o.gender : base.gender
  const purpose =
    o.purpose === 'love' || o.purpose === 'friend' || o.purpose === 'buddy' ? o.purpose : base.purpose
  const keywords = typeof o.keywords === 'string' ? o.keywords : base.keywords

  let orientationPreferences: MeetOrientationPreference[] = base.orientationPreferences
  if (Array.isArray(o.orientationPreferences)) {
    orientationPreferences = o.orientationPreferences.filter((x): x is MeetOrientationPreference =>
      MEET_ORIENTATION_PREFERENCE_IDS.includes(x as MeetOrientationPreference),
    )
  }

  let ageMin =
    typeof o.ageMin === 'number' && Number.isFinite(o.ageMin) ? Math.round(o.ageMin) : base.ageMin
  let ageMax =
    typeof o.ageMax === 'number' && Number.isFinite(o.ageMax) ? Math.round(o.ageMax) : base.ageMax
  ageMin = Math.max(18, Math.min(99, ageMin))
  ageMax = Math.max(18, Math.min(99, ageMax))
  if (ageMax < ageMin) {
    const t = ageMin
    ageMin = ageMax
    ageMax = t
  }

  let meetIntentions: MeetMatchIntention[]
  if (Array.isArray(o.meetIntentions)) {
    const allowedM: MeetMatchIntention[] = ['romance', 'platonic', 'soulmate', 'casual']
    meetIntentions = o.meetIntentions.filter((x): x is MeetMatchIntention =>
      allowedM.includes(x as MeetMatchIntention),
    )
  } else {
    meetIntentions = legacyPurposeToMeetIntentions(purpose)
  }
  if (!meetIntentions.length) {
    meetIntentions = legacyPurposeToMeetIntentions(purpose)
  }

  return {
    gender,
    purpose,
    keywords,
    orientationPreferences,
    ageMin,
    ageMax,
    meetIntentions,
  }
}

/** 将任意持久化快照迁移为当前 schema（v4） */
export function migrateLumiMeetPersisted(raw: unknown): LumiMeetPersistedState {
  const base = JSON.parse(JSON.stringify(DEFAULT_MEET_STATE)) as LumiMeetPersistedState
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base

  const p = raw as Partial<LumiMeetPersistedState> & Record<string, unknown>
  const npcsRaw = Array.isArray(p.npcs) ? p.npcs : []
  const npcs = npcsRaw.map(normalizeEncounterNpc).filter((x): x is EncounterNPC => !!x)

  const rewindRaw = p.rewindChargesRemaining
  const rewindChargesRemaining =
    typeof rewindRaw === 'number' && Number.isFinite(rewindRaw) && rewindRaw >= 0
      ? Math.min(9999, Math.floor(rewindRaw))
      : base.rewindChargesRemaining

  return {
    ...base,
    ...p,
    version: 4,
    npcs,
    squarePosts: Array.isArray(p.squarePosts) ? (p.squarePosts as LumiMeetPersistedState['squarePosts']) : [],
    chatThreads:
      p.chatThreads && typeof p.chatThreads === 'object'
        ? (p.chatThreads as LumiMeetPersistedState['chatThreads'])
        : {},
    intimacyByNpcId:
      p.intimacyByNpcId && typeof p.intimacyByNpcId === 'object'
        ? (p.intimacyByNpcId as Record<string, number>)
        : {},
    encounterSwapByNpcId:
      p.encounterSwapByNpcId && typeof p.encounterSwapByNpcId === 'object'
        ? (p.encounterSwapByNpcId as LumiMeetPersistedState['encounterSwapByNpcId'])
        : {},
    meetProfile: {
      ...base.meetProfile,
      ...(p.meetProfile && typeof p.meetProfile === 'object' ? p.meetProfile : {}),
    },
    radarFilters: normalizeRadarFilters(p.radarFilters),
    rewindChargesRemaining,
  }
}
