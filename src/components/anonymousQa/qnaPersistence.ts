import { personaDb, pullPhoneKvWithLocalStorageLegacy } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { Question } from './types'
import type { QnADirectedPost } from './qnaStoreTypes'

/** IndexedDB `phoneKv` 键（与微信数据同库 `personaDb`） */
export const WECHAT_ANONYMOUS_QNA_MAIN_KV_KEY = 'wechat-anonymous-qna-v2'
export const WECHAT_ANONYMOUS_QNA_DIRECTED_KV_KEY = 'wechat-anonymous-qna-directed-posts-v1'

/** 旧版 localStorage 键（首次读取时自动迁入 IDB 并删除） */
export const LEGACY_ANONYMOUS_QNA_MAIN_LS_KEY = 'anonymous-qna-v2'
export const LEGACY_ANONYMOUS_QNA_DIRECTED_LS_KEY = 'anonymous-qna-directed-posts-v1'

export type QnaMainPersisted = {
  questions: Question[]
  listByTab: Record<string, string[]>
}

/** 旧版 mockData.ts 中的示例帖 id（载入时剔除，避免 IDB 里残留假数据） */
export const LEGACY_MOCK_QNA_QUESTION_IDS = new Set(['q-1', 'q-2', 'q-directed-1'])

export function filterLegacyMockQnaState(data: QnaMainPersisted): QnaMainPersisted {
  const questions = data.questions.filter((q) => !LEGACY_MOCK_QNA_QUESTION_IDS.has(q.id))
  const allowed = new Set(questions.map((q) => q.id))
  const listByTab: Record<string, string[]> = {}
  for (const [tab, ids] of Object.entries(data.listByTab ?? {})) {
    listByTab[tab] = (ids ?? []).filter((id) => allowed.has(id) && !LEGACY_MOCK_QNA_QUESTION_IDS.has(id))
  }
  return { questions, listByTab }
}

function normalizeMain(raw: unknown): QnaMainPersisted | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.questions)) return null
  const listByTab =
    o.listByTab && typeof o.listByTab === 'object' && !Array.isArray(o.listByTab)
      ? (o.listByTab as Record<string, string[]>)
      : {}
  return { questions: o.questions as Question[], listByTab }
}

function normalizeDirected(raw: unknown): Record<string, QnADirectedPost> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as { posts?: Record<string, QnADirectedPost> }
  if (o.posts && typeof o.posts === 'object' && !Array.isArray(o.posts)) return { ...o.posts }
  return {}
}

export async function loadQnaMainState(): Promise<QnaMainPersisted | null> {
  const raw = await pullPhoneKvWithLocalStorageLegacy(WECHAT_ANONYMOUS_QNA_MAIN_KV_KEY, [
    LEGACY_ANONYMOUS_QNA_MAIN_LS_KEY,
  ])
  return normalizeMain(raw)
}

export async function saveQnaMainState(data: QnaMainPersisted): Promise<void> {
  await personaDb.setPhoneKv(WECHAT_ANONYMOUS_QNA_MAIN_KV_KEY, {
    questions: data.questions,
    listByTab: data.listByTab,
  })
}

export async function deleteQnaMainState(): Promise<void> {
  await personaDb.deletePhoneKv(WECHAT_ANONYMOUS_QNA_MAIN_KV_KEY)
}

export async function loadQnaDirectedPostsRecord(): Promise<Record<string, QnADirectedPost>> {
  const raw = await pullPhoneKvWithLocalStorageLegacy(WECHAT_ANONYMOUS_QNA_DIRECTED_KV_KEY, [
    LEGACY_ANONYMOUS_QNA_DIRECTED_LS_KEY,
  ])
  return normalizeDirected(raw)
}

export async function saveQnaDirectedPostsRecord(posts: Record<string, QnADirectedPost>): Promise<void> {
  await personaDb.setPhoneKv(WECHAT_ANONYMOUS_QNA_DIRECTED_KV_KEY, { posts })
}

export async function deleteQnaDirectedPostsRecord(): Promise<void> {
  await personaDb.deletePhoneKv(WECHAT_ANONYMOUS_QNA_DIRECTED_KV_KEY)
}
