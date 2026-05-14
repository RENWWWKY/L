import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  deriveMeetWechatSignatureFromPersona,
  ensureMeetHeightCmValue,
  ensureMeetWeightKgValue,
  formatMeetMbtiLettersForUi,
  isMeetProfilePlaceholder,
  type ComprehensivePersona,
} from './comprehensivePersona'

const PLATINUM = '#D4AF37'

/**
 * 写入人设库时各分册的 `WorldBook.name`（vol01–vol10），须与遇见「世界书预览」及 `NineDimensionAccordion` 标题一致（图2：`01 BASE | 基础核心设定`）。
 */
export const MEET_SYNC_WORLD_BOOK_VOLUME_TITLES: readonly { volKey: `vol${string}`; bookTitle: string }[] = [
  { volKey: 'vol01', bookTitle: '01 BASE | 基础核心设定' },
  { volKey: 'vol02', bookTitle: '02 CORE | 人格内核' },
  { volKey: 'vol03', bookTitle: '03 PSYCHE | 心理与情感' },
  { volKey: 'vol04', bookTitle: '04 ABILITIES | 能力与偏好' },
  { volKey: 'vol05', bookTitle: '05 DESIRE | 欲念与底线' },
  { volKey: 'vol06', bookTitle: '06 SOCIAL | 人际法则' },
  { volKey: 'vol07', bookTitle: '07 CONTRAST | 恋爱镜像反差' },
  { volKey: 'vol08', bookTitle: '08 DETAILS | 日常侧写' },
  { volKey: 'vol09', bookTitle: '09 ARC | 隐藏弧光' },
  /** 人设库内独立分册：条目 priority=after，与微信「人设 · 世界书」尾声延展分栏同源 */
  { volKey: 'vol10', bookTitle: '10 ATTITUDE | 尾声延展 · 对用户的当前态度' },
] as const

type FieldRowProps = { labelEn: string; labelZh: string; body: ReactNode }

export function NineDimensionFieldRow({ labelEn, labelZh, body }: FieldRowProps) {
  return (
    <div className="border-b border-black/[0.04] py-3 last:border-b-0">
      <p className="meet-caption-en text-[9px] uppercase tracking-[0.22em] text-[#a8a4a0]">
        {labelEn} <span className="font-normal tracking-normal text-[#8c8883]">{labelZh}</span>
      </p>
      <div className="font-dossier-serif mt-1.5 text-[14px] leading-loose text-[#2c2a26]">{body}</div>
    </div>
  )
}

type SectionDef = {
  id: string
  num: string
  titleEn: string
  titleZh: string
  content: ReactNode
}

