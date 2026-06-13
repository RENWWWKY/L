import { useEffect, useMemo, useState } from 'react'

import { isMomentUserImageRef, loadMomentUserImageDataUrl } from './momentUserImageStorage'

export async function resolveMomentImageSrc(src: string): Promise<string> {
  const trimmed = src.trim()
  if (!trimmed) return ''
  if (isMomentUserImageRef(trimmed)) {
    const dataUrl = await loadMomentUserImageDataUrl(trimmed)
    return dataUrl ?? ''
  }
  return trimmed
}

export async function resolveMomentImageSrcList(images: string[] | undefined): Promise<string[]> {
  const list = (images ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 9)
  if (!list.length) return []
  const out: string[] = []
  for (const src of list) {
    out.push(await resolveMomentImageSrc(src))
  }
  return out.filter(Boolean)
}

function normalizeMomentImageList(images: string[] | undefined): string[] {
  return (images ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 9)
}

/** 轻量指纹：避免把整段 data URL 拼进依赖导致每帧卡死 */
function momentImageListFingerprint(images: string[] | undefined): string {
  return normalizeMomentImageList(images)
    .map((src, index) => {
      if (isMomentUserImageRef(src)) return `${index}:ref:${src}`
      if (src.startsWith('data:') || src.startsWith('blob:')) return `${index}:inline:${src.length}`
      return `${index}:url:${src}`
    })
    .join('|')
}

/** 展示层：把 moment-user-image 引用还原为可显示的 data URL */
export function useResolvedMomentImages(images: string[] | undefined): string[] {
  const fingerprint = momentImageListFingerprint(images)
  const list = useMemo(() => normalizeMomentImageList(images), [fingerprint])
  const needsResolve = useMemo(
    () => list.some((src) => isMomentUserImageRef(src)),
    [fingerprint, list],
  )

  const [resolved, setResolved] = useState<string[]>([])

  useEffect(() => {
    if (!needsResolve) return

    if (!list.length) {
      setResolved((prev) => (prev.length === 0 ? prev : []))
      return
    }

    let cancelled = false
    void resolveMomentImageSrcList(list).then((next) => {
      if (cancelled) return
      const nextKey = next.join('\u0001')
      setResolved((prev) => (prev.join('\u0001') === nextKey ? prev : next))
    })
    return () => {
      cancelled = true
    }
  }, [fingerprint, list, needsResolve])

  if (!needsResolve) return list
  return resolved
}
