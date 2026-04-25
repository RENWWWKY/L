import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

import { Pressable } from '../../components/Pressable'
import { WECHAT_LUMI_PEER_CHARACTER_ID, wechatConversationKey } from './wechatConversationKey'
import type { WeChatChatMessage } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'
import { resolveWeChatCurrentTimeMs } from './time/wechatTimeUtils'

const MERGE_FORWARD_PREFIX = '__wx_merge_forward__:' as const

type Thread =
  | { kind: 'lumi'; name: string; avatarUrl: string; conversationKey: string; peerCharacterId: string }
  | {
      kind: 'persona'
      name: string
      avatarUrl?: string
      conversationKey: string
      peerCharacterId: string
      characterId: string
    }

type Contact = {
  id: string
  characterId: string
  remarkName: string
  avatarUrl?: string
}

const RECENT_FORWARD_KV_KEY = 'wx_recent_forwards_v1'

export type WeChatForwardMode = 'single' | 'multi-item' | 'multi-merge'

export type WeChatForwardPayload = {
  mode: WeChatForwardMode
  messages: WeChatChatMessage[]
  /** 仅合并转发需要：生成聊天记录卡片标题 */
  mergeTitle?: { userName: string; peerName: string }
}

function clampRecent(keys: string[], max = 12) {
  const out: string[] = []
  for (const k of keys) {
    const t = k.trim()
    if (!t) continue
    if (out.includes(t)) continue
    out.push(t)
    if (out.length >= max) break
  }
  return out
}

function scoreMatch(hay: string, q: string): number {
  const idx = hay.indexOf(q)
  if (idx < 0) return -1
  // 越靠前越好；越短越好
  return 10_000 - idx * 100 - hay.length
}

function splitToLines(s: string, maxCharsPerLine: number): string[] {
  const text = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return []
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    out.push(text.slice(i, i + maxCharsPerLine))
    i += maxCharsPerLine
  }
  return out
}

function buildMergePreviewLines(params: {
  messages: WeChatChatMessage[]
  userName: string
  peerName: string
}): string[] {
  const lines: string[] = []
  const { messages, userName, peerName } = params
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  for (const m of sorted) {
    const who = m.type === 'player' ? userName : peerName
    const text = (m.content ?? '').trim() || (m.images?.length ? '[图片]' : '')
    const prefix = `${who}：`
    const chunks = splitToLines(text, 18)
    if (chunks.length === 0) chunks.push('')
    for (let i = 0; i < chunks.length; i += 1) {
      const body = i === 0 ? `${prefix}${chunks[i]}` : `  ${chunks[i]}`
      lines.push(body)
      if (lines.length >= 4) {
        lines[3] = lines[3].endsWith('…') ? lines[3] : `${lines[3]}…`
        return lines.slice(0, 4)
      }
    }
  }
  return lines.slice(0, 4)
}

