import { AnimatePresence, motion } from 'framer-motion'
import { BookMarked, ChevronRight, Heart, Info, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCustomization } from '../../CustomizationContext'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { buildMeetAvatarExclusion, MEET_REUNION_COOLDOWN_MS, MEET_REUNION_ROLL_P } from './constants'
import {
  buildMeetNpcDigestForModel,
  buildMeetNpcVitalsSubtitle,
  expandMeetPersonaPlaintext,
  resolveMeetCharUserNames,
} from './meetPersonaPreview'
import {
  aiGenerateEncounterNpc,
  aiJudgeMutualSpark,
  aiMeetPostMatchOpeningLines,
  MeetEncounterGenerationError,
} from './lumiMeetAi'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import { MEET_ORIENTATION_HELP_ZH, MEET_ORIENTATION_OPTIONS, meetIntentionsToPurpose } from './meetMatchCriteria'
import { MeetAgeRangeSlider } from './MeetAgeRangeSlider'
import { MeetWorldbookShelfModal } from './MeetWorldbookShelfModal'
import type {
  EncounterNPC,
  MeetMatchIntention,
  MeetOrientationPreference,
  RadarFilters,
} from './meetTypes'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import { listReunionEligibleMissed, pickRandom } from './radarPool'
import { computeMeetNpcStaggerDelayMs, sleep, yieldToPaint } from './lumiMeetChatReveal'
import { ResonanceRings } from './ResonanceRings'
import { useLumiMeetStore } from './LumiMeetStore'

const INTENT_OPTS: { id: MeetMatchIntention; zh: string; en: string }[] = [
  { id: 'romance', zh: '寻找浪漫', en: 'Romance' },
  { id: 'platonic', zh: '纯粹友谊', en: 'Platonic' },
  { id: 'soulmate', zh: '灵魂共鸣', en: 'Soulmate' },
  { id: 'casual', zh: '闲聊搭子', en: 'Casual' },
]

/** 点击心动前在后台预取的判定 + 匹配成功时的开场白 */
type SparkPrecheckResult = { ok: boolean; openingLines: string[] }

type SparkPrecheckSlot = {
  key: string
  npcId: string
  result: SparkPrecheckResult | null
  inflight: Promise<SparkPrecheckResult> | null
}

/** 心动后最短「判定中」展示时间（毫秒），预取已完成时仍保留加载感 */
const SPARK_BUTTON_MIN_MS = 480

