import { motion, useMotionTemplate, useTransform, AnimatePresence } from 'framer-motion'

import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'



import { Pressable } from '../../../components/Pressable'

import {

  clearCachedAlbumPhotos,

  peekCachedAlbumPhotos,

  setCachedAlbumPhotos,

} from './albumPhotosSessionCache'

import { AlbumPageSpread } from './AlbumPageSpread'

import { BookContainer } from './BookContainer'

import { chunkPhotosIntoPages, loadCharacterSavedAlbumPhotos } from './loadCharacterChatPhotos'

import './memoryAlbum.css'

import type { PhotoItem } from './memoryAlbumTypes'

import { PolaroidDetailPage } from './PolaroidDetailPage'

import { useHardPageFlip } from './useHardPageFlip'

import { useMemoryAlbumStore } from './useMemoryAlbumStore'



type AlbumBookProps = {

  characterId: string

  characterName: string

  onClose: () => void

}



function FlipPageFace({

  rotateY,

  children,

  zIndex,

}: {

  rotateY: ReturnType<typeof useHardPageFlip>['rotateY']

  children: React.ReactNode

  zIndex: number

}) {

  const shadowOpacity = useTransform(rotateY, [0, -90, -180], [0, 0.24, 0.06])

  const shadowGradient = useMotionTemplate`linear-gradient(270deg, rgba(0,0,0,${shadowOpacity}) 0%, transparent 52%)`



  return (

    <motion.div

      className="memory-album-page-flip transform-gpu absolute inset-0 origin-left will-change-transform"

      style={{ rotateY, zIndex, transformStyle: 'preserve-3d' }}

    >

      <div className="absolute inset-0">{children}</div>

      <motion.div

        className="pointer-events-none absolute inset-0"

        style={{ background: shadowGradient }}

        aria-hidden

      />

    </motion.div>

  )

}



