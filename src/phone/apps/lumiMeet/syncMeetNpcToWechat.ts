import { normalizeBirthdayMD, zodiacZhFromStoredMD } from '../wechat/newFriendsPersona/characterProfilePhysioUtils'
import { personaDb, emitWeChatStorageChanged } from '../wechat/newFriendsPersona/idb'
import type { Character, Gender, WorldBook } from '../wechat/newFriendsPersona/types'
import {
  buildMeetNineDimensionWorldBooks,
  buildMeetPersonaFallbackWorldBook,
  buildMeetVol10WorldBook,
  extractMeetVol10EpiloguePayload,
  hasMeetVol10GraduatedEpilogue,
  isMeetSyncedWorldBookId,
  isMeetTruthMirrorWorldBookId,
} from './meetNineDimensionWorldBooks'
import {
  buildMeetVol11UserMeetProfileWorldBook,
  loadMeetUserProfileSnapshotFromKv,
} from './meetUserProfileSnapshot'
import type { EncounterNPC } from './meetTypes'
import { removeMeetLoreEntriesForNpcIds } from './meetClearEncounterData'
import { consolidateMeetCharacterWorldBooks } from './meetWorldbookConsolidate'
import { formatMeetEpilogueImpressionForStorage } from './meetPersonaWorldbookSync'
import {
  deriveMeetMottoFromPersona,
  deriveMeetOccupationLabel,
  deriveMeetWechatSignatureFromPersona,
  ensureMeetHeightCmValue,
  ensureMeetWeightKgValue,
  formatMeetMbtiLettersForUi,
  isMeetProfilePlaceholder,
} from './comprehensivePersona'

function mapGenderLabel(g: string): Gender {
  if (g.includes('女')) return 'female'
  if (g.includes('男')) return 'male'
  return 'other'
}

/** 结业后：把人设库中 meet-wb-{id}-vol10 写成可注入的「尾声延展」分册（与档案法则条目同源占位符） */
export async function patchMeetCharacterVol10Epilogue(params: {
  characterId: string
  nickname: string
  charRealName?: string | null
  playerDisplayName?: string
  rawLore: string
}): Promise<void> {
  const ch = await personaDb.getCharacter(params.characterId)
  if (!ch) {
    throw new Error(`[遇见同步] 未在人设库找到角色，无法写入 vol10 尾声延展：${params.characterId}`)
  }
  const now = Date.now()
  const rn = (params.charRealName ?? ch.name ?? params.nickname).trim()
  const { title, body } = formatMeetEpilogueImpressionForStorage({
    rawContent: params.rawLore,
    charNickname: params.nickname,
    charRealName: rn,
    playerDisplayName: params.playerDisplayName,
  })
  const vol10 = buildMeetVol10WorldBook(params.characterId, params.nickname, rn, now, { itemName: title, content: body })
  const rest = (ch.worldBooks ?? []).filter((w) => w.id !== vol10.id)
  const worldBooks = consolidateMeetCharacterWorldBooks(params.characterId, [...rest, vol10])
  await personaDb.upsertCharacter({ ...ch, worldBooks, updatedAt: now })
  emitWeChatStorageChanged()
}

/**
 * 将「遇见」NPC 写入人设库（含可搜索的 wechatId），供微信「添加朋友」等能力使用。
 * 写入通讯录须由用户通过好友验证后，或 UI 层显式调用 `replaceWeChatPersonaContacts`。
 */
