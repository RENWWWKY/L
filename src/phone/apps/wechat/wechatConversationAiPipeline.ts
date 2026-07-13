/**
 * 会话级 AI 回复管线状态（跨 ChatRoom 重挂载保持）。
 * 按 conversationKey 隔离，避免多角色/多会话互相抢占「正在输入」与发送锁。
 */

import {
  getStashedOpponentRevealJobCount,
  hasStashedOpponentRevealJobs,
} from './chatRoom/opponentRevealQueueStore'
import { resolveWeChatStorageConversationIdentity } from './wechatConversationKey'

export type ConversationFlushContext = {
  conversationKey: string
  conversationCharacterId: string
  personaCharacterId: string
  roomType: 'private' | 'group'
  groupId: string | null
  playerIdentityId: string
  peerNotifyTitle: string
  useLumiProjectAssistantPrompt: boolean
  isSelfMemoChat: boolean
}

export type ConversationPipelineFlags = {
  processingSend: boolean
  flushAiRepliesBusy: boolean
  aiCalling: boolean
  pendingAiReplies: number
  flushUiBusy: boolean
  awaitingAiKick: boolean
  opponentQueueStopped: boolean
  headerTyping: boolean
  pendingQueueCount: number
}

const processingSendKeys = new Set<string>()
const flushAiRepliesBusyKeys = new Set<string>()
const aiCallingKeys = new Set<string>()
const pendingAiRepliesByKey = new Map<string, number>()
const flushUiBusyKeys = new Set<string>()
const awaitingAiKickKeys = new Set<string>()
const opponentQueueStoppedKeys = new Set<string>()
const headerTypingKeys = new Set<string>()
const pendingQueueCountByKey = new Map<string, number>()
const flushContextByKey = new Map<string, ConversationFlushContext>()

const listeners = new Set<() => void>()

