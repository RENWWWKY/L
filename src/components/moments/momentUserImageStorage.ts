import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'

const IMAGE_KV_PREFIX = 'wechat-user-moment-image-v1'
export const MOMENT_USER_IMAGE_REF_PREFIX = 'moment-user-image:v1:'

function imageStorageKey(accountId: string, momentId: string, index: number): string {
  return `${IMAGE_KV_PREFIX}:${accountId.trim()}:${momentId.trim()}:${index}`
}

export function momentUserImageRef(accountId: string, momentId: string, index: number): string {
  return `${MOMENT_USER_IMAGE_REF_PREFIX}${accountId.trim()}:${momentId.trim()}:${index}`
}

export function isMomentUserImageRef(src: string): boolean {
  return src.trim().startsWith(MOMENT_USER_IMAGE_REF_PREFIX)
}

export function parseMomentUserImageRef(ref: string): {
  accountId: string
  momentId: string
  index: number
} | null {
  const trimmed = ref.trim()
  if (!trimmed.startsWith(MOMENT_USER_IMAGE_REF_PREFIX)) return null
  const body = trimmed.slice(MOMENT_USER_IMAGE_REF_PREFIX.length)
  const lastColon = body.lastIndexOf(':')
  if (lastColon <= 0) return null
  const index = Number(body.slice(lastColon + 1))
  if (!Number.isFinite(index) || index < 0) return null
  const rest = body.slice(0, lastColon)
  const momentColon = rest.lastIndexOf(':')
  if (momentColon <= 0) return null
  const momentId = rest.slice(momentColon + 1).trim()
  const accountId = rest.slice(0, momentColon).trim()
  if (!accountId || !momentId) return null
  return { accountId, momentId, index }
}

function normalizePersistedDataUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('data:')) return trimmed
  return `data:image/jpeg;base64,${trimmed.replace(/^data:image\/jpeg;base64,/i, '')}`
}

const resolvedCache = new Map<string, string>()

export async function loadMomentUserImageDataUrl(ref: string): Promise<string | null> {
  const trimmed = ref.trim()
  if (!trimmed) return null
  if (!isMomentUserImageRef(trimmed)) return trimmed

  const cached = resolvedCache.get(trimmed)
  if (cached) return cached

  const parsed = parseMomentUserImageRef(trimmed)
  if (!parsed) return null

  try {
    const raw = await personaDb.getPhoneKv(
      imageStorageKey(parsed.accountId, parsed.momentId, parsed.index),
    )
    const dataUrl = typeof raw === 'string' ? normalizePersistedDataUrl(raw) : ''
    if (!dataUrl) return null
    resolvedCache.set(trimmed, dataUrl)
    return dataUrl
  } catch {
    return null
  }
}

export async function persistMomentUserImage(
  accountId: string,
  momentId: string,
  index: number,
  src: string,
): Promise<string> {
  const acc = accountId.trim()
  const id = momentId.trim()
  const dataUrl = normalizePersistedDataUrl(src)
  if (!acc || !id || !dataUrl) return src.trim()

  const ref = momentUserImageRef(acc, id, index)
  await personaDb.setPhoneKv(imageStorageKey(acc, id, index), dataUrl)
  resolvedCache.set(ref, dataUrl)
  return ref
}

export async function deleteMomentUserImages(
  accountId: string,
  momentId: string,
  maxIndex = 8,
): Promise<void> {
  const acc = accountId.trim()
  const id = momentId.trim()
  if (!acc || !id) return
  for (let i = 0; i <= maxIndex; i += 1) {
    const ref = momentUserImageRef(acc, id, i)
    resolvedCache.delete(ref)
    try {
      await personaDb.deletePhoneKv(imageStorageKey(acc, id, i))
    } catch {
      /* ignore */
    }
  }
}

function momentImagesNeedExternalize(images: string[]): boolean {
  return images.some((src) => {
    const t = src.trim()
    return t.startsWith('data:') || t.startsWith('blob:')
  })
}

/** 将动态内联大图拆到独立 KV，避免整条朋友圈列表写入失败导致图片丢失 */
export async function externalizeMomentUserImages(
  accountId: string,
  moment: { id: string; images?: string[] },
): Promise<string[] | undefined> {
  const images = moment.images?.map((x) => x.trim()).filter(Boolean) ?? []
  if (!images.length) return undefined
  if (!momentImagesNeedExternalize(images)) return images

  const refs: string[] = []
  for (let i = 0; i < images.length; i += 1) {
    const src = images[i]
    if (isMomentUserImageRef(src)) {
      refs.push(src)
      continue
    }
    refs.push(await persistMomentUserImage(accountId, moment.id, i, src))
  }
  return refs.length ? refs : undefined
}
