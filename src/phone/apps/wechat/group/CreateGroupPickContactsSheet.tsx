import { ArrowLeft, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'

export type CreateGroupContactPick = {
  characterId: string
  remarkName: string
  avatarUrl?: string
}

export type CreateGroupPickContactsSheetProps = {
  open: boolean
  title: string
  /** 已锁定加入群的成员（显示为已选且不可取消） */
  lockedCharacterIds: string[]
  contacts: CreateGroupContactPick[]
  /** 至少还需勾选几名「非锁定」联系人（不含锁定） */
  minExtraSelections: number
  confirmLabel?: string
  onClose: () => void
  onConfirm: (extraSelectedCharacterIds: string[]) => void
}

export function CreateGroupPickContactsSheet({
  open,
  title,
  lockedCharacterIds,
  contacts,
  minExtraSelections,
  confirmLabel = '完成',
  onClose,
  onConfirm,
}: CreateGroupPickContactsSheetProps) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const locked = useMemo(() => new Set(lockedCharacterIds.map((x) => x.trim()).filter(Boolean)), [lockedCharacterIds])

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return contacts.filter((c) => {
      if (locked.has(c.characterId)) return false
      if (!qq) return true
      return c.remarkName.toLowerCase().includes(qq)
    })
  }, [contacts, q, locked])

  const extraCount = picked.size
  const canConfirm = extraCount >= minExtraSelections

  if (!open) return null

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="absolute inset-0 z-[340] flex min-h-0 flex-col bg-[#FFFFFF]">
      <header
        className="shrink-0 border-b border-[#F3F4F6] bg-[#FFFFFF] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex w-full items-center gap-2">
          <Pressable
            type="button"
            aria-label="返回"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#111827]"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </Pressable>
          <h1 className="min-w-0 flex-1 text-center text-[17px] font-semibold text-[#111827]">{title}</h1>
          <Pressable
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return
              onConfirm([...picked])
              setPicked(new Set())
              setQ('')
            }}
            className="shrink-0 rounded-full bg-[#111827] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-35"
          >
            {confirmLabel}
          </Pressable>
        </div>
        <p className="mt-2 px-1 text-center text-[12px] text-[#9CA3AF]">
          {minExtraSelections > 0
            ? `请至少再选择 ${minExtraSelections} 位联系人`
            : '选择要加入群聊的联系人'}
        </p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" strokeWidth={2} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索"
            className="h-10 w-full rounded-[10px] border border-[#F3F4F6] bg-[#F9FAFB] pl-9 pr-3 text-[14px] text-[#111827] outline-none placeholder:text-[#9CA3AF]"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {lockedCharacterIds.length ? (
          <div className="border-b border-[#F3F4F6] px-4 py-3">
            <p className="text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">已加入</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lockedCharacterIds.map((id) => {
                const c = contacts.find((x) => x.characterId === id)
                const label = c?.remarkName ?? id
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-[#F3F4F6] bg-[#F9FAFB] px-2 py-1 text-[12px] text-[#111827]"
                  >
                    {c?.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="size-5 rounded-full object-cover" />
                    ) : (
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#E5E7EB] text-[10px]">—</span>
                    )}
                    <span className="max-w-[120px] truncate">{label}</span>
                  </span>
                )
              })}
            </div>
          </div>
        ) : null}

        <ul className="divide-y divide-[#F3F4F6]">
          {list.length === 0 ? (
            <li className="px-4 py-10 text-center text-[14px] text-[#9CA3AF]">无匹配联系人</li>
          ) : (
            list.map((c) => {
              const on = picked.has(c.characterId)
              return (
                <li key={c.characterId}>
                  <button
                    type="button"
                    onClick={() => toggle(c.characterId)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[#F9FAFB]"
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        on ? 'border-[#111827] bg-[#111827]' : 'border-[#D1D5DB] bg-white'
                      }`}
                      aria-hidden
                    >
                      {on ? <span className="text-[10px] text-white">✓</span> : null}
                    </span>
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="size-10 shrink-0 rounded-full bg-[#F3F4F6]" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[16px] text-[#111827]">{c.remarkName}</span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
