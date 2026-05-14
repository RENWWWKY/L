/**
 * 遇见 · 九维正文中的 {{char}} / {{user}}：仅供 UI 预览展开；持久化与世界书注入保持占位符原文。
 */

import { expandCharUserPlaceholders, type CharUserNames } from '../wechat/charUserPlaceholders'
import type { ComprehensivePersona } from './comprehensivePersona'
import {
  deriveMeetMottoFromPersona,
  deriveMeetOccupationLabel,
  ensureMeetHeightCmValue,
  ensureMeetWeightKgValue,
  formatMeetMbtiLettersForUi,
  isMeetProfilePlaceholder,
  sanitizeLoveBlocksForStaticLore,
} from './comprehensivePersona'
import type { EncounterNPC, MeetPublicProfile } from './meetTypes'

export function resolveMeetCharUserNames(charNickname: string, profile: MeetPublicProfile): CharUserNames {
  const charName = String(charNickname ?? '').trim() || '对方'
  const userName = String(profile.displayName ?? '').trim() || '用户'
  return { charName, userName }
}

export function expandMeetPersonaPlaintext(text: string, charNickname: string, profile: MeetPublicProfile): string {
  return expandCharUserPlaceholders(text, resolveMeetCharUserNames(charNickname, profile))
}

export function expandComprehensivePersonaPlaceholders(
  p: ComprehensivePersona,
  names: CharUserNames | null,
): ComprehensivePersona {
  const p0 = sanitizeLoveBlocksForStaticLore(p)
  if (!names) return p0
  const ex = (s: string) => expandCharUserPlaceholders(s, names)
  return {
    base: {
      info: ex(p0.base.info),
      physiology: ex(p0.base.physiology),
      realName: ex(p0.base.realName),
      birthdayMD: ex(p0.base.birthdayMD),
      weightKg: ex(p0.base.weightKg),
      heightCm: ex(p0.base.heightCm),
      zodiac: ex(p0.base.zodiac),
      wechatSignature: ex(p0.base.wechatSignature),
    },
    core: {
      mbti: ex(p0.core.mbti),
      surface: ex(p0.core.surface),
      trueSelf: ex(p0.core.trueSelf),
      values: ex(p0.core.values),
      flaws: ex(p0.core.flaws),
    },
    psyche: {
      background: ex(p0.psyche.background),
      shadow: ex(p0.psyche.shadow),
      emotionalPattern: ex(p0.psyche.emotionalPattern),
      orientationOrigin: ex(p0.psyche.orientationOrigin),
    },
    abilities: {
      skills: ex(p0.abilities.skills),
      hobbies: ex(p0.abilities.hobbies),
      socialMode: ex(p0.abilities.socialMode),
    },
    fetish: {
      preference: ex(p0.fetish.preference),
      sensory: ex(p0.fetish.sensory),
      dynamic: ex(p0.fetish.dynamic),
      jealousy: ex(p0.fetish.jealousy),
    },
    relations: {
      family: ex(p0.relations.family),
      friends: ex(p0.relations.friends),
      enemies: ex(p0.relations.enemies),
    },
    contrast: {
      beforeLove: ex(p0.contrast.beforeLove),
      afterLove: ex(p0.contrast.afterLove),
      conflict: ex(p0.contrast.conflict),
    },
    daily: {
      speech: ex(p0.daily.speech),
      habits: ex(p0.daily.habits),
      money: ex(p0.daily.money),
      quirks: ex(p0.daily.quirks),
    },
    arc: {
      secrets: ex(p0.arc.secrets),
      goal: ex(p0.arc.goal),
      contrastMoe: ex(p0.arc.contrastMoe),
    },
  }
}

/** 供匹配裁判 / 聊天模型使用；不传 expandNames 时保留 {{char}}/{{user}}（写入人设库 / 微信侧再解析） */
export function buildMeetNpcDigestForModel(
  npc: EncounterNPC,
  expandNames?: CharUserNames | null,
): string {
  if (!npc.comprehensivePersona) {
    const raw = `${npc.nickname}｜${npc.persona}`
    const body = expandNames ? expandCharUserPlaceholders(raw, expandNames) : raw
    return body.slice(0, 2000)
  }
  const c = expandComprehensivePersonaPlaceholders(npc.comprehensivePersona, expandNames ?? null)
  const seedV = `${npc.id}\x1evitals`
  const hCm = ensureMeetHeightCmValue(c.base.heightCm, seedV)
  const wKg = ensureMeetWeightKgValue(c.base.weightKg, seedV)
  const occ = npc.occupation?.trim() || deriveMeetOccupationLabel(c.abilities.skills)
  const mot = npc.motto?.trim() || deriveMeetMottoFromPersona(c)
  const mbtiLetters = npc.mbti?.trim() || formatMeetMbtiLettersForUi(c.core.mbti)
  const parts = [
    `【基础档案】姓名 ${c.base.realName}｜身高 ${hCm} cm｜体重 ${wKg} kg｜生日 ${c.base.birthdayMD}｜星座 ${c.base.zodiac}｜MBTI ${mbtiLetters}｜职业 ${occ}｜座右铭 ${mot}｜个签 ${c.base.wechatSignature}`,
    `【基础】${c.base.info}`,
    `【外显/内核】${c.core.surface} / ${c.core.trueSelf}`,
    `【雷点缺陷】${c.core.flaws}`,
    `【情绪模式】${c.psyche.emotionalPattern}`,
    `【性取向由来】${c.psyche.orientationOrigin}`,
    `【关系】${c.relations.friends}；对立：${c.relations.enemies}`,
    `【恋爱反差】前：${c.contrast.beforeLove}；后：${c.contrast.afterLove}`,
    `【占有欲/吃醋】${c.fetish.jealousy}`,
    `【日常口吻】${c.daily.speech}`,
  ]
  const raw = `${npc.nickname}｜${parts.join('\n')}`
  return raw.slice(0, 3500)
}

/** 月日 MM-DD → 「m 月 d 日」展示 */
export function formatMeetBirthdayDisplayZh(md: string | undefined): string | null {
  const t = String(md ?? '').trim()
  if (!/^\d{2}-\d{2}$/.test(t)) return null
  const m = Number(t.slice(0, 2))
  const d = Number(t.slice(3, 5))
  if (!Number.isFinite(m) || !Number.isFinite(d)) return null
  return `${m} 月 ${d} 日`
}

/** 卡片副标题：年龄 · 星座 · 生日 · 身高 · 体重（不含真实姓名） */
export function buildMeetNpcVitalsSubtitle(npc: EncounterNPC): string | null {
  const b = npc.comprehensivePersona?.base
  const age = npc.ageYears
  const zod = npc.zodiac ?? b?.zodiac
  const md = npc.birthdayMD ?? b?.birthdayMD
  const w = npc.weightKg ?? b?.weightKg
  const parts: string[] = []
  if (age != null && age > 0) parts.push(`${age} 岁`)
  if (zod && !isMeetProfilePlaceholder(zod)) parts.push(zod)
  const bd = md && !isMeetProfilePlaceholder(md) ? formatMeetBirthdayDisplayZh(md) : null
  if (bd) parts.push(bd)
  if (b) {
    const hDisp = ensureMeetHeightCmValue(String(npc.heightCm ?? b.heightCm ?? ''), npc.id)
    parts.push(`${hDisp} cm`)
  } else if (npc.heightCm && !isMeetProfilePlaceholder(npc.heightCm)) {
    parts.push(`${npc.heightCm} cm`)
  }
  if (w && !isMeetProfilePlaceholder(w)) parts.push(`${w} kg`)
  return parts.length ? parts.join(' · ') : null
}
