import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { NeteaseSongComment } from './neteaseMusicApi'

export type ListenCommentTargetType = 'song' | 'playlist'

export type ListenLocalCommentRecord = {
  id: number
  content: string
  nickname: string
  avatar: string
  userId: number
  time: number
}

const KV_KEY = 'listen-together-local-comments-v1'

type Store = Record<string, ListenLocalCommentRecord[]>

let memory: Store | null = null
let hydrated = false

function targetKey(type: ListenCommentTargetType, id: number) {
  return `${type}:${id}`
}

function localToNeteaseComment(c: ListenLocalCommentRecord): NeteaseSongComment {
  return {
    id: c.id,
    content: c.content,
    nickname: c.nickname,
    avatar: c.avatar,
    userId: c.userId,
    likedCount: 0,
    liked: false,
    time: c.time,
    localOnly: true,
  }
}

async function hydrate(): Promise<void> {
  if (hydrated) return
  const raw = await personaDb.getPhoneKv(KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    memory = raw as Store
  } else {
    memory = {}
  }
  hydrated = true
}

async function persist(): Promise<void> {
  await personaDb.setPhoneKv(KV_KEY, memory ?? {})
}

export async function getLocalComments(
  type: ListenCommentTargetType,
  id: number,
): Promise<NeteaseSongComment[]> {
  if (!id) return []
  await hydrate()
  const key = targetKey(type, id)
  const list = memory?.[key] ?? []
  return list
    .slice()
    .sort((a, b) => b.time - a.time)
    .map(localToNeteaseComment)
}

export async function addLocalComment(
  type: ListenCommentTargetType,
  targetId: number,
  input: { content: string; nickname: string; avatar: string; userId: number },
): Promise<NeteaseSongComment> {
  await hydrate()
  const key = targetKey(type, targetId)
  const record: ListenLocalCommentRecord = {
    id: -Date.now(),
    content: input.content.trim(),
    nickname: input.nickname,
    avatar: input.avatar,
    userId: input.userId,
    time: Date.now(),
  }
  if (!memory) memory = {}
  if (!memory[key]) memory[key] = []
  memory[key].unshift(record)
  await persist()
  return localToNeteaseComment(record)
}
