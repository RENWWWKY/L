import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Dices,
  ImagePlus,
  ChevronDown,
  Flame,
  Heart,
  Save,
  Sparkles,
  User,
  UserRound,
  X,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ApiConfig } from '../../api/types'
import { MEET_MBTI_SIXTEEN } from '../../lumiMeet/meetPersonaPrompt'
import type { Character, Gender, PlayerIdentity } from './types'
import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'
import { genderLabelZh, randomChineseName } from './utils'
import {
  generatePersonaWithAi,
  repairPersonaAiWithAi,
  PersonaAiGenerateFailure,
  type PersonaAiGenerateResult,
} from './personaAiGenerate'
import {
  emptyPersonaAiGenerateForm,
  PERSONA_AI_APPEARANCE_PRESETS,
  PERSONA_AI_BACKGROUND_PRESETS,
  PERSONA_AI_HOBBIES_PRESETS,
  PERSONA_AI_LIFE_HABITS_PRESETS,
  PERSONA_AI_LOVE_ATTITUDE_PRESETS,
  PERSONA_AI_RELATIONSHIP_HISTORY_PRESETS,
  PERSONA_AI_MBTI_ANY,
  PERSONA_AI_NSFW_PRESETS,
  PERSONA_AI_OCCUPATION_PRESETS,
  PERSONA_AI_ORIENTATION_ANY,
  PERSONA_AI_ORIENTATION_PRESETS,
  PERSONA_AI_PERSONALITY_PRESETS,
  PERSONA_AI_RELATION_PRESETS,
  PERSONA_AI_SPEECH_STYLE_PRESETS,
  type PersonaAiGenerateForm,
} from './personaAiGenerateTypes'
import {
  clearPersonaAiGenerateFormDraft,
  loadPersonaAiGenerateFormDraft,
  savePersonaAiGenerateFormDraft,
  shouldPersistPersonaAiGenerateForm,
} from './personaAiGenerateFormPersist'
import { PlatinumSwitch } from './PlatinumSwitch'
import { WeChatThemePageBackdrop } from './WeChatThemePageBackdrop'

const PAGE_BG = '#F5F5F4'

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-all duration-200 active:scale-[0.97] ${
        active
          ? 'border-neutral-900 bg-white text-neutral-900 shadow-[inset_0_0_0_1px_#171717]'
          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
      }`}
    >
      {label}
    </button>
  )
}

function PresetRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  )
}

function FormSection({
  index,
  title,
  icon: Icon,
  children,
}: {
  index: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-0.5">
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">
          {index}
        </span>
        <Icon className="size-[15px] text-neutral-400" />
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">{title}</h2>
      </div>
      <div
        className="space-y-5 rounded-[18px] bg-white p-4"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03)' }}
      >
        {children}
      </div>
    </section>
  )
}

function FieldBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">{label}</p>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxLength: number
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-xl border-0 bg-neutral-50 px-3.5 py-3 text-[14px] text-neutral-900 outline-none ring-1 ring-neutral-200/80 transition-all placeholder:text-neutral-300 focus:bg-white focus:ring-neutral-900/15"
      />
      {maxLength <= 120 ? (
        <span
          className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px] tabular-nums"
          style={{ color: value.length > maxLength * 0.85 ? '#C45C5C' : '#C4C4CC' }}
        >
          {value.length}/{maxLength}
        </span>
      ) : null}
    </div>
  )
}

function TextArea({
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxLength: number
  rows?: number
}) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="w-full resize-none rounded-xl border-0 bg-neutral-50 px-3.5 py-3 text-[14px] leading-relaxed text-neutral-900 outline-none ring-1 ring-neutral-200/80 transition-all placeholder:text-neutral-300 focus:bg-white focus:ring-neutral-900/15"
      />
      <span
        className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px] tabular-nums"
        style={{ color: value.length > maxLength * 0.85 ? '#C45C5C' : '#C4C4CC' }}
      >
        {value.length}/{maxLength}
      </span>
    </div>
  )
}

function GenderSegment({
  value,
  onChange,
}: {
  value: Gender
  onChange: (g: Gender) => void
}) {
  return (
    <div className="flex rounded-xl bg-neutral-100 p-1">
      {(['female', 'male', 'other'] as Gender[]).map((g) => {
        const active = value === g
        return (
          <button
            key={g}
            type="button"
            onClick={() => onChange(g)}
            className={`flex flex-1 items-center justify-center rounded-[10px] py-2.5 text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] ${
              active ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {genderLabelZh(g)}
          </button>
        )
      })}
    </div>
  )
}

