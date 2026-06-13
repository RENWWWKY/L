import { AtSign, ChevronRight, Eye, MapPin, Plus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useId, useMemo, useRef, useState } from 'react'
import TextareaAutosize from 'react-textarea-autosize'

import {
  createEmptyNewMoment,
  formatLocationPreview,
  formatMentionPreview,
  formatPrivacyPreview,
  isNewMomentPublishable,
  type MomentContactRef,
  type NewMomentDraft,
} from './newMomentTypes'
import {
  MAX_MOMENT_IMAGES,
  MOMENT_BODY_MAX_CHARS,
} from './momentContentLimits'
import { PrivacySettingsModal } from './PrivacySettingsModal'
import { useMomentsContactTags } from './momentsContactTagsStore'
import { filterMentionableMomentContacts } from './publishMomentUtils'
import {
  compressChatImageToJpeg,
  loadImageFromFile,
} from '../../phone/apps/wechat/wechatChatImageCompress'

const MAX_IMAGES = MAX_MOMENT_IMAGES

type SettingsRowProps = {
  icon: React.ReactNode
  label: string
  value: string
  onClick?: () => void
}

function SettingsRow({ icon, label, value, onClick }: SettingsRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 py-4 text-left"
    >
      <span className="flex size-5 shrink-0 items-center justify-center text-[#9CA3AF]">{icon}</span>
      <span className="min-w-0 flex-1 text-[15px] text-[#111827]">{label}</span>
      <span className="max-w-[42%] truncate text-[12px] text-[#9CA3AF]">{value}</span>
      <ChevronRight className="size-4 shrink-0 text-[#D1D5DB]" strokeWidth={1.75} />
    </button>
  )
}

type PublishMomentPageProps = {
  open: boolean
  contacts?: MomentContactRef[]
  onClose: () => void
  onPublish: (draft: NewMomentDraft) => void
}

