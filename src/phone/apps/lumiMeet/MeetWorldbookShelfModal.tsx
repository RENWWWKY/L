import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../components/Pressable'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import type { ComprehensivePersona } from './comprehensivePersona'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import { useLumiMeetStore } from './LumiMeetStore'
import { ensureMeetVol10EpilogueIfNeeded } from './meetEpilogueAfterContactsSync'
import { readMeetVol10PreviewFromCharacterWorldBooks, type MeetVol10Preview } from './meetNineDimensionWorldBooks'
import { readMeetTruthMirrorContentFromCharacterWorldBooks } from './meetTruthMirrorWorldbook'
import { MeetStoredWorldbookVolumesAccordion } from './MeetStoredWorldbookVolumesAccordion'
import { MeetWorldbookShelfCoachPortal } from './MeetWorldbookShelfCoach'
import { MeetWorldbookShelfTutorialModalPortal } from './MeetWorldbookShelfTutorialModal'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { EncounterNPC, MeetPublicProfile } from './meetTypes'
import { expandComprehensivePersonaPlaceholders, resolveMeetCharUserNames } from './meetPersonaPreview'
import { NineDimensionAccordion } from './nineDimensionAccordion'
import {
  applyMeetUserProfileVol11AtMatch,
  formatMeetUserProfileSnapshotForWorldbook,
  loadMeetUserProfileSnapshotFromKv,
  readMeetVol11ContentFromCharacterWorldBooks,
} from './meetUserProfileSnapshot'

const PLATINUM = '#D4AF37'

const EMPTY_VOL10_PREVIEW: MeetVol10Preview = {
  content: '',
  itemName: '',
  isGraduatedEpilogue: false,
}

/**
 * 遇见内「世界书」结构预览：九维手风琴 + 已写入人设库的分册（不进档案室 App）
 */
