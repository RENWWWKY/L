import type { ApiConfig } from '../../phone/apps/api/types'
import { loadOfflineDatingPlotsPromptBlock } from '../../phone/apps/wechat/dating/loadOfflineDatingPlotsForWechatPrompt'
import { formatCharacterMemoriesForPromptInjection } from '../../phone/apps/wechat/memory/formatCharacterMemoriesForPromptInjection'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { Character, PlayerIdentity } from '../../phone/apps/wechat/newFriendsPersona/types'
import { formatWorldBackgroundForPrompt } from '../../phone/apps/wechat/newFriendsPersona/worldBackgroundFormat'
import { resolveActivePrivateChatSessionPlayerIdentityId } from '../../phone/apps/wechat/wechatCharacterPlayerIdentity'
import {
  WECHAT_LUMI_PEER_CHARACTER_ID,
  wechatAccountPrivateConversationKey,
} from '../../phone/apps/wechat/wechatConversationKey'
import { buildMemoryRelevanceHaystack } from '../../phone/apps/wechat/wechatMemoryPromptBlocks'
import {
  buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt,
  formatUnsummarizedPrivateChatBlock,
} from '../../phone/apps/wechat/wechatMemoryPromptBlocks'
import {
  normalizeMemoryPromptLineScope,
  wrapUnsummarizedPrivateBlockWithLineLabel,
} from '../../phone/apps/wechat/wechatMemoryLineScope'
import { isMeetSyncedCharacter } from '../../phone/apps/lumiMeet/meetUserProfileSnapshot'
import { formatUnsummarizedMeetChatBlock } from '../../phone/apps/lumiMeet/meetMemoryPromptBlocks'
import { loadMeetEncounterMemoriesPromptBlock } from '../../phone/apps/lumiMeet/meetWechatSyncOnFriendLinked'

export type AnonymousQaWechatContext = {
  wechatAccountId: string | null
  playerIdentityId: string
  playerDisplayName: string
  apiConfig: ApiConfig | null
}

/** 定向提问 AI 语境：身份档案「姓名」（评论区 UI/@ 用微信昵称，见 qnaDirectedPlayerDisplay） */
export async function resolveDirectedQnaPlayerName(params: {
  wechatCtx: AnonymousQaWechatContext | null
  fallback?: string
}): Promise<string> {
  const fallback = params.fallback?.trim() || params.wechatCtx?.playerDisplayName?.trim() || '玩家'
  const pid = params.wechatCtx?.playerIdentityId?.trim()
  if (!pid || pid === '__none__') return fallback
  try {
    const identity = (await personaDb.getPlayerIdentity(pid)) as PlayerIdentity | null
    return identity?.name?.trim() || fallback
  } catch {
    return fallback
  }
}

export function resolveDirectedQnaPlayerNameFromPack(
  pack: { playerIdentity: PlayerIdentity | null },
  wechatCtx: AnonymousQaWechatContext | null,
  fallback?: string,
): string {
  return (
    pack.playerIdentity?.name?.trim() ||
    fallback?.trim() ||
    wechatCtx?.playerDisplayName?.trim() ||
    '玩家'
  )
}

export type AnonymousQaPersonaPromptPack = {
  character: Character | null
  playerIdentity: PlayerIdentity | null
  worldBackgroundPrompt?: string
  longTermMemoryNotes: string
  offlineDatingPlotsContext: string
  unsummarizedPrivateNotes: string
  unsummarizedGroupNotes: string
  meetEncounterMemoriesContext: string
  unsMeet: string
  sessionPlayerIdentityId: string
  conversationKey: string
}

