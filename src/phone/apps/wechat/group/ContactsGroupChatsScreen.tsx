import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'

export type ContactsGroupChatsScreenProps = {
  playerIdentityId: string | null
  onBack: () => void
  onOpenGroup: (groupId: string) => void
  onRequestCreateGroup: () => void
}

export function ContactsGroupChatsScreen({
  playerIdentityId,
  onBack,
  onOpenGroup,
  onRequestCreateGroup,
}: ContactsGroupChatsScreenProps) {
  const [groups, setGroups] = useState<Array<{ id: string; title: string; avatarUrl?: string }>>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (playerIdentityId === null) {
      setLoading(false)
      setGroups([])
      return
    }
    const pid = playerIdentityId.trim()
    if (!pid || pid === '__none__') {
      setLoading(false)
      setGroups([])
      return
    }
    setLoading(true)
    try {
      const list = await personaDb.listGroupChatsForPlayerIdentity(pid)
      setGroups(
        list.map((g) => ({
          id: g.id,
          title: g.remark.trim() || g.name,
          avatarUrl: g.avatar.trim() || undefined,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [playerIdentityId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const on = () => void load()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [load])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F3F4F6]">
      <header
        className="shrink-0 border-b border-[#F3F4F6] bg-white px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center">
          <Pressable type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full">
            <ArrowLeft className="size-5 text-[#111827]" strokeWidth={2} />
          </Pressable>
          <h1 className="flex-1 text-center text-[17px] font-semibold text-[#111827]">群聊</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="py-16 text-center text-[14px] text-[#9CA3AF]">加载中…</p>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-4 py-16">
            <p className="text-center text-[14px] text-[#9CA3AF]">暂无群聊</p>
            <Pressable
              type="button"
              onClick={onRequestCreateGroup}
              className="rounded-full bg-[#111827] px-6 py-2.5 text-[15px] font-medium text-white active:opacity-90"
            >
              创建群聊
            </Pressable>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[#F3F4F6] bg-white">
            {groups.map((g) => (
              <li key={g.id}>
                <Pressable
                  type="button"
                  onClick={() => onOpenGroup(g.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[#F9FAFB]"
                >
                  {g.avatarUrl ? (
                    <img
                      src={g.avatarUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-[10px] border border-[#F3F4F6] object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#F3F4F6] bg-[#F9FAFB] text-[12px] font-medium text-[#111827]">
                      群
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[16px] text-[#111827]">{g.title}</span>
                  <ChevronRight className="size-4 shrink-0 text-[#9CA3AF]" strokeWidth={2} aria-hidden />
                </Pressable>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
