import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, MessageCircle, MoreHorizontal, Phone } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import {
  ContactProfileGenderGlyph,
  type ContactProfileGenderUi,
} from './ContactProfileGenderIcons'
import { personaDb } from './newFriendsPersona/idb'
import type { Character } from './newFriendsPersona/types'
import { WECHAT_LUMI_PEER_CHARACTER_ID } from './wechatConversationKey'

import lumiDefaultAvatar from '../../../../image/主屏幕图标.png'

export type ContactProfileTarget = { kind: 'lumi' } | { kind: 'persona'; characterId: string }

export type ContactProfileCardScreenProps = {
  target: ContactProfileTarget
  remarkName: string
  avatarUrl?: string
  onBack: () => void
  onOpenChat: () => void
  onOpenProfileSettings: () => void
  onOpenContactSettings: (characterId: string) => void
  onOpenMoments?: () => void
}

function mapGender(g: Character['gender'] | undefined | null): ContactProfileGenderUi {
  if (g === 'male') return 'male'
  if (g === 'female') return 'female'
  return 'private'
}

function ProfileInfoRow({
  label,
  subLabel,
  value,
  onClick,
}: {
  label: string
  subLabel?: string
  value: string
  onClick?: () => void
}) {
  if (onClick) {
    return (
      <Pressable
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 border-b-[0.5px] border-gray-100 px-4 py-3 text-left last:border-b-0 active:bg-gray-50"
      >
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[15px] text-[#111111]">{label}</span>
          {subLabel ? <span className="text-[10px] tracking-[0.14em] text-[#9a9a9a]">{subLabel}</span> : null}
        </div>
        <span className="min-w-0 flex-1 truncate text-right text-[14px] text-[#888888]">{value || '未设置'}</span>
        <ChevronRight className="size-[15px] shrink-0 text-[#b5b5b5]" aria-hidden />
      </Pressable>
    )
  }
  return (
    <div className="flex w-full items-center gap-3 border-b-[0.5px] border-gray-100 px-4 py-3 text-left last:border-b-0">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[15px] text-[#111111]">{label}</span>
        {subLabel ? <span className="text-[10px] tracking-[0.14em] text-[#9a9a9a]">{subLabel}</span> : null}
      </div>
      <span className="min-w-0 flex-1 truncate text-right text-[14px] text-[#888888]">{value || '未设置'}</span>
    </div>
  )
}

function SectionRow({
  label,
  subLabel,
  value,
  trailing,
  onClick,
}: {
  label: string
  subLabel?: string
  value?: string
  trailing?: ReactNode
  onClick?: () => void
}) {
  if (onClick) {
    return (
      <Pressable
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 border-b-[0.5px] border-gray-100 px-4 py-3 text-left last:border-b-0 active:bg-gray-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] text-[#111111]">{label}</span>
            {subLabel ? <span className="text-[10px] tracking-[0.14em] text-[#9a9a9a]">{subLabel}</span> : null}
          </div>
          {value ? <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[#888888]">{value}</p> : null}
        </div>
        {trailing}
        <ChevronRight className="size-[15px] shrink-0 text-[#b5b5b5]" aria-hidden />
      </Pressable>
    )
  }
  return (
    <div className="flex w-full items-center gap-3 border-b-[0.5px] border-gray-100 px-4 py-3 text-left last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] text-[#111111]">{label}</span>
          {subLabel ? <span className="text-[10px] tracking-[0.14em] text-[#9a9a9a]">{subLabel}</span> : null}
        </div>
        {value ? <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[#888888]">{value}</p> : null}
      </div>
      {trailing}
    </div>
  )
}

export function ContactProfileCardScreen({
  target,
  remarkName,
  avatarUrl: avatarUrlProp,
  onBack,
  onOpenChat,
  onOpenProfileSettings,
  onOpenContactSettings,
  onOpenMoments,
}: ContactProfileCardScreenProps) {
  const { state } = useCustomization()
  const disableTransitions = state.ui.disablePageTransitions
  const [character, setCharacter] = useState<Character | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [callPanelOpen, setCallPanelOpen] = useState(false)
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)

  const characterId = target.kind === 'persona' ? target.characterId : WECHAT_LUMI_PEER_CHARACTER_ID

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const c = await personaDb.getCharacter(characterId)
        if (!cancelled) setCharacter(c ?? null)
      } catch {
        if (!cancelled) setCharacter(null)
      }
    }
    void load()
    const onStorage = () => void load()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('wechat-storage-changed', onStorage)
    }
  }, [characterId])

  const wechatNickLine = useMemo(() => {
    if (target.kind === 'lumi') return 'Lumi'
    const nick = character?.wechatNickname?.trim()
    const name = character?.name?.trim()
    return nick || name || '未设置'
  }, [target.kind, character])

  const headlineName = useMemo(() => {
    const r = character?.remark?.trim() || remarkName.trim()
    if (r) return r
    return wechatNickLine
  }, [character?.remark, remarkName, wechatNickLine])

  const wechatIdDisplay = useMemo(() => {
    const raw = character?.wechatId?.trim()
    if (raw) return raw
    const slug = characterId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'user'
    return `wxid_${slug}`
  }, [character, characterId])

  const genderUi = useMemo(() => mapGender(character?.gender), [character?.gender])

  const avatarSrc = useMemo(() => {
    const a = avatarUrlProp?.trim() || character?.avatarUrl?.trim()
    if (a) return a
    if (target.kind === 'lumi') return lumiDefaultAvatar
    return ''
  }, [avatarUrlProp, character?.avatarUrl, target.kind])

  const onAvatarClick = useCallback(() => {
    setAvatarPreviewOpen(true)
  }, [])

  const onMoments = useCallback(() => {
    if (onOpenMoments) {
      onOpenMoments()
      return
    }
    window.alert('朋友圈开发中')
  }, [onOpenMoments])

  const onFriendProfileInfo = useCallback(() => {
    if (target.kind === 'lumi') {
      setToast('Lumi 资料编辑暂不支持')
      window.setTimeout(() => setToast(null), 1800)
      return
    }
    onOpenContactSettings(target.characterId)
  }, [target, onOpenContactSettings])

  const momentsCoverUrl = character?.momentsCoverUrl?.trim() || ''
  const hasMomentsImage = Boolean(momentsCoverUrl)
  const momentThumbs = useMemo(() => {
    if (!momentsCoverUrl) return null
    return Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="h-12 w-12 shrink-0 overflow-hidden rounded-[4px] bg-[#ececec]">
        {i === 0 ? <img src={momentsCoverUrl} alt="" className="h-full w-full object-cover" /> : null}
      </div>
    ))
  }, [momentsCoverUrl])

  const summarySignature = character?.wechatSignature?.trim() || character?.motto?.trim() || '这个人很低调，什么也没写'
  const summaryRegion = character?.wechatRegion?.trim() || ''

  return (
    <motion.div
      initial={disableTransitions ? false : { opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={disableTransitions ? { opacity: 1, x: 0 } : { opacity: 0, x: 18 }}
      transition={disableTransitions ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full min-h-0 flex-col bg-[#f9f9f9]"
    >
      <header className="flex shrink-0 items-center justify-between border-b-[0.5px] border-gray-100 bg-white px-1 pb-1 pt-[max(6px,env(safe-area-inset-top,0px))]">
        <Pressable
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center active:opacity-60"
        >
          <ChevronLeft className="size-6 text-[#111111]" strokeWidth={1.5} />
        </Pressable>
        <span className="min-w-0 flex-1" />
        <Pressable
          type="button"
          aria-label="设置与备注"
          onClick={onOpenProfileSettings}
          className="flex h-11 w-11 items-center justify-center active:opacity-60"
        >
          <MoreHorizontal className="size-[20px] text-[#111111]" strokeWidth={1.8} />
        </Pressable>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="bg-white px-4 pb-4 pt-4">
          <div className="flex items-start gap-3">
            <Pressable
              type="button"
              onClick={onAvatarClick}
              className="h-[62px] w-[62px] shrink-0 overflow-hidden rounded-2xl bg-[#e6e6e6] active:opacity-90"
              aria-label="查看头像"
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[20px] text-[#b2b2b2]">?</div>
              )}
            </Pressable>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-[18px] font-semibold text-black">{headlineName}</h1>
                {genderUi !== 'private' ? <ContactProfileGenderGlyph kind={genderUi} /> : null}
              </div>
              <p className="mt-1 text-[14px] text-[#888888]">微信号：{wechatIdDisplay}</p>
            </div>
          </div>
        </div>

        <div className="mt-2 border-y-[0.5px] border-gray-100 bg-white">
          <ProfileInfoRow
            label="备注名"
            subLabel="REMARK"
            value={character?.remark?.trim() || '未设置'}
          />
          <ProfileInfoRow
            label="微信昵称"
            subLabel="NICKNAME"
            value={wechatNickLine || '未设置'}
          />
        </div>

        <div className="mt-2 border-y-[0.5px] border-gray-100 bg-white">
          <SectionRow
            label="朋友圈"
            subLabel="MOMENTS"
            onClick={onMoments}
            trailing={
              hasMomentsImage ? (
                <div className="flex items-center gap-1">{momentThumbs}</div>
              ) : (
                <span className="max-w-[170px] truncate text-[12px] text-[#b0b0b0]">该角色很神秘，什么都没留下</span>
              )
            }
          />
        </div>

        <div className="mt-2 border-y-[0.5px] border-gray-100 bg-white">
          <SectionRow
            label="地区"
            subLabel="REGION"
            value={summaryRegion}
          />
          <SectionRow
            label="个性签名"
            subLabel="SIGNATURE"
            value={summarySignature}
          />
          <SectionRow
            label="更多资料"
            subLabel="DETAILS"
            value="查看详细资料与权限设置"
            onClick={onFriendProfileInfo}
          />
        </div>

        <div className="mt-4 space-y-3 px-4 pb-[max(14px,env(safe-area-inset-bottom,0px))]">
          <Pressable
            type="button"
            onClick={onOpenChat}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-black text-white active:bg-[#202020]"
          >
            <MessageCircle className="size-[18px]" strokeWidth={1.8} />
            <span className="text-[16px] font-medium">发消息</span>
          </Pressable>
          <Pressable
            type="button"
            onClick={() => setCallPanelOpen(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-black bg-white text-black active:bg-gray-100"
          >
            <Phone className="size-[18px]" strokeWidth={1.8} />
            <span className="text-[16px]">音视频通话</span>
          </Pressable>
        </div>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed left-1/2 top-[max(48px,env(safe-area-inset-top,0px)+28px)] z-[60] -translate-x-1/2 rounded-[6px] bg-[#4c4c4c] px-4 py-2 text-[14px] text-white">
          {toast}
        </div>
      ) : null}

      <AnimatePresence>
        {avatarPreviewOpen ? (
          <motion.div
            key="avatar-preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 px-5"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setAvatarPreviewOpen(false)
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="max-h-[82vh] max-w-[82vw] overflow-hidden rounded-2xl"
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl bg-[#222] text-[24px] text-[#8f8f8f]">?</div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {callPanelOpen ? (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/20">
          <Pressable type="button" className="min-h-0 flex-1" aria-label="关闭" onClick={() => setCallPanelOpen(false)}>
            {null}
          </Pressable>
          <div className="rounded-t-2xl bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-4 text-center">
            <p className="text-[15px] text-[#111111]">音视频通话</p>
            <p className="mt-2 text-[13px] text-[#8e8e8e]">当前版本仅保留入口，通话页待接入</p>
            <Pressable
              type="button"
              onClick={() => setCallPanelOpen(false)}
              className="mt-4 h-11 w-full rounded-[10px] border border-black text-[16px] text-black active:bg-gray-100"
            >
              知道了
            </Pressable>
          </div>
        </div>
      ) : null}
    </motion.div>
  )
}
