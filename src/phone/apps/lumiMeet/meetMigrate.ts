import { normalizeComprehensivePersona } from './comprehensivePersona'
import type {
  EncounterMatchType,
  EncounterMemory,
  EncounterNPC,
  EncounterStatus,
  DestinyArchiveCharMeta,
  LumiMeetPersistedState,
  MeetMatchIntention,
  MeetOrientationPreference,
  MeetPublicProfile,
  MeetUserProfileSnapshot,
  RadarFilters,
} from './meetTypes'
import {
  DEFAULT_MEET_STATE,
  DEFAULT_RADAR_FILTERS,
  resolveMeetEncounterChatBackgroundUrl,
} from './constants'
import { legacyPurposeToMeetIntentions, MEET_ORIENTATION_PREFERENCE_IDS } from './meetMatchCriteria'

const VALID_STATUS: EncounterStatus[] = ['orbiting', 'missed', 'matched', 'wechat_added']

const MEET_INTENTION_IDS: MeetMatchIntention[] = ['romance', 'platonic', 'soulmate', 'casual']

function normalizeMeetUserProfileSnapshot(raw: unknown): MeetUserProfileSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const capturedAt =
    typeof o.capturedAt === 'number' && Number.isFinite(o.capturedAt) ? Math.floor(o.capturedAt) : Date.now()
  const meetIntentionsPublic = Array.isArray(o.meetIntentionsPublic)
    ? o.meetIntentionsPublic.filter((x): x is MeetMatchIntention =>
        MEET_INTENTION_IDS.includes(x as MeetMatchIntention),
      )
    : []
  return {
    capturedAt,
    displayName: typeof o.displayName === 'string' ? o.displayName.trim() : '',
    intent: typeof o.intent === 'string' ? o.intent.trim() : '',
    bio: typeof o.bio === 'string' ? o.bio.trim() : '',
    orientation: typeof o.orientation === 'string' ? o.orientation.trim() : '',
    meetIntentionsPublic,
  }
}

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
    ...(normalizeMeetUserProfileSnapshot(o.meetUserProfileAtMatch)
      ? { meetUserProfileAtMatch: normalizeMeetUserProfileSnapshot(o.meetUserProfileAtMatch) }
      : {}),
  }
}

const VALID_MATCH_TYPES: EncounterMatchType[] = ['resonated', 'reconnected', 'faded']

function normalizeEncounterMemory(raw: unknown): EncounterMemory | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const charId = typeof o.charId === 'string' ? o.charId.trim() : ''
  if (!id || !charId) return null
  const matchType = VALID_MATCH_TYPES.includes(o.matchType as EncounterMatchType)
    ? (o.matchType as EncounterMatchType)
    : 'faded'
  const attemptsRaw = o.matchAttempts
  const matchAttempts =
    typeof attemptsRaw === 'number' && Number.isFinite(attemptsRaw) && attemptsRaw >= 1
      ? Math.floor(attemptsRaw)
      : 1
  const ts =
    typeof o.timestamp === 'number' && Number.isFinite(o.timestamp) ? Math.floor(o.timestamp) : Date.now()
  return {
    id,
    charId,
    avatarUrl: typeof o.avatarUrl === 'string' ? o.avatarUrl : '',
    nickname: typeof o.nickname === 'string' ? o.nickname : '未命名',
    matchType,
    matchAttempts,
    aiSummary: typeof o.aiSummary === 'string' ? o.aiSummary : '',
    customMemo: typeof o.customMemo === 'string' ? o.customMemo : undefined,
    timestamp: ts,
    isManual: o.isManual === true,
  }
}

