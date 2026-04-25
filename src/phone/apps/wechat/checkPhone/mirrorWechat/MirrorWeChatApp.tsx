import { Fragment, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CircleUserRound,
  Image as ImageIcon,
  Lock,
  MessageSquareText,
  Sparkles,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react'

import { Pressable } from '../../../../components/Pressable'
import { useCurrentApiConfig } from '../../../api/ApiSettingsContext'
import { DEFAULT_CUSTOMIZATION, type CustomizationState, type WeChatBubbleTheme } from '../../../../types'
import { formatWeChatChatTimestamp, shouldRenderWeChatTimestamp } from '../../time/wechatTimeUtils'
import { RedPacketBubble } from '../../redPacket/RedPacketBubble'
import { TransferBubble } from '../../transfer/TransferBubble'
import { upsertLumiTransfer } from '../../transfer/lumiTransferStorage'
import { generateSpyWechatData } from '../spyWechatAi'
import { DataSyncModal } from './DataSyncModal'
import { clearMirrorWeChatAddressBookMemory, syncMirrorWeChatAddressBookToCharacterMemory } from './mirrorWechatContactMemory'
import { MirrorWeChatStoreProvider, useMirrorWeChatStore } from './MirrorWeChatStore'
import type { MirrorWeChatContact, MirrorWeChatTab } from './types'

/** 查手机通讯录生成：关系偏向多选项（默认不预选） */
const MIRROR_WECHAT_RELATION_PRESETS = ['家人', '同事', '朋友', '死党', '暧昧', '恋人', '网友'] as const

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

function formatMoney(amount: number) {
  const abs = Math.abs(amount).toFixed(2)
  return `${amount >= 0 ? '+' : '-'}${abs}`
}

function readBubblePrefsLite(): { showAvatar: boolean; mergeConsecutiveAvatarGroup: boolean } {
  if (typeof window === 'undefined') return { showAvatar: true, mergeConsecutiveAvatarGroup: true }
  const keys = ['lumi-phone-custom-v3', 'lumi-phone-custom-v2', 'lumi-phone-custom-v1']
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Partial<CustomizationState>
      const g = (parsed as any)?.wechatTheme?.bubbleGlobal
      if (g && typeof g === 'object') {
        return {
          showAvatar: g.showAvatar !== false,
          mergeConsecutiveAvatarGroup: g.mergeConsecutiveAvatarGroup !== false,
        }
      }
    } catch {
      // ignore
    }
  }
  return { showAvatar: true, mergeConsecutiveAvatarGroup: true }
}

function tabLabel(tab: MirrorWeChatTab) {
  switch (tab) {
    case 'chats':
      return '信息'
    case 'contacts':
      return '通讯录'
    case 'moments':
      return '朋友圈'
    case 'profile':
      return '我'
  }
}

