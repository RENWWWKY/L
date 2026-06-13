import { Check, ChevronDown, ChevronLeft, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import { createContactTagId } from './momentsContactTagsStore'
import type { ContactTag, MomentContactRef, MomentPrivacyMode, NewMomentPrivacy } from './newMomentTypes'
import { buildPrivacyFromDraft } from './privacySelectionUtils'
import { useMomentsPrivacyPickableContacts } from './useMomentsPrivacyPickableContacts'

const PRIVACY_OPTIONS: {
  mode: MomentPrivacyMode
  title: string
  subtitle: string
}[] = [
  { mode: 'public', title: '公开', subtitle: '所有朋友可见' },
  { mode: 'private', title: '私密', subtitle: '仅自己可见' },
  { mode: 'shareWith', title: '部分可见', subtitle: '选中的标签或朋友可见' },
  { mode: 'hideFrom', title: '不给谁看', subtitle: '选中的标签或朋友不可见' },
]

type Props = {
  open: boolean
  value: NewMomentPrivacy
  contacts: MomentContactRef[]
  tags: ContactTag[]
  onAddTag: (tag: ContactTag) => void
  onClose: () => void
  onChange: (next: NewMomentPrivacy) => void
}

function SquareCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border ${
        checked ? 'border-black bg-black text-white' : 'border-gray-300 bg-white'
      }`}
    >
      {checked ? <Check className="size-3" strokeWidth={2.5} /> : null}
    </span>
  )
}

function ContactAvatar({ contact, size = 'md' }: { contact: MomentContactRef; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'size-8' : 'size-9'
  if (contact.avatarUrl) {
    return <img src={contact.avatarUrl} alt="" className={`${cls} shrink-0 rounded-lg object-cover`} />
  }
  return (
    <div
      className={`flex ${cls} shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] text-[#9CA3AF]`}
    >
      {contact.name.slice(0, 1)}
    </div>
  )
}

function CreateTagPanel({
  contacts,
  loading = false,
  onBack,
  onSave,
}: {
  contacts: MomentContactRef[]
  loading?: boolean
  onBack: () => void
  onSave: (tag: ContactTag) => void
}) {
  const [name, setName] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])

  const toggleMember = (id: string) => {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const canSave = name.trim().length > 0

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      className="flex h-full min-h-0 flex-col bg-white"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-3">
        <button type="button" onClick={onBack} className="flex size-9 items-center justify-center text-[#9CA3AF]">
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </button>
        <h3 className="min-w-0 flex-1 text-center text-[15px] font-semibold text-[#111827]">新建标签</h3>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            if (!canSave) return
            onSave({ id: createContactTagId(), name: name.trim(), memberIds: [...memberIds] })
          }}
          className={`px-2 text-[14px] font-medium ${canSave ? 'text-[#111827]' : 'text-[#D1D5DB]'}`}
        >
          保存
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <label className="block text-[12px] tracking-wide text-[#9CA3AF]">标签名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如 家人、高冷男主们"
          maxLength={24}
          className="mt-2 h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[15px] text-[#111827] outline-none focus:border-[#111827]"
        />

        <p className="mb-3 mt-6 text-[12px] tracking-wide text-[#9CA3AF]">
          从通讯录选择成员（可选，稍后可再编辑）
        </p>
        {loading ? (
          <p className="py-6 text-center text-[13px] text-[#9CA3AF]">加载通讯录…</p>
        ) : contacts.length ? (
          contacts.map((contact) => {
            const selected = memberIds.includes(contact.id)
            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => toggleMember(contact.id)}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <SquareCheckbox checked={selected} />
                <ContactAvatar contact={contact} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-[#111827]">{contact.name}</span>
              </button>
            )
          })
        ) : (
          <p className="py-6 text-center text-[13px] text-[#9CA3AF]">暂无通讯录好友</p>
        )}
      </div>
    </motion.div>
  )
}