export function PublishMomentPage({ open, contacts = [], onClose, onPublish }: PublishMomentPageProps) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const titleId = useId()
  const [draft, setDraft] = useState<NewMomentDraft>(() => createEmptyNewMoment())
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [locationDraft, setLocationDraft] = useState('')
  const { tags, addTag } = useMomentsContactTags()

  const canPublish = isNewMomentPublishable(draft)

  /** 提醒谁看：仅通讯录好友，不可选自己 */
  const mentionContacts = useMemo(() => filterMentionableMomentContacts(contacts), [contacts])

  const resetDraft = useCallback(() => {
    setDraft(createEmptyNewMoment())
    setLocationDraft('')
    setPrivacyOpen(false)
    setLocationOpen(false)
    setMentionOpen(false)
  }, [])

  const handleClose = () => {
    resetDraft()
    onClose()
  }

  const onPickImages = (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_IMAGES - draft.images.length
    if (room <= 0) return
    void (async () => {
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith('image/')) continue
        try {
          const img = await loadImageFromFile(file)
          const base64 = await compressChatImageToJpeg({
            source: img,
            width: img.naturalWidth,
            height: img.naturalHeight,
          })
          const src = `data:image/jpeg;base64,${base64}`
          setDraft((prev) => {
            if (prev.images.length >= MAX_IMAGES) return prev
            return { ...prev, images: [...prev.images, src] }
          })
        } catch {
          /* 单张失败跳过 */
        }
      }
    })()
  }

  const removeImage = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }))
  }

  const toggleMention = (contact: MomentContactRef) => {
    setDraft((prev) => {
      const exists = prev.mentions.some((c) => c.id === contact.id)
      return {
        ...prev,
        mentions: exists
          ? prev.mentions.filter((c) => c.id !== contact.id)
          : [...prev.mentions, contact],
      }
    })
  }

  const submit = () => {
    if (!canPublish) return
    onPublish({
      ...draft,
      content: draft.content.trim(),
      mentions: draft.mentions.filter((m) => m.id !== 'self'),
    })
    resetDraft()
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-[440] flex flex-col bg-white"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 42 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header
            className="flex shrink-0 items-center justify-between px-4 pb-3 pt-[max(10px,env(safe-area-inset-top,0px))]"
            style={{ background: '#FFFFFF' }}
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleClose}
              className="rounded-full px-1 py-2 text-[15px] text-[#9CA3AF]"
            >
              取消
            </motion.button>
            <span id={titleId} className="sr-only">
              发布朋友圈
            </span>
            <motion.button
              type="button"
              whileTap={canPublish ? { scale: 0.96 } : undefined}
              disabled={!canPublish}
              onClick={submit}
              className={`rounded-full px-5 py-2 text-[14px] font-medium transition-colors duration-200 ${
                canPublish ? 'bg-black text-white' : 'bg-gray-100 text-[#E5E7EB]'
              }`}
            >
              发表
            </motion.button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TextareaAutosize
              value={draft.content}
              maxLength={MOMENT_BODY_MAX_CHARS}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  content: e.target.value.slice(0, MOMENT_BODY_MAX_CHARS),
                }))
              }
              minRows={4}
              placeholder="这一刻的想法... (Share your thoughts)"
              className="w-full resize-none border-none bg-transparent p-6 pb-2 text-[16px] leading-relaxed text-[#111827] placeholder:italic placeholder:text-[#9CA3AF] focus:outline-none focus:ring-0"
            />
            <p className="px-6 pb-2 text-right text-[11px] tabular-nums text-[#9CA3AF]">
              {draft.content.length}/{MOMENT_BODY_MAX_CHARS}
            </p>

            <div className="grid grid-cols-3 gap-2 px-6 pb-6">
              <AnimatePresence initial={false}>
                {draft.images.map((src, index) => (
                  <motion.div
                    key={src}
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                    className="relative aspect-square overflow-hidden rounded-xl"
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label="删除图片"
                      onClick={() => removeImage(index)}
                      className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
                    >
                      <X className="size-3" strokeWidth={2.5} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {draft.images.length < MAX_IMAGES ? (
                <motion.button
                  type="button"
                  layout
                  whileTap={{ scale: 0.97 }}
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-gray-50"
                >
                  <Plus className="size-6 text-[#9CA3AF]" strokeWidth={1.5} />
                </motion.button>
              ) : null}
            </div>

            <div className="h-2 w-full bg-gray-50/50" />

            <div className="px-6">
              <SettingsRow
                icon={<MapPin className="size-[18px]" strokeWidth={1.6} />}
                label="所在位置"
                value={formatLocationPreview(draft.location)}
                onClick={() => {
                  setLocationDraft(draft.location ?? '')
                  setLocationOpen(true)
                }}
              />
              <SettingsRow
                icon={<AtSign className="size-[18px]" strokeWidth={1.6} />}
                label="提醒谁看"
                value={formatMentionPreview(draft.mentions)}
                onClick={() => setMentionOpen(true)}
              />
              <SettingsRow
                icon={<Eye className="size-[18px]" strokeWidth={1.6} />}
                label="谁可以看"
                value={formatPrivacyPreview(draft.privacy, tags)}
                onClick={() => setPrivacyOpen(true)}
              />
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onPickImages(e.target.files)
              e.currentTarget.value = ''
            }}
          />

          <PrivacySettingsModal
            open={privacyOpen}
            value={draft.privacy}
            contacts={contacts}
            tags={tags}
            onAddTag={addTag}
            onClose={() => setPrivacyOpen(false)}
            onChange={(privacy) => setDraft((prev) => ({ ...prev, privacy }))}
          />

          <AnimatePresence>
            {locationOpen ? (
              <motion.div
                className="absolute inset-0 z-[470] flex flex-col justify-end bg-black/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setLocationOpen(false)
                }}
              >
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 42 }}
                  className="rounded-t-[28px] bg-white/95 px-6 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-4 backdrop-blur-2xl"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <p className="text-[15px] font-semibold text-[#111827]">所在位置</p>
                  <input
                    value={locationDraft}
                    onChange={(e) => setLocationDraft(e.target.value)}
                    placeholder="省/市·区·地点，留空则不显示"
                    className="mt-3 h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[14px] text-[#111827] outline-none focus:border-[#111827]"
                  />
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, location: null }))
                        setLocationOpen(false)
                      }}
                      className="flex-1 rounded-full border border-[#E5E7EB] py-3 text-[14px] text-[#9CA3AF]"
                    >
                      不显示
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const t = locationDraft.trim()
                        setDraft((prev) => ({ ...prev, location: t || null }))
                        setLocationOpen(false)
                      }}
                      className="flex-1 rounded-full bg-black py-3 text-[14px] font-medium text-white"
                    >
                      完成
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {mentionOpen ? (
              <motion.div
                className="absolute inset-0 z-[470] flex flex-col justify-end bg-black/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setMentionOpen(false)
                }}
              >
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 42 }}
                  className="max-h-[min(70vh,520px)] rounded-t-[28px] bg-white/95 backdrop-blur-2xl"
                  style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="px-6 pt-4">
                    <p className="text-[15px] font-semibold text-[#111827]">提醒谁看</p>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto px-6">
                    {mentionContacts.length ? (
                      mentionContacts.map((contact) => {
                        const selected = draft.mentions.some((c) => c.id === contact.id)
                        return (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => toggleMention(contact)}
                            className="flex w-full items-center gap-3 py-3 text-left"
                          >
                            {contact.avatarUrl ? (
                              <img src={contact.avatarUrl} alt="" className="size-9 rounded-lg object-cover" />
                            ) : (
                              <div className="flex size-9 items-center justify-center rounded-lg bg-gray-100 text-[12px] text-[#9CA3AF]">
                                {contact.name.slice(0, 1)}
                              </div>
                            )}
                            <span className="min-w-0 flex-1 truncate text-[15px] text-[#111827]">
                              {contact.name}
                            </span>
                            <span
                              className={`flex size-5 items-center justify-center rounded-full border ${
                                selected ? 'border-black bg-black text-white' : 'border-[#D1D5DB]'
                              }`}
                            >
                              {selected ? <span className="size-2 rounded-full bg-white" /> : null}
                            </span>
                          </button>
                        )
                      })
                    ) : (
                      <p className="py-8 text-center text-[13px] text-[#9CA3AF]">暂无通讯录联系人</p>
                    )}
                  </div>
                  <div className="px-6 pt-2">
                    <button
                      type="button"
                      onClick={() => setMentionOpen(false)}
                      className="w-full rounded-full bg-black py-3.5 text-[15px] font-medium text-white"
                    >
                      完成
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