function Main({
  characterId,
  playerIdentityId,
  playerDisplayName,
  useLumiProjectAssistantPrompt,
  onClose,
  onToast,
}: {
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  useLumiProjectAssistantPrompt: boolean
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const { state, mergeGenerated, hydrated, reset } = useMirrorWeChatStore()
  const [tab, setTab] = useState<MirrorWeChatTab>('chats')
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [chatOpenId, setChatOpenId] = useState<string | null>(null)
  const [walletOpen, setWalletOpen] = useState(false)
  const [contactCount, setContactCount] = useState(12)
  const [chatContactsCountInput, setChatContactsCountInput] = useState('6')
  const [minMessagesPerContactInput, setMinMessagesPerContactInput] = useState('12')
  const [selectedRelations, setSelectedRelations] = useState<string[]>([])
  const [walletBias, setWalletBias] = useState('')
  const [includeBlocked, setIncludeBlocked] = useState(true)
  const [includeHideFromUser, setIncludeHideFromUser] = useState(true)
  const [includeOnlyTaVisible, setIncludeOnlyTaVisible] = useState(true)
  const [activeLetter, setActiveLetter] = useState<LetterKey>('A')
  const groupRefs = useRef<Partial<Record<LetterKey, HTMLDivElement | null>>>({})
  const indexNavRef = useRef<HTMLDivElement | null>(null)

  const currentChat = useMemo(() => state.contacts.find((item) => item.id === chatOpenId) || null, [chatOpenId, state.contacts])
  const roleAvatarUrl = useMemo(() => state.profile?.avatarUrl || '/image/个人名片默认头像1.png', [state.profile?.avatarUrl])
  const mirrorBubbleTheme: WeChatBubbleTheme = DEFAULT_CUSTOMIZATION.wechatTheme.bubbleGlobal
  const bubblePrefs = useMemo(() => readBubblePrefsLite(), [])
  const starredContacts = useMemo(
    () =>
      state.contacts
        .filter((item) => !!item.isStarred)
        .sort((a, b) => (a.remarkName || a.nickname || '').localeCompare(b.remarkName || b.nickname || '', 'zh-CN-u-co-pinyin')),
    [state.contacts],
  )
  const contactsGrouped = useMemo(() => {
    const map = new Map<LetterKey, typeof state.contacts>()
    for (const letter of LETTER_INDEX) map.set(letter, [])
    for (const item of state.contacts) {
      const key = getGroupLetter(item.remarkName || item.nickname || '')
      map.get(key)?.push(item)
    }
    for (const [k, list] of map) {
      list.sort((a, b) => (a.remarkName || a.nickname || '').localeCompare(b.remarkName || b.nickname || '', 'zh-CN-u-co-pinyin'))
      if (!list.length) map.delete(k)
    }
    return map
  }, [state.contacts])
  const contactVisibleLetters = useMemo(() => Array.from(contactsGrouped.keys()), [contactsGrouped])

  useEffect(() => {
    if (tab !== 'contacts') return
    if (!contactVisibleLetters.length) return
    if (!contactVisibleLetters.includes(activeLetter)) setActiveLetter(contactVisibleLetters[0])
  }, [activeLetter, contactVisibleLetters, tab])

  /** 将「用户 / NPC / 新增」三类备注同步到同一条长期记忆；仅「新增」带 relationship 描述字段 */
  useEffect(() => {
    if (!hydrated) return
    if (!characterId.trim()) return
    void syncMirrorWeChatAddressBookToCharacterMemory(characterId, playerIdentityId, state.contacts)
  }, [hydrated, characterId, playerIdentityId, state.contacts])

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
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const runSync = async (mode: 'generate' | 'update' = 'generate') => {
    if (tab === 'chats' && !state.contacts.length) {
      onToast('请先同步通讯录关系网，方可提取聊天碎片。')
      setSyncOpen(false)
      return
    }
    const hasExistingData =
      tab === 'contacts'
        ? state.contacts.length > 0
        : tab === 'chats'
          ? state.contacts.some((x) => x.messages.length > 0)
          : tab === 'moments'
            ? state.moments.length > 0
            : Boolean(state.profile?.nickname || state.profile?.signature || state.profile?.avatarUrl)
    if (mode === 'generate' && hasExistingData && typeof window !== 'undefined') {
      const proceed = window.confirm(
        '当前已有镜像微信数据。\n建议优先使用“更新”：会基于现有数据追加/微调。\n如果继续“生成”，将覆盖当前已有数据并生成新的一套。\n\n确认继续生成吗？',
      )
      if (!proceed) return
    }
    setSyncBusy(true)
    try {
      const scope = tab === 'profile' ? 'me' : tab
      const relationBiasText = selectedRelations.join('、')
      const contactBiasPayload = tab === 'profile' ? walletBias.trim() : relationBiasText
      const updateContactBias =
        scope === 'contacts'
          ? '仅基于当前已存在通讯录与用户-角色近期对话/线下剧情做增量更新；总体联系人保持稳定，仅在剧情明确出现“新认识的人”时新增。'
          : scope === 'chats'
            ? '仅基于当前已有聊天记录与用户-角色近期对话/线下剧情做续写追加，不重建旧会话。'
            : '仅基于当前已有数据与近期剧情推进增量更新。'
      const effectiveContactCount =
        mode === 'update' ? Math.min(20, Math.max(4, state.contacts.length || 4)) : Math.min(20, Math.max(4, contactCount))
      const effectiveChatContactsCount =
        mode === 'update'
          ? Math.min(20, Math.max(1, state.contacts.filter((x) => x.messages.length).length || 1))
          : Math.min(20, Math.max(1, Math.round(Number(chatContactsCountInput) || 6)))
      const data = await generateSpyWechatData({
        apiConfig,
        characterId,
        playerIdentityId,
        playerDisplayName,
        useLumiProjectAssistantPrompt,
        scope,
        options: {
          contactCount: effectiveContactCount,
          contactBias:
            mode === 'update'
              ? updateContactBias
              : contactBiasPayload,
          currentContactsSnapshot:
            mode === 'update'
              ? state.contacts.map((c) => ({
                  id: c.id,
                  nickname: c.nickname,
                  remarkName: c.remarkName,
                  characterId: c.characterId,
                  isStarred: c.isStarred,
                  blocked: c.blocked,
                }))
              : [],
          includeBlocked: mode === 'update' ? true : includeBlocked,
          includeMomentsHideFromUser: mode === 'update' ? true : includeHideFromUser,
          includeMomentsOnlyTaVisibleWithoutUser: mode === 'update' ? true : includeOnlyTaVisible,
          minMessagesPerContact:
            mode === 'update'
              ? 12
              : Math.min(80, Math.max(1, Math.round(Number(minMessagesPerContactInput) || 12))),
          chatContactsCount: effectiveChatContactsCount,
        },
      })
      mergeGenerated(scope, data, mode)
      setSyncOpen(false)
      onToast(mode === 'update' ? `${tabLabel(tab)}已更新` : `${tabLabel(tab)}已生成`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : '同步失败')
    } finally {
      setSyncBusy(false)
    }
  }

  const onClearGeneratedCache = async () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('确认清除当前镜像微信已生成缓存数据吗？该操作不可撤销。')
      if (!confirmed) return
    }
    reset()
    setChatOpenId(null)
    setWalletOpen(false)
    setSyncOpen(false)
    await clearMirrorWeChatAddressBookMemory(characterId)
    onToast('已清除镜像微信缓存数据')
  }

  const chats = state.contacts.filter((item) => item.messages.length)

  useEffect(() => {
    if (!chatOpenId || !currentChat) return
    const conversationKey = `mirror:${chatOpenId}`
    currentChat.messages.forEach((msg, index) => {
      if (msg.special?.kind !== 'transfer') return
      const transferId = msg.special.transferId?.trim() || `mirror-transfer:${conversationKey}:${msg.timestamp}:${index}`
      upsertLumiTransfer({
        id: transferId,
        amount: Number(msg.special.amountYuan || 188),
        remark: msg.special.note || msg.content || '微信转账',
        senderId: msg.from === 'character' ? 'mirror-role' : 'mirror-peer',
        receiverId: msg.from === 'character' ? 'mirror-peer' : 'mirror-role',
        status: msg.special.status || 'pending',
        createdAt: Number(msg.timestamp || Date.now()),
        expiresAt: Number(msg.timestamp || Date.now()) + 24 * 60 * 60 * 1000,
        conversationKey,
        messageId: `mirror-msg:${msg.timestamp}:${index}`,
      })
    })
  }, [chatOpenId, currentChat])

  const renderMessageBody = (msg: MirrorWeChatContact['messages'][number], isSelf: boolean, index: number) => {
    if (msg.special?.kind === 'red_packet') {
      return (
        <RedPacketBubble
          isSelf={isSelf}
          data={{
            amountYuan: Number(msg.special.amountYuan || 0),
            opened: !!msg.special.opened,
            remark: msg.special.remark || '恭喜发财，大吉大利',
          }}
        />
      )
    }
    if (msg.special?.kind === 'transfer') {
      const transferId = msg.special.transferId?.trim() || `mirror-transfer:mirror:${chatOpenId || 'chat'}:${msg.timestamp}:${index}`
      return (
        <TransferBubble transferId={transferId} getCurrentTime={() => Date.now()} />
      )
    }
    if (msg.special?.kind === 'sticker') {
      const stickerUrl = msg.special.imageUrl
      return (
        stickerUrl ? (
          <div
            className="inline-block overflow-hidden select-none"
            style={{
              borderRadius: isSelf ? `${mirrorBubbleTheme.selfBubbleRadiusPx}px` : `${mirrorBubbleTheme.otherBubbleRadiusPx}px`,
              border: isSelf ? '1px solid #000000' : '1px solid rgba(0,0,0,0.08)',
              background: '#ffffff',
            }}
          >
            <img src={stickerUrl} alt="" className="block h-auto w-[160px] max-w-[46vw] select-none object-cover" draggable={false} />
          </div>
        ) : (
          <div
            className="inline-flex h-[96px] w-[96px] items-center justify-center overflow-hidden select-none"
            style={{
              borderRadius: isSelf ? `${mirrorBubbleTheme.selfBubbleRadiusPx}px` : `${mirrorBubbleTheme.otherBubbleRadiusPx}px`,
              border: isSelf ? '1px solid #000000' : '1px solid rgba(0,0,0,0.08)',
              background: '#ffffff',
            }}
          >
            <span className="text-[28px]" aria-label="表情包">🙂</span>
          </div>
        )
      )
    }
    if (msg.special?.kind === 'image' && msg.special.imageUrl) {
      return (
        <div className="overflow-hidden rounded-[12px] border border-black/5 bg-white">
          <img src={msg.special.imageUrl} alt="" className="max-h-56 w-44 object-cover" />
          {msg.content ? <div className="px-2 py-1 text-[12px] text-[#60636a]">{msg.content}</div> : null}
        </div>
      )
    }
    return (
      <div
        className={`max-w-[min(78%,calc(100vw-24px-24px-80px))] rounded-[12px] px-3 py-2 text-[14px] leading-6 shadow-[0_8px_18px_rgba(0,0,0,0.04)] ${
          !isSelf ? 'bg-[#f0f1f3] text-[#1c1d20]' : 'bg-[#16171a] text-white'
        }`}
      >
        {msg.content}
      </div>
    )
  }

  const getChatPreviewText = (msg?: MirrorWeChatContact['messages'][number]) => {
    if (!msg) return '暂无聊天碎片'
    if (msg.special?.kind === 'red_packet') return `[微信红包] ${msg.special.remark || ''}`.trim()
    if (msg.special?.kind === 'transfer') return `[微信转账] ${msg.special.note || msg.content || ''}`.trim()
    if (msg.special?.kind === 'sticker') return '[表情包]'
    if (msg.special?.kind === 'image') return '[图片]'
    return msg.content || '暂无聊天碎片'
  }

  const currentChatMessages = useMemo(
    () => (currentChat ? [...currentChat.messages].sort((a, b) => a.timestamp - b.timestamp) : []),
    [currentChat],
  )

  if (!hydrated) {
    return (
      <motion.div
        className="fixed inset-0 z-[1410] flex flex-col items-center justify-center overflow-hidden bg-[#fbfbfc] text-[#8a8d94]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="text-[14px] tracking-[0.08em]">载入本地数据…</div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="fixed inset-0 z-[1410] overflow-hidden bg-[#fbfbfc] text-[#141517]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(178,23,23,0.05),transparent_28%),radial-gradient(circle_at_bottom,rgba(155,118,42,0.06),transparent_30%)]" />

      <div className="relative flex h-full flex-col">
        <div
          className="sticky top-0 z-20 border-b border-[#ececef] bg-white/80 px-4 pb-3 backdrop-blur-xl"
          style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <Pressable type="button" onClick={chatOpenId ? () => setChatOpenId(null) : onClose} className="rounded-[14px] border border-[#e6e7eb] bg-white px-3 py-2 text-[13px] text-[#4d5056]">
              返回
            </Pressable>
            <div className="text-[16px] font-medium tracking-[0.12em] text-[#111214]">{chatOpenId ? currentChat?.remarkName || '对话' : `镜像微信 · ${tabLabel(tab)}`}</div>
            <div className="inline-flex items-center gap-2">
              <Pressable
                type="button"
                onClick={onClearGeneratedCache}
                className="rounded-[14px] border border-[#e8dede] bg-white px-2.5 py-2 text-[#8f4f56] shadow-[0_8px_18px_rgba(0,0,0,0.05)]"
                aria-label="清除缓存数据"
                title="清除缓存数据"
              >
                <Trash2 size={15} />
              </Pressable>
              <Pressable
                type="button"
                onClick={() => setSyncOpen(true)}
                className="rounded-[16px] border border-[#ece1c6] bg-[#fffdfa] px-3 py-2 text-[13px] text-[#7b6332] shadow-[0_8px_20px_rgba(180,145,83,0.08)]"
              >
                <span className="inline-flex items-center gap-1"><Sparkles size={14} />生成/更新</span>
              </Pressable>
            </div>
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto overflow-x-hidden pb-24">
          {chatOpenId && currentChat ? (
            <div className="px-4 pb-5 pt-4">
              <div className="space-y-2">
                {(() => {
                  let previousShownTimeMs: number | null = null
                  const nowMs = Date.now()
                  return currentChatMessages.map((msg, index) => {
                    const showTimestamp = shouldRenderWeChatTimestamp(previousShownTimeMs, msg.timestamp)
                    if (showTimestamp) previousShownTimeMs = msg.timestamp
                    // 镜像微信里：角色消息固定右侧，联系人（含用户）固定左侧。
                    const isSelf = msg.from === 'character'
                    const prev = index > 0 ? currentChatMessages[index - 1] : null
                    const showAvatarColumn =
                      bubblePrefs.showAvatar &&
                      (!bubblePrefs.mergeConsecutiveAvatarGroup || !prev || prev.from !== msg.from)
                    const leftAvatar = currentChat.avatarUrl || '/image/个人名片默认头像1.png'
                    const rightAvatar = roleAvatarUrl
                    return (
                      <Fragment key={`${msg.timestamp}-${index}`}>
                        {showTimestamp ? (
                          <div className="my-2 flex justify-center">
                            <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] text-[#8f9298]">
                              {formatWeChatChatTimestamp(msg.timestamp, nowMs)}
                            </span>
                          </div>
                        ) : null}
                        <div className={`flex ${msg.from === 'character' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex w-full min-w-0 items-start gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                            {!isSelf && bubblePrefs.showAvatar ? (
                              showAvatarColumn ? (
                                <img src={leftAvatar} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                              ) : (
                                <div className="h-9 w-9 shrink-0" aria-hidden />
                              )
                            ) : null}
                            {renderMessageBody(msg, isSelf, index)}
                            {isSelf && bubblePrefs.showAvatar ? (
                              showAvatarColumn ? (
                                <img src={rightAvatar} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                              ) : (
                                <div className="h-9 w-9 shrink-0" aria-hidden />
                              )
                            ) : null}
                          </div>
                        </div>
                      </Fragment>
                    )
                  })
                })()}
              </div>
              <div className="mt-4 rounded-[20px] border border-[#e8e9ec] bg-white/88 px-4 py-3 text-[13px] italic text-[#8a8d93]">
                *Observer mode active. (窥探模式)*
              </div>
            </div>
          ) : tab === 'chats' ? (
            <div className="px-4 pt-4">
              <div className="space-y-2.5">
                {chats.length ? (
                  chats.map((item) => (
                    <Pressable key={item.id} type="button" onClick={() => setChatOpenId(item.id)} className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-[22px] border border-[#ececef] bg-white/88 px-3 py-3 shadow-[0_10px_24px_rgba(18,18,18,0.04)]">
                      <img src={item.avatarUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-[15px] font-medium text-[#15161a]">{item.remarkName}</div>
                          <div className="text-[11px] text-[#9a9da3]">{item.messages.at(-1)?.timestamp ? new Date(item.messages.at(-1)!.timestamp).toLocaleDateString() : ''}</div>
                        </div>
                        <div className="mt-1 text-left truncate text-[13px] text-[#73767d]">{getChatPreviewText(item.messages.at(-1))}</div>
                      </div>
                    </Pressable>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-[#ececef] bg-white px-5 py-8 text-center text-[14px] leading-7 text-[#7a7d84]">
                    暂无聊天碎片。<br />请先同步通讯录，再生成信息页。
                  </div>
                )}
              </div>
            </div>
          ) : tab === 'contacts' ? (
            <div className="px-4 pt-4">
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between rounded-[20px] border border-[#ececef] bg-white px-4 py-3">
                  <div className="flex items-center gap-3"><UserRound size={17} className="text-[#a08d62]" /><span className="text-[14px] text-[#212327]">新的朋友</span></div>
                </div>
                <div className="flex items-center justify-between rounded-[20px] border border-[#ececef] bg-white px-4 py-3">
                  <div className="flex items-center gap-3"><Lock size={17} className="text-[#8c2431]" /><span className="text-[14px] text-[#212327]">黑名单</span></div>
                  <span className="text-[12px] text-[#8a8d94]">{state.contacts.filter((item) => item.blocked).length}</span>
                </div>
              </div>
              {starredContacts.length ? (
                <div className="mb-4">
                  <div className="mb-2 px-1 text-[11px] tracking-[0.18em] text-[#9a9da3]">星标朋友</div>
                  <div className="space-y-2">
                    {starredContacts.map((item) => (
                      <div key={`star-${item.id}`} className="flex items-center gap-3 rounded-[20px] border border-[#ececef] bg-white/90 px-3 py-3">
                        <img src={item.avatarUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] text-[#1b1c1f]">{item.remarkName}</div>
                          <div className="truncate text-[12px] text-[#8c8f95]">{item.nickname}</div>
                        </div>
                        <span className="rounded-full bg-[#f5ecd2] px-2 py-1 text-[11px] text-[#8a6a23]">Starred</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-5">
                {contactVisibleLetters.map((letter) => {
                  const list = contactsGrouped.get(letter) || []
                  return (
                    <div
                      key={letter}
                      ref={(el) => {
                        groupRefs.current[letter] = el
                      }}
                    >
                      <div className="mb-2 px-1 text-[11px] tracking-[0.18em] text-[#9a9da3]">{letter}</div>
                      <div className="space-y-2">
                        {list.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 rounded-[20px] border border-[#ececef] bg-white/90 px-3 py-3">
                            <img src={item.avatarUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] text-[#1b1c1f]">{item.remarkName}</div>
                              <div className="truncate text-[12px] text-[#8c8f95]">{item.nickname}</div>
                            </div>
                            {item.blocked ? <span className="rounded-full bg-[#6b0f1a]/8 px-2 py-1 text-[11px] text-[#8f1b2a]">Blocked</span> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              {contactVisibleLetters.length ? (
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
                    {contactVisibleLetters.map((letter) => {
                      const isActive = activeLetter === letter
                      return (
                        <li key={letter}>
                          <button
                            type="button"
                            onClick={() => jumpToLetter(letter)}
                            data-letter={letter}
                            className="block px-1 py-0.5 text-[12px] leading-4 transition-colors duration-150"
                            style={{ color: isActive ? '#262626' : '#8e8e8e' }}
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
          ) : tab === 'moments' ? (
            <div>
              <div className="h-40 bg-[linear-gradient(135deg,#ebe8e1,#f8f8f9)]" />
              <div className="-mt-8 space-y-3 px-4 pb-6">
                {state.moments.length ? (
                  state.moments.map((item) => {
                    const privacyTone = item.visibility.includes('屏蔽') ? 'bg-[#5f1018]/10 text-[#8c1b28]' : item.visibility.includes('仅') ? 'bg-[#7a5a1a]/10 text-[#8d6920]' : 'bg-[#eff0f2] text-[#6d7076]'
                    return (
                      <div key={item.id} className="rounded-[24px] border border-[#ececef] bg-white/92 p-4 shadow-[0_12px_26px_rgba(0,0,0,0.04)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[15px] leading-7 text-[#18191c]">{item.content}</div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${privacyTone}`}>{item.visibility}</span>
                        </div>
                        <div className="mt-3 text-[12px] text-[#9b9ea4]">点赞：{item.likes.join('、') || '暂无'}</div>
                        <div className="mt-2 space-y-1">
                          {item.comments.map((comment, index) => (
                            <div key={`${item.id}-${index}`} className="rounded-[14px] bg-[#f6f7f8] px-3 py-2 text-[12px] text-[#5f6268]">
                              <span className="text-[#1d1f23]">{comment.from}</span>：{comment.content}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-[24px] border border-[#ececef] bg-white px-5 py-8 text-center text-[14px] leading-7 text-[#7a7d84]">暂无朋友圈镜像数据。</div>
                )}
              </div>
            </div>
          ) : (
            <div className="px-4 pt-4">
              <div className="rounded-[28px] border border-[#ececef] bg-white/94 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-3">
                  {state.profile?.avatarUrl ? <img src={state.profile.avatarUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eff1f4]"><CircleUserRound size={24} /></div>}
                  <div>
                    <div className="text-[18px] font-medium text-[#15161a]">{state.profile?.nickname || '未同步身份信息'}</div>
                    <div className="mt-1 text-[12px] text-[#8e9198]">{state.profile?.signature || 'Signature not available'}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <Pressable type="button" onClick={() => onToast('暂无访问权限')} className="flex items-center justify-between rounded-[22px] border border-[#ececef] bg-white px-4 py-4">
                  <div className="flex items-center gap-3"><Lock size={18} className="text-[#8f1d2a]" /><span className="text-[14px] text-[#1d1e22]">收藏</span></div>
                  <span className="text-[12px] text-[#9a9da3]">暂无访问权限</span>
                </Pressable>
                <Pressable type="button" onClick={() => setWalletOpen((v) => !v)} className="flex items-center justify-between rounded-[22px] border border-[#ececef] bg-white px-4 py-4">
                  <div className="flex items-center gap-3"><Wallet size={18} className="text-[#8b6a2a]" /><span className="text-[14px] text-[#1d1e22]">卡包 / 钱包</span></div>
                  <span className="text-[12px] text-[#9a9da3]">{walletOpen ? '收起' : '展开'}</span>
                </Pressable>
                {walletOpen ? (
                  <div className="rounded-[24px] border border-[#ececef] bg-white/94 p-4">
                    <div className="text-[13px] tracking-[0.16em] text-[#8e9198]">WALLET MIRROR</div>
                    <div className="mt-2 text-[28px] font-medium text-[#121316]">
                      ¥
                      {state.bills.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </div>
                    <div className="mt-4 text-[12px] text-[#9a9da3]">亲情卡记录</div>
                    <div className="mt-2 space-y-2">
                      {state.affectionCards.length ? state.affectionCards.map((item) => (
                        <div key={item.id} className="rounded-[18px] bg-[#f6f7f8] px-4 py-3 text-[13px] text-[#44474c]">
                          {item.holder} · 额度 ¥{item.limit} · 已用 ¥{item.spent}
                        </div>
                      )) : <div className="rounded-[18px] bg-[#f6f7f8] px-4 py-3 text-[13px] text-[#7f8288]">暂无亲情卡记录</div>}
                    </div>
                    <div className="mt-4 text-[12px] text-[#9a9da3]">账单流水</div>
                    <div className="mt-2 space-y-2">
                      {state.bills.length ? state.bills.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-[18px] bg-[#f6f7f8] px-4 py-3">
                          <div>
                            <div className="text-[13px] text-[#1e2024]">{item.target}</div>
                            <div className="mt-1 text-[11px] text-[#8a8d93]">{item.date} · {item.remark}</div>
                          </div>
                          <div className={`text-[14px] ${item.amount >= 0 ? 'text-[#0f766e]' : 'text-[#7f1d1d]'}`}>{formatMoney(item.amount)}</div>
                        </div>
                      )) : <div className="rounded-[18px] bg-[#f6f7f8] px-4 py-3 text-[13px] text-[#7f8288]">暂无账单流水</div>}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 rounded-[20px] border border-[#e8e9ec] bg-white/88 px-4 py-3 text-[13px] italic text-[#8a8d93]">
                *Observer mode active. (窥探模式)*
              </div>
            </div>
          )}
        </div>

        {!chatOpenId ? (
          <div
            className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/70 bg-white/80 px-4 pb-3 pt-2 backdrop-blur-xl"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'chats', label: '信息', Icon: MessageSquareText },
                { id: 'contacts', label: '通讯录', Icon: UserRound },
                { id: 'moments', label: '朋友圈', Icon: ImageIcon },
                { id: 'profile', label: '我', Icon: CircleUserRound },
              ].map(({ id, label, Icon }) => {
                const active = tab === id
                return (
                  <Pressable key={id} type="button" onClick={() => setTab(id as MirrorWeChatTab)} className="flex flex-col items-center gap-1 rounded-[18px] py-2">
                    <Icon size={18} className={active ? 'text-[#131417]' : 'text-[#9699a0]'} />
                    <span className={`text-[11px] ${active ? 'text-[#131417]' : 'text-[#9699a0]'}`}>{label}</span>
                  </Pressable>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      <DataSyncModal
        open={syncOpen}
        busy={syncBusy}
        title={`${tabLabel(tab)}生成/更新`}
        subtitle={
          tab === 'contacts'
            ? '先建立关系网基石，再为后续聊天碎片和朋友圈黑盒提供人物坐标。'
            : tab === 'chats'
              ? '聊天记录依赖通讯录。将抽取高张力对话，维持冷白铂金风的窥探体验。'
              : tab === 'moments'
                ? '生成角色自己与联系人之间的朋友圈、点赞与隐私标签。'
                : '同步“我”页与钱包子数据，包括亲情卡与账单流水。'
        }
        contactCount={contactCount}
        onContactCountChange={setContactCount}
        showContactCountSlider={tab === 'contacts'}
        countLabel="联系人数量"
        relationPresetLabels={tab === 'profile' ? undefined : MIRROR_WECHAT_RELATION_PRESETS}
        selectedRelations={selectedRelations}
        onSelectedRelationsChange={setSelectedRelations}
        walletBiasText={walletBias}
        onWalletBiasTextChange={setWalletBias}
        chatContactsCount={chatContactsCountInput}
        minMessagesPerContact={minMessagesPerContactInput}
        includeBlocked={includeBlocked}
        includeHideFromUser={includeHideFromUser}
        includeOnlyTaVisible={includeOnlyTaVisible}
        onChatContactsCountChange={tab === 'chats' ? setChatContactsCountInput : undefined}
        onMinMessagesPerContactChange={tab === 'chats' ? setMinMessagesPerContactInput : undefined}
        onIncludeBlockedChange={tab === 'contacts' ? setIncludeBlocked : undefined}
        onIncludeHideFromUserChange={tab === 'moments' ? setIncludeHideFromUser : undefined}
        onIncludeOnlyTaVisibleChange={tab === 'moments' ? setIncludeOnlyTaVisible : undefined}
        onClose={() => setSyncOpen(false)}
        onSubmit={() => runSync('generate')}
        onUpdate={tab === 'contacts' || tab === 'chats' ? () => runSync('update') : undefined}
      />
    </motion.div>
  )
}

export function MirrorWeChatApp(props: {
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  useLumiProjectAssistantPrompt: boolean
  onClose: () => void
  onToast: (msg: string) => void
}) {
  return (
    <MirrorWeChatStoreProvider characterId={props.characterId} playerIdentityId={props.playerIdentityId}>
      <Main {...props} />
    </MirrorWeChatStoreProvider>
  )
}
