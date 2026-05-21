import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { useCustomization } from '../../../CustomizationContext'
import { resolveCharacterByWechatSearchQuery } from '../../lumiMeet/meetResolveWechatSearch'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import { useWechatStore } from '../useWechatStore'
import { WECHAT_LUMI_PEER_CHARACTER_ID } from '../wechatConversationKey'

export type AddFriendPageProps = {
  onBack: () => void
  onPickCharacter: (characterId: string) => void
}

type SuggestedRow = {
  character: Character
  subtitle: string
}

async function buildSuggestedRows(
  friendCharacterIds: Set<string>,
  wechatAccountId: string | null,
): Promise<SuggestedRow[]> {
  const acc = wechatAccountId?.trim()
  const all = acc ? await personaDb.listCharactersForWechatAccount(acc) : []
  const mergedSubs = new Map<string, string>()
  for (const root of all) {
    const links = await personaDb.getPlayerNetworkLinks(root.id)
    for (const L of links) {
      const sid = L.characterId?.trim()
      if (!sid) continue
      const rel = (L.relationYouToThem || L.relationThemToYou || '').trim()
      const line = rel ? `*${rel}*` : '*人脉关联*'
      if (!mergedSubs.has(sid)) mergedSubs.set(sid, line)
    }
  }

  const rows: SuggestedRow[] = []
  for (const c of all) {
    if (c.id === WECHAT_LUMI_PEER_CHARACTER_ID) continue
    if (friendCharacterIds.has(c.id)) continue
    const sub = mergedSubs.get(c.id)
    if (!sub) continue
    rows.push({ character: c, subtitle: sub })
  }
  return rows.slice(0, 24)
}

export function AddFriendPage({ onBack, onPickCharacter }: AddFriendPageProps) {
  const { state } = useCustomization()
  const { currentAccountId } = useWechatStore()
  const [query, setQuery] = useState('')
  const [suggested, setSuggested] = useState<SuggestedRow[]>([])
  const [loadingSuggested, setLoadingSuggested] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const friendCharacterIds = useMemo(
    () => new Set(state.wechatPersonaContacts.map((c) => c.characterId)),
    [state.wechatPersonaContacts],
  )

  const refreshSuggested = useCallback(async () => {
    setLoadingSuggested(true)
    try {
      const rows = await buildSuggestedRows(friendCharacterIds, currentAccountId)
      setSuggested(rows)
    } catch {
      setSuggested([])
    } finally {
      setLoadingSuggested(false)
    }
  }, [currentAccountId, friendCharacterIds])

  useEffect(() => {
    void refreshSuggested()
  }, [refreshSuggested])

  const runSearch = useCallback(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      setToast('请输入微信号')
      window.setTimeout(() => setToast(null), 1600)
      return
    }
    void (async () => {
      const hit = await resolveCharacterByWechatSearchQuery(q, { wechatAccountId: currentAccountId })
      if (!hit) {
        setToast('未找到该微信号')
        window.setTimeout(() => setToast(null), 1800)
        return
      }
      if (hit.id === WECHAT_LUMI_PEER_CHARACTER_ID) {
        setToast('该账号为系统通道')
        window.setTimeout(() => setToast(null), 2000)
        return
      }
      if (friendCharacterIds.has(hit.id)) {
        setToast('对方已在你的通讯录中')
        window.setTimeout(() => setToast(null), 2000)
        return
      }
      onPickCharacter(hit.id)
    })()
  }, [currentAccountId, friendCharacterIds, onPickCharacter, query])

  const displayName = (c: Character) =>
    c.wechatNickname?.trim() || c.name?.trim() || '未命名'

  const avatarOf = (c: Character) => c.avatarUrl?.trim() || ''

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col bg-white"
      initial={{ opacity: 0.98 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b-[0.5px] border-[#F3F4F6] bg-white px-1 pb-1 pt-[max(8px,env(safe-area-inset-top,0px))]">
        <Pressable
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center active:opacity-55"
        >
          <ChevronLeft className="size-6 text-[#111111]" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 pr-2 text-center">
          <p className="text-[11px] font-medium tracking-[0.28em] text-[#9CA3AF]">ADD CONTACT</p>
          <p className="text-[16px] font-normal tracking-tight text-[#111111]">添加朋友</p>
        </div>
        <div className="w-11" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-5">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch()
            }}
            placeholder="输入微信号/手机号 (Enter WeChat ID or Phone)"
            className="w-full border-0 bg-transparent pb-3 pl-0 pr-0 pt-0 text-[16px] text-[#111111] outline-none ring-0 placeholder:italic placeholder:text-[#9CA3AF] focus:ring-0"
            aria-label="搜索微信号"
          />
          <div
            className="h-px w-full opacity-90"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(17,17,17,0.12) 45%, rgba(17,17,17,0.04) 100%)',
            }}
          />
        </div>

        <div className="mt-2 flex justify-end">
          <Pressable
            type="button"
            onClick={() => runSearch()}
            className="rounded-full px-4 py-1.5 text-[13px] tracking-wide text-[#111111] active:opacity-60"
          >
            搜索
          </Pressable>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-3 border-b-[0.5px] border-[#F3F4F6] pb-2">
            <h2 className="text-[11px] font-medium tracking-[0.22em] text-[#9CA3AF]">SUGGESTED</h2>
            <span className="text-[11px] tracking-[0.12em] text-[#D1D5DB]">可能认识的人</span>
          </div>
          {loadingSuggested ? (
            <p className="py-6 text-center text-[13px] text-[#9CA3AF]">载入文脉…</p>
          ) : suggested.length === 0 ? (
            <p className="py-6 text-center text-[13px] italic text-[#D1D5DB]">暂无基于人脉的推荐</p>
          ) : (
            <ul className="space-y-0 divide-y-[0.5px] divide-[#F3F4F6]">
              {suggested.map(({ character: c, subtitle }) => (
                <li key={c.id} className="flex items-center gap-3 py-3.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#F3F4F6]">
                    {avatarOf(c) ? (
                      <img src={avatarOf(c)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[15px] text-[#D1D5DB]">
                        —
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] text-[#111111]">{displayName(c)}</p>
                    <p className="mt-0.5 truncate text-[12px] italic text-[#D1D5DB]">{subtitle}</p>
                  </div>
                  <Pressable
                    type="button"
                    onClick={() => onPickCharacter(c.id)}
                    className="shrink-0 rounded-full border border-[#111111]/15 bg-transparent px-3.5 py-1.5 text-[12px] tracking-[0.08em] text-[#111111] active:bg-[#FAFAFA]"
                  >
                    添加
                  </Pressable>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[60] flex justify-center px-6">
          <div className="max-w-sm rounded-[12px] border border-[#E5E7EB] bg-white/95 px-4 py-2.5 text-center text-[13px] text-[#374151] shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur-sm">
            {toast}
          </div>
        </div>
      ) : null}
    </motion.div>
  )
}