export function buildNineDimensionSections(dossier: ComprehensivePersona): SectionDef[] {
  return [
    {
      id: '01-base',
      num: '01',
      titleEn: 'BASE',
      titleZh: '基础核心设定',
      content: (
        <>
          <NineDimensionFieldRow labelEn="REAL NAME" labelZh="真实姓名" body={dossier.base.realName} />
          <NineDimensionFieldRow
            labelEn="WECHAT SIGNATURE"
            labelZh="微信个性签名"
            body={
              isMeetProfilePlaceholder(dossier.base.wechatSignature)
                ? deriveMeetWechatSignatureFromPersona(dossier)
                : dossier.base.wechatSignature
            }
          />
          <NineDimensionFieldRow labelEn="BIRTHDAY" labelZh="生日" body={dossier.base.birthdayMD} />
          <NineDimensionFieldRow labelEn="ZODIAC" labelZh="星座" body={dossier.base.zodiac} />
          <NineDimensionFieldRow
            labelEn="HEIGHT"
            labelZh="身高"
            body={
              isMeetProfilePlaceholder(dossier.base.heightCm)
                ? `${ensureMeetHeightCmValue(
                    dossier.base.heightCm,
                    `${dossier.base.realName}\x1e${dossier.base.birthdayMD}`,
                  )} cm`
                : `${dossier.base.heightCm} cm`
            }
          />
          <NineDimensionFieldRow
            labelEn="WEIGHT"
            labelZh="体重"
            body={
              isMeetProfilePlaceholder(dossier.base.weightKg)
                ? `${ensureMeetWeightKgValue(
                    dossier.base.weightKg,
                    `${dossier.base.realName}\x1e${dossier.base.birthdayMD}`,
                  )} kg`
                : `${dossier.base.weightKg} kg`
            }
          />
          <NineDimensionFieldRow labelEn="PROFILE" labelZh="身份与气质" body={dossier.base.info} />
          <NineDimensionFieldRow labelEn="PHYSIOLOGY" labelZh="体征与动作" body={dossier.base.physiology} />
        </>
      ),
    },
    {
      id: '02-core',
      num: '02',
      titleEn: 'CORE',
      titleZh: '人格内核',
      content: (
        <>
          <NineDimensionFieldRow
            labelEn="MBTI"
            labelZh="类型"
            body={<span className="font-mono text-[15px] font-medium tracking-[0.14em]">{formatMeetMbtiLettersForUi(dossier.core.mbti)}</span>}
          />
          <NineDimensionFieldRow labelEn="SURFACE" labelZh="外显" body={dossier.core.surface} />
          <NineDimensionFieldRow labelEn="TRUE SELF" labelZh="内核" body={dossier.core.trueSelf} />
          <NineDimensionFieldRow labelEn="VALUES" labelZh="三观与底线" body={dossier.core.values} />
          <NineDimensionFieldRow labelEn="FLAWS" labelZh="缺陷与雷点" body={dossier.core.flaws} />
        </>
      ),
    },
    {
      id: '03-psyche',
      num: '03',
      titleEn: 'PSYCHE',
      titleZh: '心理与情感',
      content: (
        <>
          <NineDimensionFieldRow labelEn="BACKGROUND" labelZh="成长与经历" body={dossier.psyche.background} />
          <NineDimensionFieldRow labelEn="SHADOW" labelZh="阴影" body={dossier.psyche.shadow} />
          <NineDimensionFieldRow
            labelEn="EMOTIONAL PATTERN"
            labelZh="情绪模式"
            body={dossier.psyche.emotionalPattern}
          />
          <NineDimensionFieldRow
            labelEn="ORIENTATION ORIGIN"
            labelZh="性取向由来"
            body={dossier.psyche.orientationOrigin}
          />
        </>
      ),
    },
    {
      id: '04-abilities',
      num: '04',
      titleEn: 'ABILITIES',
      titleZh: '能力与偏好',
      content: (
        <>
          <NineDimensionFieldRow labelEn="SKILLS" labelZh="技能" body={dossier.abilities.skills} />
          <NineDimensionFieldRow labelEn="HOBBIES" labelZh="爱好" body={dossier.abilities.hobbies} />
          <NineDimensionFieldRow labelEn="SOCIAL MODE" labelZh="社交分寸" body={dossier.abilities.socialMode} />
        </>
      ),
    },
    {
      id: '05-desire',
      num: '05',
      titleEn: 'DESIRE',
      titleZh: '欲念与底线',
      content: (
        <>
          <NineDimensionFieldRow labelEn="PREFERENCE" labelZh="亲密偏好" body={dossier.fetish.preference} />
          <NineDimensionFieldRow labelEn="SENSORY" labelZh="感官" body={dossier.fetish.sensory} />
          <NineDimensionFieldRow labelEn="DYNAMIC" labelZh="关系动态" body={dossier.fetish.dynamic} />
          <NineDimensionFieldRow labelEn="JEALOUSY" labelZh="吃醋与占有欲" body={dossier.fetish.jealousy} />
        </>
      ),
    },
    {
      id: '06-social',
      num: '06',
      titleEn: 'SOCIAL',
      titleZh: '人际法则',
      content: (
        <>
          <NineDimensionFieldRow labelEn="FAMILY" labelZh="家庭" body={dossier.relations.family} />
          <NineDimensionFieldRow labelEn="FRIENDS" labelZh="友人" body={dossier.relations.friends} />
          <NineDimensionFieldRow labelEn="ENEMIES" labelZh="对立与记仇" body={dossier.relations.enemies} />
        </>
      ),
    },
    {
      id: '07-contrast',
      num: '07',
      titleEn: 'CONTRAST',
      titleZh: '恋爱镜像反差',
      content: (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-[12px] border border-black/[0.06] bg-[#fafaf9] p-4">
            <p className="meet-caption-en text-[9px] uppercase tracking-[0.28em] text-[#a8a4a0]">Before</p>
            <p className="meet-caption-en mt-1 text-[10px] tracking-[0.2em] text-[#b8a994]">恋爱前</p>
            <p className="font-dossier-serif mt-3 text-[14px] leading-loose text-[#2c2a26]">
              {dossier.contrast.beforeLove}
            </p>
          </div>
          <div
            className="rounded-[12px] border p-4"
            style={{ borderColor: `${PLATINUM}55`, background: 'rgba(212, 175, 55, 0.04)' }}
          >
            <p className="meet-caption-en text-[9px] uppercase tracking-[0.28em]" style={{ color: PLATINUM }}>
              After
            </p>
            <p className="meet-caption-en mt-1 text-[10px] tracking-[0.2em] text-[#b8a994]">恋爱后</p>
            <p className="font-dossier-serif mt-3 text-[14px] leading-loose text-[#2c2a26]">
              {dossier.contrast.afterLove}
            </p>
          </div>
          <div className="sm:col-span-2">
            <NineDimensionFieldRow
              labelEn="CONFLICT & REPAIR"
              labelZh="冲突与和好"
              body={dossier.contrast.conflict}
            />
          </div>
        </div>
      ),
    },
    {
      id: '08-details',
      num: '08',
      titleEn: 'DETAILS',
      titleZh: '日常侧写',
      content: (
        <>
          <NineDimensionFieldRow labelEn="SPEECH" labelZh="口吻" body={dossier.daily.speech} />
          <NineDimensionFieldRow labelEn="HABITS" labelZh="习惯" body={dossier.daily.habits} />
          <NineDimensionFieldRow labelEn="MONEY" labelZh="消费观" body={dossier.daily.money} />
          <NineDimensionFieldRow labelEn="QUIRKS" labelZh="仪式感" body={dossier.daily.quirks} />
        </>
      ),
    },
    {
      id: '09-arc',
      num: '09',
      titleEn: 'ARC',
      titleZh: '隐藏弧光',
      content: (
        <>
          <NineDimensionFieldRow labelEn="SECRETS" labelZh="伪装与秘密" body={dossier.arc.secrets} />
          <NineDimensionFieldRow labelEn="GOAL" labelZh="动机与恐惧" body={dossier.arc.goal} />
          <NineDimensionFieldRow labelEn="CONTRAST MOE" labelZh="反差萌" body={dossier.arc.contrastMoe} />
        </>
      ),
    },
  ]
}

export function NineDimensionAccordion({
  dossier,
  initialOpenId = '01-base',
}: {
  dossier: ComprehensivePersona
  initialOpenId?: string
}) {
  const [activeId, setActiveId] = useState<string>(initialOpenId)
  const toggle = useCallback((id: string) => {
    setActiveId((prev) => (prev === id ? '' : id))
  }, [])
  const sections = useMemo(() => buildNineDimensionSections(dossier), [dossier])

  return (
    <div className="mx-auto w-full max-w-lg space-y-2">
      {sections.map((sec) => {
        const isOpen = activeId === sec.id
        return (
          <div
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
              </span>
              <span className="meet-caption-en shrink-0 text-[9px] text-[#c9c5be]">{isOpen ? '−' : '+'}</span>
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
                  <div className="px-4 py-2">{sec.content}</div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
