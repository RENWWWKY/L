import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ComprehensivePersona } from './comprehensivePersona'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import { getMeetEpilogueImpressionEntryId, getMeetNineDossierEntryId } from './meetPersonaWorldbookSync'
import { useWorldbookStore } from '../../worldbook/worldbookLoreStore'
import type { MeetPublicProfile } from './meetTypes'
import { expandComprehensivePersonaPlaceholders, resolveMeetCharUserNames } from './meetPersonaPreview'
import { NineDimensionAccordion } from './nineDimensionAccordion'

const PLATINUM = '#D4AF37'

/**
 * 遇见内「世界书」结构预览：分册 + 九条条目（心动前即可查看，不跳转档案室）
 */
export function MeetWorldbookShelfModal({
  open,
  onClose,
  npcId,
  nickname,
  avatarUrl,
  dossier,
  meetProfile,
}: {
  open: boolean
  onClose: () => void
  npcId: string
  nickname: string
  avatarUrl: string
  dossier: ComprehensivePersona
  meetProfile: MeetPublicProfile
}) {
  const portalEl = getLumiMeetPortalTarget()
  const volCharacterId = `meet-wb-${npcId}`
  const loreEntryId = getMeetNineDossierEntryId(npcId)
  const epilogueLoreId = getMeetEpilogueImpressionEntryId(npcId)
  const { entries: loreEntries } = useWorldbookStore()
  const epilogueLore = useMemo(
    () => loreEntries.find((e) => e.id === epilogueLoreId) ?? null,
    [epilogueLoreId, loreEntries],
  )
  const [showLoreMeta, setShowLoreMeta] = useState(false)
  const [showEpilogueSection, setShowEpilogueSection] = useState(false)
  const previewDossier = useMemo(
    () => expandComprehensivePersonaPlaceholders(dossier, resolveMeetCharUserNames(nickname, meetProfile)),
    [dossier, meetProfile, nickname],
  )

  useEffect(() => {
    if (!open) {
      setShowLoreMeta(false)
      setShowEpilogueSection(false)
    }
  }, [open])

  if (!portalEl) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="wb-shelf"
          className="pointer-events-auto fixed inset-0 z-[310] flex flex-col bg-[#fdfcfa]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <header
            className="flex shrink-0 items-center gap-3 border-b border-black/[0.06] bg-white/90 px-4 pb-3 backdrop-blur-md"
            style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#2c2a26] active:bg-black/[0.04]"
              aria-label="关闭"
            >
              <X className="size-5" strokeWidth={1.25} />
            </button>
            <img
              src={avatarUrl}
              alt=""
              className="size-11 shrink-0 rounded-2xl object-cover ring-1 ring-black/[0.06]"
            />
            <div className="min-w-0 flex-1">
              <p className="meet-caption-en text-[9px] uppercase tracking-[0.35em] text-[#b8b5ad]">
                Worldbook · 世界书预览
              </p>
              <h2 className="truncate font-medium tracking-[0.08em] text-[#2c2a26]" style={{ fontSize: '17px' }}>
                {nickname}
              </h2>
            </div>
          </header>

          <div className="meet-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
            {/* 分册 A：人设矩阵（九条条目） */}
            <section
              className="mx-auto mb-5 max-w-lg rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-[0_8px_36px_rgba(40,36,30,0.05)]"
              style={{ borderTop: `3px solid ${PLATINUM}` }}
            >
              <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8a994]">Volume 01 · 分册</p>
              <p className="mt-1 text-[15px] font-medium text-[#2c2a26]">遇见 · 九维人设矩阵</p>
              <p className="meet-caption-en mt-2 font-mono text-[10px] leading-relaxed tracking-[0.02em] text-[#9a9590]">
                WB_ID · {volCharacterId}
              </p>
              <div className="mt-4 border-t border-black/[0.05] pt-4">
                <p className="meet-caption-en text-[9px] uppercase tracking-[0.28em] text-[#a8a4a0]">
                  Items · 条目
                </p>
                <p className="mt-1 text-[12px] font-light leading-relaxed text-[#6e6862]">
                  共 10 个同步分册（vol01–vol09 为序言介入；vol10 为尾声延展 · 对用户的当前态度）。以下为九维矩阵全文，可在心动决定前完整查阅。
                </p>
              </div>
            </section>

            <NineDimensionAccordion dossier={previewDossier} />

            {/* 分册 B：档案法则映射 */}
            <section className="mx-auto mt-6 max-w-lg rounded-[14px] border border-black/[0.06] bg-white p-4">
              <button
                type="button"
                onClick={() => setShowLoreMeta((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div>
                  <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8a994]">
                    Volume 02 · 档案法则
                  </p>
                  <p className="mt-1 text-[14px] font-medium text-[#2c2a26]">核心人设档案（映射）</p>
                </div>
                <span className="meet-caption-en text-[10px] text-[#c9c5be]">{showLoreMeta ? '−' : '+'}</span>
              </button>
              <AnimatePresence initial={false}>
                {showLoreMeta ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    className="overflow-hidden"
                  >
                    <p className="meet-caption-en mt-3 font-mono text-[10px] leading-relaxed text-[#9a9590]">
                      LORE_ENTRY_ID · {loreEntryId}
                    </p>
                    <p className="font-dossier-serif mt-3 text-[13px] leading-loose text-[#5b574f]">
                      与下方 vol01–vol10 同源。同步至微信通讯录后，人设库会写入 10 个世界书分册（第九册为九维末章；**第十册为尾声延展**，条目 priority=after，可在「人设 · 世界书」尾声分栏直接编辑），并写入档案法则条目「核心人设档案」；临时会话收束稿另见「档案法则 · 分册 03」条目（与 vol10 正文一致）。
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>

            {/* 分册 C：遇见结业 · 档案法则（与 vol10 尾声延展人设分册双写，正文一致） */}
            <section className="mx-auto mt-6 max-w-lg rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-[0_8px_36px_rgba(40,36,30,0.05)]">
              <button
                type="button"
                onClick={() => setShowEpilogueSection((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div>
                  <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8a994]">
                    Volume 03 · 档案法则
                  </p>
                  <p className="mt-1 text-[15px] font-medium text-[#2c2a26]">遇见 · 临时会话收束稿</p>
                  <p className="meet-caption-en mt-1 text-[10px] leading-relaxed text-[#9a9590]">
                    注入「档案与世界书」；微信私聊时与九维人设一并参与模型上下文
                  </p>
                </div>
                <span className="meet-caption-en text-[10px] text-[#c9c5be]">{showEpilogueSection ? '−' : '+'}</span>
              </button>
              <AnimatePresence initial={false}>
                {showEpilogueSection ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    className="overflow-hidden"
                  >
                    <p className="meet-caption-en mt-3 font-mono text-[10px] leading-relaxed text-[#9a9590]">
                      LORE_ENTRY_ID · {epilogueLoreId}
                    </p>
                    {epilogueLore?.content?.trim() ? (
                      <>
                        <p className="mt-2 text-[12px] font-medium text-[#3d3a34]">
                          {String(epilogueLore.title || '').trim() || '（未命名条目）'}
                        </p>
                        <div className="font-dossier-serif mt-3 max-h-[min(50dvh,420px)] overflow-y-auto rounded-[10px] border border-black/[0.05] bg-[#faf8f5] px-3 py-3 text-[13px] leading-loose text-[#5b574f]">
                          {String(epilogueLore.content).trim()}
                        </div>
                      </>
                    ) : (
                      <p className="font-dossier-serif mt-3 text-[13px] leading-loose text-[#5b574f]">
                        尚未生成。在「手动同步到微信通讯录」或结业互换流程完成后，会根据临时会话写入本条，并**同步写入人设世界书第十册（尾声延展）**；标题一般为「对（你的展示名）的初印象 (Lumi Meet)」或「初遇印象」。
                      </p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalEl,
  )
}
