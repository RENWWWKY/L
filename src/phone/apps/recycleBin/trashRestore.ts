import type {
  Character,
  CharacterMemory,
  CharacterDanmakuSettingsRow,
  ChatConversationSettingsRow,
  GroupChatRow,
  HeartWhisperRow,
  NetworkGraphViewRecord,
  PlayerIdentity,
  PlayerNetworkLink,
  Relationship,
  WeChatChatMessage,
  WorldBackground,
} from '../wechat/newFriendsPersona/types'
import type { CharacterFullTrashPayload } from './archiveCharacterDeletion'
import type { IndexedTrashEntry } from './indexedTrashTypes'
import type { FriendRequestRow } from '../wechat/newFriendsPersona/idb'
import { personaDb } from '../wechat/newFriendsPersona/idb'

const WECHAT_DATING_ARCHIVES_KV_KEY = 'wechat-dating-archives-v1'

export type RestoreIndexedTrashResult = { ok: true } | { ok: false; message: string }

async function applyDatingArchiveEntry(rootId: string, entry: unknown | null): Promise<void> {
  if (entry == null) return
  const raw = await personaDb.getPhoneKv(WECHAT_DATING_ARCHIVES_KV_KEY)
  const arch: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {}
  arch[rootId] = entry
  await personaDb.setPhoneKv(WECHAT_DATING_ARCHIVES_KV_KEY, arch)
}

/**
 * 从回收站恢复一条快照；成功后会从回收站移除该条目（并触发 indexed-trash-changed）。
 */
