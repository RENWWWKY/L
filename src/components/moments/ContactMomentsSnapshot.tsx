import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Pressable } from '../../phone/components/Pressable'

import { MomentBodyText } from './ArchiveTimelineDateColumn'
import {
  pickContactMomentSnapshots,
  type ContactMomentSnapshotCell,
} from './contactMomentsSnapshotUtils'
import { loadUserMoments } from './momentsFeedStorage'
import type { MomentContactRef } from './newMomentTypes'
import { useResolvedMomentImages } from './resolveMomentImageSrc'

type ContactMomentsSnapshotProps = {
  characterId: string
  accountId?: string | null
  momentContacts?: MomentContactRef[]
  blockedCharacterIds?: Set<string>
  onOpenArchive: () => void
}

function SnapshotImageCell({ src }: { src: string }) {
  const resolved = useResolvedMomentImages([src])
  const displaySrc = resolved[0]?.trim() ?? ''

  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 shadow-[inset_0_0_10px_rgba(0,0,0,0.02)]">
      {displaySrc ? (
        <img src={displaySrc} alt="" className="size-full object-cover" />
      ) : (
        <div className="size-full animate-pulse bg-gray-100" />
      )}
    </div>
  )
}

function SnapshotCell({ cell }: { cell: ContactMomentSnapshotCell }) {
  if (cell.kind === 'image') {
    return <SnapshotImageCell src={cell.src} />
  }

  return (
    <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-gray-50 px-1.5 shadow-[inset_0_0_10px_rgba(0,0,0,0.02)]">
      <MomentBodyText
        text={cell.preview}
        className="line-clamp-2 text-center text-[10px] leading-relaxed text-gray-600"
      />
    </div>
  )
}

export function ContactMomentsSnapshot({
  characterId,
  accountId,
  momentContacts = [],
  blockedCharacterIds,
  onOpenArchive,
}: ContactMomentsSnapshotProps) {
  const [cells, setCells] = useState<ContactMomentSnapshotCell[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const all = await loadUserMoments(accountId)
      setCells(
        pickContactMomentSnapshots(
          all,
          characterId,
          momentContacts,
          blockedCharacterIds ?? new Set(),
        ),
      )
    } catch {
      setCells([])
    } finally {
      setLoading(false)
    }
  }, [accountId, blockedCharacterIds, characterId, momentContacts])

  useEffect(() => {
    void refresh()
    const onStorage = () => void refresh()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [refresh])

  return (
    <Pressable
      type="button"
      onClick={onOpenArchive}
      className="w-full border-t border-b border-dashed border-gray-100 bg-white py-5 px-6 text-left transition-colors active:bg-gray-50/60"
    >
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <p className="text-[15px] font-medium text-[#111827]">朋友圈</p>
          <p className="mt-0.5 text-[9px] tracking-[0.22em] text-gray-400">MOMENTS</p>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="size-16 shrink-0 animate-pulse rounded-lg bg-gray-100" />
              ))
            ) : cells.length ? (
              cells.map((cell) => <SnapshotCell key={cell.id} cell={cell} />)
            ) : (
              <p className="py-4 text-[12px] text-gray-400">暂无可见动态</p>
            )}
          </div>
          <ChevronRight className="size-4 shrink-0 text-gray-300" strokeWidth={1.5} aria-hidden />
        </div>
      </div>
    </Pressable>
  )
}
