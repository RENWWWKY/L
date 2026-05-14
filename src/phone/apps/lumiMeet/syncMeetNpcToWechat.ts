import { normalizeBirthdayMD, zodiacZhFromStoredMD } from '../wechat/newFriendsPersona/characterProfilePhysioUtils'
import { personaDb, emitWeChatStorageChanged } from '../wechat/newFriendsPersona/idb'
import type { Character, Gender, WorldBook } from '../wechat/newFriendsPersona/types'
import {
  buildMeetNineDimensionWorldBooks,
  buildMeetPersonaFallbackWorldBook,
  buildMeetVol10WorldBook,
  extractMeetVol10EpiloguePayload,
  isMeetSyncedWorldBookId,
} from './meetNineDimensionWorldBooks'
import type { EncounterNPC } from './meetTypes'
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
  if (!ch) return
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
  await personaDb.upsertCharacter({ ...ch, worldBooks: [...rest, vol10], updatedAt: now })
  emitWeChatStorageChanged()
}

/**
 * 将「遇见」NPC 写入人设库并可用于镜像微信；须在 UI 层再调用 `replaceWeChatPersonaContacts` 注入通讯录。
 */
export async function upsertMeetNpcAsCharacter(npc: EncounterNPC, wechatId: string): Promise<Character> {
  const identities = await personaDb.listPlayerIdentities()
  const rawPid = identities[0]?.id?.trim()
  const playerIdentityId = rawPid && rawPid !== '__none__' ? rawPid : undefined

  const now = Date.now()
  const existing = await personaDb.getCharacter(npc.id)
  const existingBooks = existing?.worldBooks ?? []
  const prevEpilogue = extractMeetVol10EpiloguePayload(npc.id, existingBooks)

  const base = npc.comprehensivePersona?.base
  const legalName = (npc.realName ?? base?.realName)?.trim() || npc.nickname

  const meetBooks: WorldBook[] = npc.comprehensivePersona
    ? buildMeetNineDimensionWorldBooks(npc.id, npc.nickname, npc.comprehensivePersona, now, prevEpilogue)
    : [
        ...buildMeetPersonaFallbackWorldBook(npc.id, npc.nickname, npc.persona, now),
        buildMeetVol10WorldBook(npc.id, npc.nickname, legalName, now, prevEpilogue),
      ]

  /** 移除旧版单册与遇见同步分册（vol01–vol10），再追加当前生成的遇见分册，保留用户自建世界书 */
  const mergedWorldBooks: WorldBook[] = [
    ...existingBooks.filter((w) => !isMeetSyncedWorldBookId(npc.id, w.id)),
    ...meetBooks,
  ]

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
  }

  await personaDb.upsertCharacter(ch)
  emitWeChatStorageChanged()
  return ch
}