export async function restoreIndexedTrashEntry(entry: IndexedTrashEntry): Promise<RestoreIndexedTrashResult> {
  try {
    await personaDb.runWithIndexedTrashSuspended(async () => {
      switch (entry.kind) {
        case 'wechat-message': {
          const { message } = entry.payload as { message: WeChatChatMessage }
          await personaDb.appendWeChatChatMessage({ ...message, quiet: true })
          break
        }
        case 'wechat-conversation': {
          const p = entry.payload as {
            conversationKey: string
            messages: WeChatChatMessage[]
            conversationSettings: ChatConversationSettingsRow | null
            uiClearOnly?: boolean
          }
          /** 仅界面清空：消息仍在库里，恢复时撤销「仅 UI 隐藏」即可 */
          if (p.uiClearOnly) {
            if (p.conversationSettings) {
              await personaDb.upsertChatConversationSettings({
                conversationKey: p.conversationSettings.conversationKey,
                peerCharacterId: p.conversationSettings.peerCharacterId,
                playerIdentityId: p.conversationSettings.playerIdentityId,
                isPinned: p.conversationSettings.isPinned,
                isMuted: p.conversationSettings.isMuted,
                hiddenFromMessageList: p.conversationSettings.hiddenFromMessageList,
                notifyEnabled: p.conversationSettings.notifyEnabled,
                showThinkingChain: p.conversationSettings.showThinkingChain,
                forwardHistoryCardEnabled: p.conversationSettings.forwardHistoryCardEnabled,
                profileImageChangeEnabled: p.conversationSettings.profileImageChangeEnabled,
                internetMemeLexiconEnabled: p.conversationSettings.internetMemeLexiconEnabled,
                isDanmakuMode: p.conversationSettings.isDanmakuMode,
                showGroupMemberNicknameInChat: p.conversationSettings.showGroupMemberNicknameInChat,
                showGroupRankBadgesInChat: p.conversationSettings.showGroupRankBadgesInChat,
                chatBackground: p.conversationSettings.chatBackground,
                lastMessageTime: p.conversationSettings.lastMessageTime,
                clearUiOnlyHiddenBeforeTimestamp: true,
              })
            } else {
              const cur = await personaDb.getChatConversationSettings(p.conversationKey)
              if (cur) {
                await personaDb.upsertChatConversationSettings({
                  conversationKey: cur.conversationKey,
                  peerCharacterId: cur.peerCharacterId,
                  playerIdentityId: cur.playerIdentityId,
                  clearUiOnlyHiddenBeforeTimestamp: true,
                })
              }
            }
            break
          }
          for (const m of p.messages) {
            await personaDb.appendWeChatChatMessage({ ...m, quiet: true })
          }
          if (p.conversationSettings) {
            await personaDb.upsertChatConversationSettings({
              conversationKey: p.conversationSettings.conversationKey,
              peerCharacterId: p.conversationSettings.peerCharacterId,
              playerIdentityId: p.conversationSettings.playerIdentityId,
              isPinned: p.conversationSettings.isPinned,
              isMuted: p.conversationSettings.isMuted,
              hiddenFromMessageList: p.conversationSettings.hiddenFromMessageList,
              notifyEnabled: p.conversationSettings.notifyEnabled,
              showThinkingChain: p.conversationSettings.showThinkingChain,
              forwardHistoryCardEnabled: p.conversationSettings.forwardHistoryCardEnabled,
              profileImageChangeEnabled: p.conversationSettings.profileImageChangeEnabled,
              internetMemeLexiconEnabled: p.conversationSettings.internetMemeLexiconEnabled,
              isDanmakuMode: p.conversationSettings.isDanmakuMode,
              showGroupMemberNicknameInChat: p.conversationSettings.showGroupMemberNicknameInChat,
              showGroupRankBadgesInChat: p.conversationSettings.showGroupRankBadgesInChat,
              chatBackground: p.conversationSettings.chatBackground,
              lastMessageTime: p.conversationSettings.lastMessageTime,
            })
          }
          break
        }
        case 'character-memory': {
          const { memory } = entry.payload as { memory: CharacterMemory }
          await personaDb.upsertCharacterMemory(memory)
          break
        }
        case 'story-timeline-archive': {
          const p = entry.payload as {
            characterId: string
            rows: import('../wechat/memory/storyTimelineTypes').StoryTimelinePlotRow[]
            state: import('../wechat/memory/storyTimelineTypes').StoryTimelineState | null
          }
          for (const row of p.rows ?? []) {
            await personaDb.upsertStoryTimelinePlotRow(row)
          }
          if (p.state) {
            await personaDb.putStoryTimelineState(p.state)
          }
          break
        }
        case 'friend-request': {
          const { friendRequest } = entry.payload as { friendRequest: FriendRequestRow }
          await personaDb.upsertFriendRequest(friendRequest)
          break
        }
        case 'phone-kv': {
          const { key, value } = entry.payload as { key: string; value: unknown }
          await personaDb.setPhoneKv(key, value)
          break
        }
        case 'world-background': {
          const p = entry.payload as {
            worldBackground: WorldBackground
            touchedCharacters: Character[]
            touchedIdentities: PlayerIdentity[]
          }
          await personaDb.upsertWorldBackground(p.worldBackground)
          for (const c of p.touchedCharacters) {
            await personaDb.upsertCharacter(c)
          }
          for (const id of p.touchedIdentities) {
            await personaDb.upsertPlayerIdentity(id)
          }
          break
        }
        case 'player-identity': {
          const p = entry.payload as {
            identity: PlayerIdentity | null
            removedRelationships: Relationship[]
            hadCurrentIdentity: boolean
          }
          if (p.identity) await personaDb.upsertPlayerIdentity(p.identity)
          if (p.removedRelationships.length) await personaDb.bulkPutRelationships(p.removedRelationships)
          if (p.hadCurrentIdentity && p.identity?.id) await personaDb.setCurrentIdentityId(p.identity.id)
          break
        }
        case 'group-chat': {
          const payload = entry.payload as {
            group: GroupChatRow | null
            conversationSettings: ChatConversationSettingsRow | null
            messages: WeChatChatMessage[]
          }
          if (payload.group) await personaDb.putGroupChat(payload.group)
          for (const m of payload.messages) {
            await personaDb.appendWeChatChatMessage({ ...m, quiet: true })
          }
          if (payload.conversationSettings) {
            await personaDb.upsertChatConversationSettings({
              conversationKey: payload.conversationSettings.conversationKey,
              peerCharacterId: payload.conversationSettings.peerCharacterId,
              playerIdentityId: payload.conversationSettings.playerIdentityId,
              isPinned: payload.conversationSettings.isPinned,
              isMuted: payload.conversationSettings.isMuted,
              hiddenFromMessageList: payload.conversationSettings.hiddenFromMessageList,
              notifyEnabled: payload.conversationSettings.notifyEnabled,
              showThinkingChain: payload.conversationSettings.showThinkingChain,
              forwardHistoryCardEnabled: payload.conversationSettings.forwardHistoryCardEnabled,
              profileImageChangeEnabled: payload.conversationSettings.profileImageChangeEnabled,
              internetMemeLexiconEnabled: payload.conversationSettings.internetMemeLexiconEnabled,
              isDanmakuMode: payload.conversationSettings.isDanmakuMode,
              showGroupMemberNicknameInChat: payload.conversationSettings.showGroupMemberNicknameInChat,
              showGroupRankBadgesInChat: payload.conversationSettings.showGroupRankBadgesInChat,
              chatBackground: payload.conversationSettings.chatBackground,
              lastMessageTime: payload.conversationSettings.lastMessageTime,
            })
          }
          break
        }
        case 'npc-only': {
          const p = entry.payload as {
            character: Character | null
            graphView: NetworkGraphViewRecord | null
            playerLinksRow: { rootCharacterId: string; links: PlayerNetworkLink[]; updatedAt: number } | null
          }
          if (p.character) await personaDb.upsertCharacter(p.character)
          if (p.graphView) await personaDb.putNetworkGraphView(p.graphView)
          if (p.playerLinksRow) {
            await personaDb.putPlayerNetworkLinks(p.playerLinksRow.rootCharacterId, p.playerLinksRow.links)
          }
          break
        }
        case 'character-soft': {
          const p = entry.payload as {
            messages: WeChatChatMessage[]
            memories: CharacterMemory[]
            graphViews: NetworkGraphViewRecord[]
            conversationSettings: ChatConversationSettingsRow[]
            danmakuRows: CharacterDanmakuSettingsRow[]
            playerLinksRows: Array<{ rootCharacterId: string; links: PlayerNetworkLink[]; updatedAt: number }>
            heartWhispers: HeartWhisperRow[]
            datingArchiveEntries: Record<string, unknown>
          }
          for (const m of p.messages) {
            await personaDb.appendWeChatChatMessage({ ...m, quiet: true })
          }
          for (const mem of p.memories) {
            await personaDb.upsertCharacterMemory(mem)
          }
          for (const gv of p.graphViews) {
            await personaDb.putNetworkGraphView(gv)
          }
          for (const row of p.conversationSettings) {
            await personaDb.upsertChatConversationSettings({
              conversationKey: row.conversationKey,
              peerCharacterId: row.peerCharacterId,
              playerIdentityId: row.playerIdentityId,
              isPinned: row.isPinned,
              isMuted: row.isMuted,
              hiddenFromMessageList: row.hiddenFromMessageList,
              notifyEnabled: row.notifyEnabled,
              showThinkingChain: row.showThinkingChain,
              forwardHistoryCardEnabled: row.forwardHistoryCardEnabled,
              profileImageChangeEnabled: row.profileImageChangeEnabled,
              internetMemeLexiconEnabled: row.internetMemeLexiconEnabled,
              isDanmakuMode: row.isDanmakuMode,
              showGroupMemberNicknameInChat: row.showGroupMemberNicknameInChat,
              showGroupRankBadgesInChat: row.showGroupRankBadgesInChat,
              chatBackground: row.chatBackground,
              lastMessageTime: row.lastMessageTime,
            })
          }
          for (const d of p.danmakuRows) {
            await personaDb.putCharacterDanmakuSettings(d)
          }
          for (const pl of p.playerLinksRows) {
            await personaDb.putPlayerNetworkLinks(pl.rootCharacterId, pl.links)
          }
          for (const hw of p.heartWhispers) {
            if (hw.data) await personaDb.putHeartWhisper(hw.characterId, hw.data)
          }
          const entries = p.datingArchiveEntries ?? {}
          for (const rid of Object.keys(entries)) {
            await applyDatingArchiveEntry(rid, entries[rid])
          }
          break
        }
        case 'character-full': {
          const raw = entry.payload as CharacterFullTrashPayload
          for (const c of raw.characters) {
            await personaDb.upsertCharacter(c)
          }
          if (raw.relationships.length) await personaDb.bulkPutRelationships(raw.relationships)
          for (const m of raw.messages) {
            await personaDb.appendWeChatChatMessage({ ...m, quiet: true })
          }
          for (const mem of raw.memories) {
            await personaDb.upsertCharacterMemory(mem)
          }
          await applyDatingArchiveEntry(raw.rootCharacterId, raw.datingArchiveEntry)
          for (const row of raw.conversationSettings) {
            await personaDb.upsertChatConversationSettings({
              conversationKey: row.conversationKey,
              peerCharacterId: row.peerCharacterId,
              playerIdentityId: row.playerIdentityId,
              isPinned: row.isPinned,
              isMuted: row.isMuted,
              hiddenFromMessageList: row.hiddenFromMessageList,
              notifyEnabled: row.notifyEnabled,
              showThinkingChain: row.showThinkingChain,
              forwardHistoryCardEnabled: row.forwardHistoryCardEnabled,
              profileImageChangeEnabled: row.profileImageChangeEnabled,
              internetMemeLexiconEnabled: row.internetMemeLexiconEnabled,
              isDanmakuMode: row.isDanmakuMode,
              showGroupMemberNicknameInChat: row.showGroupMemberNicknameInChat,
              showGroupRankBadgesInChat: row.showGroupRankBadgesInChat,
              chatBackground: row.chatBackground,
              lastMessageTime: row.lastMessageTime,
            })
          }
          for (const d of raw.danmakuRows) {
            await personaDb.putCharacterDanmakuSettings(d)
          }
          for (const gv of raw.graphViews) {
            await personaDb.putNetworkGraphView(gv)
          }
          if (raw.playerLinksRow) {
            await personaDb.putPlayerNetworkLinks(raw.playerLinksRow.rootCharacterId, raw.playerLinksRow.links)
          }
          break
        }
        default:
          throw new Error(`暂不支持的回收站类型：${entry.kind}`)
      }
    })

    await personaDb.removeIndexedTrashEntry(entry.id)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}
