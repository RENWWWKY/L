import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseMemorySourcePrefix } from '../wechat/memory/memorySourceBadges'
import type { CharacterMemory } from '../wechat/newFriendsPersona/types'
import { MeetMemoryPlaceholderToolbar } from './MeetMemoryPlaceholderToolbar'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import type { EncounterNPC, MeetPublicProfile } from './meetTypes'

export type DestinyArchiveMemoryEntrySheetProps = {
  open: boolean
  mode: 'create' | 'edit'
  nickname: string
  characterId: string
  npc: EncounterNPC | null
  meetProfile: MeetPublicProfile
  initial: CharacterMemory | null
  onClose: () => void
  onSave: (body: string) => void
}

export function DestinyArchiveMemoryEntrySheet({
  open,
  mode,
  nickname,
  characterId,
  npc,
  meetProfile,
  initial,
  onClose,
  onSave,
}: DestinyArchiveMemoryEntrySheetProps) {
  const portalEl = getLumiMeetPortalTarget()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState('')

  useEffect(() => {
    if (!open) return
    setBody(initial ? parseMemorySourcePrefix(initial.content).body : '')
  }, [open, initial])

  if (!portalEl) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="destiny-memory-entry-sheet"
          className="fixed inset-0 z-[340] flex flex-col justify-end bg-black/20 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="destiny-memory-entry-title"
            className="max-h-[min(88vh,560px)] w-full overflow-hidden rounded-t-[22px] border border-white/70 bg-white/82 shadow-[0_-24px_80px_rgba(28,24,18,0.16)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-black/10" aria-hidden />
            <div className="meet-scrollbar-hide max-h-[min(80vh,520px)] overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
              <p
                id="destiny-memory-entry-title"
                className="meet-caption-en text-center text-[10px] uppercase tracking-[0.38em] text-[#b8b5ad]"
              >
                {mode === 'create' ? 'New Memory | 新记忆' : 'Edit Memory | 修订记忆'}
              </p>
              <p className="mt-2 text-center font-elegant-serif text-[16px] tracking-[0.06em] text-[#2c2a26]">
                {mode === 'create' ? '添加邂逅记忆' : '修订邂逅记忆'}
              </p>
              <p className="mt-4 text-center text-[13px] font-light text-[#5c574f]">{nickname}</p>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-[#a39e96]">
                与微信记忆相同：正文保存 {'{{user}}'} / {'{{char}}'} 表达式；列表与下方预览会展开为姓名。
              </p>

              <label className="mt-6 block">
                <span className="meet-caption-en text-[9px] uppercase tracking-[0.28em] text-[#b8b5ad]">Memory | 记忆正文</span>
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="mt-2 w-full resize-none border-0 bg-transparent font-elegant-serif text-[14px] leading-relaxed text-[#4a4540] outline-none placeholder:text-[#c9c4bc]"
                  placeholder="例：{{user}} 与 {{char}} 在便利店聊了很久…"
                />
                <MeetMemoryPlaceholderToolbar
                  textareaRef={textareaRef}
                  value={body}
                  onChange={setBody}
                  characterId={characterId}
                  npc={npc}
                  meetProfile={meetProfile}
                />
              </label>

              <div className="mt-8 flex gap-3">
                <button type="button" onClick={onClose} className="meet-btn-secondary flex-1 py-3 text-[12px]">
                  取消
                </button>
                <button
                  type="button"
                  disabled={!body.trim()}
                  onClick={() => onSave(body.trim())}
                  className="flex-1 rounded-full border border-[#1a1918] bg-[#141312] py-3 text-[12px] font-medium tracking-[0.1em] text-[#D4AF37] disabled:opacity-40"
                >
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalEl,
  )
}
