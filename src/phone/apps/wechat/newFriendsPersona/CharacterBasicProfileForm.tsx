import { AnimatePresence, motion } from 'framer-motion'
import { Dices, ImagePlus, Link2, Plus, Sparkles, User, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApiConfig } from '../../api/types'
import { PlaceholderAwareTextarea } from './characterFieldPlaceholderPreview'
import type { Character, Gender } from './types'
import { generateCharacterBio } from './ai'
import { personaDb } from './idb'
import {
  calculateBMI,
  getZodiacSign,
  bmiStatusLabelZh,
  parseHeightCm,
  parseWeightKg,
  zodiacZhFromStoredMD,
  normalizeBirthdayMD,
} from './characterProfilePhysioUtils'
import { isLargeMbtiAvatar, MBTI_SUMMARY_4, resolveMbtiImageUrl } from './mbtiProfileUi'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import { formatWorldBackgroundForPrompt } from './worldBackgroundFormat'
import { IDENTITY_POOL, daysInMonth, formatMD, randomChineseName } from './utils'

const SHEET_LINES = '#e5e5e5'
const FG = '#0a0a0a'
const MUTED = '#737373'

const inputUnderline =
  'w-full border-0 border-b border-neutral-200 bg-transparent py-2.5 text-[15px] text-neutral-950 outline-none ring-0 transition-colors duration-200 placeholder:text-neutral-300 focus:border-neutral-950 focus:ring-0'

const gridLabel = 'text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400'

const MBTI_LIST = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
] as const

export type CharacterBasicProfileFormProps = {
  editorId: string
  character: Character
  isNpcPerspective: boolean
  protagonistCallsUser: string
  onProtagonistCallsChange: (v: string) => void
  onProtagonistCallsInteraction: () => void

  avatarFileInputRef: React.RefObject<HTMLInputElement | null>
  onPickAvatarFile: (file: File | null) => void

  patchCharacter: (p: Partial<Character>) => void
  /** 写入 MBTI 并同步人设世界书中的「人格设定」册 */
  onMbtiSelect: (nextCode: string) => void

  apiConfig: ApiConfig | null
  bioGenerating: boolean
  setBioGenerating: (v: boolean) => void
  onBioApiMissing: () => void
  onBioWorldBookMissing: () => void

  genderLabelZh: (g: Gender | undefined | null) => string
}

type FormShape = {
  name: string
  motto: string
  gender: Gender
  age: string
  height: string
  weight: string
  birthdayMD: string
  mbti: string
  identity: string
  bio: string
  avatarUrl: string
}

function toForm(character: Character): FormShape {
  return {
    name: character.name,
    motto: character.motto ?? '',
    gender: character.gender,
    age: character.age != null ? String(character.age) : '',
    height: character.height ?? '',
    weight: character.weight ?? '',
    birthdayMD: character.birthdayMD ?? '01-01',
    mbti: character.mbti ?? '',
    identity: character.identity ?? '',
    bio: character.bio ?? '',
    avatarUrl: character.avatarUrl ?? '',
  }
}

function formToPatch(f: FormShape): Partial<Character> {
  const ageTrim = f.age.trim()
  const ageNum = ageTrim ? Number(ageTrim) : null
  const md = normalizeBirthdayMD(f.birthdayMD)
  return {
    name: f.name,
    motto: f.motto.trim() ? f.motto : undefined,
    gender: f.gender,
    age: ageNum != null && Number.isFinite(ageNum) ? ageNum : null,
    height: f.height,
    weight: f.weight,
    birthdayMD: md,
    zodiac: zodiacZhFromStoredMD(md),
    mbti: f.mbti.trim() || undefined,
    identity: f.identity,
    bio: f.bio,
    avatarUrl: f.avatarUrl.trim(),
  }
}