function notify(): void {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

function normKey(conversationKey: string): string {
  return conversationKey.trim()
}

function setFlag(set: Set<string>, conversationKey: string, active: boolean): void {
  const k = normKey(conversationKey)
  if (!k) return
  const had = set.has(k)
  if (active) set.add(k)
  else set.delete(k)
  if (had !== set.has(k)) notify()
}

export function subscribeWechatConversationAiPipeline(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 供逐条露出暂存队列等模块在 pipeline Map 未变时刷新顶栏订阅方 */
export function notifyWechatConversationAiPipeline(): void {
  notify()
}

export function getConversationPipelineFlags(conversationKey: string): ConversationPipelineFlags {
  const k = normKey(conversationKey)
  return {
    processingSend: k ? processingSendKeys.has(k) : false,
    flushAiRepliesBusy: k ? flushAiRepliesBusyKeys.has(k) : false,
    aiCalling: k ? aiCallingKeys.has(k) : false,
    pendingAiReplies: k ? (pendingAiRepliesByKey.get(k) ?? 0) : 0,
    flushUiBusy: k ? flushUiBusyKeys.has(k) : false,
    awaitingAiKick: k ? awaitingAiKickKeys.has(k) : false,
    opponentQueueStopped: k ? opponentQueueStoppedKeys.has(k) : false,
    headerTyping: k ? headerTypingKeys.has(k) : false,
    pendingQueueCount: k ? (pendingQueueCountByKey.get(k) ?? 0) + getStashedOpponentRevealJobCount(k) : 0,
  }
}

export function isConversationProcessingSend(conversationKey: string): boolean {
  return processingSendKeys.has(normKey(conversationKey))
}

export function setConversationProcessingSend(conversationKey: string, active: boolean): void {
  setFlag(processingSendKeys, conversationKey, active)
}

export function isConversationFlushAiRepliesBusy(conversationKey: string): boolean {
  return flushAiRepliesBusyKeys.has(normKey(conversationKey))
}

export function setConversationFlushAiRepliesBusy(conversationKey: string, active: boolean): void {
  setFlag(flushAiRepliesBusyKeys, conversationKey, active)
}

export function setConversationAiCalling(conversationKey: string, active: boolean): void {
  setFlag(aiCallingKeys, conversationKey, active)
}

export function getConversationPendingAiReplies(conversationKey: string): number {
  return pendingAiRepliesByKey.get(normKey(conversationKey)) ?? 0
}

export function setConversationPendingAiReplies(conversationKey: string, count: number): void {
  const k = normKey(conversationKey)
  if (!k) return
  const next = Math.max(0, Math.floor(count))
  const prev = pendingAiRepliesByKey.get(k) ?? 0
  if (next <= 0) pendingAiRepliesByKey.delete(k)
  else pendingAiRepliesByKey.set(k, next)
  if (prev !== next) notify()
}

export function bumpConversationPendingAiReplies(conversationKey: string, delta = 1): void {
  const k = normKey(conversationKey)
  if (!k) return
  const prev = pendingAiRepliesByKey.get(k) ?? 0
  setConversationPendingAiReplies(k, prev + delta)
}

export function setConversationFlushUiBusy(conversationKey: string, active: boolean): void {
  setFlag(flushUiBusyKeys, conversationKey, active)
}

export function setConversationAwaitingAiKick(conversationKey: string, active: boolean): void {
  setFlag(awaitingAiKickKeys, conversationKey, active)
}

export function isConversationOpponentQueueStopped(conversationKey: string): boolean {
  return opponentQueueStoppedKeys.has(normKey(conversationKey))
}

export function setConversationOpponentQueueStop(conversationKey: string, stopped: boolean): void {
  setFlag(opponentQueueStoppedKeys, conversationKey, stopped)
}

export function setConversationHeaderTyping(conversationKey: string, typing: boolean): void {
  setFlag(headerTypingKeys, conversationKey, typing)
}

export function setConversationPendingQueueCount(conversationKey: string, count: number): void {
  const k = normKey(conversationKey)
  if (!k) return
  const next = Math.max(0, Math.floor(count))
  const prev = pendingQueueCountByKey.get(k) ?? 0
  if (next <= 0) pendingQueueCountByKey.delete(k)
  else pendingQueueCountByKey.set(k, next)
  if (prev !== next) notify()
}

export function setConversationFlushContext(ctx: ConversationFlushContext): void {
  const k = normKey(ctx.conversationKey)
  if (!k) return
  flushContextByKey.set(k, { ...ctx, conversationKey: k })
  notify()
}

export function getConversationFlushContext(conversationKey: string): ConversationFlushContext | null {
  const k = normKey(conversationKey)
  if (!k) return null
  return flushContextByKey.get(k) ?? null
}

/**
 * 后台 flush 时绑定发起会话的 character/key，避免用户已切到其它角色后回落到当前可见 props。
 */
export function resolveBoundConversationFlushContext(
  flushConversationKey: string,
  stored: ConversationFlushContext | null,
  liveSnapshot: ConversationFlushContext | null,
  allowLiveFallback: boolean,
): ConversationFlushContext {
  const key = normKey(flushConversationKey)
  if (stored && normKey(stored.conversationKey) === key) return { ...stored, conversationKey: key }

  const identity = resolveWeChatStorageConversationIdentity(key)
  if (identity?.kind === 'private') {
    return {
      conversationKey: key,
      conversationCharacterId: identity.characterId,
      personaCharacterId: identity.characterId,
      roomType: 'private',
      groupId: null,
      playerIdentityId: identity.sessionPlayerId,
      peerNotifyTitle: stored?.peerNotifyTitle ?? liveSnapshot?.peerNotifyTitle ?? '对方',
      useLumiProjectAssistantPrompt:
        stored?.useLumiProjectAssistantPrompt ?? liveSnapshot?.useLumiProjectAssistantPrompt ?? false,
      isSelfMemoChat: stored?.isSelfMemoChat ?? liveSnapshot?.isSelfMemoChat ?? false,
    }
  }
  if (identity?.kind === 'group') {
    return {
      conversationKey: key,
      conversationCharacterId:
        stored?.conversationCharacterId ?? liveSnapshot?.conversationCharacterId ?? '',
      personaCharacterId: stored?.personaCharacterId ?? liveSnapshot?.personaCharacterId ?? '',
      roomType: 'group',
      groupId: identity.groupId,
      playerIdentityId: identity.sessionPlayerId,
      peerNotifyTitle: stored?.peerNotifyTitle ?? liveSnapshot?.peerNotifyTitle ?? '群聊',
      useLumiProjectAssistantPrompt: false,
      isSelfMemoChat: false,
    }
  }
  if (allowLiveFallback && liveSnapshot) {
    return { ...liveSnapshot, conversationKey: key }
  }
  if (stored) return { ...stored, conversationKey: key }
  return {
    conversationKey: key,
    conversationCharacterId: liveSnapshot?.conversationCharacterId ?? '',
    personaCharacterId: liveSnapshot?.personaCharacterId ?? '',
    roomType: liveSnapshot?.roomType ?? 'private',
    groupId: liveSnapshot?.groupId ?? null,
    playerIdentityId: liveSnapshot?.playerIdentityId ?? '__none__',
    peerNotifyTitle: liveSnapshot?.peerNotifyTitle ?? '对方',
    useLumiProjectAssistantPrompt: liveSnapshot?.useLumiProjectAssistantPrompt ?? false,
    isSelfMemoChat: liveSnapshot?.isSelfMemoChat ?? false,
  }
}

export function clearConversationFlushContext(conversationKey: string): void {
  const k = normKey(conversationKey)
  if (!k) return
  if (flushContextByKey.delete(k)) notify()
}

/** 当前会话是否应禁用发送（不含逐条露出队列，由 ChatRoom 本地 job 列表补充判断） */
export function isConversationAiPipelineBlockingSend(conversationKey: string): boolean {
  const flags = getConversationPipelineFlags(conversationKey)
  return (
    flags.processingSend ||
    flags.flushAiRepliesBusy ||
    flags.aiCalling ||
    flags.pendingAiReplies > 0 ||
    flags.flushUiBusy ||
    flags.awaitingAiKick
  )
}

/** 顶栏「对方正在输入」：仅真实 AI 回复/露出中，不含用户发消息瞬间的 awaitingAiKick / processingSend */
export function isConversationPeerReplyingVisible(conversationKey: string): boolean {
  const flags = getConversationPipelineFlags(conversationKey)
  if (hasStashedOpponentRevealJobs(conversationKey)) return true
  return (
    flags.flushAiRepliesBusy ||
    flags.aiCalling ||
    flags.pendingAiReplies > 0 ||
    flags.flushUiBusy
  )
}

/** 后台通知：任一会话顶栏「对方正在输入」或待露出队列非空 */
export function isAnyConversationPeerTypingForNotify(): boolean {
  if (headerTypingKeys.size > 0) return true
  for (const n of pendingQueueCountByKey.values()) {
    if (n > 0) return true
  }
  if (flushAiRepliesBusyKeys.size > 0) return true
  if (aiCallingKeys.size > 0) return true
  return false
}
