import type { WorldBook, WorldBookItem, WorldBookPriority } from '../wechat/newFriendsPersona/types'
import {
  deriveMeetWechatSignatureFromPersona,
  ensureMeetHeightCmValue,
  ensureMeetWeightKgValue,
  isMeetProfilePlaceholder,
  rewriteLoveBlocksUserPlaceholder,
  sanitizeLoveBlocksForStaticLore,
  sanitizeMeetCoreMbtiTone,
  type ComprehensivePersona,
} from './comprehensivePersona'
import { MEET_SYNC_WORLD_BOOK_VOLUME_TITLES } from './nineDimensionAccordion'
import { isMeetTruthMirrorWorldBookId } from './meetTruthMirrorWorldbook'

export { isMeetTruthMirrorWorldBookId }
import { rewriteMeetWorldbookNamesToPlaceholders } from './meetWorldbookPlaceholders'

/** 判断是否为「遇见同步」写入的人设世界书分册 id（含旧版单册 meet-wb-{id} 与新版 meet-wb-{id}-vol01 … vol11） */
export function isMeetSyncedWorldBookId(characterId: string, worldBookId: string): boolean {
  const p = `meet-wb-${characterId.trim()}`
  if (worldBookId === p) return true
  if (isMeetTruthMirrorWorldBookId(characterId, worldBookId)) return false
  return worldBookId.startsWith(`${p}-vol`)
}

function esc(s: string): string {
  return String(s ?? '').trim() || '（档案待补全）'
}

function mkItem(
  npcId: string,
  volKey: string,
  index: number,
  name: string,
  rawContent: string,
  nickname: string,
  realName: string,
  now: number,
  opts?: { priority?: WorldBookPriority; enabled?: boolean },
): WorldBookItem {
  const body = rewriteMeetWorldbookNamesToPlaceholders(String(rawContent ?? ''), {
    nickname,
    realName,
  })
  return {
    id: `meet-wb-${npcId}-${volKey}-item${String(index).padStart(2, '0')}`,
    name,
    enabled: opts?.enabled ?? true,
    priority: opts?.priority ?? 'before',
    keywords: `遇见 ${nickname}`,
    content: esc(body),
    updatedAt: now,
    collapsed: false,
  }
}

function mkBook(npcId: string, volKey: string, volLabel: string, items: WorldBookItem[]): WorldBook {
  return {
    id: `meet-wb-${npcId}-${volKey}`,
    name: volLabel,
    enabled: true,
    collapsed: false,
    items,
  }
}

/** 结业后写入人设 vol10 的正文；与 `extractMeetVol10EpiloguePayload` 成对使用 */
export type MeetVol10EpiloguePayload = { itemName: string; content: string }

/** vol10 占位条目固定 id 后缀：与结业后 `item01` 真稿区分，避免 `extractMeetVol10EpiloguePayload` 把占位当已生成尾声 */
const MEET_VOL10_STUB_ITEM_INDEX = 0

/** 匹配时写入的占位正文特征（含 {{char}}/{{user}} 或已展开真名） */
export function isMeetVol10StubPlaceholderContent(content: string): boolean {
  const t = String(content ?? '').trim()
  if (!t) return true
  return (
    (t.includes('结业同步后') && t.includes('初识阶段')) ||
    t.includes('未完成结业前本条目关闭注入')
  )
}

/** 是否已有 AI 结业初印象（非占位稿） */
export function hasMeetVol10GraduatedEpilogue(characterId: string, worldBooks: WorldBook[]): boolean {
  const ep = extractMeetVol10EpiloguePayload(characterId, worldBooks)
  if (!ep?.content?.trim()) return false
  return !isMeetVol10StubPlaceholderContent(ep.content)
}

function buildVol10Items(
  npcId: string,
  nickname: string,
  realName: string,
  now: number,
  epilogue: MeetVol10EpiloguePayload | null,
): WorldBookItem[] {
  if (epilogue && String(epilogue.content ?? '').trim()) {
    return [
      mkItem(npcId, 'vol10', 1, epilogue.itemName, epilogue.content, nickname, realName, now, {
        priority: 'after',
        enabled: true,
      }),
    ]
  }
  return [
    mkItem(
      npcId,
      'vol10',
      MEET_VOL10_STUB_ITEM_INDEX,
      '对 {{user}} 的当前态度',
      `{{char}}与{{user}}在「遇见」临时会话中的互动尚处初识阶段：交流以礼貌与试探为主，信任与亲近度未定型。结业同步后，本条将据会话纪要更新为与档案法则一致的收束摘要（仍为第三人称，含 {{char}} / {{user}}）。`,
      nickname,
      realName,
      now,
      { priority: 'after', enabled: true },
    ),
  ]
}

