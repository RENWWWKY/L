import { ChevronRight, HelpCircle, MessageSquare, Star, Tag, UserPlus, Users } from 'lucide-react'
import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'

import lumiAssistantLogoUrl from '../../image/主屏幕图标.png'

const AVATAR_PLACEHOLDER = 'https://via.placeholder.com/44'

const LETTER_INDEX = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  '#',
] as const

type LetterKey = (typeof LETTER_INDEX)[number]

type EntryActionId = 'new-friend' | 'group-chat' | 'tags' | 'chat-only'

type EntryAction = {
  id: EntryActionId
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

export type WeChatContactRow = {
  id: string
  remarkName: string
  avatarUrl?: string
  /** 高亮标签，如「小助手」 */
  tag?: string
  isStarred?: boolean
}

type Contact = WeChatContactRow

export type WeChatContactsInstagramProps = {
  contacts?: Contact[]
  onEntryClick?: (id: EntryActionId) => void
  newFriendsBadgeCount?: number
  /** 点击通讯录联系人（内置 Lumi 小助手等） */
  onContactClick?: (contactId: string) => void
  className?: string
}

const ENTRY_ACTIONS: EntryAction[] = [
  { id: 'new-friend', label: '新的朋友', icon: UserPlus },
  { id: 'group-chat', label: '群聊', icon: Users },
  { id: 'tags', label: '标签', icon: Tag },
  { id: 'chat-only', label: '仅聊天的朋友', icon: MessageSquare },
]

/** 内置 Lumi 使用助手：项目内操作问题可向其询问（与信息页会话一致，点击进聊天） */
export const WECHAT_LUMI_ASSISTANT_CONTACT: WeChatContactRow = {
  id: 'wechat-lumi-assistant',
  remarkName: 'Lumi',
  tag: '小助手',
  avatarUrl: lumiAssistantLogoUrl,
}

export const WECHAT_DEFAULT_CONTACTS: Contact[] = []

const ZH_PINYIN_INITIAL_BOUNDARIES: Array<{ letter: Exclude<LetterKey, '#'>; start: string }> = [
  { letter: 'A', start: '阿' },
  { letter: 'B', start: '芭' },
  { letter: 'C', start: '擦' },
  { letter: 'D', start: '搭' },
  { letter: 'E', start: '蛾' },
  { letter: 'F', start: '发' },
  { letter: 'G', start: '噶' },
  { letter: 'H', start: '哈' },
  { letter: 'J', start: '击' },
  { letter: 'K', start: '喀' },
  { letter: 'L', start: '垃' },
  { letter: 'M', start: '妈' },
  { letter: 'N', start: '拿' },
  { letter: 'O', start: '哦' },
  { letter: 'P', start: '啪' },
  { letter: 'Q', start: '期' },
  { letter: 'R', start: '然' },
  { letter: 'S', start: '撒' },
  { letter: 'T', start: '塌' },
  { letter: 'W', start: '挖' },
  { letter: 'X', start: '昔' },
  { letter: 'Y', start: '压' },
  { letter: 'Z', start: '匝' },
]

function getZhPinyinInitial(ch: string): LetterKey {
  for (let i = ZH_PINYIN_INITIAL_BOUNDARIES.length - 1; i >= 0; i -= 1) {
    const item = ZH_PINYIN_INITIAL_BOUNDARIES[i]
    if (ch.localeCompare(item.start, 'zh-CN-u-co-pinyin') >= 0) return item.letter
  }
  return '#'
}

function getGroupLetter(name: string): LetterKey {
  const first = (name || '').trim().charAt(0)
  if (!first) return '#'
  const upper = first.toUpperCase()
  if (/^[A-Z]$/.test(upper)) return upper as LetterKey
  if (/^[\u4e00-\u9fff]$/.test(first)) return getZhPinyinInitial(first)
  return '#'
}

export function WeChatContactsInstagram({
  contacts = WECHAT_DEFAULT_CONTACTS,
  onEntryClick,
  newFriendsBadgeCount = 0,
  onContactClick,
  className = '',
}: WeChatContactsInstagramProps) {
  const [activeLetter, setActiveLetter] = useState<LetterKey>('A')
  const groupRefs = useRef<Partial<Record<LetterKey, HTMLDivElement | null>>>({})
  const indexNavRef = useRef<HTMLDivElement | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<LetterKey, Contact[]>()
    for (const letter of LETTER_INDEX) map.set(letter, [])
    for (const c of contacts) {
      const key = getGroupLetter(c.remarkName)
      map.get(key)?.push(c)
    }
    for (const [k, list] of map) {
      list.sort((a, b) => {
        if (!!a.isStarred !== !!b.isStarred) return a.isStarred ? -1 : 1
        return a.remarkName.localeCompare(b.remarkName, 'zh-CN-u-co-pinyin')
      })
      if (!list.length) map.delete(k)
    }
    return map
  }, [contacts])

  const starredContacts = useMemo(() => {
    return contacts
      .filter((c) => !!c.isStarred)
      .sort((a, b) => a.remarkName.localeCompare(b.remarkName, 'zh-CN-u-co-pinyin'))
  }, [contacts])

  const visibleLetters = useMemo(() => Array.from(grouped.keys()), [grouped])

  useEffect(() => {
    if (!visibleLetters.length) return
    if (!visibleLetters.includes(activeLetter)) {
      setActiveLetter(visibleLetters[0])
    }
  }, [activeLetter, visibleLetters])

  const jumpToLetter = (letter: LetterKey) => {
    setActiveLetter(letter)
    groupRefs.current[letter]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pickLetterByClientY = (clientY: number): LetterKey | null => {
    const root = indexNavRef.current
    if (!root) return null
    const items = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-letter]'))
    if (!items.length) return null

    let picked: LetterKey | null = null
    let minDist = Number.POSITIVE_INFINITY
    for (const btn of items) {
      const rect = btn.getBoundingClientRect()
      const centerY = rect.top + rect.height / 2
      const d = Math.abs(clientY - centerY)
      if (d < minDist) {
        minDist = d
        picked = (btn.dataset.letter as LetterKey) ?? null
      }
    }
    return picked
  }

  const onIndexPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return
    const letter = pickLetterByClientY(e.clientY)
    if (letter && letter !== activeLetter) jumpToLetter(letter)
  }

  const onIndexPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const letter = pickLetterByClientY(e.clientY)
    if (letter) jumpToLetter(letter)
  }

  const onIndexPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div
      className={`relative h-full min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <div className="mx-auto max-w-[560px] space-y-3 px-4 pb-8 pt-4">
        <section className="overflow-hidden rounded-[12px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <ul className="divide-y divide-[#dbdbdb]">
            {ENTRY_ACTIONS.map((item) => {
              const Icon = item.icon
              const showNewFriendBadge = item.id === 'new-friend' && newFriendsBadgeCount > 0
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onEntryClick?.(item.id)}
                    className="flex w-full items-center px-4 py-4 text-left transition-colors duration-200 hover:bg-[#fafafa]"
                  >
                    <Icon className="size-5 text-[#262626]" strokeWidth={1.75} />
                    <span className="ml-3 text-[16px] text-[#262626]">{item.label}</span>
                    {showNewFriendBadge ? (
                      <span className="ml-2 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#fa3b30] px-1 text-[11px] font-semibold leading-none text-white">
                        {newFriendsBadgeCount > 99 ? '99+' : newFriendsBadgeCount}
                      </span>
                    ) : null}
                    <ChevronRight className="ml-auto size-4 text-[#8e8e8e]" strokeWidth={1.75} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section
          className="overflow-hidden rounded-[12px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          aria-label="帮助与支持"
        >
          <div className="border-b border-[#dbdbdb] px-4 py-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="size-[18px] shrink-0 text-[#262626]" strokeWidth={1.75} />
              <span className="text-[15px] font-semibold text-[#262626]">帮助与支持</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[#8e8e8e]">
              项目内功能、操作有疑问时，可向 Lumi 小助手提问。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onContactClick?.(WECHAT_LUMI_ASSISTANT_CONTACT.id)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors duration-200 hover:bg-[#fafafa]"
          >
            <img
              src={WECHAT_LUMI_ASSISTANT_CONTACT.avatarUrl || AVATAR_PLACEHOLDER}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-full border border-[#dbdbdb] object-cover"
            />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-[16px] font-medium text-[#262626]">
                {WECHAT_LUMI_ASSISTANT_CONTACT.remarkName}
              </span>
              {WECHAT_LUMI_ASSISTANT_CONTACT.tag ? (
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-tight text-white"
                  style={{ background: '#111827', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
                >
                  {WECHAT_LUMI_ASSISTANT_CONTACT.tag}
                </span>
              ) : null}
            </div>
            <ChevronRight className="ml-auto size-4 shrink-0 text-[#8e8e8e]" strokeWidth={1.75} />
          </button>
        </section>

        {starredContacts.length ? (
          <section
            className="overflow-hidden rounded-[12px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
            aria-label="星标朋友"
          >
            <div className="border-b border-[#dbdbdb] px-4 py-3">
              <div className="flex items-center gap-2">
                <Star className="size-[18px] shrink-0 text-[#f4b400]" fill="#f4b400" strokeWidth={1.6} />
                <span className="text-[15px] font-semibold text-[#262626]">星标朋友</span>
              </div>
            </div>
            <ul className="bg-white">
              {starredContacts.map((c, idx) => (
                <li key={`starred-${c.id}`} className={idx !== starredContacts.length - 1 ? 'border-b border-[#dbdbdb]' : ''}>
                  <button
                    type="button"
                    onClick={() => onContactClick?.(c.id)}
                    className="flex w-full items-center px-4 py-3 text-left transition-colors duration-200 hover:bg-[#fafafa]"
                  >
                    <img
                      src={c.avatarUrl || AVATAR_PLACEHOLDER}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full border border-[#dbdbdb] object-cover"
                      loading="lazy"
                    />
                    <div className="ml-3 flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-[16px] text-[#262626]">{c.remarkName}</span>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-[#8e8e8e]" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {visibleLetters.length ? (
          <section className="overflow-hidden rounded-[12px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div>
              {visibleLetters.map((letter) => {
                const list = grouped.get(letter) ?? []
                return (
                  <div
                    key={letter}
                    ref={(el) => {
                      groupRefs.current[letter] = el
                    }}
                  >
                    <div className="bg-[#fafafa] px-4 py-2">
                      <span className="text-[14px] font-semibold uppercase text-[#8e8e8e]">{letter}</span>
                    </div>

                    <ul className="bg-white">
                      {list.map((c, idx) => (
                        <li
                          key={c.id}
                          className={idx !== list.length - 1 ? 'border-b border-[#dbdbdb]' : ''}
                        >
                          <button
                            type="button"
                            onClick={() => onContactClick?.(c.id)}
                            className="flex w-full items-center px-4 py-3 text-left transition-colors duration-200 hover:bg-[#fafafa]"
                          >
                            <img
                              src={c.avatarUrl || AVATAR_PLACEHOLDER}
                              alt=""
                              width={44}
                              height={44}
                              className="h-11 w-11 rounded-full border border-[#dbdbdb] object-cover"
                              loading="lazy"
                            />
                            <div className="ml-3 flex min-w-0 flex-1 items-center gap-2">
                              <span className="truncate text-[16px] text-[#262626]">{c.remarkName}</span>
                              {c.tag ? (
                                <span
                                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-tight text-white"
                                  style={{ background: '#111827', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
                                >
                                  {c.tag}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>

      {visibleLetters.length ? (
        <nav
          ref={indexNavRef}
          className="fixed right-2 top-1/2 z-20 -translate-y-1/2 select-none touch-none"
          aria-label="通讯录字母索引"
          onPointerDown={onIndexPointerDown}
          onPointerMove={onIndexPointerMove}
          onPointerUp={onIndexPointerUp}
          onPointerCancel={onIndexPointerUp}
        >
          <ul className="flex flex-col items-center">
            {visibleLetters.map((letter) => {
              const isActive = activeLetter === letter
              return (
                <li key={letter}>
                  <button
                    type="button"
                    onClick={() => jumpToLetter(letter)}
                    data-letter={letter}
                    className="block px-1 py-0.5 text-[12px] leading-4 transition-colors duration-150"
                    style={{
                      color: isActive ? '#262626' : '#8e8e8e',
                    }}
                  >
                    {letter}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}

export default WeChatContactsInstagram
