import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { useCustomization } from '../../../CustomizationContext'
import { ContactProfileGenderGlyph } from '../ContactProfileGenderIcons'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import { WECHAT_LUMI_PEER_CHARACTER_ID } from '../wechatConversationKey'

function mapGender(g: Character['gender'] | undefined | null): 'male' | 'female' | 'private' {
  if (g === 'male') return 'male'
  if (g === 'female') return 'female'
  return 'private'
}

export type StrangerProfilePageProps = {
  characterId: string
  onBack: () => void
  onRequestAdd: () => void
}

export function StrangerProfilePage({ characterId, onBack, onRequestAdd }: StrangerProfilePageProps) {
  const { state } = useCustomization()
  const [character, setCharacter] = useState<Character | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const c = await personaDb.getCharacter(characterId)
        if (!cancelled) setCharacter(c ?? null)
      } catch {
        if (!cancelled) setCharacter(null)
      }
    })()
    const on = () => {
      void (async () => {
        try {
          const c = await personaDb.getCharacter(characterId)
          if (!cancelled) setCharacter(c ?? null)
        } catch {
          if (!cancelled) setCharacter(null)
        }
      })()
    }
    window.addEventListener('wechat-storage-changed', on)
    return () => {
      cancelled = true
      window.removeEventListener('wechat-storage-changed', on)
    }
  }, [characterId])

  const isFriend = useMemo(
    () => state.wechatPersonaContacts.some((c) => c.characterId === characterId),
    [characterId, state.wechatPersonaContacts],
  )

  const wechatNick = character?.wechatNickname?.trim() || character?.name?.trim() || '未设置'
  const wechatIdDisplay = useMemo(() => {
    const raw = character?.wechatId?.trim()
    if (raw) return raw
    const slug = characterId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'user'
    return `wxid_${slug}`
  }, [character, characterId])

  const genderUi = useMemo(() => mapGender(character?.gender), [character?.gender])
  const region = character?.wechatRegion?.trim() || ''
  const signature =
    character?.wechatSignature?.trim() || character?.motto?.trim() || '这个人很低调，什么也没写'

  const avatarSrc = character?.avatarUrl?.trim() || ''

  const blockedLumi = characterId === WECHAT_LUMI_PEER_CHARACTER_ID

  const genderLabel =
    character?.gender === 'male'
      ? '男'
      : character?.gender === 'female'
        ? '女'
        : character?.gender === 'other'
          ? '其他'
          : '私密'

  return (
    <motion.div className="flex h-full min-h-0 flex-col bg-white pb-[max(12px,env(safe-area-inset-bottom))]">
      <header className="flex shrink-0 items-center border-b border-[#EBEBEB] bg-white px-1 pb-1 pt-[max(8px,env(safe-area-inset-top,0px))]">
        <Pressable
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center active:opacity-55"
        >
          <ChevronLeft className="size-6 text-[#111111]" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 pr-10 text-center">
          <p className="text-[10px] font-medium tracking-[0.22em] text-[#8A8A8A]">PROFILE</p>
          <p className="text-[15px] font-medium text-[#111111]">资料</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-8">
        <div className="flex flex-col items-center">
          <div className="h-[100px] w-[100px] overflow-hidden rounded-[22px] border border-[#E8E8E8] bg-[#F5F5F5]">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[20px] text-[#C4C4C4]">—</div>
            )}
          </div>
          <div className="mt-5 flex items-center gap-2">
            <h1 className="text-center text-[21px] font-medium tracking-tight text-[#111111]">{wechatNick}</h1>
            {genderUi !== 'private' ? <ContactProfileGenderGlyph kind={genderUi} /> : null}
          </div>

          <div className="mt-6 w-full max-w-[320px]">
            <p className="text-[10px] font-medium tracking-[0.18em] text-[#8A8A8A]">个性签名</p>
            <div className="mt-2 rounded-[12px] border border-[#EBEBEB] bg-[#FAFAFA] px-4 py-3">
              <p className="text-left text-[14px] leading-[1.7] text-[#333333]">{signature}</p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 w-full max-w-[320px] overflow-hidden rounded-[12px] border border-[#EBEBEB] bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-[#F0F0F0] px-4 py-3.5">
            <span className="shrink-0 text-[14px] text-[#8A8A8A]">微信号</span>
            <span className="min-w-0 truncate text-right font-mono text-[13px] text-[#111111]">{wechatIdDisplay}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-[#F0F0F0] px-4 py-3.5">
            <span className="text-[14px] text-[#8A8A8A]">性别</span>
            <span className="text-[14px] text-[#111111]">{genderLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <span className="text-[14px] text-[#8A8A8A]">地区</span>
            <span className="text-[14px] text-[#111111]">{region || '—'}</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-5 pt-4">
        <motion.button
          type="button"
          disabled={isFriend || blockedLumi}
          whileTap={isFriend || blockedLumi ? undefined : { scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 520, damping: 38 }}
          onClick={() => {
            if (isFriend || blockedLumi) return
            onRequestAdd()
          }}
          className="flex h-[50px] w-full items-center justify-center rounded-full bg-[#111111] text-[15px] font-medium tracking-[0.04em] text-white disabled:bg-[#E8E8E8] disabled:text-[#A3A3A3]"
        >
          {blockedLumi ? '系统通道 · 无需添加' : isFriend ? '已在通讯录' : '添加到通讯录'}
        </motion.button>
      </div>
    </motion.div>
  )
}