export function CharacterBasicProfileForm({
  editorId,
  character,
  isNpcPerspective,
  protagonistCallsUser,
  onProtagonistCallsChange,
  onProtagonistCallsInteraction,
  avatarFileInputRef,
  onPickAvatarFile,
  patchCharacter,
  onMbtiSelect,
  apiConfig,
  bioGenerating,
  setBioGenerating,
  onBioApiMissing,
  onBioWorldBookMissing,
  genderLabelZh,
}: CharacterBasicProfileFormProps) {
  const [avatarSheet, setAvatarSheet] = useState(false)
  const [urlDialog, setUrlDialog] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [mbtiSheet, setMbtiSheet] = useState(false)
  const [identityFocused, setIdentityFocused] = useState(false)

  /** 打字机：临时正文，结束时写回表单与 Character */
  const [bioTyping, setBioTyping] = useState<string | null>(null)
  const typingTimerRef = useRef<number | null>(null)

  const prevIdRef = useRef<string>('')
  const characterRef = useRef(character)
  characterRef.current = character

  const [form, setForm] = useState<FormShape>(() => toForm(character))

  const heightW = form.height
  const weightW = form.weight
  const birthdayW = form.birthdayMD

  const bmiMemo = useMemo(() => {
    const hCm = parseHeightCm(heightW)
    const wKg = parseWeightKg(weightW)
    const bmi = hCm != null && wKg != null ? calculateBMI(hCm, wKg) : null
    if (bmi == null) return null
    return { value: bmi, tier: bmiStatusLabelZh(bmi) }
  }, [heightW, weightW])

  const zodiacMemo = useMemo(() => getZodiacSign(birthdayW), [birthdayW])

  const birthdayParts = useMemo(() => {
    const v = form.birthdayMD || ''
    const m = Number(v.slice(0, 2))
    const d = Number(v.slice(3, 5))
    return {
      month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1,
      day: Number.isFinite(d) && d >= 1 && d <= 31 ? d : 1,
    }
  }, [form.birthdayMD])

  useEffect(() => {
    const cid = character.id.trim()
    if (!cid) return
    if (prevIdRef.current !== cid) {
      prevIdRef.current = cid
      setForm(toForm(characterRef.current))
    }
  }, [character.id])

  useEffect(() => {
    const next = character.avatarUrl ?? ''
    setForm((prev) => (prev.avatarUrl === next ? prev : { ...prev, avatarUrl: next }))
  }, [character.avatarUrl])

  useEffect(() => {
    const m = character.mbti ?? ''
    setForm((prev) => (prev.mbti === m ? prev : { ...prev, mbti: m }))
  }, [character.mbti])

  const pushField = useCallback(
    (patch: Partial<FormShape>) => {
      setForm((prev) => {
        const next = { ...prev, ...patch }
        patchCharacter(formToPatch(next))
        return next
      })
    },
    [patchCharacter],
  )

  const formRef = useRef(form)
  formRef.current = form

  const runBioTypewriter = useCallback(
    (full: string) => {
      if (typingTimerRef.current) window.clearInterval(typingTimerRef.current)
      setBioTyping('')
      let i = 0
      typingTimerRef.current = window.setInterval(() => {
        i += 1
        const slice = full.slice(0, i)
        setBioTyping(slice)
        if (i >= full.length) {
          if (typingTimerRef.current) window.clearInterval(typingTimerRef.current)
          typingTimerRef.current = null
          setBioTyping(null)
          setForm((prev) => {
            const next = { ...prev, bio: full }
            patchCharacter(formToPatch(next))
            return next
          })
        }
      }, 16)
    },
    [patchCharacter],
  )

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearInterval(typingTimerRef.current)
    }
  }, [])

  const onAiExpandBrief = async () => {
    if (bioGenerating) return
    try {
      setBioGenerating(true)
      if (!apiConfig?.apiUrl || !apiConfig?.apiKey || !apiConfig?.modelId) {
        onBioApiMissing()
        return
      }
      const merged: Character = { ...character, ...formToPatch(formRef.current) }
      const identityContext = merged.playerIdentityId?.trim()
        ? await personaDb.getPlayerIdentity(merged.playerIdentityId)
        : await personaDb.getCurrentIdentity()
      const wbRow =
        merged.worldBackgroundEnabled === false ? null : await personaDb.getWorldBackground(merged.worldBackgroundId ?? DEFAULT_WORLD_BACKGROUND_ID)
      const worldBackgroundPrompt = formatWorldBackgroundForPrompt(wbRow)
      let v = ''
      try {
        v = await generateCharacterBio({
          apiConfig,
          character: merged,
          identityContext,
          worldBackgroundPrompt,
        })
      } catch (e) {
        if (e instanceof Error && /缺少世界书内容/i.test(e.message)) onBioWorldBookMissing()
        else if (e instanceof Error && /未配置 AI API/i.test(e.message)) onBioApiMissing()
        throw e
      }
      runBioTypewriter(v)
    } catch {
      /* 错误已在 overlay / toast 钩子中处理 */
    } finally {
      setBioGenerating(false)
    }
  }

  const openLocalPicker = () => {
    avatarFileInputRef.current?.click()
    setAvatarSheet(false)
  }

  const confirmUrlAvatar = () => {
    const t = urlDraft.trim()
    if (/^https?:\/\//i.test(t)) {
      pushField({ avatarUrl: t })
      setUrlDialog(false)
      setUrlDraft('')
      setAvatarSheet(false)
    }
  }

  const displayBio = bioTyping != null ? bioTyping : form.bio

  return (
    <div className="pb-10">
      <hr className="mb-10 border-neutral-200" />

      <section aria-labelledby="blk-visual">
        <p id="blk-visual" className="mb-6">
          <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-400">Visual · Identity</span>
          <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-neutral-500">视觉与代号</span>
        </p>

        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => setAvatarSheet(true)}
            className="relative flex size-24 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm transition-colors active:bg-neutral-50"
          >
            {form.avatarUrl?.trim() ? (
              <img src={form.avatarUrl} alt="" className="size-full rounded-full object-cover" />
            ) : (
              <User className="size-10 text-neutral-300" strokeWidth={1.25} />
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm">
              <Plus className="size-4 text-neutral-600" strokeWidth={1.5} />
            </span>
          </button>

          <div className="relative mx-auto mt-8 w-full max-w-[min(100%,18rem)]">
            <input
              value={form.name}
              placeholder="姓名"
              className={`${inputUnderline} px-1 text-center text-xl font-semibold tracking-tight`}
              onChange={(e) => pushField({ name: e.target.value })}
            />
            <button
              type="button"
              title="随机姓名"
              onClick={() => pushField({ name: randomChineseName(form.gender) })}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full border border-transparent p-2 text-neutral-600 transition-colors hover:border-neutral-200 hover:bg-neutral-50"
            >
              <Dices className="size-[18px]" strokeWidth={1.5} />
            </button>
          </div>

          <textarea
            value={form.motto}
            rows={2}
            placeholder="输入角色的信条…"
            maxLength={15}
            className={`${inputUnderline} mt-6 min-h-[2.75rem] resize-none px-1 text-center text-xs italic text-neutral-400 font-serif`}
            style={{ fontFamily: 'Georgia, ui-serif, serif' }}
            onChange={(e) => pushField({ motto: e.target.value })}
          />
        </div>
      </section>

      <hr className="my-10 border-neutral-100" />

      <section aria-labelledby="blk-physical">
        <p id="blk-physical" className="mb-5">
          <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-400">Physical</span>
          <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-neutral-500">身体侧写</span>
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-7">
          <div>
            <p className={gridLabel}>AGE · 年龄</p>
            <input
              value={form.age}
              inputMode="numeric"
              placeholder="—"
              className={`${inputUnderline} mt-1`}
              onChange={(e) => pushField({ age: e.target.value })}
            />
          </div>

          <div>
            <p className={gridLabel}>GENDER · 性别</p>
            <div className="mt-3 flex gap-3">
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => pushField({ gender: g })}
                  className={`rounded-full border px-4 py-1.5 text-[12px] font-medium transition-colors ${
                    form.gender === g ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 text-neutral-600'
                  }`}
                >
                  {genderLabelZh(g)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={gridLabel}>HEIGHT · 身高（厘米）</p>
            <input
              value={form.height}
              inputMode="decimal"
              placeholder="如 170"
              className={`${inputUnderline} mt-1 font-mono text-[13px]`}
              onChange={(e) => pushField({ height: e.target.value })}
            />
          </div>

          <div>
            <p className={gridLabel}>WEIGHT · 体重（千克）</p>
            <input
              value={form.weight}
              inputMode="decimal"
              placeholder="如 56"
              className={`${inputUnderline} mt-1 font-mono text-[13px]`}
              onChange={(e) => pushField({ weight: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-8 border border-neutral-200 bg-neutral-50/80 px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            BMI · 体质指数
          </p>
          {bmiMemo ? (
            <p className="mt-2 font-mono text-[15px] text-neutral-950" style={{ letterSpacing: '-0.02em' }}>
              {bmiMemo.value.toFixed(2)}
              <span className="ml-3 text-[12px] font-normal text-neutral-600">
                [<span style={{ color: FG }}>{bmiMemo.tier}</span>]
              </span>
            </p>
          ) : (
            <p className="mt-2 text-[13px] font-light" style={{ color: MUTED }}>
              填写身高体重后自动生成
            </p>
          )}
        </div>
      </section>

      <hr className="my-10 border-neutral-100" />

      <section aria-labelledby="blk-bonds">
        <p id="blk-bonds" className="mb-5">
          <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-400">Destiny · Bonds</span>
          <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-neutral-500">命理与羁绊</span>
        </p>

        <div>
          <p className={gridLabel}>BIRTHDAY · 生日（仅月日）</p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="min-w-[7rem] flex-1">
              <span className="text-[10px] text-neutral-400">MONTH · 月</span>
              <select
                value={birthdayParts.month}
                className={`${inputUnderline} mt-1 block w-full bg-transparent`}
                onChange={(e) => {
                  const month = Number(e.target.value)
                  const maxD = daysInMonth(month)
                  const day = Math.min(birthdayParts.day, maxD)
                  pushField({ birthdayMD: formatMD(month, day) })
                }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
                  <option key={mo} value={mo}>
                    {mo} 月
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[7rem] flex-1">
              <span className="text-[10px] text-neutral-400">DAY · 日</span>
              <select
                value={birthdayParts.day}
                className={`${inputUnderline} mt-1 block w-full bg-transparent`}
                onChange={(e) => {
                  const day = Number(e.target.value)
                  pushField({ birthdayMD: formatMD(birthdayParts.month, day) })
                }}
              >
                {Array.from({ length: daysInMonth(birthdayParts.month) }, (_, i) => i + 1).map((dy) => (
                  <option key={dy} value={dy}>
                    {dy} 日
                  </option>
                ))}
              </select>
            </label>
          </div>
          {zodiacMemo ? (
            <p className="mt-3 px-1 font-serif text-sm italic tracking-wide text-neutral-700">
              {zodiacMemo.zh}
              <span className="ml-1.5 text-[12px] not-italic text-neutral-500">（{zodiacMemo.en}）</span>
            </p>
          ) : (
            <p className="mt-3 px-1 text-[12px] text-neutral-400">选择月、日后自动推演星座（纯文字）</p>
          )}
        </div>

        <label className="mt-10 block">
          <p className={gridLabel}>ALIAS · 对你的称呼</p>
          <p className="mt-2 text-[11px] leading-relaxed font-light text-neutral-400">
            {isNpcPerspective
              ? '与当前主角人脉里「你↔主角」连线一致，在此修改会写回人脉。'
              : '主角如何称呼绑定身份的你；与同档案 NPC 共用一条人脉数据。'}
          </p>
          <input
            value={protagonistCallsUser}
            onChange={(e) => {
              onProtagonistCallsInteraction()
              onProtagonistCallsChange(e.target.value)
            }}
            placeholder="如：学姐、债主、小鬼…"
            className={`${inputUnderline} mt-2`}
          />
        </label>

        <div className="mt-10">
          <p className={gridLabel}>MBTI · 人格（十六型）</p>
          <button
            type="button"
            onClick={() => setMbtiSheet(true)}
            className={`${inputUnderline} mt-1 flex w-full items-center justify-between text-left`}
          >
            <span className={form.mbti?.trim() ? 'text-neutral-950' : 'text-neutral-300'}>{form.mbti?.trim() || '未选择'}</span>
          </button>
        </div>

        <div className="mt-10">
          <p className={gridLabel}>ROLE · 身份（职业 / 定位）</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {IDENTITY_POOL.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => pushField({ identity: x })}
                className={`rounded-full border px-4 py-1.5 text-[11px] font-medium tracking-wide transition-colors ${
                  form.identity === x && !identityFocused
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-200 text-neutral-600'
                }`}
              >
                {x}
              </button>
            ))}
          </div>
          <input
            value={form.identity}
            onFocus={() => setIdentityFocused(true)}
            onBlur={() => setIdentityFocused(false)}
            placeholder="自定义职业或身份…"
            className={`${inputUnderline} mt-6`}
            onChange={(e) => pushField({ identity: e.target.value })}
          />
        </div>
      </section>

      <hr className="my-10 border-neutral-100" />

      <section aria-labelledby="blk-brief" className="relative">
        <p id="blk-brief" className="mb-5">
          <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-400">The Brief</span>
          <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-neutral-500">角色简述</span>
        </p>
        <div className="relative">
          <button
            type="button"
            disabled={bioGenerating}
            onClick={() => void onAiExpandBrief()}
            title="AI 扩写"
            className="absolute right-1 top-1 z-[1] inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[11px] font-medium text-neutral-800 shadow-[0_2px_8px_rgba(0,0,0,.04)] transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} aria-hidden />
            AI 扩写
          </button>
          <PlaceholderAwareTextarea
            value={displayBio}
            onChange={(v) => {
              setBioTyping(null)
              pushField({ bio: v })
            }}
            characterId={editorId}
            className={`${inputUnderline} min-h-[7.5rem] rounded-none border-neutral-100 pt-12 text-[13px] leading-relaxed`}
            rows={7}
            placeholder="简述ta的性格与背景（详尽设定请移步世界书）…"
          />
          <p className="mt-2 px-1 text-[10px] font-light tracking-wide text-neutral-400">
            失焦时为模型预览句式；占位符会按通讯录规则替换。打字机渲染仅在 AI 扩写完成后演示。
          </p>
        </div>
      </section>

      <AnimatePresence>
        {avatarSheet && (
          <motion.div
            className="fixed inset-0 z-[1250]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="absolute inset-0 bg-black/30" aria-label="关闭" onClick={() => setAvatarSheet(false)} />
            <motion.div
              initial={{ y: '110%' }}
              animate={{ y: 0 }}
              exit={{ y: '110%' }}
              transition={{ type: 'spring', damping: 38, stiffness: 420 }}
              className="absolute inset-x-0 bottom-0 max-h-[50vh] rounded-t-[20px] border-t bg-white px-5 pt-6"
              style={{ borderColor: SHEET_LINES, paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-neutral-300" aria-hidden />
              <p className="text-[15px] font-semibold text-neutral-950">头像来源</p>
              <button
                type="button"
                className="mt-6 flex w-full items-center gap-3 rounded-xl border border-neutral-200 py-4 pl-5 pr-4 text-[14px] text-neutral-800 active:bg-neutral-50"
                onClick={openLocalPicker}
              >
                <ImagePlus className="size-5 shrink-0 text-neutral-500" strokeWidth={1.5} />
                本地上传（相册 / 文件） · Local File
              </button>
              <button
                type="button"
                className="mt-2 flex w-full items-center gap-3 rounded-xl border border-neutral-200 py-4 pl-5 pr-4 text-[14px] text-neutral-800 active:bg-neutral-50"
                onClick={() => {
                  setUrlDialog(true)
                  setAvatarSheet(false)
                }}
              >
                <Link2 className="size-5 shrink-0 text-neutral-500" strokeWidth={1.5} />
                链接提取（图片地址） · URL
              </button>
              {form.avatarUrl?.trim() ? (
                <button
                  type="button"
                  className="mt-2 w-full py-3 text-center text-[12px] font-medium text-neutral-400"
                  onClick={() => {
                    pushField({ avatarUrl: '' })
                    setAvatarSheet(false)
                  }}
                >
                  移除当前头像
                </button>
              ) : null}
              <button
                type="button"
                className="mx-auto mb-6 mt-3 block rounded-full px-5 py-2 text-[13px] text-neutral-400"
                onClick={() => setAvatarSheet(false)}
              >
                取消
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {urlDialog && (
        <div className="fixed inset-0 z-[1260] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-[16px] border border-neutral-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,.08)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-neutral-950">头像链接 · URL</p>
              <button type="button" className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100" onClick={() => setUrlDialog(false)} aria-label="关闭">
                <X className="size-5" strokeWidth={1.5} />
              </button>
            </div>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://…"
              className={`${inputUnderline} mt-5`}
              autoFocus
            />
            <button
              type="button"
              onClick={() => confirmUrlAvatar()}
              className="mt-6 w-full rounded-xl bg-neutral-950 py-3.5 text-[14px] font-medium text-white"
            >
              完成
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {mbtiSheet && (
          <motion.div className="fixed inset-0 z-[1252]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="absolute inset-0 bg-black/35" aria-label="关闭" onClick={() => setMbtiSheet(false)} />
            <motion.div
              initial={{ y: '115%' }}
              animate={{ y: 0 }}
              exit={{ y: '115%' }}
              transition={{ type: 'spring', damping: 36, stiffness: 400 }}
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[22px] border-t border-neutral-200 bg-white px-5 pt-8"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-6 h-1 w-9 rounded-full bg-neutral-300" aria-hidden />
              <p className="text-[15px] font-semibold text-neutral-950">MBTI · 人格类型</p>
              <p className="mt-1 text-[11px] text-neutral-500">十六型人格 · 形象与约二十字人格速写（点击下方卡片选择）</p>
              <div className="mt-5 grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2">
                {MBTI_LIST.map((m) => {
                  const active = form.mbti === m
                  const src = resolveMbtiImageUrl(m)
                  const summary = MBTI_SUMMARY_4[m] ?? ''
                  const big = isLargeMbtiAvatar(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3.5 text-left transition-colors active:opacity-95 ${
                        active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-800'
                      }`}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, mbti: m }))
                        onMbtiSelect(m)
                        setMbtiSheet(false)
                      }}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                        {src ? (
                          <img
                            src={src}
                            alt=""
                            className={`${big ? 'h-12 w-12' : 'h-11 w-11'} border border-neutral-200/80 object-contain`}
                            style={{ borderColor: active ? 'rgba(255,255,255,0.25)' : undefined }}
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <span className="font-mono text-[10px] text-neutral-400">{m}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-mono text-[13px] font-semibold tracking-wide ${active ? 'text-white' : 'text-neutral-950'}`}>{m}</p>
                        <p className={`mt-1 text-[12px] leading-relaxed ${active ? 'text-white/80' : 'text-neutral-600'}`}>{summary}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                className="mx-auto mb-16 mt-4 block px-10 py-3 text-[13px] font-medium text-neutral-400 underline-offset-4 hover:text-neutral-600"
                onClick={() => {
                  setForm((prev) => ({ ...prev, mbti: '' }))
                  onMbtiSelect('')
                  setMbtiSheet(false)
                }}
              >
                清空选择
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPickAvatarFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
    </div>
  )
}
