import { AnimatePresence, motion } from 'framer-motion'
import { ImageDown } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { addPlotImageToCharacterAlbum } from '../album/addPlotImageToCharacterAlbum'
import { ChatImageLightbox } from '../ChatImageLightbox'
import { useWeChatLongPress } from '../hooks/useWeChatLongPress'
import { WeChatCenterToast } from '../WeChatCenterToast'
import type { PlotImageItem } from './types'

type Props = {
  image: PlotImageItem
  characterId: string
  plotId: string
  /** 杂志风小图绕排 */
  variant?: 'block' | 'magazine'
  floatSide?: 'left' | 'right'
}

export function PlotImageTile({
  image,
  characterId,
  plotId,
  variant = 'block',
  floatSide = 'left',
}: Props) {
  const src = image.url.trim()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }, [])

  const handleSaveToAlbum = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const result = await addPlotImageToCharacterAlbum({
        characterId,
        plotImageId: image.id,
        imageUrl: src,
        timestamp: image.addedAt,
        caption: `剧情配图 · ${plotId.slice(-6)}`,
      })
      if (result === 'saved') showToast('已保存到相册')
      else if (result === 'duplicate') showToast('已在相册中')
      else showToast('保存失败，请稍后重试')
    } catch (err) {
      console.error('[dating] save plot image to album failed', err)
      showToast('保存失败，请稍后重试')
    } finally {
      setSaving(false)
      setActionOpen(false)
    }
  }, [characterId, image.addedAt, image.id, plotId, saving, showToast, src])

  const { bind, pressing } = useWeChatLongPress({
    enabled: !!characterId && !!src,
    ms: 500,
    moveThresholdPx: 10,
    onLongPress: () => setActionOpen(true),
    onTap: () => setLightboxOpen(true),
  })

  if (!src) return null

  const isMagazine = variant === 'magazine'
  const floatCls =
    floatSide === 'right'
      ? 'float-right ml-3 mr-0 clear-right'
      : 'float-left mr-3 ml-0 clear-left'

  return (
    <>
      <div
        ref={anchorRef}
        className={
          isMagazine
            ? `cursor-zoom-in overflow-hidden rounded-lg border border-stone-200/90 bg-stone-50/80 shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-[transform,opacity] duration-150 ease-out select-none ${floatCls} mb-2 mt-0.5 w-[38%] max-w-[132px]`
            : 'my-1 w-full cursor-zoom-in overflow-hidden rounded-xl border border-stone-200/80 bg-stone-50 transition-[transform,opacity] duration-150 ease-out select-none'
        }
        style={{
          transform: pressing ? 'scale(0.98)' : 'scale(1)',
          opacity: pressing ? 0.92 : 1,
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          shapeOutside: isMagazine ? 'margin-box' : undefined,
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          bind.onPointerDown(e)
        }}
        onPointerMove={(e) => {
          e.stopPropagation()
          bind.onPointerMove(e)
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
          bind.onPointerUp(e)
        }}
        onPointerCancel={(e) => {
          e.stopPropagation()
          bind.onPointerCancel()
        }}
        onPointerLeave={(e) => {
          e.stopPropagation()
          bind.onPointerLeave()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          bind.onContextMenu(e)
        }}
      >
        <img
          src={src}
          alt=""
          className={
            isMagazine
              ? 'aspect-[3/4] w-full object-contain select-none'
              : 'block h-auto w-full max-w-full select-none'
          }
          loading="lazy"
          draggable={false}
        />
      </div>

      <ChatImageLightbox open={lightboxOpen} src={src} onClose={() => setLightboxOpen(false)} />

      <AnimatePresence>
        {actionOpen ? (
          <motion.div
            key="plot-image-action"
            className="fixed inset-0 z-[380] flex flex-col justify-end bg-black/30 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActionOpen(false)}
          >
            <motion.div
              initial={{ y: 36, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 36, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="mx-3 mb-[max(12px,env(safe-area-inset-bottom))] overflow-hidden rounded-2xl border border-stone-200/90 bg-[#fafafa] shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="border-b border-stone-200/80 px-4 py-3 text-center text-[12px] text-[#8e8e8e]">
                剧情配图
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveToAlbum()}
                className="flex w-full items-center justify-center gap-2 py-4 text-[16px] font-medium text-[#262626] transition-colors active:bg-stone-100 disabled:opacity-50"
              >
                <ImageDown className="size-4" strokeWidth={1.75} aria-hidden />
                {saving ? '保存中…' : '存相册'}
              </button>
              <button
                type="button"
                onClick={() => setActionOpen(false)}
                className="w-full border-t border-stone-200/80 py-4 text-[16px] text-[#8e8e8e] transition-colors active:bg-stone-100"
              >
                取消
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <WeChatCenterToast message={toast} />
    </>
  )
}