export function WeChatForwardSelectChatScreen({
  open,
  forward,
  threads,
  contacts,
  playerIdentityId,
  currentConversationKey,
  lumiAvatarUrl,
  onClose,
  onPickChat,
  title = '选择聊天',
  recentTitle = '最近转发',
  listTitle = '最近聊天',
  onPickTarget,
}: {
  open: boolean
  forward: WeChatForwardPayload
  threads: Thread[]
  // 预留：用于“创建聊天/更丰富的搜索”
  contacts: Contact[]
  playerIdentityId: string
  currentConversationKey: string | null
  lumiAvatarUrl: string
  onClose: () => void
  onPickChat: (chat: { kind: 'lumi' } | { kind: 'persona'; characterId: string }) => void
  title?: string
  recentTitle?: string
  listTitle?: string
  onPickTarget?: (chat: { kind: 'lumi' } | { kind: 'persona'; characterId: string }) => void | Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [recentForwardKeys, setRecentForwardKeys] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setDebounced('')
    void personaDb.getPhoneKv(RECENT_FORWARD_KV_KEY).then((v) => {
      const list = Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : []
      setRecentForwardKeys(clampRecent(list, 12))
    })
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 300)
    return () => window.clearTimeout(id)
  }, [query])

  const allTargets = useMemo(() => {
    // 微信一致：搜索要覆盖所有联系人；最近聊天以 threads 为主，但这里统一输出可点击的“会话目标”列表
    const byKey = new Map<string, Thread>()
    for (const t of threads) {
      const ck = t?.conversationKey?.trim()
      if (!ck) continue
      if (!byKey.has(ck)) byKey.set(ck, t)
    }
    for (const c of contacts) {
      const cid = c.characterId?.trim()
      if (!cid) continue
      const ck = wechatConversationKey(cid, playerIdentityId)
      if (byKey.has(ck)) continue
      byKey.set(ck, {
        kind: 'persona',
        name: c.remarkName || '聊天',
        avatarUrl: c.avatarUrl,
        conversationKey: ck,
        peerCharacterId: cid,
        characterId: cid,
      })
    }
    // 稳定顺序：先 threads（最近聊天顺序），再补 contacts
    const out: Thread[] = []
    const seen = new Set<string>()
    for (const t of threads) {
      const ck = t?.conversationKey?.trim()
      if (!ck || seen.has(ck)) continue
      const mapped = byKey.get(ck)
      if (mapped) {
        out.push(mapped)
        seen.add(ck)
      }
    }
    for (const [ck, t] of byKey.entries()) {
      if (seen.has(ck)) continue
      out.push(t)
      seen.add(ck)
    }
    return out
  }, [threads, contacts, playerIdentityId])

  const filteredThreads = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    if (!q) return null
    const scored = allTargets
      .map((t) => {
        const name = t.name.trim().toLowerCase()
        const s = scoreMatch(name, q)
        return { t, s }
      })
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.t)
    return scored
  }, [allTargets, debounced])

  const recentForwardTargets = useMemo(() => {
    const byKey = new Map(allTargets.map((t) => [t.conversationKey, t]))
    return recentForwardKeys.map((k) => byKey.get(k)).filter((x): x is Thread => !!x)
  }, [allTargets, recentForwardKeys])

  const forwardTo = async (t: Thread) => {
    if (onPickTarget) {
      const picked = t.kind === 'lumi' ? { kind: 'lumi' as const } : { kind: 'persona' as const, characterId: t.characterId }
      const nextKeys = clampRecent([t.conversationKey, ...recentForwardKeys], 12)
      setRecentForwardKeys(nextKeys)
      void personaDb.setPhoneKv(RECENT_FORWARD_KV_KEY, nextKeys)
      await onPickTarget(picked)
      return
    }
    const peerId = t.kind === 'lumi' ? WECHAT_LUMI_PEER_CHARACTER_ID : t.characterId
    const [gs, roleTime] = await Promise.all([personaDb.getGlobalSettings(), personaDb.getCharacterTimeSettings(peerId)])
    const now = resolveWeChatCurrentTimeMs(roleTime?.config ?? gs.globalTimeConfig)
    const conversationKey = wechatConversationKey(peerId, playerIdentityId)
    const msgs = forward.messages ?? []
    if (forward.mode === 'multi-item') {
      const sorted = [...msgs].sort((a, b) => a.timestamp - b.timestamp)
      for (let i = 0; i < sorted.length; i += 1) {
        const m = sorted[i]!
        const ts = now + i
        await personaDb.appendWeChatChatMessage({
          id: `wxm-${ts}-fwd-${Math.random().toString(36).slice(2, 8)}`,
          characterId: peerId,
          playerIdentityId,
          type: 'player',
          content: m.content ?? '',
          images: m.images,
          timestamp: ts,
          isRead: true,
          conversationKey,
        })
      }
    } else if (forward.mode === 'multi-merge') {
      const userName = forward.mergeTitle?.userName?.trim() || '我'
      const peerName = forward.mergeTitle?.peerName?.trim() || '对方'
      const title = `${userName} 和 ${peerName} 的聊天记录`
      const previewLines = buildMergePreviewLines({ messages: msgs, userName, peerName })
      const payload = {
        title,
        previewLines,
        senderNames: { userId: 'self', name: userName },
        messageList: msgs.map((m) => ({
          id: m.id,
          type: m.type,
          content: m.content ?? '',
          images: m.images,
          timestamp: m.timestamp,
        })),
      }
      await personaDb.appendWeChatChatMessage({
        id: `wxm-${now}-fwdm-${Math.random().toString(36).slice(2, 8)}`,
        characterId: peerId,
        playerIdentityId,
        type: 'player',
        content: `${MERGE_FORWARD_PREFIX}${JSON.stringify(payload)}`,
        timestamp: now,
        isRead: true,
        conversationKey,
      })
    } else {
      const m = msgs[0]
      await personaDb.appendWeChatChatMessage({
        id: `wxm-${now}-fwd-${Math.random().toString(36).slice(2, 8)}`,
        characterId: peerId,
        playerIdentityId,
        type: 'player',
        content: m?.content ?? '',
        images: m?.images,
        timestamp: now,
        isRead: true,
        conversationKey,
      })
    }

    const nextKeys = clampRecent([conversationKey, ...recentForwardKeys], 12)
    setRecentForwardKeys(nextKeys)
    void personaDb.setPhoneKv(RECENT_FORWARD_KV_KEY, nextKeys)

    // 关闭并跳转到目标聊天室
    onClose()
    onPickChat(t.kind === 'lumi' ? { kind: 'lumi' } : { kind: 'persona', characterId: t.characterId })
  }

  if (!open) return null

  const list = filteredThreads ?? allTargets

  return (
    <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col bg-[#f5f5f5]">
      {/* 顶部导航栏 */}
      <div
        className="flex shrink-0 items-center border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex w-full items-center">
          <Pressable
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black active:bg-black/5"
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </Pressable>
          <h1 className="min-w-0 flex-1 text-center text-[18px] font-bold text-black">{title}</h1>
          <Pressable
            type="button"
            aria-label="多选（预留）"
            onClick={() => {
              // 预留：多选转发
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black active:bg-black/5"
          >
            <span className="text-[16px] font-medium">多选</span>
          </Pressable>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 rounded-[12px] bg-white px-3 py-3">
          <Search size={16} color="#8e8e8e" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-black outline-none placeholder:text-[#8e8e8e]"
          />
        </div>
      </div>

      {/* 最近转发 / 最近联系人 */}
      <div className="px-4 pt-5">
        <div className="text-[14px] text-[#8e8e8e]">{recentTitle}</div>
      </div>
      <div className="mt-3">
        <div className="flex gap-4 overflow-x-auto px-4 pb-2 [-webkit-overflow-scrolling:touch]">
          {recentForwardTargets.map((t) => {
            const avatar = t.kind === 'lumi' ? t.avatarUrl : t.avatarUrl
            return (
              <Pressable
                key={t.conversationKey}
                type="button"
                className="w-[60px] shrink-0"
                onClick={() => void forwardTo(t)}
              >
                <div
                  className="h-[60px] w-[60px] overflow-hidden rounded-full border border-[#e5e5e5] bg-white"
                  aria-hidden
                >
                  {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="mt-1 line-clamp-2 text-center text-[12px] leading-snug text-black">{t.name}</div>
              </Pressable>
            )
          })}
          <div className="w-[60px] shrink-0">
            <div
              className="flex h-[60px] w-[60px] items-center justify-center rounded-full border border-dashed border-[#d9d9d9] bg-transparent text-[18px] text-[#999]"
              aria-hidden
            >
              –
            </div>
            <div className="mt-1 h-[30px]" aria-hidden />
          </div>
        </div>
      </div>

      {/* 最近聊天 + 搜索结果 */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-[14px] text-[#8e8e8e]">{debounced.trim() ? '搜索结果' : listTitle}</div>
          <div className="w-10 shrink-0" aria-hidden />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white pb-[20px]">
          {list.length === 0 ? (
            <div className="px-4 py-8 text-center text-[14px] text-[#8e8e8e]">未找到相关联系人</div>
          ) : (
            list.map((t) => {
              const avatar = t.kind === 'lumi' ? lumiAvatarUrl : t.avatarUrl
              const isCurrent = currentConversationKey != null && t.conversationKey === currentConversationKey
              return (
                <Pressable
                  key={t.conversationKey}
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-[#f0f0f0] px-4 py-3 text-left active:bg-[#f5f5f5]"
                  onClick={() => void forwardTo(t)}
                >
                  <div
                    className="h-10 w-10 overflow-hidden rounded-full border border-[#e5e5e5] bg-white"
                    aria-hidden
                  >
                    {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-semibold text-black">{t.name}</div>
                  </div>
                  {isCurrent ? <div className="text-[14px] text-[#8e8e8e]">当前聊天</div> : null}
                </Pressable>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