export async function upsertMeetNpcAsCharacter(
  npc: EncounterNPC,
  wechatId: string,
  opts?: { bindPlayerIdentityId?: string; ownerWechatAccountId?: string },
): Promise<Character> {
  const { resolveMeetWeChatPlayerIdentityId } = await import('./meetResolveWeChatPlayerIdentityId')
  const { loadMeetPersisted } = await import('./meetPersistLoad')
  const bound = opts?.bindPlayerIdentityId?.trim()
  let playerIdentityId: string | undefined
  if (bound && bound !== '__none__') {
    playerIdentityId = bound
  } else {
    const meet = await loadMeetPersisted()
    const resolved = await resolveMeetWeChatPlayerIdentityId(meet?.meetProfile.baseWeChatIdentityId)
    if (resolved) playerIdentityId = resolved
    else {
      const identities = await personaDb.listPlayerIdentities()
      const rawPid = identities[0]?.id?.trim()
      playerIdentityId = rawPid && rawPid !== '__none__' ? rawPid : undefined
    }
  }

  const now = Date.now()
  const existing = await personaDb.getCharacter(npc.id)
  const existingBooks = existing?.worldBooks ?? []
  const prevEpilogue = hasMeetVol10GraduatedEpilogue(npc.id, existingBooks)
    ? extractMeetVol10EpiloguePayload(npc.id, existingBooks)
    : null

  const base = npc.comprehensivePersona?.base
  const legalName = (npc.realName ?? base?.realName)?.trim() || npc.nickname

  const profileSnap =
    npc.meetUserProfileAtMatch ?? (await loadMeetUserProfileSnapshotFromKv(npc.id))
  const vol11 = buildMeetVol11UserMeetProfileWorldBook(
    npc.id,
    npc.nickname,
    legalName,
    profileSnap,
    now,
  )
  const meetBooks: WorldBook[] = [
    ...(npc.comprehensivePersona
      ? buildMeetNineDimensionWorldBooks(npc.id, npc.nickname, npc.comprehensivePersona, now, prevEpilogue)
      : [
          ...buildMeetPersonaFallbackWorldBook(npc.id, npc.nickname, npc.persona, now),
          buildMeetVol10WorldBook(npc.id, npc.nickname, legalName, now, prevEpilogue),
        ]),
    ...vol11,
  ]

  /** 移除旧版单册与遇见同步分册（vol01–vol11），再追加当前生成的遇见分册；保留 vol12 真心话与用户自建世界书 */
  const preservedTruth = existingBooks.filter((w) => isMeetTruthMirrorWorldBookId(npc.id, w.id))
  const mergedWorldBooks = consolidateMeetCharacterWorldBooks(npc.id, [
    ...existingBooks.filter(
      (w) => !isMeetSyncedWorldBookId(npc.id, w.id) && !isMeetTruthMirrorWorldBookId(npc.id, w.id),
    ),
    ...meetBooks,
    ...preservedTruth,
  ])

  const birthdayRaw = npc.birthdayMD ?? base?.birthdayMD ?? '06-15'
  const birthdayMD = normalizeBirthdayMD(birthdayRaw)
  const ageYears =
    npc.ageYears != null && Number.isFinite(npc.ageYears)
      ? Math.max(16, Math.min(99, Math.floor(npc.ageYears)))
      : 24
  const weightResolved = ensureMeetWeightKgValue(String(npc.weightKg ?? base?.weightKg ?? ''), npc.id)
  const heightResolved = ensureMeetHeightCmValue(String(npc.heightCm ?? base?.heightCm ?? ''), npc.id)
  const zodiac =
    (npc.zodiac ?? base?.zodiac)?.trim() || zodiacZhFromStoredMD(birthdayMD)

  const sk = npc.comprehensivePersona?.abilities.skills?.trim() ?? ''
  const occupation =
    npc.occupation?.trim() ||
    (npc.comprehensivePersona ? deriveMeetOccupationLabel(npc.comprehensivePersona.abilities.skills) : '') ||
    (!isMeetProfilePlaceholder(sk) ? sk.slice(0, 16) : '') ||
    '市民'

  const mottoChar = npc.motto?.trim()
    ? npc.motto.trim()
    : npc.comprehensivePersona
      ? deriveMeetMottoFromPersona(npc.comprehensivePersona)
      : npc.persona.slice(0, 48)

  let wechatSignatureLine = npc.persona.slice(0, 120)
  if (npc.comprehensivePersona) {
    const sigR = npc.comprehensivePersona.base.wechatSignature?.trim() ?? ''
    wechatSignatureLine =
      sigR && !isMeetProfilePlaceholder(sigR)
        ? sigR.slice(0, 120)
        : deriveMeetWechatSignatureFromPersona(npc.comprehensivePersona).slice(0, 120)
  }

  const mbtiResolved =
    npc.mbti?.trim() ||
    (npc.comprehensivePersona ? formatMeetMbtiLettersForUi(npc.comprehensivePersona.core.mbti) : '')
  const mbtiFinal = mbtiResolved && mbtiResolved !== '—' ? mbtiResolved : undefined

  const ch: Character = {
    id: npc.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    name: legalName,
    gender: mapGenderLabel(npc.gender),
    age: ageYears,
    birthdayMD,
    zodiac,
    height: heightResolved,
    identity: occupation.slice(0, 48),
    mbti: mbtiFinal,
    bio: npc.persona.slice(0, 480),
    motto: mottoChar.slice(0, 80),
    openingLines: '',
    avatarUrl: npc.avatarUrl,
    wechatNickname: npc.nickname,
    weight: weightResolved,
    wechatId,
    wechatSignature: wechatSignatureLine,
    worldBooks: mergedWorldBooks,
    playerIdentityId,
    remark: npc.nickname,
    worldBackgroundEnabled: true,
    wechatAccountId: opts?.ownerWechatAccountId?.trim() || existing?.wechatAccountId,
  }

  await personaDb.upsertCharacter(ch)
  removeMeetLoreEntriesForNpcIds([npc.id])
  emitWeChatStorageChanged()
  return ch
}