function PlatinumTick() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[#D4AF37]">
      <path d="M6 12.5l4 4 8-10" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MatchDashboard() {
  const apiConfig = useCurrentApiConfig('chatCard')
  const apiConfigRef = useRef(apiConfig)
  apiConfigRef.current = apiConfig
  const { state: phoneCustom } = useCustomization()
  const {
    state,
    upsertNpc,
    setRadarFilters,
    pushChatMessage,
    bumpIntimacy,
    radarSession,
    requestRadarSearch,
    flushRadarRevealToCard,
    dismissRadarPending,
    setRadarSparkInProgress,
    setRadarPendingCard,
    getPersistedSnapshot,
  } = useLumiMeetStore()
  const filters = state.radarFilters
  const profile = state.meetProfile
  const profileRef = useRef(profile)
  profileRef.current = profile
  const profileSparkKey = useMemo(
    () => [profile.displayName, profile.intent, profile.orientation, profile.bio].join('\x1e'),
    [profile.displayName, profile.intent, profile.orientation, profile.bio],
  )

  const sparkPrecheckRef = useRef<SparkPrecheckSlot>({
    key: '',
    npcId: '',
    result: null,
    inflight: null,
  })

  const [drawer, setDrawer] = useState(false)
  const [filterDraft, setFilterDraft] = useState<RadarFilters>(filters)
  const [sparkBurst, setSparkBurst] = useState(false)
  const [sparkDenied, setSparkDenied] = useState(false)
  const [worldbookOpen, setWorldbookOpen] = useState(false)
  const [radarGenMessage, setRadarGenMessage] = useState<string | null>(null)
  const [orientationHelpOpen, setOrientationHelpOpen] = useState(false)

  const card = radarSession.pendingCard
  const scanning = radarSession.searchInProgress
  const judging = radarSession.sparkInProgress
  const isReunionEcho = radarSession.isReunionEcho
  const pendingReveal = radarSession.pendingReveal

  useEffect(() => {
    if (!drawer) return
    setFilterDraft({ ...filters })
  }, [drawer, filters])

  useEffect(() => {
    if (!drawer) setOrientationHelpOpen(false)
  }, [drawer])

  useEffect(() => {
    if (!pendingReveal) return
    const t = window.setTimeout(() => flushRadarRevealToCard(), 840)
    return () => window.clearTimeout(t)
  }, [flushRadarRevealToCard, pendingReveal?.npc.id])

  const canStartNewSearch =
    !scanning &&
    !judging &&
    !pendingReveal &&
    card?.status !== 'orbiting'

  useEffect(() => {
    if (!sparkBurst) return
    const tt = window.setTimeout(() => setSparkBurst(false), 2200)
    return () => window.clearTimeout(tt)
  }, [sparkBurst])

  useEffect(() => {
    if (!card) setWorldbookOpen(false)
  }, [card])

  useEffect(() => {
    setSparkDenied(false)
  }, [card?.id])

  const runSparkPrecheckForNpc = useCallback(async (npc: EncounterNPC): Promise<SparkPrecheckResult> => {
    const userProfile = profileRef.current
    let ok: boolean
    if (typeof npc.mutualSpark === 'boolean') {
      ok = npc.mutualSpark
    } else {
      const digest = buildMeetNpcDigestForModel(
        npc,
        resolveMeetCharUserNames(npc.nickname, userProfile),
      ).slice(0, 2800)
      ok = await aiJudgeMutualSpark({
        apiConfig: apiConfigRef.current,
        npcPersona: digest,
        npcNickname: npc.nickname,
        userProfile,
      })
    }
    let openingLines: string[] = []
    if (ok) {
      try {
        openingLines = await aiMeetPostMatchOpeningLines({
          apiConfig: apiConfigRef.current,
          npc,
          userProfile,
        })
      } catch {
        openingLines = []
      }
    }
    return { ok, openingLines }
  }, [])

  /** 卡片为「连结中」时：有 mutualSpark 则只预取开场白；否则预跑裁判 + 开场白 */
  useEffect(() => {
    if (!card || card.status !== 'orbiting') {
      sparkPrecheckRef.current = { key: '', npcId: '', result: null, inflight: null }
      return
    }
    const id = card.id
    const precKey = `${id}\x1f${profileSparkKey}`
    const slot = sparkPrecheckRef.current
    if (slot.key === precKey && slot.result) return
    if (slot.key === precKey && slot.inflight) return

    let canceled = false
    const p = runSparkPrecheckForNpc(card)
    sparkPrecheckRef.current = { key: precKey, npcId: id, result: null, inflight: p }
    void p
      .then((r) => {
        if (canceled) return
        if (sparkPrecheckRef.current.key !== precKey) return
        sparkPrecheckRef.current = { key: precKey, npcId: id, result: r, inflight: null }
      })
      .catch(() => {
        if (canceled) return
        if (sparkPrecheckRef.current.key !== precKey) return
        sparkPrecheckRef.current = {
          key: precKey,
          npcId: id,
          result: { ok: false, openingLines: [] },
          inflight: null,
        }
      })
    return () => {
      canceled = true
    }
  }, [card?.id, card?.status, profileSparkKey, runSparkPrecheckForNpc])

  const snippetForNpc = useCallback(
    (n: EncounterNPC | null) => {
      if (!n) return ''
      if (n.comprehensivePersona) {
        const preview = expandMeetPersonaPlaintext(n.comprehensivePersona.base.info, n.nickname, profile)
        return preview.length > 200 ? `${preview.slice(0, 200)}…` : preview
      }
      const t = expandMeetPersonaPlaintext(n.persona, n.nickname, profile)
      return t.length > 200 ? `${t.slice(0, 200)}…` : t
    },
    [profile],
  )

  const radarCardSnippet = useMemo(() => snippetForNpc(card), [card, snippetForNpc])
  const cardVitalsLine = useMemo(() => (card ? buildMeetNpcVitalsSubtitle(card) : null), [card])
  const revealVitalsLine = useMemo(
    () => (pendingReveal ? buildMeetNpcVitalsSubtitle(pendingReveal.npc) : null),
    [pendingReveal],
  )

  const runEncounter = useCallback(() => {
    requestRadarSearch(async () => {
      setRadarGenMessage(null)
      const snap = getPersistedSnapshot()
      const now = Date.now()
      const mp = snap.meetProfile
      const hint = `${mp.displayName || '匿名'}｜${mp.intent}｜${mp.orientation}｜${mp.bio}`.slice(0, 900)

      const eligible = listReunionEligibleMissed(snap.npcs, now, MEET_REUNION_COOLDOWN_MS)
      const reunionPick =
        eligible.length > 0 && Math.random() < MEET_REUNION_ROLL_P ? pickRandom(eligible) : null

      if (reunionPick) {
        const refreshed: EncounterNPC = {
          ...reunionPick,
          lastEncounterTime: now,
          mutualSpark:
            typeof reunionPick.mutualSpark === 'boolean' ? reunionPick.mutualSpark : Math.random() > 0.35,
        }
        upsertNpc(refreshed)
        return { npc: refreshed, isReunionEcho: true }
      }

      const cfg = apiConfigRef.current
      if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
        setRadarGenMessage(new MeetEncounterGenerationError('api_required').message)
        return null
      }

      const wechatChars = await personaDb.listCharacters()
      const avatarExclusion = buildMeetAvatarExclusion([
        ...wechatChars.map((c) => ({ avatarUrl: c.avatarUrl })),
        ...phoneCustom.wechatPersonaContacts.map((c) => ({ avatarUrl: c.avatarUrl })),
        ...snap.npcs.map((n) => ({ avatarUrl: n.avatarUrl })),
      ])

      let gen: Awaited<ReturnType<typeof aiGenerateEncounterNpc>>
      try {
        gen = await aiGenerateEncounterNpc({
          apiConfig: cfg,
          filters: snap.radarFilters,
          profileHint: hint,
          meetProfile: mp,
          avatarExclusion,
        })
      } catch (e) {
        const msg =
          e instanceof MeetEncounterGenerationError ? e.message : new MeetEncounterGenerationError('api_failed').message
        setRadarGenMessage(msg)
        return null
      }

      const id = `meet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
      const npc: EncounterNPC = {
        id,
        avatarUrl: gen.avatarUrl,
        nickname: gen.nickname,
        realName: gen.realName,
        ageYears: gen.ageYears,
        birthdayMD: gen.birthdayMD,
        weightKg: gen.weightKg,
        heightCm: gen.heightCm,
        occupation: gen.occupation,
        motto: gen.motto,
        mbti: gen.mbti,
        zodiac: gen.zodiac,
        gender: gen.gender,
        orientation: gen.orientation,
        persona: gen.persona,
        comprehensivePersona: gen.comprehensivePersona,
        wechatId: gen.wechatId,
        mutualSpark: gen.mutualSpark,
        generationSource: gen.generationSource,
        status: 'orbiting',
        lastEncounterTime: now,
      }
      upsertNpc(npc)
      return { npc, isReunionEcho: false }
    })
  }, [getPersistedSnapshot, phoneCustom.wechatPersonaContacts, requestRadarSearch, upsertNpc])

  const onMiss = useCallback(() => {
    if (card) {
      upsertNpc({ ...card, status: 'missed', lastEncounterTime: Date.now() })
    }
    dismissRadarPending()
    setSparkBurst(false)
    setSparkDenied(false)
  }, [card, dismissRadarPending, upsertNpc])

  const onSpark = useCallback(async () => {
    if (!card) return
    setRadarSparkInProgress(true)
    setSparkDenied(false)
    const tClick = Date.now()
    const precKey = `${card.id}\x1f${profileSparkKey}`
    try {
      const slot = sparkPrecheckRef.current
      let r: SparkPrecheckResult
      if (slot.key === precKey && slot.result) {
        r = slot.result
      } else if (slot.key === precKey && slot.inflight) {
        r = await slot.inflight
      } else {
        r = await runSparkPrecheckForNpc(card)
        if (sparkPrecheckRef.current.key === precKey) {
          sparkPrecheckRef.current = { key: precKey, npcId: card.id, result: r, inflight: null }
        }
      }

      await sleep(Math.max(0, SPARK_BUTTON_MIN_MS - (Date.now() - tClick)))

      if (r.ok) {
        const matched: EncounterNPC = {
          ...card,
          status: 'matched',
          lastEncounterTime: Date.now(),
        }
        upsertNpc(matched)
        setRadarPendingCard(matched, false)
        setSparkBurst(true)
        bumpIntimacy(card.id, 24)
        const openingLines = r.openingLines
        for (let i = 0; i < openingLines.length; i++) {
          const line = openingLines[i]!
          if (i > 0) await sleep(computeMeetNpcStaggerDelayMs(openingLines[i - 1]!))
          else if (openingLines.length > 1) await sleep(320)
          pushChatMessage(card.id, { role: 'npc', content: line })
          await yieldToPaint()
        }
      } else {
        const missed: EncounterNPC = { ...card, status: 'missed', lastEncounterTime: Date.now() }
        upsertNpc(missed)
        setRadarPendingCard(missed)
        setSparkDenied(true)
      }
    } finally {
      setRadarSparkInProgress(false)
    }
  }, [
    bumpIntimacy,
    card,
    profileSparkKey,
    pushChatMessage,
    runSparkPrecheckForNpc,
    setRadarPendingCard,
    setRadarSparkInProgress,
    upsertNpc,
  ])

  const commitFilters = useCallback(() => {
    const intents =
      filterDraft.meetIntentions.length > 0 ? filterDraft.meetIntentions : (['romance'] as MeetMatchIntention[])
    const purpose = meetIntentionsToPurpose(intents)
    let { ageMin, ageMax } = filterDraft
    ageMin = Math.max(18, Math.min(99, ageMin))
    ageMax = Math.max(18, Math.min(99, ageMax))
    if (ageMax < ageMin + 2) ageMax = ageMin + 2
    setRadarFilters({
      ...filterDraft,
      meetIntentions: intents,
      ageMin,
      ageMax,
      purpose,
    })
    setDrawer(false)
  }, [filterDraft, setRadarFilters])

  const toggleOrientation = (id: MeetOrientationPreference) => {
    setFilterDraft((s) => {
      const has = s.orientationPreferences.includes(id)
      return {
        ...s,
        orientationPreferences: has ? s.orientationPreferences.filter((x) => x !== id) : [...s.orientationPreferences, id],
      }
    })
  }

  const toggleIntention = (id: MeetMatchIntention) => {
    setFilterDraft((s) => {
      const has = s.meetIntentions.includes(id)
      return {
        ...s,
        meetIntentions: has ? s.meetIntentions.filter((x) => x !== id) : [...s.meetIntentions, id],
      }
    })
  }

  const portalEl = getLumiMeetPortalTarget()

  return (
    <div className="meet-scrollbar relative flex min-h-0 flex-1 flex-col overflow-hidden pb-28 pt-4">
      <div className="shrink-0 px-5 text-center">
        <h2 className="font-elegant-serif text-[1.2rem] font-medium tracking-[0.14em] text-[#2c2a26]">共鸣星轨</h2>
        <p className="meet-caption-en mt-1 text-[10px] uppercase tracking-[0.42em] text-[#b8b5ad]">
          Resonance Rings · Match
        </p>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4">
        <ResonanceRings scanning={scanning} revealBurst={!!pendingReveal} size={248} />

        <motion.button
          type="button"
          layout
          onClick={() => setDrawer(true)}
          className="group mt-10 flex max-w-full items-center gap-2.5 rounded-2xl border border-transparent bg-transparent px-3 py-2.5 transition-colors duration-200 hover:border-black/[0.06] hover:bg-white/70 active:scale-[0.99]"
          aria-label="打开筛选偏好"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-white/80 text-[#b8973a] shadow-[0_4px_14px_rgba(35,30,24,0.04)] transition-[border-color,box-shadow] duration-200 group-hover:border-[#D4AF37]/35 group-hover:shadow-[0_6px_20px_rgba(212,175,55,0.12)]">
            <SlidersHorizontal className="size-4" strokeWidth={1.5} aria-hidden />
          </span>
          <span className="min-w-0 flex flex-1 flex-col items-start text-left sm:flex-row sm:items-baseline sm:gap-2">
            <span className="font-elegant-serif text-[12px] font-light tracking-[0.06em] text-[#3d3a34]">筛选偏好</span>
            <span className="meet-caption-en text-[10px] text-[#a39e96]">Preferences</span>
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-[#c9c4bc] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#b8973a]"
            strokeWidth={1.5}
            aria-hidden
          />
        </motion.button>

        <motion.button
          type="button"
          layout
          disabled={!canStartNewSearch}
          onClick={runEncounter}
          className="meet-btn-primary mt-6 flex w-[min(300px,100%)] items-center justify-center gap-2 py-3.5 disabled:opacity-45"
        >
          {scanning ? (
            <>
              <span className="meet-caption-en text-[10px] text-[#7a736b]">Tuning…</span>
              <span className="font-elegant-serif text-[13px] font-light tracking-[0.06em]">调校中</span>
            </>
          ) : (
            <>
              <span className="font-elegant-serif text-[13px] font-light tracking-[0.06em]">开启寻觅</span>
              <span className="meet-caption-en text-[10px] text-[#8a8680]">Initiate Search</span>
            </>
          )}
        </motion.button>

        {!apiConfig?.apiUrl?.trim() || !apiConfig?.apiKey?.trim() ? (
          <p className="meet-caption-en mt-3 max-w-[min(300px,100%)] text-center text-[9px] leading-relaxed tracking-[0.1em] text-[#b0aaa4]">
            新人设仅由模型生成：请先在「API」中填写请求地址与密钥。未命中「重逢」时，未配置将无法邂逅新角色。
          </p>
        ) : null}

        {radarGenMessage ? (
          <p
            role="alert"
            className="meet-caption-en mt-3 max-w-[min(300px,100%)] text-center text-[10px] leading-relaxed tracking-[0.06em] text-[#b85c4a]"
          >
            {radarGenMessage}
          </p>
        ) : null}

        {!canStartNewSearch && !scanning && card?.status === 'orbiting' ? (
          <p
            className="meet-resonance-quote mt-4 max-w-[300px] text-center text-[11px] font-light italic leading-relaxed text-[#a3988e]"
          >
            本轮连结尚未决断。于浮层择「错过」或「心动」后，方可再次寻觅。
          </p>
        ) : null}
      </div>

      <AnimatePresence>
        {sparkBurst ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[330] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,252,248,0.97)_0%,rgba(245,238,230,0.85)_48%,rgba(230,220,208,0)_74%)]"
          >
            <motion.div
              initial={{ scale: 0.72, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="text-center"
            >
              <p className="meet-resonance-quote text-[24px] font-light italic tracking-[0.08em] text-[#4a433c]">
                同频确认
              </p>
              <p className="meet-caption-en mt-3 text-[10px] uppercase tracking-[0.55em] text-[#c9b8a4]">It&apos;s a Match</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pendingReveal ? (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[282] flex items-center justify-center px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 20, opacity: 0, filter: 'blur(12px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[300px] rounded-[20px] border border-white/70 bg-white/55 px-6 py-7 shadow-[0_28px_80px_rgba(28,24,18,0.08)] backdrop-blur-xl"
              style={{ borderColor: 'rgba(212, 175, 55, 0.22)' }}
            >
              <p className="meet-caption-en text-center text-[9px] uppercase tracking-[0.36em] text-[#b8b5ad]">
                Profile · 档案掠影
              </p>
              <div className="mt-5 flex gap-4">
                <img
                  src={pendingReveal.npc.avatarUrl}
                  alt=""
                  className="size-[64px] shrink-0 rounded-2xl object-cover ring-1 ring-black/[0.06]"
                />
                <div className="min-w-0">
                  <p className="font-elegant-serif text-[19px] text-[#2c2a26]">{pendingReveal.npc.nickname}</p>
                  {pendingReveal.npc.generationSource === 'offline' ? (
                    <p className="meet-caption-en mt-0.5 text-[9px] tracking-[0.08em] text-[#c9a96e]">本地示例 · 非模型</p>
                  ) : null}
                  <p className="meet-caption-en mt-1 text-[10px] text-[#b8b5ad]">
                    {pendingReveal.npc.gender} · {pendingReveal.npc.orientation}
                  </p>
                  {revealVitalsLine ? (
                    <p className="meet-caption-en mt-1.5 text-[9px] tracking-[0.06em] text-[#c4bfb8]">
                      {revealVitalsLine}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="meet-resonance-quote mt-5 text-[13px] font-light italic leading-[1.75] text-[#5b574f]">
                {snippetForNpc(pendingReveal.npc)}
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {card && portalEl
        ? createPortal(
            <AnimatePresence>
              <motion.div
                key={card.id}
                role="dialog"
                aria-modal="true"
                aria-labelledby="meet-match-card-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto fixed inset-0 z-[285] flex flex-col justify-end"
              >
                <div
                  role="presentation"
                  className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                  onClick={() => {
                    if (card.status === 'matched') {
                      dismissRadarPending()
                    }
                  }}
                />
                <motion.div
                  initial={{ y: 36, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 24, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                  className="meet-scrollbar relative z-[1] mx-auto w-full max-w-sm overflow-y-auto rounded-t-[24px] border border-b-0 border-black/[0.07] bg-[#fdfcfa] shadow-[0_-16px_56px_rgba(35,30,24,0.18)]"
                  style={{
                    maxHeight: 'min(88dvh, calc(100dvh - 40px))',
                    paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    paddingTop: '14px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="meet-caption-en mb-3 text-center text-[9px] uppercase tracking-[0.36em] text-[#b8b5ad]">
                    Match Card · 本轮连结
                  </p>
                  <div className="meet-card overflow-hidden rounded-[22px] border border-black/[0.05] bg-white shadow-[0_16px_48px_rgba(35,30,24,0.08)]">
                    <div className="flex gap-4 p-5">
                      <img
                        src={card.avatarUrl}
                        alt=""
                        className="size-[72px] shrink-0 rounded-2xl object-cover ring-1 ring-black/[0.05]"
                      />
                      <div className="min-w-0">
                        <p id="meet-match-card-title" className="font-elegant-serif text-[20px] text-[#2c2a26]">
                          {card.nickname}
                        </p>
                        {card.generationSource === 'offline' ? (
                          <p className="meet-caption-en mt-0.5 text-[9px] tracking-[0.08em] text-[#c9a96e]">本地示例 · 非模型</p>
                        ) : null}
                        <p className="meet-caption-en mt-1 text-[10px] text-[#b8b5ad]">
                          {card.gender} · {card.orientation}
                        </p>
                        {cardVitalsLine ? (
                          <p className="meet-caption-en mt-1.5 text-[9px] tracking-[0.06em] text-[#c4bfb8]">
                            {cardVitalsLine}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="border-t border-black/[0.04] px-5 pb-5">
                      {isReunionEcho ? (
                        <p className="meet-resonance-quote mb-3 text-[10px] italic tracking-[0.14em] text-[#b8b0a8]">
                          Echoes of destiny · 兜兜转转，再次相遇
                        </p>
                      ) : null}
                      {card.comprehensivePersona ? (
                        <>
                          <p className="font-dossier-serif text-[13px] leading-loose text-[#4a4740]">{radarCardSnippet}</p>
                          <button
                            type="button"
                            onClick={() => setWorldbookOpen(true)}
                            className="meet-platinum-pill mt-4 flex w-full items-center justify-center gap-2 border py-2.5 text-[12px] font-light text-[#5c534c]"
                            style={{ borderColor: 'rgba(212, 175, 55, 0.35)' }}
                          >
                            <BookMarked className="size-3.5 opacity-70" strokeWidth={1.25} />
                            <span>世界书</span>
                            <span className="opacity-40">｜分册与条目</span>
                          </button>
                        </>
                      ) : (
                        <p className="meet-resonance-quote text-[13px] leading-[1.8] text-[#5b574f]">{radarCardSnippet}</p>
                      )}
                    </div>
                  </div>

                  {card.status === 'orbiting' ? (
                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={onMiss}
                        className="meet-btn-secondary flex flex-1 items-center justify-center gap-2 py-3.5 text-[13px]"
                      >
                        <X className="size-4 opacity-60" strokeWidth={1.5} />
                        错过
                      </button>
                      <button
                        type="button"
                        disabled={judging}
                        onClick={() => void onSpark()}
                        className="meet-btn-primary flex flex-1 items-center justify-center gap-2 py-3.5 text-[13px] disabled:opacity-50"
                      >
                        <Heart className="size-4 fill-current opacity-90" strokeWidth={1.5} />
                        {judging ? '判定中…' : '心动'}
                      </button>
                    </div>
                  ) : card.status === 'matched' ? (
                    <div className="mt-5 space-y-3">
                      <p className="meet-resonance-quote text-center text-[14px] text-[#7a736b]">
                        已进入临时会话，请在「消息」中继续。
                      </p>
                      <p className="text-center text-[11px] font-light text-[#a3988e]">点击空白处或下方按钮可收起本卡片</p>
                      <button
                        type="button"
                        onClick={() => dismissRadarPending()}
                        className="meet-btn-primary w-full py-3 text-[13px]"
                      >
                        知道了
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {sparkDenied ? (
                        <p className="meet-resonance-quote text-center text-[12px] font-light leading-relaxed text-[#a3988e]">
                          本轮未双向心动——可调整寻觅法则或资料后再试。
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          dismissRadarPending()
                          setSparkDenied(false)
                          window.setTimeout(() => runEncounter(), 0)
                        }}
                        className="meet-btn-primary w-full py-3.5 text-[13px]"
                      >
                        下一轮寻觅
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dismissRadarPending()
                          setSparkDenied(false)
                        }}
                        className="w-full py-2 text-[12px] font-light text-[#9a9590] underline-offset-2 hover:underline"
                      >
                        稍后再说
                      </button>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            </AnimatePresence>,
            portalEl,
          )
        : null}

      {portalEl
        ? createPortal(
            <AnimatePresence>
              {drawer ? (
                <motion.div
                  key="meet-filter-root"
                  role="presentation"
                  className="pointer-events-auto fixed inset-0 z-[300] flex items-end justify-center bg-black/35"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  onClick={() => setDrawer(false)}
                >
                  <motion.div
                    layout
                    transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '104%' }}
                    className="pointer-events-auto relative flex max-h-[min(78vh,720px)] w-full max-w-md flex-col rounded-t-[22px] border border-[#e5e0d8] bg-[#faf8f5] shadow-[0_-24px_90px_rgba(22,18,14,0.18)]"
                    style={{
                      paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                  <header className="relative shrink-0 border-b border-[#e8e4dc] px-5 pb-4 pt-5 bg-[#faf8f5]">
                    <button
                      type="button"
                      onClick={commitFilters}
                      className="absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#5c574f]"
                    >
                      确认 · Done
                    </button>
                    <h3 className="text-center font-mono text-[11px] uppercase tracking-[0.28em] text-[#3d3a34]">
                      Match Criteria
                    </h3>
                    <p className="meet-caption-en mt-1 text-center text-[11px] tracking-[0.12em] text-[#7a736b]">
                      寻觅法则
                    </p>
                  </header>

                  <div className="meet-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">
                    <section className="border-b border-[#e8e4dc] pb-5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a9590]">
                        Target Gender · 目标性别
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(
                          [
                            ['male', '男性', 'Male'],
                            ['female', '女性', 'Female'],
                            ['any', '不限', 'Any'],
                          ] as const
                        ).map(([v, zh, en]) => (
                          <button
                            key={v}
                            type="button"
                            aria-pressed={filterDraft.gender === v}
                            onClick={() => setFilterDraft((s) => ({ ...s, gender: v }))}
                            className={`meet-filter-pill-dark px-4 py-2 text-[11px] ${
                              filterDraft.gender === v ? 'meet-filter-pill-dark--on' : ''
                            }`}
                          >
                            {zh}{' '}
                            <span className={filterDraft.gender === v ? 'text-[#D4AF37]' : 'opacity-45'}>({en})</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="border-b border-[#e8e4dc] py-5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a9590]">
                          Orientation Match · 性取向偏好
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOrientationHelpOpen(true)
                          }}
                          aria-expanded={orientationHelpOpen}
                          aria-controls="meet-orientation-help-panel"
                          className="meet-caption-en -mt-0.5 flex shrink-0 items-center gap-1 rounded-full border border-[#e5e0d8] bg-[#fffcf9] px-2.5 py-1 text-[9px] tracking-[0.14em] text-[#6a6560] transition-[border-color,background-color,color] hover:border-[#d4c8b8] hover:text-[#3d3a34] active:scale-[0.98]"
                        >
                          <Info className="size-3.5 text-[#b8973a]" strokeWidth={1.75} aria-hidden />
                          说明
                        </button>
                      </div>
                      <p className="meet-resonance-quote mt-1 text-[10px] italic leading-snug text-[#b5aea4]">
                        筛选与你取向偏好相容的角色设定；可多选；不选即不限。
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {MEET_ORIENTATION_OPTIONS.map((o) => {
                          const on = filterDraft.orientationPreferences.includes(o.id)
                          return (
                            <button
                              key={o.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleOrientation(o.id)}
                              className={`meet-filter-pill-dark max-w-[11.5rem] px-2.5 py-2 text-[10px] leading-snug ${on ? 'meet-filter-pill-dark--on' : ''}`}
                            >
                              {o.zh}{' '}
                              <span className={on ? 'text-[#D4AF37]' : 'opacity-45'}>({o.en})</span>
                            </button>
                          )
                        })}
                      </div>
                    </section>

                    <section className="border-b border-[#e8e4dc] py-5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a9590]">
                        Age Range · 年龄区间
                      </p>
                      <div className="mt-4">
                        <MeetAgeRangeSlider
                          minBound={18}
                          maxBound={55}
                          low={filterDraft.ageMin}
                          high={filterDraft.ageMax}
                          onChange={(lo, hi) =>
                            setFilterDraft((s) => ({
                              ...s,
                              ageMin: lo,
                              ageMax: hi,
                            }))
                          }
                        />
                      </div>
                    </section>

                    <section className="border-b border-[#e8e4dc] py-5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a9590]">
                        Intentions · 交友意向
                      </p>
                      <ul className="mt-4 space-y-2.5">
                        {INTENT_OPTS.map((row) => {
                          const on = filterDraft.meetIntentions.includes(row.id)
                          return (
                            <li key={row.id}>
                              <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleIntention(row.id)}
                                className={`meet-intention-option flex w-full items-center justify-between rounded-[14px] border px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow,color] duration-200 ${
                                  on
                                    ? 'meet-intention-option--on border-[#D4AF37]/45 bg-[#141414] text-[#fafafa] shadow-[0_10px_32px_rgba(20,18,16,0.18)]'
                                    : 'border-[#ebe7e0] bg-[#fffcf9] text-[#4a463f] hover:border-[#d9d3c9]'
                                }`}
                              >
                                <span
                                  className={`text-[13px] ${on ? 'font-medium' : 'font-light'} ${on ? 'text-[#fafafa]' : 'text-[#4a463f]'}`}
                                >
                                  {row.zh}{' '}
                                  <span
                                    className={`meet-caption-en text-[10px] ${on ? 'text-[#D4AF37]' : 'text-[#a39e96]'}`}
                                  >
                                    ({row.en})
                                  </span>
                                </span>
                                {on ? (
                                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/55 bg-[#1f1f1f]">
                                    <PlatinumTick />
                                  </span>
                                ) : (
                                  <span className="size-6 shrink-0 rounded-full border border-[#e5e0d8] bg-white/80" />
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </section>

                    <section className="pt-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a9590]">
                        Vibe · 氛围关键词
                      </p>
                      <input
                        value={filterDraft.keywords}
                        onChange={(e) => setFilterDraft((s) => ({ ...s, keywords: e.target.value }))}
                        placeholder="克制 / 温柔 / 慢热…"
                        className="meet-resonance-quote mt-2 w-full border-b border-gray-200 bg-transparent py-2 text-[13px] font-light italic outline-none placeholder:text-[#c9c4bd]"
                      />
                    </section>
                  </div>

                  {orientationHelpOpen ? (
                    <div
                      id="meet-orientation-help-panel"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="meet-orientation-help-title"
                      className="absolute inset-0 z-[25] flex min-h-0 flex-col rounded-t-[22px] bg-[#faf8f5]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="shrink-0 border-b border-[#e8e4dc] bg-[#faf8f5] px-5 pb-3 pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9a9590]">Glossary</p>
                            <p
                              id="meet-orientation-help-title"
                              className="meet-caption-en mt-0.5 text-[13px] tracking-[0.08em] text-[#2c2a26]"
                            >
                              性取向标签说明
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOrientationHelpOpen(false)}
                            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#e5e0d8] bg-white/90 text-[#7a736b] transition-colors hover:border-[#d4c8b8]"
                            aria-label="关闭说明"
                          >
                            <X className="size-4" strokeWidth={1.5} aria-hidden />
                          </button>
                        </div>
                        <p className="meet-caption-en mt-2 text-[9px] leading-relaxed tracking-[0.06em] text-[#a39e96]">
                          以下为通俗释义，仅供筛选参考；个体自我认同与用语因人而异。
                        </p>
                      </div>
                      <div className="meet-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
                        <ul className="space-y-3">
                          {MEET_ORIENTATION_OPTIONS.map((o) => (
                            <li
                              key={o.id}
                              className="rounded-[14px] border border-[#ebe7e0] bg-[#fffcf9] px-3.5 py-3 shadow-[0_2px_12px_rgba(35,30,24,0.04)]"
                            >
                              <p className="text-[12px] font-medium text-[#2c2a26]">
                                {o.zh}
                                <span className="meet-caption-en ml-2 font-normal text-[10px] text-[#9a9590]">({o.en})</span>
                              </p>
                              <p className="mt-2 text-[11px] leading-relaxed text-[#5c574f]">{MEET_ORIENTATION_HELP_ZH[o.id]}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="shrink-0 border-t border-[#e8e4dc] bg-[#faf8f5] px-5 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3">
                        <button
                          type="button"
                          className="meet-btn-primary w-full py-3 text-[13px]"
                          onClick={() => setOrientationHelpOpen(false)}
                        >
                          知道了
                        </button>
                      </div>
                    </div>
                  ) : null}
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            portalEl,
          )
        : null}

      {card?.comprehensivePersona ? (
        <MeetWorldbookShelfModal
          open={worldbookOpen}
          onClose={() => setWorldbookOpen(false)}
          npcId={card.id}
          nickname={card.nickname}
          avatarUrl={card.avatarUrl}
          dossier={card.comprehensivePersona}
          meetProfile={profile}
        />
      ) : null}
    </div>
  )
}