/** 单独第十册（无九维时的 fallback 与结业补丁共用） */
export function buildMeetVol10WorldBook(
  npcId: string,
  nickname: string,
  realName: string,
  now: number,
  epilogue: MeetVol10EpiloguePayload | null,
): WorldBook {
  const meta = MEET_SYNC_WORLD_BOOK_VOLUME_TITLES.find((m) => m.volKey === 'vol10')
  const bookTitle = meta?.bookTitle ?? '10 ATTITUDE | 尾声延展'
  return mkBook(npcId, 'vol10', bookTitle, buildVol10Items(npcId, nickname, realName, now, epilogue))
}

export function getMeetVol10WorldBookId(characterId: string): string {
  return `meet-wb-${characterId.trim()}-vol10`
}

export type MeetVol10Preview = {
  content: string
  itemName: string
  /** 已结业并写入 AI 初印象真稿（非匹配时的占位条目） */
  isGraduatedEpilogue: boolean
}

/** 遇见世界书预览：读取 vol10 正文（占位或结业初印象） */
export function readMeetVol10PreviewFromCharacterWorldBooks(
  worldBooks: WorldBook[] | undefined,
  characterId: string,
): MeetVol10Preview {
  const books = worldBooks ?? []
  const epilogue = extractMeetVol10EpiloguePayload(characterId, books)
  if (epilogue && hasMeetVol10GraduatedEpilogue(characterId, books)) {
    return {
      content: epilogue.content.trim(),
      itemName: epilogue.itemName,
      isGraduatedEpilogue: true,
    }
  }
  const wb = books.find((w) => w.id === getMeetVol10WorldBookId(characterId))
  const stubItem =
    wb?.items?.find((i) => i.id.endsWith(`-item${String(MEET_VOL10_STUB_ITEM_INDEX).padStart(2, '0')}`)) ??
    wb?.items?.[0]
  return {
    content: String(stubItem?.content ?? '').trim(),
    itemName: String(stubItem?.name ?? '').trim() || '对 {{user}} 的当前态度',
    isGraduatedEpilogue: false,
  }
}

/** 从现有人设 worldBooks 取出已启用的结业态度稿，供重新同步九维时合并，避免覆盖尾声延展 */
export function extractMeetVol10EpiloguePayload(characterId: string, worldBooks: WorldBook[]): MeetVol10EpiloguePayload | null {
  const wb = worldBooks.find((w) => w.id === getMeetVol10WorldBookId(characterId))
  if (!wb?.items?.length) return null
  const it = wb.items.find((i) => {
    if (i.priority !== 'after' || !i.enabled || !String(i.content ?? '').trim()) return false
    if (i.id.endsWith(`-item${String(MEET_VOL10_STUB_ITEM_INDEX).padStart(2, '0')}`)) return false
    const raw = String(i.content).trim()
    if (isMeetVol10StubPlaceholderContent(raw)) return false
    return true
  })
  if (!it) return null
  const itemName = String(it.name || '').trim() || '对 {{user}} 的当前态度'
  return { itemName, content: String(it.content) }
}

/**
 * 将遇见九维人设拆成 **10 个世界书分册**（vol01–vol09 为序言介入；vol10 为尾声延展、对用户的当前态度位）。
 * 同步通讯录时写入人设库；条目正文为纯文本/Markdown 小段，便于模型分块注入。
 */
