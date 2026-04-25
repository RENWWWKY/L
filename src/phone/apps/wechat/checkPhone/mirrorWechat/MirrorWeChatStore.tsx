import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { SpyWechatGeneratedData } from '../spyWechatAi'
import { loadMirrorWeChatState, saveMirrorWeChatState } from './mirrorWechatStorage'
import type { MirrorWeChatState } from './types'

type MirrorWeChatStoreValue = {
  state: MirrorWeChatState
  /** IndexedDB 水合完成前勿依赖本地缓存的完整性（避免竞态） */
  hydrated: boolean
  mergeGenerated: (scope: 'contacts' | 'chats' | 'moments' | 'me', data: SpyWechatGeneratedData, mode?: 'generate' | 'update') => void
  reset: () => void
}

const initialState: MirrorWeChatState = {
  profile: null,
  contacts: [],
  moments: [],
  bills: [],
  affectionCards: [],
  lastGeneratedAt: {},
}

const MirrorWeChatStoreContext = createContext<MirrorWeChatStoreValue | null>(null)

function mergeChatMessages(
  prev: SpyWechatGeneratedData['contacts'][number]['messages'],
  next: SpyWechatGeneratedData['contacts'][number]['messages'],
): SpyWechatGeneratedData['contacts'][number]['messages'] {
  const all = [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [])]
  const dedup = new Map<string, SpyWechatGeneratedData['contacts'][number]['messages'][number]>()
  for (const m of all) {
    const key = `${m.from}|${m.timestamp}|${m.content}|${JSON.stringify(m.special || null)}`
    if (!dedup.has(key)) dedup.set(key, m)
  }
  return Array.from(dedup.values()).sort((a, b) => a.timestamp - b.timestamp)
}

function mergeContactsForUpdate(
  prev: MirrorWeChatState['contacts'],
  incoming: MirrorWeChatState['contacts'],
): MirrorWeChatState['contacts'] {
  const incomingById = new Map(incoming.map((c) => [c.id, c] as const))
  const merged = prev.map((oldC) => {
    const nextC = incomingById.get(oldC.id)
    if (!nextC) return oldC
    incomingById.delete(oldC.id)
    return {
      ...oldC,
      // 更新模式：优先保留现有联系人主体与 id，仅更新可变字段
      // 强保护：已有联系人昵称视作“身份锚点”，更新时不允许被模型改成另一个人
      nickname: oldC.nickname,
      remarkName: nextC.remarkName || oldC.remarkName,
      isStarred: typeof nextC.isStarred === 'boolean' ? nextC.isStarred : oldC.isStarred,
      blocked: typeof nextC.blocked === 'boolean' ? nextC.blocked : oldC.blocked,
      relationshipNote: nextC.relationshipNote || oldC.relationshipNote,
      remarkWhy: nextC.remarkWhy || oldC.remarkWhy,
      avatarUrl: oldC.avatarUrl || nextC.avatarUrl,
      messages: mergeChatMessages(oldC.messages, nextC.messages),
    }
  })
  // 仅追加“确实新出现”的联系人
  for (const c of incomingById.values()) merged.push(c)
  return merged
}

export function MirrorWeChatStoreProvider({
  children,
  characterId,
  playerIdentityId,
}: {
  children: ReactNode
  characterId: string
  playerIdentityId: string
}) {
  const [state, setState] = useState<MirrorWeChatState>(initialState)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    setHydrated(false)
    setState(initialState)
    void (async () => {
      const loaded = await loadMirrorWeChatState(characterId, playerIdentityId)
      if (cancelled) return
      if (loaded) {
        setState(loaded)
      } else {
        setState(initialState)
      }
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [characterId, playerIdentityId])

  useEffect(() => {
    if (!hydrated) return
    void saveMirrorWeChatState(characterId, playerIdentityId, state)
  }, [state, hydrated, characterId, playerIdentityId])

  const value = useMemo<MirrorWeChatStoreValue>(
    () => ({
      state,
      hydrated,
      mergeGenerated(scope, data, mode = 'generate') {
        setState((prev) => {
          const normalizedIncoming = (data.contacts || []).map((contact) => ({
            ...contact,
            messages: Array.isArray(contact.messages) ? contact.messages : [],
          }))
          const nextContacts =
            scope === 'contacts'
              ? mode === 'update'
                ? mergeContactsForUpdate(prev.contacts, normalizedIncoming)
                : normalizedIncoming
              : scope === 'chats'
                ? (() => {
                    // chats 模式只更新“消息”，不覆盖通讯录资料（remark/nickname/avatar 等）
                    const incomingById = new Map(normalizedIncoming.map((c) => [c.id, c] as const))
                    const merged = prev.contacts.map((oldC) => {
                      const incoming = incomingById.get(oldC.id)
                      if (!incoming) return oldC
                      incomingById.delete(oldC.id)
                      return {
                        ...oldC,
                        messages: mergeChatMessages(oldC.messages, incoming.messages),
                      }
                    })
                    for (const c of incomingById.values()) merged.push(c)
                    return merged
                  })()
                : prev.contacts
          const next: MirrorWeChatState = {
            ...prev,
            profile: data.profile?.nickname ? data.profile : prev.profile,
            lastGeneratedAt: { ...prev.lastGeneratedAt, [scope]: Date.now() },
            contacts: nextContacts,
            moments: scope === 'moments' ? data.moments || [] : prev.moments,
            bills: scope === 'me' ? data.bills || [] : prev.bills,
            affectionCards: scope === 'me' ? data.affectionCards || [] : prev.affectionCards,
          }
          return next
        })
      },
      reset() {
        setState(initialState)
      },
    }),
    [state, hydrated],
  )

  return <MirrorWeChatStoreContext.Provider value={value}>{children}</MirrorWeChatStoreContext.Provider>
}

export function useMirrorWeChatStore() {
  const ctx = useContext(MirrorWeChatStoreContext)
  if (!ctx) throw new Error('useMirrorWeChatStore must be used within MirrorWeChatStoreProvider')
  return ctx
}