function normalizeDestinyArchiveMetaMap(raw: unknown): Record<string, DestinyArchiveCharMeta> {
  const out: Record<string, DestinyArchiveCharMeta> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const cid = k.trim()
    if (!cid || !v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const attempts =
      typeof o.matchAttempts === 'number' && Number.isFinite(o.matchAttempts) && o.matchAttempts >= 1
        ? Math.floor(o.matchAttempts)
        : 1
    out[cid] = {
      matchAttempts: attempts,
      everMissed: o.everMissed === true,
      lastMatchWasReunion: o.lastMatchWasReunion === true,
    }
  }
  return out
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

  const readRaw = p.meetInboxLastReadTsByNpcId
  let meetInboxLastReadTsByNpcId: Record<string, number> = {}
  if (readRaw && typeof readRaw === 'object' && !Array.isArray(readRaw)) {
    for (const [k, v] of Object.entries(readRaw as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) meetInboxLastReadTsByNpcId[k] = Math.floor(v)
    }
  }

  const mergedProfileRaw =
    p.meetProfile && typeof p.meetProfile === 'object' ? (p.meetProfile as Partial<MeetPublicProfile>) : {}
  const meetProfile: MeetPublicProfile = {
    ...base.meetProfile,
    ...mergedProfileRaw,
    meetAvatarUrl: typeof mergedProfileRaw.meetAvatarUrl === 'string' ? mergedProfileRaw.meetAvatarUrl : '',
    contactWechatId:
      typeof mergedProfileRaw.contactWechatId === 'string' ? mergedProfileRaw.contactWechatId.trim() : '',
    baseWeChatIdentityId:
      typeof mergedProfileRaw.baseWeChatIdentityId === 'string' ? mergedProfileRaw.baseWeChatIdentityId : '',
    meetIntentionsPublic: Array.isArray(mergedProfileRaw.meetIntentionsPublic)
      ? mergedProfileRaw.meetIntentionsPublic.filter((x): x is MeetMatchIntention =>
          ['romance', 'platonic', 'soulmate', 'casual'].includes(x as MeetMatchIntention),
        )
      : base.meetProfile.meetIntentionsPublic,
    chatBackground: resolveMeetEncounterChatBackgroundUrl(
      typeof mergedProfileRaw.chatBackground === 'string' ? mergedProfileRaw.chatBackground : '',
    ),
    secretAdmirers:
      typeof mergedProfileRaw.secretAdmirers === 'number' && Number.isFinite(mergedProfileRaw.secretAdmirers)
        ? Math.max(0, Math.floor(mergedProfileRaw.secretAdmirers))
        : base.meetProfile.secretAdmirers,
    lastCheckTime:
      typeof mergedProfileRaw.lastCheckTime === 'number' && Number.isFinite(mergedProfileRaw.lastCheckTime)
        ? Math.floor(mergedProfileRaw.lastCheckTime)
        : base.meetProfile.lastCheckTime,
  }
  if (!meetProfile.meetIntentionsPublic.length) {
    meetProfile.meetIntentionsPublic = [...base.meetProfile.meetIntentionsPublic]
  }

  const archiveRaw = Array.isArray(p.destinyArchive) ? p.destinyArchive : []
  const destinyArchive = archiveRaw.map(normalizeEncounterMemory).filter((x): x is EncounterMemory => !!x)

  return {
    ...base,
    ...p,
    version: 5,
    npcs,
    squarePosts: Array.isArray(p.squarePosts) ? (p.squarePosts as LumiMeetPersistedState['squarePosts']) : [],
    chatThreads:
      p.chatThreads && typeof p.chatThreads === 'object'
        ? (p.chatThreads as LumiMeetPersistedState['chatThreads'])
        : {},
    meetInboxLastReadTsByNpcId,
    intimacyByNpcId:
      p.intimacyByNpcId && typeof p.intimacyByNpcId === 'object'
        ? (p.intimacyByNpcId as Record<string, number>)
        : {},
    encounterSwapByNpcId:
      p.encounterSwapByNpcId && typeof p.encounterSwapByNpcId === 'object'
        ? (p.encounterSwapByNpcId as LumiMeetPersistedState['encounterSwapByNpcId'])
        : {},
    meetProfile,
    radarFilters: normalizeRadarFilters(p.radarFilters),
    rewindChargesRemaining,
    encounterChatCoachCompleted: p.encounterChatCoachCompleted === true,
    worldbookShelfCoachCompleted: p.worldbookShelfCoachCompleted === true,
    meetAppCoachCompleted: p.meetAppCoachCompleted === true,
    destinyArchive,
    destinyArchiveMetaByCharId: normalizeDestinyArchiveMetaMap(p.destinyArchiveMetaByCharId),
  }
}