export function AlbumBook({ characterId, characterName, onClose }: AlbumBookProps) {

  const cached = peekCachedAlbumPhotos(characterId)

  const [loading, setLoading] = useState(!cached)

  const [photos, setPhotos] = useState<PhotoItem[]>(cached ?? [])

  const [detailPhoto, setDetailPhoto] = useState<PhotoItem | null>(null)

  const bookScrollRef = useRef<HTMLDivElement>(null)

  const loadedForCharacterRef = useRef<string | null>(cached ? characterId : null)



  const resolvePolaroidTitle = useMemoryAlbumStore((s) => s.resolvePolaroidTitle)

  const pages = useMemo(() => chunkPhotosIntoPages(photos), [photos])

  const flip = useHardPageFlip(pages.length)

  const renderSpread = useCallback(
    (pagePhotos: PhotoItem[], pageKey: string) => (
      <AlbumPageSpread
        photos={pagePhotos}
        characterName={characterName}
        pageKey={pageKey}
        resolvePolaroidTitle={(photoId, fallback) => resolvePolaroidTitle(characterId, photoId, fallback)}
        onOpenPhotoDetail={setDetailPhoto}
      />
    ),
    [characterId, characterName, resolvePolaroidTitle],
  )

  useEffect(() => {
    const cid = characterId.trim()
    if (!cid) {
      setLoading(false)
      return
    }

    const sessionCached = peekCachedAlbumPhotos(cid)
    if (sessionCached) {
      setPhotos(sessionCached)
      setLoading(false)
      loadedForCharacterRef.current = cid
      return
    }

    if (loadedForCharacterRef.current === cid) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const next = await loadCharacterSavedAlbumPhotos(cid)
        if (cancelled) return
        loadedForCharacterRef.current = cid
        setCachedAlbumPhotos(cid, next)
        setPhotos(next)
      } catch {
        if (!cancelled) {
          loadedForCharacterRef.current = null
          setPhotos([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (loadedForCharacterRef.current !== cid) {
        loadedForCharacterRef.current = null
      }
    }
  }, [characterId])



  const handlePhotoDeleted = useCallback(() => {

    setDetailPhoto(null)

    const cid = characterId.trim()

    if (!cid) return

    clearCachedAlbumPhotos(cid)

    loadedForCharacterRef.current = null

    void (async () => {

      const next = await loadCharacterSavedAlbumPhotos(cid)

      loadedForCharacterRef.current = cid

      setCachedAlbumPhotos(cid, next)

      setPhotos(next)

    })()

  }, [characterId])



  const underPage = flip.overlay ? (pages[flip.overlay.underIndex] ?? []) : (pages[flip.pageIndex] ?? [])

  const flipPage = flip.overlay ? (pages[flip.overlay.flipIndex] ?? []) : null



  return (

    <motion.div

      className="fixed inset-0 z-[55000] flex flex-col bg-[#E8E4DC]"

      initial={{ opacity: 0 }}

      animate={{ opacity: 1 }}

      exit={{ opacity: 0 }}

    >

      <div

        className="pointer-events-none absolute inset-x-0 top-0 z-30"

        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}

      >

        <div className="pointer-events-auto flex items-center justify-between px-4 py-3 backdrop-blur-xl">

          <Pressable

            onClick={onClose}

            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 backdrop-blur-md"

            aria-label="关闭相册"

          >

            <X className="size-5 text-neutral-800" strokeWidth={1.75} />

          </Pressable>

          <div className="text-center">

            <p className="text-[15px] font-medium tracking-wide text-neutral-800">{characterName}</p>

            <p className="text-[10px] tracking-[0.2em] text-neutral-500">MEMORY ALBUM</p>

          </div>

          <div className="h-10 w-10" aria-hidden />

        </div>

      </div>



      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-6 pt-[max(64px,env(safe-area-inset-top,0px))]">

        {loading ? (

          <Loader2 className="size-7 animate-spin text-neutral-400" aria-hidden />

        ) : (

          <>

            <div className="relative w-full max-w-[360px]">

              <BookContainer

                ref={bookScrollRef}

                {...flip.bind}

                flipLayer={

                  flipPage ? (

                    <FlipPageFace rotateY={flip.rotateY} zIndex={10}>

                      {renderSpread(flipPage, `flip-${flip.overlay?.flipIndex}`)}

                    </FlipPageFace>

                  ) : null

                }

              >

                {renderSpread(underPage, `under-${flip.pageIndex}`)}

              </BookContainer>

            </div>



            <div className="mt-6 flex items-center gap-4">

              <Pressable

                onClick={() => void flip.flipPrev()}

                disabled={flip.pageIndex === 0 || flip.isFlipping}

                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300/80 bg-white/60 backdrop-blur-sm disabled:opacity-30"

                aria-label="上一页"

              >

                <ChevronLeft className="size-4 text-neutral-700" />

              </Pressable>

              <span className="min-w-[64px] text-center text-[12px] tracking-widest text-neutral-500">

                {flip.pageIndex + 1} / {pages.length}

              </span>

              <Pressable

                onClick={() => void flip.flipNext()}

                disabled={flip.pageIndex >= pages.length - 1 || flip.isFlipping}

                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300/80 bg-white/60 backdrop-blur-sm disabled:opacity-30"

                aria-label="下一页"

              >

                <ChevronRight className="size-4 text-neutral-700" />

              </Pressable>

            </div>



            {photos.length === 0 ? (

              <p className="mt-4 max-w-[260px] text-center text-[13px] leading-relaxed text-neutral-500">

                还没有手动保存的图片。在聊天中长按图片，选择「存相册」后才会收录于此

              </p>

            ) : (
              <p className="mt-3 text-center text-[11px] leading-relaxed tracking-wide text-neutral-400">
                轻点拍立得可编辑标题与详情
              </p>
            )}

          </>

        )}

      </div>



      <AnimatePresence>

        {detailPhoto ? (

          <PolaroidDetailPage

            key={detailPhoto.messageId}

            photo={detailPhoto}

            characterId={characterId}

            characterName={characterName}

            onBack={() => setDetailPhoto(null)}

            onDeleted={handlePhotoDeleted}

          />

        ) : null}

      </AnimatePresence>

    </motion.div>

  )

}