export function PrivacySettingsModal({
  open,
  value,
  contacts,
  tags,
  onAddTag,
  onClose,
  onChange,
}: Props) {
  const { contacts: pickableContacts, loading: contactsLoading } = useMomentsPrivacyPickableContacts(
    open,
    contacts,
  )
  const contactById = useMemo(() => new Map(pickableContacts.map((c) => [c.id, c])), [pickableContacts])

  const [draftMode, setDraftMode] = useState<MomentPrivacyMode>(value.mode)
  const [checkedTagIds, setCheckedTagIds] = useState<string[]>(value.selectedTagIds ?? [])
  const [checkedContactIds, setCheckedContactIds] = useState<string[]>(value.selectedContactIds ?? [])
  const [expandedTagId, setExpandedTagId] = useState<string | null>(null)
  const [view, setView] = useState<'main' | 'createTag'>('main')

  useEffect(() => {
    if (!open) return
    setDraftMode(value.mode)
    setCheckedTagIds(value.selectedTagIds ?? [])
    const legacyContactIds =
      value.selectedContactIds ??
      (value.selectedTagIds?.length ? [] : value.contacts.map((c) => c.id))
    setCheckedContactIds(legacyContactIds)
    setExpandedTagId(null)
    setView('main')
  }, [open, value.contacts, value.mode, value.selectedContactIds, value.selectedTagIds])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const needsAudience = draftMode === 'shareWith' || draftMode === 'hideFrom'

  const toggleTag = (tagId: string) => {
    setCheckedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  const toggleContact = (contactId: string) => {
    setCheckedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId],
    )
  }

  const handleDone = () => {
    onChange(
      buildPrivacyFromDraft({
        mode: draftMode,
        selectedTagIds: checkedTagIds,
        selectedContactIds: checkedContactIds,
        contacts: pickableContacts,
        tags,
      }),
    )
    onClose()
  }

  const tagMembers = (tag: ContactTag) =>
    tag.memberIds.map((id) => contactById.get(id)).filter((c): c is MomentContactRef => !!c)

  const modalExpanded = view === 'createTag' || needsAudience

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-[480] flex items-center justify-center bg-gray-900/20 backdrop-blur-xl px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-modal-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 520, damping: 42 }}
            className={`relative flex w-[90%] max-w-sm flex-col overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] ${
              modalExpanded ? 'h-[min(85vh,640px)] max-h-[85vh]' : 'h-auto max-h-[min(85vh,640px)]'
            }`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {view === 'createTag' ? (
              <CreateTagPanel
                contacts={pickableContacts}
                loading={contactsLoading}
                onBack={() => setView('main')}
                onSave={(tag) => {
                  onAddTag(tag)
                  setCheckedTagIds((prev) => [...prev, tag.id])
                  if (!needsAudience) {
                    setDraftMode('shareWith')
                  }
                  setView('main')
                }}
              />
            ) : (
              <>
            <header className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-3.5">
              <button
                type="button"
                aria-label="关闭"
                onClick={onClose}
                className="flex size-9 items-center justify-center text-[#9CA3AF]"
              >
                <ChevronLeft className="size-5" strokeWidth={1.75} />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">Who Can See</p>
                <h2 id="privacy-modal-title" className="text-[16px] font-semibold text-[#111827]">
                  谁可以看
                </h2>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={handleDone}
                className="px-2 text-[14px] font-medium text-[#111827]"
              >
                完成
              </motion.button>
            </header>

            <div
              className={
                modalExpanded
                  ? 'min-h-0 flex-1 overflow-y-auto'
                  : 'overflow-y-auto pb-1'
              }
            >
                  <div className="px-2 py-2">
                      {PRIVACY_OPTIONS.map((opt) => {
                        const selected = draftMode === opt.mode
                        return (
                          <button
                            key={opt.mode}
                            type="button"
                            onClick={() => setDraftMode(opt.mode)}
                            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-gray-50/80"
                          >
                            <span
                              className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border ${
                                selected ? 'border-black' : 'border-[#D1D5DB]'
                              }`}
                            >
                              {selected ? <span className="size-2 rounded-full bg-black" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] font-medium text-[#111827]">{opt.title}</span>
                              <span className="mt-0.5 block text-[12px] text-[#9CA3AF]">{opt.subtitle}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <AnimatePresence initial={false}>
                      {needsAudience ? (
                        <motion.div
                          key="tag-panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                          className="overflow-hidden border-t border-gray-100"
                        >
                          <div className="px-6 py-3">
                            <p className="text-[12px] font-medium tracking-wide text-[#9CA3AF]">标签分组</p>

                            <div className="mt-2 max-h-[min(28vh,220px)] overflow-y-auto">
                              {tags.length ? (
                                tags.map((tag) => {
                                  const checked = checkedTagIds.includes(tag.id)
                                  const expanded = expandedTagId === tag.id
                                  const members = tagMembers(tag)
                                  return (
                                    <div key={tag.id} className="border-b border-gray-50 last:border-0">
                                      <div className="flex items-center gap-2 py-3">
                                        <button
                                          type="button"
                                          onClick={() => toggleTag(tag.id)}
                                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                        >
                                          <SquareCheckbox checked={checked} />
                                          <span className="truncate text-[15px] text-[#111827]">{tag.name}</span>
                                          <span className="shrink-0 text-[11px] text-[#D1D5DB]">
                                            {members.length ? `${members.length} 人` : '暂无成员'}
                                          </span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setExpandedTagId(expanded ? null : tag.id)}
                                          className="flex shrink-0 items-center gap-1 px-2 py-1 text-[11px] text-[#9CA3AF]"
                                        >
                                          成员
                                          <ChevronDown
                                            className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                            strokeWidth={1.75}
                                          />
                                        </button>
                                      </div>
                                      <AnimatePresence initial={false}>
                                        {expanded ? (
                                          <motion.div
                                            key="members"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ type: 'spring', stiffness: 440, damping: 36 }}
                                            className="overflow-hidden pb-3"
                                          >
                                            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                              {members.length ? (
                                                members.map((member) => (
                                                  <div
                                                    key={member.id}
                                                    className="flex w-14 shrink-0 flex-col items-center"
                                                  >
                                                    <ContactAvatar contact={member} size="sm" />
                                                    <p className="mt-1 w-full truncate text-center text-[10px] leading-snug text-[#9CA3AF]">
                                                      {member.name}
                                                    </p>
                                                  </div>
                                                ))
                                              ) : (
                                                <p className="py-2 text-[12px] text-[#9CA3AF]">该标签暂无成员</p>
                                              )}
                                            </div>
                                          </motion.div>
                                        ) : null}
                                      </AnimatePresence>
                                    </div>
                                  )
                                })
                              ) : (
                                <p className="py-4 text-center text-[13px] text-[#9CA3AF]">暂无标签</p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setView('createTag')}
                              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#E5E7EB] bg-gray-50/50 py-3.5 text-[13px] font-medium text-[#6B7280] transition-colors hover:border-[#D1D5DB] hover:bg-gray-50 hover:text-[#111827]"
                            >
                              <Plus className="size-4" strokeWidth={1.5} />
                              新建标签
                            </button>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                      {needsAudience ? (
                        <motion.div
                          key="audience-panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                          className="overflow-hidden border-t border-gray-100"
                        >
                          <div className="border-b border-gray-100 px-6 py-3">
                            <div className="flex w-full items-center justify-between text-left">
                              <span className="text-[13px] font-medium text-[#111827]">从通讯录选择</span>
                              <span className="text-[12px] text-[#9CA3AF]">
                                {checkedContactIds.length ? `已选 ${checkedContactIds.length} 人` : '未选择'}
                              </span>
                            </div>
                          </div>

                          <div className="max-h-[min(32vh,260px)] overflow-y-auto px-6 py-2">
                            {contactsLoading ? (
                              <p className="py-6 text-center text-[13px] text-[#9CA3AF]">加载通讯录…</p>
                            ) : pickableContacts.length ? (
                              pickableContacts.map((contact) => {
                                const checked = checkedContactIds.includes(contact.id)
                                return (
                                  <button
                                    key={contact.id}
                                    type="button"
                                    onClick={() => toggleContact(contact.id)}
                                    className="flex w-full items-center gap-3 border-b border-gray-50 py-3 text-left last:border-0"
                                  >
                                    <SquareCheckbox checked={checked} />
                                    <ContactAvatar contact={contact} />
                                    <span className="min-w-0 flex-1 truncate text-[15px] text-[#111827]">
                                      {contact.name}
                                    </span>
                                  </button>
                                )
                              })
                            ) : (
                              <p className="py-6 text-center text-[13px] text-[#9CA3AF]">暂无通讯录好友</p>
                            )}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
            </div>
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