/** 与微信私聊同一套：长期记忆、未总结私聊/群聊、线下剧情、遇见承接。 */
export async function buildAnonymousQaPersonaPromptPack(params: {
  characterId: string
  wechatCtx: AnonymousQaWechatContext
  relevanceHaystack: string
}): Promise<AnonymousQaPersonaPromptPack> {
  const cid = params.characterId.trim()
  const empty: AnonymousQaPersonaPromptPack = {
    character: null,
    playerIdentity: null,
    longTermMemoryNotes: '',
    offlineDatingPlotsContext: '',
    unsummarizedPrivateNotes: '',
    unsummarizedGroupNotes: '',
    meetEncounterMemoriesContext: '',
    unsMeet: '',
    sessionPlayerIdentityId: '__none__',
    conversationKey: '',
  }
  if (!cid || cid === WECHAT_LUMI_PEER_CHARACTER_ID) return empty

  const acc = params.wechatCtx.wechatAccountId?.trim() || ''
  const appPid = params.wechatCtx.playerIdentityId.trim() || '__none__'
  const sessionPid = await resolveActivePrivateChatSessionPlayerIdentityId({
    characterId: cid,
    wechatAccountId: acc || null,
    appPlayerIdentityId: appPid,
  })
  const conversationKey = acc
    ? wechatAccountPrivateConversationKey(acc, cid, sessionPid)
    : `${cid}::${sessionPid}`

  const character = (await personaDb.getCharacter(cid)) as Character | null
  const playerIdentity =
    sessionPid && sessionPid !== '__none__'
      ? ((await personaDb.getPlayerIdentity(sessionPid)) as PlayerIdentity | null)
      : null

  let worldBackgroundPrompt: string | undefined
  if (character?.worldBackgroundId?.trim()) {
    const bg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
    const block = formatWorldBackgroundForPrompt(bg)
    if (block.trim()) worldBackgroundPrompt = block
  }

  const fromMeet = isMeetSyncedCharacter(cid, character?.worldBooks)
  const chRow = character
  const digestBoundPid = chRow?.playerIdentityId

  const lineScope = normalizeMemoryPromptLineScope(acc || null, sessionPid)
  const apiOk =
    params.wechatCtx.apiConfig?.apiUrl?.trim() && params.wechatCtx.apiConfig?.apiKey?.trim()
      ? params.wechatCtx.apiConfig
      : null

  const [offlineDatingPlotsContext, meetEncounterMemoriesContext, unsMeet, unsPrivateRaw, unsGroup] =
    await Promise.all([
      loadOfflineDatingPlotsPromptBlock(cid, character?.name ?? null),
      fromMeet ? loadMeetEncounterMemoriesPromptBlock(cid) : Promise.resolve(''),
      fromMeet
        ? formatUnsummarizedMeetChatBlock({ characterId: cid, maxMessages: 120, maxChars: 3200 }).then((s) =>
            s.trim(),
          )
        : Promise.resolve(''),
      formatUnsummarizedPrivateChatBlock({
        conversationKey,
        maxMessages: 100,
        maxChars: 3200,
      }).then((s) => s.trim()),
      buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt({
        npcCharacterId: cid,
        sessionPlayerIdentityId: sessionPid,
        boundPlayerIdentityId: digestBoundPid,
        maxMessagesPerGroup: 50,
        charCap: 4200,
      }).then((s) => s.trim()),
    ])

  const scopeForWrap = lineScope ?? normalizeMemoryPromptLineScope(acc || null, sessionPid)
  const unsPrivateCurrent =
    unsPrivateRaw && scopeForWrap
      ? await wrapUnsummarizedPrivateBlockWithLineLabel(unsPrivateRaw, scopeForWrap, 'current')
      : unsPrivateRaw

  const hay = buildMemoryRelevanceHaystack([
    params.relevanceHaystack,
    offlineDatingPlotsContext.slice(0, 3600),
    meetEncounterMemoriesContext.slice(0, 2800),
    unsMeet.slice(0, 2800),
    unsPrivateCurrent.slice(0, 4800),
    unsGroup.slice(0, 2400),
  ])

  let longTermMemoryNotes = ''
  try {
    longTermMemoryNotes = (
      await formatCharacterMemoriesForPromptInjection(cid, hay, {
        apiConfig: apiOk,
        lineScope: (lineScope ?? scopeForWrap) ?? undefined,
      })
    ).trim()
  } catch {
    longTermMemoryNotes = ''
  }

  return {
    character,
    playerIdentity,
    worldBackgroundPrompt,
    longTermMemoryNotes,
    offlineDatingPlotsContext: offlineDatingPlotsContext.trim(),
    unsummarizedPrivateNotes: unsPrivateCurrent,
    unsummarizedGroupNotes: unsGroup,
    meetEncounterMemoriesContext: meetEncounterMemoriesContext.trim(),
    unsMeet,
    sessionPlayerIdentityId: sessionPid,
    conversationKey,
  }
}
