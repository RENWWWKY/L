import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { useCustomization } from '../../CustomizationContext'
import { Pressable } from '../../components/Pressable'
import { personaDb } from './newFriendsPersona/idb'
import type { Character } from './newFriendsPersona/types'

export function ContactProfileSettingsScreen({
  characterId,
  onOpenRecommend,
  onOpenComplaint,
  onBlockedAndBack,
  onDeleteContact,
}: {
  characterId: string
  onOpenRecommend: () => void
  onOpenComplaint: () => void
  onBlockedAndBack: () => void
  onDeleteContact: (notifyPeer: boolean) => void | Promise<void>
}) {
  const { replaceWeChatPersonaContacts } = useCustomization()
  const [character, setCharacter] = useState<Character | null>(null)
  const [remarkDraft, setRemarkDraft] = useState('')
  const [remarkOpen, setRemarkOpen] = useState(false)
  const [remarkExitConfirmOpen, setRemarkExitConfirmOpen] = useState(false)
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false)
  const [deletePanelOpen, setDeletePanelOpen] = useState(false)

  const loadCharacter = useCallback(async () => {
    const next = await personaDb.getCharacter(characterId)
    setCharacter(next)
  }, [characterId])

  useEffect(() => {
    // 避免在 effect 同步触发 setState 的 lint 警告
    const t = window.setTimeout(() => void loadCharacter(), 0)
    const onStorage = () => void loadCharacter()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('wechat-storage-changed', onStorage)
    }
  }, [loadCharacter])

  const syncPersonaContact = useCallback(
    (next: Character | null) => {
      if (!next) return
      replaceWeChatPersonaContacts([next.id], [
        {
          id: `persona-${next.id}`,
          characterId: next.id,
          remarkName: (next.remark?.trim() || next.wechatNickname?.trim() || next.name || '未命名').slice(0, 64),
          avatarUrl: next.avatarUrl?.trim() || undefined,
          isStarred: !!next.isStarred,
        },
      ])
    },
    [replaceWeChatPersonaContacts],
  )

  const updateContact = useCallback(
    async (patch: Partial<Pick<Character, 'remark' | 'isStarred' | 'isBlocked' | 'momentsPermission'>>) => {
      const next = await personaDb.updateCharacterContactSettings(characterId, patch)
      if (!next) return
      setCharacter(next)
      syncPersonaContact(next)
    },
    [characterId, syncPersonaContact],
  )

  const openRemarkSheet = useCallback(() => {
    setRemarkDraft(character?.remark?.trim() || '')
    setRemarkOpen(true)
  }, [character?.remark])

  const remarkDirty = remarkDraft.trim() !== (character?.remark?.trim() || '')
  const tryCloseRemarkSheet = useCallback(() => {
    if (!remarkDirty) {
      setRemarkOpen(false)
      return
    }
    setRemarkExitConfirmOpen(true)
  }, [remarkDirty])

  const momentsBlocked = !!character?.momentsPermission?.blocked
  const isStarred = !!character?.isStarred

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f5f5]">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-3">
        <div className="space-y-3">
          <SettingCardButton label="编辑备注" onClick={openRemarkSheet} />
          <SettingCardSwitch
            label="不让他看我朋友圈"
            checked={momentsBlocked}
            onChange={(checked) => void updateContact({ momentsPermission: { blocked: checked } })}
          />
          <SettingCardButton label="把TA推荐给朋友" onClick={onOpenRecommend} />
          <SettingCardSwitch
            label="设为星标朋友"
            checked={isStarred}
            onChange={(checked) => void updateContact({ isStarred: checked })}
          />
          <DangerCardButton label="删除联系人" onClick={() => setDeletePanelOpen(true)} />
          <DangerCardButton label="加入黑名单" onClick={() => setBlockConfirmOpen(true)} />
          <DangerCardButton label="投诉" onClick={onOpenComplaint} />
        </div>
      </div>

      <AnimatePresence>
        {remarkOpen ? (
          <ModalMask onClose={tryCloseRemarkSheet}>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-t-[18px] bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-4"
            >
              <div className="pb-3 text-center text-[17px] font-medium text-black">设置备注</div>
              <div className="rounded-[12px] bg-[#f5f5f5] px-3 py-3">
                <input
                  autoFocus
                  value={remarkDraft}
                  onChange={(e) => setRemarkDraft(e.target.value.slice(0, 64))}
                  placeholder="请输入备注"
                  className="w-full bg-transparent text-[16px] text-black outline-none placeholder:text-[#a3a3a3]"
                />
              </div>
              <div className="mt-4 flex gap-3">
                <BottomActionButton label="取消" onClick={tryCloseRemarkSheet} />
                <BottomActionButton
                  label="确定"
                  primary
                  onClick={() => {
                    void updateContact({ remark: remarkDraft.trim() })
                    setRemarkOpen(false)
                    setRemarkExitConfirmOpen(false)
                  }}
                />
              </div>
            </motion.div>
          </ModalMask>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {remarkExitConfirmOpen ? (
          <ModalMask dark onClose={() => setRemarkExitConfirmOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="mx-8 overflow-hidden rounded-[14px] bg-white"
            >
              <div className="px-5 pb-4 pt-5 text-center">
                <div className="text-[17px] font-medium text-black">未保存修改</div>
                <p className="mt-2 text-[14px] leading-6 text-[#666]">
                  你有未保存的资料修改，确定要退出吗？未保存的内容将会丢失。
                </p>
              </div>
              <div className="flex border-t border-[#e5e5e5]">
                <DialogButton label="取消" onClick={() => setRemarkExitConfirmOpen(false)} />
                <div className="w-px bg-[#e5e5e5]" aria-hidden />
                <DialogButton
                  label="不保存退出"
                  onClick={() => {
                    setRemarkExitConfirmOpen(false)
                    setRemarkOpen(false)
                  }}
                />
                <div className="w-px bg-[#e5e5e5]" aria-hidden />
                <DialogButton
                  label="保存并退出"
                  onClick={() => {
                    void updateContact({ remark: remarkDraft.trim() })
                    setRemarkExitConfirmOpen(false)
                    setRemarkOpen(false)
                  }}
                />
              </div>
            </motion.div>
          </ModalMask>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {deletePanelOpen ? (
          <ModalMask dark center onClose={() => setDeletePanelOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden rounded-[14px] bg-white"
            >
              <div className="px-5 pb-4 pt-5 text-center">
                <div className="text-[17px] font-medium text-black">删除联系人</div>
                <p className="mt-2 text-[14px] leading-6 text-[#666]">
                  删除后可选择是否告知对方。若告知，对方会再次发送好友申请并询问怎么回事。
                </p>
              </div>
              <div className="border-t border-[#e5e5e5] p-3">
                <div className="grid gap-2">
                  <Pressable
                    type="button"
                    className="h-11 w-full rounded-[12px] bg-[#ff3b30] text-[16px] font-semibold text-white active:opacity-90"
                    onClick={() => {
                      void onDeleteContact(false)
                      setDeletePanelOpen(false)
                    }}
                  >
                    不告知对方，直接删除
                  </Pressable>
                  <Pressable
                    type="button"
                    className="h-11 w-full rounded-[12px] border border-[#ff3b30]/35 bg-white text-[16px] font-semibold text-[#ff3b30] active:bg-[#fff5f5]"
                    onClick={() => {
                      void onDeleteContact(true)
                      setDeletePanelOpen(false)
                    }}
                  >
                    告知对方（会发来新好友申请）
                  </Pressable>
                  <Pressable
                    type="button"
                    className="h-11 w-full rounded-[12px] bg-[#f2f2f2] text-[16px] text-black active:bg-[#e9e9e9]"
                    onClick={() => setDeletePanelOpen(false)}
                  >
                    取消
                  </Pressable>
                </div>
              </div>
            </motion.div>
          </ModalMask>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {blockConfirmOpen ? (
          <ModalMask dark onClose={() => setBlockConfirmOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="mx-8 overflow-hidden rounded-[14px] bg-white"
            >
              <div className="px-5 pb-4 pt-5 text-center">
                <div className="text-[17px] font-medium text-black">加入黑名单</div>
                <p className="mt-2 text-[14px] leading-6 text-[#666]">
                  加入黑名单后，你将不再收到对方的消息，并且你们互相看不到对方的朋友圈更新
                </p>
              </div>
              <div className="flex border-t border-[#e5e5e5]">
                <DialogButton label="取消" onClick={() => setBlockConfirmOpen(false)} />
                <div className="w-px bg-[#e5e5e5]" aria-hidden />
                <DialogButton
                  label="确定"
                  danger
                  onClick={() => {
                    void updateContact({ isBlocked: true })
                    setBlockConfirmOpen(false)
                    onBlockedAndBack()
                  }}
                />
              </div>
            </motion.div>
          </ModalMask>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SettingCardButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      className="flex w-full items-center rounded-[12px] bg-white px-4 py-[15px] text-left active:bg-[#f7f7f7]"
    >
      <span className="flex-1 text-[17px] text-black">{label}</span>
      <ChevronRight className="size-[18px] shrink-0 text-[#c7c7cc]" aria-hidden />
    </Pressable>
  )
}

function SettingCardSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center rounded-[12px] bg-white px-4 py-[14px]">
      <span className="flex-1 text-[17px] text-black">{label}</span>
      <Pressable
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-[52px] rounded-full p-1 transition-colors ${
          checked ? 'bg-black' : 'bg-[#cccccc]'
        }`}
      >
        <span
          className={`block h-6 w-6 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </Pressable>
    </div>
  )
}

function DangerCardButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      className="w-full rounded-[12px] bg-white px-4 py-[15px] text-center text-[17px] text-[#ff3b30] active:bg-[#f7f7f7]"
    >
      {label}
    </Pressable>
  )
}

function ModalMask({
  children,
  onClose,
  dark = false,
  center = false,
}: {
  children: ReactNode
  onClose: () => void
  dark?: boolean
  center?: boolean
}) {
  if (center) {
    return (
      <div className={`fixed inset-0 z-[80] flex items-center justify-center ${dark ? 'bg-black/35' : 'bg-black/20'}`}>
        <Pressable type="button" className="absolute inset-0" aria-label="关闭" onClick={onClose}>
          {null}
        </Pressable>
        <div className="relative z-[1] w-full max-w-[420px] px-6">{children}</div>
      </div>
    )
  }
  return (
    <div className={`fixed inset-0 z-[80] flex flex-col justify-end ${dark ? 'bg-black/35' : 'bg-black/20'}`}>
      <Pressable type="button" className="min-h-0 flex-1" aria-label="关闭" onClick={onClose}>
        {null}
      </Pressable>
      {children}
    </div>
  )
}

function BottomActionButton({
  label,
  onClick,
  primary = false,
  danger = false,
}: {
  label: string
  onClick: () => void
  primary?: boolean
  danger?: boolean
}) {
  const modeClass = primary ? 'bg-black text-white' : danger ? 'bg-[#fff1f0] text-[#ff3b30]' : 'bg-[#f2f2f2] text-black'
  return (
    <Pressable
      type="button"
      onClick={onClick}
      className={`flex h-11 flex-1 items-center justify-center rounded-[12px] text-[16px] ${modeClass}`}
    >
      {label}
    </Pressable>
  )
}

function DialogButton({
  label,
  onClick,
  danger = false,
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      className={`flex h-12 flex-1 items-center justify-center text-[17px] ${danger ? 'text-[#ff3b30]' : 'text-black'}`}
    >
      {label}
    </Pressable>
  )
}
