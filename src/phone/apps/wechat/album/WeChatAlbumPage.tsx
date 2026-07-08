import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { Pressable } from '../../../components/Pressable'
import { ChatImageLightbox } from '../ChatImageLightbox'
import { useLongPress } from '../hooks/useWeChatLongPress'
import { personaDb } from '../newFriendsPersona/idb'
import { formatFavoriteSavedAt } from '../favorites/mapFavoriteToItem'
import type { AlbumDisplayItem } from './albumItemTypes'
import { loadAlbumItems } from './loadAlbumItems'

function AlbumTopBar({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="sticky top-0 z-20 shrink-0 bg-white"
      style={{
        paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        boxShadow: '0 8px 30px rgba(0,0,0,0.03)',
      }}
    >
      <div className="flex items-center gap-1 px-3 py-3">
        <Pressable
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-gray-50"
          aria-label="返回"
        >
          <ArrowLeft className="size-5 text-gray-900" strokeWidth={1.75} />
        </Pressable>
        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate text-[17px] font-semibold tracking-tight text-gray-900">相册</p>
        </div>
        <div className="h-10 w-10 shrink-0" aria-hidden />
      </div>
    </div>
  )
}

function AlbumGridItem({
  item,
  onPreview,
  onOpenActions,
}: {
  item: AlbumDisplayItem
  onPreview: () => void
  onOpenActions: () => void
}) {
  const { bind } = useLongPress({
    enabled: true,
    ms: 500,
    moveThresholdPx: 10,
    onLongPress: onOpenActions,
    onTap: onPreview,
  })

  return (
    <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gray-100" {...bind}>
      <img
        src={item.imageUrl}
        alt=""
        className="max-h-full max-w-full object-contain select-none"
        draggable={false}
        loading="lazy"
      />
      {item.isSticker ? (
        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white">
          表情
        </span>
      ) : null}
    </div>
  )
}

function AlbumActionSheet({
  open,
  item,
  onClose,
  onDelete,
}: {
  open: boolean
  item: AlbumDisplayItem | null
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <AnimatePresence>
      {open && item ? (
        <motion.div
          key="album-action-sheet"
          className="fixed inset-0 z-[52000] flex flex-col justify-end bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="mx-3 mb-[max(12px,env(safe-area-inset-bottom))] overflow-hidden rounded-[20px] bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="border-b border-gray-100 px-5 py-4 text-center text-[12px] text-gray-400">
              来自 {item.sourceName} · {formatFavoriteSavedAt(item.savedAt)}
            </p>
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center justify-center gap-2 py-4 text-[16px] font-medium text-red-600 active:bg-gray-50"
            >
              <Trash2 className="size-4" aria-hidden />
              从相册移除
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full border-t border-gray-100 py-4 text-[16px] text-gray-500 active:bg-gray-50"
            >
              关闭
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function WeChatAlbumPage({
  contacts,
  onBack,
}: {
  contacts: WeChatContactRow[]
  onBack: () => void
}) {
  const [items, setItems] = useState<AlbumDisplayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<AlbumDisplayItem | null>(null)
  const contactsRef = useRef(contacts)
  const loadedRef = useRef(false)

  contactsRef.current = contacts

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const next = await loadAlbumItems(contactsRef.current)
        if (!cancelled) setItems(next)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // 仅打开相册页时加载一次；不监听全局 storage，避免聊天/钱包等写入导致整页每秒重刷
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = useCallback(async () => {
    const target = actionTarget
    if (!target) return
    setActionTarget(null)
    await personaDb.deleteWeChatAlbumItem(target.id)
    setItems((prev) => prev.filter((x) => x.id !== target.id))
  }, [actionTarget])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f7f7]">
      <AlbumTopBar onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-8 pt-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gray-400" aria-hidden />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <p className="text-[15px] font-medium text-gray-700">相册还是空的</p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-400">
              在聊天中长按图片，选择「保存到相册」即可收藏到这里
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-[2px]">
            {items.map((item) => (
              <AlbumGridItem
                key={item.id}
                item={item}
                onPreview={() => setPreviewSrc(item.imageUrl)}
                onOpenActions={() => setActionTarget(item)}
              />
            ))}
          </div>
        )}
      </div>

      <ChatImageLightbox open={!!previewSrc} src={previewSrc ?? ''} onClose={() => setPreviewSrc(null)} />
      <AlbumActionSheet
        open={!!actionTarget}
        item={actionTarget}
        onClose={() => setActionTarget(null)}
        onDelete={() => void handleDelete()}
      />
    </div>
  )
}