export function MeetWorldbookShelfModal({
  open,
  onClose,
  npcId,
  nickname,
  avatarUrl,
  dossier,
  meetProfile,
  intimacyScore,
  worldbookRefreshKey = 0,
}: {
  open: boolean
  onClose: () => void
  npcId: string
  nickname: string
  avatarUrl: string
  dossier: ComprehensivePersona
  meetProfile: MeetPublicProfile
  /** 临时会话共鸣刻度；控制九维「表层 / 深层」可见度 */
  intimacyScore?: number
  /** 真心话/结业等人设库更新后递增，用于刷新 vol10–vol12 预览 */
  worldbookRefreshKey?: number
}) {
  const portalEl = getLumiMeetPortalTarget()
  const apiConfig = useCurrentApiConfig('chatCard')
  const { hydrated, state: meetPersist, markWorldbookShelfCoachCompleted } = useLumiMeetStore()
  const volCharacterId = `meet-wb-${npcId}`
  const [vol10, setVol10] = useState<MeetVol10Preview>(EMPTY_VOL10_PREVIEW)
  const [vol11Content, setVol11Content] = useState('')
  const [vol12Content, setVol12Content] = useState('')
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const autoCoachStartedRef = useRef(false)
  const epilogueBackfillAttemptedRef = useRef(false)

  const previewDossier = useMemo(
    () => expandComprehensivePersonaPlaceholders(dossier, resolveMeetCharUserNames(nickname, meetProfile)),
    [dossier, meetProfile, nickname],
  )

  const reloadStoredVolumes = useCallback(() => {
    void (async () => {
      const ch = await personaDb.getCharacter(npcId)
      let v11 = readMeetVol11ContentFromCharacterWorldBooks(ch?.worldBooks, npcId)
      if (!v11.trim()) {
        const snap = await loadMeetUserProfileSnapshotFromKv(npcId)
        if (snap) {
          v11 = formatMeetUserProfileSnapshotForWorldbook(snap, nickname)
          await applyMeetUserProfileVol11AtMatch({ id: npcId, nickname } as EncounterNPC)
        }
      }
      setVol10(readMeetVol10PreviewFromCharacterWorldBooks(ch?.worldBooks, npcId))
      setVol11Content(v11)
      setVol12Content(readMeetTruthMirrorContentFromCharacterWorldBooks(ch?.worldBooks, npcId))
    })()
  }, [npcId, nickname])

  const startLiveCoach = useCallback(() => {
    setCoachStepIndex(0)
    setCoachOpen(true)
  }, [])

  const finishCoach = useCallback(
    (opts?: { openTutorial?: boolean }) => {
      markWorldbookShelfCoachCompleted()
      setCoachOpen(false)
      setCoachStepIndex(0)
      if (opts?.openTutorial) setTutorialOpen(true)
    },
    [markWorldbookShelfCoachCompleted],
  )

  useEffect(() => {
    if (!open) {
      setVol10(EMPTY_VOL10_PREVIEW)
      setVol11Content('')
      setVol12Content('')
      setTutorialOpen(false)
      setCoachOpen(false)
      setCoachStepIndex(0)
      autoCoachStartedRef.current = false
      epilogueBackfillAttemptedRef.current = false
      return
    }
    reloadStoredVolumes()
    const onStorage = () => reloadStoredVolumes()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [open, npcId, worldbookRefreshKey, reloadStoredVolumes])

  /** 已加微信但 vol10 仍为占位稿时，打开灵魂侧写自动补写结业初印象（修复旧存档） */
  useEffect(() => {
    if (!open || epilogueBackfillAttemptedRef.current) return
    epilogueBackfillAttemptedRef.current = true
    void (async () => {
      try {
        const ch = await personaDb.getCharacter(npcId)
        const preview = readMeetVol10PreviewFromCharacterWorldBooks(ch?.worldBooks, npcId)
        if (preview.isGraduatedEpilogue) return
        const written = await ensureMeetVol10EpilogueIfNeeded({
          apiConfig,
          characterId: npcId,
          playerIdentityId: meetProfile.baseWeChatIdentityId,
        })
        if (written) reloadStoredVolumes()
      } catch {
        // ignore
      }
    })()
  }, [apiConfig, meetProfile.baseWeChatIdentityId, npcId, open, reloadStoredVolumes])

  useEffect(() => {
    if (!open || !hydrated) return
    if (meetPersist.worldbookShelfCoachCompleted) return
    if (autoCoachStartedRef.current) return
    autoCoachStartedRef.current = true
    const id = window.setTimeout(() => startLiveCoach(), 520)
    return () => window.clearTimeout(id)
  }, [open, hydrated, meetPersist.worldbookShelfCoachCompleted, startLiveCoach])

  if (!portalEl) return null

  return createPortal(
    <>
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
              className="flex shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white/90 px-3 pb-3 backdrop-blur-md sm:gap-3 sm:px-4"
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
              <Pressable
                type="button"
                data-meet-wb-coach="tutorial"
                onClick={() => setTutorialOpen(true)}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#ebe7e0] bg-white px-3 text-[#6e6860] active:bg-[#f4f2ee]"
                aria-label="灵魂侧写教程"
              >
                <BookOpen className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="text-[12px] tracking-[0.06em]">教程</span>
              </Pressable>
            </header>

            <motion.div className="meet-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
              <section
                data-meet-wb-coach="overview"
                className="mx-auto mb-5 max-w-lg rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-[0_8px_36px_rgba(40,36,30,0.05)]"
                style={{ borderTop: `3px solid ${PLATINUM}` }}
              >
                <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8a994]">Volume · 分册</p>
                <p className="mt-1 text-[15px] font-medium text-[#2c2a26]">遇见 · 九维人设矩阵</p>
                <p className="meet-caption-en mt-2 font-mono text-[10px] leading-relaxed tracking-[0.02em] text-[#9a9590]">
                  WB_ID · {volCharacterId}
                </p>
                <div className="mt-4 border-t border-black/[0.05] pt-4">
                  <p className="meet-caption-en text-[9px] uppercase tracking-[0.28em] text-[#a8a4a0]">
                    Items · 条目
                  </p>
                  <p className="mt-1 text-[12px] font-light leading-relaxed text-[#6e6862]">
                    共 12 个分册（vol01–vol09 为序言介入）。下方可展开{' '}
                    <span className="text-[#8c6b2b]">vol10–vol12</span>
                    （匹配后占位/快照，结业或真心话后更新真稿）。九维矩阵全文可阅；
                    <span className="text-[#8c6b2b]">深层分册随共鸣刻度逐步解锁</span>
                    （当前刻度 {typeof intimacyScore === 'number' ? intimacyScore : '—'}）。
                  </p>
                </div>
              </section>

              <motion.div data-meet-wb-coach="matrix">
                <NineDimensionAccordion dossier={previewDossier} intimacyScore={intimacyScore} />
              </motion.div>

              <motion.div data-meet-wb-coach="volumes">
                <MeetStoredWorldbookVolumesAccordion
                  npcId={npcId}
                  vol10={vol10}
                  vol11Content={vol11Content}
                  vol12Content={vol12Content}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <MeetWorldbookShelfTutorialModalPortal
        open={open && tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onStartLiveCoach={startLiveCoach}
      />

      <MeetWorldbookShelfCoachPortal
        open={open && coachOpen}
        stepIndex={coachStepIndex}
        onStepChange={setCoachStepIndex}
        onSkip={() => finishCoach()}
        onComplete={(opts) => finishCoach(opts)}
      />
    </>,
    portalEl,
  )
}