export function buildMeetNineDimensionWorldBooks(
  npcId: string,
  nickname: string,
  persona: ComprehensivePersona,
  now: number,
  preservedEpilogue: MeetVol10EpiloguePayload | null = null,
): WorldBook[] {
  const p = sanitizeLoveBlocksForStaticLore(persona)
  const b = p.base
  const rn = String(b.realName ?? '').trim()
  const wNum = ensureMeetWeightKgValue(b.weightKg, npcId)
  const hNum = ensureMeetHeightCmValue(b.heightCm, npcId)
  const weightLine = `${wNum} kg`
  const heightLine = `${hNum} cm`
  const sigRaw = isMeetProfilePlaceholder(b.wechatSignature) ? deriveMeetWechatSignatureFromPersona(p) : b.wechatSignature.trim()

  const vol01: WorldBookItem[] = [
    mkItem(
      npcId,
      'vol01',
      1,
      '身份与生辰',
      `真实姓名：{{char}}\n身高：${heightLine}\n生日：${esc(b.birthdayMD)}\n星座：${esc(b.zodiac)}\n体重：${weightLine}`,
      nickname,
      rn,
      now,
    ),
    mkItem(npcId, 'vol01', 2, '微信个性签名', sigRaw, nickname, rn, now),
    mkItem(npcId, 'vol01', 3, '档案叙述', b.info, nickname, rn, now),
    mkItem(npcId, 'vol01', 4, '生理与形象', b.physiology, nickname, rn, now),
  ]

  const c = p.core
  const vol02: WorldBookItem[] = [
    mkItem(npcId, 'vol02', 1, 'MBTI 倾向', sanitizeMeetCoreMbtiTone(c.mbti), nickname, rn, now),
    mkItem(npcId, 'vol02', 2, '外显人格', c.surface, nickname, rn, now),
    mkItem(npcId, 'vol02', 3, '内在自我', c.trueSelf, nickname, rn, now),
    mkItem(npcId, 'vol02', 4, '三观与底线', c.values, nickname, rn, now),
    mkItem(npcId, 'vol02', 5, '缺陷与雷点', c.flaws, nickname, rn, now),
  ]

  const ps = p.psyche
  const vol03: WorldBookItem[] = [
    mkItem(npcId, 'vol03', 1, '成长与经历', ps.background, nickname, rn, now),
    mkItem(npcId, 'vol03', 2, '阴影与心结', ps.shadow, nickname, rn, now),
    mkItem(npcId, 'vol03', 3, '情绪模式', ps.emotionalPattern, nickname, rn, now),
    mkItem(npcId, 'vol03', 4, '性取向由来', ps.orientationOrigin, nickname, rn, now),
  ]

  const ab = p.abilities
  const vol04: WorldBookItem[] = [
    mkItem(npcId, 'vol04', 1, '技能与天赋', ab.skills, nickname, rn, now),
    mkItem(npcId, 'vol04', 2, '爱好', ab.hobbies, nickname, rn, now),
    mkItem(npcId, 'vol04', 3, '社交分寸', ab.socialMode, nickname, rn, now),
  ]

  const f = p.fetish
  const vol05: WorldBookItem[] = [
    mkItem(npcId, 'vol05', 1, '亲密偏好', rewriteLoveBlocksUserPlaceholder(f.preference), nickname, rn, now),
    mkItem(npcId, 'vol05', 2, '感官', rewriteLoveBlocksUserPlaceholder(f.sensory), nickname, rn, now),
    mkItem(npcId, 'vol05', 3, '关系动态', rewriteLoveBlocksUserPlaceholder(f.dynamic), nickname, rn, now),
    mkItem(npcId, 'vol05', 4, '吃醋与占有欲', rewriteLoveBlocksUserPlaceholder(f.jealousy), nickname, rn, now),
  ]

  const r = p.relations
  const vol06: WorldBookItem[] = [
    mkItem(npcId, 'vol06', 1, '家庭', r.family, nickname, rn, now),
    mkItem(npcId, 'vol06', 2, '友人', r.friends, nickname, rn, now),
    mkItem(npcId, 'vol06', 3, '对立与记仇', r.enemies, nickname, rn, now),
  ]

  const ct = p.contrast
  const vol07: WorldBookItem[] = [
    mkItem(npcId, 'vol07', 1, '恋爱前', rewriteLoveBlocksUserPlaceholder(ct.beforeLove), nickname, rn, now),
    mkItem(npcId, 'vol07', 2, '恋爱后', rewriteLoveBlocksUserPlaceholder(ct.afterLove), nickname, rn, now),
    mkItem(npcId, 'vol07', 3, '冲突与和好', rewriteLoveBlocksUserPlaceholder(ct.conflict), nickname, rn, now),
  ]

  const d = p.daily
  const vol08: WorldBookItem[] = [
    mkItem(npcId, 'vol08', 1, '口吻与口头禅', d.speech, nickname, rn, now),
    mkItem(npcId, 'vol08', 2, '习惯与洁癖', d.habits, nickname, rn, now),
    mkItem(npcId, 'vol08', 3, '消费观', d.money, nickname, rn, now),
    mkItem(npcId, 'vol08', 4, '仪式感与怪癖', d.quirks, nickname, rn, now),
  ]

  const a = p.arc
  const vol09: WorldBookItem[] = [
    mkItem(npcId, 'vol09', 1, '伪装与秘密', a.secrets, nickname, rn, now),
    mkItem(npcId, 'vol09', 2, '动机与恐惧', a.goal, nickname, rn, now),
    mkItem(npcId, 'vol09', 3, '反差萌', a.contrastMoe, nickname, rn, now),
  ]

  const vol10: WorldBookItem[] = buildVol10Items(npcId, nickname, rn, now, preservedEpilogue)

  const byVol: Record<string, WorldBookItem[]> = {
    vol01: vol01,
    vol02: vol02,
    vol03: vol03,
    vol04: vol04,
    vol05: vol05,
    vol06: vol06,
    vol07: vol07,
    vol08: vol08,
    vol09: vol09,
    vol10: vol10,
  }

  /** vol11/vol12 由遇见专用逻辑单独写入；此处若生成空壳会与真稿重复 id，导致编辑页双份且条目无法点开 */
  return MEET_SYNC_WORLD_BOOK_VOLUME_TITLES.filter(
    (meta) => meta.volKey !== 'vol11' && meta.volKey !== 'vol12',
  ).map((meta) => mkBook(npcId, meta.volKey, meta.bookTitle, byVol[meta.volKey] ?? []))
}

/** 无九维时：单册单条，避免 worldBooks 为空 */
export function buildMeetPersonaFallbackWorldBook(npcId: string, nickname: string, personaText: string, now: number): WorldBook[] {
  const item = mkItem(npcId, 'vol00', 1, '遇见 · 简介', personaText, nickname, '', now)
  return [mkBook(npcId, 'vol00', `遇见 · 简介 · ${nickname}`, [item])]
}