function countFilledHints(form: PersonaAiGenerateForm): number {
  const keys: (keyof PersonaAiGenerateForm)[] = [
    'nameHint',
    'ageHint',
    'occupationHint',
    'appearanceHint',
    'mbtiHint',
    'personalityKeywords',
    'socialMaskHint',
    'backgroundHint',
    'hobbiesHint',
    'lifeHabitsHint',
    'relationToUser',
    'relationDetailHint',
    'relationshipHistoryHint',
    'loveAttitudeHint',
    'orientationHint',
    'nsfwHint',
    'speechStyleHint',
    'extraNotes',
  ]
  return keys.filter((k) => {
    if (k === 'nsfwHint' && !form.nsfwEnabled) return false
    return String(form[k] ?? '').trim().length > 0
  }).length
}

const TOTAL_HINT_SLOTS = 18

function formatSavedAt(ms: number): string {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function PersonaAiGeneratePage({
  draft,
  playerIdentity,
  playerIdentityId,
  wechatAccountId,
  apiConfig,
  worldBackgroundPrompt,
  onBack,
  onGenerated,
}: {
  draft: Character
  playerIdentity: PlayerIdentity | null
  playerIdentityId: string
  wechatAccountId?: string | null
  apiConfig: ApiConfig | null
  worldBackgroundPrompt?: string
  onBack: () => void
  onGenerated: (character: Character) => void
}) {
  const [form, setForm] = useState<PersonaAiGenerateForm>(() => ({
    ...emptyPersonaAiGenerateForm(),
    gender: draft.gender ?? 'female',
    nameHint:
      draft.name?.trim() && draft.name !== '未命名' && draft.name !== '新角色'
        ? draft.name.trim()
        : '',
    avatarUrl: draft.avatarUrl?.trim() ?? '',
  }))
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [recoveryOffer, setRecoveryOffer] = useState<{
    result: PersonaAiGenerateResult
    fatalMessage?: string
    previousIssueCount?: number
  } | null>(null)
  const [recoveryBusy, setRecoveryBusy] = useState<'complete' | 'fix' | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [draftDirty, setDraftDirty] = useState(false)
  const [formHydrated, setFormHydrated] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef(form)
  formRef.current = form
  const wechatAccountIdRef = useRef(wechatAccountId)
  wechatAccountIdRef.current = wechatAccountId
  const playerIdentityIdRef = useRef(playerIdentityId)
  playerIdentityIdRef.current = playerIdentityId

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const saved = await loadPersonaAiGenerateFormDraft(wechatAccountId, playerIdentityId)
        if (cancelled || !saved) return
        setForm(saved.form)
        setSavedAt(saved.savedAt)
        setDraftDirty(false)
      } finally {
        if (!cancelled) setFormHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playerIdentityId, wechatAccountId])

  useEffect(() => {
    return () => {
      if (!formHydrated) return
      const f = formRef.current
      if (!shouldPersistPersonaAiGenerateForm(f)) return
      void savePersonaAiGenerateFormDraft(
        wechatAccountIdRef.current,
        playerIdentityIdRef.current,
        f,
      )
    }
  }, [formHydrated])

  const avatarPreview = useMemo(() => {
    return resolveCharacterAvatarUrl({ avatarUrl: form.avatarUrl }) || ''
  }, [form.avatarUrl])

  const playerDisplayName = useMemo(() => {
    return playerIdentity?.name?.trim() || playerIdentity?.wechatNickname?.trim() || ''
  }, [playerIdentity])

  const filledCount = useMemo(() => countFilledHints(form), [form])
  const progressPct = Math.min(100, Math.round((filledCount / TOTAL_HINT_SLOTS) * 100))

  const patch = (partial: Partial<PersonaAiGenerateForm>) => {
    setDraftDirty(true)
    setForm((prev) => ({ ...prev, ...partial }))
  }

  const finishGenerated = (character: Character) => {
    void clearPersonaAiGenerateFormDraft(wechatAccountId, playerIdentityId)
    onGenerated(character)
  }

  const runSaveDraft = async () => {
    if (saveBusy || generating) return
    if (!shouldPersistPersonaAiGenerateForm(form)) {
      window.alert('当前没有可保存的填写内容')
      return
    }
    setSaveBusy(true)
    try {
      const at = await savePersonaAiGenerateFormDraft(wechatAccountId, playerIdentityId, form)
      setSavedAt(at)
      setDraftDirty(false)
    } catch {
      window.alert('保存失败，请稍后重试')
    } finally {
      setSaveBusy(false)
    }
  }

  const presetTokens = (value: string) =>
    value
      .split('、')
      .map((s) => s.trim())
      .filter(Boolean)

  const togglePresetInField = (field: keyof PersonaAiGenerateForm, kw: string) => {
    const parts = presetTokens(String(form[field] ?? ''))
    if (parts.includes(kw)) {
      patch({ [field]: parts.filter((p) => p !== kw).join('、') })
    } else {
      patch({ [field]: parts.length ? `${parts.join('、')}、${kw}` : kw })
    }
  }

  const toggleSinglePreset = (field: keyof PersonaAiGenerateForm, kw: string) => {
    const current = String(form[field] ?? '').trim()
    patch({ [field]: current === kw ? '' : kw })
  }

  const onPickAvatarFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (src) patch({ avatarUrl: src })
    }
    reader.readAsDataURL(file)
  }

  const runGenerate = async () => {
    if (!apiConfig?.apiUrl?.trim() || !apiConfig?.apiKey?.trim() || !apiConfig?.modelId?.trim()) {
      window.alert('请先在 API 设置中配置聊天模型')
      return
    }
    setGenerating(true)
    setError(null)
    setRecoveryOffer(null)
    try {
      const result = await generatePersonaWithAi({
        apiConfig,
        form,
        draft,
        playerIdentity,
        playerDisplayName,
        worldBackgroundPrompt,
      })
      if (result.issues.length === 0) {
        finishGenerated(result.character)
      } else {
        setRecoveryOffer({ result })
        setError(`生成不完整，有 ${result.issues.length} 项待补全或纠正`)
      }
    } catch (e) {
      if (e instanceof PersonaAiGenerateFailure) {
        const fallback: PersonaAiGenerateResult = {
          character: { ...draft, updatedAt: Date.now() },
          issues: [{ id: 'parse-fatal', kind: 'parse', label: 'JSON 解析失败', detail: e.message }],
          rawText: e.rawText,
          parsedSnapshot: {},
          parseRecovered: false,
        }
        setRecoveryOffer({ result: fallback, fatalMessage: e.message })
        setError(e.message)
      } else {
        const msg = e instanceof Error ? e.message : '生成失败'
        setError(msg)
        window.alert(msg)
      }
    } finally {
      setGenerating(false)
    }
  }

  const runRepair = async (mode: 'complete' | 'fix') => {
    if (!apiConfig || !recoveryOffer) return
    setRecoveryBusy(mode)
    setGenerating(true)
    setError(null)
    const previousIssueCount = recoveryOffer.result.issues.length
    try {
      const next = await repairPersonaAiWithAi({
        apiConfig,
        form,
        draft,
        base: recoveryOffer.result,
        mode,
        playerDisplayName,
        playerIdentity,
        worldBackgroundPrompt,
      })
      if (next.issues.length === 0) {
        setRecoveryOffer(null)
        finishGenerated(next.character)
      } else {
        setRecoveryOffer({ result: next, previousIssueCount })
        setError(`仍有 ${next.issues.length} 项待处理，可继续补全或纠正`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '补全失败'
      setError(msg)
      window.alert(msg)
    } finally {
      setRecoveryBusy(null)
      setGenerating(false)
    }
  }

  const adoptPartialDraft = () => {
    if (!recoveryOffer) return
    finishGenerated(recoveryOffer.result.character)
    setRecoveryOffer(null)
    setError(null)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col" style={{ background: PAGE_BG }}>
      <WeChatThemePageBackdrop />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 shrink-0 border-b border-neutral-200/80 bg-[#F5F5F4]/92 backdrop-blur-xl"
          style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-1 px-2 py-2">
            <button
              type="button"
              onClick={onBack}
              disabled={generating}
              className="rounded-xl p-2.5 text-neutral-800 transition-colors hover:bg-neutral-200/50 disabled:opacity-40"
              aria-label="返回"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold tracking-tight text-neutral-900">
                AI 生成立体人设
              </p>
              <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                按需求填写即可，可留空，AI 会自动补全
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-4 pb-3">
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-200/80">
              <motion.div
                className="h-full rounded-full bg-neutral-900"
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-400">
              {filledCount}/{TOTAL_HINT_SLOTS}
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
          <div className="mx-auto max-w-lg space-y-7 pb-4">
            <FormSection index="01" title="基础画像" icon={UserRound}>
              <FieldBlock label="性别">
                <GenderSegment value={form.gender} onChange={(g) => patch({ gender: g })} />
              </FieldBlock>

              <div className="flex flex-col items-center gap-3 rounded-2xl bg-neutral-50/90 px-4 py-5 ring-1 ring-neutral-200/70">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative flex size-[84px] items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-neutral-200/80 transition-all active:scale-[0.98]"
                    aria-label="上传头像"
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="size-full object-cover" />
                    ) : (
                      <User className="size-9 text-neutral-300" strokeWidth={1.25} />
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200">
                      <ImagePlus className="size-3.5 text-neutral-700" strokeWidth={2} />
                    </span>
                  </button>
                  {form.avatarUrl.trim() ? (
                    <button
                      type="button"
                      onClick={() => patch({ avatarUrl: '' })}
                      className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-neutral-900 text-white shadow-sm transition-transform active:scale-95"
                      aria-label="移除头像"
                    >
                      <X className="size-3.5" strokeWidth={2.5} />
                    </button>
                  ) : null}
                </div>

                <div className="relative w-full max-w-[min(100%,15rem)]">
                  <input
                    value={form.nameHint}
                    onChange={(e) => patch({ nameHint: e.target.value })}
                    placeholder="留空由 AI 生成"
                    maxLength={12}
                    className="w-full rounded-xl border-0 bg-white px-3.5 py-3 pr-11 text-center text-[17px] font-semibold tracking-tight text-neutral-900 outline-none ring-1 ring-neutral-200/80 transition-all placeholder:text-[13px] placeholder:font-normal placeholder:text-neutral-300 focus:ring-neutral-900/15"
                  />
                  <button
                    type="button"
                    title="随机姓名"
                    onClick={() => patch({ nameHint: randomChineseName(form.gender) })}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                    aria-label="随机姓名"
                  >
                    <Dices className="size-[18px]" strokeWidth={1.5} />
                  </button>
                </div>
                <p className="max-w-[min(100%,15rem)] text-center text-[11px] leading-relaxed text-neutral-400">
                  先选性别，再点骰子可随机符合性别的名字
                </p>
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onPickAvatarFile(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />

              <FieldBlock label="年龄方向">
                <TextInput
                  value={form.ageHint}
                  onChange={(v) => patch({ ageHint: v })}
                  placeholder="例：25岁、20-28岁、比 {{user}} 大两岁"
                  maxLength={48}
                />
              </FieldBlock>

              <FieldBlock label="职业 / 身份">
                <PresetRow>
                  {PERSONA_AI_OCCUPATION_PRESETS.map((kw) => (
                    <Chip
                      key={kw}
                      label={kw}
                      active={form.occupationHint === kw}
                      onClick={() => toggleSinglePreset('occupationHint', kw)}
                    />
                  ))}
                </PresetRow>
                <TextInput
                  value={form.occupationHint}
                  onChange={(v) => patch({ occupationHint: v })}
                  placeholder="例：独立插画师、律所刑辩律师"
                  maxLength={64}
                />
              </FieldBlock>

              <FieldBlock label="外貌 / 形象">
                <PresetRow>
                  {PERSONA_AI_APPEARANCE_PRESETS.map((kw) => (
                    <Chip
                      key={kw}
                      label={kw}
                      active={presetTokens(form.appearanceHint).includes(kw)}
                      onClick={() => togglePresetInField('appearanceHint', kw)}
                    />
                  ))}
                </PresetRow>
                <TextInput
                  value={form.appearanceHint}
                  onChange={(v) => patch({ appearanceHint: v })}
                  placeholder="例：清冷短发、常穿 oversize、有耳钉"
                  maxLength={120}
                />
              </FieldBlock>

              <FieldBlock label="MBTI 倾向">
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => patch({ mbtiHint: '' })}
                    className={`col-span-4 rounded-xl border py-2 text-[12px] font-medium transition-all ${
                      !form.mbtiHint.trim() || form.mbtiHint === PERSONA_AI_MBTI_ANY
                        ? 'border-neutral-900 bg-white text-neutral-900 shadow-[inset_0_0_0_1px_#171717]'
                        : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {PERSONA_AI_MBTI_ANY}
                  </button>
                  {MEET_MBTI_SIXTEEN.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => patch({ mbtiHint: form.mbtiHint.toUpperCase() === m ? '' : m })}
                      className={`rounded-lg border py-2 font-mono text-[11px] font-semibold tracking-wide transition-all active:scale-[0.97] ${
                        form.mbtiHint.toUpperCase() === m
                          ? 'border-neutral-900 bg-white text-neutral-900 shadow-[inset_0_0_0_1px_#171717]'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </FieldBlock>
            </FormSection>

            <FormSection index="02" title="性格与过往" icon={BookOpen}>
              <FieldBlock label="性格 / 气质">
                <PresetRow>
                  {PERSONA_AI_PERSONALITY_PRESETS.map((kw) => (
                    <Chip
                      key={kw}
                      label={kw}
                      active={presetTokens(form.personalityKeywords).includes(kw)}
                      onClick={() => togglePresetInField('personalityKeywords', kw)}
                    />
                  ))}
                </PresetRow>
                <TextArea
                  value={form.personalityKeywords}
                  onChange={(v) => patch({ personalityKeywords: v })}
                  placeholder="例：慢热、嘴硬心软、克制、有边界感"
                  maxLength={200}
                  rows={2}
                />
              </FieldBlock>

              <FieldBlock label="社交面具">
                <TextInput
                  value={form.socialMaskHint}
                  onChange={(v) => patch({ socialMaskHint: v })}
                  placeholder="例：对外礼貌疏离，对熟人话多毒舌"
                  maxLength={120}
                />
              </FieldBlock>

              <FieldBlock label="身世 / 背景梗">
                <PresetRow>
                  {PERSONA_AI_BACKGROUND_PRESETS.map((kw) => (
                    <Chip
                      key={kw}
                      label={kw}
                      active={presetTokens(form.backgroundHint).includes(kw)}
                      onClick={() => togglePresetInField('backgroundHint', kw)}
                    />
                  ))}
                </PresetRow>
                <TextArea
                  value={form.backgroundHint}
                  onChange={(v) => patch({ backgroundHint: v })}
                  placeholder="例：小镇出来打拼，靠奖学金读完研"
                  maxLength={200}
                  rows={2}
                />
              </FieldBlock>

              <FieldBlock label="兴趣爱好">
                <PresetRow>
                  {PERSONA_AI_HOBBIES_PRESETS.map((kw) => (
                    <Chip
                      key={kw}
                      label={kw}
                      active={presetTokens(form.hobbiesHint).includes(kw)}
                      onClick={() => togglePresetInField('hobbiesHint', kw)}
                    />
                  ))}
                </PresetRow>
                <TextArea
                  value={form.hobbiesHint}
                  onChange={(v) => patch({ hobbiesHint: v })}
                  placeholder="例：周末扫街拍照、深夜听播客、偶尔自己做饭"
                  maxLength={200}
                  rows={2}
                />
              </FieldBlock>

              <FieldBlock label="小习惯">
                <PresetRow>
                  {PERSONA_AI_LIFE_HABITS_PRESETS.map((kw) => (
                    <Chip
                      key={kw}
                      label={kw}
                      active={presetTokens(form.lifeHabitsHint).includes(kw)}
                      onClick={() => togglePresetInField('lifeHabitsHint', kw)}
                    />
                  ))}
                </PresetRow>
                <TextArea
                  value={form.lifeHabitsHint}
                  onChange={(v) => patch({ lifeHabitsHint: v })}
                  placeholder="例：不抽烟；偶尔和朋友小酌；熬夜但会补觉"
                  maxLength={200}
                  rows={2}
                />
              </FieldBlock>

              <FieldBlock label="性取向">
                <PresetRow>
                  <Chip
                    label={PERSONA_AI_ORIENTATION_ANY}
                    active={
                      !form.orientationHint.trim() || form.orientationHint === PERSONA_AI_ORIENTATION_ANY
                    }
                    onClick={() => patch({ orientationHint: '' })}
                  />
                  {PERSONA_AI_ORIENTATION_PRESETS.map((kw) => (
                    <Chip
                      key={kw}
                      label={kw}
                      active={form.orientationHint === kw}
                      onClick={() => toggleSinglePreset('orientationHint', kw)}
                    />
                  ))}
                </PresetRow>
                <TextInput
                  value={
                    PERSONA_AI_ORIENTATION_PRESETS.includes(
                      form.orientationHint as (typeof PERSONA_AI_ORIENTATION_PRESETS)[number],
                    ) || !form.orientationHint.trim() || form.orientationHint === PERSONA_AI_ORIENTATION_ANY
                      ? ''
                      : form.orientationHint
                  }
                  onChange={(v) => patch({ orientationHint: v })}
                  placeholder="也可自定义，留空则由 AI 设定"
                  maxLength={80}
                />
              </FieldBlock>

              <FieldBlock label="取向是否可变">
                <PresetRow>
                  <Chip
                    label="固定"
                    active={!form.orientationMutable}
                    onClick={() => patch({ orientationMutable: false })}
                  />
                  <Chip
                    label="可变"
                    active={form.orientationMutable}
                    onClick={() => patch({ orientationMutable: true })}
                  />
                </PresetRow>
                {form.orientationMutable ? (
                  <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-[12px] leading-relaxed text-sky-800">
                    「取向与自我认同」归入尾声延展层（priority=after），条目可在剧情中更新。「可变」仅指这一层级，生成正文仍写当下稳定认同，不会预设「取向可能会动摇」。
                  </p>
                ) : (
                  <p className="text-[12px] leading-relaxed text-neutral-400">
                    固定时写入序言层，生成后默认不随聊天自动改写。
                  </p>
                )}
              </FieldBlock>
            </FormSection>

            <FormSection index="03" title={'与 {{user}} 的关系'} icon={Heart}>
              <FieldBlock label="关系类型">
                <PresetRow>
                  {PERSONA_AI_RELATION_PRESETS.map((rel) => (
                    <Chip
                      key={rel}
                      label={rel}
                      active={form.relationToUser === rel}
                      onClick={() => toggleSinglePreset('relationToUser', rel)}
                    />
                  ))}
                </PresetRow>
                <TextInput
                  value={form.relationToUser}
                  onChange={(v) => patch({ relationToUser: v })}
                  placeholder="也可自定义：合租室友，刚认识两周"
                  maxLength={120}
                />
              </FieldBlock>

              <FieldBlock label="开局关系细节">
                <TextArea
                  value={form.relationDetailHint}
                  onChange={(v) => patch({ relationDetailHint: v })}
                  placeholder="例：同事拉群认识的，上次聊到加班，还没深聊私事"
                  maxLength={240}
                  rows={2}
                />
              </FieldBlock>

              <FieldBlock label="感情史">
                <PresetRow>
                  {PERSONA_AI_RELATIONSHIP_HISTORY_PRESETS.map((kw) => (
                    <Chip
                      key={kw}
                      label={kw}
                      active={form.relationshipHistoryHint === kw}
                      onClick={() => toggleSinglePreset('relationshipHistoryHint', kw)}
                    />
                  ))}
                </PresetRow>
                <TextArea
                  value={
                    PERSONA_AI_RELATIONSHIP_HISTORY_PRESETS.includes(
                      form.relationshipHistoryHint as (typeof PERSONA_AI_RELATIONSHIP_HISTORY_PRESETS)[number],
                    )
                      ? ''
                      : form.relationshipHistoryHint
                  }
                  onChange={(v) => patch({ relationshipHistoryHint: v })}
                  placeholder="例：大学谈过一段，毕业后异地和平分手；此后单身两年"
                  maxLength={240}
                  rows={2}
                />
              </FieldBlock>

              <FieldBlock label="亲密态度">
                <PresetRow>
                  {PERSONA_AI_LOVE_ATTITUDE_PRESETS.map((kw) => (
                    <Chip
                      key={kw}
                      label={kw}
                      active={form.loveAttitudeHint === kw}
                      onClick={() => toggleSinglePreset('loveAttitudeHint', kw)}
                    />
                  ))}
                </PresetRow>
                <TextInput
                  value={form.loveAttitudeHint}
                  onChange={(v) => patch({ loveAttitudeHint: v })}
                  placeholder="例：慢热试探，不吃占有欲式撒娇"
                  maxLength={120}
                />
              </FieldBlock>
            </FormSection>

            <section
              className="overflow-hidden rounded-[18px] bg-white"
              style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03)' }}
            >
              <div className="flex items-center gap-2.5 px-4 py-3.5">
                <span
                  className={`flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    form.nsfwEnabled ? 'bg-rose-100 text-rose-700' : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  18
                </span>
                <Flame
                  className={`size-[15px] ${form.nsfwEnabled ? 'text-rose-500' : 'text-neutral-400'}`}
                  strokeWidth={2}
                />
                <span className="flex-1 text-[15px] font-semibold text-neutral-900">亲密偏好档案</span>
                <PlatinumSwitch
                  checked={form.nsfwEnabled}
                  onChange={(next) => patch({ nsfwEnabled: next, ...(next ? {} : { nsfwHint: '' }) })}
                  aria-label="开启亲密偏好档案"
                />
              </div>

              <AnimatePresence initial={false}>
                {form.nsfwEnabled ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-5 border-t border-neutral-100 px-4 pb-4 pt-1">
                      <FieldBlock label="亲密偏好">
                        <PresetRow>
                          {PERSONA_AI_NSFW_PRESETS.map((kw) => (
                            <Chip
                              key={kw}
                              label={kw}
                              active={presetTokens(form.nsfwHint).includes(kw)}
                              onClick={() => togglePresetInField('nsfwHint', kw)}
                            />
                          ))}
                        </PresetRow>
                        <TextArea
                          value={form.nsfwHint}
                          onChange={(v) => patch({ nsfwHint: v })}
                          placeholder="留空由 AI 生成；也可自填偏好、节奏、边界等"
                          maxLength={500}
                          rows={4}
                        />
                      </FieldBlock>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>


            <section
              className="overflow-hidden rounded-[18px] bg-white"
              style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03)' }}
            >
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50/80"
              >
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">
                  04
                </span>
                <Users className="size-[15px] text-neutral-400" strokeWidth={2} />
                <span className="flex-1 text-[15px] font-semibold text-neutral-900">更多设定</span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                  可选
                </span>
                <motion.span animate={{ rotate: moreOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="size-[18px] text-neutral-400" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {moreOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-5 border-t border-neutral-100 px-4 pb-4 pt-1">
                      <FieldBlock label="口语 / 口头禅习惯">
                        <PresetRow>
                          {PERSONA_AI_SPEECH_STYLE_PRESETS.map((kw) => (
                            <Chip
                              key={kw}
                              label={kw}
                              active={presetTokens(form.speechStyleHint).includes(kw)}
                              onClick={() => togglePresetInField('speechStyleHint', kw)}
                            />
                          ))}
                        </PresetRow>
                        <TextInput
                          value={form.speechStyleHint}
                          onChange={(v) => patch({ speechStyleHint: v })}
                          placeholder="例：说话短、不爱 emoji、偶尔毒舌"
                          maxLength={120}
                        />
                      </FieldBlock>

                      <FieldBlock label="补充说明">
                        <TextArea
                          value={form.extraNotes}
                          onChange={(v) => patch({ extraNotes: v })}
                          placeholder="例：都市写实向，不要霸总语录；参考某剧某角色的克制感但不要抄名"
                          maxLength={600}
                          rows={4}
                        />
                      </FieldBlock>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>

            {error ? (
              <p className="rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-700">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="shrink-0 border-t border-neutral-200/80 bg-[#F5F5F4]/95 px-4 pt-3 backdrop-blur-md"
          style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={generating || saveBusy}
                onClick={() => void runSaveDraft()}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-[14px] font-semibold text-neutral-800 transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
              >
                <Save className="size-[16px]" strokeWidth={2} />
                {saveBusy ? '保存中…' : '保存填写'}
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={() => void runGenerate()}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-white transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
                style={{
                  background: 'linear-gradient(180deg, #262626 0%, #171717 100%)',
                  boxShadow: '0 8px 24px rgba(23,23,23,0.18)',
                }}
              >
                <Sparkles className="size-[18px]" strokeWidth={2} />
                {generating ? '正在生成…' : '开始 AI 生成'}
              </button>
            </div>
            <p className="px-0.5 text-center text-[11px] text-neutral-400">
              {saveBusy
                ? '正在写入本地草稿…'
                : savedAt && !draftDirty
                  ? `已保存 · ${formatSavedAt(savedAt)}（切换页面后再进入会自动恢复）`
                  : draftDirty
                    ? '有未保存修改；离开页面前建议点「保存填写」'
                    : '填写后可保存草稿，生成成功后会自动清除'}
            </p>
          </div>
        </div>
      </div>

      {generating ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 px-6 backdrop-blur-[3px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-[300px] rounded-[20px] bg-white px-6 py-6 text-center"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
          >
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl bg-neutral-100">
              <Sparkles className="size-5 animate-pulse text-neutral-800" />
            </div>
            <p className="text-[15px] font-semibold text-neutral-900">正在生成立体人设…</p>
            <div className="mt-4 flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-neutral-800"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      ) : null}

      {recoveryOffer && !generating ? (
        <div className="fixed inset-0 z-[1350] flex items-end justify-center bg-black/45 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-8 backdrop-blur-[2px] sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-h-[min(78dvh,560px)] w-full max-w-md overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
          >
            <div className="border-b border-neutral-100 px-5 py-4">
              <p className="text-[17px] font-semibold text-neutral-900">
                {recoveryOffer.fatalMessage ? '生成中断' : '生成未完整'}
              </p>
            </div>
            <div className="max-h-[220px] overflow-y-auto px-5 py-3">
              <ul className="space-y-1.5 text-[12px] leading-relaxed text-neutral-500">
                {recoveryOffer.result.issues.slice(0, 12).map((issue) => (
                  <li key={issue.id} className="flex gap-2">
                    <span className="shrink-0 text-red-400">·</span>
                    <span>
                      <span className="font-medium text-neutral-700">{issue.label}</span>
                      {issue.detail ? <span className="text-neutral-400"> — {issue.detail}</span> : null}
                    </span>
                  </li>
                ))}
                {recoveryOffer.result.issues.length > 12 ? (
                  <li className="text-neutral-400">…还有 {recoveryOffer.result.issues.length - 12} 项</li>
                ) : null}
              </ul>
            </div>
            <div className="space-y-2 border-t border-neutral-100 px-4 py-4">
              <button
                type="button"
                disabled={!!recoveryBusy}
                onClick={() => void runRepair('complete')}
                className="flex w-full items-center justify-center rounded-xl px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(180deg, #262626 0%, #171717 100%)' }}
              >
                {recoveryBusy === 'complete' ? '正在补全…' : '继续补全剩余条目'}
              </button>
              <button
                type="button"
                disabled={!!recoveryBusy}
                onClick={() => void runRepair('fix')}
                className="flex w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[14px] font-semibold text-neutral-900 disabled:opacity-50"
              >
                {recoveryBusy === 'fix' ? '正在纠正…' : '纠正出错内容'}
              </button>
              {!recoveryOffer.fatalMessage ? (
                <button
                  type="button"
                  disabled={!!recoveryBusy}
                  onClick={adoptPartialDraft}
                  className="w-full py-2 text-[13px] font-medium text-neutral-500 disabled:opacity-50"
                >
                  先采用当前草稿，稍后在世界书里改
                </button>
              ) : null}
              <button
                type="button"
                disabled={!!recoveryBusy}
                onClick={() => {
                  setRecoveryOffer(null)
                  setError(null)
                }}
                className="w-full py-2 text-[13px] text-neutral-400"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  )
}
