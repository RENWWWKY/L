import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'

import {
  getMeetVol10WorldBookId,
  type MeetVol10Preview,
} from './meetNineDimensionWorldBooks'
import { getMeetTruthMirrorWorldBookId, MEET_TRUTH_MIRROR_WORLD_BOOK_TITLE } from './meetTruthMirrorWorldbook'
import { getMeetVol11WorldBookId } from './meetUserProfileSnapshot'

const PLATINUM = '#D4AF37'

const VOL10_TITLE = '10 ATTITUDE | 尾声延展'
const VOL11_TITLE = '11 MEET MASK | 遇见对外档案快照'

type StoredVolSection = {
  id: string
  num: string
  titleEn: string
  titleZh: string
  wbId: string
  wbTitle: string
  content: string
  itemName?: string
  isGraduatedEpilogue?: boolean
  emptyHint: string
  placeholderHint?: string
}

/**
 * 匹配后已写入人设库的分册（vol10–vol12），与微信「人设 · 世界书」同源。
 */
export function MeetStoredWorldbookVolumesAccordion({
  npcId,
  vol10,
  vol11Content,
  vol12Content,
}: {
  npcId: string
  vol10: MeetVol10Preview
  vol11Content: string
  vol12Content: string
}) {
  const [activeId, setActiveId] = useState('')
  const toggle = useCallback((id: string) => {
    setActiveId((prev) => (prev === id ? '' : id))
  }, [])

  const sections: StoredVolSection[] = [
    {
      id: 'vol10',
      num: '10',
      titleEn: 'ATTITUDE',
      titleZh: '尾声延展 · 邂逅结业初印象',
      wbId: getMeetVol10WorldBookId(npcId),
      wbTitle: VOL10_TITLE,
      content: vol10.content,
      itemName: vol10.itemName,
      isGraduatedEpilogue: vol10.isGraduatedEpilogue,
      emptyHint: '匹配成功后会写入 vol10 占位稿；缔结契约或加为微信好友并结业同步后，将替换为约百字的「对 TA 的初印象」。',
      placeholderHint:
        '当前为占位稿。完成邂逅结业（加微信/缔结）后，系统会根据临时聊天记录生成结业初印象并替换本条。',
    },
    {
      id: 'vol11',
      num: '11',
      titleEn: 'MEET MASK',
      titleZh: '遇见对外档案快照',
      wbId: getMeetVol11WorldBookId(npcId),
      wbTitle: VOL11_TITLE,
      content: vol11Content,
      emptyHint: '匹配成功后会写入本角色人设世界书 vol11（记录当时见到的你的遇见对外档案）。',
    },
    {
      id: 'vol12',
      num: '12',
      titleEn: 'TRUTH',
      titleZh: '交换真心话纪要',
      wbId: getMeetTruthMirrorWorldBookId(npcId),
      wbTitle: MEET_TRUTH_MIRROR_WORLD_BOOK_TITLE,
      content: vol12Content,
      emptyHint: '完成临时会话中的「交换真心话」后，纪要会追加至本角色 vol12（无需先加微信好友）。',
    },
  ]

  return (
    <motion.div className="mx-auto mt-4 w-full max-w-lg space-y-2">
      <p className="meet-caption-en px-1 text-[9px] uppercase tracking-[0.28em] text-[#a8a4a0]">
        人设库分册 · 匹配后即可阅（vol10–vol12）
      </p>
      {sections.map((sec) => {
        const isOpen = activeId === sec.id
        const hasContent = !!sec.content.trim()
        const showPlaceholderNote = sec.id === 'vol10' && hasContent && !sec.isGraduatedEpilogue
        return (
          <motion.div
            key={sec.id}
            className="overflow-hidden rounded-[14px] border border-black/[0.06] bg-white shadow-[0_8px_40px_rgba(40,36,30,0.04)]"
            style={{
              borderLeftWidth: 3,
              borderLeftColor: isOpen ? PLATINUM : 'transparent',
            }}
          >
            <button
              type="button"
              onClick={() => toggle(sec.id)}
              className="flex w-full items-baseline justify-between gap-3 px-4 py-3.5 text-left transition-colors active:bg-black/[0.02]"
            >
              <span>
                <span className="meet-caption-en text-[10px] tracking-[0.25em] text-[#b8a994]">{sec.num}</span>{' '}
                <span className="meet-caption-en text-[11px] uppercase tracking-[0.18em] text-[#2c2a26]">
                  {sec.titleEn}
                </span>
                <span className="mx-2 text-[10px] text-[#d4d0c8]">|</span>
                <span className="text-[13px] font-medium text-[#3d3a34]">{sec.titleZh}</span>
                {sec.id === 'vol10' && sec.isGraduatedEpilogue ? (
                  <span className="ml-2 inline-block rounded-full bg-[#f5f0e6] px-2 py-0.5 text-[9px] font-medium text-[#8c6b2b]">
                    已结业
                  </span>
                ) : null}
              </span>
              <span className="meet-caption-en shrink-0 text-[9px] text-[#c9c5be]">
                {hasContent ? (isOpen ? '−' : '+') : '—'}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  key="panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 32, mass: 0.85 }}
                  className="overflow-hidden border-t border-black/[0.04]"
                >
                  <div className="px-4 py-3">
                    <p className="meet-caption-en font-mono text-[10px] leading-relaxed text-[#9a9590]">
                      WB_ID · {sec.wbId}
                    </p>
                    <p className="meet-caption-en mt-1 text-[10px] text-[#b8a994]">{sec.wbTitle}</p>
                    {hasContent ? (
                      <>
                        {sec.itemName?.trim() ? (
                          <p className="mt-2 text-[12px] font-medium text-[#3d3a34]">{sec.itemName}</p>
                        ) : null}
                        {showPlaceholderNote && sec.placeholderHint ? (
                          <p className="mt-2 text-[11px] leading-relaxed text-[#9a9590]">{sec.placeholderHint}</p>
                        ) : null}
                        <div className="font-dossier-serif mt-3 max-h-[min(42dvh,360px)] overflow-y-auto whitespace-pre-wrap rounded-[10px] border border-black/[0.05] bg-[#faf8f5] px-3 py-3 text-[13px] leading-loose text-[#5b574f]">
                          {sec.content}
                        </div>
                      </>
                    ) : (
                      <p className="font-dossier-serif mt-3 text-[13px] leading-loose text-[#5b574f]">{sec.emptyHint}</p>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
