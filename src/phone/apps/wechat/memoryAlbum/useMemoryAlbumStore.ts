import { create } from 'zustand'

import { personaDb } from '../newFriendsPersona/idb'
import type { MemoryAlbumPersistedRoot, PhotoLayout, PolaroidDetail } from './memoryAlbumTypes'
import { MEMORY_ALBUM_KV_KEY } from './memoryAlbumTypes'
import { centeredPhotoLayout, defaultPhotoLayout } from './photoLayout'
import { clampPhotoRotate, clampPhotoScale, withDefaultPhotoScale } from './photoLayoutUtils'

type MemoryAlbumStore = {
  hydrated: boolean
  currentAccountId: string | null
  root: MemoryAlbumPersistedRoot

  bindAccount: (accountId: string | null | undefined) => Promise<void>
  getPolaroidDetail: (characterId: string, photoId: string) => PolaroidDetail | null
  updatePolaroidDetail: (characterId: string, photoId: string, patch: Partial<PolaroidDetail>) => void
  resolvePhotoLayout: (characterId: string, photoId: string, slotIndex: number, single: boolean) => PhotoLayout
  resolvePolaroidTitle: (characterId: string, photoId: string, fallback: string) => string
  updatePhotoLayout: (characterId: string, photoId: string, layout: PhotoLayout) => void
  removePolaroidDetail: (characterId: string, photoId: string) => void
}

const EMPTY_ACCOUNT = { polaroidsByCharacter: {} }
const EMPTY_ROOT: MemoryAlbumPersistedRoot = { byAccount: {} }

let persistTimer: ReturnType<typeof setTimeout> | null = null

function schedulePersist(root: MemoryAlbumPersistedRoot) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    void personaDb.setPhoneKv(MEMORY_ALBUM_KV_KEY, root)
  }, 280)
}

function normalizeLayout(raw: unknown): PhotoLayout | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<PhotoLayout>
  if (typeof r.x !== 'number' || typeof r.y !== 'number') return null
  return {
    x: r.x,
    y: r.y,
    rotate: clampPhotoRotate(typeof r.rotate === 'number' ? r.rotate : 0),
    scale: clampPhotoScale(typeof r.scale === 'number' ? r.scale : 1),
    z: typeof r.z === 'number' ? r.z : 1,
  }
}

function normalizePolaroidDetail(raw: unknown): PolaroidDetail | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<PolaroidDetail>
  if (typeof r.photoId !== 'string' || !r.photoId.trim()) return null
  const layout = r.layout ? normalizeLayout(r.layout) : null
  return {
    photoId: r.photoId.trim(),
    customTitle: typeof r.customTitle === 'string' ? r.customTitle : undefined,
    essay: typeof r.essay === 'string' ? r.essay : undefined,
    ...(layout ? { layout } : {}),
  }
}

function normalizeRoot(raw: unknown): MemoryAlbumPersistedRoot {
  if (!raw || typeof raw !== 'object') return { byAccount: {} }
  const byAccount = (raw as MemoryAlbumPersistedRoot).byAccount
  if (!byAccount || typeof byAccount !== 'object') return { byAccount: {} }

  const next: MemoryAlbumPersistedRoot = { byAccount: {} }
  for (const [acc, data] of Object.entries(byAccount)) {
    if (!acc.trim() || !data || typeof data !== 'object') continue

    const polaroidsByCharacter: Record<string, Record<string, PolaroidDetail>> = {}
    const rawPolaroids =
      (data as { polaroidsByCharacter?: Record<string, Record<string, unknown>> }).polaroidsByCharacter ?? {}
    for (const [charId, entries] of Object.entries(rawPolaroids)) {
      if (!charId.trim() || !entries || typeof entries !== 'object') continue
      const bucket: Record<string, PolaroidDetail> = {}
      for (const [, detail] of Object.entries(entries)) {
        const normalized = normalizePolaroidDetail(detail)
        if (normalized) bucket[normalized.photoId] = normalized
      }
      if (Object.keys(bucket).length) polaroidsByCharacter[charId] = bucket
    }

    next.byAccount[acc] = { polaroidsByCharacter }
  }
  return next
}

function ensureAccount(root: MemoryAlbumPersistedRoot, accountId: string) {
  if (!root.byAccount[accountId]) {
    root.byAccount[accountId] = { ...EMPTY_ACCOUNT }
  }
  return root.byAccount[accountId]!
}

export const useMemoryAlbumStore = create<MemoryAlbumStore>((set, get) => ({
  hydrated: false,
  currentAccountId: null,
  root: EMPTY_ROOT,

  bindAccount: async (accountId) => {
    const acc = accountId?.trim() || null
    if (!acc) {
      set({ hydrated: true, currentAccountId: null, root: EMPTY_ROOT })
      return
    }
    let raw = await personaDb.getPhoneKv(MEMORY_ALBUM_KV_KEY)
    if (!raw) {
      raw = await personaDb.getPhoneKv('wechat-memory-album-v1')
    }
    set({
      hydrated: true,
      currentAccountId: acc,
      root: normalizeRoot(raw),
    })
  },

  getPolaroidDetail: (characterId, photoId) => {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return null
    return root.byAccount[currentAccountId]?.polaroidsByCharacter[characterId.trim()]?.[photoId.trim()] ?? null
  },

  updatePolaroidDetail: (characterId, photoId, patch) => {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return
    const cid = characterId.trim()
    const pid = photoId.trim()
    const nextRoot = { ...root, byAccount: { ...root.byAccount } }
    const account = ensureAccount(nextRoot, currentAccountId)
    if (!account.polaroidsByCharacter[cid]) account.polaroidsByCharacter[cid] = {}
    const prev = account.polaroidsByCharacter[cid][pid] ?? { photoId: pid }
    account.polaroidsByCharacter[cid][pid] = { ...prev, ...patch, photoId: pid }
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  updatePhotoLayout: (characterId, photoId, layout) => {
    get().updatePolaroidDetail(characterId, photoId, { layout })
  },

  resolvePhotoLayout: (characterId, photoId, slotIndex, single) => {
    const saved = get().getPolaroidDetail(characterId, photoId)?.layout
    if (saved) return withDefaultPhotoScale(saved)
    return withDefaultPhotoScale(single ? centeredPhotoLayout() : defaultPhotoLayout(slotIndex))
  },

  removePolaroidDetail: (characterId, photoId) => {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return
    const cid = characterId.trim()
    const pid = photoId.trim()
    const account = root.byAccount[currentAccountId]
    if (!account?.polaroidsByCharacter[cid]?.[pid]) return
    const nextRoot = { ...root, byAccount: { ...root.byAccount } }
    const nextAccount = { ...ensureAccount(nextRoot, currentAccountId) }
    const nextPolaroids = { ...nextAccount.polaroidsByCharacter }
    const nextCharBucket = { ...nextPolaroids[cid] }
    delete nextCharBucket[pid]
    if (Object.keys(nextCharBucket).length) nextPolaroids[cid] = nextCharBucket
    else delete nextPolaroids[cid]
    nextAccount.polaroidsByCharacter = nextPolaroids
    nextRoot.byAccount[currentAccountId] = nextAccount
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  resolvePolaroidTitle: (characterId, photoId, fallback) => {
    const custom = get().getPolaroidDetail(characterId, photoId)?.customTitle?.trim()
    return custom || fallback
  },
}))
