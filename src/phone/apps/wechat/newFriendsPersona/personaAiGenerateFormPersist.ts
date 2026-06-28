import { personaDb } from './idb'
import {
  emptyPersonaAiGenerateForm,
  type PersonaAiGenerateForm,
} from './personaAiGenerateTypes'
import type { Gender } from './types'

export const PERSONA_AI_GENERATE_FORM_KV_PREFIX = 'persona-ai-generate-form-v1'

export type PersonaAiGenerateFormDraftRecord = {
  form: PersonaAiGenerateForm
  savedAt: number
}

export function buildPersonaAiGenerateFormPersistKey(
  wechatAccountId: string | null | undefined,
  playerIdentityId: string,
): string {
  const acc = wechatAccountId?.trim() || '_default'
  const pid = playerIdentityId.trim()
  return `${PERSONA_AI_GENERATE_FORM_KV_PREFIX}::${acc}::${pid}`
}

const GENDERS: Gender[] = ['female', 'male', 'other']

export function normalizePersonaAiGenerateForm(raw: unknown): PersonaAiGenerateForm | null {
  if (!raw || typeof raw !== 'object') return null
  const src = (raw as Record<string, unknown>).form ?? raw
  if (!src || typeof src !== 'object') return null
  const o = src as Record<string, unknown>
  const base = emptyPersonaAiGenerateForm()
  const gender = GENDERS.includes(o.gender as Gender) ? (o.gender as Gender) : base.gender
  type StringField = {
    [K in keyof PersonaAiGenerateForm]: PersonaAiGenerateForm[K] extends string ? K : never
  }[keyof PersonaAiGenerateForm]
  const pickStr = (k: StringField): string =>
    typeof o[k] === 'string' ? String(o[k]) : base[k]
  return {
    nameHint: pickStr('nameHint'),
    avatarUrl: pickStr('avatarUrl'),
    gender,
    ageHint: pickStr('ageHint'),
    occupationHint: pickStr('occupationHint'),
    appearanceHint: pickStr('appearanceHint'),
    mbtiHint: pickStr('mbtiHint'),
    personalityKeywords: pickStr('personalityKeywords'),
    socialMaskHint: pickStr('socialMaskHint'),
    backgroundHint: pickStr('backgroundHint'),
    hobbiesHint: pickStr('hobbiesHint'),
    lifeHabitsHint: pickStr('lifeHabitsHint'),
    relationToUser: pickStr('relationToUser'),
    relationDetailHint: pickStr('relationDetailHint'),
    relationshipHistoryHint: pickStr('relationshipHistoryHint'),
    loveAttitudeHint: pickStr('loveAttitudeHint'),
    loveContrastHint: pickStr('loveContrastHint'),
    speechStyleHint: pickStr('speechStyleHint'),
    orientationHint: pickStr('orientationHint'),
    orientationMutable: !!o.orientationMutable,
    nsfwEnabled: !!o.nsfwEnabled,
    nsfwHint: pickStr('nsfwHint'),
    extraNotes: pickStr('extraNotes'),
  }
}

export function shouldPersistPersonaAiGenerateForm(form: PersonaAiGenerateForm): boolean {
  const base = emptyPersonaAiGenerateForm()
  return (Object.keys(base) as (keyof PersonaAiGenerateForm)[]).some((k) => form[k] !== base[k])
}

export async function loadPersonaAiGenerateFormDraft(
  wechatAccountId: string | null | undefined,
  playerIdentityId: string,
): Promise<PersonaAiGenerateFormDraftRecord | null> {
  const pid = playerIdentityId.trim()
  if (!pid) return null
  const key = buildPersonaAiGenerateFormPersistKey(wechatAccountId, pid)
  const raw = await personaDb.getPhoneKv(key)
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const form = normalizePersonaAiGenerateForm(rec)
  if (!form) return null
  const savedAt =
    typeof rec.savedAt === 'number' && Number.isFinite(rec.savedAt) ? rec.savedAt : Date.now()
  return { form, savedAt }
}

export async function savePersonaAiGenerateFormDraft(
  wechatAccountId: string | null | undefined,
  playerIdentityId: string,
  form: PersonaAiGenerateForm,
): Promise<number> {
  const pid = playerIdentityId.trim()
  if (!pid) throw new Error('缺少玩家身份')
  const key = buildPersonaAiGenerateFormPersistKey(wechatAccountId, pid)
  const savedAt = Date.now()
  const record: PersonaAiGenerateFormDraftRecord = { form, savedAt }
  await personaDb.setPhoneKv(key, record)
  return savedAt
}

export async function clearPersonaAiGenerateFormDraft(
  wechatAccountId: string | null | undefined,
  playerIdentityId: string,
): Promise<void> {
  const pid = playerIdentityId.trim()
  if (!pid) return
  const key = buildPersonaAiGenerateFormPersistKey(wechatAccountId, pid)
  await personaDb.deletePhoneKv(key)
}
